import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireAppAccess, type AppAccessState } from "./lib/appAccess";
import { getRepresentedReferentThumbnailUrl } from "./lib/referentThumbnails";
import {
  resolveBiblePassageSearchTarget,
  type ResolvedBiblePassageSearchTarget,
} from "./lib/scriptureSearch";

// Tag suggestion queries favor deterministic, bounded candidates so text input
// subscriptions stay responsive.
const DEFAULT_SUGGESTION_LIMIT = 5;
const MAX_SUGGESTION_LIMIT = 8;
const MAX_SEARCH_TEXT_LENGTH = 120;
const MAX_ACTIVE_TAGS = 20;
const MAX_SEARCH_CANDIDATES = 32;
const MAX_RECOGNITIONS_PER_TAG = 20;
const MAX_REPRESENTED_ENTRIES_PER_REFERENT = 20;
const MAX_CORRELATION_ROWS_PER_TAG = 40;
const MAX_ENTRY_TAGS_FOR_CORRELATION = 40;
const MAX_RECOMMENDED_CONTEXT_ROWS_PER_ACTIVE_TAG = 32;
const MAX_RECOMMENDED_ENTRY_TAGS = 32;
const MAX_RECOMMENDED_RECOGNITIONS_PER_SCOPE = 24;
const MAX_RECOMMENDED_RECOGNITION_ORGANIZATIONS = 10;
const MAX_RECOMMENDED_RECENT_ENTRIES = 40;
const MAX_CONTEXT_REPRESENTED_ENTRIES_PER_TAG = 8;
const MAX_RECOMMENDED_AUTHORED_WORKS_PER_PERSON_TAG = 24;
const MAX_SCRIPTURE_RECOMMENDATION_RANGES = 4;
const MAX_LITERATURE_METADATA_SEARCH_TERMS = 4;
const MAX_LITERATURE_METADATA_SEARCH_CANDIDATES_PER_TERM = 16;
const MAX_LITERATURE_REFERENT_SEARCH_CANDIDATES_PER_TERM = 16;
const MAX_LITERATURE_REFERENT_TAGS = 8;
const MAX_ROUTE_ACTIVE_TAGS = 20;
const MAX_ROUTE_TAG_MATCHES = 16;
const MAX_ROUTE_REFERENT_TAGS = 8;
const RELATED_RECOMMENDATION_SCORE = 120;
const LITERATURE_METADATA_RECOMMENDATION_SCORE = 72;
const USER_RECOGNITION_RECOMMENDATION_SCORE = 80;
const ORGANIZATION_RECOGNITION_RECOMMENDATION_SCORE = 64;
const RECENT_ACCESSIBLE_RECOMMENDATION_SCORE = 18;
const GENERIC_LITERATURE_SEARCH_TERMS = new Set([
  "anthology",
  "book",
  "essay",
  "novel",
  "poem",
  "poetry",
  "short story",
  "song",
]);

const REFERENT_KNOWLEDGE_TYPES = [
  "words",
  "announcement",
  "biblePassage",
  "topic",
  "series",
  "question",
  "quote",
  "sermon",
  "essay",
  "poem",
  "song",
  "book",
  "shortStory",
  "lesson",
  "comment",
  "prayerRequest",
  "event",
  "rsvp",
  "person",
  "organization",
  "group",
  "place",
] as const satisfies readonly Doc<"referents">["knowledgeType"][];

const referentKnowledgeType = v.union(
  v.literal("words"),
  v.literal("announcement"),
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

const activeTagSnapshot = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  passageString: v.optional(v.string()),
  thumbnailUrl: v.optional(v.string()),
});

const suggestionTag = activeTagSnapshot;
const routeActiveTagResolution = v.union(activeTagSnapshot, v.null());

const tagSuggestion = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  matchKind: v.union(v.literal("label"), v.literal("alias")),
  tag: suggestionTag,
});

type ActiveTagSnapshot = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: Doc<"referents">["knowledgeType"];
  label: string;
  passageString?: string;
  thumbnailUrl?: string;
};

type TagSuggestion = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: Doc<"referents">["knowledgeType"];
  label: string;
  matchKind: "label" | "alias";
  tag: ActiveTagSnapshot;
};

type AllowedAccess = Extract<AppAccessState, { status: "allowed" }>;

type SuggestionAccess = {
  organizationReferentIds: Set<Id<"referents">>;
  userId: Id<"users">;
};

type LiteratureDetail = {
  approxGradeMax?: number | null;
  approxGradeMin?: number | null;
  author?: string | null;
  genres?: string[];
  historicalTimeframeEndYear?: number | null;
  historicalTimeframeStartYear?: number | null;
};

type LiteratureRecommendationWork = {
  knowledgeType: Doc<"referents">["knowledgeType"];
};

type Candidate = {
  matchKind: "label" | "alias";
  score: number;
  tag: Doc<"tags">;
};

export const listRootSearchTagSuggestions = query({
  args: {
    limit: v.optional(v.number()),
    query: v.string(),
  },
  returns: v.array(tagSuggestion),
  handler: async (ctx, args): Promise<TagSuggestion[]> => {
    const access = toSuggestionAccess(await requireAppAccess(ctx));
    const searchText = normalizeSearchText(args.query);
    const limit = normalizeLimit(args.limit);
    if (!searchText || limit < 1) {
      return [];
    }

    const candidates = await searchTagCandidates(ctx, searchText, limit);
    const suggestions = await summarizeCandidates(ctx, candidates, access, {
      activeTagIds: new Set(),
      limit,
    });
    return await withBiblePassageSuggestion(ctx, searchText, suggestions, {
      activeBiblePassageKeys: new Set(),
      limit,
    });
  },
});

