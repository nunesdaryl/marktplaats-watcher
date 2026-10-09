import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// App paths ("/c/<chatId>", "/w/<watchId>", "/watches", "/alerts", "/archived", "/admin") <-> real, statically exported URLs
// ("/chat/?id=…", "/watch/?id=…", "/watches/", "/alerts/", "/archived/"). Ids travel as query parameters, so every page
// exists as a static file and a reload or shared link always works.
const TO_URL = { c: (id) => `/chat/?id=${encodeURIComponent(id)}`, w: (id) => `/watch/?id=${encodeURIComponent(id)}` };

export function toUrl(path) {
  const [, section = "", id] = path.split("/");
  if (TO_URL[section] && id) return TO_URL[section](id);
  return section ? `/${section}/` : "/";
}

export function useRoute() {
  const pathname = usePathname();
  const params = useSearchParams();
  const page = pathname.replace(/^\/|\/$/g, "");
  const id = params.get("id") ?? undefined;
  if (page === "chat" && id) return { section: "c", id };
  if (page === "watch" && id) return { section: "w", id };
  if (page === "alerts") return { section: page, offerId: params.get("offer") ?? undefined };
  if (page === "watches" || page === "archived" || page === "admin" || page === "rate") return { section: page };
  return { section: "" };
}

let navigate = null;

/** Hands Next.js' router to go(), so plain event handlers can navigate. */
export function RouterBridge() {
  const router = useRouter();
  useEffect(() => { navigate = (url) => router.push(url); }, [router]);
  return null;
}

export function go(path) {
  const url = toUrl(path);
  if (navigate) navigate(url);
  else window.location.assign(url);
}

/** Props for a real link to an app path: a plain click stays in the app (same tab); Cmd/Ctrl/Shift-click or a
 * middle click still opens a new tab or window, as people expect from a link. */
export function linkTo(path, onPlainClick) {
  return {
    href: toUrl(path),
    onClick: (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      (onPlainClick ?? (() => go(path)))();
    },
  };
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
