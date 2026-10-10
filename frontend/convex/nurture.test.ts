import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { renderNurture } from "./nurture";

const modules = import.meta.glob("./**/*.ts");
const start = Date.parse("2026-10-05T10:00:00Z");
const day = 86_400_000;
const person = (t: ReturnType<typeof convexTest>, name: string) => t.withIdentity({ subject: name, email: `${name}@example.com` });
const rows = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("nurtureEmails").collect());
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(start); process.env.OWNER_CLERK_ID = "owner"; process.env.OWNER_EMAIL = "owner@example.com"; });
afterEach(() => { vi.useRealTimers(); delete process.env.OWNER_CLERK_ID; delete process.env.OWNER_EMAIL; });

test("welcome is for admitted users only; landing language wins over browser language", async () => {
  const t = convexTest(schema, modules);
  await person(t, "alice").mutation(api.users.store, { landingLanguage: "nl", browserLanguage: "en-US" });
  await person(t, "bob").mutation(api.users.store, { browserLanguage: "nl-NL" });
  await person(t, "charlie").mutation(api.users.store, { browserLanguage: "en-GB" });
  await person(t, "owner").mutation(api.users.store, {});
  expect(await t.mutation(internal.nurture.claimDue, { now: start })).toMatchObject([
    { step: "welcome", language: "nl", to: "alice@example.com" },
    { step: "welcome", language: "nl", to: "bob@example.com" },
    { step: "welcome", language: "en", to: "charlie@example.com" },
  ]);
  expect(await t.mutation(internal.nurture.claimDue, { now: start })).toEqual([]);
  expect(renderNurture("welcome", "nl", "https://site.test", "token").text).toContain("eerste zoekopdracht");
  expect(renderNurture("welcome", "en", "https://site.test", "token").text).toContain("first watch");
});

test("day-one nudge requires no saved watch; day-seven tip requires an active watch", async () => {
  const t = convexTest(schema, modules);
  const alice = person(t, "alice"), bob = person(t, "bob");
  await alice.mutation(api.users.store, {}); await bob.mutation(api.users.store, {});
  await t.mutation(internal.nurture.claimDue, { now: start });
  const watchId = await bob.mutation(api.watches.create, { query: "bike", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  vi.setSystemTime(start + day);
  expect(await t.mutation(internal.nurture.claimDue, { now: Date.now() })).toMatchObject([{ step: "no_watch", to: "alice@example.com" }]);
  vi.setSystemTime(start + 7 * day);
  expect(await t.mutation(internal.nurture.claimDue, { now: Date.now() })).toMatchObject([{ step: "tips", to: "bob@example.com" }]);
  await t.run((ctx) => ctx.db.patch(watchId, { active: false }));
  expect(await t.mutation(internal.nurture.claimDue, { now: Date.now() + day })).toEqual([]);
});

test("first delivered alert triggers guidance, one nurture per day and stops after unsubscribe or deletion", async () => {
  const t = convexTest(schema, modules);
  const alice = person(t, "alice");
  await alice.mutation(api.users.store, {});
  const watchId = await alice.mutation(api.watches.create, { query: "bike", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  const alertId = await t.run(async (ctx) => ctx.db.insert("alerts", { userId: (await ctx.db.get(watchId))!.userId, watchId,
    listingId: "one", title: "Bike", url: "https://example.com", reason: "Match", channel: "email", emailStatus: "pending", createdAt: start }));
  expect((await t.mutation(internal.nurture.claimDue, { now: start })).map((m) => m.step)).toEqual(["welcome"]);
  await t.mutation(internal.checker.markEmailed, { alertIds: [alertId], status: "sent" });
  expect(await t.mutation(internal.nurture.claimDue, { now: start })).toEqual([]);
  vi.setSystemTime(start + day);
  expect((await t.mutation(internal.nurture.claimDue, { now: Date.now() })).map((m) => m.step)).toEqual(["first_alert"]);
  expect(await t.mutation(internal.nurture.claimDue, { now: Date.now() })).toEqual([]);
  const token = (await t.run((ctx) => ctx.db.query("users").first()))!.nurtureToken!;
  await alice.mutation(api.nurture.unsubscribe, { token, step: "first_alert" });
  vi.setSystemTime(start + 7 * day);
  expect(await t.mutation(internal.nurture.claimDue, { now: Date.now() })).toEqual([]);
  expect((await rows(t)).find((r) => r.step === "first_alert")?.unsubscribedAt).toBeDefined();
  await alice.mutation(api.users.deleteMyData, {});
  expect(await rows(t)).toEqual([]);
});

test("a tracked content link records one open, and owner sees per-step totals", async () => {
  const t = convexTest(schema, modules);
  const alice = person(t, "alice");
  await alice.mutation(api.users.store, {});
  await t.mutation(internal.nurture.claimDue, { now: start });
  const userId = (await t.run((ctx) => ctx.db.query("users").first()))!._id;
  await t.mutation(internal.nurture.markDelivered, { userId, step: "welcome", now: start });
  const token = (await t.run((ctx) => ctx.db.query("users").first()))!.nurtureToken!;
  expect(await t.mutation(internal.nurture.openLink, { token, step: "welcome" })).toBe(true);
  expect(await t.mutation(internal.nurture.openLink, { token, step: "welcome" })).toBe(true);
  expect((await person(t, "owner").query(api.nurture.ownerSummary, {}))?.welcome).toEqual({ sent: 1, openedLink: 1, unsubscribed: 0 });
  expect(await alice.query(api.nurture.ownerSummary, {})).toBeNull();
});

test("delivery uses the saved language, and the unsubscribe form leaves alerts alone", async () => {
  const t = convexTest(schema, modules);
  const alice = person(t, "alice");
  await alice.mutation(api.users.store, { landingLanguage: "nl", browserLanguage: "en-US" });
  process.env.AGENTMAIL_API_KEY = "test"; process.env.AGENTMAIL_INBOX_ID = "test@example.com";
  process.env.CONVEX_SITE_URL = "https://site.test";
  const mails: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
    mails.push(JSON.parse(options.body as string)); return new Response("{}");
  }));
  try {
    await t.action(internal.nurture.sendDue, {});
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: ["alice@example.com"], labels: ["nurture"], subject: "Welkom bij Marktplaats Watcher" });
    expect(mails[0].html).toContain("/nurture/unsubscribe?");
    const user = (await t.run((ctx) => ctx.db.query("users").first()))!;
    const url = `/nurture/unsubscribe?token=${user.nurtureToken}&step=welcome`;
    const preview = await t.fetch(url);
    expect(preview.status).toBe(200);
    expect((await t.run((ctx) => ctx.db.get(user._id)))?.nurtureUnsubscribedAt).toBeUndefined();
    const form = new FormData(); form.set("token", user.nurtureToken!); form.set("step", "welcome");
    expect((await t.fetch("/nurture/unsubscribe", { method: "POST", body: form })).status).toBe(200);
    expect((await t.run((ctx) => ctx.db.get(user._id)))?.nurtureUnsubscribedAt).toBeDefined();
    expect((await t.run((ctx) => ctx.db.get(user._id)))?.email).toBe("alice@example.com");
    vi.setSystemTime(start + day);
    await t.action(internal.nurture.sendDue, {});
    expect(mails).toHaveLength(1);
  } finally {
    vi.unstubAllGlobals(); delete process.env.AGENTMAIL_API_KEY; delete process.env.AGENTMAIL_INBOX_ID; delete process.env.CONVEX_SITE_URL;
  }
});

