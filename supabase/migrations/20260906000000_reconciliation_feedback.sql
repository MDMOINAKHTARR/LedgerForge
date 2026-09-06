-- Migration: 20260906000000_reconciliation_feedback.sql
-- Description: Structured Human Reconciliation Feedback table for learning/memory layers
-- Tracks auditable accountant resolutions for exceptions with deterministic idempotency.

-- Table: reconciliation_feedback
CREATE TABLE IF NOT EXISTS reconciliation_feedback (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    reconciliation_result_id TEXT NOT NULL UNIQUE,
    reconciliation_batch_id TEXT,
    bank_transaction_id TEXT,
    previous_decision TEXT,
    human_action TEXT NOT NULL,
    resolution_type TEXT NOT NULL,
    corrected_ledger_id TEXT,
    human_notes TEXT,
    relevant_exception_category TEXT,
    currency TEXT,
    amount DOUBLE PRECISION,
    reviewer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient lookups and learning data extraction
CREATE INDEX IF NOT EXISTS idx_reconciliation_feedback_result_id ON reconciliation_feedback(reconciliation_result_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_feedback_batch_id ON reconciliation_feedback(reconciliation_batch_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_feedback_resolution_type ON reconciliation_feedback(resolution_type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_feedback_human_action ON reconciliation_feedback(human_action);

-- Enable Row Level Security (RLS)
ALTER TABLE reconciliation_feedback ENABLE ROW LEVEL SECURITY;

-- Standard dev policies matching existing schema conventions
CREATE POLICY "reconciliation_feedback_read" ON reconciliation_feedback FOR SELECT USING (true);
CREATE POLICY "reconciliation_feedback_insert" ON reconciliation_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "reconciliation_feedback_update" ON reconciliation_feedback FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "reconciliation_feedback_delete" ON reconciliation_feedback FOR DELETE USING (true);
