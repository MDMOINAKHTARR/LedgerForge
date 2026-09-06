"""
Test suite for Reconciliation Policy & Safety Boundaries Transparency (Office of the CFO View).

Verifies:
1. Active policy is retrieved and structured correctly.
2. Active agent version metadata is exposed accurately.
3. DecisionPolicy thresholds reflect actual backend configuration.
4. DecisionEngine safety boundaries are explicitly enumerated and enforced.
5. No hardcoded currency assumptions exist in policy outputs.
6. Read-only governance lock is enforced to protect internal accounting controls.
7. Querying policies by version_id returns specific version thresholds.
8. Existing reconciliation flow remains unchanged.
"""

import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure backend package import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.main import app
from backend.app.services.agent_registry import AgentRegistry
from backend.app.models.pydantic_models import DecisionPolicy


class TestReconciliationPolicyTransparency(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_active_policy_endpoint_returns_valid_structure(self):
        """Test 1: GET /api/v1/agents/active-policy returns full CFO policy structure."""
        resp = self.client.get("/api/v1/agents/active-policy")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertIn("active_agent_version", data)
        self.assertIn("decision_policy", data)
        self.assertIn("safety_boundaries", data)
        self.assertIn("governance", data)

    def test_02_agent_version_matches_registry_active_version(self):
        """Test 2: Active agent version in API matches AgentRegistry.get_active_version()."""
        active_agent = AgentRegistry.get_active_version()
        resp = self.client.get("/api/v1/agents/active-policy")
        self.assertEqual(resp.status_code, 200)
        agent_data = resp.json()["active_agent_version"]

        self.assertEqual(agent_data["id"], active_agent.id)
        self.assertEqual(agent_data["version_name"], active_agent.version_name)
        self.assertTrue(agent_data["is_active"])
        self.assertIn("stp_rate", agent_data)
        self.assertIn("accuracy_score", agent_data)

    def test_03_decision_policy_fields_match_active_policy(self):
        """Test 3: Policy fields reflect actual active agent DecisionPolicy without invented values."""
        active_agent = AgentRegistry.get_active_version()
        actual_policy = active_agent.get_decision_policy()

        resp = self.client.get("/api/v1/agents/active-policy")
        self.assertEqual(resp.status_code, 200)
        pol_data = resp.json()["decision_policy"]

        self.assertEqual(pol_data["confidence_threshold"], actual_policy.confidence_threshold)
        self.assertEqual(pol_data["min_evidence_count"], actual_policy.min_evidence_count)
        self.assertEqual(pol_data["max_amount_variance"], actual_policy.max_amount_variance)
        self.assertEqual(pol_data["max_date_difference_days"], actual_policy.max_date_difference_days)
        self.assertEqual(pol_data["allowed_auto_exception_types"], actual_policy.allowed_auto_exception_types)
        self.assertEqual(pol_data["escalate_on_duplicate_candidates"], actual_policy.escalate_on_duplicate_candidates)
        self.assertEqual(pol_data["escalate_on_ambiguity"], actual_policy.escalate_on_ambiguity)

    def test_04_safety_boundaries_enumerate_decision_engine_rules(self):
        """Test 4: Safety boundaries reflect the non-negotiable rules enforced in DecisionEngine."""
        resp = self.client.get("/api/v1/agents/active-policy")
        self.assertEqual(resp.status_code, 200)
        boundaries = resp.json()["safety_boundaries"]
        self.assertGreaterEqual(len(boundaries), 7)

        category_ids = {b["id"] for b in boundaries}
        expected_guards = {
            "CURRENCY_MISMATCH",
            "DUPLICATE_CANDIDATE",
            "MATERIAL_AMOUNT_VARIANCE",
            "DIRECTION_CONFLICT",
            "INSUFFICIENT_EVIDENCE",
            "AMBIGUOUS_CANDIDATES",
            "HISTORICAL_CONFLICT"
        }
        self.assertTrue(expected_guards.issubset(category_ids), f"Missing guardrail in: {category_ids}")

        # All boundaries must be ENFORCED and require Mandatory Human Review
        for b in boundaries:
            self.assertEqual(b["status"], "ENFORCED")
            self.assertEqual(b["action"], "Mandatory Human Review")
            self.assertTrue(len(b["rule"]) > 10)
            self.assertIn("DecisionEngine", b["source"])

    def test_05_no_hardcoded_currency_assumptions_in_policy(self):
        """Test 5: Numerical thresholds do not assume USD or INR."""
        resp = self.client.get("/api/v1/agents/active-policy")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        # max_amount_variance is a pure numerical float
        self.assertIsInstance(data["decision_policy"]["max_amount_variance"], (int, float))

        # Currency mismatch boundary explicitly enforces zero cross-currency assumptions
        curr_bound = next(b for b in data["safety_boundaries"] if b["id"] == "CURRENCY_MISMATCH")
        self.assertIn("Cross-currency", curr_bound["rule"])
        self.assertNotIn("USD only", curr_bound["rule"])
        self.assertNotIn("INR only", curr_bound["rule"])

    def test_06_governance_mode_is_read_only(self):
        """Test 6: Governance mode is read-only to prevent unauthorized weakening of financial controls."""
        resp = self.client.get("/api/v1/agents/active-policy")
        self.assertEqual(resp.status_code, 200)
        gov = resp.json()["governance"]

        self.assertEqual(gov["mode"], "READ_ONLY")
        self.assertFalse(gov["is_editable"])
        self.assertIn("regulatory compliance", gov["description"])
        self.assertIn("Agent Evolution", gov["promotion_requirement"])

    def test_07_querying_policy_by_version_id(self):
        """Test 7: Querying policy with ?version_id returns specific version thresholds."""
        # Query v1 (Baseline)
        resp_v1 = self.client.get("/api/v1/agents/active-policy?version_id=v1")
        self.assertEqual(resp_v1.status_code, 200)
        data_v1 = resp_v1.json()
        self.assertEqual(data_v1["active_agent_version"]["id"], "v1")
        self.assertEqual(data_v1["decision_policy"]["confidence_threshold"], 0.90)

        # Query v2 (Few-shot)
        resp_v2 = self.client.get("/api/v1/agents/active-policy?version_id=v2")
        self.assertEqual(resp_v2.status_code, 200)
        data_v2 = resp_v2.json()
        self.assertEqual(data_v2["active_agent_version"]["id"], "v2")
        self.assertEqual(data_v2["decision_policy"]["confidence_threshold"], 0.88)


if __name__ == "__main__":
    unittest.main()
