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

export function parseKeyCostsPage(page: any): { byId: Record<string, number>; nextPage: string | null } {
  const parsed = parseCostsPage(page);
  const byId: Record<string, number> = {};
  for (const bucket of page.data) for (const result of bucket.results) {
    const id = typeof result.api_key_id === "string" ? result.api_key_id : "";
    byId[id] = (byId[id] ?? 0) + result.amount.value;
  }
  return { byId, nextPage: parsed.nextPage };
}

export function groupKeyCosts(byId: Record<string, number>, names: Record<string, string>) {
  const byName: Record<string, number> = {};
  for (const [id, usd] of Object.entries(byId)) {
    const name = names[id] || "unnamed key";
    byName[name] = (byName[name] ?? 0) + usd;
  }
  return Object.entries(byName).map(([name, usd]) => ({ name, usd })).sort((a, b) => b.usd - a.usd);
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
    billed: process.env.OPENAI_ADMIN_API_KEY?.trim() && snapshot ? { usd: snapshot.totalUsd, updatedAt: snapshot.updatedAt,
      byKey: snapshot.byKey ?? [], projectUsd: snapshot.projectUsd ?? null } : null,
    userLabels: Object.fromEntries(users.filter((u) => u !== null).map((u) => [u._id, { email: u.email, limitEur: u.aiBudgetEur ?? 1 }])),
    watchLabels: Object.fromEntries(watches.filter((w) => w !== null).map((w) => [w._id, { title: w.name ?? w.label, userId: w.userId }])),
    chatLabels: Object.fromEntries(chats.filter((c) => c !== null).map((c) => [c._id, { title: c.title, userId: c.userId }])),
  };
} });

