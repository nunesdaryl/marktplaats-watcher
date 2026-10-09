import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import WatchSentence from "./WatchSentence.jsx";
import ListingCard from "./ListingCard.jsx";

vi.stubGlobal("React", React);

const schedule = { kind: "interval", everyMinutes: 60 };

test.each([
  ["great", "great matches only", "listings scoring 8 or higher out of 10"],
  ["good", "good matches", "listings scoring 6 or higher out of 10"],
  ["all", "every new listing", "all new listings that fit your filters, each still scored"],
])("watch sentence explains %s", (notify, label, meaning) => {
  const html = renderToStaticMarkup(<WatchSentence label="Mac mini" schedule={schedule} notify={notify} />);
  expect(html).toContain(`<mark>${label}</mark> (${meaning})`);
});

test.each([[9, "great"], [7, "good"], [3, "low"]])("listing score %i includes %s in text and accessible name", (score, level) => {
  const html = renderToStaticMarkup(<ListingCard listing={{ title: "Mac mini", url: "https://example.test" }} score={score} />);
  expect(html).toContain(`${score}<small>/10</small> · ${level}`);
  expect(html).toContain(`aria-label="Scored ${score} out of 10, ${level}"`);
});

test("offer action appears only for a priced listing and stays outside the listing link", () => {
  const priced = renderToStaticMarkup(<ListingCard listing={{ title: "Bike", url: "https://example.test", price_eur: 100 }} />);
  const unpriced = renderToStaticMarkup(<ListingCard listing={{ title: "Bike", url: "https://example.test" }} />);
  expect(priced).toMatch(/<\/a><button[^>]*>Help me make an offer<\/button>/);
  expect(unpriced).not.toContain("Help me make an offer");
});

test.each(["MIN_BID", "BID", "FAST_BID", "FIXED", "bidding from", "make an offer", "fixed price"])("%s listings offer help", (price_type) => {
  const html = renderToStaticMarkup(<ListingCard listing={{ title: "Bike", url: "https://example.test", price_eur: 100, price_type }} score={8} />);
  expect(html).toContain("Help me make an offer");
});

test.each(["FREE", "SWAP", "SEE_DESCRIPTION", "free", "swap", "see description"])("%s listings do not offer help", (price_type) => {
  const html = renderToStaticMarkup(<ListingCard listing={{ title: "Bike", url: "https://example.test", price_eur: 100, price_type }} score={8} />);
  expect(html).not.toContain("Help me make an offer");
});
