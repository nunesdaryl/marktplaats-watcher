import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T05:00:00Z"));   // a Tuesday
  process.env.WATCHER_API_URL = "https://watcher.test";
  process.env.CRON_SECRET = "s3cret";
  process.env.OWNER_EMAIL = "owner@example.com";
  process.env.AGENTMAIL_API_KEY = "am_test";
  process.env.AGENTMAIL_INBOX_ID = "inbox@test";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); delete process.env.CHECKS_PAUSED; });

test("a quiet healthy day sends nothing; failures send one e-mail to the owner", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.health.logRun, { at: Date.now() - 10 * 60_000, checked: 3, failed: 0, emails: 1, emailFailures: 0 });
  const sent: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { sent.push(JSON.parse(init.body as string)); return new Response("{}"); }));
  expect(await t.action(internal.health.digest, {})).toMatchObject({ sent: false, problems: [] });

  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(id, { lastError: "The AI that scores listings didn't answer. We'll try again soon, and nothing is sent unscored." }));
  const result = await t.action(internal.health.digest, {});
  expect(result.sent).toBe(true);
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toEqual(["owner@example.com"]);
  expect(sent[0].subject).toBe("Marktplaats Watcher: 1 problem(s) need a look");
  expect(sent[0].text).toContain('"Mac mini" (The AI that scores');
});

test("a stuck scheduler is a problem", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.health.logRun, { at: Date.now() - 3 * 60 * 60_000, checked: 0, failed: 0, emails: 0, emailFailures: 0 });
  const { problems } = await t.action(internal.health.digest, { dryRun: true });
  expect(problems[0]).toMatch(/hasn't run since/);
});

test("health issues group the same problems with counts and record links", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const watchId = await alice.mutation(api.watches.create, { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const watch = await t.run((ctx) => ctx.db.get(watchId));
  const userId = watch!.userId;
  await t.mutation(internal.health.logRun, { at: now, checked: 2, failed: 1, emails: 3, emailFailures: 1, paused: true, requestId: "run-1" });
  await t.run(async (ctx) => {
    await ctx.db.patch(watchId, { lastError: "check failed", backlog: 100 });
    await ctx.db.insert("alerts", { userId, watchId, listingId: "listing-1", title: "Mac mini", url: "https://example.com/listing-1",
      score: 9, reason: "match", channel: "email", emailStatus: "failed", createdAt: now });
    await ctx.db.insert("audits", { at: now, watchId, userId, requestId: "audit-1", ok: false, read: 1, scored: 1, missCount: 1,
      misses: [{ listingId: "listing-2", title: "Mac Studio", url: "https://example.com/listing-2", score: 8, kind: "never_read" }], error: "audit failed" });
  });
  for (let i = 0; i < 5; i++) await t.mutation(internal.health.recordError, { kind: "check", requestId: `check-${i}`, message: "check failed" });
  const report = await t.query(internal.health.report, { now });
  expect(report.issues.map((issue) => [issue.kind, issue.count])).toEqual([
    ["errors", 5], ["checks_paused", 1], ["emails_failed", 1], ["watches_failing", 1],
    ["delivery_misses", 1], ["audit_failed", 1], ["watches_behind", 1],
  ]);
  expect(report.issues.find((issue) => issue.kind === "errors")?.items[0]).toMatchObject({ requestId: "check-4" });
  expect(report.issues.find((issue) => issue.kind === "checks_paused")?.items).toEqual([{ label: `Paused run ${new Date(now).toISOString()}`, requestId: "run-1" }]);
  expect(report.issues.find((issue) => issue.kind === "emails_failed")?.items[0]).toMatchObject({ watchId, userId, listingId: "listing-1", score: 9, url: "https://example.com/listing-1" });
  expect(report.issues.find((issue) => issue.kind === "delivery_misses")).toMatchObject({ headline: "1 missed match on 1 watch",
    items: [{ watchId, userId, requestId: "audit-1", listingId: "listing-2", score: 8, title: "Mac Studio", url: "https://example.com/listing-2" }] });
  expect(report.issues.find((issue) => issue.kind === "audit_failed")?.items[0]).toMatchObject({ watchId, userId, requestId: "audit-1" });
  expect(report.issues.find((issue) => issue.kind === "watches_behind")?.items[0]).toMatchObject({ watchId, userId });
  expect(report.stats).toEqual({ runs: 1, checksFailed: 1, emailsSent: 3, errors: 5 });
});

test("a missing scheduler run has a structured issue", async () => {
  const t = convexTest(schema, modules);
  const report = await t.query(internal.health.report, { now: Date.now() });
  expect(report.issues).toEqual([{ kind: "scheduler_stuck", severity: "high", headline: "Scheduler hasn't run", count: 1,
    items: [{ label: "No runs yet", requestId: undefined }] }]);
});

test("the digest reports active watches with a large backlog or capped coverage", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.health.logRun, { at: Date.now(), checked: 1, failed: 0, emails: 0, emailFailures: 0 });
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(id, { backlog: 99 }));
  expect((await t.action(internal.health.digest, { dryRun: true })).problems).toEqual([]);
  await t.run((ctx) => ctx.db.patch(id, { backlog: 100 }));
  expect((await t.action(internal.health.digest, { dryRun: true })).problems)
    .toContain('1 watch(es) can\'t keep up: "Mac mini" (backlog 100).');
  await t.run((ctx) => ctx.db.patch(id, { backlog: undefined, coverageCapped: true }));
  expect((await t.action(internal.health.digest, { dryRun: true })).problems)
    .toContain('1 watch(es) can\'t keep up: "Mac mini" (backlog 0).');
});

