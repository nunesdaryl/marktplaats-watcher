// The owner dashboard (/admin): usage, the funnel, feedback with screenshots, and health. Only the owner gets any data:
// the signed-in account must match BOTH OWNER_CLERK_ID (the Clerk user id) and OWNER_EMAIL. Everyone else, signed in or
// not, gets null, and the app treats /admin as a page that doesn't exist.
// Overview aggregates still have bounded reads; drilldown lists return one small page.
import { ConvexError, v } from "convex/values";
import type { UserIdentity } from "convex/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { describe, describeWhen } from "./schedule";
import { activePatch } from "./watches";
import { WOULD_PAY } from "./feedback";
import { healthReport } from "./health";
import { usageDay } from "./usage";

const DAY = 86_400_000;
const LIMIT = 5000;
const PAGE = 200;

async function listPage<T>(source: AsyncIterable<T>, matches: (row: T) => boolean | Promise<boolean>, size = PAGE) {
  const rows: T[] = [];
  for await (const row of source) {
    if (!(await matches(row))) continue;
    if (rows.length === size) return { rows, more: true };
    rows.push(row);
  }
  return { rows, more: false };
}

/** The owner rule: the Clerk user id AND the e-mail must both match. Not configured = nobody is the owner. */
export function ownerMatches(identity: UserIdentity | null) {
  const ownerId = process.env.OWNER_CLERK_ID?.trim();
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerId || !ownerEmail || !identity) return false;
  return identity.subject === ownerId && identity.email?.trim().toLowerCase() === ownerEmail;
}

export async function isOwner(ctx: Pick<QueryCtx, "auth">) {
  return ownerMatches(await ctx.auth.getUserIdentity());
}

async function requireOwner(ctx: Pick<QueryCtx, "auth">) {
  if (!(await isOwner(ctx))) throw new ConvexError("Not found.");
}

export const amOwner = query({ args: {}, handler: async (ctx) => isOwner(ctx) });

const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);   // UTC day, "2026-09-29"
/** A schedule as a short label ("every 15 min", "daily", "weekly"); the same key filters the watch list. */
const scheduleKey = (s: Doc<"watches">["schedule"]) => s.kind === "interval"
  ? `every ${s.everyMinutes < 60 ? `${s.everyMinutes} min` : `${s.everyMinutes / 60} h`}` : s.kind;
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
    const audits = await ctx.db.query("audits").withIndex("by_at").order("desc").take(LIMIT);
    const events = await ctx.db.query("events").withIndex("by_at", (q) => q.gte("at", since)).order("desc").take(LIMIT);
    const feedback = await ctx.db.query("feedback").withIndex("by_created").order("desc").take(LIMIT);
    const todayUsage = await ctx.db.query("usage").withIndex("by_day", (q) => q.eq("day", usageDay(now))).take(LIMIT);
    const emails = new Map(users.map((u) => [u.clerkId, u.email]));
    const topUsage = todayUsage.sort((a, b) => b.chats - a.chats).slice(0, 5)
      .map((row) => ({ name: emails.get(row.userId) ?? "(unknown user)", count: row.chats }));

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

    const errors = await ctx.db.query("errors").withIndex("by_at", (q) => q.gte("at", now - DAY)).order("desc").collect();
    const pageViews = events.filter((e) => e.name === "page_view");
    const latestAuditAt = audits[0]?.at;
    const latestAudit = audits.filter((a) => a.at === latestAuditAt);
    const latestMisses = audits.flatMap((a) => a.misses.map((m) => ({
      ...m, watchId: a.watchId, watchLabel: watches.find((w) => w._id === a.watchId)?.name ??
        watches.find((w) => w._id === a.watchId)?.label ?? "Deleted watch",
      requestId: a.requestId, at: a.at,
    }))).slice(0, 5);
    const live = (w: Doc<"watches">) => w.archivedAt === undefined;
    const fallingBehind = watches.filter((w) => w.active && live(w) && ((w.backlog ?? 0) >= 20 || w.coverageCapped));
    return {
      now, days,
      totals: {
        users: users.length,
        newUsers7d: users.filter((u) => u.createdAt >= now - 7 * DAY).length,
        active1d: activeSince(now - DAY), active7d: activeSince(now - 7 * DAY), active30d: activeSince(now - 30 * DAY),
        watchesActive: watches.filter((w) => w.active && live(w)).length,
        watchesPaused: watches.filter((w) => !w.active && live(w)).length,
        watchesArchived: watches.filter((w) => !live(w)).length,
        watchesFallingBehind: fallingBehind.length,
        chats: chats.length,
        chatsToday: todayUsage.reduce((sum, row) => sum + row.chats, 0),
        alerts: alerts.length, alerts7d: alerts.filter((a) => a.createdAt >= now - 7 * DAY).length,
        emailsSent: alerts.filter((a) => a.emailStatus === "sent").length,
        emailsFailed: alerts.filter((a) => a.emailStatus === "failed").length,
        feedback: feedback.length,
        events: events.length,
      },
      daily,
      fallingBehindLabels: fallingBehind.map((w) => w.name ?? w.label),
      funnel,
      features: countBy(events, (e) => e.name),
      pages: countBy(pageViews, (e) => e.props?.section || "chat"),
      devices: countBy(events, (e) => e.device),
      themes: countBy(pageViews, (e) => e.props?.value),
      chatModes: countBy(events.filter((e) => e.name === "chat_sent"), (e) => e.props?.mode ?? "search"),
      topUsage,
      schedules: countBy(watches.filter(live), (w) => scheduleKey(w.schedule)),
      notify: countBy(watches.filter(live), (w) => w.notify),
      wouldPay: (Object.keys(WOULD_PAY) as (keyof typeof WOULD_PAY)[])
        .map((key) => ({ key, name: WOULD_PAY[key], count: feedback.filter((f) => f.wouldPay === key).length })),
      health: await healthReport(ctx, now),
      deliveryAudit: { checked: latestAudit.length, misses: latestAudit.reduce((n, a) => n + a.missCount, 0),
        lastRunAt: latestAuditAt ?? null, latestMisses },
      errors24h: { chat: errors.filter((e) => e.kind === "chat").length,
                   check: errors.filter((e) => e.kind === "check").length },
      latestErrors: errors.slice(0, 5).map(({ kind, requestId, message, at }) => ({ kind, requestId, message, at })),
      capped: events.length === LIMIT,
    };
  },
});

