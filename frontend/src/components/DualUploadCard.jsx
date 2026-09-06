import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Play, CheckCircle2, Layers, RefreshCw, FileCheck, ArrowRight } from 'lucide-react';
import { uploadAndReconcile } from '../services/api';

export function DualUploadCard({
  onReconcileComplete,
  activeVersionId = 'v3',
  setSelectedVersionId,
  isProcessing: externalProcessing = false,
}) {
  const [bankFile, setBankFile] = useState(null);
  const [ledgerFile, setLedgerFile] = useState(null);
  const [internalProcessing, setInternalProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isBankDragging, setIsBankDragging] = useState(false);
  const [isLedgerDragging, setIsLedgerDragging] = useState(false);

  const isProcessing = internalProcessing || externalProcessing;

  const handleReconcile = async () => {
    if (!bankFile || !ledgerFile) return;
    setInternalProcessing(true);
    setError(null);
    try {
      const data = await uploadAndReconcile(bankFile, ledgerFile, activeVersionId);
      onReconcileComplete(data);
    } catch (err) {
      setError(err.message || 'Reconciliation failed');
    } finally {
      setInternalProcessing(false);
    }
  };

  const handleBankDrop = (e) => {
    e.preventDefault();
    setIsBankDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.csv')) {
        setBankFile(file);
        setError(null);
      } else {
        setError('Please upload a valid .csv file for Bank Statement.');
      }
    }
  };

  const handleLedgerDrop = (e) => {
    e.preventDefault();
    setIsLedgerDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.csv')) {
        setLedgerFile(file);
        setError(null);
      } else {
        setError('Please upload a valid .csv file for Company Ledger.');
      }
    }
  };

  return (
    <div id="dual-upload-section" className="forge-card p-5 sm:p-6 bg-white border border-slate-200/90 shadow-soft space-y-4 relative overflow-hidden">
      
      {/* Decorative subtle accent bar at top */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-amber-400" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>STEP 1 • DATA INGESTION</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">Bank + Ledger CSVs</span>
          </div>

          <h2 className="font-serif font-bold text-lg sm:text-xl text-ink mt-1.5">
            Upload Reconciliation Files
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Upload your official bank statement and company general ledger files (.csv) to execute live autonomous reconciliation.
          </p>
        </div>

        {/* Action Controls in Header */}
        <div className="flex items-center flex-wrap gap-2.5 pt-1 md:pt-0">
          {/* Engine Selector */}
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={activeVersionId}
              onChange={(e) => setSelectedVersionId && setSelectedVersionId(e.target.value)}
              className="bg-[#FAFAF8] border border-slate-200 text-xs font-semibold text-ink px-2.5 py-1 rounded-full focus:outline-none focus:border-slate-400 cursor-pointer"
            >
              <option value="v3">Agent V3 (Active)</option>
              <option value="v2">Agent V2 (Standby)</option>
              <option value="v1">Agent V1 (Baseline)</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-mono flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-700 font-bold ml-2">✕</button>
        </div>
      )}

      {/* 2 Dropzones Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Dropzone 1: Bank Statement CSV */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsBankDragging(true); }}
          onDragLeave={() => setIsBankDragging(false)}
          onDrop={handleBankDrop}
          className={`p-4 sm:p-5 rounded-2xl border-2 border-dashed flex items-center justify-between transition-all ${
            isBankDragging 
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
              : bankFile 
                ? 'border-emerald-400 bg-[#F0FDF4]' 
                : 'border-slate-200 hover:border-slate-300 bg-[#FAFAF8]'
          }`}
        >
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              bankFile ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-blue-500'
            }`}>
              {bankFile ? <FileCheck className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-ink block truncate">
                {bankFile ? bankFile.name : '1. Bank Statement CSV'}
              </span>
              <span className="text-[11px] text-slate-500 font-sans block mt-0.5">
                {bankFile ? `${(bankFile.size / 1024).toFixed(1)} KB • Ready` : 'Drag & drop or browse bank export (.csv)'}
              </span>
            </div>
          </div>

          <label className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 shadow-2xs transition-all shrink-0 ml-3">
            <span>{bankFile ? 'Change' : 'Browse'}</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setBankFile(e.target.files[0]);
                  setError(null);
                }
              }}
            />
          </label>
        </div>

        {/* Dropzone 2: Company Ledger CSV */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsLedgerDragging(true); }}
          onDragLeave={() => setIsLedgerDragging(false)}
          onDrop={handleLedgerDrop}
          className={`p-4 sm:p-5 rounded-2xl border-2 border-dashed flex items-center justify-between transition-all ${
            isLedgerDragging 
              ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
              : ledgerFile 
                ? 'border-emerald-400 bg-[#F0FDF4]' 
                : 'border-slate-200 hover:border-slate-300 bg-[#FAFAF8]'
          }`}
        >
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              ledgerFile ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-200 text-purple-500'
            }`}>
              {ledgerFile ? <FileCheck className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-ink block truncate">
                {ledgerFile ? ledgerFile.name : '2. Company General Ledger CSV'}
              </span>
              <span className="text-[11px] text-slate-500 font-sans block mt-0.5">
                {ledgerFile ? `${(ledgerFile.size / 1024).toFixed(1)} KB • Ready` : 'Drag & drop or browse accounting export (.csv)'}
              </span>
            </div>
          </div>

          <label className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 shadow-2xs transition-all shrink-0 ml-3">
            <span>{ledgerFile ? 'Change' : 'Browse'}</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setLedgerFile(e.target.files[0]);
                  setError(null);
                }
              }}
            />
          </label>
        </div>

      </div>

      {/* Action Bar when files are selected */}
      {bankFile && ledgerFile ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 bg-slate-50/60 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 rounded-b-2xl">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs text-slate-700 font-medium">
              Both files ready: <span className="font-semibold text-black">{bankFile.name}</span> & <span className="font-semibold text-black">{ledgerFile.name}</span>
            </span>
          </div>

          <button
            onClick={handleReconcile}
            disabled={isProcessing}
            className="btn-primary py-2.5 px-6 text-xs shadow-sm hover:shadow flex items-center justify-center space-x-2 bg-black hover:bg-zinc-800 text-white rounded-full transition-all cursor-pointer"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Processing & Matching Transactions...</span>
              </>
            ) : (
              <>
                <span>Run Reconciliation on Uploaded CSVs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>Supported format: .csv (UTF-8). Max size: 25MB per file.</span>
          <span>Automatic fuzzy matching & confidence scoring enabled</span>
        </div>
      )}

    </div>
  );
}
