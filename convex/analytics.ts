import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { parseBiblePassageReference } from "./lib/scriptureReferences";

const DEFAULT_POPULAR_LIMIT = 6;
const DEFAULT_RECENT_LIMIT = 8;
const DEFAULT_BIBLE_CONTEXT_LIMIT = 4;
const DEFAULT_TREND_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;
const MAX_POPULAR_LIMIT = 12;
const MAX_RECENT_LIMIT = 20;
const MAX_BIBLE_CONTEXT_LIMIT = 8;
const MAX_TARGET_KEY_LENGTH = 180;
const MAX_RAW_PATH_LENGTH = 360;
const MAX_ACTIVE_TAG_KEYS = 20;
const MAX_CONTEXT_LABELS = 4;
const MAX_RECENT_TREND_VISITS = 100;
const MAX_BIBLE_CONTEXT_CANDIDATES = 24;
const MAX_SLOT_TAGS_FOR_CONTEXT = 12;
const MAX_SLOT_CANDIDATES = 80;
const MAX_ANSWER_CANDIDATES = 80;

const pageType = v.union(
  v.literal("dashboard"),
  v.literal("referent"),
  v.literal("context"),
);

const analyticsTargetKind = v.union(
  v.literal("dashboard"),
  v.literal("tag"),
  v.literal("biblePassage"),
  v.literal("context"),
);

const navigatorUsageKind = v.union(
  v.literal("select"),
  v.literal("deselect"),
  v.literal("explore"),
  v.literal("contribute"),
);

const contextTrendKind = v.union(
  v.literal("quiet"),
  v.literal("popular"),
  v.literal("needsContribution"),
  v.literal("popularAndNeedsContribution"),
);

const targetSummary = v.object({
  href: v.string(),
  label: v.string(),
  lastVisitedAt: v.number(),
  pageType,
  targetKey: v.string(),
  targetKind: analyticsTargetKind,
  totalVisits: v.number(),
});

const pageVisitSummary = v.object({
  href: v.string(),
  id: v.id("pageVisitEvents"),
  label: v.string(),
  pageType,
  rawPath: v.string(),
  targetKey: v.string(),
  targetKind: analyticsTargetKind,
  visitedAt: v.number(),
});

const navigatorUsageSummary = v.object({
  activeTagCount: v.number(),
  id: v.id("navigatorUsageEvents"),
  occurredAt: v.number(),
  resolvedTagCount: v.number(),
  usageKind: navigatorUsageKind,
});

const contextTrendSummary = v.object({
  answerCount: v.number(),
  href: v.string(),
  label: v.string(),
  openRequestCount: v.number(),
  overdueRequestCount: v.number(),
  recentVisitCount: v.number(),
  totalVisitCount: v.number(),
  trendKind: contextTrendKind,
  trendScore: v.number(),
});

const dashboardBibleContextSuggestion = v.object({
  href: v.string(),
  label: v.string(),
  latestActivityAt: v.optional(v.number()),
  openRequestCount: v.number(),
  overdueRequestCount: v.number(),
  recentVisitCount: v.number(),
  targetKey: v.string(),
  totalVisitCount: v.number(),
  trendKind: contextTrendKind,
  trendScore: v.number(),
});

type AnalyticsTargetKind = Doc<"pageVisitStats">["targetKind"];
type AnalyticsPageType = Doc<"pageVisitStats">["pageType"];
type PageVisitStat = Doc<"pageVisitStats">;
type PageVisitEvent = Doc<"pageVisitEvents">;
type NavigatorUsageEvent = Doc<"navigatorUsageEvents">;
type ContextTrendKind =
  | "quiet"
  | "popular"
  | "needsContribution"
  | "popularAndNeedsContribution";
type ContextTrendTarget = {
  href: string;
  label: string;
  pageType: AnalyticsPageType;
  targetKey: string;
  targetKind: AnalyticsTargetKind;
};
type ContextTrendMetrics = {
  answerCount: number;
  lastVisitedAt?: number;
  openRequestCount: number;
  overdueRequestCount: number;
  recentVisitCount: number;
  totalVisitCount: number;
};
type BibleContextSuggestion = {
  href: string;
  label: string;
  latestActivityAt?: number;
  openRequestCount: number;
  overdueRequestCount: number;
  recentVisitCount: number;
  targetKey: string;
  totalVisitCount: number;
  trendKind: ContextTrendKind;
  trendScore: number;
};

