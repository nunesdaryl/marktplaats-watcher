// The scheduled checks. A cron wakes checkDue every 15 minutes; it claims the watches that are due,
// asks the Python API to fetch + filter + rank (one Marktplaats request per distinct query), records
// what is new, and e-mails the good matches. Credentials live in Convex env vars, never in code.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MIN_SCORE, NOTIFY_LABEL, describe, nextRun } from "./schedule";
import { deleteChat } from "./chats";
import { ratingToken } from "./ratings";

const MAX_WATCHES_PER_RUN = 100;
const MAX_QUERIES_PER_RUN = 25;           // the rest stay due and go in the next run
const MAX_ALERTS_PER_EMAIL = 5;
const MAX_WATCHES_PER_REQUEST = 20;          // keeps one request to the Python API well inside its time limit
const RETRY_MS = 30 * 60_000;                // a failed check is tried again within 30 minutes
const LEASE_MS = 30 * 60_000;                // a claimed check that never reports back is due again after this
// A check finishes a little after the run that claimed it, so its next time lands just after the next run starts. A
// short leeway lets that run take it, instead of an "every 15 minutes" watch waiting 30 (seen on 29 Sep 2026).
const GRACE_MS = 2 * 60_000;
const MAX_EMAIL_ATTEMPTS = 4;                // an alert e-mail is tried at most 4 times, 15 minutes apart
const EMAIL_RETRY_WINDOW_MS = 24 * 60 * 60_000;
const MAX_SEEN_SENT = 1000;
const RETENTION_MS = 30 * 86_400_000;

function isTimeout(e: unknown): boolean {
  return typeof e === "object" && e !== null && "name" in e &&
    (e.name === "TimeoutError" || e.name === "AbortError");
}

/** Take the due watches and lease them for 30 minutes, so an overlapping run can't pick them up twice, and a run
 * that dies before recording its results doesn't leave a weekly watch waiting a week. A dry run leases nothing. */
