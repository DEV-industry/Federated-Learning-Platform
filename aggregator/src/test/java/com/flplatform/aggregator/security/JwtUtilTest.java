package com.flplatform.aggregator.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        // Symulacja wstrzyknięcia klucza z application.properties
        ReflectionTestUtils.setField(jwtUtil, "secret", "TwojBardzoTajnyKluczTestowyKtoryJestWystarczajacoDlugi123!");
        ReflectionTestUtils.setField(jwtUtil, "expirationMs", 3600000L); // 1 godzina
    }

    @Test
    void shouldGenerateAndValidateToken() {
        // given
        String username = "testNode";

        // when
        String token = jwtUtil.generateToken(username);

        // then
        assertNotNull(token);
        assertTrue(jwtUtil.validateToken(token));
        assertEquals(username, jwtUtil.extractUsername(token));
    }

    @Test
    void shouldReturnFalseForInvalidToken() {
        // given
        String invalidToken = "eyJhbGciOiJIUzI1NiJ9.NieprawidlowyPayload.NieprawidlowyPodpis";

        // when
        boolean isValid = jwtUtil.validateToken(invalidToken);

        // then
        assertFalse(isValid);
    }
}