import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAppAccess, requireSystemAdmin } from "./lib/appAccess";
import {
  correctPostContextExpertiseEvidenceAttribution,
  correctQuoteContextExpertiseEvidenceAttribution,
  getAudienceScopeFromVisibility,
  getEntryContextTagIds,
  getEvidenceRowSubjectSelector,
  isEffectiveContextExpertiseEvidence,
  recordContextExpertiseEvidence,
  reconcileContextExpertiseEvidenceVisibility,
  rebuildContextExpertiseAggregateForScope,
  type ContextExpertiseAudienceScope,
  type ContextExpertiseSubjectSelector,
} from "./lib/contextExpertiseEvidence";
import {
  applyContextExpertiseContextMatch,
  getContextExpertiseCandidateContexts,
  getContextExpertiseContextKey,
  getContextExpertiseContextMatchSortRank,
  normalizeContextExpertiseTagIds,
  type ContextExpertiseContextMatchKind,
} from "./lib/contextExpertiseScoring";

const MAX_CONTEXT_TAGS = 20;
const DEFAULT_AGGREGATE_LIMIT = 10;
const MAX_AGGREGATE_LIMIT = 50;
const MIN_AGGREGATE_CANDIDATE_LIMIT = 25;
const DEFAULT_MIGRATION_AGGREGATE_SAMPLE_LIMIT = 50;
const MAX_MIGRATION_AGGREGATE_SAMPLE_LIMIT = 200;
const DEFAULT_QUOTE_ATTRIBUTION_PERSON_SEARCH_LIMIT = 8;
const MAX_QUOTE_ATTRIBUTION_PERSON_SEARCH_LIMIT = 12;
const MIN_QUOTE_ATTRIBUTION_PERSON_SEARCH_QUERY_LENGTH = 2;
const DEFAULT_PROFILE_CONTEXT_EXPERTISE_LIMIT = 5;
const MAX_PROFILE_CONTEXT_EXPERTISE_LIMIT = 12;
const PROFILE_CONTEXT_EXPERTISE_CANDIDATE_LIMIT = 50;
const DEFAULT_PERSON_GLOBAL_EXPERT_VISIBILITY_HISTORY_LIMIT = 10;
const MAX_PERSON_GLOBAL_EXPERT_VISIBILITY_HISTORY_LIMIT = 25;
const MAX_QUOTE_ATTRIBUTION_BACKFILL_EVIDENCE_ROWS = 200;

const visibilityKind = v.union(
  v.literal("private"),
  v.literal("organization"),
  v.literal("group"),
  v.literal("public"),
);
const contextExpertSubjectKind = v.union(
  v.literal("user"),
  v.literal("person"),
);
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

const contextExpertiseAggregateSummary = v.object({
  aggregateId: v.id("contextExpertiseAggregates"),
  subjectKind: v.optional(contextExpertSubjectKind),
  subjectUserId: v.optional(v.id("users")),
  subjectPersonReferentId: v.optional(v.id("referents")),
  contextKey: v.string(),
  contextTagIds: v.array(v.id("tags")),
  contextExpertiseScore: v.number(),
  contextExpertiseMaturity: v.number(),
  contextMatchKind: v.optional(v.literal("broaderContext")),
  evidenceCount: v.number(),
  postCount: v.number(),
  feedbackCount: v.number(),
  latestEvidenceAt: v.number(),
  topSupportingEntryIds: v.array(v.id("knowledgeEntries")),
  visibilityKind,
  visibilityTargetKey: v.string(),
  audienceScopeKind: v.optional(visibilityKind),
  audienceScopeTargetKey: v.optional(v.string()),
});

const profileContextExpertiseTagSnapshot = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  passageString: v.optional(v.string()),
});

const currentUserProfileContextExpertiseRow = v.object({
  aggregateId: v.id("contextExpertiseAggregates"),
  contextKey: v.string(),
  contextTags: v.array(profileContextExpertiseTagSnapshot),
  contextExpertiseMaturity: v.number(),
  contextExpertiseScore: v.number(),
  evidenceCount: v.number(),
  feedbackCount: v.number(),
  latestEvidenceAt: v.number(),
  postCount: v.number(),
  visibilityKind,
  visibilityTargetKey: v.string(),
});

const currentUserProfileContextExpertise = v.object({
  profileUserId: v.id("users"),
  rows: v.array(currentUserProfileContextExpertiseRow),
});

const scopedAggregateMigrationGroup = v.object({
  aggregateId: v.optional(v.id("contextExpertiseAggregates")),
  audienceScopeKind: visibilityKind,
  audienceScopeTargetKey: v.string(),
  contextKey: v.string(),
  evidenceCount: v.optional(v.number()),
  skippedReason: v.optional(
    v.union(
      v.literal("noEffectiveEvidence"),
      v.literal("noEvidence"),
      v.literal("noValidEntries"),
    ),
  ),
  subjectKind: contextExpertSubjectKind,
  subjectUserId: v.optional(v.id("users")),
  subjectPersonReferentId: v.optional(v.id("referents")),
});

const scopedAggregateMigrationBatchResult = v.object({
  continueCursor: v.string(),
  dryRun: v.boolean(),
  groupCount: v.number(),
  groups: v.array(scopedAggregateMigrationGroup),
  isDone: v.boolean(),
  processedEvidenceCount: v.number(),
  rebuiltGroupCount: v.number(),
  skippedGroupCount: v.number(),
});

const scopedAggregateMigrationStatus = v.object({
  aggregateSampleLimit: v.number(),
  continueCursor: v.string(),
  evidenceGroupCount: v.number(),
  isDone: v.boolean(),
  legacyAggregateSampleCount: v.number(),
  mayHaveMoreEvidence: v.boolean(),
  missingScopedAggregateGroupCount: v.number(),
  missingScopedAggregateGroups: v.array(scopedAggregateMigrationGroup),
  sampledAggregateCount: v.number(),
  sampledEvidenceCount: v.number(),
  scopedAggregateSampleCount: v.number(),
});

const legacyAggregateCleanupItem = v.object({
  aggregateId: v.id("contextExpertiseAggregates"),
  contextKey: v.string(),
  hasAudienceScopeKind: v.boolean(),
  hasAudienceScopeTargetKey: v.boolean(),
  subjectKind: v.optional(contextExpertSubjectKind),
  subjectUserId: v.optional(v.id("users")),
  subjectPersonReferentId: v.optional(v.id("referents")),
  visibilityKind,
  visibilityTargetKey: v.string(),
});

const legacyAggregateCleanupStatus = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  legacyAggregateCount: v.number(),
  legacyAggregates: v.array(legacyAggregateCleanupItem),
  mayHaveMoreAggregates: v.boolean(),
  processedAggregateCount: v.number(),
});

const legacyAggregateCleanupBatchResult = v.object({
  continueCursor: v.string(),
  deletedAggregateCount: v.number(),
  dryRun: v.boolean(),
  isDone: v.boolean(),
  legacyAggregateCount: v.number(),
  legacyAggregates: v.array(legacyAggregateCleanupItem),
  mayHaveMoreAggregates: v.boolean(),
  processedAggregateCount: v.number(),
  wouldDeleteAggregateCount: v.number(),
});

const quoteAttributionBackfillSkippedReason = v.union(
  v.literal("noQuotedPerson"),
  v.literal("missingEntry"),
  v.literal("invalidQuotedPerson"),
  v.literal("notQuote"),
  v.literal("noContextTags"),
);

