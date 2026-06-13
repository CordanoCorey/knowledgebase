import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const BASE_HUMAN_WEIGHT = 0;
const DEFAULT_CONTEXT_TAG_LABELS: string[] = [];

export const DEFAULT_ORGANIZATION_SEEDS = [
  {
    canonicalKey: "arche-classical-academy",
    kind: "school",
    name: "Arche Classical Academy",
    previewText: "School organization.",
  },
  {
    canonicalKey: "ruler-of-kings-church",
    kind: "church",
    name: "Ruler of Kings Church",
    previewText: "Church organization.",
  },
] as const;

export const DEFAULT_USER_SEEDS = [
  {
    email: "gelbaughcm@gmail.com",
    memberships: [
      { organizationKey: "arche-classical-academy", role: "admin" },
      { organizationKey: "ruler-of-kings-church", role: "admin" },
    ],
    name: "gelbaughcm@gmail.com",
    tempPassword: "Temp-Gelbaugh-2026!",
  },
  {
    email: "corey@rulerofkingschurch.com",
    memberships: [
      { organizationKey: "ruler-of-kings-church", role: "admin" },
      { organizationKey: "arche-classical-academy", role: "member" },
    ],
    name: "corey@rulerofkingschurch.com",
    tempPassword: "Temp-Corey-Rok-2026!",
  },
  {
    email: "corey@archeclassicalacademy.com",
    memberships: [
      { organizationKey: "arche-classical-academy", role: "admin" },
      { organizationKey: "ruler-of-kings-church", role: "member" },
    ],
    name: "corey@archeclassicalacademy.com",
    tempPassword: "Temp-Corey-Arche-2026!",
  },
] as const;

const seededUserInput = v.object({
  email: v.string(),
  name: v.string(),
  userId: v.id("users"),
});

type KnowledgeType = Doc<"referents">["knowledgeType"];
type OrganizationKind = Doc<"organizationEntries">["organizationKind"];
type SeededUser = {
  email: string;
  name: string;
  userId: Id<"users">;
};
type SeedStats = {
  inserted: number;
  skipped: number;
  updated: number;
};
type SeedResult = {
  memberships: SeedStats;
  organizations: SeedStats;
  profiles: SeedStats;
  users: SeedStats;
};
type UpsertState = "inserted" | "skipped" | "updated";

export const upsertDefaultOrganizationsAndMemberships = internalMutation({
  args: {
    users: v.array(seededUserInput),
  },
  handler: async (ctx, args): Promise<SeedResult> => {
    const now = Date.now();
    const stats = {
      memberships: emptyStats(),
      organizations: emptyStats(),
      profiles: emptyStats(),
      users: emptyStats(),
    };
    const organizationReferentIds = new Map<string, Id<"referents">>();
    const usersByEmail = new Map(
      args.users.map((user) => [normalizeEmail(user.email), user]),
    );

    for (const organization of DEFAULT_ORGANIZATION_SEEDS) {
      const result = await upsertOrganization(ctx, organization, now);
      organizationReferentIds.set(
        organization.canonicalKey,
        result.organizationReferentId,
      );
      count(stats.organizations, result.state);
    }

    for (const userSeed of DEFAULT_USER_SEEDS) {
      const seededUser = usersByEmail.get(normalizeEmail(userSeed.email));
      if (!seededUser) {
        throw new Error(`Missing seeded user ${userSeed.email}.`);
      }

      const userState = await updateSeededUser(ctx, seededUser);
      count(stats.users, userState);

      const profileResult = await upsertUserProfile(ctx, seededUser, now);
      count(stats.profiles, profileResult.state);

      for (const membership of userSeed.memberships) {
        const organizationReferentId = organizationReferentIds.get(
          membership.organizationKey,
        );
        if (!organizationReferentId) {
          throw new Error(`Missing organization ${membership.organizationKey}.`);
        }

        const membershipState = await upsertOrganizationMembership(ctx, {
          memberUserId: seededUser.userId,
          organizationReferentId,
          personReferentId: profileResult.personReferentId,
          role: membership.role,
          updatedAt: now,
        });
        count(stats.memberships, membershipState);
      }
    }

    return stats;
  },
});

