package com.flplatform.aggregator;

import org.springframework.stereotype.Service;

import java.nio.ByteBuffer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class RoundAggregationService {

    public AggregationOutcome aggregateRound(
            int currentRound,
            List<Double> globalWeights,
            byte[] heGlobalWeights,
            Map<String, List<Double>> nodeWeights,
            Map<String, byte[]> nodeEncryptedWeights,
            Map<String, Double> nodeLosses,
            Map<String, Double> nodeAccuracies,
            Map<String, String> nodeSecurityStatus,
            Map<String, Integer> nodeRejectionCount,
            String aggregationStrategy,
            double maliciousFraction,
            boolean heEnabledConfig,
            String heSidecarUrl,
            byte[] heContextPublic,
            BulyanAggregator bulyanAggregator,
            HeAggregationClient heAggregationClient,
            LiveActivityTracker liveActivityTracker,
            DynamicHyperparameterController dynamicHyperparameterController,
            boolean currentDpEnabled,
            double currentFedproxMu,
            double currentDpNoiseMultiplier,
            boolean manualHyperparamLock,
            Double previousRoundLoss,
            Double previousRoundAccuracy,
            double fedproxMuMin,
            double fedproxMuMax,
            double fedproxMuStep,
            double dpNoiseMin,
            double dpNoiseMax,
            double dpNoiseStep,
            RoundRepository roundRepository,
            GlobalModelStateRepository globalModelStateRepository,
            MinioService minioService
    ) {
        liveActivityTracker.setGlobalStage("AGGREGATING");
        liveActivityTracker.addEventLog("\uD83E\uDDE0 Starting FedAvg aggregation for round " + (currentRound + 1) + " with " + nodeWeights.size() + " nodes");
        System.out.println("Starting FedAvg (Multi-Krum) for round " + (currentRound + 1) + " with "
                + nodeWeights.size() + " node submissions...");

        List<List<Double>> validWeights = new ArrayList<>();
        int prevRoundParamCount = globalWeights != null ? globalWeights.size() : 0;
        int n = nodeWeights.size();
        List<Double> updatedGlobalWeights = globalWeights;
        byte[] updatedHeGlobalWeights = heGlobalWeights;

        if (currentRound == 0 || prevRoundParamCount == 0 && !heEnabledConfig) {
            for (Map.Entry<String, List<Double>> entry : nodeWeights.entrySet()) {
                nodeSecurityStatus.put(entry.getKey(), "Accepted");
                validWeights.add(entry.getValue());
            }
        } else if (heEnabledConfig) {
            for (Map.Entry<String, byte[]> entry : nodeEncryptedWeights.entrySet()) {
                nodeSecurityStatus.put(entry.getKey(), "Accepted (HE Blind)");
            }
        } else if ("BULYAN".equalsIgnoreCase(aggregationStrategy)) {
            int f = (int) Math.floor(n * maliciousFraction);
            validWeights.add(new ArrayList<>());
            updatedGlobalWeights = bulyanAggregator.aggregate(nodeWeights, f, nodeSecurityStatus, nodeRejectionCount);
        } else {
            int f = (int) Math.floor(n * maliciousFraction);
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

                for (int i = 0; i < n; i++) {
                    String idA = nodeIds.get(i);
                    List<Double> distances = new ArrayList<>();
                    for (int j = 0; j < n; j++) {
                        if (i == j) {
                            continue;
                        }
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

                nodeIds.sort((id1, id2) -> Double.compare(krumScores.get(id1), krumScores.get(id2)));

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

        if (validWeights.isEmpty() && !heEnabledConfig && !"BULYAN".equalsIgnoreCase(aggregationStrategy)) {
            System.out.println("All nodes rejected in round " + (currentRound + 1) + ". Round skipped.");
            nodeWeights.clear();
            nodeEncryptedWeights.clear();
            nodeLosses.clear();
            nodeAccuracies.clear();
            return new AggregationOutcome(
                    currentRound,
                    updatedGlobalWeights,
                    updatedHeGlobalWeights,
                    currentFedproxMu,
                    currentDpNoiseMultiplier,
                    previousRoundLoss,
                    previousRoundAccuracy,
                    LocalDateTime.now(),
                    false
            );
        }

        if (heEnabledConfig) {
            try {
                System.out.println("Delegating " + nodeEncryptedWeights.size() + " encrypted payloads to HE sidecar...");
                updatedHeGlobalWeights = heAggregationClient.aggregate(heSidecarUrl, heContextPublic, nodeEncryptedWeights);
                System.out.println("Successfully received aggregated HE ciphertext from sidecar.");
            } catch (Exception e) {
                System.err.println("Exception calling HE Sidecar: " + e.getMessage());
                e.printStackTrace();
            }
        } else if (!"BULYAN".equalsIgnoreCase(aggregationStrategy)) {
            int numParams = validWeights.get(0).size();
            List<Double> newGlobalWeights = new ArrayList<>(numParams);

            for (int i = 0; i < numParams; i++) {
                double sum = 0.0;
                for (List<Double> nodeWeight : validWeights) {
                    sum += nodeWeight.get(i);
                }
                newGlobalWeights.add(sum / validWeights.size());
            }
            updatedGlobalWeights = newGlobalWeights;
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
            if (accuracy > 0.99) {
                accuracy = 0.99;
            }
        }

        TunedState tunedState;
        if (manualHyperparamLock) {
            System.out.println("Manual hyperparameter lock is ACTIVE. Skipping auto-tuning.");
            tunedState = new TunedState(currentFedproxMu, currentDpNoiseMultiplier, avgLoss, accuracy);
        } else {
            tunedState = tuneRoundHyperparameters(
                    dynamicHyperparameterController,
                    currentDpEnabled,
                    currentFedproxMu,
                    currentDpNoiseMultiplier,
                    previousRoundLoss,
                    previousRoundAccuracy,
                    avgLoss,
                    accuracy,
                    fedproxMuMin,
                    fedproxMuMax,
                    fedproxMuStep,
                    dpNoiseMin,
                    dpNoiseMax,
                    dpNoiseStep
            );
        }

        int updatedRound = currentRound + 1;

        RoundEntity entity = new RoundEntity(updatedRound, avgLoss, accuracy, LocalDateTime.now(), new HashMap<>(nodeSecurityStatus));
        roundRepository.save(entity);

        persistGlobalModelState(
                heEnabledConfig,
                updatedHeGlobalWeights,
                updatedGlobalWeights,
                updatedRound,
                globalModelStateRepository,
                minioService
        );

        nodeWeights.clear();
        nodeEncryptedWeights.clear();
        nodeLosses.clear();
        nodeAccuracies.clear();
        liveActivityTracker.clearNodeActivities();
        liveActivityTracker.setGlobalStage("IDLE");

        liveActivityTracker.addEventLog("\u2705 Round " + updatedRound + " completed! Accuracy: " + String.format("%.2f%%", accuracy * 100) + ", Loss: " + String.format("%.4f", avgLoss));
        System.out.println("FedAvg completed successfully! Global model updated to round " + updatedRound
                + " (aggregated " + validWeights.size() + " nodes)");

        return new AggregationOutcome(
                updatedRound,
                updatedGlobalWeights,
                updatedHeGlobalWeights,
                tunedState.currentFedproxMu(),
                tunedState.currentDpNoiseMultiplier(),
                tunedState.previousRoundLoss(),
                tunedState.previousRoundAccuracy(),
                LocalDateTime.now(),
                true
        );
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

    private TunedState tuneRoundHyperparameters(
            DynamicHyperparameterController dynamicHyperparameterController,
            boolean currentDpEnabled,
            double currentFedproxMu,
            double currentDpNoiseMultiplier,
            Double previousRoundLoss,
            Double previousRoundAccuracy,
            double avgLoss,
            double accuracy,
            double fedproxMuMin,
            double fedproxMuMax,
            double fedproxMuStep,
            double dpNoiseMin,
            double dpNoiseMax,
            double dpNoiseStep
    ) {
        if (previousRoundLoss == null || previousRoundAccuracy == null) {
            System.out.println("Initialized dynamic hyperparameters: dpEnabled=" + currentDpEnabled
                    + ", fedproxMu=" + currentFedproxMu
                    + ", dpNoiseMultiplier=" + currentDpNoiseMultiplier);
            return new TunedState(
                    currentFedproxMu,
                    currentDpNoiseMultiplier,
                    avgLoss,
                    accuracy
            );
        }

        DynamicHyperparameterController.TunedHyperparameters tuned = dynamicHyperparameterController.tune(
                currentFedproxMu,
                currentDpNoiseMultiplier,
                previousRoundLoss,
                avgLoss,
                previousRoundAccuracy,
                accuracy,
                fedproxMuMin,
                fedproxMuMax,
                fedproxMuStep,
                dpNoiseMin,
                dpNoiseMax,
                dpNoiseStep
        );

        System.out.println("Dynamic hyperparameters tuned: fedproxMu=" + tuned.fedproxMu()
                + ", dpNoiseMultiplier=" + tuned.dpNoiseMultiplier()
                + ", lossDelta=" + String.format("%.6f", tuned.lossDelta())
                + ", accuracyDelta=" + String.format("%.6f", tuned.accuracyDelta()) + ")");

        return new TunedState(
                tuned.fedproxMu(),
                tuned.dpNoiseMultiplier(),
                avgLoss,
                accuracy
        );
    }

    private void persistGlobalModelState(
            boolean heEnabledConfig,
            byte[] heGlobalWeights,
            List<Double> globalWeights,
            int currentRound,
            GlobalModelStateRepository globalModelStateRepository,
            MinioService minioService
    ) {
        try {
            byte[] blob;
            if (heEnabledConfig && heGlobalWeights != null) {
                blob = heGlobalWeights;
            } else {
                blob = serializeWeights(globalWeights);
            }

            String objectName = "models/round-" + currentRound + ".bin";
            minioService.uploadWeights(objectName, blob);
            GlobalModelStateEntity stateEntity = new GlobalModelStateEntity(currentRound, objectName);
            globalModelStateRepository.save(stateEntity);
        } catch (Exception e) {
            System.err.println("Failed to persist global model state: " + e.getMessage());
        }
    }

    private byte[] serializeWeights(List<Double> weights) {
        ByteBuffer buffer = ByteBuffer.allocate(weights.size() * 8);
        for (Double w : weights) {
            buffer.putDouble(w != null ? w : 0.0);
        }
        return buffer.array();
    }

    public record AggregationOutcome(
            int currentRound,
            List<Double> globalWeights,
            byte[] heGlobalWeights,
            double currentFedproxMu,
            double currentDpNoiseMultiplier,
            Double previousRoundLoss,
            Double previousRoundAccuracy,
            LocalDateTime roundStartTime,
            boolean shouldBroadcast
    ) {
    }

    private record TunedState(
            double currentFedproxMu,
            double currentDpNoiseMultiplier,
            Double previousRoundLoss,
            Double previousRoundAccuracy
    ) {
    }
}
