package com.flplatform.aggregator.security;

import io.grpc.Context;
import io.grpc.Contexts;
import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import org.springframework.stereotype.Component;
import net.devh.boot.grpc.server.interceptor.GrpcGlobalServerInterceptor;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@GrpcGlobalServerInterceptor
@Component
public class GrpcAuthInterceptor implements ServerInterceptor {

    private final JwtUtil jwtUtil;
    private final NodeCredentialService nodeCredentialService;

    public static final Context.Key<String> NODE_ID_CONTEXT_KEY = Context.key("nodeId");

    // Simple TokenBucket for gRPC rate limiting per Node
    private static class TokenBucket {
        private final int capacity;
        private final long refillIntervalMillis;
        private final int refillTokens;
        private final AtomicInteger tokens;
        private long lastRefillTimestamp;

        public TokenBucket(int capacity, long refillIntervalMillis, int refillTokens) {
            this.capacity = capacity;
            this.refillIntervalMillis = refillIntervalMillis;
            this.refillTokens = refillTokens;
            this.tokens = new AtomicInteger(capacity);
            this.lastRefillTimestamp = System.currentTimeMillis();
        }

        public synchronized boolean tryConsume() {
            refill();
            if (tokens.get() > 0) {
                tokens.decrementAndGet();
                return true;
            }
            return false;
        }

        private void refill() {
            long now = System.currentTimeMillis();
            long timePassed = now - lastRefillTimestamp;
            if (timePassed > refillIntervalMillis) {
                long tokensToAdd = (timePassed / refillIntervalMillis) * refillTokens;
                int newTokens = (int) Math.min((long) capacity, tokens.get() + tokensToAdd);
                tokens.set(newTokens);
                lastRefillTimestamp = now;
            }
        }
    }

    private final Map<String, TokenBucket> nodeBuckets = new ConcurrentHashMap<>();

    public GrpcAuthInterceptor(JwtUtil jwtUtil, NodeCredentialService nodeCredentialService) {
        this.jwtUtil = jwtUtil;
        this.nodeCredentialService = nodeCredentialService;
    }

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next) {

        String authHeader = headers.get(Metadata.Key.of("authorization", Metadata.ASCII_STRING_MARSHALLER));

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            JwtUtil.JwtPrincipal principal = jwtUtil.validateToken(token);

            if (principal != null && nodeCredentialService.isJwtSessionValid(principal.nodeId(), principal.authVersion())) {
                String nodeId = principal.nodeId();
                String method = call.getMethodDescriptor().getFullMethodName();

                // Rate limiting for SubmitWeights (to prevent spamming weights)
                if (method.contains("SubmitWeights")) {
                    TokenBucket bucket = nodeBuckets.computeIfAbsent(nodeId, k -> new TokenBucket(3, 60000, 3)); // 3 submissions per minute
                    if (!bucket.tryConsume()) {
                        call.close(Status.RESOURCE_EXHAUSTED.withDescription("Rate limit exceeded for weight submissions"), new Metadata());
                        return new ServerCall.Listener<ReqT>() {};
                    }
                }

                Context ctx = Context.current().withValue(NODE_ID_CONTEXT_KEY, nodeId);
                return Contexts.interceptCall(ctx, call, headers, next);
