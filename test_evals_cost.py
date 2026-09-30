import pytest

import agent
from evals import cost


def test_running_cost_uses_measured_batches_and_prices(monkeypatch, tmp_path):
    report = tmp_path / "report.md"
    report.write_text("## 2. Chat\n\nC3 flakiness note.\n\n## 4. Running cost per watch (measured)\n\nOld numbers.\n")
    monkeypatch.setattr(cost, "REPORT", report)
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")
    batches = []

    def fake_rank(description, listings):
        batches.append(len(listings))
        agent.RANK_USAGE.append((1000 * len(listings), 100 * len(listings)))
        return listings

    monkeypatch.setattr(agent, "rank_listings", fake_rank)
    cost.main()

    section = report.read_text()
    assert section.startswith("## 2. Chat\n\nC3 flakiness note.")
    assert batches == [1, 10, 20]
    assert "| 0 | €0.00000 |" in section
    assert "| 1 | €0.00110 |" in section
    assert "| 10 | €0.01104 |" in section
    assert "| 20 | €0.02208 |" in section
    assert "€0.04416" in section  # one retry of all 20 listings
    assert "| every hour | 720 | €0.79 | €7.95 | €15.90 |" in section
    assert "| every 15 minutes | 2880 | €3.18 | €31.80 | €63.59 |" in section
    assert "€31.80 |" in section  # hourly, 20 listings plus one retry
    assert "€127.18 |" in section  # every 15 minutes, 20 listings plus one retry
    assert "€0.02208 per alert" in section
    assert "$10/month hard cap" in section


def test_running_cost_rejects_unknown_model_before_calling_ranker(monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "unknown-model")
    monkeypatch.setattr(agent, "rank_listings", lambda *_: pytest.fail("ranker was called"))
    with pytest.raises(ValueError, match="add prices for unknown-model to evals/common.py"):
        cost.main()


@pytest.mark.parametrize(
    ("per_check_cost", "comparison", "monthly_cost"),
    [(0.002, "within", "€5.76"), (0.004, "above", "€11.52")],
)
def test_running_cost_compares_busiest_watch_with_cap(
    monkeypatch, tmp_path, per_check_cost, comparison, monthly_cost
):
    report = tmp_path / "report.md"
    report.write_text("")
    monkeypatch.setattr(cost, "REPORT", report)
    monkeypatch.setattr(cost, "USD_TO_EUR", 1)
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4-mini")

    def fake_rank(description, listings):
        agent.RANK_USAGE.append((len(listings), 0))
        return listings

    monkeypatch.setattr(agent, "rank_listings", fake_rank)
    monkeypatch.setattr(cost, "cost_usd", lambda model, input_tokens, output_tokens: per_check_cost)

    cost.main()

    assert (f"costs {monthly_cost} per month, {comparison} the OpenAI project's "
            "$10/month hard cap (about €10.00).") in report.read_text()
