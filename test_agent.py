"""Offline tests: the page parser, the tools, login, and the scheduled check. No OpenAI call, no
Marktplaats request."""
import json
import os
import re
import time
from pathlib import Path

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("OPENAI_MODEL", "dummy")

import agent  # noqa: E402

PAGE = (Path(__file__).parent / "tests" / "search_page.html").read_text()  # sanitised, synthetic sellers


@pytest.fixture(autouse=True)
def search_from_fake_page(monkeypatch):
    """Scheduled checks read the date-sorted search (fetch_search). Tests that fake a search page with fetch_page
    get that page's listings as its one and only page. Tests of the reading itself replace this."""
    def fake(query, filters, offset):
        match = agent.NEXT_DATA.search(agent.fetch_page(agent.search_url(query), capped=False) or "")
        listings = agent.find_listings(json.loads(match.group(1))) if match else None
        if listings is None:
            raise ValueError("no listings in the answer")
        return {"listings": listings if offset == 0 else [], "maxAllowedPageNumber": 1}
    monkeypatch.setattr(agent, "fetch_search", fake)


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


def test_health_is_hidden_without_the_owner_key(client, monkeypatch):
    monkeypatch.delenv("HEALTH_KEY", raising=False)
    assert client.get("/api/health").status_code == 404                        # not configured: hidden for everyone
    monkeypatch.setenv("HEALTH_KEY", "k3y")
    assert client.get("/api/health").status_code == 404                        # no key
    assert client.get("/api/health", headers={"X-Health-Key": "wrong"}).status_code == 404
    signed_in = {"Authorization": f"Bearer {client.token()}"}                   # a login is not enough
    assert client.get("/api/health", headers=signed_in).status_code == 404
    assert client.get("/api/health", headers={"X-Health-Key": "k3y"}).json() == {"ok": True}


def test_chat_needs_a_valid_login(client, monkeypatch):
    monkeypatch.setattr(client.main, "chat", lambda *a: {"answer": "ok"})
    assert client.post("/api/chat", json={"message": "hi"}).status_code == 401
    wrong_issuer = {"Authorization": f"Bearer {client.token(issuer='https://evil.test')}"}
    assert client.post("/api/chat", json={"message": "hi"}, headers=wrong_issuer).status_code == 401
    wrong_audience = {"Authorization": f"Bearer {client.token(aud='some-other-app')}"}
    assert client.post("/api/chat", json={"message": "hi"}, headers=wrong_audience).status_code == 401
    ok = {"Authorization": f"Bearer {client.token()}"}
    assert client.post("/api/chat", json={"message": "hi"}, headers=ok).json() == {"answer": "ok", "saved": False}


def test_rate_limit_is_per_user(client, monkeypatch):
    monkeypatch.setattr(client.main, "chat", lambda *a: {"answer": "ok"})
    monkeypatch.setattr(client.main, "RATE_PER_MINUTE", 2)
    me = {"Authorization": f"Bearer {client.token('user_1')}"}
    codes = [client.post("/api/chat", json={"message": "hi"}, headers=me).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    other = {"Authorization": f"Bearer {client.token('user_2')}"}
    assert client.post("/api/chat", json={"message": "hi"}, headers=other).status_code == 200


@pytest.mark.parametrize("path", ["/api/chat", "/api/chat/stream"])
def test_chat_paused_stops_model_and_usage(client, monkeypatch, path):
    monkeypatch.setenv("CHAT_PAUSED", "1")
    calls = []
    monkeypatch.setattr(client.main, "chat_allowance", lambda user: calls.append("usage"))
    monkeypatch.setattr(client.main, "chat", lambda *a: calls.append("model"))
    monkeypatch.setattr(client.main, "chat_events", lambda *a: calls.append("model"))
    response = client.post(path, json={"message": "hi"}, headers={"Authorization": f"Bearer {client.token()}"})
    assert response.status_code == 503
    assert response.json() == {"answer": "Chat is paused for maintenance; your watches keep running."}
    assert calls == []


@pytest.mark.parametrize("path", ["/api/chat", "/api/chat/stream"])
def test_daily_limit_stops_model(client, monkeypatch, path):
    monkeypatch.delenv("CHAT_PAUSED", raising=False)
    monkeypatch.setattr(client.main, "chat_allowance", lambda user: {"allowed": False, "limit": 40})
    calls = []
    monkeypatch.setattr(client.main, "chat", lambda *a: calls.append("model"))
    monkeypatch.setattr(client.main, "chat_events", lambda *a: calls.append("model"))
    response = client.post(path, json={"message": "hi"}, headers={"Authorization": f"Bearer {client.token()}"})
    answer = "You've reached today's limit of 40 questions. It resets at midnight."
    if path.endswith("stream"):
        assert response.status_code == 200
        assert [json.loads(line)["answer"] for line in response.text.splitlines()] == [answer]
    else:
        assert response.status_code == 429
        assert response.json() == {"answer": answer}
    assert calls == []


def test_usage_check_fails_open(client, monkeypatch, capsys):
    monkeypatch.delenv("CONVEX_SITE_URL", raising=False)
    monkeypatch.setattr(client.main, "chat", lambda *a: {"answer": "ok"})
    response = client.post("/api/chat", json={"message": "hi"}, headers={"Authorization": f"Bearer {client.token()}"})
    assert response.json() == {"answer": "ok", "saved": False}
    assert '"event": "usage_check_failed"' in capsys.readouterr().out


def test_usage_check_sends_verified_clerk_id_with_shared_secret(client, monkeypatch):
    import convex_api

    monkeypatch.setenv("CONVEX_SITE_URL", "https://deployment.convex.site")
    monkeypatch.setenv("API_TO_CONVEX_SECRET", "secret")
    sent = []

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"allowed": False, "used": 2, "limit": 2}

    monkeypatch.setattr(convex_api.httpx, "post", lambda *a, **kw: sent.append((a, kw)) or Response())
    monkeypatch.setattr(client.main, "chat", lambda *a: pytest.fail("model was called"))
    response = client.post("/api/chat", json={"message": "hi"}, headers={"Authorization": f"Bearer {client.token('alice')}"})
    assert response.status_code == 429
    assert "2 questions" in response.json()["answer"]
    assert sent == [(("https://deployment.convex.site/api/usage/consume",),
                     {"json": {"clerkId": "alice"}, "headers": {"X-Api-Secret": "secret"}, "timeout": 5})]


@pytest.mark.parametrize("path", ["/api/chat", "/api/chat/stream"])
@pytest.mark.parametrize("fails", [False, True])
def test_chat_saves_final_answer_once_and_reports_failure(client, monkeypatch, capsys, path, fails):
    import convex_api

    monkeypatch.setenv("CONVEX_SITE_URL", "https://deployment.convex.site")
    monkeypatch.setenv("API_TO_CONVEX_SECRET", "secret")
    monkeypatch.setattr(client.main, "chat_allowance", lambda user: {"allowed": True})
    final = {"answer": "A useful answer.", "listings": [], "proposals": [], "searches": [],
             "usage": {"input_tokens": 1, "output_tokens": 2, "model_calls": 1, "tool_calls": 0}}
    monkeypatch.setattr(client.main, "chat", lambda *a: final)
    monkeypatch.setattr(client.main, "chat_events", lambda *a: iter([{"type": "done", **final}]))
    sent = []

    class Response:
        def raise_for_status(self):
            if fails:
                raise RuntimeError("write failed")

        def json(self):
            return {"id": "message"}

    monkeypatch.setattr(convex_api.httpx, "post", lambda *a, **kw: sent.append((a, kw)) or Response())
    response = client.post(path, json={"message": "hi", "chatId": "chat-id"},
                           headers={"Authorization": f"Bearer {client.token('alice')}"})
    result = json.loads(response.text.splitlines()[-1]) if path.endswith("stream") else response.json()
    assert result["answer"] == "A useful answer."
    assert result["saved"] is not fails
    assert len(sent) == 1
    assert sent[0][0] == ("https://deployment.convex.site/api/chats/assistant",)
    assert sent[0][1]["json"] == {"clerkId": "alice", "chatId": "chat-id", "content": "A useful answer.",
                                   "listings": [], "proposals": []}
    assert ('"event": "assistant_save_failed"' in capsys.readouterr().out) is fails


