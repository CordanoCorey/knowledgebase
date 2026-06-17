import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  ContributionEditor,
  createContributionPreview,
  createContributionInput,
  resolveContributionMode,
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
    expect(markup).toContain("Post Lesson");
    expect(markup).toContain('href="/scripture/romans-8-28"');
    expect(markup).toContain('href="/goto/holy-spirit"');
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

  test("Smart Storage proposed type does not drive direct preview type", () => {
    expect(
      resolveContributionKnowledgeType({
        smartStorageProposedKnowledgeType: "quote",
      }),
    ).toBe("words");
  });

  test("global context defaults to Smart Storage mode", () => {
    expect(resolveContributionMode({ context: [] })).toBe("smartStorage");

    const preview = createContributionPreview({
      body: "An unclassified source that may become something richer.",
      context: [],
      knowledgeType: "words",
      title: "Raw contribution",
    });

    expect(preview).toMatchObject({
      knowledgeType: "words",
      mode: "smartStorage",
      submitLabel: "Store Smartly",
    });
    expect(preview.attributes).toContainEqual({
      label: "Knowledge Context",
      value: "Global Knowledge Context",
    });
  });

  test("tagged contexts default to direct posting mode", () => {
    expect(resolveContributionMode({ context: [romansTag] })).toBe("direct");

    const preview = createContributionPreview({
      body: "Comfort in suffering belongs here.",
      context: [romansTag, holySpiritTag],
      knowledgeType: "words",
      title: "Hope in suffering",
    });

    expect(preview).toMatchObject({
      context: [romansTag, holySpiritTag],
      mode: "direct",
      submitLabel: "Post Words",
    });
    expect(preview.attributes).toContainEqual({
      label: "Knowledge Context",
      value: "Romans 8:28, Holy Spirit",
    });
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
    expect(markup).not.toContain('value="rsvp"');
  });

  test("global editor renders Smart Storage primary and direct secondary actions", () => {
    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[]}
        onSubmitSource={() => ({ status: "submitted" })}
      />,
    );

    expect(markup).toContain("Contribution Preview");
    expect(markup).toContain("Store Smartly");
    expect(markup).toContain("Post Words");
    expect(markup).toContain("Global Knowledge Context");
  });

  test("renders the primary input before contribution preview metadata", () => {
    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[]}
        onSubmitSource={() => ({ status: "submitted" })}
      />,
    );

    const formIndex = markup.indexOf('class="kb-contribution-form"');
    const primaryInputIndex = markup.indexOf(
      'class="kb-contribution-field kb-contribution-body-field kb-contribution-primary-field"',
    );
    const previewIndex = markup.indexOf('class="kb-contribution-preview"');

    expect(formIndex).toBeGreaterThan(-1);
    expect(primaryInputIndex).toBeGreaterThan(formIndex);
    expect(primaryInputIndex).toBeLessThan(markup.indexOf(">Knowledge Type<"));
    expect(previewIndex).toBeGreaterThan(primaryInputIndex);
    expect(markup.indexOf("<textarea")).toBeLessThan(
      markup.indexOf("Contribution Preview"),
    );
  });

  test("comment editor is titleless and keeps body as visible substance", () => {
    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[romansTag]}
        onSubmitSource={() => ({ status: "submitted" })}
        parentEntryTitle="Trial by Fire"
        selectedKnowledgeType="comment"
      />,
    );

    expect(markup).toContain("Post Comment");
    expect(markup).toContain(">Comment<");
    expect(markup).not.toContain(">Title<");
    expect(markup).not.toContain('type="text"');
    expect(markup).toMatch(/<textarea[^>]*required/);

    const preview = createContributionPreview({
      body: "This is the comment body.",
      context: [romansTag],
      knowledgeType: "comment",
      parentEntryTitle: "Trial by Fire",
    });

    expect(preview.attributes).not.toContainEqual({
      label: "Title",
      value: "Comment on Trial by Fire",
    });
    expect(preview.attributes).toContainEqual({
      label: "Preview",
      value: "This is the comment body.",
    });
  });

  test("question editor uses question text as identity and allows optional details", () => {
    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[romansTag]}
        onSubmitSource={() => ({ status: "submitted" })}
        selectedKnowledgeType="question"
      />,
    );

    expect(markup).toContain(">Question<");
    expect(markup).toContain(">Details<");
    expect(markup).toMatch(/<input[^>]*required/);
    expect(markup).not.toMatch(/<textarea[^>]*required/);

    const preview = createContributionPreview({
      body: "I need this for seventh grade Bible class.",
      context: [romansTag],
      knowledgeType: "question",
      title: "How does Romans 8 comfort grieving families?",
    });

    expect(preview.attributes).toContainEqual({
      label: "Question",
      value: "How does Romans 8 comfort grieving families?",
    });
    expect(preview.attributes).toContainEqual({
      label: "Details",
      value: "I need this for seventh grade Bible class.",
    });
    expect(preview.attributes).not.toContainEqual({
      label: "Title",
      value: "How does Romans 8 comfort grieving families?",
    });
  });

  test("world-modeling types remain available after content-oriented types", () => {
    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[]}
        onSubmitSource={() => ({ status: "submitted" })}
      />,
    );

    expect(markup).not.toContain('value="rsvp"');
    expect(markup).toContain('value="person"');
    expect(markup).toContain('value="organization"');
    expect(markup).toContain('value="group"');
    expect(markup).toContain('value="place"');
    expect(markup.indexOf('value="event"')).toBeLessThan(
      markup.indexOf('value="person"'),
    );
  });

  test("guided Group creation asks only for the Group name in direct mode", () => {
    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[romansTag]}
        guidedContributionType="group"
        onSubmitSource={() => ({ status: "submitted" })}
        selectedKnowledgeType="group"
      />,
    );

    expect(markup).toContain("Direct Post");
    expect(markup).toContain("What is the group called?");
    expect(markup).toContain("Create Group");
    expect(markup).not.toContain("Store Smartly");
    expect(markup).not.toContain("<textarea");

    const preview = createContributionPreview({
      body: "This stale body should not be previewed.",
      context: [romansTag],
      guidedContributionType: "group",
      knowledgeType: "group",
      title: "Basketball Club",
    });

    expect(preview).toMatchObject({
      knowledgeType: "group",
      mode: "direct",
      submitLabel: "Create Group",
    });
    expect(preview.attributes).toContainEqual({
      label: "Group",
      value: "Basketball Club",
    });
    expect(preview.attributes).not.toContainEqual({
      label: "Preview",
      value: "This stale body should not be previewed.",
    });
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

  test("comment payload generates a title from parent context without using body text", () => {
    const input = createContributionInput({
      body: "This body should not become the title.",
      context: [romansTag],
      knowledgeType: "comment",
      parentEntryTitle: "Trial by Fire",
    });

    expect(input).toMatchObject({
      body: "This body should not become the title.",
      knowledgeType: "comment",
      title: "Comment on Trial by Fire",
    });

    const fallbackInput = createContributionInput({
      body: "Also not the title.",
      context: [romansTag],
      knowledgeType: "comment",
    });

    expect(fallbackInput.title).toBe("Comment");
  });

  test("question payload uses question text as title and optional details as body", () => {
    const input = createContributionInput({
      body: "",
      context: [romansTag],
      knowledgeType: "question",
      title: "How does Romans 8 comfort grieving families?",
    });

    expect(input).toMatchObject({
      body: "",
      knowledgeType: "question",
      title: "How does Romans 8 comfort grieving families?",
    });
  });

  test("guided Group payload uses the Group name as title and keeps context Tags", () => {
    const input = createContributionInput({
      body: "This field is not part of guided Group creation.",
      context: [romansTag, holySpiritTag],
      guidedContributionType: "group",
      knowledgeType: "group",
      title: "Basketball Club",
    });

    expect(input).toMatchObject({
      body: "",
      knowledgeType: "group",
      title: "Basketball Club",
    });
    expect(input.contextTags).toEqual([romansTag, holySpiritTag]);
  });
});
