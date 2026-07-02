// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
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

const unscoredWeightBearingAnswer: AnswerFeedFixtureItem = {
  kind: "answer",
  contextTagIds: ["romans-8-28", "holy-spirit"],
  entry: {
    contributor: adaContributor,
    id: "entry-unscored-lesson-needing-feedback",
    title: "Older Lesson Needing Human Weight Feedback",
    knowledgeType: "lesson",
    previewText: "A weight-bearing lesson that needs Human Weight evidence.",
    primaryTagLabel: "Romans 8:28",
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    href: "/entries/entry-unscored-lesson-needing-feedback",
    updatedAt: Date.UTC(2026, 1, 1, 11),
  },
};

const matureSameWeightAnswer: AnswerFeedFixtureItem = {
  kind: "answer",
  contextTagIds: ["romans-8-28", "holy-spirit"],
  entry: {
    contributor: adaContributor,
    id: "entry-mature-same-weight",
    title: "Mature Same Weight Answer",
    knowledgeType: "lesson",
    previewText: "A same-weight answer with settled Human Weight evidence.",
    primaryTagLabel: "Romans 8:28",
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    humanWeight: 70,
    evidenceMaturity: 100,
    href: "/entries/entry-mature-same-weight",
    updatedAt: Date.UTC(2026, 1, 1, 12),
  },
};

