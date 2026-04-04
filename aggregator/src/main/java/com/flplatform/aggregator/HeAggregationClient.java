package com.flplatform.aggregator;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse.BodyHandlers;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class HeAggregationClient {

    public byte[] aggregate(String heSidecarUrl, byte[] heContextPublic, Map<String, byte[]> nodeEncryptedWeights) throws Exception {
        List<String> b64Blobs = new ArrayList<>();
        for (byte[] blob : nodeEncryptedWeights.values()) {
            b64Blobs.add(Base64.getEncoder().encodeToString(blob));
        }

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("pub_ctx", Base64.getEncoder().encodeToString(heContextPublic));
        requestBody.put("encrypted_blobs", b64Blobs);

        ObjectMapper mapper = new ObjectMapper();
        String jsonBody = mapper.writeValueAsString(requestBody);

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(heSidecarUrl + "/aggregate"))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofMinutes(10))
                .POST(BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("HE Sidecar failed with status " + response.statusCode() + ": " + response.body());
        }

        @SuppressWarnings("unchecked")
        Map<String, String> responseBody = mapper.readValue(response.body(), Map.class);
        return Base64.getDecoder().decode(responseBody.get("aggregated_blob"));
    }
}
