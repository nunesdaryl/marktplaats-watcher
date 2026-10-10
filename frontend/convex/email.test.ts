import { expect, test } from "vitest";
import { renderEmail } from "./checker";
import { MIN_SCORE, NOTIFY_LABEL, NOTIFY_SHORT, type Notify } from "./schedule";

const content = {
  watchId: "w123", label: "mac mini, 16GB, under €500", summary: "every 3 hours", notify: "great" as const,
  alerts: [
    { title: "Mac mini i5 16GB", priceEur: 230, city: "Utrecht", url: "https://www.marktplaats.nl/v/a1", score: 9, reason: "Good price." },
    { title: '<img src=x onerror="alert(1)">', priceEur: 400, url: "https://www.marktplaats.nl/v/a2", score: 8, reason: "Fine." },
  ],
};

test("the subject names the watch and the best match", () => {
  const { subject } = renderEmail(content, "https://app.test");
  expect(subject).toBe("mac mini, 16GB, under €500: 2 new matches, best 9/10 at €230");
});

test("a price-drop alert names both prices in text and the HTML card", () => {
  const drop = { ...content.alerts[0], dropFromEur: 450, priceEur: 400 };
  const { text, html } = renderEmail({ ...content, alerts: [drop] }, "https://app.test");
  expect(renderEmail({ ...content, alerts: [drop] }, "https://app.test").subject).toContain("1 price drop");
  expect(text).toContain("Price dropped €450 → €400");
  expect(html).toContain("Price dropped €450 → €400");
});

test("the e-mail row shows condition and distance in text and escaped HTML", () => {
  const alert = { ...content.alerts[0], condition: "Zo goed als <nieuw>", distanceKm: 12 };
  const { text, html } = renderEmail({ ...content, alerts: [alert] }, "https://app.test");
  expect(text).toContain("Zo goed als <nieuw> · 12 km");
  expect(html).toContain("Zo goed als &lt;nieuw&gt; · 12 km");
});

test("seller type appears in both e-mail formats without seller identity", () => {
  const alerts = [{ ...content.alerts[0], sellerType: "private" as const },
    { ...content.alerts[1], sellerType: "shop" as const }];
  const { text, html } = renderEmail({ ...content, alerts }, "https://app.test");
  expect(text).toContain("Private seller");
  expect(text).toContain("Shop/dealer");
  expect(html).toContain("Private seller");
  expect(html).toContain("Shop/dealer");
});

test("listing titles from strangers are escaped, never rendered as HTML", () => {
  const { html } = renderEmail(content, "https://app.test");
  expect(html).not.toContain("<img src=x");                     // a listing title can't inject markup
  expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("every listing links to Marktplaats and the footer says why you got it", () => {
  const { text, html } = renderEmail(content, "https://app.test");
  expect(text).toContain("Open on Marktplaats: https://www.marktplaats.nl/v/a1");
  expect(text).toContain("Scored 9/10 (great), €230, Utrecht");
  expect(html.match(/Open on Marktplaats/g)).toHaveLength(2);
  expect(text).toContain("not affiliated with Marktplaats");
  expect(text).toContain("Manage or pause this watch: https://app.test/watch/?id=w123");
  expect(text).toContain("Replies to this address aren't read.");
  expect(html).toContain("Best: Mac mini i5 16GB. Good price.");   // hidden inbox preview line
});

test("an alert email links to that alert's offer sheet in the app", () => {
  const withIds = { ...content, alerts: content.alerts.map((a, i) => ({ ...a, _id: `al${i}` })) };
  const { text, html } = renderEmail(withIds, "https://app.test/");
  expect(text).toContain("Help me make an offer: https://app.test/alerts/?offer=al0");
  expect(html).toContain('href="https://app.test/alerts/?offer=al1"');
  expect(html.match(/Open on Marktplaats/g)).toHaveLength(2);
});

test.each(["great", "good", "all"] as Notify[])("%s footer explains the level in normal and catch-up e-mails", (notify) => {
  for (const catchUp of [false, true]) {
    const { text, html } = renderEmail({ ...content, notify, catchUp }, "https://app.test");
    const explanation = `asked for ${NOTIFY_LABEL[notify]}: ${NOTIFY_SHORT[notify]}`;
    expect(text).toContain(explanation);
    expect(html).toContain(explanation);
  }
});

test("score words appear with numbers in both e-mail parts", () => {
  const { text, html } = renderEmail({ ...content, notify: "all", alerts: [
    ...content.alerts, { ...content.alerts[0], score: MIN_SCORE.good, title: "Decent listing" },
    { ...content.alerts[0], score: 0, title: "Accessory" },
  ] }, "https://app.test");
  for (const [score, level] of [[9, "great"], [MIN_SCORE.good, "good"], [0, "low"]] as const) {
    expect(text).toContain(`Scored ${score}/10 (${level})`);
    expect(html).toContain(`${score}/10<br>${level}`);
  }
});

test("each alert has 'Good match?' links that open the app's rate page with that alert's code", () => {
  const withIds = { ...content, alerts: content.alerts.map((a, i) => ({ ...a, _id: `al${i}`, rateToken: `tok${i}` })) };
  const { text, html } = renderEmail(withIds, "https://app.test/");
  expect(text).toContain("Good match? Yes: https://app.test/rate/?a=al0&v=good&t=tok0");
  expect(text).toContain("Not right: https://app.test/rate/?a=al0&v=not_right&t=tok0");
  expect(html.match(/Good match\?/g)).toHaveLength(2);
  const firstCard = html.slice(html.indexOf("Mac mini i5 16GB"), html.indexOf("&lt;img"));
  expect(firstCard.indexOf("Good price.")).toBeLessThan(firstCard.indexOf("Good match?"));
  expect(firstCard.indexOf("Good match?")).toBeLessThan(firstCard.indexOf("Open on Marktplaats"));
  expect(firstCard.match(/min-height:44px/g)).toHaveLength(3);
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
