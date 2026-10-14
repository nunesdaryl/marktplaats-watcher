import { useEffect, useRef } from "react";
import { track } from "../../lib/track.js";

const queries = ["admin.dashboard", "admin.ratingStats", "admin.feedback", "founding.ownerSummary", "admin.signupSources"];

/** One measurement per overview mount. A cached result counts as arriving when the overview opens. */
export function useDashboardLoadTiming(results, navigationStartedAt) {
  const timing = useRef(null);
  if (timing.current === null) timing.current = { start: navigationStartedAt ?? performance.now(), arrived: {}, sent: false };
  const values = queries.map((name) => results[name]);
  useEffect(() => {
    const current = timing.current;
    if (current.sent) return;
    const elapsed = Math.max(0, Math.round(performance.now() - current.start));
    queries.forEach((name, i) => {
      if (values[i] !== undefined && values[i] !== null && current.arrived[name] === undefined) current.arrived[name] = elapsed;
    });
    if (queries.some((name) => current.arrived[name] === undefined)) return;
    current.sent = true;
    const slowest = queries.reduce((name, next) => current.arrived[next] > current.arrived[name] ? next : name);
    track("dashboard_loaded", {
      first_ms: String(Math.min(...Object.values(current.arrived))),
      all_ms: String(Math.max(...Object.values(current.arrived))),
      slowest,
    });
  }, values);
}
