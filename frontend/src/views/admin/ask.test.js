import { expect, test } from "vitest";
import { intentToDrill } from "./ask.js";

const users = [{ _id: "u1", email: "vin@example.com" }];
const watches = [{ _id: "w1", userId: "u1", title: "Road bike" }];

test("ask intent opens the exact filtered list", () => {
  expect(intentToDrill({ view: "alerts", title: "Vin's alerts", userEmail: "VIN@example.com",
    watchLabel: "Road bike", since: "2026-09-28", until: "2026-10-05", minScore: 8 }, users, watches))
    .toEqual({ view: "alerts", title: "Vin's alerts", params: {
      userId: "u1", watchId: "w1", since: Date.parse("2026-09-27T22:00:00Z"),
      until: Date.parse("2026-10-04T22:00:00Z"), minScore: 8,
    } });
});

test("ask maps list specific filters and leaves unknown intent on overview", () => {
  expect(intentToDrill({ view: "watches", title: "Behind watches", status: "behind" }, users, watches).params)
    .toEqual({ behind: "yes" });
  expect(intentToDrill({ view: "audits", title: "Missed matches", kind: "never_read" }, users, watches).params)
    .toEqual({ kind: "never_read" });
  expect(intentToDrill({ view: "catchups", title: "Catch-up e-mails", status: "sent" }, users, watches).params)
    .toEqual({ emailStatus: "sent" });
  expect(intentToDrill({ view: "feedback", title: "Shipped feedback", status: "shipped" }, users, watches).params)
    .toEqual({ status: "shipped" });
  expect(intentToDrill({ view: "overview", title: "I couldn't tell what to show" }, users, watches)).toBeNull();
});

test("ask does not silently discard an unresolved person or watch", () => {
  expect(() => intentToDrill({ view: "chats", title: "Chats", userEmail: "missing@example.com" }, users, watches)).toThrow();
  expect(() => intentToDrill({ view: "alerts", title: "Alerts", watchLabel: "Missing" }, users, watches)).toThrow();
});
