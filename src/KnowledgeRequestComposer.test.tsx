// @vitest-environment happy-dom

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import { KnowledgeNavigatorQueryInput } from "./KnowledgeRequestComposer";
import {
  applyKnowledgeRequestProposal,
  getKnowledgeNavigatorQuerySuggestions,
  ignoreKnowledgeRequestProposal,
  submitKnowledgeRequestDraft,
  updateKnowledgeRequestDraftText,
} from "./KnowledgeRequestComposer";
import {
  NAVIGATOR_TAG_FIXTURES,
  createKnowledgeRequestDraft,
  getCanonicalKnowledgeContextHref,
} from "./knowledgeContext";
import type { ActiveTag } from "./knowledgeContext";

const tagsById = new Map(NAVIGATOR_TAG_FIXTURES.map((tag) => [tag.id, tag]));
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

function fixtureTag(tagId: string) {
  const tag = tagsById.get(tagId);
  if (!tag) {
    throw new Error(`Missing fixture Tag: ${tagId}`);
  }

  return tag;
}

function renderComposer(ui: ReactElement) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);

  act(() => {
    root?.render(ui);
  });

  return container;
}

function changeTextarea(textarea: HTMLTextAreaElement, value: string) {
  act(() => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    valueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function keyDown(element: HTMLElement, key: string) {
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key,
      }),
    );
  });
}

