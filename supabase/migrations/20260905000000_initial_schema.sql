-- Migration: 20260905000000_initial_schema.sql
-- Description: Autonomous Bank Reconciliation Agent (LedgerForge / LedgerMind) Schema
-- Covers:
--   1. Agent Engineering Tables: agent_versions, agent_runs, evaluation_results, failure_analyses
--   2. Financial Reconciliation Tables: reconciliations, bank_transactions, ledger_transactions, matches, decisions, audit_logs
--   3. Foreign keys, indexes, and Row Level Security (RLS) policies

-- Enable pgcrypto for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. AGENT ENGINEERING TABLES
-- ============================================================================

-- Table: agent_versions (supports parent/child evolution: V1 -> V2 -> V3)
CREATE TABLE IF NOT EXISTS agent_versions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    version_name TEXT NOT NULL,
    parent_version_id TEXT REFERENCES agent_versions(id) ON DELETE SET NULL,
    configuration JSONB DEFAULT '{}'::jsonb,
    prompt_version TEXT,
    matching_strategy TEXT,
    confidence_threshold DOUBLE PRECISION DEFAULT 0.90,
    escalation_policy JSONB DEFAULT '{}'::jsonb,
    verification_enabled BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. FINANCIAL RECONCILIATION TABLES
-- ============================================================================

-- Table: reconciliations (one complete reconciliation run)
CREATE TABLE IF NOT EXISTS reconciliations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    agent_version_id TEXT REFERENCES agent_versions(id) ON DELETE SET NULL,
    total_transactions INTEGER DEFAULT 0,
    auto_reconciled_count INTEGER DEFAULT 0,
    escalated_count INTEGER DEFAULT 0,
    unmatched_count INTEGER DEFAULT 0,
    accuracy DOUBLE PRECISION DEFAULT 0.0,
    straight_through_rate DOUBLE PRECISION DEFAULT 0.0,
    false_auto_post_rate DOUBLE PRECISION DEFAULT 0.0,
    average_latency_ms DOUBLE PRECISION DEFAULT 0.0,
    estimated_cost DOUBLE PRECISION DEFAULT 0.0
);

-- Table: bank_transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reconciliation_id TEXT NOT NULL REFERENCES reconciliations(id) ON DELETE CASCADE,
    external_transaction_id TEXT,
    transaction_date TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    currency TEXT DEFAULT 'USD',
    description TEXT,
    reference TEXT,
    counterparty TEXT,
    transaction_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: ledger_transactions
CREATE TABLE IF NOT EXISTS ledger_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reconciliation_id TEXT NOT NULL REFERENCES reconciliations(id) ON DELETE CASCADE,
    external_ledger_id TEXT,
    invoice_id TEXT,
    transaction_date TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    currency TEXT DEFAULT 'USD',
    description TEXT,
    reference TEXT,
    counterparty TEXT,
    account TEXT,
    transaction_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: matches (candidate and selected matches)
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reconciliation_id TEXT NOT NULL REFERENCES reconciliations(id) ON DELETE CASCADE,
    bank_transaction_id TEXT NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    ledger_transaction_id TEXT REFERENCES ledger_transactions(id) ON DELETE SET NULL,
    match_type TEXT NOT NULL, -- exact, fuzzy, semantic, llm
    match_score DOUBLE PRECISION DEFAULT 0.0,
    confidence DOUBLE PRECISION NOT NULL,
    evidence JSONB DEFAULT '[]'::jsonb,
    is_selected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: decisions (final decision made by decision engine)
CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reconciliation_id TEXT NOT NULL REFERENCES reconciliations(id) ON DELETE CASCADE,
    bank_transaction_id TEXT NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    match_id TEXT REFERENCES matches(id) ON DELETE SET NULL,
    decision TEXT NOT NULL, -- AUTO_RECONCILE, ESCALATE, REJECT, UNMATCHED
    confidence DOUBLE PRECISION NOT NULL,
    reason TEXT NOT NULL,
    evidence JSONB DEFAULT '[]'::jsonb,
    exception_type TEXT,
    policy_checks JSONB DEFAULT '{}'::jsonb,
    agent_version_id TEXT REFERENCES agent_versions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: audit_logs (complete auditable execution history)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reconciliation_id TEXT NOT NULL REFERENCES reconciliations(id) ON DELETE CASCADE,
    bank_transaction_id TEXT REFERENCES bank_transactions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    stage TEXT NOT NULL,
    message TEXT NOT NULL,
    evidence JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    agent_version_id TEXT REFERENCES agent_versions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. AGENT RUNS & BENCHMARK TABLES
-- ============================================================================

-- Table: agent_runs (execution of a specific agent version)
CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_version_id TEXT NOT NULL REFERENCES agent_versions(id) ON DELETE CASCADE,
    reconciliation_id TEXT REFERENCES reconciliations(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'completed',
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    latency_ms DOUBLE PRECISION DEFAULT 0.0,
    estimated_cost DOUBLE PRECISION DEFAULT 0.0,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Table: evaluation_results (benchmark results for agent versions)
CREATE TABLE IF NOT EXISTS evaluation_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_version_id TEXT NOT NULL REFERENCES agent_versions(id) ON DELETE CASCADE,
    dataset_name TEXT NOT NULL,
    accuracy DOUBLE PRECISION DEFAULT 0.0,
    precision DOUBLE PRECISION DEFAULT 0.0,
    recall DOUBLE PRECISION DEFAULT 0.0,
    false_auto_post_rate DOUBLE PRECISION DEFAULT 0.0,
    escalation_precision DOUBLE PRECISION DEFAULT 0.0,
    straight_through_rate DOUBLE PRECISION DEFAULT 0.0,
    average_latency_ms DOUBLE PRECISION DEFAULT 0.0,
    estimated_cost DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: failure_analyses (failure analysis driving agent improvements)
CREATE TABLE IF NOT EXISTS failure_analyses (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_version_id TEXT NOT NULL REFERENCES agent_versions(id) ON DELETE CASCADE,
    evaluation_id TEXT REFERENCES evaluation_results(id) ON DELETE SET NULL,
    failure_type TEXT NOT NULL,
    severity TEXT,
    root_cause TEXT,
    evidence JSONB DEFAULT '[]'::jsonb,
    recommended_change TEXT,
    expected_impact TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 4. PERFORMANCE INDEXES
-- ============================================================================

-- Reconciliations
CREATE INDEX IF NOT EXISTS idx_reconciliations_agent_version_id ON reconciliations(agent_version_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_created_at ON reconciliations(created_at DESC);

-- Bank Transactions
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reconciliation_id ON bank_transactions(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_created_at ON bank_transactions(created_at DESC);

-- Ledger Transactions
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_reconciliation_id ON ledger_transactions(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_invoice_id ON ledger_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_created_at ON ledger_transactions(created_at DESC);

-- Matches
CREATE INDEX IF NOT EXISTS idx_matches_reconciliation_id ON matches(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_matches_bank_transaction_id ON matches(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_matches_ledger_transaction_id ON matches(ledger_transaction_id);
CREATE INDEX IF NOT EXISTS idx_matches_is_selected ON matches(is_selected);

-- Decisions
CREATE INDEX IF NOT EXISTS idx_decisions_reconciliation_id ON decisions(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_decisions_bank_transaction_id ON decisions(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_decisions_agent_version_id ON decisions(agent_version_id);
CREATE INDEX IF NOT EXISTS idx_decisions_decision ON decisions(decision);
CREATE INDEX IF NOT EXISTS idx_decisions_exception_type ON decisions(exception_type);
CREATE INDEX IF NOT EXISTS idx_decisions_created_at ON decisions(created_at DESC);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_reconciliation_id ON audit_logs(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_bank_transaction_id ON audit_logs(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agent_version_id ON audit_logs(agent_version_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Agent Versions & Evolution
CREATE INDEX IF NOT EXISTS idx_agent_versions_parent_version_id ON agent_versions(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_agent_versions_created_at ON agent_versions(created_at DESC);

-- Agent Runs
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_version_id ON agent_runs(agent_version_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_reconciliation_id ON agent_runs(reconciliation_id);

-- Evaluation Results
CREATE INDEX IF NOT EXISTS idx_evaluation_results_agent_version_id ON evaluation_results(agent_version_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_created_at ON evaluation_results(created_at DESC);

-- Failure Analyses
CREATE INDEX IF NOT EXISTS idx_failure_analyses_agent_version_id ON failure_analyses(agent_version_id);
CREATE INDEX IF NOT EXISTS idx_failure_analyses_evaluation_id ON failure_analyses(evaluation_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all 10 tables
ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_analyses ENABLE ROW LEVEL SECURITY;

-- Helper macro/blocks for standard permissive read and service/authenticated write
-- agent_versions
CREATE POLICY "agent_versions_read" ON agent_versions FOR SELECT USING (true);
CREATE POLICY "agent_versions_insert" ON agent_versions FOR INSERT WITH CHECK (true);
CREATE POLICY "agent_versions_update" ON agent_versions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "agent_versions_delete" ON agent_versions FOR DELETE USING (true);

-- reconciliations
CREATE POLICY "reconciliations_read" ON reconciliations FOR SELECT USING (true);
CREATE POLICY "reconciliations_insert" ON reconciliations FOR INSERT WITH CHECK (true);
CREATE POLICY "reconciliations_update" ON reconciliations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "reconciliations_delete" ON reconciliations FOR DELETE USING (true);

-- bank_transactions
CREATE POLICY "bank_transactions_read" ON bank_transactions FOR SELECT USING (true);
CREATE POLICY "bank_transactions_insert" ON bank_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "bank_transactions_update" ON bank_transactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "bank_transactions_delete" ON bank_transactions FOR DELETE USING (true);

-- ledger_transactions
CREATE POLICY "ledger_transactions_read" ON ledger_transactions FOR SELECT USING (true);
CREATE POLICY "ledger_transactions_insert" ON ledger_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "ledger_transactions_update" ON ledger_transactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "ledger_transactions_delete" ON ledger_transactions FOR DELETE USING (true);

-- matches
CREATE POLICY "matches_read" ON matches FOR SELECT USING (true);
CREATE POLICY "matches_insert" ON matches FOR INSERT WITH CHECK (true);
CREATE POLICY "matches_update" ON matches FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "matches_delete" ON matches FOR DELETE USING (true);

-- decisions
CREATE POLICY "decisions_read" ON decisions FOR SELECT USING (true);
CREATE POLICY "decisions_insert" ON decisions FOR INSERT WITH CHECK (true);
CREATE POLICY "decisions_update" ON decisions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "decisions_delete" ON decisions FOR DELETE USING (true);

-- audit_logs
CREATE POLICY "audit_logs_read" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_logs_update" ON audit_logs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_delete" ON audit_logs FOR DELETE USING (true);

-- agent_runs
CREATE POLICY "agent_runs_read" ON agent_runs FOR SELECT USING (true);
CREATE POLICY "agent_runs_insert" ON agent_runs FOR INSERT WITH CHECK (true);
CREATE POLICY "agent_runs_update" ON agent_runs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "agent_runs_delete" ON agent_runs FOR DELETE USING (true);

-- evaluation_results
CREATE POLICY "evaluation_results_read" ON evaluation_results FOR SELECT USING (true);
CREATE POLICY "evaluation_results_insert" ON evaluation_results FOR INSERT WITH CHECK (true);
CREATE POLICY "evaluation_results_update" ON evaluation_results FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "evaluation_results_delete" ON evaluation_results FOR DELETE USING (true);

-- failure_analyses
CREATE POLICY "failure_analyses_read" ON failure_analyses FOR SELECT USING (true);
CREATE POLICY "failure_analyses_insert" ON failure_analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "failure_analyses_update" ON failure_analyses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "failure_analyses_delete" ON failure_analyses FOR DELETE USING (true);
