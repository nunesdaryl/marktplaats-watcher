// The four short onboarding mails. A claim is a permanent delivery attempt, as with founding reminders.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { sendEmail } from "./checker";
import { isFoundingOwner, hasEnded, DAY } from "./founding";
import { ownerMatches } from "./admin";

const steps = ["welcome", "no_watch", "first_alert", "tips"] as const;
type Step = typeof steps[number];
const step = v.union(...steps.map((s) => v.literal(s)));
type Language = "nl" | "en";
const dayKey = (at: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
const origin = (url: string) => url.replace(/\/$/, "");
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const copy: Record<Language, Record<Step, { subject: string; lines: string[]; cta: string }>> = {
  nl: {
    welcome: { subject: "Welkom bij Marktplaats Watcher", lines: ["Welkom. Je bepaalt wat je zoekt; de app kijkt daarna op vaste momenten naar nieuwe advertenties.", "Begin met je eerste zoekopdracht als watch op te slaan. Kies je prijs, afstand en welke matches een e-mail waard zijn."], cta: "Stel je eerste watch in" },
    no_watch: { subject: "Nog geen watch ingesteld?", lines: ["Zonder opgeslagen watch kan de app je nog geen nieuwe matches sturen.", "Een korte omschrijving van wat je zoekt is genoeg om te beginnen. Je kunt de filters later aanpassen."], cta: "Maak een watch" },
    first_alert: { subject: "Je eerste alert lezen", lines: ["Je eerste alert laat zien waarom een advertentie bij je watch past. De score helpt je kiezen wat je eerst bekijkt; controleer zelf prijs, staat en verkoper.", "Was dit een goede match? Geef een beoordeling in de app. Dat helpt toekomstige scores voor deze watch."], cta: "Bekijk en beoordeel je alert" },
    tips: { subject: "Haal meer uit je watch", lines: ["Je watch is een week oud. Sluit woorden uit die steeds verkeerde resultaten geven; een prijsdaling herken je aan de oude en nieuwe prijs in je alert.", "Wil je bieden? Vanuit een alert kun je met één tik een voorstel laten opstellen. Lees het eerst na voordat je het verstuurt."], cta: "Bekijk je watches" },
  },
  en: {
    welcome: { subject: "Welcome to Marktplaats Watcher", lines: ["Welcome. You choose what to look for; the app checks for new listings on a schedule.", "Save your first watch with a price, distance and the match level worth an email. You can change it later."], cta: "Set up your first watch" },
    no_watch: { subject: "No watch yet?", lines: ["Without a saved watch, the app cannot send you new matches.", "A short description of what you want is enough to begin. You can refine the filters later."], cta: "Create a watch" },
    first_alert: { subject: "How to read your first alert", lines: ["Your first alert explains why a listing matches your watch. The score helps you decide what to inspect first; check the price, condition and seller yourself.", "Was it a good match? Rate the alert in the app. Your answer helps tune future scores for this watch."], cta: "Read and rate your alert" },
    tips: { subject: "Get more from your watch", lines: ["Your watch is a week old. Exclude words that bring unwanted results; price drops show the old and new price in an alert.", "Want to bid? One tap from an alert drafts an offer for you. Review it before you send it."], cta: "Review your watches" },
  },
};

export function renderNurture(kind: Step, language: Language, siteUrl: string, token: string) {
  const c = copy[language][kind];
  const target = kind === "first_alert" ? "/alerts/" : kind === "tips" ? "/watches/" : "/";
  const link = `${origin(siteUrl)}/nurture/open?token=${encodeURIComponent(token)}&step=${kind}&to=${encodeURIComponent(target)}`;
  const unsubscribe = `${origin(siteUrl)}/nurture/unsubscribe?token=${encodeURIComponent(token)}&step=${kind}`;
  const footer = language === "nl" ? "Je krijgt dit omdat je je hebt aangemeld. Afmelden voor deze tips verandert je alerts niet." : "You get this because you signed up. Unsubscribing from these tips does not affect alerts.";
  const text = `${c.lines.join("\n\n")}\n\n${c.cta}: ${link}\n\n${footer}\n${language === "nl" ? "Afmelden" : "Unsubscribe"}: ${unsubscribe}`;
  const html = `<!doctype html><html lang="${language}"><head><meta name="color-scheme" content="light dark"><style>@media (prefers-color-scheme: dark){body{background:#1b1a18!important;color:#f4f1eb!important}}</style></head><body style="margin:0;background:#f7f5f0;color:#1b1a18;font:15px/1.6 Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="540" style="max-width:100%;background:#fff;padding:28px"><tr><td><h1 style="font-size:22px">${escape(c.subject)}</h1>${c.lines.map((line) => `<p>${escape(line)}</p>`).join("")}<p><a href="${escape(link)}" style="color:#0d6b62">${escape(c.cta)}</a></p><p style="font-size:12px;color:#5b5751">${escape(footer)} <a href="${escape(unsubscribe)}">${language === "nl" ? "Afmelden" : "Unsubscribe"}</a></p></td></tr></table></td></tr></table></body></html>`;
  return { subject: c.subject, text, html };
}

async function eligible(ctx: MutationCtx, user: Doc<"users">, now: number) {
  if (isFoundingOwner(user) || user.nurtureUnsubscribedAt || hasEnded(user, now) || now - user.createdAt >= 14 * DAY) return null;
  const sent = await ctx.db.query("nurtureEmails").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
  if (sent.some((row) => dayKey(row.claimedAt) === dayKey(now) || row.sentAt && dayKey(row.sentAt) === dayKey(now))) return null;
  const has = (kind: Step) => sent.some((row) => row.step === kind);
  const watches = await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
  const active = watches.some((w) => w.active && w.archivedAt === undefined);
  if (watches.length && !active) return null; // the user paused all watches
  const age = now - user.createdAt;
  // Only new sign-ups start the sequence: people who joined before it existed never get a late welcome.
  if (!has("welcome")) return age < 2 * DAY ? "welcome" as Step : null;
  const firstAlert = await ctx.db.query("alerts").withIndex("by_user", (q) => q.eq("userId", user._id)).filter((q) => q.eq(q.field("emailStatus"), "sent")).first();
  if (firstAlert && !has("first_alert")) return "first_alert" as Step;
  if (age >= DAY && !watches.length && !has("no_watch")) return "no_watch" as Step;
  if (age >= 7 * DAY && active && !has("tips")) return "tips" as Step;
  return null;
}

export const claimDue = internalMutation({ args: { now: v.number() }, handler: async (ctx, { now }) => {
  const messages: { to: string; step: Step; language: Language; token: string; userId: Doc<"users">["_id"] }[] = [];
  for await (const user of ctx.db.query("users")) {
    const kind = await eligible(ctx, user, now);
    if (!kind) continue;
    const token = user.nurtureToken ?? crypto.randomUUID();
    if (!user.nurtureToken) await ctx.db.patch(user._id, { nurtureToken: token });
    await ctx.db.insert("nurtureEmails", { userId: user._id, step: kind, claimedAt: now });
    messages.push({ userId: user._id, to: user.email, step: kind, language: user.landingLanguage ?? user.browserLanguage ?? "en", token });
  }
  return messages;
} });

export const stillSubscribed = internalQuery({ args: { userId: v.id("users") }, handler: async (ctx, { userId }) => {
  const user = await ctx.db.get(userId);
  if (!user || user.nurtureUnsubscribedAt || hasEnded(user)) return false;
  const watches = await ctx.db.query("watches").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
  return !watches.length || watches.some((watch) => watch.active && watch.archivedAt === undefined);
} });

export const sendDue = internalAction({ args: {}, handler: async (ctx) => {
  const messages = await ctx.runMutation(internal.nurture.claimDue, { now: Date.now() });
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!siteUrl && messages.length) throw new Error("CONVEX_SITE_URL is required for nurture links.");
  for (const message of messages) {
    if (!await ctx.runQuery(internal.nurture.stillSubscribed, { userId: message.userId })) continue;
    await sendEmail(message.to, renderNurture(message.step, message.language, siteUrl!, message.token), "nurture");
    await ctx.runMutation(internal.nurture.markDelivered, { userId: message.userId, step: message.step, now: Date.now() });
  }
} });