/** Feedback, newest first: message, would-pay answer, screenshot, context and what the person did just before. */
export const feedback = query({
  args: { limit: v.optional(v.number()), wouldPay: v.optional(v.string()), userId: v.optional(v.id("users")),
          handled: v.optional(v.boolean()), since: v.optional(v.number()), until: v.optional(v.number()),
          search: v.optional(v.string()) },
  handler: async (ctx, { limit = 50, wouldPay, userId, handled, since, until, search }) => {
    if (!(await isOwner(ctx))) return null;
    const needle = search?.trim().toLowerCase();
    const source = userId ? ctx.db.query("feedback").withIndex("by_user_created", (q) => {
      const lower = q.eq("userId", userId);
      const start = since !== undefined ? lower.gte("createdAt", since) : lower;
      return until !== undefined ? start.lt("createdAt", until) : start;
    }) : ctx.db.query("feedback").withIndex("by_created", (q) => {
      const lower = since !== undefined ? q.gte("createdAt", since) : q;
      return until !== undefined ? lower.lt("createdAt", until) : lower;
    });
    const page = await listPage(source.order("desc"), async (f) =>
      (!wouldPay || f.wouldPay === wouldPay) && (!userId || f.userId === userId)
        && (handled === undefined || !!f.handledAt === handled) && inRange(f.createdAt, since, until)
        && (!needle || [f.message, f.page, (await ctx.db.get(f.userId))?.email]
          .some((x) => x?.toLowerCase().includes(needle))), Math.min(PAGE, limit));
    const rows = await Promise.all(page.rows.map(async (f) => {
      const user = await ctx.db.get(f.userId);
      const before = await ctx.db.query("events")
        .withIndex("by_user_at", (q) => q.eq("userId", f.userId).lte("at", f.createdAt)).order("desc").take(10);
      return {
        _id: f._id, userId: f.userId, createdAt: f.createdAt, handledAt: f.handledAt, wouldPayKey: f.wouldPay,
        email: user?.email ?? "(deleted user)", message: f.message,
        wouldPay: f.wouldPay ? WOULD_PAY[f.wouldPay] : undefined, page: f.page, context: f.context,
        screenshotUrl: f.screenshotId ? await ctx.storage.getUrl(f.screenshotId) : null,
        before: before.reverse().map((e) => ({ at: e.at, name: e.name, props: e.props })),
      };
    }));
    return { rows, more: page.more };
  },
});

// ---------------------------------------------------------------------------------------------------------------
// Drilldown: the exact records behind every number on the dashboard. All owner-only; nobody else gets anything.

type Ctx = QueryCtx;
const emailsOf = async (ctx: Ctx) => new Map((await ctx.db.query("users").take(LIMIT)).map((u) => [u._id as string, u.email]));
const inRange = (t: number, since?: number, until?: number) => (since === undefined || t >= since) && (until === undefined || t < until);
const watchStatus = (w: Doc<"watches">) => (w.archivedAt ? "archived" : w.active ? "active" : "paused");
const includes = (value: string | undefined, search?: string) => !search || !!value?.toLowerCase().includes(search.trim().toLowerCase());

export const userOptions = query({
  args: {},
  handler: async (ctx) => {
    if (!(await isOwner(ctx))) return null;
    return (await ctx.db.query("users").take(LIMIT)).map((u) => ({ _id: u._id, email: u.email }));
  },
});

export const watchOptions = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, { userId }) => {
    if (!(await isOwner(ctx))) return null;
    const source = userId
      ? ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", userId))
      : ctx.db.query("watches");
    return (await source.take(LIMIT)).map((w) => ({ _id: w._id, userId: w.userId, title: w.name ?? w.label }));
  },
});

