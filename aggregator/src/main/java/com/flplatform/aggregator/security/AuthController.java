package com.flplatform.aggregator.security;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final JwtUtil jwtUtil;
    private final NodeCredentialService nodeCredentialService;

    public AuthController(JwtUtil jwtUtil, NodeCredentialService nodeCredentialService) {
        this.jwtUtil = jwtUtil;
        this.nodeCredentialService = nodeCredentialService;
    }

    @PostMapping("/auth")
    public ResponseEntity<Map<String, Object>> authenticate(@RequestBody Map<String, String> payload) {
        String nodeId = payload.get("nodeId");
        String hostname = payload.getOrDefault("hostname", "unknown");
        String publicKey = payload.get("publicKey");
        String signature = payload.get("signature");

        if (nodeId == null || nodeId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "error",
                "message", "nodeId is required"
            ));
        }

        if (publicKey == null || publicKey.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "error",
                "message", "publicKey is required"
            ));
        }

        if (signature == null || signature.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "error",
                "message", "signature is required"
            ));
        }

        try {
            nodeCredentialService.authenticateNode(nodeId, hostname, publicKey, signature);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "error",
                "message", e.getMessage()
            ));
        } catch (SecurityException e) {
            return ResponseEntity.status(401).body(Map.of(
                "status", "error",
                "message", e.getMessage()
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
