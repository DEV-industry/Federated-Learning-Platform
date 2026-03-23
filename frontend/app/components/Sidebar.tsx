"use client";
import {
  BarChart3, Server, Shield, Settings, HelpCircle,
  Download, Activity, LayoutDashboard, Cpu,
} from "lucide-react";

function NavItem({ icon: Icon, label, active }: { icon: any; label: string; active?: boolean }) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${active
        ? "bg-blue-50 text-blue-600"
        : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        }`}
    >
      <Icon className={`w-[18px] h-[18px] ${active ? "text-blue-600" : "text-gray-400"}`} />
      {label}
    </button>
  );
}

export default function Sidebar({ activeItem }: { activeItem: string }) {
  const generalItems = [
    { icon: LayoutDashboard, label: "Dashboard" },
    { icon: BarChart3, label: "Analytics" },
    { icon: Server, label: "Nodes" },
    { icon: Settings, label: "Config" },
    { icon: Shield, label: "Security" },
  ];
  const otherItems = [
    { icon: Download, label: "Model Export" },
    { icon: Activity, label: "Logs" },
  ];
  const supportItems = [
    { icon: Settings, label: "Settings" },
    { icon: HelpCircle, label: "Help Center" },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[250px] bg-white border-r border-gray-200 flex flex-col z-30 sidebar-scroll overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-0 px-0 pt-2 pb-0 flex-nowrap">
        <div className="w-28 h-28 flex-shrink-0 flex items-center justify-center">
          <img src="/logo.png" alt="FL Platform Logo" className="w-full h-full object-contain" />
        </div>
        <span className="font-bold text-lg text-gray-800 tracking-tight whitespace-nowrap">FL Platform</span>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-3 space-y-6 mt-1">
        <div>
          {generalItems.map((item) => (
            <NavItem key={item.label} icon={item.icon} label={item.label} active={activeItem === item.label} />
          ))}
        </div>

        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-4 mb-2">Other Tools</p>
          {otherItems.map((item) => (
            <NavItem key={item.label} icon={item.icon} label={item.label} />
          ))}
        </div>

        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-4 mb-2">Support</p>
          {supportItems.map((item) => (
            <NavItem key={item.label} icon={item.icon} label={item.label} />
          ))}
        </div>
      </nav>
    </aside>
  );
}
