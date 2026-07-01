import { v } from "convex/values";

// Single source of truth for organization membership roles shared by schema and
// admin mutations.
export const ORGANIZATION_MEMBERSHIP_ROLES = ["admin", "member"] as const;

export const organizationMembershipRole = v.union(
  v.literal("admin"),
  v.literal("member"),
);

export type OrganizationMembershipRole =
  (typeof ORGANIZATION_MEMBERSHIP_ROLES)[number];
