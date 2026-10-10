import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import ListingCard from "./ListingCard.jsx";

vi.stubGlobal("React", React);

const listing = { title: "Bike", url: "https://www.marktplaats.nl/v/bike", price_eur: 100 };

test("listing cards show only the verified seller type label", () => {
  const card = (seller_type) => renderToStaticMarkup(<ListingCard listing={{ ...listing, seller_type }} />);
  expect(card("private")).toContain("Private seller");
  expect(card("shop")).toContain("Shop/dealer");
  expect(card("unverified")).not.toContain("Private seller");
});
