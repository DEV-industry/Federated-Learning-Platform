package com.flplatform.aggregator.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    public record JwtPrincipal(String nodeId, int authVersion) {}

    private final SecretKey signingKey;
    private static final long EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    public JwtUtil(@Value("${jwt.secret}") String secret) {
        // Validate that the key is at least 256 bits for HS256
        if (secret == null || secret.isEmpty()) {
            throw new IllegalArgumentException(
                "JWT_SECRET must not be empty. Received: null or empty string"
            );
        }
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException(
                "JWT_SECRET must be at least 32 bytes (256 bits) for HS256 algorithm. " +
                "Current length: " + keyBytes.length + " bytes. " +
                "Please set a longer secret in the JWT_SECRET environment variable or configuration."
            );
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateToken(String nodeId, int authVersion) {
        return Jwts.builder()
                .subject(nodeId)
                .claim("authVersion", authVersion)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + EXPIRATION_MS))
                .signWith(signingKey)
                .compact();
    }

    public JwtPrincipal validateToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            Object versionClaim = claims.get("authVersion");
            int authVersion = 0;
            if (versionClaim instanceof Number number) {
                authVersion = number.intValue();
            }
            return new JwtPrincipal(claims.getSubject(), authVersion);
        } catch (Exception e) {
            return null;
        }
    }
}
