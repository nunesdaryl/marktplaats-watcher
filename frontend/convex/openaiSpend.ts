// Owner-only monthly OpenAI costs. App prices are estimates in EUR; the Costs API reports USD.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { isOwner } from "./admin";
import { sendEmail } from "./checker";
import { monthStart, nextMonth } from "./spendRollup";

const USD_TO_EUR = 0.92; // Same approximate conversion as evals/common.py.
type SpendRow = { userId: string; kind: string; watchId?: string; chatId?: string;
  costEur: number; at: number; callId?: string; checkId?: string; alertsSent?: number; listingsScored?: number };

export function summarizeSpend(rows: SpendRow[]) {
  const kinds: Record<string, number> = {};
  const days: Record<string, number> = {};
  const dailyKinds: Record<string, Record<string, number>> = {};
  const users: Record<string, { totalEur: number; kinds: Record<string, number> }> = {};
  const watches: Record<string, { totalEur: number; checks: number; listingsScored: number; alertsSent: number; costPerAlertEur: number }> = {};
  const chats: Record<string, { totalEur: number; questions: number; costPerQuestionEur: number }> = {};
  const questionCosts: Record<string, { chatId: string; at: number; totalEur: number }> = {};
  const questions = new Set<string>();
  const checks = new Set<string>();
  let totalEur = 0;
  for (const row of rows) {
    totalEur += row.costEur;
    kinds[row.kind] = (kinds[row.kind] ?? 0) + row.costEur;
    const day = new Date(row.at).toISOString().slice(0, 10);
    days[day] = (days[day] ?? 0) + row.costEur;
    const daily = dailyKinds[day] ??= {};
    daily[row.kind] = (daily[row.kind] ?? 0) + row.costEur;
    const user = users[row.userId] ??= { totalEur: 0, kinds: {} };
    user.totalEur += row.costEur;
    user.kinds[row.kind] = (user.kinds[row.kind] ?? 0) + row.costEur;
    if (row.watchId && row.kind === "watch") {
      const watch = watches[row.watchId] ??= { totalEur: 0, checks: 0, listingsScored: 0, alertsSent: 0, costPerAlertEur: 0 };
      watch.totalEur += row.costEur;
      const check = `${row.watchId}:${row.checkId ?? row.callId ?? `${row.at}:${watch.checks}`}`;
      if (!checks.has(check)) { checks.add(check); watch.checks++; }
      watch.listingsScored += row.listingsScored ?? 0;
      watch.alertsSent += row.alertsSent ?? 0;
      watch.costPerAlertEur = watch.alertsSent ? watch.totalEur / watch.alertsSent : 0;
    }
    if (row.chatId && row.kind === "chat") {
      const chat = chats[row.chatId] ??= { totalEur: 0, questions: 0, costPerQuestionEur: 0 };
      chat.totalEur += row.costEur;
      const question = `${row.chatId}:${row.callId?.replace(/\.\d+$/, "") ?? `${row.at}:${chat.questions}`}`;
      if (!questions.has(question)) { questions.add(question); chat.questions++; }
      const entry = questionCosts[question] ??= { chatId: row.chatId, at: row.at, totalEur: 0 };
      entry.totalEur += row.costEur;
      chat.costPerQuestionEur = chat.totalEur / chat.questions;
    }
  }
  return { totalEur, kinds, days, dailyKinds, users, watches, chats, questionCosts };
}

export function parseCostsPage(page: any): { totalUsd: number; nextPage: string | null } {
  if (!Array.isArray(page?.data) || typeof page.has_more !== "boolean") throw new Error("Invalid Costs response");
  let totalUsd = 0;
  for (const bucket of page.data) {
    if (!Array.isArray(bucket.results)) throw new Error("Invalid Costs bucket");
    for (const result of bucket.results) {
      if (result.amount?.currency?.toLowerCase() !== "usd") throw new Error("Unexpected Costs currency");
      if (!Number.isFinite(result.amount.value) || result.amount.value < 0) throw new Error("Invalid Costs amount");
      totalUsd += result.amount.value;
    }
  }
  if (page.has_more && typeof page.next_page !== "string") throw new Error("Missing Costs page cursor");
  return { totalUsd, nextPage: page.has_more ? page.next_page : null };
}

