import { beforeEach, expect, test, vi } from "vitest";
import * as React from "react";
vi.stubGlobal("React", React);

const state = vi.hoisted(() => ({ slots: [], index: 0 }));
vi.mock("react", async (original) => ({
  ...await original(),
  useState(initial) {
    const i = state.index++;
    if (state.slots[i] === undefined) state.slots[i] = initial;
    return [state.slots[i], (value) => { state.slots[i] = value; }];
  },
  useEffect: () => {},
}));
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));
import OfferSheet from "./OfferSheet.jsx";

const draft = { openingEur: 100, maxEur: 120, openingReason: "Based on €140 asking price.",
  maxReason: "Within the watch limit.", messageNl: "Hallo, ophalen?", messageEn: "Hello, pickup?" };
const props = { listing: { title: "Bike", url: "https://www.marktplaats.nl/bike", priceEur: 140 }, onClose: vi.fn() };
const children = (node) => {
  if (!node || typeof node !== "object") return [];
  return [node, ...[node.props?.children].flat(Infinity).flatMap(children)];
};
const render = () => { state.index = 0; return children(OfferSheet(props)); };

beforeEach(() => { state.slots = [draft, "", "nl", false]; });

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
