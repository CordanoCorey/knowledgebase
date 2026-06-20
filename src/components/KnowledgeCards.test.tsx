// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("does not render Human Weight for non-weight-bearing entries", () => {
    const nonWeightBearingEntry: KnowledgeEntrySummary = {
      ...entryFixture,
      id: "entry-school-topic",
      title: "Arche Classical Academy",
      knowledgeType: "topic",
      humanWeight: undefined,
      href: "/entries/entry-school-topic",
    };

    const markup = renderToStaticMarkup(
      <KnowledgeEntryCard entry={nonWeightBearingEntry} />,
    );

    expect(markup).toContain("Arche Classical Academy");
    expect(markup).not.toContain("Human Weight");
    expect(markup).not.toContain("0/100");
    expect(markup).not.toContain("Human Weight 0");
  });

  it("renders Human Weight Concern as non-accusatory review copy", () => {
    const markup = renderToStaticMarkup(
      <KnowledgeEntryCard
        entry={{
          ...entryFixture,
          humanWeight: 35,
          humanWeightConcern: {
            level: "possibleConcern",
            expectation: "expected",
            threshold: 40,
          },
          knowledgeType: "essay",
          title: "Student essay on courage",
        }}
      />,
    );

    expect(markup).toContain("Human Weight Review");
    expect(markup).toContain("Expected human substance below 40/100.");
    expect(markup).not.toContain("AI-written");
    expect(markup).not.toContain("cheating");
    expect(markup).not.toContain("failed");
    expect(markup).not.toContain("AI detector");
  });

  it("renders the Human Weight credit subject subtly", () => {
    const markup = renderToStaticMarkup(
      <KnowledgeEntryCard
        entry={{
          ...entryFixture,
          humanWeightCredit: {
            basis: "quotedPerson",
            label: "C.S. Lewis",
          },
          knowledgeType: "quote",
          title: "Courage at the Testing Point",
        }}
      />,
    );

    expect(markup).toContain("Human Weight Credits");
    expect(markup).toContain("C.S. Lewis");
    expect(markup).not.toContain("AI-written");
    expect(markup).not.toContain("cheating");
    expect(markup).not.toContain("AI detector");
  });

  it("omits Human Weight credit when the summary is absent", () => {
    const markup = renderToStaticMarkup(<KnowledgeEntryCard entry={entryFixture} />);

    expect(markup).not.toContain("Human Weight Credits");
  });

  it("submits subtle Human Weight Feedback for weight-bearing entries", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const onHumanWeightFeedback = vi.fn(async () => undefined);

    await act(async () => {
      root?.render(
        <KnowledgeEntryCard
          entry={entryFixture}
          onHumanWeightFeedback={onHumanWeightFeedback}
        />,
      );
    });

    await clickButton(getButtonByText(container, "Feedback"));
    expect(container.textContent).toContain("Human Weight Feedback");

    await clickButton(getButtonByText(container, "Used"));
    const note = container.querySelector("textarea");
    if (!(note instanceof HTMLTextAreaElement)) {
      throw new Error("Missing feedback note field");
    }
    await setTextareaValue(note, "Used in a middle school lesson.");
    await clickButton(getButtonByText(container, "Save"));

    expect(onHumanWeightFeedback).toHaveBeenCalledWith({
      entry: entryFixture,
      feedbackKind: "used",
      feedbackNote: "Used in a middle school lesson.",
    });
    expect(container.textContent).toContain("Feedback saved.");
  });

  it("does not offer Human Weight Feedback for non-weight-bearing entries", async () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <KnowledgeEntryCard
          entry={{
            ...entryFixture,
            humanWeight: undefined,
            knowledgeType: "topic",
          }}
          onHumanWeightFeedback={async () => undefined}
        />,
      );
    });

    expect(queryButtonByText(container, "Feedback")).toBeNull();
  });
});

describe("KnowledgeSlotCard", () => {
  it("renders the slot request, status, target, due date, and contribution CTA", () => {
    const markup = renderToStaticMarkup(<KnowledgeSlotCard slot={slotFixture} />);

    expect(markup).toContain("Requested Entry");
    expect(markup).toContain("Lesson for Romans 8:18-30");
    expect(markup).toContain('class="kb-slot-missing-content"');
    expect(markup).toContain('class="kb-knowledge-type-badge kb-card-type"');
    expect(markup).toContain("Lesson needed");
    expect(markup).toContain("Missing Lesson");
    expect(markup).toContain(slotFixture.promptText);
    expect(markup).toContain("Open request");
    expect(markup).toContain("Youth teachers");
    expect(markup).toContain("Feb 1, 2026");
    expect(markup).toContain("Romans 8");
    expect(markup).toContain("Suffering and hope");
    expect(markup).toContain("Add missing Lesson");
    expect(markup).not.toContain("Knowledge Slot");
    expect(markup).not.toContain("Add content to complete this entry.");
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

  it("uses the contribution handler for the missing-content CTA", () => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const onContribute = vi.fn();

    act(() => {
      root?.render(
        <KnowledgeSlotCard onContribute={onContribute} slot={slotFixture} />,
      );
    });

    const cta = getLinkByText(container, "Add missing Lesson");
    let clickResult = true;
    act(() => {
      clickResult = cta.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(clickResult).toBe(false);
    expect(onContribute).toHaveBeenCalledTimes(1);
    expect(onContribute).toHaveBeenCalledWith(slotFixture);
  });
});

function getLinkByText(element: HTMLElement, text: string) {
  const link = Array.from(element.querySelectorAll("a")).find(
    (candidate) => candidate.textContent === text,
  );

  if (!link) {
    throw new Error(`Missing link with text "${text}"`);
  }

  return link;
}

function queryButtonByText(element: HTMLElement, text: string) {
  return (
    Array.from(element.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === text,
    ) ?? null
  );
}

function getButtonByText(element: HTMLElement, text: string) {
  const button = queryButtonByText(element, text);
  if (!button) {
    throw new Error(`Missing button with text "${text}"`);
  }

  return button;
}

async function clickButton(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(
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
