"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-argon-default text-white px-4 py-3 rounded-argon-lg text-sm shadow-argon-lg border border-white/10">
        <p className="font-bold text-argon-light text-xs mb-1.5">Round {label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.stroke }} />
            <span className="text-argon-light">{entry.name}:</span>
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
  const latestAccuracy = history.length > 0 ? (history[history.length - 1].accuracy * 100).toFixed(1) : "0.0";

  return (
    <div className="argon-card overflow-hidden h-full flex flex-col">
      {/* Card Header */}
      <div className="argon-card-header flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="text-base font-bold text-argon-default">Training Overview</h3>
          <p className="text-[0.8125rem] text-argon-muted mt-0.5">
            <span className="text-argon-success font-semibold">↑ {latestAccuracy}%</span> accuracy this session
          </p>
        </div>
        <div className="flex items-center gap-4 text-[0.6875rem]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-argon-primary" /> Accuracy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-argon-info" /> Loss
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="argon-card-body flex-1 flex flex-col">
        <div className="flex-1 min-h-[280px] w-full">
          {history.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" vertical={false} />
                <YAxis
                  yAxisId="left"
                  stroke="transparent"
                  tick={{ fill: "#8898aa", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => value.toFixed(3)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="transparent"
                  tick={{ fill: "#8898aa", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => (value * 100).toFixed(0) + "%"}
                />
                <XAxis
                  dataKey="round"
                  stroke="transparent"
                  tick={{ fill: "#8898aa", fontSize: 11 }}
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
                  stroke="#5e72e4"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: "#5e72e4", stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive={true}
                  animationDuration={1200}
                />
                <Line
                  yAxisId="left"
                  name="Loss"
                  type="monotone"
                  dataKey="loss"
                  stroke="#11cdef"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: "#11cdef", stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive={true}
                  animationDuration={1200}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-argon bg-argon-bg/50">
              <div className="text-center">
                <Activity className="w-10 h-10 text-argon-light mx-auto mb-3 animate-pulse" />
                <p className="text-argon-muted text-sm font-semibold">Awaiting training data...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
