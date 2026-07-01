import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireAppAccess, type AppAccessState } from "./lib/appAccess";
import { inferFileRepresentationRoleFromMetadata } from "./lib/fileRepresentationRoles";

// Root search blends tag/referent matches with represented entries while
// respecting the current user's app access.
const DEFAULT_RESULT_LIMIT = 8;
const MAX_RESULT_LIMIT = 16;
const MAX_SEARCH_TEXT_LENGTH = 180;
const MAX_SEARCH_CANDIDATES = 64;
const MAX_RECOGNITIONS_PER_TAG = 20;
const MAX_REPRESENTED_ENTRIES_PER_REFERENT = 20;
const MAX_THUMBNAIL_REPRESENTATIONS_PER_ENTRY = 20;

const referentKnowledgeType = v.union(
  v.literal("words"),
  v.literal("biblePassage"),
  v.literal("topic"),
  v.literal("series"),
  v.literal("question"),
  v.literal("quote"),
  v.literal("sermon"),
  v.literal("essay"),
  v.literal("poem"),
  v.literal("song"),
  v.literal("book"),
  v.literal("shortStory"),
  v.literal("lesson"),
  v.literal("comment"),
  v.literal("prayerRequest"),
  v.literal("event"),
  v.literal("rsvp"),
  v.literal("person"),
  v.literal("organization"),
  v.literal("group"),
  v.literal("place"),
);

const authorableKnowledgeType = v.union(
  v.literal("words"),
  v.literal("topic"),
  v.literal("series"),
  v.literal("question"),
  v.literal("quote"),
  v.literal("sermon"),
  v.literal("essay"),
  v.literal("poem"),
  v.literal("song"),
  v.literal("book"),
  v.literal("shortStory"),
  v.literal("lesson"),
  v.literal("comment"),
  v.literal("prayerRequest"),
  v.literal("event"),
  v.literal("rsvp"),
  v.literal("person"),
  v.literal("organization"),
  v.literal("group"),
  v.literal("place"),
);

const activeTagSnapshot = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  passageString: v.optional(v.string()),
});

const matchedEntryPreview = v.object({
  href: v.string(),
  id: v.string(),
  knowledgeType: authorableKnowledgeType,
  previewText: v.string(),
  primaryTagLabel: v.string(),
  title: v.string(),
});

const rootSearchResult = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  matchedEntryPreview: v.optional(matchedEntryPreview),
  scopeLabel: v.string(),
  tag: activeTagSnapshot,
  thumbnailUrl: v.optional(v.string()),
});

const knowledgePageThumbnailState = v.union(
  v.object({
    entryId: v.id("knowledgeEntries"),
    entryTitle: v.string(),
    thumbnailUrl: v.optional(v.string()),
  }),
  v.null(),
);

type AllowedAccess = Extract<AppAccessState, { status: "allowed" }>;

type SearchAccess = {
  organizationReferentIds: Set<Id<"referents">>;
  userId: Id<"users">;
};

type RootSearchResult = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: Doc<"referents">["knowledgeType"];
  label: string;
  matchedEntryPreview?: {
    href: string;
    id: string;
    knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
    previewText: string;
    primaryTagLabel: string;
    title: string;
  };
  scopeLabel: string;
  tag: {
    canonicalKey: string;
    href: string;
    id: string;
    knowledgeType: Doc<"referents">["knowledgeType"];
    label: string;
    passageString?: string;
  };
  thumbnailUrl?: string;
};

type ScoredRootSearchResult = RootSearchResult & {
  score: number;
  updatedAt: number;
};

type TagCandidate = {
  score: number;
  tag: Doc<"tags">;
};

