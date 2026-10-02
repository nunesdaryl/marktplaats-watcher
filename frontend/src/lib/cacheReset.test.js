import { expect, test, vi } from "vitest";
import { cacheResetScript } from "./cacheReset.js";

function runScript(value) {
  const store = new Map(value === null ? [] : [["mw-cache-reset", value]]);
  const win = {
    localStorage: { getItem: vi.fn((key) => store.get(key) ?? null), setItem: vi.fn((key, next) => store.set(key, next)) },
    fetch: vi.fn().mockResolvedValue({ ok: true }),
    location: { reload: vi.fn() },
  };
  return { win, store, run: () => new Function("window", `return ${cacheResetScript}`)(win) };
}

test("records the browser flag before fetching the purge endpoint", async () => {
  const { win, store, run } = runScript(null);
  let flagAtFetch;
  win.fetch.mockImplementation(() => {
    flagAtFetch = store.get("mw-cache-reset");
    return Promise.resolve({ ok: true });
  });
  await run();
  expect(flagAtFetch).toBe("1");
  expect(win.fetch).toHaveBeenCalledWith("/cache-reset.txt?v=1", { cache: "no-store" });
  await run();
  expect(win.fetch).toHaveBeenCalledTimes(1);
  expect(win.location.reload).not.toHaveBeenCalled();
});

test("a flagged browser does not fetch the purge endpoint", async () => {
  const { win, run } = runScript("1");
  await run();
  expect(win.fetch).not.toHaveBeenCalled();
});

test("a storage read failure still fetches the purge endpoint", async () => {
  const { win, run } = runScript(null);
  win.localStorage.getItem = () => { throw new Error("Storage blocked"); };
  await expect(run()).resolves.toBeUndefined();
  expect(win.fetch).toHaveBeenCalledTimes(1);
});

test("a storage write failure still fetches the purge endpoint", async () => {
  const { win, run } = runScript(null);
  win.localStorage.setItem = () => { throw new Error("Storage blocked"); };
  await expect(run()).resolves.toBeUndefined();
  expect(win.fetch).toHaveBeenCalledTimes(1);
});
