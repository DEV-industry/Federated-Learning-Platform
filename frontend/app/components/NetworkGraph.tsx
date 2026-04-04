"use client";
import { useEffect, useRef, useState } from "react";

interface NodeActivity {
  [nodeId: string]: {
    status: string;
    detail: string;
  };
}

const STATUS_COLORS: Record<string, { fill: string; glow: string; label: string }> = {
  TRAINING: { fill: "#5e72e4", glow: "#5e72e430", label: "Training" },
  DOWNLOADING: { fill: "#8b5cf6", glow: "#8b5cf630", label: "Downloading" },
  UPLOADING: { fill: "#fb6340", glow: "#fb634030", label: "Uploading" },
  EVALUATING: { fill: "#2dce89", glow: "#2dce8930", label: "Evaluating" },
  IDLE: { fill: "#8898aa", glow: "#8898aa20", label: "Idle" },
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

      // Draw connection lines
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
          ctx.strokeStyle = "#e9ecef";
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

        const grad = ctx.createRadialGradient(x, y, 0, x, y, 10);
        grad.addColorStop(0, p.color + "40");
        grad.addColorStop(1, p.color + "00");
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        return true;
      });

      // Draw center hub
      const hubPulse = Math.sin(timeRef.current * 3) * 0.08 + 1;
      const hubRadius = 26 * hubPulse;
      const isAggregating = globalStage === "AGGREGATING";

      const hubShadow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, hubRadius * 2);
      hubShadow.addColorStop(0, isAggregating ? "#5e72e420" : "#5e72e415");
      hubShadow.addColorStop(1, "#00000000");
      ctx.beginPath();
      ctx.arc(centerX, centerY, hubRadius * 2, 0, Math.PI * 2);
      ctx.fillStyle = hubShadow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, hubRadius, 0, Math.PI * 2);
      ctx.fillStyle = isAggregating ? "#5e72e4" : "#5e72e4";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(centerX, centerY, hubRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "#7c8ce4";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 15px 'Open Sans', system-ui, sans-serif";
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

        if (isActive) {
          const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, nodeRadius * 2);
          glow.addColorStop(0, sc.glow);
          glow.addColorStop(1, "#00000000");
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, nodeRadius * 2, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
        if (isActive) {
          ctx.fillStyle = sc.fill;
        } else {
          ctx.fillStyle = "#f7fafc";
        }
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pos.x, pos.y, nodeRadius, 0, Math.PI * 2);
        ctx.strokeStyle = isActive ? sc.fill : "#e9ecef";
        ctx.lineWidth = isActive ? 2 : 1.5;
        ctx.stroke();

        const shortId = nodeId.length > 6 ? nodeId.substring(nodeId.length - 4) : nodeId;
        ctx.fillStyle = isActive ? "#ffffff" : "#8898aa";
        ctx.font = "bold 13px 'Open Sans', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(shortId, pos.x, pos.y);

        ctx.fillStyle = isActive ? sc.fill : "#8898aa";
        ctx.font = "11px 'Open Sans', system-ui, sans-serif";
        ctx.fillText(sc.label, pos.x, pos.y + nodeRadius + 16);

        if (act?.detail && isActive) {
          ctx.fillStyle = "#8898aa";
          ctx.font = "10px 'Open Sans', system-ui, sans-serif";
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
    <div className="argon-card overflow-hidden h-full flex flex-col">
      <div className="argon-card-header flex items-center justify-between flex-shrink-0">
        <h3 className="text-base font-bold text-argon-default">Network Topology</h3>
        <div className="flex items-center gap-3">
          {Object.entries(STATUS_COLORS).filter(([k]) => k !== "IDLE").map(([key, val]) => (
            <span key={key} className="flex items-center gap-1.5 text-[10px] text-argon-muted font-semibold">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: val.fill }} />
              {val.label}
            </span>
          ))}
        </div>
      </div>
      <div ref={containerRef} className="relative w-full bg-argon-bg/30 flex-1 min-h-[320px]">
        {nodeIds.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-argon-muted text-sm z-10">
            <span>No active nodes — waiting for connections...</span>
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}
