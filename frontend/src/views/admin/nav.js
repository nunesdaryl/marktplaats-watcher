// Where the owner is in the dashboard, kept in the address (/admin/?view=user&id=…&trail=…), so the browser's Back
// button steps back, a reload keeps the view, and every drilldown can be bookmarked or shared with yourself.
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

const RESERVED = new Set(["view", "trail", "title"]);

/** The open drilldown, or null on the overview: { view, title, params, trail: [{ view, title, params }] }. */
export function useDrill() {
  const search = useSearchParams();
  const router = useRouter();
  const current = useMemo(() => {
    const view = search.get("view");
    if (!view) return null;
    const params = {};
    for (const [k, v] of search.entries()) if (!RESERVED.has(k)) params[k] = v;
    let trail = [];
    try { trail = JSON.parse(search.get("trail") ?? "[]"); } catch { trail = []; }
    return { view, title: search.get("title") ?? "", params, trail: Array.isArray(trail) ? trail : [] };
  }, [search]);

  const toUrl = (next, trail) => {
    const q = new URLSearchParams({ view: next.view, title: next.title ?? "" });
    for (const [k, v] of Object.entries(next.params ?? {})) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
    if (trail.length) q.set("trail", JSON.stringify(trail.slice(-6)));
    return `/admin/?${q}`;
  };

  /** Open a drilldown. From inside the panel it goes one level deeper (the current view joins the breadcrumbs). */
  const open = useCallback((next, { fresh = false } = {}) => {
    const trail = !current || fresh ? [] : [...current.trail, { view: current.view, title: current.title, params: current.params }];
    router.push(toUrl(next, trail));
  }, [current, router]);

  /** Jump back to a breadcrumb (index into the trail). */
  const crumb = useCallback((i) => {
    const target = current.trail[i];
    router.push(toUrl(target, current.trail.slice(0, i)));
  }, [current, router]);

  const close = useCallback(() => router.push("/admin/"), [router]);
  return { current, open, crumb, close };
}

// Small shared formatters (Amsterdam time, as in the rest of the app)
const TZ = "Europe/Amsterdam";
export const when = (t) => (t ? new Date(t).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
export const dayLabel = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" });
export const euro = (n) => (n === undefined || n === null ? "–" : `€${n}`);
export const DAY = 86_400_000;
export const dayRange = (day) => { const since = Date.parse(`${day}T00:00:00Z`); return { since, until: since + DAY }; };

// Names of usage events and pages, in plain words
const LABELS = {
  page_view: "Page views", chat_sent: "Chat messages", chip_clicked: "Suggestion chips", watch_saved: "Watches saved",
  watch_paused: "Watches paused", watch_resumed: "Watches resumed", watch_deleted: "Watches deleted",
  watch_archived: "Watches archived", alert_opened: "Alerts opened", listing_opened: "Listings opened",
  feedback_opened: "Feedback opened", feedback_sent: "Feedback sent", theme_changed: "Theme switched",
  onboarding_done: "Setup finished", history_opened: "Chat history opened",
  "": "Chat", c: "A chat", w: "A watch", watches: "Watches", alerts: "Alerts", archived: "Archived", admin: "Dashboard", chat: "New chat",
};
export const label = (name) => LABELS[name] ?? name;
