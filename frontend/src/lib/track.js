// Usage events for the owner dashboard (convex/events.ts): which features are used, never what anyone types.
// Events queue here and are sent in small batches by <Tracker/> (App.jsx), which holds the Convex mutation.
import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../../convex/_generated/api";

const queue = [];
let flushNow = null;

const device = () => (typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches ? "desktop" : "phone");
const short = (v) => (v === undefined || v === null ? undefined : String(v).slice(0, 40));

/** track("chat_sent", { mode: "watch" }). Props: section, mode, kind, value (short strings only). */
export function track(name, props = {}) {
  const clean = Object.fromEntries(["section", "mode", "kind", "value"]
    .map((k) => [k, short(props[k])]).filter(([, v]) => v !== undefined));
  queue.push({ name, props: Object.keys(clean).length ? clean : undefined, device: device(), at: Date.now() });
  if (queue.length > 100) queue.splice(0, queue.length - 100);   // signed out or offline: keep only the latest
  if (queue.length >= 20) flushNow?.();
}

/** A watch's schedule as a short label for the dashboard ("every 15 min", "daily", "weekly"). */
export const scheduleKind = (s) => !s ? undefined : s.kind === "interval"
  ? `every ${s.everyMinutes < 60 ? `${s.everyMinutes} min` : `${s.everyMinutes / 60} h`}` : s.kind;

/** Mounted once for signed-in users: sends the queue every 10 s and when the tab is hidden. */
export function Tracker() {
  const send = useMutation(api.events.track);
  useEffect(() => {
    let sending = false;
    flushNow = async () => {
      if (sending || !queue.length) return;
      sending = true;
      const batch = queue.splice(0, 20);
      try { await send({ events: batch }); } catch { /* analytics never gets in the way */ }
      sending = false;
    };
    const id = setInterval(() => flushNow(), 10_000);
    const onHide = () => { if (document.visibilityState === "hidden") flushNow(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onHide); flushNow = null; };
  }, [send]);
  return null;
}
