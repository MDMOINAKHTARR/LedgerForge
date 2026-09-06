import sys
from pathlib import Path

# Ensure repo and backend root are in sys.path for Vercel and container runtimes
_current = Path(__file__).resolve()
_backend_root = _current.parents[1]  # backend/
_repo_root = _backend_root.parent    # repo root
for _p in [str(_repo_root), str(_backend_root)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
env_path = Path(__file__).resolve().parents[1] / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

from backend.app.core.database import Base, engine
from backend.app.api.router import api_router

# Initialize database tables safely
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    import logging
    logging.warning(f"Could not initialize tables at startup: {e}")

app = FastAPI(
    title="LedgerMind - Autonomous Bank Reconciliation Agent API",
    version="2.0.0",
    description="Autonomous Agentic Bank Reconciliation System featuring Agent Engineering Loop (V1 -> V2 -> V3 self-improvement)."
)

# CORS configuration for React frontend (supports localhost, *.vercel.app, and custom domains)
import os
import re

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env.strip():
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="/v1")

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "LedgerMind Autonomous Bank Reconciliation Agent",
        "principle": "Knows when to stop and ask",
        "version": "2.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
