// A picture of the page someone was on when they opened "Give feedback", so a bug report shows what they saw.
// Anything marked data-private (their e-mail address) is blanked out in the copy before it's drawn.
import { domToBlob } from "modern-screenshot";
import { resolveTheme } from "./theme.js";

// Scrolling areas: the copy starts at the top, so shift their content to where the person had scrolled
const SCROLLERS = ".main, .sidebar";
const STICKY = ".beta-strip, .topbar";

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

export async function capturePage({ timeoutMs = 2500 } = {}) {
  const body = document.body;
  const width = window.innerWidth;
  const offsets = [...document.querySelectorAll(SCROLLERS)].map((el) => el.scrollTop);
  const capture = domToBlob(body, {
    type: "image/jpeg", quality: 0.7, scale: Math.min(1, 1280 / width),
    width, height: window.innerHeight,
    backgroundColor: getComputedStyle(body).backgroundColor,
    timeout: 1500,
    fetch: { placeholderImage: PIXEL },   // listing photos from other sites may not be copyable
    filter: (node) => !(node instanceof Element && node.matches("dialog, .toast, .cl-userButtonPopoverCard")),
    onCloneNode: (root) => {
      if (!(root instanceof Element)) return;
      root.querySelectorAll(SCROLLERS).forEach((el, i) => {
        const y = offsets[i];
        if (!y) return;
        el.style.overflow = "hidden";
        for (const child of el.children) if (!child.matches(STICKY)) child.style.transform = `translateY(-${y}px)`;
      });
    },
    onCloneEachNode: (node) => {
      if (node instanceof HTMLElement && node.hasAttribute("data-private")) {
        node.textContent = "••••••••••";
        node.style.background = "rgba(128,128,128,.35)";
        node.style.color = "transparent";
        node.style.borderRadius = "4px";
      }
    },
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
  try {
    const blob = await Promise.race([capture, timeout]);
    return blob && blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/** Where and on what the feedback was sent from; ids in the address are left out. */
export function feedbackContext() {
  const ua = navigator.userAgent;
  const found = [["Edge", /Edg\/(\d+)/], ["Firefox", /Firefox\/(\d+)/], ["Chrome", /Chrome\/(\d+)/], ["Safari", /Version\/(\d+).*Safari/]]
    .map(([name, re]) => [name, re.exec(ua)]).find(([, m]) => m);
  const browser = found ? `${found[0]} ${found[1][1]}` : "Other browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : "other";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const chosen = document.documentElement.dataset.theme;
  return {
    path: window.location.pathname,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    device: window.matchMedia("(min-width: 900px)").matches ? "desktop" : "phone",
    theme: resolveTheme(chosen ?? "system", window.matchMedia("(prefers-color-scheme: dark)").matches),
    version: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || undefined,
    browser: `${browser} on ${os}${standalone ? " (home-screen app)" : ""}`,
  };
}
