import { afterEach, describe, expect, test, vi } from "vitest";
import { installChunkRecovery } from "./chunkRecovery.js";

function setup() {
  const listeners = {};
  const values = new Map();
  const children = [];
  const doc = {
    body: { append: (child) => children.push(child) },
    getElementById: (id) => children.find((child) => child.id === id),
    createElement: () => ({ style: {}, parts: [], append(...parts) { this.parts.push(...parts); }, addEventListener(type, listener) { this[type] = listener; }, setAttribute() {} }),
  };
  const win = {
    location: { reload: vi.fn() },
    sessionStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    addEventListener: (type, listener) => { listeners[type] = listener; },
  };
  installChunkRecovery(win, doc);
  return { win, listeners, children, values };
}

afterEach(() => vi.restoreAllMocks());

describe("chunk recovery", () => {
  test("reloads once on a ChunkLoadError, then offers a manual reload within 60 seconds", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const { win, listeners, children } = setup();
    listeners.error({ error: { name: "ChunkLoadError", message: "Failed to load chunk /_next/static/chunks/app.js" } });
    expect(win.location.reload).toHaveBeenCalledTimes(1);

    listeners.error({ error: { name: "ChunkLoadError" } });
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    expect(children).toHaveLength(1);
    expect(children[0].parts[0]).toBe("A new version is available. ");
    expect(children[0].parts[1].textContent).toBe("Reload");
    children[0].parts[1].click();
    expect(win.location.reload).toHaveBeenCalledTimes(2);
  });

  test("handles rejected dynamic imports and allows another automatic reload after 60 seconds", () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const { win, listeners } = setup();
    listeners.unhandledrejection({ reason: new TypeError("Failed to fetch dynamically imported module: /admin.js") });
    expect(win.location.reload).toHaveBeenCalledTimes(1);
    clock.mockReturnValue(61_000);
    listeners.unhandledrejection({ reason: new Error("Loading chunk 123 failed") });
    expect(win.location.reload).toHaveBeenCalledTimes(2);
  });

  test("ignores unrelated errors", () => {
    const { win, listeners, children } = setup();
    listeners.error({ error: new Error("Connection lost") });
    listeners.unhandledrejection({ reason: new Error("Request failed") });
    expect(win.location.reload).not.toHaveBeenCalled();
    expect(children).toHaveLength(0);
  });

  test("offers manual reload if session storage is unavailable", () => {
    const { win, listeners, children } = setup();
    win.sessionStorage.getItem = () => { throw new Error("Storage blocked"); };
    listeners.error({ message: "Loading chunk 123 failed" });
    expect(win.location.reload).not.toHaveBeenCalled();
    expect(children).toHaveLength(1);
  });
});
