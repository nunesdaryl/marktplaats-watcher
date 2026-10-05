import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import Sidebar, { forwardAccountClick } from "./Sidebar.jsx";

vi.mock("convex/react", () => ({ useQuery: () => [], useMutation: () => vi.fn() }));
vi.mock("./AccountButton.jsx", () => ({
  default: () => <button aria-label="Open user menu">Avatar</button>,
}));
vi.stubGlobal("React", React);

test("desktop account row keeps the Clerk button, email, chevron and separate actions", () => {
  const email = "a-very-long-email-address@example.com";
  const html = renderToStaticMarkup(<Sidebar
    route={{ section: "" }} watches={[]} chats={[]} email={email} actions={{}}
    renaming={null} setRenaming={vi.fn()} onNewWatch={vi.fn()} onPrivacy={vi.fn()}
    onFeedback={vi.fn()} openSheet={vi.fn()} toast={vi.fn()} isOwner={false} newAlerts={0}
  />);
  const account = html.slice(html.indexOf('class="account"'));
  const trigger = account.slice(0, account.indexOf('aria-label="Archived"'));
  expect(trigger).toContain('class="account-trigger"');
  expect(trigger).toContain('<button aria-label="Open user menu">Avatar</button>');
  expect(trigger).toContain(`class="email" data-private="true" aria-hidden="true">${email}</span>`);
  expect(trigger).toContain('class="account-chevron" aria-hidden="true"');
  expect(trigger).toContain('width="16" height="16"');
  expect(account).toContain('aria-label="Archived"');
  expect(account).toContain('aria-label="Privacy and your data"');
});

test("clicking the email or chevron forwards to Clerk's button once", () => {
  const click = vi.fn();
  const button = { click };
  const trigger = { querySelector: vi.fn(() => button) };
  forwardAccountClick({ target: { closest: () => null } }, trigger);
  expect(trigger.querySelector).toHaveBeenCalledWith("button");
  expect(click).toHaveBeenCalledTimes(1);
  forwardAccountClick({ target: { closest: () => button } }, trigger);
  expect(click).toHaveBeenCalledTimes(1);
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
