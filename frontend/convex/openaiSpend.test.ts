import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { groupKeyCosts, parseCostsPage, parseKeyCostsPage, summarizeSpend } from "./openaiSpend";

const modules = import.meta.glob("./**/*.ts");

test("one account incident and one recovery are scheduled across repeated reports", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.openaiSpend.recordAiStatus, { failureKind: "credit_exhausted" });
  await t.mutation(internal.openaiSpend.recordAiStatus, { failureKind: "credit_exhausted" });
  expect(await t.withIdentity({ subject: "owner", email: "owner@example.com" }).query(api.openaiSpend.incident, {}))
    .toBe("credit_exhausted");
  await t.mutation(internal.openaiSpend.recordAiStatus, {});
  await t.mutation(internal.openaiSpend.recordAiStatus, {});
  expect(await t.withIdentity({ subject: "owner", email: "owner@example.com" }).query(api.openaiSpend.incident, {}))
    .toBeNull();
  const jobs = await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(jobs.filter((job) => job.name === "openaiSpend:sendIncidentEmail")).toHaveLength(2);
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
  process.env.OWNER_CLERK_ID = "owner";
  process.env.OWNER_EMAIL = "owner@example.com";
  process.env.OPENAI_MONTHLY_CAP_USD = "110";
});
afterEach(() => { vi.useRealTimers(); delete process.env.OPENAI_MONTHLY_CAP_USD; });

test("Costs pages sum USD buckets and reject a different currency", () => {
  expect(parseCostsPage({ data: [{ start_time: 1, results: [{ amount: { value: 2.1, currency: "usd" } },
    { amount: { value: 0.4, currency: "usd" } }] }], has_more: false })).toEqual({ totalUsd: 2.5, nextPage: null });
  expect(() => parseCostsPage({ data: [{ results: [{ amount: { value: 1, currency: "eur" } }] }], has_more: false }))
    .toThrow(/currency/i);
});

test("key costs group by name without exposing key values", () => {
  const parsed = parseKeyCostsPage({ data: [{ results: [
    { api_key_id: "key_app", amount: { value: 1, currency: "usd" } },
    { api_key_id: "key_app", amount: { value: 0.5, currency: "usd" } },
    { api_key_id: "key_missing", amount: { value: 2, currency: "usd" } },
  ] }], has_more: false });
  expect(groupKeyCosts(parsed.byId, { key_app: "marktplaats-watcher-app" })).toEqual([
    { name: "unnamed key", usd: 2 }, { name: "marktplaats-watcher-app", usd: 1.5 },
  ]);
});

test("ledger totals group by kind, user, watch and chat; cost per alert uses checks only", () => {
  const rows = [
    { userId: "u1", kind: "watch", watchId: "w1", costEur: 0.3, alertsSent: 2, listingsScored: 4, at: Date.parse("2026-10-10") },
    { userId: "u1", kind: "chat", chatId: "c1", callId: "question.0", costEur: 0.15, at: Date.parse("2026-10-10") },
    { userId: "u1", kind: "chat", chatId: "c1", callId: "question.1", costEur: 0.05, at: Date.parse("2026-10-10") },
    { userId: "u2", kind: "watch", watchId: "w1", costEur: 0.1, alertsSent: 0, listingsScored: 1, at: Date.parse("2026-10-11") },
    { userId: "u2", kind: "embedding", costEur: 0.05, at: Date.parse("2026-10-11") },
  ];
  const result = summarizeSpend(rows);
  expect(result.totalEur).toBeCloseTo(0.65);
  expect(result.kinds.watch).toBeCloseTo(0.4);
  expect(result.kinds.chat).toBeCloseTo(0.2);
  expect(result.users.u1.totalEur).toBeCloseTo(0.5);
  expect(result.watches.w1).toMatchObject({ checks: 2, listingsScored: 5, alertsSent: 2 });
  expect(result.watches.w1.costPerAlertEur).toBeCloseTo(0.2);
  expect(result.chats.c1).toMatchObject({ questions: 1, totalEur: 0.2 });
  expect(result.questionCosts["c1:question"].totalEur).toBeCloseTo(0.2);
  expect(result.dailyKinds["2026-10-10"].chat).toBeCloseTo(0.2);
});

