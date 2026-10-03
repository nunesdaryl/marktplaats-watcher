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
    items: [{ watchId, userId, requestId: "audit-1", listingId: "listing-2", score: 8, title: "Mac Studio", url: "https://example.com/listing-2", kind: "never_read" }] });
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

test("the canary alarms after three hours without new reads or a failed check", async () => {
  vi.setSystemTime(new Date("2026-09-29T09:00:00Z")); // 11:00 Amsterdam
  const t = convexTest(schema, modules);
  const now = Date.now();
  await t.mutation(internal.health.logRun, { at: now, checked: 0, failed: 0, emails: 0, emailFailures: 0 });
  await t.mutation(internal.checker.claimCanary, { now });
  await t.mutation(internal.checker.recordCanary, { now, ok: true, readCount: 2, newestId: 101 });
  expect((await t.query(internal.health.report, { now })).issues.find((i) => i.kind === "canary_silent")).toBeUndefined();
  const later = now + 3 * 60 * 60_000;
  expect((await t.query(internal.health.report, { now: later })).issues.find((i) => i.kind === "canary_silent"))
    .toMatchObject({ severity: "high" });
  await t.mutation(internal.checker.claimCanary, { now: later });
  await t.mutation(internal.checker.recordCanary, { now: later, ok: false, error: "Search failed" });
  expect((await t.query(internal.health.report, { now: later })).problems).toContain("The canary check failed: Search failed.");
  process.env.CANARY_DISABLED = "1";
  expect((await t.query(internal.health.report, { now: later })).issues.find((i) => i.kind === "canary_silent")).toBeUndefined();
  delete process.env.CANARY_DISABLED;
});

test("a new canary gets three hours before an empty read becomes an alarm", async () => {
  vi.setSystemTime(new Date("2026-09-29T09:00:00Z")); // 11:00 Amsterdam
  const t = convexTest(schema, modules);
  const now = Date.now();
  await t.mutation(internal.checker.claimCanary, { now });
  await t.mutation(internal.checker.recordCanary, { now, ok: true, readCount: 0, newestId: null });
  expect((await t.query(internal.health.report, { now })).issues.find((i) => i.kind === "canary_silent")).toBeUndefined();
  expect((await t.query(internal.health.report, { now: now + 3 * 60 * 60_000 })).issues.find((i) => i.kind === "canary_silent"))
    .toMatchObject({ severity: "high" });
});

test.each([
  ["2026-09-29T09:00:00Z", "2026-09-29T12:00:00Z", true, "3"], // 11:00–14:00 Amsterdam
  ["2026-09-29T00:00:00Z", "2026-09-29T03:00:00Z", false, "6"], // 02:00–05:00 Amsterdam
  ["2026-09-28T22:30:00Z", "2026-09-29T04:30:00Z", true, "6"], // 00:30–06:30 Amsterdam
  ["2026-09-29T03:30:00Z", "2026-09-29T06:30:00Z", false, "6"], // 05:30–08:30 Amsterdam
  ["2026-09-29T05:30:00Z", "2026-09-29T08:30:00Z", false, "6"], // 07:30–10:30 Amsterdam
  ["2026-09-29T02:30:00Z", "2026-09-29T08:30:00Z", true, "6"], // 04:30–10:30 Amsterdam
  ["2026-09-29T06:00:00Z", "2026-09-29T09:00:00Z", true, "3"], // 08:00–11:00 Amsterdam
])("canary silence at %s through %s alarms=%s", async (start, end, alarm, hours) => {
  const t = convexTest(schema, modules);
  const at = Date.parse(start);
  await t.mutation(internal.checker.claimCanary, { now: at });
  await t.mutation(internal.checker.recordCanary, { now: at, ok: true, readCount: 0, newestId: 100 });
  const report = await t.query(internal.health.report, { now: Date.parse(end) });
  const issue = report.issues.find((i) => i.kind === "canary_silent");
  expect(!!issue).toBe(alarm);
  if (alarm) {
    expect(issue?.headline).toBe("Canary read no new organic iphone listings");
    expect(report.problems).toContain(`The canary read 0 new iphone listings (paid placements excluded) in the last ${hours} hours.`);
    expect(issue?.items[0].label).toBe(`0 new iphone listings (paid placements excluded) in the last ${hours} hours`);
  }
});

