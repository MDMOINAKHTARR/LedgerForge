import React, { useState } from 'react';
import { 
  Check, 
  ArrowRight, 
  Plus, 
  Minus, 
  Scale, 
  Users, 
  FileCheck, 
  ShieldCheck
} from 'lucide-react';
import { MarketingNavbar } from './MarketingNavbar';
import { MarketingFooter } from './MarketingFooter';
import { GradientBackground } from './ui/cotton-bubblegum-lilac';

export function PricingPage({ onNavigate, onEnterDashboard }) {
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const plans = [
    {
      id: 'starter',
      topLabel: 'START HERE',
      name: 'Starter',
      description: 'For finance teams moving their reconciliation workflow out of spreadsheets.',
      price: 'Pilot',
      priceSubtext: 'Core reconciliation workflow',
      cta: 'Get started',
      ctaType: 'secondary',
      badge: null,
      isEmphasized: false,
      bgClass: 'bg-[#FAF8F5]',
      borderClass: 'border-[#EAE3D5]',
      patternStyle: {
        backgroundImage: `
          linear-gradient(to right, rgba(160, 120, 80, 0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(160, 120, 80, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px'
      },
      featureHeading: "What's included",
      features: [
        'Bank + ledger ingestion',
        'Deterministic matching',
        'Exception queue',
        'Accountant review',
        'Audit trail',
        'CSV-based workflows'
      ],
      bestFor: 'Teams establishing a reliable reconciliation process.'
    },
    {
      id: 'growth',
      topLabel: 'RECOMMENDED',
      name: 'Growth',
      description: 'For finance teams ready to automate investigation, exception handling, and historical decision support.',
      price: 'Custom',
      priceSubtext: 'Based on workflow and volume',
      cta: 'Talk to us',
      ctaType: 'primary',
      badge: 'MOST POPULAR',
      isEmphasized: true,
      bgClass: 'bg-[#F3F5FA]',
      borderClass: 'border-[#CAD2E8]',
      patternStyle: {
        backgroundImage: `radial-gradient(rgba(70, 90, 160, 0.09) 1px, transparent 1px)`,
        backgroundSize: '18px 18px'
      },
      featureHeading: 'Everything in Starter, plus',
      features: [
        'AI-assisted exception investigation',
        'Reconciliation memory',
        'Structured accountant feedback',
        'Advanced exception handling',
        'Agent policy evaluation & promotion',
        'Full decision provenance'
      ],
      bestFor: 'Finance teams scaling reconciliation without giving up control.'
    },
    {
      id: 'enterprise',
      topLabel: 'FOR COMPLEX OPERATIONS',
      name: 'Enterprise',
      description: 'For organizations that need deeper governance, tailored workflows, and larger-scale reconciliation operations.',
      price: 'Custom',
      priceSubtext: 'Designed around your finance operation',
      cta: 'Contact us',
      ctaType: 'secondary',
      badge: null,
      isEmphasized: false,
      bgClass: 'bg-[#F2F7F5]',
      borderClass: 'border-[#CCE0D8]',
      patternStyle: {
        backgroundImage: `
          linear-gradient(45deg, rgba(60, 140, 110, 0.04) 25%, transparent 25%),
          linear-gradient(-45deg, rgba(60, 140, 110, 0.04) 25%, transparent 25%)
        `,
        backgroundSize: '24px 24px'
      },
      featureHeading: 'Growth features, plus',
      features: [
        'Advanced policy governance',
        'Human-in-the-loop controls',
        'Audit-ready decision history',
        'Custom reconciliation workflows',
        'Integration-ready architecture',
        'Dedicated onboarding'
      ],
      bestFor: 'Organizations with complex finance operations and governance requirements.'
    }
  ];

  const scaleSteps = [
    {
      stage: 'START',
      title: 'Reconcile',
      description: 'Deterministic matching and accountant review.'
    },
    {
      stage: 'SCALE',
      title: 'Investigate',
      description: 'AI-assisted exception analysis and historical precedent.'
    },
    {
      stage: 'GOVERN',
      title: 'Improve',
      description: 'Policy evaluation, auditability, and controlled agent promotion.'
    }
  ];

  const comparisonRows = [
    { capability: 'Bank + ledger reconciliation', starter: true, growth: true, enterprise: true },
    { capability: 'Deterministic matching', starter: true, growth: true, enterprise: true },
    { capability: 'Accountant review', starter: true, growth: true, enterprise: true },
    { capability: 'Audit trail', starter: true, growth: true, enterprise: true },
    { capability: 'AI exception investigation', starter: false, growth: true, enterprise: true },
    { capability: 'Reconciliation memory', starter: false, growth: true, enterprise: true },
    { capability: 'Agent evaluation', starter: false, growth: true, enterprise: true },
    { capability: 'Policy governance', starter: false, growth: true, enterprise: true },
    { capability: 'Custom workflows', starter: false, growth: false, enterprise: true },
    { capability: 'Integration-ready architecture', starter: false, growth: false, enterprise: true }
  ];

  const trustStripItems = [
    {
      icon: Scale,
      title: 'DETERMINISTIC MATCHING',
      subtitle: 'No financial decisions delegated entirely to an LLM.'
    },
    {
      icon: Users,
      title: 'HUMAN REVIEW',
      subtitle: 'Ambiguous cases stop for accountant review.'
    },
    {
      icon: FileCheck,
      title: 'AUDIT TRAIL',
      subtitle: 'Machine and human decisions remain traceable.'
    },
    {
      icon: ShieldCheck,
      title: 'CONTROLLED EVOLUTION',
      subtitle: 'New agent policies require validation and explicit promotion.'
    }
  ];

  const faqs = [
    {
      question: 'Is LedgerForge fully autonomous?',
      answer: 'No. It automates evidence-backed reconciliation while escalating ambiguous or risky cases to humans.'
    },
    {
      question: 'What happens when the agent is uncertain?',
      answer: 'The workflow stops and routes the exception for human review.'
    },
    {
      question: 'Does the LLM make the final financial decision?',
      answer: 'No. LLM reasoning is advisory. Deterministic financial controls and the Decision Engine retain authority.'
    },
    {
      question: 'Does LedgerForge learn from accountant decisions?',
      answer: 'Structured human feedback becomes historical reconciliation memory and can inform future policy proposals.'
    },
    {
      question: 'Can an agent change its own production policy?',
      answer: 'No. Candidate policies must be evaluated and explicitly promoted.'
    },
    {
      question: 'Can I start with CSV files?',
      answer: 'Yes, the current workflow supports bank and ledger CSV ingestion.'
    }
  ];

  return (
    <div className="min-h-screen text-[#18181B] flex flex-col font-sans selection:bg-pink-100 selection:text-black relative overflow-x-hidden">
      {/* 21st.dev Cotton Bubblegum Lilac Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <GradientBackground className="w-full h-full" />
      </div>

      {/* Shared Marketing Navbar */}
      <MarketingNavbar 
        activePage="pricing" 
        onNavigate={onNavigate} 
        onEnterDashboard={onEnterDashboard} 
      />

      {/* Main Pricing Page Container */}
      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-9 pb-20 sm:pb-28 relative z-10">
        
        {/* SECTION 1: COMPACT CENTERED HERO */}
        <section className="text-center max-w-2xl mx-auto mb-8 sm:mb-11">
          {/* Eyebrow */}
          <div className="text-[11px] font-mono font-bold tracking-widest text-slate-500 uppercase mb-3">
            PRICING
          </div>

          {/* Headline */}
          <h1 className="editorial-headline text-3xl sm:text-4xl lg:text-[48px] font-[550] text-black tracking-tight leading-[1.12] mb-3">
            Simple pricing for finance teams
          </h1>

          {/* Supporting Copy */}
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans max-w-xl mx-auto">
            Start with reliable reconciliation. Scale into deeper automation and governance as your finance operation grows.
          </p>
        </section>

        {/* SECTION 2: THREE PRICING CARDS */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-7 items-stretch mb-16 sm:mb-24">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl border ${plan.borderClass} ${plan.bgClass} p-7 sm:p-8 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                plan.isEmphasized 
                  ? 'shadow-lg lg:-translate-y-2 ring-1 ring-black/10' 
                  : 'shadow-xs hover:shadow-sm'
              }`}
            >
              {/* Internal Decorative CSS Pattern */}
              <div 
                className="absolute inset-0 pointer-events-none opacity-80"
                style={plan.patternStyle}
              />

              {/* Card Body */}
              <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
                
                {/* Upper Block: Label, Name, Desc, Price, CTA */}
                <div className="space-y-4">
                  {/* Top Label & Floating Badge */}
                  <div className="min-h-[26px] flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      {plan.topLabel}
                    </span>
                    {plan.badge && (
                      <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-black text-white text-[10px] font-mono font-bold uppercase tracking-wider shadow-2xs">
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  {/* Plan Name */}
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed mt-1 font-sans">
                      {plan.description}
                    </p>
                  </div>

                  {/* Pricing Display */}
                  <div className="pt-2 pb-1 space-y-0.5">
                    <div className="text-4xl sm:text-5xl font-bold tracking-tight text-black font-sans">
                      {plan.price}
                    </div>
                    <p className="text-xs text-slate-500 font-sans">
                      {plan.priceSubtext}
                    </p>
                  </div>

                  {/* CTA Button placed above divider */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onEnterDashboard}
                      className={`w-full py-3 px-6 rounded-full text-xs font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                        plan.ctaType === 'primary'
                          ? 'bg-black hover:bg-zinc-800 text-white shadow-xs hover:shadow'
                          : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 shadow-2xs hover:border-slate-400'
                      }`}
                    >
                      <span>{plan.cta}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Divider 1 */}
                <hr className={`border-t ${plan.borderClass} opacity-80`} />

                {/* Middle Block: Feature List */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                    {plan.featureHeading}
                  </div>
                  <ul className="space-y-2.5">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start space-x-2.5 text-xs text-slate-700">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Divider 2 */}
                <hr className={`border-t ${plan.borderClass} opacity-80`} />

                {/* Bottom Block: Best For */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                    BEST FOR
                  </span>
                  <p className="text-xs text-slate-700 leading-snug font-sans">
                    {plan.bestFor}
                  </p>
                </div>

              </div>
            </div>
          ))}
        </section>

        {/* LOWER SECTIONS WRAPPER */}
        <div className="space-y-16 sm:space-y-24">
          {/* SECTION 4: WHAT CHANGES AS YOU SCALE? */}
        <section className="space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="editorial-headline text-3xl sm:text-4xl font-[550] text-black tracking-tight">
              More automation. Same control.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans">
              LedgerForge grows with your workflow without changing the principle that financial authority stays with your team.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {scaleSteps.map((step, idx) => (
              <div 
                key={step.stage} 
                className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2 relative group hover:border-slate-300 transition-colors"
              >
                <div className="text-[10px] font-mono font-bold tracking-widest text-emerald-600 uppercase">
                  {step.stage}
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {step.description}
                </p>

                {/* Subtle connecting indicator */}
                {idx < 2 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-slate-200 items-center justify-center text-slate-400 z-10">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 5: COMPACT CAPABILITY COMPARISON MATRIX */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="editorial-headline text-3xl sm:text-4xl font-[550] text-black tracking-tight">
              Compare capabilities
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-mono mt-1">
              Clear feature progression across deployment tiers
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200/90 rounded-2xl bg-white shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 border-b border-slate-200 font-mono text-[11px] text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-4 w-1/2">Capability</th>
                  <th className="p-4 text-center w-1/6">Starter</th>
                  <th className="p-4 text-center w-1/6 bg-purple-50/30 font-bold text-purple-950">Growth</th>
                  <th className="p-4 text-center w-1/6">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-4 font-medium text-slate-900">
                      {row.capability}
                    </td>
                    <td className="p-4 text-center">
                      {row.starter ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>
                    <td className="p-4 text-center bg-purple-50/20">
                      {row.growth ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {row.enterprise ? (
                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECTION 6: FINANCE-SPECIFIC TRUST STRIP */}
        <section className="rounded-2xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trustStripItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-4 h-4 text-slate-700" />
                    <h4 className="text-[11px] font-mono font-bold tracking-wider text-slate-900 uppercase">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    {item.subtitle}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 7: WHY NOT JUST AUTOMATE EVERYTHING? */}
        <section className="rounded-3xl bg-white border border-slate-200/90 p-8 sm:p-12 shadow-2xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-mono font-bold text-amber-800 uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                <span>CORE GOVERNANCE PHILOSOPHY</span>
              </div>

              <h3 className="editorial-headline text-3xl sm:text-4xl font-[550] text-black tracking-tight">
                Because finance is full of exceptions.
              </h3>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans max-w-xl">
                A transaction that looks unusual isn't necessarily wrong. LedgerForge automates evidence-backed decisions and stops when evidence is insufficient, contradictory, or outside policy.
              </p>
            </div>

            {/* Visual Decision Cascade Card */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-[#FAF8F5] border border-[#EAE3D5] space-y-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-white border border-emerald-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">HIGH CONFIDENCE</span>
                  <span className="text-slate-800 font-bold">100% Exact Evidence</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  AUTO POST
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-blue-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">AMBIGUOUS SCENARIO</span>
                  <span className="text-slate-800 font-bold">Tight Scores or Fees</span>
                </div>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                  INVESTIGATE
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white border border-rose-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">UNSAFE / CONFLICTING</span>
                  <span className="text-slate-800 font-bold">Currency or Rule Fail</span>
                </div>
                <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                  STOP + REVIEW
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 8: COMPACT FAQ ACCORDION */}
        <section className="space-y-6 max-w-3xl mx-auto">
          <div className="text-center space-y-1">
            <h2 className="editorial-headline text-3xl sm:text-4xl font-[550] text-black tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              Key governance and architecture questions
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
                        <Minus className="w-3.5 h-3.5 text-slate-700" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 font-sans animate-in fade-in duration-150">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 9: BOTTOM PRICING CTA */}
        <section className="text-center bg-white border border-slate-200/90 rounded-3xl p-8 sm:p-14 space-y-4 shadow-xs">
          <h2 className="editorial-headline text-3xl sm:text-4xl font-[550] text-black tracking-tight">
            Ready to reconcile with more confidence?
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto leading-relaxed font-sans">
            See LedgerForge in action or explore how the reconciliation workflow works.
          </p>
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={onEnterDashboard}
              className="bg-black hover:bg-zinc-800 text-white font-semibold text-xs py-3 px-6 rounded-full shadow-xs hover:shadow transition-all flex items-center space-x-2 cursor-pointer"
            >
              <span>Launch Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('how-it-works')}
              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs py-3 px-5 rounded-full transition-all cursor-pointer"
            >
              <span>Explore How It Works</span>
            </button>
          </div>
        </section>
        </div>

      </main>

      {/* Shared Marketing Footer */}
      <div className="relative z-10">
        <MarketingFooter onNavigate={onNavigate} onEnterDashboard={onEnterDashboard} />
      </div>
    </div>
  );
}
