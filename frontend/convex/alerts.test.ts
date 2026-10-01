import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const bob = t.withIdentity({ subject: "bob", email: "bob@example.com" });
  await alice.mutation(api.users.store, {});
  await bob.mutation(api.users.store, {});
  const watchId = await alice.mutation(api.watches.create, {
    query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good",
  });
  const userId = (await t.run((ctx) => ctx.db.get(watchId)))!.userId;
  const add = (n: number) => t.run((ctx) => ctx.db.insert("alerts", {
    userId, watchId, listingId: `listing-${n}`, title: `Listing ${n}`, url: `https://example.com/${n}`,
    reason: "Match", channel: "email", emailStatus: "sent", createdAt: Date.now() + n,
  }));
  return { t, alice, bob, add };
}

test("archiving an alert hides it from the feed and count, then restore returns it", async () => {
  const { alice, bob, t, add } = await setup();
  const id = await add(1);
  expect((await alice.query(api.watches.alerts, {})).map((a) => a._id)).toEqual([id]);
  expect(await alice.query(api.watches.newAlertCount, {})).toBe(1);
  await expect(bob.mutation(api.alerts.setArchived, { id, archived: true })).rejects.toThrow("Alert not found");
  await expect(t.mutation(api.alerts.setArchived, { id, archived: true })).rejects.toThrow("sign in");
  await alice.mutation(api.alerts.setArchived, { id, archived: true });
  expect(await alice.query(api.watches.alerts, {})).toEqual([]);
  expect(await alice.query(api.watches.newAlertCount, {})).toBe(0);
  expect((await alice.query(api.alerts.archived, {}))[0]).toMatchObject({ _id: id, watchLabel: "Mac mini" });
  await alice.mutation(api.alerts.setArchived, { id, archived: false });
  expect((await alice.query(api.watches.alerts, {}))[0]._id).toBe(id);
});

test("archive all handles more than 500 owned alerts in bounded calls", async () => {
  const { alice, bob, t, add } = await setup();
  for (let i = 0; i < 501; i++) await add(i);
  expect(await bob.mutation(api.alerts.archiveAll, {})).toEqual({ archived: 0 });
  await expect(t.mutation(api.alerts.archiveAll, {})).rejects.toThrow("sign in");
  expect(await alice.mutation(api.alerts.archiveAll, {})).toEqual({ archived: 500 });
  expect(await alice.mutation(api.alerts.archiveAll, {})).toEqual({ archived: 1 });
  expect(await alice.mutation(api.alerts.archiveAll, {})).toEqual({ archived: 0 });
  expect(await alice.query(api.watches.alerts, {})).toEqual([]);
  expect(await alice.query(api.alerts.archived, {})).toHaveLength(50);
});

test("the active feed fills its 50 slots past archived alerts", async () => {
  const { alice, add } = await setup();
  for (let i = 0; i < 51; i++) {
    const id = await add(i);
    if (i === 50) await alice.mutation(api.alerts.setArchived, { id, archived: true });
  }
  const feed = await alice.query(api.watches.alerts, {});
  expect(feed).toHaveLength(50);
  expect(feed.map((a) => a.listingId)).not.toContain("listing-50");
});
