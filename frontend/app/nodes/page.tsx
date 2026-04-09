"use client";
import Header from "@/app/components/Header";

export default function nodesPage() {
  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl="#" title="Nodes" />
      
      <div className="argon-card p-10 flex flex-col items-center justify-center text-center mt-6 min-h-[50vh]">
        <div className="w-16 h-16 bg-argon-lighter rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-argon-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-argon-default mb-2">Under Construction</h2>
        <p className="text-argon-muted max-w-md">The Nodes module is actively being developed. New capabilities will be available here soon.</p>
        <button className="mt-8 argon-btn argon-btn-primary" onClick={() => window.history.back()}>
          Go Back
        </button>
      </div>
    </div>
  );
}
