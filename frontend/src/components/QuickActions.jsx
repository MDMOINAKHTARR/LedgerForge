import React from 'react';
import { UploadCloud, FileSpreadsheet, BarChart3, Sliders } from 'lucide-react';

export function QuickActions({
  onUploadBankFile,
  onUploadLedgerFile,
  onGenerateReport,
  onManageRules,
}) {
  const actions = [
    {
      label: 'Upload Bank File',
      icon: UploadCloud,
      onClick: onUploadBankFile,
    },
    {
      label: 'Upload Ledger File',
      icon: FileSpreadsheet,
      onClick: onUploadLedgerFile,
    },
    {
      label: 'Generate Report',
      icon: BarChart3,
      onClick: onGenerateReport,
    },
    {
      label: 'Manage Rules',
      icon: Sliders,
      onClick: onManageRules,
    },
  ];

  return (
    <div className="forge-card p-6 flex flex-col justify-between space-y-4">
      <div>
        <h2 className="font-serif font-bold text-lg text-ink">Quick Actions</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((act, idx) => {
          const Icon = act.icon;
          return (
            <button
              key={idx}
              onClick={act.onClick}
              className="p-3.5 rounded-2xl border border-slate-200/80 bg-[#FAFAF8] hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all flex flex-col items-center justify-center text-center space-y-2 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center text-slate-700 group-hover:text-black group-hover:scale-105 transition-all shadow-2xs">
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-ink group-hover:text-black">
                {act.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
