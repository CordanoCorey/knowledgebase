import type { ActiveTag } from "./knowledgeContext";
import type {
  AnswerFeedItem,
  KnowledgeEntrySummary,
  KnowledgeSlotSummary,
} from "./knowledgeContracts";

export type { ActiveTag } from "./knowledgeContext";
export type {
  AnswerFeedItem,
  KnowledgeEntrySummary,
  KnowledgeSlotSummary,
} from "./knowledgeContracts";

export type AnswerFeedFixtureItem = AnswerFeedItem & {
  contextTagIds: string[];
};

export const ANSWER_FEED_FIXTURE: AnswerFeedFixtureItem[] = [
  {
    kind: "answer",
    contextTagIds: ["romans-8-28", "holy-spirit"],
    entry: {
      id: "entry-romans-8-spirit-sermon",
      title: "Romans 8 and Life in the Spirit",
      knowledgeType: "sermon",
      previewText:
        "A preached answer on assurance, adoption, and the Spirit's witness in Romans 8.",
      primaryTagLabel: "Romans 8:28",
      contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
      humanWeight: 94,
      href: "/entries/entry-romans-8-spirit-sermon",
      updatedAt: Date.UTC(2026, 3, 18, 12),
    },
  },
  {
    kind: "answer",
    contextTagIds: ["romans-8-28", "atonement"],
    entry: {
      id: "entry-romans-8-good-lesson",
      title: "What Romans 8:28 Means by Good",
      knowledgeType: "lesson",
      previewText:
        "A classroom-ready lesson connecting providence, suffering, and Christ's finished work.",
      primaryTagLabel: "Romans 8:28",
      contextPreviewTagLabels: ["Romans 8:28", "Atonement"],
      humanWeight: 87,
      href: "/entries/entry-romans-8-good-lesson",
      updatedAt: Date.UTC(2026, 2, 28, 12),
    },
  },
  {
    kind: "answer",
    contextTagIds: ["atonement"],
    entry: {
      id: "entry-atonement-note",
      title: "A Short Note on Atonement",
      knowledgeType: "words",
      previewText:
        "A compact definition for teachers introducing sacrifice, substitution, and reconciliation.",
      primaryTagLabel: "Atonement",
      contextPreviewTagLabels: ["Atonement"],
      humanWeight: 78,
      href: "/entries/entry-atonement-note",
      updatedAt: Date.UTC(2026, 1, 12, 12),
    },
  },
  {
    kind: "answer",
    contextTagIds: ["john-3-16", "christian-education"],
    entry: {
      id: "entry-john-316-discussion",
      title: "John 3:16 Classroom Discussion",
      knowledgeType: "lesson",
      previewText:
        "Discussion prompts for helping students trace love, faith, judgment, and everlasting life.",
      primaryTagLabel: "John 3:16",
      contextPreviewTagLabels: ["John 3:16", "Christian Education"],
      humanWeight: 89,
      href: "/entries/entry-john-316-discussion",
      updatedAt: Date.UTC(2026, 4, 5, 12),
    },
  },
  {
    kind: "answer",
    contextTagIds: ["romans-8-28"],
    entry: {
      id: "entry-romans-8-summary",
      title: "Romans 8 Summary Draft",
      knowledgeType: "words",
      previewText:
        "A rough summary that needs more human review before it carries much weight.",
      primaryTagLabel: "Romans 8:28",
      contextPreviewTagLabels: ["Romans 8:28"],
      humanWeight: 32,
      href: "/entries/entry-romans-8-summary",
      updatedAt: Date.UTC(2026, 0, 22, 12),
    },
  },
  {
    kind: "slot",
    contextTagIds: ["romans-8-28", "holy-spirit"],
    slot: {
      id: "slot-romans-8-spirit-lesson",
      title: "Lesson on Romans 8 and the Holy Spirit",
      requestedKnowledgeType: "lesson",
      promptText:
        "Contribute a future Answer that helps a youth group connect Romans 8 with the Spirit's comfort.",
      status: "open",
      contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
      targetLabel: "Open to My Church",
      dueAt: Date.UTC(2026, 5, 30, 12),
      href: "/slots/slot-romans-8-spirit-lesson",
    },
  },
  {
    kind: "slot",
    contextTagIds: ["romans-8-28", "atonement"],
    slot: {
      id: "slot-romans-8-atonement-answer",
      title: "Answer connecting Romans 8 and atonement",
      requestedKnowledgeType: "words",
      promptText:
        "Add a concise Answer for how no condemnation rests on Christ's atoning work.",
      status: "open",
      contextPreviewTagLabels: ["Romans 8:28", "Atonement"],
      targetLabel: "Public",
      href: "/slots/slot-romans-8-atonement-answer",
    },
  },
  {
    kind: "slot",
    contextTagIds: ["john-3-16", "christian-education"],
    slot: {
      id: "slot-john-316-essay",
      title: "Student essay on John 3:16",
      requestedKnowledgeType: "essay",
      status: "overdue",
      contextPreviewTagLabels: ["John 3:16", "Christian Education"],
      targetLabel: "Grade 7 Bible",
      dueAt: Date.UTC(2026, 4, 20, 12),
      href: "/slots/slot-john-316-essay",
    },
  },
  {
    kind: "slot",
    contextTagIds: ["atonement"],
    slot: {
      id: "slot-atonement-quote",
      title: "Quote for atonement sermon prep",
      requestedKnowledgeType: "quote",
      promptText:
        "Contribute a well-cited Quote that can serve a sermon on atonement.",
      status: "open",
      contextPreviewTagLabels: ["Atonement"],
      targetLabel: "My Church",
      href: "/slots/slot-atonement-quote",
    },
  },
];

