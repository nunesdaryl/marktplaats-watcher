import pytest

from evals import common, report, run_chat


def test_model_under_test_uses_environment_and_requires_prices(monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.5")
    assert common.model_under_test() == "gpt-5.5"
    assert common.cost_usd("gpt-5.5", 1_000_000, 1_000_000) == 35

    monkeypatch.setenv("OPENAI_MODEL", "unknown-model")
    with pytest.raises(ValueError, match="add prices for unknown-model to evals/common.py"):
        common.model_under_test()


def test_chat_results_record_configured_model(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.5")
    monkeypatch.setattr(run_chat, "CASES", [("case", "category", "question", [], "ask", 0, lambda r: True)])
    monkeypatch.setattr(run_chat.agent, "chat", lambda *args: {
        "answer": "answer", "searches": [], "proposals": [], "listings": [],
        "usage": {"input_tokens": 1_000_000, "output_tokens": 1_000_000, "tool_calls": 0},
    })
    monkeypatch.setattr(run_chat, "CHAT_RESULTS", tmp_path / "chat_results.json")

    run_chat.main()

    result = common.read(run_chat.CHAT_RESULTS)
    assert result["model"] == "gpt-5.5"
    assert result["prompt_version"] == run_chat.agent.PROMPT_VERSION["chat"]
    assert result["cost_usd"] == 35


def test_report_names_configured_model_and_separate_judge(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.5")
    monkeypatch.setattr(report, "REPORT", tmp_path / "report.md")

    report.main()

    text = report.REPORT.read_text()
    assert "Model under test: **gpt-5.5**" in text
    assert "Judge model: **gpt-5.5**" in text
    assert "Saved results used for this report: scorer **gpt-5.4-mini**, chat **gpt-5.4-mini**" in text
    assert "Prices: gpt-5.5 $5.00 / $30.00" in text


def test_human_overrides_change_metrics_and_failure_categories():
    listings = [
        {"id": "one", "url": "https://example.test/one"},
        {"id": "two", "url": "https://example.test/two"},
        {"id": "three", "url": "https://example.test/three"},
        {"id": "four", "url": "https://example.test/four"},
    ]
    spotcheck = ("| # | Watch | Listing | Price | Judge | Why | Agree? |\n"
                 "| 1 | x | [One](https://example.test/one) | 1 | over_budget | x | no |\n"
                 "| 2 | x | [Three](https://example.test/three) | 1 | match | x | no |\n"
                 "| 3 | x | [Four](https://example.test/four) | 1 | unclear | x | no |\n")
    overrides, answered, total = report.spotcheck_overrides(listings, spotcheck)
    assert (overrides, answered, total) == ({"one": "1", "three": "2", "four": "3"}, 3, 3)
    scored = [
        {"id": "one", "score": 8, "judge": {"match": False, "category": "over_budget"}},
        {"id": "two", "score": 8, "judge": {"match": False, "category": "wrong_model_or_spec"}},
        {"id": "three", "score": 8, "judge": {"match": True, "category": "match"}},
        {"id": "four", "score": 4, "judge": {"match": False, "category": "unclear"}},
    ]
    metric = report.scorer_metrics(scored, overrides, {"great": 8})["great"]
    assert (metric["tp"], metric["fp"], metric["fn"], metric["tn"]) == (1, 2, 1, 0)
    assert metric["precision"] == pytest.approx(1 / 3)
    assert metric["failures"]["false_positive", "wrong_model_or_spec"] == 1
    assert metric["failures"]["false_positive", "human_override"] == 1
    assert metric["failures"]["false_negative", "human_override"] == 1
    uncorrected = report.scorer_metrics(scored, {}, {"great": 8})["great"]
    assert uncorrected["failures"]["false_positive", "over_budget"] == 1
    assert (uncorrected["tp"], uncorrected["fp"], uncorrected["fn"], uncorrected["tn"]) == (1, 2, 0, 1)


def test_gate_thresholds_use_corrected_precision():
    from evals import gate

    listings = [{"id": str(i), "url": f"https://example.test/{i}"} for i in range(10)]
    scored = [{"id": str(i), "score": 8, "judge": {"match": i != 0, "category": "over_budget"}} for i in range(10)]
    scorer = {"scored": scored, "metrics": {"great": {"threshold": 8}}}
    spotcheck = "| 1 | x | [One](https://example.test/0) | 1 | over_budget | x | no |\n"
    assert gate.check({"passed": 19, "total": 20}, scorer, listings, spotcheck)
    assert not gate.check({"passed": 18, "total": 20}, scorer, listings, spotcheck)
    assert not gate.check({"passed": 19, "total": 21}, scorer, listings, spotcheck)
    assert gate.check({"passed": 19, "total": 20}, scorer, listings, "")
    scored[1]["judge"]["match"] = False
    assert not gate.check({"passed": 19, "total": 20}, scorer, listings, "")


def test_report_preserves_filled_signoff(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")
    monkeypatch.setattr(report, "REPORT", tmp_path / "report.md")
    signoff = "UAT sign-off: Daryl (name), 2026-10-01 (date), prompt versions chat-1/rank-1"
    report.REPORT.write_text(signoff + "\n")
    report.main()
    text = report.REPORT.read_text()
    assert signoff in text
    assert "overridden rows 3, 4, 9" in text
    assert "chat **not recorded**, rank **not recorded**" in text
    assert "| human_override |" in text
    assert "passing 7 of 15 repeated runs on main" in text
    report.main()
    assert report.REPORT.read_text().count(signoff) == 1


def test_scorer_results_record_prompt_version(monkeypatch, tmp_path):
    from evals import run_scorer

    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")
    listings = tmp_path / "listings.json"
    labels = tmp_path / "labels.json"
    result = tmp_path / "scorer_results.json"
    common.write(listings, {"watches": [{"id": "watch", "description": "chair"}],
                            "listings": [{"watch": "watch", "id": "one", "title": "Chair", "price_eur": 10}]})
    common.write(labels, {"labels": {"one": {"match": True, "category": "match", "reason": "Chair"}}})
    monkeypatch.setattr(run_scorer, "LISTINGS", listings)
    monkeypatch.setattr(run_scorer, "LABELS", labels)
    monkeypatch.setattr(run_scorer, "SCORER_RESULTS", result)
    monkeypatch.setattr(run_scorer.agent, "rank_listings", lambda description, items: [items[0] | {"score": 8, "reason": "Chair"}])
    run_scorer.main()
    assert common.read(result)["prompt_version"] == run_scorer.agent.PROMPT_VERSION["rank"]
