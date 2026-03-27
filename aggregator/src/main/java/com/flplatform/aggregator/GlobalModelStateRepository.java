package com.flplatform.aggregator;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GlobalModelStateRepository extends JpaRepository<GlobalModelStateEntity, Long> {
    Optional<GlobalModelStateEntity> findTopByOrderByCurrentRoundDesc();
}
