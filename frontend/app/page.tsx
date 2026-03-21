"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    // In a real app, you would fetch from the aggregator API.
    fetch("http://localhost:8080/api/status")
      .then((res) => res.json())
      .then((data) => setStatus(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-gray-900 text-white">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold text-blue-400">Federated Learning Dashboard</h1>
      </div>

      <div className="relative z-[-1] flex place-items-center">
        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4 text-blue-300">Training Status</h2>
          {status ? (
            <div className="space-y-2">
              <p>Total Nodes Connected: <span className="font-bold text-green-400">{status.totalNodes}</span></p>
              <p>Nodes: {status.connectedNodes?.join(", ")}</p>
            </div>
          ) : (
            <p className="text-gray-400 animate-pulse">Waiting for aggregator data or network error...</p>
          )}
        </div>
      </div>

      <div className="mb-32 grid text-center lg:mb-0 lg:w-full lg:max-w-5xl lg:grid-cols-3 lg:text-left gap-4">
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">Nodes</h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">View connected edge nodes.</p>
        </div>
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">Global Model</h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">Current global model weights and metrics.</p>
        </div>
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/30">
          <h2 className="mb-3 text-2xl font-semibold">Rounds</h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">Training rounds completed.</p>
        </div>
      </div>
    </main>
  );
}
