"""
Strict Accuracy & Safety Regression Test Suite for Autonomous Bank Reconciliation Pipeline.
Implements 20 deterministic domain scenarios + 1 Critical Safety Override Test.
Verifies core product principle: 'KNOWS WHEN TO STOP AND ASK'.
"""
import sys
import os
import unittest
from datetime import datetime, date

# Ensure workspace root is in path
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if WORKSPACE_ROOT not in sys.path:
    sys.path.insert(0, WORKSPACE_ROOT)

from backend.app.models.pydantic_models import (
    NormalizedTransaction,
    ReconciliationResultSchema,
    ActionTaken,
    MatchType,
    SourceType,
    FinalDecisionOutput,
)
from backend.app.services.ingestion import DataIngestionService
from backend.app.services.matching_engine import MultiTierMatchingEngine
from backend.app.services.decision_engine import DecisionEngine
from backend.app.services.report_service import CanonicalReportService
from backend.app.services.agent_registry import AgentRegistry
from backend.app.core.currency import Money, make_money, aggregate_by_currency


# Canonical benchmark dataset
BENCHMARK_BANK_CSV = b"""bank_transaction_id,transaction_date,value_date,amount,currency,direction,bank_description,reference,bank_account
B001,2026-09-01,2026-09-01,12500,INR,CREDIT,NEFT CREDIT ACME INDUSTRIES INV-2001,INV-2001,HDFC-001
B002,2026-09-01,2026-09-01,-4200,INR,DEBIT,UPI PAYMENT CLOUDHOST SEPTEMBER,CLOUDHOST-SEP,HDFC-001
B003,2026-09-02,2026-09-02,8750,INR,CREDIT,IMPS CREDIT NOVA RETAIL INV-2002,INV-2002,HDFC-001
B004,2026-09-03,2026-09-03,-18500,INR,DEBIT,RTGS BRIGHT OFFICE SOLUTIONS INV-BO-305,INV-BO-305,HDFC-001
B005,2026-09-04,2026-09-04,6300,INR,CREDIT,NEFT GREENMART PVT LTD INV-2003,INV-2003,HDFC-001
B006,2026-09-05,2026-09-05,-9500,INR,DEBIT,NEFT AWS INDIA AUGUST BILL,AWS-SEP,HDFC-001
B007,2026-09-06,2026-09-06,15200,INR,CREDIT,BANK TRANSFER ORBITAL TECH INV-2004,INV-2004,HDFC-001
B008,2026-09-07,2026-09-07,-7200,INR,DEBIT,CARD PAYMENT OFFICE DEPOT INDIA,OFFICE-DEPOT-91,HDFC-001
B009,2026-09-08,2026-09-08,4100,INR,CREDIT,UPI CREDIT RIVERSTONE INV-2005,INV-2005,HDFC-001
B010,2026-09-09,2026-09-09,9900,INR,CREDIT,NEFT KAPPA SYSTEMS INV-2006,INV-2006,HDFC-001
B011,2026-09-10,2026-09-10,-3600,INR,DEBIT,UPI PAYMENT ZOHO SEPTEMBER,ZOHO-SEP,HDFC-001
B012,2026-09-11,2026-09-11,11800,INR,CREDIT,NEFT ACME INDUSTRIES INV-2007,INV-2007,HDFC-001
B013,2026-09-12,2026-09-12,-15000,INR,DEBIT,RTGS METRO LOGISTICS BILL-602,METRO-602,HDFC-001
B014,2026-09-13,2026-09-13,-5100,INR,DEBIT,NEFT FRESHWORKS SEPTEMBER,FW-SEP,HDFC-001
B015,2026-09-04,2026-09-04,6300,INR,CREDIT,NEFT GREENMART PVT LTD INV-2003,INV-2003,HDFC-001
B016,2026-09-14,2026-09-14,540,USD,CREDIT,WIRE CREDIT LUMEN LABS INV-2008,INV-2008,HDFC-USD-01
B017,2026-09-15,2026-09-16,7600,INR,CREDIT,NEFT NORTHSTAR MEDIA INV-2009,INV-2009,HDFC-001
B018,2026-09-16,2026-09-16,2750,INR,CREDIT,UPI CREDIT PIXEL PRINTS INV-2010,INV-2010,HDFC-001
B019,2026-09-17,2026-09-17,-6800,INR,DEBIT,NEFT NEXA SOLUTIONS INV-NX-44,INV-NX-44,HDFC-001
B020,2026-09-18,2026-09-18,4800,INR,CREDIT,NEFT UNKNOWN CUSTOMER PAYMENT,UNKNOWN-001,HDFC-001
B021,2026-09-19,2026-09-19,-6100,INR,DEBIT,NEFT PAYMENT VERTEX SUPPLIES,VERTEX-77,HDFC-001
B022,2026-09-20,2026-09-20,7300,INR,CREDIT,UPI CREDIT WALK-IN CUSTOMER,UNKNOWN-002,HDFC-001
B023,2026-09-21,2026-09-21,-4200,INR,DEBIT,NEFT PAYMENT OLD REFERENCE 7781,OLD-7781,HDFC-001
B024,2026-09-22,2026-09-22,-850,INR,DEBIT,BANK CHARGES SEPTEMBER,BANK-FEE-SEP,HDFC-001
B025,2026-09-23,2026-09-23,11200,INR,CREDIT,NEFT SUNRISE TRADERS PAYMENT,SUNRISE-001,HDFC-001
"""

