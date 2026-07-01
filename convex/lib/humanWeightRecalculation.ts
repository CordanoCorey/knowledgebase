import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION,
  getHumanWeightCalculationDefinitionSnapshot,
  type HumanWeightCalculationDefinition,
} from "./humanWeightCalculationDefinition";
import type { HumanWeightEvidenceSummary } from "./humanWeightEvidence";
import {
  getTypeBehavior,
  isWeightBearingEntryKnowledgeType,
  type EntryKnowledgeType,
} from "./typeBehavior";

// Human Weight recalculation is pure and versioned so stored estimates can be
// audited or recomputed when the definition changes.
export const MVP_HUMAN_WEIGHT_RECALCULATION_VERSION =
  CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.version;

export type HumanWeightRecalculationInput = {
  knowledgeType: EntryKnowledgeType;
  currentHumanWeight?: Doc<"knowledgeEntries">["humanWeight"];
  evidenceSummary?: HumanWeightEvidenceSummary;
  definition?: HumanWeightCalculationDefinition;
};

export type HumanWeightRecalculationBaseInput = {
  knowledgeType: EntryKnowledgeType;
  currentHumanWeight?: Doc<"knowledgeEntries">["humanWeight"];
};

type HumanWeightCalculationDefinitionSnapshot =
  ReturnType<typeof getHumanWeightCalculationDefinitionSnapshot>;

export type HumanWeightRecalculationPatch = Partial<
  Pick<
    Doc<"knowledgeEntries">,
    | "humanWeight"
    | "humanWeightBaseEstimate"
    | "humanWeightCalculationVersion"
    | "humanWeightCalculationDefinitionId"
  >
>;

export type HumanWeightEntryRecalculation = {
  humanWeight: number;
  patch: HumanWeightRecalculationPatch;
};

export function recalculateHumanWeightEstimate({
  definition = CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION,
  knowledgeType,
  currentHumanWeight,
  evidenceSummary,
}: HumanWeightRecalculationInput) {
  if (!isWeightBearingEntryKnowledgeType(knowledgeType)) {
    return undefined;
  }

  if (evidenceSummary === undefined || evidenceSummary.evidenceCount === 0) {
    return currentHumanWeight;
  }

  const startingEstimate = getHumanWeightRecalculationBaseEstimate({
    knowledgeType,
    currentHumanWeight,
  });
  if (startingEstimate === undefined) {
    return undefined;
  }
  const recalculatedEstimate =
    startingEstimate +
    evidenceSummary.positiveEvidenceCount *
      definition.positiveEvidenceAdjustment -
    evidenceSummary.negativeEvidenceCount * definition.negativeEvidenceAdjustment;

  return clampHumanWeight(Math.round(recalculatedEstimate), definition);
}

export function getHumanWeightRecalculationPatch({
  calculationDefinitionId,
  entry,
  evidenceSummary,
}: {
  calculationDefinitionId: Id<"humanWeightCalculationDefinitions">;
  entry: Doc<"knowledgeEntries">;
  evidenceSummary: HumanWeightEvidenceSummary;
}): HumanWeightEntryRecalculation | undefined {
  const baseHumanWeight =
    entry.humanWeightBaseEstimate ??
    getHumanWeightRecalculationBaseEstimate({
      knowledgeType: entry.knowledgeType,
      currentHumanWeight: entry.humanWeight,
    });
  const humanWeight = recalculateHumanWeightEstimate({
    definition: CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION,
    knowledgeType: entry.knowledgeType,
    currentHumanWeight: baseHumanWeight,
    evidenceSummary,
  });
  if (humanWeight === undefined) {
    return undefined;
  }

  return {
    humanWeight,
    patch: {
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
    },
  };
}

export function getHumanWeightRecalculationBaseEstimate({
  knowledgeType,
  currentHumanWeight,
}: HumanWeightRecalculationBaseInput) {
  if (!isWeightBearingEntryKnowledgeType(knowledgeType)) {
    return undefined;
  }

  return (
    currentHumanWeight ?? getTypeBehavior(knowledgeType).humanWeight.defaultEstimate
  );
}

function clampHumanWeight(
  humanWeight: number,
  definition: HumanWeightCalculationDefinition,
) {
  return Math.min(
    definition.maxHumanWeight,
    Math.max(definition.minHumanWeight, humanWeight),
  );
}

export async function ensureHumanWeightCalculationDefinition(
  ctx: MutationCtx,
  {
    definitionKey,
    definitionJson,
    now,
    snapshotText,
    version,
  }: HumanWeightCalculationDefinitionSnapshot & {
    now: number;
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
