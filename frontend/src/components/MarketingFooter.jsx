import React from 'react';

function Github({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  );
}

function Twitter({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function Youtube({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.254.418-4.814a2.505 2.505 0 0 1 1.768-1.768C5.744 5 12 5 12 5s6.255 0 7.812.418ZM15.194 12 10 9v6l5.194-3Z" clipRule="evenodd" />
    </svg>
  );
}

export function MarketingFooter({ onNavigate, onEnterDashboard }) {
  const handleNav = (page, sectionId) => {
    if (onNavigate) {
      onNavigate(page, sectionId);
    }
  };

  // 5x5 Dot Matrix Generator with glowing cyan highlight dots
  const renderDotMatrix = (side) => {
    const rows = 5;
    const cols = 5;
    const dots = [];
    
    // Coordinates for the glowing cyan accent dots inspired by reference
    const highlightCoords = side === 'left' 
      ? [{ r: 1, c: 3 }, { r: 3, c: 1 }, { r: 4, c: 3 }] 
      : [{ r: 1, c: 1 }, { r: 2, c: 3 }, { r: 4, c: 2 }];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isHighlight = highlightCoords.some(coord => coord.r === r && coord.c === c);
        const x = side === 'left' ? 12 + c * 11 : 36 + c * 11;
        const y = 13 + r * 11;
        
        dots.push(
          <circle
            key={`${side}-${r}-${c}`}
            cx={x}
            cy={y}
            r={isHighlight ? 2.3 : 1.2}
            className={isHighlight ? "fill-cyan-300 animate-pulse" : "fill-white/40"}
            style={isHighlight ? { filter: 'drop-shadow(0 0 3px rgba(34, 211, 238, 0.95))' } : undefined}
          />
        );
      }
    }
    return dots;
  };

  return (
    <footer 
      className="w-full relative mt-auto overflow-hidden select-text"
      style={{
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F1F6FD 18%, #D5E4FA 42%, #9FC2EE 68%, #7297D6 88%, #648CD0 100%)',
      }}
    >
      {/* Subtle fine technical atmospheric overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-25 z-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Main Footer Content Container - Tightened edge padding to eliminate empty side gaps */}
      <div className="w-full max-w-[1536px] mx-auto px-6 sm:px-8 lg:px-8 xl:px-10 pt-10 sm:pt-14 pb-4 relative z-10">
        
        {/* UPPER ROW: THREE EQUAL COLUMNS WITH BUTTON AT EXACT DEAD-CENTER AND BALANCED SPACING */}
        <div className="grid grid-cols-1 lg:grid-cols-3 items-center gap-8 lg:gap-4 pb-6 sm:pb-8">
          
          {/* 1. LEFT COLUMN — SOCIAL ICONS, EMAIL, SYSTEM DETAILS */}
          <div className="w-full flex flex-col items-start justify-center space-y-3.5 text-left">
            
            {/* Social Icons Row: GitHub, YouTube Demo, Twitter / X */}
            <div className="flex items-center space-x-3.5">
              <a
                href="https://github.com/MDMOINAKHTARR/LedgerForge"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-slate-700/35 flex items-center justify-center text-slate-800 hover:text-black hover:border-slate-900 hover:bg-white/40 transition-all cursor-pointer"
                aria-label="GitHub Repository"
                title="GitHub Repository"
              >
                <Github className="w-4 h-4" />
              </a>

              <a
                href="https://youtu.be/G-fjDaS-v9s?si=LyFc57JoiQ_-Bzn6"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-slate-700/35 flex items-center justify-center text-slate-800 hover:text-black hover:border-slate-900 hover:bg-white/40 transition-all cursor-pointer"
                aria-label="Watch YouTube Demo"
                title="Watch YouTube Demo"
              >
                <Youtube className="w-4 h-4" />
              </a>

              <a
                href="https://x.com/___moinn_/status/2097019500835311787?s=20"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-full border border-slate-700/35 flex items-center justify-center text-slate-800 hover:text-black hover:border-slate-900 hover:bg-white/40 transition-all cursor-pointer"
                aria-label="Twitter / X Post"
                title="Twitter / X Post"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>

            {/* Prominent Contact Email */}
            <div>
              <a
                href="mailto:hello@ledgerforge.io"
                className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight hover:text-black transition-colors block"
              >
                hello@ledgerforge.io
              </a>
            </div>

            {/* System Philosophy & Infrastructure Details (Authentic, no fake address) */}
            <div className="text-xs text-slate-700/85 leading-relaxed font-sans space-y-0.5 max-w-[260px]">
              <p>Autonomous Reconciliation Infrastructure</p>
              <p>AI Investigates • Deterministic Controls Decide</p>
              <p>Zero Black-Box Authority • Audit Provenance</p>
            </div>

          </div>

          {/* 2. CENTER COLUMN — EXACT MATHEMATICAL DEAD-CENTER CTA & BALANCED BRACKETS */}
          <div className="w-full flex items-center justify-center text-center">
            <div className="flex items-center justify-center space-x-0">
              
              {/* Left Bracket Frame with Dot Matrix & Glowing Cyan Accents */}
              <div className="hidden sm:flex items-center justify-end">
                <svg width="90" height="70" viewBox="0 0 90 70" fill="none" className="overflow-visible">
                  {/* Dot Matrix */}
                  {renderDotMatrix('left')}
                  {/* Bracket Outline: opens to the left */}
                  <path
                    d="M 44 6 L 62 6 C 68 6 72 10 72 16 L 72 54 C 72 60 68 64 62 64 L 44 64"
                    stroke="rgba(255, 255, 255, 0.65)"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    fill="none"
                  />
                  {/* Connector Line meeting Button */}
                  <line
                    x1="72"
                    y1="35"
                    x2="90"
                    y2="35"
                    stroke="rgba(255, 255, 255, 0.75)"
                    strokeWidth="1.25"
                  />
                </svg>
              </div>

              {/* Center Dark CTA Pill Button with Badge */}
              <div className="shrink-0 px-1 sm:px-0">
                <button
                  type="button"
                  onClick={onEnterDashboard}
                  className="bg-[#121620] hover:bg-[#0b0e16] text-white font-medium text-xs sm:text-sm py-3 px-5 sm:px-6 rounded-xl shadow-xl hover:shadow-2xl transition-all flex items-center space-x-2.5 border border-white/15 cursor-pointer group hover:-translate-y-0.5 active:translate-y-0 shrink-0"
                  aria-label="Launch LedgerForge Demo"
                >
                  <span className="font-sans font-medium tracking-tight whitespace-nowrap">
                    Launch LedgerForge
                  </span>
                  <span className="bg-[#222a3d] text-[#86a8e7] text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-[#364463] uppercase tracking-wider">
                    LIVE
                  </span>
                </button>
              </div>

              {/* Right Bracket Frame with Dot Matrix & Glowing Cyan Accents */}
              <div className="hidden sm:flex items-center justify-start">
                <svg width="90" height="70" viewBox="0 0 90 70" fill="none" className="overflow-visible">
                  {/* Dot Matrix */}
                  {renderDotMatrix('right')}
                  {/* Connector Line from Button */}
                  <line
                    x1="0"
                    y1="35"
                    x2="18"
                    y2="35"
                    stroke="rgba(255, 255, 255, 0.75)"
                    strokeWidth="1.25"
                  />
                  {/* Bracket Outline: opens to the right */}
                  <path
                    d="M 46 6 L 28 6 C 22 6 18 10 18 16 L 18 54 C 18 60 22 64 28 64 L 46 64"
                    stroke="rgba(255, 255, 255, 0.65)"
                    strokeWidth="1.25"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </div>

            </div>
          </div>

          {/* 3. RIGHT COLUMN — VERTICAL NAVIGATION COLUMN (REDUCED SPACE ON THE RIGHT) */}
          <div className="w-full flex justify-start lg:justify-end">
            <nav className="flex flex-col space-y-2.5 sm:space-y-3 text-left lg:text-right font-sans text-base sm:text-[17px] font-semibold text-slate-900 tracking-tight">
              <button
                type="button"
                onClick={() => handleNav('products')}
                className="hover:text-black hover:translate-x-0.5 transition-all text-left lg:text-right cursor-pointer"
              >
                Platform
              </button>
              <button
                type="button"
                onClick={() => handleNav('products', 'engine')}
                className="hover:text-black hover:translate-x-0.5 transition-all text-left lg:text-right cursor-pointer"
              >
                Reconciliation
              </button>
              <button
                type="button"
                onClick={() => handleNav('resources')}
                className="hover:text-black hover:translate-x-0.5 transition-all text-left lg:text-right cursor-pointer"
              >
                Resources
              </button>
              <button
                type="button"
                onClick={() => handleNav('security')}
                className="hover:text-black hover:translate-x-0.5 transition-all text-left lg:text-right cursor-pointer"
              >
                Governance
              </button>
              <button
                type="button"
                onClick={() => handleNav('how-it-works')}
                className="hover:text-black hover:translate-x-0.5 transition-all text-left lg:text-right cursor-pointer"
              >
                About
              </button>
            </nav>
          </div>

        </div>

        {/* LOWER ROW: CLEAN LEGAL & UTILITY ROW MATCHING REFERENCE (FLUSH WITH LEFT AND RIGHT) */}
        <div className="pt-5 sm:pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-700/90 gap-3 font-sans border-t border-white/25">
          
          {/* Left: Terms and Conditions */}
          <div className="w-full sm:w-auto text-left">
            <button 
              type="button" 
              onClick={() => handleNav('security', 'guardrails')}
              className="hover:text-black underline underline-offset-4 decoration-slate-400 hover:decoration-black transition-colors cursor-pointer"
            >
              Terms and conditions
            </button>
          </div>

          {/* Center: Copyright Statement */}
          <div className="w-full sm:w-auto text-center font-normal text-slate-700">
            © {new Date().getFullYear()} LedgerForge. All Rights Reserved
          </div>

          {/* Right: Privacy Policy */}
          <div className="w-full sm:w-auto text-right">
            <button 
              type="button" 
              onClick={() => handleNav('security', 'audit')}
              className="hover:text-black underline underline-offset-4 decoration-slate-400 hover:decoration-black transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
          </div>

        </div>

        {/* GIANT LUMINOUS WHITE WORDMARK - DYNAMICALLY SIZED TO FILL THE SPACE FROM LEFT TO RIGHT */}
        <div 
          className="w-full overflow-hidden select-none pointer-events-none mt-2 sm:mt-3 pt-1 flex justify-center text-center"
          aria-hidden="true"
        >
          <span 
            className="font-sans font-bold tracking-tight text-[13.2vw] leading-none text-white/[0.28] whitespace-nowrap lowercase block translate-y-2 sm:translate-y-4"
            style={{
              textShadow: '0 1px 25px rgba(255, 255, 255, 0.12)'
            }}
          >
            ledgerforge
          </span>
        </div>

      </div>
    </footer>
  );
}
