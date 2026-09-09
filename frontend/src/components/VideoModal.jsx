import React, { useEffect } from 'react';
import { X, ExternalLink, Play, CheckCircle2, ArrowRight } from 'lucide-react';

export function VideoModal({ 
  isOpen, 
  onClose, 
  videoId = 'G-fjDaS-v9s',
  title = 'LedgerForge | Autonomous Bank Reconciliation Engine Demo',
  onEnterDashboard
}) {
  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Prevent background scroll
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Modal Card Container (Light Theme) */}
      <div 
        className="relative w-full max-w-4xl bg-white/95 backdrop-blur-2xl border border-white/90 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.2),0_10px_30px_-10px_rgba(244,90,140,0.18)] rounded-2xl sm:rounded-3xl overflow-hidden text-slate-900 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle luminous pink ambient glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-28 bg-gradient-to-b from-rose-200/60 to-transparent blur-3xl pointer-events-none rounded-full" />

        {/* Top Header Bar (Light Theme) */}
        <div className="relative z-10 px-5 sm:px-6 py-3.5 border-b border-slate-100 flex items-center justify-between gap-4 bg-white/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
              <Play className="w-3 h-3 fill-current ml-0.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-700 font-bold px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200/80">
                  Product Walkthrough
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 truncate mt-0.5 font-sans">
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200/70 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 16:9 Video Embed Player */}
        <div className="relative w-full aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
          <iframe
            className="w-full h-full border-0"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {/* Bottom Highlights & Actions Strip (Light Theme) */}
        <div className="relative z-10 px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Key Topics in Video */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
            <span className="flex items-center gap-1 text-slate-800 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Multi-Currency Normalizer
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="flex items-center gap-1 text-slate-800 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Exact Delta Match
            </span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="flex items-center gap-1 text-slate-800 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Auditor Trace Envelopes
            </span>
          </div>

          {/* Action Links */}
          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href={`https://youtu.be/${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-950 transition-all text-xs font-semibold cursor-pointer shadow-2xs"
            >
              <span>Watch on YouTube</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            {onEnterDashboard && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEnterDashboard();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-950 hover:bg-black text-white transition-all text-xs font-semibold cursor-pointer shadow-xs"
              >
                <span>Launch App</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VideoModal;
