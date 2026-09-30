// The scheduled checks' failure and race cases, from the independent audit of 27 Sep 2026 (A01, A02, A05, A06).
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const hourly = { kind: "interval" as const, everyMinutes: 60 };
const watchArgs = { query: "mac mini", schedule: hourly, notify: "good" as const };
const listing = (id: string) => ({ id, title: `Mac mini ${id}`, price_eur: 400, city: null, distance_km: null,
  url: `https://www.marktplaats.nl/v/${id}`, score: 9, reason: "match" });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
  process.env.WATCHER_API_URL = "https://watcher.test";
  process.env.CRON_SECRET = "s3cret";
  process.env.AGENTMAIL_API_KEY = "am_test";
  process.env.AGENTMAIL_INBOX_ID = "inbox@test";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function seededWatch(schedule: any = hourly) {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const id = await alice.mutation(api.watches.create, { ...watchArgs, schedule });
  await t.run((ctx) => ctx.db.patch(id, { seeded: true, nextRunAt: Date.now() }));
  return { t, alice, id };
}
const found = (id: any, ids: string[]) => ({ watchId: id, ok: true, currentIds: ids, listings: ids.map(listing) });

/** A fake search service that always shows `page`, and a fake AgentMail that fails `failures` times first. */
function fakeServices(page: () => string[], failures = 0) {
  const mails: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    if (url.includes("agentmail")) {
      if (failures-- > 0) return new Response("unavailable", { status: 503 });
      mails.push(body);
      return new Response("{}");
    }
    return new Response(JSON.stringify({ results: body.watches.map((w: any) =>
      ({ ...found(w.id, page()), listings: page().filter((l) => !w.seen_ids.includes(l)).map(listing) })) }));
  }));
  return mails;
}
const alerts = (t: any) => t.run((ctx: any) => ctx.db.query("alerts").collect());

test("record stores and clears the waiting count and page cap", async () => {
  const { t, id } = await seededWatch();
  const report = (extra: object) => t.mutation(internal.checker.record, { now: Date.now(), dryRun: false,
    results: [{ ...found(id, []), ...extra }] });
  await report({ waiting: 30, capped: true });
  expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ backlog: 30, coverageCapped: true });
  await report({ waiting: 0, capped: false });
  const cleared = await t.run((ctx) => ctx.db.get(id));
  expect(cleared?.backlog).toBeUndefined();
  expect(cleared?.coverageCapped).toBeUndefined();
});

test("A02: a result that arrives after the watch was archived or paused is ignored", async () => {
  const { t, alice, id } = await seededWatch();
  const now = Date.now();
  await t.mutation(internal.checker.claimDue, { now });
  await alice.mutation(api.watches.setArchived, { id, archived: true });
  expect(await t.mutation(internal.checker.record, { now, results: [found(id, ["x1"])], dryRun: false })).toEqual([]);
  expect(await alerts(t)).toEqual([]);
});

test("A02: a result for the old search is ignored after the search was edited mid-check", async () => {
  const { t, alice, id } = await seededWatch();
  const now = Date.now();
  await t.mutation(internal.checker.claimDue, { now });
  await alice.mutation(api.watches.update, { id, query: "gazelle bike" });
  await t.mutation(internal.checker.record, { now, results: [found(id, ["old-mac"])], dryRun: false });
  const watch = await t.run((ctx) => ctx.db.get(id));
  expect(watch!.seeded).toBe(false);                                   // the new search still gets its silent first look
  expect(await t.run((ctx) => ctx.db.query("seenListings").collect())).toEqual([]);
});

