import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { OrganizationMembershipRole } from "./organizationRoles";
import { notifyOrganizationAdminsOfPersonConsolidationReview } from "./userNotificationWrites";

// Pending membership claims connect verified contact identities to pre-created
// person memberships while preserving review records for ambiguous matches.
const MAX_PERSON_ENTRIES_PER_REFERENT = 10;
const MAX_PENDING_MEMBERSHIPS_TO_CLAIM = 100;
const NON_CLAIMABLE_MEMBERSHIP_STATUSES = ["active", "inactive"] as const;
const KNOWLEDGE_SLOT_STATUSES = [
  "open",
  "fulfilled",
  "cancelled",
  "overdue",
] as const;

export type ClaimedPendingMembership = {
  membershipId: Id<"memberships">;
  organizationReferentId: Id<"referents">;
  role: OrganizationMembershipRole;
};
export type PendingMembershipReviewRequired = ClaimedPendingMembership;
export type PendingMembershipReviewRejected = ClaimedPendingMembership;
export type PendingMembershipClaimResult = {
  claimedMemberships: ClaimedPendingMembership[];
  personConsolidationReviews: PendingMembershipReviewRequired[];
  personConsolidationRejections: PendingMembershipReviewRejected[];
};
type MembershipClaimSource =
  | "verifiedContactIdentity"
  | "verifiedPrimaryEmail";
type MembershipClaimOptions = {
  claimSource: MembershipClaimSource;
  verifiedContactIdentityId?: Id<"contactIdentities">;
};

export async function claimPendingOrganizationMembershipsForVerifiedEmail(
  ctx: MutationCtx,
  user: Doc<"users">,
  email: string,
  now: number,
  options: MembershipClaimOptions = { claimSource: "verifiedPrimaryEmail" },
): Promise<PendingMembershipClaimResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return emptyClaimResult();
  }

  const pendingPersonReferent = await getPendingPersonReferentByEmail(
    ctx,
    normalizedEmail,
  );
  if (!pendingPersonReferent) {
    return emptyClaimResult();
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
    return emptyClaimResult();
  }

  const personReferentId = await upsertUserProfile(
    ctx,
    user,
    normalizedEmail,
    now,
  );
  const canAutoClaim = await isAutoClaimablePendingPerson(
    ctx,
    pendingPersonReferent,
    normalizedEmail,
    claimableMemberships,
  );
  if (!canAutoClaim) {
    const personConsolidationReviews: PendingMembershipReviewRequired[] = [];
    const personConsolidationRejections: PendingMembershipReviewRejected[] = [];

    for (const pendingMembership of claimableMemberships) {
      const organizationReferentId = pendingMembership.organizationReferentId;
      if (organizationReferentId === undefined) {
        continue;
      }
      const reviewResult = {
        membershipId: pendingMembership._id,
        organizationReferentId,
        role: pendingMembership.memberRole ?? "member",
      };
      const rejectedReview = await getPersonConsolidationReviewByStatus(ctx, {
        claimedContactValue: normalizedEmail,
        membershipId: pendingMembership._id,
        requestedByUserId: user._id,
        reviewStatus: "rejected",
      });
      if (rejectedReview) {
        personConsolidationRejections.push(reviewResult);
        continue;
      }

      const personConsolidationReviewId = await recordPersonConsolidationReview(ctx, {
        candidatePersonReferentId: personReferentId,
        claimedContactValue: normalizedEmail,
        claimSource: options.claimSource,
        membershipId: pendingMembership._id,
        organizationReferentId,
        pendingPersonReferentId: pendingPersonReferent._id,
        requestedByUserId: user._id,
        updatedAt: now,
        verifiedContactIdentityId: options.verifiedContactIdentityId,
      });
      await notifyOrganizationAdminsOfPersonConsolidationReview(ctx, {
        claimedContactValue: normalizedEmail,
        organizationReferentId,
        personConsolidationReviewId,
        requestedByUserId: user._id,
        updatedAt: now,
      });
      personConsolidationReviews.push(reviewResult);
    }

    return {
      claimedMemberships: [],
      personConsolidationReviews,
      personConsolidationRejections,
    };
  }

  if (user.isActive !== true) {
    await ctx.db.patch(user._id, { isActive: true });
  }

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
      await recordMembershipClaim(ctx, {
        claimedByUserId: user._id,
        claimedContactValue: normalizedEmail,
        claimSource: options.claimSource,
        membershipId: existingUserMembership._id,
        organizationReferentId,
        pendingPersonReferentId: pendingPersonReferent._id,
        resultingPersonReferentId: personReferentId,
        updatedAt: now,
        verifiedContactIdentityId: options.verifiedContactIdentityId,
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
    await recordMembershipClaim(ctx, {
      claimedByUserId: user._id,
      claimedContactValue: normalizedEmail,
      claimSource: options.claimSource,
      membershipId: pendingMembership._id,
      organizationReferentId,
      pendingPersonReferentId: pendingPersonReferent._id,
      resultingPersonReferentId: personReferentId,
      updatedAt: now,
      verifiedContactIdentityId: options.verifiedContactIdentityId,
    });
    claimedMemberships.push({
      membershipId: pendingMembership._id,
      organizationReferentId,
      role,
    });
  }

  return {
    claimedMemberships,
    personConsolidationReviews: [],
    personConsolidationRejections: [],
  };
}

