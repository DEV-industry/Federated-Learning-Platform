package com.flplatform.aggregator.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final JwtUtil jwtUtil;

    @Value("${node.secret}")
    private String expectedNodeSecret;

    public AuthController(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    private String calculateExpectedHash(String nodeId) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(expectedNodeSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(nodeId.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hmacBytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("Failed to calculate HMAC", e);
        }
    }

    @PostMapping("/auth")
    public ResponseEntity<Map<String, Object>> authenticate(@RequestBody Map<String, String> payload) {
        String nodeId = payload.get("nodeId");
        String nodeSecret = payload.get("nodeSecret");

        if (nodeId == null || nodeId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "error",
                "message", "nodeId is required"
            ));
        }

        String expectedHash = calculateExpectedHash(nodeId);

        if (nodeSecret == null || !nodeSecret.equals(expectedHash)) {
            return ResponseEntity.status(401).body(Map.of(
                "status", "error",
                "message", "Invalid credentials"
            ));
        }

        String token = jwtUtil.generateToken(nodeId);

        return ResponseEntity.ok(Map.of(
            "status", "success",
            "token", token,
            "nodeId", nodeId
        ));
    }
}
