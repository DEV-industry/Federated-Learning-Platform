package com.flplatform.aggregator;

public class ModelSubmissionMessage {
    private String nodeId;
    private String modelPath;
    private Double loss;
    private Double accuracy;
    private Boolean dpEnabled;

    public ModelSubmissionMessage() {}

    public ModelSubmissionMessage(String nodeId, String modelPath, Double loss, Double accuracy, Boolean dpEnabled) {
        this.nodeId = nodeId;
        this.modelPath = modelPath;
        this.loss = loss;
        this.accuracy = accuracy;
        this.dpEnabled = dpEnabled;
    }

    public String getNodeId() { return nodeId; }
    public void setNodeId(String nodeId) { this.nodeId = nodeId; }

    public String getModelPath() { return modelPath; }
    public void setModelPath(String modelPath) { this.modelPath = modelPath; }

    public Double getLoss() { return loss; }
    public void setLoss(Double loss) { this.loss = loss; }

    public Double getAccuracy() { return accuracy; }
    public void setAccuracy(Double accuracy) { this.accuracy = accuracy; }

    public Boolean getDpEnabled() { return dpEnabled; }
    public void setDpEnabled(Boolean dpEnabled) { this.dpEnabled = dpEnabled; }
}
