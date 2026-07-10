import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  requireAppAccess,
  type AllowedOrganization,
} from "./lib/appAccess";

// Knowledge subscriptions are user-scoped notification preferences for durable
// knowledge pages such as organizations.
const DEFAULT_NOTIFICATION_SUBSCRIPTION_LIMIT = 50;
const MAX_NOTIFICATION_SUBSCRIPTION_LIMIT = 100;
const MAX_TAGS_PER_REFERENT = 5;

const organizationKind = v.union(
  v.literal("school"),
  v.literal("church"),
  v.literal("family"),
  v.literal("community"),
);

const genericKnowledgePageKind = v.union(
  v.literal("dashboard"),
  v.literal("scripture"),
  v.literal("referent"),
  v.literal("context"),
  v.literal("search"),
);

const subscriptionTargetKind = v.union(
  v.literal("organization"),
  v.literal("dashboard"),
  v.literal("scripture"),
  v.literal("referent"),
  v.literal("context"),
  v.literal("search"),
);

const genericKnowledgePageInput = {
  href: v.string(),
  label: v.string(),
  pageKey: v.string(),
  pageKind: genericKnowledgePageKind,
  secondaryLabel: v.optional(v.string()),
};

const notificationSubscriptionSource = v.object({
  createdAt: v.number(),
  href: v.string(),
  id: v.string(),
  label: v.string(),
  organizationKind: v.optional(organizationKind),
  organizationName: v.optional(v.string()),
  organizationReferentId: v.optional(v.id("referents")),
  secondaryLabel: v.string(),
  subscriptionKey: v.string(),
  targetKind: subscriptionTargetKind,
  targetReferentId: v.optional(v.id("referents")),
  updatedAt: v.number(),
});

type OrganizationKind = Doc<"organizationEntries">["organizationKind"];
type SubscriptionRecord = Doc<"knowledgeSubscriptions">;
type KnowledgePageRelationshipKind =
  | "organization"
  | "dashboard"
  | "scripture"
  | "referent"
  | "context"
  | "search";
type NotificationSubscriptionSource = {
  createdAt: number;
  href: string;
  id: string;
  label: string;
  organizationKind?: OrganizationKind;
  organizationName?: string;
  organizationReferentId?: Id<"referents">;
  secondaryLabel: string;
  subscriptionKey: string;
  targetKind: KnowledgePageRelationshipKind;
  targetReferentId?: Id<"referents">;
  updatedAt: number;
};

export const listForNotifications = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(notificationSubscriptionSource),
  handler: async (ctx, args): Promise<NotificationSubscriptionSource[]> => {
    const access = await requireAppAccess(ctx);
    const limit = getNotificationSubscriptionLimit(args.limit);
    const organizationsByReferentId = getOrganizationsByReferentId(
      access.organizations,
    );
    const subscriptionRecords = await ctx.db
      .query("knowledgeSubscriptions")
      .withIndex("by_userId_and_updatedAt", (q) =>
        q.eq("userId", access.userId),
      )
      .order("desc")
      .take(limit);

    return subscriptionRecords
      .map((record) =>
        toNotificationSubscriptionSource(record, organizationsByReferentId),
      )
      .filter(
        (record): record is NotificationSubscriptionSource => record !== null,
      );
  },
});

export const getForTarget = query({
  args: {
    subscriptionKey: v.string(),
  },
  returns: v.union(notificationSubscriptionSource, v.null()),
  handler: async (
    ctx,
    args,
  ): Promise<NotificationSubscriptionSource | null> => {
    const access = await requireAppAccess(ctx);
    const subscription = await getSubscriptionByKey(
      ctx,
      access.userId,
      args.subscriptionKey,
    );
    if (!subscription) {
      return null;
    }

    return toNotificationSubscriptionSource(
      subscription,
      getOrganizationsByReferentId(access.organizations),
    );
  },
});

