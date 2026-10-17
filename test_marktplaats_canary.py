"""Run the daily canary with the same environment as its workflow step."""

import os
import subprocess
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).parent
WORKFLOW = ROOT / ".github" / "workflows" / "marktplaats-canary.yml"


def canary_step_env():
    lines = WORKFLOW.read_text().splitlines()
    step = lines.index("      - name: Check live search response")
    settings = {}
    if lines[step + 1] == "        env:":
        for line in lines[step + 2:]:
            if not line.startswith("          "):
                break
            name, value = line.strip().split(": ", 1)
            settings[name] = value
    return {"PATH": os.environ.get("PATH", ""), **settings}


@pytest.mark.parametrize("fixture, expected_exit, expected_message", [
    ("marktplaats_canary_good.json", 0, "Marktplaats search shape OK:"),
    ("marktplaats_canary_broken.json", 1, "listings[0] has no priorityProduct"),
])
def test_canary_runs_with_workflow_environment(fixture, expected_exit, expected_message):
    # Replace only the external search; importing agent and running the canary remain real.
    script = (
        "import json, runpy, sys\n"
        "import dotenv\n"
        "dotenv.load_dotenv = lambda *args, **kwargs: False\n"
        "import agent\n"
        "agent.fetch_search = lambda *args, **kwargs: json.loads(open(sys.argv[1]).read())\n"
        "runpy.run_path(sys.argv[2], run_name='__main__')\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", script, str(ROOT / "tests" / fixture), str(ROOT / "marktplaats_canary.py")],
        cwd=ROOT, env=canary_step_env(), capture_output=True, text=True,
    )
    assert result.returncode == expected_exit, result.stdout + result.stderr
    assert expected_message in result.stdout + result.stderr
