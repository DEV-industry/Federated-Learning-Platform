package com.flplatform.aggregator;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class CoordinatorNodeService {

    private static final Logger log = LoggerFactory.getLogger(CoordinatorNodeService.class);

    public synchronized ResponseEntity<Map<String, Object>> registerNode(
            Map<String, String> payload,
            RegisteredNodeRepository registeredNodeRepository,
            int currentRound,
            int minQuorum,
            Runnable broadcastUpdate
    ) {
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
        broadcastUpdate.run();

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Node registered successfully",
                "nodeId", nodeId,
                "currentRound", currentRound,
                "activeNodes", activeCount,
                "minQuorum", minQuorum
        ));
    }

    public ResponseEntity<Map<String, Object>> heartbeat(
            Map<String, String> payload,
            RegisteredNodeRepository registeredNodeRepository,
            int currentRound
    ) {
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

    public synchronized ResponseEntity<Map<String, Object>> unregisterNode(
            Map<String, String> payload,
            RegisteredNodeRepository registeredNodeRepository,
            Map<String, List<Double>> nodeWeights,
            Map<String, Double> nodeLosses,
            Map<String, Double> nodeAccuracies,
            Runnable broadcastUpdate
    ) {
        String nodeId = payload.get("nodeId");
        if (nodeId == null) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "nodeId required"));
        }

        Optional<RegisteredNodeEntity> nodeOpt = registeredNodeRepository.findByNodeId(nodeId);
        if (nodeOpt.isPresent()) {
            RegisteredNodeEntity node = nodeOpt.get();
            node.setStatus(RegisteredNodeEntity.NodeStatus.DISCONNECTED);
            registeredNodeRepository.save(node);
            nodeWeights.remove(nodeId);
            nodeLosses.remove(nodeId);
            nodeAccuracies.remove(nodeId);
            System.out.println("Node unregistered: " + nodeId);
            broadcastUpdate.run();
        }

        return ResponseEntity.ok(Map.of("status", "success", "message", "Node unregistered: " + nodeId));
    }

    public ResponseEntity<Map<String, Object>> listNodes(RegisteredNodeRepository registeredNodeRepository, int minQuorum) {
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

    public void checkStaleNodes(RegisteredNodeRepository registeredNodeRepository, int heartbeatStaleThresholdSeconds) {
        LocalDateTime threshold = LocalDateTime.now().minusSeconds(heartbeatStaleThresholdSeconds);
        List<RegisteredNodeEntity> staleNodes = registeredNodeRepository.findByLastHeartbeatBefore(threshold);

        for (RegisteredNodeEntity node : staleNodes) {
            if (node.getStatus() == RegisteredNodeEntity.NodeStatus.ACTIVE) {
                node.setStatus(RegisteredNodeEntity.NodeStatus.STALE);
                registeredNodeRepository.save(node);
                log.warn("Node marked STALE (no heartbeat): {}", node.getNodeId());
            }
        }
    }

    public ResponseEntity<Map<String, String>> reportActivity(
            Map<String, String> payload,
            LiveActivityTracker liveActivityTracker,
            Runnable broadcastUpdate
    ) {
        String nodeId = payload.get("nodeId");
        String status = payload.get("status");
        String detail = payload.getOrDefault("detail", "");

        if (nodeId == null || status == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "nodeId and status required"));
        }

        liveActivityTracker.recordActivity(nodeId, status, detail);
        broadcastUpdate.run();

        return ResponseEntity.ok(Map.of("status", "ok"));
    }
}
