import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { currentUser, requireUser } from "./users";

export const setArchived = mutation({
  args: { id: v.id("alerts"), archived: v.boolean() },
  handler: async (ctx, { id, archived }) => {
    const user = await requireUser(ctx);
    const alert = await ctx.db.get(id);
    if (!alert || alert.userId !== user._id) throw new ConvexError("Alert not found.");
    await ctx.db.patch(id, { archivedAt: archived ? Date.now() : undefined });
  },
});

export const archiveAll = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query("alerts")
      .withIndex("by_user_archivedAt", (q) => q.eq("userId", user._id).eq("archivedAt", undefined))
      .take(500);
    const now = Date.now();
    for (const row of rows) await ctx.db.patch(row._id, { archivedAt: now });
    return { archived: rows.length };
  },
});

export const archived = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const rows = await ctx.db.query("alerts")
      .withIndex("by_user_archivedAt", (q) => q.eq("userId", user._id).gt("archivedAt", 0))
      .order("desc").take(50);
    return Promise.all(rows.map(async (alert) => {
      const watch = await ctx.db.get(alert.watchId);
      return { ...alert, watchLabel: watch ? watch.name ?? watch.label : "Deleted watch" };
    }));
  },
});
