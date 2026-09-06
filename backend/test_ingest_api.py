import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.main import app
from backend.app.services.dataset_generator import SyntheticDatasetGenerator
import pandas as pd

def test_ingest_api():
    print("\n[Test API] Testing POST /api/v1/ingest Endpoint...")
    client = TestClient(app)
    
    ds = SyntheticDatasetGenerator.generate_dataset(seed=42)
    bank_csv = pd.DataFrame([b.model_dump() for b in ds.bank_transactions]).to_csv(index=False)
    ledger_csv = pd.DataFrame([l.model_dump() for l in ds.ledger_transactions]).to_csv(index=False)
    
    response = client.post(
        "/api/v1/ingest",
        files={
            "bank_file": ("bank.csv", bank_csv.encode("utf-8"), "text/csv"),
            "ledger_file": ("ledger.csv", ledger_csv.encode("utf-8"), "text/csv")
        }
    )
    
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    
    assert "bank_transactions" in data
    assert "ledger_transactions" in data
    assert "statistics" in data
    assert "errors" in data
    
    stats = data["statistics"]
    assert stats["bank_valid"] == len(ds.bank_transactions)
    assert stats["ledger_valid"] == len(ds.ledger_transactions)
    
    print(" -> PASSED: POST /api/v1/ingest returned clean JSON response matching API contract!")
    print(f" -> Statistics: {data['statistics']}")

if __name__ == "__main__":
    test_ingest_api()
