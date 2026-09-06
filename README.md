# 📘 LedgerForge

## 🎯 Quick Overview

**LedgerForge** (a.k.a. *LedgerMind*) is an **autonomous AI‑powered bank reconciliation platform**.  It matches bank statements to ledger entries, escalates ambiguous cases to a human, and continuously improves itself via a self‑engineering loop.

> **Core principle:** *"Knows when to stop and ask."* – the system never forces an auto‑reconcile when there is any financial risk.

![LedgerForge Landing Page](./frontend/public/assets/landing_page.png)

---

## 🛠️ Tech Stack

| Layer | Technologies |
|------|---------------|
| **Backend** | FastAPI, SQLAlchemy, Pydantic, LiteLLM (OpenAI GPT‑4o‑mini), Pandas |
| **Frontend** | React 18, Vite, Tailwind CSS, Supabase‑JS |
| **Database** | Supabase (PostgreSQL + RLS) – falls back to SQLite for local dev |
| **Infrastructure** | Docker (optional), GitHub CI/CD |

---

## ✨ What It Does

- **Multi‑tier matching** – exact rule‑based → fuzzy similarity → LLM fallback.
- **Decision engine** – configurable policy checks (confidence, evidence count, exception type) plus hard safety overrides (amount variance, duplicates, ambiguity).
- **Human‑in‑the‑loop** – escalated exceptions appear in a clean UI for review.
- **Self‑improving agent loop** – benchmarks, autopsy, and automatic generation of a new agent version.
- **Full audit trail** – every decision, evidence, and policy check is stored immutably.

---

## 📂 Project Layout

```
ledgerMind/
├─ backend/          # FastAPI service
│  ├─ app/
│  │  ├─ api/        # HTTP endpoints
│  │  ├─ core/       # DB & utilities
│  │  ├─ models/     # Pydantic & SQLAlchemy models
│  │  └─ services/   # Matching, decision, LLM, engineer, etc.
│  └─ tests/        # Pytest suite
├─ frontend/         # React UI (Vite)
│  ├─ src/          # Components & pages
│  └─ public/assets # Images (incl. landing_page.png)
└─ supabase/        # DB schema & seed data
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+**
- **Node 18+**
- OpenAI API key
- Supabase project (or use the bundled SQLite for quick start)

### 1. Clone the repo
```bash
git clone https://github.com/MDMOINAKHTARR/LedgerForge.git
cd LedgerForge
```

### 2. Backend
```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit the values (DB, OpenAI key, etc.)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Visit **http://localhost:8000/docs** for API docs.

### 3. Frontend
```bash
cd ../frontend
npm install
cp .env.example .env   # set Supabase URL & anon key
npm run dev
```
The UI runs at **http://localhost:5173**.

### 4. Database (Supabase)
Run the migration script in the Supabase SQL editor:
```sql
-- supabase/migrations/20260905000000_initial_schema.sql
```
Optionally load `supabase/seed.sql` for sample data.

---

## 📡 API Reference (excerpt)
Base URL: `http://localhost:8000/api/v1`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/ingest/bank` | Upload bank‑statement CSV |
| `POST` | `/ingest/ledger` | Upload ledger CSV |
| `POST` | `/reconcile/run` | Execute the full reconciliation pipeline |
| `GET`  | `/exceptions/queue` | List items awaiting human review |
| `POST` | `/exceptions/{id}/resolve` | Resolve an escalated exception |
| `GET`  | `/agents/versions` | Show all agent versions |
| `GET`  | `/evals/leaderboard` | Agent performance leaderboard |
| `POST` | `/agent-engineer/run` | Trigger the self‑improvement loop |
| `GET`  | `/audit/trail` | Full immutable audit log |
| `POST` | `/pipeline/run` | Run end‑to‑end pipeline (demo) |

Full interactive docs are available at **/docs**.

---

## ⚙️ Decision Engine Details
The engine applies **four** checks to every match proposal:
1. **Minimum evidence** – at least `N` supporting evidence items.
2. **Confidence threshold** – must meet the policy‑defined confidence (default 90 %).
3. **Allowed exception type** – only pre‑approved exception categories can auto‑reconcile.
4. **Hard safety overrides** (non‑negotiable):
   - Amount variance > $0.05
   - Duplicate transaction detection
   - Ambiguity (top two candidates within 5 % confidence)
   - Financial exceptions such as partial payment, over‑payment, missing invoice

If any check fails the system **ESCALATES TO HUMAN** with a clear explanation; otherwise it **AUTO‑RECONCILES**. Unmatched transactions are **REJECTED**.

---

## 🤖 Self‑Improvement Loop (Agent Engineer)
1. Run the current agent (V1) on a synthetic dataset.
2. Compute key metrics (accuracy, straight‑through‑rate, false‑auto‑post, latency).
3. Autopsy failures to identify root causes.
4. Generate a new agent spec (V2) – updated thresholds, prompts, matching rules.
5. Benchmark V2 on the same dataset.
6. Promote the better version to the leaderboard.
7. Repeat → V3, V4 …

---

## 🧪 Running Tests
```bash
pytest backend/tests/ -v          # all tests
pytest backend/tests/test_reconciliation_pipeline.py -v   # specific suite
```

---

## 📄 License
MIT – see the [LICENSE](LICENSE) file.

---

<div align="center">
Built with ❤️ by [MDMOINAKHTARR](https://github.com/MDMOINAKHTARR)
</div>
