import { describe, expect, test } from "vitest";
import {
  CONTEXT_EXPERTISE_SCORING_VERSION,
  DEFAULT_CONTEXT_EXPERTISE_SIGNAL_SCORE,
  getBroaderContextExpertiseScore,
  getContextExpertiseAggregateScore,
  getContextExpertiseCandidateContexts,
  getContextExpertiseContextKey,
  getContextExpertiseEvidenceCountScoreBonus,
  getContextExpertiseEvidenceSignalScore,
  getContextExpertiseMaturity,
  getEstimatedContextExpertiseSignalScoreFromAggregate,
  normalizeContextExpertiseTagIds,
} from "./contextExpertiseScoring";

describe("Context Expertise scoring formula", () => {
  test("exposes the MVP scoring definition version", () => {
    expect(CONTEXT_EXPERTISE_SCORING_VERSION).toBe("context-expertise-mvp-1");
  });

  test("scores evidence signals from feedback, Human Weight, and defaults", () => {
    expect(DEFAULT_CONTEXT_EXPERTISE_SIGNAL_SCORE).toBe(55);
    expect(
      getContextExpertiseEvidenceSignalScore(
        { humanWeight: 82, knowledgeType: "lesson" },
        "post",
      ),
    ).toBe(82);
    expect(
      getContextExpertiseEvidenceSignalScore(
        { humanWeight: 82, knowledgeType: "lesson" },
        "feedback",
      ),
    ).toBe(55);
    expect(
      getContextExpertiseEvidenceSignalScore(
        { humanWeight: undefined, knowledgeType: "lesson" },
        "post",
      ),
    ).toBe(55);
  });

  test("adds capped evidence-count bonus to the aggregate score", () => {
    expect(getContextExpertiseEvidenceCountScoreBonus(0)).toBe(0);
    expect(getContextExpertiseEvidenceCountScoreBonus(1)).toBe(12);
    expect(getContextExpertiseEvidenceCountScoreBonus(5)).toBe(60);
    expect(getContextExpertiseEvidenceCountScoreBonus(8)).toBe(60);

    expect(getContextExpertiseAggregateScore(55, 1)).toBe(67);
    expect(getContextExpertiseAggregateScore(55, 5)).toBe(100);
    expect(getContextExpertiseAggregateScore(74, 2)).toBe(98);
    expect(getContextExpertiseAggregateScore(-10, 0)).toBe(0);
  });

  test("tracks Context Expertise Maturity separately from score", () => {
    expect(getContextExpertiseMaturity(1)).toBe(20);
    expect(getContextExpertiseMaturity(5)).toBe(100);
    expect(getContextExpertiseMaturity(8)).toBe(100);
    expect(getContextExpertiseMaturity(-1)).toBe(0);
  });

  test("estimates signal score from stored aggregate score for row merges", () => {
    expect(
      getEstimatedContextExpertiseSignalScoreFromAggregate({
        contextExpertiseScore: 98,
        evidenceCount: 2,
      }),
    ).toBe(74);
    expect(
      getEstimatedContextExpertiseSignalScoreFromAggregate({
        contextExpertiseScore: 8,
        evidenceCount: 2,
      }),
    ).toBe(0);
  });
});

describe("Context Expertise inheritance helpers", () => {
  test("normalizes context tags and builds exact plus immediate broader contexts", () => {
    const normalizedTagIds = normalizeContextExpertiseTagIds([
      "tag-b",
      "tag-a",
      "tag-a",
    ]);

    expect(normalizedTagIds).toEqual(["tag-a", "tag-b"]);
    expect(getContextExpertiseContextKey(normalizedTagIds)).toBe(
      "tags:tag-a,tag-b",
    );
    expect(
      getContextExpertiseCandidateContexts(["tag-b", "tag-a", "tag-a"]),
    ).toEqual([
      { contextKey: "tags:tag-a,tag-b" },
      {
        contextKey: "tags:tag-b",
        contextMatchKind: "broaderContext",
      },
      {
        contextKey: "tags:tag-a",
        contextMatchKind: "broaderContext",
      },
    ]);
  });

  test("discounts broader Context Expertise scores without exceeding bounds", () => {
    expect(getBroaderContextExpertiseScore(100)).toBe(85);
    expect(getBroaderContextExpertiseScore(74)).toBe(63);
    expect(getBroaderContextExpertiseScore(-20)).toBe(0);
    expect(getBroaderContextExpertiseScore(150)).toBe(100);
  });
});
