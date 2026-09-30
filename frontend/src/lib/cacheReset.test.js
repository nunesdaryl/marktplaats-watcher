import { expect, test, vi } from "vitest";
import { cacheResetScript } from "./cacheReset.js";

function runScript(value) {
  const store = new Map(value === null ? [] : [["mw-cache-reset", value]]);
  const win = {
    localStorage: { getItem: vi.fn((key) => store.get(key) ?? null), setItem: vi.fn((key, next) => store.set(key, next)) },
    fetch: vi.fn().mockResolvedValue({ ok: true }),
    location: { reload: vi.fn() },
  };
  return { win, store, run: () => new Function("window", cacheResetScript)(win) };
}

test("fetches the purge endpoint once, then records the browser flag", async () => {
  const { win, store, run } = runScript(null);
  await run();
  expect(win.fetch).toHaveBeenCalledWith("/cache-reset.txt?v=1", { cache: "no-store" });
  expect(store.get("mw-cache-reset")).toBe("1");
  await run();
  expect(win.fetch).toHaveBeenCalledTimes(1);
  expect(win.location.reload).not.toHaveBeenCalled();
});

test("a flagged browser does not fetch the purge endpoint", async () => {
  const { win, run } = runScript("1");
  await run();
  expect(win.fetch).not.toHaveBeenCalled();
});

test("unavailable local storage skips the purge", async () => {
  const { win, run } = runScript(null);
  win.localStorage.getItem = () => { throw new Error("Storage blocked"); };
  await run();
  expect(win.fetch).not.toHaveBeenCalled();
});
