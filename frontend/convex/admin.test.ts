import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { draftFeedbackReply } from "./admin";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T10:00:00Z"));
  process.env.OWNER_EMAIL = "Owner@Example.com";
  process.env.OWNER_CLERK_ID = "o";
  process.env.AGENTMAIL_API_KEY = "am_test";
  process.env.AGENTMAIL_INBOX_ID = "inbox@test";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("reply draft uses a known first name and keeps the note as its own sentence", () => {
  expect(draftFeedbackReply({ personName: "Alex Morgan", email: "other@example.com",
    receivedAt: Date.parse("2026-10-01T10:00:00Z"), note: "Saved alerts are easier to find." }))
    .toBe("Hi Alex, thanks for your feedback on 1 October. Saved alerts are easier to find. It's live in the app now. Daryl, Marktplaats Watcher");
});

test("reply draft has no name when the e-mail does not identify one and adds one full stop", () => {
  expect(draftFeedbackReply({ email: "42@example.com", receivedAt: Date.parse("2026-10-01T10:00:00Z"),
    note: "Alerts now include the saved search" }))
    .toBe("Hi, thanks for your feedback on 1 October. Alerts now include the saved search. It's live in the app now. Daryl, Marktplaats Watcher");
});

test("reply draft uses the e-mail's first name only before a separator", () => {
  expect(draftFeedbackReply({ email: "jane.doe2@example.com", receivedAt: Date.parse("2026-10-01T10:00:00Z"),
    note: "The watch list loads faster." })).toMatch(/^Hi Jane, thanks/);
  expect(draftFeedbackReply({ email: "hikari_dev@example.com", receivedAt: Date.parse("2026-10-01T10:00:00Z"),
    note: "The watch list loads faster." })).toMatch(/^Hi Hikari, thanks/);
  expect(draftFeedbackReply({ email: "alex-smith@example.com", receivedAt: Date.parse("2026-10-01T10:00:00Z"),
    note: "The watch list loads faster." })).toMatch(/^Hi Alex, thanks/);
});

test.each(["darylnunes@example.com", "vinodkumarbhovi9797@example.com"])(
  "reply draft does not guess a first name from %s", (email) => {
    expect(draftFeedbackReply({ email, receivedAt: Date.parse("2026-10-01T10:00:00Z"),
      note: "The watch list loads faster." })).toMatch(/^Hi, thanks/);
  },
);

test("only the owner gets dashboard data", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const someone = t.withIdentity({ subject: "s", email: "someone@example.com" });
  expect(await t.query(api.admin.amOwner, {})).toBe(false);
  expect(await someone.query(api.admin.amOwner, {})).toBe(false);
  expect(await someone.query(api.admin.dashboard, {})).toBeNull();
  expect(await someone.query(api.admin.feedback, {})).toBeNull();
  expect(await owner.query(api.admin.amOwner, {})).toBe(true);
  // The owner's e-mail on another account (or the owner's account with another e-mail) is not the owner
  const lookalike = t.withIdentity({ subject: "x", email: "owner@example.com" });
  expect(await lookalike.query(api.admin.amOwner, {})).toBe(false);
  expect(await lookalike.query(api.admin.dashboard, {})).toBeNull();
  expect(await t.withIdentity({ subject: "o", email: "someone@example.com" }).query(api.admin.amOwner, {})).toBe(false);
  delete process.env.OWNER_CLERK_ID;
  expect(await owner.query(api.admin.amOwner, {})).toBe(false);   // not configured: nobody is the owner
  process.env.OWNER_CLERK_ID = "o";
  delete process.env.OWNER_EMAIL;
  expect(await owner.query(api.admin.amOwner, {})).toBe(false);
});