export const claimDue = internalMutation({
  args: { now: v.number(), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { now, dryRun = false }) => {
    const due = await ctx.db.query("watches")
      .withIndex("by_active_next", (q) => q.eq("active", true).lte("nextRunAt", now + GRACE_MS))
      .take(MAX_WATCHES_PER_RUN);
    const byQuery = new Map<string, typeof due>();
    for (const w of due) {
      if (w.leaseUntil !== undefined && w.leaseUntil > now) continue;   // a check for it is still running
      const key = w.query.toLowerCase();
      if (!byQuery.has(key) && byQuery.size >= MAX_QUERIES_PER_RUN) continue;
      byQuery.set(key, [...(byQuery.get(key) ?? []), w]);
    }
    const groups = [];
    for (const [query, watches] of byQuery) {
      const payload = [];
      for (const w of watches) {
        if (!dryRun) await ctx.db.patch(w._id, { nextRunAt: Math.min(nextRun(w.schedule, now, w.timezone), now + LEASE_MS), leaseUntil: now + LEASE_MS });
        const seen = await ctx.db.query("seenListings")      // the newest ones: those are still on the page
          .withIndex("by_watch_lastSeen", (q) => q.eq("watchId", w._id)).order("desc").take(MAX_SEEN_SENT);
        payload.push({
          id: w._id, description: w.label, max_price_eur: w.maxPriceEur ?? null,
          must_include: w.mustInclude ?? null, postcode: w.postcode ?? null,
          max_distance_km: w.maxDistanceKm ?? null, seen_ids: seen.map((s) => s.listingId), seeded: w.seeded,
          watermark: w.seeded ? w.watermark ?? null : null, last_checked_at: w.seeded ? w.lastReadAt ?? null : null,
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
  newestId: v.optional(v.union(v.number(), v.null())),   // the watermark for the next check
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
      const ids = [...new Set(r.currentIds ?? [])];
      // This run's lease ends now, whatever the result (a newer claim's lease is left alone)
      if (!dryRun && watch.leaseUntil === now + LEASE_MS) await ctx.db.patch(watch._id, { leaseUntil: undefined });
      // Paused, archived or given a different search while it was being checked: this result is stale
      if (!watch.active || watch.archivedAt !== undefined || (watch.searchEditedAt ?? -1) >= now) continue;
      if (dryRun) {
        if (!r.ok || !watch.seeded) continue;
        const fresh = [];
        for (const id of ids) {
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
      for (const id of ids) {
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
      // On to the real next time, unless the schedule changed (or "Check now" was pressed) during this check
      const keepNext = (watch.scheduleEditedAt ?? -1) >= now;
      // The watermark only rises once set (a first look starts it), so a listing is never "new" twice. null: the
      // search had no numbered listings, so it starts at 0. Missing: an older search service; it stays unset, and
      // the first check with the current one is a silent first look
      const watermark = typeof r.newestId === "number"
        ? (watch.seeded && watch.watermark !== undefined ? Math.max(watch.watermark, r.newestId) : r.newestId)
        : r.newestId === null ? watch.watermark ?? 0 : watch.watermark;
      await ctx.db.patch(watch._id, { seeded: true, watermark, lastReadAt: now, lastCheckedAt: now, lastError: undefined,
        nextRunAt: keepNext ? watch.nextRunAt : nextRun(watch.schedule, now, watch.timezone) });
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

/** Alert e-mails to try again: failed ones, and ones stuck "pending" 30 minutes after their last try started (a run
 * that died mid-send), for watches that are still active and still have the same search. Each claim stamps the try,
 * so overlapping runs can't take the same alert. After MAX_EMAIL_ATTEMPTS an alert stays "failed", which the health
 * digest reports. An e-mail AgentMail accepted but didn't confirm could arrive twice; that's preferred over losing it. */
export const claimEmailRetries = internalMutation({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const since = now - EMAIL_RETRY_WINDOW_MS, stale = now - RETRY_MS;
    const triesLeft = (q: any) => q.or(q.eq(q.field("attempts"), undefined), q.lt(q.field("attempts"), MAX_EMAIL_ATTEMPTS));
    const failed = await ctx.db.query("alerts").withIndex("by_emailStatus", (q) => q.eq("emailStatus", "failed").gte("createdAt", since))
      .filter(triesLeft).take(200);
    const stuck = await ctx.db.query("alerts").withIndex("by_emailStatus", (q) => q.eq("emailStatus", "pending").gte("createdAt", since))
      .filter((q) => q.or(q.lt(q.field("attemptAt"), stale), q.and(q.eq(q.field("attemptAt"), undefined), q.lt(q.field("createdAt"), stale))))
      .take(200);
    const byWatch = new Map<Id<"watches">, Id<"alerts">[]>();
    for (const a of [...failed, ...stuck]) {
      const watch = await ctx.db.get(a.watchId);
      const outOfTries = (a.attempts ?? 1) >= MAX_EMAIL_ATTEMPTS;
      const oldSearch = watch !== null && (watch.searchEditedAt ?? -1) > a.createdAt;
      if (outOfTries || oldSearch) {             // give up for good: visible as "failed", never retried
        if (a.emailStatus !== "failed" || !outOfTries) await ctx.db.patch(a._id, { emailStatus: "failed", attempts: MAX_EMAIL_ATTEMPTS });
        continue;
      }
      if (!watch || !watch.active || watch.archivedAt !== undefined) continue;
      await ctx.db.patch(a._id, { emailStatus: "pending", attempts: (a.attempts ?? 1) + 1, attemptAt: now });
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
  alerts: { title: string; priceEur?: number; city?: string; url: string; score?: number; reason: string;
            _id?: string; rateToken?: string | null }[];
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
    "We read each new listing and only e-mail the ones that fit what you asked for. " +
    "Marktplaats Watcher is a portfolio project, not affiliated with Marktplaats. Replies to this address aren't read.";
  const heading = `Worth a look on Marktplaats: "${c.label}"`;
  // "Good match?" links (ratings.ts): they open a page in the app that records the answer, so mail scanners that
  // follow links without running the page can't rate anything
  const rateUrl = (a: (typeof top)[number], verdict: "good" | "not_right") => a._id && a.rateToken
    ? `${appUrl.replace(/\/$/, "")}/rate/?a=${encodeURIComponent(a._id)}&v=${verdict}&t=${encodeURIComponent(a.rateToken)}` : null;
  const text = [
    heading, "",
    ...top.flatMap((a) => [a.title, facts(a), a.reason, `Open on Marktplaats: ${a.url}`,
      ...(rateUrl(a, "good") ? [`Good match? Yes: ${rateUrl(a, "good")}  ·  Not right: ${rateUrl(a, "not_right")}`] : []), ""]),
    ...(more > 0 ? [`…and ${more} more in the app, under Alerts.`, ""] : []),
    footer, `Manage or pause this watch: ${manageUrl}`,
  ].join("\n");
  // The Sieve e-mail pattern (docs/design/sieve/email/alert-email.template.html): tables and inline light colours, so
  // Outlook and Gmail lay it out; a small prefers-color-scheme block switches to the dark values where it's supported.
  // System fonts only; no emoji. Every text/fill pair is at least 4.5:1 in both schemes.
  const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const mono = "ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";
  const badge = (score?: number) => {
    if (score === undefined) return "";
    const [kind, bg, ink] = score >= 8 ? ["great", "#157346", "#ffffff"] : score >= 6 ? ["good", "#ddd0ff", "#25124f"] : ["neutral", "#eeebe6", "#5b5751"];
    return `<td width="48" valign="top" style="padding:16px 0 16px 16px;"><div class="mw-${kind}" style="width:48px;height:40px;line-height:40px;border-radius:8px;background:${bg};color:${ink};font-family:${mono};font-size:15px;font-weight:600;text-align:center;letter-spacing:-0.3px;">${score}/10</div></td>`;
  };
  const base = appUrl.replace(/\/$/, "");
  const card = (a: (typeof top)[number]) => `<tr><td style="padding:0 0 12px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mw-card" style="border:1px solid #e4e0da;border-radius:10px;background:#ffffff;">
<tr>${badge(a.score)}<td valign="top" style="padding:14px 16px 16px 16px;">
<a href="${escape(a.url)}" class="mw-text mw-title" style="color:#1b1a18;font-family:${sans};font-size:16px;line-height:22px;font-weight:600;text-decoration:underline;text-decoration-color:#e4e0da;">${escape(a.title)}</a>
<div class="mw-text2" style="color:#5b5751;font-family:${sans};font-size:14px;line-height:20px;margin:4px 0 0 0;">${escape(facts(a))}</div>
<div class="mw-text" style="color:#1b1a18;font-family:${sans};font-size:15px;line-height:22px;margin:4px 0 12px 0;">${escape(a.reason)}</div>
<a href="${escape(a.url)}" class="mw-btn" style="display:inline-block;background:#0d6b62;color:#ffffff;font-family:${sans};font-size:14px;line-height:20px;font-weight:600;text-decoration:none;padding:8px 14px;border-radius:6px;">Open on Marktplaats</a>${
  rateUrl(a, "good") ? `
<div class="mw-text2 mw-rule" style="margin:12px 0 0 0;padding:10px 0 0 0;border-top:1px solid #eeebe6;font-family:${sans};font-size:14px;line-height:20px;color:#5b5751;">Good match?
<a href="${escape(rateUrl(a, "good")!)}" class="mw-link" style="color:#0d6b62;font-weight:600;margin-left:6px;">Yes</a> &middot;
<a href="${escape(rateUrl(a, "not_right")!)}" class="mw-link" style="color:#0d6b62;font-weight:600;">Not right</a></div>` : ""}
</td></tr></table></td></tr>`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${escape(subject)}</title>
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
  .mw-page { background: #0f0e0d !important; }
  .mw-card { background: #1e1c1a !important; border-color: #34312d !important; }
  .mw-text { color: #ece9e4 !important; }
  .mw-text2 { color: #a9a49c !important; }
  .mw-link { color: #4fd1bf !important; }
  .mw-btn { background: #4fd1bf !important; color: #06201c !important; }
  .mw-great { background: #58d68e !important; color: #062414 !important; }
  .mw-good { background: #bca8ff !important; color: #190d3b !important; }
  .mw-neutral { background: #2b2926 !important; color: #a9a49c !important; }
  .mw-rule { border-color: #34312d !important; }
  .mw-title { text-decoration-color: #4a4640 !important; }
}
</style></head>
<body class="mw-page" style="margin:0;padding:0;background:#f4f2ee;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="mw-page" style="background:#f4f2ee;">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td style="padding:0 0 16px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:0 10px 0 0;"><img src="${escape(base)}/apple-icon.png" width="28" height="28" alt="" style="display:block;border:0;border-radius:7px;"></td>
<td class="mw-text2" style="font-family:${sans};font-size:15px;line-height:20px;color:#5b5751;">Marktplaats <strong class="mw-text" style="color:#1b1a18;font-weight:600;">Watcher</strong></td>
</tr></table></td></tr>
<tr><td class="mw-card" style="background:#ffffff;border:1px solid #e4e0da;border-radius:12px;padding:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 0 16px 0;"><h1 class="mw-text" style="margin:0;font-family:${sans};font-size:20px;line-height:26px;font-weight:600;color:#1b1a18;letter-spacing:-0.2px;">${escape(heading)}</h1></td></tr>
${top.map(card).join("\n")}
${more > 0 ? `<tr><td class="mw-text2" style="font-family:${sans};font-size:15px;line-height:22px;color:#5b5751;">…and ${more} more in the app, under Alerts.</td></tr>` : ""}
</table></td></tr>
<tr><td class="mw-text2" style="padding:16px 4px 0 4px;font-family:${sans};font-size:13px;line-height:20px;color:#5b5751;">
${escape(footer)}<br>
<a href="${escape(manageUrl)}" class="mw-link" style="color:#0d6b62;text-decoration:underline;">Manage or pause this watch</a>
</td></tr>
</table></td></tr></table>
</body></html>`;
  return { subject, text, html };
}

export async function sendEmail(to: string, email: { subject: string; text: string; html: string }) {
  const key = process.env.AGENTMAIL_API_KEY, inbox = process.env.AGENTMAIL_INBOX_ID;
  if (!key || !inbox) throw new Error("AGENTMAIL_API_KEY / AGENTMAIL_INBOX_ID are not set in Convex.");
  const res = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: [to], ...email, labels: ["alert"] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`AgentMail answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export const checkDue = internalAction({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { dryRun = false }) => {
    const now = Date.now();
    const runId = crypto.randomUUID();
    if (process.env.CHECKS_PAUSED === "1") {    // kill switch (see RUNBOOK.md): no fetching, no scoring, no e-mail
      console.log(JSON.stringify({ event: "checks_paused", requestId: runId }));
      if (!dryRun) await ctx.runMutation(internal.health.logRun, { at: now, checked: 0, failed: 0, emails: 0, emailFailures: 0, paused: true, requestId: runId });
      return { checked: 0, emails: 0, paused: true };
    }
    const appUrl = process.env.APP_URL ?? "https://marktplaats-watcher.vercel.app";
    let checked = 0, emails = 0, failed = 0, emailFailures = 0, timeouts = 0;

    /** Send one watch's alert e-mail and record the outcome; a failure is retried at the next ticks. */
    const deliver = async (mail: { watchId: Id<"watches">; alertIds: Id<"alerts">[]; to: string }) => {
      const content = await ctx.runQuery(internal.checker.emailContent, { watchId: mail.watchId, alertIds: mail.alertIds });
      if (!content || !content.alerts.length) return;
      for (const a of content.alerts) (a as { rateToken?: string | null }).rateToken = await ratingToken(a._id);
      let status: "sent" | "failed" = "sent";
      try {
        await sendEmail(mail.to, renderEmail(content, appUrl));
        emails++;
      } catch (e) {
        console.error("alert e-mail failed:", e);
        status = "failed";
        emailFailures++;
        if (isTimeout(e)) timeouts++;
      }
      await ctx.runMutation(internal.checker.markEmailed, { alertIds: mail.alertIds, status });
    };

    // First, e-mails that failed at an earlier tick (before this tick's new ones, so each gets one try per tick)
    if (!dryRun) for (const mail of await ctx.runMutation(internal.checker.claimEmailRetries, { now })) await deliver(mail);

    const groups = await ctx.runMutation(internal.checker.claimDue, { now, dryRun });
    const api = process.env.WATCHER_API_URL, secret = process.env.CRON_SECRET;
    for (const [index, group] of groups.entries()) {
      const groupId = `${runId}.${index}`;
      let results;
      try {
        if (!api || !secret) throw new Error("WATCHER_API_URL / CRON_SECRET are not set in Convex.");
        const res = await fetch(`${api.replace(/\/$/, "")}/api/internal/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Cron-Secret": secret, "X-Request-Id": groupId },
          body: JSON.stringify(group),
          signal: AbortSignal.timeout(240_000),
        });
        if (!res.ok) throw new Error(`Search service answered ${res.status}.`);
        results = (await res.json()).results;
      } catch (e) {
        console.error(`check "${group.query}" failed:`, e);
        if (!dryRun) await ctx.runMutation(internal.health.recordError, { kind: "check", requestId: groupId, message: `${e instanceof Error ? e.name : "Error"}: ${e instanceof Error ? e.message : String(e)}` });
        if (isTimeout(e)) timeouts++;
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
    await ctx.runMutation(internal.health.logRun, { at: now, checked, failed, emails, emailFailures, timeouts, requestId: runId });
    if (checked || emails || emailFailures)
      console.log(JSON.stringify({ event: "check_run", checked, failed, emails, emailFailures, timeouts, ms: Date.now() - now, requestId: runId }));
    return { checked, emails };
  },
});

/** One-off, after a change to what a search returns (29 Sep 2026: "mac mini" was searched as the literal word
 * "mac-mini"; then the date-sorted, filtered search): every live watch takes a new silent first look, so the listings the corrected search shows are
 * remembered instead of e-mailed as new. `npx convex run --prod checker:rebaseline` */
export const rebaseline = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let count = 0;
    for (const w of await ctx.db.query("watches").collect()) {
      if (!w.seeded || w.archivedAt !== undefined) continue;
      await ctx.db.patch(w._id, { seeded: false, watermark: undefined, ...(w.active ? { nextRunAt: now } : {}) });
      count++;
    }
    return { rebaselined: count };
  },
});

/** Retention: forget seen listings, alerts, audits and untouched chats after 30 days, and ratings after 12 months. */
export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - RETENTION_MS;
    const ratingsCutoff = new Date();
    ratingsCutoff.setUTCMonth(ratingsCutoff.getUTCMonth() - 12);
    const seen = await ctx.db.query("seenListings").withIndex("by_lastSeen", (q) => q.lt("lastSeenAt", cutoff)).take(500);
    const alerts = await ctx.db.query("alerts").withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff)).take(500);
    const audits = await ctx.db.query("audits").withIndex("by_at", (q) => q.lt("at", cutoff)).take(500);
    const chats = await ctx.db.query("chats").withIndex("by_updated", (q) => q.lt("updatedAt", cutoff)).take(100);
    const errors = await ctx.db.query("errors").withIndex("by_at", (q) => q.lt("at", cutoff)).take(500);
    const ratings = await ctx.db.query("ratings").withIndex("by_updated", (q) => q.lt("updatedAt", ratingsCutoff.getTime())).take(500);
    for (const row of [...seen, ...alerts, ...audits, ...ratings, ...errors]) await ctx.db.delete(row._id);
    for (const chat of chats) await deleteChat(ctx, chat._id);
    if (seen.length === 500 || alerts.length === 500 || audits.length === 500 || chats.length === 100 || ratings.length === 500 || errors.length === 500)
      await ctx.scheduler.runAfter(0, internal.checker.purgeOld, {});
  },
});
