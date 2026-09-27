"""Step 3: the production scorer against the judge's labels. For each threshold the app offers ("great" ≥ 8,
"good" ≥ 6), a listing counts as e-mailed when its score reaches it. Reports precision, recall, the misses by
category, tokens, cost and time."""
import time

import agent
from evals.common import LABELS, LISTINGS, SCORER_RESULTS, cost_usd, read, write

THRESHOLDS = {"great": 8, "good": 6}


def main():
    data, labels = read(LISTINGS), read(LABELS)["labels"]
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
    usd = cost_usd("gpt-5.4-mini", tokens_in, tokens_out)
    write(SCORER_RESULTS, {
        "run_at": time.strftime("%Y-%m-%d %H:%M"), "model": "gpt-5.4-mini", "listings": len(scored),
        "judge_matches": sum(s["judge"]["match"] for s in scored), "metrics": metrics,
        "tokens": {"input": tokens_in, "output": tokens_out, "calls": len(agent.RANK_USAGE)},
        "cost_usd": round(usd, 5), "cost_usd_per_100_listings": round(usd / max(len(scored), 1) * 100, 5),
        "seconds_total": round(time.time() - started, 1), "scored": scored,
    })
    for name, m in metrics.items():
        print(f"{name:5} ≥{m['threshold']}: precision {m['precision']}  recall {m['recall']}  (tp {m['tp']} fp {m['fp']} fn {m['fn']})")
    print(f"cost ${usd:.5f} for {len(scored)} listings")


if __name__ == "__main__":
    main()
