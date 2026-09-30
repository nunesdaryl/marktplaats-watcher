// Serialized into the root layout so chunk failures can be caught before the app loads.
export function installChunkRecovery(win, doc) {
  const key = "mw-chunk-reload-at";
  const within = 60_000;

  function showReload() {
    const render = () => {
      if (doc.getElementById("mw-chunk-reload")) return;
      const notice = doc.createElement("div");
      notice.id = "mw-chunk-reload";
      notice.setAttribute("role", "alert");
      notice.style.cssText = "position:fixed;z-index:2147483647;bottom:16px;left:16px;right:16px;max-width:420px;margin:auto;padding:12px 16px;background:#1b1a18;color:#f4f2ee;border-radius:8px;font:14px system-ui,sans-serif;box-shadow:0 4px 20px #0004";
      notice.append("A new version is available. ");
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = "Reload";
      button.style.cssText = "margin-left:8px;padding:4px 10px;cursor:pointer";
      button.addEventListener("click", () => win.location.reload());
      notice.append(button);
      doc.body.append(notice);
    };
    if (doc.body) render();
    else doc.addEventListener("DOMContentLoaded", render, { once: true });
  }

  function recover(error) {
    const name = error?.name ?? "";
    const message = String(error?.message ?? error ?? "");
    if (name !== "ChunkLoadError" && !/Loading chunk .* failed|Failed to load chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(message)) return false;

    const now = Date.now();
    try {
      const previous = Number(win.sessionStorage.getItem(key));
      if (previous && now - previous >= 0 && now - previous < within) {
        showReload();
      } else {
        win.sessionStorage.setItem(key, String(now));
        win.location.reload();
      }
    } catch {
      // If storage is unavailable, a manual reload avoids an automatic loop.
      showReload();
    }
    return true;
  }

  win.__mwRecoverChunkLoad = recover;
  win.addEventListener("error", (event) => { if (!recover(event.error)) recover(event.message); });
  win.addEventListener("unhandledrejection", (event) => recover(event.reason));
}

export const chunkRecoveryScript = `(${installChunkRecovery.toString()})(window,document)`;