export const saveCosts = internalMutation({ args: { monthStart: v.number(), totalUsd: v.number(), updatedAt: v.number(),
  byKey: v.array(v.object({ name: v.string(), usd: v.number() })), projectUsd: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const old = await ctx.db.query("openaiCosts").withIndex("by_month", (q) => q.eq("monthStart", args.monthStart)).unique();
    if (old) await ctx.db.patch(old._id, args);
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

const accountFailure = v.union(v.literal("credit_exhausted"), v.literal("spend_cap"), v.literal("auth"));
export const incident = query({ args: {}, handler: async (ctx) => {
  if (!(await isOwner(ctx))) return null;
  const row = await ctx.db.query("openaiIncident").withIndex("by_key", (q) => q.eq("key", "account")).unique();
  return row?.failureKind ?? null;
} });

export const recordAiStatus = internalMutation({ args: { failureKind: v.optional(accountFailure) },
  handler: async (ctx, { failureKind }) => {
    const row = await ctx.db.query("openaiIncident").withIndex("by_key", (q) => q.eq("key", "account")).unique();
    const previous = row?.failureKind;
    if (failureKind) {
      if (row) await ctx.db.patch(row._id, { failureKind, updatedAt: Date.now() });
      else await ctx.db.insert("openaiIncident", { key: "account", failureKind, updatedAt: Date.now() });
      if (!previous) await ctx.scheduler.runAfter(0, internal.openaiSpend.sendIncidentEmail, { recovered: false, failureKind });
    } else if (previous) {
      await ctx.db.patch(row!._id, { failureKind: undefined, updatedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.openaiSpend.sendIncidentEmail, { recovered: true, failureKind: previous as "credit_exhausted" | "spend_cap" | "auth" });
    }
  } });

export const sendIncidentEmail = internalAction({ args: { recovered: v.boolean(), failureKind: accountFailure },
  handler: async (_ctx, { recovered, failureKind }) => {
    const email = process.env.OWNER_EMAIL?.trim();
    if (!email) return;
    const cause = { credit_exhausted: "OpenAI credit is empty", spend_cap: "OpenAI spending limit was reached",
      auth: "OpenAI account authentication failed" }[failureKind];
    const text = recovered ? `OpenAI is working again. Checks and chat can score normally. Previous issue: ${cause}.`
      : `${cause}. Checks and chat cannot score until the account is fixed. Check https://platform.openai.com/settings/organization/billing/overview`;
    await sendEmail(email, { subject: recovered ? "OpenAI recovered" : `Action needed: ${cause}`,
      text, html: `<p>${text}</p>` });
  } });

async function costPages(key: string, start: number, groupByKey: boolean, project?: string, end = Date.now(), daily = false) {
  let cursor: string | null = null;
  const seen = new Set<string>();
  let totalUsd = 0;
  const byId: Record<string, number> = {};
  const byDayId: Record<string, Record<string, number>> = {};
  do {
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(start / 1000));
    url.searchParams.set("end_time", String(Math.floor(end / 1000)));
    url.searchParams.set("limit", "180");
    if (groupByKey) url.searchParams.append("group_by", "api_key_id");
    if (project) url.searchParams.append("project_ids", project);
    if (cursor) url.searchParams.set("page", cursor);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`OpenAI Costs request failed (${response.status})`);
    const page = await response.json();
    const parsed = groupByKey ? parseKeyCostsPage(page) : parseCostsPage(page);
    if (groupByKey) for (const [id, usd] of Object.entries((parsed as ReturnType<typeof parseKeyCostsPage>).byId))
      byId[id] = (byId[id] ?? 0) + usd;
    else totalUsd += (parsed as ReturnType<typeof parseCostsPage>).totalUsd;
    if (daily) for (const bucket of page.data) {
      if (!Number.isSafeInteger(bucket.start_time)) throw new Error("Invalid Costs bucket time");
      const day = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
      const daily = byDayId[day] ??= {};
      for (const result of bucket.results) if (typeof result.api_key_id === "string")
        daily[result.api_key_id] = (daily[result.api_key_id] ?? 0) + result.amount.value;
    }
    cursor = parsed.nextPage;
    if (cursor) {
      if (seen.has(cursor)) throw new Error("OpenAI Costs repeated a page cursor");
      seen.add(cursor);
    }
  } while (cursor);
  return { totalUsd, byId, byDayId };
}

type UsageTotal = { model: string; inputTokens: number; cachedInputTokens: number; outputTokens: number; requests: number };
type UsageByDay = Record<string, UsageTotal[]>;

async function usagePages(key: string, kind: "completions" | "embeddings", start: number, end: number, appKeyId: string): Promise<UsageByDay> {
  const days: Record<string, Record<string, UsageTotal>> = {};
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const url = new URL(`https://api.openai.com/v1/organization/usage/${kind}`);
    url.searchParams.set("start_time", String(Math.floor(start / 1000)));
    url.searchParams.set("end_time", String(Math.floor(end / 1000)));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "31");
    url.searchParams.append("group_by", "api_key_id");
    url.searchParams.append("group_by", "model");
    if (cursor) url.searchParams.set("page", cursor);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`OpenAI ${kind} usage request failed (${response.status})`);
    const page = await response.json();
    if (!Array.isArray(page?.data) || typeof page.has_more !== "boolean") throw new Error(`Invalid OpenAI ${kind} usage response`);
    for (const bucket of page.data) {
      if (!Number.isSafeInteger(bucket.start_time) || !Array.isArray(bucket.results)) throw new Error(`Invalid OpenAI ${kind} usage bucket`);
      const day = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
      for (const result of bucket.results) {
        if (result.api_key_id !== appKeyId) continue;
        const model = typeof result.model === "string" ? result.model : "unknown model";
        const values = [result.input_tokens, result.input_cached_tokens ?? 0, result.output_tokens ?? 0, result.num_model_requests];
        if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error(`Invalid OpenAI ${kind} usage count`);
        const daily = days[day] ??= {};
        const total = daily[model] ??= { model, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, requests: 0 };
        total.inputTokens += values[0];
        total.cachedInputTokens += values[1];
        total.outputTokens += values[2];
        total.requests += values[3];
      }
    }
    cursor = page.has_more ? page.next_page : null;
    if (page.has_more && (typeof cursor !== "string" || seen.has(cursor))) throw new Error(`Invalid OpenAI ${kind} usage cursor`);
    if (cursor) seen.add(cursor);
  } while (cursor);
  return Object.fromEntries(Object.entries(days).map(([day, models]) => [day, Object.values(models).sort((a, b) => a.model.localeCompare(b.model))]));
}

