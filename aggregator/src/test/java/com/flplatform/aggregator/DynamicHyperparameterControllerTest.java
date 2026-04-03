package com.flplatform.aggregator;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DynamicHyperparameterControllerTest {

    private final DynamicHyperparameterController controller = new DynamicHyperparameterController();

    @Test
    void shouldIncreaseMuAndReduceNoiseWhenMetricsDegrade() {
        DynamicHyperparameterController.TunedHyperparameters tuned = controller.tune(
                0.01,
                0.02,
                0.30,
                0.33,
                0.90,
                0.88,
                0.001,
                0.05,
                0.002,
                0.001,
                0.1,
                0.002
        );

        assertTrue(tuned.degraded());
        assertEquals(0.012, tuned.fedproxMu(), 1e-9);
        assertEquals(0.018, tuned.dpNoiseMultiplier(), 1e-9);
    }

    @Test
    void shouldReduceMuAndIncreaseNoiseWhenMetricsImprove() {
        DynamicHyperparameterController.TunedHyperparameters tuned = controller.tune(
                0.02,
                0.01,
                0.40,
                0.36,
                0.85,
                0.88,
                0.001,
                0.05,
                0.002,
                0.001,
                0.1,
                0.002
        );

        assertTrue(tuned.improving());
        assertEquals(0.019, tuned.fedproxMu(), 1e-9);
        assertEquals(0.011, tuned.dpNoiseMultiplier(), 1e-9);
    }

    @Test
    void shouldClampValuesToConfiguredBounds() {
        DynamicHyperparameterController.TunedHyperparameters tuned = controller.tune(
                0.049,
                0.0015,
                0.25,
                0.30,
                0.92,
                0.89,
                0.001,
                0.05,
                0.005,
                0.001,
                0.1,
                0.005
        );

        assertEquals(0.05, tuned.fedproxMu(), 1e-9);
        assertEquals(0.001, tuned.dpNoiseMultiplier(), 1e-9);
    }
}
