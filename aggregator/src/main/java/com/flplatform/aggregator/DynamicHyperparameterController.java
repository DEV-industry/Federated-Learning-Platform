package com.flplatform.aggregator;

public class DynamicHyperparameterController {

	public TunedHyperparameters tune(
			double currentMu,
			double currentNoise,
			double previousLoss,
			double currentLoss,
			double previousAccuracy,
			double currentAccuracy,
			double minMu,
			double maxMu,
			double muStep,
			double minNoise,
			double maxNoise,
			double noiseStep
	) {
		double lossDelta = currentLoss - previousLoss;
		double accuracyDelta = currentAccuracy - previousAccuracy;

		boolean degraded = lossDelta > 0.01 || accuracyDelta < -0.005;
		boolean improving = lossDelta < -0.01 || accuracyDelta > 0.005;

		double newMu = currentMu;
		double newNoise = currentNoise;

		if (degraded) {
			newMu = currentMu + muStep;
			newNoise = currentNoise - noiseStep;
		} else if (improving) {
			newMu = currentMu - (muStep * 0.5);
			newNoise = currentNoise + (noiseStep * 0.5);
		}

		newMu = clamp(newMu, minMu, maxMu);
		newNoise = clamp(newNoise, minNoise, maxNoise);

		return new TunedHyperparameters(newMu, newNoise, lossDelta, accuracyDelta, degraded, improving);
	}

	private double clamp(double value, double min, double max) {
		if (value < min) {
			return min;
		}
		if (value > max) {
			return max;
		}
		return value;
	}

	public record TunedHyperparameters(
			double fedproxMu,
			double dpNoiseMultiplier,
			double lossDelta,
			double accuracyDelta,
			boolean degraded,
			boolean improving
	) {
	}
}