export const listRootSearchResults = query({
  args: {
    limit: v.optional(v.number()),
    query: v.string(),
  },
  returns: v.array(rootSearchResult),
  handler: async (ctx, args): Promise<RootSearchResult[]> => {
    const access = toSearchAccess(await requireAppAccess(ctx));
    const searchText = normalizeSearchText(args.query);
    const limit = normalizeLimit(args.limit);
    if (!searchText || limit < 1) {
      return [];
    }

    const resultsByReferent = new Map<string, ScoredRootSearchResult>();
    const candidateEntries = await searchEntryCandidates(ctx, searchText, limit);

    for (const entry of candidateEntries) {
      if (!isEntryVisible(entry, access)) {
        continue;
      }

      const result = await toRootSearchResult(ctx, entry, searchText);
      if (!result) {
        continue;
      }

      addRootSearchResult(
        resultsByReferent,
        entry.representedReferentId,
        result,
      );
    }

    const tagCandidates = await searchTagCandidates(ctx, searchText, limit);
    for (const candidate of tagCandidates) {
      const accessScore = await getTagAccessScore(ctx, candidate.tag, access);
      if (accessScore === null) {
        continue;
      }

      const result = await toTagRootSearchResult(
        ctx,
        candidate.tag,
        searchText,
        candidate.score + accessScore,
        access,
      );
      if (!result) {
        continue;
      }

      addRootSearchResult(resultsByReferent, candidate.tag.referentId, result);
    }

    return Array.from(resultsByReferent.values())
      .sort(compareScoredResults)
      .slice(0, limit)
      .map(({ score: _score, updatedAt: _updatedAt, ...result }) => result);
  },
});

export const getKnowledgePageThumbnailState = query({
  args: {
    canonicalKey: v.string(),
    knowledgeType: referentKnowledgeType,
    tagLookupKey: v.string(),
  },
  returns: knowledgePageThumbnailState,
  handler: async (ctx, args) => {
    const access = toSearchAccess(await requireAppAccess(ctx));
    const referentId = await resolveKnowledgePageReferentId(ctx, {
      canonicalKey: args.canonicalKey,
      knowledgeType: args.knowledgeType,
      tagLookupKey: args.tagLookupKey,
    });
    if (referentId === null) {
      return null;
    }

    const entry = await getNewestVisibleRepresentedEntry(ctx, referentId, access);
    if (!entry) {
      return null;
    }

    const thumbnailUrl = await getEntryThumbnailUrl(ctx, entry._id);

    return {
      entryId: entry._id,
      entryTitle: entry.title,
      ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
    };
  },
});

async function searchEntryCandidates(
  ctx: QueryCtx,
  searchText: string,
  limit: number,
) {
  return await ctx.db
    .query("knowledgeEntries")
    .withSearchIndex("search_searchText", (q) =>
      q.search("searchText", searchText),
    )
    .take(getCandidateLimit(limit));
}

async function searchTagCandidates(
  ctx: QueryCtx,
  searchText: string,
  limit: number,
) {
  const candidateLimit = getCandidateLimit(limit);
  const candidates = new Map<string, TagCandidate>();

  const labelMatches = await ctx.db
    .query("tags")
    .withSearchIndex("search_label", (q) => q.search("label", searchText))
    .take(candidateLimit);

  for (const tag of labelMatches) {
    addTagCandidate(candidates, tag, getTagTextScore(tag.label, searchText, 120));
  }

  const aliasMatches = await ctx.db
    .query("tagAliases")
    .withSearchIndex("search_label", (q) => q.search("label", searchText))
    .take(candidateLimit);

  for (const alias of aliasMatches) {
    const tag = await ctx.db.get(alias.tagId);
    if (!tag) {
      continue;
    }

    addTagCandidate(
      candidates,
      tag,
      getTagTextScore(alias.label, searchText, 112),
    );
  }

  const lookupKey = normalizeLookupKey(searchText);
  const exactLookupTag = await ctx.db
    .query("tags")
    .withIndex("by_lookupKey", (q) => q.eq("lookupKey", lookupKey))
    .first();
  if (exactLookupTag) {
    addTagCandidate(candidates, exactLookupTag, 160);
  }

  return Array.from(candidates.values());
}

function addTagCandidate(
  candidates: Map<string, TagCandidate>,
  tag: Doc<"tags">,
  score: number,
) {
  const current = candidates.get(tag._id);
  if (!current || score > current.score) {
    candidates.set(tag._id, { score, tag });
  }
}

function addRootSearchResult(
  resultsByReferent: Map<string, ScoredRootSearchResult>,
  referentId: Id<"referents">,
  result: ScoredRootSearchResult,
) {
  const current = resultsByReferent.get(referentId);
  if (!current) {
    resultsByReferent.set(referentId, result);
    return;
  }

  const bestDisplay =
    compareScoredResults(result, current) < 0 ? result : current;
  resultsByReferent.set(referentId, {
    ...bestDisplay,
    matchedEntryPreview:
      bestDisplay.matchedEntryPreview ??
      result.matchedEntryPreview ??
      current.matchedEntryPreview,
    thumbnailUrl:
      bestDisplay.thumbnailUrl ?? result.thumbnailUrl ?? current.thumbnailUrl,
    score: Math.max(result.score, current.score),
    updatedAt: Math.max(result.updatedAt, current.updatedAt),
  });
}

