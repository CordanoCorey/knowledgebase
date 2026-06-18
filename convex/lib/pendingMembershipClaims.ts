import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { OrganizationMembershipRole } from "./organizationRoles";

const BASE_HUMAN_WEIGHT = 0;
const MAX_PERSON_ENTRIES_PER_REFERENT = 10;
const MAX_PENDING_MEMBERSHIPS_TO_CLAIM = 100;

export type ClaimedPendingMembership = {
  membershipId: Id<"memberships">;
  organizationReferentId: Id<"referents">;
  role: OrganizationMembershipRole;
};

export async function claimPendingOrganizationMembershipsForVerifiedEmail(
  ctx: MutationCtx,
  user: Doc<"users">,
  email: string,
  now: number,
): Promise<ClaimedPendingMembership[]> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  const pendingPersonReferent = await getPendingPersonReferentByEmail(
    ctx,
    normalizedEmail,
  );
  if (!pendingPersonReferent) {
    return [];
  }

  const pendingMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_personReferentId_and_membershipStatus", (q) =>
      q
        .eq("personReferentId", pendingPersonReferent._id)
        .eq("membershipStatus", "invited"),
    )
    .take(MAX_PENDING_MEMBERSHIPS_TO_CLAIM);
  const claimableMemberships = pendingMemberships.filter(
    (membership) =>
      membership.memberUserId === undefined &&
      membership.targetKind === "organization" &&
      membership.organizationReferentId !== undefined,
  );
  if (claimableMemberships.length === 0) {
    return [];
  }

  if (user.isActive !== true) {
    await ctx.db.patch(user._id, { isActive: true });
  }

  const personReferentId = await upsertUserProfile(
    ctx,
    user,
    normalizedEmail,
    now,
  );
  const claimedMemberships: ClaimedPendingMembership[] = [];

  for (const pendingMembership of claimableMemberships) {
    const organizationReferentId = pendingMembership.organizationReferentId;
    if (organizationReferentId === undefined) {
      continue;
    }

    const role = pendingMembership.memberRole ?? "member";
    const existingUserMembership = await getMembershipByUserAndOrganization(
      ctx,
      user._id,
      organizationReferentId,
    );
    if (existingUserMembership) {
      await ctx.db.patch(pendingMembership._id, {
        membershipStatus: "inactive",
        updatedAt: now,
      });
      claimedMemberships.push({
        membershipId: existingUserMembership._id,
        organizationReferentId,
        role: existingUserMembership.memberRole ?? role,
      });
      continue;
    }

    await ctx.db.patch(pendingMembership._id, {
      memberUserId: user._id,
      membershipStatus: "active",
      personReferentId,
      updatedAt: now,
    });
    claimedMemberships.push({
      membershipId: pendingMembership._id,
      organizationReferentId,
      role,
    });
  }

  return claimedMemberships;
}

async function getPendingPersonReferentByEmail(
  ctx: MutationCtx,
  email: string,
) {
  return await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q.eq("knowledgeType", "person").eq("canonicalKey", `contact-email:${email}`),
    )
    .unique();
}

async function getMembershipByUserAndOrganization(
  ctx: MutationCtx,
  memberUserId: Id<"users">,
  organizationReferentId: Id<"referents">,
) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_memberUserId_and_organizationReferentId", (q) =>
      q
        .eq("memberUserId", memberUserId)
        .eq("organizationReferentId", organizationReferentId),
    )
    .take(10);

  return memberships[0] ?? null;
}

async function upsertUserProfile(
  ctx: MutationCtx,
  user: Doc<"users">,
  email: string,
  now: number,
) {
  const existingProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .unique();
  if (existingProfile) {
    return existingProfile.personReferentId;
  }

  const name = normalizeName(user.name ?? email) || email;
  const canonicalKey = `user:${email}`;
  const personReferentId = await upsertReferent(ctx, {
    canonicalKey,
    canonicalName: name,
    knowledgeType: "person",
  });
  const personTagId = await upsertPrimaryTag(ctx, {
    knowledgeType: "person",
    label: name,
    lookupKey: canonicalKey,
    referentId: personReferentId,
  });
  const personEntryId = await upsertKnowledgeEntry(ctx, {
    knowledgeType: "person",
    previewText: email,
    primaryTagId: personTagId,
    primaryTagLabel: name,
    representedReferentId: personReferentId,
    searchText: `${name} ${email}`,
    title: name,
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
    userId: user._id,
  });

  return personReferentId;
}

async function upsertReferent(
  ctx: MutationCtx,
  referent: {
    canonicalKey: string;
    canonicalName: string;
    knowledgeType: Doc<"referents">["knowledgeType"];
  },
) {
  const existingReferent = await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q
        .eq("knowledgeType", referent.knowledgeType)
        .eq("canonicalKey", referent.canonicalKey),
    )
    .unique();
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
    knowledgeType: Doc<"tags">["knowledgeType"];
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
    contextPreviewTagLabels: [],
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

async function getKnowledgeEntryByReferent(
  ctx: MutationCtx,
  representedReferentId: Id<"referents">,
  knowledgeType: Doc<"knowledgeEntries">["knowledgeType"],
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", representedReferentId),
    )
    .take(MAX_PERSON_ENTRIES_PER_REFERENT);

  return entries.find((entry) => entry.knowledgeType === knowledgeType) ?? null;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hasPatch(patch: object) {
  return Object.keys(patch).length > 0;
}
