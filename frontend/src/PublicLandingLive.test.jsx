import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { Live } from "./PublicLandingLive.jsx";

let left = 37;
vi.mock("convex/react", () => ({ ConvexReactClient: class {}, ConvexProvider: ({ children }) => children,
  useQuery: () => ({ cap: 100, left }) }));

test("public count uses the live capacity result in both languages", () => {
  expect(renderToStaticMarkup(<Live language="nl" signup="Start" />)).toContain("37 van 100 founding plekken over");
  expect(renderToStaticMarkup(<Live language="en" signup="Start" />)).toContain("37 of 100 founding places left");
  left = 0;
  expect(renderToStaticMarkup(<Live language="en" signup="Start" />)).toContain("All 100 founding places taken");
});
