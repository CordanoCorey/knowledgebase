import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ElementType,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { flushSync } from "react-dom";
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Clock,
  Compass,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  Moon,
  MousePointerClick,
  Plus,
  Search,
  Settings,
  Tag,
  TrendingUp,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import { parseBiblePassageReference } from "../convex/lib/scriptureReferences";
import { AuthPanel, SignOutButton } from "./auth/AuthPanel";
import { OrganizationAccessRequestScreen } from "./auth/OrganizationAccessRequest";
import archePressIconUrl from "./assets/arche-press_icon-full.svg";
import archePressHorizontalLogoDarkUrl from "./assets/arche-press_logo-horizontal-full-dark.svg";
import archePressHorizontalLogoUrl from "./assets/arche-press_logo-horizontal-full.svg";
import profilePlaceholderUrl from "./assets/profile-placeholder.png";
import { AnswerFeed as AnswerFeedSurface } from "./AnswerFeed";
import { ContributionEditor as ContributionEditorSurface } from "./ContributionEditor";
import { KnowledgeRequestComposer } from "./KnowledgeRequestComposer";
import { Presence } from "./Presence";
import {
  getNavigatorAnalyticsTagKeys,
  getPageVisitAnalyticsInput,
  type NavigatorUsageKind,
} from "./analytics";
import { KnowledgeSlotCard } from "./components/KnowledgeCards";
import { KnowledgeTypeOverview } from "./components/KnowledgeTypeOverview";
import {
  ANSWER_FEED_FIXTURE,
  type AnswerFeedFixtureItem,
  getFixtureContextTags,
  getPrimarySlotItemForContext,
  isAnswerFeedSlot,
  selectAnswerFeedItems,
} from "./answerFeedData";
import {
  addActiveTag,
  getActiveTagsFromRoute,
  getCanonicalKnowledgeContextHref,
  getInactiveNavigatorTags,
  getKnowledgeContextKey,
  removeActiveTag,
} from "./knowledgeContext";
import type { ActiveTag } from "./knowledgeContext";
import type {
  AuthorableKnowledgeType,
  ContributionInput,
  ContributionResult,
  KnowledgeSlotSummary,
} from "./knowledgeContracts";
import { LayoutPrototype } from "./prototypes/LayoutPrototype";

const THEME_STORAGE_KEY = "knowledgebase-theme";

const SAMPLE_TAG_ID = "holy-spirit";
const SAMPLE_ORG_ID = "my-church";
const SAMPLE_CONTEXT_TAG_IDS = "holy-spirit,romans-8-28";
const SAMPLE_SCRIPTURE_PASSAGE = "john-3-16";
const MAX_PASSAGE_SUGGESTIONS = 5;

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    skipTransition: () => void;
    updateCallbackDone: Promise<void>;
  };
};

type ThemePreference = "light" | "dark";

type PageId =
  | "dashboard"
  | "scripture"
  | "tag"
  | "explore-context"
  | "organization-home"
  | "organization-settings"
  | "analytics"
  | "profile"
  | "settings"
  | "notifications"
  | "calendar";

type CoreComponentId =
  | "knowledge-navigator"
  | "answer-feed"
  | "knowledge-request-composer"
  | "contribution-editor"
  | "knowledge-entry-card"
  | "knowledge-slot-card";

type RouteDefinition = {
  components: CoreComponentId[];
  href: string;
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  id: PageId;
  label: string;
  pattern: string;
  relatedRouteIds?: PageId[];
};

type RouteState = {
  route: RouteDefinition;
  pathname: string;
  search: string;
};

type AllowedAppAccess = {
  email?: string;
  organizations: Array<{
    name: string;
    organizationKind: string;
    organizationReferentId: string;
    role: string;
  }>;
  status: "allowed";
  userId: string;
};

type CalendarEvent = {
  contextHref: string;
  contextLabel: string;
  day: number;
  groupLabel: string;
  id: string;
  locationLabel: string;
  status: "confirmed" | "draft";
  timeLabel: string;
  title: string;
};

type NotificationFilter = "all" | "unread" | "knowledgeSlots" | "events";

type NotificationKind = "answer" | "event" | "knowledgeSlot" | "subscription";

type NotificationStatus = "read" | "unread";

type UserNotification = {
  body: string;
  contextHref: string;
  contextLabel: string;
  id: string;
  kind: NotificationKind;
  receivedAt: number;
  status: NotificationStatus;
  title: string;
};

const ROUTES: RouteDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    pattern: "/",
    icon: LayoutDashboard,
    components: [
      "knowledge-navigator",
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "scripture",
    label: "Bible Passage",
    href: `/scripture/${SAMPLE_SCRIPTURE_PASSAGE}`,
    pattern: "/scripture/:passageString",
    icon: BookOpen,
    components: [
      "knowledge-navigator",
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "tag",
    label: "Referent Page",
    href: `/goto/${SAMPLE_TAG_ID}`,
    pattern: "/goto/:tagId",
    icon: Tag,
    components: [
      "knowledge-navigator",
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "explore-context",
    label: "Explore Context",
    href: `/explore?tagIds=${SAMPLE_CONTEXT_TAG_IDS}`,
    pattern: "/explore?tagIds=",
    icon: Compass,
    components: [
      "knowledge-navigator",
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "organization-home",
    label: "Organization Home",
    href: `/orgs/${SAMPLE_ORG_ID}`,
    pattern: "/orgs/:orgId",
    icon: Landmark,
    components: [
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "organization-settings",
    label: "Organization Settings",
    href: `/orgs/${SAMPLE_ORG_ID}/settings`,
    pattern: "/orgs/:orgId/settings",
    icon: Settings,
    components: [],
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    pattern: "/analytics",
    icon: BarChart3,
    components: [],
    relatedRouteIds: ["dashboard", "explore-context", "scripture"],
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    pattern: "/profile",
    icon: UserCircle,
    components: [
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
    relatedRouteIds: ["calendar", "settings", "notifications"],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    pattern: "/settings",
    icon: Settings,
    components: [],
    relatedRouteIds: ["profile", "notifications"],
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    pattern: "/notifications",
    icon: Bell,
    components: [],
    relatedRouteIds: ["profile", "settings"],
  },
  {
    id: "calendar",
    label: "Calendar",
    href: "/calendar",
    pattern: "/calendar",
    icon: CalendarDays,
    components: [],
    relatedRouteIds: ["explore-context", "organization-home", "profile"],
  },
];

const ROUTE_BY_ID = new Map(ROUTES.map((route) => [route.id, route]));
const PRIMARY_ROUTE_IDS: PageId[] = [
  "dashboard",
  "tag",
  "explore-context",
  "organization-home",
];
const USER_ROUTE_IDS: PageId[] = ["analytics", "calendar", "settings"];

const CALENDAR_MONTH_LABEL = "June 2026";
const CALENDAR_DAY_COUNT = 30;
const CALENDAR_START_WEEKDAY_INDEX = 1;
const CALENDAR_TODAY = 12;
const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: "teachers-planning",
    day: 3,
    title: "Logic II planning",
    timeLabel: "9:00 AM",
    locationLabel: "Faculty room",
    groupLabel: "Upper school teachers",
    contextLabel: "Organization Home",
    contextHref: `/orgs/${SAMPLE_ORG_ID}`,
    status: "confirmed",
  },
  {
    id: "scripture-seminar",
    day: 8,
    title: "Romans 8 seminar",
    timeLabel: "1:30 PM",
    locationLabel: "Library",
    groupLabel: "Bible faculty",
    contextLabel: "Romans 8:28",
    contextHref: `/scripture/${SAMPLE_SCRIPTURE_PASSAGE}`,
    status: "confirmed",
  },
  {
    id: "community-review",
    day: 12,
    title: "Community Q&A review",
    timeLabel: "10:00 AM",
    locationLabel: "Main office",
    groupLabel: "Knowledge stewards",
    contextLabel: "Holy Spirit",
    contextHref: `/goto/${SAMPLE_TAG_ID}`,
    status: "confirmed",
  },
  {
    id: "curriculum-sync",
    day: 18,
    title: "Curriculum sync",
    timeLabel: "2:15 PM",
    locationLabel: "Conference room",
    groupLabel: "Humanities team",
    contextLabel: "Explore Context",
    contextHref: `/explore?tagIds=${SAMPLE_CONTEXT_TAG_IDS}`,
    status: "draft",
  },
  {
    id: "knowledge-slot-triage",
    day: 25,
    title: "Knowledge Slot triage",
    timeLabel: "11:30 AM",
    locationLabel: "Remote",
    groupLabel: "Editorial team",
    contextLabel: "Organization Home",
    contextHref: `/orgs/${SAMPLE_ORG_ID}`,
    status: "confirmed",
  },
];

const USER_NOTIFICATIONS: UserNotification[] = [
  {
    id: "notice-slot-romans-8-spirit-lesson",
    title: "Lesson on Romans 8 and the Holy Spirit is due soon",
    body:
      "A Knowledge Slot assigned to Open to My Church is still waiting for a future Answer.",
    contextLabel: "Romans 8:28 + Holy Spirit",
    contextHref: `/explore?tagIds=${SAMPLE_CONTEXT_TAG_IDS}`,
    kind: "knowledgeSlot",
    receivedAt: Date.UTC(2026, 5, 12, 13, 12),
    status: "unread",
  },
  {
    id: "notice-entry-romans-8-spirit-sermon",
    title: "Romans 8 and Life in the Spirit was added",
    body:
      "A new Sermon entered a Knowledge Context you are subscribed to.",
    contextLabel: "Romans 8:28",
    contextHref: `/goto/${SAMPLE_TAG_ID}`,
    kind: "answer",
    receivedAt: Date.UTC(2026, 5, 12, 12, 35),
    status: "unread",
  },
  {
    id: "notice-community-review",
    title: "Community Q&A review was confirmed",
    body:
      "The Knowledge stewards event on your calendar has a confirmed time and place.",
    contextLabel: "Calendar",
    contextHref: "/calendar",
    kind: "event",
    receivedAt: Date.UTC(2026, 5, 11, 19, 10),
    status: "unread",
  },
  {
    id: "notice-atonement-note",
    title: "A Short Note on Atonement received new activity",
    body:
      "A subscribed Knowledge Context has an updated Answer available for review.",
    contextLabel: "Atonement",
    contextHref: "/explore?tagIds=atonement",
    kind: "subscription",
    receivedAt: Date.UTC(2026, 5, 10, 15, 44),
    status: "read",
  },
];

const NOTIFICATION_FILTERS: Array<{
  id: NotificationFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "knowledgeSlots", label: "Knowledge Slots" },
  { id: "events", label: "Events" },
];

const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  answer: "Answer",
  event: "Event",
  knowledgeSlot: "Knowledge Slot",
  subscription: "Subscription",
};

