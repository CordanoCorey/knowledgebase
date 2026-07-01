import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireAppAccess } from "./lib/appAccess";
import {
  applyContextExpertiseContextMatch,
  getContextExpertiseAggregateScore,
  getContextExpertiseCandidateContexts as getContextExpertiseCandidateContextsForTags,
  getContextExpertiseContextKey,
  getContextExpertiseContextMatchSortRank,
  getContextExpertiseEvidenceCountScoreBonus,
  getContextExpertiseMaturity,
  getEstimatedContextExpertiseSignalScoreFromAggregate,
  normalizeContextExpertiseTagIds,
  type ContextExpertiseContextMatchKind,
} from "./lib/contextExpertiseScoring";
import { summarizeHumanWeightEvidence } from "./lib/humanWeightEvidence";
import {
  getApplicableHumanWeight,
  getHumanWeightConcern,
  getHumanWeightFeedPriority,
  getTypeBehavior,
  isWeightBearingEntryKnowledgeType,
  type HumanWeightConcernSummary,
  type HumanWeightCreditBasis,
  type HumanWeightExpectation,
} from "./lib/typeBehavior";

// Answer feed queries project durable Knowledge Entries and open Slots into the
// same UI contract, while keeping result sets bounded for realtime subscriptions.
const DEFAULT_ANSWER_LIMIT = 20;
const DEFAULT_EXPERT_LIMIT = 3;
const DEFAULT_SLOT_LIMIT = 10;
const MAX_ANSWER_LIMIT = 50;
const MAX_EXPERT_LIMIT = 5;
const MAX_SLOT_LIMIT = 50;
const MAX_ACTIVE_TAGS = 20;
const MAX_CANDIDATE_ITEMS = 200;
const MIN_CANDIDATE_ITEMS = 25;
const CANDIDATE_MULTIPLIER = 5;
const MAX_CONTEXT_PREVIEW_TAG_LABELS = 6;
const CONTEXT_EXPERTISE_AGGREGATE_CANDIDATE_LIMIT = 25;
const DEFAULT_EXPERT_DETAIL_CONTRIBUTION_LIMIT = 5;
const MAX_EXPERT_DETAIL_CONTRIBUTION_LIMIT = 10;

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

const knowledgeSlotStatus = v.union(
  v.literal("open"),
  v.literal("fulfilled"),
  v.literal("cancelled"),
  v.literal("overdue"),
);

const humanWeightConcernSummary = v.object({
  level: v.union(
    v.literal("possibleConcern"),
    v.literal("reviewRecommended"),
  ),
  expectation: v.union(v.literal("expected"), v.literal("required")),
  threshold: v.number(),
});

const humanWeightCreditSummary = v.object({
  basis: v.union(v.literal("contributor"), v.literal("quotedPerson")),
  label: v.string(),
});

const quoteAttributionSummary = v.object({
  quotedPersonLabel: v.optional(v.string()),
  quotedPersonReferentId: v.optional(v.id("referents")),
});

const activeTagSnapshot = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  passageString: v.optional(v.string()),
});

const knowledgeEntrySummary = v.object({
  contributor: v.object({
    id: v.string(),
    name: v.string(),
    href: v.optional(v.string()),
  }),
  id: v.string(),
  title: v.string(),
  knowledgeType: authorableKnowledgeType,
  previewText: v.string(),
  primaryTagLabel: v.string(),
  contextPreviewTagLabels: v.array(v.string()),
  humanWeight: v.optional(v.number()),
  evidenceMaturity: v.optional(v.number()),
  humanWeightConcern: v.optional(humanWeightConcernSummary),
  humanWeightCredit: v.optional(humanWeightCreditSummary),
  quoteAttribution: v.optional(quoteAttributionSummary),
  href: v.string(),
  updatedAt: v.number(),
});

const contextExpertiseContextMatchKind = v.literal("broaderContext");
const contextExpertSubjectKind = v.union(
  v.literal("user"),
  v.literal("person"),
);

const knowledgeContextExpert = v.object({
  id: v.string(),
  name: v.string(),
  href: v.optional(v.string()),
  subjectKind: v.optional(contextExpertSubjectKind),
  subjectUserId: v.optional(v.id("users")),
  subjectPersonReferentId: v.optional(v.id("referents")),
  contextExpertiseMaturity: v.number(),
  contextExpertiseScore: v.number(),
  contextMatchKind: v.optional(contextExpertiseContextMatchKind),
  evidenceCount: v.number(),
  feedbackCount: v.number(),
  postCount: v.number(),
});

const knowledgeContextExpertScope = v.union(
  v.literal("orbit"),
  v.literal("global"),
);

const knowledgeContextExpertDetail = v.object({
  id: v.string(),
  name: v.string(),
  href: v.optional(v.string()),
  subjectKind: v.optional(contextExpertSubjectKind),
  subjectUserId: v.optional(v.id("users")),
  subjectPersonReferentId: v.optional(v.id("referents")),
  contextExpertiseMaturity: v.number(),
  contextExpertiseScore: v.number(),
  contextMatchKind: v.optional(contextExpertiseContextMatchKind),
  evidenceCount: v.number(),
  feedbackCount: v.number(),
  postCount: v.number(),
  topSupportingEntries: v.array(knowledgeEntrySummary),
});

const knowledgeSlotSummary = v.object({
  id: v.string(),
  title: v.string(),
  requestedKnowledgeType: authorableKnowledgeType,
  promptText: v.optional(v.string()),
  status: knowledgeSlotStatus,
  contextPreviewTagLabels: v.array(v.string()),
  targetLabel: v.string(),
  dueAt: v.optional(v.number()),
  href: v.string(),
});

const answerFeedItem = v.union(
  v.object({
    kind: v.literal("answer"),
    entry: knowledgeEntrySummary,
  }),
  v.object({
    kind: v.literal("slot"),
    slot: knowledgeSlotSummary,
  }),
);

type AnswerFeedItem =
  | { kind: "answer"; entry: KnowledgeEntrySummary }
  | { kind: "slot"; slot: KnowledgeSlotSummary };

type ContributorSummary = {
  id: string;
  name: string;
  href?: string;
  subjectKind?: ContextExpertSubjectKind;
  subjectUserId?: Id<"users">;
  subjectPersonReferentId?: Id<"referents">;
};

type HumanWeightCreditSummary = {
  basis: HumanWeightCreditBasis;
  label: string;
};

type QuoteAttributionSummary = {
  quotedPersonLabel?: string;
  quotedPersonReferentId?: Id<"referents">;
};

type KnowledgeContextExpert = ContributorSummary & {
  contextExpertiseMaturity: number;
  contextExpertiseScore: number;
  contextMatchKind?: ContextExpertiseContextMatchKind;
  evidenceCount: number;
  feedbackCount: number;
  postCount: number;
};

type ContextExpertSubjectKind = "user" | "person";
type ContextExpertSubjectSelector =
  | {
      subjectKind: "user";
      subjectUserId: Id<"users">;
    }
  | {
      subjectKind: "person";
      subjectPersonReferentId: Id<"referents">;
    };

type KnowledgeContextExpertScope = "orbit" | "global";

type KnowledgeContextExpertAudience =
  | {
      kind: "orbit";
      organizationReferentIds: Set<Id<"referents">>;
      viewerUserId: Id<"users">;
    }
  | {
      kind: "global";
    };

type ContextExpertiseAggregateRow = Pick<
  Doc<"contextExpertiseAggregates">,
  | "audienceScopeKind"
  | "audienceScopeTargetKey"
  | "contextExpertiseMaturity"
  | "contextExpertiseScore"
  | "contextKey"
  | "contextTagIds"
  | "evidenceCount"
  | "feedbackCount"
  | "latestEvidenceAt"
  | "postCount"
  | "subjectPersonReferentId"
  | "subjectUserId"
  | "topSupportingEntryIds"
  | "visibilityKind"
  | "visibilityTargetKey"
>;

type ContextExpertiseAggregateSummary = Omit<
  ContextExpertiseAggregateRow,
  "audienceScopeKind" | "audienceScopeTargetKey" | "visibilityKind" | "visibilityTargetKey"
> & {
  contextMatchKind?: ContextExpertiseContextMatchKind;
};

type ContextExpertiseAudienceScope = {
  audienceScopeKind: NonNullable<
    Doc<"contextExpertiseAggregates">["audienceScopeKind"]
  >;
  audienceScopeTargetKey: string;
};

type KnowledgeContextExpertDetail = KnowledgeContextExpert & {
  topSupportingEntries: KnowledgeEntrySummary[];
};

type KnowledgeEntrySummary = {
  contributor: ContributorSummary;
  id: string;
  title: string;
  knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
  previewText: string;
  primaryTagLabel: string;
  contextPreviewTagLabels: string[];
  humanWeight?: number;
  evidenceMaturity?: number;
  humanWeightConcern?: HumanWeightConcernSummary;
  humanWeightCredit?: HumanWeightCreditSummary;
  quoteAttribution?: QuoteAttributionSummary;
  href: string;
  updatedAt: number;
};

type KnowledgeSlotSummary = {
  id: string;
  title: string;
  requestedKnowledgeType: Doc<"knowledgeSlots">["requestedKnowledgeType"];
  promptText?: string;
  status: Doc<"knowledgeSlots">["status"];
  contextPreviewTagLabels: string[];
  targetLabel: string;
  dueAt?: number;
  href: string;
};

