import requests
import json
import sys

BANK_CSV_PATH = r"c:\Users\Moin\Downloads\projects\ledgerMind\backend\tests\test_reconciliation_accuracy_audit.py"
# Let's get the benchmark CSVs directly from backend
from backend.tests.test_reconciliation_accuracy_audit import BENCHMARK_BANK_CSV, BENCHMARK_LEDGER_CSV

files = {
    'bank_file': ('synthetic_bank_transactions.csv', BENCHMARK_BANK_CSV, 'text/csv'),
    'ledger_file': ('synthetic_company_ledger.csv', BENCHMARK_LEDGER_CSV, 'text/csv')
}
data = {
    'agent_version_id': 'v3'
}

resp = requests.post('http://127.0.0.1:8000/api/v1/reconcile/upload', files=files, data=data)
print("Status:", resp.status_code)
if resp.status_code != 200:
    print(resp.text)
    sys.exit(1)

batch = resp.json()
print("Batch ID:", batch.get("id"))
print("Total bank:", batch.get("total_bank_tx"))
print("Auto reconciled:", batch.get("auto_reconciled_count"))
print("Escalated:", batch.get("escalated_count"))
print("Rejected:", batch.get("rejected_count"))

results = batch.get("results", [])
print(f"\nTotal results: {len(results)}")

# Find B016 specifically
b016 = next((r for r in results if r.get("bank_tx_id") == "B016" or (r.get("bank_tx") and r["bank_tx"].get("id") == "B016")), None)
print("\n--- B016 LUMEN LABS RAW API OBJECT ---")
print(json.dumps(b016, indent=2))

# Find B018 specifically
b018 = next((r for r in results if r.get("bank_tx_id") == "B018" or (r.get("bank_tx") and r["bank_tx"].get("id") == "B018")), None)
print("\n--- B018 PIXEL PRINTS RAW API OBJECT ---")
print(json.dumps(b018, indent=2))

# Find B015 specifically
b015 = next((r for r in results if r.get("bank_tx_id") == "B015" or (r.get("bank_tx") and r["bank_tx"].get("id") == "B015")), None)
print("\n--- B015 GREENMART DUPLICATE RAW API OBJECT ---")
print(json.dumps(b015, indent=2))
