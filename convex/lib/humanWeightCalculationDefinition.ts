export const HUMAN_WEIGHT_CALCULATION_DEFINITION_KEY =
  "mvp-human-weight-calculation";

export type HumanWeightCalculationDefinition = {
  definitionKey: string;
  version: string;
  snapshotText: string;
  minHumanWeight: number;
  maxHumanWeight: number;
  positiveEvidenceAdjustment: number;
  negativeEvidenceAdjustment: number;
  evidenceMaturityPerRow: number;
  maxEvidenceMaturity: number;
  expectedConcernThreshold: number;
  requiredConcernThreshold: number;
};

export const CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION = {
  definitionKey: HUMAN_WEIGHT_CALCULATION_DEFINITION_KEY,
  version: "mvp-human-weight-feedback-v1",
  snapshotText:
    "MVP Human Weight definition using Type Behavior base estimates, explicit Human Weight Feedback evidence, Evidence Maturity by evidence count, and initial concern thresholds.",
  minHumanWeight: 0,
  maxHumanWeight: 100,
  positiveEvidenceAdjustment: 3,
  negativeEvidenceAdjustment: 8,
  evidenceMaturityPerRow: 20,
  maxEvidenceMaturity: 100,
  expectedConcernThreshold: 40,
  requiredConcernThreshold: 60,
} as const satisfies HumanWeightCalculationDefinition;

export function getHumanWeightCalculationDefinitionSnapshot(
  definition: HumanWeightCalculationDefinition =
    CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION,
) {
  return {
    definitionKey: definition.definitionKey,
    definitionJson: JSON.stringify(definition),
    snapshotText: definition.snapshotText,
    version: definition.version,
  };
}
