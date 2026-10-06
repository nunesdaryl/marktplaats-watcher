import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import Sidebar from "./Sidebar.jsx";

vi.mock("convex/react", () => ({ useQuery: () => [], useMutation: () => vi.fn() }));
vi.mock("./AccountButton.jsx", () => ({
  default: ({ sidebar, email, onPrivacy }) => <button aria-label="Account menu" data-sidebar={sidebar} data-privacy={!!onPrivacy}>{email}</button>,
}));
vi.stubGlobal("React", React);

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
