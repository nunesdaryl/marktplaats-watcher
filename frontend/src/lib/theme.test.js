import { describe, expect, test } from "vitest";
import { resolveTheme } from "./theme.js";

describe("resolveTheme", () => {
  test("follows the device until a theme is picked", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  test("a picked theme wins over the device", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  test("anything unknown follows the device", () => {
    expect(resolveTheme(undefined, true)).toBe("dark");
    expect(resolveTheme("purple", false)).toBe("light");
  });
});