const quoteAttributionBackfillSkippedItem = v.object({
  entryId: v.optional(v.id("knowledgeEntries")),
  quoteEntryId: v.id("quoteEntries"),
  skippedReason: quoteAttributionBackfillSkippedReason,
  subjectPersonReferentId: v.optional(v.id("referents")),
});

const quoteAttributionBackfillEvidenceItem = v.object({
  action: v.union(
    v.literal("existing"),
    v.literal("missing"),
    v.literal("wouldCreate"),
    v.literal("created"),
  ),
  contextKey: v.string(),
  entryId: v.id("knowledgeEntries"),
  evidenceId: v.optional(v.id("contextExpertiseEvidence")),
  quoteEntryId: v.id("quoteEntries"),
  subjectPersonReferentId: v.id("referents"),
});

const quoteAttributionBackfillStatus = v.object({
  attributedQuoteRowCount: v.number(),
  continueCursor: v.string(),
  eligibleQuoteRowCount: v.number(),
  existingEvidenceCount: v.number(),
  isDone: v.boolean(),
  mayHaveMoreQuoteRows: v.boolean(),
  missingEvidenceCount: v.number(),
  missingEvidenceItems: v.array(quoteAttributionBackfillEvidenceItem),
  processedQuoteRowCount: v.number(),
  skippedQuoteRowCount: v.number(),
  skippedQuoteRowItems: v.array(quoteAttributionBackfillSkippedItem),
});

const quoteAttributionBackfillBatchResult = v.object({
  attributedQuoteRowCount: v.number(),
  continueCursor: v.string(),
  createdEvidenceCount: v.number(),
  dryRun: v.boolean(),
  eligibleQuoteRowCount: v.number(),
  evidenceItems: v.array(quoteAttributionBackfillEvidenceItem),
  existingEvidenceCount: v.number(),
  isDone: v.boolean(),
  mayHaveMoreQuoteRows: v.boolean(),
  missingEvidenceCount: v.number(),
  processedQuoteRowCount: v.number(),
  skippedQuoteRowCount: v.number(),
  skippedQuoteRowItems: v.array(quoteAttributionBackfillSkippedItem),
  wouldCreateEvidenceCount: v.number(),
});

const postAttributionCorrectionResult = v.object({
  affectedAggregateGroupCount: v.number(),
  correctedEvidenceCount: v.number(),
  correctedSubjectUserId: v.id("users"),
  entryId: v.id("knowledgeEntries"),
  previousCreatedByUserId: v.optional(v.id("users")),
  skippedCorrectedEvidenceCount: v.number(),
});

const quoteAttributionCorrectionResult = v.object({
  affectedAggregateGroupCount: v.number(),
  correctedEvidenceCount: v.number(),
  createdEvidenceCount: v.number(),
  deactivatedEvidenceCount: v.number(),
  entryId: v.id("knowledgeEntries"),
  nextQuotedPersonReferentId: v.optional(v.id("referents")),
  previousQuotedPersonReferentId: v.optional(v.id("referents")),
  quoteEntryId: v.id("quoteEntries"),
  skippedCorrectedEvidenceCount: v.number(),
});

const quoteAttributionPersonSearchResult = v.object({
  label: v.string(),
  referentId: v.id("referents"),
  tagId: v.id("tags"),
});

const personGlobalExpertVisibilityModerationStatus = v.union(
  v.literal("visibleByDefault"),
  v.literal("suppressed"),
);
const personGlobalExpertVisibilityModerationAction = v.union(
  v.literal("suppressed"),
  v.literal("restored"),
  v.literal("suppressionNoteUpdated"),
);

const personGlobalExpertVisibilityModeration = v.object({
  personLabel: v.string(),
  personReferentId: v.id("referents"),
  status: personGlobalExpertVisibilityModerationStatus,
  moderationNote: v.optional(v.string()),
  updatedAt: v.optional(v.number()),
  updatedByUserId: v.optional(v.id("users")),
});

const personGlobalExpertVisibilityModerationEvent = v.object({
  action: personGlobalExpertVisibilityModerationAction,
  createdAt: v.number(),
  eventId: v.id("personContextExpertiseVisibilityModerationEvents"),
  moderationNote: v.optional(v.string()),
  nextStatus: personGlobalExpertVisibilityModerationStatus,
  personReferentId: v.id("referents"),
  previousModerationNote: v.optional(v.string()),
  previousStatus: personGlobalExpertVisibilityModerationStatus,
  updatedByUserId: v.id("users"),
});

const entryVisibilityCorrectionResult = v.object({
  affectedAggregateGroupCount: v.number(),
  correctedEvidenceCount: v.number(),
  entryId: v.id("knowledgeEntries"),
  nextVisibilityKind: visibilityKind,
  nextVisibilityTargetKey: v.string(),
  nonEffectiveEvidenceCount: v.number(),
  previousVisibilityKind: visibilityKind,
  previousVisibilityTargetKey: v.string(),
});

export const listForActiveTags = query({
  args: {
    activeTagIds: v.array(v.id("tags")),
    limit: v.optional(v.number()),
  },
  returns: v.array(contextExpertiseAggregateSummary),
  handler: async (ctx, args) => {
    await requireAppAccess(ctx);
    const contextTagIds = normalizeContextTagIds(args.activeTagIds);
    const limit = normalizeLimit(args.limit);
    if (limit < 1) {
      return [];
    }

    const aggregateCandidates: ContextExpertiseAggregateCandidate[] = [];
    const candidateLimit = getAggregateCandidateLimit(limit);
    for (const candidateContext of getContextExpertiseCandidateContexts(
      contextTagIds,
    )) {
      const aggregates = await ctx.db
        .query("contextExpertiseAggregates")
        .withIndex("by_contextKey_and_contextExpertiseScore", (q) =>
          q.eq("contextKey", candidateContext.contextKey),
        )
        .order("desc")
        .take(candidateLimit);
      aggregateCandidates.push(
        ...aggregates.map((aggregate) =>
          applyContextMatchToAggregate(
            aggregate,
            candidateContext.contextMatchKind,
          ),
        ),
      );
    }

    return selectBestAggregateCandidatesBySubject(aggregateCandidates)
      .sort(compareAggregateCandidatesForRanking)
      .slice(0, limit)
      .map((aggregate) => ({
        aggregateId: aggregate._id,
        ...(getAggregateSubjectKind(aggregate) === "person"
          ? { subjectKind: "person" as const }
          : {}),
        ...(aggregate.subjectUserId === undefined
          ? {}
          : { subjectUserId: aggregate.subjectUserId }),
        ...(aggregate.subjectPersonReferentId === undefined
          ? {}
          : { subjectPersonReferentId: aggregate.subjectPersonReferentId }),
        contextKey: aggregate.contextKey,
        contextTagIds: aggregate.contextTagIds,
        contextExpertiseScore: aggregate.contextExpertiseScore,
        contextExpertiseMaturity: aggregate.contextExpertiseMaturity,
        ...(aggregate.contextMatchKind === undefined
          ? {}
          : { contextMatchKind: aggregate.contextMatchKind }),
        evidenceCount: aggregate.evidenceCount,
        postCount: aggregate.postCount,
        feedbackCount: aggregate.feedbackCount,
        latestEvidenceAt: aggregate.latestEvidenceAt,
        topSupportingEntryIds: aggregate.topSupportingEntryIds,
        visibilityKind: aggregate.visibilityKind,
        visibilityTargetKey: aggregate.visibilityTargetKey,
        ...(aggregate.audienceScopeKind === undefined
          ? {}
          : { audienceScopeKind: aggregate.audienceScopeKind }),
        ...(aggregate.audienceScopeTargetKey === undefined
          ? {}
          : { audienceScopeTargetKey: aggregate.audienceScopeTargetKey }),
      }));
  },
});

