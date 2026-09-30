import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-30T20:00:00Z"));
  process.env.WATCHER_API_URL = "https://watcher.test";
  process.env.CRON_SECRET = "s3cret";
  process.env.AGENTMAIL_API_KEY = "am_test";
  process.env.AGENTMAIL_INBOX_ID = "inbox@test";
  process.env.RATING_SECRET = "rating-test-secret";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); delete process.env.RATING_SECRET; });

async function watch() {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "mac mini",
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(id, { seeded: true, lastReadAt: Date.now() - 60_000 }));
  return { t, id };
}

test("catch-up baseline uses the first seen listing after the re-seed when seededAt is absent", async () => {
  vi.setSystemTime(new Date("2026-09-29T19:28:00Z"));
  const { t, id } = await watch();
  vi.setSystemTime(new Date("2026-09-29T19:29:00Z"));
  await t.run((ctx) => ctx.db.insert("seenListings", { watchId: id, listingId: "before", lastSeenAt: Date.now() }));
  vi.setSystemTime(new Date("2026-09-29T19:31:00Z"));
  await t.run((ctx) => ctx.db.insert("seenListings", { watchId: id, listingId: "first", lastSeenAt: Date.now() }));
  vi.setSystemTime(new Date("2026-09-29T19:32:30Z"));
  await t.run((ctx) => ctx.db.insert("seenListings", { watchId: id, listingId: "within", lastSeenAt: Date.now() }));
  vi.setSystemTime(new Date("2026-09-29T19:33:01Z"));
  await t.run((ctx) => ctx.db.insert("seenListings", { watchId: id, listingId: "later", lastSeenAt: Date.now() }));
  const payload = (await t.query(internal.catchup.groups, {}))[0].watches[0];
  expect(payload.baseline_ids).toEqual(["first", "within"]);
  expect(payload.check_alive).toBe(true);
  await t.run((ctx) => ctx.db.patch(id, { seededAt: Date.parse("2026-09-29T19:32:30Z") }));
  expect((await t.query(internal.catchup.groups, {}))[0].watches[0].baseline_ids).toEqual(["first", "within", "later"]);
});

test("dry run writes nothing; send stores ten catch-up alerts once and uses their rating links", async () => {
  const { t, id } = await watch();
  const mails: any[] = [];
  const misses = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, title: `Mac mini ${i}`,
    url: `https://www.marktplaats.nl/v/m${i}`, score: 20 - i, price_eur: 100 + i, kind: "handled" }));
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    if (url.includes("agentmail")) {
      mails.push(body);
      return new Response("{}");
    }
    expect(init.headers).toMatchObject({ "X-Cron-Secret": "s3cret", "X-Request-Id": expect.stringMatching(/^audit-.*\.0$/) });
    expect(body.watches[0]).toMatchObject({ id, check_alive: true });
    return new Response(JSON.stringify({ results: [{ watchId: id, ok: true, read: 12, candidates: 12,
      scored: 12, unscored: 0, missCount: 12, misses }] }));
  }));
  const preview = await t.action(internal.catchup.run, {});
  expect(preview).toHaveLength(1);
  expect(preview[0]).toMatchObject({ userEmail: "alice@example.com", watchLabel: "Mac mini" });
  expect(preview[0].listings).toHaveLength(10);
  expect(preview[0].listings[0]).toEqual({ score: 20, title: "Mac mini 0", price: 100,
    url: "https://www.marktplaats.nl/v/m0" });
  expect(await t.run((ctx) => ctx.db.query("alerts").collect())).toEqual([]);
  expect(mails).toEqual([]);

  await t.action(internal.catchup.run, { dryRun: false });
  const alerts = await t.run((ctx) => ctx.db.query("alerts").collect());
  expect(alerts).toHaveLength(10);
  expect(alerts.every((a) => a.catchUp && a.emailStatus === "sent")).toBe(true);
  expect(mails).toHaveLength(1);
  expect(mails[0].subject).toBe("Matches we missed for Mac mini");
  expect(mails[0].text).toContain("Matches we missed, sorry");
  expect(mails[0].text).toContain("A bug on 29–30 September kept these from you. It's fixed now; these are still online.");
  expect(mails[0].text).toContain(`/rate/?a=${encodeURIComponent(alerts[0]._id)}`);

  await t.action(internal.catchup.run, { dryRun: false });
  expect(await t.run((ctx) => ctx.db.query("alerts").collect())).toHaveLength(10);
  expect(mails).toHaveLength(1);
});

test("catch-up excludes an existing alert and marks a failed send", async () => {
  const { t, id } = await watch();
  await t.run(async (ctx) => {
    const w = await ctx.db.get(id);
    await ctx.db.insert("alerts", { userId: w!.userId, watchId: id, listingId: "already",
      title: "Already sent", url: "https://www.marktplaats.nl/v/already", reason: "match",
      channel: "email", emailStatus: "sent", createdAt: Date.now() });
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("agentmail")
    ? new Response("unavailable", { status: 503 })
    : new Response(JSON.stringify({ results: [{ watchId: id, ok: true, read: 2, candidates: 2,
      scored: 2, missCount: 2, misses: ["already", "new"].map((name) => ({ id: name, title: name,
        url: `https://www.marktplaats.nl/v/${name}`, score: 9, kind: "handled", price_eur: 40 })) }] }))));
  const preview = await t.action(internal.catchup.run, { dryRun: true });
  expect(preview[0].listings.map((item) => item.title)).toEqual(["new"]);
  await t.action(internal.catchup.run, { dryRun: false });
  const alerts = await t.run((ctx) => ctx.db.query("alerts").collect());
  expect(alerts).toHaveLength(2);
  expect(alerts.find((a) => a.listingId === "new")).toMatchObject({ catchUp: true, emailStatus: "failed" });
  expect(alerts.find((a) => a.listingId === "already")?.emailStatus).toBe("sent");
});
