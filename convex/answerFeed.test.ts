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
  "./lib/humanWeightEvidence.ts": () => import("./lib/humanWeightEvidence"),
  "./lib/typeBehavior.ts": () => import("./lib/typeBehavior"),
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
      "Unscored Matching Lesson",
      "Non Weight Matching Topic",
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
        evidenceMaturity: 60,
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

    const nonWeightBearingItem = feedItems.find(
      (item) =>
        item.kind === "answer" && item.entry.title === "Non Weight Matching Topic",
    );
    expect(nonWeightBearingItem?.kind).toBe("answer");
    if (nonWeightBearingItem?.kind !== "answer") {
      throw new Error("Expected non-weight-bearing topic Answer in feed.");
    }
    expect(nonWeightBearingItem.entry.knowledgeType).toBe("topic");
    expect(nonWeightBearingItem.entry).not.toHaveProperty("humanWeight");
    expect(nonWeightBearingItem.entry).not.toHaveProperty("evidenceMaturity");
  });

  test("ranks context experts by Context Expertise from matching contributors", async () => {
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
        contextExpertiseScore: 109,
      },
      {
        id: seed.users.ben,
        name: "Ben Scholar",
        averageHumanWeight: 88,
        contributionCount: 1,
        contextExpertiseScore: 100,
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

  test("surfaces recent unscored global Answers that need Human Weight feedback", async () => {
    const t = convexTest({ schema, modules });
    await t.run(seedGlobalFeedbackPriorityRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [],
      answerLimit: 1,
      slotLimit: 0,
    });

    expect(feedItems).toHaveLength(1);
    expect(feedItems[0]).toMatchObject({
      kind: "answer",
      entry: {
        knowledgeType: "lesson",
        title: "Recent Unscored Lesson",
      },
    });
    if (feedItems[0].kind !== "answer") {
      throw new Error("Expected global feedback priority item to be an Answer.");
    }
    expect(feedItems[0].entry).not.toHaveProperty("humanWeight");
  });

  test("uses Evidence Maturity as a secondary Answer priority signal", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedEvidenceMaturityPriorityRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tagId],
      answerLimit: 2,
      slotLimit: 0,
    });

    expect(
      feedItems
        .filter((item) => item.kind === "answer")
        .map((item) => item.entry.title),
    ).toEqual(["Mature Same Weight Answer", "Fresh Same Weight Answer"]);
    expect(feedItems[0]).toMatchObject({
      kind: "answer",
      entry: {
        evidenceMaturity: 100,
        humanWeight: 70,
        title: "Mature Same Weight Answer",
      },
    });
  });

  test("surfaces Human Weight Concern only when low weight violates the applicable expectation", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedHumanWeightConcernRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tagId],
      answerLimit: 10,
      slotLimit: 0,
    });

    const answers = feedItems.filter((item) => item.kind === "answer");
    const lowEssay = getAnswerByTitle(answers, "Low Expected Essay");
    const requiredSlotEssay = getAnswerByTitle(
      answers,
      "Slot Required Essay",
    );
    const lowLesson = getAnswerByTitle(answers, "Low Informative Lesson");
    const nonWeightBearingTopic = getAnswerByTitle(
      answers,
      "Low Non Weight Topic",
    );
    const requiredSlotTopic = getAnswerByTitle(
      answers,
      "Required Slot Topic",
    );

    expect(lowEssay.entry.humanWeightConcern).toEqual({
      level: "possibleConcern",
      expectation: "expected",
      threshold: 40,
    });
    expect(requiredSlotEssay.entry.humanWeightConcern).toEqual({
      level: "reviewRecommended",
      expectation: "required",
      threshold: 60,
    });
    expect(lowLesson.entry).not.toHaveProperty("humanWeightConcern");
    expect(nonWeightBearingTopic.entry).not.toHaveProperty("humanWeightConcern");
    expect(requiredSlotTopic.entry).not.toHaveProperty("humanWeightConcern");
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
  await insertHumanWeightFeedback(ctx, {
    entryId: highWeight,
    feedbackKind: "recognize",
    userId: adaUserId,
  });
  await insertHumanWeightFeedback(ctx, {
    entryId: highWeight,
    feedbackKind: "used",
    userId: benUserId,
  });
  await insertHumanWeightFeedback(ctx, {
    entryId: highWeight,
    feedbackKind: "wrongContext",
    userId: benUserId,
  });
  const nonWeightBearingTopic = await insertEntry(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId],
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    createdByUserId: benUserId,
    knowledgeType: "topic",
    previewText: "A non-weight-bearing topic preview.",
    title: "Non Weight Matching Topic",
    updatedAt: BASE_TIME + 5,
  });
  const unscoredWeightBearingLesson = await insertEntry(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId],
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    createdByUserId: adaUserId,
    knowledgeType: "lesson",
    previewText: "A weight-bearing lesson that needs Human Weight evidence.",
    title: "Unscored Matching Lesson",
    updatedAt: BASE_TIME,
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
      nonWeightBearingTopic,
      unscoredWeightBearingLesson,
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

