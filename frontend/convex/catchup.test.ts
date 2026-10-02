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

test("catch-up uses the original first look's highest m number without seededAt", async () => {
  vi.setSystemTime(new Date("2026-09-29T19:28:00Z"));
  const { t, id } = await watch();
  vi.setSystemTime(new Date("2026-09-29T19:28:30Z"));
  await t.run((ctx) => ctx.db.insert("seenListings", { watchId: id, listingId: "m100", lastSeenAt: Date.now() }));
  vi.setSystemTime(new Date("2026-09-29T19:29:30Z"));
  await t.run((ctx) => ctx.db.insert("seenListings", { watchId: id, listingId: "m120", lastSeenAt: Date.now() }));
  vi.setSystemTime(new Date("2026-09-29T19:31:00Z"));
  await t.run((ctx) => ctx.db.insert("seenListings", { watchId: id, listingId: "m999", lastSeenAt: Date.now() }));
  vi.setSystemTime(new Date("2026-09-29T19:32:30Z"));
  await t.run((ctx) => ctx.db.insert("seenListings", { watchId: id, listingId: "a200", lastSeenAt: Date.now() }));
  vi.setSystemTime(new Date("2026-09-29T19:33:01Z"));
  await t.run((ctx) => ctx.db.insert("seenListings", { watchId: id, listingId: "m1000", lastSeenAt: Date.now() }));
  const payload = (await t.query(internal.catchup.groups, {}))[0].watches[0];
  expect(payload.created_mark).toBe(120);
  expect(payload.baseline_ids).toEqual([]);
  expect(payload.check_alive).toBe(true);
  await t.run((ctx) => ctx.db.patch(id, { seededAt: Date.parse("2026-09-29T19:32:30Z") }));
  const seededPayload = (await t.query(internal.catchup.groups, {}))[0].watches[0];
  expect(seededPayload.baseline_ids).toEqual(["m999", "a200", "m1000"]);
  expect(seededPayload.created_mark).toBeUndefined();
});

test("preview stores ten exact items; send uses the plan once without another audit", async () => {
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
    expect(body.watches[0]).toMatchObject({ id, check_alive: true, since_days: 1 });
    return new Response(JSON.stringify({ results: [{ watchId: id, ok: true, read: 12, candidates: 12,
      scored: 12, unscored: 0, missCount: 12, misses }] }));
  }));
  const { planId, preview } = await t.action(internal.catchup.run, {});
  expect(preview).toHaveLength(1);
  expect(preview[0]).toMatchObject({ userEmail: "alice@example.com", watchLabel: "Mac mini" });
  expect(preview[0].listings).toHaveLength(10);
  expect(preview[0].listings[0]).toEqual({ score: 20, title: "Mac mini 0", price: 100,
    url: "https://www.marktplaats.nl/v/m0" });
  expect(await t.run((ctx) => ctx.db.query("alerts").collect())).toEqual([]);
  expect(mails).toEqual([]);
  expect(await t.run((ctx) => ctx.db.get(planId))).toMatchObject({ status: "draft", items: [
    { watchId: id, listingId: "m0", score: 20, title: "Mac mini 0", priceEur: 100 },
    ...Array.from({ length: 9 }, () => expect.any(Object)),
  ] });

  await t.action(internal.catchup.send, { planId });
  const alerts = await t.run((ctx) => ctx.db.query("alerts").collect());
  expect(alerts).toHaveLength(10);
  expect(alerts.map((a) => a.listingId).sort()).toEqual(Array.from({ length: 10 }, (_, i) => `m${i}`).sort());
  expect(alerts.every((a) => a.catchUp && a.emailStatus === "sent")).toBe(true);
  expect(mails).toHaveLength(1);
  expect(mails[0].subject).toBe("Matches we missed for Mac mini");
  expect(mails[0].text).toContain("Matches we missed, sorry");
  expect(mails[0].text).toContain("A bug on 29–30 September kept these from you. It's fixed now; these are still online.");
  expect(mails[0].text).toContain(`/rate/?a=${encodeURIComponent(alerts[0]._id)}`);

  expect((await t.run((ctx) => ctx.db.get(planId)))?.status).toBe("sent");
  await t.action(internal.catchup.send, { planId });
  expect(await t.run((ctx) => ctx.db.query("alerts").collect())).toHaveLength(10);
  expect(mails).toHaveLength(1);
  expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/api/internal/audit"))).toHaveLength(1);
});