test("A01: a failed alert e-mail is retried at the next ticks, then marked sent", async () => {
  const { t } = await seededWatch();
  let page = ["a1"];
  const mails = fakeServices(() => page, 2);                            // AgentMail fails twice
  await t.action(internal.checker.checkDue, {});
  expect((await alerts(t)).map((a: any) => a.emailStatus)).toEqual(["failed"]);
  vi.setSystemTime(new Date("2026-09-27T10:15:00Z"));
  await t.action(internal.checker.checkDue, {});                      // not due for a search, but the e-mail is retried
  expect((await alerts(t))[0].emailStatus).toBe("failed");
  vi.setSystemTime(new Date("2026-09-27T10:30:00Z"));
  await t.action(internal.checker.checkDue, {});
  expect((await alerts(t)).map((a: any) => [a.emailStatus, a.attempts])).toEqual([["sent", 3]]);
  expect(mails).toHaveLength(1);
  vi.setSystemTime(new Date("2026-09-27T10:45:00Z"));
  await t.action(internal.checker.checkDue, {});                      // sent once, never again
  expect(mails).toHaveLength(1);
});

test("A01: retries stop after 4 attempts, and never for a paused watch", async () => {
  const { t, alice, id } = await seededWatch();
  fakeServices(() => ["a1"], 99);
  for (let i = 0; i < 6; i++) {
    vi.setSystemTime(new Date(Date.parse("2026-09-27T10:00:00Z") + i * 15 * 60_000));
    await t.action(internal.checker.checkDue, {});
  }
  expect((await alerts(t)).map((a: any) => [a.emailStatus, a.attempts])).toEqual([["failed", 4]]);

  const other = await seededWatch();
  const mails = fakeServices(() => ["b1"], 1);
  await other.t.action(internal.checker.checkDue, {});
  await other.alice.mutation(api.watches.update, { id: other.id, active: false });
  vi.setSystemTime(new Date("2026-09-27T11:45:00Z"));
  await other.t.action(internal.checker.checkDue, {});
  expect(mails).toHaveLength(0);
  void alice; void id;
});

test("AgentMail timeout marks the alert for retry and records a timeout", async () => {
  const { t } = await seededWatch();
  const deadlines: number[] = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    deadlines.push(ms);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), ms);
    return controller.signal;
  });
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    if (url.includes("agentmail")) return new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
    });
    return Promise.resolve(new Response(JSON.stringify({ results: body.watches.map((w: any) => found(w.id, ["a1"])) })));
  }));

  const run = t.action(internal.checker.checkDue, {});
  await vi.advanceTimersByTimeAsync(15_000);
  await run;
  expect(deadlines).toEqual([240_000, 15_000]);
  expect((await alerts(t))[0].emailStatus).toBe("failed");
  expect((await t.run((ctx) => ctx.db.query("runs").collect())).find((r) => r.checked === 1))
    .toMatchObject({ checked: 1, failed: 0, emailFailures: 1, timeouts: 1 });
  expect(await t.mutation(internal.checker.claimEmailRetries, { now: Date.now() + 15 * 60_000 })).toHaveLength(1);
});

test("check-API timeout fails its watches and still processes later groups", async () => {
  const { t, alice, id } = await seededWatch();
  const other = await alice.mutation(api.watches.create, { ...watchArgs, query: "iphone" });
  await t.run((ctx) => ctx.db.patch(other, { seeded: true, nextRunAt: Date.now() }));
  const deadlines: number[] = [];
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    deadlines.push(ms);
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), ms);
    return controller.signal;
  });
  const queries: string[] = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    if (url.includes("agentmail")) return Promise.resolve(new Response("{}"));
    queries.push(body.query);
    if (body.query === "mac mini") return new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
    });
    return Promise.resolve(new Response(JSON.stringify({ results: body.watches.map((w: any) => found(w.id, [])) })));
  }));

  const run = t.action(internal.checker.checkDue, {});
  await vi.advanceTimersByTimeAsync(240_000);
  await run;
  expect(deadlines).toEqual([240_000, 240_000]);
  expect(queries).toEqual(["mac mini", "iphone"]);
  const watches = await t.run(async (ctx) => [await ctx.db.get(id), await ctx.db.get(other)]);
  expect(watches[0]).toMatchObject({ lastError: "Our search service didn't answer. We'll try again soon.", nextRunAt: Date.parse("2026-09-27T10:30:00Z") });
  expect(watches[1]!.lastError).toBeUndefined();
  expect((await t.run((ctx) => ctx.db.query("runs").collect())).find((r) => r.checked === 2))
    .toMatchObject({ checked: 2, failed: 1, timeouts: 1 });
});

