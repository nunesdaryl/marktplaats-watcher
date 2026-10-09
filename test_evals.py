from prompts import PROMPT_VERSION
import pytest

from evals import common, gate, repeat, report, run_chat, run_scorer


@pytest.fixture
def eval_files(monkeypatch, tmp_path):
    paths = {name: tmp_path / filename for name, filename in {
        "CHAT_RESULTS": "chat_results.json",
        "REPEAT_RESULTS": "repeat_results.json",
        "SCORER_RESULTS": "scorer_results.json",
        "PRICE_TYPE_CASES": "price_type_cases.json",
        "AUDIT_MISSES": "audit_misses.json",
        "LABELS": "labels.json",
        "LISTINGS": "listings.json",
        "SPOTCHECK": "spotcheck.md",
        "USER_RATINGS": "user_ratings.json",
        "REPORT": "report.md",
        "RAG_RESULTS": "rag_results.json",
    }.items()}
    for module in (common, report, gate):
        for name, path in paths.items():
            if hasattr(module, name):
                monkeypatch.setattr(module, name, path)

    listings = [{"id": name, "url": f"https://example.test/{name}"}
                for name in ("one", "two", "three", "four")]
    scored = [
        {"id": "one", "score": 8, "title": "One", "reason": "Reason",
         "judge": {"match": False, "category": "over_budget", "reason": "Reason"}},
        {"id": "two", "score": 8, "title": "Two", "reason": "Reason",
         "judge": {"match": False, "category": "wrong_model_or_spec", "reason": "Reason"}},
        {"id": "three", "score": 8, "title": "Three", "reason": "Reason",
         "judge": {"match": True, "category": "match", "reason": "Reason"}},
        {"id": "four", "score": 4, "title": "Four", "reason": "Reason",
         "judge": {"match": False, "category": "unclear", "reason": "Reason"}},
    ]
    common.write(paths["LISTINGS"], {"listings": listings})
    common.write(paths["LABELS"], {"judge": "gpt-5.5", "cost_usd": 0})
    common.write(paths["PRICE_TYPE_CASES"], [])
    common.write(paths["AUDIT_MISSES"], {"cases": []})
    common.write(paths["SCORER_RESULTS"], {
        "run_at": "2026-09-30", "model": "gpt-5.4-mini", "tokens": {"input": 0, "output": 0},
        "listings": 4, "judge_matches": 1, "scored": scored,
        "metrics": {"great": {"threshold": 8}, "good": {"threshold": 6}},
    })
    common.write(paths["CHAT_RESULTS"], {
        "run_at": "2026-09-30", "model": "gpt-5.4-mini", "tokens": {"input": 0, "output": 0},
        "passed": 19, "total": 20, "cases": [],
    })
    paths["SPOTCHECK"].write_text(
        "| 3 | x | [One](https://example.test/one) | 1 | over_budget | x | no |\n"
        "| 4 | x | [Three](https://example.test/three) | 1 | match | x | no |\n"
        "| 9 | x | [Four](https://example.test/four) | 1 | unclear | x | no |\n")
    return paths


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


def test_repeat_counts_golden_case_and_replaces_saved_entry(monkeypatch, eval_files, capsys):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")
    monkeypatch.setattr(repeat, "REPEAT_RESULTS", eval_files["REPEAT_RESULTS"])
    common.write(eval_files["REPEAT_RESULTS"], [
        {"case": "C3", "runs": 1, "passed": 0},
        {"case": "C2", "runs": 2, "passed": 2},
    ])
    calls = []

    def fake_chat(message, history, watches, mode):
        calls.append((message, history, watches, mode))
        proposals = [{"type": "update", "watchId": "w1", "notify": "great"}] if len(calls) < 3 else []
        return {"answer": "Ready to save", "searches": [], "proposals": proposals,
                "listings": [], "usage": {"tool_calls": 1}}

    monkeypatch.setattr(repeat.agent, "chat", fake_chat)
    repeat.main("C3", 3)

    assert len(calls) == 3
    assert all(call[1:] == ([], [{"id": "w1", "label": "Mac mini, under €500",
                                      "summary": "every day at 08:00", "active": True}], "search") for call in calls)
    assert capsys.readouterr().out == "C3: 2/3\n"
    saved = common.read(eval_files["REPEAT_RESULTS"])
    assert len(saved) == 2 and saved[0]["case"] == "C2"
    assert saved[1]["case"] == "C3"
    assert {key: saved[1][key] for key in ("runs", "passed", "prompt_version", "model")} == {
        "runs": 3, "passed": 2, "prompt_version": PROMPT_VERSION["chat"], "model": "gpt-5.4-mini"}
    assert saved[1]["at"]


