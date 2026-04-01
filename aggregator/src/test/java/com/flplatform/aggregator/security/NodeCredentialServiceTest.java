package com.flplatform.aggregator.security;

import com.flplatform.aggregator.RegisteredNodeEntity;
import com.flplatform.aggregator.RegisteredNodeRepository;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.Signature;
import java.util.Base64;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class NodeCredentialServiceTest {

    @Test
    void shouldRegisterAndValidateNodePublicKey() throws Exception {
        RegisteredNodeRepository repository = mock(RegisteredNodeRepository.class);
        when(repository.findByNodeId("node-1")).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        NodeCredentialService nodeCredentialService = new NodeCredentialService(repository);

        KeyPair keyPair = generateKeyPair();
        String publicKeyBase64 = Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
        String signatureBase64 = signMessage(keyPair.getPrivate(), "node-auth:node-1");

        RegisteredNodeEntity node = nodeCredentialService.authenticateNode("node-1", "pod-1", publicKeyBase64, signatureBase64);

        assertEquals("node-1", node.getNodeId());
        assertEquals("pod-1", node.getHostname());
        assertEquals(publicKeyBase64, node.getPublicKey());
    }

    @Test
    void shouldRejectMismatchedPublicKeyForExistingNode() throws Exception {
        RegisteredNodeRepository repository = mock(RegisteredNodeRepository.class);
        RegisteredNodeEntity existingNode = new RegisteredNodeEntity("node-1", "pod-1");
        existingNode.setPublicKey("existing-public-key");
        when(repository.findByNodeId("node-1")).thenReturn(Optional.of(existingNode));

        NodeCredentialService nodeCredentialService = new NodeCredentialService(repository);

        KeyPair keyPair = generateKeyPair();
        String publicKeyBase64 = Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
        String signatureBase64 = signMessage(keyPair.getPrivate(), "node-auth:node-1");

        assertThrows(SecurityException.class, () -> nodeCredentialService.authenticateNode("node-1", "pod-1", publicKeyBase64, signatureBase64));
    }

    @Test
    void shouldRejectInvalidSignature() throws Exception {
        RegisteredNodeRepository repository = mock(RegisteredNodeRepository.class);
        when(repository.findByNodeId("node-1")).thenReturn(Optional.empty());

        NodeCredentialService nodeCredentialService = new NodeCredentialService(repository);

        KeyPair keyPair = generateKeyPair();
        String publicKeyBase64 = Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
        String invalidSignatureBase64 = Base64.getEncoder().encodeToString("invalid".getBytes(StandardCharsets.UTF_8));

        assertThrows(SecurityException.class, () -> nodeCredentialService.authenticateNode("node-1", "pod-1", publicKeyBase64, invalidSignatureBase64));
    }

    @Test
    void shouldRotateNodeKeyAndIncrementAuthVersion() throws Exception {
        RegisteredNodeRepository repository = mock(RegisteredNodeRepository.class);
        RegisteredNodeEntity existingNode = new RegisteredNodeEntity("node-1", "pod-1");

        KeyPair currentKeyPair = generateKeyPair();
        String currentPublicKey = Base64.getEncoder().encodeToString(currentKeyPair.getPublic().getEncoded());
        existingNode.setPublicKey(currentPublicKey);

        when(repository.findByNodeId("node-1")).thenReturn(Optional.of(existingNode));
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        NodeCredentialService nodeCredentialService = new NodeCredentialService(repository);

        KeyPair newKeyPair = generateKeyPair();
        String newPublicKey = Base64.getEncoder().encodeToString(newKeyPair.getPublic().getEncoded());
        String rotateMessage = "node-key-rotate:node-1:" + newPublicKey;

        String currentSignature = signMessage(currentKeyPair.getPrivate(), rotateMessage);
        String newSignature = signMessage(newKeyPair.getPrivate(), rotateMessage);

        RegisteredNodeEntity updatedNode = nodeCredentialService.rotateNodeKey(
                "node-1",
                "pod-2",
                currentPublicKey,
                currentSignature,
                newPublicKey,
                newSignature
        );

        assertEquals(newPublicKey, updatedNode.getPublicKey());
        assertEquals(1, updatedNode.getAuthVersion());
        assertEquals("pod-2", updatedNode.getHostname());
    }

    @Test
    void shouldValidateJwtSessionAgainstAuthVersionAndStatus() {
        RegisteredNodeRepository repository = mock(RegisteredNodeRepository.class);
        RegisteredNodeEntity node = new RegisteredNodeEntity("node-1", "pod-1");
        node.setPublicKey("pub");
        node.setAuthVersion(2);
        node.setStatus(RegisteredNodeEntity.NodeStatus.ACTIVE);

        when(repository.findByNodeId("node-1")).thenReturn(Optional.of(node));

        NodeCredentialService nodeCredentialService = new NodeCredentialService(repository);

        assertTrue(nodeCredentialService.isJwtSessionValid("node-1", 2));
        assertFalse(nodeCredentialService.isJwtSessionValid("node-1", 1));
    }

    private KeyPair generateKeyPair() throws Exception {
        KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("Ed25519");
        return keyPairGenerator.generateKeyPair();
    }

    private String signMessage(PrivateKey privateKey, String message) throws Exception {
        Signature signature = Signature.getInstance("Ed25519");
        signature.initSign(privateKey);
        signature.update(message.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(signature.sign());
    }
}