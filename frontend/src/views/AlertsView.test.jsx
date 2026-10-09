import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import AlertsView from "./AlertsView.jsx";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn() }));
vi.mock("../components/OfferSheet.jsx", () => ({ default: ({ listing }) => <div data-offer-for={listing._id} /> }));
vi.mock("react", async (original) => ({ ...await original(), useEffect: vi.fn((effect) => effect()),
  useRef: vi.fn(), useState: vi.fn() }));
vi.stubGlobal("React", React);

const alert = (id, createdAt) => ({ _id: id, title: id, url: "https://example.com", watchLabel: "Mac mini",
  createdAt, reason: "Match", score: 9 });
let responses;
let calls;
let marked;

beforeEach(() => {
  calls = 0;
  marked = vi.fn(() => Promise.resolve());
  responses = [[alert("Old", 100), alert("Fresh", 201)], {}, { alertsSeenAt: 200, createdAt: 50 }];
  vi.mocked(useQuery).mockImplementation(() => responses[calls++]);
  vi.mocked(useMutation).mockImplementation(() => marked);
  vi.mocked(useRef).mockImplementation((initial) => ({ current: initial }));
  vi.mocked(useState).mockImplementation((initial) => [initial, vi.fn()]);
});

afterEach(() => vi.useRealTimers());

test("the visit snapshot marks only later alerts new before clearing the tab count", () => {
  let readSeenAt = false;
  responses[2] = { get alertsSeenAt() { readSeenAt = true; return 200; }, createdAt: 50 };
  marked.mockImplementation(() => { expect(readSeenAt).toBe(true); return Promise.resolve(); });
  const html = renderToStaticMarkup(<AlertsView actions={{ archiveAlert: vi.fn(), archiveAllAlerts: vi.fn() }} />);
  expect(html.match(/class="alert-item is-new"/g)).toHaveLength(1);
  expect(html.match(/class="visually-hidden">, new<\/span>/g)).toHaveLength(1);
  expect(html).toContain('class="alert-new-pill" aria-hidden="true">New</span>');
  expect(html).toContain('aria-label="Archive alert" title="Archive alert"');
  expect(html).toContain('Archive all');
  expect(marked).toHaveBeenCalledTimes(1);
});

test("creation time is the first-visit fallback", () => {
  responses[2] = { createdAt: 150 };
  const html = renderToStaticMarkup(<AlertsView actions={{ archiveAlert: vi.fn(), archiveAllAlerts: vi.fn() }} />);
  expect(html.match(/class="alert-item is-new"/g)).toHaveLength(1);
});

test("an email offer link opens the sheet for its matching alert", () => {
  const html = renderToStaticMarkup(<AlertsView actions={{ archiveAlert: vi.fn(), archiveAllAlerts: vi.fn() }} offerId="Fresh" />);
  expect(html).toContain('data-offer-for="Fresh"');
  expect(html).not.toContain('data-offer-for="Old"');
});

test("first-use alerts explain when they appear and offer a watch action", () => {
  responses[0] = [];
  const onNewWatch = vi.fn();
  const html = renderToStaticMarkup(<AlertsView actions={{}} watches={[]} onNewWatch={onNewWatch} />);
  expect(html).toContain("When a watch finds a good new listing, its alert appears here and in your inbox.");
  expect(html.match(/Create a watch/g)).toHaveLength(1);
  expect(html).not.toContain("Archive all");
});

test("alerts without results do not offer another watch action when watches exist", () => {
  responses[0] = [];
  const html = renderToStaticMarkup(<AlertsView actions={{}} watches={[{ _id: "w1" }]} onNewWatch={vi.fn()} />);
  expect(html).toContain("When a watch finds a good new listing");
  expect(html).not.toContain("Create a watch");
});

test("archive all asks on the first tap and runs only on the second", async () => {
  vi.useFakeTimers();
  const archiveAllAlerts = vi.fn(() => Promise.resolve());
  let confirm = false;
  let stateCall = 0;
  vi.mocked(useState).mockImplementation((initial) => {
    const first = stateCall++ % 3 === 1;
    return first ? [confirm, (value) => { confirm = value; }] : [initial, vi.fn()];
  });
  const actions = { archiveAlert: vi.fn(), archiveAllAlerts };
  const button = () => {
    calls = 0;
    return AlertsView({ actions }).props.children[0].props.children[0].props.children[1];
  };
  const first = button();
  expect(first.props.children).toBe("Archive all");
  await first.props.onClick();
  expect(archiveAllAlerts).not.toHaveBeenCalled();
  const second = button();
  expect(second.props.children).toBe("Archive all alerts?");
  await second.props.onClick();
  expect(archiveAllAlerts).toHaveBeenCalledTimes(1);
});

test("archive all confirmation resets after four seconds and on blur", async () => {
  vi.useFakeTimers();
  const archiveAllAlerts = vi.fn();
  let confirm = false;
  let stateCall = 0;
  vi.mocked(useState).mockImplementation((initial) => {
    const isConfirm = stateCall++ % 3 === 1;
    return isConfirm ? [confirm, (value) => { confirm = value; }] : [initial, vi.fn()];
  });
  const button = () => {
    calls = 0;
    return AlertsView({ actions: { archiveAlert: vi.fn(), archiveAllAlerts } }).props.children[0].props.children[0].props.children[1];
  };
  await button().props.onClick();
  expect(button().props.children).toBe("Archive all alerts?");
  vi.advanceTimersByTime(4000);
  expect(button().props.children).toBe("Archive all");
  await button().props.onClick();
  const armed = button();
  expect(armed.props.children).toBe("Archive all alerts?");
  armed.props.onBlur();
  expect(button().props.children).toBe("Archive all");
  expect(archiveAllAlerts).not.toHaveBeenCalled();
});
