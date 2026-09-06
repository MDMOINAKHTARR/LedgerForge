import React, { useState } from 'react';
import { Cpu, RefreshCw, ArrowRight, CheckCircle2, AlertTriangle, Sparkles, Zap, TrendingUp, ShieldCheck } from 'lucide-react';
import { triggerAutoOptimization } from '../services/api';

export function OptimizationVisualizer({ onOptimizationComplete }) {
  const [isLoopRunning, setIsLoopRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [optimizationData, setOptimizationData] = useState(null);
  const [error, setError] = useState(null);

  const steps = [
    { title: 'GOAL', desc: 'Maximize STP Rate % & Accuracy while zeroing false auto-posts' },
    { title: 'GENERATE AGENT', desc: 'Instantiate Base Agent V1 baseline rules & prompts' },
    { title: 'RUN AGENT', desc: 'Execute reconciliation on 100+ validation edge cases' },
    { title: 'EVALUATE RESULT', desc: 'Calculate Accuracy, STP Rate, Reliability, and Cost' },
    { title: 'ANALYZE FAILURES', desc: 'Mine misclassifications (FX variance, wire fees, alias memos)' },
    { title: 'IMPROVE AGENT', desc: 'Meta-Agent injects domain rules & calibrates threshold' },
    { title: 'RUN AGAIN', desc: 'Re-evaluate improved Agent V2 against ground truth' },
    { title: 'SELECT BETTER VERSION', desc: 'Auto-promote superior agent version to active production' }
  ];

  const handleRunLoop = async () => {
    setIsLoopRunning(true);
    setError(null);
    setOptimizationData(null);
    setCurrentStepIndex(0);

    // Simulate animated step progression
    for (let i = 0; i < steps.length; i++) {
      setCurrentStepIndex(i);
      await new Promise((r) => setTimeout(r, 600));
    }

    try {
      const data = await triggerAutoOptimization('v1');
      setOptimizationData(data);
      if (onOptimizationComplete) onOptimizationComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoopRunning(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-violet-500/30 glow-violet space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <Cpu className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-white">Autonomous Agent Engineering Loop</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Meta-Agent loop that automatically mines failures, mutates prompts & rules, and selects superior agent versions.
          </p>
        </div>

        <button
          onClick={handleRunLoop}
          disabled={isLoopRunning}
          className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
            isLoopRunning
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-violet-600/30'
          }`}
        >
          {isLoopRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-violet-300" />
              <span>Executing Engineering Loop...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-violet-300" />
              <span>Run Auto-Improvement Loop</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Visual Loop Sequence Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {steps.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          const isDone = currentStepIndex > idx || (optimizationData && !isLoopRunning);

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-center transition-all ${
                isActive
                  ? 'bg-violet-600/20 border-violet-500 text-white scale-105 shadow-md shadow-violet-500/20'
                  : isDone
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
                Step {idx + 1}
              </div>
              <div className="text-xs font-black truncate">{step.title}</div>
            </div>
          );
        })}
      </div>

      {/* Optimization Results Card */}
      {optimizationData && (
        <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-4 animate-fade-in">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-bold text-white">Agent Self-Improvement Complete!</span>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PROMOTED: {optimizationData.new_version.version_name}
            </span>
          </div>

          {/* Performance Lift Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Accuracy Lift</span>
              <span className="text-lg font-black text-emerald-400">{optimizationData.performance_delta.accuracy_delta}</span>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">STP Auto-Rate Lift</span>
              <span className="text-lg font-black text-emerald-400">{optimizationData.performance_delta.stp_delta}</span>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Zero-False Safety</span>
              <span className="text-lg font-black text-blue-400">{optimizationData.performance_delta.reliability_delta}</span>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 block">Cost Efficiency</span>
              <span className="text-lg font-black text-amber-400">{optimizationData.performance_delta.cost_reduction}</span>
            </div>
          </div>

          {/* Generated Strategy Improvements */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Autonomous Strategy Mutations Applied</span>
            </h4>
            <div className="space-y-1.5">
              {optimizationData.improvements.map((imp, idx) => (
                <div key={idx} className="text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-slate-300 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span>{imp}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
