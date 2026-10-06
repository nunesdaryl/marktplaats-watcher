"""HTTP contract tests for the scheduled check sent by Convex."""

import os
import re
from pathlib import Path

from fastapi.testclient import TestClient
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles

os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("OPENAI_MODEL", "gpt-5.4-mini")

import agent
import main


def test_not_modified_response_has_no_body_or_content_length():
    async def accidental_body(request):
        return Response(b"unexpected", status_code=304, headers={"ETag": '"version-1"', "Content-Length": "10"})

    # Insert first: when frontend/out exists, a catch-all static mount would otherwise answer 404 before this route
    from starlette.routing import Route
    route = Route("/api/test-not-modified", accidental_body)
    main.app.router.routes.insert(0, route)
    try:
        response = TestClient(main.app).get("/api/test-not-modified")
    finally:
        main.app.router.routes.remove(route)
    assert response.status_code == 304
    assert response.content == b""
    assert "content-length" not in response.headers
    assert response.headers["etag"] == '"version-1"'


def test_static_not_modified_response_has_no_body(tmp_path):
    static = tmp_path / "static"
    static.mkdir()
    (static / "app.js").write_text("console.log('ready')")
    main.app.mount("/test-static", StaticFiles(directory=static), name="test-static")
    route = main.app.router.routes.pop()
    main.app.router.routes.insert(0, route)  # ahead of the optional catch-all built UI mount
    try:
        client = TestClient(main.app)
        first = client.get("/test-static/app.js")
        assert first.status_code == 200
        response = client.get("/test-static/app.js", headers={"If-None-Match": first.headers["etag"]})
    finally:
        main.app.router.routes.remove(route)
    assert response.status_code == 304
    assert response.content == b""
    assert "content-length" not in response.headers


CHECKER = Path(__file__).parent / "frontend" / "convex" / "checker.ts"
LISTING_ID = "m9999999"


def checker_limit(name):
    match = re.search(rf"^const {name} = (\d+);", CHECKER.read_text(), re.MULTILINE)
    assert match is not None, f"{name} is missing from checker.ts"
    return int(match.group(1))


def watch(index, seen_count):
    return {
        "id": f"watch_{index}", "description": "Mac mini", "max_price_eur": 500,
        "must_include": None, "postcode": None, "max_distance_km": None,
        "seen_ids": [f"m{i}" for i in range(seen_count)], "seeded": True,
        "watermark": 0, "last_checked_at": None,
    }


def post_check(monkeypatch, watches):
    monkeypatch.setenv("CRON_SECRET", "test-secret")
    calls = []

    def fetch_search(query, filters, offset):
        calls.append((query, filters, offset))
        return {"listings": [{
            "itemId": LISTING_ID, "title": "Mac mini M2", "vipUrl": "/v/mac-mini-m2",
            "date": "Vandaag", "priceInfo": {"priceCents": 40000, "priceType": "MIN_BID"},
        }]}

    def rank_listings(description, listings, raise_on_failure=False):
        assert raise_on_failure
        for listing in listings:
            assert listing["price_type"] == "bidding from"
            listing["score"] = 8
            listing["reason"] = "Matches the watch."
        return listings

    monkeypatch.setattr(agent, "fetch_search", fetch_search)
    monkeypatch.setattr(agent, "rank_listings", rank_listings)
    response = TestClient(main.app).post(
        "/api/internal/check", headers={"X-Cron-Secret": "test-secret"},
        json={"query": "mac mini", "watches": watches},
    )
    assert response.status_code == 200
    assert calls == [("mac mini", {"attributeRanges[]": "PriceCents:null:50000"}, 0)]
    body = response.json()
    assert list(body) == ["results"]
    results = body["results"]
    assert len(results) == len(watches)
    for result, sent in zip(results, watches):
        assert result == {
            "watchId": sent["id"], "ok": True, "aiCall": True, "currentIds": [LISTING_ID],
            "listings": [{
                "id": LISTING_ID, "title": "Mac mini M2", "price_eur": 400,
                "city": None, "distance_km": None, "date": "Vandaag",
                "url": "https://www.marktplaats.nl/v/mac-mini-m2", "image": None,
                "score": 8, "reason": "Matches the watch.",
            }],
            "newestId": 9999999, "waiting": 0, "capped": False,
        }


def test_check_route_accepts_twenty_watches_with_1600_seen_ids(monkeypatch):
    watches = [watch(i, 1600 if i == 0 else 10) for i in range(20)]
    post_check(monkeypatch, watches)


def test_check_route_accepts_convex_batch_limits(monkeypatch):
    # These are the limits used when checker.ts claimDue builds each /api/internal/check request.
    watches = [watch(i, checker_limit("MAX_SEEN_SENT"))
               for i in range(checker_limit("MAX_WATCHES_PER_REQUEST"))]
    post_check(monkeypatch, watches)


def test_embed_route_requires_secret_and_batches(monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "test-secret")
    batches = []
    class FakeEmbeddings:
        def __init__(self, model, dimensions):
            assert model == "text-embedding-3-small"
            assert dimensions == 1536
        def embed_documents(self, texts):
            batches.append(texts)
            return [[0.1] * 1536 for _ in texts]
    monkeypatch.setattr(agent, "OpenAIEmbeddings", FakeEmbeddings)
    client = TestClient(main.app)
    payload = {"texts": [f"item {i}" for i in range(101)]}
    assert client.post("/api/internal/embed", json=payload).status_code == 401
    response = client.post("/api/internal/embed", headers={"X-Cron-Secret": "test-secret"}, json=payload)
    assert response.status_code == 200
    assert len(response.json()["vectors"]) == 101
    assert [len(batch) for batch in batches] == [100, 1]
    assert response.json()["model"] == "text-embedding-3-small"
    assert response.json()["usage"][0] == {"inputTokens": 2, "outputTokens": 0,
                                           "costEur": main.cost_usd("text-embedding-3-small", 2, 0) * main.USD_TO_EUR}


def test_search_helper_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("RAG_ENABLED", raising=False)
    assert agent.search_alerts("alice", "Mac mini") == {"status": "disabled"}
