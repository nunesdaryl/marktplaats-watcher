// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { go } from "../lib/router.js";
import Sidebar from "./Sidebar.jsx";

vi.mock("convex/react", () => ({ useQuery: () => [], useMutation: () => vi.fn() }));
vi.mock("../lib/router.js", () => {
  const go = vi.fn();
  return { go, linkTo: (path) => ({ href: path, onClick: (event) => { event.preventDefault(); go(path); } }) };
});
vi.mock("./AccountButton.jsx", () => ({
  default: ({ sidebar, email, onPrivacy }) => <button aria-label="Account menu" data-sidebar={sidebar} data-privacy={!!onPrivacy}>{email}</button>,
}));
vi.stubGlobal("React", React);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.mocked(go).mockClear());

const sidebarProps = {
  route: { section: "" }, watches: [], watchesLoaded: true, archivedWatchCount: 0, chats: [], email: "a@example.com",
  actions: {}, renaming: null, setRenaming: vi.fn(), onNewWatch: vi.fn(), onPrivacy: vi.fn(),
  onFeedback: vi.fn(), openSheet: vi.fn(), toast: vi.fn(), isOwner: false, newAlerts: 0,
};

async function clickSidebar(props, selector) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Sidebar {...sidebarProps} {...props} />));
    await act(async () => host.querySelector(selector).click());
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
}

test("desktop account row offers one labelled menu target", () => {
  const email = "a-very-long-email-address@example.com";
  const html = renderToStaticMarkup(<Sidebar
    route={{ section: "" }} watches={[]} chats={[]} email={email} actions={{}}
    renaming={null} setRenaming={vi.fn()} onNewWatch={vi.fn()} onPrivacy={vi.fn()}
    onFeedback={vi.fn()} openSheet={vi.fn()} toast={vi.fn()} isOwner={false} newAlerts={0}
  />);
  const account = html.slice(html.indexOf('class="account"'));
  expect(account).toContain(`aria-label="Account menu" data-sidebar="true" data-privacy="true">${email}</button>`);
  expect(account).not.toContain('aria-label="Archived"');
});

test("first-use sidebar explains watches and offers one create action", () => {
  const onNewWatch = vi.fn();
  const props = { route: { section: "" }, watches: [], watchesLoaded: true, chats: [], email: "a@example.com",
    actions: {}, renaming: null, setRenaming: vi.fn(), onNewWatch, onPrivacy: vi.fn(),
    onFeedback: vi.fn(), openSheet: vi.fn(), toast: vi.fn(), isOwner: false, newAlerts: 0 };
  const html = renderToStaticMarkup(<Sidebar {...props} />);
  expect(html).toContain("Your watches appear here after you create them.");
  expect(html.match(/Create a watch/g)).toHaveLength(1);
  expect(html).not.toContain('aria-label="New watch"');
});

test("populated sidebar keeps its existing new-watch control", () => {
  const html = renderToStaticMarkup(<Sidebar
    route={{ section: "" }} watches={[{ _id: "w1", title: "Mac mini", active: true, summary: "Under €300" }]}
    watchesLoaded chats={[]} email="a@example.com" actions={{ watchItems: () => [] }}
    renaming={null} setRenaming={vi.fn()} onNewWatch={vi.fn()} onPrivacy={vi.fn()}
    onFeedback={vi.fn()} openSheet={vi.fn()} toast={vi.fn()} isOwner={false} newAlerts={0}
  />);
  expect(html).toContain('aria-label="New watch"');
  expect(html).not.toContain("Create a watch");
});

test("Watches top navigation opens the list and highlights list and watch pages", async () => {
  const html = renderToStaticMarkup(<Sidebar {...sidebarProps} route={{ section: "watches" }} />);
  const nav = html.match(/<button[^>]*aria-current="page"[^>]*>.*?Watches<\/button>/s)?.[0];
  expect(nav).toContain('class="nav-item active"');
  expect(renderToStaticMarkup(<Sidebar {...sidebarProps} route={{ section: "w", id: "w1" }} />)).toContain('aria-current="page"');
  await clickSidebar({}, ".sidebar-top > button:nth-of-type(3)");
  expect(go).toHaveBeenCalledWith("/watches");
  await clickSidebar({}, '.nav-section-link[href="/watches"]');
  expect(go).toHaveBeenCalledWith("/watches");
});

test("Archived row appears only for archived watches, with the right count and destination", async () => {
  expect(renderToStaticMarkup(<Sidebar {...sidebarProps} />)).not.toContain("Archived (");
  const html = renderToStaticMarkup(<Sidebar {...sidebarProps} archivedWatchCount={2} />);
  expect(html).toContain("Archived (2)");
  await clickSidebar({ archivedWatchCount: 2 }, ".nav-item.archive-item");
  expect(go).toHaveBeenCalledWith("/archived");
});
