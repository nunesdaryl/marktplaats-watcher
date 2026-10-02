import json
import subprocess

import pytest

from evals import common, feedback_cases, report


def rating(id, verdict, snapshot=True):
    return {"id": id, "at": "2026-10-02T00:00:00Z", "verdict": verdict,
            "reasons": ["price"] if verdict == "not_right" else [], "score": 9,
            "note": "", "title": "Gazelle",
            "watchDescription": "Gazelle bike" if snapshot else None,
            "listing": {"id": "listing-" + id, "title": "Gazelle", "price_eur": 350,
                        "city": "Utrecht", "distance_km": None, "url": "https://example.test/" + id} if snapshot else None}


def test_feedback_cases_fetches_and_requires_confirmation(monkeypatch, tmp_path):
    pending, golden = tmp_path / "pending.json", tmp_path / "golden.json"
    monkeypatch.setattr(feedback_cases, "USER_CASES_PENDING", pending)
    monkeypatch.setattr(feedback_cases, "USER_CASES_GOLDEN", golden)
    calls = []

    def fake_export():
        calls.append("export")
        return [rating("bad", "not_right"), rating("legacy", "not_right", False),
                *[rating(f"good-{n}", "good") for n in range(40)]]

    monkeypatch.setattr(feedback_cases, "fetch_ratings", fake_export)
    feedback_cases.main([])
    cases = common.read(pending)
    assert calls == ["export"]
    assert not golden.exists()
    assert cases[0] == {"id": "bad", "watch_description": "Gazelle bike",
                        "listing": rating("bad", "not_right")["listing"], "label": False,
                        "verdict": "not_right", "reasons": ["price"], "rated_at": "2026-10-02T00:00:00Z"}
    assert 1 < len(cases) < 41
    assert "legacy" not in {case["id"] for case in cases}
    with pytest.raises(ValueError, match="not pending"):
        feedback_cases.main(["--confirm", "unknown"])
    assert not golden.exists()
    feedback_cases.main(["--confirm", "bad"])
    assert calls == ["export"]
    assert [case["id"] for case in common.read(golden)] == ["bad"]
    assert "bad" not in {case["id"] for case in common.read(pending)}
    feedback_cases.main([])
    assert "bad" not in {case["id"] for case in common.read(pending)}


def test_reason_labels_generated_from_frontend_and_report_counts(tmp_path):
    source = json.loads((common.DATA / "rating_reasons.json").read_text())
    node = subprocess.run(["node", "--input-type=module", "-e",
                           "import { REASONS } from './frontend/src/lib/ratings.js'; console.log(JSON.stringify(Object.fromEntries(REASONS)))"],
                          capture_output=True, text=True, check=True)
    assert source == json.loads(node.stdout)
    assert "Review queue: **2 pending**, **1 confirmed**" in "\n".join(report.user_section([rating("bad", "not_right")], 2, 1))
    empty = "\n".join(report.user_section([], 0, 0))
    assert "Yes / Not right" in empty and "👍" not in empty
    scored = [{"score": 9, "label": True}] * 18 + [{"score": 9, "label": False}] * 2
    section = "\n".join(report.user_section([], 0, 20, scored))
    assert "precision at score ≥ 8: **90%**" in section
    assert report.user_precision(scored) == 0.9
