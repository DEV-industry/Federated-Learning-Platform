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
    private static final String ROTATE_MESSAGE_PREFIX = "node-key-rotate:";

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

        boolean publicKeyChanged = node.getPublicKey() != null
                && !node.getPublicKey().isBlank()
                && !node.getPublicKey().equals(normalizedPublicKey);

        if (publicKeyChanged) {
            System.out.println("Node re-authenticated with a rotated public key: " + normalizedNodeId);
            node.setAuthVersion(node.getAuthVersion() + 1);
        }

        node.setHostname(normalizedHostname);
        node.setPublicKey(normalizedPublicKey);
        node.setStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
        node.setLastHeartbeat(LocalDateTime.now());
        return registeredNodeRepository.save(node);
    }

    @Transactional
    public RegisteredNodeEntity rotateNodeKey(
            String nodeId,
            String hostname,
            String currentPublicKeyBase64,
            String currentSignatureBase64,
            String newPublicKeyBase64,
            String newSignatureBase64) {

        String normalizedNodeId = requireText(nodeId, "nodeId");
        String normalizedHostname = hostname == null || hostname.isBlank() ? "unknown" : hostname.trim();
        String normalizedCurrentPublicKey = requireText(currentPublicKeyBase64, "currentPublicKey");
        String normalizedCurrentSignature = requireText(currentSignatureBase64, "currentSignature");
        String normalizedNewPublicKey = requireText(newPublicKeyBase64, "newPublicKey");
        String normalizedNewSignature = requireText(newSignatureBase64, "newSignature");

        RegisteredNodeEntity node = registeredNodeRepository.findByNodeId(normalizedNodeId)
                .orElseThrow(() -> new SecurityException("nodeId is not registered"));

        if (node.getPublicKey() == null || node.getPublicKey().isBlank()) {
            throw new SecurityException("node does not have an active key bound");
        }
        if (!node.getPublicKey().equals(normalizedCurrentPublicKey)) {
            throw new SecurityException("currentPublicKey does not match the registered node key");
        }

        PublicKey currentPublicKey = decodePublicKey(normalizedCurrentPublicKey);
        PublicKey newPublicKey = decodePublicKey(normalizedNewPublicKey);
        String rotateMessage = ROTATE_MESSAGE_PREFIX + normalizedNodeId + ":" + normalizedNewPublicKey;

        verifySignature(currentPublicKey, normalizedCurrentSignature, rotateMessage);
        verifySignature(newPublicKey, normalizedNewSignature, rotateMessage);

        node.setPublicKey(normalizedNewPublicKey);
        node.setHostname(normalizedHostname);
        node.setStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);
        node.setLastHeartbeat(LocalDateTime.now());
        node.setAuthVersion(node.getAuthVersion() + 1);
        return registeredNodeRepository.save(node);
    }

    public boolean isJwtSessionValid(String nodeId, int authVersion) {
        if (nodeId == null || nodeId.isBlank()) {
            return false;
        }
        return registeredNodeRepository.findByNodeId(nodeId)
                .filter(node -> node.getStatus() == RegisteredNodeEntity.NodeStatus.ACTIVE)
                .filter(node -> node.getPublicKey() != null && !node.getPublicKey().isBlank())
                .filter(node -> node.getAuthVersion() == authVersion)
                .isPresent();
    }

    @Transactional
    public int revokeAllNodeCredentials() {
        int revokedCount = 0;
        for (RegisteredNodeEntity node : registeredNodeRepository.findAll()) {
            node.setStatus(RegisteredNodeEntity.NodeStatus.DISCONNECTED);
            node.setAuthVersion(node.getAuthVersion() + 1);
            registeredNodeRepository.save(node);
            revokedCount++;
        }
        return revokedCount;
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
            byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64);

            Signature signature = Signature.getInstance("Ed25519");
            signature.initVerify(publicKey);
            signature.update(message.getBytes(StandardCharsets.UTF_8));

            if (!signature.verify(signatureBytes)) {
                throw new SecurityException("Invalid node signature");
            }
        } catch (IllegalArgumentException e) {
            throw new SecurityException("Invalid node signature", e);
        } catch (SecurityException e) {
            throw e;
        } catch (Exception e) {
            throw new SecurityException("Failed to verify node signature", e);
        }
    }
}