@pytest.mark.parametrize("path", ["/api/chat", "/api/chat/stream"])
def test_minute_limit_precedes_daily_allowance(client, monkeypatch, path):
    calls = []
    monkeypatch.setattr(client.main, "too_many", lambda user: calls.append("minute") or True)
    monkeypatch.setattr(client.main, "chat_allowance", lambda user: calls.append("daily"))
    response = client.post(path, json={"message": "hi"}, headers={"Authorization": f"Bearer {client.token()}"})
    assert response.status_code == 429
    assert calls == ["minute"]


def test_stream_error_and_daily_limit_are_saved(client, monkeypatch):
    saved = []
    monkeypatch.setattr(client.main, "convex_post", lambda path, payload: saved.append((path, payload)))
    monkeypatch.setattr(client.main, "chat_allowance", lambda user: {"allowed": False, "limit": 40})
    headers = {"Authorization": f"Bearer {client.token()}"}
    response = client.post("/api/chat/stream", json={"message": "hi", "chatId": "chat-id"}, headers=headers)
    done = json.loads(response.text)
    assert done["saved"] is True
    assert saved[0][1]["content"] == done["answer"]

    monkeypatch.setattr(client.main, "chat_allowance", lambda user: {"allowed": True})
    monkeypatch.setattr(client.main, "chat_events", lambda *a: iter([{"type": "error", "text": "Try again."}]))
    response = client.post("/api/chat/stream", json={"message": "hi", "chatId": "chat-id"}, headers=headers)
    error = json.loads(response.text)
    assert error == {"type": "error", "text": "Try again.", "saved": True}
    assert len(saved) == 2 and saved[1][1]["content"] == "Try again."


@pytest.mark.parametrize("error", ["Error code: 401 - invalid_api_key",
                                   "Error code: 429 - {'code': 'credit_balance_exhausted'}"])
def test_offline_model_gives_a_clear_message(client, monkeypatch, error):
    def gone(*a):
        raise RuntimeError(error)
    monkeypatch.setattr(client.main, "chat", gone)
    headers = {"Authorization": f"Bearer {client.token()}"}
    res = client.post("/api/chat", json={"message": "hi"}, headers=headers)
    assert res.status_code == 503                       # monitoring sees it; the body stays user-friendly
    assert "can't reach its AI" in res.json()["answer"]


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
    all_ids = [i["id"] for i in agent.parse_listings(PAGE, limit=None)[0]]
    [result] = agent.check_query("mac mini", [{"id": "w1", "watermark": 0, "seen_ids": all_ids[1:]}])
    assert result["ok"] and result["currentIds"] == all_ids
    assert [i["id"] for i in result["listings"]] == [all_ids[0]]     # only the one not seen before
    assert result["listings"][0]["score"] == 7 and result["listings"][0]["reason"] == "fair price"


def test_search_url_uses_plus_for_spaces_like_the_site():
    # "mac-mini" searches for the literal word "mac-mini": 163 results, nearly all shop ads, instead of 622
    assert agent.search_url("Mac Mini ") == "https://www.marktplaats.nl/q/mac+mini/"
    assert agent.search_url("iphone 13 pro") == "https://www.marktplaats.nl/q/iphone+13+pro/"
    assert agent.search_url("fiets/kinder") == "https://www.marktplaats.nl/q/fiets%2Fkinder/"   # stays one path part


def api_page(rows, max_page=167):
    """rows: (number, date label[, "DAGTOPPER"])"""
    return {"maxAllowedPageNumber": max_page, "listings": [
        {"itemId": f"m{r[0]}", "title": f"Mac mini {r[0]}", "vipUrl": f"/v/m{r[0]}", "date": r[1],
         "priceInfo": {"priceCents": 40000}, "priorityProduct": r[2] if len(r) > 2 else "NONE"} for r in rows]}


