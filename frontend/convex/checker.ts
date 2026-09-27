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
const LEASE_MS = 30 * 60_000;                // a claimed check that never reports back is due again after this
const MAX_EMAIL_ATTEMPTS = 4;                // an alert e-mail is tried at most 4 times, 15 minutes apart
const EMAIL_RETRY_WINDOW_MS = 24 * 60 * 60_000;
const MAX_SEEN_SENT = 1000;
const RETENTION_MS = 30 * 86_400_000;

/** Take the due watches and lease them for 30 minutes, so an overlapping run can't pick them up twice, and a run
 * that dies before recording its results doesn't leave a weekly watch waiting a week. A dry run leases nothing. */
export const claimDue = internalMutation({
  args: { now: v.number(), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { now, dryRun = false }) => {
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
        if (!dryRun) await ctx.db.patch(w._id, { nextRunAt: Math.min(nextRun(w.schedule, now, w.timezone), now + LEASE_MS) });
        const seen = await ctx.db.query("seenListings")      // the newest ones: those are still on the page
          .withIndex("by_watch_lastSeen", (q) => q.eq("watchId", w._id)).order("desc").take(MAX_SEEN_SENT);
        payload.push({
          id: w._id, description: w.label, max_price_eur: w.maxPriceEur ?? null,
          must_include: w.mustInclude ?? null, postcode: w.postcode ?? null,
          max_distance_km: w.maxDistanceKm ?? null, seen_ids: seen.map((s) => s.listingId), seeded: w.seeded,
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

/** Store what a check found. Returns the e-mails to send: one per watch with good new listings.
 * `now` is the time the check was claimed. A dry run writes nothing and returns the e-mails as previews. */
export const record = internalMutation({
  args: { now: v.number(), results: v.array(result), dryRun: v.boolean() },
  handler: async (ctx, { now, results, dryRun }) => {
    const emails: { watchId: Id<"watches">; alertIds: Id<"alerts">[]; to: string; preview?: EmailContent }[] = [];
    for (const r of results) {
      const watchId = ctx.db.normalizeId("watches", r.watchId);
      const watch = watchId && await ctx.db.get(watchId);
      if (!watch) continue;                                   // deleted while it was being checked
      // Paused, archived or given a different search while it was being checked: this result is stale
      if (!watch.active || watch.archivedAt !== undefined || (watch.searchEditedAt ?? -1) >= now) continue;
      if (dryRun) {
        if (!r.ok || !watch.seeded) continue;
        const fresh = [];
        for (const id of r.currentIds ?? []) {
          const seen = await ctx.db.query("seenListings")
            .withIndex("by_watch_listing", (q) => q.eq("watchId", watch._id).eq("listingId", id)).unique();
          const item = r.listings?.find((l) => l.id === id);
          if (!seen && item && item.score !== null && item.score >= MIN_SCORE[watch.notify])
            fresh.push({ title: item.title, priceEur: item.price_eur ?? undefined, city: item.city ?? undefined,
              url: item.url, score: item.score, reason: item.reason });
        }
        const user = await ctx.db.get(watch.userId);
        if (fresh.length && user) emails.push({ watchId: watch._id, alertIds: [], to: user.email, preview: {
          watchId: watch._id, label: watch.name ?? watch.label, summary: describe(watch.schedule),
          notify: NOTIFY_LABEL[watch.notify], alerts: fresh.sort((a, b) => b.score - a.score) } });
        continue;
      }
      if (!r.ok) {
        // Retry soon instead of waiting for the next scheduled time (a weekly watch would wait a week)
        const retryAt = Math.min(watch.nextRunAt, now + RETRY_MS);
        await ctx.db.patch(watch._id, { lastCheckedAt: now, lastError: r.error ?? "The last check didn't work. We'll try again soon.", nextRunAt: retryAt });
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
          emailStatus: "pending", createdAt: now,
        }));
      }
      await ctx.db.patch(watch._id, { seeded: true, lastCheckedAt: now, lastError: undefined,
        nextRunAt: nextRun(watch.schedule, now, watch.timezone) });   // the lease ends: on to the real next time
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
    if (!watch || !watch.active || watch.archivedAt !== undefined) return null;   // paused since: don't e-mail
    const alerts = (await Promise.all(alertIds.map((id) => ctx.db.get(id)))).filter((a) => a !== null);
    alerts.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    return watch && { watchId: watch._id, label: watch.name ?? watch.label, summary: describe(watch.schedule), notify: NOTIFY_LABEL[watch.notify], alerts };
  },
});

/** Alert e-mails to try again: failed ones, and ones stuck "pending" (a run that died mid-send), for watches
 * that are still active. Each try counts; after MAX_EMAIL_ATTEMPTS an alert stays "failed" for the health digest.
 * An e-mail AgentMail accepted but didn't confirm could arrive twice; that's preferred over losing it. */
export const claimEmailRetries = internalMutation({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const since = now - EMAIL_RETRY_WINDOW_MS;
    const failed = await ctx.db.query("alerts").withIndex("by_emailStatus", (q) => q.eq("emailStatus", "failed").gte("createdAt", since)).take(200);
    const stuck = await ctx.db.query("alerts").withIndex("by_emailStatus", (q) => q.eq("emailStatus", "pending").gte("createdAt", since).lt("createdAt", now - RETRY_MS)).take(200);
    const byWatch = new Map<Id<"watches">, Id<"alerts">[]>();
    for (const a of [...failed, ...stuck]) {
      if ((a.attempts ?? 1) >= MAX_EMAIL_ATTEMPTS) continue;
      const watch = await ctx.db.get(a.watchId);
      if (!watch || !watch.active || watch.archivedAt !== undefined) continue;
      await ctx.db.patch(a._id, { emailStatus: "pending", attempts: (a.attempts ?? 1) + 1 });
      byWatch.set(a.watchId, [...(byWatch.get(a.watchId) ?? []), a._id]);
    }
    const mails = [];
    for (const [watchId, alertIds] of byWatch) {
      const watch = await ctx.db.get(watchId);
      const user = watch && await ctx.db.get(watch.userId);
      if (user) mails.push({ watchId, alertIds, to: user.email });
    }
    return mails;
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
  watchId?: string; label: string; summary: string; notify: string;
  alerts: { title: string; priceEur?: number; city?: string; url: string; score?: number; reason: string }[];
};

/** The alert e-mail, as plain text and HTML. Listing titles are escaped: they come from strangers. */
export function renderEmail(c: EmailContent, appUrl: string) {
  const top = c.alerts.slice(0, MAX_ALERTS_PER_EMAIL);
  const more = c.alerts.length - top.length;
  const n = c.alerts.length;
  const best = top[0];  // alerts arrive sorted by score, best first
  const bestText = best && [best.score !== undefined ? `best ${best.score}/10` : "", best.priceEur ? `at €${best.priceEur}` : ""]
    .filter(Boolean).join(" ");
  // The watch name first: with several watches, that's what the eye looks for in an inbox
  const subject = `${c.label}: ${n} new match${n === 1 ? "" : "es"}${bestText ? `, ${bestText}` : ""}`;
  const preheader = best ? `Best: ${best.title}. ${best.reason}` : "";
  const facts = (a: (typeof top)[number]) =>
    [a.score !== undefined ? `Scored ${a.score}/10` : "", a.priceEur ? `€${a.priceEur}` : "", a.city ?? ""]
      .filter(Boolean).join(", ");
  const manageUrl = c.watchId ? `${appUrl.replace(/\/$/, "")}/watch/?id=${encodeURIComponent(c.watchId)}` : appUrl;
  const footer = `You get this because you watch "${c.label}", checked ${c.summary}, and asked for ${c.notify}. ` +
    "Marktplaats Watcher is a portfolio project, not affiliated with Marktplaats. Replies to this address aren't read.";
  const heading = `New on Marktplaats for "${c.label}"`;
  const text = [
    heading, "",
    ...top.flatMap((a) => [a.title, facts(a), a.reason, `Open on Marktplaats: ${a.url}`, ""]),
    ...(more > 0 ? [`…and ${more} more in the app, under Alerts.`, ""] : []),
    footer, `Manage or pause this watch: ${manageUrl}`,
  ].join("\n");
  const html = `<div style="display:none;max-height:0;overflow:hidden">${escape(preheader)}</div>
<div style="font-family:system-ui,sans-serif;max-width:560px;color:#1d1d1f">
<h2 style="font-size:18px">${escape(heading)}</h2>
${top.map((a) => `<div style="border:1px solid #e5e5ea;border-radius:10px;padding:12px;margin:10px 0">
<a href="${escape(a.url)}" style="font-weight:600;color:#0a66c2;text-decoration:none">${escape(a.title)}</a>
<div style="color:#555;margin-top:4px">${escape(facts(a))}</div>
<div style="margin-top:6px">${escape(a.reason)}</div>
<a href="${escape(a.url)}" style="display:inline-block;margin-top:8px;color:#0a66c2">Open on Marktplaats</a></div>`).join("\n")}
${more > 0 ? `<p>…and ${more} more in the app, under Alerts.</p>` : ""}
<p style="color:#888;font-size:12px;margin-top:20px">${escape(footer)}<br>
<a href="${escape(manageUrl)}" style="color:#888">Manage or pause this watch</a></p></div>`;
  return { subject, text, html };
}

export async function sendEmail(to: string, email: { subject: string; text: string; html: string }) {
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
    if (process.env.CHECKS_PAUSED === "1") {    // kill switch (see RUNBOOK.md): no fetching, no scoring, no e-mail
      console.log(JSON.stringify({ event: "checks_paused" }));
      if (!dryRun) await ctx.runMutation(internal.health.logRun, { at: now, checked: 0, failed: 0, emails: 0, emailFailures: 0, paused: true });
      return { checked: 0, emails: 0, paused: true };
    }
    const appUrl = process.env.APP_URL ?? "https://marktplaats-watcher.vercel.app";
    let checked = 0, emails = 0, failed = 0, emailFailures = 0;

    /** Send one watch's alert e-mail and record the outcome; a failure is retried at the next ticks. */
    const deliver = async (mail: { watchId: Id<"watches">; alertIds: Id<"alerts">[]; to: string }) => {
      const content = await ctx.runQuery(internal.checker.emailContent, { watchId: mail.watchId, alertIds: mail.alertIds });
      if (!content || !content.alerts.length) return;
      let status: "sent" | "failed" = "sent";
      try {
        await sendEmail(mail.to, renderEmail(content, appUrl));
        emails++;
      } catch (e) {
        console.error("alert e-mail failed:", e);
        status = "failed";
        emailFailures++;
      }
      await ctx.runMutation(internal.checker.markEmailed, { alertIds: mail.alertIds, status });
    };

    // First, e-mails that failed at an earlier tick (before this tick's new ones, so each gets one try per tick)
    if (!dryRun) for (const mail of await ctx.runMutation(internal.checker.claimEmailRetries, { now })) await deliver(mail);

    const groups = await ctx.runMutation(internal.checker.claimDue, { now, dryRun });
    const api = process.env.WATCHER_API_URL, secret = process.env.CRON_SECRET;
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
        results = group.watches.map((w) => ({ watchId: w.id, ok: false, error: "Our search service didn't answer. We'll try again soon." }));
      }
      checked += group.watches.length;
      failed += results.filter((r: { ok: boolean }) => !r.ok).length;
      const toSend = await ctx.runMutation(internal.checker.record, { now, results, dryRun });
      for (const mail of toSend) {
        if (mail.preview) {
          const email = renderEmail(mail.preview, appUrl);
          console.log(`[dry-run] to ${mail.to}: ${email.subject}\n${email.text}`);
        } else await deliver(mail);
      }
    }
    if (dryRun) return { checked, emails: 0 };    // a preview: nothing was stored, nothing sent
    await ctx.runMutation(internal.health.logRun, { at: now, checked, failed, emails, emailFailures });
    if (checked || emails || emailFailures)
      console.log(JSON.stringify({ event: "check_run", checked, failed, emails, emailFailures, ms: Date.now() - now }));
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
