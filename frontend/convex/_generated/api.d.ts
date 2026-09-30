/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as analytics from "../analytics.js";
import type * as chats from "../chats.js";
import type * as checker from "../checker.js";
import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as feedback from "../feedback.js";
import type * as folders from "../folders.js";
import type * as health from "../health.js";
import type * as ratings from "../ratings.js";
import type * as schedule from "../schedule.js";
import type * as users from "../users.js";
import type * as usage from "../usage.js";
import type * as watches from "../watches.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  analytics: typeof analytics;
  chats: typeof chats;
  checker: typeof checker;
  crons: typeof crons;
  events: typeof events;
  feedback: typeof feedback;
  folders: typeof folders;
  health: typeof health;
  ratings: typeof ratings;
  schedule: typeof schedule;
  users: typeof users;
  usage: typeof usage;
  watches: typeof watches;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
