/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION,
  getHumanWeightCalculationDefinitionSnapshot,
  HUMAN_WEIGHT_CALCULATION_DEFINITION_KEY,
} from "./lib/humanWeightCalculationDefinition";
import { summarizeHumanWeightEvidence } from "./lib/humanWeightEvidence";
import {
  MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
  recalculateHumanWeightEstimate,
} from "./lib/humanWeightRecalculation";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./humanWeightRecalculation.ts": () => import("./humanWeightRecalculation"),
  "./lib/humanWeightCalculationDefinition.ts": () =>
    import("./lib/humanWeightCalculationDefinition"),
  "./lib/humanWeightEvidence.ts": () => import("./lib/humanWeightEvidence"),
  "./lib/humanWeightRecalculation.ts": () =>
    import("./lib/humanWeightRecalculation"),
  "./lib/typeBehavior.ts": () => import("./lib/typeBehavior"),
};

const BASE_TIME = Date.UTC(2026, 5, 18, 12);

describe("Human Weight recalculation", () => {
  test("describes the current calculation definition as a stable snapshot", () => {
    expect(CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION).toMatchObject({
      definitionKey: HUMAN_WEIGHT_CALCULATION_DEFINITION_KEY,
      evidenceMaturityPerRow: 20,
      expectedConcernThreshold: 40,
      maxEvidenceMaturity: 100,
      maxHumanWeight: 100,
      minHumanWeight: 0,
      negativeEvidenceAdjustment: 8,
      positiveEvidenceAdjustment: 3,
      requiredConcernThreshold: 60,
      version: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
    });
    expect(getHumanWeightCalculationDefinitionSnapshot()).toEqual({
      definitionKey: HUMAN_WEIGHT_CALCULATION_DEFINITION_KEY,
      definitionJson: JSON.stringify(CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION),
      snapshotText: CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.snapshotText,
      version: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
    });
  });

  test("summarizes Evidence Maturity from the current calculation definition", () => {
    expect(
      summarizeHumanWeightEvidence("lesson", [{ feedbackKind: "recognize" }]),
    ).toEqual({
      evidenceCount: 1,
      positiveEvidenceCount: 1,
      negativeEvidenceCount: 0,
      evidenceMaturity:
        CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.evidenceMaturityPerRow,
    });
    expect(
      summarizeHumanWeightEvidence("lesson", [{ evidenceSignal: "used" }]),
    ).toEqual({
      evidenceCount: 1,
      positiveEvidenceCount: 1,
      negativeEvidenceCount: 0,
      evidenceMaturity:
        CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.evidenceMaturityPerRow,
    });
    expect(
      summarizeHumanWeightEvidence(
        "lesson",
        Array.from({ length: 5 }, () => ({ feedbackKind: "used" as const })),
      ),
    ).toEqual({
      evidenceCount: 5,
      positiveEvidenceCount: 5,
      negativeEvidenceCount: 0,
      evidenceMaturity:
        CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.maxEvidenceMaturity,
    });
    expect(
      summarizeHumanWeightEvidence("topic", [{ feedbackKind: "recognize" }]),
    ).toBeUndefined();
    expect(
      summarizeHumanWeightEvidence("topic", [{ evidenceSignal: "used" }]),
    ).toBeUndefined();
  });

  test("recalculates provisional estimates from Human Weight Evidence", () => {
    expect(
      recalculateHumanWeightEstimate({
        knowledgeType: "lesson",
        currentHumanWeight: 70,
        evidenceSummary: {
          evidenceCount: 2,
          positiveEvidenceCount: 2,
          negativeEvidenceCount: 0,
          evidenceMaturity: 40,
        },
      }),
    ).toBe(76);
    expect(
      recalculateHumanWeightEstimate({
        knowledgeType: "essay",
        currentHumanWeight: 70,
        evidenceSummary: {
          evidenceCount: 2,
          positiveEvidenceCount: 0,
          negativeEvidenceCount: 2,
          evidenceMaturity: 40,
        },
      }),
    ).toBe(54);
    expect(
      recalculateHumanWeightEstimate({
        knowledgeType: "words",
        currentHumanWeight: 99,
        evidenceSummary: {
          evidenceCount: 2,
          positiveEvidenceCount: 2,
          negativeEvidenceCount: 0,
          evidenceMaturity: 40,
        },
      }),
    ).toBe(100);
    expect(
      recalculateHumanWeightEstimate({
        knowledgeType: "words",
        currentHumanWeight: 4,
        evidenceSummary: {
          evidenceCount: 1,
          positiveEvidenceCount: 0,
          negativeEvidenceCount: 1,
          evidenceMaturity: 20,
        },
      }),
    ).toBe(0);
    expect(
      recalculateHumanWeightEstimate({
        knowledgeType: "lesson",
        evidenceSummary: {
          evidenceCount: 1,
          positiveEvidenceCount: 1,
          negativeEvidenceCount: 0,
          evidenceMaturity: 20,
        },
      }),
    ).toBe(63);
    expect(
      recalculateHumanWeightEstimate({
        knowledgeType: "lesson",
        currentHumanWeight: 72,
      }),
    ).toBe(72);
    expect(
      recalculateHumanWeightEstimate({
        knowledgeType: "topic",
        currentHumanWeight: 50,
        evidenceSummary: {
          evidenceCount: 1,
          positiveEvidenceCount: 1,
          negativeEvidenceCount: 0,
          evidenceMaturity: 20,
        },
      }),
    ).toBeUndefined();
  });

  test("recalculates a bounded batch without changing entry updatedAt", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedHumanWeightRecalculationRows);

    const result = await t.mutation(
      internal.humanWeightRecalculation.recalculateBatch,
      { batchSize: 10 },
    );

    expect(result).toEqual({
      calculationDefinitionId: expect.any(String),
      calculationVersion: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
      scannedCount: 5,
      recalculatedCount: 3,
      changedCount: 3,
      unchangedCount: 1,
      skippedNonWeightBearingCount: 1,
      feedbackRowsScannedCount: 4,
      derivedEvidenceRowsScannedCount: 0,
    });

    const rowState = await t.run(async (ctx) => ({
      negative: await ctx.db.get(seed.entries.negative),
      noEvidence: await ctx.db.get(seed.entries.noEvidence),
      positive: await ctx.db.get(seed.entries.positive),
      topic: await ctx.db.get(seed.entries.topic),
      unscored: await ctx.db.get(seed.entries.unscored),
      calculationDefinitions: await ctx.db
        .query("humanWeightCalculationDefinitions")
        .collect(),
    }));

    expect(rowState.calculationDefinitions).toEqual([
      expect.objectContaining({
        _id: result.calculationDefinitionId,
        definitionKey: HUMAN_WEIGHT_CALCULATION_DEFINITION_KEY,
        definitionJson: JSON.stringify(
          CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION,
        ),
        snapshotText: CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.snapshotText,
        version: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
      }),
    ]);
    expect(rowState.positive).toEqual(
      expect.objectContaining({
        humanWeight: 66,
        humanWeightBaseEstimate: 60,
        humanWeightCalculationDefinitionId: result.calculationDefinitionId,
        humanWeightCalculationVersion: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
        updatedAt: BASE_TIME + 5,
      }),
    );
    expect(rowState.negative).toEqual(
      expect.objectContaining({
        humanWeight: 52,
        humanWeightBaseEstimate: 60,
        humanWeightCalculationDefinitionId: result.calculationDefinitionId,
        humanWeightCalculationVersion: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
        updatedAt: BASE_TIME + 4,
      }),
    );
    expect(rowState.noEvidence).toEqual(
      expect.objectContaining({
        humanWeight: 60,
        updatedAt: BASE_TIME + 3,
      }),
    );
    expect(rowState.unscored).toEqual(
      expect.objectContaining({
        humanWeight: 63,
        humanWeightBaseEstimate: 60,
        humanWeightCalculationDefinitionId: result.calculationDefinitionId,
        humanWeightCalculationVersion: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
        updatedAt: BASE_TIME + 2,
      }),
    );
    expect(rowState.topic).not.toHaveProperty("humanWeight");

    await expect(
      t.mutation(internal.humanWeightRecalculation.recalculateBatch, {
        batchSize: 10,
      }),
    ).resolves.toEqual({
      calculationDefinitionId: result.calculationDefinitionId,
      calculationVersion: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
      scannedCount: 5,
      recalculatedCount: 3,
      changedCount: 0,
      unchangedCount: 4,
      skippedNonWeightBearingCount: 1,
      feedbackRowsScannedCount: 4,
      derivedEvidenceRowsScannedCount: 0,
    });
  });

  test("recalculates from derived Slot Fulfillment evidence", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(async (ctx) => {
      const authorUserId = await insertUser(ctx, {
        email: "slot-author@example.com",
        name: "Slot Author",
      });
      const entryId = await insertEntry(ctx, {
        createdByUserId: authorUserId,
        humanWeight: 60,
        knowledgeType: "lesson",
        previewText: "A lesson that fulfilled an open slot.",
        title: "Slot Fulfillment Lesson",
        updatedAt: BASE_TIME + 1,
      });
      const slotId = await ctx.db.insert("knowledgeSlots", {
        requestedKnowledgeType: "lesson",
        status: "fulfilled",
        title: "Needed lesson",
        contextKey: "tags:",
        targetKind: "public",
        fulfilledEntryId: entryId,
        createdByUserId: authorUserId,
        createdAt: BASE_TIME,
        updatedAt: BASE_TIME,
      });
      await ctx.db.insert("humanWeightEvidence", {
        entryId,
        evidenceKind: "slotFulfillment",
        evidenceSignal: "used",
        slotId,
        subjectUserId: authorUserId,
        createdAt: BASE_TIME,
        updatedAt: BASE_TIME,
      });

      return { entryId };
    });

    const result = await t.mutation(
      internal.humanWeightRecalculation.recalculateBatch,
      { batchSize: 10 },
    );

    expect(result).toEqual({
      calculationDefinitionId: expect.any(String),
      calculationVersion: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
      scannedCount: 1,
      recalculatedCount: 1,
      changedCount: 1,
      unchangedCount: 0,
      skippedNonWeightBearingCount: 0,
      feedbackRowsScannedCount: 0,
      derivedEvidenceRowsScannedCount: 1,
    });

    const entry = await t.run(async (ctx) => await ctx.db.get(seed.entryId));
    expect(entry).toEqual(
      expect.objectContaining({
        humanWeight: 63,
        humanWeightBaseEstimate: 60,
        humanWeightCalculationDefinitionId: result.calculationDefinitionId,
        humanWeightCalculationVersion: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
      }),
    );
  });

  test("honors the requested batch size", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedHumanWeightRecalculationRows);

    const result = await t.mutation(
      internal.humanWeightRecalculation.recalculateBatch,
      { batchSize: 1 },
    );

    expect(result).toMatchObject({
      calculationDefinitionId: expect.any(String),
      scannedCount: 1,
      recalculatedCount: 1,
      changedCount: 1,
    });

    const rowState = await t.run(async (ctx) => ({
      mostRecent: await ctx.db.get(seed.entries.positive),
      older: await ctx.db.get(seed.entries.negative),
    }));
    expect(rowState.mostRecent?.humanWeight).toBe(66);
    expect(rowState.older?.humanWeight).toBe(60);
  });

  test("rejects an existing calculation definition row with changed content", async () => {
    const t = convexTest({ schema, modules });
    await t.run(async (ctx) => {
      await ctx.db.insert("humanWeightCalculationDefinitions", {
        definitionKey: HUMAN_WEIGHT_CALCULATION_DEFINITION_KEY,
        version: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
        snapshotText: "Conflicting Human Weight definition.",
        definitionJson: "{}",
        createdAt: BASE_TIME,
        updatedAt: BASE_TIME,
      });
    });

    await expect(
      t.mutation(internal.humanWeightRecalculation.recalculateBatch, {
        batchSize: 1,
      }),
    ).rejects.toThrow(
      "Human Weight Calculation Definition content changed for existing version.",
    );
  });
});

