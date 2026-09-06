import React from 'react';

export function TrustScriptText({ style, className = '' }) {
  const defaultStyle = { right: 'calc(100% + 32px)', top: '80px' };
  return (
    <div 
      style={{ ...defaultStyle, ...style }}
      className={`hidden lg:block absolute z-20 rotate-[-6deg] select-none text-left cursor-default pointer-events-none ${className}`}
    >
      <p className="font-['Caveat',_cursive] text-[27px] text-slate-800 leading-[1.05]">
        From <br />
        Transactions <br />
        to Trust
      </p>
      <svg width="90" height="12" viewBox="0 0 90 12" fill="none" className="text-amber-400 mt-0.5">
        <path d="M2 8C28 2 65 3 88 8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}
