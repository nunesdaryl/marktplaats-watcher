import { expect, test } from "vitest";
import { groupByDate } from "./dates.js";

test("chats are grouped like ChatGPT: today, yesterday, this week, this month, older", () => {
  const now = new Date(2026, 8, 27, 14, 0).getTime();          // Sun 27 Sep 2026, 14:00 local time
  const at = (d, h = 12) => new Date(2026, 8, d, h).getTime();
  const chats = [
    { id: "a", updatedAt: at(27, 9) }, { id: "b", updatedAt: at(26, 23) }, { id: "c", updatedAt: at(22) },
    { id: "d", updatedAt: at(5) }, { id: "e", updatedAt: new Date(2026, 5, 1).getTime() },
  ];
  expect(groupByDate(chats, now).map(([name, list]) => [name, list.map((c) => c.id)])).toEqual([
    ["Today", ["a"]], ["Yesterday", ["b"]], ["Previous 7 days", ["c"]], ["Previous 30 days", ["d"]], ["Older", ["e"]],
  ]);
  expect(groupByDate([], now)).toEqual([]);
});
