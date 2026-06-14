import { describe, expect, test } from "vitest";
import {
  NAVIGATOR_TAG_FIXTURES,
  addActiveTag,
  getActiveTagsFromRoute,
  getCanonicalKnowledgeContextHref,
  getKnowledgeLocationKindFromRoute,
  getKnowledgeLoopStateFromRoute,
  getKnowledgeContextKey,
  getReferentTagHref,
  removeActiveTag,
  resolveTagLabel,
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
    expect(getCanonicalKnowledgeContextHref([fixtureTag("matthew-5-9")])).toBe(
      "/scripture/matthew-5-9",
    );
    expect(getCanonicalKnowledgeContextHref([fixtureTag("first-crusade")])).toBe(
      "/goto/first-crusade",
    );
    expect(
      getCanonicalKnowledgeContextHref([
        fixtureTag("matthew-5-9"),
        fixtureTag("first-crusade"),
        fixtureTag("boethius"),
      ]),
    ).toBe("/explore?tagIds=boethius,first-crusade,matthew-5-9");
  });

  test("adds and removes active Tags through canonical route state", () => {
    const scriptureTag = fixtureTag("matthew-5-9");
    const topicTag = fixtureTag("first-crusade");
    const withScripture = addActiveTag([], scriptureTag);
    const withBothTags = addActiveTag(withScripture, topicTag);

    expect(getCanonicalKnowledgeContextHref(withScripture)).toBe(
      "/scripture/matthew-5-9",
    );
    expect(getCanonicalKnowledgeContextHref(withBothTags)).toBe(
      "/explore?tagIds=first-crusade,matthew-5-9",
    );
    expect(
      getCanonicalKnowledgeContextHref(
        removeActiveTag(withBothTags, "matthew-5-9"),
      ),
    ).toBe("/goto/first-crusade");
    expect(
      getCanonicalKnowledgeContextHref(removeActiveTag(withScripture, "matthew-5-9")),
    ).toBe("/");
  });

  test("parses current route state into active Tags", () => {
    expect(
      getActiveTagsFromRoute({
        pathname: "/scripture/matthew-5-9",
        search: "",
      }),
    ).toMatchObject([{ id: "matthew-5-9", knowledgeType: "biblePassage" }]);
    expect(
      getActiveTagsFromRoute({
        pathname: "/goto/first-crusade",
        search: "",
      }),
    ).toMatchObject([{ id: "first-crusade", knowledgeType: "topic" }]);
    expect(
      getActiveTagsFromRoute({
        pathname: "/explore",
        search: "?tagIds=matthew-5-9,first-crusade",
      }).map((tag) => tag.id),
    ).toEqual(["first-crusade", "matthew-5-9"]);
  });

  test("derives location kind and loop context from the current route", () => {
    expect(getKnowledgeLocationKindFromRoute({ pathname: "/" })).toBe(
      "dashboard",
    );
    expect(
      getKnowledgeLocationKindFromRoute({ pathname: "/scripture/matthew-5-9" }),
    ).toBe("biblePassageReferent");
    expect(getKnowledgeLocationKindFromRoute({ pathname: "/goto/first-crusade" })).toBe(
      "referent",
    );
    expect(getKnowledgeLocationKindFromRoute({ pathname: "/explore" })).toBe(
      "context",
    );

    const loopState = getKnowledgeLoopStateFromRoute({
      pathname: "/explore",
      search: "?tagIds=matthew-5-9,first-crusade",
    });

    expect(loopState.locationKind).toBe("context");
    expect(loopState.contextKey).toBe("tags:first-crusade,matthew-5-9");
    expect(loopState.activeTags.map((tag) => tag.id)).toEqual([
      "first-crusade",
      "matthew-5-9",
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
        "?tagIds=matthew-5-9,first-crusade&knowledgeRequest=What%20does%20this%20mean",
    });
    const canonicalHref = getCanonicalKnowledgeContextHref(activeTags);

    expect(activeTags.map((tag) => tag.id)).toEqual([
      "first-crusade",
      "matthew-5-9",
    ]);
    expect(canonicalHref).toBe("/explore?tagIds=first-crusade,matthew-5-9");
    expect(canonicalHref).not.toContain("knowledgeRequest");
    expect(canonicalHref).not.toContain("What");
  });

  test("selection order does not affect Knowledge Context identity", () => {
    const firstSelection = [
      fixtureTag("matthew-5-9"),
      fixtureTag("first-crusade"),
      fixtureTag("boethius"),
    ];
    const secondSelection = [
      fixtureTag("boethius"),
      fixtureTag("matthew-5-9"),
      fixtureTag("first-crusade"),
    ];

    expect(getKnowledgeContextKey(firstSelection)).toBe(
      getKnowledgeContextKey(secondSelection),
    );
    expect(getCanonicalKnowledgeContextHref(firstSelection)).toBe(
      getCanonicalKnowledgeContextHref(secondSelection),
    );
    expect(getCanonicalKnowledgeContextHref(firstSelection)).toBe(
      "/explore?tagIds=boethius,first-crusade,matthew-5-9",
    );
  });

  test("resolves rendered tag labels to referent page hrefs", () => {
    expect(getReferentTagHref(resolveTagLabel("First Crusade"))).toBe(
      "/goto/first-crusade",
    );
    expect(getReferentTagHref(resolveTagLabel("Romans 8"))).toBe(
      "/scripture/romans-8",
    );
    expect(getReferentTagHref(resolveTagLabel("Suffering and hope"))).toBe(
      "/goto/suffering-and-hope",
    );
  });
});
