import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { currentUser, deleteWatchData, requireUser } from "./users";
import { checkTargetFolder, cleanName } from "./folders";
import { TIMEZONE, checkSchedule, describe, nextRun, notifyValidator, scheduleValidator } from "./schedule";

export const MAX_WATCHES = 5;

function label(w: { query: string; maxPriceEur?: number; mustInclude?: string; postcode?: string; maxDistanceKm?: number }) {
  const parts = [w.query];
  if (w.mustInclude) parts.push(w.mustInclude);
  if (w.maxPriceEur) parts.push(`under €${w.maxPriceEur}`);
  if (w.postcode && w.maxDistanceKm) parts.push(`within ${w.maxDistanceKm} km of ${w.postcode}`);
  const text = parts.join(", ").slice(0, 100);
  return text.charAt(0).toUpperCase() + text.slice(1);   // "gazelle bike" -> "Gazelle bike"
}

function clean(args: { query: string; maxPriceEur?: number; mustInclude?: string; postcode?: string; maxDistanceKm?: number }) {
  const q = args.query.trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 80) throw new ConvexError("Describe the item in 2 to 80 characters.");
  if (args.maxPriceEur !== undefined && !(args.maxPriceEur > 0 && args.maxPriceEur <= 1_000_000))
    throw new ConvexError("Enter a max price in whole euros, like 500.");
  const postcode = args.postcode?.replace(/\s/g, "").toUpperCase() || undefined;
  if (postcode && !/^\d{4}[A-Z]{2}$/.test(postcode)) throw new ConvexError("A Dutch postcode looks like 1012AB.");
  if (args.maxDistanceKm !== undefined && !(args.maxDistanceKm > 0 && args.maxDistanceKm <= 300))
    throw new ConvexError("Pick a distance from 1 to 300 km.");
  const mustInclude = args.mustInclude?.trim().slice(0, 40) || undefined;
  return {
    query: q, maxPriceEur: args.maxPriceEur, mustInclude, postcode,
    maxDistanceKm: postcode ? args.maxDistanceKm : undefined,
  };
}

type SearchFields = { query: string; maxPriceEur?: number; mustInclude?: string; postcode?: string; maxDistanceKm?: number };

function sameSearch(w: SearchFields, f: SearchFields) {
  return w.query.toLowerCase() === f.query.toLowerCase() && w.maxPriceEur === f.maxPriceEur &&
    (w.mustInclude ?? "").toLowerCase() === (f.mustInclude ?? "").toLowerCase() && w.postcode === f.postcode &&
    w.maxDistanceKm === f.maxDistanceKm;
}

function rejectDuplicate(mine: Doc<"watches">[], fields: SearchFields) {
  const same = mine.find((w) => sameSearch(w, fields));
  if (same) throw new ConvexError(`You already watch "${same.name ?? same.label}". Edit that one to change its schedule.`);
}

async function ownWatch(ctx: Parameters<typeof requireUser>[0], id: Id<"watches">) {
  const user = await requireUser(ctx);
  const watch = await ctx.db.get(id);
  if (!watch || watch.userId !== user._id) throw new ConvexError("Watch not found.");  // same answer: no probing
  return watch;
}

const search = {
  query: v.string(),
  maxPriceEur: v.optional(v.number()),
  mustInclude: v.optional(v.string()),
  postcode: v.optional(v.string()),
  maxDistanceKm: v.optional(v.number()),
};

export const create = mutation({
  args: { ...search, schedule: scheduleValidator, notify: notifyValidator },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const mine = await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    if (mine.length >= MAX_WATCHES) throw new ConvexError(`You can have up to ${MAX_WATCHES} watches. Delete one to add another.`);
    checkSchedule(args.schedule);
    const fields = clean(args);
    rejectDuplicate(mine, fields);
    const now = Date.now();
    const id = await ctx.db.insert("watches", {
      userId: user._id, label: label(fields), ...fields, schedule: args.schedule, timezone: TIMEZONE,
      notify: args.notify, active: true, seeded: false, nextRunAt: now, createdAt: now,
    });
    // The first check only records what is already listed, so you're not e-mailed about old listings.
    await ctx.scheduler.runAfter(0, internal.checker.checkDue, {});
    return id;
  },
});