test("owner dashboard sums removed listings by day and run", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  await t.mutation(internal.health.logRun, { at: Date.now(), checked: 2, failed: 0, emails: 0,
    emailFailures: 0, paidRemoved: 3, businessRemoved: 2, businessSignaled: 4 });
  const data = await owner.query(api.admin.dashboard, {});
  expect(data?.daily.at(-1)).toMatchObject({ paidRemoved: 3, businessRemoved: 2 });
  expect((await owner.query(api.admin.runs, {}))?.rows[0]).toMatchObject({
    paidRemoved: 3, businessRemoved: 2, businessSignaled: 4,
  });
});

test("owner dashboard counts places and lists only the owner's waitlist", async () => {
  process.env.MAX_USERS = "1";
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const member = t.withIdentity({ subject: "m", email: "m@example.com" });
  const waiting = t.withIdentity({ subject: "w", email: "w@example.com" });
  await member.mutation(api.users.store, {});
  await waiting.mutation(api.users.store, {});
  await waiting.mutation(api.users.setLookingFor, { lookingFor: "A bike" });
  expect((await owner.query(api.admin.dashboard, {}))?.totals).toMatchObject({
    places: { cap: 1, taken: 1, left: 0 }, waitlistCount: 1,
  });
  expect(await member.query(api.admin.waitlist, {})).toBeNull();
  expect((await owner.query(api.admin.waitlist, {}))?.rows).toMatchObject([
    { email: "w@example.com", lookingFor: "A bike" },
  ]);
  delete process.env.MAX_USERS;
});

test("outside feedback tracks owner decisions, release and a manually recorded reply", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const other = t.withIdentity({ subject: "s", email: "s@example.com" });
  const input = { personName: "Instructor", receivedAt: Date.now() - 86_400_000, source: "whatsapp" as const,
    message: "The alerts saved me time", paraphrase: true };
  await expect(other.mutation(api.admin.addFeedback, input)).rejects.toThrow(/Not found/);
  const id = await owner.mutation(api.admin.addFeedback, input);
  const initial = (await owner.query(api.admin.feedback, { feedbackSource: "whatsapp" }))!.rows[0];
  expect(initial).toMatchObject({ source: "whatsapp", status: "new", paraphrase: true, personName: "Instructor" });
  const change = { id, note: "Review for next release", issues: ["MW-48"] };
  await owner.mutation(api.admin.updateFeedback, { ...change, status: "planned" });
  await owner.mutation(api.admin.updateFeedback, { ...change, status: "in_progress" });
  await expect(other.mutation(api.admin.updateFeedback, { ...change, status: "shipped", releaseSha: "abcdef0", releaseAt: Date.now() }))
    .rejects.toThrow(/Not found/);
  await expect(owner.mutation(api.admin.updateFeedback, { ...change, status: "shipped", releaseSha: "abcdef0", releaseAt: Date.now() }))
    .rejects.toThrow(/Public title/);
  await owner.mutation(api.admin.updateFeedback, { ...change, status: "shipped", releaseSha: "abcdef0", releaseAt: Date.now(), publicTitle: "Better alerts" });
  const shipped = (await owner.query(api.admin.feedback, { status: "shipped" }))!.rows[0];
  expect(shipped).toMatchObject({ publicTitle: "Better alerts", showOnWhatsNew: true });
  await expect(owner.mutation(api.admin.updateFeedback, { ...change, status: "shipped", releaseSha: "abcdef0",
    releaseAt: Date.now(), publicTitle: "MW-48 Better alerts" })).rejects.toThrow(/Public title/);
  await expect(owner.mutation(api.admin.updateFeedback, { ...change, status: "shipped", releaseSha: "abcdef0",
    releaseAt: Date.now(), publicTitle: "x".repeat(81) })).rejects.toThrow(/Public title/);
  expect(shipped.replyDraft).toBe("Hi Instructor, thanks for your feedback on 28 September. Review for next release. It's live in the app now. Daryl, Marktplaats Watcher");
  expect(shipped.timeline.map((e) => e.status)).toEqual(["new", "planned", "in_progress", "shipped"]);
  await owner.mutation(api.admin.markFeedbackReplied, { id, channel: "whatsapp", text: "I told them where to find it." });
  expect((await owner.query(api.admin.feedback, {}))!.rows[0]).toMatchObject({ replyChannel: "whatsapp", replyText: "I told them where to find it.", repliedBy: "owner@example.com" });
  const dashboard = (await owner.query(api.admin.dashboard, {}))!;
  expect(dashboard.totals).toMatchObject({ feedbackOpen: 0, feedbackShipped: 1, feedbackReplied: 1 });
  expect((await t.query(internal.health.report, { now: Date.now() })).summary).toContain("Feedback: 0 new, 0 open.");
});

