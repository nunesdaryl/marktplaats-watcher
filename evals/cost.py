"""Running cost per watch, from measured tokens (not guesses). A scheduled check only calls the model when a watch
has NEW listings; most checks find none. So the cost depends on how many new listings a check finds:
we report a typical case (1 new listing per check) and a busy worst case (10 new listings every single check)."""
import agent
from evals.common import CHAT_RESULTS, LISTINGS, REPORT, SCORER_RESULTS, USD_TO_EUR, cost_usd, read

CHECKS_PER_MONTH = {"every 15 minutes": 2880, "every hour": 720, "every 3 hours": 240, "every 6 hours": 120,
                    "every 12 hours": 60, "every day at one time": 30, "once a week": 4.3}


def main():
    listings = read(LISTINGS)["listings"]
    agent.RANK_USAGE.clear()
    for item in listings[:3]:                        # three real 1-listing calls: the fixed cost of one check
        one = {k: v for k, v in item.items() if k != "watch"}
        agent.rank_listings("Mac mini, under €500", [one])
    one_in = sum(u[0] for u in agent.RANK_USAGE) / len(agent.RANK_USAGE)
    one_out = sum(u[1] for u in agent.RANK_USAGE) / len(agent.RANK_USAGE)
    s = read(SCORER_RESULTS)
    ten_in, ten_out = s["tokens"]["input"] / s["tokens"]["calls"], s["tokens"]["output"] / s["tokens"]["calls"]
    per_check_1 = cost_usd("gpt-5.4-mini", one_in, one_out) * USD_TO_EUR
    per_check_10 = cost_usd("gpt-5.4-mini", ten_in, ten_out) * USD_TO_EUR
    chat = read(CHAT_RESULTS)["cost_usd_per_question"] * USD_TO_EUR
    rows = ["## 4. Running cost per watch (measured)", "",
            f"One check with 1 new listing costs €{per_check_1:.5f} ({one_in:.0f} input + {one_out:.0f} output tokens); "
            f"with 10 new listings €{per_check_10:.5f}. A check with no new listings makes no AI call and costs nothing. "
            f"A chat question costs about €{chat:.4f}.", "",
            "| Schedule | Checks / month | Typical (1 new listing per check) | Busy worst case (10 new every check) |",
            "|---|---|---|---|"]
    for name, n in CHECKS_PER_MONTH.items():
        rows.append(f"| {name} | {n:g} | €{n * per_check_1:.2f} / month | €{n * per_check_10:.2f} / month |")
    budget_eur = 10 * USD_TO_EUR
    rows += ["", f"Hosting (Vercel, Convex, Clerk, AgentMail) runs on free tiers today: €0 fixed. The OpenAI project has a "
             f"hard $10/month cap (≈ €{budget_eur:.2f}); that covers about {budget_eur / chat:,.0f} chat questions, or "
             f"{budget_eur / (720 * per_check_1):,.0f} hourly watches finding one new listing every hour, all month. "
             "When the cap is reached, the AI stops and nothing unscored is e-mailed. "
             "The scorer now takes up to 20 new listings per check (the rest wait for the next check); a 20-listing check has not been measured yet.", ""]
    text = REPORT.read_text()
    marker = "## 4. Running cost per watch (measured)"
    text = text.split(marker)[0].rstrip() + "\n\n" + "\n".join(rows) if marker in text else text.rstrip() + "\n\n" + "\n".join(rows)
    REPORT.write_text(text + "\n")
    print("\n".join(rows))


if __name__ == "__main__":
    main()
