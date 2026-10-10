import { expect, test } from "vitest";
import { captureLanding, signupAttribution } from "./landingAttribution.js";

test("keeps the first landing and its campaign in the current tab", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  captureLanding("?utm_source=linkedin&utm_medium=post&utm_campaign=launch", "nl", storage);
  captureLanding("?utm_source=search", "en", storage);
  expect(signupAttribution(storage)).toEqual({ landingLanguage: "nl", utm_source: "linkedin", utm_medium: "post", utm_campaign: "launch" });
});
