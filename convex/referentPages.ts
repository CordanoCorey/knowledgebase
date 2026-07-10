import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireAppAccess, type AppAccessState } from "./lib/appAccess";
import { getRepresentedReferentThumbnailUrl } from "./lib/referentThumbnails";

const MAX_REFERENT_TAGS = 12;
const MAX_REFERENT_ALIASES = 12;
const MAX_REPRESENTED_ENTRIES_PER_REFERENT = 20;
const MAX_AUTHOR_REFERENCES = 16;
const MAX_AUTHORED_WORKS = 24;

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

type AllowedAccess = Extract<AppAccessState, { status: "allowed" }>;

type ReferentPageFact = {
  label: string;
  value: string;
};

type ReferentPageRelationItem = {
  detail?: string;
  href: string;
  id: string;
  knowledgeType: Doc<"referents">["knowledgeType"];
  label: string;
  thumbnailUrl?: string;
};

type ReferentPageSection = {
  items: ReferentPageRelationItem[];
  title: string;
};

export const getReferentPageMetadata = query({
  args: {
    canonicalKey: v.string(),
    knowledgeType: referentKnowledgeType,
    tagLookupKey: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const target = await resolveReferentPageTarget(ctx, args);
    if (!target) {
      return null;
    }

    const visibleEntries = await getVisibleRepresentedEntries(
      ctx,
      target.referent._id,
      access,
    );
    const newestEntry = visibleEntries[0];
    const literatureDetail = await getLiteratureReferentDetail(
      ctx,
      target.referent._id,
    );
    const personDetail = await getPersonReferentDetail(ctx, target.referent._id);
    const thumbnailUrl = await getRepresentedReferentThumbnailUrl(
      ctx,
      target.referent._id,
      { isEntryVisible: (entry) => isEntryAccessible(entry, access) },
    );
    const tags = await getReferentTags(ctx, target.referent._id);
    const aliases = await getTagAliases(ctx, target.tag._id);
    const detail = literatureDetail ?? personDetail;
    const facts = [
      toFact("Knowledge Type", formatKnowledgeType(target.referent.knowledgeType)),
      toFact("Canonical Key", target.referent.canonicalKey),
      toFact("Primary Tag", target.tag.label),
      toFact("Known Aliases", aliases.map((alias) => alias.label).join(", ")),
      toFact(
        "Represented Entries",
        visibleEntries.length > 0 ? String(visibleEntries.length) : "",
      ),
      ...getLiteratureFacts(literatureDetail),
      ...getPersonFacts(personDetail),
      toFact("Source", detail?.descriptionSourceName ?? detail?.thumbnailSourceName),
    ].filter(isFact);
    const sections = [
      await getAuthorsSection(ctx, target.referent._id),
      await getAuthoredWorksSection(ctx, target.referent._id),
    ].filter(isSection);

    return removeUndefinedFields({
      canonicalKey: target.referent.canonicalKey,
      description: detail?.description ?? newestEntry?.previewText,
      detailKind: literatureDetail
        ? "literature"
        : personDetail
          ? "person"
          : "generic",
      facts,
      href: getTagHref(target.tag, target.referent.canonicalKey),
      id: target.tag.lookupKey,
      knowledgeType: target.referent.knowledgeType,
      label: target.tag.label,
      sections,
      sourceName: detail?.descriptionSourceName ?? detail?.thumbnailSourceName,
      sourceUrl: detail?.descriptionSourceUrl ?? detail?.thumbnailSourceUrl,
      tags: tags.map((tag) => ({
        canonicalKey: target.referent.canonicalKey,
        href: getTagHref(tag, target.referent.canonicalKey),
        id: tag.lookupKey,
        knowledgeType: tag.knowledgeType,
        label: tag.label,
        ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
      })),
      ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
    });
  },
});

async function resolveReferentPageTarget(
  ctx: QueryCtx,
  input: {
    canonicalKey: string;
    knowledgeType: Doc<"referents">["knowledgeType"];
    tagLookupKey: string;
  },
) {
  const referent = await ctx.db
    .query("referents")
    .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
      q.eq("knowledgeType", input.knowledgeType).eq("canonicalKey", input.canonicalKey),
    )
    .first();
  const tag = await ctx.db
    .query("tags")
    .withIndex("by_knowledgeType_and_lookupKey", (q) =>
      q.eq("knowledgeType", input.knowledgeType).eq("lookupKey", input.tagLookupKey),
    )
    .first();

  if (referent) {
    const primaryTag =
      tag?.referentId === referent._id
        ? tag
        : await getPrimaryTagForReferent(ctx, referent._id, referent.knowledgeType);
    return primaryTag ? { referent, tag: primaryTag } : null;
  }

  if (!tag) {
    return null;
  }

  const tagReferent = await ctx.db.get(tag.referentId);
  return tagReferent ? { referent: tagReferent, tag } : null;
}

