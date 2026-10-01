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
  const { t, alice } = setup();
  const first = await alice.mutation(api.chats.start, { content: "Mac mini 16GB under €500 near Utrecht, preferably an M-series with a good screen" });
  await t.mutation(internal.chats.appendAssistant, { clerkId: "user_alice", chatId: first, content: "The i5 at €230 looks best.", listings: [card] });
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
  const { t, alice } = setup();
  const chatId = await alice.mutation(api.chats.start, { content: "watch it" });
  const messageId = await t.mutation(internal.chats.appendAssistant, {
    clerkId: "user_alice", chatId, content: "Here you go.",
    proposals: [{ type: "create", query: "mac mini", maxPriceEur: null, mustInclude: null, postcode: null,
      maxDistanceKm: null, schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" }],
  });
  await alice.mutation(api.chats.markProposalSaved, { messageId, index: 0 });
  const thread = await alice.query(api.chats.messages, { chatId });
  expect(thread!.messages[1].savedProposals).toEqual([0]);
  await expect(alice.mutation(api.chats.append, { chatId, role: "assistant", content: "x" } as any)).rejects.toThrow();
  await expect(alice.mutation(api.chats.append, { chatId, role: "user", content: "x", listings: [card] } as any)).rejects.toThrow();
  await expect(t.mutation(internal.chats.appendAssistant, { clerkId: "user_alice", chatId,
    content: "x", proposals: [{ type: "update", watchId: "w", label: "Watch", active: true, extra: true }] } as any))
    .rejects.toThrow();
  const otherChat = await t.withIdentity({ subject: "user_bob", email: "bob@example.com" }).mutation(api.chats.start, { content: "hi" });
  await expect(t.mutation(internal.chats.appendAssistant, { clerkId: "user_alice", chatId: otherChat, content: "x" }))
    .rejects.toThrow("Chat not found");
});

test("assistant HTTP writes require the shared secret", async () => {
  const { t, alice } = setup();
  const chatId = await alice.mutation(api.chats.start, { content: "hi" });
  process.env.API_TO_CONVEX_SECRET = "secret";
  const send = (secret: string) => t.fetch("/api/chats/assistant", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Api-Secret": secret },
    body: JSON.stringify({ clerkId: "user_alice", chatId, content: "Hello." }),
  });
  try {
    expect((await send("wrong")).status).toBe(401);
    expect((await send("secret")).status).toBe(200);
    expect((await alice.query(api.chats.messages, { chatId }))!.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  } finally { delete process.env.API_TO_CONVEX_SECRET; }
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
  await alice.mutation(api.alerts.setArchived, { id: feed[0]._id, archived: true });
  expect(await alice.query(api.watches.alerts, {})).toEqual([]);
  expect((await alice.query(api.alerts.archived, {}))[0].watchLabel).toBe("Mac mini");
  await alice.mutation(api.alerts.setArchived, { id: feed[0]._id, archived: false });
  expect((await alice.query(api.watches.alerts, {}))[0]._id).toBe(feed[0]._id);
});

test("onboarding is shown until finished", async () => {
  const { alice } = setup();
  await alice.mutation(api.users.store, {});
  expect((await alice.query(api.users.me, {}))!.onboarded).toBe(false);
  await alice.mutation(api.users.finishOnboarding, {});
  expect((await alice.query(api.users.me, {}))!.onboarded).toBe(true);
});

test("a chat holds at most 200 messages", async () => {
  const { t, alice } = setup();
  const chatId = await alice.mutation(api.chats.start, { content: "hi" });
  await t.run(async (ctx) => {
    for (let i = 0; i < 199; i++) await ctx.db.insert("messages", { chatId, role: "assistant", content: "x" });
  });
  await expect(alice.mutation(api.chats.append, { chatId, role: "user", content: "one more" })).rejects.toThrow("This chat is full");
});