export const subscribeOrganizationPage = mutation({
  args: {
    organizationReferentId: v.id("referents"),
  },
  returns: notificationSubscriptionSource,
  handler: async (
    ctx,
    args,
  ): Promise<NotificationSubscriptionSource> => {
    const access = await requireAppAccess(ctx);
    const organization = access.organizations.find(
      (candidate) =>
        candidate.organizationReferentId === args.organizationReferentId,
    );
    if (!organization) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const subscriptionKey = getOrganizationSubscriptionKey(
      args.organizationReferentId,
    );
    const existing = await getSubscriptionByKey(
      ctx,
      access.userId,
      subscriptionKey,
    );
    const targetTag = await getOrganizationTag(ctx, args.organizationReferentId);
    const subscription = buildOrganizationSubscriptionSource(organization, now);

    if (existing) {
      await ctx.db.patch(existing._id, {
        hrefSnapshot: subscription.href,
        labelSnapshot: subscription.label,
        organizationReferentId: organization.organizationReferentId,
        secondaryLabelSnapshot: subscription.secondaryLabel,
        subscriptionKey,
        targetKind: "organization",
        targetReferentId: organization.organizationReferentId,
        updatedAt: now,
        ...(targetTag ? { targetTagId: targetTag._id } : {}),
      });
    } else {
      await ctx.db.insert("knowledgeSubscriptions", {
        createdAt: now,
        hrefSnapshot: subscription.href,
        labelSnapshot: subscription.label,
        organizationReferentId: organization.organizationReferentId,
        secondaryLabelSnapshot: subscription.secondaryLabel,
        subscriptionKey,
        targetKind: "organization",
        targetReferentId: organization.organizationReferentId,
        updatedAt: now,
        userId: access.userId,
        ...(targetTag ? { targetTagId: targetTag._id } : {}),
      });
    }

    if (targetTag) {
      await upsertUserTagRecognition(ctx, access.userId, targetTag._id, now);
    }

    return subscription;
  },
});

export const subscribeToKnowledgePage = mutation({
  args: genericKnowledgePageInput,
  returns: notificationSubscriptionSource,
  handler: async (
    ctx,
    args,
  ): Promise<NotificationSubscriptionSource> => {
    const access = await requireAppAccess(ctx);
    const page = normalizeGenericKnowledgePageInput(args);
    const now = Date.now();
    const existing = await getSubscriptionByKey(
      ctx,
      access.userId,
      page.pageKey,
    );
    const subscription = buildGenericKnowledgePageSubscriptionSource(page, now);

    if (existing) {
      await ctx.db.patch(existing._id, {
        hrefSnapshot: subscription.href,
        labelSnapshot: subscription.label,
        secondaryLabelSnapshot: subscription.secondaryLabel,
        subscriptionKey: subscription.subscriptionKey,
        targetKind: subscription.targetKind,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("knowledgeSubscriptions", {
        createdAt: now,
        hrefSnapshot: subscription.href,
        labelSnapshot: subscription.label,
        secondaryLabelSnapshot: subscription.secondaryLabel,
        subscriptionKey: subscription.subscriptionKey,
        targetKind: subscription.targetKind,
        updatedAt: now,
        userId: access.userId,
      });
    }

    return subscription;
  },
});

export const unsubscribe = mutation({
  args: {
    subscriptionKey: v.string(),
  },
  returns: v.object({
    removed: v.boolean(),
    subscriptionKey: v.string(),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const existing = await getSubscriptionByKey(
      ctx,
      access.userId,
      args.subscriptionKey,
    );
    if (!existing) {
      return { removed: false, subscriptionKey: args.subscriptionKey };
    }

    await ctx.db.delete(existing._id);
    return { removed: true, subscriptionKey: args.subscriptionKey };
  },
});

function getNotificationSubscriptionLimit(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_NOTIFICATION_SUBSCRIPTION_LIMIT;
  }

  return Math.min(Math.max(Math.floor(limit), 1), MAX_NOTIFICATION_SUBSCRIPTION_LIMIT);
}

function getOrganizationsByReferentId(organizations: AllowedOrganization[]) {
  return new Map(
    organizations.map((organization) => [
      organization.organizationReferentId,
      organization,
    ]),
  );
}

function buildOrganizationSubscriptionSource(
  organization: AllowedOrganization,
  now: number,
): NotificationSubscriptionSource {
  return {
    createdAt: now,
    href: getOrganizationHref(organization.organizationReferentId),
    id: organization.organizationReferentId,
    label: organization.name,
    organizationKind: organization.organizationKind,
    organizationName: organization.name,
    organizationReferentId: organization.organizationReferentId,
    secondaryLabel: formatOrganizationKind(organization.organizationKind),
    subscriptionKey: getOrganizationSubscriptionKey(
      organization.organizationReferentId,
    ),
    targetKind: "organization",
    targetReferentId: organization.organizationReferentId,
    updatedAt: now,
  };
}

function toNotificationSubscriptionSource(
  record: SubscriptionRecord,
  organizationsByReferentId: Map<Id<"referents">, AllowedOrganization>,
): NotificationSubscriptionSource | null {
  if (
    record.targetKind === "organization" &&
    record.organizationReferentId !== undefined &&
    record.targetReferentId !== undefined
  ) {
    const organization = organizationsByReferentId.get(record.organizationReferentId);
    if (!organization) {
      return null;
    }

    return {
      createdAt: record.createdAt,
      href: getOrganizationHref(organization.organizationReferentId),
      id: organization.organizationReferentId,
      label: organization.name || record.labelSnapshot,
      organizationKind: organization.organizationKind,
      organizationName: organization.name || record.labelSnapshot,
      organizationReferentId: organization.organizationReferentId,
      secondaryLabel:
        record.secondaryLabelSnapshot ??
        formatOrganizationKind(organization.organizationKind),
      subscriptionKey: record.subscriptionKey,
      targetKind: "organization",
      targetReferentId: organization.organizationReferentId,
      updatedAt: record.updatedAt,
    };
  }

  if (record.targetKind === "organization") {
    return null;
  }

  return {
    createdAt: record.createdAt,
    href: record.hrefSnapshot,
    id: record.subscriptionKey,
    label: record.labelSnapshot,
    secondaryLabel:
      record.secondaryLabelSnapshot ?? formatGenericKnowledgePageKind(record.targetKind),
    subscriptionKey: record.subscriptionKey,
    targetKind: record.targetKind,
    updatedAt: record.updatedAt,
  };
}

async function getSubscriptionByKey(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  subscriptionKey: string,
) {
  return await ctx.db
    .query("knowledgeSubscriptions")
    .withIndex("by_userId_and_subscriptionKey", (q) =>
      q.eq("userId", userId).eq("subscriptionKey", subscriptionKey),
    )
    .unique();
}

async function getOrganizationTag(
  ctx: QueryCtx | MutationCtx,
  organizationReferentId: Id<"referents">,
) {
  const tags = await ctx.db
    .query("tags")
    .withIndex("by_referentId", (q) =>
      q.eq("referentId", organizationReferentId),
    )
    .take(MAX_TAGS_PER_REFERENT);

  return tags.find((tag) => tag.knowledgeType === "organization") ?? null;
}

async function upsertUserTagRecognition(
  ctx: MutationCtx,
  userId: Id<"users">,
  tagId: Id<"tags">,
  now: number,
) {
  const existing = await ctx.db
    .query("tagRecognitions")
    .withIndex("by_userId_and_tagId", (q) =>
      q.eq("userId", userId).eq("tagId", tagId),
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      lastInteractedAt: now,
      recognizerKind: "user",
      userId,
    });
    return;
  }

  await ctx.db.insert("tagRecognitions", {
    lastInteractedAt: now,
    recognizedAt: now,
    recognizerKind: "user",
    tagId,
    userId,
  });
}

