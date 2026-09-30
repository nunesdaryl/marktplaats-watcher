import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function sameSecret(given: string, expected: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(given), b = encoder.encode(expected);
  let difference = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) difference |= (a[i] ?? 0) ^ b[i];
  return difference === 0;
}

http.route({
  path: "/api/usage/consume", method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.API_TO_CONVEX_SECRET;
    if (!secret) return new Response("Usage check is not configured.", { status: 503 });
    if (!sameSecret(request.headers.get("X-Api-Secret") ?? "", secret)) return new Response("Wrong API secret.", { status: 401 });
    let body: unknown;
    try { body = await request.json(); } catch { return new Response("Invalid request.", { status: 400 }); }
    if (!body || typeof body !== "object" || !("clerkId" in body) || typeof body.clerkId !== "string" || !body.clerkId)
      return new Response("Invalid request.", { status: 400 });
    const result = await ctx.runMutation(internal.usage.consume, { clerkId: body.clerkId });
    return Response.json(result);
  }),
});

http.route({
  path: "/api/chats/assistant", method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.API_TO_CONVEX_SECRET;
    if (!secret) return new Response("Chat writes are not configured.", { status: 503 });
    if (!sameSecret(request.headers.get("X-Api-Secret") ?? "", secret)) return new Response("Wrong API secret.", { status: 401 });
    let body;
    try { body = await request.json(); } catch { return new Response("Invalid request.", { status: 400 }); }
    if (!body || typeof body !== "object" || typeof body.clerkId !== "string" || !body.clerkId ||
        typeof body.chatId !== "string" || typeof body.content !== "string")
      return new Response("Invalid request.", { status: 400 });
    try {
      const id = await ctx.runMutation(internal.chats.appendAssistant, body);
      return Response.json({ id });
    } catch {
      return new Response("Invalid chat message.", { status: 400 });
    }
  }),
});

http.route({
  path: "/api/errors", method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.API_TO_CONVEX_SECRET;
    if (!secret) return new Response("Error reporting is not configured.", { status: 503 });
    if (!sameSecret(request.headers.get("X-Api-Secret") ?? "", secret)) return new Response("Wrong API secret.", { status: 401 });
    let body: unknown;
    try { body = await request.json(); } catch { return new Response("Invalid request.", { status: 400 }); }
    if (!body || typeof body !== "object" || !("kind" in body) || body.kind !== "chat" ||
        !("requestId" in body) || typeof body.requestId !== "string" || !body.requestId ||
        !("message" in body) || typeof body.message !== "string")
      return new Response("Invalid request.", { status: 400 });
    await ctx.runMutation(internal.health.recordError, { kind: body.kind, requestId: body.requestId, message: body.message });
    return Response.json({ ok: true });
  }),
});

export default http;
