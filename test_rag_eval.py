"""Frozen retrieval metric and export contracts; no model or Convex calls."""
import json
import os
from zipfile import ZipFile

import pytest

os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("OPENAI_MODEL", "dummy")

from evals import run_rag
from evals.export_rag_snapshot import sanitize


def row(alert_id, owner, vector, text, listing=None):
    return {"alertId": alert_id, "owner": owner, "embedding": vector, "text": text,
            "listingId": listing or alert_id, "url": f"https://example.test/{alert_id}"}


def test_retrieval_modes_and_owner_scope():
    alerts = [row("a", "alice", [1.0, 0.0], "Mac mini M5 Pro"),
              row("b", "alice", [0.0, 1.0], "Gazelle bike"),
              row("c", "bob", [1.0, 0.0], "Mac mini M5 Pro")]
    case = {"owner": "alice", "question": "M5 Pro", "expectedAlertIds": ["a"]}
    for mode in ("keyword", "vector", "hybrid"):
        hits = run_rag.retrieve(alerts, case, [1.0, 0.0], mode)
        assert [hit["alertId"] for hit in hits] == ["a"]
        assert run_rag.retrieval_scores(hits, ["a"]) == {"recall_at_5": 1, "precision_at_5": .2}
    assert run_rag.retrieval_scores([], ["a"])["recall_at_5"] == 0
    assert run_rag.retrieval_scores([], [])["recall_at_5"] is None


def test_sanitized_read_only_export(tmp_path):
    archive_path = tmp_path / "export.zip"
    tables = {
        "users": [{"_id": "u1", "clerkId": "secret-user"}],
        "watches": [{"_id": "w1", "name": "Mac mini"}],
        "alerts": [{"_id": "a1", "userId": "u1", "watchId": "w1", "title": "M5 Pro",
                    "sellerName": "Private Seller", "url": "https://example.test/a1"}],
        "alertEmbeddings": [{"alertId": "a1", "userId": "u1", "text": "M5 Pro",
                             "embedding": [0.1] * 1536}],
    }
    with ZipFile(archive_path, "w") as archive:
        for table, rows in tables.items():
            archive.writestr(f"{table}/documents.jsonl", "\n".join(json.dumps(row) for row in rows))
    result = sanitize(archive_path)
    encoded = json.dumps(result)
    assert len(result["alerts"]) == 1
    assert result["alerts"][0]["owner"] == "owner-001"
    assert "Private Seller" not in encoded and "secret-user" not in encoded


def test_snapshot_rejects_missing_labels_and_wrong_vectors(monkeypatch, tmp_path):
    monkeypatch.setattr(run_rag, "DATA", tmp_path)
    with pytest.raises(RuntimeError, match="missing"):
        run_rag.load_snapshot()
    snapshot = {"source": "read-only", "alerts": [row("a", "alice", [1, 0], "Mac mini")]}
    (tmp_path / "snapshot.json").write_text(json.dumps(snapshot))
    (tmp_path / "cases.json").write_text(json.dumps([
        {"id": f"Q{i}", "owner": "alice", "question": "Mac mini", "expectedAlertIds": ["a"]}
        for i in range(15)]))
    with pytest.raises(ValueError, match="1536"):
        run_rag.load_snapshot()
