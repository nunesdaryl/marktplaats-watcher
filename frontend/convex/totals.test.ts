import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { insertTracked, patchTracked } from "./totals";

const modules = import.meta.glob("./**/*.ts");
const DAY = 86_400_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-02T13:00:00Z"));
  process.env.OWNER_CLERK_ID = "owner";
  process.env.OWNER_EMAIL = "owner@example.com";
  process.env.CANARY_DISABLED = "1";
});
afterEach(() => { vi.useRealTimers(); delete process.env.CANARY_DISABLED; });

test("backfilled overview matches the original across every window and health detail", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const bob = t.withIdentity({ subject: "bob", email: "bob@example.com" });
  const aliceId = (await alice.mutation(api.users.store, {})).id!;
  await bob.mutation(api.users.store, {});
  await alice.mutation(api.users.finishOnboarding, {});
  const watchId = await alice.mutation(api.watches.create, {
    query: "bike", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good",
  });
  await bob.mutation(api.watches.create, {
    query: "camera", schedule: { kind: "daily", times: ["08:00"] }, notify: "all",
  });
  await alice.mutation(api.chats.start, { content: "Find a bike" });
  await alice.mutation(api.events.track, { events: [
    { name: "page_view", props: { section: "watches", value: "dark" }, device: "phone", at: Date.now() },
    { name: "chat_sent", props: { mode: "watch" }, device: "phone", at: Date.now() },
  ] });
  const feedbackId = await alice.mutation(api.feedback.submit, { message: "Useful", wouldPay: "maybe" });
  await t.mutation(internal.health.logRun, { at: Date.now(), checked: 1, failed: 0, emails: 1, emailFailures: 0 });
  await t.mutation(internal.health.recordError, { kind: "chat", requestId: "req-1", message: "Example" });
  await t.run(async (ctx) => {
    await ctx.db.patch(watchId, { backlog: 25, lastError: "check failed" });
    await ctx.db.patch(feedbackId, { status: "shipped", handledAt: Date.now(), repliedAt: Date.now() });
    for (const [age, name] of [[10, "page_view"], [40, "chip_clicked"]] as const)
      await ctx.db.insert("events", { userId: aliceId, name, device: "desktop", at: Date.now() - age * DAY });
    const sentAlert = await ctx.db.insert("alerts", { userId: aliceId, watchId, listingId: "listing-1", title: "Bike", url: "https://example.com/bike",
      score: 9, reason: "Match", channel: "email", emailStatus: "sent", createdAt: Date.now() - 2 * DAY });
    await ctx.db.insert("alerts", { userId: aliceId, watchId, listingId: "listing-2", title: "Second bike", url: "https://example.com/second",
      score: 7, reason: "Match", channel: "email", emailStatus: "failed", createdAt: Date.now() });
    await ctx.db.insert("ratings", { alertId: sentAlert, userId: aliceId, watchId, verdict: "good", source: "app",
      score: 9, createdAt: Date.now(), updatedAt: Date.now() });
    await ctx.db.insert("audits", { userId: aliceId, watchId, at: Date.now(), requestId: "audit-1", ok: true,
      read: 1, scored: 1, missCount: 1, misses: [{ listingId: "miss", title: "Bike", url: "https://example.com/miss", score: 8, kind: "never_read" }] });
  });
  const old = await Promise.all([7, 30, 90].map((days) => owner.query(api.admin.dashboard, { days })));
  const oldRatings = await owner.query(api.admin.ratingStats, { days: 30 });
  expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift.length).toBeGreaterThan(0);
  expect(await t.run((ctx) => ctx.db.query("dashboardTotals").collect())).toMatchObject([{ key: "founding-admissions", admitted: 2 }]);
  await t.mutation(internal.totals.backfill, { dryRun: false });
  const current = await Promise.all([7, 30, 90].map((days) => owner.query(api.admin.dashboard, { days })));
  expect(current).toEqual(old);
  expect(await owner.query(api.admin.ratingStats, { days: 30 })).toEqual(oldRatings);
  expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift).toEqual([]);
});

