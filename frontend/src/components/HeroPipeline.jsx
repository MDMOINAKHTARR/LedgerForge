import React from 'react';
import { Play, Sparkles, RefreshCw, Bot } from 'lucide-react';

export function HeroPipeline({
  onRunReconciliation,
  onImproveAgent,
  isProcessing,
  isImproving,
  hasReconciled,
  reconciledCount = 0,
}) {
  return (
    <div className="forge-card p-7 relative overflow-hidden bg-white border border-slate-200/90 shadow-soft">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* Left / Center Content */}
        <div className="flex-1 space-y-4 max-w-3xl">
          {/* Badges Row */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-pastel-yellow border border-pastel-yellow-border text-ink font-mono text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-subtle" />
              <span>PRODUCTION PIPELINE • REAL DATA MODE</span>
            </span>
            <span className="text-slate-400 font-mono text-xs">• Supabase Production DB</span>
          </div>

          {/* Headline + Handwritten Editorial Note */}
          <div className="relative">
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink tracking-tight leading-snug">
              Autonomous Bank Reconciliation <br className="hidden sm:inline" />
              & Audit Intelligence Platform
            </h1>
            
            {/* Handwritten cursive annotation */}
            <div className="sm:absolute sm:-top-2 sm:right-0 mt-2 sm:mt-0">
              <span className="font-script text-xl text-slate-700 font-medium rotate-[-4deg] inline-block select-none bg-amber-50/60 px-2 py-0.5 rounded border border-amber-200/40">
                “Knows when to stop and ask.”
              </span>
            </div>
          </div>

          {/* Supporting Text */}
          <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed max-w-2xl">
            Ingest real bank statements and accounting ledgers. The agent autonomously classifies exact matches, detects fee & timing anomalies, flags exceptions, and generates immutable audit trails.
          </p>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-3 pt-1">
            <button
              onClick={onRunReconciliation}
              className="btn-primary shadow-sm hover:shadow flex items-center space-x-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Upload & Reconcile Statements</span>
            </button>

            <button
              onClick={onImproveAgent}
              disabled={isImproving}
              className="btn-secondary shadow-2xs hover:shadow-xs"
            >
              {isImproving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-ink" />
                  <span>Diagnosing & Synthesizing Agent...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-ink" />
                  <span>Improve Agent</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Card: Forge Mascot Greeting */}
        <div className="w-full lg:w-72 p-4 rounded-2xl bg-pastel-yellow/90 border border-pastel-yellow-border relative flex items-center space-x-3 shrink-0 shadow-2xs">
          <div className="flex-1 space-y-1">
            <h3 className="font-serif font-bold text-base text-ink leading-tight">
              Hi Mohd!
            </h3>
            <p className="text-[11px] text-ink-secondary leading-relaxed">
              {reconciledCount > 0 ? (
                <>I've reconciled <strong className="text-ink font-bold">{reconciledCount.toLocaleString()} transactions</strong> in your uploaded statements.</>
              ) : (
                <>I'm your AI finance agent. Ready to ingest and reconcile your bank and ledger CSV files.</>
              )}
            </p>
          </div>

          {/* Mascot 3D Illustration */}
          <div className="w-20 h-20 shrink-0 relative flex items-center justify-center">
            <img
              src="/assets/forge_mascot.png"
              alt="Forge AI Assistant"
              className="w-full h-full object-contain drop-shadow-md transform hover:scale-105 transition-transform"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
