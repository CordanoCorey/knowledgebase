import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import {
  requireOrganizationAdmin,
  requireSystemAdmin,
} from "./lib/appAccess";
import {
  organizationMembershipRole,
  type OrganizationMembershipRole,
} from "./lib/organizationRoles";
import { notifyPersonConsolidationReviewClaimant } from "./lib/userNotificationWrites";

// Organization account setup and membership management create the minimum
// reference, membership, and notification state for an organization space.
const MAX_ORGANIZATION_ENTRIES_PER_REFERENT = 10;
const MAX_ORGANIZATION_MEMBERS = 100;
const organizationKind = v.union(
  v.literal("school"),
  v.literal("church"),
  v.literal("family"),
  v.literal("community"),
);
const organizationMemberStatus = v.union(
  v.literal("active"),
  v.literal("pending"),
);
const contactIdentityKind = v.union(v.literal("email"));
const membershipClaimSource = v.union(
  v.literal("verifiedContactIdentity"),
  v.literal("verifiedPrimaryEmail"),
);
const personConsolidationReviewStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);
const personConsolidationReviewReason = v.union(
  v.literal("placeholderHasMeaningfulIdentity"),
);
const organizationMembershipClaimPersonConsolidationEvidence = v.object({
  approvedAt: v.number(),
  pendingPersonName: v.string(),
  pendingPersonReferentId: v.id("referents"),
  resultingPersonName: v.string(),
  resultingPersonReferentId: v.id("referents"),
  reviewId: v.id("personConsolidationReviews"),
});
const organizationMembershipClaimEvidence = v.object({
  claimedAt: v.number(),
  claimedContactKind: contactIdentityKind,
  claimedContactValue: v.string(),
  claimSource: membershipClaimSource,
  personConsolidation: v.optional(
    organizationMembershipClaimPersonConsolidationEvidence,
  ),
});
const organizationPersonConsolidationReviewEvidence = v.object({
  claimedContactKind: contactIdentityKind,
  claimedContactValue: v.string(),
  claimSource: membershipClaimSource,
  requestedAt: v.number(),
  requestedByEmail: v.optional(v.string()),
  reviewId: v.id("personConsolidationReviews"),
  reviewReason: personConsolidationReviewReason,
  reviewStatus: personConsolidationReviewStatus,
  updatedAt: v.number(),
});
const organizationMember = v.object({
  claimEvidence: v.optional(organizationMembershipClaimEvidence),
  email: v.optional(v.string()),
  membershipId: v.id("memberships"),
  name: v.string(),
  personConsolidationReview: v.optional(
    organizationPersonConsolidationReviewEvidence,
  ),
  role: organizationMembershipRole,
  status: organizationMemberStatus,
  userId: v.optional(v.id("users")),
});
const organizationMembershipSettings = v.object({
  members: v.array(organizationMember),
  name: v.string(),
  organizationDetailId: v.optional(v.id("organizationReferentDetails")),
  organizationEntryId: v.optional(v.id("organizationEntries")),
  organizationKind,
  organizationReferentId: v.id("referents"),
});
const approvedPersonConsolidationReview = v.object({
  membershipId: v.id("memberships"),
  reviewStatus: v.literal("approved"),
});
const rejectedPersonConsolidationReview = v.object({
  membershipId: v.id("memberships"),
  reviewStatus: v.literal("rejected"),
});
const reopenedPersonConsolidationReview = v.object({
  membershipId: v.id("memberships"),
  reviewStatus: v.literal("pending"),
});
const withdrawnPendingOrganizationMember = v.object({
  membershipId: v.id("memberships"),
  membershipStatus: v.literal("inactive"),
});

type OrganizationKind = "school" | "church" | "family" | "community";
type OrganizationAccountCtx = MutationCtx | QueryCtx;