def serve_search(monkeypatch, pages):
    """Date-sorted pages by number; records (filters, page) of each read."""
    read = []
    def fake(query, filters, offset):
        read.append((json.dumps(filters, sort_keys=True), offset // agent.PAGE_SIZE))
        return pages[offset // agent.PAGE_SIZE]
    monkeypatch.setattr(agent, "fetch_search", fake)
    monkeypatch.setattr(agent, "ranker", CountingRanker())
    return read


NOW = agent.datetime(2026, 9, 29, 21, 0, tzinfo=agent.AMSTERDAM)
EARLIER_TODAY = int(agent.datetime(2026, 9, 29, 20, 45, tzinfo=agent.AMSTERDAM).timestamp() * 1000)
YESTERDAY = int(agent.datetime(2026, 9, 28, 23, 50, tzinfo=agent.AMSTERDAM).timestamp() * 1000)


def today_page(first, n=30):
    # Within a day Marktplaats shows listings in no set order: mix old and new numbers
    return [(first - (i * 7919) % 97, "Vandaag") for i in range(n)]


def test_check_reads_every_page_of_the_days_since_the_last_check(monkeypatch):
    # Checked yesterday at 23:50: today's and yesterday's listings are read, the reading stops at an older day
    pages = [api_page(today_page(5000)), api_page(today_page(4900, 20) + [(3000 + i, "Gisteren") for i in range(10)]),
             api_page([(2900 + i, "Gisteren") for i in range(25)] + [(2000 + i, "27 sep 26") for i in range(5)]),
             api_page([(1000 + i, "20 sep 26") for i in range(30)])]
    read = serve_search(monkeypatch, pages)
    [r] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": [], "watermark": 1, "last_checked_at": YESTERDAY}], now=NOW)
    assert [p for _, p in read] == [0, 1, 2]
    # checked earlier today: only today's listings; page 2 reaches yesterday, so it stops there
    read.clear()
    agent.check_query("mac mini", [{"id": "w1", "seen_ids": [], "watermark": 1, "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert [p for _, p in read] == [0, 1]


def test_paid_listings_of_older_days_dont_end_the_reading(monkeypatch):
    page1 = [(100, "20 sep 26", "DAGTOPPER"), (101, "12 sep 26", "DAGTOPPER")] + today_page(5000, 28)
    read = serve_search(monkeypatch, [api_page(page1), api_page([(4000 + i, "Gisteren") for i in range(30)])])
    agent.check_query("mac mini", [{"id": "w1", "seen_ids": [], "watermark": 1, "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert [p for _, p in read] == [0, 1]


def test_new_means_unseen_even_below_the_watermark(monkeypatch):
    # A listing first seen after it goes live or is re-dated may have a number below the watermark.
    serve_search(monkeypatch, [api_page([(5001, "Vandaag"), (4000, "Vandaag"), (4999, "Vandaag"), (3000, "Gisteren")])])
    [r] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": ["m4999"], "watermark": 4500,
                                          "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert [i["id"] for i in r["listings"]] == ["m5001", "m4000", "m3000"]
    assert set(r["currentIds"]) == {"m5001", "m4000", "m4999", "m3000"}     # all remembered
    assert r["newestId"] == 5001


def test_unseen_a_id_is_fresh_and_seen_a_id_is_not(monkeypatch):
    page = api_page([(5001, "Vandaag")])
    page["listings"].append({**page["listings"][0], "itemId": "a1531512320", "vipUrl": "/v/a1531512320"})
    serve_search(monkeypatch, [page])
    watches = [{"id": "unseen", "seen_ids": [], "watermark": 5000, "last_checked_at": EARLIER_TODAY},
               {"id": "seen", "seen_ids": ["a1531512320"], "watermark": 5000,
                "last_checked_at": EARLIER_TODAY}]
    unseen, seen = agent.check_query("mac mini", watches, now=NOW)
    assert [i["id"] for i in unseen["listings"]] == ["m5001", "a1531512320"]
    assert [i["id"] for i in seen["listings"]] == ["m5001"]
    assert unseen["newestId"] == seen["newestId"] == 5001
    assert agent.listing_number("a1531512320") is None


def test_first_look_reads_all_of_today_and_starts_the_watermark(monkeypatch):
    first_page = api_page(today_page(5000))
    first_page["listings"][0].update(itemId="a1531512320", vipUrl="/v/a1531512320")
    read = serve_search(monkeypatch, [first_page, api_page(today_page(4950, 10) + [(10, "Gisteren")] * 5)])
    [r] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": [], "seeded": False}], now=NOW)
    assert [p for _, p in read] == [0, 1] and r["listings"] == [] and r["newestId"] == 4997
    assert "a1531512320" in r["currentIds"]


def test_the_watchs_price_and_distance_go_to_marktplaats_and_same_filters_share_a_read(monkeypatch):
    monkeypatch.setattr(agent, "postcode_location", lambda pc: (52.37, 4.89))
    read = serve_search(monkeypatch, [api_page([(10, "Gisteren")])])
    w = {"seen_ids": [], "watermark": 1, "last_checked_at": EARLIER_TODAY}
    agent.check_query("iphone 13", [{**w, "id": "a", "max_price_eur": 500, "postcode": "1012 ab", "max_distance_km": 20},
                                    {**w, "id": "b", "max_price_eur": 500, "postcode": "1012AB", "max_distance_km": 20},
                                    {**w, "id": "c"}], now=NOW)
    assert sorted(f for f, _ in read) == sorted(json.dumps(f, sort_keys=True) for f in [   # read in parallel
        {"attributeRanges[]": "PriceCents:null:50000", "postcode": "1012AB", "distanceMeters": 20000}, {}])


@pytest.mark.parametrize("failure", ["503", "html", "timeout", "malformed_json", "missing_docs"])
def test_postcode_service_failure_returns_a_message_and_chat_completes(monkeypatch, failure):
    import httpx

    agent.postcode_location.cache_clear()
    def fake_get(url, **kwargs):
        if failure == "timeout":
            raise httpx.ConnectTimeout("PDOK unavailable")
        body = {"503": (503, "down"), "html": (200, "<html>down</html>"),
                "malformed_json": (200, "{"), "missing_docs": (200, '{"response": {}}')}[failure]
        return httpx.Response(body[0], text=body[1], request=httpx.Request("GET", url))

    monkeypatch.setattr(agent.httpx, "get", fake_get)
    message = "The postcode service is unavailable right now; try again without a postcode or later."
    assert agent.search_marktplaats.invoke({"query": "mac mini", "postcode": "1012AB"}) == message

    class Searcher:
        def __init__(self):
            self.turn = 0

        def stream(self, messages):
            from langchain_core.messages import AIMessageChunk
            self.turn += 1
            if self.turn == 1:
                yield AIMessageChunk(content="", tool_call_chunks=[
                    {"name": "search_marktplaats", "args": '{"query": "mac mini", "postcode": "1012AB"}',
                     "id": "c1", "index": 0}])
            else:
                assert messages[-1].content == message
                yield AIMessageChunk(content="The postcode service is unavailable right now.")

    monkeypatch.setattr(agent, "model", Searcher())
    assert agent.chat("find mac mini near 1012AB", [])["answer"] == "The postcode service is unavailable right now."


@pytest.mark.parametrize("failure", ["503", "html", "timeout", "malformed_json", "missing_docs"])
def test_postcode_service_failure_keeps_both_scheduled_watches_running(monkeypatch, failure):
    import httpx

    agent.postcode_location.cache_clear()
    def fake_get(url, **kwargs):
        if failure == "timeout":
            raise httpx.ConnectTimeout("PDOK unavailable")
        body = {"503": (503, "down"), "html": (200, "<html>down</html>"),
                "malformed_json": (200, "{"), "missing_docs": (200, '{"response": {}}')}[failure]
        return httpx.Response(body[0], text=body[1], request=httpx.Request("GET", url))

    monkeypatch.setattr(agent.httpx, "get", fake_get)
    page = api_page([(10, "Vandaag")])
    page["listings"][0]["location"] = {"latitude": 52.37, "longitude": 4.89, "cityName": "Amsterdam"}
    read = serve_search(monkeypatch, [page])
    watch = {"watermark": 1, "seen_ids": [], "last_checked_at": EARLIER_TODAY}
    results = agent.check_query("mac mini", [
        {**watch, "id": "postcode", "postcode": "1012AB", "max_distance_km": 20},
        {**watch, "id": "anywhere"}], now=NOW)
    assert {r["watchId"] for r in results} == {"postcode", "anywhere"}
    assert all(r["ok"] and r["currentIds"] == ["m10"] for r in results)
    assert all(r["listings"][0]["distance_km"] is None for r in results)
    assert {filters for filters, _ in read} == {
        json.dumps({"postcode": "1012AB", "distanceMeters": 20000}, sort_keys=True), "{}"}


def test_unknown_postcode_is_distinct_from_a_service_failure(monkeypatch):
    import httpx

    agent.postcode_location.cache_clear()
    monkeypatch.setattr(agent.httpx, "get", lambda url, **kwargs: httpx.Response(
        200, json={"response": {"docs": []}}, request=httpx.Request("GET", url)))
    assert agent.search_marktplaats.invoke({"query": "mac mini", "postcode": "0000ZZ"}) == \
        "Unknown Dutch postcode '0000ZZ'."
    results = agent.check_query("mac mini", [{"id": "unknown", "postcode": "0000ZZ"}], now=NOW)
    assert results == [{"watchId": "unknown", "ok": False,
                        "error": "We couldn't find postcode 0000ZZ. Edit the watch to use another postcode."}]


def test_postcode_service_failure_is_not_cached(monkeypatch):
    import httpx

    agent.postcode_location.cache_clear()
    calls = []
    def fake_get(url, **kwargs):
        calls.append(url)
        if len(calls) == 1:
            raise httpx.ConnectTimeout("PDOK unavailable")
        return httpx.Response(200, json={"response": {"docs": [{"centroide_ll": "POINT(4.89 52.37)"}]}},
                              request=httpx.Request("GET", url))

    monkeypatch.setattr(agent.httpx, "get", fake_get)
    assert agent.search_marktplaats.invoke({"query": "mac mini", "postcode": "1012AB"}) == \
        "The postcode service is unavailable right now; try again without a postcode or later."
    assert agent.postcode_location("1012AB") == (52.37, 4.89)
    assert len(calls) == 2


def test_reading_stops_at_the_last_page_and_at_the_cap(monkeypatch):
    w = [{"id": "w1", "seen_ids": [], "watermark": 1, "last_checked_at": EARLIER_TODAY}]
    read = serve_search(monkeypatch, [api_page(today_page(5000), max_page=2), api_page(today_page(4000), max_page=2)])
    agent.check_query("mac mini", w, now=NOW)
    assert [p for _, p in read] == [0, 1]                               # Marktplaats' own last page
    read = serve_search(monkeypatch, [api_page(today_page(5000)), api_page(today_page(4000, 3))])
    agent.check_query("mac mini", w, now=NOW)
    assert [p for _, p in read] == [0, 1]                               # a short page is the last one
    monkeypatch.setattr(agent, "MAX_PAGES", 3)
    read = serve_search(monkeypatch, [api_page(today_page(9000 - 100 * i)) for i in range(5)])
    [result] = agent.check_query("mac mini", w, now=NOW)
    assert [p for _, p in read] == [0, 1, 2]                            # the safety cap
    assert result["capped"] is True


def test_seen_window_exceeds_one_complete_read():
    checker = (Path(__file__).parent / "frontend" / "convex" / "checker.ts").read_text()
    sent = int(re.search(r"const MAX_SEEN_SENT = (\d+);", checker).group(1))
    main = (Path(__file__).parent / "main.py").read_text()
    check_limit = int(re.search(r"seen_ids: list\[str\] = Field\(default=\[\], max_length=(\d+)\)", main).group(1))
    python = (Path(__file__).parent / "agent.py").read_text()
    pages = int(re.search(r"^MAX_PAGES = (\d+)", python, re.MULTILINE).group(1))
    size = int(re.search(r"^PAGE_SIZE = (\d+)", python, re.MULTILINE).group(1))
    assert sent > pages * size
    assert check_limit >= sent


def test_full_read_reports_coverage_cap(monkeypatch):
    pages = [api_page([(9000 - page * agent.PAGE_SIZE - i, "Vandaag") for i in range(agent.PAGE_SIZE)])
             for page in range(agent.MAX_PAGES)]
    read = serve_search(monkeypatch, pages)
    [result] = agent.check_query("mac mini", [{"id": "w1", "watermark": 0, "seen_ids": [],
                                               "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert len(read) == agent.MAX_PAGES
    assert result["capped"] is True
    assert result["waiting"] == agent.MAX_PAGES * agent.PAGE_SIZE - agent.MAX_RANK_PER_CHECK


def test_scoring_bound_keeps_the_watermark_below_listings_still_waiting(monkeypatch):
    page = api_page([(5000 - i, "Vandaag") for i in range(25)] + [(10, "Gisteren")])
    page["listings"].append({**page["listings"][0], "itemId": "a1531512320", "vipUrl": "/v/a1531512320"})
    serve_search(monkeypatch, [page])
    [r] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": [], "watermark": 100, "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert len(r["listings"]) == agent.MAX_RANK_PER_CHECK
    assert "a1531512320" not in r["currentIds"] and "m10" not in r["currentIds"]
    assert r["newestId"] == 9                                           # the m listings still waiting bound it
    [next_check] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": r["currentIds"],
                                                  "watermark": r["newestId"],
                                                  "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert "a1531512320" in [item["id"] for item in next_check["listings"]]
    assert "a1531512320" in next_check["currentIds"]


def test_a_failing_later_page_fails_that_watch(monkeypatch):
    def fake(query, filters, offset):
        if offset:
            raise ValueError("no listings in the answer")
        return api_page(today_page(5000))
    monkeypatch.setattr(agent, "fetch_search", fake)
    [r] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": [], "watermark": 1, "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert not r["ok"] and "unexpected page" in r["error"]


def test_a_watch_without_a_watermark_takes_a_silent_first_look(monkeypatch):
    # Watches checked before the date-sorted search have no watermark: their seen list is from the old page, so
    # everything would look new. They note what's there instead, whichever of the API and Convex deploys first
    read = serve_search(monkeypatch, [api_page(today_page(5000, 10) + [(10, "Gisteren")])])
    [r] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": ["m1"], "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert r["ok"] and r["listings"] == [] and r["newestId"] == 5000 and len(r["currentIds"]) == 11


def test_listing_dates_are_read_as_days_ago():
    today = agent.date(2026, 9, 29)
    assert [agent.days_old(x, today) for x in ["Vandaag", "Gisteren", "Eergisteren", "26 sep 26", "14 sep. '26", "?"]] == \
        [0, 1, 2, 3, 15, None]


def test_fetch_search_asks_for_date_order_with_filters_and_rejects_odd_answers(monkeypatch):
    import httpx
    calls = []
    def fake_get(url, params=None, **kw):
        calls.append((url, params))
        return httpx.Response(200, json={"hasErrors": True}, request=httpx.Request("GET", url))
    monkeypatch.undo()                                                  # the real fetch_search, a fake network
    monkeypatch.setattr(agent.httpx, "get", fake_get)
    with pytest.raises(ValueError):
        agent.fetch_search("Mac Mini", {"postcode": "1012AB"}, 30)
    url, params = calls[0]
    assert url == "https://www.marktplaats.nl/lrp/api/search"
    assert params["query"] == "mac mini" and params["offset"] == 30 and params["postcode"] == "1012AB"
    assert params["sortBy"] == "SORT_INDEX" and params["sortOrder"] == "DECREASING"


def test_rank_listings_chunks_in_order_and_retries_omissions_per_chunk(monkeypatch):
    calls = []
    class PartialRanker:
        def invoke(self, messages):
            ids = [item["id"] for item in json.loads(messages[-1]["content"])["listings"]]
            calls.append(ids)
            scored = ids[:-1] if len(ids) > 1 else ids
            return agent.Ranking(ranks=[agent.Rank(id=ident, score=int(ident[1:]) % 11, reason="match")
                                        for ident in reversed(scored)])
    monkeypatch.setattr(agent, "ranker", PartialRanker())
    listings = [{"id": f"n{i}"} for i in range(23)]
    ranked = agent.rank_listings("mac mini", listings)
    assert agent.RANK_BATCH == 10 and agent.MAX_RANK_PER_CHECK == 20
    assert calls == [[f"n{i}" for i in range(10)], ["n9"],
                     [f"n{i}" for i in range(10, 20)], ["n19"], ["n20", "n21", "n22"], ["n22"]]
    assert [item["id"] for item in ranked] == [f"n{i}" for i in range(23)]
    assert [item["score"] for item in ranked] == [i % 11 for i in range(23)]


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
    assert agent.parse_listings(html) == ([], {"on_page": 0, "price_ok": 0, "with_location": 0, "readable": False})


def test_listing_photos_only_come_from_marktplaats_image_hosts():
    ok = {"imageUrls": ["//admarkt-cdn.marktplaats.com/api/v1/images/57/abc?rule=eps_82.JPG"]}
    assert agent.listing_image(ok) == "https://admarkt-cdn.marktplaats.com/api/v1/images/57/abc?rule=eps_82.JPG"
    for bad in (["https://evil.example/x.jpg"], ["http://images.marktplaats.com/x.jpg"],
                ["//marktplaats.com.evil.example/x.jpg"], ["javascript:alert(1)"], [], None, [42]):
        assert agent.listing_image({"imageUrls": bad}) is None
    assert all("image" in item for item in agent.parse_listings(PAGE)[0])


class FakeStreamingModel:
    """Streams a tool call first, then an answer in two chunks, like the real model does."""
    def __init__(self):
        self.calls = 0

    def stream(self, messages):
        from langchain_core.messages import AIMessageChunk
        self.calls += 1
        if self.calls == 1:
            yield AIMessageChunk(content="", tool_call_chunks=[
                {"name": "search_marktplaats", "args": '{"query": "mac mini"}', "id": "call_1", "index": 0}])
        else:
            yield AIMessageChunk(content="The i5 at €230 ")
            yield AIMessageChunk(content="looks best.")


def test_chat_streams_status_then_listing_cards_then_the_answer(monkeypatch):
    monkeypatch.setattr(agent, "model", FakeStreamingModel())
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: PAGE)
    events = list(agent.chat_events("mac mini", []))
    kinds = [e["type"] for e in events]
    assert kinds == ["status", "listings", "delta", "delta", "done"]
    assert "mac mini" in events[0]["text"]
    assert len(events[1]["listings"]) == 6 and events[1]["listings"][0]["id"] == "a9000000001"
    done = events[-1]
    assert done["answer"] == "The i5 at €230 looks best." and done["searches"] == [{"query": "mac mini"}]
    assert agent.chat("mac mini", [])["answer"] == "The i5 at €230 looks best."  # non-streaming wrapper


def test_model_output_caps_match_chat_and_ranking_workloads():
    assert agent.base_model.max_tokens == 1500
    assert agent.ranker.first.steps__["raw"].bound.max_tokens == 2500


def test_rank_prompt_caps_accessory_only_listings_and_tracks_version():
    assert agent.PROMPT_VERSION["rank"] == "rank-2026-10-01.1"
    assert "accessory, part, add-on or kit" in agent.RANK_PROMPT
    assert "0–4" in agent.RANK_PROMPT
    assert "unless the watch explicitly asks for accessories" in agent.RANK_PROMPT


def test_scorer_loads_and_counts_accessory_cases(monkeypatch):
    from evals import run_scorer
    from evals.common import LABELS, LISTINGS, read

    expected = {
        "mw22-display-frames": False,
        "mw22-maker-kit": False,
        "mw22-epaper-display": False,
        "mw22-pi-4": True,
    }
    data, labels = read(LISTINGS), read(LABELS)["labels"]
    assert {listing["id"]: labels[listing["id"]]["match"] for listing in data["listings"]
            if listing["id"] in expected} == expected
    assert any(w["id"] == "raspberry-pi" and w["description"] == "Raspberry Pi, under €150"
               for w in data["watches"])

    results = {}
    monkeypatch.setattr(run_scorer, "model_under_test", lambda: "gpt-5.5")
    monkeypatch.setattr(run_scorer.agent, "rank_listings", lambda _description, listings:
                        [dict(item, score=8 if expected.get(item["id"], False) else 2, reason="test")
                         for item in listings])
    monkeypatch.setattr(run_scorer, "write", lambda _path, data: results.update(data))
    run_scorer.main()
    assert {row["id"] for row in results["scored"] if row["id"] in expected} == set(expected)
    assert results["listings"] == len(data["listings"])


def test_chat_deadline_stops_before_a_second_model_call(monkeypatch):
    clock = [0]
    llm = FakeStreamingModel()
    searches = []
    monkeypatch.setattr(agent, "model", llm)

    def fetch(url, capped=True):
        searches.append(url)
        clock[0] = 61
        return PAGE

    monkeypatch.setattr(agent, "fetch_page", fetch)
    events = list(agent.chat_events("mac mini", [], clock=lambda: clock[0]))
    assert llm.calls == 1 and len(searches) == 1
    assert [event["type"] for event in events] == ["status", "listings", "reset", "delta", "done"]
    assert events[-1]["answer"] == "That took too long. Please try again, maybe with a simpler question."


def test_chat_deadline_stops_before_the_next_tool_call(monkeypatch):
    from langchain_core.messages import AIMessageChunk
    clock = [0]
    calls = []

    class TwoSearches:
        def stream(self, messages):
            yield AIMessageChunk(content="", tool_call_chunks=[
                {"name": "search_marktplaats", "args": '{"query": "first"}', "id": "c1", "index": 0},
                {"name": "search_marktplaats", "args": '{"query": "second"}', "id": "c2", "index": 1}])

    def fetch(url, capped=True):
        calls.append(url)
        clock[0] = 60
        return PAGE

    monkeypatch.setattr(agent, "model", TwoSearches())
    monkeypatch.setattr(agent, "fetch_page", fetch)
    events = list(agent.chat_events("mac mini", [], clock=lambda: clock[0]))
    assert len(calls) == 1 and "first" in calls[0]
    assert events[-1]["answer"] == "That took too long. Please try again, maybe with a simpler question."


def test_chat_deadline_stops_if_stream_consumer_pauses_after_status(monkeypatch):
    from langchain_core.messages import AIMessageChunk
    clock = [0]
    calls = []

    class Searcher:
        def stream(self, messages):
            yield AIMessageChunk(content="", tool_call_chunks=[
                {"name": "search_marktplaats", "args": '{"query": "mac mini"}', "id": "c1", "index": 0}])

    monkeypatch.setattr(agent, "model", Searcher())
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: calls.append(url) or PAGE)
    events = agent.chat_events("mac mini", [], clock=lambda: clock[0])
    assert next(events)["type"] == "status"
    clock[0] = 60
    assert list(events)[-1]["answer"] == "That took too long. Please try again, maybe with a simpler question."
    assert calls == []


def test_chat_deadline_replaces_partial_model_answer(monkeypatch):
    from langchain_core.messages import AIMessageChunk
    clock = [0]

    class SlowAnswer:
        def stream(self, messages):
            yield AIMessageChunk(content="Partial answer")
            clock[0] = 60
            yield AIMessageChunk(content=" that arrived too late")

    monkeypatch.setattr(agent, "model", SlowAnswer())
    events = list(agent.chat_events("mac mini", [], clock=lambda: clock[0]))
    assert [event["type"] for event in events] == ["delta", "reset", "delta", "done"]
    assert events[-1]["answer"] == "That took too long. Please try again, maybe with a simpler question."


def test_stream_endpoint_needs_login_and_turns_failures_into_an_error_event(client, monkeypatch):
    assert client.post("/api/chat/stream", json={"message": "hi"}).status_code == 401

    def broken(*a):
        yield {"type": "status", "text": "Searching…"}
        raise RuntimeError("Error code: 401 - invalid_api_key")
    monkeypatch.setattr(client.main, "chat_events", broken)
    res = client.post("/api/chat/stream", json={"message": "hi"}, headers={"Authorization": f"Bearer {client.token()}"})
    assert res.headers["content-type"].startswith("application/x-ndjson")
    events = [json.loads(line) for line in res.text.splitlines()]
    assert [e["type"] for e in events] == ["status", "error"] and "can't reach its AI" in events[1]["text"]


def test_watch_mode_tells_the_agent_to_propose_a_watch_instead_of_searching(monkeypatch):
    seen = []

    class Recorder:
        def stream(self, messages):
            from langchain_core.messages import AIMessageChunk
            seen.append(messages[0].content)
            yield AIMessageChunk(content="Ready to save.")

    monkeypatch.setattr(agent, "model", Recorder())
    monkeypatch.setattr(agent, "watch_model", Recorder())
    agent.chat("Gazelle bike near 3511AB every morning at 8", [], mode="watch")
    agent.chat("Gazelle bike", [])
    assert "Watch it" in seen[0] and "propose_watch straight away" in seen[0]
    assert "Watch it" not in seen[1]                     # "Search now" is the default


def test_chat_rejects_an_unknown_mode(client):
    headers = {"Authorization": f"Bearer {client.token()}"}
    assert client.post("/api/chat/stream", json={"message": "hi", "mode": "delete"}, headers=headers).status_code == 422


def test_links_only_ever_point_at_marktplaats():
    import copy
    data = json.loads(agent.NEXT_DATA.search(PAGE).group(1))
    listings = agent.find_listings(data)
    listings[0]["vipUrl"] = "@evil.example/phish"
    listings[1]["vipUrl"] = "//evil.example/phish"
    html = '<script id="__NEXT_DATA__" type="application/json">' + json.dumps(data) + "</script>"
    urls = [item["url"] for item in agent.parse_listings(html)[0]]
    assert len(urls) == 4 and all(u.startswith("https://www.marktplaats.nl/") for u in urls)


def test_check_query_never_returns_unscored_listings(monkeypatch):
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: PAGE)

    class DownRanker:
        def invoke(self, messages):
            raise RuntimeError("model down")
    monkeypatch.setattr(agent, "ranker", DownRanker())
    [result] = agent.check_query("mac mini", [{"id": "w1", "watermark": 0, "seen_ids": []}])
    assert result == {"watchId": "w1", "ok": False, "error": "The AI that scores listings didn't answer. We'll try again soon, and nothing is sent unscored."}


def test_truncated_ranker_reply_fails_watch_without_sending_unscored_listings(monkeypatch):
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: PAGE)

    class TruncatedRanker:
        def invoke(self, messages):
            return {"raw": None, "parsed": None, "parsing_error": ValueError("truncated reply")}

    monkeypatch.setattr(agent, "ranker", TruncatedRanker())
    [result] = agent.check_query("mac mini", [{"id": "w1", "watermark": 0, "seen_ids": []}])
    assert result == {"watchId": "w1", "ok": False,
                      "error": "The AI that scores listings didn't answer. We'll try again soon, and nothing is sent unscored."}


def test_check_query_retries_only_omitted_ids_and_ignores_unknown_ids(monkeypatch):
    serve_search(monkeypatch, [api_page([(5000, "Vandaag"), (4999, "Vandaag")])])
    calls = []

    class PartialRanker:
        def invoke(self, messages):
            ids = [item["id"] for item in json.loads(messages[-1]["content"])["listings"]]
            calls.append(ids)
            scored = "m5000" if len(calls) == 1 else "m4999"
            return agent.Ranking(ranks=[agent.Rank(id=scored, score=8, reason="match"),
                                        agent.Rank(id="m9999", score=10, reason="unknown")])

    monkeypatch.setattr(agent, "ranker", PartialRanker())
    [result] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": [], "watermark": 100,
                                                "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert calls == [["m5000", "m4999"], ["m4999"]]
    assert result["ok"] and result["currentIds"] == ["m5000", "m4999"]
    assert [item["id"] for item in result["listings"]] == ["m5000", "m4999"]
    assert result["newestId"] == 5000


def test_check_query_skips_and_marks_seen_after_one_omitted_id_retry(monkeypatch, capsys):
    serve_search(monkeypatch, [api_page([(5000, "Vandaag"), (4999, "Vandaag")])])
    calls = []

    class PartialRanker:
        def invoke(self, messages):
            calls.append([item["id"] for item in json.loads(messages[-1]["content"])["listings"]])
            return agent.Ranking(ranks=[agent.Rank(id="m5000", score=8, reason="match")] if len(calls) == 1 else [])

    monkeypatch.setattr(agent, "ranker", PartialRanker())
    [result] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": [], "watermark": 100,
                                                "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert calls == [["m5000", "m4999"], ["m4999"]]
    assert result["ok"] and result["currentIds"] == ["m5000", "m4999"]
    assert [item["id"] for item in result["listings"]] == ["m5000"]
    assert result["newestId"] == 5000
    assert [json.loads(line) for line in capsys.readouterr().out.splitlines()] == [
        {"event": "rank_skipped", "id": "m4999"}]


def test_check_query_fails_if_retry_raises(monkeypatch):
    serve_search(monkeypatch, [api_page([(5000, "Vandaag"), (4999, "Vandaag")])])
    calls = []

    class FailingRetryRanker:
        def invoke(self, messages):
            calls.append([item["id"] for item in json.loads(messages[-1]["content"])["listings"]])
            if len(calls) == 2:
                raise RuntimeError("model down")
            return agent.Ranking(ranks=[agent.Rank(id="m5000", score=8, reason="match")])

    monkeypatch.setattr(agent, "ranker", FailingRetryRanker())
    [result] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": [], "watermark": 100,
                                                "last_checked_at": EARLIER_TODAY}], now=NOW)
    assert calls == [["m5000", "m4999"], ["m4999"]]
    assert result == {"watchId": "w1", "ok": False,
                      "error": "The AI that scores listings didn't answer. We'll try again soon, and nothing is sent unscored."}


def test_check_query_ranks_watches_in_parallel(monkeypatch):
    import threading
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: PAGE)
    active, peak, lock = [0], [0], threading.Lock()

    class SlowRanker:
        def invoke(self, messages):
            with lock:
                active[0] += 1; peak[0] = max(peak[0], active[0])
            time.sleep(0.2)
            with lock:
                active[0] -= 1
            listings = json.loads(messages[-1]["content"])["listings"]
            return agent.Ranking(ranks=[agent.Rank(id=i["id"], score=5, reason="ok") for i in listings])

    monkeypatch.setattr(agent, "ranker", SlowRanker())
    started = time.time()
    results = agent.check_query("mac mini", [{"id": f"w{i}", "watermark": 0, "seen_ids": []} for i in range(6)])
    assert all(r["ok"] for r in results) and peak[0] > 1
    assert time.time() - started < 0.2 * 6 * 0.6                  # clearly faster than one after another


def test_tool_calls_are_capped_per_question(monkeypatch):
    class Greedy:
        """Asks for 4 searches per turn, three turns in a row, then answers."""
        def __init__(self):
            self.turn = 0

        def stream(self, messages):
            from langchain_core.messages import AIMessageChunk
            self.turn += 1
            if self.turn <= 3:
                yield AIMessageChunk(content="", tool_call_chunks=[
                    {"name": "search_marktplaats", "args": '{"query": "x%d"}' % i, "id": f"c{self.turn}{i}", "index": i}
                    for i in range(4)])
            else:
                yield AIMessageChunk(content="Done.")

    monkeypatch.setattr(agent, "model", Greedy())
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: PAGE)
    done = agent.chat("find everything", [])
    assert len(done["searches"]) == agent.MAX_TOOL_CALLS == 6


def test_words_before_a_tool_call_are_reset_in_the_stream(monkeypatch):
    class Chatty:
        def __init__(self):
            self.turn = 0

        def stream(self, messages):
            from langchain_core.messages import AIMessageChunk
            self.turn += 1
            if self.turn == 1:
                yield AIMessageChunk(content="Let me look… ")
                yield AIMessageChunk(content="", tool_call_chunks=[
                    {"name": "search_marktplaats", "args": '{"query": "mac mini"}', "id": "c1", "index": 0}])
            else:
                yield AIMessageChunk(content="Found one.")

    monkeypatch.setattr(agent, "model", Chatty())
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: PAGE)
    kinds = [e["type"] for e in agent.chat_events("mac mini", [])]
    assert kinds == ["delta", "reset", "status", "listings", "delta", "done"]
    assert agent.chat("mac mini", [])["answer"] == "Found one."


def test_missing_settings_fail_with_a_clear_message(monkeypatch):
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    with pytest.raises(RuntimeError, match="OPENAI_MODEL is not set"):
        agent.required_env("OPENAI_MODEL")


def test_watch_mode_cannot_search_even_if_the_model_asks(monkeypatch):
    class Searcher:
        def __init__(self):
            self.turn = 0

        def stream(self, messages):
            from langchain_core.messages import AIMessageChunk
            self.turn += 1
            if self.turn == 1:
                yield AIMessageChunk(content="", tool_call_chunks=[
                    {"name": "search_marktplaats", "args": '{"query": "iphone 13"}', "id": "c1", "index": 0}])
            else:
                yield AIMessageChunk(content="Ready.")

    fetched = []
    monkeypatch.setattr(agent, "watch_model", Searcher())
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: fetched.append(url) or PAGE)
    done = agent.chat("iPhone 13 near 1012AB", [], mode="watch")
    assert fetched == [] and done["searches"] == [] and done["listings"] == []


def test_csp_reports_are_logged_without_crashing(client, capsys):
    report = {"csp-report": {"document-uri": "https://x.test/chat/?id=secret", "violated-directive": "connect-src",
                             "blocked-uri": "https://evil.example/collect"}}
    res = client.post("/api/csp-report", content=json.dumps(report), headers={"content-type": "application/csp-report"})
    assert res.status_code == 204
    line = [l for l in capsys.readouterr().out.splitlines() if "csp_violation" in l][-1]
    logged = json.loads(line)
    assert logged.pop("requestId") == res.headers["X-Request-Id"]
    assert logged == {"event": "csp_violation", "directive": "connect-src",
                      "blocked": "https://evil.example/collect", "page": "https://x.test/chat/"}   # no query string
    assert client.post("/api/csp-report", content=b"x" * 20_000).status_code == 413


def synthetic_page(ids):
    rows = [{"itemId": i, "title": f"Mac mini {i}", "vipUrl": f"/v/{i}", "priceInfo": {"priceCents": 40000}} for i in ids]
    return '<script id="__NEXT_DATA__" type="application/json">' + json.dumps({"listings": rows}) + "</script>"


class CountingRanker:
    def __init__(self):
        self.ranked = []

    def invoke(self, messages):
        listings = json.loads(messages[-1]["content"])["listings"]
        self.ranked += [i["id"] for i in listings]
        return agent.Ranking(ranks=[agent.Rank(id=i["id"], score=9, reason="match") for i in listings])


def test_check_query_remembers_every_listing_on_the_page_not_just_ten(monkeypatch):
    # Audit A03: with 11 matches only 10 were remembered, so the 11th later looked "new" when it wasn't
    ids = [f"m{i}" for i in range(1, 12)]
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: synthetic_page(ids))
    monkeypatch.setattr(agent, "ranker", CountingRanker())
    [first] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": []}])
    assert first["ok"] and first["currentIds"] == ids
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: synthetic_page(ids[1:]))
    [second] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": first["currentIds"]}])
    assert second["listings"] == []