test("the kill switch stops all checks and shows up in the digest", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  await alice.mutation(api.watches.create, { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  process.env.CHECKS_PAUSED = "1";
  const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
  expect(await t.action(internal.checker.checkDue, {})).toMatchObject({ paused: true });
  expect(fetchSpy).not.toHaveBeenCalled();
  const { problems } = await t.action(internal.health.digest, { dryRun: true });
  expect(problems).toContain("Checks are paused (CHECKS_PAUSED=1).");
});

test("chat and check errors reach the digest, dashboard, and retention purge", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.health.logRun, { at: Date.now(), checked: 0, failed: 0, emails: 0, emailFailures: 0, requestId: "run-1" });
  expect((await t.run((ctx) => ctx.db.query("runs").first()))?.requestId).toBe("run-1");
  process.env.API_TO_CONVEX_SECRET = "secret";
  const bad = await t.fetch("/api/errors", { method: "POST", headers: { "X-Api-Secret": "wrong" },
    body: JSON.stringify({ kind: "chat", requestId: "chat-1", message: "failure" }) });
  expect(bad.status).toBe(401);
  const posted = await t.fetch("/api/errors", { method: "POST", headers: { "X-Api-Secret": "secret" },
    body: JSON.stringify({ kind: "chat", requestId: "chat-1", message: `  ${"x".repeat(210)}  ` }) });
  expect(posted.status).toBe(200);
  for (let i = 0; i < 4; i++) await t.mutation(internal.health.recordError,
    { kind: "check", requestId: `run-1.${i}`, message: "failed" });
  const rows = await t.run((ctx) => ctx.db.query("errors").collect());
  expect(rows.find((row) => row.kind === "chat")?.message).toHaveLength(200);
  const digest = await t.action(internal.health.digest, { dryRun: true });
  expect(digest.summary).toContain("5 errors (chat 1, check 4)");
  expect(digest.problems).toContain("5 errors in the last 24 hours (chat 1, check 4); latest: run-1.3, run-1.2, run-1.1, run-1.0, chat-1.");
  process.env.OWNER_CLERK_ID = "owner";
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const dashboard = await owner.query(api.admin.dashboard, {});
  expect(dashboard?.errors24h).toEqual({ chat: 1, check: 4 });
  expect(dashboard?.latestErrors).toHaveLength(5);
  await t.run((ctx) => ctx.db.insert("errors", { kind: "check", requestId: "old", message: "old", at: Date.now() - 31 * 86_400_000 }));
  await t.mutation(internal.checker.purgeOld, {});
  expect((await t.run((ctx) => ctx.db.query("errors").collect())).some((row) => row.requestId === "old")).toBe(false);
  delete process.env.API_TO_CONVEX_SECRET;
  delete process.env.OWNER_CLERK_ID;
});

test("delivery audit headlines use matches and watches for plural counts", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  await t.mutation(internal.health.logRun, { at: now, checked: 0, failed: 0, emails: 0, emailFailures: 0 });
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const ids: import("./_generated/dataModel").Id<"watches">[] = [];
  for (let i = 0; i < 5; i++) ids.push(await alice.mutation(api.watches.create,
    { query: `bike ${i}`, schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" }));
  await t.run(async (ctx) => {
    for (let i = 0; i < ids.length; i++) {
      const watch = await ctx.db.get(ids[i]);
      const misses = Array.from({ length: i === 0 ? 7 : 6 }, (_, j) => ({
        listingId: `${i}-${j}`, title: "Bike", url: "https://example.com", score: 8, kind: "never_read" as const,
      }));
      await ctx.db.insert("audits", { at: now, watchId: ids[i], userId: watch!.userId, requestId: `audit-${i}`,
        ok: false, read: 0, scored: 0, missCount: misses.length, misses });
    }
  });
  const report = await t.query(internal.health.report, { now });
  expect(report.issues.find((issue) => issue.kind === "delivery_misses")?.headline).toBe("31 missed matches on 5 watches");
});
