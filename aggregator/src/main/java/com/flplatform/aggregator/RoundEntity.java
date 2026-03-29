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

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "round_node_statuses", joinColumns = @JoinColumn(name = "round_id"))
    @MapKeyColumn(name = "node_id")
    @Column(name = "status")
    private java.util.Map<String, String> nodeStatuses;

    public RoundEntity() {}

    public RoundEntity(int roundNumber, double avgLoss, double accuracy, LocalDateTime timestamp, java.util.Map<String, String> nodeStatuses) {
        this.roundNumber = roundNumber;
        this.avgLoss = avgLoss;
        this.accuracy = accuracy;
        this.timestamp = timestamp;
        this.nodeStatuses = nodeStatuses != null ? new java.util.HashMap<>(nodeStatuses) : new java.util.HashMap<>();
    }

    // Getters
    public Long getId() { return id; }
    public int getRoundNumber() { return roundNumber; }
    public double getAvgLoss() { return avgLoss; }
    public double getAccuracy() { return accuracy; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public java.util.Map<String, String> getNodeStatuses() { return nodeStatuses; }
}
