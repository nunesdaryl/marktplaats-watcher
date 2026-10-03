import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const watch = { query: "mac mini", schedule: { kind: "interval" as const, everyMinutes: 60 }, notify: "good" as const };

async function fixture() {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "a@example.com" });
  const bob = t.withIdentity({ subject: "bob", email: "b@example.com" });
  const a = await alice.mutation(api.watches.create, watch);
  const b = await bob.mutation(api.watches.create, watch);
  const ids = await t.run(async (ctx) => {
    const make = async (watchId: typeof a, name: string) => {
      const w = (await ctx.db.get(watchId))!;
      return ctx.db.insert("alerts", { userId: w.userId, watchId, listingId: name, title: name,
        url: `https://example.test/${name}`, reason: "Good match", score: 9, channel: "email",
        emailStatus: "sent", createdAt: Date.now() });
    };
    return [await make(a, "Mac mini M5 Pro"), await make(b, "Bob's Mac mini")];
  });
  return { t, alice, bob, a, b, ids };
}

test("embedding action stores a separate row and skips a second insert", async () => {
  const { t, ids } = await fixture();
  process.env.WATCHER_API_URL = "https://watcher.test";
  process.env.CRON_SECRET = "secret";
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ vectors: [Array(1536).fill(0.1)] })));
  try {
    await t.action(internal.embeddings.embedAlerts, { alertIds: [ids[0]] });
    await t.action(internal.embeddings.embedAlerts, { alertIds: [ids[0]] });
    const rows = await t.run((ctx) => ctx.db.query("alertEmbeddings").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toContain("Mac mini M5 Pro · €");
    expect(rows[0].embedding).toHaveLength(1536);
  } finally { vi.unstubAllGlobals(); }
});

test("search route requires its secret and does not expose another user's alert", async () => {
  const { t, ids, a } = await fixture();
  process.env.API_TO_CONVEX_SECRET = "secret";
  await t.run(async (ctx) => {
    for (const id of ids) {
      const alert = (await ctx.db.get(id))!;
      await ctx.db.insert("alertEmbeddings", { alertId: id, userId: alert.userId, text: alert.title,
        embedding: Array(1536).fill(0.1), model: "text-embedding-3-small", createdAt: Date.now() });
    }
    const alert = (await ctx.db.get(ids[0]))!;
    await ctx.db.insert("ratings", { alertId: ids[0], userId: alert.userId, watchId: a, verdict: "good",
      reasons: ["price"], source: "app", createdAt: Date.now(), updatedAt: Date.now() });
  });
  const post = (secret: string) => t.fetch("/api/alerts/search", { method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Secret": secret },
    body: JSON.stringify({ clerkId: "alice", query: "Mac mini", vector: Array(1536).fill(0.1), limit: 5 }) });
  try {
    expect((await post("wrong")).status).toBe(401);
    const result = await post("secret");
    expect(result.status).toBe(200);
    const hits = await result.json();
    expect(hits.map((r: { alertId: string }) => r.alertId)).toEqual([ids[0]]);
    expect(hits[0]).toMatchObject({ watchLabel: "Mac mini", rating: { verdict: "good", reasons: ["price"] } });
  } finally { delete process.env.API_TO_CONVEX_SECRET; }
});

test("watch deletion and retention purge remove embedding rows", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T10:00:00Z"));
  const { t, alice, a, ids } = await fixture();
  await t.run(async (ctx) => {
    for (const id of ids) {
      const alert = (await ctx.db.get(id))!;
      await ctx.db.insert("alertEmbeddings", { alertId: id, userId: alert.userId, text: alert.title,
        embedding: Array(1536).fill(0.1), model: "text-embedding-3-small", createdAt: Date.now() });
    }
  });
  await alice.mutation(api.watches.remove, { id: a });
  expect((await t.run((ctx) => ctx.db.query("alertEmbeddings").collect())).map((r) => r.alertId)).toEqual([ids[1]]);
  vi.setSystemTime(new Date("2026-11-04T10:00:00Z"));
  await t.mutation(internal.checker.purgeOld, {});
  expect(await t.run((ctx) => ctx.db.query("alertEmbeddings").collect())).toEqual([]);
  vi.useRealTimers();
});

test("exact activity counts all alerts in the window before limiting results", async () => {
  const { t, ids, a } = await fixture();
  process.env.API_TO_CONVEX_SECRET = "secret";
  const response = await t.fetch("/api/alerts/activity", { method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Secret": "secret" },
    body: JSON.stringify({ clerkId: "alice", watchId: a, from: Date.now() - 1000, to: Date.now() + 1000, limit: 1 }) });
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.total).toBe(1);
  expect(body.alerts.map((r: { alertId: string }) => r.alertId)).toEqual([ids[0]]);
  delete process.env.API_TO_CONVEX_SECRET;
});

