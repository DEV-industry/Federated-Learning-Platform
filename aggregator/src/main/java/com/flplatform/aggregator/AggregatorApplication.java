package com.flplatform.aggregator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.concurrent.ConcurrentHashMap;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.Base64;
import java.util.Arrays;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flplatform.aggregator.security.NodeCredentialService;

@SpringBootApplication
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@EnableScheduling
public class AggregatorApplication {

    @Autowired
    private RoundRepository roundRepository;

    @Autowired
    private RegisteredNodeRepository registeredNodeRepository;

    @Autowired
    private GlobalModelStateRepository globalModelStateRepository;

    @Autowired
    private MinioService minioService;

    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private org.springframework.amqp.rabbit.core.RabbitTemplate rabbitTemplate;

    @Autowired
    private BulyanAggregator bulyanAggregator;

    @Autowired
    private NodeCredentialService nodeCredentialService;

    @Value("${fl.aggregation.strategy:MULTI_KRUM}")
    private String aggregationStrategy;

    @Value("${fl.he.enabled:false}")
    private boolean heEnabledConfig;

    @Value("${fl.he.sidecar.url:http://he-sidecar:8001}")
    private String heSidecarUrl;

    @Value("${fl.security.malicious-fraction:0.3}")
    private double maliciousFraction;

    @Value("${fl.min.quorum:2}")
    private int minQuorum;

    @Value("${fl.quorum.timeout-seconds:120}")
    private int quorumTimeoutSeconds; // Legacy, kept for fallback if needed

    @Value("${fl.round.timeout.seconds:300}")
    private int roundTimeoutSeconds;

    @Value("${fl.round.min.completion.percentage:0.7}")
    private double minCompletionPercentage;

    @Value("${fl.heartbeat.stale-threshold-seconds:60}")
    private int heartbeatStaleThresholdSeconds;

    @Value("${fl.dynamic-hparams.dp-enabled:true}")
    private boolean dpEnabledInitial;

    @Value("${fl.dynamic-hparams.fedprox-mu.initial:0.01}")
    private double fedproxMuInitial;

    @Value("${fl.dynamic-hparams.fedprox-mu.min:0.001}")
    private double fedproxMuMin;

    @Value("${fl.dynamic-hparams.fedprox-mu.max:0.05}")
    private double fedproxMuMax;

    @Value("${fl.dynamic-hparams.fedprox-mu.step:0.002}")
    private double fedproxMuStep;

    @Value("${fl.dynamic-hparams.dp-noise.initial:0.01}")
    private double dpNoiseInitial;

    @Value("${fl.dynamic-hparams.dp-noise.min:0.001}")
    private double dpNoiseMin;

    @Value("${fl.dynamic-hparams.dp-noise.max:0.1}")
    private double dpNoiseMax;

    @Value("${fl.dynamic-hparams.dp-noise.step:0.002}")
    private double dpNoiseStep;

    private final Map<String, List<Double>> nodeWeights = new ConcurrentHashMap<>();
    private final Map<String, Double> nodeLosses = new ConcurrentHashMap<>();
    private final Map<String, Double> nodeAccuracies = new ConcurrentHashMap<>();
    private final Map<String, String> nodeSecurityStatus = new ConcurrentHashMap<>();
    private final Map<String, Integer> nodeRejectionCount = new ConcurrentHashMap<>();
    private final Map<String, Boolean> nodeDpStatus = new ConcurrentHashMap<>();

    // HE Tracking
    private final Map<String, byte[]> nodeEncryptedWeights = new ConcurrentHashMap<>();
    private byte[] heContextPublic = null;
    private byte[] heGlobalWeights = null;

    // Dynamic hyperparameter state
    private final DynamicHyperparameterController dynamicHyperparameterController = new DynamicHyperparameterController();
    private volatile boolean currentDpEnabled;
    private volatile double currentFedproxMu;
    private volatile double currentDpNoiseMultiplier;
    private volatile Double previousRoundLoss;
    private volatile Double previousRoundAccuracy;

    // === LIVE ACTIVITY TRACKING ===
    private final Map<String, Map<String, String>> nodeActivity = new ConcurrentHashMap<>();
    private final LinkedList<String> eventLogs = new LinkedList<>();
    private static final int MAX_EVENT_LOGS = 50;
    private volatile String globalStage = "IDLE";
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

    private List<Double> globalWeights = new ArrayList<>();
    private int currentRound = 0;

    // Track when the current round started
    private volatile LocalDateTime roundStartTime = null;

