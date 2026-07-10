import { v } from "convex/values";
import { query } from "./_generated/server";
import { getCurrentAppAccess } from "./lib/appAccess";

// Public access query returns a discriminated union instead of leaking auth
// implementation details to React components.
const allowedOrganization = v.object({
  organizationDetailId: v.optional(v.id("organizationReferentDetails")),
  organizationEntryId: v.optional(v.id("organizationEntries")),
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
const systemRole = v.literal("systemAdmin");

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
    systemRole: v.optional(systemRole),
  }),
);

export const getCurrentUserAccess = query({
  args: {},
  returns: appAccessState,
  handler: async (ctx) => {
    return await getCurrentAppAccess(ctx);
  },
});
