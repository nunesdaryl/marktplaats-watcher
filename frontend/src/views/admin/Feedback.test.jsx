import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { useQuery } from "convex/react";
import { AddFeedback, Feedback, FeedbackDetail } from "./Views.jsx";

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
  for (const label of ["Received", "Source", "Person", "Status", "Issue", "Shipped in", "Replied", "Feedback source"])
    expect(html).toContain(label);
  expect(html).toContain("whatsapp");
});

test("outside intake and shipped item show their required controls and timeline", () => {
  const add = renderToStaticMarkup(<AddFeedback onDone={vi.fn()} />);
  for (const label of ["Account", "Name", "E-mail", "Received", "Channel", "Paraphrase", "Screenshot", "Save feedback"])
    expect(add).toContain(label);
  const detail = renderToStaticMarkup(<FeedbackDetail f={row} close={vi.fn()} open={vi.fn()} />);
  for (const label of ["Received", "planned", "in progress", "shipped", "MW-48", "Shipped in", "Reply draft", "Send", "Mark as replied"])
    expect(detail).toContain(label);
});