    @jakarta.annotation.PostConstruct
    public void init() {
        int maxRetries = 15;
        int delayMs = 3000;

        for (int i = 0; i < maxRetries; i++) {
            try {
                // Restore round count from training_rounds table
                long count = roundRepository.count();
                if (count > 0) {
                    this.currentRound = (int) count;
                    System.out.println("Resumed FedAvg from Database at Round " + this.currentRound);
                }

                // Restore global model weights from MinIO via path stored in DB
                Optional<GlobalModelStateEntity> latestState = globalModelStateRepository.findTopByOrderByCurrentRoundDesc();
                if (latestState.isPresent()) {
                    GlobalModelStateEntity state = latestState.get();
                    this.currentRound = state.getCurrentRound();
                    if (state.getModelPath() != null && !state.getModelPath().isBlank()) {
                        byte[] blob = minioService.downloadWeights(state.getModelPath());
                        // If HE mode is enabled from config, we restore the blob directly as ciphertext
                        if (this.heEnabledConfig) {
                            this.heGlobalWeights = blob;
                            System.out.println("Restored HE ciphertext from MinIO: " + state.getModelPath());
                        } else {
                            this.globalWeights = deserializeWeights(blob);
                            System.out.println("Restored global model from MinIO: " + state.getModelPath()
                                    + " (Round " + this.currentRound + ", " + this.globalWeights.size() + " parameters)");
                        }
                    }
                }
                this.roundStartTime = LocalDateTime.now();
                this.currentDpEnabled = this.dpEnabledInitial;
                this.currentFedproxMu = this.fedproxMuInitial;
                this.currentDpNoiseMultiplier = this.dpNoiseInitial;
                this.previousRoundLoss = null;
                this.previousRoundAccuracy = null;
                return; // Everything successful
            } catch (Exception e) {
                System.err.println("Database or MinIO not ready (attempt " + (i + 1) + "/" + maxRetries + "): " + e.getMessage());
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted while waiting for dependencies", ie);
                }
            }
        }
        throw new RuntimeException("Failed to initialize Aggregator state after " + maxRetries + " attempts");
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    public static void main(String[] args) {
        SpringApplication.run(AggregatorApplication.class, args);
    }

    // =========================================================================
    // NODE REGISTRATION ENDPOINTS
    // =========================================================================

