import { expect, test, vi } from "vitest";
import * as React from "react";

const hooks = vi.hoisted(() => ({ values: [], index: 0, refs: [], refIndex: 0 }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal(),
  useState(initial) {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value) => {
      hooks.values[index] = typeof value === "function" ? value(hooks.values[index]) : value;
    }];
  },
  useRef(initial) {
    const index = hooks.refIndex++;
    return hooks.refs[index] ??= { current: initial };
  },
  useEffect() {},
  useId: () => "picker-test",
}));

import Composer from "./Composer.jsx";
vi.stubGlobal("React", React);

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}

test("choosing a template fills the composer, selects a variable, and never sends", () => {
  hooks.values = []; hooks.refs = []; hooks.index = 0; hooks.refIndex = 0;
  const focus = vi.fn();
  const setSelectionRange = vi.fn();
  hooks.refs[0] = { current: { focus, setSelectionRange } };
  vi.stubGlobal("requestAnimationFrame", (callback) => callback());
  const onSend = vi.fn();
  const onModeChange = vi.fn();
  const render = () => {
    hooks.index = 0; hooks.refIndex = 0;
    return Composer({ onSend, onModeChange, mode: "search" });
  };
  const trigger = nodes(render()).find((node) => node.type === "button" && node.props.children === "Templates");
  trigger.props.onClick();
  const dutch = nodes(render()).find((node) => node.type === "button" &&
    nodes(node).some((child) => child.type === "span" && child.props.children === "Een selectie in het Nederlands"));
  dutch.props.onClick();
  const tree = render();
  const textarea = nodes(tree).find((node) => node.type === "textarea");
  expect(textarea.props.value).toContain("€[budget]");
  expect(nodes(tree).filter((node) => node.type === "mark").map((node) => node.props.children))
    .toEqual(["[product]", "[titelwoord]", "[budget]"]);
  expect(setSelectionRange).toHaveBeenCalledWith(5, 14);
  expect(focus).toHaveBeenCalledOnce();
  expect(onModeChange).toHaveBeenCalledWith("watch");
  expect(onSend).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
