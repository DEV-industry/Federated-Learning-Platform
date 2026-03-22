"use client";
import { TrendingUp } from "lucide-react";

export default function NodeLocationsCard({ nodeDetails }: { nodeDetails: any[] }) {
  const totalNodes = nodeDetails.length || 0;
  const locations = [
    { flag: "🇺🇸", name: "United States", pct: 72 },
    { flag: "🇩🇪", name: "Germany", pct: 52 },
    { flag: "🇬🇧", name: "England", pct: 38 },
    { flag: "🇯🇵", name: "Japan", pct: 25 },
    { flag: "🇵🇱", name: "Poland", pct: 18 },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <h3 className="text-base font-semibold text-gray-800 mb-1">Node Locations</h3>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-4xl font-bold text-gray-800">{totalNodes}</span>
        <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">
          <TrendingUp className="w-3 h-3" /> Active
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-5">Connected clients by region</p>

      <div className="space-y-4">
        {locations.map((loc) => (
          <div key={loc.name} className="flex items-center gap-3">
            <span className="text-lg">{loc.flag}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{loc.name}</span>
                <span className="text-sm font-semibold text-gray-500">{loc.pct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${loc.pct}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