export const verifyDefaultOrganizationsSeed = internalQuery({
  args: {},
  handler: async (ctx) => {
    const organizations = [];
    const users = [];

    for (const organization of DEFAULT_ORGANIZATION_SEEDS) {
      const referent = await getReferentByKey(
        ctx,
        "organization",
        organization.canonicalKey,
      );
      const entry = referent
        ? await getKnowledgeEntryByReferent(ctx, referent._id, "organization")
        : null;
      const organizationEntry = entry
        ? await getOrganizationEntryByEntryId(ctx, entry._id)
        : null;

      organizations.push({
        canonicalKey: organization.canonicalKey,
        exists: Boolean(referent && entry && organizationEntry),
        isActive: organizationEntry?.isActive ?? null,
        kind: organizationEntry?.organizationKind ?? null,
        name: referent?.canonicalName ?? null,
      });
    }

    for (const userSeed of DEFAULT_USER_SEEDS) {
      const user = await getUserByEmail(ctx, userSeed.email);
      const activeMemberships = user
        ? await ctx.db
            .query("memberships")
            .withIndex("by_memberUserId_and_membershipStatus", (q) =>
              q.eq("memberUserId", user._id).eq("membershipStatus", "active"),
            )
            .take(10)
        : [];

      users.push({
        activeMemberships: activeMemberships.map((membership) => ({
          organizationReferentId: membership.organizationReferentId ?? null,
          role: membership.memberRole ?? null,
        })),
        email: userSeed.email,
        exists: Boolean(user),
        isActive: user?.isActive ?? null,
      });
    }

    return { organizations, users };
  },
});

async function upsertOrganization(
  ctx: MutationCtx,
  organization: {
    canonicalKey: string;
    kind: OrganizationKind;
    name: string;
    previewText: string;
  },
  now: number,
) {
  const referentId = await upsertReferent(ctx, {
    canonicalKey: organization.canonicalKey,
    canonicalName: organization.name,
    knowledgeType: "organization",
  });
  const tagId = await upsertPrimaryTag(ctx, {
    knowledgeType: "organization",
    label: organization.name,
    lookupKey: organization.canonicalKey,
    referentId,
  });
  const entryId = await upsertKnowledgeEntry(ctx, {
    knowledgeType: "organization",
    previewText: organization.previewText,
    primaryTagId: tagId,
    primaryTagLabel: organization.name,
    representedReferentId: referentId,
    searchText: `${organization.name} ${organization.kind}`,
    title: organization.name,
    updatedAt: now,
  });
  const organizationEntry = await getOrganizationEntryByEntryId(ctx, entryId);

  if (!organizationEntry) {
    await ctx.db.insert("organizationEntries", {
      entryId,
      isActive: true,
      organizationKind: organization.kind,
    });
    return { organizationReferentId: referentId, state: "inserted" as const };
  }

  const patch: Partial<Doc<"organizationEntries">> = {};
  if (organizationEntry.organizationKind !== organization.kind) {
    patch.organizationKind = organization.kind;
  }
  if (organizationEntry.isActive !== true) {
    patch.isActive = true;
  }
  if (hasPatch(patch)) {
    await ctx.db.patch(organizationEntry._id, patch);
    return { organizationReferentId: referentId, state: "updated" as const };
  }

  return { organizationReferentId: referentId, state: "skipped" as const };
}

async function updateSeededUser(
  ctx: MutationCtx,
  user: SeededUser,
): Promise<UpsertState> {
  const existingUser = await ctx.db.get(user.userId);
  if (!existingUser) {
    throw new Error(`Missing user ${user.email}.`);
  }

  const patch: Partial<Doc<"users">> = {};
  if (existingUser.email !== user.email) {
    patch.email = user.email;
  }
  if (existingUser.name !== user.name) {
    patch.name = user.name;
  }
  if (existingUser.isActive !== true) {
    patch.isActive = true;
  }

  if (!hasPatch(patch)) {
    return "skipped";
  }

  await ctx.db.patch(user.userId, patch);
  return "updated";
}

