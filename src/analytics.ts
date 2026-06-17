import {
  getActiveTagsFromRoute,
  getKnowledgeContextKey,
  getKnowledgeLocationKindFromRoute,
  type ActiveTag,
  type KnowledgeRouteLocation,
} from "./knowledgeContext";

export type AnalyticsPageType = "dashboard" | "referent" | "context";
export type AnalyticsTargetKind = "dashboard" | "tag" | "biblePassage" | "context";
export type NavigatorUsageKind = "select" | "deselect" | "explore" | "contribute";

export type PageVisitAnalyticsInput = {
  pageType: AnalyticsPageType;
  rawPath: string;
  targetKey: string;
  targetKind: AnalyticsTargetKind;
};

export function getPageVisitAnalyticsInput(
  location: KnowledgeRouteLocation,
): PageVisitAnalyticsInput | null {
  const rawPath = `${location.pathname}${location.search ?? ""}`;
  const locationKind = getKnowledgeLocationKindFromRoute(location);
  const activeTags = getActiveTagsFromRoute(location);

  if (locationKind === "dashboard") {
    if (normalizePathname(location.pathname) !== "/") {
      return null;
    }

    return {
      pageType: "dashboard",
      rawPath,
      targetKey: "global",
      targetKind: "dashboard",
    };
  }

  if (locationKind === "context") {
    return {
      pageType: "context",
      rawPath,
      targetKey: getKnowledgeContextKey(activeTags),
      targetKind: "context",
    };
  }

  const activeTag = activeTags[0];
  if (!activeTag) {
    return null;
  }

  return {
    pageType: "referent",
    rawPath,
    targetKey: activeTag.canonicalKey,
    targetKind: activeTag.knowledgeType === "biblePassage" ? "biblePassage" : "tag",
  };
}

export function getNavigatorAnalyticsTagKeys(activeTags: ActiveTag[]) {
  return activeTags.map((tag) => tag.canonicalKey).sort(compareStrings);
}

function normalizePathname(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "") || "/";
}

function compareStrings(left: string, right: string) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
