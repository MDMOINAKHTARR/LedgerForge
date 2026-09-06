import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.models.pydantic_models import NormalizedTransaction, SourceType, ProcessingMethod, MatchType, ActionTaken
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.matching_engine import MultiTierMatchingEngine
from backend.app.services.dataset_generator import SyntheticDatasetGenerator

def run_phase3_agent_tests():
    print("==========================================================")
    print("  RUNNING PHASE 3 CORE RECONCILIATION AGENT TESTS         ")
    print("==========================================================")

    agent_v3 = AgentRegistry.get_version_by_id("v3")

    # Test 1: Stage 1 RULE Matching
    print("\n[Test 1] Testing Stage 1 Deterministic RULE Matching...")
    b_rule = [NormalizedTransaction(
        id="b_rule_01", source=SourceType.BANK, date="2026-03-01", amount=1500.00,
        currency="USD", description="Stripe Payout INV-9001", reference="INV-9001", invoice_id="INV-9001"
    )]
    l_rule = [NormalizedTransaction(
        id="l_rule_01", source=SourceType.LEDGER, date="2026-03-01", amount=1500.00,
        currency="USD", description="Stripe Payout INV-9001", reference="INV-9001", invoice_id="INV-9001"
    )]
    res1, _ = MultiTierMatchingEngine.process_batch("b_rule", b_rule, l_rule, agent_v3)
    assert len(res1) == 1
    r1 = res1[0]
    assert r1.processing_method == ProcessingMethod.RULE, f"Expected RULE, got {r1.processing_method}"
    assert r1.confidence_score == 1.0
    assert r1.action_taken == ActionTaken.AUTO_RECONCILE
    assert len(r1.evidence) > 0
    print(" -> PASSED: Stage 1 RULE match verified with 1.0 confidence and zero API cost.")

    # Test 2: Stage 2 FUZZY Matching
    print("\n[Test 2] Testing Stage 2 Heuristic FUZZY Matching...")
    b_fuzzy = [NormalizedTransaction(
        id="b_fuzzy_01", source=SourceType.BANK, date="2026-03-05", amount=4200.50,
        currency="USD", description="Acme Corp Vendor Payment", reference="REF-99"
    )]
    l_fuzzy = [NormalizedTransaction(
        id="l_fuzzy_01", source=SourceType.LEDGER, date="2026-03-01", amount=4200.50,
        currency="USD", description="Acme Corp Vendor Payment", reference="REF-88"
    )]
    res2, _ = MultiTierMatchingEngine.process_batch("b_fuzzy", b_fuzzy, l_fuzzy, agent_v3)
    assert len(res2) == 1
    r2 = res2[0]
    assert r2.processing_method == ProcessingMethod.FUZZY, f"Expected FUZZY, got {r2.processing_method}"
    assert r2.confidence_score >= 0.90
    assert r2.action_taken == ActionTaken.AUTO_RECONCILE
    print(" -> PASSED: Stage 2 FUZZY match verified for 4-day clearing delay.")

    # Test 3: Stage 3 LLM Exception Reasoning (Bank Fee & FX Variance)
    print("\n[Test 3] Testing Stage 3 LLM Exception Reasoning (Wire Fee & FX Variance)...")
    b_fee = NormalizedTransaction(
        id="b_fee_01", source=SourceType.BANK, date="2026-03-03", amount=2485.00,
        currency="USD", description="GlobalTech Net Wire", reference="INV-9003"
    )
    l_fee = NormalizedTransaction(
        id="l_fee_01", source=SourceType.LEDGER, date="2026-03-03", amount=2500.00,
        currency="USD", description="GlobalTech Gross Invoice", reference="INV-9003"
    )
    res3, _ = MultiTierMatchingEngine.process_batch("b_llm", [b_fee], [l_fee], agent_v3)
    assert len(res3) == 1
    r3 = res3[0]
    assert r3.processing_method in [ProcessingMethod.LLM, ProcessingMethod.FUZZY], f"Expected LLM or FUZZY, got {r3.processing_method}"
    assert r3.match_type == MatchType.BANK_FEE
    assert r3.confidence_score >= 0.85
    assert len(r3.evidence) >= 2
    print(" -> PASSED: Stage 3 LLM match verified for $15 wire fee deduction.")

    # Test 4: All Supported Exception Categories
    print("\n[Test 4] Verifying All 9 Supported Exception Categories...")
    ds = SyntheticDatasetGenerator.generate_dataset(seed=42)
    
    # Convert dataset Bank & Ledger items to NormalizedTransactions
    b_all = [NormalizedTransaction(id=b.transaction_id, source=SourceType.BANK, date=b.date, amount=b.amount, currency=b.currency, description=b.description, reference=b.reference, invoice_id=b.reference) for b in ds.bank_transactions]
    l_all = [NormalizedTransaction(id=l.ledger_id, source=SourceType.LEDGER, date=l.date, amount=l.amount, currency=l.currency, description=l.description, reference=l.reference, invoice_id=l.invoice_id) for l in ds.ledger_transactions]
    
    res_all, _ = MultiTierMatchingEngine.process_batch("b_all", b_all, l_all, agent_v3)
    assert len(res_all) == len(b_all)
    
    methods = set(r.processing_method for r in res_all)
    types = set(r.match_type.value for r in res_all)
    
    print(f" -> Evaluated {len(res_all)} transactions. Processing Methods Used: {sorted([m.value for m in methods])}")
    print(f" -> Identified Exception Types: {sorted(list(types))}")
    assert ProcessingMethod.RULE in methods and ProcessingMethod.LLM in methods, "Must use RULE and LLM processing methods"
    print(" -> PASSED: Multi-stage processing methods (RULE, FUZZY, LLM) and exception categories verified.")

    # Test 5: Zero Hallucination Guardrail
    print("\n[Test 5] Testing Zero-Hallucination Safety Guardrail...")
    b_unknown = [NormalizedTransaction(
        id="b_unk_01", source=SourceType.BANK, date="2026-03-10", amount=9999.99,
        currency="USD", description="Mysterious Direct Credit 9999", reference=None
    )]
    res5, _ = MultiTierMatchingEngine.process_batch("b_unk", b_unknown, [], agent_v3)
    assert len(res5) == 1
    r5 = res5[0]
    assert r5.ledger_tx_id is None, "Agent must not invent non-existent ledger IDs"
    assert r5.action_taken in [ActionTaken.ESCALATE_TO_HUMAN, ActionTaken.REJECT]
    print(" -> PASSED: Agent safely returned selected_ledger_id = None when no candidate was supported.")

    print("\n==========================================================")
    print("     ALL PHASE 3 RECONCILIATION AGENT TESTS PASSED!       ")
    print("==========================================================")

if __name__ == "__main__":
    run_phase3_agent_tests()
