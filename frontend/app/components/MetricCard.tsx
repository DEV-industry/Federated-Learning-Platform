"use client";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  children,
}: {
  title: string;
  value: string;
  subtitle: string;
  trend?: "up" | "down";
  trendValue?: string;
  icon: any;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <div className="p-2 rounded-xl bg-gray-50">
          <Icon className="w-4 h-4 text-gray-400" />
        </div>
      </div>
      <h3 className="text-3xl font-bold text-gray-800 tracking-tight">{value}</h3>
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-400">{subtitle}</p>
        {trend && trendValue && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
              trend === "up"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-500"
            }`}
          >
            {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendValue}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
