import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AddFeedback, Feedback, FeedbackDetail, adminError, receivedTimestamp } from "./Views.jsx";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: () => vi.fn(), useAction: () => vi.fn() }));
vi.stubGlobal("React", React);

const row = { _id: "feedback-1", createdAt: Date.parse("2026-10-01T12:00:00Z"), source: "whatsapp",
  email: "Instructor", message: "The alerts saved me time", status: "shipped", issues: ["MW-48"],
  releaseSha: "abcdef012345", releaseAt: Date.parse("2026-10-02T12:00:00Z"),
  replyDraft: "Thank you. We changed alerts. See it in the app.", timeline: [
    { _id: "e1", status: "planned", at: Date.now(), by: "owner@example.com" },
    { _id: "e2", status: "in_progress", at: Date.now(), by: "owner@example.com" },
    { _id: "e3", status: "shipped", at: Date.now(), by: "owner@example.com" },
  ], before: [] };

test("feedback list has requested columns and status and source filters", () => {
  vi.mocked(useQuery).mockReturnValue({ rows: [row], more: false });
  const html = renderToStaticMarkup(<Feedback params={{}} open={vi.fn()} update={vi.fn()} />);
  for (const label of ["Received", "Source", "Person", "Status", "Issue", "Shipped in", "Replied", "All sources"])
    expect(html).toContain(label);
  expect(html).toContain('class="filter-controls"');
  expect(html).toMatch(/<label>Source<select aria-label="Source"/);
  expect(html).toContain("whatsapp");
});

test("outside intake and shipped item show their required controls and timeline", () => {
  const add = renderToStaticMarkup(<AddFeedback onDone={vi.fn()} />);
  for (const label of ["Account", "Name", "E-mail", "Received", "Channel", "Paraphrase", "Screenshot", "Save feedback"])
    expect(add).toContain(label);
  expect(add).toContain("Attach screenshot");
  expect(add).not.toContain("Choose File");
  const detail = renderToStaticMarkup(<FeedbackDetail f={row} close={vi.fn()} open={vi.fn()} />);
  for (const label of ["Received", "planned", "in progress", "shipped", "MW-48", "Shipped in", "Reply draft", "Copy reply", "Mark as replied"])
    expect(detail).toContain(label);
  expect(detail).not.toContain('>Send</button>');
});

test("intake offers LinkedIn, a source link and opt-in public credit", () => {
  const html = renderToStaticMarkup(<AddFeedback onDone={vi.fn()} />);
  expect(html).toContain('value="linkedin"');
  expect(html).toContain('name="sourceUrl"');
  expect(html).toContain('name="creditName"');
});

test("received date uses now for today and Amsterdam noon for past days", () => {
  const now = Date.parse("2026-10-02T10:00:00Z");
  expect(receivedTimestamp("2026-10-02", now)).toBeLessThanOrEqual(now);
  expect(receivedTimestamp("2026-10-02", now)).toBe(now);
  expect(receivedTimestamp("2026-10-01", now)).toBe(Date.parse("2026-10-01T10:00:00Z"));
  expect(receivedTimestamp("2026-01-02", now)).toBe(Date.parse("2026-01-02T11:00:00Z"));
  expect(() => receivedTimestamp("2026-10-03", now)).toThrow();
});

test("admin errors display only ConvexError data", () => {
  expect(adminError(new ConvexError("Move feedback through the status line in order.")))
    .toBe("Move feedback through the status line in order.");
  expect(adminError(new Error("[CONVEX] Server Error"))).toBe("That didn't work. Try again.");
});