function watchRow(w: Doc<"watches">, email: string | undefined, alertCount: number, now: number) {
  return {
    _id: w._id, userId: w.userId, email: email ?? "(deleted user)", title: w.name ?? w.label, label: w.label,
    query: w.query, mustInclude: w.mustInclude, maxPriceEur: w.maxPriceEur, postcode: w.postcode, maxDistanceKm: w.maxDistanceKm,
    schedule: describe(w.schedule), scheduleKey: scheduleKey(w.schedule), notify: w.notify, status: watchStatus(w),
    lastCheckedAt: w.lastCheckedAt, nextCheck: w.active && !w.archivedAt ? describeWhen(w.nextRunAt, now) : null,
    lastError: w.lastError, createdAt: w.createdAt, alerts: alertCount,
  };
}

function alertRow(a: Doc<"alerts">, email: string | undefined, watchTitle: string | undefined) {
  return {
    _id: a._id, userId: a.userId, watchId: a.watchId, email: email ?? "(deleted user)", watch: watchTitle ?? "Deleted watch",
    title: a.title, priceEur: a.priceEur, city: a.city, url: a.url, image: a.image, score: a.score, reason: a.reason,
    emailStatus: a.emailStatus, catchUp: !!a.catchUp, listingId: a.listingId,
    attempts: a.attempts ?? 1, createdAt: a.createdAt,
  };
}

/** Which funnel steps an account reached (each step counts on its own, as on the dashboard's funnel). */
function reachedSteps(u: Doc<"users">, has: { chat: Set<string>; watch: Set<string>; alert: Set<string> }) {
  return [true, u.onboardedAt !== undefined, has.chat.has(u._id), has.watch.has(u._id), has.alert.has(u._id)];
}
export const FUNNEL = ["signed_up", "setup", "chatted", "watch", "alert"] as const;

/** Every account: e-mail, dates, how far they got, and how much they use. `stage` = reached that funnel step;
 *  `stuck` = reached the step before it but not this one. */
export const users = query({
  args: { search: v.optional(v.string()), stage: v.optional(v.string()), stuck: v.optional(v.string()),
          activeSince: v.optional(v.number()), userId: v.optional(v.id("users")),
          since: v.optional(v.number()), until: v.optional(v.number()) },
  handler: async (ctx, { search, stage, stuck, activeSince, userId, since, until }) => {
    if (!(await isOwner(ctx))) return null;
    const users = userId ? [await ctx.db.get(userId)].filter((u): u is Doc<"users"> => !!u)
      : await ctx.db.query("users").take(LIMIT);
    const watches = await ctx.db.query("watches").take(LIMIT);
    const chats = await ctx.db.query("chats").take(LIMIT);
    const alerts = await ctx.db.query("alerts").withIndex("by_createdAt").order("desc").take(LIMIT);
    const feedback = await ctx.db.query("feedback").take(LIMIT);
    const events = await ctx.db.query("events").withIndex("by_at").order("desc").take(LIMIT * 4);
    const has = {
      chat: new Set<string>([...chats.map((c) => c.userId), ...events.filter((e) => e.name === "chat_sent").map((e) => e.userId)]),
      watch: new Set<string>(watches.map((w) => w.userId)),
      alert: new Set<string>(alerts.map((a) => a.userId)),
    };
    const lastActive = new Map<string, number>();
    const bump = (id: string, t: number) => { if (t > (lastActive.get(id) ?? 0)) lastActive.set(id, t); };
    events.forEach((e) => bump(e.userId, e.at));
    chats.forEach((c) => bump(c.userId, c.updatedAt));
    const devices = new Map<string, Set<string>>();
    events.forEach((e) => { if (!devices.has(e.userId)) devices.set(e.userId, new Set()); devices.get(e.userId)!.add(e.device); });
    const q = search?.trim().toLowerCase();
    const rows = users.map((u) => {
      const reached = reachedSteps(u, has);
      const mine = watches.filter((w) => w.userId === u._id);
      return {
        _id: u._id, email: u.email, createdAt: u.createdAt, onboardedAt: u.onboardedAt, lastActive: lastActive.get(u._id) ?? null,
        devices: [...(devices.get(u._id) ?? [])], reached,
        furthest: FUNNEL[reached.lastIndexOf(true)],
        watchesActive: mine.filter((w) => watchStatus(w) === "active").length,
        watchesPaused: mine.filter((w) => watchStatus(w) === "paused").length,
        watchesArchived: mine.filter((w) => watchStatus(w) === "archived").length,
        chats: chats.filter((c) => c.userId === u._id).length,
        alerts: alerts.filter((a) => a.userId === u._id).length,
        feedback: feedback.filter((f) => f.userId === u._id).length,
      };
    }).filter((u) => {
      if (userId && u._id !== userId) return false;
      if (!inRange(u.createdAt, since, until)) return false;
      if (q && !u.email.toLowerCase().includes(q)) return false;
      if (stage && !u.reached[FUNNEL.indexOf(stage as (typeof FUNNEL)[number])]) return false;
      if (stuck) {
        const i = FUNNEL.indexOf(stuck as (typeof FUNNEL)[number]);
        if (i < 1 || !u.reached[i - 1] || u.reached[i]) return false;
      }
      if (activeSince !== undefined && (u.lastActive ?? 0) < activeSince) return false;
      return true;
    }).sort((a, b) => (b.lastActive ?? b.createdAt) - (a.lastActive ?? a.createdAt));
    return { rows: rows.slice(0, PAGE), more: rows.length > PAGE };
  },
});

