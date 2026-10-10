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
let foundingResponse;
let signupSourcesResponse;
let emptyCount;

function render() {
  renderCount = 0;
  const open = vi.fn();
  const tree = Overview({ open, onSearch: vi.fn() });
  const html = renderToStaticMarkup(tree);
  return { tree, html, open };
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
  foundingResponse = undefined;
  signupSourcesResponse = undefined;
  emptyCount = 0;
  queryCount = 0;
  vi.mocked(useQuery).mockImplementation((_ref, args) => Object.keys(args).length === 0
    ? (emptyCount++ === 0 ? foundingResponse : signupSourcesResponse) : responses[(queryCount++) % 3]);
});

test("the first dashboard row opens the matching review lists", () => {
  const data = responses[0];
  data.health.stats.checksFailed = 2;
  data.totals.watchesFallingBehind = 3;
  data.deliveryAudit = { ...data.deliveryAudit, misses: 4, lastRunAt: oldNow - 1000 };
  const { tree, html, open } = render();
  expect(html).toContain("Needs your attention");
  expect(html.indexOf("Needs your attention")).toBeLessThan(html.indexOf('class="health '));
  const row = html.match(/<section class="attention"[\s\S]*?<\/section>/)?.[0];
  expect(row).toContain('class="stat-value">2</span>');
  expect(row).toContain('class="stat-value">3</span>');
  expect(row).toContain('class="stat-value">4</span>');
  const summary = tree.props.children.find((child) => child?.props?.className === "attention");
  const buttons = summary.props.children[1].props.children;
  expect(buttons).toHaveLength(4);
  buttons.forEach((button) => button.props.onClick());
  expect(open.mock.calls).toEqual([
    [{ view: "runs", title: "Checks failed", params: { since: oldNow - 24 * 60 * 60 * 1000, status: "failed" } }, { fresh: true }],
    [{ view: "watches", title: "Watches falling behind", params: { status: "active", behind: "yes" } }, { fresh: true }],
    [{ view: "audits", title: "Delivery audit", params: { since: oldNow - 1000 } }, { fresh: true }],
    [{ view: "feedback", title: "Replies waiting", params: { status: "shipped" } }, { fresh: true }],
  ]);
});

test("owner overview shows sign-up source and language groups", () => {
  signupSourcesResponse = { sources: [{ source: "linkedin", medium: "post", campaign: "launch", count: 2 }],
    languages: [{ language: "nl", count: 2 }] };
  const { html } = render();
  expect(html).toContain("linkedin / post / launch");
  expect(html).toContain("nl: <strong>2</strong>");
});

test("the attention row names every zero state without adding a query", () => {
  const { html } = render();
  const row = html.match(/<section class="attention"[\s\S]*?<\/section>/)?.[0];
  expect(row).toBeDefined();
  expect(row).toContain("0</span>");
  expect(row.match(/Nothing to review/g)).toHaveLength(2);
  expect(row).toContain("No audit run yet");
  expect(vi.mocked(useQuery)).toHaveBeenCalledTimes(6);
  responses[0].deliveryAudit.lastRunAt = oldNow - 1000;
  const audited = render().html.match(/<section class="attention"[\s\S]*?<\/section>/)?.[0];
  expect(audited.match(/Nothing to review/g)).toHaveLength(3);
  expect(audited).not.toContain("No audit run yet");
});

test("listings removed chart displays the summed paid and shop counts", () => {
  responses[0].daily = [{ day: "2026-10-01", active: 0, searches: 0, watchChats: 0,
    watches: 0, alerts: 0, paidRemoved: 52, businessRemoved: 3 }];
  const { html } = render();
  expect(html).toContain('aria-label="Listings removed: 55 in 1 days"');
  expect(html).toContain('52 paid placements, 3 shops/dealers');
});

test("24-hour review shows the seller website flag numerator and inspected listing count", () => {
  responses[0].sellerSignal24h = { showWebsiteTrue: 5, sellerListingsChecked: 20, since: oldNow - 24 * 60 * 60 * 1000 };
  const { html } = render();
  expect(html).toContain("Seller website flag seen on 5 of 20 listings (since");
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
  expect(html).toContain("Apple Mac mini");
  expect(html).not.toContain("audit-rescored");
  expect(html).not.toContain("audit-unread");
  expect(html).not.toContain("audit-unscored");
  expect(html).not.toContain("audit-handled");
  expect(html).toContain('aria-label="Copy request ID"');
});

