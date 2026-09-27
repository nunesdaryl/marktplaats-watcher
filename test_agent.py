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
    [result] = agent.check_query("mac mini", [{"id": "w1", "seen_ids": []}])
    assert result == {"watchId": "w1", "ok": False, "error": "The AI that scores listings didn't answer. We'll try again soon, and nothing is sent unscored."}


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
    results = agent.check_query("mac mini", [{"id": f"w{i}", "seen_ids": []} for i in range(6)])
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
    assert json.loads(line) == {"event": "csp_violation", "directive": "connect-src",
                                "blocked": "https://evil.example/collect", "page": "https://x.test/chat/"}   # no query string
    assert client.post("/api/csp-report", content=b"x" * 20_000).status_code == 413
