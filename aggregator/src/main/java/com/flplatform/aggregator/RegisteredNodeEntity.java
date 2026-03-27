package com.flplatform.aggregator;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "registered_nodes")
public class RegisteredNodeEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String nodeId;

    private String hostname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NodeStatus status = NodeStatus.ACTIVE;

    @Column(nullable = false)
    private LocalDateTime registeredAt;

    @Column(nullable = false)
    private LocalDateTime lastHeartbeat;

    public enum NodeStatus {
        ACTIVE, STALE, DISCONNECTED
    }

    public RegisteredNodeEntity() {}

    public RegisteredNodeEntity(String nodeId, String hostname) {
        this.nodeId = nodeId;
        this.hostname = hostname;
        this.status = NodeStatus.ACTIVE;
        this.registeredAt = LocalDateTime.now();
        this.lastHeartbeat = LocalDateTime.now();
    }

    // Getters
    public Long getId() { return id; }
    public String getNodeId() { return nodeId; }
    public String getHostname() { return hostname; }
    public NodeStatus getStatus() { return status; }
    public LocalDateTime getRegisteredAt() { return registeredAt; }
    public LocalDateTime getLastHeartbeat() { return lastHeartbeat; }

    // Setters
    public void setStatus(NodeStatus status) { this.status = status; }
    public void setLastHeartbeat(LocalDateTime lastHeartbeat) { this.lastHeartbeat = lastHeartbeat; }
    public void setHostname(String hostname) { this.hostname = hostname; }
}