export const listCurrentUserProfileContextExpertise = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: currentUserProfileContextExpertise,
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const limit = normalizeProfileContextExpertiseLimit(args.limit);
    if (limit < 1) {
      return {
        profileUserId: access.userId,
        rows: [],
      };
    }

    const organizationReferentIds = new Set(
      access.organizations.map(
        (organization) => organization.organizationReferentId,
      ),
    );
    const aggregateCandidates = await ctx.db
      .query("contextExpertiseAggregates")
      .withIndex("by_subjectUserId_and_contextExpertiseScore", (q) =>
        q.eq("subjectUserId", access.userId),
      )
      .order("desc")
      .take(PROFILE_CONTEXT_EXPERTISE_CANDIDATE_LIMIT);
    const selectedContextKeys = new Set<string>();
    const rows: CurrentUserProfileContextExpertiseRow[] = [];

    for (const aggregate of aggregateCandidates.sort(
      compareProfileContextExpertiseAggregates,
    )) {
      if (
        rows.length >= limit ||
        selectedContextKeys.has(aggregate.contextKey) ||
        !isProfileContextExpertiseAggregateVisible(
          aggregate,
          organizationReferentIds,
        )
      ) {
        continue;
      }

      const contextTags = await getProfileContextTagSnapshots(
        ctx,
        aggregate.contextTagIds,
      );
      if (contextTags === null) {
        continue;
      }

      selectedContextKeys.add(aggregate.contextKey);
      rows.push({
        aggregateId: aggregate._id,
        contextKey: aggregate.contextKey,
        contextTags,
        contextExpertiseMaturity: aggregate.contextExpertiseMaturity,
        contextExpertiseScore: aggregate.contextExpertiseScore,
        evidenceCount: aggregate.evidenceCount,
        feedbackCount: aggregate.feedbackCount,
        latestEvidenceAt: aggregate.latestEvidenceAt,
        postCount: aggregate.postCount,
        visibilityKind: aggregate.visibilityKind,
        visibilityTargetKey: aggregate.visibilityTargetKey,
      });
    }

    return {
      profileUserId: access.userId,
      rows,
    };
  },
});

export const correctPostAttribution = mutation({
  args: {
    correctedSubjectUserId: v.id("users"),
    entryId: v.id("knowledgeEntries"),
  },
  returns: postAttributionCorrectionResult,
  handler: async (ctx, args) => {
    const access = await requireSystemAdmin(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Knowledge Entry not found.");
    }

    const correctedSubjectUser = await ctx.db.get(args.correctedSubjectUserId);
    if (!correctedSubjectUser) {
      throw new Error("Corrected User not found.");
    }

    const now = Date.now();
    await ctx.db.patch(args.entryId, {
      createdByUserId: args.correctedSubjectUserId,
      updatedAt: now,
    });

    const correctionResult =
      await correctPostContextExpertiseEvidenceAttribution(ctx, {
        correctedByUserId: access.userId,
        entryId: args.entryId,
        nextSubjectUserId: args.correctedSubjectUserId,
        now,
      });

    return {
      ...correctionResult,
      correctedSubjectUserId: args.correctedSubjectUserId,
      entryId: args.entryId,
      ...(entry.createdByUserId === undefined
        ? {}
        : { previousCreatedByUserId: entry.createdByUserId }),
    };
  },
});

export const searchQuoteAttributionPeople = query({
  args: {
    limit: v.optional(v.number()),
    searchQuery: v.string(),
  },
  returns: v.array(quoteAttributionPersonSearchResult),
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    return await searchPersonTagOptions(ctx, {
      limit: normalizeQuoteAttributionPersonSearchLimit(args.limit),
      searchQuery: args.searchQuery,
    });
  },
});

export const searchPublicFigureExpertPeople = query({
  args: {
    limit: v.optional(v.number()),
    searchQuery: v.string(),
  },
  returns: v.array(quoteAttributionPersonSearchResult),
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    return await searchPersonTagOptions(ctx, {
      limit: normalizeQuoteAttributionPersonSearchLimit(args.limit),
      searchQuery: args.searchQuery,
    });
  },
});

export const getPersonGlobalExpertVisibilityModeration = query({
  args: {
    personReferentId: v.id("referents"),
  },
  returns: personGlobalExpertVisibilityModeration,
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    return await getPersonGlobalExpertVisibilityModerationSummary(
      ctx,
      args.personReferentId,
    );
  },
});

export const listPersonGlobalExpertVisibilityModerationHistory = query({
  args: {
    limit: v.optional(v.number()),
    personReferentId: v.id("referents"),
  },
  returns: v.array(personGlobalExpertVisibilityModerationEvent),
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    await getPersonReferentOrThrow(ctx, args.personReferentId);
    const limit = normalizePersonGlobalExpertVisibilityHistoryLimit(args.limit);

    if (limit < 1) {
      return [];
    }

    const events = await ctx.db
      .query("personContextExpertiseVisibilityModerationEvents")
      .withIndex("by_personReferentId_and_createdAt", (q) =>
        q.eq("personReferentId", args.personReferentId),
      )
      .order("desc")
      .take(limit);

    return events.map(toPersonGlobalExpertVisibilityModerationEvent);
  },
});

export const updatePersonGlobalExpertVisibilityModeration = mutation({
  args: {
    moderationNote: v.optional(v.string()),
    personReferentId: v.id("referents"),
    suppressed: v.boolean(),
  },
  returns: personGlobalExpertVisibilityModeration,
  handler: async (ctx, args) => {
    const access = await requireSystemAdmin(ctx);
    const person = await getPersonReferentOrThrow(ctx, args.personReferentId);
    const existing = await getPersonGlobalExpertVisibilitySetting(
      ctx,
      args.personReferentId,
    );
    const now = Date.now();
    const previousStatus =
      getPersonGlobalExpertVisibilityStatusFromSetting(existing);
    const previousModerationNote = existing?.moderationNote;

    if (args.suppressed) {
      const moderationNote = normalizeModerationNote(args.moderationNote);

      if (existing) {
        if (
          moderationNote !== undefined &&
          moderationNote !== previousModerationNote
        ) {
          await ctx.db.patch(existing._id, {
            globalExpertVisibilityStatus: "suppressed" as const,
            moderationNote,
            updatedAt: now,
            updatedByUserId: access.userId,
          });
          await ctx.db.insert("personContextExpertiseVisibilityModerationEvents", {
            action: "suppressionNoteUpdated",
            createdAt: now,
            moderationNote,
            nextStatus: "suppressed",
            personReferentId: args.personReferentId,
            ...(previousModerationNote === undefined
              ? {}
              : { previousModerationNote }),
            previousStatus,
            updatedByUserId: access.userId,
          });
        }
      } else {
        await ctx.db.insert("personContextExpertiseVisibilitySettings", {
          createdAt: now,
          globalExpertVisibilityStatus: "suppressed",
          ...(moderationNote === undefined ? {} : { moderationNote }),
          personReferentId: args.personReferentId,
          updatedAt: now,
          updatedByUserId: access.userId,
        });
        await ctx.db.insert("personContextExpertiseVisibilityModerationEvents", {
          action: "suppressed",
          createdAt: now,
          ...(moderationNote === undefined ? {} : { moderationNote }),
          nextStatus: "suppressed",
          personReferentId: args.personReferentId,
          previousStatus,
          updatedByUserId: access.userId,
        });
      }
    } else if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.insert("personContextExpertiseVisibilityModerationEvents", {
        action: "restored",
        createdAt: now,
        nextStatus: "visibleByDefault",
        personReferentId: args.personReferentId,
        ...(previousModerationNote === undefined
          ? {}
          : { previousModerationNote }),
        previousStatus,
        updatedByUserId: access.userId,
      });
    }

    const nextSetting = args.suppressed
      ? await getPersonGlobalExpertVisibilitySetting(ctx, args.personReferentId)
      : null;

    return toPersonGlobalExpertVisibilityModeration(person, nextSetting);
  },
});

