/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./lib/fileRepresentationRoles.ts": () =>
    import("./lib/fileRepresentationRoles"),
  "./lib/referentThumbnails.ts": () => import("./lib/referentThumbnails"),
  "./tagSuggestions.ts": () => import("./tagSuggestions"),
};

describe("Tag suggestion queries", () => {
  test("suggests existing Root Search Tags by label and alias", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedSuggestionRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const bookSuggestions = await authed.query(
      api.tagSuggestions.listRootSearchTagSuggestions,
      { query: "City of God", limit: 5 },
    );
    expect(bookSuggestions).toContainEqual(
      expect.objectContaining({
        href: "/goto/the-city-of-god",
        id: "the-city-of-god",
        knowledgeType: "book",
        label: "The City of God",
        tag: expect.objectContaining({
          thumbnailUrl: "https://images.example/city-of-god.png",
        }),
      }),
    );

    const questionSuggestions = await authed.query(
      api.tagSuggestions.listRootSearchTagSuggestions,
      { query: "Micah", limit: 5 },
    );
    expect(questionSuggestions).toContainEqual(
      expect.objectContaining({
        href: "/goto/student-crusades-question",
        id: "student-crusades-question",
        knowledgeType: "question",
        label: "Student Crusades Question",
        matchKind: "alias",
      }),
    );
  });

  test("resolves route slugs to live Tag Knowledge Types", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(async (ctx) => {
      const { userId } = await insertAllowedUser(ctx, "route-resolution");
      await insertTag(ctx, {
        canonicalKey: "the-wind-in-the-willows-kenneth-grahame",
        knowledgeType: "book",
        label: "The Wind In The Willows Kenneth Grahame",
      });

      return { userId };
    });
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const resolvedTags = await authed.query(
      api.tagSuggestions.resolveRouteActiveTags,
      { tagKeys: ["the-wind-in-the-willows-kenneth-grahame"] },
    );

    expect(resolvedTags).toEqual([
      expect.objectContaining({
        canonicalKey: "the-wind-in-the-willows-kenneth-grahame",
        href: "/goto/the-wind-in-the-willows-kenneth-grahame",
        id: "the-wind-in-the-willows-kenneth-grahame",
        knowledgeType: "book",
        label: "The Wind In The Willows Kenneth Grahame",
      }),
    ]);
  });

  test("does not suggest private Tags from inaccessible users or organizations", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAccessRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const rootSuggestions = await authed.query(
      api.tagSuggestions.listRootSearchTagSuggestions,
      { query: "Robinson", limit: 8 },
    );

    expect(rootSuggestions.map((suggestion) => suggestion.id)).toContain(
      "robinson-crusoe",
    );
    expect(rootSuggestions.map((suggestion) => suggestion.id)).not.toContain(
      "private-robinson-crusoe-notes",
    );
    expect(rootSuggestions.map((suggestion) => suggestion.id)).not.toContain(
      "outside-robinson-crusoe-unit",
    );
    expect(rootSuggestions.map((suggestion) => suggestion.id)).not.toContain(
      "hidden-robinson-crusoe-archive",
    );
  });

  test("allows Tags recognized by the user's accessible organization", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedRecognizedRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const suggestions = await authed.query(
      api.tagSuggestions.listRootSearchTagSuggestions,
      { query: "Grade 9", limit: 8 },
    );

    expect(suggestions.map((suggestion) => suggestion.id)).toContain(
      "grade-9-church-history",
    );
    expect(suggestions.map((suggestion) => suggestion.id)).not.toContain(
      "outside-grade-9-unit",
    );
  });

  test("excludes active Tags and ranks context-correlated navigator Tags first", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedCorrelationRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const suggestions = await authed.query(
      api.tagSuggestions.listKnowledgeNavigatorTagSuggestions,
      {
        activeTags: [
          {
            canonicalKey: "first-crusade",
            href: "/goto/first-crusade",
            id: "first-crusade",
            knowledgeType: "topic",
            label: "First Crusade",
          },
        ],
        query: "City",
        limit: 5,
      },
    );

    expect(suggestions.map((suggestion) => suggestion.id)).not.toContain(
      "first-crusade",
    );
    expect(suggestions[0]).toMatchObject({
      id: "the-city-of-god",
      label: "The City of God",
    });
    expect(suggestions.map((suggestion) => suggestion.id)).toContain(
      "city-planning",
    );
  });

  test("recommends related and recognized navigator Tags for the active context", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedRecommendedRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const contextSuggestions = await authed.query(
      api.tagSuggestions.listKnowledgeNavigatorRecommendedTags,
      {
        activeTags: [
          {
            canonicalKey: "first-crusade",
            href: "/goto/first-crusade",
            id: "first-crusade",
            knowledgeType: "topic",
            label: "First Crusade",
          },
        ],
        limit: 5,
      },
    );

    expect(contextSuggestions.map((suggestion) => suggestion.id)).not.toContain(
      "first-crusade",
    );
    expect(contextSuggestions[0]).toMatchObject({
      id: "the-city-of-god",
      label: "The City of God",
    });
    expect(contextSuggestions.map((suggestion) => suggestion.id)).toContain(
      "grade-9-church-history",
    );
    expect(contextSuggestions.map((suggestion) => suggestion.id)).not.toContain(
      "outside-grade-9-unit",
    );

    const rootSuggestions = await authed.query(
      api.tagSuggestions.listKnowledgeNavigatorRecommendedTags,
      { activeTags: [], limit: 5 },
    );

    expect(rootSuggestions[0]).toMatchObject({
      id: "student-crusades-question",
      label: "Student Crusades Question",
    });
    expect(rootSuggestions.map((suggestion) => suggestion.id)).toContain(
      "grade-9-church-history",
    );
    expect(rootSuggestions.map((suggestion) => suggestion.id)).not.toContain(
      "outside-grade-9-unit",
    );
  });

  test("tailors recommended Tags for represented literature pages without co-tags", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedLiteratureRecommendationRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const suggestions = await authed.query(
      api.tagSuggestions.listKnowledgeNavigatorRecommendedTags,
      {
        activeTags: [
          {
            canonicalKey: "the-wind-in-the-willows-kenneth-grahame",
            href: "/goto/the-wind-in-the-willows-kenneth-grahame",
            id: "the-wind-in-the-willows-kenneth-grahame",
            knowledgeType: "words",
            label: "The Wind In The Willows Kenneth Grahame",
          },
        ],
        limit: 5,
      },
    );

    expect(suggestions.map((suggestion) => suggestion.id)).not.toContain(
      "the-wind-in-the-willows-kenneth-grahame",
    );
    expect(suggestions[0]).toMatchObject({
      id: "the-reluctant-dragon-kenneth-grahame",
      label: "The Reluctant Dragon",
    });
  });
});

