package com.flplatform.aggregator;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "global_model_state")
public class GlobalModelStateEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private int currentRound;

    @Column(length = 512)
    private String modelPath;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public GlobalModelStateEntity() {}

    public GlobalModelStateEntity(int currentRound, String modelPath) {
        this.currentRound = currentRound;
        this.modelPath = modelPath;
        this.updatedAt = LocalDateTime.now();
    }

    // Getters
    public Long getId() { return id; }
    public int getCurrentRound() { return currentRound; }
    public String getModelPath() { return modelPath; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    // Setters
    public void setCurrentRound(int currentRound) { this.currentRound = currentRound; }
    public void setModelPath(String modelPath) { this.modelPath = modelPath; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
