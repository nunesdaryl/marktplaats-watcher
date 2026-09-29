// "Give feedback": a free-text suggestion and/or an answer to "Would you pay for this?", with a screenshot of the page
// it was sent from (opt-out, e-mail addresses masked) and a little context for debugging. Stored, e-mailed to
// OWNER_EMAIL so a real person reads it, and listed on the owner dashboard (/admin). `npx convex run feedback:summary`
// counts the answers.
import { ConvexError, v } from "convex/values";
import { internalAction, internalQuery, mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { sendEmail } from "./checker";
import { feedbackContext, wouldPayValidator } from "./schema";
import { requireUser } from "./users";

export const WOULD_PAY = {
  no: "No, only if it's free",
  maybe: "Maybe",
  eur2: "Yes, about €2 a month",
  eur5: "Yes, about €5 a month",
  eur10: "Yes, €10 or more a month",
} as const;

const MAX_LENGTH = 2000;
const PER_DAY = 10;
const MAX_SCREENSHOT = 1_500_000;   // bytes; a 1280px JPEG of a page is ~100–400 kB

async function sentToday(ctx: MutationCtx, userId: Id<"users">, now: number) {
  return (await ctx.db.query("feedback")
    .withIndex("by_user_created", (q) => q.eq("userId", userId).gte("createdAt", now - 86_400_000)).take(PER_DAY)).length;
}

/** Where the app uploads the screenshot before submitting (the same daily limit applies). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    if (await sentToday(ctx, user._id, Date.now()) >= PER_DAY) throw new ConvexError("Thanks, that's plenty for today. Send more tomorrow.");
    return await ctx.storage.generateUploadUrl();
  },
});

export const submit = mutation({
  args: {
    message: v.optional(v.string()), wouldPay: v.optional(wouldPayValidator), page: v.optional(v.string()),
    screenshotId: v.optional(v.id("_storage")), context: v.optional(feedbackContext),
  },
  handler: async (ctx, { message, wouldPay, page, screenshotId, context }) => {
    const user = await requireUser(ctx);
    const text = message?.trim() || undefined;
    if (!text && !wouldPay) throw new ConvexError("Write a message or pick an answer first.");
    if (text && text.length > MAX_LENGTH) throw new ConvexError(`Please keep it under ${MAX_LENGTH} characters.`);
    const now = Date.now();
    if (await sentToday(ctx, user._id, now) >= PER_DAY) throw new ConvexError("Thanks, that's plenty for today. Send more tomorrow.");
    // Keep the screenshot only if it's a normal-sized image; anything else is deleted, and the feedback still counts
    let shot = screenshotId;
    if (shot) {
      const meta = await ctx.db.system.get(shot);
      // The upload's Content-Type is recorded when present; it's only ever shown to the owner as an <img>
      const ok = meta && meta.size <= MAX_SCREENSHOT && (!meta.contentType || /^image\/(jpeg|png|webp)$/.test(meta.contentType));
      if (!ok) {
        if (meta) await ctx.storage.delete(shot);
        shot = undefined;
      }
    }
    const cut = (s: string | undefined, n = 80) => s?.slice(0, n);
    const ctxRow = context && {
      path: context.path.slice(0, 60), viewport: context.viewport.slice(0, 20), device: context.device.slice(0, 10),
      theme: context.theme.slice(0, 10), version: cut(context.version, 12), browser: cut(context.browser, 60),
      errors: context.errors?.slice(0, 5).map((e) => e.slice(0, 200)),
    };
    const id = await ctx.db.insert("feedback", {
      userId: user._id, message: text, wouldPay, page: page?.slice(0, 40), screenshotId: shot, context: ctxRow, createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.feedback.notifyOwner, { id });
    return id;
  },
});

export const get = internalQuery({
  args: { id: v.id("feedback") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) return null;
    const user = await ctx.db.get(row.userId);
    return { ...row, email: user?.email ?? "(deleted user)" };
  },
});

export const notifyOwner = internalAction({
  args: { id: v.id("feedback") },
  handler: async (ctx, { id }): Promise<void> => {
    const to = process.env.OWNER_EMAIL;
    const row: {
      message?: string; wouldPay?: keyof typeof WOULD_PAY; page?: string; email: string; screenshotId?: string;
      context?: { path: string; viewport: string; device: string; theme: string; version?: string; browser?: string; errors?: string[] };
    } | null = await ctx.runQuery(internal.feedback.get, { id });
    if (!to || !row) return;
    const pay = row.wouldPay ? WOULD_PAY[row.wouldPay] : "not answered";
    const subject = `Feedback from ${row.email}${row.wouldPay ? `: ${pay}` : ""}`;
    const c = row.context;
    const appUrl = process.env.APP_URL ?? "https://marktplaats-watcher.vercel.app";
    const text = [
      `From: ${row.email}`, `Would pay: ${pay}`, `Page: ${c?.path ?? row.page ?? "?"}`,
      ...(c ? [`Screen: ${c.device}, ${c.viewport}, ${c.theme} mode, ${c.browser ?? "unknown browser"}, version ${c.version ?? "?"}`] : []),
      ...(c?.errors?.length ? ["Recent errors:", ...c.errors.map((e) => `  ${e}`)] : []),
      `Screenshot: ${row.screenshotId ? "attached on the dashboard" : "none"}`,
      "", row.message ?? "(no message)", "", `Dashboard: ${appUrl}/admin/`,
    ].join("\n");
    const html = `<pre style="font:14px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)}</pre>`;
    await sendEmail(to, { subject, text, html });
  },
});

/** For the owner: how many people would pay, and the latest messages. */
export const summary = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("feedback").withIndex("by_created").order("desc").collect();
    const wouldPay = (Object.keys(WOULD_PAY) as (keyof typeof WOULD_PAY)[])
      .map((key) => ({ answer: WOULD_PAY[key], count: rows.filter((r) => r.wouldPay === key).length }));
    return {
      total: rows.length,
      wouldPay,
      latest: rows.slice(0, 20).map((r) => ({ at: new Date(r.createdAt).toISOString(), wouldPay: r.wouldPay, message: r.message })),
    };
  },
});
