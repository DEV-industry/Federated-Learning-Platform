package com.flplatform.aggregator.security;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
        String enrollmentToken = payload.get("enrollmentToken");
        String clientVersion = payload.get("clientVersion");
        String deviceModel = payload.get("deviceModel");
        String deviceOs = payload.get("deviceOs");
        String deviceCpu = payload.get("deviceCpu");
        String deviceGpu = payload.get("deviceGpu");
        String deviceRegion = payload.get("deviceRegion");

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

        int authVersion;
        try {
            authVersion = nodeCredentialService
                    .authenticateNode(
                        nodeId,
                        hostname,
                        publicKey,
                        signature,
                        enrollmentToken,
                        clientVersion,
                        deviceModel,
                        deviceOs,
                        deviceCpu,
                        deviceGpu,
                        deviceRegion)
                    .getAuthVersion();
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
        String token = jwtUtil.generateToken(nodeId, authVersion);

        return ResponseEntity.ok(Map.of(
            "status", "success",
            "token", token,
            "nodeId", nodeId
        ));
    }

    @PostMapping("/auth/rotate-key")
    public ResponseEntity<Map<String, Object>> rotateKey(@RequestBody Map<String, String> payload,
                                                          Authentication authentication) {
        String nodeId = payload.get("nodeId");
        String hostname = payload.getOrDefault("hostname", "unknown");
        String currentPublicKey = payload.get("currentPublicKey");
        String currentSignature = payload.get("currentSignature");
        String newPublicKey = payload.get("newPublicKey");
        String newSignature = payload.get("newSignature");

        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).body(Map.of(
                "status", "error",
                "message", "Missing authentication context"
            ));
        }

        if (nodeId == null || nodeId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                "status", "error",
                "message", "nodeId is required"
            ));
        }

        if (!authentication.getName().equals(nodeId)) {
            return ResponseEntity.status(403).body(Map.of(
                "status", "error",
                "message", "Authenticated node cannot rotate another node key"
            ));
        }

        try {
            int authVersion = nodeCredentialService.rotateNodeKey(
                    nodeId,
                    hostname,
                    currentPublicKey,
                    currentSignature,
                    newPublicKey,
                    newSignature
            ).getAuthVersion();
            String token = jwtUtil.generateToken(nodeId, authVersion);
            return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Node key rotated successfully",
                "nodeId", nodeId,
                "token", token
            ));
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
    }
}
