import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KnowledgeTypeOverview } from "./KnowledgeTypeOverview";
import {
  AUTHORABLE_KNOWLEDGE_TYPES,
  formatKnowledgeTypeLabel,
  type ActiveTag,
  type KnowledgeType,
} from "../knowledgeContracts";

const KNOWLEDGE_TYPES = [
  "biblePassage",
  ...AUTHORABLE_KNOWLEDGE_TYPES,
] satisfies readonly KnowledgeType[];

describe("KnowledgeTypeOverview", () => {
  it.each(KNOWLEDGE_TYPES)("renders the %s overview detail", (knowledgeType) => {
    const referent: ActiveTag = {
      canonicalKey: `${knowledgeType}-key`,
      href:
        knowledgeType === "biblePassage"
          ? "/scripture/romans-8-28"
          : `/goto/${knowledgeType}-referent`,
      id: `${knowledgeType}-referent`,
      knowledgeType,
      label: `${formatKnowledgeTypeLabel(knowledgeType)} Referent`,
      passageString:
        knowledgeType === "biblePassage" ? "romans-8-28" : undefined,
    };

    const markup = renderToStaticMarkup(
      <KnowledgeTypeOverview referent={referent} />,
    );

    expect(markup).toContain(`${formatKnowledgeTypeLabel(knowledgeType)} Overview`);
    expect(markup).toContain("Referent Overview");
    expect(markup).toContain("Base Words Layer");
    expect(markup).toContain(referent.canonicalKey);
    expect(markup).toContain(referent.label);
  });

  it("uses a referent thumbnail in the overview visual slot when available", () => {
    const referent: ActiveTag = {
      canonicalKey: "mark-twain",
      href: "/goto/mark-twain",
      id: "mark-twain",
      knowledgeType: "person",
      label: "Mark Twain",
      thumbnailUrl: "https://images.example/mark-twain.jpg",
    };

    const markup = renderToStaticMarkup(
      <KnowledgeTypeOverview referent={referent} />,
    );

    expect(markup).toContain('class="kb-overview-icon"');
    expect(markup).toContain('data-has-thumbnail="true"');
    expect(markup).toContain('src="https://images.example/mark-twain.jpg"');
    expect(markup).not.toContain("kb-overview-type-icon");
  });
});
