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

// The answers to "Would you pay for this?" (labels in feedback.ts)
export const wouldPayValidator = v.union(v.literal("no"), v.literal("maybe"), v.literal("eur2"), v.literal("eur5"), v.literal("eur10"));

export default defineSchema({
  // Only what alerts need: the Clerk id and the e-mail address to send them to.
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    createdAt: v.number(),
    onboardedAt: v.optional(v.number()),   // set when the first-run setup is finished or skipped
  }).index("by_clerkId", ["clerkId"]),

  // Folders group chats and watches, like ChatGPT Projects. Deleting a folder never deletes what's in it.
  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    pinned: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Feedback and "would you pay?" answers from the in-app button. Each one is e-mailed to the owner.
  feedback: defineTable({
    userId: v.id("users"),
    message: v.optional(v.string()),
    wouldPay: v.optional(wouldPayValidator),
    page: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user_created", ["userId", "createdAt"]).index("by_created", ["createdAt"]),

  // One row per scheduler run, for the owner's health digest (kept 30 days).
  runs: defineTable({
    at: v.number(),
    checked: v.number(),
    failed: v.number(),
    emails: v.number(),
    emailFailures: v.number(),
    paused: v.optional(v.boolean()),
  }).index("by_at", ["at"]),

  // Saved conversations, like ChatGPT's history. Kept until deleted, or 30 days after the last message.
  chats: defineTable({
    userId: v.id("users"),
    title: v.string(),
    updatedAt: v.number(),
    pinned: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    folderId: v.optional(v.id("folders")),
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
    name: v.optional(v.string()),              // the user's own name; `label` (from the filters) is the fallback
    pinned: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),        // archived watches are paused and hidden from the lists
    folderId: v.optional(v.id("folders")),
    searchEditedAt: v.optional(v.number()),   // results of a check claimed before this are for the old search
    scheduleEditedAt: v.optional(v.number()), // schedule, pause/resume or "Check now" changed after a claim: keep that
    leaseUntil: v.optional(v.number()),       // a check is running until this time; no second claim meanwhile
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
    attempts: v.optional(v.number()),   // e-mail send attempts; missing = 1
    attemptAt: v.optional(v.number()),  // when the latest attempt started; missing = createdAt
    createdAt: v.number(),
  })
    .index("by_emailStatus", ["emailStatus", "createdAt"])
    .index("by_watch", ["watchId"])
    .index("by_user", ["userId"])
    .index("by_createdAt", ["createdAt"]),
});
