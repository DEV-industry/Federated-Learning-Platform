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
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header">
        <h3 className="text-base font-bold text-argon-default mb-1">Node Locations</h3>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-argon-default">{totalNodes}</span>
          <span className="argon-badge argon-badge-success">
            <TrendingUp className="w-3 h-3" /> Active
          </span>
        </div>
        <p className="text-xs text-argon-muted mt-1">Connected clients by region</p>
      </div>

      <div className="argon-card-body space-y-4">
        {locations.map((loc) => (
          <div key={loc.name} className="flex items-center gap-3">
            <span className="text-lg">{loc.flag}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-argon-default">{loc.name}</span>
                <span className="text-sm font-bold text-argon-muted">{loc.pct}%</span>
              </div>
              <div className="w-full bg-argon-lighter rounded-full h-1">
                <div
                  className="bg-argon-primary h-1 rounded-full transition-all duration-700"
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