def test_report_shows_repeated_runs_in_chat_section(monkeypatch, eval_files):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")
    common.write(eval_files["REPEAT_RESULTS"], [
        {"case": "C3", "runs": 15, "passed": 14, "prompt_version": "chat-2026-09-30.2"},
    ])

    report.main()

    text = eval_files["REPORT"].read_text()
    assert "Repeated runs: C3 passed 14 of 15 (prompt chat-2026-09-30.2)" in text
    assert "Fix tracked as MW-16" not in text


def test_report_names_configured_model_and_separate_judge(monkeypatch, eval_files):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.5")

    report.main()

    text = report.REPORT.read_text()
    assert "Model under test: **gpt-5.5**" in text
    assert "Judge model: **gpt-5.5**" in text
    assert "Saved results used for this report: scorer **gpt-5.4-mini**, chat **gpt-5.4-mini**" in text
    assert "Prices: gpt-5.5 $5.00 / $30.00" in text


def test_human_overrides_change_metrics_and_failure_categories(eval_files):
    listings = common.read(eval_files["LISTINGS"])["listings"]
    spotcheck = eval_files["SPOTCHECK"].read_text()
    overrides, answered, total = report.spotcheck_overrides(listings, spotcheck)
    assert (overrides, answered, total) == ({"one": "3", "three": "4", "four": "9"}, 3, 3)
    scored = common.read(eval_files["SCORER_RESULTS"])["scored"]
    metric = report.scorer_metrics(scored, overrides, {"great": 8})["great"]
    assert (metric["tp"], metric["fp"], metric["fn"], metric["tn"]) == (1, 2, 1, 0)
    assert metric["precision"] == pytest.approx(1 / 3)
    assert metric["failures"]["false_positive", "wrong_model_or_spec"] == 1
    assert metric["failures"]["false_positive", "human_override"] == 1
    assert metric["failures"]["false_negative", "human_override"] == 1
    uncorrected = report.scorer_metrics(scored, {}, {"great": 8})["great"]
    assert uncorrected["failures"]["false_positive", "over_budget"] == 1
    assert (uncorrected["tp"], uncorrected["fp"], uncorrected["fn"], uncorrected["tn"]) == (1, 2, 0, 1)


def test_gate_thresholds_use_corrected_precision(eval_files, monkeypatch):
    monkeypatch.setattr(gate, "audit_misses_pass", lambda scorer: True)
    listings = [{"id": str(i), "url": f"https://example.test/{i}"} for i in range(10)]
    scored = [{"id": str(i), "score": 8, "judge": {"match": i != 0, "category": "over_budget"}} for i in range(10)]
    scorer = {"scored": scored, "metrics": {"great": {"threshold": 8}}}
    spotcheck = "| 1 | x | [One](https://example.test/0) | 1 | over_budget | x | no |\n"
    common.write(eval_files["LISTINGS"], {"listings": listings})
    common.write(eval_files["SCORER_RESULTS"], scorer)
    eval_files["SPOTCHECK"].write_text(spotcheck)
    chat = {"passed": 19, "total": 20}
    common.write(eval_files["CHAT_RESULTS"], chat)
    assert gate.check(common.read(eval_files["CHAT_RESULTS"]), common.read(eval_files["SCORER_RESULTS"]),
                      common.read(eval_files["LISTINGS"])["listings"], eval_files["SPOTCHECK"].read_text())
    gate.main()
    assert not gate.check({"passed": 18, "total": 20}, scorer, listings, spotcheck)
    assert not gate.check({"passed": 19, "total": 21}, scorer, listings, spotcheck)
    assert gate.check({"passed": 19, "total": 20}, scorer, listings, "")
    scored[1]["judge"]["match"] = False
    assert not gate.check({"passed": 19, "total": 20}, scorer, listings, "")


