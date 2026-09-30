import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T21:30:00Z"));
  process.env.CHAT_DAILY_LIMIT = "40";
  process.env.OWNER_CLERK_ID = "owner";
  process.env.OWNER_EMAIL = "owner@example.com";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.CHAT_DAILY_LIMIT;
  delete process.env.OWNER_CLERK_ID;
  delete process.env.OWNER_EMAIL;
});

test("40 chats are allowed, the 41st is denied, and Amsterdam midnight resets the count", async () => {
  const t = convexTest(schema, modules);
  for (let i = 1; i <= 40; i++)
    expect(await t.mutation(internal.usage.consume, { clerkId: "alice" })).toEqual({ allowed: true, used: i, limit: 40 });
  expect(await t.mutation(internal.usage.consume, { clerkId: "alice" })).toEqual({ allowed: false, used: 40, limit: 40 });
  vi.setSystemTime(new Date("2026-09-29T22:00:00Z"));
  expect(await t.mutation(internal.usage.consume, { clerkId: "alice" })).toEqual({ allowed: true, used: 1, limit: 40 });
});

test("owner needs both the Clerk id and stored email, and remains counted", async () => {
  const t = convexTest(schema, modules);
  await t.withIdentity({ subject: "owner", email: "OWNER@example.com" }).mutation(api.users.store, {});
  process.env.CHAT_DAILY_LIMIT = "2";
  const results = await Promise.all(Array.from({ length: 4 }, () => t.mutation(internal.usage.consume, { clerkId: "owner" })));
  expect(results.every((r) => r.allowed)).toBe(true);
  expect((await t.mutation(internal.usage.consume, { clerkId: "owner" })).used).toBe(5);
  const dashboard = await t.withIdentity({ subject: "owner", email: "owner@example.com" }).query(api.admin.dashboard, {});
  expect(dashboard?.totals.chatsToday).toBe(5);
  expect(dashboard?.topUsage).toEqual([{ name: "OWNER@example.com", count: 5 }]);
  await t.run(async (ctx) => {
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "owner")).unique();
    await ctx.db.patch(user!._id, { email: "other@example.com" });
  });
  expect((await t.mutation(internal.usage.consume, { clerkId: "owner" })).allowed).toBe(false);
});

test("concurrent consumption never allows more than the limit", async () => {
  const t = convexTest(schema, modules);
  process.env.CHAT_DAILY_LIMIT = "2";
  const results = await Promise.all(Array.from({ length: 8 }, () => t.mutation(internal.usage.consume, { clerkId: "alice" })));
  expect(results.filter((r) => r.allowed)).toHaveLength(2);
  expect((await t.run((ctx) => ctx.db.query("usage").collect()))[0].chats).toBe(2);
});

test("HTTP usage check requires the shared secret and a Clerk id", async () => {
  const t = convexTest(schema, modules);
  const send = (clerkId: unknown, secret?: string) => t.fetch("/api/usage/consume", {
    method: "POST", headers: { "Content-Type": "application/json", ...(secret ? { "X-Api-Secret": secret } : {}) },
    body: JSON.stringify({ clerkId }),
  });
  delete process.env.API_TO_CONVEX_SECRET;
  expect((await send("alice")).status).toBe(503);
  process.env.API_TO_CONVEX_SECRET = "secret";
  expect((await send("alice", "wrong")).status).toBe(401);
  expect((await send(42, "secret")).status).toBe(400);
  expect(await (await send("alice", "secret")).json()).toEqual({ allowed: true, used: 1, limit: 40 });
  delete process.env.API_TO_CONVEX_SECRET;
});
