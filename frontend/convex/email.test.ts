import { expect, test } from "vitest";
import { renderEmail } from "./checker";

const content = {
  watchId: "w123", label: "mac mini, 16GB, under €500", summary: "every 3 hours", notify: "great matches only",
  alerts: [
    { title: "Mac mini i5 16GB", priceEur: 230, city: "Utrecht", url: "https://www.marktplaats.nl/v/a1", score: 9, reason: "Good price." },
    { title: '<img src=x onerror="alert(1)">', priceEur: 400, url: "https://www.marktplaats.nl/v/a2", score: 8, reason: "Fine." },
  ],
};

test("the subject names the watch and the best match", () => {
  const { subject } = renderEmail(content, "https://app.test");
  expect(subject).toBe("mac mini, 16GB, under €500: 2 new matches, best 9/10 at €230");
});

test("listing titles from strangers are escaped, never rendered as HTML", () => {
  const { html } = renderEmail(content, "https://app.test");
  expect(html).not.toContain("<img src=x");                     // a listing title can't inject markup
  expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("every listing links to Marktplaats and the footer says why you got it", () => {
  const { text, html } = renderEmail(content, "https://app.test");
  expect(text).toContain("Open on Marktplaats: https://www.marktplaats.nl/v/a1");
  expect(text).toContain("Scored 9/10, €230, Utrecht");
  expect(html.match(/Open on Marktplaats/g)).toHaveLength(2);
  expect(text).toContain("not affiliated with Marktplaats");
  expect(text).toContain("Manage or pause this watch: https://app.test/watch/?id=w123");
  expect(text).toContain("Replies to this address aren't read.");
  expect(html).toContain("Best: Mac mini i5 16GB. Good price.");   // hidden inbox preview line
});

test("each alert has 'Good match?' links that open the app's rate page with that alert's code", () => {
  const withIds = { ...content, alerts: content.alerts.map((a, i) => ({ ...a, _id: `al${i}`, rateToken: `tok${i}` })) };
  const { text, html } = renderEmail(withIds, "https://app.test/");
  expect(text).toContain("Good match? Yes: https://app.test/rate/?a=al0&v=good&t=tok0");
  expect(text).toContain("Not right: https://app.test/rate/?a=al0&v=not_right&t=tok0");
  expect(html.match(/Good match\?/g)).toHaveLength(2);
  expect(renderEmail(content, "https://app.test").text).not.toContain("Good match?");   // no code, no links
});

test("the HTML follows the Sieve e-mail pattern: tables, a dark-mode block, score badges, no emoji", () => {
  const withIds = { ...content, alerts: content.alerts.map((a, i) => ({ ...a, _id: `al${i}`, rateToken: `tok${i}` })) };
  const { html } = renderEmail(withIds, "https://app.test");
  expect(html).toContain('role="presentation"');                 // table layout: Outlook ignores flexbox
  expect(html).not.toContain("display:flex");
  expect(html).toContain("@media (prefers-color-scheme: dark)");
  expect(html).toContain('<meta name="color-scheme" content="light dark">');
  expect(html).toContain('class="mw-great"');                      // 9/10 and 8/10 are great matches
  expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]|&#12807[78];/u);
  expect(html).not.toMatch(/!<|!\s*$/m);                          // no exclamation marks in the copy
});
