"""MCP protocol, identity boundary, and chat integration tests."""
import json
import os
import time
from pathlib import Path

os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("OPENAI_MODEL", "dummy")

import jwt
import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessageChunk
from cryptography.hazmat.primitives.asymmetric import rsa

import agent
import main
import mcp_server
from evals.rag_cases import CASES, INJECTION, FORGED_ID, PASS_BAR, fake_search_alerts


def test_alert_card_keeps_known_price_type_without_null_field():
    row = {"alertId": "a1", "title": "Bike", "priceEur": 100, "url": "https://example.test"}
    assert "price_type" not in mcp_server.alert_card(row)
    assert mcp_server.alert_card({**row, "priceType": "bidding from"})["price_type"] == "bidding from"


def rpc(client, method, params=None, token=None):
    headers = {"Accept": "application/json, text/event-stream"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.post("/api/mcp", headers=headers, json={"jsonrpc": "2.0", "id": 1,
                                                    "method": method, "params": params or {}})


def test_mcp_works_without_asgi_lifespan(monkeypatch):
    monkeypatch.setenv("MCP_ENABLED", "1")
    monkeypatch.setenv("MCP_OWNER_TOKEN", "owner-secret")
    monkeypatch.setenv("OWNER_CLERK_ID", "owner")
    monkeypatch.setattr(main, "admission_check", lambda user: True)   # MW-85: callers need a founding place
    client = TestClient(main.app, base_url="https://marktplaats-watcher.vercel.app")  # no lifespan
    initialized = rpc(client, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                             "clientInfo": {"name": "test", "version": "1"}}, "owner-secret")
    assert initialized.status_code == 200
    assert "mcp-session-id" not in initialized.headers
    listed = rpc(client, "tools/list", token="owner-secret")
    assert listed.status_code == 200
    assert len(listed.json()["result"]["tools"]) == 6


def test_mcp_refuses_callers_without_a_founding_place(monkeypatch):
    monkeypatch.setenv("MCP_ENABLED", "1")
    monkeypatch.setattr(main, "current_user", lambda authorization: "carol")
    monkeypatch.setattr(main, "admission_check", lambda user: False)
    client = TestClient(main.app, base_url="https://marktplaats-watcher.vercel.app")
    response = rpc(client, "tools/list", token="carol")
    assert response.status_code == 403


def test_mcp_auth_tools_and_user_scope(monkeypatch):
    verify_clerk = main.current_user
    monkeypatch.setenv("MCP_ENABLED", "1")
    monkeypatch.setenv("MCP_OWNER_TOKEN", "owner-secret")
    monkeypatch.setenv("OWNER_CLERK_ID", "owner")
    monkeypatch.setattr(main, "current_user", lambda authorization: authorization.removeprefix("Bearer ")
                        if authorization in ("Bearer alice", "Bearer bob") else (_ for _ in ()).throw(main.HTTPException(401)))
    monkeypatch.setattr(main, "admission_check", lambda user: True)   # MW-85: callers need a founding place
    seen = []
    def convex(path, payload):
        seen.append((path, payload))
        if path == "/api/watches/mine":
            return [{"watchId": "w-" + payload["clerkId"], "label": "Mac", "query": "mac mini", "active": True}]
        return None
    monkeypatch.setattr(mcp_server, "convex_post", convex)
    with TestClient(main.app, base_url="https://marktplaats-watcher.vercel.app") as client:
        assert rpc(client, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                            "clientInfo": {"name": "test", "version": "1"}}).status_code == 401
        assert rpc(client, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                            "clientInfo": {"name": "test", "version": "1"}}, "bad").status_code == 401
        initialized = rpc(client, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                                 "clientInfo": {"name": "test", "version": "1"}}, "alice")
        assert initialized.status_code == 200
        assert "mcp-session-id" not in initialized.headers
        names = {t["name"] for t in rpc(client, "tools/list", token="alice").json()["result"]["tools"]}
        assert names == {"list_my_watches", "get_watch_activity", "get_alert_evidence",
                         "search_my_alerts", "search_marktplaats", "compare_vector_stores"}
        assert len(names - {"compare_vector_stores"}) == 5  # five general read-only tools; owner comparison is extra
        prompts = rpc(client, "prompts/list", token="alice").json()["result"]["prompts"]
        catalog = json.loads((Path(__file__).parent / "frontend/src/lib/templates.json").read_text())
        assert {prompt["name"] for prompt in prompts} == {"review_my_alerts"} | {
            template["id"] for template in catalog["templates"]}
        chosen = rpc(client, "prompts/get", {"name": "dutch-watch"}, token="alice")
        assert chosen.json()["result"]["messages"][0]["content"]["text"] == next(
            template["text"] for template in catalog["templates"] if template["id"] == "dutch-watch")
        for token, expected in (("alice", "alice"), ("bob", "bob"), ("owner-secret", "owner")):
            result = rpc(client, "tools/call", {"name": "list_my_watches",
                                                 "arguments": {"clerkId": "forged"}}, token)
            assert result.status_code == 200
            data = json.loads(result.json()["result"]["content"][0]["text"])
            assert data["data"][0]["watchId"] == "w-" + expected
        assert all(payload["clerkId"] != "forged" for _, payload in seen)
        private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        class Keys:
            def get_signing_key_from_jwt(self, token):
                return type("Key", (), {"key": private.public_key()})()
        monkeypatch.setattr(main, "current_user", verify_clerk)
        monkeypatch.setattr(main, "_jwks", Keys())
        monkeypatch.setattr(main, "CLERK_ISSUER", "https://clerk.test")
        def signed(issuer):
            return jwt.encode({"sub": "alice", "iss": issuer, "aud": "convex",
                               "exp": int(time.time()) + 60}, private, algorithm="RS256")
        assert rpc(client, "tools/list", token=signed("https://wrong.test")).status_code == 401
        result = rpc(client, "tools/call", {"name": "list_my_watches", "arguments": {}},
                     signed("https://clerk.test"))
        assert result.status_code == 200
        assert "alice" in result.text


