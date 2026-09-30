// Serialized into the root layout to clear browser caches left by earlier deployments.
export async function installCacheReset(win) {
  try {
    if (win.localStorage.getItem("mw-cache-reset") === "1") return;
    await win.fetch("/cache-reset.txt?v=1", { cache: "no-store" });
    win.localStorage.setItem("mw-cache-reset", "1");
  } catch {
    // Storage or network failures can be retried on the next page load.
  }
}

export const cacheResetScript = `(${installCacheReset.toString()})(window)`;