export const listKnowledgeNavigatorTagSuggestions = query({
  args: {
    activeTags: v.array(activeTagSnapshot),
    limit: v.optional(v.number()),
    query: v.string(),
  },
  returns: v.array(tagSuggestion),
  handler: async (ctx, args): Promise<TagSuggestion[]> => {
    const access = toSuggestionAccess(await requireAppAccess(ctx));
    const searchText = normalizeSearchText(args.query);
    const limit = normalizeLimit(args.limit);
    if (!searchText || limit < 1) {
      return [];
    }

    const activeTagIds = await resolveActiveTagIds(ctx, args.activeTags);
    const candidates = await searchTagCandidates(ctx, searchText, limit);
    const suggestions = await summarizeCandidates(ctx, candidates, access, {
      activeTagIds,
      limit,
    });
    return await withBiblePassageSuggestion(ctx, searchText, suggestions, {
      activeBiblePassageKeys: getActiveBiblePassageKeys(args.activeTags),
      limit,
    });
  },
});

export const listKnowledgeNavigatorRecommendedTags = query({
  args: {
    activeTags: v.array(activeTagSnapshot),
    limit: v.optional(v.number()),
  },
  returns: v.array(tagSuggestion),
  handler: async (ctx, args): Promise<TagSuggestion[]> => {
    const access = toSuggestionAccess(await requireAppAccess(ctx));
    const limit = normalizeLimit(args.limit);
    if (limit < 1) {
      return [];
    }

    const activeTagIds = await resolveActiveTagIds(ctx, args.activeTags);
    const candidates = await getRecommendedTagCandidates(
      ctx,
      activeTagIds,
      access,
    );

    const suggestions = await summarizeCandidates(ctx, candidates, access, {
      activeTagIds,
      limit,
    });
    return await withActiveBiblePassageRecommendationSuggestions(
      ctx,
      args.activeTags,
      suggestions,
      { limit },
    );
  },
});

export const resolveRouteActiveTags = query({
  args: {
    tagKeys: v.array(v.string()),
  },
  returns: v.array(routeActiveTagResolution),
  handler: async (ctx, args): Promise<Array<ActiveTagSnapshot | null>> => {
    const access = toSuggestionAccess(await requireAppAccess(ctx));
    const tagKeys = normalizeRouteTagKeys(args.tagKeys);
    const resolvedTags: Array<ActiveTagSnapshot | null> = [];

    for (const tagKey of tagKeys) {
      const biblePassageTarget = await resolveBiblePassageSearchTarget(ctx, tagKey);
      if (biblePassageTarget) {
        resolvedTags.push(toBiblePassageActiveTagSnapshot(biblePassageTarget));
        continue;
      }

      const tag = await resolveRouteTag(ctx, tagKey, access);
      resolvedTags.push(tag ? await toActiveTagSnapshot(ctx, tag, access) : null);
    }

    return resolvedTags;
  },
});

async function searchTagCandidates(
  ctx: QueryCtx,
  searchText: string,
  limit: number,
) {
  const candidateLimit = getCandidateLimit(limit);
  const candidates = new Map<string, Candidate>();

  const labelMatches = await ctx.db
    .query("tags")
    .withSearchIndex("search_label", (q) => q.search("label", searchText))
    .take(candidateLimit);

  for (const tag of labelMatches) {
    addCandidate(candidates, tag, "label", getTextScore(tag.label, searchText));
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

    addCandidate(
      candidates,
      tag,
      "alias",
      Math.max(1, getTextScore(alias.label, searchText) - 5),
    );
  }

  const lookupKey = normalizeLookupKey(searchText);
  const exactLookupTag = await ctx.db
    .query("tags")
    .withIndex("by_lookupKey", (q) => q.eq("lookupKey", lookupKey))
    .first();
  if (exactLookupTag) {
    addCandidate(candidates, exactLookupTag, "label", 80);
  }

  await addReferenceDetailCandidates(ctx, candidates, searchText, candidateLimit);

  return Array.from(candidates.values());
}

function addCandidate(
  candidates: Map<string, Candidate>,
  tag: Doc<"tags">,
  matchKind: Candidate["matchKind"],
  score: number,
) {
  const current = candidates.get(tag._id);
  if (!current || score > current.score) {
    candidates.set(tag._id, { matchKind, score, tag });
  }
}

async function addReferenceDetailCandidates(
  ctx: QueryCtx,
  candidates: Map<string, Candidate>,
  searchText: string,
  candidateLimit: number,
) {
  const personDetails = await ctx.db
    .query("personReferentDetails")
    .withSearchIndex("search_searchText", (q) =>
      q.search("searchText", searchText),
    )
    .take(candidateLimit);
  for (const detail of personDetails) {
    const tag = await getPrimaryTagForReferent(
      ctx,
      detail.referentId,
      "person",
    );
    if (tag) {
      addCandidate(candidates, tag, "label", getTextScore(tag.label, searchText));
    }
  }

  const organizationDetails = await ctx.db
    .query("organizationReferentDetails")
    .withSearchIndex("search_searchText", (q) =>
      q.search("searchText", searchText),
    )
    .take(candidateLimit);
  for (const detail of organizationDetails) {
    if (detail.isActive === false) {
      continue;
    }

    const tag = await getPrimaryTagForReferent(
      ctx,
      detail.referentId,
      "organization",
    );
    if (tag) {
      addCandidate(candidates, tag, "label", getTextScore(tag.label, searchText));
    }
  }
}

async function getRecommendedTagCandidates(
  ctx: QueryCtx,
  activeTagIds: Set<Id<"tags">>,
  access: SuggestionAccess,
) {
  const candidates = new Map<string, Candidate>();

  if (activeTagIds.size > 0) {
    await addContextRecommendationCandidates(
      ctx,
      candidates,
      activeTagIds,
      access,
    );
  }

  await addRecognitionRecommendationCandidates(ctx, candidates, access);
  await addRecentAccessibleRecommendationCandidates(ctx, candidates, access);

  return Array.from(candidates.values());
}

