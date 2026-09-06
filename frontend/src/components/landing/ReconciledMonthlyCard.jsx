import React from 'react';
import { Building2 } from 'lucide-react';

export function ReconciledMonthlyCard({ style, className = '' }) {
  const defaultStyle = { right: 'calc(100% + 24px)', top: '-130px' };
  return (
    <div 
      style={{ ...defaultStyle, ...style }}
      className={`hidden lg:flex absolute z-20 w-[220px] p-4 rounded-2xl bg-[#FFF6CC] border border-[#FDE047]/60 shadow-[0_10px_35px_-6px_rgba(0,0,0,0.08)] items-center space-x-3.5 select-none text-left cursor-default pointer-events-none ${className}`}
    >
      <div className="w-11 h-11 rounded-xl bg-[#FDE047]/60 flex items-center justify-center text-slate-900 shrink-0">
        <Building2 className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[26px] font-extrabold text-black font-sans leading-none tracking-tight">
          $1.2M
        </div>
        <div className="text-[11px] font-semibold text-slate-700 mt-1">
          Reconciled this month
        </div>
        <div className="text-[10px] font-bold text-emerald-700 mt-0.5 flex items-center space-x-0.5">
          <span>↑ +24% from last month</span>
        </div>
      </div>
    </div>
  );
}
