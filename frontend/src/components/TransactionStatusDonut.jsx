import React from 'react';

export function TransactionStatusDonut({ total = 0, autoPct = 0, reviewPct = 0, excPct = 0 }) {
  // SVG Donut calculation
  const size = 150;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Segment calculations
  const autoStroke = (autoPct / 100) * circumference;
  const reviewStroke = (reviewPct / 100) * circumference;
  const excStroke = (excPct / 100) * circumference;

  return (
    <div className="forge-card p-6 flex flex-col justify-between space-y-4">
      <div>
        <h2 className="font-serif font-bold text-lg text-ink">Transaction Status</h2>
      </div>

      <div className="flex items-center justify-center my-2 relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#F4F4F5"
            strokeWidth={strokeWidth}
          />

          {/* Segment 1: Auto-reconciled (Mint Green) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#10B981"
            strokeWidth={strokeWidth}
            strokeDasharray={`${autoStroke} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />

          {/* Segment 2: Needs Review (Yellow) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#FBBF24"
            strokeWidth={strokeWidth}
            strokeDasharray={`${reviewStroke} ${circumference}`}
            strokeDashoffset={-autoStroke}
            strokeLinecap="round"
          />

          {/* Segment 3: Exceptions (Pink) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#FB7185"
            strokeWidth={strokeWidth}
            strokeDasharray={`${excStroke} ${circumference}`}
            strokeDashoffset={-(autoStroke + reviewStroke)}
            strokeLinecap="round"
          />
        </svg>

        {/* Donut Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-xl font-bold font-sans text-ink leading-none">
            {total.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-1">
            Transactions
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs font-medium">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Auto-reconciled</span>
          </div>
          <span className="font-bold text-ink">{autoPct}%</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Needs Review</span>
          </div>
          <span className="font-bold text-ink">{reviewPct}%</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span>Exceptions</span>
          </div>
          <span className="font-bold text-ink">{excPct}%</span>
        </div>
      </div>
    </div>
  );
}
