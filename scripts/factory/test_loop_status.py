"""The weekly status command renders each checkpoint from read-only fake inputs."""
import json
import os
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[2]


def test_loop_status_sections(tmp_path):
    feedback = tmp_path / "feedback.json"
    issues = tmp_path / "issues.json"
    feedback.write_text(json.dumps({"new": 2, "open": 4, "repliesWaiting": 1}))
    issues.write_text(json.dumps([
        {"state": {"type": "started"}, "labels": {"nodes": [{"name": label}]}}
        for label in ("draft", "agent-ready", "built", "ready-to-merge", "needs-fix", "blocked")
    ] + [{"state": {"type": "completed"}, "labels": {"nodes": [{"name": "draft"}]}}]))
    env = os.environ.copy()
    env.update(LOOP_STATUS_FEEDBACK_JSON=str(feedback), LOOP_STATUS_ISSUES_JSON=str(issues))

    result = subprocess.run(["bash", "scripts/factory/loop-status.sh"], cwd=ROOT,
                            env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr

    assert "Feedback: 2 new, 4 open" in result.stdout
    assert "Replies waiting to send: 1" in result.stdout
    assert "Pending user eval cases:" in result.stdout
    assert "Drafts waiting: 1" in result.stdout
    if not (ROOT / "scripts/factory/feedback_drafts.py").exists():
        assert "feedback drafts: not installed" in result.stdout
    for label in ("agent-ready", "built", "ready-to-merge", "needs-fix", "blocked"):
        assert f"  {label}: 1" in result.stdout
    assert "Last merge: MW-" in result.stdout
    assert "Last eval run: " in result.stdout
