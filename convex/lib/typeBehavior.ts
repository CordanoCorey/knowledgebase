import { CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION } from "./humanWeightCalculationDefinition";

export const ENTRY_KNOWLEDGE_TYPES = [
  "words",
  "topic",
  "series",
  "question",
  "quote",
  "sermon",
  "essay",
  "poem",
  "song",
  "book",
  "shortStory",
  "lesson",
  "comment",
  "prayerRequest",
  "event",
  "rsvp",
  "person",
  "organization",
  "group",
  "place",
] as const;

export type EntryKnowledgeType = (typeof ENTRY_KNOWLEDGE_TYPES)[number];

export const WEIGHT_BEARING_ENTRY_KNOWLEDGE_TYPES = [
  "words",
  "question",
  "quote",
  "sermon",
  "essay",
  "poem",
  "song",
  "book",
  "shortStory",
  "lesson",
  "comment",
  "prayerRequest",
  "series",
  "event",
] as const satisfies readonly EntryKnowledgeType[];

export type WeightBearingEntryKnowledgeType =
  (typeof WEIGHT_BEARING_ENTRY_KNOWLEDGE_TYPES)[number];

export const NON_WEIGHT_BEARING_ENTRY_KNOWLEDGE_TYPES = [
  "rsvp",
  "person",
  "organization",
  "group",
  "place",
  "topic",
] as const satisfies readonly EntryKnowledgeType[];

export type NonWeightBearingEntryKnowledgeType =
  (typeof NON_WEIGHT_BEARING_ENTRY_KNOWLEDGE_TYPES)[number];

export const HUMAN_WEIGHT_EXPECTATION_LEVELS = [
  "none",
  "informative",
  "expected",
  "required",
] as const;

export type HumanWeightExpectation =
  (typeof HUMAN_WEIGHT_EXPECTATION_LEVELS)[number];

export const HUMAN_WEIGHT_CONCERN_LEVELS = [
  "possibleConcern",
  "reviewRecommended",
] as const;

export type HumanWeightConcernLevel =
  (typeof HUMAN_WEIGHT_CONCERN_LEVELS)[number];

export type HumanWeightConcernSummary = {
  level: HumanWeightConcernLevel;
  expectation: Extract<HumanWeightExpectation, "expected" | "required">;
  threshold: number;
};

export const HUMAN_WEIGHT_CREDIT_BASES = [
  "contributor",
  "quotedPerson",
] as const;

export type HumanWeightCreditBasis =
  (typeof HUMAN_WEIGHT_CREDIT_BASES)[number];

export const HUMAN_WEIGHT_BANDS = [
  { id: "slop", label: "Slop", min: 0, max: 19 },
  { id: "assisted", label: "Assisted", min: 20, max: 39 },
  { id: "shaped", label: "Shaped", min: 40, max: 59 },
  { id: "substantial", label: "Substantial", min: 60, max: 79 },
  { id: "weighty", label: "Weighty", min: 80, max: 94 },
  { id: "soul", label: "Soul", min: 95, max: 100 },
] as const;

export type HumanWeightBand = (typeof HUMAN_WEIGHT_BANDS)[number];

const HUMAN_WEIGHT_FEEDBACK_NEEDED_PRIORITY = 55;
const NON_WEIGHT_BEARING_FEED_PRIORITY = -1;
const EVIDENCE_MATURITY_MAX_PRIORITY_BOOST = 0.5;

export const REPRESENTATION_ROLES = [
  "unspecified",
  "primaryContent",
  "manuscript",
  "slides",
  "transcript",
  "recording",
  "thumbnail",
  "supportingMaterial",
] as const;

export type RepresentationRole = (typeof REPRESENTATION_ROLES)[number];

export type ComposerTitleInput = "required" | "hidden" | "addable";
export type ComposerGeneratedTitleKind =
  | "none"
  | "bodyPreview"
  | "parentComment";

export type ComposerTitleBehavior = {
  generatedTitleKind: ComposerGeneratedTitleKind;
  input: ComposerTitleInput;
  label: string;
  placeholder?: string;
  previewLabel: string;
  primaryInput: boolean;
  smartStorageTriggerWhenProvided: boolean;
};

export type TypeBehavior = {
  knowledgeType: EntryKnowledgeType;
  version: string;
  identity: {
    strategy: "title" | "generated";
  };
  referentIdentityScope: {
    defaultScope: "private" | "organization" | "group" | "public";
  };
  composerDefaults: {
    title: ComposerTitleBehavior;
    titleRequired: boolean;
  };
  smartStorageChallenge: {
    canChallengeSelectedType: boolean;
  };
  representationRoles: {
    allowed: RepresentationRole[];
    defaultRole: RepresentationRole;
  };
  primaryRepresentation: {
    defaultRole: RepresentationRole;
  };
  humanWeight: {
    creditBasis?: HumanWeightCreditBasis;
    defaultEstimate: number;
    expectation: HumanWeightExpectation;
  };
  provenance: {
    requiresSourceCitation: boolean;
  };
};

const DEFAULT_TYPE_BEHAVIOR_VERSION = "mvp-type-behavior-v3";

