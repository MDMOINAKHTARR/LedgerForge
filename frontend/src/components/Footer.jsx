import React from 'react';

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 py-5 bg-white text-center text-[11px] text-slate-500 font-sans mt-12">
      <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-3">
        <span className="font-semibold text-ink">Ledger Forge Autonomous Bank Reconciliation Platform</span>
        <span className="hidden sm:inline text-slate-300">•</span>
        <span className="font-mono text-emerald-700 bg-pastel-mint px-2 py-0.5 rounded-full border border-pastel-mint-border">
          “Zero False Auto-Post Guarantee”
        </span>
      </div>
    </footer>
  );
}
