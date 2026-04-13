"use client";
import Header from "@/app/components/Header";

import FLPipelineInfographic from "./FLPipelineInfographic";
import ArchitectureInfographic from "./ArchitectureInfographic";
import FAQSection from "./FAQSection";
import QuickStartGuides from "./QuickStartGuides";
import CommandReference from "./CommandReference";

export default function HelpPage() {
  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl="#" title="Help Center" />

      <div className="flex flex-col gap-6 mt-2">
        {/* Hero banner */}
        <div className="argon-card overflow-hidden bg-gradient-to-r from-argon-primary via-[#825ee4] to-[#f5365c] p-8 text-white flex items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-extrabold mb-2">Federated Learning Platform</h2>
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              A production-grade platform for privacy-preserving distributed machine learning. This guide covers the system architecture,
              training pipeline, security mechanisms, and how to operate the dashboard.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-xs font-bold">Homomorphic Encryption</span>
              <span className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-xs font-bold">Byzantine Robustness</span>
              <span className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-xs font-bold">Differential Privacy</span>
              <span className="px-3 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-xs font-bold">Real-Time Dashboard</span>
            </div>
          </div>
          <div className="hidden lg:block flex-shrink-0">
            <img 
              src="/help-badge.png" 
              alt="Platform Logo badge" 
              className="w-32 h-32 object-contain opacity-90 drop-shadow-2xl brightness-110 rounded-2xl" 
            />
          </div>
        </div>

        {/* Dashboard modules guide */}
        <QuickStartGuides />

        {/* FL Pipeline Infographic */}
        <FLPipelineInfographic />

        {/* Architecture Infographic */}
        <ArchitectureInfographic />

        {/* FAQ */}
        <FAQSection />

        {/* Command reference */}
        <CommandReference />
      </div>
    </div>
  );
}