async function keyNames(key: string): Promise<Record<string, string>> {
  const headers = { Authorization: `Bearer ${key}` };
  const names: Record<string, string> = {};
  let after: string | null = null;
  do {
    const url = new URL("https://api.openai.com/v1/organization/projects");
    url.searchParams.set("limit", "100");
    url.searchParams.set("include_archived", "true");
    if (after) url.searchParams.set("after", after);
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`OpenAI projects request failed (${response.status})`);
    const page = await response.json();
    if (!Array.isArray(page.data) || typeof page.has_more !== "boolean") throw new Error("Invalid OpenAI projects response");
    for (const project of page.data) {
      if (typeof project.id !== "string") continue;
      let keyAfter: string | null = null;
      do {
        const keysUrl = new URL(`https://api.openai.com/v1/organization/projects/${encodeURIComponent(project.id)}/api_keys`);
        keysUrl.searchParams.set("limit", "100");
        keysUrl.searchParams.set("owner_project_access", "any");
        if (keyAfter) keysUrl.searchParams.set("after", keyAfter);
        const keysResponse = await fetch(keysUrl, { headers });
        if (!keysResponse.ok) throw new Error(`OpenAI project keys request failed (${keysResponse.status})`);
        const keysPage = await keysResponse.json();
        if (!Array.isArray(keysPage.data) || typeof keysPage.has_more !== "boolean") throw new Error("Invalid OpenAI project keys response");
        for (const item of keysPage.data) if (typeof item.id === "string" && typeof item.name === "string") names[item.id] = item.name;
        keyAfter = keysPage.has_more ? keysPage.data.at(-1)?.id : null;
        if (keysPage.has_more && !keyAfter) throw new Error("Missing OpenAI project keys cursor");
      } while (keyAfter);
    }
    after = page.has_more ? page.data.at(-1)?.id : null;
    if (page.has_more && !after) throw new Error("Missing OpenAI projects cursor");
  } while (after);
  return names;
}

// Pass only spend fields to the action; user ids and other ledger identifiers never enter its output.
export const reconciliationLedgerPage = internalQuery({ args: { start: v.number(), end: v.number(), cursor: v.optional(v.string()) },
  handler: async (ctx, { start, end, cursor }) => {
    const page = await ctx.db.query("aiSpend").withIndex("by_at", (q) => q.gte("at", start).lt("at", end))
      .paginate({ cursor: cursor ?? null, numItems: 100 });
    return { rows: page.page.map((row) => ({ date: new Date(row.at).toISOString().slice(0, 10), kind: row.kind,
      model: row.model ?? "unknown model",
      inputTokens: row.inputTokens, outputTokens: row.outputTokens, costEur: row.costEur })),
      cursor: page.continueCursor, done: page.isDone };
  } });

/** Compare request-scoped check counters with the watch charges for those requests. */
export const checkGap = internalQuery({ args: { day: v.string() }, handler: async (ctx, { day }) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day)
    throw new Error("day must be a UTC date (YYYY-MM-DD)");
  const rows = await ctx.db.query("openaiCalls").withIndex("by_day", (q) => q.eq("day", day)).collect();
  const counted = new Map<string, number>();
  for (const row of rows) if (row.route === "/api/internal/check" && row.requestId)
    counted.set(row.requestId, (counted.get(row.requestId) ?? 0) + row.requests);
  const gaps = [];
  for (const [requestId, countedCalls] of counted) {
    const prefix = `${requestId}.`;
    const charges = await ctx.db.query("aiSpend").withIndex("by_check", (q) =>
      q.gte("checkId", prefix).lt("checkId", `${requestId}/`)).collect();
    const watchRows = charges.filter((row) => row.kind === "watch" && row.checkId?.startsWith(prefix)).length;
    if (countedCalls !== watchRows) gaps.push({ requestId, countedCalls, watchRows });
  }
  return gaps;
} });

export const reconciliationRollup = internalQuery({ args: { monthStart: v.number() }, handler: async (ctx, { monthStart: start }) => {
  const rows = await ctx.db.query("aiSpendMonthly").withIndex("by_month", (q) => q.eq("monthStart", start)).collect();
  const byDay: Record<string, number> = {};
  for (const row of rows) for (const [day, eur] of Object.entries(row.days as Record<string, number>))
    byDay[day] = (byDay[day] ?? 0) + eur;
  return byDay;
} });