export const month = query({ args: { userId: v.optional(v.id("users")), watchId: v.optional(v.id("watches")),
  kind: v.optional(v.string()), since: v.optional(v.number()), until: v.optional(v.number()) }, handler: async (ctx, filters) => {
  if (!(await isOwner(ctx))) return null;
  const start = monthStart(Date.now());
  const selectedUser = filters.userId ?? (filters.watchId ? (await ctx.db.get(filters.watchId))?.userId : undefined);
  const backfillPending = !await ctx.db.query("aiSpendBackfills").withIndex("by_month", (q) => q.eq("monthStart", start)).unique();
  let summary: ReturnType<typeof summarizeSpend>;
  if (selectedUser) {
    const rows = (await ctx.db.query("aiSpend").withIndex("by_user_at", (q) => q.eq("userId", selectedUser)
      .gte("at", start).lt("at", nextMonth(start))).collect())
      .filter((r) => (!filters.watchId || r.watchId === filters.watchId) && (!filters.kind || r.kind === filters.kind)
        && (!filters.since || r.at >= filters.since) && (!filters.until || r.at < filters.until));
    summary = summarizeSpend(rows);
  } else {
    const monthly = await ctx.db.query("aiSpendMonthly").withIndex("by_month", (q) => q.eq("monthStart", start)).collect();
    summary = summarizeSpend([]);
    for (const row of monthly) {
      for (const [day, kinds] of Object.entries(row.dailyKinds as Record<string, Record<string, number>>)) {
        const time = Date.parse(`${day}T00:00:00Z`);
        if ((filters.since && time < filters.since) || (filters.until && time >= filters.until)) continue;
        const daily = summary.dailyKinds[day] ??= {};
        for (const [kind, amount] of Object.entries(kinds)) {
          if (filters.kind && kind !== filters.kind) continue;
          daily[kind] = (daily[kind] ?? 0) + amount;
          summary.kinds[kind] = (summary.kinds[kind] ?? 0) + amount;
          summary.days[day] = (summary.days[day] ?? 0) + amount;
          summary.totalEur += amount;
          const user = summary.users[row.userId] ??= { totalEur: 0, kinds: {} };
          user.totalEur += amount;
          user.kinds[kind] = (user.kinds[kind] ?? 0) + amount;
        }
      }
    }
    // A first deployment can have old MW-86 rows before the hourly backfill has run.
    if (backfillPending) {
      const legacy = (await ctx.db.query("aiSpend").withIndex("by_at", (q) => q.gte("at", start).lt("at", nextMonth(start))).take(1001))
        .filter((r) => !r.rolledUp && (!filters.kind || r.kind === filters.kind)
          && (!filters.since || r.at >= filters.since) && (!filters.until || r.at < filters.until));
      for (const row of legacy) {
        summary.totalEur += row.costEur;
        summary.kinds[row.kind] = (summary.kinds[row.kind] ?? 0) + row.costEur;
        const day = new Date(row.at).toISOString().slice(0, 10);
        summary.days[day] = (summary.days[day] ?? 0) + row.costEur;
        const daily = summary.dailyKinds[day] ??= {};
        daily[row.kind] = (daily[row.kind] ?? 0) + row.costEur;
        const user = summary.users[row.userId] ??= { totalEur: 0, kinds: {} };
        user.totalEur += row.costEur;
        user.kinds[row.kind] = (user.kinds[row.kind] ?? 0) + row.costEur;
      }
    }
  }
  const users = await Promise.all(Object.keys(summary.users).map((id) => ctx.db.get(ctx.db.normalizeId("users", id)!)));
  const watches = await Promise.all(Object.keys(summary.watches).map((id) => ctx.db.get(ctx.db.normalizeId("watches", id)!)));
  const chats = await Promise.all(Object.keys(summary.chats).map((id) => ctx.db.get(ctx.db.normalizeId("chats", id)!)));
  const snapshot = await ctx.db.query("openaiCosts").withIndex("by_month", (q) => q.eq("monthStart", start)).unique();
  const cap = Number(process.env.OPENAI_MONTHLY_CAP_USD);
  return { ...summary, measuredEur: summary.totalEur, measuredUsd: summary.totalEur / USD_TO_EUR,
    backfillPending,
    capUsd: Number.isFinite(cap) && cap > 0 ? cap : null,
    connected: !!process.env.OPENAI_ADMIN_API_KEY?.trim(),
    billed: process.env.OPENAI_ADMIN_API_KEY?.trim() && snapshot ? { usd: snapshot.totalUsd, updatedAt: snapshot.updatedAt } : null,
    userLabels: Object.fromEntries(users.filter((u) => u !== null).map((u) => [u._id, { email: u.email, limitEur: u.aiBudgetEur ?? 1 }])),
    watchLabels: Object.fromEntries(watches.filter((w) => w !== null).map((w) => [w._id, { title: w.name ?? w.label, userId: w.userId }])),
    chatLabels: Object.fromEntries(chats.filter((c) => c !== null).map((c) => [c._id, { title: c.title, userId: c.userId }])),
  };
} });

