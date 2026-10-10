import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import BroadWatchWarning, { broadWatchMessage } from "./BroadWatchWarning.jsx";

vi.stubGlobal("React", React);

const note = "This search gets about 25 new listings per check; one check can read 20. Add a word or a max price so nothing is missed.";
const countNote = "About 1200 listings match now; about 30 new per day";

test("a thousand matching listings gets the narrowing hint", () => {
  expect(broadWatchMessage(countNote, 500, "good")).toContain("This search is broad");
  expect(broadWatchMessage(countNote, 500, "good")).toContain("Add a brand, model or price limit");
  expect(broadWatchMessage("About 999 listings match now; about 30 new per day", 500, "good")).toBeNull();
});

test("estimated volume must exceed 20, unless price is unlimited and every listing is emailed", () => {
  expect(broadWatchMessage(note, 500, "good")).toContain("about 25 new listings per check");
  expect(broadWatchMessage("This search gets about 20 new listings per check", 500, "good")).toBeNull();
  expect(broadWatchMessage(null, "", "all")).toContain("This search is broad");
  expect(broadWatchMessage(null, "", "good")).toBeNull();
  expect(broadWatchMessage(null, 500, "all")).toBeNull();
});

test("warning offers one-tap price and good-match suggestions without disabling save", () => {
  const html = renderToStaticMarkup(<BroadWatchWarning message={broadWatchMessage(note, "", "all")}
    onPrice={() => {}} onGood={() => {}} />);
  expect(html).toContain("Add max price");
  expect(html).toContain("Choose good matches");
  expect(html).toContain("about 25 new listings per check");
});
