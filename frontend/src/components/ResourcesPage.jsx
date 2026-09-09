import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  CheckCircle2, 
  Layers, 
  Database, 
  FileText, 
  Code, 
  ShieldCheck, 
  Sparkles,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { MarketingNavbar } from './MarketingNavbar';
import { MarketingFooter } from './MarketingFooter';
import { PinkGradientBackground } from './ui/favorites';

export function ResourcesPage({ onNavigate, onEnterDashboard }) {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [expandedConcept, setExpandedConcept] = useState('timing');

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const concepts = [
    {
      id: 'timing',
      title: 'Timing Differences',
      short: 'Delays between bank clearing and ledger booking dates.',
      detail: 'Transactions often clear bank rails days after an accountant posts an invoice or vendor payment. LedgerForge uses a configurable date proximity window (±7 days by default) combined with exact reference matching to eliminate false discrepancies caused solely by settlement float.'
    },
    {
      id: 'partial',
      title: 'Partial Payments',
      short: 'Single wire transfers covering a portion of an open invoice.',
      detail: 'When a customer pays an invoice in installments, the bank deposit amount is smaller than the open ledger receivable. Rather than discarding the match, LedgerForge flags the candidate invoice, notes the outstanding balance, and escalates to an accountant to confirm installment allocation.'
    },
    {
      id: 'fees',
      title: 'Bank & Intermediary Fees',
      short: 'Wire transfer and payment processor deductions.',
      detail: 'International wires often arrive net of $15–$30 correspondent banking charges. LedgerForge checks its precedent memory store for historical fee deductions on the specific counterparty, recommending a net-fee split resolution while halting auto-posting.'
    },
    {
      id: 'duplicates',
      title: 'Duplicate Transactions',
      short: 'Accidental double-charges or duplicate statement rows.',
      detail: 'If a bank statement contains two identical debits, or a ledger voucher has already been marked RECONCILED in a prior batch, LedgerForge enforces an invariant lock to prevent double-crediting or double-clearing the voucher.'
    },
    {
      id: 'variance',
      title: 'Amount Variance',
      short: 'Discrepancies between expected and actual recorded totals.',
      detail: 'LedgerForge maintains a strict zero-tolerance auto-reconciliation threshold ($0.00 variance required for straight-through processing). Any material discrepancy is stopped and presented to human reviewers with supporting breakdown evidence.'
    },
    {
      id: 'currency',
      title: 'Currency Issues (FX)',
      short: 'Cross-currency pairs without explicit rate mappings.',
      detail: 'LedgerForge treats ISO 4217 currency matching as a non-negotiable boundary. A €1,000 EUR statement will never match a $1,085 USD invoice without an explicit FX revaluation entry, preventing accidental currency translation errors.'
    },
    {
      id: 'missing-ledger',
      title: 'Missing Ledger Entries',
      short: 'Bank charges that have not yet been posted to the GL.',
      detail: 'Direct debits, recurring subscription charges, or bank interest frequently appear on bank statements before an accountant enters them into the ledger. LedgerForge surfaces these as unallocated bank entries ready for quick voucher creation.'
    },
    {
      id: 'missing-bank',
      title: 'Missing Bank Entries (In-Transit)',
      short: 'Checks or wires written but not yet cleared by the bank.',
      detail: 'Disbursements recorded in the general ledger that have not cleared the bank feed are categorized as outstanding deposits or in-transit payments, preserving the ledger balance without causing spurious reconciliations.'
    },
    {
      id: 'stp',
      title: 'Straight-Through Reconciliation (STP)',
      short: 'Instant, automated clearing of mathematically verified pairs.',
      detail: 'When reference ID, currency, posting date proximity, and exact amounts align perfectly with zero ambiguity, LedgerForge completes the reconciliation straight-through without human intervention, maintaining 100% audit logging.'
    },
    {
      id: 'hitl',
      title: 'Human-in-the-Loop Review (HITL)',
      short: 'Accountant governance for exceptions and edge cases.',
      detail: 'Instead of forcing an AI agent to guess under uncertainty, LedgerForge pauses and routes ambiguous cases to accountants with structured recommendations, preserving human authority over financial ledgers.'
    }
  ];

  const faqs = [
    {
      question: 'How does LedgerForge use a Large Language Model (LLM)?',
      answer: 'LedgerForge uses the LLM (GPT-4o-mini via LiteLLM) strictly as an advisory reasoning specialist for ambiguous edge cases. When deterministic scoring cannot differentiate between multiple candidates or when non-standard payment narratives require parsing, the LLM provides structured diagnostic reasoning. Crucially, the LLM has ZERO financial authority to write directly to the ledger without passing through deterministic safety gates.'
    },
    {
      question: 'Can the LLM automatically override safety rules?',
      answer: 'No. Deterministic guardrails (ISO currency isolation, duplicate prevention, amount variance thresholds, and direction checking) have absolute precedence. Even if the LLM expresses 99.9% confidence in a proposed match, the transaction is immediately blocked or escalated if a deterministic safety rule is violated.'
    },
    {
      question: 'What happens when LedgerForge is uncertain?',
      answer: 'When top candidate matches have tight scoring margins (< 5%), when references are missing, or when an unverified variance exists, LedgerForge stops and routes the transaction to the Human Review Queue. It attaches the raw evidence, precedent history, and AI diagnostic notes so an accountant can make an informed, auditable decision in seconds.'
    },
    {
      question: 'Does human feedback affect future behavior?',
      answer: 'Yes. When an accountant resolves an exception (e.g. approving a $20 wire fee split for a recurring vendor), that decision is saved to the structured precedent store (reconciliation_feedback). This historical precedent informs future recommendations and serves as ground truth data for the offline Agent Evolution loop.'
    },
    {
      question: 'Can the agent change its own production policy?',
      answer: 'No. LedgerForge enforces a strict governance boundary: candidate policies evaluated in the Agent Evolution loop can never replace the active production policy autonomously. An authorized human administrator must review the benchmark comparison and explicitly click "Promote to Production".'
    },
    {
      question: 'How are multi-currency transactions handled?',
      answer: 'Currencies are validated using strict ISO 4217 standards (USD, EUR, GBP, INR, JPY, CAD, AUD). Cross-currency pairs are treated as a hard safety boundary: an EUR bank transaction will never be matched to an USD ledger voucher without an explicit, pre-authorized FX translation record.'
    }
  ];

  return (
    <div className="min-h-screen text-[#18181B] flex flex-col font-sans selection:bg-rose-100 selection:text-black relative overflow-x-hidden">
      {/* 21st.dev Favorites Live Gradient Background — Pinkish Tone */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <PinkGradientBackground className="w-full h-full" />
      </div>

      {/* Shared Marketing Navbar */}
      <MarketingNavbar 
        activePage="resources" 
        onNavigate={onNavigate} 
        onEnterDashboard={onEnterDashboard} 
      />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 pt-6 pb-20 relative z-10 space-y-16 sm:space-y-24">
        
        {/* HERO */}
        <section className="text-center max-w-4xl mx-auto pt-6 sm:pt-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-mono font-bold text-slate-600 uppercase tracking-widest mb-4">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>LEDGERFORGE RESOURCES &amp; SPECIFICATIONS</span>
          </div>

          <h1 className="editorial-headline text-4xl sm:text-5xl lg:text-[58px] font-[550] text-black tracking-tight leading-[1.08] max-w-3xl mx-auto">
            Understand the workflow. <br />
            Inspect the evidence.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mt-4 leading-relaxed font-sans">
            Technical schemas, downloadable sample datasets, core reconciliation concepts, 
            and architectural governance specifications for finance engineering teams.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
            <a 
              href="#schemas"
              className="bg-black hover:bg-zinc-800 text-white text-xs font-semibold py-3 px-6 rounded-full flex items-center space-x-2 shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <span>Download Sample CSVs</span>
              <Download className="w-3.5 h-3.5" />
            </a>

            <button 
              type="button"
              onClick={() => onNavigate('how-it-works')}
              className="bg-white hover:bg-slate-50 text-black border border-slate-300 text-xs font-semibold py-3 px-5 rounded-full flex items-center space-x-2 shadow-2xs transition-all cursor-pointer"
            >
              <span>Explore Architecture Guide</span>
            </button>
          </div>
        </section>

        {/* HUB 1: RECONCILIATION DATA SPECIFICATIONS & SAMPLES */}
        <section id="schemas" className="scroll-mt-24 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-[11px] font-mono font-bold tracking-widest text-blue-600 uppercase">
                RESOURCE HUB 01
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
                Data Specifications &amp; Working CSV Downloads
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              LedgerForge accepts canonical CSV statements with standard financial headers. Download verified sample files to test the upload pipeline.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bank Statement Card */}
            <div className="forge-card p-6 sm:p-7 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Bank Statement Feed</h3>
                      <span className="text-[10px] font-mono text-slate-400">External settlement records</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    CSV FORMAT
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Represents cleared cash inflows and outflows downloaded from your banking portal or treasury management system.
                </p>

                {/* Field Specification Table */}
                <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 font-mono text-[10px] text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Field</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Date</td>
                        <td className="p-2.5 text-slate-500">YYYY-MM-DD</td>
                        <td className="p-2.5 font-sans text-slate-600">Settlement / value date</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Amount</td>
                        <td className="p-2.5 text-slate-500">Decimal (15,2)</td>
                        <td className="p-2.5 font-sans text-slate-600">Cash movement value</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Currency</td>
                        <td className="p-2.5 text-slate-500">ISO 4217</td>
                        <td className="p-2.5 font-sans text-slate-600">e.g. USD, EUR, INR</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Description</td>
                        <td className="p-2.5 text-slate-500">String</td>
                        <td className="p-2.5 font-sans text-slate-600">Raw banking narrative wire memo</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Reference_ID</td>
                        <td className="p-2.5 text-slate-500">String (Optional)</td>
                        <td className="p-2.5 font-sans text-slate-600">Invoice or remittance identifier</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Working Download Button */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">sample_bank_statement.csv (384 B)</span>
                <a
                  href="/sample_data/sample_bank_statement.csv"
                  download="sample_bank_statement.csv"
                  className="bg-black hover:bg-zinc-800 text-white font-semibold text-xs py-2 px-4 rounded-full flex items-center space-x-2 transition-all shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Bank CSV</span>
                </a>
              </div>
            </div>

            {/* General Ledger Card */}
            <div className="forge-card p-6 sm:p-7 bg-white border border-slate-200/90 rounded-2xl shadow-xs space-y-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">General Ledger Export</h3>
                      <span className="text-[10px] font-mono text-slate-400">Internal ERP accounting records</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    CSV FORMAT
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Represents invoices, billing schedules, and ledger vouchers exported from your internal accounting software or ERP.
                </p>

                {/* Field Specification Table */}
                <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 font-mono text-[10px] text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Field</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Date</td>
                        <td className="p-2.5 text-slate-500">YYYY-MM-DD</td>
                        <td className="p-2.5 font-sans text-slate-600">GL posting / voucher date</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Amount</td>
                        <td className="p-2.5 text-slate-500">Decimal (15,2)</td>
                        <td className="p-2.5 font-sans text-slate-600">Recorded entry magnitude</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Currency</td>
                        <td className="p-2.5 text-slate-500">ISO 4217</td>
                        <td className="p-2.5 font-sans text-slate-600">e.g. USD, EUR, INR</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Description</td>
                        <td className="p-2.5 text-slate-500">String</td>
                        <td className="p-2.5 font-sans text-slate-600">Internal voucher description &amp; vendor</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-bold text-slate-900">Reference_ID</td>
                        <td className="p-2.5 text-slate-500">String</td>
                        <td className="p-2.5 font-sans text-slate-600">Internal invoice or PO number</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Working Download Button */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">sample_company_ledger.csv (345 B)</span>
                <a
                  href="/sample_data/sample_company_ledger.csv"
                  download="sample_company_ledger.csv"
                  className="bg-black hover:bg-zinc-800 text-white font-semibold text-xs py-2 px-4 rounded-full flex items-center space-x-2 transition-all shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Ledger CSV</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* HUB 2: RECONCILIATION CONCEPTS EXPLORER */}
        <section id="concepts" className="scroll-mt-24 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-[11px] font-mono font-bold tracking-widest text-emerald-600 uppercase">
                RESOURCE HUB 02
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
                Core Reconciliation Concepts
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              Expand each accounting concept to review how LedgerForge detects and handles real-world balance discrepancies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {concepts.map((concept) => {
              const isSelected = expandedConcept === concept.id;
              return (
                <div 
                  key={concept.id}
                  onClick={() => setExpandedConcept(isSelected ? null : concept.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-white border-black shadow-sm ring-1 ring-black' 
                      : 'bg-white/80 border-slate-200/90 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      {concept.title}
                    </h3>
                    <span className="text-xs text-slate-400">
                      {isSelected ? <ChevronUp className="w-4 h-4 text-black" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    {concept.short}
                  </p>

                  {isSelected && (
                    <p className="text-xs text-slate-700 mt-3 pt-3 border-t border-slate-100 leading-relaxed font-sans animate-in fade-in duration-150">
                      {concept.detail}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* HUB 3: GOVERNANCE & ARCHITECTURE FAQ */}
        <section id="faq" className="scroll-mt-24 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <div className="text-[11px] font-mono font-bold tracking-widest text-purple-600 uppercase">
                RESOURCE HUB 03
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
                Technical &amp; Governance FAQ
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              Clear, definitive answers on safety boundaries, model isolation, human review, and policy promotions.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div 
                  key={idx}
                  className="rounded-2xl bg-white border border-slate-200/90 overflow-hidden shadow-2xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full text-left p-5 flex items-center justify-between text-sm font-bold text-slate-900 hover:text-black transition-colors cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <span className="ml-4 shrink-0 p-1 rounded-full bg-slate-50 border border-slate-200">
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-700" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 font-sans">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ARCHITECTURE REFERENCE PREVIEW BANNER */}
        <section className="forge-card p-6 sm:p-8 bg-white border border-slate-200/90 rounded-3xl shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-600 uppercase tracking-wider">
                <Layers className="w-3 h-3 text-emerald-600" />
                <span>Architecture Guide</span>
              </div>
              <h3 className="editorial-headline text-2xl sm:text-3xl font-[550] text-slate-900 tracking-tight">
                7-Stage Closed-Loop Control Architecture
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
                Explore the complete technical walkthrough showing how raw statements transition through deterministic matching, precedent memory retrieval, advisory LLM reasoning, CFO safety guardrails, and offline agent evolution.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('how-it-works')}
                  className="bg-black hover:bg-zinc-800 text-white font-semibold text-xs py-2.5 px-5 rounded-full flex items-center space-x-2 transition-all shadow-xs cursor-pointer"
                >
                  <span>Explore How It Works</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-3 shadow-inner">
              <img 
                src="/assets/how_ledgerforge_works.png" 
                alt="LedgerForge Architecture Diagram Preview" 
                className="w-full h-auto rounded-xl object-contain"
              />
            </div>
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white/85 backdrop-blur-xl border border-white/90 shadow-[0_12px_32px_-10px_rgba(244,90,140,0.12)] px-5 sm:px-8 py-3.5 sm:py-4 text-center space-y-2 sm:space-y-2.5">
            {/* Subtle luminous ambient highlight */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-28 bg-gradient-to-b from-rose-200/50 to-transparent blur-2xl pointer-events-none rounded-full" />

            <div className="relative z-10 space-y-1 max-w-xl mx-auto">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200/80 text-[10px] font-mono font-semibold tracking-wider text-rose-800 uppercase shadow-2xs">
                <Sparkles className="w-3 h-3 text-rose-600" />
                <span>Finance Benchmark &amp; Testing Sandbox</span>
              </div>

              <h2 className="editorial-headline text-xl sm:text-2xl font-[550] text-slate-950 tracking-tight leading-snug">
                Ready to test with your own transaction data?
              </h2>

              <p className="text-xs sm:text-[13px] text-slate-600 leading-normal font-sans max-w-lg mx-auto">
                Download verified sample CSVs, upload them directly to the sandbox, and inspect the real-time matching and exception results in seconds.
              </p>
            </div>

            {/* 3 Executive Dataset & Sandbox Specs */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-2 text-left max-w-2xl mx-auto">
              <div className="p-2 rounded-xl bg-white/70 border border-slate-200/70 shadow-2xs space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 font-sans">
                  <div className="w-3.5 h-3.5 rounded bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/60 shrink-0">
                    <FileSpreadsheet className="w-2.5 h-2.5" />
                  </div>
                  <span className="truncate">Financial Formats</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  MT940, CAMT.053, and ERP general ledger CSV datasets included.
                </p>
              </div>

              <div className="p-2 rounded-xl bg-white/70 border border-slate-200/70 shadow-2xs space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 font-sans">
                  <div className="w-3.5 h-3.5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                  </div>
                  <span className="truncate">Deterministic Rules</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Strict $0.00 delta verification. Zero statistical guesswork on cash entries.
                </p>
              </div>

              <div className="p-2 rounded-xl bg-white/70 border border-slate-200/70 shadow-2xs space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 font-sans">
                  <div className="w-3.5 h-3.5 rounded bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200/60 shrink-0">
                    <ShieldCheck className="w-2.5 h-2.5" />
                  </div>
                  <span className="truncate">Zero Data Retention</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Processed in client memory. Statements are never stored or logged.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={onEnterDashboard}
                className="w-full sm:w-auto bg-slate-950 hover:bg-black text-white font-semibold text-xs py-2 px-5 rounded-full shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer group"
              >
                <span>Launch Interactive Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('pricing')}
                className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 font-semibold text-xs py-2 px-4.5 rounded-full transition-all cursor-pointer shadow-2xs hover:shadow-xs"
              >
                <span>View Pilot Pricing</span>
              </button>
            </div>

            {/* Security & Audit Assurance Seal */}
            <div className="relative z-10 pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Verified Sample CSVs
              </span>
              <span>•</span>
              <span>Sub-10ms Batch Matching</span>
              <span>•</span>
              <span>Audit Proof Envelopes</span>
            </div>
          </div>
        </section>

      </main>

      {/* Shared Marketing Footer */}
      <div className="relative z-10">
        <MarketingFooter onNavigate={onNavigate} onEnterDashboard={onEnterDashboard} />
      </div>
    </div>
  );
}