test("check-API AbortError counts as a timeout and retries the watch", async () => {
  const { t, id } = await seededWatch();
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new DOMException("aborted", "AbortError"))));

  await t.action(internal.checker.checkDue, {});

  expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
    lastError: "Our search service didn't answer. We'll try again soon.",
    nextRunAt: Date.parse("2026-09-27T10:30:00Z"),
  });
  expect((await t.run((ctx) => ctx.db.query("runs").collect())).find((r) => r.checked === 1))
    .toMatchObject({ checked: 1, failed: 1, timeouts: 1 });
});

test("A06: a dry run changes nothing, so the real run afterwards still e-mails", async () => {
  const { t, id } = await seededWatch();
  const mails = fakeServices(() => ["a1"]);
  const before = await t.run((ctx) => ctx.db.get(id));
  expect(await t.action(internal.checker.checkDue, { dryRun: true })).toMatchObject({ checked: 1, emails: 0 });
  expect(await alerts(t)).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("seenListings").collect())).toEqual([]);
  expect(await t.run((ctx) => ctx.db.query("runs").collect())).toEqual([]);
  expect((await t.run((ctx) => ctx.db.get(id)))!.nextRunAt).toBe(before!.nextRunAt);
  await t.action(internal.checker.checkDue, {});
  expect(mails).toHaveLength(1);
});

test("A05: a check that crashed after claiming is picked up again within 30 minutes, not a week later", async () => {
  const { t, id } = await seededWatch({ kind: "weekly", days: ["sun"], time: "12:00" });
  await t.mutation(internal.checker.claimDue, { now: Date.now() });   // ...and then the action dies
  expect(await t.mutation(internal.checker.claimDue, { now: Date.now() + 29 * 60_000 })).toEqual([]);
  expect(await t.mutation(internal.checker.claimDue, { now: Date.now() + 31 * 60_000 })).toHaveLength(1);
  // A check that does finish moves the watch on to its real next time
  vi.setSystemTime(new Date("2026-09-27T11:02:00Z"));
  fakeServices(() => []);
  await t.action(internal.checker.checkDue, {});
  const watch = await t.run((ctx) => ctx.db.get(id));
  expect(watch!.nextRunAt).toBe(Date.parse("2026-10-04T10:00:00Z"));  // next Sunday 12:00 in Amsterdam
});

test("the first check tells the search service not to score anything", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  await alice.mutation(api.watches.create, watchArgs);
  const [group] = await t.mutation(internal.checker.claimDue, { now: Date.now() });
  expect(group.watches[0].seeded).toBe(false);
});

test("rebaseline: every live watch takes a new silent first look, nothing is e-mailed for it", async () => {
  const { t, alice, id } = await seededWatch();
  const paused = await alice.mutation(api.watches.create, { ...watchArgs, query: "iphone" });
  await t.run((ctx) => ctx.db.patch(paused, { seeded: true, active: false, nextRunAt: Date.parse("2026-10-01T00:00:00Z") }));
  expect(await t.mutation(internal.checker.rebaseline, {})).toEqual({ rebaselined: 2 });
  const [live, stopped] = await t.run(async (ctx) => [await ctx.db.get(id), await ctx.db.get(paused)]);
  expect(live).toMatchObject({ seeded: false, nextRunAt: Date.now() });            // checked at the next run
  expect(stopped).toMatchObject({ seeded: false, nextRunAt: Date.parse("2026-10-01T00:00:00Z") });  // still paused
  fakeServices(() => ["other-1", "other-2"]);                                      // what the corrected search shows
  await t.action(internal.checker.checkDue, {});
  expect(await alerts(t)).toHaveLength(0);
  expect((await t.run((ctx) => ctx.db.get(id)))!.seeded).toBe(true);
});

