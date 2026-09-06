from pathlib import Path
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

# Initialize SQLite database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LedgerMind - Autonomous Bank Reconciliation Agent API",
    version="2.0.0",
    description="Autonomous Agentic Bank Reconciliation System featuring Agent Engineering Loop (V1 -> V2 -> V3 self-improvement)."
)

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")

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
