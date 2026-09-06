import sqlite3
import json
import pandas as pd

conn = sqlite3.connect('ledgermind.db')
cur = conn.cursor()
cur.execute("SELECT source, raw_data FROM transactions WHERE batch_id='batch_b53be9d4'")
rows = cur.fetchall()

bank_rows = []
ledger_rows = []

for r in rows:
    raw = json.loads(r[1])
    if 'raw' in raw:
        item = raw['raw']
    else:
        item = raw
    if r[0] == 'BANK':
        bank_rows.append(item)
    else:
        ledger_rows.append(item)

df_bank = pd.DataFrame(bank_rows)
df_ledger = pd.DataFrame(ledger_rows)

print("BANK SHAPE:", df_bank.shape)
print("BANK COLS:", df_bank.columns.tolist())
print(df_bank.to_string())

print("\n" + "="*80 + "\n")

print("LEDGER SHAPE:", df_ledger.shape)
print("LEDGER COLS:", df_ledger.columns.tolist())
print(df_ledger.to_string())

# Also let's save these to backend/app/data/synthetic_bank_transactions.csv and synthetic_company_ledger.csv so we have the official regression files!
df_bank.to_csv('backend/app/data/synthetic_bank_transactions.csv', index=False)
df_ledger.to_csv('backend/app/data/synthetic_company_ledger.csv', index=False)
print("\nSaved synthetic CSVs to backend/app/data/ for regression testing!")