test("latest misses show audit dates, status, and the latest audit's new count", () => {
  const data = responses[0];
  data.deliveryAudit.misses = 1;
  data.deliveryAudit.latestMisses = [
    { watchId: "w1", listingId: "m1", requestId: "new", watchLabel: "Mac", title: "New title", score: 9, checkScore: 4, kind: "handled", reportedBefore: oldNow, at: oldNow + 2 * 24 * 60 * 60 * 1000, url: "https://www.marktplaats.nl/v/m1" },
    { watchId: "w1", listingId: "m1", requestId: "old", watchLabel: "Mac", title: "Old title", score: 8, kind: "handled", at: oldNow },
    { watchId: "w2", listingId: "m2", requestId: "other", watchLabel: "Other", title: "Other watch", score: 8, kind: "handled", at: oldNow + 2 * 24 * 60 * 60 * 1000 },
    { watchId: "w3", listingId: "m3", requestId: "earlier", watchLabel: "Earlier", title: "Earlier first report", score: 9, kind: "handled", at: oldNow },
  ];
  data.deliveryAudit.lastRunAt = oldNow + 2 * 24 * 60 * 60 * 1000;
  const { html, open, tree } = render();
  expect(html).toContain("Latest delivery misses (1 new)");
  expect(html).toMatch(/class="stat-value">1<\/span><span class="stat-name">Delivery misses/);
  expect(html).toContain('<th>Status</th><th>Audit date</th><th>Watch</th><th>Listing</th><th>Audit score</th><th>Check score</th>');
  expect(html).toContain("3 Oct 2026");
  expect(html).toContain("1 Oct 2026");
  expect(html).toContain('<td class="delivery-miss-new">new</td><td>3 Oct 2026</td>');
  expect(html).toContain("reported before 1 Oct 2026");
  expect(html).toContain('class="openable delivery-miss-reported"');
  expect(html).toContain('href="https://www.marktplaats.nl/v/m1"');
  expect(html).toContain('title="New title"');
  expect(html).toContain("New title");
  expect(html).toContain("Other watch");
  expect(html).not.toContain("Old title");
  // Only rows first reported by the latest audit say "new"; an older first report is dated and muted.
  expect(html.match(/class="delivery-miss-new">new<\/td>/g)).toHaveLength(1);
  expect(html).not.toMatch(/class="delivery-miss-new">(?:reported before|first reported)/);
  expect(html).toContain("first reported 1 Oct 2026");
  const panel = tree.props.children.find((child) => child?.props?.className === "panel delivery-misses");
  const row = panel.props.children[1].props.children.props.children[1].props.children[0];
  row.props.onClick();
  expect(open).toHaveBeenCalledWith({ view: "audits", title: "Delivery miss", params: { requestId: "new" } }, { fresh: true });
});

test("latest misses has a clean empty state", () => {
  expect(render().html).toContain("No delivery misses in the latest audit");
});

test("founding pay answers use breakdown bars and appear in one place", () => {
  foundingResponse = { n: 2, very: 1, percentVery: 50, paused: 0, extended: 0,
    prices: { no: 1, up_to_5: 2, "5_to_10": 0, over_10: 0 }, answers: [] };
  const { html } = render();
  expect(html).toContain("Would they be disappointed?");
  expect(html.match(/<h3>Would you pay\?<\/h3>/g)).toHaveLength(1);
  expect(html).toContain('class="breakdown-bar"');
  expect(html).toContain('class="breakdown-count">2<small>67%</small>');
  expect(html).not.toContain("Would you pay for this?");
  expect(html).toContain("App feedback: pricing");
  expect(html).toContain("See founding answers");
});

test("founding survey has a clean no-answers state", () => {
  foundingResponse = { n: 0, very: 0, percentVery: 0, paused: 0, extended: 0,
    prices: { no: 0, up_to_5: 0, "5_to_10": 0, over_10: 0 }, answers: [] };
  const html = render().html;
  expect(html).toContain("No answers yet");
  expect(html.match(/<h3>Would you pay\?<\/h3>/g)).toHaveLength(1);
});

test("shares below one percent stay visible and zero stays zero", () => {
  responses[1] = { rated: 1, ratedSent: 1, alertsSent: 250, fromEmail: 0,
    good: 0, notRight: 1, withNote: 0, goodCouldBeGreat: 0,
    bands: [], reasons: [], weeklyRatedShare: [{ week: "2026-09-28", sent: 250, rated: 1 }] };
  const { html } = render();
  expect(html).toContain("&lt;1% of 250 alerts e-mailed rated");
  expect(html).toContain('<td class="num">&lt;1%</td>');
  expect(html).toContain('class="stat-value">0%</span>');
});

test("the health issue copy icon copies the request ID and briefly confirms it", async () => {
  const data = dashboard(oldNow, 3);
  data.health.issues = [{ kind: "errors", severity: "high", headline: "1 error", count: 1,
    items: [{ label: "Check error", requestId: "check-123" }] }];
  responses[0] = data;
  const { tree, html } = render();
  expect(html).not.toContain("check-123");
  expect(html).toContain('title="Copy request ID" aria-label="Copy request ID"');
  const health = tree.props.children.find((child) => child?.props?.className === "health bad");
  const issueElement = health.props.children[2].props.children[0];
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

test("owner overview shows nurture delivery, link clicks and unsubscribes by step", () => {
  vi.stubGlobal("React", React);
  responses[0].nurture = {
    welcome: { sent: 4, openedLink: 2, unsubscribed: 1 },
    no_watch: { sent: 3, openedLink: 1, unsubscribed: 0 },
    first_alert: { sent: 2, openedLink: 1, unsubscribed: 0 },
    tips: { sent: 1, openedLink: 0, unsubscribed: 0 },
  };
  const { html } = render();
  expect(html).toContain("Onboarding emails");
  expect(html).toContain("Opened link");
  expect(html).toContain("Unsubscribed");
  expect(html).toMatch(/Welcome<\/th><td>4<\/td><td>2<\/td><td>1<\/td>/);
  expect(html).toContain("No tracking pixels");
});