    @PostMapping("/nodes/register")
    @Transactional
    public synchronized ResponseEntity<Map<String, Object>> registerNode(@RequestBody Map<String, String> payload) {
        String nodeId = payload.get("nodeId");
        String hostname = payload.getOrDefault("hostname", "unknown");

        if (nodeId == null || nodeId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "error",
                "message", "nodeId is required"
            ));
        }

        Optional<RegisteredNodeEntity> existing = registeredNodeRepository.findByNodeId(nodeId);
        if (existing.isPresent()) {
            // Re-registration: update heartbeat and set active
            RegisteredNodeEntity node = existing.get();
            node.setStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
            node.setLastHeartbeat(LocalDateTime.now());
            node.setHostname(hostname);
            registeredNodeRepository.save(node);
            System.out.println("Node re-registered: " + nodeId + " (hostname: " + hostname + ")");
        } else {
            RegisteredNodeEntity node = new RegisteredNodeEntity(nodeId, hostname);
            registeredNodeRepository.save(node);
            System.out.println("New node registered: " + nodeId + " (hostname: " + hostname + ")");
        }

        long activeCount = registeredNodeRepository.countByStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
        broadcastUpdate();

        return ResponseEntity.ok(Map.of(
            "status", "success",
            "message", "Node registered successfully",
            "nodeId", nodeId,
            "currentRound", currentRound,
            "activeNodes", activeCount,
            "minQuorum", minQuorum
        ));
    }

    @PostMapping("/nodes/heartbeat")
    @Transactional
    public ResponseEntity<Map<String, Object>> heartbeat(@RequestBody Map<String, String> payload) {
        String nodeId = payload.get("nodeId");
        if (nodeId == null) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "nodeId required"));
        }

        Optional<RegisteredNodeEntity> nodeOpt = registeredNodeRepository.findByNodeId(nodeId);
        if (nodeOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                "status", "error",
                "message", "Node not registered. Please register first via POST /api/nodes/register"
            ));
        }

        RegisteredNodeEntity node = nodeOpt.get();
        node.setLastHeartbeat(LocalDateTime.now());
        node.setStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
        registeredNodeRepository.save(node);

        return ResponseEntity.ok(Map.of(
            "status", "success",
            "currentRound", currentRound
        ));
    }

    @PostMapping("/nodes/unregister")
    @Transactional
    public synchronized ResponseEntity<Map<String, Object>> unregisterNode(@RequestBody Map<String, String> payload) {
        String nodeId = payload.get("nodeId");
        if (nodeId == null) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "nodeId required"));
        }

        Optional<RegisteredNodeEntity> nodeOpt = registeredNodeRepository.findByNodeId(nodeId);
        if (nodeOpt.isPresent()) {
            RegisteredNodeEntity node = nodeOpt.get();
            node.setStatus(RegisteredNodeEntity.NodeStatus.DISCONNECTED);
            registeredNodeRepository.save(node);
            // Also remove any pending weights from this node
            nodeWeights.remove(nodeId);
            nodeLosses.remove(nodeId);
            nodeAccuracies.remove(nodeId);
            System.out.println("Node unregistered: " + nodeId);
            broadcastUpdate();
        }

        return ResponseEntity.ok(Map.of("status", "success", "message", "Node unregistered: " + nodeId));
    }

    @GetMapping("/nodes")
    public ResponseEntity<Map<String, Object>> listNodes() {
        List<RegisteredNodeEntity> allNodes = registeredNodeRepository.findAll();
        List<Map<String, Object>> nodeList = new ArrayList<>();

        for (RegisteredNodeEntity node : allNodes) {
            Map<String, Object> nodeMap = new HashMap<>();
            nodeMap.put("nodeId", node.getNodeId());
            nodeMap.put("hostname", node.getHostname());
            nodeMap.put("status", node.getStatus().name());
            nodeMap.put("registeredAt", node.getRegisteredAt().toString());
            nodeMap.put("lastHeartbeat", node.getLastHeartbeat().toString());
            nodeList.add(nodeMap);
        }

        long activeCount = registeredNodeRepository.countByStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);

        return ResponseEntity.ok(Map.of(
            "totalRegistered", allNodes.size(),
            "activeCount", activeCount,
            "minQuorum", minQuorum,
            "nodes", nodeList
        ));
    }

    // =========================================================================
    // HEARTBEAT MONITOR — Marks stale nodes every 15 seconds
    // =========================================================================

    @Scheduled(fixedDelayString = "${fl.heartbeat.check-interval-ms:15000}")
    @Transactional
    public void checkStaleNodes() {
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(heartbeatStaleThresholdSeconds);
        List<RegisteredNodeEntity> staleNodes = registeredNodeRepository.findByLastHeartbeatBefore(threshold);

        for (RegisteredNodeEntity node : staleNodes) {
            if (node.getStatus() == RegisteredNodeEntity.NodeStatus.ACTIVE) {
                node.setStatus(RegisteredNodeEntity.NodeStatus.STALE);
                registeredNodeRepository.save(node);
                System.out.println("Node marked STALE (no heartbeat): " + node.getNodeId());
            }
        }
    }

    // =========================================================================
    // QUORUM TIMEOUT MONITOR — Triggers aggregation if quorum timeout expires
    // =========================================================================

    @Scheduled(fixedDelayString = "${fl.quorum.check-interval-ms:10000}")
    public synchronized void checkQuorumTimeout() {
        if (roundStartTime != null) {
            long secondsWaiting = java.time.Duration.between(roundStartTime, LocalDateTime.now()).getSeconds();
            if (secondsWaiting >= roundTimeoutSeconds) {
                if (nodeWeights.size() >= minQuorum) {
                    System.out.println("Round timeout reached (" + roundTimeoutSeconds + "s). "
                        + "Aggregating with " + nodeWeights.size() + " nodes (min quorum: " + minQuorum + ").");
                    aggregateWeights();
                    broadcastUpdate();
                } else {
                    System.out.println("Round timeout reached but insufficient nodes (" + nodeWeights.size() + " < " + minQuorum + "). Skipping round.");
                    this.nodeWeights.clear();
                    this.nodeLosses.clear();
                    this.nodeAccuracies.clear();
                    this.roundStartTime = LocalDateTime.now();
                    broadcastUpdate();
                }
            }
        }
    }

    // =========================================================================
    // LIVE ACTIVITY TRACKING — Real-time node status + event log
    // =========================================================================

    private void addEventLog(String message) {
        String timestamp = LocalDateTime.now().format(TIME_FMT);
        String entry = "[" + timestamp + "] " + message;
        synchronized (eventLogs) {
            eventLogs.addLast(entry);
            while (eventLogs.size() > MAX_EVENT_LOGS) {
                eventLogs.removeFirst();
            }
        }
    }

    @PostMapping("/nodes/activity")
    public ResponseEntity<Map<String, String>> reportActivity(@RequestBody Map<String, String> payload) {
        String nodeId = payload.get("nodeId");
        String status = payload.get("status");
        String detail = payload.getOrDefault("detail", "");

        if (nodeId == null || status == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "nodeId and status required"));
        }

        Map<String, String> activity = new HashMap<>();
        activity.put("status", status);
        activity.put("detail", detail);
        nodeActivity.put(nodeId, activity);

        // Generate event log based on status change
        switch (status) {
            case "DOWNLOADING":
                addEventLog("\uD83D\uDCE5 " + nodeId + " is downloading global model");
                break;
            case "TRAINING":
                if (!detail.isEmpty()) {
                    addEventLog("\u26A1 " + nodeId + " training: " + detail);
                } else {
                    addEventLog("\uD83D\uDD04 " + nodeId + " started local training");
                }
                break;
            case "UPLOADING":
                addEventLog("\u2B06\uFE0F " + nodeId + " is uploading weights via gRPC");
                break;
            case "IDLE":
                addEventLog("\u23F8\uFE0F " + nodeId + " is idle, waiting for next round");
                break;
            case "EVALUATING":
                addEventLog("\uD83D\uDCCA " + nodeId + " is evaluating model accuracy");
                break;
            default:
                addEventLog("\u2139\uFE0F " + nodeId + ": " + status + (detail.isEmpty() ? "" : " (" + detail + ")"));
        }

        // Update global stage based on aggregated node statuses
        updateGlobalStage();
        broadcastUpdate();

        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    private void updateGlobalStage() {
        if (nodeActivity.isEmpty()) {
            globalStage = "IDLE";
            return;
        }

        boolean anyTraining = false;
        boolean anyDownloading = false;
        boolean anyUploading = false;
        boolean anyEvaluating = false;

        for (Map<String, String> act : nodeActivity.values()) {
            String s = act.getOrDefault("status", "IDLE");
            switch (s) {
                case "TRAINING": anyTraining = true; break;
                case "DOWNLOADING": anyDownloading = true; break;
                case "UPLOADING": anyUploading = true; break;
                case "EVALUATING": anyEvaluating = true; break;
            }
        }

        if (anyDownloading) globalStage = "DISTRIBUTING";
        else if (anyTraining) globalStage = "TRAINING";
        else if (anyEvaluating) globalStage = "EVALUATING";
        else if (anyUploading) globalStage = "AGGREGATING";
        else globalStage = "IDLE";
    }

    // =========================================================================
    // WEIGHT SUBMISSION (refactored for dynamic quorum)
    // =========================================================================

    private void broadcastUpdate() {
        if (messagingTemplate != null) {
            try {
                long activeNodes = registeredNodeRepository.countByStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
                Map<String, Object> update = new HashMap<>();
                update.put("status", getStatus());
                update.put("history", getHistory());
                update.put("registeredNodes", activeNodes);
                update.put("nodeActivity", new HashMap<>(nodeActivity));
                synchronized (eventLogs) {
                    update.put("eventLogs", new ArrayList<>(eventLogs));
                }
                update.put("globalStage", globalStage);
                messagingTemplate.convertAndSend("/topic/updates", update);
            } catch (Exception e) {
                System.err.println("Failed to broadcast update: " + e.getMessage());
            }
        }
    }

    public synchronized boolean validateAndQueueWeights(String nodeId, List<Double> weights, Double loss, Double accuracy, Boolean dpEnabled, Integer roundNumber, Boolean heEnabled, byte[] encryptedWeights, byte[] heContextPublic) {

        // Validate round
        if (roundNumber == null || roundNumber != currentRound) {
            System.out.println("Discarded weights from " + nodeId +": invalid or outdated round (got " + roundNumber + ", expected " + currentRound + ")");
            return false;
        }

        // Verify node is registered
        Optional<RegisteredNodeEntity> nodeOpt = registeredNodeRepository.findByNodeId(nodeId);
        if (nodeOpt.isEmpty()) {
            return false;
        }

        // Update heartbeat on weight submission
        RegisteredNodeEntity node = nodeOpt.get();
        node.setLastHeartbeat(LocalDateTime.now());
        node.setStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
        registeredNodeRepository.save(node);

        System.out.println("Received weights from " + nodeId + " (sending to MinIO and RabbitMQ queue)");

        try {
            byte[] data;

            if (this.heEnabledConfig && (heEnabled == null || !heEnabled)) {
                System.out.println("Rejected submission from " + nodeId + ": HE is required but submission is plaintext.");
                return false;
            }

            if (!this.heEnabledConfig && heEnabled != null && heEnabled) {
                System.out.println("Rejected submission from " + nodeId + ": HE payload provided while HE mode is disabled.");
                return false;
            }

            if (heEnabled != null && heEnabled) {
                if (encryptedWeights == null || heContextPublic == null) {
                    System.out.println("Rejected HE submission from " + nodeId + ": missing encrypted payload or HE context.");
                    return false;
                }

                if (this.heContextPublic == null) {
                    this.heContextPublic = Arrays.copyOf(heContextPublic, heContextPublic.length);
                    System.out.println("HE public context established from node " + nodeId
                            + " (fingerprint=" + heContextFingerprint(this.heContextPublic) + ")");
                } else if (!Arrays.equals(this.heContextPublic, heContextPublic)) {
                    System.out.println("Rejected HE submission from " + nodeId
                            + ": public context mismatch (expected=" + heContextFingerprint(this.heContextPublic)
                            + ", got=" + heContextFingerprint(heContextPublic) + ")");
                    return false;
                }

                data = encryptedWeights;
            } else {
                data = this.serializeWeights(weights);
            }
            
            long timestamp = System.currentTimeMillis();
            String path = "client-models/round-" + currentRound + "/" + nodeId + "-" + timestamp + ".bin";
            minioService.uploadWeights(path, data);
            
            String heContextPath = null;
            if (heEnabled != null && heEnabled) {
                heContextPath = "context/round-" + currentRound + "/public.ctx";
                minioService.uploadWeights(heContextPath, this.heContextPublic);
            }

            ModelSubmissionMessage msg = new ModelSubmissionMessage(
                    nodeId, path, loss, accuracy, dpEnabled, roundNumber, heEnabled, heContextPath);
            
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY, msg);
            
            return true;
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private String heContextFingerprint(byte[] contextBytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return Base64.getEncoder().encodeToString(digest.digest(contextBytes));
        } catch (NoSuchAlgorithmException e) {
            return "sha256-unavailable";
        }
    }
    
    public int getCurrentRound() {
        return currentRound;
    }

    public List<Double> getGlobalWeights() {
        return globalWeights;
    }

    public boolean isHeGlobalModelAvailable() {
        return this.heEnabledConfig && this.heGlobalWeights != null;
    }

    public byte[] getHeGlobalWeights() {
        return this.heGlobalWeights;
    }

    public boolean isCurrentDpEnabled() {
        return this.currentDpEnabled;
    }

    public double getCurrentFedproxMu() {
        return this.currentFedproxMu;
    }

    public double getCurrentDpNoiseMultiplier() {
        return this.currentDpNoiseMultiplier;
    }

    public synchronized void processNodeSubmission(String nodeId, List<Double> weights, Double loss, Double accuracy, Boolean dpEnabled, Integer roundNumber, Boolean heEnabled, byte[] encryptedBlob, String heContextPath) {
        if (roundNumber == null || roundNumber != currentRound) {
            System.out.println("Processing skipped for nodeId " + nodeId + ": outdated round (got " + roundNumber + ", expected " + currentRound + ")");
            return;
        }

        System.out.println("Processing submitted weights from queue for node: " + nodeId);
        
        if (heEnabled != null && heEnabled && encryptedBlob != null) {
            nodeEncryptedWeights.put(nodeId, encryptedBlob);
            nodeWeights.put(nodeId, new ArrayList<>()); // Placeholder to keep counting simple
        } else {
            nodeWeights.put(nodeId, weights);
        }
        
        if (loss != null) {
            nodeLosses.put(nodeId, loss);
        }
        if (accuracy != null) {
            nodeAccuracies.put(nodeId, accuracy);
        }
        if (dpEnabled != null) {
            nodeDpStatus.put(nodeId, dpEnabled);
        } else {
            nodeDpStatus.put(nodeId, false);
        }

        long activeNodes = registeredNodeRepository.countByStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
        int targetQuorum = (int) Math.ceil(activeNodes * minCompletionPercentage);

        // Check if we've reached the dynamic quorum
        int effectiveQuorum = Math.max(minQuorum, targetQuorum);

        if (nodeWeights.size() >= effectiveQuorum) {
            aggregateWeights();
        }

        broadcastUpdate();
    }

    @PostMapping("/config")
    public synchronized Map<String, Object> updateConfig(@RequestBody Map<String, Object> config) {
        boolean updated = false;
        StringBuilder message = new StringBuilder("Config updated: ");

        if (config.containsKey("expectedNodes")) {
            // Map legacy 'expectedNodes' to new minQuorum
            this.minQuorum = ((Number) config.get("expectedNodes")).intValue();
            message.append("minQuorum=").append(this.minQuorum).append(" ");
            updated = true;
        }

        if (config.containsKey("minQuorum")) {
            this.minQuorum = ((Number) config.get("minQuorum")).intValue();
            message.append("minQuorum=").append(this.minQuorum).append(" ");
            updated = true;
        }

        if (config.containsKey("maliciousFraction")) {
            this.maliciousFraction = ((Number) config.get("maliciousFraction")).doubleValue();
            message.append("maliciousFraction=").append(this.maliciousFraction).append(" ");
            updated = true;
        }

        if (config.containsKey("dpEnabled")) {
            this.currentDpEnabled = (Boolean) config.get("dpEnabled");
            message.append("dpEnabled=").append(this.currentDpEnabled).append(" ");
            updated = true;
        }

        if (config.containsKey("fedproxMu")) {
            this.currentFedproxMu = ((Number) config.get("fedproxMu")).doubleValue();
            message.append("fedproxMu=").append(this.currentFedproxMu).append(" ");
            updated = true;
        }

        if (config.containsKey("dpNoiseMultiplier")) {
            this.currentDpNoiseMultiplier = ((Number) config.get("dpNoiseMultiplier")).doubleValue();
            message.append("dpNoiseMultiplier=").append(this.currentDpNoiseMultiplier).append(" ");
            updated = true;
        }

        if (updated) {
            int effectiveQuorum = Math.max(this.minQuorum,
                    (int) registeredNodeRepository.countByStatus(RegisteredNodeEntity.NodeStatus.ACTIVE));
            if (effectiveQuorum < 1) effectiveQuorum = 1;

            if (this.nodeWeights.size() >= effectiveQuorum) {
                aggregateWeights();
            }
            broadcastUpdate();
            return Map.of("status", "success", "message", message.toString().trim());
        }

        return Map.of("status", "error", "message", "Invalid config payload");
    }

    // =========================================================================
    // FEDAVG AGGREGATION (with persistence)
    // =========================================================================

    private double calculateDistance(List<Double> w1, List<Double> w2) {
        if (w1 == null || w2 == null || w1.size() != w2.size()) {
            return Double.MAX_VALUE;
        }
        double sumSq = 0.0;
        for (int i = 0; i < w1.size(); i++) {
            double diff = w1.get(i) - w2.get(i);
            sumSq += diff * diff;
        }
        return Math.sqrt(sumSq);
    }

    private void aggregateWeights() {
        globalStage = "AGGREGATING";
        addEventLog("\uD83E\uDDE0 Starting FedAvg aggregation for round " + (currentRound + 1) + " with " + nodeWeights.size() + " nodes");
        System.out.println("Starting FedAvg (Multi-Krum) for round " + (currentRound + 1) + " with "
                + nodeWeights.size() + " node submissions...");

        List<List<Double>> validWeights = new ArrayList<>();
        int prevRoundParamCount = this.globalWeights != null ? this.globalWeights.size() : 0;
        int n = nodeWeights.size();

        if (this.currentRound == 0 || prevRoundParamCount == 0 && !this.heEnabledConfig) {
            // First round: Acccept all natively
            for (Map.Entry<String, List<Double>> entry : nodeWeights.entrySet()) {
                nodeSecurityStatus.put(entry.getKey(), "Accepted");
                validWeights.add(entry.getValue());
            }
        } else if (this.heEnabledConfig) {
            // HE Mode: The aggregator CANNOT see raw weights to run Krum/Bulyan dist calculations.
            // In a pure HE setup, anomaly detection must be done blindly (not implemented) or skipped.
            // We blindly accept all encrypted blobs and forward to the sidecar.
            for (Map.Entry<String, byte[]> entry : nodeEncryptedWeights.entrySet()) {
                nodeSecurityStatus.put(entry.getKey(), "Accepted (HE Blind)");
            }
        } else if ("BULYAN".equalsIgnoreCase(this.aggregationStrategy)) {
            // Bulyan Algorithm
            int f = (int) Math.floor(n * this.maliciousFraction);
            validWeights.add(new ArrayList<>()); // Placeholder to skip old check later
            this.globalWeights = bulyanAggregator.aggregate(nodeWeights, f, nodeSecurityStatus, nodeRejectionCount);
        } else {
            // Multi-Krum logic
            int f = (int) Math.floor(n * this.maliciousFraction);
            // Krum requires at least n - f - 2 > 0 neighbors to calculate score.
            // If n is too small, fallback to standard FedAvg without rejection
            int numNeighbors = n - f - 2;
            
            if (numNeighbors < 1) {
                System.out.println("Warning: Not enough nodes for Multi-Krum (n=" + n + ", f=" + f + "). Accepting all.");
                for (Map.Entry<String, List<Double>> entry : nodeWeights.entrySet()) {
                    nodeSecurityStatus.put(entry.getKey(), "Accepted");
                    validWeights.add(entry.getValue());
                }
            } else {
                List<String> nodeIds = new ArrayList<>(nodeWeights.keySet());
                Map<String, Double> krumScores = new HashMap<>();

                // Calculate pairwise distances
                for (int i = 0; i < n; i++) {
                    String idA = nodeIds.get(i);
                    List<Double> distances = new ArrayList<>();
                    for (int j = 0; j < n; j++) {
                        if (i == j) continue;
                        String idB = nodeIds.get(j);
                        distances.add(calculateDistance(nodeWeights.get(idA), nodeWeights.get(idB)));
                    }
                    distances.sort(Double::compareTo);

                    double score = 0.0;
                    for (int k = 0; k < numNeighbors; k++) {
                        score += distances.get(k);
                    }
                    krumScores.put(idA, score);
                }

                // Sort nodes by Krum score (ascending)
                nodeIds.sort((id1, id2) -> Double.compare(krumScores.get(id1), krumScores.get(id2)));

                // Select top m = n - f nodes
                int m = Math.max(1, n - f);
                for (int i = 0; i < n; i++) {
                    String nodeId = nodeIds.get(i);
                    if (i < m) {
                        nodeSecurityStatus.put(nodeId, "Accepted");
                        validWeights.add(nodeWeights.get(nodeId));
                    } else {
                        System.out.println("SUSPICIOUS node rejected by Multi-Krum: " + nodeId + " with score " + krumScores.get(nodeId));
                        nodeSecurityStatus.put(nodeId, "Rejected");
                        nodeRejectionCount.put(nodeId, nodeRejectionCount.getOrDefault(nodeId, 0) + 1);
                    }
                }
            }
        }

        if (validWeights.isEmpty() && !this.heEnabledConfig && !"BULYAN".equalsIgnoreCase(this.aggregationStrategy)) {
            System.out.println("All nodes rejected in round " + (currentRound + 1) + ". Round skipped.");
            this.nodeWeights.clear();
            this.nodeEncryptedWeights.clear();
            this.nodeLosses.clear();
            this.nodeAccuracies.clear();
            this.roundStartTime = LocalDateTime.now();
            return;
        }

        if (this.heEnabledConfig) {
            // Make HTTP call to HE Sidecar
            try {
                System.out.println("Delegating " + nodeEncryptedWeights.size() + " encrypted payloads to HE sidecar...");
                List<String> b64Blobs = new ArrayList<>();
                for (byte[] b : nodeEncryptedWeights.values()) {
                    b64Blobs.add(Base64.getEncoder().encodeToString(b));
                }
                
                Map<String, Object> reqBody = new HashMap<>();
                reqBody.put("pub_ctx", Base64.getEncoder().encodeToString(this.heContextPublic));
                reqBody.put("encrypted_blobs", b64Blobs);
                
                ObjectMapper mapper = new ObjectMapper();
                String jsonBody = mapper.writeValueAsString(reqBody);
                
                HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(java.time.Duration.ofSeconds(30))
                    .build();
                    
                HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(this.heSidecarUrl + "/aggregate"))
                    .header("Content-Type", "application/json")
                    .timeout(java.time.Duration.ofMinutes(10))
                    .POST(BodyPublishers.ofString(jsonBody))
                    .build();
                    
                HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
                
                if (response.statusCode() == 200) {
                    @SuppressWarnings("unchecked")
                    Map<String, String> resBody = mapper.readValue(response.body(), Map.class);
                    this.heGlobalWeights = Base64.getDecoder().decode(resBody.get("aggregated_blob"));
                    System.out.println("Successfully received aggregated HE ciphertext from sidecar.");
                } else {
                    System.err.println("HE Sidecar failed with status " + response.statusCode() + ": " + response.body());
                    throw new RuntimeException("HE aggregation failed.");
                }
            } catch (Exception e) {
                System.err.println("Exception calling HE Sidecar: " + e.getMessage());
                e.printStackTrace();
            }
        } else if (!"BULYAN".equalsIgnoreCase(this.aggregationStrategy)) {
            int numParams = validWeights.get(0).size();
            List<Double> newGlobalWeights = new ArrayList<>(numParams);

            for (int i = 0; i < numParams; i++) {
                double sum = 0.0;
                for (List<Double> nodeWeight : validWeights) {
                    sum += nodeWeight.get(i);
                }
                newGlobalWeights.add(sum / validWeights.size());
            }
            this.globalWeights = newGlobalWeights;
        }

        double avgLoss = 0.0;
        if (!nodeLosses.isEmpty()) {
            for (Double loss : nodeLosses.values()) {
                avgLoss += loss;
            }
            avgLoss /= nodeLosses.size();
        }

        double accuracy = 0.0;
        if (!nodeAccuracies.isEmpty()) {
            for (Double acc : nodeAccuracies.values()) {
                accuracy += acc;
            }
            accuracy /= nodeAccuracies.size();
        } else {
            accuracy = Math.max(0.1, 1.0 - (avgLoss * 0.4));
            if (accuracy > 0.99) accuracy = 0.99;
        }

        tuneRoundHyperparameters(avgLoss, accuracy);

        this.currentRound++;

        // Persist round to training_rounds table
        RoundEntity entity = new RoundEntity(currentRound, avgLoss, accuracy, LocalDateTime.now(), new HashMap<>(nodeSecurityStatus));
        roundRepository.save(entity);

        // Persist global model state to database (for replicated aggregator support)
        persistGlobalModelState();

        // Clear in-memory round state
        this.nodeWeights.clear();
        this.nodeEncryptedWeights.clear();
        this.nodeLosses.clear();
        this.nodeAccuracies.clear();
        this.nodeActivity.clear();
        this.roundStartTime = LocalDateTime.now();
        this.globalStage = "IDLE";

        addEventLog("\u2705 Round " + currentRound + " completed! Accuracy: " + String.format("%.2f%%", accuracy * 100) + ", Loss: " + String.format("%.4f", avgLoss));
        System.out.println("FedAvg completed successfully! Global model updated to round " + currentRound
                + " (aggregated " + validWeights.size() + " nodes)");
        broadcastUpdate();
    }

    private void tuneRoundHyperparameters(double avgLoss, double accuracy) {
        if (this.previousRoundLoss == null || this.previousRoundAccuracy == null) {
            this.previousRoundLoss = avgLoss;
            this.previousRoundAccuracy = accuracy;
            System.out.println("Initialized dynamic hyperparameters: dpEnabled=" + this.currentDpEnabled
                    + ", fedproxMu=" + this.currentFedproxMu
                    + ", dpNoiseMultiplier=" + this.currentDpNoiseMultiplier);
            return;
        }

        DynamicHyperparameterController.TunedHyperparameters tuned = dynamicHyperparameterController.tune(
                this.currentFedproxMu,
                this.currentDpNoiseMultiplier,
                this.previousRoundLoss,
                avgLoss,
                this.previousRoundAccuracy,
                accuracy,
                this.fedproxMuMin,
                this.fedproxMuMax,
                this.fedproxMuStep,
                this.dpNoiseMin,
                this.dpNoiseMax,
                this.dpNoiseStep
        );

        this.currentFedproxMu = tuned.fedproxMu();
        this.currentDpNoiseMultiplier = tuned.dpNoiseMultiplier();
        this.previousRoundLoss = avgLoss;
        this.previousRoundAccuracy = accuracy;

        System.out.println("Dynamic hyperparameters tuned: fedproxMu=" + this.currentFedproxMu
                + ", dpNoiseMultiplier=" + this.currentDpNoiseMultiplier
                + ", lossDelta=" + String.format("%.6f", tuned.lossDelta())
                + ", accuracyDelta=" + String.format("%.6f", tuned.accuracyDelta()) + ")");
    }

    private void persistGlobalModelState() {
        try {
            byte[] blob;
            if (this.heEnabledConfig && this.heGlobalWeights != null) {
                blob = this.heGlobalWeights;
            } else {
                blob = serializeWeights(this.globalWeights);
            }
            
            String objectName = "models/round-" + this.currentRound + ".bin";
            minioService.uploadWeights(objectName, blob);
            GlobalModelStateEntity stateEntity = new GlobalModelStateEntity(this.currentRound, objectName);
            globalModelStateRepository.save(stateEntity);
        } catch (Exception e) {
            System.err.println("Failed to persist global model state: " + e.getMessage());
        }
    }

    public byte[] serializeWeights(List<Double> weights) {
        ByteBuffer buffer = ByteBuffer.allocate(weights.size() * 8);
        for (Double w : weights) {
            buffer.putDouble(w != null ? w : 0.0);
        }
        return buffer.array();
    }

    public List<Double> deserializeWeights(byte[] blob) {
        if (blob == null || blob.length == 0) return new ArrayList<>();
        ByteBuffer buffer = ByteBuffer.wrap(blob);
        List<Double> weights = new ArrayList<>(blob.length / 8);
        while (buffer.hasRemaining()) {
            weights.add(buffer.getDouble());
        }
        return weights;
    }

    // =========================================================================
    // TRAINING RESET
    // =========================================================================

    @DeleteMapping("/training/reset")
    @Transactional
    public synchronized Map<String, Object> resetTraining() {
        int revokedNodes = nodeCredentialService.revokeAllNodeCredentials();
        roundRepository.deleteAll();
        globalModelStateRepository.deleteAll();
        minioService.deleteAllObjects();
        this.currentRound = 0;
        this.globalWeights.clear();
        this.heGlobalWeights = null;
        this.heContextPublic = null;
        this.nodeWeights.clear();
        this.nodeEncryptedWeights.clear();
        this.nodeLosses.clear();
        this.nodeAccuracies.clear();
        this.nodeSecurityStatus.clear();
        this.nodeRejectionCount.clear();
        this.nodeDpStatus.clear();
        this.currentDpEnabled = this.dpEnabledInitial;
        this.currentFedproxMu = this.fedproxMuInitial;
        this.currentDpNoiseMultiplier = this.dpNoiseInitial;
        this.previousRoundLoss = null;
        this.previousRoundAccuracy = null;
        this.nodeActivity.clear();
        synchronized (eventLogs) {
            this.eventLogs.clear();
        }
        this.globalStage = "IDLE";
        this.roundStartTime = LocalDateTime.now();
        addEventLog("\uD83D\uDDD1\uFE0F System reset. All training data cleared and node sessions revoked.");
        System.out.println("Emergency Reset Completed. Database and MinIO cleared. State back to Round 0.");
        broadcastUpdate();
        return Map.of(
            "status", "success",
                "message", "Training reset to round 0. Node sessions revoked.",
            "revokedNodes", revokedNodes
        );
    }

    // =========================================================================
    // STATUS & HISTORY ENDPOINTS
    // =========================================================================

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        List<Map<String, Object>> nodeDetails = new ArrayList<>();
        java.util.Set<String> allActiveNodes = new java.util.HashSet<>();
        allActiveNodes.addAll(nodeWeights.keySet());
        allActiveNodes.addAll(nodeSecurityStatus.keySet());

        // Also include all registered nodes
        List<RegisteredNodeEntity> registeredNodes = registeredNodeRepository.findAll();
        for (RegisteredNodeEntity regNode : registeredNodes) {
            allActiveNodes.add(regNode.getNodeId());
        }

        for (String nodeId : allActiveNodes) {
            String status = "Pending";
            if (nodeSecurityStatus.containsKey(nodeId)) {
                status = nodeSecurityStatus.get(nodeId);
            } else {
                // Check registration status
                Optional<RegisteredNodeEntity> regNode = registeredNodeRepository.findByNodeId(nodeId);
                if (regNode.isPresent()) {
                    status = "Registered (" + regNode.get().getStatus().name() + ")";
                }
            }
            int rejections = nodeRejectionCount.getOrDefault(nodeId, 0);
            boolean dpEnabled = nodeDpStatus.getOrDefault(nodeId, false);

            Map<String, Object> detail = new HashMap<>();
            detail.put("nodeId", nodeId);
            detail.put("status", status);
            detail.put("rejectedRounds", rejections);
            detail.put("dpEnabled", dpEnabled);
            // Attach live activity if available
            if (nodeActivity.containsKey(nodeId)) {
                detail.put("activity", nodeActivity.get(nodeId));
            }
            nodeDetails.add(detail);
        }

        long activeRegistered = registeredNodeRepository.countByStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);

        Map<String, Object> result = new HashMap<>();
        result.put("totalNodes", nodeWeights.size());
        result.put("expectedNodes", minQuorum);
        result.put("registeredNodes", activeRegistered);
        result.put("currentRound", currentRound);
        result.put("maliciousFraction", maliciousFraction);
        result.put("dynamicHyperparameters", Map.of(
            "dpEnabled", this.currentDpEnabled,
            "fedproxMu", this.currentFedproxMu,
            "dpNoiseMultiplier", this.currentDpNoiseMultiplier
        ));
        result.put("nodeDetails", nodeDetails);
        result.put("globalStage", globalStage);
        result.put("nodeActivity", new HashMap<>(nodeActivity));
        synchronized (eventLogs) {
            result.put("eventLogs", new ArrayList<>(eventLogs));
        }
        return result;
    }



    @GetMapping("/model/download")
    public ResponseEntity<byte[]> downloadModel() {
        if (globalWeights == null || globalWeights.isEmpty()) {
            return ResponseEntity.badRequest().body(new byte[0]);
        }

        byte[] modelBytes = serializeWeights(globalWeights);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", "global_model_r" + currentRound + ".bin");

        return ResponseEntity.ok()
                .headers(headers)
                .body(modelBytes);
    }

    @GetMapping("/history")
    public List<Map<String, Object>> getHistory() {
        List<RoundEntity> records = roundRepository.findAll();
        List<Map<String, Object>> history = new ArrayList<>();
        for (RoundEntity r : records) {
            Map<String, Object> roundMap = new HashMap<>();
            roundMap.put("round", r.getRoundNumber());
            roundMap.put("loss", r.getAvgLoss());
            roundMap.put("accuracy", r.getAccuracy());
            roundMap.put("nodeStatuses", r.getNodeStatuses() != null ? r.getNodeStatuses() : new HashMap<>());
            history.add(roundMap);
        }
        return history;
    }
}