def test_mcp_chat_rag_cards_and_fallback(monkeypatch):
    monkeypatch.setenv("MCP_ENABLED", "1")
    monkeypatch.setenv("RAG_ENABLED", "1")
    monkeypatch.setattr(agent, "search_alerts", lambda user, query, k: [{
        "alertId": "a1", "title": "Mac mini M5 Pro", "priceEur": 500,
        "url": "https://www.marktplaats.nl/v/mac", "reason": "Good value", "score10": 9,
    }] if user == "alice" else [])

    class Model:
        def __init__(self):
            self.calls = 0
            self.system_text = ""
        def stream(self, messages):
            self.calls += 1
            self.system_text = messages[0].content
            if self.calls == 1:
                yield AIMessageChunk(content="", tool_call_chunks=[{"name": "search_my_alerts",
                    "args": '{"query":"Mac mini"}', "id": "c1", "index": 0}])
            else:
                yield AIMessageChunk(content="The Mac mini M5 Pro is the best value.")
    class Base:
        def __init__(self): self.bound = None
        def bind_tools(self, tools):
            self.bound = Model()
            return self.bound
    base = Base()
    monkeypatch.setattr(agent, "base_model", base)
    identity = mcp_server.mcp_user.set("alice")
    try:
        events = list(agent.chat_events("Which Mac mini alert was best?", []))
        assert "use search_my_alerts" in base.bound.system_text
        card = next(e for e in events if e["type"] == "listings")["listings"][0]
        assert card["url"].endswith("/mac")
        assert set(card) == {"id", "title", "price_eur", "city", "distance_km", "url", "image"}
        assert events[-1]["listings"][0]["id"] == "a1"
        monkeypatch.setattr(mcp_server, "chat_tools", lambda: (_ for _ in ()).throw(TimeoutError()))
        fallback = Model()
        monkeypatch.setattr(agent, "model", fallback)
        events = list(agent.chat_events("Mac mini?", []))
        assert events[-1]["type"] == "done"
        assert fallback.calls > 0
        assert fallback.system_text == agent.SYSTEM_PROMPT
    finally:
        mcp_server.mcp_user.reset(identity)


