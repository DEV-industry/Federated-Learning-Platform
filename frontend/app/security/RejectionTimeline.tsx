"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend
} from "recharts";
import { AlertTriangle, Activity } from "lucide-react";

const COLORS = { accepted: "#2dce89", rejected: "#f5365c" };

interface TimelineEntry {
  round: number;
  Accepted: number;
  Rejected: number;
}

interface Props {
  data: TimelineEntry[];
}

export default function RejectionTimeline({ data }: Props) {
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

  return (
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
        {data.length > 0 ? (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={20}>
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
  );
}