const TARGET_KINDS: AnalyticsTargetKind[] = [
  "dashboard",
  "tag",
  "biblePassage",
  "context",
];

export const recordPageVisit = mutation({
  args: {
    pageType,
    rawPath: v.string(),
    referentId: v.optional(v.id("referents")),
    tagId: v.optional(v.id("tags")),
    targetKey: v.string(),
    targetKind: analyticsTargetKind,
  },
  returns: v.object({
    eventId: v.id("pageVisitEvents"),
    totalVisits: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);
    const now = Date.now();
    const targetKey = normalizeTargetKey(args.targetKey);
    const rawPath = limitString(args.rawPath.trim() || "/", MAX_RAW_PATH_LENGTH);

    const eventId = await ctx.db.insert("pageVisitEvents", {
      pageType: args.pageType,
      targetKind: args.targetKind,
      targetKey,
      rawPath,
      userId,
      ...(args.tagId === undefined ? {} : { tagId: args.tagId }),
      ...(args.referentId === undefined ? {} : { referentId: args.referentId }),
      visitedAt: now,
    });

    const existingStat = await ctx.db
      .query("pageVisitStats")
      .withIndex("by_pageType_and_targetKind_and_targetKey", (q) =>
        q
          .eq("pageType", args.pageType)
          .eq("targetKind", args.targetKind)
          .eq("targetKey", targetKey),
      )
      .first();

    if (!existingStat) {
      await ctx.db.insert("pageVisitStats", {
        pageType: args.pageType,
        targetKind: args.targetKind,
        targetKey,
        ...(args.tagId === undefined ? {} : { tagId: args.tagId }),
        ...(args.referentId === undefined ? {} : { referentId: args.referentId }),
        totalVisits: 1,
        lastVisitedAt: now,
      });

      return { eventId, totalVisits: 1 };
    }

    const totalVisits = existingStat.totalVisits + 1;
    await ctx.db.patch(existingStat._id, {
      ...(args.tagId === undefined ? {} : { tagId: args.tagId }),
      ...(args.referentId === undefined ? {} : { referentId: args.referentId }),
      totalVisits,
      lastVisitedAt: now,
    });

    return { eventId, totalVisits };
  },
});

export const recordNavigatorUsage = mutation({
  args: {
    activeTagKeys: v.array(v.string()),
    usageKind: navigatorUsageKind,
  },
  returns: v.object({
    activeTagCount: v.number(),
    eventId: v.id("navigatorUsageEvents"),
    resolvedTagCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);
    const activeTagKeys = normalizeActiveTagKeys(args.activeTagKeys);
    const activeTagIds = await resolveActiveTagIds(ctx, activeTagKeys);
    const eventId = await ctx.db.insert("navigatorUsageEvents", {
      usageKind: args.usageKind,
      activeTagIds,
      activeTagCount: activeTagKeys.length,
      userId,
      occurredAt: Date.now(),
    });

    return {
      activeTagCount: activeTagKeys.length,
      eventId,
      resolvedTagCount: activeTagIds.length,
    };
  },
});

export const getMvpSummary = query({
  args: {
    popularLimit: v.optional(v.number()),
    recentLimit: v.optional(v.number()),
  },
  returns: v.object({
    navigatorUsage: v.array(navigatorUsageSummary),
    popularTargets: v.array(targetSummary),
    recentPageVisits: v.array(pageVisitSummary),
  }),
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserId(ctx);
    const popularLimit = normalizeLimit(
      args.popularLimit,
      DEFAULT_POPULAR_LIMIT,
      MAX_POPULAR_LIMIT,
    );
    const recentLimit = normalizeLimit(
      args.recentLimit,
      DEFAULT_RECENT_LIMIT,
      MAX_RECENT_LIMIT,
    );
    const popularTargets = await getPopularTargets(ctx, popularLimit);
    const recentPageVisits = await getRecentPageVisits(ctx, userId, recentLimit);
    const navigatorUsage = await getRecentNavigatorUsage(ctx, userId, recentLimit);

    return {
      navigatorUsage,
      popularTargets,
      recentPageVisits,
    };
  },
});

