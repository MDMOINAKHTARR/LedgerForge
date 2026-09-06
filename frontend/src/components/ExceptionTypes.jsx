import React from 'react';
import { ArrowUpRight, Clock, Globe2, FileText, HelpCircle, Layers, Split, Copy } from 'lucide-react';

export function ExceptionTypes({ batchData, onViewAll }) {
  const results = batchData?.results || [];
  const total = results.length;

  const countForType = (typeKey) => {
    if (total === 0) return 0;
    return results.filter(r => {
      const m = (r.match_type || '').toUpperCase();
      const reasons = (r.reasoning || '').toUpperCase();
      const disc = (r.discrepancy_details || []).map(d => JSON.stringify(d).toUpperCase()).join(' ');
      return m.includes(typeKey) || reasons.includes(typeKey) || disc.includes(typeKey);
    }).length;
  };

  const getPct = (cnt) => (total > 0 ? `${Math.round((cnt / total) * 100)}%` : '0%');

  const categories = [
    {
      label: 'Timing Mismatch',
      pct: getPct(countForType('TIMING')),
      icon: Clock,
      iconBg: 'bg-pastel-yellow text-amber-700',
    },
    {
      label: 'FX Variance',
      pct: getPct(countForType('FX')),
      icon: Globe2,
      iconBg: 'bg-pastel-mint text-emerald-700',
    },
    {
      label: 'Missing Invoice',
      pct: getPct(countForType('MISSING') + countForType('UNMATCHED')),
      icon: FileText,
      iconBg: 'bg-pastel-pink text-rose-700',
    },
    {
      label: 'Unclear Reference',
      pct: getPct(countForType('REFERENCE') + countForType('FUZZY')),
      icon: HelpCircle,
      iconBg: 'bg-pastel-blue text-sky-700',
    },
    {
      label: 'Partial Payment',
      pct: getPct(countForType('PARTIAL')),
      icon: Split,
      iconBg: 'bg-pastel-lavender text-purple-700',
    },
    {
      label: 'Duplicate Entry',
      pct: getPct(countForType('DUPLICATE')),
      icon: Copy,
      iconBg: 'bg-indigo-50 text-indigo-700',
    },
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
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          return (
            <div
              key={idx}
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
                {cat.pct}
              </span>
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-mono">
        10-category autonomous classification
      </div>
    </div>
  );
}
