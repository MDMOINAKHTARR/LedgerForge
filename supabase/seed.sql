-- Production Agent Versions & System Configuration for LedgerForge / Autonomous Bank Reconciliation Agent
-- All fake mockup and synthetic transactions have been removed.
-- Tables for real data: reconciliations, bank_transactions, ledger_transactions, matches, decisions, audit_logs.

-- 1. Register Core Production Agent Versions (Evolution Lineage: V1 -> V2 -> V3)
INSERT INTO agent_versions (
    id, version_name, parent_version_id, configuration, prompt_version,
    matching_strategy, confidence_threshold, escalation_policy, verification_enabled, status
) VALUES
(
    'v1',
    'LedgerForge V1 Baseline',
    NULL,
    '{"model": "gpt-4o-mini", "max_retries": 2, "deterministic_first": true}'::jsonb,
    'v1.0',
    'deterministic_rules',
    0.90,
    '{"auto_post_threshold": 0.90, "require_evidence_count": 2}'::jsonb,
    true,
    'active'
),
(
    'v2',
    'LedgerForge V2 Fuzzy Enhanced',
    'v1',
    '{"model": "gpt-4o-mini", "fuzzy_threshold": 0.85, "fee_tolerance": 25.0}'::jsonb,
    'v2.0',
    'hybrid_fuzzy',
    0.88,
    '{"auto_post_threshold": 0.88, "escalate_on_conflict": true}'::jsonb,
    true,
    'active'
),
(
    'v3',
    'LedgerForge V3 Autonomous LLM',
    'v2',
    '{"model": "gpt-4o", "temperature": 0.1, "cognitive_reasoning": true}'::jsonb,
    'v3.0',
    'cognitive_autonomous',
    0.85,
    '{"auto_post_threshold": 0.85, "require_dual_policy": true}'::jsonb,
    true,
    'active'
)
ON CONFLICT (id) DO UPDATE SET
    version_name = EXCLUDED.version_name,
    parent_version_id = EXCLUDED.parent_version_id,
    configuration = EXCLUDED.configuration,
    confidence_threshold = EXCLUDED.confidence_threshold,
    status = EXCLUDED.status;
