"use client";
import { useEffect, useState } from "react";
import Header from "@/app/components/Header";

import PlatformInfoCard from "./PlatformInfoCard";
import ConnectionCard from "./ConnectionCard";
import InfrastructureCard from "./InfrastructureCard";
import DangerZoneCard from "./DangerZoneCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

export default function SettingsPage() {
  const [currentRound, setCurrentRound] = useState(0);
  const [totalNodes, setTotalNodes] = useState(0);
  const [expectedNodes, setExpectedNodes] = useState(0);
  const [aggregationStrategy, setAggregationStrategy] = useState("BULYAN");
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = () => {
    fetch(`${API_URL}/api/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.currentRound !== undefined) setCurrentRound(data.currentRound);
        if (data.totalNodes !== undefined) setTotalNodes(data.totalNodes);
        if (data.expectedNodes !== undefined) setExpectedNodes(data.expectedNodes);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleResetComplete = () => {
    setCurrentRound(0);
    setTotalNodes(0);
    fetchStatus();
  };

  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl="#" title="Settings" />

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-l-2 border-argon-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 mt-2">
          {/* Top row: Platform Info (left) + Connection (right) */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-2">
              <PlatformInfoCard
                currentRound={currentRound}
                totalNodes={totalNodes}
                expectedNodes={expectedNodes}
                aggregationStrategy={aggregationStrategy}
              />
            </div>
            <div className="xl:col-span-3">
              <ConnectionCard />
            </div>
          </div>

          {/* Infrastructure */}
          <InfrastructureCard />

          {/* Danger Zone */}
          <DangerZoneCard onResetComplete={handleResetComplete} />
        </div>
      )}
    </div>
  );
}
