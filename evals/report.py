"""Step 5: evals/report.md from the saved results (no model calls)."""
import re
from collections import Counter

from evals.common import CHAT_RESULTS, LABELS, LISTINGS, PRICES, RATING_REASONS, REPEAT_RESULTS, REPORT, SCORER_RESULTS, SPOTCHECK, USD_TO_EUR, USER_CASES_GOLDEN, USER_CASES_PENDING, USER_RATINGS, cost_usd, model_under_test, read


def eur(usd):
    return f"€{usd * USD_TO_EUR:.4f}"


def pct(x):
    return "n/a" if x is None else f"{x * 100:.0f}%"


REASONS = read(RATING_REASONS)

SIGN_OFF = 'UAT sign-off: ______ (name), ______ (date), prompt versions ______'


def spotcheck_overrides(listings, spotcheck):
    ids_by_url = {listing["url"]: listing["id"] for listing in listings}
    overrides, answered, rows = {}, 0, 0
    for line in spotcheck.splitlines():
        if not re.match(r"\| \d+ \|", line):
            continue
        number = line.split("|", 2)[1].strip()
        answer = line.rsplit("|", 2)[1].strip().lower()
        url = re.search(r"\]\((https?://[^)]+)\)", line)
        if not url or url.group(1) not in ids_by_url:
            raise ValueError(f"spot-check row {number} has no matching listing URL")
        rows += 1
        if answer in ("yes", "no"):
            answered += 1
        if answer == "no":
            overrides[ids_by_url[url.group(1)]] = number
    return overrides, answered, rows


def scorer_metrics(scored, overrides, thresholds):
    metrics = {}
    for name, threshold in thresholds.items():
        tp, fp, fn, tn = [], [], [], []
        for row in scored:
            match = row["judge"]["match"] ^ (row["id"] in overrides)
            notified = row["score"] is not None and row["score"] >= threshold
            (tp if notified and match else fp if notified else fn if match else tn).append(row)
        failures = Counter()
        for kind, misses in (("false_positive", fp), ("false_negative", fn)):
            failures.update((kind, "human_override" if row["id"] in overrides else row["judge"]["category"])
                            for row in misses)
        metrics[name] = {
            "threshold": threshold, "tp": len(tp), "fp": len(fp), "fn": len(fn), "tn": len(tn),
            "precision": len(tp) / (len(tp) + len(fp)) if tp or fp else None,
            "recall": len(tp) / (len(tp) + len(fn)) if tp or fn else None,
            "false_positives": fp, "false_negatives": fn, "failures": failures,
        }
    return metrics


def user_precision(scored, threshold=8):
    emailed = [case for case in scored if case["score"] is not None and case["score"] >= threshold]
    return sum(case["label"] for case in emailed) / len(emailed) if emailed else None


def user_section(ratings, pending=0, confirmed=0, scored=None):
    """What people said about the alerts they got: a second, real-world check next to the judge (§1)."""
    head = ["## 1b. What users said about their alerts", "",
            f"Review queue: **{pending} pending**, **{confirmed} confirmed** scorer cases.", ""]
    if confirmed >= 20:
        precision = user_precision(scored or []) if scored is not None and len(scored) == confirmed else None
        head += [f"Confirmed user-case precision at score ≥ 8: **{pct(precision)}** ({confirmed} cases).", ""]
    if not ratings:
        return head + ["No ratings yet. Every alert e-mail and the Alerts page ask \"Good match? Yes / Not right\"; run "
                       "`.venv/bin/python -m evals.feedback_cases` to fetch them, then rerun this report.", ""]
    def band(s):
        return "unscored" if s is None else "great (8–10)" if s >= 8 else "good (6–7)" if s >= 6 else "below 6"
    rows, reasons = {}, Counter()
    for r in ratings:
        b = rows.setdefault(band(r["score"]), [0, 0])
        b[0] += 1
        b[1] += r["verdict"] == "good"
        reasons.update(r["reasons"])
    lines = head + [f"**{len(ratings)} ratings** from people who received the alerts (in the e-mail or the app). "
                    "\"Good match\" here is the user's own label, so this is precision measured by users, not by the judge.", "",
                    "| Score band | Rated | Said good match | User precision |", "|---|---|---|---|"]
    for name in ("great (8–10)", "good (6–7)", "below 6", "unscored"):
        if name in rows:
            n, g = rows[name]
            lines.append(f"| {name} | {n} | {g} | **{pct(g / n)}** |")
    lines.append("")
    if reasons:
        lines += ["**Why not right:** " + ", ".join(f"{REASONS.get(k, k)} ({n})" for k, n in reasons.most_common()), ""]
    notes = [r for r in ratings if r["verdict"] == "not_right" and r["note"]][:5]
    if notes:
        lines += ["Latest notes:", *[f"- \"{r['note']}\" on *{r['title']}* (scored {r['score']})" for r in notes], ""]
    if len(ratings) < 30:
        lines += [f"*Only {len(ratings)} ratings so far: read these as early signals, not as a measurement.*", ""]
    return lines


