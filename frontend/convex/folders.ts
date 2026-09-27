import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { currentUser, requireUser } from "./users";

export const MAX_FOLDERS = 20;

export function cleanName(name: string, max: number, what: string) {
  const text = name.trim().replace(/\s+/g, " ");
  if (text.length < 1 || text.length > max) throw new ConvexError(`A ${what} name is 1 to ${max} characters.`);
  return text;
}

/** The caller's folder, or an error that doesn't reveal whether someone else's exists. */
export async function ownFolder(ctx: MutationCtx, folderId: Id<"folders">) {
  const user = await requireUser(ctx);
  const folder = await ctx.db.get(folderId);
  if (!folder || folder.userId !== user._id) throw new ConvexError("Folder not found.");
  return folder;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return [];
    const folders = await ctx.db.query("folders").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    return folders.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.name.localeCompare(b.name));
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const user = await requireUser(ctx);
    const count = (await ctx.db.query("folders").withIndex("by_user", (q) => q.eq("userId", user._id)).collect()).length;
    if (count >= MAX_FOLDERS) throw new ConvexError(`You can have up to ${MAX_FOLDERS} folders.`);
    return ctx.db.insert("folders", { userId: user._id, name: cleanName(name, 40, "folder"), createdAt: Date.now() });
  },
});

export const rename = mutation({
  args: { folderId: v.id("folders"), name: v.string() },
  handler: async (ctx, { folderId, name }) => {
    await ownFolder(ctx, folderId);
    await ctx.db.patch(folderId, { name: cleanName(name, 40, "folder") });
  },
});

export const setPinned = mutation({
  args: { folderId: v.id("folders"), pinned: v.boolean() },
  handler: async (ctx, { folderId, pinned }) => {
    await ownFolder(ctx, folderId);
    await ctx.db.patch(folderId, { pinned });
  },
});

/** Delete a folder. Its chats and watches move back to the main lists; nothing inside is deleted. */
export const remove = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, { folderId }) => {
    const folder = await ownFolder(ctx, folderId);
    const chats = await ctx.db.query("chats").withIndex("by_user_updated", (q) => q.eq("userId", folder.userId)).collect();
    const watches = await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", folder.userId)).collect();
    for (const row of [...chats, ...watches]) if (row.folderId === folderId) await ctx.db.patch(row._id, { folderId: undefined });
    await ctx.db.delete(folderId);
  },
});

/** Where an item may be moved: one of your folders, or null for "no folder". */
export async function checkTargetFolder(ctx: MutationCtx, folderId: Id<"folders"> | null) {
  if (folderId === null) return undefined;
  await ownFolder(ctx, folderId);
  return folderId;
}
