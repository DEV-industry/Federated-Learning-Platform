package com.flplatform.aggregator.grpc;

import com.flplatform.aggregator.AggregatorCoordinator;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

@GrpcService
public class FederatedGrpcService extends FederatedServiceGrpc.FederatedServiceImplBase {

    @Autowired
    private AggregatorCoordinator aggregatorContext;

    @Override
    public void submitWeights(WeightRequest request, StreamObserver<WeightResponse> responseObserver) {
        String nodeId = request.getNodeId();
        
        // Use an empty list instead of null if weights are somehow absent
        List<Double> weights = request.getWeightsList();
        
        try {
            boolean success = aggregatorContext.validateAndQueueWeights(
                    nodeId,
                    weights,
                    request.getLoss(),
                    request.getAccuracy(),
                    request.getDpEnabled(),
                    request.getRoundNumber(),
                    request.getHeEnabled(),
                    request.getEncryptedWeights().toByteArray(),
                    request.getHeContextPublic().toByteArray());

            if (success) {
                WeightResponse response = WeightResponse.newBuilder()
                        .setStatus("success")
                        .setMessage("Weights received for " + nodeId + " and queued successfully via gRPC.")
                        .build();
                responseObserver.onNext(response);
                responseObserver.onCompleted();
            } else {
                WeightResponse response = WeightResponse.newBuilder()
                        .setStatus("error")
                        .setMessage("Weights validation failed (possibly outdated round or unregistered node).")
                        .build();
                responseObserver.onNext(response);
                // We complete normally with an error status in our payload, not an RPC failure, 
                // just like the REST logic used generic HTTP statuses.
                responseObserver.onCompleted();
            }
        } catch (Exception e) {
            responseObserver.onError(io.grpc.Status.INTERNAL.withDescription(e.getMessage()).asRuntimeException());
        }
    }

    @Override
    public void getGlobalModel(GlobalModelRequest request, StreamObserver<GlobalModelResponse> responseObserver) {
        try {
            GlobalModelResponse.Builder builder = GlobalModelResponse.newBuilder()
                    .setCurrentRound(aggregatorContext.getCurrentRound())
                    .setDpEnabled(aggregatorContext.isCurrentDpEnabled())
                    .setFedproxMu(aggregatorContext.getCurrentFedproxMu())
                    .setDpNoiseMultiplier(aggregatorContext.getCurrentDpNoiseMultiplier());
                    
            if (aggregatorContext.isHeGlobalModelAvailable()) {
                builder.setHeEnabled(true);
                builder.setEncryptedGlobalWeights(com.google.protobuf.ByteString.copyFrom(aggregatorContext.getHeGlobalWeights()));
            } else {
                builder.setHeEnabled(false);
                builder.addAllGlobalWeights(aggregatorContext.getGlobalWeights());
            }

            GlobalModelResponse response = builder.build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(io.grpc.Status.INTERNAL.withDescription(e.getMessage()).asRuntimeException());
        }
    }
}
