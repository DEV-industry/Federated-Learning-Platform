"use client";
import { useState } from "react";
import Header from "@/app/components/Header";
import {
  BookOpen, Server, Settings, Rocket, Shield, Wrench,
} from "lucide-react";

import APIReference from "./APIReference";
import ConfigReference from "./ConfigReference";
import DeploymentGuide from "./DeploymentGuide";
import SecurityDocs from "./SecurityDocs";
import TroubleshootingGuide from "./TroubleshootingGuide";

const tabs = [
  { key: "api",           label: "API Reference",    icon: Server,   gradient: "from-blue-400 to-indigo-500" },
  { key: "config",        label: "Configuration",    icon: Settings, gradient: "from-purple-400 to-pink-500" },
  { key: "deployment",    label: "Deployment",       icon: Rocket,   gradient: "from-green-400 to-emerald-500" },
  { key: "security",      label: "Security",         icon: Shield,   gradient: "from-red-400 to-rose-500" },
  { key: "troubleshoot",  label: "Troubleshooting",  icon: Wrench,   gradient: "from-orange-400 to-amber-500" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export default function DocumentationPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("api");

  const renderContent = () => {
    switch (activeTab) {
      case "api":          return <APIReference />;
      case "config":       return <ConfigReference />;
      case "deployment":   return <DeploymentGuide />;
      case "security":     return <SecurityDocs />;
      case "troubleshoot": return <TroubleshootingGuide />;
    }
  };

  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl="#" title="Documentation" />

      <div className="flex flex-col gap-6 mt-2">
        {/* Hero banner */}
        <div className="argon-card overflow-hidden bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-8 text-white flex items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <span className="text-[0.6875rem] font-bold text-white/50 uppercase tracking-widest">Technical Reference</span>
            </div>
            <h2 className="text-2xl font-extrabold mb-2">Platform Documentation</h2>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              Complete technical reference for the Federated Learning Platform. Covers REST &amp; gRPC APIs,
              configuration parameters, deployment procedures, security mechanisms, and troubleshooting guides.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold">REST API</span>
              <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold">gRPC</span>
              <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold">Docker</span>
              <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold">mTLS</span>
              <span className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-bold">HE / CKKS</span>
            </div>
          </div>
          <div className="hidden lg:block flex-shrink-0">
            <div className="w-28 h-28 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <BookOpen className="w-14 h-14 text-white/30" />
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="argon-card overflow-hidden">
          <div className="px-6 py-4 border-b border-argon-lighter flex gap-2 flex-wrap">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? "bg-argon-primary text-white shadow-argon-primary"
                      : "bg-argon-bg text-argon-muted hover:bg-argon-lighter"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Active tab content */}
          <div className="p-6">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
