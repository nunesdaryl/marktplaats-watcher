"""Daily read-only check of Marktplaats' search response shape."""

import os


def check_shape(data):
    """Return organic count, or explain which part of the search answer changed."""
    if not isinstance(data, dict) or not isinstance(data.get("listings"), list):
        raise ValueError("search response has no listings list")
    organic = 0
    for index, item in enumerate(data["listings"]):
        if not isinstance(item, dict):
            raise ValueError(f"listings[{index}] is not an object")
        for field in ("itemId", "title", "priceInfo", "date", "priorityProduct"):
            if field not in item or item[field] is None:
                raise ValueError(f"listings[{index}] has no {field}")
        organic += item["priorityProduct"] == "NONE"
    if not organic:
        raise ValueError("search response has no organic listings (priorityProduct=NONE)")
    return organic


def main():
    # Importing agent config needs a local placeholder, but this canary never calls OpenAI.
    os.environ.setdefault("OPENAI_API_KEY", "unused-canary-placeholder")
    from agent import PAGE_SIZE, fetch_search

    data = fetch_search("schaakbord", {}, 0, retry=False)
    count = check_shape(data)
    print(f"Marktplaats search shape OK: {len(data['listings'])} rows, {count} organic; limit={PAGE_SIZE}")


if __name__ == "__main__":
    main()
