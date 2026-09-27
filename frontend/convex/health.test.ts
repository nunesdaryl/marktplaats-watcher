import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T05:00:00Z"));   // a Tuesday
  process.env.WATCHER_API_URL = "https://watcher.test";
  process.env.CRON_SECRET = "s3cret";
  process.env.OWNER_EMAIL = "owner@example.com";
  process.env.AGENTMAIL_API_KEY = "am_test";
  process.env.AGENTMAIL_INBOX_ID = "inbox@test";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); delete process.env.CHECKS_PAUSED; });

test("a quiet healthy day sends nothing; failures send one e-mail to the owner", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.health.logRun, { at: Date.now() - 10 * 60_000, checked: 3, failed: 0, emails: 1, emailFailures: 0 });
  const sent: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => { sent.push(JSON.parse(init.body as string)); return new Response("{}"); }));
  expect(await t.action(internal.health.digest, {})).toMatchObject({ sent: false, problems: [] });

  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  const id = await alice.mutation(api.watches.create, { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  await t.run((ctx) => ctx.db.patch(id, { lastError: "Scoring is unavailable right now; will retry." }));
  const result = await t.action(internal.health.digest, {});
  expect(result.sent).toBe(true);
  expect(sent).toHaveLength(1);
  expect(sent[0].to).toEqual(["owner@example.com"]);
  expect(sent[0].subject).toBe("Marktplaats Watcher: 1 problem(s) need a look");
  expect(sent[0].text).toContain('"Mac mini" (Scoring is unavailable');
});

test("a stuck scheduler is a problem", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.health.logRun, { at: Date.now() - 3 * 60 * 60_000, checked: 0, failed: 0, emails: 0, emailFailures: 0 });
  const { problems } = await t.action(internal.health.digest, { dryRun: true });
  expect(problems[0]).toMatch(/hasn't run since/);
});

test("the kill switch stops all checks and shows up in the digest", async () => {
  const t = convexTest(schema, modules);
  const alice = t.withIdentity({ subject: "a", email: "a@example.com" });
  await alice.mutation(api.watches.create, { query: "mac mini", schedule: { kind: "interval", everyMinutes: 60 }, notify: "good" });
  process.env.CHECKS_PAUSED = "1";
  const fetchSpy = vi.fn(); vi.stubGlobal("fetch", fetchSpy);
  expect(await t.action(internal.checker.checkDue, {})).toMatchObject({ paused: true });
  expect(fetchSpy).not.toHaveBeenCalled();
  const { problems } = await t.action(internal.health.digest, { dryRun: true });
  expect(problems).toContain("Checks are paused (CHECKS_PAUSED=1).");
});