test("owner links a LinkedIn item with a consent choice and keeps reply proof", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const id = await owner.mutation(api.admin.addFeedback, { personName: "Vinod", receivedAt: Date.now(),
    source: "linkedin", sourceUrl: "https://linkedin.com/posts/example", creditName: false,
    message: "Please improve bids", paraphrase: false });
  await owner.mutation(api.admin.linkFeedbackIssue, { id, issue: "mw-90" });
  await owner.mutation(api.admin.linkFeedbackIssue, { id, issue: "MW-90" });
  expect((await owner.query(api.admin.feedback, { id }))!.rows[0]).toMatchObject({ status: "planned", issues: ["MW-90"],
    sourceUrl: "https://linkedin.com/posts/example", creditName: false });
  await t.mutation(internal.feedback.advanceByIssue, { issue: "MW-90", status: "in_progress" });
  await t.mutation(internal.feedback.shipByIssue, { issue: "MW-90", sha: "a".repeat(40), releaseAt: Date.now(), title: "Bidding help" });
  await owner.mutation(api.admin.markFeedbackReplied, { id, channel: "linkedin", text: "The feature is live.",
    replyUrl: "https://linkedin.com/posts/reply" });
  expect((await owner.query(api.admin.feedback, { id }))!.rows[0]).toMatchObject({ replyChannel: "linkedin",
    replyUrl: "https://linkedin.com/posts/reply" });
});

test("a shipped app reply is sent only on owner action and recorded", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const user = t.withIdentity({ subject: "u", email: "user@example.com" });
  const sent: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { sent.push(JSON.parse(init.body as string)); return new Response("{}"); }));
  const id = await user.mutation(api.feedback.submit, { message: "Please add this" });
  const args = { id, issues: ["MW-48"], releaseSha: "123abcd", releaseAt: Date.now(), status: "shipped" as const, note: "the alert settings", publicTitle: "Better alerts" };
  await expect(owner.mutation(api.admin.updateFeedback, args)).rejects.toThrow(/status line/);
  await owner.mutation(api.admin.updateFeedback, { id, status: "planned", issues: ["MW-48"] });
  await owner.mutation(api.admin.updateFeedback, { id, status: "in_progress", issues: ["MW-48"] });
  await owner.mutation(api.admin.updateFeedback, args);
  expect(sent).toHaveLength(0);
  await expect(user.action(api.feedback.sendReply, { id })).rejects.toThrow(/Not found/);
  await owner.action(api.feedback.sendReply, { id });
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toEqual(["user@example.com"]);
  expect(sent[0].html).toContain("Marktplaats Watcher");
  expect(sent[0].html).toContain("prefers-color-scheme:dark");
  expect((await owner.query(api.admin.feedback, {}))!.rows[0]).toMatchObject({ replyChannel: "email", repliedBy: "owner@example.com" });
  await expect(owner.action(api.feedback.sendReply, { id })).rejects.toThrow(/not ready/);
});