def test_median_run_uses_great_precision_then_recall():
    runs = [
        {"great": {"precision": 0.95, "recall": 0.5}},
        {"great": {"precision": 0.8, "recall": 0.9}},
        {"great": {"precision": 0.95, "recall": 0.8}},
    ]
    assert run_scorer.median_run(runs) is runs[2]
    assert run_scorer.median_run([runs[0]]) is runs[0]


def test_price_type_gate_requires_each_snapshot_on_every_run(monkeypatch):
    monkeypatch.setattr(gate, "PRICE_TYPE_CASES", common.PRICE_TYPE_CASES)
    cases = common.read(common.PRICE_TYPE_CASES)
    rows = [{"id": case["id"], "score": case.get("max_score", case.get("min_score")),
             "reason": "Bidding starts at the budget cap" if "max_score" in case else "Fixed price below budget"}
            for case in cases]
    scorer = {"runs": [{"price_type_cases": [dict(row) for row in rows]} for _ in range(3)]}
    assert gate.price_type_cases_pass(scorer)
    scorer["runs"][1]["price_type_cases"][0]["score"] = 8
    assert not gate.price_type_cases_pass(scorer)
    scorer["runs"][1]["price_type_cases"][0]["score"] = 7
    scorer["runs"][2]["price_type_cases"][0]["reason"] = "Looks affordable"
    assert not gate.price_type_cases_pass(scorer)
    scorer["runs"][2]["price_type_cases"] = []
    assert not gate.price_type_cases_pass(scorer)


def test_audit_miss_gate_requires_four_of_five_old_cases_and_new_bid_each_run(monkeypatch, tmp_path):
    path = tmp_path / "audit_misses.json"
    common.write(path, {"cases": [{"id": str(i), "notify_threshold": 8, "should_alert": True} for i in range(5)]
                        + [{"id": "m2451390076", "notify_threshold": 8, "should_alert": True}]})
    monkeypatch.setattr(gate, "AUDIT_MISSES", path)
    runs = [{"audit_misses": [{"id": str(i), "score": 8 if i < 4 else 7}
                             for i in range(5)] + [{"id": "m2451390076", "score": 8}]} for _ in range(3)]
    assert gate.audit_misses_pass({"runs": runs})
    runs[2]["audit_misses"][5]["score"] = 7
    assert not gate.audit_misses_pass({"runs": runs})
    runs[2]["audit_misses"][5]["score"] = 8
    runs[2]["audit_misses"][3]["score"] = 7
    assert not gate.audit_misses_pass({"runs": runs})


def test_october_bid_audit_fixture_has_room_below_cap():
    cases = {case["id"]: case for case in common.read(common.AUDIT_MISSES)["cases"]}
    bid = cases["m2451390076"]
    assert bid["watch_description"] == "Nintendo Switch OLED, under €200"
    assert bid["listing"]["price_eur"] == 130
    assert bid["listing"]["price_type"] == "bidding from"
    assert bid["notify_threshold"] == 8
    assert bid["should_alert"] is True


def test_gate_rejects_recall_below_previous_seventeen_of_twenty_three(monkeypatch):
    monkeypatch.setattr(gate, "price_type_cases_pass", lambda scorer: True)
    monkeypatch.setattr(gate, "audit_misses_pass", lambda scorer: True)
    listings = [{"id": str(i), "url": f"https://example.test/{i}"} for i in range(23)]
    scored = [{"id": str(i), "score": 8 if i < 16 else 7,
               "judge": {"match": True, "category": "match"}} for i in range(23)]
    scorer = {"scored": scored, "metrics": {"great": {"threshold": 8}}}
    assert not gate.check({"total": 20, "passed": 20}, scorer, listings, "")


