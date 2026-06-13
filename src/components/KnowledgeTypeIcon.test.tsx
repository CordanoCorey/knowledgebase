import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AUTHORABLE_KNOWLEDGE_TYPES,
  formatKnowledgeTypeLabel,
  type KnowledgeType,
} from "../knowledgeContracts";
import {
  KNOWLEDGE_TYPE_ICON_SYMBOLS,
  KnowledgeTypeBadge,
  KnowledgeTypeIcon,
} from "./KnowledgeTypeIcon";

const KNOWLEDGE_TYPES = [
  "biblePassage",
  ...AUTHORABLE_KNOWLEDGE_TYPES,
] satisfies readonly KnowledgeType[];

describe("KnowledgeTypeIcon", () => {
  it("has an asset symbol for every Knowledge Type", () => {
    expect(Object.keys(KNOWLEDGE_TYPE_ICON_SYMBOLS).sort()).toEqual(
      [...KNOWLEDGE_TYPES].sort(),
    );
  });

  it.each(KNOWLEDGE_TYPES)("renders the %s icon asset", (knowledgeType) => {
    const markup = renderToStaticMarkup(
      <KnowledgeTypeIcon decorative={false} knowledgeType={knowledgeType} />,
    );

    expect(markup).toContain(`data-knowledge-type="${knowledgeType}"`);
    expect(markup).toContain(`#${KNOWLEDGE_TYPE_ICON_SYMBOLS[knowledgeType]}`);
    expect(markup).toContain(`aria-label="${formatKnowledgeTypeLabel(knowledgeType)} icon"`);
  });
});

describe("KnowledgeTypeBadge", () => {
  it("renders the icon with the type label", () => {
    const markup = renderToStaticMarkup(<KnowledgeTypeBadge knowledgeType="lesson" />);

    expect(markup).toContain("Lesson");
    expect(markup).toContain("#kt-lesson");
  });
});
