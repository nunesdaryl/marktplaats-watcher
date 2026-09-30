import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const hourly = { kind: "interval" as const, everyMinutes: 60 };
const macMini = { query: "mac mini", maxPriceEur: 500, schedule: hourly, notify: "good" as const };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-27T10:00:00Z"));
  process.env.WATCHER_API_URL = "https://watcher.test";
  process.env.CRON_SECRET = "s3cret";
  process.env.AGENTMAIL_API_KEY = "am_test";
  process.env.AGENTMAIL_INBOX_ID = "inbox@test";
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup() {
  const t = convexTest(schema, modules);
  return {
    t,
    alice: t.withIdentity({ subject: "user_alice", email: "alice@example.com" }),
    bob: t.withIdentity({ subject: "user_bob", email: "bob@example.com" }),
  };
}

test("a watch is listed with its schedule in plain English", async () => {
  const { alice } = setup();
  await alice.mutation(api.watches.create, { ...macMini, schedule: { kind: "daily", times: ["08:00"] } });
  const [watch] = await alice.query(api.watches.list, {});
  expect(watch.label).toBe("Mac mini, under €500");
  expect(watch.summary).toBe("every day at 08:00");
});

test("nobody can see or change someone else's watches", async () => {
  const { alice, bob } = setup();
  const id = await alice.mutation(api.watches.create, macMini);
  expect(await bob.query(api.watches.list, {})).toEqual([]);
  await expect(bob.mutation(api.watches.update, { id, active: false })).rejects.toThrow("Watch not found");
  await expect(bob.mutation(api.watches.remove, { id })).rejects.toThrow("Watch not found");
  await expect(bob.mutation(api.watches.checkNow, { id })).rejects.toThrow("Watch not found");
});

test("signed-out visitors can't create watches", async () => {
  const { t } = setup();
  await expect(t.mutation(api.watches.create, macMini)).rejects.toThrow("sign in");
});

test("at most 5 watches per user, and bad input is refused in plain English", async () => {
  const { alice } = setup();
  for (let i = 0; i < 5; i++) await alice.mutation(api.watches.create, { ...macMini, query: `item ${i}` });
  await expect(alice.mutation(api.watches.create, macMini)).rejects.toThrow("up to 5 watches");
  const { bob } = setup();
  await expect(bob.mutation(api.watches.create, { ...macMini, postcode: "abc" })).rejects.toThrow("1012AB");
  await expect(bob.mutation(api.watches.create, { ...macMini, schedule: { kind: "interval", everyMinutes: 1 } }))
    .rejects.toThrow("every 15 or 30 minutes");
});

test("changing the schedule moves the next check", async () => {
  const { t, alice } = setup();
  const id = await alice.mutation(api.watches.create, macMini);
  await t.run((ctx) => ctx.db.patch(id, { seeded: true }));
  await alice.mutation(api.watches.update, { id, schedule: { kind: "daily", times: ["08:00"] } });
  const watch = await t.run((ctx) => ctx.db.get(id));
  expect(watch!.nextRunAt).toBe(Date.parse("2026-09-28T06:00:00Z"));  // tomorrow 08:00 in Amsterdam
});

function fakeSearchService(answer: (body: any) => unknown) {
  const calls: { headers: Record<string, string>; body: any }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    if (url.includes("agentmail")) return new Response("{}");      // alert e-mails "sent"
    const body = JSON.parse(init.body as string);
    calls.push({ headers: init.headers as Record<string, string>, body });
    return new Response(JSON.stringify({ results: answer(body) }));
  }));
  return calls;
}

const item = (id: string, score: number | null) => ({
  id, title: `Mac mini ${id}`, price_eur: 400, city: "Utrecht", distance_km: null, url: `https://www.marktplaats.nl/v/${id}`,
  score, reason: "fair price",
});

test("first check only remembers what is there; later checks alert on good new listings once", async () => {
  const { t, alice } = setup();
  const id = await alice.mutation(api.watches.create, macMini);

  let page = ["a1", "a2"], ranked = [item("a1", 9), item("a2", 9)];
  const calls = fakeSearchService((body) => body.watches.map((w: any) => ({
    watchId: w.id, ok: true, currentIds: page, listings: ranked.filter((l) => !w.seen_ids.includes(l.id)),
  })));

  expect(await t.action(internal.checker.checkDue, {})).toEqual({ checked: 1, emails: 0 });
  expect(calls[0].headers["X-Cron-Secret"]).toBe("s3cret");
  expect((await alice.query(api.watches.list, {}))[0].alerts).toEqual([]);   // no e-mail about old listings

  // Not due yet: nothing is fetched
  await t.action(internal.checker.checkDue, {});
  expect(calls).toHaveLength(1);

  // An hour later a great one (a3) and a poor one (a4) appear
  vi.setSystemTime(new Date("2026-09-27T11:00:01Z"));
  page = ["a1", "a2", "a3", "a4"];
  ranked = [item("a3", 9), item("a4", 2)];
  await t.action(internal.checker.checkDue, {});
  expect(calls[1].body.watches[0].seen_ids.sort()).toEqual(["a1", "a2"]);
  const alerts = (await alice.query(api.watches.list, {}))[0].alerts;
  expect(alerts.map((a) => [a.listingId, a.emailStatus])).toEqual([["a3", "sent"]]);

  // The same listings again: no second alert
  vi.setSystemTime(new Date("2026-09-27T12:00:01Z"));
  await t.action(internal.checker.checkDue, {});
  expect((await alice.query(api.watches.list, {}))[0].alerts).toHaveLength(1);
  const watch = await t.run((ctx) => ctx.db.get(id));
  expect(watch!.seeded).toBe(true);
  expect(watch!.lastError).toBeUndefined();
});