async function toRootSearchResult(
  ctx: QueryCtx,
  entry: Doc<"knowledgeEntries">,
  searchText: string,
): Promise<ScoredRootSearchResult | null> {
  const tag = await ctx.db.get(entry.primaryTagId);
  if (!tag) {
    return null;
  }

  const referent = await ctx.db.get(entry.representedReferentId);
  if (!referent) {
    return null;
  }

  const canonicalKey = referent.canonicalKey || tag.lookupKey;
  const href = getTagHref(tag, canonicalKey);
  const activeTag = {
    canonicalKey,
    href,
    id: tag.lookupKey,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    ...(tag.knowledgeType === "biblePassage"
      ? { passageString: tag.lookupKey }
      : {}),
  };
  const thumbnailUrl = await getEntryThumbnailUrl(ctx, entry._id);

  return {
    canonicalKey,
    href,
    id: tag.lookupKey,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    matchedEntryPreview: {
      href,
      id: entry._id,
      knowledgeType: entry.knowledgeType,
      previewText: entry.previewText,
      primaryTagLabel: entry.primaryTagLabel,
      title: entry.title,
    },
    scopeLabel: getScopeLabel(entry.visibilityKind),
    score: getEntryScore(entry, searchText),
    tag: activeTag,
    ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
    updatedAt: entry.updatedAt,
  };
}

async function toTagRootSearchResult(
  ctx: QueryCtx,
  tag: Doc<"tags">,
  searchText: string,
  score: number,
  access: SearchAccess,
): Promise<ScoredRootSearchResult | null> {
  const referent = await ctx.db.get(tag.referentId);
  if (!referent) {
    return null;
  }

  const canonicalKey = referent.canonicalKey || tag.lookupKey;
  const href = getTagHref(tag, canonicalKey);
  const previewEntry = await getBestVisibleRepresentedEntry(
    ctx,
    tag.referentId,
    searchText,
    access,
  );
  const preview = previewEntry
    ? toMatchedEntryPreview(previewEntry, href)
    : undefined;
  const thumbnailUrl = previewEntry
    ? await getEntryThumbnailUrl(ctx, previewEntry._id)
    : undefined;

  return {
    canonicalKey,
    href,
    id: tag.lookupKey,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    ...(preview === undefined ? {} : { matchedEntryPreview: preview }),
    scopeLabel: previewEntry
      ? getScopeLabel(previewEntry.visibilityKind)
      : getTagScopeLabel(tag, access),
    score,
    tag: {
      canonicalKey,
      href,
      id: tag.lookupKey,
      knowledgeType: tag.knowledgeType,
      label: tag.label,
      ...(tag.knowledgeType === "biblePassage"
        ? { passageString: tag.lookupKey }
        : {}),
    },
    ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
    updatedAt: previewEntry?.updatedAt ?? 0,
  };
}

async function resolveKnowledgePageReferentId(
  ctx: QueryCtx,
  {
    canonicalKey,
    knowledgeType,
    tagLookupKey,
  }: {
    canonicalKey: string;
    knowledgeType: Doc<"referents">["knowledgeType"];
    tagLookupKey: string;
  },
) {
  const referent = await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q.eq("knowledgeType", knowledgeType).eq("canonicalKey", canonicalKey),
    )
    .first();
  if (referent) {
    return referent._id;
  }

  const tag = await ctx.db
    .query("tags")
    .withIndex("by_knowledgeType_and_lookupKey", (q) =>
      q.eq("knowledgeType", knowledgeType).eq("lookupKey", tagLookupKey),
    )
    .first();

  return tag?.referentId ?? null;
}

async function getNewestVisibleRepresentedEntry(
  ctx: QueryCtx,
  referentId: Id<"referents">,
  access: SearchAccess,
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", referentId),
    )
    .take(MAX_REPRESENTED_ENTRIES_PER_REFERENT);
  let newestEntry: Doc<"knowledgeEntries"> | null = null;

  for (const entry of entries) {
    if (!isEntryVisible(entry, access)) {
      continue;
    }

    if (newestEntry === null || entry.updatedAt > newestEntry.updatedAt) {
      newestEntry = entry;
    }
  }

  return newestEntry;
}

