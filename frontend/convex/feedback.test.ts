import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.useFakeTimers();
  process.env.OWNER_EMAIL = "owner@example.com";
  process.env.AGENTMAIL_API_KEY = "am_test";
  process.env.AGENTMAIL_INBOX_ID = "inbox@test";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); delete process.env.OWNER_CLERK_ID; });

test("feedback is stored, e-mailed to the owner and counted", async () => {
  const t = convexTest(schema, modules);
  const sent: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { sent.push(JSON.parse(init.body as string)); return new Response("{}"); }));
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  await alice.mutation(api.feedback.submit, { message: "  Telegram alerts please  ", wouldPay: "eur5", page: "watches" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toEqual(["owner@example.com"]);
  expect(sent[0].subject).toBe("Feedback from a@example.com: Yes, about €5 a month");
  expect(sent[0].text).toContain("Telegram alerts please");

  await alice.mutation(api.feedback.submit, { wouldPay: "no" });
  const summary = await t.query(internal.feedback.summary, {});
  expect(summary.total).toBe(2);
  expect(summary.wouldPay.filter((a) => a.count)).toEqual([
    { answer: "No, only if it's free", count: 1 }, { answer: "Yes, about €5 a month", count: 1 },
  ]);
});

test("weekly status counts open feedback and shipped replies still waiting", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (const row of [
      { message: "New", createdAt: 1 },
      { message: "Planned", createdAt: 2, status: "planned" as const },
      { message: "Shipped", createdAt: 3, status: "shipped" as const, replyDraft: "Reply" },
      { message: "Answered", createdAt: 4, status: "shipped" as const, repliedAt: 5 },
      { message: "Declined", createdAt: 5, status: "declined" as const },
    ]) await ctx.db.insert("feedback", row);
  });
  expect(await t.query(internal.feedback.loopStatus, {})).toEqual({ new: 1, open: 2, repliesWaiting: 1 });
});

test("empty, too long and too frequent feedback is refused; delete-my-data removes it", async () => {
  const t = convexTest(schema, modules);
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  const bob = t.withIdentity({ subject: "b", email: "b@example.com" });
  await expect(t.mutation(api.feedback.submit, { message: "hi" })).rejects.toThrow(/sign in/);
  await expect(bob.mutation(api.feedback.submit, { message: "   " })).rejects.toThrow(/Write a message/);
  await expect(bob.mutation(api.feedback.submit, { message: "x".repeat(2001) })).rejects.toThrow(/under 2000/);
  for (let i = 0; i < 10; i++) await bob.mutation(api.feedback.submit, { message: `idea ${i}` });
  await expect(bob.mutation(api.feedback.submit, { message: "one more" })).rejects.toThrow(/plenty for today/);
  await bob.mutation(api.users.deleteMyData, {});
  expect((await t.query(internal.feedback.summary, {})).total).toBe(0);
});

test("a screenshot and context are kept with feedback, oversized files are dropped, and both go with delete-my-data", async () => {
  const t = convexTest(schema, modules);
  const sent: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { sent.push(JSON.parse(init.body as string)); return new Response("{}"); }));
  const dana = t.withIdentity({ subject: "d", email: "d@example.com" });
  await dana.mutation(api.users.store, {});
  expect(await dana.mutation(api.feedback.generateUploadUrl, {})).toMatch(/^https?:/);
  const jpeg = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(1000)], { type: "image/jpeg" })));
  const huge = await t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(2_000_000)], { type: "image/jpeg" })));
  const context = { path: "/watch/", viewport: "375×667", device: "phone", theme: "light", version: "abc1234",
                    browser: "Safari 18 on iOS", errors: ["TypeError: x is undefined"] };
  await dana.mutation(api.feedback.submit, { message: "The save button did nothing", screenshotId: jpeg, context });
  await dana.mutation(api.feedback.submit, { message: "Second", screenshotId: huge });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const rows = await t.run((ctx) => ctx.db.query("feedback").collect());
  expect(rows[0].screenshotId).toBe(jpeg);
  expect(rows[0].context?.errors).toEqual(["TypeError: x is undefined"]);
  expect(rows[1].screenshotId).toBeUndefined();                       // over 1.5 MB: dropped
  expect(await t.run((ctx) => ctx.storage.getUrl(huge))).toBeNull();  // and deleted
  expect(sent[0].text).toContain("Screen: phone, 375×667, light mode, Safari 18 on iOS, version abc1234");
  expect(sent[0].text).toContain("TypeError: x is undefined");
  expect(sent[0].text).toContain("/admin/");

  await dana.mutation(api.users.deleteMyData, {});
  expect(await t.run((ctx) => ctx.storage.getUrl(jpeg))).toBeNull();
});