def test_check_query_reports_an_unreadable_page_as_a_failure_not_as_empty(monkeypatch):
    # Audit A04: a maintenance or redesigned page must not count as "no listings" (it would reset the baseline)
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: "<html><body>Onderhoud</body></html>")
    [result] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": ["a"]}])
    assert not result["ok"] and "unexpected page" in result["error"]
    # A readable page that really has no listings is still fine
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: synthetic_page([]))
    [empty] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": ["a"]}])
    assert empty == {"watchId": "w1", "ok": True, "currentIds": [], "listings": [], "newestId": None,
                     "waiting": 0, "capped": False}


def test_first_check_of_a_new_watch_scores_nothing(monkeypatch):
    # The first check only records what is already listed, so scoring it would be wasted money
    ranker = CountingRanker()
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: synthetic_page(["a", "b"]))
    monkeypatch.setattr(agent, "ranker", ranker)
    [result] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": [], "seeded": False}])
    assert result["ok"] and result["currentIds"] == ["a", "b"] and result["listings"] == [] and ranker.ranked == []


def test_scoring_per_check_is_bounded_and_the_rest_waits_unseen(monkeypatch):
    ids = [f"n{i}" for i in range(agent.MAX_RANK_PER_CHECK + 5)]
    ranker = CountingRanker()
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: synthetic_page(ids))
    monkeypatch.setattr(agent, "ranker", ranker)
    [result] = agent.check_query("mac mini", [{"id": "w1", "watermark": 0, "seen_ids": []}])
    assert len(result["listings"]) == agent.MAX_RANK_PER_CHECK
    assert result["waiting"] == 5 and result["capped"] is False
    assert result["currentIds"] == ids[:agent.MAX_RANK_PER_CHECK]   # the 5 unscored ones stay unseen: scored next time