test("a failed canary read alarms immediately during Amsterdam night hours", async () => {
  const t = convexTest(schema, modules);
  const at = Date.parse("2026-09-29T01:00:00Z");
  await t.mutation(internal.checker.claimCanary, { now: at });
  await t.mutation(internal.checker.recordCanary, { now: at, ok: false, error: "Search failed" });
  expect((await t.query(internal.health.report, { now: at })).problems).toContain("The canary check failed: Search failed.");
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

test("the report, digest, and dashboard count only the latest audit for a watch", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  await t.mutation(internal.health.logRun, { at: now, checked: 1, failed: 0, emails: 0, emailFailures: 0 });
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const watchId = await alice.mutation(api.watches.create,
    { query: "bike", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const watch = await t.run((ctx) => ctx.db.get(watchId));
  const misses = (count: number) => Array.from({ length: count }, (_, i) => ({
    listingId: `listing-${i}`, title: "Bike", url: "https://example.com", score: 8,
    kind: i === 0 ? "rescored" as const : "never_read" as const, ...(i === 0 ? { checkScore: 2 } : {}),
  }));
  await t.run(async (ctx) => {
    await ctx.db.insert("audits", { at: now - 60_000, watchId, userId: watch!.userId, requestId: "manual",
      ok: false, read: 0, scored: 0, missCount: 31, misses: misses(31), error: "old failure" });
    await ctx.db.insert("audits", { at: now, watchId, userId: watch!.userId, requestId: "nightly",
      ok: true, read: 0, scored: 0, missCount: 3, misses: misses(3) });
  });
  const report = await t.query(internal.health.report, { now });
  expect(report.problems).toEqual([expect.stringContaining("3 missed match(es) on 1 watch(es)")]);
  expect(report.problems[0]).toContain("request nightly");
  expect(report.issues.find((issue) => issue.kind === "delivery_misses")).toMatchObject({
    headline: "3 missed matches on 1 watch", count: 3,
  });
  expect(report.issues.find((issue) => issue.kind === "delivery_misses")?.items).toHaveLength(3);
  expect(report.issues.find((issue) => issue.kind === "delivery_misses")?.items[0]).toMatchObject({ kind: "rescored", checkScore: 2 });
  expect(report.issues.some((issue) => issue.kind === "audit_failed")).toBe(false);
  expect(report.summary).toContain("Delivery audit: 1 watches checked, 3 misses.");
  const digest = await t.action(internal.health.digest, { dryRun: true });
  expect(digest.problems).toEqual(report.problems);
  expect(digest.summary).toBe(report.summary);
  process.env.OWNER_CLERK_ID = "owner";
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const dashboard = await owner.query(api.admin.dashboard, {});
  expect(dashboard?.deliveryAudit.misses).toBe(3);
  expect(dashboard?.health.issues.find((issue) => issue.kind === "delivery_misses")?.count).toBe(3);
  delete process.env.OWNER_CLERK_ID;
});

test("the report sums each watch's latest audit and reports only current failures", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const ids = await Promise.all(["bike", "chair"].map((query) => alice.mutation(api.watches.create,
    { query, schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" })));
  await t.run(async (ctx) => {
    const watches = await Promise.all(ids.map((id) => ctx.db.get(id)));
    const miss = { listingId: "listing", title: "Item", url: "https://example.com", score: 8, kind: "never_read" as const };
    await ctx.db.insert("audits", { at: now - 60_000, watchId: ids[0], userId: watches[0]!.userId,
      requestId: "bike-old", ok: false, read: 0, scored: 0, missCount: 2, misses: [miss, miss], error: "old failure" });
    await ctx.db.insert("audits", { at: now, watchId: ids[0], userId: watches[0]!.userId,
      requestId: "bike-new", ok: true, read: 0, scored: 0, missCount: 1, misses: [miss] });
    await ctx.db.insert("audits", { at: now, watchId: ids[1], userId: watches[1]!.userId,
      requestId: "chair-new", ok: false, read: 0, scored: 0, missCount: 2, misses: [miss, miss], error: "current failure" });
  });
  const report = await t.query(internal.health.report, { now });
  expect(report.issues.find((issue) => issue.kind === "delivery_misses")).toMatchObject({
    headline: "3 missed matches on 2 watches", count: 3,
  });
  expect(report.issues.find((issue) => issue.kind === "delivery_misses")?.items).toHaveLength(3);
  expect(report.issues.find((issue) => issue.kind === "audit_failed")).toMatchObject({
    count: 1, items: [{ watchId: ids[1], requestId: "chair-new" }],
  });
  expect(report.problems.filter((problem) => problem.startsWith("Delivery audit failed"))).toEqual([
    expect.stringContaining("current failure"),
  ]);
  expect(report.summary).toContain("Delivery audit: 2 watches checked, 3 misses.");
});

test("a watch quiet for three days with a qualifying unsent score appears in the report and digest", async () => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  await t.mutation(internal.health.logRun, { at: now, checked: 1, failed: 0, emails: 0, emailFailures: 0 });
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const watchId = await alice.mutation(api.watches.create,
    { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(watchId, { seeded: true, seededAt: now - 4 * 86_400_000 }));
  for (const [daysAgo, score, title] of [[2, 4, "Older Mac"], [1, 9, "Best Mac"], [0, 7, "Other Mac"]] as const) {
    vi.setSystemTime(now - daysAgo * 86_400_000);
    await t.run((ctx) => ctx.db.insert("seenListings", { watchId, listingId: title, lastSeenAt: Date.now(), firstSeenAt: Date.now(),
      scoredAt: Date.now(), score, title, url: `https://www.marktplaats.nl/v/${daysAgo}` }));
  }
  vi.setSystemTime(now);
  const report = await t.query(internal.health.report, { now });
  expect(report.issues.find((issue) => issue.kind === "watch_quiet")).toMatchObject({ count: 1,
    items: [{ label: "Mac mini", watchId, score: 9, title: "Best Mac", url: "https://www.marktplaats.nl/v/1" }] });
  expect(report.problems).toEqual([expect.stringContaining('"Mac mini"')]);
  expect(report.problems[0]).toContain('"Best Mac"');
  expect(report.problems[0]).toContain("9/10");
  expect(report.problems[0]).toContain("https://www.marktplaats.nl/v/1");
  expect((await t.action(internal.health.digest, { dryRun: true })).problems).toEqual(report.problems);
  process.env.OWNER_CLERK_ID = "owner";
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  expect((await owner.query(api.admin.dashboard, {}))?.health.issues.find((issue) => issue.kind === "watch_quiet"))
    .toMatchObject({ count: 1, items: [{ watchId, score: 9, title: "Best Mac" }] });
  delete process.env.OWNER_CLERK_ID;
});

test.each([
  ["no qualifying score", 4, true],
  ["paused", 9, false],
])("a quiet watch with %s raises no alarm", async (_case, score, active) => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  await t.mutation(internal.health.logRun, { at: now, checked: 1, failed: 0, emails: 0, emailFailures: 0 });
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const watchId = await alice.mutation(api.watches.create,
    { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(watchId, { seeded: true, seededAt: now - 4 * 86_400_000, active }));
  for (let daysAgo = 2; daysAgo >= 0; daysAgo--) {
    vi.setSystemTime(now - daysAgo * 86_400_000);
    await t.run((ctx) => ctx.db.insert("seenListings", { watchId, listingId: `m${daysAgo}`, lastSeenAt: Date.now(), firstSeenAt: Date.now(),
      scoredAt: Date.now(), score, title: "Mac mini", url: `https://www.marktplaats.nl/v/m${daysAgo}` }));
  }
  vi.setSystemTime(now);
  expect((await t.query(internal.health.report, { now })).issues.some((issue) => issue.kind === "watch_quiet")).toBe(false);
});

test.each(["an alert was sent", "only two days had new listings"])("a watch is not quiet when %s", async (reason) => {
  const t = convexTest(schema, modules);
  const now = Date.now();
  await t.mutation(internal.health.logRun, { at: now, checked: 1, failed: 0, emails: 0, emailFailures: 0 });
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const watchId = await alice.mutation(api.watches.create,
    { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const watch = await t.run((ctx) => ctx.db.get(watchId));
  await t.run((ctx) => ctx.db.patch(watchId, { seeded: true, seededAt: now - 4 * 86_400_000 }));
  const days = reason === "an alert was sent" ? [2, 1, 0] : [1, 0];
  for (const daysAgo of days) {
    vi.setSystemTime(now - daysAgo * 86_400_000);
    await t.run((ctx) => ctx.db.insert("seenListings", { watchId, listingId: `m${daysAgo}`,
      lastSeenAt: Date.now(), firstSeenAt: Date.now(), scoredAt: Date.now(), score: 9,
      title: "Mac mini", url: `https://www.marktplaats.nl/v/m${daysAgo}` }));
  }
  vi.setSystemTime(now);
  if (reason === "an alert was sent") await t.run((ctx) => ctx.db.insert("alerts", {
    userId: watch!.userId, watchId, listingId: "m2", title: "Mac mini", url: "https://www.marktplaats.nl/v/m2",
    score: 9, reason: "match", channel: "email", emailStatus: "sent", createdAt: now - 2 * 86_400_000,
  }));
  const report = await t.query(internal.health.report, { now });
  expect(report.issues.some((issue) => issue.kind === "watch_quiet")).toBe(false);
  expect(report.problems).toEqual([]);
});
