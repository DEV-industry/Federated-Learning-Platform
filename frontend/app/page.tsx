"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, Server, Target, GitBranch, Cpu } from "lucide-react";

export default function Home() {
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchStatus = () => {
      fetch("http://localhost:8080/api/status")
        .then((res) => res.json())
        .then((data) => setStatus(data))
        .catch((err) => console.error(err));
        
      fetch("http://localhost:8080/api/history")
        .then((res) => res.json())
        .then((data) => setHistory(data))
        .catch((err) => console.error(err));
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 2000);

    return () => clearInterval(intervalId);
  }, []);

  const TARGET_ROUNDS = 100;
  const currentRound = status?.currentRound || 0;
  const progressPercentage = Math.min((currentRound / TARGET_ROUNDS) * 100, 100);

  return (
    <main className="min-h-screen bg-[#0B0F19] text-white selection:bg-blue-500 selection:text-white pb-20">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16">
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-3 tracking-tight">
              <Cpu className="w-10 h-10 text-blue-400" />
              Federated Learning Ops
            </h1>
            <p className="text-gray-400 mt-2 text-lg">Decentralized AI Training Dashboard</p>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-2.5 rounded-full backdrop-blur-md">
            <div className={`w-3 h-3 rounded-full animate-pulse ${status ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'bg-red-500'}`} />
            <span className="text-sm font-medium text-gray-200">
              {status ? "System Online" : "Connecting to Aggregator..."}
            </span>
          </div>
        </header>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Round Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group hover:border-blue-500/50 transition-colors duration-300">
            <div className="flex justify-between items-start mb-4">
              <p className="text-gray-400 font-medium flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" /> Global Round
              </p>
            </div>
            <h3 className="text-5xl font-black text-white">{currentRound}</h3>
            
            {/* Round Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-gray-500 mb-2 font-medium">
                <span>Progress to Convergence</span>
                <span>{currentRound} / {TARGET_ROUNDS}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden border border-white/5">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: `${progressPercentage}%` }}
                >
                  <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/30" />
                </div>
              </div>
            </div>
          </div>

          {/* Nodes Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden hover:border-purple-500/50 transition-colors duration-300">
             <div className="flex justify-between items-start mb-4">
              <p className="text-gray-400 font-medium flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-400" /> Active Nodes
              </p>
            </div>
            <h3 className="text-5xl font-black text-white">{status?.totalNodes || 0}</h3>
            <p className="mt-4 text-sm text-gray-400 font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
              IDs: {status?.connectedNodes?.length > 0 ? status.connectedNodes.join(", ") : "Awaiting sync..."}
            </p>
          </div>

          {/* Current Loss Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden hover:border-emerald-500/50 transition-colors duration-300">
             <div className="flex justify-between items-start mb-4">
              <p className="text-gray-400 font-medium flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Latest Avg Loss
              </p>
            </div>
            <h3 className="text-5xl font-black text-white">
              {history.length > 0 ? history[history.length - 1].loss.toFixed(4) : "0.0000"}
            </h3>
            <p className="mt-4 text-sm text-emerald-400 flex items-center gap-1">
              <GitBranch className="w-4 h-4" /> Global Model Synchronizing
            </p>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl hover:border-white/20 transition-all duration-500 mt-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
              Model Convergence Graph
            </h2>
            <div className="text-xs font-mono bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full border border-blue-500/30">
              Loss / Training Rounds
            </div>
          </div>
          
          <div className="h-[400px] w-full mt-4">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis 
                    dataKey="round" 
                    stroke="#888888" 
                    tick={{fill: '#888888'}} 
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#888888" 
                    tick={{fill: '#888888'}} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value.toFixed(3)}
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                    formatter={(value: any) => [Number(value).toFixed(5), "Average Validation Loss"]}
                    labelFormatter={(label) => `Global Round: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="loss" 
                    stroke="#3b82f6" 
                    strokeWidth={4}
                    dot={{ r: 4, fill: '#1e3a8a', strokeWidth: 2, stroke: '#60a5fa' }}
                    activeDot={{ r: 8, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                    animationDuration={1500}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                <div className="text-center">
                  <Activity className="w-12 h-12 text-gray-500 mx-auto mb-4 animate-pulse" />
                  <p className="text-gray-400 font-medium">Awaiting training cycles to generate convergence graph...</p>
                  <p className="text-sm text-gray-600 mt-2">The chart will automatically appear as rounds complete.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
