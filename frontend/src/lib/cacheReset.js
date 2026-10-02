// Serialized into the root layout to clear browser caches left by earlier deployments.
export async function installCacheReset(win) {
  try {
    if (win.localStorage.getItem("mw-cache-reset") === "1") return;
    win.localStorage.setItem("mw-cache-reset", "1");
  } catch {
    // A blocked storage API must not prevent the purge request.
  }
  try {
    await win.fetch("/cache-reset.txt?v=1", { cache: "no-store" });
  } catch {
    // Network failures must not interrupt page loading.
  }
}

export const cacheResetScript = `(${installCacheReset.toString()})(window)`;