export const createOrganizationAccount = mutation({
  args: {
    name: v.string(),
    organizationKind,
  },
  returns: v.object({
    canonicalKey: v.string(),
    href: v.string(),
    name: v.string(),
    organizationDetailId: v.optional(v.id("organizationReferentDetails")),
    organizationEntryId: v.optional(v.id("organizationEntries")),
    organizationKind,
    organizationReferentId: v.id("referents"),
  }),
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const now = Date.now();
    const name = normalizeName(args.name);
    if (!name) {
      throw new Error("Organization name is required.");
    }

    const canonicalKey = normalizeLookupKey(name);
    const existingReferent = await getOrganizationReferentByKey(
      ctx,
      canonicalKey,
    );
    if (existingReferent) {
      throw new Error("Organization already exists.");
    }

    const organizationReferentId = await ctx.db.insert("referents", {
      canonicalKey,
      canonicalName: name,
      knowledgeType: "organization",
    });
    const primaryTagId = await ctx.db.insert("tags", {
      knowledgeType: "organization",
      label: name,
      lookupKey: canonicalKey,
      referentId: organizationReferentId,
    });
    const previewText = `${formatOrganizationKind(
      args.organizationKind,
    )} organization.`;
    const organizationDetailId = await ctx.db.insert("organizationReferentDetails", {
      createdAt: now,
      isActive: true,
      organizationKind: args.organizationKind,
      previewText,
      referentId: organizationReferentId,
      searchText: `${name} ${args.organizationKind}`,
      updatedAt: now,
    });
    await upsertOrganizationTagRecognition(ctx, {
      organizationReferentId,
      tagId: primaryTagId,
      updatedAt: now,
    });

    return {
      canonicalKey,
      href: `/organizations/${canonicalKey}`,
      name,
      organizationDetailId,
      organizationKind: args.organizationKind,
      organizationReferentId,
    };
  },
});

export const getOrganizationMembershipSettings = query({
  args: {
    organizationId: v.string(),
  },
  returns: v.union(organizationMembershipSettings, v.null()),
  handler: async (ctx, args) => {
    const organization = await getActiveOrganizationByRouteId(
      ctx,
      args.organizationId,
    );
    if (!organization) {
      return null;
    }

    await requireOrganizationAdmin(ctx, organization.organizationReferentId);
    const members = await listOrganizationMembers(
      ctx,
      organization.organizationReferentId,
    );

    return {
      ...organization,
      members,
    };
  },
});

export const addOrganizationMember = mutation({
  args: {
    email: v.string(),
    organizationId: v.string(),
    role: organizationMembershipRole,
  },
  returns: organizationMember,
  handler: async (ctx, args) => {
    const organization = await getActiveOrganizationByRouteId(
      ctx,
      args.organizationId,
    );
    if (!organization) {
      throw new Error("Organization account not found.");
    }

    await requireOrganizationAdmin(ctx, organization.organizationReferentId);
    const email = normalizeEmail(args.email);
    if (!email) {
      throw new Error("User email is required.");
    }

    const user = await getUserByEmail(ctx, email);
    const now = Date.now();
    if (!user) {
      const pendingPerson = await upsertPendingMemberPerson(
        ctx,
        email,
        now,
      );
      const membershipId = await upsertPendingOrganizationMembership(ctx, {
        organizationReferentId: organization.organizationReferentId,
        personReferentId: pendingPerson.personReferentId,
        role: args.role,
        updatedAt: now,
      });
      await upsertOrganizationTagRecognition(ctx, {
        organizationReferentId: organization.organizationReferentId,
        tagId: pendingPerson.personTagId,
        updatedAt: now,
      });
      const membership = await ctx.db.get(membershipId);
      if (!membership) {
        throw new Error("Member setup failed.");
      }

      return await getPendingOrganizationMemberSummary(ctx, membership);
    }

    if (user.isActive !== true) {
      await ctx.db.patch(user._id, { isActive: true });
    }

    const profile = await upsertUserProfile(ctx, user, email, now);
    const pendingMembership = await getPendingOrganizationMembershipByContactEmail(
      ctx,
      email,
      organization.organizationReferentId,
    );
    const membershipId = await upsertOrganizationMembership(ctx, {
      memberUserId: user._id,
      organizationReferentId: organization.organizationReferentId,
      pendingMembershipId: pendingMembership?._id,
      personReferentId: profile.personReferentId,
      role: args.role,
      updatedAt: now,
    });
    await upsertOrganizationTagRecognition(ctx, {
      organizationReferentId: organization.organizationReferentId,
      tagId: profile.personTagId,
      updatedAt: now,
    });
    const membership = await ctx.db.get(membershipId);
    if (!membership) {
      throw new Error("Member setup failed.");
    }

    return getOrganizationMemberSummary(user, membership);
  },
});

