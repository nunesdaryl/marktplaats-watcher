"""Step 5: evals/report.md from the saved results (no model calls)."""
import re
from collections import Counter

from evals.common import CHAT_RESULTS, LABELS, REPORT, SCORER_RESULTS, SPOTCHECK, USD_TO_EUR, read


def eur(usd):
    return f"€{usd * USD_TO_EUR:.4f}"


def pct(x):
    return "n/a" if x is None else f"{x * 100:.0f}%"


def main():
    s, c, labels = read(SCORER_RESULTS), read(CHAT_RESULTS), read(LABELS)
    agree = [row.split("|")[-2].strip().lower() for row in SPOTCHECK.read_text().splitlines() if re.match(r"\| \d+ \|", row)]
    marked = [a for a in agree if a in ("yes", "no")]
    disagreed = [str(i + 1) for i, a in enumerate(agree) if a == "no"]
    if len(marked) < len(agree) or not agree:
        spot = f"pending ({len(marked)}/{len(agree)} answered in evals/data/spotcheck.md)"
    else:
        spot = f"{marked.count('yes')}/{len(marked)} agreed" + (f" (disagreed on rows {', '.join(disagreed)}; the precision and "
               "recall below are still measured against the judge's labels)" if disagreed else "")
    by_cat = Counter(r["category"] for r in c["cases"])
    pass_cat = Counter(r["category"] for r in c["cases"] if r["passed"])
    lines = [
        "# Evaluation report", "",
        f"Scorer run {s['run_at']}, chat run {c['run_at']}. Model under test: **{s['model']}**. "
        f"Judge: **{labels['judge']}** (a stronger model), human spot-check of 10 judge labels: **{spot}**.", "",
        "## 1. Does the AI e-mail the right listings? (scorer vs judge)", "",
        f"{s['listings']} real Marktplaats listings from 5 watches, frozen in `evals/data/listings.json`; "
        f"the judge marked **{s['judge_matches']}** as real matches, the rest as noise (accessories, other products, other models).", "",
        "| Notify level | E-mailed when | Precision | Recall | TP | FP | FN | TN |", "|---|---|---|---|---|---|---|---|",
    ]
    for name, m in s["metrics"].items():
        lines.append(f"| {name} | score ≥ {m['threshold']} | **{pct(m['precision'])}** | **{pct(m['recall'])}** | {m['tp']} | {m['fp']} | {m['fn']} | {m['tn']} |")
    lines += ["", "*Precision: of the listings we e-mail, how many are real matches. Recall: of the real matches, how many we e-mail.*", ""]
    for name, m in s["metrics"].items():
        if m["false_positives"] or m["false_negatives"]:
            lines.append(f"**Misses at '{name}':**")
            for fp in m["false_positives"]:
                lines.append(f"- E-mailed but not a match ({fp['judge']}): {fp['title']} — scored {fp['score']}: {fp['reason']}")
            for fn in m["false_negatives"]:
                lines.append(f"- Missed a match: {fn['title']} — scored {fn['score']}; judge: {fn['judge_reason']}")
            lines.append("")
    lines += [
        "## 2. Does the chat do the right thing? (20-case golden set)", "",
        f"**{c['passed']}/{c['total']} passed.**", "", "| Category | Passed |", "|---|---|",
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
        f"- Scoring: {eur(s['cost_usd_per_100_listings'])} per 100 listings ({s['tokens']['input']} input + {s['tokens']['output']} output tokens for {s['listings']} listings).",
        f"- Chat: {eur(c['cost_usd_per_question'])} per question on average.",
        f"- Judge (one-off): {eur(labels['cost_usd'])}.",
        f"- Prices: gpt-5.4-mini $0.75 / $4.50 per 1M input/output tokens; €1 ≈ ${1 / USD_TO_EUR:.2f}.", "",
        "## How to rerun", "",
        "```bash", ".venv/bin/python -m evals.collect      # only to refresh the dataset (then relabel)",
        ".venv/bin/python -m evals.label        # judge labels + a new spot-check sample",
        ".venv/bin/python -m evals.run_scorer", ".venv/bin/python -m evals.run_chat", ".venv/bin/python -m evals.report", "```",
        "Rerun after any prompt, model or tool change, and weekly (providers change models underneath you).",
    ]
    # Keep the measured running cost (§4, written by evals.cost with real model calls): regenerating must not lose it
    marker = "## 4. Running cost per watch (measured)"
    old = REPORT.read_text() if REPORT.exists() else ""
    cost = old[old.index(marker):].rstrip() if marker in old else ""
    REPORT.write_text("\n".join(lines) + ("\n\n" + cost if cost else "") + "\n")
    print(f"wrote {REPORT}")


if __name__ == "__main__":
    main()
