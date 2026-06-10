import {
  useEffect,
  useState,
  type ElementType,
  type FormEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  Bell,
  CalendarDays,
  Compass,
  Landmark,
  LayoutDashboard,
  Moon,
  Search,
  Settings,
  Sparkles,
  Tag,
  UserCircle,
} from "lucide-react";
import archePressIconUrl from "./assets/arche-press_icon-full.svg";
import archePressHorizontalLogoDarkUrl from "./assets/arche-press_logo-horizontal-full-dark.svg";
import archePressHorizontalLogoUrl from "./assets/arche-press_logo-horizontal-full.svg";
import profilePlaceholderUrl from "./assets/profile-placeholder.png";

const THEME_STORAGE_KEY = "knowledgebase-theme";

const SAMPLE_TAG_ID = "scripture";
const SAMPLE_ORG_ID = "my-church";
const SAMPLE_CONTEXT_TAG_IDS = "scripture,romans-8";

type ThemePreference = "light" | "dark";

type PageId =
  | "dashboard"
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
  | "question-composer"
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
      "question-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "tag",
    label: "Tag",
    href: `/${SAMPLE_TAG_ID}`,
    pattern: "/:tagId",
    icon: Tag,
    components: [
      "knowledge-navigator",
      "answer-feed",
      "question-composer",
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
      "question-composer",
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
      "question-composer",
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
      "question-composer",
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
    window.history.pushState({}, "", href);
    setRouteState(getRouteState(window.location));
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  return (
    <KnowledgebaseShell
      activePageId={routeState.route.id}
      onNavigate={navigate}
      onToggleTheme={toggleTheme}
      routeState={routeState}
      theme={theme}
    >
      <PageScaffold routeState={routeState} onNavigate={navigate} />
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

  if (pathname.startsWith("/orgs/")) {
    return getRoute("organization-home");
  }

  const staticRoute = ROUTES.find(
    (route) => route.href.split("?")[0] === pathname && route.id !== "tag",
  );
  if (staticRoute) {
    return staticRoute;
  }

  return getRoute("tag");
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

function KnowledgebaseShell({
  activePageId,
  children,
  onNavigate,
  onToggleTheme,
  routeState,
  theme,
}: {
  activePageId: PageId;
  children: ReactNode;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
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
  onToggleTheme,
  routeState,
  theme,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onToggleTheme: () => void;
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const brandLogoUrl =
    theme === "dark" ? archePressHorizontalLogoDarkUrl : archePressHorizontalLogoUrl;

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
        <label className="kb-search">
          <Search aria-hidden="true" />
          <input type="text" placeholder="Search categories, settings, etc." />
        </label>
      </div>
    </header>
  );
}

function PageScaffold({
  onNavigate,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const { route } = routeState;
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

      {hasNavigator ? <KnowledgeNavigator /> : null}

      {hasWorkingLayout ? (
        <section className="kb-scaffold-grid" aria-label={`${route.label} component scaffold`}>
          {route.components.includes("answer-feed") ? (
            <AnswerFeed
              showEntryCard={route.components.includes("knowledge-entry-card")}
            />
          ) : null}

          <aside className="kb-component-rail" aria-label="Secondary placeholders">
            {route.components.includes("knowledge-slot-card") ? <KnowledgeSlotCard /> : null}
            {route.components.includes("question-composer") ? <QuestionComposer /> : null}
            {route.components.includes("contribution-editor") ? (
              <ContributionEditor />
            ) : null}
          </aside>
        </section>
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

function KnowledgeNavigator() {
  return (
    <PlaceholderBlock code="C1" title="Knowledge Navigator">
      <div className="kb-placeholder-control-row">
        <button type="button" disabled>
          Add Tag
        </button>
        <button type="button" disabled>
          Remove Tag
        </button>
      </div>
    </PlaceholderBlock>
  );
}

function AnswerFeed({ showEntryCard }: { showEntryCard: boolean }) {
  return (
    <PlaceholderBlock code="C2" title="Answer Feed" variant="primary">
      {showEntryCard ? <KnowledgeEntryCard /> : null}
    </PlaceholderBlock>
  );
}

function QuestionComposer() {
  return (
    <PlaceholderBlock code="C3" title="Question Composer">
      <AssistantInput
        label="Question Composer"
        placeholder="Ask Assistant..."
      />
    </PlaceholderBlock>
  );
}

function ContributionEditor() {
  return (
    <PlaceholderBlock code="C4" title="Contribution Editor">
      <AssistantInput
        label="Contribution Editor"
        placeholder="Ask Assistant..."
      />
    </PlaceholderBlock>
  );
}

function AssistantInput({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form className="kb-assistant-input" onSubmit={handleSubmit}>
      <label>
        <span>{label}</span>
        <input type="text" placeholder={placeholder} />
      </label>
      <button type="submit" aria-label={label}>
        <Sparkles aria-hidden="true" />
      </button>
    </form>
  );
}

function KnowledgeEntryCard() {
  return <PlaceholderBlock code="C5" title="Knowledge Entry Card" />;
}

function KnowledgeSlotCard() {
  return (
    <PlaceholderBlock code="C6" title="Knowledge Slot Card">
      <button type="button" disabled>
        Slot CTA
      </button>
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