export const withdrawPendingOrganizationMember = mutation({
  args: {
    membershipId: v.id("memberships"),
    organizationId: v.string(),
  },
  returns: withdrawnPendingOrganizationMember,
  handler: async (ctx, args) => {
    const organization = await getActiveOrganizationByRouteId(
      ctx,
      args.organizationId,
    );
    if (!organization) {
      throw new Error("Organization account not found.");
    }

    await requireOrganizationAdmin(ctx, organization.organizationReferentId);
    const membership = await ctx.db.get(args.membershipId);
    if (
      !membership ||
      membership.organizationReferentId !== organization.organizationReferentId ||
      membership.targetKind !== "organization"
    ) {
      throw new Error("Pending membership not found for organization.");
    }
    if (
      membership.membershipStatus !== "invited" ||
      membership.memberUserId !== undefined
    ) {
      throw new Error("Only unclaimed pending memberships can be withdrawn.");
    }

    const pendingReview = await getPersonConsolidationReviewForMembership(
      ctx,
      organization.organizationReferentId,
      membership._id,
      "pending",
    );
    if (pendingReview) {
      throw new Error("Resolve identity review before withdrawing member.");
    }

    const now = Date.now();
    await ctx.db.patch(membership._id, {
      membershipStatus: "inactive",
      updatedAt: now,
    });

    return {
      membershipId: membership._id,
      membershipStatus: "inactive" as const,
    };
  },
});