async function seedEvidenceMaturityPriorityRows(ctx: MutationCtx) {
  const userId = await insertUser(ctx, {
    email: "maturity-priority@example.com",
    name: "Maturity Priority",
  });
  const reviewerUserId = await insertUser(ctx, {
    email: "maturity-reviewer@example.com",
    name: "Maturity Reviewer",
  });
  const tag = await insertTag(ctx, {
    canonicalKey: "evidence-maturity",
    knowledgeType: "topic",
    label: "Evidence Maturity",
  });
  const matureEntryId = await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Evidence Maturity"],
    createdByUserId: userId,
    humanWeight: 70,
    knowledgeType: "lesson",
    previewText: "An answer with settled Human Weight evidence.",
    title: "Mature Same Weight Answer",
    updatedAt: BASE_TIME,
  });
  await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Evidence Maturity"],
    createdByUserId: userId,
    humanWeight: 70,
    knowledgeType: "lesson",
    previewText: "A newer answer without Human Weight evidence yet.",
    title: "Fresh Same Weight Answer",
    updatedAt: BASE_TIME + 50,
  });

  for (const feedbackKind of [
    "recognize",
    "used",
    "notHuman",
    "wrongContext",
  ] as const) {
    await insertHumanWeightFeedback(ctx, {
      entryId: matureEntryId,
      feedbackKind,
      userId,
    });
  }
  await insertHumanWeightFeedback(ctx, {
    entryId: matureEntryId,
    feedbackKind: "used",
    userId: reviewerUserId,
  });

  return { tagId: tag.tagId };
}

async function seedGlobalFeedbackPriorityRows(ctx: MutationCtx) {
  const userId = await insertUser(ctx, {
    email: "global-feedback@example.com",
    name: "Global Feedback",
  });

  for (let index = 0; index < 30; index += 1) {
    await insertEntry(ctx, {
      contextTagIds: [],
      contextPreviewTagLabels: [],
      createdByUserId: userId,
      humanWeight: 20,
      knowledgeType: "words",
      previewText: "A low-scored global Answer.",
      title: `Low Scored Answer ${index}`,
      updatedAt: BASE_TIME + index,
    });
  }

  await insertEntry(ctx, {
    contextTagIds: [],
    contextPreviewTagLabels: [],
    createdByUserId: userId,
    knowledgeType: "lesson",
    previewText: "A recent lesson that needs Human Weight feedback.",
    title: "Recent Unscored Lesson",
    updatedAt: BASE_TIME + 1_000,
  });
}

