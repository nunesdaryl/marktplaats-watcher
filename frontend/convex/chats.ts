import { ConvexError, v, type Infer } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { listingCard } from "./schema";
import { notifyValidator, scheduleValidator } from "./schedule";
import { currentUser, requireUser } from "./users";
import { checkTargetFolder, cleanName } from "./folders";
import { insertTracked, patchTracked, deleteTracked } from "./totals";

const MAX_CONTENT = 8000;
const MAX_CHATS_LISTED = 50;
export const MAX_CHATS = 200;
export const MAX_MESSAGES = 200;

async function ownChat(ctx: MutationCtx, chatId: Id<"chats">) {
  const user = await requireUser(ctx);
  const chat = await ctx.db.get(chatId);
  if (!chat || chat.userId !== user._id) throw new ConvexError("Chat not found.");
  return chat;
}

const proposal = v.union(
  v.object({
    type: v.literal("create"), query: v.string(), maxPriceEur: v.union(v.number(), v.null()),
    mustInclude: v.union(v.string(), v.null()), postcode: v.union(v.string(), v.null()),
    maxDistanceKm: v.union(v.number(), v.null()), schedule: scheduleValidator, notify: notifyValidator,
    volumeNote: v.optional(v.union(v.string(), v.null())),
  }),
  v.object({
    type: v.literal("update"), watchId: v.string(), label: v.union(v.string(), v.null()),
    schedule: v.optional(scheduleValidator), notify: v.optional(notifyValidator),
    active: v.optional(v.boolean()), maxPriceEur: v.optional(v.number()),
    volumeNote: v.optional(v.union(v.string(), v.null())),
  }),
);

const search = v.object({
  query: v.string(), max_price_eur: v.optional(v.union(v.number(), v.null())),
  must_include: v.optional(v.union(v.string(), v.null())), postcode: v.optional(v.union(v.string(), v.null())),
  max_distance_km: v.optional(v.union(v.number(), v.null())),
});

type MessageFields = {
  listings?: Infer<typeof listingCard>[];
  proposals?: Infer<typeof proposal>[];
  search?: Infer<typeof search>;
};

async function insertMessage(ctx: MutationCtx, chatId: Id<"chats">, role: "user" | "assistant", content: string,
                             { listings, proposals, search }: MessageFields = {}) {
  const count = (await ctx.db.query("messages").withIndex("by_chat", (q) => q.eq("chatId", chatId)).take(MAX_MESSAGES)).length;
  if (count >= MAX_MESSAGES) throw new ConvexError("This chat is full. Start a new chat to keep going.");
  if (proposals && proposals.length > 5) throw new ConvexError("Too many proposals in one message.");
  const id = await ctx.db.insert("messages", {
    chatId, role, content: content.slice(0, MAX_CONTENT),
    listings: listings?.slice(0, 10), proposals, search,
  });
  await patchTracked(ctx, "chats", chatId, { updatedAt: Date.now() });
  return id;
}

/** Start a chat with its first message; the title is that message, shortened. */
export const start = mutation({
  args: { content: v.string() },
  handler: async (ctx, { content }) => {
    const user = await requireUser(ctx);
    const text = content.trim().slice(0, MAX_CONTENT);
    if (!text) throw new ConvexError("Type a message first.");
    const count = (await ctx.db.query("chats").withIndex("by_user_updated", (q) => q.eq("userId", user._id)).take(MAX_CHATS)).length;
    if (count >= MAX_CHATS) throw new ConvexError(`You have ${MAX_CHATS} chats. Delete a few old ones to start a new one.`);
    const title = text.length > 48 ? `${text.slice(0, 47).trimEnd()}…` : text;
    const now = Date.now();
    const chatId = await insertTracked(ctx, "chats", { userId: user._id, title, updatedAt: now });
    await ctx.db.insert("messages", { chatId, role: "user", content: text });
    return chatId;
  },
});

export const append = mutation({
  args: {
    chatId: v.id("chats"),
    role: v.literal("user"),
    content: v.string(),
  },
  handler: async (ctx, { chatId, content }) => {
    await ownChat(ctx, chatId);
    return insertMessage(ctx, chatId, "user", content);
  },
});

export const appendAssistant = internalMutation({
  args: {
    clerkId: v.string(), chatId: v.string(), content: v.string(),
    listings: v.optional(v.array(listingCard)), proposals: v.optional(v.array(proposal)),
    search: v.optional(search),
  },
  handler: async (ctx, { clerkId, chatId, content, listings, proposals, search }) => {
    const id = ctx.db.normalizeId("chats", chatId);
    if (!id) throw new ConvexError("Chat not found.");
    const user = await ctx.db.query("users").withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId)).unique();
    const chat = await ctx.db.get(id);
    if (!user || !chat || chat.userId !== user._id) throw new ConvexError("Chat not found.");
    return insertMessage(ctx, id, "assistant", content, { listings, proposals, search });
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
  await deleteTracked(ctx, "chats", chatId);
}

/** The signed-in user's chats (not archived): pinned first, then newest first. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const chats = await ctx.db.query("chats").withIndex("by_user_updated", (q) => q.eq("userId", user._id))
      .order("desc").take(MAX_CHATS);
    return chats.filter((c) => !c.archivedAt)
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt).slice(0, MAX_CHATS_LISTED);
  },
});

export const archived = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const chats = await ctx.db.query("chats").withIndex("by_user_updated", (q) => q.eq("userId", user._id)).collect();
    return chats.filter((c) => c.archivedAt).sort((a, b) => b.archivedAt! - a.archivedAt!);
  },
});

export const rename = mutation({
  args: { chatId: v.id("chats"), title: v.string() },
  handler: async (ctx, { chatId, title }) => {
    await ownChat(ctx, chatId);
    await patchTracked(ctx, "chats", chatId, { title: cleanName(title, 60, "chat") });
  },
});

export const setPinned = mutation({
  args: { chatId: v.id("chats"), pinned: v.boolean() },
  handler: async (ctx, { chatId, pinned }) => {
    await ownChat(ctx, chatId);
    await patchTracked(ctx, "chats", chatId, { pinned });
  },
});

export const setArchived = mutation({
  args: { chatId: v.id("chats"), archived: v.boolean() },
  handler: async (ctx, { chatId, archived }) => {
    await ownChat(ctx, chatId);
    await patchTracked(ctx, "chats", chatId, archived ? { archivedAt: Date.now(), pinned: false } : { archivedAt: undefined });
  },
});

export const move = mutation({
  args: { chatId: v.id("chats"), folderId: v.union(v.id("folders"), v.null()) },
  handler: async (ctx, { chatId, folderId }) => {
    await ownChat(ctx, chatId);
    await patchTracked(ctx, "chats", chatId, { folderId: await checkTargetFolder(ctx, folderId) });
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
