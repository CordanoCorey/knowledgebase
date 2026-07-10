import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { OrganizationMembershipRole } from "./lib/organizationRoles";

// Organization seed data creates the canonical demo/access workspace records
// needed by local development and initial deployments.
const DEFAULT_CONTEXT_TAG_LABELS: string[] = [];
const DUPLICATE_EMAIL_ERROR = "Email is already in use by another user.";

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
  {
    canonicalKey: "my-family",
    kind: "family",
    name: "My Family",
    previewText: "Family organization.",
  },
  {
    canonicalKey: "my-community",
    kind: "community",
    name: "My Community",
    previewText: "Community organization.",
  },
] as const;

export const DEFAULT_USER_SEEDS = [
  {
    email: "gelbaughcm@gmail.com",
    memberships: [
      { organizationKey: "arche-classical-academy", role: "admin" },
      { organizationKey: "ruler-of-kings-church", role: "admin" },
      { organizationKey: "my-family", role: "admin" },
      { organizationKey: "my-community", role: "admin" },
    ],
    name: "gelbaughcm@gmail.com",
    systemRole: "systemAdmin",
    tempPassword: "Temp-Gelbaugh-2026!",
  },
  {
    email: "corey@rulerofkingschurch.com",
    memberships: [
      { organizationKey: "ruler-of-kings-church", role: "admin" },
      { organizationKey: "arche-classical-academy", role: "member" },
      { organizationKey: "my-family", role: "member" },
      { organizationKey: "my-community", role: "member" },
    ],
    name: "corey@rulerofkingschurch.com",
    tempPassword: "Temp-Corey-Rok-2026!",
  },
  {
    email: "corey@archeclassicalacademy.com",
    memberships: [
      { organizationKey: "arche-classical-academy", role: "admin" },
      { organizationKey: "ruler-of-kings-church", role: "member" },
      { organizationKey: "my-family", role: "member" },
      { organizationKey: "my-community", role: "member" },
    ],
    name: "corey@archeclassicalacademy.com",
    tempPassword: "Temp-Corey-Arche-2026!",
  },
] as const;

const seededUserInput = v.object({
  email: v.string(),
  name: v.string(),
  systemRole: v.optional(v.literal("systemAdmin")),
  userId: v.id("users"),
});

