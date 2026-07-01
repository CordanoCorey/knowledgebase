import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireAppAccess, type AppAccessState } from "./lib/appAccess";

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
const RELATED_RECOMMENDATION_SCORE = 120;
const USER_RECOGNITION_RECOMMENDATION_SCORE = 80;
const ORGANIZATION_RECOGNITION_RECOMMENDATION_SCORE = 64;
const RECENT_ACCESSIBLE_RECOMMENDATION_SCORE = 18;

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

const activeTagSnapshot = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  passageString: v.optional(v.string()),
});

const suggestionTag = activeTagSnapshot;

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
    return await summarizeCandidates(ctx, candidates, access, {
      activeTagIds: new Set(),
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
    return await summarizeCandidates(ctx, candidates, access, {
      activeTagIds,
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

    return await summarizeCandidates(ctx, candidates, access, {
      activeTagIds,
      limit,
    });
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

function getRankedRecognitionScore(baseScore: number, index: number) {
  return baseScore + Math.max(0, MAX_RECOMMENDED_RECOGNITIONS_PER_SCOPE - index);
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
    const summary = await toTagSuggestion(ctx, candidate);
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
): Promise<TagSuggestion | null> {
  const referent = await ctx.db.get(candidate.tag.referentId);
  if (!referent) {
    return null;
  }

  const id = candidate.tag.lookupKey;
  const canonicalKey = referent.canonicalKey || candidate.tag.lookupKey;
  const tag = {
    canonicalKey,
    href: getTagHref(candidate.tag),
    id,
    knowledgeType: candidate.tag.knowledgeType,
    label: candidate.tag.label,
    ...(candidate.tag.knowledgeType === "biblePassage"
      ? { passageString: candidate.tag.lookupKey }
      : {}),
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
    const tag = await ctx.db
      .query("tags")
      .withIndex("by_knowledgeType_and_lookupKey", (q) =>
        q.eq("knowledgeType", activeTag.knowledgeType).eq("lookupKey", lookupKey),
      )
      .first();
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