const freshSameWeightAnswer: AnswerFeedFixtureItem = {
  kind: "answer",
  contextTagIds: ["romans-8-28", "holy-spirit"],
  entry: {
    contributor: benContributor,
    id: "entry-fresh-same-weight",
    title: "Fresh Same Weight Answer",
    knowledgeType: "lesson",
    previewText: "A newer same-weight answer without Human Weight evidence yet.",
    primaryTagLabel: "Romans 8:28",
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    humanWeight: 70,
    href: "/entries/entry-fresh-same-weight",
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

  test("prioritizes unscored weight-bearing Answers before non-weight-bearing Answers", () => {
    const feedItems = selectAnswerFeedItems(
      [
        nonWeightBearingAnswer,
        unscoredWeightBearingAnswer,
        lowerWeightAnswer,
      ],
      [romansTag, holySpiritTag],
    );

    expect(
      feedItems
        .filter((item) => item.kind === "answer")
        .map((item) => item.entry.title),
    ).toEqual([
      "Older Lesson Needing Human Weight Feedback",
      "Lower Weight Answer",
      "Newer Topic Without Human Weight",
    ]);
  });

  test("uses Evidence Maturity as a secondary Answer priority signal", () => {
    const feedItems = selectAnswerFeedItems(
      [freshSameWeightAnswer, matureSameWeightAnswer],
      [romansTag, holySpiritTag],
    );

    expect(
      feedItems
        .filter((item) => item.kind === "answer")
        .map((item) => item.entry.title),
    ).toEqual(["Mature Same Weight Answer", "Fresh Same Weight Answer"]);
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
        contextExpertiseMaturity: 20,
        contextExpertiseScore: 108,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 1,
      },
      {
        ...adaContributor,
        contextExpertiseMaturity: 20,
        contextExpertiseScore: 54,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 1,
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
    expect(markup).toContain("1 post | 1 signal");
    expect(markup).not.toContain("avg HW");
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
    expect(markup).toContain('data-knowledge-type="lesson" type="button"');
    expect(markup).toContain('<span class="kb-knowledge-type-label">Lesson</span>');
    expect(markup).toContain('data-knowledge-type="words" type="button"');
    expect(markup).toContain('<span class="kb-knowledge-type-label">Words</span>');
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

  test("renders a Context Expert audience control and reports scope changes", () => {
    container = document.createElement("div");
    document.body.append(container);
    const testContainer = container;
    root = createRoot(testContainer);
    const scopeChanges: string[] = [];
    const expert = {
      ...benContributor,
      contextExpertiseMaturity: 60,
      contextExpertiseScore: 91,
      evidenceCount: 3,
      feedbackCount: 2,
      postCount: 1,
    };

    act(() => {
      root?.render(
        <AnswerFeed
          activeTags={[romansTag, holySpiritTag]}
          contextExpertScope="orbit"
          contextExperts={[expert]}
          items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
          onContextExpertScopeChange={(scope) => scopeChanges.push(scope)}
        />,
      );
    });

    expect(getButtonByText(testContainer, "Orbit").getAttribute("aria-pressed")).toBe(
      "true",
    );

    act(() => {
      getButtonByText(testContainer, "Global").click();
    });

    expect(scopeChanges).toEqual(["global"]);
  });

  test("keeps the Context Expert audience control available for empty scopes", () => {
    const markup = renderToStaticMarkup(
      <AnswerFeed
        activeTags={[romansTag, holySpiritTag]}
        contextExpertScope="global"
        contextExperts={[]}
        items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
        onContextExpertScopeChange={() => undefined}
      />,
    );

    expect(markup).toContain("Context Expert audience");
    expect(markup).toContain("No experts in this view");
  });

  test("opens a Context Expert detail dialog with counts, contributions, and profile link", () => {
    container = document.createElement("div");
    document.body.append(container);
    const testContainer = container;
    root = createRoot(testContainer);
    const expert = {
      ...benContributor,
      href: "/profile/ben-scholar",
      contextExpertiseMaturity: 60,
      contextExpertiseScore: 91,
      evidenceCount: 3,
      feedbackCount: 2,
      postCount: 1,
    };

    act(() => {
      root?.render(
        <AnswerFeed
          activeTags={[romansTag, holySpiritTag]}
          contextExpertDetail={{
            ...expert,
            topSupportingEntries: [higherWeightAnswer.entry],
          }}
          contextExperts={[expert]}
          items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
        />,
      );
    });

    expect(testContainer.textContent).toContain("1 post | 3 signals");

    act(() => {
      getButtonByLabel(
        testContainer,
        "Open Ben Scholar Context Expert details",
      ).click();
    });

    const dialog = getDialog(testContainer);
    const statValues = Array.from(
      dialog.querySelectorAll(".kb-context-expert-stats dd"),
    ).map((stat) => stat.textContent);
    expect(dialog.textContent).toContain("Ben Scholar");
    expect(dialog.textContent).toContain("Posts in context");
    expect(dialog.textContent).toContain("Non-post signals");
    expect(statValues).toEqual(["1", "2"]);
    expect(dialog.textContent).toContain("Higher Weight Answer");
    expect(dialog.textContent).toContain("Lesson");
    expect(dialog.textContent).toContain("A higher-weight answer.");
    expect(dialog.querySelector('a[href="/profile/ben-scholar"]')?.textContent).toContain(
      "View profile",
    );
    expect(
      dialog.querySelector('a[href="/entries/entry-higher-weight"]')?.textContent,
    ).toContain("Higher Weight Answer");
  });

  test("shows Quote attribution correction controls only for admin-enabled Quote support", () => {
    container = document.createElement("div");
    document.body.append(container);
    const testContainer = container;
    root = createRoot(testContainer);
    const expert = {
      ...benContributor,
      contextExpertiseMaturity: 60,
      contextExpertiseScore: 91,
      evidenceCount: 1,
      feedbackCount: 0,
      postCount: 0,
    };
    const quoteEntry = {
      ...higherWeightAnswer.entry,
      id: "entry-quote-attribution",
      knowledgeType: "quote" as const,
      quoteAttribution: {
        quotedPersonLabel: "C. S. Lewis",
        quotedPersonReferentId: "referent-lewis",
      },
      title: "Lewis Quote",
    };

    act(() => {
      root?.render(
        <AnswerFeed
          activeTags={[romansTag, holySpiritTag]}
          contextExpertDetail={{
            ...expert,
            topSupportingEntries: [quoteEntry],
          }}
          contextExperts={[expert]}
          items={[higherWeightAnswer]}
        />,
      );
    });
    act(() => {
      getButtonByLabel(
        testContainer,
        "Open Ben Scholar Context Expert details",
      ).click();
    });

    expect(getDialog(testContainer).textContent).toContain("Lewis Quote");
    expect(getDialog(testContainer).textContent).not.toContain("Save attribution");

    act(() => {
      root?.render(
        <AnswerFeed
          activeTags={[romansTag, holySpiritTag]}
          canCorrectQuoteAttribution
          contextExpertDetail={{
            ...expert,
            topSupportingEntries: [quoteEntry],
          }}
          contextExperts={[expert]}
          items={[higherWeightAnswer]}
          onCorrectQuoteAttribution={async () => undefined}
        />,
      );
    });
    act(() => {
      getButtonByLabel(
        testContainer,
        "Open Ben Scholar Context Expert details",
      ).click();
    });

    const dialog = getDialog(testContainer);
    expect(dialog.textContent).toContain("Quoted Person");
    expect(dialog.textContent).toContain("C. S. Lewis");
    expect(dialog.textContent).toContain("referent-lewis");
    expect(dialog.textContent).toContain("Corrected Person");
    expect(dialog.textContent).toContain("Save attribution");
  });

  test("submits and clears Quote attribution corrections from the expert dialog", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const testContainer = container;
    root = createRoot(testContainer);
    const onCorrectQuoteAttribution = vi.fn(async () => undefined);
    const expert = {
      ...benContributor,
      contextExpertiseMaturity: 60,
      contextExpertiseScore: 91,
      evidenceCount: 1,
      feedbackCount: 0,
      postCount: 0,
    };
    const quoteEntry = {
      ...higherWeightAnswer.entry,
      id: "entry-quote-attribution",
      knowledgeType: "quote" as const,
      quoteAttribution: {
        quotedPersonLabel: "C. S. Lewis",
        quotedPersonReferentId: "referent-lewis",
      },
      title: "Lewis Quote",
    };
    const personOptions = [
      {
        label: "J. R. R. Tolkien",
        referentId: "referent-tolkien",
        tagId: "tag-tolkien",
        thumbnailUrl: "https://images.example/tolkien.jpg",
      },
    ];
    const onQuoteAttributionPersonSearchChange = vi.fn();

    await act(async () => {
      root?.render(
        <AnswerFeed
          activeTags={[romansTag, holySpiritTag]}
          canCorrectQuoteAttribution
          contextExpertDetail={{
            ...expert,
            topSupportingEntries: [quoteEntry],
          }}
          contextExperts={[expert]}
          items={[higherWeightAnswer]}
          onCorrectQuoteAttribution={onCorrectQuoteAttribution}
          onQuoteAttributionPersonSearchChange={
            onQuoteAttributionPersonSearchChange
          }
          quoteAttributionPersonPicker={{
            entryId: quoteEntry.id,
            isLoading: false,
            options: personOptions,
          }}
        />,
      );
    });
    await act(async () => {
      getButtonByLabel(
        testContainer,
        "Open Ben Scholar Context Expert details",
      ).click();
    });

    const input = getInputByLabel(
      testContainer,
      "Search corrected Person for Lewis Quote",
    );
    await setInputValue(input, "Tolkien");
    expect(onQuoteAttributionPersonSearchChange).toHaveBeenCalledWith({
      entry: quoteEntry,
      searchQuery: "Tolkien",
    });
    expect(
      testContainer
        .querySelector(".kb-quote-attribution-person-option img")
        ?.getAttribute("src"),
    ).toBe("https://images.example/tolkien.jpg");
    await act(async () => {
      getButtonByText(testContainer, "J. R. R. Tolkien").click();
      await Promise.resolve();
    });
    await act(async () => {
      getButtonByText(testContainer, "Save attribution").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCorrectQuoteAttribution).toHaveBeenCalledWith({
      entry: quoteEntry,
      nextQuotedPersonReferentId: "referent-tolkien",
    });
    expect(getDialog(testContainer).textContent).toContain(
      "Quote attribution updated.",
    );

    await act(async () => {
      getButtonByText(testContainer, "Clear attribution").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onCorrectQuoteAttribution).toHaveBeenLastCalledWith({
      entry: quoteEntry,
      nextQuotedPersonReferentId: null,
    });
  });

  test("shows Quote attribution validation and mutation errors", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const testContainer = container;
    root = createRoot(testContainer);
    const onCorrectQuoteAttribution = vi.fn(async () => {
      throw new Error("Nope");
    });
    const expert = {
      ...benContributor,
      contextExpertiseMaturity: 60,
      contextExpertiseScore: 91,
      evidenceCount: 1,
      feedbackCount: 0,
      postCount: 0,
    };
    const quoteEntry = {
      ...higherWeightAnswer.entry,
      id: "entry-quote-attribution",
      knowledgeType: "quote" as const,
      title: "Lewis Quote",
    };
    const personOptions = [
      {
        label: "J. R. R. Tolkien",
        referentId: "referent-tolkien",
        tagId: "tag-tolkien",
      },
    ];

    await act(async () => {
      root?.render(
        <AnswerFeed
          activeTags={[romansTag, holySpiritTag]}
          canCorrectQuoteAttribution
          contextExpertDetail={{
            ...expert,
            topSupportingEntries: [quoteEntry],
          }}
          contextExperts={[expert]}
          items={[higherWeightAnswer]}
          onCorrectQuoteAttribution={onCorrectQuoteAttribution}
          onQuoteAttributionPersonSearchChange={() => undefined}
          quoteAttributionPersonPicker={{
            entryId: quoteEntry.id,
            isLoading: false,
            options: personOptions,
          }}
        />,
      );
    });
    await act(async () => {
      getButtonByLabel(
        testContainer,
        "Open Ben Scholar Context Expert details",
      ).click();
    });

    await act(async () => {
      getButtonByText(testContainer, "Save attribution").click();
      await Promise.resolve();
    });
    expect(getDialog(testContainer).textContent).toContain(
      "Select a Person before saving attribution.",
    );

    const input = getInputByLabel(
      testContainer,
      "Search corrected Person for Lewis Quote",
    );
    await setInputValue(input, "Tolkien");
    await act(async () => {
      getButtonByText(testContainer, "J. R. R. Tolkien").click();
      await Promise.resolve();
    });
    await act(async () => {
      getButtonByText(testContainer, "Save attribution").click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getDialog(testContainer).textContent).toContain(
      "Quote attribution update failed.",
    );
  });

  test("labels inherited Context Expert post counts as broader context counts", () => {
    container = document.createElement("div");
    document.body.append(container);
    const testContainer = container;
    root = createRoot(testContainer);
    const expert = {
      ...benContributor,
      contextExpertiseMaturity: 100,
      contextExpertiseScore: 85,
      contextMatchKind: "broaderContext" as const,
      evidenceCount: 5,
      feedbackCount: 1,
      postCount: 4,
    };

    act(() => {
      root?.render(
        <AnswerFeed
          activeTags={[romansTag, holySpiritTag]}
          contextExpertDetail={{
            ...expert,
            topSupportingEntries: [broaderAnswer.entry],
          }}
          contextExperts={[expert]}
          items={[broaderAnswer]}
        />,
      );
    });

    act(() => {
      getButtonByLabel(
        testContainer,
        "Open Ben Scholar Context Expert details",
      ).click();
    });

    const dialog = getDialog(testContainer);
    expect(dialog.textContent).toContain("Posts in broader context");
    expect(dialog.textContent).not.toContain("Posts in context");
  });

  test("closes the Context Expert detail dialog from the close button and Escape", () => {
    container = document.createElement("div");
    document.body.append(container);
    const testContainer = container;
    root = createRoot(testContainer);
    const expert = {
      ...benContributor,
      contextExpertiseMaturity: 60,
      contextExpertiseScore: 91,
      evidenceCount: 3,
      feedbackCount: 2,
      postCount: 1,
    };

    act(() => {
      root?.render(
        <AnswerFeed
          activeTags={[romansTag, holySpiritTag]}
          contextExperts={[expert]}
          items={[lowerWeightAnswer, matchingSlot, higherWeightAnswer]}
        />,
      );
    });

    act(() => {
      getButtonByLabel(
        testContainer,
        "Open Ben Scholar Context Expert details",
      ).click();
    });
    expect(getDialog(testContainer).textContent).toContain("Ben Scholar");

    act(() => {
      getButtonByLabel(testContainer, "Close Context Expert details").click();
    });
    expect(testContainer.querySelector('[role="dialog"]')).toBeNull();

    act(() => {
      getButtonByLabel(
        testContainer,
        "Open Ben Scholar Context Expert details",
      ).click();
    });
    expect(getDialog(testContainer).textContent).toContain("Ben Scholar");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(testContainer.querySelector('[role="dialog"]')).toBeNull();
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

function getButtonByLabel(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );

  if (!button) {
    throw new Error(`Expected button with aria-label "${label}"`);
  }

  return button;
}

function getInputByLabel(container: HTMLElement, label: string) {
  const input = Array.from(container.querySelectorAll("input")).find(
    (candidate) => candidate.getAttribute("aria-label") === label,
  );

  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Expected input with aria-label "${label}"`);
  }

  return input;
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

function getDialog(container: HTMLElement) {
  const dialog = container.querySelector('[role="dialog"]');
  if (!dialog) {
    throw new Error("Expected dialog to be open.");
  }

  return dialog;
}
