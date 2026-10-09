import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import RatingNudge from "./RatingNudge.jsx";

vi.mock("convex/react", () => ({ useMutation: vi.fn(), useQuery: vi.fn() }));
vi.stubGlobal("React", React);
beforeEach(() => { vi.mocked(useMutation).mockReturnValue(vi.fn()); vi.mocked(useQuery).mockReturnValue(null); });

test("rating card shows the next alert and both phone-sized choices when eligible", () => {
  vi.mocked(useQuery).mockReturnValue({ alert: { _id: "a1", title: "Gazelle bike" }, rated: 1 });
  const html = renderToStaticMarkup(<RatingNudge />);
  expect(html).toContain("Rate your first 3 alerts — each rating tunes this watch for you.");
  expect(html).toContain("Gazelle bike");
  expect(html).toContain("Good match");
  expect(html).toContain("Not right");
  expect(html).toContain("Dismiss rating reminder");
});

test("rating card hides when the eligibility query returns no alert", () => {
  expect(renderToStaticMarkup(<RatingNudge />)).toBe("");
});
