package com.flplatform.aggregator;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AggregatorApiController {

    private final AggregatorCoordinator aggregatorCoordinator;

    public AggregatorApiController(AggregatorCoordinator aggregatorCoordinator) {
        this.aggregatorCoordinator = aggregatorCoordinator;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return aggregatorCoordinator.healthCheck();
    }

    @PostMapping("/nodes/register")
    public ResponseEntity<Map<String, Object>> registerNode(@RequestBody Map<String, String> payload) {
        return aggregatorCoordinator.registerNode(payload);
    }

    @PostMapping("/nodes/heartbeat")
    public ResponseEntity<Map<String, Object>> heartbeat(@RequestBody Map<String, String> payload) {
        return aggregatorCoordinator.heartbeat(payload);
    }

    @PostMapping("/nodes/unregister")
    public ResponseEntity<Map<String, Object>> unregisterNode(@RequestBody Map<String, String> payload) {
        return aggregatorCoordinator.unregisterNode(payload);
    }

    @GetMapping("/nodes")
    public ResponseEntity<Map<String, Object>> listNodes() {
        return aggregatorCoordinator.listNodes();
    }

    @PostMapping("/nodes/activity")
    public ResponseEntity<Map<String, String>> reportActivity(@RequestBody Map<String, String> payload) {
        return aggregatorCoordinator.reportActivity(payload);
    }

    @PostMapping("/config")
    public Map<String, Object> updateConfig(@RequestBody Map<String, Object> config) {
        return aggregatorCoordinator.updateConfig(config);
    }

    @DeleteMapping("/training/reset")
    public Map<String, Object> resetTraining() {
        return aggregatorCoordinator.resetTraining();
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        return aggregatorCoordinator.getStatus();
    }

    @GetMapping("/model/download")
    public ResponseEntity<byte[]> downloadModel() {
        return aggregatorCoordinator.downloadModel();
    }

    @GetMapping("/history")
    public List<Map<String, Object>> getHistory() {
        return aggregatorCoordinator.getHistory();
    }
}
