// The scheduled checks. A cron wakes checkDue every 15 minutes; it claims the watches that are due,
// asks the Python API to fetch + filter + rank (one Marktplaats request per distinct query), records
// what is new, and e-mails the good matches. Credentials live in Convex env vars, never in code.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MIN_SCORE, NOTIFY_LABEL, describe, nextRun } from "./schedule";
import { deleteChat } from "./chats";

const MAX_WATCHES_PER_RUN = 100;
const MAX_QUERIES_PER_RUN = 25;           // the rest stay due and go in the next run
const MAX_ALERTS_PER_EMAIL = 5;
const MAX_WATCHES_PER_REQUEST = 20;          // keeps one request to the Python API well inside its time limit
const RETRY_MS = 30 * 60_000;                // a failed check is tried again within 30 minutes
const MAX_SEEN_SENT = 1000;
const RETENTION_MS = 30 * 86_400_000;

/** Take the due watches and move their next check on, so an overlapping run can't pick them up twice. */
export const claimDue = internalMutation({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const due = await ctx.db.query("watches")
      .withIndex("by_active_next", (q) => q.eq("active", true).lte("nextRunAt", now))
      .take(MAX_WATCHES_PER_RUN);
    const byQuery = new Map<string, typeof due>();
    for (const w of due) {
      const key = w.query.toLowerCase();
      if (!byQuery.has(key) && byQuery.size >= MAX_QUERIES_PER_RUN) continue;
      byQuery.set(key, [...(byQuery.get(key) ?? []), w]);
    }
    const groups = [];
    for (const [query, watches] of byQuery) {
      const payload = [];
      for (const w of watches) {
        await ctx.db.patch(w._id, { nextRunAt: nextRun(w.schedule, now, w.timezone) });
        const seen = await ctx.db.query("seenListings")      // the newest ones: those are still on the page
          .withIndex("by_watch_lastSeen", (q) => q.eq("watchId", w._id)).order("desc").take(MAX_SEEN_SENT);
        payload.push({
          id: w._id, description: w.label, max_price_eur: w.maxPriceEur ?? null,
          must_include: w.mustInclude ?? null, postcode: w.postcode ?? null,
          max_distance_km: w.maxDistanceKm ?? null, seen_ids: seen.map((s) => s.listingId),
        });
      }
      for (let i = 0; i < payload.length; i += MAX_WATCHES_PER_REQUEST)
        groups.push({ query, watches: payload.slice(i, i + MAX_WATCHES_PER_REQUEST) });
    }
    return groups;
  },
});

const listing = v.object({
  id: v.string(), title: v.string(), price_eur: v.union(v.number(), v.null()), city: v.union(v.string(), v.null()),
  distance_km: v.union(v.number(), v.null()), date: v.optional(v.any()), url: v.string(),
  image: v.optional(v.union(v.string(), v.null())),
  score: v.union(v.number(), v.null()), reason: v.string(),
});
const result = v.object({
  watchId: v.string(), ok: v.boolean(), error: v.optional(v.string()),
  currentIds: v.optional(v.array(v.string())), listings: v.optional(v.array(listing)),
});