test("only owner sees monthly spend and disconnected billing stays explicit", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  await alice.mutation(api.users.store, {});
  await t.mutation(internal.aiBudget.record, { clerkId: "alice", kind: "chat", callId: "one",
    model: "gpt-5.4-mini", inputTokens: 100, outputTokens: 50, costEur: 0.25 });
  expect(await alice.query(api.openaiSpend.month, {})).toBeNull();
  expect(await owner.query(api.openaiSpend.month, {})).toMatchObject({ measuredEur: 0.25,
    billed: null, capUsd: 110, connected: false });
});

test("an unset alert threshold is absent from the owner query", async () => {
  delete process.env.OPENAI_MONTHLY_CAP_USD;
  const t = convexTest(schema, modules);
  const month = await t.withIdentity({ subject: "owner", email: "owner@example.com" }).query(api.openaiSpend.month, {});
  expect(month?.capUsd).toBeNull();
});

test("owner monthly query groups seeded watch and chat ledger rows", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  await alice.mutation(api.users.store, {});
  const watchId = await alice.mutation(api.watches.create, { query: "bike", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const chatId = await alice.mutation(api.chats.start, { content: "Find a bike" });
  for (const [index, cost] of [0.3, 0.1].entries())
    await t.mutation(internal.aiBudget.record, { clerkId: "alice", kind: "watch", watchId,
      checkId: "run.watch", callId: `run.watch.${index}`, inputTokens: 100, outputTokens: 20,
      costEur: cost, alertsSent: index ? 0 : 2, listingsScored: index ? 0 : 5 });
  await t.mutation(internal.aiBudget.record, { clerkId: "alice", kind: "chat", chatId,
    callId: "question.0", inputTokens: 100, outputTokens: 20, costEur: 0.2 });
  const month = await owner.query(api.openaiSpend.month, {});
  expect(month?.kinds).toMatchObject({ watch: 0.4, chat: 0.2 });
  const userId = Object.keys(month!.users)[0] as Id<"users">;
  const checksOnly = await owner.query(api.openaiSpend.month, { kind: "watch" });
  expect(checksOnly?.measuredEur).toBeCloseTo(0.4);
  expect(checksOnly?.users[userId].totalEur).toBeCloseTo(0.4);
  const userMonth = await owner.query(api.openaiSpend.month, { userId });
  expect(userMonth?.watches[watchId]).toMatchObject({ checks: 1, listingsScored: 5, alertsSent: 2, costPerAlertEur: 0.2 });
  expect(userMonth?.chats[chatId]).toMatchObject({ questions: 1, totalEur: 0.2 });
});

test("legacy MW-86 rows are backfilled once into bounded monthly summaries", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  await alice.mutation(api.users.store, {});
  await t.run(async (ctx) => {
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "alice")).unique();
    await ctx.db.insert("aiSpend", { userId: user!._id, windowStart: Date.parse("2026-10-05"), kind: "chat",
      inputTokens: 10, outputTokens: 5, costEur: 0.3, at: Date.now(), callId: "legacy" });
  });
  await t.action(internal.spendRollup.backfill, {});
  await t.action(internal.spendRollup.backfill, {});
  expect((await owner.query(api.openaiSpend.month, {}))?.measuredEur).toBeCloseTo(0.3);
  expect(await t.run((ctx) => ctx.db.query("aiSpendMonthly").collect())).toHaveLength(1);
});

