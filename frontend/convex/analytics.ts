// Website visitors for the owner dashboard, from Vercel Web Analytics (cookieless; counts signed-out visitors too).
// Owner-only: the same rule as admin.isOwner. Needs VERCEL_TOKEN (expires; renew per RUNBOOK.md), VERCEL_PROJECT_ID
// and VERCEL_TEAM_ID in the Convex env. Nothing is stored; each dashboard visit asks Vercel.
import { v } from "convex/values";
import { action } from "./_generated/server";
import { ownerMatches } from "./admin";

const DAY = 86_400_000;
const API = "https://api.vercel.com/v1/query/web-analytics/visits";
const BREAKDOWNS = { pages: "requestPath", referrers: "referrerHostname", countries: "country", devices: "deviceType",
  browsers: "browserName", systems: "osName" } as const;

type Row = { name: string; visitors: number; pageviews: number };
type Result =
  | { status: "ok"; since: string; until: string; visitors: number; pageviews: number;
      daily: { day: string; visitors: number; pageviews: number }[]; breakdowns: Record<keyof typeof BREAKDOWNS, Row[]> }
  | { status: "not_configured" | "token_expired" | "error"; message: string };

export const webAnalytics = action({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 30 }): Promise<Result | null> => {
    if (!ownerMatches(await ctx.auth.getUserIdentity())) return null;
    const token = process.env.VERCEL_TOKEN, projectId = process.env.VERCEL_PROJECT_ID, teamId = process.env.VERCEL_TEAM_ID;
    if (!token || !projectId || !teamId) return { status: "not_configured", message: "Vercel Web Analytics isn't connected yet (RUNBOOK.md §11)." };
    days = Math.min(90, Math.max(1, Math.round(days)));
    const until = new Date(Date.now() + DAY).toISOString().slice(0, 10);
    const since = new Date(Date.now() - (days - 1) * DAY).toISOString().slice(0, 10);
    const base = `projectId=${projectId}&teamId=${teamId}&since=${since}T00:00:00Z&until=${until}T00:00:00Z`;
    const get = async (path: string) => {
      const res = await fetch(`${API}/${path}${path.includes("?") ? "&" : "?"}${base}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error("token"), { expired: true });
      if (!res.ok) throw new Error(`Vercel answered ${res.status}`);
      return (await res.json()).data;
    };
    try {
      const [count, daily, ...lists] = await Promise.all([
        get("count"),
        get("aggregate?by=day&limit=100"),
        ...Object.values(BREAKDOWNS).map((by) => get(`aggregate?by=${by}&limit=20`)),
      ]);
      const breakdowns = Object.fromEntries(Object.entries(BREAKDOWNS).map(([key, by], i) => [key,
        (lists[i] as Record<string, string | number>[]).map((r) => ({
          name: String(r[by] ?? "") || (by === "referrerHostname" ? "(direct)" : "(unknown)"),
          visitors: Number(r.visitors ?? 0), pageviews: Number(r.pageviews ?? 0),
        }))])) as Record<keyof typeof BREAKDOWNS, Row[]>;
      return {
        status: "ok", since, until, visitors: Number(count.visitors ?? 0), pageviews: Number(count.pageviews ?? 0),
        daily: (daily as { timestamp: string; visitors: number; pageviews: number }[])
          .map((d) => ({ day: d.timestamp.slice(0, 10), visitors: d.visitors, pageviews: d.pageviews })),
        breakdowns,
      };
    } catch (e) {
      if ((e as { expired?: boolean }).expired)
        return { status: "token_expired", message: "The Vercel token expired or was revoked. Renew it (RUNBOOK.md §11)." };
      return { status: "error", message: "Vercel Web Analytics didn't answer. Try again in a minute." };
    }
  },
});