describe("KnowledgeNavigatorQueryInput behavior", () => {
  test("captures typed query text and submits deterministic mapped Tags", () => {
    const draft = updateKnowledgeRequestDraftText(
      createKnowledgeRequestDraft(),
      "How should I answer the student about the First Crusade and Matthew 5:9?",
    );
    const submittedDraft = submitKnowledgeRequestDraft(draft);

    expect(draft.text).toBe(
      "How should I answer the student about the First Crusade and Matthew 5:9?",
    );
    expect(submittedDraft.mappingStatus).toBe("proposed");
    expect(submittedDraft.mappedTags.map((tag) => tag.id)).toEqual([
      "first-crusade",
      "matthew-5-9",
    ]);
  });

  test("derives compact suggestions while excluding active Tags", () => {
    const activeTags = [fixtureTag("matthew-5-9")];

    expect(
      getKnowledgeNavigatorQuerySuggestions("Romans", []).map(
        (suggestion) => suggestion.tag.id,
      ),
    ).toContain("romans-8-28");
    expect(
      getKnowledgeNavigatorQuerySuggestions("First Crusade", activeTags).map(
        (suggestion) => suggestion.tag.id,
      ),
    ).toContain("first-crusade");
    expect(
      getKnowledgeNavigatorQuerySuggestions("Micah", []).map((suggestion) => ({
        id: suggestion.tag.id,
        knowledgeType: suggestion.tag.knowledgeType,
      })),
    ).toContainEqual({
      id: "student-crusades-question",
      knowledgeType: "question",
    });
    expect(
      getKnowledgeNavigatorQuerySuggestions("Matthew", activeTags).map(
        (suggestion) => suggestion.tag.id,
      ),
    ).not.toContain("matthew-5-9");
  });

  test("suggests parseable Bible Passage ranges before broad Scripture rules", () => {
    const suggestions = getKnowledgeNavigatorQuerySuggestions("Romans 8:37-39");

    expect(suggestions[0]).toMatchObject({
      id: "romans-8-37-39",
      tag: {
        href: "/scripture/romans-8-37-39",
        id: "romans-8-37-39",
        knowledgeType: "biblePassage",
        label: "Romans 8:37-39",
      },
    });
    expect(suggestions.map((suggestion) => suggestion.tag.id)).not.toContain(
      "romans-8-28",
    );
  });

  test("maps exact Bible Passage ranges without adding broader rule fixtures", () => {
    const submittedDraft = submitKnowledgeRequestDraft(
      updateKnowledgeRequestDraftText(
        createKnowledgeRequestDraft(),
        "Romans 8:37-39",
      ),
    );

    expect(submittedDraft.mappedTags.map((tag) => tag.id)).toEqual([
      "romans-8-37-39",
    ]);
  });

  test("renders the query input without composer or request copy", () => {
    const markup = renderToStaticMarkup(
      <KnowledgeNavigatorQueryInput
        activeTags={[]}
        initialDraft={createKnowledgeRequestDraft("First Crusade")}
        onApplyMappedTags={() => undefined}
        onSearchContext={() => undefined}
      />,
    );

    expect(markup).toContain("Knowledge Navigator Query Input");
    expect(markup).toContain("Search or add tag");
    expect(markup).toContain("Search Context");
    expect(markup).not.toContain("Knowledge Composer");
    expect(markup).not.toContain("Knowledge Request");
    expect(markup).not.toContain("Ask a Question");
    expect(markup).not.toContain("Map Context");
    expect(markup).not.toContain("Proposed Tags");
  });

  test("applying proposed Tags produces the canonical active Tag URL", () => {
    const submittedDraft = submitKnowledgeRequestDraft(
      updateKnowledgeRequestDraftText(
        createKnowledgeRequestDraft(),
        "Build a Grade 10 lesson on Boethius, providence, and Romans 8:28.",
      ),
    );
    const appliedDraft = applyKnowledgeRequestProposal(submittedDraft);
    const nextHref = getCanonicalKnowledgeContextHref(appliedDraft.mappedTags);

    expect(appliedDraft.mappingStatus).toBe("applied");
    expect(nextHref).toBe(
      "/explore?tagIds=boethius,grade-10-medieval-literature,providence,romans-8-28",
    );
    expect(nextHref).not.toContain("Build");
    expect(nextHref).not.toContain("KnowledgeRequest");
  });

  test("ignoring proposed Tags leaves active Tags and URL unchanged", () => {
    const activeTags = [fixtureTag("matthew-5-9")];
    const activeHref = getCanonicalKnowledgeContextHref(activeTags);
    const submittedDraft = submitKnowledgeRequestDraft(
      updateKnowledgeRequestDraftText(
        createKnowledgeRequestDraft(),
        "Could this connect to courage?",
      ),
      activeTags,
    );
    const ignoredDraft = ignoreKnowledgeRequestProposal(submittedDraft);

    expect(submittedDraft.mappedTags.map((tag) => tag.id)).toEqual([
      "courage",
      "matthew-5-9",
    ]);
    expect(ignoredDraft.mappingStatus).toBe("idle");
    expect(ignoredDraft.mappedTags).toEqual([]);
    expect(getCanonicalKnowledgeContextHref(activeTags)).toBe(activeHref);
    expect(activeHref).toBe("/scripture/matthew-5-9");
  });

  test("clicking a typeahead suggestion adds it to the active Knowledge Context", () => {
    const activeTags = [fixtureTag("matthew-5-9")];
    let mappedTags: ActiveTag[] = [];
    const view = renderComposer(
      <KnowledgeNavigatorQueryInput
        activeTags={activeTags}
        onApplyMappedTags={(nextTags) => {
          mappedTags = nextTags;
        }}
        onSearchContext={() => undefined}
      />,
    );
    const textarea = view.querySelector("textarea");
    if (!textarea) {
      throw new Error("Expected Knowledge Navigator Query Input textarea");
    }

    act(() => textarea.focus());
    changeTextarea(textarea, "First");
    const suggestionButton = view.querySelector<HTMLButtonElement>(
      '[data-suggestion-id="first-crusade"]',
    );
    if (!suggestionButton) {
      throw new Error("Expected First Crusade suggestion");
    }
    act(() => suggestionButton.click());

    expect(mappedTags.map((tag) => tag.id)).toEqual([
      "first-crusade",
      "matthew-5-9",
    ]);
    expect(getCanonicalKnowledgeContextHref(mappedTags)).toBe(
      "/explore?tagIds=first-crusade,matthew-5-9",
    );
  });

  test("renders backend-provided Tag suggestions when supplied", () => {
    let mappedTags: ActiveTag[] = [];
    const robinsonCrusoe: ActiveTag = {
      canonicalKey: "robinson-crusoe",
      href: "/goto/robinson-crusoe",
      id: "robinson-crusoe",
      knowledgeType: "book",
      label: "Robinson Crusoe",
      thumbnailUrl: "https://images.example/robinson.jpg",
    };
    const view = renderComposer(
      <KnowledgeNavigatorQueryInput
        activeTags={[]}
        onApplyMappedTags={(nextTags) => {
          mappedTags = nextTags;
        }}
        onSearchContext={() => undefined}
        suggestions={[
          {
            id: robinsonCrusoe.id,
            matchKind: "label",
            tag: robinsonCrusoe,
          },
        ]}
      />,
    );
    const textarea = view.querySelector("textarea");
    if (!textarea) {
      throw new Error("Expected Knowledge Navigator Query Input textarea");
    }

    act(() => textarea.focus());
    changeTextarea(textarea, "Robinson");
    const suggestionButton = view.querySelector<HTMLButtonElement>(
      '[data-suggestion-id="robinson-crusoe"]',
    );
    if (!suggestionButton) {
      throw new Error("Expected Robinson Crusoe suggestion");
    }
    expect(view.innerHTML).toContain("kb-referent-tag-thumbnail");
    expect(view.innerHTML).toContain("https://images.example/robinson.jpg");
    act(() => suggestionButton.click());

    expect(mappedTags).toEqual([robinsonCrusoe]);
  });

  test("keeps local Tag suggestions visible when backend returns no suggestions", () => {
    let mappedTags: ActiveTag[] = [];
    const view = renderComposer(
      <KnowledgeNavigatorQueryInput
        activeTags={[]}
        onApplyMappedTags={(nextTags) => {
          mappedTags = nextTags;
        }}
        onSearchContext={() => undefined}
        suggestions={[]}
      />,
    );
    const textarea = view.querySelector("textarea");
    if (!textarea) {
      throw new Error("Expected Knowledge Navigator Query Input textarea");
    }

    act(() => textarea.focus());
    changeTextarea(textarea, "boethiu");
    const suggestionButton = view.querySelector<HTMLButtonElement>(
      '[data-suggestion-id="boethius"]',
    );
    if (!suggestionButton) {
      throw new Error("Expected Boethius fallback suggestion");
    }
    act(() => suggestionButton.click());

    expect(mappedTags.map((tag) => tag.id)).toEqual(["boethius"]);
  });

  test("Enter selects only a highlighted suggestion", () => {
    let mappedTags: ActiveTag[] = [];
    const view = renderComposer(
      <KnowledgeNavigatorQueryInput
        activeTags={[]}
        onApplyMappedTags={(nextTags) => {
          mappedTags = nextTags;
        }}
        onSearchContext={() => undefined}
      />,
    );
    const textarea = view.querySelector("textarea");
    if (!textarea) {
      throw new Error("Expected Knowledge Navigator Query Input textarea");
    }

    act(() => textarea.focus());
    changeTextarea(textarea, "Romans");
    keyDown(textarea, "ArrowDown");
    keyDown(textarea, "Enter");

    expect(mappedTags.map((tag) => tag.id)).toEqual(["romans-8-28"]);
  });

  test("Enter without a highlighted suggestion searches without changing active Tags", () => {
    const activeTags = [fixtureTag("matthew-5-9")];
    const activeHref = getCanonicalKnowledgeContextHref(activeTags);
    let searchQuery = "";
    let mappedTags: ActiveTag[] = [];
    const view = renderComposer(
      <KnowledgeNavigatorQueryInput
        activeTags={activeTags}
        onApplyMappedTags={(nextTags) => {
          mappedTags = nextTags;
        }}
        onSearchContext={(query) => {
          searchQuery = query;
        }}
      />,
    );
    const textarea = view.querySelector("textarea");
    if (!textarea) {
      throw new Error("Expected Knowledge Navigator Query Input textarea");
    }

    act(() => textarea.focus());
    changeTextarea(textarea, "courage in a family trial");
    keyDown(textarea, "Enter");

    expect(searchQuery).toBe("courage in a family trial");
    expect(mappedTags).toEqual([]);
    expect(getCanonicalKnowledgeContextHref(activeTags)).toBe(activeHref);
  });
});
