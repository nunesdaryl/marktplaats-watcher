import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { useQuery } from "convex/react";
import { billedSplit, OpenAiSpendCard, spendState } from "./OpenAiSpend.jsx";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.stubGlobal("React", React);

test.each([[23.4, "normal"], [88, "warning"], [104.5, "danger"]])("$%s of $110 has %s state", (usd, tone) => {
  expect(spendState(usd, 110)).toBe(tone);
  vi.mocked(useQuery).mockReturnValue({ measuredEur: usd * 0.92, measuredUsd: usd,
    capUsd: 110, billed: { usd, byKey: [], updatedAt: Date.parse("2026-10-20") }, connected: true });
  const html = renderToStaticMarkup(<OpenAiSpendCard open={() => {}} />);
  expect(html).toContain(`openai-spend ${tone}`);
  expect(html).toContain(`${Math.round(usd / 110 * 100)}%`);
  expect(html).toContain("Billed by OpenAI");
});

test("without an Admin API key the card identifies the app measurement", () => {
  vi.mocked(useQuery).mockReturnValue({ measuredEur: 0.92, measuredUsd: 1,
    capUsd: 110, billed: null, connected: false });
  const html = renderToStaticMarkup(<OpenAiSpendCard open={() => {}} />);
  expect(html).toContain("OpenAI billing figure not connected");
  expect(html).toContain("Measured by the app");
  expect(html).toContain("Connect an OpenAI admin key to see billed cost per key");
  expect(html).toContain("your alert threshold (OPENAI_MONTHLY_CAP_USD)");
});

test("connected card shows billed key split and other names", () => {
  const billed = { usd: 10, projectUsd: 1, updatedAt: Date.parse("2026-10-20"), byKey: [
    { name: "marktplaats-watcher-app", usd: 1 },
    { name: "marktplaats-watcher-local-and-evals", usd: 7 },
    { name: "vibegame-keychest", usd: 1.5 }, { name: "unnamed key", usd: 0.5 },
  ] };
  expect(billedSplit(billed).otherUsd).toBe(2);
  vi.mocked(useQuery).mockReturnValue({ measuredEur: 0.92, measuredUsd: 1, capUsd: null, billed, connected: true });
  const html = renderToStaticMarkup(<OpenAiSpendCard open={() => {}} />);
  expect(html).toContain("Billed by OpenAI this month: $10.00");
  expect(html).toContain("App: $1.00 (10%)");
  expect(html).toContain("Evals &amp; local: $7.00 (70%)");
  expect(html).toContain("Other keys: $2.00 (20%)");
  expect(html).toContain("Configured project billed: $1.00");
  expect(html).toContain("unnamed key: $0.50 (5%)");
  expect(html).not.toContain("OPENAI_MONTHLY_CAP_USD");
});
