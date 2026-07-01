// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RootSearchResults, type RootSearchResult } from "./RootSearchResults";

const firstCrusadeResult: RootSearchResult = {
  canonicalKey: "first-crusade",
  href: "/goto/first-crusade",
  id: "first-crusade",
  knowledgeType: "topic",
  label: "First Crusade",
  matchedEntryPreview: {
    href: "/entries/augustine-crusades",
    id: "augustine-crusades",
    knowledgeType: "lesson",
    previewText: "A lesson plan about Augustine and ordered loves.",
    primaryTagLabel: "Grade 9 Church History",
    title: "Augustine and the First Crusade",
  },
  scopeLabel: "Organization",
  tag: {
    canonicalKey: "first-crusade",
    href: "/goto/first-crusade",
    id: "first-crusade",
    knowledgeType: "topic",
    label: "First Crusade",
  },
  thumbnailUrl: "https://images.example/first-crusade.jpg",
};

describe("RootSearchResults", () => {
  let container: HTMLDivElement;
  let root: Root;
  let clearSearch: ReturnType<typeof vi.fn<() => void>>;
  let navigateToHref: ReturnType<typeof vi.fn<(href: string) => void>>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    clearSearch = vi.fn<() => void>();
    navigateToHref = vi.fn<(href: string) => void>();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("renders loading state with a clearable query chip", async () => {
    await render({ isLoading: true, query: "  crusade  ", results: [] });

    expect(text()).toContain('Results for "crusade"');
    expect(text()).toContain('Searching everything for "crusade"');
    expect(text()).toContain("Searching");

    await click(getButton("Clear root search"));
    expect(clearSearch).toHaveBeenCalledOnce();
  });

  test("renders results, matched previews, and navigates through local routing", async () => {
    await render({
      isLoading: false,
      query: "crusade",
      results: [firstCrusadeResult],
    });

    expect(text()).toContain("1 result");
    expect(text()).toContain("First Crusade");
    expect(text()).toContain("Organization");
    expect(text()).toContain("Augustine and the First Crusade");
    expect(text()).toContain("A lesson plan about Augustine and ordered loves.");
    expect(
      container.querySelector(
        'img[src="https://images.example/first-crusade.jpg"]',
      ),
    ).toBeTruthy();

    await click(getLink("First Crusade"));
    expect(navigateToHref).toHaveBeenCalledWith("/goto/first-crusade");

    await click(getLink("Open Page"));
    expect(navigateToHref).toHaveBeenCalledTimes(2);
  });

  test("renders an empty state only for completed non-empty searches", async () => {
    await render({ isLoading: false, query: "unknown", results: [] });
    expect(text()).toContain("0 results");
    expect(text()).toContain("No Referent Pages match this search yet.");

    await render({ isLoading: false, query: "", results: [] });
    expect(text()).toContain("Search Everything");
    expect(text()).toContain("0 results");
    expect(text()).not.toContain("No Referent Pages match this search yet.");
  });

  async function render({
    isLoading,
    query,
    results,
  }: {
    isLoading: boolean;
    query: string;
    results: RootSearchResult[];
  }) {
    await act(async () => {
      root.render(
        <RootSearchResults
          isLoading={isLoading}
          onClearSearch={clearSearch}
          onNavigateToHref={navigateToHref}
          query={query}
          results={results}
        />,
      );
    });
  }

  function getButton(label: string) {
    const button = container.querySelector(`button[aria-label="${label}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing button: ${label}`);
    }
    return button;
  }

  function getLink(label: string) {
    const link = Array.from(container.querySelectorAll("a")).find(
      (candidate) => candidate.textContent?.replace(/\s+/g, " ").trim() === label,
    );
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error(`Missing link: ${label}`);
    }
    return link;
  }

  async function click(element: Element) {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
  }

  function text() {
    return container.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
});
