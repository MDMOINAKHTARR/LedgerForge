import React from 'react';
import { FileText, CheckCircle2, Clock, ShieldAlert, TrendingUp } from 'lucide-react';
import { getCanonicalSummary } from '../services/canonicalReport';

export function KpiGrid({ batchData }) {
  const summary = getCanonicalSummary(batchData);
  
  const totalTx = summary ? summary.counts.total_bank_transactions : 0;
  const totalLedger = summary ? summary.counts.total_ledger_entries : 0;
  const autoCount = summary ? summary.counts.auto_matched : 0;
  const reviewCount = summary ? summary.counts.human_review : 0;
  const unmatchedCount = summary ? summary.counts.unmatched : 0;
  const ledgerOnlyCount = summary ? summary.counts.ledger_only : 0;
  
  const stpRate = summary ? summary.quality_metrics.straight_through_rate : 0;
  const reviewRate = summary ? summary.quality_metrics.human_review_rate : 0;

  const kpis = [
    {
      label: 'TOTAL TRANSACTIONS',
      value: totalTx.toLocaleString(),
      subtext: totalTx > 0 ? `${totalTx} bank · ${totalLedger} ledger entries` : 'No transactions loaded',
      trend: totalTx > 0 ? 'Canonical dataset' : null,
      icon: FileText,
      bg: 'bg-pastel-mint-light/60',
      border: 'border-pastel-mint-border/60',
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'AUTO-MATCHED',
      value: `${stpRate}%`,
      subtext: `${autoCount.toLocaleString()} transactions`,
      trend: null,
      icon: CheckCircle2,
      bg: 'bg-pastel-mint',
      border: 'border-pastel-mint-border',
      iconBg: 'bg-emerald-500 text-white',
    },
    {
      label: 'HUMAN REVIEW',
      value: `${reviewRate}%`,
      subtext: `${reviewCount.toLocaleString()} transactions`,
      trend: null,
      icon: Clock,
      bg: 'bg-pastel-pink',
      border: 'border-pastel-pink-border',
      iconBg: 'bg-rose-500/10 text-rose-600',
    },
    {
      label: 'UNMATCHED & LEDGER-ONLY',
      value: `${unmatchedCount + ledgerOnlyCount}`,
      subtext: `${unmatchedCount} unmatched · ${ledgerOnlyCount} ledger-only`,
      trend: null,
      icon: ShieldAlert,
      bg: 'bg-pastel-blue-light',
      border: 'border-pastel-blue-border',
      iconBg: 'bg-sky-500/10 text-sky-600',
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        return (
          <div
            key={idx}
            className={`p-5 rounded-2xl border ${kpi.bg} ${kpi.border} shadow-2xs flex flex-col justify-between space-y-4 hover:shadow-xs transition-shadow`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-slate-600 tracking-wider">
                {kpi.label}
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div>
              <div className="text-3xl font-extrabold text-ink font-sans tracking-tight">
                {kpi.value}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {kpi.subtext}
              </p>
            </div>

            {kpi.trend ? (
              <div className="pt-2 border-t border-slate-200/50 flex items-center space-x-1 text-[11px] font-semibold text-emerald-700">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{kpi.trend}</span>
              </div>
            ) : (
              <div className="h-4" />
            )}
          </div>
        );
      })}
    </div>
  );
}