test("the watermark and last check time go with each check; the watermark only rises", async () => {
  const { t, id } = await seededWatch();
  const check = async (newestId: number | null) => {
    const [group] = await t.mutation(internal.checker.claimDue, { now: Date.now() });
    await t.mutation(internal.checker.record, { now: Date.now(), dryRun: false,
      results: [{ watchId: group.watches[0].id, ok: true, currentIds: [], listings: [], newestId }] });
    vi.setSystemTime(Date.now() + 61 * 60_000);                          // due again an hour later
    return group.watches[0];
  };
  expect(await check(1100)).toMatchObject({ watermark: null, last_checked_at: null });   // none yet
  const second = await check(1090);
  expect(second.watermark).toBe(1100);                                   // 1090 doesn't lower it
  expect(second.last_checked_at).toBe(Date.parse("2026-09-27T10:00:00Z"));
  // A failed check doesn't move it: the next one still reads from the last check that worked
  const [failing] = await t.mutation(internal.checker.claimDue, { now: Date.now() });
  await t.mutation(internal.checker.record, { now: Date.now(), dryRun: false,
    results: [{ watchId: failing.watches[0].id, ok: false, error: "down" }] });
  vi.setSystemTime(Date.now() + 61 * 60_000);
  expect((await check(null)).watermark).toBe(1100);
  await check(1200);
  expect((await t.run((ctx) => ctx.db.get(id)))!.watermark).toBe(1200);
});

test("no numbered listings starts the watermark at 0; an older search service leaves it unset", async () => {
  const { t, id } = await seededWatch();
  const report = (extra: object) => t.mutation(internal.checker.record, { now: Date.now(), dryRun: false,
    results: [{ watchId: id, ok: true, currentIds: [], listings: [], ...extra }] });
  await report({});
  expect((await t.run((ctx) => ctx.db.get(id)))!.watermark).toBeUndefined();
  await report({ newestId: null });
  expect((await t.run((ctx) => ctx.db.get(id)))!.watermark).toBe(0);
});

test("a different search, or a rebaseline, starts without a watermark", async () => {
  const { t, alice, id } = await seededWatch();
  await t.run((ctx) => ctx.db.patch(id, { watermark: 1100 }));
  await alice.mutation(api.watches.update, { id, query: "iphone 13" });
  expect((await t.run((ctx) => ctx.db.get(id)))!.watermark).toBeUndefined();
  await t.run((ctx) => ctx.db.patch(id, { seeded: true, watermark: 1100 }));
  await t.mutation(internal.checker.rebaseline, {});
  const after = (await t.run((ctx) => ctx.db.get(id)))!;
  expect(after.seeded).toBe(false);
  expect(after.watermark).toBeUndefined();
  const [group] = await t.mutation(internal.checker.claimDue, { now: Date.now() });
  expect(group.watches[0]).toMatchObject({ watermark: null, last_checked_at: null });   // a first look
});

// Round 2 of the audit (R1, R2, R3, R7): its reproductions, now expecting the fixed behaviour
const item400 = { ...listing("old-result"), price_eur: 400 };
async function macMiniUnder500() {
  const t = convexTest(schema, modules);
  const u = t.withIdentity({ subject: "audit-user", email: "audit@example.com" });
  const id = await u.mutation(api.watches.create, { query: "mac mini", maxPriceEur: 500, schedule: hourly, notify: "good" });
  await t.run((ctx) => ctx.db.patch(id, { seeded: true }));
  return { t, u, id };
}
const addAlert = (t: any, id: any, patch: any = {}) => t.run(async (ctx: any) => {
  const w = await ctx.db.get(id);
  return ctx.db.insert("alerts", { userId: w.userId, watchId: id, listingId: "l1", title: "Mac mini 8GB",
    url: "https://www.marktplaats.nl/v/l1", reason: "match", channel: "email", emailStatus: "pending",
    createdAt: Date.now() - 31 * 60_000, ...patch });
});