export const reconcile = internalAction({ args: { days: v.number() }, handler: async (ctx, { days }) => {
  if (!Number.isSafeInteger(days) || days < 1 || days > 31) throw new Error("days must be an integer from 1 to 31");
  const key = process.env.OPENAI_ADMIN_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_ADMIN_API_KEY is not configured");
  const names = await keyNames(key);
  const appKeyIds = Object.keys(names).filter((id) => names[id] === "marktplaats-watcher-app");
  if (appKeyIds.length !== 1) throw new Error("Expected exactly one marktplaats-watcher-app key name");
  const appKeyId = appKeyIds[0];
  const today = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const start = today - (days - 1) * 86_400_000;
  const end = Date.now();
  const [completions, embeddings, costs] = await Promise.all([
    usagePages(key, "completions", start, end, appKeyId),
    usagePages(key, "embeddings", start, end, appKeyId),
    costPages(key, start, true, undefined, end, true),
  ]);
  type LedgerTotal = { inputTokens: number; outputTokens: number; costEur: number; calls: number };
  const emptyTotal = (): LedgerTotal => ({ inputTokens: 0, outputTokens: 0, costEur: 0, calls: 0 });
  const ledger: Record<string, LedgerTotal & { callsByKind: Record<string, number>;
    byKind: Record<string, LedgerTotal>; byModel: Record<string, LedgerTotal> }> = {};
  let cursor: string | undefined;
  do {
    const page = await ctx.runQuery(internal.openaiSpend.reconciliationLedgerPage, { start, end, cursor });
    for (const row of page.rows) {
      const day = ledger[row.date] ??= { ...emptyTotal(), callsByKind: {}, byKind: {}, byModel: {} };
      for (const total of [day, day.byKind[row.kind] ??= emptyTotal(), day.byModel[row.model] ??= emptyTotal()]) {
        total.inputTokens += row.inputTokens;
        total.outputTokens += row.outputTokens;
        total.costEur += row.costEur;
        total.calls++;
      }
      day.callsByKind[row.kind] = (day.callsByKind[row.kind] ?? 0) + 1;
    }
    cursor = page.done ? undefined : page.cursor;
    if (page.done) break;
  } while (cursor);
  const rollups: Record<string, number> = {};
  for (let month = monthStart(start); month < end; month = nextMonth(month)) {
    const monthly = await ctx.runQuery(internal.openaiSpend.reconciliationRollup, { monthStart: month });
    for (const [day, eur] of Object.entries(monthly)) rollups[day] = (rollups[day] ?? 0) + eur;
  }
  return { keyName: names[appKeyId], days: Array.from({ length: days }, (_, index) => {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    return { date, billedUsd: costs.byDayId[date]?.[appKeyId] ?? 0,
      usage: { completions: completions[date] ?? [], embeddings: embeddings[date] ?? [] },
      ledger: { ...(ledger[date] ?? { ...emptyTotal(), callsByKind: {}, byKind: {}, byModel: {} }),
        rollupEur: rollups[date] ?? 0 } };
  }) };
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
  const project = process.env.OPENAI_PROJECT_ID?.trim();
  const { totalUsd } = await costPages(key, start, false);
  const { byId } = await costPages(key, start, true);
  const projectUsd = project ? (await costPages(key, start, false, project)).totalUsd : undefined;
  // Key names are a nicety: if the admin key cannot list projects, still store the amounts under "unnamed key".
  let names: Record<string, string> = {};
  try { names = await keyNames(key); } catch (error) { console.warn("OpenAI key names unavailable", String(error).slice(0, 200)); }
  const byKey = groupKeyCosts(byId, names);
  await ctx.runMutation(internal.openaiSpend.saveCosts, { monthStart: start, totalUsd, byKey, projectUsd, updatedAt: Date.now() });
  await ctx.runMutation(internal.openaiSpend.maybeAlert, { monthStart: start, spentUsd: totalUsd });
} });
