import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const DAY = 86_400_000;
const vectorValidator = v.array(v.float64());

export async function deleteAlertEmbedding(ctx: MutationCtx, alertId: Id<"alerts">) {
  for (const row of await ctx.db.query("alertEmbeddings").withIndex("by_alert", (q) => q.eq("alertId", alertId)).collect())
    await ctx.db.delete(row._id);
}

export const pending = internalQuery({
  args: { alertIds: v.array(v.id("alerts")) },
  handler: async (ctx, { alertIds }) => {
    const rows = [];
    for (const id of alertIds) {
      const alert = await ctx.db.get(id);
      if (!alert || await ctx.db.query("alertEmbeddings").withIndex("by_alert", (q) => q.eq("alertId", id)).first()) continue;
      rows.push({ alertId: id, userId: alert.userId,
        text: `${alert.title} · €${alert.priceEur ?? "?"} · ${alert.score ?? "?"}/10 · ${alert.reason}` });
    }
    return rows;
  },
});

export const save = internalMutation({
  args: { rows: v.array(v.object({ alertId: v.id("alerts"), embedding: vectorValidator, text: v.string(), model: v.string() })) },
  handler: async (ctx, { rows }) => {
    for (const row of rows) {
      if (row.embedding.length !== 1536 || row.embedding.some((x) => !Number.isFinite(x))) throw new Error("Invalid embedding vector");
      const alert = await ctx.db.get(row.alertId);
      if (!alert || await ctx.db.query("alertEmbeddings").withIndex("by_alert", (q) => q.eq("alertId", row.alertId)).first()) continue;
      await ctx.db.insert("alertEmbeddings", { ...row, userId: alert.userId, createdAt: Date.now() });
    }
  },
});

