package com.flplatform.aggregator;

public class ModelSubmissionMessage {
    private String nodeId;
    private String modelPath;
    private Double loss;
    private Double accuracy;
    private Boolean dpEnabled;
    private Integer roundNumber;

    public ModelSubmissionMessage() {}

    public ModelSubmissionMessage(String nodeId, String modelPath, Double loss, Double accuracy, Boolean dpEnabled, Integer roundNumber) {
        this.nodeId = nodeId;
        this.modelPath = modelPath;
        this.loss = loss;
        this.accuracy = accuracy;
        this.dpEnabled = dpEnabled;
        this.roundNumber = roundNumber;
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

    public Integer getRoundNumber() { return roundNumber; }
    public void setRoundNumber(Integer roundNumber) { this.roundNumber = roundNumber; }
}
