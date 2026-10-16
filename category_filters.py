"""Checked-in Marktplaats category and facet vocabulary for saved watches."""
import json
import re
from functools import lru_cache
from pathlib import Path


@lru_cache(maxsize=1)
def categories():
    data = json.loads((Path(__file__).parent / "data/categories.json").read_text())
    return {str(item["id"]): item for item in data["categories"]}


def normalize_filters(category_id, filters):
    """Return valid filters and a visible note for stale or retired values."""
    category = categories().get(str(category_id)) if category_id is not None else None
    if not category:
        return None, {}, "Category is no longer available; its filters were removed." if category_id is not None else None
    valid, dropped = {}, []
    for key, value in (filters or {}).items():
        facet = category.get("filters", {}).get(key)
        if not facet or not isinstance(value, str):
            dropped.append(key)
        elif facet["type"] == "choice" and value in facet["values"]:
            valid[key] = value
        elif facet["type"] == "range" and re.fullmatch(r"\d*:\d*", value) and value != ":":
            lower, upper = (int(v) if v else None for v in value.split(":"))
            if (lower is None or lower >= facet["min"]) and (upper is None or upper <= facet["max"]) and (lower is None or upper is None or lower <= upper):
                valid[key] = value
            else:
                dropped.append(key)
        else:
            dropped.append(key)
    note = "Unavailable category filters were removed: " + ", ".join(dropped) + "." if dropped else None
    return str(category_id), valid, note


def from_plain_words(query, category_id=None, filters=None):
    """Infer only unambiguous category facets; retain other words in the search."""
    text = query.lower()
    if category_id is None:
        for pattern, cat in [(r"\b(car|auto|volkswagen|bmw)\b", "91"), (r"\b(e-bike|ebike|elektrische fiets)\b", "451"),
                             (r"\b(bike|fiets|bicycle)\b", "445"), (r"\b(macbook)\b", "325"),
                             (r"\b(laptop|notebook)\b", "339"), (r"\b(playstation 5|ps5)\b", "2954"),
                             (r"\b(console|spelcomputer|playstation|xbox)\b", "356"),
                             (r"\b(iphone)\b", "1953"), (r"\b(phone|telefoon|smartphone|samsung)\b", "820")]:
            if re.search(pattern, text):
                category_id = cat
                break
    cat = categories().get(str(category_id)) if category_id is not None else None
    inferred = dict(filters or {})
    if cat:
        facets = cat.get("filters", {})
        for key, facet in facets.items():
            if facet["type"] != "choice" or key in inferred:
                continue
            for value_id, label in facet["values"].items():
                word = label.lower()
                aliases = {"gebruikt": r"\b(?:used|second.hand|gebruikt)\b", "nieuw": r"\b(?:new|nieuw)\b",
                           "benzine": r"\b(?:petrol|gasoline|benzine)\b", "elektrisch": r"\b(?:electric|elektrisch)\b"}
                if word in ("diesel", "benzine", "elektrisch", "refurbished", "gebruikt", "nieuw") and re.search(
                    aliases.get(word, r"\b" + re.escape(word) + r"\b"), text):
                    inferred[key] = value_id
                    break
                if key in ("memoryRAM", "storage") and re.search(r"\b" + re.escape(word).replace(r"\ ", r"\s*") + r"\b", text):
                    inferred[key] = value_id
                    break
        if "mileage" in facets and "mileage" not in inferred:
            match = re.search(r"(?:under|below|minder dan|tot|max(?:imum)?)\s+(\d[\d., ]*)\s*km\b", text)
            if match:
                inferred["mileage"] = ":" + str(int(re.sub(r"\D", "", match[1])))
    return normalize_filters(category_id, inferred)


def search_words(query, category_id, filters):
    """Remove facets already sent as structured search filters from the free-text query."""
    category = categories().get(str(category_id)) if category_id is not None else None
    result = query
    for key, value in (filters or {}).items():
        facet = category.get("filters", {}).get(key) if category else None
        if not facet:
            continue
        if key == "mileage":
            result = re.sub(r"(?:under|below|minder dan|tot|max(?:imum)?)\s+\d[\d., ]*\s*km\b", "", result, flags=re.I)
        elif facet["type"] == "choice":
            label = facet["values"].get(value, "")
            if label:
                aliases = {"Gebruikt": r"\b(?:used|second.hand|gebruikt)\b", "Nieuw": r"\b(?:new|nieuw)\b",
                           "Benzine": r"\b(?:petrol|gasoline|benzine)\b", "Elektrisch": r"\b(?:electric|elektrisch)\b"}
                result = re.sub(aliases.get(label, r"\b" + re.escape(label).replace(r"\ ", r"\s*") + r"\b"), "", result, flags=re.I)
    result = re.sub(r"\b(?:within|binnen)\s+\d+\s*km\s+(?:of|van)\s+\d{4}[a-z]{0,2}\b", "", result, flags=re.I)
    result = re.sub(r"^\s*(?:a|an|een)\s+", "", result, flags=re.I)
    result = re.sub(r"\s+", " ", result).strip(" ,") or query
    if str(category_id) == "91" and result.lower() == "car":
        return "auto"
    return result


def search_params(category_id, filters):
    category_id, filters, note = normalize_filters(category_id, filters)
    if category_id is None:
        return {}, note
    cat = categories()[category_id]
    params = {"l1CategoryId": cat["l1Id"] or cat["id"]}
    if cat["l1Id"] is not None:
        params["l2CategoryIds[]"] = cat["id"]
    ids = []
    ranges = []
    for key, value in filters.items():
        if cat.get("filters", {}).get(key, {}).get("type") == "choice":
            ids.append(value)
        else:
            lower, upper = value.split(":")
            ranges.append(f"{key}:{lower}:{upper}")
    if ids:
        params["attributesById[]"] = ids
    if ranges:
        params["attributeRanges[]"] = ranges
    return params, note
