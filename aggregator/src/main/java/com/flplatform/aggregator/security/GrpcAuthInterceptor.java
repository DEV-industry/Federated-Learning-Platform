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

@GrpcGlobalServerInterceptor
@Component
public class GrpcAuthInterceptor implements ServerInterceptor {

    private final JwtUtil jwtUtil;
    private final NodeCredentialService nodeCredentialService;

    public static final Context.Key<String> NODE_ID_CONTEXT_KEY = Context.key("nodeId");

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
                Context ctx = Context.current().withValue(NODE_ID_CONTEXT_KEY, principal.nodeId());
                return Contexts.interceptCall(ctx, call, headers, next);
            }
        }

        call.close(Status.UNAUTHENTICATED.withDescription("Invalid or missing JWT token"), new Metadata());
        return new ServerCall.Listener<ReqT>() {};
    }
}
