import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const DEFAULT_CONTEXT_TAG_LABELS: string[] = [];
const MAX_PREVIEW_LENGTH = 500;
const MAX_SEARCH_TEXT_LENGTH = 2_000;

const literatureKnowledgeType = v.union(
  v.literal("book"),
  v.literal("poem"),
  v.literal("shortStory"),
  v.literal("song"),
  v.literal("series"),
  v.literal("essay"),
);

const literatureDetailInput = v.object({
  approxGradeMax: v.union(v.number(), v.null()),
  approxGradeMin: v.union(v.number(), v.null()),
  approxWordCountK: v.union(v.number(), v.null()),
  author: v.union(v.string(), v.null()),
  genres: v.array(v.string()),
  historicalTimeframeEndYear: v.union(v.number(), v.null()),
  historicalTimeframeStartYear: v.union(v.number(), v.null()),
  lexileMeasure: v.union(v.number(), v.null()),
  publisher: v.union(v.string(), v.null()),
  settingLocation: v.union(v.string(), v.null()),
  yearPublished: v.union(v.string(), v.null()),
});

const literatureSeedInput = v.object({
  canonicalKey: v.string(),
  detail: literatureDetailInput,
  knowledgeType: literatureKnowledgeType,
  title: v.string(),
});

type LiteratureKnowledgeType =
  | "book"
  | "poem"
  | "shortStory"
  | "song"
  | "series"
  | "essay";

type LiteratureDetail = {
  approxGradeMax: number | null;
  approxGradeMin: number | null;
  approxWordCountK: number | null;
  author: string | null;
  genres: string[];
  historicalTimeframeEndYear: number | null;
  historicalTimeframeStartYear: number | null;
  lexileMeasure: number | null;
  publisher: string | null;
  settingLocation: string | null;
  yearPublished: string | null;
};

type LiteratureSeed = {
  canonicalKey: string;
  detail: LiteratureDetail;
  knowledgeType: LiteratureKnowledgeType;
  title: string;
};

type SeedStats = {
  inserted: number;
  skipped: number;
  updated: number;
};

type SeedResult = {
  details: SeedStats;
  entries: SeedStats;
  entryTags: SeedStats;
  referents: SeedStats;
  tags: SeedStats;
};

type UpsertResult<TId extends string> = {
  id: TId;
  state: UpsertState;
};
type UpsertState = "inserted" | "skipped" | "updated";

export const upsertLiteraryWorks = internalMutation({
  args: {
    works: v.array(literatureSeedInput),
  },
  handler: async (ctx, args): Promise<SeedResult> => {
    const now = Date.now();
    const stats: SeedResult = {
      details: emptyStats(),
      entries: emptyStats(),
      entryTags: emptyStats(),
      referents: emptyStats(),
      tags: emptyStats(),
    };

    for (const work of args.works) {
      const referentResult = await upsertReferent(ctx, {
        canonicalKey: work.canonicalKey,
        canonicalName: work.title,
        knowledgeType: work.knowledgeType,
      });
      count(stats.referents, referentResult.state);

      const tagResult = await upsertPrimaryTag(ctx, {
        knowledgeType: work.knowledgeType,
        label: work.title,
        lookupKey: work.canonicalKey,
        referentId: referentResult.id,
      });
      count(stats.tags, tagResult.state);

      const entryResult = await upsertKnowledgeEntry(ctx, {
        detail: work.detail,
        knowledgeType: work.knowledgeType,
        primaryTagId: tagResult.id,
        primaryTagLabel: work.title,
        representedReferentId: referentResult.id,
        title: work.title,
        updatedAt: now,
      });
      count(stats.entries, entryResult.state);

      const entryTagState = await upsertRepresentedEntryTag(ctx, {
        entryId: entryResult.id,
        now,
        tagId: tagResult.id,
      });
      count(stats.entryTags, entryTagState);

      const detailState = await upsertTypeDetail(ctx, {
        detail: work.detail,
        entryId: entryResult.id,
        knowledgeType: work.knowledgeType,
      });
      count(stats.details, detailState);
    }

    return stats;
  },
});