async function addContextRecommendationCandidates(
  ctx: QueryCtx,
  candidates: Map<string, Candidate>,
  activeTagIds: Set<Id<"tags">>,
  access: SuggestionAccess,
) {
  for (const activeTagId of activeTagIds) {
    const rows = await ctx.db
      .query("entryTags")
      .withIndex("by_tagId_and_entryId", (q) => q.eq("tagId", activeTagId))
      .take(MAX_RECOMMENDED_CONTEXT_ROWS_PER_ACTIVE_TAG);

    for (const row of rows) {
      const entry = await ctx.db.get(row.entryId);
      if (!entry || !isEntryAccessible(entry, access)) {
        continue;
      }

      const entryTags = await ctx.db
        .query("entryTags")
        .withIndex("by_entryId_and_tagId", (q) => q.eq("entryId", row.entryId))
        .take(MAX_RECOMMENDED_ENTRY_TAGS);

      for (const entryTag of entryTags) {
        if (activeTagIds.has(entryTag.tagId)) {
          continue;
        }

        const tag = await ctx.db.get(entryTag.tagId);
        if (!tag) {
          continue;
        }

        addRecommendedCandidate(
          candidates,
          tag,
          getContextRecommendationScore(entry, entryTag, access),
        );
      }
    }
  }

  await addLiteratureMetadataRecommendationCandidatesForActiveTags(
    ctx,
    candidates,
    activeTagIds,
    access,
  );
  await addPersonAuthoredWorkRecommendationCandidatesForActiveTags(
    ctx,
    candidates,
    activeTagIds,
  );
}

async function addLiteratureMetadataRecommendationCandidatesForActiveTags(
  ctx: QueryCtx,
  candidates: Map<string, Candidate>,
  activeTagIds: Set<Id<"tags">>,
  access: SuggestionAccess,
) {
  for (const activeTagId of activeTagIds) {
    const activeTag = await ctx.db.get(activeTagId);
    if (!activeTag) {
      continue;
    }

    const referentDetail = await getLiteratureReferentDetail(
      ctx,
      activeTag.referentId,
    );
    if (referentDetail) {
      await addLiteratureReferentMetadataRecommendationCandidates(
        ctx,
        candidates,
        referentDetail,
        activeTagIds,
      );
    }

    const representedEntries = await ctx.db
      .query("knowledgeEntries")
      .withIndex("by_representedReferentId", (q) =>
        q.eq("representedReferentId", activeTag.referentId),
      )
      .take(MAX_CONTEXT_REPRESENTED_ENTRIES_PER_TAG);

    for (const representedEntry of representedEntries) {
      if (!isEntryAccessible(representedEntry, access)) {
        continue;
      }

      await addLiteratureEntryMetadataRecommendationCandidates(
        ctx,
        candidates,
        representedEntry,
        activeTagIds,
        access,
      );
    }
  }
}

async function addLiteratureReferentMetadataRecommendationCandidates(
  ctx: QueryCtx,
  candidates: Map<string, Candidate>,
  activeDetail: Doc<"literatureReferentDetails">,
  activeTagIds: Set<Id<"tags">>,
) {
  const searchTerms = getLiteratureMetadataSearchTerms(activeDetail);
  if (searchTerms.length === 0) {
    return;
  }

  const candidateScores = new Map<
    string,
    { score: number; tag: Doc<"tags"> }
  >();

  for (const [termIndex, searchTerm] of searchTerms.entries()) {
    const details = await ctx.db
      .query("literatureReferentDetails")
      .withSearchIndex("search_searchText", (q) =>
        q.search("searchText", searchTerm),
      )
      .take(MAX_LITERATURE_REFERENT_SEARCH_CANDIDATES_PER_TERM);

    for (const candidateDetail of details) {
      if (candidateDetail.referentId === activeDetail.referentId) {
        continue;
      }

      const tag = await getPrimaryTagForReferent(
        ctx,
        candidateDetail.referentId,
        candidateDetail.knowledgeType,
      );
      if (!tag || activeTagIds.has(tag._id)) {
        continue;
      }

      const score =
        LITERATURE_METADATA_RECOMMENDATION_SCORE +
        getLiteratureMetadataSimilarityScore(
          activeDetail,
          activeDetail,
          candidateDetail,
          candidateDetail,
        ) +
        Math.max(0, MAX_LITERATURE_METADATA_SEARCH_TERMS - termIndex);
      const current = candidateScores.get(tag._id);
      if (!current || score > current.score) {
        candidateScores.set(tag._id, { score, tag });
      }
    }
  }

  for (const { score, tag } of candidateScores.values()) {
    addRecommendedCandidate(candidates, tag, score);
  }
}

async function addLiteratureEntryMetadataRecommendationCandidates(
  ctx: QueryCtx,
  candidates: Map<string, Candidate>,
  activeEntry: Doc<"knowledgeEntries">,
  activeTagIds: Set<Id<"tags">>,
  access: SuggestionAccess,
) {
  const activeDetail = await getLiteratureDetail(ctx, activeEntry);
  if (!activeDetail) {
    return;
  }

  const searchTerms = getLiteratureMetadataSearchTerms(activeDetail);
  if (searchTerms.length === 0) {
    return;
  }

  const candidateScores = new Map<
    string,
    { score: number; tag: Doc<"tags"> }
  >();

  for (const [termIndex, searchTerm] of searchTerms.entries()) {
    const entries = await ctx.db
      .query("knowledgeEntries")
      .withSearchIndex("search_searchText", (q) =>
        q.search("searchText", searchTerm),
      )
      .take(MAX_LITERATURE_METADATA_SEARCH_CANDIDATES_PER_TERM);

    for (const entry of entries) {
      if (
        entry._id === activeEntry._id ||
        activeTagIds.has(entry.primaryTagId) ||
        !isEntryAccessible(entry, access)
      ) {
        continue;
      }

      const candidateDetail = await getLiteratureDetail(ctx, entry);
      if (!candidateDetail) {
        continue;
      }

      const tag = await ctx.db.get(entry.primaryTagId);
      if (!tag) {
        continue;
      }

      const score =
        LITERATURE_METADATA_RECOMMENDATION_SCORE +
        getLiteratureMetadataSimilarityScore(
          activeEntry,
          activeDetail,
          entry,
          candidateDetail,
        ) +
        Math.max(0, MAX_LITERATURE_METADATA_SEARCH_TERMS - termIndex);
      const current = candidateScores.get(tag._id);
      if (!current || score > current.score) {
        candidateScores.set(tag._id, { score, tag });
      }
    }
  }

  for (const { score, tag } of candidateScores.values()) {
    addRecommendedCandidate(candidates, tag, score);
  }
}

