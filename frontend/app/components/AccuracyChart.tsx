"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 text-white px-4 py-3 rounded-xl text-sm shadow-xl border border-gray-700">
        <p className="font-semibold text-gray-300 text-xs mb-1.5">Round {label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke }} />
            <span className="text-gray-400">{entry.name}:</span>
            <span className="font-bold">
              {entry.name === "Accuracy" ? `${(Number(entry.value) * 100).toFixed(2)}%` : Number(entry.value).toFixed(5)}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function AccuracyChart({ history }: { history: any[] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-gray-800">Accuracy History</h3>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Accuracy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Loss
          </span>
        </div>
      </div>
      <div className="h-[260px] w-full">
        {history.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <YAxis
                yAxisId="left"
                stroke="transparent"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toFixed(3)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="transparent"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => (value * 100).toFixed(0) + "%"}
              />
              <XAxis
                dataKey="round"
                stroke="transparent"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                dy={8}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                yAxisId="right"
                name="Accuracy"
                type="monotone"
                dataKey="accuracy"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={1200}
              />
              <Line
                yAxisId="left"
                name="Loss"
                type="monotone"
                dataKey="loss"
                stroke="#60a5fa"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#60a5fa", stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive={true}
                animationDuration={1200}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
            <div className="text-center">
              <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3 animate-pulse" />
              <p className="text-gray-400 text-sm font-medium">Awaiting training data...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
