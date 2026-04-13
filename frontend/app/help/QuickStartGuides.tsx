import { LayoutDashboard, BarChart3, Server, Settings, Shield, Download, Activity, HelpCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface GuideItem {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  gradient: string;
  tags: string[];
}

const guides: GuideItem[] = [
  {
    title: "Dashboard Overview",
    description: "Monitor real-time training progress, KPI metrics, accuracy/loss charts, network topology, and round pipeline.",
    href: "/",
    icon: LayoutDashboard,
    gradient: "from-blue-400 to-indigo-500",
    tags: ["KPIs", "Charts", "WebSocket"],
  },
  {
    title: "Analytics & Audit",
    description: "Deep-dive into convergence metrics, node reliability scores, accuracy/loss evolution, and per-round audit details.",
    href: "/analytics",
    icon: BarChart3,
    gradient: "from-purple-400 to-pink-500",
    tags: ["Convergence", "Audit"],
  },
  {
    title: "Node Management",
    description: "View all registered nodes, their status (Active/Stale/Banned), heartbeat health, and disconnect or ban malicious nodes.",
    href: "/nodes",
    icon: Server,
    gradient: "from-green-400 to-emerald-500",
    tags: ["Status", "Ban", "Heartbeat"],
  },
  {
    title: "Configuration",
    description: "Adjust training hyperparameters: quorum size, malicious fraction, differential privacy, FedProx mu, and noise multiplier.",
    href: "/config",
    icon: Settings,
    gradient: "from-orange-400 to-amber-500",
    tags: ["Quorum", "DP", "FedProx"],
  },
  {
    title: "Security Center",
    description: "Review Byzantine defense verdicts, node threat levels, encryption status, rejection rates, and security KPIs.",
    href: "/security",
    icon: Shield,
    gradient: "from-red-400 to-rose-500",
    tags: ["Verdicts", "Threats", "TLS"],
  },
  {
    title: "Model Export",
    description: "Download trained global model checkpoints (.bin), review version history with accuracy/loss per round.",
    href: "/export",
    icon: Download,
    gradient: "from-cyan-400 to-blue-500",
    tags: ["Download", "Versions"],
  },
  {
    title: "System Logs",
    description: "Stream live event logs, filter by category (Training/Security/System/Node), view node activity timelines.",
    href: "/logs",
    icon: Activity,
    gradient: "from-teal-400 to-green-500",
    tags: ["Live Stream", "Filters"],
  },
  {
    title: "Platform Settings",
    description: "View platform info, test backend connectivity, review Docker infrastructure, and perform destructive operations.",
    href: "/settings",
    icon: Settings,
    gradient: "from-slate-400 to-zinc-500",
    tags: ["Connection", "Reset"],
  },
];

export default function QuickStartGuides() {
  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg shadow-sm text-white">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-argon-default">Dashboard Modules Guide</h3>
          <p className="text-xs text-argon-muted mt-0.5">Overview of every module available in the platform.</p>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {guides.map((g) => {
            const Icon = g.icon;
            return (
              <Link
                key={g.href}
                href={g.href}
                className="group block p-5 rounded-xl border border-argon-lighter/60 hover:border-argon-primary/30 hover:shadow-md transition-all duration-300 bg-white"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${g.gradient} flex items-center justify-center shadow-sm mb-3`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-sm font-bold text-argon-default mb-1.5 group-hover:text-argon-primary transition-colors">{g.title}</h4>
                <p className="text-xs text-argon-muted leading-relaxed mb-3">{g.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.tags.map((tag) => (
                    <span key={tag} className="text-[0.5625rem] font-bold bg-argon-bg text-argon-light px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-3 text-xs font-bold text-argon-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Open module <ArrowRight className="w-3 h-3" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
