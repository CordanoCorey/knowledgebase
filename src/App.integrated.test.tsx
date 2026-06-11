// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: async () => undefined,
    signOut: async () => undefined,
  }),
  useConvexAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({
    canonicalKey: "romans-8-28",
    hasText: true,
    isTruncated: false,
    label: "Romans 8:28",
    passageString: "romans-8-28",
    ranges: [{ endOrdinal: 28232, startOrdinal: 28232 }],
    slug: "romans-8-28",
    status: "resolved",
    translation: {
      code: "KJV",
      name: "King James Version",
      textStatus: "available",
    },
    verses: [
      {
        bookCode: "ROM",
        bookName: "Romans",
        bookShortName: "Rom",
        chapterNumber: 8,
        ordinal: 28232,
        text: "And we know that all things work together for good...",
        verseNumber: 28,
      },
    ],
  }),
}));

const CONTRIBUTION_TITLE = "Comfort by the Spirit";
const CONTRIBUTION_BODY =
  "A deterministic lesson contribution on Romans 8:28 and the Holy Spirit.";

describe("MVP Explore/Contribute loop", () => {
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/scripture/romans-8-28",
    );
    window.localStorage.clear();
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
  });

  test("navigates from Scripture Explore to Slot Contribute and returns the contribution as an Answer", async () => {
    await renderApp();

    expect(getButton("Remove Romans 8:28")).toBeTruthy();
    expect(queryButton("Remove Holy Spirit")).toBeNull();

    await click(getButton("Add Holy Spirit"));

    expect(window.location.pathname + window.location.search).toBe(
      "/explore?tagIds=holy-spirit,romans-8-28",
    );
    expect(getButton("Remove Holy Spirit")).toBeTruthy();

    const initialAnswerItems = getFeedItems("answer");
    expect(initialAnswerItems.map(getCardTitle)).toEqual([
      "Romans 8 and Life in the Spirit",
      "Spirit-led Hope in Hard Providences",
    ]);
    expect(initialAnswerItems.map(getHumanWeightText)).toEqual([
      "94/100",
      "68/100",
    ]);
    for (const answerItem of initialAnswerItems) {
      expect(answerItem.textContent).toContain("Romans 8:28");
      expect(answerItem.textContent).toContain("Holy Spirit");
    }

    const slotItem = getFeedItems("slot")[0];
    expect(slotItem).toBeTruthy();
    expect(slotItem.textContent).toContain("Knowledge Slot");
    expect(slotItem.textContent).toContain("Lesson on Romans 8 and the Holy Spirit");
    expect(slotItem.textContent).toContain("Romans 8:28");
    expect(slotItem.textContent).toContain("Holy Spirit");

    const slotContributionCta = getLinkIn(slotItem, "Contribute Lesson");
    await click(slotContributionCta);

    const editor = getContributionEditor();
    expect(editor.textContent).toContain("Lesson on Romans 8 and the Holy Spirit");
    expect(getContributionContextLabels(editor)).toEqual([
      "Holy Spirit",
      "Romans 8:28",
    ]);
    const knowledgeTypeSelect = editor.querySelector("select");
    expect(knowledgeTypeSelect?.getAttribute("disabled")).not.toBeNull();
    expect(knowledgeTypeSelect?.getAttribute("value") ?? knowledgeTypeSelect?.value).toBe(
      "lesson",
    );

    await setFieldValue(getTextInputIn(editor), CONTRIBUTION_TITLE);
    await setFieldValue(getTextareaIn(editor), CONTRIBUTION_BODY);
    await click(getButtonIn(editor, "Submit Lesson"));

    const finalAnswerItems = getFeedItems("answer");
    expect(finalAnswerItems.map(getCardTitle)).toEqual([
      "Romans 8 and Life in the Spirit",
      CONTRIBUTION_TITLE,
      "Spirit-led Hope in Hard Providences",
    ]);

    const contributionAnswer = finalAnswerItems.find(
      (item) => getCardTitle(item) === CONTRIBUTION_TITLE,
    );
    expect(contributionAnswer).toBeTruthy();
    expect(contributionAnswer?.textContent).toContain("Knowledge Entry");
    expect(contributionAnswer?.textContent).toContain(CONTRIBUTION_BODY);
    expect(contributionAnswer?.textContent).toContain("Human Weight");
    expect(contributionAnswer?.textContent).toContain("82/100");
    expect(contributionAnswer?.textContent).toContain("Romans 8:28");
    expect(contributionAnswer?.textContent).toContain("Holy Spirit");
    expect(contributionAnswer?.innerHTML).toContain(
      'href="/entries/simulated-slot-romans-8-spirit-lesson"',
    );
  });

  async function renderApp() {
    root = createRoot(container);
    await act(async () => {
      root?.render(<App />);
    });
  }

  function queryButton(label: string) {
    return (
      Array.from(container.querySelectorAll("button")).find(
        (button) =>
          button.getAttribute("aria-label") === label ||
          normalizeText(button) === label,
      ) ?? null
    );
  }

  function getButton(label: string) {
    const button = queryButton(label);
    if (!button) {
      throw new Error(`Missing button: ${label}`);
    }

    return button;
  }

  function getButtonIn(element: Element, label: string) {
    const button = Array.from(element.querySelectorAll("button")).find(
      (candidate) =>
        candidate.getAttribute("aria-label") === label ||
        normalizeText(candidate) === label,
    );
    if (!button) {
      throw new Error(`Missing scoped button: ${label}`);
    }

    return button;
  }

  function getFeedItems(kind: "answer" | "slot") {
    return Array.from(
      container.querySelectorAll(`.kb-answer-feed-list li[data-feed-kind="${kind}"]`),
    );
  }

  function getCardTitle(item: Element) {
    return normalizeText(item.querySelector("h3"));
  }

  function getHumanWeightText(item: Element) {
    return normalizeText(item.querySelector(".kb-human-weight-metric dd"));
  }

  function getLinkIn(element: Element, text: string) {
    const link = Array.from(element.querySelectorAll("a")).find(
      (candidate) => normalizeText(candidate) === text,
    );
    if (!link) {
      throw new Error(`Missing link: ${text}`);
    }

    return link;
  }

  function getContributionEditor() {
    const editor = container.querySelector(".kb-contribution-editor");
    if (!editor) {
      throw new Error("Missing Contribution Editor");
    }

    return editor;
  }

  function getContributionContextLabels(editor: Element) {
    return Array.from(
      editor.querySelectorAll(".kb-contribution-context-tags li"),
    ).map(normalizeText);
  }

  function getTextInputIn(element: Element) {
    const input = element.querySelector('input[type="text"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Missing text input");
    }

    return input;
  }

  function getTextareaIn(element: Element) {
    const textarea = element.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error("Missing textarea");
    }

    return textarea;
  }

  async function click(element: Element) {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
  }

  async function setFieldValue(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ) {
    await act(async () => {
      const valueSetter =
        element instanceof HTMLTextAreaElement
          ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")
              ?.set
          : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

      valueSetter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
  }

  function normalizeText(element: Element | null) {
    return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
});
