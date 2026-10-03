"""Fail CI when the saved evaluation results miss the release thresholds."""

from evals.common import CHAT_RESULTS, LISTINGS, PRICE_TYPE_CASES, SCORER_RESULTS, SPOTCHECK, USER_CASES_GOLDEN, read
from evals.report import scorer_metrics, spotcheck_overrides, user_precision


def corrected_great_precisions(scorer, listings, spotcheck):
    overrides, _, _ = spotcheck_overrides(listings, spotcheck)
    runs = scorer.get("runs", [scorer])
    return [scorer_metrics(run["scored"], overrides,
                           {"great": run.get("great", run.get("metrics", {}).get("great"))["threshold"]})["great"]["precision"]
            for run in runs]


def corrected_great_precision(scorer, listings, spotcheck):
    values = corrected_great_precisions(scorer, listings, spotcheck)
    return sorted(values, key=lambda value: -1 if value is None else value)[len(values) // 2]


def price_type_cases_pass(scorer):
    expected = {case["id"]: case for case in read(PRICE_TYPE_CASES)}
    runs = scorer.get("runs", [scorer])
    if expected and len(runs) != 3:
        return False
    for run in runs:
        rows = run.get("price_type_cases", [])
        if len(rows) != len(expected) or {row["id"] for row in rows} != expected.keys():
            return False
        for row in rows:
            case = expected[row["id"]]
            score = row["score"]
            if score is None:
                return False
            if "max_score" in case:
                if score > case["max_score"] or "bid" not in row["reason"].lower():
                    return False
            elif score < case["min_score"]:
                return False
    return True


def check(chat, scorer, listings, spotcheck):
    precision = corrected_great_precision(scorer, listings, spotcheck)
    return (chat["total"] == 20 and chat["passed"] >= 19 and precision is not None and precision >= 0.9
            and price_type_cases_pass(scorer))


def main():
    chat, scorer = read(CHAT_RESULTS), read(SCORER_RESULTS)
    listings, spotcheck = read(LISTINGS)["listings"], SPOTCHECK.read_text()
    precision = corrected_great_precision(scorer, listings, spotcheck)
    passed = check(chat, scorer, listings, spotcheck)
    values = corrected_great_precisions(scorer, listings, spotcheck)
    formatted = ", ".join("n/a" if value is None else f"{value:.3f}".rstrip("0").rstrip(".") for value in values)
    print(f"Chat: {chat['passed']}/{chat['total']}; corrected great precision runs {formatted} → median {precision}")
    cases = scorer.get("runs", [scorer])
    print(f"Price type cases: {sum(len(run.get('price_type_cases', [])) for run in cases)} scored across {len(cases)} runs; "
          f"{'pass' if price_type_cases_pass(scorer) else 'fail'}")
    confirmed = read(USER_CASES_GOLDEN) if USER_CASES_GOLDEN.exists() else []
    if len(confirmed) >= 20:
        scored = scorer.get("user_scored", [])
        value = user_precision(scored) if len(scored) == len(confirmed) else None
        print(f"Confirmed user cases: {len(confirmed)}; great precision {value if value is not None else 'n/a'} (report only)")
    if not passed:
        raise SystemExit("Evaluation gate failed: require chat at least 19/20, great precision at least 90%, "
                         "and all price type cases passing in 3 runs")


if __name__ == "__main__":
    main()
