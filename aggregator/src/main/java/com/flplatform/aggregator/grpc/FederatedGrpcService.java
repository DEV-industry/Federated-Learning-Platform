package com.flplatform.aggregator.grpc;

import com.flplatform.aggregator.AggregatorApplication;
import io.grpc.stub.StreamObserver;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

@GrpcService
public class FederatedGrpcService extends FederatedServiceGrpc.FederatedServiceImplBase {

    @Autowired
    private AggregatorApplication aggregatorContext;

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
                    request.getRoundNumber());

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
            GlobalModelResponse response = GlobalModelResponse.newBuilder()
                    .setCurrentRound(aggregatorContext.getCurrentRound())
                    .addAllGlobalWeights(aggregatorContext.getGlobalWeights())
                    .build();
            responseObserver.onNext(response);
            responseObserver.onCompleted();
        } catch (Exception e) {
            responseObserver.onError(io.grpc.Status.INTERNAL.withDescription(e.getMessage()).asRuntimeException());
        }
    }
}
