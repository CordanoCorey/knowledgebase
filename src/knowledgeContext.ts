import { parseBiblePassageReference } from "../convex/lib/scriptureReferences";
import type {
  ActiveTag,
  AuthorableKnowledgeType,
  KnowledgeLocationKind,
  KnowledgeLoopState,
  KnowledgeRequestDraft,
  KnowledgeType,
} from "./knowledgeContracts";

export type {
  ActiveTag,
  KnowledgeLocationKind,
  KnowledgeLoopState,
  KnowledgeRequestDraft,
  KnowledgeType,
} from "./knowledgeContracts";

export type KnowledgeRouteLocation = {
  pathname: string;
  search?: string;
};

export const NAVIGATOR_TAG_FIXTURES: ActiveTag[] = [
  biblePassageTag("romans-8-28", "Romans 8:28"),
  biblePassageTag("john-3-16", "John 3:16"),
  tagFixture("holy-spirit", "Holy Spirit", "topic"),
  tagFixture("atonement", "Atonement", "topic"),
  tagFixture("christian-education", "Christian Education", "topic"),
  tagFixture("narnia", "Narnia", "series"),
];

const TAGS_BY_ID = new Map(
  NAVIGATOR_TAG_FIXTURES.map((tag) => [tag.id, tag]),
);

export function getActiveTagsFromRoute(
  location: KnowledgeRouteLocation,
): ActiveTag[] {
  const pathname = normalizePathname(location.pathname);

  if (pathname === "/") {
    return [];
  }

  if (pathname === "/explore") {
    return getTagsFromExploreSearch(location.search ?? "");
  }

  if (pathname.startsWith("/scripture/")) {
    return [resolveBiblePassageTag(decodePathSegment(pathname.slice(11)))];
  }

  if (pathname.startsWith("/goto/")) {
    return [resolveTag(decodePathSegment(pathname.slice(6)))];
  }

  return [];
}

export function getKnowledgeLocationKindFromRoute(
  location: KnowledgeRouteLocation,
): KnowledgeLocationKind {
  const pathname = normalizePathname(location.pathname);

  if (pathname === "/") {
    return "dashboard";
  }

  if (pathname === "/explore") {
    return "context";
  }

  if (pathname === "/scripture" || pathname.startsWith("/scripture/")) {
    return "biblePassageReferent";
  }

  if (pathname === "/goto" || pathname.startsWith("/goto/")) {
    return "referent";
  }

  return "dashboard";
}

export function createKnowledgeRequestDraft(
  text = "",
): KnowledgeRequestDraft {
  return {
    text,
    mappedTags: [],
    mappingStatus: "idle",
  };
}

export function getKnowledgeLoopStateFromRoute(
  location: KnowledgeRouteLocation,
): KnowledgeLoopState {
  const activeTags = getActiveTagsFromRoute(location);

  return {
    activeTags,
    contextKey: getKnowledgeContextKey(activeTags),
    locationKind: getKnowledgeLocationKindFromRoute(location),
    requestDraft: createKnowledgeRequestDraft(),
  };
}

export function getCanonicalKnowledgeContextHref(tags: ActiveTag[]) {
  const activeTags = sortTagsById(dedupeTags(tags));

  if (activeTags.length === 0) {
    return "/";
  }

  if (activeTags.length === 1) {
    return getSingleTagHref(activeTags[0]);
  }

  const tagIds = activeTags.map((tag) => encodeURIComponent(tag.id)).join(",");
  return `/explore?tagIds=${tagIds}`;
}

export function getKnowledgeContextKey(tags: ActiveTag[]) {
  const tagIds = sortTagIds(tags.map((tag) => tag.id));
  return tagIds.length > 0 ? `tags:${tagIds.join(",")}` : "global";
}

export function addActiveTag(activeTags: ActiveTag[], tagToAdd: ActiveTag) {
  return sortTagsById(dedupeTags([...activeTags, tagToAdd]));
}

export function removeActiveTag(activeTags: ActiveTag[], tagId: string) {
  return sortTagsById(activeTags.filter((tag) => tag.id !== tagId));
}

export function getInactiveNavigatorTags(activeTags: ActiveTag[]) {
  const activeTagIds = new Set(activeTags.map((tag) => tag.id));
  return NAVIGATOR_TAG_FIXTURES.filter((tag) => !activeTagIds.has(tag.id));
}

export function resolveTag(tagId: string): ActiveTag {
  return TAGS_BY_ID.get(tagId) ?? tagFixture(tagId, labelFromTagId(tagId), "words");
}

export function sortTagIds(tagIds: string[]) {
  return Array.from(new Set(tagIds)).sort(compareTagIds);
}

function getTagsFromExploreSearch(search: string) {
  const params = new URLSearchParams(search);
  const tagIds = params
    .get("tagIds")
    ?.split(",")
    .map((tagId) => decodePathSegment(tagId).trim())
    .filter(Boolean);

  if (!tagIds) {
    return [];
  }

  return sortTagsById(tagIds.map(resolveTag));
}

function getSingleTagHref(tag: ActiveTag) {
  if (tag.knowledgeType === "biblePassage") {
    return `/scripture/${encodeURIComponent(tag.passageString ?? tag.id)}`;
  }

  return `/goto/${encodeURIComponent(tag.id)}`;
}

function resolveBiblePassageTag(passageString: string): ActiveTag {
  const parsedPassage = parseBiblePassageReference(passageString);
  if (!parsedPassage) {
    const id = slugifyTagId(passageString);
    return biblePassageTag(id, passageString || "Scripture");
  }

  return (
    TAGS_BY_ID.get(parsedPassage.slug) ??
    biblePassageTag(parsedPassage.slug, parsedPassage.label)
  );
}

function biblePassageTag(id: string, label: string): ActiveTag {
  return {
    canonicalKey: id,
    href: `/scripture/${encodeURIComponent(id)}`,
    id,
    knowledgeType: "biblePassage",
    label,
    passageString: id,
  };
}

function tagFixture(
  id: string,
  label: string,
  knowledgeType: AuthorableKnowledgeType,
): ActiveTag {
  return {
    canonicalKey: id,
    href: `/goto/${encodeURIComponent(id)}`,
    id,
    knowledgeType,
    label,
  };
}

function dedupeTags(tags: ActiveTag[]) {
  const tagsById = new Map<string, ActiveTag>();
  for (const tag of tags) {
    if (!tagsById.has(tag.id)) {
      tagsById.set(tag.id, tag);
    }
  }

  return Array.from(tagsById.values());
}

function sortTagsById(tags: ActiveTag[]) {
  return [...tags].sort((left, right) => compareTagIds(left.id, right.id));
}

function compareTagIds(left: string, right: string) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function normalizePathname(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "") || "/";
}

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function slugifyTagId(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "unknown";
}

function labelFromTagId(tagId: string) {
  return tagId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || tagId;
}
