import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KnowledgeEntryCard, KnowledgeSlotCard } from "./KnowledgeCards";
import type {
  KnowledgeEntrySummary,
  KnowledgeSlotSummary,
} from "../knowledgeContracts";

const entryFixture: KnowledgeEntrySummary = {
  contributor: {
    id: "contributor-ada-teacher",
    name: "Ada Teacher",
  },
  id: "entry-romans-8-lesson",
  title: "Middle school discussion guide: Hope in the Spirit",
  knowledgeType: "lesson",
  previewText:
    "A reusable lesson outline with Scripture reading and reflection questions for small groups.",
  primaryTagLabel: "Romans 8",
  contextPreviewTagLabels: ["Romans 8", "Suffering and hope", "Youth lesson"],
  humanWeight: 74,
  href: "/entries/entry-romans-8-lesson",
  updatedAt: Date.UTC(2026, 0, 15, 12),
};

const slotFixture: KnowledgeSlotSummary = {
  id: "slot-romans-8-lesson",
  title: "Lesson for Romans 8:18-30",
  requestedKnowledgeType: "lesson",
  promptText: "Contribute a youth-ready lesson that connects suffering, hope, and prayer.",
  status: "open",
  contextPreviewTagLabels: ["Romans 8", "Suffering and hope"],
  targetLabel: "Youth teachers",
  dueAt: Date.UTC(2026, 1, 1, 12),
  href: "/slots/slot-romans-8-lesson",
};

describe("KnowledgeEntryCard", () => {
  it("renders the entry summary contract from fixture props", () => {
    const markup = renderToStaticMarkup(<KnowledgeEntryCard entry={entryFixture} />);

    expect(markup).toContain("Knowledge Entry");
    expect(markup).toContain("Middle school discussion guide: Hope in the Spirit");
    expect(markup).toContain("Contributed by");
    expect(markup).toContain("Ada Teacher");
    expect(markup).toContain("Lesson");
    expect(markup).toContain(entryFixture.previewText);
    expect(markup).toContain("Primary Tag");
    expect(markup).toContain("Romans 8");
    expect(markup).toContain("Suffering and hope");
    expect(markup).toContain("Youth lesson");
    expect(markup).toContain("Human Weight");
    expect(markup).toContain("74/100");
    expect(markup).toContain("Jan 15, 2026");
    expect(markup).toContain('href="/entries/entry-romans-8-lesson"');
    expect(markup).toContain('href="/scripture/romans-8"');
    expect(markup).toContain('href="/goto/suffering-and-hope"');
    expect(markup).toContain('href="/goto/youth-lesson"');
  });
});

describe("KnowledgeSlotCard", () => {
  it("renders the slot request, status, target, due date, and contribution CTA", () => {
    const markup = renderToStaticMarkup(<KnowledgeSlotCard slot={slotFixture} />);

    expect(markup).toContain("Requested Entry");
    expect(markup).toContain("Lesson for Romans 8:18-30");
    expect(markup).toContain("Entry needed");
    expect(markup).toContain("Lesson needed");
    expect(markup).toContain(slotFixture.promptText);
    expect(markup).toContain("Open request");
    expect(markup).toContain("Youth teachers");
    expect(markup).toContain("Feb 1, 2026");
    expect(markup).toContain("Romans 8");
    expect(markup).toContain("Suffering and hope");
    expect(markup).toContain("Add content to complete this entry.");
    expect(markup).toContain("Add missing Lesson");
    expect(markup).not.toContain("Knowledge Slot");
    expect(markup).toContain('href="/slots/slot-romans-8-lesson"');
    expect(markup).toContain('href="/scripture/romans-8"');
    expect(markup).toContain('href="/goto/suffering-and-hope"');
  });

  it("covers missing optional prompt and due date values", () => {
    const minimalSlot: KnowledgeSlotSummary = {
      ...slotFixture,
      id: "slot-open-question",
      promptText: undefined,
      dueAt: undefined,
      contextPreviewTagLabels: [],
    };

    const markup = renderToStaticMarkup(<KnowledgeSlotCard slot={minimalSlot} />);

    expect(markup).toContain("Add the missing content for this Knowledge Context.");
    expect(markup).toContain("No due date");
    expect(markup).toContain("No context Tags");
  });
});
