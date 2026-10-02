"""Linear operations for the repo factory; credentials stay in macOS Keychain."""
import datetime
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

URL = "https://api.linear.app/graphql"


def key():
    result = subprocess.run(
        ["security", "find-generic-password", "-s", "linear-api-factory", "-w"],
        capture_output=True, text=True, check=True,
    )
    return result.stdout.strip()


def gql(query, variables=None):
    payload = json.dumps({"query": query, "variables": variables or {}}).encode()
    for attempt in range(5):
        request = urllib.request.Request(
            URL, data=payload,
            headers={"Authorization": key(), "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                result = json.load(response)
            if result.get("errors"):
                raise RuntimeError("Linear GraphQL error: " + json.dumps(result["errors"])[:500])
            return result["data"]
        except urllib.error.HTTPError as error:
            if error.code < 500 or attempt == 4:
                raise RuntimeError(f"Linear HTTP {error.code}") from None
        except (urllib.error.URLError, TimeoutError):
            if attempt == 4:
                raise RuntimeError("Linear request timed out after retries") from None
        time.sleep(min(2 ** attempt, 8))
    raise RuntimeError("Linear request failed")


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def issue(identifier):
    data = gql('query($id:String!){ issue(id:$id){ id identifier title description state { name type } team { id states { nodes { id name } } } } }', {"id": identifier})["issue"]
    if not data:
        raise RuntimeError(f"Linear issue {identifier} not found")
    if data["identifier"] != identifier:
        raise RuntimeError(f"Linear returned {data['identifier']} for {identifier}")
    data["labels"] = pages('query($id:String!,$after:String){ issue(id:$id){ labels(first:50,after:$after){ nodes { id name } pageInfo { hasNextPage endCursor } } } }', data["id"], "labels")
    data["comments"] = pages('query($id:String!,$after:String){ issue(id:$id){ comments(first:50,after:$after){ nodes { id body createdAt } pageInfo { hasNextPage endCursor } } } }', data["id"], "comments")
    return data


def pages(query, issue_id, field):
    nodes, cursor = [], None
    while True:
        connection = gql(query, {"id": issue_id, "after": cursor})["issue"][field]
        nodes.extend(connection["nodes"])
        if not connection["pageInfo"]["hasNextPage"]:
            return nodes
        cursor = connection["pageInfo"]["endCursor"]
        if not cursor:
            raise RuntimeError(f"Linear {field} page has no cursor")


def comment(issue_id, body):
    result = gql('mutation($input:CommentCreateInput!){ commentCreate(input:$input){ success comment { id } } }', {"input": {"issueId": issue_id, "body": body}})["commentCreate"]
    if not result["success"]:
        raise RuntimeError("Linear comment creation failed")
    return result["comment"]["id"]


def update(issue_id, fields):
    result = gql('mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }', {"id": issue_id, "input": fields})["issueUpdate"]
    if not result["success"]:
        raise RuntimeError("Linear issue update failed")


def ready(identifier, reviewed_sha=None):
    item = issue(identifier)
    labels = [label["name"] for label in item["labels"]]
    if labels.count("ready-to-merge") != 1 or sum(label in {"agent-ready", "needs-fix", "built", "ready-to-merge", "blocked"} for label in labels) != 1:
        raise RuntimeError(f"factory: {identifier} requires exactly one ready-to-merge conveyor label")
    if item["state"]["type"] in {"completed", "canceled"}:
        raise RuntimeError(f"factory: {identifier} is terminal")
    if reviewed_sha:
        if not any(state["name"] == "Done" for state in item["team"]["states"]["nodes"]):
            raise RuntimeError("factory: Done state not found")
        verdict_pattern = re.compile(r"^factory-review verdict \S+ station=(\S+)(?: claim=(\S+))? result=PASS sha=" + re.escape(reviewed_sha) + r"$")
        verdicts = [(c, verdict_pattern.fullmatch(c["body"].splitlines()[0])) for c in item["comments"]]
        verdicts = [(c, match) for c, match in verdicts if match]
        if not verdicts:
            raise RuntimeError(f"factory: {identifier} has no PASS verdict for {reviewed_sha}")
        verdict, match = max(verdicts, key=lambda pair: (pair[0]["createdAt"], pair[0]["id"]))
        claims = [c for c in item["comments"] if c["createdAt"] < verdict["createdAt"] and c["body"].splitlines()[0].startswith("factory-review claim ")]
        if match.group(2):
            claims = [c for c in claims if c["id"] == match.group(2)]
        claims = [c for c in claims if re.search(r"\bstation=" + re.escape(match.group(1)) + r"(?:\s|$)", c["body"].splitlines()[0])]
        if not claims:
            raise RuntimeError(f"factory: {identifier} PASS verdict has no valid review claim")
        claim = max(claims, key=lambda c: (c["createdAt"], c["id"]))
        approvals = [c for c in item["comments"] if c["createdAt"] > verdict["createdAt"] and c["body"].startswith("Operator merge approval:")]
        if not approvals:
            raise RuntimeError(f"factory: {identifier} needs Operator merge approval after the PASS verdict")
        approval = max(approvals, key=lambda c: (c["createdAt"], c["id"]))["body"].splitlines()[0].partition(":")[2].strip()
        if not approval:
            raise RuntimeError(f"factory: {identifier} has an empty Operator merge approval")
        item["merge"] = {"claim": claim["id"], "station": match.group(1), "approver": approval}
    return item


def finish(identifier, reviewed_sha, merge_sha, approver, checks):
    item = ready(identifier, reviewed_sha)
    if item["merge"]["approver"] != approver:
        raise RuntimeError(f"factory: {identifier} approval changed since the gate started")
    body = f"factory-review merged {now()} station={item['merge']['station']} claim={item['merge']['claim']} sha={reviewed_sha}\n\nLanded on main as {merge_sha} through scripts/factory-merge.sh. Approver: {approver}. Checks: {checks}."
    comment(item["id"], body)
    current = ready(identifier)
    if not any(c["body"] == body for c in current["comments"]):
        raise RuntimeError("factory: merged boundary was not visible after posting")
    done = next((s["id"] for s in current["team"]["states"]["nodes"] if s["name"] == "Done"), None)
    if not done:
        raise RuntimeError("factory: Done state not found")
    update(current["id"], {"labelIds": [l["id"] for l in current["labels"] if l["name"] != "ready-to-merge"], "stateId": done})


def main():
    command, identifier = sys.argv[1:3]
    if command == "ready":
        item = ready(identifier, sys.argv[3] if len(sys.argv) > 3 else None)
        print(json.dumps(item.get("merge", {})))
    elif command == "issue":
        print(json.dumps(issue(identifier)))
    elif command == "spec":
        item = issue(identifier)
        addenda = [c["body"] for c in sorted(item["comments"], key=lambda c: (c["createdAt"], c["id"])) if c["body"].startswith("**Spec addendum")]
        print(f"# {identifier} {item['title']}\n\n{item['description']}\n\n" + "\n\n".join(addenda))
    elif command == "claim":
        item = issue(identifier)
        if item["state"]["type"] in {"completed", "canceled"} or [l["name"] for l in item["labels"]].count("agent-ready") != 1:
            raise RuntimeError(f"factory: {identifier} is not agent-ready")
        current = [c for c in item["comments"] if c["body"].startswith("factory-build claim ")]
        resolved = {match.group(1) for c in item["comments"] for match in [re.search(r"\b(?:claim|prior)=([^\s]+)", c["body"].splitlines()[0])] if match and re.match(r"factory-build (?:complete|release|blocked|takeover) ", c["body"])}
        if any(c["id"] not in resolved for c in current):
            raise RuntimeError(f"factory: {identifier} has an unresolved build claim; inspect its lease before takeover")
        claim_id = comment(item["id"], f"factory-build claim {now()} station=chatgpt")
        reread = issue(identifier)
        contenders = [c for c in reread["comments"] if c["body"].startswith("factory-build claim ") and c["id"] not in resolved]
        winner = min(contenders, key=lambda c: (c["createdAt"], c["id"]))
        if winner["id"] != claim_id:
            comment(item["id"], f"factory-build release {now()} station=chatgpt prior={claim_id} reason=lost-claim-race")
            raise RuntimeError(f"factory: {identifier} build claim lost the race")
        update(item["id"], {"stateId": next(s["id"] for s in item["team"]["states"]["nodes"] if s["name"] == "In Progress")})
        print(claim_id)
    elif command == "comment":
        print(comment(issue(identifier)["id"], sys.stdin.read()))
    elif command == "finish":
        finish(identifier, sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6])
    else:
        raise RuntimeError(f"unknown Linear command: {command}")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError, ValueError, IndexError) as error:
        print(f"factory: {error}", file=sys.stderr)
        sys.exit(1)
