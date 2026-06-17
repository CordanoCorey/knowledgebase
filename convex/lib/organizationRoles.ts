import { v } from "convex/values";

export const ORGANIZATION_MEMBERSHIP_ROLES = ["admin", "member"] as const;

export const organizationMembershipRole = v.union(
  v.literal("admin"),
  v.literal("member"),
);

export type OrganizationMembershipRole =
  (typeof ORGANIZATION_MEMBERSHIP_ROLES)[number];