async function upsertUserProfile(
  ctx: MutationCtx,
  user: SeededUser,
  now: number,
) {
  const existingProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", user.userId))
    .unique();

  if (existingProfile) {
    return {
      personReferentId: existingProfile.personReferentId,
      state: "skipped" as const,
    };
  }

  const canonicalKey = `user:${normalizeEmail(user.email)}`;
  const personReferentId = await upsertReferent(ctx, {
    canonicalKey,
    canonicalName: user.name,
    knowledgeType: "person",
  });
  const personTagId = await upsertPrimaryTag(ctx, {
    knowledgeType: "person",
    label: user.name,
    lookupKey: canonicalKey,
    referentId: personReferentId,
  });
  const personEntryId = await upsertKnowledgeEntry(ctx, {
    knowledgeType: "person",
    previewText: user.email,
    primaryTagId: personTagId,
    primaryTagLabel: user.name,
    representedReferentId: personReferentId,
    searchText: `${user.name} ${user.email}`,
    title: user.name,
    updatedAt: now,
  });

  const personEntry = await ctx.db
    .query("personEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", personEntryId))
    .unique();
  if (!personEntry) {
    await ctx.db.insert("personEntries", { entryId: personEntryId });
  }

  await ctx.db.insert("userProfiles", {
    createdAt: now,
    personEntryId,
    personReferentId,
    personTagId,
    updatedAt: now,
    userId: user.userId,
  });

  return { personReferentId, state: "inserted" as const };
}

async function upsertOrganizationMembership(
  ctx: MutationCtx,
  membership: {
    memberUserId: Id<"users">;
    organizationReferentId: Id<"referents">;
    personReferentId: Id<"referents">;
    role: string;
    updatedAt: number;
  },
): Promise<UpsertState> {
  const existingMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_memberUserId_and_organizationReferentId", (q) =>
      q
        .eq("memberUserId", membership.memberUserId)
        .eq("organizationReferentId", membership.organizationReferentId),
    )
    .take(10);
  const existingMembership = existingMemberships[0];

  if (!existingMembership) {
    await ctx.db.insert("memberships", {
      createdAt: membership.updatedAt,
      memberRole: membership.role,
      memberUserId: membership.memberUserId,
      membershipStatus: "active",
      organizationReferentId: membership.organizationReferentId,
      personReferentId: membership.personReferentId,
      targetKind: "organization",
      updatedAt: membership.updatedAt,
    });
    return "inserted";
  }

  const patch: Partial<Doc<"memberships">> = {};
  if (existingMembership.memberRole !== membership.role) {
    patch.memberRole = membership.role;
  }
  if (existingMembership.membershipStatus !== "active") {
    patch.membershipStatus = "active";
  }
  if (existingMembership.personReferentId !== membership.personReferentId) {
    patch.personReferentId = membership.personReferentId;
  }
  if (existingMembership.targetKind !== "organization") {
    patch.targetKind = "organization";
  }
  if (hasPatch(patch)) {
    patch.updatedAt = membership.updatedAt;
    await ctx.db.patch(existingMembership._id, patch);
    return "updated";
  }

  return "skipped";
}

async function upsertReferent(
  ctx: MutationCtx,
  referent: {
    canonicalKey: string;
    canonicalName: string;
    knowledgeType: KnowledgeType;
  },
) {
  const existingReferent = await getReferentByKey(
    ctx,
    referent.knowledgeType,
    referent.canonicalKey,
  );
  if (!existingReferent) {
    return await ctx.db.insert("referents", referent);
  }

  const patch: Partial<Doc<"referents">> = {};
  if (existingReferent.canonicalName !== referent.canonicalName) {
    patch.canonicalName = referent.canonicalName;
  }
  if (hasPatch(patch)) {
    await ctx.db.patch(existingReferent._id, patch);
  }

  return existingReferent._id;
}

