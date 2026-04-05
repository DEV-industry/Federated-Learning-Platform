package com.flplatform.aggregator.security;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class ApiRateLimitInterceptor implements HandlerInterceptor {

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

    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();

    private TokenBucket createNewBucket(String key) {
        // Strict limit: 5 requests per 10 seconds capacity
        return new TokenBucket(5, 10000, 5);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String path = request.getRequestURI();
        
        if (path.startsWith("/api/auth") || path.startsWith("/api/nodes/register") || path.startsWith("/api/nodes/heartbeat")) {
            String clientIp = request.getRemoteAddr();
            String key = clientIp + ":" + path;

            TokenBucket bucket = buckets.computeIfAbsent(key, this::createNewBucket);

            if (bucket.tryConsume()) {
                return true;
            } else {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"status\": \"error\", \"message\": \"Rate limit exceeded. Try again later.\"}");
                return false;
            }
        }
        
        return true;
    }
}