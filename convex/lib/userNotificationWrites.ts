import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// Notification write helpers keep subscription fanout bounded and separate from
// feature mutations that create the underlying event.
const MAX_ORGANIZATION_NOTIFICATION_RECIPIENTS = 100;
const MAX_NOTIFICATION_ROWS_PER_SOURCE = 100;

type NotificationReviewStatus = "approved" | "rejected";

type AccessNotificationInput = {
  body: string;
  contextHref: string;
  contextLabel: string;
  receivedAt: number;
  sourceSubscriptionKey: string;
  targetReferentId: Id<"referents">;
  title: string;
  userId: Id<"users">;
};

export async function notifyOrganizationAdminsOfPersonConsolidationReview(
  ctx: MutationCtx,
  review: {
    claimedContactValue: string;
    organizationReferentId: Id<"referents">;
    personConsolidationReviewId: Id<"personConsolidationReviews">;
    requestedByUserId: Id<"users">;
    updatedAt: number;
  },
) {
  const organization = await getOrganizationNotificationContext(
    ctx,
    review.organizationReferentId,
  );
  const requestedByUser = await ctx.db.get(review.requestedByUserId);
  const claimantLabel = requestedByUser?.email ?? "A user";
  const sourceSubscriptionKey = getPersonConsolidationReviewNotificationKey(
    review.personConsolidationReviewId,
    "requested",
  );
  const memberships = await ctx.db
    .query("memberships")
    .withIndex("by_organizationReferentId_and_membershipStatus", (q) =>
      q
        .eq("organizationReferentId", review.organizationReferentId)
        .eq("membershipStatus", "active"),
    )
    .take(MAX_ORGANIZATION_NOTIFICATION_RECIPIENTS);
  const notifiedUserIds = new Set<Id<"users">>();

  for (const membership of memberships) {
    if (
      membership.memberRole !== "admin" ||
      membership.memberUserId === undefined ||
      notifiedUserIds.has(membership.memberUserId)
    ) {
      continue;
    }

    const user = await ctx.db.get(membership.memberUserId);
    if (!user || user.isActive !== true) {
      continue;
    }

    notifiedUserIds.add(membership.memberUserId);
    await upsertUnreadAccessNotification(ctx, {
      body: `${claimantLabel} claimed ${review.claimedContactValue} for ${organization.name}; review the Person Consolidation request.`,
      contextHref: organization.settingsHref,
      contextLabel: organization.name,
      receivedAt: review.updatedAt,
      sourceSubscriptionKey,
      targetReferentId: review.organizationReferentId,
      title: "Identity review needed",
      userId: membership.memberUserId,
    });
  }
}

export async function notifyPersonConsolidationReviewClaimant(
  ctx: MutationCtx,
  review: {
    claimedContactValue: string;
    organizationReferentId: Id<"referents">;
    personConsolidationReviewId: Id<"personConsolidationReviews">;
    requestedByUserId: Id<"users">;
    reviewStatus: NotificationReviewStatus;
    updatedAt: number;
  },
) {
  const organization = await getOrganizationNotificationContext(
    ctx,
    review.organizationReferentId,
  );
  const wasApproved = review.reviewStatus === "approved";

  await upsertUnreadAccessNotification(ctx, {
    body: wasApproved
      ? `Your claim for ${review.claimedContactValue} at ${organization.name} was approved.`
      : `Your claim for ${review.claimedContactValue} at ${organization.name} was not approved after identity review.`,
    contextHref: organization.homeHref,
    contextLabel: organization.name,
    receivedAt: review.updatedAt,
    sourceSubscriptionKey: getPersonConsolidationReviewNotificationKey(
      review.personConsolidationReviewId,
      review.reviewStatus,
    ),
    targetReferentId: review.organizationReferentId,
    title: wasApproved
      ? "Membership claim approved"
      : "Membership claim not approved",
    userId: review.requestedByUserId,
  });
}

async function upsertUnreadAccessNotification(
  ctx: MutationCtx,
  input: AccessNotificationInput,
) {
  const existingNotifications = await ctx.db
    .query("userNotifications")
    .withIndex("by_sourceSubscriptionKey_and_receivedAt", (q) =>
      q.eq("sourceSubscriptionKey", input.sourceSubscriptionKey),
    )
    .order("desc")
    .take(MAX_NOTIFICATION_ROWS_PER_SOURCE);
  const existingNotification =
    existingNotifications.find(
      (notification) => notification.userId === input.userId,
    ) ?? null;
  const notification = {
    body: input.body,
    contextHref: input.contextHref,
    contextLabel: input.contextLabel,
    notificationKind: "access" as const,
    notificationStatus: "unread" as const,
    receivedAt: input.receivedAt,
    sourceKind: "system" as const,
    sourceSubscriptionKey: input.sourceSubscriptionKey,
    targetReferentId: input.targetReferentId,
    title: input.title,
    updatedAt: input.receivedAt,
    userId: input.userId,
  };

  if (existingNotification) {
    const { _creationTime, _id, readAt, ...replacement } =
      existingNotification;
    await ctx.db.replace(_id, {
      ...replacement,
      ...notification,
      createdAt: existingNotification.createdAt,
    });
    return _id;
  }

  return await ctx.db.insert("userNotifications", {
    ...notification,
    createdAt: input.receivedAt,
  });
}

async function getOrganizationNotificationContext(
  ctx: MutationCtx,
  organizationReferentId: Id<"referents">,
) {
  const referent = await ctx.db.get(organizationReferentId);
  const routeId =
    referent?.knowledgeType === "organization"
      ? referent.canonicalKey
      : organizationReferentId;
  const encodedRouteId = encodeURIComponent(routeId);
  const homeHref = `/organizations/${encodedRouteId}`;

  return {
    homeHref,
    name:
      referent?.knowledgeType === "organization"
        ? referent.canonicalName
        : "Organization",
    settingsHref: `${homeHref}/settings`,
  };
}

function getPersonConsolidationReviewNotificationKey(
  personConsolidationReviewId: Id<"personConsolidationReviews">,
  event: "requested" | NotificationReviewStatus,
) {
  return `person-consolidation-review:${personConsolidationReviewId}:${event}`;
}