function getOrganizationSubscriptionKey(organizationReferentId: Id<"referents">) {
  return `organization:${organizationReferentId}`;
}

function getOrganizationHref(organizationReferentId: Id<"referents">) {
  return `/organizations/${encodeURIComponent(organizationReferentId)}`;
}

function formatOrganizationKind(kind: OrganizationKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

type GenericKnowledgePageInput = {
  href: string;
  label: string;
  pageKey: string;
  pageKind: Exclude<KnowledgePageRelationshipKind, "organization">;
  secondaryLabel?: string;
};

function normalizeGenericKnowledgePageInput(
  input: GenericKnowledgePageInput,
): Required<GenericKnowledgePageInput> {
  const pageKey = input.pageKey.trim();
  const label = input.label.trim();
  const href = input.href.trim();
  const secondaryLabel =
    input.secondaryLabel?.trim() || formatGenericKnowledgePageKind(input.pageKind);

  if (!pageKey) {
    throw new Error("Invalid Knowledge Page key");
  }
  if (!label) {
    throw new Error("Invalid Knowledge Page label");
  }
  if (!href.startsWith("/") || href.startsWith("//")) {
    throw new Error("Invalid Knowledge Page href");
  }
  if (!isGenericPageKeyValidForKind(input.pageKind, pageKey)) {
    throw new Error("Invalid Knowledge Page key");
  }

  return {
    href,
    label,
    pageKey,
    pageKind: input.pageKind,
    secondaryLabel,
  };
}

function buildGenericKnowledgePageSubscriptionSource(
  page: Required<GenericKnowledgePageInput>,
  now: number,
): NotificationSubscriptionSource {
  return {
    createdAt: now,
    href: page.href,
    id: page.pageKey,
    label: page.label,
    secondaryLabel: page.secondaryLabel,
    subscriptionKey: page.pageKey,
    targetKind: page.pageKind,
    updatedAt: now,
  };
}

function formatGenericKnowledgePageKind(
  kind: Exclude<KnowledgePageRelationshipKind, "organization">,
) {
  if (kind === "dashboard") {
    return "Dashboard";
  }
  if (kind === "scripture") {
    return "Bible Passage";
  }
  if (kind === "referent") {
    return "Referent Page";
  }
  if (kind === "context") {
    return "Context Page";
  }

  return "Search";
}

function isGenericPageKeyValidForKind(
  kind: Exclude<KnowledgePageRelationshipKind, "organization">,
  pageKey: string,
) {
  return pageKey.startsWith(`${kind}:`);
}
