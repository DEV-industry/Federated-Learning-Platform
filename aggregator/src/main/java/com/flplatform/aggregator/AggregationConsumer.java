package com.flplatform.aggregator;

import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AggregationConsumer {

    @Autowired
    private MinioService minioService;

    @Autowired
    private AggregatorApplication aggregatorApplication;

    @RabbitListener(queues = RabbitMQConfig.QUEUE_NAME)
    public void consumeModelSubmission(ModelSubmissionMessage message) {
        System.out.println("Consuming ModelSubmissionMessage for node: " + message.getNodeId());
        try {
            // Download weights from MinIO asynchronously
            byte[] blob = minioService.downloadWeights(message.getModelPath());
            List<Double> weights = aggregatorApplication.deserializeWeights(blob);

            // Execute the FedAvg logic safely
            aggregatorApplication.processNodeSubmission(
                message.getNodeId(), 
                weights, 
                message.getLoss(), 
                message.getAccuracy(), 
                message.getDpEnabled()
            );

        } catch (Exception e) {
            System.err.println("Failed to process message for node " + message.getNodeId() + ": " + e.getMessage());
            e.printStackTrace();
        }
    }
}