BENCHMARK_LEDGER_CSV = b"""ledger_id,document_id,document_date,posting_date,counterparty,amount,currency,direction,payment_reference,status
L001,INV-2001,2026-08-20,2026-09-01,Acme Industries,12500,INR,CREDIT,INV-2001,Open
L002,BILL-CLOUD-SEP,2026-09-01,2026-09-01,CloudHost,-4200,INR,DEBIT,CLOUDHOST-SEP,Paid
L003,INV-2002,2026-08-22,2026-09-02,Nova Retail,8750,INR,CREDIT,INV-2002,Open
L004,BILL-BO-305,2026-08-25,2026-09-03,Bright Office Solutions,-18500,INR,DEBIT,INV-BO-305,Paid
L005,INV-2003,2026-08-28,2026-09-04,GreenMart Pvt Ltd,6300,INR,CREDIT,INV-2003,Open
L006,BILL-AWS-SEP,2026-09-01,2026-09-05,AWS India,-9500,INR,DEBIT,AWS-SEP,Paid
L007,INV-2004,2026-08-30,2026-09-06,Orbital Tech,15200,INR,CREDIT,INV-2004,Open
L008,BILL-OFFICE-91,2026-09-01,2026-09-07,Office Depot India,-7200,INR,DEBIT,OFFICE-DEPOT-91,Paid
L009,INV-2005,2026-09-01,2026-09-08,Riverstone,4100,INR,CREDIT,INV-2005,Open
L010,INV-2006,2026-09-02,2026-09-09,Kappa Systems,9900,INR,CREDIT,INV-2006,Open
L011,BILL-ZOHO-SEP,2026-09-01,2026-09-10,Zoho,-3600,INR,DEBIT,ZOHO-SEP,Paid
L012,INV-2007,2026-09-04,2026-09-11,Acme Industries,11800,INR,CREDIT,INV-2007,Open
L013,BILL-METRO-602,2026-09-02,2026-09-12,Metro Logistics,-15000,INR,DEBIT,METRO-602,Paid
L014,BILL-FW-SEP,2026-09-01,2026-09-13,Freshworks,-5100,INR,DEBIT,FW-SEP,Paid
L015,INV-2008,2026-09-01,2026-09-14,Lumen Labs,550,USD,CREDIT,INV-2008,Open
L016,INV-2009,2026-09-05,2026-09-15,Northstar Media,7600,INR,CREDIT,INV-2009,Open
L017,INV-2010,2026-09-06,2026-09-16,Pixel Prints,5000,INR,CREDIT,INV-2010,Partially Paid
L018,BILL-NX-44,2026-09-01,2026-09-17,Nexa Solutions Pvt Ltd,-6800,INR,DEBIT,INV-NX-44,Paid
L019,INV-2011,2026-09-10,2026-09-20,BluePeak Consulting,9200,INR,CREDIT,INV-2011,Open
L020,BILL-SKYNET-SEP,2026-09-05,2026-09-22,Skynet Hosting,-3900,INR,DEBIT,SKYNET-SEP,Paid
L021,INV-2012,2026-09-12,2026-09-24,Delta Foods,6400,INR,CREDIT,INV-2012,Open
L022,BILL-MAPLE-88,2026-09-14,2026-09-25,Maple Services,-2700,INR,DEBIT,MAPLE-88,Paid
"""

class TestReconciliationAccuracyAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.agent = AgentRegistry.get_version_by_id("v3")
        cls.batch_id = "test_audit_batch"
        cls.bank_csv = BENCHMARK_BANK_CSV
        cls.ledger_csv = BENCHMARK_LEDGER_CSV
        cls.bank_txs = DataIngestionService.parse_csv_content(cls.bank_csv, SourceType.BANK, cls.batch_id)
        cls.ledger_txs = DataIngestionService.parse_csv_content(cls.ledger_csv, SourceType.LEDGER, cls.batch_id)
        cls.results, cls.traces = MultiTierMatchingEngine.process_batch(
            batch_id=cls.batch_id,
            bank_txs=cls.bank_txs,
            ledger_txs=cls.ledger_txs,
            agent_version=cls.agent
        )
        cls.results_by_bank_id = {r.bank_tx.id: r for r in cls.results if r.bank_tx}

    # =========================================================================
    # SCENARIOS 1 - 20
    # =========================================================================

    def test_01_exact_credit_match(self):
        """Scenario 1: Exact credit match (B001 -> L001)"""
        r = self.results_by_bank_id.get("B001")
        self.assertIsNotNone(r)
        self.assertEqual(r.action_taken, ActionTaken.AUTO_RECONCILE)
        self.assertEqual(r.match_type, MatchType.EXACT)
        self.assertEqual(r.ledger_tx_id, "L001")
        self.assertGreaterEqual(r.confidence_score, 0.95)

    def test_02_exact_debit_match(self):
        """Scenario 2: Exact debit match (B002 -> L002)"""
        r = self.results_by_bank_id.get("B002")
        self.assertIsNotNone(r)
        self.assertEqual(r.action_taken, ActionTaken.AUTO_RECONCILE)
        self.assertEqual(r.match_type, MatchType.EXACT)
        self.assertEqual(r.ledger_tx_id, "L002")
        self.assertEqual(r.bank_tx.amount, -4200.0)

    def test_03_reference_match(self):
        """Scenario 3: Reference match (B003 reference INV-2002 -> L003 document_id)"""
        r = self.results_by_bank_id.get("B003")
        self.assertIsNotNone(r)
        self.assertEqual(r.action_taken, ActionTaken.AUTO_RECONCILE)
        self.assertEqual(r.ledger_tx_id, "L003")
        self.assertEqual(r.bank_tx.reference, "INV-2002")

    def test_04_counterparty_normalization(self):
        """Scenario 4: Counterparty normalization (B019 'NEFT NEXA SOLUTIONS' -> L018 'Nexa Solutions Pvt Ltd')"""
        r = self.results_by_bank_id.get("B019")
        self.assertIsNotNone(r)
        self.assertEqual(r.action_taken, ActionTaken.AUTO_RECONCILE)
        self.assertEqual(r.ledger_tx_id, "L018")

    def test_05_legitimate_date_difference(self):
        """Scenario 5: Legitimate date difference (B017 2026-09-16 vs L016 2026-09-15) within clearing window"""
        r = self.results_by_bank_id.get("B017")
        self.assertIsNotNone(r)
        self.assertEqual(r.action_taken, ActionTaken.AUTO_RECONCILE)
        self.assertEqual(r.ledger_tx_id, "L016")

    def test_06_duplicate_transaction_escalation(self):
        """Scenario 6: Duplicate bank transaction B015 must NOT double-consume L005; must ESCALATE as DUPLICATE"""
        r_first = self.results_by_bank_id.get("B005")
        r_dup = self.results_by_bank_id.get("B015")
        self.assertIsNotNone(r_first)
        self.assertIsNotNone(r_dup)
        self.assertEqual(r_first.action_taken, ActionTaken.AUTO_RECONCILE)
        self.assertEqual(r_first.ledger_tx_id, "L005")

        self.assertEqual(r_dup.action_taken, ActionTaken.ESCALATE_TO_HUMAN)
        self.assertEqual(r_dup.match_type, MatchType.DUPLICATE)
        self.assertIn("duplicate", r_dup.reasoning.lower())

    def test_07_partial_payment_detection(self):
        """Scenario 7: Partial payment detection (B018 INR 2,750 vs L017 INR 5,000) must ESCALATE"""
        r = self.results_by_bank_id.get("B018")
        self.assertIsNotNone(r)
        self.assertEqual(r.action_taken, ActionTaken.ESCALATE_TO_HUMAN)
        self.assertEqual(r.match_type, MatchType.PARTIAL_PAYMENT)
        self.assertIn("partial", r.reasoning.lower())

    def test_08_overpayment_detection(self):
        """Scenario 8: Overpayment detection where bank amount > ledger candidate amount"""
        bank_tx = NormalizedTransaction(
            id="B_OVER",
            batch_id="test_over",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=15000.0,
            currency="INR",
            description="OVERPAYMENT INV-999",
            reference="INV-999",
            counterparty="Client A",
            normalized_amount=15000.0
        )
        ledger_tx = NormalizedTransaction(
            id="L_OVER",
            batch_id="test_over",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=10000.0,
            currency="INR",
            description="Invoice INV-999",
            reference="INV-999",
            counterparty="Client A",
            normalized_amount=10000.0
        )
        decision = DecisionEngine.evaluate_decision(
            bank_tx=bank_tx,
            ledger_tx=ledger_tx,
            selected_ledger_id=ledger_tx.id,
            confidence=0.95,
            evidence=["Invoice ref match but bank amount exceeds ledger"],
            exception_type="AMOUNT_VARIANCE"
        )
        self.assertEqual(decision.decision, "ESCALATE_TO_HUMAN")
        self.assertIn("variance", decision.reason.lower())

    def test_09_material_amount_variance_escalation(self):
        """Scenario 9: Material amount variance without fee/FX context must ESCALATE"""
        r = self.results_by_bank_id.get("B016")
        self.assertIsNotNone(r)
        self.assertEqual(r.action_taken, ActionTaken.ESCALATE_TO_HUMAN)
        self.assertIn(r.match_type, [MatchType.AMOUNT_VARIANCE, MatchType.FUZZY])

    def test_10_usd_amount_variance(self):
        """Scenario 10: USD amount variance B016 ($540) vs L015 ($550) escalates with exact delta"""
        r = self.results_by_bank_id.get("B016")
        self.assertIsNotNone(r)
        self.assertEqual(r.bank_tx.currency, "USD")
        self.assertEqual(r.ledger_tx.currency, "USD")
        self.assertEqual(abs(r.bank_tx.amount - r.ledger_tx.amount), 10.0)
        self.assertEqual(r.action_taken, ActionTaken.ESCALATE_TO_HUMAN)

    def test_11_inr_amount_variance(self):
        """Scenario 11: INR amount variance (B018 INR 2,750 vs INR 5,000) delta = INR 2,250"""
        r = self.results_by_bank_id.get("B018")
        self.assertIsNotNone(r)
        self.assertEqual(r.bank_tx.currency, "INR")
        self.assertEqual(abs(r.bank_tx.amount - r.ledger_tx.amount), 2250.0)
        self.assertEqual(r.action_taken, ActionTaken.ESCALATE_TO_HUMAN)

    def test_12_missing_ledger_record(self):
        """Scenario 12: Missing ledger record (B020 has no ledger counterpart -> UNMATCHED, conf = 0.0)"""
        r = self.results_by_bank_id.get("B020")
        self.assertIsNotNone(r)
        self.assertEqual(r.action_taken, ActionTaken.REJECT)
        self.assertEqual(r.match_type, MatchType.UNMATCHED)
        self.assertEqual(r.confidence_score, 0.0)
        self.assertIsNone(r.ledger_tx_id)

    def test_13_missing_bank_record_ledger_only(self):
        """Scenario 13: Missing bank record (L019-L022 exist only in ledger)"""
        matched_ledger_ids = {r.ledger_tx_id for r in self.results if r.ledger_tx_id}
        ledger_only_ids = {"L019", "L020", "L021", "L022"}
        for lid in ledger_only_ids:
            self.assertNotIn(lid, matched_ledger_ids, f"Ledger {lid} should not be matched to any bank tx")

    def test_14_multiple_candidates_ambiguity_escalation(self):
        """Scenario 14: Multiple candidates with identical amount and no reference must ESCALATE"""
        bank_tx = NormalizedTransaction(
            id="B_AMBIG",
            batch_id="test_ambig",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=5000.0,
            currency="INR",
            description="GENERIC PAYMENT",
            reference=None,
            counterparty=None,
            normalized_amount=5000.0
        )
        l1 = NormalizedTransaction(
            id="L_AMBIG_1",
            batch_id="test_ambig",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=5000.0,
            currency="INR",
            description="Vendor A",
            reference="INV-A",
            counterparty="Vendor A",
            normalized_amount=5000.0
        )
        decision = DecisionEngine.evaluate_decision(
            bank_tx=bank_tx,
            ledger_tx=l1,
            selected_ledger_id=l1.id,
            confidence=0.75,
            evidence=["Multiple candidate matches share the identical amount 5000.0"],
            exception_type="MULTIPLE_CANDIDATES"
        )
        self.assertEqual(decision.decision, "ESCALATE_TO_HUMAN")

    def test_15_fuzzy_match(self):
        """Scenario 15: Fuzzy match with minor description variations"""
        bank_tx = NormalizedTransaction(
            id="B_FUZZY",
            batch_id="test_fuzzy",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=3500.0,
            currency="INR",
            description="ZOHO CORP SUBSCRIPTION",
            reference="ZOHO-SUB-01",
            counterparty="Zoho Corp",
            normalized_amount=3500.0
        )
        ledger_tx = NormalizedTransaction(
            id="L_FUZZY",
            batch_id="test_fuzzy",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=3500.0,
            currency="INR",
            description="Zoho Software Inc",
            reference="ZOHO-SUB-01",
            counterparty="Zoho Software Inc",
            normalized_amount=3500.0
        )
        decision = DecisionEngine.evaluate_decision(
            bank_tx=bank_tx,
            ledger_tx=ledger_tx,
            selected_ledger_id=ledger_tx.id,
            confidence=0.92,
            evidence=["Exact reference match with counterparty variation", "Transaction dates align"],
            exception_type="FUZZY"
        )
        self.assertEqual(decision.decision, "AUTO_RECONCILE")

    def test_16_conflicting_evidence_escalation(self):
        """Scenario 16: Conflicting evidence (e.g. correct invoice number but wrong counterparty/amount) must ESCALATE"""
        bank_tx = NormalizedTransaction(
            id="B_CONFLICT",
            batch_id="test_conflict",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=8000.0,
            currency="INR",
            description="CONFLICTING PAYMENT INV-2001",
            reference="INV-2001",
            counterparty="Wrong Counterparty",
            normalized_amount=8000.0
        )
        ledger_tx = NormalizedTransaction(
            id="L_CONFLICT",
            batch_id="test_conflict",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=12500.0,
            currency="INR",
            description="INV-2001 Acme",
            reference="INV-2001",
            counterparty="Acme Industries",
            normalized_amount=12500.0
        )
        decision = DecisionEngine.evaluate_decision(
            bank_tx=bank_tx,
            ledger_tx=ledger_tx,
            selected_ledger_id=ledger_tx.id,
            confidence=0.85,
            evidence=["Reference matches but amount differs by 4500.0"],
            exception_type="AMOUNT_VARIANCE"
        )
        self.assertEqual(decision.decision, "ESCALATE_TO_HUMAN")

    def test_17_malformed_reference_handling(self):
        """Scenario 17: Malformed reference handling (spaces, trailing slashes, case variations)"""
        norm_ref = MultiTierMatchingEngine._normalize_ref("  INV - 2001 / ")
        self.assertIn("2001", norm_ref)

    def test_18_multi_currency_batch_isolation(self):
        """Scenario 18: Multi-currency batch isolation (INR and USD never summed without FX)"""
        m_inr1 = make_money(1000.0, "INR")
        m_inr2 = make_money(500.0, "INR")
        m_usd1 = make_money(50.0, "USD")

        # Summing same currency succeeds
        total_inr = m_inr1 + m_inr2
        self.assertEqual(total_inr.amount, 1500.0)
        self.assertEqual(total_inr.currency, "INR")

        # Cross currency addition raises ValueError
        with self.assertRaises(ValueError):
            _ = m_inr1 + m_usd1

        # Isolated aggregation by currency
        agg = aggregate_by_currency([m_inr1, m_inr2, m_usd1])
        self.assertEqual(agg["INR"].amount, 1500.0)
        self.assertEqual(agg["USD"].amount, 50.0)

    def test_19_missing_currency_handling(self):
        """Scenario 19: Missing currency handling raises error or handles strictly"""
        with self.assertRaises(ValueError):
            _ = make_money(100.0, "")

    def test_20_empty_description_handling(self):
        """Scenario 20: Empty description handling does not crash ingestion or matching"""
        empty_desc_csv = b"""bank_transaction_id,transaction_date,value_date,amount,currency,direction,bank_description,reference,bank_account
B_EMPTY,2026-09-01,2026-09-01,1000,INR,CREDIT,,,HDFC-001
"""
        txs = DataIngestionService.parse_csv_content(empty_desc_csv, SourceType.BANK, "batch_empty")
        self.assertEqual(len(txs), 1)
        self.assertIn(txs[0].description, ["", "BANK Record"])

    # =========================================================================
    # CRITICAL TEST: HARD SAFETY OVERRIDE
    # =========================================================================

    def test_21_critical_hard_safety_override_with_llm_99_confidence(self):
        """
        CRITICAL TEST:
        Simulate an LLM response with confidence = 0.99 for a transaction where
        bank amount and ledger amount materially differ without a fee/fx explanation.
        Assert that the system escalates rather than auto-reconciles.
        'KNOWS WHEN TO STOP AND ASK'
        """
        bank_tx = NormalizedTransaction(
            id="B_CRITICAL",
            batch_id="test_critical",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=10000.0,
            currency="USD",
            description="CRITICAL TEST TRANSACTION",
            reference="INV-CRITICAL",
            counterparty="Vendor Alpha",
            normalized_amount=10000.0
        )
        ledger_tx = NormalizedTransaction(
            id="L_CRITICAL",
            batch_id="test_critical",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=5000.0,
            currency="USD",
            description="Invoice INV-CRITICAL",
            reference="INV-CRITICAL",
            counterparty="Vendor Alpha",
            normalized_amount=5000.0
        )
        # Evaluate through DecisionEngine with simulated LLM confidence = 0.99
        decision = DecisionEngine.evaluate_decision(
            bank_tx=bank_tx,
            ledger_tx=ledger_tx,
            selected_ledger_id=ledger_tx.id,
            confidence=0.99,
            evidence=["Simulated LLM hallucination asserting match despite $5,000 difference"],
            exception_type="AMOUNT_VARIANCE"
        )

        # STRICT ASSERTIONS:
        self.assertEqual(
            decision.decision,
            "ESCALATE_TO_HUMAN",
            "CRITICAL FAILURE: System auto-reconciled a material amount mismatch because LLM gave confidence 0.99!"
        )
        self.assertIsNotNone(decision.stop_reason_details)
        self.assertIn("material amount variance", decision.stop_reason_details["why_stopped"].lower())
        self.assertIn("conflicting_evidence", decision.stop_reason_details)
        self.assertGreater(len(decision.stop_reason_details["conflicting_evidence"]), 0)
        print("\n[CRITICAL TEST PASSED] LLM confidence 0.99 successfully overridden by Hard Safety Rules.")