def test_rag_filters_weak_hits_and_keeps_newest_listing_alert(monkeypatch):
    monkeypatch.setattr(agent, "search_alerts", lambda user, query, k: {"hits": [
        {"alertId": "old", "listingId": "listing-1", "url": "https://example.test/old",
         "createdAt": 1, "score": 0.9},
        {"alertId": "new", "listingId": "listing-1", "url": "https://example.test/new",
         "createdAt": 2, "score": 0.8},
        {"alertId": "same-url", "listingId": "listing-2", "url": "https://example.test/new",
         "createdAt": 1, "score": 1},
        {"alertId": "weak", "url": "https://example.test/weak", "createdAt": 3, "score": 0.34},
        {"alertId": "keyword", "url": "https://example.test/keyword", "createdAt": 4, "score": 1},
    ]})
    identity = mcp_server.mcp_user.set("alice")
    try:
        hits = json.loads(mcp_server.search_my_alerts("Mac"))["data"]["hits"]
        assert [row["alertId"] for row in hits] == ["new", "keyword"]
    finally:
        mcp_server.mcp_user.reset(identity)


@pytest.mark.parametrize("answer", ["No relevant alerts found.", "None found.",
                                    "I couldn't find any M5 Pro alerts."])
def test_rag_no_match_answer_emits_no_cards(monkeypatch, answer):
    monkeypatch.setenv("MCP_ENABLED", "1")
    monkeypatch.setenv("RAG_ENABLED", "1")
    monkeypatch.setattr(agent, "search_alerts", lambda user, query, k: [{
        "alertId": "unrelated", "title": "iPhone", "url": "https://example.test/iphone",
    }])

    class Model:
        def __init__(self): self.calls = 0
        def stream(self, messages):
            self.calls += 1
            if self.calls == 1:
                yield AIMessageChunk(content="", tool_call_chunks=[{"name": "search_my_alerts",
                    "args": '{"query":"M5 Pro"}', "id": "c1", "index": 0}])
            else:
                yield AIMessageChunk(content=answer)

    class Base:
        def bind_tools(self, tools): return Model()

    monkeypatch.setattr(agent, "base_model", Base())
    identity = mcp_server.mcp_user.set("alice")
    try:
        events = list(agent.chat_events("Which alerts mention M5 Pro?", []))
        assert not any(event["type"] == "listings" for event in events)
        assert events[-1]["listings"] == []
    finally:
        mcp_server.mcp_user.reset(identity)


def test_mcp_activity_evidence_and_rag_use_request_identity(monkeypatch):
    monkeypatch.setenv("RAG_ENABLED", "1")
    seen = []
    def convex(path, payload):
        seen.append((path, payload))
        if path == "/api/watches/mine":
            return [{"watchId": "w-alice", "label": "Mac", "query": "mac mini", "active": True}]
        if path == "/api/alerts/activity":
            return {"total": 1, "alerts": [{"alertId": "a-alice"}]}
        if path == "/api/alerts/evidence":
            return {"alertId": payload["alertId"], "title": "Mac mini"}
        raise AssertionError(path)
    monkeypatch.setattr(mcp_server, "convex_post", convex)
    monkeypatch.setattr(agent, "search_alerts", lambda user, query, k: seen.append(("rag", user, k)) or [
        {"alertId": "a-alice", "title": "Mac mini", "priceEur": 500, "score10": 9,
         "reason": "Good value", "url": "https://www.marktplaats.nl/v/mac", "rating": {"verdict": "good"}}])
    identity = mcp_server.mcp_user.set("alice")
    try:
        original_wait_for = mcp_server.asyncio.wait_for
        timeouts = []
        async def timed(coroutine, timeout):
            timeouts.append(timeout)
            return await original_wait_for(coroutine, timeout)
        monkeypatch.setattr(mcp_server.asyncio, "wait_for", timed)
        tools = {t.name: t for t in mcp_server.chat_tools()}
        assert "from" in tools["get_watch_activity"].args
        assert json.loads(tools["get_watch_activity"].invoke({"watch": "Mac", "from": "today", "to": "now"}))["data"]["total"] == 1
        assert json.loads(tools["get_alert_evidence"].invoke({"alert_id": "a-alice"}))["data"]["alertId"] == "a-alice"
        rag = json.loads(tools["search_my_alerts"].invoke({"query": "Mac", "k": 99}))["data"]
        assert rag[0]["reason"] == "Good value" and rag[0]["rating"]["verdict"] == "good"
        assert ("rag", "alice", 5) in seen
        assert all(entry[1]["clerkId"] == "alice" for entry in seen if entry[0].startswith("/api/"))
        assert timeouts == [3, 15, 15, 15]
    finally:
        mcp_server.mcp_user.reset(identity)


