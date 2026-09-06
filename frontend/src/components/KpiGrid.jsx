import React from 'react';
import { FileText, CheckCircle2, Clock, ShieldCheck, TrendingUp } from 'lucide-react';

export function KpiGrid({ batchData }) {
  const totalTx = batchData ? (batchData.total_bank_tx || batchData.results?.length || 0) : 0;
  const autoCount = batchData ? (batchData.auto_reconciled_count || 0) : 0;
  const reviewCount = batchData ? (batchData.escalated_count || 0) : 0;
  
  const stpRate = totalTx > 0 
    ? Math.round((autoCount / totalTx) * 100) 
    : 0;
    
  const reviewRate = totalTx > 0 
    ? Math.round((reviewCount / totalTx) * 100) 
    : 0;

  const kpis = [
    {
      label: 'TOTAL TRANSACTIONS',
      value: totalTx.toLocaleString(),
      subtext: totalTx > 0 ? 'Real ingested bank records' : 'No transactions loaded',
      trend: totalTx > 0 ? 'Live real data' : null,
      icon: FileText,
      bg: 'bg-pastel-mint-light/60',
      border: 'border-pastel-mint-border/60',
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'AUTO-RECONCILED',
      value: `${stpRate}%`,
      subtext: `${autoCount.toLocaleString()} transactions`,
      trend: null,
      icon: CheckCircle2,
      bg: 'bg-pastel-mint',
      border: 'border-pastel-mint-border',
      iconBg: 'bg-emerald-500 text-white',
    },
    {
      label: 'NEEDS REVIEW',
      value: `${reviewRate}%`,
      subtext: `${reviewCount.toLocaleString()} transactions`,
      trend: null,
      icon: Clock,
      bg: 'bg-pastel-pink',
      border: 'border-pastel-pink-border',
      iconBg: 'bg-rose-500/10 text-rose-600',
    },
    {
      label: 'AUDIT TRAIL',
      value: '100%',
      subtext: 'All decisions logged',
      trend: null,
      icon: ShieldCheck,
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
