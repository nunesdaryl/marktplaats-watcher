// "Give feedback": a free-text suggestion and/or an answer to "Would you pay for this?". Stored, and e-mailed to
// OWNER_EMAIL so a real person reads it. `npx convex run feedback:summary` counts the answers.
import { ConvexError, v } from "convex/values";
import { internalAction, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { sendEmail } from "./checker";
import { wouldPayValidator } from "./schema";
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

export const submit = mutation({
  args: { message: v.optional(v.string()), wouldPay: v.optional(wouldPayValidator), page: v.optional(v.string()) },
  handler: async (ctx, { message, wouldPay, page }) => {
    const user = await requireUser(ctx);
    const text = message?.trim() || undefined;
    if (!text && !wouldPay) throw new ConvexError("Write a message or pick an answer first.");
    if (text && text.length > MAX_LENGTH) throw new ConvexError(`Please keep it under ${MAX_LENGTH} characters.`);
    const now = Date.now();
    const today = await ctx.db.query("feedback")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id).gte("createdAt", now - 86_400_000)).take(PER_DAY);
    if (today.length >= PER_DAY) throw new ConvexError("Thanks, that's plenty for today. Send more tomorrow.");
    const id = await ctx.db.insert("feedback", { userId: user._id, message: text, wouldPay, page: page?.slice(0, 40), createdAt: now });
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
    const row: { message?: string; wouldPay?: keyof typeof WOULD_PAY; page?: string; email: string } | null =
      await ctx.runQuery(internal.feedback.get, { id });
    if (!to || !row) return;
    const pay = row.wouldPay ? WOULD_PAY[row.wouldPay] : "not answered";
    const subject = `Feedback from ${row.email}${row.wouldPay ? `: ${pay}` : ""}`;
    const text = [`From: ${row.email}`, `Would pay: ${pay}`, `Page: ${row.page || "?"}`, "", row.message ?? "(no message)"].join("\n");
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
