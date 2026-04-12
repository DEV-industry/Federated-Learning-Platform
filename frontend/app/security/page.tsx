"use client";
import { useEffect, useState, useMemo } from "react";
import Header from "@/app/components/Header";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import SecurityKPICards from "./SecurityKPICards";
import VerdictPieChart from "./VerdictPieChart";
import RejectionTimeline from "./RejectionTimeline";
import NodeThreatTable from "./NodeThreatTable";
import SecurityFeatureCards from "./SecurityFeatureCards";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

const normalizeHistory = (input: any): any[] => {
  if (!Array.isArray(input)) return [];
  return [...input]
    .filter((item: any) => typeof item?.round === "number")
    .sort((a: any, b: any) => a.round - b.round);
};

export default function SecurityPage() {
  const [nodeDetails, setNodeDetails] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ── Data fetching + WebSocket ──────────────────────────────────
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

  // ── Computed data ──────────────────────────────────────────────
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

  const nodeThreatAssessment = useMemo(() => {
    return nodeDetails.map((node) => {
      const rejections = node.rejectedRounds || 0;
      let threatLevel: "none" | "low" | "medium" | "high" = "none";
      if (rejections >= 5) threatLevel = "high";
      else if (rejections >= 2) threatLevel = "medium";
      else if (rejections >= 1) threatLevel = "low";
      return { ...node, threatLevel, rejections };
    }).sort((a, b) => b.rejections - a.rejections);
  }, [nodeDetails]);

  const securityPosture = useMemo(() => {
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

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl="#" title="Security Center" />

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-l-2 border-argon-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 mt-2">
          <SecurityKPICards verdictStats={verdictStats} securityPosture={securityPosture} />

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <VerdictPieChart verdictPieData={verdictPieData} total={verdictStats.total} />
            <RejectionTimeline data={rejectionTimeline} />
          </div>

          <NodeThreatTable nodes={nodeThreatAssessment} />
          <SecurityFeatureCards maliciousFraction={status?.maliciousFraction} />
        </div>
      )}
    </div>
  );
}
