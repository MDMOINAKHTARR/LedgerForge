import React from 'react';
import { ArrowUpRight, Clock, Globe2, FileText, Split, Copy, AlertTriangle, Layers } from 'lucide-react';
import { getCanonicalSummary } from '../services/canonicalReport';

export function ExceptionTypes({ batchData, onViewAll }) {
  const summary = batchData ? getCanonicalSummary(batchData) : null;
  const exceptionCounts = summary?.exception_counts || {};
  const totalExceptions = Object.values(exceptionCounts).reduce((a, b) => a + b, 0);

  const categories = [
    {
      key: 'DUPLICATE',
      label: 'Duplicate Entry',
      count: exceptionCounts['DUPLICATE'] || 0,
      icon: Copy,
      iconBg: 'bg-indigo-50 text-indigo-700',
    },
    {
      key: 'PARTIAL_PAYMENT',
      label: 'Partial Payment',
      count: exceptionCounts['PARTIAL_PAYMENT'] || 0,
      icon: Split,
      iconBg: 'bg-pastel-lavender text-purple-700',
    },
    {
      key: 'AMOUNT_VARIANCE',
      label: 'Amount Variance',
      count: exceptionCounts['AMOUNT_VARIANCE'] || 0,
      icon: AlertTriangle,
      iconBg: 'bg-amber-50 text-amber-700',
    },
    {
      key: 'TIMING_DIFFERENCE',
      label: 'Timing Difference',
      count: exceptionCounts['TIMING_DIFFERENCE'] || 0,
      icon: Clock,
      iconBg: 'bg-pastel-yellow text-amber-700',
    },
    {
      key: 'FX_VARIANCE',
      label: 'FX Variance',
      count: exceptionCounts['FX_VARIANCE'] || 0,
      icon: Globe2,
      iconBg: 'bg-pastel-mint text-emerald-700',
    },
    {
      key: 'MISSING_IN_LEDGER',
      label: 'Missing in Ledger',
      count: exceptionCounts['MISSING_IN_LEDGER'] || 0,
      icon: FileText,
      iconBg: 'bg-pastel-pink text-rose-700',
    },
    {
      key: 'MISSING_IN_BANK',
      label: 'Missing in Bank',
      count: exceptionCounts['MISSING_IN_BANK'] || 0,
      icon: Layers,
      iconBg: 'bg-purple-50 text-purple-700',
    }
  ];

  return (
    <div className="forge-card p-6 flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif font-bold text-lg text-ink">Exception Types</h2>
        <button
          onClick={onViewAll}
          className="text-xs font-semibold text-ink-secondary hover:text-ink flex items-center space-x-0.5 transition-colors"
        >
          <span>View All</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Grid of exception pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.key}
              className="flex items-center justify-between p-2 rounded-xl bg-[#FAFAF8] border border-slate-100 hover:border-slate-200 transition-colors"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${cat.iconBg}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium text-slate-700 truncate">
                  {cat.label}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-ink pl-2">
                {cat.count}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-mono flex items-center justify-between">
        <span>Authoritative Taxonomy</span>
        <span className="font-bold text-slate-600">{totalExceptions} Total Exceptions</span>
      </div>
    </div>
  );
}