async function getBestVisibleRepresentedEntry(
  ctx: QueryCtx,
  referentId: Id<"referents">,
  searchText: string,
  access: SearchAccess,
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", referentId),
    )
    .take(MAX_REPRESENTED_ENTRIES_PER_REFERENT);
  let bestEntry: Doc<"knowledgeEntries"> | null = null;

  for (const entry of entries) {
    if (!isEntryVisible(entry, access)) {
      continue;
    }

    if (
      bestEntry === null ||
      getEntryScore(entry, searchText) > getEntryScore(bestEntry, searchText) ||
      (getEntryScore(entry, searchText) === getEntryScore(bestEntry, searchText) &&
        entry.updatedAt > bestEntry.updatedAt)
    ) {
      bestEntry = entry;
    }
  }

  return bestEntry;
}

function toMatchedEntryPreview(entry: Doc<"knowledgeEntries">, href: string) {
  return {
    href,
    id: entry._id,
    knowledgeType: entry.knowledgeType,
    previewText: entry.previewText,
    primaryTagLabel: entry.primaryTagLabel,
    title: entry.title,
  };
}

async function getEntryThumbnailUrl(
  ctx: QueryCtx,
  entryId: Id<"knowledgeEntries">,
) {
  const storageRepresentations = await ctx.db
    .query("entryRepresentations")
    .withIndex("by_entryId_and_representationKind", (q) =>
      q.eq("entryId", entryId).eq("representationKind", "storageFile"),
    )
    .take(MAX_THUMBNAIL_REPRESENTATIONS_PER_ENTRY);

  const storageThumbnail = storageRepresentations.find(isThumbnailRepresentation);
  if (storageThumbnail?.storageId !== undefined) {
    return (await ctx.storage.getUrl(storageThumbnail.storageId)) ?? undefined;
  }

  const externalRepresentations = await ctx.db
    .query("entryRepresentations")
    .withIndex("by_entryId_and_representationKind", (q) =>
      q.eq("entryId", entryId).eq("representationKind", "externalUrl"),
    )
    .take(MAX_THUMBNAIL_REPRESENTATIONS_PER_ENTRY);

  return externalRepresentations.find(isThumbnailRepresentation)?.externalUrl;
}

function isThumbnailRepresentation(
  representation: Pick<
    Doc<"entryRepresentations">,
    | "contentType"
    | "externalUrl"
    | "fileName"
    | "representationKind"
    | "representationRole"
    | "storageId"
  >,
) {
  return (
    representation.representationRole === "thumbnail" ||
    (representation.representationKind === "storageFile" &&
      inferFileRepresentationRoleFromMetadata(
        representation.contentType,
        representation.fileName,
      ) === "thumbnail")
  );
}

function isEntryVisible(entry: Doc<"knowledgeEntries">, access: SearchAccess) {
  return isVisibilityScopeAccessible(
    entry.visibilityKind,
    entry.visibilityTargetKey,
    access,
  );
}

async function getTagAccessScore(
  ctx: QueryCtx,
  tag: Doc<"tags">,
  access: SearchAccess,
) {
  const representedEntryScore = await getRepresentedEntryAccessScore(
    ctx,
    tag,
    access,
  );

  if (tag.createdByUserId === undefined) {
    return representedEntryScore === null
      ? null
      : Math.max(10, representedEntryScore);
  }

  if (tag.createdByUserId === access.userId) {
    return 24;
  }

  const recognitionScore = await getRecognitionScore(ctx, tag._id, access);
  if (recognitionScore > 0) {
    return recognitionScore;
  }

  return representedEntryScore !== null && representedEntryScore > 0
    ? representedEntryScore
    : null;
}

async function getRepresentedEntryAccessScore(
  ctx: QueryCtx,
  tag: Doc<"tags">,
  access: SearchAccess,
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", tag.referentId),
    )
    .take(MAX_REPRESENTED_ENTRIES_PER_REFERENT);

  if (entries.length === 0) {
    return 0;
  }

  return entries.some((entry) => isEntryVisible(entry, access)) ? 8 : null;
}

