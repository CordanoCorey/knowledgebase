import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

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
  description: v.optional(v.union(v.string(), v.null())),
  descriptionSourceName: v.optional(v.union(v.string(), v.null())),
  descriptionSourceUrl: v.optional(v.union(v.string(), v.null())),
  genres: v.array(v.string()),
  googleBooksVolumeId: v.optional(v.union(v.string(), v.null())),
  historicalTimeframeEndYear: v.union(v.number(), v.null()),
  historicalTimeframeStartYear: v.union(v.number(), v.null()),
  lexileMeasure: v.union(v.number(), v.null()),
  openLibraryCoverId: v.optional(v.union(v.string(), v.null())),
  openLibraryWorkKey: v.optional(v.union(v.string(), v.null())),
  publisher: v.union(v.string(), v.null()),
  settingLocation: v.union(v.string(), v.null()),
  subjects: v.optional(v.array(v.string())),
  thumbnailSourceName: v.optional(v.union(v.string(), v.null())),
  thumbnailSourceUrl: v.optional(v.union(v.string(), v.null())),
  thumbnailUrl: v.optional(v.union(v.string(), v.null())),
  wikipediaTitle: v.optional(v.union(v.string(), v.null())),
  yearPublished: v.union(v.string(), v.null()),
});

const literatureAuthorRole = v.union(
  v.literal("author"),
  v.literal("editor"),
  v.literal("translator"),
  v.literal("compiler"),
  v.literal("illustrator"),
  v.literal("contributor"),
);

const personDetailInput = v.object({
  birthDate: v.optional(v.union(v.string(), v.null())),
  deathDate: v.optional(v.union(v.string(), v.null())),
  description: v.optional(v.union(v.string(), v.null())),
  descriptionSourceName: v.optional(v.union(v.string(), v.null())),
  descriptionSourceUrl: v.optional(v.union(v.string(), v.null())),
  openLibraryAuthorKey: v.optional(v.union(v.string(), v.null())),
  subjects: v.optional(v.array(v.string())),
  thumbnailSourceName: v.optional(v.union(v.string(), v.null())),
  thumbnailSourceUrl: v.optional(v.union(v.string(), v.null())),
  thumbnailUrl: v.optional(v.union(v.string(), v.null())),
  wikipediaTitle: v.optional(v.union(v.string(), v.null())),
});

const authorReferenceInput = v.object({
  canonicalKey: v.string(),
  detail: v.optional(personDetailInput),
  name: v.string(),
  role: literatureAuthorRole,
});

const literatureSeedInput = v.object({
  authorReferences: v.optional(v.array(authorReferenceInput)),
  canonicalKey: v.string(),
  detail: literatureDetailInput,
  knowledgeType: literatureKnowledgeType,
  title: v.string(),
});