export const approvePersonConsolidationReview = mutation({
  args: {
    organizationId: v.string(),
    personConsolidationReviewId: v.id("personConsolidationReviews"),
  },
  returns: approvedPersonConsolidationReview,
  handler: async (ctx, args) => {
    const organization = await getActiveOrganizationByRouteId(
      ctx,
      args.organizationId,
    );
    if (!organization) {
      throw new Error("Organization account not found.");
    }

    const access = await requireOrganizationAdmin(
      ctx,
      organization.organizationReferentId,
    );
    const review = await ctx.db.get(args.personConsolidationReviewId);
    if (!review) {
      throw new Error("Person Consolidation review not found.");
    }
    if (review.organizationReferentId !== organization.organizationReferentId) {
      throw new Error("Person Consolidation review not found for organization.");
    }
    if (review.reviewStatus !== "pending") {
      throw new Error("Person Consolidation review is already resolved.");
    }

    const pendingMembership = await ctx.db.get(review.membershipId);
    if (
      !pendingMembership ||
      pendingMembership.organizationReferentId !==
        organization.organizationReferentId ||
      pendingMembership.targetKind !== "organization" ||
      pendingMembership.membershipStatus !== "invited" ||
      pendingMembership.memberUserId !== undefined
    ) {
      throw new Error("Pending membership is no longer reviewable.");
    }

    const claimant = await ctx.db.get(review.requestedByUserId);
    if (!claimant) {
      throw new Error("Requesting user not found.");
    }

    const now = Date.now();
    if (claimant.isActive !== true) {
      await ctx.db.patch(claimant._id, { isActive: true });
    }

    const existingMembership = await getMembershipByUserAndOrganization(
      ctx,
      review.requestedByUserId,
      organization.organizationReferentId,
    );
    const membershipId = existingMembership?._id ?? pendingMembership._id;
    if (existingMembership) {
      await ctx.db.patch(pendingMembership._id, {
        membershipStatus: "inactive",
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(pendingMembership._id, {
        memberUserId: review.requestedByUserId,
        membershipStatus: "active",
        personReferentId: review.candidatePersonReferentId,
        targetKind: "organization",
        updatedAt: now,
      });
    }

    await recordApprovedMembershipClaim(ctx, {
      claimedByUserId: review.requestedByUserId,
      claimedContactKind: review.claimedContactKind,
      claimedContactValue: review.claimedContactValue,
      claimSource: review.claimSource,
      membershipId,
      organizationReferentId: organization.organizationReferentId,
      pendingPersonReferentId: review.pendingPersonReferentId,
      resultingPersonReferentId: review.candidatePersonReferentId,
      updatedAt: now,
      verifiedContactIdentityId: review.verifiedContactIdentityId,
    });

    await ctx.db.patch(review._id, {
      resolvedAt: now,
      resolvedByUserId: access.userId,
      reviewStatus: "approved",
      updatedAt: now,
    });
    await notifyPersonConsolidationReviewClaimant(ctx, {
      claimedContactValue: review.claimedContactValue,
      organizationReferentId: organization.organizationReferentId,
      personConsolidationReviewId: review._id,
      requestedByUserId: review.requestedByUserId,
      reviewStatus: "approved",
      updatedAt: now,
    });

    return {
      membershipId,
      reviewStatus: "approved" as const,
    };
  },
});

export const rejectPersonConsolidationReview = mutation({
  args: {
    organizationId: v.string(),
    personConsolidationReviewId: v.id("personConsolidationReviews"),
  },
  returns: rejectedPersonConsolidationReview,
  handler: async (ctx, args) => {
    const organization = await getActiveOrganizationByRouteId(
      ctx,
      args.organizationId,
    );
    if (!organization) {
      throw new Error("Organization account not found.");
    }

    const access = await requireOrganizationAdmin(
      ctx,
      organization.organizationReferentId,
    );
    const review = await ctx.db.get(args.personConsolidationReviewId);
    if (!review) {
      throw new Error("Person Consolidation review not found.");
    }
    if (review.organizationReferentId !== organization.organizationReferentId) {
      throw new Error("Person Consolidation review not found for organization.");
    }
    if (review.reviewStatus !== "pending") {
      throw new Error("Person Consolidation review is already resolved.");
    }

    const pendingMembership = await ctx.db.get(review.membershipId);
    if (
      !pendingMembership ||
      pendingMembership.organizationReferentId !==
        organization.organizationReferentId ||
      pendingMembership.targetKind !== "organization" ||
      pendingMembership.membershipStatus !== "invited" ||
      pendingMembership.memberUserId !== undefined
    ) {
      throw new Error("Pending membership is no longer reviewable.");
    }

    const now = Date.now();
    await ctx.db.patch(review._id, {
      resolvedAt: now,
      resolvedByUserId: access.userId,
      reviewStatus: "rejected",
      updatedAt: now,
    });
    await notifyPersonConsolidationReviewClaimant(ctx, {
      claimedContactValue: review.claimedContactValue,
      organizationReferentId: organization.organizationReferentId,
      personConsolidationReviewId: review._id,
      requestedByUserId: review.requestedByUserId,
      reviewStatus: "rejected",
      updatedAt: now,
    });

    return {
      membershipId: pendingMembership._id,
      reviewStatus: "rejected" as const,
    };
  },
});

export const reopenPersonConsolidationReview = mutation({
  args: {
    organizationId: v.string(),
    personConsolidationReviewId: v.id("personConsolidationReviews"),
  },
  returns: reopenedPersonConsolidationReview,
  handler: async (ctx, args) => {
    const organization = await getActiveOrganizationByRouteId(
      ctx,
      args.organizationId,
    );
    if (!organization) {
      throw new Error("Organization account not found.");
    }

    await requireOrganizationAdmin(ctx, organization.organizationReferentId);
    const review = await ctx.db.get(args.personConsolidationReviewId);
    if (!review) {
      throw new Error("Person Consolidation review not found.");
    }
    if (review.organizationReferentId !== organization.organizationReferentId) {
      throw new Error("Person Consolidation review not found for organization.");
    }
    if (review.reviewStatus !== "rejected") {
      throw new Error("Person Consolidation review is not rejected.");
    }

    const pendingMembership = await ctx.db.get(review.membershipId);
    if (
      !pendingMembership ||
      pendingMembership.organizationReferentId !==
        organization.organizationReferentId ||
      pendingMembership.targetKind !== "organization" ||
      pendingMembership.membershipStatus !== "invited" ||
      pendingMembership.memberUserId !== undefined
    ) {
      throw new Error("Pending membership is no longer reviewable.");
    }

    const now = Date.now();
    const { _creationTime, _id, resolvedAt, resolvedByUserId, ...replacement } =
      review;
    await ctx.db.replace(_id, {
      ...replacement,
      reviewStatus: "pending",
      updatedAt: now,
    });

    return {
      membershipId: pendingMembership._id,
      reviewStatus: "pending" as const,
    };
  },
});

async function getOrganizationReferentByKey(
  ctx: OrganizationAccountCtx,
  canonicalKey: string,
) {
  return await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q.eq("knowledgeType", "organization").eq("canonicalKey", canonicalKey),
    )
    .unique();
}

async function getActiveOrganizationByRouteId(
  ctx: OrganizationAccountCtx,
  organizationId: string,
) {
  const directReferentId = ctx.db.normalizeId("referents", organizationId);
  const directReferent =
    directReferentId === null ? null : await ctx.db.get(directReferentId);
  const referent =
    directReferent?.knowledgeType === "organization"
      ? directReferent
      : await getOrganizationReferentByKey(
          ctx,
          normalizeLookupKey(organizationId),
        );
  if (!referent) {
    return null;
  }

  const organizationDetail = await getActiveOrganizationDetailByReferent(
    ctx,
    referent._id,
  );
  if (organizationDetail) {
    return {
      name: referent.canonicalName,
      organizationDetailId: organizationDetail._id,
      organizationKind: organizationDetail.organizationKind,
      organizationReferentId: referent._id,
    };
  }

  const organizationEntry = await getActiveOrganizationEntryByReferent(
    ctx,
    referent._id,
  );
  return organizationEntry === null
    ? null
    : {
        name: organizationEntry.entry.title,
        organizationEntryId: organizationEntry.organizationEntry._id,
        organizationKind: organizationEntry.organizationEntry.organizationKind,
        organizationReferentId: referent._id,
      };
}

async function getActiveOrganizationDetailByReferent(
  ctx: OrganizationAccountCtx,
  organizationReferentId: Id<"referents">,
) {
  const detail = await ctx.db
    .query("organizationReferentDetails")
    .withIndex("by_referentId", (q) => q.eq("referentId", organizationReferentId))
    .unique();

  return detail && detail.isActive !== false ? detail : null;
}

async function getActiveOrganizationEntryByReferent(
  ctx: OrganizationAccountCtx,
  organizationReferentId: Id<"referents">,
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", organizationReferentId),
    )
    .take(MAX_ORGANIZATION_ENTRIES_PER_REFERENT);

  for (const entry of entries) {
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

    return { entry, organizationEntry };
  }

  return null;
}

