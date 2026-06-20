import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import {
  CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION,
  getHumanWeightCalculationDefinitionSnapshot,
} from "./lib/humanWeightCalculationDefinition";
import { summarizeHumanWeightEvidence } from "./lib/humanWeightEvidence";
import {
  getHumanWeightRecalculationBaseEstimate,
  MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
  recalculateHumanWeightEstimate,
} from "./lib/humanWeightRecalculation";
import { isWeightBearingEntryKnowledgeType } from "./lib/typeBehavior";

const DEFAULT_RECALCULATION_BATCH_SIZE = 50;
const MAX_RECALCULATION_BATCH_SIZE = 100;
const MAX_FEEDBACK_ROWS_PER_ENTRY = 100;
const MAX_DERIVED_EVIDENCE_ROWS_PER_ENTRY = 100;

const recalculationBatchResult = v.object({
  calculationDefinitionId: v.id("humanWeightCalculationDefinitions"),
  calculationVersion: v.string(),
  scannedCount: v.number(),
  recalculatedCount: v.number(),
  changedCount: v.number(),
  unchangedCount: v.number(),
  skippedNonWeightBearingCount: v.number(),
  feedbackRowsScannedCount: v.number(),
  derivedEvidenceRowsScannedCount: v.number(),
});

export const recalculateBatch = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: recalculationBatchResult,
  handler: async (ctx, args) => {
    const batchSize = normalizeRecalculationBatchSize(args.batchSize);
    const now = Date.now();
    const calculationDefinition =
      getHumanWeightCalculationDefinitionSnapshot();
    const calculationDefinitionId =
      await ensureHumanWeightCalculationDefinition(ctx, {
        ...calculationDefinition,
        now,
      });
    const entries = await ctx.db
      .query("knowledgeEntries")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(batchSize);

    let recalculatedCount = 0;
    let changedCount = 0;
    let unchangedCount = 0;
    let skippedNonWeightBearingCount = 0;
    let feedbackRowsScannedCount = 0;
    let derivedEvidenceRowsScannedCount = 0;

    for (const entry of entries) {
      if (!isWeightBearingEntryKnowledgeType(entry.knowledgeType)) {
        skippedNonWeightBearingCount += 1;
        continue;
      }

      const feedbackRows = await ctx.db
        .query("humanWeightFeedback")
        .withIndex("by_entryId_and_createdAt", (q) => q.eq("entryId", entry._id))
        .take(MAX_FEEDBACK_ROWS_PER_ENTRY);
      feedbackRowsScannedCount += feedbackRows.length;
      const derivedEvidenceRows = await ctx.db
        .query("humanWeightEvidence")
        .withIndex("by_entryId_and_createdAt", (q) => q.eq("entryId", entry._id))
        .take(MAX_DERIVED_EVIDENCE_ROWS_PER_ENTRY);
      derivedEvidenceRowsScannedCount += derivedEvidenceRows.length;

      const evidenceSummary = summarizeHumanWeightEvidence(
        entry.knowledgeType,
        [...feedbackRows, ...derivedEvidenceRows],
      );
      if (evidenceSummary === undefined) {
        unchangedCount += 1;
        continue;
      }

      const baseHumanWeight =
        entry.humanWeightBaseEstimate ??
        getHumanWeightRecalculationBaseEstimate({
          knowledgeType: entry.knowledgeType,
          currentHumanWeight: entry.humanWeight,
      });
      recalculatedCount += 1;
      const humanWeight = recalculateHumanWeightEstimate({
        definition: CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION,
        knowledgeType: entry.knowledgeType,
        currentHumanWeight: baseHumanWeight,
        evidenceSummary,
      });
      if (humanWeight === undefined) {
        unchangedCount += 1;
        continue;
      }

      const patch = {
        ...(humanWeight === entry.humanWeight ? {} : { humanWeight }),
        ...(baseHumanWeight === undefined ||
        entry.humanWeightBaseEstimate === baseHumanWeight
          ? {}
          : { humanWeightBaseEstimate: baseHumanWeight }),
        ...(entry.humanWeightCalculationVersion ===
        MVP_HUMAN_WEIGHT_RECALCULATION_VERSION
          ? {}
          : {
              humanWeightCalculationVersion:
                MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
            }),
        ...(entry.humanWeightCalculationDefinitionId === calculationDefinitionId
          ? {}
          : { humanWeightCalculationDefinitionId: calculationDefinitionId }),
      };
      if (Object.keys(patch).length === 0) {
        unchangedCount += 1;
        continue;
      }

      await ctx.db.patch(entry._id, patch);
      changedCount += 1;
    }

    return {
      calculationDefinitionId,
      calculationVersion: MVP_HUMAN_WEIGHT_RECALCULATION_VERSION,
      scannedCount: entries.length,
      recalculatedCount,
      changedCount,
      unchangedCount,
      skippedNonWeightBearingCount,
      feedbackRowsScannedCount,
      derivedEvidenceRowsScannedCount,
    };
  },
});

function normalizeRecalculationBatchSize(batchSize: number | undefined) {
  if (batchSize === undefined || !Number.isFinite(batchSize)) {
    return DEFAULT_RECALCULATION_BATCH_SIZE;
  }

  return Math.min(
    MAX_RECALCULATION_BATCH_SIZE,
    Math.max(1, Math.floor(batchSize)),
  );
}

async function ensureHumanWeightCalculationDefinition(
  ctx: MutationCtx,
  {
    definitionKey,
    definitionJson,
    now,
    snapshotText,
    version,
  }: {
    definitionKey: string;
    definitionJson: string;
    now: number;
    snapshotText: string;
    version: string;
  },
) {
  const existing = await ctx.db
    .query("humanWeightCalculationDefinitions")
    .withIndex("by_definitionKey_and_version", (q) =>
      q.eq("definitionKey", definitionKey).eq("version", version),
    )
    .unique();
  if (existing) {
    if (
      existing.snapshotText !== snapshotText ||
      existing.definitionJson !== definitionJson
    ) {
      throw new Error(
        "Human Weight Calculation Definition content changed for existing version.",
      );
    }

    return existing._id;
  }

  return await ctx.db.insert("humanWeightCalculationDefinitions", {
    definitionKey,
    version,
    snapshotText,
    definitionJson,
    createdAt: now,
    updatedAt: now,
  });
}
