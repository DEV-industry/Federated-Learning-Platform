"use client";
import { useEffect, useRef, useState } from "react";

interface NodeActivity {
  [nodeId: string]: {
    status: string;
    detail: string;
  };
}

const STATUS_COLORS: Record<string, { fill: string; glow: string; label: string }> = {
  TRAINING: { fill: "#3b82f6", glow: "#3b82f630", label: "Training" },
  DOWNLOADING: { fill: "#8b5cf6", glow: "#8b5cf630", label: "Downloading" },
  UPLOADING: { fill: "#f59e0b", glow: "#f59e0b30", label: "Uploading" },
  EVALUATING: { fill: "#10b981", glow: "#10b98130", label: "Evaluating" },
  IDLE: { fill: "#9ca3af", glow: "#9ca3af20", label: "Idle" },
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.IDLE;
}

export default function NetworkGraph({
  nodeActivity,
  globalStage,
}: {
  nodeActivity: NodeActivity;
  globalStage: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Array<{
    fromIdx: number;
    progress: number;
    speed: number;
    toCenter: boolean;
    color: string;
  }>>([]);
  const timeRef = useRef(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const nodeIds = Object.keys(nodeActivity);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * 2;
        canvas.height = height * 2;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        setDimensions({ width: width * 2, height: height * 2 });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Spawn particles based on node activity
  useEffect(() => {
    const interval = setInterval(() => {
      nodeIds.forEach((nodeId, idx) => {
        const act = nodeActivity[nodeId];
        if (!act) return;
        const status = act.status;
        const color = getStatusColor(status);

        if (status === "UPLOADING") {
          if (Math.random() < 0.4) {
            particlesRef.current.push({
              fromIdx: idx,
              progress: 0,
              speed: 0.008 + Math.random() * 0.012,
              toCenter: true,
              color: color.fill,
            });
          }
        } else if (status === "DOWNLOADING") {
          if (Math.random() < 0.4) {
            particlesRef.current.push({
              fromIdx: idx,
              progress: 0,
              speed: 0.008 + Math.random() * 0.012,
              toCenter: false,
              color: color.fill,
            });
          }
        }
      });
      if (particlesRef.current.length > 100) {
        particlesRef.current = particlesRef.current.slice(-80);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [nodeIds, nodeActivity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.33;

    const getNodePos = (idx: number, total: number) => {
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      };
    };

    const draw = () => {
      timeRef.current += 0.016;
      ctx.clearRect(0, 0, width, height);

      const total = nodeIds.length || 1;

      // Draw connection lines (dashed for idle, solid for active)
      nodeIds.forEach((_, idx) => {
        const pos = getNodePos(idx, total);
        const act = nodeActivity[nodeIds[idx]];
        const status = act?.status || "IDLE";
        const sc = getStatusColor(status);

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(pos.x, pos.y);
        if (status === "IDLE") {
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = "#e5e7eb";
          ctx.lineWidth = 1;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = sc.fill + "35";
          ctx.lineWidth = 2;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.progress += p.speed;
        if (p.progress >= 1) return false;

        const pos = getNodePos(p.fromIdx, total);
        let x, y;
        if (p.toCenter) {
          x = pos.x + (centerX - pos.x) * p.progress;
          y = pos.y + (centerY - pos.y) * p.progress;
        } else {
          x = centerX + (pos.x - centerX) * p.progress;
          y = centerY + (pos.y - centerY) * p.progress;
        }

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Subtle glow
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 10);
        grad.addColorStop(0, p.color + "40");
        grad.addColorStop(1, p.color + "00");
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        return true;
      });

      // Draw center hub (Aggregator)
      const hubPulse = Math.sin(timeRef.current * 3) * 0.08 + 1;
      const hubRadius = 26 * hubPulse;
      const isAggregating = globalStage === "AGGREGATING";

      // Hub shadow
      const hubShadow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, hubRadius * 2);
      hubShadow.addColorStop(0, isAggregating ? "#8b5cf620" : "#3b82f615");
      hubShadow.addColorStop(1, "#00000000");
      ctx.beginPath();
      ctx.arc(centerX, centerY, hubRadius * 2, 0, Math.PI * 2);
      ctx.fillStyle = hubShadow;
      ctx.fill();

      // Hub circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, hubRadius, 0, Math.PI * 2);
      ctx.fillStyle = isAggregating ? "#7c3aed" : "#3b82f6";
      ctx.fill();

      // Hub border
      ctx.beginPath();
      ctx.arc(centerX, centerY, hubRadius, 0, Math.PI * 2);
      ctx.strokeStyle = isAggregating ? "#a78bfa" : "#60a5fa";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hub label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AGG", centerX, centerY);

      // Draw node circles
      nodeIds.forEach((nodeId, idx) => {
        const pos = getNodePos(idx, total);
        const act = nodeActivity[nodeId];
        const status = act?.status || "IDLE";
        const sc = getStatusColor(status);
        const isActive = status !== "IDLE";

        const nodePulse = isActive ? Math.sin(timeRef.current * 4 + idx) * 0.08 + 1 : 1;
        const nodeRadius = 18 * nodePulse;

        // Node shadow for active
        if (isActive) {
          const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nodeRadius * 2);
          glow.addColorStop(0, sc.glow);
          glow.addColorStop(1, "#00000000");
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, nodeRadius * 2, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
        if (isActive) {
          ctx.fillStyle = sc.fill;
        } else {
          ctx.fillStyle = "#f3f4f6";
        }
        ctx.fill();

        // Node border
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
        ctx.strokeStyle = isActive ? sc.fill : "#d1d5db";
        ctx.lineWidth = isActive ? 2 : 1.5;
        ctx.stroke();

        // Node label
        const shortId = nodeId.length > 6 ? nodeId.substring(nodeId.length - 4) : nodeId;
        ctx.fillStyle = isActive ? "#ffffff" : "#6b7280";
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(shortId, pos.x, pos.y);

        // Status label below
        ctx.fillStyle = isActive ? sc.fill : "#9ca3af";
        ctx.font = "11px system-ui, -apple-system, sans-serif";
        ctx.fillText(sc.label, pos.x, pos.y + nodeRadius + 16);

        // Detail text
        if (act?.detail && isActive) {
          ctx.fillStyle = "#9ca3af";
          ctx.font = "10px system-ui, -apple-system, sans-serif";
          const detailText = act.detail.length > 24 ? act.detail.substring(0, 24) + "…" : act.detail;
          ctx.fillText(detailText, pos.x, pos.y + nodeRadius + 30);
        }
      });

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [dimensions, nodeIds, nodeActivity, globalStage]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Network Topology</h3>
        <div className="flex items-center gap-3">
          {Object.entries(STATUS_COLORS).filter(([k]) => k !== "IDLE").map(([key, val]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: val.fill }} />
              {val.label}
            </span>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="relative w-full bg-gray-50/30" style={{ height: "320px" }}>
        {nodeIds.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm z-10">
            <span>No active nodes — waiting for connections...</span>
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}