/** Store what a check found. Returns the e-mails to send: one per watch with good new listings. */
export const record = internalMutation({
  args: { now: v.number(), results: v.array(result), dryRun: v.boolean() },
  handler: async (ctx, { now, results, dryRun }) => {
    const emails = [];
    for (const r of results) {
      const watchId = ctx.db.normalizeId("watches", r.watchId);
      const watch = watchId && await ctx.db.get(watchId);
      if (!watch) continue;                                   // deleted while it was being checked
      if (!r.ok) {
        // Retry soon instead of waiting for the next scheduled time (a weekly watch would wait a week)
        const retryAt = Math.min(watch.nextRunAt, now + RETRY_MS);
        await ctx.db.patch(watch._id, { lastCheckedAt: now, lastError: r.error ?? "Check failed.", nextRunAt: retryAt });
        continue;
      }
      const newAlerts: Id<"alerts">[] = [];
      for (const id of r.currentIds ?? []) {
        const seen = await ctx.db.query("seenListings")
          .withIndex("by_watch_listing", (q) => q.eq("watchId", watch._id).eq("listingId", id)).unique();
        if (seen) {
          await ctx.db.patch(seen._id, { lastSeenAt: now });
          continue;
        }
        await ctx.db.insert("seenListings", { watchId: watch._id, listingId: id, lastSeenAt: now });
        const item = r.listings?.find((l) => l.id === id);
        // First check: only remember what is already there. (Unscored listings never arrive here: the API
        // reports the whole watch as failed instead, so they stay unseen and are scored on the retry.)
        if (!watch.seeded || !item || item.score === null || item.score < MIN_SCORE[watch.notify]) continue;
        newAlerts.push(await ctx.db.insert("alerts", {
          userId: watch.userId, watchId: watch._id, listingId: id, title: item.title,
          priceEur: item.price_eur ?? undefined, city: item.city ?? undefined, url: item.url,
          image: item.image ?? undefined,
          score: item.score ?? undefined, reason: item.reason, channel: "email",
          emailStatus: dryRun ? "dry-run" : "pending", createdAt: now,
        }));
      }
      await ctx.db.patch(watch._id, { seeded: true, lastCheckedAt: now, lastError: undefined });
      const user = await ctx.db.get(watch.userId);
      if (newAlerts.length && user) emails.push({ watchId: watch._id, alertIds: newAlerts, to: user.email });
    }
    return emails;
  },
});

export const emailContent = internalQuery({
  args: { watchId: v.id("watches"), alertIds: v.array(v.id("alerts")) },
  handler: async (ctx, { watchId, alertIds }) => {
    const watch = await ctx.db.get(watchId);
    const alerts = (await Promise.all(alertIds.map((id) => ctx.db.get(id)))).filter((a) => a !== null);
    alerts.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return watch && { label: watch.label, summary: describe(watch.schedule), notify: NOTIFY_LABEL[watch.notify], alerts };
  },
});

export const markEmailed = internalMutation({
  args: { alertIds: v.array(v.id("alerts")), status: v.union(v.literal("sent"), v.literal("failed"), v.literal("dry-run")) },
  handler: async (ctx, { alertIds, status }) => {
    for (const id of alertIds) if (await ctx.db.get(id)) await ctx.db.patch(id, { emailStatus: status });
  },
});

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type EmailContent = {
  label: string; summary: string; notify: string;
  alerts: { title: string; priceEur?: number; city?: string; url: string; score?: number; reason: string }[];
};

