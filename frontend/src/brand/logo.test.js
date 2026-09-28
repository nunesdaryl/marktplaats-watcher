import { describe, expect, test } from "vitest";
import { LENS_OPTIONS, LOGO, logoSvg } from "./logo.js";

describe("logo", () => {
  test("the configured logo is a self-contained SVG", () => {
    const svg = logoSvg();
    expect(svg.startsWith("<svg") && svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).not.toMatch(/<script|on\w+=|href=/i);     // safe to inline
    expect(LENS_OPTIONS).toContain(LOGO.lens);
  });

  test("switching the lens changes only what the robot sees", () => {
    const [a, b] = [logoSvg({ lens: "dot" }), logoSvg({ lens: "marktplaats" })];
    expect(a).not.toBe(b);
    expect(b).toContain("#eda566");
    expect(a).not.toContain("#eda566");
    for (const lens of LENS_OPTIONS) expect(logoSvg({ lens })).toContain("<svg");
  });

  test("the sieve mark and a size can be requested", () => {
    expect(logoSvg({ mark: "sieve" })).not.toContain("#eda566");
    expect(logoSvg({ size: 180 })).toContain('width="180" height="180"');
  });
});
