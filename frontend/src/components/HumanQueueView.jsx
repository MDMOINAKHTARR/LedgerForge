import React from 'react';
import { ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';

export function HumanQueueView({
  pendingExceptions = [],
  onSelectException,
}) {
  const items = pendingExceptions && pendingExceptions.length > 0 ? pendingExceptions : [];

  return (
    <div className="space-y-6">
      {/* Overview Header */}
      <div className="forge-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl text-ink">
            Human-in-the-Loop Review Queue
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            Transactions where confidence falls below threshold or anomaly guardrails trigger human sign-off.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full bg-pastel-pink text-rose-800 border border-pastel-pink-border text-xs font-bold font-mono">
          {items.length} Pending Actions
        </span>
      </div>

      {/* Review Cards Grid or Empty State */}
      {items.length === 0 ? (
        <div className="forge-card p-12 text-center space-y-3 bg-white border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-pastel-mint flex items-center justify-center mx-auto text-emerald-700 border border-pastel-mint-border">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-base text-ink">Review Queue Clear</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are currently no transactions requiring human review. Any escalated items from your real uploaded bank & ledger statements will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((exc) => {
          const conf = Math.round((exc.confidence_score || 0) * 100);
          return (
            <div
              key={exc.id}
              onClick={() => onSelectException(exc)}
              className="forge-card p-5 hover:border-slate-400 cursor-pointer space-y-3.5 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-rose-700 bg-pastel-pink px-2 py-0.5 rounded-full border border-pastel-pink-border uppercase">
                  {exc.match_type}
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">
                  Conf: {conf}%
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-ink group-hover:text-black transition-colors">
                  {exc.bank_tx?.description} ({(() => {
                    const c = (exc.bank_tx?.currency || '').toUpperCase();
                    const sym = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[c] || (c ? `${c} ` : '');
                    const sign = (exc.bank_tx?.amount || 0) < 0 ? '-' : '';
                    return `${sign}${sym}${exc.bank_tx?.amount !== undefined ? Math.abs(exc.bank_tx.amount).toFixed(2) : '0.00'}`;
                  })()})
                </h3>
              </div>

              <div className="p-3 bg-[#FAFAF8] rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed font-sans">
                <strong className="text-ink text-[11px] block mb-0.5">Reasoning:</strong>
                "{exc.reasoning}"
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="text-slate-400 font-mono text-[11px]">{exc.bank_tx?.date}</span>
                <span className="text-ink font-semibold group-hover:underline flex items-center space-x-1">
                  <span>Review & Resolve</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