type KnowledgeType = Doc<"referents">["knowledgeType"];
type OrganizationKind = (typeof DEFAULT_ORGANIZATION_SEEDS)[number]["kind"];
type SeededUser = {
  email: string;
  name: string;
  systemRole?: "systemAdmin";
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
        await upsertOrganizationTagRecognition(ctx, {
          organizationReferentId,
          tagId: profileResult.personTagId,
          updatedAt: now,
        });
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
      const detail = referent
        ? await getOrganizationReferentDetail(ctx, referent._id)
        : null;
      const entries = referent
        ? await getKnowledgeEntriesByReferent(ctx, referent._id, "organization")
        : [];

      organizations.push({
        canonicalKey: organization.canonicalKey,
        exists: Boolean(referent && detail),
        hasKnowledgeEntry: entries.length > 0,
        isActive: detail?.isActive ?? null,
        kind: detail?.organizationKind ?? null,
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
  const detailState = await upsertOrganizationReferentDetail(ctx, {
    isActive: true,
    organizationKind: organization.kind,
    previewText: organization.previewText,
    referentId,
    searchText: `${organization.name} ${organization.kind} ${organization.previewText}`,
    updatedAt: now,
  });
  await upsertOrganizationTagRecognition(ctx, {
    organizationReferentId: referentId,
    tagId,
    updatedAt: now,
  });
  await removeLegacySeededEntry(ctx, {
    knowledgeType: "organization",
    primaryTagId: tagId,
    representedReferentId: referentId,
  });

  return { organizationReferentId: referentId, state: detailState };
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
  const normalizedEmail = normalizeEmail(user.email);
  if (existingUser.email !== normalizedEmail) {
    await assertEmailAvailableForUser(ctx, normalizedEmail, user.userId);
    patch.email = normalizedEmail;
  }
  if (existingUser.name !== user.name) {
    patch.name = user.name;
  }
  if (existingUser.isActive !== true) {
    patch.isActive = true;
  }
  if (user.systemRole !== undefined && existingUser.systemRole !== user.systemRole) {
    patch.systemRole = user.systemRole;
  }

  if (!hasPatch(patch)) {
    return "skipped";
  }

  await ctx.db.patch(user.userId, patch);
  return "updated";
}

async function assertEmailAvailableForUser(
  ctx: MutationCtx,
  email: string,
  userId: Id<"users">,
) {
  const usersWithEmail = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .take(2);
  const conflictingUser = usersWithEmail.find((user) => user._id !== userId);
  if (conflictingUser) {
    throw new Error(DUPLICATE_EMAIL_ERROR);
  }
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
  await upsertPersonReferentDetail(ctx, {
    referentId: personReferentId,
    searchText: `${user.name} ${user.email}`,
  });
  await upsertUserTagRecognition(ctx, {
    tagId: personTagId,
    updatedAt: now,
    userId: user.userId,
  });
  await removeLegacySeededEntry(ctx, {
    knowledgeType: "person",
    primaryTagId: personTagId,
    representedReferentId: personReferentId,
  });

  if (existingProfile) {
    const patch: Partial<Doc<"userProfiles">> = {};
    if (existingProfile.personReferentId !== personReferentId) {
      patch.personReferentId = personReferentId;
    }
    if (existingProfile.personTagId !== personTagId) {
      patch.personTagId = personTagId;
    }
    if (existingProfile.personEntryId !== undefined) {
      patch.personEntryId = undefined;
    }
    if (hasPatch(patch)) {
      patch.updatedAt = now;
      await ctx.db.patch(existingProfile._id, patch);
      return {
        personReferentId,
        personTagId,
        state: "updated" as const,
      };
    }

    return {
      personReferentId,
      personTagId,
      state: "skipped" as const,
    };
  }

  await ctx.db.insert("userProfiles", {
    createdAt: now,
    personReferentId,
    personTagId,
    updatedAt: now,
    userId: user.userId,
  });

  return { personReferentId, personTagId, state: "inserted" as const };
}

async function upsertOrganizationMembership(
  ctx: MutationCtx,
  membership: {
    memberUserId: Id<"users">;
    organizationReferentId: Id<"referents">;
    personReferentId: Id<"referents">;
    role: OrganizationMembershipRole;
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

async function upsertOrganizationReferentDetail(
  ctx: MutationCtx,
  detail: {
    isActive: boolean;
    organizationKind: OrganizationKind;
    previewText: string;
    referentId: Id<"referents">;
    searchText: string;
    updatedAt: number;
  },
): Promise<UpsertState> {
  const existingDetail = await getOrganizationReferentDetail(
    ctx,
    detail.referentId,
  );
  if (!existingDetail) {
    await ctx.db.insert("organizationReferentDetails", {
      createdAt: detail.updatedAt,
      isActive: detail.isActive,
      organizationKind: detail.organizationKind,
      previewText: detail.previewText,
      referentId: detail.referentId,
      searchText: detail.searchText,
      updatedAt: detail.updatedAt,
    });
    return "inserted";
  }

  const patch: Partial<Doc<"organizationReferentDetails">> = {};
  if (existingDetail.organizationKind !== detail.organizationKind) {
    patch.organizationKind = detail.organizationKind;
  }
  if (existingDetail.isActive !== detail.isActive) {
    patch.isActive = detail.isActive;
  }
  if (existingDetail.previewText !== detail.previewText) {
    patch.previewText = detail.previewText;
  }
  if (existingDetail.searchText !== detail.searchText) {
    patch.searchText = detail.searchText;
  }
  if (hasPatch(patch)) {
    patch.updatedAt = detail.updatedAt;
    await ctx.db.patch(existingDetail._id, patch);
    return "updated";
  }

  return "skipped";
}

async function upsertPersonReferentDetail(
  ctx: MutationCtx,
  detail: {
    referentId: Id<"referents">;
    searchText: string;
  },
) {
  const existingDetail = await ctx.db
    .query("personReferentDetails")
    .withIndex("by_referentId", (q) => q.eq("referentId", detail.referentId))
    .unique();
  if (!existingDetail) {
    await ctx.db.insert("personReferentDetails", detail);
    return;
  }

  if (existingDetail.searchText !== detail.searchText) {
    await ctx.db.patch(existingDetail._id, {
      searchText: detail.searchText,
    });
  }
}

async function upsertUserTagRecognition(
  ctx: MutationCtx,
  recognition: {
    tagId: Id<"tags">;
    updatedAt: number;
    userId: Id<"users">;
  },
) {
  const existingRecognition = await ctx.db
    .query("tagRecognitions")
    .withIndex("by_userId_and_tagId", (q) =>
      q.eq("userId", recognition.userId).eq("tagId", recognition.tagId),
    )
    .unique();
  if (!existingRecognition) {
    await ctx.db.insert("tagRecognitions", {
      lastInteractedAt: recognition.updatedAt,
      recognizedAt: recognition.updatedAt,
      recognizerKind: "user",
      tagId: recognition.tagId,
      userId: recognition.userId,
    });
    return;
  }

  await ctx.db.patch(existingRecognition._id, {
    lastInteractedAt: recognition.updatedAt,
    recognizerKind: "user",
    userId: recognition.userId,
  });
}

async function upsertOrganizationTagRecognition(
  ctx: MutationCtx,
  recognition: {
    organizationReferentId: Id<"referents">;
    tagId: Id<"tags">;
    updatedAt: number;
  },
) {
  const existingRecognition = await ctx.db
    .query("tagRecognitions")
    .withIndex("by_organizationReferentId_and_tagId", (q) =>
      q
        .eq("organizationReferentId", recognition.organizationReferentId)
        .eq("tagId", recognition.tagId),
    )
    .unique();
  if (!existingRecognition) {
    await ctx.db.insert("tagRecognitions", {
      lastInteractedAt: recognition.updatedAt,
      organizationReferentId: recognition.organizationReferentId,
      recognizedAt: recognition.updatedAt,
      recognizerKind: "organization",
      tagId: recognition.tagId,
    });
    return;
  }

  await ctx.db.patch(existingRecognition._id, {
    lastInteractedAt: recognition.updatedAt,
    organizationReferentId: recognition.organizationReferentId,
    recognizerKind: "organization",
  });
}

async function removeLegacySeededEntry(
  ctx: MutationCtx,
  entry: {
    knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
    primaryTagId: Id<"tags">;
    representedReferentId: Id<"referents">;
  },
) {
  const legacyEntries = await getKnowledgeEntriesByReferent(
    ctx,
    entry.representedReferentId,
    entry.knowledgeType,
  );

  for (const legacyEntry of legacyEntries) {
    if (
      legacyEntry.primaryTagId !== entry.primaryTagId ||
      legacyEntry.createdByUserId !== undefined
    ) {
      continue;
    }

    await removeEntryTags(ctx, legacyEntry._id);
    if (entry.knowledgeType === "person") {
      await removePersonEntryDetail(ctx, legacyEntry._id);
    }
    if (entry.knowledgeType === "organization") {
      await removeOrganizationEntryDetail(ctx, legacyEntry._id);
    }
    await ctx.db.delete(legacyEntry._id);
  }
}

async function removeEntryTags(
  ctx: MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  const entryTags = await ctx.db
    .query("entryTags")
    .withIndex("by_entryId_and_tagId", (q) => q.eq("entryId", entryId))
    .take(100);
  for (const entryTag of entryTags) {
    await ctx.db.delete(entryTag._id);
  }
}

async function removePersonEntryDetail(
  ctx: MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  const personEntry = await ctx.db
    .query("personEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
    .unique();
  if (personEntry) {
    await ctx.db.delete(personEntry._id);
  }
}

async function removeOrganizationEntryDetail(
  ctx: MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  const organizationEntry = await getOrganizationEntryByEntryId(ctx, entryId);
  if (organizationEntry) {
    await ctx.db.delete(organizationEntry._id);
  }
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

async function getKnowledgeEntriesByReferent(
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

  return entries.filter((entry) => entry.knowledgeType === knowledgeType);
}

async function getOrganizationReferentDetail(
  ctx: QueryCtx | MutationCtx,
  referentId: Id<"referents">,
) {
  return await ctx.db
    .query("organizationReferentDetails")
    .withIndex("by_referentId", (q) => q.eq("referentId", referentId))
    .unique();
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