def test_check_route_passes_the_first_check_flag_through(client, monkeypatch):
    seen = {}
    monkeypatch.setattr(client.main, "check_query", lambda query, watches: seen.update(w=watches) or [])
    client.post("/api/internal/check", headers={"X-Cron-Secret": "s3cret"},
                json={"query": "mac mini", "watches": [{"id": "w1", "seeded": False}, {"id": "w2"}]})
    assert [w["seeded"] for w in seen["w"]] == [False, True]
    assert [w["watermark"] for w in seen["w"]] == [None, None]          # an older caller doesn't send these
    client.post("/api/internal/check", headers={"X-Cron-Secret": "s3cret"}, json={"query": "mac mini", "watches": [
        {"id": "w1", "watermark": 2448176040, "last_checked_at": 1790709591725}]})
    assert seen["w"][0]["watermark"] == 2448176040 and seen["w"][0]["last_checked_at"] == 1790709591725


def test_check_route_accepts_full_seen_window(client, monkeypatch):
    monkeypatch.setattr(agent, "fetch_page", lambda url, capped=True: synthetic_page(["new"]))
    ranker = CountingRanker()
    monkeypatch.setattr(agent, "ranker", ranker)
    response = client.post("/api/internal/check", headers={"X-Cron-Secret": "s3cret"},
                           json={"query": "mac mini", "watches": [{"id": "w1", "watermark": 0,
                                                                    "seen_ids": [f"old{i}" for i in range(1500)]}]})
    assert response.status_code == 200
    assert response.json()["results"][0]["ok"] is True
    assert ranker.ranked == ["new"]


