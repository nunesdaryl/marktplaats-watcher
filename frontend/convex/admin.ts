// The owner dashboard (/admin): usage, the funnel, feedback with screenshots, and health. Only the owner gets any data:
// the signed-in account must match BOTH OWNER_CLERK_ID (the Clerk user id) and OWNER_EMAIL. Everyone else, signed in or
// not, gets null, and the app treats /admin as a page that doesn't exist.
// MVP scale: each query reads at most a few thousand rows per table (see LIMIT); fine for a beta, not for 100k users.
import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { WOULD_PAY } from "./feedback";
import { healthReport } from "./health";

const DAY = 86_400_000;
const LIMIT = 5000;

/** True only for the owner: the Clerk user id AND the e-mail must both match. Not configured = nobody is the owner. */
export async function isOwner(ctx: QueryCtx) {
  const ownerId = process.env.OWNER_CLERK_ID?.trim();
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const identity = await ctx.auth.getUserIdentity();
  if (!ownerId || !ownerEmail || !identity) return false;
  return identity.subject === ownerId && identity.email?.trim().toLowerCase() === ownerEmail;
}

export const amOwner = query({ args: {}, handler: async (ctx) => isOwner(ctx) });

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);   // UTC day, "2026-09-29"
const countBy = <T,>(rows: T[], key: (r: T) => string | undefined) => {
  const out: Record<string, number> = {};
  for (const r of rows) { const k = key(r); if (k) out[k] = (out[k] ?? 0) + 1; }
  return Object.entries(out).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
};