async function getLiteratureReferentDetail(
  ctx: QueryCtx,
  referentId: Id<"referents">,
) {
  return await ctx.db
    .query("literatureReferentDetails")
    .withIndex("by_referentId", (q) => q.eq("referentId", referentId))
    .unique();
}

async function getPrimaryTagForReferent(
  ctx: QueryCtx,
  referentId: Id<"referents">,
  knowledgeType: Doc<"referents">["knowledgeType"],
) {
  const tags = await ctx.db
    .query("tags")
    .withIndex("by_referentId", (q) => q.eq("referentId", referentId))
    .take(MAX_LITERATURE_REFERENT_TAGS);

  return (
    tags.find((tag) => tag.knowledgeType === knowledgeType) ??
    tags[0] ??
    null
  );
}

async function addPersonAuthoredWorkRecommendationCandidatesForActiveTags(
  ctx: QueryCtx,
  candidates: Map<string, Candidate>,
  activeTagIds: Set<Id<"tags">>,
) {
  for (const activeTagId of activeTagIds) {
    const activeTag = await ctx.db.get(activeTagId);
    if (!activeTag || activeTag.knowledgeType !== "person") {
      continue;
    }

    const references = await ctx.db
      .query("literatureAuthorReferences")
      .withIndex("by_personReferentId", (q) =>
        q.eq("personReferentId", activeTag.referentId),
      )
      .take(MAX_RECOMMENDED_AUTHORED_WORKS_PER_PERSON_TAG);

    for (const [index, reference] of references.entries()) {
      const workReferent = await ctx.db.get(reference.workReferentId);
      if (!workReferent) {
        continue;
      }

      const tag = await getPrimaryTagForReferent(
        ctx,
        workReferent._id,
        workReferent.knowledgeType,
      );
      if (!tag || activeTagIds.has(tag._id)) {
        continue;
      }

      addRecommendedCandidate(
        candidates,
        tag,
        getRankedPersonRelationScore(RELATED_RECOMMENDATION_SCORE, index),
      );
    }
  }
}

async function addRecognitionRecommendationCandidates(
  ctx: QueryCtx,
  candidates: Map<string, Candidate>,
  access: SuggestionAccess,
) {
  const userRecognitions = await ctx.db
    .query("tagRecognitions")
    .withIndex("by_userId_and_lastInteractedAt", (q) =>
      q.eq("userId", access.userId),
    )
    .order("desc")
    .take(MAX_RECOMMENDED_RECOGNITIONS_PER_SCOPE);

  for (const [index, recognition] of userRecognitions.entries()) {
    const tag = await ctx.db.get(recognition.tagId);
    if (!tag) {
      continue;
    }

    addRecommendedCandidate(
      candidates,
      tag,
      getRankedRecognitionScore(
        USER_RECOGNITION_RECOMMENDATION_SCORE,
        index,
      ),
    );
  }

  const organizationReferentIds = Array.from(access.organizationReferentIds).slice(
    0,
    MAX_RECOMMENDED_RECOGNITION_ORGANIZATIONS,
  );
  for (const organizationReferentId of organizationReferentIds) {
    const organizationRecognitions = await ctx.db
      .query("tagRecognitions")
      .withIndex("by_organizationReferentId_and_lastInteractedAt", (q) =>
        q.eq("organizationReferentId", organizationReferentId),
      )
      .order("desc")
      .take(MAX_RECOMMENDED_RECOGNITIONS_PER_SCOPE);

    for (const [index, recognition] of organizationRecognitions.entries()) {
      const tag = await ctx.db.get(recognition.tagId);
      if (!tag) {
        continue;
      }

      addRecommendedCandidate(
        candidates,
        tag,
        getRankedRecognitionScore(
          ORGANIZATION_RECOGNITION_RECOMMENDATION_SCORE,
          index,
        ),
      );
    }
  }
}

async function addRecentAccessibleRecommendationCandidates(
  ctx: QueryCtx,
  candidates: Map<string, Candidate>,
  access: SuggestionAccess,
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_updatedAt")
    .order("desc")
    .take(MAX_RECOMMENDED_RECENT_ENTRIES);

  for (const [index, entry] of entries.entries()) {
    if (!isEntryAccessible(entry, access)) {
      continue;
    }

    const tag = await ctx.db.get(entry.primaryTagId);
    if (!tag) {
      continue;
    }

    addRecommendedCandidate(
      candidates,
      tag,
      Math.max(1, RECENT_ACCESSIBLE_RECOMMENDATION_SCORE - index),
    );
  }
}

function addRecommendedCandidate(
  candidates: Map<string, Candidate>,
  tag: Doc<"tags">,
  score: number,
) {
  const current = candidates.get(tag._id);
  if (current) {
    current.score += score;
    return;
  }

  candidates.set(tag._id, { matchKind: "label", score, tag });
}

function getContextRecommendationScore(
  entry: Doc<"knowledgeEntries">,
  entryTag: Doc<"entryTags">,
  access: SuggestionAccess,
) {
  return (
    RELATED_RECOMMENDATION_SCORE +
    (entryTag.tagPurpose === "represented" ? 16 : 8) +
    (entry.createdByUserId === access.userId ? 8 : 0)
  );
}

async function getLiteratureDetail(
  ctx: QueryCtx,
  entry: Doc<"knowledgeEntries">,
): Promise<LiteratureDetail | null> {
  if (entry.knowledgeType === "book") {
    return await ctx.db
      .query("bookEntries")
      .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
      .unique();
  }

  if (entry.knowledgeType === "poem") {
    return await ctx.db
      .query("poemEntries")
      .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
      .unique();
  }

  if (entry.knowledgeType === "shortStory") {
    return await ctx.db
      .query("shortStoryEntries")
      .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
      .unique();
  }

  if (entry.knowledgeType === "song") {
    return await ctx.db
      .query("songEntries")
      .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
      .unique();
  }

  if (entry.knowledgeType === "series") {
    return await ctx.db
      .query("seriesEntries")
      .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
      .unique();
  }

  if (entry.knowledgeType === "essay") {
    return await ctx.db
      .query("essayEntries")
      .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
      .unique();
  }

  return null;
}

