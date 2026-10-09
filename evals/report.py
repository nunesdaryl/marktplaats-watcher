"""Step 5: evals/report.md from the saved results (no model calls)."""
import re
from collections import Counter
from statistics import median
from math import ceil
from pathlib import Path


from prompts import PROMPT_VERSION
from evals.common import AUDIT_MISSES, CHAT_RESULTS, LABELS, LISTINGS, PRICES, RAG_RESULTS, RATING_REASONS, REPEAT_RESULTS, REPORT, SCORER_RESULTS, SPOTCHECK, USD_TO_EUR, USER_CASES_GOLDEN, USER_CASES_PENDING, USER_RATINGS, cost_usd, model_under_test, read


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
    head = ["## 1c. What users said about their alerts", "",
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


def p95_ms(cases):
    times = sorted(row["ms"] for row in cases if isinstance(row.get("ms"), (int, float)))
    return times[ceil(.95 * len(times)) - 1] if times else None


def failure_mapping(scorer, audit, overrides, chat_cases):
    """Count representative-run misses plus operator-confirmed delivery audit misses."""
    mapping = {
        "human_override": "wrong record", "wrong_model_or_spec": "wrong record",
        "different_product": "wrong record", "accessory_or_part": "wrong record",
        "over_budget": "invalid output", "unclear": "missing context",
    }
    counts = Counter()
    examples = {}
    for name, metric in scorer.items():
        for kind in ("false_positives", "false_negatives"):
            for row in metric[kind]:
                label = "human_override" if row["id"] in overrides else row["judge"]["category"]
                cat = mapping.get(label, "invalid output")
                counts[cat] += 1
                examples.setdefault(cat, row.get("title", row["id"]))
    for row in chat_cases:
        if not row.get("passed"):
            category = "timeout" if "timeout" in (row.get("failure") or "").lower() else "invalid output"
            counts[category] += 1
            examples.setdefault(category, f"chat {row['id']}: {row.get('failure') or 'wrong result'}")
    for case in audit:
        if case.get("should_alert") and case.get("check_score", 0) < case["notify_threshold"]:
            counts["missing context"] += 1
            examples.setdefault("missing context", case["listing"]["title"])
    return counts, examples


def offer_section():
    from offer import normalize_prices
    from evals.common import DATA
    cases = read(DATA / "offer_golden.json")
    correct = formatted = 0
    for case in cases:
        opening, maximum = normalize_prices(case["priceEur"] * .8, case["priceEur"] * 1.2,
                                             case["priceEur"], case["watchMaxEur"])
        correct += 0 < opening <= maximum <= case["priceEur"] and (case["watchMaxEur"] is None or maximum <= case["watchMaxEur"])
        formatted += opening % 5 == maximum % 5 == 0
    return ["## Second process: offer-price rules", "",
            "Offline price normalization on `evals/data/offer_golden.json`; this does not call the offer model. "
            "Model wording and live latency remain unmeasured.", "",
            "| Process | Correctness | Format | Cost per case | Latency p95 |",
            "|---|---|---|---|---|",
            f"| Offer price rules ({len(cases)} cases) | {correct}/{len(cases)} within asking price and watch cap | "
            f"{formatted}/{len(cases)} €5 steps | €0 (offline) | not measured (offline) |", ""]


def update_nfr_latency(value, count, run_at):
    path = Path(__file__).resolve().parent.parent / "docs/nfr.md"
    if not path.exists() or value is None:
        return
    content = path.read_text()
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if line.startswith("1. **How quickly should chat answer (p95)?**"):
            lines[i] = (f"1. **How quickly should chat answer (p95)?** **{value / 1000:.2f} seconds** "
                        f"from {count} golden chat cases on {run_at} (nearest-rank p95). This is an eval-run "
                        "measurement, not production latency. The chat turn deadline is 60 seconds; the Vercel "
                        "Python function has `maxDuration` 300 seconds. Chat output is capped at 1,500 tokens "
                        "per model call. Source: [evaluation report](../evals/report.md).")
            break
    path.write_text("\n".join(lines) + "\n")


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
    run_metrics = [scorer_metrics(run["scored"], overrides,
                                  {name: run.get(name, run.get("metrics", {}).get(name, s["metrics"][name]))["threshold"]
                                   for name in metrics}) for run in runs]
    scorer_eval_cost = sum(run.get("cost_usd", cost_usd(model, run["tokens"]["input"], run["tokens"]["output"]))
                           + run.get("price_type_cost_usd", 0) + run.get("audit_misses_cost_usd", 0)
                           for run in runs)
    def median_metric(name, field):
        values = [run[name][field] for run in run_metrics if run[name][field] is not None]
        return median(values) if values else None

    def metric_range(field):
        values = [run["great"][field] for run in run_metrics if run["great"][field] is not None]
        return f"{min(values) * 100:.1f}–{max(values) * 100:.1f}%" if values else "n/a"

    run_summary = (f"Median of {len(runs)} {'run' if len(runs) == 1 else 'runs'}; "
                   f"great precision range {metric_range('precision')}, great recall range {metric_range('recall')}. "
                   "TP/FP/FN/TN counts are omitted; misses below use the saved representative run.")
    old = REPORT.read_text() if REPORT.exists() else ""
    sign_off = next((line for line in old.splitlines() if line.startswith("UAT sign-off:")), SIGN_OFF)
    repeated = read(REPEAT_RESULTS) if REPEAT_RESULTS.exists() else []
    from evals.chat_cases import CASE_META, SHOULD_ABSTAIN
    for row in c["cases"]:
        if row["id"] in CASE_META:
            row.setdefault("stratum", CASE_META[row["id"]][0])
            row.setdefault("why_correct", CASE_META[row["id"]][1])
            row.setdefault("should_abstain", row["id"] in SHOULD_ABSTAIN)
    by_cat = Counter(r["category"] for r in c["cases"])
    pass_cat = Counter(r["category"] for r in c["cases"] if r["passed"])
    lines = [
        "# Evaluation report", "",
        f"Scorer run {s['run_at']}, chat run {c['run_at']}. Model under test: **{model}**. "
        f"Judge model: **{labels['judge']}**, human spot-check of {total} judge labels: **{spot}**.",
        f"Prompt versions: chat **{c.get('prompt_version', 'not recorded')}**, rank **{s.get('prompt_version', 'not recorded')}**.",
        sign_off, "",
        "## 1. Does the AI e-mail the right listings? (scorer vs corrected labels)", "",
        f"{s['listings']} real Marktplaats listings from {len(read(LISTINGS).get('watches', []))} watches, frozen in `evals/data/listings.json`; "
        f"the judge marked **{s['judge_matches']}** as real matches. After human overrides, "
        f"**{sum(row['judge']['match'] ^ (row['id'] in overrides) for row in s['scored'])}** are real matches.", "",
        "| Notify level | E-mailed when | Precision | Recall |", "|---|---|---|---|",
    ]
    if s.get("prompt_version") != PROMPT_VERSION["rank"]:
        lines[5:5] = [f"Current rank prompt **{PROMPT_VERSION['rank']}** has no saved scorer run yet; "
                      "new precision, recall, and audit-miss scores await the credentialed eval.", ""]
    if s["model"] != model or c["model"] != model:
        lines[3:3] = [f"Saved results used for this report: scorer **{s['model']}**, chat **{c['model']}**. "
                      "Rerun those evals to measure the configured model.", ""]
    for name, m in metrics.items():
        lines.append(f"| {name} | score ≥ {m['threshold']} | **{pct(median_metric(name, 'precision'))}** | **{pct(median_metric(name, 'recall'))}** |")
    lines += ["", run_summary]
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
    audit = read(AUDIT_MISSES)["cases"]
    lines += ["## 1b. Delivery audit misses (7 and 9 October)", "",
              "The six frozen cases record the check score and, where known, the daily audit score. "
              "Unknown listing fields in the audit summary are omitted from scorer input.", ""]
    if any(run.get("audit_misses") for run in runs):
        lines += ["| Run | Listing | Check | Audit | New score | Notify bar |",
                  "|---|---|---:|---:|---:|---:|"]
        cases_by_id = {case["id"]: case for case in audit}
        for number, run in enumerate(runs, 1):
            for row in run.get("audit_misses", []):
                case = cases_by_id[row["id"]]
                audit_score = case["audit_score"] if case["audit_score"] is not None else "—"
                lines.append(f"| {number} | {case['listing']['title']} | {case['check_score']} | "
                             f"{audit_score} | {row['score']} | {case['notify_threshold']} |")
        lines.append("")
    else:
        lines += ["New scorer measurements pending the credentialed three-run eval; saved scorer results "
                  "above are from the earlier prompt.", ""]
    pending = read(USER_CASES_PENDING) if USER_CASES_PENDING.exists() else []
    confirmed = read(USER_CASES_GOLDEN) if USER_CASES_GOLDEN.exists() else []
    lines += user_section(read(USER_RATINGS) if USER_RATINGS.exists() else [], len(pending), len(confirmed),
                          s.get("user_scored"))
    counts, examples = failure_mapping(metrics, audit, overrides, c["cases"])
    lines += ["## Failure mapping", "",
              "Counts below use the saved representative scorer run at both notification levels, plus "
              "operator-confirmed should-alert misses from the delivery audit. A listing may appear at both levels.", "",
              "| Operational category | Existing failure labels / source | Count | Observed exception |", "|---|---|---:|---|"]
    sources = {"missing context": "unclear; delivery audit missing fields",
               "wrong tool": "chat tool mismatch", "wrong record": "human_override; wrong_model_or_spec; different_product; accessory_or_part",
               "invalid output": "over_budget; chat wrong result", "unsafe action": "forbidden watch or notify call",
               "timeout": "chat timeout"}
    for category in ("missing context", "wrong tool", "wrong record", "invalid output", "unsafe action", "timeout"):
        lines.append(f"| {category} | {sources[category]} | {counts[category]} | {examples.get(category, 'None observed in these saved results')} |")
    lines.append("")
    lines += [
        f"## 2. Does the chat do the right thing? ({c['total']}-case golden set)", "",
        f"Outcome: **{sum(r.get('outcome_passed', r['passed']) for r in c['cases'])}/{c['total']}**; "
        f"trajectory: **{str(sum(r.get('trajectory_passed', False) for r in c['cases'])) + '/' + str(c['total']) if all('trajectory_passed' in r for r in c['cases']) else 'pending rerun'}**. "
        "These are separate grades.",
        *[f"Repeated runs: {r['case']} passed {r['passed']} of {r['runs']} (prompt {r['prompt_version']})"
          for r in repeated], "",
        "| Category | Passed |", "|---|---|",
        *[f"| {cat} | {pass_cat[cat]}/{n} |" for cat, n in by_cat.items()], "",
        "Outcome and trajectory are separate grades. The trajectory grade checks the ordered tool names; "
        "watch writes require the user's Save confirmation (ADR 0002).", "",
        "| Case | Stratum | Question | Why correct | Outcome | Trajectory | Tool calls (max) | Model calls | Cost | Latency |",
        "|---|---|---|---|---|---:|---:|---:|---:|",
        *[f"| {r['id']} | {r.get('stratum', 'unclassified')} | {r['message'][:70]} | {r.get('why_correct', '—')} | "
          f"{'pass' if r.get('outcome_passed', r['passed']) else 'fail'} | "
          f"{('pass' if r['trajectory_passed'] else 'fail') if 'trajectory_passed' in r else 'not recorded'} | "
          f"{r['tool_calls']} ({r['max_tool_calls']}) | {r['model_calls']} | "
          f"{eur(r['cost_usd']) if 'cost_usd' in r else 'not recorded'} | "
          f"{str(r['ms']) + ' ms' if 'ms' in r else 'not recorded'} |"
          for r in c["cases"]], "",
        "## Chat strata and abstention", "",
        "The 20-case learner floor is met; Varick's working size is about 100 cases for a narrow task. "
        "The enlarged golden set remains a small regression sample, not a population estimate.", "",
        "| Stratum | Outcome pass | Trajectory pass | Should-abstain cases |", "|---|---:|---:|---:|",
        *[f"| {name} | {sum(bool(r.get('outcome_passed', r['passed'])) for r in c['cases'] if r.get('stratum') == name)}/"
          f"{sum(r.get('stratum') == name for r in c['cases'])} | "
          f"{str(sum(r.get('trajectory_passed', False) for r in c['cases'] if r.get('stratum') == name)) + '/' + str(sum(r.get('stratum') == name for r in c['cases'])) if all('trajectory_passed' in r for r in c['cases'] if r.get('stratum') == name) else 'pending rerun'} | "
          f"{sum(bool(r.get('should_abstain')) for r in c['cases'] if r.get('stratum') == name)} |"
          for name in ("normal", "edge", "ambiguous", "high-risk")], "",
        f"Chat p95: **{p95_ms(c['cases']) / 1000:.2f} s** over {sum('ms' in r for r in c['cases'])} cases "
        f"on {c['run_at']} (nearest-rank, eval-run latency)." if p95_ms(c['cases']) is not None else "Chat p95: not measured.", "",
        "The SOP perturbation removes one line about listing titles being data for P1; "
        "its result appears after the credentialed chat rerun.", "",
        "### Judge bias", "",
        "Judge inputs omit model and provider provenance. Across the 20-case learner set, adding decoy "
        "model/provider metadata changes 0/20 judge prompts (0 percentage-point input-agreement delta). "
        "No paired judge decisions were saved, so the judge-output agreement delta is not measured. "
        "The prompt test establishes blinding, not empirical judge bias.", "",
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
        "## Operating rules", "",
        "CONFIDENCE — great score ≥ 8; good score ≥ 6.",
        "ESCALATION — ADR 0002 requires user confirmation for a watch change; a real delivery miss sends owner e-mail (MW-40).",
        ("READINESS — the saved chat and scorer results meet the gate, with every case graded on outcome and trajectory; "
         "judge agreement under decoy provenance is still unmeasured."
         if all("trajectory_passed" in row for row in c.get("cases", []))
         else "READINESS — the saved results meet the gate; trajectory grades await a chat rerun with tool sequences."), "",
        "## Open risks", "",
        "- Small, selected golden set; per-stratum rates are directional until about 100 cases are labelled.",
        "- A deterministic trajectory check sees tool names, not every argument or off-platform effect.",
        "- Judge agreement under decoy provenance has not been empirically measured.", "",
        "### Shadow phase (9 October 2026 note)", "",
        "The silent first check and `dryRun` checks were the shadow phase: candidate alerts were observed without "
        "sending them. Reduce human review only after at least 100 labelled cases, every high-risk and "
        "should-abstain stratum passes, and no real delivery miss remains unresolved for seven days.", "",
        *offer_section(),
        "## Four-dimension process scorecard", "",
        "| Process | Correctness | Format | Cost per case | Latency p95 |", "|---|---|---|---|---|",
        f"| Chat ({c['total']} cases) | outcome {sum(r.get('outcome_passed', r['passed']) for r in c['cases'])}/{c['total']}; "
        f"trajectory {str(sum(r.get('trajectory_passed', False) for r in c['cases'])) + '/' + str(c['total']) if all('trajectory_passed' in r for r in c['cases']) else 'pending rerun'} | "
        f"{pct(sum(bool(r.get('answer')) for r in c['cases']) / c['total'])} nonempty answers | "
        f"{eur(chat_cost / c['total'])} average | "
        f"{str(round(p95_ms(c['cases']) / 1000, 2)) + ' s' if p95_ms(c['cases']) is not None else 'not measured'} |", "",
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
    rag = "## RAG and MCP\n\nNo real-data snapshot evaluation has been recorded yet.\n"
    if RAG_RESULTS.exists():
        result = read(RAG_RESULTS)
        rows = ["## RAG and MCP", "", f"Snapshot: {result['snapshot']}; run: {result['run_at']}.", "",
                "| Retrieval | Recall@5 | Precision@5 |", "|---|---:|---:|"]
        for mode, metrics in result["retrieval"].items():
            rows.append(f"| {mode} | {metrics['recall_at_5']:.3f} | {metrics['precision_at_5']:.3f} |")
        answers = result["answers"]
        rows += ["", f"Faithfulness: {result['faithfulness']:.3f} (bar 0.9); "
                 f"mean answer relevance: {sum(row['relevance'] for row in answers) / len(answers):.2f}/5; "
                 f"live MCP: {sum(row['passed'] for row in result['live_mcp'])}/4 (bar 4/4).",
                 f"Mean steps: {sum(row['steps'] for row in answers) / len(answers):.2f}; "
                 f"mean tokens: {sum(row['tokens']['input'] + row['tokens']['output'] for row in answers) / len(answers):.0f}; "
                 f"mean cost: ${sum(row['cost_usd'] for row in answers) / len(answers):.5f} per answer.", ""]
        rag = "\n".join(rows)
    if REPORT.resolve() == (Path(__file__).resolve().parent / "report.md") and p95_ms(c["cases"]) is not None:
        update_nfr_latency(p95_ms(c["cases"]), sum("ms" in r for r in c["cases"]), c["run_at"])
    REPORT.write_text("\n".join(lines) + "\n\n" + rag + ("\n\n" + cost if cost else "") + "\n\n")
    print(f"wrote {REPORT}")


if __name__ == "__main__":
    main()