async function seedHumanWeightConcernRows(ctx: MutationCtx) {
  const userId = await insertUser(ctx, {
    email: "human-weight-concern@example.com",
    name: "Human Weight Concern",
  });
  const tag = await insertTag(ctx, {
    canonicalKey: "human-weight-concern",
    knowledgeType: "topic",
    label: "Human Weight Concern",
  });

  await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Concern"],
    createdByUserId: userId,
    humanWeight: 35,
    knowledgeType: "essay",
    previewText: "An expected essay with low Human Weight.",
    title: "Low Expected Essay",
    updatedAt: BASE_TIME + 3,
  });
  const requiredSlotEssay = await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Concern"],
    createdByUserId: userId,
    humanWeight: 45,
    knowledgeType: "essay",
    previewText: "An essay above the expected threshold but below required.",
    title: "Slot Required Essay",
    updatedAt: BASE_TIME + 4,
  });
  await insertSlot(ctx, {
    contextTagIds: [tag.tagId],
    fulfilledEntryId: requiredSlotEssay,
    humanWeightExpectation: "required",
    requestedKnowledgeType: "essay",
    status: "fulfilled",
    title: "Required student Essay",
  });
  await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Concern"],
    createdByUserId: userId,
    humanWeight: 35,
    knowledgeType: "lesson",
    previewText: "A low-weight lesson where Human Weight is only informative.",
    title: "Low Informative Lesson",
    updatedAt: BASE_TIME + 2,
  });
  await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Concern"],
    createdByUserId: userId,
    humanWeight: 5,
    knowledgeType: "topic",
    previewText: "A non-weight-bearing topic should not carry concern.",
    title: "Low Non Weight Topic",
    updatedAt: BASE_TIME + 1,
  });
  const requiredSlotTopic = await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Concern"],
    createdByUserId: userId,
    humanWeight: 5,
    knowledgeType: "topic",
    previewText: "A non-weight-bearing fulfilled topic stays unflagged.",
    title: "Required Slot Topic",
    updatedAt: BASE_TIME,
  });
  await insertSlot(ctx, {
    contextTagIds: [tag.tagId],
    fulfilledEntryId: requiredSlotTopic,
    humanWeightExpectation: "required",
    requestedKnowledgeType: "topic",
    status: "fulfilled",
    title: "Required topic Slot",
  });

  return { tagId: tag.tagId };
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
    humanWeight?: number;
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
    ...(entry.humanWeight === undefined
      ? {}
      : { humanWeight: entry.humanWeight }),
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
    fulfilledEntryId?: Id<"knowledgeEntries">;
    humanWeightExpectation?: Doc<"knowledgeSlots">["humanWeightExpectation"];
    promptText?: string;
    requestedKnowledgeType: Doc<"knowledgeSlots">["requestedKnowledgeType"];
    status?: Doc<"knowledgeSlots">["status"];
    title: string;
  },
) {
  const slotId = await ctx.db.insert("knowledgeSlots", {
    requestedKnowledgeType: slot.requestedKnowledgeType,
    status: slot.status ?? "open",
    title: slot.title,
    ...(slot.promptText === undefined ? {} : { promptText: slot.promptText }),
    contextKey: getContextKey(slot.contextTagIds),
    targetKind: "public",
    ...(slot.fulfilledEntryId === undefined
      ? {}
      : { fulfilledEntryId: slot.fulfilledEntryId }),
    ...(slot.humanWeightExpectation === undefined
      ? {}
      : { humanWeightExpectation: slot.humanWeightExpectation }),
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

async function insertHumanWeightFeedback(
  ctx: MutationCtx,
  feedback: {
    entryId: Id<"knowledgeEntries">;
    feedbackKind: Doc<"humanWeightFeedback">["feedbackKind"];
    userId: Id<"users">;
  },
) {
  await ctx.db.insert("humanWeightFeedback", {
    entryId: feedback.entryId,
    userId: feedback.userId,
    feedbackKind: feedback.feedbackKind,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
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

function getAnswerByTitle<T extends { kind: "answer"; entry: { title: string } }>(
  answers: T[],
  title: string,
) {
  const answer = answers.find((item) => item.entry.title === title);
  if (!answer) {
    throw new Error(`Missing Answer "${title}"`);
  }

  return answer;
}