def test_scorer_sends_known_audit_fields_without_inventing_missing_values(monkeypatch, tmp_path):
    path = tmp_path / "audit_misses.json"
    common.write(path, {"cases": [{"id": "free", "watch_description": "laminate",
                                    "listing": {"id": "free", "title": "Free laminate",
                                                "price_eur": 0, "price_type": "free", "distance_km": None}}]})
    monkeypatch.setattr(run_scorer, "AUDIT_MISSES", path)
    price_cases = tmp_path / "price_types.json"
    common.write(price_cases, [])
    monkeypatch.setattr(run_scorer, "PRICE_TYPE_CASES", price_cases)
    seen = []
    def rank(description, listings):
        seen.append((description, listings[0].copy()))
        return [listings[0] | {"score": 8, "reason": "Free match"}]
    monkeypatch.setattr(run_scorer.agent, "rank_listings", rank)
    result = run_scorer.score_once({"watches": [], "listings": []}, {}, "gpt-5.4-mini")
    assert seen == [("laminate", {"id": "free", "title": "Free laminate",
                                   "price_eur": 0, "price_type": "free"})]
    assert result["audit_misses"] == [{"id": "free", "score": 8, "reason": "Free match"}]


def test_audit_scorer_caps_near_limit_bid_but_keeps_roomy_bid(monkeypatch, tmp_path):
    path = tmp_path / "audit_misses.json"
    common.write(path, {"cases": [
        {"id": "near", "watch_description": "Nintendo Switch OLED, under €200",
         "listing": {"id": "near", "price_eur": 175, "price_type": "bidding from"}},
        {"id": "m2451390076", "watch_description": "Nintendo Switch OLED, under €200",
         "listing": {"id": "m2451390076", "price_eur": 130, "price_type": "bidding from"}},
    ]})
    monkeypatch.setattr(run_scorer, "AUDIT_MISSES", path)
    price_cases = tmp_path / "price_types.json"
    common.write(price_cases, [])
    monkeypatch.setattr(run_scorer, "PRICE_TYPE_CASES", price_cases)
    monkeypatch.setattr(run_scorer.agent, "rank_listings", lambda description, listings:
                        [listings[0] | {"score": 9, "reason": "Exact model match"}])
    result = run_scorer.score_once({"watches": [], "listings": []}, {}, "gpt-5.4-mini")
    assert {row["id"]: row["score"] for row in result["audit_misses"]} == {"near": 7, "m2451390076": 9}


def test_scorer_rescores_all_price_type_cases_three_times(monkeypatch, tmp_path):
    audit_cases = tmp_path / "audit_misses.json"
    common.write(audit_cases, {"cases": []})
    monkeypatch.setattr(run_scorer, "AUDIT_MISSES", audit_cases)
    calls = []

    def fake_rank(description, listings, raise_on_failure=False):
        assert raise_on_failure
        assert description == "Nintendo Switch OLED, under €200"
        item = listings[0]
        calls.append(item["id"])
        bid = item["price_type"] == "bidding from"
        return [item | {"score": 7 if bid else 9,
                        "reason": "Bidding starts at the cap" if bid else "Fixed price below the cap"}]

    monkeypatch.setattr(run_scorer.agent, "rank_listings", fake_rank)
    runs = [run_scorer.score_once({"watches": [], "listings": []}, {}, "gpt-5.4-mini") for _ in range(3)]
    cases = common.read(common.PRICE_TYPE_CASES)
    assert calls == [case["id"] for _ in range(3) for case in cases]
    assert gate.price_type_cases_pass({"runs": runs})


def test_confirmed_user_case_uses_saved_scorer_inputs(monkeypatch):
    calls = []

    def fake_rank(description, listings, raise_on_failure=False):
        calls.append((description, listings[0].copy(), raise_on_failure))
        return [listings[0] | {"score": 8}]

    monkeypatch.setattr(run_scorer.agent, "rank_listings", fake_rank)
    cases = [{"id": "rating-1", "watch_description": "Gazelle bike, under €400",
              "listing": {"id": "listing-1", "title": "Gazelle", "price_eur": 350}, "label": False}]
    assert run_scorer.score_user_cases(cases) == [{"id": "rating-1", "score": 8, "label": False}]
    assert calls == [("Gazelle bike, under €400", cases[0]["listing"], True)]