def test_report_user_section_counts_bands_and_reasons():
    from evals.report import user_section
    assert "No ratings yet" in "\n".join(user_section([]))
    text = "\n".join(user_section([
        {"verdict": "good", "reasons": [], "note": "", "score": 9, "title": "A"},
        {"verdict": "not_right", "reasons": ["price"], "note": "too pricey", "score": 8, "title": "B"},
        {"verdict": "good", "reasons": [], "note": "", "score": 6, "title": "C"},
    ]))
    assert "| great (8–10) | 2 | 1 | **50%** |" in text
    assert "| good (6–7) | 1 | 1 | **100%** |" in text
    assert "Price isn't good (1)" in text and '"too pricey"' in text
    assert "early signals" in text


def test_request_id_header_and_logs(client, monkeypatch, capsys):
    import re
    monkeypatch.setattr(client.main, "check_query", lambda q, w: [{"watchId": "w1", "ok": True}])
    body = {"query": "mac mini", "watches": [{"id": "w1"}]}
    headers = {"X-Cron-Secret": "s3cret", "X-Request-Id": "run-123.0"}
    response = client.post("/api/internal/check", json=body, headers=headers)
    assert response.headers["X-Request-Id"] == "run-123.0"
    assert json.loads(capsys.readouterr().out.splitlines()[-1])["requestId"] == "run-123.0"
    for incoming in ("bad id", "x" * 101):
        response = client.post("/api/internal/check", json=body, headers={**headers, "X-Request-Id": incoming})
        assert re.fullmatch(r"[0-9a-f]{32}", response.headers["X-Request-Id"])
        assert json.loads(capsys.readouterr().out.splitlines()[-1])["requestId"] == response.headers["X-Request-Id"]
    assert re.fullmatch(r"[0-9a-f]{32}", client.get("/api/health").headers["X-Request-Id"])


