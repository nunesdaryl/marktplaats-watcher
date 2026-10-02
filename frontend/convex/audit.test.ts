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
  process.env.AGENTMAIL_API_KEY = "am_test";
  process.env.AGENTMAIL_INBOX_ID = "inbox@test";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); delete process.env.OWNER_CLERK_ID; delete process.env.OWNER_EMAIL;
  delete process.env.AGENTMAIL_API_KEY; delete process.env.AGENTMAIL_INBOX_ID; });

test("daily audit stores misses without changing seen listings or alerts; digest reports them", async () => {
  const t = convexTest(schema, modules);
  const mails: any[] = [];
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "mac mini",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run(async (ctx) => {
    await ctx.db.patch(id, { seeded: true, lastReadAt: Date.now() - 60_000 });
    await ctx.db.insert("seenListings", { watchId: id, listingId: "m1", lastSeenAt: Date.now(),
      score: 4, reason: "Weak match", scoredAt: Date.now() });
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes("agentmail")) {
      mails.push(JSON.parse(init.body as string));
      return new Response("{}");
    }
    const body = JSON.parse(init.body as string);
    expect(init.headers).toMatchObject({ "X-Request-Id": expect.stringMatching(/^audit-.*\.0$/) });
    expect(body.watches[0].seen_ids).toEqual(["m1"]);
    expect(body.watches[0].seen_scores).toEqual({ m1: 4 });
    return new Response(JSON.stringify({ results: [{ watchId: id, ok: true, read: 2, candidates: 1,
      scored: 1, missCount: 1, misses: [{ id: "m1", title: "Mac mini", url: "https://www.marktplaats.nl/v/m1",
        score: 9, kind: "rescored", checkScore: 4 }] }] }));
  }));
  expect(await t.action(internal.audit.run, {})).toEqual({ checked: 1, misses: 1 });
  const rows = await t.run((ctx) => ctx.db.query("audits").collect());
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ watchId: id, read: 2, scored: 1, missCount: 1,
    misses: [{ listingId: "m1", score: 9, kind: "rescored", checkScore: 4 }] });
  expect(await t.run((ctx) => ctx.db.query("seenListings").collect())).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("alerts").collect())).toHaveLength(0);
  const plans = await t.run((ctx) => ctx.db.query("catchupPlans").collect());
  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({ status: "draft", items: [{ watchId: id, listingId: "m1", score: 9 }] });
  expect(mails).toHaveLength(1);
  expect(mails[0]).toMatchObject({ to: ["owner@example.com"] });
  for (const detail of ["a@example.com", "Mac mini", "9/10", "https://www.marktplaats.nl/v/m1",
    String(plans[0]._id), `catchup:send '{"planId":"${plans[0]._id}"}'`])
    expect(mails[0].text).toContain(detail);
  const report = await t.query(internal.health.report, { now: Date.now() });
  expect(report.summary).toContain("Delivery audit: 1 watches checked, 1 misses");
  expect(report.problems.join(" ")).toContain('Delivery audit: 1 missed match(es) on 1 watch(es): "Mac mini" (9/10 "Mac mini"');
  expect(report.problems.join(" ")).toContain("scored 4 at check, 9 now");
  expect(report.problems.join(" ")).toContain(rows[0].requestId);
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const dashboard = await owner.query(api.admin.dashboard, {});
  expect(dashboard?.deliveryAudit).toMatchObject({ checked: 1, misses: 1,
    latestMisses: [{ listingId: "m1", url: "https://www.marktplaats.nl/v/m1" }] });
});