export const getKnowledgeContextTrend = query({
  args: {
    activeTagKeys: v.array(v.string()),
    recentWindowMs: v.optional(v.number()),
  },
  returns: contextTrendSummary,
  handler: async (ctx, args) => {
    await requireCurrentUserId(ctx);

    const activeTagKeys = normalizeActiveTagKeys(args.activeTagKeys);
    const target = await getContextTrendTarget(ctx, activeTagKeys);
    const activeTagIds = await resolveActiveTagIds(ctx, activeTagKeys);
    const metrics = await getContextTrendMetrics(ctx, target, activeTagIds, {
      recentWindowMs: args.recentWindowMs,
    });
    const trendScore = getTrendScore(metrics);

    return {
      answerCount: metrics.answerCount,
      href: target.href,
      label: target.label,
      openRequestCount: metrics.openRequestCount,
      overdueRequestCount: metrics.overdueRequestCount,
      recentVisitCount: metrics.recentVisitCount,
      totalVisitCount: metrics.totalVisitCount,
      trendKind: getTrendKind(metrics),
      trendScore,
    };
  },
});

export const listDashboardBibleContextSuggestions = query({
  args: {
    limit: v.optional(v.number()),
    recentWindowMs: v.optional(v.number()),
  },
  returns: v.array(dashboardBibleContextSuggestion),
  handler: async (ctx, args): Promise<BibleContextSuggestion[]> => {
    await requireCurrentUserId(ctx);

    const limit = normalizeLimit(
      args.limit,
      DEFAULT_BIBLE_CONTEXT_LIMIT,
      MAX_BIBLE_CONTEXT_LIMIT,
    );
    if (limit < 1) {
      return [];
    }

    const recentWindowMs = normalizeTrendWindowMs(args.recentWindowMs);
    const since = Date.now() - recentWindowMs;
    const targetKeys = await getDashboardBibleContextTargetKeys(ctx);
    const suggestions = [];

    for (const targetKey of targetKeys) {
      suggestions.push(await summarizeBibleContextSuggestion(ctx, targetKey, since));
    }

    return suggestions
      .filter((suggestion) => suggestion.trendKind !== "quiet")
      .sort(compareBibleContextSuggestions)
      .slice(0, limit);
  },
});

async function getPopularTargets(ctx: QueryCtx, limit: number) {
  if (limit < 1) {
    return [];
  }

  const candidates: PageVisitStat[] = [];
  for (const targetKind of TARGET_KINDS) {
    const targetRows = await ctx.db
      .query("pageVisitStats")
      .withIndex("by_targetKind_and_totalVisits", (q) =>
        q.eq("targetKind", targetKind),
      )
      .order("desc")
      .take(limit);
    candidates.push(...targetRows);
  }

  const topTargets = candidates.sort(compareTargetStats).slice(0, limit);
  return await Promise.all(topTargets.map((stat) => summarizeTarget(ctx, stat)));
}

