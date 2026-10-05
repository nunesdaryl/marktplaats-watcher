import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const start = Date.parse("2026-10-05T00:00:00Z");
const day = 86_400_000;

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(start);
  process.env.OWNER_CLERK_ID = "owner"; process.env.OWNER_EMAIL = "owner@example.com";
});
afterEach(() => { vi.useRealTimers(); delete process.env.OWNER_CLERK_ID; delete process.env.OWNER_EMAIL; });

test("day 14 survey and day 25 notice are claimed once per round; owner is exempt", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  await alice.mutation(api.users.store, {}); await owner.mutation(api.users.store, {});
  vi.setSystemTime(start + 13 * day);
  expect((await alice.query(api.founding.mine, {}))?.showSurvey).toBe(false);
  expect(await t.mutation(internal.founding.claimEmails, { now: Date.now() })).toEqual([]);
  vi.setSystemTime(start + 14 * day);
  expect((await alice.query(api.founding.mine, {}))?.showSurvey).toBe(true);
  expect(await t.mutation(internal.founding.claimEmails, { now: Date.now() })).toMatchObject([{ kind: "survey", to: "alice@example.com" }]);
  expect(await t.mutation(internal.founding.claimEmails, { now: Date.now() })).toEqual([]);
  expect(await owner.query(api.founding.mine, {})).toBeNull();
  await alice.mutation(api.founding.dismiss, {});
  expect((await alice.query(api.founding.mine, {}))?.showSurvey).toBe(false);
  await alice.mutation(api.founding.answerSurvey, { disappointed: "very", benefit: "Good watches" });
  await alice.mutation(api.founding.answerSurvey, { disappointed: "not" });
  expect((await alice.query(api.founding.mine, {}))?.disappointed).toBe("very");
  vi.setSystemTime(start + 25 * day);
  expect(await t.mutation(internal.founding.claimEmails, { now: Date.now() })).toMatchObject([{ kind: "notice" }]);
  expect(await t.mutation(internal.founding.claimEmails, { now: Date.now() })).toEqual([]);
});

test("expiry blocks watch claim and chat; extension resumes and starts a fresh survey round", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  await alice.mutation(api.users.store, {});
  const watchId = await alice.mutation(api.watches.create, { query: "bike", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(watchId, { nextRunAt: start }));
  vi.setSystemTime(start + 30 * day);
  expect((await alice.query(api.founding.mine, {}))?.ended).toBe(true);
  expect(await t.mutation(internal.checker.claimDue, { now: Date.now() })).toEqual([]);
  expect(await t.mutation(internal.usage.consume, { clerkId: "alice" })).toMatchObject({ allowed: false, reason: "founding_ended" });
  await t.run((ctx) => ctx.db.patch(watchId, { nextRunAt: Date.now() + 2 * day }));
  const newUntil = await alice.mutation(api.founding.extend, { disappointed: "somewhat", wouldPay: "up_to_5" });
  expect(newUntil).toBe(Date.now() + 30 * day);
  expect((await t.run((ctx) => ctx.db.get(watchId)))?.nextRunAt).toBe(Date.now());
  expect((await t.mutation(internal.checker.claimDue, { now: Date.now() })).length).toBe(1);
  expect((await t.mutation(internal.usage.consume, { clerkId: "alice" })).allowed).toBe(true);
  expect((await alice.query(api.founding.mine, {}))?.showSurvey).toBe(false);
  vi.setSystemTime(newUntil - 16 * day);
  expect((await alice.query(api.founding.mine, {}))?.showSurvey).toBe(true);
  await alice.mutation(api.founding.answerSurvey, { disappointed: "very" });
  expect((await t.run((ctx) => ctx.db.query("foundingRounds").collect())).map((r) => r.disappointed)).toEqual(["somewhat", "very"]);
  expect((await t.withIdentity({ subject: "owner", email: "owner@example.com" }).query(api.founding.ownerSummary, {}))?.prices.up_to_5).toBe(1);
  expect(await alice.query(api.founding.ownerSummary, {})).toBeNull();
  await alice.mutation(api.users.deleteMyData, {});
  expect(await t.run((ctx) => ctx.db.query("foundingRounds").collect())).toEqual([]);
});

test("reminder action sends one linked e-mail and owner watches keep running after day 30", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  await alice.mutation(api.users.store, {});
  await owner.mutation(api.users.store, {});
  const watchId = await owner.mutation(api.watches.create, { query: "bike", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(watchId, { nextRunAt: start }));
  const mails: any[] = [];
  process.env.AGENTMAIL_API_KEY = "test"; process.env.AGENTMAIL_INBOX_ID = "test@example.com";
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
    mails.push(JSON.parse(options.body as string)); return new Response("{}");
  }));
  try {
    vi.setSystemTime(start + 14 * day);
    await t.action(internal.founding.sendReminders, {});
    await t.action(internal.founding.sendReminders, {});
    expect(mails).toHaveLength(1);
    expect(mails[0].text).toContain("/?founding=1");
    vi.setSystemTime(start + 30 * day);
    expect((await t.mutation(internal.checker.claimDue, { now: Date.now() })).length).toBe(1);
    expect((await t.mutation(internal.usage.consume, { clerkId: "owner" })).allowed).toBe(true);
    expect((await owner.query(api.founding.ownerSummary, {}))?.paused).toBe(1);
  } finally {
    vi.unstubAllGlobals(); delete process.env.AGENTMAIL_API_KEY; delete process.env.AGENTMAIL_INBOX_ID;
  }
});

test("paused founding users are left out of the delivery audit and catch-up (no e-mails, no AI cost)", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  await alice.mutation(api.users.store, {});
  const watchId = await alice.mutation(api.watches.create, { query: "bike", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(watchId, { seeded: true, seededAt: start }));
  const audited = async () => (await t.query(internal.audit.groups, { now: Date.now() })).flatMap((g: any) => g.watches);
  const caughtUp = async () => (await t.query(internal.catchup.groups, {})).flatMap((g: any) => g.watches);
  expect(await audited()).toHaveLength(1);
  expect(await caughtUp()).toHaveLength(1);
  vi.setSystemTime(start + 30 * day);                       // founding month over, not extended
  expect(await audited()).toHaveLength(0);
  expect(await caughtUp()).toHaveLength(0);
});
