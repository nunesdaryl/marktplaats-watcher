"""Pull rating candidates into a review queue; only explicit confirmation adds scorer cases."""
import argparse
import hashlib

from evals.common import USER_CASES_GOLDEN, USER_CASES_PENDING, read, write
from evals.pull_ratings import fetch_ratings


def candidates(ratings):
    cases = []
    for rating in ratings:
        if rating["verdict"] == "good" and int(hashlib.sha256(rating["id"].encode()).hexdigest(), 16) % 4:
            continue
        listing, description = rating.get("listing"), rating.get("watchDescription")
        if not listing or not description or not listing.get("id"):
            continue
        cases.append({"id": rating["id"], "watch_description": description, "listing": listing,
                      "label": rating["verdict"] == "good", "verdict": rating["verdict"],
                      "reasons": rating.get("reasons", []), "rated_at": rating["at"]})
    return cases


def confirm(ids, pending_path=None, golden_path=None):
    pending_path = pending_path or USER_CASES_PENDING
    golden_path = golden_path or USER_CASES_GOLDEN
    pending = read(pending_path) if pending_path.exists() else []
    golden = read(golden_path) if golden_path.exists() else []
    by_id = {case["id"]: case for case in pending}
    existing = {case["id"] for case in golden}
    missing = set(ids) - by_id.keys() - existing
    if missing:
        raise ValueError(f"not pending: {', '.join(sorted(missing))}")
    write(golden_path, golden + [by_id[id] for id in ids if id not in existing])
    write(pending_path, [case for case in pending if case["id"] not in ids])


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--confirm", nargs="+", metavar="ID")
    args = parser.parse_args(argv)
    if args.confirm:
        confirm(args.confirm)
        print(f"confirmed {len(args.confirm)} case(s)")
        return
    ratings = fetch_ratings()
    golden = read(USER_CASES_GOLDEN) if USER_CASES_GOLDEN.exists() else []
    confirmed = {case["id"] for case in golden}
    pending = [case for case in candidates(ratings) if case["id"] not in confirmed]
    write(USER_CASES_PENDING, pending)
    print(f"wrote {len(pending)} pending cases to {USER_CASES_PENDING}")


if __name__ == "__main__":
    main()
