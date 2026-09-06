import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure backend package import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app
from backend.app.core.database import SessionLocal, engine, Base
from backend.app.models.dataset_models import GroundTruthAnnotation, ExpectedStatus, ExceptionCategory, ExpectedAction
from backend.app.models.pydantic_models import (
    ReconciliationResultSchema, MatchType, ActionTaken, HumanStatus,
    AutopsyFailureType, SeverityLevel
)
from backend.app.services.autopsy_engine import AutopsyEngine
from backend.app.services.dataset_generator import SyntheticDatasetGenerator
from backend.app.services.agent_registry import AgentRegistry
from backend.app.models.db import DBAutopsyReport

class TestPhase7AgentAutopsy(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_single_transaction_autopsy_5_questions(self):
        """
        Verify single transaction autopsy answers 5 core diagnostic questions:
        1. What did agent predict?
        2. What should it have predicted?
        3. At which stage did failure occur?
        4. What evidence was missing/misinterpreted?
        5. What architectural change could prevent failure?
        """
        res = ReconciliationResultSchema(
            id="res_autopsy_01",
            batch_id="batch_autopsy",
            agent_version_id="v1",
            bank_tx_id="tx_bank_1",
            ledger_tx_id="tx_ledger_1",
            match_type=MatchType.AMOUNT_DISCREPANCY,
            confidence_score=0.95,
            action_taken=ActionTaken.AUTO_RECONCILE,  # Wrong action (should escalate)
            reasoning="Auto reconciled despite amount discrepancy",
            evidence=["Amount diff: $15.00"],
            human_status=HumanStatus.PENDING
        )

        gt = GroundTruthAnnotation(
            bank_transaction_id="tx_bank_1",
            expected_match_ledger_id="tx_ledger_1",
            expected_status=ExpectedStatus.EXCEPTIONAL,
            exception_type=ExceptionCategory.AMOUNT_DISCREPANCY,
            expected_action=ExpectedAction.ESCALATE
        )

        autopsy = AutopsyEngine.analyze_single_transaction_failure("tx_bank_1", res, gt)

        # 1. Predicted vs Expected
        self.assertEqual(autopsy.predicted_action, "AUTO_RECONCILE")
        self.assertEqual(autopsy.expected_action, "ESCALATE")

        # 2. Stage
        self.assertEqual(autopsy.failure_stage, "DECISION_STAGE")

        # 3. Missing evidence
        self.assertTrue(len(autopsy.missing_or_misinterpreted_evidence) > 0)

        # 4. Failure Type
        self.assertEqual(autopsy.failure_type, AutopsyFailureType.DECISION)
        self.assertEqual(autopsy.severity, SeverityLevel.CRITICAL)

        # 5. Recommendation
        self.assertTrue(len(autopsy.recommended_change) > 0)

    def test_dataset_autopsy_aggregation_and_11_types(self):
        """
        Verify dataset autopsy aggregates failures, calculates percentage breakdown,
        and generates grounded recommendations.
        """
        dataset = SyntheticDatasetGenerator.generate_dataset(seed=42, count=60)
        agent_version = AgentRegistry.get_version_by_id("v1")

        report = AutopsyEngine.run_dataset_autopsy(self.db, dataset, agent_version)

        self.assertIsNotNone(report.autopsy_id)
        self.assertEqual(report.agent_version_id, "v1")
        self.assertEqual(report.total_evaluated, len(dataset.ground_truth))
        self.assertGreater(report.total_failures, 0)
        
        # Verify 11 failure types in percentage distribution
        self.assertEqual(len(report.failure_percentage_distribution), 11)
        self.assertIn(report.top_failure_type.value, report.failure_percentage_distribution)
        self.assertTrue(len(report.dataset_recommendations) > 0)

        # Verify DB persistence
        db_rep = self.db.query(DBAutopsyReport).filter(DBAutopsyReport.id == report.autopsy_id).first()
        self.assertIsNotNone(db_rep)

    def test_autopsy_api_endpoints(self):
        """
        Verify API endpoints: POST /autopsy/run, GET /autopsy/reports, GET /autopsy/reports/{autopsy_id}
        """
        # 1. POST /api/v1/autopsy/run
        resp1 = self.client.post("/api/v1/autopsy/run", json={
            "agent_version_id": "v1",
            "dataset_seed": 42
        })
        self.assertEqual(resp1.status_code, 200)
        report_data = resp1.json()
        autopsy_id = report_data["autopsy_id"]
        self.assertIn("top_failure_type", report_data)

        # 2. GET /api/v1/autopsy/reports
        resp2 = self.client.get("/api/v1/autopsy/reports")
        self.assertEqual(resp2.status_code, 200)
        reports = resp2.json()
        self.assertTrue(len(reports) > 0)

        # 3. GET /api/v1/autopsy/reports/{autopsy_id}
        resp3 = self.client.get(f"/api/v1/autopsy/reports/{autopsy_id}")
        self.assertEqual(resp3.status_code, 200)
        self.assertEqual(resp3.json()["autopsy_id"], autopsy_id)

if __name__ == "__main__":
    unittest.main()
