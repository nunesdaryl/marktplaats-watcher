import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T04:30:00Z"));
  process.env.WATCHER_API_URL = "https://watcher.test";
  process.env.CRON_SECRET = "s3cret";
  process.env.OWNER_CLERK_ID = "owner";
  process.env.OWNER_EMAIL = "owner@example.com";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); delete process.env.OWNER_CLERK_ID; delete process.env.OWNER_EMAIL; });

test("daily audit stores misses without changing seen listings or alerts; digest reports them", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "mac mini",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run(async (ctx) => {
    await ctx.db.patch(id, { seeded: true, lastReadAt: Date.now() - 60_000 });
    await ctx.db.insert("seenListings", { watchId: id, listingId: "m1", lastSeenAt: Date.now() });
  });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    expect(init.headers).toMatchObject({ "X-Request-Id": expect.stringMatching(/^audit-.*\.0$/) });
    expect(body.watches[0].seen_ids).toEqual(["m1"]);
    return new Response(JSON.stringify({ results: [{ watchId: id, ok: true, read: 2, candidates: 1,
      scored: 1, missCount: 1, misses: [{ id: "m1", title: "Mac mini", url: "https://www.marktplaats.nl/v/m1",
        score: 9, kind: "handled" }] }] }));
  }));
  expect(await t.action(internal.audit.run, {})).toEqual({ checked: 1, misses: 1 });
  const rows = await t.run((ctx) => ctx.db.query("audits").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ watchId: id, read: 2, scored: 1, missCount: 1,
    misses: [{ listingId: "m1", score: 9, kind: "handled" }] });
  expect(await t.run((ctx) => ctx.db.query("seenListings").collect())).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("alerts").collect())).toHaveLength(0);
  const report = await t.query(internal.health.report, { now: Date.now() });
  expect(report.summary).toContain("Delivery audit: 1 watches checked, 1 misses");
  expect(report.problems.join(" ")).toContain('Delivery audit: 1 missed match(es) on 1 watch(es): "Mac mini" (9/10 "Mac mini"');
  expect(report.problems.join(" ")).toContain(rows[0].requestId);
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const dashboard = await owner.query(api.admin.dashboard, {});
  expect(dashboard?.deliveryAudit).toMatchObject({ checked: 1, misses: 1,
    latestMisses: [{ listingId: "m1", url: "https://www.marktplaats.nl/v/m1" }] });
});

test("failed audit is a problem and audit rows expire after 30 days", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "mac mini",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run(async (ctx) => {
    const watch = await ctx.db.get(id);
    await ctx.db.insert("audits", { at: Date.now() - 31 * 86_400_000, watchId: id,
      userId: watch!.userId, requestId: "old", ok: true, read: 0, scored: 0, missCount: 0, misses: [] });
  });
  await t.mutation(internal.audit.record, { at: Date.now(), requestId: "audit-failed.0", results: [
    { watchId: id, ok: false, read: 0, candidates: 0, scored: 0, missCount: 0, misses: [], error: "bad page" },
  ] });
  const report = await t.query(internal.health.report, { now: Date.now() });
  expect(report.problems.join(" ")).toContain("Delivery audit failed");
  await t.mutation(internal.checker.purgeOld, {});
  expect((await t.run((ctx) => ctx.db.query("audits").collect())).map((a) => a.requestId)).toEqual(["audit-failed.0"]);
  await alice.mutation(api.watches.remove, { id });
  expect(await t.run((ctx) => ctx.db.query("audits").collect())).toEqual([]);
});
