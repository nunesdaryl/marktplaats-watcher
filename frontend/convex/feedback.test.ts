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
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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
