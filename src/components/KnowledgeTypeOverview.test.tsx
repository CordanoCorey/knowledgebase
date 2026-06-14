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
});
