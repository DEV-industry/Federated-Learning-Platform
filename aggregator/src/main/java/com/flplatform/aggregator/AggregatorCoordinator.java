package com.flplatform.aggregator;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.concurrent.ConcurrentHashMap;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Base64;
import java.util.Arrays;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import com.flplatform.aggregator.security.NodeCredentialService;
import org.springframework.stereotype.Service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Service
public class AggregatorCoordinator {

    private static final Logger log = LoggerFactory.getLogger(AggregatorCoordinator.class);

    @Autowired
    private MeterRegistry meterRegistry;

    // Osobna pula workerów do zapisu (izolacja MinIO/RabbitMQ z timeoutami)
    private final ExecutorService submitExecutor = Executors.newFixedThreadPool(10);

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
    private HeAggregationClient heAggregationClient;

    @Autowired
    private NodeCredentialService nodeCredentialService;

    @Autowired
    private CoordinatorNodeService coordinatorNodeService;

    @Autowired
    private CoordinatorViewService coordinatorViewService;

    @Autowired
    private CoordinatorResetService coordinatorResetService;

    @Autowired
    private RoundAggregationService roundAggregationService;

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
    private volatile boolean manualHyperparamLock = false;

    // === LIVE ACTIVITY TRACKING ===
    private final LiveActivityTracker liveActivityTracker = new LiveActivityTracker();

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

    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    // =========================================================================
    // NODE REGISTRATION ENDPOINTS
    // =========================================================================

    @Transactional
    public synchronized ResponseEntity<Map<String, Object>> registerNode(Map<String, String> payload) {
        return coordinatorNodeService.registerNode(
                payload,
                registeredNodeRepository,
                currentRound,
                minQuorum,
                this::broadcastUpdate
        );
    }

    @Transactional
    public ResponseEntity<Map<String, Object>> heartbeat(Map<String, String> payload) {
        return coordinatorNodeService.heartbeat(payload, registeredNodeRepository, currentRound);
    }

    @Transactional
    public synchronized ResponseEntity<Map<String, Object>> unregisterNode(Map<String, String> payload) {
        return coordinatorNodeService.unregisterNode(
                payload,
                registeredNodeRepository,
                nodeWeights,
                nodeLosses,
                nodeAccuracies,
                this::broadcastUpdate
        );
    }

    public ResponseEntity<Map<String, Object>> listNodes() {
        return coordinatorNodeService.listNodes(registeredNodeRepository, minQuorum);
    }

    // =========================================================================
    // HEARTBEAT MONITOR — Marks stale nodes every 15 seconds
    // =========================================================================