async function listOrganizationMembers(
  ctx: QueryCtx,
  organizationReferentId: Id<"referents">,
) {
  const visibleReviewsByMembership =
    await getVisiblePersonConsolidationReviewsByMembership(
      ctx,
      organizationReferentId,
    );
  const activeMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_organizationReferentId_and_membershipStatus", (q) =>
      q
        .eq("organizationReferentId", organizationReferentId)
        .eq("membershipStatus", "active"),
    )
    .take(MAX_ORGANIZATION_MEMBERS);
  const members = [];

  for (const membership of activeMemberships) {
    if (!membership.memberUserId) {
      continue;
    }

    const user = await ctx.db.get(membership.memberUserId);
    if (!user) {
      continue;
    }

    members.push(await getOrganizationMemberSummaryWithEvidence(ctx, user, membership));
  }

  const pendingMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_organizationReferentId_and_membershipStatus", (q) =>
      q
        .eq("organizationReferentId", organizationReferentId)
        .eq("membershipStatus", "invited"),
    )
    .take(MAX_ORGANIZATION_MEMBERS);

  for (const membership of pendingMemberships) {
    if (membership.memberUserId) {
      continue;
    }

    members.push(
      await getPendingOrganizationMemberSummary(
        ctx,
        membership,
        visibleReviewsByMembership.get(membership._id),
      ),
    );
  }

  return members;
}

