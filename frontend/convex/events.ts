// Usage events for the owner dashboard (admin.ts): which features are used, on phone or desktop, never what anyone
// types. Sent in small batches by the app (src/lib/track.js), kept 90 days, deleted with "Delete my data".
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation } from "./_generated/server";
import { eventProps } from "./schema";
import { currentUser } from "./users";

const DAY = 86_400_000;
export const KEEP_DAYS = 90;
const PER_CALL = 20;
const PER_DAY = 500;

// Only these names are stored; anything else is dropped (so a bug or a curious user can't fill the table)
export const EVENT_NAMES = [
  "page_view", "chat_sent", "chip_clicked", "watch_saved", "watch_paused", "watch_resumed", "watch_deleted",
  "watch_archived", "alert_opened", "listing_opened", "feedback_opened", "feedback_sent", "theme_changed", "onboarding_done",
  "history_opened", "alert_rated",
] as const;
const ALLOWED = new Set<string>(EVENT_NAMES);

const eventArg = v.object({
  name: v.string(),
  props: v.optional(eventProps),
  device: v.union(v.literal("phone"), v.literal("desktop")),
  at: v.number(),
});

export const track = mutation({
  args: { events: v.array(eventArg) },
  handler: async (ctx, { events }) => {
    const user = await currentUser(ctx);
    if (!user) return 0;                                  // signed out: nothing to link it to
    const now = Date.now();
    const today = await ctx.db.query("events")
      .withIndex("by_user_at", (q) => q.eq("userId", user._id).gte("at", now - DAY)).take(PER_DAY);
    let room = Math.min(PER_CALL, PER_DAY - today.length);
    let stored = 0;
    for (const e of events) {
      if (room <= 0) break;
      if (!ALLOWED.has(e.name)) continue;
      const props = e.props && Object.fromEntries(Object.entries(e.props)
        .filter(([, value]) => typeof value === "string").map(([k, value]) => [k, (value as string).slice(0, 40)]));
      // Clock skew or an old queue: keep events inside the last hour and never in the future
      const at = Math.min(now, Math.max(now - 3_600_000, e.at));
      await ctx.db.insert("events", { userId: user._id, name: e.name, props, device: e.device, at });
      room--; stored++;
    }
    return stored;
  },
});

/** Daily: forget events older than 90 days, a page at a time. */
export const purge = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db.query("events").withIndex("by_at", (q) => q.lt("at", Date.now() - KEEP_DAYS * DAY)).take(500);
    for (const row of old) await ctx.db.delete(row._id);
    if (old.length === 500) await ctx.scheduler.runAfter(0, internal.events.purge, {});
    return old.length;
  },
});