function getLiteratureMetadataSearchTerms(detail: LiteratureDetail) {
  const terms: string[] = [];
  addSearchTerm(terms, detail.author ?? "");

  for (const genre of detail.genres ?? []) {
    const normalizedGenre = normalizeComparableText(genre);
    if (!normalizedGenre || GENERIC_LITERATURE_SEARCH_TERMS.has(normalizedGenre)) {
      continue;
    }

    addSearchTerm(terms, genre);
  }

  if (terms.length === 0) {
    for (const genre of detail.genres ?? []) {
      addSearchTerm(terms, genre);
    }
  }

  return terms.slice(0, MAX_LITERATURE_METADATA_SEARCH_TERMS);
}

function addSearchTerm(terms: string[], term: string) {
  const normalizedTerm = normalizeComparableText(term);
  if (
    !normalizedTerm ||
    terms.some((existing) => normalizeComparableText(existing) === normalizedTerm)
  ) {
    return;
  }

  terms.push(term);
}

function getLiteratureMetadataSimilarityScore(
  activeWork: LiteratureRecommendationWork,
  activeDetail: LiteratureDetail,
  candidateWork: LiteratureRecommendationWork,
  candidateDetail: LiteratureDetail,
) {
  let score = activeWork.knowledgeType === candidateWork.knowledgeType ? 8 : 0;

  if (hasSameNonEmptyText(activeDetail.author, candidateDetail.author)) {
    score += 80;
  }

  score += getGenreOverlapCount(activeDetail.genres, candidateDetail.genres) * 14;

  if (
    rangesOverlap(
      activeDetail.approxGradeMin,
      activeDetail.approxGradeMax,
      candidateDetail.approxGradeMin,
      candidateDetail.approxGradeMax,
    )
  ) {
    score += 10;
  }

  if (
    rangesOverlap(
      activeDetail.historicalTimeframeStartYear,
      activeDetail.historicalTimeframeEndYear,
      candidateDetail.historicalTimeframeStartYear,
      candidateDetail.historicalTimeframeEndYear,
    )
  ) {
    score += 6;
  }

  return score;
}

function hasSameNonEmptyText(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizeComparableText(left ?? "");
  return (
    normalizedLeft.length > 0 &&
    normalizedLeft === normalizeComparableText(right ?? "")
  );
}

function getGenreOverlapCount(
  left: string[] | undefined,
  right: string[] | undefined,
) {
  const rightGenres = new Set((right ?? []).map(normalizeComparableText));
  return (left ?? []).filter((genre) =>
    rightGenres.has(normalizeComparableText(genre)),
  ).length;
}

function rangesOverlap(
  leftMin: number | null | undefined,
  leftMax: number | null | undefined,
  rightMin: number | null | undefined,
  rightMax: number | null | undefined,
) {
  if (
    typeof leftMin !== "number" ||
    typeof leftMax !== "number" ||
    typeof rightMin !== "number" ||
    typeof rightMax !== "number"
  ) {
    return false;
  }

  return leftMin <= rightMax && rightMin <= leftMax;
}

function getRankedRecognitionScore(baseScore: number, index: number) {
  return baseScore + Math.max(0, MAX_RECOMMENDED_RECOGNITIONS_PER_SCOPE - index);
}

function getRankedPersonRelationScore(baseScore: number, index: number) {
  return (
    baseScore +
    Math.max(0, MAX_RECOMMENDED_AUTHORED_WORKS_PER_PERSON_TAG - index)
  );
}

async function summarizeCandidates(
  ctx: QueryCtx,
  candidates: Candidate[],
  access: SuggestionAccess,
  {
    activeTagIds,
    limit,
  }: {
    activeTagIds: Set<Id<"tags">>;
    limit: number;
  },
) {
  const summaries: Array<TagSuggestion & { score: number }> = [];

  for (const candidate of candidates) {
    if (activeTagIds.has(candidate.tag._id)) {
      continue;
    }

    const accessScore = await getTagAccessScore(ctx, candidate.tag, access);
    if (accessScore === null) {
      continue;
    }

    const correlationScore =
      activeTagIds.size === 0
        ? 0
        : await getContextCorrelationScore(ctx, candidate.tag._id, activeTagIds, access);
    const summary = await toTagSuggestion(ctx, candidate, access);
    if (!summary) {
      continue;
    }

    summaries.push({
      ...summary,
      score: candidate.score + accessScore + correlationScore,
    });
  }

  return summaries
    .sort(compareScoredSuggestions)
    .slice(0, limit)
    .map(({ score: _score, ...suggestion }) => suggestion);
}

async function withActiveBiblePassageRecommendationSuggestions(
  ctx: QueryCtx,
  activeTags: ActiveTagSnapshot[],
  suggestions: TagSuggestion[],
  { limit }: { limit: number },
) {
  const activeBiblePassageTargets: ResolvedBiblePassageSearchTarget[] = [];
  const activeBiblePassageKeys = new Set<string>();

  for (const activeTag of normalizeActiveTagSnapshots(activeTags)) {
    if (activeTag.knowledgeType !== "biblePassage") {
      continue;
    }

    const target = await resolveActiveBiblePassageTarget(ctx, activeTag);
    if (!target) {
      continue;
    }

    activeBiblePassageTargets.push(target);
    activeBiblePassageKeys.add(getBiblePassageSuggestionKey(target.canonicalKey));
  }

  if (activeBiblePassageTargets.length === 0) {
    return suggestions.slice(0, limit);
  }

  const scriptureSuggestions: TagSuggestion[] = [];
  const suggestedKeys = new Set(activeBiblePassageKeys);
  for (const activeTarget of activeBiblePassageTargets) {
    const relatedTargets = await getRelatedBiblePassageTargets(ctx, activeTarget);
    for (const relatedTarget of relatedTargets) {
      const key = getBiblePassageSuggestionKey(relatedTarget.canonicalKey);
      if (suggestedKeys.has(key)) {
        continue;
      }

      scriptureSuggestions.push(toBiblePassageSuggestionFromTarget(relatedTarget));
      suggestedKeys.add(key);
      if (scriptureSuggestions.length >= limit) {
        break;
      }
    }

    if (scriptureSuggestions.length >= limit) {
      break;
    }
  }

  return mergeRecommendedSuggestions(
    scriptureSuggestions,
    suggestions,
    activeBiblePassageKeys,
    limit,
  );
}