export const correctQuoteAttribution = mutation({
  args: {
    entryId: v.id("knowledgeEntries"),
    nextQuotedPersonReferentId: v.union(v.id("referents"), v.null()),
  },
  returns: quoteAttributionCorrectionResult,
  handler: async (ctx, args) => {
    const access = await requireSystemAdmin(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Knowledge Entry not found.");
    }
    if (entry.knowledgeType !== "quote") {
      throw new Error("Knowledge Entry is not a Quote.");
    }

    const quoteEntry = await ctx.db
      .query("quoteEntries")
      .withIndex("by_entryId", (q) => q.eq("entryId", args.entryId))
      .first();
    if (!quoteEntry) {
      throw new Error("Quote detail row not found.");
    }

    const nextQuotedPersonReferentId =
      args.nextQuotedPersonReferentId === null
        ? undefined
        : args.nextQuotedPersonReferentId;
    if (nextQuotedPersonReferentId !== undefined) {
      const nextQuotedPerson = await ctx.db.get(nextQuotedPersonReferentId);
      if (!nextQuotedPerson || nextQuotedPerson.knowledgeType !== "person") {
        throw new Error("Corrected quoted Person not found.");
      }
    }

    const now = Date.now();
    await ctx.db.patch(quoteEntry._id, {
      quotedPersonReferentId: nextQuotedPersonReferentId,
    });

    const correctionResult =
      await correctQuoteContextExpertiseEvidenceAttribution(ctx, {
        correctedByUserId: access.userId,
        entryId: args.entryId,
        nextSubjectPersonReferentId: nextQuotedPersonReferentId,
        now,
      });

    return {
      ...correctionResult,
      entryId: args.entryId,
      ...(nextQuotedPersonReferentId === undefined
        ? {}
        : { nextQuotedPersonReferentId }),
      ...(quoteEntry.quotedPersonReferentId === undefined
        ? {}
        : { previousQuotedPersonReferentId: quoteEntry.quotedPersonReferentId }),
      quoteEntryId: quoteEntry._id,
    };
  },
});

export const correctEntryVisibilityScope = mutation({
  args: {
    entryId: v.id("knowledgeEntries"),
    visibilityKind,
    visibilityTargetKey: v.string(),
  },
  returns: entryVisibilityCorrectionResult,
  handler: async (ctx, args) => {
    const access = await requireSystemAdmin(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Knowledge Entry not found.");
    }

    const nextVisibilityTargetKey = await normalizeVisibilityTargetKey(ctx, {
      visibilityKind: args.visibilityKind,
      visibilityTargetKey: args.visibilityTargetKey,
    });
    const now = Date.now();
    await ctx.db.patch(args.entryId, {
      visibilityKind: args.visibilityKind,
      visibilityTargetKey: nextVisibilityTargetKey,
      updatedAt: now,
    });

    const correctionResult =
      await reconcileContextExpertiseEvidenceVisibility(ctx, {
        correctedByUserId: access.userId,
        entryId: args.entryId,
        nextVisibilityKind: args.visibilityKind,
        nextVisibilityTargetKey,
        now,
      });

    return {
      ...correctionResult,
      entryId: args.entryId,
      nextVisibilityKind: args.visibilityKind,
      nextVisibilityTargetKey,
      previousVisibilityKind: entry.visibilityKind,
      previousVisibilityTargetKey: entry.visibilityTargetKey,
    };
  },
});

export const rebuildScopedAggregateBatch = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: scopedAggregateMigrationBatchResult,
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const dryRun = args.dryRun ?? false;
    const page = await ctx.db
      .query("contextExpertiseEvidence")
      .order("asc")
      .paginate(args.paginationOpts);
    const groups = buildEvidenceGroups(page.page);
    const results = [];
    let rebuiltGroupCount = 0;
    let skippedGroupCount = 0;
    const now = Date.now();

    for (const group of groups) {
      if (dryRun) {
        results.push({
          audienceScopeKind: group.scope.audienceScopeKind,
          audienceScopeTargetKey: group.scope.audienceScopeTargetKey,
          contextKey: group.contextKey,
          ...getMigrationGroupSubjectFields(group.subject),
        });
        continue;
      }

      const result = await rebuildContextExpertiseAggregateForScope(ctx, {
        contextKey: group.contextKey,
        contextTagIds: group.contextTagIds,
        now,
        scope: group.scope,
        subject: group.subject,
      });
      if (result.aggregateId === undefined) {
        skippedGroupCount += 1;
      } else {
        rebuiltGroupCount += 1;
      }
      results.push({
        ...(result.aggregateId === undefined
          ? {}
          : { aggregateId: result.aggregateId }),
        audienceScopeKind: result.scope.audienceScopeKind,
        audienceScopeTargetKey: result.scope.audienceScopeTargetKey,
        contextKey: result.contextKey,
        evidenceCount: result.evidenceCount,
        ...(result.skippedReason === undefined
          ? {}
          : { skippedReason: result.skippedReason }),
        ...getMigrationGroupSubjectFields(group.subject),
      });
    }

    return {
      continueCursor: page.continueCursor,
      dryRun,
      groupCount: groups.length,
      groups: results,
      isDone: page.isDone,
      processedEvidenceCount: page.page.length,
      rebuiltGroupCount,
      skippedGroupCount,
    };
  },
});

export const getScopedAggregateMigrationStatus = query({
  args: {
    aggregateSampleLimit: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  returns: scopedAggregateMigrationStatus,
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const aggregateSampleLimit = normalizeAggregateSampleLimit(
      args.aggregateSampleLimit,
    );
    const evidencePage = await ctx.db
      .query("contextExpertiseEvidence")
      .order("asc")
      .paginate(args.paginationOpts);
    const groups = buildEvidenceGroups(evidencePage.page);
    const missingGroups = [];

    for (const group of groups) {
      const aggregate = await getScopedAggregateForGroup(ctx, group);
      if (aggregate) {
        continue;
      }

      missingGroups.push({
        audienceScopeKind: group.scope.audienceScopeKind,
        audienceScopeTargetKey: group.scope.audienceScopeTargetKey,
        contextKey: group.contextKey,
        ...getMigrationGroupSubjectFields(group.subject),
      });
    }

    const aggregateSample = await ctx.db
      .query("contextExpertiseAggregates")
      .take(aggregateSampleLimit);
    const scopedAggregateSampleCount = aggregateSample.filter(
      isAudienceScopedAggregate,
    ).length;

    return {
      aggregateSampleLimit,
      continueCursor: evidencePage.continueCursor,
      evidenceGroupCount: groups.length,
      isDone: evidencePage.isDone,
      legacyAggregateSampleCount:
        aggregateSample.length - scopedAggregateSampleCount,
      mayHaveMoreEvidence: !evidencePage.isDone,
      missingScopedAggregateGroupCount: missingGroups.length,
      missingScopedAggregateGroups: missingGroups,
      sampledAggregateCount: aggregateSample.length,
      sampledEvidenceCount: evidencePage.page.length,
      scopedAggregateSampleCount,
    };
  },
});

