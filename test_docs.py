"""Checks for the architecture decision index and public evaluation claims."""

import json
import re
import subprocess
from datetime import date
from pathlib import Path


def test_every_adr_is_linked_from_index():
    adr_dir = Path(__file__).parent / "docs" / "adr"
    index = (adr_dir / "README.md").read_text()
    records = sorted(adr_dir.glob("0*.md"))
    assert records
    for record in records:
        assert f"]({record.name})" in index, f"{record.name} is missing from the ADR index"


def test_readme_explains_failure_harness_and_mcp():
    readme = (Path(__file__).parent / "README.md").read_text()
    assert "## Failure harness" in readme
    assert "## MCP" in readme


def test_local_trail_export_matches_eval_sequence_shape():
    trail = json.loads((Path(__file__).parent / "evals/data/mw103_local_tool_trail.json").read_text())
    turn = trail["turn"]
    assert turn["tool_sequence"] == [step["name"] for step in turn["tool_trail"]]


def test_public_docs_have_no_unlabelled_stale_eval_numbers():
    root = Path(__file__).parent
    report = (root / "evals/report.md").read_text()
    great_precision = re.search(r"\| great \|[^\n]*\*\*(\d+)%\*\*", report).group(1)
    chat_passed = re.search(r"Outcome: \*\*(\d+/\d+)\*\*", report).group(1)
    scoring_cost = re.search(r"- Scoring: €(\d+\.\d+) per 100 listings", report).group(1)
    chat_cost = re.search(r"- Chat: (?:about )?€(\d+\.\d+) per question", report).group(1)
    watch_count = re.search(r"\d+ real Marktplaats listings from (\d+) watches", report).group(1)
    report_date = re.search(r"Scorer run (\d{4}-\d{2}-\d{2})", report).group(1)
    result = subprocess.run(
        ["grep", "-rn", "-E", r"94%|20/20|0\.028|0\.0019|0\.0018|5 watches", "docs/", "README.md", "evals/report.md"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode in (0, 1), result.stderr
    historical = re.compile(r"\b\d{1,2} (?:Sep|Oct) 2026\b.*\bsnapshot\b")
    unlabelled = []
    for line in result.stdout.splitlines():
        if line.startswith("docs/design/sieve/tokens.json:") and '"sample": "20/20"' in line:
            continue  # A design-token example, not a published evaluation claim.
        if historical.search(line):
            continue
        # The five-watch product limit is independent of the frozen eval fixture.
        if "5 watches" in line and re.search(r"(?:53 |listings from )5 watches", line):
            unlabelled.append(line)
        elif "20/20" in line and chat_passed != "20/20":
            unlabelled.append(line)
        elif "94%" in line and great_precision != "94":
            unlabelled.append(line)
        elif "0.028" in line and scoring_cost != "0.028":
            unlabelled.append(line)
        elif "0.0019" in line and chat_cost != "0.0019":
            unlabelled.append(line)
        elif "0.0018" in line and chat_cost != "0.0018":
            unlabelled.append(line)
    fixture = json.loads((root / "evals/data/listings.json").read_text())
    assert int(watch_count) == len(fixture["watches"]), "The report must agree with evals/data/listings.json"
    assert not unlabelled, "Eval figures disagree with the current report or need a dated snapshot label:\n" + "\n".join(unlabelled)

    # These are the public, current claims. A fresh report makes the check fail until they are updated.
    run_date = date.fromisoformat(report_date)
    date_label = f"{run_date.day} {run_date:%b %Y}"
    for name in ("README.md", "docs/demo/demo-script.md", "docs/marketing/PITCH-DECK-TRANSCRIPT.md"):
        document = (root / name).read_text()
        for value in (f"{great_precision}%", chat_passed, f"€{scoring_cost}", f"€{chat_cost}", date_label):
            assert value in document, f"{name} is missing {value} from the current report"


def test_current_public_great_recall_agrees_with_report_and_gate():
    from evals.common import LISTINGS, SCORER_RESULTS, SPOTCHECK, read
    from evals.gate import corrected_great_recall
    from evals.report import pct

    root = Path(__file__).parent
    report = (root / "evals/report.md").read_text()
    report_recall = re.search(r"\| great \|[^\n]*\*\*\d+%\*\* \| \*\*(\d+%)\*\*", report).group(1)
    scorer = read(SCORER_RESULTS)
    expected = pct(corrected_great_recall(scorer, read(LISTINGS)["listings"], SPOTCHECK.read_text()))
    assert report_recall == expected, "The report's great recall must equal the gate's corrected median"

    report_date = re.search(r"Scorer run (\d{4}-\d{2}-\d{2})", report).group(1)
    run_date = date.fromisoformat(report_date)
    date_label = f"{run_date.day} {run_date:%b %Y}"
    current_docs = (
        "README.md", "docs/demo/demo-script.md", "docs/demo/pre-demo-checklist.md",
        "docs/system-design.html", "docs/marketing/PITCH-DECK-TRANSCRIPT.md",
        "docs/design/sieve/README.md", "docs/design/claude-design-brief.md",
    )
    for name in current_docs:
        for number, line in enumerate((root / name).read_text().splitlines(), 1):
            if "recall" not in line.lower() or "great" not in line.lower():
                continue
            if re.search(r"\b(?:historical|earlier) snapshot\b", line, re.I):
                continue
            great_claim = re.split(r"\bgood(?:-match)?\b", re.split("great", line, maxsplit=1, flags=re.I)[1], maxsplit=1, flags=re.I)[0]
            values = re.findall(r"recall\s+(\d+%)|(\d+%)\s+recall", great_claim, re.I)
            if not values:
                continue
            assert expected in {value for pair in values for value in pair if value}, (
                f"{name}:{number} cites a great recall different from {expected}: {line}"
            )
            if date_label in line or name == "docs/demo/demo-script.md":
                assert "median of 3" in line, f"{name}:{number} must qualify the current recall"


def test_report_has_operating_sections():
    report = (Path(__file__).parent / "evals/report.md").read_text()
    for section in ("## Operating rules", "## Open risks", "## Failure mapping"):
        assert section in report
    rules = report.split("## Operating rules\n", 1)[1].split("## Open risks", 1)[0]
    assert [line.split(" —", 1)[0] for line in rules.splitlines() if line.strip()] == [
        "CONFIDENCE", "ESCALATION", "READINESS"]


def test_case_study_links_and_report_citations():
    root = Path(__file__).parent
    case = root / "docs/case-study.md"
    assert case.is_file()
    content = case.read_text()
    assert "[Case study](docs/case-study.md)" in (root / "README.md").read_text()
    report = (root / "evals/report.md").read_text()
    headings = re.findall(r"^## (.+)$", report, re.M)
    citations = re.findall(r"\[evals/report\.md §([^]]+)\]\(\.\./evals/report\.md#[^)]+\)", content)
    assert citations
    assert set(citations) <= set(headings)
    assert not re.search(r"report\.md:\d+", content), "Use report headings, not moving line numbers"


def test_case_study_figures_match_current_report():
    root = Path(__file__).parent
    case = (root / "docs/case-study.md").read_text()
    report = (root / "evals/report.md").read_text()
    scorer_date = re.search(r"Scorer run (\d{4}-\d{2}-\d{2})", report).group(1)
    chat_date = re.search(r"chat run (\d{4}-\d{2}-\d{2})", report).group(1)
    assert f"Scorer run: {scorer_date}" in case
    assert f"chat run: {chat_date}" in case
    for pattern in (
        r"(\d+) real Marktplaats listings from (\d+) watches",
        r"Outcome: \*\*(\d+/\d+)\*\*; trajectory: \*\*(\d+/\d+)\*\*",
        r"\| great \|[^\n]*\*\*(\d+%)\*\* \| \*\*(\d+%)\*\*",
        r"\| good \|[^\n]*\*\*(\d+%)\*\* \| \*\*(\d+%)\*\*",
        r"great precision range (\d+\.\d+–\d+\.\d+%)",
        r"great recall range (\d+\.\d+–\d+\.\d+%)",
        r"Chat p95: \*\*(\d+\.\d+ s)\*\*",
        r"Scoring: (€\d+\.\d+ per 100 listings)",
        r"Chat: (?:about )?(€\d+\.\d+ per question)",
    ):
        match = re.search(pattern, report)
        assert match, pattern
        for value in match.groups():
            assert value in case, f"case study is missing current report value {value}"
    failure = report.split("## Failure mapping\n", 1)[1].split("\n## ", 1)[0]
    for category, count in re.findall(r"^\| (missing context|wrong tool|wrong record|invalid output|unsafe action|timeout) \|[^\n]*\| (\d+) \|", failure, re.M):
        assert re.search(rf"\| {category} \| {count} \|", case), category

    # Check the case study's own measured claims, including repeated cost claims.
    assert re.search(r"scored \*\*(\d+/\d+) outcome", case).group(1) == re.search(
        r"Outcome: \*\*(\d+/\d+)\*\*", report).group(1)
    assert re.search(r"and \*\*(\d+/\d+) trajectory", case).group(1) == re.search(
        r"trajectory: \*\*(\d+/\d+)\*\*", report).group(1)
    assert re.search(r"\*\*(\d+) real Marktplaats listings from (\d+) watches", case).groups() == re.search(
        r"(\d+) real Marktplaats listings from (\d+) watches", report).groups()
    for label in ("great", "good"):
        precision, recall = re.search(rf"\| {label} \|[^\n]*\*\*(\d+%)\*\* \| \*\*(\d+%)\*\*", report).groups()
        if label == "great":
            assert re.search(r"great-match precision was \*\*(\d+%)\*\*", case).group(1) == precision
            assert re.search(r"and recall \*\*(\d+%)\*\*", case).group(1) == recall
        else:
            assert re.search(r"good-match precision/recall were \*\*(\d+%)/(\d+%)\*\*", case).groups() == (precision, recall)
    scoring_cost = re.search(r"Scoring: €(\d+\.\d+) per 100 listings", report).group(1)
    chat_cost = re.search(r"Chat: €(\d+\.\d+) per question", report).group(1)
    assert set(re.findall(r"€(\d+\.\d+) per 100 listings", case)) == {scoring_cost}
    assert set(re.findall(r"€(\d+\.\d+) per (?:chat )?question", case)) == {chat_cost}
    assert re.search(r"eval p95 was \*\*(\d+\.\d+ s)\*\*", case).group(1) == re.search(
        r"Chat p95: \*\*(\d+\.\d+ s)\*\*", report).group(1)
