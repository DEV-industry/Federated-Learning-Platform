package com.flplatform.aggregator;

import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class BulyanAggregator {

    /**
     * Calculates the Euclidean distance between two weight vectors.
     */
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

    /**
     * Executes the Bulyan aggregation algorithm.
     * Bulyan is a two-step defense: 
     * 1. Multi-Krum selection to find a core set of nodes
     * 2. Coordinate-wise Trimmed Mean to aggregate the core set
     */
    public List<Double> aggregate(Map<String, List<Double>> nodeWeights, int numMalicious, Map<String, String> nodeSecurityStatus, Map<String, Integer> nodeRejectionCount) {
        int n = nodeWeights.size();
        int f = numMalicious;
        
        // Bulyan requires n >= 4f + 3
        int minRequired = 4 * f + 3;
        
        if (n < minRequired) {
            System.out.println("Warning: Bulyan requires at least " + minRequired + " nodes (n=" + n + ", f=" + f + "). Falling back to accepting all.");
            List<List<Double>> allWeights = new ArrayList<>();
            for (Map.Entry<String, List<Double>> entry : nodeWeights.entrySet()) {
                nodeSecurityStatus.put(entry.getKey(), "Accepted (Fallback)");
                allWeights.add(entry.getValue());
            }
            return averageVectors(allWeights);
        }

        // --- PHASE 1: Multi-Krum Selection (θ = n - 2f) ---
        int theta = n - 2 * f;
        List<String> selectedNodes = multiKrumSelect(nodeWeights, n, f, theta, nodeSecurityStatus, nodeRejectionCount);
        
        if (selectedNodes.isEmpty()) {
            return new ArrayList<>(); // Defensive
        }

        // --- PHASE 2: Coordinate-wise Trimmed Mean ---
        List<List<Double>> selectedWeights = new ArrayList<>();
        for (String nodeId : selectedNodes) {
            selectedWeights.add(nodeWeights.get(nodeId));
        }

        int numParams = selectedWeights.get(0).size();
        List<Double> aggregatedWeights = new ArrayList<>(numParams);

        // For each dimension: sort, trim f largest and f smallest, and average the rest (θ - 2f)
        int numTrim = f;
        int numToAverage = theta - 2 * f;
        
        for (int i = 0; i < numParams; i++) {
            List<Double> coordinateValues = new ArrayList<>(theta);
            for (List<Double> weights : selectedWeights) {
                coordinateValues.add(weights.get(i));
            }
            
            // Sort to trim extremes
            Collections.sort(coordinateValues);
            
            double sum = 0.0;
            for (int k = numTrim; k < numTrim + numToAverage; k++) {
                sum += coordinateValues.get(k);
            }
            aggregatedWeights.add(sum / numToAverage);
        }

        return aggregatedWeights;
    }

    /**
     * Standard Multi-Krum selection logic extracted for reuse.
     */
    public List<String> multiKrumSelect(Map<String, List<Double>> nodeWeights, int n, int f, int numToSelect, Map<String, String> nodeSecurityStatus, Map<String, Integer> nodeRejectionCount) {
        int numNeighbors = n - f - 2;
        List<String> nodeIds = new ArrayList<>(nodeWeights.keySet());
        Map<String, Double> krumScores = new HashMap<>();

        // Calculate Krum scores
        for (int i = 0; i < n; i++) {
            String idA = nodeIds.get(i);
            List<Double> distances = new ArrayList<>();
            for (int j = 0; j < n; j++) {
                if (i == j) continue;
                String idB = nodeIds.get(j);
                distances.add(calculateDistance(nodeWeights.get(idA), nodeWeights.get(idB)));
            }
            Collections.sort(distances);

            double score = 0.0;
            for (int k = 0; k < numNeighbors; k++) {
                score += distances.get(k);
            }
            krumScores.put(idA, score);
        }

        // Sort nodes by Krum score (ascending)
        nodeIds.sort(Comparator.comparingDouble(krumScores::get));

        // Select the top 'numToSelect' nodes
        List<String> selectedNodes = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            String nodeId = nodeIds.get(i);
            if (i < numToSelect) {
                nodeSecurityStatus.put(nodeId, "Accepted");
                selectedNodes.add(nodeId);
            } else {
                nodeSecurityStatus.put(nodeId, "Rejected");
                nodeRejectionCount.put(nodeId, nodeRejectionCount.getOrDefault(nodeId, 0) + 1);
                System.out.println("SUSPICIOUS node rejected: " + nodeId + " with score " + krumScores.get(nodeId));
            }
        }
        
        return selectedNodes;
    }

    /**
     * Simple fallback average.
     */
    public List<Double> averageVectors(List<List<Double>> vectors) {
        if (vectors.isEmpty()) return new ArrayList<>();
        int numParams = vectors.get(0).size();
        List<Double> result = new ArrayList<>(numParams);
        for (int i = 0; i < numParams; i++) {
            double sum = 0.0;
            for (List<Double> vec : vectors) {
                sum += vec.get(i);
            }
            result.add(sum / vectors.size());
        }
        return result;
    }
}
