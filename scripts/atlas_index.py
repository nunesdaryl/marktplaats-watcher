"""Create the Atlas Vector Search index after MONGODB_URI is configured."""

import json
import os
from pathlib import Path

from pymongo import MongoClient


def main():
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise SystemExit("MONGODB_URI is not configured")
    definition = json.loads((Path(__file__).resolve().parents[1] / "ops/atlas/alerts_vec.json").read_text())
    database = MongoClient(uri, serverSelectionTimeoutMS=1500)["watcher"]
    if "alert_embeddings" not in database.list_collection_names():
        database.create_collection("alert_embeddings")
    collection = database["alert_embeddings"]
    if any(index["name"] == "alerts_vec" for index in collection.list_search_indexes()):
        print("alerts_vec already exists")
        return
    collection.database.command({"createSearchIndexes": collection.name,
                                 "indexes": [{"name": "alerts_vec", "type": "vectorSearch", "definition": definition}]})
    print("alerts_vec created; wait until Atlas reports READY before searching")


if __name__ == "__main__":
    main()
