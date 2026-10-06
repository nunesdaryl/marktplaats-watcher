"""Sanitize a read-only Convex export ZIP for manual RAG labelling.

Usage: python -m evals.export_rag_snapshot convex-export.zip
The source archive is never changed. Review and add cases.json before committing.
"""
import json
import sys
from pathlib import Path
from zipfile import ZipFile

DATA = Path(__file__).parent / "data" / "rag_snapshot"


def rows(archive, table):
    name = next((name for name in archive.namelist() if name.endswith(f"{table}/documents.jsonl")), None)
    if name is None:
        raise ValueError(f"Export has no {table}/documents.jsonl")
    return [json.loads(line) for line in archive.read(name).splitlines()]


def sanitize(path):
    with ZipFile(path) as archive:
        users = {row["_id"]: f"owner-{index:03}" for index, row in enumerate(rows(archive, "users"), 1)}
        watches = {row["_id"]: row for row in rows(archive, "watches")}
        alerts = {row["_id"]: row for row in rows(archive, "alerts")}
        output = []
        for embedding in rows(archive, "alertEmbeddings"):
            alert = alerts.get(embedding["alertId"])
            if not alert or alert.get("userId") != embedding.get("userId") or alert["userId"] not in users:
                continue
            watch = watches.get(alert["watchId"], {})
            output.append({"alertId": alert["_id"], "owner": users[alert["userId"]],
                           "listingId": alert.get("listingId"), "title": alert["title"],
                           "priceEur": alert.get("priceEur"), "reason": alert.get("reason"),
                           "url": alert.get("url"), "createdAt": alert.get("createdAt"),
                           "watchLabel": watch.get("name") or watch.get("label"),
                           "text": embedding["text"], "embedding": embedding["embedding"]})
    if not output:
        raise ValueError("No matching alerts and embeddings")
    return {"source": "read-only Convex export; manually reviewed", "alerts": output}


def main():
    snapshot = sanitize(Path(sys.argv[1]))
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "snapshot.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(snapshot['alerts'])} sanitized alerts. Review the file and label about 15 cases in cases.json.")


if __name__ == "__main__":
    main()