type TagId = Id<"tags">;
type ActiveTagSnapshot = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: Doc<"referents">["knowledgeType"];
  label: string;
  passageString?: string;
};

export const listForActiveTags = query({
  args: {
    activeTagIds: v.array(v.id("tags")),
    answerLimit: v.optional(v.number()),
    slotLimit: v.optional(v.number()),
  },
  returns: v.array(answerFeedItem),
  handler: async (ctx, args): Promise<AnswerFeedItem[]> => {
    const activeTagIds = normalizeActiveTagIds(args.activeTagIds);
    const answerLimit = normalizeLimit(
      args.answerLimit,
      DEFAULT_ANSWER_LIMIT,
      MAX_ANSWER_LIMIT,
    );
    const slotLimit = normalizeLimit(
      args.slotLimit,
      DEFAULT_SLOT_LIMIT,
      MAX_SLOT_LIMIT,
    );

    const answers = await listMatchingAnswers(ctx, activeTagIds, answerLimit);
    const slots = await listMatchingSlots(ctx, activeTagIds, slotLimit);

    return [...answers, ...slots];
  },
});

export const listForActiveTagKeys = query({
  args: {
    activeTags: v.array(activeTagSnapshot),
    answerLimit: v.optional(v.number()),
    slotLimit: v.optional(v.number()),
  },
  returns: v.array(answerFeedItem),
  handler: async (ctx, args): Promise<AnswerFeedItem[]> => {
    const activeTagIds = await resolveActiveTagIds(ctx, args.activeTags);
    if (activeTagIds === null) {
      return [];
    }

    const answerLimit = normalizeLimit(
      args.answerLimit,
      DEFAULT_ANSWER_LIMIT,
      MAX_ANSWER_LIMIT,
    );
    const slotLimit = normalizeLimit(
      args.slotLimit,
      DEFAULT_SLOT_LIMIT,
      MAX_SLOT_LIMIT,
    );

    const answers = await listMatchingAnswers(ctx, activeTagIds, answerLimit);
    const slots = await listMatchingSlots(ctx, activeTagIds, slotLimit);

    return [...answers, ...slots];
  },
});

export const listAssignedSlotsForCurrentUser = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(knowledgeSlotSummary),
  handler: async (ctx, args): Promise<KnowledgeSlotSummary[]> => {
    const access = await requireAppAccess(ctx);
    const limit = normalizeLimit(args.limit, DEFAULT_SLOT_LIMIT, MAX_SLOT_LIMIT);
    if (limit < 1) {
      return [];
    }

    const candidateSlots = await getAssignedSlotCandidatesForUser(
      ctx,
      access.userId,
      getCandidateLimit(limit),
    );
    const slotItems = [];

    for (const slot of candidateSlots) {
      slotItems.push({
        kind: "slot" as const,
        slot: await summarizeSlot(ctx, slot),
      });
    }

    return slotItems.sort(compareSlotItems).slice(0, limit).map((item) => item.slot);
  },
});

export const listExpertsForActiveTags = query({
  args: {
    activeTagIds: v.array(v.id("tags")),
    expertLimit: v.optional(v.number()),
    expertScope: v.optional(knowledgeContextExpertScope),
  },
  returns: v.array(knowledgeContextExpert),
  handler: async (ctx, args): Promise<KnowledgeContextExpert[]> => {
    const activeTagIds = normalizeActiveTagIds(args.activeTagIds);
    const expertLimit = normalizeLimit(
      args.expertLimit,
      DEFAULT_EXPERT_LIMIT,
      MAX_EXPERT_LIMIT,
    );
    if (expertLimit < 1) {
      return [];
    }

    const audience = await getKnowledgeContextExpertAudience(
      ctx,
      args.expertScope,
    );
    const aggregateExperts = await listAggregateKnowledgeContextExperts(
      ctx,
      activeTagIds,
      expertLimit,
      audience,
    );
    if (aggregateExperts.length > 0 || audience !== null) {
      return aggregateExperts;
    }

    const entries = await getMatchingAnswerEntries(
      ctx,
      activeTagIds,
      MAX_CANDIDATE_ITEMS,
    );

    return await summarizeKnowledgeContextExperts(ctx, entries, expertLimit);
  },
});

export const listExpertsForActiveTagKeys = query({
  args: {
    activeTags: v.array(activeTagSnapshot),
    expertLimit: v.optional(v.number()),
    expertScope: v.optional(knowledgeContextExpertScope),
  },
  returns: v.array(knowledgeContextExpert),
  handler: async (ctx, args): Promise<KnowledgeContextExpert[]> => {
    const activeTagIds = await resolveActiveTagIds(ctx, args.activeTags);
    if (activeTagIds === null) {
      return [];
    }

    const expertLimit = normalizeLimit(
      args.expertLimit,
      DEFAULT_EXPERT_LIMIT,
      MAX_EXPERT_LIMIT,
    );
    if (expertLimit < 1) {
      return [];
    }

    const audience = await getKnowledgeContextExpertAudience(
      ctx,
      args.expertScope,
    );
    const aggregateExperts = await listAggregateKnowledgeContextExperts(
      ctx,
      activeTagIds,
      expertLimit,
      audience,
    );
    if (aggregateExperts.length > 0 || audience !== null) {
      return aggregateExperts;
    }

    const entries = await getMatchingAnswerEntries(
      ctx,
      activeTagIds,
      MAX_CANDIDATE_ITEMS,
    );

    return await summarizeKnowledgeContextExperts(ctx, entries, expertLimit);
  },
});

export const getExpertDetailForActiveTags = query({
  args: {
    activeTagIds: v.array(v.id("tags")),
    subjectUserId: v.optional(v.id("users")),
    subjectPersonReferentId: v.optional(v.id("referents")),
    contributionLimit: v.optional(v.number()),
    expertScope: v.optional(knowledgeContextExpertScope),
  },
  returns: v.union(knowledgeContextExpertDetail, v.null()),
  handler: async (
    ctx,
    args,
  ): Promise<KnowledgeContextExpertDetail | null> => {
    const audience = await getKnowledgeContextExpertAudience(
      ctx,
      args.expertScope,
    );
    const subject = getContextExpertSubjectSelector(args);
    return await getAggregateKnowledgeContextExpertDetail(ctx, {
      activeTagIds: normalizeActiveTagIds(args.activeTagIds),
      audience,
      contributionLimit: normalizeLimit(
        args.contributionLimit,
        DEFAULT_EXPERT_DETAIL_CONTRIBUTION_LIMIT,
        MAX_EXPERT_DETAIL_CONTRIBUTION_LIMIT,
      ),
      subject,
    });
  },
});

export const getExpertDetailForActiveTagKeys = query({
  args: {
    activeTags: v.array(activeTagSnapshot),
    subjectUserId: v.optional(v.id("users")),
    subjectPersonReferentId: v.optional(v.id("referents")),
    contributionLimit: v.optional(v.number()),
    expertScope: v.optional(knowledgeContextExpertScope),
  },
  returns: v.union(knowledgeContextExpertDetail, v.null()),
  handler: async (
    ctx,
    args,
  ): Promise<KnowledgeContextExpertDetail | null> => {
    const activeTagIds = await resolveActiveTagIds(ctx, args.activeTags);
    if (activeTagIds === null) {
      return null;
    }

    const audience = await getKnowledgeContextExpertAudience(
      ctx,
      args.expertScope,
    );
    const subject = getContextExpertSubjectSelector(args);
    return await getAggregateKnowledgeContextExpertDetail(ctx, {
      activeTagIds,
      audience,
      contributionLimit: normalizeLimit(
        args.contributionLimit,
        DEFAULT_EXPERT_DETAIL_CONTRIBUTION_LIMIT,
        MAX_EXPERT_DETAIL_CONTRIBUTION_LIMIT,
      ),
      subject,
    });
  },
});

async function resolveActiveTagIds(
  ctx: QueryCtx,
  activeTags: ActiveTagSnapshot[],
): Promise<TagId[] | null> {
  const snapshots = normalizeActiveTagSnapshots(activeTags);
  const tagIds: TagId[] = [];

  for (const snapshot of snapshots) {
    const lookupKey = getActiveTagLookupKey(snapshot);
    const tag = await ctx.db
      .query("tags")
      .withIndex("by_knowledgeType_and_lookupKey", (q) =>
        q.eq("knowledgeType", snapshot.knowledgeType).eq("lookupKey", lookupKey),
      )
      .first();

    if (!tag) {
      return null;
    }

    tagIds.push(tag._id);
  }

  return normalizeActiveTagIds(tagIds);
}

function normalizeActiveTagSnapshots(activeTags: ActiveTagSnapshot[]) {
  if (activeTags.length > MAX_ACTIVE_TAGS) {
    throw new Error(`Answer Feed supports at most ${MAX_ACTIVE_TAGS} active Tags.`);
  }

  const uniqueSnapshots = new Map<string, ActiveTagSnapshot>();
  for (const tag of activeTags) {
    uniqueSnapshots.set(
      `${tag.knowledgeType}:${getActiveTagLookupKey(tag)}`,
      tag,
    );
  }

  return Array.from(uniqueSnapshots.values());
}

