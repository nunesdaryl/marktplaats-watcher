import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const day = "2026-10-19";
const row = { day, route: "/api/internal/check", env: "production", model: "gpt-5.4-mini",
  ok: true, error: null, requestId: "run.0", requests: 2, inputTokens: 30, outputTokens: 5 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
  process.env.API_TO_CONVEX_SECRET = "secret";
});
afterEach(() => { vi.useRealTimers(); delete process.env.API_TO_CONVEX_SECRET; });

test("HTTP requires the secret and rejects malformed or private fields", async () => {
  const t = convexTest(schema, modules);
  const send = (secret: string, records: unknown) => t.fetch("/api/openai-calls", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Api-Secret": secret },
    body: JSON.stringify({ records }),
  });
  expect((await send("wrong", [row])).status).toBe(401);
  for (const bad of [[], Array(201).fill(row), [{ ...row, requests: -1 }],
    [{ ...row, inputTokens: 1.5 }], [{ ...row, outputTokens: Number.MAX_SAFE_INTEGER + 1 }],
    [{ ...row, userId: "private" }], [{ ...row, day: "tomorrow" }]])
    expect((await send("secret", bad)).status).toBe(400);
  expect(await t.run((ctx) => ctx.db.query("openaiCalls").collect())).toEqual([]);
});

test("posts increment one day row and summary preserves route, environment, model and outcome", async () => {
  const t = convexTest(schema, modules);
  const send = (records: unknown) => t.fetch("/api/openai-calls", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Api-Secret": "secret" },
    body: JSON.stringify({ records }),
  });
  expect((await send([row])).status).toBe(200);
  expect((await send([{ ...row, requests: 1, inputTokens: 7, outputTokens: 1 },
    { ...row, route: "/api/chat/stream", ok: false, error: "RuntimeError", requests: 1,
      inputTokens: 0, outputTokens: 0 }])).status).toBe(200);
  const rows = await t.run((ctx) => ctx.db.query("openaiCalls").collect());
  expect(rows).toHaveLength(2);
  const summary = await t.query(internal.openaiCalls.summary, { days: 2 });
  expect(summary).toMatchObject([
    { day, requests: 4, inputTokens: 37, outputTokens: 6 },
    { day: "2026-10-20", requests: 0, routes: [] },
  ]);
  expect(summary[0].routes).toEqual(expect.arrayContaining([
    { route: row.route, env: "production", model: row.model, ok: true, error: null,
      requests: 3, inputTokens: 37, outputTokens: 6 },
    { route: "/api/chat/stream", env: "production", model: row.model, ok: false,
      error: "RuntimeError", requests: 1, inputTokens: 0, outputTokens: 0 },
  ]));
  await expect(t.query(internal.openaiCalls.summary, { days: 32 })).rejects.toThrow();
});

test("check calls keep separate request ids while summary still totals the route", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.openaiCalls.recordCalls, { records: [row, { ...row, requestId: "run.1", requests: 1 }] });
  const rows = await t.run((ctx) => ctx.db.query("openaiCalls").collect());
  expect(rows.map((item) => item.requestId).sort()).toEqual(["run.0", "run.1"]);
  const summary = await t.query(internal.openaiCalls.summary, { days: 2 });
  expect(summary[0].routes).toMatchObject([{ route: row.route, requests: 3 }]);
});

test("daily cleanup removes only rows older than 90 days", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.openaiCalls.recordCalls, { records: [
    { ...row, day: "2026-07-20" }, { ...row, day: "2026-07-22" },
  ] });
  await t.mutation(internal.openaiCalls.purge, {});
  expect((await t.run((ctx) => ctx.db.query("openaiCalls").collect())).map((item) => item.day)).toEqual(["2026-07-22"]);
});