def test_scorer_three_runs_keep_each_result_and_select_median(monkeypatch, tmp_path):
    audit_cases = tmp_path / "audit_misses.json"
    common.write(audit_cases, {"cases": []})
    monkeypatch.setattr(run_scorer, "AUDIT_MISSES", audit_cases)
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")
    listings = tmp_path / "listings.json"
    labels = tmp_path / "labels.json"
    result = tmp_path / "scorer_results.json"
    common.write(listings, {"watches": [{"id": "watch", "description": "chair"}],
                            "listings": [{"watch": "watch", "id": str(i), "title": str(i), "price_eur": 10}
                                         for i in range(4)]})
    common.write(labels, {"labels": {str(i): {"match": i < 2, "category": "match", "reason": "Chair"}
                                     for i in range(4)}})
    monkeypatch.setattr(run_scorer, "LISTINGS", listings)
    monkeypatch.setattr(run_scorer, "LABELS", labels)
    monkeypatch.setattr(run_scorer, "SCORER_RESULTS", result)
    cases = tmp_path / "price_type_cases.json"
    common.write(cases, [])
    monkeypatch.setattr(run_scorer, "PRICE_TYPE_CASES", cases)
    scores = [(8, 0, 8, 0), (8, 0, 8, 8), (8, 8, 8, 8)]

    def fake_rank(description, items):
        values = scores.pop(0)
        return [item | {"score": values[i], "reason": "Chair"} for i, item in enumerate(items)]

    monkeypatch.setattr(run_scorer.agent, "rank_listings", fake_rank)
    run_scorer.main(["--runs", "3"])
    saved = common.read(result)
    assert len(saved["runs"]) == 3
    assert [run["great"]["precision"] for run in saved["runs"]] == [0.5,
                                                                      round(1 / 3, 3),
                                                                      0.5]
    assert all({"precision", "recall", "tp", "fp", "fn"} <= run["good"].keys() for run in saved["runs"])
    assert saved["scored"] == saved["runs"][2]["scored"]
    assert saved["metrics"]["great"]["recall"] == 1


def test_gate_uses_median_corrected_precision_and_prints_runs(eval_files, capsys, monkeypatch):
    monkeypatch.setattr(gate, "audit_misses_pass", lambda scorer: True)
    scorer = common.read(eval_files["SCORER_RESULTS"])
    listings = [{"id": str(i), "url": f"https://example.test/{i}"} for i in range(10)]
    base = [{"id": str(i), "score": 8, "judge": {"match": i != 0, "category": "match"}} for i in range(10)]
    scorer["runs"] = [
        {"great": {"threshold": 8}, "scored": [row | {"judge": row["judge"] | {"match": False}} if row["id"] in ("1", "2") else row for row in base]},
        {"great": {"threshold": 8}, "scored": base},
        {"great": {"threshold": 8}, "scored": [row | {"judge": row["judge"] | {"match": False}} if row["id"] == "1" else row for row in base]},
    ]
    spotcheck = "| 1 | x | [One](https://example.test/0) | 1 | over_budget | x | no |\n"
    chat = {"passed": 19, "total": 20}
    assert gate.check(chat, scorer, listings, spotcheck)
    common.write(eval_files["LISTINGS"], {"listings": listings})
    eval_files["SPOTCHECK"].write_text(spotcheck)
    common.write(eval_files["SCORER_RESULTS"], scorer)
    gate.main()
    assert "great precision runs 0.8, 1, 0.9 → median 0.9" in capsys.readouterr().out
    scorer["runs"][2]["scored"][2]["judge"]["match"] = False
    assert not gate.check(chat, scorer, listings, spotcheck)


