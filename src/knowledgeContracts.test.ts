import { describe, expect, test } from "vitest";
import {
  CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION,
  getDefaultHumanWeightExpectation,
  getHumanWeightConcern,
} from "./knowledgeContracts";

describe("Human Weight Concern contract", () => {
  test("mirrors the current calculation definition thresholds", () => {
    expect(CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION).toMatchObject({
      expectedConcernThreshold: 40,
      requiredConcernThreshold: 60,
      version: "mvp-human-weight-feedback-v1",
    });
  });

  test("keeps none and informative expectations quiet when Human Weight is low", () => {
    expect(
      getHumanWeightConcern({
        expectation: "none",
        humanWeight: 10,
        knowledgeType: "essay",
      }),
    ).toBeUndefined();
    expect(
      getHumanWeightConcern({
        expectation: "informative",
        humanWeight: 10,
        knowledgeType: "lesson",
      }),
    ).toBeUndefined();
  });

  test("derives possible concern for expected human substance below the low-band threshold", () => {
    expect(
      getHumanWeightConcern({
        expectation: "expected",
        humanWeight: 39,
        knowledgeType: "essay",
      }),
    ).toEqual({
      level: "possibleConcern",
      expectation: "expected",
      threshold:
        CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.expectedConcernThreshold,
    });
    expect(
      getHumanWeightConcern({
        expectation: "expected",
        humanWeight: 40,
        knowledgeType: "essay",
      }),
    ).toBeUndefined();
  });

  test("derives review recommendation for required human substance below the required-work threshold", () => {
    expect(
      getHumanWeightConcern({
        expectation: "required",
        humanWeight: 59,
        knowledgeType: "essay",
      }),
    ).toEqual({
      level: "reviewRecommended",
      expectation: "required",
      threshold:
        CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.requiredConcernThreshold,
    });
    expect(
      getHumanWeightConcern({
        expectation: "required",
        humanWeight: 60,
        knowledgeType: "essay",
      }),
    ).toBeUndefined();
  });

  test("does not emit concern for non-weight-bearing Knowledge Types", () => {
    expect(
      getHumanWeightConcern({
        expectation: "required",
        humanWeight: 1,
        knowledgeType: "rsvp",
      }),
    ).toBeUndefined();
    expect(
      getHumanWeightConcern({
        expectation: "required",
        humanWeight: 1,
        knowledgeType: "topic",
      }),
    ).toBeUndefined();
  });

  test("uses default expectations when no override is supplied", () => {
    expect(getDefaultHumanWeightExpectation("essay")).toBe("expected");
    expect(getDefaultHumanWeightExpectation("lesson")).toBe("informative");

    expect(
      getHumanWeightConcern({
        humanWeight: 35,
        knowledgeType: "essay",
      }),
    ).toEqual({
      level: "possibleConcern",
      expectation: "expected",
      threshold:
        CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.expectedConcernThreshold,
    });
    expect(
      getHumanWeightConcern({
        humanWeight: 35,
        knowledgeType: "lesson",
      }),
    ).toBeUndefined();
  });
});
