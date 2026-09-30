import { expect, test } from "vitest";
import { dateFilters, drillUrl, parseDrill } from "./nav.js";
import { filterParams } from "./FilterBar.jsx";

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
