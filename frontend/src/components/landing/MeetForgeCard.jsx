import React from 'react';

export function MeetForgeCard({ style, className = '' }) {
  const defaultStyle = { left: 'calc(100% + 24px)', top: '-160px' };
  return (
    <div 
      style={{ ...defaultStyle, ...style }}
      className={`hidden lg:flex absolute z-20 w-[260px] p-4 pt-3.5 rounded-2xl bg-[#FFF2FE] border border-[#F3E8FF] shadow-[0_10px_35px_-6px_rgba(0,0,0,0.08)] select-none text-left overflow-visible cursor-default pointer-events-none ${className}`}
    >
      <div className="w-[135px] space-y-1 relative z-20">
        <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider">
          Meet Forge
        </div>
        <div className="font-serif font-bold text-[17px] text-black leading-tight">
          Your AI <br />
          Reconciliation <br />
          Agent
        </div>
        <p className="text-[11px] font-medium text-slate-600 italic pt-1 leading-snug">
          “Knows when to stop and ask.”
        </p>
      </div>

      {/* 3D Robot Mascot extending above the card */}
      <div className="absolute -right-2.5 -top-14 w-32 h-44 pointer-events-none drop-shadow-xl z-30">
        <img
          src="/assets/forge_mascot_cutout.png"
          alt="Forge AI Mascot"
          className="w-full h-full object-contain"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/assets/forge_mascot_exact.png';
          }}
        />
      </div>
    </div>
  );
}
