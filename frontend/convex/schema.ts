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

// What the app adds to feedback so a bug can be reproduced: where it was sent from and what the screen was like
export const feedbackContext = v.object({
  path: v.string(),                        // e.g. "/watch/" (never the ids in the query string)
  viewport: v.string(),                    // "375×667"
  device: v.string(),                      // "phone" | "desktop"
  theme: v.string(),                       // "light" | "dark"
  version: v.optional(v.string()),         // the deployed git commit
  browser: v.optional(v.string()),
  errors: v.optional(v.array(v.string())), // the last few errors in that tab
});

// Why a user said an alert was "not right" (ratings.ts); the chips on the rating step
export const RATING_REASONS = ["not_asked", "score_too_high", "score_too_low", "price", "reason_wrong"] as const;
export const ratingReason = v.union(...RATING_REASONS.map((r) => v.literal(r)));

// Usage events for the owner dashboard: which features are used, never what anyone types (events.ts)
export const eventProps = v.object({
  section: v.optional(v.string()),
  mode: v.optional(v.string()),
  kind: v.optional(v.string()),
  value: v.optional(v.string()),
});

export const catchupItem = v.object({
  watchId: v.id("watches"), userId: v.id("users"), listingId: v.string(),
  title: v.string(), url: v.string(), priceEur: v.optional(v.number()),
  score: v.number(), city: v.optional(v.string()), image: v.optional(v.string()),
});

export default defineSchema({
  // Only what alerts need: the Clerk id and the e-mail address to send them to.
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    createdAt: v.number(),
    onboardedAt: v.optional(v.number()),   // set when the first-run setup is finished or skipped
    alertsSeenAt: v.optional(v.number()),  // last time the Alerts page was open: newer alerts count as new
  }).index("by_clerkId", ["clerkId"]),

  usage: defineTable({
    userId: v.string(),             // verified Clerk id; a user row may not exist yet
    day: v.string(),                // Europe/Amsterdam calendar day
    chats: v.number(),
  }).index("by_user_day", ["userId", "day"]).index("by_day", ["day"]),

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
    screenshotId: v.optional(v.id("_storage")),   // the page it was sent from, e-mail addresses masked (opt-out)
    context: v.optional(feedbackContext),
    handledAt: v.optional(v.number()),          // the owner marked it handled on the dashboard
    createdAt: v.number(),
  }).index("by_user_created", ["userId", "createdAt"]).index("by_created", ["createdAt"]),

  // Users' verdicts on their alerts ("good match" / "not right, because …"): labelled examples for the scorer's
  // evaluation (evals/report.py) and the owner dashboard. One per alert; a new rating replaces the old one.
  ratings: defineTable({
    alertId: v.id("alerts"),
    userId: v.id("users"),
    watchId: v.id("watches"),
    verdict: v.union(v.literal("good"), v.literal("not_right")),
    reasons: v.optional(v.array(ratingReason)),
    note: v.optional(v.string()),
    score: v.optional(v.number()),               // the alert's score when it was rated
    notify: v.optional(v.string()),              // the watch's "which alerts" setting then
    title: v.optional(v.string()),               // kept for the evaluation even after the alert is forgotten (30 days)
    reason: v.optional(v.string()),              // the scorer's reason that was rated
    listing: v.optional(listingCard),             // scorer input kept after the alert expires
    watchDescription: v.optional(v.string()),
    source: v.union(v.literal("app"), v.literal("email")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_alert", ["alertId"]).index("by_user", ["userId"]).index("by_created", ["createdAt"])
    .index("by_watch", ["watchId"]).index("by_updated", ["updatedAt"])
    .index("by_user_updated", ["userId", "updatedAt"]).index("by_watch_updated", ["watchId", "updatedAt"]),

  // One row per feature use (kept 90 days), for the owner dashboard. No message text or search words.
  events: defineTable({
    userId: v.id("users"),
    name: v.string(),
    props: v.optional(eventProps),
    device: v.union(v.literal("phone"), v.literal("desktop")),
    at: v.number(),
  }).index("by_at", ["at"]).index("by_user_at", ["userId", "at"]),

  // One row per scheduler run, for the owner's health digest (kept 30 days).
  runs: defineTable({
    at: v.number(),
    checked: v.number(),
    failed: v.number(),
    emails: v.number(),
    emailFailures: v.number(),
    timeouts: v.optional(v.number()),
    paused: v.optional(v.boolean()),
    requestId: v.optional(v.string()),
  }).index("by_at", ["at"]),

  audits: defineTable({
    at: v.number(),
    watchId: v.id("watches"),
    userId: v.id("users"),
    requestId: v.string(),
    ok: v.boolean(),
    read: v.number(),
    scored: v.number(),
    unscored: v.optional(v.number()),
    missCount: v.number(),
    misses: v.array(v.object({
      listingId: v.string(), title: v.string(), url: v.string(), score: v.number(),
      kind: v.union(v.literal("handled"), v.literal("never_read"),
        v.literal("rescored"), v.literal("never_scored")),
      checkScore: v.optional(v.number()),
    })),
    error: v.optional(v.string()),
  }).index("by_at", ["at"]).index("by_watch_at", ["watchId", "at"]),

  catchupPlans: defineTable({
    at: v.number(),
    status: v.union(v.literal("draft"), v.literal("sent")),
    items: v.array(catchupItem),
  }),

  errors: defineTable({
    kind: v.union(v.literal("chat"), v.literal("check")),
    requestId: v.string(),
    message: v.string(),
    at: v.number(),
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
    seededAt: v.optional(v.number()),
    watermark: v.optional(v.number()),   // newest Marktplaats listing number handled: only newer ones are new
    lastReadAt: v.optional(v.number()),  // last check that read Marktplaats: the next one reads from that day on
    nextRunAt: v.number(),
    lastCheckedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    backlog: v.optional(v.number()),
    coverageCapped: v.optional(v.boolean()),
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
    .index("by_createdAt", ["createdAt"])
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_active_next", ["active", "nextRunAt"]),

  // Listings a watch has already seen, so each one is only ever alerted once.
  seenListings: defineTable({
    watchId: v.id("watches"),
    listingId: v.string(),
    lastSeenAt: v.number(),
    score: v.optional(v.number()),
    reason: v.optional(v.string()),
    scoredAt: v.optional(v.number()),
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
    catchUp: v.optional(v.boolean()),
    attempts: v.optional(v.number()),   // e-mail send attempts; missing = 1
    attemptAt: v.optional(v.number()),  // when the latest attempt started; missing = createdAt
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
  })
    .index("by_emailStatus", ["emailStatus", "createdAt"])
    .index("by_watch", ["watchId"])
    .index("by_user", ["userId"])
    .index("by_user_archivedAt", ["userId", "archivedAt"])
    .index("by_watch_createdAt", ["watchId", "createdAt"])
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_catchUp_createdAt", ["catchUp", "createdAt"])
    .index("by_createdAt", ["createdAt"]),
});
