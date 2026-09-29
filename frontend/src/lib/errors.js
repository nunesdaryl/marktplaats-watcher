// The last few errors in this tab, sent along with feedback so a bug report comes with what went wrong.
const recent = [];

function remember(message) {
  if (!message) return;
  recent.push({ at: Date.now(), message: String(message).slice(0, 200) });
  if (recent.length > 5) recent.shift();
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => remember(e.message || e.error?.message));
  window.addEventListener("unhandledrejection", (e) => remember(e.reason?.message ?? e.reason));
}

export const recentErrors = () => recent.map((e) => `${new Date(e.at).toISOString().slice(11, 19)} ${e.message}`);
