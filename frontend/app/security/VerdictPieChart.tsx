"use client";
import {
  PieChart, Pie, Cell, Legend, Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import { Fingerprint, Activity } from "lucide-react";

const PIE_COLORS = ["#2dce89", "#f5365c", "#5e72e4", "#fb6340", "#adb5bd"];

interface Props {
  verdictPieData: { name: string; value: number }[];
  total: number;
}

export default function VerdictPieChart({ verdictPieData, total }: Props) {
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
            Share: <span className="text-white font-bold">{((entry.value / total) * 100).toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
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
  );
}
