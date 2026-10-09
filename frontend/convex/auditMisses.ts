import type { Doc } from "./_generated/dataModel";

// Also interprets rows written before deduplication was introduced, so old repeats clear from the dashboard.
export function annotateAudits<T extends Doc<"audits">>(rows: T[]) {
  const firstReported = new Map<string, number>();
  const annotated = new Map<T["_id"], T>();
  for (const row of [...rows].sort((a, b) => a.at - b.at || (a._creationTime ?? 0) - (b._creationTime ?? 0))) {
    let repeats = 0;
    const misses = row.misses.map((miss) => {
      const key = JSON.stringify([row.watchId, miss.listingId]);
      const first = firstReported.get(key) ?? miss.reportedBefore;
      if (first !== undefined) repeats++;
      if (!firstReported.has(key)) firstReported.set(key, first ?? row.at);
      return first === undefined ? miss : { ...miss, reportedBefore: first };
    });
    annotated.set(row._id, { ...row, misses,
      missCount: row.deduplicated ? row.missCount : Math.max(0, row.missCount - repeats) });
  }
  return rows.map((row) => annotated.get(row._id)!);
}
