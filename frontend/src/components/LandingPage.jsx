import React, { useState } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  FileText, 
  Play, 
  ArrowRight, 
  ChevronDown,
  Search,
  Filter,
  MoreHorizontal,
  LayoutDashboard,
  FileCheck,
  ListOrdered,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
  Settings,
  Calendar,
  Sparkles
} from 'lucide-react';
import {
  ReconciledMonthlyCard,
  AutoReconciledCard,
  TrustScriptText,
  MeetForgeCard,
  AuditTrailCard,
  WorksWithYouScriptText
} from './landing';

export function LandingPage({ onEnterDashboard, onOpenHowItWorks }) {
  return (
    <div className="min-h-screen text-[#18181B] flex flex-col font-sans selection:bg-amber-100 selection:text-black relative overflow-x-hidden">
      
      {/* Permanent Indigo Blue Radial Gradient Background */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(125% 125% at 50% 10%, #ffffff 40%, #6366f1 100%)",
        }}
      />

      {/* 1. TOP NAVBAR */}
      <header className="w-full max-w-[1240px] mx-auto px-6 h-18 py-4 flex items-center justify-between z-20 shrink-0">
        {/* Brand Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={onEnterDashboard}>
          <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center text-white shadow-xs">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
            </svg>
          </div>
          <div>
            <div className="font-sans font-bold text-lg text-black tracking-tight leading-none">
              Ledger Forge
            </div>
            <p className="text-[8px] font-mono tracking-widest text-slate-400 uppercase mt-0.5 font-semibold">
              RECONCILE WITH CONFIDENCE
            </p>
          </div>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center space-x-7 text-xs font-semibold text-slate-600">
          <div className="flex items-center space-x-1 cursor-pointer hover:text-black transition-colors">
            <span>Products</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </div>
          <button 
            type="button"
            onClick={onOpenHowItWorks} 
            className="hover:text-black transition-colors cursor-pointer text-xs font-semibold text-slate-600 bg-transparent border-0 p-0"
          >
            How It Works
          </button>
          <a href="#security" onClick={(e) => { e.preventDefault(); onEnterDashboard(); }} className="hover:text-black transition-colors">
            Security
          </a>
          <a href="#resources" onClick={(e) => { e.preventDefault(); onEnterDashboard(); }} className="hover:text-black transition-colors">
            Resources
          </a>
          <a href="#pricing" onClick={(e) => { e.preventDefault(); onEnterDashboard(); }} className="hover:text-black transition-colors">
            Pricing
          </a>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center space-x-4">
          <button 
            onClick={onEnterDashboard}
            className="text-xs font-semibold text-slate-700 hover:text-black transition-colors px-2 py-1"
          >
            Sign In
          </button>
          <button 
            onClick={onEnterDashboard}
            className="bg-black hover:bg-zinc-800 text-white font-semibold text-xs py-2 px-5 rounded-full shadow-xs hover:shadow transition-all"
          >
            Get Started
          </button>
        </div>
      </header>

      {/* 2. HERO HEADLINE & ACTIONS */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 pt-4 pb-14 flex flex-col items-center text-center relative z-10">
        
        {/* Eyebrow */}
        <div className="text-[11px] font-mono font-bold tracking-[0.25em] text-slate-400 uppercase mb-2">
          AI FOR A MORE ACCURATE TOMORROW
        </div>

        {/* Main Editorial Headline Matching Reference Image */}
        <h1 className="editorial-headline text-4xl sm:text-5xl lg:text-[58px] xl:text-[63px] font-[550] text-black tracking-[-0.022em] leading-[1.08] sm:leading-[1.12] w-full max-w-[880px] mx-auto text-center">
          Autonomous Reconciliation. <br className="hidden sm:inline" />
          Built for Trust.
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mt-3.5 leading-relaxed font-sans">
          Ledger Forge reconciles bank transactions, knows when to stop and ask, <br className="hidden sm:inline" />
          and leaves every decision audit-ready.
        </p>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center space-x-3.5 mt-6 z-20">
          <button 
            onClick={onEnterDashboard}
            className="bg-black hover:bg-zinc-800 text-white text-xs font-semibold py-2.5 px-6 rounded-full flex items-center space-x-2 shadow-sm hover:shadow transition-all"
          >
            <span>Start Reconciliation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button 
            type="button"
            onClick={onOpenHowItWorks}
            className="bg-white hover:bg-slate-50 text-black border border-slate-300 text-xs font-semibold py-2.5 px-5 rounded-full flex items-center space-x-2 shadow-2xs transition-all cursor-pointer"
          >
            <div className="w-4 h-4 rounded-full border border-black flex items-center justify-center">
              <Play className="w-2 h-2 fill-current ml-0.5" />
            </div>
            <span>See How It Works</span>
          </button>
        </div>

        {/* 3. HERO COMPOSITION: PROPORTIONAL WIDE SCREEN WITH NON-OVERLAPPING FLANKING CARDS */}
        <div className="w-full max-w-[1400px] mx-auto mt-10 relative flex items-center justify-center min-h-[580px] lg:min-h-[600px]">
          
          {/* ANCHOR: Proportional Central Product Device (w-[900px], h-[560px] for natural 1.6:1 ratio) */}
          <div 
            className="relative w-full max-w-[860px] xl:w-[900px] shrink-0 bg-[#141717] rounded-[28px] p-3 sm:p-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.35)] border border-slate-700/60 text-left z-10 select-none cursor-default"
          >
            {/* Top Device Camera/Dot */}
            <div className="w-2 h-2 rounded-full bg-zinc-800 mx-auto -mt-0.5 mb-2 opacity-60" />

            {/* Inner Application Window */}
            <div className="bg-white rounded-[20px] overflow-hidden flex h-[530px] lg:h-[560px] border border-slate-200/60 relative pointer-events-none select-none">
              
              {/* Mini Left Sidebar (Dark #161919) */}
              <div className="w-48 bg-[#161919] text-slate-300 p-4 hidden sm:flex flex-col justify-between shrink-0 select-none text-[11px]">
                <div className="space-y-5">
                  {/* Brand */}
                  <div className="flex items-center space-x-2.5 text-white">
                    <div className="w-5.5 h-5.5 rounded-md bg-white/10 flex items-center justify-center text-white">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                        <path d="M2 12L12 17L22 12" opacity="0.8" />
                        <path d="M2 17L12 22L22 17" opacity="0.6" />
                      </svg>
                    </div>
                    <span className="font-sans font-bold text-[13px] tracking-tight text-white">Ledger Forge</span>
                  </div>

                  {/* Menu Items */}
                  <div className="space-y-1 font-medium">
                    <div className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>Dashboard</span>
                    </div>
                    <div className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg bg-zinc-800 text-white font-semibold shadow-xs">
                      <FileCheck className="w-3.5 h-3.5 text-white" />
                      <span>Reconciliation</span>
                    </div>
                    <div className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>Transactions</span>
                    </div>
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <div className="flex items-center space-x-2.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Exceptions</span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white">12</span>
                    </div>
                    <div className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Audit Trail</span>
                    </div>
                    <div className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Reports</span>
                    </div>
                    <div className="flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <Settings className="w-3.5 h-3.5" />
                      <span>Settings</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500 font-mono pt-3 border-t border-zinc-800/80 leading-relaxed">
                  Reconcile smarter.<br />Build trust.
                </div>
              </div>

              {/* Main Workspace Inside Device (White) */}
              <div className="flex-1 p-4 sm:p-5 bg-white flex flex-col justify-between space-y-3 overflow-hidden">
                
                {/* Header row */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-serif font-bold text-[17px] text-black">Reconciliation</h3>
                    <p className="text-[11px] text-slate-500">Match, review and post bank transactions with AI.</p>
                  </div>
                  <div className="flex items-center space-x-2.5">
                    <div className="flex items-center space-x-1.5 text-[11px] font-mono px-3 py-1 bg-slate-50 rounded-full border border-slate-200 text-slate-600">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Aug 1, 2024 – Aug 31, 2024</span>
                    </div>
                    <button className="bg-black hover:bg-zinc-800 text-white text-[11px] font-semibold py-1.5 px-3.5 rounded-full shadow-xs transition-colors">
                      Run Reconciliation
                    </button>
                  </div>
                </div>

                {/* 4 Metric Cards Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center space-x-1 text-slate-400 mb-0.5">
                      <FileText className="w-3 h-3 text-blue-500" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Total Transactions</span>
                    </div>
                    <span className="text-base font-extrabold text-black mt-0.5 block">1,248</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#DCFCE7] border border-[#BBF7D0]">
                    <div className="flex items-center space-x-1 text-emerald-700 mb-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span className="text-[9px] font-bold text-emerald-950 uppercase">Auto-reconciled</span>
                    </div>
                    <span className="text-base font-extrabold text-emerald-950 mt-0.5 block">92%</span>
                    <span className="text-[9px] text-emerald-800 block">1,148 transactions</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#FFE4E6] border border-[#FECDD3]">
                    <div className="flex items-center space-x-1 text-rose-700 mb-0.5">
                      <AlertTriangle className="w-3 h-3 text-rose-600" />
                      <span className="text-[9px] font-bold text-rose-950 uppercase">Needs Review</span>
                    </div>
                    <span className="text-base font-extrabold text-rose-950 mt-0.5 block">8%</span>
                    <span className="text-[9px] text-rose-800 block">100 transactions</span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center space-x-1 text-slate-400 mb-0.5">
                      <ShieldCheck className="w-3 h-3 text-indigo-500" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase">Audit Trail</span>
                    </div>
                    <span className="text-base font-extrabold text-black mt-0.5 block">100%</span>
                    <span className="text-[9px] text-slate-500 block">All decisions logged</span>
                  </div>
                </div>

                {/* Filter Tabs Bar */}
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <div className="flex items-center space-x-3.5 font-semibold">
                    <span className="text-black border-b-2 border-black pb-0.5">All Transactions (1,248)</span>
                    <span className="text-slate-400 hover:text-slate-600 cursor-pointer">Reconciled (1,148)</span>
                    <span className="text-slate-400 hover:text-slate-600 cursor-pointer">Needs Review (100)</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-slate-400 text-[10px]">
                      <Search className="w-3 h-3" />
                      <span>Search transactions...</span>
                    </div>
                    <button className="flex items-center space-x-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-slate-600 font-semibold text-[10px]">
                      <Filter className="w-2.5 h-2.5" />
                      <span>Filter</span>
                    </button>
                    <button className="p-1 text-slate-400 hover:text-slate-600">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 6 Transactions Rows */}
                <div className="border border-slate-100 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-mono text-[9px] uppercase bg-slate-50/70">
                        <th className="py-2 px-2.5 w-4"><input type="checkbox" className="rounded" readOnly /></th>
                        <th className="py-2 px-2.5">Date</th>
                        <th className="py-2 px-2.5">Description</th>
                        <th className="py-2 px-2.5 text-right">Amount</th>
                        <th className="py-2 px-2.5">Match</th>
                        <th className="py-2 px-2.5">Confidence</th>
                        <th className="py-2 px-2.5">Status</th>
                        <th className="py-2 px-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="py-2 px-2.5"><input type="checkbox" className="rounded" readOnly /></td>
                        <td className="py-2 px-2.5 text-slate-400 whitespace-nowrap font-mono text-[10px]">Aug 28, 2024</td>
                        <td className="py-2 px-2.5 font-semibold text-black">ACME Corp Payment</td>
                        <td className="py-2 px-2.5 text-right font-bold font-mono">$12,450.00</td>
                        <td className="py-2 px-2.5 text-slate-600">Exact match</td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-emerald-700 text-[10px]">99%</span>
                            <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="w-full h-full bg-emerald-500 rounded-full" />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-emerald-900 text-[9px] font-bold">Auto-posted</span>
                        </td>
                        <td className="py-2 px-2.5 text-center text-slate-400">···</td>
                      </tr>

                      <tr>
                        <td className="py-2 px-2.5"><input type="checkbox" className="rounded" readOnly /></td>
                        <td className="py-2 px-2.5 text-slate-400 whitespace-nowrap font-mono text-[10px]">Aug 27, 2024</td>
                        <td className="py-2 px-2.5 font-semibold text-black">Amazon Web Services</td>
                        <td className="py-2 px-2.5 text-right font-bold font-mono">$299.00</td>
                        <td className="py-2 px-2.5 text-slate-600">Fuzzy match</td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-emerald-700 text-[10px]">92%</span>
                            <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="w-[92%] h-full bg-emerald-500 rounded-full" />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-emerald-900 text-[9px] font-bold">Auto-posted</span>
                        </td>
                        <td className="py-2 px-2.5 text-center text-slate-400">···</td>
                      </tr>

                      <tr>
                        <td className="py-2 px-2.5"><input type="checkbox" className="rounded" readOnly /></td>
                        <td className="py-2 px-2.5 text-slate-400 whitespace-nowrap font-mono text-[10px]">Aug 27, 2024</td>
                        <td className="py-2 px-2.5 font-semibold text-black">Client Payment – INV-1042</td>
                        <td className="py-2 px-2.5 text-right font-bold font-mono">$8,750.00</td>
                        <td className="py-2 px-2.5 text-slate-600">Exact match</td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-emerald-700 text-[10px]">98%</span>
                            <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="w-[98%] h-full bg-emerald-500 rounded-full" />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-emerald-900 text-[9px] font-bold">Auto-posted</span>
                        </td>
                        <td className="py-2 px-2.5 text-center text-slate-400">···</td>
                      </tr>

                      <tr>
                        <td className="py-2 px-2.5"><input type="checkbox" className="rounded" readOnly /></td>
                        <td className="py-2 px-2.5 text-slate-400 whitespace-nowrap font-mono text-[10px]">Aug 26, 2024</td>
                        <td className="py-2 px-2.5 font-semibold text-black">Office Depot</td>
                        <td className="py-2 px-2.5 text-right font-bold font-mono">$156.20</td>
                        <td className="py-2 px-2.5 text-slate-600">Fuzzy match</td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-amber-700 text-[10px]">87%</span>
                            <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="w-[87%] h-full bg-amber-400 rounded-full" />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-[#FEF9C3] text-amber-900 text-[9px] font-bold">Needs review</span>
                        </td>
                        <td className="py-2 px-2.5 text-center text-slate-400">···</td>
                      </tr>

                      <tr>
                        <td className="py-2 px-2.5"><input type="checkbox" className="rounded" readOnly /></td>
                        <td className="py-2 px-2.5 text-slate-400 whitespace-nowrap font-mono text-[10px]">Aug 25, 2024</td>
                        <td className="py-2 px-2.5 font-semibold text-black">Wire Transfer</td>
                        <td className="py-2 px-2.5 text-right font-bold font-mono">$25,000.00</td>
                        <td className="py-2 px-2.5 text-slate-600">Partial match</td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-amber-700 text-[10px]">76%</span>
                            <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="w-[76%] h-full bg-amber-400 rounded-full" />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-[#FEF9C3] text-amber-900 text-[9px] font-bold">Needs review</span>
                        </td>
                        <td className="py-2 px-2.5 text-center text-slate-400">···</td>
                      </tr>

                      <tr>
                        <td className="py-2 px-2.5"><input type="checkbox" className="rounded" readOnly /></td>
                        <td className="py-2 px-2.5 text-slate-400 whitespace-nowrap font-mono text-[10px]">Aug 24, 2024</td>
                        <td className="py-2 px-2.5 font-semibold text-black">Stripe Payout</td>
                        <td className="py-2 px-2.5 text-right font-bold font-mono">$2,430.00</td>
                        <td className="py-2 px-2.5 text-slate-600">Exact match</td>
                        <td className="py-2 px-2.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-emerald-700 text-[10px]">96%</span>
                            <div className="w-10 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="w-[96%] h-full bg-emerald-500 rounded-full" />
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-emerald-900 text-[9px] font-bold">Auto-posted</span>
                        </td>
                        <td className="py-2 px-2.5 text-center text-slate-400">···</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Bottom Soft Fade Overlay */}
              <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white/95 via-white/40 to-transparent pointer-events-none rounded-b-[20px] z-10" />

            </div>

            {/* ========================================================= */}
            {/* MODULAR FLANKING COMPONENTS (LEFT & RIGHT) */}
            {/* ========================================================= */}
            {/* Left Side: $1.2M Reconciled, 92% Auto-reconciled, Script Text */}
            <ReconciledMonthlyCard />
            <AutoReconciledCard />
            <TrustScriptText />

            {/* Right Side: Meet Forge (Mascot), 100% Audit Trail, Script Text */}
            <MeetForgeCard />
            <AuditTrailCard />
            <WorksWithYouScriptText />

            {/* Device Soft Bottom Fade Overlay */}
            <div className="absolute -bottom-1 inset-x-0 h-16 bg-gradient-to-t from-[#FAFAF8] via-[#FAFAF8]/50 to-transparent pointer-events-none rounded-b-[28px] z-15" />

          </div>

        </div>

        {/* 4. TRUSTED BY MODERN FINANCE TEAMS PARTNER LOGO BAR */}
        <div className="w-full max-w-[1020px] mt-16 pt-8 border-t border-slate-200/80">
          <div className="text-[10px] font-mono font-bold tracking-[0.25em] text-slate-400 uppercase text-center mb-6">
            TRUSTED BY MODERN FINANCE TEAMS
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-slate-400 font-serif font-bold text-lg sm:text-xl select-none">
            {/* Nexora */}
            <div className="flex items-center space-x-1.5 hover:text-black transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 4L12 12L20 4M4 20L12 12L20 20" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="tracking-tight">Nexora</span>
            </div>

            {/* BrightBooks */}
            <div className="flex items-center space-x-1.5 hover:text-black transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="8"/>
                <circle cx="12" cy="3" r="1.5"/>
                <circle cx="12" cy="21" r="1.5"/>
                <circle cx="3" cy="12" r="1.5"/>
                <circle cx="21" cy="12" r="1.5"/>
              </svg>
              <span className="tracking-tight">BrightBooks</span>
            </div>

            {/* Summit Finance */}
            <div className="flex items-center space-x-1.5 hover:text-black transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 20V14M10 20V9M16 20V4M22 20V12" strokeLinecap="round"/>
              </svg>
              <span className="tracking-tight">Summit Finance</span>
            </div>

            {/* Orion Capital */}
            <div className="flex items-center space-x-1.5 hover:text-black transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 3V21M3 12H21"/>
              </svg>
              <span className="tracking-tight">Orion Capital</span>
            </div>

            {/* MaplePay */}
            <div className="flex items-center space-x-1.5 hover:text-black transition-colors">
              <span className="font-sans font-black text-xl">M</span>
              <span className="tracking-tight">MaplePay</span>
            </div>

            {/* Vertex */}
            <div className="flex items-center space-x-1.5 hover:text-black transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22L2 4H22L12 22Z"/>
              </svg>
              <span className="tracking-tight">Vertex</span>
            </div>
          </div>
        </div>

      </main>

      {/* 5. Minimal Footer */}
      <footer className="py-6 border-t border-slate-200 text-center text-xs text-slate-400 font-sans">
        Ledger Forge Autonomous Bank Reconciliation Platform • “Knows when to stop and ask.”
      </footer>

    </div>
  );
}