const literatureSeedIdentityInput = v.object({
  canonicalKey: v.string(),
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

type SeededReferentKnowledgeType = LiteratureKnowledgeType | "person";

type LiteratureDetail = {
  approxGradeMax: number | null;
  approxGradeMin: number | null;
  approxWordCountK: number | null;
  author: string | null;
  description?: string | null;
  descriptionSourceName?: string | null;
  descriptionSourceUrl?: string | null;
  genres: string[];
  googleBooksVolumeId?: string | null;
  historicalTimeframeEndYear: number | null;
  historicalTimeframeStartYear: number | null;
  lexileMeasure: number | null;
  openLibraryCoverId?: string | null;
  openLibraryWorkKey?: string | null;
  publisher: string | null;
  settingLocation: string | null;
  subjects?: string[];
  thumbnailSourceName?: string | null;
  thumbnailSourceUrl?: string | null;
  thumbnailUrl?: string | null;
  wikipediaTitle?: string | null;
  yearPublished: string | null;
};

type PersonDetail = {
  birthDate?: string | null;
  deathDate?: string | null;
  description?: string | null;
  descriptionSourceName?: string | null;
  descriptionSourceUrl?: string | null;
  openLibraryAuthorKey?: string | null;
  subjects?: string[];
  thumbnailSourceName?: string | null;
  thumbnailSourceUrl?: string | null;
  thumbnailUrl?: string | null;
  wikipediaTitle?: string | null;
};

type LiteratureAuthorRole =
  | "author"
  | "editor"
  | "translator"
  | "compiler"
  | "illustrator"
  | "contributor";

type AuthorReference = {
  canonicalKey: string;
  detail?: PersonDetail;
  name: string;
  role: LiteratureAuthorRole;
};

type NormalizedAuthorReference = AuthorReference & {
  authorOrder: number;
};

type LiteratureSeed = {
  authorReferences?: AuthorReference[];
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
  authorDetails: SeedStats;
  authorReferences: SeedStats;
  authorReferents: SeedStats;
  authorTags: SeedStats;
  referents: SeedStats;
  referentDetails: SeedStats;
  tags: SeedStats;
};

type UpsertResult<TId extends string> = {
  id: TId;
  state: UpsertState;
};
type UpsertState = "inserted" | "skipped" | "updated";

// The literature corpus is a referent preload. It intentionally does not create
// Knowledge Entries: a work becomes a Knowledge Entry only when users contribute
// or approve actual knowledge about that referent.
export const upsertLiteraryWorks = internalMutation({
  args: {
    works: v.array(literatureSeedInput),
  },
  handler: async (ctx, args): Promise<SeedResult> => {
    const stats: SeedResult = {
      authorDetails: emptyStats(),
      authorReferences: emptyStats(),
      authorReferents: emptyStats(),
      authorTags: emptyStats(),
      referents: emptyStats(),
      referentDetails: emptyStats(),
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

      const detailResult = await upsertLiteratureReferentDetail(ctx, {
        detail: work.detail,
        knowledgeType: work.knowledgeType,
        referentId: referentResult.id,
        title: work.title,
      });
      count(stats.referentDetails, detailResult.state);

      for (const authorReference of getWorkAuthorReferences(work)) {
        const authorReferentResult = await upsertReferent(ctx, {
          canonicalKey: authorReference.canonicalKey,
          canonicalName: authorReference.name,
          knowledgeType: "person",
        });
        count(stats.authorReferents, authorReferentResult.state);

        const authorTagResult = await upsertPrimaryTag(ctx, {
          knowledgeType: "person",
          label: authorReference.name,
          lookupKey: authorReference.canonicalKey,
          referentId: authorReferentResult.id,
        });
        count(stats.authorTags, authorTagResult.state);

        const authorDetailResult = await upsertPersonReferentDetail(ctx, {
          detail: authorReference.detail,
          name: authorReference.name,
          referentId: authorReferentResult.id,
        });
        count(stats.authorDetails, authorDetailResult.state);

        const authorReferenceResult = await upsertLiteratureAuthorReference(ctx, {
          authorName: authorReference.name,
          authorOrder: authorReference.authorOrder,
          personReferentId: authorReferentResult.id,
          role: authorReference.role,
          workReferentId: referentResult.id,
        });
        count(stats.authorReferences, authorReferenceResult.state);
      }
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
        title: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const missing: Array<{
      canonicalKey: string;
      missing: "referent" | "referentDetail" | "tag";
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

      const tag = await getPrimaryTagByKey(
        ctx,
        work.knowledgeType,
        work.canonicalKey,
      );
      if (!tag || tag.referentId !== referent._id) {
        missing.push({ canonicalKey: work.canonicalKey, missing: "tag" });
      }

      const detail = await getLiteratureReferentDetailByReferentId(
        ctx,
        referent._id,
      );
      if (!detail) {
        missing.push({
          canonicalKey: work.canonicalKey,
          missing: "referentDetail",
        });
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
    knowledgeType: SeededReferentKnowledgeType;
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
    knowledgeType: SeededReferentKnowledgeType;
    label: string;
    lookupKey: string;
    referentId: Id<"referents">;
  },
): Promise<UpsertResult<Id<"tags">>> {
  const existingTag = await getPrimaryTagByKey(
    ctx,
    tag.knowledgeType,
    tag.lookupKey,
  );
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

async function upsertLiteratureReferentDetail(
  ctx: MutationCtx,
  detail: {
    detail: LiteratureDetail;
    knowledgeType: LiteratureKnowledgeType;
    referentId: Id<"referents">;
    title: string;
  },
): Promise<UpsertResult<Id<"literatureReferentDetails">>> {
  const existingDetail = await getLiteratureReferentDetailByReferentId(
    ctx,
    detail.referentId,
  );
  const normalizedDetail = normalizeLiteratureDetail(detail.detail);
  const nextDetail = {
    ...normalizedDetail,
    knowledgeType: detail.knowledgeType,
    referentId: detail.referentId,
    searchText: buildSearchText(detail.title, normalizedDetail),
  };

  if (!existingDetail) {
    return {
      id: await ctx.db.insert("literatureReferentDetails", nextDetail),
      state: "inserted",
    };
  }

  const patch = getLiteratureReferentDetailPatch(existingDetail, nextDetail);
  if (hasPatch(patch)) {
    await ctx.db.patch(existingDetail._id, patch);
    return { id: existingDetail._id, state: "updated" };
  }

  return { id: existingDetail._id, state: "skipped" };
}

async function upsertPersonReferentDetail(
  ctx: MutationCtx,
  detail: {
    detail?: PersonDetail;
    name: string;
    referentId: Id<"referents">;
  },
): Promise<UpsertResult<Id<"personReferentDetails">>> {
  const existingDetail = await getPersonReferentDetailByReferentId(
    ctx,
    detail.referentId,
  );
  const normalizedDetail = normalizePersonDetail(detail.detail);
  const nextDetail = {
    ...normalizedDetail,
    referentId: detail.referentId,
    searchText: buildPersonSearchText(detail.name, normalizedDetail),
  };

  if (!existingDetail) {
    return {
      id: await ctx.db.insert("personReferentDetails", nextDetail),
      state: "inserted",
    };
  }

  const patch = getPersonReferentDetailPatch(existingDetail, nextDetail);
  if (hasPatch(patch)) {
    await ctx.db.patch(existingDetail._id, patch);
    return { id: existingDetail._id, state: "updated" };
  }

  return { id: existingDetail._id, state: "skipped" };
}

async function upsertLiteratureAuthorReference(
  ctx: MutationCtx,
  reference: {
    authorName: string;
    authorOrder: number;
    personReferentId: Id<"referents">;
    role: LiteratureAuthorRole;
    workReferentId: Id<"referents">;
  },
): Promise<UpsertResult<Id<"literatureAuthorReferences">>> {
  const existingReference = await getLiteratureAuthorReference(
    ctx,
    reference.workReferentId,
    reference.personReferentId,
  );
  const now = Date.now();
  if (!existingReference) {
    return {
      id: await ctx.db.insert("literatureAuthorReferences", {
        ...reference,
        createdAt: now,
        updatedAt: now,
      }),
      state: "inserted",
    };
  }

  const patch: Partial<Doc<"literatureAuthorReferences">> = {};
  if (existingReference.authorName !== reference.authorName) {
    patch.authorName = reference.authorName;
  }
  if (existingReference.authorOrder !== reference.authorOrder) {
    patch.authorOrder = reference.authorOrder;
  }
  if (existingReference.role !== reference.role) {
    patch.role = reference.role;
  }
  if (hasPatch(patch)) {
    await ctx.db.patch(existingReference._id, {
      ...patch,
      updatedAt: now,
    });
    return { id: existingReference._id, state: "updated" };
  }

  return { id: existingReference._id, state: "skipped" };
}

async function getLiteratureReferentDetailByReferentId(
  ctx: QueryCtx | MutationCtx,
  referentId: Id<"referents">,
) {
  return await ctx.db
    .query("literatureReferentDetails")
    .withIndex("by_referentId", (q) => q.eq("referentId", referentId))
    .unique();
}

async function getPersonReferentDetailByReferentId(
  ctx: QueryCtx | MutationCtx,
  referentId: Id<"referents">,
) {
  return await ctx.db
    .query("personReferentDetails")
    .withIndex("by_referentId", (q) => q.eq("referentId", referentId))
    .unique();
}

async function getLiteratureAuthorReference(
  ctx: QueryCtx | MutationCtx,
  workReferentId: Id<"referents">,
  personReferentId: Id<"referents">,
) {
  return await ctx.db
    .query("literatureAuthorReferences")
    .withIndex("by_workReferentId_and_personReferentId", (q) =>
      q
        .eq("workReferentId", workReferentId)
        .eq("personReferentId", personReferentId),
    )
    .unique();
}

type LiteratureReferentDetail = {
  knowledgeType: LiteratureKnowledgeType;
  referentId: Id<"referents">;
  searchText: string;
} & LiteratureDetail;

type LiteratureReferentDetailPatch = Partial<
  Omit<LiteratureReferentDetail, "referentId">
>;

type PersonReferentDetail = {
  referentId: Id<"referents">;
  searchText: string;
} & Required<PersonDetail>;

type PersonReferentDetailPatch = Partial<
  Omit<PersonReferentDetail, "referentId">
>;

function getLiteratureReferentDetailPatch(
  existing: Partial<LiteratureReferentDetail>,
  next: LiteratureReferentDetail,
) {
  const patch: LiteratureReferentDetailPatch = {};
  for (const field of literatureReferentDetailPatchFields) {
    if (!sameValue(existing[field], next[field])) {
      patch[field] = next[field] as never;
    }
  }
  return patch;
}

function getPersonReferentDetailPatch(
  existing: Partial<PersonReferentDetail>,
  next: PersonReferentDetail,
) {
  const patch: PersonReferentDetailPatch = {};
  for (const field of personReferentDetailPatchFields) {
    if (!sameValue(existing[field], next[field])) {
      patch[field] = next[field] as never;
    }
  }
  return patch;
}

async function getReferentByKey(
  ctx: QueryCtx | MutationCtx,
  knowledgeType: SeededReferentKnowledgeType,
  canonicalKey: string,
) {
  return await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q.eq("knowledgeType", knowledgeType).eq("canonicalKey", canonicalKey),
    )
    .unique();
}

async function getPrimaryTagByKey(
  ctx: QueryCtx | MutationCtx,
  knowledgeType: SeededReferentKnowledgeType,
  lookupKey: string,
) {
  return await ctx.db
    .query("tags")
    .withIndex("by_knowledgeType_and_lookupKey", (q) =>
      q.eq("knowledgeType", knowledgeType).eq("lookupKey", lookupKey),
    )
    .unique();
}

function buildSearchText(title: string, detail: LiteratureDetail) {
  return limitString(
    [
      title,
      detail.author,
      detail.yearPublished,
      detail.publisher,
      detail.settingLocation,
      detail.description,
      detail.openLibraryWorkKey,
      detail.wikipediaTitle,
      ...detail.genres,
      ...(detail.subjects ?? []),
    ]
      .filter((part) => typeof part === "string" && part.trim() !== "")
      .join(" "),
    2_000,
  );
}

function buildPersonSearchText(name: string, detail: Required<PersonDetail>) {
  return limitString(
    [
      name,
      detail.birthDate,
      detail.deathDate,
      detail.description,
      detail.openLibraryAuthorKey,
      detail.wikipediaTitle,
      ...(detail.subjects ?? []),
    ]
      .filter((part) => typeof part === "string" && part.trim() !== "")
      .join(" "),
    2_000,
  );
}

function limitString(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength).trim();
}

function normalizeLiteratureDetail(
  detail: LiteratureDetail,
): Required<LiteratureDetail> {
  return {
    approxGradeMax: detail.approxGradeMax,
    approxGradeMin: detail.approxGradeMin,
    approxWordCountK: detail.approxWordCountK,
    author: detail.author,
    description: detail.description ?? null,
    descriptionSourceName: detail.descriptionSourceName ?? null,
    descriptionSourceUrl: detail.descriptionSourceUrl ?? null,
    genres: detail.genres,
    googleBooksVolumeId: detail.googleBooksVolumeId ?? null,
    historicalTimeframeEndYear: detail.historicalTimeframeEndYear,
    historicalTimeframeStartYear: detail.historicalTimeframeStartYear,
    lexileMeasure: detail.lexileMeasure,
    openLibraryCoverId: detail.openLibraryCoverId ?? null,
    openLibraryWorkKey: detail.openLibraryWorkKey ?? null,
    publisher: detail.publisher,
    settingLocation: detail.settingLocation,
    subjects: detail.subjects ?? [],
    thumbnailSourceName: detail.thumbnailSourceName ?? null,
    thumbnailSourceUrl: detail.thumbnailSourceUrl ?? null,
    thumbnailUrl: detail.thumbnailUrl ?? null,
    wikipediaTitle: detail.wikipediaTitle ?? null,
    yearPublished: detail.yearPublished,
  };
}

function normalizePersonDetail(detail: PersonDetail | undefined): Required<PersonDetail> {
  return {
    birthDate: detail?.birthDate ?? null,
    deathDate: detail?.deathDate ?? null,
    description: detail?.description ?? null,
    descriptionSourceName: detail?.descriptionSourceName ?? null,
    descriptionSourceUrl: detail?.descriptionSourceUrl ?? null,
    openLibraryAuthorKey: detail?.openLibraryAuthorKey ?? null,
    subjects: detail?.subjects ?? [],
    thumbnailSourceName: detail?.thumbnailSourceName ?? null,
    thumbnailSourceUrl: detail?.thumbnailSourceUrl ?? null,
    thumbnailUrl: detail?.thumbnailUrl ?? null,
    wikipediaTitle: detail?.wikipediaTitle ?? null,
  };
}

function getWorkAuthorReferences(work: LiteratureSeed) {
  const explicitReferences = work.authorReferences ?? [];
  if (explicitReferences.length > 0) {
    return normalizeAuthorReferences(explicitReferences);
  }

  return normalizeAuthorReferences(parseFallbackAuthorReferences(work.detail.author));
}

function normalizeAuthorReferences(
  authorReferences: AuthorReference[],
): NormalizedAuthorReference[] {
  const seenCanonicalKeys = new Set<string>();
  const normalized: NormalizedAuthorReference[] = [];

  for (const authorReference of authorReferences) {
    const name = authorReference.name.trim();
    const canonicalKey =
      normalizeCanonicalKey(authorReference.canonicalKey) ??
      normalizeCanonicalKey(name);
    if (!name || !canonicalKey || seenCanonicalKeys.has(canonicalKey)) {
      continue;
    }

    seenCanonicalKeys.add(canonicalKey);
    normalized.push({
      ...authorReference,
      authorOrder: normalized.length,
      canonicalKey,
      name,
      role: authorReference.role,
    });
  }

  return normalized;
}

function parseFallbackAuthorReferences(author: string | null): AuthorReference[] {
  if (!author || isSkippedAuthorName(author)) {
    return [];
  }

  const role = inferAuthorRole(author);
  const normalizedAuthor = author
    .replace(/\banonymous\b/gi, "")
    .replace(/\((?:editor|editors|translator|compiler|illustrator)\)/gi, "")
    .replace(/\b(?:editor|editors|translator|compiler|illustrator)\b/gi, "")
    .replace(/\btrans\.\s*/gi, "")
    .replace(/\btranslated by\s*/gi, "")
    .trim();
  const parts = splitAuthorNames(normalizedAuthor);

  return parts
    .filter((name) => !isSkippedAuthorName(name))
    .map((name) => ({
      canonicalKey: normalizeCanonicalKey(name) ?? "",
      name,
      role,
    }));
}

function splitAuthorNames(author: string) {
  return author
    .replace(/\s*\/\s*/g, ";")
    .replace(/\s*&\s*/g, " and ")
    .split(/\s*;\s*|\s+\band\b\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferAuthorRole(author: string): LiteratureAuthorRole {
  const normalizedAuthor = author.toLowerCase();
  if (normalizedAuthor.includes("editor")) {
    return "editor";
  }
  if (normalizedAuthor.includes("translator")) {
    return "translator";
  }
  if (/\btrans\./i.test(author) || normalizedAuthor.includes("translated by")) {
    return "translator";
  }
  if (normalizedAuthor.includes("compiler")) {
    return "compiler";
  }
  if (normalizedAuthor.includes("illustrator")) {
    return "illustrator";
  }
  return "author";
}

function isSkippedAuthorName(author: string) {
  const normalizedAuthor = author.trim().toLowerCase();
  return (
    normalizedAuthor === "" ||
    normalizedAuthor === "anonymous" ||
    normalizedAuthor === "unknown" ||
    normalizedAuthor === "various" ||
    normalizedAuthor === "various authors" ||
    normalizedAuthor === "traditional" ||
    normalizedAuthor.includes("folklore") ||
    normalizedAuthor.includes("mythology") ||
    normalizedAuthor.includes("public domain")
  );
}

function normalizeCanonicalKey(value: string) {
  const canonicalKey = value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return canonicalKey || null;
}

const literatureReferentDetailPatchFields = [
  "approxGradeMax",
  "approxGradeMin",
  "approxWordCountK",
  "author",
  "description",
  "descriptionSourceName",
  "descriptionSourceUrl",
  "genres",
  "googleBooksVolumeId",
  "historicalTimeframeEndYear",
  "historicalTimeframeStartYear",
  "knowledgeType",
  "lexileMeasure",
  "openLibraryCoverId",
  "openLibraryWorkKey",
  "publisher",
  "searchText",
  "settingLocation",
  "subjects",
  "thumbnailSourceName",
  "thumbnailSourceUrl",
  "thumbnailUrl",
  "wikipediaTitle",
  "yearPublished",
] as const satisfies readonly (keyof LiteratureReferentDetailPatch)[];

const personReferentDetailPatchFields = [
  "birthDate",
  "deathDate",
  "description",
  "descriptionSourceName",
  "descriptionSourceUrl",
  "openLibraryAuthorKey",
  "searchText",
  "subjects",
  "thumbnailSourceName",
  "thumbnailSourceUrl",
  "thumbnailUrl",
  "wikipediaTitle",
] as const satisfies readonly (keyof PersonReferentDetailPatch)[];

function sameValue(
  left:
    | LiteratureReferentDetailPatch[keyof LiteratureReferentDetailPatch]
    | PersonReferentDetailPatch[keyof PersonReferentDetailPatch]
    | undefined,
  right:
    | LiteratureReferentDetailPatch[keyof LiteratureReferentDetailPatch]
    | PersonReferentDetailPatch[keyof PersonReferentDetailPatch],
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
