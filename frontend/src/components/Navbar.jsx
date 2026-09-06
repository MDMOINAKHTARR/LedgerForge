import React from 'react';
import { ShieldAlert, Bot, Cpu, FileSpreadsheet, Activity } from 'lucide-react';

export function Navbar({ activeTab, setActiveTab, activeAgentVersion }) {
  return (
    <header className="border-b border-slate-800 bg-slate-950 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Operational Principle */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-emerald-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-white font-mono">LedgerMind</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                  Reconciliation Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center space-x-1 font-mono">
                <ShieldAlert className="w-3 h-3 text-amber-400 inline" />
                <span className="text-amber-300 font-bold">Rule:</span>
                <span>"Knows when to stop and ask"</span>
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setActiveTab('reconcile')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'reconcile'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('exceptions')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'exceptions'
                  ? 'bg-slate-800 text-amber-400 border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Human Queue</span>
            </button>

            <button
              onClick={() => setActiveTab('evolution')}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg font-semibold transition-all ${
                activeTab === 'evolution'
                  ? 'bg-slate-800 text-emerald-300 border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Agent Evolution</span>
            </button>
          </nav>

          {/* Active Production Engine Indicator */}
          <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-subtle" />
            <span className="text-slate-500">Active Engine:</span>
            <span className="font-bold text-slate-200">{activeAgentVersion?.version_name || 'Agent V3'}</span>
          </div>

        </div>
      </div>
    </header>
  );
}