def test_report_shows_run_count_range_and_three_run_cost(monkeypatch, eval_files):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")
    scorer = common.read(eval_files["SCORER_RESULTS"])
    scored = scorer["scored"]
    scorer["runs"] = [
        {"great": {"threshold": 8}, "scored": scored, "tokens": scorer["tokens"]},
        {"great": {"threshold": 8}, "scored": [row | {"score": 4} if row["id"] == "one" else row for row in scored],
         "tokens": scorer["tokens"]},
        {"great": {"threshold": 8}, "scored": [row | {"score": 4} if row["id"] == "two" else row for row in scored],
         "tokens": scorer["tokens"]},
    ]
    common.write(eval_files["SCORER_RESULTS"], scorer)
    report.main()
    text = eval_files["REPORT"].read_text()
    assert "median of 3 runs; range 0.0–50.0%" in text
    assert "3 scorer runs" in text


def test_report_shows_price_type_cases_and_new_rank_version(monkeypatch, eval_files):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")
    scorer = common.read(eval_files["SCORER_RESULTS"])
    scorer["prompt_version"] = "rank-2026-10-03.1"
    scorer["price_type_cases"] = [{"id": "m2448861737", "label": "not great: bidding from the cap",
                                   "score": 7, "reason": "Starting bid at the cap likely exceeds budget"}]
    common.write(eval_files["SCORER_RESULTS"], scorer)
    report.main()
    text = eval_files["REPORT"].read_text()
    assert "rank **rank-2026-10-03.1**" in text
    assert "m2448861737 | not great: bidding from the cap | 7" in text


def test_report_preserves_filled_signoff(monkeypatch, eval_files):
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")
    signoff = "UAT sign-off: Daryl (name), 2026-10-01 (date), prompt versions chat-1/rank-1"
    report.REPORT.write_text(signoff + "\n")
    report.main()
    text = report.REPORT.read_text()
    assert signoff in text
    assert "overridden rows 3, 4, 9" in text
    assert "chat **not recorded**, rank **not recorded**" in text
    assert "| human_override |" in text
    assert "Fix tracked as MW-16" not in text
    report.main()
    assert report.REPORT.read_text().count(signoff) == 1


def test_scorer_results_record_prompt_version(monkeypatch, tmp_path):
    from evals import run_scorer

    audit_cases = tmp_path / "audit_misses.json"
    common.write(audit_cases, {"cases": []})
    monkeypatch.setattr(run_scorer, "AUDIT_MISSES", audit_cases)

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
    cases = tmp_path / "price_type_cases.json"
    common.write(cases, [])
    monkeypatch.setattr(run_scorer, "PRICE_TYPE_CASES", cases)
    monkeypatch.setattr(run_scorer.agent, "rank_listings", lambda description, items: [items[0] | {"score": 8, "reason": "Chair"}])
    run_scorer.main()
    saved = common.read(result)
    assert saved["prompt_version"] == run_scorer.agent.PROMPT_VERSION["rank"]
    assert "runs" not in saved


def test_audit_miss_gate_counts_expected_non_alerts_as_correct(monkeypatch, tmp_path):
    path = tmp_path / "audit_misses.json"
    cases = [{"id": "a", "notify_threshold": 8, "should_alert": True}, {"id": "b", "notify_threshold": 6, "should_alert": True},
             {"id": "c", "notify_threshold": 8, "should_alert": False}, {"id": "d", "notify_threshold": 8, "should_alert": False},
             {"id": "e", "notify_threshold": 6, "should_alert": False},
             {"id": "m2451390076", "notify_threshold": 8, "should_alert": True}]
    common.write(path, {"cases": cases})
    monkeypatch.setattr(gate, "AUDIT_MISSES", path)
    good = {"a": 9, "b": 10, "c": 6, "d": 2, "e": 3, "m2451390076": 9}
    runs = [{"audit_misses": [{"id": k, "score": v} for k, v in good.items()]} for _ in range(3)]
    assert gate.audit_misses_pass({"runs": runs})
    runs[1]["audit_misses"] = [{"id": k, "score": {"a": 5, "c": 9}.get(k, v)} for k, v in good.items()]
    assert not gate.audit_misses_pass({"runs": runs})   # two wrong outcomes in one run
