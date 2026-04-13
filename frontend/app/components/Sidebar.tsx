"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Server, Shield, Settings, HelpCircle,
  Download, Activity, LayoutDashboard, Cpu, BookOpen,
} from "lucide-react";

function NavItem({ icon: Icon, label, href }: { icon: any; label: string; href: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-argon text-[0.8125rem] font-semibold transition-all duration-200 mb-0.5 ${active
        ? "bg-argon-primary text-white shadow-argon-primary"
        : "text-argon-muted hover:bg-argon-lighter/50"
        }`}
    >
      <div className={`w-8 h-8 rounded-argon flex items-center justify-center flex-shrink-0 ${active
        ? "bg-white/20"
        : "bg-white shadow-argon-sm"
        }`}>
        <Icon className={`w-[14px] h-[14px] ${active ? "text-white" : "text-argon-primary"}`} />
      </div>
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const generalItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: BarChart3, label: "Analytics", href: "/analytics" },
    { icon: Server, label: "Nodes", href: "/nodes" },
    { icon: Settings, label: "Config", href: "/config" },
    { icon: Shield, label: "Security", href: "/security" },
  ];
  const otherItems = [
    { icon: Download, label: "Model Export", href: "/export" },
    { icon: Activity, label: "Logs", href: "/logs" },
  ];
  const supportItems = [
    { icon: Settings, label: "Settings", href: "/settings" },
    { icon: HelpCircle, label: "Help Center", href: "/help" },
  ];

  return (
    <aside className="fixed left-4 top-4 bottom-4 w-[250px] bg-white rounded-argon-lg flex flex-col z-30 sidebar-scroll overflow-y-auto shadow-argon">
      {/* Brand */}
      <div className="flex items-center gap-0 px-0 pt-2 pb-2 flex-nowrap border-b border-argon-lighter mb-4">
        <div className="w-24 h-24 flex-shrink-0 flex items-center justify-center">
          <img src="/logo.png" alt="FL Platform Logo" className="w-full h-full object-contain" />
        </div>
        <span className="font-bold text-base text-argon-default tracking-tight whitespace-nowrap">FL Platform</span>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-4 space-y-6">
        <div>
          {generalItems.map((item) => (
            <NavItem key={item.label} icon={item.icon} label={item.label} href={item.href} />
          ))}
        </div>

        <div>
          <p className="text-[0.625rem] font-bold text-argon-muted uppercase tracking-widest px-4 mb-2">Other Tools</p>
          {otherItems.map((item) => (
            <NavItem key={item.label} icon={item.icon} label={item.label} href={item.href} />
          ))}
        </div>

        <div>
          <p className="text-[0.625rem] font-bold text-argon-muted uppercase tracking-widest px-4 mb-2">Support</p>
          {supportItems.map((item) => (
            <NavItem key={item.label} icon={item.icon} label={item.label} href={item.href} />
          ))}
        </div>
      </nav>

      {/* Need help card */}
      <div className="px-4 pb-4 mt-4">
        <div className="bg-argon-primary rounded-argon-lg p-4 text-center">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <HelpCircle className="w-5 h-5 text-white" />
          </div>
          <p className="text-white font-bold text-sm mb-0.5">Need help?</p>
          <p className="text-white/70 text-xs mb-3">Please check our docs</p>
          <Link href="/documentation" className="w-full py-2 bg-white text-argon-primary text-xs font-bold rounded-argon hover:shadow-argon-sm transition-all block text-center">
            Documentation
          </Link>
        </div>
      </div>
    </aside>
  );
}