test("mixed live writes stay equal to recount and drift appears in health", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  await t.mutation(internal.totals.backfill, { dryRun: false });
  const watches = [];
  const chats = [];
  let seed = 56;
  const next = () => (seed = (seed * 1664525 + 1013904223) >>> 0) % 9;
  for (let i = 0; i < 30; i++) {
    switch (next()) {
      case 0:
        if (watches.length < 4) watches.push(await alice.mutation(api.watches.create,
          { query: `item ${i}`, schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" }));
        else await alice.mutation(api.watches.setArchived, { id: watches[i % watches.length], archived: i % 2 === 0 });
        break;
      case 1:
        chats.push(await alice.mutation(api.chats.start, { content: `Find item ${i}` }));
        break;
      case 2:
        await alice.mutation(api.events.track, { events: [{ name: "page_view", props: { section: "watches" }, device: "desktop", at: Date.now() }] });
        break;
      case 3:
        if (watches.length) await alice.mutation(api.watches.setArchived, { id: watches.at(-1)!, archived: true });
        break;
      case 4:
        if (chats.length) await alice.mutation(api.chats.remove, { chatId: chats.shift()! });
        break;
      case 5:
        await alice.mutation(api.users.finishOnboarding, {});
        break;
      case 6:
        await alice.mutation(api.feedback.submit, { message: `Feedback ${i}` });
        break;
      case 7:
        await t.mutation(internal.health.logRun, { at: Date.now(), checked: 1, failed: 0, emails: 0, emailFailures: 0 });
        break;
      case 8:
        await t.mutation(internal.health.recordError, { kind: "check", requestId: `req-${i}`, message: "Example" });
        break;
    }
    expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift).toEqual([]);
  }
  await alice.mutation(api.users.finishOnboarding, {});
  expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift).toEqual([]);
  const feedbackId = await alice.mutation(api.feedback.submit, { message: "One more note" });
  await owner.mutation(api.admin.setFeedbackHandled, { id: feedbackId, handled: true });
  expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift).toEqual([]);
  await t.run(async (ctx) => {
    const users = await ctx.db.query("dashboardTotals").withIndex("by_key", (q) => q.eq("key", "users")).unique();
    await ctx.db.patch(users!._id, { rows: [] });
  });
  expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift).toContain("users");
  await t.mutation(internal.totals.recount, {});
  expect((await owner.query(api.admin.dashboard, {}))?.health.issues.some((issue) => issue.kind === "dashboard_drift")).toBe(true);
  expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift).toEqual([]);
});

test("alert e-mail status and deletion keep sent counts in step", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const bob = t.withIdentity({ subject: "bob", email: "bob@example.com" });
  await t.mutation(internal.totals.backfill, { dryRun: false });
  const watchId = await alice.mutation(api.watches.create, { query: "bike",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const watch = await t.run((ctx) => ctx.db.get(watchId));
  const alertId = await t.run((ctx) => insertTracked(ctx, "alerts", { userId: watch!.userId, watchId,
    listingId: "l1", title: "Bike", url: "https://example.com/bike", reason: "match", channel: "email",
    emailStatus: "pending", createdAt: Date.now() }));
  const bobWatchId = await bob.mutation(api.watches.create, { query: "camera",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const bobWatch = await t.run((ctx) => ctx.db.get(bobWatchId));
  await t.run((ctx) => insertTracked(ctx, "alerts", { userId: bobWatch!.userId, watchId: bobWatchId,
    listingId: "l2", title: "Camera", url: "https://example.com/camera", reason: "match", channel: "email",
    emailStatus: "pending", createdAt: Date.now() }));
  const sent = async () => (await owner.query(api.admin.ratingStats, { days: 7 }))!.alertsSent;
  expect(await sent()).toBe(0);
  await t.mutation(internal.checker.markEmailed, { alertIds: [alertId], status: "sent" });
  expect(await sent()).toBe(1);
  await alice.mutation(api.ratings.rate, { alertId, verdict: "good" });
  await t.mutation(internal.audit.record, { at: Date.now(), requestId: "audit-1", results: [{ watchId,
    ok: true, read: 1, candidates: 1, scored: 1, missCount: 0, misses: [] }] });
  expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift).toEqual([]);
  await t.mutation(internal.checker.markEmailed, { alertIds: [alertId], status: "failed" });
  expect(await sent()).toBe(0);
  expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift).toEqual([]);
  await alice.mutation(api.watches.remove, { id: watchId });
  expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift).toEqual([]);
});

