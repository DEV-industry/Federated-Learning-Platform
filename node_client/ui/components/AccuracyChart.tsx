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
    <div className="bg-white px-3 py-2 rounded-lg shadow-[0_0_2rem_0_rgba(136,152,170,0.15)]">
      <p className="text-[0.65rem] font-bold text-argon-muted uppercase mb-1">Round {label}</p>
      <p className="text-sm font-bold text-argon-success">{(payload[0].value * 100).toFixed(2)}%</p>
    </div>
  );
};

export default function AccuracyChart({ data }: AccuracyChartProps) {
  return (
    <div className="argon-card">
      <div className="argon-card-header">
        <div className="flex items-center gap-3">
          <div className="argon-icon-badge bg-gradient-to-br from-argon-success to-[#2dceb1]">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-argon-default">Model Accuracy</h3>
            <p className="text-[0.65rem] text-argon-muted mt-0.5">Model evaluation on your private local dataset</p>
          </div>
        </div>
        {data.length > 0 && (
          <div className="text-right">
            <p className="text-lg font-bold text-argon-success">{(data[data.length - 1].accuracy * 100).toFixed(1)}%</p>
            <p className="text-[0.6rem] text-argon-muted uppercase">Latest</p>
          </div>
        )}
      </div>
      <div className="argon-card-body">
        {data.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-argon-lighter flex items-center justify-center mx-auto mb-3 animate-pulse">
                <TrendingUp className="w-5 h-5 text-argon-muted" />
              </div>
              <p className="text-xs text-argon-muted">Waiting for training data...</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
              <XAxis
                dataKey="round"
                tick={{ fill: "#8898aa", fontSize: 10 }}
                axisLine={{ stroke: "#e9ecef" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#8898aa", fontSize: 10 }}
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
                activeDot={{ r: 4, fill: "#2dce89", stroke: "#ffffff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
