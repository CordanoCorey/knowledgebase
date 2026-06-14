/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./answerFeed.ts": () => import("./answerFeed"),
};

const BASE_TIME = Date.UTC(2026, 5, 1, 12);

describe("Answer Feed backend adapter", () => {
  test("matches Entries by containing every active Tag and allows extra Tags", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      answerLimit: 10,
      slotLimit: 10,
    });

    const answerTitles = feedItems
      .filter((item) => item.kind === "answer")
      .map((item) => item.entry.title);

    expect(answerTitles).toEqual([
      "High Weight Matching Lesson",
      "Extra Tag Matching Answer",
      "Lower Weight Matching Answer",
    ]);
    expect(answerTitles).not.toContain("Missing Holy Spirit Answer");
  });

  test("returns compact Answer and Slot summaries that match the frontend contract", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      answerLimit: 10,
      slotLimit: 10,
    });

    expect(feedItems).toContainEqual({
      kind: "answer",
      entry: {
        contributor: {
          id: seed.users.ada,
          name: "Ada Teacher",
        },
        id: seed.entries.highWeight,
        title: "High Weight Matching Lesson",
        knowledgeType: "lesson",
        previewText: "A high-weight lesson preview.",
        primaryTagLabel: "High Weight Matching Lesson",
        contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
        humanWeight: 96,
        href: `/entries/${seed.entries.highWeight}`,
        updatedAt: BASE_TIME + 3,
      },
    });
    expect(feedItems).toContainEqual({
      kind: "slot",
      slot: {
        id: seed.slots.matching,
        title: "Requested future Answer",
        requestedKnowledgeType: "lesson",
        promptText: "Contribute a future Answer for this Knowledge Context.",
        status: "open",
        contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
        targetLabel: "Public",
        dueAt: BASE_TIME + 30,
        href: `/slots/${seed.slots.matching}`,
      },
    });
    expect(
      feedItems.some(
        (item) =>
          item.kind === "slot" && item.slot.title === "Missing Holy Spirit Slot",
      ),
    ).toBe(false);
  });

  test("ranks context experts from reliable matching contributors", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    const experts = await t.query(api.answerFeed.listExpertsForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      expertLimit: 3,
    });

    expect(experts).toEqual([
      {
        id: seed.users.ada,
        name: "Ada Teacher",
        averageHumanWeight: 84,
        contributionCount: 2,
        reliabilityScore: 109,
      },
      {
        id: seed.users.ben,
        name: "Ben Scholar",
        averageHumanWeight: 88,
        contributionCount: 1,
        reliabilityScore: 100,
      },
    ]);
  });

  test("keeps results bounded and deterministic", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tags.holySpirit, seed.tags.romans],
      answerLimit: 2,
      slotLimit: 1,
    });

    expect(feedItems.map((item) => item.kind)).toEqual([
      "answer",
      "answer",
      "slot",
    ]);
    expect(
      feedItems
        .filter((item) => item.kind === "answer")
        .map((item) => item.entry.title),
    ).toEqual(["High Weight Matching Lesson", "Extra Tag Matching Answer"]);
    expect(
      feedItems
        .filter((item) => item.kind === "slot")
        .map((item) => item.slot.title),
    ).toEqual(["Requested future Answer"]);
  });
});

