// The owner's health digest: failures reach a human, not just the logs. Once a day it looks back 24 hours and
// e-mails OWNER_EMAIL only when something is wrong; on Mondays it always sends a one-line heartbeat so silence
// never has to mean "maybe it's broken".
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { sendEmail } from "./checker";

const DAY = 86_400_000;
const STUCK_AFTER = 60 * 60_000;             // the dispatcher runs every 15 min; an hour of silence is a problem

export const logRun = internalMutation({
  args: { at: v.number(), checked: v.number(), failed: v.number(), emails: v.number(), emailFailures: v.number(), timeouts: v.optional(v.number()), paused: v.optional(v.boolean()), requestId: v.optional(v.string()) },
  handler: async (ctx, run) => {
    await ctx.db.insert("runs", run);
    for (const old of await ctx.db.query("runs").withIndex("by_at", (q) => q.lt("at", run.at - 30 * DAY)).take(200))
      await ctx.db.delete(old._id);
  },
});

export const recordError = internalMutation({
  args: { kind: v.union(v.literal("chat"), v.literal("check")), requestId: v.string(), message: v.string() },
  handler: async (ctx, { kind, requestId, message }) => {
    await ctx.db.insert("errors", { kind, requestId, message: message.trim().slice(0, 200).trim(), at: Date.now() });
  },
});

/** The last 24 hours of scheduler runs and what went wrong; shared by the digest and the owner dashboard. */
export async function healthReport(ctx: QueryCtx, now: number) {
  const since = now - DAY;
  const runs = await ctx.db.query("runs").withIndex("by_at", (q) => q.gte("at", since)).collect();
  const errors = await ctx.db.query("errors").withIndex("by_at", (q) => q.gte("at", since)).order("desc").collect();
  const audits = await ctx.db.query("audits").withIndex("by_at", (q) => q.gte("at", since)).order("desc").collect();
  const chatErrors = errors.filter((e) => e.kind === "chat").length;
  const checkErrors = errors.length - chatErrors;
  const lastRun = await ctx.db.query("runs").withIndex("by_at").order("desc").first();
  const failedAlerts = (await ctx.db.query("alerts").withIndex("by_createdAt", (q) => q.gte("createdAt", since)).collect())
    .filter((a) => a.emailStatus === "failed");
  const failedEmails = failedAlerts.length;
  const activeWatches = (await ctx.db.query("watches").withIndex("by_active_next", (q) => q.eq("active", true)).collect())
    .filter((w) => w.archivedAt === undefined);
  const failing = activeWatches
    .filter((w) => w.lastError).map((w) => ({ label: w.name ?? w.label, error: w.lastError!, watchId: w._id, userId: w.userId }));
  const behind = activeWatches.filter((w) => (w.backlog ?? 0) >= 100 || w.coverageCapped);
  const sum = (key: "checked" | "failed" | "emails" | "emailFailures") => runs.reduce((n, r) => n + r[key], 0);
  const problems: string[] = [];
  if (errors.length >= 5) problems.push(`${errors.length} errors in the last 24 hours (chat ${chatErrors}, check ${checkErrors}); latest: ${errors.slice(0, 5).map((e) => e.requestId).join(", ")}.`);
  if (!lastRun || now - lastRun.at > STUCK_AFTER)
    problems.push(lastRun ? `The scheduler hasn't run since ${new Date(lastRun.at).toISOString()}.` : "The scheduler hasn't run yet.");
  if (runs.some((r) => r.paused)) problems.push("Checks are paused (CHECKS_PAUSED=1).");
  if (failedEmails) problems.push(`${failedEmails} alert e-mail(s) failed to send.`);
  if (failing.length) problems.push(`${failing.length} watch(es) failing: ${failing.slice(0, 5).map((w) => `"${w.label}" (${w.error})`).join("; ")}.`);
  const missed = audits.filter((a) => a.missCount > 0);
  const missCount = audits.reduce((n, a) => n + a.missCount, 0);
  if (missCount) {
    const details = await Promise.all(missed.slice(0, 5).map(async (a) => {
      const w = await ctx.db.get(a.watchId);
      return a.misses.map((m) => `"${w?.name ?? w?.label ?? "Deleted watch"}" (${m.score}/10 "${m.title}", ${m.kind}${m.checkScore !== undefined ? `, scored ${m.checkScore} at check, ${m.score} now` : ""})`).join(", ");
    }));
    problems.push(`Delivery audit: ${missCount} missed match(es) on ${new Set(missed.map((a) => a.watchId)).size} watch(es): ${details.filter(Boolean).join(", ")}; request ${missed[0].requestId}.`);
  }
  for (const a of audits.filter((a) => !a.ok)) {
    const w = await ctx.db.get(a.watchId);
    problems.push(`Delivery audit failed for "${w?.name ?? w?.label ?? "Deleted watch"}": ${a.error ?? "Unknown error"}; request ${a.requestId}.`);
  }
  if (behind.length) problems.push(`${behind.length} watch(es) can't keep up: ${behind.map((w) => `"${w.name ?? w.label}" (backlog ${w.backlog ?? 0})`).join("; ")}.`);
  type Item = { label: string; watchId?: string; userId?: string; requestId?: string; listingId?: string; score?: number; title?: string; url?: string };
  type Issue = { kind: string; severity: "high" | "medium" | "low"; headline: string; count: number; items: Item[] };
  const issues: Issue[] = [];
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : word === "missed match" || word === "watch" ? "es" : "s"}`;
  if (errors.length >= 5) issues.push({ kind: "errors", severity: "high", headline: plural(errors.length, "error"), count: errors.length,
    items: errors.map((e) => ({ label: `${e.kind} error: ${e.message}`, requestId: e.requestId })) });
  if (!lastRun || now - lastRun.at > STUCK_AFTER) issues.push({ kind: "scheduler_stuck", severity: "high", headline: "Scheduler hasn't run", count: 1,
    items: [{ label: lastRun ? `Last run ${new Date(lastRun.at).toISOString()}` : "No runs yet", requestId: lastRun?.requestId }] });
  const pausedRuns = runs.filter((r) => r.paused);
  if (pausedRuns.length) issues.push({ kind: "checks_paused", severity: "high", headline: "Checks are paused", count: pausedRuns.length,
    items: pausedRuns.map((r) => ({ label: `Paused run ${new Date(r.at).toISOString()}`, requestId: r.requestId })) });
  const failedAlertItems = await Promise.all(failedAlerts.map(async (a) => {
    const w = await ctx.db.get(a.watchId);
    return { label: w?.name ?? w?.label ?? "Deleted watch", watchId: a.watchId, userId: a.userId,
      listingId: a.listingId, score: a.score, title: a.title, url: a.url };
  }));
  if (failedEmails) issues.push({ kind: "emails_failed", severity: "high", headline: `${plural(failedEmails, "alert e-mail")} failed`, count: failedEmails,
    items: failedAlertItems });
  if (failing.length) issues.push({ kind: "watches_failing", severity: "high", headline: `${plural(failing.length, "watch")} failing`, count: failing.length,
    items: failing.map((w) => ({ label: `${w.label}: ${w.error}`, watchId: w.watchId, userId: w.userId })) });
  const auditWatches = new Map(await Promise.all(audits.filter((a) => a.missCount > 0 || !a.ok).map(async (a) => {
    const w = await ctx.db.get(a.watchId);
    return [a.watchId, w?.name ?? w?.label ?? "Deleted watch"] as const;
  })));
  if (missCount) issues.push({ kind: "delivery_misses", severity: "high",
    headline: `${plural(missCount, "missed match")} on ${plural(new Set(missed.map((a) => a.watchId)).size, "watch")}`, count: missCount,
    items: missed.flatMap((a) => a.misses.map((m) => ({ label: auditWatches.get(a.watchId)!, watchId: a.watchId, userId: a.userId,
      requestId: a.requestId, listingId: m.listingId, score: m.score, title: m.title, url: m.url }))) });
  const failedAudits = audits.filter((a) => !a.ok);
  if (failedAudits.length) issues.push({ kind: "audit_failed", severity: "high", headline: `${plural(failedAudits.length, "delivery audit")} failed`, count: failedAudits.length,
    items: failedAudits.map((a) => ({ label: `${auditWatches.get(a.watchId)}: ${a.error ?? "Unknown error"}`, watchId: a.watchId,
      userId: a.userId, requestId: a.requestId })) });
  if (behind.length) issues.push({ kind: "watches_behind", severity: "medium", headline: `${plural(behind.length, "watch")} can't keep up`, count: behind.length,
    items: behind.map((w) => ({ label: `${w.name ?? w.label} (backlog ${w.backlog ?? 0})`, watchId: w._id, userId: w.userId })) });
  return {
    problems,
    issues,
    stats: { runs: runs.length, checksFailed: sum("failed"), emailsSent: sum("emails"), errors: errors.length },
    summary: `Last 24 h: ${runs.length} runs, ${sum("checked")} watch checks (${sum("failed")} failed), ${sum("emails")} alert e-mails sent, ${errors.length} errors (chat ${chatErrors}, check ${checkErrors}); latest: ${errors.slice(0, 5).map((e) => e.requestId).join(", ") || "none"}. Delivery audit: ${audits.length} watches checked, ${missCount} misses.`,
    lastRunAt: lastRun?.at ?? null,
  };
}