export const getLegacyAggregateCleanupStatus = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: legacyAggregateCleanupStatus,
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const page = await ctx.db
      .query("contextExpertiseAggregates")
      .order("asc")
      .paginate(args.paginationOpts);
    const legacyAggregates = page.page
      .filter(isLegacyContextExpertiseAggregate)
      .map(toLegacyAggregateCleanupItem);

    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      legacyAggregateCount: legacyAggregates.length,
      legacyAggregates,
      mayHaveMoreAggregates: !page.isDone,
      processedAggregateCount: page.page.length,
    };
  },
});

export const cleanupLegacyAggregateBatch = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    execute: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: legacyAggregateCleanupBatchResult,
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const dryRun = args.dryRun ?? false;
    if (!dryRun && args.execute !== true) {
      throw new Error(
        "Refusing to delete legacy Context Expertise aggregates without execute: true.",
      );
    }

    const page = await ctx.db
      .query("contextExpertiseAggregates")
      .order("asc")
      .paginate(args.paginationOpts);
    const legacyRows = page.page.filter(isLegacyContextExpertiseAggregate);
    const legacyAggregates = legacyRows.map(toLegacyAggregateCleanupItem);

    if (!dryRun) {
      for (const row of legacyRows) {
        await ctx.db.delete(row._id);
      }
    }

    return {
      continueCursor: page.continueCursor,
      deletedAggregateCount: dryRun ? 0 : legacyRows.length,
      dryRun,
      isDone: page.isDone,
      legacyAggregateCount: legacyRows.length,
      legacyAggregates,
      mayHaveMoreAggregates: !page.isDone,
      processedAggregateCount: page.page.length,
      wouldDeleteAggregateCount: dryRun ? legacyRows.length : 0,
    };
  },
});

export const getQuoteAttributionBackfillStatus = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: quoteAttributionBackfillStatus,
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const page = await ctx.db
      .query("quoteEntries")
      .order("asc")
      .paginate(args.paginationOpts);
    const missingEvidenceItems: QuoteAttributionBackfillEvidenceItem[] = [];
    const skippedQuoteRowItems: QuoteAttributionBackfillSkippedItem[] = [];
    let attributedQuoteRowCount = 0;
    let eligibleQuoteRowCount = 0;
    let existingEvidenceCount = 0;
    let missingEvidenceCount = 0;
    let skippedQuoteRowCount = 0;

    for (const quoteEntry of page.page) {
      if (quoteEntry.quotedPersonReferentId !== undefined) {
        attributedQuoteRowCount += 1;
      }

      const candidate = await getQuoteAttributionBackfillCandidate(
        ctx,
        quoteEntry,
      );
      if (candidate.skippedReason !== undefined) {
        skippedQuoteRowCount += 1;
        skippedQuoteRowItems.push(candidate);
        continue;
      }

      eligibleQuoteRowCount += 1;
      const existingEvidence = await getExistingQuoteAttributionEvidence(
        ctx,
        candidate,
      );
      if (existingEvidence) {
        existingEvidenceCount += 1;
        continue;
      }

      missingEvidenceCount += 1;
      missingEvidenceItems.push({
        action: "missing",
        contextKey: candidate.contextKey,
        entryId: candidate.entryId,
        quoteEntryId: candidate.quoteEntryId,
        subjectPersonReferentId: candidate.subjectPersonReferentId,
      });
    }

    return {
      attributedQuoteRowCount,
      continueCursor: page.continueCursor,
      eligibleQuoteRowCount,
      existingEvidenceCount,
      isDone: page.isDone,
      mayHaveMoreQuoteRows: !page.isDone,
      missingEvidenceCount,
      missingEvidenceItems,
      processedQuoteRowCount: page.page.length,
      skippedQuoteRowCount,
      skippedQuoteRowItems,
    };
  },
});

export const backfillQuoteAttributionEvidenceBatch = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    execute: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: quoteAttributionBackfillBatchResult,
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const dryRun = args.dryRun ?? false;
    if (!dryRun && args.execute !== true) {
      throw new Error(
        "Refusing to create Quote attribution Context Expertise Evidence without execute: true.",
      );
    }

    const page = await ctx.db
      .query("quoteEntries")
      .order("asc")
      .paginate(args.paginationOpts);
    const evidenceItems: QuoteAttributionBackfillEvidenceItem[] = [];
    const skippedQuoteRowItems: QuoteAttributionBackfillSkippedItem[] = [];
    let attributedQuoteRowCount = 0;
    let eligibleQuoteRowCount = 0;
    let existingEvidenceCount = 0;
    let missingEvidenceCount = 0;
    let createdEvidenceCount = 0;
    let skippedQuoteRowCount = 0;
    let wouldCreateEvidenceCount = 0;
    const now = Date.now();

    for (const quoteEntry of page.page) {
      if (quoteEntry.quotedPersonReferentId !== undefined) {
        attributedQuoteRowCount += 1;
      }

      const candidate = await getQuoteAttributionBackfillCandidate(
        ctx,
        quoteEntry,
      );
      if (candidate.skippedReason !== undefined) {
        skippedQuoteRowCount += 1;
        skippedQuoteRowItems.push(candidate);
        continue;
      }

      eligibleQuoteRowCount += 1;
      const existingEvidence = await getExistingQuoteAttributionEvidence(
        ctx,
        candidate,
      );
      if (existingEvidence) {
        existingEvidenceCount += 1;
        evidenceItems.push({
          action: "existing",
          contextKey: candidate.contextKey,
          entryId: candidate.entryId,
          evidenceId: existingEvidence._id,
          quoteEntryId: candidate.quoteEntryId,
          subjectPersonReferentId: candidate.subjectPersonReferentId,
        });
        continue;
      }

      missingEvidenceCount += 1;
      if (dryRun) {
        wouldCreateEvidenceCount += 1;
        evidenceItems.push({
          action: "wouldCreate",
          contextKey: candidate.contextKey,
          entryId: candidate.entryId,
          quoteEntryId: candidate.quoteEntryId,
          subjectPersonReferentId: candidate.subjectPersonReferentId,
        });
        continue;
      }

      const evidenceId = await recordContextExpertiseEvidence(ctx, {
        contextTagIds: candidate.contextTagIds,
        entryId: candidate.entryId,
        evidenceKind: "quoteAttribution",
        now,
        subjectPersonReferentId: candidate.subjectPersonReferentId,
      });
      createdEvidenceCount += 1;
      evidenceItems.push({
        action: "created",
        contextKey: candidate.contextKey,
        entryId: candidate.entryId,
        evidenceId,
        quoteEntryId: candidate.quoteEntryId,
        subjectPersonReferentId: candidate.subjectPersonReferentId,
      });
    }

    return {
      attributedQuoteRowCount,
      continueCursor: page.continueCursor,
      createdEvidenceCount,
      dryRun,
      eligibleQuoteRowCount,
      evidenceItems,
      existingEvidenceCount,
      isDone: page.isDone,
      mayHaveMoreQuoteRows: !page.isDone,
      missingEvidenceCount,
      processedQuoteRowCount: page.page.length,
      skippedQuoteRowCount,
      skippedQuoteRowItems,
      wouldCreateEvidenceCount,
    };
  },
});

