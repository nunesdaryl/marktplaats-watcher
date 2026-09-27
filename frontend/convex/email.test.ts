import { expect, test } from "vitest";
import { renderEmail } from "./checker";

const content = {
  label: "mac mini, 16GB, under €500", summary: "every 3 hours", notify: "great matches only",
  alerts: [
    { title: "Mac mini i5 16GB", priceEur: 230, city: "Utrecht", url: "https://www.marktplaats.nl/v/a1", score: 9, reason: "Good price." },
    { title: '<img src=x onerror="alert(1)">', priceEur: 400, url: "https://www.marktplaats.nl/v/a2", score: 8, reason: "Fine." },
  ],
};

test("the subject names the watch and the best match", () => {
  const { subject } = renderEmail(content, "https://app.test");
  expect(subject).toBe("2 new matches for mac mini, 16GB, under €500 (best: 9/10, €230)");
});

test("listing titles from strangers are escaped, never rendered as HTML", () => {
  const { html } = renderEmail(content, "https://app.test");
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("every listing links to Marktplaats and the footer says why you got it", () => {
  const { text, html } = renderEmail(content, "https://app.test");
  expect(text).toContain("Open on Marktplaats: https://www.marktplaats.nl/v/a1");
  expect(html.match(/Open on Marktplaats/g)).toHaveLength(2);
  expect(text).toContain("not affiliated with Marktplaats");
  expect(text).toContain("Manage or pause this watch: https://app.test");
});
