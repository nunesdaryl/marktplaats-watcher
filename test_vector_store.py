import json
import os
from types import SimpleNamespace

from fastapi.testclient import TestClient

os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("OPENAI_MODEL", "dummy")

import agent
import main
import mcp_server
import vector_store


class FakeCollection:
    def __init__(self):
        self.docs = {}
        self.pipeline = None
        self.bulk_calls = 0

    def bulk_write(self, operations, ordered):
        assert ordered is False
        self.bulk_calls += 1
        for operation in operations:
            assert operation._upsert is True
            match, update = operation._filter, operation._doc
            self.docs.setdefault(match["_id"], {"_id": match["_id"], **update["$setOnInsert"]}).update(update["$set"])

    def aggregate(self, pipeline):
        self.pipeline = pipeline
        user = pipeline[0]["$vectorSearch"]["filter"]["userId"]
        return [{"_id": row["_id"], "score": 0.9} for row in self.docs.values() if row["userId"] == user]


def test_mirror_upsert_and_user_scoped_search():
    collection = FakeCollection()
    store = vector_store.MongoStore(collection)
    row = {"alertId": "a1", "userId": "u1", "embedding": [0.1] * 1536}
    assert store.mirror([row]) == {"status": "ok", "count": 1}
    assert store.mirror([{**row, "embedding": [0.2] * 1536}])["status"] == "ok"
    assert collection.bulk_calls == 2
    assert len(collection.docs) == 1
    assert collection.docs["a1"]["embedding"][0] == 0.2
    assert store.search("u2", [0.1] * 1536, 5)["hits"] == []
    assert store.search("u1", [0.1] * 1536, 5)["hits"][0]["alertId"] == "a1"
    assert collection.pipeline[0]["$vectorSearch"]["index"] == "alerts_vec"


def test_mirror_batch_uses_one_bulk_write():
    collection = FakeCollection()
    rows = [{"alertId": str(i), "userId": "u1", "embedding": [0.1]} for i in range(3)]
    assert vector_store.MongoStore(collection).mirror(rows) == {"status": "ok", "count": 3}
    assert collection.bulk_calls == 1
    assert set(collection.docs) == {"0", "1", "2"}


def test_mirror_and_search_client_budgets(monkeypatch):
    import pymongo
    seen = []
    class Client:
        def __init__(self, uri, **kwargs):
            seen.append(kwargs)
        def __getitem__(self, name):
            return {"watcher": {"alert_embeddings": FakeCollection()}}[name]
    monkeypatch.setenv("MONGODB_URI", "mongodb+srv://user:secret@host.example/db")
    monkeypatch.setattr(pymongo, "MongoClient", Client)
    vector_store.MongoStore(purpose="mirror")
    vector_store.MongoStore()
    assert seen == [
        {"serverSelectionTimeoutMS": 10000, "timeoutMS": 20000},
        {"serverSelectionTimeoutMS": 1500, "timeoutMS": 1500},
    ]


def test_mirror_write_error_log_redacts_uri(monkeypatch, capsys):
    uri = "mongodb+srv://user:secret@host.example/db"
    store_class = vector_store.MongoStore
    class BrokenCollection:
        def bulk_write(self, operations, ordered):
            raise RuntimeError(f"write failed at {uri} " + "x" * 300)
    monkeypatch.setenv("CRON_SECRET", "secret")
    monkeypatch.setenv("MONGODB_URI", "mongodb+srv://different:private@other.example/db")
    monkeypatch.setattr(vector_store, "MongoStore", lambda **kwargs: store_class(BrokenCollection()))
    response = TestClient(main.app).post("/api/internal/mirror", json={"rows": [
        {"alertId": "a1", "userId": "u1", "embedding": [0.1] * 1536}
    ]}, headers={"X-Cron-Secret": "secret"})
    assert response.status_code == 503
    output = capsys.readouterr().out
    entry = json.loads(output.strip().splitlines()[-1])
    assert entry["event"] == "mirror_failed"
    assert entry["error"] == "RuntimeError"
    assert "write failed" in entry["detail"]
    assert uri not in output
    assert "secret" not in output
    assert len(entry["detail"]) == 200


def test_mirror_init_error_log_redacts_uri(monkeypatch, capsys):
    import pymongo
    uri = "mongodb+srv://user:secret@host.example/db"
    def broken_client(*args, **kwargs):
        raise ValueError(f"bad URI {uri}")
    monkeypatch.setenv("CRON_SECRET", "secret")
    monkeypatch.setenv("MONGODB_URI", uri)
    monkeypatch.setattr(pymongo, "MongoClient", broken_client)
    response = TestClient(main.app).post("/api/internal/mirror", json={"rows": [
        {"alertId": "a1", "userId": "u1", "embedding": [0.1] * 1536}
    ]}, headers={"X-Cron-Secret": "secret"})
    assert response.status_code == 503
    output = capsys.readouterr().out
    entry = json.loads(output.strip().splitlines()[-1])
    assert entry["error"] == "ValueError"
    assert "bad URI" in entry["detail"]
    assert uri not in output
    assert "secret" not in output


