import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import Overview from "./Overview.jsx";
import { useQuery } from "convex/react";
import { useRef, useState } from "react";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useAction: () => () => Promise.resolve(null) }));
vi.mock("react", async (importOriginal) => ({ ...await importOriginal(), useState: vi.fn(), useRef: vi.fn() }));
vi.stubGlobal("React", React);

const oldNow = Date.parse("2026-10-01T08:15:00Z");
const newNow = Date.parse("2026-10-01T08:47:00Z");
const dashboard = (now, users) => ({
  now, days: 30, totals: { users, newUsers7d: 0, active1d: 0, active7d: 0, active30d: 0,
    watchesActive: 0, watchesPaused: 0, watchesArchived: 0, watchesFallingBehind: 0,
    alerts7d: 0, alerts: 0, emailsFailed: 0, chats: 0, chatsToday: 0, feedback: 0 },
  health: { issues: [], stats: { runs: 0, checksFailed: 0, emailsSent: 0, errors: 0 } },
  fallingBehindLabels: [], errors24h: { chat: 0, check: 0 }, deliveryAudit: { checked: 0, misses: 0, lastRunAt: null, latestMisses: [] },
  latestErrors: [], daily: [{ day: "2026-10-01", active: 0, searches: 0, watchChats: 0, watches: 0, alerts: 0 }],
  funnel: ["Signed up", "Finished setup", "Chatted", "Saved a watch", "Got an alert"].map((step) => ({ step, count: 0 })), topUsage: [], features: [], pages: [], chatModes: [], devices: [], themes: [], schedules: [], notify: [], wouldPay: [],
});
const ratings = { rated: 0 };
let states;
let previous;
let renderCount;
let responses;
let queryCount;

function render() {
  renderCount = 0;
  const tree = Overview({ open: vi.fn(), onSearch: vi.fn() });
  const html = renderToStaticMarkup(tree);
  return { tree, html };
}

beforeEach(() => {
  states = [30, undefined];
  previous = { current: null };
  vi.mocked(useState).mockImplementation((initial) => {
    const index = renderCount++;
    return [states[index] ?? initial, (value) => { states[index] = value; }];
  });
  vi.mocked(useRef).mockImplementation(() => previous);
  responses = [dashboard(oldNow, 3), ratings, { rows: [] }];
  queryCount = 0;
  vi.mocked(useQuery).mockImplementation(() => responses[(queryCount++) % 3]);
});

test("the refresh icon reruns all three queries and keeps old figures until all return", () => {
  const first = render();
  expect(first.html).toContain('class="admin-refresh"');
  expect(first.html).toContain('class="icon-button"');
  expect(first.html).toContain('aria-label="Refresh (updated 10:15)" title="Refresh (updated 10:15)"');
  expect(first.html).toContain('<span class="hint" aria-live="polite">Updated 10:15</span>');
  expect(first.html).toContain('class="stat-value">3</span>');
  const refresh = first.tree.props.children[0].props.children[3].props.children[0];
  expect(refresh.props.children.props).toMatchObject({ name: "refresh", size: 18 });
  vi.spyOn(Date, "now").mockReturnValue(newNow);
  refresh.props.onClick();
  expect(states[1]).toBe(newNow);

  responses = [undefined, undefined, undefined];
  const waiting = render();
  expect(waiting.html).toContain('aria-label="Refreshing…" title="Refreshing…"');
  expect(waiting.html).toContain('<span class="hint" aria-live="polite">Refreshing…</span>');
  expect(waiting.html).toContain('aria-busy="true"');
  expect(waiting.html).toContain('class="stat-value">3</span>');
  expect(waiting.tree.props.children[0].props.children[3].props.children[0].props.disabled).toBe(true);
  expect(vi.mocked(useQuery).mock.calls.slice(-3).map(([, args]) => args.at)).toEqual([newNow, newNow, newNow]);

  responses = [dashboard(newNow, 4), undefined, { rows: [] }];
  expect(render().html).toContain('class="stat-value">3</span>');
  responses = [dashboard(newNow, 4), ratings, { rows: [] }];
  const done = render();
  expect(done.html).toContain('aria-label="Refresh (updated 10:47)" title="Refresh (updated 10:47)"');
  expect(done.html).toContain('<span class="hint" aria-live="polite">Updated 10:47</span>');
  expect(done.html).toContain('class="stat-value">4</span>');
  expect(done.tree.props.children[0].props.children[3].props.children[0].props.disabled).toBe(false);
  vi.restoreAllMocks();
});
