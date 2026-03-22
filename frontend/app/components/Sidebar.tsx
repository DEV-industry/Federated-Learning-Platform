"use client";
import {
  BarChart3, Server, Shield, Settings, HelpCircle,
  Download, Activity, LayoutDashboard, Cpu,
} from "lucide-react";

function NavItem({ icon: Icon, label, active }: { icon: any; label: string; active?: boolean }) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
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
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg text-gray-800 tracking-tight">FL Platform</span>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-3 space-y-6 mt-2">
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