test("factory draft intake reads new feedback and links a filed issue once", async () => {
  const t = convexTest(schema, modules);
  const id = await t.run((ctx) => ctx.db.insert("feedback", { message: "Search missed a bike", source: "email",
    status: "new", createdAt: Date.now() }));
  expect(await t.query(internal.feedback.draftItems, {})).toMatchObject([
    { id, message: "Search missed a bike", issues: [] },
  ]);
  await t.mutation(internal.feedback.planDraft, { id, issue: "MW-60" });
  expect(await t.query(internal.feedback.draftItems, {})).toEqual([]);
  const row = await t.run((ctx) => ctx.db.get(id));
  expect(row).toMatchObject({ status: "planned", issues: ["MW-60"] });
  expect(await t.run((ctx) => ctx.db.query("feedbackEvents").collect())).toMatchObject([
    { feedbackId: id, status: "planned", note: "Draft MW-60 filed in Linear." },
  ]);
  await expect(t.mutation(internal.feedback.planDraft, { id, issue: "MW-61" })).rejects.toThrow(/no longer new/);
});

test("factory advances only linked planned feedback and ships once with a useful draft", async () => {
  const t = convexTest(schema, modules);
  const [linked, other] = await t.run(async (ctx) => [
    await ctx.db.insert("feedback", { message: "Better bids", personName: "Vinod", source: "linkedin", status: "planned", issues: ["MW-90"], featureUrl: "/watches/", createdAt: 1 }),
    await ctx.db.insert("feedback", { message: "Other", status: "planned", issues: ["MW-91"], createdAt: 1 }),
  ]);
  await expect(t.mutation(internal.feedback.shipByIssue, { issue: "MW-90", sha: "a".repeat(40), releaseAt: 100, title: "Bidding help" })).rejects.toThrow(/in progress/);
  expect(await t.mutation(internal.feedback.advanceByIssue, { issue: "MW-90", status: "in_progress" })).toBe(1);
  expect(await t.query(internal.feedback.feedbackToClose, { issue: "MW-90" })).toBe(1);
  expect(await t.mutation(internal.feedback.advanceByIssue, { issue: "MW-90", status: "in_progress" })).toBe(0);
  expect(await t.mutation(internal.feedback.shipByIssue, { issue: "MW-90", sha: "a".repeat(40), releaseAt: 100, title: "Bidding help" })).toBe(1);
  expect(await t.mutation(internal.feedback.shipByIssue, { issue: "MW-90", sha: "a".repeat(40), releaseAt: 100, title: "Bidding help" })).toBe(0);
  const row = await t.run((ctx) => ctx.db.get(linked));
  expect(row).toMatchObject({ status: "shipped", releaseSha: "a".repeat(40), releaseAt: 100 });
  expect(row?.replyDraft).toContain("Bidding help");
  expect(row?.replyDraft).toContain("https://marktplaats-watcher.vercel.app/watches/");
  expect((await t.run((ctx) => ctx.db.get(other)))?.status).toBe("planned");
  expect((await t.run((ctx) => ctx.db.query("feedbackEvents").collect())).filter((e) => e.feedbackId === linked)).toHaveLength(2);
});

test("factory public title removes tracker wording and preserves an owner's edit", async () => {
  const t = convexTest(schema, modules);
  const [id, edited] = await t.run(async (ctx) => [
    await ctx.db.insert("feedback", { status: "in_progress", issues: ["MW-123"], createdAt: 1 }),
    await ctx.db.insert("feedback", { status: "in_progress", issues: ["MW-123"], createdAt: 2,
      publicTitle: "An owner's better title" }),
  ]);
  await t.mutation(internal.feedback.shipByIssue, { issue: "MW-123", sha: "a".repeat(40), releaseAt: 100,
    title: "[factory] MW-123 Help me make an offer: MW-90 follow-up" });
  expect((await t.run((ctx) => ctx.db.get(id)))?.publicTitle).toBe("Help me make an offer");
  expect((await t.run((ctx) => ctx.db.get(edited)))?.publicTitle).toBe("An owner's better title");
  expect((await t.query(api.feedback.whatsNew, {})).map((row) => row.title)).toContain("Help me make an offer");
});

test("hidden or untitled shipped feedback stays off What's new, and the notice uses its public title", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const user = await alice.mutation(api.users.store, {});
  if (user.status !== "admitted") throw new Error("Test account was not admitted");
  await t.run(async (ctx) => {
    await ctx.db.insert("feedback", { status: "shipped", issues: ["MW-1"], releaseAt: 1, createdAt: 1,
      publicTitle: "Private test", showOnWhatsNew: false });
    await ctx.db.insert("feedback", { status: "shipped", issues: ["MW-2"], releaseAt: 2, createdAt: 2 });
    await ctx.db.insert("feedback", { userId: user.id, status: "shipped", issues: ["MW-3"], releaseAt: 3, createdAt: 3,
      publicTitle: "Help me make an offer", showOnWhatsNew: true });
  });
  expect((await t.query(api.feedback.whatsNew, {})).map((row) => row.title)).toEqual(["Help me make an offer"]);
  expect((await alice.query(api.feedback.myShippedNotice, {}))?.title).toBe("Help me make an offer");
});

