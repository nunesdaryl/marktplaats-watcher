import { expect, test } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RatingFix, { suggestedWords } from "./RatingFix.jsx";

test("wrong-model suggestions use alert title words outside the watch query", () => {
  expect(suggestedWords("Mac mini M2 hoes", "Mac mini M2")).toEqual(["hoes"]);
  const html = renderToStaticMarkup(<RatingFix reasons={["not_asked", "price", "score_too_high"]}
    alert={{ title: "Mac mini M2 hoes", query: "Mac mini M2", priceEur: 100, notify: "good", excludeWords: [] }}
    onFix={() => {}} onUndo={() => {}} />);
  expect(html).toContain("Skip listings with &#x27;hoes&#x27;");
  expect(html).toContain("Lower my maximum to €95");
  expect(html).toContain("Only e-mail great matches");
});

test("suggestions rank variants, years, model codes, and differing tech ahead of other words", () => {
  expect(suggestedWords("Mac Mini Late 2012 model A1347 16GB DDR3 – 500GB opslag", "mac mini", "16GB"))
    .toEqual(["2012", "a1347", "ddr3", "500gb", "opslag"]);
  expect(suggestedWords("Nintendo Switch Lite geel met spellen", "Nintendo Switch OLED")[0]).toBe("lite");
  expect(suggestedWords("iPhone 13 mini 128GB", "iPhone 13")[0]).toBe("mini");
  expect(suggestedWords("IKEA desk chair for children", "IKEA desk chair")[0]).toBe("children");
  const html = renderToStaticMarkup(<RatingFix reasons={["not_asked"]}
    alert={{ title: "Mac Mini Late 2012 model A1347 16GB DDR3 – 500GB opslag", query: "mac mini",
      mustInclude: "16GB", excludeWords: [] }} onFix={() => {}} onUndo={() => {}} />);
  expect(html).toMatch(/<input[^>]*aria-label="Word to skip"[^>]*value="2012"/);
  expect(html).toContain('<option value="a1347"');
  expect(html).not.toContain('<option value="16gb"');
});

test("a title with only filler words hides the skip-word fix but keeps other fixes", () => {
  expect(suggestedWords("Late model met voor van de het een en in te koop nieuw new used zgan als with for the and", ""))
    .toEqual([]);
  const html = renderToStaticMarkup(<RatingFix reasons={["not_asked", "price", "score_too_high"]}
    alert={{ title: "Late model met voor van de het een en in te koop nieuw new used zgan als with for the and",
      query: "", priceEur: 100, notify: "good", excludeWords: [] }}
    onFix={() => {}} onUndo={() => {}} />);
  expect(html).not.toContain("Word to skip");
  expect(html).toContain("Lower my maximum to €95");
  expect(html).toContain("Only e-mail great matches");
});
