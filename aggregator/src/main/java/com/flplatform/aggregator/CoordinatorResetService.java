package com.flplatform.aggregator;

import com.flplatform.aggregator.security.NodeCredentialService;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class CoordinatorResetService {

    public ResetResult resetTraining(
            NodeCredentialService nodeCredentialService,
            RoundRepository roundRepository,
            GlobalModelStateRepository globalModelStateRepository,
            MinioService minioService,
            List<Double> globalWeights,
            Map<String, List<Double>> nodeWeights,
            Map<String, byte[]> nodeEncryptedWeights,
            Map<String, Double> nodeLosses,
            Map<String, Double> nodeAccuracies,
            Map<String, String> nodeSecurityStatus,
            Map<String, Integer> nodeRejectionCount,
            Map<String, Boolean> nodeDpStatus,
            LiveActivityTracker liveActivityTracker,
            boolean dpEnabledInitial,
            double fedproxMuInitial,
            double dpNoiseInitial
    ) {
        int revokedNodes = nodeCredentialService.revokeAllNodeCredentials();
        roundRepository.deleteAll();
        globalModelStateRepository.deleteAll();
        minioService.deleteAllObjects();

        globalWeights.clear();
        nodeWeights.clear();
        nodeEncryptedWeights.clear();
        nodeLosses.clear();
        nodeAccuracies.clear();
        nodeSecurityStatus.clear();
        nodeRejectionCount.clear();
        nodeDpStatus.clear();
        liveActivityTracker.clearAll();

        LocalDateTime roundStartTime = LocalDateTime.now();
        liveActivityTracker.addEventLog("\uD83D\uDDD1\uFE0F System reset. All training data cleared and node sessions revoked.");

        Map<String, Object> response = Map.of(
                "status", "success",
                "message", "Training reset to round 0. Node sessions revoked.",
                "revokedNodes", revokedNodes
        );

        return new ResetResult(
                response,
                0,
                null,
                null,
                dpEnabledInitial,
                fedproxMuInitial,
                dpNoiseInitial,
                null,
                null,
                roundStartTime
        );
    }

    public record ResetResult(
            Map<String, Object> response,
            int currentRound,
            byte[] heGlobalWeights,
            byte[] heContextPublic,
            boolean currentDpEnabled,
            double currentFedproxMu,
            double currentDpNoiseMultiplier,
            Double previousRoundLoss,
            Double previousRoundAccuracy,
            LocalDateTime roundStartTime
    ) {
    }
}