test("alert evidence returns only the caller's recorded alert", async () => {
  const { t, ids } = await fixture();
  process.env.API_TO_CONVEX_SECRET = "secret";
  const post = (alertId: string) => t.fetch("/api/alerts/evidence", { method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Secret": "secret" },
    body: JSON.stringify({ clerkId: "alice", alertId }) });
  try {
    const owned = await post(ids[0]);
    expect(owned.status).toBe(200);
    expect(await owned.json()).toMatchObject({ alertId: ids[0], title: "Mac mini M5 Pro", score10: 9 });
    expect(await (await post(ids[1])).json()).toBeNull();
  } finally { delete process.env.API_TO_CONVEX_SECRET; }
});

test("backfill dry run counts missing recent alerts without embedding them", async () => {
  const { t } = await fixture();
  const result = await t.action(internal.embeddings.backfill, { dryRun: true });
  expect(result).toEqual({ missing: 2, dryRun: true });
  expect(await t.run((ctx) => ctx.db.query("alertEmbeddings").collect())).toEqual([]);
});

test("backfill keeps its cutoff across two pages in dry-run and real mode", async () => {
  const seenSince: number[] = [];
  const embeddedIds: string[] = [];
  const mockEmbedAlerts = internalAction({
    args: { alertIds: v.array(v.id("alerts")) },
    handler: async (_ctx, { alertIds }) => { embeddedIds.push(...alertIds); },
  });
  const t = convexTest(schema, { ...modules, "./embeddings.ts": async () => {
    const original = await import("./embeddings");
    return { ...original, embedAlerts: mockEmbedAlerts, backfillPage: internalQuery({
      args: { since: v.number(), cursor: v.optional(v.string()) },
      handler: async (ctx, args) => {
        seenSince.push(args.since);
        const pageHandler = Reflect.get(original.backfillPage, "_handler") as
          (ctx: unknown, args: unknown) => Promise<unknown>;
        return pageHandler(ctx, args);
      },
    }) };
  } });
  const alice = t.withIdentity({ subject: "alice", email: "a@example.com" });
  const watchId = await alice.mutation(api.watches.create, watch);
  await t.run(async (ctx) => {
    const userId = (await ctx.db.get(watchId))!.userId;
    for (let i = 0; i < 101; i++) await ctx.db.insert("alerts", {
      userId, watchId, listingId: `backfill-${i}`, title: `Backfill ${i}`,
      url: `https://example.test/backfill-${i}`, reason: "Good match", score: 9,
      channel: "email", emailStatus: "sent", createdAt: Date.now(),
    });
  });
  const realNow = Date.now;
  let now = realNow();
  vi.spyOn(Date, "now").mockImplementation(() => ++now);
  try {
    expect(await t.action(internal.embeddings.backfill, { dryRun: true })).toEqual({ missing: 101, dryRun: true });
    expect(embeddedIds).toEqual([]);
    expect(await t.action(internal.embeddings.backfill, { dryRun: false })).toEqual({ missing: 101, dryRun: false });
    expect(embeddedIds).toHaveLength(101);
    expect(new Set(embeddedIds).size).toBe(101);
    expect(seenSince).toHaveLength(4);
    expect(seenSince[1]).toBe(seenSince[0]);
    expect(seenSince[3]).toBe(seenSince[2]);
  } finally { vi.restoreAllMocks(); }
});

test("delete my data removes that user's embedding only", async () => {
  const { t, alice, ids } = await fixture();
  await t.run(async (ctx) => {
    for (const id of ids) {
      const alert = (await ctx.db.get(id))!;
      await ctx.db.insert("alertEmbeddings", { alertId: id, userId: alert.userId, text: alert.title,
        embedding: Array(1536).fill(0.1), model: "text-embedding-3-small", createdAt: Date.now() });
    }
  });
  await alice.mutation(api.users.deleteMyData, {});
  expect((await t.run((ctx) => ctx.db.query("alertEmbeddings").collect())).map((r) => r.alertId)).toEqual([ids[1]]);
});

test("a newly recorded alert is embedded by its scheduled action", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-03T10:00:00Z"));
  const { t, a } = await fixture();
  await t.run((ctx) => ctx.db.patch(a, { seeded: true }));
  process.env.WATCHER_API_URL = "https://watcher.test";
  process.env.CRON_SECRET = "secret";
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ vectors: [Array(1536).fill(0.1)] })));
  try {
    await t.mutation(internal.checker.record, { now: Date.now(), dryRun: false,
      results: [{ watchId: a, ok: true, currentIds: ["new"], listings: [{ id: "new", title: "Mac mini M5 Pro",
        price_eur: 500, city: null, distance_km: null, url: "https://example.test/new", score: 9, reason: "Good" }] }] });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const row = await t.run((ctx) => ctx.db.query("alertEmbeddings").first());
    expect(row?.text).toBe("Mac mini M5 Pro · €500 · 9/10 · Good");
  } finally { vi.unstubAllGlobals(); vi.useRealTimers(); }
});