async function seedSuggestionRows(ctx: MutationCtx) {
  const { userId } = await insertAllowedUser(ctx, "suggestions");
  const city = await insertTag(ctx, {
    canonicalKey: "the-city-of-god",
    knowledgeType: "book",
    label: "The City of God",
  });
  const question = await insertTag(ctx, {
    canonicalKey: "student-crusades-question",
    knowledgeType: "question",
    label: "Student Crusades Question",
  });
  await insertAlias(ctx, city.tagId, "City of God", "book");
  await insertAlias(ctx, question.tagId, "Micah's Crusades Question", "question");
  const cityEntryId = await insertRepresentedEntry(ctx, city);
  await ctx.db.insert("entryRepresentations", {
    entryId: cityEntryId,
    representationKind: "externalUrl",
    representationRole: "thumbnail",
    externalUrl: "https://images.example/city-of-god.png",
    isPrimary: false,
    createdAt: 1,
    updatedAt: 1,
  });

  return { userId };
}

async function seedAccessRows(ctx: MutationCtx) {
  const { userId } = await insertAllowedUser(ctx, "access");
  const otherUserId = await insertUser(ctx, "outside-private");
  const outsideOrganization = await insertOrganization(ctx, "outside-school");
  await insertTag(ctx, {
    canonicalKey: "robinson-crusoe",
    knowledgeType: "book",
    label: "Robinson Crusoe",
  });
  const privateTag = await insertTag(ctx, {
    canonicalKey: "private-robinson-crusoe-notes",
    createdByUserId: otherUserId,
    knowledgeType: "book",
    label: "Private Robinson Crusoe Notes",
  });
  await insertRepresentedEntry(ctx, privateTag, {
    createdByUserId: otherUserId,
    visibilityKind: "private",
    visibilityTargetKey: `user:${otherUserId}`,
  });
  const hiddenSeededTag = await insertTag(ctx, {
    canonicalKey: "hidden-robinson-crusoe-archive",
    knowledgeType: "book",
    label: "Hidden Robinson Crusoe Archive",
  });
  await insertRepresentedEntry(ctx, hiddenSeededTag, {
    createdByUserId: otherUserId,
    visibilityKind: "private",
    visibilityTargetKey: `user:${otherUserId}`,
  });
  const outsideTag = await insertTag(ctx, {
    canonicalKey: "outside-robinson-crusoe-unit",
    createdByUserId: otherUserId,
    knowledgeType: "book",
    label: "Outside Robinson Crusoe Unit",
  });
  await ctx.db.insert("tagRecognitions", {
    tagId: outsideTag.tagId,
    recognizerKind: "organization",
    organizationReferentId: outsideOrganization.organizationReferentId,
    recognizedAt: 1,
    lastInteractedAt: 1,
  });

  return { userId };
}

