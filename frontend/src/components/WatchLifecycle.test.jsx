import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import WatchLifecycle from "./WatchLifecycle.jsx";
import WatchSheet from "./WatchSheet.jsx";
import Onboarding from "../views/Onboarding.jsx";

vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => ({ getToken: vi.fn() }) }));
vi.stubGlobal("React", React);

const daily = { kind: "daily", times: ["08:00"] };

test("the first-watch explanation starts closed and follows the selected schedule and threshold", () => {
  const html = renderToStaticMarkup(<WatchLifecycle schedule={daily} notify="good" />);
  expect(html).toMatch(/<details class="watch-lifecycle"><summary>/);
  expect(html).toContain("The first check quietly notes what&#x27;s already listed.");
  expect(html).toContain("every day at 08:00 (Amsterdam time)");
  expect(html).toContain("scoring 6 or higher");

  const great = renderToStaticMarkup(<WatchLifecycle schedule={{ kind: "interval", everyMinutes: 60 }} notify="great" />);
  expect(great).toContain("every hour (Amsterdam time)");
  expect(great).toContain("scoring 8 or higher");

  const all = renderToStaticMarkup(<WatchLifecycle schedule={daily} notify="all" />);
  expect(all).toContain("every new listing that fits your filters");
  expect(all).not.toContain("scoring 0 or higher");
});

test("the explanation appears during first-watch and new-watch setup, but not while editing", () => {
  const onboarding = renderToStaticMarkup(<Onboarding email="test@example.com" onDone={() => {}} />);
  const create = renderToStaticMarkup(<WatchSheet mode="create" onClose={() => {}} />);
  const edit = renderToStaticMarkup(<WatchSheet mode="edit" watchId="w1" onClose={() => {}} />);
  expect(onboarding).toContain("What happens after I start watching?");
  expect(create).toContain("What happens after I start watching?");
  expect(edit).not.toContain("What happens after I start watching?");
});