async function getRecentPageVisits(
  ctx: QueryCtx,
  userId: Id<"users">,
  limit: number,
) {
  if (limit < 1) {
    return [];
  }

  const visits = await ctx.db
    .query("pageVisitEvents")
    .withIndex("by_userId_and_visitedAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(limit);

  return await Promise.all(visits.map((visit) => summarizeVisit(ctx, visit)));
}

async function getRecentNavigatorUsage(
  ctx: QueryCtx,
  userId: Id<"users">,
  limit: number,
) {
  if (limit < 1) {
    return [];
  }

  const events = await ctx.db
    .query("navigatorUsageEvents")
    .withIndex("by_userId_and_occurredAt", (q) => q.eq("userId", userId))
    .order("desc")
    .take(limit);

  return events.map(summarizeNavigatorUsage);
}

async function getContextTrendTarget(
  ctx: QueryCtx,
  activeTagKeys: string[],
): Promise<ContextTrendTarget> {
  if (activeTagKeys.length === 0) {
    return {
      href: "/",
      label: "Global Knowledge Context",
      pageType: "dashboard",
      targetKey: "global",
      targetKind: "dashboard",
    };
  }

  if (activeTagKeys.length === 1) {
    const tag = await getTagByKey(ctx, activeTagKeys[0]);
    if (
      tag?.knowledgeType === "biblePassage" ||
      parseBiblePassageReference(activeTagKeys[0])
    ) {
      return {
        href: getTargetHref("biblePassage", activeTagKeys[0]),
        label: await getTargetLabel(ctx, "biblePassage", activeTagKeys[0]),
        pageType: "referent",
        targetKey: activeTagKeys[0],
        targetKind: "biblePassage",
      };
    }
  }

  const targetKey = getContextTargetKey(activeTagKeys);
  return {
    href: getTargetHref("context", targetKey),
    label: await getContextLabel(ctx, targetKey),
    pageType: "context",
    targetKey,
    targetKind: "context",
  };
}

async function getContextTrendMetrics(
  ctx: QueryCtx,
  target: ContextTrendTarget,
  activeTagIds: Id<"tags">[],
  options: { recentWindowMs: number | undefined },
): Promise<ContextTrendMetrics> {
  const recentWindowMs = normalizeTrendWindowMs(options.recentWindowMs);
  const since = Date.now() - recentWindowMs;
  const stat = await getTargetStat(ctx, target);
  const recentVisitCount = await countRecentVisits(
    ctx,
    target.targetKind,
    target.targetKey,
    since,
  );
  const canUseGlobalCounts =
    target.targetKind === "dashboard" && activeTagIds.length === 0;
  const hasResolvedContextTags = activeTagIds.length > 0;
  const requestCounts =
    canUseGlobalCounts || hasResolvedContextTags
      ? await countMatchingOpenRequests(ctx, activeTagIds)
      : { open: 0, overdue: 0 };
  const answerCount =
    canUseGlobalCounts || hasResolvedContextTags
      ? await countMatchingAnswers(ctx, activeTagIds)
      : 0;

  return {
    answerCount,
    lastVisitedAt: stat?.lastVisitedAt,
    openRequestCount: requestCounts.open,
    overdueRequestCount: requestCounts.overdue,
    recentVisitCount,
    totalVisitCount: stat?.totalVisits ?? 0,
  };
}

async function getDashboardBibleContextTargetKeys(ctx: QueryCtx) {
  const targetKeys = new Set<string>();
  const popularTargets = await ctx.db
    .query("pageVisitStats")
    .withIndex("by_targetKind_and_totalVisits", (q) =>
      q.eq("targetKind", "biblePassage"),
    )
    .order("desc")
    .take(MAX_BIBLE_CONTEXT_CANDIDATES);

  for (const target of popularTargets) {
    targetKeys.add(target.targetKey);
  }

  const requestSlots = await getOpenRequestSlotCandidates(ctx, MAX_SLOT_CANDIDATES);
  for (const slot of requestSlots) {
    const bibleTags = await getBiblePassageTagsForSlot(ctx, slot._id);
    for (const tag of bibleTags) {
      targetKeys.add(tag.lookupKey);
    }
  }

  return Array.from(targetKeys).sort(compareStrings);
}

async function summarizeBibleContextSuggestion(
  ctx: QueryCtx,
  targetKey: string,
  since: number,
): Promise<BibleContextSuggestion> {
  const target: ContextTrendTarget = {
    href: getTargetHref("biblePassage", targetKey),
    label: await getTargetLabel(ctx, "biblePassage", targetKey),
    pageType: "referent",
    targetKey,
    targetKind: "biblePassage",
  };
  const tag = await getTagByKey(ctx, targetKey);
  const tagIds = tag ? [tag._id] : [];
  const stat = await getTargetStat(ctx, target);
  const requestCounts =
    tagIds.length > 0
      ? await countMatchingOpenRequests(ctx, tagIds)
      : { open: 0, overdue: 0 };
  const metrics: ContextTrendMetrics = {
    answerCount:
      tagIds.length > 0 ? await countMatchingAnswers(ctx, tagIds) : 0,
    lastVisitedAt: stat?.lastVisitedAt,
    openRequestCount: requestCounts.open,
    overdueRequestCount: requestCounts.overdue,
    recentVisitCount: await countRecentVisits(
      ctx,
      "biblePassage",
      targetKey,
      since,
    ),
    totalVisitCount: stat?.totalVisits ?? 0,
  };

  return {
    href: target.href,
    label: target.label,
    ...(metrics.lastVisitedAt === undefined
      ? {}
      : { latestActivityAt: metrics.lastVisitedAt }),
    openRequestCount: metrics.openRequestCount,
    overdueRequestCount: metrics.overdueRequestCount,
    recentVisitCount: metrics.recentVisitCount,
    targetKey,
    totalVisitCount: metrics.totalVisitCount,
    trendKind: getTrendKind(metrics),
    trendScore: getTrendScore(metrics),
  };
}

async function getTargetStat(ctx: QueryCtx, target: ContextTrendTarget) {
  return await ctx.db
    .query("pageVisitStats")
    .withIndex("by_pageType_and_targetKind_and_targetKey", (q) =>
      q
        .eq("pageType", target.pageType)
        .eq("targetKind", target.targetKind)
        .eq("targetKey", target.targetKey),
    )
    .first();
}

async function countRecentVisits(
  ctx: QueryCtx,
  targetKind: AnalyticsTargetKind,
  targetKey: string,
  since: number,
) {
  const visits = await ctx.db
    .query("pageVisitEvents")
    .withIndex("by_targetKind_and_targetKey_and_visitedAt", (q) =>
      q
        .eq("targetKind", targetKind)
        .eq("targetKey", targetKey)
        .gte("visitedAt", since),
    )
    .take(MAX_RECENT_TREND_VISITS);

  return visits.length;
}

async function countMatchingOpenRequests(
  ctx: QueryCtx,
  activeTagIds: Id<"tags">[],
) {
  const slots =
    activeTagIds.length === 0
      ? await getOpenRequestSlotCandidates(ctx, MAX_SLOT_CANDIDATES)
      : await getSlotCandidatesForActiveTags(
          ctx,
          activeTagIds,
          MAX_SLOT_CANDIDATES,
        );
  let open = 0;
  let overdue = 0;

  for (const slot of slots) {
    if (!(await slotContainsAllTags(ctx, slot._id, activeTagIds))) {
      continue;
    }

    if (slot.status === "overdue") {
      overdue += 1;
    } else if (slot.status === "open") {
      open += 1;
    }
  }

  return { open, overdue };
}

async function countMatchingAnswers(ctx: QueryCtx, activeTagIds: Id<"tags">[]) {
  if (activeTagIds.length === 0) {
    const answers = await ctx.db
      .query("knowledgeEntries")
      .withIndex("by_humanWeight_and_updatedAt")
      .order("desc")
      .take(MAX_ANSWER_CANDIDATES);
    return answers.length;
  }

  const candidates = await getEntryCandidatesForActiveTags(
    ctx,
    activeTagIds,
    MAX_ANSWER_CANDIDATES,
  );
  let answerCount = 0;

  for (const entry of candidates) {
    if (await entryContainsAllTags(ctx, entry._id, activeTagIds)) {
      answerCount += 1;
    }
  }

  return answerCount;
}

async function getOpenRequestSlotCandidates(ctx: QueryCtx, candidateLimit: number) {
  const slots = [];
  const seenSlotIds = new Set<string>();

  for (const status of ["overdue", "open"] as const) {
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

async function getSlotCandidatesForActiveTags(
  ctx: QueryCtx,
  activeTagIds: Id<"tags">[],
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
    if (slot && (slot.status === "open" || slot.status === "overdue")) {
      seenSlotIds.add(row.slotId);
      slots.push(slot);
    }
  }

  return slots;
}

async function getSmallestSlotTagCandidateSet(
  ctx: QueryCtx,
  activeTagIds: Id<"tags">[],
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

async function getEntryCandidatesForActiveTags(
  ctx: QueryCtx,
  activeTagIds: Id<"tags">[],
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
  activeTagIds: Id<"tags">[],
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

async function slotContainsAllTags(
  ctx: QueryCtx,
  slotId: Id<"knowledgeSlots">,
  activeTagIds: Id<"tags">[],
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

async function entryContainsAllTags(
  ctx: QueryCtx,
  entryId: Id<"knowledgeEntries">,
  activeTagIds: Id<"tags">[],
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

async function getBiblePassageTagsForSlot(
  ctx: QueryCtx,
  slotId: Id<"knowledgeSlots">,
) {
  const slotTags = await ctx.db
    .query("slotTags")
    .withIndex("by_slotId_and_tagId", (q) => q.eq("slotId", slotId))
    .take(MAX_SLOT_TAGS_FOR_CONTEXT);
  const bibleTags = [];

  for (const slotTag of slotTags) {
    const tag = await ctx.db.get(slotTag.tagId);
    if (tag?.knowledgeType === "biblePassage") {
      bibleTags.push(tag);
    }
  }

  return bibleTags;
}

async function summarizeTarget(ctx: QueryCtx, stat: PageVisitStat) {
  return {
    href: getTargetHref(stat.targetKind, stat.targetKey),
    label: await getTargetLabel(ctx, stat.targetKind, stat.targetKey),
    lastVisitedAt: stat.lastVisitedAt,
    pageType: stat.pageType,
    targetKey: stat.targetKey,
    targetKind: stat.targetKind,
    totalVisits: stat.totalVisits,
  };
}

async function summarizeVisit(ctx: QueryCtx, visit: PageVisitEvent) {
  return {
    href: getTargetHref(visit.targetKind, visit.targetKey),
    id: visit._id,
    label: await getTargetLabel(ctx, visit.targetKind, visit.targetKey),
    pageType: visit.pageType,
    rawPath: visit.rawPath,
    targetKey: visit.targetKey,
    targetKind: visit.targetKind,
    visitedAt: visit.visitedAt,
  };
}

function summarizeNavigatorUsage(event: NavigatorUsageEvent) {
  return {
    activeTagCount: event.activeTagCount,
    id: event._id,
    occurredAt: event.occurredAt,
    resolvedTagCount: event.activeTagIds.length,
    usageKind: event.usageKind,
  };
}

async function getTargetLabel(
  ctx: QueryCtx,
  targetKind: AnalyticsTargetKind,
  targetKey: string,
) {
  if (targetKind === "dashboard") {
    return "Dashboard";
  }

  if (targetKind === "biblePassage") {
    return parseBiblePassageReference(targetKey)?.label ?? labelFromKey(targetKey);
  }

  if (targetKind === "tag") {
    return (await getTagLabelByKey(ctx, targetKey)) ?? labelFromKey(targetKey);
  }

  return await getContextLabel(ctx, targetKey);
}

async function getContextLabel(ctx: QueryCtx, targetKey: string) {
  const tagKeys = targetKey.startsWith("tags:")
    ? targetKey.slice("tags:".length).split(",").filter(Boolean)
    : [];
  if (tagKeys.length === 0) {
    return "Global Knowledge Context";
  }

  const labels = [];
  for (const tagKey of tagKeys.slice(0, MAX_CONTEXT_LABELS)) {
    labels.push((await getTagLabelByKey(ctx, tagKey)) ?? labelFromKey(tagKey));
  }

  const suffix =
    tagKeys.length > labels.length ? ` + ${tagKeys.length - labels.length} more` : "";
  return `${labels.join(" + ")}${suffix}`;
}

async function getTagLabelByKey(ctx: QueryCtx, tagKey: string) {
  return (await getTagByKey(ctx, tagKey))?.label ?? null;
}

async function getTagByKey(ctx: QueryCtx | MutationCtx, tagKey: string) {
  const tags = await ctx.db
    .query("tags")
    .withIndex("by_lookupKey", (q) => q.eq("lookupKey", tagKey))
    .take(1);

  return tags[0] ?? null;
}

function getTargetHref(targetKind: AnalyticsTargetKind, targetKey: string) {
  if (targetKind === "dashboard") {
    return "/";
  }

  if (targetKind === "biblePassage") {
    return `/scripture/${encodeURIComponent(targetKey)}`;
  }

  if (targetKind === "tag") {
    return `/goto/${encodeURIComponent(targetKey)}`;
  }

  if (!targetKey.startsWith("tags:")) {
    return "/explore";
  }

  return `/explore?tagIds=${targetKey
    .slice("tags:".length)
    .split(",")
    .map(encodeURIComponent)
    .join(",")}`;
}

async function resolveActiveTagIds(
  ctx: QueryCtx | MutationCtx,
  tagKeys: string[],
) {
  const tagIds: Id<"tags">[] = [];
  const seenTagIds = new Set<string>();

  for (const tagKey of tagKeys) {
    const tagId = (await getTagByKey(ctx, tagKey))?._id;
    if (tagId && !seenTagIds.has(tagId)) {
      seenTagIds.add(tagId);
      tagIds.push(tagId);
    }
  }

  return tagIds;
}

async function requireCurrentUserId(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Unauthorized");
  }

  return userId;
}

function normalizeActiveTagKeys(tagKeys: string[]) {
  return Array.from(new Set(tagKeys.map(normalizeTargetKey))).slice(
    0,
    MAX_ACTIVE_TAG_KEYS,
  );
}

function normalizeTrendWindowMs(value: number | undefined) {
  if (value === undefined) {
    return DEFAULT_TREND_WINDOW_MS;
  }

  return Math.max(1, Math.min(value, DEFAULT_TREND_WINDOW_MS * 8));
}

function normalizeTargetKey(value: string) {
  return limitString(value.trim().toLowerCase() || "unknown", MAX_TARGET_KEY_LENGTH);
}

function normalizeLimit(value: number | undefined, defaultValue: number, maxValue: number) {
  if (value === undefined) {
    return defaultValue;
  }

  return Math.max(0, Math.min(Math.floor(value), maxValue));
}

function limitString(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function compareTargetStats(first: PageVisitStat, second: PageVisitStat) {
  return (
    second.totalVisits - first.totalVisits ||
    second.lastVisitedAt - first.lastVisitedAt ||
    first.targetKey.localeCompare(second.targetKey)
  );
}

function compareBibleContextSuggestions(
  first: BibleContextSuggestion,
  second: BibleContextSuggestion,
) {
  return (
    second.trendScore - first.trendScore ||
    second.overdueRequestCount - first.overdueRequestCount ||
    second.openRequestCount - first.openRequestCount ||
    second.recentVisitCount - first.recentVisitCount ||
    second.totalVisitCount - first.totalVisitCount ||
    compareStrings(first.label, second.label) ||
    compareStrings(first.targetKey, second.targetKey)
  );
}

function getContextTargetKey(tagKeys: string[]) {
  return `tags:${[...tagKeys].sort(compareStrings).join(",")}`;
}

function getTrendKind(metrics: ContextTrendMetrics): ContextTrendKind {
  const requestCount = metrics.openRequestCount + metrics.overdueRequestCount;
  const isPopular =
    metrics.recentVisitCount >= 2 ||
    metrics.totalVisitCount >= 3 ||
    (metrics.recentVisitCount > 0 && getTrendScore(metrics) >= 16);
  const needsContribution = requestCount > 0;

  if (isPopular && needsContribution) {
    return "popularAndNeedsContribution";
  }

  if (isPopular) {
    return "popular";
  }

  if (needsContribution) {
    return "needsContribution";
  }

  return "quiet";
}

function getTrendScore(metrics: ContextTrendMetrics) {
  const requestCount = metrics.openRequestCount + metrics.overdueRequestCount;
  const scarcityBonus = Math.max(0, requestCount * 4 - metrics.answerCount * 2);
  const differentialPopularity = Math.max(
    0,
    metrics.recentVisitCount * 5 - Math.log1p(metrics.totalVisitCount) * 2,
  );

  return Math.round(
    metrics.recentVisitCount * 8 +
      Math.log1p(metrics.totalVisitCount) * 6 +
      metrics.openRequestCount * 12 +
      metrics.overdueRequestCount * 18 +
      scarcityBonus +
      differentialPopularity,
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

function labelFromKey(key: string) {
  return (
    key
      .replace(/^tags:/, "")
      .split(/[-_,]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || key
  );
}
