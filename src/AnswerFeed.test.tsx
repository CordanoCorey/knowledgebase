// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import {
  AnswerFeed,
  filterAnswerFeedItems,
  getAnswerFeedKnowledgeTypeOptions,
} from "./AnswerFeed";
import {
  type ActiveTag,
  type AnswerFeedFixtureItem,
  fitsKnowledgeContext,
  selectAnswerFeedItems,
  selectKnowledgeContextExperts,
} from "./answerFeedData";

const adaContributor = {
  id: "contributor-ada-teacher",
  name: "Ada Teacher",
};

const benContributor = {
  id: "contributor-ben-scholar",
  name: "Ben Scholar",
};

const romansTag: ActiveTag = {
  id: "romans-8-28",
  label: "Romans 8:28",
  knowledgeType: "biblePassage",
  canonicalKey: "romans-8-28",
  href: "/scripture/romans-8-28",
};

const holySpiritTag: ActiveTag = {
  id: "holy-spirit",
  label: "Holy Spirit",
  knowledgeType: "topic",
  canonicalKey: "holy-spirit",
  href: "/goto/holy-spirit",
};

const missingTag: ActiveTag = {
  id: "missing-context",
  label: "Missing Context",
  knowledgeType: "topic",
  canonicalKey: "missing-context",
  href: "/goto/missing-context",
};

const lowerWeightAnswer: AnswerFeedFixtureItem = {
  kind: "answer",
  contextTagIds: ["romans-8-28", "holy-spirit"],
  entry: {
    contributor: adaContributor,
    id: "entry-lower-weight",
    title: "Lower Weight Answer",
    knowledgeType: "words",
    previewText: "A lower-weight answer.",
    primaryTagLabel: "Romans 8:28",
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    humanWeight: 42,
    href: "/entries/entry-lower-weight",
    updatedAt: Date.UTC(2026, 1, 1, 12),
  },
};

const higherWeightAnswer: AnswerFeedFixtureItem = {
  kind: "answer",
  contextTagIds: ["romans-8-28", "holy-spirit"],
  entry: {
    contributor: benContributor,
    id: "entry-higher-weight",
    title: "Higher Weight Answer",
    knowledgeType: "lesson",
    previewText: "A higher-weight answer.",
    primaryTagLabel: "Romans 8:28",
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    humanWeight: 96,
    href: "/entries/entry-higher-weight",
    updatedAt: Date.UTC(2026, 1, 2, 12),
  },
};

const nonWeightBearingAnswer: AnswerFeedFixtureItem = {
  kind: "answer",
  contextTagIds: ["romans-8-28", "holy-spirit"],
  entry: {
    contributor: benContributor,
    id: "entry-topic-without-human-weight",
    title: "Newer Topic Without Human Weight",
    knowledgeType: "topic",
    previewText: "A navigable topic entry without human-weighted substance.",
    primaryTagLabel: "Holy Spirit",
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    href: "/entries/entry-topic-without-human-weight",
    updatedAt: Date.UTC(2026, 1, 3, 12),
  },
};

const matchingSlot: AnswerFeedFixtureItem = {
  kind: "slot",
  contextTagIds: ["romans-8-28", "holy-spirit"],
  slot: {
    id: "slot-matching",
    title: "Requested future Answer",
    requestedKnowledgeType: "lesson",
    promptText: "Contribute a future Answer for this Knowledge Context.",
    status: "open",
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    targetLabel: "Youth teachers",
    href: "/slots/slot-matching",
  },
};

