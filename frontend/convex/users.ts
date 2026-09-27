import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";

/** The signed-in user's row, or null. */
export async function currentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject)).unique();
}

/** The signed-in user's row, created on first use. Throws when nobody is signed in. */
export async function requireUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Please sign in first.");
  const existing = await currentUser(ctx);
  const email = identity.email;
  if (!email) throw new ConvexError("Your account has no e-mail address, so we can't send alerts.");
  if (existing) {
    if (existing.email !== email) await ctx.db.patch(existing._id, { email });
    return { ...existing, email };
  }
  const id = await ctx.db.insert("users", { clerkId: identity.subject, email, createdAt: Date.now() });
  return (await ctx.db.get(id))!;
}

/** Called by the app after sign-in, so the e-mail address is on file before the first watch. */
export const store = mutation({
  args: {},
  handler: async (ctx) => (await requireUser(ctx))._id,
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    return user && { email: user.email };
  },
});

export async function deleteWatchData(ctx: MutationCtx, watchId: Id<"watches">) {
  for (const row of await ctx.db.query("seenListings").withIndex("by_watch_listing", (q) => q.eq("watchId", watchId)).collect())
    await ctx.db.delete(row._id);
  for (const row of await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", watchId)).collect())
    await ctx.db.delete(row._id);
  await ctx.db.delete(watchId);
}

/** GDPR: remove everything we store about the signed-in user (watches, seen listings, alerts, e-mail). */
export const deleteMyData = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return;
    for (const watch of await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect())
      await deleteWatchData(ctx, watch._id);
    await ctx.db.delete(user._id);
  },
});
