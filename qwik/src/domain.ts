export type KnowledgeType =
  | "words"
  | "biblePassage"
  | "topic"
  | "series"
  | "question"
  | "quote"
  | "sermon"
  | "essay"
  | "poem"
  | "song"
  | "book"
  | "shortStory"
  | "lesson"
  | "comment"
  | "prayerRequest"
  | "event"
  | "rsvp"
  | "person"
  | "organization"
  | "group"
  | "place";

export type AuthorableKnowledgeType = Exclude<KnowledgeType, "biblePassage">;

export type ActiveTag = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: KnowledgeType;
  label: string;
  passageString?: string;
};

export type PageId =
  | "dashboard"
  | "root-search"
  | "scripture"
  | "tag"
  | "explore-context"
  | "organization-home"
  | "organization-settings"
  | "smart-storage-playground"
  | "analytics"
  | "profile"
  | "settings"
  | "system-admin"
  | "notifications"
  | "calendar";

export type RouteDefinition = {
  href: string;
  id: PageId;
  label: string;
  pattern: string;
};

export type RouteState = {
  pathname: string;
  route: RouteDefinition;
  search: string;
};

export type AppAccessState =
  | { status: "unauthenticated" }
  | { email?: string; status: "inactiveUser"; userId: string }
  | { email?: string; status: "needsOrganization"; userId: string }
  | {
      email?: string;
      organizations: Array<{
        name: string;
        organizationEntryId: string;
        organizationKind: "school" | "church" | "family" | "community";
        organizationReferentId: string;
        role: string;
      }>;
      status: "allowed";
      systemRole?: "systemAdmin";
      userId: string;
    };

export type AnswerFeedItem =
  | {
      kind: "answer";
      entry: {
        contributor: { href?: string; id: string; name: string };
        contextPreviewTagLabels: string[];
        href: string;
        humanWeight?: number;
        id: string;
        knowledgeType: AuthorableKnowledgeType;
        previewText: string;
        primaryTagLabel: string;
        title: string;
        updatedAt: number;
      };
    }
  | {
      kind: "slot";
      slot: {
        contextPreviewTagLabels: string[];
        dueAt?: number;
        href: string;
        id: string;
        promptText?: string;
        requestedKnowledgeType: AuthorableKnowledgeType;
        status: "open" | "fulfilled" | "cancelled" | "overdue";
        targetLabel: string;
        title: string;
      };
    };

export type RootSearchResult = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: KnowledgeType;
  label: string;
  matchedEntryPreview?: {
    href: string;
    id: string;
    knowledgeType: AuthorableKnowledgeType;
    previewText: string;
    primaryTagLabel: string;
    title: string;
  };
  scopeLabel: string;
  tag: ActiveTag;
};

export type UserNotification = {
  body: string;
  contextHref: string;
  contextLabel: string;
  id: string;
  kind: "access" | "answer" | "event" | "knowledgeSlot" | "subscription";
  readAt?: number;
  receivedAt: number;
  status: "read" | "unread";
  title: string;
};

export const SAMPLE_ORG_ID = "arche-classical-academy";
export const SAMPLE_SCRIPTURE_PASSAGE = "joshua-1-6-9";
export const SAMPLE_CONTEXT_TAG_IDS = "first-crusade,matthew-5-9";

export const ROUTES: RouteDefinition[] = [
  { id: "dashboard", label: "Dashboard", href: "/", pattern: "/" },
  { id: "root-search", label: "Search Everything", href: "/search", pattern: "/search?q=" },
  { id: "scripture", label: "Bible Passage", href: `/scripture/${SAMPLE_SCRIPTURE_PASSAGE}`, pattern: "/scripture/:passageString" },
  { id: "tag", label: "Referent Page", href: "/goto/first-crusade", pattern: "/goto/:tagId" },
  { id: "explore-context", label: "Explore Context", href: `/explore?tagIds=${SAMPLE_CONTEXT_TAG_IDS}`, pattern: "/explore?tagIds=" },
  { id: "organization-home", label: "Organization Home", href: `/organizations/${SAMPLE_ORG_ID}`, pattern: "/organizations/:orgId" },
  { id: "organization-settings", label: "Organization Settings", href: `/organizations/${SAMPLE_ORG_ID}/settings`, pattern: "/organizations/:orgId/settings" },
  { id: "analytics", label: "Analytics", href: "/analytics", pattern: "/analytics" },
  { id: "smart-storage-playground", label: "Smart Storage", href: "/playground/smart-storage", pattern: "/playground/smart-storage" },
  { id: "profile", label: "Profile", href: "/profile", pattern: "/profile" },
  { id: "settings", label: "Settings", href: "/settings", pattern: "/settings" },
  { id: "notifications", label: "Notifications", href: "/notifications", pattern: "/notifications" },
  { id: "calendar", label: "Calendar", href: "/calendar", pattern: "/calendar" },
  { id: "system-admin", label: "System Admin", href: "/system-admin", pattern: "/system-admin" },
];