test("one owner e-mail and one exact draft plan for qualifying misses across watches, even on a repeat run", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const bob = t.withIdentity({ subject: "b", email: "b@example.com" });
  const a = await alice.mutation(api.watches.create, { query: "mac mini",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const b = await bob.mutation(api.watches.create, { query: "thinkpad",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run(async (ctx) => { await ctx.db.patch(a, { seeded: true }); await ctx.db.patch(b, { seeded: true }); });
  const mails: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes("agentmail")) { mails.push(JSON.parse(init.body as string)); return new Response("{}"); }
    const group = JSON.parse(init.body as string);
    return new Response(JSON.stringify({ results: group.watches.map((w: { id: string }) => ({
      watchId: w.id, ok: true, read: 10, candidates: 10, scored: 10, missCount: 10,
      misses: w.id === a ? [
        ...Array.from({ length: 6 }, (_, i) => ({ id: `high${i}`, title: `High ${i}`,
          url: `https://www.marktplaats.nl/v/high${i}`, score: 9, kind: "handled" })),
        { id: "low", title: "Low", url: "https://www.marktplaats.nl/v/low", score: 8, kind: "handled" },
        { id: "unscored", title: "Unscored", url: "https://www.marktplaats.nl/v/unscored", score: 10, kind: "never_scored" },
        { id: "unread", title: "Unread", url: "https://www.marktplaats.nl/v/unread", score: 10, kind: "never_read" },
      ] : [{ id: "rescored", title: "Rescored", url: "https://www.marktplaats.nl/v/rescored",
        score: 10, kind: "rescored" }],
    })) }));
  }));
  await t.action(internal.audit.run, {});
  await t.action(internal.audit.run, {});
  const plans = await t.run((ctx) => ctx.db.query("catchupPlans").collect());
  expect(plans).toHaveLength(1);
  expect(plans[0].status).toBe("draft");
  expect(plans[0].items.map((item) => item.listingId).sort()).toEqual([
    ...Array.from({ length: 6 }, (_, i) => `high${i}`), "rescored" ].sort());
  expect(mails).toHaveLength(1);
  expect(mails[0].text).toContain("b@example.com");
  expect(mails[0].text).toContain("Thinkpad");
  expect(mails[0].text).toContain("High 5");
  expect(mails[0].text).not.toContain("Unscored");
  expect(await t.run((ctx) => ctx.db.query("alerts").collect())).toEqual([]);
});

test("lower scores and never_scored misses create no plan or owner e-mail", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "mac mini",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(id, { seeded: true }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ results: [{ watchId: id, ok: true,
    read: 2, candidates: 2, scored: 2, missCount: 2, misses: [
      { id: "low", title: "Low", url: "https://www.marktplaats.nl/v/low", score: 8, kind: "handled" },
      { id: "unscored", title: "Unscored", url: "https://www.marktplaats.nl/v/unscored", score: 10,
        kind: "never_scored" },
    ] }] }))));
  await t.action(internal.audit.run, {});
  expect(await t.run((ctx) => ctx.db.query("catchupPlans").collect())).toEqual([]);
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
});

test("audit groups send only listings created near the first look as baseline", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "mac mini",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const first = Date.now();
  await t.run(async (ctx) => {
    await ctx.db.patch(id, { seeded: true, seededAt: first, lastReadAt: first });
    await ctx.db.insert("seenListings", { watchId: id, listingId: "baseline", lastSeenAt: first });
  });
  vi.setSystemTime(first + 3 * 60_000);
  await t.run((ctx) => ctx.db.insert("seenListings", { watchId: id, listingId: "later", lastSeenAt: Date.now(),
    score: 0, reason: "No match", scoredAt: Date.now() }));
  const groups = await t.query(internal.audit.groups, { now: Date.now() });
  expect(groups[0].watches[0]).toMatchObject({ seen_ids: ["later", "baseline"], baseline_ids: ["baseline"],
    seen_scores: { later: 0 } });
  await t.run((ctx) => ctx.db.patch(id, { seededAt: undefined }));
  const withoutTime = await t.query(internal.audit.groups, { now: Date.now() });
  expect(withoutTime[0].watches[0].baseline_ids).toEqual([]);
});

test("audit records unscored candidates without failing the watch", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "mac mini",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.mutation(internal.audit.record, { at: Date.now(), requestId: "audit-unscored.0", results: [
    { watchId: id, ok: true, read: 1, candidates: 1, scored: 0, unscored: 1, missCount: 0, misses: [] },
  ] });
  expect((await t.run((ctx) => ctx.db.query("audits").collect()))[0]).toMatchObject({ ok: true, unscored: 1 });
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
