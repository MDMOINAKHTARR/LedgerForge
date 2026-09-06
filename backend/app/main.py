import sys
from pathlib import Path

# Ensure repo and backend root are in sys.path for Vercel and container runtimes
_current = Path(__file__).resolve()
_backend_root = _current.parents[1]  # backend/
_repo_root = _backend_root.parent    # repo root
for _p in [str(_repo_root), str(_backend_root)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.database import Base, engine, ensure_tables_created
from backend.app.api.router import api_router

# Initialize database tables safely
ensure_tables_created()

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
app.include_router(api_router)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging
    import traceback
    logging.error(f"Global unhandled error on {request.url}: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Server Error: {str(exc)}",
            "type": type(exc).__name__,
            "path": str(request.url.path)
        }
    )

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
