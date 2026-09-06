import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure backend package import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app
from backend.app.core.database import SessionLocal, engine, Base
from backend.app.models.pydantic_models import (
    NormalizedTransaction, ReconciliationResultSchema, MatchType, ActionTaken, HumanStatus, PolicyCheckItem, ProcessingMethod
)
from backend.app.services.audit_service import AuditService
from backend.app.models.db import DBAuditLog, DBReconciliationResult

class TestPhase5AuditTrail(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_audit_record_creation_and_8_questions(self):
        """
        Verify that AuditService creates an audit trail record answering all 8 core questions.
        """
        bank_tx = NormalizedTransaction(
            id="tx_bank_99",
            source="BANK",
            date="2026-03-01",
            amount=500.0,
            currency="USD",
            description="WIRE TRANSFER TECH SUPPLIES INC",
            reference="REF999"
        )

        import uuid
        res_id = f"res_audit_{uuid.uuid4().hex[:8]}"
        res = ReconciliationResultSchema(
            id=res_id,
            batch_id="batch_audit_test",
            agent_version_id="v3",
            bank_tx_id="tx_bank_99",
            bank_tx=bank_tx,
            ledger_tx_id="tx_ledger_99",
            match_type=MatchType.EXACT,
            processing_method=ProcessingMethod.RULE,
            confidence_score=0.98,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="Exact amount ($500.00) and clearing date match within 24 hours.",
            evidence=["Exact amount match $500.00 USD", "Date within 1 day window"],
            policy_checks=[
                PolicyCheckItem(check_name="MIN_CONFIDENCE_THRESHOLD", passed=True, details="Confidence 98% >= 90%"),
                PolicyCheckItem(check_name="NO_HIGH_RISK_OVERRIDE", passed=True, details="No anomalies flagged")
            ],
            human_status=HumanStatus.PENDING
        )

        audit_item = AuditService.create_audit_item(result=res, agent_version_id="v3")
        AuditService.save_audit_record(self.db, audit_item, commit=True)

        # Retrieve stored audit log from SQLite DB
        db_audit = self.db.query(DBAuditLog).filter(DBAuditLog.id == audit_item.audit_id).first()
        self.assertIsNotNone(db_audit, "Audit log must be persisted in database")

        # Answer 8 Audit Questions Verification
        # 1. What did the agent do?
        self.assertEqual(db_audit.decision, "AUTO_RECONCILE")
        self.assertEqual(db_audit.selected_match, "tx_ledger_99")

        # 2. Why did it do it?
        self.assertTrue("Exact amount" in db_audit.reasoning)

        # 3. What evidence did it use?
        self.assertTrue(len(db_audit.evidence) > 0)
        self.assertIn("Exact amount match $500.00 USD", db_audit.evidence)

        # 4. How confident was it?
        self.assertEqual(db_audit.confidence, 0.98)

        # 5. What policy was applied?
        self.assertTrue(len(db_audit.policy_checks) >= 2)

        # 6. Which agent version made the decision?
        self.assertEqual(db_audit.agent_version, "v3")

        # 7. How long did it take?
        self.assertGreater(db_audit.latency_ms, 0.0)

        # 8. Was it automatically reconciled or escalated?
        self.assertEqual(db_audit.decision, "AUTO_RECONCILE")

    def test_7_stage_timeline_events(self):
        """
        Verify that 7 execution trace timeline events are generated for UI.
        """
        bank_tx = NormalizedTransaction(
            id="tx_bank_100",
            source="BANK",
            date="2026-03-02",
            amount=1250.0,
            currency="USD",
            description="SUSPICIOUS PAYMENT",
            reference="REF100"
        )

        res = ReconciliationResultSchema(
            id="res_audit_02",
            batch_id="batch_audit_test",
            agent_version_id="v3",
            bank_tx_id="tx_bank_100",
            bank_tx=bank_tx,
            ledger_tx_id=None,
            match_type=MatchType.AMOUNT_DISCREPANCY,
            processing_method=ProcessingMethod.LLM,
            confidence_score=0.45,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Unexplained variance between bank and ledger amounts exceeds tolerance threshold.",
            evidence=["Amount discrepancy: $1250.0 vs $1000.0"],
            policy_checks=[
                PolicyCheckItem(check_name="MIN_CONFIDENCE_THRESHOLD", passed=False, details="Confidence 45% < 90%"),
                PolicyCheckItem(check_name="HIGH_RISK_OVERRIDE", passed=False, details="Escalation required")
            ],
            human_status=HumanStatus.PENDING
        )

        events = AuditService.generate_timeline_events(bank_tx, res)
        stage_names = [e.stage_name for e in events]

        self.assertIn("AGENT_STARTED", stage_names)
        self.assertIn("MATCHING_STAGE", stage_names)
        self.assertIn("FUZZY_STAGE", stage_names)
        self.assertIn("LLM_STAGE", stage_names)
        self.assertIn("DECISION_STAGE", stage_names)
        self.assertIn("ESCALATION", stage_names)
        self.assertIn("FINAL_RESULT", stage_names)
        self.assertEqual(len(stage_names), 7, "All 7 audit trace stages must be recorded")

    def test_audit_api_endpoints(self):
        """
        Verify API endpoints: GET /audit, GET /audit/{id}, GET /reconciliation/{id}, GET /reconciliation/{id}/trace
        """
        import uuid
        res_id = f"res_audit_api_{uuid.uuid4().hex[:8]}"
        # Seed DB reconciliation result & audit log
        db_res = DBReconciliationResult(
            id=res_id,
            batch_id=f"batch_api_{uuid.uuid4().hex[:8]}",
            agent_version_id="v3",
            bank_tx_id=f"tx_bank_api_{uuid.uuid4().hex[:8]}",
            ledger_tx_id=f"tx_ledger_api_{uuid.uuid4().hex[:8]}",
            match_type="EXACT",
            confidence_score=0.95,
            action_taken="AUTO_RECONCILE",
            reasoning="API test reconciliation passed",
            discrepancy_details=[],
            human_status="PENDING"
        )
        self.db.add(db_res)
        self.db.commit()

        bank_tx = NormalizedTransaction(id="tx_bank_api_99", source="BANK", date="2026-03-01", amount=100.0, description="Test")
        res_schema = ReconciliationResultSchema(
            id=res_id,
            batch_id="batch_api_test",
            agent_version_id="v3",
            bank_tx_id="tx_bank_api_99",
            bank_tx=bank_tx,
            ledger_tx_id="tx_ledger_api_99",
            match_type=MatchType.EXACT,
            processing_method=ProcessingMethod.RULE,
            confidence_score=0.95,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="API test reconciliation passed",
            evidence=["Evidence 1"],
            policy_checks=[],
            human_status=HumanStatus.PENDING
        )

        audit_item = AuditService.create_audit_item(result=res_schema, agent_version_id="v3")
        AuditService.save_audit_record(self.db, audit_item, commit=True)

        # 1. GET /api/v1/audit
        resp1 = self.client.get("/api/v1/audit")
        self.assertEqual(resp1.status_code, 200)
        items = resp1.json()
        self.assertTrue(len(items) > 0)

        # 2. GET /api/v1/audit/{id}
        resp2 = self.client.get(f"/api/v1/audit/{audit_item.audit_id}")
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.json()["audit_id"], audit_item.audit_id)

        # 3. GET /api/v1/reconciliation/{id}
        resp3 = self.client.get(f"/api/v1/reconciliation/{res_id}")
        self.assertEqual(resp3.status_code, 200)
        self.assertEqual(resp3.json()["id"], res_id)

        # 4. GET /api/v1/reconciliation/{id}/trace
        resp4 = self.client.get(f"/api/v1/reconciliation/{res_id}/trace")
        self.assertEqual(resp4.status_code, 200)
        trace_data = resp4.json()
        self.assertIn("timeline_events", trace_data)
        self.assertTrue(len(trace_data["timeline_events"]) >= 4)

    def test_no_raw_chain_of_thought_exposure(self):
        """
        Verify audit logs do not expose raw LLM internal chain-of-thought buffers.
        """
        bank_tx = NormalizedTransaction(id="tx_cot_01", source="BANK", date="2026-03-01", amount=300.0, description="CoT Test")
        res = ReconciliationResultSchema(
            id="res_cot_01",
            batch_id="batch_cot",
            agent_version_id="v3",
            bank_tx_id="tx_cot_01",
            bank_tx=bank_tx,
            ledger_tx_id=None,
            match_type=MatchType.FUZZY,
            processing_method=ProcessingMethod.LLM,
            confidence_score=0.82,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Concise decision rationale: description similarity matches, but amount mismatch requires review.",
            evidence=["Description similarity 88%"],
            policy_checks=[],
            human_status=HumanStatus.PENDING
        )

        audit_item = AuditService.create_audit_item(result=res, agent_version_id="v3")
        self.assertNotIn("THOUGHT_PROCESS:", audit_item.reasoning)
        self.assertNotIn("system_prompt", audit_item.reasoning)
        self.assertNotIn("raw_llm_output", audit_item.reasoning)

if __name__ == "__main__":
    unittest.main()