function normalizeContextTagIds(tagIds: string[]) {
  return normalizeContextExpertiseTagIds(tagIds, MAX_CONTEXT_TAGS);
}

function normalizeLimit(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_AGGREGATE_LIMIT;
  }

  return Math.max(0, Math.min(MAX_AGGREGATE_LIMIT, Math.floor(limit)));
}

function normalizeProfileContextExpertiseLimit(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_PROFILE_CONTEXT_EXPERTISE_LIMIT;
  }

  return Math.max(
    0,
    Math.min(MAX_PROFILE_CONTEXT_EXPERTISE_LIMIT, Math.floor(limit)),
  );
}

function normalizeQuoteAttributionPersonSearchLimit(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_QUOTE_ATTRIBUTION_PERSON_SEARCH_LIMIT;
  }

  return Math.max(
    0,
    Math.min(MAX_QUOTE_ATTRIBUTION_PERSON_SEARCH_LIMIT, Math.floor(limit)),
  );
}

function normalizePersonGlobalExpertVisibilityHistoryLimit(
  limit: number | undefined,
) {
  if (limit === undefined) {
    return DEFAULT_PERSON_GLOBAL_EXPERT_VISIBILITY_HISTORY_LIMIT;
  }

  return Math.max(
    0,
    Math.min(
      MAX_PERSON_GLOBAL_EXPERT_VISIBILITY_HISTORY_LIMIT,
      Math.floor(limit),
    ),
  );
}

async function searchPersonTagOptions(
  ctx: QueryCtx,
  {
    limit,
    searchQuery,
  }: {
    limit: number;
    searchQuery: string;
  },
) {
  const normalizedSearchQuery = searchQuery.trim();
  if (
    limit < 1 ||
    normalizedSearchQuery.length < MIN_QUOTE_ATTRIBUTION_PERSON_SEARCH_QUERY_LENGTH
  ) {
    return [];
  }

  const personTags = await ctx.db
    .query("tags")
    .withSearchIndex("search_label", (q) =>
      q.search("label", normalizedSearchQuery).eq("knowledgeType", "person"),
    )
    .take(limit);

  return personTags.map((tag) => ({
    label: tag.label,
    referentId: tag.referentId,
    tagId: tag._id,
  }));
}

async function getPersonGlobalExpertVisibilityModerationSummary(
  ctx: QueryCtx,
  personReferentId: Id<"referents">,
) {
  const person = await getPersonReferentOrThrow(ctx, personReferentId);
  const setting = await getPersonGlobalExpertVisibilitySetting(
    ctx,
    personReferentId,
  );

  return toPersonGlobalExpertVisibilityModeration(person, setting);
}

async function getPersonReferentOrThrow(
  ctx: QueryCtx | MutationCtx,
  personReferentId: Id<"referents">,
) {
  const person = await ctx.db.get(personReferentId);
  if (!person || person.knowledgeType !== "person") {
    throw new Error("Person not found.");
  }

  return person;
}

async function getPersonGlobalExpertVisibilitySetting(
  ctx: QueryCtx | MutationCtx,
  personReferentId: Id<"referents">,
) {
  return await ctx.db
    .query("personContextExpertiseVisibilitySettings")
    .withIndex("by_personReferentId", (q) =>
      q.eq("personReferentId", personReferentId),
    )
    .unique();
}

function toPersonGlobalExpertVisibilityModeration(
  person: Doc<"referents">,
  setting: Doc<"personContextExpertiseVisibilitySettings"> | null,
) {
  return {
    personLabel: person.canonicalName,
    personReferentId: person._id,
    status: setting ? ("suppressed" as const) : ("visibleByDefault" as const),
    ...(setting?.moderationNote === undefined
      ? {}
      : { moderationNote: setting.moderationNote }),
    ...(setting === null ? {} : { updatedAt: setting.updatedAt }),
    ...(setting === null ? {} : { updatedByUserId: setting.updatedByUserId }),
  };
}

function toPersonGlobalExpertVisibilityModerationEvent(
  event: Doc<"personContextExpertiseVisibilityModerationEvents">,
) {
  return {
    action: event.action,
    createdAt: event.createdAt,
    eventId: event._id,
    ...(event.moderationNote === undefined
      ? {}
      : { moderationNote: event.moderationNote }),
    nextStatus: event.nextStatus,
    personReferentId: event.personReferentId,
    ...(event.previousModerationNote === undefined
      ? {}
      : { previousModerationNote: event.previousModerationNote }),
    previousStatus: event.previousStatus,
    updatedByUserId: event.updatedByUserId,
  };
}

function getPersonGlobalExpertVisibilityStatusFromSetting(
  setting: Doc<"personContextExpertiseVisibilitySettings"> | null,
) {
  return setting ? ("suppressed" as const) : ("visibleByDefault" as const);
}

function normalizeModerationNote(note: string | undefined) {
  const normalized = note?.trim();
  return normalized ? normalized.slice(0, 500) : undefined;
}

type ContextExpertiseAggregateCandidate = Doc<"contextExpertiseAggregates"> & {
  contextMatchKind?: ContextExpertiseContextMatchKind;
};
type ProfileContextExpertiseTagSnapshot = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: Doc<"tags">["knowledgeType"];
  label: string;
  passageString?: string;
};
type CurrentUserProfileContextExpertiseRow = {
  aggregateId: Id<"contextExpertiseAggregates">;
  contextKey: string;
  contextTags: ProfileContextExpertiseTagSnapshot[];
  contextExpertiseMaturity: number;
  contextExpertiseScore: number;
  evidenceCount: number;
  feedbackCount: number;
  latestEvidenceAt: number;
  postCount: number;
  visibilityKind: Doc<"contextExpertiseAggregates">["visibilityKind"];
  visibilityTargetKey: string;
};

function applyContextMatchToAggregate(
  aggregate: Doc<"contextExpertiseAggregates">,
  contextMatchKind: ContextExpertiseContextMatchKind | undefined,
): ContextExpertiseAggregateCandidate {
  return applyContextExpertiseContextMatch(aggregate, contextMatchKind);
}

function selectBestAggregateCandidatesBySubject(
  aggregates: ContextExpertiseAggregateCandidate[],
) {
  const selected = new Map<string, ContextExpertiseAggregateCandidate>();

  for (const aggregate of [...aggregates].sort(
    compareAggregateCandidatesForSubject,
  )) {
    const subjectKey = getAggregateSubjectKey(aggregate);
    if (subjectKey === null) {
      continue;
    }

    if (!selected.has(subjectKey)) {
      selected.set(subjectKey, aggregate);
    }
  }

  return Array.from(selected.values());
}

function compareAggregateCandidatesForSubject(
  first: ContextExpertiseAggregateCandidate,
  second: ContextExpertiseAggregateCandidate,
) {
  return (
    getContextExpertiseContextMatchSortRank(first) -
      getContextExpertiseContextMatchSortRank(second) ||
    compareAggregateCandidatesForRanking(first, second)
  );
}