export const NAVIGATOR_TAG_FIXTURES: ActiveTag[] = [
  biblePassageTag("matthew-5-9", "Matthew 5:9"),
  biblePassageTag("joshua-1-6-9", "Joshua 1:6-9"),
  biblePassageTag("romans-8-28", "Romans 8:28"),
  biblePassageTag("daniel-3", "Daniel 3"),
  tagFixture("first-crusade", "First Crusade", "topic"),
  tagFixture("courage", "Courage", "topic"),
  tagFixture("boethius", "Boethius", "person"),
];

const TAGS_BY_ID = new Map(
  [
    ...NAVIGATOR_TAG_FIXTURES,
    tagFixture("arche-classical-academy", "Arche Classical Academy", "organization"),
    tagFixture("ruler-of-kings-church", "Ruler of Kings Church", "organization"),
    tagFixture("grade-9-church-history", "Grade 9 Church History", "group"),
    tagFixture("americas-founding-250", "250th Celebration of America's Founding", "event"),
  ].map((tag) => [tag.id, tag]),
);

export const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  words: "Words",
  biblePassage: "Bible Passage",
  topic: "Topic",
  series: "Series",
  question: "Question",
  quote: "Quote",
  sermon: "Sermon",
  essay: "Essay",
  poem: "Poem",
  song: "Song",
  book: "Book",
  shortStory: "Short Story",
  lesson: "Lesson",
  comment: "Comment",
  prayerRequest: "Prayer Request",
  event: "Event",
  rsvp: "RSVP",
  person: "Person",
  organization: "Organization",
  group: "Group",
  place: "Place",
};

export const CALENDAR_MONTH_LABEL = "June 2026";
export const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const CALENDAR_TODAY = 12;
export const CALENDAR_EVENTS = [
  { contextHref: "/goto/grade-9-church-history", contextLabel: "Grade 9 Church History", day: 12, groupLabel: "Upper School", id: "seminar-crusades", locationLabel: "Room 204", status: "confirmed" as const, timeLabel: "9:00 AM", title: "Crusades source seminar" },
  { contextHref: "/scripture/daniel-3", contextLabel: "Daniel 3", day: 18, groupLabel: "Bible", id: "daniel-memory", locationLabel: "Chapel", status: "draft" as const, timeLabel: "10:30 AM", title: "Daniel memory work" },
  { contextHref: "/goto/americas-founding-250", contextLabel: "250th Celebration", day: 24, groupLabel: "Community", id: "founding-planning", locationLabel: "Library", status: "confirmed" as const, timeLabel: "2:00 PM", title: "Founding celebration planning" },
];

export const TODAY_AGENDA_ITEMS = [
  { contextHref: "/scripture/joshua-1-6-9", contextLabel: "Joshua 1:6-9", detail: "Gather answers and quotes for morning assembly.", groupLabel: "Faculty", id: "assembly-courage", statusLabel: "Open", timeLabel: "8:15 AM", title: "Courage assembly preparation" },
  { contextHref: "/goto/first-crusade", contextLabel: "First Crusade", detail: "Review student questions and add one source note.", groupLabel: "History", id: "crusade-review", statusLabel: "Needs contribution", timeLabel: "11:00 AM", title: "History seminar follow-up" },
];

export function getInitialRouteState(): RouteState {
  if (typeof window === "undefined") {
    return { pathname: "/", route: routeById("dashboard"), search: "" };
  }
  return getRouteState(window.location);
}

export function getRouteState(location: Pick<Location, "pathname" | "search">): RouteState {
  return {
    pathname: location.pathname || "/",
    route: matchRoute(location.pathname || "/"),
    search: location.search || "",
  };
}

export function matchRoute(pathname: string) {
  if (pathname === "/search") return routeById("root-search");
  if (pathname.startsWith("/scripture/")) return routeById("scripture");
  if (pathname.startsWith("/goto/")) return routeById("tag");
  if (pathname === "/explore") return routeById("explore-context");
  if (/^\/organizations\/[^/]+\/settings\/?$/.test(pathname)) return routeById("organization-settings");
  if (pathname.startsWith("/organizations/")) return routeById("organization-home");
  if (pathname === "/playground/smart-storage") return routeById("smart-storage-playground");
  if (pathname === "/analytics") return routeById("analytics");
  if (pathname === "/profile") return routeById("profile");
  if (pathname === "/settings") return routeById("settings");
  if (pathname === "/notifications") return routeById("notifications");
  if (pathname === "/calendar") return routeById("calendar");
  if (pathname === "/system-admin") return routeById("system-admin");
  return routeById("dashboard");
}

