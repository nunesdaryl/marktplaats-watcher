import { ConvexError, v } from "convex/values";
import { internalAction, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { sendEmail } from "./checker";
import { currentUser } from "./users";

export const DAY = 86_400_000;
export const PERIOD = 30 * DAY;
export const ENDED_MESSAGE = "Your free month has ended. Click 'Keep my watches' to continue free for another 30 days.";
export const disappointed = v.union(v.literal("very"), v.literal("somewhat"), v.literal("not"), v.literal("unused"));
export const wouldPay = v.union(v.literal("no"), v.literal("up_to_5"), v.literal("5_to_10"), v.literal("over_10"));

export function isFoundingOwner(user: Doc<"users">) {
  return !!process.env.OWNER_CLERK_ID?.trim() && !!process.env.OWNER_EMAIL?.trim()
    && user.clerkId === process.env.OWNER_CLERK_ID?.trim()
    && user.email.trim().toLowerCase() === process.env.OWNER_EMAIL?.trim().toLowerCase();
}

export function hasEnded(user: Doc<"users">, now = Date.now()) {
  return !isFoundingOwner(user) && now >= (user.freeUntil ?? Date.parse("2026-11-04T00:00:00Z"));
}

async function round(ctx: QueryCtx, user: Doc<"users">) {
  return user.freeUntil === undefined ? null : ctx.db.query("foundingRounds")
    .withIndex("by_user_round", (q) => q.eq("userId", user._id).eq("freeUntil", user.freeUntil!)).unique();
}

async function ensureRound(ctx: MutationCtx, user: Doc<"users">) {
  if (user.freeUntil === undefined) throw new ConvexError("Your founding month is not ready yet.");
  const existing = await round(ctx, user);
  return existing ?? await ctx.db.get(await ctx.db.insert("foundingRounds", { userId: user._id, freeUntil: user.freeUntil }));
}

export const mine = query({ args: {}, handler: async (ctx) => {
  const user = await currentUser(ctx);
  if (!user || isFoundingOwner(user) || user.freeUntil === undefined) return null;
  const answer = await round(ctx, user);
  const now = Date.now();
  return { freeUntil: user.freeUntil, ended: hasEnded(user, now),
    showSurvey: now >= user.freeUntil - 16 * DAY && now < user.freeUntil
      && !answer?.disappointed && !answer?.dismissedAt,
    disappointed: answer?.disappointed, benefit: answer?.benefit, wouldPay: answer?.wouldPay,
    dismissed: !!answer?.dismissedAt };
} });

export const dismiss = mutation({ args: {}, handler: async (ctx) => {
  const user = await currentUser(ctx);
  if (!user || isFoundingOwner(user) || user.freeUntil === undefined || Date.now() < user.freeUntil - 16 * DAY) return;
  const answer = await ensureRound(ctx, user);
  if (answer && !answer.dismissedAt) await ctx.db.patch(answer._id, { dismissedAt: Date.now() });
} });

export const answerSurvey = mutation({ args: { disappointed, benefit: v.optional(v.string()) }, handler: async (ctx, args) => {
  const user = await currentUser(ctx);
  if (!user || isFoundingOwner(user) || user.freeUntil === undefined || Date.now() < user.freeUntil - 16 * DAY)
    throw new ConvexError("The survey is not available yet.");
  if ((args.benefit?.length ?? 0) > 300) throw new ConvexError("Please keep your answer under 300 characters.");
  const answer = await ensureRound(ctx, user);
  if (answer && !answer.disappointed) await ctx.db.patch(answer._id,
    { disappointed: args.disappointed, benefit: args.benefit?.trim() || undefined });
} });

export const extend = mutation({ args: { disappointed, wouldPay }, handler: async (ctx, args) => {
  const user = await currentUser(ctx);
  if (!user || isFoundingOwner(user) || user.freeUntil === undefined || Date.now() < user.freeUntil - 5 * DAY)
    throw new ConvexError("You can keep your watches from day 25.");
  const answer = await ensureRound(ctx, user);
  if (!answer) throw new ConvexError("Your founding month is not ready yet.");
  const now = Date.now();
  await ctx.db.patch(answer._id, { disappointed: answer.disappointed ?? args.disappointed, wouldPay: args.wouldPay, extendedAt: now });
  await ctx.db.patch(user._id, { freeUntil: now + PERIOD });
  let resumed = false;
  for (const watch of await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect())
    if (watch.active && watch.archivedAt === undefined) {
      await ctx.db.patch(watch._id, { nextRunAt: now, leaseUntil: undefined });
      resumed = true;
    }
  if (resumed) await ctx.scheduler.runAfter(0, internal.checker.checkDue, {});
  return now + PERIOD;
} });

// A daily sweep claims each message before scheduling delivery, so repeated cron runs cannot duplicate it.
export const claimEmails = internalMutation({ args: { now: v.number() }, handler: async (ctx, { now }) => {
  const messages: { to: string; kind: "survey" | "notice"; freeUntil: number }[] = [];
  for await (const user of ctx.db.query("users")) {
    if (isFoundingOwner(user)) continue;
    const freeUntil = user.freeUntil ?? Date.parse("2026-11-04T00:00:00Z");
    if (user.freeUntil === undefined) await ctx.db.patch(user._id, { admittedAt: Date.parse("2026-10-05T00:00:00Z"), freeUntil });
    if (now >= freeUntil) continue;
    const current = (await ctx.db.get(user._id))!;
    const age = now - (freeUntil - PERIOD);
    if (age < 14 * DAY) continue;
    const answer = await ensureRound(ctx, current);
    if (!answer) continue;
    if (!answer.surveyEmailAt) {
      await ctx.db.patch(answer._id, { surveyEmailAt: now });
      messages.push({ to: user.email, kind: "survey", freeUntil });
    }
    if (age >= 25 * DAY && !answer.noticeEmailAt) {
      await ctx.db.patch(answer._id, { noticeEmailAt: now });
      messages.push({ to: user.email, kind: "notice", freeUntil });
    }
  }
  return messages;
} });

export const sendReminders = internalAction({ args: {}, handler: async (ctx) => {
  const messages = await ctx.runMutation(internal.founding.claimEmails, { now: Date.now() });
  const url = `${(process.env.APP_URL ?? "https://marktplaats-watcher.vercel.app").replace(/\/$/, "")}/?founding=1`;
  for (const message of messages) {
    const date = new Date(message.freeUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" });
    const subject = message.kind === "survey" ? "How would you feel without Marktplaats Watcher?" : "Your founding month is ending";
    const text = message.kind === "survey"
      ? `How would you feel if you could no longer use Marktplaats Watcher? Answer in the app: ${url}`
      : `Your founding month ends on ${date}. Click 'Keep my watches' in the app to get another 30 days free; it takes two questions. ${url}`;
    await sendEmail(message.to, { subject, text, html: `<p>${text}</p>` });
  }
} });

export const purge = internalMutation({ args: {}, handler: async (ctx) => {
  const cutoff = Date.now() - 365 * DAY;
  for await (const row of ctx.db.query("foundingRounds"))
    if (row._creationTime < cutoff) await ctx.db.delete(row._id);
} });

export const ownerSummary = query({ args: {}, handler: async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !process.env.OWNER_CLERK_ID?.trim() || !process.env.OWNER_EMAIL?.trim()
    || identity.subject !== process.env.OWNER_CLERK_ID?.trim()
    || identity.email?.trim().toLowerCase() !== process.env.OWNER_EMAIL?.trim().toLowerCase()) return null;
  const now = Date.now();
  const users = await ctx.db.query("users").collect();
  const answers = await ctx.db.query("foundingRounds").collect();
  const emails = new Map(users.map((user) => [user._id, user.email]));
  const survey = answers.filter((row) => !!row.disappointed);
  const very = survey.filter((row) => row.disappointed === "very").length;
  const prices = { no: 0, up_to_5: 0, "5_to_10": 0, over_10: 0 };
  for (const row of answers) if (row.wouldPay) prices[row.wouldPay]++;
  return { n: survey.length, very, percentVery: survey.length ? Math.round(100 * very / survey.length) : 0,
    prices, paused: users.filter((user) => hasEnded(user, now)).length,
    extended: new Set(answers.filter((row) => !!row.extendedAt).map((row) => row.userId)).size,
    answers: answers.filter((row) => !!row.disappointed || !!row.wouldPay)
      .sort((a, b) => b.freeUntil - a.freeUntil).map((row) => ({
        email: emails.get(row.userId) ?? "(deleted account)", freeUntil: row.freeUntil,
        disappointed: row.disappointed, benefit: row.benefit, wouldPay: row.wouldPay, extendedAt: row.extendedAt,
      })),
  };
} });
