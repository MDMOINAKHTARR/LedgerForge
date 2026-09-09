import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Bot, 
  Users, 
  FileCheck, 
  AlertTriangle, 
  XCircle, 
  CheckCircle2, 
  ArrowRight, 
  Scale, 
  Check, 
  Sliders,
  Info,
  SlidersHorizontal,
  FileSpreadsheet,
  Lock,
  GitBranch,
  Filter,
  CheckCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { MarketingNavbar } from './MarketingNavbar';
import { MarketingFooter } from './MarketingFooter';
import { MirroredGradientBackground } from './ui/favorites';

export function SecurityPage({ onNavigate, onEnterDashboard }) {
  const [activePolicy, setActivePolicy] = useState(null);
  const [matrixFilter, setMatrixFilter] = useState('ALL'); // 'ALL' | 'AUTO' | 'REVIEW' | 'BLOCK'

  useEffect(() => {
    let isMounted = true;
    async function loadPolicy() {
      try {
        const res = await fetch('/api/v1/agents/active-policy');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setActivePolicy(data);
        }
      } catch (e) {
        // Fallback gracefully to verified production defaults
      }
    }
    loadPolicy();
    return () => { isMounted = false; };
  }, []);

  const safetyMatrixRows = [
    {
      id: 'sm-01',
      category: 'AUTO',
      condition: 'High-confidence exact match (100% match on reference, amount, date window, currency)',
      response: 'Straight-Through Auto Reconcile',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
      icon: CheckCircle2,
      iconColor: 'text-emerald-700',
      risk: 'Zero variance; mathematical proof verified against GL voucher'
    },
    {
      id: 'sm-02',
      category: 'REVIEW',
      condition: 'Multiple viable ledger candidates with tight score delta (< 5%)',
      response: 'Escalate to Human Review',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/90',
      icon: AlertTriangle,
      iconColor: 'text-amber-700',
      risk: 'Prevents arbitrary voucher posting when candidate ambiguity exists'
    },
    {
      id: 'sm-03',
      category: 'BLOCK',
      condition: 'Currency conflict (e.g. Bank statement in EUR vs. Ledger invoice in USD)',
      response: 'Deterministic Hard Block',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/90',
      icon: XCircle,
      iconColor: 'text-rose-700',
      risk: 'ISO 4217 currency isolation enforced; requires pre-authorized FX entry'
    },
    {
      id: 'sm-04',
      category: 'BLOCK',
      condition: 'Transaction direction conflict (Credit matched to Credit instead of Debit)',
      response: 'Deterministic Hard Block',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/90',
      icon: XCircle,
      iconColor: 'text-rose-700',
      risk: 'Double-entry bookkeeping inversion lockout prevents unbalanced books'
    },
    {
      id: 'sm-05',
      category: 'BLOCK',
      condition: 'Duplicate candidate (Ledger voucher already marked RECONCILED in prior batch)',
      response: 'Deterministic Hard Block',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/90',
      icon: XCircle,
      iconColor: 'text-rose-700',
      risk: 'State invariant prevents double-crediting an already reconciled invoice'
    },
    {
      id: 'sm-06',
      category: 'REVIEW',
      condition: 'Material amount variance exceeding configured policy tolerance ($50.00)',
      response: 'Escalate to Human Review',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/90',
      icon: AlertTriangle,
      iconColor: 'text-amber-700',
      risk: 'Requires human review to authorize fee write-off or partial payment split'
    },
    {
      id: 'sm-07',
      category: 'REVIEW',
      condition: 'Conflicting historical precedent (Past reviewers split on resolution action)',
      response: 'Escalate to Human Review',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/90',
      icon: AlertTriangle,
      iconColor: 'text-amber-700',
      risk: 'Precedent ambiguity flagged immediately to senior accounting staff'
    },
    {
      id: 'sm-08',
      category: 'REVIEW',
      condition: 'Insufficient evidence (Missing invoice reference, generic counterparty description)',
      response: 'Escalate to Human Review',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/90',
      icon: AlertTriangle,
      iconColor: 'text-amber-700',
      risk: 'Requires manual accounting identification prior to ledger assignment'
    }
  ];

  const filteredMatrix = matrixFilter === 'ALL'
    ? safetyMatrixRows
    : safetyMatrixRows.filter(r => r.category === matrixFilter);

  const pillars = [
    {
      icon: Scale,
      title: 'Deterministic Financial Guardrails',
      subtitle: 'Mathematical Invariant Enforcement',
      description: 'Mathematical rules enforce hard boundary conditions before any transaction can be reconciled. If any invariant fails, the match is stopped immediately with zero exceptions.',
      invariants: [
        { name: 'Currency Isolation', desc: 'Zero cross-currency pairing without explicit, pre-authorized FX mapping.' },
        { name: 'Amount Variance Lock', desc: 'Monetary thresholds prevent auto-posting unverified balance splits.' },
        { name: 'Duplicate Suppression', desc: 'State locks reject matches against already-reconciled ledger vouchers.' },
        { name: 'Direction Verification', desc: 'Strict Credit-to-Debit parity prevents double-entry ledger inversions.' }
      ]
    },
    {
      icon: Bot,
      title: 'AI as Advisor, Never Authority',
      subtitle: 'Bounded Model Execution',
      description: 'LedgerForge never permits a language model to write to the general ledger autonomously. The model operates strictly as an analytical investigator under rule boundaries.',
      invariants: [
        { name: 'Gated Invocation', desc: 'LLM is invoked only when candidate ambiguity or tight scoring margins demand investigation.' },
        { name: 'Strict Schema Validation', desc: 'Model outputs structured diagnostic JSON, validated against verified candidate IDs.' },
        { name: 'Zero Override Privilege', desc: 'LLM cannot bypass deterministic safety bounds, regardless of expressed confidence.' },
        { name: 'Confidence ≠ Authority', desc: '99% model confidence is rejected if reference, currency, or direction rules fail.' }
      ]
    },
    {
      icon: Users,
      title: 'Human Governance & Review',
      subtitle: 'Accountant-in-the-Loop',
      description: 'When uncertainty or material variance occurs, LedgerForge pauses execution and routes the transaction directly to the certified accountant review queue.',
      invariants: [
        { name: 'Authenticated Reviewers', desc: "Every resolution records the reviewer's authenticated email, timestamp, and audit notes." },
        { name: 'Structured Resolutions', desc: 'Reviewers select discrete accounting actions (Approve, Reject, Re-assign, Split).' },
        { name: 'Preserved Diagnostics', desc: 'The original AI recommendation is permanently archived alongside the human verdict.' },
        { name: 'Continuous Feedback', desc: 'Human corrections become structured precedent memory for offline policy evaluation.' }
      ]
    },
    {
      icon: FileCheck,
      title: 'End-to-End Decision Auditability',
      subtitle: 'Cryptographic Provenance',
      description: 'Every transaction processed leaves an unalterable audit trace designed to satisfy internal controls, SOC 2 Type II compliance, and statutory external auditors.',
      invariants: [
        { name: 'Evidence Snapshot', desc: 'Raw bank line, candidate GL line, and normalized fields recorded at ingestion.' },
        { name: 'Policy Version Stamped', desc: 'Exact policy version (e.g. Agent V3, Commit Hash) permanently bound to each decision.' },
        { name: 'Transparent Reasoning', desc: 'Mathematical tier scores, precedent memory lookup hits, and diagnostic text.' },
        { name: 'Promotion Lineage', desc: 'Agent policy promotions require admin verification and maintain historical lineage.' }
      ]
    }
  ];

  return (
    <div className="min-h-screen text-[#18181B] flex flex-col font-sans selection:bg-slate-200 selection:text-black relative overflow-x-hidden">
      
      {/* 21st.dev Favorites Live Gradient Background — Mirrored orientation */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <MirroredGradientBackground className="w-full h-full" />
      </div>

      {/* Shared Marketing Navbar */}
      <MarketingNavbar 
        activePage="security" 
        onNavigate={onNavigate} 
        onEnterDashboard={onEnterDashboard} 
      />

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-24 relative z-10 space-y-20 sm:space-y-28">
        
        {/* ── SECTION 1: HERO ── */}
        <section className="text-center max-w-3xl mx-auto pt-4 sm:pt-6">
          <h1 className="editorial-headline text-4xl sm:text-5xl lg:text-[54px] font-[550] text-[#0F172A] tracking-tight leading-[1.08] mb-5">
            Deterministic financial safety.<br />
            Zero autonomous ledger risk.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans max-w-2xl mx-auto">
            LedgerForge separates AI analytical reasoning from financial execution authority.
            Mathematical boundary conditions, immutable audit logs, and mandatory accountant review ensure
            no autonomous model can mutate general ledger balances without mathematical proof.
          </p>

          <div className="pt-7 flex flex-wrap items-center justify-center gap-3.5">
            <button 
              type="button"
              onClick={onEnterDashboard}
              className="bg-[#0F172A] hover:bg-black text-white text-xs font-semibold py-3 px-6 rounded-full flex items-center space-x-2 shadow-xs hover:shadow transition-all cursor-pointer"
            >
              <span>Launch Live Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <a 
              href="#matrix"
              className="bg-white/90 hover:bg-white text-slate-800 border border-slate-200/90 text-xs font-semibold py-3 px-5 rounded-full flex items-center space-x-2 shadow-2xs transition-all cursor-pointer backdrop-blur-xs"
            >
              <span>Inspect Decision Matrix</span>
            </a>
          </div>

          {/* Core Invariant Specification Strip */}
          <div className="mt-12 bg-white/90 backdrop-blur-sm border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
              <div className="p-5 text-left">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  False Auto-Post Tolerance
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900 mt-1 tracking-tight">
                  0.00%
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Hard invariant across test suites
                </div>
              </div>

              <div className="p-5 text-left">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Audit Snapshot Retention
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900 mt-1 tracking-tight">
                  100%
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Raw payload + policy version stamped
                </div>
              </div>

              <div className="p-5 text-left">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Currency Isolation
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900 mt-1 tracking-tight">
                  ISO 4217
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Zero cross-currency drift permitted
                </div>
              </div>

              <div className="p-5 text-left">
                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Execution Authority
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900 mt-1 tracking-tight">
                  Human Gated
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Ambiguity requires certified signoff
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 2: ARCHITECTURAL FOUNDATIONS ── */}
        <section className="space-y-8">
          <div className="max-w-xl">
            <h2 className="editorial-headline text-2xl sm:text-3xl font-[550] text-[#0F172A] tracking-tight">
              Architectural safety invariants
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed font-sans">
              Non-negotiable system boundaries built into the reconciliation engine kernel. These rules execute prior to, and independent of, any language model diagnostic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={idx}
                  className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl p-7 sm:p-8 shadow-xs hover:border-slate-300 transition-colors duration-200 flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#0F172A] text-white flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-slate-100" />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                          {pillar.subtitle}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-slate-400">
                        INVARIANT 0{idx + 1}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                        {pillar.title}
                      </h3>
                      <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed mt-1.5 font-sans">
                        {pillar.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-1 gap-2.5">
                      {pillar.invariants.map((item, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-semibold text-slate-900 font-sans">{item.name}:</span>{' '}
                          <span className="text-slate-600 font-sans">{item.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── SECTION 3: DETERMINISTIC RESPONSE MATRIX ── */}
        <section id="matrix" className="scroll-mt-24 space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2 className="editorial-headline text-2xl sm:text-3xl font-[550] text-[#0F172A] tracking-tight">
                Deterministic response matrix
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl leading-relaxed font-sans">
                Every transaction condition maps to an invariant system outcome. No heuristic or model confidence score can downgrade an escalation or bypass a hard block.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs p-1 rounded-lg border border-slate-200/90 shrink-0 shadow-2xs">
              {[
                { id: 'ALL', label: 'All Scenarios (8)' },
                { id: 'AUTO', label: 'Auto (1)' },
                { id: 'REVIEW', label: 'Escalate (4)' },
                { id: 'BLOCK', label: 'Hard Block (3)' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMatrixFilter(f.id)}
                  className={`px-3 py-1 text-[11px] font-mono font-medium rounded-md transition-all cursor-pointer ${
                    matrixFilter === f.id
                      ? 'bg-[#0F172A] text-white shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200/90 rounded-2xl bg-white/95 backdrop-blur-sm shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/90">
                  <th className="p-4 font-mono text-[11px] text-slate-500 uppercase tracking-wider font-bold w-[45%]">
                    Transaction Condition
                  </th>
                  <th className="p-4 font-mono text-[11px] text-slate-500 uppercase tracking-wider font-bold w-[27%]">
                    Enforced System Outcome
                  </th>
                  <th className="p-4 font-mono text-[11px] text-slate-500 uppercase tracking-wider font-bold w-[28%]">
                    Financial Safety Rationale
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMatrix.map((row) => {
                  const Icon = row.icon;
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/70 transition-colors duration-150"
                    >
                      <td className="p-4 font-medium text-slate-900 leading-relaxed text-[12px]">
                        {row.condition}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono font-semibold ${row.badgeClass}`}>
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${row.iconColor}`} />
                          <span>{row.response}</span>
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 text-[11px] font-mono leading-relaxed">
                        {row.risk}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── SECTION 4: ACTIVE PRODUCTION POLICY SPECIFICATION ── */}
        <section id="policy" className="scroll-mt-24 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="editorial-headline text-2xl sm:text-3xl font-[550] text-[#0F172A] tracking-tight">
                Active policy specification
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 font-sans">
                Enforced reconciliation boundaries currently active in the production environment.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-mono font-semibold shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>POLICY: AGENT V3 · PRODUCTION</span>
              </span>
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                  Tier 1 Identity Match
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900">
                  1.00
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  100% Identity Score
                </div>
                <div className="text-[11px] text-slate-500 border-t border-slate-200/60 pt-2 mt-2 leading-snug">
                  Reference, amount, currency, and value date must match exactly
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                  Date Proximity Window
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900">
                  ±7 Days
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  Posting Tolerance
                </div>
                <div className="text-[11px] text-slate-500 border-t border-slate-200/60 pt-2 mt-2 leading-snug">
                  Differences beyond 7 days require accountant authorization
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                  Max Auto Variance
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900">
                  $0.00
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  USD Threshold
                </div>
                <div className="text-[11px] text-slate-500 border-t border-slate-200/60 pt-2 mt-2 leading-snug">
                  Zero tolerance for unreviewed drift or unallocated splits
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                  Currency Enforcement
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900">
                  ISO 4217
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  Strict Isolation
                </div>
                <div className="text-[11px] text-slate-500 border-t border-slate-200/60 pt-2 mt-2 leading-snug">
                  Cross-currency candidate pairs are permanently locked out
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs text-slate-700 font-sans leading-relaxed">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p>
                Policy parameters are cryptographically validated on every batch ingestion run. Modifications to threshold values require offline meta-agent backtesting against historical ground truth and explicit multi-party administrator signoff.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: BOTTOM CALL TO ACTION ── */}
        <section className="text-center bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-3xl p-8 sm:p-14 space-y-4 shadow-xs">
          <h2 className="editorial-headline text-3xl sm:text-4xl font-[550] text-[#0F172A] tracking-tight">
            Verify the safety engine with your own ledger data
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed font-sans">
            Test deterministic matching rules, inspect exception handling workflows, and review cryptographic decision provenance in real time.
          </p>
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={onEnterDashboard}
              className="bg-[#0F172A] hover:bg-black text-white font-semibold text-xs py-3 px-6 rounded-full shadow-xs hover:shadow transition-all flex items-center space-x-2 cursor-pointer"
            >
              <span>Launch Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('resources')}
              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 font-semibold text-xs py-3 px-5 rounded-full transition-all cursor-pointer shadow-2xs"
            >
              <span>Inspect Sample Datasets</span>
            </button>
          </div>
        </section>

      </main>

      {/* Shared Marketing Footer */}
      <MarketingFooter onNavigate={onNavigate} onEnterDashboard={onEnterDashboard} />
    </div>
  );
}