async function resolveActiveBiblePassageTarget(
  ctx: QueryCtx,
  activeTag: ActiveTagSnapshot,
) {
  return await resolveBiblePassageSearchTarget(
    ctx,
    activeTag.passageString || activeTag.canonicalKey || activeTag.id || activeTag.label,
  );
}

async function getRelatedBiblePassageTargets(
  ctx: QueryCtx,
  target: ResolvedBiblePassageSearchTarget,
) {
  const relatedTargets: ResolvedBiblePassageSearchTarget[] = [];

  for (const range of target.ranges.slice(0, MAX_SCRIPTURE_RECOMMENDATION_RANGES)) {
    const startVerse = await getBibleVerseByOrdinal(ctx, range.startOrdinal);
    const endVerse = await getBibleVerseByOrdinal(ctx, range.endOrdinal);
    if (!startVerse || !endVerse) {
      continue;
    }

    const nextVerse = await getBibleVerseByOrdinal(ctx, range.endOrdinal + 1);
    if (nextVerse && isSameBibleChapter(nextVerse, endVerse)) {
      await addBibleVerseTarget(ctx, relatedTargets, nextVerse);
    }

    const previousVerse = await getBibleVerseByOrdinal(ctx, range.startOrdinal - 1);
    if (previousVerse && isSameBibleChapter(previousVerse, startVerse)) {
      await addBibleVerseTarget(ctx, relatedTargets, previousVerse);
    }

    await addBibleChapterTarget(ctx, relatedTargets, startVerse);
    if (!isSameBibleChapter(startVerse, endVerse)) {
      await addBibleChapterTarget(ctx, relatedTargets, endVerse);
    }
  }

  return relatedTargets;
}

async function addBibleVerseTarget(
  ctx: QueryCtx,
  targets: ResolvedBiblePassageSearchTarget[],
  verse: Doc<"bibleVerses">,
) {
  const book = await getBibleBookByCode(ctx, verse.bookCode);
  if (!book) {
    return;
  }

  await addResolvedBiblePassageTarget(
    ctx,
    targets,
    `${book.name} ${verse.chapterNumber}:${verse.verseNumber}`,
  );
}

async function addBibleChapterTarget(
  ctx: QueryCtx,
  targets: ResolvedBiblePassageSearchTarget[],
  verse: Doc<"bibleVerses">,
) {
  const book = await getBibleBookByCode(ctx, verse.bookCode);
  if (!book) {
    return;
  }

  await addResolvedBiblePassageTarget(
    ctx,
    targets,
    `${book.name} ${verse.chapterNumber}`,
  );
}

async function addResolvedBiblePassageTarget(
  ctx: QueryCtx,
  targets: ResolvedBiblePassageSearchTarget[],
  reference: string,
) {
  const target = await resolveBiblePassageSearchTarget(ctx, reference);
  if (
    !target ||
    targets.some((existingTarget) => existingTarget.canonicalKey === target.canonicalKey)
  ) {
    return;
  }

  targets.push(target);
}

async function getBibleVerseByOrdinal(ctx: QueryCtx, ordinal: number) {
  if (ordinal < 1) {
    return null;
  }

  return await ctx.db
    .query("bibleVerses")
    .withIndex("by_ordinal", (q) => q.eq("ordinal", ordinal))
    .unique();
}

async function getBibleBookByCode(ctx: QueryCtx, code: string) {
  return await ctx.db
    .query("bibleBooks")
    .withIndex("by_code", (q) => q.eq("code", code))
    .unique();
}

function isSameBibleChapter(left: Doc<"bibleVerses">, right: Doc<"bibleVerses">) {
  return (
    left.bookCode === right.bookCode &&
    left.chapterNumber === right.chapterNumber
  );
}

function toBiblePassageSuggestionFromTarget(
  target: ResolvedBiblePassageSearchTarget,
): TagSuggestion {
  const tag = toBiblePassageActiveTagSnapshot(target);

  return {
    canonicalKey: target.canonicalKey,
    href: target.href,
    id: target.id,
    knowledgeType: "biblePassage",
    label: target.label,
    matchKind: "label",
    tag,
  };
}

function toBiblePassageActiveTagSnapshot(
  target: ResolvedBiblePassageSearchTarget,
): ActiveTagSnapshot {
  return {
    canonicalKey: target.canonicalKey,
    href: target.href,
    id: target.id,
    knowledgeType: "biblePassage",
    label: target.label,
    passageString: target.passageString,
  };
}

function mergeRecommendedSuggestions(
  preferredSuggestions: TagSuggestion[],
  suggestions: TagSuggestion[],
  activeKeys: Set<string>,
  limit: number,
) {
  const mergedSuggestions: TagSuggestion[] = [];
  const seenKeys = new Set(activeKeys);

  const addSuggestion = (suggestion: TagSuggestion) => {
    const key = getSuggestionKey(suggestion);
    if (seenKeys.has(key)) {
      return;
    }

    mergedSuggestions.push(suggestion);
    seenKeys.add(key);
  };

  for (const suggestion of preferredSuggestions) {
    addSuggestion(suggestion);
  }

  for (const suggestion of suggestions) {
    addSuggestion(suggestion);
  }

  return mergedSuggestions.slice(0, limit);
}

function getSuggestionKey(suggestion: TagSuggestion) {
  if (suggestion.knowledgeType === "biblePassage") {
    return getBiblePassageSuggestionKey(suggestion.canonicalKey);
  }

  return `${suggestion.knowledgeType}:${suggestion.id}`;
}

function getBiblePassageSuggestionKey(canonicalKey: string) {
  return `biblePassage:${canonicalKey}`;
}

