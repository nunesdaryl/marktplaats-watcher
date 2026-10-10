import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { useQuery } from "convex/react";
import WhatsNew from "./WhatsNew.jsx";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));

test("the public page lists shipped improvements with safe credit", () => {
  vi.mocked(useQuery).mockReturnValue([{ id: "f1", title: "Bidding help", date: Date.parse("2026-10-10T10:00:00Z"),
    credit: "a founding user", featureUrl: "/watch/" }]);
  const html = renderToStaticMarkup(<WhatsNew />);
  expect(html).toContain("Bidding help");
  expect(html).toContain("a founding user");
  expect(html).toContain('href="/watch/"');
});
