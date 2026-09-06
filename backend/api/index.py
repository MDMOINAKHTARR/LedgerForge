import sys
import os
from pathlib import Path

# Ensure both the backend root and repo root are in sys.path
current_file = Path(__file__).resolve()
backend_dir = current_file.parent.parent  # backend/
repo_dir = backend_dir.parent             # repo root

for directory in [str(repo_dir), str(backend_dir)]:
    if directory not in sys.path:
        sys.path.insert(0, directory)

from backend.app.main import app

# Expose app for Vercel serverless ASGI handler
