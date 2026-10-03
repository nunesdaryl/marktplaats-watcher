"""Atlas mirror and owner-scoped vector retrieval. Mongo stores IDs and vectors only."""

import os
import re
from datetime import datetime, timezone

from pymongo import UpdateOne

from convex_api import convex_post


def _mirror_error_fields(error):
    detail = str(error)
    uri = os.getenv("MONGODB_URI")
    if uri:
        detail = detail.replace(uri, "[redacted MongoDB URI]")
    detail = re.sub(r"mongodb(?:\+srv)?://[^\s\"'<>]+", "[redacted MongoDB URI]", detail)
    return {"error": type(error).__name__, "detail": detail[:200]}


class MongoStore:
    def __init__(self, collection=None, purpose="search"):
        self.configured = collection is not None or bool(os.getenv("MONGODB_URI"))
        self.collection = collection
        self._init_error = False
        self.error_info = None
        if self.configured and collection is None:
            try:
                from pymongo import MongoClient
                selection_timeout, timeout = (10000, 20000) if purpose == "mirror" else (1500, 1500)
                self.collection = MongoClient(os.environ["MONGODB_URI"],
                                              serverSelectionTimeoutMS=selection_timeout,
                                              timeoutMS=timeout)["watcher"]["alert_embeddings"]
            except Exception as error:
                self._init_error = True
                if purpose == "mirror":
                    self.error_info = _mirror_error_fields(error)

    def mirror(self, rows):
        if not self.configured:
            return {"status": "unconfigured"}
        if self._init_error:
            return {"status": "error"}
        try:
            operations = [UpdateOne({"_id": row["alertId"]}, {"$set": {
                    "userId": row["userId"], "embedding": row["embedding"],
                }, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}}, upsert=True)
                for row in rows]
            if operations:
                self.collection.bulk_write(operations, ordered=False)
            return {"status": "ok", "count": len(rows)}
        except Exception as error:
            self.error_info = _mirror_error_fields(error)
            return {"status": "error"}

    def search(self, user_id, vector, k):
        if not self.configured:
            return {"status": "unconfigured"}
        if self._init_error:
            return {"status": "error"}
        try:
            rows = self.collection.aggregate([{"$vectorSearch": {
                "index": "alerts_vec", "path": "embedding", "queryVector": vector,
                "numCandidates": max(k * 10, 100), "limit": k, "filter": {"userId": user_id},
            }}, {"$project": {"_id": 1, "score": {"$meta": "vectorSearchScore"}}}])
            return {"status": "ok", "hits": [{"alertId": row["_id"], "score": row.get("score", 0)} for row in rows]}
        except Exception:
            return {"status": "error"}


class ConvexStore:
    def search(self, clerk_id, vector, k, query="", timeout=3):
        return convex_post("/api/alerts/search", {"clerkId": clerk_id, "query": query,
                                                  "vector": vector, "limit": k}, timeout=timeout)

    def user_id(self, clerk_id):
        return convex_post("/api/alerts/user", {"clerkId": clerk_id})

    def hydrate(self, clerk_id, ids):
        return convex_post("/api/alerts/hydrate", {"clerkId": clerk_id, "ids": ids})


def mongo_results(clerk_id, vector, k, mongo=None, convex=None):
    mongo = mongo or MongoStore()
    convex = convex or ConvexStore()
    if not mongo.configured:
        return {"status": "unconfigured"}
    user_id = convex.user_id(clerk_id)
    if not user_id:
        return {"status": "ok", "hits": []}
    result = mongo.search(user_id, vector, k)
    if result["status"] != "ok":
        return result
    return {"status": "ok", "hits": convex.hydrate(clerk_id, result["hits"])}
