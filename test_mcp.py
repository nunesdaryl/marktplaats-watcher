"""MCP protocol, identity boundary, and chat integration tests."""
import json
import os
import time

os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("OPENAI_MODEL", "dummy")

import jwt
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessageChunk
from cryptography.hazmat.primitives.asymmetric import rsa

import agent
import main
import mcp_server
from evals.rag_cases import CASES, INJECTION, FORGED_ID, PASS_BAR, fake_search_alerts


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
    client = TestClient(main.app, base_url="https://marktplaats-watcher.vercel.app")  # no lifespan
    initialized = rpc(client, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                             "clientInfo": {"name": "test", "version": "1"}}, "owner-secret")
    assert initialized.status_code == 200
    assert "mcp-session-id" not in initialized.headers
    listed = rpc(client, "tools/list", token="owner-secret")
    assert listed.status_code == 200
    assert len(listed.json()["result"]["tools"]) == 5


def test_mcp_auth_tools_and_user_scope(monkeypatch):
    verify_clerk = main.current_user
    monkeypatch.setenv("MCP_ENABLED", "1")
    monkeypatch.setenv("MCP_OWNER_TOKEN", "owner-secret")
    monkeypatch.setenv("OWNER_CLERK_ID", "owner")
    monkeypatch.setattr(main, "current_user", lambda authorization: authorization.removeprefix("Bearer ")
                        if authorization in ("Bearer alice", "Bearer bob") else (_ for _ in ()).throw(main.HTTPException(401)))
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
                         "search_my_alerts", "search_marktplaats"}
        prompts = rpc(client, "prompts/list", token="alice").json()["result"]["prompts"]
        assert [prompt["name"] for prompt in prompts] == ["review_my_alerts"]
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


def test_rag_eval_fixture_covers_five_questions_and_security():
    assert len(CASES) == 5 and PASS_BAR == 7
    assert INJECTION[2] in fake_search_alerts("alice", "Switch", 5)[0]["title"]
    assert fake_search_alerts("bob", FORGED_ID[1], 5) == []
    assert fake_search_alerts("alice", "PlayStation 6", 5) == []
