import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure backend package import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app
from backend.app.core.database import SessionLocal, engine, Base
from backend.app.models.dataset_models import EvaluationMetricsResult
from backend.app.models.pydantic_models import (
    AgentSpec, FailureCategory, ActionTaken
)
from backend.app.services.failure_analyzer import FailureAnalyzer
from backend.app.services.agent_engineer import AgentEngineerService
from backend.app.services.agent_registry import AgentRegistry
from backend.app.models.db import DBAgentOptimizationRun

class TestPhase6AutonomousAgentEngineer(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_failure_analyzer_11_categories(self):
        """
        Verify FailureAnalyzer classifies errors into 11 distinct failure categories.
        """
        mock_metrics = EvaluationMetricsResult(
            agent_version="v1",
            dataset_name="synthetic_seed_42",
            total_cases=10,
            overall_accuracy=0.60,
            match_precision=0.70,
            match_recall=0.70,
            exception_classification_accuracy=0.60,
            auto_reconciliation_precision=0.50,
            escalation_precision=0.80,
            false_auto_post_rate=0.20,
            false_escalation_rate=0.10,
            straight_through_processing_rate=0.50,
            average_confidence=0.85,
            avg_processing_latency_ms=10.0,
            estimated_token_cost_usd=0.001,
            breakdown_by_category={},
            detailed_failures=[
                {"exception_category": "DUPLICATE", "expected_action": "ESCALATE", "predicted_action": "AUTO_RECONCILE", "expected_ledger_id": "l1", "predicted_ledger_id": "l1"},
                {"exception_category": "TIMING_MISMATCH", "expected_action": "AUTO_RECONCILE", "predicted_action": "ESCALATE_TO_HUMAN", "expected_ledger_id": "l2", "predicted_ledger_id": "l2"},
                {"exception_category": "PARTIAL_PAYMENT", "expected_action": "ESCALATE", "predicted_action": "ESCALATE_TO_HUMAN", "expected_ledger_id": "l3", "predicted_ledger_id": "l3"},
                {"exception_category": "FX_VARIANCE", "expected_action": "AUTO_RECONCILE", "predicted_action": "ESCALATE_TO_HUMAN", "expected_ledger_id": "l4", "predicted_ledger_id": "l4"}
            ]
        )

        base_spec = AgentSpec(
            version="v1",
            confidence_threshold=0.85,
            escalation_policy="BALANCED"
        )

        diagnosis, proposal = FailureAnalyzer.analyze_failures(mock_metrics, base_spec, target_version="v2")

        self.assertIsNotNone(diagnosis.primary_failure_category)
        self.assertIn(diagnosis.primary_failure_category, list(FailureCategory))
        self.assertEqual(proposal.target_version, "v2")
        self.assertTrue(len(proposal.proposed_changes) > 0)
        self.assertGreaterEqual(proposal.new_agent_spec.confidence_threshold, 0.85)

    def test_autonomous_optimization_loop_and_rationale(self):
        """
        Verify the 12-Step Autonomous Loop runs, evaluates, generates candidate AgentSpec,
        compares fitness, produces human-readable decision rationale, and updates Leaderboard.
        """
        goal = "Maximize accuracy while keeping false auto-post rate below 5%"
        run_res = AgentEngineerService.run_optimization_loop(
            db=self.db,
            goal=goal,
            base_version_id="v1",
            dataset_seed=42
        )

        self.assertIsNotNone(run_res.run_id)
        self.assertEqual(run_res.base_version_id, "v1")
        self.assertTrue(run_res.candidate_version_id.startswith("v"))
        self.assertTrue(
            "accepted" in run_res.decision_rationale.lower() or "rejected" in run_res.decision_rationale.lower(),
            "Decision rationale must explain why candidate was accepted or rejected"
        )
        self.assertIsNotNone(run_res.failure_diagnosis)
        self.assertIsNotNone(run_res.improvement_proposal)

        # Verify DB persistence
        db_run = self.db.query(DBAgentOptimizationRun).filter(DBAgentOptimizationRun.id == run_res.run_id).first()
        self.assertIsNotNone(db_run)
        self.assertEqual(db_run.accepted, run_res.accepted)

    def test_agent_engineer_api_endpoints(self):
        """
        Verify API endpoints: POST /agent-engineer/optimize, GET /agent-engineer/leaderboard,
        GET /agent-engineer/runs, GET /agent-engineer/runs/{run_id}, POST /agent-engineer/activate/{version_id}
        """
        # 1. POST /api/v1/agent-engineer/optimize
        resp1 = self.client.post("/api/v1/agent-engineer/optimize", json={
            "base_version_id": "v1",
            "optimization_goal": "Benchmark test optimization run",
            "dataset_seed": 42
        })
        self.assertEqual(resp1.status_code, 200)
        opt_data = resp1.json()
        run_id = opt_data["run_id"]
        cand_version = opt_data["candidate_version_id"]

        # 2. GET /api/v1/agent-engineer/leaderboard
        resp2 = self.client.get("/api/v1/agent-engineer/leaderboard")
        self.assertEqual(resp2.status_code, 200)
        leaderboard = resp2.json()
        self.assertTrue(len(leaderboard) >= 3)
        self.assertEqual(leaderboard[0]["rank"], 1)

        # 3. GET /api/v1/agent-engineer/runs
        resp3 = self.client.get("/api/v1/agent-engineer/runs")
        self.assertEqual(resp3.status_code, 200)
        runs = resp3.json()
        self.assertTrue(len(runs) > 0)

        # 4. GET /api/v1/agent-engineer/runs/{run_id}
        resp4 = self.client.get(f"/api/v1/agent-engineer/runs/{run_id}")
        self.assertEqual(resp4.status_code, 200)
        self.assertEqual(resp4.json()["run_id"], run_id)

        # 5. POST /api/v1/agent-engineer/activate/{version_id}
        resp5 = self.client.post(f"/api/v1/agent-engineer/activate/{cand_version}")
        self.assertEqual(resp5.status_code, 200)
        self.assertTrue(resp5.json()["is_active"])

if __name__ == "__main__":
    unittest.main()
