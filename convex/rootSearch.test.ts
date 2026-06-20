/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./rootSearch.ts": () => import("./rootSearch"),
};

describe("Root Search results", () => {
  test("returns page-oriented results with matched entry previews", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPageResultRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const results = await authed.query(api.rootSearch.listRootSearchResults, {
      query: "ordered loves",
      limit: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      canonicalKey: "the-city-of-god",
      href: "/goto/the-city-of-god",
      id: "the-city-of-god",
      knowledgeType: "book",
      label: "The City of God",
      matchedEntryPreview: {
        href: "/goto/the-city-of-god",
        knowledgeType: "book",
        previewText:
          "A represented Book entry preview about Augustine and ordered loves.",
        primaryTagLabel: "The City of God",
        title: "The City of God and Ordered Loves",
      },
      scopeLabel: "Global",
      tag: {
        href: "/goto/the-city-of-god",
        id: "the-city-of-god",
        label: "The City of God",
      },
    });
    expect(results[0].matchedEntryPreview?.href).not.toMatch(/^\/entries\//);
  });

  test("does not leak private or outside-organization results", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAccessRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const results = await authed.query(api.rootSearch.listRootSearchResults, {
      query: "Robinson",
      limit: 8,
    });
    const resultIds = results.map((result) => result.id);

    expect(resultIds).toContain("robinson-crusoe");
    expect(resultIds).toContain("arche-robinson-crusoe-unit");
    expect(resultIds).not.toContain("private-robinson-crusoe-notes");
    expect(resultIds).not.toContain("outside-robinson-crusoe-unit");
    expect(results.every((result) => result.href.startsWith("/goto/"))).toBe(true);
  });

  test("returns public Tag-only Referent Page results without previews", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedTagOnlyRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const results = await authed.query(api.rootSearch.listRootSearchResults, {
      query: "Robinson Crusoe",
      limit: 5,
    });

    const result = results.find(
      (searchResult) => searchResult.id === "robinson-crusoe",
    );
    expect(result).toMatchObject({
      canonicalKey: "robinson-crusoe",
      href: "/goto/robinson-crusoe",
      knowledgeType: "book",
      label: "Robinson Crusoe",
      scopeLabel: "Global",
    });
    expect(result?.matchedEntryPreview).toBeUndefined();
  });

  test("returns alias and Question Tag-only Referent Page results", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAliasRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const results = await authed.query(api.rootSearch.listRootSearchResults, {
      query: "Micah",
      limit: 5,
    });

    const result = results.find(
      (searchResult) => searchResult.id === "student-crusades-question",
    );
    expect(result).toMatchObject({
      canonicalKey: "student-crusades-question",
      href: "/goto/student-crusades-question",
      knowledgeType: "question",
      label: "Student Crusades Question",
    });
    expect(result?.matchedEntryPreview).toBeUndefined();
  });

  test("does not leak inaccessible Tag-only results or private previews", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedTagOnlyAccessRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const results = await authed.query(api.rootSearch.listRootSearchResults, {
      query: "Robinson",
      limit: 8,
    });
    const resultIds = results.map((result) => result.id);

    expect(resultIds).toContain("robinson-crusoe");
    expect(resultIds).not.toContain("private-robinson-crusoe-notes");
    expect(resultIds).not.toContain("outside-robinson-crusoe-unit");
    expect(
      results.some((result) =>
        result.matchedEntryPreview?.title.includes("Private Robinson Crusoe"),
      ),
    ).toBe(false);
  });

  test("ranks exact Tag matches before weaker entry text matches", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedRankingRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const results = await authed.query(api.rootSearch.listRootSearchResults, {
      query: "Robinson Crusoe",
      limit: 5,
    });

    expect(results.map((result) => result.id)).toEqual([
      "robinson-crusoe",
      "crusoe-classroom-notes",
    ]);
  });

  test("returns no results for blank root searches", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPageResultRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    await expect(
      authed.query(api.rootSearch.listRootSearchResults, {
        query: "   ",
        limit: 5,
      }),
    ).resolves.toEqual([]);
  });
});

async function seedPageResultRows(ctx: MutationCtx) {
  const { userId } = await insertAllowedUser(ctx, "page-result");
  const cityOfGod = await insertTag(ctx, {
    canonicalKey: "the-city-of-god",
    knowledgeType: "book",
    label: "The City of God",
  });

  await insertRepresentedEntry(ctx, cityOfGod, {
    previewText:
      "A represented Book entry preview about Augustine and ordered loves.",
    searchText:
      "The City of God and Ordered Loves Augustine disordered loves earthly city",
    title: "The City of God and Ordered Loves",
  });
  await insertRepresentedEntry(ctx, cityOfGod, {
    previewText: "A duplicate represented entry that should not create a page.",
    searchText: "ordered loves duplicate",
    title: "Duplicate City of God Match",
    updatedAt: 1,
  });

  return { userId };
}

