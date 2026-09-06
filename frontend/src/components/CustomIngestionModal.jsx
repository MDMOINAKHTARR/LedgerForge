import React, { useState } from 'react';
import { X, UploadCloud, FileSpreadsheet, Play, Layers } from 'lucide-react';
import { uploadAndReconcile } from '../services/api';

export function CustomIngestionModal({ isOpen, onClose, onReconcileComplete, activeVersionId, setSelectedVersionId }) {
  if (!isOpen) return null;

  const [bankFile, setBankFile] = useState(null);
  const [ledgerFile, setLedgerFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!bankFile || !ledgerFile) return;
    setIsProcessing(true);
    setError(null);
    try {
      const data = await uploadAndReconcile(bankFile, ledgerFile, activeVersionId || 'v3');
      onReconcileComplete(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl p-6 shadow-float space-y-5">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-serif font-bold text-lg text-ink">
              Custom File Ingestion
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              Upload custom Bank Statement CSV and Accounting Ledger CSV files to reconcile arbitrary batches.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Agent Selector */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#FAFAF8] border border-slate-200 text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <Layers className="w-4 h-4 text-slate-400" />
            <span className="font-semibold">Target Agent Engine:</span>
          </div>
          <select
            value={activeVersionId || 'v3'}
            onChange={(e) => setSelectedVersionId && setSelectedVersionId(e.target.value)}
            className="bg-white border border-slate-200 text-xs font-semibold px-3 py-1.5 rounded-full focus:outline-none focus:border-slate-400 cursor-pointer"
          >
            <option value="v3">Agent V3 (Multi-Tier - 85% Threshold)</option>
            <option value="v2">Agent V2 (Few-Shot Rules - 88% Threshold)</option>
            <option value="v1">Agent V1 (Baseline - 90% Threshold)</option>
          </select>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-mono">
            {error}
          </div>
        )}

        {/* Dropzones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Bank Dropzone */}
          <div className={`p-5 rounded-2xl border-2 border-dashed text-center space-y-2 transition-all ${
            bankFile ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200 hover:border-slate-300 bg-[#FAFAF8]'
          }`}>
            <UploadCloud className={`w-8 h-8 mx-auto ${bankFile ? 'text-emerald-600' : 'text-slate-400'}`} />
            <div>
              <p className="text-xs font-semibold text-ink">
                {bankFile ? bankFile.name : 'Bank Statement CSV'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {bankFile ? `${(bankFile.size / 1024).toFixed(1)} KB` : 'Drag & drop or browse bank file'}
              </p>
            </div>
            <label className="cursor-pointer text-[11px] font-semibold text-ink hover:underline inline-block pt-1">
              <span>{bankFile ? 'Change File' : 'Browse File'}</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => setBankFile(e.target.files[0])}
              />
            </label>
          </div>

          {/* Ledger Dropzone */}
          <div className={`p-5 rounded-2xl border-2 border-dashed text-center space-y-2 transition-all ${
            ledgerFile ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200 hover:border-slate-300 bg-[#FAFAF8]'
          }`}>
            <FileSpreadsheet className={`w-8 h-8 mx-auto ${ledgerFile ? 'text-emerald-600' : 'text-slate-400'}`} />
            <div>
              <p className="text-xs font-semibold text-ink">
                {ledgerFile ? ledgerFile.name : 'Company Ledger CSV'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {ledgerFile ? `${(ledgerFile.size / 1024).toFixed(1)} KB` : 'Drag & drop or browse ledger file'}
              </p>
            </div>
            <label className="cursor-pointer text-[11px] font-semibold text-ink hover:underline inline-block pt-1">
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

        {/* Footer actions */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="btn-secondary py-2 px-4 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!bankFile || !ledgerFile || isProcessing}
            className="btn-primary py-2 px-4 text-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isProcessing ? 'Reconciling...' : 'Reconcile Custom Uploaded Files'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