test("hourly refresh stores organization totals and named key costs, retaining project filtering", async () => {
  const t = convexTest(schema, modules);
  process.env.OPENAI_ADMIN_API_KEY = "test-admin-key";
  process.env.OPENAI_PROJECT_ID = "proj_test";
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ results: [{ amount: { value: 2, currency: "usd" } }] }], has_more: true, next_page: "next" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ results: [{ amount: { value: 3.5, currency: "usd" } }] }], has_more: false, next_page: null }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ results: [
      { api_key_id: "key_app", amount: { value: 1, currency: "usd" } },
      { api_key_id: "key_eval", amount: { value: 3, currency: "usd" } },
      { api_key_id: "key_other", amount: { value: 1.5, currency: "usd" } },
    ] }], has_more: false }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ results: [{ amount: { value: 1, currency: "usd" } }] }], has_more: false }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: "proj_test" }], has_more: false }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [
      { id: "key_app", name: "marktplaats-watcher-app", value: "secret-never-store" },
      { id: "key_eval", name: "marktplaats-watcher-local-and-evals" },
      { id: "key_other", name: "vibegame-keychest" },
    ], has_more: false }) });
  vi.stubGlobal("fetch", fetcher);
  await t.action(internal.openaiSpend.refreshCosts, {});
  const row = await t.run((ctx) => ctx.db.query("openaiCosts").collect());
  expect(row).toMatchObject([{ totalUsd: 5.5, projectUsd: 1, monthStart: Date.parse("2026-10-01T00:00:00Z"),
    byKey: [{ name: "marktplaats-watcher-local-and-evals", usd: 3 }, { name: "vibegame-keychest", usd: 1.5 },
      { name: "marktplaats-watcher-app", usd: 1 }] }]);
  expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("page")).toBe("next");
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer test-admin-key");
  expect(new URL(fetcher.mock.calls[2][0]).searchParams.getAll("group_by")).toEqual(["api_key_id"]);
  expect(new URL(fetcher.mock.calls[3][0]).searchParams.getAll("project_ids")).toEqual(["proj_test"]);
  expect(JSON.stringify(row)).not.toContain("secret-never-store");
  expect((await t.withIdentity({ subject: "owner", email: "owner@example.com" }).query(api.openaiSpend.month, {}))?.billed?.byKey).toHaveLength(3);
  delete process.env.OPENAI_ADMIN_API_KEY;
  delete process.env.OPENAI_PROJECT_ID;
  vi.unstubAllGlobals();
});

test("80% alert is recorded once for the month", async () => {
  const t = convexTest(schema, modules);
  const monthStart = Date.parse("2026-10-01T00:00:00Z");
  await t.mutation(internal.openaiSpend.maybeAlert, { monthStart, spentUsd: 87.99 });
  expect(await t.run((ctx) => ctx.db.query("openaiCapAlerts").collect())).toHaveLength(0);
  await t.mutation(internal.openaiSpend.maybeAlert, { monthStart, spentUsd: 88 });
  await t.mutation(internal.openaiSpend.maybeAlert, { monthStart, spentUsd: 100 });
  expect(await t.run((ctx) => ctx.db.query("openaiCapAlerts").collect())).toHaveLength(1);
});

