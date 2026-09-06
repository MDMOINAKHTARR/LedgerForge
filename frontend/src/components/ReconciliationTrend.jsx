import React, { useState } from 'react';

export function ReconciliationTrend({ batchData }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const results = batchData?.results || [];
  const hasRealData = results.length > 0;

  // Group real transactions by date if available
  const dateMap = {};
  if (hasRealData) {
    results.forEach(r => {
      const d = r.bank_tx?.date || r.date || 'Recent';
      if (!dateMap[d]) {
        dateMap[d] = { auto: 0, review: 0, exc: 0 };
      }
      if (r.action_taken === 'AUTO_RECONCILE') dateMap[d].auto += 1;
      else if (r.action_taken === 'ESCALATE_TO_HUMAN') dateMap[d].review += 1;
      else dateMap[d].exc += 1;
    });
  }

  const sortedDates = Object.keys(dateMap).sort();
  const dates = sortedDates.length > 0 ? sortedDates.slice(-7) : [];
  
  const autoReconciled = dates.map(d => dateMap[d].auto);
  const needsReview = dates.map(d => dateMap[d].review);
  const exceptions = dates.map(d => dateMap[d].exc);

  const maxVal = Math.max(1, ...autoReconciled, ...needsReview, ...exceptions);

  // SVG dimensions
  const width = 600;
  const height = 180;
  const paddingX = 25;
  const paddingY = 20;

  const getPoints = (arr) => {
    if (arr.length <= 1) {
      return [{ x: width / 2, y: height / 2, val: arr[0] || 0 }];
    }
    const stepX = (width - paddingX * 2) / (arr.length - 1);
    return arr.map((val, i) => {
      const x = paddingX + i * stepX;
      const y = height - paddingY - (val / maxVal) * (height - paddingY * 2);
      return { x, y, val };
    });
  };

  const autoPts = getPoints(autoReconciled);
  const reviewPts = getPoints(needsReview);
  const excPts = getPoints(exceptions);

  const createSmoothPath = (pts) => {
    if (pts.length <= 1) return '';
    return pts.reduce((acc, pt, i, a) => {
      if (i === 0) return `M ${pt.x},${pt.y}`;
      const prev = a[i - 1];
      const cpX1 = prev.x + (pt.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (pt.x - prev.x) / 2;
      const cpY2 = pt.y;
      return `${acc} C ${cpX1},${cpY1} ${cpX2},${cpY2} ${pt.x},${pt.y}`;
    }, '');
  };

  const autoPath = createSmoothPath(autoPts);
  const reviewPath = createSmoothPath(reviewPts);
  const excPath = createSmoothPath(excPts);
  const autoArea = autoPath ? `${autoPath} L ${autoPts[autoPts.length - 1].x},${height - paddingY} L ${autoPts[0].x},${height - paddingY} Z` : '';

  return (
    <div className="forge-card p-6 flex flex-col justify-between space-y-4">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif font-bold text-lg text-ink">Reconciliation Trend</h2>
          <p className="text-xs text-ink-secondary mt-0.5">Track your reconciliation performance over time.</p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[11px] font-medium text-slate-600">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Auto-reconciled</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Needs Review</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span>Exceptions</span>
          </div>
        </div>
      </div>

      {/* Responsive SVG Chart or Empty State */}
      {!hasRealData ? (
        <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
          <p className="font-semibold text-slate-500">No trend history available</p>
          <p className="text-[11px] mt-0.5">Upload real transactions to visualize performance curves across statement dates.</p>
        </div>
      ) : (
        <div className="w-full relative">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-44 overflow-visible"
          >
            <defs>
              <linearGradient id="autoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Subtle Grid Lines */}
            {[0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal].map((v, idx) => {
              const y = height - paddingY - (v / maxVal) * (height - paddingY * 2);
              return (
                <g key={idx}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                    stroke="#F1F5F9"
                    strokeWidth="1"
                    strokeDasharray={v === 0 ? '0' : '4 4'}
                  />
                  <text
                    x={paddingX - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[9px] fill-slate-400 font-mono"
                  >
                    {v}
                  </text>
                </g>
              );
            })}

            {/* Area under auto-reconciled */}
            {autoArea && <path d={autoArea} fill="url(#autoGradient)" />}

            {/* Line 1: Auto-reconciled (Mint Green) */}
            {autoPath && (
              <path
                d={autoPath}
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            )}

            {/* Line 2: Needs Review (Yellow) */}
            {reviewPath && (
              <path
                d={reviewPath}
                fill="none"
                stroke="#FBBF24"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            )}

            {/* Line 3: Exceptions (Pink) */}
            {excPath && (
              <path
                d={excPath}
                fill="none"
                stroke="#FB7185"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}

            {/* Interactive Dots on Auto Reconciled Line */}
            {autoPts.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={hoverIndex === i ? 5 : 3}
                fill="#10B981"
                stroke="#FFFFFF"
                strokeWidth="2"
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
              />
            ))}
          </svg>

          {/* X-Axis Date Labels */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-3 pt-1 border-t border-slate-100">
            {dates.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