/** Pause or resume, the same way from the app and from the owner dashboard: a resumed watch gets its next check from
 *  its schedule (or right away if its first look hasn't happened yet), and any old error is cleared. */
export function activePatch(watch: Doc<"watches">, active: boolean, now: number): Partial<Doc<"watches">> {
  const patch: Partial<Doc<"watches">> = { active, scheduleEditedAt: now };
  if (active) {
    patch.nextRunAt = watch.seeded ? nextRun(watch.schedule, now, watch.timezone) : now;
    patch.lastError = undefined;
  }
  return patch;
}

export const update = mutation({
  args: {
    id: v.id("watches"),
    schedule: v.optional(scheduleValidator),
    notify: v.optional(notifyValidator),
    active: v.optional(v.boolean()),
    maxPriceEur: v.optional(v.union(v.number(), v.null())),
    query: v.optional(v.string()),
    mustInclude: v.optional(v.union(v.string(), v.null())),
    postcode: v.optional(v.union(v.string(), v.null())),
    maxDistanceKm: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, { id, ...change }) => {
    const watch = await ownWatch(ctx, id);
    const now = Date.now();
    const patch: Partial<Doc<"watches">> = {};
    if (change.active && watch.archivedAt) throw new ConvexError("This watch is archived. Restore it first.");
    if (change.notify) patch.notify = change.notify;

    // The search itself: any field left out keeps its current value; null clears it
    const pick = <T,>(value: T | null | undefined, current: T | undefined) => (value === undefined ? current : value ?? undefined);
    const searchChanged = ["query", "maxPriceEur", "mustInclude", "postcode", "maxDistanceKm"].some((k) => (change as Record<string, unknown>)[k] !== undefined);
    if (searchChanged) {
      const fields = clean({
        query: change.query ?? watch.query, maxPriceEur: pick(change.maxPriceEur, watch.maxPriceEur),
        mustInclude: pick(change.mustInclude, watch.mustInclude), postcode: pick(change.postcode, watch.postcode),
        maxDistanceKm: pick(change.maxDistanceKm, watch.maxDistanceKm),
      });
      const others = (await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", watch.userId)).collect())
        .filter((w) => w._id !== id);
      rejectDuplicate(others, fields);
      Object.assign(patch, fields, { label: label(fields), searchEditedAt: now });   // a check under way is now stale
      if (!sameSearch(watch, fields) && (fields.query.toLowerCase() !== watch.query.toLowerCase() ||
          fields.postcode !== watch.postcode || fields.maxDistanceKm !== watch.maxDistanceKm)) {
        // A different search: start over with a silent first look, so old listings aren't e-mailed as new
        for (const row of await ctx.db.query("seenListings").withIndex("by_watch_listing", (q) => q.eq("watchId", id)).collect())
          await ctx.db.delete(row._id);
        patch.seeded = false;
        patch.watermark = undefined;         // a different search: its own newest listings
        patch.nextRunAt = now;
        patch.leaseUntil = undefined;        // the new search can be checked right away; the old run's result is ignored
      }
    }
    if (change.schedule) {
      checkSchedule(change.schedule);
      patch.schedule = change.schedule;
    }
    if (change.active !== undefined) Object.assign(patch, activePatch({ ...watch, schedule: change.schedule ?? watch.schedule }, change.active, now));
    if (change.schedule || change.active !== undefined) patch.scheduleEditedAt = now;
    if (change.schedule && !change.active && patch.seeded !== false) {
      patch.nextRunAt = watch.seeded ? nextRun(change.schedule, now, watch.timezone) : now;
      patch.lastError = undefined;
    }
    if (patch.seeded === false) { patch.nextRunAt = now; }
    await ctx.db.patch(id, patch);
    if (patch.seeded === false) await ctx.scheduler.runAfter(0, internal.checker.checkDue, {});   // first look now
  },
});

/** Your own name for a watch; empty goes back to the automatic one from its filters. */
export const rename = mutation({
  args: { id: v.id("watches"), name: v.union(v.string(), v.null()) },
  handler: async (ctx, { id, name }) => {
    await ownWatch(ctx, id);
    await ctx.db.patch(id, { name: name === null || !name.trim() ? undefined : cleanName(name, 60, "watch") });
  },
});

export const setPinned = mutation({
  args: { id: v.id("watches"), pinned: v.boolean() },
  handler: async (ctx, { id, pinned }) => {
    await ownWatch(ctx, id);
    await ctx.db.patch(id, { pinned });
  },
});

/** Archive hides and pauses a watch (no checks, no e-mails). Restoring doesn't resume it on its own. */
export const setArchived = mutation({
  args: { id: v.id("watches"), archived: v.boolean() },
  handler: async (ctx, { id, archived }) => {
    await ownWatch(ctx, id);
    await ctx.db.patch(id, archived ? { archivedAt: Date.now(), active: false, pinned: false } : { archivedAt: undefined });
  },
});

export const move = mutation({
  args: { id: v.id("watches"), folderId: v.union(v.id("folders"), v.null()) },
  handler: async (ctx, { id, folderId }) => {
    await ownWatch(ctx, id);
    await ctx.db.patch(id, { folderId: await checkTargetFolder(ctx, folderId) });
  },
});

export const remove = mutation({
  args: { id: v.id("watches") },
  handler: async (ctx, { id }) => {
    await ownWatch(ctx, id);
    await deleteWatchData(ctx, id);
  },
});

/** The "Check now" button: at most once a minute per watch. */
export const checkNow = mutation({
  args: { id: v.id("watches") },
  handler: async (ctx, { id }) => {
    const watch = await ownWatch(ctx, id);
    const now = Date.now();
    if (!watch.active) throw new ConvexError("This watch is paused. Resume it first, then check.");
    if (watch.lastManualAt && now - watch.lastManualAt < 60_000) throw new ConvexError("Checked a moment ago. Try again in a minute.");
    await ctx.db.patch(id, { nextRunAt: now, lastManualAt: now, scheduleEditedAt: now });   // runs after any check under way
    await ctx.scheduler.runAfter(0, internal.checker.checkDue, {});
  },
});

async function withDetails(ctx: QueryCtx, watches: Doc<"watches">[]) {
  return Promise.all(watches.map(async (w) => ({
    ...w,
    title: w.name ?? w.label,
    summary: describe(w.schedule),
    alerts: await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", w._id)).order("desc").take(5),
  })));
}

/** The signed-in user's watches (not archived), pinned first, with plain-English schedules and latest alerts. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const watches = (await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect())
      .filter((w) => !w.archivedAt)
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.createdAt - b.createdAt);
    return withDetails(ctx, watches);
  },
});

export const archived = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const watches = (await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect())
      .filter((w) => w.archivedAt).sort((a, b) => b.archivedAt! - a.archivedAt!);
    return withDetails(ctx, watches);
  },
});

export const NEW_ALERTS_CAP = 10;   // the tab shows "9+" from here on, so counting further is wasted reads

/** How many alerts arrived since the Alerts page was last open (at most NEW_ALERTS_CAP): the count on the Alerts tab. */
export const newAlertCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return 0;
    const since = user.alertsSeenAt ?? user.createdAt;
    const latest = await ctx.db.query("alerts").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(NEW_ALERTS_CAP);
    return latest.filter((a) => a.createdAt > since).length;
  },
});

/** The signed-in user's latest alerts across all watches, newest first (the Alerts tab). */
export const alerts = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const rows = await ctx.db.query("alerts").withIndex("by_user", (q) => q.eq("userId", user._id)).order("desc").take(50);
    const labels = new Map<string, string>();
    return Promise.all(rows.map(async (a) => {
      if (!labels.has(a.watchId)) {
        const w = await ctx.db.get(a.watchId);
        labels.set(a.watchId, w ? w.name ?? w.label : "Deleted watch");
      }
      return { ...a, watchLabel: labels.get(a.watchId)! };
    }));
  },
});
