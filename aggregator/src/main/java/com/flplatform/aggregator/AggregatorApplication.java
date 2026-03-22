package com.flplatform.aggregator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.time.LocalDateTime;

@SpringBootApplication
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Allow frontend to fetch status
public class AggregatorApplication {

    @Autowired
    private RoundRepository roundRepository;

    private final Map<String, List<Double>> nodeWeights = new ConcurrentHashMap<>();
    private final Map<String, Double> nodeLosses = new ConcurrentHashMap<>();
    
    private List<Double> globalWeights = new ArrayList<>();
    private int currentRound = 0;
    private final int EXPECTED_NODES = 2;

    @jakarta.annotation.PostConstruct
    public void init() {
        // Resume round counting if the database has historical persistence data
        long count = roundRepository.count();
        if (count > 0) {
            this.currentRound = (int) count;
            System.out.println("Resumed FedAvg from Database at Round " + this.currentRound);
        }
    }

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
        }

        // --- Mocked Accuracy Evaluation ---
        // Basic heuristic: As loss drops, accuracy grows starting from random chance (10%).
        double accuracy = Math.max(0.1, 1.0 - (avgLoss * 0.4));
        if (accuracy > 0.99) accuracy = 0.99; // Cap the logic mock

        this.currentRound++;
        
        // --- Postgres Persistence ---
        RoundEntity entity = new RoundEntity(currentRound, avgLoss, accuracy, LocalDateTime.now());
        roundRepository.save(entity);

        // Update global state
        this.globalWeights = newGlobalWeights;
        
        // Clear nodes' submissions for the next round
        this.nodeWeights.clear();
        this.nodeLosses.clear();
        
        System.out.println("FedAvg completed successfully! Global model updated to round " + currentRound);
    }

    @DeleteMapping("/training/reset")
    public synchronized Map<String, Object> resetTraining() {
        roundRepository.deleteAll(); // Wipe postgres database
        this.currentRound = 0;
        this.globalWeights.clear();
        this.nodeWeights.clear();
        this.nodeLosses.clear();
        System.out.println("Emergency Reset Completed. Database cleared. State back to Round 0.");
        return Map.of("status", "success", "message", "Database and server state cleared. Training reset to round 0.");
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
    
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public List<Double> getWeights() { return weights; }
    public void setWeights(List<Double> weights) { this.weights = weights; }
    public Double getLoss() { return loss; }
    public void setLoss(Double loss) { this.loss = loss; }
}