function compareAggregateCandidatesForRanking(
  first: ContextExpertiseAggregateCandidate,
  second: ContextExpertiseAggregateCandidate,
) {
  return (
    second.contextExpertiseScore - first.contextExpertiseScore ||
    second.contextExpertiseMaturity - first.contextExpertiseMaturity ||
    second.evidenceCount - first.evidenceCount ||
    second.postCount - first.postCount ||
    second.feedbackCount - first.feedbackCount ||
    second.latestEvidenceAt - first.latestEvidenceAt ||
    compareStrings(
      getAggregateSubjectSortKey(first),
      getAggregateSubjectSortKey(second),
    )
  );
}

function compareProfileContextExpertiseAggregates(
  first: Doc<"contextExpertiseAggregates">,
  second: Doc<"contextExpertiseAggregates">,
) {
  return (
    compareAggregateCandidatesForRanking(first, second) ||
    compareStrings(first.contextKey, second.contextKey) ||
    compareStrings(first._id, second._id)
  );
}

function isProfileContextExpertiseAggregateVisible(
  aggregate: Pick<
    Doc<"contextExpertiseAggregates">,
    "visibilityKind" | "visibilityTargetKey"
  >,
  organizationReferentIds: Set<Id<"referents">>,
) {
  if (aggregate.visibilityKind === "public") {
    return true;
  }

  if (aggregate.visibilityKind === "organization") {
    return organizationReferentIds.has(
      aggregate.visibilityTargetKey as Id<"referents">,
    );
  }

  return false;
}

async function getProfileContextTagSnapshots(
  ctx: QueryCtx,
  contextTagIds: Array<Id<"tags">>,
): Promise<ProfileContextExpertiseTagSnapshot[] | null> {
  const tags: ProfileContextExpertiseTagSnapshot[] = [];

  for (const tagId of contextTagIds) {
    const tag = await ctx.db.get(tagId);
    if (tag === null) {
      return null;
    }

    tags.push(toProfileContextTagSnapshot(tag));
  }

  return tags;
}

function toProfileContextTagSnapshot(
  tag: Doc<"tags">,
): ProfileContextExpertiseTagSnapshot {
  const href =
    tag.knowledgeType === "biblePassage"
      ? `/scripture/${encodeURIComponent(tag.lookupKey)}`
      : `/goto/${encodeURIComponent(tag.lookupKey)}`;

  return {
    canonicalKey: tag.lookupKey,
    href,
    id: tag.lookupKey,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    ...(tag.knowledgeType === "biblePassage"
      ? { passageString: tag.lookupKey }
      : {}),
  };
}

function getAggregateCandidateLimit(limit: number) {
  return Math.min(
    MAX_AGGREGATE_LIMIT,
    Math.max(MIN_AGGREGATE_CANDIDATE_LIMIT, limit),
  );
}

function getAggregateSubjectKind(
  aggregate: Pick<
    Doc<"contextExpertiseAggregates">,
    "subjectPersonReferentId" | "subjectUserId"
  >,
) {
  if (aggregate.subjectUserId !== undefined) {
    return "user";
  }

  return aggregate.subjectPersonReferentId === undefined ? null : "person";
}

function getAggregateSubjectKey(
  aggregate: Pick<
    Doc<"contextExpertiseAggregates">,
    "subjectPersonReferentId" | "subjectUserId"
  >,
) {
  if (aggregate.subjectUserId !== undefined) {
    return `user:${aggregate.subjectUserId}`;
  }

  return aggregate.subjectPersonReferentId === undefined
    ? null
    : `person:${aggregate.subjectPersonReferentId}`;
}

function getAggregateSubjectSortKey(
  aggregate: Pick<
    Doc<"contextExpertiseAggregates">,
    "subjectPersonReferentId" | "subjectUserId"
  >,
) {
  return getAggregateSubjectKey(aggregate) ?? "";
}

function normalizeAggregateSampleLimit(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_MIGRATION_AGGREGATE_SAMPLE_LIMIT;
  }

  return Math.max(
    0,
    Math.min(MAX_MIGRATION_AGGREGATE_SAMPLE_LIMIT, Math.floor(limit)),
  );
}

async function normalizeVisibilityTargetKey(
  ctx: QueryCtx | MutationCtx,
  {
    visibilityKind,
    visibilityTargetKey,
  }: {
    visibilityKind: Doc<"knowledgeEntries">["visibilityKind"];
    visibilityTargetKey: string;
  },
) {
  if (visibilityKind === "public") {
    return "public";
  }

  const normalizedTargetKey = visibilityTargetKey.trim();
  if (normalizedTargetKey === "") {
    throw new Error("Visibility target key is required.");
  }
  if (normalizedTargetKey.length > 240) {
    throw new Error("Visibility target key is too long.");
  }

  if (visibilityKind !== "organization" && visibilityKind !== "group") {
    return normalizedTargetKey;
  }

  const targetReferentId = ctx.db.normalizeId("referents", normalizedTargetKey);
  if (targetReferentId === null) {
    throw new Error("Visibility target referent not found.");
  }

  const targetReferent = await ctx.db.get(targetReferentId);
  if (!targetReferent || targetReferent.knowledgeType !== visibilityKind) {
    throw new Error("Visibility target referent not found.");
  }

  return targetReferentId;
}