test("R2: a result for the old price limit is ignored after the limit was lowered mid-check", async () => {
  const { t, u, id } = await macMiniUnder500();
  const claimTime = Date.now();
  await t.mutation(internal.checker.claimDue, { now: claimTime });
  vi.setSystemTime(claimTime + 1000);
  await u.mutation(api.watches.update, { id, maxPriceEur: 300 });
  const mails = await t.mutation(internal.checker.record, { now: claimTime,
    results: [{ watchId: id, ok: true, currentIds: [item400.id], listings: [item400] }], dryRun: false });
  expect(mails).toEqual([]);
  expect(await alerts(t)).toEqual([]);
});

test("R2: an unsent alert for the old search is not retried under the new search's name", async () => {
  const { t, u, id } = await macMiniUnder500();
  const alertId = await addAlert(t, id, { emailStatus: "failed" });
  vi.setSystemTime(Date.now() + 1000);
  await u.mutation(api.watches.update, { id, query: "gazelle bike" });
  expect(await t.mutation(internal.checker.claimEmailRetries, { now: Date.now() })).toEqual([]);
  expect(await t.run((ctx) => ctx.db.get(alertId))).toMatchObject({ emailStatus: "failed" });
});

test("R3: a schedule changed during a check is kept when the check finishes", async () => {
  const { t, u, id } = await macMiniUnder500();
  const claimTime = Date.now();
  await t.mutation(internal.checker.claimDue, { now: claimTime });
  vi.setSystemTime(claimTime + 10 * 60_000);
  await u.mutation(api.watches.update, { id, schedule: { kind: "daily", times: ["12:05"] } });
  await t.mutation(internal.checker.record, { now: claimTime, results: [{ watchId: id, ok: true, currentIds: [], listings: [] }], dryRun: false });
  expect((await t.run((ctx) => ctx.db.get(id)))!.nextRunAt).toBe(Date.parse("2026-09-28T10:05:00Z"));
});

test("R3: Check now during a running check doesn't start a second one, and runs right after it", async () => {
  const { t, u, id } = await macMiniUnder500();
  const claimTime = Date.now();
  expect(await t.mutation(internal.checker.claimDue, { now: claimTime })).toHaveLength(1);
  vi.setSystemTime(claimTime + 1000);
  await u.mutation(api.watches.checkNow, { id });
  expect(await t.mutation(internal.checker.claimDue, { now: Date.now() })).toEqual([]);   // still leased
  await t.mutation(internal.checker.record, { now: claimTime, results: [{ watchId: id, ok: true, currentIds: [], listings: [] }], dryRun: false });
  expect(await t.mutation(internal.checker.claimDue, { now: Date.now() })).toHaveLength(1);   // the manual check runs next
});

test("R1: overlapping retry claims can't take the same alert twice; a crash on the last try shows up as failed", async () => {
  const { t, id } = await macMiniUnder500();
  const alertId = await addAlert(t, id);
  const claims = [];
  for (let i = 0; i < 3; i++) claims.push(await t.mutation(internal.checker.claimEmailRetries, { now: Date.now() }));
  expect(claims.map((m) => m.length)).toEqual([1, 0, 0]);
  expect(await t.run((ctx) => ctx.db.get(alertId))).toMatchObject({ emailStatus: "pending", attempts: 2 });

  await t.run((ctx) => ctx.db.patch(alertId, { attempts: 4, attemptAt: Date.now() - 31 * 60_000 }));   // last try died
  expect(await t.mutation(internal.checker.claimEmailRetries, { now: Date.now() })).toEqual([]);
  expect(await t.run((ctx) => ctx.db.get(alertId))).toMatchObject({ emailStatus: "failed", attempts: 4 });
  await t.mutation(internal.health.logRun, { at: Date.now(), checked: 0, failed: 0, emails: 0, emailFailures: 0 });
  expect((await t.query(internal.health.report, { now: Date.now() })).problems.join()).toMatch(/1 alert e-mail\(s\) failed/);
});

