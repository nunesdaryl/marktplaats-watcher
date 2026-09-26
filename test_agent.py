"""Offline tests: the page parser and the tool's filters. No Azure call, no Marktplaats request."""
import json
import os
from pathlib import Path

os.environ.setdefault("AZURE_AI_ENDPOINT", "https://example/openai/v1")
os.environ.setdefault("AZURE_AI_API_KEY", "dummy")
os.environ.setdefault("AZURE_AI_MODEL", "dummy")

import agent  # noqa: E402

PAGE = (Path(__file__).parent / "tests" / "search_page.html").read_text()  # sanitised, synthetic sellers


def test_parses_listings_without_seller_data():
    listings = agent.parse_listings(PAGE)[0]
    assert len(listings) == 6
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


def test_rate_limit_returns_429(monkeypatch):
    from fastapi.testclient import TestClient
    import main
    monkeypatch.setattr(main, "chat", lambda message, history: "ok")
    monkeypatch.setattr(main, "RATE_PER_MINUTE", 2)
    main._recent.clear()
    client = TestClient(main.app)
    codes = [client.post("/api/chat", json={"message": "hi"}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_offline_model_gives_a_clear_message(monkeypatch):
    from fastapi.testclient import TestClient
    import main
    def gone(message, history):
        raise RuntimeError("Error code: 404 - Could not find an existing deployment to match the model")
    monkeypatch.setattr(main, "chat", gone)
    main._recent.clear()
    answer = TestClient(main.app).post("/api/chat", json={"message": "hi"}).json()["answer"]
    assert "offline" in answer and "Docker" in answer
