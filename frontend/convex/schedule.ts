// Watch schedules: stored as a small structured object (never a raw cron string), so the UI and the
// chat produce the same safe shape. Pure functions, shared by Convex and the React UI.
import { ConvexError, v, type Infer } from "convex/values";

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const INTERVALS = [15, 30, 60, 180, 360, 720] as const;
export const TIMEZONE = "Europe/Amsterdam";

const day = v.union(...DAYS.map((d) => v.literal(d)));
export const scheduleValidator = v.union(
  v.object({ kind: v.literal("interval"), everyMinutes: v.number() }),
  v.object({ kind: v.literal("daily"), times: v.array(v.string()) }),
  v.object({ kind: v.literal("weekly"), days: v.array(day), time: v.string() }),
);
export type Schedule = Infer<typeof scheduleValidator>;
export type Day = (typeof DAYS)[number];

export const notifyValidator = v.union(v.literal("great"), v.literal("good"), v.literal("all"));
export type Notify = Infer<typeof notifyValidator>;
export const MIN_SCORE: Record<Notify, number> = { great: 8, good: 6, all: 0 };
/** What each notify level means, in plain words: shown right under the choice. Each listing is scored 0–10. */
export const NOTIFY_HELP: Record<Notify, string> = {
  great: `Scores ${MIN_SCORE.great}–10: exactly what you asked for, at a good price. Fewest e-mails; a so-so deal won't reach you.`,
  good: `Scores ${MIN_SCORE.good}–10: also decent options, like an older model or a price near your limit. Catches the most real matches.`,
  all: "Every new listing that fits your filters, still scored with the reason, including accessories and look-alikes. Most e-mails, like Marktplaats' own saved search.",
};

export const NOTIFY_LABEL: Record<Notify, string> = {
  great: "great matches only",
  good: "good matches",
  all: "every new listing",
};

/** Short wording for places where the full picker help would be too long. */
export const NOTIFY_SHORT: Record<Notify, string> = {
  great: `listings scoring ${MIN_SCORE.great} or higher out of 10`,
  good: `listings scoring ${MIN_SCORE.good} or higher out of 10`,
  all: "all new listings that fit your filters, each still scored",
};

export function scoreLevel(score: number): "great" | "good" | "low" {
  return score >= MIN_SCORE.great ? "great" : score >= MIN_SCORE.good ? "good" : "low";
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Throws a plain-English error when the schedule is not one we support. */
export function checkSchedule(s: Schedule): void {
  if (s.kind === "interval") {
    if (!(INTERVALS as readonly number[]).includes(s.everyMinutes))
      throw new ConvexError("Pick one of: every 15 or 30 minutes, every 1, 3, 6 or 12 hours.");
  } else if (s.kind === "daily") {
    if (s.times.length < 1 || s.times.length > 4) throw new ConvexError("Pick 1 to 4 times a day.");
    if (!s.times.every((t) => HHMM.test(t))) throw new ConvexError("Times look like 08:00.");
  } else {
    if (s.days.length < 1) throw new ConvexError("Pick at least one day.");
    if (!HHMM.test(s.time)) throw new ConvexError("Times look like 08:00.");
  }
}

// --- time zone maths without a library: Intl gives the wall-clock parts in Europe/Amsterdam ---
function wallClock(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

function offsetMs(ms: number, tz: string) {
  const w = wallClock(ms, tz);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.min, w.s) - Math.floor(ms / 1000) * 1000;
}

/** The UTC instant of a wall-clock time in `tz` (a time skipped by the DST switch moves an hour on). */
export function zonedToUtc(y: number, m: number, d: number, h: number, min: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ms = guess - offsetMs(guess, tz);
  ms = guess - offsetMs(ms, tz);
  return ms;
}

/** When the watch should be checked next, strictly after `from` (ms since epoch). */
export function nextRun(s: Schedule, from: number, tz: string = TIMEZONE): number {
  if (s.kind === "interval") return from + s.everyMinutes * 60_000;
  const times = s.kind === "daily" ? s.times : [s.time];
  const today = wallClock(from, tz);
  let best = Infinity;
  for (let offset = 0; offset <= 7; offset++) {
    const date = new Date(Date.UTC(today.y, today.m - 1, today.d + offset));
    const weekday = DAYS[(date.getUTCDay() + 6) % 7];
    if (s.kind === "weekly" && !s.days.includes(weekday)) continue;
    for (const t of times) {
      const [h, min] = t.split(":").map(Number);
      const at = zonedToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), h, min, tz);
      if (at > from && at < best) best = at;
    }
    if (best !== Infinity) break;
  }
  return best;
}

const DAY_NAME: Record<Day, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

function list(items: string[]) {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** The schedule in plain English: "every 3 hours", "every Monday and Friday at 18:00". */
export function describe(s: Schedule): string {
  if (s.kind === "interval") {
    if (s.everyMinutes < 60) return `every ${s.everyMinutes} minutes`;
    if (s.everyMinutes === 60) return "every hour";
    if (s.everyMinutes === 720) return "twice a day (every 12 hours)";
    return `every ${s.everyMinutes / 60} hours`;
  }
  if (s.kind === "daily") return `every day at ${list([...s.times].sort())}`;
  const days = DAYS.filter((d) => s.days.includes(d));
  if (days.length === 7) return `every day at ${s.time}`;
  if (days.join() === "mon,tue,wed,thu,fri") return `every weekday at ${s.time}`;
  if (days.join() === "sat,sun") return `every Saturday and Sunday at ${s.time}`;
  return `every ${list(days.map((d) => DAY_NAME[d]))} at ${s.time}`;
}

/** "today at 14:00", "tomorrow at 08:00", "Fri 3 Oct at 18:00" in the watch's time zone. */
export function describeWhen(ms: number, now: number, tz: string = TIMEZONE): string {
  const w = wallClock(ms, tz), n = wallClock(now, tz);
  const hhmm = `${String(w.h).padStart(2, "0")}:${String(w.min).padStart(2, "0")}`;
  const dayDiff = Math.round((Date.UTC(w.y, w.m - 1, w.d) - Date.UTC(n.y, n.m - 1, n.d)) / 86_400_000);
  if (dayDiff === 0) return `today at ${hhmm}`;
  if (dayDiff === 1) return `tomorrow at ${hhmm}`;
  if (dayDiff === -1) return `yesterday at ${hhmm}`;
  const label = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" })
    .format(new Date(ms));
  return `${label} at ${hhmm}`;
}