async function seedAnswerFeedRows(ctx: MutationCtx) {
  const adaUserId = await insertUser(ctx, {
    email: "ada.teacher@example.com",
    name: "Ada Teacher",
  });
  const benUserId = await insertUser(ctx, {
    email: "ben.scholar@example.com",
    name: "Ben Scholar",
  });
  const romans = await insertTag(ctx, {
    canonicalKey: "romans-8-28",
    knowledgeType: "biblePassage",
    label: "Romans 8:28",
  });
  const holySpirit = await insertTag(ctx, {
    canonicalKey: "holy-spirit",
    knowledgeType: "topic",
    label: "Holy Spirit",
  });
  const atonement = await insertTag(ctx, {
    canonicalKey: "atonement",
    knowledgeType: "topic",
    label: "Atonement",
  });

  const lowerWeight = await insertEntry(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId],
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    createdByUserId: adaUserId,
    humanWeight: 72,
    knowledgeType: "words",
    previewText: "A lower-weight answer preview.",
    title: "Lower Weight Matching Answer",
    updatedAt: BASE_TIME + 1,
  });
  const extraTag = await insertEntry(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId, atonement.tagId],
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit", "Atonement"],
    createdByUserId: benUserId,
    humanWeight: 88,
    knowledgeType: "words",
    previewText: "An answer with an extra Tag preview.",
    title: "Extra Tag Matching Answer",
    updatedAt: BASE_TIME + 2,
  });
  const highWeight = await insertEntry(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId],
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    createdByUserId: adaUserId,
    humanWeight: 96,
    knowledgeType: "lesson",
    previewText: "A high-weight lesson preview.",
    title: "High Weight Matching Lesson",
    updatedAt: BASE_TIME + 3,
  });
  const missingHolySpirit = await insertEntry(ctx, {
    contextTagIds: [romans.tagId],
    contextPreviewTagLabels: ["Romans 8:28"],
    createdByUserId: benUserId,
    humanWeight: 100,
    knowledgeType: "words",
    previewText: "This answer is broader than the active Knowledge Context.",
    title: "Missing Holy Spirit Answer",
    updatedAt: BASE_TIME + 4,
  });

  const matchingSlot = await insertSlot(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId],
    promptText: "Contribute a future Answer for this Knowledge Context.",
    requestedKnowledgeType: "lesson",
    title: "Requested future Answer",
  });
  const missingHolySpiritSlot = await insertSlot(ctx, {
    contextTagIds: [romans.tagId],
    requestedKnowledgeType: "words",
    title: "Missing Holy Spirit Slot",
  });

  return {
    entries: {
      extraTag,
      highWeight,
      lowerWeight,
      missingHolySpirit,
    },
    slots: {
      matching: matchingSlot,
      missingHolySpirit: missingHolySpiritSlot,
    },
    tags: {
      atonement: atonement.tagId,
      holySpirit: holySpirit.tagId,
      romans: romans.tagId,
    },
    users: {
      ada: adaUserId,
      ben: benUserId,
    },
  };
}

async function insertUser(
  ctx: MutationCtx,
  user: {
    email: string;
    name: string;
  },
) {
  return await ctx.db.insert("users", {
    email: user.email,
    isActive: true,
    name: user.name,
  });
}

async function insertTag(
  ctx: MutationCtx,
  tag: {
    canonicalKey: string;
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
  });

  return { referentId, tagId };
}

async function insertEntry(
  ctx: MutationCtx,
  entry: {
    contextPreviewTagLabels: string[];
    contextTagIds: Array<Id<"tags">>;
    createdByUserId: Id<"users">;
    humanWeight: number;
    knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
    previewText: string;
    title: string;
    updatedAt: number;
  },
) {
  const primary = await insertTag(ctx, {
    canonicalKey: slugify(entry.title),
    knowledgeType: entry.knowledgeType,
    label: entry.title,
  });
  const entryId = await ctx.db.insert("knowledgeEntries", {
    knowledgeType: entry.knowledgeType,
    representedReferentId: primary.referentId,
    primaryTagId: primary.tagId,
    title: entry.title,
    previewText: entry.previewText,
    searchText: `${entry.title} ${entry.previewText}`,
    primaryTagLabel: entry.title,
    contextPreviewTagLabels: entry.contextPreviewTagLabels,
    createdByUserId: entry.createdByUserId,
    humanWeight: entry.humanWeight,
    visibilityKind: "public",
    visibilityTargetKey: "public",
    discoverabilityKind: "public",
    discoverabilityTargetKey: "public",
    createdAt: BASE_TIME,
    updatedAt: entry.updatedAt,
  });

  await ctx.db.insert("entryTags", {
    entryId,
    tagId: primary.tagId,
    tagPurpose: "represented",
    taggedAt: BASE_TIME,
  });
  for (const tagId of entry.contextTagIds) {
    await ctx.db.insert("entryTags", {
      entryId,
      tagId,
      tagPurpose: "context",
      taggedAt: BASE_TIME,
    });
  }

  return entryId;
}

async function insertSlot(
  ctx: MutationCtx,
  slot: {
    contextTagIds: Array<Id<"tags">>;
    promptText?: string;
    requestedKnowledgeType: Doc<"knowledgeSlots">["requestedKnowledgeType"];
    title: string;
  },
) {
  const slotId = await ctx.db.insert("knowledgeSlots", {
    requestedKnowledgeType: slot.requestedKnowledgeType,
    status: "open",
    title: slot.title,
    ...(slot.promptText === undefined ? {} : { promptText: slot.promptText }),
    contextKey: getContextKey(slot.contextTagIds),
    targetKind: "public",
    dueAt: BASE_TIME + 30,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });

  for (const tagId of slot.contextTagIds) {
    await ctx.db.insert("slotTags", {
      slotId,
      tagId,
      addedAt: BASE_TIME,
    });
  }

  return slotId;
}

function getContextKey(tagIds: Array<Id<"tags">>) {
  return `tags:${[...tagIds].sort().join(",")}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
