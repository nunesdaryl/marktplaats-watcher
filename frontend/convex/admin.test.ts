import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T10:00:00Z"));
  process.env.OWNER_EMAIL = "Owner@Example.com";
  process.env.AGENTMAIL_API_KEY = "am_test";
  process.env.AGENTMAIL_INBOX_ID = "inbox@test";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("only the owner gets dashboard data", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const someone = t.withIdentity({ subject: "s", email: "someone@example.com" });
  expect(await t.query(api.admin.amOwner, {})).toBe(false);
  expect(await someone.query(api.admin.amOwner, {})).toBe(false);
  expect(await someone.query(api.admin.dashboard, {})).toBeNull();
  expect(await someone.query(api.admin.feedback, {})).toBeNull();
  expect(await owner.query(api.admin.amOwner, {})).toBe(true);
  delete process.env.OWNER_EMAIL;
  expect(await owner.query(api.admin.amOwner, {})).toBe(false);   // not configured: nobody is the owner
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

  const [f] = (await owner.query(api.admin.feedback, {}))!;
  expect(f).toMatchObject({ email: "a@example.com", message: "The banner is great", wouldPay: "Maybe", screenshotUrl: null });
  expect(f.before.map((e) => e.name)).toEqual(["page_view", "chat_sent"]);
});
