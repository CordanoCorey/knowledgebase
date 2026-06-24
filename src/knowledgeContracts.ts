export type KnowledgeType =
  | "words"
  | "biblePassage"
  | "topic"
  | "series"
  | "question"
  | "quote"
  | "sermon"
  | "essay"
  | "poem"
  | "song"
  | "book"
  | "shortStory"
  | "lesson"
  | "comment"
  | "prayerRequest"
  | "event"
  | "rsvp"
  | "person"
  | "organization"
  | "group"
  | "place";

export type AuthorableKnowledgeType = Exclude<KnowledgeType, "biblePassage">;
export type GuidedContributionType = Extract<AuthorableKnowledgeType, "group">;

export const AUTHORABLE_KNOWLEDGE_TYPES = [
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
] as const satisfies readonly AuthorableKnowledgeType[];

export const WEIGHT_BEARING_KNOWLEDGE_TYPES = [
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
] as const satisfies readonly AuthorableKnowledgeType[];

export type WeightBearingKnowledgeType =
  (typeof WEIGHT_BEARING_KNOWLEDGE_TYPES)[number];

export const NON_WEIGHT_BEARING_KNOWLEDGE_TYPES = [
  "rsvp",
  "person",
  "organization",
  "group",
  "place",
  "topic",
] as const satisfies readonly AuthorableKnowledgeType[];

export type NonWeightBearingKnowledgeType =
  (typeof NON_WEIGHT_BEARING_KNOWLEDGE_TYPES)[number];

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

export type HumanWeightCreditSummary = {
  basis: HumanWeightCreditBasis;
  label: string;
};

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

export const CURRENT_HUMAN_WEIGHT_CALCULATION_DEFINITION = {
  version: "mvp-human-weight-feedback-v1",
  expectedConcernThreshold: 40,
  requiredConcernThreshold: 60,
} as const;

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

const DEFAULT_COMPOSER_TITLE_BEHAVIOR: ComposerTitleBehavior = {
  generatedTitleKind: "none",
  input: "required",
  label: "Title",
  previewLabel: "Title",
  primaryInput: false,
  smartStorageTriggerWhenProvided: false,
};

const COMPOSER_TITLE_BEHAVIOR_OVERRIDES: Partial<
  Record<AuthorableKnowledgeType, Partial<ComposerTitleBehavior>>
> = {
  comment: {
    generatedTitleKind: "parentComment",
    input: "hidden",
  },
  question: {
    label: "Question",
    placeholder: "Ask a question...",
    previewLabel: "Question",
    primaryInput: true,
  },
  words: {
    generatedTitleKind: "bodyPreview",
    input: "addable",
    placeholder: "Optional title",
    smartStorageTriggerWhenProvided: true,
  },
};

export const HUMAN_WEIGHT_FEEDBACK_KINDS = [
  "recognize",
  "used",
  "notHuman",
  "wrongContext",
] as const;

export type HumanWeightFeedbackKind =
  (typeof HUMAN_WEIGHT_FEEDBACK_KINDS)[number];

export type GenericContributionKnowledgeType = Exclude<
  AuthorableKnowledgeType,
  "rsvp"
>;

export const GENERIC_CONTRIBUTION_KNOWLEDGE_TYPES =
  AUTHORABLE_KNOWLEDGE_TYPES.filter(
    (knowledgeType): knowledgeType is GenericContributionKnowledgeType =>
      knowledgeType !== "rsvp",
  );

export type KnowledgeLocationKind =
  | "dashboard"
  | "biblePassageReferent"
  | "referent"
  | "context";

export type ActiveTag = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: KnowledgeType;
  label: string;
  passageString?: string;
};

export type KnowledgeRequestDraft = {
  text: string;
  mappedTags: ActiveTag[];
  mappingStatus: "idle" | "mapping" | "proposed" | "applied";
};

export type KnowledgeEntrySummary = {
  contributor: ContributorSummary;
  id: string;
  title: string;
  knowledgeType: AuthorableKnowledgeType;
  previewText: string;
  primaryTagLabel: string;
  contextPreviewTagLabels: string[];
  humanWeight?: number;
  evidenceMaturity?: number;
  humanWeightConcern?: HumanWeightConcernSummary;
  humanWeightCredit?: HumanWeightCreditSummary;
  quoteAttribution?: QuoteAttributionSummary;
  href: string;
  updatedAt: number;
};

export type QuoteAttributionSummary = {
  quotedPersonLabel?: string;
  quotedPersonReferentId?: string;
};

export type QuoteAttributionPersonOption = {
  label: string;
  referentId: string;
  tagId: string;
};

export type HumanWeightEvidenceSummary = {
  evidenceCount: number;
  positiveEvidenceCount: number;
  negativeEvidenceCount: number;
  evidenceMaturity: number;
};

export type HumanWeightFeedbackInput = {
  entry: KnowledgeEntrySummary;
  feedbackKind: HumanWeightFeedbackKind;
  feedbackNote?: string;
};

export type ContributorSummary = {
  href?: string;
  id: string;
  name: string;
};

