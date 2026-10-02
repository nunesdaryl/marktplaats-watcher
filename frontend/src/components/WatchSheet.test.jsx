import { beforeEach, expect, test, vi } from "vitest";
import * as React from "react";

const hooks = vi.hoisted(() => ({ slots: [], index: 0 }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal();
  return {
    ...react,
    useState(initial) {
      const index = hooks.index++;
      if (!hooks.slots[index]) hooks.slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [hooks.slots[index].value, (value) => { hooks.slots[index].value = value; }];
    },
    useRef(initial) {
      const index = hooks.index++;
      if (!hooks.slots[index]) hooks.slots[index] = { current: initial };
      return hooks.slots[index];
    },
    useEffect(effect, deps) {
      const index = hooks.index++;
      const slot = hooks.slots[index];
      if (slot && deps.every((value, i) => Object.is(value, slot.deps[i]))) return;
      slot?.cleanup?.();
      hooks.slots[index] = { deps, cleanup: effect() };
    },
  };
});
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => ({ getToken: async () => "token" }) }));

import WatchSheet from "./WatchSheet.jsx";

function findInput(element) {
  if (!element || typeof element !== "object") return null;
  if (element.type === "input" && element.props.placeholder === "Mac mini") return element;
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findInput(child);
    if (found) return found;
  }
  return null;
}

function render() {
  hooks.index = 0;
  return findInput(WatchSheet({ mode: "create", initial: { query: "iphone", volumeNote: "Narrow this search" }, onClose: () => {} }));
}

beforeEach(() => {
  hooks.slots = [];
  hooks.index = 0;
  vi.useFakeTimers();
  vi.stubGlobal("React", React);
});

test("the sheet waits for a change, then estimates on blur or after 800 ms", async () => {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ volumeNote: null }) }));
  vi.stubGlobal("fetch", fetch);
  const input = render();
  await vi.advanceTimersByTimeAsync(800);
  expect(fetch).not.toHaveBeenCalled();

  input.props.onChange({ target: { value: "iphone 15" } });
  const changed = render();
  await vi.advanceTimersByTimeAsync(799);
  expect(fetch).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(1);
  changed.props.onBlur();
  render();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);

  changed.props.onChange({ target: { value: "iphone 15 pro" } });
  render().props.onBlur();
  render();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
