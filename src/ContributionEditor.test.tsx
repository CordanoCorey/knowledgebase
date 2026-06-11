import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  ContributionEditor,
  createContributionInput,
  resolveContributionKnowledgeType,
} from "./ContributionEditor";
import type {
  ActiveTag,
  KnowledgeSlotSummary,
} from "./knowledgeContracts";

const romansTag: ActiveTag = {
  canonicalKey: "romans-8-28",
  href: "/scripture/romans-8-28",
  id: "romans-8-28",
  knowledgeType: "biblePassage",
  label: "Romans 8:28",
};

const holySpiritTag: ActiveTag = {
  canonicalKey: "holy-spirit",
  href: "/goto/holy-spirit",
  id: "holy-spirit",
  knowledgeType: "topic",
  label: "Holy Spirit",
};

const lessonSlot: KnowledgeSlotSummary = {
  contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
  href: "/slots/slot-romans-8-spirit-lesson",
  id: "slot-romans-8-spirit-lesson",
  requestedKnowledgeType: "lesson",
  status: "open",
  targetLabel: "Open to My Church",
  title: "Lesson on Romans 8 and the Holy Spirit",
};

describe("Contribution Editor type resolution", () => {
  test("defaults to words", () => {
    expect(resolveContributionKnowledgeType({})).toBe("words");
  });

  test("Slot requested type wins and is fixed in the editor", () => {
    expect(
      resolveContributionKnowledgeType({
        selectedKnowledgeType: "essay",
        slot: lessonSlot,
        smartStorageProposedKnowledgeType: "quote",
      }),
    ).toBe("lesson");

    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[romansTag, holySpiritTag]}
        onSubmitSource={() => ({ status: "submitted" })}
        selectedKnowledgeType="essay"
        slot={lessonSlot}
        smartStorageProposedKnowledgeType="quote"
      />,
    );

    expect(markup).toContain("Lesson on Romans 8 and the Holy Spirit");
    expect(markup).toContain("Submit Lesson");
    expect(markup).toContain("disabled");
  });

  test("user-selected type wins when no Slot type exists", () => {
    expect(
      resolveContributionKnowledgeType({
        selectedKnowledgeType: "essay",
        smartStorageProposedKnowledgeType: "quote",
      }),
    ).toBe("essay");
  });

  test("Smart Storage proposed type wins when no Slot or user-selected type exists", () => {
    expect(
      resolveContributionKnowledgeType({
        smartStorageProposedKnowledgeType: "quote",
      }),
    ).toBe("quote");
  });

  test("biblePassage is unavailable as a contribution type", () => {
    expect(
      resolveContributionKnowledgeType({
        selectedKnowledgeType: "biblePassage",
        smartStorageProposedKnowledgeType: "biblePassage",
      }),
    ).toBe("words");

    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[]}
        onSubmitSource={() => ({ status: "submitted" })}
      />,
    );

    expect(markup).not.toContain('value="biblePassage"');
  });
});

describe("Contribution Editor payload", () => {
  test("submitted payload includes context Tags and active Knowledge Type", () => {
    const input = createContributionInput({
      body: "A youth-ready lesson on comfort in suffering.",
      context: [romansTag, holySpiritTag],
      knowledgeType: "lesson",
      slot: lessonSlot,
      title: "Hope in the Spirit",
    });

    expect(input).toMatchObject({
      body: "A youth-ready lesson on comfort in suffering.",
      knowledgeType: "lesson",
      slotId: lessonSlot.id,
      title: "Hope in the Spirit",
    });
    expect(input.contextTags).toEqual([romansTag, holySpiritTag]);
  });
});
