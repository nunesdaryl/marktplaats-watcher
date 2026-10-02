import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import WatchView from "./WatchView.jsx";

vi.mock("convex/react", () => ({ useMutation: vi.fn(() => vi.fn()) }));
vi.mock("../lib/router.js", () => ({ useNow: () => 0, go: vi.fn() }));
vi.stubGlobal("React", React);

const watch = {
  _id: "w1", title: "iPhone", label: "iPhone", schedule: { kind: "interval", everyMinutes: 180 },
  notify: "good", active: true, seeded: true, nextRunAt: 0, alerts: [], backlog: 138,
};
const render = (changes) => renderToStaticMarkup(<WatchView watch={{ ...watch, ...changes }}
  onEdit={vi.fn()} actions={{ watchItems: () => [] }} />);
const warning = "This search finds more new listings than we can read and score each check";

test("backlog warning hides while paused or archived and returns on resume", () => {
  expect(render({ active: false })).not.toContain(warning);
  expect(render({ archivedAt: 1 })).not.toContain(warning);
  expect(render({ active: true })).toContain(`${warning} (138 waiting)`);
});

test("coverage cap warning returns on resume even below the backlog threshold", () => {
  expect(render({ active: false, backlog: 0, coverageCapped: true })).not.toContain(warning);
  expect(render({ backlog: 0, coverageCapped: true })).toContain(warning);
  expect(render({ backlog: 19, coverageCapped: false })).not.toContain(warning);
});
