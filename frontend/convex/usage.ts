import { v } from "convex/values";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { TIMEZONE } from "./schedule";
import { budgetFor } from "./aiBudget";

export function usageDay(now: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

async function admitted(ctx: QueryCtx, clerkId: string) {
  const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
  return !!user || !!process.env.OWNER_EMAIL?.trim() && clerkId === process.env.OWNER_CLERK_ID?.trim();
}

export const check = internalQuery({ args: { clerkId: v.string() }, handler: async (ctx, { clerkId }) => {
  if (!await admitted(ctx, clerkId)) return { allowed: false };
  const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
  return { allowed: !user || (await budgetFor(ctx, user, Date.now())).allowed };
} });

export const consume = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const day = usageDay(Date.now());
    const limitValue = Number(process.env.CHAT_DAILY_LIMIT ?? "40");
    const limit = Number.isSafeInteger(limitValue) && limitValue > 0 ? limitValue : 40;
    if (!(await admitted(ctx, clerkId))) return { allowed: false, used: 0, limit, reason: "admission" };
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
    const ownerId = process.env.OWNER_CLERK_ID?.trim();
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const owner = !!ownerId && !!ownerEmail && clerkId === ownerId && (!user || user.email.trim().toLowerCase() === ownerEmail);
    if (user && !owner) {
      const budget = await budgetFor(ctx, user, Date.now());
      if (!budget.allowed) return { allowed: false, used: 0, limit, reason: "budget", resetsAt: budget.resetsAt };
    }
    const row = await ctx.db.query("usage").withIndex("by_user_day", (q) => q.eq("userId", clerkId).eq("day", day)).unique();
    const used = row?.chats ?? 0;
    if (!owner && used >= limit) return { allowed: false, used, limit };
    if (row) await ctx.db.patch(row._id, { chats: used + 1 });
    else await ctx.db.insert("usage", { userId: clerkId, day, chats: 1 });
    return { allowed: true, used: used + 1, limit };
  },
});