async function seedAccessRows(ctx: MutationCtx) {
  const { organizationReferentId, userId } = await insertAllowedUser(ctx, "access");
  const outsideOrganization = await insertOrganization(ctx, "outside-school");
  const otherUserId = await insertUser(ctx, "outside-private");

  await insertRepresentedEntry(
    ctx,
    await insertTag(ctx, {
      canonicalKey: "robinson-crusoe",
      knowledgeType: "book",
      label: "Robinson Crusoe",
    }),
    {
      searchText: "Robinson Crusoe public book",
      title: "Robinson Crusoe",
    },
  );
  await insertRepresentedEntry(
    ctx,
    await insertTag(ctx, {
      canonicalKey: "arche-robinson-crusoe-unit",
      knowledgeType: "lesson",
      label: "Arche Robinson Crusoe Unit",
    }),
    {
      searchText: "Robinson Crusoe school unit",
      title: "Arche Robinson Crusoe Unit",
      visibilityKind: "organization",
      visibilityTargetKey: organizationReferentId,
    },
  );
  await insertRepresentedEntry(
    ctx,
    await insertTag(ctx, {
      canonicalKey: "private-robinson-crusoe-notes",
      knowledgeType: "book",
      label: "Private Robinson Crusoe Notes",
    }),
    {
      createdByUserId: otherUserId,
      searchText: "Robinson Crusoe private notes",
      title: "Private Robinson Crusoe Notes",
      visibilityKind: "private",
      visibilityTargetKey: `user:${otherUserId}`,
    },
  );
  await insertRepresentedEntry(
    ctx,
    await insertTag(ctx, {
      canonicalKey: "outside-robinson-crusoe-unit",
      knowledgeType: "lesson",
      label: "Outside Robinson Crusoe Unit",
    }),
    {
      searchText: "Robinson Crusoe outside school unit",
      title: "Outside Robinson Crusoe Unit",
      visibilityKind: "organization",
      visibilityTargetKey: outsideOrganization.organizationReferentId,
    },
  );

  return { userId };
}

async function seedTagOnlyRows(ctx: MutationCtx) {
  const { userId } = await insertAllowedUser(ctx, "tag-only");
  await insertTag(ctx, {
    canonicalKey: "robinson-crusoe",
    knowledgeType: "book",
    label: "Robinson Crusoe",
  });

  return { userId };
}

async function seedAliasRows(ctx: MutationCtx) {
  const { userId } = await insertAllowedUser(ctx, "alias");
  const question = await insertTag(ctx, {
    canonicalKey: "student-crusades-question",
    knowledgeType: "question",
    label: "Student Crusades Question",
  });
  await insertAlias(ctx, question.tagId, "Micah's Crusades Question", "question");

  return { userId };
}

async function seedTagOnlyAccessRows(ctx: MutationCtx) {
  const { userId } = await insertAllowedUser(ctx, "tag-only-access");
  const otherUserId = await insertUser(ctx, "tag-only-private");
  const outsideOrganization = await insertOrganization(ctx, "tag-only-outside");
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
    searchText: "Private Robinson Crusoe notes",
    title: "Private Robinson Crusoe Notes",
    visibilityKind: "private",
    visibilityTargetKey: `user:${otherUserId}`,
  });
  const outsideTag = await insertTag(ctx, {
    canonicalKey: "outside-robinson-crusoe-unit",
    createdByUserId: otherUserId,
    knowledgeType: "lesson",
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

async function seedRankingRows(ctx: MutationCtx) {
  const { userId } = await insertAllowedUser(ctx, "ranking");
  await insertTag(ctx, {
    canonicalKey: "robinson-crusoe",
    knowledgeType: "book",
    label: "Robinson Crusoe",
  });
  await insertRepresentedEntry(
    ctx,
    await insertTag(ctx, {
      canonicalKey: "crusoe-classroom-notes",
      knowledgeType: "lesson",
      label: "Crusoe Classroom Notes",
    }),
    {
      searchText: "Robinson Crusoe appears in a broader classroom note.",
      title: "Classroom Notes on Adventure Literature",
    },
  );

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
    searchText: `${slug} Organization`,
    title: `${slug} Organization`,
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
    lookupKey: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    aliasKind: "alternateName",
    createdAt: 1,
  });
}

async function insertRepresentedEntry(
  ctx: MutationCtx,
  tag: {
    knowledgeType: Doc<"referents">["knowledgeType"];
    label: string;
    referentId: Id<"referents">;
    tagId: Id<"tags">;
  },
  entry: {
    createdByUserId?: Id<"users">;
    previewText?: string;
    searchText: string;
    title: string;
    updatedAt?: number;
    visibilityKind?: Doc<"knowledgeEntries">["visibilityKind"];
    visibilityTargetKey?: Id<"referents"> | string;
  },
) {
  const visibilityKind = entry.visibilityKind ?? "public";
  const visibilityTargetKey =
    entry.visibilityTargetKey ?? (visibilityKind === "public" ? "public" : "");
  const entryId = await ctx.db.insert("knowledgeEntries", {
    knowledgeType:
      tag.knowledgeType === "biblePassage" ? "words" : tag.knowledgeType,
    representedReferentId: tag.referentId,
    primaryTagId: tag.tagId,
    title: entry.title,
    previewText: entry.previewText ?? `${entry.title} preview`,
    searchText: entry.searchText,
    primaryTagLabel: tag.label,
    contextPreviewTagLabels: [tag.label],
    humanWeight: 80,
    visibilityKind,
    visibilityTargetKey,
    discoverabilityKind: visibilityKind,
    discoverabilityTargetKey: visibilityTargetKey,
    ...(entry.createdByUserId === undefined
      ? {}
      : { createdByUserId: entry.createdByUserId }),
    createdAt: 1,
    updatedAt: entry.updatedAt ?? 2,
  });
  await ctx.db.insert("entryTags", {
    entryId,
    tagId: tag.tagId,
    tagPurpose: "represented",
    taggedAt: 1,
  });

  return entryId;
}
