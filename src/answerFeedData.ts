import { resolveTags, type ActiveTag } from "./knowledgeContext";
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
    contextTagIds: [
      "matthew-5-9",
      "first-crusade",
      "the-city-of-god",
      "augustine",
      "grade-9-church-history",
      "ordered-loves",
    ],
    entry: {
      id: "entry-first-crusade-ordered-loves",
      title: "Augustine, Ordered Loves, and the First Crusade",
      knowledgeType: "lesson",
      previewText:
        "Grade 9 Church History prep for teaching the Crusades through Augustine's earthly city, peace, and disordered loves.",
      primaryTagLabel: "Grade 9 Church History",
      contextPreviewTagLabels: [
        "Matthew 5:9",
        "First Crusade",
        "The City of God",
        "Grade 9 Church History",
      ],
      humanWeight: 94,
      href: "/entries/entry-first-crusade-ordered-loves",
      updatedAt: Date.UTC(2026, 5, 12, 14),
    },
  },
  {
    kind: "answer",
    contextTagIds: [
      "romans-8-28",
      "boethius",
      "the-consolation-of-philosophy",
      "grade-10-medieval-literature",
      "providence",
    ],
    entry: {
      id: "entry-medieval-literature-boethius-lesson",
      title: "1:30 Medieval Literature: Boethius on Providence",
      knowledgeType: "lesson",
      previewText:
        "A nearly ready lesson connecting fortune, providence, and Romans 8:28 before the Grade 10 class meets.",
      primaryTagLabel: "Grade 10 Medieval Literature",
      contextPreviewTagLabels: [
        "Romans 8:28",
        "Boethius",
        "The Consolation of Philosophy",
        "Grade 10 Medieval Literature",
      ],
      humanWeight: 91,
      href: "/entries/entry-medieval-literature-boethius-lesson",
      updatedAt: Date.UTC(2026, 5, 12, 15),
    },
  },
  {
    kind: "answer",
    contextTagIds: [
      "joshua-1-6-9",
      "courage",
      "cs-lewis",
      "gk-chesterton",
      "ruler-of-kings-church",
    ],
    entry: {
      id: "entry-courage-lewis-chesterton-quotes",
      title: "Courage at the Testing Point",
      knowledgeType: "quote",
      previewText:
        "C.S. Lewis: \"Courage is not simply one of the virtues, but the form of every virtue at the testing point.\" Paired with Chesterton on virtue.",
      primaryTagLabel: "C.S. Lewis",
      contextPreviewTagLabels: [
        "Joshua 1:6-9",
        "Courage",
        "C.S. Lewis",
        "G.K. Chesterton",
      ],
      humanWeight: 90,
      href: "/entries/entry-courage-lewis-chesterton-quotes",
      updatedAt: Date.UTC(2026, 5, 11, 18),
    },
  },
  {
    kind: "answer",
    contextTagIds: [
      "daniel-2-20-22",
      "crusades",
      "kingdom-of-christ",
      "grade-9-church-history",
    ],
    entry: {
      id: "entry-kingdoms-rise-and-fall",
      title: "Kingdoms Rise and Fall Under God",
      knowledgeType: "words",
      previewText:
        "A short bridge from Daniel 2 to medieval political history: earthly power is real, limited, and judged.",
      primaryTagLabel: "Daniel 2:20-22",
      contextPreviewTagLabels: [
        "Daniel 2:20-22",
        "Crusades",
        "Kingdom of Christ",
        "Grade 9 Church History",
      ],
      humanWeight: 88,
      href: "/entries/entry-kingdoms-rise-and-fall",
      updatedAt: Date.UTC(2026, 5, 10, 13),
    },
  },
  {
    kind: "answer",
    contextTagIds: [
      "daniel-3",
      "trial-by-fire",
      "daniel-sermon-series",
      "ruler-of-kings-church",
    ],
    entry: {
      id: "entry-trial-by-fire-sermon-event",
      title: "Trial by Fire",
      knowledgeType: "event",
      previewText:
        "Last Sunday's Ruler of Kings Church sermon event on Daniel 3, courage, and faithful witness under pressure.",
      primaryTagLabel: "Trial by Fire",
      contextPreviewTagLabels: [
        "Daniel 3",
        "Trial by Fire",
        "Daniel Sermon Series",
        "Ruler of Kings Church",
      ],
      humanWeight: 86,
      href: "/entries/entry-trial-by-fire-sermon-event",
      updatedAt: Date.UTC(2026, 5, 7, 16),
    },
  },
  {
    kind: "answer",
    contextTagIds: [
      "daniel-4",
      "pride-leads-to-death",
      "daniel-sermon-series",
      "ruler-of-kings-church",
    ],
    entry: {
      id: "entry-pride-leads-to-death-sermon-event",
      title: "Pride Leads to Death",
      knowledgeType: "event",
      previewText:
        "This coming Sunday's Ruler of Kings Church sermon event on Daniel 4 and Nebuchadnezzar's humiliation.",
      primaryTagLabel: "Pride Leads to Death",
      contextPreviewTagLabels: [
        "Daniel 4",
        "Pride Leads to Death",
        "Daniel Sermon Series",
        "Ruler of Kings Church",
      ],
      humanWeight: 84,
      href: "/entries/entry-pride-leads-to-death-sermon-event",
      updatedAt: Date.UTC(2026, 5, 12, 12),
    },
  },
  {
    kind: "answer",
    contextTagIds: [
      "revelation-11-15",
      "psalms-33-12",
      "americas-founding-250",
      "ruler-of-kings-church",
      "kingdom-of-christ",
    ],
    entry: {
      id: "entry-americas-founding-250-event",
      title: "250th Celebration of America's Founding",
      knowledgeType: "event",
      previewText:
        "Ruler of Kings Church gathering for prayer, thanksgiving, and reflection on the nations under Christ's reign.",
      primaryTagLabel: "250th Celebration of America's Founding",
      contextPreviewTagLabels: [
        "Revelation 11:15",
        "Psalms 33:12",
        "Ruler of Kings Church",
        "Kingdom of Christ",
      ],
      humanWeight: 81,
      href: "/entries/entry-americas-founding-250-event",
      updatedAt: Date.UTC(2026, 5, 12, 10),
    },
  },
  {
    kind: "answer",
    contextTagIds: [
      "joshua-1-6-9",
      "courage",
      "ruler-of-kings-deacons",
      "ruler-of-kings-church",
    ],
    entry: {
      id: "entry-deacon-courage-prayer-request",
      title: "Prayer Request: Courage for a Family Trial",
      knowledgeType: "prayerRequest",
      previewText:
        "A deacon follow-up note asking for courage, patience, and wise speech during an ongoing family hardship.",
      primaryTagLabel: "Ruler of Kings Deacons",
      contextPreviewTagLabels: [
        "Joshua 1:6-9",
        "Courage",
        "Ruler of Kings Deacons",
        "Ruler of Kings Church",
      ],
      humanWeight: 76,
      href: "/entries/entry-deacon-courage-prayer-request",
      updatedAt: Date.UTC(2026, 5, 12, 19),
    },
  },
  {
    kind: "slot",
    contextTagIds: [
      "matthew-5-9",
      "first-crusade",
      "grade-9-church-history",
      "student-crusades-question",
    ],
    slot: {
      id: "slot-student-crusades-question",
      title: "Answer Micah's Crusades question",
      requestedKnowledgeType: "comment",
      promptText:
        "Micah asked whether the First Crusade shows Christian courage, zeal without knowledge, or presumption. Answer before seminar.",
      status: "open",
      contextPreviewTagLabels: [
        "Matthew 5:9",
        "First Crusade",
        "Grade 9 Church History",
      ],
      targetLabel: "Grade 9 Church History",
      dueAt: Date.UTC(2026, 5, 12, 12),
      href: "/slots/slot-student-crusades-question",
    },
  },
  {
    kind: "slot",
    contextTagIds: [
      "matthew-5-9",
      "first-crusade",
      "the-city-of-god",
      "grade-9-church-history",
    ],
    slot: {
      id: "slot-grade-9-crusades-essay",
      title: "Collect Grade 9 First Crusade essay",
      requestedKnowledgeType: "essay",
      promptText:
        "Student essay should distinguish holy war rhetoric from Christian courage under the Sermon on the Mount.",
      status: "overdue",
      contextPreviewTagLabels: [
        "Matthew 5:9",
        "First Crusade",
        "The City of God",
        "Grade 9 Church History",
      ],
      targetLabel: "Grade 9 Church History",
      dueAt: Date.UTC(2026, 5, 11, 20),
      href: "/slots/slot-grade-9-crusades-essay",
    },
  },
  {
    kind: "slot",
    contextTagIds: [
      "daniel-4",
      "grade-8-logic",
      "reformed-theology",
      "pride-leads-to-death",
    ],
    slot: {
      id: "slot-grade-8-logic-pride-inference",
      title: "Grade 8 Logic inference examples on pride",
      requestedKnowledgeType: "question",
      promptText:
        "Collect student questions that test valid inferences from Daniel 4 without flattening providence into fatalism.",
      status: "open",
      contextPreviewTagLabels: [
        "Daniel 4",
        "Grade 8 Logic",
        "Reformed Theology",
      ],
      targetLabel: "Grade 8 Logic",
      dueAt: Date.UTC(2026, 5, 13, 18),
      href: "/slots/slot-grade-8-logic-pride-inference",
    },
  },
  {
    kind: "slot",
    contextTagIds: [
      "joshua-1-6-9",
      "courage",
      "ruler-of-kings-deacons",
      "ruler-of-kings-church",
    ],
    slot: {
      id: "slot-deacon-courage-follow-up",
      title: "Deacon follow-up after courage prayer request",
      requestedKnowledgeType: "prayerRequest",
      promptText:
        "Add the follow-up prayer request after today's visit so the deacons can pray with the same Knowledge Context.",
      status: "open",
      contextPreviewTagLabels: [
        "Joshua 1:6-9",
        "Courage",
        "Ruler of Kings Deacons",
      ],
      targetLabel: "Ruler of Kings Deacons",
      dueAt: Date.UTC(2026, 5, 12, 22),
      href: "/slots/slot-deacon-courage-follow-up",
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
  return getPrimarySlotItemForContext(items, activeTags)?.slot;
}

export function getPrimarySlotItemForContext(
  items: AnswerFeedFixtureItem[],
  activeTags: ActiveTag[],
) {
  return selectAnswerFeedItems(items, activeTags).find(isAnswerFeedSlot);
}

export function getFixtureContextTags(contextTagIds: string[]) {
  return resolveTags(contextTagIds);
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