export const embedAlerts = internalAction({
  args: { alertIds: v.array(v.id("alerts")) },
  handler: async (ctx, { alertIds }) => {
    try {
      for (let start = 0; start < alertIds.length; start += 100) {
        const rows = await ctx.runQuery(internal.embeddings.pending, { alertIds: alertIds.slice(start, start + 100) });
        if (!rows.length) continue;
        const base = process.env.WATCHER_API_URL, secret = process.env.CRON_SECRET;
        if (!base || !secret) throw new Error("Embedding service is not configured");
        const response = await fetch(`${base.replace(/\/$/, "")}/api/internal/embed`, {
          method: "POST", headers: { "Content-Type": "application/json", "X-Cron-Secret": secret },
          body: JSON.stringify({ texts: rows.map((row) => row.text) }),
        });
        if (!response.ok) throw new Error(`Embedding service returned ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload.vectors) || payload.vectors.length !== rows.length) throw new Error("Invalid embedding response");
        await ctx.runMutation(internal.embeddings.save, { rows: rows.map((row, index) => ({
          alertId: row.alertId, text: row.text, embedding: payload.vectors[index],
          model: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
        })) });
      }
    } catch (error) { console.error("Alert embedding failed; backfill can retry", error); }
  },
});

export const backfillPage = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("alerts").withIndex("by_createdAt", (q) => q.gte("createdAt", Date.now() - 30 * DAY))
      .paginate({ cursor: cursor ?? null, numItems: 100 });
    const missing = [];
    for (const alert of page.page)
      if (!await ctx.db.query("alertEmbeddings").withIndex("by_alert", (q) => q.eq("alertId", alert._id)).first()) missing.push(alert._id);
    return { ids: missing, cursor: page.continueCursor, done: page.isDone };
  },
});

export const backfill = internalAction({
  args: { dryRun: v.boolean() },
  handler: async (ctx, { dryRun }) => {
    let cursor: string | undefined, count = 0;
    do {
      const page = await ctx.runQuery(internal.embeddings.backfillPage, { cursor });
      count += page.ids.length;
      if (!dryRun && page.ids.length) await ctx.runAction(internal.embeddings.embedAlerts, { alertIds: page.ids });
      cursor = page.done ? undefined : page.cursor;
      if (page.done) break;
    } while (cursor);
    return { missing: count, dryRun };
  },
});

export const user = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => (await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique())?._id ?? null,
});

export const keyword = internalQuery({
  args: { userId: v.id("users"), query: v.string(), limit: v.number() },
  handler: async (ctx, { userId, query, limit }) => {
    if (!query.trim()) return [];
    const tokens = query.match(/[\p{L}\p{N}]+/gu) ?? [];
    const found = new Map<Id<"alertEmbeddings">, number>();
    for (const token of tokens.filter((word) => word.length >= 2).slice(0, 8)) {
      const rows = await ctx.db.query("alertEmbeddings").withSearchIndex("by_text", (q) => q.search("text", token).eq("userId", userId)).take(limit);
      for (const row of rows) found.set(row._id, (found.get(row._id) ?? 0) + 1);
    }
    return [...found].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, limit);
  },
});

export const hydrate = internalQuery({
  args: { userId: v.id("users"), ids: v.array(v.object({ id: v.id("alertEmbeddings"), score: v.number() })) },
  handler: async (ctx, { userId, ids }) => {
    const results = [];
    const seen = new Set<Id<"alerts">>();
    for (const { id, score } of ids) {
      const embedding = await ctx.db.get(id);
      if (!embedding || embedding.userId !== userId) continue;
      const alert = await ctx.db.get(embedding.alertId);
      if (!alert || alert.userId !== userId || seen.has(alert._id)) continue;
      seen.add(alert._id);
      const watch = await ctx.db.get(alert.watchId);
      const rating = await ctx.db.query("ratings").withIndex("by_alert", (q) => q.eq("alertId", alert._id)).first();
      results.push({ alertId: alert._id, score, title: alert.title, priceEur: alert.priceEur ?? null,
        score10: alert.score ?? null, reason: alert.reason, url: alert.url, image: alert.image ?? null,
        createdAt: alert.createdAt, watchLabel: watch?.name ?? watch?.label ?? null,
        rating: rating && rating.userId === userId ? { verdict: rating.verdict, reasons: rating.reasons ?? [] } : null });
    }
    return results;
  },
});

type SearchResult = { alertId: Id<"alerts">; score: number; title: string; priceEur: number | null;
  score10: number | null; reason: string; url: string; image: string | null; createdAt: number;
  watchLabel: string | null; rating: { verdict: "good" | "not_right"; reasons: string[] } | null };

export const search = internalAction({
  args: { clerkId: v.string(), vector: vectorValidator, query: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, { clerkId, vector, query, limit }): Promise<SearchResult[]> => {
    const userId = await ctx.runQuery(internal.embeddings.user, { clerkId });
    if (!userId) return [];
    const [similar, exact] = await Promise.all([
      ctx.vectorSearch("alertEmbeddings", "by_embedding", { vector, limit: Math.max(limit, 10), filter: (q) => q.eq("userId", userId) }),
      ctx.runQuery(internal.embeddings.keyword, { userId, query: query ?? "", limit }),
    ]);
    const ranked = new Map<Id<"alertEmbeddings">, number>();
    for (const id of exact) ranked.set(id, 1);
    for (const row of similar) if (!ranked.has(row._id)) ranked.set(row._id, row._score);
    return (await ctx.runQuery(internal.embeddings.hydrate, { userId,
      ids: [...ranked].map(([id, score]) => ({ id, score })) })).slice(0, limit);
  },
});

export const recent = internalQuery({
  args: { clerkId: v.string(), limit: v.number() },
  handler: async (ctx, { clerkId, limit }) => {
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
    if (!user) return [];
    const alerts = await ctx.db.query("alerts").withIndex("by_user_createdAt", (q) => q.eq("userId", user._id)).order("desc").take(limit);
    return Promise.all(alerts.map(async (alert) => {
      const watch = await ctx.db.get(alert.watchId);
      return { alertId: alert._id, title: alert.title, priceEur: alert.priceEur ?? null,
        score10: alert.score ?? null, reason: alert.reason, url: alert.url, image: alert.image ?? null,
        createdAt: alert.createdAt, watchLabel: watch?.name ?? watch?.label ?? null };
    }));
  },
});

export const activity = internalQuery({
  args: { clerkId: v.string(), watchId: v.optional(v.id("watches")), from: v.number(), to: v.number(), limit: v.number() },
  handler: async (ctx, { clerkId, watchId, from, to, limit }) => {
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
    if (!user) return { total: 0, alerts: [] };
    const all = await ctx.db.query("alerts").withIndex("by_user_createdAt", (q) => q.eq("userId", user._id).gte("createdAt", from).lte("createdAt", to)).collect();
    const selected = all.filter((a) => !watchId || a.watchId === watchId);
    const alerts = await Promise.all(selected.slice(0, limit).map(async (alert) => {
      const watch = await ctx.db.get(alert.watchId);
      return { alertId: alert._id, title: alert.title, priceEur: alert.priceEur ?? null,
        score10: alert.score ?? null, reason: alert.reason, url: alert.url, image: alert.image ?? null,
        createdAt: alert.createdAt, watchLabel: watch?.name ?? watch?.label ?? null };
    }));
    return { total: selected.length, alerts };
  },
});

export const watchesMine = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
    if (!user) return [];
    return (await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect())
      .map((watch) => ({ watchId: watch._id, label: watch.name ?? watch.label, query: watch.query, active: watch.active }));
  },
});

export const evidence = internalQuery({
  args: { clerkId: v.string(), alertId: v.id("alerts") },
  handler: async (ctx, { clerkId, alertId }) => {
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
    const alert = await ctx.db.get(alertId);
    if (!user || !alert || alert.userId !== user._id) return null;
    const watch = await ctx.db.get(alert.watchId);
    const rating = await ctx.db.query("ratings").withIndex("by_alert", (q) => q.eq("alertId", alertId)).first();
    return { alertId, title: alert.title, priceEur: alert.priceEur ?? null, score10: alert.score ?? null,
      reason: alert.reason, url: alert.url, image: alert.image ?? null, createdAt: alert.createdAt,
      watchLabel: watch?.name ?? watch?.label ?? null,
      rating: rating?.userId === user._id ? { verdict: rating.verdict, reasons: rating.reasons ?? [] } : null };
  },
});