@pytest.mark.parametrize("path", ["/api/chat", "/api/chat/stream"])
@pytest.mark.parametrize("post_fails", [False, True])
def test_chat_failure_records_error_without_breaking_answer(client, monkeypatch, capsys, path, post_fails):
    import convex_api
    monkeypatch.setenv("CONVEX_SITE_URL", "https://deployment.convex.site")
    monkeypatch.setenv("API_TO_CONVEX_SECRET", "secret")
    monkeypatch.setattr(client.main, "chat_allowance", lambda user: {"allowed": True})
    def fail(*args):
        raise RuntimeError("model unavailable")
    monkeypatch.setattr(client.main, "chat", fail)
    monkeypatch.setattr(client.main, "chat_events", fail)
    posts = []
    class Response:
        def raise_for_status(self):
            if post_fails:
                raise RuntimeError("write failed")
        def json(self):
            return {"ok": True}
    monkeypatch.setattr(convex_api.httpx, "post", lambda *args, **kwargs: posts.append((args, kwargs)) or Response())
    response = client.post(path, json={"message": "hi"}, headers={"Authorization": f"Bearer {client.token()}", "X-Request-Id": "chat-123"})
    answer = json.loads(response.text)["text"] if path.endswith("stream") else response.json()["answer"]
    assert answer == "Something went wrong on our side. Try again."
    assert response.headers["X-Request-Id"] == "chat-123"
    assert len(posts) == 1
    assert posts[0][0] == ("https://deployment.convex.site/api/errors",)
    assert posts[0][1]["json"] == {"kind": "chat", "requestId": "chat-123", "message": f"RuntimeError: {answer}"}
    logs = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert all(line["requestId"] == "chat-123" for line in logs)
    if path.endswith("stream"):
        assert next(line for line in logs if line["event"] == "chat_turn")["requestId"] == "chat-123"
    assert ("error_record_failed" in [line["event"] for line in logs]) is post_fails
