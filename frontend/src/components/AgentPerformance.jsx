import React from 'react';
import { ChevronDown, TrendingUp, ShieldCheck, Zap, Activity } from 'lucide-react';

export function AgentPerformance({
  activeAgentVersion,
  onSelectVersion,
  agentVersions = []
}) {
  return (
    <div className="forge-card p-6 flex flex-col justify-between space-y-4">
      {/* Header with Engine Dropdown */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif font-bold text-lg text-ink">Agent Performance</h2>
        <div className="relative">
          <select
            value={activeAgentVersion?.id || 'v3'}
            onChange={(e) => onSelectVersion && onSelectVersion(e.target.value)}
            className="appearance-none bg-slate-50 border border-slate-200 rounded-full pl-3 pr-7 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:border-slate-400 cursor-pointer"
          >
            <option value="v3">Agent V3 (Active)</option>
            <option value="v2">Agent V2 (Standby)</option>
            <option value="v1">Agent V1 (Baseline)</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* 3 Metric Columns */}
      <div className="grid grid-cols-3 gap-3 text-center">
        {/* Metric 1: Overall Accuracy */}
        <div className="p-3 rounded-xl bg-pastel-mint-light/60 border border-pastel-mint-border/50">
          <div className="text-xl font-extrabold text-ink font-sans">
            96.4%
          </div>
          <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
            Overall Accuracy
          </div>
          <span className="inline-flex items-center space-x-0.5 text-[10px] font-bold text-emerald-700 mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>+8.2%</span>
          </span>
        </div>

        {/* Metric 2: Straight-Through (STP) */}
        <div className="p-3 rounded-xl bg-pastel-blue-light/60 border border-pastel-blue-border/50">
          <div className="text-xl font-extrabold text-ink font-sans">
            82.5%
          </div>
          <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
            Straight-Through
          </div>
          <span className="inline-flex items-center space-x-0.5 text-[10px] font-bold text-sky-700 mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>+21.0%</span>
          </span>
        </div>

        {/* Metric 3: False Auto-Post */}
        <div className="p-3 rounded-xl bg-pastel-pink-light/60 border border-pastel-pink-border/50">
          <div className="text-xl font-extrabold text-ink font-sans">
            0.0%
          </div>
          <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">
            False Auto-Post
          </div>
          <span className="inline-flex items-center space-x-0.5 text-[10px] font-bold text-emerald-700 mt-1">
            <ShieldCheck className="w-3 h-3" />
            <span>&lt; 5% Safe</span>
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-500">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
          <span>Active Engine: <strong className="text-ink font-semibold">Agent V3</strong></span>
        </div>
        <div className="flex items-center space-x-3 text-slate-400 font-mono">
          <span>Latency: 5.2ms</span>
          <span>•</span>
          <span>Uptime: 99.9%</span>
        </div>
      </div>
    </div>
  );
}
