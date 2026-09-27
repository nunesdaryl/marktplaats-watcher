import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const hourly = { kind: "interval" as const, everyMinutes: 60 };
const macMini = { query: "mac mini", maxPriceEur: 500, schedule: hourly, notify: "good" as const };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-27T10:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function setup() {
  const t = convexTest(schema, modules);
  return {
    t,
    alice: t.withIdentity({ subject: "user_alice", email: "alice@example.com" }),
    bob: t.withIdentity({ subject: "user_bob", email: "bob@example.com" }),
  };
}

test("rename a watch; an empty name goes back to the automatic one, which follows the filters", async () => {
  const { alice } = setup();
  const id = await alice.mutation(api.watches.create, macMini);
  await alice.mutation(api.watches.rename, { id, name: "  Home office  Mac " });
  expect((await alice.query(api.watches.list, {}))[0].title).toBe("Home office Mac");
  await alice.mutation(api.watches.update, { id, maxPriceEur: 400 });
  const [renamed] = await alice.query(api.watches.list, {});
  expect([renamed.title, renamed.label]).toEqual(["Home office Mac", "Mac mini, under €400"]);   // name survives
  await alice.mutation(api.watches.rename, { id, name: "" });
  expect((await alice.query(api.watches.list, {}))[0].title).toBe("Mac mini, under €400");
  await expect(alice.mutation(api.watches.rename, { id, name: "x".repeat(61) })).rejects.toThrow("1 to 60 characters");
});

test("pinned chats and watches come first", async () => {
  const { alice } = setup();
  const first = await alice.mutation(api.watches.create, macMini);
  const second = await alice.mutation(api.watches.create, { ...macMini, query: "gazelle bike" });
  await alice.mutation(api.watches.setPinned, { id: second, pinned: true });
  expect((await alice.query(api.watches.list, {})).map((w) => w._id)).toEqual([second, first]);

  const older = await alice.mutation(api.chats.start, { content: "older" });
  vi.setSystemTime(new Date("2026-09-27T11:00:00Z"));
  const newer = await alice.mutation(api.chats.start, { content: "newer" });
  await alice.mutation(api.chats.setPinned, { chatId: older, pinned: true });
  expect((await alice.query(api.chats.list, {})).map((c) => c._id)).toEqual([older, newer]);
  await alice.mutation(api.chats.rename, { chatId: older, title: "Bikes" });
  expect((await alice.query(api.chats.list, {}))[0].title).toBe("Bikes");
});

test("editing the item starts over with a silent first look, and can't duplicate another watch", async () => {
  const { t, alice } = setup();
  const id = await alice.mutation(api.watches.create, macMini);
  await alice.mutation(api.watches.create, { ...macMini, query: "gazelle bike" });
  await t.run(async (ctx) => {
    await ctx.db.patch(id, { seeded: true });
    await ctx.db.insert("seenListings", { watchId: id, listingId: "a1", lastSeenAt: 1 });
  });
  await expect(alice.mutation(api.watches.update, { id, query: "Gazelle bike" })).rejects.toThrow('You already watch "Gazelle bike');
  await alice.mutation(api.watches.update, { id, query: "iphone 13", postcode: "1012 ab", maxDistanceKm: 20 });
  const watch = await t.run((ctx) => ctx.db.get(id));
  expect(watch).toMatchObject({ query: "iphone 13", postcode: "1012AB", maxDistanceKm: 20, label: "Iphone 13, under €500, within 20 km of 1012AB", seeded: false });
  expect(await t.run((ctx) => ctx.db.query("seenListings").collect())).toEqual([]);
  await alice.mutation(api.watches.update, { id, postcode: null });           // clearing the postcode clears the distance
  const cleared = await t.run((ctx) => ctx.db.get(id));
  expect([cleared!.postcode, cleared!.maxDistanceKm]).toEqual([undefined, undefined]);
});

test("an archived watch is paused, hidden, never checked, and restored without resuming", async () => {
  const { t, alice } = setup();
  const id = await alice.mutation(api.watches.create, macMini);
  await alice.mutation(api.watches.setArchived, { id, archived: true });
  expect(await alice.query(api.watches.list, {})).toEqual([]);
  expect((await alice.query(api.watches.archived, {})).map((w) => w._id)).toEqual([id]);
  const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
  vi.setSystemTime(new Date("2026-09-28T10:00:00Z"));
  await t.action(internal.checker.checkDue, {});
  expect(fetchSpy).not.toHaveBeenCalled();
  await expect(alice.mutation(api.watches.update, { id, active: true })).rejects.toThrow("archived. Restore it first");
  await alice.mutation(api.watches.setArchived, { id, archived: false });
  const [restored] = await alice.query(api.watches.list, {});
  expect(restored.active).toBe(false);

  const chatId = await alice.mutation(api.chats.start, { content: "hi" });
  await alice.mutation(api.chats.setArchived, { chatId, archived: true });
  expect(await alice.query(api.chats.list, {})).toEqual([]);
  expect((await alice.query(api.chats.archived, {})).length).toBe(1);
});

test("folders: move in, delete the folder, and nothing inside is lost", async () => {
  const { t, alice } = setup();
  const folderId = await alice.mutation(api.folders.create, { name: "Home office" });
  const watchId = await alice.mutation(api.watches.create, macMini);
  const chatId = await alice.mutation(api.chats.start, { content: "desk chairs" });
  await alice.mutation(api.watches.move, { id: watchId, folderId });
  await alice.mutation(api.chats.move, { chatId, folderId });
  expect((await alice.query(api.watches.list, {}))[0].folderId).toBe(folderId);
  await alice.mutation(api.folders.rename, { folderId, name: "Office" });
  expect((await alice.query(api.folders.list, {}))[0].name).toBe("Office");
  await alice.mutation(api.folders.remove, { folderId });
  expect(await alice.query(api.folders.list, {})).toEqual([]);
  expect((await alice.query(api.watches.list, {}))[0].folderId).toBeUndefined();
  expect((await alice.query(api.chats.list, {}))[0].folderId).toBeUndefined();
  expect(await t.run((ctx) => ctx.db.query("watches").collect())).toHaveLength(1);
});

test("nobody can use someone else's folders, and delete-my-data removes folders", async () => {
  const { t, alice, bob } = setup();
  const folderId = await alice.mutation(api.folders.create, { name: "Mine" });
  const bobsWatch = await bob.mutation(api.watches.create, macMini);
  await expect(bob.mutation(api.watches.move, { id: bobsWatch, folderId })).rejects.toThrow("Folder not found");
  await expect(bob.mutation(api.folders.rename, { folderId, name: "x" })).rejects.toThrow("Folder not found");
  expect(await bob.query(api.folders.list, {})).toEqual([]);
  await alice.mutation(api.users.deleteMyData, {});
  expect(await t.run((ctx) => ctx.db.query("folders").collect())).toEqual([]);
});

test("at most 20 folders, names 1 to 40 characters", async () => {
  const { alice } = setup();
  await expect(alice.mutation(api.folders.create, { name: "   " })).rejects.toThrow("1 to 40 characters");
  for (let i = 0; i < 20; i++) await alice.mutation(api.folders.create, { name: `F${i}` });
  await expect(alice.mutation(api.folders.create, { name: "one more" })).rejects.toThrow("up to 20 folders");
});