async function withBiblePassageSuggestion(
  ctx: QueryCtx,
  searchText: string,
  suggestions: TagSuggestion[],
  {
    activeBiblePassageKeys,
    limit,
  }: {
    activeBiblePassageKeys: Set<string>;
    limit: number;
  },
) {
  const biblePassageSuggestion = await toBiblePassageSuggestion(ctx, searchText);
  if (
    !biblePassageSuggestion ||
    suggestions.some(
      (suggestion) =>
        suggestion.knowledgeType === "biblePassage" &&
        suggestion.canonicalKey === biblePassageSuggestion.canonicalKey,
    ) ||
    activeBiblePassageKeys.has(biblePassageSuggestion.id)
  ) {
    return suggestions.slice(0, limit);
  }

  return [biblePassageSuggestion, ...suggestions].slice(0, limit);
}

async function toBiblePassageSuggestion(
  ctx: QueryCtx,
  searchText: string,
): Promise<TagSuggestion | null> {
  const passage = await resolveBiblePassageSearchTarget(ctx, searchText);
  if (!passage) {
    return null;
  }

  return {
    canonicalKey: passage.canonicalKey,
    href: passage.href,
    id: passage.id,
    knowledgeType: "biblePassage",
    label: passage.label,
    matchKind: "label",
    tag: {
      canonicalKey: passage.canonicalKey,
      href: passage.href,
      id: passage.id,
      knowledgeType: "biblePassage",
      label: passage.label,
      passageString: passage.passageString,
    },
  };
}

function getActiveBiblePassageKeys(activeTags: ActiveTagSnapshot[]) {
  const keys = new Set<string>();
  for (const tag of activeTags) {
    if (tag.knowledgeType !== "biblePassage") {
      continue;
    }

    keys.add(tag.id);
    keys.add(tag.canonicalKey);
    if (tag.passageString !== undefined) {
      keys.add(tag.passageString);
    }
  }

  return keys;
}

function normalizeRouteTagKeys(tagKeys: string[]) {
  if (tagKeys.length > MAX_ROUTE_ACTIVE_TAGS) {
    throw new Error(
      `Route active Tag resolution supports at most ${MAX_ROUTE_ACTIVE_TAGS} active Tags.`,
    );
  }

  return tagKeys.map(normalizeLookupKey);
}

async function resolveRouteTag(
  ctx: QueryCtx,
  tagKey: string,
  access: SuggestionAccess,
) {
  const directTags = await ctx.db
    .query("tags")
    .withIndex("by_lookupKey", (q) => q.eq("lookupKey", tagKey))
    .take(MAX_ROUTE_TAG_MATCHES);
  const directTag = await selectBestAccessibleRouteTag(ctx, directTags, access);
  if (directTag) {
    return directTag;
  }

  const canonicalTags: Doc<"tags">[] = [];
  for (const knowledgeType of REFERENT_KNOWLEDGE_TYPES) {
    const referent = await ctx.db
      .query("referents")
      .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
        q.eq("knowledgeType", knowledgeType).eq("canonicalKey", tagKey),
      )
      .first();
    if (!referent) {
      continue;
    }

    const referentTags = await ctx.db
      .query("tags")
      .withIndex("by_referentId", (q) => q.eq("referentId", referent._id))
      .take(MAX_ROUTE_REFERENT_TAGS);
    canonicalTags.push(...referentTags);
  }

  return await selectBestAccessibleRouteTag(ctx, canonicalTags, access);
}

async function selectBestAccessibleRouteTag(
  ctx: QueryCtx,
  tags: Doc<"tags">[],
  access: SuggestionAccess,
) {
  let bestTag: Doc<"tags"> | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const tag of tags) {
    const accessScore = await getTagAccessScore(ctx, tag, access);
    if (accessScore === null) {
      continue;
    }

    const score = accessScore + getRouteTagTypePriority(tag);
    if (
      bestTag === null ||
      score > bestScore ||
      (score === bestScore && compareStrings(tag.label, bestTag.label) < 0)
    ) {
      bestTag = tag;
      bestScore = score;
    }
  }

  return bestTag;
}

function getRouteTagTypePriority(tag: Doc<"tags">) {
  return tag.knowledgeType === "words" ? 0 : 4;
}

async function toActiveTagSnapshot(
  ctx: QueryCtx,
  tag: Doc<"tags">,
  access: SuggestionAccess,
): Promise<ActiveTagSnapshot | null> {
  const suggestion = await toTagSuggestion(ctx, {
    matchKind: "label",
    score: 0,
    tag,
  }, access);

  return suggestion?.tag ?? null;
}

async function getTagAccessScore(
  ctx: QueryCtx,
  tag: Doc<"tags">,
  access: SuggestionAccess,
) {
  const representedEntryScore = await getRepresentedEntryAccessScore(ctx, tag, access);

  if (tag.createdByUserId === undefined) {
    return representedEntryScore === null
      ? null
      : Math.max(10, representedEntryScore);
  }

  if (tag.createdByUserId === access.userId) {
    return 12;
  }

  const recognitionScore = await getRecognitionScore(ctx, tag._id, access);
  if (recognitionScore > 0) {
    return recognitionScore;
  }

  return representedEntryScore !== null && representedEntryScore > 0
    ? representedEntryScore
    : null;
}

async function getRecognitionScore(
  ctx: QueryCtx,
  tagId: Id<"tags">,
  access: SuggestionAccess,
) {
  const recognitions = await ctx.db
    .query("tagRecognitions")
    .withIndex("by_tagId", (q) => q.eq("tagId", tagId))
    .take(MAX_RECOGNITIONS_PER_TAG);
  let score = 0;

  for (const recognition of recognitions) {
    if (recognition.recognizerKind === "user" && recognition.userId === access.userId) {
      score = Math.max(score, 30);
      continue;
    }

    if (
      recognition.recognizerKind === "organization" &&
      recognition.organizationReferentId !== undefined &&
      access.organizationReferentIds.has(recognition.organizationReferentId)
    ) {
      score = Math.max(score, 24);
    }
  }

  return score;
}

async function getRepresentedEntryAccessScore(
  ctx: QueryCtx,
  tag: Doc<"tags">,
  access: SuggestionAccess,
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

  return entries.some((entry) => isEntryAccessible(entry, access)) ? 4 : null;
}

