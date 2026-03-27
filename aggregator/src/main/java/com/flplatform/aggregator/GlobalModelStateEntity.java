package com.flplatform.aggregator;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.LocalDateTime;

@Entity
@Table(name = "global_model_state")
public class GlobalModelStateEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private int currentRound;

    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(columnDefinition = "BYTEA")
    private byte[] globalWeightsBlob;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public GlobalModelStateEntity() {}

    public GlobalModelStateEntity(int currentRound, byte[] globalWeightsBlob) {
        this.currentRound = currentRound;
        this.globalWeightsBlob = globalWeightsBlob;
        this.updatedAt = LocalDateTime.now();
    }

    // Getters
    public Long getId() { return id; }
    public int getCurrentRound() { return currentRound; }
    public byte[] getGlobalWeightsBlob() { return globalWeightsBlob; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }

    // Setters
    public void setCurrentRound(int currentRound) { this.currentRound = currentRound; }
    public void setGlobalWeightsBlob(byte[] globalWeightsBlob) { this.globalWeightsBlob = globalWeightsBlob; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
