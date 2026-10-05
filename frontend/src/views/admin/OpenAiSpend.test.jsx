import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { useQuery } from "convex/react";
import { OpenAiSpendCard, spendState } from "./OpenAiSpend.jsx";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.stubGlobal("React", React);

test.each([[23.4, "normal"], [88, "warning"], [104.5, "danger"]])("$%s of $110 has %s state", (usd, tone) => {
  expect(spendState(usd, 110)).toBe(tone);
  vi.mocked(useQuery).mockReturnValue({ measuredEur: usd * 0.92, measuredUsd: usd,
    capUsd: 110, billed: { usd, updatedAt: Date.parse("2026-10-20") }, connected: true });
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
});
