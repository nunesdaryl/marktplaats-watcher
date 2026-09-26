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
    listings = agent.parse_listings(PAGE)
    assert len(listings) == 6
    assert listings[0]["title"].startswith("Apple Mac mini M1")
    assert listings[0]["price_eur"] == 425
    assert listings[0]["url"].startswith("https://www.marktplaats.nl/")
    assert all("seller" not in json.dumps(item).lower() for item in listings)


def test_max_price_drops_expensive_and_unpriced_listings():
    prices = [item["price_eur"] for item in agent.parse_listings(PAGE, max_price_eur=500)]
    assert prices and all(p <= 500 for p in prices)
    assert None not in prices  # "see description" listings have no price to compare


def test_tool_is_what_the_model_sees():
    assert agent.search_marktplaats.name == "search_marktplaats"
    assert set(agent.search_marktplaats.args) == {"query", "max_price_eur", "postcode", "max_distance_km"}


def test_distance_filter_keeps_only_nearby_listings():
    utrecht = (52.09, 5.12)
    near = agent.parse_listings(PAGE, home=utrecht, max_km=30)
    assert near and all(item["distance_km"] is not None and item["distance_km"] <= 30 for item in near)
    assert len(near) < len(agent.parse_listings(PAGE))  # far or location-less listings dropped


def test_haversine_amsterdam_utrecht_is_about_35_km():
    assert 33 <= agent.distance_km((52.37, 4.89), (52.09, 5.12)) <= 37
