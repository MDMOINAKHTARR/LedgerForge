import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Load environment variables
env_path = Path(__file__).resolve().parents[2] / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Safe fallback for serverless environments (Vercel, AWS Lambda) where root is read-only
is_serverless = bool(os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"))

if not DATABASE_URL:
    if is_serverless:
        DATABASE_URL = "sqlite:////tmp/ledgermind.db"
    else:
        DATABASE_URL = "sqlite:///./ledgermind.db"
else:
    # If using Supabase / PostgreSQL URI, fix postgres:// -> postgresql://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    # If SQLite URL specified on Vercel points to relative path, redirect to /tmp
    elif is_serverless and DATABASE_URL.startswith("sqlite:///./"):
        DATABASE_URL = "sqlite:////tmp/ledgermind.db"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
