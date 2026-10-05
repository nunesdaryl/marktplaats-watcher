// Public founding-place count. Admissions stay counted after account deletion.
import { query, type QueryCtx } from "./_generated/server";

export function maxUsers() {
  const value = Number(process.env.MAX_USERS ?? "100");
  return Number.isSafeInteger(value) && value > 0 ? value : 100;
}

export async function capacityFor(ctx: QueryCtx) {
  const cap = maxUsers();
  const total = await ctx.db.query("dashboardTotals").withIndex("by_key", (q) => q.eq("key", "founding-admissions")).unique();
  let taken = total?.admitted;
  if (taken === undefined) {
    const ownerId = process.env.OWNER_CLERK_ID?.trim();
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    taken = 0;
    for await (const user of ctx.db.query("users")) {
      if (user.clerkId !== ownerId || user.email.trim().toLowerCase() !== ownerEmail) taken++;
    }
  }
  return { cap, taken, left: Math.max(0, cap - taken) };
}

export const capacity = query({ args: {}, handler: capacityFor });
