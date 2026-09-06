import React from 'react';
import { FileText } from 'lucide-react';

export function AuditTrailCard({ style, className = '' }) {
  const defaultStyle = { left: 'calc(100% + 24px)', top: '-2px' };
  return (
    <div 
      style={{ ...defaultStyle, ...style }}
      className={`hidden lg:flex absolute z-20 w-[205px] p-4 rounded-2xl bg-[#FAFAFA] border border-slate-200 shadow-[0_10px_35px_-6px_rgba(0,0,0,0.08)] items-center space-x-3.5 select-none text-left cursor-default pointer-events-none ${className}`}
    >
      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
        <FileText className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[26px] font-extrabold text-black font-sans leading-none tracking-tight">
          100%
        </div>
        <div className="text-xs font-bold text-black mt-0.5">
          Audit Trail
        </div>
        <div className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">
          Every decision logged and explainable.
        </div>
      </div>
    </div>
  );
}
