package com.flplatform.aggregator;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "training_rounds")
public class RoundEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private int roundNumber;
    private double avgLoss;
    private double accuracy;
    private LocalDateTime timestamp;

    public RoundEntity() {}

    public RoundEntity(int roundNumber, double avgLoss, double accuracy, LocalDateTime timestamp) {
        this.roundNumber = roundNumber;
        this.avgLoss = avgLoss;
        this.accuracy = accuracy;
        this.timestamp = timestamp;
    }

    // Getters
    public Long getId() { return id; }
    public int getRoundNumber() { return roundNumber; }
    public double getAvgLoss() { return avgLoss; }
    public double getAccuracy() { return accuracy; }
    public LocalDateTime getTimestamp() { return timestamp; }
}