def generate_evaluation_report():
    """Runs the suite and outputs the full 25-transaction ground truth matrix."""
    agent = AgentRegistry.get_version_by_id("v3")
    batch_id = "eval_report_batch"
    bank_txs = DataIngestionService.parse_csv_content(BENCHMARK_BANK_CSV, SourceType.BANK, batch_id)
    ledger_txs = DataIngestionService.parse_csv_content(BENCHMARK_LEDGER_CSV, SourceType.LEDGER, batch_id)
    results, traces = MultiTierMatchingEngine.process_batch(
        batch_id=batch_id,
        bank_txs=bank_txs,
        ledger_txs=ledger_txs,
        agent_version=agent
    )

    print("\n" + "=" * 110)
    print("CANONICAL GROUND TRUTH EVALUATION MATRIX (25 BANK TRANSACTIONS)")
    print("=" * 110)
    header = f"{'Bank ID':<8} | {'Amount':<10} | {'Curr':<4} | {'Ledger ID':<9} | {'Match Type':<18} | {'Conf':<6} | {'Action Taken':<18} | {'Stop Reason'}"
    print(header)
    print("-" * 110)

    false_auto_matches = 0
    auto_reconciled = 0
    escalated = 0
    unmatched = 0

    for r in results:
        b = r.bank_tx
        l = r.ledger_tx
        b_id = b.id if b else "N/A"
        b_amt = f"{b.amount:.2f}" if b else "0.00"
        curr = b.currency if b else "N/A"
        l_id = l.id if l else "—"
        m_type = r.match_type.value if r.match_type else "UNMATCHED"
        conf = f"{r.confidence_score*100:.0f}%"
        action = r.action_taken.value

        stop_reason = ""
        if r.action_taken == ActionTaken.ESCALATE_TO_HUMAN:
            escalated += 1
            if r.stop_reason_details:
                stop_reason = r.stop_reason_details.why_stopped
            else:
                stop_reason = r.reasoning[:40]
        elif r.action_taken == ActionTaken.AUTO_RECONCILE:
            auto_reconciled += 1
            # Check false auto-match
            b_val = b.normalized_amount if b else 0.0
            l_val = l.normalized_amount if l else 0.0
            if abs(b_val - l_val) > 0.05 or r.match_type in [MatchType.DUPLICATE, MatchType.PARTIAL_PAYMENT, MatchType.AMOUNT_VARIANCE]:
                false_auto_matches += 1
        elif r.action_taken == ActionTaken.REJECT:
            unmatched += 1
            stop_reason = "No candidate ledger entry found"

        print(f"{b_id:<8} | {b_amt:<10} | {curr:<4} | {l_id:<9} | {m_type:<18} | {conf:<6} | {action:<18} | {stop_reason[:35]}")

    print("-" * 110)
    print(f"Total Bank Transactions: {len(results)}")
    print(f"  Auto-Reconciled (STP): {auto_reconciled} ({auto_reconciled/len(results)*100:.1f}%)")
    print(f"  Escalated to Human:    {escalated} ({escalated/len(results)*100:.1f}%)")
    print(f"  Unmatched / Rejected:  {unmatched} ({unmatched/len(results)*100:.1f}%)")
    print(f"  False Auto-Match Rate: {false_auto_matches / max(1, auto_reconciled) * 100:.1f}%")
    print("=" * 110 + "\n")


if __name__ == "__main__":
    generate_evaluation_report()
    unittest.main()