function emptyClaimResult(): PendingMembershipClaimResult {
  return {
    claimedMemberships: [],
    personConsolidationReviews: [],
    personConsolidationRejections: [],
  };
}

async function isAutoClaimablePendingPerson(
  ctx: MutationCtx,
  pendingPersonReferent: Doc<"referents">,
  email: string,
  claimableMemberships: Array<Doc<"memberships">>,
) {
  const canonicalKey = `contact-email:${email}`;
  if (
    pendingPersonReferent.knowledgeType !== "person" ||
    pendingPersonReferent.canonicalKey !== canonicalKey ||
    pendingPersonReferent.canonicalName !== email
  ) {
    return false;
  }

  const userProfiles = await ctx.db
    .query("userProfiles")
    .withIndex("by_personReferentId", (q) =>
      q.eq("personReferentId", pendingPersonReferent._id),
    )
    .take(1);
  if (userProfiles.length > 0) {
    return false;
  }

  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", pendingPersonReferent._id),
    )
    .take(MAX_PERSON_ENTRIES_PER_REFERENT);
  if (entries.length !== 1) {
    return false;
  }

  const personEntry = entries[0];
  if (
    personEntry.knowledgeType !== "person" ||
    personEntry.title !== email ||
    personEntry.previewText !== email ||
    personEntry.searchText !== `${email} ${email}` ||
    personEntry.primaryTagLabel !== email ||
    personEntry.contextPreviewTagLabels.length !== 0 ||
    personEntry.createdByUserId !== undefined ||
    personEntry.publicPreviewText !== undefined
  ) {
    return false;
  }

  const primaryTag = await ctx.db.get(personEntry.primaryTagId);
  if (
    !primaryTag ||
    primaryTag.knowledgeType !== "person" ||
    primaryTag.label !== email ||
    primaryTag.lookupKey !== canonicalKey ||
    primaryTag.referentId !== pendingPersonReferent._id ||
    primaryTag.createdByUserId !== undefined
  ) {
    return false;
  }

  const personEntries = await ctx.db
    .query("personEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", personEntry._id))
    .take(2);
  if (personEntries.length !== 1) {
    return false;
  }

  for (const membershipStatus of NON_CLAIMABLE_MEMBERSHIP_STATUSES) {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_personReferentId_and_membershipStatus", (q) =>
        q
          .eq("personReferentId", pendingPersonReferent._id)
          .eq("membershipStatus", membershipStatus),
      )
      .take(1);
    if (memberships.length > 0) {
      return false;
    }
  }

  const invitedMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_personReferentId_and_membershipStatus", (q) =>
      q
        .eq("personReferentId", pendingPersonReferent._id)
        .eq("membershipStatus", "invited"),
    )
    .take(MAX_PENDING_MEMBERSHIPS_TO_CLAIM + 1);
  if (invitedMemberships.length !== claimableMemberships.length) {
    return false;
  }

  const claimableMembershipIds = new Set(
    claimableMemberships.map((membership) => membership._id),
  );
  if (
    invitedMemberships.some(
      (membership) =>
        !claimableMembershipIds.has(membership._id) ||
        membership.memberUserId !== undefined ||
        membership.targetKind !== "organization" ||
        membership.organizationReferentId === undefined,
    )
  ) {
    return false;
  }

  const rsvpEntries = await ctx.db
    .query("rsvpEntries")
    .withIndex("by_personReferentId_and_respondedAt", (q) =>
      q.eq("personReferentId", pendingPersonReferent._id),
    )
    .take(1);
  if (rsvpEntries.length > 0) {
    return false;
  }

  for (const status of KNOWLEDGE_SLOT_STATUSES) {
    const slots = await ctx.db
      .query("knowledgeSlots")
      .withIndex("by_targetPersonReferentId_and_status_and_dueAt", (q) =>
        q
          .eq("targetPersonReferentId", pendingPersonReferent._id)
          .eq("status", status),
      )
      .take(1);
    if (slots.length > 0) {
      return false;
    }
  }

  return true;
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

