import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

test("offer comparisons are restricted to the owner's scored watch alerts", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const bob = t.withIdentity({ subject: "bob", email: "bob@example.com" });
  await alice.mutation(api.users.store, {});
  await bob.mutation(api.users.store, {});
  const watchId = await alice.mutation(api.watches.create, { query: "bike", maxPriceEur: 150,
    schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run(async (ctx) => {
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", "alice")).unique();
    const base = { userId: user!._id, watchId, city: "Utrecht", reason: "Good", channel: "email" as const,
      emailStatus: "sent" as const, createdAt: Date.now() };
    await ctx.db.insert("alerts", { ...base, listingId: "one", title: "Bike", url: "https://example.test/one",
      description: "Used", priceEur: 175, score: 8 });
    await ctx.db.insert("alerts", { ...base, listingId: "two", title: "Other bike", url: "https://example.test/two",
      priceEur: 140, score: 7 });
  });
  const args = { watchId, url: "https://example.test/one" };
  expect(await t.query(internal.offerContext.forListing, { clerkId: "alice", ...args })).toMatchObject({
    maxPriceEur: 150, priceEur: 175, description: "Used", similarPricesEur: [140],
  });
  expect(await t.query(internal.offerContext.forListing, { clerkId: "bob", ...args })).toBeNull();
  expect(await t.query(internal.offerContext.forListing, { clerkId: "alice", watchId,
    url: "https://example.test/unknown" })).toBeNull();
});

test("offer help is a separate ledger kind and uses the person's budget", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  await alice.mutation(api.users.store, {});
  await t.mutation(internal.aiBudget.record, { clerkId: "alice", kind: "offer help", callId: "offer-1",
    inputTokens: 100, outputTokens: 100, costEur: 1 });
  expect(await alice.query(api.aiBudget.mine, {})).toMatchObject({ allowed: false, spentEur: 1 });
  expect((await t.run((ctx) => ctx.db.query("aiSpend").collect()))[0].kind).toBe("offer help");
});
