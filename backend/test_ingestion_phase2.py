import sys
import os
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.models.pydantic_models import SourceType
from backend.app.services.ingestion import DataIngestionService
from backend.app.services.dataset_generator import SyntheticDatasetGenerator

def run_ingestion_tests():
    print("==========================================================")
    print("  RUNNING PHASE 2 DATA INGESTION & NORMALIZATION TESTS   ")
    print("==========================================================")

    # Test 1: Heterogeneous Column Aliases & Custom Headers
    print("\n[Test 1] Testing Heterogeneous Column Name Mapping...")
    bank_csv = b'txn_date,txn_amount,curr,details,ref_id\n2026-03-01,"$1,500.00",USD,"Stripe Payout",INV-9001'
    ledger_csv = b'transaction_date,total,currency,memo,invoice_number,vendor\n03/01/2026,1500.00,USD,"Stripe Payout",INV-9001,"Stripe Payments Inc"'
    
    ingest_res = DataIngestionService.ingest_files(bank_csv, ledger_csv, "batch_test_01")
    assert len(ingest_res.bank_transactions) == 1, "Bank transaction count failed"
    assert len(ingest_res.ledger_transactions) == 1, "Ledger transaction count failed"
    
    b_tx = ingest_res.bank_transactions[0]
    l_tx = ingest_res.ledger_transactions[0]
    
    assert b_tx.amount == 1500.00, "Bank amount sanitization failed"
    assert l_tx.amount == 1500.00, "Ledger amount sanitization failed"
    assert b_tx.date == "2026-03-01", "Bank date normalization failed"
    assert l_tx.date == "2026-03-01", "Ledger date normalization failed"
    assert b_tx.reference == "INV-9001", "Bank reference parsing failed"
    assert l_tx.invoice_id == "INV-9001", "Ledger invoice_id parsing failed"
    print(" -> PASSED: Heterogeneous column mapping & normalization verified.")

    # Test 2: Messy Date Formats
    print("\n[Test 2] Testing Messy Date Format Normalization...")
    dates_csv = (
        b"date,amount,description\n"
        b"2026-03-01,$100.00,ISO Date\n"
        b"03/15/2026,$200.00,US Date\n"
        b"01-Mar-2026,$300.00,Abbrev Month Date\n"
        b"2026.03.20,$400.00,Dot Date\n"
        b"2026-03-25T14:30:00Z,$500.00,ISO Timestamp"
    )
    res_dates = DataIngestionService.parse_and_normalize_csv(dates_csv, SourceType.BANK, "b_dates")
    valid_dates = res_dates["valid"]
    assert len(valid_dates) == 5, f"Expected 5 valid dates, got {len(valid_dates)}"
    assert valid_dates[0].date == "2026-03-01"
    assert valid_dates[1].date == "2026-03-15"
    assert valid_dates[2].date == "2026-03-01"
    assert valid_dates[3].date == "2026-03-20"
    assert valid_dates[4].date == "2026-03-25"
    print(" -> PASSED: ISO, US, Abbrev, Dot, and Timestamp dates normalized to YYYY-MM-DD.")

    # Test 3: Currency Symbols, Accounting Parentheses, and Debit/Credit Split
    print("\n[Test 3] Testing Currency Symbols & Debit/Credit Split Math...")
    math_csv = (
        b"date,description,paid_out,paid_in,currency\n"
        b'2026-03-01,Wire Out,"$2,500.00",,USD\n'
        b'2026-03-02,Client Deposit,,"EUR 1,085.50",EUR\n'
        b'2026-03-03,Fee Deduction,"(45.00)",,USD'
    )
    res_math = DataIngestionService.parse_and_normalize_csv(math_csv, SourceType.BANK, "b_math")
    valid_math = res_math["valid"]
    assert len(valid_math) == 3
    assert valid_math[0].amount == -2500.00 and valid_math[0].transaction_type == "DR"
    assert valid_math[1].amount == 1085.50 and valid_math[1].currency == "EUR"
    assert valid_math[2].amount == -45.00 and valid_math[2].transaction_type == "DR"
    print(" -> PASSED: Currency symbols, accounting parentheses, and Debit/Credit splits sanitized.")

    # Test 4: Malformed Row Handling & Non-Silent Error Segregation
    print("\n[Test 4] Testing Malformed Row Segregation & Non-Silent Error Logging...")
    malformed_csv = (
        b"date,amount,description\n"
        b"2026-03-01,150.00,Valid Row 1\n"
        b"INVALID_DATE,250.00,Invalid Date Row\n"
        b"2026-03-03,NOT_AN_AMOUNT,Invalid Amount Row\n"
        b"2026-03-04,350.00,Valid Row 2"
    )
    res_malformed = DataIngestionService.parse_and_normalize_csv(malformed_csv, SourceType.BANK, "b_malformed")
    assert len(res_malformed["valid"]) == 2, "Valid row count mismatch"
    assert len(res_malformed["invalid"]) == 2, "Invalid row count mismatch"
    assert len(res_malformed["errors"]) == 2, "Error count mismatch"
    
    err1 = res_malformed["errors"][0]
    err2 = res_malformed["errors"][1]
    assert err1.row_index == 1 and "date" in err1.error_message.lower()
    assert err2.row_index == 2 and "amount" in err2.error_message.lower()
    print(" -> PASSED: Malformed rows captured and logged without silent data loss.")

    # Test 5: Ingest Phase 1 Synthetic Dataset
    print("\n[Test 5] Ingesting Phase 1 Synthetic Dataset CSVs...")
    ds = SyntheticDatasetGenerator.generate_dataset(seed=42)
    
    # Export bank and ledger to CSV bytes
    import pandas as pd
    bank_df = pd.DataFrame([b.model_dump() for b in ds.bank_transactions])
    ledger_df = pd.DataFrame([l.model_dump() for l in ds.ledger_transactions])
    
    bank_bytes = bank_df.to_csv(index=False).encode('utf-8')
    ledger_bytes = ledger_df.to_csv(index=False).encode('utf-8')
    
    res_synth = DataIngestionService.ingest_files(bank_bytes, ledger_bytes, "batch_phase1")
    assert res_synth.statistics.bank_valid == len(ds.bank_transactions)
    assert res_synth.statistics.ledger_valid == len(ds.ledger_transactions)
    assert res_synth.statistics.bank_invalid == 0
    assert res_synth.statistics.ledger_invalid == 0
    print(f" -> PASSED: Successfully ingested {res_synth.statistics.bank_valid} Bank & {res_synth.statistics.ledger_valid} Ledger transactions.")

    print("\n==========================================================")
    print("     ALL PHASE 2 DATA INGESTION TESTS PASSED!            ")
    print("==========================================================")

if __name__ == "__main__":
    run_ingestion_tests()
