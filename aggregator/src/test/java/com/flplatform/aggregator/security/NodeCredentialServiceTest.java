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