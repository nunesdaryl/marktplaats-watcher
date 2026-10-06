import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

/** Only existing scored alerts from this person's watch may supply comparison prices. */
export const forListing = internalQuery({
  args: { clerkId: v.string(), watchId: v.id("watches"), url: v.string() },
  handler: async (ctx, { clerkId, watchId, url }) => {
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
    const watch = await ctx.db.get(watchId);
    if (!user || !watch || watch.userId !== user._id) return null;
    const listing = await ctx.db.query("alerts").withIndex("by_watch_url", (q) => q.eq("watchId", watchId).eq("url", url)).first();
    if (!listing) return null;
    const alerts = await ctx.db.query("alerts").withIndex("by_watch", (q) => q.eq("watchId", watchId)).order("desc").take(100);
    return { maxPriceEur: watch.maxPriceEur ?? null, title: listing.title, priceEur: listing.priceEur,
      description: listing.description ?? "",
      similarPricesEur: alerts.filter((a) => a.url !== url && a.score !== undefined && a.priceEur !== undefined)
        .slice(0, 10).map((a) => a.priceEur!) };
  },
});
