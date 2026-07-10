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

const genericKnowledgePageKind = v.union(
  v.literal("dashboard"),
  v.literal("scripture"),
  v.literal("referent"),
  v.literal("context"),
  v.literal("search"),
);

const knowledgePageKind = v.union(
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

const profileBookmarkedKnowledgePage = v.object({
  createdAt: v.number(),
  href: v.string(),
  id: v.string(),
  label: v.string(),
  organizationKind: v.optional(organizationKind),
  organizationName: v.optional(v.string()),
  organizationReferentId: v.optional(v.id("referents")),
  pageKind: knowledgePageKind,
  pageKey: v.string(),
  secondaryLabel: v.string(),
  updatedAt: v.number(),
});

type OrganizationKind = Doc<"organizationEntries">["organizationKind"];
type BookmarkRecord = Doc<"bookmarkedKnowledgePages">;
type KnowledgePageRelationshipKind =
  | "organization"
  | "dashboard"
  | "scripture"
  | "referent"
  | "context"
  | "search";
type ProfileBookmarkedKnowledgePage = {
  createdAt: number;
  href: string;
  id: string;
  label: string;
  organizationKind?: OrganizationKind;
  organizationName?: string;
  organizationReferentId?: Id<"referents">;
  pageKind: KnowledgePageRelationshipKind;
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

export const bookmarkKnowledgePage = mutation({
  args: genericKnowledgePageInput,
  returns: profileBookmarkedKnowledgePage,
  handler: async (ctx, args): Promise<ProfileBookmarkedKnowledgePage> => {
    const access = await requireAppAccess(ctx);
    const page = normalizeGenericKnowledgePageInput(args);
    const now = Date.now();
    const existing = await getBookmarkByPageKey(ctx, access.userId, page.pageKey);
    const bookmark = buildGenericKnowledgePageBookmark(page, now);

    if (existing) {
      await ctx.db.patch(existing._id, {
        hrefSnapshot: bookmark.href,
        labelSnapshot: bookmark.label,
        lastReferencedAt: now,
        pageKind: bookmark.pageKind,
        pageKey: bookmark.pageKey,
        secondaryLabelSnapshot: bookmark.secondaryLabel,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("bookmarkedKnowledgePages", {
        createdAt: now,
        hrefSnapshot: bookmark.href,
        labelSnapshot: bookmark.label,
        lastReferencedAt: now,
        pageKey: bookmark.pageKey,
        pageKind: bookmark.pageKind,
        secondaryLabelSnapshot: bookmark.secondaryLabel,
        updatedAt: now,
        userId: access.userId,
      });
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
    pageKind: "organization",
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
    record.pageKind === "organization" &&
    record.organizationReferentId !== undefined
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
      pageKind: "organization",
      pageKey: record.pageKey,
      secondaryLabel:
        record.secondaryLabelSnapshot ??
        formatOrganizationKind(organization.organizationKind),
      updatedAt: record.updatedAt,
    };
  }

  if (record.pageKind === "organization") {
    return null;
  }

  return {
    createdAt: record.createdAt,
    href: record.hrefSnapshot,
    id: record.pageKey,
    label: record.labelSnapshot,
    pageKind: record.pageKind,
    pageKey: record.pageKey,
    secondaryLabel:
      record.secondaryLabelSnapshot ?? formatGenericKnowledgePageKind(record.pageKind),
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

function buildGenericKnowledgePageBookmark(
  page: Required<GenericKnowledgePageInput>,
  now: number,
): ProfileBookmarkedKnowledgePage {
  return {
    createdAt: now,
    href: page.href,
    id: page.pageKey,
    label: page.label,
    pageKind: page.pageKind,
    pageKey: page.pageKey,
    secondaryLabel: page.secondaryLabel,
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
