"""Step 1: freeze real listings. Fetches each watch's public search page once (the production fetch_page and
parse_listings, with the watch's own filters) and saves the listings, so later runs are reproducible."""
import time

import agent
from evals.common import LISTINGS, WATCHES, write


def main():
    rows = []
    for w in WATCHES:
        html = agent.fetch_page(agent.search_url(w["query"]), capped=False)
        listings, stats = agent.parse_listings(html, w["max_price_eur"])
        for item in listings:
            rows.append({"watch": w["id"], **item})
        print(f"{w['id']:7} {len(listings):2} listings (of {stats['on_page']} on the page)")
        time.sleep(2)   # be gentle with Marktplaats
    write(LISTINGS, {"collected_at": time.strftime("%Y-%m-%d %H:%M"), "watches": WATCHES, "listings": rows})
    print(f"saved {len(rows)} listings to {LISTINGS}")


if __name__ == "__main__":
    main()
