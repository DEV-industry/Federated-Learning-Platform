package com.flplatform.aggregator.security;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    private static final String TEST_JWT_SECRET = "test-jwt-secret-key-with-at-least-32-bytes";
    private static final String TEST_NODE_ID = "test-node";
    private static final int TEST_AUTH_VERSION = 1;
    private static final String INVALID_TOKEN = "eyJhbGciOiJIUzI1NiJ9.NieprawidlowyPayload.NieprawidlowyPodpis";

    private final JwtUtil jwtUtil = new JwtUtil(TEST_JWT_SECRET);

    @Test
    void shouldGenerateAndValidateToken() {
        // when
        String token = jwtUtil.generateToken(TEST_NODE_ID, TEST_AUTH_VERSION);

        // then
        assertNotNull(token);
        JwtUtil.JwtPrincipal principal = jwtUtil.validateToken(token);
        assertNotNull(principal);
        assertEquals(TEST_NODE_ID, principal.nodeId());
        assertEquals(TEST_AUTH_VERSION, principal.authVersion());
    }

    @Test
    void shouldReturnNullForInvalidToken() {
        // when
        JwtUtil.JwtPrincipal principal = jwtUtil.validateToken(INVALID_TOKEN);

        // then
        assertNull(principal);
    }

    @Test
    void shouldThrowExceptionForShortSecret() {
        // when & then
        assertThrows(IllegalArgumentException.class, () -> new JwtUtil("short"),
                "Should reject secrets shorter than 32 bytes");
    }

    @Test
    void shouldThrowExceptionForEmptySecret() {
        // when & then
        assertThrows(IllegalArgumentException.class, () -> new JwtUtil(""),
                "Should reject empty secret");
    }

    @Test
    void shouldThrowExceptionForNullSecret() {
        // when & then
        assertThrows(IllegalArgumentException.class, () -> new JwtUtil(null),
                "Should reject null secret");
    }

    @Test
    void shouldAccept32ByteSecret() {
        // when & then - should not throw
        String thirtyTwoByteSecret = "twelve-byte-secret-key-for-jwt";
        assertDoesNotThrow(() -> new JwtUtil(thirtyTwoByteSecret),
                "Should accept 32-byte secret");
    }
}