async function getUserByEmail(ctx: MutationCtx, email: string) {
  const users = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .take(2);
  if (users.length > 1) {
    throw new Error("Multiple user accounts use that email.");
  }

  return users[0] ?? null;
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

async function upsertPendingMemberPerson(
  ctx: MutationCtx,
  email: string,
  now: number,
) {
  const name = email;
  const canonicalKey = `contact-email:${email}`;
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

  return { personReferentId, personTagId };
}

async function upsertOrganizationMembership(
  ctx: MutationCtx,
  membership: {
    memberUserId: Id<"users">;
    organizationReferentId: Id<"referents">;
    pendingMembershipId?: Id<"memberships">;
    personReferentId: Id<"referents">;
    role: OrganizationMembershipRole;
    updatedAt: number;
  },
) {
  const existingMembership = await getMembershipByUserAndOrganization(
    ctx,
    membership.memberUserId,
    membership.organizationReferentId,
  );

  if (!existingMembership) {
    if (membership.pendingMembershipId) {
      await ctx.db.patch(membership.pendingMembershipId, {
        memberRole: membership.role,
        memberUserId: membership.memberUserId,
        membershipStatus: "active",
        organizationReferentId: membership.organizationReferentId,
        personReferentId: membership.personReferentId,
        targetKind: "organization",
        updatedAt: membership.updatedAt,
      });

      return membership.pendingMembershipId;
    }

    return await ctx.db.insert("memberships", {
      createdAt: membership.updatedAt,
      memberRole: membership.role,
      memberUserId: membership.memberUserId,
      membershipStatus: "active",
      organizationReferentId: membership.organizationReferentId,
      personReferentId: membership.personReferentId,
      targetKind: "organization",
      updatedAt: membership.updatedAt,
    });
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
  }

  if (
    membership.pendingMembershipId &&
    membership.pendingMembershipId !== existingMembership._id
  ) {
    await ctx.db.patch(membership.pendingMembershipId, {
      membershipStatus: "inactive",
      updatedAt: membership.updatedAt,
    });
  }

  return existingMembership._id;
}

async function getMembershipByUserAndOrganization(
  ctx: OrganizationAccountCtx,
  memberUserId: Id<"users">,
  organizationReferentId: Id<"referents">,
) {
  const existingMemberships = await ctx.db
    .query("memberships")
    .withIndex("by_memberUserId_and_organizationReferentId", (q) =>
      q
        .eq("memberUserId", memberUserId)
        .eq("organizationReferentId", organizationReferentId),
    )
    .take(10);
  const existingMembership = existingMemberships[0];

  return existingMembership ?? null;
}

async function getPendingOrganizationMembershipByContactEmail(
  ctx: OrganizationAccountCtx,
  email: string,
  organizationReferentId: Id<"referents">,
) {
  const personReferent = await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q.eq("knowledgeType", "person").eq("canonicalKey", `contact-email:${email}`),
    )
    .unique();
  if (!personReferent) {
    return null;
  }

  return await getPendingMembershipByPersonAndOrganization(
    ctx,
    personReferent._id,
    organizationReferentId,
  );
}

async function upsertPendingOrganizationMembership(
  ctx: MutationCtx,
  membership: {
    organizationReferentId: Id<"referents">;
    personReferentId: Id<"referents">;
    role: OrganizationMembershipRole;
    updatedAt: number;
  },
) {
  const existingMembership = await getPendingMembershipByPersonAndOrganization(
    ctx,
    membership.personReferentId,
    membership.organizationReferentId,
  );

  if (!existingMembership) {
    return await ctx.db.insert("memberships", {
      createdAt: membership.updatedAt,
      memberRole: membership.role,
      membershipStatus: "invited",
      organizationReferentId: membership.organizationReferentId,
      personReferentId: membership.personReferentId,
      targetKind: "organization",
      updatedAt: membership.updatedAt,
    });
  }

  const patch: Partial<Doc<"memberships">> = {};
  if (existingMembership.memberRole !== membership.role) {
    patch.memberRole = membership.role;
  }
  if (existingMembership.membershipStatus !== "invited") {
    patch.membershipStatus = "invited";
  }
  if (existingMembership.targetKind !== "organization") {
    patch.targetKind = "organization";
  }
  if (
    existingMembership.organizationReferentId !==
    membership.organizationReferentId
  ) {
    patch.organizationReferentId = membership.organizationReferentId;
  }
  if (hasPatch(patch)) {
    patch.updatedAt = membership.updatedAt;
    await ctx.db.patch(existingMembership._id, patch);
  }

  return existingMembership._id;
}

async function getPendingMembershipByPersonAndOrganization(
  ctx: OrganizationAccountCtx,
  personReferentId: Id<"referents">,
  organizationReferentId: Id<"referents">,
) {
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_personReferentId_and_membershipStatus", (q) =>
      q.eq("personReferentId", personReferentId).eq("membershipStatus", "invited"),
    )
    .take(10);

  return (
    memberships.find(
      (membership) =>
        membership.targetKind === "organization" &&
        membership.organizationReferentId === organizationReferentId &&
        membership.memberUserId === undefined,
    ) ?? null
  );
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

