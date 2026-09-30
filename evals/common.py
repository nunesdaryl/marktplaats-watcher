"""Shared bits for the evaluation scripts. Run from the repo root, e.g. `.venv/bin/python -m evals.run_scorer`.

The evals run the PRODUCTION code paths (agent.rank_listings, agent.chat) against a frozen dataset, so a rerun after a
prompt or model change measures exactly what users get. CI runs them on relevant pull requests and weekly."""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

DATA = Path(__file__).parent / "data"
LISTINGS = DATA / "listings.json"
LABELS = DATA / "labels.json"
SCORER_RESULTS = DATA / "scorer_results.json"
CHAT_RESULTS = DATA / "chat_results.json"
REPEAT_RESULTS = DATA / "repeat_results.json"
SPOTCHECK = DATA / "spotcheck.md"
USER_RATINGS = DATA / "user_ratings.json"   # people's "good match / not right" on real alerts (evals/pull_ratings.py)
REPORT = Path(__file__).parent / "report.md"

# USD per 1M tokens, standard tier (developers.openai.com/api/docs/pricing, checked 27 Sep 2026)
PRICES = {"gpt-5.4-mini": (0.75, 4.50), "gpt-5.5": (5.00, 30.00)}
USD_TO_EUR = 0.92   # rough; the report states it

# The five watches the dataset is built from: realistic searches with typical noise (accessories, parts, look-alikes)
WATCHES = [
    {"id": "mac", "query": "mac mini", "description": "Mac mini, under €500", "max_price_eur": 500},
    {"id": "bike", "query": "gazelle fiets", "description": "Gazelle bike, under €400", "max_price_eur": 400},
    {"id": "switch", "query": "nintendo switch oled", "description": "Nintendo Switch OLED console, under €200", "max_price_eur": 200},
    {"id": "chair", "query": "ikea bureaustoel", "description": "IKEA office chair, under €100", "max_price_eur": 100},
    {"id": "iphone", "query": "iphone 13", "description": "iPhone 13 phone, under €350", "max_price_eur": 350},
]


def cost_usd(model, input_tokens, output_tokens):
    if model not in PRICES:
        raise ValueError(f"add prices for {model} to evals/common.py")
    price_in, price_out = PRICES[model]
    return input_tokens / 1e6 * price_in + output_tokens / 1e6 * price_out


def model_under_test():
    model = os.environ["OPENAI_MODEL"]
    if model not in PRICES:
        raise ValueError(f"add prices for {model} to evals/common.py")
    return model


def read(path):
    return json.loads(path.read_text())


def write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
