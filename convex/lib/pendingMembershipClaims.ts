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

  const profile = await upsertUserProfile(
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
        candidatePersonReferentId: profile.personReferentId,
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
        resultingPersonReferentId: profile.personReferentId,
        updatedAt: now,
        verifiedContactIdentityId: options.verifiedContactIdentityId,
      });
      await upsertOrganizationTagRecognition(ctx, {
        organizationReferentId,
        tagId: profile.personTagId,
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
      personReferentId: profile.personReferentId,
      updatedAt: now,
    });
    await upsertOrganizationTagRecognition(ctx, {
      organizationReferentId,
      tagId: profile.personTagId,
      updatedAt: now,
    });
    await recordMembershipClaim(ctx, {
      claimedByUserId: user._id,
      claimedContactValue: normalizedEmail,
      claimSource: options.claimSource,
      membershipId: pendingMembership._id,
      organizationReferentId,
      pendingPersonReferentId: pendingPersonReferent._id,
      resultingPersonReferentId: profile.personReferentId,
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
  if (entries.length > 1) {
    return false;
  }

  const primaryTag = await getPrimaryTagForReferent(
    ctx,
    pendingPersonReferent._id,
  );
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

  const personEntry = entries[0];
  if (personEntry !== undefined) {
    if (
      personEntry.knowledgeType !== "person" ||
      personEntry.title !== email ||
      personEntry.previewText !== email ||
      personEntry.searchText !== `${email} ${email}` ||
      personEntry.primaryTagLabel !== email ||
      personEntry.primaryTagId !== primaryTag._id ||
      personEntry.contextPreviewTagLabels.length !== 0 ||
      personEntry.createdByUserId !== undefined ||
      personEntry.publicPreviewText !== undefined
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

async function getPrimaryTagForReferent(
  ctx: MutationCtx,
  referentId: Id<"referents">,
) {
  const tags = await ctx.db
    .query("tags")
    .withIndex("by_referentId", (q) => q.eq("referentId", referentId))
    .take(10);

  return tags.find((tag) => tag.knowledgeType === "person") ?? null;
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
    if (existingProfile.personEntryId !== undefined) {
      await ctx.db.patch(existingProfile._id, {
        personEntryId: undefined,
        updatedAt: now,
      });
    }
    return {
      personReferentId: existingProfile.personReferentId,
      personTagId: existingProfile.personTagId,
    };
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
  await upsertPersonReferentDetail(ctx, {
    referentId: personReferentId,
    searchText: `${name} ${email}`,
  });
  await upsertUserTagRecognition(ctx, {
    tagId: personTagId,
    updatedAt: now,
    userId: user._id,
  });

  await ctx.db.insert("userProfiles", {
    createdAt: now,
    personReferentId,
    personTagId,
    updatedAt: now,
    userId: user._id,
  });

  return { personReferentId, personTagId };
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

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hasPatch(patch: object) {
  return Object.keys(patch).length > 0;
}
