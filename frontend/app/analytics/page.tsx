"use client";
import { useEffect, useState, useMemo } from "react";
import Header from "@/app/components/Header";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from "recharts";
import { Activity, TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

const normalizeHistory = (input: any): any[] => {
  if (!Array.isArray(input)) return [];
  return [...input]
    .filter((item: any) => typeof item?.round === "number")
    .sort((a: any, b: any) => a.round - b.round);
};

export default function AnalyticsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Initial fetch
    fetch(`${API_URL}/api/history`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(normalizeHistory(data));
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });

    // WebSocket connection for real-time history updates
    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws-sockjs`),
      onConnect: () => {
        client.subscribe("/topic/updates", (message) => {
          if (message.body) {
            const data = JSON.parse(message.body);
            if (Array.isArray(data.history)) {
              setHistory(normalizeHistory(data.history));
            }
          }
        });
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, []);

  // Compute Node Reliability Map
  const nodeAuditData = useMemo(() => {
    const auditMap: Record<string, { accepted: number; rejected: number }> = {};
    for (const round of history) {
      if (round.nodeStatuses) {
        for (const [nodeId, status] of Object.entries(round.nodeStatuses)) {
          if (!auditMap[nodeId]) auditMap[nodeId] = { accepted: 0, rejected: 0 };
          if (status === "Accepted" || status === "Accepted (HE Blind)" || status.includes("Accepted")) {
            auditMap[nodeId].accepted++;
          } else {
            auditMap[nodeId].rejected++;
          }
        }
      }
    }
    return Object.keys(auditMap).map((nodeId) => ({
      nodeId,
      Accepted: auditMap[nodeId].accepted,
      Rejected: auditMap[nodeId].rejected,
      // used for sorting or displaying percentage
      _total: auditMap[nodeId].accepted + auditMap[nodeId].rejected
    })).sort((a, b) => b._total - a._total);
  }, [history]);

  // Tooltips for Line Charts
  const CustomAccuracyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-argon-default text-white px-4 py-3 rounded-argon-lg text-sm shadow-argon-lg border border-white/10">
          <p className="font-bold text-argon-light text-xs mb-1.5">Round {label}</p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#5e72e4]" />
            <span className="text-argon-light">Accuracy:</span>
            <span className="font-bold text-[#5e72e4]">
              {(Number(payload[0].value) * 100).toFixed(2)}%
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLossTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-argon-default text-white px-4 py-3 rounded-argon-lg text-sm shadow-argon-lg border border-white/10">
          <p className="font-bold text-argon-light text-xs mb-1.5">Round {label}</p>
          <p className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#11cdef]" />
            <span className="text-argon-light">Loss:</span>
            <span className="font-bold text-[#11cdef]">
              {Number(payload[0].value).toFixed(5)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  // Tooltip for Bar Chart
  const CustomAuditTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-argon-default text-white px-4 py-3 rounded-argon-lg text-sm shadow-argon-lg border border-white/10">
          <p className="font-bold text-argon-light text-xs mb-2">Node: {label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="flex items-center justify-between gap-4 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5 text-argon-light">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                {entry.name}
              </span>
              <span style={{ color: entry.fill }}>{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderEmptyState = (message: string) => (
    <div className="flex h-[300px] w-full items-center justify-center rounded-argon bg-argon-bg/50">
      <div className="text-center">
        <Activity className="w-10 h-10 text-argon-light mx-auto mb-3 animate-pulse" />
        <p className="text-argon-muted text-sm font-semibold">{message}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl="#" title="Advanced Analytics" />

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-l-2 border-argon-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 mt-2">
          
          {/* Top Row: Two huge charts (Accuracy & Loss) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* Accuracy Chart */}
            <div className="argon-card overflow-hidden">
              <div className="argon-card-header flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm text-white">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-argon-default">Global Accuracy Progression</h3>
                    <p className="text-xs text-argon-muted mt-0.5">Model correctness measured over each round.</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {history.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
                        <YAxis 
                          tick={{ fill: "#8898aa", fontSize: 11 }} tickLine={false} axisLine={false} 
                          domain={[0, 1]} tickFormatter={(val) => (val * 100).toFixed(0) + "%"} 
                        />
                        <XAxis dataKey="round" tick={{ fill: "#8898aa", fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
                        <RechartsTooltip content={<CustomAccuracyTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.05)', strokeWidth: 2 }} />
                        <Line
                          type="monotone"
                          dataKey="accuracy"
                          stroke="#5e72e4"
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 5, fill: "#5e72e4", stroke: "#fff", strokeWidth: 2 }}
                          isAnimationActive={true}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : renderEmptyState("Awaiting training rounds to plot accuracy.")}
              </div>
            </div>

            {/* Loss Chart */}
            <div className="argon-card overflow-hidden">
              <div className="argon-card-header flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg shadow-sm text-white">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-argon-default">Global Loss Convergence</h3>
                    <p className="text-xs text-argon-muted mt-0.5">Minimization of the cost function across training.</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {history.length > 0 ? (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
                        <YAxis 
                          tick={{ fill: "#8898aa", fontSize: 11 }} tickLine={false} axisLine={false} 
                          tickFormatter={(val) => val.toFixed(2)} 
                        />
                        <XAxis dataKey="round" tick={{ fill: "#8898aa", fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
                        <RechartsTooltip content={<CustomLossTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.05)', strokeWidth: 2 }} />
                        <Line
                          type="monotone"
                          dataKey="loss"
                          stroke="#11cdef"
                          strokeWidth={3}
                          dot={false}
                          activeDot={{ r: 5, fill: "#11cdef", stroke: "#fff", strokeWidth: 2 }}
                          isAnimationActive={true}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : renderEmptyState("Awaiting training rounds to plot loss.")}
              </div>
            </div>

          </div>

          {/* Bottom Row: Node Audit Risk Profile */}
          <div className="argon-card overflow-hidden">
            <div className="argon-card-header flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg shadow-sm text-white">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-argon-default">Node Reliability Audit & Security Rejections</h3>
                  <p className="text-xs text-argon-muted mt-0.5">Stacked breakdown of secure aggregation (e.g. Bulyan) acceptances and rejections per node historically.</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {nodeAuditData.length > 0 ? (
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={nodeAuditData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }} barSize={35}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
                      <XAxis dataKey="nodeId" tick={{ fill: "#8898aa", fontSize: 11, fontWeight: "bold" }} tickLine={false} axisLine={false} dy={10} />
                      <YAxis tick={{ fill: "#8898aa", fontSize: 11 }} tickLine={false} axisLine={false} />
                      <RechartsTooltip content={<CustomAuditTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                      <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold', color: '#8898aa' }} />
                      
                      <Bar dataKey="Accepted" stackId="a" fill="#2dce89" radius={[0, 0, 4, 4]} />
                      <Bar dataKey="Rejected" stackId="a" fill="#f5365c" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : renderEmptyState("Insufficient history to calculate node reliability audits.")}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
