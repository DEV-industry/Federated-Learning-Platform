"use client";
import { useEffect, useState } from "react";
import Header from "@/app/components/Header";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { ShieldCheck, Loader2, Download, Upload, BarChart3, Pause, ZapOff } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

const ACTIVITY_BADGES: Record<string, { icon: any; label: string; className: string }> = {
  TRAINING: { icon: Loader2, label: "Training", className: "bg-argon-primary/10 text-argon-primary" },
  DOWNLOADING: { icon: Download, label: "Downloading", className: "bg-[#8b5cf6]/10 text-[#8b5cf6]" },
  UPLOADING: { icon: Upload, label: "Uploading", className: "bg-argon-warning/10 text-argon-warning" },
  EVALUATING: { icon: BarChart3, label: "Evaluating", className: "bg-argon-success/10 text-argon-success" },
  IDLE: { icon: Pause, label: "Idle", className: "bg-argon-lighter text-argon-muted" },
};

export default function NodesPage() {
  const [nodeDetails, setNodeDetails] = useState<any[]>([]);
  const [nodeActivity, setNodeActivity] = useState<Record<string, { status: string; detail: string }>>({});

  useEffect(() => {
    // Initial fetch
    fetch(`${API_URL}/api/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.nodeDetails) setNodeDetails(data.nodeDetails);
        if (data.nodeActivity) setNodeActivity(data.nodeActivity);
      })
      .catch((err) => console.error(err));

    // WebSocket connection
    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws-sockjs`),
      onConnect: () => {
        client.subscribe("/topic/updates", (message) => {
          if (message.body) {
            const data = JSON.parse(message.body);
            if (data.status?.nodeDetails) setNodeDetails(data.status.nodeDetails);
            if (data.nodeActivity) setNodeActivity(data.nodeActivity);
          }
        });
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, []);

  const handleDisconnect = async (nodeId: string) => {
    if (!confirm(`Are you sure you want to forcibly disconnect node ${nodeId}?`)) return;
    try {
      await fetch(`${API_URL}/api/nodes/unregister`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });
      // Refresh local state purely for immediate UX before WS catches up
      setNodeDetails(prev => prev.map(n => n.nodeId === nodeId ? { ...n, status: "DISCONNECTED" } : n));
    } catch (err) {
      console.error(err);
      alert("Failed to disconnect node.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
      case "Accepted": return <span className="argon-badge argon-badge-success">Active</span>;
      case "DISCONNECTED": return <span className="argon-badge argon-badge-danger">Disconnected</span>;
      case "STALE": return <span className="argon-badge argon-badge-warning">Stale</span>;
      case "LOCKED":
      case "BANNED": return <span className="argon-badge argon-badge-danger">Banned</span>;
      default: return <span className="argon-badge argon-badge-warning">{status}</span>;
    }
  };

  const getActivityBadge = (nodeId: string) => {
    const activity = nodeActivity?.[nodeId];
    if (!activity) return <span className="text-[0.6875rem] text-argon-muted">No activity</span>;
    const badge = ACTIVITY_BADGES[activity.status] || ACTIVITY_BADGES.IDLE;
    const Icon = badge.icon;
    const isAnimated = activity.status === "TRAINING" || activity.status === "DOWNLOADING" || activity.status === "UPLOADING";
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold ${badge.className}`}>
          <Icon className={`w-3 h-3 ${isAnimated ? "animate-spin" : ""}`} style={isAnimated ? { animationDuration: "1.5s" } : {}} />
          {badge.label}
        </span>
        {activity.detail && <span className="text-[10px] text-argon-muted pl-1 truncate max-w-[160px]" title={activity.detail}>{activity.detail}</span>}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl="#" title="Nodes Management" />
      
      <div className="argon-card overflow-hidden mt-2">
        <div className="argon-card-header flex items-center justify-between">
          <div>
             <h3 className="text-base font-bold text-argon-default">Connected Nodes Registry</h3>
             <p className="text-xs text-argon-muted mt-1">Manage and monitor active federated learning participants.</p>
          </div>
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider bg-argon-bg px-3 py-1.5 rounded-full">{nodeDetails.length} Registered</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-argon-lighter bg-argon-lighter/30">
                <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Node ID</th>
                <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Hostname</th>
                <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Status</th>
                <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Activity</th>
                <th className="text-right py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">DP Status</th>
                <th className="text-right py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {nodeDetails.length > 0 ? nodeDetails.map((node: any) => {
                const activity = nodeActivity?.[node.nodeId];
                const isActive = activity && activity.status !== "IDLE";
                return (
                  <tr key={node.nodeId} className={`border-b border-argon-lighter/50 transition-all duration-300 hover:bg-argon-bg/50 ${isActive ? "bg-argon-primary/[0.02]" : ""}`}>
                    <td className="py-5 px-6 font-mono text-[0.8125rem] text-argon-default font-semibold truncate max-w-[160px]" title={node.nodeId}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${node.status === 'ACTIVE' ? "bg-argon-success animate-pulse shadow-[0_0_6px_rgba(45,206,137,0.5)]" : "bg-argon-danger"}`} />
                        {node.nodeId}
                      </div>
                    </td>
                    <td className="py-5 px-6 font-mono text-[0.75rem] text-argon-muted">{node.hostname || "Unknown"}</td>
                    <td className="py-5 px-6">{getStatusBadge(node.status)}</td>
                    <td className="py-5 px-6">{getActivityBadge(node.nodeId)}</td>
                    <td className="py-5 px-6 text-right">
                      {node.dpEnabled ? <span className="argon-badge argon-badge-primary"><ShieldCheck className="w-3 h-3" /> Secured</span> : <span className="text-[0.6875rem] text-argon-light font-semibold">Off</span>}
                    </td>
                    <td className="py-5 px-6 text-right">
                      <button 
                        onClick={() => handleDisconnect(node.nodeId)}
                        disabled={node.status === 'DISCONNECTED'}
                        className={`inline-flex items-center justify-center p-2 rounded-argon transition-all shadow-argon-sm ${node.status === 'DISCONNECTED' ? "bg-argon-bg text-argon-light cursor-not-allowed" : "text-argon-danger hover:bg-argon-danger hover:text-white bg-argon-danger/10 cursor-pointer"}`}
                        title={node.status === 'DISCONNECTED' ? 'Already disconnected' : 'Disconnect Node'}
                      >
                        <ZapOff className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={6} className="py-12 text-center text-argon-muted text-sm font-semibold">No nodes have ever connected to this aggregator.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