test("declining requires a reason and keeps handledAt in sync", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const id = await owner.mutation(api.admin.addFeedback, { personName: "Visitor", receivedAt: Date.now(),
    source: "in_person", message: "Please change the colour", paraphrase: true });
  await expect(owner.mutation(api.admin.updateFeedback, { id, status: "declined", issues: [] })).rejects.toThrow(/reason/);
  await owner.mutation(api.admin.updateFeedback, { id, status: "declined", issues: [], declinedReason: "Outside scope" });
  expect((await owner.query(api.admin.feedback, {}))!.rows[0]).toMatchObject({ status: "declined", declinedReason: "Outside scope", handledAt: Date.now() });
  await owner.mutation(api.admin.updateFeedback, { id, status: "new", issues: [] });
  expect((await owner.query(api.admin.feedback, {}))!.rows[0].handledAt).toBeUndefined();
});

test("the canary does not count as a user watch on the dashboard", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  await t.mutation(internal.checker.claimCanary, { now: Date.now() });
  await t.mutation(internal.checker.recordCanary, { now: Date.now(), ok: true, readCount: 5, newestId: 5 });
  const dashboard = await owner.query(api.admin.dashboard, {});
  expect(dashboard?.totals.watchesActive).toBe(0);
  expect(dashboard?.funnel.find((step) => step.step === "Saved a watch")?.count).toBe(0);
  expect((await owner.query(api.admin.watches, {}))?.rows).toEqual([]);
});

test("refresh arguments keep server time, result shape and owner checks", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const other = t.withIdentity({ subject: "x", email: "x@example.com" });
  const baseline = (await owner.query(api.admin.dashboard, { days: 7 }))!;
  const refreshed = (await owner.query(api.admin.dashboard, { days: 7, at: 0 }))!;
  expect(refreshed).toEqual(baseline);
  expect(refreshed.now).toBe(Date.now());
  expect(await owner.query(api.admin.ratingStats, { days: 7, at: 0 }))
    .toEqual(await owner.query(api.admin.ratingStats, { days: 7 }));
  expect(await owner.query(api.admin.feedback, { limit: 5, at: 0 }))
    .toEqual(await owner.query(api.admin.feedback, { limit: 5 }));
  expect(await other.query(api.admin.dashboard, { at: 0 })).toBeNull();
  expect(await other.query(api.admin.ratingStats, { at: 0 })).toBeNull();
  expect(await other.query(api.admin.feedback, { at: 0 })).toBeNull();
});

test("the dashboard counts and labels active watches falling behind", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "iphone", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(id, { backlog: 20 }));
  const dashboard = (await owner.query(api.admin.dashboard, {}))!;
  expect(dashboard.totals.watchesFallingBehind).toBe(1);
  expect(dashboard.fallingBehindLabels).toEqual(["Iphone"]);
});

test("the dashboard counts usage, the funnel and feedback with what happened before it", async () => {
  const t = convexTest(schema, modules);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  await alice.mutation(api.users.store, {});
  await alice.mutation(api.events.track, { events: [
    { name: "page_view", props: { section: "watches", value: "dark" }, device: "phone", at: Date.now() },
    { name: "chat_sent", props: { mode: "watch" }, device: "phone", at: Date.now() },
  ] });
  await alice.mutation(api.feedback.submit, { message: "The banner is great", wouldPay: "maybe", page: "watches" });

  const d = (await owner.query(api.admin.dashboard, {}))!;
  expect(d.totals.users).toBe(1);
  expect(d.totals.active1d).toBe(1);
  expect(d.funnel.map((s) => s.count)).toEqual([1, 0, 1, 0, 0]);
  expect(d.chatModes).toEqual([{ name: "watch", count: 1 }]);
  expect(d.themes).toEqual([{ name: "dark", count: 1 }]);
  expect(d.daily).toHaveLength(30);
  expect(d.daily.at(-1)).toMatchObject({ active: 1, watchChats: 1, signups: 1 });
  expect(d.wouldPay.find((w) => w.name === "Maybe")?.count).toBe(1);

  const [f] = (await owner.query(api.admin.feedback, {}))!.rows;
  expect(f).toMatchObject({ email: "a@example.com", message: "The banner is great", wouldPay: "Maybe", screenshotUrl: null });
  expect(f.before.map((e) => e.name)).toEqual(["page_view", "chat_sent"]);
});