async function seedRecognizedRows(ctx: MutationCtx) {
  const { organizationReferentId, userId } = await insertAllowedUser(
    ctx,
    "recognized",
  );
  const otherUserId = await insertUser(ctx, "recognized-other");
  const outsideOrganization = await insertOrganization(ctx, "recognized-outside");
  const recognizedTag = await insertTag(ctx, {
    canonicalKey: "grade-9-church-history",
    createdByUserId: otherUserId,
    knowledgeType: "group",
    label: "Grade 9 Church History",
  });
  const outsideTag = await insertTag(ctx, {
    canonicalKey: "outside-grade-9-unit",
    createdByUserId: otherUserId,
    knowledgeType: "group",
    label: "Outside Grade 9 Unit",
  });
  await ctx.db.insert("tagRecognitions", {
    tagId: recognizedTag.tagId,
    recognizerKind: "organization",
    organizationReferentId,
    recognizedAt: 1,
    lastInteractedAt: 2,
  });
  await ctx.db.insert("tagRecognitions", {
    tagId: outsideTag.tagId,
    recognizerKind: "organization",
    organizationReferentId: outsideOrganization.organizationReferentId,
    recognizedAt: 1,
    lastInteractedAt: 2,
  });

  return { userId };
}

async function seedCorrelationRows(ctx: MutationCtx) {
  const { userId } = await insertAllowedUser(ctx, "correlation");
  const firstCrusade = await insertTag(ctx, {
    canonicalKey: "first-crusade",
    knowledgeType: "topic",
    label: "First Crusade",
  });
  const cityOfGod = await insertTag(ctx, {
    canonicalKey: "the-city-of-god",
    knowledgeType: "book",
    label: "The City of God",
  });
  await insertTag(ctx, {
    canonicalKey: "city-planning",
    knowledgeType: "topic",
    label: "City Planning",
  });
  const entryId = await insertRepresentedEntry(ctx, cityOfGod, {
    createdByUserId: userId,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await ctx.db.insert("entryTags", {
    entryId,
    tagId: firstCrusade.tagId,
    tagPurpose: "context",
    taggedAt: 1,
    taggedByUserId: userId,
  });

  return { userId };
}

async function seedRecommendedRows(ctx: MutationCtx) {
  const { organizationReferentId, userId } = await insertAllowedUser(
    ctx,
    "recommendations",
  );
  const otherUserId = await insertUser(ctx, "recommendations-other");
  const outsideOrganization = await insertOrganization(
    ctx,
    "recommendations-outside",
  );
  const firstCrusade = await insertTag(ctx, {
    canonicalKey: "first-crusade",
    knowledgeType: "topic",
    label: "First Crusade",
  });
  const cityOfGod = await insertTag(ctx, {
    canonicalKey: "the-city-of-god",
    knowledgeType: "book",
    label: "The City of God",
  });
  const grade9 = await insertTag(ctx, {
    canonicalKey: "grade-9-church-history",
    createdByUserId: otherUserId,
    knowledgeType: "group",
    label: "Grade 9 Church History",
  });
  const question = await insertTag(ctx, {
    canonicalKey: "student-crusades-question",
    createdByUserId: otherUserId,
    knowledgeType: "question",
    label: "Student Crusades Question",
  });
  const outsideTag = await insertTag(ctx, {
    canonicalKey: "outside-grade-9-unit",
    createdByUserId: otherUserId,
    knowledgeType: "group",
    label: "Outside Grade 9 Unit",
  });
  const entryId = await insertRepresentedEntry(ctx, cityOfGod, {
    createdByUserId: userId,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await ctx.db.insert("entryTags", {
    entryId,
    tagId: firstCrusade.tagId,
    tagPurpose: "context",
    taggedAt: 1,
    taggedByUserId: userId,
  });
  await ctx.db.insert("tagRecognitions", {
    tagId: question.tagId,
    recognizerKind: "user",
    userId,
    recognizedAt: 1,
    lastInteractedAt: 3,
  });
  await ctx.db.insert("tagRecognitions", {
    tagId: grade9.tagId,
    recognizerKind: "organization",
    organizationReferentId,
    recognizedAt: 1,
    lastInteractedAt: 2,
  });
  await ctx.db.insert("tagRecognitions", {
    tagId: outsideTag.tagId,
    recognizerKind: "organization",
    organizationReferentId: outsideOrganization.organizationReferentId,
    recognizedAt: 1,
    lastInteractedAt: 4,
  });

  return { userId };
}

async function seedLiteratureRecommendationRows(ctx: MutationCtx) {
  const { userId } = await insertAllowedUser(ctx, "literature-recommendations");
  const windInTheWillows = await insertTag(ctx, {
    canonicalKey: "the-wind-in-the-willows-kenneth-grahame",
    knowledgeType: "book",
    label: "The Wind in the Willows",
  });
  const reluctantDragon = await insertTag(ctx, {
    canonicalKey: "the-reluctant-dragon-kenneth-grahame",
    knowledgeType: "shortStory",
    label: "The Reluctant Dragon",
  });
  const unrelatedRecentBook = await insertTag(ctx, {
    canonicalKey: "recent-unrelated-book",
    knowledgeType: "book",
    label: "Recent Unrelated Book",
  });

  const windEntryId = await insertRepresentedEntry(ctx, windInTheWillows, {
    searchText:
      "The Wind in the Willows Kenneth Grahame animal fantasy children's classic novel",
    updatedAt: 10,
  });
  await insertBookEntryDetail(ctx, windEntryId, {
    approxGradeMax: 7,
    approxGradeMin: 4,
    author: "Kenneth Grahame",
    genres: ["animal fantasy", "children's classic", "novel"],
    historicalTimeframeEndYear: 1908,
    historicalTimeframeStartYear: 1900,
  });

  const reluctantDragonEntryId = await insertRepresentedEntry(ctx, reluctantDragon, {
    searchText:
      "The Reluctant Dragon Kenneth Grahame children's literature fantasy short story",
    updatedAt: 9,
  });
  await insertShortStoryEntryDetail(ctx, reluctantDragonEntryId, {
    approxGradeMax: 6,
    approxGradeMin: 3,
    author: "Kenneth Grahame",
    genres: ["children's literature", "fantasy", "short story"],
    historicalTimeframeEndYear: 1898,
    historicalTimeframeStartYear: 1898,
  });

  const unrelatedRecentEntryId = await insertRepresentedEntry(
    ctx,
    unrelatedRecentBook,
    {
      searchText: "Recent Unrelated Book engineering handbook",
      updatedAt: 100,
    },
  );
  await insertBookEntryDetail(ctx, unrelatedRecentEntryId, {
    approxGradeMax: 12,
    approxGradeMin: 9,
    author: "Other Author",
    genres: ["technical manual"],
    historicalTimeframeEndYear: 2000,
    historicalTimeframeStartYear: 2000,
  });

  return { userId };
}

async function insertAllowedUser(ctx: MutationCtx, slug: string) {
  const userId = await insertUser(ctx, slug);
  const personReferentId = await ctx.db.insert("referents", {
    canonicalKey: `person-${slug}`,
    canonicalName: `Person ${slug}`,
    knowledgeType: "person",
  });
  const organization = await insertOrganization(ctx, `${slug}-organization`);

  await ctx.db.insert("memberships", {
    personReferentId,
    memberUserId: userId,
    targetKind: "organization",
    organizationReferentId: organization.organizationReferentId,
    membershipStatus: "active",
    memberRole: "admin",
    createdAt: 1,
    updatedAt: 1,
  });

  return { ...organization, userId };
}

async function insertUser(ctx: MutationCtx, slug: string) {
  return await ctx.db.insert("users", {
    email: `${slug}@example.com`,
    isActive: true,
    name: `User ${slug}`,
  });
}

async function insertOrganization(ctx: MutationCtx, slug: string) {
  const organization = await insertTag(ctx, {
    canonicalKey: `${slug}-organization`,
    knowledgeType: "organization",
    label: `${slug} Organization`,
  });
  const organizationEntryId = await insertRepresentedEntry(ctx, organization, {
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await ctx.db.insert("organizationEntries", {
    entryId: organizationEntryId,
    organizationKind: "school",
    isActive: true,
  });

  return {
    organizationEntryId,
    organizationReferentId: organization.referentId,
  };
}

async function insertTag(
  ctx: MutationCtx,
  tag: {
    canonicalKey: string;
    createdByUserId?: Id<"users">;
    knowledgeType: Doc<"referents">["knowledgeType"];
    label: string;
  },
) {
  const referentId = await ctx.db.insert("referents", {
    knowledgeType: tag.knowledgeType,
    canonicalKey: tag.canonicalKey,
    canonicalName: tag.label,
  });
  const tagId = await ctx.db.insert("tags", {
    referentId,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    lookupKey: tag.canonicalKey,
    ...(tag.createdByUserId === undefined
      ? {}
      : { createdByUserId: tag.createdByUserId }),
  });

  return {
    referentId,
    tagId,
    ...tag,
  };
}

async function insertAlias(
  ctx: MutationCtx,
  tagId: Id<"tags">,
  label: string,
  knowledgeType: Doc<"referents">["knowledgeType"],
) {
  await ctx.db.insert("tagAliases", {
    tagId,
    knowledgeType,
    label,
    lookupKey: label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    aliasKind: "alternateName",
    createdAt: 1,
  });
}

async function insertRepresentedEntry(
  ctx: MutationCtx,
  tag: {
    createdByUserId?: Id<"users">;
    knowledgeType: Doc<"referents">["knowledgeType"];
    label: string;
    referentId: Id<"referents">;
    tagId: Id<"tags">;
  },
  entry: {
    createdByUserId?: Id<"users">;
    searchText?: string;
    updatedAt?: number;
    visibilityKind?: Doc<"knowledgeEntries">["visibilityKind"];
    visibilityTargetKey?: string;
  } = {},
) {
  const visibilityKind = entry.visibilityKind ?? "public";
  const visibilityTargetKey =
    entry.visibilityTargetKey ?? (visibilityKind === "public" ? "public" : "");
  const entryId = await ctx.db.insert("knowledgeEntries", {
    knowledgeType:
      tag.knowledgeType === "biblePassage" ? "words" : tag.knowledgeType,
    representedReferentId: tag.referentId,
    primaryTagId: tag.tagId,
    title: tag.label,
    previewText: `${tag.label} preview`,
    searchText: entry.searchText ?? tag.label,
    primaryTagLabel: tag.label,
    contextPreviewTagLabels: [],
    visibilityKind,
    visibilityTargetKey,
    discoverabilityKind: visibilityKind,
    discoverabilityTargetKey: visibilityTargetKey,
    ...((entry.createdByUserId ?? tag.createdByUserId) === undefined
      ? {}
      : { createdByUserId: entry.createdByUserId ?? tag.createdByUserId }),
    createdAt: 1,
    updatedAt: entry.updatedAt ?? 1,
  });
  const taggedByUserId = entry.createdByUserId ?? tag.createdByUserId;
  await ctx.db.insert("entryTags", {
    entryId,
    tagId: tag.tagId,
    tagPurpose: "represented",
    taggedAt: 1,
    ...(taggedByUserId === undefined ? {} : { taggedByUserId }),
  });

  return entryId;
}

async function insertBookEntryDetail(
  ctx: MutationCtx,
  entryId: Id<"knowledgeEntries">,
  detail: LiteratureTestDetail,
) {
  await ctx.db.insert("bookEntries", { entryId, ...detail });
}

async function insertShortStoryEntryDetail(
  ctx: MutationCtx,
  entryId: Id<"knowledgeEntries">,
  detail: LiteratureTestDetail,
) {
  await ctx.db.insert("shortStoryEntries", { entryId, ...detail });
}

type LiteratureTestDetail = {
  approxGradeMax: number;
  approxGradeMin: number;
  author: string;
  genres: string[];
  historicalTimeframeEndYear: number;
  historicalTimeframeStartYear: number;
};
