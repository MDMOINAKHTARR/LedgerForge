import React from 'react';

export function WorksWithYouScriptText({ style, className = '' }) {
  const defaultStyle = { left: 'calc(100% + 32px)', top: '108px' };
  return (
    <div 
      style={{ ...defaultStyle, ...style }}
      className={`hidden lg:block absolute z-20 rotate-[5deg] select-none text-right cursor-default pointer-events-none ${className}`}
    >
      <p className="font-['Caveat',_cursive] text-[27px] text-slate-800 leading-[1.05]">
        AI that <br />
        works with you <br />
        not just for you
      </p>
      <svg width="110" height="12" viewBox="0 0 110 12" fill="none" className="text-emerald-500 ml-auto mt-0.5">
        <path d="M2 8C32 2 78 3 108 8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}
