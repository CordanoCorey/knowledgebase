import { describe, expect, test } from "vitest";
import { CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION } from "./humanWeightCalculationDefinition";
import {
  getComposerTitleBehavior,
  getHumanWeightConcern,
  getTypeBehavior,
  getTypeBehaviorSnapshot,
} from "./typeBehavior";

describe("Human Weight Concern", () => {
  test("uses the current calculation definition thresholds", () => {
    expect(
      CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.expectedConcernThreshold,
    ).toBe(40);
    expect(
      CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.requiredConcernThreshold,
    ).toBe(60);
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

  test("uses Type Behavior defaults when no expectation override is supplied", () => {
    expect(getTypeBehavior("words").humanWeight.expectation).toBe("expected");
    expect(getTypeBehavior("essay").humanWeight.expectation).toBe("expected");
    expect(getTypeBehavior("lesson").humanWeight.expectation).toBe("informative");

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
        knowledgeType: "words",
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

  test("defines the credited human role by Knowledge Type", () => {
    expect(getTypeBehavior("words").version).toBe("mvp-type-behavior-v4");
    expect(getTypeBehavior("words").humanWeight.creditBasis).toBe("contributor");
    expect(getTypeBehavior("lesson").humanWeight.creditBasis).toBe(
      "contributor",
    );
    expect(getTypeBehavior("quote").humanWeight.creditBasis).toBe(
      "quotedPerson",
    );
    expect(getTypeBehavior("rsvp").humanWeight).not.toHaveProperty(
      "creditBasis",
    );
    expect(getTypeBehavior("topic").humanWeight).not.toHaveProperty(
      "creditBasis",
    );
    expect(getTypeBehaviorSnapshot("quote").version).toBe(
      "mvp-type-behavior-v4",
    );
  });
});

describe("Type Behavior title input contract", () => {
  test("defines generated, addable, and required title-like composer inputs", () => {
    expect(getComposerTitleBehavior("words")).toMatchObject({
      generatedTitleKind: "bodyPreview",
      input: "addable",
      label: "Title",
      smartStorageTriggerWhenProvided: true,
    });
    expect(getTypeBehavior("words")).toMatchObject({
      composerDefaults: { titleRequired: false },
      identity: { strategy: "generated" },
    });

    expect(getComposerTitleBehavior("comment")).toMatchObject({
      generatedTitleKind: "parentComment",
      input: "hidden",
      smartStorageTriggerWhenProvided: false,
    });
    expect(getTypeBehavior("comment")).toMatchObject({
      composerDefaults: { titleRequired: false },
      identity: { strategy: "generated" },
    });

    expect(getComposerTitleBehavior("question")).toMatchObject({
      generatedTitleKind: "none",
      input: "required",
      label: "Question",
      primaryInput: true,
    });
    expect(getTypeBehavior("question").composerDefaults.titleRequired).toBe(
      true,
    );

    expect(getComposerTitleBehavior("lesson")).toMatchObject({
      generatedTitleKind: "none",
      input: "required",
      label: "Title",
      primaryInput: false,
    });
    expect(getTypeBehavior("lesson").composerDefaults.titleRequired).toBe(true);
  });

  test("includes the title input contract in immutable Type Behavior snapshots", () => {
    const snapshot = getTypeBehaviorSnapshot("words");
    const behavior = JSON.parse(snapshot.behaviorSnapshotJson);

    expect(snapshot.version).toBe("mvp-type-behavior-v4");
    expect(behavior.composerDefaults.title).toMatchObject({
      generatedTitleKind: "bodyPreview",
      input: "addable",
      smartStorageTriggerWhenProvided: true,
    });
  });
});