const broaderAnswer: AnswerFeedFixtureItem = {
  ...higherWeightAnswer,
  contextTagIds: ["romans-8-28"],
  entry: {
    ...higherWeightAnswer.entry,
    contributor: benContributor,
    id: "entry-broader",
    title: "Broader Answer",
    href: "/entries/entry-broader",
  },
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

describe("Answer Feed helpers", () => {
  test("treats Context Match as containing every active Tag", () => {
    expect(
      fitsKnowledgeContext(["romans-8-28", "holy-spirit", "atonement"], [
        "romans-8-28",
        "holy-spirit",
      ]),
    ).toBe(true);
    expect(
      fitsKnowledgeContext(["romans-8-28"], ["romans-8-28", "holy-spirit"]),
    ).toBe(false);
  });

  test("filters mixed fixtures and orders existing Answers by Human Weight", () => {
    const feedItems = selectAnswerFeedItems(
      [lowerWeightAnswer, matchingSlot, higherWeightAnswer, broaderAnswer],
      [romansTag, holySpiritTag],
    );

    expect(feedItems.map((item) => item.kind)).toEqual([
      "answer",
      "answer",
      "slot",
    ]);
    expect(
      feedItems
        .filter((item) => item.kind === "answer")
        .map((item) => item.entry.title),
    ).toEqual(["Higher Weight Answer", "Lower Weight Answer"]);
    expect(feedItems.some((item) => item.kind === "slot")).toBe(true);
    expect(feedItems.some((item) => item.kind === "answer" && item.entry.title === "Broader Answer")).toBe(false);
  });

  test("orders unscored non-weight-bearing Answers after scored Answers", () => {
    const feedItems = selectAnswerFeedItems(
      [
        nonWeightBearingAnswer,
        lowerWeightAnswer,
        matchingSlot,
        higherWeightAnswer,
      ],
      [romansTag, holySpiritTag],
    );

    expect(
      feedItems
        .filter((item) => item.kind === "answer")
        .map((item) => item.entry.title),
    ).toEqual([
      "Higher Weight Answer",
      "Lower Weight Answer",
      "Newer Topic Without Human Weight",
    ]);
  });

  test("ranks experts from matching Answer contributors", () => {
    const experts = selectKnowledgeContextExperts(
      [
        lowerWeightAnswer,
        matchingSlot,
        higherWeightAnswer,
        broaderAnswer,
        nonWeightBearingAnswer,
      ],
      [romansTag, holySpiritTag],
      2,
    );

    expect(experts).toEqual([
      {
        ...benContributor,
        averageHumanWeight: 96,
        contributionCount: 1,
        reliabilityScore: 108,
      },
      {
        ...adaContributor,
        averageHumanWeight: 42,
        contributionCount: 1,
        reliabilityScore: 54,
      },
    ]);
  });

  test("derives Knowledge Type options from Answers and requested entries", () => {
    expect(
      getAnswerFeedKnowledgeTypeOptions([
        lowerWeightAnswer,
        matchingSlot,
        higherWeightAnswer,
      ]),
    ).toEqual(["lesson", "words"]);
  });

  test("filters mixed feed items by feed kind", () => {
    const feedItems = [lowerWeightAnswer, matchingSlot, higherWeightAnswer];

    expect(
      filterAnswerFeedItems(feedItems, {
        kind: "entries",
        knowledgeType: "all",
      }).map((item) => item.kind),
    ).toEqual(["answer", "answer"]);
    expect(
      filterAnswerFeedItems(feedItems, {
        kind: "requests",
        knowledgeType: "all",
      }).map((item) => item.kind),
    ).toEqual(["slot"]);
    expect(
      filterAnswerFeedItems(feedItems, {
        kind: "all",
        knowledgeType: "all",
      }).map((item) => item.kind),
    ).toEqual(["answer", "slot", "answer"]);
  });

  test("filters Entries and Requests by Knowledge Type", () => {
    const feedItems = [lowerWeightAnswer, matchingSlot, higherWeightAnswer];

    expect(
      filterAnswerFeedItems(feedItems, {
        kind: "all",
        knowledgeType: "lesson",
      }).map((item) => item.kind),
    ).toEqual(["slot", "answer"]);
    expect(
      filterAnswerFeedItems(feedItems, {
        kind: "requests",
        knowledgeType: "lesson",
      }).map((item) => item.kind),
    ).toEqual(["slot"]);
    expect(
      filterAnswerFeedItems(feedItems, {
        kind: "all",
        knowledgeType: "words",
      }).map((item) => item.kind),
    ).toEqual(["answer"]);
  });

  test("filters matching Entries by context search text and Knowledge Type", () => {
    const feedItems = [lowerWeightAnswer, matchingSlot, higherWeightAnswer];

    expect(
      filterAnswerFeedItems(feedItems, {
        kind: "all",
        knowledgeType: "all",
        searchQuery: "higher-weight",
      }).map((item) => (item.kind === "answer" ? item.entry.title : item.slot.title)),
    ).toEqual(["Higher Weight Answer"]);
    expect(
      filterAnswerFeedItems(feedItems, {
        kind: "all",
        knowledgeType: "lesson",
        searchQuery: "higher",
      }).map((item) => (item.kind === "answer" ? item.entry.title : item.slot.title)),
    ).toEqual(["Higher Weight Answer"]);
    expect(
      filterAnswerFeedItems(feedItems, {
        kind: "requests",
        knowledgeType: "lesson",
        searchQuery: "requested",
      }),
    ).toEqual([]);
  });
});

describe("AnswerFeed", () => {
  test("renders mixed Answer and requested-entry cards", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed
        activeTags={[romansTag, holySpiritTag]}
        items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
      />,
    );

    expect(markup).toContain("Answer Feed");
    expect(markup).toContain("2 Answers");
    expect(markup).toContain("1 Open Request");
    expect(markup).toContain('data-feed-kind="answer"');
    expect(markup).toContain('data-feed-kind="slot"');
    expect(markup).toContain("Higher Weight Answer");
    expect(markup).toContain("Contributed by");
    expect(markup).toContain("Ben Scholar");
    expect(markup).toContain("Context experts");
    expect(markup).toContain("Human Weight");
    expect(markup).toContain("Requested future Answer");
    expect(markup).toContain("Requested Entry");
    expect(markup).toContain('href="/scripture/romans-8-28"');
    expect(markup).toContain('href="/goto/holy-spirit"');
    expect(markup).not.toContain("Knowledge Slot");
  });

  test("renders a clearable in-context search chip", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed
        activeTags={[romansTag, holySpiritTag]}
        items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
        onClearSearchQuery={() => undefined}
        searchQuery="Higher"
      />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('Searching this context for &quot;Higher&quot;');
    expect(markup).toContain("1 item shown");
    expect(markup).toContain("Higher Weight Answer");
    expect(markup).not.toContain("Lower Weight Answer");
    expect(markup).not.toContain("Requested future Answer");
  });

  test("renders compact feed-kind and Knowledge Type controls", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed
        activeTags={[romansTag, holySpiritTag]}
        items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
      />,
    );

    expect(markup).toContain('aria-label="Answer Feed controls"');
    expect(markup).toContain('aria-label="Feed kind filter"');
    expect(markup).toContain('aria-label="Knowledge Type filter"');
    expect(markup).toContain(
      'aria-pressed="true" data-active="true" type="button">All</button>',
    );
    expect(markup).toContain(">Entries</button>");
    expect(markup).toContain(">Requests</button>");
    expect(markup).toContain(
      'aria-pressed="true" data-active="true" type="button">All Types</button>',
    );
    expect(markup).toContain(">Lesson</button>");
    expect(markup).toContain(">Words</button>");
  });

  test("narrows visible cards when feed controls are selected", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <AnswerFeed
          activeTags={[romansTag, holySpiritTag]}
          items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
        />,
      );
    });

    expect(container.textContent).toContain("Lower Weight Answer");
    expect(container.textContent).toContain("Higher Weight Answer");
    expect(container.textContent).toContain("Requested future Answer");

    const lessonButton = getButtonByText(container, "Lesson");
    act(() => {
      lessonButton.click();
    });

    expect(container.textContent).not.toContain("Lower Weight Answer");
    expect(container.textContent).toContain("Higher Weight Answer");
    expect(container.textContent).toContain("Requested future Answer");
    expect(container.querySelectorAll('[data-feed-kind="answer"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-feed-kind="slot"]')).toHaveLength(1);

    const requestsButton = getButtonByText(container, "Requests");
    act(() => {
      requestsButton.click();
    });

    expect(container.textContent).not.toContain("Higher Weight Answer");
    expect(container.textContent).toContain("Requested future Answer");
    expect(container.querySelectorAll('[data-feed-kind="answer"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-feed-kind="slot"]')).toHaveLength(1);
  });

  test("renders a subtle context trend badge with experts", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed
        activeTags={[romansTag, holySpiritTag]}
        contextTrend={{
          answerCount: 2,
          href: "/explore?tagIds=holy-spirit,romans-8-28",
          label: "Holy Spirit + Romans 8:28",
          openRequestCount: 1,
          overdueRequestCount: 0,
          recentVisitCount: 3,
          totalVisitCount: 7,
          trendKind: "popularAndNeedsContribution",
          trendScore: 48,
        }}
        items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
      />,
    );

    expect(markup).toContain("Context experts");
    expect(markup).toContain("Trending 48 + needs");
    expect(markup).toContain("3 recent visits, 7 total visits, 1 open request");
  });

  test("can render the mixed feed as masonry", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed
        activeTags={[romansTag, holySpiritTag]}
        items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
        layout="masonry"
      />,
    );

    expect(markup).toContain("kb-answer-feed-list-masonry");
    expect(markup).toContain('data-feed-kind="answer"');
    expect(markup).toContain('data-feed-kind="slot"');
  });

  test("can render the masonry heading as accessibility-only chrome", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed
        activeTags={[romansTag, holySpiritTag]}
        headingMode="sr-only"
        items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
        layout="masonry"
      />,
    );

    expect(markup).toContain('class="kb-sr-only"');
    expect(markup).toContain("2 entries + 1 request");
    expect(markup).toContain(
      '<div class="kb-sr-only"><p class="kb-eyebrow">Answer Feed</p><h2 id="kb-answer-feed-heading">Answers</h2></div>',
    );
  });

  test("renders no-match empty states for Answers and Slots", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed activeTags={[missingTag]} items={[lowerWeightAnswer, matchingSlot]} />,
    );

    expect(markup).toContain("No Answers match this Knowledge Context yet.");
    expect(markup).toContain("Contribute the missing future Answer from here.");
    expect(markup).toContain("No requested entries are open in this Knowledge Context.");
    expect(markup).toContain("Create a request when a future Answer should be contributed.");
  });

  test("renders slot-only state with the Slot still discoverable in the feed", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed activeTags={[romansTag, holySpiritTag]} items={[matchingSlot]} />,
    );

    expect(markup).toContain("0 Answers");
    expect(markup).toContain("1 Open Request");
    expect(markup).toContain("No Answers match this Knowledge Context yet.");
    expect(markup).toContain("Requested future Answer");
    expect(markup).toContain('data-feed-kind="slot"');
  });
});

function getButtonByText(container: HTMLElement, text: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );

  if (!button) {
    throw new Error(`Expected button with text "${text}"`);
  }

  return button;
}
