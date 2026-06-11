import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { KnowledgeRequestComposer } from "./KnowledgeRequestComposer";
import {
  applyKnowledgeRequestProposal,
  ignoreKnowledgeRequestProposal,
  submitKnowledgeRequestDraft,
  updateKnowledgeRequestDraftText,
} from "./KnowledgeRequestComposer";
import {
  NAVIGATOR_TAG_FIXTURES,
  createKnowledgeRequestDraft,
  getCanonicalKnowledgeContextHref,
} from "./knowledgeContext";

const tagsById = new Map(NAVIGATOR_TAG_FIXTURES.map((tag) => [tag.id, tag]));

function fixtureTag(tagId: string) {
  const tag = tagsById.get(tagId);
  if (!tag) {
    throw new Error(`Missing fixture Tag: ${tagId}`);
  }

  return tag;
}

describe("KnowledgeRequestComposer draft behavior", () => {
  test("captures typed Knowledge Request text and submits deterministic mapped Tags", () => {
    const draft = updateKnowledgeRequestDraftText(
      createKnowledgeRequestDraft(),
      "What does Romans 8:28 teach about the Holy Spirit?",
    );
    const submittedDraft = submitKnowledgeRequestDraft(draft);

    expect(draft.text).toBe(
      "What does Romans 8:28 teach about the Holy Spirit?",
    );
    expect(submittedDraft.mappingStatus).toBe("proposed");
    expect(submittedDraft.mappedTags.map((tag) => tag.id)).toEqual([
      "holy-spirit",
      "romans-8-28",
    ]);
  });

  test("renders proposed Tags without mutating active Tags", () => {
    const activeTags = [fixtureTag("romans-8-28")];
    const submittedDraft = submitKnowledgeRequestDraft(
      updateKnowledgeRequestDraftText(
        createKnowledgeRequestDraft(),
        "How does the Holy Spirit comfort believers?",
      ),
      activeTags,
    );
    const markup = renderToStaticMarkup(
      <KnowledgeRequestComposer
        activeTags={activeTags}
        initialDraft={submittedDraft}
        onApplyMappedTags={() => undefined}
      />,
    );

    expect(activeTags.map((tag) => tag.id)).toEqual(["romans-8-28"]);
    expect(submittedDraft.mappedTags.map((tag) => tag.id)).toEqual([
      "holy-spirit",
      "romans-8-28",
    ]);
    expect(markup).toContain("Proposed Tags");
    expect(markup).toContain("Holy Spirit");
    expect(markup).toContain("Romans 8:28");
    expect(markup).toContain("Apply Tags");
    expect(markup).toContain("Ignore");
  });

  test("applying proposed Tags produces the canonical active Tag URL", () => {
    const submittedDraft = submitKnowledgeRequestDraft(
      updateKnowledgeRequestDraftText(
        createKnowledgeRequestDraft(),
        "Build a youth lesson on Romans 8:28 and the Holy Spirit.",
      ),
    );
    const appliedDraft = applyKnowledgeRequestProposal(submittedDraft);
    const nextHref = getCanonicalKnowledgeContextHref(appliedDraft.mappedTags);

    expect(appliedDraft.mappingStatus).toBe("applied");
    expect(nextHref).toBe(
      "/explore?tagIds=christian-education,holy-spirit,romans-8-28",
    );
    expect(nextHref).not.toContain("Build");
    expect(nextHref).not.toContain("KnowledgeRequest");
  });

  test("ignoring proposed Tags leaves active Tags and URL unchanged", () => {
    const activeTags = [fixtureTag("romans-8-28")];
    const activeHref = getCanonicalKnowledgeContextHref(activeTags);
    const submittedDraft = submitKnowledgeRequestDraft(
      updateKnowledgeRequestDraftText(
        createKnowledgeRequestDraft(),
        "Could this connect to atonement?",
      ),
      activeTags,
    );
    const ignoredDraft = ignoreKnowledgeRequestProposal(submittedDraft);

    expect(submittedDraft.mappedTags.map((tag) => tag.id)).toEqual([
      "atonement",
      "romans-8-28",
    ]);
    expect(ignoredDraft.mappingStatus).toBe("idle");
    expect(ignoredDraft.mappedTags).toEqual([]);
    expect(getCanonicalKnowledgeContextHref(activeTags)).toBe(activeHref);
    expect(activeHref).toBe("/scripture/romans-8-28");
  });
});