export function fitsKnowledgeContext(
  itemTagIds: string[],
  activeTagIds: string[],
) {
  const itemTagIdSet = new Set(itemTagIds);
  return activeTagIds.every((tagId) => itemTagIdSet.has(tagId));
}

export function selectAnswerFeedItems(
  items: AnswerFeedFixtureItem[],
  activeTags: ActiveTag[],
) {
  const activeTagIds = activeTags.map((tag) => tag.id);
  const matchingItems = items.filter((item) =>
    fitsKnowledgeContext(item.contextTagIds, activeTagIds),
  );
  const answerItems = matchingItems
    .filter(isAnswerFeedAnswer)
    .sort(compareAnswerFeedAnswers);
  const slotItems = matchingItems
    .filter(isAnswerFeedSlot)
    .sort(compareAnswerFeedSlots);

  return [...answerItems, ...slotItems];
}

export function getPrimarySlotForContext(
  items: AnswerFeedFixtureItem[],
  activeTags: ActiveTag[],
) {
  return selectAnswerFeedItems(items, activeTags).find(isAnswerFeedSlot)?.slot;
}

export function getAnswerFeedItemId(item: AnswerFeedItem) {
  return item.kind === "answer" ? item.entry.id : item.slot.id;
}

export function isAnswerFeedAnswer(
  item: AnswerFeedFixtureItem,
): item is AnswerFeedFixtureItem & { kind: "answer" } {
  return item.kind === "answer";
}

export function isAnswerFeedSlot(
  item: AnswerFeedFixtureItem,
): item is AnswerFeedFixtureItem & { kind: "slot" } {
  return item.kind === "slot";
}

function compareAnswerFeedAnswers(
  first: AnswerFeedFixtureItem & { kind: "answer" },
  second: AnswerFeedFixtureItem & { kind: "answer" },
) {
  return (
    second.entry.humanWeight - first.entry.humanWeight ||
    second.entry.updatedAt - first.entry.updatedAt ||
    first.entry.title.localeCompare(second.entry.title)
  );
}

function compareAnswerFeedSlots(
  first: AnswerFeedFixtureItem & { kind: "slot" },
  second: AnswerFeedFixtureItem & { kind: "slot" },
) {
  const statusDifference =
    getSlotStatusOrder(first.slot.status) - getSlotStatusOrder(second.slot.status);
  if (statusDifference !== 0) {
    return statusDifference;
  }

  return (
    (first.slot.dueAt ?? Number.POSITIVE_INFINITY) -
      (second.slot.dueAt ?? Number.POSITIVE_INFINITY) ||
    first.slot.title.localeCompare(second.slot.title)
  );
}

function getSlotStatusOrder(status: KnowledgeSlotSummary["status"]) {
  if (status === "overdue") {
    return 0;
  }

  if (status === "open") {
    return 1;
  }

  if (status === "fulfilled") {
    return 2;
  }

  return 3;
}
