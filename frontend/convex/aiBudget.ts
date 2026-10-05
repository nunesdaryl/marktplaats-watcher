// Per-user 30-day AI spend. The API supplies priced token usage; Convex serializes the ledger and total.
import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { ownerMatches } from "./admin";
import { sendEmail } from "./checker";
import { currentUser } from "./users";

const PERIOD = 30 * 86_400_000;
const OFFER_AT = Date.parse("2026-10-05T00:00:00Z");

export function defaultBudget() {
  const value = Number(process.env.USER_AI_BUDGET_EUR ?? "1.00");
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function windowFor(user: Doc<"users">, now: number) {
  const start = user.admittedAt ?? OFFER_AT;
  const index = Math.max(0, Math.floor((now - start) / PERIOD));
  return { start: start + index * PERIOD, resetsAt: start + (index + 1) * PERIOD };
}

export async function budgetFor(ctx: QueryCtx, user: Doc<"users">, now: number) {
  const { start, resetsAt } = windowFor(user, now);
  const row = await ctx.db.query("aiBudgets").withIndex("by_user_window", (q) => q.eq("userId", user._id).eq("windowStart", start)).unique();
  const owner = user.clerkId === process.env.OWNER_CLERK_ID?.trim()
    && !!process.env.OWNER_EMAIL?.trim() && user.email.trim().toLowerCase() === process.env.OWNER_EMAIL?.trim().toLowerCase();
  const limitEur = user.aiBudgetEur ?? defaultBudget();
  const spentEur = row?.totalEur ?? 0;
  return { allowed: owner || spentEur < limitEur, spentEur, limitEur, resetsAt, windowStart: start, owner };
}

export const mine = query({ args: {}, handler: async (ctx) => {
  const user = await currentUser(ctx);
  return user ? await budgetFor(ctx, user, Date.now()) : null;
} });

export const check = internalQuery({ args: { clerkId: v.string() }, handler: async (ctx, { clerkId }) => {
  const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
  if (!user) return { allowed: false, reason: "admission" };
  const budget = await budgetFor(ctx, user, Date.now());
  return budget.allowed ? { allowed: true } : { allowed: false, reason: "budget", resetsAt: budget.resetsAt };
} });

export const record = internalMutation({
  args: { clerkId: v.string(), kind: v.union(v.literal("watch"), v.literal("chat")),
    watchId: v.optional(v.id("watches")), inputTokens: v.number(), outputTokens: v.number(), costEur: v.number(), callId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId)).unique();
    if (!user) throw new ConvexError("An admitted account is required.");
    if (args.kind === "watch" && (!args.watchId || (await ctx.db.get(args.watchId))?.userId !== user._id))
      throw new ConvexError("The watch does not belong to this account.");
    if (!Number.isSafeInteger(args.inputTokens) || args.inputTokens < 0 || !Number.isSafeInteger(args.outputTokens) || args.outputTokens < 0
      || !Number.isFinite(args.costEur) || args.costEur < 0) throw new ConvexError("Invalid AI usage.");
    if (await ctx.db.query("aiSpend").withIndex("by_call", (q) => q.eq("callId", args.callId)).unique()) return;
    const now = Date.now();
    const budget = await budgetFor(ctx, user, now);
    await ctx.db.insert("aiSpend", { userId: user._id, windowStart: budget.windowStart, kind: args.kind,
      ...(args.watchId ? { watchId: args.watchId } : {}), inputTokens: args.inputTokens,
      outputTokens: args.outputTokens, costEur: args.costEur, at: now, callId: args.callId });
    const row = await ctx.db.query("aiBudgets").withIndex("by_user_window", (q) => q.eq("userId", user._id).eq("windowStart", budget.windowStart)).unique();
    const totalEur = budget.spentEur + args.costEur;
    const notify = !budget.owner && totalEur >= budget.limitEur && !row?.notifiedAt;
    if (row) await ctx.db.patch(row._id, { totalEur, ...(notify ? { notifiedAt: now } : {}) });
    else await ctx.db.insert("aiBudgets", { userId: user._id, windowStart: budget.windowStart, totalEur,
      ...(notify ? { notifiedAt: now } : {}) });
    if (notify) {
      await ctx.scheduler.runAfter(0, internal.aiBudget.sendNotice, { userId: user._id, resetsAt: budget.resetsAt });
    }
  },
});

export const sendNotice = internalAction({ args: { userId: v.id("users"), resetsAt: v.number() }, handler: async (ctx, args) => {
  const email = await ctx.runQuery(internal.aiBudget.noticeEmail, { userId: args.userId });
  if (!email) return;
  const date = new Date(args.resetsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
  const text = `Your free AI budget for these 30 days is used up. Your watches and chat will resume on ${date}.`;
  await sendEmail(email, { subject: "Your watches are paused until your AI budget resets", text, html: `<p>${text}</p>` });
} });

export const noticeEmail = internalQuery({ args: { userId: v.id("users") }, handler: async (ctx, { userId }) => (await ctx.db.get(userId))?.email ?? null });

export const setUserBudget = mutation({ args: { userId: v.id("users"), limitEur: v.number() }, handler: async (ctx, { userId, limitEur }) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !ownerMatches(identity)) throw new ConvexError("Only the owner can change an AI budget.");
  if (!Number.isFinite(limitEur) || limitEur <= 0 || limitEur > 100) throw new ConvexError("Enter a budget between €0.01 and €100.");
  if (!await ctx.db.get(userId)) throw new ConvexError("Account not found.");
  await ctx.db.patch(userId, { aiBudgetEur: limitEur });
} });