/** One account: everything it has and did. */
export const user = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (!(await isOwner(ctx))) return null;
    const u = await ctx.db.get(userId);
    if (!u) return null;
    const now = Date.now();
    const watches = await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", userId)).collect();
    const titles = new Map(watches.map((w) => [w._id as string, w.name ?? w.label]));
    const alerts = await ctx.db.query("alerts").withIndex("by_user", (q) => q.eq("userId", userId)).order("desc").take(200);
    const chats = await ctx.db.query("chats").withIndex("by_user_updated", (q) => q.eq("userId", userId)).order("desc").take(200);
    const feedback = await ctx.db.query("feedback").withIndex("by_user_created", (q) => q.eq("userId", userId)).order("desc").take(100);
    const events = await ctx.db.query("events").withIndex("by_user_at", (q) => q.eq("userId", userId)).order("desc").take(300);
    return {
      _id: u._id, email: u.email, createdAt: u.createdAt, onboardedAt: u.onboardedAt,
      watches: await Promise.all(watches.map(async (w) =>
        watchRow(w, u.email, (await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", w._id)).take(1000)).length, now))),
      alerts: alerts.map((a) => alertRow(a, u.email, titles.get(a.watchId))),
      chats: await Promise.all(chats.map(async (c) => ({
        _id: c._id, title: c.title, updatedAt: c.updatedAt, pinned: !!c.pinned, archived: !!c.archivedAt,
        messages: (await ctx.db.query("messages").withIndex("by_chat", (q) => q.eq("chatId", c._id)).take(500)).length,
      }))),
      feedback: feedback.map((f) => ({ _id: f._id, createdAt: f.createdAt, message: f.message, handledAt: f.handledAt,
        wouldPay: f.wouldPay ? WOULD_PAY[f.wouldPay] : undefined, page: f.context?.path ?? f.page })),
      events: events.map((e) => ({ _id: e._id, at: e.at, name: e.name, props: e.props, device: e.device })),
    };
  },
});

/** Every watch with its exact search, schedule and status. */
export const watches = query({
  args: { status: v.optional(v.string()), userId: v.optional(v.id("users")), watchId: v.optional(v.id("watches")), scheduleKey: v.optional(v.string()),
          notify: v.optional(v.string()), createdSince: v.optional(v.number()), createdUntil: v.optional(v.number()),
          since: v.optional(v.number()), until: v.optional(v.number()), behind: v.optional(v.boolean()),
          search: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (!(await isOwner(ctx))) return null;
    const now = Date.now();
    const since = a.createdSince ?? a.since;
    const until = a.createdUntil ?? a.until;
    const source = a.userId ? ctx.db.query("watches").withIndex("by_user_createdAt", (q) => {
      const lower = q.eq("userId", a.userId!);
      const start = since !== undefined ? lower.gte("createdAt", since) : lower;
      return until !== undefined ? start.lt("createdAt", until) : start;
    }) : ctx.db.query("watches").withIndex("by_createdAt", (q) => {
      const lower = since !== undefined ? q.gte("createdAt", since) : q;
      return until !== undefined ? lower.lt("createdAt", until) : lower;
    });
    const page = await listPage(source.order("desc"), async (w) =>
      (!a.status || watchStatus(w) === a.status) && (!a.userId || w.userId === a.userId) && (!a.watchId || w._id === a.watchId)
      && (!a.scheduleKey || (scheduleKey(w.schedule) === a.scheduleKey && !w.archivedAt))
      && (!a.notify || (w.notify === a.notify && !w.archivedAt))
      && (!a.behind || (w.active && !w.archivedAt && ((w.backlog ?? 0) >= 20 || !!w.coverageCapped)))
      && inRange(w.createdAt, since, until)
      && (!a.search || [w.name, w.label, w.query, w.mustInclude, w.postcode,
        (await ctx.db.get(w.userId))?.email].some((x) => includes(x, a.search))));
    const out = await Promise.all(page.rows.map(async (w) => watchRow(w, (await ctx.db.get(w.userId))?.email,
      (await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", w._id)).take(1000)).length, now)));
    return { rows: out.sort((x, y) => y.createdAt - x.createdAt), more: page.more };
  },
});

/** One watch: its search, schedule, status, how many listings it has seen, and all its alerts. */
export const watch = query({
  args: { watchId: v.id("watches") },
  handler: async (ctx, { watchId }) => {
    if (!(await isOwner(ctx))) return null;
    const w = await ctx.db.get(watchId);
    if (!w) return null;
    const owner = await ctx.db.get(w.userId);
    const alerts = await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", watchId)).order("desc").take(500);
    const seen = (await ctx.db.query("seenListings").withIndex("by_watch_listing", (q) => q.eq("watchId", watchId)).take(5000)).length;
    return {
      ...watchRow(w, owner?.email, alerts.length, Date.now()), seen, timezone: w.timezone,
      alertList: alerts.map((a) => alertRow(a, owner?.email, w.name ?? w.label)),
    };
  },
});

/** Alerts, newest first, filtered by time, watch, person, score or e-mail status. */
export const alerts = query({
  args: { since: v.optional(v.number()), until: v.optional(v.number()), watchId: v.optional(v.id("watches")),
          userId: v.optional(v.id("users")), minScore: v.optional(v.number()), emailStatus: v.optional(v.string()),
          catchUp: v.optional(v.boolean()), search: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (!(await isOwner(ctx))) return null;
    const source = a.watchId ? ctx.db.query("alerts").withIndex("by_watch_createdAt", (q) => {
      const lower = q.eq("watchId", a.watchId!);
      const start = a.since !== undefined ? lower.gte("createdAt", a.since) : lower;
      return a.until !== undefined ? start.lt("createdAt", a.until) : start;
    }) : a.userId ? ctx.db.query("alerts").withIndex("by_user_createdAt", (q) => {
      const lower = q.eq("userId", a.userId!);
      const start = a.since !== undefined ? lower.gte("createdAt", a.since) : lower;
      return a.until !== undefined ? start.lt("createdAt", a.until) : start;
    })
      : ctx.db.query("alerts").withIndex("by_createdAt", (q) => {
      const lower = a.since !== undefined ? q.gte("createdAt", a.since) : q;
      return a.until !== undefined ? lower.lt("createdAt", a.until) : lower;
    });
    const page = await listPage(source.order("desc"), async (x) =>
      (!a.watchId || x.watchId === a.watchId) && (!a.userId || x.userId === a.userId)
      && (a.minScore === undefined || (x.score ?? -1) >= a.minScore) && (!a.emailStatus || x.emailStatus === a.emailStatus)
      && (a.catchUp === undefined || !!x.catchUp === a.catchUp) && inRange(x.createdAt, a.since, a.until)
      && (!a.search || [x.title, x.listingId, x.city, (await ctx.db.get(x.userId))?.email,
        (await ctx.db.get(x.watchId))?.name, (await ctx.db.get(x.watchId))?.label].some((v) => includes(v, a.search))));
    return { rows: await Promise.all(page.rows.map(async (x) =>
      alertRow(x, (await ctx.db.get(x.userId))?.email, ((w) => w?.name ?? w?.label)(await ctx.db.get(x.watchId))))),
      more: page.more };
  },
});

/** One alert, with its watch and person. */
export const alert = query({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, { alertId }) => {
    if (!(await isOwner(ctx))) return null;
    const x = await ctx.db.get(alertId);
    if (!x) return null;
    const [owner, w] = await Promise.all([ctx.db.get(x.userId), ctx.db.get(x.watchId)]);
    return alertRow(x, owner?.email, w ? w.name ?? w.label : undefined);
  },
});

/** Saved chats, most recently used first. */
export const chats = query({
  args: { userId: v.optional(v.id("users")), since: v.optional(v.number()), until: v.optional(v.number()),
          status: v.optional(v.string()), search: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (!(await isOwner(ctx))) return null;
    const source = a.userId ? ctx.db.query("chats").withIndex("by_user_updated", (q) => {
      const lower = q.eq("userId", a.userId!);
      const start = a.since !== undefined ? lower.gte("updatedAt", a.since) : lower;
      return a.until !== undefined ? start.lt("updatedAt", a.until) : start;
    }) : ctx.db.query("chats").withIndex("by_updated", (q) => {
      const lower = a.since !== undefined ? q.gte("updatedAt", a.since) : q;
      return a.until !== undefined ? lower.lt("updatedAt", a.until) : lower;
    });
    const page = await listPage(source.order("desc"), async (c) =>
      (!a.status || (a.status === "archived" ? !!c.archivedAt : a.status === "pinned" ? !!c.pinned : !c.archivedAt))
      && (!a.search || includes(c.title, a.search) || includes((await ctx.db.get(c.userId))?.email, a.search)));
    return { rows: await Promise.all(page.rows.map(async (c) => ({
      _id: c._id, userId: c.userId, email: (await ctx.db.get(c.userId))?.email ?? "(deleted user)", title: c.title, updatedAt: c.updatedAt,
      pinned: !!c.pinned, archived: !!c.archivedAt,
      messages: (await ctx.db.query("messages").withIndex("by_chat", (q) => q.eq("chatId", c._id)).take(500)).length,
    }))), more: page.more };
  },
});

/** One conversation, every message, with the listings and watch proposals the agent showed. */
export const chat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    if (!(await isOwner(ctx))) return null;
    const c = await ctx.db.get(chatId);
    if (!c) return null;
    const owner = await ctx.db.get(c.userId);
    const messages = await ctx.db.query("messages").withIndex("by_chat", (q) => q.eq("chatId", chatId)).take(500);
    return {
      _id: c._id, userId: c.userId, email: owner?.email ?? "(deleted user)", title: c.title, updatedAt: c.updatedAt,
      pinned: !!c.pinned, archived: !!c.archivedAt,
      messages: messages.map((m) => ({ _id: m._id, at: m._creationTime, role: m.role, content: m.content,
        listings: m.listings ?? [], proposals: m.proposals ?? [], search: m.search ?? null, savedProposals: m.savedProposals ?? [] })),
    };
  },
});

/** The usage log behind every breakdown on the dashboard. */
export const events = query({
  args: { userId: v.optional(v.id("users")), name: v.optional(v.string()), section: v.optional(v.string()),
          device: v.optional(v.string()), mode: v.optional(v.string()), value: v.optional(v.string()),
          since: v.optional(v.number()), until: v.optional(v.number()), search: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (!(await isOwner(ctx))) return null;
    const source = a.userId ? ctx.db.query("events").withIndex("by_user_at", (q) => {
      const lower = q.eq("userId", a.userId!);
      const start = a.since !== undefined ? lower.gte("at", a.since) : lower;
      return a.until !== undefined ? start.lt("at", a.until) : start;
    }) : ctx.db.query("events").withIndex("by_at", (q) => {
      const lower = a.since !== undefined ? q.gte("at", a.since) : q;
      return a.until !== undefined ? lower.lt("at", a.until) : lower;
    });
    const page = await listPage(source.order("desc"), async (e) =>
      (!a.name || e.name === a.name) && (!a.device || e.device === a.device)
      && (!a.section || (e.props?.section || "chat") === a.section) && (!a.mode || (e.props?.mode ?? "search") === a.mode)
      && (!a.value || e.props?.value === a.value)
      && (!a.search || [e.name, e.device, e.props?.section, e.props?.mode, e.props?.kind, e.props?.value,
        (await ctx.db.get(e.userId))?.email].some((x) => includes(x, a.search))));
    return { rows: await Promise.all(page.rows.map(async (e) => ({ _id: e._id, userId: e.userId,
      email: (await ctx.db.get(e.userId))?.email ?? "(deleted user)", at: e.at, name: e.name, props: e.props, device: e.device }))),
      more: page.more };
  },
});

/** One day (a bar on a chart): who was active, and the chats, watches, alerts and sign-ups of that day. */
export const day = query({
  args: { day: v.string() },
  handler: async (ctx, { day }) => {
    if (!(await isOwner(ctx))) return null;
    const since = Date.parse(`${day}T00:00:00Z`);
    if (Number.isNaN(since)) return null;
    const until = since + DAY;
    const now = Date.now();
    const emails = await emailsOf(ctx);
    const events = await ctx.db.query("events").withIndex("by_at", (q) => q.gte("at", since).lt("at", until)).take(LIMIT);
    const chats = (await ctx.db.query("chats").withIndex("by_updated", (q) => q.gte("updatedAt", since).lt("updatedAt", until)).take(LIMIT));
    const watches = (await ctx.db.query("watches").take(LIMIT)).filter((w) => inRange(w.createdAt, since, until));
    const alerts = await ctx.db.query("alerts").withIndex("by_createdAt", (q) => q.gte("createdAt", since).lt("createdAt", until)).take(LIMIT);
    const titles = new Map((await ctx.db.query("watches").take(LIMIT)).map((w) => [w._id as string, w.name ?? w.label]));
    const signups = (await ctx.db.query("users").take(LIMIT)).filter((u) => inRange(u.createdAt, since, until));
    const active = new Map<string, number>();
    [...events.map((e) => e.userId), ...chats.map((c) => c.userId)].forEach((id) => active.set(id, (active.get(id) ?? 0) + 1));
    return {
      day,
      active: [...active.entries()].map(([userId, n]) => ({ userId, email: emails.get(userId) ?? "(deleted user)", actions: n })),
      searches: events.filter((e) => e.name === "chat_sent" && e.props?.mode !== "watch").length,
      watchChats: events.filter((e) => e.name === "chat_sent" && e.props?.mode === "watch").length,
      chats: chats.map((c) => ({ _id: c._id, userId: c.userId, email: emails.get(c.userId) ?? "(deleted user)", title: c.title, updatedAt: c.updatedAt })),
      watches: watches.map((w) => watchRow(w, emails.get(w.userId), 0, now)),
      alerts: alerts.map((x) => alertRow(x, emails.get(x.userId), titles.get(x.watchId))),
      signups: signups.map((u) => ({ _id: u._id, email: u.email, createdAt: u.createdAt })),
    };
  },
});

// ---------------------------------------------------------------------------------------------------------------
// What users say about their alerts (ratings.ts): is the scorer right?

const band = (score?: number) => (score === undefined ? "unscored" : score >= 8 ? "great" : score >= 6 ? "good" : "low");
const BANDS = [["great", "Great matches (8–10)"], ["good", "Good matches (6–7)"], ["low", "Below 6 (every-new-listing watches)"]] as const;
const REASON_LABEL: Record<string, string> = {
  not_asked: "Not what I asked for", score_too_high: "Score too high", score_too_low: "Score too low",
  price: "Price isn't good", reason_wrong: "The reason is wrong",
};

/** How often users agree with the scorer, per score band, and why they don't. */
export const ratingStats = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 30 }) => {
    if (!(await isOwner(ctx))) return null;
    const since = Date.now() - Math.min(90, Math.max(7, days)) * DAY;
    const ratings = (await ctx.db.query("ratings").withIndex("by_created").order("desc").take(LIMIT)).filter((r) => r.updatedAt >= since);
    const alerts = (await ctx.db.query("alerts").withIndex("by_createdAt", (q) => q.gte("createdAt", since)).take(LIMIT))
      .filter((a) => a.emailStatus === "sent");
    const good = ratings.filter((r) => r.verdict === "good").length;
    const reasons: Record<string, number> = {};
    ratings.forEach((r) => r.reasons?.forEach((x) => { reasons[x] = (reasons[x] ?? 0) + 1; }));
    return {
      rated: ratings.length, alertsSent: alerts.length, good, notRight: ratings.length - good,
      fromEmail: ratings.filter((r) => r.source === "email").length,
      bands: BANDS.map(([key, label]) => {
        const rows = ratings.filter((r) => band(r.score) === key);
        const g = rows.filter((r) => r.verdict === "good").length;
        return { key, label, rated: rows.length, good: g, notRight: rows.length - g };
      }),
      reasons: Object.entries(REASON_LABEL).map(([key, label]) => ({ key, name: label, count: reasons[key] ?? 0 }))
        .sort((a, b) => b.count - a.count),
      // A 👍 on a 6–7 says "this could have been great": a hint the great threshold is too strict
      goodCouldBeGreat: ratings.filter((r) => band(r.score) === "good" && r.verdict === "good").length,
      withNote: ratings.filter((r) => r.note).length,
    };
  },
});

