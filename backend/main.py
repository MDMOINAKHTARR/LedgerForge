import sys
import os
from pathlib import Path

# Ensure both the backend root and repo root are in sys.path
backend_dir = Path(__file__).resolve().parent
repo_dir = backend_dir.parent

for directory in [str(repo_dir), str(backend_dir)]:
    if directory not in sys.path:
        sys.path.insert(0, directory)

from backend.app.main import app

# Vercel entrypoint handler
__all__ = ["app"]