test("R1: alerts that used up their tries don't hide newer ones that can still be retried", async () => {
  const { t, id } = await macMiniUnder500();
  for (let i = 0; i < 200; i++) await addAlert(t, id, { listingId: `old-${i}`, emailStatus: "failed", attempts: 4 });
  const eligible = await addAlert(t, id, { listingId: "new", emailStatus: "failed", attempts: 1, createdAt: Date.now() - 1000 });
  const [mail] = await t.mutation(internal.checker.claimEmailRetries, { now: Date.now() });
  expect(mail.alertIds).toEqual([eligible]);
});

test("R7: a listing id that appears twice is previewed once, like a real run records it once", async () => {
  const { t, id } = await macMiniUnder500();
  const r = { watchId: id, ok: true, currentIds: [item400.id, item400.id], listings: [item400] };
  const preview = await t.mutation(internal.checker.record, { now: Date.now(), results: [r], dryRun: true });
  expect(preview[0].preview!.alerts).toHaveLength(1);
});

test("a watch due within 2 minutes is taken by this run, so 'every 15 minutes' doesn't skip a round", async () => {
  const { t, id } = await seededWatch({ kind: "interval", everyMinutes: 15 });
  // Its last check finished 40 s after the previous run started: due 40 s after this run starts
  await t.run((ctx) => ctx.db.patch(id, { nextRunAt: Date.now() + 40_000 }));
  expect(await t.mutation(internal.checker.claimDue, { now: Date.now() })).toHaveLength(1);
  // Not something due later than the leeway
  const { t: t2, id: id2 } = await seededWatch({ kind: "interval", everyMinutes: 15 });
  await t2.run((ctx) => ctx.db.patch(id2, { nextRunAt: Date.now() + 3 * 60_000 }));
  expect(await t2.mutation(internal.checker.claimDue, { now: Date.now() })).toEqual([]);
});

test("the Alerts tab counts alerts since the page was last open, and opening it clears the count", async () => {
  const { t, alice, id } = await seededWatch();
  const insert = (n: number) => t.run(async (ctx) => {
    const w = (await ctx.db.get(id))!;
    for (let i = 0; i < n; i++)
      await ctx.db.insert("alerts", { userId: w.userId, watchId: id, listingId: `l${Date.now()}-${i}`, title: "Mac mini", url: "https://x.test",
        score: 9, reason: "match", channel: "email", emailStatus: "sent", createdAt: Date.now() });
  });
  vi.setSystemTime(Date.now() + 1000);
  await insert(2);
  expect(await alice.query(api.watches.newAlertCount, {})).toBe(2);
  vi.setSystemTime(Date.now() + 1000);
  await alice.mutation(api.users.markAlertsSeen, {});
  expect(await alice.query(api.watches.newAlertCount, {})).toBe(0);
  vi.setSystemTime(Date.now() + 1000);
  await insert(12);
  expect(await alice.query(api.watches.newAlertCount, {})).toBe(10);    // capped: the tab shows "9+"
  expect(await t.query(api.watches.newAlertCount, {})).toBe(0);         // signed out
});

test("failed check groups record ids shared with the run and API headers", async () => {
  const { t } = await seededWatch();
  const headers: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    headers.push((init.headers as Record<string, string>)["X-Request-Id"]);
    return new Response("unavailable", { status: 503 });
  }));
  await t.action(internal.checker.checkDue, {});
  const [run] = await t.run((ctx) => ctx.db.query("runs").collect());
  const [error] = await t.run((ctx) => ctx.db.query("errors").collect());
  expect(run.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(headers).toEqual([`${run.requestId}.0`]);
  expect(error).toMatchObject({ kind: "check", requestId: headers[0], message: "Error: Search service answered 503." });
});
