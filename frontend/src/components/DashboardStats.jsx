import React from 'react';
import { 
  CheckCircle2, ShieldAlert, XCircle, Activity, Gauge, Clock, 
  Coins, Percent, Layers, AlertCircle 
} from 'lucide-react';
import { getCanonicalSummary } from '../services/canonicalReport';

export function DashboardStats({ batchData, activeAgentVersion }) {
  if (!batchData) return null;

  const summary = getCanonicalSummary(batchData);
  if (!summary) return null;

  const { counts, quality_metrics, currencies_detected, exception_counts } = summary;

  const totalExceptions = Object.values(exception_counts || {}).reduce((a, b) => a + b, 0);
  const currenciesStr = (currencies_detected || []).length > 0 
    ? currencies_detected.join(', ') 
    : 'None';

  const statCards = [
    {
      label: 'Total Bank Transactions',
      value: counts.total_bank_transactions.toLocaleString(),
      subtext: 'Ingested bank records',
      icon: Activity,
      color: 'text-slate-200',
      border: 'border-slate-800'
    },
    {
      label: 'Total Ledger Entries',
      value: counts.total_ledger_entries.toLocaleString(),
      subtext: 'Ingested company entries',
      icon: Layers,
      color: 'text-slate-200',
      border: 'border-slate-800'
    },
    {
      label: 'Auto-Matched',
      value: `${counts.auto_matched} (${quality_metrics.straight_through_rate}%)`,
      subtext: 'Straight-through reconciliations',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      border: 'border-emerald-500/30 bg-emerald-500/5'
    },
    {
      label: 'Human Review',
      value: `${counts.human_review} (${quality_metrics.human_review_rate}%)`,
      subtext: 'Ambiguity & policy exceptions',
      icon: ShieldAlert,
      color: 'text-amber-400',
      border: 'border-amber-500/30 bg-amber-500/5'
    },
    {
      label: 'Bank Unmatched',
      value: `${counts.unmatched} (${quality_metrics.unmatched_rate}%)`,
      subtext: 'Missing in company ledger',
      icon: XCircle,
      color: 'text-rose-400',
      border: 'border-rose-500/30 bg-rose-500/5'
    },
    {
      label: 'Ledger-Only',
      value: `${counts.ledger_only}`,
      subtext: 'Unpresented / missing in bank',
      icon: AlertCircle,
      color: 'text-purple-400',
      border: 'border-purple-500/30 bg-purple-500/5'
    },
    {
      label: 'Auto-Match Rate',
      value: `${quality_metrics.straight_through_rate}%`,
      subtext: 'STP processing rate',
      icon: Percent,
      color: 'text-emerald-400',
      border: 'border-slate-800'
    },
    {
      label: 'Review Rate',
      value: `${quality_metrics.human_review_rate}%`,
      subtext: 'Escalation requirement rate',
      icon: Clock,
      color: 'text-amber-400',
      border: 'border-slate-800'
    },
    {
      label: 'Currencies Detected',
      value: currenciesStr,
      subtext: 'Multi-currency scope',
      icon: Coins,
      color: 'text-blue-400',
      border: 'border-slate-800'
    },
    {
      label: 'Exception Counts',
      value: `${totalExceptions}`,
      subtext: 'Classified exception items',
      icon: Gauge,
      color: 'text-slate-300',
      border: 'border-slate-800'
    }
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-400">
          Canonical Reconciliation Portfolio Metrics
        </h3>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-800">
          Agent: {activeAgentVersion?.version_name || 'Agent V3'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border bg-slate-900/70 transition-all ${card.border}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 truncate">{card.label}</span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className={`text-lg font-bold font-mono mt-1 ${card.color}`}>
                {card.value}
              </p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5 font-sans">{card.subtext}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
