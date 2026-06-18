import type { Doc } from "../_generated/dataModel";
import { CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION } from "./humanWeightCalculationDefinition";
import {
  isWeightBearingEntryKnowledgeType,
  type EntryKnowledgeType,
} from "./typeBehavior";

type HumanWeightFeedbackKind = Doc<"humanWeightFeedback">["feedbackKind"];

export type HumanWeightEvidenceSummary = {
  evidenceCount: number;
  positiveEvidenceCount: number;
  negativeEvidenceCount: number;
  evidenceMaturity: number;
};

export function summarizeHumanWeightEvidence(
  knowledgeType: EntryKnowledgeType,
  feedbackRows: Array<Pick<Doc<"humanWeightFeedback">, "feedbackKind">>,
): HumanWeightEvidenceSummary | undefined {
  if (!isWeightBearingEntryKnowledgeType(knowledgeType)) {
    return undefined;
  }

  let positiveEvidenceCount = 0;
  let negativeEvidenceCount = 0;

  for (const row of feedbackRows) {
    if (isPositiveFeedbackKind(row.feedbackKind)) {
      positiveEvidenceCount += 1;
      continue;
    }

    negativeEvidenceCount += 1;
  }

  const evidenceCount = positiveEvidenceCount + negativeEvidenceCount;
  if (evidenceCount === 0) {
    return undefined;
  }

  return {
    evidenceCount,
    positiveEvidenceCount,
    negativeEvidenceCount,
    evidenceMaturity: getEvidenceMaturityForCount(evidenceCount),
  };
}

function isPositiveFeedbackKind(feedbackKind: HumanWeightFeedbackKind) {
  return feedbackKind === "recognize" || feedbackKind === "used";
}

function getEvidenceMaturityForCount(evidenceCount: number) {
  const definition = CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION;
  return Math.min(
    definition.maxEvidenceMaturity,
    Math.max(0, evidenceCount) * definition.evidenceMaturityPerRow,
  );
}
