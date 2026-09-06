import sys
import types
from pathlib import Path

# Ensure both the backend root and repo root are in sys.path
backend_dir = Path(__file__).resolve().parent
repo_dir = backend_dir.parent

for directory in [str(repo_dir), str(backend_dir)]:
    if directory not in sys.path:
        sys.path.insert(0, directory)

# When packaged in Vercel serverless Lambda from root: 'backend',
# repo_dir does not exist. Guarantee 'backend' package exists in sys.modules.
if "backend" not in sys.modules:
    try:
        import backend  # type: ignore
    except ImportError:
        backend_pkg = types.ModuleType("backend")
        backend_pkg.__path__ = [str(backend_dir)]
        backend_pkg.__file__ = str(backend_dir / "__init__.py")
        sys.modules["backend"] = backend_pkg

from backend.app.main import app

# Vercel entrypoint handler
__all__ = ["app"]
