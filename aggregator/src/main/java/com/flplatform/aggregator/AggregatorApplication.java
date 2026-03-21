package com.flplatform.aggregator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@SpringBootApplication
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Allow frontend to fetch status
public class AggregatorApplication {

    private final Map<String, List<Double>> nodeWeights = new ConcurrentHashMap<>();
    private final Map<String, Double> nodeLosses = new ConcurrentHashMap<>();
    private final List<Map<String, Object>> lossHistory = new ArrayList<>();
    private List<Double> globalWeights = new ArrayList<>();
    private int currentRound = 0;
    private final int EXPECTED_NODES = 2;

    public static void main(String[] args) {
        SpringApplication.run(AggregatorApplication.class, args);
    }

    @PostMapping("/weights")
    public synchronized Map<String, Object> receiveWeights(@RequestBody WeightPayload payload) {
        System.out.println("Received weights from " + payload.getNodeId());
        nodeWeights.put(payload.getNodeId(), payload.getWeights());
        if (payload.getLoss() != null) {
            nodeLosses.put(payload.getNodeId(), payload.getLoss());
        }
        
        // Check if all expected nodes have submitted their weights
        if (nodeWeights.size() >= EXPECTED_NODES) {
            aggregateWeights();
        }
        
        return Map.of("status", "success", "message", "Weights received for " + payload.getNodeId());
    }

    private void aggregateWeights() {
        System.out.println("Starting FedAvg for round " + (currentRound + 1) + "...");
        
        List<List<Double>> allWeights = new ArrayList<>(nodeWeights.values());
        if (allWeights.isEmpty() || allWeights.get(0) == null) return;
        
        int numParams = allWeights.get(0).size();
        List<Double> newGlobalWeights = new ArrayList<>(numParams);
        
        // Calculate the mathematical average for each weight parameter
        for (int i = 0; i < numParams; i++) {
            double sum = 0.0;
            for (List<Double> nodeWeight : allWeights) {
                sum += nodeWeight.get(i);
            }
            newGlobalWeights.add(sum / allWeights.size());
        }
        
        // Calculate average loss over expected nodes
        double avgLoss = 0.0;
        if (!nodeLosses.isEmpty()) {
            for (Double loss : nodeLosses.values()) {
                avgLoss += loss;
            }
            avgLoss /= nodeLosses.size();
            Map<String, Object> roundData = new ConcurrentHashMap<>();
            roundData.put("round", currentRound + 1);
            roundData.put("loss", avgLoss);
            lossHistory.add(roundData);
        }

        // Update global state
        this.globalWeights = newGlobalWeights;
        this.currentRound++;
        
        // Clear nodes' submissions for the next round
        this.nodeWeights.clear();
        this.nodeLosses.clear();
        
        System.out.println("FedAvg completed successfully! Global model updated to round " + currentRound);
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        return Map.of(
            "connectedNodes", nodeWeights.keySet(),
            "totalNodes", nodeWeights.size(),
            "currentRound", currentRound
        );
    }

    @GetMapping("/global-model")
    public Map<String, Object> getGlobalModel() {
        return Map.of(
            "currentRound", currentRound,
            "globalWeights", globalWeights
        );
    }

    @GetMapping("/history")
    public List<Map<String, Object>> getHistory() {
        return lossHistory;
    }
}

class WeightPayload {
    private String nodeId;
    private List<Double> weights;
    private Double loss;
    
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public List<Double> getWeights() { return weights; }
    public void setWeights(List<Double> weights) { this.weights = weights; }
    public Double getLoss() { return loss; }
    public void setLoss(Double loss) { this.loss = loss; }
}
