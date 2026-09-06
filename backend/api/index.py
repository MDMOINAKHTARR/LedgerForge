import sys
import types
from pathlib import Path

current_file = Path(__file__).resolve()
backend_dir = current_file.parent.parent  # backend/
repo_dir = backend_dir.parent             # repo root

for directory in [str(repo_dir), str(backend_dir)]:
    if directory not in sys.path:
        sys.path.insert(0, directory)

if "backend" not in sys.modules:
    try:
        import backend  # type: ignore
    except ImportError:
        backend_pkg = types.ModuleType("backend")
        backend_pkg.__path__ = [str(backend_dir)]
        backend_pkg.__file__ = str(backend_dir / "__init__.py")
        sys.modules["backend"] = backend_pkg

from backend.app.main import app

__all__ = ["app"]