export const report = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => healthReport(ctx, now),
});

export const digest = internalAction({
  args: { dryRun: v.optional(v.boolean()), force: v.optional(v.boolean()) },
  // Explicit types: this action calls a query in its own module, which would otherwise make the types circular
  handler: async (ctx, { dryRun = false, force = false }): Promise<{ sent: boolean; problems: string[]; summary: string }> => {
    const now = Date.now();
    const { problems, summary }: { problems: string[]; summary: string } = await ctx.runQuery(internal.health.report, { now });
    const monday = new Date(now).getUTCDay() === 1;
    if (!problems.length && !monday && !force) return { sent: false, problems, summary };
    const subject = problems.length ? `Marktplaats Watcher: ${problems.length} problem(s) need a look` : "Marktplaats Watcher: all good this week";
    const text = [subject, "", ...problems.map((p) => `- ${p}`), problems.length ? "" : "Nothing failed.", summary, "",
      "What to do: see RUNBOOK.md in the repo."].join("\n");
    const html = `<pre style="font:14px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`;
    const to = process.env.OWNER_EMAIL;
    if (dryRun || !to) {
      console.log(JSON.stringify({ event: "health_digest", dryRun, missingOwner: !to, problems, summary }));
      return { sent: false, problems, summary };
    }
    await sendEmail(to, { subject, text, html });
    return { sent: true, problems, summary };
  },
});