const NOTIFICATION_TIME_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const appAccess = useQuery(
    api.appAccess.getCurrentUserAccess,
    isAuthenticated && !isLoading ? {} : "skip",
  );
  const recordPageVisit = useMutation(api.analytics.recordPageVisit);
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);
  const [routeState, setRouteState] = useState<RouteState>(() => getRouteState(window.location));
  const [routeMotionKey, setRouteMotionKey] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Keep the in-session toggle working even when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    function handlePopState() {
      commitRouteState(getRouteState(window.location));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (appAccess?.status !== "allowed") {
      return;
    }

    const pageVisit = getPageVisitAnalyticsInput(routeState);
    if (!pageVisit) {
      return;
    }

    void recordPageVisit(pageVisit).catch(() => undefined);
  }, [
    appAccess?.status,
    recordPageVisit,
    routeState.pathname,
    routeState.search,
  ]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    navigateToHref(href);
  }

  function navigateToHref(href: string) {
    const nextUrl = new URL(href, window.location.href);
    if (
      nextUrl.pathname === window.location.pathname &&
      nextUrl.search === window.location.search
    ) {
      return;
    }

    window.history.pushState({}, "", href);
    commitRouteState(getRouteState(window.location));
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  function goToDashboard() {
    window.history.replaceState({}, "", "/");
    commitRouteState(getRouteState(window.location));
  }

  function commitRouteState(nextRouteState: RouteState) {
    setRouteStateWithTransition(nextRouteState, setRouteState, () => {
      setRouteMotionKey((currentKey) => currentKey + 1);
    });
  }

  if (isLayoutPrototypeRoute()) {
    return <LayoutPrototype onToggleTheme={toggleTheme} theme={theme} />;
  }

  if (isLoading) {
    return (
      <main className="kb-auth-page" data-theme={theme} aria-busy="true">
        <section className="editor-panel editor-loading">
          <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          <span>Checking session</span>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="kb-auth-page" data-theme={theme}>
        <AuthPanel
          onSignInComplete={goToDashboard}
          redirectTo="/"
          surface="app"
        />
      </main>
    );
  }

  if (appAccess === undefined) {
    return (
      <main className="kb-auth-page" data-theme={theme} aria-busy="true">
        <section className="editor-panel editor-loading">
          <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          <span>Checking organization access</span>
        </section>
      </main>
    );
  }

  if (appAccess.status !== "allowed") {
    return (
      <main className="kb-auth-page" data-theme={theme}>
        <OrganizationAccessRequestScreen
          email={"email" in appAccess ? appAccess.email : undefined}
          reason={appAccess.status}
          surface="app"
        />
      </main>
    );
  }

  return (
    <KnowledgebaseShell
      activePageId={routeState.route.id}
      onNavigate={navigate}
      onNavigateToHref={navigateToHref}
      onToggleTheme={toggleTheme}
      routeState={routeState}
      routeMotionKey={routeMotionKey}
      theme={theme}
    >
      <PageScaffold
        appAccess={appAccess}
        onNavigate={navigate}
        onNavigateToHref={navigateToHref}
        onToggleTheme={toggleTheme}
        routeState={routeState}
        theme={theme}
      />
    </KnowledgebaseShell>
  );
}

function getRouteState(location: Location): RouteState {
  const pathname = normalizePathname(location.pathname);
  return {
    route: matchRoute(pathname),
    pathname,
    search: location.search,
  };
}

function setRouteStateWithTransition(
  nextRouteState: RouteState,
  setRouteState: (nextRouteState: RouteState) => void,
  onFallbackTransition: () => void,
) {
  if (!canStartRouteViewTransition()) {
    setRouteState(nextRouteState);
    onFallbackTransition();
    return;
  }

  const startViewTransition = (document as ViewTransitionDocument).startViewTransition;
  if (typeof startViewTransition !== "function") {
    setRouteState(nextRouteState);
    onFallbackTransition();
    return;
  }

  try {
    startViewTransition.call(document, () => {
      flushSync(() => setRouteState(nextRouteState));
    });
  } catch {
    setRouteState(nextRouteState);
    onFallbackTransition();
  }
}

