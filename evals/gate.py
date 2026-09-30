"""Fail CI when the saved evaluation results miss the release thresholds."""

from evals.common import CHAT_RESULTS, LISTINGS, SCORER_RESULTS, SPOTCHECK, read
from evals.report import scorer_metrics, spotcheck_overrides


def corrected_great_precisions(scorer, listings, spotcheck):
    overrides, _, _ = spotcheck_overrides(listings, spotcheck)
    runs = scorer.get("runs", [scorer])
    return [scorer_metrics(run["scored"], overrides,
                           {"great": run.get("great", run.get("metrics", {}).get("great"))["threshold"]})["great"]["precision"]
            for run in runs]


def corrected_great_precision(scorer, listings, spotcheck):
    values = corrected_great_precisions(scorer, listings, spotcheck)
    return sorted(values, key=lambda value: -1 if value is None else value)[len(values) // 2]


def check(chat, scorer, listings, spotcheck):
    precision = corrected_great_precision(scorer, listings, spotcheck)
    return chat["total"] == 20 and chat["passed"] >= 19 and precision is not None and precision >= 0.9


def main():
    chat, scorer = read(CHAT_RESULTS), read(SCORER_RESULTS)
    listings, spotcheck = read(LISTINGS)["listings"], SPOTCHECK.read_text()
    precision = corrected_great_precision(scorer, listings, spotcheck)
    passed = check(chat, scorer, listings, spotcheck)
    values = corrected_great_precisions(scorer, listings, spotcheck)
    formatted = ", ".join("n/a" if value is None else f"{value:.3f}".rstrip("0").rstrip(".") for value in values)
    print(f"Chat: {chat['passed']}/{chat['total']}; corrected great precision runs {formatted} → median {precision}")
    if not passed:
        raise SystemExit("Evaluation gate failed: require chat at least 19/20 and great precision at least 90%")


if __name__ == "__main__":
    main()
