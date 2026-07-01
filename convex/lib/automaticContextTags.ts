import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { AllowedOrganization } from "./appAccess";

// Automatic context tags attach organizational oversight context to entries
// without asking every contribution flow to duplicate membership logic.
const MAX_ACTIVE_MEMBERSHIPS_TO_CHECK = 50;
const OVERSIGHT_ORGANIZATION_KINDS = new Set(["school", "church", "family"]);

export async function appendAutomaticContextTags(
  ctx: MutationCtx,
  {
    contextTags,
    organizations,
    representedTagId,
    taggedByUserId,
  }: {
    contextTags: Array<Doc<"tags">>;
    organizations: AllowedOrganization[];
    representedTagId: Id<"tags">;
    taggedByUserId: Id<"users">;
  },
) {
  const tagsById = new Map<Id<"tags">, Doc<"tags">>();
  const addContextTag = (tag: Doc<"tags"> | null) => {
    if (tag === null || tag._id === representedTagId) {
      return;
    }
    tagsById.set(tag._id, tag);
  };

  for (const tag of contextTags) {
    addContextTag(tag);
  }

  const oversightOrganization = selectOversightOrganization(
    contextTags,
    organizations,
  );
  addContextTag(
    await getContributorPersonTag(ctx, {
      organizationReferentId: oversightOrganization?.organizationReferentId,
      taggedByUserId,
    }),
  );
  addContextTag(
    oversightOrganization === null
      ? null
      : await ensurePrimaryTagForReferent(ctx, {
          createdByUserId: taggedByUserId,
          referentId: oversightOrganization.organizationReferentId,
        }),
  );

  return Array.from(tagsById.values());
}

export async function insertEntryContextTags(
  ctx: MutationCtx,
  {
    contextTags,
    entryId,
    now,
    taggedByUserId,
  }: {
    contextTags: Array<Doc<"tags">>;
    entryId: Id<"knowledgeEntries">;
    now: number;
    taggedByUserId: Id<"users">;
  },
) {
  for (const tag of contextTags) {
    const existing = await ctx.db
      .query("entryTags")
      .withIndex("by_entryId_and_tagId", (q) =>
        q.eq("entryId", entryId).eq("tagId", tag._id),
      )
      .first();
    if (existing) {
      continue;
    }

    await ctx.db.insert("entryTags", {
      entryId,
      tagId: tag._id,
      tagPurpose: "context",
      taggedAt: now,
      taggedByUserId,
    });
  }
}

async function getContributorPersonTag(
  ctx: MutationCtx,
  {
    organizationReferentId,
    taggedByUserId,
  }: {
    organizationReferentId?: Id<"referents">;
    taggedByUserId: Id<"users">;
  },
) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", taggedByUserId))
    .unique();
  if (profile) {
    const profileTag = await ctx.db.get(profile.personTagId);
    return (
      profileTag ??
      (await ensurePrimaryTagForReferent(ctx, {
        createdByUserId: taggedByUserId,
        referentId: profile.personReferentId,
      }))
    );
  }

  const membershipPersonReferentId = await getMembershipPersonReferentId(ctx, {
    organizationReferentId,
    taggedByUserId,
  });
  return membershipPersonReferentId === null
    ? null
    : await ensurePrimaryTagForReferent(ctx, {
        createdByUserId: taggedByUserId,
        referentId: membershipPersonReferentId,
      });
}

async function getMembershipPersonReferentId(
  ctx: MutationCtx,
  {
    organizationReferentId,
    taggedByUserId,
  }: {
    organizationReferentId?: Id<"referents">;
    taggedByUserId: Id<"users">;
  },
) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_memberUserId_and_membershipStatus", (q) =>
      q.eq("memberUserId", taggedByUserId).eq("membershipStatus", "active"),
    )
    .take(MAX_ACTIVE_MEMBERSHIPS_TO_CHECK);
  const preferredMembership =
    organizationReferentId === undefined
      ? undefined
      : memberships.find(
          (membership) =>
            membership.targetKind === "organization" &&
            membership.organizationReferentId === organizationReferentId &&
            membership.personReferentId !== undefined,
        );
  const membershipWithPerson =
    preferredMembership ??
    memberships.find((membership) => membership.personReferentId !== undefined);

  return membershipWithPerson?.personReferentId ?? null;
}

function selectOversightOrganization(
  contextTags: Array<Doc<"tags">>,
  organizations: AllowedOrganization[],
) {
  const contextOrganizationReferentIds = new Set(
    contextTags
      .filter((tag) => tag.knowledgeType === "organization")
      .map((tag) => tag.referentId),
  );
  const explicitOversightOrganization = organizations.find(
    (organization) =>
      contextOrganizationReferentIds.has(organization.organizationReferentId) &&
      isOversightOrganization(organization),
  );
  if (explicitOversightOrganization) {
    return explicitOversightOrganization;
  }

  const firstOversightOrganization = organizations.find(isOversightOrganization);
  if (firstOversightOrganization) {
    return firstOversightOrganization;
  }

  return organizations[0] ?? null;
}

async function ensurePrimaryTagForReferent(
  ctx: MutationCtx,
  {
    createdByUserId,
    referentId,
  }: {
    createdByUserId: Id<"users">;
    referentId: Id<"referents">;
  },
) {
  const existingByReferent = await ctx.db
    .query("tags")
    .withIndex("by_referentId", (q) => q.eq("referentId", referentId))
    .first();
  if (existingByReferent) {
    return existingByReferent;
  }

  const referent = await ctx.db.get(referentId);
  if (!referent) {
    return null;
  }

  const existingByLookup = await ctx.db
    .query("tags")
    .withIndex("by_knowledgeType_and_lookupKey", (q) =>
      q
        .eq("knowledgeType", referent.knowledgeType)
        .eq("lookupKey", referent.canonicalKey),
    )
    .first();
  if (existingByLookup) {
    return existingByLookup;
  }

  const tagId = await ctx.db.insert("tags", {
    createdByUserId,
    knowledgeType: referent.knowledgeType,
    label: referent.canonicalName,
    lookupKey: referent.canonicalKey,
    referentId,
  });
  const tag = await ctx.db.get(tagId);
  if (!tag) {
    throw new Error("Created automatic context Tag could not be loaded.");
  }

  return tag;
}

function isOversightOrganization(organization: AllowedOrganization) {
  return OVERSIGHT_ORGANIZATION_KINDS.has(organization.organizationKind);
}