function getOrganizationMemberSummary(
  user: Doc<"users">,
  membership: Doc<"memberships">,
) {
  const email = user.email;
  return {
    ...(email === undefined ? {} : { email }),
    membershipId: membership._id,
    name: normalizeName(user.name ?? email ?? "Unknown user") || "Unknown user",
    role: membership.memberRole ?? "member",
    status: "active" as const,
    userId: user._id,
  };
}

async function getOrganizationMemberSummaryWithEvidence(
  ctx: QueryCtx,
  user: Doc<"users">,
  membership: Doc<"memberships">,
) {
  const member = getOrganizationMemberSummary(user, membership);
  const claimEvidence = await getMembershipClaimEvidence(ctx, membership._id);
  return {
    ...member,
    ...(claimEvidence === null ? {} : { claimEvidence }),
  };
}

async function getPendingOrganizationMemberSummary(
  ctx: OrganizationAccountCtx,
  membership: Doc<"memberships">,
  personConsolidationReview?: Doc<"personConsolidationReviews">,
) {
  const person = await getPersonSummary(ctx, membership.personReferentId);
  const reviewEvidence =
    personConsolidationReview === undefined
      ? null
      : await getPersonConsolidationReviewEvidence(
          ctx,
          personConsolidationReview,
        );
  const email = person.email ?? reviewEvidence?.claimedContactValue;
  return {
    ...(email === undefined ? {} : { email }),
    membershipId: membership._id,
    name: person.name,
    ...(reviewEvidence === null
      ? {}
      : { personConsolidationReview: reviewEvidence }),
    role: membership.memberRole ?? "member",
    status: "pending" as const,
  };
}

async function getMembershipClaimEvidence(
  ctx: QueryCtx,
  membershipId: Id<"memberships">,
) {
  const claims = await ctx.db
    .query("membershipClaims")
    .withIndex("by_membershipId_and_createdAt", (q) =>
      q.eq("membershipId", membershipId),
    )
    .order("desc")
    .take(1);
  const claim = claims[0];
  if (!claim) {
    return null;
  }

  const personConsolidation = await getApprovedPersonConsolidationEvidence(
    ctx,
    claim,
  );

  return {
    claimedAt: claim.createdAt,
    claimedContactKind: claim.claimedContactKind,
    claimedContactValue: claim.claimedContactValue,
    claimSource: claim.claimSource,
    ...(personConsolidation === null ? {} : { personConsolidation }),
  };
}

async function getApprovedPersonConsolidationEvidence(
  ctx: QueryCtx,
  claim: Doc<"membershipClaims">,
) {
  if (claim.pendingPersonReferentId === claim.resultingPersonReferentId) {
    return null;
  }

  const approvedReviews = await ctx.db
    .query("personConsolidationReviews")
    .withIndex("by_pendingPersonReferentId_and_reviewStatus_and_createdAt", (q) =>
      q
        .eq("pendingPersonReferentId", claim.pendingPersonReferentId)
        .eq("reviewStatus", "approved"),
    )
    .order("desc")
    .take(MAX_ORGANIZATION_MEMBERS);
  const review =
    approvedReviews.find(
      (candidate) =>
        candidate.requestedByUserId === claim.claimedByUserId &&
        candidate.organizationReferentId === claim.organizationReferentId &&
        candidate.candidatePersonReferentId === claim.resultingPersonReferentId &&
        candidate.claimedContactKind === claim.claimedContactKind &&
        candidate.claimedContactValue === claim.claimedContactValue &&
        candidate.claimSource === claim.claimSource,
    ) ?? null;
  if (review === null) {
    return null;
  }

  const pendingPerson = await getPersonSummary(
    ctx,
    claim.pendingPersonReferentId,
  );
  const resultingPerson = await getPersonSummary(
    ctx,
    claim.resultingPersonReferentId,
  );

  return {
    approvedAt: review.resolvedAt ?? review.updatedAt,
    pendingPersonName: pendingPerson.name,
    pendingPersonReferentId: claim.pendingPersonReferentId,
    resultingPersonName: resultingPerson.name,
    resultingPersonReferentId: claim.resultingPersonReferentId,
    reviewId: review._id,
  };
}