async function listMatchingAnswers(
  ctx: QueryCtx,
  activeTagIds: TagId[],
  limit: number,
): Promise<Array<AnswerFeedItem & { kind: "answer" }>> {
  if (limit < 1) {
    return [];
  }

  const candidateEntries = await getMatchingAnswerEntries(
    ctx,
    activeTagIds,
    limit,
  );
  const contributorCache = new Map<string, Promise<ContributorSummary>>();
  const answerItems = [];

  for (const entry of candidateEntries) {
    answerItems.push({
      kind: "answer" as const,
      entry: await summarizeEntry(ctx, entry, contributorCache),
    });
  }

  return answerItems.sort(compareAnswerItems).slice(0, limit);
}

async function getMatchingAnswerEntries(
  ctx: QueryCtx,
  activeTagIds: TagId[],
  limit: number,
) {
  const candidateLimit = getCandidateLimit(limit);
  const candidateEntries =
    activeTagIds.length === 0
      ? await getGlobalAnswerCandidates(ctx, candidateLimit)
      : await getEntryCandidatesForActiveTags(ctx, activeTagIds, candidateLimit);
  const matchingEntries = [];

  for (const entry of candidateEntries) {
    if (await entryContainsAllTags(ctx, entry._id, activeTagIds)) {
      matchingEntries.push(entry);
    }
  }

  return matchingEntries.sort(compareEntries).slice(0, candidateLimit);
}

async function getGlobalAnswerCandidates(
  ctx: QueryCtx,
  candidateLimit: number,
) {
  const byHumanWeight = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_humanWeight_and_updatedAt")
    .order("desc")
    .take(candidateLimit);
  const byRecency = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_updatedAt")
    .order("desc")
    .take(candidateLimit);

  return dedupeEntries([...byHumanWeight, ...byRecency]);
}

function dedupeEntries(entries: Array<Doc<"knowledgeEntries">>) {
  const byEntryId = new Map<string, Doc<"knowledgeEntries">>();
  for (const entry of entries) {
    byEntryId.set(entry._id, entry);
  }

  return Array.from(byEntryId.values());
}

async function listMatchingSlots(
  ctx: QueryCtx,
  activeTagIds: TagId[],
  limit: number,
): Promise<Array<AnswerFeedItem & { kind: "slot" }>> {
  if (limit < 1) {
    return [];
  }

  const candidateLimit = getCandidateLimit(limit);
  const candidateSlots =
    activeTagIds.length === 0
      ? await getSlotCandidatesByStatus(ctx, candidateLimit)
      : await getSlotCandidatesForActiveTags(ctx, activeTagIds, candidateLimit);
  const slotItems = [];

  for (const slot of candidateSlots) {
    if (!(await slotContainsAllTags(ctx, slot._id, activeTagIds))) {
      continue;
    }

    slotItems.push({
      kind: "slot" as const,
      slot: await summarizeSlot(ctx, slot),
    });
  }

  return slotItems.sort(compareSlotItems).slice(0, limit);
}

async function getEntryCandidatesForActiveTags(
  ctx: QueryCtx,
  activeTagIds: TagId[],
  candidateLimit: number,
) {
  const anchorRows = await getSmallestEntryTagCandidateSet(
    ctx,
    activeTagIds,
    candidateLimit,
  );
  const entries = [];
  const seenEntryIds = new Set<string>();

  for (const row of anchorRows) {
    if (seenEntryIds.has(row.entryId)) {
      continue;
    }

    const entry = await ctx.db.get(row.entryId);
    if (entry) {
      seenEntryIds.add(row.entryId);
      entries.push(entry);
    }
  }

  return entries;
}

async function getSmallestEntryTagCandidateSet(
  ctx: QueryCtx,
  activeTagIds: TagId[],
  candidateLimit: number,
) {
  let smallestRows: Doc<"entryTags">[] | null = null;

  for (const tagId of activeTagIds) {
    const rows = await ctx.db
      .query("entryTags")
      .withIndex("by_tagId_and_entryId", (q) => q.eq("tagId", tagId))
      .take(candidateLimit);

    if (!smallestRows || rows.length < smallestRows.length) {
      smallestRows = rows;
    }
  }

  return smallestRows ?? [];
}

async function getSlotCandidatesForActiveTags(
  ctx: QueryCtx,
  activeTagIds: TagId[],
  candidateLimit: number,
) {
  const anchorRows = await getSmallestSlotTagCandidateSet(
    ctx,
    activeTagIds,
    candidateLimit,
  );
  const slots = [];
  const seenSlotIds = new Set<string>();

  for (const row of anchorRows) {
    if (seenSlotIds.has(row.slotId)) {
      continue;
    }

    const slot = await ctx.db.get(row.slotId);
    if (slot) {
      seenSlotIds.add(row.slotId);
      slots.push(slot);
    }
  }

  return slots;
}

async function getSmallestSlotTagCandidateSet(
  ctx: QueryCtx,
  activeTagIds: TagId[],
  candidateLimit: number,
) {
  let smallestRows: Doc<"slotTags">[] | null = null;

  for (const tagId of activeTagIds) {
    const rows = await ctx.db
      .query("slotTags")
      .withIndex("by_tagId_and_slotId", (q) => q.eq("tagId", tagId))
      .take(candidateLimit);

    if (!smallestRows || rows.length < smallestRows.length) {
      smallestRows = rows;
    }
  }

  return smallestRows ?? [];
}

async function getSlotCandidatesByStatus(ctx: QueryCtx, candidateLimit: number) {
  const slots = [];
  const seenSlotIds = new Set<string>();

  for (const status of ["overdue", "open", "fulfilled", "cancelled"] as const) {
    const statusSlots = await ctx.db
      .query("knowledgeSlots")
      .withIndex("by_status_and_dueAt", (q) => q.eq("status", status))
      .take(candidateLimit);

    for (const slot of statusSlots) {
      if (!seenSlotIds.has(slot._id)) {
        seenSlotIds.add(slot._id);
        slots.push(slot);
      }
    }
  }

  return slots;
}

async function getAssignedSlotCandidatesForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  candidateLimit: number,
) {
  const slots = [];
  const seenSlotIds = new Set<string>();

  for (const status of ["overdue", "open"] as const) {
    const statusSlots = await ctx.db
      .query("knowledgeSlots")
      .withIndex("by_targetUserId_and_status_and_dueAt", (q) =>
        q.eq("targetUserId", userId).eq("status", status),
      )
      .take(candidateLimit);

    for (const slot of statusSlots) {
      if (
        slot.targetKind === "user" &&
        slot.targetUserId === userId &&
        !seenSlotIds.has(slot._id)
      ) {
        seenSlotIds.add(slot._id);
        slots.push(slot);
      }
    }
  }

  return slots;
}

async function entryContainsAllTags(
  ctx: QueryCtx,
  entryId: Id<"knowledgeEntries">,
  activeTagIds: TagId[],
) {
  for (const tagId of activeTagIds) {
    const matchingTag = await ctx.db
      .query("entryTags")
      .withIndex("by_entryId_and_tagId", (q) =>
        q.eq("entryId", entryId).eq("tagId", tagId),
      )
      .first();

    if (!matchingTag) {
      return false;
    }
  }

  return true;
}

async function slotContainsAllTags(
  ctx: QueryCtx,
  slotId: Id<"knowledgeSlots">,
  activeTagIds: TagId[],
) {
  for (const tagId of activeTagIds) {
    const matchingTag = await ctx.db
      .query("slotTags")
      .withIndex("by_slotId_and_tagId", (q) =>
        q.eq("slotId", slotId).eq("tagId", tagId),
      )
      .first();

    if (!matchingTag) {
      return false;
    }
  }

  return true;
}

async function summarizeEntry(
  ctx: QueryCtx,
  entry: Doc<"knowledgeEntries">,
  contributorCache: Map<string, Promise<ContributorSummary>>,
): Promise<KnowledgeEntrySummary> {
  const humanWeight = getApplicableHumanWeight(
    entry.knowledgeType,
    entry.humanWeight,
  );
  const humanWeightExpectation = await getFulfilledSlotHumanWeightExpectation(
    ctx,
    entry._id,
  );
  const humanWeightConcern = getHumanWeightConcern({
    ...(humanWeightExpectation === undefined
      ? {}
      : { expectation: humanWeightExpectation }),
    knowledgeType: entry.knowledgeType,
    humanWeight: entry.humanWeight,
  });
  const evidenceSummary = await getHumanWeightEvidenceSummary(ctx, entry);
  const contributor = await getUserContributorSummary(
    ctx,
    entry.createdByUserId,
    contributorCache,
  );
  const humanWeightCredit = await getHumanWeightCreditSummary(
    ctx,
    entry,
    contributor,
  );
  const quoteAttribution = await getQuoteAttributionSummary(ctx, entry);

  return {
    contributor,
    id: entry._id,
    title: entry.title,
    knowledgeType: entry.knowledgeType,
    previewText: entry.previewText,
    primaryTagLabel: entry.primaryTagLabel,
    contextPreviewTagLabels: entry.contextPreviewTagLabels,
    ...(humanWeight === undefined ? {} : { humanWeight }),
    ...(evidenceSummary === undefined
      ? {}
      : { evidenceMaturity: evidenceSummary.evidenceMaturity }),
    ...(humanWeightConcern === undefined ? {} : { humanWeightConcern }),
    ...(humanWeightCredit === undefined ? {} : { humanWeightCredit }),
    ...(quoteAttribution === undefined ? {} : { quoteAttribution }),
    href: `/entries/${entry._id}`,
    updatedAt: entry.updatedAt,
  };
}