def test_unset_uri_is_noop(monkeypatch):
    monkeypatch.delenv("MONGODB_URI", raising=False)
    store = vector_store.MongoStore()
    assert store.mirror([{"alertId": "a1"}]) == {"status": "unconfigured"}
    assert store.search("u1", [], 5) == {"status": "unconfigured"}


def test_failover_served_by_mongo(monkeypatch):
    monkeypatch.setenv("RAG_ENABLED", "1")
    monkeypatch.delenv("VECTOR_PRIMARY", raising=False)
    monkeypatch.setattr(agent, "embed_texts", lambda texts: [[0.1] * 1536])
    def failed(*args, **kwargs):
        raise TimeoutError()
    monkeypatch.setattr(vector_store.ConvexStore, "search", failed)
    monkeypatch.setattr(vector_store, "mongo_results", lambda *args: {"status": "ok", "hits": [{"alertId": "a1"}]})
    assert agent.search_alerts("alice", "Mac")["servedBy"] == "mongo"
    monkeypatch.setattr(vector_store.ConvexStore, "search", lambda *args, **kwargs: [{"alertId": "a1"}])
    assert agent.search_alerts("alice", "Mac")["servedBy"] == "convex"
    monkeypatch.setenv("VECTOR_PRIMARY", "mongo")
    assert agent.search_alerts("alice", "Mac")["servedBy"] == "mongo"
    monkeypatch.setattr(vector_store, "mongo_results", lambda *args: {"status": "error"})
    assert agent.search_alerts("alice", "Mac")["servedBy"] == "convex"
    monkeypatch.setenv("VECTOR_PRIMARY", "convex")
    monkeypatch.setenv("MONGODB_URI", "mongodb://unused")
    monkeypatch.setattr(vector_store, "mongo_results", lambda *args: {"status": "ok", "hits": [{"alertId": "a1"}]})
    clock = iter([0.0, 3.1])
    monkeypatch.setattr(agent, "time", SimpleNamespace(monotonic=lambda: next(clock, 3.1)))
    assert agent.search_alerts("alice", "Mac")["servedBy"] == "mongo"


def test_convex_search_uses_three_second_timeout(monkeypatch):
    seen = []
    monkeypatch.setattr(vector_store, "convex_post", lambda path, body, timeout: seen.append((path, timeout)) or [])
    assert vector_store.ConvexStore().search("alice", [0.1] * 1536, 5, "Mac") == []
    assert seen == [("/api/alerts/search", 3)]


def test_mirror_route_secret_and_no_uri(monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "secret")
    monkeypatch.delenv("MONGODB_URI", raising=False)
    body = {"rows": [{"alertId": "a1", "userId": "u1", "embedding": [0.1] * 1536}]}
    client = TestClient(main.app)
    assert client.post("/api/internal/mirror", json=body).status_code == 401
    response = client.post("/api/internal/mirror", json=body, headers={"X-Cron-Secret": "secret"})
    assert response.json() == {"status": "unconfigured"}


def test_compare_owner_only(monkeypatch):
    monkeypatch.setenv("OWNER_CLERK_ID", "owner")
    token = mcp_server.mcp_user.set("alice")
    try:
        try:
            mcp_server.compare_vector_stores("Mac")
            assert False
        except PermissionError:
            pass
    finally:
        mcp_server.mcp_user.reset(token)
    token = mcp_server.mcp_user.set("owner")
    try:
        monkeypatch.delenv("MONGODB_URI", raising=False)
        assert json.loads(mcp_server.compare_vector_stores("Mac"))["data"]["status"] == "MongoDB not configured"
        monkeypatch.setattr(vector_store, "MongoStore", lambda: type("Store", (), {"configured": True})())
        monkeypatch.setattr(agent, "embed_texts", lambda texts: [[0.1] * 1536])
        monkeypatch.setattr(vector_store.ConvexStore, "search", lambda *args, **kwargs: [{"alertId": "a1"}])
        monkeypatch.setattr(vector_store, "mongo_results", lambda *args: {"status": "ok", "hits": [{"alertId": "a1"}]})
        compared = json.loads(mcp_server.compare_vector_stores("Mac"))["data"]
        assert compared["overlap"] == 1
        assert compared["convex"]["hits"][0]["alertId"] == "a1"
        assert compared["mongo"]["hits"][0]["alertId"] == "a1"
    finally:
        mcp_server.mcp_user.reset(token)