export const markDelivered = internalMutation({ args: { userId: v.id("users"), step, now: v.number() }, handler: async (ctx, { userId, step: kind, now }) => {
  const row = await ctx.db.query("nurtureEmails").withIndex("by_user_step", (q) => q.eq("userId", userId).eq("step", kind)).unique();
  if (row && !row.sentAt) await ctx.db.patch(row._id, { sentAt: now });
} });

export const openLink = internalMutation({ args: { token: v.string(), step }, handler: async (ctx, { token, step: kind }) => {
  const user = await ctx.db.query("users").withIndex("by_nurtureToken", (q) => q.eq("nurtureToken", token)).unique();
  if (!user) return false;
  const row = await ctx.db.query("nurtureEmails").withIndex("by_user_step", (q) => q.eq("userId", user._id).eq("step", kind)).unique();
  if (!row) return false;
  if (!row.openedLinkAt) await ctx.db.patch(row._id, { openedLinkAt: Date.now() });
  return true;
} });

export const unsubscribe = mutation({ args: { token: v.string(), step }, handler: async (ctx, { token, step: kind }) => {
  const user = await ctx.db.query("users").withIndex("by_nurtureToken", (q) => q.eq("nurtureToken", token)).unique();
  if (!user) return false;
  if (!user.nurtureUnsubscribedAt) {
    const now = Date.now();
    await ctx.db.patch(user._id, { nurtureUnsubscribedAt: now });
    const row = await ctx.db.query("nurtureEmails").withIndex("by_user_step", (q) => q.eq("userId", user._id).eq("step", kind)).unique();
    if (row) await ctx.db.patch(row._id, { unsubscribedAt: now });
  }
  return true;
} });

export const ownerSummary = query({ args: {}, handler: async (ctx) => {
  if (!ownerMatches(await ctx.auth.getUserIdentity())) return null;
  const result = Object.fromEntries(steps.map((s) => [s, { sent: 0, openedLink: 0, unsubscribed: 0 }])) as Record<Step, { sent: number; openedLink: number; unsubscribed: number }>;
  for await (const row of ctx.db.query("nurtureEmails")) {
    if (row.sentAt) result[row.step].sent++;
    if (row.openedLinkAt) result[row.step].openedLink++;
    if (row.unsubscribedAt) result[row.step].unsubscribed++;
  }
  return result;
} });
