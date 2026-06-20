import type { Doc } from "../_generated/dataModel";
import {
  CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION,
  type HumanWeightCalculationDefinition,
} from "./humanWeightCalculationDefinition";
import type { HumanWeightEvidenceSummary } from "./humanWeightEvidence";
import {
  getTypeBehavior,
  isWeightBearingEntryKnowledgeType,
  type EntryKnowledgeType,
} from "./typeBehavior";

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