async function getQuoteAttributionSummary(
  ctx: QueryCtx,
  entry: Doc<"knowledgeEntries">,
): Promise<QuoteAttributionSummary | undefined> {
  if (entry.knowledgeType !== "quote") {
    return undefined;
  }

  const quoteEntry = await ctx.db
    .query("quoteEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
    .first();
  if (quoteEntry?.quotedPersonReferentId === undefined) {
    return {};
  }

  const quotedPersonReferent = await ctx.db.get(
    quoteEntry.quotedPersonReferentId,
  );

  return {
    quotedPersonReferentId: quoteEntry.quotedPersonReferentId,
    quotedPersonLabel: quotedPersonReferent?.canonicalName ?? "Quoted person",
  };
}

async function getHumanWeightCreditSummary(
  ctx: QueryCtx,
  entry: Doc<"knowledgeEntries">,
  contributor: ContributorSummary,
): Promise<HumanWeightCreditSummary | undefined> {
  if (!isWeightBearingEntryKnowledgeType(entry.knowledgeType)) {
    return undefined;
  }

  const creditBasis = getTypeBehavior(entry.knowledgeType).humanWeight.creditBasis;
  if (creditBasis === "contributor") {
    return {
      basis: creditBasis,
      label: contributor.name,
    };
  }

  if (creditBasis === "quotedPerson") {
    return await getQuoteHumanWeightCreditSummary(ctx, entry._id);
  }

  return undefined;
}

async function getQuoteHumanWeightCreditSummary(
  ctx: QueryCtx,
  entryId: Id<"knowledgeEntries">,
): Promise<HumanWeightCreditSummary> {
  const quoteEntry = await ctx.db
    .query("quoteEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
    .first();
  const quotedPersonReferent =
    quoteEntry?.quotedPersonReferentId === undefined
      ? null
      : await ctx.db.get(quoteEntry.quotedPersonReferentId);

  return {
    basis: "quotedPerson",
    label: quotedPersonReferent?.canonicalName ?? "Quoted person",
  };
}

async function getFulfilledSlotHumanWeightExpectation(
  ctx: QueryCtx,
  entryId: Id<"knowledgeEntries">,
): Promise<HumanWeightExpectation | undefined> {
  const slots = await ctx.db
    .query("knowledgeSlots")
    .withIndex("by_fulfilledEntryId", (q) => q.eq("fulfilledEntryId", entryId))
    .collect();
  let strongestExpectation: HumanWeightExpectation | undefined;

  for (const slot of slots) {
    if (
      slot.status !== "fulfilled" ||
      slot.humanWeightExpectation === undefined
    ) {
      continue;
    }

    strongestExpectation = getStrongerHumanWeightExpectation(
      strongestExpectation,
      slot.humanWeightExpectation,
    );
  }

  return strongestExpectation;
}

const HUMAN_WEIGHT_EXPECTATION_STRENGTH: Record<HumanWeightExpectation, number> = {
  none: 0,
  informative: 1,
  expected: 2,
  required: 3,
};

function getStrongerHumanWeightExpectation(
  current: HumanWeightExpectation | undefined,
  candidate: HumanWeightExpectation,
) {
  if (
    current === undefined ||
    HUMAN_WEIGHT_EXPECTATION_STRENGTH[candidate] >
      HUMAN_WEIGHT_EXPECTATION_STRENGTH[current]
  ) {
    return candidate;
  }

  return current;
}

async function getHumanWeightEvidenceSummary(
  ctx: QueryCtx,
  entry: Doc<"knowledgeEntries">,
) {
  if (!isWeightBearingEntryKnowledgeType(entry.knowledgeType)) {
    return undefined;
  }

  const feedbackRows = await ctx.db
    .query("humanWeightFeedback")
    .withIndex("by_entryId_and_createdAt", (q) => q.eq("entryId", entry._id))
    .collect();
  const derivedEvidenceRows = await ctx.db
    .query("humanWeightEvidence")
    .withIndex("by_entryId_and_createdAt", (q) => q.eq("entryId", entry._id))
    .collect();

  return summarizeHumanWeightEvidence(entry.knowledgeType, [
    ...feedbackRows,
    ...derivedEvidenceRows,
  ]);
}

async function summarizeKnowledgeContextExperts(
  ctx: QueryCtx,
  entries: Array<Doc<"knowledgeEntries">>,
  limit: number,
): Promise<KnowledgeContextExpert[]> {
  const contributorCache = new Map<string, Promise<ContributorSummary>>();
  const aggregates = new Map<
    string,
    ContributorSummary & {
      latestUpdatedAt: number;
      maxHumanWeight: number;
      postCount: number;
      totalHumanWeight: number;
    }
  >();

  for (const entry of entries) {
    if (entry.createdByUserId === undefined) {
      continue;
    }

    const humanWeight = getApplicableHumanWeight(
      entry.knowledgeType,
      entry.humanWeight,
    );
    if (humanWeight === undefined) {
      continue;
    }

    const contributor = await getUserContributorSummary(
      ctx,
      entry.createdByUserId,
      contributorCache,
    );
    const aggregate = aggregates.get(contributor.id);
    if (aggregate) {
      aggregate.postCount += 1;
      aggregate.latestUpdatedAt = Math.max(aggregate.latestUpdatedAt, entry.updatedAt);
      aggregate.maxHumanWeight = Math.max(aggregate.maxHumanWeight, humanWeight);
      aggregate.totalHumanWeight += humanWeight;
      continue;
    }

    aggregates.set(contributor.id, {
      ...contributor,
      latestUpdatedAt: entry.updatedAt,
      maxHumanWeight: humanWeight,
      postCount: 1,
      totalHumanWeight: humanWeight,
    });
  }

  return Array.from(aggregates.values())
    .map(toKnowledgeContextExpert)
    .sort(compareKnowledgeContextExperts)
    .slice(0, limit)
    .map(removeExpertSortFields);
}

async function listAggregateKnowledgeContextExperts(
  ctx: QueryCtx,
  activeTagIds: TagId[],
  limit: number,
  audience: KnowledgeContextExpertAudience | null,
): Promise<KnowledgeContextExpert[]> {
  const contributorCache = new Map<string, Promise<ContributorSummary>>();
  const aggregateCandidates: ContextExpertiseAggregateSummary[] = [];

  for (const candidateContext of getContextExpertiseCandidateContexts(activeTagIds)) {
    const rows = await listAggregateRowsForAudience(
      ctx,
      candidateContext.contextKey,
      limit,
      audience,
    );
    aggregateCandidates.push(
      ...combineAggregateRowsBySubject(rows).map((aggregate) =>
        applyContextMatchToAggregate(
          aggregate,
          candidateContext.contextMatchKind,
        ),
      ),
    );
  }

  const aggregates = selectBestAggregateCandidatesBySubject(aggregateCandidates);
  const experts: Array<KnowledgeContextExpert & { latestEvidenceAt: number }> = [];

  for (const aggregate of aggregates) {
    const contributor = await getContributorSummary(
      ctx,
      aggregate,
      contributorCache,
    );
    experts.push(toAggregateKnowledgeContextExpert(aggregate, contributor));
  }

  return experts
    .sort(compareKnowledgeContextExperts)
    .slice(0, limit)
    .map(removeExpertSortFields);
}

async function getAggregateKnowledgeContextExpertDetail(
  ctx: QueryCtx,
  args: {
    activeTagIds: TagId[];
    audience: KnowledgeContextExpertAudience | null;
    contributionLimit: number;
    subject: ContextExpertSubjectSelector;
  },
): Promise<KnowledgeContextExpertDetail | null> {
  const aggregateCandidates: ContextExpertiseAggregateSummary[] = [];
  for (const candidateContext of getContextExpertiseCandidateContexts(
    args.activeTagIds,
  )) {
    const rows = await listSubjectAggregateRowsForAudience(ctx, {
      audience: args.audience,
      contextKey: candidateContext.contextKey,
      subject: args.subject,
    });
    aggregateCandidates.push(
      ...combineAggregateRowsBySubject(rows).map((aggregate) =>
        applyContextMatchToAggregate(
          aggregate,
          candidateContext.contextMatchKind,
        ),
      ),
    );
  }

  const aggregate = selectBestAggregateCandidatesBySubject(aggregateCandidates)[0];
  if (!aggregate) {
    return null;
  }

  const contributor = await getContributorSummary(
    ctx,
    aggregate,
    new Map(),
  );
  const expert = removeExpertSortFields(
    toAggregateKnowledgeContextExpert(aggregate, contributor),
  );

  return {
    ...expert,
    topSupportingEntries: await summarizeTopSupportingEntries(
      ctx,
      aggregate.topSupportingEntryIds,
      args.contributionLimit,
      args.audience,
    ),
  };
}

async function summarizeTopSupportingEntries(
  ctx: QueryCtx,
  entryIds: Array<Id<"knowledgeEntries">>,
  limit: number,
  audience: KnowledgeContextExpertAudience | null,
) {
  if (limit < 1) {
    return [];
  }

  const contributorCache = new Map<string, Promise<ContributorSummary>>();
  const entries: KnowledgeEntrySummary[] = [];

  for (const entryId of entryIds) {
    if (entries.length >= limit) {
      break;
    }

    const entry = await ctx.db.get(entryId);
    if (!entry || !isEntryVisibleInContextExpertDetail(entry, audience)) {
      continue;
    }

    entries.push(await summarizeEntry(ctx, entry, contributorCache));
  }

  return entries;
}

function getContextExpertiseCandidateContexts(activeTagIds: TagId[]) {
  const contextTagIds = normalizeActiveTagIds(activeTagIds);
  return getContextExpertiseCandidateContextsForTags(contextTagIds);
}

function applyContextMatchToAggregate(
  aggregate: ContextExpertiseAggregateSummary,
  contextMatchKind: ContextExpertiseContextMatchKind | undefined,
): ContextExpertiseAggregateSummary {
  return applyContextExpertiseContextMatch(aggregate, contextMatchKind);
}

function selectBestAggregateCandidatesBySubject(
  aggregates: ContextExpertiseAggregateSummary[],
) {
  const selected = new Map<string, ContextExpertiseAggregateSummary>();

  for (const aggregate of [...aggregates].sort(
    compareAggregateCandidatesForSubject,
  )) {
    const subject = getAggregateSubjectSelector(aggregate);
    if (subject === null) {
      continue;
    }

    const subjectKey = getSubjectKey(subject);
    if (!selected.has(subjectKey)) {
      selected.set(subjectKey, aggregate);
    }
  }

  return Array.from(selected.values());
}

function compareAggregateCandidatesForSubject(
  first: ContextExpertiseAggregateSummary,
  second: ContextExpertiseAggregateSummary,
) {
  return (
    getContextExpertiseContextMatchSortRank(first) -
      getContextExpertiseContextMatchSortRank(second) ||
    second.contextExpertiseScore - first.contextExpertiseScore ||
    second.contextExpertiseMaturity - first.contextExpertiseMaturity ||
    second.evidenceCount - first.evidenceCount ||
    second.postCount - first.postCount ||
    second.feedbackCount - first.feedbackCount ||
    second.latestEvidenceAt - first.latestEvidenceAt ||
    compareStrings(getAggregateSubjectSortKey(first), getAggregateSubjectSortKey(second))
  );
}

async function listAggregateRowsForAudience(
  ctx: QueryCtx,
  contextKey: string,
  limit: number,
  audience: KnowledgeContextExpertAudience | null,
): Promise<ContextExpertiseAggregateRow[]> {
  const candidateLimit = getAggregateExpertCandidateLimit(limit);
  if (audience === null) {
    return await ctx.db
      .query("contextExpertiseAggregates")
      .withIndex("by_contextKey_and_contextExpertiseScore", (q) =>
        q.eq("contextKey", contextKey),
      )
      .order("desc")
      .take(candidateLimit);
  }

  const visibilityCache = new Map<string, Promise<boolean>>();
  const scopedRows = await listScopedAggregateRowsForAudience(ctx, {
    audience,
    contextKey,
    limit: candidateLimit,
    visibilityCache,
  });
  const legacyRows = await listLegacyAggregateRowsForAudience(ctx, {
    audience,
    contextKey,
    limit: candidateLimit,
    scopedRows,
    visibilityCache,
  });

  return [...scopedRows, ...legacyRows];
}

async function listSubjectAggregateRowsForAudience(
  ctx: QueryCtx,
  {
    audience,
    contextKey,
    subject,
  }: {
    audience: KnowledgeContextExpertAudience | null;
    contextKey: string;
    subject: ContextExpertSubjectSelector;
  },
): Promise<ContextExpertiseAggregateRow[]> {
  if (audience === null) {
    return await listAggregateRowsForSubject(ctx, subject, contextKey);
  }

  const visibilityCache = new Map<string, Promise<boolean>>();
  if (
    !(await isSubjectVisibleToExpertAudience(ctx, subject, audience, {
      globalVisibilityCache: visibilityCache,
      orbitEligibilityCache: visibilityCache,
    }))
  ) {
    return [];
  }

  const scopedRows = await listScopedAggregateRowsForSubject(ctx, {
    audience,
    contextKey,
    subject,
  });
  if (scopedRows.length > 0) {
    return scopedRows;
  }

  if (await hasAnyScopedAggregateForSubject(ctx, subject, contextKey)) {
    return [];
  }

  return await listLegacyAggregateRowsForSubject(ctx, {
    audience,
    contextKey,
    subject,
    visibilityCache,
  });
}

async function listScopedAggregateRowsForAudience(
  ctx: QueryCtx,
  {
    audience,
    contextKey,
    limit,
    visibilityCache,
  }: {
    audience: KnowledgeContextExpertAudience;
    contextKey: string;
    limit: number;
    visibilityCache: Map<string, Promise<boolean>>;
  },
) {
  const rows: ContextExpertiseAggregateRow[] = [];
  const seenAggregateKeys = new Set<string>();
  const orbitEligibilityCache = new Map<string, Promise<boolean>>();

  for (const scope of getAudienceScopes(audience)) {
    const scopeRows = await ctx.db
      .query("contextExpertiseAggregates")
      .withIndex(
        "by_context_audience_scope_expertise",
        (q) =>
          q
            .eq("contextKey", contextKey)
            .eq("audienceScopeKind", scope.audienceScopeKind)
            .eq("audienceScopeTargetKey", scope.audienceScopeTargetKey),
      )
      .order("desc")
      .take(limit);

    for (const row of scopeRows) {
      const aggregateKey = getAggregateAudienceScopedSubjectKey(row);
      if (
        aggregateKey === null ||
        seenAggregateKeys.has(aggregateKey) ||
        !(await isAggregateVisibleToExpertAudience(ctx, row, audience, {
          globalVisibilityCache: visibilityCache,
          orbitEligibilityCache,
        }))
      ) {
        continue;
      }

      seenAggregateKeys.add(aggregateKey);
      rows.push(row);
    }
  }

  return rows;
}

async function listScopedAggregateRowsForSubject(
  ctx: QueryCtx,
  {
    audience,
    contextKey,
    subject,
  }: {
    audience: KnowledgeContextExpertAudience;
    contextKey: string;
    subject: ContextExpertSubjectSelector;
  },
) {
  const rows: ContextExpertiseAggregateRow[] = [];

  for (const scope of getAudienceScopes(audience)) {
    const row =
      subject.subjectKind === "user"
        ? await ctx.db
            .query("contextExpertiseAggregates")
            .withIndex(
              "by_user_context_audience_scope",
              (q) =>
                q
                  .eq("subjectUserId", subject.subjectUserId)
                  .eq("contextKey", contextKey)
                  .eq("audienceScopeKind", scope.audienceScopeKind)
                  .eq("audienceScopeTargetKey", scope.audienceScopeTargetKey),
            )
            .first()
        : await ctx.db
            .query("contextExpertiseAggregates")
            .withIndex(
              "by_person_context_audience_scope",
              (q) =>
                q
                  .eq(
                    "subjectPersonReferentId",
                    subject.subjectPersonReferentId,
                  )
                  .eq("contextKey", contextKey)
                  .eq("audienceScopeKind", scope.audienceScopeKind)
                  .eq("audienceScopeTargetKey", scope.audienceScopeTargetKey),
            )
            .first();

    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

async function listLegacyAggregateRowsForAudience(
  ctx: QueryCtx,
  {
    audience,
    contextKey,
    limit,
    scopedRows,
    visibilityCache,
  }: {
    audience: KnowledgeContextExpertAudience;
    contextKey: string;
    limit: number;
    scopedRows: ContextExpertiseAggregateRow[];
    visibilityCache: Map<string, Promise<boolean>>;
  },
) {
  const scopedSubjectKeys = new Set(
    scopedRows
      .map((row) => getAggregateSubjectSelector(row))
      .filter((subject): subject is ContextExpertSubjectSelector => subject !== null)
      .map(getSubjectKey),
  );
  const orbitEligibilityCache = new Map<string, Promise<boolean>>();
  const legacyRows = await ctx.db
    .query("contextExpertiseAggregates")
    .withIndex("by_contextKey_and_contextExpertiseScore", (q) =>
      q.eq("contextKey", contextKey),
    )
    .order("desc")
    .take(limit);
  const fallbackRows: ContextExpertiseAggregateRow[] = [];

  for (const row of legacyRows) {
    const subject = getAggregateSubjectSelector(row);
    if (subject === null) {
      continue;
    }

    const subjectKey = getSubjectKey(subject);
    if (
      isAudienceScopedAggregate(row) ||
      scopedSubjectKeys.has(subjectKey) ||
      (await hasAnyScopedAggregateForSubject(ctx, subject, contextKey)) ||
      !(await isAggregateVisibleToExpertAudience(ctx, row, audience, {
        globalVisibilityCache: visibilityCache,
        orbitEligibilityCache,
      }))
    ) {
      continue;
    }

    fallbackRows.push(row);
  }

  return fallbackRows;
}

async function listLegacyAggregateRowsForSubject(
  ctx: QueryCtx,
  {
    audience,
    contextKey,
    subject,
    visibilityCache,
  }: {
    audience: KnowledgeContextExpertAudience;
    contextKey: string;
    subject: ContextExpertSubjectSelector;
    visibilityCache: Map<string, Promise<boolean>>;
  },
) {
  const orbitEligibilityCache = new Map<string, Promise<boolean>>();
  const rows = await listAggregateRowsForSubject(ctx, subject, contextKey);

  const legacyRows: ContextExpertiseAggregateRow[] = [];
  for (const row of rows) {
    if (
      !isAudienceScopedAggregate(row) &&
      (await isAggregateVisibleToExpertAudience(ctx, row, audience, {
        globalVisibilityCache: visibilityCache,
        orbitEligibilityCache,
      }))
    ) {
      legacyRows.push(row);
    }
  }

  return legacyRows;
}

async function hasAnyScopedAggregateForSubject(
  ctx: QueryCtx,
  subject: ContextExpertSubjectSelector,
  contextKey: string,
) {
  const rows = await listAggregateRowsForSubject(ctx, subject, contextKey);

  return rows.some(isAudienceScopedAggregate);
}

async function listAggregateRowsForSubject(
  ctx: QueryCtx,
  subject: ContextExpertSubjectSelector,
  contextKey: string,
) {
  if (subject.subjectKind === "user") {
    return await ctx.db
      .query("contextExpertiseAggregates")
      .withIndex("by_subjectUserId_and_contextKey", (q) =>
        q.eq("subjectUserId", subject.subjectUserId).eq("contextKey", contextKey),
      )
      .take(CONTEXT_EXPERTISE_AGGREGATE_CANDIDATE_LIMIT);
  }

  return await ctx.db
    .query("contextExpertiseAggregates")
    .withIndex("by_subjectPersonReferentId_and_contextKey", (q) =>
      q
        .eq("subjectPersonReferentId", subject.subjectPersonReferentId)
        .eq("contextKey", contextKey),
    )
    .take(CONTEXT_EXPERTISE_AGGREGATE_CANDIDATE_LIMIT);
}

function getAudienceScopes(
  audience: KnowledgeContextExpertAudience,
): ContextExpertiseAudienceScope[] {
  if (audience.kind === "global") {
    return [{ audienceScopeKind: "public", audienceScopeTargetKey: "public" }];
  }

  return [
    { audienceScopeKind: "public", audienceScopeTargetKey: "public" },
    ...Array.from(audience.organizationReferentIds).map(
      (organizationReferentId) => ({
        audienceScopeKind: "organization" as const,
        audienceScopeTargetKey: organizationReferentId,
      }),
    ),
  ];
}

function isAudienceScopedAggregate(aggregate: ContextExpertiseAggregateRow) {
  return (
    aggregate.audienceScopeKind !== undefined &&
    aggregate.audienceScopeTargetKey !== undefined
  );
}

function getContextExpertSubjectSelector({
  subjectPersonReferentId,
  subjectUserId,
}: {
  subjectPersonReferentId?: Id<"referents">;
  subjectUserId?: Id<"users">;
}): ContextExpertSubjectSelector {
  if (subjectUserId !== undefined && subjectPersonReferentId !== undefined) {
    throw new Error("Context Expert detail can only be requested for one subject.");
  }

  if (subjectUserId !== undefined) {
    return { subjectKind: "user", subjectUserId };
  }

  if (subjectPersonReferentId !== undefined) {
    return { subjectKind: "person", subjectPersonReferentId };
  }

  throw new Error("Context Expert detail requires a subject.");
}

function getAggregateSubjectSelector(
  aggregate: Pick<
    ContextExpertiseAggregateRow,
    "subjectPersonReferentId" | "subjectUserId"
  >,
): ContextExpertSubjectSelector | null {
  if (aggregate.subjectUserId !== undefined) {
    return {
      subjectKind: "user",
      subjectUserId: aggregate.subjectUserId,
    };
  }

  if (aggregate.subjectPersonReferentId !== undefined) {
    return {
      subjectKind: "person",
      subjectPersonReferentId: aggregate.subjectPersonReferentId,
    };
  }

  return null;
}

function getSubjectKey(subject: ContextExpertSubjectSelector) {
  return subject.subjectKind === "user"
    ? `user:${subject.subjectUserId}`
    : `person:${subject.subjectPersonReferentId}`;
}

function getAggregateSubjectSortKey(
  aggregate: Pick<
    ContextExpertiseAggregateRow,
    "subjectPersonReferentId" | "subjectUserId"
  >,
) {
  const subject = getAggregateSubjectSelector(aggregate);
  return subject === null ? "" : getSubjectKey(subject);
}

function getAggregateAudienceScopedSubjectKey(
  aggregate: ContextExpertiseAggregateRow,
) {
  const subject = getAggregateSubjectSelector(aggregate);
  if (subject === null) {
    return null;
  }

  return `${getSubjectKey(subject)}:${aggregate.audienceScopeKind ?? ""}:${
    aggregate.audienceScopeTargetKey ?? ""
  }`;
}

function combineAggregateRowsBySubject(
  rows: ContextExpertiseAggregateRow[],
): ContextExpertiseAggregateSummary[] {
  const aggregates = new Map<
    string,
    ContextExpertiseAggregateSummary & { signalScore: number }
  >();

  for (const row of [...rows].sort(compareAggregateRowsForMerge)) {
    const subject = getAggregateSubjectSelector(row);
    if (subject === null) {
      continue;
    }

    const subjectKey = getSubjectKey(subject);
    const existing = aggregates.get(subjectKey);
    if (!existing) {
      aggregates.set(subjectKey, {
        ...(row.subjectUserId === undefined
          ? {}
          : { subjectUserId: row.subjectUserId }),
        ...(row.subjectPersonReferentId === undefined
          ? {}
          : { subjectPersonReferentId: row.subjectPersonReferentId }),
        contextKey: row.contextKey,
        contextTagIds: row.contextTagIds,
        contextExpertiseScore: row.contextExpertiseScore,
        contextExpertiseMaturity: row.contextExpertiseMaturity,
        evidenceCount: row.evidenceCount,
        feedbackCount: row.feedbackCount,
        latestEvidenceAt: row.latestEvidenceAt,
        postCount: row.postCount,
        signalScore: getAggregateSignalScore(row),
        topSupportingEntryIds: row.topSupportingEntryIds,
      });
      continue;
    }

    existing.evidenceCount += row.evidenceCount;
    existing.feedbackCount += row.feedbackCount;
    existing.postCount += row.postCount;
    existing.latestEvidenceAt = Math.max(
      existing.latestEvidenceAt,
      row.latestEvidenceAt,
    );
    existing.signalScore = Math.max(
      existing.signalScore,
      getAggregateSignalScore(row),
    );
    existing.contextExpertiseMaturity = getContextExpertiseMaturity(
      existing.evidenceCount,
    );
    existing.contextExpertiseScore = getAggregateContextExpertiseScore(
      existing.signalScore,
      existing.evidenceCount,
    );
    existing.topSupportingEntryIds = mergeTopSupportingEntryIds(
      existing.topSupportingEntryIds,
      row.topSupportingEntryIds,
    );
  }

  return Array.from(aggregates.values()).map(({ signalScore: _signalScore, ...row }) => row);
}

function compareAggregateRowsForMerge(
  first: ContextExpertiseAggregateRow,
  second: ContextExpertiseAggregateRow,
) {
  return (
    second.contextExpertiseScore - first.contextExpertiseScore ||
    second.contextExpertiseMaturity - first.contextExpertiseMaturity ||
    second.latestEvidenceAt - first.latestEvidenceAt ||
    compareStrings(getAggregateSubjectSortKey(first), getAggregateSubjectSortKey(second))
  );
}

function mergeTopSupportingEntryIds(
  currentEntryIds: Array<Id<"knowledgeEntries">>,
  nextEntryIds: Array<Id<"knowledgeEntries">>,
) {
  const merged: Array<Id<"knowledgeEntries">> = [];
  for (const entryId of [...currentEntryIds, ...nextEntryIds]) {
    if (!merged.includes(entryId)) {
      merged.push(entryId);
    }
    if (merged.length >= MAX_EXPERT_DETAIL_CONTRIBUTION_LIMIT) {
      break;
    }
  }

  return merged;
}

async function getKnowledgeContextExpertAudience(
  ctx: QueryCtx,
  expertScope: KnowledgeContextExpertScope | undefined,
): Promise<KnowledgeContextExpertAudience | null> {
  if (expertScope === undefined) {
    return null;
  }

  if (expertScope === "global") {
    await requireAppAccess(ctx);
    return { kind: "global" };
  }

  const access = await requireAppAccess(ctx);
  return {
    kind: "orbit",
    organizationReferentIds: new Set(
      access.organizations.map(
        (organization) => organization.organizationReferentId,
      ),
    ),
    viewerUserId: access.userId,
  };
}

async function isAggregateVisibleToExpertAudience(
  ctx: QueryCtx,
  aggregate: ContextExpertiseAggregateRow,
  audience: KnowledgeContextExpertAudience | null,
  {
    globalVisibilityCache,
    orbitEligibilityCache,
  }: {
    globalVisibilityCache: Map<string, Promise<boolean>>;
    orbitEligibilityCache: Map<string, Promise<boolean>>;
  },
) {
  if (audience === null) {
    return true;
  }

  if (audience.kind === "global") {
    if (aggregate.visibilityKind !== "public") {
      return false;
    }

    const subject = getAggregateSubjectSelector(aggregate);
    if (subject === null) {
      return false;
    }

    return await isSubjectVisibleToExpertAudience(ctx, subject, audience, {
      globalVisibilityCache,
      orbitEligibilityCache,
    });
  }

  const subject = getAggregateSubjectSelector(aggregate);
  if (subject === null) {
    return false;
  }

  return (
    isVisibilityScopeAccessibleToExpertAudience(
      aggregate.visibilityKind,
      aggregate.visibilityTargetKey,
      audience,
    ) &&
    (await isSubjectVisibleToExpertAudience(ctx, subject, audience, {
      globalVisibilityCache,
      orbitEligibilityCache,
    }))
  );
}

async function isSubjectVisibleToExpertAudience(
  ctx: QueryCtx,
  subject: ContextExpertSubjectSelector,
  audience: KnowledgeContextExpertAudience,
  {
    globalVisibilityCache,
    orbitEligibilityCache,
  }: {
    globalVisibilityCache: Map<string, Promise<boolean>>;
    orbitEligibilityCache: Map<string, Promise<boolean>>;
  },
) {
  if (subject.subjectKind === "person") {
    return (
      audience.kind === "global" &&
      (await isPersonGlobalExpertVisibilityAllowed(
        ctx,
        subject.subjectPersonReferentId,
        globalVisibilityCache,
      ))
    );
  }

  if (audience.kind === "global") {
    return await getGlobalExpertVisibilityEnabled(
      ctx,
      subject.subjectUserId,
      globalVisibilityCache,
    );
  }

  return await isSubjectInExpertOrbit(
    ctx,
    subject.subjectUserId,
    audience,
    orbitEligibilityCache,
  );
}

async function isSubjectInExpertOrbit(
  ctx: QueryCtx,
  subjectUserId: Id<"users">,
  audience: Extract<KnowledgeContextExpertAudience, { kind: "orbit" }>,
  cache: Map<string, Promise<boolean>>,
) {
  if (subjectUserId === audience.viewerUserId) {
    return true;
  }

  const cacheKey = subjectUserId;
  const cached = cache.get(cacheKey);
  if (cached) {
    return await cached;
  }

  const eligibility = (async () => {
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_memberUserId_and_membershipStatus", (q) =>
        q.eq("memberUserId", subjectUserId).eq("membershipStatus", "active"),
      )
      .take(50);

    return memberships.some(
      (membership) =>
        membership.targetKind === "organization" &&
        membership.organizationReferentId !== undefined &&
        audience.organizationReferentIds.has(membership.organizationReferentId),
    );
  })();
  cache.set(cacheKey, eligibility);

  return await eligibility;
}

async function getGlobalExpertVisibilityEnabled(
  ctx: QueryCtx,
  subjectUserId: Id<"users">,
  cache: Map<string, Promise<boolean>>,
) {
  const cacheKey = `user:${subjectUserId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return await cached;
  }

  const visibility = (async () => {
    const settings = await ctx.db
      .query("contextExpertiseVisibilitySettings")
      .withIndex("by_userId", (q) => q.eq("userId", subjectUserId))
      .unique();

    return settings?.globalExpertVisibilityEnabled ?? false;
  })();
  cache.set(cacheKey, visibility);

  return await visibility;
}

async function isPersonGlobalExpertVisibilityAllowed(
  ctx: QueryCtx,
  personReferentId: Id<"referents">,
  cache: Map<string, Promise<boolean>>,
) {
  const cacheKey = `person:${personReferentId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return await cached;
  }

  const visibility = (async () => {
    const setting = await ctx.db
      .query("personContextExpertiseVisibilitySettings")
      .withIndex("by_personReferentId", (q) =>
        q.eq("personReferentId", personReferentId),
      )
      .unique();

    return setting === null;
  })();
  cache.set(cacheKey, visibility);

  return await visibility;
}

function isEntryVisibleInContextExpertDetail(
  entry: Doc<"knowledgeEntries">,
  audience: KnowledgeContextExpertAudience | null,
) {
  return isVisibilityScopeAccessibleToExpertAudience(
    entry.visibilityKind,
    entry.visibilityTargetKey,
    audience,
  );
}

function isVisibilityScopeAccessibleToExpertAudience(
  visibilityKind: Doc<"knowledgeEntries">["visibilityKind"],
  visibilityTargetKey: string,
  audience: KnowledgeContextExpertAudience | null,
) {
  if (visibilityKind === "public") {
    return true;
  }

  if (audience?.kind === "orbit" && visibilityKind === "organization") {
    return audience.organizationReferentIds.has(
      visibilityTargetKey as Id<"referents">,
    );
  }

  return false;
}

function toAggregateKnowledgeContextExpert(
  aggregate: ContextExpertiseAggregateSummary,
  contributor: ContributorSummary,
): KnowledgeContextExpert & { latestEvidenceAt: number } {
  const expert = {
    id: contributor.id,
    name: contributor.name,
    ...(contributor.subjectKind === undefined
      ? {}
      : { subjectKind: contributor.subjectKind }),
    ...(contributor.subjectUserId === undefined
      ? {}
      : { subjectUserId: contributor.subjectUserId }),
    ...(contributor.subjectPersonReferentId === undefined
      ? {}
      : { subjectPersonReferentId: contributor.subjectPersonReferentId }),
    contextExpertiseMaturity: aggregate.contextExpertiseMaturity,
    contextExpertiseScore: aggregate.contextExpertiseScore,
    ...(aggregate.contextMatchKind === undefined
      ? {}
      : { contextMatchKind: aggregate.contextMatchKind }),
    evidenceCount: aggregate.evidenceCount,
    feedbackCount: aggregate.feedbackCount,
    latestEvidenceAt: aggregate.latestEvidenceAt,
    postCount: aggregate.postCount,
  };

  return contributor.href === undefined
    ? expert
    : {
        ...expert,
        href: contributor.href,
      };
}

function getAggregateSignalScore(aggregate: ContextExpertiseAggregateRow) {
  return getEstimatedContextExpertiseSignalScoreFromAggregate(aggregate);
}

function getAggregateContextExpertiseScore(
  signalScore: number,
  evidenceCount: number,
) {
  return getContextExpertiseAggregateScore(signalScore, evidenceCount);
}

function toKnowledgeContextExpert(
  aggregate: ContributorSummary & {
    latestUpdatedAt: number;
    maxHumanWeight: number;
    postCount: number;
    totalHumanWeight: number;
  },
): KnowledgeContextExpert & { latestUpdatedAt: number } {
  const averageHumanWeight = aggregate.totalHumanWeight / aggregate.postCount;
  const expert = {
    id: aggregate.id,
    name: aggregate.name,
    contextExpertiseMaturity: getContextExpertiseMaturity(aggregate.postCount),
    latestUpdatedAt: aggregate.latestUpdatedAt,
    contextExpertiseScore: getContextExpertiseScore(
      averageHumanWeight,
      aggregate.postCount,
      aggregate.maxHumanWeight,
    ),
    evidenceCount: aggregate.postCount,
    feedbackCount: 0,
    postCount: aggregate.postCount,
  };

  return aggregate.href === undefined
    ? expert
    : {
        ...expert,
        href: aggregate.href,
      };
}

function getContextExpertiseScore(
  averageHumanWeight: number,
  postCount: number,
  maxHumanWeight: number,
) {
  // Temporary heuristic until durable Context Expertise Evidence drives this score.
  return Math.round(
    averageHumanWeight +
      getContextExpertiseEvidenceCountScoreBonus(postCount) +
      Math.max(0, maxHumanWeight - averageHumanWeight) * 0.1,
  );
}

function getUserDisplayName(user: Doc<"users">) {
  const name = user.name?.trim();
  if (name) {
    return name;
  }

  if (user.email) {
    return formatEmailDisplayName(user.email);
  }

  return "Unknown Contributor";
}

function formatEmailDisplayName(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const parts = localPart
    .split(/[._+-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return email;
  }

  return parts.map(formatNamePart).join(" ");
}

function formatNamePart(part: string) {
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function compareEntries(
  first: Doc<"knowledgeEntries">,
  second: Doc<"knowledgeEntries">,
) {
  return (
    compareEntryHumanWeight(first, second) ||
    second.updatedAt - first.updatedAt ||
    compareStrings(first.title, second.title) ||
    compareStrings(first._id, second._id)
  );
}

function compareEntryHumanWeight(
  first: Doc<"knowledgeEntries">,
  second: Doc<"knowledgeEntries">,
) {
  return (
    getHumanWeightFeedPriority(second.knowledgeType, second.humanWeight) -
    getHumanWeightFeedPriority(first.knowledgeType, first.humanWeight)
  );
}

function compareKnowledgeContextExperts(
  first: KnowledgeContextExpert & {
    latestEvidenceAt?: number;
    latestUpdatedAt?: number;
  },
  second: KnowledgeContextExpert & {
    latestEvidenceAt?: number;
    latestUpdatedAt?: number;
  },
) {
  return (
    second.contextExpertiseScore - first.contextExpertiseScore ||
    second.contextExpertiseMaturity - first.contextExpertiseMaturity ||
    second.evidenceCount - first.evidenceCount ||
    second.postCount - first.postCount ||
    second.feedbackCount - first.feedbackCount ||
    getExpertFreshness(second) - getExpertFreshness(first) ||
    compareStrings(first.name, second.name) ||
    compareStrings(first.id, second.id)
  );
}

function getExpertFreshness(
  expert: KnowledgeContextExpert & {
    latestEvidenceAt?: number;
    latestUpdatedAt?: number;
  },
) {
  return expert.latestEvidenceAt ?? expert.latestUpdatedAt ?? 0;
}

function removeExpertSortFields(
  expert: KnowledgeContextExpert & {
    latestEvidenceAt?: number;
    latestUpdatedAt?: number;
  },
): KnowledgeContextExpert {
  const cleanExpert: KnowledgeContextExpert = {
    id: expert.id,
    name: expert.name,
    ...(expert.subjectKind === undefined
      ? {}
      : { subjectKind: expert.subjectKind }),
    ...(expert.subjectUserId === undefined
      ? {}
      : { subjectUserId: expert.subjectUserId }),
    ...(expert.subjectPersonReferentId === undefined
      ? {}
      : { subjectPersonReferentId: expert.subjectPersonReferentId }),
    contextExpertiseMaturity: expert.contextExpertiseMaturity,
    contextExpertiseScore: expert.contextExpertiseScore,
    ...(expert.contextMatchKind === undefined
      ? {}
      : { contextMatchKind: expert.contextMatchKind }),
    evidenceCount: expert.evidenceCount,
    feedbackCount: expert.feedbackCount,
    postCount: expert.postCount,
  };

  return expert.href === undefined
    ? cleanExpert
    : {
        ...cleanExpert,
        href: expert.href,
      };
}

async function getContributorSummary(
  ctx: QueryCtx,
  aggregate: Pick<
    ContextExpertiseAggregateSummary,
    "subjectPersonReferentId" | "subjectUserId"
  >,
  contributorCache: Map<string, Promise<ContributorSummary>>,
): Promise<ContributorSummary> {
  const subject = getAggregateSubjectSelector(aggregate);
  if (subject === null) {
    return {
      id: "unknown",
      name: "Unknown Contributor",
    };
  }

  const cacheKey = getSubjectKey(subject);
  const cachedContributor = contributorCache.get(cacheKey);
  if (cachedContributor) {
    return await cachedContributor;
  }

  const contributor =
    subject.subjectKind === "user"
      ? loadUserContributorSummary(ctx, subject.subjectUserId)
      : loadPersonContributorSummary(ctx, subject.subjectPersonReferentId);
  contributorCache.set(cacheKey, contributor);
  return await contributor;
}

async function getUserContributorSummary(
  ctx: QueryCtx,
  userId: Id<"users"> | undefined,
  contributorCache: Map<string, Promise<ContributorSummary>>,
): Promise<ContributorSummary> {
  if (userId === undefined) {
    return {
      id: "unknown",
      name: "Unknown Contributor",
    };
  }

  const cacheKey = `user:${userId}`;
  const cachedContributor = contributorCache.get(cacheKey);
  if (cachedContributor) {
    return await cachedContributor;
  }

  const contributor = loadUserContributorSummary(ctx, userId);
  contributorCache.set(cacheKey, contributor);
  return await contributor;
}

async function loadUserContributorSummary(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<ContributorSummary> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return {
      id: userId,
      name: "Unknown Contributor",
    };
  }

  return {
    id: userId,
    name: getUserDisplayName(user),
  };
}

async function loadPersonContributorSummary(
  ctx: QueryCtx,
  personReferentId: Id<"referents">,
): Promise<ContributorSummary> {
  const referent = await ctx.db.get(personReferentId);
  if (!referent || referent.knowledgeType !== "person") {
    return {
      id: getSubjectKey({
        subjectKind: "person",
        subjectPersonReferentId: personReferentId,
      }),
      name: "Unknown Person",
      subjectKind: "person",
      subjectPersonReferentId: personReferentId,
    };
  }

  const tag = await ctx.db
    .query("tags")
    .withIndex("by_referentId", (q) => q.eq("referentId", personReferentId))
    .first();
  const summary = {
    id: getSubjectKey({
      subjectKind: "person",
      subjectPersonReferentId: personReferentId,
    }),
    name: referent.canonicalName,
    subjectKind: "person" as const,
    subjectPersonReferentId: personReferentId,
  };

  return tag === null
    ? summary
    : {
        ...summary,
        href: `/goto/${encodeURIComponent(tag.lookupKey)}`,
      };
}

async function summarizeSlot(
  ctx: QueryCtx,
  slot: Doc<"knowledgeSlots">,
): Promise<KnowledgeSlotSummary> {
  return {
    id: slot._id,
    title: slot.title,
    requestedKnowledgeType: slot.requestedKnowledgeType,
    ...(slot.promptText === undefined ? {} : { promptText: slot.promptText }),
    status: slot.status,
    contextPreviewTagLabels: await getSlotContextPreviewTagLabels(ctx, slot._id),
    targetLabel: await getSlotTargetLabel(ctx, slot),
    ...(slot.dueAt === undefined ? {} : { dueAt: slot.dueAt }),
    href: `/slots/${slot._id}`,
  };
}

async function getSlotContextPreviewTagLabels(
  ctx: QueryCtx,
  slotId: Id<"knowledgeSlots">,
) {
  const slotTags = await ctx.db
    .query("slotTags")
    .withIndex("by_slotId_and_tagId", (q) => q.eq("slotId", slotId))
    .take(MAX_CONTEXT_PREVIEW_TAG_LABELS);
  const labels = [];

  for (const slotTag of slotTags) {
    const tag = await ctx.db.get(slotTag.tagId);
    if (tag) {
      labels.push(tag.label);
    }
  }

  return labels;
}

async function getSlotTargetLabel(
  ctx: QueryCtx,
  slot: Doc<"knowledgeSlots">,
) {
  if (slot.targetKind === "public") {
    return "Public";
  }

  if (slot.targetKind === "user") {
    return "Assigned user";
  }

  const targetReferentId =
    slot.targetKind === "person"
      ? slot.targetPersonReferentId
      : slot.targetKind === "organization"
        ? slot.targetOrganizationReferentId
        : slot.targetGroupReferentId;
  if (!targetReferentId) {
    return "Unassigned";
  }

  const referent = await ctx.db.get(targetReferentId);
  return referent?.canonicalName ?? "Unassigned";
}

function compareAnswerItems(
  first: AnswerFeedItem & { kind: "answer" },
  second: AnswerFeedItem & { kind: "answer" },
) {
  return (
    compareAnswerHumanWeight(first, second) ||
    second.entry.updatedAt - first.entry.updatedAt ||
    compareStrings(first.entry.title, second.entry.title) ||
    compareStrings(first.entry.id, second.entry.id)
  );
}

function compareAnswerHumanWeight(
  first: AnswerFeedItem & { kind: "answer" },
  second: AnswerFeedItem & { kind: "answer" },
) {
  return (
    getHumanWeightFeedPriority(
      second.entry.knowledgeType,
      second.entry.humanWeight,
      second.entry.evidenceMaturity,
    ) -
    getHumanWeightFeedPriority(
      first.entry.knowledgeType,
      first.entry.humanWeight,
      first.entry.evidenceMaturity,
    )
  );
}

function compareSlotItems(
  first: AnswerFeedItem & { kind: "slot" },
  second: AnswerFeedItem & { kind: "slot" },
) {
  return (
    getSlotStatusOrder(first.slot.status) -
      getSlotStatusOrder(second.slot.status) ||
    (first.slot.dueAt ?? Number.POSITIVE_INFINITY) -
      (second.slot.dueAt ?? Number.POSITIVE_INFINITY) ||
    compareStrings(first.slot.title, second.slot.title) ||
    compareStrings(first.slot.id, second.slot.id)
  );
}

function getSlotStatusOrder(status: Doc<"knowledgeSlots">["status"]) {
  if (status === "overdue") {
    return 0;
  }

  if (status === "open") {
    return 1;
  }

  if (status === "fulfilled") {
    return 2;
  }

  return 3;
}

function normalizeActiveTagIds(activeTagIds: TagId[]) {
  const uniqueTagIds = normalizeContextExpertiseTagIds(activeTagIds) as TagId[];
  if (uniqueTagIds.length > MAX_ACTIVE_TAGS) {
    throw new Error(`Answer Feed supports at most ${MAX_ACTIVE_TAGS} active Tags.`);
  }

  return uniqueTagIds;
}

function getContextKey(tagIds: TagId[]) {
  return getContextExpertiseContextKey(tagIds);
}

function normalizeLimit(
  value: number | undefined,
  defaultValue: number,
  maxValue: number,
) {
  if (value === undefined) {
    return defaultValue;
  }

  return Math.max(0, Math.min(Math.floor(value), maxValue));
}

function getCandidateLimit(limit: number) {
  return Math.min(
    MAX_CANDIDATE_ITEMS,
    Math.max(MIN_CANDIDATE_ITEMS, limit * CANDIDATE_MULTIPLIER),
  );
}

function getAggregateExpertCandidateLimit(limit: number) {
  return Math.min(
    MAX_CANDIDATE_ITEMS,
    Math.max(CONTEXT_EXPERTISE_AGGREGATE_CANDIDATE_LIMIT, limit),
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

function getActiveTagLookupKey(tag: ActiveTagSnapshot) {
  return normalizeLookupKey(tag.canonicalKey || tag.id || tag.label);
}

function normalizeLookupKey(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
}