test("catch-up window follows Amsterdam calendar days since 29 September, capped at seven", async () => {
  const { t } = await watch();
  expect((await t.query(internal.catchup.groups, {}))[0].watches[0].since_days).toBe(1);
  vi.setSystemTime(new Date("2026-10-02T00:30:00Z"));
  expect((await t.query(internal.catchup.groups, {}))[0].watches[0].since_days).toBe(3);
  vi.setSystemTime(new Date("2026-10-10T00:30:00Z"));
  expect((await t.query(internal.catchup.groups, {}))[0].watches[0].since_days).toBe(7);
});

test("top-up plan preserves explicit items and skips an already alerted listing on the same watch", async () => {
  const { t, id } = await watch();
  await t.run(async (ctx) => {
    const w = await ctx.db.get(id);
    await ctx.db.insert("alerts", { userId: w!.userId, watchId: id, listingId: "already",
      title: "Already sent", url: "https://www.marktplaats.nl/v/already", reason: "match",
      channel: "email", emailStatus: "sent", catchUp: true, createdAt: Date.now() });
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
  const userId = (await t.run((ctx) => ctx.db.get(id)))!.userId;
  const items = ["already", "new"].map((listingId) => ({ watchId: id, userId, listingId,
    title: listingId, url: `https://www.marktplaats.nl/v/${listingId}`, score: 9,
    priceEur: 40, city: "Amsterdam", image: "https://images.test/photo.jpg" }));
  const planId = await t.mutation(internal.catchup.planFromItems, { items });
  expect(await t.run((ctx) => ctx.db.get(planId))).toMatchObject({ status: "draft", items });
  await t.action(internal.catchup.send, { planId });
  const alerts = await t.run((ctx) => ctx.db.query("alerts").collect());
  expect(alerts).toHaveLength(2);
  expect(alerts.find((a) => a.listingId === "new")).toMatchObject({ catchUp: true, emailStatus: "failed",
    city: "Amsterdam", image: "https://images.test/photo.jpg" });
  expect(alerts.find((a) => a.listingId === "already")?.emailStatus).toBe("sent");
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  await t.action(internal.catchup.send, { planId });
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
});

test("audit plans reuse the same day and allow one owner notice claim", async () => {
  const { t, id } = await watch();
  const userId = (await t.run((ctx) => ctx.db.get(id)))!.userId;
  const item = { watchId: id, userId, listingId: "m1", title: "Mac mini",
    url: "https://www.marktplaats.nl/v/m1", score: 9 };
  const planId = await t.mutation(internal.catchup.planFromItems, { items: [item], auditDay: "2026-09-30" });
  expect(await t.mutation(internal.catchup.planFromItems, { items: [{ ...item, listingId: "m2" }],
    auditDay: "2026-09-30" })).toBe(planId);
  expect(await t.run((ctx) => ctx.db.get(planId))).toMatchObject({ status: "draft", items: [item] });
  expect(await t.mutation(internal.catchup.claimOwnerNotice, { planId })).toEqual([
    { user: "alice@example.com", watch: "Mac mini", title: "Mac mini", score: 9,
      url: "https://www.marktplaats.nl/v/m1" },
  ]);
  expect(await t.mutation(internal.catchup.claimOwnerNotice, { planId })).toBeNull();
  expect(await t.run((ctx) => ctx.db.query("catchupPlans").collect())).toHaveLength(1);
});

test("preview keeps new listings when the watch already received a catch-up", async () => {
  const { t, id } = await watch();
  await t.run(async (ctx) => {
    const watch = (await ctx.db.get(id))!;
    await ctx.db.insert("alerts", { userId: watch.userId, watchId: id, listingId: "old",
      title: "Old", url: "https://www.marktplaats.nl/v/old", reason: "Match we missed.",
      channel: "email", catchUp: true, emailStatus: "sent", createdAt: Date.now() });
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ results: [{ watchId: id,
    ok: true, misses: ["old", "new"].map((listingId) => ({ id: listingId, title: listingId,
      url: `https://www.marktplaats.nl/v/${listingId}`, score: 9, kind: "handled" })) }] }))));
  const { planId, preview } = await t.action(internal.catchup.run, { dryRun: true });
  expect(preview[0].listings.map((item) => item.title)).toEqual(["new"]);
  expect((await t.run((ctx) => ctx.db.get(planId)))?.items.map((item) => item.listingId)).toEqual(["new"]);
});