async function getRecognitionScore(
  ctx: QueryCtx,
  tagId: Id<"tags">,
  access: SearchAccess,
) {
  const recognitions = await ctx.db
    .query("tagRecognitions")
    .withIndex("by_tagId", (q) => q.eq("tagId", tagId))
    .take(MAX_RECOGNITIONS_PER_TAG);
  let score = 0;

  for (const recognition of recognitions) {
    if (recognition.recognizerKind === "user" && recognition.userId === access.userId) {
      score = Math.max(score, 36);
      continue;
    }

    if (
      recognition.recognizerKind === "organization" &&
      recognition.organizationReferentId !== undefined &&
      access.organizationReferentIds.has(recognition.organizationReferentId)
    ) {
      score = Math.max(score, 30);
    }
  }

  return score;
}

function isVisibilityScopeAccessible(
  visibilityKind: Doc<"knowledgeEntries">["visibilityKind"],
  targetKey: string,
  access: SearchAccess,
) {
  if (visibilityKind === "public") {
    return true;
  }

  if (visibilityKind === "private") {
    return targetKey === `user:${access.userId}` || targetKey === access.userId;
  }

  if (visibilityKind === "organization") {
    return access.organizationReferentIds.has(targetKey as Id<"referents">);
  }

  return false;
}

function toSearchAccess(access: AllowedAccess): SearchAccess {
  return {
    organizationReferentIds: new Set(
      access.organizations.map(
        (organization) => organization.organizationReferentId,
      ),
    ),
    userId: access.userId,
  };
}

function getScopeLabel(visibilityKind: Doc<"knowledgeEntries">["visibilityKind"]) {
  if (visibilityKind === "public") {
    return "Global";
  }

  if (visibilityKind === "private") {
    return "Personal";
  }

  return "Organization";
}

function getTagScopeLabel(tag: Doc<"tags">, access: SearchAccess) {
  if (tag.createdByUserId === access.userId) {
    return "Personal";
  }

  return "Global";
}

function getTagHref(tag: Doc<"tags">, canonicalKey: string) {
  if (tag.knowledgeType === "biblePassage") {
    return `/scripture/${encodeURIComponent(canonicalKey)}`;
  }

  return `/goto/${encodeURIComponent(canonicalKey)}`;
}

function normalizeSearchText(value: string) {
  return value.trim().slice(0, MAX_SEARCH_TEXT_LENGTH);
}

function normalizeLimit(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_RESULT_LIMIT;
  }

  return Math.max(0, Math.min(Math.floor(value), MAX_RESULT_LIMIT));
}

function getCandidateLimit(limit: number) {
  return Math.min(MAX_SEARCH_CANDIDATES, Math.max(MAX_RESULT_LIMIT, limit * 4));
}

function getEntryScore(entry: Doc<"knowledgeEntries">, searchText: string) {
  const normalizedSearch = normalizeComparableText(searchText);
  const comparableFields = [
    { text: entry.title, weight: 80 },
    { text: entry.primaryTagLabel, weight: 64 },
    { text: entry.previewText, weight: 36 },
    { text: entry.searchText, weight: 24 },
  ];
  let score = 0;

  for (const field of comparableFields) {
    const comparableText = normalizeComparableText(field.text);
    if (comparableText === normalizedSearch) {
      score = Math.max(score, field.weight + 24);
      continue;
    }

    if (comparableText.startsWith(normalizedSearch)) {
      score = Math.max(score, field.weight + 12);
      continue;
    }

    if (comparableText.includes(normalizedSearch)) {
      score = Math.max(score, field.weight);
    }
  }

  return score + (entry.humanWeight ?? 0) / 10;
}

function getTagTextScore(label: string, searchText: string, baseScore: number) {
  const normalizedLabel = normalizeComparableText(label);
  const normalizedSearch = normalizeComparableText(searchText);

  if (normalizedLabel === normalizedSearch) {
    return baseScore + 48;
  }

  if (normalizedLabel.startsWith(normalizedSearch)) {
    return baseScore + 24;
  }

  if (normalizedLabel.includes(normalizedSearch)) {
    return baseScore;
  }

  return Math.max(1, baseScore - 40);
}

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLookupKey(value: string) {
  return normalizeComparableText(value).replace(/\s+/g, "-");
}

function compareScoredResults(
  first: ScoredRootSearchResult,
  second: ScoredRootSearchResult,
) {
  return (
    second.score - first.score ||
    second.updatedAt - first.updatedAt ||
    compareStrings(first.label, second.label) ||
    compareStrings(first.id, second.id)
  );
}

function compareStrings(left: string, right: string) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
