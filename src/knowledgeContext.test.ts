import { describe, expect, test } from "vitest";
import {
  NAVIGATOR_TAG_FIXTURES,
  addActiveTag,
  getActiveTagsFromRoute,
  getCanonicalKnowledgeContextHref,
  getKnowledgeLocationKindFromRoute,
  getKnowledgeLoopStateFromRoute,
  getKnowledgeContextKey,
  removeActiveTag,
} from "./knowledgeContext";

const tagsById = new Map(NAVIGATOR_TAG_FIXTURES.map((tag) => [tag.id, tag]));

function fixtureTag(tagId: string) {
  const tag = tagsById.get(tagId);
  if (!tag) {
    throw new Error(`Missing fixture Tag: ${tagId}`);
  }

  return tag;
}

describe("Knowledge Context routes", () => {
  test("generates canonical routes for zero, one, and multiple active Tags", () => {
    expect(getCanonicalKnowledgeContextHref([])).toBe("/");
    expect(getCanonicalKnowledgeContextHref([fixtureTag("romans-8-28")])).toBe(
      "/scripture/romans-8-28",
    );
    expect(getCanonicalKnowledgeContextHref([fixtureTag("holy-spirit")])).toBe(
      "/goto/holy-spirit",
    );
    expect(
      getCanonicalKnowledgeContextHref([
        fixtureTag("romans-8-28"),
        fixtureTag("holy-spirit"),
        fixtureTag("atonement"),
      ]),
    ).toBe("/explore?tagIds=atonement,holy-spirit,romans-8-28");
  });

  test("adds and removes active Tags through canonical route state", () => {
    const scriptureTag = fixtureTag("romans-8-28");
    const topicTag = fixtureTag("holy-spirit");
    const withScripture = addActiveTag([], scriptureTag);
    const withBothTags = addActiveTag(withScripture, topicTag);

    expect(getCanonicalKnowledgeContextHref(withScripture)).toBe(
      "/scripture/romans-8-28",
    );
    expect(getCanonicalKnowledgeContextHref(withBothTags)).toBe(
      "/explore?tagIds=holy-spirit,romans-8-28",
    );
    expect(
      getCanonicalKnowledgeContextHref(
        removeActiveTag(withBothTags, "romans-8-28"),
      ),
    ).toBe("/goto/holy-spirit");
    expect(
      getCanonicalKnowledgeContextHref(removeActiveTag(withScripture, "romans-8-28")),
    ).toBe("/");
  });

  test("parses current route state into active Tags", () => {
    expect(
      getActiveTagsFromRoute({
        pathname: "/scripture/romans-8-28",
        search: "",
      }),
    ).toMatchObject([{ id: "romans-8-28", knowledgeType: "biblePassage" }]);
    expect(
      getActiveTagsFromRoute({
        pathname: "/goto/holy-spirit",
        search: "",
      }),
    ).toMatchObject([{ id: "holy-spirit", knowledgeType: "topic" }]);
    expect(
      getActiveTagsFromRoute({
        pathname: "/explore",
        search: "?tagIds=romans-8-28,holy-spirit",
      }).map((tag) => tag.id),
    ).toEqual(["holy-spirit", "romans-8-28"]);
  });

  test("derives location kind and loop context from the current route", () => {
    expect(getKnowledgeLocationKindFromRoute({ pathname: "/" })).toBe(
      "dashboard",
    );
    expect(
      getKnowledgeLocationKindFromRoute({ pathname: "/scripture/romans-8-28" }),
    ).toBe("biblePassageReferent");
    expect(getKnowledgeLocationKindFromRoute({ pathname: "/goto/holy-spirit" })).toBe(
      "referent",
    );
    expect(getKnowledgeLocationKindFromRoute({ pathname: "/explore" })).toBe(
      "context",
    );

    const loopState = getKnowledgeLoopStateFromRoute({
      pathname: "/explore",
      search: "?tagIds=romans-8-28,holy-spirit",
    });

    expect(loopState.locationKind).toBe("context");
    expect(loopState.contextKey).toBe("tags:holy-spirit,romans-8-28");
    expect(loopState.activeTags.map((tag) => tag.id)).toEqual([
      "holy-spirit",
      "romans-8-28",
    ]);
    expect(loopState.requestDraft).toEqual({
      text: "",
      mappedTags: [],
      mappingStatus: "idle",
    });
  });

  test("does not serialize Knowledge Request text into canonical active Tag URLs", () => {
    const activeTags = getActiveTagsFromRoute({
      pathname: "/explore",
      search:
        "?tagIds=romans-8-28,holy-spirit&knowledgeRequest=What%20does%20this%20mean",
    });
    const canonicalHref = getCanonicalKnowledgeContextHref(activeTags);

    expect(activeTags.map((tag) => tag.id)).toEqual([
      "holy-spirit",
      "romans-8-28",
    ]);
    expect(canonicalHref).toBe("/explore?tagIds=holy-spirit,romans-8-28");
    expect(canonicalHref).not.toContain("knowledgeRequest");
    expect(canonicalHref).not.toContain("What");
  });

  test("selection order does not affect Knowledge Context identity", () => {
    const firstSelection = [
      fixtureTag("romans-8-28"),
      fixtureTag("holy-spirit"),
      fixtureTag("atonement"),
    ];
    const secondSelection = [
      fixtureTag("atonement"),
      fixtureTag("romans-8-28"),
      fixtureTag("holy-spirit"),
    ];

    expect(getKnowledgeContextKey(firstSelection)).toBe(
      getKnowledgeContextKey(secondSelection),
    );
    expect(getCanonicalKnowledgeContextHref(firstSelection)).toBe(
      getCanonicalKnowledgeContextHref(secondSelection),
    );
    expect(getCanonicalKnowledgeContextHref(firstSelection)).toBe(
      "/explore?tagIds=atonement,holy-spirit,romans-8-28",
    );
  });
});
