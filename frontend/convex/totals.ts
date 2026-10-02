// Compact dashboard projections. A writer changes its source row and its projection in the same mutation.
import { v } from "convex/values";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { MIN_SCORE } from "./schedule";

const DAY = 86_400_000;
export const TRACKED = ["users", "watches", "chats", "alerts", "audits", "events", "feedback", "runs", "errors", "ratings"] as const;
export type Tracked = typeof TRACKED[number];
type Row = { _id: string; [key: string]: unknown };
const day = (at: number) => new Date(at).toISOString().slice(0, 10);
const timed: Partial<Record<Tracked, keyof Doc<"events"> | string>> = {
  alerts: "createdAt", audits: "at", events: "at", runs: "at", errors: "at", ratings: "updatedAt",
};
export const bucketKey = (table: Tracked, row: Record<string, unknown>) => {
  const field = timed[table];
  return field ? `${table}:${day(row[field] as number)}` : table;
};

// Keep only values used by the overview or health box; source documents can include large text and listing payloads.
export function projection(table: Tracked, row: Record<string, any>): Row {
  const keys: Record<Tracked, string[]> = {
    users: ["clerkId", "email", "createdAt", "onboardedAt"],
    watches: ["userId", "name", "label", "createdAt", "active", "archivedAt", "backlog", "coverageCapped", "lastError", "schedule", "notify", "seededAt"],
    chats: ["userId", "updatedAt"],
    alerts: ["userId", "watchId", "listingId", "title", "url", "score", "emailStatus", "createdAt"],
    audits: ["at", "watchId", "userId", "requestId", "ok", "missCount", "misses", "error"],
    events: ["at", "userId", "name", "props", "device"],
    feedback: ["status", "handledAt", "repliedAt", "wouldPay", "createdAt"],
    runs: ["at", "checked", "failed", "emails", "emailFailures", "paused", "requestId"],
    errors: ["at", "kind", "requestId", "message"],
    ratings: ["updatedAt"],
  };
  const out: Row = { _id: row._id };
  for (const key of keys[table]) if (row[key] !== undefined) out[key] = row[key];
  return out;
}

const counts = (rows: Row[], key: (row: any) => string | undefined) => {
  const result: Record<string, number> = {};
  for (const row of rows) {
    const name = key(row);
    if (name) result[name] = (result[name] ?? 0) + 1;
  }
  return result;
};

export function summarizeEvents(rows: Row[]) {
  const sorted = [...rows].sort((a: any, b: any) => b.at - a.at || b._id.localeCompare(a._id));
  const chat = sorted.filter((e: any) => e.name === "chat_sent");
  const views = sorted.filter((e: any) => e.name === "page_view");
  return {
    count: rows.length,
    users: [...new Set(rows.map((e: any) => e.userId))].sort(),
    chatUsers: [...new Set(chat.map((e: any) => e.userId))].sort(),
    names: counts(sorted, (e) => e.name),
    pages: counts(views, (e) => e.props?.section || "chat"),
    devices: counts(sorted, (e) => e.device),
    themes: counts(views, (e) => e.props?.value),
    chatModes: counts(chat, (e) => e.props?.mode ?? "search"),
    searches: chat.filter((e: any) => e.props?.mode !== "watch").length,
    watchChats: chat.filter((e: any) => e.props?.mode === "watch").length,
  };
}

export function summarizeAlerts(rows: Row[]) {
  return { count: rows.length, sent: rows.filter((a: any) => a.emailStatus === "sent").length,
    failed: rows.filter((a: any) => a.emailStatus === "failed").length,
    users: [...new Set(rows.map((a: any) => a.userId))].sort() };
}

export async function readSummaries(ctx: QueryCtx, table: "events" | "alerts", since?: number) {
  if (!(await bucket(ctx, "meta"))) return null;
  const prefix = `summary:${table}:`;
  return (await ctx.db.query("dashboardTotals").withIndex("by_key", (q) =>
    q.gte("key", `${prefix}${since === undefined ? "" : day(since)}`).lt("key", `${prefix}\uffff`)).collect())
    .map((d) => ({ day: d.key.slice(prefix.length), summary: d.summary }));
}

export async function readDayRows<K extends "events" | "alerts">(ctx: QueryCtx, table: K, date: string): Promise<Doc<K>[]> {
  return ((await bucket(ctx, `${table}:${date}`))?.rows ?? []) as Doc<K>[];
}

export async function windowSummaries(ctx: QueryCtx, table: "events", since: number): Promise<{ day: string; summary: ReturnType<typeof summarizeEvents> }[] | null>;
export async function windowSummaries(ctx: QueryCtx, table: "alerts", since: number): Promise<{ day: string; summary: ReturnType<typeof summarizeAlerts> }[] | null>;
export async function windowSummaries(ctx: QueryCtx, table: "events" | "alerts", since: number) {
  const docs = await readSummaries(ctx, table, since);
  if (docs === null) return null;
  const boundary = day(since);
  return Promise.all(docs.map(async (d) => d.day === boundary
    ? { day: d.day, summary: table === "events"
      ? summarizeEvents((await readDayRows(ctx, "events", boundary)).filter((e) => e.at >= since))
      : summarizeAlerts((await readDayRows(ctx, "alerts", boundary)).filter((a) => a.createdAt >= since)) }
    : d));
}

