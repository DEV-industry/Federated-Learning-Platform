package com.flplatform.aggregator;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class CoordinatorViewService {

    public Map<String, Object> getStatus(
            Map<String, List<Double>> nodeWeights,
            Map<String, String> nodeSecurityStatus,
            Map<String, Integer> nodeRejectionCount,
            Map<String, Boolean> nodeDpStatus,
            RegisteredNodeRepository registeredNodeRepository,
            int minQuorum,
            int currentRound,
            double maliciousFraction,
            boolean currentDpEnabled,
            double currentFedproxMu,
            double currentDpNoiseMultiplier,
            boolean manualHyperparamLock,
            LiveActivityTracker liveActivityTracker
    ) {
        List<Map<String, Object>> nodeDetails = new ArrayList<>();
        java.util.Set<String> allActiveNodes = new java.util.HashSet<>();
        allActiveNodes.addAll(nodeWeights.keySet());
        allActiveNodes.addAll(nodeSecurityStatus.keySet());

        List<RegisteredNodeEntity> registeredNodes = registeredNodeRepository.findAll();
        for (RegisteredNodeEntity regNode : registeredNodes) {
            allActiveNodes.add(regNode.getNodeId());
        }

        for (String nodeId : allActiveNodes) {
            String status = "Pending";
            if (nodeSecurityStatus.containsKey(nodeId)) {
                status = nodeSecurityStatus.get(nodeId);
            } else {
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
            if (liveActivityTracker.hasNodeActivity(nodeId)) {
                detail.put("activity", liveActivityTracker.getNodeActivity(nodeId));
            }

            // Enrich with DB metadata for Security dashboard
            Optional<RegisteredNodeEntity> regNodeOpt = registeredNodeRepository.findByNodeId(nodeId);
            if (regNodeOpt.isPresent()) {
                RegisteredNodeEntity rn = regNodeOpt.get();
                detail.put("hostname", rn.getHostname());
                detail.put("authVersion", rn.getAuthVersion());
                detail.put("clientVersion", rn.getClientVersion());
                detail.put("deviceOs", rn.getDeviceOs());
                detail.put("registeredAt", rn.getRegisteredAt() != null ? rn.getRegisteredAt().toString() : null);
                detail.put("lastHeartbeat", rn.getLastHeartbeat() != null ? rn.getLastHeartbeat().toString() : null);
                detail.put("enrolledAt", rn.getEnrolledAt() != null ? rn.getEnrolledAt().toString() : null);
                detail.put("hasPublicKey", rn.getPublicKey() != null && !rn.getPublicKey().isBlank());
            }
            nodeDetails.add(detail);
        }

        long activeRegistered = registeredNodeRepository.countByStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);

        Map<String, Object> result = new HashMap<>();
        result.put("totalNodes", activeRegistered);
        result.put("submittedThisRound", nodeWeights.size());
        result.put("expectedNodes", minQuorum);
        result.put("registeredNodes", activeRegistered);
        result.put("currentRound", currentRound);
        result.put("maliciousFraction", maliciousFraction);
        result.put("dynamicHyperparameters", Map.of(
                "dpEnabled", currentDpEnabled,
                "fedproxMu", currentFedproxMu,
                "dpNoiseMultiplier", currentDpNoiseMultiplier,
                "manualHyperparamLock", manualHyperparamLock
        ));
        result.put("nodeDetails", nodeDetails);
        result.put("globalStage", liveActivityTracker.getGlobalStage());
        result.put("nodeActivity", liveActivityTracker.snapshotNodeActivity());
        result.put("eventLogs", liveActivityTracker.snapshotEventLogs());
        return result;
    }

    public ResponseEntity<byte[]> downloadModel(List<Double> globalWeights, int currentRound) {
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

    public List<Map<String, Object>> getHistory(RoundRepository roundRepository) {
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

    public byte[] serializeWeights(List<Double> weights) {
        ByteBuffer buffer = ByteBuffer.allocate(weights.size() * 8);
        for (Double w : weights) {
            buffer.putDouble(w != null ? w : 0.0);
        }
        return buffer.array();
    }

    public List<Double> deserializeWeights(byte[] blob) {
        if (blob == null || blob.length == 0) {
            return new ArrayList<>();
        }
        ByteBuffer buffer = ByteBuffer.wrap(blob);
        List<Double> weights = new ArrayList<>(blob.length / 8);
        while (buffer.hasRemaining()) {
            weights.add(buffer.getDouble());
        }
        return weights;
    }
}
