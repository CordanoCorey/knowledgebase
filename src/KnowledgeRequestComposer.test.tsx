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

  test("renders proposed Tags without mutating active Tags", () => {
    const activeTags = [fixtureTag("matthew-5-9")];
    const submittedDraft = submitKnowledgeRequestDraft(
      updateKnowledgeRequestDraftText(
        createKnowledgeRequestDraft(),
        "How does Augustine help teach the First Crusade?",
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

    expect(activeTags.map((tag) => tag.id)).toEqual(["matthew-5-9"]);
    expect(submittedDraft.mappedTags.map((tag) => tag.id)).toEqual([
      "first-crusade",
      "matthew-5-9",
      "the-city-of-god",
    ]);
    expect(markup).toContain("Proposed Tags");
    expect(markup).toContain("First Crusade");
    expect(markup).toContain("Matthew 5:9");
    expect(markup).toContain("The City of God");
    expect(markup).toContain("Apply Tags");
    expect(markup).toContain("Ignore");
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
});