def test_audit_watch_finds_handled_and_never_read_with_margin(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now = datetime(2026, 9, 30, 12, tzinfo=ZoneInfo("Europe/Amsterdam"))
    raw = [{"itemId": ident, "title": ident, "vipUrl": f"/v/{ident}", "date": day,
            "priceInfo": {"priceCents": 10000}, "priorityProduct": priority}
           for ident, day, priority in [("handled", "Gisteren", "NONE"), ("low", "Gisteren", "NONE"),
                                         ("alerted", "Gisteren", "NONE"), ("unseen", "Gisteren", "NONE"),
                                         ("today", "Vandaag", "NONE"), ("paid", "Gisteren", "DAGTOPPER")]]
    monkeypatch.setattr(agent, "read_since", lambda *args: (raw, False))
    scores = {"handled": 7, "low": 6, "unseen": 9}
    def rank(_description, listings, raise_on_failure=False):
        for item in listings:
            item["score"] = scores[item["id"]]
        return listings
    monkeypatch.setattr(agent, "rank_listings", rank)
    last_read = int(datetime(2026, 9, 30, 8, tzinfo=ZoneInfo("Europe/Amsterdam")).timestamp() * 1000)
    result = agent.audit_watch({"id": "w", "query": "bike", "notify": "good",
                                "seen_ids": ["handled", "low", "alerted", "paid"],
                                "seen_scores": {"handled": 4, "low": 0},
                                "alerted_ids": ["alerted"], "last_read_at": last_read}, now)
    assert result["ok"] and result["read"] == 5
    assert result["candidates"] == result["scored"] == 3
    assert [(m["id"], m["kind"]) for m in result["misses"]] == \
        [("unseen", "never_read"), ("handled", "rescored")]
    assert result["misses"][1]["checkScore"] == 4
    assert result["missCount"] == 2


def test_audit_watch_caps_scoring_and_reports_empty_and_failure(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now = datetime(2026, 9, 30, 12, tzinfo=ZoneInfo("Europe/Amsterdam"))
    raw = [{"itemId": str(i), "title": str(i), "vipUrl": f"/v/{i}", "date": "Gisteren"}
           for i in range(50)]
    monkeypatch.setattr(agent, "read_since", lambda *args: (raw, False))
    def rank(_description, listings, raise_on_failure=False):
        assert len(listings) == 40
        for item in listings:
            item["score"] = 9
        return listings
    monkeypatch.setattr(agent, "rank_listings", rank)
    w = {"id": "w", "query": "bike", "notify": "great", "seen_ids": [str(i) for i in range(50)]}
    result = agent.audit_watch(w, now)
    assert (result["candidates"], result["scored"], result["missCount"], len(result["misses"])) == (50, 40, 40, 5)
    monkeypatch.setattr(agent, "read_since", lambda *args: ([], False))
    assert agent.audit_watch(w, now) == {"watchId": "w", "ok": True, "read": 0, "candidates": 0,
                                        "scored": 0, "unscored": 0, "misses": [], "missCount": 0}
    monkeypatch.setattr(agent, "read_since", lambda *args: (_ for _ in ()).throw(ValueError("bad page")))
    assert agent.audit_watch(w, now)["ok"] is False


def test_audit_watch_excludes_baseline_and_keeps_highest_scoring_misses(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now = datetime(2026, 9, 30, 12, tzinfo=ZoneInfo("Europe/Amsterdam"))
    raw = [{"itemId": ident, "title": ident, "vipUrl": f"/v/{ident}", "date": "Gisteren"}
           for ident in ["baseline", "baseline_unseen", "low", "high", "unscored"]]
    monkeypatch.setattr(agent, "read_since", lambda *args: (raw, False))
    def rank(_description, listings, raise_on_failure=False):
        for item in listings:
            item["score"] = {"baseline": 10, "baseline_unseen": 10, "low": 7,
                             "high": 9, "unscored": None}[item["id"]]
        return listings
    monkeypatch.setattr(agent, "rank_listings", rank)
    result = agent.audit_watch({"id": "w", "query": "bike", "notify": "good",
                                "seen_ids": ["baseline", "low", "high", "unscored"],
                                "baseline_ids": ["baseline", "baseline_unseen"],
                                "last_read_at": int(now.timestamp() * 1000)}, now)
    assert result["ok"] is True
    assert (result["candidates"], result["scored"], result["unscored"], result["missCount"]) == (3, 2, 1, 2)
    assert [m["id"] for m in result["misses"]] == ["high", "low"]
    assert [m["kind"] for m in result["misses"]] == ["never_scored", "never_scored"]


def test_audit_watch_excludes_original_creation_mark_including_non_m_ids(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now = datetime(2026, 9, 30, 12, tzinfo=ZoneInfo("Europe/Amsterdam"))
    ids = ["m99", "m100", "m101", "a101"]
    monkeypatch.setattr(agent, "read_since", lambda *args: ([
        {"itemId": ident, "title": ident, "vipUrl": f"/v/{ident}", "date": "Gisteren"}
        for ident in ids], False))
    monkeypatch.setattr(agent, "rank_listings", lambda _description, listings, raise_on_failure=False:
                        [dict(item, score=9) for item in listings])
    result = agent.audit_watch({"id": "w", "query": "bike", "notify": "good",
                                "seen_ids": ids, "created_mark": 100}, now)
    assert result["candidates"] == result["missCount"] == 1
    assert [m["id"] for m in result["misses"]] == ["m101"]


def test_audit_watch_uses_requested_window(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now = datetime(2026, 10, 2, 12, tzinfo=ZoneInfo("Europe/Amsterdam"))
    calls = []
    monkeypatch.setattr(agent, "read_since", lambda *args: calls.append(args[2]) or ([
        {"itemId": "m101", "title": "m101", "vipUrl": "/v/m101", "date": "29 sep 26"}], False))
    monkeypatch.setattr(agent, "rank_listings", lambda _description, listings, raise_on_failure=False:
                        [dict(item, score=9) for item in listings])
    result = agent.audit_watch({"id": "w", "query": "bike", "notify": "good",
                                "seen_ids": ["m101"], "since_days": 3}, now)
    assert calls == [3]
    assert [m["id"] for m in result["misses"]] == ["m101"]


def test_audit_watch_uses_real_read_since_result(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now = datetime(2026, 9, 30, 12, tzinfo=ZoneInfo("Europe/Amsterdam"))
    monkeypatch.setattr(agent, "fetch_search", lambda *_: {"listings": [
        {"itemId": "fresh", "title": "Fresh", "vipUrl": "/v/fresh", "date": "Gisteren"}]})
    monkeypatch.setattr(agent, "rank_listings", lambda _description, listings, raise_on_failure=False:
                        [dict(item, score=9) for item in listings])
    result = agent.audit_watch({"id": "w", "query": "bike", "notify": "good",
                                "seen_ids": ["fresh"]}, now)
    assert result["ok"] is True
    assert (result["read"], result["scored"], result["missCount"]) == (1, 1, 1)
    assert result["misses"][0]["kind"] == "never_scored"


def test_audit_watch_check_alive_keeps_only_current_listings(monkeypatch):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    now = datetime(2026, 9, 30, 12, tzinfo=ZoneInfo("Europe/Amsterdam"))
    ids = ["live", "gone", "reserved", "error", "redirect", "description"]
    raw = [{"itemId": ident, "title": ident, "vipUrl": f"/v/{ident}", "date": "Gisteren",
            "priceInfo": {"priceCents": 2500}} for ident in ids]
    monkeypatch.setattr(agent, "read_since", lambda *args: (raw, False))
    monkeypatch.setattr(agent, "rank_listings", lambda _description, listings, raise_on_failure=False:
                        [dict(item, score=9) for item in listings])

    def fetch(url, **kwargs):
        ident = url.rsplit("/", 1)[-1]
        assert kwargs["timeout"] == 10.0
        if ident == "error":
            raise agent.httpx.ConnectError("offline")
        status = 404 if ident == "gone" else 200
        target = "https://www.marktplaats.nl/" if ident == "redirect" else url
        body = {"reserved": '<script>{"isReserved":true}</script>',
                "description": "<p>apart verkocht, listing still available</p>"}.get(ident, ident)
        return agent.httpx.Response(status, text=body, request=agent.httpx.Request("GET", target))

    monkeypatch.setattr(agent.httpx, "get", fetch)
    result = agent.audit_watch({"id": "w", "query": "bike", "notify": "good",
                                "seen_ids": ids, "check_alive": True}, now)
    assert result["ok"] is True
    assert result["missCount"] == 2
    assert [m["id"] for m in result["misses"]] == ["live", "description"]


def test_audit_endpoint_uses_cron_auth_and_reports_failures(monkeypatch):
    from fastapi.testclient import TestClient
    import main

    monkeypatch.setenv("CRON_SECRET", "s3cret")
    monkeypatch.setattr(main, "audit_watch", lambda w: {"watchId": w["id"], "ok": False,
                                                        "read": 0, "candidates": 0, "scored": 0,
                                                        "missCount": 0, "misses": [], "error": "bad page"})
    client = TestClient(main.app)
    body = {"watches": [{"id": "w", "query": "bike", "notify": "good", "seen_ids": [],
                         "alerted_ids": [], "last_read_at": None}]}
    assert client.post("/api/internal/audit", json=body).status_code == 401
    response = client.post("/api/internal/audit", json=body, headers={"X-Cron-Secret": "s3cret"})
    assert response.status_code == 200
    assert response.json()["results"][0]["ok"] is False


def test_audit_route_accepts_full_seen_history(client, monkeypatch):
    received = []
    monkeypatch.setattr(client.main, "audit_watch", lambda watch: received.append(watch) or
                        {"watchId": watch["id"], "ok": True, "missCount": 0, "scored": 0})
    ids = [f"old{i}" for i in range(3000)]
    response = client.post("/api/internal/audit", headers={"X-Cron-Secret": "s3cret"},
                           json={"watches": [{"id": "w1", "query": "mac mini", "notify": "good",
                                              "seen_ids": ids, "seen_scores": {"old0": 0}, "baseline_ids": ids,
                                              "check_alive": True, "created_mark": 123, "since_days": 7}]})
    assert response.status_code == 200
    assert received[0]["seen_ids"] == ids and received[0]["baseline_ids"] == ids
    assert received[0]["seen_scores"] == {"old0": 0}
    assert received[0]["check_alive"] is True
    assert received[0]["created_mark"] == 123 and received[0]["since_days"] == 7
    invalid = client.post("/api/internal/audit", headers={"X-Cron-Secret": "s3cret"},
                          json={"watches": [{"id": "w1", "query": "mac mini", "notify": "good", "since_days": 8}]})
    assert invalid.status_code == 422
