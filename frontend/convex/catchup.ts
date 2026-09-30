import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { renderEmail, sendEmail } from "./checker";
import { ratingToken } from "./ratings";

const RESEED_AT = Date.parse("2026-09-29T19:30:00Z");
const BASELINE_MS = 2 * 60_000;
const MAX_WATCHES_PER_REQUEST = 20;

export const groups = internalQuery({
  args: {},
  handler: async (ctx) => {
    const watches = await ctx.db.query("watches").withIndex("by_active_next", (q) => q.eq("active", true)).collect();
    const byQuery = new Map<string, { watches: Record<string, unknown>[] }>();
    for (const w of watches) {
      if (!w.seeded || w.archivedAt !== undefined) continue;
      const user = await ctx.db.get(w.userId);
      if (!user) continue;
      const seen = await ctx.db.query("seenListings").withIndex("by_watch_lastSeen", (q) => q.eq("watchId", w._id)).collect();
      const alerts = await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", w._id)).collect();
      const first = seen.filter((s) => s._creationTime >= RESEED_AT)
        .reduce((earliest, s) => Math.min(earliest, s._creationTime), Infinity);
      const baseline = w.seededAt === undefined ? seen.filter((s) => s._creationTime >= first && s._creationTime <= first + BASELINE_MS)
        : seen.filter((s) => Math.abs(s._creationTime - w.seededAt!) <= BASELINE_MS);
      const query = w.query.toLowerCase();
      if (!byQuery.has(query)) byQuery.set(query, { watches: [] });
      byQuery.get(query)!.watches.push({
        id: w._id, query, description: w.label, max_price_eur: w.maxPriceEur ?? null,
        must_include: w.mustInclude ?? null, postcode: w.postcode ?? null,
        max_distance_km: w.maxDistanceKm ?? null, notify: w.notify,
        seen_ids: seen.map((s) => s.listingId), baseline_ids: baseline.map((s) => s.listingId),
        alerted_ids: alerts.map((a) => a.listingId), last_read_at: w.lastReadAt ?? null,
        check_alive: true,
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

const miss = v.object({ id: v.string(), title: v.string(), url: v.string(), score: v.number(),
  kind: v.string(), price_eur: v.optional(v.union(v.number(), v.null())) });
const result = v.object({ watchId: v.string(), ok: v.boolean(), misses: v.array(miss) });

export const record = internalMutation({
  args: { results: v.array(result), dryRun: v.boolean(), now: v.number() },
  handler: async (ctx, { results, dryRun, now }) => {
    const mails: { watchId: Id<"watches">; alertIds: Id<"alerts">[]; userEmail: string;
      watchLabel: string; listings: { score: number; title: string; price: number | null; url: string }[] }[] = [];
    for (const r of results) {
      const watchId = ctx.db.normalizeId("watches", r.watchId);
      const watch = watchId && await ctx.db.get(watchId);
      if (!watch || !watch.active || !watch.seeded || watch.archivedAt !== undefined || !r.ok) continue;
      const user = await ctx.db.get(watch.userId);
      if (!user) continue;
      const existing = await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", watch._id)).collect();
      if (existing.some((a) => a.catchUp)) continue;
      const alerted = new Set(existing.map((a) => a.listingId));
      const selected = [...r.misses].sort((a, b) => b.score - a.score)
        .filter((m) => { if (alerted.has(m.id)) return false; alerted.add(m.id); return true; }).slice(0, 10);
      if (!selected.length) continue;
      const alertIds: Id<"alerts">[] = [];
      if (!dryRun) for (const item of selected) alertIds.push(await ctx.db.insert("alerts", {
        userId: watch.userId, watchId: watch._id, listingId: item.id, title: item.title,
        priceEur: item.price_eur ?? undefined, url: item.url, score: item.score,
        reason: "Match we missed.", channel: "email", catchUp: true,
        emailStatus: "pending", createdAt: now,
      }));
      mails.push({ watchId: watch._id, alertIds, userEmail: user.email, watchLabel: watch.name ?? watch.label,
        listings: selected.map((m) => ({ score: m.score, title: m.title, price: m.price_eur ?? null, url: m.url })) });
    }
    return mails;
  },
});

export const run = internalAction({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = true }) => {
    const groups = await ctx.runQuery(internal.catchup.groups, {});
    const api = process.env.WATCHER_API_URL, secret = process.env.CRON_SECRET;
    if (groups.length && (!api || !secret)) throw new Error("WATCHER_API_URL / CRON_SECRET are not set in Convex.");
    if (!dryRun && groups.length && !process.env.RATING_SECRET) throw new Error("RATING_SECRET is not set in Convex.");
    const runId = crypto.randomUUID();
    const preview: { userEmail: string; watchLabel: string;
      listings: { score: number; title: string; price: number | null; url: string }[] }[] = [];
    for (const [index, group] of groups.entries()) {
      const requestId = `audit-${runId}.${index}`;
      const res = await fetch(`${api!.replace(/\/$/, "")}/api/internal/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Cron-Secret": secret!, "X-Request-Id": requestId },
        body: JSON.stringify(group), signal: AbortSignal.timeout(240_000),
      });
      if (!res.ok) throw new Error(`Search service answered ${res.status}.`);
      const results = (await res.json()).results;
      if (!Array.isArray(results) || results.length !== group.watches.length || results.some((r) => !r.ok))
        throw new Error(`Search service returned an incomplete catch-up audit (${requestId}).`);
      const mails = await ctx.runMutation(internal.catchup.record, { results: results.map((r) => ({
        watchId: r.watchId, ok: r.ok, misses: r.misses,
      })), dryRun, now: Date.now() });
      for (const mail of mails) {
        preview.push({ userEmail: mail.userEmail, watchLabel: mail.watchLabel, listings: mail.listings });
        if (dryRun) continue;
        const content = await ctx.runQuery(internal.checker.emailContent, { watchId: mail.watchId, alertIds: mail.alertIds });
        if (!content) continue;
        for (const alert of content.alerts) (alert as { rateToken?: string | null }).rateToken = await ratingToken(alert._id);
        let status: "sent" | "failed" = "sent";
        try {
          await sendEmail(mail.userEmail, renderEmail({ ...content, catchUp: true },
            process.env.APP_URL ?? "https://marktplaats-watcher.vercel.app"));
        } catch (e) {
          console.error("catch-up e-mail failed:", e);
          status = "failed";
        }
        await ctx.runMutation(internal.checker.markEmailed, { alertIds: mail.alertIds, status });
      }
    }
    return preview;
  },
});
