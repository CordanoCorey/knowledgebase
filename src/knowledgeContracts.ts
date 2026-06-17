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
  humanWeight: number;
  href: string;
  updatedAt: number;
};

export type ContributorSummary = {
  href?: string;
  id: string;
  name: string;
};

export type KnowledgeContextExpert = ContributorSummary & {
  averageHumanWeight: number;
  contributionCount: number;
  reliabilityScore: number;
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
  contextTags: ActiveTag[];
  knowledgeType: AuthorableKnowledgeType;
  slotId?: string;
  title: string;
};

export type ProposalConfidence = "low" | "medium" | "high";

export type SmartStorageProposedEntrySummary = {
  bodyPreview: string;
  contextTags: ActiveTag[];
  knowledgeType: AuthorableKnowledgeType;
  proposalConfidence: ProposalConfidence;
  rationale: string;
  title: string;
};

export type SmartStorageProposalReviewSummary = {
  currentProposal: SmartStorageProposedEntrySummary;
  id: string;
  smartStorageRunId: string;
  sourceId: string;
  status: "drafted";
};

export type ContributionResult = {
  entryId?: string;
  smartStorageProposalId?: string;
  smartStorageRunId?: string;
  sourceId?: string;
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

const AUTHORABLE_KNOWLEDGE_TYPE_SET = new Set<KnowledgeType>(
  AUTHORABLE_KNOWLEDGE_TYPES,
);

export function isAuthorableKnowledgeType(
  knowledgeType: KnowledgeType | string | null | undefined,
): knowledgeType is AuthorableKnowledgeType {
  return (
    typeof knowledgeType === "string" &&
    AUTHORABLE_KNOWLEDGE_TYPE_SET.has(knowledgeType as KnowledgeType)
  );
}
