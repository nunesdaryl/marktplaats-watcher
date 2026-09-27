import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { notifyValidator, scheduleValidator } from "./schedule";

export default defineSchema({
  // Only what alerts need: the Clerk id and the e-mail address to send them to.
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    createdAt: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  watches: defineTable({
    userId: v.id("users"),
    label: v.string(),
    query: v.string(),
    maxPriceEur: v.optional(v.number()),
    mustInclude: v.optional(v.string()),
    postcode: v.optional(v.string()),
    maxDistanceKm: v.optional(v.number()),
    schedule: scheduleValidator,
    timezone: v.string(),
    notify: notifyValidator,
    active: v.boolean(),
    seeded: v.boolean(),            // false until the first check has recorded what is already listed
    nextRunAt: v.number(),
    lastCheckedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    lastManualAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_active_next", ["active", "nextRunAt"]),

  // Listings a watch has already seen, so each one is only ever alerted once.
  seenListings: defineTable({
    watchId: v.id("watches"),
    listingId: v.string(),
    lastSeenAt: v.number(),
  })
    .index("by_watch_listing", ["watchId", "listingId"])
    .index("by_lastSeen", ["lastSeenAt"]),

  alerts: defineTable({
    userId: v.id("users"),
    watchId: v.id("watches"),
    listingId: v.string(),
    title: v.string(),
    priceEur: v.optional(v.number()),
    city: v.optional(v.string()),
    url: v.string(),
    score: v.optional(v.number()),
    reason: v.string(),
    channel: v.literal("email"),     // Telegram / Discord / WhatsApp come later
    emailStatus: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed"), v.literal("dry-run")),
    createdAt: v.number(),
  })
    .index("by_watch", ["watchId"])
    .index("by_user", ["userId"])
    .index("by_createdAt", ["createdAt"]),
});
