import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vitest";
import { useRouter, useSearchParams } from "next/navigation";
import { dateFilters, drillUrl, parseDrill, useDrill } from "./nav.js";
import { label } from "./nav.js";
import { EVENT_NAMES } from "../../../convex/events.ts";
import { filterParams } from "./FilterBar.jsx";

vi.mock("next/navigation", () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

test("every tracked event has a readable dashboard label", () => {
  for (const name of EVENT_NAMES) {
    expect(label(name), name).not.toBe(name);
    expect(label(name), name).not.toMatch(/_/);
  }
  expect(label("alert_rated")).toBe("Alerts rated");
});

test("closing a drill uses the open view pathname without loading a document", () => {
  const push = vi.fn();
  const pushState = vi.fn();
  vi.mocked(useRouter).mockReturnValue({ push });
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("view=users&title=Users"));
  vi.stubGlobal("window", { history: { pushState } });
  let drill;
  function Capture() { drill = useDrill(); return null; }
  renderToStaticMarkup(createElement(Capture));

  drill.open({ view: "audits", title: "Audits" });
  drill.close();

  expect(new URL(push.mock.calls[0][0], "https://example.com").pathname).toBe("/admin/");
  expect(pushState).toHaveBeenCalledWith(null, "", "/admin/");
  expect(push).toHaveBeenCalledTimes(1);
});

test("FilterBar state and sort survive a URL round trip", () => {
  const params = { userId: "u1", watchId: "w1", when: "custom", since: "1000", until: "2000",
    minScore: "8", kind: "never_read", q: "bike", sort: "score", dir: "asc" };
  const url = drillUrl({ view: "audits", title: "Delivery audit", params }, []);
  const parsed = parseDrill(new URL(url, "https://example.com").searchParams);
  expect(parsed).toMatchObject({ view: "audits", title: "Delivery audit", params });
  expect(filterParams.filter((key) => params[key])).toEqual(["userId", "watchId", "when", "since", "until", "minScore", "kind", "q"]);
  expect(dateFilters(parsed.params)).toEqual({ since: 1000, until: 2000 });
  const removed = { ...parsed.params, watchId: undefined, q: undefined };
  expect(parseDrill(new URL(drillUrl({ ...parsed, params: removed }, []), "https://example.com").searchParams)?.params)
    .toEqual(Object.fromEntries(Object.entries(removed).filter(([, value]) => value !== undefined)));
});

test("Today uses the Amsterdam calendar day", () => {
  expect(dateFilters({ when: "today" }, Date.parse("2026-09-30T10:00:00Z"))).toEqual({
    since: Date.parse("2026-09-29T22:00:00Z"), until: Date.parse("2026-09-30T22:00:00Z"),
  });
});
