package com.flplatform.aggregator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@SpringBootApplication
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*") // Allow frontend to fetch status
public class AggregatorApplication {

    private final Map<String, List<Double>> nodeWeights = new ConcurrentHashMap<>();

    public static void main(String[] args) {
        SpringApplication.run(AggregatorApplication.class, args);
    }

    @PostMapping("/weights")
    public Map<String, Object> receiveWeights(@RequestBody WeightPayload payload) {
        System.out.println("Received weights from " + payload.getNodeId());
        nodeWeights.put(payload.getNodeId(), payload.getWeights());
        return Map.of("status", "success", "message", "Weights received for " + payload.getNodeId());
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        return Map.of("connectedNodes", nodeWeights.keySet(), "totalNodes", nodeWeights.size());
    }
}

class WeightPayload {
    private String nodeId;
    private List<Double> weights;
    
    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }
    public List<Double> getWeights() { return weights; }
    public void setWeights(List<Double> weights) { this.weights = weights; }
}
