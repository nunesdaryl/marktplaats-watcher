import * as React from "react";
import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import ChatView from "./ChatView.jsx";

vi.mock("react", async (importOriginal) => ({ ...await importOriginal(), useState: vi.fn() }));
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => ({ getToken: vi.fn() }) }));
vi.mock("convex/react", () => ({ useQuery: () => undefined, useMutation: () => vi.fn() }));
vi.stubGlobal("React", React);

beforeEach(() => {
  vi.mocked(useState).mockImplementation((initial) => [initial, vi.fn()]);
});

test.each([undefined, null])("live chat with %s chatId does not read an absent unsaved answer", (chatId) => {
  vi.mocked(useState).mockImplementationOnce(() => [{ user: "bike", status: "Thinking…", listings: [], text: "" }, vi.fn()]);
  expect(() => renderToStaticMarkup(<ChatView chatId={chatId} watches={[]} />)).not.toThrow();
});

test.each([undefined, null])("unsaved answer waits for a real chatId instead of %s", (chatId) => {
  vi.mocked(useState).mockImplementationOnce(() => [{ user: "bike", status: "Thinking…", listings: [], text: "" }, vi.fn()])
    .mockImplementationOnce(() => [{ chatId, final: { answer: "Found a bike" } }, vi.fn()]);
  const html = renderToStaticMarkup(<ChatView chatId={chatId} watches={[]} />);
  expect(html).not.toContain("Found a bike");
});

test("unsaved answer stays visible with the save failure message", () => {
  vi.mocked(useState).mockImplementationOnce((initial) => [initial, vi.fn()])
    .mockImplementationOnce(() => [{ chatId: "chat-1", final: { answer: "Found a bike" } }, vi.fn()]);

  const html = renderToStaticMarkup(<ChatView chatId="chat-1" watches={[]} />);
  expect(html).toContain("Found a bike");
  expect(html).toContain("Couldn&#x27;t save this answer.");
});