async function recordApprovedMembershipClaim(
  ctx: MutationCtx,
  claim: {
    claimedByUserId: Id<"users">;
    claimedContactKind: Doc<"personConsolidationReviews">["claimedContactKind"];
    claimedContactValue: string;
    claimSource: Doc<"personConsolidationReviews">["claimSource"];
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
    claimedContactKind: claim.claimedContactKind,
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

async function getVisiblePersonConsolidationReviewsByMembership(
  ctx: QueryCtx,
  organizationReferentId: Id<"referents">,
) {
  const pendingReviewsByMembership =
    await getPersonConsolidationReviewsByMembership(
      ctx,
      organizationReferentId,
      "pending",
    );
  const rejectedReviewsByMembership =
    await getPersonConsolidationReviewsByMembership(
      ctx,
      organizationReferentId,
      "rejected",
    );

  for (const [membershipId, review] of rejectedReviewsByMembership) {
    if (!pendingReviewsByMembership.has(membershipId)) {
      pendingReviewsByMembership.set(membershipId, review);
    }
  }

  return pendingReviewsByMembership;
}

async function getPersonConsolidationReviewsByMembership(
  ctx: QueryCtx,
  organizationReferentId: Id<"referents">,
  reviewStatus: "pending" | "rejected",
) {
  const reviews = await ctx.db
    .query("personConsolidationReviews")
    .withIndex("by_organizationReferentId_and_reviewStatus_and_createdAt", (q) =>
      q
        .eq("organizationReferentId", organizationReferentId)
        .eq("reviewStatus", reviewStatus),
    )
    .order("desc")
    .take(MAX_ORGANIZATION_MEMBERS);
  const reviewsByMembership = new Map<
    Id<"memberships">,
    Doc<"personConsolidationReviews">
  >();
  for (const review of reviews) {
    if (!reviewsByMembership.has(review.membershipId)) {
      reviewsByMembership.set(review.membershipId, review);
    }
  }

  return reviewsByMembership;
}

async function getPersonConsolidationReviewForMembership(
  ctx: OrganizationAccountCtx,
  organizationReferentId: Id<"referents">,
  membershipId: Id<"memberships">,
  reviewStatus: "pending" | "rejected",
) {
  const reviews = await ctx.db
    .query("personConsolidationReviews")
    .withIndex("by_organizationReferentId_and_reviewStatus_and_createdAt", (q) =>
      q
        .eq("organizationReferentId", organizationReferentId)
        .eq("reviewStatus", reviewStatus),
    )
    .order("desc")
    .take(MAX_ORGANIZATION_MEMBERS);

  return reviews.find((review) => review.membershipId === membershipId) ?? null;
}

async function getPersonConsolidationReviewEvidence(
  ctx: OrganizationAccountCtx,
  review: Doc<"personConsolidationReviews">,
) {
  const requestedByUser = await ctx.db.get(review.requestedByUserId);
  return {
    claimedContactKind: review.claimedContactKind,
    claimedContactValue: review.claimedContactValue,
    claimSource: review.claimSource,
    requestedAt: review.createdAt,
    ...(requestedByUser?.email === undefined
      ? {}
      : { requestedByEmail: requestedByUser.email }),
    reviewId: review._id,
    reviewReason: review.reviewReason,
    reviewStatus: review.reviewStatus,
    updatedAt: review.updatedAt,
  };
}

async function getPersonSummary(
  ctx: OrganizationAccountCtx,
  personReferentId: Id<"referents">,
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", personReferentId),
    )
    .take(MAX_ORGANIZATION_ENTRIES_PER_REFERENT);
  const personEntry =
    entries.find((entry) => entry.knowledgeType === "person") ?? null;
  if (personEntry) {
    const email = normalizeEmail(personEntry.previewText);
    return {
      email: isEmailLike(email) ? email : undefined,
      name:
        normalizeName(personEntry.title) ||
        (isEmailLike(email) ? email : "Pending member"),
    };
  }

  const referent = await ctx.db.get(personReferentId);
  const name = normalizeName(referent?.canonicalName ?? "Pending member");
  const email = normalizeEmail(referent?.canonicalName ?? "");

  return {
    email: isEmailLike(email) ? email : undefined,
    name: name || "Pending member",
  };
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeLookupKey(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "organization";
}

function formatOrganizationKind(kind: OrganizationKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function hasPatch(patch: object) {
  return Object.keys(patch).length > 0;
}
