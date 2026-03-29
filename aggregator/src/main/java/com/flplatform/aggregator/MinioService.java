package com.flplatform.aggregator;

import io.minio.*;
import io.minio.messages.Item;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;

@Service
public class MinioService {

    private MinioClient minioClient;

    @Value("${minio.url}")
    private String minioUrl;

    @Value("${minio.access-key}")
    private String accessKey;

    @Value("${minio.secret-key}")
    private String secretKey;

    @Value("${minio.bucket}")
    private String bucket;

    @PostConstruct
    public void init() {
        this.minioClient = MinioClient.builder()
                .endpoint(minioUrl)
                .credentials(accessKey, secretKey)
                .build();

        int maxRetries = 10;
        int delayMs = 3000;

        for (int i = 0; i < maxRetries; i++) {
            try {
                boolean exists = minioClient.bucketExists(
                        BucketExistsArgs.builder().bucket(bucket).build());
                if (!exists) {
                    minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
                    System.out.println("MinIO bucket created: " + bucket);
                } else {
                    System.out.println("MinIO bucket already exists: " + bucket);
                }
                return; // Success
            } catch (Exception e) {
                System.out.println("MinIO not ready (attempt " + (i + 1) + "/" + maxRetries + "): " + e.getMessage());
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted while waiting for MinIO", ie);
                }
            }
        }
        throw new RuntimeException("Failed to initialize MinIO bucket after " + maxRetries + " attempts");
    }

    /**
     * Upload serialized weight bytes to MinIO.
     *
     * @param objectName the object key (e.g. "models/round-5.bin")
     * @param data       the serialized weight bytes
     */
    public void uploadWeights(String objectName, byte[] data) {
        try {
            ByteArrayInputStream stream = new ByteArrayInputStream(data);
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectName)
                            .stream(stream, data.length, -1)
                            .contentType("application/octet-stream")
                            .build());
            System.out.println("Uploaded weights to MinIO: " + objectName + " (" + data.length + " bytes)");
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload weights to MinIO: " + e.getMessage(), e);
        }
    }

    /**
     * Download serialized weight bytes from MinIO.
     *
     * @param objectName the object key
     * @return the raw bytes
     */
    public byte[] downloadWeights(String objectName) {
        try {
            GetObjectResponse response = minioClient.getObject(
                    GetObjectArgs.builder()
                            .bucket(bucket)
                            .object(objectName)
                            .build());
            byte[] data = response.readAllBytes();
            response.close();
            System.out.println("Downloaded weights from MinIO: " + objectName + " (" + data.length + " bytes)");
            return data;
        } catch (Exception e) {
            throw new RuntimeException("Failed to download weights from MinIO: " + e.getMessage(), e);
        }
    }

    /**
     * Delete all objects in the bucket (used during training reset).
     */
    public void deleteAllObjects() {
        try {
            Iterable<Result<Item>> objects = minioClient.listObjects(
                    ListObjectsArgs.builder().bucket(bucket).recursive(true).build());
            for (Result<Item> result : objects) {
                Item item = result.get();
                minioClient.removeObject(
                        RemoveObjectArgs.builder()
                                .bucket(bucket)
                                .object(item.objectName())
                                .build());
                System.out.println("Deleted MinIO object: " + item.objectName());
            }
            System.out.println("All objects deleted from MinIO bucket: " + bucket);
        } catch (Exception e) {
            System.err.println("Failed to delete MinIO objects: " + e.getMessage());
        }
    }
}
