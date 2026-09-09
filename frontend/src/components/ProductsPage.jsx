import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  Sparkles, 
  Scale, 
  Users, 
  Database, 
  RefreshCw, 
  Layers, 
  Check, 
  Lock,
  ChevronRight,
  TrendingUp,
  Sliders,
  Cpu,
  Terminal,
  Fingerprint,
  FileText,
  Activity,
  Hash,
  CornerDownRight,
  ExternalLink,
  Copy,
  CheckCheck,
  Zap,
  ArrowUpRight,
  Award,
  BookOpen,
  SlidersHorizontal,
  CpuIcon
} from 'lucide-react';
import { MarketingNavbar } from './MarketingNavbar';
import { MarketingFooter } from './MarketingFooter';
import { getAgentVersions } from '../services/api';
import { GradientBackground } from './ui/favorites';

export function ProductsPage({ onNavigate, onEnterDashboard, initialSection }) {
  const [activeTab, setActiveTab] = useState(initialSection || 'engine');
  const [liveVersions, setLiveVersions] = useState(null);
  const [activeExampleIndex, setActiveExampleIndex] = useState(0);

  // Interactive Simulator State (Capability 01)
  const [matchingScenario, setMatchingScenario] = useState('exact'); // 'exact' | 'fuzzy' | 'conflict'
  const [confidenceThreshold, setConfidenceThreshold] = useState(90);
  const [showAuditEnvelope, setShowAuditEnvelope] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Interactive Case Step State (Capability 02)
  const [cascadeStep, setCascadeStep] = useState(3); // 0..3

  // Interactive Reviewer Action State (Capability 03)
  const [resolvedAction, setResolvedAction] = useState(null); // null | 'approved' | 'rejected' | 'reassigned'

  // Interactive Benchmark Simulation (Capability 04)
  const [selectedPolicyVersion, setSelectedPolicyVersion] = useState('v3');
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkCompleted, setBenchmarkCompleted] = useState(false);

  // Scroll to section if specified
  useEffect(() => {
    if (initialSection && initialSection !== 'all') {
      setActiveTab(initialSection);
      const el = document.getElementById(initialSection);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [initialSection]);

  // Load real agent versions from database if available
  useEffect(() => {
    let isMounted = true;
    async function loadVersionData() {
      try {
        const versions = await getAgentVersions();
        if (isMounted && Array.isArray(versions) && versions.length > 0) {
          setLiveVersions(versions);
        }
      } catch (e) {
        // Fallback gracefully to authentic database seeds
      }
    }
    loadVersionData();
    return () => { isMounted = false; };
  }, []);

  // Authentic Sample CSV Scenarios directly from /sample_data/
  const scenarios = {
    exact: {
      title: 'Stripe Payout Straight-Through Match (Sample Row 1)',
      bankRecord: { 
        standard: 'SWIFT MT940 :61:',
        ref: 'INV-9001', 
        desc: 'STRIPE PAYOUT SETTL REF INV-9001', 
        amount: '$1,500.00', 
        curr: 'USD', 
        date: '2026-03-01',
        fee: '$0.00',
        channel: 'ACH Direct Payout'
      },
      glRecord: { 
        standard: 'ERP General Ledger Voucher',
        ref: 'INV-9001', 
        desc: 'Stripe Settlement Voucher INV-9001', 
        amount: '$1,500.00', 
        curr: 'USD', 
        date: '2026-03-01',
        account: '1010-CASH-OPR',
        voucherType: 'Standard Settlement'
      },
      score: 100,
      breakdown: { refScore: 100, amountDelta: '$0.00', currMatch: true, dateDelta: '0 days' },
      hash: 'sha256:8f4c2e91b402a77f98c1103d8819aa22bc09121a',
      envelope: {
        engine: 'Deterministic_Rules_V1',
        matched_at: '2026-03-01T14:32:00Z',
        cryptographic_proof: 'secp256k1_verified',
        invariants: [
          'CURRENCY_ISOLATION_PASSED (USD == USD)',
          'AMOUNT_TOLERANCE_ZERO ($0.00 delta)',
          'NO_DUPLICATE_LOCK (Voucher status == UNRECONCILED)'
        ],
        action: 'AUTO_POST_EXECUTE',
        audit_trail_id: 'AUD-88912-STP'
      }
    },
    fuzzy: {
      title: 'GlobalTech Wire with $20 Intermediary Fee (Sample Row 3)',
      bankRecord: { 
        standard: 'FEDWIRE CAMT.053',
        ref: 'INV-9003', 
        desc: 'GLOBALTECH WIRE NET DEP / FEE ADJ', 
        amount: '$2,480.00', 
        curr: 'USD', 
        date: '2026-03-03',
        fee: '-$20.00 Intermediary Fee',
        channel: 'Inbound Fedwire'
      },
      glRecord: { 
        standard: 'ERP General Ledger Voucher',
        ref: 'INV-9003', 
        desc: 'GlobalTech Enterprise Invoice INV-9003', 
        amount: '$2,500.00', 
        curr: 'USD', 
        date: '2026-03-03',
        account: '1100-AR-TRADE',
        voucherType: 'Trade AR Invoice'
      },
      score: 91,
      breakdown: { refScore: 100, amountDelta: '-$20.00', currMatch: true, dateDelta: '0 days' },
      hash: 'sha256:1a998c3e4450ff812901db7a6612ec9881a209b1',
      envelope: {
        engine: 'Hybrid_Fuzzy_V2 + PrecedentMemory',
        matched_at: '2026-03-03T11:15:00Z',
        precedent_match: 'VEND_GLOBALTECH_FEE_4X (Historical Match)',
        variance_tolerance: 'EXCEEDS_ZERO_TOLERANCE (-$20.00 delta)',
        action: 'ESCALATE_TO_ACCOUNTANT_QUEUE',
        suggested_adjustment: 'Debit 6120-BANK-FEES $20.00'
      }
    },
    conflict: {
      title: 'Cross-Currency ISO Invariant Conflict (Sample Row 4)',
      bankRecord: { 
        standard: 'TARGET2 ISO 20022',
        ref: 'INV-9004', 
        desc: 'EUROCLIENT INTL ADVISORY FEE', 
        amount: '€1,000.00', 
        curr: 'EUR', 
        date: '2026-03-04',
        fee: '€0.00',
        channel: 'SEPA Credit Transfer'
      },
      glRecord: { 
        standard: 'ERP General Ledger Voucher',
        ref: 'INV-9004', 
        desc: 'EuroClient Consulting Services $1,085', 
        amount: '$1,085.00', 
        curr: 'USD', 
        date: '2026-03-04',
        account: '1020-CASH-EUR',
        voucherType: 'Foreign Currency AR'
      },
      score: 42,
      breakdown: { refScore: 100, amountDelta: 'N/A (Cross-Currency)', currMatch: false, dateDelta: '0 days' },
      hash: 'sha256:ff0183b276ca9910d5402ec91028374829bc6101',
      envelope: {
        engine: 'Deterministic_Rules_V1',
        matched_at: '2026-03-04T09:44:00Z',
        invariants: [
          'CURRENCY_ISOLATION_FAILED (EUR != USD)',
          'CROSS_CURRENCY_AUTOPOST_PROHIBITED'
        ],
        action: 'HARD_BLOCK_AUTOMATIC',
        safety_boundary: 'NON_NEGOTIABLE_ISO4217_INVARIANT'
      }
    }
  };

  const activeScenarioData = scenarios[matchingScenario];
  const isAutoPostEligible = matchingScenario === 'exact' && activeScenarioData.score >= confidenceThreshold;

  const handleCopyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const safetyCases = [
    {
      type: 'Exact Match',
      outcome: 'Auto-Reconciled',
      badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-300/80',
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      bankTx: { desc: 'Stripe Payout Ref INV-9001', amount: '$1,500.00', curr: 'USD', date: '2026-03-01' },
      glTx: { desc: 'Stripe Payout INV-9001', amount: '$1,500.00', curr: 'USD', date: '2026-03-01' },
      action: 'Straight-Through Auto Post',
      reason: '100% exact reference ID, identical amount, matching currency, booking date within ±0 days.',
      risk: 'Zero Discrepancy Risk',
      steps: [
        { label: 'Ingest & Tokenize', desc: 'Stripe Payout statement string tokenized into normalized canonical schema' },
        { label: 'Field Matching', desc: 'Reference string INV-9001 matches GL voucher identifier with 100% fidelity' },
        { label: 'Safety Invariants', desc: 'Zero variance verified ($0.00 delta) and Currency ISO USD=USD confirmed' },
        { label: 'Terminal State', desc: 'Straight-Through Auto-Post recorded into immutable audit-provenance ledger' }
      ]
    },
    {
      type: 'Multiple Candidates',
      outcome: 'Escalated to Human Review',
      badge: 'bg-amber-500/10 text-amber-800 border-amber-300/80',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      bankTx: { desc: 'Vendor Payment Tech Corp', amount: '$2,500.00', curr: 'USD', date: '2026-03-03' },
      glTx: { desc: '2 open GL vouchers ($2,500.00 each, INV-8812 & INV-8819)', amount: '$2,500.00', curr: 'USD', date: '2026-03-03' },
      action: 'Hold & Escalate',
      reason: 'Top 2 candidate matches have identical amounts with confidence margin < 2%. Model stops to prevent arbitrary voucher selection.',
      risk: 'Voucher Misallocation Risk',
      steps: [
        { label: 'Ingest & Tokenize', desc: 'Vendor payment narrative extracted from ACH batch' },
        { label: 'Field Matching', desc: '2 vouchers found matching exact $2,500.00 amount' },
        { label: 'Safety Invariants', desc: 'Ambiguity safety trigger activated (Confidence Delta Margin < 2.0%)' },
        { label: 'Terminal State', desc: 'Escalated to Accountant Review Queue with candidate IDs' }
      ]
    },
    {
      type: 'Partial Payment',
      outcome: 'Escalated to Human Review',
      badge: 'bg-amber-500/10 text-amber-800 border-amber-300/80',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      bankTx: { desc: 'Acme Corp Wire Deposit', amount: '$4,200.50', curr: 'USD', date: '2026-03-05' },
      glTx: { desc: 'Invoice INV-9002 Total Due: $5,000.00', amount: '$5,000.00', curr: 'USD', date: '2026-03-01' },
      action: 'Human Queue Flag',
      reason: 'Matching reference with $799.50 partial variance. LedgerForge verifies candidate invoice and queries historical installment precedent.',
      risk: 'Underpayment Verification',
      steps: [
        { label: 'Ingest & Tokenize', desc: 'Wire statement parsed; reference INV-9002 extracted' },
        { label: 'Field Matching', desc: 'Invoice INV-9002 found; variance of -$799.50 identified' },
        { label: 'Safety Invariants', desc: 'Tolerance violation ($799.50 > $0.00 zero-tolerance)' },
        { label: 'Terminal State', desc: 'Escalated to Accountant Queue with installment breakdown' }
      ]
    },
    {
      type: 'Duplicate Candidate',
      outcome: 'Blocked Automatically',
      badge: 'bg-rose-500/10 text-rose-800 border-rose-300/80',
      icon: XCircle,
      iconColor: 'text-rose-600',
      bankTx: { desc: 'Wire Transfer INV-9001 Duplicate', amount: '$1,500.00', curr: 'USD', date: '2026-03-02' },
      glTx: { desc: 'INV-9001 (Already marked RECONCILED in Batch 2026-03)', amount: '$1,500.00', curr: 'USD', date: '2026-03-01' },
      action: 'Hard Block & Alert',
      reason: 'Candidate ledger entry already has a closed reconciliation lock. System rejects duplicate match to prevent double-crediting.',
      risk: 'Double Count Prevention',
      steps: [
        { label: 'Ingest & Tokenize', desc: 'Duplicate wire event parsed from secondary bank feed' },
        { label: 'Field Matching', desc: 'Voucher INV-9001 found in ledger historical database' },
        { label: 'Safety Invariants', desc: 'RECONCILIATION_LOCK active (status == RECONCILED)' },
        { label: 'Terminal State', desc: 'Hard Block triggered; duplicate alarm raised' }
      ]
    },
    {
      type: 'Currency Conflict',
      outcome: 'Blocked Automatically',
      badge: 'bg-rose-500/10 text-rose-800 border-rose-300/80',
      icon: XCircle,
      iconColor: 'text-rose-600',
      bankTx: { desc: 'EuroClient Consulting Fee €1,000.00', amount: '€1,000.00', curr: 'EUR', date: '2026-03-04' },
      glTx: { desc: 'EuroClient Services $1,085.00', amount: '$1,085.00', curr: 'USD', date: '2026-03-04' },
      action: 'Hard Block',
      reason: 'ISO currency mismatch (EUR vs USD). LedgerForge strictly forbids cross-currency matching without explicit FX revaluation mapping.',
      risk: 'Currency Isolation Invariant',
      steps: [
        { label: 'Ingest & Tokenize', desc: 'Bank record EUR normalized; GL voucher USD normalized' },
        { label: 'Field Matching', desc: 'Voucher found but ISO 4217 currencies differ' },
        { label: 'Safety Invariants', desc: 'Strict currency isolation rule failed (EUR != USD)' },
        { label: 'Terminal State', desc: 'Auto-Post blocked; routed to FX revaluation workflow' }
      ]
    },
    {
      type: 'Material Variance',
      outcome: 'Escalated to Human Review',
      badge: 'bg-amber-500/10 text-amber-800 border-amber-300/80',
      icon: AlertTriangle,
      iconColor: 'text-amber-600',
      bankTx: { desc: 'GlobalTech Wire Net Deposit', amount: '$2,480.00', curr: 'USD', date: '2026-03-03' },
      glTx: { desc: 'GlobalTech Invoice INV-9003', amount: '$2,500.00', curr: 'USD', date: '2026-03-03' },
      action: 'Precedent-Assisted Escalation',
      reason: 'Variance of $20.00 exceeds standard zero-tolerance. Precedent store identifies recurring $20 wire transfer intermediary fee.',
      risk: 'Unrecorded Fee Verification',
      steps: [
        { label: 'Ingest & Tokenize', desc: 'Wire transaction fee variance parsed (-$20.00 delta)' },
        { label: 'Field Matching', desc: 'Reference INV-9003 matched with 100% string fidelity' },
        { label: 'Safety Invariants', desc: 'Precedent memory queried; 4 historical wire fee matches' },
        { label: 'Terminal State', desc: 'Escalated with structured fee-split one-click resolution' }
      ]
    }
  ];

  const handleSimulateBenchmark = () => {
    setIsBenchmarking(true);
    setBenchmarkCompleted(false);
    setTimeout(() => {
      setIsBenchmarking(false);
      setBenchmarkCompleted(true);
    }, 1000);
  };

  return (
    <div className="min-h-screen text-[#18181B] flex flex-col font-sans selection:bg-slate-200 selection:text-black relative overflow-x-hidden">
      
      {/* 21st.dev Favorites Live Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <GradientBackground className="w-full h-full" />
      </div>

      {/* Shared Marketing Navbar */}
      <MarketingNavbar 
        activePage="products" 
        onNavigate={onNavigate} 
        onEnterDashboard={onEnterDashboard} 
      />

      {/* Main Page Content */}
      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-20 relative z-10 space-y-16 sm:space-y-24">
        
        {/* HERO SECTION - RESTRAINED, EDITORIAL & INSTITUTIONAL */}
        <section className="text-center max-w-4xl mx-auto pt-6 sm:pt-10 relative">
          
          {/* Executive Engineering Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-2xs text-xs text-slate-700 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-900">Deterministic Engine v2.4</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">Zero Black-Box Auto-Posts</span>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="hidden sm:inline text-slate-600">Audited SHA-256 Provenance</span>
          </div>

          <h1 className="editorial-headline text-4xl sm:text-5xl lg:text-[60px] font-[550] text-[#0F172A] tracking-tight leading-[1.08] max-w-3xl mx-auto">
            The finance agent that <span className="italic font-normal text-slate-700">knows when to stop and ask.</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mt-4 leading-relaxed font-sans font-normal">
            LedgerForge automates evidence-backed bank-to-GL reconciliation with mathematical precision, 
            while escalating ambiguous, high-variance, or risky cases to accountants with full diagnostic provenance.
          </p>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            <button 
              type="button"
              onClick={onEnterDashboard}
              className="bg-[#0F172A] hover:bg-black text-white text-xs font-semibold py-3 px-6 rounded-full flex items-center space-x-2 shadow-2xs hover:shadow transition-all cursor-pointer group hover:-translate-y-0.5"
            >
              <span>Launch Live Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-white transition-all" />
            </button>

            <button 
              type="button"
              onClick={() => onNavigate('how-it-works')}
              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold py-3 px-5 rounded-full flex items-center space-x-2 shadow-2xs transition-all cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              <span>Explore Architecture Guide</span>
            </button>
          </div>

          {/* Architectural Guarantees - High-Contrast Cards with Meaningful Semantic Tints */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-10 text-left">
            
            {/* Guarantee 1: Deterministic First (Soft Sage) */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] border border-[#DCFCE7] flex items-center justify-center text-[#166534] shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-medium text-[#166534] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#DCFCE7]">
                    Rule Boundary
                  </span>
                  <div className="text-xs font-semibold text-slate-900 mt-1">Deterministic First</div>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                $0.00 amount delta tolerance and closed reconciliation locks prevent unauthorized credits.
              </p>
            </div>

            {/* Guarantee 2: Currency Isolation (Soft Sky Blue) */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] flex items-center justify-center text-[#0369A1] shrink-0">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-medium text-[#0369A1] bg-[#F0F9FF] px-2 py-0.5 rounded border border-[#BAE6FD]">
                    ISO 4217 Invariant
                  </span>
                  <div className="text-xs font-semibold text-slate-900 mt-1">Strict Currency Guard</div>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                Hard block prevents cross-currency pairings (e.g., EUR to USD) without explicit FX revaluations.
              </p>
            </div>

            {/* Guarantee 3: Cryptographic Audit (Soft Slate Lavender) */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition-all">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center text-[#5B21B6] shrink-0">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-medium text-[#5B21B6] bg-[#F5F3FF] px-2 py-0.5 rounded border border-[#DDD6FE]">
                    Audit Provenance
                  </span>
                  <div className="text-xs font-semibold text-slate-900 mt-1">SHA-256 Decision Trail</div>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                Every auto-post and human sign-off receives an immutable cryptographic audit envelope.
              </p>
            </div>

          </div>

          {/* Quick Capability Jump Strip */}
          <div className="inline-flex flex-wrap items-center justify-center gap-1.5 mt-8 p-1.5 rounded-full bg-white border border-slate-200 shadow-2xs">
            <span className="text-[11px] text-slate-500 font-medium px-3">
              Capabilities:
            </span>
            <a 
              href="#engine" 
              className="text-xs font-medium px-3 py-1 rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center space-x-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>01. Deterministic Matching</span>
            </a>
            <a 
              href="#safety" 
              className="text-xs font-medium px-3 py-1 rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center space-x-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>02. Safety Guardrails</span>
            </a>
            <a 
              href="#exceptions" 
              className="text-xs font-medium px-3 py-1 rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center space-x-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <span>03. Accountant Review</span>
            </a>
            <a 
              href="#evolution" 
              className="text-xs font-medium px-3 py-1 rounded-full text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center space-x-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>04. Policy Lineage</span>
            </a>
          </div>
        </section>

        {/* MODULE 01: DETERMINISTIC RECONCILIATION WITH LIVE MATCHING SIMULATOR */}
        <section id="engine" className="scroll-mt-24 space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-3.5">
            <div>
              <div className="text-[10px] font-mono font-medium tracking-wider text-slate-600 uppercase flex items-center space-x-1.5">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Capability 01
                </span>
                <span>Deterministic Core Engine</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1.5">
                Deterministic Bank-to-GL Matching Simulator
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              Multi-tier mathematical scoring across reference IDs, amounts, dates, and ISO 4217 currency isolation before probabilistic models are consulted.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left Column: Interactive Scenario Controller & Threshold */}
            <div className="lg:col-span-5 space-y-3.5">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-800 flex items-center space-x-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Select Real Sample Statement</span>
                  </span>
                  <span className="text-[10px] font-mono font-medium text-[#166534] bg-[#F0FDF4] px-2 py-0.5 rounded border border-[#DCFCE7]">
                    Interactive
                  </span>
                </div>

                {/* Scenario Selection Tabs */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setMatchingScenario('exact')}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      matchingScenario === 'exact'
                        ? 'bg-[#F0FDF4] border-[#86EFAC] text-slate-900 shadow-2xs ring-1 ring-emerald-400/40'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${matchingScenario === 'exact' ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                        <span>Exact Reference &amp; Amount</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 ml-3.5 font-mono">
                        100% Match • $0.00 Variance • USD=USD
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      matchingScenario === 'exact'
                        ? 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      Auto Post
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMatchingScenario('fuzzy')}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      matchingScenario === 'fuzzy'
                        ? 'bg-[#FFFBEB] border-[#FDE047] text-slate-900 shadow-2xs ring-1 ring-amber-400/40'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${matchingScenario === 'fuzzy' ? 'bg-amber-600' : 'bg-slate-300'}`} />
                        <span>Wire Intermediary Fee (-$20)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 ml-3.5 font-mono">
                        91% Match • Precedent Hit • CPA Review
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      matchingScenario === 'fuzzy'
                        ? 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      CPA Review
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMatchingScenario('conflict')}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      matchingScenario === 'conflict'
                        ? 'bg-[#FEF2F2] border-[#FDA4AF] text-slate-900 shadow-2xs ring-1 ring-rose-400/40'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${matchingScenario === 'conflict' ? 'bg-rose-600' : 'bg-slate-300'}`} />
                        <span>Cross-Currency ISO Conflict</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 ml-3.5 font-mono">
                        EUR vs USD • Hard Boundary Stopped
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      matchingScenario === 'conflict'
                        ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      Hard Block
                    </span>
                  </button>
                </div>

                {/* 3-Zone Threshold Slider */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center space-x-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>Auto-Post Confidence Gate</span>
                    </span>
                    <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {confidenceThreshold}% Gate
                    </span>
                  </div>
                  <input
                    type="range"
                    min="85"
                    max="99"
                    value={confidenceThreshold}
                    onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                    className="w-full fintech-slider cursor-pointer"
                  />
                  <div className="grid grid-cols-3 gap-1 pt-1 text-[10px] font-mono text-center">
                    <span className="bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] py-0.5 rounded">85-89% CPA Hold</span>
                    <span className="bg-slate-100 text-slate-700 border border-slate-200 py-0.5 rounded">90-94% Standard</span>
                    <span className="bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7] py-0.5 rounded font-medium">95-99% Auto</span>
                  </div>
                </div>

              </div>

              {/* Invariant Rules Information Box */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-2xs">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-700 font-semibold flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#166534]" />
                  <span>Deterministic Invariant Rules</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-[#166534] mt-0.5 shrink-0" />
                    <span><strong>Currency Isolation:</strong> Automated matches strictly blocked across ISO currency boundaries.</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-[#166534] mt-0.5 shrink-0" />
                    <span><strong>Single Lock Invariant:</strong> Once reconciled, GL vouchers are locked against double allocation.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column: Live Matching Trace & Provenance Output */}
            <div className="lg:col-span-7">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
                <div>
                  <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center">
                        <Terminal className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-900 block">
                          Match Execution Trace
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Core Engine Stream • ISO-20022 Verifier
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono font-medium px-2.5 py-1 rounded border ${
                      matchingScenario === 'exact'
                        ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]'
                        : matchingScenario === 'fuzzy'
                        ? 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]'
                        : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                    }`}>
                      {matchingScenario === 'exact' ? 'TIER 1 DETERMINISTIC MATCH' : matchingScenario === 'fuzzy' ? 'TIER 2 ADVISORY CANDIDATE' : 'HARD INVARIANT REJECTION'}
                    </span>
                  </div>

                  {/* Dual Transaction Comparison Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    
                    {/* Bank Feed Card (Sky Blue Accent) */}
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#BAE6FD] space-y-2">
                      <div className="text-[10px] font-mono uppercase font-semibold flex items-center justify-between text-slate-700">
                        <span>Bank Statement Feed</span>
                        <span className="text-[9px] bg-[#EFF6FF] text-[#0369A1] border border-[#BFDBFE] px-2 py-0.5 rounded font-mono font-medium">
                          {activeScenarioData.bankRecord.standard}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 truncate font-mono">
                        {activeScenarioData.bankRecord.desc}
                      </div>
                      <div className="text-xs text-slate-600 space-y-1 font-mono pt-1.5 border-t border-slate-200">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Amount:</span>
                          <strong className="text-slate-900 font-semibold">{activeScenarioData.bankRecord.amount}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Currency:</span>
                          <span className="font-medium text-[#0369A1]">{activeScenarioData.bankRecord.curr} (ISO 4217)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Date:</span>
                          <span className="text-slate-700">{activeScenarioData.bankRecord.date}</span>
                        </div>
                      </div>
                    </div>

                    {/* General Ledger Voucher Card */}
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                      <div className="text-[10px] font-mono uppercase font-semibold flex items-center justify-between text-slate-700">
                        <span>General Ledger Candidate</span>
                        <span className="text-[9px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded font-mono font-medium">
                          {activeScenarioData.glRecord.standard}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 truncate font-mono">
                        {activeScenarioData.glRecord.desc}
                      </div>
                      <div className="text-xs text-slate-600 space-y-1 font-mono pt-1.5 border-t border-slate-200">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Amount:</span>
                          <strong className="text-slate-900 font-semibold">{activeScenarioData.glRecord.amount}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Currency:</span>
                          <span className="font-medium text-slate-900">{activeScenarioData.glRecord.curr} (ISO 4217)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Date:</span>
                          <span className="text-slate-700">{activeScenarioData.glRecord.date}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Active Match Verdict Ribbon */}
                  <div className={`mt-3 p-2.5 rounded-lg border text-xs font-mono font-medium flex items-center justify-between ${
                    matchingScenario === 'exact'
                      ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                      : matchingScenario === 'fuzzy'
                      ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                      : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                  }`}>
                    <span className="flex items-center space-x-1.5 truncate">
                      {matchingScenario === 'exact' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : matchingScenario === 'fuzzy' ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                      <span className="truncate">
                        {matchingScenario === 'exact' ? 'Verdict: Exact Match ($1,500.00 == $1,500.00) • Zero Tolerance Met' : matchingScenario === 'fuzzy' ? 'Verdict: Intermediary Fee Detected (-$20.00 Delta) • Escalate to CPA' : 'Verdict: ISO Invariant Violation (EUR ≠ USD) • Hard Stop'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 ml-2">
                      Score: {activeScenarioData.score}%
                    </span>
                  </div>

                  {/* Invariant Evaluation Breakdown Matrix */}
                  <div className="mt-3 space-y-2 bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 font-semibold uppercase mb-1">
                      <span>Deterministic Rule Evaluation</span>
                      <span className="text-slate-800">Computed Score: {activeScenarioData.score}%</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center space-x-2 text-slate-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Reference Fidelity: <strong className="text-emerald-700">{activeScenarioData.breakdown.refScore}%</strong></span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-700">
                        {matchingScenario === 'conflict' ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        ) : matchingScenario === 'fuzzy' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span>Amount Delta: <strong className="text-slate-900">{activeScenarioData.breakdown.amountDelta}</strong></span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-700">
                        {activeScenarioData.breakdown.currMatch ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        )}
                        <span>Currency Isolation: <strong className={activeScenarioData.breakdown.currMatch ? 'text-emerald-700' : 'text-rose-700'}>
                          {activeScenarioData.breakdown.currMatch ? 'PASSED' : 'VIOLATION'}
                        </strong></span>
                      </div>
                      <div className="flex items-center space-x-2 text-slate-700">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Date Tolerance: <strong className="text-slate-900">{activeScenarioData.breakdown.dateDelta}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic Hash Bar - Clean Professional Panel */}
                  <div className="mt-3 flex items-center justify-between text-xs font-mono bg-[#F8FAFC] text-slate-700 p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <div className="flex items-center space-x-2 truncate">
                      <Fingerprint className="w-4 h-4 text-slate-500 shrink-0" />
                      <span className="text-slate-500 text-[10px]">AUDIT HASH:</span>
                      <span className="font-semibold text-slate-800 truncate">{activeScenarioData.hash}</span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleCopyHash(activeScenarioData.hash)}
                        className="text-[11px] text-slate-700 hover:text-slate-900 font-medium flex items-center space-x-1 cursor-pointer bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded shadow-2xs transition-colors"
                        title="Copy Hash"
                      >
                        {copiedHash ? (
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAuditEnvelope(!showAuditEnvelope)}
                        className="text-[11px] text-slate-600 hover:text-slate-900 font-medium cursor-pointer underline ml-1"
                      >
                        {showAuditEnvelope ? 'Hide JSON' : 'Inspect JSON'}
                      </button>
                    </div>
                  </div>

                  {/* Expandable JSON Audit Envelope */}
                  {showAuditEnvelope && (
                    <pre className="mt-2.5 p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[10px] overflow-x-auto border border-slate-800">
                      {JSON.stringify(activeScenarioData.envelope, null, 2)}
                    </pre>
                  )}

                </div>

                {/* Determination Banner */}
                <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isAutoPostEligible
                    ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]'
                    : matchingScenario === 'fuzzy'
                    ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                    : 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]'
                }`}>
                  <div className="flex items-center space-x-3">
                    {isAutoPostEligible ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : matchingScenario === 'fuzzy' ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-semibold">
                        {isAutoPostEligible
                          ? 'Straight-Through Auto-Post Authorized'
                          : matchingScenario === 'fuzzy'
                          ? 'Model Advisory Passed → Held for Human CPA Signoff'
                          : 'Deterministic Safety Invariant Tripped → Match Blocked'}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {isAutoPostEligible
                          ? 'Meets 100% exact threshold. Automatically booked to General Ledger.'
                          : matchingScenario === 'fuzzy'
                          ? 'Score below auto-post bar. Routed to Accountant Review Workspace with fee-split suggestion.'
                          : 'ISO 4217 Currency conflict prevents false automated pairing.'}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 text-xs font-mono font-semibold px-3 py-1 rounded bg-white border border-slate-200 text-slate-800 shadow-2xs">
                    Score: {activeScenarioData.score}%
                  </span>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* MODULE 02: AMBIGUITY & SAFETY MATRIX WITH STEP-BY-STEP CASCADE */}
        <section id="safety" className="scroll-mt-24 space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-3.5">
            <div>
              <div className="text-[10px] font-mono font-medium tracking-wider text-slate-600 uppercase flex items-center space-x-1.5">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Capability 02
                </span>
                <span>Safety &amp; Boundary Engine</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1.5">
                Autonomous Safety &amp; Ambiguity Sandbox
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              LedgerForge does not treat every transaction as safe to automate. Review the concrete edge conditions that trigger holds or blocks.
            </p>
          </div>

          {/* Interactive Case Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {safetyCases.map((c, idx) => {
              const isSelected = activeExampleIndex === idx;
              const isBlock = c.outcome.includes('Blocked');
              return (
                <button
                  key={c.type}
                  type="button"
                  onClick={() => {
                    setActiveExampleIndex(idx);
                    setCascadeStep(3);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }`}>
                      Case 0{idx + 1}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${isBlock ? 'bg-rose-500' : 'bg-amber-500'}`} />
                  </div>
                  <div className="text-xs font-semibold mt-1 truncate">
                    {c.type}
                  </div>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded mt-1.5 inline-block ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : isBlock
                      ? 'bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]'
                      : 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                  }`}>
                    {c.outcome.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Case Deep Dive Card */}
          {(() => {
            const current = safetyCases[activeExampleIndex];
            const Icon = current.icon;
            const isBlock = current.outcome.includes('Blocked');
            return (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5 shadow-xs">
                
                {/* Header Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl border ${
                      isBlock ? 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]' : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-slate-900">{current.type}</h3>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          isBlock ? 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]' : 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]'
                        }`}>
                          {current.outcome}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Autonomous Guardrail: <strong className="text-slate-800">{current.risk}</strong>
                      </p>
                    </div>
                  </div>
                  <span className="self-start sm:self-auto text-xs font-mono font-medium px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 shadow-2xs">
                    {current.action}
                  </span>
                </div>

                {/* Interactive Decision Cascade Timeline Pipeline */}
                <div className="space-y-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-600 font-semibold flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>Autonomous Decision Pipeline (Click step to inspect)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {current.steps.map((st, sIdx) => {
                      const isActive = cascadeStep === sIdx;
                      return (
                        <button
                          key={st.label}
                          type="button"
                          onClick={() => setCascadeStep(sIdx)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isActive
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-[#F8FAFC] text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                            isActive ? 'text-slate-300' : 'text-slate-500'
                          }`}>
                            Step 0{sIdx + 1}
                          </div>
                          <div className="text-xs font-semibold mt-0.5 truncate">
                            {st.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active Step Inspection Callout */}
                  <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-slate-800 flex items-start space-x-2.5 shadow-2xs">
                    <CornerDownRight className="w-4 h-4 text-[#92400E] mt-0.5 shrink-0" />
                    <div>
                      <span className="font-mono font-semibold text-[#92400E] uppercase">
                        Step 0{cascadeStep + 1} // {current.steps[cascadeStep].label}:
                      </span>{' '}
                      <span className="text-slate-800 font-normal">{current.steps[cascadeStep].desc}</span>
                    </div>
                  </div>
                </div>

                {/* Input vs Reasoning Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-2">
                    <div className="text-[10px] font-mono text-slate-500 uppercase font-semibold flex items-center space-x-1">
                      <span>Input Transaction Pairs</span>
                    </div>
                    <div className="text-xs space-y-1.5 text-slate-800 font-mono">
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <strong className="text-blue-900">Bank Statement:</strong> {current.bankTx.desc} ({current.bankTx.amount} {current.bankTx.curr})
                      </div>
                      <div className="p-2 rounded bg-white border border-slate-200">
                        <strong className="text-slate-900">GL Match:</strong> {current.glTx.desc} ({current.glTx.amount} {current.glTx.curr})
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#FFFBEB]/50 border border-[#FDE68A]/70 space-y-2">
                    <div className="text-[10px] font-mono text-[#92400E] uppercase font-semibold">
                      Safety Rule Invariant Rationale
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {current.reason}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F8FAFC] text-slate-700 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-mono text-[11px]">Enforced Invariant Gate:</span>
                  <span className="font-mono font-medium text-[#92400E] bg-[#FFFBEB] px-2.5 py-0.5 rounded border border-[#FDE68A]">
                    {current.risk}
                  </span>
                </div>
              </div>
            );
          })()}
        </section>

        {/* MODULE 03: ACCOUNTANT REVIEW WORKSPACE WITH INTERACTIVE REVIEWER SIGN-OFF */}
        <section id="exceptions" className="scroll-mt-24 space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-3.5">
            <div>
              <div className="text-[10px] font-mono font-medium tracking-wider text-slate-600 uppercase flex items-center space-x-1.5">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Capability 03
                </span>
                <span>Human-In-The-Loop Workspace</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1.5">
                Accountant Exception Review Workspace
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              When uncertainty arises, LedgerForge escalates to the Human Review Queue with candidate evidence, precedent analysis, and structured resolution actions.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5 shadow-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded bg-[#F5F3FF] text-[#5B21B6] flex items-center justify-center border border-[#DDD6FE]">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-slate-900">
                  Interactive Human Review Drawer
                </span>
              </div>
              <span className={`text-[11px] font-mono px-3 py-1 rounded font-medium border ${
                resolvedAction 
                  ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]' 
                  : 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]'
              }`}>
                {resolvedAction ? '✓ RESOLVED BY CPA REVIEWER' : '• EXCEPTION PENDING REVIEW'}
              </span>
            </div>

            {/* Exception Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              
              {/* Col 1: Discrepancy Evidence */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3">
                <div className="text-[10px] font-mono text-slate-700 uppercase font-semibold flex items-center justify-between border-b border-slate-200 pb-2">
                  <span>1. Discrepancy Evidence</span>
                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono font-medium">VOUCHER AUDIT</span>
                </div>
                <div className="text-xs space-y-2.5 text-slate-700">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-mono uppercase">Bank Transaction</span>
                    <strong className="text-slate-900 text-sm">GlobalTech Wire Net Deposit</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <span className="text-slate-500 block text-[9px] font-mono">BANK AMOUNT</span>
                      <span className="font-mono font-semibold text-[#0369A1] text-xs">$2,480.00 USD</span>
                    </div>
                    <div className="p-2 rounded bg-white border border-slate-200">
                      <span className="text-slate-500 block text-[9px] font-mono">LEDGER VOUCHER</span>
                      <span className="font-mono font-semibold text-slate-900 text-xs">$2,500.00 USD</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-mono uppercase mb-1">Calculated Variance</span>
                    <span className="font-mono font-semibold text-[#991B1B] bg-[#FEF2F2] px-2.5 py-1 rounded border border-[#FECACA] inline-block text-xs">
                      -$20.00 (Intermediary Fee Delta)
                    </span>
                  </div>
                </div>
              </div>

              {/* Col 2: AI Diagnostic Recommendation & Precedent Memory (Soft Lavender) */}
              <div className="p-4 rounded-xl bg-[#FAF5FF] border border-[#E9D5FF] space-y-3">
                <div className="text-[10px] font-mono text-[#5B21B6] uppercase font-semibold flex items-center justify-between border-b border-[#DDD6FE] pb-2">
                  <span>2. AI Advisory Recommendation</span>
                  <span className="text-[9px] bg-[#EDE9FE] text-[#5B21B6] border border-[#DDD6FE] px-2 py-0.5 rounded font-mono font-medium">NON-AUTHORITATIVE</span>
                </div>
                <p className="text-xs text-slate-800 leading-relaxed">
                  "Reference ID INV-9003 matches customer invoice. The $20.00 discrepancy matches historical international wire intermediary processing fee patterns."
                </p>
                <div className="p-3 rounded-lg bg-white border border-[#DDD6FE] space-y-1.5 text-[11px]">
                  <div className="font-mono font-semibold text-[#5B21B6] flex items-center space-x-1.5">
                    <Database className="w-3.5 h-3.5 text-[#5B21B6]" />
                    <span>Precedent Memory Hit (4 matches)</span>
                  </div>
                  <p className="text-slate-600 text-[10px] leading-relaxed">
                    Accountants previously accepted -$20 wire fee adjustments on this vendor profile in Q4 2025.
                  </p>
                </div>
              </div>

              {/* Col 3: Interactive Structured Resolution Actions */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="text-[10px] font-mono text-slate-700 uppercase font-semibold flex items-center justify-between border-b border-slate-200 pb-2">
                    <span>3. Reviewer Sign-Off</span>
                    {resolvedAction && (
                      <button 
                        type="button" 
                        onClick={() => setResolvedAction(null)}
                        className="text-[10px] text-slate-500 hover:text-slate-800 hover:underline cursor-pointer font-medium"
                      >
                        Reset Action
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Select a structured CPA resolution:
                  </p>

                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setResolvedAction('approved')}
                      className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        resolvedAction === 'approved'
                          ? 'bg-[#15803D] text-white border-[#15803D] shadow-2xs'
                          : 'bg-[#15803D] hover:bg-[#166534] text-white border-[#15803D]'
                      }`}
                    >
                      <span>Approve with $20 Fee Split</span>
                      <Check className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setResolvedAction('rejected')}
                      className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        resolvedAction === 'rejected'
                          ? 'bg-[#991B1B] text-white border-[#991B1B] shadow-2xs'
                          : 'bg-white hover:bg-rose-50 text-[#991B1B] border-rose-200'
                      }`}
                    >
                      <span>Reject Match (Return to Queue)</span>
                      <XCircle className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setResolvedAction('reassigned')}
                      className={`w-full p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                        resolvedAction === 'reassigned'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span>Re-assign to Treasury Lead</span>
                      <Users className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Audit Certificate Feedback Bar */}
                {resolvedAction ? (
                  <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-[10px] font-mono text-[#166534] space-y-0.5 animate-in fade-in duration-150">
                    <div className="font-bold flex items-center space-x-1.5">
                      <Award className="w-4 h-4 text-emerald-700" />
                      <span>AUDIT CERTIFICATE #AUD-9912 SIGNED</span>
                    </div>
                    <div className="text-emerald-800">Authenticated via CPA reviewer • Stored in Precedent Memory</div>
                  </div>
                ) : (
                  <div className="pt-2 text-[10px] font-mono text-slate-500">
                    Resolutions feed back into precedent memory for continuous refinement.
                  </div>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* MODULE 04: AGENT EVOLUTION & INTERACTIVE POLICY BENCHMARK LAB */}
        <section id="evolution" className="scroll-mt-24 space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-3.5">
            <div>
              <div className="text-[10px] font-mono font-medium tracking-wider text-slate-600 uppercase flex items-center space-x-1.5">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  Capability 04
                </span>
                <span>Policy Governance</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1.5">
                Controlled Agent Evolution &amp; Policy Lineage
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              Controlled offline optimization. Candidate policies are benchmarked against historical ground truth and require explicit human promotion.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-6 shadow-xs">
            
            {/* The 6-Step Controlled Promotion Lifecycle Flowchart */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {[
                { step: '01', name: 'Observe', desc: 'Exceptions & accountant feedback recorded', color: 'border-slate-200 bg-[#F8FAFC] text-slate-800' },
                { step: '02', name: 'Analyze', desc: 'Failure analysis isolates error patterns', color: 'border-slate-200 bg-[#F8FAFC] text-slate-800' },
                { step: '03', name: 'Propose', desc: 'Meta-agent drafts candidate policy', color: 'border-slate-200 bg-[#F8FAFC] text-slate-800' },
                { step: '04', name: 'Evaluate', desc: 'Offline simulation on test ledger suites', color: 'border-slate-200 bg-[#F8FAFC] text-slate-800' },
                { step: '05', name: 'Validate', desc: 'Verifies 0% false auto-post invariant', color: 'border-slate-200 bg-[#F8FAFC] text-slate-800' },
                { step: '06', name: 'Promote', desc: 'CFO/Admin promotes to production', color: 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534] font-medium' }
              ].map((s) => (
                <div key={s.step} className={`p-3 rounded-xl border space-y-1 text-left ${s.color}`}>
                  <div className="text-[10px] font-mono font-medium uppercase opacity-70">
                    Step {s.step}
                  </div>
                  <div className="text-xs font-semibold">
                    {s.name}
                  </div>
                  <div className="text-[11px] opacity-75 leading-tight">
                    {s.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Non-Negotiable Safety Boundary Banner */}
            <div className="p-4 sm:p-5 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-100 text-[#92400E] border border-[#FDE68A] mt-0.5 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#92400E] uppercase font-mono tracking-wider">
                    Non-Negotiable Production Safety Boundary
                  </h4>
                  <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                    <strong>Candidate policies never replace production automatically.</strong> Even with high simulated accuracy, an agent proposal cannot self-promote. An authorized human administrator must review the benchmark diff and click Promote.
                  </p>
                </div>
              </div>

              <div className="shrink-0 font-mono text-xs bg-white border border-[#FDE68A] px-3 py-1.5 rounded-lg text-[#92400E] font-medium shadow-2xs">
                Human Signoff Required
              </div>
            </div>

            {/* Interactive Policy Benchmark Evaluation Playground */}
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold text-slate-900 block flex items-center space-x-1.5">
                    <CpuIcon className="w-4 h-4 text-slate-600" />
                    <span>Real Agent Policy Lineage (from Database Seeds)</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Select a version to inspect its configured parameters, matching strategy, and safety threshold.
                  </p>
                </div>

                {/* Benchmark Simulation Trigger Button */}
                <button
                  type="button"
                  onClick={handleSimulateBenchmark}
                  disabled={isBenchmarking}
                  className="inline-flex items-center space-x-2 bg-[#0F172A] hover:bg-black text-white text-xs font-mono font-medium px-4 py-2.5 rounded-xl shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBenchmarking ? 'animate-spin' : ''}`} />
                  <span>{isBenchmarking ? 'Running Batch Evaluation...' : 'Simulate Sample Batch Test'}</span>
                </button>
              </div>

              {/* Benchmark Status Banner with 4-Metric Grid */}
              {benchmarkCompleted && (
                <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between font-mono text-xs border-b border-[#DCFCE7] pb-2">
                    <div className="flex items-center space-x-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>Batch Test Complete: 6 Sample Records Tested (Stripe Payout, GlobalTech Wire, EuroClient EUR, etc.)</span>
                    </div>
                    <span className="font-semibold text-[#166534] bg-white px-2.5 py-0.5 rounded border border-[#BBF7D0]">
                      PASSED BENCHMARK
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                    <div className="p-2 rounded-lg bg-white border border-[#DCFCE7]">
                      <div className="text-[9px] text-slate-500 uppercase">False Auto-Posts</div>
                      <div className="text-sm font-semibold text-emerald-700">0.00% (Strict)</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#DCFCE7]">
                      <div className="text-[9px] text-slate-500 uppercase">Currency Isolation</div>
                      <div className="text-sm font-semibold text-[#0369A1]">100% Passed</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#DCFCE7]">
                      <div className="text-[9px] text-slate-500 uppercase">Auto-Post Yield</div>
                      <div className="text-sm font-semibold text-slate-900">+14.2% Boost</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#DCFCE7]">
                      <div className="text-[9px] text-slate-500 uppercase">Records Audited</div>
                      <div className="text-sm font-semibold text-slate-900">6 of 6 Real Seeds</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Version Comparison Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-mono text-[11px] border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Policy Version</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Confidence Gate</th>
                      <th className="p-3">Matching Strategy</th>
                      <th className="p-3">Escalation Boundary</th>
                      <th className="p-3">LLM Architecture</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr 
                      onClick={() => setSelectedPolicyVersion('v1')}
                      className={`cursor-pointer transition-colors ${selectedPolicyVersion === 'v1' ? 'bg-slate-50 font-medium' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="p-3 font-mono font-semibold text-slate-900 flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        <span>v1: Baseline</span>
                      </td>
                      <td className="p-3"><span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">Active</span></td>
                      <td className="p-3 font-mono font-semibold text-slate-800">90% Auto-Post</td>
                      <td className="p-3 font-mono text-slate-700">deterministic_rules</td>
                      <td className="p-3 text-slate-600 font-mono">Require 2 Evidence Count</td>
                      <td className="p-3 text-slate-600">gpt-4o-mini (Deterministic First)</td>
                    </tr>
                    
                    <tr 
                      onClick={() => setSelectedPolicyVersion('v2')}
                      className={`cursor-pointer transition-colors ${selectedPolicyVersion === 'v2' ? 'bg-[#FFFBEB] font-medium' : 'hover:bg-[#FFFBEB]/50'}`}
                    >
                      <td className="p-3 font-mono font-semibold text-slate-900 flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>v2: Fuzzy Enhanced</span>
                      </td>
                      <td className="p-3"><span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">Active</span></td>
                      <td className="p-3 font-mono font-semibold text-[#92400E]">88% Auto-Post</td>
                      <td className="p-3 font-mono text-slate-700">hybrid_fuzzy ($25 Fee Tolerance)</td>
                      <td className="p-3 text-[#92400E] font-mono">Escalate on Conflict</td>
                      <td className="p-3 text-slate-600">gpt-4o-mini (Fee Tolerance)</td>
                    </tr>
                    
                    <tr 
                      onClick={() => setSelectedPolicyVersion('v3')}
                      className={`cursor-pointer transition-colors ${selectedPolicyVersion === 'v3' ? 'bg-[#F0FDF4]/70 font-medium border-l-4 border-l-emerald-600' : 'hover:bg-[#F0FDF4]/40 border-l-4 border-l-emerald-500'}`}
                    >
                      <td className="p-3 font-mono font-semibold text-[#166534] flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        <span>v3: Autonomous LLM</span>
                      </td>
                      <td className="p-3"><span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-700 text-white font-medium shadow-2xs">Production</span></td>
                      <td className="p-3 font-mono font-semibold text-[#166534]">85% Auto-Post</td>
                      <td className="p-3 font-mono text-slate-800 font-semibold">cognitive_autonomous</td>
                      <td className="p-3 text-[#166534] font-mono">Require Dual Invariant Policy</td>
                      <td className="p-3 text-slate-700">gpt-4o (Precedent Memory Gated)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </section>

        {/* BOTTOM CALL TO ACTION - EXECUTIVE CHARCOAL WITH HIGH CRAFT */}
        <section className="text-center bg-[#0F172A] border border-slate-800 rounded-2xl p-8 sm:p-12 space-y-4 text-white shadow-xl relative overflow-hidden">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-800 text-[10px] font-mono uppercase tracking-wider text-slate-300 font-medium mb-1 border border-slate-700">
            <Sparkles className="w-3.5 h-3.5 text-slate-400" />
            <span>FINANCIAL RECONCILIATION WORKSPACE</span>
          </div>

          <h2 className="editorial-headline text-3xl sm:text-4xl lg:text-5xl font-[550] text-white tracking-tight max-w-2xl mx-auto">
            Ready to test autonomous reconciliation on real ledger data?
          </h2>
          
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed font-sans font-normal">
            Launch the active LedgerForge workspace to run statement uploads, inspect exception queues, and observe the policy evaluation loop in action.
          </p>

          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onEnterDashboard}
              className="bg-white hover:bg-slate-100 text-slate-950 font-semibold text-xs py-3 px-6 rounded-full shadow-sm hover:shadow transition-all flex items-center space-x-2 cursor-pointer group hover:-translate-y-0.5"
            >
              <span>Launch Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('security')}
              className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-medium text-xs py-3 px-5 rounded-full transition-all cursor-pointer"
            >
              <span>Review Financial Security</span>
            </button>
          </div>
        </section>

      </main>

      {/* Shared Marketing Footer */}
      <MarketingFooter onNavigate={onNavigate} onEnterDashboard={onEnterDashboard} />
    </div>
  );
}

