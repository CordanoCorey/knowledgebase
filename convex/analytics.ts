import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { parseBiblePassageReference } from "./lib/scriptureReferences";

const DEFAULT_POPULAR_LIMIT = 6;
const DEFAULT_RECENT_LIMIT = 8;
const MAX_POPULAR_LIMIT = 12;
const MAX_RECENT_LIMIT = 20;
const MAX_TARGET_KEY_LENGTH = 180;
const MAX_RAW_PATH_LENGTH = 360;
const MAX_ACTIVE_TAG_KEYS = 20;
const MAX_CONTEXT_LABELS = 4;

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

type AnalyticsTargetKind = Doc<"pageVisitStats">["targetKind"];
type AnalyticsPageType = Doc<"pageVisitStats">["pageType"];
type PageVisitStat = Doc<"pageVisitStats">;
type PageVisitEvent = Doc<"pageVisitEvents">;
type NavigatorUsageEvent = Doc<"navigatorUsageEvents">;

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
  const tags = await ctx.db
    .query("tags")
    .withIndex("by_lookupKey", (q) => q.eq("lookupKey", tagKey))
    .take(1);

  return tags[0]?.label ?? null;
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

async function resolveActiveTagIds(ctx: MutationCtx, tagKeys: string[]) {
  const tagIds: Id<"tags">[] = [];
  const seenTagIds = new Set<string>();

  for (const tagKey of tagKeys) {
    const tags = await ctx.db
      .query("tags")
      .withIndex("by_lookupKey", (q) => q.eq("lookupKey", tagKey))
      .take(1);
    const tagId = tags[0]?._id;
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
