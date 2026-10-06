import { expect, test } from "vitest";
import { TEMPLATES, TEMPLATES_VERSION } from "./templates.js";

test("the versioned catalog has unique, editable, short prompts", () => {
  expect(TEMPLATES_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(TEMPLATES.length);
  expect(TEMPLATES).toHaveLength(12);
  for (const template of TEMPLATES) {
    expect(template.id).toMatch(/^[a-z][a-z-]+$/);
    expect(template.purpose.length).toBeGreaterThan(0);
    expect(["en", "nl"]).toContain(template.language);
    expect(["search", "watch"]).toContain(template.mode);
    expect(template.text.length).toBeLessThanOrEqual(500);
    expect(template.variables.length).toBeGreaterThan(0);
    expect(new Set(template.variables).size).toBe(template.variables.length);
    const placeholders = [...template.text.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);
    expect(new Set(placeholders)).toEqual(new Set(template.variables));
  }
});