test("nurture ends before the day-14 founding survey", async () => {
  const t = convexTest(schema, modules);
  const alice = person(t, "alice");
  await alice.mutation(api.users.store, {});
  await t.mutation(internal.nurture.claimDue, { now: start });
  vi.setSystemTime(start + 14 * day);
  expect(await t.mutation(internal.nurture.claimDue, { now: Date.now() })).toEqual([]);
  expect(await t.mutation(internal.founding.claimEmails, { now: Date.now() })).toMatchObject([{ kind: "survey", to: "alice@example.com" }]);
});

test("each step renders in Dutch and English with a first-party opt-out", () => {
  for (const step of ["welcome", "no_watch", "first_alert", "tips"] as const) {
    for (const language of ["nl", "en"] as const) {
      const mail = renderNurture(step, language, "https://site.test", "safe-token");
      expect(mail.subject.length).toBeGreaterThan(5);
      expect(mail.text).toContain(`/nurture/unsubscribe?token=safe-token&step=${step}`);
      expect(mail.html).toContain(`lang="${language}"`);
      expect(mail.html).toContain(`/nurture/open?token=safe-token&amp;step=${step}`);
      expect(mail.html).not.toContain("<img");
      expect(mail.subject).not.toContain("!");
    }
  }
});

test("a paused watch stops nurture until resumed, without affecting alerts", async () => {
  const t = convexTest(schema, modules);
  const alice = person(t, "alice");
  await alice.mutation(api.users.store, {});
  const id = await alice.mutation(api.watches.create, { query: "bike", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.mutation(internal.nurture.claimDue, { now: start });
  await t.run((ctx) => ctx.db.patch(id, { active: false }));
  vi.setSystemTime(start + 7 * day);
  expect(await t.mutation(internal.nurture.claimDue, { now: Date.now() })).toEqual([]);
  await t.run((ctx) => ctx.db.patch(id, { active: true }));
  expect((await t.mutation(internal.nurture.claimDue, { now: Date.now() })).map((m) => m.step)).toEqual(["tips"]);
});

test("people who signed up more than two days earlier never start the sequence", async () => {
  const t = convexTest(schema, modules);
  await person(t, "early").mutation(api.users.store, {});
  vi.setSystemTime(start + 3 * day);
  await person(t, "fresh").mutation(api.users.store, {});
  expect(await t.mutation(internal.nurture.claimDue, { now: Date.now() })).toMatchObject([{ step: "welcome", to: "fresh@example.com" }]);
  expect((await rows(t)).length).toBe(1);
  vi.setSystemTime(start + 4 * day);
  expect(await t.mutation(internal.nurture.claimDue, { now: Date.now() })).toMatchObject([{ step: "no_watch", to: "fresh@example.com" }]);
  expect((await rows(t)).every((row) => row.step && row.userId !== undefined)).toBe(true);
  expect((await rows(t)).length).toBe(2);
});
