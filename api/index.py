# Vercel serverless entry point: exposes the same FastAPI app as main.py.
# Vercel routes /api/* here (see vercel.json); the React UI is served as static files.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # make main.py / agent.py importable

from main import app  # noqa: E402,F401
