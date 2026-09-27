import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// App paths ("/c/<chatId>", "/w/<watchId>", "/watches", "/alerts", "/archived") <-> real, statically exported URLs
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
  if (page === "watches" || page === "alerts" || page === "archived") return { section: page };
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
