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
import { useQuery } from "convex/react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Compass,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  Moon,
  Plus,
  Search,
  Settings,
  Tag,
  UserCircle,
  X,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import { parseBiblePassageReference } from "../convex/lib/scriptureReferences";
import { AuthPanel, SignOutButton } from "./auth/AuthPanel";
import archePressIconUrl from "./assets/arche-press_icon-full.svg";
import archePressHorizontalLogoDarkUrl from "./assets/arche-press_logo-horizontal-full-dark.svg";
import archePressHorizontalLogoUrl from "./assets/arche-press_logo-horizontal-full.svg";
import profilePlaceholderUrl from "./assets/profile-placeholder.png";
import { AnswerFeed as AnswerFeedSurface } from "./AnswerFeed";
import { ContributionEditor as ContributionEditorSurface } from "./ContributionEditor";
import { KnowledgeRequestComposer } from "./KnowledgeRequestComposer";
import { KnowledgeSlotCard } from "./components/KnowledgeCards";
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

type ThemePreference = "light" | "dark";

type PageId =
  | "dashboard"
  | "scripture"
  | "tag"
  | "explore-context"
  | "organization-home"
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
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    pattern: "/settings",
    icon: Settings,
    components: [],
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    pattern: "/notifications",
    icon: Bell,
    components: ["answer-feed", "knowledge-entry-card"],
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
const USER_ROUTE_IDS: PageId[] = ["calendar", "settings"];

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);
  const [routeState, setRouteState] = useState<RouteState>(() => getRouteState(window.location));

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
      setRouteState(getRouteState(window.location));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    navigateToHref(href);
  }

  function navigateToHref(href: string) {
    window.history.pushState({}, "", href);
    setRouteState(getRouteState(window.location));
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  function goToDashboard() {
    window.history.replaceState({}, "", "/");
    setRouteState(getRouteState(window.location));
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

  return (
    <KnowledgebaseShell
      activePageId={routeState.route.id}
      onNavigate={navigate}
      onNavigateToHref={navigateToHref}
      onToggleTheme={toggleTheme}
      routeState={routeState}
      theme={theme}
    >
      <PageScaffold
        onNavigate={navigate}
        onNavigateToHref={navigateToHref}
        routeState={routeState}
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
  routeState,
  theme,
}: {
  activePageId: PageId;
  children: ReactNode;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  onToggleTheme: () => void;
  routeState: RouteState;
  theme: ThemePreference;
}) {
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
        <div className="kb-host-content">{children}</div>
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
        {PRIMARY_ROUTE_IDS.map((pageId) => (
          <RouteNavLink
            active={pageId === activePageId}
            key={pageId}
            onNavigate={onNavigate}
            route={getRoute(pageId)}
          />
        ))}
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
          {isSuggestionListOpen ? (
            <div
              className="kb-search-suggestions"
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
          ) : null}
        </div>
      </div>
    </header>
  );
}

function PageScaffold({
  onNavigate,
  onNavigateToHref,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  routeState: RouteState;
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

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
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
    onNavigateToHref(getCanonicalKnowledgeContextHref(mappedTags));
  }

  function handleContributeToSlot(slot: KnowledgeSlotSummary) {
    setSelectedContributionSlotId(slot.id);
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
  const contextKey = getKnowledgeContextKey(activeTags);

  function navigateToTags(nextTags: ActiveTag[]) {
    onNavigateToHref(getCanonicalKnowledgeContextHref(nextTags));
  }

  function handleAddTag(tag: ActiveTag) {
    navigateToTags(addActiveTag(activeTags, tag));
  }

  function handleRemoveTag(tagId: string) {
    navigateToTags(removeActiveTag(activeTags, tagId));
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