async function getVisibleRepresentedEntries(
  ctx: QueryCtx,
  referentId: Id<"referents">,
  access: AllowedAccess,
) {
  const entries = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", referentId),
    )
    .take(MAX_REPRESENTED_ENTRIES_PER_REFERENT);

  return entries
    .filter((entry) => isEntryAccessible(entry, access))
    .sort((left, right) => right.updatedAt - left.updatedAt);
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

async function getPersonReferentDetail(ctx: QueryCtx, referentId: Id<"referents">) {
  return await ctx.db
    .query("personReferentDetails")
    .withIndex("by_referentId", (q) => q.eq("referentId", referentId))
    .unique();
}

async function getReferentTags(ctx: QueryCtx, referentId: Id<"referents">) {
  return await ctx.db
    .query("tags")
    .withIndex("by_referentId", (q) => q.eq("referentId", referentId))
    .take(MAX_REFERENT_TAGS);
}

async function getTagAliases(ctx: QueryCtx, tagId: Id<"tags">) {
  return await ctx.db
    .query("tagAliases")
    .withIndex("by_tagId", (q) => q.eq("tagId", tagId))
    .take(MAX_REFERENT_ALIASES);
}

async function getPrimaryTagForReferent(
  ctx: QueryCtx,
  referentId: Id<"referents">,
  knowledgeType: Doc<"referents">["knowledgeType"],
) {
  const tags = await getReferentTags(ctx, referentId);
  return (
    tags.find((tag) => tag.knowledgeType === knowledgeType) ??
    tags[0] ??
    null
  );
}

async function getAuthorsSection(
  ctx: QueryCtx,
  workReferentId: Id<"referents">,
): Promise<ReferentPageSection | null> {
  const references = await ctx.db
    .query("literatureAuthorReferences")
    .withIndex("by_workReferentId_and_authorOrder", (q) =>
      q.eq("workReferentId", workReferentId),
    )
    .take(MAX_AUTHOR_REFERENCES);
  const items: ReferentPageRelationItem[] = [];

  for (const reference of references) {
    const personReferent = await ctx.db.get(reference.personReferentId);
    if (!personReferent) {
      continue;
    }

    const tag = await getPrimaryTagForReferent(
      ctx,
      personReferent._id,
      personReferent.knowledgeType,
    );
    if (!tag) {
      continue;
    }

    const personDetail = await getPersonReferentDetail(ctx, personReferent._id);
    const thumbnailUrl = await getRepresentedReferentThumbnailUrl(
      ctx,
      personReferent._id,
    );
    items.push(
      removeUndefinedFields({
        detail: formatAuthorRelationDetail(reference, personDetail),
        href: getTagHref(tag, personReferent.canonicalKey),
        id: tag.lookupKey,
        knowledgeType: personReferent.knowledgeType,
        label: tag.label,
        ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
      }),
    );
  }

  return items.length > 0 ? { items, title: "Authors" } : null;
}

async function getAuthoredWorksSection(
  ctx: QueryCtx,
  personReferentId: Id<"referents">,
): Promise<ReferentPageSection | null> {
  const references = await ctx.db
    .query("literatureAuthorReferences")
    .withIndex("by_personReferentId", (q) =>
      q.eq("personReferentId", personReferentId),
    )
    .take(MAX_AUTHORED_WORKS);
  const items: ReferentPageRelationItem[] = [];

  for (const reference of references) {
    const workReferent = await ctx.db.get(reference.workReferentId);
    if (!workReferent) {
      continue;
    }

    const tag = await getPrimaryTagForReferent(
      ctx,
      workReferent._id,
      workReferent.knowledgeType,
    );
    if (!tag) {
      continue;
    }

    const literatureDetail = await getLiteratureReferentDetail(
      ctx,
      workReferent._id,
    );
    const thumbnailUrl = await getRepresentedReferentThumbnailUrl(
      ctx,
      workReferent._id,
    );
    items.push(
      removeUndefinedFields({
        detail: formatAuthoredWorkDetail(workReferent, literatureDetail),
        href: getTagHref(tag, workReferent.canonicalKey),
        id: tag.lookupKey,
        knowledgeType: workReferent.knowledgeType,
        label: tag.label,
        ...(thumbnailUrl === undefined ? {} : { thumbnailUrl }),
      }),
    );
  }

  items.sort((left, right) => compareStrings(left.label, right.label));
  return items.length > 0 ? { items, title: "Seeded Works" } : null;
}

