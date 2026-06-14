import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentAppAccess } from "./lib/appAccess";

const allowedOrganization = v.object({
  organizationEntryId: v.id("organizationEntries"),
  organizationKind: v.union(
    v.literal("school"),
    v.literal("church"),
    v.literal("family"),
    v.literal("community"),
  ),
  organizationReferentId: v.id("referents"),
  name: v.string(),
  role: v.string(),
});

const userIdentity = {
  email: v.optional(v.string()),
  userId: v.id("users"),
};

const appAccessState = v.union(
  v.object({
    status: v.literal("unauthenticated"),
  }),
  v.object({
    ...userIdentity,
    status: v.literal("inactiveUser"),
  }),
  v.object({
    ...userIdentity,
    status: v.literal("needsOrganization"),
  }),
  v.object({
    ...userIdentity,
    organizations: v.array(allowedOrganization),
    status: v.literal("allowed"),
  }),
);

export const getCurrentUserAccess = query({
  args: {},
  returns: appAccessState,
  handler: async (ctx) => {
    return await getCurrentAppAccess(ctx);
  },
});
