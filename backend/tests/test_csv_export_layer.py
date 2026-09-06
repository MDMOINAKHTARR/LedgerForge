"""
Test suite for the CSV/export layer of the reconciliation pipeline.
Tests the exact classes of bugs that have been reported:
  1. Matched records with amount variance (B016 - AMOUNT_VARIANCE)
  2. Partial payments (B018 - PARTIAL_PAYMENT)
  3. Bank-side missing ledger records (B020+ - MISSING_IN_LEDGER)
  4. Ledger-only records (MISSING_IN_BANK)
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

from backend.app.services.ingestion import DataIngestionService
from backend.app.services.matching_engine import MultiTierMatchingEngine
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.report_service import CanonicalReportService
from backend.app.models.pydantic_models import (
    ReconciliationResultSchema, NormalizedTransaction, SourceType
)

BANK_CSV = b"""bank_transaction_id,transaction_date,value_date,amount,currency,direction,bank_description,reference,bank_account
B016,2026-09-14,2026-09-14,540,USD,CREDIT,WIRE CREDIT LUMEN LABS INV-2008,INV-2008,HDFC-USD-01
B018,2026-09-16,2026-09-16,2750,INR,CREDIT,UPI CREDIT PIXEL PRINTS INV-2010,INV-2010,HDFC-001
B020,2026-09-18,2026-09-18,4800,INR,CREDIT,NEFT UNKNOWN CUSTOMER PAYMENT,UNKNOWN-001,HDFC-001
B021,2026-09-19,2026-09-19,6100,INR,DEBIT,NEFT PAYMENT VERTEX SUPPLIES,VERTEX-77,HDFC-001
"""

LEDGER_CSV = b"""ledger_id,document_id,document_date,posting_date,counterparty,amount,currency,direction,payment_reference,status
L015,INV-2008,2026-09-01,2026-09-14,Lumen Labs,550,USD,CREDIT,INV-2008,Open
L017,INV-2010,2026-09-06,2026-09-16,Pixel Prints,5000,INR,CREDIT,INV-2010,Partially Paid
L019,INV-2011,2026-09-10,2026-09-20,BluePeak Consulting,9200,INR,CREDIT,INV-2011,Open
L020,BILL-SKYNET-SEP,2026-09-05,2026-09-22,Skynet Hosting,-3900,INR,DEBIT,SKYNET-SEP,Paid
"""


def _build(batch_id="test_export"):
    agent = AgentRegistry.get_version_by_id("v3")
    bank_txs = DataIngestionService.parse_csv_content(BANK_CSV, SourceType.BANK, batch_id)
    ledger_txs = DataIngestionService.parse_csv_content(LEDGER_CSV, SourceType.LEDGER, batch_id)
    results, _ = MultiTierMatchingEngine.process_batch(batch_id, bank_txs, ledger_txs, agent)
    summary = CanonicalReportService.generate_canonical_summary(batch_id, bank_txs, ledger_txs, results)
    return results, summary, bank_txs, ledger_txs


def _rec(summary, bank_id):
    for r in summary["comparison_records"]:
        if r["bank_id"] == bank_id:
            return r
    return None


# ============================================================================
# Group 1: Amount variance (B016: bank=$540 USD, ledger=$550 USD, diff=$10)
# ============================================================================

def test_amount_variance_reconciliation_status():
    _, s, _, _ = _build()
    r = _rec(s, "B016")
    assert r is not None, "B016 not in comparison_records"
    assert r["reconciliation_status"] == "HUMAN_REVIEW", f"Got {r['reconciliation_status']}"


def test_amount_variance_exception_type():
    _, s, _, _ = _build()
    r = _rec(s, "B016")
    assert r is not None
    assert "AMOUNT_VARIANCE" in r["exception_type"], f"Got '{r['exception_type']}'"
    assert "UNMATCHED" not in r["exception_type"], f"Must not be UNMATCHED: '{r['exception_type']}'"


def test_amount_variance_bank_amount():
    _, s, _, _ = _build()
    r = _rec(s, "B016")
    assert r is not None
    assert r["bank_amount"] == 540.0, f"Expected 540.0 got {r['bank_amount']}"


def test_amount_variance_ledger_amount():
    _, s, _, _ = _build()
    r = _rec(s, "B016")
    assert r is not None
    assert r["ledger_amount"] == 550.0, f"Expected 550.0 got {r['ledger_amount']}"


def test_amount_variance_variance_field_is_10():
    _, s, _, _ = _build()
    r = _rec(s, "B016")
    assert r is not None
    assert r["variance"] is not None, "Variance must not be None"
    assert r["variance"] == 10.0, f"Expected 10.0 got {r['variance']}"


def test_amount_variance_formatted_contains_10_and_usd():
    _, s, _, _ = _build()
    r = _rec(s, "B016")
    assert r is not None
    vf = r["variance_formatted"]
    assert vf != "N/A", "variance_formatted must not be N/A"
    assert "10" in vf, f"Expected '10' in variance_formatted, got '{vf}'"
    assert "USD" in vf, f"Expected 'USD' in variance_formatted, got '{vf}'"


def test_amount_variance_csv_row_variance_column():
    _, s, _, _ = _build()
    csv = CanonicalReportService.generate_csv_report(s)
    b016_rows = [line for line in csv.split("\n") if '"B016"' in line]
    assert b016_rows, "B016 not in CSV"
    row = b016_rows[0]
    cols = [c.strip('"') for c in row.split('","')]
    variance_col = cols[9] if len(cols) > 9 else ""
    assert "10" in variance_col, f"Expected '10' in variance col, full row: {row[:200]}"
    assert "USD" in variance_col, f"Expected 'USD' in variance col: '{variance_col}'"


# ============================================================================
# Group 2: Partial payment (B018: bank=INR2750, ledger=INR5000, diff=INR2250)
# ============================================================================

def test_partial_payment_status():
    _, s, _, _ = _build()
    r = _rec(s, "B018")
    assert r is not None, "B018 not found"
    assert r["reconciliation_status"] == "HUMAN_REVIEW", f"Got {r['reconciliation_status']}"


def test_partial_payment_exception_type():
    _, s, _, _ = _build()
    r = _rec(s, "B018")
    assert r is not None
    assert "PARTIAL_PAYMENT" in r["exception_type"], f"Got '{r['exception_type']}'"


def test_partial_payment_variance_is_2250():
    _, s, _, _ = _build()
    r = _rec(s, "B018")
    assert r is not None
    assert r["variance"] is not None, "Variance must not be None for PARTIAL_PAYMENT"
    assert r["variance"] == 2250.0, f"Expected 2250.0 got {r['variance']}"


def test_partial_payment_formatted_contains_inr():
    _, s, _, _ = _build()
    r = _rec(s, "B018")
    assert r is not None
    vf = r["variance_formatted"]
    assert vf != "N/A", "variance_formatted must not be N/A for PARTIAL_PAYMENT"
    # Accept 2250 or 2,250 (locale-formatted)
    stripped = vf.replace(",", "")
    assert "2250" in stripped, f"Expected '2250' in variance_formatted, got '{vf}'"
    assert "INR" in vf, f"Expected 'INR' in variance_formatted, got '{vf}'"


def test_partial_payment_csv_row_variance_column():
    _, s, _, _ = _build()
    csv = CanonicalReportService.generate_csv_report(s)
    rows = [line for line in csv.split("\n") if '"B018"' in line]
    assert rows, "B018 not in CSV"
    cols = [c.strip('"') for c in rows[0].split('","')]
    variance_col = cols[9] if len(cols) > 9 else ""
    assert "INR" in variance_col, f"Expected 'INR' in variance col: '{variance_col}'"


# ============================================================================
# Group 3: Bank-side UNMATCHED -> MISSING_IN_LEDGER
# ============================================================================

def test_unmatched_status():
    _, s, _, _ = _build()
    r = _rec(s, "B020")
    assert r is not None, "B020 not found"
    assert r["reconciliation_status"] == "UNMATCHED", f"Got {r['reconciliation_status']}"


def test_unmatched_exception_is_missing_in_ledger_not_unmatched():
    _, s, _, _ = _build()
    r = _rec(s, "B020")
    assert r is not None
    assert r["exception_type"] != "UNMATCHED", "UNMATCHED must never be used as exception_type"
    assert "MISSING_IN_LEDGER" in r["exception_type"], f"Got '{r['exception_type']}'"


def test_unmatched_exception_count_nonzero():
    _, s, _, _ = _build()
    counts = s["exception_counts"]
    assert counts.get("MISSING_IN_LEDGER", 0) > 0, "MISSING_IN_LEDGER count must be > 0"
    assert counts.get("UNMATCHED", 0) == 0, "UNMATCHED must not appear in exception_counts"


def test_unmatched_csv_row_has_missing_in_ledger():
    _, s, _, _ = _build()
    csv = CanonicalReportService.generate_csv_report(s)
    rows = [line for line in csv.split("\n") if '"B020"' in line]
    assert rows, "B020 not in CSV"
    assert "MISSING_IN_LEDGER" in rows[0], f"Expected MISSING_IN_LEDGER in row: {rows[0][:200]}"


def test_unmatched_no_ledger_id():
    _, s, _, _ = _build()
    r = _rec(s, "B020")
    assert r is not None
    assert r["ledger_id"] in ("N/A", None), f"Expected N/A ledger_id, got '{r['ledger_id']}'"


def test_unmatched_variance_is_none():
    _, s, _, _ = _build()
    r = _rec(s, "B020")
    assert r is not None
    assert r["variance"] is None, f"Expected None variance for UNMATCHED, got {r['variance']}"


# ============================================================================
# Group 4: Ledger-only (MISSING_IN_BANK)
# ============================================================================

def test_ledger_only_status_exists():
    _, s, _, _ = _build()
    lo = [r for r in s["comparison_records"] if r["reconciliation_status"] == "LEDGER_ONLY"]
    assert len(lo) > 0, "Expected at least 1 LEDGER_ONLY record"


def test_ledger_only_exception_type_is_missing_in_bank():
    _, s, _, _ = _build()
    lo = [r for r in s["comparison_records"] if r["reconciliation_status"] == "LEDGER_ONLY"]
    for r in lo:
        assert "MISSING_IN_BANK" in r["exception_type"], (
            f"LEDGER_ONLY {r['ledger_id']} must have MISSING_IN_BANK, got '{r['exception_type']}'"
        )
        assert "UNMATCHED" not in r["exception_type"], (
            f"LEDGER_ONLY {r['ledger_id']} must not have UNMATCHED exception"
        )


def test_ledger_only_exception_count():
    _, s, _, _ = _build()
    assert s["exception_counts"].get("MISSING_IN_BANK", 0) > 0, "MISSING_IN_BANK count must be > 0"


def test_ledger_only_bank_id_is_na_in_csv():
    _, s, _, _ = _build()
    csv = CanonicalReportService.generate_csv_report(s)
    for r in s["comparison_records"]:
        if r["reconciliation_status"] == "LEDGER_ONLY":
            lid = r["ledger_id"]
            matching = [line for line in csv.split("\n") if f'"{lid}"' in line and "LEDGER_ONLY" in line]
            assert matching, f"LEDGER_ONLY {lid} not in CSV"
            cols = [c.strip('"') for c in matching[0].split('","')]
            assert cols[0] == "N/A", f"LEDGER_ONLY {lid}: bank_id col must be N/A, got '{cols[0]}'"


# ============================================================================
# Group 5: Branding
# ============================================================================

def test_csv_header_says_ledger_forge():
    _, s, _, _ = _build()
    csv = CanonicalReportService.generate_csv_report(s)
    header = csv.split("\n")[0].upper()
    assert "LEDGER FORGE" in header, f"CSV header must contain 'LEDGER FORGE': {header[:100]}"
    assert "LEDGER MIND" not in header, f"CSV header must not say 'LEDGER MIND': {header[:100]}"


# ============================================================================
# Group 6: Cross-currency safety
# ============================================================================

def test_cross_currency_not_consolidated():
    _, s, _, _ = _build()
    cs = s.get("currency_summaries", {})
    assert "USD" in cs, "USD currency summary must exist"
    assert "INR" in cs, "INR currency summary must exist"
    # Volumes must be separate
    assert cs["USD"]["bank_volume"] != cs["INR"]["bank_volume"], "USD/INR volumes must not be merged"


# ============================================================================
# Group 7: DB reconstruction path
# ============================================================================

def test_db_reconstruction_variance_and_taxonomy():
    """Simulates get_batch() DB reconstruction: variance and MISSING_IN_LEDGER must survive."""
    batch_id = "test_db_recon"
    agent = AgentRegistry.get_version_by_id("v3")
    bank_txs = DataIngestionService.parse_csv_content(BANK_CSV, SourceType.BANK, batch_id)
    ledger_txs = DataIngestionService.parse_csv_content(LEDGER_CSV, SourceType.LEDGER, batch_id)
    results, _ = MultiTierMatchingEngine.process_batch(batch_id, bank_txs, ledger_txs, agent)

    # Simulate DB reconstruction
    results_objs = []
    for r in results:
        b, l = r.bank_tx, r.ledger_tx
        m = (r.match_type.value if hasattr(r.match_type, "value") else str(r.match_type or "")).upper()
        exc = ["MISSING_IN_LEDGER"] if m == "UNMATCHED" else \
              ["MISSING_IN_BANK"] if m == "MISSING_IN_BANK" else \
              [m] if m and m not in ["EXACT", "EXACT_MATCH"] else []
        b_amt = abs(b.amount) if (b and b.amount is not None) else None
        l_amt = abs(l.amount) if (l and l.amount is not None) else None
        r_dict = {
            "id": r.id, "batch_id": batch_id, "agent_version_id": agent.id,
            "bank_tx_id": b.id if b else "N/A",
            "bank_tx": {"id": b.id, "source": "BANK", "date": b.date, "amount": b.amount,
                        "currency": b.currency, "description": b.description,
                        "normalized_amount": abs(b.amount), "metadata": {}} if b else None,
            "ledger_tx_id": l.id if l else None,
            "ledger_tx": {"id": l.id, "source": "LEDGER", "date": l.date, "amount": l.amount,
                          "currency": l.currency, "description": l.description,
                          "normalized_amount": abs(l.amount), "metadata": {}} if l else None,
            "match_type": r.match_type, "confidence_score": r.confidence_score,
            "action_taken": r.action_taken, "reasoning": r.reasoning,
            "discrepancy_details": [], "human_status": "PENDING",
            "bank_amount": b_amt, "bank_currency": b.currency if b else None,
            "ledger_amount": l_amt, "ledger_currency": l.currency if l else None,
            "exception_types": exc,
        }
        obj = ReconciliationResultSchema(**r_dict)
        obj.sync_canonical_fields()
        results_objs.append(obj)

    bank_norm = [NormalizedTransaction(id=t.id, source=SourceType.BANK, date=t.date,
                                       amount=t.amount, normalized_amount=abs(t.amount),
                                       currency=t.currency, description=t.description or "", metadata={})
                 for t in bank_txs]
    ledger_norm = [NormalizedTransaction(id=t.id, source=SourceType.LEDGER, date=t.date,
                                         amount=t.amount, normalized_amount=abs(t.amount),
                                         currency=t.currency, description=t.description or "", metadata={})
                   for t in ledger_txs]

    s = CanonicalReportService.generate_canonical_summary(batch_id, bank_norm, ledger_norm, results_objs)

    r16 = _rec(s, "B016")
    assert r16 is not None, "B016 not in DB-recon summary"
    assert r16["variance"] == 10.0, f"DB recon B016 variance must be 10.0, got {r16['variance']}"
    assert r16["variance_formatted"] != "N/A", "B016 variance_formatted must not be N/A"

    r18 = _rec(s, "B018")
    assert r18 is not None, "B018 not in DB-recon summary"
    assert r18["variance"] == 2250.0, f"DB recon B018 variance must be 2250.0, got {r18['variance']}"

    r20 = _rec(s, "B020")
    assert r20 is not None, "B020 not in DB-recon summary"
    assert "MISSING_IN_LEDGER" in r20["exception_type"], (
        f"DB recon B020 must have MISSING_IN_LEDGER, got '{r20['exception_type']}'"
    )


# ============================================================================
# Runner
# ============================================================================

def run_tests():
    import traceback
    tests = [
        test_amount_variance_reconciliation_status,
        test_amount_variance_exception_type,
        test_amount_variance_bank_amount,
        test_amount_variance_ledger_amount,
        test_amount_variance_variance_field_is_10,
        test_amount_variance_formatted_contains_10_and_usd,
        test_amount_variance_csv_row_variance_column,
        test_partial_payment_status,
        test_partial_payment_exception_type,
        test_partial_payment_variance_is_2250,
        test_partial_payment_formatted_contains_inr,
        test_partial_payment_csv_row_variance_column,
        test_unmatched_status,
        test_unmatched_exception_is_missing_in_ledger_not_unmatched,
        test_unmatched_exception_count_nonzero,
        test_unmatched_csv_row_has_missing_in_ledger,
        test_unmatched_no_ledger_id,
        test_unmatched_variance_is_none,
        test_ledger_only_status_exists,
        test_ledger_only_exception_type_is_missing_in_bank,
        test_ledger_only_exception_count,
        test_ledger_only_bank_id_is_na_in_csv,
        test_csv_header_says_ledger_forge,
        test_cross_currency_not_consolidated,
        test_db_reconstruction_variance_and_taxonomy,
    ]

    print("=" * 60)
    print("CSV/EXPORT LAYER TEST SUITE")
    print("=" * 60)
    passed, failed, failures = 0, 0, []
    for fn in tests:
        try:
            fn()
            print(f"  [PASS] {fn.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  [FAIL] {fn.__name__}: {e}")
            failures.append((fn.__name__, str(e)))
            failed += 1
        except Exception as e:
            print(f"  [ERROR] {fn.__name__}: {e}")
            traceback.print_exc()
            failures.append((fn.__name__, str(e)))
            failed += 1

    print()
    print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
    if failures:
        print("\nFAILURES:")
        for name, msg in failures:
            print(f"  {name}: {msg}")
        return 1
    print("[ALL CSV EXPORT TESTS PASSED]")
    return 0


if __name__ == "__main__":
    sys.exit(run_tests())
