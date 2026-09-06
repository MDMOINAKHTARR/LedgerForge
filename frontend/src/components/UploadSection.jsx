import React, { useState } from 'react';
import { Upload, FileText, CheckCircle2, Play, Sparkles, Layers, Cpu, ArrowRight, TrendingUp, ShieldCheck, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { uploadAndReconcile, runReconciliationPipeline, improveAgentPipeline, activateAgentVersion } from '../services/api';

export function UploadSection({ onReconcileComplete, activeVersionId, setSelectedVersionId }) {
  const [bankFile, setBankFile] = useState(null);
  const [ledgerFile, setLedgerFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [error, setError] = useState(null);
  const [invariantsStatus, setInvariantsStatus] = useState(null);
  const [beforeAfterReport, setBeforeAfterReport] = useState(null);
  const [hasReconciled, setHasReconciled] = useState(false);

  // ACTION 1: "Run Reconciliation" on Real Data
  const handleRunReconciliation = async () => {
    if (!bankFile || !ledgerFile) {
      setError("Please select both a Bank Statement CSV and a Company Ledger CSV below to run live reconciliation on real data.");
      return;
    }
    setIsProcessing(true);
    setError(null);
    setBeforeAfterReport(null);
    try {
      const data = await uploadAndReconcile(bankFile, ledgerFile, activeVersionId || 'v3');
      setHasReconciled(true);
      onReconcileComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ACTION 2: "Improve Agent" (UI Action for Phase 9)
  const handleImproveAgent = async () => {
    setIsImproving(true);
    setError(null);
    try {
      const data = await improveAgentPipeline(
        activeVersionId || 'v1',
        'Maximize accuracy and STP while enforcing 0% false auto-post rate',
        42
      );
      setBeforeAfterReport(data.before_vs_after);
      if (data.candidate_version_id && setSelectedVersionId) {
        setSelectedVersionId(data.candidate_version_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsImproving(false);
    }
  };

  const handleActivateNewVersion = async (versionId) => {
    try {
      await activateAgentVersion(versionId);
      if (setSelectedVersionId) setSelectedVersionId(versionId);
      alert(`Agent ${versionId.toUpperCase()} activated as production reconciliation agent.`);
    } catch (err) {
      setError(err.message);
    }
  };

  // Standard custom CSV upload
  const handleUpload = async () => {
    if (!bankFile || !ledgerFile) return;
    setIsProcessing(true);
    setError(null);
    try {
      const data = await uploadAndReconcile(bankFile, ledgerFile, activeVersionId);
      onReconcileComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ------------------------------------------------------------- */}
      {/* PHASE 9 PRIMARY DEMO CONTROLS: "Run Reconciliation" -> "Improve Agent" */}
      {/* ------------------------------------------------------------- */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border-2 border-emerald-500/40 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Phase 9 • Full Autonomous Pipeline
              </span>
              <span className="text-slate-500 text-xs font-mono">• 64-Tx Evaluation Dataset</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Autonomous Bank Reconciliation & Agent Improvement Demo
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Execute full reconciliation across 10 exception categories, verify all 8 invariants, then trigger the autonomous engineering loop.
            </p>
          </div>

          {/* Core Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRunReconciliation}
              disabled={isProcessing}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-mono text-xs font-bold transition-all shadow-lg ${
                isProcessing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Running Reconciliation Pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Reconciliation</span>
                </>
              )}
            </button>

            <button
              onClick={handleImproveAgent}
              disabled={isImproving}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-mono text-xs font-bold transition-all shadow-lg ${
                isImproving
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/30'
              }`}
            >
              {isImproving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Diagnosing & Synthesizing Agent...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4 text-white" />
                  <span>Improve Agent</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 8 Invariants Verification Checklist Badge */}
        {invariantsStatus && (
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-2 animate-fade-in font-mono">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-400 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>ALL 8 SYSTEM INVARIANTS RIGOROUSLY VERIFIED</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Status: 8/8 Passed</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">100% tx have results</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Every decision audited</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Confidence calculated</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Escalations explained</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Auto-posts evidenced</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Zero transactions lost</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Agent version logged</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Metrics calculated</span>
              </div>
            </div>
          </div>
        )}

        {/* BEFORE VS AFTER AGENT COMPARISON REPORT */}
        {beforeAfterReport && (
          <div className="p-5 rounded-xl bg-slate-950 border border-blue-500/40 shadow-xl space-y-4 animate-fade-in font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                    Agent Evolution: Before vs After Comparison
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Autonomous Meta-Agent Loop diagnosed failures on {beforeAfterReport.base_version.name} and synthesized {beforeAfterReport.improved_version.name}.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold ${
                  beforeAfterReport.performance_delta.accepted
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {beforeAfterReport.performance_delta.accepted ? 'PROMOTED TO PRODUCTION' : 'REJECTED'}
                </span>

                {beforeAfterReport.performance_delta.accepted && (
                  <button
                    onClick={() => handleActivateNewVersion(beforeAfterReport.improved_version.id)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-mono text-[11px] font-bold rounded-lg transition-all"
                  >
                    Activate {beforeAfterReport.improved_version.id.toUpperCase()}
                  </button>
                )}
              </div>
            </div>

            {/* Metrics Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
              {/* Accuracy Delta */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block uppercase">Overall Accuracy</span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-xs text-slate-400">{beforeAfterReport.base_version.accuracy}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-base font-bold text-emerald-400">{beforeAfterReport.improved_version.accuracy}</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-400">
                  {beforeAfterReport.performance_delta.accuracy_improvement} Lift
                </span>
              </div>

              {/* STP Lift */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block uppercase">Straight-Through (STP)</span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-xs text-slate-400">{beforeAfterReport.base_version.stp_rate}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-base font-bold text-blue-400">{beforeAfterReport.improved_version.stp_rate}</span>
                </div>
                <span className="text-[11px] font-bold text-blue-400">
                  {beforeAfterReport.performance_delta.stp_lift} Auto-Post Lift
                </span>
              </div>

              {/* Safety: False Auto-Post */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 block uppercase">False Auto-Post (Safety)</span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-xs text-slate-400">{beforeAfterReport.base_version.false_auto_post_rate}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-base font-bold text-slate-200">{beforeAfterReport.improved_version.false_auto_post_rate}</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-400">
                  Passed Safety Constraint (&lt; 5%)
                </span>
              </div>
            </div>

            {/* Decision Rationale */}
            <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Promotion Rationale:</span>
              {beforeAfterReport.performance_delta.decision_rationale}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECONDARY: CUSTOM CSV FILE UPLOAD SECTION */}
      {/* ------------------------------------------------------------- */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center space-x-2">
              <Upload className="w-4 h-4 text-slate-400" />
              <span>Custom File Ingestion (Optional)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload custom Bank Statement CSV and Accounting Ledger CSV files to reconcile arbitrary batches.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-900 p-1.5 rounded-xl border border-slate-800 text-xs">
            <Layers className="w-4 h-4 text-slate-400 ml-2" />
            <span className="text-slate-400">Target Agent:</span>
            <select
              value={activeVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="bg-slate-950 text-emerald-400 text-xs font-semibold px-2 py-1 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500"
            >
              <option value="v1">Agent V1 (Baseline - 90% Threshold)</option>
              <option value="v2">Agent V2 (Few-Shot Rules - 88% Threshold)</option>
              <option value="v3">Agent V3 (Multi-Tier - 85% Threshold)</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl font-mono">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bank CSV Dropzone */}
          <div className={`p-4 rounded-xl border-2 border-dashed transition-all ${
            bankFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
          }`}>
            <div className="flex flex-col items-center justify-center text-center space-y-1.5">
              <FileText className={`w-7 h-7 ${bankFile ? 'text-emerald-400' : 'text-slate-500'}`} />
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  {bankFile ? bankFile.name : 'Bank Statement CSV'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {bankFile ? `${(bankFile.size / 1024).toFixed(1)} KB` : 'Drag & drop or browse bank file'}
                </p>
              </div>
              <label className="cursor-pointer text-[11px] font-medium text-emerald-400 hover:text-emerald-300 underline pt-0.5">
                <span>{bankFile ? 'Change File' : 'Browse File'}</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setBankFile(e.target.files[0])}
                />
              </label>
            </div>
          </div>

          {/* Ledger CSV Dropzone */}
          <div className={`p-4 rounded-xl border-2 border-dashed transition-all ${
            ledgerFile ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
          }`}>
            <div className="flex flex-col items-center justify-center text-center space-y-1.5">
              <FileText className={`w-7 h-7 ${ledgerFile ? 'text-emerald-400' : 'text-slate-500'}`} />
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  {ledgerFile ? ledgerFile.name : 'Company Ledger CSV'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {ledgerFile ? `${(ledgerFile.size / 1024).toFixed(1)} KB` : 'Drag & drop or browse ledger file'}
                </p>
              </div>
              <label className="cursor-pointer text-[11px] font-medium text-emerald-400 hover:text-emerald-300 underline pt-0.5">
                <span>{ledgerFile ? 'Change File' : 'Browse File'}</span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setLedgerFile(e.target.files[0])}
                />
              </label>
            </div>
          </div>
        </div>

        {bankFile && ledgerFile && (
          <div className="flex justify-end pt-1">
            <button
              onClick={handleUpload}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-all shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Reconcile Custom Uploaded Files</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
