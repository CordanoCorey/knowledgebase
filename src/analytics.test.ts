import { describe, expect, test } from "vitest";
import {
  getNavigatorAnalyticsTagKeys,
  getPageVisitAnalyticsInput,
} from "./analytics";
import { NAVIGATOR_TAG_FIXTURES } from "./knowledgeContext";

describe("analytics route inputs", () => {
  test("records only the canonical dashboard route as the global dashboard", () => {
    expect(getPageVisitAnalyticsInput({ pathname: "/" })).toEqual({
      pageType: "dashboard",
      rawPath: "/",
      targetKey: "global",
      targetKind: "dashboard",
    });
    expect(
      getPageVisitAnalyticsInput({
        pathname: "/",
        search: "?from=notification",
      }),
    ).toEqual({
      pageType: "dashboard",
      rawPath: "/?from=notification",
      targetKey: "global",
      targetKind: "dashboard",
    });
    expect(getPageVisitAnalyticsInput({ pathname: "/search" })).toBeNull();
    expect(getPageVisitAnalyticsInput({ pathname: "/profile" })).toBeNull();
  });

  test("classifies Bible Passage and other Referent pages", () => {
    expect(
      getPageVisitAnalyticsInput({
        pathname: "/scripture/romans-8-28",
        search: "?tagIds=ignored",
      }),
    ).toEqual({
      pageType: "referent",
      rawPath: "/scripture/romans-8-28?tagIds=ignored",
      targetKey: "romans-8-28",
      targetKind: "biblePassage",
    });
    expect(getPageVisitAnalyticsInput({ pathname: "/goto/first-crusade" })).toEqual({
      pageType: "referent",
      rawPath: "/goto/first-crusade",
      targetKey: "first-crusade",
      targetKind: "tag",
    });
  });

  test("uses canonical sorted Tag keys for multi-Tag Context pages", () => {
    expect(
      getPageVisitAnalyticsInput({
        pathname: "/explore",
        search: "?tagIds=matthew-5-9,first-crusade",
      }),
    ).toEqual({
      pageType: "context",
      rawPath: "/explore?tagIds=matthew-5-9,first-crusade",
      targetKey: "tags:first-crusade,matthew-5-9",
      targetKind: "context",
    });
  });

  test("sorts Navigator analytics Tag keys without mutating the active Tags", () => {
    const activeTags = [
      NAVIGATOR_TAG_FIXTURES.find((tag) => tag.id === "romans-8-28")!,
      NAVIGATOR_TAG_FIXTURES.find((tag) => tag.id === "first-crusade")!,
      NAVIGATOR_TAG_FIXTURES.find((tag) => tag.id === "matthew-5-9")!,
    ];

    expect(getNavigatorAnalyticsTagKeys(activeTags)).toEqual([
      "first-crusade",
      "matthew-5-9",
      "romans-8-28",
    ]);
    expect(activeTags.map((tag) => tag.id)).toEqual([
      "romans-8-28",
      "first-crusade",
      "matthew-5-9",
    ]);
  });
});
