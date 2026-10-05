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
  vi.mocked(useQuery).mockImplementation((_ref, args) => Object.keys(args).length === 0 ? undefined : responses[(queryCount++) % 3]);
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
  expect(vi.mocked(useQuery).mock.calls.filter(([, args]) => args?.at === newNow).length).toBeGreaterThanOrEqual(3);

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

test("owner overview shows admitted places and the waitlist", () => {
  responses[0].totals.places = { cap: 100, taken: 37, left: 63 };
  responses[0].totals.waitlistCount = 4;
  const { html } = render();
  expect(html).toContain('class="stat-value">37/100</span>');
  expect(html).toContain('class="stat-name">Places');
  expect(html).toContain('class="stat-value">4</span><span class="stat-name">Waitlist');
});

test("OpenAI account warning appears with billing link and clears on recovery", () => {
  responses[0].openaiFailureKind = "credit_exhausted";
  const failed = render().html;
  expect(failed).toContain("OpenAI credit is empty");
  expect(failed).toContain("https://platform.openai.com/settings/organization/billing/overview");
  expect(failed).not.toContain("All good");
  responses[0].openaiFailureKind = null;
  const recovered = render().html;
  expect(recovered).not.toContain("OpenAI credit is empty");
  expect(recovered).toContain("All good");
});

test("delivery misses explain why each match was missed without showing request IDs", () => {
  const data = dashboard(oldNow, 3);
  const misses = [
    { requestId: "audit-rescored", listingId: "listing-1", label: "Mac mini", watchId: "watch-1", userId: "user-1", score: 10, checkScore: 2, kind: "rescored", title: "Apple Mac mini", url: "https://example.com/1" },
    { requestId: "audit-unread", listingId: "listing-2", label: "Mac mini", watchId: "watch-1", score: 8, kind: "never_read", title: "Other Mac mini" },
    { requestId: "audit-unscored", listingId: "listing-3", label: "Mac mini", watchId: "watch-1", score: 7, kind: "never_scored", title: "Third Mac mini" },
    { requestId: "audit-handled", listingId: "listing-4", label: "Mac mini", watchId: "watch-1", score: 9, kind: "handled", title: "Fourth Mac mini" },
  ];
  data.health.issues = [{ kind: "delivery_misses", severity: "high", headline: "4 missed matches on 1 watch", count: 4, items: misses }];
  data.deliveryAudit.latestMisses = misses.map((miss) => ({ ...miss, watchLabel: miss.label }));
  responses[0] = data;

  const { html } = render();
  expect(html).toContain("10/10</span><span class=\"health-meta\"> · check scored 2");
  expect(html).toContain("not read by the check");
  expect(html).toContain("not scored by the check");
  expect(html).toContain("scored but not sent");
  expect(html).toContain("Apple Mac mini · check scored 2");
  expect(html).not.toContain("audit-rescored");
  expect(html).not.toContain("audit-unread");
  expect(html).not.toContain("audit-unscored");
  expect(html).not.toContain("audit-handled");
  expect(html).toContain('aria-label="Copy request ID"');
});

test("the health issue copy icon copies the request ID and briefly confirms it", async () => {
  const data = dashboard(oldNow, 3);
  data.health.issues = [{ kind: "errors", severity: "high", headline: "1 error", count: 1,
    items: [{ label: "Check error", requestId: "check-123" }] }];
  responses[0] = data;
  const { tree, html } = render();
  expect(html).not.toContain("check-123");
  expect(html).toContain('title="Copy request ID" aria-label="Copy request ID"');
  const issueElement = tree.props.children[3].props.children[2].props.children[0];
  const issueTree = issueElement.type(issueElement.props);
  const copyElement = issueTree.props.children[1].props.children[0].props.children.at(-1);
  renderCount = 2;
  const button = copyElement.type(copyElement.props);
  expect(button.props.children.props).toMatchObject({ name: "copy", size: 14 });
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  await button.props.onClick({ stopPropagation: vi.fn() });
  expect(writeText).toHaveBeenCalledWith("check-123");
  renderCount = 2;
  expect(copyElement.type(copyElement.props).props.children.props.children).toBe("Copied");
  vi.unstubAllGlobals();
});