async function seedHumanWeightRecalculationRows(ctx: MutationCtx) {
  const authorUserId = await insertUser(ctx, {
    email: "recalculation-author@example.com",
    name: "Recalculation Author",
  });
  const reviewerUserId = await insertUser(ctx, {
    email: "recalculation-reviewer@example.com",
    name: "Recalculation Reviewer",
  });

  const positive = await insertEntry(ctx, {
    createdByUserId: authorUserId,
    humanWeight: 60,
    knowledgeType: "lesson",
    previewText: "Recognized and used in a classroom.",
    title: "Recognized Lesson",
    updatedAt: BASE_TIME + 5,
  });
  const negative = await insertEntry(ctx, {
    createdByUserId: authorUserId,
    humanWeight: 60,
    knowledgeType: "essay",
    previewText: "An essay with correction feedback.",
    title: "Questioned Essay",
    updatedAt: BASE_TIME + 4,
  });
  const noEvidence = await insertEntry(ctx, {
    createdByUserId: authorUserId,
    humanWeight: 60,
    knowledgeType: "words",
    previewText: "Words without Human Weight Evidence yet.",
    title: "No Evidence Words",
    updatedAt: BASE_TIME + 3,
  });
  const unscored = await insertEntry(ctx, {
    createdByUserId: authorUserId,
    knowledgeType: "lesson",
    previewText: "A lesson with evidence but no current estimate.",
    title: "Unscored Lesson",
    updatedAt: BASE_TIME + 2,
  });
  const topic = await insertEntry(ctx, {
    createdByUserId: authorUserId,
    knowledgeType: "topic",
    previewText: "A non-weight-bearing topic.",
    title: "Topic With Feedback",
    updatedAt: BASE_TIME + 1,
  });

  await insertHumanWeightFeedback(ctx, {
    entryId: positive,
    feedbackKind: "recognize",
    userId: reviewerUserId,
  });
  await insertHumanWeightFeedback(ctx, {
    entryId: positive,
    feedbackKind: "used",
    userId: authorUserId,
  });
  await insertHumanWeightFeedback(ctx, {
    entryId: negative,
    feedbackKind: "notHuman",
    userId: reviewerUserId,
  });
  await insertHumanWeightFeedback(ctx, {
    entryId: unscored,
    feedbackKind: "used",
    userId: reviewerUserId,
  });
  await insertHumanWeightFeedback(ctx, {
    entryId: topic,
    feedbackKind: "recognize",
    userId: reviewerUserId,
  });

  return {
    entries: {
      negative,
      noEvidence,
      positive,
      topic,
      unscored,
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

async function insertEntry(
  ctx: MutationCtx,
  entry: {
    createdByUserId: Id<"users">;
    humanWeight?: number;
    knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
    previewText: string;
    title: string;
    updatedAt: number;
  },
) {
  const referentId = await ctx.db.insert("referents", {
    canonicalKey: slugify(entry.title),
    canonicalName: entry.title,
    knowledgeType: entry.knowledgeType,
  });
  const tagId = await ctx.db.insert("tags", {
    referentId,
    knowledgeType: entry.knowledgeType,
    label: entry.title,
    lookupKey: slugify(entry.title),
  });

  return await ctx.db.insert("knowledgeEntries", {
    contextPreviewTagLabels: [],
    createdAt: BASE_TIME,
    createdByUserId: entry.createdByUserId,
    discoverabilityKind: "public",
    discoverabilityTargetKey: "public",
    ...(entry.humanWeight === undefined
      ? {}
      : { humanWeight: entry.humanWeight }),
    knowledgeType: entry.knowledgeType,
    previewText: entry.previewText,
    primaryTagId: tagId,
    primaryTagLabel: entry.title,
    representedReferentId: referentId,
    searchText: `${entry.title} ${entry.previewText}`,
    title: entry.title,
    updatedAt: entry.updatedAt,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
