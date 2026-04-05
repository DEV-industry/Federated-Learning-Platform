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

    @Column(length = 1024)
    private String publicKey;

    @Column(nullable = false)
    private int authVersion = 0;

    private String clientVersion;

    private String deviceModel;

    private String deviceOs;

    private String deviceCpu;

    private String deviceGpu;

    private String deviceRegion;

    private LocalDateTime enrolledAt;

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
    public String getPublicKey() { return publicKey; }
    public int getAuthVersion() { return authVersion; }
    public String getClientVersion() { return clientVersion; }
    public String getDeviceModel() { return deviceModel; }
    public String getDeviceOs() { return deviceOs; }
    public String getDeviceCpu() { return deviceCpu; }
    public String getDeviceGpu() { return deviceGpu; }
    public String getDeviceRegion() { return deviceRegion; }
    public LocalDateTime getEnrolledAt() { return enrolledAt; }

    // Setters
    public void setStatus(NodeStatus status) { this.status = status; }
    public void setLastHeartbeat(LocalDateTime lastHeartbeat) { this.lastHeartbeat = lastHeartbeat; }
    public void setHostname(String hostname) { this.hostname = hostname; }
    public void setPublicKey(String publicKey) { this.publicKey = publicKey; }
    public void setAuthVersion(int authVersion) { this.authVersion = authVersion; }
    public void setClientVersion(String clientVersion) { this.clientVersion = clientVersion; }
    public void setDeviceModel(String deviceModel) { this.deviceModel = deviceModel; }
    public void setDeviceOs(String deviceOs) { this.deviceOs = deviceOs; }
    public void setDeviceCpu(String deviceCpu) { this.deviceCpu = deviceCpu; }
    public void setDeviceGpu(String deviceGpu) { this.deviceGpu = deviceGpu; }
    public void setDeviceRegion(String deviceRegion) { this.deviceRegion = deviceRegion; }
    public void setEnrolledAt(LocalDateTime enrolledAt) { this.enrolledAt = enrolledAt; }
}
