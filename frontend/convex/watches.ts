import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { currentUser, deleteWatchData, requireUser } from "./users";
import { TIMEZONE, checkSchedule, describe, nextRun, notifyValidator, scheduleValidator } from "./schedule";

export const MAX_WATCHES = 5;

function label(w: { query: string; maxPriceEur?: number; mustInclude?: string; postcode?: string; maxDistanceKm?: number }) {
  const parts = [w.query];
  if (w.mustInclude) parts.push(w.mustInclude);
  if (w.maxPriceEur) parts.push(`under €${w.maxPriceEur}`);
  if (w.postcode && w.maxDistanceKm) parts.push(`within ${w.maxDistanceKm} km of ${w.postcode}`);
  return parts.join(", ").slice(0, 100);
}

function clean(args: { query: string; maxPriceEur?: number; mustInclude?: string; postcode?: string; maxDistanceKm?: number }) {
  const q = args.query.trim().replace(/\s+/g, " ");
  if (q.length < 2 || q.length > 80) throw new ConvexError("Describe the item in 2 to 80 characters.");
  if (args.maxPriceEur !== undefined && !(args.maxPriceEur > 0 && args.maxPriceEur <= 1_000_000))
    throw new ConvexError("The maximum price must be a positive number of euros.");
  const postcode = args.postcode?.replace(/\s/g, "").toUpperCase() || undefined;
  if (postcode && !/^\d{4}[A-Z]{2}$/.test(postcode)) throw new ConvexError("A Dutch postcode looks like 1012AB.");
  if (args.maxDistanceKm !== undefined && !(args.maxDistanceKm > 0 && args.maxDistanceKm <= 300))
    throw new ConvexError("The distance must be between 1 and 300 km.");
  const mustInclude = args.mustInclude?.trim().slice(0, 40) || undefined;
  return {
    query: q, maxPriceEur: args.maxPriceEur, mustInclude, postcode,
    maxDistanceKm: postcode ? args.maxDistanceKm : undefined,
  };
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
    const count = (await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()).length;
    if (count >= MAX_WATCHES) throw new ConvexError(`You can have up to ${MAX_WATCHES} watches. Delete one first.`);
    checkSchedule(args.schedule);
    const fields = clean(args);
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

export const update = mutation({
  args: {
    id: v.id("watches"),
    schedule: v.optional(scheduleValidator),
    notify: v.optional(notifyValidator),
    active: v.optional(v.boolean()),
    maxPriceEur: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, { id, ...change }) => {
    const watch = await ownWatch(ctx, id);
    const now = Date.now();
    const patch: Partial<Doc<"watches">> = {};
    if (change.notify) patch.notify = change.notify;
    if (change.maxPriceEur !== undefined) {
      const { maxPriceEur } = clean({ query: watch.query, maxPriceEur: change.maxPriceEur ?? undefined });
      patch.maxPriceEur = maxPriceEur;
      patch.label = label({ ...watch, maxPriceEur });
    }
    if (change.schedule) {
      checkSchedule(change.schedule);
      patch.schedule = change.schedule;
    }
    if (change.active !== undefined) patch.active = change.active;
    if (change.schedule || change.active) {
      patch.nextRunAt = watch.seeded ? nextRun(change.schedule ?? watch.schedule, now, watch.timezone) : now;
      patch.lastError = undefined;
    }
    await ctx.db.patch(id, patch);
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
    if (watch.lastManualAt && now - watch.lastManualAt < 60_000) throw new ConvexError("Checked a moment ago. Try again in a minute.");
    await ctx.db.patch(id, { nextRunAt: now, lastManualAt: now, active: true });
    await ctx.scheduler.runAfter(0, internal.checker.checkDue, {});
  },
});

/** The signed-in user's watches with plain-English schedules and their latest alerts. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const watches = await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return Promise.all(watches.map(async (w) => ({
      ...w,
      summary: describe(w.schedule),
      alerts: await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", w._id)).order("desc").take(5),
    })));
  },
});