async function getContextCorrelationScore(
  ctx: QueryCtx,
  tagId: Id<"tags">,
  activeTagIds: Set<Id<"tags">>,
  access: SuggestionAccess,
) {
  const rows = await ctx.db
    .query("entryTags")
    .withIndex("by_tagId_and_entryId", (q) => q.eq("tagId", tagId))
    .take(MAX_CORRELATION_ROWS_PER_TAG);

  for (const row of rows) {
    const entry = await ctx.db.get(row.entryId);
    if (!entry || !isEntryAccessible(entry, access)) {
      continue;
    }

    const entryTags = await ctx.db
      .query("entryTags")
      .withIndex("by_entryId_and_tagId", (q) => q.eq("entryId", row.entryId))
      .take(MAX_ENTRY_TAGS_FOR_CORRELATION);
    if (entryTags.some((entryTag) => activeTagIds.has(entryTag.tagId))) {
      return 100;
    }
  }

  return 0;
}

function isEntryAccessible(
  entry: Doc<"knowledgeEntries">,
  access: SuggestionAccess,
) {
  return (
    isVisibilityScopeAccessible(
      entry.visibilityKind,
      entry.visibilityTargetKey,
      access,
    ) ||
    isVisibilityScopeAccessible(
      entry.discoverabilityKind,
      entry.discoverabilityTargetKey,
      access,
    )
  );
}

function isVisibilityScopeAccessible(
  visibilityKind: Doc<"knowledgeEntries">["visibilityKind"],
  targetKey: string,
  access: SuggestionAccess,
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

async function toTagSuggestion(
  ctx: QueryCtx,
  candidate: Candidate,
  access: SuggestionAccess,
): Promise<TagSuggestion | null> {
  const referent = await ctx.db.get(candidate.tag.referentId);
  if (!referent) {
    return null;
  }

  const id = candidate.tag.lookupKey;
  const canonicalKey = referent.canonicalKey || candidate.tag.lookupKey;
  const thumbnailUrl = await getRepresentedReferentThumbnailUrl(
    ctx,
    candidate.tag.referentId,
    { isEntryVisible: (entry) => isEntryAccessible(entry, access) },
  );
  const tag = {
    canonicalKey,
    href: getTagHref(candidate.tag),
    id,
    knowledgeType: candidate.tag.knowledgeType,
    label: candidate.tag.label,
    ...(candidate.tag.knowledgeType === "biblePassage"
      ? { passageString: candidate.tag.lookupKey }
      : {}),
    ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
  };

  return {
    canonicalKey,
    href: tag.href,
    id,
    knowledgeType: candidate.tag.knowledgeType,
    label: candidate.tag.label,
    matchKind: candidate.matchKind,
    tag,
  };
}

async function resolveActiveTagIds(
  ctx: QueryCtx,
  activeTags: ActiveTagSnapshot[],
) {
  const normalizedTags = normalizeActiveTagSnapshots(activeTags);
  const tagIds = new Set<Id<"tags">>();

  for (const activeTag of normalizedTags) {
    const lookupKey = normalizeLookupKey(
      activeTag.canonicalKey || activeTag.id || activeTag.label,
    );
    const typedTag = await ctx.db
      .query("tags")
      .withIndex("by_knowledgeType_and_lookupKey", (q) =>
        q.eq("knowledgeType", activeTag.knowledgeType).eq("lookupKey", lookupKey),
      )
      .first();
    const tag =
      typedTag ??
      (await ctx.db
        .query("tags")
        .withIndex("by_lookupKey", (q) => q.eq("lookupKey", lookupKey))
        .first());
    if (tag) {
      tagIds.add(tag._id);
    }
  }

  return tagIds;
}

function normalizeActiveTagSnapshots(activeTags: ActiveTagSnapshot[]) {
  if (activeTags.length > MAX_ACTIVE_TAGS) {
    throw new Error(`Tag suggestions support at most ${MAX_ACTIVE_TAGS} active Tags.`);
  }

  const snapshots = new Map<string, ActiveTagSnapshot>();
  for (const activeTag of activeTags) {
    snapshots.set(
      `${activeTag.knowledgeType}:${normalizeLookupKey(
        activeTag.canonicalKey || activeTag.id || activeTag.label,
      )}`,
      activeTag,
    );
  }

  return Array.from(snapshots.values());
}

function toSuggestionAccess(access: AllowedAccess): SuggestionAccess {
  return {
    organizationReferentIds: new Set(
      access.organizations.map(
        (organization) => organization.organizationReferentId,
      ),
    ),
    userId: access.userId,
  };
}

function getTagHref(tag: Doc<"tags">) {
  if (tag.knowledgeType === "biblePassage") {
    return `/scripture/${encodeURIComponent(tag.lookupKey)}`;
  }

  return `/goto/${encodeURIComponent(tag.lookupKey)}`;
}

function normalizeSearchText(value: string) {
  return value.trim().slice(0, MAX_SEARCH_TEXT_LENGTH);
}

function normalizeLimit(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_SUGGESTION_LIMIT;
  }

  return Math.max(0, Math.min(Math.floor(value), MAX_SUGGESTION_LIMIT));
}

function getCandidateLimit(limit: number) {
  return Math.min(
    MAX_SEARCH_CANDIDATES,
    Math.max(MAX_SUGGESTION_LIMIT, limit * 4),
  );
}

function getTextScore(label: string, searchText: string) {
  const normalizedLabel = normalizeComparableText(label);
  const normalizedSearch = normalizeComparableText(searchText);
  const compactLabel = compactComparableText(normalizedLabel);
  const compactSearch = compactComparableText(normalizedSearch);

  if (normalizedLabel === normalizedSearch) {
    return 60;
  }

  if (normalizedLabel.startsWith(normalizedSearch)) {
    return 48;
  }

  if (normalizedLabel.includes(normalizedSearch)) {
    return 36;
  }

  if (compactLabel.includes(compactSearch)) {
    return 24;
  }

  return 12;
}

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactComparableText(value: string) {
  return value.replace(/\s+/g, "");
}

function normalizeLookupKey(value: string) {
  const lookupKey = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return lookupKey || "unknown";
}

function compareScoredSuggestions(
  first: TagSuggestion & { score: number },
  second: TagSuggestion & { score: number },
) {
  return (
    second.score - first.score ||
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
