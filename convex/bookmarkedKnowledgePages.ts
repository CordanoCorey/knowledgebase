import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  requireAppAccess,
  type AllowedOrganization,
} from "./lib/appAccess";

// Bookmarks are profile-scoped knowledge page references, distinct from sidebar
// pins so lightweight saving does not affect primary navigation.
const DEFAULT_PROFILE_BOOKMARK_LIMIT = 50;
const MAX_PROFILE_BOOKMARK_LIMIT = 100;
const MAX_TAGS_PER_REFERENT = 5;

const organizationKind = v.union(
  v.literal("school"),
  v.literal("church"),
  v.literal("family"),
  v.literal("community"),
);

const profileBookmarkedKnowledgePage = v.object({
  createdAt: v.number(),
  href: v.string(),
  id: v.string(),
  label: v.string(),
  organizationKind,
  organizationName: v.string(),
  organizationReferentId: v.id("referents"),
  pageKey: v.string(),
  secondaryLabel: v.string(),
  updatedAt: v.number(),
});

type OrganizationKind = Doc<"organizationEntries">["organizationKind"];
type BookmarkRecord = Doc<"bookmarkedKnowledgePages">;
type ProfileBookmarkedKnowledgePage = {
  createdAt: number;
  href: string;
  id: string;
  label: string;
  organizationKind: OrganizationKind;
  organizationName: string;
  organizationReferentId: Id<"referents">;
  pageKey: string;
  secondaryLabel: string;
  updatedAt: number;
};

export const listForProfile = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(profileBookmarkedKnowledgePage),
  handler: async (ctx, args): Promise<ProfileBookmarkedKnowledgePage[]> => {
    const access = await requireAppAccess(ctx);
    const limit = getProfileBookmarkLimit(args.limit);
    const organizationsByReferentId = getOrganizationsByReferentId(
      access.organizations,
    );
    const bookmarkRecords = await ctx.db
      .query("bookmarkedKnowledgePages")
      .withIndex("by_userId_and_updatedAt", (q) =>
        q.eq("userId", access.userId),
      )
      .order("desc")
      .take(limit);

    return bookmarkRecords
      .map((record) => toProfileBookmark(record, organizationsByReferentId))
      .filter((record): record is ProfileBookmarkedKnowledgePage => record !== null);
  },
});

export const getForPage = query({
  args: {
    pageKey: v.string(),
  },
  returns: v.union(profileBookmarkedKnowledgePage, v.null()),
  handler: async (ctx, args): Promise<ProfileBookmarkedKnowledgePage | null> => {
    const access = await requireAppAccess(ctx);
    const bookmark = await getBookmarkByPageKey(ctx, access.userId, args.pageKey);
    if (!bookmark) {
      return null;
    }

    return toProfileBookmark(
      bookmark,
      getOrganizationsByReferentId(access.organizations),
    );
  },
});

export const bookmarkOrganizationPage = mutation({
  args: {
    organizationReferentId: v.id("referents"),
  },
  returns: profileBookmarkedKnowledgePage,
  handler: async (ctx, args): Promise<ProfileBookmarkedKnowledgePage> => {
    const access = await requireAppAccess(ctx);
    const organization = access.organizations.find(
      (candidate) =>
        candidate.organizationReferentId === args.organizationReferentId,
    );
    if (!organization) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const pageKey = getOrganizationPageKey(args.organizationReferentId);
    const existing = await getBookmarkByPageKey(ctx, access.userId, pageKey);
    const targetTag = await getOrganizationTag(ctx, args.organizationReferentId);
    const bookmark = buildOrganizationBookmark(organization, now);

    if (existing) {
      await ctx.db.patch(existing._id, {
        hrefSnapshot: bookmark.href,
        labelSnapshot: bookmark.label,
        lastReferencedAt: now,
        organizationReferentId: organization.organizationReferentId,
        pageKind: "organization",
        pageKey,
        secondaryLabelSnapshot: bookmark.secondaryLabel,
        targetReferentId: organization.organizationReferentId,
        updatedAt: now,
        ...(targetTag ? { targetTagId: targetTag._id } : {}),
      });
    } else {
      await ctx.db.insert("bookmarkedKnowledgePages", {
        createdAt: now,
        hrefSnapshot: bookmark.href,
        labelSnapshot: bookmark.label,
        lastReferencedAt: now,
        organizationReferentId: organization.organizationReferentId,
        pageKey,
        pageKind: "organization",
        secondaryLabelSnapshot: bookmark.secondaryLabel,
        targetReferentId: organization.organizationReferentId,
        updatedAt: now,
        userId: access.userId,
        ...(targetTag ? { targetTagId: targetTag._id } : {}),
      });
    }

    if (targetTag) {
      await upsertUserTagRecognition(ctx, access.userId, targetTag._id, now);
    }

    return bookmark;
  },
});

export const removeBookmark = mutation({
  args: {
    pageKey: v.string(),
  },
  returns: v.object({
    pageKey: v.string(),
    removed: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const existing = await getBookmarkByPageKey(ctx, access.userId, args.pageKey);
    if (!existing) {
      return { pageKey: args.pageKey, removed: false };
    }

    await ctx.db.delete(existing._id);
    return { pageKey: args.pageKey, removed: true };
  },
});

function getProfileBookmarkLimit(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_PROFILE_BOOKMARK_LIMIT;
  }

  return Math.min(Math.max(Math.floor(limit), 1), MAX_PROFILE_BOOKMARK_LIMIT);
}

function getOrganizationsByReferentId(organizations: AllowedOrganization[]) {
  return new Map(
    organizations.map((organization) => [
      organization.organizationReferentId,
      organization,
    ]),
  );
}

function buildOrganizationBookmark(
  organization: AllowedOrganization,
  now: number,
): ProfileBookmarkedKnowledgePage {
  return {
    createdAt: now,
    href: getOrganizationHref(organization.organizationReferentId),
    id: organization.organizationReferentId,
    label: organization.name,
    organizationKind: organization.organizationKind,
    organizationName: organization.name,
    organizationReferentId: organization.organizationReferentId,
    pageKey: getOrganizationPageKey(organization.organizationReferentId),
    secondaryLabel: formatOrganizationKind(organization.organizationKind),
    updatedAt: now,
  };
}

function toProfileBookmark(
  record: BookmarkRecord,
  organizationsByReferentId: Map<Id<"referents">, AllowedOrganization>,
): ProfileBookmarkedKnowledgePage | null {
  if (
    record.pageKind !== "organization" ||
    record.organizationReferentId === undefined
  ) {
    return null;
  }

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
    pageKey: record.pageKey,
    secondaryLabel:
      record.secondaryLabelSnapshot ??
      formatOrganizationKind(organization.organizationKind),
    updatedAt: record.updatedAt,
  };
}

async function getBookmarkByPageKey(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  pageKey: string,
) {
  return await ctx.db
    .query("bookmarkedKnowledgePages")
    .withIndex("by_userId_and_pageKey", (q) =>
      q.eq("userId", userId).eq("pageKey", pageKey),
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

function getOrganizationPageKey(organizationReferentId: Id<"referents">) {
  return `organization:${organizationReferentId}`;
}

function getOrganizationHref(organizationReferentId: Id<"referents">) {
  return `/organizations/${encodeURIComponent(organizationReferentId)}`;
}

function formatOrganizationKind(kind: OrganizationKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