export type KnowledgeContextExpert = ContributorSummary & {
  subjectKind?: "user" | "person";
  subjectUserId?: string;
  subjectPersonReferentId?: string;
  contextExpertiseMaturity: number;
  contextExpertiseScore: number;
  contextMatchKind?: "broaderContext";
  evidenceCount: number;
  feedbackCount: number;
  postCount: number;
};

export type KnowledgeContextExpertScope = "orbit" | "global";

export type KnowledgeContextExpertDetail = KnowledgeContextExpert & {
  topSupportingEntries: KnowledgeEntrySummary[];
};

export type KnowledgeContextTrendKind =
  | "quiet"
  | "popular"
  | "needsContribution"
  | "popularAndNeedsContribution";

export type KnowledgeContextTrendSummary = {
  answerCount: number;
  href: string;
  label: string;
  openRequestCount: number;
  overdueRequestCount: number;
  recentVisitCount: number;
  totalVisitCount: number;
  trendKind: KnowledgeContextTrendKind;
  trendScore: number;
};

export type KnowledgeSlotStatus = "open" | "fulfilled" | "cancelled" | "overdue";

export type KnowledgeSlotSummary = {
  id: string;
  title: string;
  requestedKnowledgeType: AuthorableKnowledgeType;
  promptText?: string;
  status: KnowledgeSlotStatus;
  contextPreviewTagLabels: string[];
  targetLabel: string;
  dueAt?: number;
  href: string;
};

export type ContributionInput = {
  body: string;
  contributionNote?: string;
  contextTags: ActiveTag[];
  externalUrls?: SmartStorageExternalUrlInput[];
  knowledgeType: AuthorableKnowledgeType;
  slotId?: string;
  title: string;
  uploadedFiles?: SmartStorageUploadedFileInput[];
};

export type ProposalConfidence = "low" | "medium" | "high";

export type SmartStorageUploadedFileInput = {
  contentType?: string;
  fileName: string;
  fileSizeBytes?: number;
  languageCode?: string;
  storageId: string;
  temporaryUploadId?: string;
  title?: string;
};

export type SmartStorageExternalUrlInput = {
  linkPreviewDescription?: string;
  linkPreviewImageUrl?: string;
  linkPreviewSiteName?: string;
  linkPreviewTitle?: string;
  title?: string;
  url: string;
};

export type DraftLinkPreviewResult =
  | {
      description?: string;
      imageUrl?: string;
      siteName?: string;
      status: "fetched";
      title?: string;
      url: string;
    }
  | {
      error?: string;
      status: "failed";
      url: string;
    };

export type SmartStorageProposedEntrySummary = {
  bodyPreview: string;
  contextTags: ActiveTag[];
  knowledgeType: AuthorableKnowledgeType;
  proposalConfidence: ProposalConfidence;
  rationale: string;
  title: string;
};

export type SmartStorageProposalSourceCitationSummary = {
  citationKind: "wholeSource" | "textExcerpt" | "fileLocator" | "externalUrl";
  excerptText?: string;
  externalUrl?: string;
  id: string;
  locator?: string;
  rationale?: string;
  sourceId: string;
};

export const REPRESENTATION_ROLE_OPTIONS = [
  "unspecified",
  "primaryContent",
  "manuscript",
  "slides",
  "transcript",
  "recording",
  "thumbnail",
  "supportingMaterial",
] as const;

export type RepresentationRole = (typeof REPRESENTATION_ROLE_OPTIONS)[number];

export type SmartStorageRepresentationDecision = {
  includeAsRepresentation: boolean;
  isPrimary: boolean;
  representationRole: RepresentationRole;
  sourceId: string;
};

export type SmartStorageProposalReviewSummary = {
  contributionSubmissionId?: string;
  currentProposal: SmartStorageProposedEntrySummary;
  id: string;
  smartStorageRunId: string;
  sourceCitations: SmartStorageProposalSourceCitationSummary[];
  sourceId: string;
  sourceIds: string[];
  status: "drafted" | "needsResolution" | "accepted";
  targetExistingEntryId?: string;
};

export type ContributionResult = {
  contributionSubmissionId?: string;
  entryId?: string;
  smartStorageProposalId?: string;
  smartStorageRunId?: string;
  sourceId?: string;
  sourceIds?: string[];
  status: "submitted";
};

export type ContributionMode = "direct" | "smartStorage";

export type ContributionPreviewAttribute = {
  label: string;
  value: string;
};

export type ContributionPreview = {
  attributes: ContributionPreviewAttribute[];
  context: ActiveTag[];
  knowledgeType: AuthorableKnowledgeType;
  mode: ContributionMode;
  submitLabel: string;
};

export type AnswerFeedItem =
  | { kind: "answer"; entry: KnowledgeEntrySummary }
  | { kind: "slot"; slot: KnowledgeSlotSummary };

export type KnowledgeLoopState = {
  activeTags: ActiveTag[];
  contextKey: string;
  locationKind: KnowledgeLocationKind;
  requestDraft: KnowledgeRequestDraft;
};

