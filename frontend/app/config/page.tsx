"use client";
import { useEffect, useState } from "react";
import Header from "@/app/components/Header";
import { Settings, Shield, Sliders, Save, CheckCircle2, Server, Key, Brain, Lock, Unlock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

export default function ConfigPage() {
  // Config state
  const [minQuorum, setMinQuorum] = useState<number>(2);
  const [maliciousFraction, setMaliciousFraction] = useState<number>(0.3);
  const [dpEnabled, setDpEnabled] = useState<boolean>(true);
  const [fedproxMu, setFedproxMu] = useState<number>(0.01);
  const [dpNoiseMultiplier, setDpNoiseMultiplier] = useState<number>(0.01);
  const [manualHyperparamLock, setManualHyperparamLock] = useState<boolean>(false);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Fetch initial config from backend STATUS endpoint
  useEffect(() => {
    fetch(`${API_URL}/api/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.expectedNodes !== undefined) setMinQuorum(data.expectedNodes);
        if (data.maliciousFraction !== undefined) setMaliciousFraction(data.maliciousFraction);
        
        if (data.dynamicHyperparameters) {
          if (data.dynamicHyperparameters.dpEnabled !== undefined) setDpEnabled(data.dynamicHyperparameters.dpEnabled);
          if (data.dynamicHyperparameters.fedproxMu !== undefined) setFedproxMu(data.dynamicHyperparameters.fedproxMu);
          if (data.dynamicHyperparameters.dpNoiseMultiplier !== undefined) setDpNoiseMultiplier(data.dynamicHyperparameters.dpNoiseMultiplier);
          if (data.dynamicHyperparameters.manualHyperparamLock !== undefined) setManualHyperparamLock(data.dynamicHyperparameters.manualHyperparamLock);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load initial config", err);
        setIsLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    
    try {
      const response = await fetch(`${API_URL}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minQuorum,
          maliciousFraction,
          dpEnabled,
          fedproxMu,
          dpNoiseMultiplier,
          manualHyperparamLock,
        }),
      });

      if (response.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        alert("Server returned an error applying config.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error applying config.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl="#" title="Advanced Configuration" />

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-l-2 border-argon-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-2">
          
          {/* Main Left Column (2-cols wide) */}
          <div className="xl:col-span-2 flex flex-col gap-6">
            
            {/* Card 1: Aggregation & Lifecycle */}
            <div className="argon-card overflow-hidden">
              <div className="argon-card-header flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm text-white">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-argon-default">Aggregation & Lifecycle Rules</h3>
                  <p className="text-xs text-argon-muted mt-0.5">Control how the central aggregator collects models.</p>
                </div>
              </div>
              <div className="p-6 space-y-6">
                
                {/* Min Quorum */}
                <div>
                  <label className="flex items-center justify-between text-[0.8125rem] font-bold text-argon-default mb-2">
                    <span>Minimum Node Quorum</span>
                    <span className="text-argon-primary px-3 py-1 bg-argon-primary/10 rounded-full">{minQuorum} nodes</span>
                  </label>
                  <p className="text-xs text-argon-muted mb-3">Number of active nodes required before moving to global aggregation.</p>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={minQuorum}
                    onChange={(e) => setMinQuorum(parseInt(e.target.value))}
                    className="w-full accent-argon-primary bg-argon-lighter h-1.5 rounded-full appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-argon-light font-bold mt-2">
                    <span>1</span>
                    <span>100</span>
                  </div>
                </div>

                <div className="border-t border-argon-lighter pt-5">
                  <label className="flex items-center justify-between text-[0.8125rem] font-bold text-argon-default mb-2">
                    <span>Malicious Threshold Fraction</span>
                    <span className="text-argon-danger px-3 py-1 bg-argon-danger/10 rounded-full">{maliciousFraction.toFixed(2)}</span>
                  </label>
                  <p className="text-xs text-argon-muted mb-3">Ratio of potentially malicious nodes expected in the network. Used by Bulyan algorithm for secure aggregation.</p>
                  <input
                    type="range"
                    min="0.0"
                    max="0.49"
                    step="0.01"
                    value={maliciousFraction}
                    onChange={(e) => setMaliciousFraction(parseFloat(e.target.value))}
                    className="w-full accent-argon-danger bg-argon-lighter h-1.5 rounded-full appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-argon-light font-bold mt-2">
                    <span>0.00</span>
                    <span>0.49</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Card 2: Algorithms & Mathematics */}
            <div className="argon-card overflow-hidden">
              <div className="argon-card-header flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg shadow-sm text-white">
                  <Brain className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-argon-default">Algorithm Hyperparameters</h3>
                  <p className="text-xs text-argon-muted mt-0.5">Adjust federated learning specific penalties and regularizations.</p>
                </div>
              </div>
              <div className="p-6">
                
                {/* FedProx Mu */}
                <div>
                  <label className="flex items-center justify-between text-[0.8125rem] font-bold text-argon-default mb-2">
                    <span>FedProx Proximal Term (μ)</span>
                    <span className="text-orange-500 px-3 py-1 bg-orange-500/10 rounded-full">{fedproxMu.toFixed(3)}</span>
                  </label>
                  <p className="text-xs text-argon-muted mb-3">Controls the proximal penalty. Higher values force local models to stay closer to the global model, combating Non-IID data distribution divergence.</p>
                  <input
                    type="range"
                    min="0.001"
                    max="0.5"
                    step="0.001"
                    value={fedproxMu}
                    onChange={(e) => setFedproxMu(parseFloat(e.target.value))}
                    className="w-full accent-orange-500 bg-argon-lighter h-1.5 rounded-full appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-argon-light font-bold mt-2">
                    <span>0.001</span>
                    <span>0.500</span>
                  </div>
                </div>

                <div className="border-t border-argon-lighter pt-5 mt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[0.8125rem] font-bold text-argon-default">Lock Manual Overrides</label>
                      <p className="text-xs text-argon-muted mt-1">When active, the auto-tuner will NOT override your manual μ and DP noise values between rounds.</p>
                    </div>
                    <label className="flex items-center cursor-pointer relative flex-shrink-0 ml-4">
                      <input type="checkbox" className="sr-only" checked={manualHyperparamLock} onChange={(e) => setManualHyperparamLock(e.target.checked)} />
                      <div className={`w-11 h-6 rounded-full transition-colors duration-300 ${manualHyperparamLock ? 'bg-orange-500' : 'bg-argon-lighter'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${manualHyperparamLock ? 'translate-x-5' : 'translate-x-0'}`}></div>
                    </label>
                  </div>
                  {manualHyperparamLock && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg font-semibold">
                      <Lock className="w-3.5 h-3.5" />
                      Auto-tuning paused — your manual values will persist across all future rounds.
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>

          {/* Right Column (1-col) */}
          <div className="flex flex-col gap-6">
            
            {/* Card 3: Differential Privacy */}
            <div className="argon-card overflow-hidden h-full">
              <div className="argon-card-header flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg shadow-sm text-white">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-argon-default">Differential Privacy</h3>
                  </div>
                </div>
                {/* Custom Toggle Switch */}
                <label className="flex items-center cursor-pointer relative">
                  <input type="checkbox" className="sr-only" checked={dpEnabled} onChange={(e) => setDpEnabled(e.target.checked)} />
                  <div className={`w-11 h-6 rounded-full transition-colors duration-300 ${dpEnabled ? 'bg-argon-info' : 'bg-argon-lighter'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${dpEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </label>
              </div>
              
              <div className="p-6">
                <div className={`transition-all duration-300 ${dpEnabled ? "opacity-100" : "opacity-40 grayscale pointer-events-none"}`}>
                  <p className="text-xs text-argon-muted mb-6">
                    DP adds statistical Laplace noise to gradients to protect local datasets from extraction attacks. 
                    Activating it requires nodes to have DP noise support compiled.
                  </p>

                  <label className="flex items-center justify-between text-[0.8125rem] font-bold text-argon-default mb-2">
                    <span>Noise Multiplier</span>
                    <span className="text-argon-info px-3 py-1 bg-argon-info/10 rounded-full">{dpNoiseMultiplier.toFixed(3)}</span>
                  </label>
                  <p className="text-xs text-argon-muted mb-3">Multiplier strictly scales the magnitude of the Laplace noise. Very high values may ruin model convergence.</p>
                  <input
                    type="range"
                    min="0.001"
                    max="1.0"
                    step="0.001"
                    value={dpNoiseMultiplier}
                    onChange={(e) => setDpNoiseMultiplier(parseFloat(e.target.value))}
                    className="w-full accent-argon-info bg-argon-lighter h-1.5 rounded-full appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-argon-light font-bold mt-2">
                    <span>0.001</span>
                    <span>1.000</span>
                  </div>
                </div>
              </div>

              {/* Apply Changes Section */}
              <div className="p-6 bg-argon-lighter/30 border-t border-argon-lighter mt-auto">
                <p className="text-[11px] text-argon-muted leading-relaxed mb-4 text-center">
                  Changes made here are applied live and aggressively influence the next federated learning round's ruleset.
                </p>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full py-3 px-4 bg-gradient-to-r from-argon-primary to-[#825ee4] text-white font-bold text-sm rounded-argon shadow-argon-sm hover:shadow-argon-hover hover:-translate-y-px transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <div className="animate-spin w-4 h-4 rounded-full border-t-2 border-l-2 border-white"></div>
                  ) : saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Applied Successfully
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Apply Configuration
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
