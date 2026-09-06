import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export function AutoReconciledCard({ style, className = '' }) {
  const defaultStyle = { right: 'calc(100% + 24px)', top: '-24px' };
  return (
    <div 
      style={{ ...defaultStyle, ...style }}
      className={`hidden lg:flex absolute z-20 w-[210px] p-4 rounded-2xl bg-[#D6FAE2] border border-[#86EFAC]/60 shadow-[0_10px_35px_-6px_rgba(0,0,0,0.08)] items-center space-x-3.5 select-none text-left cursor-default pointer-events-none ${className}`}
    >
      <div className="w-9 h-9 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0 shadow-xs">
        <CheckCircle2 className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[26px] font-extrabold text-black font-sans leading-none tracking-tight">
          92%
        </div>
        <div className="text-xs font-bold text-emerald-950 mt-0.5">
          Auto-reconciled
        </div>
        <div className="text-[10px] text-emerald-800 font-medium leading-tight mt-0.5">
          Straight-through processing
        </div>
      </div>
    </div>
  );
}
