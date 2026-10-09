import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as React from "react";
vi.stubGlobal("React", React);

const state = vi.hoisted(() => ({ slots: [], index: 0, selected: false }));
vi.mock("react", async (original) => ({
  ...await original(),
  useState(initial) {
    const i = state.index++;
    if (state.slots[i] === undefined) state.slots[i] = initial;
    return [state.slots[i], (value) => { state.slots[i] = value; }];
  },
  useEffect: () => {},
  useRef: () => ({ current: { select: () => { state.selected = true; } } }),
}));
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));
vi.mock("../lib/track.js", () => ({ track: vi.fn() }));
import OfferSheet from "./OfferSheet.jsx";
import { track } from "../lib/track.js";

const draft = { openingEur: 100, maxEur: 120, openingReason: "Based on €140 asking price.",
  maxReason: "Within the watch limit.", messageNl: "Hallo, ophalen?", messageEn: "Hello, pickup?" };
const props = { listing: { _id: "alert123", title: "Bike", url: "https://www.marktplaats.nl/bike",
  priceEur: 140, priceType: "bidding from" }, onClose: vi.fn() };
const children = (node) => {
  if (!node || typeof node !== "object") return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(children)];
};
const render = () => { state.index = 0; return children(OfferSheet(props)); };

beforeEach(() => { vi.stubGlobal("React", React); state.slots = [draft, "", "nl", false]; vi.mocked(track).mockClear(); });
afterEach(() => vi.unstubAllGlobals());
const bidButton = () => render().find((n) => n.type === "button" && [n.props.children].flat(Infinity).join("") === "Bid €100 on Marktplaats");

test("bid handoff copies the amount and chosen message and opens the listing during the tap", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const open = vi.fn();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("window", { open, matchMedia: () => ({ matches: false }) });
  const button = bidButton();
  const pending = button.props.onClick();
  expect(open).toHaveBeenCalledWith(props.listing.url, "_blank", "noopener,noreferrer");
  expect(writeText).toHaveBeenCalledWith("€100\nHallo, ophalen?");
  expect(track).toHaveBeenCalledWith("bid_handoff", { alertId: "alert123", priceType: "bidding from", amount: 100 });
  await pending;
  expect(JSON.stringify(render())).toContain("Tap 'Bieden' on Marktplaats and paste.");
});

test("bid handoff uses the selected English message", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("window", { open: vi.fn() });
  render().find((n) => n.type === "button" && n.props.children === "Show English").props.onClick();
  await bidButton().props.onClick();
  expect(writeText).toHaveBeenCalledWith("€100\nHello, pickup?");
});

test("blocked clipboard leaves the full text selected for manual copy and still opens the listing", async () => {
  const writeText = vi.fn().mockRejectedValue(new Error("blocked"));
  const open = vi.fn();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal("window", { open, matchMedia: () => ({ matches: false }) });
  state.selected = false;
  await bidButton().props.onClick();
  expect(open).toHaveBeenCalledWith(props.listing.url, "_blank", "noopener,noreferrer");
  expect(render().find((n) => n.type === "textarea").props.value).toBe("€100\nHallo, ophalen?");
  expect(state.selected).toBe(true);
});

test("shows prices, disclaimer, and Dutch copy by default", () => {
  const nodes = render();
  expect(JSON.stringify(nodes)).toContain("You send this yourself on Marktplaats. We never contact sellers.");
  expect(JSON.stringify(nodes)).toContain("Opening offer: €");
  expect(nodes.find((n) => n.type === "textarea").props.value).toBe(draft.messageNl);
});

test("language toggle changes the copied message", async () => {
  const button = render().find((n) => n.type === "button" && JSON.stringify(n.props.children).includes("Show English"));
  button.props.onClick();
  const nodes = render();
  expect(nodes.find((n) => n.type === "textarea").props.value).toBe(draft.messageEn);
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  await nodes.find((n) => n.type === "button" && n.props.children === "Copy").props.onClick();
  expect(writeText).toHaveBeenCalledWith(draft.messageEn);
  expect(render().some((n) => n.type === "button" && n.props.children === "Copied")).toBe(true);
});

test("only real Marktplaats listing pages are opened by the hand-off", async () => {
  const { isMarktplaatsUrl } = await import("./OfferSheet.jsx");
  expect(isMarktplaatsUrl("https://www.marktplaats.nl/v/computers/m123-mac-mini")).toBe(true);
  expect(isMarktplaatsUrl("https://www.marktplaats.nl@evil.example/v/m123")).toBe(false);
  expect(isMarktplaatsUrl("http://www.marktplaats.nl/v/m123")).toBe(false);
  expect(isMarktplaatsUrl("javascript:alert(1)")).toBe(false);
  expect(isMarktplaatsUrl("https://marktplaats.nl.evil.example/v/m123")).toBe(false);
  expect(isMarktplaatsUrl(undefined)).toBe(false);
});
