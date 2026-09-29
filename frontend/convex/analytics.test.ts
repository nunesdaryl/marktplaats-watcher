import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T10:00:00Z"));
  process.env.OWNER_EMAIL = "owner@example.com";
  process.env.OWNER_CLERK_ID = "o";
  process.env.VERCEL_TOKEN = "tok";
  process.env.VERCEL_PROJECT_ID = "prj_1";
  process.env.VERCEL_TEAM_ID = "team_1";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("web analytics: owner only, not configured, token expired, and the numbers when it works", async () => {
  const t = convexTest(schema, modules);
  const owner = t.withIdentity({ subject: "o", email: "owner@example.com" });
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    urls.push(url);
    const by = new URL(url).searchParams.get("by");
    const data = !by ? { visitors: 4, pageviews: 9 }
      : by === "day" ? [{ timestamp: "2026-09-29T00:00:00.000Z", visitors: 2, pageviews: 3 }]
      : by === "referrerHostname" ? [{ referrerHostname: "", visitors: 3, pageviews: 7 }]
      : [{ [by]: "NL", visitors: 3, pageviews: 7 }];
    return new Response(JSON.stringify({ data }));
  }));
  expect(await t.withIdentity({ subject: "x", email: "owner@example.com" }).action(api.analytics.webAnalytics, {})).toBeNull();
  const ok = (await owner.action(api.analytics.webAnalytics, { days: 7 }))!;
  expect(ok).toMatchObject({ status: "ok", visitors: 4, pageviews: 9, since: "2026-09-23", until: "2026-09-30" });
  if (ok.status !== "ok") throw new Error();
  expect(ok.daily).toEqual([{ day: "2026-09-29", visitors: 2, pageviews: 3 }]);
  expect(ok.breakdowns.referrers[0].name).toBe("(direct)");
  expect(ok.breakdowns.countries[0]).toEqual({ name: "NL", visitors: 3, pageviews: 7 });
  expect(urls.every((u) => u.includes("teamId=team_1") && u.includes("projectId=prj_1"))).toBe(true);

  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
  expect((await owner.action(api.analytics.webAnalytics, {}))!.status).toBe("token_expired");
  delete process.env.VERCEL_TOKEN;
  expect((await owner.action(api.analytics.webAnalytics, {}))!.status).toBe("not_configured");
});