test("drilldown: every list and detail is owner-only, and the actions refuse everyone else", async () => {
  const t = convexTest(schema, modules);
  const someone = t.withIdentity({ subject: "s", email: "someone@example.com" });
  const userId = (await someone.mutation(api.users.store, {})).id!;
  const watchId = await someone.mutation(api.watches.create,
    { query: "gazelle fiets", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  for (const [fn, args] of [
    [api.admin.users, {}], [api.admin.user, { userId }], [api.admin.watches, {}], [api.admin.watch, { watchId }],
    [api.admin.alerts, {}], [api.admin.chats, {}], [api.admin.events, {}], [api.admin.day, { day: "2026-09-29" }],
  ] as const) {
    expect(await someone.query(fn as any, args as any)).toBeNull();
    expect(await t.query(fn as any, args as any)).toBeNull();
  }
  await expect(someone.mutation(api.admin.setWatchActive, { watchId, active: false })).rejects.toThrow(/Not found/);
});

test("drilldown: accounts, their watches and chats, filters, and the funnel's 'stopped at'", async () => {
  const t = convexTest(schema, modules);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const alice = t.withIdentity({ subject: "a", email: "alice@example.com" });
  const bob = t.withIdentity({ subject: "b", email: "bob@example.com" });
  const aliceId = (await alice.mutation(api.users.store, {})).id!;
  await bob.mutation(api.users.store, {});
  const watchId = await alice.mutation(api.watches.create,
    { query: "gazelle fiets", maxPriceEur: 400, schedule: { kind: "interval", everyMinutes: 15 }, notify: "great" });
  const chatId = await alice.mutation(api.chats.start, { content: "Mac mini 16GB under €500" });
  await t.mutation(internal.chats.appendAssistant, { clerkId: "a", chatId, content: "Here is one.",
    listings: [{ id: "m1", title: "Mac mini", price_eur: 230, city: "Utrecht", distance_km: null, url: "https://www.marktplaats.nl/v/x" }] });
  await t.run(async (ctx) => {
    await ctx.db.insert("alerts", { userId: aliceId, watchId, listingId: "l1", title: "Gazelle Orange", priceEur: 350,
      url: "https://www.marktplaats.nl/v/y", score: 9, reason: "Right model, under budget.", channel: "email",
      emailStatus: "sent", createdAt: Date.now() });
  });
  await alice.mutation(api.events.track, { events: [{ name: "chat_sent", props: { mode: "search" }, device: "phone", at: Date.now() }] });

  const users = (await owner.query(api.admin.users, {}))!;
  expect(users.rows.map((u) => u.email).sort()).toEqual(["alice@example.com", "bob@example.com"]);
  const a = users.rows.find((u) => u.email === "alice@example.com")!;
  expect(a).toMatchObject({ watchesActive: 1, chats: 1, alerts: 1, furthest: "alert", devices: ["phone"] });
  expect((await owner.query(api.admin.users, { stage: "watch" }))!.rows.map((u) => u.email)).toEqual(["alice@example.com"]);
  expect((await owner.query(api.admin.users, { stuck: "chatted" }))!.rows.map((u) => u.email)).toEqual([]);   // bob never finished setup
  expect((await owner.query(api.admin.users, { search: "BOB" }))!.rows.map((u) => u.email)).toEqual(["bob@example.com"]);

  const one = (await owner.query(api.admin.user, { userId: aliceId }))!;
  expect(one.watches[0]).toMatchObject({ query: "gazelle fiets", maxPriceEur: 400, schedule: "every 15 minutes",
    scheduleKey: "every 15 min", notify: "great", status: "active", alerts: 1 });
  expect(one.chats[0]).toMatchObject({ title: "Mac mini 16GB under €500", messages: 2 });
  expect(one.alerts[0]).toMatchObject({ title: "Gazelle Orange", score: 9, watch: "Gazelle fiets, under €400" });

  expect((await owner.query(api.admin.watches, { scheduleKey: "every 15 min" }))!.rows).toHaveLength(1);
  expect((await owner.query(api.admin.watches, { notify: "good" }))!.rows).toHaveLength(0);
  expect((await owner.query(api.admin.alerts, { minScore: 9 }))!.rows[0].email).toBe("alice@example.com");
  expect((await owner.query(api.admin.alerts, { minScore: 10 }))!.rows).toHaveLength(0);
  const convo = (await owner.query(api.admin.chat, { chatId }))!;
  expect(convo.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  expect(convo.messages[1].listings[0].title).toBe("Mac mini");
  expect((await owner.query(api.admin.events, { name: "chat_sent", mode: "search" }))!.rows).toHaveLength(1);
  const today = (await owner.query(api.admin.day, { day: "2026-09-29" }))!;
  expect(today.signups).toHaveLength(2);
  expect(today.alerts[0].title).toBe("Gazelle Orange");
  expect(today.searches).toBe(1);
});

test("owner actions: pausing from the dashboard works like pausing in the app; feedback can be marked handled", async () => {
  const t = convexTest(schema, modules);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const alice = t.withIdentity({ subject: "a", email: "alice@example.com" });
  const w1 = await alice.mutation(api.watches.create, { query: "fiets", schedule: { kind: "daily", times: ["08:00"] }, notify: "good" });
  const w2 = await alice.mutation(api.watches.create, { query: "stoel", schedule: { kind: "daily", times: ["08:00"] }, notify: "good" });
  await t.run(async (ctx) => { for (const id of [w1, w2]) await ctx.db.patch(id, { seeded: true, lastError: "old" }); });
  await owner.mutation(api.admin.setWatchActive, { watchId: w1, active: false });
  await alice.mutation(api.watches.update, { id: w2, active: false });
  vi.advanceTimersByTime(1000);
  await owner.mutation(api.admin.setWatchActive, { watchId: w1, active: true });
  await alice.mutation(api.watches.update, { id: w2, active: true });
  const [a, b] = await t.run(async (ctx) => Promise.all([ctx.db.get(w1), ctx.db.get(w2)]));
  const pick = (w: any) => ({ active: w.active, nextRunAt: w.nextRunAt, lastError: w.lastError, scheduleEditedAt: w.scheduleEditedAt });
  expect(pick(a)).toEqual(pick(b));
  expect(a!.lastError).toBeUndefined();

  const fb = await alice.mutation(api.feedback.submit, { message: "Love it" });
  await owner.mutation(api.admin.setFeedbackHandled, { id: fb, handled: true });
  expect((await owner.query(api.admin.feedback, { handled: false }))!.rows).toHaveLength(0);
  expect((await owner.query(api.admin.feedback, { handled: true }))!.rows[0].handledAt).toBe(Date.now());
});

test("owner lists filter operational records, catch-ups, and existing records by user and date", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const other = t.withIdentity({ subject: "x", email: "x@example.com" });
  const alice = t.withIdentity({ subject: "a", email: "alice@example.com" });
  const bob = t.withIdentity({ subject: "b", email: "bob@example.com" });
  const aliceId = (await alice.mutation(api.users.store, {})).id!;
  const bobId = (await bob.mutation(api.users.store, {})).id!;
  const aliceWatch = await alice.mutation(api.watches.create, { query: "bike", schedule: { kind: "daily", times: ["08:00"] }, notify: "good" });
  const bobWatch = await bob.mutation(api.watches.create, { query: "car", schedule: { kind: "daily", times: ["08:00"] }, notify: "good" });
  const now = Date.now();
  await t.run(async (ctx) => {
    await ctx.db.insert("runs", { at: now, checked: 2, failed: 0, emails: 1, emailFailures: 0, requestId: "run-new" });
    await ctx.db.insert("runs", { at: now - 1000, checked: 1, failed: 1, emails: 0, emailFailures: 0, requestId: "run-old" });
    await ctx.db.insert("errors", { at: now, kind: "chat", requestId: "error-new", message: "new" });
    await ctx.db.insert("errors", { at: now - 1000, kind: "check", requestId: "error-old", message: "old" });
    for (const [userId, watchId, at, title, catchUp] of [
      [aliceId, aliceWatch, now, "Alice bike", true], [bobId, bobWatch, now - 1000, "Bob car", false],
    ] as const) {
      await ctx.db.insert("alerts", { userId, watchId, listingId: title, title, url: "https://example.com", score: 8,
        reason: "match", channel: "email", emailStatus: "sent", catchUp, createdAt: at });
      await ctx.db.insert("audits", { at, userId, watchId, requestId: title, ok: false, read: 1, scored: 1, missCount: 1,
        misses: [{ listingId: title, title, url: "https://example.com", score: 8, kind: "never_read" }] });
      await ctx.db.insert("feedback", { userId, message: title, createdAt: at });
    }
  });
  for (const fn of [api.admin.runs, api.admin.errors, api.admin.audits])
    expect(await other.query(fn as any, {})).toBeNull();
  expect(await other.query(api.admin.search, { text: "bike" })).toBeNull();
  expect(await other.query(api.admin.operation, {})).toBeNull();
  expect((await owner.query(api.admin.runs, { since: now }))?.rows.map((r) => r.requestId)).toEqual(["run-new"]);
  expect((await owner.query(api.admin.errors, { since: now, kind: "chat" }))?.rows.map((r) => r.requestId)).toEqual(["error-new"]);
  expect((await owner.query(api.admin.audits, { since: now, userId: aliceId }))?.rows.map((r) => r.title)).toEqual(["Alice bike"]);
  expect((await owner.query(api.admin.audits, { userId: bobId }))?.rows.map((r) => r.title)).toEqual(["Bob car"]);
  expect((await owner.query(api.admin.alerts, { catchUp: true, userId: aliceId, since: now }))?.rows.map((r) => r.title)).toEqual(["Alice bike"]);
  expect((await owner.query(api.admin.alerts, { catchUp: true, userId: bobId }))?.rows.length).toBe(0);
  expect((await owner.query(api.admin.users, { userId: aliceId, since: now }))?.rows.map((r) => r.email)).toEqual(["alice@example.com"]);
  expect((await owner.query(api.admin.watches, { userId: bobId, since: now }))?.rows.map((r) => r.query)).toEqual(["car"]);
  expect((await owner.query(api.admin.feedback, { userId: aliceId, since: now, search: "bike" }))?.rows.map((r) => r.message)).toEqual(["Alice bike"]);
  expect((await owner.query(api.admin.search, { text: "error-new" }))?.[0]).toMatchObject({ view: "error", title: "error-new" });
});

test("catch-up alerts use their index and combine date, user, watch, and search filters", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const alice = t.withIdentity({ subject: "a", email: "alice@example.com" });
  const bob = t.withIdentity({ subject: "b", email: "bob@example.com" });
  const aliceId = (await alice.mutation(api.users.store, {})).id!;
  const bobId = (await bob.mutation(api.users.store, {})).id!;
  const bike = await alice.mutation(api.watches.create, { query: "bike", schedule: { kind: "daily", times: ["08:00"] }, notify: "good" });
  const chair = await alice.mutation(api.watches.create, { query: "chair", schedule: { kind: "daily", times: ["08:00"] }, notify: "good" });
  const car = await bob.mutation(api.watches.create, { query: "car", schedule: { kind: "daily", times: ["08:00"] }, notify: "good" });
  const now = Date.now();
  await t.run(async (ctx) => {
    for (const [userId, watchId, title, catchUp, createdAt] of [
      [aliceId, bike, "old bike", true, now - 2000],
      [aliceId, bike, "new bike", true, now - 1000],
      [aliceId, bike, "ordinary bike", false, now],
      [aliceId, bike, "legacy bike", undefined, now],
      [aliceId, chair, "new chair", true, now - 1000],
      [bobId, car, "new car", true, now - 1000],
    ] as const) {
      await ctx.db.insert("alerts", { userId, watchId, listingId: title, title, url: "https://example.com",
        reason: "match", channel: "email", emailStatus: "sent", catchUp, createdAt });
    }
  });
  const indexed = await t.run((ctx) => ctx.db.query("alerts").withIndex("by_catchUp_createdAt", (q) =>
    q.eq("catchUp", true).gte("createdAt", now - 1000).lt("createdAt", now)).collect());
  expect(indexed.map((a) => a.title).sort()).toEqual(["new bike", "new car", "new chair"]);
  expect((await owner.query(api.admin.alerts, { catchUp: true }))!.rows.map((a) => a.title).sort())
    .toEqual(["new bike", "new car", "new chair", "old bike"]);
  expect((await owner.query(api.admin.alerts, { catchUp: true, since: now - 1000, until: now,
    userId: aliceId, watchId: bike, search: "BIKE" }))!.rows.map((a) => a.title)).toEqual(["new bike"]);
  expect((await owner.query(api.admin.alerts, { catchUp: false }))!.rows.map((a) => a.title).sort())
    .toEqual(["legacy bike", "ordinary bike"]);
});

test("alert search and rows reuse user and watch reads within one query", async () => {
  const t = convexTest({ schema, modules, transactionLimits: { databaseQueries: 3 } });
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { clerkId: "a", email: "alice@example.com", createdAt: Date.now() });
    const watchId = await ctx.db.insert("watches", { userId, label: "Bike", query: "bike",
      schedule: { kind: "daily", times: ["08:00"] }, timezone: "Europe/Amsterdam", notify: "good",
      active: true, seeded: true, nextRunAt: Date.now(), createdAt: Date.now() });
    for (const title of ["First", "Second"]) await ctx.db.insert("alerts", { userId, watchId,
      listingId: title, title, url: "https://example.com", reason: "match", channel: "email",
      emailStatus: "sent", catchUp: true, createdAt: Date.now() });
  });
  expect((await owner.query(api.admin.alerts, { catchUp: true, search: "alice@example.com" }))!.rows)
    .toMatchObject([{ email: "alice@example.com", watch: "Bike" }, { email: "alice@example.com", watch: "Bike" }]);
});

test("admin lists filter before the 200-row cap and report more", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const other = t.withIdentity({ subject: "x", email: "x@example.com" });
  const now = Date.now();
  await t.run(async (ctx) => {
    await ctx.db.insert("runs", { at: now - 1000, checked: 1, failed: 1, emails: 0, emailFailures: 0,
      requestId: "older-match" });
    for (let i = 0; i < 205; i++) await ctx.db.insert("runs", {
      at: now + i, checked: 1, failed: 0, emails: 0, emailFailures: 0, requestId: `new-${i}`,
    });
  });
  const page = (await owner.query(api.admin.runs, {}))!;
  expect(page.rows).toHaveLength(200);
  expect(page.more).toBe(true);
  expect((await owner.query(api.admin.runs, { failed: true }))!).toMatchObject({
    rows: [{ requestId: "older-match" }], more: false,
  });
  expect((await owner.query(api.admin.runs, { search: "older" }))!.rows.map((r) => r.requestId))
    .toEqual(["older-match"]);
  expect(await other.query(api.admin.runs, {})).toBeNull();
  expect(await other.query(api.admin.userOptions, {})).toBeNull();
  expect(await other.query(api.admin.watchOptions, {})).toBeNull();
});