test("the owner's own account defaults to hidden when factory ships it", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const user = await owner.mutation(api.users.store, {});
  if (user.status !== "admitted") throw new Error("Test account was not admitted");
  const id = await t.run((ctx) => ctx.db.insert("feedback", { userId: user.id, status: "in_progress",
    issues: ["MW-45"], createdAt: 1 }));
  await t.mutation(internal.feedback.shipByIssue, { issue: "MW-45", sha: "a".repeat(40), releaseAt: 100,
    title: "[factory] Test item" });
  expect((await t.run((ctx) => ctx.db.get(id)))?.showOnWhatsNew).toBe(false);
  expect(await t.query(api.feedback.whatsNew, {})).toEqual([]);
});

test("a shipped idea is shown once to its submitter and public credit requires consent", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const user = await alice.mutation(api.users.store, {});
  if (user.status !== "admitted") throw new Error("Test account was not admitted");
  const id = await t.run((ctx) => ctx.db.insert("feedback", { userId: user.id, personName: "Alice", creditName: false,
    message: "Better bids", note: "Bidding help", status: "shipped", issues: ["MW-90"], releaseAt: 100, createdAt: 1,
    publicTitle: "Bidding help", showOnWhatsNew: true }));
  expect((await alice.query(api.feedback.myShippedNotice, {}))?._id).toBe(id);
  expect((await t.query(api.feedback.whatsNew, {}))[0].credit).toBe("a founding user");
  await alice.mutation(api.feedback.dismissShippedNotice, { id });
  expect(await alice.query(api.feedback.myShippedNotice, {})).toBeNull();
  await t.run((ctx) => ctx.db.patch(id, { creditName: true }));
  expect((await t.query(api.feedback.whatsNew, {}))[0].credit).toBe("Alice");
});

test("personal notice skips hidden, untitled, and owner feedback", async () => {
  process.env.OWNER_CLERK_ID = "owner";
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "alice", email: "alice@example.com" });
  const owner = t.withIdentity({ subject: "owner", email: "owner@example.com" });
  const aliceUser = await alice.mutation(api.users.store, {});
  const ownerUser = await owner.mutation(api.users.store, {});
  if (aliceUser.status !== "admitted" || ownerUser.status !== "admitted") throw new Error("Test accounts were not admitted");
  await t.run(async (ctx) => {
    await ctx.db.insert("feedback", { userId: aliceUser.id, status: "shipped", createdAt: 4,
      publicTitle: "Hidden", showOnWhatsNew: false });
    await ctx.db.insert("feedback", { userId: aliceUser.id, status: "shipped", createdAt: 3,
      showOnWhatsNew: true });
    await ctx.db.insert("feedback", { userId: aliceUser.id, status: "shipped", createdAt: 2,
      publicTitle: "Visible", showOnWhatsNew: true });
    await ctx.db.insert("feedback", { userId: ownerUser.id, status: "shipped", createdAt: 1,
      publicTitle: "Owner test", showOnWhatsNew: true });
  });
  expect((await alice.query(api.feedback.myShippedNotice, {}))?.title).toBe("Visible");
  expect(await owner.query(api.feedback.myShippedNotice, {})).toBeNull();
});

test("shipping alerts the owner with a link for each reply to approve", async () => {
  const t = convexTest(schema, modules);
  const sent: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { sent.push(JSON.parse(init.body as string)); return new Response("{}"); }));
  const id = await t.run((ctx) => ctx.db.insert("feedback", { status: "in_progress", issues: ["MW-90"],
    message: "Bids", personName: "Vinod", createdAt: 1 }));
  await t.mutation(internal.feedback.shipByIssue, { issue: "MW-90", sha: "a".repeat(40), releaseAt: 100, title: "Bidding help" });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(sent).toHaveLength(1);
  expect(sent[0].subject).toBe("Ready to close the loop: 1 replies");
  expect(sent[0].text).toContain(`/admin/?view=feedback&id=${id}`);
});

test("What's new and the personal notice never expose triage notes, messages or e-mail addresses", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("feedback", { source: "linkedin" as any, personName: "Vinodkumar Bhovi", personEmail: "v@example.test",
      message: "private message", note: "PRIVATE TRIAGE NOTE", status: "shipped", issues: ["MW-114"], releaseSha: "a".repeat(40),
      releaseAt: Date.now(), createdAt: Date.now(), publicTitle: "Better bids" } as any);
  });
  const rows = await t.query(api.feedback.whatsNew, {});
  const text = JSON.stringify(rows);
  expect(text).not.toContain("PRIVATE TRIAGE NOTE");
  expect(text).not.toContain("private message");
  expect(text).not.toContain("v@example.test");
  expect(text).toContain("a founding user");
});
