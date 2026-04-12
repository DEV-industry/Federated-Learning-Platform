"use client";
import { useEffect, useState, useMemo } from "react";
import Header from "@/app/components/Header";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  ShieldCheck, ShieldAlert, ShieldOff, Key, Lock, Fingerprint,
  AlertTriangle, CheckCircle2, XCircle, Clock, Server, Activity
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

const normalizeHistory = (input: any): any[] => {
  if (!Array.isArray(input)) return [];
  return [...input]
    .filter((item: any) => typeof item?.round === "number")
    .sort((a: any, b: any) => a.round - b.round);
};

// ==================================================================
// COLOR PALETTE
// ==================================================================
const COLORS = {
  accepted: "#2dce89",
  rejected: "#f5365c",
  heBlind: "#5e72e4",
  fallback: "#fb6340",
  pending: "#adb5bd",
};

const PIE_COLORS = [COLORS.accepted, COLORS.rejected, COLORS.heBlind, COLORS.fallback, COLORS.pending];

export default function SecurityPage() {
  const [nodeDetails, setNodeDetails] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/status`).then((r) => r.json()),
      fetch(`${API_URL}/api/history`).then((r) => r.json()),
    ])
      .then(([statusData, historyData]) => {
        setStatus(statusData);
        if (statusData.nodeDetails) setNodeDetails(statusData.nodeDetails);
        setHistory(normalizeHistory(historyData));
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws-sockjs`),
      onConnect: () => {
        client.subscribe("/topic/updates", (message) => {
          if (message.body) {
            const data = JSON.parse(message.body);
            if (data.status) {
              setStatus(data.status);
              if (data.status.nodeDetails) setNodeDetails(data.status.nodeDetails);
            }
            if (Array.isArray(data.history)) {
              setHistory(normalizeHistory(data.history));
            }
          }
        });
      },
    });

    client.activate();
    return () => { client.deactivate(); };
  }, []);

  // ==================================================================
  // COMPUTED: Aggregation verdicts from history
  // ==================================================================
  const verdictStats = useMemo(() => {
    let accepted = 0, rejected = 0, heBlind = 0, fallback = 0;
    for (const round of history) {
      if (round.nodeStatuses) {
        for (const st of Object.values(round.nodeStatuses as Record<string, string>)) {
          if (st === "Accepted") accepted++;
          else if (st === "Accepted (HE Blind)") heBlind++;
          else if (st === "Accepted (Fallback)") fallback++;
          else if (st.includes("Accepted")) accepted++;
          else rejected++;
        }
      }
    }
    return { accepted, rejected, heBlind, fallback, total: accepted + rejected + heBlind + fallback };
  }, [history]);

  const verdictPieData = useMemo(() => {
    const data = [];
    if (verdictStats.accepted > 0) data.push({ name: "Accepted (Krum)", value: verdictStats.accepted });
    if (verdictStats.rejected > 0) data.push({ name: "Rejected", value: verdictStats.rejected });
    if (verdictStats.heBlind > 0) data.push({ name: "Accepted (HE Blind)", value: verdictStats.heBlind });
    if (verdictStats.fallback > 0) data.push({ name: "Accepted (Fallback)", value: verdictStats.fallback });
    return data;
  }, [verdictStats]);

  // ==================================================================
  // COMPUTED: Rejection timeline per round
  // ==================================================================
  const rejectionTimeline = useMemo(() => {
    return history.map((round) => {
      let accepted = 0, rejected = 0;
      if (round.nodeStatuses) {
        for (const st of Object.values(round.nodeStatuses as Record<string, string>)) {
          if (st.includes("Accepted")) accepted++;
          else rejected++;
        }
      }
      return { round: round.round, Accepted: accepted, Rejected: rejected };
    });
  }, [history]);

  // ==================================================================
  // COMPUTED: Node threat level
  // ==================================================================
  const nodeThreatAssessment = useMemo(() => {
    return nodeDetails.map((node) => {
      const rejections = node.rejectedRounds || 0;
      let threatLevel: "none" | "low" | "medium" | "high" = "none";
      if (rejections >= 5) threatLevel = "high";
      else if (rejections >= 2) threatLevel = "medium";
      else if (rejections >= 1) threatLevel = "low";

      return {
        ...node,
        threatLevel,
        rejections,
      };
    }).sort((a, b) => b.rejections - a.rejections);
  }, [nodeDetails]);

  // ==================================================================
  // COMPUTED: Security posture summary
  // ==================================================================
  const securityPosture = useMemo(() => {
    const heEnabled = status?.dynamicHyperparameters?.dpEnabled !== undefined;
    const dpActive = status?.dynamicHyperparameters?.dpEnabled || false;
    const nodesWithKey = nodeDetails.filter((n) => n.hasPublicKey).length;
    const totalNodes = nodeDetails.length;
    const totalRejections = nodeDetails.reduce((acc: number, n: any) => acc + (n.rejectedRounds || 0), 0);

    return {
      dpActive,
      nodesWithKey,
      totalNodes,
      totalRejections,
      keyBindingRate: totalNodes > 0 ? Math.round((nodesWithKey / totalNodes) * 100) : 0,
    };
  }, [status, nodeDetails]);

  // ==================================================================
  // TOOLTIPS
  // ==================================================================
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="bg-argon-default text-white px-4 py-3 rounded-argon-lg text-sm shadow-argon-lg border border-white/10">
          <p className="font-bold mb-1">{entry.name}</p>
          <p className="text-argon-light">
            Count: <span className="text-white font-bold">{entry.value}</span>
          </p>
          <p className="text-argon-light">
            Share: <span className="text-white font-bold">{((entry.value / verdictStats.total) * 100).toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomTimelineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-argon-default text-white px-4 py-3 rounded-argon-lg text-sm shadow-argon-lg border border-white/10">
          <p className="font-bold text-argon-light text-xs mb-2">Round {label}</p>
          {payload.map((entry: any, i: number) => (
            <p key={i} className="flex items-center gap-2 text-xs font-semibold mb-0.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill || entry.color }} />
              <span className="text-argon-light">{entry.name}:</span>
              <span style={{ color: entry.fill || entry.color }}>{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // ==================================================================
  // THREAT LEVEL BADGE
  // ==================================================================
  const getThreatBadge = (level: string) => {
    switch (level) {
      case "high":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-red-500/10 text-red-500"><ShieldAlert className="w-3 h-3" />High Risk</span>;
      case "medium":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-orange-500/10 text-orange-500"><AlertTriangle className="w-3 h-3" />Medium</span>;
      case "low":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-yellow-500/10 text-yellow-500"><ShieldOff className="w-3 h-3" />Low</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-green-500/10 text-green-500"><ShieldCheck className="w-3 h-3" />Clear</span>;
    }
  };

  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl="#" title="Security Center" />

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-l-2 border-argon-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 mt-2">

          {/* ============ ROW 1: Security Posture KPI Cards ============ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

            {/* Aggregation Verdicts */}
            <div className="argon-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Aggregation Verdicts</span>
                <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg shadow-sm text-white">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-argon-default">{verdictStats.total}</p>
              <p className="text-xs text-argon-muted mt-1">
                <span className="text-argon-success font-bold">{verdictStats.accepted + verdictStats.heBlind + verdictStats.fallback}</span> accepted · <span className="text-argon-danger font-bold">{verdictStats.rejected}</span> rejected
              </p>
            </div>

            {/* Rejection Rate */}
            <div className="argon-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Rejection Rate</span>
                <div className={`p-2 rounded-lg shadow-sm text-white ${verdictStats.rejected > 0 ? "bg-gradient-to-br from-red-400 to-rose-500" : "bg-gradient-to-br from-green-400 to-emerald-500"}`}>
                  {verdictStats.rejected > 0 ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                </div>
              </div>
              <p className="text-2xl font-extrabold text-argon-default">
                {verdictStats.total > 0 ? ((verdictStats.rejected / verdictStats.total) * 100).toFixed(1) : "0.0"}%
              </p>
              <p className="text-xs text-argon-muted mt-1">{verdictStats.rejected} of {verdictStats.total} total verdicts</p>
            </div>

            {/* Key Binding */}
            <div className="argon-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Ed25519 Key Binding</span>
                <div className="p-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg shadow-sm text-white">
                  <Key className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-argon-default">{securityPosture.keyBindingRate}%</p>
              <p className="text-xs text-argon-muted mt-1">{securityPosture.nodesWithKey} / {securityPosture.totalNodes} nodes have bound keys</p>
            </div>

            {/* DP Status */}
            <div className="argon-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Differential Privacy</span>
                <div className={`p-2 rounded-lg shadow-sm text-white ${securityPosture.dpActive ? "bg-gradient-to-br from-cyan-400 to-blue-500" : "bg-gradient-to-br from-gray-300 to-gray-400"}`}>
                  <Lock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-extrabold text-argon-default">{securityPosture.dpActive ? "Active" : "Inactive"}</p>
              <p className="text-xs text-argon-muted mt-1">Gradient noise injection {securityPosture.dpActive ? "enabled" : "disabled"}</p>
            </div>
          </div>

          {/* ============ ROW 2: Verdict Distribution + Rejection Timeline ============ */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

            {/* Pie Chart: Verdict Distribution */}
            <div className="xl:col-span-2 argon-card overflow-hidden">
              <div className="argon-card-header flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm text-white">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-argon-default">Verdict Distribution</h3>
                  <p className="text-xs text-argon-muted mt-0.5">Breakdown of all aggregation security decisions.</p>
                </div>
              </div>
              <div className="p-6">
                {verdictPieData.length > 0 ? (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={verdictPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {verdictPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CustomPieTooltip />} />
                        <Legend
                          wrapperStyle={{ paddingTop: "16px", fontSize: "11px", fontWeight: "bold", color: "#8898aa" }}
                          formatter={(value: string) => <span className="text-argon-muted">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-[280px] w-full items-center justify-center">
                    <div className="text-center">
                      <Activity className="w-10 h-10 text-argon-light mx-auto mb-3 animate-pulse" />
                      <p className="text-argon-muted text-sm font-semibold">Awaiting aggregation rounds.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bar Chart: Rejection Timeline */}
            <div className="xl:col-span-3 argon-card overflow-hidden">
              <div className="argon-card-header flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-rose-400 to-red-500 rounded-lg shadow-sm text-white">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-argon-default">Rejection Timeline</h3>
                  <p className="text-xs text-argon-muted mt-0.5">Per-round view of accepted vs rejected node submissions.</p>
                </div>
              </div>
              <div className="p-6">
                {rejectionTimeline.length > 0 ? (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rejectionTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={20}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
                        <XAxis dataKey="round" tick={{ fill: "#8898aa", fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
                        <YAxis tick={{ fill: "#8898aa", fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <RechartsTooltip content={<CustomTimelineTooltip />} cursor={{ fill: "rgba(0,0,0,0.02)" }} />
                        <Legend wrapperStyle={{ paddingTop: "12px", fontSize: "11px", fontWeight: "bold" }} />
                        <Bar dataKey="Accepted" stackId="a" fill={COLORS.accepted} radius={[0, 0, 4, 4]} />
                        <Bar dataKey="Rejected" stackId="a" fill={COLORS.rejected} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex h-[280px] w-full items-center justify-center">
                    <div className="text-center">
                      <Activity className="w-10 h-10 text-argon-light mx-auto mb-3 animate-pulse" />
                      <p className="text-argon-muted text-sm font-semibold">Awaiting aggregation rounds.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ============ ROW 3: Node Threat Assessment Table ============ */}
          <div className="argon-card overflow-hidden">
            <div className="argon-card-header flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg shadow-sm text-white">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-argon-default">Node Threat Assessment</h3>
                  <p className="text-xs text-argon-muted mt-0.5">Threat level classification based on historical rejection count and credential status.</p>
                </div>
              </div>
              <span className="text-xs font-bold text-argon-muted uppercase tracking-wider bg-argon-bg px-3 py-1.5 rounded-full">
                {nodeThreatAssessment.filter((n) => n.threatLevel !== "none").length} flagged
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-argon-lighter bg-argon-lighter/30">
                    <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Node</th>
                    <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Threat Level</th>
                    <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Rejections</th>
                    <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Key Bound</th>
                    <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Auth Ver.</th>
                    <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">DP</th>
                    <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Client</th>
                    <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody>
                  {nodeThreatAssessment.length > 0 ? nodeThreatAssessment.map((node) => (
                    <tr
                      key={node.nodeId}
                      className={`border-b border-argon-lighter/50 transition-all duration-300 hover:bg-argon-bg/50 ${
                        node.threatLevel === "high" ? "bg-red-500/[0.03]" : node.threatLevel === "medium" ? "bg-orange-500/[0.03]" : ""
                      }`}
                    >
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                          <span className="font-mono text-[0.8125rem] font-semibold text-argon-default truncate max-w-[180px]" title={node.nodeId}>{node.nodeId}</span>
                          <span className="text-[10px] text-argon-light mt-0.5">{node.hostname || "—"} · {node.deviceOs || "Unknown OS"}</span>
                        </div>
                      </td>
                      <td className="py-5 px-6">{getThreatBadge(node.threatLevel)}</td>
                      <td className="py-5 px-6 text-center">
                        <span className={`font-bold text-sm ${node.rejections > 0 ? "text-argon-danger" : "text-argon-success"}`}>
                          {node.rejections}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-center">
                        {node.hasPublicKey ? (
                          <CheckCircle2 className="w-4 h-4 text-argon-success mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-argon-danger mx-auto" />
                        )}
                      </td>
                      <td className="py-5 px-6 text-center">
                        <span className="font-mono text-xs text-argon-muted font-bold">v{node.authVersion ?? 0}</span>
                      </td>
                      <td className="py-5 px-6 text-center">
                        {node.dpEnabled ? (
                          <span className="argon-badge argon-badge-primary"><ShieldCheck className="w-3 h-3" /></span>
                        ) : (
                          <span className="text-[0.6875rem] text-argon-light font-semibold">Off</span>
                        )}
                      </td>
                      <td className="py-5 px-6 text-xs text-argon-muted font-semibold">{node.clientVersion || "—"}</td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-1.5 text-xs text-argon-muted">
                          <Clock className="w-3 h-3" />
                          <span>{node.lastHeartbeat ? new Date(node.lastHeartbeat).toLocaleTimeString() : "—"}</span>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8} className="py-12 text-center text-argon-muted text-sm font-semibold">No nodes registered yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ============ ROW 4: Security Features Status ============ */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* TLS / gRPC */}
            <div className="argon-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg shadow-sm text-white">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-argon-default">Transport Security</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
                  <span className="text-sm text-argon-muted font-semibold">REST API</span>
                  <span className="argon-badge argon-badge-success">HTTPS / TLS 1.3</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
                  <span className="text-sm text-argon-muted font-semibold">gRPC Channel</span>
                  <span className="argon-badge argon-badge-success">mTLS Secured</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
                  <span className="text-sm text-argon-muted font-semibold">WebSocket</span>
                  <span className="argon-badge argon-badge-success">WSS / SockJS</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-argon-muted font-semibold">Node Auth</span>
                  <span className="argon-badge argon-badge-primary">Ed25519 + JWT</span>
                </div>
              </div>
            </div>

            {/* Aggregation Defense */}
            <div className="argon-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg shadow-sm text-white">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-argon-default">Aggregation Defense</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
                  <span className="text-sm text-argon-muted font-semibold">Strategy</span>
                  <span className="argon-badge argon-badge-primary">Bulyan (Multi-Krum)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
                  <span className="text-sm text-argon-muted font-semibold">Malicious Fraction</span>
                  <span className="text-sm font-bold text-argon-danger">{status?.maliciousFraction !== undefined ? (status.maliciousFraction * 100).toFixed(0) + "%" : "—"}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
                  <span className="text-sm text-argon-muted font-semibold">Gradient Clipping</span>
                  <span className="argon-badge argon-badge-success">L2 Norm ≤ 1.0</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-argon-muted font-semibold">Weight Validation</span>
                  <span className="argon-badge argon-badge-success">NaN / Inf Guard</span>
                </div>
              </div>
            </div>

            {/* Privacy Stack */}
            <div className="argon-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg shadow-sm text-white">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-argon-default">Privacy Stack</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
                  <span className="text-sm text-argon-muted font-semibold">Homomorphic Enc.</span>
                  <span className="argon-badge argon-badge-primary">TenSEAL CKKS</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
                  <span className="text-sm text-argon-muted font-semibold">HE Poly Degree</span>
                  <span className="text-sm font-bold text-argon-default">8192</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
                  <span className="text-sm text-argon-muted font-semibold">Security Level</span>
                  <span className="text-sm font-bold text-argon-default">~128-bit</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-argon-muted font-semibold">DP Mechanism</span>
                  <span className="argon-badge argon-badge-success">Gaussian Noise</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