export const saveCosts = internalMutation({ args: { monthStart: v.number(), totalUsd: v.number(), updatedAt: v.number() },
  handler: async (ctx, args) => {
    const old = await ctx.db.query("openaiCosts").withIndex("by_month", (q) => q.eq("monthStart", args.monthStart)).unique();
    if (old) await ctx.db.patch(old._id, { totalUsd: args.totalUsd, updatedAt: args.updatedAt });
    else await ctx.db.insert("openaiCosts", args);
  } });

export const measuredTotal = internalQuery({ args: { monthStart: v.number() }, handler: async (ctx, { monthStart: start }) => {
  const rows = await ctx.db.query("aiSpendMonthly").withIndex("by_month", (q) => q.eq("monthStart", start)).collect();
  return rows.reduce((total, row) => total + row.totalEur, 0) / USD_TO_EUR;
} });

export const maybeAlert = internalMutation({ args: { monthStart: v.number(), spentUsd: v.number() }, handler: async (ctx, args) => {
    const cap = Number(process.env.OPENAI_MONTHLY_CAP_USD);
    if (Number.isFinite(cap) && cap > 0 && args.spentUsd >= cap * 0.8
      && !await ctx.db.query("openaiCapAlerts").withIndex("by_month", (q) => q.eq("monthStart", args.monthStart)).unique()) {
      await ctx.db.insert("openaiCapAlerts", { monthStart: args.monthStart, alertedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.openaiSpend.sendCapAlert, { spentUsd: args.spentUsd, capUsd: cap });
    }
  } });

export const sendCapAlert = internalAction({ args: { spentUsd: v.number(), capUsd: v.number() }, handler: async (_ctx, args) => {
  const email = process.env.OWNER_EMAIL?.trim();
  if (!email) return;
  const text = `OpenAI billed $${args.spentUsd.toFixed(2)} of your $${args.capUsd.toFixed(2)} monthly cap. Check your OpenAI billing settings.`;
  await sendEmail(email, { subject: "OpenAI spend reached 80% of your monthly cap", text, html: `<p>${text}</p>` });
} });

export const refreshCosts = internalAction({ args: {}, handler: async (ctx) => {
  await ctx.runAction(internal.spendRollup.backfill, {});
  const key = process.env.OPENAI_ADMIN_API_KEY?.trim();
  const start = monthStart(Date.now());
  if (!key) {
    const measuredUsd = await ctx.runQuery(internal.openaiSpend.measuredTotal, { monthStart: start });
    await ctx.runMutation(internal.openaiSpend.maybeAlert, { monthStart: start, spentUsd: measuredUsd });
    return;
  }
  let cursor: string | null = null;
  const seen = new Set<string>();
  let totalUsd = 0;
  do {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(start / 1000));
    url.searchParams.set("end_time", String(Math.floor(Date.now() / 1000)));
    url.searchParams.set("limit", "180");
    // The Costs API is organisation-wide; the $ cap is per project, so count only this project when it is configured.
    const project = process.env.OPENAI_PROJECT_ID?.trim();
    if (project) url.searchParams.append("project_ids", project);
    if (cursor) url.searchParams.set("page", cursor);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`OpenAI Costs request failed (${response.status})`);
    const page = parseCostsPage(await response.json());
    totalUsd += page.totalUsd;
    cursor = page.nextPage;
    if (cursor) {
      if (seen.has(cursor)) throw new Error("OpenAI Costs repeated a page cursor");
      seen.add(cursor);
    }
  } while (cursor);
  await ctx.runMutation(internal.openaiSpend.saveCosts, { monthStart: start, totalUsd, updatedAt: Date.now() });
  await ctx.runMutation(internal.openaiSpend.maybeAlert, { monthStart: start, spentUsd: totalUsd });
} });
