"""Atlas mirror and owner-scoped vector retrieval. Mongo stores IDs and vectors only."""

import os
from datetime import datetime, timezone

from convex_api import convex_post


class MongoStore:
    def __init__(self, collection=None):
        self.configured = collection is not None or bool(os.getenv("MONGODB_URI"))
        self.collection = collection
        self._init_error = False
        if self.configured and collection is None:
            try:
                from pymongo import MongoClient
                self.collection = MongoClient(os.environ["MONGODB_URI"], serverSelectionTimeoutMS=1500,
                                              timeoutMS=1500)["watcher"]["alert_embeddings"]
            except Exception:
                self._init_error = True

    def mirror(self, rows):
        if not self.configured:
            return {"status": "unconfigured"}
        if self._init_error:
            return {"status": "error"}
        try:
            for row in rows:
                self.collection.update_one({"_id": row["alertId"]}, {"$set": {
                    "userId": row["userId"], "embedding": row["embedding"],
                }, "$setOnInsert": {"createdAt": datetime.now(timezone.utc)}}, upsert=True)
            return {"status": "ok", "count": len(rows)}
        except Exception:
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
