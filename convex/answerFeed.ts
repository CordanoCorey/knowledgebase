import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";

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
const EXPERT_CONTRIBUTION_BONUS = 12;

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
  humanWeight: v.number(),
  href: v.string(),
  updatedAt: v.number(),
});

const knowledgeContextExpert = v.object({
  id: v.string(),
  name: v.string(),
  href: v.optional(v.string()),
  averageHumanWeight: v.number(),
  contributionCount: v.number(),
  reliabilityScore: v.number(),
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
};

type KnowledgeContextExpert = ContributorSummary & {
  averageHumanWeight: number;
  contributionCount: number;
  reliabilityScore: number;
};

type KnowledgeEntrySummary = {
  contributor: ContributorSummary;
  id: string;
  title: string;
  knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
  previewText: string;
  primaryTagLabel: string;
  contextPreviewTagLabels: string[];
  humanWeight: number;
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

export const listExpertsForActiveTags = query({
  args: {
    activeTagIds: v.array(v.id("tags")),
    expertLimit: v.optional(v.number()),
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

    const entries = await getMatchingAnswerEntries(
      ctx,
      activeTagIds,
      MAX_CANDIDATE_ITEMS,
    );

    return await summarizeKnowledgeContextExperts(ctx, entries, expertLimit);
  },
});

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
      ? await ctx.db
          .query("knowledgeEntries")
          .withIndex("by_humanWeight_and_updatedAt")
          .order("desc")
          .take(candidateLimit)
      : await getEntryCandidatesForActiveTags(ctx, activeTagIds, candidateLimit);
  const matchingEntries = [];

  for (const entry of candidateEntries) {
    if (await entryContainsAllTags(ctx, entry._id, activeTagIds)) {
      matchingEntries.push(entry);
    }
  }

  return matchingEntries.sort(compareEntries).slice(0, limit);
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
  return {
    contributor: await getContributorSummary(
      ctx,
      entry.createdByUserId,
      contributorCache,
    ),
    id: entry._id,
    title: entry.title,
    knowledgeType: entry.knowledgeType,
    previewText: entry.previewText,
    primaryTagLabel: entry.primaryTagLabel,
    contextPreviewTagLabels: entry.contextPreviewTagLabels,
    humanWeight: entry.humanWeight,
    href: `/entries/${entry._id}`,
    updatedAt: entry.updatedAt,
  };
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
      contributionCount: number;
      latestUpdatedAt: number;
      maxHumanWeight: number;
      totalHumanWeight: number;
    }
  >();

  for (const entry of entries) {
    if (entry.createdByUserId === undefined) {
      continue;
    }

    const contributor = await getContributorSummary(
      ctx,
      entry.createdByUserId,
      contributorCache,
    );
    const aggregate = aggregates.get(contributor.id);
    if (aggregate) {
      aggregate.contributionCount += 1;
      aggregate.latestUpdatedAt = Math.max(aggregate.latestUpdatedAt, entry.updatedAt);
      aggregate.maxHumanWeight = Math.max(aggregate.maxHumanWeight, entry.humanWeight);
      aggregate.totalHumanWeight += entry.humanWeight;
      continue;
    }

    aggregates.set(contributor.id, {
      ...contributor,
      contributionCount: 1,
      latestUpdatedAt: entry.updatedAt,
      maxHumanWeight: entry.humanWeight,
      totalHumanWeight: entry.humanWeight,
    });
  }

  return Array.from(aggregates.values())
    .map(toKnowledgeContextExpert)
    .sort(compareKnowledgeContextExperts)
    .slice(0, limit)
    .map(removeExpertSortFields);
}

function toKnowledgeContextExpert(
  aggregate: ContributorSummary & {
    contributionCount: number;
    latestUpdatedAt: number;
    maxHumanWeight: number;
    totalHumanWeight: number;
  },
): KnowledgeContextExpert & { latestUpdatedAt: number } {
  const averageHumanWeight =
    aggregate.totalHumanWeight / aggregate.contributionCount;
  const expert = {
    id: aggregate.id,
    name: aggregate.name,
    averageHumanWeight: Math.round(averageHumanWeight),
    contributionCount: aggregate.contributionCount,
    latestUpdatedAt: aggregate.latestUpdatedAt,
    reliabilityScore: getReliabilityScore(
      averageHumanWeight,
      aggregate.contributionCount,
      aggregate.maxHumanWeight,
    ),
  };

  return aggregate.href === undefined
    ? expert
    : {
        ...expert,
        href: aggregate.href,
      };
}

function getReliabilityScore(
  averageHumanWeight: number,
  contributionCount: number,
  maxHumanWeight: number,
) {
  // Best guess: reliable experts have consistently high Human Weight plus repeat contributions.
  return Math.round(
    averageHumanWeight +
      Math.min(contributionCount, 5) * EXPERT_CONTRIBUTION_BONUS +
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
    second.humanWeight - first.humanWeight ||
    second.updatedAt - first.updatedAt ||
    compareStrings(first.title, second.title) ||
    compareStrings(first._id, second._id)
  );
}

function compareKnowledgeContextExperts(
  first: KnowledgeContextExpert & { latestUpdatedAt?: number },
  second: KnowledgeContextExpert & { latestUpdatedAt?: number },
) {
  return (
    second.reliabilityScore - first.reliabilityScore ||
    second.averageHumanWeight - first.averageHumanWeight ||
    second.contributionCount - first.contributionCount ||
    (second.latestUpdatedAt ?? 0) - (first.latestUpdatedAt ?? 0) ||
    compareStrings(first.name, second.name) ||
    compareStrings(first.id, second.id)
  );
}

function removeExpertSortFields(
  expert: KnowledgeContextExpert & { latestUpdatedAt?: number },
): KnowledgeContextExpert {
  const cleanExpert: KnowledgeContextExpert = {
    id: expert.id,
    name: expert.name,
    averageHumanWeight: expert.averageHumanWeight,
    contributionCount: expert.contributionCount,
    reliabilityScore: expert.reliabilityScore,
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
  userId: Id<"users"> | undefined,
  contributorCache: Map<string, Promise<ContributorSummary>>,
): Promise<ContributorSummary> {
  if (userId === undefined) {
    return {
      id: "unknown",
      name: "Unknown Contributor",
    };
  }

  const cacheKey = userId;
  const cachedContributor = contributorCache.get(cacheKey);
  if (cachedContributor) {
    return await cachedContributor;
  }

  const contributor = loadContributorSummary(ctx, userId);
  contributorCache.set(cacheKey, contributor);
  return await contributor;
}

async function loadContributorSummary(
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
    second.entry.humanWeight - first.entry.humanWeight ||
    second.entry.updatedAt - first.entry.updatedAt ||
    compareStrings(first.entry.title, second.entry.title) ||
    compareStrings(first.entry.id, second.entry.id)
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
  const uniqueTagIds = Array.from(new Set(activeTagIds)).sort(compareStrings);
  if (uniqueTagIds.length > MAX_ACTIVE_TAGS) {
    throw new Error(`Answer Feed supports at most ${MAX_ACTIVE_TAGS} active Tags.`);
  }

  return uniqueTagIds;
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

function compareStrings(left: string, right: string) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