const DEFAULT_COMPOSER_TITLE_BEHAVIOR: ComposerTitleBehavior = {
  generatedTitleKind: "none",
  input: "required",
  label: "Title",
  previewLabel: "Title",
  primaryInput: false,
  smartStorageTriggerWhenProvided: false,
};

const WORDS_COMPOSER_TITLE_BEHAVIOR: ComposerTitleBehavior = {
  generatedTitleKind: "bodyPreview",
  input: "addable",
  label: "Title",
  placeholder: "Optional title",
  previewLabel: "Title",
  primaryInput: false,
  smartStorageTriggerWhenProvided: true,
};

const COMMENT_COMPOSER_TITLE_BEHAVIOR: ComposerTitleBehavior = {
  generatedTitleKind: "parentComment",
  input: "hidden",
  label: "Title",
  previewLabel: "Title",
  primaryInput: false,
  smartStorageTriggerWhenProvided: false,
};

const QUESTION_COMPOSER_TITLE_BEHAVIOR: ComposerTitleBehavior = {
  generatedTitleKind: "none",
  input: "required",
  label: "Question",
  placeholder: "Ask a question...",
  previewLabel: "Question",
  primaryInput: true,
  smartStorageTriggerWhenProvided: false,
};

function createComposerDefaults(title: ComposerTitleBehavior) {
  return {
    title,
    titleRequired: title.input === "required",
  };
}

const DEFAULT_TYPE_BEHAVIOR: Omit<TypeBehavior, "knowledgeType"> = {
  version: DEFAULT_TYPE_BEHAVIOR_VERSION,
  identity: {
    strategy: "title",
  },
  referentIdentityScope: {
    defaultScope: "private",
  },
  composerDefaults: createComposerDefaults(DEFAULT_COMPOSER_TITLE_BEHAVIOR),
  smartStorageChallenge: {
    canChallengeSelectedType: true,
  },
  representationRoles: {
    allowed: [...REPRESENTATION_ROLES],
    defaultRole: "primaryContent",
  },
  primaryRepresentation: {
    defaultRole: "primaryContent",
  },
  humanWeight: {
    creditBasis: "contributor",
    defaultEstimate: 60,
    expectation: "informative",
  },
  provenance: {
    requiresSourceCitation: true,
  },
};

const TYPE_BEHAVIOR_OVERRIDES: Partial<
  Record<EntryKnowledgeType, Partial<Omit<TypeBehavior, "knowledgeType">>>
> = {
  words: {
    identity: {
      strategy: "generated",
    },
    composerDefaults: createComposerDefaults(WORDS_COMPOSER_TITLE_BEHAVIOR),
  },
  question: {
    composerDefaults: createComposerDefaults(QUESTION_COMPOSER_TITLE_BEHAVIOR),
  },
  quote: {
    humanWeight: {
      creditBasis: "quotedPerson",
      defaultEstimate: 60,
      expectation: "informative",
    },
  },
  essay: {
    humanWeight: {
      defaultEstimate: 60,
      expectation: "expected",
    },
  },
  comment: {
    identity: {
      strategy: "generated",
    },
    composerDefaults: createComposerDefaults(COMMENT_COMPOSER_TITLE_BEHAVIOR),
  },
  rsvp: {
    humanWeight: {
      defaultEstimate: 0,
      expectation: "none",
    },
  },
  topic: {
    humanWeight: {
      defaultEstimate: 0,
      expectation: "none",
    },
  },
  person: {
    humanWeight: {
      defaultEstimate: 0,
      expectation: "none",
    },
  },
  organization: {
    humanWeight: {
      defaultEstimate: 0,
      expectation: "none",
    },
  },
  group: {
    humanWeight: {
      defaultEstimate: 0,
      expectation: "none",
    },
  },
  place: {
    humanWeight: {
      defaultEstimate: 0,
      expectation: "none",
    },
  },
};

const WEIGHT_BEARING_ENTRY_KNOWLEDGE_TYPE_SET = new Set<EntryKnowledgeType>(
  WEIGHT_BEARING_ENTRY_KNOWLEDGE_TYPES,
);

const NON_WEIGHT_BEARING_ENTRY_KNOWLEDGE_TYPE_SET = new Set<EntryKnowledgeType>(
  NON_WEIGHT_BEARING_ENTRY_KNOWLEDGE_TYPES,
);

export function isWeightBearingEntryKnowledgeType(
  knowledgeType: EntryKnowledgeType,
): knowledgeType is WeightBearingEntryKnowledgeType {
  return WEIGHT_BEARING_ENTRY_KNOWLEDGE_TYPE_SET.has(knowledgeType);
}

export function isNonWeightBearingEntryKnowledgeType(
  knowledgeType: EntryKnowledgeType,
): knowledgeType is NonWeightBearingEntryKnowledgeType {
  return NON_WEIGHT_BEARING_ENTRY_KNOWLEDGE_TYPE_SET.has(knowledgeType);
}

export function getHumanWeightBand(
  humanWeight: number | undefined,
): HumanWeightBand | undefined {
  if (humanWeight === undefined) {
    return undefined;
  }

  return HUMAN_WEIGHT_BANDS.find(
    (band) => humanWeight >= band.min && humanWeight <= band.max,
  );
}