/** The ratings themselves, newest first: the listing, its score and reason, and what the user said. */
export const ratings = query({
  args: { verdict: v.optional(v.string()), reason: v.optional(v.string()), band: v.optional(v.string()),
          userId: v.optional(v.id("users")), watchId: v.optional(v.id("watches")),
          since: v.optional(v.number()), until: v.optional(v.number()), minScore: v.optional(v.number()),
          search: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (!(await isOwner(ctx))) return null;
    const source = a.watchId ? ctx.db.query("ratings").withIndex("by_watch_updated", (q) => {
      const lower = q.eq("watchId", a.watchId!);
      const start = a.since !== undefined ? lower.gte("updatedAt", a.since) : lower;
      return a.until !== undefined ? start.lt("updatedAt", a.until) : start;
    }) : a.userId ? ctx.db.query("ratings").withIndex("by_user_updated", (q) => {
      const lower = q.eq("userId", a.userId!);
      const start = a.since !== undefined ? lower.gte("updatedAt", a.since) : lower;
      return a.until !== undefined ? start.lt("updatedAt", a.until) : start;
    })
      : ctx.db.query("ratings").withIndex("by_updated", (q) => {
        const lower = a.since !== undefined ? q.gte("updatedAt", a.since) : q;
        return a.until !== undefined ? lower.lt("updatedAt", a.until) : lower;
      });
    const page = await listPage(source.order("desc"), async (r) =>
      (!a.verdict || r.verdict === a.verdict) && (!a.reason || (r.reasons ?? []).includes(a.reason as never))
      && (!a.band || band(r.score) === a.band) && (!a.userId || r.userId === a.userId)
      && (!a.watchId || r.watchId === a.watchId) && inRange(r.updatedAt, a.since, a.until)
      && (a.minScore === undefined || (r.score ?? -1) >= a.minScore)
      && (!a.search || [r.title, r.note, r.reason, (await ctx.db.get(r.userId))?.email]
        .some((x) => includes(x, a.search))));
    return { rows: await Promise.all(page.rows.map(async (r) => ({
      _id: r._id, alertId: r.alertId, userId: r.userId, email: (await ctx.db.get(r.userId))?.email ?? "(deleted user)", at: r.updatedAt,
      verdict: r.verdict, reasons: (r.reasons ?? []).map((x) => REASON_LABEL[x] ?? x), note: r.note ?? "",
      score: r.score, title: r.title ?? "", reason: r.reason ?? "", source: r.source,
    }))), more: page.more };
  },
});