async function bucket(ctx: QueryCtx, key: string) {
  return ctx.db.query("dashboardTotals").withIndex("by_key", (q) => q.eq("key", key)).unique();
}

export async function readRows<K extends Tracked>(ctx: QueryCtx, table: K, since?: number): Promise<Doc<K>[] | null> {
  if (!(await bucket(ctx, "meta"))) return null;
  const docs = table in timed
    ? await ctx.db.query("dashboardTotals").withIndex("by_key", (q) => q.gte("key", `${table}:${since === undefined ? "" : day(since)}`).lt("key", `${table}:\uffff`)).collect()
    : [await bucket(ctx, table)];
  return docs.flatMap((d) => d?.rows ?? []) as Doc<K>[];
}

async function change(ctx: MutationCtx, table: Tracked, before: Record<string, any> | null, after: Record<string, any> | null) {
  // Existing deployments are backfilled before enabling the read path. During a dry-run backfill, source writes
  // continue normally and the backfill's compare reports what would be written.
  if (!(await bucket(ctx, "meta"))) return;
  if (before && after && JSON.stringify(projection(table, before)) === JSON.stringify(projection(table, after))) return;
  const keys = new Set([before && bucketKey(table, before), after && bucketKey(table, after)].filter(Boolean) as string[]);
  for (const key of keys) {
    const existing = await bucket(ctx, key);
    const rows = (existing?.rows ?? []).filter((r: Row) => r._id !== (before?._id ?? after?._id));
    if (after && bucketKey(table, after) === key) rows.push(projection(table, after));
    if (existing) await ctx.db.patch(existing._id, { rows });
    else await ctx.db.insert("dashboardTotals", { key, rows });
    if (table === "events" || table === "alerts") {
      const summaryKey = `summary:${key}`;
      const summary = table === "events" ? summarizeEvents(rows) : summarizeAlerts(rows);
      const current = await bucket(ctx, summaryKey);
      if (current) await ctx.db.patch(current._id, { summary });
      else await ctx.db.insert("dashboardTotals", { key: summaryKey, rows: [], summary });
    }
  }
  if (table === "alerts") {
    const sentKeys = new Set([before && bucketKey(table, before), after && bucketKey(table, after)].filter(Boolean) as string[]);
    for (const key of sentKeys) {
      const countKey = `sent:${key.slice("alerts:".length)}`;
      const existing = await bucket(ctx, countKey);
      const delta = Number(after?.emailStatus === "sent" && bucketKey(table, after) === key)
        - Number(before?.emailStatus === "sent" && bucketKey(table, before) === key);
      if (!delta) continue;
      if (existing) await ctx.db.patch(existing._id, { sent: (existing.sent ?? 0) + delta });
      else await ctx.db.insert("dashboardTotals", { key: countKey, rows: [], sent: delta });
    }
  }
}

export async function sentAlertsSince(ctx: QueryCtx, since: number): Promise<number | null> {
  if (!(await bucket(ctx, "meta"))) return null;
  const date = day(since);
  const counts = await ctx.db.query("dashboardTotals")
    .withIndex("by_key", (q) => q.gte("key", `sent:${date}`).lt("key", "sent:\uffff")).collect();
  const whole = counts.filter((d) => d.key > `sent:${date}`).reduce((n, d) => n + (d.sent ?? 0), 0);
  const boundary = (await bucket(ctx, `alerts:${date}`))?.rows.filter((r: any) => r.createdAt >= since && r.emailStatus === "sent").length ?? 0;
  return whole + boundary;
}

export async function insertTracked<K extends Tracked>(ctx: MutationCtx, table: K, value: any): Promise<Id<K>> {
  const id = await ctx.db.insert(table, value);
  await change(ctx, table, null, (await ctx.db.get(id))!);
  return id;
}

export async function patchTracked<K extends Tracked>(ctx: MutationCtx, table: K, id: Id<K>, value: any) {
  const before = await ctx.db.get(id);
  await ctx.db.patch(id, value);
  if (before) await change(ctx, table, before, (await ctx.db.get(id))!);
}

export async function deleteTracked<K extends Tracked>(ctx: MutationCtx, table: K, id: Id<K>) {
  const before = await ctx.db.get(id);
  await ctx.db.delete(id);
  if (before) await change(ctx, table, before, null);
}

