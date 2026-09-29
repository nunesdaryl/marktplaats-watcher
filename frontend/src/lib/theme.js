// Light/dark: follows the device until the sun/moon button picks one, remembered on this device only.
import { useCallback, useEffect, useState } from "react";
import { THEME_KEY } from "./boot.js";
import { useMediaQuery } from "./router.js";

export const THEME_COLOR = { light: "#fbfaf7", dark: "#151412" };   // --bg, for the browser bar

/** pref: "system" | "light" | "dark" -> the theme actually shown. */
export function resolveTheme(pref, systemDark) {
  if (pref === "light" || pref === "dark") return pref;
  return systemDark ? "dark" : "light";
}

function readPref() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

const listeners = new Set();
let pref = typeof window === "undefined" ? "system" : readPref();

function setPref(next) {
  pref = next;
  try {
    if (next === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, next);
  } catch {}
  const root = document.documentElement;
  if (next === "system") delete root.dataset.theme;
  else root.dataset.theme = next;
  listeners.forEach((fn) => fn(next));
}

/** { theme, pref, toggle, reset }: toggle flips light <-> dark, reset follows the device again. */
export function useTheme() {
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const [current, setCurrent] = useState(pref);
  useEffect(() => {
    listeners.add(setCurrent);
    return () => listeners.delete(setCurrent);
  }, []);
  const theme = resolveTheme(current, systemDark);
  useEffect(() => {
    // One browser-bar colour for the chosen theme (the layout's media-based pair only knows the device setting)
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLOR[theme]));
  }, [theme]);
  const toggle = useCallback(() => setPref(theme === "dark" ? "light" : "dark"), [theme]);
  const reset = useCallback(() => setPref("system"), []);
  return { theme, pref: current, toggle, reset };
}
