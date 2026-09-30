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
