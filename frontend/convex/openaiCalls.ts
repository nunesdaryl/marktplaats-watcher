// Content-free daily counts of app-key OpenAI calls, grouped by route and outcome.
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const record = v.object({
  day: v.string(), route: v.string(), env: v.string(), model: v.string(), ok: v.boolean(),
  error: v.union(v.string(), v.null()), requests: v.number(), inputTokens: v.number(), outputTokens: v.number(),
});

export const recordCalls = internalMutation({
  args: { records: v.array(record) },
  handler: async (ctx, { records }) => {
    for (const item of records) {
      const existing = await ctx.db.query("openaiCalls").withIndex("by_key", (q) => q
        .eq("day", item.day).eq("route", item.route).eq("env", item.env)
        .eq("model", item.model).eq("ok", item.ok).eq("error", item.error)).unique();
      if (existing) await ctx.db.patch(existing._id, {
        requests: existing.requests + item.requests,
        inputTokens: existing.inputTokens + item.inputTokens,
        outputTokens: existing.outputTokens + item.outputTokens,
      });
      else await ctx.db.insert("openaiCalls", item);
    }
  },
});

export const summary = internalQuery({
  args: { days: v.number() },
  handler: async (ctx, { days }) => {
    if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error("days must be 1–31");
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const result = [];
    for (let offset = days - 1; offset >= 0; offset--) {
      const day = new Date(today.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
      const rows = await ctx.db.query("openaiCalls").withIndex("by_day", (q) => q.eq("day", day)).collect();
      result.push({ day, requests: rows.reduce((sum, row) => sum + row.requests, 0),
        inputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
        outputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
        routes: rows.map(({ route, env, model, ok, error, requests, inputTokens, outputTokens }) =>
          ({ route, env, model, ok, error, requests, inputTokens, outputTokens })) });
    }
    return result;
  },
});

export const purge = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const old = await ctx.db.query("openaiCalls").withIndex("by_day", (q) => q.lt("day", cutoff)).take(500);
    for (const row of old) await ctx.db.delete(row._id);
    if (old.length === 500) await ctx.scheduler.runAfter(0, internal.openaiCalls.purge, {});
    return old.length;
  },
});
