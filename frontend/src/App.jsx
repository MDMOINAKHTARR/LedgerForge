import React, { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { HeroPipeline } from './components/HeroPipeline';
import { DualUploadCard } from './components/DualUploadCard';
import { KpiGrid } from './components/KpiGrid';
import { ReconciliationTrend } from './components/ReconciliationTrend';
import { TransactionStatusDonut } from './components/TransactionStatusDonut';
import { RecentActivity } from './components/RecentActivity';
import { SystemInvariants } from './components/SystemInvariants';
import { ExceptionTypes } from './components/ExceptionTypes';
import { AgentPerformance } from './components/AgentPerformance';
import { RecentTransactionsTable } from './components/RecentTransactionsTable';
import { QuickActions } from './components/QuickActions';
import { AuditDrawer } from './components/AuditDrawer';
import { HumanQueueView } from './components/HumanQueueView';
import { AgentEvolutionView } from './components/AgentEvolutionView';
import { CustomIngestionModal } from './components/CustomIngestionModal';
import { Footer } from './components/Footer';
import { ReconciliationReportModal } from './components/ReconciliationReportModal';
import { ReconciliationPolicyView } from './components/ReconciliationPolicyView';
import { HowItWorksPage } from './components/HowItWorksPage';
import DemoComponent from './components/ui/demo';

import { 
  getAgentVersions, 
  getPendingExceptions, 
  runReconciliationPipeline, 
  improveAgentPipeline, 
  activateAgentVersion,
  runAutopsy,
  triggerAgentOptimization,
  getLatestBatch
} from './services/api';

export default function App() {
  // Navigation View state: 'landing' or 'dashboard'
  const [currentView, setCurrentView] = useState('landing');
  
  // Dashboard internal tab
  const [activeTab, setActiveTab] = useState('dashboard');
  const [batchData, setBatchData] = useState(null);
  const [selectedException, setSelectedException] = useState(null);
  const [pendingExceptions, setPendingExceptions] = useState([]);
  const [agentVersions, setAgentVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState('v3');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [invariantsStatus, setInvariantsStatus] = useState(null);
  const [hasReconciled, setHasReconciled] = useState(false);
  const [isCustomUploadOpen, setIsCustomUploadOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastRunResult, setLastRunResult] = useState(null);
  const [autopsyReport, setAutopsyReport] = useState(null);
  const [showReconciliationReport, setShowReconciliationReport] = useState(false);
  const [latestReportData, setLatestReportData] = useState(null);

  // Fetch initial versions, exceptions, and latest real reconciliation batch
  useEffect(() => {
    const initData = async () => {
      try {
        const v = await getAgentVersions();
        if (v && v.length > 0) setAgentVersions(v);
        const exc = await getPendingExceptions('');
        if (exc && exc.length > 0) setPendingExceptions(exc);
        
        // Load latest real database reconciliation
        const latest = await getLatestBatch();
        if (latest && latest.results && latest.results.length > 0) {
          setBatchData(latest);
          setHasReconciled(true);
          const excs = latest.results.filter(r => r.action_taken === 'ESCALATE_TO_HUMAN') || [];
          setPendingExceptions(excs);
        }
      } catch (err) {
        console.warn('Initial data load notice:', err);
      }
    };
    initData();
  }, []);

  // Primary Action: "Upload & Reconcile Statements" -> smoothly focuses the dual file uploader
  const handleRunReconciliation = () => {
    const el = document.getElementById('dual-upload-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-emerald-500', 'ring-offset-2');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-emerald-500', 'ring-offset-2');
      }, 2000);
    } else {
      setIsCustomUploadOpen(true);
    }
  };

  // Primary Action 2: "Improve Agent"
  const handleImproveAgent = async () => {
    setIsImproving(true);
    try {
      const data = await improveAgentPipeline(
        selectedVersionId || 'v1',
        'Maximize accuracy and STP while enforcing 0% false auto-post rate',
        42
      );
      if (data.candidate_version_id) {
        setSelectedVersionId(data.candidate_version_id);
      }
      setLastRunResult(data);
      setActiveTab('agent-evolution');
    } catch (err) {
      console.error('Improve agent error:', err);
      setActiveTab('agent-evolution');
    } finally {
      setIsImproving(false);
    }
  };

  const handleRunAutopsy = async () => {
    try {
      const report = await runAutopsy(selectedVersionId || 'v1', 42);
      setAutopsyReport(report);
    } catch (err) {
      console.warn('Autopsy notice:', err);
    }
  };

  const handleRunOptimizationLoop = async (goal, baseVer) => {
    setIsImproving(true);
    try {
      const res = await triggerAgentOptimization(goal, baseVer, 42);
      setLastRunResult(res);
      if (res.candidate_version_id && res.accepted) {
        setSelectedVersionId(res.candidate_version_id);
      }
    } catch (err) {
      console.error('Optimization loop notice:', err);
    } finally {
      setIsImproving(false);
    }
  };

  const handleActionSuccess = (resultId, actionType, notes) => {
    if (batchData && batchData.results) {
      const updated = batchData.results.map(r =>
        r.id === resultId ? { ...r, human_status: actionType, human_notes: notes } : r
      );
      setBatchData({ ...batchData, results: updated });
    }
    setPendingExceptions(prev => prev.filter(e => e.id !== resultId));

    // ── Auto self-improvement: silently call improveAgentPipeline in the
    // background every time a human resolves an exception. No manual button needed.
    improveAgentPipeline(
      selectedVersionId || 'v1',
      `Human resolved exception ${resultId} with action ${actionType}. Learn from this correction and improve matching accuracy.`,
      42
    )
      .then((res) => {
        if (res && res.candidate_version_id) {
          setSelectedVersionId(res.candidate_version_id);
        }
        setLastRunResult(res);
      })
      .catch(() => {
        // Silent fire-and-forget — never show an error to the user for background ops
      });
  };

  const activeAgent = agentVersions.find(v => v.id === selectedVersionId) || {
    id: 'v3',
    version_name: 'Agent V3',
    accuracy_score: 0.964,
    stp_rate: 0.825,
    false_auto_post_rate: 0.0,
    avg_latency_ms: 5.2,
    avg_cost_usd: 0.00004
  };

  // IF COMPONENT DEMO VIEW IS ACTIVE
  if (currentView === 'demo') {
    return (
      <DemoComponent onBack={() => setCurrentView('landing')} />
    );
  }

  // IF HOW IT WORKS GUIDE VIEW IS ACTIVE
  if (currentView === 'how-it-works') {
    return (
      <HowItWorksPage
        onBack={() => setCurrentView('landing')}
        onEnterDashboard={() => setCurrentView('dashboard')}
      />
    );
  }

  // IF LANDING PAGE VIEW IS ACTIVE
  if (currentView === 'landing') {
    return (
      <LandingPage
        onEnterDashboard={() => setCurrentView('dashboard')}
        onOpenHowItWorks={() => setCurrentView('how-it-works')}
      />
    );
  }

  // IF DASHBOARD VIEW IS ACTIVE
  return (
    <div className="flex min-h-screen bg-[#FAFAF8] text-ink font-sans antialiased selection:bg-amber-100 selection:text-black">
      
      {/* 1. Left Sidebar Shell */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingExceptionsCount={pendingExceptions?.length || 0}
        onReturnHome={() => setCurrentView('landing')}
      />

      {/* 2. Main Workspace Layout (Tailored to fit screen aspect ratio) */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Bar with Home return button */}
        <TopHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          onReturnHome={() => setCurrentView('landing')}
        />

        {/* Scrollable Main Content Container */}
        <main className="flex-1 p-5 sm:p-7 max-w-[1440px] w-full mx-auto space-y-6">
          
          {/* TAB 1: MAIN DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* 1. STEP 1: Direct Dual File Upload Strip (Bank + Ledger CSV) */}
              <DualUploadCard
                onReconcileComplete={(data) => {
                  setBatchData(data);
                  setHasReconciled(true);
                  // Auto-surface the report immediately
                  setLatestReportData(data);
                  setShowReconciliationReport(true);
                  // Update exceptions list
                  const excs = (data.results || []).filter(r => r.action_taken === 'ESCALATE_TO_HUMAN');
                  setPendingExceptions(excs);
                }}
                activeVersionId={selectedVersionId}
                setSelectedVersionId={setSelectedVersionId}
                isProcessing={isProcessing}
              />

              {/* 2. 4-Card Pastel KPI Metric Row */}
              <KpiGrid batchData={batchData} />

              {/* 3. Autonomous Pipeline Controls & Agent Optimization */}
              <HeroPipeline
                onRunReconciliation={handleRunReconciliation}
                onImproveAgent={handleImproveAgent}
                isProcessing={isProcessing}
                isImproving={isImproving}
                hasReconciled={hasReconciled}
                reconciledCount={batchData?.auto_reconciled_count || 0}
              />

              {/* 4. Analytics Middle Row (Reconciliation Trend + Transaction Status + Recent Activity) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-6">
                  <ReconciliationTrend batchData={batchData} />
                </div>
                <div className="lg:col-span-3">
                  <TransactionStatusDonut
                    batchData={batchData}
                    total={batchData?.total_bank_tx || batchData?.results?.length || 0}
                    autoPct={
                      batchData && (batchData.total_bank_tx || batchData.results?.length) > 0
                        ? Math.round(((batchData.auto_reconciled_count || 0) / (batchData.total_bank_tx || batchData.results?.length)) * 100)
                        : 0
                    }
                    reviewPct={
                      batchData && (batchData.total_bank_tx || batchData.results?.length) > 0
                        ? Math.round(((batchData.escalated_count || 0) / (batchData.total_bank_tx || batchData.results?.length)) * 100)
                        : 0
                    }
                    excPct={
                      batchData && (batchData.total_bank_tx || batchData.results?.length) > 0
                        ? Math.round(((batchData.rejected_count || 0) / (batchData.total_bank_tx || batchData.results?.length)) * 100)
                        : 0
                    }
                  />
                </div>
                <div className="lg:col-span-3">
                  <RecentActivity batchData={batchData} onViewAll={() => setActiveTab('human-queue')} />
                </div>
              </div>

              {/* 5. Middle Row 2: Invariants, Exceptions, and Agent Performance */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <SystemInvariants invariantsStatus={invariantsStatus} />
                <ExceptionTypes batchData={batchData} onViewAll={() => setActiveTab('exceptions')} />
                <AgentPerformance
                  activeAgentVersion={activeAgent}
                  onSelectVersion={(vId) => setSelectedVersionId(vId)}
                  agentVersions={agentVersions}
                />
              </div>

              {/* 6. Bottom Row: Recent Transactions Table & Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-9">
                  <RecentTransactionsTable
                    results={batchData?.results || []}
                    onSelectTransaction={(res) => setSelectedException(res)}
                    onViewAll={() => setActiveTab('transactions')}
                  />
                </div>
                <div className="lg:col-span-3">
                  <QuickActions
                    onUploadBankFile={() => setIsCustomUploadOpen(true)}
                    onUploadLedgerFile={() => setIsCustomUploadOpen(true)}
                    onGenerateReport={() => {
                      if (batchData) {
                        setLatestReportData(batchData);
                        setShowReconciliationReport(true);
                      }
                    }}
                    onManageRules={() => setActiveTab('settings')}
                  />
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: HUMAN QUEUE VIEW */}
          {activeTab === 'human-queue' && (
            <HumanQueueView
              pendingExceptions={pendingExceptions}
              onSelectException={(exc) => setSelectedException(exc)}
            />
          )}

          {/* TAB 3: AGENT EVOLUTION VIEW */}
          {activeTab === 'agent-evolution' && (
            <AgentEvolutionView
              activeVersionId={selectedVersionId}
              onSelectVersion={(vId) => setSelectedVersionId(vId)}
              onRunOptimization={handleRunOptimizationLoop}
              isOptimizing={isImproving}
              lastRunResult={lastRunResult}
              autopsyReport={autopsyReport}
              onRunAutopsy={handleRunAutopsy}
            />
          )}

          {/* OTHER TABS */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <RecentTransactionsTable
                results={batchData?.results || []}
                onSelectTransaction={(res) => setSelectedException(res)}
                onViewAll={() => {}}
              />
            </div>
          )}

          {activeTab === 'reconciliation' && (
            <div className="space-y-6">
              <DualUploadCard
                onReconcileComplete={(data) => setBatchData(data)}
                activeVersionId={selectedVersionId}
                setSelectedVersionId={setSelectedVersionId}
              />
              <KpiGrid batchData={batchData} />
              <RecentTransactionsTable
                results={batchData?.results || []}
                onSelectTransaction={(res) => setSelectedException(res)}
                onViewAll={() => {}}
              />
            </div>
          )}

          {activeTab === 'exceptions' && (
            <div className="space-y-6">
              <ExceptionTypes onViewAll={() => {}} />
              <HumanQueueView
                pendingExceptions={pendingExceptions}
                onSelectException={(exc) => setSelectedException(exc)}
              />
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="forge-card p-8 text-center space-y-3">
              <h2 className="font-serif font-bold text-xl text-ink">Reconciliation Audit & Statutory Reports</h2>
              <p className="text-xs text-ink-secondary max-w-md mx-auto">
                Comprehensive accounting reconciliation pack generated in accordance with GAAP & IFRS audit standards.
              </p>
              <button 
                onClick={() => alert('Downloading Q1 Bank Reconciliation Executive Pack (PDF)...')}
                className="btn-primary"
              >
                Download Q1 Audit Summary (PDF)
              </button>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="forge-card p-8 space-y-4">
              <h2 className="font-serif font-bold text-xl text-ink">Core Accounting & Bank Integrations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
                <div className="p-4 rounded-xl border border-slate-200 bg-[#FAFAF8] space-y-2">
                  <div className="font-bold text-sm text-ink">Plaid Banking API</div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-pastel-mint text-emerald-800 font-mono">CONNECTED</span>
                  <p className="text-slate-500 font-normal">Real-time bank statement ingestion from 12,000+ financial institutions.</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-[#FAFAF8] space-y-2">
                  <div className="font-bold text-sm text-ink">QuickBooks Online</div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-pastel-mint text-emerald-800 font-mono">SYNC ACTIVE</span>
                  <p className="text-slate-500 font-normal">Bi-directional chart of accounts and general ledger journal posting.</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-[#FAFAF8] space-y-2">
                  <div className="font-bold text-sm text-ink">NetSuite ERP</div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-pastel-yellow text-amber-800 font-mono">READY TO CONFIGURE</span>
                  <p className="text-slate-500 font-normal">Enterprise multi-entity currency and subsidiary consolidation.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <ReconciliationPolicyView
              activeVersionId={selectedVersionId}
              onNavigateToEvolution={() => setActiveTab('agent-evolution')}
            />
          )}

          {/* Footer */}
          <Footer />

        </main>
      </div>

      {/* Slide-over Transaction Detail & Audit Trace Drawer */}
      {selectedException && (
        <AuditDrawer
          result={selectedException}
          onClose={() => setSelectedException(null)}
          onActionSuccess={handleActionSuccess}
        />
      )}

      {/* Auto Reconciliation Report Modal — surfaces immediately after upload */}
      {showReconciliationReport && latestReportData && (
        <ReconciliationReportModal
          batchData={latestReportData}
          onClose={() => setShowReconciliationReport(false)}
        />
      )}

      {/* Custom File Ingestion Modal */}
      <CustomIngestionModal
        isOpen={isCustomUploadOpen}
        onClose={() => setIsCustomUploadOpen(false)}
        onReconcileComplete={(data) => {
          setBatchData(data);
          setHasReconciled(true);
          setLatestReportData(data);
          setShowReconciliationReport(true);
          setActiveTab('dashboard');
          const excs = (data.results || []).filter(r => r.action_taken === 'ESCALATE_TO_HUMAN');
          setPendingExceptions(excs);
        }}
        activeVersionId={selectedVersionId}
        setSelectedVersionId={setSelectedVersionId}
      />

    </div>
  );
}