async function recordMembershipClaim(
  ctx: MutationCtx,
  claim: {
    claimedByUserId: Id<"users">;
    claimedContactValue: string;
    claimSource: MembershipClaimSource;
    membershipId: Id<"memberships">;
    organizationReferentId: Id<"referents">;
    pendingPersonReferentId: Id<"referents">;
    resultingPersonReferentId: Id<"referents">;
    updatedAt: number;
    verifiedContactIdentityId?: Id<"contactIdentities">;
  },
) {
  await ctx.db.insert("membershipClaims", {
    claimedByUserId: claim.claimedByUserId,
    claimedContactKind: "email",
    claimedContactValue: claim.claimedContactValue,
    claimSource: claim.claimSource,
    createdAt: claim.updatedAt,
    membershipId: claim.membershipId,
    organizationReferentId: claim.organizationReferentId,
    pendingPersonReferentId: claim.pendingPersonReferentId,
    resultingPersonReferentId: claim.resultingPersonReferentId,
    ...(claim.verifiedContactIdentityId === undefined
      ? {}
      : { verifiedContactIdentityId: claim.verifiedContactIdentityId }),
  });
}

async function recordPersonConsolidationReview(
  ctx: MutationCtx,
  review: {
    candidatePersonReferentId: Id<"referents">;
    claimedContactValue: string;
    claimSource: MembershipClaimSource;
    membershipId: Id<"memberships">;
    organizationReferentId: Id<"referents">;
    pendingPersonReferentId: Id<"referents">;
    requestedByUserId: Id<"users">;
    updatedAt: number;
    verifiedContactIdentityId?: Id<"contactIdentities">;
  },
): Promise<Id<"personConsolidationReviews">> {
  const existingReview = await getPersonConsolidationReviewByStatus(ctx, {
    claimedContactValue: review.claimedContactValue,
    membershipId: review.membershipId,
    requestedByUserId: review.requestedByUserId,
    reviewStatus: "pending",
  });
  const reviewEvidence = {
    candidatePersonReferentId: review.candidatePersonReferentId,
    claimedContactKind: "email" as const,
    claimedContactValue: review.claimedContactValue,
    claimSource: review.claimSource,
    membershipId: review.membershipId,
    organizationReferentId: review.organizationReferentId,
    pendingPersonReferentId: review.pendingPersonReferentId,
    requestedByUserId: review.requestedByUserId,
    reviewReason: "placeholderHasMeaningfulIdentity" as const,
    reviewStatus: "pending" as const,
    updatedAt: review.updatedAt,
    ...(review.verifiedContactIdentityId === undefined
      ? {}
      : { verifiedContactIdentityId: review.verifiedContactIdentityId }),
  };

  if (existingReview) {
    await ctx.db.patch(existingReview._id, reviewEvidence);
    return existingReview._id;
  }

  return await ctx.db.insert("personConsolidationReviews", {
    ...reviewEvidence,
    createdAt: review.updatedAt,
  });
}

async function getPersonConsolidationReviewByStatus(
  ctx: MutationCtx,
  review: {
    claimedContactValue: string;
    membershipId: Id<"memberships">;
    requestedByUserId: Id<"users">;
    reviewStatus: "pending" | "rejected";
  },
) {
  const existingReviews = await ctx.db
    .query("personConsolidationReviews")
    .withIndex("by_membershipId_and_requestedByUserId_and_reviewStatus", (q) =>
      q
        .eq("membershipId", review.membershipId)
        .eq("requestedByUserId", review.requestedByUserId)
        .eq("reviewStatus", review.reviewStatus),
    )
    .take(10);

  return (
    existingReviews.find(
      (existingReview) =>
        existingReview.claimedContactKind === "email" &&
        existingReview.claimedContactValue === review.claimedContactValue,
    ) ?? null
  );
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
