// @vitest-environment jsdom
import * as React from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { useDashboardLoadTiming } from "./useDashboardLoadTiming.js";
import { track } from "../../lib/track.js";

vi.mock("../../lib/track.js", () => ({ track: vi.fn() }));

const names = ["admin.dashboard", "admin.ratingStats", "admin.feedback", "founding.ownerSummary", "admin.signupSources"];
const empty = Object.fromEntries(names.map((name) => [name, undefined]));
function Probe({ results, navigationStartedAt }) {
  useDashboardLoadTiming(results, navigationStartedAt);
  return null;
}

afterEach(() => { vi.restoreAllMocks(); vi.mocked(track).mockClear(); document.body.replaceChildren(); });

test("one dashboard open records the first, all, and slowest query despite later rerenders", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let time = 0;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  const render = async (results) => { await act(async () => root.render(createElement(Probe, { results }))); };
  try {
    await render(empty);
    time = 100;
    await render({ ...empty, "admin.feedback": {} });
    time = 400;
    await render({ ...empty, "admin.feedback": {}, "admin.dashboard": {}, "admin.ratingStats": {}, "founding.ownerSummary": {} });
    time = 700;
    await render(Object.fromEntries(names.map((name) => [name, {}])));
    expect(track).toHaveBeenCalledExactlyOnceWith("dashboard_loaded", {
      first_ms: "100", all_ms: "700", slowest: "admin.signupSources",
    });
    time = 900;
    await render(empty);
    await render(Object.fromEntries(names.map((name) => [name, {}])));
    expect(track).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); }
});

test("timing starts at navigation even when the overview mounts later", async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let time = 200;
  vi.spyOn(performance, "now").mockImplementation(() => time);
  const root = createRoot(document.body.appendChild(document.createElement("div")));
  try {
    await act(async () => root.render(createElement(Probe, { results: empty, navigationStartedAt: 0 })));
    time = 500;
    await act(async () => root.render(createElement(Probe, {
      results: Object.fromEntries(names.map((name) => [name, {}])), navigationStartedAt: 0,
    })));
    expect(track).toHaveBeenCalledWith("dashboard_loaded", expect.objectContaining({ first_ms: "500", all_ms: "500" }));
  } finally { await act(async () => root.unmount()); }
});
