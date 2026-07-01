import { describe, expect, test } from "vitest";
import { summarizeHumanWeightEvidence } from "./humanWeightEvidence";

describe("Human Weight evidence summaries", () => {
  test("ignores non-weight-bearing Knowledge Types", () => {
    expect(
      summarizeHumanWeightEvidence("topic", [
        { feedbackKind: "recognize" },
        { evidenceSignal: "used" },
      ]),
    ).toBeUndefined();
  });

  test("returns no summary for weight-bearing entries without evidence", () => {
    expect(summarizeHumanWeightEvidence("lesson", [])).toBeUndefined();
  });

  test("counts positive and negative feedback and derived evidence signals", () => {
    expect(
      summarizeHumanWeightEvidence("lesson", [
        { feedbackKind: "recognize" },
        { feedbackKind: "notHuman" },
        { evidenceSignal: "used" },
        { evidenceSignal: "wrongContext" },
      ]),
    ).toEqual({
      evidenceCount: 4,
      evidenceMaturity: 80,
      negativeEvidenceCount: 2,
      positiveEvidenceCount: 2,
    });
  });

  test("caps Evidence Maturity at the current definition maximum", () => {
    const rows = Array.from({ length: 12 }, () => ({
      feedbackKind: "used" as const,
    }));

    expect(summarizeHumanWeightEvidence("quote", rows)).toMatchObject({
      evidenceCount: 12,
      evidenceMaturity: 100,
      positiveEvidenceCount: 12,
    });
  });
});
