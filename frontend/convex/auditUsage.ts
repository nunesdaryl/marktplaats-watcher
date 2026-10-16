import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

type AuditResult = { watchId: string; usage?: { model: string; calls: {
  input_tokens: number; output_tokens: number; cost_eur: number; estimated?: boolean }[] } };

/** Audit ranking is an owner expense, even when the audited watch belongs to someone else. */
export async function recordAuditUsage(ctx: ActionCtx, requestId: string,
  watchIds: string[], results: AuditResult[], missingOwner: { logged: boolean }) {
  const metered = results.filter((r) => r.usage?.calls.length && watchIds.includes(r.watchId));
  if (!metered.length) return;
  const owner = process.env.OWNER_CLERK_ID?.trim();
  if (!owner) {
    if (!missingOwner.logged) console.error("audit usage: OWNER_CLERK_ID is missing");
    missingOwner.logged = true;
    return;
  }
  for (const result of metered) for (const [index, call] of result.usage!.calls.entries()) {
    try {
      await ctx.runMutation(internal.aiBudget.record, { clerkId: owner, kind: "audit",
        watchId: result.watchId as Id<"watches">, model: result.usage!.model,
        inputTokens: call.input_tokens, outputTokens: call.output_tokens, costEur: call.cost_eur,
        ...(call.estimated ? { estimated: true } : {}),
        callId: `${requestId}.${result.watchId}.${index}` });
    } catch (error) {
      console.error(`audit usage ${requestId} could not be recorded:`, error);
    }
  }
}
