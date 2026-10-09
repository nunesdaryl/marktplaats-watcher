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