export function getApplicableHumanWeight(
  knowledgeType: EntryKnowledgeType,
  humanWeight: number | undefined,
) {
  return humanWeight !== undefined && isWeightBearingEntryKnowledgeType(knowledgeType)
    ? humanWeight
    : undefined;
}

export function needsHumanWeightFeedback(
  knowledgeType: EntryKnowledgeType,
  humanWeight: number | undefined,
) {
  return (
    humanWeight === undefined &&
    isWeightBearingEntryKnowledgeType(knowledgeType)
  );
}

export function getHumanWeightConcern({
  expectation,
  humanWeight,
  knowledgeType,
}: {
  expectation?: HumanWeightExpectation;
  humanWeight: number | undefined;
  knowledgeType: EntryKnowledgeType;
}): HumanWeightConcernSummary | undefined {
  const applicableHumanWeight = getApplicableHumanWeight(
    knowledgeType,
    humanWeight,
  );
  if (applicableHumanWeight === undefined) {
    return undefined;
  }

  const humanWeightExpectation =
    expectation ?? getTypeBehavior(knowledgeType).humanWeight.expectation;

  if (
    humanWeightExpectation === "required" &&
    applicableHumanWeight <
      CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.requiredConcernThreshold
  ) {
    return {
      level: "reviewRecommended",
      expectation: humanWeightExpectation,
      threshold:
        CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.requiredConcernThreshold,
    };
  }

  if (
    humanWeightExpectation === "expected" &&
    applicableHumanWeight <
      CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.expectedConcernThreshold
  ) {
    return {
      level: "possibleConcern",
      expectation: humanWeightExpectation,
      threshold:
        CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION.expectedConcernThreshold,
    };
  }

  return undefined;
}

export function getHumanWeightFeedPriority(
  knowledgeType: EntryKnowledgeType,
  humanWeight: number | undefined,
  evidenceMaturity?: number,
) {
  const applicableHumanWeight = getApplicableHumanWeight(
    knowledgeType,
    humanWeight,
  );
  if (applicableHumanWeight !== undefined) {
    return (
      applicableHumanWeight + getEvidenceMaturityPriorityBoost(evidenceMaturity)
    );
  }

  if (needsHumanWeightFeedback(knowledgeType, humanWeight)) {
    return (
      HUMAN_WEIGHT_FEEDBACK_NEEDED_PRIORITY +
      getEvidenceMaturityPriorityBoost(evidenceMaturity)
    );
  }

  return NON_WEIGHT_BEARING_FEED_PRIORITY;
}

function getEvidenceMaturityPriorityBoost(evidenceMaturity: number | undefined) {
  if (evidenceMaturity === undefined) {
    return 0;
  }

  const boundedMaturity = Math.min(100, Math.max(0, evidenceMaturity));
  return (boundedMaturity / 100) * EVIDENCE_MATURITY_MAX_PRIORITY_BOOST;
}

export function getTypeBehavior(
  knowledgeType: EntryKnowledgeType,
): TypeBehavior {
  const override = TYPE_BEHAVIOR_OVERRIDES[knowledgeType] ?? {};
  const mergedComposerTitle = {
    ...DEFAULT_TYPE_BEHAVIOR.composerDefaults.title,
    ...override.composerDefaults?.title,
  };
  const mergedHumanWeight = {
    ...DEFAULT_TYPE_BEHAVIOR.humanWeight,
    ...override.humanWeight,
  };

  return {
    ...DEFAULT_TYPE_BEHAVIOR,
    ...override,
    humanWeight: isWeightBearingEntryKnowledgeType(knowledgeType)
      ? mergedHumanWeight
      : withoutHumanWeightCreditBasis(mergedHumanWeight),
    knowledgeType,
    composerDefaults: {
      ...DEFAULT_TYPE_BEHAVIOR.composerDefaults,
      ...override.composerDefaults,
      title: mergedComposerTitle,
      titleRequired: mergedComposerTitle.input === "required",
    },
    provenance: {
      ...DEFAULT_TYPE_BEHAVIOR.provenance,
      ...override.provenance,
    },
    representationRoles: {
      ...DEFAULT_TYPE_BEHAVIOR.representationRoles,
      ...override.representationRoles,
    },
  };
}

export function getComposerTitleBehavior(
  knowledgeType: EntryKnowledgeType,
): ComposerTitleBehavior {
  return getTypeBehavior(knowledgeType).composerDefaults.title;
}

function withoutHumanWeightCreditBasis(
  humanWeight: TypeBehavior["humanWeight"],
): TypeBehavior["humanWeight"] {
  return {
    defaultEstimate: humanWeight.defaultEstimate,
    expectation: humanWeight.expectation,
  };
}

export function getTypeBehaviorSnapshot(
  knowledgeType: EntryKnowledgeType,
) {
  const behavior = getTypeBehavior(knowledgeType);

  return {
    behavior,
    behaviorSnapshotJson: JSON.stringify(behavior),
    version: behavior.version,
  };
}
