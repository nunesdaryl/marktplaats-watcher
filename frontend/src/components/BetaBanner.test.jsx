import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import Sidebar from "./Sidebar.jsx";

vi.mock("convex/react", () => ({ useQuery: () => [], useMutation: () => vi.fn() }));
vi.mock("./AccountButton.jsx", () => ({
  default: () => <button aria-label="Account menu">Avatar</button>,
}));
vi.mock("./ThemeToggle.jsx", () => ({
  default: () => <button aria-label="Theme">Theme</button>,
}));
vi.stubGlobal("React", React);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function renderDesktop(flag) {
  if (flag !== undefined) vi.stubEnv("NEXT_PUBLIC_ACCOUNT_TOP_RIGHT", flag);
  vi.resetModules();
  const { default: BetaBanner } = await import("./BetaBanner.jsx");
  return renderToStaticMarkup(<>
    <BetaBanner onFeedback={vi.fn()} busy={false} withToggle />
    <Sidebar
      route={{ section: "" }} watches={[]} chats={[]} email="person@example.com" actions={{}}
      renaming={null} setRenaming={vi.fn()} onNewWatch={vi.fn()} onPrivacy={vi.fn()}
      onFeedback={vi.fn()} openSheet={vi.fn()} toast={vi.fn()} isOwner={false} newAlerts={0}
    />
  </>);
}

test.each([undefined, "0", "true"])("desktop flag %s keeps today's banner markup", async (flag) => {
  const html = await renderDesktop(flag);
  const banner = html.slice(0, html.indexOf("</div><nav") + 6);
  expect(banner).toBe('<div class="beta-strip"><button class="beta-banner"><span class="beta-tag">Free beta</span><span class="beta-text">Give feedback &amp; suggestions</span><span aria-hidden="true" class="beta-arrow">→</span></button><button aria-label="Theme">Theme</button></div>');
  expect(html).toContain('class="account"');
  expect(html.match(/aria-label="Account menu"/g)).toHaveLength(1);
});

test("flag 1 adds a labelled account target beside the desktop theme toggle and keeps the sidebar row", async () => {
  const html = await renderDesktop("1");
  const banner = html.slice(0, html.indexOf("</div><nav") + 6);
  expect(banner).toContain('<button aria-label="Theme">Theme</button><div class="beta-account" role="group" aria-label="Account"><button aria-label="Account menu">Avatar</button></div>');
  expect(html).toContain('class="account"');
  expect(html.match(/aria-label="Account menu"/g)).toHaveLength(2);
});

test("flag 1 leaves the phone banner without an account button", async () => {
  vi.stubEnv("NEXT_PUBLIC_ACCOUNT_TOP_RIGHT", "1");
  vi.resetModules();
  const { default: BetaBanner } = await import("./BetaBanner.jsx");
  const html = renderToStaticMarkup(<BetaBanner onFeedback={vi.fn()} busy={false} />);
  expect(html).not.toContain("beta-account");
  expect(html).not.toContain("Account menu");
});

test("admitted member sees the free-until date and AI spend on the banner", async () => {
  const { default: BetaBanner } = await import("./BetaBanner.jsx");
  const html = renderToStaticMarkup(<BetaBanner onFeedback={vi.fn()} busy={false}
    freeUntil={Date.parse("2026-11-04T00:00:00Z")} budget={{ spentEur: 0.32, limitEur: 1 }} />);
  expect(html).toContain("Founding user · free until 4 Nov");
  expect(html).toContain("€0.32 of €1.00 used");
});

test("Keep my watches appears five days before the current free-until date", async () => {
  vi.useFakeTimers();
  try {
    const { default: BetaBanner } = await import("./BetaBanner.jsx");
    const freeUntil = Date.parse("2026-11-04T00:00:00Z");
    vi.setSystemTime(freeUntil - 6 * 86_400_000);
    expect(renderToStaticMarkup(<BetaBanner onFeedback={vi.fn()} onKeep={vi.fn()} freeUntil={freeUntil} />)).not.toContain("Keep my watches");
    vi.setSystemTime(freeUntil - 5 * 86_400_000);
    expect(renderToStaticMarkup(<BetaBanner onFeedback={vi.fn()} onKeep={vi.fn()} freeUntil={freeUntil} />)).toContain("Keep my watches");
    expect(renderToStaticMarkup(<BetaBanner onFeedback={vi.fn()} onKeep={vi.fn()} freeUntil={freeUntil + 30 * 86_400_000} />)).toContain("free until 4 Dec");
  } finally { vi.useRealTimers(); }
});
