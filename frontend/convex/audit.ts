// A daily read-only replay of each seeded watch. Results go only to audits for the owner.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { sendEmail } from "./checker";
import { insertTracked } from "./totals";

const DAY = 86_400_000;
const MAX_WATCHES_PER_REQUEST = 20;

/** The most recent audit run is one batch even when it checked several watches. */
export const latestMissesForDrafts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db.query("audits").withIndex("by_at").order("desc").first();
    if (!latest) return [];
    return (await ctx.db.query("audits").withIndex("by_at", (q) => q.eq("at", latest.at)).collect())
      .filter((row) => row.ok && row.missCount > 0)
      .map((row) => ({ id: row._id, at: row.at, watchId: row.watchId,
        missCount: row.missCount, misses: row.misses }));
  },
});

export const groups = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const watches = await ctx.db.query("watches").withIndex("by_active_next", (q) => q.eq("active", true)).collect();
    const byQuery = new Map<string, { watches: Record<string, unknown>[] }>();
    for (const w of watches) {
      if (!w.seeded || w.archivedAt !== undefined) continue;
      const seen = await ctx.db.query("seenListings").withIndex("by_watch_lastSeen", (q) => q.eq("watchId", w._id))
        .order("desc").collect();
      const alerts = await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", w._id)).collect();
      const query = w.query.toLowerCase();
      if (!byQuery.has(query)) byQuery.set(query, { watches: [] });
      byQuery.get(query)!.watches.push({
        id: w._id, query, description: w.label, max_price_eur: w.maxPriceEur ?? null,
        must_include: w.mustInclude ?? null, postcode: w.postcode ?? null,
        max_distance_km: w.maxDistanceKm ?? null, notify: w.notify,
        seen_ids: seen.map((s) => s.listingId),
        seen_scores: Object.fromEntries(seen.filter((s) => s.score !== undefined).map((s) => [s.listingId, s.score])),
        baseline_ids: w.seededAt === undefined ? [] : seen
          .filter((s) => Math.abs(s._creationTime - w.seededAt!) <= 2 * 60_000)
          .map((s) => s.listingId),
        alerted_ids: alerts.filter((a) => a.createdAt >= now - 7 * DAY).map((a) => a.listingId),
        last_read_at: w.lastReadAt ?? null,
      });
    }
    return [...byQuery.values()].flatMap((group) => {
      const chunks = [];
      for (let i = 0; i < group.watches.length; i += MAX_WATCHES_PER_REQUEST)
        chunks.push({ watches: group.watches.slice(i, i + MAX_WATCHES_PER_REQUEST) });
      return chunks;
    });
  },
});

const result = v.object({
  watchId: v.string(), ok: v.boolean(), read: v.number(), candidates: v.number(), scored: v.number(),
  missCount: v.number(), unscored: v.optional(v.number()), error: v.optional(v.string()),
  misses: v.array(v.object({ id: v.string(), title: v.string(), url: v.string(), score: v.number(),
    kind: v.union(v.literal("handled"), v.literal("never_read"), v.literal("rescored"),
      v.literal("never_scored")), checkScore: v.optional(v.number()) })),
});

export const record = internalMutation({
  args: { at: v.number(), requestId: v.string(), results: v.array(result) },
  handler: async (ctx, { at, requestId, results }) => {
    for (const r of results) {
      const id = ctx.db.normalizeId("watches", r.watchId);
      const watch = id && await ctx.db.get(id);
      if (!watch) continue;
      await insertTracked(ctx, "audits", {
        at, watchId: watch._id, userId: watch.userId, requestId, ok: r.ok, read: r.read,
        scored: r.scored, missCount: r.missCount, ...(r.unscored !== undefined ? { unscored: r.unscored } : {}),
        misses: r.misses.slice(0, 5).map((m) => ({ listingId: m.id, title: m.title,
          url: m.url, score: m.score, kind: m.kind,
          ...(m.checkScore !== undefined ? { checkScore: m.checkScore } : {}) })),
        ...(r.error ? { error: r.error } : {}),
      });
    }
  },
});

export const ownerItems = internalQuery({
  args: { results: v.array(result) },
  handler: async (ctx, { results }) => {
    const items = [];
    for (const r of results) {
      if (!r.ok) continue;
      const watchId = ctx.db.normalizeId("watches", r.watchId);
      const watch = watchId && await ctx.db.get(watchId);
      if (!watch) continue;
      for (const m of r.misses) {
        if (m.score < 9 || (m.kind !== "handled" && m.kind !== "rescored")) continue;
        items.push({ watchId: watch._id, userId: watch.userId, listingId: m.id,
          title: m.title, url: m.url, score: m.score });
      }
    }
    return items;
  },
});

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const at = Date.now();
    const runId = crypto.randomUUID();
    const groups = await ctx.runQuery(internal.audit.groups, { now: at });
    const api = process.env.WATCHER_API_URL, secret = process.env.CRON_SECRET;
    let checked = 0, misses = 0;
    const ownerResults = [];
    for (const [index, group] of groups.entries()) {
      const requestId = `audit-${runId}.${index}`;
      let results;
      try {
        if (!api || !secret) throw new Error("WATCHER_API_URL / CRON_SECRET are not set in Convex.");
        const res = await fetch(`${api.replace(/\/$/, "")}/api/internal/audit`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Cron-Secret": secret, "X-Request-Id": requestId },
          body: JSON.stringify(group), signal: AbortSignal.timeout(240_000),
        });
        if (!res.ok) throw new Error(`Search service answered ${res.status}.`);
        results = (await res.json()).results;
        if (!Array.isArray(results) || results.length !== group.watches.length)
          throw new Error("Search service returned an incomplete audit.");
      } catch (e) {
        const error = `${e instanceof Error ? e.name : "Error"}: ${e instanceof Error ? e.message : String(e)}`;
        console.error(`audit request ${requestId} failed:`, error);
        results = group.watches.map((w) => ({ watchId: w.id, ok: false, read: 0,
          candidates: 0, scored: 0, missCount: 0, misses: [], error }));
      }
      await ctx.runMutation(internal.audit.record, { at, requestId, results });
      ownerResults.push(...results.filter((r: { ok: boolean; misses: { score: number; kind: string }[] }) =>
        r.ok && r.misses.some((m) => m.score >= 9 && (m.kind === "handled" || m.kind === "rescored"))));
      checked += results.length;
      misses += results.reduce((n: number, r: { missCount: number }) => n + r.missCount, 0);
    }
    if (ownerResults.length) {
      const items = await ctx.runQuery(internal.audit.ownerItems, { results: ownerResults });
      if (items.length) {
        const auditDay = new Date(at).toISOString().slice(0, 10);
        const planId = await ctx.runMutation(internal.catchup.planFromItems, { items, auditDay });
        const to = process.env.OWNER_EMAIL;
        if (to) {
          const notice = await ctx.runMutation(internal.catchup.claimOwnerNotice, { planId });
          if (notice) {
            const subject = `Marktplaats Watcher: ${notice.length} high-scoring delivery miss${notice.length === 1 ? "" : "es"}`;
            const text = [subject, "", ...notice.flatMap((m) => [
              `User: ${m.user}`, `Watch: ${m.watch}`, `Title: ${m.title}`, `Score: ${m.score}/10`, `Link: ${m.url}`, "",
            ]), `Draft catch-up plan: ${planId}`,
              `Send after review: cd frontend && npx convex run --prod catchup:send '{"planId":"${planId}"}'`].join("\n");
            const html = `<pre style="font:14px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`;
            await sendEmail(to, { subject, text, html });
          }
        }
      }
    }
    return { checked, misses };
  },
});
