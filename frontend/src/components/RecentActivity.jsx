import React from 'react';
import { Check, AlertTriangle, ShieldAlert, ArrowUpRight, UploadCloud, CheckCircle2 } from 'lucide-react';

export function RecentActivity({ batchData, onViewAll }) {
  // Dynamically derive real activities from real batch executions
  const activities = [];

  if (batchData) {
    if (batchData.auto_reconciled_count > 0) {
      activities.push({
        id: 'act-auto',
        title: `Auto-reconciled ${batchData.auto_reconciled_count} transactions`,
        time: batchData.created_at || 'Just now',
        icon: Check,
        iconBg: 'bg-pastel-mint text-emerald-700',
      });
    }
    if (batchData.escalated_count > 0) {
      activities.push({
        id: 'act-esc',
        title: `Flagged ${batchData.escalated_count} items for review`,
        time: batchData.created_at || 'Just now',
        icon: ShieldAlert,
        iconBg: 'bg-pastel-pink text-rose-700',
      });
    }
    if (batchData.bank_filename) {
      activities.push({
        id: 'act-file',
        title: `Imported ${batchData.bank_filename}`,
        time: batchData.created_at || 'Recently',
        icon: UploadCloud,
        iconBg: 'bg-pastel-blue text-sky-700',
      });
    }
    activities.push({
      id: 'act-comp',
      title: `Reconciliation batch completed (${batchData.total_bank_tx || batchData.results?.length || 0} records)`,
      time: batchData.created_at || 'Recently',
      icon: CheckCircle2,
      iconBg: 'bg-pastel-mint text-emerald-700',
    });
  }

  return (
    <div className="forge-card p-6 flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif font-bold text-lg text-ink">Recent Activity</h2>
        <button
          onClick={onViewAll}
          className="text-xs font-semibold text-ink-secondary hover:text-ink flex items-center space-x-0.5 transition-colors"
        >
          <span>View All</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs">
          <p className="font-medium text-slate-500">No activity yet</p>
          <p className="text-[11px] mt-0.5">Upload and reconcile transactions to see live event logs.</p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {activities.map((act) => {
            const Icon = act.icon;
            return (
              <div key={act.id} className="flex items-center space-x-3 group">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${act.iconBg}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-ink truncate group-hover:text-black">
                    {act.title}
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {act.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
