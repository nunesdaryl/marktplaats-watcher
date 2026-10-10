import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { ownerMatches } from "./admin";
import { maxUsers } from "./beta";
import { deleteChat } from "./chats";
import { deleteAlertEmbedding } from "./embeddings";
import { insertTracked, patchTracked, deleteTracked } from "./totals";

/** The signed-in user's row, or null. */
export async function currentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).unique();
}

const DAY = 86_400_000;
const OFFER_AT = Date.parse("2026-10-05T00:00:00Z");
const FREE_PERIOD = 30 * DAY;
const ADMISSIONS_KEY = "founding-admissions";
const attributionArgs = {
  utm_source: v.optional(v.string()), utm_medium: v.optional(v.string()),
  utm_campaign: v.optional(v.string()),
  landingLanguage: v.optional(v.union(v.literal("nl"), v.literal("en"))),
};

function attribution(args: { utm_source?: string; utm_medium?: string; utm_campaign?: string; landingLanguage?: "nl" | "en" }) {
  const clean = (value?: string) => value?.trim().slice(0, 100) || undefined;
  return { utmSource: clean(args.utm_source), utmMedium: clean(args.utm_medium),
    utmCampaign: clean(args.utm_campaign), landingLanguage: args.landingLanguage };
}

async function admissionTotal(ctx: QueryCtx) {
  return ctx.db.query("dashboardTotals").withIndex("by_key", (q) => q.eq("key", ADMISSIONS_KEY)).unique();
}

// Initialize once from live accounts. Thereafter this total never falls when an account is deleted.
async function initializeAdmissions(ctx: MutationCtx) {
  const total = await admissionTotal(ctx);
  if (total) return total;
  let admitted = 0;
  for await (const user of ctx.db.query("users")) {
    const owner = user.clerkId === process.env.OWNER_CLERK_ID?.trim()
      && user.email.trim().toLowerCase() === process.env.OWNER_EMAIL?.trim().toLowerCase();
    if (!owner) admitted++;
    if (user.admittedAt === undefined)
      await patchTracked(ctx, "users", user._id, { admittedAt: OFFER_AT, freeUntil: OFFER_AT + FREE_PERIOD });
  }
  const id = await ctx.db.insert("dashboardTotals", { key: ADMISSIONS_KEY, rows: [], admitted });
  return (await ctx.db.get(id))!;
}

async function position(ctx: QueryCtx, createdAt: number, id: Id<"waitlist">) {
  const earlier = await ctx.db.query("waitlist").withIndex("by_createdAt", (q) => q.lte("createdAt", createdAt)).collect();
  return earlier.filter((row) => row.createdAt < createdAt || row._id <= id).length;
}

async function admit(ctx: MutationCtx, lookingFor?: string, firstTouch?: ReturnType<typeof attribution>) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Please sign in first.");
  const existing = await currentUser(ctx);
  const email = identity.email;
  if (!email) throw new ConvexError("Your account has no e-mail address, so we can't send alerts. Add one under your account (top right).");
  if (existing) {
    if (existing.email !== email) await patchTracked(ctx, "users", existing._id, { email });
    // Existing accounts stay admitted even before the one-time counter initialization.
    if (existing.admittedAt === undefined) await initializeAdmissions(ctx);
    return { status: "admitted" as const, user: (await ctx.db.get(existing._id))! };
  }
  const total = await initializeAdmissions(ctx);
  const waiting = await ctx.db.query("waitlist").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).unique();
  const first = await ctx.db.query("waitlist").withIndex("by_createdAt").first();
  if (!ownerMatches(identity) && (total.admitted! >= maxUsers() || first && first._id !== waiting?._id)) {
    const id = waiting?._id ?? await ctx.db.insert("waitlist", { clerkId: identity.subject, email, createdAt: Date.now(), ...firstTouch, ...(lookingFor ? { lookingFor } : {}) });
    if (waiting && (waiting.email !== email || lookingFor !== undefined))
      await ctx.db.patch(id, { email, ...(lookingFor !== undefined ? { lookingFor } : {}) });
    const row = (await ctx.db.get(id))!;
    return { status: "waitlisted" as const, position: await position(ctx, row.createdAt, id) };
  }
  const now = Date.now();
  const id = await insertTracked(ctx, "users", { clerkId: identity.subject, email, createdAt: now,
    admittedAt: now, freeUntil: now + FREE_PERIOD,
    ...(waiting ? { utmSource: waiting.utmSource, utmMedium: waiting.utmMedium,
      utmCampaign: waiting.utmCampaign, landingLanguage: waiting.landingLanguage } : firstTouch) });
  if (!ownerMatches(identity)) await ctx.db.patch(total._id, { admitted: total.admitted! + 1 });
  if (waiting) await ctx.db.delete(waiting._id);
  return { status: "admitted" as const, user: (await ctx.db.get(id))! };
}

/** The signed-in user's admitted row, created on first use. */
export async function requireUser(ctx: MutationCtx) {
  const result = await admit(ctx);
  if (result.status === "waitlisted") throw new ConvexError("All free places are taken. You're on the waitlist.");
  return result.user;
}