export const verifyLiteratureSeedBatch = internalQuery({
  args: {
    works: v.array(
      v.object({
        canonicalKey: v.string(),
        knowledgeType: literatureKnowledgeType,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const missing: Array<{
      canonicalKey: string;
      missing: "referent" | "entry" | "detail";
    }> = [];

    for (const work of args.works) {
      const referent = await getReferentByKey(
        ctx,
        work.knowledgeType,
        work.canonicalKey,
      );
      if (!referent) {
        missing.push({ canonicalKey: work.canonicalKey, missing: "referent" });
        continue;
      }

      const entry = await getKnowledgeEntryByReferent(
        ctx,
        referent._id,
        work.knowledgeType,
      );
      if (!entry) {
        missing.push({ canonicalKey: work.canonicalKey, missing: "entry" });
        continue;
      }

      const detail = await getTypeDetailByEntryId(
        ctx,
        work.knowledgeType,
        entry._id,
      );
      if (!detail) {
        missing.push({ canonicalKey: work.canonicalKey, missing: "detail" });
      }
    }

    return {
      checked: args.works.length,
      missing,
      ok: missing.length === 0,
    };
  },
});

async function upsertReferent(
  ctx: MutationCtx,
  referent: {
    canonicalKey: string;
    canonicalName: string;
    knowledgeType: LiteratureKnowledgeType;
  },
): Promise<UpsertResult<Id<"referents">>> {
  const existingReferent = await getReferentByKey(
    ctx,
    referent.knowledgeType,
    referent.canonicalKey,
  );
  if (!existingReferent) {
    return {
      id: await ctx.db.insert("referents", referent),
      state: "inserted",
    };
  }

  const patch: Partial<Doc<"referents">> = {};
  if (existingReferent.canonicalName !== referent.canonicalName) {
    patch.canonicalName = referent.canonicalName;
  }
  if (hasPatch(patch)) {
    await ctx.db.patch(existingReferent._id, patch);
    return { id: existingReferent._id, state: "updated" };
  }

  return { id: existingReferent._id, state: "skipped" };
}

async function upsertPrimaryTag(
  ctx: MutationCtx,
  tag: {
    knowledgeType: LiteratureKnowledgeType;
    label: string;
    lookupKey: string;
    referentId: Id<"referents">;
  },
): Promise<UpsertResult<Id<"tags">>> {
  const existingTag = await ctx.db
    .query("tags")
    .withIndex("by_knowledgeType_and_lookupKey", (q) =>
      q.eq("knowledgeType", tag.knowledgeType).eq("lookupKey", tag.lookupKey),
    )
    .unique();
  if (!existingTag) {
    return { id: await ctx.db.insert("tags", tag), state: "inserted" };
  }

  const patch: Partial<Doc<"tags">> = {};
  if (existingTag.label !== tag.label) {
    patch.label = tag.label;
  }
  if (existingTag.referentId !== tag.referentId) {
    patch.referentId = tag.referentId;
  }
  if (hasPatch(patch)) {
    await ctx.db.patch(existingTag._id, patch);
    return { id: existingTag._id, state: "updated" };
  }

  return { id: existingTag._id, state: "skipped" };
}

async function upsertKnowledgeEntry(
  ctx: MutationCtx,
  entry: {
    detail: LiteratureDetail;
    knowledgeType: LiteratureKnowledgeType;
    primaryTagId: Id<"tags">;
    primaryTagLabel: string;
    representedReferentId: Id<"referents">;
    title: string;
    updatedAt: number;
  },
): Promise<UpsertResult<Id<"knowledgeEntries">>> {
  const existingEntry = await getKnowledgeEntryByReferent(
    ctx,
    entry.representedReferentId,
    entry.knowledgeType,
  );
  const previewText = buildPreviewText(entry.title, entry.detail);
  const nextEntry = {
    contextPreviewTagLabels: DEFAULT_CONTEXT_TAG_LABELS,
    discoverabilityKind: "public" as const,
    discoverabilityTargetKey: "public",
    knowledgeType: entry.knowledgeType,
    previewText,
    primaryTagId: entry.primaryTagId,
    primaryTagLabel: entry.primaryTagLabel,
    publicPreviewText: previewText,
    representedReferentId: entry.representedReferentId,
    searchText: buildSearchText(entry.title, entry.detail),
    title: entry.title,
    visibilityKind: "public" as const,
    visibilityTargetKey: "public",
  };

  if (!existingEntry) {
    return {
      id: await ctx.db.insert("knowledgeEntries", {
        ...nextEntry,
        createdAt: entry.updatedAt,
        updatedAt: entry.updatedAt,
      }),
      state: "inserted",
    };
  }

  const patch: Partial<Doc<"knowledgeEntries">> = {};
  if (existingEntry.title !== nextEntry.title) {
    patch.title = nextEntry.title;
  }
  if (existingEntry.previewText !== nextEntry.previewText) {
    patch.previewText = nextEntry.previewText;
  }
  if (existingEntry.searchText !== nextEntry.searchText) {
    patch.searchText = nextEntry.searchText;
  }
  if (existingEntry.primaryTagId !== nextEntry.primaryTagId) {
    patch.primaryTagId = nextEntry.primaryTagId;
  }
  if (existingEntry.primaryTagLabel !== nextEntry.primaryTagLabel) {
    patch.primaryTagLabel = nextEntry.primaryTagLabel;
  }
  if (existingEntry.publicPreviewText !== nextEntry.publicPreviewText) {
    patch.publicPreviewText = nextEntry.publicPreviewText;
  }
  if (hasPatch(patch)) {
    patch.updatedAt = entry.updatedAt;
    await ctx.db.patch(existingEntry._id, patch);
    return { id: existingEntry._id, state: "updated" };
  }

  return { id: existingEntry._id, state: "skipped" };
}

async function upsertRepresentedEntryTag(
  ctx: MutationCtx,
  {
    entryId,
    now,
    tagId,
  }: {
    entryId: Id<"knowledgeEntries">;
    now: number;
    tagId: Id<"tags">;
  },
): Promise<UpsertState> {
  const existingEntryTag = await ctx.db
    .query("entryTags")
    .withIndex("by_entryId_and_tagId", (q) =>
      q.eq("entryId", entryId).eq("tagId", tagId),
    )
    .unique();
  if (!existingEntryTag) {
    await ctx.db.insert("entryTags", {
      entryId,
      tagId,
      tagPurpose: "represented",
      taggedAt: now,
    });
    return "inserted";
  }

  if (existingEntryTag.tagPurpose !== "represented") {
    await ctx.db.patch(existingEntryTag._id, { tagPurpose: "represented" });
    return "updated";
  }

  return "skipped";
}

async function upsertTypeDetail(
  ctx: MutationCtx,
  {
    detail,
    entryId,
    knowledgeType,
  }: {
    detail: LiteratureDetail;
    entryId: Id<"knowledgeEntries">;
    knowledgeType: LiteratureKnowledgeType;
  },
): Promise<UpsertState> {
  if (knowledgeType === "book") {
    const existing = await getBookEntryByEntryId(ctx, entryId);
    if (!existing) {
      await ctx.db.insert("bookEntries", { entryId, ...detail });
      return "inserted";
    }
    return await patchLiteratureDetail(ctx, existing, detail);
  }

  if (knowledgeType === "poem") {
    const existing = await getPoemEntryByEntryId(ctx, entryId);
    if (!existing) {
      await ctx.db.insert("poemEntries", { entryId, ...detail });
      return "inserted";
    }
    return await patchLiteratureDetail(ctx, existing, detail);
  }

  if (knowledgeType === "shortStory") {
    const existing = await getShortStoryEntryByEntryId(ctx, entryId);
    if (!existing) {
      await ctx.db.insert("shortStoryEntries", { entryId, ...detail });
      return "inserted";
    }
    return await patchLiteratureDetail(ctx, existing, detail);
  }

  if (knowledgeType === "song") {
    const existing = await getSongEntryByEntryId(ctx, entryId);
    if (!existing) {
      await ctx.db.insert("songEntries", { entryId, ...detail });
      return "inserted";
    }
    return await patchLiteratureDetail(ctx, existing, detail);
  }

  if (knowledgeType === "series") {
    const existing = await getSeriesEntryByEntryId(ctx, entryId);
    if (!existing) {
      await ctx.db.insert("seriesEntries", { entryId, ...detail });
      return "inserted";
    }
    return await patchLiteratureDetail(ctx, existing, detail);
  }

  const existing = await getEssayEntryByEntryId(ctx, entryId);
  if (!existing) {
    await ctx.db.insert("essayEntries", { entryId, ...detail });
    return "inserted";
  }
  return await patchLiteratureDetail(ctx, existing, detail);
}

async function patchLiteratureDetail(
  ctx: MutationCtx,
  existing: LiteratureDetailRow,
  detail: LiteratureDetail,
): Promise<UpsertState> {
  const patch = getLiteratureDetailPatch(existing, detail);
  if (!hasPatch(patch)) {
    return "skipped";
  }

  await ctx.db.patch(existing._id, patch);
  return "updated";
}

type LiteratureDetailRow = {
  _id:
    | Id<"bookEntries">
    | Id<"poemEntries">
    | Id<"shortStoryEntries">
    | Id<"songEntries">
    | Id<"seriesEntries">
    | Id<"essayEntries">;
} & Partial<LiteratureDetail>;

function getLiteratureDetailPatch(
  existing: Partial<LiteratureDetail>,
  next: LiteratureDetail,
) {
  const patch: Partial<LiteratureDetail> = {};
  for (const field of literatureDetailFields) {
    if (!sameValue(existing[field], next[field])) {
      patch[field] = next[field] as never;
    }
  }
  return patch;
}

async function getReferentByKey(
  ctx: QueryCtx | MutationCtx,
  knowledgeType: LiteratureKnowledgeType,
  canonicalKey: string,
) {
  return await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q.eq("knowledgeType", knowledgeType).eq("canonicalKey", canonicalKey),
    )
    .unique();
}

async function getKnowledgeEntryByReferent(
  ctx: QueryCtx | MutationCtx,
  representedReferentId: Id<"referents">,
  knowledgeType: LiteratureKnowledgeType,
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", representedReferentId),
    )
    .take(10);

  return entries.find((entry) => entry.knowledgeType === knowledgeType) ?? null;
}

async function getTypeDetailByEntryId(
  ctx: QueryCtx,
  knowledgeType: LiteratureKnowledgeType,
  entryId: Id<"knowledgeEntries">,
) {
  if (knowledgeType === "book") {
    return await getBookEntryByEntryId(ctx, entryId);
  }
  if (knowledgeType === "poem") {
    return await getPoemEntryByEntryId(ctx, entryId);
  }
  if (knowledgeType === "shortStory") {
    return await getShortStoryEntryByEntryId(ctx, entryId);
  }
  if (knowledgeType === "song") {
    return await getSongEntryByEntryId(ctx, entryId);
  }
  if (knowledgeType === "series") {
    return await getSeriesEntryByEntryId(ctx, entryId);
  }
  return await getEssayEntryByEntryId(ctx, entryId);
}

async function getBookEntryByEntryId(
  ctx: QueryCtx | MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  return await ctx.db
    .query("bookEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
    .unique();
}

async function getPoemEntryByEntryId(
  ctx: QueryCtx | MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  return await ctx.db
    .query("poemEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
    .unique();
}

async function getShortStoryEntryByEntryId(
  ctx: QueryCtx | MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  return await ctx.db
    .query("shortStoryEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
    .unique();
}

async function getSongEntryByEntryId(
  ctx: QueryCtx | MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  return await ctx.db
    .query("songEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
    .unique();
}

async function getSeriesEntryByEntryId(
  ctx: QueryCtx | MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  return await ctx.db
    .query("seriesEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
    .unique();
}

async function getEssayEntryByEntryId(
  ctx: QueryCtx | MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  return await ctx.db
    .query("essayEntries")
    .withIndex("by_entryId", (q) => q.eq("entryId", entryId))
    .unique();
}

function buildPreviewText(title: string, detail: LiteratureDetail) {
  const pieces = [
    detail.author ? `by ${detail.author}` : "",
    detail.yearPublished ? `published ${detail.yearPublished}` : "",
  ].filter(Boolean);
  const summary =
    pieces.length > 0 ? `${title}, ${pieces.join(", ")}.` : `${title}.`;
  return limitString(summary, MAX_PREVIEW_LENGTH);
}

function buildSearchText(title: string, detail: LiteratureDetail) {
  return limitString(
    [
      title,
      detail.author,
      detail.yearPublished,
      detail.publisher,
      detail.settingLocation,
      ...detail.genres,
    ]
      .filter((part) => typeof part === "string" && part.trim() !== "")
      .join(" "),
    MAX_SEARCH_TEXT_LENGTH,
  );
}

function limitString(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength).trim();
}

const literatureDetailFields = [
  "approxGradeMax",
  "approxGradeMin",
  "approxWordCountK",
  "author",
  "genres",
  "historicalTimeframeEndYear",
  "historicalTimeframeStartYear",
  "lexileMeasure",
  "publisher",
  "settingLocation",
  "yearPublished",
] as const satisfies readonly (keyof LiteratureDetail)[];

function sameValue(
  left: LiteratureDetail[keyof LiteratureDetail] | undefined,
  right: LiteratureDetail[keyof LiteratureDetail],
) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    );
  }

  return (left ?? null) === right;
}

function emptyStats(): SeedStats {
  return { inserted: 0, skipped: 0, updated: 0 };
}

function count(stats: SeedStats, state: UpsertState) {
  stats[state] += 1;
}

function hasPatch(patch: object) {
  return Object.keys(patch).length > 0;
}
