"""HTTP contract tests for the scheduled check sent by Convex."""

import os
import re
from pathlib import Path

from fastapi.testclient import TestClient

os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("OPENAI_MODEL", "dummy")

import agent
import main


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
            "date": "Vandaag", "priceInfo": {"priceCents": 40000},
        }]}

    def rank_listings(description, listings, raise_on_failure=False):
        assert raise_on_failure
        for listing in listings:
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
            "watchId": sent["id"], "ok": True, "currentIds": [LISTING_ID],
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
