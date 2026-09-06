"""
Server-Side Supabase Database Service for LedgerForge / Autonomous Bank Reconciliation Agent.

Implements all required CRUD and querying interfaces for:
- Reconciliations & Transactions (Bank & Ledger)
- Candidate & Selected Matches
- Decision Engine Decisions & Audit Logs
- Agent Engineering Versions (Parent/Child Evolution V1 -> V2 -> V3)
- Agent Runs, Benchmark Evaluation Results, and Failure Analyses
"""

import os
import uuid
import logging
from typing import List, Dict, Any, Optional, Union
from datetime import datetime

from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))

logger = logging.getLogger("supabase_service")
logger.setLevel(logging.INFO)

# Supabase Credentials from Environment
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://tzhlgqixxjqyonvgemcy.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "sb_publishable_2neHZieRgykUhh2a6Wf5Eg_-p7Bv8hT")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Determine which key to use on server
# The service-role key is prioritized on the server if present; otherwise fallback to anon key for development
SERVER_KEY = SUPABASE_SERVICE_ROLE_KEY.strip() if SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_ROLE_KEY.strip() else SUPABASE_ANON_KEY.strip()

_supabase_client = None

def get_supabase_client():
    """
    Initializes and returns the singleton Supabase client.
    Never exposes service-role key to frontend.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    if not SUPABASE_URL or not SERVER_KEY:
        raise ValueError("Supabase URL or API Key is missing from environment.")

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(SUPABASE_URL, SERVER_KEY)
        return _supabase_client
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {e}")
        raise e


class SupabaseService:
    """
    Clean abstraction layer over Supabase PostgreSQL database.
    Prevents scattered raw SQL or direct Supabase calls in endpoints.
    """

    def __init__(self):
        self.client = get_supabase_client()

    # ------------------------------------------------------------------------
    # Financial Reconciliation
    # ------------------------------------------------------------------------

    def create_reconciliation(self, rec_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new reconciliation run entry.
        """
        if "id" not in rec_data or not rec_data["id"]:
            rec_data["id"] = f"rec_{uuid.uuid4().hex[:12]}"
        
        response = self.client.table("reconciliations").insert(rec_data).execute()
        if response.data:
            return response.data[0]
        return rec_data

    createReconciliation = create_reconciliation

    def get_reconciliation(self, reconciliation_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a reconciliation by ID along with its summary metrics.
        """
        response = self.client.table("reconciliations").select("*").eq("id", reconciliation_id).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
        return None

    getReconciliation = get_reconciliation

    def insert_bank_transactions(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Batch inserts bank transactions into Supabase.
        """
        if not transactions:
            return []
        
        formatted = []
        for t in transactions:
            item = dict(t)
            if "id" not in item or not item["id"]:
                item["id"] = f"bt_{uuid.uuid4().hex[:12]}"
            formatted.append(item)

        response = self.client.table("bank_transactions").insert(formatted).execute()
        return response.data or formatted

    insertBankTransactions = insert_bank_transactions

    def insert_ledger_transactions(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Batch inserts company ledger transactions into Supabase.
        """
        if not transactions:
            return []

        formatted = []
        for t in transactions:
            item = dict(t)
            if "id" not in item or not item["id"]:
                item["id"] = f"lt_{uuid.uuid4().hex[:12]}"
            formatted.append(item)

        response = self.client.table("ledger_transactions").insert(formatted).execute()
        return response.data or formatted

    insertLedgerTransactions = insert_ledger_transactions

    def create_match(self, match_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Records a candidate or selected match between a bank and ledger transaction.
        """
        if "id" not in match_data or not match_data["id"]:
            match_data["id"] = f"match_{uuid.uuid4().hex[:12]}"
        
        response = self.client.table("matches").insert(match_data).execute()
        if response.data:
            return response.data[0]
        return match_data

    createMatch = create_match

    def create_decision(self, decision_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Records the final decision made by the decision engine (AUTO_RECONCILE, ESCALATE, REJECT, UNMATCHED).
        """
        if "id" not in decision_data or not decision_data["id"]:
            decision_data["id"] = f"dec_{uuid.uuid4().hex[:12]}"

        response = self.client.table("decisions").insert(decision_data).execute()
        if response.data:
            return response.data[0]
        return decision_data

    createDecision = create_decision

    def create_audit_log(self, log_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Stores an immutable audit event for compliance and traceability.
        """
        if "id" not in log_data or not log_data["id"]:
            log_data["id"] = f"aud_{uuid.uuid4().hex[:12]}"

        response = self.client.table("audit_logs").insert(log_data).execute()
        if response.data:
            return response.data[0]
        return log_data

    createAuditLog = create_audit_log

    # ------------------------------------------------------------------------
    # Autonomous Agent Engineering & Evolution
    # ------------------------------------------------------------------------

    def create_agent_version(self, version_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates or registers a new agent version configuration (supports V1 -> V2 -> V3 evolution).
        """
        if "id" not in version_data or not version_data["id"]:
            version_data["id"] = f"v_{uuid.uuid4().hex[:8]}"

        response = self.client.table("agent_versions").insert(version_data).execute()
        if response.data:
            return response.data[0]
        return version_data

    createAgentVersion = create_agent_version

    def create_agent_run(self, run_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Records an execution run for an agent version.
        """
        if "id" not in run_data or not run_data["id"]:
            run_data["id"] = f"run_{uuid.uuid4().hex[:12]}"

        response = self.client.table("agent_runs").insert(run_data).execute()
        if response.data:
            return response.data[0]
        return run_data

    createAgentRun = create_agent_run

    def save_evaluation_result(self, eval_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Saves benchmark evaluation metrics for an agent version against a dataset.
        """
        if "id" not in eval_data or not eval_data["id"]:
            eval_data["id"] = f"eval_{uuid.uuid4().hex[:12]}"

        response = self.client.table("evaluation_results").insert(eval_data).execute()
        if response.data:
            return response.data[0]
        return eval_data

    saveEvaluationResult = save_evaluation_result

    def save_failure_analysis(self, failure_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Saves autopsy failure analysis data driving agent optimization.
        """
        if "id" not in failure_data or not failure_data["id"]:
            failure_data["id"] = f"fa_{uuid.uuid4().hex[:12]}"

        response = self.client.table("failure_analyses").insert(failure_data).execute()
        if response.data:
            return response.data[0]
        return failure_data

    saveFailureAnalysis = save_failure_analysis

    def get_agent_versions(self) -> List[Dict[str, Any]]:
        """
        Retrieves all agent versions ordered by creation date, reflecting the evolution chain.
        """
        response = self.client.table("agent_versions").select("*").order("created_at", desc=False).execute()
        return response.data or []

    getAgentVersions = get_agent_versions

    def get_best_agent_version(self) -> Optional[Dict[str, Any]]:
        """
        Retrieves the top performing agent version based on latest evaluation accuracy.
        """
        # Join evaluation results or query latest active version with highest accuracy
        eval_resp = (
            self.client.table("evaluation_results")
            .select("agent_version_id, accuracy, straight_through_rate, false_auto_post_rate")
            .order("accuracy", desc=True)
            .limit(1)
            .execute()
        )
        if eval_resp.data and len(eval_resp.data) > 0:
            best_id = eval_resp.data[0]["agent_version_id"]
            v_resp = self.client.table("agent_versions").select("*").eq("id", best_id).execute()
            if v_resp.data:
                res = dict(v_resp.data[0])
                res["evaluation"] = eval_resp.data[0]
                return res

        # Fallback: latest active version
        versions = self.get_agent_versions()
        if versions:
            return versions[-1]
        return None

    getBestAgentVersion = get_best_agent_version


# Singleton instance export
supabase_service = SupabaseService()