/** The alert e-mail, as plain text and HTML. Listing titles are escaped: they come from strangers. */
export function renderEmail(c: EmailContent, appUrl: string) {
  const top = c.alerts.slice(0, MAX_ALERTS_PER_EMAIL);
  const more = c.alerts.length - top.length;
  const n = c.alerts.length;
  const best = top[0];  // alerts arrive sorted by score, best first
  const bestText = best && [best.score !== undefined ? `${best.score}/10` : "", best.priceEur ? `€${best.priceEur}` : ""]
    .filter(Boolean).join(", ");
  const subject = `${n} new match${n === 1 ? "" : "es"} for ${c.label}${bestText ? ` (best: ${bestText})` : ""}`;
  const facts = (a: (typeof top)[number]) =>
    [a.priceEur ? `€${a.priceEur}` : "", a.city ?? "", a.score !== undefined ? `scored ${a.score}/10` : ""]
      .filter(Boolean).join(", ");
  const footer = `You get this because you watch "${c.label}", checked ${c.summary}, and asked for ${c.notify}. ` +
    "Marktplaats Watcher is a portfolio project, not affiliated with Marktplaats.";
  const text = [
    subject, "",
    ...top.flatMap((a) => [a.title, facts(a), a.reason, `Open on Marktplaats: ${a.url}`, ""]),
    ...(more > 0 ? [`…and ${more} more in the app.`, ""] : []),
    footer, `Manage or pause this watch: ${appUrl}`,
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#1d1d1f">
<h2 style="font-size:18px">${escape(subject)}</h2>
${top.map((a) => `<div style="border:1px solid #e5e5ea;border-radius:10px;padding:12px;margin:10px 0">
<a href="${escape(a.url)}" style="font-weight:600;color:#0a66c2;text-decoration:none">${escape(a.title)}</a>
<div style="color:#555;margin-top:4px">${escape(facts(a))}</div>
<div style="margin-top:6px">${escape(a.reason)}</div>
<a href="${escape(a.url)}" style="display:inline-block;margin-top:8px;color:#0a66c2">Open on Marktplaats</a></div>`).join("\n")}
${more > 0 ? `<p>…and ${more} more in the app.</p>` : ""}
<p style="color:#888;font-size:12px;margin-top:20px">${escape(footer)}<br>
<a href="${escape(appUrl)}" style="color:#888">Manage or pause this watch</a></p></div>`;
  return { subject, text, html };
}

async function sendEmail(to: string, email: { subject: string; text: string; html: string }) {
  const key = process.env.AGENTMAIL_API_KEY, inbox = process.env.AGENTMAIL_INBOX_ID;
  if (!key || !inbox) throw new Error("AGENTMAIL_API_KEY / AGENTMAIL_INBOX_ID are not set in Convex.");
  const res = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: [to], ...email, labels: ["alert"] }),
  });
  if (!res.ok) throw new Error(`AgentMail answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export const checkDue = internalAction({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = false }) => {
    const now = Date.now();
    const groups = await ctx.runMutation(internal.checker.claimDue, { now });
    if (!groups.length) return { checked: 0, emails: 0 };
    const api = process.env.WATCHER_API_URL, secret = process.env.CRON_SECRET;
    let checked = 0, emails = 0;
    for (const group of groups) {
      let results;
      try {
        if (!api || !secret) throw new Error("WATCHER_API_URL / CRON_SECRET are not set in Convex.");
        const res = await fetch(`${api.replace(/\/$/, "")}/api/internal/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Cron-Secret": secret },
          body: JSON.stringify(group),
        });
        if (!res.ok) throw new Error(`Search service answered ${res.status}.`);
        results = (await res.json()).results;
      } catch (e) {
        console.error(`check "${group.query}" failed:`, e);
        results = group.watches.map((w) => ({ watchId: w.id, ok: false, error: "Search service unavailable, will retry." }));
      }
      checked += group.watches.length;
      const toSend = await ctx.runMutation(internal.checker.record, { now, results, dryRun });
      for (const mail of toSend) {
        const content = await ctx.runQuery(internal.checker.emailContent, { watchId: mail.watchId, alertIds: mail.alertIds });
        if (!content) continue;
        const email = renderEmail(content, process.env.APP_URL ?? "https://marktplaats-watcher.vercel.app");
        let status: "sent" | "failed" | "dry-run" = "dry-run";
        if (dryRun) console.log(`[dry-run] to ${mail.to}: ${email.subject}\n${email.text}`);
        else {
          try {
            await sendEmail(mail.to, email);
            status = "sent";
            emails++;
          } catch (e) {
            console.error("alert e-mail failed:", e);
            status = "failed";
          }
        }
        await ctx.runMutation(internal.checker.markEmailed, { alertIds: mail.alertIds, status });
      }
    }
    return { checked, emails };
  },
});

/** Retention: forget seen listings, alerts and untouched chats after 30 days. */
export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;
    const seen = await ctx.db.query("seenListings").withIndex("by_lastSeen", (q) => q.lt("lastSeenAt", cutoff)).take(500);
    const alerts = await ctx.db.query("alerts").withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff)).take(500);
    const chats = await ctx.db.query("chats").withIndex("by_updated", (q) => q.lt("updatedAt", cutoff)).take(100);
    for (const row of [...seen, ...alerts]) await ctx.db.delete(row._id);
    for (const chat of chats) await deleteChat(ctx, chat._id);
    if (seen.length === 500 || alerts.length === 500 || chats.length === 100)
      await ctx.scheduler.runAfter(0, internal.checker.purgeOld, {});
  },
});
