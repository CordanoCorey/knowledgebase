import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

// Access checks are centralized so public Convex functions derive authorization
// from the authenticated user, not from client-supplied IDs.
const MAX_ACTIVE_MEMBERSHIPS_TO_CHECK = 50;
const MAX_ORGANIZATION_ENTRIES_PER_REFERENT = 10;
const MAX_SYSTEM_ADMIN_ORGANIZATION_REFERENCES_PER_KIND = 100;
const ORGANIZATION_KINDS = ["school", "church", "family", "community"] as const;

type AppAccessCtx = QueryCtx | MutationCtx;
type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

export type AllowedOrganization = {
  organizationDetailId?: Id<"organizationReferentDetails">;
  organizationEntryId?: Id<"organizationEntries">;
  organizationKind: OrganizationKind;
  organizationReferentId: Id<"referents">;
  name: string;
  role: string;
};
export type SystemRole = NonNullable<Doc<"users">["systemRole"]>;

export type AppAccessState =
  | { status: "unauthenticated" }
  | { email?: string; status: "inactiveUser"; userId: Id<"users"> }
  | { email?: string; status: "needsOrganization"; userId: Id<"users"> }
  | {
      email?: string;
      organizations: AllowedOrganization[];
      status: "allowed";
      systemRole?: SystemRole;
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
  const systemRole = user.systemRole;
  const hasSystemAdminAccess = systemRole === "systemAdmin";

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

  if (hasSystemAdminAccess) {
    const systemAdminOrganizations = await listActiveOrganizations(ctx);
    const organizationIds = new Set(
      organizations.map((organization) => organization.organizationReferentId),
    );
    for (const organization of systemAdminOrganizations) {
      if (organizationIds.has(organization.organizationReferentId)) {
        continue;
      }

      organizations.push({
        ...organization,
        role: "admin",
      });
      organizationIds.add(organization.organizationReferentId);
    }
  }

  if (organizations.length === 0 && !hasSystemAdminAccess) {
    return { ...identity, status: "needsOrganization" };
  }

  return {
    ...identity,
    organizations,
    status: "allowed",
    ...(systemRole === undefined ? {} : { systemRole }),
  };
}

export async function requireAppAccess(ctx: AppAccessCtx) {
  const access = await getCurrentAppAccess(ctx);
  if (access.status !== "allowed") {
    throw new Error("Unauthorized");
  }
  return access;
}

export async function requireSystemAdmin(ctx: AppAccessCtx) {
  const access = await requireAppAccess(ctx);
  if (access.systemRole !== "systemAdmin") {
    throw new Error("Unauthorized");
  }
  return access;
}

export async function requireOrganizationAdmin(
  ctx: AppAccessCtx,
  organizationReferentId: Id<"referents">,
) {
  const access = await requireAppAccess(ctx);
  if (access.systemRole === "systemAdmin") {
    return access;
  }

  const adminMembership = access.organizations.find((organization) => {
    return (
      organization.organizationReferentId === organizationReferentId &&
      organization.role === "admin"
    );
  });
  if (!adminMembership) {
    throw new Error("Unauthorized");
  }

  return access;
}

async function getActiveOrganization(
  ctx: AppAccessCtx,
  organizationReferentId: Id<"referents">,
): Promise<Omit<AllowedOrganization, "role"> | null> {
  const referent = await ctx.db.get(organizationReferentId);
  if (!referent || referent.knowledgeType !== "organization") {
    return null;
  }

  const detail = await ctx.db
    .query("organizationReferentDetails")
    .withIndex("by_referentId", (q) => q.eq("referentId", organizationReferentId))
    .unique();
  if (detail) {
    if (detail.isActive === false) {
      return null;
    }

    return {
      organizationDetailId: detail._id,
      organizationKind: detail.organizationKind,
      organizationReferentId,
      name: referent.canonicalName,
    };
  }

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

async function listActiveOrganizations(
  ctx: AppAccessCtx,
): Promise<Array<Omit<AllowedOrganization, "role">>> {
  const organizations: Array<Omit<AllowedOrganization, "role">> = [];
  const seenOrganizationReferentIds = new Set<string>();

  for (const organizationKind of ORGANIZATION_KINDS) {
    const details = await ctx.db
      .query("organizationReferentDetails")
      .withIndex("by_organizationKind", (q) =>
        q.eq("organizationKind", organizationKind),
      )
      .take(MAX_SYSTEM_ADMIN_ORGANIZATION_REFERENCES_PER_KIND);

    for (const detail of details) {
      if (detail.isActive === false) {
        continue;
      }

      const referent = await ctx.db.get(detail.referentId);
      if (!referent || referent.knowledgeType !== "organization") {
        continue;
      }
      if (seenOrganizationReferentIds.has(detail.referentId)) {
        continue;
      }

      organizations.push({
        organizationDetailId: detail._id,
        organizationKind: detail.organizationKind,
        organizationReferentId: detail.referentId,
        name: referent.canonicalName,
      });
      seenOrganizationReferentIds.add(detail.referentId);
    }

    const organizationEntries = await ctx.db
      .query("organizationEntries")
      .withIndex("by_organizationKind", (q) =>
        q.eq("organizationKind", organizationKind),
      )
      .take(MAX_SYSTEM_ADMIN_ORGANIZATION_REFERENCES_PER_KIND);

    for (const organizationEntry of organizationEntries) {
      if (organizationEntry.isActive === false) {
        continue;
      }

      const entry = await ctx.db.get(organizationEntry.entryId);
      if (!entry || entry.knowledgeType !== "organization") {
        continue;
      }
      if (seenOrganizationReferentIds.has(entry.representedReferentId)) {
        continue;
      }

      organizations.push({
        organizationEntryId: organizationEntry._id,
        organizationKind: organizationEntry.organizationKind,
        organizationReferentId: entry.representedReferentId,
        name: entry.title,
      });
      seenOrganizationReferentIds.add(entry.representedReferentId);
    }
  }

  return organizations;
}

function getUserIdentityFields(userId: Id<"users">, email?: string) {
  return {
    ...(email === undefined ? {} : { email }),
    userId,
  };
}
