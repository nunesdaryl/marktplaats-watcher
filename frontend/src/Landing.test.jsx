import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import Landing from "./Landing.jsx";

vi.stubGlobal("React", React);
vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });

test("landing shows the live places left beside the free offer", () => {
  const html = renderToStaticMarkup(<Landing placesLeft={{ cap: 100, taken: 37, left: 63 }} />);
  expect(html).toContain("Free for 30 days for the first 100 users · 63 of 100 places left");
  expect(html).toContain("63 of 100 places left");
  expect(html).toContain("Set up a free watch");
});

test("landing shows the waitlist when all places are taken", () => {
  const html = renderToStaticMarkup(<Landing placesLeft={{ cap: 100, taken: 100, left: 0 }} />);
  expect(html).toContain("All 100 places taken · join the waitlist");
  expect(html).toContain("Join the waitlist</button>");
});
