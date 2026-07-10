// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import {
  ContributionEditor,
  createContributionInput,
  createContributionPreview,
  createRichTextDocumentJsonFromText,
  extractExternalUrlsFromText,
  resolveContributionKnowledgeType,
  resolveContributionMode,
} from "./ContributionEditor";
import type {
  ActiveTag,
  ContributionInput,
  DraftLinkPreviewResult,
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

const csLewisTag: ActiveTag = {
  canonicalKey: "cs-lewis",
  href: "/goto/cs-lewis",
  id: "cs-lewis",
  knowledgeType: "person",
  label: "C.S. Lewis",
};

const gkChestertonTag: ActiveTag = {
  canonicalKey: "gk-chesterton",
  href: "/goto/gk-chesterton",
  id: "gk-chesterton",
  knowledgeType: "person",
  label: "G.K. Chesterton",
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

describe("Contribution Editor type and mode resolution", () => {
  test("defaults to Words", () => {
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
    expect(markup).toContain("Lesson");
    expect(markup).toContain("Smart Storage");
    expect(markup).toContain("Store");
    expect(markup).not.toContain("<select");
    expect(markup).toContain('href="/scripture/romans-8-28"');
    expect(markup).toContain('href="/goto/holy-spirit"');
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

  test("Question inference is live only outside Comment defaults and allowed types", () => {
    expect(
      resolveContributionKnowledgeType({
        body: "How should we read Romans 8?",
      }),
    ).toBe("question");

    expect(
      resolveContributionKnowledgeType({
        body: "How should we read Romans 8?",
        parentEntryTitle: "Trial by Fire",
      }),
    ).toBe("comment");

    expect(
      resolveContributionKnowledgeType({
        allowedContributionTypes: ["words"],
        body: "How should we read Romans 8?",
      }),
    ).toBe("words");
  });

  test("Allowed Contribution Types constrain the editor", () => {
    expect(
      resolveContributionKnowledgeType({
        allowedContributionTypes: ["lesson"],
        body: "How should we read Romans 8?",
      }),
    ).toBe("lesson");

    const markup = renderToStaticMarkup(
      <ContributionEditor
        allowedContributionTypes={["lesson"]}
        context={[romansTag]}
        onSubmitSource={() => ({ status: "submitted" })}
      />,
    );

    expect(markup).toContain("Lesson");
    expect(markup).not.toContain("<select");
  });

  test("emphasizes representative thumbnails except for Words and Comments", () => {
    const lessonMarkup = renderToStaticMarkup(
      <ContributionEditor
        allowedContributionTypes={["lesson"]}
        context={[romansTag]}
        onSubmitSource={() => ({ status: "submitted" })}
      />,
    );
    expect(lessonMarkup).toContain("Representative thumbnail");
    expect(lessonMarkup).toContain("Upload representative thumbnail");

    const wordsMarkup = renderToStaticMarkup(
      <ContributionEditor
        allowedContributionTypes={["words"]}
        context={[romansTag]}
        onSubmitSource={() => ({ status: "submitted" })}
      />,
    );
    expect(wordsMarkup).not.toContain("Representative thumbnail");

    const commentMarkup = renderToStaticMarkup(
      <ContributionEditor
        context={[romansTag]}
        onSubmitSource={() => ({ status: "submitted" })}
        parentEntryTitle="Courage in Joshua"
      />,
    );
    expect(commentMarkup).not.toContain("Representative thumbnail");
  });

  test("Bible Passage and RSVP are unavailable as generic contribution types", () => {
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

  test("root context defaults to Smart Storage while tagged Words defaults direct", () => {
    expect(resolveContributionMode({ context: [] })).toBe("smartStorage");
    expect(
      resolveContributionMode({
        context: [romansTag],
        knowledgeType: "words",
      }),
    ).toBe("direct");

    const rootPreview = createContributionPreview({
      body: "An unclassified source that may become something richer.",
      context: [],
      knowledgeType: "words",
      title: "",
    });
    expect(rootPreview).toMatchObject({
      knowledgeType: "words",
      mode: "smartStorage",
      submitLabel: "Store",
    });

    const taggedPreview = createContributionPreview({
      body: "Comfort in suffering belongs here.",
      context: [romansTag, holySpiritTag],
      knowledgeType: "words",
      title: "",
    });
    expect(taggedPreview).toMatchObject({
      context: [romansTag, holySpiritTag],
      mode: "direct",
      submitLabel: "Post",
    });
  });

  test("staged attachments keep direct posting available while richer types and explicit Words titles force Smart Storage", () => {
    expect(
      resolveContributionMode({
        context: [romansTag],
        hasSupplementalSources: true,
        knowledgeType: "words",
      }),
    ).toBe("direct");

    expect(
      resolveContributionMode({
        context: [romansTag],
        knowledgeType: "lesson",
      }),
    ).toBe("smartStorage");

    expect(
      resolveContributionMode({
        context: [romansTag],
        hasExplicitWordsTitle: true,
        knowledgeType: "words",
      }),
    ).toBe("smartStorage");
  });

  test("quote preview shows a quoted Person when context has exactly one Person Tag", () => {
    const preview = createContributionPreview({
      body: "Courage is every virtue at the testing point.",
      context: [romansTag, csLewisTag],
      knowledgeType: "quote",
      title: "Courage at the testing point",
    });

    expect(preview.attributes).toContainEqual({
      label: "Quoted Person",
      value: "C.S. Lewis",
    });

    const noPersonPreview = createContributionPreview({
      body: "A quote without an attributed person in context.",
      context: [romansTag, holySpiritTag],
      knowledgeType: "quote",
      title: "Unattributed quote",
    });
    expect(noPersonPreview.attributes).not.toContainEqual(
      expect.objectContaining({ label: "Quoted Person" }),
    );

    const ambiguousPersonPreview = createContributionPreview({
      body: "A quote in an ambiguous person context.",
      context: [csLewisTag, gkChestertonTag],
      knowledgeType: "quote",
      title: "Ambiguous quote",
    });
    expect(ambiguousPersonPreview.attributes).not.toContainEqual(
      expect.objectContaining({ label: "Quoted Person" }),
    );
  });
});

describe("Contribution Editor rendering", () => {
  test("root editor keeps slim controls and removes bulky expanded panels", () => {
    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[]}
        initialBody="A scanned program and https://example.com/chapel should stay attached."
        onSubmitSource={() => ({ status: "submitted" })}
      />,
    );

    expect(markup).not.toContain("Contribution Preview");
    expect(markup).not.toContain("Contribution Note");
    expect(markup).not.toContain("External URL");
    expect(markup).not.toContain("Source Inventory");
    expect(markup).not.toContain("No Sources staged");
    expect(markup).toContain("Attach file");
    expect(markup).toContain("Link preview pending");
    expect(markup).toContain("https://example.com/chapel");
    expect(markup).toContain("Store");
    expect(markup).toContain("All Accessible Knowledge");
  });

  test("plain Words keeps a compact direct or Smart Storage choice", () => {
    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[romansTag]}
        initialBody="A plain answer without extra Sources."
        onSubmitSource={() => ({ status: "submitted" })}
      />,
    );

    expect(markup).toContain("Post");
    expect(markup).toContain("Store");
  });

  test("renders the primary input before compact metadata", () => {
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
    const metadataIndex = markup.indexOf('class="kb-contribution-metadata-row"');

    expect(formIndex).toBeGreaterThan(-1);
    expect(primaryInputIndex).toBeGreaterThan(formIndex);
    expect(metadataIndex).toBeGreaterThan(primaryInputIndex);
    expect(markup.indexOf('class="kb-contribution-rich-text"')).toBeLessThan(
      metadataIndex,
    );
  });

  test("Comment editor is titleless and keeps body as visible substance", () => {
    const markup = renderToStaticMarkup(
      <ContributionEditor
        context={[romansTag]}
        onSubmitSource={() => ({ status: "submitted" })}
        parentEntryTitle="Trial by Fire"
        selectedKnowledgeType="comment"
      />,
    );

    expect(markup).toContain("Comment");
    expect(markup).not.toContain(">Title<");
    expect(markup).not.toContain("Add title");
    expect(markup).not.toContain('type="text"');
    expect(markup).toContain('class="kb-contribution-rich-text"');
    expect(markup).toContain('aria-required="true"');
  });

  test("Words is titleless by default but can reveal an optional Title", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            onSubmitSource={() => ({ status: "submitted" })}
          />,
        );
      });

      expect(container.querySelector('input[type="text"]')).toBeNull();
      await click(getButton(container, "Add title"));

      const input = container.querySelector('input[type="text"]');
      expect(input).toBeInstanceOf(HTMLInputElement);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  test("Question editor uses question text as identity and optional details as body", () => {
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
    expect(markup).toContain('aria-required="false"');
    expect(markup).toContain("Smart Storage");
  });

  test("title-bearing Knowledge Types still show a required Title field", () => {
    const markup = renderToStaticMarkup(
      <ContributionEditor
        allowedContributionTypes={["lesson"]}
        context={[romansTag]}
        onSubmitSource={() => ({ status: "submitted" })}
        selectedKnowledgeType="lesson"
      />,
    );

    expect(markup).toContain('data-knowledge-type="lesson"');
    expect(markup).toContain(">Title<");
    expect(markup).toContain('placeholder="Lesson title"');
    expect(markup).toMatch(/<input[^>]*required/);
    expect(markup).toContain("Smart Storage");
  });

  test("Announcement editor requires an Organization target and posts directly", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let submittedInput: ContributionInput | undefined;

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            allowedContributionTypes={["announcement"]}
            context={[romansTag]}
            onPostDirect={(input) => {
              submittedInput = input;
              return { status: "submitted" };
            }}
            onStoreSmartly={() => {
              throw new Error("Smart Storage should not be used.");
            }}
            organizationOptions={[
              {
                name: "Arche Classical Academy",
                organizationReferentId: "org-arche",
              },
              {
                name: "Veritas School",
                organizationReferentId: "org-veritas",
              },
            ]}
            selectedKnowledgeType="announcement"
          />,
        );
      });

      const editor = getContributionEditor(container);
      expect(editor.textContent).toContain("Organization");
      expect(editor.textContent).toContain("Post Announcement");
      expect(editor.textContent).not.toContain("Store");

      await setInputValue(getTextInput(editor), "Chapel location change");
      await setTextareaValue(
        getTextarea(editor),
        "Chapel moves to the north hall at 10:15 tomorrow.",
      );
      await setSelectValue(getSelect(editor, "Announcement Organization"), "org-veritas");
      await click(getButton(editor, "Post Announcement"));

      expect(submittedInput).toMatchObject({
        body: "Chapel moves to the north hall at 10:15 tomorrow.",
        contextTags: [romansTag],
        knowledgeType: "announcement",
        organizationReferentId: "org-veritas",
        title: "Chapel location change",
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
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

    expect(markup).toContain("What is the group called?");
    expect(markup).toContain("Create Group");
    expect(markup).not.toContain("Store");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("Attach file");
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

  test("focus expands the editor until the user collapses it", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            onSubmitSource={() => ({ status: "submitted" })}
          />,
        );
      });

      const editor = getContributionEditor(container);
      const textarea = getTextarea(editor);

      expect(editor.getAttribute("data-expanded")).toBe("false");

      await act(async () => {
        textarea.focus();
        await Promise.resolve();
      });

      expect(editor.getAttribute("data-expanded")).toBe("true");

      await act(async () => {
        textarea.blur();
        await Promise.resolve();
      });

      expect(editor.getAttribute("data-expanded")).toBe("true");

      await click(getButton(editor, "Collapse contribution editor"));

      expect(editor.getAttribute("data-expanded")).toBe("false");
      expect(
        editor.querySelector('button[aria-label="Collapse contribution editor"]'),
      ).toBeNull();
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});