const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  words: "Words",
  biblePassage: "Bible Passage",
  topic: "Topic",
  series: "Series",
  question: "Question",
  quote: "Quote",
  sermon: "Sermon",
  essay: "Essay",
  poem: "Poem",
  song: "Song",
  book: "Book",
  shortStory: "Short Story",
  lesson: "Lesson",
  comment: "Comment",
  prayerRequest: "Prayer Request",
  event: "Event",
  rsvp: "RSVP",
  person: "Person",
  organization: "Organization",
  group: "Group",
  place: "Place",
};

export function formatKnowledgeTypeLabel(knowledgeType: KnowledgeType) {
  return KNOWLEDGE_TYPE_LABELS[knowledgeType];
}

export function getComposerTitleBehavior(
  knowledgeType: AuthorableKnowledgeType,
): ComposerTitleBehavior {
  return {
    ...DEFAULT_COMPOSER_TITLE_BEHAVIOR,
    ...COMPOSER_TITLE_BEHAVIOR_OVERRIDES[knowledgeType],
  };
}

export function isComposerTitleAddable(
  knowledgeType: AuthorableKnowledgeType,
) {
  return getComposerTitleBehavior(knowledgeType).input === "addable";
}

export function isComposerTitleRequired(
  knowledgeType: AuthorableKnowledgeType,
) {
  return getComposerTitleBehavior(knowledgeType).input === "required";
}

const AUTHORABLE_KNOWLEDGE_TYPE_SET = new Set<KnowledgeType>(
  AUTHORABLE_KNOWLEDGE_TYPES,
);

const WEIGHT_BEARING_KNOWLEDGE_TYPE_SET = new Set<KnowledgeType>(
  WEIGHT_BEARING_KNOWLEDGE_TYPES,
);

const NON_WEIGHT_BEARING_KNOWLEDGE_TYPE_SET = new Set<KnowledgeType>(
  NON_WEIGHT_BEARING_KNOWLEDGE_TYPES,
);

export function isAuthorableKnowledgeType(
  knowledgeType: KnowledgeType | string | null | undefined,
): knowledgeType is AuthorableKnowledgeType {
  return (
    typeof knowledgeType === "string" &&
    AUTHORABLE_KNOWLEDGE_TYPE_SET.has(knowledgeType as KnowledgeType)
  );
}

export function isWeightBearingKnowledgeType(
  knowledgeType: KnowledgeType,
): knowledgeType is WeightBearingKnowledgeType {
  return WEIGHT_BEARING_KNOWLEDGE_TYPE_SET.has(knowledgeType);
}

export function isNonWeightBearingKnowledgeType(
  knowledgeType: KnowledgeType,
): knowledgeType is NonWeightBearingKnowledgeType {
  return NON_WEIGHT_BEARING_KNOWLEDGE_TYPE_SET.has(knowledgeType);
}

export function getDefaultHumanWeightExpectation(
  knowledgeType: KnowledgeType,
): HumanWeightExpectation {
  if (knowledgeType === "words" || knowledgeType === "essay") {
    return "expected";
  }

  return isWeightBearingKnowledgeType(knowledgeType) ? "informative" : "none";
}

export function getDefaultHumanWeightCreditBasis(
  knowledgeType: KnowledgeType,
): HumanWeightCreditBasis | undefined {
  if (!isWeightBearingKnowledgeType(knowledgeType)) {
    return undefined;
  }

  return knowledgeType === "quote" ? "quotedPerson" : "contributor";
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

export function getApplicableHumanWeight(entry: {
  humanWeight?: number;
  knowledgeType: KnowledgeType;
}) {
  return isWeightBearingKnowledgeType(entry.knowledgeType)
    ? entry.humanWeight
    : undefined;
}

export function needsHumanWeightFeedback(entry: {
  humanWeight?: number;
  knowledgeType: KnowledgeType;
}) {
  return (
    entry.humanWeight === undefined &&
    isWeightBearingKnowledgeType(entry.knowledgeType)
  );
}

export function getHumanWeightConcern({
  expectation,
  humanWeight,
  knowledgeType,
}: {
  expectation?: HumanWeightExpectation;
  humanWeight?: number;
  knowledgeType: KnowledgeType;
}): HumanWeightConcernSummary | undefined {
  const applicableHumanWeight = getApplicableHumanWeight({
    humanWeight,
    knowledgeType,
  });
  if (applicableHumanWeight === undefined) {
    return undefined;
  }

  const humanWeightExpectation =
    expectation ?? getDefaultHumanWeightExpectation(knowledgeType);

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

export function getHumanWeightFeedPriority(entry: {
  evidenceMaturity?: number;
  humanWeight?: number;
  knowledgeType: KnowledgeType;
}) {
  const humanWeight = getApplicableHumanWeight(entry);
  if (humanWeight !== undefined) {
    return humanWeight + getEvidenceMaturityPriorityBoost(entry.evidenceMaturity);
  }

  if (needsHumanWeightFeedback(entry)) {
    return (
      HUMAN_WEIGHT_FEEDBACK_NEEDED_PRIORITY +
      getEvidenceMaturityPriorityBoost(entry.evidenceMaturity)
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
