package com.flplatform.aggregator.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    private static final String TEST_JWT_SECRET = "test-jwt-secret-key-with-at-least-32-bytes";
    private static final String TEST_NODE_ID = "test-node";
    private static final String INVALID_TOKEN = "eyJhbGciOiJIUzI1NiJ9.NieprawidlowyPayload.NieprawidlowyPodpis";

    private final JwtUtil jwtUtil = new JwtUtil(TEST_JWT_SECRET);

    @Test
    void shouldGenerateAndValidateToken() {
        // when
        String token = jwtUtil.generateToken(TEST_NODE_ID);

        // then
        assertNotNull(token);
        assertEquals(TEST_NODE_ID, jwtUtil.validateTokenAndGetSubject(token));
    }

    @Test
    void shouldReturnNullForInvalidToken() {
        // when
        String subject = jwtUtil.validateTokenAndGetSubject(INVALID_TOKEN);

        // then
        assertNull(subject);
    }
}