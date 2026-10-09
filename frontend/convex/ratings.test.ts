import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { ratingToken } from "./ratings";
import { REASONS } from "../src/lib/ratings.js";
import { RATING_REASONS } from "./schema";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
test("rating reason validator stays in sync with the user labels", () => {
  expect(RATING_REASONS).toEqual(REASONS.map(([key]) => key));
});
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
  expect(await t.mutation(api.ratings.rateWithToken, { alertId, token, verdict: "not_right" })).toMatchObject({ title: "Gazelle Orange C7", score: 9, query: "gazelle fiets", priceEur: 350 });
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
  expect((await owner.query(api.admin.ratings, { band: "good" }))!.rows[0]).toMatchObject({ verdict: "good", score: 7, email: "alice@example.com" });
  expect(await t.query(internal.ratings.exportAll, {})).toEqual([expect.objectContaining({
    verdict: "good", score: 7, watchDescription: "Gazelle fiets",
    listing: expect.objectContaining({ id: "l1", title: "Gazelle Orange C7", price_eur: 350 }),
  })]);
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
  expect(await t.query(internal.ratings.exportAll, {})).toEqual([expect.objectContaining({
    listing: expect.objectContaining({ id: "l1", price_eur: 350 }), watchDescription: "Gazelle fiets",
  })]);
});

test("export uses a live alert for ratings made before scorer snapshots existed", async () => {
  const { t, alice, alertId, rows } = await withAlert();
  await alice.mutation(api.ratings.rate, { alertId, verdict: "not_right" });
  const rating = (await rows())[0];
  await t.run((ctx) => ctx.db.patch(rating._id, { listing: undefined, watchDescription: undefined }));
  expect(await t.query(internal.ratings.exportAll, {})).toEqual([expect.objectContaining({
    id: rating._id, watchDescription: "Gazelle fiets",
    listing: expect.objectContaining({ id: "l1", price_eur: 350 }),
  })]);
});

test("one-tap fixes require the rated reason, change only the owner's watch, and undo within ten seconds", async () => {
  const { t, alice, watchId, alertId } = await withAlert();
  const watch = () => t.run((ctx) => ctx.db.get(watchId));
  const bob = t.withIdentity({ subject: "b", email: "bob@example.com" });
  await alice.mutation(api.ratings.explain, { alertId, reasons: ["not_asked", "price", "score_too_high"] });
  await expect(bob.mutation(api.ratings.fix, { alertId, kind: "exclude", word: "Orange" })).rejects.toThrow(/isn't yours/);
  await expect(alice.mutation(api.ratings.fix, { alertId, kind: "exclude", word: "" })).rejects.toThrow(/skip words/);
  await expect(alice.mutation(api.ratings.fix, { alertId, kind: "exclude", word: "x".repeat(31) })).rejects.toThrow(/skip words/);
  expect(await alice.mutation(api.ratings.fix, { alertId, kind: "exclude", word: "Orange" })).toMatchObject({ message: expect.stringContaining("orange") });
  expect((await watch())?.excludeWords).toEqual(["orange"]);
  await alice.mutation(api.ratings.undo, { alertId });
  expect((await watch())?.excludeWords).toEqual([]);

  await alice.mutation(api.ratings.fix, { alertId, kind: "price" });
  expect((await watch())?.maxPriceEur).toBe(345);
  await alice.mutation(api.ratings.undo, { alertId });
  expect((await watch())?.maxPriceEur).toBeUndefined();
  await expect(alice.mutation(api.ratings.fix, { alertId, kind: "price", priceEur: 350 })).rejects.toThrow(/below/);

  await alice.mutation(api.ratings.fix, { alertId, kind: "notify" });
  expect((await watch())?.notify).toBe("great");
  vi.advanceTimersByTime(10_001);
  await expect(alice.mutation(api.ratings.undo, { alertId })).rejects.toThrow(/10 seconds/);
  expect((await watch())?.notify).toBe("great");
});

test("score too low adds good e-mails; fixes reject mismatched reasons and allow signed e-mail undo", async () => {
  const { t, alice, watchId, alertId } = await withAlert();
  await alice.mutation(api.watches.update, { id: watchId, notify: "great" });
  await alice.mutation(api.ratings.explain, { alertId, reasons: ["score_too_low"] });
  await expect(alice.mutation(api.ratings.fix, { alertId, kind: "price" })).rejects.toThrow(/Price isn't good/);
  const token = (await ratingToken(alertId))!;
  await t.mutation(api.ratings.fixWithToken, { alertId, token, kind: "notify" });
  expect((await t.run((ctx) => ctx.db.get(watchId)))?.notify).toBe("good");
  await t.mutation(api.ratings.undoWithToken, { alertId, token });
  expect((await t.run((ctx) => ctx.db.get(watchId)))?.notify).toBe("great");
  await expect(t.mutation(api.ratings.fixWithToken, { alertId, token: "bad", kind: "notify" })).rejects.toThrow(/isn't valid/);
});

test("skip-word limits apply to direct watch edits too", async () => {
  const { alice, watchId, alertId } = await withAlert();
  await expect(alice.mutation(api.watches.update, { id: watchId, excludeWords: Array.from({ length: 11 }, (_, i) => `word${i}`) }))
    .rejects.toThrow(/up to 10/);
  await expect(alice.mutation(api.watches.update, { id: watchId, excludeWords: ["Mini", "mini"] }))
    .rejects.toThrow(/different/);
  await alice.mutation(api.watches.update, { id: watchId, excludeWords: Array.from({ length: 10 }, (_, i) => `word${i}`) });
  await alice.mutation(api.ratings.explain, { alertId, reasons: ["not_asked"] });
  await expect(alice.mutation(api.ratings.fix, { alertId, kind: "exclude", word: "orange" }))
    .rejects.toThrow(/up to 10/);
});

test("only this watch's latest eight ratings travel to its scorer request with short notes", async () => {
  const { t, alice, watchId, alertId } = await withAlert();
  await alice.mutation(api.ratings.explain, { alertId, reasons: ["not_asked"], note: "a".repeat(150) });
  const [group] = await t.mutation(internal.checker.claimDue, { now: Date.now() });
  const request = group.watches.find((w: { id: string }) => w.id === watchId)!;
  expect(request.rating_examples).toEqual([{ title: "Gazelle Orange C7", price_eur: 350,
    verdict: "not_right", reasons: ["not_asked"], note: "a".repeat(100) }]);
  expect(request.exclude_words).toEqual([]);
});
