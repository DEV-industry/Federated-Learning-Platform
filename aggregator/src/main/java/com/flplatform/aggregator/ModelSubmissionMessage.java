package com.flplatform.aggregator;

public class ModelSubmissionMessage {
    private String nodeId;
    private String modelPath;
    private Double loss;
    private Double accuracy;
    private Boolean dpEnabled;
    private Integer roundNumber;
    private Boolean heEnabled;
    private String heContextPath;

    public ModelSubmissionMessage() {}

    public ModelSubmissionMessage(String nodeId, String modelPath, Double loss, Double accuracy, Boolean dpEnabled, Integer roundNumber, Boolean heEnabled, String heContextPath) {
        this.nodeId = nodeId;
        this.modelPath = modelPath;
        this.loss = loss;
        this.accuracy = accuracy;
        this.dpEnabled = dpEnabled;
        this.roundNumber = roundNumber;
        this.heEnabled = heEnabled;
        this.heContextPath = heContextPath;
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

    public Boolean getHeEnabled() { return heEnabled != null ? heEnabled : false; }
    public void setHeEnabled(Boolean heEnabled) { this.heEnabled = heEnabled; }

    public String getHeContextPath() { return heContextPath; }
    public void setHeContextPath(String heContextPath) { this.heContextPath = heContextPath; }
}