export const dashboard = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 30 }) => {
    if (!(await isOwner(ctx))) return null;
    days = Math.min(90, Math.max(7, Math.round(days)));
    const now = Date.now();
    const since = now - days * DAY;

    const users = await ctx.db.query("users").take(LIMIT);
    const watches = await ctx.db.query("watches").take(LIMIT);
    const chats = await ctx.db.query("chats").withIndex("by_updated").order("desc").take(LIMIT);
    const alerts = await ctx.db.query("alerts").withIndex("by_createdAt").order("desc").take(LIMIT);
    const events = await ctx.db.query("events").withIndex("by_at", (q) => q.gte("at", since)).order("desc").take(LIMIT * 4);
    const feedback = await ctx.db.query("feedback").withIndex("by_created").order("desc").take(LIMIT);

    // Active = used the app (any event) or had a chat updated in the window
    const activeSince = (t: number) => new Set([
      ...events.filter((e) => e.at >= t).map((e) => e.userId),
      ...chats.filter((c) => c.updatedAt >= t).map((c) => c.userId),
    ]).size;

    // One row per day, oldest first
    const series = Array.from({ length: days }, (_, i) => dayKey(now - (days - 1 - i) * DAY));
    const perDay = <T,>(rows: T[], at: (r: T) => number, filter: (r: T) => boolean = () => true) => {
      const m: Record<string, number> = {};
      for (const r of rows) if (at(r) >= since && filter(r)) m[dayKey(at(r))] = (m[dayKey(at(r))] ?? 0) + 1;
      return m;
    };
    const activePerDay: Record<string, Set<string>> = {};
    for (const e of events) (activePerDay[dayKey(e.at)] ??= new Set()).add(e.userId);
    const searches = perDay(events, (e) => e.at, (e) => e.name === "chat_sent" && e.props?.mode !== "watch");
    const watchChats = perDay(events, (e) => e.at, (e) => e.name === "chat_sent" && e.props?.mode === "watch");
    const newWatches = perDay(watches, (w) => w.createdAt);
    const newAlerts = perDay(alerts, (a) => a.createdAt);
    const signups = perDay(users, (u) => u.createdAt);
    const daily = series.map((day) => ({
      day, active: activePerDay[day]?.size ?? 0, searches: searches[day] ?? 0, watchChats: watchChats[day] ?? 0,
      watches: newWatches[day] ?? 0, alerts: newAlerts[day] ?? 0, signups: signups[day] ?? 0,
    }));

    // Funnel: every account ever, then how far each got
    const withChat = new Set([...chats.map((c) => c.userId), ...events.filter((e) => e.name === "chat_sent").map((e) => e.userId)]);
    const withWatch = new Set(watches.map((w) => w.userId));
    const withAlert = new Set(alerts.map((a) => a.userId));
    const funnel = [
      { step: "Signed up", count: users.length },
      { step: "Finished setup", count: users.filter((u) => u.onboardedAt !== undefined).length },
      { step: "Chatted", count: users.filter((u) => withChat.has(u._id)).length },
      { step: "Saved a watch", count: users.filter((u) => withWatch.has(u._id)).length },
      { step: "Got an alert", count: users.filter((u) => withAlert.has(u._id)).length },
    ];

    const pageViews = events.filter((e) => e.name === "page_view");
    const live = (w: Doc<"watches">) => w.archivedAt === undefined;
    return {
      now, days,
      totals: {
        users: users.length,
        newUsers7d: users.filter((u) => u.createdAt >= now - 7 * DAY).length,
        active1d: activeSince(now - DAY), active7d: activeSince(now - 7 * DAY), active30d: activeSince(now - 30 * DAY),
        watchesActive: watches.filter((w) => w.active && live(w)).length,
        watchesPaused: watches.filter((w) => !w.active && live(w)).length,
        watchesArchived: watches.filter((w) => !live(w)).length,
        chats: chats.length,
        alerts: alerts.length, alerts7d: alerts.filter((a) => a.createdAt >= now - 7 * DAY).length,
        emailsSent: alerts.filter((a) => a.emailStatus === "sent").length,
        emailsFailed: alerts.filter((a) => a.emailStatus === "failed").length,
        feedback: feedback.length,
        events: events.length,
      },
      daily,
      funnel,
      features: countBy(events, (e) => e.name),
      pages: countBy(pageViews, (e) => e.props?.section || "chat"),
      devices: countBy(events, (e) => e.device),
      themes: countBy(pageViews, (e) => e.props?.value),
      chatModes: countBy(events.filter((e) => e.name === "chat_sent"), (e) => e.props?.mode ?? "search"),
      schedules: countBy(watches.filter(live), (w) => w.schedule.kind === "interval"
        ? `every ${w.schedule.everyMinutes < 60 ? `${w.schedule.everyMinutes} min` : `${w.schedule.everyMinutes / 60} h`}`
        : w.schedule.kind),
      notify: countBy(watches.filter(live), (w) => w.notify),
      wouldPay: (Object.keys(WOULD_PAY) as (keyof typeof WOULD_PAY)[])
        .map((key) => ({ name: WOULD_PAY[key], count: feedback.filter((f) => f.wouldPay === key).length })),
      health: await healthReport(ctx, now),
      capped: events.length === LIMIT * 4,
    };
  },
});

/** Feedback, newest first: message, would-pay answer, screenshot, context and what the person did just before. */
export const feedback = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 50 }) => {
    if (!(await isOwner(ctx))) return null;
    const rows = await ctx.db.query("feedback").withIndex("by_created").order("desc").take(Math.min(200, limit));
    return await Promise.all(rows.map(async (f) => {
      const user = await ctx.db.get(f.userId);
      const before = await ctx.db.query("events")
        .withIndex("by_user_at", (q) => q.eq("userId", f.userId).lte("at", f.createdAt)).order("desc").take(10);
      return {
        _id: f._id, createdAt: f.createdAt, email: user?.email ?? "(deleted user)", message: f.message,
        wouldPay: f.wouldPay ? WOULD_PAY[f.wouldPay] : undefined, page: f.page, context: f.context,
        screenshotUrl: f.screenshotId ? await ctx.storage.getUrl(f.screenshotId) : null,
        before: before.reverse().map((e) => ({ at: e.at, name: e.name, props: e.props })),
      };
    }));
  },
});