// ---------------------------------------------------------------------------------------------------------------
// Recent operational records, only for the owner.

export const runs = query({
  args: { since: v.optional(v.number()), until: v.optional(v.number()), requestId: v.optional(v.string()),
          failed: v.optional(v.boolean()), search: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (!(await isOwner(ctx))) return null;
    return listPage(ctx.db.query("runs").withIndex("by_at", (q) => {
      const lower = a.since !== undefined ? q.gte("at", a.since) : q;
      return a.until !== undefined ? lower.lt("at", a.until) : lower;
    }).order("desc"), (r) => (!a.requestId || r.requestId === a.requestId)
      && (a.failed === undefined || (r.failed > 0 || r.emailFailures > 0) === a.failed)
      && includes(r.requestId, a.search));
  },
});

export const errors = query({
  args: { since: v.optional(v.number()), until: v.optional(v.number()), kind: v.optional(v.string()),
          requestId: v.optional(v.string()), search: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (!(await isOwner(ctx))) return null;
    return listPage(ctx.db.query("errors").withIndex("by_at", (q) => {
      const lower = a.since !== undefined ? q.gte("at", a.since) : q;
      return a.until !== undefined ? lower.lt("at", a.until) : lower;
    }).order("desc"), (e) => (!a.kind || e.kind === a.kind) && (!a.requestId || e.requestId === a.requestId)
      && (!a.search || [e.requestId, e.message, e.kind].some((x) => includes(x, a.search))));
  },
});

