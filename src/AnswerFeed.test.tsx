import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AnswerFeed } from "./AnswerFeed";
import {
  type ActiveTag,
  type AnswerFeedFixtureItem,
  fitsKnowledgeContext,
  selectAnswerFeedItems,
} from "./answerFeedData";

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
    id: "entry-broader",
    title: "Broader Answer",
    href: "/entries/entry-broader",
  },
};

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
});

describe("AnswerFeed", () => {
  test("renders mixed Answer and Knowledge Slot cards", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed
        activeTags={[romansTag, holySpiritTag]}
        items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
      />,
    );

    expect(markup).toContain("Answer Feed");
    expect(markup).toContain("2 Answers");
    expect(markup).toContain("1 Knowledge Slots");
    expect(markup).toContain('data-feed-kind="answer"');
    expect(markup).toContain('data-feed-kind="slot"');
    expect(markup).toContain("Higher Weight Answer");
    expect(markup).toContain("Human Weight");
    expect(markup).toContain("Requested future Answer");
    expect(markup).toContain("Knowledge Slot");
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

  test("renders no-match empty states for Answers and Slots", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed activeTags={[missingTag]} items={[lowerWeightAnswer, matchingSlot]} />,
    );

    expect(markup).toContain("No Answers match this Knowledge Context yet.");
    expect(markup).toContain("Contribute the missing future Answer from here.");
    expect(markup).toContain("No Knowledge Slots are open in this Knowledge Context.");
    expect(markup).toContain("Create a Knowledge Slot when a future Answer should be requested.");
  });

  test("renders slot-only state with the Slot still discoverable in the feed", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed activeTags={[romansTag, holySpiritTag]} items={[matchingSlot]} />,
    );

    expect(markup).toContain("0 Answers");
    expect(markup).toContain("1 Knowledge Slots");
    expect(markup).toContain("No Answers match this Knowledge Context yet.");
    expect(markup).toContain("Requested future Answer");
    expect(markup).toContain('data-feed-kind="slot"');
  });
});
