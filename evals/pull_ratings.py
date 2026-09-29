"""Fetch users' alert ratings ("good match" / "not right, because …") from Convex production into
evals/data/user_ratings.json, without who gave them. Then: `.venv/bin/python -m evals.report`."""
import json
import subprocess
from pathlib import Path

from evals.common import USER_RATINGS, write

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"


def main():
    out = subprocess.run(["npx", "convex", "run", "--prod", "ratings:exportAll"], cwd=FRONTEND,
                         capture_output=True, text=True, check=True).stdout
    ratings = json.loads(out[out.index("["):])
    write(USER_RATINGS, ratings)
    print(f"wrote {len(ratings)} ratings to {USER_RATINGS}")


if __name__ == "__main__":
    main()