def main():
    model = model_under_test()
    s, c, labels = read(SCORER_RESULTS), read(CHAT_RESULTS), read(LABELS)
    price_in, price_out = PRICES[model]
    scoring_cost = cost_usd(model, s["tokens"]["input"], s["tokens"]["output"])
    chat_cost = cost_usd(model, c["tokens"]["input"], c["tokens"]["output"])
    overrides, answered, total = spotcheck_overrides(read(LISTINGS)["listings"], SPOTCHECK.read_text())
    disagreed = ", ".join(overrides.values())
    spot = (f"{answered - len(overrides)}/{total} agreed; overridden rows {disagreed or 'none'}" if answered == total
            else f"pending ({answered}/{total} answered); overridden rows {disagreed or 'none'}")
    metrics = scorer_metrics(s["scored"], overrides,
                             {name: m["threshold"] for name, m in s["metrics"].items()})
    runs = s.get("runs", [s])
    great_precisions = [scorer_metrics(run["scored"], overrides,
                                       {"great": run.get("great", run.get("metrics", {}).get("great"))["threshold"]})["great"]["precision"]
                        for run in runs]
    scorer_eval_cost = sum(run.get("cost_usd", cost_usd(model, run["tokens"]["input"], run["tokens"]["output"]))
                           + run.get("price_type_cost_usd", 0)
                           for run in runs)
    measured = [precision for precision in great_precisions if precision is not None]
    run_summary = (f"median of {len(runs)} {'run' if len(runs) == 1 else 'runs'}; "
                   f"range {min(measured) * 100:.1f}–{max(measured) * 100:.1f}%" if measured else
                   f"median of {len(runs)} runs; range n/a")
    old = REPORT.read_text() if REPORT.exists() else ""
    sign_off = next((line for line in old.splitlines() if line.startswith("UAT sign-off:")), SIGN_OFF)
    repeated = read(REPEAT_RESULTS) if REPEAT_RESULTS.exists() else []
    by_cat = Counter(r["category"] for r in c["cases"])
    pass_cat = Counter(r["category"] for r in c["cases"] if r["passed"])
    lines = [
        "# Evaluation report", "",
        f"Scorer run {s['run_at']}, chat run {c['run_at']}. Model under test: **{model}**. "
        f"Judge model: **{labels['judge']}**, human spot-check of {total} judge labels: **{spot}**.",
        f"Prompt versions: chat **{c.get('prompt_version', 'not recorded')}**, rank **{s.get('prompt_version', 'not recorded')}**.",
        sign_off, "",
        "## 1. Does the AI e-mail the right listings? (scorer vs corrected labels)", "",
        f"{s['listings']} real Marktplaats listings from 5 watches, frozen in `evals/data/listings.json`; "
        f"the judge marked **{s['judge_matches']}** as real matches. After human overrides, "
        f"**{sum(row['judge']['match'] ^ (row['id'] in overrides) for row in s['scored'])}** are real matches.", "",
        f"Corrected great precision: {run_summary}.", "",
        "| Notify level | E-mailed when | Precision | Recall | TP | FP | FN | TN |", "|---|---|---|---|---|---|---|---|",
    ]
    if s["model"] != model or c["model"] != model:
        lines[3:3] = [f"Saved results used for this report: scorer **{s['model']}**, chat **{c['model']}**. "
                      "Rerun those evals to measure the configured model.", ""]
    for name, m in metrics.items():
        lines.append(f"| {name} | score ≥ {m['threshold']} | **{pct(m['precision'])}** | **{pct(m['recall'])}** | {m['tp']} | {m['fp']} | {m['fn']} | {m['tn']} |")
    lines += ["", "*Precision: of the listings we e-mail, how many are real matches. Recall: of the real matches, how many we e-mail.*", ""]
    for name, m in metrics.items():
        if m["false_positives"] or m["false_negatives"]:
            lines.append(f"**Misses at '{name}':**")
            for fp in m["false_positives"]:
                category = "human_override" if fp["id"] in overrides else fp["judge"]["category"]
                lines.append(f"- E-mailed but not a match ({category}): {fp['title']} — scored {fp['score']}: {fp['reason']}")
            for fn in m["false_negatives"]:
                category = "human_override" if fn["id"] in overrides else fn["judge"]["category"]
                source = "original judge" if fn["id"] in overrides else "judge"
                lines.append(f"- Missed a match ({category}): {fn['title']} — scored {fn['score']}; {source}: {fn['judge']['reason']}")
            lines.append("")
        lines += [f"**Failure categories at '{name}':**", "", "| Category | False positives | False negatives |",
                  "|---|---|---|"]
        for category in sorted({category for _, category in m["failures"]}):
            lines.append(f"| {category} | {m['failures']['false_positive', category]} | {m['failures']['false_negative', category]} |")
        lines.append("")
    if any(run.get("price_type_cases") for run in runs):
        lines += ["## 1a. Price type regression cases", "",
                  "Four Switch OLED listings from 3 October were bidding from €200 at a €200 watch limit. "
                  "The fixed €160 case checks that an affordable fixed price can still score great.", "",
                  "| Run | Listing | Label | Score | Reason |", "|---|---|---|---:|---|"]
        for number, run in enumerate(runs, 1):
            for case in run.get("price_type_cases", []):
                lines.append(f"| {number} | {case['id']} | {case['label']} | {case['score']} | {case['reason']} |")
        lines.append("")
    pending = read(USER_CASES_PENDING) if USER_CASES_PENDING.exists() else []
    confirmed = read(USER_CASES_GOLDEN) if USER_CASES_GOLDEN.exists() else []
    lines += user_section(read(USER_RATINGS) if USER_RATINGS.exists() else [], len(pending), len(confirmed),
                          s.get("user_scored"))
    lines += [
        "## 2. Does the chat do the right thing? (20-case golden set)", "",
        f"**{c['passed']}/{c['total']} passed.**",
        *[f"Repeated runs: {r['case']} passed {r['passed']} of {r['runs']} (prompt {r['prompt_version']})"
          for r in repeated], "",
        "| Category | Passed |", "|---|---|",
        *[f"| {cat} | {pass_cat[cat]}/{n} |" for cat, n in by_cat.items()], "",
        "| Case | Question | Result | Tool calls (max) | Model calls |", "|---|---|---|---|---|",
        *[f"| {r['id']} | {r['message'][:70]} | {'✅' if r['passed'] else '❌ ' + (r['failure'] or '')} | {r['tool_calls']} ({r['max_tool_calls']}) | {r['model_calls']} |"
          for r in c["cases"]], "",
        "## What the evaluation found, and what changed", "",
        "- **First chat run: 18/20.** Case W4 (\"Watch it\" mode) searched instead of proposing a watch: the prompt asked, "
        "the model didn't listen. Fixed in code, not in the prompt: in watch mode the model is only given the proposal "
        "tools (`agent.watch_model`), with a unit test. Rerun: pass.",
        "- Case E2's pass condition was wrong, not the agent: it required zero listings, but a €4 adapter really is on "
        "the page and the agent correctly said it isn't a Mac mini. The check was corrected (see `evals/chat_cases.py`).",
        "- **Scorer weaknesses kept visible, not tuned away** on this small set: an iPhone 13 128GB at a good price "
        "scored 1 (a real miss), older or differently sized models (2011 Mac mini, iPhone 13 mini) land around the 6–8 "
        "line, and plainly titled bikes score 6–7 so they miss the 'great' bar. Next step: a larger labelled set "
        "before changing the prompt, then rerun.",
        "- The judge is strict: it called a €100 IKEA set 'over budget' for 'under €100', while the app's maximum is "
        "inclusive. That is why a human spot-checks the judge.", "",
        "## 3. Cost", "",
        f"- Scoring: {eur(scoring_cost / max(s['listings'], 1) * 100)} per 100 listings ({s['tokens']['input']} input + {s['tokens']['output']} output tokens for {s['listings']} listings).",
        f"- CI scorer evaluation: {len(runs)} scorer {'run' if len(runs) == 1 else 'runs'} "
        f"at about ${scorer_eval_cost / len(runs):.3f} each; about ${scorer_eval_cost:.3f} total.",
        f"- Chat: {eur(chat_cost / c['total'])} per question on average.",
        "- Chat output is capped at 1,500 tokens per model call.",
        f"- Judge (one-off): {eur(labels['cost_usd'])}.",
        f"- Prices: {model} ${price_in:.2f} / ${price_out:.2f} per 1M input/output tokens; €1 ≈ ${1 / USD_TO_EUR:.2f}.", "",
        "## How to rerun", "",
        "```bash", ".venv/bin/python -m evals.collect      # only to refresh the dataset (then relabel)",
        ".venv/bin/python -m evals.label        # judge labels + a new spot-check sample",
        ".venv/bin/python -m evals.run_scorer --runs 3", ".venv/bin/python -m evals.run_chat",
        ".venv/bin/python -m evals.repeat C3 15", ".venv/bin/python -m evals.report", "```",
        "Rerun after any prompt, model or tool change, and weekly (providers change models underneath you).",
    ]
    # Keep the measured running cost (§4, written by evals.cost with real model calls): regenerating must not lose it
    marker = "## 4. Running cost per watch (measured)"
    cost = old[old.index(marker):].rstrip() if marker in old else ""
    REPORT.write_text("\n".join(lines) + ("\n\n" + cost if cost else "") + "\n\n")
    print(f"wrote {REPORT}")


if __name__ == "__main__":
    main()