test("quiet-watch findings are stored until the next recount", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const watchId = await alice.mutation(api.watches.create, { query: "bike",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run(async (ctx) => {
    await ctx.db.patch(watchId, { seeded: true, seededAt: Date.now() - 4 * DAY });
    for (let i = 0; i < 3; i++) await ctx.db.insert("seenListings", {
      watchId, listingId: `l${i}`, firstSeenAt: Date.now() - i * DAY,
      lastSeenAt: Date.now() - i * DAY, scoredAt: Date.now() - i * DAY,
      score: 9, title: "Bike", url: "https://example.com/bike",
    });
  });
  await t.mutation(internal.totals.backfill, { dryRun: false });
  const issue = async () => (await t.query(internal.health.report, { now: Date.now() })).issues
    .find((item) => item.kind === "watch_quiet");
  expect(await issue()).toMatchObject({ count: 1 });
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("seenListings").collect()) await ctx.db.delete(row._id);
  });
  expect(await issue()).toMatchObject({ count: 1 });
  await t.mutation(internal.totals.recount, {});
  expect(await issue()).toBeUndefined();
});

test("oversized projection never blocks an alert and recount repairs drift", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  await t.mutation(internal.totals.backfill, { dryRun: false });
  const watchId = await alice.mutation(api.watches.create, { query: "bike",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const watch = await t.run((ctx) => ctx.db.get(watchId));
  const key = `alerts:${new Date().toISOString().slice(0, 13)}`;
  await t.run(async (ctx) => {
    await ctx.db.insert("dashboardTotals", { key, rows: [{ _id: "oversized", padding: "x".repeat(512 * 1024) }] });
  });
  const id = await t.run((ctx) => insertTracked(ctx, "alerts", { userId: watch!.userId, watchId,
    listingId: "l1", title: "Bike", url: "https://example.com/bike", reason: "match", channel: "email",
    emailStatus: "pending", createdAt: Date.now() }));
  expect(await t.run((ctx) => ctx.db.get(id))).not.toBeNull();
  expect((await t.run((ctx) => ctx.db.query("dashboardTotals").withIndex("by_key", (q) => q.eq("key", "meta")).unique()))?.drift).toContain(key);
  await t.mutation(internal.totals.recount, {});
  expect((await t.mutation(internal.totals.backfill, { dryRun: true })).drift).toEqual([]);
});

test("823 alerts on one day stay under 100 KB in each hourly bucket", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const watchId = await alice.mutation(api.watches.create, { query: "bike",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const watch = await t.run((ctx) => ctx.db.get(watchId));
  await t.run(async (ctx) => {
    for (let i = 0; i < 823; i++) await ctx.db.insert("alerts", { userId: watch!.userId, watchId,
      listingId: `l${i}`, title: "Bike", url: "https://example.com/bike", reason: "match", channel: "email",
      emailStatus: "sent", createdAt: Date.parse("2026-09-30T00:00:00Z") + i * 100_000 });
  });
  await t.mutation(internal.totals.backfill, { dryRun: false });
  const buckets = await t.run((ctx) => ctx.db.query("dashboardTotals").collect());
  const alerts = buckets.filter((b) => b.key.startsWith("alerts:"));
  expect(alerts.length).toBeGreaterThan(1);
  expect(Math.max(...alerts.map((b) => new TextEncoder().encode(JSON.stringify(b.rows)).length))).toBeLessThan(100 * 1024);
});

test("an alert in a recount split part updates without a duplicate", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  await t.mutation(internal.totals.backfill, { dryRun: false });
  const watchId = await alice.mutation(api.watches.create, { query: "bike",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const watch = await t.run((ctx) => ctx.db.get(watchId));
  const id = await t.run((ctx) => insertTracked(ctx, "alerts", { userId: watch!.userId, watchId,
    listingId: "l1", title: "Bike", url: "https://example.com/bike", reason: "match", channel: "email",
    emailStatus: "pending", createdAt: Date.now() }));
  const key = `alerts:${new Date().toISOString().slice(0, 13)}`;
  await t.run(async (ctx) => {
    const base = await ctx.db.query("dashboardTotals").withIndex("by_key", (q) => q.eq("key", key)).unique();
    await ctx.db.patch(base!._id, { rows: [] });
    await ctx.db.insert("dashboardTotals", { key: `${key}:part2`, rows: base!.rows });
  });
  await t.run((ctx) => patchTracked(ctx, "alerts", id, { emailStatus: "sent" }));
  const rows = await t.run(async (ctx) => (await ctx.db.query("dashboardTotals").collect())
    .filter((b) => b.key.startsWith(key)).flatMap((b) => b.rows));
  expect(rows).toHaveLength(1);
  expect(rows[0].emailStatus).toBe("sent");
});