async function upsertPrimaryTag(
  ctx: MutationCtx,
  tag: {
    knowledgeType: KnowledgeType;
    label: string;
    lookupKey: string;
    referentId: Id<"referents">;
  },
) {
  const existingTag = await ctx.db
    .query("tags")
    .withIndex("by_knowledgeType_and_lookupKey", (q) =>
      q.eq("knowledgeType", tag.knowledgeType).eq("lookupKey", tag.lookupKey),
    )
    .unique();
  if (!existingTag) {
    return await ctx.db.insert("tags", tag);
  }

  const patch: Partial<Doc<"tags">> = {};
  if (existingTag.label !== tag.label) {
    patch.label = tag.label;
  }
  if (existingTag.referentId !== tag.referentId) {
    patch.referentId = tag.referentId;
  }
  if (hasPatch(patch)) {
    await ctx.db.patch(existingTag._id, patch);
  }

  return existingTag._id;
}

async function upsertKnowledgeEntry(
  ctx: MutationCtx,
  entry: {
    knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
    previewText: string;
    primaryTagId: Id<"tags">;
    primaryTagLabel: string;
    representedReferentId: Id<"referents">;
    searchText: string;
    title: string;
    updatedAt: number;
  },
) {
  const existingEntry = await getKnowledgeEntryByReferent(
    ctx,
    entry.representedReferentId,
    entry.knowledgeType,
  );

  const nextEntry = {
    contextPreviewTagLabels: DEFAULT_CONTEXT_TAG_LABELS,
    discoverabilityKind: "public" as const,
    discoverabilityTargetKey: "public",
    humanWeight: BASE_HUMAN_WEIGHT,
    knowledgeType: entry.knowledgeType,
    previewText: entry.previewText,
    primaryTagId: entry.primaryTagId,
    primaryTagLabel: entry.primaryTagLabel,
    representedReferentId: entry.representedReferentId,
    searchText: entry.searchText,
    title: entry.title,
    visibilityKind: "public" as const,
    visibilityTargetKey: "public",
  };

  if (!existingEntry) {
    return await ctx.db.insert("knowledgeEntries", {
      ...nextEntry,
      createdAt: entry.updatedAt,
      updatedAt: entry.updatedAt,
    });
  }

  const patch: Partial<Doc<"knowledgeEntries">> = {};
  if (existingEntry.title !== nextEntry.title) {
    patch.title = nextEntry.title;
  }
  if (existingEntry.previewText !== nextEntry.previewText) {
    patch.previewText = nextEntry.previewText;
  }
  if (existingEntry.searchText !== nextEntry.searchText) {
    patch.searchText = nextEntry.searchText;
  }
  if (existingEntry.primaryTagId !== nextEntry.primaryTagId) {
    patch.primaryTagId = nextEntry.primaryTagId;
  }
  if (existingEntry.primaryTagLabel !== nextEntry.primaryTagLabel) {
    patch.primaryTagLabel = nextEntry.primaryTagLabel;
  }
  if (hasPatch(patch)) {
    patch.updatedAt = entry.updatedAt;
    await ctx.db.patch(existingEntry._id, patch);
  }

  return existingEntry._id;
}

async function getReferentByKey(
  ctx: QueryCtx | MutationCtx,
  knowledgeType: KnowledgeType,
  canonicalKey: string,
) {
  return await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q.eq("knowledgeType", knowledgeType).eq("canonicalKey", canonicalKey),
    )
    .unique();
}

async function getKnowledgeEntryByReferent(
  ctx: QueryCtx | MutationCtx,
  representedReferentId: Id<"referents">,
  knowledgeType: Doc<"knowledgeEntries">["knowledgeType"],
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", representedReferentId),
    )
    .take(10);

  return entries.find((entry) => entry.knowledgeType === knowledgeType) ?? null;
}

async function getOrganizationEntryByEntryId(
  ctx: QueryCtx | MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  return await ctx.db
    .query("organizationEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
    .unique();
}

async function getUserByEmail(ctx: QueryCtx, email: string) {
  return await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", normalizeEmail(email)))
    .unique();
}

function emptyStats(): SeedStats {
  return { inserted: 0, skipped: 0, updated: 0 };
}

function count(stats: SeedStats, state: UpsertState) {
  stats[state] += 1;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hasPatch(patch: object) {
  return Object.keys(patch).length > 0;
}
