// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LogeionBrand } from "./LogeionBrand";
import { ReferentTagLink } from "./ReferentTagLink";
import type { ActiveTag } from "../knowledgeContext";

const augustineTag: ActiveTag = {
  canonicalKey: "augustine",
  href: "/goto/augustine",
  id: "augustine",
  knowledgeType: "person",
  label: "Augustine",
};

describe("LogeionBrand", () => {
  test("renders full and compact brand densities", () => {
    const fullMarkup = renderToStaticMarkup(
      <LogeionBrand className="extra-brand-class" />,
    );
    expect(fullMarkup).toContain("logeion-brand");
    expect(fullMarkup).toContain("extra-brand-class");
    expect(fullMarkup).toContain("Logeion");
    expect(fullMarkup).toContain("by Arche Press");
    expect(fullMarkup).toContain('aria-hidden="true"');

    const compactMarkup = renderToStaticMarkup(<LogeionBrand density="compact" />);
    expect(compactMarkup).toContain("logeion-brand-compact");
    expect(compactMarkup).not.toContain("logeion-brand-copy");
    expect(compactMarkup).not.toContain("by Arche Press");
  });
});

describe("ReferentTagLink", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  test("resolves labels to canonical referent links", () => {
    const markup = renderToStaticMarkup(
      <ReferentTagLink className="tag-link" label="Romans 8:28" showIcon />,
    );

    expect(markup).toContain('href="/scripture/romans-8-28"');
    expect(markup).toContain('data-knowledge-type="biblePassage"');
    expect(markup).toContain('title="Open Romans 8:28"');
    expect(markup).toContain("Romans 8:28");
    expect(markup).toContain("tag-link");
  });

  test("uses explicit tag data and routes clicks through the callback", async () => {
    const navigate = vi.fn();

    await act(async () => {
      root.render(
        <ReferentTagLink onNavigateToHref={navigate} tag={augustineTag}>
          <strong>Church father</strong>
        </ReferentTagLink>,
      );
    });

    const link = container.querySelector("a");
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error("Missing ReferentTagLink anchor.");
    }

    expect(link.getAttribute("href")).toBe("/goto/augustine");
    expect(link.dataset.knowledgeType).toBe("person");
    expect(link.textContent).toBe("Church father");

    await act(async () => {
      link.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(navigate).toHaveBeenCalledWith("/goto/augustine");
  });

  test("features a tag thumbnail when explicit tag data includes one", () => {
    const markup = renderToStaticMarkup(
      <ReferentTagLink
        className="tag-link"
        tag={{
          ...augustineTag,
          thumbnailUrl: "https://images.example/augustine.jpg",
        }}
      />,
    );

    expect(markup).toContain("kb-referent-tag-thumbnail");
    expect(markup).toContain('src="https://images.example/augustine.jpg"');
    expect(markup).toContain("Augustine");
  });
});
