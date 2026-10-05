import { convexTest } from "convex-test";
import { afterEach, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  delete process.env.MAX_USERS;
  delete process.env.OWNER_CLERK_ID;
  delete process.env.OWNER_EMAIL;
});

test("public capacity shows real places left and stays full after an account is deleted", async () => {
  process.env.MAX_USERS = "2";
  process.env.OWNER_CLERK_ID = "owner";
  process.env.OWNER_EMAIL = "owner@example.com";
  const t = convexTest(schema, modules);
  expect(await t.query(api.beta.capacity, {})).toEqual({ cap: 2, taken: 0, left: 2 });
  await t.withIdentity({ subject: "owner", email: "owner@example.com" }).mutation(api.users.store, {});
  const a = t.withIdentity({ subject: "a", email: "a@example.com" });
  await a.mutation(api.users.store, {});
  expect(await t.query(api.beta.capacity, {})).toEqual({ cap: 2, taken: 1, left: 1 });
  await t.withIdentity({ subject: "b", email: "b@example.com" }).mutation(api.users.store, {});
  expect(await t.query(api.beta.capacity, {})).toEqual({ cap: 2, taken: 2, left: 0 });
  await a.mutation(api.users.deleteMyData, {});
  expect(await t.query(api.beta.capacity, {})).toEqual({ cap: 2, taken: 2, left: 0 });
});
