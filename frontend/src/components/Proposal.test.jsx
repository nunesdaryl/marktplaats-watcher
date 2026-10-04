import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import Proposal from "./Proposal.jsx";
import WatchSheet from "./WatchSheet.jsx";

vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => ({ getToken: vi.fn() }) }));
vi.stubGlobal("React", React);

const schedule = { kind: "daily", times: ["08:00"] };
const note = "This search gets about 25 new listings per check; one check can read 20. Add a word or a max price so nothing is missed.";

test("a broad proposal shows the warning with enabled Save and Adjust", () => {
  const html = renderToStaticMarkup(<Proposal p={{ type: "create", query: "iphone", maxPriceEur: null,
    schedule, notify: "good", volumeNote: note }} onAdjust={() => {}} />);
  expect(html).toContain(note);
  expect(html).toMatch(/<button[^>]*>Save watch<\/button>/);
  expect(html).toContain(">Adjust</button>");
});

test("create and edit proposals explain the chosen alert level", () => {
  const create = renderToStaticMarkup(<Proposal p={{ type: "create", query: "iphone", schedule, notify: "good" }} />);
  const edit = renderToStaticMarkup(<Proposal p={{ type: "update", label: "iphone", watchId: "w1", notify: "great" }} />);
  expect(create).toContain("good matches (listings scoring 6 or higher out of 10)");
  expect(edit).toContain("great matches only (listings scoring 8 or higher out of 10)");
});

test("the edit sheet shows the same warning and leaves Save available", () => {
  const html = renderToStaticMarkup(<WatchSheet mode="edit" watchId="w1"
    initial={{ query: "iphone", schedule, volumeNote: note }} onClose={() => {}} />);
  expect(html).toContain(note);
  expect(html).toMatch(/<button[^>]*>Save changes<\/button>/);
});
