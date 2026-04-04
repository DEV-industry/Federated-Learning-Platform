"use client";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const ICON_GRADIENTS: Record<string, string> = {
  primary: "bg-gradient-to-br from-[#5e72e4] to-[#825ee4]",
  warning: "bg-gradient-to-br from-[#fb6340] to-[#fbb140]",
  success: "bg-gradient-to-br from-[#2dce89] to-[#2dceb1]",
  danger: "bg-gradient-to-br from-[#f5365c] to-[#f56036]",
  info: "bg-gradient-to-br from-[#11cdef] to-[#1171ef]",
};

export default function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  iconColor = "primary",
  children,
}: {
  title: string;
  value: string;
  subtitle: string;
  trend?: "up" | "down";
  trendValue?: string;
  icon: any;
  iconColor?: string;
  children?: React.ReactNode;
}) {
  const gradientClass = ICON_GRADIENTS[iconColor] || ICON_GRADIENTS.primary;

  return (
    <div className="argon-card p-5 hover:shadow-argon-lg transition-shadow duration-300">
      <div className="flex items-start justify-between">
        {/* Left: Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider mb-1">{title}</p>
          <h3 className="text-xl font-bold text-argon-default tracking-tight">{value}</h3>
        </div>
        {/* Right: Colored icon badge */}
        <div className={`argon-icon-badge ${gradientClass} flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Trend / Subtitle */}
      <div className="mt-3 pt-3 border-t border-argon-lighter">
        <div className="flex items-center gap-1.5">
          {trend && trendValue && (
            <span
              className={`flex items-center gap-0.5 text-[0.8125rem] font-bold ${
                trend === "up" ? "text-argon-success" : "text-argon-danger"
              }`}
            >
              {trend === "up" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {trendValue}
            </span>
          )}
          <span className="text-[0.8125rem] text-argon-muted">{subtitle}</span>
        </div>
      </div>

      {children}
    </div>
  );
}
