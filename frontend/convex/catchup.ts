import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { renderEmail, sendEmail } from "./checker";
import { ratingToken } from "./ratings";
import { catchupItem } from "./schema";

const BASELINE_MS = 2 * 60_000;
const MAX_WATCHES_PER_REQUEST = 20;
const START_DAY = Date.UTC(2026, 8, 29);
const DAY_MS = 86_400_000;

function catchupDays(now: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", year: "numeric",
    month: "numeric", day: "numeric" }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const today = Date.UTC(part("year"), part("month") - 1, part("day"));
  return Math.min(7, Math.max(0, (today - START_DAY) / DAY_MS));
}

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
      const first = seen.reduce((earliest, s) => Math.min(earliest, s._creationTime), Infinity);
      const original = seen.filter((s) => s._creationTime >= first && s._creationTime <= first + BASELINE_MS);
      const numbers = original.map((s) => /^m\d+$/.test(s.listingId) ? Number(s.listingId.slice(1)) : null)
        .filter((number): number is number => number !== null);
      const createdMark = numbers.length ? Math.max(...numbers) : undefined;
      const baseline = w.seededAt === undefined ? []
        : seen.filter((s) => Math.abs(s._creationTime - w.seededAt!) <= BASELINE_MS);
      const query = w.query.toLowerCase();
      if (!byQuery.has(query)) byQuery.set(query, { watches: [] });
      byQuery.get(query)!.watches.push({
        id: w._id, query, description: w.label, max_price_eur: w.maxPriceEur ?? null,
        must_include: w.mustInclude ?? null, postcode: w.postcode ?? null,
        max_distance_km: w.maxDistanceKm ?? null, notify: w.notify,
        seen_ids: seen.map((s) => s.listingId), baseline_ids: baseline.map((s) => s.listingId),
        ...(w.seededAt === undefined && createdMark !== undefined ? { created_mark: createdMark } : {}),
        alerted_ids: alerts.map((a) => a.listingId), last_read_at: w.lastReadAt ?? null,
        check_alive: true, since_days: catchupDays(Date.now()),
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
  args: { results: v.array(result) },
  handler: async (ctx, { results }) => {
    const mails: { userEmail: string; watchLabel: string;
      listings: { score: number; title: string; price: number | null; url: string }[];
      items: { watchId: Id<"watches">; userId: Id<"users">; listingId: string; title: string;
        url: string; priceEur?: number; score: number }[] }[] = [];
    for (const r of results) {
      const watchId = ctx.db.normalizeId("watches", r.watchId);
      const watch = watchId && await ctx.db.get(watchId);
      if (!watch || !watch.active || !watch.seeded || watch.archivedAt !== undefined || !r.ok) continue;
      const user = await ctx.db.get(watch.userId);
      if (!user) continue;
      const existing = await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", watch._id)).collect();
      const alerted = new Set(existing.map((a) => a.listingId));
      const selected = [...r.misses].sort((a, b) => b.score - a.score)
        .filter((m) => { if (alerted.has(m.id)) return false; alerted.add(m.id); return true; }).slice(0, 10);
      if (!selected.length) continue;
      mails.push({ userEmail: user.email, watchLabel: watch.name ?? watch.label,
        listings: selected.map((m) => ({ score: m.score, title: m.title, price: m.price_eur ?? null, url: m.url })),
        items: selected.map((m) => ({ watchId: watch._id, userId: watch.userId, listingId: m.id,
          title: m.title, url: m.url, priceEur: m.price_eur ?? undefined, score: m.score })) });
    }
    return mails;
  },
});

export const planFromItems = internalMutation({
  args: { items: v.array(catchupItem) },
  handler: async (ctx, { items }) => ctx.db.insert("catchupPlans", { at: Date.now(), status: "draft", items }),
});

export const claimPlan = internalMutation({
  args: { planId: v.id("catchupPlans") },
  handler: async (ctx, { planId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan) throw new Error("Catch-up plan not found.");
    if (plan.status === "sent") return [];
    const byWatch = new Map<Id<"watches">, Id<"alerts">[]>();
    const alerted = new Map<Id<"watches">, Set<string>>();
    for (const item of plan.items) {
      if (!alerted.has(item.watchId)) {
        const existing = await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", item.watchId)).collect();
        alerted.set(item.watchId, new Set(existing.map((a) => a.listingId)));
      }
      const ids = alerted.get(item.watchId)!;
      if (ids.has(item.listingId)) continue;
      ids.add(item.listingId);
      const alertId = await ctx.db.insert("alerts", {
        userId: item.userId, watchId: item.watchId, listingId: item.listingId,
        title: item.title, url: item.url, priceEur: item.priceEur, score: item.score,
        city: item.city, image: item.image, reason: "Match we missed.", channel: "email",
        catchUp: true, emailStatus: "pending", createdAt: Date.now(),
      });
      byWatch.set(item.watchId, [...(byWatch.get(item.watchId) ?? []), alertId]);
    }
    await ctx.db.patch(planId, { status: "sent" });
    return [...byWatch].map(([watchId, alertIds]) => ({ watchId, alertIds }));
  },
});

export const send = internalAction({
  args: { planId: v.id("catchupPlans") },
  handler: async (ctx, { planId }) => {
    const mails = await ctx.runMutation(internal.catchup.claimPlan, { planId });
    for (const mail of mails) {
      const content = await ctx.runQuery(internal.checker.emailContent, mail);
      if (!content) continue;
      for (const alert of content.alerts) (alert as { rateToken?: string | null }).rateToken = await ratingToken(alert._id);
      let status: "sent" | "failed" = "sent";
      try {
        const user = await ctx.runQuery(internal.catchup.emailRecipient, { watchId: mail.watchId });
        if (!user) continue;
        await sendEmail(user, renderEmail({ ...content, catchUp: true },
          process.env.APP_URL ?? "https://marktplaats-watcher.vercel.app"));
      } catch (e) {
        console.error("catch-up e-mail failed:", e);
        status = "failed";
      }
      await ctx.runMutation(internal.checker.markEmailed, { alertIds: mail.alertIds, status });
    }
  },
});

export const emailRecipient = internalQuery({
  args: { watchId: v.id("watches") },
  handler: async (ctx, { watchId }) => {
    const watch = await ctx.db.get(watchId);
    const user = watch && await ctx.db.get(watch.userId);
    return user?.email ?? null;
  },
});

export const run = internalAction({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = true }): Promise<{ planId: Id<"catchupPlans">;
    preview: { userEmail: string; watchLabel: string;
      listings: { score: number; title: string; price: number | null; url: string }[] }[] }> => {
    if (!dryRun) throw new Error("Send a saved catch-up plan with catchup:send.");
    const groups = await ctx.runQuery(internal.catchup.groups, {});
    const api = process.env.WATCHER_API_URL, secret = process.env.CRON_SECRET;
    if (groups.length && (!api || !secret)) throw new Error("WATCHER_API_URL / CRON_SECRET are not set in Convex.");
    const runId = crypto.randomUUID();
    const preview: { userEmail: string; watchLabel: string;
      listings: { score: number; title: string; price: number | null; url: string }[] }[] = [];
    const items: { watchId: Id<"watches">; userId: Id<"users">; listingId: string; title: string;
      url: string; priceEur?: number; score: number }[] = [];
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
      })) });
      for (const mail of mails) {
        preview.push({ userEmail: mail.userEmail, watchLabel: mail.watchLabel, listings: mail.listings });
        items.push(...mail.items);
      }
    }
    const planId = await ctx.runMutation(internal.catchup.planFromItems, { items });
    return { planId, preview };
  },
});
