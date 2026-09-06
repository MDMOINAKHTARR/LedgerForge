import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure backend package import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app
from backend.app.core.database import SessionLocal, Base, engine
from backend.app.models.db import DBAuditLog, DBReconciliationResult, DBReconciliationBatch
from backend.app.models.pydantic_models import ActionTaken
from backend.app.services.pipeline_service import FullPipelineService
from backend.app.services.dataset_generator import SyntheticDatasetGenerator

class TestPhase9FullIntegration(unittest.TestCase):
    """
    Phase 9 Unified Full Integration Test Suite.
    Verifies the end-to-end pipeline against the full synthetic evaluation dataset,
    guaranteeing all 8 mandatory system invariants.
    """

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_01_full_pipeline_service_and_8_invariants(self):
        """
        Executes full reconciliation and autonomous improvement loop on the 64-transaction dataset.
        Verifies all 8 core invariants.
        """
        demo_out = FullPipelineService.run_full_autonomous_demo(
            db=self.db,
            dataset_seed=42,
            base_version_id="v1"
        )

        recon = demo_out["reconciliation"]
        results = recon["results"]
        total_bank_tx = recon["total_bank_tx"]
        batch_id = recon["batch_id"]

        # Invariant 1: Every transaction receives a result
        self.assertEqual(len(results), total_bank_tx, "Every transaction must receive a result")
        self.assertEqual(total_bank_tx, 64, "Evaluation dataset contains 64 bank transactions")

        # Invariant 2: Every decision has an audit record in DB
        bank_tx_ids = [r.bank_tx_id for r in results]
        db_audit_records = self.db.query(DBAuditLog).filter(DBAuditLog.transaction_id.in_(bank_tx_ids)).all()
        self.assertGreaterEqual(len(db_audit_records), total_bank_tx, "Every decision must have an audit record")

        # Invariant 3: Every decision has confidence
        for r in results:
            self.assertIsNotNone(r.confidence_score, f"Transaction {r.bank_tx_id} missing confidence score")
            self.assertTrue(0.0 <= r.confidence_score <= 1.0, f"Confidence score out of range: {r.confidence_score}")

        # Invariant 4: Every escalation has an explanation
        escalations = [r for r in results if r.action_taken == ActionTaken.ESCALATE_TO_HUMAN]
        self.assertGreater(len(escalations), 0, "Must have escalated edge cases")
        for esc in escalations:
            self.assertTrue(bool(esc.reasoning), f"Escalation {esc.id} missing reasoning")
            self.assertGreater(len(esc.reasoning.strip()), 10, f"Escalation explanation too brief: '{esc.reasoning}'")

        # Invariant 5: Every auto-reconciliation has supporting evidence
        auto_recons = [r for r in results if r.action_taken == ActionTaken.AUTO_RECONCILE]
        self.assertGreater(len(auto_recons), 0, "Must have auto-reconciled items")
        for auto in auto_recons:
            self.assertTrue(bool(auto.evidence), f"Auto-reconciled transaction {auto.id} missing evidence")
            self.assertGreaterEqual(len(auto.evidence), 1, "Must have at least 1 supporting evidence bullet")

        # Invariant 6: No transaction is silently lost
        dataset = SyntheticDatasetGenerator.generate_dataset(seed=42, count=60)
        self.assertEqual(total_bank_tx, len(dataset.bank_transactions), "No transaction silently dropped")

        # Invariant 7: Agent version is recorded
        self.assertEqual(recon["agent_version"], "v1", "Agent version recorded in reconciliation result")
        for r in results:
            self.assertEqual(r.agent_version_id, "v1")

        # Invariant 8: Evaluation metrics are calculated
        invariants_verified = demo_out["invariants_verified"]
        self.assertTrue(invariants_verified["evaluation_metrics_calculated"])
        for inv_k, inv_v in invariants_verified.items():
            self.assertTrue(inv_v, f"Invariant '{inv_k}' failed validation")

        # Verify Before vs After Comparison Report Structure
        bva = demo_out["before_vs_after"]
        self.assertIn("base_version", bva)
        self.assertIn("improved_version", bva)
        self.assertIn("performance_delta", bva)
        self.assertIn("accuracy_improvement", bva["performance_delta"])
        self.assertIn("stp_lift", bva["performance_delta"])
        self.assertTrue(bva["performance_delta"]["accepted"], "Candidate agent was accepted and promoted")

    def test_02_run_reconciliation_api_endpoint(self):
        """
        Tests POST /api/v1/pipeline/run-reconciliation API endpoint ('Run Reconciliation' UI action).
        """
        response = self.client.post(
            "/api/v1/pipeline/run-reconciliation",
            json={"agent_version_id": "v1", "dataset_seed": 42}
        )
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["total_bank_tx"], 64)
        self.assertEqual(data["audit_records_count"], 64)
        self.assertTrue(data["invariants_verified"]["every_transaction_received_result"])
        self.assertTrue(data["invariants_verified"]["every_decision_has_audit_record"])
        self.assertTrue(data["invariants_verified"]["every_auto_reconciliation_has_evidence"])

    def test_03_improve_agent_api_endpoint(self):
        """
        Tests POST /api/v1/pipeline/improve-agent API endpoint ('Improve Agent' UI action).
        """
        response = self.client.post(
            "/api/v1/pipeline/improve-agent",
            json={
                "base_version_id": "v1",
                "goal": "Maximize accuracy and STP while enforcing 0% false auto-post rate",
                "dataset_seed": 42
            }
        )
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("before_vs_after", data)
        self.assertIn("candidate_version_id", data)
        bva = data["before_vs_after"]
        self.assertEqual(bva["base_version"]["id"], "v1")
        self.assertTrue(data["accepted"])

    def test_04_run_full_demo_api_endpoint(self):
        """
        Tests POST /api/v1/pipeline/run-full-demo combined endpoint.
        """
        response = self.client.post(
            "/api/v1/pipeline/run-full-demo",
            json={"agent_version_id": "v1", "dataset_seed": 42}
        )
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertIn("reconciliation", data)
        self.assertIn("before_vs_after", data)
        self.assertIn("invariants_verified", data)

if __name__ == "__main__":
    unittest.main()
