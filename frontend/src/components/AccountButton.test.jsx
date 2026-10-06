import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import AccountButton, { accountMenuItems } from "./AccountButton.jsx";

vi.mock("@clerk/clerk-react", () => ({
  useClerk: () => ({ session: { id: "session-1" }, openUserProfile: vi.fn(), signOut: vi.fn() }),
  useUser: () => ({ user: { imageUrl: "https://example.com/avatar.png" } }),
}));
vi.mock("../lib/theme.js", () => ({ useTheme: () => ({ pref: "system", reset: vi.fn() }) }));
vi.mock("../lib/router.js", () => ({ go: vi.fn() }));
vi.mock("../lib/track.js", () => ({ track: vi.fn() }));
vi.stubGlobal("React", React);

test("account choices include descriptions and keep Clerk profile and active-session sign-out", () => {
  const clerk = { session: { id: "session-1" }, openUserProfile: vi.fn(), signOut: vi.fn() };
  const onPrivacy = vi.fn();
  const items = accountMenuItems({ clerk, onPrivacy, showArchive: true, pref: "system", reset: vi.fn() });
  expect(items.map(({ label }) => label)).toEqual(["Manage account", "Privacy and your data", "Archived", "Sign out"]);
  expect(items.every(({ description }) => !!description)).toBe(true);
  items[0].action();
  items[1].action();
  items[3].action();
  expect(clerk.openUserProfile).toHaveBeenCalledOnce();
  expect(onPrivacy).toHaveBeenCalledOnce();
  expect(clerk.signOut).toHaveBeenCalledWith("session-1");
});

test("device theme reset appears only after a manual theme choice", () => {
  const clerk = { signOut: vi.fn(), openUserProfile: vi.fn() };
  const reset = vi.fn();
  const system = accountMenuItems({ clerk, pref: "system", reset, showArchive: false });
  expect(system.map(({ label }) => label)).toEqual(["Manage account", "Sign out"]);
  const manual = accountMenuItems({ clerk, pref: "dark", reset, showArchive: false });
  const theme = manual.find(({ label }) => label === "Match device theme");
  expect(theme.description).toContain("device's light or dark mode");
  theme.action();
  expect(reset).toHaveBeenCalledOnce();
});

test("sidebar account trigger is one keyboard and screen-reader target", () => {
  const html = renderToStaticMarkup(<AccountButton sidebar email="person@example.com" onPrivacy={vi.fn()} />);
  expect(html).toContain('aria-label="Account menu" aria-haspopup="menu" aria-expanded="false"');
  expect(html).toContain('class="email" data-private="true" aria-hidden="true">person@example.com');
  expect(html).toContain('class="account-chevron" aria-hidden="true"');
});
