// Keep dashboard reads bounded as the AI call ledger grows. One summary per user and UTC month.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

export const monthStart = (at: number) => Date.UTC(new Date(at).getUTCFullYear(), new Date(at).getUTCMonth(), 1);
export const nextMonth = (start: number) => Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth() + 1, 1);

export async function addToMonthly(ctx: MutationCtx, row: Doc<"aiSpend">) {
  const month = monthStart(row.at);
  const old = await ctx.db.query("aiSpendMonthly").withIndex("by_user_month", (q) => q.eq("userId", row.userId).eq("monthStart", month)).unique();
  const kinds = { ...(old?.kinds ?? {}) } as Record<string, number>;
  const days = { ...(old?.days ?? {}) } as Record<string, number>;
  const dailyKinds = { ...(old?.dailyKinds ?? {}) } as Record<string, Record<string, number>>;
  const day = new Date(row.at).toISOString().slice(0, 10);
  kinds[row.kind] = (kinds[row.kind] ?? 0) + row.costEur;
  days[day] = (days[day] ?? 0) + row.costEur;
  const daily = { ...(dailyKinds[day] ?? {}) };
  daily[row.kind] = (daily[row.kind] ?? 0) + row.costEur;
  dailyKinds[day] = daily;
  const update = { totalEur: (old?.totalEur ?? 0) + row.costEur, kinds, days, dailyKinds };
  if (old) await ctx.db.patch(old._id, update);
  else await ctx.db.insert("aiSpendMonthly", { monthStart: month, userId: row.userId, ...update });
}

export const backfillPage = internalQuery({ args: { monthStart: v.number(), cursor: v.optional(v.string()) }, handler: async (ctx, args) => {
  const page = await ctx.db.query("aiSpend").withIndex("by_at", (q) => q.gte("at", args.monthStart).lt("at", nextMonth(args.monthStart)))
    .paginate({ cursor: args.cursor ?? null, numItems: 100 });
  return { ids: page.page.filter((r) => !r.rolledUp).map((r) => r._id), cursor: page.continueCursor, done: page.isDone };
} });

export const backfillRow = internalMutation({ args: { id: v.id("aiSpend") }, handler: async (ctx, { id }) => {
  const row = await ctx.db.get(id);
  if (!row || row.rolledUp) return;
  await addToMonthly(ctx, row);
  await ctx.db.patch(id, { rolledUp: true });
} });

export const markBackfilled = internalMutation({ args: { monthStart: v.number() }, handler: async (ctx, { monthStart: month }) => {
  if (!await ctx.db.query("aiSpendBackfills").withIndex("by_month", (q) => q.eq("monthStart", month)).unique())
    await ctx.db.insert("aiSpendBackfills", { monthStart: month, completedAt: Date.now() });
} });

export const needsBackfill = internalQuery({ args: { monthStart: v.number() }, handler: async (ctx, { monthStart: month }) =>
  !await ctx.db.query("aiSpendBackfills").withIndex("by_month", (q) => q.eq("monthStart", month)).unique() });

export const backfill = internalAction({ args: {}, handler: async (ctx) => {
  const month = monthStart(Date.now());
  if (!await ctx.runQuery(internal.spendRollup.needsBackfill, { monthStart: month })) return;
  let cursor: string | undefined;
  do {
    const page = await ctx.runQuery(internal.spendRollup.backfillPage, { monthStart: month, cursor });
    for (const id of page.ids as Id<"aiSpend">[]) await ctx.runMutation(internal.spendRollup.backfillRow, { id });
    cursor = page.done ? undefined : page.cursor;
    if (page.done) break;
  } while (cursor);
  await ctx.runMutation(internal.spendRollup.markBackfilled, { monthStart: month });
} });
