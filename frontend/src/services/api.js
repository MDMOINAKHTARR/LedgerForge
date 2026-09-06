export const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api/v1`
  : '/api/v1';

async function parseResponseError(res, fallbackMessage = 'Request failed') {
  try {
    const text = await res.text();
    try {
      const error = JSON.parse(text);
      if (typeof error === 'string') return error;
      if (error && error.detail) {
        return typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
      }
      if (error && error.message) return error.message;
    } catch {
      // Non-JSON response (e.g. HTML or plaintext error from edge proxy)
      if (text && text.trim()) {
        const cleanText = text.replace(/<[^>]*>?/gm, '').trim();
        if (cleanText) {
          return `${cleanText.slice(0, 160)} (Status: ${res.status})`;
        }
      }
    }
    return `${fallbackMessage} (Status: ${res.status})`;
  } catch {
    return `${fallbackMessage} (Status: ${res.status})`;
  }
}

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
    const errMsg = await parseResponseError(res, 'Failed to process reconciliation upload');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getBatchDetails = async (batchId) => {
  const res = await fetch(`${API_BASE}/reconcile/batches/${batchId}`);
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to fetch batch details');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getLatestBatch = async () => {
  try {
    const res = await fetch(`${API_BASE}/reconcile/latest`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

export const getPendingExceptions = async (batchId = '') => {
  const url = batchId ? `${API_BASE}/exceptions/pending?batch_id=${batchId}` : `${API_BASE}/exceptions/pending`;
  const res = await fetch(url);
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to fetch pending exceptions');
    throw new Error(errMsg);
  }
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
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to record human action');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getExceptionCandidates = async (resultId) => {
  const res = await fetch(`${API_BASE}/exceptions/${resultId}/candidates`);
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to fetch exception candidates');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getExceptionMemory = async (resultId) => {
  try {
    const res = await fetch(`${API_BASE}/exceptions/${resultId}/memory`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

export const getAgentVersions = async () => {
  const res = await fetch(`${API_BASE}/agents/versions`);
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to fetch agent versions');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getActivePolicy = async (versionId = '') => {
  const url = versionId ? `${API_BASE}/agents/active-policy?version_id=${versionId}` : `${API_BASE}/agents/active-policy`;
  const res = await fetch(url);
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to fetch active reconciliation policy');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getLeaderboard = async () => {
  const res = await fetch(`${API_BASE}/agent-engineer/leaderboard`);
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to fetch leaderboard');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getReconciliationTrace = async (reconciliationId) => {
  const res = await fetch(`${API_BASE}/reconciliation/${reconciliationId}/trace`);
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to fetch audit trace');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getAuditTrail = async () => {
  const res = await fetch(`${API_BASE}/audit`);
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to fetch audit trail');
    throw new Error(errMsg);
  }
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
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to run autonomous optimization cycle');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getOptimizationRuns = async () => {
  const res = await fetch(`${API_BASE}/agent-engineer/runs`);
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to fetch optimization runs');
    throw new Error(errMsg);
  }
  return res.json();
};

export const activateAgentVersion = async (versionId) => {
  const res = await fetch(`${API_BASE}/agent-engineer/activate/${versionId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to activate agent version');
    throw new Error(errMsg);
  }
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
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to run agent autopsy');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getAutopsyReports = async () => {
  const res = await fetch(`${API_BASE}/autopsy/reports`);
  if (!res.ok) {
    const errMsg = await parseResponseError(res, 'Failed to fetch autopsy reports');
    throw new Error(errMsg);
  }
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
    const errMsg = await parseResponseError(res, 'Failed to execute reconciliation pipeline');
    throw new Error(errMsg);
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
    const errMsg = await parseResponseError(res, 'Failed to execute agent improvement loop');
    throw new Error(errMsg);
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
    const errMsg = await parseResponseError(res, 'Failed to execute full pipeline demo');
    throw new Error(errMsg);
  }
  return res.json();
};

export const getNotifications = async () => {
  try {
    const res = await fetch(`${API_BASE}/notifications`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