test("watches for the same item share one Marktplaats request", async () => {
  const { t, alice, bob } = setup();
  await alice.mutation(api.watches.create, macMini);
  await bob.mutation(api.watches.create, { ...macMini, query: "Mac Mini", maxPriceEur: 300 });
  const calls = fakeSearchService((body) => body.watches.map((w: any) => ({ watchId: w.id, ok: true, currentIds: [], listings: [] })));
  await t.action(internal.checker.checkDue, {});
  expect(calls).toHaveLength(1);
  expect(calls[0].body.watches).toHaveLength(2);
});

test("when the search service is down the watch shows an error and is retried within 30 minutes", async () => {
  const { t, alice } = setup();
  await alice.mutation(api.watches.create, { ...macMini, schedule: { kind: "weekly", days: ["mon"], time: "08:00" } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 502 })));
  await t.action(internal.checker.checkDue, {});
  const [watch] = await alice.query(api.watches.list, {});
  expect(watch.lastError).toMatch(/didn.t answer/);
  expect(watch.nextRunAt).toBe(Date.parse("2026-09-27T10:30:00Z"));   // not next Monday
});

test("a listing without a score is never alerted", async () => {
  const { t, alice } = setup();
  await alice.mutation(api.watches.create, macMini);
  let page = ["a1"];
  fakeSearchService((body) => body.watches.map((w: any) => ({ watchId: w.id, ok: true, currentIds: page,
    listings: page.filter((id) => !w.seen_ids.includes(id)).map((id) => item(id, null)) })));
  await t.action(internal.checker.checkDue, {});       // first check: seeds
  vi.setSystemTime(new Date("2026-09-27T11:00:01Z"));
  page = ["a1", "a2"];
  await t.action(internal.checker.checkDue, {});
  expect((await alice.query(api.watches.list, {}))[0].alerts).toEqual([]);
});

test("many watches for one item are split into requests of at most 20", async () => {
  const { t } = setup();
  for (let i = 0; i < 25; i++) {
    const user = t.withIdentity({ subject: `user_${i}`, email: `u${i}@example.com` });
    await user.mutation(api.watches.create, { ...macMini, maxPriceEur: 300 + i });
  }
  const calls = fakeSearchService((body) => body.watches.map((w: any) => ({ watchId: w.id, ok: true, currentIds: [], listings: [] })));
  await t.action(internal.checker.checkDue, {});
  expect(calls.map((c) => c.body.watches.length)).toEqual([20, 5]);
});

test("the newest 1500 seen listings are sent, not the first 1500 by id", async () => {
  const { t, alice } = setup();
  const id = await alice.mutation(api.watches.create, macMini);
  await t.run(async (ctx) => {
    for (let i = 0; i < 1505; i++)
      await ctx.db.insert("seenListings", { watchId: id, listingId: `a${String(i).padStart(5, "0")}`, lastSeenAt: i });
  });
  const [group] = await t.mutation(internal.checker.claimDue, { now: Date.now() });
  const sent = group.watches[0].seen_ids;
  expect(sent).toHaveLength(1500);
  expect(sent).toContain("a01504");          // newest kept
  expect(sent).not.toContain("a00000");      // oldest dropped
});

test("Check now on a paused watch asks to resume first", async () => {
  const { alice } = setup();
  const id = await alice.mutation(api.watches.create, macMini);
  await alice.mutation(api.watches.update, { id, active: false });
  await expect(alice.mutation(api.watches.checkNow, { id })).rejects.toThrow("paused. Resume it first");
  const [watch] = await alice.query(api.watches.list, {});
  expect(watch.active).toBe(false);
});

test("deleting my data removes the user, watches and alerts", async () => {
  const { t, alice } = setup();
  await alice.mutation(api.watches.create, macMini);
  await alice.mutation(api.users.deleteMyData, {});
  const left = await t.run(async (ctx) => [
    ...(await ctx.db.query("users").collect()), ...(await ctx.db.query("watches").collect()),
  ]);
  expect(left).toEqual([]);
});

test("the same search can't be watched twice", async () => {
  const { alice } = setup();
  await alice.mutation(api.watches.create, macMini);
  await expect(alice.mutation(api.watches.create, { ...macMini, query: "Mac Mini", schedule: { kind: "daily", times: ["08:00"] } }))
    .rejects.toThrow('You already watch "Mac mini, under €500"');
  await alice.mutation(api.watches.create, { ...macMini, maxPriceEur: 400 });   // a different price is a different watch
});