describe("Contribution Editor payload and sources", () => {
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

  test("direct Words payload receives a quiet title from the body preview", () => {
    const input = createContributionInput({
      body: "Raw chapel notes\nSecond line should stay in the body.",
      context: [],
      knowledgeType: "words",
    });

    expect(input).toMatchObject({
      body: "Raw chapel notes\nSecond line should stay in the body.",
      knowledgeType: "words",
      title: "Raw chapel notes",
    });
  });

  test("announcement payload carries its Organization target and preview attribute", () => {
    const organization = {
      name: "Arche Classical Academy",
      organizationReferentId: "org-arche",
    };
    const input = createContributionInput({
      announcementOrganization: organization,
      body: "Chapel moves to the north hall at 10:15 tomorrow.",
      context: [romansTag],
      knowledgeType: "announcement",
      title: "Chapel location change",
    });
    const preview = createContributionPreview({
      announcementOrganization: organization,
      body: "Chapel moves to the north hall at 10:15 tomorrow.",
      context: [romansTag],
      knowledgeType: "announcement",
      title: "Chapel location change",
    });

    expect(input).toMatchObject({
      body: "Chapel moves to the north hall at 10:15 tomorrow.",
      contextTags: [romansTag],
      knowledgeType: "announcement",
      organizationReferentId: "org-arche",
      title: "Chapel location change",
    });
    expect(preview).toMatchObject({
      mode: "direct",
      submitLabel: "Post Announcement",
    });
    expect(preview.attributes).toContainEqual({
      label: "Organization",
      value: "Arche Classical Academy",
    });
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

  test("payload still supports externally provided notes, URLs, and uploaded files", () => {
    const externalUrls = [
      {
        title: "School handbook",
        url: "https://example.com/handbook",
      },
    ];
    const uploadedFiles = [
      {
        contentType: "application/pdf",
        fileName: "chapel-program.pdf",
        fileSizeBytes: 2048,
        storageId: "storage-chapel-program",
        temporaryUploadId: "temporary-upload-chapel-program",
      },
    ];
    const input = createContributionInput({
      body: "Chapel notes from Friday.",
      contributionNote: "  Keep the program as supporting material.  ",
      context: [],
      externalUrls,
      knowledgeType: "words",
      title: "Friday chapel",
      uploadedFiles,
    });

    expect(input).toMatchObject({
      body: "Chapel notes from Friday.",
      contributionNote: "Keep the program as supporting material.",
      externalUrls,
      knowledgeType: "words",
      title: "Friday chapel",
      uploadedFiles,
    });
  });

  test("extracts one external URL Attachment per unique normalized URL", () => {
    expect(
      extractExternalUrlsFromText(
        "Read https://example.com/chapel, then https://example.com/chapel.",
      ),
    ).toEqual([{ url: "https://example.com/chapel" }]);
  });

  test("auto-detected URL Attachments stay available for direct posting", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let submittedInput: ContributionInput | undefined;

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            onPostDirect={(input) => {
              submittedInput = input;
              return { status: "submitted" };
            }}
            onStoreSmartly={() => {
              throw new Error("Smart Storage should not be used.");
            }}
          />,
        );
      });

      const editor = getContributionEditor(container);
      await setTextareaValue(
        getTextarea(editor),
        "Raw chapel notes\nSee https://example.com/chapel and https://example.com/chapel.",
      );

      expect(editor.textContent).toContain("Link preview pending");
      expect(editor.querySelectorAll(".kb-contribution-source-chips li")).toHaveLength(1);

      await click(getButton(editor, "Post"));

      expect(submittedInput).toMatchObject({
        body:
          "Raw chapel notes\nSee https://example.com/chapel and https://example.com/chapel.",
        externalUrls: [{ url: "https://example.com/chapel" }],
        knowledgeType: "words",
        title: "Raw chapel notes",
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  test("detected URL chips enrich from draft Link Preview metadata", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const deferred = createDeferred<DraftLinkPreviewResult>();
    const previewExternalUrl = vi.fn(() => deferred.promise);

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            onPreviewExternalUrl={previewExternalUrl}
            onSubmitSource={() => ({ status: "submitted" })}
          />,
        );
      });

      const editor = getContributionEditor(container);
      await setTextareaValue(
        getTextarea(editor),
        "Read https://example.com/chapel for the program.",
      );

      expect(editor.textContent).toContain("Link preview pending");
      expect(previewExternalUrl).toHaveBeenCalledTimes(1);

      await act(async () => {
        deferred.resolve({
          description: "Friday chapel program.",
          imageUrl: "https://example.com/chapel.png",
          siteName: "Example Chapel",
          status: "fetched",
          title: "Chapel Program",
          url: "https://example.com/chapel",
        });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(editor.textContent).toContain("Chapel Program");
      expect(editor.textContent).toContain("Example Chapel");
      expect(editor.textContent).toContain("Friday chapel program.");
      expect(getTextarea(editor).value).toBe(
        "Read https://example.com/chapel for the program.",
      );
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  test("duplicate detected URLs request one draft preview and render one chip", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const previewExternalUrl = vi.fn(async (url: string) => ({
      siteName: "Example Chapel",
      status: "fetched" as const,
      title: "Chapel Program",
      url,
    }));

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            onPreviewExternalUrl={previewExternalUrl}
            onSubmitSource={() => ({ status: "submitted" })}
          />,
        );
      });

      const editor = getContributionEditor(container);
      await setTextareaValue(
        getTextarea(editor),
        "See https://example.com/chapel and https://example.com/chapel.",
      );
      await flushAsyncWork();

      expect(previewExternalUrl).toHaveBeenCalledTimes(1);
      expect(editor.querySelectorAll(".kb-contribution-source-chips li")).toHaveLength(1);
      expect(editor.textContent).toContain("Chapel Program");
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  test("removing a URL before draft preview resolves ignores the stale result", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const deferred = createDeferred<DraftLinkPreviewResult>();

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            onPreviewExternalUrl={() => deferred.promise}
            onSubmitSource={() => ({ status: "submitted" })}
          />,
        );
      });

      const editor = getContributionEditor(container);
      const textarea = getTextarea(editor);
      await setTextareaValue(textarea, "See https://example.com/chapel.");
      expect(editor.querySelectorAll(".kb-contribution-source-chips li")).toHaveLength(1);

      await click(getButton(editor, "Remove external URL Attachment 1"));
      expect(editor.querySelectorAll(".kb-contribution-source-chips li")).toHaveLength(0);

      await act(async () => {
        deferred.resolve({
          siteName: "Example Chapel",
          status: "fetched",
          title: "Chapel Program",
          url: "https://example.com/chapel",
        });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(editor.querySelectorAll(".kb-contribution-source-chips li")).toHaveLength(0);
      expect(editor.textContent).not.toContain("Chapel Program");
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  test("failed draft preview is non-blocking and submits only the URL", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let submittedInput: ContributionInput | undefined;

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            onPreviewExternalUrl={async (url) => ({
              error: "Link Preview response is not HTML.",
              status: "failed",
              url,
            })}
            onStoreSmartly={(input) => {
              submittedInput = input;
              return { status: "submitted" };
            }}
          />,
        );
      });

      const editor = getContributionEditor(container);
      await setTextareaValue(
        getTextarea(editor),
        "Raw chapel notes\nSee https://example.com/chapel.",
      );
      await flushAsyncWork();

      expect(editor.textContent).toContain("Link preview unavailable");
      await click(getButton(editor, "Store"));

      expect(submittedInput).toMatchObject({
        externalUrls: [{ url: "https://example.com/chapel" }],
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  test("fetched draft preview metadata is included in submitted external URLs", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let submittedInput: ContributionInput | undefined;

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            onPreviewExternalUrl={async (url) => ({
              description: "Friday chapel program.",
              imageUrl: "https://example.com/chapel.png",
              siteName: "Example Chapel",
              status: "fetched",
              title: "Chapel Program",
              url,
            })}
            onStoreSmartly={(input) => {
              submittedInput = input;
              return { status: "submitted" };
            }}
          />,
        );
      });

      const editor = getContributionEditor(container);
      await setTextareaValue(
        getTextarea(editor),
        "Raw chapel notes\nSee https://example.com/chapel.",
      );
      await flushAsyncWork();
      await click(getButton(editor, "Store"));

      expect(submittedInput).toMatchObject({
        externalUrls: [
          {
            linkPreviewDescription: "Friday chapel program.",
            linkPreviewImageUrl: "https://example.com/chapel.png",
            linkPreviewSiteName: "Example Chapel",
            linkPreviewTitle: "Chapel Program",
            url: "https://example.com/chapel",
          },
        ],
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  test("removing a derived URL Attachment edits the body and removes the chip", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            onSubmitSource={() => ({ status: "submitted" })}
          />,
        );
      });

      const editor = getContributionEditor(container);
      const textarea = getTextarea(editor);
      await setTextareaValue(textarea, "See https://example.com/chapel for the program.");

      expect(editor.querySelectorAll(".kb-contribution-source-chips li")).toHaveLength(1);
      await click(getButton(editor, "Remove external URL Attachment 1"));

      expect(editor.querySelectorAll(".kb-contribution-source-chips li")).toHaveLength(0);
      expect(textarea.value).toBe("See  for the program.");
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  test("file selection stages uploaded file Attachments for direct posting", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const uploadedFile = new File(["chapel"], "chapel-program.pdf", {
      type: "application/pdf",
    });
    let submittedInput: ContributionInput | undefined;

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            onPostDirect={(input) => {
              submittedInput = input;
              return { status: "submitted" };
            }}
            onStoreSmartly={() => {
              throw new Error("Smart Storage should not be used.");
            }}
            onUploadFile={async (file) => ({
              contentType: file.type,
              fileName: file.name,
              fileSizeBytes: file.size,
              storageId: "storage-chapel-program",
              temporaryUploadId: "temporary-upload-chapel-program",
            })}
          />,
        );
      });

      const editor = getContributionEditor(container);
      await setTextareaValue(getTextarea(editor), "Raw chapel notes");
      await setFileInputFiles(getFileInput(editor), [uploadedFile]);

      expect(editor.textContent).toContain("chapel-program.pdf");
      await click(getButton(editor, "Post"));

      expect(submittedInput).toMatchObject({
        body: "Raw chapel notes",
        knowledgeType: "words",
        title: "Raw chapel notes",
        uploadedFiles: [
          expect.objectContaining({
            fileName: "chapel-program.pdf",
            storageId: "storage-chapel-program",
            temporaryUploadId: "temporary-upload-chapel-program",
          }),
        ],
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  test("autosaves rich text drafts after the draft key has loaded", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onDraftChange = vi.fn();
    const onClearDraft = vi.fn();

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            draft={null}
            draftKey="contribution-editor|romans"
            onClearDraft={onClearDraft}
            onDraftChange={onDraftChange}
            onSubmitSource={() => ({ status: "submitted" })}
          />,
        );
      });

      await setTextareaValue(
        getTextarea(container),
        "Draft notes with https://example.com/chapel.",
      );
      await act(async () => {
        vi.advanceTimersByTime(700);
        await Promise.resolve();
      });

      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyPlainText: "Draft notes with https://example.com/chapel.",
          title: "",
        }),
      );
      expect(
        JSON.parse(onDraftChange.mock.calls[0][0].bodyDocumentJson),
      ).toMatchObject({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Draft notes with https://example.com/chapel." }],
          },
        ],
      });
      expect(onClearDraft).not.toHaveBeenCalled();
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      vi.useRealTimers();
    }
  });

  test("restores a loaded draft and derives URL Attachments from the restored body", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const draftBody = "Restored notes from https://example.com/chapel.";

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            draft={undefined}
            draftKey="contribution-editor|romans"
            onSubmitSource={() => ({ status: "submitted" })}
          />,
        );
      });

      expect(getTextarea(container).value).toBe("");

      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            draft={{
              bodyDocumentJson: createRichTextDocumentJsonFromText(draftBody),
              bodyPlainText: draftBody,
              selectedKnowledgeType: "words",
              title: "",
            }}
            draftKey="contribution-editor|romans"
            onSubmitSource={() => ({ status: "submitted" })}
          />,
        );
        await Promise.resolve();
      });

      expect(getTextarea(container).value).toBe(draftBody);
      expect(container.textContent).toContain("Link preview pending");
      expect(container.querySelectorAll(".kb-contribution-source-chips li")).toHaveLength(1);
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });

  test("clears the active draft after successful direct submission", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClearDraft = vi.fn();

    try {
      await act(async () => {
        root.render(
          <ContributionEditor
            context={[romansTag]}
            draft={null}
            draftKey="contribution-editor|romans"
            onClearDraft={onClearDraft}
            onPostDirect={() => ({ status: "submitted" })}
          />,
        );
      });

      await setTextareaValue(getTextarea(container), "Ready to post.");
      await click(getButton(container, "Post"));

      expect(onClearDraft).toHaveBeenCalledTimes(1);
      expect(getTextarea(container).value).toBe("");
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
});

function getContributionEditor(container: Element) {
  const editor = container.querySelector(".kb-contribution-editor");
  if (!(editor instanceof HTMLElement)) {
    throw new Error("Missing Contribution Editor");
  }

  return editor;
}

function getTextarea(container: Element) {
  const textarea = container.querySelector("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error("Missing textarea");
  }

  return textarea;
}

function getFileInput(container: Element) {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Missing file input");
  }

  return input;
}

function getTextInput(container: Element) {
  const input = container.querySelector('input[type="text"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Missing text input");
  }

  return input;
}

function getSelect(container: Element, label: string) {
  const select = Array.from(container.querySelectorAll("select")).find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error(`Missing select: ${label}`);
  }

  return select;
}

function getButton(container: Element, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) =>
      candidate.textContent?.trim() === label ||
      candidate.getAttribute("aria-label") === label,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${label}`);
  }

  return button;
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
  });
}

async function setInputValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
  });
}

async function setSelectValue(select: HTMLSelectElement, value: string) {
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

async function setFileInputFiles(input: HTMLInputElement, files: File[]) {
  await act(async () => {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: files,
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
