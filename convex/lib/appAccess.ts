import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const MAX_ACTIVE_MEMBERSHIPS_TO_CHECK = 50;
const MAX_ORGANIZATION_ENTRIES_PER_REFERENT = 10;

type AppAccessCtx = QueryCtx | MutationCtx;

export type AllowedOrganization = {
  organizationEntryId: Id<"organizationEntries">;
  organizationKind: Doc<"organizationEntries">["organizationKind"];
  organizationReferentId: Id<"referents">;
  name: string;
  role: string;
};

export type AppAccessState =
  | { status: "unauthenticated" }
  | { email?: string; status: "inactiveUser"; userId: Id<"users"> }
  | { email?: string; status: "needsOrganization"; userId: Id<"users"> }
  | {
      email?: string;
      organizations: AllowedOrganization[];
      status: "allowed";
      userId: Id<"users">;
    };

export async function getCurrentAppAccess(
  ctx: AppAccessCtx,
): Promise<AppAccessState> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return { status: "unauthenticated" };
  }

  const user = await ctx.db.get(userId);
  const identity = getUserIdentityFields(userId, user?.email);
  if (!user || user.isActive !== true) {
    return { ...identity, status: "inactiveUser" };
  }

  const activeMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_memberUserId_and_membershipStatus", (q) =>
      q.eq("memberUserId", userId).eq("membershipStatus", "active"),
    )
    .take(MAX_ACTIVE_MEMBERSHIPS_TO_CHECK);
  const organizations: AllowedOrganization[] = [];

  for (const membership of activeMemberships) {
    if (
      membership.targetKind !== "organization" ||
      membership.organizationReferentId === undefined
    ) {
      continue;
    }

    const organization = await getActiveOrganization(
      ctx,
      membership.organizationReferentId,
    );
    if (!organization) {
      continue;
    }

    organizations.push({
      ...organization,
      role: membership.memberRole ?? "member",
    });
  }

  if (organizations.length === 0) {
    return { ...identity, status: "needsOrganization" };
  }

  return {
    ...identity,
    organizations,
    status: "allowed",
  };
}

export async function requireAppAccess(ctx: AppAccessCtx) {
  const access = await getCurrentAppAccess(ctx);
  if (access.status !== "allowed") {
    throw new Error("Unauthorized");
  }
  return access;
}

async function getActiveOrganization(
  ctx: AppAccessCtx,
  organizationReferentId: Id<"referents">,
): Promise<Omit<AllowedOrganization, "role"> | null> {
  const organizationEntries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", organizationReferentId),
    )
    .take(MAX_ORGANIZATION_ENTRIES_PER_REFERENT);

  for (const entry of organizationEntries) {
    if (entry.knowledgeType !== "organization") {
      continue;
    }

    const organizationEntry = await ctx.db
      .query("organizationEntries")
      .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
      .unique();
    if (!organizationEntry || organizationEntry.isActive === false) {
      continue;
    }

    return {
      organizationEntryId: organizationEntry._id,
      organizationKind: organizationEntry.organizationKind,
      organizationReferentId,
      name: entry.title,
    };
  }

  return null;
}

function getUserIdentityFields(userId: Id<"users">, email?: string) {
  return {
    ...(email === undefined ? {} : { email }),
    userId,
  };
}