    @Scheduled(fixedDelayString = "${fl.heartbeat.check-interval-ms:15000}")
    @Transactional
    public void checkStaleNodes() {
        coordinatorNodeService.checkStaleNodes(registeredNodeRepository, heartbeatStaleThresholdSeconds);
        // Zaktualizuj metryki liczników węzłów
        meterRegistry.gauge("fl_nodes_total", List.of(io.micrometer.core.instrument.Tag.of("status", "ACTIVE")), 
            registeredNodeRepository, repo -> (double) repo.countByStatus(RegisteredNodeEntity.NodeStatus.ACTIVE));
        meterRegistry.gauge("fl_nodes_total", List.of(io.micrometer.core.instrument.Tag.of("status", "STALE")), 
            registeredNodeRepository, repo -> (double) repo.countByStatus(RegisteredNodeEntity.NodeStatus.STALE));
        meterRegistry.gauge("fl_nodes_total", List.of(io.micrometer.core.instrument.Tag.of("status", "BANNED")), 
            registeredNodeRepository, repo -> (double) repo.countByStatus(RegisteredNodeEntity.NodeStatus.BANNED));
        meterRegistry.gauge("fl_nodes_total", List.of(io.micrometer.core.instrument.Tag.of("status", "LOCKED")), 
            registeredNodeRepository, repo -> (double) repo.countByStatus(RegisteredNodeEntity.NodeStatus.LOCKED));
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

    public ResponseEntity<Map<String, String>> reportActivity(Map<String, String> payload) {
        return coordinatorNodeService.reportActivity(payload, liveActivityTracker, this::broadcastUpdate);
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
                update.put("nodeActivity", liveActivityTracker.snapshotNodeActivity());
                update.put("eventLogs", liveActivityTracker.snapshotEventLogs());
                update.put("globalStage", liveActivityTracker.getGlobalStage());
                messagingTemplate.convertAndSend("/topic/updates", update);
            } catch (Exception e) {
                System.err.println("Failed to broadcast update: " + e.getMessage());
            }
        }
    }

    public synchronized boolean validateAndQueueWeights(String nodeId, List<Double> weights, Double loss, Double accuracy, Boolean dpEnabled, Integer roundNumber, Boolean heEnabled, byte[] encryptedWeights, byte[] heContextPublic) {
        
        MDC.put("nodeId", nodeId);
        MDC.put("roundId", String.valueOf(roundNumber));

        // Validate round
        if (roundNumber == null || roundNumber != currentRound) {
            log.warn("Discarded weights from {}: invalid or outdated round (got {}, expected {})", nodeId, roundNumber, currentRound);
            meterRegistry.counter("submit_reject_total", "reason", "invalid_round").increment();
            MDC.clear();
            return false;
        }

        // Verify node is registered and active
        Optional<RegisteredNodeEntity> nodeOpt = registeredNodeRepository.findByNodeId(nodeId);
        if (nodeOpt.isEmpty()) {
            meterRegistry.counter("submit_reject_total", "reason", "unregistered_node").increment();
            MDC.clear();
            return false;
        }
        
        RegisteredNodeEntity node = nodeOpt.get();
        if (node.getStatus() == RegisteredNodeEntity.NodeStatus.LOCKED || node.getStatus() == RegisteredNodeEntity.NodeStatus.BANNED) {
            log.warn("Discarded weights from {}: node is {}", nodeId, node.getStatus());
            meterRegistry.counter("submit_reject_total", "reason", "node_locked_banned").increment();
            MDC.clear();
            return false;
        }
        
        // Freshness check: if stale by more than double the threshold, block
        if (node.getLastHeartbeat().plusMinutes(5).isBefore(LocalDateTime.now())) {
            log.warn("Discarded weights from {}: heartbeat is too stale.", nodeId);
            meterRegistry.counter("submit_reject_total", "reason", "stale_heartbeat").increment();
            MDC.clear();
            return false;
        }
        
        // Sanity checks on metrics and weights
        if (loss != null && (loss.isNaN() || loss.isInfinite() || loss < 0)) {
            log.warn("Discarded weights from {}: invalid loss value.", nodeId);
            meterRegistry.counter("submit_reject_total", "reason", "invalid_loss").increment();
            node.setStatus(RegisteredNodeEntity.NodeStatus.LOCKED);
            registeredNodeRepository.save(node);
            MDC.clear();
            return false;
        }
        if (accuracy != null && (accuracy.isNaN() || accuracy.isInfinite() || accuracy < 0 || accuracy > 1.0)) {
            log.warn("Discarded weights from {}: invalid accuracy value.", nodeId);
            meterRegistry.counter("submit_reject_total", "reason", "invalid_accuracy").increment();
            node.setStatus(RegisteredNodeEntity.NodeStatus.LOCKED);
            registeredNodeRepository.save(node);
            MDC.clear();
            return false;
        }
        if ((heEnabled == null || !heEnabled) && weights != null) {
            for (Double w : weights) {
                if (w == null || w.isNaN() || w.isInfinite()) {
                    log.warn("Discarded weights from {}: invalid weight payload (NaN/Inf).", nodeId);
                    meterRegistry.counter("submit_reject_total", "reason", "invalid_weights").increment();
                    node.setStatus(RegisteredNodeEntity.NodeStatus.LOCKED);
                    registeredNodeRepository.save(node);
                    MDC.clear();
                    return false;
                }
            }
        }

        // Update heartbeat on weight submission
        node.setLastHeartbeat(LocalDateTime.now());
        node.setStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
        registeredNodeRepository.save(node);

        log.info("Received weights from {}", nodeId);

        try {
            byte[] data;

            if (this.heEnabledConfig && (heEnabled == null || !heEnabled)) {
                log.warn("Rejected submission from {}: HE is required but submission is plaintext.", nodeId);
                meterRegistry.counter("submit_reject_total", "reason", "he_required").increment();
                MDC.clear();
                return false;
            }

            if (!this.heEnabledConfig && heEnabled != null && heEnabled) {
                log.warn("Rejected submission from {}: HE payload provided while HE mode is disabled.", nodeId);
                meterRegistry.counter("submit_reject_total", "reason", "he_disabled").increment();
                MDC.clear();
                return false;
            }

            if (heEnabled != null && heEnabled) {
                if (encryptedWeights == null || heContextPublic == null) {
                    log.warn("Rejected HE submission from {}: missing encrypted payload or HE context.", nodeId);
                    meterRegistry.counter("submit_reject_total", "reason", "missing_he_payload").increment();
                    MDC.clear();
                    return false;
                }

                if (this.heContextPublic == null) {
                    this.heContextPublic = Arrays.copyOf(heContextPublic, heContextPublic.length);
                    log.info("HE public context established from node {} (fingerprint={})", nodeId, heContextFingerprint(this.heContextPublic));
                } else if (!Arrays.equals(this.heContextPublic, heContextPublic)) {
                    log.warn("Rejected HE submission from {}: public context mismatch (expected={}, got={})", 
                              nodeId, heContextFingerprint(this.heContextPublic), heContextFingerprint(heContextPublic));
                    meterRegistry.counter("submit_reject_total", "reason", "he_context_mismatch").increment();
                    MDC.clear();
                    return false;
                }

                data = encryptedWeights;
            } else {
                data = this.serializeWeights(weights);
            }

            long timestamp = System.currentTimeMillis();
            String path = "client-models/round-" + currentRound + "/" + nodeId + "-" + timestamp + ".bin";
            
            final byte[] finalData = data;
            final byte[] finalHeContext = this.heContextPublic != null ? Arrays.copyOf(this.heContextPublic, this.heContextPublic.length) : null;
            final String mdcNodeId = MDC.get("nodeId");
            final String mdcRoundId = MDC.get("roundId");

            CompletableFuture.runAsync(() -> {
                if (mdcNodeId != null) MDC.put("nodeId", mdcNodeId);
                if (mdcRoundId != null) MDC.put("roundId", mdcRoundId);
                
                try {
                    Timer.Sample timer = Timer.start(meterRegistry);
                    
                    minioService.uploadWeights(path, finalData);

                    String heContextPath = null;
                    if (heEnabled != null && heEnabled) {
                        heContextPath = "context/round-" + currentRound + "/public.ctx";
                        minioService.uploadWeights(heContextPath, finalHeContext);
                    }

                    ModelSubmissionMessage msg = new ModelSubmissionMessage(
                            nodeId, path, loss, accuracy, dpEnabled, roundNumber, heEnabled, heContextPath);

                    rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY, msg);
                    log.info("Queued submission for {} successfully.", nodeId);
                    
                    timer.stop(meterRegistry.timer("he_aggregation_io_latency"));
                } catch (Exception e) {
                    log.error("Circuit breaker / Upload failed for node {}: {}", nodeId, e.getMessage());
                } finally {
                    MDC.clear();
                }
            }, submitExecutor).orTimeout(15, TimeUnit.SECONDS).exceptionally(ex -> {
                log.error("Timeout uploading weights for {}", nodeId);
                return null;
            });

            MDC.clear();
            return true;
        } catch (Exception e) {
            log.error("Failed to process weights for {}", nodeId, e);
            MDC.clear();
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
        
        MDC.put("nodeId", nodeId);
        MDC.put("roundId", String.valueOf(roundNumber));
        
        if (roundNumber == null || roundNumber != currentRound) {
            log.warn("Processing skipped for nodeId {}: outdated round (got {}, expected {})", nodeId, roundNumber, currentRound);
            MDC.clear();
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

        log.info("Node {} added weights to pool. Current: {} / Effective Quorum: {}", nodeId, nodeWeights.size(), effectiveQuorum);
        
        if (nodeWeights.size() >= effectiveQuorum) {
            aggregateWeights();
        }

        broadcastUpdate();
        MDC.clear();
    }

    public synchronized Map<String, Object> updateConfig(Map<String, Object> config) {
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

        if (config.containsKey("manualHyperparamLock")) {
            this.manualHyperparamLock = (Boolean) config.get("manualHyperparamLock");
            message.append("manualHyperparamLock=").append(this.manualHyperparamLock).append(" ");
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

    private void aggregateWeights() {
        if (roundStartTime != null) {
            long duration = java.time.Duration.between(roundStartTime, LocalDateTime.now()).getSeconds();
            meterRegistry.timer("round_duration_seconds").record(duration, TimeUnit.SECONDS);
            log.info("Aggregating Round {}. Duration: {} seconds", currentRound, duration);
        }

        RoundAggregationService.AggregationOutcome outcome = roundAggregationService.aggregateRound(
                currentRound,
                globalWeights,
                heGlobalWeights,
                nodeWeights,
                nodeEncryptedWeights,
                nodeLosses,
                nodeAccuracies,
                nodeSecurityStatus,
                nodeRejectionCount,
                aggregationStrategy,
                maliciousFraction,
                heEnabledConfig,
                heSidecarUrl,
                heContextPublic,
                bulyanAggregator,
                heAggregationClient,
                liveActivityTracker,
                dynamicHyperparameterController,
                currentDpEnabled,
                currentFedproxMu,
                currentDpNoiseMultiplier,
                manualHyperparamLock,
                previousRoundLoss,
                previousRoundAccuracy,
                fedproxMuMin,
                fedproxMuMax,
                fedproxMuStep,
                dpNoiseMin,
                dpNoiseMax,
                dpNoiseStep,
                roundRepository,
                globalModelStateRepository,
                minioService
        );

        this.currentRound = outcome.currentRound();
        this.globalWeights = outcome.globalWeights();
        this.heGlobalWeights = outcome.heGlobalWeights();
        this.currentFedproxMu = outcome.currentFedproxMu();
        this.currentDpNoiseMultiplier = outcome.currentDpNoiseMultiplier();
        this.previousRoundLoss = outcome.previousRoundLoss();
        this.previousRoundAccuracy = outcome.previousRoundAccuracy();
        this.roundStartTime = outcome.roundStartTime();

        if (outcome.shouldBroadcast()) {
            broadcastUpdate();
        }
    }

    public byte[] serializeWeights(List<Double> weights) {
        return coordinatorViewService.serializeWeights(weights);
    }

    public List<Double> deserializeWeights(byte[] blob) {
        return coordinatorViewService.deserializeWeights(blob);
    }

    // =========================================================================
    // TRAINING RESET
    // =========================================================================

    @Transactional
    public synchronized Map<String, Object> resetTraining() {
        CoordinatorResetService.ResetResult resetResult = coordinatorResetService.resetTraining(
                nodeCredentialService,
                roundRepository,
                globalModelStateRepository,
                minioService,
                globalWeights,
                nodeWeights,
                nodeEncryptedWeights,
                nodeLosses,
                nodeAccuracies,
                nodeSecurityStatus,
                nodeRejectionCount,
                nodeDpStatus,
                liveActivityTracker,
                dpEnabledInitial,
                fedproxMuInitial,
                dpNoiseInitial
        );

        this.currentRound = resetResult.currentRound();
        this.heGlobalWeights = resetResult.heGlobalWeights();
        this.heContextPublic = resetResult.heContextPublic();
        this.currentDpEnabled = resetResult.currentDpEnabled();
        this.currentFedproxMu = resetResult.currentFedproxMu();
        this.currentDpNoiseMultiplier = resetResult.currentDpNoiseMultiplier();
        this.previousRoundLoss = resetResult.previousRoundLoss();
        this.previousRoundAccuracy = resetResult.previousRoundAccuracy();
        this.roundStartTime = resetResult.roundStartTime();

        System.out.println("Emergency Reset Completed. Database and MinIO cleared. State back to Round 0.");
        broadcastUpdate();
        return resetResult.response();
    }

    // =========================================================================
    // STATUS & HISTORY ENDPOINTS
    // =========================================================================

    public Map<String, Object> getStatus() {
        return coordinatorViewService.getStatus(
                nodeWeights,
                nodeSecurityStatus,
                nodeRejectionCount,
                nodeDpStatus,
                registeredNodeRepository,
                minQuorum,
                currentRound,
                maliciousFraction,
                currentDpEnabled,
                currentFedproxMu,
                currentDpNoiseMultiplier,
                manualHyperparamLock,
                liveActivityTracker
        );
    }



    public ResponseEntity<byte[]> downloadModel() {
        return coordinatorViewService.downloadModel(
                globalWeights, currentRound,
                globalModelStateRepository, minioService,
                heEnabledConfig, heGlobalWeights
        );
    }

    public List<Map<String, Object>> getHistory() {
        return coordinatorViewService.getHistory(roundRepository);
    }
}


