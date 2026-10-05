import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { parseCostsPage, summarizeSpend } from "./openaiSpend";

const modules = import.meta.glob("./**/*.ts");
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

test("hourly refresh follows Costs pagination and stores the billed month", async () => {
  const t = convexTest(schema, modules);
  process.env.OPENAI_ADMIN_API_KEY = "test-admin-key";
  process.env.OPENAI_PROJECT_ID = "proj_test";
  const fetcher = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ results: [{ amount: { value: 2, currency: "usd" } }] }], has_more: true, next_page: "next" }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ results: [{ amount: { value: 3.5, currency: "usd" } }] }], has_more: false, next_page: null }) });
  vi.stubGlobal("fetch", fetcher);
  await t.action(internal.openaiSpend.refreshCosts, {});
  const row = await t.run((ctx) => ctx.db.query("openaiCosts").collect());
  expect(row).toMatchObject([{ totalUsd: 5.5, monthStart: Date.parse("2026-10-01T00:00:00Z") }]);
  expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("page")).toBe("next");
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer test-admin-key");
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.getAll("project_ids")).toEqual(["proj_test"]);   // project cap, not org
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
