// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { useMutation } from "convex/react";
import RateAlert from "./RateAlert.jsx";

vi.mock("convex/react", () => ({ useMutation: vi.fn(() => vi.fn(() => Promise.resolve())) }));
vi.mock("../lib/track.js", () => ({ track: vi.fn() }));
vi.stubGlobal("React", React);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement("div");
document.body.append(host);
const root = createRoot(host);
afterEach(() => { act(() => root.render(null)); host.innerHTML = ""; });

test("saving a rating explains when the watch uses it", async () => {
  vi.mocked(useMutation).mockReturnValue(vi.fn(() => Promise.resolve()));
  await act(async () => root.render(<RateAlert alertId="a1" alert={{}} rating={null} onArchive={vi.fn()} />));
  await act(async () => host.querySelector(".rate-yes").click());
  await act(async () => root.render(<RateAlert alertId="a1" alert={{}} rating={{ verdict: "good", reasons: [], note: "" }} onArchive={vi.fn()} />));
  expect(host.textContent).toContain("Thanks — this watch will use it from the next check.");
});
