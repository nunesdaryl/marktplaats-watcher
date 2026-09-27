import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { listingCard } from "./schema";
import { currentUser, requireUser } from "./users";

const MAX_CONTENT = 8000;
const MAX_CHATS_LISTED = 50;

async function ownChat(ctx: MutationCtx, chatId: Id<"chats">) {
  const user = await requireUser(ctx);
  const chat = await ctx.db.get(chatId);
  if (!chat || chat.userId !== user._id) throw new ConvexError("Chat not found.");
  return chat;
}

/** A proposal from the chat, as the UI saves it: only the fields the watch mutations accept. */
function checkProposals(proposals: unknown[] | undefined) {
  if (!proposals) return undefined;
  if (proposals.length > 5) throw new ConvexError("Too many proposals in one message.");
  for (const p of proposals) {
    const type = (p as { type?: unknown })?.type;
    if (type !== "create" && type !== "update") throw new ConvexError("Unknown proposal.");
  }
  return proposals;
}

/** Start a chat with its first message; the title is that message, shortened. */
export const start = mutation({
  args: { content: v.string() },
  handler: async (ctx, { content }) => {
    const user = await requireUser(ctx);
    const text = content.trim().slice(0, MAX_CONTENT);
    if (!text) throw new ConvexError("Type a message first.");
    const title = text.length > 48 ? `${text.slice(0, 47).trimEnd()}…` : text;
    const now = Date.now();
    const chatId = await ctx.db.insert("chats", { userId: user._id, title, updatedAt: now });
    await ctx.db.insert("messages", { chatId, role: "user", content: text });
    return chatId;
  },
});

export const append = mutation({
  args: {
    chatId: v.id("chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    listings: v.optional(v.array(listingCard)),
    proposals: v.optional(v.array(v.any())),
    search: v.optional(v.object({
      query: v.string(), max_price_eur: v.optional(v.union(v.number(), v.null())),
      must_include: v.optional(v.union(v.string(), v.null())), postcode: v.optional(v.union(v.string(), v.null())),
      max_distance_km: v.optional(v.union(v.number(), v.null())),
    })),
  },
  handler: async (ctx, { chatId, role, content, listings, proposals, search }) => {
    await ownChat(ctx, chatId);
    const id = await ctx.db.insert("messages", {
      chatId, role, content: content.slice(0, MAX_CONTENT),
      listings: listings?.slice(0, 10), proposals: checkProposals(proposals), search,
    });
    await ctx.db.patch(chatId, { updatedAt: Date.now() });
    return id;
  },
});

/** Remember that a proposal card was saved, so reopening the chat doesn't offer "Save" again. */
export const markProposalSaved = mutation({
  args: { messageId: v.id("messages"), index: v.number() },
  handler: async (ctx, { messageId, index }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw new ConvexError("Message not found.");
    await ownChat(ctx, message.chatId);
    const saved = new Set(message.savedProposals ?? []);
    saved.add(index);
    await ctx.db.patch(messageId, { savedProposals: [...saved] });
  },
});

export const remove = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    await ownChat(ctx, chatId);
    await deleteChat(ctx, chatId);
  },
});

export async function deleteChat(ctx: MutationCtx, chatId: Id<"chats">) {
  for (const m of await ctx.db.query("messages").withIndex("by_chat", (q) => q.eq("chatId", chatId)).collect())
    await ctx.db.delete(m._id);
  await ctx.db.delete(chatId);
}

/** The signed-in user's chats, newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    return ctx.db.query("chats").withIndex("by_user_updated", (q) => q.eq("userId", user._id))
      .order("desc").take(MAX_CHATS_LISTED);
  },
});

/** One chat's messages, oldest first; null when it isn't yours (or no longer exists). */
export const messages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, { chatId }) => {
    const user = await currentUser(ctx);
    const chat = await ctx.db.get(chatId);
    if (!user || !chat || chat.userId !== user._id) return null;
    const messages = await ctx.db.query("messages").withIndex("by_chat", (q) => q.eq("chatId", chatId)).collect();
    return { chat, messages };
  },
});
