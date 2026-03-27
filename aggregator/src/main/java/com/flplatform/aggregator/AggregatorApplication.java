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
import java.util.concurrent.ConcurrentHashMap;
import java.time.LocalDateTime;
import java.util.Optional;

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

    @Value("${fl.security.threshold:5.0}")
    private double safetyThreshold;

    @Value("${API_KEY}")
    private String apiKey;

    @Value("${fl.min.quorum:2}")
    private int minQuorum;

    @Value("${fl.quorum.timeout-seconds:120}")
    private int quorumTimeoutSeconds;

    @Value("${fl.heartbeat.stale-threshold-seconds:60}")
    private int heartbeatStaleThresholdSeconds;

    private final Map<String, List<Double>> nodeWeights = new ConcurrentHashMap<>();
    private final Map<String, Double> nodeLosses = new ConcurrentHashMap<>();
    private final Map<String, Double> nodeAccuracies = new ConcurrentHashMap<>();
    private final Map<String, String> nodeSecurityStatus = new ConcurrentHashMap<>();
    private final Map<String, Integer> nodeRejectionCount = new ConcurrentHashMap<>();
    private final Map<String, Boolean> nodeDpStatus = new ConcurrentHashMap<>();

    private List<Double> globalWeights = new ArrayList<>();
    private int currentRound = 0;

    // Track when the first weight submission for the current round arrived (for quorum timeout)
    private volatile LocalDateTime firstSubmissionTime = null;

    @jakarta.annotation.PostConstruct
    public void init() {
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
                try {
                    byte[] blob = minioService.downloadWeights(state.getModelPath());
                    this.globalWeights = deserializeWeights(blob);
                    System.out.println("Restored global model from MinIO: " + state.getModelPath()
                            + " (Round " + this.currentRound + ", " + this.globalWeights.size() + " parameters)");
                } catch (Exception e) {
                    System.err.println("Failed to restore weights from MinIO: " + e.getMessage());
                }
            }
        }
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
        if (firstSubmissionTime != null && !nodeWeights.isEmpty()) {
            long secondsWaiting = java.time.Duration.between(firstSubmissionTime, LocalDateTime.now()).getSeconds();
            if (secondsWaiting >= quorumTimeoutSeconds && nodeWeights.size() >= 1) {
                System.out.println("Quorum timeout reached (" + quorumTimeoutSeconds + "s). "
                    + "Aggregating with " + nodeWeights.size() + " nodes (quorum: " + minQuorum + ").");
                aggregateWeights();
                broadcastUpdate();
            }
        }
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
                messagingTemplate.convertAndSend("/topic/updates", update);
            } catch (Exception e) {
                System.err.println("Failed to broadcast update: " + e.getMessage());
            }
        }
    }

    @PostMapping("/weights")
    public synchronized ResponseEntity<Map<String, Object>> receiveWeights(
            @RequestHeader(value = "X-API-Key", required = false) String requestApiKey,
            @RequestBody WeightPayload payload) {

        if (requestApiKey == null || !requestApiKey.equals(apiKey)) {
            System.out.println("Unauthorized access attempt to /weights from " + payload.getNodeId());
            return ResponseEntity.status(401).body(Map.of("status", "error", "message", "Unauthorized"));
        }

        // Verify node is registered
        Optional<RegisteredNodeEntity> nodeOpt = registeredNodeRepository.findByNodeId(payload.getNodeId());
        if (nodeOpt.isEmpty()) {
            return ResponseEntity.status(403).body(Map.of(
                "status", "error",
                "message", "Node not registered. POST to /api/nodes/register first."
            ));
        }

        // Update heartbeat on weight submission
        RegisteredNodeEntity node = nodeOpt.get();
        node.setLastHeartbeat(LocalDateTime.now());
        node.setStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
        registeredNodeRepository.save(node);

        System.out.println("Received weights from " + payload.getNodeId() + " (sending to MinIO and RabbitMQ queue)");

        try {
            byte[] data = this.serializeWeights(payload.getWeights());
            long timestamp = System.currentTimeMillis();
            String path = "client-models/round-" + currentRound + "/" + payload.getNodeId() + "-" + timestamp + ".bin";
            minioService.uploadWeights(path, data);

            ModelSubmissionMessage msg = new ModelSubmissionMessage(
                    payload.getNodeId(), path, payload.getLoss(), payload.getAccuracy(), payload.getDpEnabled());
            
            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY, msg);
            
            return ResponseEntity.ok(Map.of("status", "success", "message", "Weights received for " + payload.getNodeId() + " and queued successfully."));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", "Internal server error queueing weights."));
        }
    }

    public synchronized void processNodeSubmission(String nodeId, List<Double> weights, Double loss, Double accuracy, Boolean dpEnabled) {
        System.out.println("Processing submitted weights from queue for node: " + nodeId);
        nodeWeights.put(nodeId, weights);
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

        // Track first submission time for quorum timeout
        if (firstSubmissionTime == null) {
            firstSubmissionTime = LocalDateTime.now();
        }

        // Check if we've reached the dynamic quorum
        int effectiveQuorum = Math.min(minQuorum,
                (int) registeredNodeRepository.countByStatus(RegisteredNodeEntity.NodeStatus.ACTIVE));
        if (effectiveQuorum < 1) effectiveQuorum = 1;

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

        if (config.containsKey("safetyThreshold")) {
            this.safetyThreshold = ((Number) config.get("safetyThreshold")).doubleValue();
            message.append("safetyThreshold=").append(this.safetyThreshold).append(" ");
            updated = true;
        }

        if (updated) {
            int effectiveQuorum = Math.min(this.minQuorum,
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
        System.out.println("Starting FedAvg for round " + (currentRound + 1) + " with "
                + nodeWeights.size() + " node submissions...");

        List<List<Double>> validWeights = new ArrayList<>();
        int prevRoundParamCount = this.globalWeights != null ? this.globalWeights.size() : 0;

        for (Map.Entry<String, List<Double>> entry : nodeWeights.entrySet()) {
            String nodeId = entry.getKey();
            List<Double> w = entry.getValue();

            if (this.currentRound == 0 || prevRoundParamCount == 0) {
                nodeSecurityStatus.put(nodeId, "Accepted");
                validWeights.add(w);
            } else {
                double distance = calculateDistance(w, this.globalWeights);
                if (distance > this.safetyThreshold) {
                    System.out.println("SUSPICIOUS node detected: " + nodeId + " with distance " + distance);
                    nodeSecurityStatus.put(nodeId, "Rejected");
                    nodeRejectionCount.put(nodeId, nodeRejectionCount.getOrDefault(nodeId, 0) + 1);
                } else {
                    nodeSecurityStatus.put(nodeId, "Accepted");
                    validWeights.add(w);
                }
            }
        }

        if (validWeights.isEmpty()) {
            System.out.println("All nodes rejected in round " + (currentRound + 1) + ". Round skipped.");
            this.nodeWeights.clear();
            this.nodeLosses.clear();
            this.nodeAccuracies.clear();
            this.firstSubmissionTime = null;
            return;
        }

        int numParams = validWeights.get(0).size();
        List<Double> newGlobalWeights = new ArrayList<>(numParams);

        for (int i = 0; i < numParams; i++) {
            double sum = 0.0;
            for (List<Double> nodeWeight : validWeights) {
                sum += nodeWeight.get(i);
            }
            newGlobalWeights.add(sum / validWeights.size());
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

        this.currentRound++;
        this.globalWeights = newGlobalWeights;

        // Persist round to training_rounds table
        RoundEntity entity = new RoundEntity(currentRound, avgLoss, accuracy, LocalDateTime.now());
        roundRepository.save(entity);

        // Persist global model state to database (for replicated aggregator support)
        persistGlobalModelState();

        // Clear in-memory round state
        this.nodeWeights.clear();
        this.nodeLosses.clear();
        this.nodeAccuracies.clear();
        this.firstSubmissionTime = null;

        System.out.println("FedAvg completed successfully! Global model updated to round " + currentRound
                + " (aggregated " + validWeights.size() + " nodes)");
    }

    private void persistGlobalModelState() {
        try {
            byte[] blob = serializeWeights(this.globalWeights);
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
        roundRepository.deleteAll();
        globalModelStateRepository.deleteAll();
        minioService.deleteAllObjects();
        this.currentRound = 0;
        this.globalWeights.clear();
        this.nodeWeights.clear();
        this.nodeLosses.clear();
        this.nodeAccuracies.clear();
        this.nodeSecurityStatus.clear();
        this.nodeRejectionCount.clear();
        this.nodeDpStatus.clear();
        this.firstSubmissionTime = null;
        // Note: registered nodes are NOT cleared — only training state
        System.out.println("Emergency Reset Completed. Database and MinIO cleared. State back to Round 0.");
        broadcastUpdate();
        return Map.of("status", "success", "message", "Training reset to round 0.");
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
            nodeDetails.add(detail);
        }

        long activeRegistered = registeredNodeRepository.countByStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);

        Map<String, Object> result = new HashMap<>();
        result.put("totalNodes", nodeWeights.size());
        result.put("expectedNodes", minQuorum);
        result.put("registeredNodes", activeRegistered);
        result.put("currentRound", currentRound);
        result.put("safetyThreshold", safetyThreshold);
        result.put("nodeDetails", nodeDetails);
        return result;
    }

    @GetMapping("/global-model")
    public ResponseEntity<Map<String, Object>> getGlobalModel(
            @RequestHeader(value = "X-API-Key", required = false) String requestApiKey) {
        if (requestApiKey == null || !requestApiKey.equals(apiKey)) {
            System.out.println("Unauthorized access attempt to /global-model");
            return ResponseEntity.status(401).body(Map.of("status", "error", "message", "Unauthorized"));
        }

        return ResponseEntity.ok(Map.of(
            "currentRound", currentRound,
            "globalWeights", globalWeights
        ));
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
            history.add(Map.of(
                "round", r.getRoundNumber(),
                "loss", r.getAvgLoss(),
                "accuracy", r.getAccuracy()
            ));
        }
        return history;
    }
}

class WeightPayload {
    private String nodeId;
    private List<Double> weights;
    private Double loss;
    private Boolean dpEnabled;
    private Double accuracy;

    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public List<Double> getWeights() { return weights; }
    public void setWeights(List<Double> weights) { this.weights = weights; }
    public Double getLoss() { return loss; }
    public void setLoss(Double loss) { this.loss = loss; }
    public Boolean getDpEnabled() { return dpEnabled; }
    public void setDpEnabled(Boolean dpEnabled) { this.dpEnabled = dpEnabled; }
    public Double getAccuracy() { return accuracy; }
    public void setAccuracy(Double accuracy) { this.accuracy = accuracy; }
}
