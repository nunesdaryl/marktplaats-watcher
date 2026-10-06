"""One model call for buyer-controlled offer help, with server-enforced price bounds."""

import json
import math
import os
import re

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from prompts import OFFER_PROMPT_TEMPLATE


class OfferDraft(BaseModel):
    openingEur: float
    maxEur: float
    reason: str = Field(max_length=300)
    messageNl: str = Field(max_length=500)
    messageEn: str = Field(max_length=500)


# One request can make at most one provider call, including failure paths.
offer_model = ChatOpenAI(model=os.environ["OPENAI_MODEL"], timeout=30, max_retries=0,
                         max_tokens=500, stream_usage=True)


def normalize_prices(opening, maximum, asking, watch_max=None):
    """Keep both amounts on €5 steps and never exceed either trusted ceiling."""
    ceiling = min(asking, watch_max) if watch_max is not None else asking
    ceiling = math.floor(ceiling / 5) * 5
    if ceiling < 5:
        raise ValueError("There is no €5 offer below this price.")
    if not all(math.isfinite(n) and n > 0 for n in (opening, maximum)):
        raise ValueError("Invalid offer price.")
    maximum = min(ceiling, max(5, round(maximum / 5) * 5))
    opening = min(maximum, max(5, round(opening / 5) * 5))
    return opening, maximum


def draft_offer(listing, watch_max=None, similar=None):
    asking = listing["priceEur"]
    output = offer_model.with_structured_output(OfferDraft, include_raw=True).invoke([
        *OFFER_PROMPT_TEMPLATE.format_messages(),
        {"role": "user", "content": json.dumps({"listing": listing, "watchMaxEur": watch_max,
                                               "similarScoredPricesEur": similar or []})},
    ])
    draft = output["parsed"]
    if draft is None:
        raise ValueError("The offer draft was incomplete.")
    opening, maximum = normalize_prices(draft.openingEur, draft.maxEur, asking, watch_max)
    title = listing["title"].strip()
    condition = (listing.get("description") or "").strip().replace("\n", " ")[:100]
    comparison = f" Recent scored listings were €{', €'.join(str(price) for price in (similar or [])[:3])}." if similar else ""
    reason = " ".join(draft.reason.split())
    def safe_message(message, fallback, pickup_words):
        amounts = re.findall(r"€\s*(\d+(?:[.,]\d+)?)", message)
        if len(message) <= 300 and amounts == [str(opening)] and any(word in message.lower() for word in pickup_words):
            return message.strip()
        return fallback
    return {
        "openingEur": opening, "maxEur": maximum,
        "reason": reason,
        "openingReason": f"Asking €{asking:g}. " + (f"Listing says: {condition}. " if condition else "") + reason,
        "maxReason": (f"Your watch limit is €{watch_max:g}; " if watch_max is not None else "")
                     + f"€{maximum} stays within the asking price.{comparison}",
        "messageNl": safe_message(draft.messageNl,
            f"Hallo, ik heb interesse in {title}. Zou u €{opening} overwegen? Wanneer zou ik het kunnen ophalen? Met vriendelijke groet",
            ("ophalen", "afhalen")),
        "messageEn": safe_message(draft.messageEn,
            f"Hello, I'm interested in {title}. Would you consider €{opening}? When could I pick it up? Kind regards",
            ("pick up", "pickup", "collect")),
        "usage": getattr(output.get("raw"), "usage_metadata", None),
    }
