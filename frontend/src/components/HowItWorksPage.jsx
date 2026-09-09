import React, { useState } from 'react';
import {
  ArrowLeft, ArrowRight, ShieldCheck, Zap, Bot, Database,
  FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  HelpCircle, ChevronRight, Layers, Lock, Cpu, Eye,
  RefreshCw, Scale, Users, FileText, Sparkles, ExternalLink, Play
} from 'lucide-react';
import { MarketingNavbar } from './MarketingNavbar';
import { MarketingFooter } from './MarketingFooter';
import { VideoModal } from './VideoModal';
import { PinkGradientBackground } from './ui/favorites';

export function HowItWorksPage({ onBack, onEnterDashboard, onNavigate }) {
  const [activeStage, setActiveStage] = useState(0);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  const stages = [
    {
      id: 'ingestion',
      badge: 'STAGE 1',
      title: 'Multi-Currency Ingestion & Normalization',
      subtitle: 'Standardizes heterogeneous financial records across ERPs and bank feeds',
      icon: FileSpreadsheet,
      accent: 'bg-slate-100 text-slate-800 border-slate-300',
      description: 'Bank statements and General Ledger (GL) exports arrive in varied formats with differing date standards, decimal conventions, and narrative transaction descriptions. LedgerForge standardizes both datasets simultaneously into canonical transactional records.',
      keyPoints: [
        'Strict ISO 4217 currency validation (USD, INR, EUR, GBP, JPY, CAD, AUD)',
        'Reference number extraction and normalization (removes prefixes, trailing whitespace, and special characters)',
        'Value date vs. posting date canonicalization',
        'Calculates batch integrity checksums and records audit ingestion metadata'
      ],
      codeSnippet: `// Normalized Transaction Structure
{
  "id": "tx_bank_90214",
  "batch_id": "batch_2026_09",
  "source": "BANK",
  "amount": 2475.00,
  "currency": "USD",
  "date": "2026-03-15",
  "description": "WIRE INVOICE INV-88210 VENDOR ACME CORP",
  "reference_id": "INV-88210"
}`
    },
    {
      id: 'matching',
      badge: 'STAGE 2',
      title: 'Deterministic Matching Engine',
      subtitle: 'Multi-tiered rule matching before any probabilistic or AI intervention',
      icon: Scale,
      accent: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      description: 'The foundation of LedgerForge is 100% deterministic. High-confidence exact matches are resolved instantly using mathematical rules, avoiding unnecessary AI invocations while guaranteeing 0% hallucination risk.',
      keyPoints: [
        'Tier 1 (Exact Rule): Exact match on normalized reference number, booking date, and amount',
        'Tier 2 (Proximity Fuzzy): Multi-field scoring combining TF-IDF description similarity, date proximity window (±7 days), and amount tolerance',
        'Candidate pool generation: ranks top 5 most viable ledger matches for every bank transaction',
        'Zero cross-currency matching: bank INR never matches ledger USD, regardless of string similarity'
      ],
      codeSnippet: `// Matching Engine Rule Check
if (bank.reference === ledger.reference && 
    bank.currency === ledger.currency &&
    Math.abs(bank.amount - ledger.amount) === 0.00) {
  return { 
    confidence: 1.0, 
    tier: "EXACT_RULE", 
    evidence: ["Reference exact", "Amount exact", "Currency match"] 
  };
}`
    },
    {
      id: 'memory',
      badge: 'STAGE 3',
      title: 'Structured Precedent Memory Layer',
      subtitle: 'Advisory case retrieval informed by verified human accounting decisions',
      icon: Database,
      accent: 'bg-indigo-50 text-indigo-800 border-indigo-300',
      description: 'When candidate matches exhibit slight discrepancies, the system queries its structured precedent store (reconciliation_feedback). It searches for historical cases where accountants previously resolved identical exceptions.',
      keyPoints: [
        'Strict Currency Isolation: Historical USD resolutions NEVER influence INR accounts',
        'Precedent Conflict Detection: If past reviewers split 50/50 on an exception, status becomes CONFLICTING and forces human review',
        'Advisory Only: Past precedents can provide corroborating evidence, but can never override hard safety bounds',
        'Explainable reasoning: "Matched previous Bank Fee precedent for ACME Corp wire charges with $25 variance"'
      ],
      codeSnippet: `// Precedent Memory Retrieval
const precedent = await memoryService.findPrecedents({
  currency: "USD",
  exception_type: "AMOUNT_VARIANCE",
  variance_amount: 25.00,
  counterparty: "ACME Corp"
});
// Result: { match: "BANK_FEE", confidence: 0.91, count: 4, status: "CONSISTENT" }`
    },
    {
      id: 'llm',
      badge: 'STAGE 4',
      title: 'Gated Advisory LLM Specialist',
      subtitle: 'GPT-4o-mini reasoning triggered strictly when ambiguity exceeds safe thresholds',
      icon: Bot,
      accent: 'bg-violet-50 text-violet-800 border-violet-300',
      description: 'Unlike naive LLM wrappers that let AI make financial decisions, LedgerForge treats the LLM strictly as an advisory reasoning specialist. It is only called when top candidates have tight score margins (< 5%) or confidence is below 85%.',
      keyPoints: [
        'Deterministic Gate: The LLM is bypassed completely for clear matches or clean non-matches to save latency & cost',
        'Structured Output Schema: Generates candidate rankings, anomaly flags, and natural language audit explanations',
        'Advisory Diagnostic Role: The LLM can propose a match, but HAS ZERO AUTHORITY to post to the ledger',
        'Safety Constraint: The DecisionEngine can override or discard the LLM proposal if hard financial rules fail'
      ],
      codeSnippet: `// Deterministic Invocation Gate
const isAmbiguous = (top1.score - top2.score < 0.05) || (top1.score < 0.85);
if (isAmbiguous) {
  const proposal = await llmSpecialist.evaluateCandidateAmbiguity({
    bank_tx, candidate_a, candidate_b, historical_precedent
  });
  // Feeds into DecisionEngine for hard safety validation
}`
    },
    {
      id: 'decision',
      badge: 'STAGE 5',
      title: 'Decision Engine & Hard Safety Lockouts',
      subtitle: 'The supreme financial authority enforcing zero-tolerance CFO boundaries',
      icon: ShieldCheck,
      accent: 'bg-amber-50 text-amber-800 border-amber-300',
      description: 'The DecisionEngine evaluates every proposed match against non-negotiable accounting rules. Even if the LLM reports 99% confidence, a single violation of a hard financial boundary immediately escalates the transaction to human review.',
      keyPoints: [
        'Material Variance Lockout: Variance > $0.05 CAN NEVER auto-reconcile under any circumstances',
        'Currency Parity Lockout: Cross-currency candidate pairs are permanently locked out',
        'Duplicate Suppression Lockout: Multiple identical transactions within the same batch force human review',
        'Minimum Evidence Check: Requires at least 2 independent matching signals (e.g. amount + reference)',
        'Straight-Through Processing: Only transactions passing all 4 policy checks auto-reconcile'
      ],
      codeSnippet: `// Non-Negotiable Hard Financial Safety Checks
if (Math.abs(bank.amount - ledger.amount) > policy.material_variance_threshold) {
  return { action: "ESCALATE_TO_HUMAN", reason: "Material variance exceeds $0.05" };
}
if (bank.currency !== ledger.currency) {
  return { action: "ESCALATE_TO_HUMAN", reason: "Cross-currency allocation prohibited" };
}`
    },
    {
      id: 'exception-ux',
      badge: 'STAGE 6',
      title: 'Accountant Exception Review UX',
      subtitle: 'Audit drawer with 11 structured accounting resolutions closing the loop',
      icon: Users,
      accent: 'bg-rose-50 text-rose-800 border-rose-300',
      description: 'Accountants performing month-end reconciliations need structured accounting options, not generic approve/reject buttons. LedgerForge provides a dedicated review drawer where auditors resolve exceptions and teach the system.',
      keyPoints: [
        '11 Structured Resolution Options: Bank Fee, Timing Difference, Partial Payment, Duplicate, Amount Variance, etc.',
        'Candidate Re-assignment: Accountants can re-select another available ledger entry from the same batch',
        'Server-Side Validation: Validates that selected candidate exists, belongs to same batch, preserves currency, and is unconsumed',
        'Continuous Learning Feedback: Records reviewer ID, structured action, and notes to reconciliation_feedback'
      ],
      codeSnippet: `// 11 Structured Accounting Resolutions
1. Confirm Proposed Match
2. Select Correct Ledger Entry
3. Mark as Timing Difference
4. Mark as Partial Payment
5. Mark as Bank Fee
6. Mark as Duplicate Transaction
7. Mark as Missing Ledger Entry
8. Mark as Missing Bank Entry
9. Mark as Amount Variance
10. Reject Match
11. Other Accounting Resolution`
    },
    {
      id: 'governance',
      badge: 'STAGE 7',
      title: 'Agent Policy Optimization & CFO Governance',
      subtitle: 'Isolated benchmarking with zero autonomous production mutation',
      icon: Cpu,
      accent: 'bg-purple-50 text-purple-800 border-purple-300',
      description: 'The Agent Engineer continuously improves matching rules from failure autopsies. However, autonomous rule mutation in production is strictly prohibited. All candidate specs must pass an independent regression benchmark and require explicit human promotion.',
      keyPoints: [
        'Automated Failure Autopsies: Clusters unhandled exceptions by transaction type, counterparty, and failure pattern',
        'Independent Regression Benchmarking: Evaluates candidate specs against an isolated historical dataset',
        'Zero Autonomous Mutation: Candidates are registered as INACTIVE and cannot alter production runtime',
        'CFO Policy View: Transparent read-only dashboard exposing active thresholds and hard safety bounds'
      ],
      codeSnippet: `// Controlled Candidate Promotion
// Optimizer evaluates candidate spec:
const evaluation = await benchmarkSuite.evaluate(candidateSpec);
if (evaluation.accuracy > baseline.accuracy && evaluation.false_auto_post_rate === 0) {
  // Registers as INACTIVE candidate in AgentRegistry
  await registry.registerCandidate(candidateSpec, { status: "INACTIVE" });
  // Requires explicit promotion by CFO/Controller in UI
}`
    }
  ];

  return (
    <div className="min-h-screen text-[#18181B] font-sans antialiased selection:bg-rose-100 selection:text-black relative overflow-x-hidden">
      
      {/* 21st.dev Favorites Live Gradient Background — Pinkish Tone */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <PinkGradientBackground className="w-full h-full" />
      </div>

      {/* Shared Marketing Navbar */}
      <MarketingNavbar 
        activePage="how-it-works"
        onNavigate={onNavigate}
        onEnterDashboard={onEnterDashboard}
      />

      {/* Main Page Content */}
      <main className="relative z-10">

      {/* 2. HERO HEADER */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-8 text-center">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-mono font-semibold text-slate-600 uppercase tracking-wider mb-4">
          <Sparkles className="w-3 h-3 text-amber-600" />
          <span>Complete System Architecture &amp; Control Flow</span>
        </div>

        <h1 className="editorial-headline text-3xl sm:text-5xl font-[550] text-black tracking-tight leading-[1.12] max-w-3xl mx-auto">
          How LedgerForge Works: <br />
          From Raw Statements to Audited Books
        </h1>

        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mt-4 leading-relaxed font-sans">
          LedgerForge is governed by a strict control hierarchy: 
          <strong> Deterministic Matching</strong> first, <strong>Advisory Precedent Memory</strong> second, 
          <strong> LLM Specialist Reasoning</strong> only for ambiguity, 
          and <strong>Non-Negotiable CFO Safety Guardrails</strong> as the supreme authority.
        </p>

        {/* Core Principle Banner */}
        <div className="mt-8 p-4 max-w-2xl mx-auto rounded-2xl bg-amber-50/80 border border-amber-200/80 text-left flex items-start space-x-3.5">
          <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5 text-amber-800 font-bold">
            ⚖️
          </div>
          <div>
            <div className="text-xs font-bold text-amber-950 uppercase tracking-wider font-mono">
              The LedgerForge Core Axiom
            </div>
            <p className="text-xs text-amber-900 mt-1 leading-relaxed">
              <strong>"Knows when to act — and when to ask."</strong> High model confidence never overrides a hard financial discrepancy. High-risk variances, cross-currency pairs, and candidate ambiguities are permanently locked out from straight-through processing.
            </p>
          </div>
        </div>
      </section>

      {/* 3. ARCHITECTURE DIAGRAM SECTION */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="forge-card p-6 sm:p-8 bg-white border border-slate-200/80 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="text-[11px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                Visual Architecture Blueprint
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
                7-Stage Closed-Loop Control Architecture
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setIsVideoOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs hover:shadow-xs text-xs font-semibold transition-all cursor-pointer group"
              >
                <div className="w-3.5 h-3.5 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 transition-colors">
                  <Play className="w-1.5 h-1.5 fill-current ml-0.5" />
                </div>
                <span>Watch Video Walkthrough</span>
              </button>

              <div className="hidden sm:flex items-center space-x-2 text-xs font-medium text-slate-500">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Deterministic Gate + Advisory Intelligence</span>
              </div>
            </div>
          </div>

          {/* Embedded Architecture Diagram */}
          <div className="mt-6 rounded-2xl overflow-hidden border border-slate-200/80 bg-white shadow-inner flex justify-center p-2 sm:p-4">
            <img 
              src="/assets/how_ledgerforge_works.png" 
              alt="Here is how LedgerForge works Architecture Diagram" 
              className="w-full max-w-[1100px] h-auto object-contain rounded-xl"
            />
          </div>

          <div className="mt-4 text-center text-xs text-slate-500 font-sans">
            Figure 1: Complete end-to-end reconciliation flow from multi-currency normalization to CFO policy governance and accountant feedback closure.
          </div>
        </div>
      </section>

      {/* 4. INTERACTIVE 7-STAGE PIPELINE EXPLORER */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-1">
            Step-by-Step Technical Deep Dive
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            The 7 Stages of Autonomous Reconciliation
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2">
            Click each stage below to explore its algorithmic logic, safety invariants, and implementation details.
          </p>
        </div>

        {/* Stage Selector Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pb-6">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isActive = activeStage === idx;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveStage(idx)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border cursor-pointer ${
                  isActive 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                    : 'bg-white/90 text-slate-700 border-slate-200/90 hover:border-slate-300 hover:text-black hover:bg-white shadow-2xs'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                <span>{stage.badge}: {stage.title.split(' ')[0]} {stage.title.split(' ')[1]}</span>
              </button>
            );
          })}
        </div>

        {/* Active Stage Deep Dive Card */}
        {(() => {
          const stage = stages[activeStage];
          const Icon = stage.icon;
          return (
            <div className="forge-card p-6 sm:p-10 bg-white mt-4 border border-slate-200 transition-all">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Left Column: Details & Key Points */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${stage.accent}`}>
                      {stage.badge}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Stage {activeStage + 1} of {stages.length}</span>
                  </div>

                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2.5">
                      <Icon className="w-6 h-6 text-slate-700 shrink-0" />
                      <span>{stage.title}</span>
                    </h3>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
                      {stage.subtitle}
                    </p>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {stage.description}
                  </p>

                  <div className="space-y-2.5 pt-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-900 font-mono">
                      Engineering Principles &amp; Invariants
                    </div>
                    <ul className="space-y-2 text-xs text-slate-600">
                      {stage.keyPoints.map((pt, i) => (
                        <li key={i} className="flex items-start space-x-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span className="leading-normal">{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Column: Code Snippet & Logic */}
                <div className="lg:col-span-5 bg-slate-900 rounded-2xl p-5 text-slate-200 font-mono text-xs shadow-md border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-[10px] text-slate-400">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <span>ledgerforge_{stage.id}.logic</span>
                  </div>

                  <pre className="overflow-x-auto text-[11px] leading-relaxed text-emerald-300 font-mono py-1">
                    <code>{stage.codeSnippet}</code>
                  </pre>

                  <div className="pt-2 text-[10px] text-slate-400 leading-normal border-t border-slate-800/80">
                    💡 <em>Production Guard:</em> Verified in automated integration test suite with 100% boundary assertion coverage.
                  </div>
                </div>

              </div>

              {/* Next / Previous Navigation */}
              <div className="flex items-center justify-between pt-8 mt-8 border-t border-slate-100">
                <button
                  onClick={() => setActiveStage(Math.max(0, activeStage - 1))}
                  disabled={activeStage === 0}
                  className={`text-xs font-semibold flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                    activeStage === 0 
                      ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-200' 
                      : 'text-slate-700 hover:text-black border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous Stage</span>
                </button>

                <button
                  onClick={() => setActiveStage(Math.min(stages.length - 1, activeStage + 1))}
                  disabled={activeStage === stages.length - 1}
                  className={`text-xs font-semibold flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                    activeStage === stages.length - 1 
                      ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-200' 
                      : 'text-slate-700 hover:text-black border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>Next Stage</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          );
        })()}
      </section>

      {/* 5. HARD SAFETY RULES & ESCALATION MATRIX */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="forge-card p-6 sm:p-10 bg-white border border-slate-200">
          <div className="max-w-2xl mb-8">
            <div className="text-[11px] font-mono font-bold tracking-widest text-slate-400 uppercase mb-1">
              Deterministic Guardrails
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Safety Lockouts: What Auto-Reconciles vs. Escalates
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-2">
              The DecisionEngine evaluates every transaction against non-negotiable policy checks. Below is the decision matrix enforcing GAAP compliance.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-mono uppercase text-[10px]">
                  <th className="py-3 px-4 font-bold">Scenario / Condition</th>
                  <th className="py-3 px-4 font-bold">Matching Signals</th>
                  <th className="py-3 px-4 font-bold">AI / Model Opinion</th>
                  <th className="py-3 px-4 font-bold">System Action</th>
                  <th className="py-3 px-4 font-bold">Rationale &amp; Safety Rule</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">Exact Invoice Match</td>
                  <td className="py-3 px-4 font-mono text-slate-600">Ref + Date + Amount (100%)</td>
                  <td className="py-3 px-4 text-slate-500">Not Invoked (Bypassed)</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      AUTO_RECONCILE
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">Zero variance, exact reference match, identical currency.</td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">Wire Transfer Fee ($25 Delta)</td>
                  <td className="py-3 px-4 font-mono text-slate-600">Ref Match, $25.00 delta</td>
                  <td className="py-3 px-4 text-slate-500">Proposes $25 Bank Fee</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      ESCALATE_TO_HUMAN
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600"><strong>Rule 4A:</strong> Material variance &gt; $0.05 CANNOT auto-post without accountant approval.</td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">5-Day Float Clearing</td>
                  <td className="py-3 px-4 font-mono text-slate-600">Amount Match, 5-day delta</td>
                  <td className="py-3 px-4 text-slate-500">Proposes Timing Diff</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      ESCALATE_TO_HUMAN
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">Requires human confirmation to record as standard timing difference.</td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">Cross-Currency Collision</td>
                  <td className="py-3 px-4 font-mono text-slate-600">Bank INR vs. Ledger USD</td>
                  <td className="py-3 px-4 text-slate-500">Proposes similar invoice ID</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      HARD_LOCKOUT
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600"><strong>Rule 4B:</strong> Zero cross-currency auto-matching permitted under any circumstance.</td>
                </tr>

                <tr className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900">Candidate Score Tie (&lt; 5%)</td>
                  <td className="py-3 px-4 font-mono text-slate-600">Candidate A: 0.89, B: 0.88</td>
                  <td className="py-3 px-4 text-slate-500">Favors Candidate A</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      AMBIGUITY_LOCK
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600"><strong>Rule 4C:</strong> Tight score margins indicate candidate ambiguity; forces human resolution.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6. CALL TO ACTION & GET STARTED */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white/85 backdrop-blur-xl border border-white/90 shadow-[0_12px_32px_-10px_rgba(244,90,140,0.12)] px-5 sm:px-8 py-3.5 sm:py-4 text-center space-y-2 sm:space-y-2.5">
          {/* Subtle luminous ambient highlight */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-28 bg-gradient-to-b from-rose-200/50 to-transparent blur-2xl pointer-events-none rounded-full" />

          <div className="relative z-10 space-y-1 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200/80 text-[10px] font-mono font-semibold tracking-wider text-rose-800 uppercase shadow-2xs">
              <Sparkles className="w-3 h-3 text-rose-600" />
              <span>Interactive Architecture Sandbox</span>
            </div>

            <h2 className="editorial-headline text-xl sm:text-2xl font-[550] text-slate-950 tracking-tight leading-snug">
              See the Architecture in Action
            </h2>

            <p className="text-xs sm:text-[13px] text-slate-600 leading-normal font-sans max-w-lg mx-auto">
              Launch the LedgerForge interactive dashboard to test live multi-currency statements, inspect the audit trail, or review real exception drawer resolution flows.
            </p>
          </div>

          {/* 3 Executive Architecture Capabilities */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-2 text-left max-w-2xl mx-auto">
            <div className="p-2 rounded-xl bg-white/70 border border-slate-200/70 shadow-2xs space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 font-sans">
                <div className="w-3.5 h-3.5 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/60 shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                </div>
                <span className="truncate">Deterministic Rules</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Zero hallucination. $0.00 exact delta matching handles high-volume clearing.
              </p>
            </div>

            <div className="p-2 rounded-xl bg-white/70 border border-slate-200/70 shadow-2xs space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 font-sans">
                <div className="w-3.5 h-3.5 rounded bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200/60 shrink-0">
                  <ShieldCheck className="w-2.5 h-2.5" />
                </div>
                <span className="truncate">CFO Safety Bounds</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Material variances, anomalies, and FX pairs require human approval.
              </p>
            </div>

            <div className="p-2 rounded-xl bg-white/70 border border-slate-200/70 shadow-2xs space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 font-sans">
                <div className="w-3.5 h-3.5 rounded bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200/60 shrink-0">
                  <Lock className="w-2.5 h-2.5" />
                </div>
                <span className="truncate">Cryptographic Lineage</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                SHA-256 decision envelopes with immutable logs for audit reviews.
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
              <span>Start Live Reconciliation</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-800 border border-slate-200/90 font-semibold text-xs py-2 px-4.5 rounded-full transition-all cursor-pointer shadow-2xs hover:shadow-xs"
            >
              <span>Return to Landing Page</span>
            </button>
          </div>

          {/* Security & Audit Assurance Seal */}
          <div className="relative z-10 pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3 text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              In-Memory Evaluation
            </span>
            <span>•</span>
            <span>Zero Hallucination Auto-Posting</span>
            <span>•</span>
            <span>Client-Side Data Isolation</span>
          </div>
        </div>
      </section>
      </main>

      {/* Shared Marketing Footer */}
      <MarketingFooter 
        onNavigate={onNavigate} 
        onEnterDashboard={onEnterDashboard} 
      />

      {/* Product Walkthrough Video Modal */}
      <VideoModal
        isOpen={isVideoOpen}
        onClose={() => setIsVideoOpen(false)}
        videoId="G-fjDaS-v9s"
        title="LedgerForge | Architecture Walkthrough & Live Demonstration"
        onEnterDashboard={onEnterDashboard}
      />

    </div>
  );
}