async function quietWatches(ctx: QueryCtx, now: number, watches: Doc<"watches">[]) {
  const today = Math.floor(now / DAY) * DAY;
  const since = today - 2 * DAY;
  const quiet = [];
  for (const watch of watches.filter((w) => w.active && w.archivedAt === undefined)) {
    const seen = await ctx.db.query("seenListings")
      .withIndex("by_watch_lastSeen", (q) => q.eq("watchId", watch._id).gte("lastSeenAt", since)).collect();
    const fresh = seen.filter((s) => (s.firstSeenAt ?? s._creationTime) >= since
      && (s.firstSeenAt ?? s._creationTime) <= now
      && (watch.seededAt === undefined || (s.firstSeenAt ?? s._creationTime) > watch.seededAt));
    if (new Set(fresh.map((s) => Math.floor((s.firstSeenAt ?? s._creationTime) / DAY))).size < 3) continue;
    const alerts = await ctx.db.query("alerts")
      .withIndex("by_watch_createdAt", (q) => q.eq("watchId", watch._id).gte("createdAt", since)).collect();
    if (alerts.some((a) => a.createdAt <= now && a.emailStatus === "sent")) continue;
    const best = fresh.filter((s) => s.scoredAt !== undefined && s.scoredAt >= since && s.scoredAt <= now
      && s.score !== undefined && s.score >= MIN_SCORE[watch.notify] && s.title !== undefined && s.url !== undefined)
      .sort((a, b) => b.score! - a.score!)[0];
    if (best) quiet.push({ watch: projection("watches", watch), listing: best });
  }
  return quiet;
}

export async function storedQuiet(ctx: QueryCtx) {
  const meta = await bucket(ctx, "meta");
  return meta ? meta.quiet ?? [] : null;
}

export async function liveQuiet(ctx: QueryCtx, now: number, watches: Doc<"watches">[]) {
  return quietWatches(ctx, now, watches);
}

async function recountRows(ctx: MutationCtx) {
  const result = new Map<string, Row[]>();
  for (const table of TRACKED) {
    for await (const row of ctx.db.query(table)) {
      const key = bucketKey(table, row);
      if (!result.has(key)) result.set(key, []);
      result.get(key)!.push(projection(table, row));
    }
  }
  return result;
}

async function rebuild(ctx: MutationCtx, dryRun: boolean) {
  const now = Date.now();
  const expected = await recountRows(ctx);
  for (const [key, rows] of [...expected]) if (key.startsWith("alerts:"))
    expected.set(`sent:${key.slice("alerts:".length)}`, []);
  for (const [key] of [...expected]) if (key.startsWith("events:") || key.startsWith("alerts:"))
    expected.set(`summary:${key}`, []);
  const existing = await ctx.db.query("dashboardTotals").collect();
  const byKey = new Map(existing.map((d) => [d.key, d]));
  const drift: string[] = [];
  for (const key of new Set([...expected.keys(), ...existing.map((d) => d.key).filter((k) => k !== "meta")])) {
    const actual = byKey.get(key)?.rows ?? [];
    const wanted = expected.get(key) ?? [];
    const normalize = (value: any): any => Array.isArray(value) ? value.map(normalize)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalize(value[k])])) : value;
    const stable = (rows: Row[]) => JSON.stringify(normalize([...rows].sort((a, b) => a._id.localeCompare(b._id))));
    const expectedSent = key.startsWith("sent:")
      ? expected.get(`alerts:${key.slice("sent:".length)}`)?.filter((r) => r.emailStatus === "sent").length ?? 0 : undefined;
    const expectedSummary = key.startsWith("summary:events:")
      ? summarizeEvents(expected.get(key.slice("summary:".length)) ?? [])
      : key.startsWith("summary:alerts:") ? summarizeAlerts(expected.get(key.slice("summary:".length)) ?? []) : undefined;
    const sameSummary = expectedSummary === undefined || JSON.stringify(normalize(byKey.get(key)?.summary)) === JSON.stringify(normalize(expectedSummary));
    const differed = stable(actual) !== stable(wanted) || expectedSent !== undefined && byKey.get(key)?.sent !== expectedSent || !sameSummary;
    if (differed) drift.push(key);
    if (!dryRun && differed) {
      const old = byKey.get(key);
      if (old) await ctx.db.patch(old._id, { rows: wanted, ...(expectedSent !== undefined ? { sent: expectedSent } : {}),
        ...(expectedSummary !== undefined ? { summary: expectedSummary } : {}) });
      else await ctx.db.insert("dashboardTotals", { key, rows: wanted, ...(expectedSent !== undefined ? { sent: expectedSent } : {}),
        ...(expectedSummary !== undefined ? { summary: expectedSummary } : {}) });
    }
  }
  if (!dryRun) {
    const watches = await ctx.db.query("watches").collect();
    const quiet = await quietWatches(ctx, now, watches);
    const meta = byKey.get("meta");
    if (meta) await ctx.db.patch(meta._id, { quiet, drift, checkedAt: now });
    else await ctx.db.insert("dashboardTotals", { key: "meta", rows: [], quiet, drift: [], checkedAt: now });
  }
  return { drift, buckets: expected.size, dryRun };
}

export const backfill = internalMutation({
  args: { dryRun: v.boolean() },
  handler: async (ctx, { dryRun }) => rebuild(ctx, dryRun),
});

export const recount = internalMutation({
  args: {},
  handler: async (ctx) => rebuild(ctx, false),
});

export async function driftAlarm(ctx: QueryCtx) {
  return (await bucket(ctx, "meta"))?.drift ?? [];
}
