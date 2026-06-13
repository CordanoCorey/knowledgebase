/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as answerFeed from "../answerFeed.js";
import type * as appAccess from "../appAccess.js";
import type * as auth from "../auth.js";
import type * as authAvailability from "../authAvailability.js";
import type * as authProviderConfig from "../authProviderConfig.js";
import type * as editor from "../editor.js";
import type * as http from "../http.js";
import type * as lib_appAccess from "../lib/appAccess.js";
import type * as lib_scriptureReferences from "../lib/scriptureReferences.js";
import type * as scripture from "../scripture.js";
import type * as seedOrganizations from "../seedOrganizations.js";
import type * as seedOrganizationsAction from "../seedOrganizationsAction.js";
import type * as seedScripture from "../seedScripture.js";
import type * as seedScriptureAction from "../seedScriptureAction.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  answerFeed: typeof answerFeed;
  appAccess: typeof appAccess;
  auth: typeof auth;
  authAvailability: typeof authAvailability;
  authProviderConfig: typeof authProviderConfig;
  editor: typeof editor;
  http: typeof http;
  "lib/appAccess": typeof lib_appAccess;
  "lib/scriptureReferences": typeof lib_scriptureReferences;
  scripture: typeof scripture;
  seedOrganizations: typeof seedOrganizations;
  seedOrganizationsAction: typeof seedOrganizationsAction;
  seedScripture: typeof seedScripture;
  seedScriptureAction: typeof seedScriptureAction;
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

export declare const components: {
  prosemirrorSync: import("@convex-dev/prosemirror-sync/_generated/component.js").ComponentApi<"prosemirrorSync">;
};