export const audits = query({
  args: { since: v.optional(v.number()), until: v.optional(v.number()), userId: v.optional(v.id("users")),
          watchId: v.optional(v.id("watches")), kind: v.optional(v.string()),
          minScore: v.optional(v.number()), requestId: v.optional(v.string()), search: v.optional(v.string()) },
  handler: async (ctx, a) => {
    if (!(await isOwner(ctx))) return null;
    const source = a.watchId ? ctx.db.query("audits").withIndex("by_watch_at", (q) => {
      const lower = q.eq("watchId", a.watchId!);
      const start = a.since !== undefined ? lower.gte("at", a.since) : lower;
      return a.until !== undefined ? start.lt("at", a.until) : start;
    }) : ctx.db.query("audits").withIndex("by_at", (q) => {
      const lower = a.since !== undefined ? q.gte("at", a.since) : q;
      return a.until !== undefined ? lower.lt("at", a.until) : lower;
    });
    const rows = [];
    for await (const row of source.order("desc")) {
      if (a.userId && row.userId !== a.userId || a.requestId && row.requestId !== a.requestId) continue;
      for (const miss of row.misses) {
        if (a.kind && miss.kind !== a.kind || a.minScore !== undefined && miss.score < a.minScore) continue;
        const user = await ctx.db.get(row.userId);
        const watch = await ctx.db.get(row.watchId);
        if (a.search && ![miss.title, miss.listingId, row.requestId, user?.email, watch?.name, watch?.label]
          .some((x) => includes(x, a.search))) continue;
        if (rows.length === PAGE) return { rows, more: true };
        rows.push({ ...miss, _id: `${row._id}:${miss.listingId}`, at: row.at, userId: row.userId, watchId: row.watchId,
          email: user?.email ?? "(deleted user)", watch: watch?.name ?? watch?.label ?? "Deleted watch", requestId: row.requestId });
      }
    }
    return { rows, more: false };
  },
});