test("reconcile joins UTC usage and billed cost to ledger rows, including empty days, without identifiers", async () => {
  const t = convexTest(schema, modules);
  vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
  process.env.OPENAI_ADMIN_API_KEY = "secret-admin-value";
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { clerkId: "alice", email: "alice@example.com", createdAt: Date.now() });
    await ctx.db.insert("aiSpend", { userId, windowStart: Date.parse("2026-10-05"), kind: "chat", model: "gpt-5.4-mini",
      inputTokens: 30, outputTokens: 10, costEur: 0.03, at: Date.parse("2026-10-13T23:30:00Z"), callId: "one", rolledUp: true });
    await ctx.db.insert("aiSpend", { userId, windowStart: Date.parse("2026-10-05"), kind: "embedding", model: "text-embedding-3-small",
      inputTokens: 20, outputTokens: 0, costEur: 0.01, at: Date.parse("2026-10-14T00:30:00Z"), callId: "two", rolledUp: true });
    await ctx.db.insert("aiSpendMonthly", { userId, monthStart: Date.parse("2026-10-01"), totalEur: 0.04,
      kinds: { chat: 0.03, embedding: 0.01 }, days: { "2026-10-13": 0.03, "2026-10-14": 0.01 },
      dailyKinds: { "2026-10-13": { chat: 0.03 }, "2026-10-14": { embedding: 0.01 } } });
  });
  const fetcher = vi.fn(async (url: URL) => {
    const path = url.pathname;
    if (path.endsWith("/projects")) return { ok: true, json: async () => ({ data: [{ id: "proj" }], has_more: false }) };
    if (path.endsWith("/api_keys")) return { ok: true, json: async () => ({ data: [
      { id: "key_app", name: "marktplaats-watcher-app", value: "secret-app-value" },
      { id: "key_other", name: "other" },
    ], has_more: false }) };
    if (path.endsWith("/usage/completions")) return { ok: true, json: async () => ({ data: [
      { start_time: Date.parse("2026-10-13") / 1000, results: [
        { api_key_id: "key_app", model: "gpt-5.4-mini", input_tokens: 100, input_cached_tokens: 25, output_tokens: 40, num_model_requests: 2 },
        { api_key_id: "key_other", model: "gpt-5.4-mini", input_tokens: 999, input_cached_tokens: 0, output_tokens: 999, num_model_requests: 9 },
      ] },
    ], has_more: false }) };
    if (path.endsWith("/usage/embeddings")) return { ok: true, json: async () => ({ data: [
      { start_time: Date.parse("2026-10-14") / 1000, results: [
        { api_key_id: "key_app", model: "text-embedding-3-small", input_tokens: 50, num_model_requests: 1 },
      ] },
    ], has_more: false }) };
    if (path.endsWith("/costs")) return { ok: true, json: async () => ({ data: [
      { start_time: Date.parse("2026-10-13") / 1000, results: [
        { api_key_id: "key_app", amount: { value: 0.2, currency: "usd" } },
        { api_key_id: "key_other", amount: { value: 5, currency: "usd" } },
      ] },
      { start_time: Date.parse("2026-10-14") / 1000, results: [
        { api_key_id: "key_app", amount: { value: 0.1, currency: "usd" } },
      ] },
    ], has_more: false }) };
    throw new Error(`Unexpected endpoint ${path}`);
  });
  vi.stubGlobal("fetch", fetcher);
  try {
    const result = await t.action(internal.openaiSpend.reconcile, { days: 3 });
    expect(result.days.map((day) => day.date)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(result.days[0]).toMatchObject({ billedUsd: 0, ledger: { costEur: 0, inputTokens: 0, callsByKind: {} },
      usage: { completions: [], embeddings: [] } });
    expect(result.days[1]).toMatchObject({ billedUsd: 0.2, ledger: { costEur: 0.03, inputTokens: 30,
      outputTokens: 10, callsByKind: { chat: 1 }, byKind: { chat: { calls: 1, costEur: 0.03 } },
      byModel: { "gpt-5.4-mini": { inputTokens: 30, outputTokens: 10 } }, rollupEur: 0.03 },
      usage: { completions: [{ model: "gpt-5.4-mini",
        inputTokens: 100, cachedInputTokens: 25, outputTokens: 40, requests: 2 }] } });
    expect(result.days[2]).toMatchObject({ billedUsd: 0.1, ledger: { costEur: 0.01, inputTokens: 20,
      callsByKind: { embedding: 1 } }, usage: { embeddings: [{ model: "text-embedding-3-small", inputTokens: 50,
        cachedInputTokens: 0, outputTokens: 0, requests: 1 }] } });
    expect(JSON.stringify(result)).not.toMatch(/secret-|alice@example|key_app|key_other/);
    expect(result.keyName).toBe("marktplaats-watcher-app");
    expect(await t.run((ctx) => ctx.db.query("openaiCosts").collect())).toEqual([]);
  } finally { vi.unstubAllGlobals(); delete process.env.OPENAI_ADMIN_API_KEY; }
});