export function routeById(id: PageId) {
  return ROUTES.find((route) => route.id === id) ?? ROUTES[0];
}

export function getActiveTagsFromRoute(routeState: Pick<RouteState, "pathname" | "search">): ActiveTag[] {
  const pathname = routeState.pathname.replace(/\/+$/, "") || "/";
  if (pathname === "/" || pathname === "/search") return [];
  if (pathname === "/explore") {
    const params = new URLSearchParams(routeState.search);
    return (params.get("tagIds") ?? "")
      .split(",")
      .map((tagId) => tagId.trim())
      .filter(Boolean)
      .map((tagId) => resolveTag(decodePathSegment(tagId)))
      .sort(compareTags);
  }
  if (pathname.startsWith("/scripture/")) return [resolveBiblePassageTag(decodePathSegment(pathname.slice("/scripture/".length)))];
  if (pathname.startsWith("/goto/")) return [resolveTag(decodePathSegment(pathname.slice("/goto/".length)))];
  if (pathname.startsWith("/organizations/")) return [resolveTag(decodePathSegment(pathname.split("/")[2] ?? SAMPLE_ORG_ID))];
  return [];
}

export function getKnowledgeContextKey(tags: ActiveTag[]) {
  const ids = [...new Set(tags.map((tag) => tag.id))].sort();
  return ids.length ? `tags:${ids.join(",")}` : "global";
}

export function getInactiveNavigatorTags(activeTags: ActiveTag[]) {
  const activeIds = new Set(activeTags.map((tag) => tag.id));
  return NAVIGATOR_TAG_FIXTURES.filter((tag) => !activeIds.has(tag.id));
}

export function addActiveTag(activeTags: ActiveTag[], tagToAdd: ActiveTag) {
  return [...new Map([...activeTags, tagToAdd].map((tag) => [tag.id, tag])).values()].sort(compareTags);
}

export function removeActiveTag(activeTags: ActiveTag[], tagId: string) {
  return activeTags.filter((tag) => tag.id !== tagId).sort(compareTags);
}

export function getCanonicalKnowledgeContextHref(tags: ActiveTag[]) {
  const activeTags = [...new Map(tags.map((tag) => [tag.id, tag])).values()].sort(compareTags);
  if (!activeTags.length) return "/";
  if (activeTags.length === 1) return activeTags[0].href;
  return `/explore?tagIds=${activeTags.map((tag) => encodeURIComponent(tag.id)).join(",")}`;
}

export function resolveTag(tagId: string): ActiveTag {
  return TAGS_BY_ID.get(tagId) ?? tagFixture(tagId, labelFromTagId(tagId), "words");
}

export function formatKnowledgeTypeLabel(knowledgeType: KnowledgeType) {
  return KNOWLEDGE_TYPE_LABELS[knowledgeType];
}

export function getScripturePassageString(pathname: string) {
  return pathname.startsWith("/scripture/") ? decodePathSegment(pathname.slice("/scripture/".length)) : "";
}

export function formatTimestamp(timestamp?: number) {
  return timestamp ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(timestamp)) : "No date";
}

export function getCalendarMonthCells() {
  return [...Array.from({ length: 1 }, () => null), ...Array.from({ length: 30 }, (_, index) => index + 1)];
}

function resolveBiblePassageTag(value: string): ActiveTag {
  const id = slugifyTagId(value);
  return TAGS_BY_ID.get(id) ?? biblePassageTag(id, labelFromTagId(id));
}

function biblePassageTag(id: string, label: string): ActiveTag {
  return { canonicalKey: id, href: `/scripture/${encodeURIComponent(id)}`, id, knowledgeType: "biblePassage", label, passageString: id };
}

function tagFixture(id: string, label: string, knowledgeType: AuthorableKnowledgeType): ActiveTag {
  return { canonicalKey: id, href: `/goto/${encodeURIComponent(id)}`, id, knowledgeType, label };
}

function compareTags(left: ActiveTag, right: ActiveTag) {
  return left.id.localeCompare(right.id);
}

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function slugifyTagId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "unknown";
}

function labelFromTagId(tagId: string) {
  return tagId.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || tagId;
}
