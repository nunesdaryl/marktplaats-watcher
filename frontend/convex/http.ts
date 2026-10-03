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

async function alertRequest(request: Request) {
  const secret = process.env.API_TO_CONVEX_SECRET;
  if (!secret) return { error: new Response("Alert API is not configured.", { status: 503 }) };
  if (!sameSecret(request.headers.get("X-Api-Secret") ?? "", secret))
    return { error: new Response("Wrong API secret.", { status: 401 }) };
  let body: any;
  try { body = await request.json(); } catch { return { error: new Response("Invalid request.", { status: 400 }) }; }
  if (!body || typeof body.clerkId !== "string" || !body.clerkId)
    return { error: new Response("Invalid request.", { status: 400 }) };
  return { body };
}

http.route({ path: "/api/alerts/search", method: "POST", handler: httpAction(async (ctx, request) => {
  const { body, error } = await alertRequest(request);
  if (error) return error;
  if (!Array.isArray(body.vector) || body.vector.length !== 1536 || body.vector.some((x: unknown) => typeof x !== "number" || !Number.isFinite(x)) ||
      (body.query !== undefined && typeof body.query !== "string") ||
      !Number.isInteger(body.limit) || body.limit < 1 || body.limit > 10)
    return new Response("Invalid request.", { status: 400 });
  return Response.json(await ctx.runAction(internal.embeddings.search, body));
}) });

http.route({ path: "/api/alerts/recent", method: "POST", handler: httpAction(async (ctx, request) => {
  const { body, error } = await alertRequest(request);
  if (error) return error;
  if (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 20)
    return new Response("Invalid request.", { status: 400 });
  return Response.json(await ctx.runQuery(internal.embeddings.recent, body));
}) });

http.route({ path: "/api/watches/mine", method: "POST", handler: httpAction(async (ctx, request) => {
  const { body, error } = await alertRequest(request);
  if (error) return error;
  return Response.json(await ctx.runQuery(internal.embeddings.watchesMine, { clerkId: body.clerkId }));
}) });

http.route({ path: "/api/alerts/activity", method: "POST", handler: httpAction(async (ctx, request) => {
  const { body, error } = await alertRequest(request);
  if (error) return error;
  if (!Number.isFinite(body.from) || !Number.isFinite(body.to) || body.from > body.to ||
      !Number.isInteger(body.limit) || body.limit < 1 || body.limit > 50 ||
      (body.watchId !== undefined && typeof body.watchId !== "string"))
    return new Response("Invalid request.", { status: 400 });
  try { return Response.json(await ctx.runQuery(internal.embeddings.activity, body)); }
  catch { return new Response("Invalid request.", { status: 400 }); }
}) });
