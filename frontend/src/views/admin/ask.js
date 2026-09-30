import { dateFilters } from "./nav.js";

const midnight = (day) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T12:00:00Z`))) {
    throw new Error("I couldn't understand the date. Try asking with a specific day.");
  }
  return dateFilters({ when: "today" }, Date.parse(`${day}T12:00:00Z`)).since;
};

export function intentToDrill(intent, users, watches) {
  if (intent.view === "overview") return null;
  const params = {};
  if (intent.userEmail) {
    const user = users.find((u) => u.email.toLowerCase() === intent.userEmail.toLowerCase());
    if (!user) throw new Error("I couldn't find that account. Try the full e-mail address.");
    params.userId = user._id;
  }
  if (intent.watchLabel) {
    const matches = watches.filter((w) => (w.title ?? w.label).toLowerCase() === intent.watchLabel.toLowerCase()
      && (!params.userId || w.userId === params.userId));
    if (matches.length !== 1) throw new Error("I couldn't find one matching watch. Try its full name.");
    params.watchId = matches[0]._id;
  }
  if (intent.since) params.since = midnight(intent.since);
  if (intent.until) params.until = midnight(intent.until);
  if (intent.minScore != null) params.minScore = intent.minScore;
  if (intent.status) {
    const key = intent.view === "watches" && intent.status === "behind" ? "behind"
      : ["alerts", "catchups"].includes(intent.view) ? "emailStatus"
        : intent.view === "feedback" ? "handled" : intent.view === "users" ? "stage"
          : intent.view === "ratings" ? "verdict" : "status";
    params[key] = key === "behind" ? "yes" : intent.status;
  }
  if (intent.kind) params[intent.view === "events" ? "name" : "kind"] = intent.kind;
  if (intent.text) params.q = intent.text;
  return { view: intent.view, title: intent.title, params };
}
