"""Step 3: the production scorer against the judge's labels. For each threshold the app offers ("great" ≥ 8,
"good" ≥ 6), a listing counts as e-mailed when its score reaches it. Reports precision, recall, the misses by
category, tokens, cost and time."""
import argparse
import re
import sys
import time

import agent
from evals.common import AUDIT_MISSES, LABELS, LISTINGS, PRICE_TYPE_CASES, SCORER_RESULTS, USER_CASES_GOLDEN, cost_usd, model_under_test, read, write

THRESHOLDS = {"great": 8, "good": 6}



def watch_max_price(description):
    """The frozen cases keep the watch as text ('…, under €200'); the check passes the number."""
    m = re.search(r"under\s*€\s*(\d+)", description or "")
    return int(m.group(1)) if m else None

def median_run(runs):
    def value(run, metric):
        return run["great"][metric] if run["great"][metric] is not None else -1

    precision = sorted(value(run, "precision") for run in runs)[len(runs) // 2]
    return max((run for run in runs if value(run, "precision") == precision),
               key=lambda run: value(run, "recall"))


def score_once(data, labels, model):
    agent.RANK_USAGE.clear()
    scored, started = [], time.time()
    for w in data["watches"]:
        items = [dict(l) for l in data["listings"] if l["watch"] == w["id"]]
        for item in items:
            item.pop("watch")
        t0 = time.time()
        ranked = agent.rank_listings(w["description"], items)       # production code path
        ms = round((time.time() - t0) * 1000)
        for item in ranked:
            if item["id"] in labels:
                scored.append({"watch": w["id"], "id": item["id"], "title": item["title"], "price_eur": item["price_eur"],
                               "score": item["score"], "reason": item["reason"], "judge": labels[item["id"]], "ms": ms})
        print(f"{w['id']:7} scored {len(ranked)} in {ms} ms")

    metrics = {}
    for name, t in THRESHOLDS.items():
        tp = [s for s in scored if s["score"] is not None and s["score"] >= t and s["judge"]["match"]]
        fp = [s for s in scored if s["score"] is not None and s["score"] >= t and not s["judge"]["match"]]
        fn = [s for s in scored if (s["score"] is None or s["score"] < t) and s["judge"]["match"]]
        tn = len(scored) - len(tp) - len(fp) - len(fn)
        metrics[name] = {
            "threshold": t, "tp": len(tp), "fp": len(fp), "fn": len(fn), "tn": tn,
            "precision": round(len(tp) / (len(tp) + len(fp)), 3) if tp or fp else None,
            "recall": round(len(tp) / (len(tp) + len(fn)), 3) if tp or fn else None,
            "false_positives": [{k: s[k] for k in ("title", "score", "reason")} | {"judge": s["judge"]["category"]} for s in fp],
            "false_negatives": [{k: s[k] for k in ("title", "score", "reason")} | {"judge_reason": s["judge"]["reason"]} for s in fn],
        }
    tokens_in = sum(u[0] for u in agent.RANK_USAGE)
    tokens_out = sum(u[1] for u in agent.RANK_USAGE)
    usd = cost_usd(model, tokens_in, tokens_out)
    result = {
        "run_at": time.strftime("%Y-%m-%d %H:%M"), "model": model,
        "prompt_version": agent.PROMPT_VERSION["rank"], "listings": len(scored),
        "judge_matches": sum(s["judge"]["match"] for s in scored), "metrics": metrics,
        "tokens": {"input": tokens_in, "output": tokens_out, "calls": len(agent.RANK_USAGE)},
        "cost_usd": round(usd, 5), "cost_usd_per_100_listings": round(usd / max(len(scored), 1) * 100, 5),
        "seconds_total": round(time.time() - started, 1), "scored": scored,
    }
    price_type_cases = []
    for case in read(PRICE_TYPE_CASES):
        listing = agent.cap_bidding_scores(agent.rank_listings(case["watch_description"], [dict(case["listing"])], raise_on_failure=True),
                                           watch_max_price(case["watch_description"]))[0]
        price_type_cases.append({"id": case["id"], "label": case["label"],
                                 "score": listing["score"], "reason": listing["reason"]})
    case_usage = agent.RANK_USAGE[result["tokens"]["calls"]:]
    result["price_type_cases"] = price_type_cases
    result["price_type_cost_usd"] = round(cost_usd(model, sum(u[0] for u in case_usage),
                                                   sum(u[1] for u in case_usage)), 5)
    audit_usage_start = len(agent.RANK_USAGE)
    audit_cases = []
    for case in read(AUDIT_MISSES)["cases"]:
        listing = {key: value for key, value in case["listing"].items() if value is not None}
        ranked = agent.cap_bidding_scores(agent.rank_listings(case["watch_description"], [listing]),
                                          watch_max_price(case["watch_description"]))[0]
        audit_cases.append({"id": case["id"], "score": ranked["score"], "reason": ranked["reason"]})
    result["audit_misses"] = audit_cases
    audit_usage = agent.RANK_USAGE[audit_usage_start:]
    result["audit_misses_cost_usd"] = round(cost_usd(model, sum(u[0] for u in audit_usage),
                                                     sum(u[1] for u in audit_usage)), 5)
    for name, m in metrics.items():
        print(f"{name:5} ≥{m['threshold']}: precision {m['precision']}  recall {m['recall']}  (tp {m['tp']} fp {m['fp']} fn {m['fn']})")
    print(f"cost ${usd:.5f} for {len(scored)} listings")
    return result


def score_user_cases(cases):
    scored = []
    for case in cases:
        listing = dict(case["listing"])
        ranked = agent.rank_listings(case["watch_description"], [listing], raise_on_failure=True)
        scored.append({"id": case["id"], "score": ranked[0]["score"], "label": case["label"]})
    return scored


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=1)
    args = parser.parse_args([] if argv is None else argv)
    if args.runs < 1:
        parser.error("--runs must be at least 1")
    model = model_under_test()
    data, labels = read(LISTINGS), read(LABELS)["labels"]
    results = [score_once(data, labels, model) for _ in range(args.runs)]
    cases = read(USER_CASES_GOLDEN) if USER_CASES_GOLDEN.exists() else []
    user_scored = score_user_cases(cases)
    if args.runs == 1:
        write(SCORER_RESULTS, results[0] | {"user_scored": user_scored})
        return
    runs = [{"great": result["metrics"]["great"], "good": result["metrics"]["good"],
             "scored": result["scored"], "tokens": result["tokens"], "cost_usd": result["cost_usd"],
             "price_type_cases": result["price_type_cases"], "price_type_cost_usd": result["price_type_cost_usd"],
             "audit_misses": result["audit_misses"], "audit_misses_cost_usd": result["audit_misses_cost_usd"]}
            for result in results]
    selected = median_run(runs)
    write(SCORER_RESULTS, results[runs.index(selected)] | {"runs": runs, "user_scored": user_scored})


if __name__ == "__main__":
    main(sys.argv[1:])
