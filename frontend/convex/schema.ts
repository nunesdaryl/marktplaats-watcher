import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { notifyValidator, scheduleValidator } from "./schedule";

// A search result as the chat shows it: facts only, never seller details.
export const listingCard = v.object({
  id: v.union(v.string(), v.null()),
  title: v.string(),
  price_eur: v.union(v.number(), v.null()),
  city: v.union(v.string(), v.null()),
  distance_km: v.union(v.number(), v.null()),
  date: v.optional(v.any()),
  url: v.string(),
  image: v.optional(v.union(v.string(), v.null())),
});

export default defineSchema({
  // Only what alerts need: the Clerk id and the e-mail address to send them to.
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    createdAt: v.number(),
    onboardedAt: v.optional(v.number()),   // set when the first-run setup is finished or skipped
  }).index("by_clerkId", ["clerkId"]),

  // Saved conversations, like ChatGPT's history. Kept until deleted, or 30 days after the last message.
  chats: defineTable({
    userId: v.id("users"),
    title: v.string(),
    updatedAt: v.number(),
  })
    .index("by_user_updated", ["userId", "updatedAt"])
    .index("by_updated", ["updatedAt"]),

  messages: defineTable({
    chatId: v.id("chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    listings: v.optional(v.array(listingCard)),
    proposals: v.optional(v.array(v.any())),     // shape checked in chats.ts
    search: v.optional(v.any()),                 // the last search's arguments, for "Watch this search"
    savedProposals: v.optional(v.array(v.number())),
  }).index("by_chat", ["chatId"]),

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
    .index("by_watch_lastSeen", ["watchId", "lastSeenAt"])
    .index("by_lastSeen", ["lastSeenAt"]),

  alerts: defineTable({
    userId: v.id("users"),
    watchId: v.id("watches"),
    listingId: v.string(),
    title: v.string(),
    priceEur: v.optional(v.number()),
    city: v.optional(v.string()),
    url: v.string(),
    image: v.optional(v.string()),
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
