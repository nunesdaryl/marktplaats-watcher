import { expect, test } from "vitest";
import { MAX_TURN_CHARS, historyFor } from "./history.js";

test("long answers are trimmed so the next question still goes through", () => {
  const history = historyFor([{ role: "assistant", content: "x".repeat(8000), extra: 1 }, { role: "user", content: "hi" }]);
  expect(history[0].content).toHaveLength(MAX_TURN_CHARS);
  expect(history[0]).toEqual({ role: "assistant", content: expect.stringMatching(/…$/) });
  expect(history[1]).toEqual({ role: "user", content: "hi" });
});

test("only the last 20 turns are sent", () => {
  const messages = Array.from({ length: 30 }, (_, i) => ({ role: "user", content: String(i) }));
  expect(historyFor(messages).map((m) => m.content)).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 10)));
});
