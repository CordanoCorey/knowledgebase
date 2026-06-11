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

export type ContributionResult = {
  entryId?: string;
  status: "submitted";
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
