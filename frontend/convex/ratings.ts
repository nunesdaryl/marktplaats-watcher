// Users rate their alerts: "Good match" (thanks, nothing more to ask) or "Not right" (then: why?). Each rating is a
// labelled example for the scorer: the owner dashboard shows how often users agree per score band, and
// evals/report.py compares it with the judge-model evaluation. From the app (signed in) or one click from the alert
// e-mail: those links carry a code that only rates that one alert (HMAC of the alert id with RATING_SECRET).
import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { ratingReason } from "./schema";
import { currentUser, requireUser } from "./users";

const verdict = v.union(v.literal("good"), v.literal("not_right"));
const MAX_NOTE = 500;

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** The e-mail link code for one alert, or null when RATING_SECRET isn't set (the e-mail then has no rating links). */
export async function ratingToken(alertId: string): Promise<string | null> {
  const secret = process.env.RATING_SECRET;
  if (!secret) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`rate-alert:${alertId}`))).slice(0, 32);
}

async function tokenMatches(alertId: string, token: string) {
  const expected = await ratingToken(alertId);
  if (!expected || token.length !== expected.length) return false;
  let diff = 0;                                              // constant-time compare
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

/** Record a verdict (rate) or the why behind "not right" (explain). "Good match" never keeps a why. */
async function save(ctx: MutationCtx, alert: Doc<"alerts">, change:
  | { verdict: "good" | "not_right"; source: "app" | "email" }
  | { explain: { reasons: Doc<"ratings">["reasons"]; note: string }; source: "app" | "email" }) {
  const now = Date.now();
  const existing = await ctx.db.query("ratings").withIndex("by_alert", (q) => q.eq("alertId", alert._id)).unique();
  let fields: Pick<Doc<"ratings">, "verdict" | "reasons" | "note">;
  if ("explain" in change) {
    fields = { verdict: "not_right", reasons: change.explain.reasons, note: change.explain.note.trim().slice(0, MAX_NOTE) || undefined };
  } else if (change.verdict === "good") {
    fields = { verdict: "good", reasons: undefined, note: undefined };
  } else {  // "not right" again: keep the why given earlier, if any
    fields = { verdict: "not_right", reasons: existing?.verdict === "not_right" ? existing.reasons : undefined,
               note: existing?.verdict === "not_right" ? existing.note : undefined };
  }
  if (existing) {
    await ctx.db.patch(existing._id, { ...fields, source: change.source, updatedAt: now });
    return existing._id;
  }
  const watch = await ctx.db.get(alert.watchId);
  return await ctx.db.insert("ratings", {
    alertId: alert._id, userId: alert.userId, watchId: alert.watchId, ...fields,
    score: alert.score, notify: watch?.notify, title: alert.title.slice(0, 200), reason: alert.reason.slice(0, 200),
    watchDescription: watch?.label,
    listing: { id: alert.listingId, title: alert.title, price_eur: alert.priceEur ?? null,
      city: alert.city ?? null, distance_km: null, url: alert.url, image: alert.image ?? null },
    source: change.source, createdAt: now, updatedAt: now,
  });
}

async function ownAlert(ctx: MutationCtx, alertId: Id<"alerts">) {
  const user = await requireUser(ctx);
  const alert = await ctx.db.get(alertId);
  if (!alert || alert.userId !== user._id) throw new ConvexError("This alert isn't yours or no longer exists.");
  return alert;
}

async function tokenAlert(ctx: MutationCtx, alertId: string, token: string) {
  const id = ctx.db.normalizeId("alerts", alertId);
  if (!id || !(await tokenMatches(alertId, token))) throw new ConvexError("This link isn't valid. Rate the alert in the app instead.");
  const alert = await ctx.db.get(id);
  if (!alert) throw new ConvexError("This alert is older than 30 days and was deleted, so it can't be rated anymore.");
  return alert;
}

const checkReasons = (reasons?: string[]) => {
  if (reasons && reasons.length > 5) throw new ConvexError("Pick up to five reasons.");
};

/** Signed in, on the Alerts page. */
export const rate = mutation({
  args: { alertId: v.id("alerts"), verdict },
  handler: async (ctx, { alertId, verdict }) => save(ctx, await ownAlert(ctx, alertId), { verdict, source: "app" }),
});

export const explain = mutation({
  args: { alertId: v.id("alerts"), reasons: v.array(ratingReason), note: v.optional(v.string()) },
  handler: async (ctx, { alertId, reasons, note }) => {
    checkReasons(reasons);
    return save(ctx, await ownAlert(ctx, alertId), { explain: { reasons, note: note ?? "" }, source: "app" });
  },
});

/** From the alert e-mail's links, no sign-in: the code only works for its own alert. */
export const rateWithToken = mutation({
  args: { alertId: v.string(), token: v.string(), verdict },
  handler: async (ctx, { alertId, token, verdict }) => {
    const alert = await tokenAlert(ctx, alertId, token);
    await save(ctx, alert, { verdict, source: "email" });
    return { title: alert.title, score: alert.score ?? null };
  },
});

export const explainWithToken = mutation({
  args: { alertId: v.string(), token: v.string(), reasons: v.array(ratingReason), note: v.optional(v.string()) },
  handler: async (ctx, { alertId, token, reasons, note }) => {
    checkReasons(reasons);
    await save(ctx, await tokenAlert(ctx, alertId, token), { explain: { reasons, note: note ?? "" }, source: "email" });
  },
});

/** The signed-in user's ratings, by alert, for the Alerts page. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return {};
    const rows = await ctx.db.query("ratings").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return Object.fromEntries(rows.map((r) => [r.alertId, { verdict: r.verdict, reasons: r.reasons ?? [], note: r.note ?? "" }]));
  },
});

/** For evals: every rating and its scorer inputs, without who gave it. `npx convex run --prod ratings:exportAll`. */
export const exportAll = internalQuery({
  args: {},
  handler: async (ctx) => Promise.all((await ctx.db.query("ratings").withIndex("by_created").collect()).map(async (r) => {
    const alert = r.listing ? null : await ctx.db.get(r.alertId);
    const watch = r.watchDescription ? null : await ctx.db.get(r.watchId);
    return {
      id: r._id, at: new Date(r.updatedAt).toISOString(), verdict: r.verdict, reasons: r.reasons ?? [], note: r.note ?? "",
      score: r.score ?? null, notify: r.notify ?? null, title: r.title ?? "", reason: r.reason ?? "", source: r.source,
      listing: r.listing ?? (alert ? { id: alert.listingId, title: alert.title, price_eur: alert.priceEur ?? null,
        city: alert.city ?? null, distance_km: null, url: alert.url, image: alert.image ?? null } : null),
      watchDescription: r.watchDescription ?? watch?.label ?? null,
    };
  })),
});
