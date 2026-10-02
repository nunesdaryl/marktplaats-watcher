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
