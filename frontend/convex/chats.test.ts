import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-27T10:00:00Z")); });
afterEach(() => vi.useRealTimers());

function setup() {
  const t = convexTest(schema, modules);
  return {
    t,
    alice: t.withIdentity({ subject: "user_alice", email: "alice@example.com" }),
    bob: t.withIdentity({ subject: "user_bob", email: "bob@example.com" }),
  };
}

const card = { id: "a1", title: "Mac mini", price_eur: 230, city: null, distance_km: null, url: "https://www.marktplaats.nl/v/a1", image: null };

test("a chat keeps its messages, titled by the first one, newest chat first", async () => {
  const { alice } = setup();
  const first = await alice.mutation(api.chats.start, { content: "Mac mini 16GB under €500 near Utrecht, preferably an M-series with a good screen" });
  await alice.mutation(api.chats.append, { chatId: first, role: "assistant", content: "The i5 at €230 looks best.", listings: [card] });
  vi.setSystemTime(new Date("2026-09-27T11:00:00Z"));
  const second = await alice.mutation(api.chats.start, { content: "Gazelle bike" });
  const chats = await alice.query(api.chats.list, {});
  expect(chats.map((c) => c._id)).toEqual([second, first]);
  expect(chats[1].title).toBe("Mac mini 16GB under €500 near Utrecht, preferab…");
  const thread = await alice.query(api.chats.messages, { chatId: first });
  expect(thread!.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  expect(thread!.messages[1].listings![0].price_eur).toBe(230);
});

test("nobody can read or write someone else's chat", async () => {
  const { alice, bob } = setup();
  const chatId = await alice.mutation(api.chats.start, { content: "hi" });
  expect(await bob.query(api.chats.messages, { chatId })).toBeNull();
  expect(await bob.query(api.chats.list, {})).toEqual([]);
  await expect(bob.mutation(api.chats.append, { chatId, role: "user", content: "x" })).rejects.toThrow("Chat not found");
  await expect(bob.mutation(api.chats.remove, { chatId })).rejects.toThrow("Chat not found");
});

test("a saved proposal stays saved when the chat is reopened", async () => {
  const { alice } = setup();
  const chatId = await alice.mutation(api.chats.start, { content: "watch it" });
  const messageId = await alice.mutation(api.chats.append, {
    chatId, role: "assistant", content: "Here you go.",
    proposals: [{ type: "create", query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" }],
  });
  await alice.mutation(api.chats.markProposalSaved, { messageId, index: 0 });
  const thread = await alice.query(api.chats.messages, { chatId });
  expect(thread!.messages[1].savedProposals).toEqual([0]);
  await expect(alice.mutation(api.chats.append, { chatId, role: "assistant", content: "x", proposals: [{ type: "drop tables" }] }))
    .rejects.toThrow("Unknown proposal");
});

test("delete-my-data and the 30-day purge also remove chats", async () => {
  const { t, alice, bob } = setup();
  await alice.mutation(api.chats.start, { content: "alice's chat" });
  await bob.mutation(api.chats.start, { content: "bob's old chat" });
  await alice.mutation(api.users.deleteMyData, {});
  const count = async () => (await t.run((ctx) => ctx.db.query("messages").collect())).length;
  expect(await count()).toBe(1);                                  // only bob's is left
  vi.setSystemTime(new Date("2026-10-28T10:00:00Z"));             // 31 days later
  await t.mutation(internal.checker.purgeOld, {});
  expect(await t.run((ctx) => ctx.db.query("chats").collect())).toEqual([]);
  expect(await count()).toBe(0);
});

test("the Alerts feed shows your alerts across watches with the watch name", async () => {
  const { t, alice, bob } = setup();
  const watchId = await alice.mutation(api.watches.create, { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run(async (ctx) => {
    const w = (await ctx.db.get(watchId))!;
    await ctx.db.insert("alerts", { userId: w.userId, watchId, listingId: "a1", title: "Mac mini", url: "https://www.marktplaats.nl/v/a1",
      image: "https://admarkt-cdn.marktplaats.com/x.jpg", score: 9, reason: "Good.", channel: "email", emailStatus: "sent", createdAt: Date.now() });
  });
  const feed = await alice.query(api.watches.alerts, {});
  expect(feed.map((a) => [a.watchLabel, a.score, a.image])).toEqual([["Mac mini", 9, "https://admarkt-cdn.marktplaats.com/x.jpg"]]);
  expect(await bob.query(api.watches.alerts, {})).toEqual([]);
});

test("onboarding is shown until finished", async () => {
  const { alice } = setup();
  await alice.mutation(api.users.store, {});
  expect((await alice.query(api.users.me, {}))!.onboarded).toBe(false);
  await alice.mutation(api.users.finishOnboarding, {});
  expect((await alice.query(api.users.me, {}))!.onboarded).toBe(true);
});