function getLiteratureFacts(
  detail: Doc<"literatureReferentDetails"> | null,
) {
  if (!detail) {
    return [];
  }

  return [
    toFact("Author", detail.author),
    toFact("Published", detail.yearPublished),
    toFact("Publisher", detail.publisher),
    toFact("Genres", detail.genres?.join(", ")),
    toFact("Subjects", detail.subjects?.join(", ")),
    toFact("Lexile", detail.lexileMeasure?.toString()),
    toFact("Approx. Word Count", formatWordCount(detail.approxWordCountK)),
    toFact(
      "Grade Range",
      formatRange(detail.approxGradeMin, detail.approxGradeMax),
    ),
    toFact("Setting", detail.settingLocation),
    toFact(
      "Historical Timeframe",
      formatYearRange(
        detail.historicalTimeframeStartYear,
        detail.historicalTimeframeEndYear,
      ),
    ),
  ].filter(isFact);
}

function getPersonFacts(detail: Doc<"personReferentDetails"> | null) {
  if (!detail) {
    return [];
  }

  return [
    toFact("Born", detail.birthDate),
    toFact("Died", detail.deathDate),
    toFact("Known For", detail.subjects?.join(", ")),
  ].filter(isFact);
}

function formatAuthorRelationDetail(
  reference: Doc<"literatureAuthorReferences">,
  detail: Doc<"personReferentDetails"> | null,
) {
  const role = reference.role.charAt(0).toUpperCase() + reference.role.slice(1);
  if (detail?.birthDate || detail?.deathDate) {
    return `${role} · ${[detail.birthDate, detail.deathDate].filter(Boolean).join("-")}`;
  }

  return role;
}

function formatAuthoredWorkDetail(
  work: Doc<"referents">,
  detail: Doc<"literatureReferentDetails"> | null,
) {
  return [formatKnowledgeType(work.knowledgeType), detail?.yearPublished]
    .filter(Boolean)
    .join(" · ");
}

function formatKnowledgeType(knowledgeType: Doc<"referents">["knowledgeType"]) {
  const words = knowledgeType.replace(/([a-z])([A-Z])/g, "$1 $2");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatWordCount(wordCountK: number | null | undefined) {
  if (typeof wordCountK !== "number") {
    return "";
  }

  return `${wordCountK.toLocaleString()}k words`;
}

function formatRange(
  start: number | null | undefined,
  end: number | null | undefined,
) {
  if (typeof start !== "number" || typeof end !== "number") {
    return "";
  }

  return start === end ? String(start) : `${start}-${end}`;
}

function formatYearRange(
  start: number | null | undefined,
  end: number | null | undefined,
) {
  if (typeof start !== "number" || typeof end !== "number") {
    return "";
  }

  return start === end
    ? formatHistoricalYear(start)
    : `${formatHistoricalYear(start)}-${formatHistoricalYear(end)}`;
}

function formatHistoricalYear(year: number) {
  return year < 0 ? `${Math.abs(year)} BC` : String(year);
}

function toFact(label: string, value: string | null | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? { label, value: trimmedValue } : null;
}

function isFact(value: ReferentPageFact | null): value is ReferentPageFact {
  return value !== null;
}

function isSection(
  value: ReferentPageSection | null,
): value is ReferentPageSection {
  return value !== null;
}

function isEntryAccessible(entry: Doc<"knowledgeEntries">, access: AllowedAccess) {
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
  access: AllowedAccess,
) {
  if (visibilityKind === "public") {
    return true;
  }

  if (visibilityKind === "private") {
    return targetKey === `user:${access.userId}` || targetKey === access.userId;
  }

  if (visibilityKind === "organization") {
    return access.organizations.some(
      (organization) => organization.organizationReferentId === targetKey,
    );
  }

  return false;
}

function getTagHref(tag: Doc<"tags">, canonicalKey: string) {
  if (tag.knowledgeType === "biblePassage") {
    return `/scripture/${encodeURIComponent(canonicalKey)}`;
  }

  return `/goto/${encodeURIComponent(canonicalKey)}`;
}

function removeUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
  ) as T;
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
