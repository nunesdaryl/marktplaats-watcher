"""Offline tests: the page parser, the tools, login, and the scheduled check. No OpenAI call, no
Marktplaats request."""
import json
import os
import time
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("OPENAI_MODEL", "dummy")

import agent  # noqa: E402

PAGE = (Path(__file__).parent / "tests" / "search_page.html").read_text()  # sanitised, synthetic sellers


def test_parses_listings_without_seller_data():
    listings = agent.parse_listings(PAGE)[0]
    assert len(listings) == 6
    assert listings[0]["id"] == "a9000000001"          # stable id, used to tell new listings from seen ones
    assert listings[0]["title"].startswith("Apple Mac mini M1")
    assert listings[0]["price_eur"] == 425
    assert listings[0]["url"].startswith("https://www.marktplaats.nl/")
    assert all("seller" not in json.dumps(item).lower() for item in listings)


def test_max_price_drops_expensive_and_unpriced_listings():
    prices = [item["price_eur"] for item in agent.parse_listings(PAGE, max_price_eur=500)[0]]
    assert prices and all(p <= 500 for p in prices)
    assert None not in prices  # "see description" listings have no price to compare


def test_tool_is_what_the_model_sees():
    assert agent.search_marktplaats.name == "search_marktplaats"
    assert set(agent.search_marktplaats.args) == {"query", "max_price_eur", "must_include", "postcode", "max_distance_km"}


def test_distance_filter_keeps_only_nearby_listings():
    utrecht = (52.09, 5.12)
    near = agent.parse_listings(PAGE, home=utrecht, max_km=30)[0]
    assert near and all(item["distance_km"] is not None and item["distance_km"] <= 30 for item in near)
    assert len(near) < len(agent.parse_listings(PAGE)[0])  # far or location-less listings dropped


def test_haversine_amsterdam_utrecht_is_about_35_km():
    assert 33 <= agent.distance_km((52.37, 4.89), (52.09, 5.12)) <= 37


def test_spec_filter_matches_titles_ignoring_spaces_and_case():
    titles = [item["title"] for item in agent.parse_listings(PAGE, must_include="16 gb")[0]]
    assert titles and all("16gb" in t.lower().replace(" ", "") for t in titles)


def test_fetch_cache_and_hourly_cap(monkeypatch):
    calls = []

    class Page:
        text = "<html></html>"
        def raise_for_status(self): pass

    monkeypatch.setattr(agent.httpx, "get", lambda *a, **k: calls.append(a) or Page())
    monkeypatch.setattr(agent, "MAX_FETCHES_PER_HOUR", 2)
    agent._page_cache.clear(); agent._fetch_times.clear()
    assert agent.fetch_page("u1") and agent.fetch_page("u1")  # second one comes from the cache
    assert len(calls) == 1
    assert agent.fetch_page("u2") is not None
    assert agent.fetch_page("u3") is None                      # hourly cap reached, no request made
    assert len(calls) == 2


@pytest.fixture
def client(monkeypatch):
    """The API with login switched on, backed by a test signing key instead of Clerk's."""
    from fastapi.testclient import TestClient
    import main
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    class Keys:
        def get_signing_key_from_jwt(self, token):
            return type("Key", (), {"key": private.public_key()})()

    monkeypatch.setattr(main, "_jwks", Keys())
    monkeypatch.setattr(main, "CLERK_ISSUER", "https://clerk.test")
    monkeypatch.setenv("CRON_SECRET", "s3cret")
    main._recent.clear()
    c = TestClient(main.app)
    c.token = lambda sub="user_1", issuer="https://clerk.test", aud="convex": jwt.encode(
        {"sub": sub, "iss": issuer, "aud": aud, "exp": int(time.time()) + 60}, private, algorithm="RS256")
    c.main = main
    return c


def test_chat_needs_a_valid_login(client, monkeypatch):
    monkeypatch.setattr(client.main, "chat", lambda *a: {"answer": "ok"})
    assert client.post("/api/chat", json={"message": "hi"}).status_code == 401
    wrong_issuer = {"Authorization": f"Bearer {client.token(issuer='https://evil.test')}"}
    assert client.post("/api/chat", json={"message": "hi"}, headers=wrong_issuer).status_code == 401
    wrong_audience = {"Authorization": f"Bearer {client.token(aud='some-other-app')}"}
    assert client.post("/api/chat", json={"message": "hi"}, headers=wrong_audience).status_code == 401
    ok = {"Authorization": f"Bearer {client.token()}"}
    assert client.post("/api/chat", json={"message": "hi"}, headers=ok).json() == {"answer": "ok"}


