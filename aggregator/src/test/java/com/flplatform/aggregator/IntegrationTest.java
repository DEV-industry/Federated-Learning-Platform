package com.flplatform.aggregator;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
class IntegrationTest {

    private static final String TEST_DB_NAME = "flplatform_test";
    private static final String TEST_DB_USER = "testuser";
    private static final String TEST_DB_PASSWORD = "testpass";

    private static final String TEST_MINIO_USER = "minioadmin";
    private static final String TEST_MINIO_PASSWORD = "minioadmin";
    private static final String TEST_MINIO_BUCKET = "fl-models-test";

    private static final String TEST_JWT_SECRET = "test-jwt-secret-key-with-at-least-32-bytes";
    private static final String TEST_RABBIT_USER = "testuser";
    private static final String TEST_RABBIT_PASSWORD = "testpass";

    // Konfiguracja kontenera PostgreSQL
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15-alpine")
            .withDatabaseName(TEST_DB_NAME)
            .withUsername(TEST_DB_USER)
            .withPassword(TEST_DB_PASSWORD);

    // Konfiguracja kontenera RabbitMQ
    @Container
    static RabbitMQContainer rabbitmq = new RabbitMQContainer("rabbitmq:3-management-alpine")
            .withUser(TEST_RABBIT_USER, TEST_RABBIT_PASSWORD);

    // Konfiguracja kontenera MinIO
    @Container
    static GenericContainer<?> minio = new GenericContainer<>("minio/minio:RELEASE.2024-03-03T17-50-39Z")
            .withExposedPorts(9000)
            .withEnv("MINIO_ROOT_USER", TEST_MINIO_USER)
            .withEnv("MINIO_ROOT_PASSWORD", TEST_MINIO_PASSWORD)
            .withCommand("server /data");

    // Nadpisanie właściwości Spring Boot, aby używał kontenerów
    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.rabbitmq.host", rabbitmq::getHost);
        registry.add("spring.rabbitmq.port", rabbitmq::getAmqpPort);
        registry.add("spring.rabbitmq.username", () -> TEST_RABBIT_USER);
        registry.add("spring.rabbitmq.password", () -> TEST_RABBIT_PASSWORD);
        registry.add("minio.url", () -> "http://" + minio.getHost() + ":" + minio.getMappedPort(9000));
        registry.add("minio.access-key", () -> TEST_MINIO_USER);
        registry.add("minio.secret-key", () -> TEST_MINIO_PASSWORD);
        registry.add("minio.bucket", () -> TEST_MINIO_BUCKET);
        registry.add("jwt.secret", () -> TEST_JWT_SECRET);
        // Dynamiczny port gRPC (0 = losowy dostępny port)
        registry.add("grpc.server.port", () -> 0);
        // TLS gRPC jest wymagany w runtime, ale wyłączony w testach integracyjnych.
        registry.add("grpc.server.security.enabled", () -> false);
    }

    @Test
    void contextLoads() {
        // Ten test przejdzie tylko, jeśli aplikacja Spring Boot
        // poprawnie połączy się z PostgreSQL i RabbitMQ z Testcontainers.
    }
}