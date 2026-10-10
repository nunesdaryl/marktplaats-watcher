"""Turn production feedback signals into evidence-cited factory draft specs."""
import argparse
import datetime
import difflib
import json
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

import lin

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"
ENGINE = "engine:gpt-6-sol"
RECENT_DAYS = 30


def convex(function, args=None):
    command = ["npx", "convex", "run", "--prod", function]
    if args is not None:
        command.append(json.dumps(args))
    output = subprocess.run(command, cwd=FRONTEND, capture_output=True, text=True, check=True).stdout.strip()
    start = min((i for i in (output.find("["), output.find("{")) if i >= 0), default=-1)
    if start < 0:
        raise RuntimeError(f"Convex returned no JSON for {function}")
    return json.loads(output[start:])


def date(milliseconds):
    return datetime.datetime.fromtimestamp(milliseconds / 1000, datetime.timezone.utc).date().isoformat()


def key_text(value):
    return " ".join(re.findall(r"[a-z0-9]+", value.lower()))


def candidate(kind, key, title, problem, evidence, feedback_ids=()):
    return {"key": f"{kind}-{key}", "title": title, "problem": problem,
            "evidence": sorted(set(evidence)), "feedback_ids": list(feedback_ids)}


def drafts(feedback, ratings, audits, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    grouped = defaultdict(list)
    for row in feedback:
        if row.get("status", "new") != "new" or row.get("issues") or not row.get("message", "").strip():
            continue
        grouped[key_text(row["message"])].append(row)
    result = []
    for message, rows in grouped.items():
        first = sorted(rows, key=lambda row: row["id"])[0]
        ids = [row["id"] for row in rows]
        evidence = [f"feedback:{row['id']} ({date(row['createdAt'])}; source {row.get('source') or 'app'}"
                    + (f"; person {row['personName']}" if row.get("personName") else "") + ")" for row in rows]
        title = "[factory] Feedback: " + first["message"].strip().replace("\n", " ")[:70]
        result.append(candidate("feedback", first["id"], title,
            f"{len(rows)} new tracker item(s) report: {first['message'].strip()} Evidence: {', '.join(evidence)}.",
            evidence, ids))
    cutoff = now - datetime.timedelta(days=RECENT_DAYS)
    grouped.clear()
    for row in ratings:
        if row.get("verdict") != "not_right" or datetime.datetime.fromisoformat(row["at"].replace("Z", "+00:00")) < cutoff:
            continue
        for reason in row.get("reasons") or ["unspecified"]:
            grouped[(row.get("watchId") or row.get("watchDescription") or "unknown watch", reason)].append(row)
    for (watch, reason), rows in grouped.items():
        evidence = [f"rating:{row['id']} ({row['at'][:10]})" for row in rows]
        result.append(candidate("rating", f"{reason}-{rows[0]['id']}",
            f"[factory] Not right: {reason.replace('_', ' ')} for {rows[0].get('watchDescription') or watch}"[:120],
            f"{len(rows)} recent Not right rating(s) cite reason {reason} for watch {watch} ({rows[0].get('watchDescription') or 'unnamed'}). Evidence: {', '.join(evidence)}.", evidence))
    grouped.clear()
    for row in audits:
        for miss in row.get("misses", []):
            grouped[(row["watchId"], miss["kind"])].append((row, miss))
    for (watch, kind), pairs in grouped.items():
        evidence = [f"audit:{row['id']} listing:{miss['listingId']} ({date(row['at'])})" for row, miss in pairs]
        result.append(candidate("audit", f"{watch}-{kind}",
            f"[factory] Delivery audit: {kind.replace('_', ' ')} on watch {watch}"[:120],
            f"The latest delivery audit recorded {len(pairs)} {kind} miss(es) on watch {watch}. Evidence: {', '.join(evidence)}.", evidence))
    return sorted(result, key=lambda draft: draft["key"])


def spec(draft):
    return (f"## Problem\n{draft['problem']}\n\n"
            + ("## Feedback\n" + "\n".join(f"Feedback: {id}" for id in draft["feedback_ids"]) + "\n\n" if draft["feedback_ids"] else "")
            + "## Acceptance Criteria\n- [ ] Investigate the cited evidence and reproduce the problem.\n"
            "- [ ] Fix the confirmed problem and verify the affected path.\n\n"
            f"## Relevant files\n- Evidence: {', '.join(draft['evidence'])}\n\n"
            "## Non-goals\n- Unrelated product changes.\n\n"
            "## Test expectations\n- Add focused regression coverage for the confirmed cause.\n\n"
            "## Docs to update\n- Update affected operating docs if behavior changes.\n\n"
            "## Verify steps\n- Recheck the cited tracker items, ratings or audit misses after the fix.\n\n"
            f"## Engine hint\n{ENGINE}: standing routing.")


def linear_context():
    teams = lin.gql('query{ teams(filter:{key:{eq:"MW"}}) { nodes { id key } } }')["teams"]["nodes"]
    team = next((row for row in teams if row["key"] == "MW"), None)
    if not team:
        raise RuntimeError("Linear team MW was not found")
    labels, cursor = [], None
    while True:
        page = lin.gql('query($id:ID!,$after:String){ issueLabels(filter:{team:{id:{eq:$id}}},first:100,after:$after){ nodes { id name } pageInfo { hasNextPage endCursor } } }',
                       {"id": team["id"], "after": cursor})["issueLabels"]
        labels.extend(page["nodes"])
        if not page["pageInfo"]["hasNextPage"]:
            break
        cursor = page["pageInfo"]["endCursor"]
        if not cursor:
            raise RuntimeError("Linear labels page has no cursor")
    by_name = {row["name"]: row["id"] for row in labels}
    if "draft" not in by_name or ENGINE not in by_name:
        raise RuntimeError("Linear team MW needs draft and engine:gpt-6-sol labels")
    issues, cursor = [], None
    while True:
        page = lin.gql('query($id:ID!,$after:String){ issues(filter:{team:{id:{eq:$id}}},first:100,after:$after){ nodes { id identifier title description state { type } } pageInfo { hasNextPage endCursor } } }',
                       {"id": team["id"], "after": cursor})["issues"]
        issues.extend(row for row in page["nodes"] if row["state"]["type"] not in {"completed", "canceled"})
        if not page["pageInfo"]["hasNextPage"]:
            break
        cursor = page["pageInfo"]["endCursor"]
        if not cursor:
            raise RuntimeError("Linear issues page has no cursor")
    return team["id"], by_name, issues


def duplicate(draft, issues):
    title = key_text(draft["title"])
    ids = [match for evidence in draft["evidence"] for match in
           re.findall(r"(?:feedback|rating|audit|listing):([^\s,)]+)", evidence)]
    for issue in issues:
        other = key_text(issue["title"])
        if difflib.SequenceMatcher(None, title, other).ratio() >= 0.8:
            return issue["identifier"]
        if any(re.search(r"(?<![A-Za-z0-9])" + re.escape(identifier) + r"(?![A-Za-z0-9])",
                         issue.get("description") or "") for identifier in ids):
            return issue["identifier"]
    return None


def file_draft(draft, team_id, labels):
    result = lin.gql('mutation($input:IssueCreateInput!){ issueCreate(input:$input){ success issue { id identifier } } }',
        {"input": {"teamId": team_id, "title": draft["title"], "description": spec(draft),
                   "labelIds": [labels["draft"], labels[ENGINE]]}})["issueCreate"]
    if not result["success"] or not result["issue"]:
        raise RuntimeError("Linear draft creation failed")
    issue = result["issue"]
    lin.comment(issue["id"], f"Factory feedback intake {lin.now()}. Evidence: {', '.join(draft['evidence'])}. Status: draft; operator review required before agent-ready.")
    for feedback_id in draft["feedback_ids"]:
        convex("feedback:planDraft", {"id": feedback_id, "issue": issue["identifier"]})
    return issue["identifier"]


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", nargs="+", metavar="DRAFT_ID", help="file only these printed draft IDs")
    args = parser.parse_args(argv)
    feedback = convex("feedback:draftItems")
    ratings = convex("ratings:exportAll")
    audits = convex("audit:latestMissesForDrafts")
    team_id, labels, issues = linear_context()
    available = []
    for draft in drafts(feedback, ratings, audits):
        match = duplicate(draft, issues)
        if match:
            print(f"Skip {draft['key']}: open issue {match}")
            continue
        available.append(draft)
        print(f"\n### {draft['key']} — {draft['title']}\n{spec(draft)}")
    if args.file:
        selected = set(args.file)
        unknown = selected - {draft["key"] for draft in available}
        if unknown:
            raise RuntimeError(f"draft ID unavailable: {', '.join(sorted(unknown))}")
        for draft in available:
            if draft["key"] in selected:
                # Recheck open issues immediately before each creation.
                team_id, labels, issues = linear_context()
                match = duplicate(draft, issues)
                if match:
                    raise RuntimeError(f"{draft['key']} now matches open issue {match}")
                print(f"Filed {draft['key']} as {file_draft(draft, team_id, labels)}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, ValueError, KeyError) as error:
        print(f"factory feedback drafts: {error}", file=sys.stderr)
        sys.exit(1)
