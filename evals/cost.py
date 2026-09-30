"""Measure the ranking cost of a scheduled check at the 20-listing scoring cap."""
import agent
from evals.common import CHAT_RESULTS, LISTINGS, REPORT, USD_TO_EUR, cost_usd, model_under_test, read

CHECKS_PER_MONTH = {"every hour": 720, "every 15 minutes": 2880}


def main():
    model = model_under_test()
    listings = read(LISTINGS)["listings"]
    per_check = {0: 0.0}
    tokens = {}
    for count in (1, 10, 20):
        batch = [{k: v for k, v in item.items() if k != "watch"} for item in listings[:count]]
        agent.RANK_USAGE.clear()
        agent.rank_listings("New Marktplaats listings", batch)
        if not agent.RANK_USAGE:
            raise RuntimeError(f"ranking {count} listings recorded no token usage")
        tokens[count] = (sum(u[0] for u in agent.RANK_USAGE), sum(u[1] for u in agent.RANK_USAGE))
        per_check[count] = cost_usd(model, *tokens[count]) * USD_TO_EUR

    chat_results = read(CHAT_RESULTS)
    chat = cost_usd(model, chat_results["tokens"]["input"], chat_results["tokens"]["output"]) / chat_results["total"] * USD_TO_EUR
    retry = 2 * per_check[20]
    budget_eur = 10 * USD_TO_EUR
    rows = ["## 4. Running cost per watch (measured)", "",
            "Each check reads every listing placed since the last check and scores at most 20 new listings per watch. "
            "A check with no new listings makes no model call.", "",
            "| New listings | € per check | Input tokens | Output tokens |", "|---|---|---|---|",
            "| 0 | €0.00000 | 0 | 0 |"]
    for count in (1, 10, 20):
        input_tokens, output_tokens = tokens[count]
        rows.append(f"| {count} | €{per_check[count]:.5f} | {input_tokens} | {output_tokens} |")
    rows += ["", f"If the ranker omits all 20 ids, one retry of those ids costs up to 2× the measured "
             f"20-listing call: €{retry:.5f} per check.", "",
             "| Schedule | Checks / month | 1 new listing / check | 10 new listings / check | 20 new listings / check | 20 plus retry / check |",
             "|---|---|---|---|---|---|"]
    for name, checks in CHECKS_PER_MONTH.items():
        rows.append(f"| {name} | {checks} | €{checks * per_check[1]:.2f} | €{checks * per_check[10]:.2f} | "
                    f"€{checks * per_check[20]:.2f} | €{checks * retry:.2f} |")
    rows += ["", f"If a 20-listing check sends one alert, ranking costs €{per_check[20]:.5f} per alert; "
             "if it sends several alerts, divide that check's cost by the number sent. "
             f"A chat question costs about €{chat:.4f}.", "",
             f"The busiest case, a 15-minute watch with 20 new listings every check, costs "
             f"€{CHECKS_PER_MONTH['every 15 minutes'] * per_check[20]:.2f} per month, "
             f"above the OpenAI project's $10/month hard cap (about €{budget_eur:.2f}).", "",
             "Hosting (Vercel, Convex, Clerk, AgentMail) runs on free tiers today: €0 fixed. "
             "When the OpenAI cap is reached, the AI stops and nothing unscored is e-mailed.", ""]
    text = REPORT.read_text()
    marker = "## 4. Running cost per watch (measured)"
    text = text.split(marker)[0].rstrip() + "\n\n" + "\n".join(rows) if marker in text else text.rstrip() + "\n\n" + "\n".join(rows)
    REPORT.write_text(text + "\n")
    print("\n".join(rows))


if __name__ == "__main__":
    main()
