package com.flplatform.aggregator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.time.LocalDateTime;

@SpringBootApplication
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") 
public class AggregatorApplication {

    @Autowired
    private RoundRepository roundRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Value("${fl.security.threshold:5.0}")
    private double safetyThreshold;

    @Value("${API_KEY}")
    private String apiKey;

    private final Map<String, List<Double>> nodeWeights = new ConcurrentHashMap<>();
    private final Map<String, Double> nodeLosses = new ConcurrentHashMap<>();
    private final Map<String, String> nodeSecurityStatus = new ConcurrentHashMap<>();
    private final Map<String, Integer> nodeRejectionCount = new ConcurrentHashMap<>();
    private final Map<String, Boolean> nodeDpStatus = new ConcurrentHashMap<>();
    
    private List<Double> globalWeights = new ArrayList<>();
    private int currentRound = 0;
    private int expectedNodes = 2;

    @jakarta.annotation.PostConstruct
    public void init() {
        long count = roundRepository.count();
        if (count > 0) {
            this.currentRound = (int) count;
            System.out.println("Resumed FedAvg from Database at Round " + this.currentRound);
        }
    }

    public static void main(String[] args) {
        SpringApplication.run(AggregatorApplication.class, args);
    }

    private void broadcastUpdate() {
        if (messagingTemplate != null) {
            try {
                messagingTemplate.convertAndSend("/topic/updates", Map.of(
                    "status", getStatus(),
                    "history", getHistory()
                ));
            } catch (Exception e) {
                System.err.println("Failed to broadcast update: " + e.getMessage());
            }
        }
    }

    @PostMapping("/weights")
    public synchronized ResponseEntity<Map<String, Object>> receiveWeights(@RequestHeader(value = "X-API-Key", required = false) String requestApiKey, @RequestBody WeightPayload payload) {
        if (requestApiKey == null || !requestApiKey.equals(apiKey)) {
            System.out.println("Unauthorized access attempt to /weights from " + payload.getNodeId());
            return ResponseEntity.status(401).body(Map.of("status", "error", "message", "Unauthorized"));
        }
        
        System.out.println("Received weights from " + payload.getNodeId());
        nodeWeights.put(payload.getNodeId(), payload.getWeights());
        if (payload.getLoss() != null) {
            nodeLosses.put(payload.getNodeId(), payload.getLoss());
        }
        if (payload.getDpEnabled() != null) {
            nodeDpStatus.put(payload.getNodeId(), payload.getDpEnabled());
        } else {
            nodeDpStatus.put(payload.getNodeId(), false);
        }
        
        if (nodeWeights.size() >= expectedNodes) {
            aggregateWeights();
        }
        
        broadcastUpdate();
        return ResponseEntity.ok(Map.of("status", "success", "message", "Weights received for " + payload.getNodeId()));
    }

    @PostMapping("/config")
    public synchronized Map<String, Object> updateConfig(@RequestBody Map<String, Object> config) {
        boolean updated = false;
        StringBuilder message = new StringBuilder("Config updated: ");
        
        if (config.containsKey("expectedNodes")) {
            this.expectedNodes = ((Number) config.get("expectedNodes")).intValue();
            message.append("expectedNodes=").append(this.expectedNodes).append(" ");
            updated = true;
        }
        
        if (config.containsKey("safetyThreshold")) {
            this.safetyThreshold = ((Number) config.get("safetyThreshold")).doubleValue();
            message.append("safetyThreshold=").append(this.safetyThreshold).append(" ");
            updated = true;
        }

        if (updated) {
            if (this.nodeWeights.size() >= this.expectedNodes) {
                aggregateWeights();
            }
            broadcastUpdate();
            return Map.of("status", "success", "message", message.toString().trim());
        }
        
        return Map.of("status", "error", "message", "Invalid config payload");
    }

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
        System.out.println("Starting FedAvg for round " + (currentRound + 1) + "...");
        
        List<List<Double>> validWeights = new ArrayList<>();
        int prevRoundParamCount = this.globalWeights != null ? this.globalWeights.size() : 0;

        for (Map.Entry<String, List<Double>> entry : nodeWeights.entrySet()) {
            String nodeId = entry.getKey();
            List<Double> w = entry.getValue();

            if (this.currentRound == 0 || prevRoundParamCount == 0) {
                // First round: trust everyone
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

        double accuracy = Math.max(0.1, 1.0 - (avgLoss * 0.4));
        if (accuracy > 0.99) accuracy = 0.99; 

        this.currentRound++;
        
        RoundEntity entity = new RoundEntity(currentRound, avgLoss, accuracy, LocalDateTime.now());
        roundRepository.save(entity);

        this.globalWeights = newGlobalWeights;
        
        this.nodeWeights.clear();
        this.nodeLosses.clear();
        
        System.out.println("FedAvg completed successfully! Global model updated to round " + currentRound);
    }

    @DeleteMapping("/training/reset")
    public synchronized Map<String, Object> resetTraining() {
        roundRepository.deleteAll(); 
        this.currentRound = 0;
        this.globalWeights.clear();
        this.nodeWeights.clear();
        this.nodeLosses.clear();
        this.nodeSecurityStatus.clear();
        this.nodeRejectionCount.clear();
        this.nodeDpStatus.clear();
        System.out.println("Emergency Reset Completed. Database cleared. State back to Round 0.");
        broadcastUpdate();
        return Map.of("status", "success", "message", "Training reset to round 0.");
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        List<Map<String, Object>> nodeDetails = new ArrayList<>();
        // Display details for nodes that have either connected currently or have been tracked in history.
        // We will combine the list of keys from nodeWeights and nodeRejectionCount/nodeSecurityStatus.
        java.util.Set<String> allActiveNodes = new java.util.HashSet<>();
        allActiveNodes.addAll(nodeWeights.keySet());
        allActiveNodes.addAll(nodeSecurityStatus.keySet());

        for (String nodeId : allActiveNodes) {
            String status = "Pending";
            if (nodeSecurityStatus.containsKey(nodeId)) {
                status = nodeSecurityStatus.get(nodeId);
            }
            int rejections = nodeRejectionCount.getOrDefault(nodeId, 0);
            boolean dpEnabled = nodeDpStatus.getOrDefault(nodeId, false);
            
            nodeDetails.add(Map.of(
                "nodeId", nodeId,
                "status", status,
                "rejectedRounds", rejections,
                "dpEnabled", dpEnabled
            ));
        }

        return Map.of(
            "totalNodes", nodeWeights.size(),
            "expectedNodes", expectedNodes,
            "currentRound", currentRound,
            "safetyThreshold", safetyThreshold,
            "nodeDetails", nodeDetails
        );
    }

    @GetMapping("/global-model")
    public ResponseEntity<Map<String, Object>> getGlobalModel(@RequestHeader(value = "X-API-Key", required = false) String requestApiKey) {
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
        
        ByteBuffer buffer = ByteBuffer.allocate(globalWeights.size() * 8);
        for (Double w : globalWeights) {
            buffer.putDouble(w != null ? w : 0.0);
        }
        byte[] modelBytes = buffer.array();
        
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
    
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public List<Double> getWeights() { return weights; }
    public void setWeights(List<Double> weights) { this.weights = weights; }
    public Double getLoss() { return loss; }
    public void setLoss(Double loss) { this.loss = loss; }
    public Boolean getDpEnabled() { return dpEnabled; }
    public void setDpEnabled(Boolean dpEnabled) { this.dpEnabled = dpEnabled; }
}
