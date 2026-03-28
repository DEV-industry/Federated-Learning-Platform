package com.flplatform.aggregator.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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

        if (nodeSecret == null || !nodeSecret.equals(expectedNodeSecret)) {
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