function getContextKey(tagIds: string[]) {
  return getContextExpertiseContextKey(tagIds);
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

type ContextExpertiseEvidenceRow = Doc<"contextExpertiseEvidence">;
type EvidenceGroup = {
  contextKey: string;
  contextTagIds: Array<Id<"tags">>;
  scope: ContextExpertiseAudienceScope;
  subject: ContextExpertiseSubjectSelector;
};
type QuoteAttributionBackfillSkippedReason =
  | "noQuotedPerson"
  | "missingEntry"
  | "invalidQuotedPerson"
  | "notQuote"
  | "noContextTags";
type QuoteAttributionBackfillSkippedItem = {
  entryId?: Id<"knowledgeEntries">;
  quoteEntryId: Id<"quoteEntries">;
  skippedReason: QuoteAttributionBackfillSkippedReason;
  subjectPersonReferentId?: Id<"referents">;
};
type QuoteAttributionBackfillEligibleCandidate = {
  contextKey: string;
  contextTagIds: Array<Id<"tags">>;
  entryId: Id<"knowledgeEntries">;
  quoteEntryId: Id<"quoteEntries">;
  skippedReason?: undefined;
  subjectPersonReferentId: Id<"referents">;
};
type QuoteAttributionBackfillCandidate =
  | QuoteAttributionBackfillEligibleCandidate
  | QuoteAttributionBackfillSkippedItem;
type QuoteAttributionBackfillEvidenceItem = {
  action: "existing" | "missing" | "wouldCreate" | "created";
  contextKey: string;
  entryId: Id<"knowledgeEntries">;
  evidenceId?: Id<"contextExpertiseEvidence">;
  quoteEntryId: Id<"quoteEntries">;
  subjectPersonReferentId: Id<"referents">;
};
type LegacyAggregateCleanupItem = {
  aggregateId: Id<"contextExpertiseAggregates">;
  contextKey: string;
  hasAudienceScopeKind: boolean;
  hasAudienceScopeTargetKey: boolean;
  subjectKind?: "user" | "person";
  subjectUserId?: Id<"users">;
  subjectPersonReferentId?: Id<"referents">;
  visibilityKind: Doc<"contextExpertiseAggregates">["visibilityKind"];
  visibilityTargetKey: string;
};

async function getQuoteAttributionBackfillCandidate(
  ctx: QueryCtx | MutationCtx,
  quoteEntry: Doc<"quoteEntries">,
): Promise<QuoteAttributionBackfillCandidate> {
  if (quoteEntry.quotedPersonReferentId === undefined) {
    return {
      entryId: quoteEntry.entryId,
      quoteEntryId: quoteEntry._id,
      skippedReason: "noQuotedPerson",
    };
  }

  const entry = await ctx.db.get(quoteEntry.entryId);
  if (!entry) {
    return {
      entryId: quoteEntry.entryId,
      quoteEntryId: quoteEntry._id,
      skippedReason: "missingEntry",
      subjectPersonReferentId: quoteEntry.quotedPersonReferentId,
    };
  }

  if (entry.knowledgeType !== "quote") {
    return {
      entryId: quoteEntry.entryId,
      quoteEntryId: quoteEntry._id,
      skippedReason: "notQuote",
      subjectPersonReferentId: quoteEntry.quotedPersonReferentId,
    };
  }

  const quotedPerson = await ctx.db.get(quoteEntry.quotedPersonReferentId);
  if (!quotedPerson || quotedPerson.knowledgeType !== "person") {
    return {
      entryId: quoteEntry.entryId,
      quoteEntryId: quoteEntry._id,
      skippedReason: "invalidQuotedPerson",
      subjectPersonReferentId: quoteEntry.quotedPersonReferentId,
    };
  }

  const contextTagIds = await getEntryContextTagIds(ctx, quoteEntry.entryId);
  if (contextTagIds.length === 0) {
    return {
      entryId: quoteEntry.entryId,
      quoteEntryId: quoteEntry._id,
      skippedReason: "noContextTags",
      subjectPersonReferentId: quoteEntry.quotedPersonReferentId,
    };
  }

  return {
    contextKey: getContextKey(contextTagIds),
    contextTagIds,
    entryId: quoteEntry.entryId,
    quoteEntryId: quoteEntry._id,
    subjectPersonReferentId: quoteEntry.quotedPersonReferentId,
  };
}

async function getExistingQuoteAttributionEvidence(
  ctx: QueryCtx | MutationCtx,
  candidate: QuoteAttributionBackfillEligibleCandidate,
) {
  const evidenceRows = await ctx.db
    .query("contextExpertiseEvidence")
    .withIndex("by_entryId_and_createdAt", (q) =>
      q.eq("entryId", candidate.entryId),
    )
    .take(MAX_QUOTE_ATTRIBUTION_BACKFILL_EVIDENCE_ROWS);

  return (
    evidenceRows.find(
      (evidence) =>
        evidence.evidenceKind === "quoteAttribution" &&
        evidence.subjectPersonReferentId === candidate.subjectPersonReferentId &&
        evidence.contextKey === candidate.contextKey,
    ) ?? null
  );
}

function buildEvidenceGroups(evidenceRows: ContextExpertiseEvidenceRow[]) {
  const groups = new Map<string, EvidenceGroup>();

  for (const evidence of evidenceRows) {
    if (!isEffectiveContextExpertiseEvidence(evidence)) {
      continue;
    }
    const subject = getEvidenceRowSubjectSelector(evidence);
    if (subject === null) {
      continue;
    }

    const scope = getAudienceScopeFromVisibility(
      evidence.visibilityKind,
      evidence.visibilityTargetKey,
    );
    const groupKey = getEvidenceGroupKey({
      contextKey: evidence.contextKey,
      scope,
      subject,
    });
    if (groups.has(groupKey)) {
      continue;
    }

    groups.set(groupKey, {
      contextKey: evidence.contextKey,
      contextTagIds: evidence.contextTagIds,
      scope,
      subject,
    });
  }

  return Array.from(groups.values());
}

async function getScopedAggregateForGroup(
  ctx: QueryCtx | MutationCtx,
  group: EvidenceGroup,
) {
  if (group.subject.subjectKind === "user") {
    const subjectUserId = group.subject.subjectUserId;
    return await ctx.db
      .query("contextExpertiseAggregates")
      .withIndex(
        "by_user_context_audience_scope",
        (q) =>
          q
            .eq("subjectUserId", subjectUserId)
            .eq("contextKey", group.contextKey)
            .eq("audienceScopeKind", group.scope.audienceScopeKind)
            .eq("audienceScopeTargetKey", group.scope.audienceScopeTargetKey),
      )
      .first();
  }

  const subjectPersonReferentId = group.subject.subjectPersonReferentId;
  return await ctx.db
    .query("contextExpertiseAggregates")
    .withIndex(
      "by_person_context_audience_scope",
      (q) =>
        q
          .eq("subjectPersonReferentId", subjectPersonReferentId)
          .eq("contextKey", group.contextKey)
          .eq("audienceScopeKind", group.scope.audienceScopeKind)
          .eq("audienceScopeTargetKey", group.scope.audienceScopeTargetKey),
    )
    .first();
}

function getEvidenceGroupKey({
  contextKey,
  scope,
  subject,
}: {
  contextKey: string;
  scope: ContextExpertiseAudienceScope;
  subject: ContextExpertiseSubjectSelector;
}) {
  return `${getSubjectKey(subject)}:${contextKey}:${scope.audienceScopeKind}:${scope.audienceScopeTargetKey}`;
}

function getMigrationGroupSubjectFields(subject: ContextExpertiseSubjectSelector) {
  return subject.subjectKind === "user"
    ? {
        subjectKind: "user" as const,
        subjectUserId: subject.subjectUserId,
      }
    : {
        subjectKind: "person" as const,
        subjectPersonReferentId: subject.subjectPersonReferentId,
      };
}

function getSubjectKey(subject: ContextExpertiseSubjectSelector) {
  return subject.subjectKind === "user"
    ? `user:${subject.subjectUserId}`
    : `person:${subject.subjectPersonReferentId}`;
}

function isAudienceScopedAggregate(aggregate: Doc<"contextExpertiseAggregates">) {
  return (
    aggregate.audienceScopeKind !== undefined &&
    aggregate.audienceScopeTargetKey !== undefined
  );
}

function isLegacyContextExpertiseAggregate(
  aggregate: Doc<"contextExpertiseAggregates">,
) {
  return !isAudienceScopedAggregate(aggregate);
}

function toLegacyAggregateCleanupItem(
  aggregate: Doc<"contextExpertiseAggregates">,
): LegacyAggregateCleanupItem {
  const subjectKind = getAggregateSubjectKind(aggregate);
  return {
    aggregateId: aggregate._id,
    contextKey: aggregate.contextKey,
    hasAudienceScopeKind: aggregate.audienceScopeKind !== undefined,
    hasAudienceScopeTargetKey: aggregate.audienceScopeTargetKey !== undefined,
    ...(subjectKind === null ? {} : { subjectKind }),
    ...(aggregate.subjectUserId === undefined
      ? {}
      : { subjectUserId: aggregate.subjectUserId }),
    ...(aggregate.subjectPersonReferentId === undefined
      ? {}
      : { subjectPersonReferentId: aggregate.subjectPersonReferentId }),
    visibilityKind: aggregate.visibilityKind,
    visibilityTargetKey: aggregate.visibilityTargetKey,
  };
}
