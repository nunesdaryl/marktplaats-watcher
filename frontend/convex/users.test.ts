import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const person = (t: ReturnType<typeof convexTest>, id: string) => t.withIdentity({ subject: id, email: `${id}@example.com` });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  process.env.MAX_USERS = "2";
  process.env.OWNER_CLERK_ID = "owner";
  process.env.OWNER_EMAIL = "owner@example.com";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.MAX_USERS;
  delete process.env.OWNER_CLERK_ID;
  delete process.env.OWNER_EMAIL;
});

test("cap, owner exemption, permanent count after deletion, and waitlist order", async () => {
  const t = convexTest(schema, modules);
  expect(await person(t, "owner").mutation(api.users.store, {})).toMatchObject({ status: "admitted" });
  expect(await person(t, "a").mutation(api.users.store, {})).toMatchObject({ status: "admitted" });
  expect(await person(t, "b").mutation(api.users.store, {})).toMatchObject({ status: "admitted" });
  expect(await t.query(api.users.placesLeft, {})).toEqual({ left: 0, capacity: 2 });
  expect(await person(t, "c").mutation(api.users.store, {})).toEqual({ status: "waitlisted", position: 1 });
  await person(t, "c").mutation(api.users.setLookingFor, { lookingFor: "A used bike" });
  expect(await person(t, "c").query(api.users.myWaitlist, {})).toEqual({ position: 1, lookingFor: "A used bike" });
  await expect(person(t, "c").mutation(api.watches.create, { query: "bike", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" })).rejects.toThrow("waitlist");
  expect(await person(t, "c").mutation(api.users.store, {})).toEqual({ status: "waitlisted", position: 1 });
  expect(await person(t, "d").mutation(api.users.store, {})).toEqual({ status: "waitlisted", position: 2 });
  expect((await t.run((ctx) => ctx.db.query("waitlist").collect()))).toHaveLength(2);
  await person(t, "a").mutation(api.users.deleteMyData, {});
  expect(await t.query(api.users.placesLeft, {})).toEqual({ left: 0, capacity: 2 });
  expect(await person(t, "e").mutation(api.users.store, {})).toEqual({ status: "waitlisted", position: 3 });
  process.env.MAX_USERS = "3";
  expect(await person(t, "d").mutation(api.users.store, {})).toEqual({ status: "waitlisted", position: 2 });
  expect(await person(t, "c").mutation(api.users.store, {})).toMatchObject({ status: "admitted" });
  expect(await person(t, "d").mutation(api.users.store, {})).toEqual({ status: "waitlisted", position: 1 });
  expect(await person(t, "e").mutation(api.users.store, {})).toEqual({ status: "waitlisted", position: 2 });
  expect((await person(t, "c").query(api.users.me, {}))?.freeUntil).toBe(Date.now() + 30 * 86_400_000);
});

test("parallel signups cannot exceed the cap and invalid settings use the default", async () => {
  const t = convexTest(schema, modules);
  process.env.MAX_USERS = "1";
  const results = await Promise.all(["a", "b", "c"].map((id) => person(t, id).mutation(api.users.store, {})));
  expect(results.filter((result) => result.status === "admitted")).toHaveLength(1);
  expect(await t.query(api.users.placesLeft, {})).toEqual({ left: 0, capacity: 1 });
  process.env.MAX_USERS = "bad";
  expect(await t.query(api.users.placesLeft, {})).toEqual({ left: 99, capacity: 100 });
});

test("existing accounts get the offer date and AI rejects people without admission", async () => {
  const t = convexTest(schema, modules);
  expect((await t.mutation(internal.usage.consume, { clerkId: "owner" })).allowed).toBe(true);
  const id = await t.run((ctx) => ctx.db.insert("users", { clerkId: "old", email: "old@example.com", createdAt: Date.parse("2026-10-01T00:00:00Z") }));
  expect(await person(t, "old").mutation(api.users.store, {})).toMatchObject({ status: "admitted", id });
  expect((await person(t, "old").query(api.users.me, {}))?.freeUntil).toBe(Date.parse("2026-11-04T00:00:00Z"));
  expect(await t.mutation(internal.usage.consume, { clerkId: "stranger" })).toMatchObject({ allowed: false, reason: "admission" });
  expect((await t.mutation(internal.usage.consume, { clerkId: "old" })).allowed).toBe(true);
});
