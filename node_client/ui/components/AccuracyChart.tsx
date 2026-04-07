"use client";
import { TrendingUp } from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";

interface AccuracyChartProps {
  data: Array<{ round: number; accuracy: number }>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="node-glass px-3 py-2 rounded-lg border border-node-border-light shadow-xl">
      <p className="text-[0.65rem] font-bold text-node-text-muted uppercase mb-1">Round {label}</p>
      <p className="text-sm font-bold text-argon-success">{(payload[0].value * 100).toFixed(2)}%</p>
    </div>
  );
};

export default function AccuracyChart({ data }: AccuracyChartProps) {
  return (
    <div className="node-card animate-slide-up">
      <div className="node-card-header">
        <div className="flex items-center gap-3">
          <div className="node-icon-badge bg-gradient-to-br from-argon-success to-[#2dceb1] shadow-md shadow-argon-success/20">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-node-text-primary">Model Accuracy</h3>
            <p className="text-[0.65rem] text-node-text-muted mt-0.5">Model evaluation on your private local dataset</p>
          </div>
        </div>
        {data.length > 0 && (
          <div className="text-right">
            <p className="text-lg font-bold text-argon-success">{(data[data.length - 1].accuracy * 100).toFixed(1)}%</p>
            <p className="text-[0.6rem] text-node-text-muted uppercase">Latest</p>
          </div>
        )}
      </div>
      <div className="node-card-body">
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-node-border/50 flex items-center justify-center mx-auto mb-3 animate-pulse">
                <TrendingUp className="w-5 h-5 text-node-text-muted" />
              </div>
              <p className="text-xs text-node-text-muted">Waiting for training data...</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="accuracyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dce89" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2dce89" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2345" vertical={false} />
              <XAxis
                dataKey="round"
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={{ stroke: "#1e2345" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                domain={[0, 1]}
                tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="accuracy"
                stroke="#2dce89"
                strokeWidth={2}
                fill="url(#accuracyGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#2dce89", stroke: "#0a0d1a", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
