// @vitest-environment jsdom
import * as React from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import Overview from "./Overview.jsx";
import { Runs } from "./Views.jsx";

const loadVisitors = () => Promise.resolve(null);
vi.mock("convex/react", async (importOriginal) => ({ ...await importOriginal(), useQuery: vi.fn(), useAction: () => loadVisitors }));
vi.stubGlobal("React", React);

const dashboard = {
  now: Date.parse("2026-10-07T10:00:00Z"), days: 30,
  totals: { users: 0, newUsers7d: 0, active1d: 0, active7d: 0, active30d: 0,
    watchesActive: 0, watchesPaused: 0, watchesArchived: 0, watchesFallingBehind: 0,
    alerts7d: 0, alerts: 0, emailsFailed: 0, chats: 0, chatsToday: 0, feedback: 0 },
  health: { issues: [], stats: { runs: 0, checksFailed: 0, emailsSent: 0, errors: 0 } },
  fallingBehindLabels: [], errors24h: { chat: 0, check: 0 },
  deliveryAudit: { checked: 0, misses: 0, lastRunAt: null, latestMisses: [] }, latestErrors: [],
  daily: [{ day: "2026-10-07", active: 0, searches: 0, watchChats: 0, watches: 0, alerts: 0 }],
  funnel: ["Signed up", "Finished setup", "Chatted", "Saved a watch", "Got an alert"].map((step) => ({ step, count: 0 })),
  topUsage: [], features: [], pages: [], chatModes: [], devices: [], themes: [], schedules: [], notify: [], wouldPay: [],
};

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

test("an open relative-date drilldown keeps one query over 60 simulated minutes", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const base = Date.parse("2026-10-07T10:00:00Z");
  let now = base;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  const container = document.createElement("div");
  document.body.append(container);
  const queryKeys = new Set();
  const runsKeys = new Set();
  const activeQueries = new Set();
  const samples = [];
  const listeners = new Set();
  const intervals = new Set();
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  const set = globalThis.setInterval;
  const clear = globalThis.clearInterval;
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    listeners.add(listener);
    return add.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    listeners.delete(listener);
    return remove.call(this, type, listener, options);
  };
  globalThis.setInterval = (...args) => { const id = set(...args); intervals.add(id); return id; };
  globalThis.clearInterval = (id) => { intervals.delete(id); return clear(id); };
  const root = createRoot(container);
  vi.mocked(useQuery).mockImplementation((query, args) => {
    const name = getFunctionName(query);
    const key = `${name}:${JSON.stringify(args)}`;
    if (name === "admin:runs") runsKeys.add(key);
    React.useEffect(() => { activeQueries.add(key); return () => activeQueries.delete(key); }, [key]);
    if (name === "admin:dashboard") return dashboard;
    if (name === "admin:ratingStats") return { rated: 0 };
    if (name === "admin:feedback") return { rows: [] };
    if (name === "admin:runs") return { rows: [], more: false };
    return undefined;
  });

  try {
    for (let minute = 0; minute <= 60; minute++) {
      now = base + minute * 60_000;
      await act(async () => root.render(createElement(React.Fragment, null,
        createElement(Overview, { open: () => {}, onSearch: () => {} }),
        createElement(Runs, { params: { when: "7d" }, open: () => {}, update: () => {} }))));
      for (const [query, args] of vi.mocked(useQuery).mock.calls) queryKeys.add(`${getFunctionName(query)}:${JSON.stringify(args)}`);
      globalThis.gc?.();
      samples.push({ minute, heapBytes: process.memoryUsage().heapUsed, nodes: container.querySelectorAll("*").length,
        listeners: listeners.size, intervals: intervals.size, uniqueQueries: queryKeys.size, activeQueries: activeQueries.size });
    }
    if (process.env.MW99_PROFILE) console.log(JSON.stringify({ gcAvailable: typeof globalThis.gc === "function", samples }));

    expect(samples[60].nodes).toBeLessThanOrEqual(samples[0].nodes * 1.1);
    // Heap is recorded (MW99_PROFILE) but not asserted: garbage-collection timing makes it flaky across machines.
    expect(samples[60].listeners).toBe(samples[0].listeners);
    expect(samples[60].intervals).toBe(samples[0].intervals);
    expect(samples.every((sample) => sample.activeQueries === samples[0].activeQueries)).toBe(true);
    expect(runsKeys.size).toBe(1);
    expect(queryKeys.size).toBe(samples[0].uniqueQueries);

    await act(async () => root.render(createElement(Runs, { params: { when: "30d" }, open: () => {}, update: () => {} })));
    expect(runsKeys.size).toBe(2);
    now = Date.parse("2026-10-07T21:59:00Z");
    await act(async () => root.render(createElement(Runs, { params: { when: "today" }, open: () => {}, update: () => {} })));
    now += 60_000; // Amsterdam midnight
    await act(async () => root.render(createElement(Runs, { params: { when: "today" }, open: () => {}, update: () => {} })));
    expect(runsKeys.size).toBe(4);
  } finally {
    await act(async () => root.unmount());
    EventTarget.prototype.addEventListener = add;
    EventTarget.prototype.removeEventListener = remove;
    globalThis.setInterval = set;
    globalThis.clearInterval = clear;
  }
});