export const search = query({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    if (!(await isOwner(ctx))) return null;
    const q = text.trim().toLowerCase();
    if (!q) return [];
    const users = await ctx.db.query("users").take(LIMIT);
    const watches = await ctx.db.query("watches").take(LIMIT);
    const alerts = await ctx.db.query("alerts").withIndex("by_createdAt").order("desc").take(LIMIT);
    const chats = await ctx.db.query("chats").withIndex("by_updated").order("desc").take(LIMIT);
    const errors = await ctx.db.query("errors").withIndex("by_at").order("desc").take(LIMIT);
    const runs = await ctx.db.query("runs").withIndex("by_at").order("desc").take(LIMIT);
    const match = (...values: (string | undefined)[]) => values.some((x) => x?.toLowerCase().includes(q));
    return [
      ...users.filter((x) => match(x.email)).map((x) => ({ view: "user", id: x._id as string, title: x.email })),
      ...watches.filter((x) => match(x.name, x.label, x.query)).map((x) => ({ view: "watch", id: x._id as string, title: x.name ?? x.label })),
      ...alerts.filter((x) => match(x.title, x.listingId)).map((x) => ({ view: "alert", id: x._id as string, title: x.title })),
      ...chats.filter((x) => match(x.title)).map((x) => ({ view: "chat", id: x._id as string, title: x.title })),
      ...errors.filter((x) => match(x.requestId)).map((x) => ({ view: "error", id: x._id as string, title: x.requestId })),
      ...runs.filter((x) => match(x.requestId)).map((x) => ({ view: "run", id: x._id as string, title: x.requestId ?? "Run" })),
    ].slice(0, 50);
  },
});

export const operation = query({
  args: { runId: v.optional(v.id("runs")), errorId: v.optional(v.id("errors")) },
  handler: async (ctx, a) => {
    if (!(await isOwner(ctx))) return null;
    if (a.runId) return ctx.db.get(a.runId);
    if (a.errorId) return ctx.db.get(a.errorId);
    return null;
  },
});

// Safe actions for the owner (each confirmed in the dashboard)

/** Pause or resume anyone's watch, exactly as the app does it for its owner (watches.activePatch). */
export const setWatchActive = mutation({
  args: { watchId: v.id("watches"), active: v.boolean() },
  handler: async (ctx, { watchId, active }) => {
    await requireOwner(ctx);
    const w = await ctx.db.get(watchId);
    if (!w) throw new ConvexError("That watch no longer exists.");
    if (active && w.archivedAt) throw new ConvexError("This watch is archived; its owner has to restore it first.");
    await ctx.db.patch(watchId, activePatch(w, active, Date.now()));
  },
});

/** Mark feedback as handled (or not), so the list shows what still needs a look. */
export const setFeedbackHandled = mutation({
  args: { id: v.id("feedback"), handled: v.boolean() },
  handler: async (ctx, { id, handled }) => {
    await requireOwner(ctx);
    if (!(await ctx.db.get(id))) throw new ConvexError("That feedback no longer exists.");
    await ctx.db.patch(id, { handledAt: handled ? Date.now() : undefined });
  },
});