def test_rag_eval_fixture_covers_duplicates_weak_hits_count_and_security():
    assert len(CASES) == 6 and PASS_BAR == 9
    assert INJECTION[2] in fake_search_alerts("alice", "Switch", 5)[0]["title"]
    assert fake_search_alerts("bob", FORGED_ID[1], 5) == []
    assert fake_search_alerts("alice", "PlayStation 6", 5)[0]["score"] < 0.35
    assert len(fake_search_alerts("alice", "Mac mini", 5)) == 2
    assert min(row["score"] for row in fake_search_alerts("alice", "Mac mini or Gazelle bike", 5)) >= 0.35


def test_mcp_disabled_returns_404(monkeypatch):
    monkeypatch.setenv("MCP_ENABLED", "0")
    client = TestClient(main.app, base_url="https://marktplaats-watcher.vercel.app")
    assert rpc(client, "tools/list", token="anything").status_code == 404


def test_forged_alert_id_cannot_read_another_users_evidence(monkeypatch):
    monkeypatch.setenv("MCP_ENABLED", "1")
    monkeypatch.setattr(main, "current_user", lambda authorization: "alice")
    monkeypatch.setattr(main, "admission_check", lambda user: True)
    seen = []
    def convex(path, payload):
        seen.append((path, payload))
        return None if payload["alertId"] == "bob-private-alert" else {"alertId": payload["alertId"]}
    monkeypatch.setattr(mcp_server, "convex_post", convex)
    client = TestClient(main.app, base_url="https://marktplaats-watcher.vercel.app")
    result = rpc(client, "tools/call", {"name": "get_alert_evidence", "arguments": {
        "alert_id": "bob-private-alert", "clerkId": "bob"}}, "alice")
    assert result.status_code == 200
    assert seen == [("/api/alerts/evidence", {"clerkId": "alice", "alertId": "bob-private-alert"})]
    assert "bob-private-alert" not in result.text or '"data": null' in result.text


def test_mcp_timeout_falls_back_and_logs_without_500(monkeypatch, capsys):
    monkeypatch.setenv("MCP_ENABLED", "1")
    monkeypatch.setenv("RAG_ENABLED", "1")
    monkeypatch.setattr(mcp_server, "chat_tools", lambda: (_ for _ in ()).throw(TimeoutError("Convex timed out")))
    class Model:
        def stream(self, messages):
            yield AIMessageChunk(content="I can still answer your question.")
    monkeypatch.setattr(agent, "model", Model())
    identity = mcp_server.mcp_user.set("alice")
    try:
        result = agent.chat("Can you help?", [])
    finally:
        mcp_server.mcp_user.reset(identity)
    assert "still answer" in result["answer"]
    assert '"event": "mcp_chat_fallback"' in capsys.readouterr().out


def test_convex_tool_timeout_keeps_chat_answer_and_logs(monkeypatch, capsys):
    monkeypatch.setenv("MCP_ENABLED", "1")
    monkeypatch.setenv("RAG_ENABLED", "1")
    monkeypatch.setattr(mcp_server, "convex_post", lambda path, payload: (_ for _ in ()).throw(TimeoutError("Convex")))
    class Model:
        def __init__(self): self.calls = 0
        def stream(self, messages):
            self.calls += 1
            if self.calls == 1:
                yield AIMessageChunk(content="", tool_call_chunks=[{
                    "name": "list_my_watches", "args": "{}", "id": "timeout", "index": 0}])
            else:
                yield AIMessageChunk(content="The watch service is unavailable right now.")
    class Base:
        def bind_tools(self, tools): return model
    model = Model()
    monkeypatch.setattr(agent, "base_model", Base())
    identity = mcp_server.mcp_user.set("alice")
    try:
        result = agent.chat("List my watches", [])
    finally:
        mcp_server.mcp_user.reset(identity)
    assert "unavailable" in result["answer"]
    assert '"event": "mcp_tool_failed"' in capsys.readouterr().out
