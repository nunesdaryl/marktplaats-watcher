import { describe as group, expect, test } from "vitest";
import { checkSchedule, describe, describeWhen, nextRun } from "./schedule";

const at = (iso: string) => Date.parse(iso);

group("nextRun", () => {
  test("interval: the next check is one interval later", () => {
    expect(nextRun({ kind: "interval", everyMinutes: 180 }, at("2026-09-27T10:00:00Z"))).toBe(at("2026-09-27T13:00:00Z"));
  });

  test("daily: the next of several times today, else the first one tomorrow (Amsterdam summer time)", () => {
    const s = { kind: "daily" as const, times: ["08:00", "18:00"] };
    expect(nextRun(s, at("2026-09-27T08:00:00Z"))).toBe(at("2026-09-27T16:00:00Z"));  // 10:00 → 18:00 today
    expect(nextRun(s, at("2026-09-27T17:00:00Z"))).toBe(at("2026-09-28T06:00:00Z"));  // 19:00 → 08:00 tomorrow
  });

  test("weekly: skips to the next chosen weekday", () => {
    const s = { kind: "weekly" as const, days: ["mon" as const, "fri" as const], time: "18:00" };
    expect(nextRun(s, at("2026-09-27T10:00:00Z"))).toBe(at("2026-09-28T16:00:00Z"));  // Sunday → Monday
    expect(nextRun(s, at("2026-09-28T17:00:00Z"))).toBe(at("2026-10-02T16:00:00Z"));  // Monday after 18:00 → Friday
  });

  test("keeps local time across the switch to winter time", () => {
    // Clocks go back on Sunday 25 October 2026: 08:00 is then UTC+1 instead of UTC+2
    const s = { kind: "daily" as const, times: ["08:00"] };
    expect(nextRun(s, at("2026-10-24T12:00:00Z"))).toBe(at("2026-10-25T07:00:00Z"));
    expect(nextRun(s, at("2026-10-23T12:00:00Z"))).toBe(at("2026-10-24T06:00:00Z"));
  });

  test("a time skipped by the switch to summer time still gets a check that day", () => {
    const next = nextRun({ kind: "daily", times: ["02:30"] }, at("2026-03-28T12:00:00Z"));
    expect(next).toBeGreaterThan(at("2026-03-29T00:00:00Z"));
    expect(next).toBeLessThan(at("2026-03-29T02:00:00Z"));
  });
});

group("plain English", () => {
  test.each([
    [{ kind: "interval", everyMinutes: 15 }, "every 15 minutes"],
    [{ kind: "interval", everyMinutes: 60 }, "every hour"],
    [{ kind: "interval", everyMinutes: 180 }, "every 3 hours"],
    [{ kind: "interval", everyMinutes: 720 }, "twice a day (every 12 hours)"],
    [{ kind: "daily", times: ["18:00", "08:00"] }, "every day at 08:00 and 18:00"],
    [{ kind: "daily", times: ["08:00", "12:00", "18:00"] }, "every day at 08:00, 12:00 and 18:00"],
    [{ kind: "weekly", days: ["fri", "mon"], time: "18:00" }, "every Monday and Friday at 18:00"],
    [{ kind: "weekly", days: ["mon", "tue", "wed", "thu", "fri"], time: "07:30" }, "every weekday at 07:30"],
  ] as const)("%o → %s", (s, text) => {
    expect(describe(s as never)).toBe(text);
  });

  test("when: today, tomorrow, or a short date", () => {
    const now = at("2026-09-27T08:00:00Z");
    expect(describeWhen(at("2026-09-27T12:00:00Z"), now)).toBe("today at 14:00");
    expect(describeWhen(at("2026-09-28T06:00:00Z"), now)).toBe("tomorrow at 08:00");
    expect(describeWhen(at("2026-10-02T16:00:00Z"), now)).toBe("Fri 2 Oct at 18:00");
  });
});

test("only the offered schedules are accepted", () => {
  expect(() => checkSchedule({ kind: "interval", everyMinutes: 5 })).toThrow(/every 15 or 30 minutes/);
  expect(() => checkSchedule({ kind: "daily", times: [] })).toThrow(/1 to 4 times/);
  expect(() => checkSchedule({ kind: "daily", times: ["25:00"] })).toThrow(/08:00/);
  expect(() => checkSchedule({ kind: "weekly", days: [], time: "08:00" })).toThrow(/at least one day/);
  expect(() => checkSchedule({ kind: "daily", times: ["08:00"] })).not.toThrow();
});
