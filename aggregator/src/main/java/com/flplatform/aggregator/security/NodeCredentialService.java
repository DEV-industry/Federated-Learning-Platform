package com.flplatform.aggregator.security;

import com.flplatform.aggregator.RegisteredNodeEntity;
import com.flplatform.aggregator.RegisteredNodeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.LocalDateTime;
import java.util.Base64;

@Service
public class NodeCredentialService {

    private static final String AUTH_MESSAGE_PREFIX = "node-auth:";

    private final RegisteredNodeRepository registeredNodeRepository;

    public NodeCredentialService(RegisteredNodeRepository registeredNodeRepository) {
        this.registeredNodeRepository = registeredNodeRepository;
    }

    @Transactional
    public RegisteredNodeEntity authenticateNode(String nodeId, String hostname, String publicKeyBase64, String signatureBase64) {
        String normalizedNodeId = requireText(nodeId, "nodeId");
        String normalizedHostname = hostname == null || hostname.isBlank() ? "unknown" : hostname.trim();
        String normalizedPublicKey = requireText(publicKeyBase64, "publicKey");
        String normalizedSignature = requireText(signatureBase64, "signature");

        PublicKey publicKey = decodePublicKey(normalizedPublicKey);
        verifySignature(publicKey, normalizedSignature, AUTH_MESSAGE_PREFIX + normalizedNodeId);

        RegisteredNodeEntity node = registeredNodeRepository.findByNodeId(normalizedNodeId)
                .orElseGet(() -> new RegisteredNodeEntity(normalizedNodeId, normalizedHostname));

        if (node.getPublicKey() != null && !node.getPublicKey().isBlank() && !node.getPublicKey().equals(normalizedPublicKey)) {
            throw new SecurityException("nodeId already registered with a different public key");
        }

        node.setHostname(normalizedHostname);
        node.setPublicKey(normalizedPublicKey);
        node.setStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
        node.setLastHeartbeat(LocalDateTime.now());
        return registeredNodeRepository.save(node);
    }

    private String requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
        return value.trim();
    }

    private PublicKey decodePublicKey(String publicKeyBase64) {
        try {
            byte[] publicKeyBytes = Base64.getDecoder().decode(publicKeyBase64);
            KeyFactory keyFactory = KeyFactory.getInstance("Ed25519");
            return keyFactory.generatePublic(new X509EncodedKeySpec(publicKeyBytes));
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid publicKey format", e);
        }
    }

    private void verifySignature(PublicKey publicKey, String signatureBase64, String message) {
        try {
            Signature signature = Signature.getInstance("Ed25519");
            signature.initVerify(publicKey);
            signature.update(message.getBytes(StandardCharsets.UTF_8));
            byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64);
            if (!signature.verify(signatureBytes)) {
                throw new SecurityException("Invalid node signature");
            }
        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to verify node signature", e);
        }
    }
}