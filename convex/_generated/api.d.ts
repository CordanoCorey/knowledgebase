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
import type * as bookmarkedKnowledgePages from "../bookmarkedKnowledgePages.js";
import type * as contactIdentities from "../contactIdentities.js";
import type * as crons from "../crons.js";
import type * as directContributions from "../directContributions.js";
import type * as editor from "../editor.js";
import type * as http from "../http.js";
import type * as humanWeightFeedback from "../humanWeightFeedback.js";
import type * as humanWeightRecalculation from "../humanWeightRecalculation.js";
import type * as knowledgeSubscriptions from "../knowledgeSubscriptions.js";
import type * as lib_appAccess from "../lib/appAccess.js";
import type * as lib_contextExpertiseEvidence from "../lib/contextExpertiseEvidence.js";
import type * as lib_humanWeightCalculationDefinition from "../lib/humanWeightCalculationDefinition.js";
import type * as lib_humanWeightEvidence from "../lib/humanWeightEvidence.js";
import type * as lib_humanWeightRecalculation from "../lib/humanWeightRecalculation.js";
import type * as lib_organizationRoles from "../lib/organizationRoles.js";
import type * as lib_pendingMembershipClaims from "../lib/pendingMembershipClaims.js";
import type * as lib_scriptureReferences from "../lib/scriptureReferences.js";
import type * as lib_typeBehavior from "../lib/typeBehavior.js";
import type * as organizationAccounts from "../organizationAccounts.js";
import type * as pinnedKnowledgePages from "../pinnedKnowledgePages.js";
import type * as scripture from "../scripture.js";
import type * as seedOrganizations from "../seedOrganizations.js";
import type * as seedOrganizationsAction from "../seedOrganizationsAction.js";
import type * as seedScripture from "../seedScripture.js";
import type * as seedScriptureAction from "../seedScriptureAction.js";
import type * as smartStorage from "../smartStorage.js";
import type * as smartStoragePlayground from "../smartStoragePlayground.js";
import type * as userNotifications from "../userNotifications.js";

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
  bookmarkedKnowledgePages: typeof bookmarkedKnowledgePages;
  contactIdentities: typeof contactIdentities;
  crons: typeof crons;
  directContributions: typeof directContributions;
  editor: typeof editor;
  http: typeof http;
  humanWeightFeedback: typeof humanWeightFeedback;
  humanWeightRecalculation: typeof humanWeightRecalculation;
  knowledgeSubscriptions: typeof knowledgeSubscriptions;
  "lib/appAccess": typeof lib_appAccess;
  "lib/contextExpertiseEvidence": typeof lib_contextExpertiseEvidence;
  "lib/humanWeightCalculationDefinition": typeof lib_humanWeightCalculationDefinition;
  "lib/humanWeightEvidence": typeof lib_humanWeightEvidence;
  "lib/humanWeightRecalculation": typeof lib_humanWeightRecalculation;
  "lib/organizationRoles": typeof lib_organizationRoles;
  "lib/pendingMembershipClaims": typeof lib_pendingMembershipClaims;
  "lib/scriptureReferences": typeof lib_scriptureReferences;
  "lib/typeBehavior": typeof lib_typeBehavior;
  organizationAccounts: typeof organizationAccounts;
  pinnedKnowledgePages: typeof pinnedKnowledgePages;
  scripture: typeof scripture;
  seedOrganizations: typeof seedOrganizations;
  seedOrganizationsAction: typeof seedOrganizationsAction;
  seedScripture: typeof seedScripture;
  seedScriptureAction: typeof seedScriptureAction;
  smartStorage: typeof smartStorage;
  smartStoragePlayground: typeof smartStoragePlayground;
  userNotifications: typeof userNotifications;
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
