export const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api/v1`
  : '/api/v1';

export const uploadAndReconcile = async (bankFile, ledgerFile, agentVersionId = 'v3') => {
  const formData = new FormData();
  formData.append('bank_file', bankFile);
  formData.append('ledger_file', ledgerFile);
  formData.append('agent_version_id', agentVersionId);

  const res = await fetch(`${API_BASE}/reconcile/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to process reconciliation upload');
  }
  return res.json();
};

export const getBatchDetails = async (batchId) => {
  const res = await fetch(`${API_BASE}/reconcile/batches/${batchId}`);
  if (!res.ok) throw new Error('Failed to fetch batch details');
  return res.json();
};

export const getLatestBatch = async () => {
  const res = await fetch(`${API_BASE}/reconcile/latest`);
  if (!res.ok) return null;
  return res.json();
};

export const getPendingExceptions = async (batchId = '') => {
  const url = batchId ? `${API_BASE}/exceptions/pending?batch_id=${batchId}` : `${API_BASE}/exceptions/pending`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch pending exceptions');
  return res.json();
};

export const recordHumanAction = async (resultId, action, notes = '', correctedLedgerId = null, resolutionType = null, reviewerId = null) => {
  const payload = { action, notes, corrected_ledger_id: correctedLedgerId };
  if (resolutionType) payload.resolution_type = resolutionType;
  if (reviewerId) payload.reviewer_id = reviewerId;
  const res = await fetch(`${API_BASE}/exceptions/${resultId}/human-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to record human action');
  return res.json();
};

export const getExceptionCandidates = async (resultId) => {
  const res = await fetch(`${API_BASE}/exceptions/${resultId}/candidates`);
  if (!res.ok) throw new Error('Failed to fetch exception candidates');
  return res.json();
};

export const getExceptionMemory = async (resultId) => {
  const res = await fetch(`${API_BASE}/exceptions/${resultId}/memory`);
  if (!res.ok) return null;
  return res.json();
};

export const getAgentVersions = async () => {
  const res = await fetch(`${API_BASE}/agents/versions`);
  if (!res.ok) throw new Error('Failed to fetch agent versions');
  return res.json();
};

export const getActivePolicy = async (versionId = '') => {
  const url = versionId ? `${API_BASE}/agents/active-policy?version_id=${versionId}` : `${API_BASE}/agents/active-policy`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch active reconciliation policy');
  return res.json();
};

export const getLeaderboard = async () => {
  const res = await fetch(`${API_BASE}/agent-engineer/leaderboard`);
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  return res.json();
};

export const getReconciliationTrace = async (reconciliationId) => {
  const res = await fetch(`${API_BASE}/reconciliation/${reconciliationId}/trace`);
  if (!res.ok) throw new Error('Failed to fetch audit trace');
  return res.json();
};

export const getAuditTrail = async () => {
  const res = await fetch(`${API_BASE}/audit`);
  if (!res.ok) throw new Error('Failed to fetch audit trail');
  return res.json();
};

export const triggerAgentOptimization = async (goal = 'Maximize accuracy and STP while zeroing false auto-posts', baseVersionId = 'v1', datasetSeed = 42) => {
  const res = await fetch(`${API_BASE}/agent-engineer/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      optimization_goal: goal,
      base_version_id: baseVersionId,
      dataset_seed: datasetSeed,
    }),
  });
  if (!res.ok) throw new Error('Failed to run autonomous optimization cycle');
  return res.json();
};

export const getOptimizationRuns = async () => {
  const res = await fetch(`${API_BASE}/agent-engineer/runs`);
  if (!res.ok) throw new Error('Failed to fetch optimization runs');
  return res.json();
};

export const activateAgentVersion = async (versionId) => {
  const res = await fetch(`${API_BASE}/agent-engineer/activate/${versionId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to activate agent version');
  return res.json();
};

export const runAutopsy = async (agentVersionId = 'v1', datasetSeed = 42) => {
  const res = await fetch(`${API_BASE}/autopsy/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_version_id: agentVersionId,
      dataset_seed: datasetSeed,
    }),
  });
  if (!res.ok) throw new Error('Failed to run agent autopsy');
  return res.json();
};

export const getAutopsyReports = async () => {
  const res = await fetch(`${API_BASE}/autopsy/reports`);
  if (!res.ok) throw new Error('Failed to fetch autopsy reports');
  return res.json();
};

export const triggerAutoOptimization = triggerAgentOptimization;

// Phase 9 Full Integration Pipeline APIs
export const runReconciliationPipeline = async (agentVersionId = 'v1', datasetSeed = 42) => {
  const res = await fetch(`${API_BASE}/pipeline/run-reconciliation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_version_id: agentVersionId,
      dataset_seed: datasetSeed,
    }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to execute reconciliation pipeline');
  }
  return res.json();
};

export const improveAgentPipeline = async (baseVersionId = 'v1', goal = 'Maximize accuracy and STP while enforcing 0% false auto-post rate', datasetSeed = 42) => {
  const res = await fetch(`${API_BASE}/pipeline/improve-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_version_id: baseVersionId,
      goal: goal,
      dataset_seed: datasetSeed,
    }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to execute agent improvement loop');
  }
  return res.json();
};

export const runFullPipelineDemo = async (baseVersionId = 'v1', datasetSeed = 42) => {
  const res = await fetch(`${API_BASE}/pipeline/run-full-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_version_id: baseVersionId,
      dataset_seed: datasetSeed,
    }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Failed to execute full pipeline demo');
  }
  return res.json();
};