function canStartRouteViewTransition() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }

  return (
    typeof (document as ViewTransitionDocument).startViewTransition === "function" &&
    (typeof window.matchMedia !== "function" ||
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

function normalizePathname(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "") || "/";
}

function matchRoute(pathname: string) {
  if (pathname === "/") {
    return getRoute("dashboard");
  }

  if (pathname === "/explore") {
    return getRoute("explore-context");
  }

  if (pathname === "/scripture" || pathname.startsWith("/scripture/")) {
    return getRoute("scripture");
  }

  if (pathname === "/goto" || pathname.startsWith("/goto/")) {
    return getRoute("tag");
  }

  if (/^\/orgs\/[^/]+\/settings$/.test(pathname)) {
    return getRoute("organization-settings");
  }

  if (pathname.startsWith("/orgs/")) {
    return getRoute("organization-home");
  }

  const staticRoute = ROUTES.find(
    (route) => route.href.split("?")[0] === pathname && route.id !== "tag",
  );
  if (staticRoute) {
    return staticRoute;
  }

  return getRoute("dashboard");
}

function getRoute(pageId: PageId) {
  const route = ROUTE_BY_ID.get(pageId);
  if (!route) {
    throw new Error(`Missing route definition for ${pageId}`);
  }

  return route;
}

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function isLayoutPrototypeRoute() {
  return (
    !import.meta.env.PROD &&
    new URLSearchParams(window.location.search).get("prototype") === "layout"
  );
}

function KnowledgebaseShell({
  activePageId,
  children,
  onNavigate,
  onNavigateToHref,
  onToggleTheme,
  routeMotionKey,
  routeState,
  theme,
}: {
  activePageId: PageId;
  children: ReactNode;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  onToggleTheme: () => void;
  routeMotionKey: number;
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const routeMotionClassName =
    routeMotionKey % 2 === 0 ? "kb-route-motion-a" : "kb-route-motion-b";

  return (
    <div className="kb-shell" data-theme={theme}>
      <Sidebar activePageId={activePageId} onNavigate={onNavigate} />
      <div className="kb-host-column">
        <TopBar
          onNavigate={onNavigate}
          onNavigateToHref={onNavigateToHref}
          onToggleTheme={onToggleTheme}
          routeState={routeState}
          theme={theme}
        />
        <div className="kb-host-content">
          <div className={`kb-route-transition ${routeMotionClassName}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  activePageId,
  onNavigate,
}: {
  activePageId: PageId;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return (
    <aside className="kb-sidebar" aria-label="Primary navigation">
      <a
        className="kb-logo-button"
        href="/"
        aria-label="Dashboard"
        onClick={(event) => onNavigate(event, "/")}
        title="Dashboard"
      >
        <BrandMark />
      </a>

      <nav className="kb-nav-stack kb-route-nav" aria-label="Routes">
        {PRIMARY_ROUTE_IDS.map((pageId) => {
          const isActive =
            pageId === activePageId ||
            (pageId === "organization-home" &&
              activePageId === "organization-settings");

          return (
            <RouteNavLink
              active={isActive}
              key={pageId}
              onNavigate={onNavigate}
              route={getRoute(pageId)}
            />
          );
        })}
      </nav>

      <nav className="kb-nav-stack kb-user-route-nav" aria-label="User routes">
        {USER_ROUTE_IDS.map((pageId) => (
          <RouteNavLink
            active={pageId === activePageId}
            key={pageId}
            onNavigate={onNavigate}
            route={getRoute(pageId)}
          />
        ))}
        <span className="kb-nav-divider" aria-hidden="true" />
        <ProfileRouteLink active={activePageId === "profile"} onNavigate={onNavigate} />
      </nav>
    </aside>
  );
}

function RouteNavLink({
  active,
  onNavigate,
  route,
}: {
  active: boolean;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  route: RouteDefinition;
}) {
  const Icon = route.icon;

  return (
    <a
      aria-current={active ? "page" : undefined}
      aria-label={route.label}
      className={active ? "kb-nav-button kb-nav-button-active" : "kb-nav-button"}
      href={route.href}
      onClick={(event) => onNavigate(event, route.href)}
      title={route.label}
    >
      <Icon aria-hidden="true" />
    </a>
  );
}

function ProfileRouteLink({
  active,
  onNavigate,
}: {
  active: boolean;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const profileRoute = getRoute("profile");

  return (
    <a
      aria-current={active ? "page" : undefined}
      aria-label={profileRoute.label}
      className={active ? "kb-avatar-link kb-avatar-link-active" : "kb-avatar-link"}
      href={profileRoute.href}
      onClick={(event) => onNavigate(event, profileRoute.href)}
      title={profileRoute.label}
    >
      <img className="kb-avatar-photo" src={profilePlaceholderUrl} alt="" aria-hidden="true" />
      <span className="kb-avatar-status" aria-hidden="true" />
    </a>
  );
}

function TopBar({
  onNavigate,
  onNavigateToHref,
  onToggleTheme,
  routeState,
  theme,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  onToggleTheme: () => void;
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const nextTheme = theme === "dark" ? "light" : "dark";
  const brandLogoUrl =
    theme === "dark" ? archePressHorizontalLogoDarkUrl : archePressHorizontalLogoUrl;
  const trimmedSearchQuery = searchQuery.trim();
  const suggestions = useMemo(
    () => getPassageSuggestions(trimmedSearchQuery, 4),
    [trimmedSearchQuery],
  );
  const isSuggestionListOpen =
    isSearchFocused && trimmedSearchQuery.length > 0 && suggestions.length > 0;

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [suggestions[0]?.href]);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.currentTarget.value);
  }

  function handleSearchBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsSearchFocused(false);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isSuggestionListOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        Math.min(currentIndex + 1, suggestions.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === "Escape") {
      setIsSearchFocused(false);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = suggestions[activeSuggestionIndex];
      if (suggestion) {
        navigateToSuggestion(suggestion.href);
      }
    }
  }

  function navigateToSuggestion(href: string) {
    onNavigateToHref(href);
    setSearchQuery("");
    setIsSearchFocused(false);
  }

  function handleSuggestionClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    onNavigate(event, href);
    setSearchQuery("");
    setIsSearchFocused(false);
  }

  return (
    <header className="kb-topbar">
      <a
        className="kb-brand"
        href="/"
        aria-label="Go to dashboard"
        onClick={(event) => onNavigate(event, "/")}
      >
        <img
          className="kb-brand-logo kb-brand-logo-horizontal"
          src={brandLogoUrl}
          alt=""
          aria-hidden="true"
        />
      </a>
      <div className="kb-topbar-actions">
        <button
          aria-label={`Switch to ${nextTheme} theme`}
          aria-pressed={theme === "dark"}
          className="kb-icon-button kb-theme-button"
          onClick={onToggleTheme}
          title={`Switch to ${nextTheme} theme`}
          type="button"
        >
          <Moon aria-hidden="true" />
        </button>
        <a
          aria-current={routeState.route.id === "notifications" ? "page" : undefined}
          aria-label="Notifications"
          className={
            routeState.route.id === "notifications"
              ? "kb-icon-button kb-topbar-link kb-topbar-link-active"
              : "kb-icon-button kb-topbar-link"
          }
          href="/notifications"
          onClick={(event) => onNavigate(event, "/notifications")}
          title="Notifications"
        >
          <Bell aria-hidden="true" />
        </a>
        <SignOutButton />
        <div className="kb-search-wrap" onBlur={handleSearchBlur}>
          <label className="kb-search">
            <Search aria-hidden="true" />
            <input
              aria-activedescendant={
                isSuggestionListOpen
                  ? `kb-search-suggestion-${activeSuggestionIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-controls="kb-search-suggestions"
              aria-expanded={isSuggestionListOpen}
              onChange={handleSearchChange}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search Scripture, people, topics, etc."
              type="text"
              value={searchQuery}
            />
          </label>
          <Presence present={isSuggestionListOpen}>
            {(presenceState) => (
              <div
                className="kb-search-suggestions"
                data-presence={presenceState}
                id="kb-search-suggestions"
                role="listbox"
              >
                {suggestions.map((suggestion, index) => (
                  <a
                    aria-selected={index === activeSuggestionIndex}
                    href={suggestion.href}
                    id={`kb-search-suggestion-${index}`}
                    key={suggestion.href}
                    onClick={(event) => handleSuggestionClick(event, suggestion.href)}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    role="option"
                  >
                    <BookOpen aria-hidden="true" />
                    <span>{suggestion.label}</span>
                    <small>Bible Passage</small>
                  </a>
                ))}
              </div>
            )}
          </Presence>
        </div>
      </div>
    </header>
  );
}

function PageScaffold({
  appAccess,
  onNavigate,
  onNavigateToHref,
  onToggleTheme,
  routeState,
  theme,
}: {
  appAccess: AllowedAppAccess;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  onToggleTheme: () => void;
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const { route } = routeState;
  const activeTags = getActiveTagsFromRoute(routeState);
  if (route.id === "scripture") {
    return (
      <BiblePassagePage
        onNavigateToHref={onNavigateToHref}
        routeState={routeState}
      />
    );
  }

  if (route.id === "settings") {
    return (
      <SettingsPage
        appAccess={appAccess}
        onNavigate={onNavigate}
        onToggleTheme={onToggleTheme}
        routeState={routeState}
        theme={theme}
      />
    );
  }

  if (route.id === "analytics") {
    return <AnalyticsPage onNavigate={onNavigate} routeState={routeState} />;
  }

  if (route.id === "calendar") {
    return <CalendarPage onNavigate={onNavigate} routeState={routeState} />;
  }

  if (route.id === "notifications") {
    return <NotificationsPage onNavigate={onNavigate} routeState={routeState} />;
  }

  if (route.id === "profile") {
    return (
      <ProfilePage
        appAccess={appAccess}
        onNavigate={onNavigate}
        routeState={routeState}
      />
    );
  }

  if (route.id === "organization-settings") {
    return (
      <OrganizationSettingsPage
        onNavigate={onNavigate}
        routeState={routeState}
      />
    );
  }

  const hasNavigator = route.components.includes("knowledge-navigator");
  const hasWorkingLayout = route.components.length > 0;

  return (
    <main className="kb-main kb-scaffold-main" aria-labelledby="kb-route-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Route scaffold</p>
          <h1 id="kb-route-heading">{route.label}</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      {hasNavigator ? (
        <KnowledgeNavigator
          onNavigateToHref={onNavigateToHref}
          routeState={routeState}
        />
      ) : null}

      {route.id === "tag" && activeTags.length === 1 ? (
        <KnowledgeTypeOverview referent={activeTags[0]} />
      ) : null}

      {hasWorkingLayout ? (
        <ComponentScaffold
          activeTags={activeTags}
          components={route.components}
          label={route.label}
          onNavigateToHref={onNavigateToHref}
        />
      ) : (
        <PagePlaceholder route={route} />
      )}

      {route.id === "organization-home" ? (
        <OrganizationSubrouteLinks
          onNavigate={onNavigate}
          routeState={routeState}
        />
      ) : null}

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

function AnalyticsPage({
  onNavigate,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const summary = useQuery(api.analytics.getMvpSummary, {
    popularLimit: 6,
    recentLimit: 6,
  });
  const popularVisitCount =
    summary?.popularTargets.reduce(
      (totalVisits, target) => totalVisits + target.totalVisits,
      0,
    ) ?? 0;

  return (
    <main className="kb-main kb-analytics-main" aria-labelledby="kb-analytics-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">MVP Analytics</p>
          <h1 id="kb-analytics-heading">Analytics</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      {summary === undefined ? (
        <section className="kb-analytics-empty" role="status">
          <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          <span>Loading analytics</span>
        </section>
      ) : (
        <>
          <section className="kb-analytics-metrics" aria-label="Analytics snapshot">
            <article>
              <TrendingUp aria-hidden="true" />
              <span>Popular Visits</span>
              <strong>{popularVisitCount}</strong>
            </article>
            <article>
              <BookOpen aria-hidden="true" />
              <span>Tracked Targets</span>
              <strong>{summary.popularTargets.length}</strong>
            </article>
            <article>
              <MousePointerClick aria-hidden="true" />
              <span>Navigator Actions</span>
              <strong>{summary.navigatorUsage.length}</strong>
            </article>
          </section>

          <section className="kb-analytics-grid" aria-label="Analytics lists">
            <AnalyticsPanel title="Popular targets">
              {summary.popularTargets.length > 0 ? (
                <ol className="kb-analytics-list">
                  {summary.popularTargets.map((target) => (
                    <li key={`${target.targetKind}:${target.targetKey}`}>
                      <a href={target.href} onClick={(event) => onNavigate(event, target.href)}>
                        <span>{target.label}</span>
                        <small>{formatAnalyticsKindLabel(target.targetKind)}</small>
                      </a>
                      <strong>{target.totalVisits}</strong>
                      <time dateTime={new Date(target.lastVisitedAt).toISOString()}>
                        {formatAnalyticsTime(target.lastVisitedAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="kb-analytics-empty-copy">No page visits recorded yet.</p>
              )}
            </AnalyticsPanel>

            <AnalyticsPanel title="Recent visits">
              {summary.recentPageVisits.length > 0 ? (
                <ol className="kb-analytics-list">
                  {summary.recentPageVisits.map((visit) => (
                    <li key={visit.id}>
                      <a href={visit.href} onClick={(event) => onNavigate(event, visit.href)}>
                        <span>{visit.label}</span>
                        <small>{visit.rawPath}</small>
                      </a>
                      <strong>{formatAnalyticsKindLabel(visit.targetKind)}</strong>
                      <time dateTime={new Date(visit.visitedAt).toISOString()}>
                        {formatAnalyticsTime(visit.visitedAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="kb-analytics-empty-copy">No recent visits yet.</p>
              )}
            </AnalyticsPanel>

            <AnalyticsPanel title="Navigator usage">
              {summary.navigatorUsage.length > 0 ? (
                <ol className="kb-analytics-list kb-analytics-usage-list">
                  {summary.navigatorUsage.map((usage) => (
                    <li key={usage.id}>
                      <div>
                        <span>{formatNavigatorUsageKind(usage.usageKind)}</span>
                        <small>
                          {usage.activeTagCount} active Tags, {usage.resolvedTagCount} resolved
                        </small>
                      </div>
                      <strong>{usage.activeTagCount}</strong>
                      <time dateTime={new Date(usage.occurredAt).toISOString()}>
                        {formatAnalyticsTime(usage.occurredAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="kb-analytics-empty-copy">No navigator actions yet.</p>
              )}
            </AnalyticsPanel>
          </section>
        </>
      )}
    </main>
  );
}

function AnalyticsPanel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="kb-analytics-panel">
      <header>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function formatAnalyticsKindLabel(kind: string) {
  if (kind === "biblePassage") {
    return "Bible Passage";
  }

  if (kind === "dashboard") {
    return "Dashboard";
  }

  if (kind === "context") {
    return "Context Page";
  }

  return "Referent Page";
}

function formatNavigatorUsageKind(kind: string) {
  if (kind === "select") {
    return "Selected Tags";
  }

  if (kind === "deselect") {
    return "Deselected Tags";
  }

  if (kind === "contribute") {
    return "Contributed";
  }

  return "Explored";
}

function formatAnalyticsTime(timestamp: number) {
  return NOTIFICATION_TIME_FORMATTER.format(new Date(timestamp));
}

function OrganizationSubrouteLinks({
  onNavigate,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const settingsHref = getOrganizationSettingsHref(routeState.pathname);

  return (
    <section className="kb-related-routes" aria-label="Organization subroutes">
      <p className="kb-eyebrow">Organization routes</p>
      <div>
        <a
          href={settingsHref}
          onClick={(event) => onNavigate(event, settingsHref)}
        >
          <Settings aria-hidden="true" />
          <span>Settings</span>
        </a>
      </div>
    </section>
  );
}

function ComponentScaffold({
  activeTags,
  components,
  label,
  onNavigateToHref,
}: {
  activeTags: ActiveTag[];
  components: CoreComponentId[];
  label: string;
  onNavigateToHref: (href: string) => void;
}) {
  const [selectedContributionKnowledgeType, setSelectedContributionKnowledgeType] =
    useState<AuthorableKnowledgeType | null>(null);
  const [feedItems, setFeedItems] =
    useState<AnswerFeedFixtureItem[]>(ANSWER_FEED_FIXTURE);
  const [selectedContributionSlotId, setSelectedContributionSlotId] =
    useState<string | null>(null);
  const recordNavigatorUsage = useMutation(api.analytics.recordNavigatorUsage);
  const activeContextKey = getKnowledgeContextKey(activeTags);
  const matchingFeedItems = useMemo(
    () => selectAnswerFeedItems(feedItems, activeTags),
    [activeTags, feedItems],
  );
  const primarySlotItem = getPrimarySlotItemForContext(feedItems, activeTags);
  const selectedSlotItem = selectedContributionSlotId
    ? matchingFeedItems.find(
        (item): item is AnswerFeedFixtureItem & { kind: "slot" } =>
          isAnswerFeedSlot(item) && item.slot.id === selectedContributionSlotId,
      )
    : undefined;
  const primarySlot = primarySlotItem?.slot;
  const selectedSlot = selectedSlotItem?.slot;
  const contributionContext = selectedSlotItem
    ? getFixtureContextTags(selectedSlotItem.contextTagIds)
    : activeTags;

  useEffect(() => {
    setSelectedContributionSlotId(null);
  }, [activeContextKey]);

  function handleSubmitContribution(
    input: ContributionInput,
  ): Promise<ContributionResult> {
    const contributionItem = createDeterministicContributionFeedItem(input);
    recordNavigatorUsageEvent("contribute", input.contextTags);

    setFeedItems((currentItems) => [
      contributionItem,
      ...currentItems.filter(
        (item) =>
          item.kind === "answer"
            ? item.entry.id !== contributionItem.entry.id
            : true,
      ),
    ]);

    return Promise.resolve({
      entryId: contributionItem.entry.id,
      status: "submitted",
    });
  }

  function handleApplyMappedTags(mappedTags: ActiveTag[]) {
    recordNavigatorUsageEvent("explore", mappedTags);
    onNavigateToHref(getCanonicalKnowledgeContextHref(mappedTags));
  }

  function handleContributeToSlot(slot: KnowledgeSlotSummary) {
    setSelectedContributionSlotId(slot.id);
  }

  function recordNavigatorUsageEvent(
    usageKind: NavigatorUsageKind,
    tags: ActiveTag[],
  ) {
    void recordNavigatorUsage({
      activeTagKeys: getNavigatorAnalyticsTagKeys(tags),
      usageKind,
    }).catch(() => undefined);
  }

  return (
    <section className="kb-scaffold-grid" aria-label={`${label} component scaffold`}>
      {components.includes("answer-feed") ? (
        <AnswerFeedSurface
          activeTags={activeTags}
          items={feedItems}
          onContributeToSlot={handleContributeToSlot}
        />
      ) : null}

      <aside className="kb-component-rail" aria-label="Secondary placeholders">
        {components.includes("knowledge-slot-card") ? (
          <KnowledgeSlotRail
            onContributeToSlot={handleContributeToSlot}
            slot={primarySlot}
          />
        ) : null}
        {components.includes("knowledge-request-composer") ? (
          <PlaceholderBlock code="C3" title="Knowledge Request Composer">
            <KnowledgeRequestComposer
              activeTags={activeTags}
              onApplyMappedTags={handleApplyMappedTags}
            />
          </PlaceholderBlock>
        ) : null}
        {components.includes("contribution-editor") ? (
          <ContributionEditorSurface
            context={contributionContext}
            onKnowledgeTypeChange={setSelectedContributionKnowledgeType}
            onSubmitSource={handleSubmitContribution}
            selectedKnowledgeType={selectedContributionKnowledgeType}
            slot={selectedSlot}
          />
        ) : null}
      </aside>
    </section>
  );
}

function KnowledgeSlotRail({
  onContributeToSlot,
  slot,
}: {
  onContributeToSlot: (slot: KnowledgeSlotSummary) => void;
  slot?: KnowledgeSlotSummary;
}) {
  if (slot) {
    return <KnowledgeSlotCard onContribute={onContributeToSlot} slot={slot} />;
  }

  return (
    <PlaceholderBlock code="C6" title="Knowledge Slot Card">
      <p className="kb-rail-empty">No Knowledge Slots in this Knowledge Context.</p>
    </PlaceholderBlock>
  );
}

function ProfilePage({
  appAccess,
  onNavigate,
  routeState,
}: {
  appAccess: AllowedAppAccess;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const route = getRoute("profile");
  const email = appAccess.email ?? "No email on file";
  const displayName = getProfileDisplayName(appAccess.email);
  const organizationCount = appAccess.organizations.length;
  const membershipRoles = getUniqueMembershipRoles(appAccess.organizations);
  const primaryOrganization = appAccess.organizations[0];

  return (
    <main className="kb-main kb-profile-main" aria-labelledby="kb-profile-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Account</p>
          <h1 id="kb-profile-heading">Profile</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-profile-summary" aria-label="Profile summary">
        <div>
          <UserCircle aria-hidden="true" />
          <span>Signed in as</span>
          <strong>{displayName}</strong>
        </div>
        <div>
          <Landmark aria-hidden="true" />
          <span>Organizations</span>
          <strong>
            {organizationCount} {organizationCount === 1 ? "membership" : "memberships"}
          </strong>
        </div>
        <div>
          <Users aria-hidden="true" />
          <span>Primary role</span>
          <strong>{membershipRoles[0] ?? "Member"}</strong>
        </div>
      </section>

      <section className="kb-profile-layout" aria-label="User profile">
        <section className="kb-profile-panel kb-profile-identity" aria-labelledby="kb-profile-card-heading">
          <div className="kb-profile-identity-main">
            <img
              className="kb-profile-photo"
              src={profilePlaceholderUrl}
              alt=""
              aria-hidden="true"
            />
            <div>
              <p className="kb-eyebrow">Current user</p>
              <h2 id="kb-profile-card-heading">{displayName}</h2>
              <p>{email}</p>
            </div>
          </div>

          <dl className="kb-profile-detail-list">
            <div>
              <dt>User ID</dt>
              <dd>{appAccess.userId}</dd>
            </div>
            <div>
              <dt>Primary organization</dt>
              <dd>{primaryOrganization?.name ?? "None"}</dd>
            </div>
            <div>
              <dt>Roles</dt>
              <dd>{membershipRoles.join(", ") || "Member"}</dd>
            </div>
          </dl>
        </section>

        <aside className="kb-profile-panel kb-profile-session" aria-labelledby="kb-profile-session-heading">
          <header>
            <UserCircle aria-hidden="true" />
            <div>
              <p className="kb-eyebrow">Session</p>
              <h2 id="kb-profile-session-heading">Account</h2>
            </div>
          </header>
          <dl className="kb-profile-session-list">
            <div>
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>Organization member</dd>
            </div>
          </dl>
          <SignOutButton />
        </aside>
      </section>

      <section className="kb-profile-panel kb-profile-organizations" aria-labelledby="kb-profile-organizations-heading">
        <header>
          <div>
            <p className="kb-eyebrow">Memberships</p>
            <h2 id="kb-profile-organizations-heading">Organizations</h2>
          </div>
          <span>{organizationCount} active</span>
        </header>

        {organizationCount > 0 ? (
          <ul className="kb-profile-organization-list">
            {appAccess.organizations.map((organization) => {
              const organizationHref = `/orgs/${organization.organizationReferentId}`;

              return (
                <li key={organization.organizationReferentId}>
                  <a
                    href={organizationHref}
                    onClick={(event) => onNavigate(event, organizationHref)}
                  >
                    <Landmark aria-hidden="true" />
                    <span>{organization.name}</span>
                  </a>
                  <dl>
                    <div>
                      <dt>Kind</dt>
                      <dd>{formatOrganizationKind(organization.organizationKind)}</dd>
                    </div>
                    <div>
                      <dt>Role</dt>
                      <dd>{formatMembershipRole(organization.role)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="kb-profile-empty">No active organization memberships.</p>
        )}
      </section>

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

function SettingsPage({
  appAccess,
  onNavigate,
  onToggleTheme,
  routeState,
  theme,
}: {
  appAccess: AllowedAppAccess;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onToggleTheme: () => void;
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const route = getRoute("settings");
  const email = appAccess.email ?? "No email on file";
  const organizationCount = appAccess.organizations.length;
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <main className="kb-main kb-settings-main" aria-labelledby="kb-settings-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Account</p>
          <h1 id="kb-settings-heading">User Settings</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-settings-summary" aria-label="Settings summary">
        <div>
          <UserCircle aria-hidden="true" />
          <span>Signed in as</span>
          <strong>{email}</strong>
        </div>
        <div>
          <Users aria-hidden="true" />
          <span>Organizations</span>
          <strong>
            {organizationCount} {organizationCount === 1 ? "membership" : "memberships"}
          </strong>
        </div>
        <div>
          <Moon aria-hidden="true" />
          <span>Theme</span>
          <strong>{theme === "dark" ? "Dark" : "Light"}</strong>
        </div>
      </section>

      <section className="kb-settings-layout" aria-label="User settings">
        <section className="kb-settings-panel" aria-labelledby="kb-settings-account-heading">
          <header>
            <UserCircle aria-hidden="true" />
            <div>
              <p className="kb-eyebrow">Identity</p>
              <h2 id="kb-settings-account-heading">Account</h2>
            </div>
          </header>
          <dl className="kb-settings-list">
            <div>
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>User ID</dt>
              <dd>{appAccess.userId}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Active</dd>
            </div>
          </dl>
        </section>

        <section className="kb-settings-panel" aria-labelledby="kb-settings-appearance-heading">
          <header>
            <Settings aria-hidden="true" />
            <div>
              <p className="kb-eyebrow">Preferences</p>
              <h2 id="kb-settings-appearance-heading">Appearance</h2>
            </div>
          </header>
          <button
            aria-checked={theme === "dark"}
            aria-label={`Use ${nextTheme} theme`}
            className="kb-settings-switch"
            onClick={onToggleTheme}
            role="switch"
            type="button"
          >
            <span aria-hidden="true" />
            <span>Dark mode</span>
            <strong>{theme === "dark" ? "On" : "Off"}</strong>
          </button>
        </section>
      </section>

      <section className="kb-settings-panel kb-settings-organizations" aria-labelledby="kb-settings-organizations-heading">
        <header>
          <Landmark aria-hidden="true" />
          <div>
            <p className="kb-eyebrow">Workspace</p>
            <h2 id="kb-settings-organizations-heading">Organizations</h2>
          </div>
        </header>

        {organizationCount > 0 ? (
          <ul className="kb-settings-org-list">
            {appAccess.organizations.map((organization) => (
              <li key={organization.organizationReferentId}>
                <a
                  href={`/orgs/${organization.organizationReferentId}`}
                  onClick={(event) =>
                    onNavigate(event, `/orgs/${organization.organizationReferentId}`)
                  }
                >
                  <Landmark aria-hidden="true" />
                  <span>{organization.name}</span>
                </a>
                <dl>
                  <div>
                    <dt>Kind</dt>
                    <dd>{formatOrganizationKind(organization.organizationKind)}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{formatMembershipRole(organization.role)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="kb-settings-empty">No active organization memberships.</p>
        )}
      </section>

      <section className="kb-settings-panel kb-settings-session" aria-labelledby="kb-settings-session-heading">
        <header>
          <Bell aria-hidden="true" />
          <div>
            <p className="kb-eyebrow">Session</p>
            <h2 id="kb-settings-session-heading">Account Actions</h2>
          </div>
        </header>
        <div className="kb-settings-action-row">
          <a
            href="/notifications"
            onClick={(event) => onNavigate(event, "/notifications")}
          >
            <Bell aria-hidden="true" />
            <span>Notifications</span>
          </a>
          <SignOutButton />
        </div>
      </section>

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

function formatOrganizationKind(kind: string) {
  return kind
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMembershipRole(role: string) {
  return formatOrganizationKind(role);
}

function getProfileDisplayName(email?: string) {
  if (!email) {
    return "Current User";
  }

  const localPart = email.split("@")[0] ?? "";
  const parts = localPart
    .split(/[._+-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return email;
  }

  return parts.map(formatProfileNamePart).join(" ");
}

function getUniqueMembershipRoles(
  organizations: AllowedAppAccess["organizations"],
) {
  return Array.from(
    new Set(organizations.map((organization) => formatMembershipRole(organization.role))),
  );
}

function formatProfileNamePart(part: string) {
  return part.charAt(0).toUpperCase() + part.slice(1);
}

const DETERMINISTIC_CONTRIBUTION_UPDATED_AT = Date.UTC(2026, 5, 1, 12);
const DETERMINISTIC_CONTRIBUTION_HUMAN_WEIGHT = 82;

function createDeterministicContributionFeedItem(
  input: ContributionInput,
): AnswerFeedFixtureItem & { kind: "answer" } {
  const entryId = `simulated-${slugifyContributionId(input.slotId ?? input.title)}`;
  const contextPreviewTagLabels = input.contextTags.map((tag) => tag.label);

  return {
    kind: "answer",
    contextTagIds: input.contextTags.map((tag) => tag.id),
    entry: {
      id: entryId,
      title: input.title,
      knowledgeType: input.knowledgeType,
      previewText: input.body.trim().slice(0, 220),
      primaryTagLabel: contextPreviewTagLabels[0] ?? input.title,
      contextPreviewTagLabels,
      humanWeight: DETERMINISTIC_CONTRIBUTION_HUMAN_WEIGHT,
      href: `/entries/${entryId}`,
      updatedAt: DETERMINISTIC_CONTRIBUTION_UPDATED_AT,
    },
  };
}

function slugifyContributionId(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "contribution";
}

function NotificationsPage({
  onNavigate,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const route = getRoute("notifications");
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const filteredNotifications = USER_NOTIFICATIONS.filter((notification) =>
    notificationMatchesFilter(notification, activeFilter),
  );
  const unreadCount = getNotificationFilterCount("unread");
  const slotCount = getNotificationFilterCount("knowledgeSlots");
  const eventCount = getNotificationFilterCount("events");

  return (
    <main className="kb-main kb-notifications-main" aria-labelledby="kb-notifications-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">User Notifications</p>
          <h1 id="kb-notifications-heading">Notifications</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-notification-summary" aria-label="Notification summary">
        <div>
          <Bell aria-hidden="true" />
          <span>Unread</span>
          <strong>{unreadCount} unread</strong>
        </div>
        <div>
          <Clock aria-hidden="true" />
          <span>Latest</span>
          <strong>{formatNotificationTime(USER_NOTIFICATIONS[0].receivedAt)}</strong>
        </div>
        <div>
          <CalendarDays aria-hidden="true" />
          <span>Events</span>
          <strong>{eventCount} event notice</strong>
        </div>
        <div>
          <Users aria-hidden="true" />
          <span>Knowledge Slots</span>
          <strong>{slotCount} open item</strong>
        </div>
      </section>

      <section className="kb-notification-panel" aria-labelledby="kb-notification-feed-heading">
        <header>
          <div>
            <p className="kb-eyebrow">Notification Feed</p>
            <h2 id="kb-notification-feed-heading">
              {getNotificationFilterHeading(activeFilter)}
            </h2>
          </div>
          <div
            aria-label="Notification filters"
            className="kb-notification-filters"
            role="tablist"
          >
            {NOTIFICATION_FILTERS.map((filter) => (
              <button
                aria-label={filter.label}
                aria-selected={activeFilter === filter.id}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                role="tab"
                type="button"
              >
                <span>{filter.label}</span>
                <strong>{getNotificationFilterCount(filter.id)}</strong>
              </button>
            ))}
          </div>
        </header>

        {filteredNotifications.length > 0 ? (
          <ol className="kb-notification-list">
            {filteredNotifications.map((notification) => (
              <li data-notification-status={notification.status} key={notification.id}>
                <article className="kb-notification-card">
                  <span className="kb-notification-mark" aria-hidden="true">
                    <Bell />
                  </span>
                  <div className="kb-notification-content">
                    <header>
                      <div>
                        <p className="kb-card-eyebrow">
                          {NOTIFICATION_KIND_LABELS[notification.kind]}
                        </p>
                        <h3>
                          <a
                            href={notification.contextHref}
                            onClick={(event) =>
                              onNavigate(event, notification.contextHref)
                            }
                          >
                            {notification.title}
                          </a>
                        </h3>
                      </div>
                      <span>{notification.status === "unread" ? "Unread" : "Read"}</span>
                    </header>
                    <p>{notification.body}</p>
                    <footer>
                      <span>{notification.contextLabel}</span>
                      <time dateTime={new Date(notification.receivedAt).toISOString()}>
                        {formatNotificationTime(notification.receivedAt)}
                      </time>
                      <a
                        className="kb-card-action"
                        href={notification.contextHref}
                        onClick={(event) => onNavigate(event, notification.contextHref)}
                      >
                        <BookOpen aria-hidden="true" />
                        Open
                      </a>
                    </footer>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <section className="kb-notification-empty" role="status">
            <h3>No Notifications match this view.</h3>
            <p>Subscribed Knowledge Contexts, Knowledge Slots, and Events are quiet.</p>
          </section>
        )}
      </section>

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

function notificationMatchesFilter(
  notification: UserNotification,
  filter: NotificationFilter,
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "unread") {
    return notification.status === "unread";
  }

  if (filter === "knowledgeSlots") {
    return notification.kind === "knowledgeSlot";
  }

  return notification.kind === "event";
}

function getNotificationFilterCount(filter: NotificationFilter) {
  return USER_NOTIFICATIONS.filter((notification) =>
    notificationMatchesFilter(notification, filter),
  ).length;
}

function getNotificationFilterHeading(filter: NotificationFilter) {
  if (filter === "unread") {
    return "Unread Notifications";
  }

  if (filter === "knowledgeSlots") {
    return "Knowledge Slot Notifications";
  }

  if (filter === "events") {
    return "Event Notifications";
  }

  return "All Notifications";
}

function formatNotificationTime(timestamp: number) {
  return NOTIFICATION_TIME_FORMATTER.format(new Date(timestamp));
}

function OrganizationSettingsPage({
  onNavigate,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const organizationSlug = getOrganizationSlug(routeState.pathname);
  const organizationHomeHref = getOrganizationHomeHref(routeState.pathname);
  const organizationLabel = labelFromRouteSlug(organizationSlug);

  return (
    <main
      className="kb-main kb-org-settings-main"
      aria-labelledby="kb-org-settings-heading"
    >
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Organization</p>
          <h1 id="kb-org-settings-heading">Organization Settings</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-org-settings-layout" aria-label="Organization settings">
        <section
          className="kb-org-settings-panel"
          aria-labelledby="kb-org-settings-profile-heading"
        >
          <header>
            <div>
              <p className="kb-eyebrow">Profile</p>
              <h2 id="kb-org-settings-profile-heading">{organizationLabel}</h2>
            </div>
            <Settings aria-hidden="true" />
          </header>

          <dl className="kb-org-settings-list">
            <div>
              <dt>Organization Slug</dt>
              <dd>{organizationSlug}</dd>
            </div>
            <div>
              <dt>Access Policy</dt>
              <dd>Members only</dd>
            </div>
            <div>
              <dt>Default Role</dt>
              <dd>Member</dd>
            </div>
          </dl>
        </section>

        <aside
          className="kb-org-settings-panel kb-org-settings-rail"
          aria-labelledby="kb-org-settings-nav-heading"
        >
          <header>
            <div>
              <p className="kb-eyebrow">Routes</p>
              <h2 id="kb-org-settings-nav-heading">Organization</h2>
            </div>
            <Landmark aria-hidden="true" />
          </header>
          <a
            href={organizationHomeHref}
            onClick={(event) => onNavigate(event, organizationHomeHref)}
          >
            <Landmark aria-hidden="true" />
            <span>Organization Home</span>
          </a>
        </aside>
      </section>
    </main>
  );
}

function CalendarPage({
  onNavigate,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const route = getRoute("calendar");
  const confirmedEventCount = CALENDAR_EVENTS.filter(
    (event) => event.status === "confirmed",
  ).length;
  const nextEvent = CALENDAR_EVENTS.find((event) => event.day >= CALENDAR_TODAY)
    ?? CALENDAR_EVENTS[0];
  const calendarCells = getCalendarMonthCells();

  return (
    <main className="kb-main kb-calendar-main" aria-labelledby="kb-calendar-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Schedule</p>
          <h1 id="kb-calendar-heading">Calendar</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-calendar-summary" aria-label="Calendar summary">
        <div>
          <CalendarDays aria-hidden="true" />
          <span>{CALENDAR_MONTH_LABEL}</span>
          <strong>{CALENDAR_EVENTS.length} scheduled items</strong>
        </div>
        <div>
          <Clock aria-hidden="true" />
          <span>Next up</span>
          <strong>{formatCalendarDay(nextEvent.day)}, {nextEvent.timeLabel}</strong>
        </div>
        <div>
          <Users aria-hidden="true" />
          <span>Confirmed</span>
          <strong>{confirmedEventCount} ready</strong>
        </div>
      </section>

      <section className="kb-calendar-layout" aria-label={`${CALENDAR_MONTH_LABEL} calendar`}>
        <section className="kb-calendar-month" aria-labelledby="kb-calendar-month-heading">
          <header>
            <div>
              <p className="kb-eyebrow">Month View</p>
              <h2 id="kb-calendar-month-heading">{CALENDAR_MONTH_LABEL}</h2>
            </div>
            <span>{CALENDAR_EVENTS.length} items</span>
          </header>

          <div className="kb-calendar-weekdays" aria-hidden="true">
            {CALENDAR_WEEKDAYS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="kb-calendar-grid" role="grid" aria-label={CALENDAR_MONTH_LABEL}>
            {calendarCells.map((day, index) => {
              const events = day ? getCalendarEventsForDay(day) : [];

              return (
                <div
                  aria-label={day ? formatCalendarDay(day) : "Empty calendar day"}
                  className={day ? "kb-calendar-day" : "kb-calendar-day kb-calendar-day-empty"}
                  data-today={day === CALENDAR_TODAY ? "true" : undefined}
                  key={`${day ?? "empty"}-${index}`}
                  role="gridcell"
                >
                  {day ? (
                    <>
                      <span className="kb-calendar-day-number">{day}</span>
                      <div className="kb-calendar-day-events">
                        {events.map((event) => (
                          <a
                            className="kb-calendar-event-pill"
                            data-status={event.status}
                            href={event.contextHref}
                            key={event.id}
                            onClick={(mouseEvent) => onNavigate(mouseEvent, event.contextHref)}
                          >
                            <span>{event.title}</span>
                          </a>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="kb-calendar-agenda" aria-labelledby="kb-calendar-agenda-heading">
          <header>
            <p className="kb-eyebrow">Agenda</p>
            <h2 id="kb-calendar-agenda-heading">Upcoming Work</h2>
          </header>

          <ol>
            {CALENDAR_EVENTS.map((event) => (
              <li key={event.id}>
                <a
                  href={event.contextHref}
                  onClick={(mouseEvent) => onNavigate(mouseEvent, event.contextHref)}
                >
                  <span>{formatCalendarDay(event.day)}</span>
                  <strong>{event.title}</strong>
                </a>
                <dl>
                  <div>
                    <dt>
                      <Clock aria-hidden="true" />
                      <span>Time</span>
                    </dt>
                    <dd>{event.timeLabel}</dd>
                  </div>
                  <div>
                    <dt>
                      <MapPin aria-hidden="true" />
                      <span>Place</span>
                    </dt>
                    <dd>{event.locationLabel}</dd>
                  </div>
                  <div>
                    <dt>
                      <Users aria-hidden="true" />
                      <span>Group</span>
                    </dt>
                    <dd>{event.groupLabel}</dd>
                  </div>
                </dl>
                <p>
                  <span>{event.status === "confirmed" ? "Confirmed" : "Draft"}</span>
                  <span>{event.contextLabel}</span>
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

function getCalendarMonthCells() {
  return [
    ...Array.from({ length: CALENDAR_START_WEEKDAY_INDEX }, () => null),
    ...Array.from({ length: CALENDAR_DAY_COUNT }, (_, index) => index + 1),
  ];
}

function getCalendarEventsForDay(day: number) {
  return CALENDAR_EVENTS.filter((event) => event.day === day);
}

function formatCalendarDay(day: number) {
  return `June ${day}`;
}

function getOrganizationSettingsHref(pathname: string) {
  return `/orgs/${encodeURIComponent(getOrganizationSlug(pathname))}/settings`;
}

function getOrganizationHomeHref(pathname: string) {
  return `/orgs/${encodeURIComponent(getOrganizationSlug(pathname))}`;
}

function getOrganizationSlug(pathname: string) {
  const match = /^\/orgs\/([^/]+)/.exec(pathname);
  if (!match) {
    return SAMPLE_ORG_ID;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function labelFromRouteSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || slug;
}

function BiblePassagePage({
  onNavigateToHref,
  routeState,
}: {
  onNavigateToHref: (href: string) => void;
  routeState: RouteState;
}) {
  const passageString = getScripturePassageString(routeState.pathname);
  const activeTags = getActiveTagsFromRoute(routeState);
  const passage = useQuery(
    api.scripture.getPassage,
    passageString ? { passageString } : "skip",
  );

  if (!passageString) {
    return (
      <main className="kb-main kb-scripture-main" aria-labelledby="kb-scripture-heading">
        <header className="kb-route-header">
          <div>
            <p className="kb-eyebrow">Bible Passage Referent Page</p>
            <h1 id="kb-scripture-heading">Scripture</h1>
          </div>
          <RouteMeta routeState={routeState} />
        </header>
        <section className="kb-scripture-empty" role="status">
          Add a passage after `/scripture/`.
        </section>
      </main>
    );
  }

  if (passage === undefined) {
    return (
      <main
        aria-busy="true"
        aria-labelledby="kb-scripture-heading"
        className="kb-main kb-scripture-main"
      >
        <header className="kb-route-header">
          <div>
            <p className="kb-eyebrow">Bible Passage Referent Page</p>
            <h1 id="kb-scripture-heading">Opening Scripture</h1>
          </div>
          <RouteMeta routeState={routeState} />
        </header>
        <section className="kb-scripture-empty" role="status">
          <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          <span>Loading passage</span>
        </section>
      </main>
    );
  }

  if (passage.status === "invalid") {
    return (
      <main className="kb-main kb-scripture-main" aria-labelledby="kb-scripture-heading">
        <header className="kb-route-header">
          <div>
            <p className="kb-eyebrow">Bible Passage Referent Page</p>
            <h1 id="kb-scripture-heading">Scripture</h1>
          </div>
          <RouteMeta routeState={routeState} />
        </header>
        <section className="kb-scripture-empty" role="alert">
          {passage.message}
        </section>
      </main>
    );
  }

  if (passage.status === "missingStructure") {
    return (
      <main className="kb-main kb-scripture-main" aria-labelledby="kb-scripture-heading">
        <header className="kb-route-header">
          <div>
            <p className="kb-eyebrow">Bible Passage Referent Page</p>
            <h1 id="kb-scripture-heading">{passage.label}</h1>
          </div>
          <RouteMeta routeState={routeState} />
        </header>
        <KnowledgeNavigator
          onNavigateToHref={onNavigateToHref}
          routeState={routeState}
        />
        {activeTags[0] ? <KnowledgeTypeOverview referent={activeTags[0]} /> : null}
        <section className="kb-scripture-empty" role="status">
          {passage.message}
        </section>
      </main>
    );
  }

  const translationLabel = passage.translation
    ? `${passage.translation.name} (${passage.translation.code})`
    : "No translation selected";

  return (
    <main className="kb-main kb-scripture-main" aria-labelledby="kb-scripture-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Bible Passage Referent Page</p>
          <h1 id="kb-scripture-heading">{passage.label}</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <KnowledgeNavigator
        onNavigateToHref={onNavigateToHref}
        routeState={routeState}
      />

      {activeTags[0] ? <KnowledgeTypeOverview referent={activeTags[0]} /> : null}

      <section className="kb-scripture-panel" aria-label={`${passage.label} passage text`}>
        <header>
          <div>
            <p className="kb-eyebrow">Scripture Text</p>
            <h2>{translationLabel}</h2>
          </div>
          <span>{passage.canonicalKey}</span>
        </header>

        {!passage.hasText ? (
          <div className="kb-scripture-empty" role="status">
            {passage.translation
              ? `Verse text for ${passage.translation.code} is not available yet.`
              : "No Bible translation metadata is available yet."}
          </div>
        ) : (
          <div className="kb-verse-list">
            {passage.verses.map((verse) => (
              <p className="kb-verse-row" key={verse.ordinal}>
                <span className="kb-verse-ref">{formatVerseReference(verse)}</span>
                <span>{verse.text ?? "Text unavailable"}</span>
              </p>
            ))}
          </div>
        )}

        {passage.isTruncated ? (
          <p className="kb-scripture-note" role="status">
            Showing the first 300 verses.
          </p>
        ) : null}
      </section>

      <ComponentScaffold
        activeTags={activeTags}
        components={getRoute("scripture").components}
        label={passage.label}
        onNavigateToHref={onNavigateToHref}
      />
    </main>
  );
}

function getScripturePassageString(pathname: string) {
  if (!pathname.startsWith("/scripture/")) {
    return "";
  }

  try {
    return decodeURIComponent(pathname.slice("/scripture/".length));
  } catch {
    return pathname.slice("/scripture/".length);
  }
}

function getPassageSuggestions(query: string, limit: number) {
  const suggestionLimit = Math.max(
    0,
    Math.min(Math.floor(limit), MAX_PASSAGE_SUGGESTIONS),
  );
  if (!query || suggestionLimit < 1) {
    return [];
  }

  const parsedPassage = parseBiblePassageReference(query);
  if (!parsedPassage) {
    return [];
  }

  return [
    {
      href: `/scripture/${parsedPassage.slug}`,
      kind: "biblePassage",
      label: parsedPassage.label,
      passageString: parsedPassage.slug,
    },
  ].slice(0, suggestionLimit);
}

function formatVerseReference(verse: {
  bookShortName: string;
  chapterNumber: number;
  verseNumber: number;
}) {
  return `${verse.bookShortName} ${verse.chapterNumber}:${verse.verseNumber}`;
}

function RouteMeta({ routeState }: { routeState: RouteState }) {
  return (
    <dl className="kb-route-meta" aria-label="Current URL">
      <div>
        <dt>Path</dt>
        <dd>{routeState.pathname}</dd>
      </div>
      <div>
        <dt>Query</dt>
        <dd>{routeState.search || "none"}</dd>
      </div>
    </dl>
  );
}

function KnowledgeNavigator({
  onNavigateToHref,
  routeState,
}: {
  onNavigateToHref: (href: string) => void;
  routeState: RouteState;
}) {
  const activeTags = useMemo(
    () => getActiveTagsFromRoute(routeState),
    [routeState.pathname, routeState.search],
  );
  const inactiveTags = useMemo(
    () => getInactiveNavigatorTags(activeTags),
    [activeTags],
  );
  const recordNavigatorUsage = useMutation(api.analytics.recordNavigatorUsage);
  const contextKey = getKnowledgeContextKey(activeTags);

  function navigateToTags(nextTags: ActiveTag[]) {
    onNavigateToHref(getCanonicalKnowledgeContextHref(nextTags));
  }

  function handleAddTag(tag: ActiveTag) {
    const nextTags = addActiveTag(activeTags, tag);
    recordNavigatorUsageEvent("select", nextTags);
    navigateToTags(nextTags);
  }

  function handleRemoveTag(tagId: string) {
    const nextTags = removeActiveTag(activeTags, tagId);
    recordNavigatorUsageEvent("deselect", nextTags);
    navigateToTags(nextTags);
  }

  function recordNavigatorUsageEvent(
    usageKind: NavigatorUsageKind,
    tags: ActiveTag[],
  ) {
    void recordNavigatorUsage({
      activeTagKeys: getNavigatorAnalyticsTagKeys(tags),
      usageKind,
    }).catch(() => undefined);
  }

  return (
    <PlaceholderBlock code="C1" title="Knowledge Navigator">
      <div className="kb-navigator-panel">
        <div className="kb-active-tag-list" aria-label="Active Tags">
          {activeTags.length > 0 ? (
            activeTags.map((tag) => (
              <button
                aria-label={`Remove ${tag.label}`}
                className="kb-active-tag-chip"
                key={tag.id}
                onClick={() => handleRemoveTag(tag.id)}
                title={`Remove ${tag.label}`}
                type="button"
              >
                <Tag aria-hidden="true" />
                <span>{tag.label}</span>
                <X aria-hidden="true" />
              </button>
            ))
          ) : (
            <p className="kb-navigator-empty">Global Knowledge Context</p>
          )}
        </div>

        <div className="kb-add-tag-list" aria-label="Available Tags">
          {inactiveTags.map((tag) => (
            <button
              aria-label={`Add ${tag.label}`}
              className="kb-add-tag-button"
              key={tag.id}
              onClick={() => handleAddTag(tag)}
              title={`Add ${tag.label}`}
              type="button"
            >
              <Plus aria-hidden="true" />
              <span>{tag.label}</span>
            </button>
          ))}
        </div>

        <span aria-live="polite" className="kb-sr-only">
          {contextKey}
        </span>
      </div>
    </PlaceholderBlock>
  );
}

function PagePlaceholder({ route }: { route: RouteDefinition }) {
  const Icon = route.icon;

  return (
    <section className="kb-page-placeholder" aria-label={`${route.label} placeholder`}>
      <Icon aria-hidden="true" />
      <span>{route.label}</span>
    </section>
  );
}

function RelatedRoutes({
  onNavigate,
  relatedRouteIds,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  relatedRouteIds: PageId[];
}) {
  return (
    <section className="kb-related-routes" aria-label="Related route placeholders">
      <p className="kb-eyebrow">Related routes</p>
      <div>
        {relatedRouteIds.map((pageId) => {
          const route = getRoute(pageId);
          const Icon = route.icon;

          return (
            <a
              href={route.href}
              key={route.id}
              onClick={(event) => onNavigate(event, route.href)}
            >
              <Icon aria-hidden="true" />
              <span>{route.label}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function PlaceholderBlock({
  children,
  code,
  title,
  variant = "default",
}: {
  children?: ReactNode;
  code: string;
  title: string;
  variant?: "default" | "primary";
}) {
  return (
    <section className="kb-placeholder-block" data-variant={variant}>
      <header>
        <span>{code}</span>
        <h2>{title}</h2>
      </header>
      {children ? <div className="kb-placeholder-body">{children}</div> : null}
    </section>
  );
}

function BrandMark() {
  return (
    <img className="kb-brand-logo" src={archePressIconUrl} alt="" aria-hidden="true" />
  );
}