/** Called by the app after sign-in, so the e-mail address is on file before the first watch. */
export const store = mutation({
  args: attributionArgs,
  handler: async (ctx, args) => {
    const result = await admit(ctx, undefined, attribution(args));
    return result.status === "admitted" ? { status: result.status, id: result.user._id }
      : { status: result.status, position: result.position };
  },
});

export const setLookingFor = mutation({
  args: { lookingFor: v.string() },
  handler: async (ctx, { lookingFor }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Please sign in first.");
    const row = await ctx.db.query("waitlist").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).unique();
    if (!row) throw new ConvexError("You're not on the waitlist.");
    await ctx.db.patch(row._id, { lookingFor: lookingFor.trim().slice(0, 200) });
  },
});

export const placesLeft = query({ args: {}, handler: async (ctx) => {
  const total = await admissionTotal(ctx);
  if (total) return { left: Math.max(0, maxUsers() - (total.admitted ?? 0)), capacity: maxUsers() };
  const users = await ctx.db.query("users").collect();
  const ownerId = process.env.OWNER_CLERK_ID?.trim();
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return { left: Math.max(0, maxUsers() - users.filter((u) => u.clerkId !== ownerId || u.email.trim().toLowerCase() !== ownerEmail).length), capacity: maxUsers() };
} });

export const myWaitlist = query({ args: {}, handler: async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const row = await ctx.db.query("waitlist").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).unique();
  return row && { position: await position(ctx, row.createdAt, row._id), lookingFor: row.lookingFor };
} });

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    return user && { email: user.email, onboarded: user.onboardedAt !== undefined,
      alertsSeenAt: user.alertsSeenAt, createdAt: user.createdAt, freeUntil: user.freeUntil };
  },
});

/** The Alerts page is open: its alerts are no longer "new" (the count on the Alerts tab). */
export const markAlertsSeen = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    await ctx.db.patch(user._id, { alertsSeenAt: Date.now() });
  },
});

/** The first-run setup was finished or skipped: don't show it again. */
export const finishOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (user.onboardedAt === undefined) await patchTracked(ctx, "users", user._id, { onboardedAt: Date.now() });
  },
});

export async function deleteWatchData(ctx: MutationCtx, watchId: Id<"watches">) {
  for (const row of await ctx.db.query("audits").withIndex("by_watch_at", (q) => q.eq("watchId", watchId)).collect())
    await deleteTracked(ctx, "audits", row._id);
  for (const row of await ctx.db.query("ratings").withIndex("by_watch", (q) => q.eq("watchId", watchId)).collect())
    await deleteTracked(ctx, "ratings", row._id);
  for (const row of await ctx.db.query("seenListings").withIndex("by_watch_listing", (q) => q.eq("watchId", watchId)).collect())
    await ctx.db.delete(row._id);
  for (const row of await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", watchId)).collect()) {
    await deleteAlertEmbedding(ctx, row._id);
    await deleteTracked(ctx, "alerts", row._id);
  }
  await deleteTracked(ctx, "watches", watchId);
}

/** GDPR: remove everything we store about the signed-in user (watches, seen listings, alerts, chats, feedback and its
 * screenshots, usage events, e-mail). */
export const deleteMyData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        const waiting = await ctx.db.query("waitlist").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).unique();
        if (waiting) await ctx.db.delete(waiting._id);
      }
      return;
    }
    for (const watch of await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect())
      await deleteWatchData(ctx, watch._id);
    for (const chat of await ctx.db.query("chats").withIndex("by_user_updated", (q) => q.eq("userId", user._id)).collect())
      await deleteChat(ctx, chat._id);
    for (const row of await ctx.db.query("usage").withIndex("by_user_day", (q) => q.eq("userId", user.clerkId)).collect())
      await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("aiSpend").withIndex("by_user_window", (q) => q.eq("userId", user._id)).collect())
      await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("aiSpendMonthly").withIndex("by_user_month", (q) => q.eq("userId", user._id)).collect())
      await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("aiBudgets").withIndex("by_user_window", (q) => q.eq("userId", user._id)).collect())
      await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("foundingRounds").withIndex("by_user_round", (q) => q.eq("userId", user._id)).collect())
      await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("feedback").withIndex("by_user_created", (q) => q.eq("userId", user._id)).collect()) {
      if (row.screenshotId) await ctx.storage.delete(row.screenshotId);
      for (const event of await ctx.db.query("feedbackEvents").withIndex("by_feedback", (q) => q.eq("feedbackId", row._id)).collect())
        await ctx.db.delete(event._id);
      await deleteTracked(ctx, "feedback", row._id);
    }
    for (const row of await ctx.db.query("events").withIndex("by_user_at", (q) => q.eq("userId", user._id)).collect())
      await deleteTracked(ctx, "events", row._id);
    for (const row of await ctx.db.query("ratings").withIndex("by_user", (q) => q.eq("userId", user._id)).collect())
      await deleteTracked(ctx, "ratings", row._id);
    for (const folder of await ctx.db.query("folders").withIndex("by_user", (q) => q.eq("userId", user._id)).collect())
      await ctx.db.delete(folder._id);
    for (const row of await ctx.db.query("alertEmbeddings").filter((q) => q.eq(q.field("userId"), user._id)).collect())
      await ctx.db.delete(row._id);
    await deleteTracked(ctx, "users", user._id);
  },
});
