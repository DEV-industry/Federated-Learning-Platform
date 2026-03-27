package com.flplatform.aggregator;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RegisteredNodeRepository extends JpaRepository<RegisteredNodeEntity, Long> {
    Optional<RegisteredNodeEntity> findByNodeId(String nodeId);
    List<RegisteredNodeEntity> findByStatus(RegisteredNodeEntity.NodeStatus status);
    List<RegisteredNodeEntity> findByLastHeartbeatBefore(LocalDateTime threshold);
    long countByStatus(RegisteredNodeEntity.NodeStatus status);
    void deleteByNodeId(String nodeId);
}
