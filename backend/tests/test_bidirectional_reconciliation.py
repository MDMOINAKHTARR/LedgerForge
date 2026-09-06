"""
Bidirectional Reconciliation Integration Test.

Verifies the full BANK->LEDGER and LEDGER->BANK reconciliation output including:
- LEDGER_ONLY entries appear correctly (no disappearing ledger records)
- UNMATCHED bank entries have MISSING_IN_LEDGER exception
- Duplicate detection produces DUPLICATE exception
- Partial payment produces PARTIAL_PAYMENT exception
- Exception types are set authoritatively (not inferred from match_type)
- No ledger-only entry is mis-classified as UNMATCHED
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

from backend.app.services.ingestion import DataIngestionService
from backend.app.services.matching_engine import MultiTierMatchingEngine
from backend.app.services.agent_registry import AgentRegistry
from backend.app.models.pydantic_models import (
    ActionTaken, MatchType, SourceType, ReconciliationStatus
)

# ------------------------------------------------------------------
# Minimal synthetic dataset covering all bidirectional cases
# ------------------------------------------------------------------
BANK_CSV = b"""bank_transaction_id,transaction_date,value_date,amount,currency,direction,bank_description,reference,bank_account
B001,2026-09-01,2026-09-01,12500,INR,CREDIT,NEFT ACME INDUSTRIES INV-2001,INV-2001,HDFC-001
B005,2026-09-04,2026-09-04,6300,INR,CREDIT,NEFT GREENMART PVT LTD INV-2003,INV-2003,HDFC-001
B015,2026-09-04,2026-09-04,6300,INR,CREDIT,NEFT GREENMART PVT LTD INV-2003,INV-2003,HDFC-001
B016,2026-09-14,2026-09-14,540,USD,CREDIT,WIRE CREDIT LUMEN LABS INV-2008,INV-2008,HDFC-USD-01
B018,2026-09-16,2026-09-16,2750,INR,CREDIT,UPI CREDIT PIXEL PRINTS INV-2010,INV-2010,HDFC-001
B020,2026-09-18,2026-09-18,4800,INR,CREDIT,NEFT UNKNOWN CUSTOMER PAYMENT,UNKNOWN-001,HDFC-001
"""

LEDGER_CSV = b"""ledger_id,document_id,document_date,posting_date,counterparty,amount,currency,direction,payment_reference,status
L001,INV-2001,2026-08-20,2026-09-01,Acme Industries,12500,INR,CREDIT,INV-2001,Open
L005,INV-2003,2026-08-28,2026-09-04,GreenMart Pvt Ltd,6300,INR,CREDIT,INV-2003,Open
L015,INV-2008,2026-09-01,2026-09-14,Lumen Labs,550,USD,CREDIT,INV-2008,Open
L017,INV-2010,2026-09-06,2026-09-16,Pixel Prints,5000,INR,CREDIT,INV-2010,Partially Paid
L019,INV-2011,2026-09-10,2026-09-20,BluePeak Consulting,9200,INR,CREDIT,INV-2011,Open
L022,BILL-MAPLE-88,2026-09-14,2026-09-25,Maple Services,-2700,INR,DEBIT,MAPLE-88,Paid
"""


def run_tests():
    batch_id = "test_bidirectional"
    agent = AgentRegistry.get_version_by_id("v3")

    bank_txs = DataIngestionService.parse_csv_content(BANK_CSV, SourceType.BANK, batch_id)
    ledger_txs = DataIngestionService.parse_csv_content(LEDGER_CSV, SourceType.LEDGER, batch_id)

    results, _ = MultiTierMatchingEngine.process_batch(
        batch_id=batch_id,
        bank_txs=bank_txs,
        ledger_txs=ledger_txs,
        agent_version=agent
    )

    by_bank = {r.bank_tx.id: r for r in results if r.bank_tx}
    ledger_only = [r for r in results if r.reconciliation_status == ReconciliationStatus.LEDGER_ONLY]
    unmatched   = [r for r in results if r.reconciliation_status == ReconciliationStatus.UNMATCHED]

    failures = []

    print(f"{'='*60}")
    print("BIDIRECTIONAL RECONCILIATION TEST")
    print(f"{'='*60}")
    print(f"Total results:   {len(results)}")
    print(f"Bank inputs:     {len(bank_txs)}")
    print(f"Ledger inputs:   {len(ledger_txs)}")
    print(f"AUTO_MATCHED:    {sum(1 for r in results if r.reconciliation_status == ReconciliationStatus.AUTO_MATCHED)}")
    print(f"HUMAN_REVIEW:    {sum(1 for r in results if r.reconciliation_status == ReconciliationStatus.HUMAN_REVIEW)}")
    print(f"UNMATCHED:       {len(unmatched)}")
    print(f"LEDGER_ONLY:     {len(ledger_only)}")
    print()

    # ------------------------------------------------------------------
    # Test 1: B001 Acme Industries — exact match -> AUTO_MATCHED
    # ------------------------------------------------------------------
    r = by_bank.get("B001")
    if r and r.reconciliation_status == ReconciliationStatus.AUTO_MATCHED and r.exception_types == []:
        print(f"  [PASS] B001 Acme: AUTO_MATCHED, exception_types=[]")
    else:
        msg = f"  [FAIL] B001 Acme: expected AUTO_MATCHED/[], got {r.reconciliation_status if r else 'MISSING'}/{r.exception_types if r else '?'}"
        failures.append(msg)

    # ------------------------------------------------------------------
    # Test 2: B005 GreenMart — first arrival -> AUTO_MATCHED
    # ------------------------------------------------------------------
    r = by_bank.get("B005")
    if r and r.reconciliation_status == ReconciliationStatus.AUTO_MATCHED:
        print(f"  [PASS] B005 GreenMart: AUTO_MATCHED -> {r.ledger_tx_id}")
    else:
        failures.append(f"  [FAIL] B005 GreenMart: expected AUTO_MATCHED, got {r.reconciliation_status if r else 'MISSING'}")

    # ------------------------------------------------------------------
    # Test 3: B015 GreenMart duplicate -> HUMAN_REVIEW + DUPLICATE exception
    # ------------------------------------------------------------------
    r = by_bank.get("B015")
    if (r and r.reconciliation_status == ReconciliationStatus.HUMAN_REVIEW
            and "DUPLICATE" in (r.exception_types or [])):
        print(f"  [PASS] B015 GreenMart duplicate: HUMAN_REVIEW, exception=DUPLICATE")
    else:
        status = r.reconciliation_status if r else "MISSING"
        exc = r.exception_types if r else "?"
        failures.append(f"  [FAIL] B015 GreenMart: expected HUMAN_REVIEW+DUPLICATE, got {status}/{exc}")

    # ------------------------------------------------------------------
    # Test 4: B016 Lumen Labs $540 vs $550 -> HUMAN_REVIEW + AMOUNT_VARIANCE
    # ------------------------------------------------------------------
    r = by_bank.get("B016")
    if (r and r.reconciliation_status == ReconciliationStatus.HUMAN_REVIEW
            and "AMOUNT_VARIANCE" in (r.exception_types or [])
            and r.ledger_tx_id is not None):
        print(f"  [PASS] B016 Lumen Labs: HUMAN_REVIEW, exception=AMOUNT_VARIANCE, ledger={r.ledger_tx_id}")
    else:
        status = r.reconciliation_status if r else "MISSING"
        exc = r.exception_types if r else "?"
        failures.append(f"  [FAIL] B016 Lumen Labs: expected HUMAN_REVIEW+AMOUNT_VARIANCE, got {status}/{exc}")

    # ------------------------------------------------------------------
    # Test 5: B018 Pixel Prints INR2750 vs INR5000 -> HUMAN_REVIEW + PARTIAL_PAYMENT (NOT UNMATCHED)
    # ------------------------------------------------------------------
    r = by_bank.get("B018")
    if (r and r.reconciliation_status == ReconciliationStatus.HUMAN_REVIEW
            and "PARTIAL_PAYMENT" in (r.exception_types or [])
            and r.ledger_tx_id is not None):
        print(f"  [PASS] B018 Pixel Prints: HUMAN_REVIEW, exception=PARTIAL_PAYMENT, ledger={r.ledger_tx_id}")
    else:
        status = r.reconciliation_status if r else "MISSING"
        exc = r.exception_types if r else "?"
        failures.append(f"  [FAIL] B018 Pixel Prints: expected HUMAN_REVIEW+PARTIAL_PAYMENT (not UNMATCHED), got {status}/{exc}")

    # ------------------------------------------------------------------
    # Test 6: B020 Unknown customer -> UNMATCHED + MISSING_IN_LEDGER exception
    # ------------------------------------------------------------------
    r = by_bank.get("B020")
    if (r and r.reconciliation_status == ReconciliationStatus.UNMATCHED
            and "MISSING_IN_LEDGER" in (r.exception_types or [])):
        print(f"  [PASS] B020 Unknown: UNMATCHED, exception=MISSING_IN_LEDGER")
    else:
        status = r.reconciliation_status if r else "MISSING"
        exc = r.exception_types if r else "?"
        failures.append(f"  [FAIL] B020 Unknown: expected UNMATCHED+MISSING_IN_LEDGER, got {status}/{exc}")

    # ------------------------------------------------------------------
    # Test 7: LEDGER_ONLY — L019 BluePeak and L022 Maple must appear as LEDGER_ONLY
    # (These have no bank transaction, and must NOT disappear from the output)
    # ------------------------------------------------------------------
    ledger_only_ids = {r.ledger_tx_id for r in ledger_only}
    expected_ledger_only = {"L019", "L022"}
    for lid in expected_ledger_only:
        if lid in ledger_only_ids:
            lo_r = next(r for r in ledger_only if r.ledger_tx_id == lid)
            exc = lo_r.exception_types or []
            if "MISSING_IN_BANK" in exc:
                print(f"  [PASS] {lid}: LEDGER_ONLY, exception=MISSING_IN_BANK")
            else:
                failures.append(f"  [FAIL] {lid}: LEDGER_ONLY but exception_types={exc} (expected MISSING_IN_BANK)")
        else:
            failures.append(f"  [FAIL] {lid}: Expected LEDGER_ONLY but not found in results. Ledger-only IDs: {ledger_only_ids}")

    # ------------------------------------------------------------------
    # Test 8: No LEDGER_ONLY record is mis-classified as UNMATCHED
    # ------------------------------------------------------------------
    ledger_only_misclassified = [
        r for r in unmatched
        if r.ledger_tx is not None and r.bank_tx is None
    ]
    if not ledger_only_misclassified:
        print(f"  [PASS] No ledger-only record mis-classified as UNMATCHED")
    else:
        for r in ledger_only_misclassified:
            failures.append(f"  [FAIL] Ledger record {r.ledger_tx_id} mis-classified as UNMATCHED instead of LEDGER_ONLY")

    # ------------------------------------------------------------------
    # Test 9: exception_types are set directly (not empty for records that need them)
    # ------------------------------------------------------------------
    review_records = [r for r in results if r.reconciliation_status == ReconciliationStatus.HUMAN_REVIEW]
    review_with_empty_exc = [r for r in review_records if not r.exception_types]
    if not review_with_empty_exc:
        print(f"  [PASS] All HUMAN_REVIEW records have at least one exception_type")
    else:
        for r in review_with_empty_exc:
            bid = r.bank_tx.id if r.bank_tx else "N/A"
            failures.append(f"  [FAIL] HUMAN_REVIEW record {bid} has empty exception_types")

    # ------------------------------------------------------------------
    # Test 10: False Auto-Match Rate = 0% (safety invariant)
    # ------------------------------------------------------------------
    auto_matched_results = [r for r in results if r.reconciliation_status == ReconciliationStatus.AUTO_MATCHED]
    false_autos = []
    for r in auto_matched_results:
        b_amt = r.bank_tx.normalized_amount if r.bank_tx else 0.0
        l_amt = r.ledger_tx.normalized_amount if r.ledger_tx else 0.0
        if abs(b_amt - l_amt) > 0.05:
            false_autos.append(r)
        elif r.match_type in [MatchType.DUPLICATE, MatchType.PARTIAL_PAYMENT, MatchType.AMOUNT_VARIANCE]:
            false_autos.append(r)
    if not false_autos:
        print(f"  [PASS] False Auto-Match Rate: 0.0% — PERFECT SAFETY")
    else:
        for r in false_autos:
            failures.append(f"  [FAIL] False auto-match: {r.bank_tx_id} -> {r.ledger_tx_id} ({r.match_type})")

    print()
    print(f"{'='*60}")
    if failures:
        print("FAILURES:")
        for f in failures:
            print(f)
        print(f"\n[FAILED] {len(failures)} test(s) FAILED")
        return 1
    else:
        print("[ALL TESTS PASSED] Bidirectional reconciliation functioning correctly.")
        return 0


if __name__ == "__main__":
    sys.exit(run_tests())
