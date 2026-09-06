"""
Integration regression test for the reconciliation pipeline.
Tests against the real synthetic dataset to verify all safety properties.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

from backend.app.services.ingestion import DataIngestionService
from backend.app.services.matching_engine import MultiTierMatchingEngine
from backend.app.services.agent_registry import AgentRegistry
from backend.app.models.pydantic_models import ActionTaken, MatchType, SourceType

BANK_CSV = b"""bank_transaction_id,transaction_date,value_date,amount,currency,direction,bank_description,reference,bank_account
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

LEDGER_CSV = b"""ledger_id,document_id,document_date,posting_date,counterparty,amount,currency,direction,payment_reference,status
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


def run_tests():
    batch_id = "test_batch_regression"
    agent = AgentRegistry.get_version_by_id("v3")

    bank_txs = DataIngestionService.parse_csv_content(BANK_CSV, SourceType.BANK, batch_id)
    ledger_txs = DataIngestionService.parse_csv_content(LEDGER_CSV, SourceType.LEDGER, batch_id)

    print(f"Bank transactions ingested:   {len(bank_txs)}")
    print(f"Ledger transactions ingested: {len(ledger_txs)}")
    print()

    results, traces = MultiTierMatchingEngine.process_batch(
        batch_id=batch_id,
        bank_txs=bank_txs,
        ledger_txs=ledger_txs,
        agent_version=agent
    )

    auto = [r for r in results if r.action_taken == ActionTaken.AUTO_RECONCILE]
    escalated = [r for r in results if r.action_taken == ActionTaken.ESCALATE_TO_HUMAN]
    rejected = [r for r in results if r.action_taken == ActionTaken.REJECT]

    print(f"{'='*60}")
    print(f"RESULTS: {len(results)} total")
    print(f"  Auto-Reconciled:       {len(auto)}")
    print(f"  Human Review:          {len(escalated)}")
    print(f"  Rejected/Unmatched:    {len(rejected)}")
    print(f"{'='*60}")

    print("\n--- AUTO-RECONCILED ---")
    for r in auto:
        b = r.bank_tx
        l = r.ledger_tx
        b_ref = b.reference or b.payment_reference or b.document_id or "?"
        print(f"  {b.id} -> {l.id if l else 'None'} | {r.match_type.value} | conf={r.confidence_score:.2f} | ref={b_ref}")

    print("\n--- HUMAN REVIEW ---")
    for r in escalated:
        b = r.bank_tx
        l = r.ledger_tx
        b_ref = (b.reference or b.payment_reference or b.document_id or "?") if b else "?"
        print(f"  {b.id if b else '?'} -> {l.id if l else 'None'} | {r.match_type.value} | conf={r.confidence_score:.2f} | ref={b_ref}")
        print(f"    Reason: {r.reasoning[:100].encode('ascii', 'replace').decode()}")

    print("\n--- UNMATCHED/REJECTED ---")
    for r in rejected:
        b = r.bank_tx
        b_ref = (b.reference or b.payment_reference or b.document_id or "?") if b else "?"
        print(f"  {b.id if b else '?'} | ref={b_ref}")

    # =========================================================
    # CRITICAL SAFETY CHECKS
    # =========================================================
    print(f"\n{'='*60}")
    print("CRITICAL SAFETY VALIDATION")
    print(f"{'='*60}")

    failures = []

    # 1. GreenMart: B005 auto-reconciles, B015 escalates as DUPLICATE
    b005 = next((r for r in results if r.bank_tx and r.bank_tx.id == "B005"), None)
    b015 = next((r for r in results if r.bank_tx and r.bank_tx.id == "B015"), None)

    if b005 and b005.action_taken == ActionTaken.AUTO_RECONCILE:
        print(f"  [PASS] B005 GreenMart: AUTO_RECONCILE -> {b005.ledger_tx_id}")
    else:
        failures.append(f"  [FAIL] B005 should be AUTO_RECONCILE, got {b005.action_taken if b005 else 'MISSING'}")

    if b015 and b015.action_taken == ActionTaken.ESCALATE_TO_HUMAN and b015.match_type == MatchType.DUPLICATE:
        print(f"  [PASS] B015 GreenMart duplicate: ESCALATE_TO_HUMAN as DUPLICATE")
    else:
        failures.append(f"  [FAIL] B015 should be ESCALATE DUPLICATE, got {b015.action_taken if b015 else 'MISSING'} / {b015.match_type if b015 else '?'}")

    # 2. Lumen Labs Amount Variance: B016 ($540) vs L015 ($550) must NOT auto-reconcile
    b016 = next((r for r in results if r.bank_tx and r.bank_tx.id == "B016"), None)
    if b016 and b016.action_taken == ActionTaken.ESCALATE_TO_HUMAN:
        print(f"  [PASS] B016 Lumen Labs $540 vs $550: ESCALATE_TO_HUMAN as {b016.match_type.value}")
    else:
        failures.append(f"  [FAIL] B016 Lumen Labs should ESCALATE, got {b016.action_taken if b016 else 'MISSING'}")

    # 3. Pixel Prints Partial Payment: B018 vs L017 must ESCALATE PARTIAL_PAYMENT
    b018 = next((r for r in results if r.bank_tx and r.bank_tx.id == "B018"), None)
    if b018 and b018.action_taken == ActionTaken.ESCALATE_TO_HUMAN and b018.match_type == MatchType.PARTIAL_PAYMENT:
        print(f"  [PASS] B018 Pixel Prints partial: ESCALATE_TO_HUMAN as PARTIAL_PAYMENT")
    else:
        failures.append(f"  [FAIL] B018 should be ESCALATE PARTIAL_PAYMENT, got {b018.action_taken if b018 else 'MISSING'} / {b018.match_type if b018 else '?'}")

    # 4. Northstar B017 (1-day timing difference) must AUTO_RECONCILE
    b017 = next((r for r in results if r.bank_tx and r.bank_tx.id == "B017"), None)
    if b017 and b017.action_taken == ActionTaken.AUTO_RECONCILE:
        print(f"  [PASS] B017 Northstar 1-day lag: AUTO_RECONCILE -> {b017.ledger_tx_id}")
    else:
        failures.append(f"  [FAIL] B017 Northstar should AUTO_RECONCILE, got {b017.action_taken if b017 else 'MISSING'}")

    # 5. False Auto-Match Rate MUST be 0.0%
    false_auto_matches = []
    for r in auto:
        b_amt = r.bank_tx.normalized_amount if r.bank_tx else 0.0
        l_amt = r.ledger_tx.normalized_amount if r.ledger_tx else 0.0
        if abs(b_amt - l_amt) > 0.05:
            false_auto_matches.append(r)
        elif r.match_type in [MatchType.DUPLICATE, MatchType.PARTIAL_PAYMENT, MatchType.AMOUNT_VARIANCE]:
            false_auto_matches.append(r)

    false_rate = len(false_auto_matches) / max(1, len(auto)) * 100
    if false_rate == 0.0:
        print(f"  [PASS] False Auto-Match Rate: 0.0% -- PERFECT SAFETY")
    else:
        failures.append(f"  [FAIL] False Auto-Match Rate: {false_rate:.1f}% -- CRITICAL SAFETY VIOLATION")
        for f_r in false_auto_matches:
            failures.append(f"     - {f_r.bank_tx_id} matched {f_r.ledger_tx_id} with {f_r.match_type.value}")

    print()
    if failures:
        print("FAILURES DETECTED:")
        for f in failures:
            print(f)
        print(f"\n[FAILED] {len(failures)} test(s) FAILED")
        return 1
    else:
        print("[ALL TESTS PASSED] Pipeline functioning correctly.")
        return 0


if __name__ == "__main__":
    sys.exit(run_tests())
