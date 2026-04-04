package com.flplatform.aggregator;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class LiveActivityTracker {

    private static final int MAX_EVENT_LOGS = 50;
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm:ss");

    private final Map<String, Map<String, String>> nodeActivity = new ConcurrentHashMap<>();
    private final LinkedList<String> eventLogs = new LinkedList<>();
    private volatile String globalStage = "IDLE";

    public void recordActivity(String nodeId, String status, String detail) {
        Map<String, String> activity = new HashMap<>();
        activity.put("status", status);
        activity.put("detail", detail);
        nodeActivity.put(nodeId, activity);

        switch (status) {
            case "DOWNLOADING":
                addEventLog("\uD83D\uDCE5 " + nodeId + " is downloading global model");
                break;
            case "TRAINING":
                if (!detail.isEmpty()) {
                    addEventLog("\u26A1 " + nodeId + " training: " + detail);
                } else {
                    addEventLog("\uD83D\uDD04 " + nodeId + " started local training");
                }
                break;
            case "UPLOADING":
                addEventLog("\u2B06\uFE0F " + nodeId + " is uploading weights via gRPC");
                break;
            case "IDLE":
                addEventLog("\u23F8\uFE0F " + nodeId + " is idle, waiting for next round");
                break;
            case "EVALUATING":
                addEventLog("\uD83D\uDCCA " + nodeId + " is evaluating model accuracy");
                break;
            default:
                addEventLog("\u2139\uFE0F " + nodeId + ": " + status + (detail.isEmpty() ? "" : " (" + detail + ")"));
        }

        updateGlobalStage();
    }

    public void addEventLog(String message) {
        String timestamp = LocalDateTime.now().format(TIME_FMT);
        String entry = "[" + timestamp + "] " + message;
        synchronized (eventLogs) {
            eventLogs.addLast(entry);
            while (eventLogs.size() > MAX_EVENT_LOGS) {
                eventLogs.removeFirst();
            }
        }
    }

    public void clearNodeActivities() {
        nodeActivity.clear();
    }

    public void clearAll() {
        nodeActivity.clear();
        synchronized (eventLogs) {
            eventLogs.clear();
        }
        globalStage = "IDLE";
    }

    public boolean hasNodeActivity(String nodeId) {
        return nodeActivity.containsKey(nodeId);
    }

    public Map<String, String> getNodeActivity(String nodeId) {
        return nodeActivity.get(nodeId);
    }

    public Map<String, Map<String, String>> snapshotNodeActivity() {
        return new HashMap<>(nodeActivity);
    }

    public List<String> snapshotEventLogs() {
        synchronized (eventLogs) {
            return new ArrayList<>(eventLogs);
        }
    }

    public String getGlobalStage() {
        return globalStage;
    }

    public void setGlobalStage(String globalStage) {
        this.globalStage = globalStage;
    }

    private void updateGlobalStage() {
        if (nodeActivity.isEmpty()) {
            globalStage = "IDLE";
            return;
        }

        boolean anyTraining = false;
        boolean anyDownloading = false;
        boolean anyUploading = false;
        boolean anyEvaluating = false;

        for (Map<String, String> act : nodeActivity.values()) {
            String status = act.getOrDefault("status", "IDLE");
            switch (status) {
                case "TRAINING":
                    anyTraining = true;
                    break;
                case "DOWNLOADING":
                    anyDownloading = true;
                    break;
                case "UPLOADING":
                    anyUploading = true;
                    break;
                case "EVALUATING":
                    anyEvaluating = true;
                    break;
                default:
                    break;
            }
        }

        if (anyDownloading) {
            globalStage = "DISTRIBUTING";
        } else if (anyTraining) {
            globalStage = "TRAINING";
        } else if (anyEvaluating) {
            globalStage = "EVALUATING";
        } else if (anyUploading) {
            globalStage = "AGGREGATING";
        } else {
            globalStage = "IDLE";
        }
    }
}
