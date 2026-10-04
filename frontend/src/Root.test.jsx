import { expect, test } from "vitest";
import { clerkLook } from "./Root.jsx";

test.each([true, false])("Clerk hides development warnings in %s theme", (dark) => {
  expect(clerkLook(dark).layout).toMatchObject({
    unsafe_disableDevelopmentModeWarnings: true,
  });
});
