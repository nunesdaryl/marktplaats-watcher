"""Read-only status of the weekly feedback, factory, and evaluation loop."""
import json
import os
from pathlib import Path
import subprocess
import sys

import lin

ROOT = Path(__file__).resolve().parents[2]
FACTORY_LABELS = ("agent-ready", "built", "needs-fix", "ready-to-merge", "blocked")


def command(args, cwd=ROOT):
    return subprocess.run(args, cwd=cwd, capture_output=True, text=True, check=True).stdout


def feedback():
    fixture = os.environ.get("LOOP_STATUS_FEEDBACK_JSON")
    if fixture:
        counts = json.loads(Path(fixture).read_text())
        return counts["new"], counts["open"], counts["repliesWaiting"]
    counts = json.loads(command(["npx", "convex", "run", "--prod", "feedback:loopStatus"], ROOT / "frontend"))
    return counts["new"], counts["open"], counts["repliesWaiting"]


def issues():
    fixture = os.environ.get("LOOP_STATUS_ISSUES_JSON")
    if fixture:
        return json.loads(Path(fixture).read_text())
    lin.URL = os.environ.get("LOOP_STATUS_LINEAR_URL", lin.URL)
    rows, cursor = [], None
    while True:
        data = lin.gql('query($after:String){ issues(first:100,after:$after,filter:{team:{key:{eq:"MW"}}}){ nodes { identifier state { type } labels { nodes { name } } } pageInfo { hasNextPage endCursor } } }', {"after": cursor})["issues"]
        rows.extend(data["nodes"])
        if not data["pageInfo"]["hasNextPage"]:
            return rows
        cursor = data["pageInfo"]["endCursor"]
        if not cursor:
            raise ValueError("Linear issue page has no cursor")


def last_merge():
    rows = [line for line in (ROOT / "docs/factory/merges.md").read_text().splitlines() if line.startswith("| 20")]
    if not rows:
        return "none recorded"
    cells = [part.strip().strip("`") for part in rows[-1].strip("|").split("|")]
    return f"{cells[1]} on {cells[0]} ({cells[3][:12]})"


def last_eval():
    runs = []
    for name in ("chat_results.json", "scorer_results.json"):
        path = ROOT / "evals/data" / name
        if path.exists():
            result = json.loads(path.read_text())
            if result.get("run_at"):
                runs.append((result["run_at"], name, result.get("model", "unknown model")))
    if not runs:
        return "none recorded locally"
    at, name, model = max(runs)
    return f"{at} UTC ({name}, {model}; checked-out results)"


def main():
    failed = False
    print("Weekly listening loop status")
    try:
        new, opened, replies = feedback()
        print(f"Feedback: {new} new, {opened} open")
        print(f"Replies waiting to send: {replies}")
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError, ValueError, KeyError) as error:
        print(f"Feedback: unavailable ({error})")
        print("Replies waiting to send: unavailable")
        failed = True

    pending = ROOT / "evals/data/user_cases_pending.json"
    try:
        cases = json.loads(pending.read_text()) if pending.exists() else []
        print(f"Pending user eval cases: {len(cases)}" if pending.exists() else "Pending user eval cases: not fetched")
    except (OSError, json.JSONDecodeError, TypeError) as error:
        print(f"Pending user eval cases: unavailable ({error})")
        failed = True

    drafts_script = ROOT / "scripts/factory/feedback_drafts.py"
    if not drafts_script.exists():
        print("feedback drafts: not installed")
    else:
        try:
            command([sys.executable, str(drafts_script), "--help"])
        except subprocess.CalledProcessError as error:
            print(f"feedback drafts: unavailable ({error})")
            failed = True

    try:
        rows = [row for row in issues() if row["state"]["type"] not in ("completed", "canceled")]
        labels = [[item["name"] for item in row["labels"]["nodes"]] for row in rows]
        print(f"Drafts waiting: {sum('draft' in names for names in labels)}")
        print("Factory labels:")
        for label in FACTORY_LABELS:
            print(f"  {label}: {sum(label in names for names in labels)}")
    except (subprocess.CalledProcessError, RuntimeError, ValueError, KeyError) as error:
        print(f"Drafts waiting: unavailable ({error})")
        print(f"Factory labels: unavailable ({error})")
        failed = True

    print(f"Last merge: {last_merge()}")
    try:
        print(f"Last eval run: {last_eval()}")
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"Last eval run: unavailable ({error})")
        failed = True
    return int(failed)


if __name__ == "__main__":
    sys.exit(main())
