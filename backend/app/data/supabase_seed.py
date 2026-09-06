"""
Production Supabase Initializer for LedgerForge / Autonomous Bank Reconciliation Agent.

Initializes:
- Core Production Agent Versions (Evolution hierarchy: V1 -> V2 -> V3)
All fake mockup and synthetic transactions have been removed.
Real data is ingested dynamically via bank statements and accounting ledgers.
"""

import os
import sys
from pathlib import Path

# Add project root to sys.path so it can run directly as a script
project_root = str(Path(__file__).resolve().parents[3])
if project_root not in sys.path:
    sys.path.insert(0, project_root)

import logging
from backend.app.services.supabase_service import get_supabase_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("supabase_initializer")

def run_supabase_seed():
    client = get_supabase_client()

    logger.info("Initializing Core Production Agent Versions (V1 -> V2 -> V3)...")
    versions = [
        {
            "id": "v1",
            "version_name": "LedgerForge V1 Baseline",
            "parent_version_id": None,
            "configuration": {"model": "gpt-4o-mini", "max_retries": 2, "deterministic_first": True},
            "prompt_version": "v1.0",
            "matching_strategy": "deterministic_rules",
            "confidence_threshold": 0.90,
            "escalation_policy": {"auto_post_threshold": 0.90, "require_evidence_count": 2},
            "verification_enabled": True,
            "status": "active"
        },
        {
            "id": "v2",
            "version_name": "LedgerForge V2 Fuzzy Enhanced",
            "parent_version_id": "v1",
            "configuration": {"model": "gpt-4o-mini", "fuzzy_threshold": 0.85, "fee_tolerance": 25.0},
            "prompt_version": "v2.0",
            "matching_strategy": "hybrid_fuzzy",
            "confidence_threshold": 0.88,
            "escalation_policy": {"auto_post_threshold": 0.88, "escalate_on_conflict": True},
            "verification_enabled": True,
            "status": "active"
        },
        {
            "id": "v3",
            "version_name": "LedgerForge V3 Autonomous LLM",
            "parent_version_id": "v2",
            "configuration": {"model": "gpt-4o", "temperature": 0.1, "cognitive_reasoning": True},
            "prompt_version": "v3.0",
            "matching_strategy": "cognitive_autonomous",
            "confidence_threshold": 0.85,
            "escalation_policy": {"auto_post_threshold": 0.85, "require_dual_policy": True},
            "verification_enabled": True,
            "status": "active"
        }
    ]
    client.table("agent_versions").upsert(versions).execute()
    logger.info("Production agent configurations successfully initialized in Supabase.")

if __name__ == "__main__":
    run_supabase_seed()