def test_rate_limit_is_per_user(client, monkeypatch):
    monkeypatch.setattr(client.main, "chat", lambda *a: {"answer": "ok"})
    monkeypatch.setattr(client.main, "RATE_PER_MINUTE", 2)
    me = {"Authorization": f"Bearer {client.token('user_1')}"}
    codes = [client.post("/api/chat", json={"message": "hi"}, headers=me).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    other = {"Authorization": f"Bearer {client.token('user_2')}"}
    assert client.post("/api/chat", json={"message": "hi"}, headers=other).status_code == 200


@pytest.mark.parametrize("error", ["Error code: 401 - invalid_api_key",
                                   "Error code: 429 - {'code': 'credit_balance_exhausted'}"])
def test_offline_model_gives_a_clear_message(client, monkeypatch, error):
    def gone(*a):
        raise RuntimeError(error)
    monkeypatch.setattr(client.main, "chat", gone)
    headers = {"Authorization": f"Bearer {client.token()}"}
    answer = client.post("/api/chat", json={"message": "hi"}, headers=headers).json()["answer"]
    assert "offline" in answer and "watches keep running" in answer


def test_internal_check_needs_the_cron_secret(client, monkeypatch):
    monkeypatch.setattr(client.main, "check_query", lambda q, w: [{"watchId": "w1", "ok": True}])
    body = {"query": "mac mini", "watches": [{"id": "w1"}]}
    assert client.post("/api/internal/check", json=body).status_code == 401
    assert client.post("/api/internal/check", json=body, headers={"X-Cron-Secret": "nope"}).status_code == 401
    ok = client.post("/api/internal/check", json=body, headers={"X-Cron-Secret": "s3cret"})
    assert ok.json() == {"results": [{"watchId": "w1", "ok": True}]}


def test_check_query_returns_only_unseen_listings_ranked(monkeypatch):
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: PAGE)

    class FakeRanker:
        def invoke(self, messages):
            listings = json.loads(messages[-1]["content"])["listings"]
            return agent.Ranking(ranks=[agent.Rank(id=i["id"], score=7, reason="fair price") for i in listings])

    monkeypatch.setattr(agent, "ranker", FakeRanker())
    all_ids = [i["id"] for i in agent.parse_listings(PAGE)[0]]
    [result] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": all_ids[1:]}])
    assert result["ok"] and result["currentIds"] == all_ids
    assert [i["id"] for i in result["listings"]] == [all_ids[0]]     # only the one not seen before
    assert result["listings"][0]["score"] == 7 and result["listings"][0]["reason"] == "fair price"


def test_ranking_failure_leaves_listings_unranked_instead_of_dropping_them(monkeypatch):
    class BrokenRanker:
        def invoke(self, messages):
            raise RuntimeError("model down")
    monkeypatch.setattr(agent, "ranker", BrokenRanker())
    ranked = agent.rank_listings("mac mini", [{"id": "a1", "title": "Mac mini"}])
    assert ranked[0]["score"] is None and "unavailable" in ranked[0]["reason"]


def test_chat_can_only_propose_watches_never_save_them():
    ctx = agent.ChatContext([{"id": "w1", "label": "Mac mini"}])
    _, propose, change = agent.make_tools(ctx)
    propose.invoke({"query": "mac mini", "schedule_kind": "weekly", "days": ["fri", "mon"], "times": ["18:00"]})
    assert ctx.proposals[0]["schedule"] == {"kind": "weekly", "days": ["mon", "fri"], "time": "18:00"}
    assert "Invalid" in propose.invoke({"query": "x", "schedule_kind": "interval", "every_minutes": 1})
    assert "Unknown watch_id" in change.invoke({"watch_id": "someone-elses", "active": False})
    change.invoke({"watch_id": "w1", "schedule_kind": "daily", "times": ["20:00", "08:00"]})
    assert ctx.proposals[-1] == {"type": "update", "watchId": "w1", "label": "Mac mini",
                                 "schedule": {"kind": "daily", "times": ["08:00", "20:00"]}}


def test_broken_page_json_means_no_listings_not_a_crash():
    html = '<script id="__NEXT_DATA__" type="application/json">{not json</script>'
    assert agent.parse_listings(html) == ([], {"on_page": 0, "price_ok": 0, "with_location": 0})
