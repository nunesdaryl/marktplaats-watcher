import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-29T10:00:00Z")); });
afterEach(() => { vi.useRealTimers(); });

const ev = (name: string, extra: object = {}) => ({ name, device: "phone" as const, at: Date.now(), ...extra });
const all = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("events").collect());

test("events need an account, only known names are kept, and props are cut short", async () => {
  const t = convexTest(schema, modules);
  expect(await t.mutation(api.events.track, { events: [ev("page_view")] })).toBe(0);   // signed out
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  await alice.mutation(api.users.store, {});
  const stored = await alice.mutation(api.events.track, { events: [
    ev("page_view", { props: { section: "watches", value: "dark" } }),
    ev("chat_sent", { props: { mode: "watch", kind: "x".repeat(100) } }),
    ev("steal_everything"),
    ev("alert_opened", { at: Date.now() + 86_400_000 }),   // from the future: clamped to now
  ] });
  expect(stored).toBe(3);
  const rows = await all(t);
  expect(rows.map((r) => r.name)).toEqual(["page_view", "chat_sent", "alert_opened"]);
  expect(rows[1].props?.kind).toHaveLength(40);
  expect(rows[2].at).toBe(Date.now());
});

test("at most 20 per call and 500 a day per person; deleted with the account data", async () => {
  const t = convexTest(schema, modules);
  const bob = t.withIdentity({ subject: "b", email: "b@example.com" });
  await bob.mutation(api.users.store, {});
  expect(await bob.mutation(api.events.track, { events: Array.from({ length: 30 }, () => ev("page_view")) })).toBe(20);
  for (let i = 0; i < 30; i++) await bob.mutation(api.events.track, { events: Array.from({ length: 20 }, () => ev("page_view")) });
  expect((await all(t)).length).toBe(500);
  await bob.mutation(api.users.deleteMyData, {});
  expect((await all(t)).length).toBe(0);
});

test("events older than 90 days are forgotten", async () => {
  const t = convexTest(schema, modules);
  const carol = t.withIdentity({ subject: "c", email: "c@example.com" });
  const userId = (await carol.mutation(api.users.store, {})).id!;
  await t.run(async (ctx) => {
    await ctx.db.insert("events", { userId, name: "page_view", device: "desktop", at: Date.now() - 91 * 86_400_000 });
    await ctx.db.insert("events", { userId, name: "page_view", device: "desktop", at: Date.now() - 89 * 86_400_000 });
  });
  expect(await t.mutation(internal.events.purge, {})).toBe(1);
  expect((await all(t)).length).toBe(1);
});
