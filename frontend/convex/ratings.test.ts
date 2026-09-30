import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { ratingToken } from "./ratings";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T10:00:00Z"));
  process.env.RATING_SECRET = "test-rating-secret";
  process.env.OWNER_EMAIL = "owner@example.com";
  process.env.OWNER_CLERK_ID = "o";
});
afterEach(() => { vi.useRealTimers(); });

async function withAlert(score = 9) {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "alice@example.com" });
  const watchId = await alice.mutation(api.watches.create, { query: "gazelle fiets", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const alertId = await t.run(async (ctx) => {
    const w = (await ctx.db.get(watchId))!;
    return ctx.db.insert("alerts", { userId: w.userId, watchId, listingId: "l1", title: "Gazelle Orange C7", priceEur: 350,
      url: "https://www.marktplaats.nl/v/x", score, reason: "Right model under budget.", channel: "email", emailStatus: "sent", createdAt: Date.now() });
  });
  const rows = () => t.run((ctx) => ctx.db.query("ratings").collect());
  return { t, alice, watchId, alertId, rows };
}

test("in the app: rate your own alert; 'good match' needs no why, 'not right' can say why; a new rating replaces the old", async () => {
  const { t, alice, alertId, rows } = await withAlert();
  await alice.mutation(api.ratings.rate, { alertId, verdict: "good" });
  expect((await rows())[0]).toMatchObject({ verdict: "good", score: 9, source: "app", title: "Gazelle Orange C7", notify: "good" });
  await alice.mutation(api.ratings.explain, { alertId, reasons: ["score_too_high", "price"], note: "  €350 is too much for a C7  " });
  expect(await rows()).toHaveLength(1);
  expect((await rows())[0]).toMatchObject({ verdict: "not_right", reasons: ["score_too_high", "price"], note: "€350 is too much for a C7" });
  await alice.mutation(api.ratings.rate, { alertId, verdict: "not_right" });        // again: the why stays
  expect((await rows())[0].reasons).toEqual(["score_too_high", "price"]);
  await alice.mutation(api.ratings.rate, { alertId, verdict: "good" });             // changed their mind: no why kept
  const changed = (await rows())[0];
  expect(changed.verdict).toBe("good");
  expect(changed.reasons).toBeUndefined();
  expect(changed.note).toBeUndefined();
  expect(await alice.query(api.ratings.mine, {})).toEqual({ [alertId]: { verdict: "good", reasons: [], note: "" } });

  const bob = t.withIdentity({ subject: "b", email: "bob@example.com" });
  await expect(bob.mutation(api.ratings.rate, { alertId, verdict: "not_right" })).rejects.toThrow(/isn't yours/);
  await expect(t.mutation(api.ratings.rate, { alertId, verdict: "good" })).rejects.toThrow(/sign in/);
});

test("from the e-mail: the link's code rates only its own alert; a wrong or missing code is refused", async () => {
  const { t, alertId, rows } = await withAlert();
  const token = (await ratingToken(alertId))!;
  expect(token).toHaveLength(32);
  expect(await t.mutation(api.ratings.rateWithToken, { alertId, token, verdict: "not_right" })).toEqual({ title: "Gazelle Orange C7", score: 9 });
  await t.mutation(api.ratings.explainWithToken, { alertId, token, reasons: ["not_asked"] });
  expect((await rows())[0]).toMatchObject({ verdict: "not_right", reasons: ["not_asked"], source: "email" });
  await expect(t.mutation(api.ratings.rateWithToken, { alertId, token: token.replace(/.$/, (c) => (c === "A" ? "B" : "A")), verdict: "good" }))
    .rejects.toThrow(/isn't valid/);
  await expect(t.mutation(api.ratings.rateWithToken, { alertId: "not-an-id", token, verdict: "good" })).rejects.toThrow(/isn't valid/);
  delete process.env.RATING_SECRET;
  await expect(t.mutation(api.ratings.rateWithToken, { alertId, token, verdict: "good" })).rejects.toThrow(/isn't valid/);
});

test("delete my data removes ratings; the owner's stats count bands and the 'could be great' hint", async () => {
  const { t, alice, alertId, rows } = await withAlert(7);
  await alice.mutation(api.ratings.rate, { alertId, verdict: "good" });
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  expect(await alice.query(api.admin.ratingStats, {})).toBeNull();
  const stats = (await owner.query(api.admin.ratingStats, {}))!;
  expect(stats).toMatchObject({ rated: 1, good: 1, alertsSent: 1, goodCouldBeGreat: 1 });
  expect(stats.bands.find((b) => b.key === "good")).toMatchObject({ rated: 1, good: 1 });
  expect((await owner.query(api.admin.ratings, { band: "good" }))![0]).toMatchObject({ verdict: "good", score: 7, email: "alice@example.com" });
  expect(await t.query(internal.ratings.exportAll, {})).toEqual([expect.objectContaining({ verdict: "good", score: 7 })]);
  await alice.mutation(api.users.deleteMyData, {});
  expect(await rows()).toHaveLength(0);
});

test("removing a watch deletes only its ratings and leaves the owner's remaining rating count intact", async () => {
  const { t, alice, watchId, alertId, rows } = await withAlert(7);
  await alice.mutation(api.ratings.rate, { alertId, verdict: "good" });
  const otherWatchId = await alice.mutation(api.watches.create, { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const otherAlertId = await t.run(async (ctx) => {
    const watch = (await ctx.db.get(otherWatchId))!;
    return ctx.db.insert("alerts", { userId: watch.userId, watchId: otherWatchId, listingId: "l2", title: "Mac mini",
      url: "https://www.marktplaats.nl/v/y", score: 9, reason: "Good match.", channel: "email", emailStatus: "sent", createdAt: Date.now() });
  });
  await alice.mutation(api.ratings.rate, { alertId: otherAlertId, verdict: "good" });
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  expect((await owner.query(api.admin.ratingStats, {}))!.rated).toBe(2);

  await alice.mutation(api.watches.remove, { id: watchId });
  expect((await rows()).map((rating) => rating.alertId)).toEqual([otherAlertId]);
  expect((await owner.query(api.admin.ratingStats, {}))!.rated).toBe(1);
});

test("the daily purge deletes ratings last updated more than 12 months ago", async () => {
  const { t, alice, alertId, rows } = await withAlert();
  await alice.mutation(api.ratings.rate, { alertId, verdict: "good" });
  const rating = (await rows())[0];
  const cutoff = Date.parse("2025-09-29T10:00:00Z");
  await t.run(async (ctx) => {
    await ctx.db.patch(rating._id, { createdAt: cutoff - 86_400_000, updatedAt: cutoff });
  });
  await t.mutation(internal.checker.purgeOld, {});
  expect(await rows()).toHaveLength(1);

  await t.run((ctx) => ctx.db.patch(rating._id, { updatedAt: cutoff - 1 }));
  await t.mutation(internal.checker.purgeOld, {});
  expect(await rows()).toHaveLength(0);
});

test("a rating remains after its alert reaches the 30-day retention limit", async () => {
  const { t, alice, alertId, rows } = await withAlert();
  await alice.mutation(api.ratings.rate, { alertId, verdict: "good" });
  vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
  await t.mutation(internal.checker.purgeOld, {});
  expect(await t.run((ctx) => ctx.db.get(alertId))).toBeNull();
  expect(await rows()).toHaveLength(1);
});
