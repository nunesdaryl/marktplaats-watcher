import json
import os
from pathlib import Path

import pytest

os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("OPENAI_MODEL", "gpt-5.4-mini")

import offer
from offer import normalize_prices
from test_agent import client  # noqa: F401 - authenticated API fixture


def test_existing_search_data_keeps_listing_text_for_offer_reason():
    import agent
    page = (Path(__file__).parent / "tests/search_page.html").read_text()
    listings, _ = agent.parse_listings(page)
    assert listings[0]["description"].startswith("Synthetic listing")


@pytest.mark.parametrize("case", json.loads((Path(__file__).parent / "evals/data/offer_golden.json").read_text()))
def test_golden_offer_price_rules(case):
    opening, maximum = normalize_prices(case["priceEur"] * .8, case["priceEur"] * 1.2,
                                        case["priceEur"], case["watchMaxEur"])
    assert 0 < opening <= maximum <= case["priceEur"]
    assert case["watchMaxEur"] is None or maximum <= case["watchMaxEur"]
    assert opening % 5 == maximum % 5 == 0


def test_bad_prices_are_rejected():
    for value in (float("nan"), float("inf"), -10):
        with pytest.raises(ValueError):
            normalize_prices(value, 100, 100)


def test_draft_normalizes_model_prices_and_message(monkeypatch):
    calls = []
    class Model:
        def bind(self, **kwargs):
            return self
        def with_structured_output(self, *args, **kwargs):
            return self
        def invoke(self, messages):
            calls.append(messages)
            return {"parsed": offer.OfferDraft(openingEur=188, maxEur=999, reason="Some wear",
                messageNl="draft", messageEn="draft"),
                "raw": type("Raw", (), {"usage_metadata": {"input_tokens": 10, "output_tokens": 10}})()}
    monkeypatch.setattr(offer, "offer_model", Model())
    result = offer.draft_offer({"title": "Bike", "priceEur": 199}, 175, [160])
    assert len(calls) == 1
    assert result["openingEur"] == result["maxEur"] == 175
    assert "€175" in result["messageNl"] and "€175" in result["messageEn"]


def test_offer_endpoint_records_one_call(client, monkeypatch):
    calls = []
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")
    monkeypatch.setattr(client.main, "convex_post", lambda path, body: calls.append((path, body)) or
                        ({"maxPriceEur": 150, "similarPricesEur": [140]} if path == "/api/offer/context" else {"ok": True}))
    def fake_draft(listing, cap, similar):
        assert cap == 150 and similar == [140]
        calls.append(("model", listing))
        return {"openingEur": 125, "maxEur": 150, "reason": "Fair price", "messageNl": "Hallo",
                "messageEn": "Hello", "openingReason": "Fair price", "maxReason": "Within limit",
                "usage": {"input_tokens": 100, "output_tokens": 50}}
    monkeypatch.setattr(client.main, "draft_offer", fake_draft)
    headers = {"Authorization": f"Bearer {client.token()}"}
    response = client.post("/api/offer/help", headers=headers,
                           json={"title": "Bike", "url": "https://www.marktplaats.nl/bike", "priceEur": 175, "watchId": "w1"})
    assert response.status_code == 200
    assert [path for path, _ in calls] == ["/api/offer/context", "model", "/api/ai-spend"]
    assert calls[-1][1]["kind"] == "offer help"


@pytest.mark.parametrize("guard,status", [("paused", 503), ("budget", 429), ("admission", 403)])
def test_offer_refusals_before_model(client, monkeypatch, guard, status):
    monkeypatch.setattr(client.main, "draft_offer", lambda *args: pytest.fail("model called"))
    if guard == "paused":
        monkeypatch.setenv("CHAT_PAUSED", "1")
    else:
        monkeypatch.setattr(client.main, "chat_allowance", lambda user: {"allowed": False, "limit": 40,
            "reason": guard, "resetsAt": 1790000000000})
    response = client.post("/api/offer/help", headers={"Authorization": f"Bearer {client.token()}"},
                           json={"title": "Bike", "url": "https://www.marktplaats.nl/bike", "priceEur": 175})
    assert response.status_code == status
    assert response.json()["answer"]
