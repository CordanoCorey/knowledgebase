import { createEffect, createMemo, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js";
import { api } from "./api";
import {
  addActiveTag,
  CALENDAR_EVENTS,
  CALENDAR_MONTH_LABEL,
  CALENDAR_TODAY,
  CALENDAR_WEEKDAYS,
  formatKnowledgeTypeLabel,
  formatTimestamp,
  getActiveTagsFromRoute,
  getCalendarMonthCells,
  getCanonicalKnowledgeContextHref,
  getInactiveNavigatorTags,
  getKnowledgeContextKey,
  getRouteState,
  getScripturePassageString,
  removeActiveTag,
  ROUTES,
  TODAY_AGENDA_ITEMS,
  type ActiveTag,
  type AnswerFeedItem,
  type AppAccessState,
  type RootSearchResult,
  type RouteDefinition,
  type RouteState,
  type UserNotification,
} from "./domain";
import {
  convexClient,
  createConnectionState,
  createConvexQuery,
  readStoredAuthToken,
  runConvexMutation,
  storeAuthToken,
} from "./convex";

const THEME_STORAGE_KEY = "knowledgebase-solid-theme";

export default function App() {
  const [routeState, setRouteState] = createSignal<RouteState>(getRouteState(window.location));
  const [theme, setTheme] = createSignal(loadTheme());
  const [toast, setToast] = createSignal("");
  const activeTags = createMemo(() => getActiveTagsFromRoute(routeState()));
  const connectionState = createConnectionState();
  const appAccess = createConvexQuery<AppAccessState>(() =>
    convexClient ? { query: api.appAccess.getCurrentUserAccess, args: {} } : "skip",
  );
  const pinnedPages = createConvexQuery<Array<{ href: string; id: string; label: string; secondaryLabel: string }>>(() =>
    appAccess.data()?.status === "allowed"
      ? { query: api.pinnedKnowledgePages.listForSidebar, args: {} }
      : "skip",
  );
  const unreadSummary = createConvexQuery<{ latestReceivedAt?: number; unreadCount: number }>(() =>
    appAccess.data()?.status === "allowed"
      ? { query: api.userNotifications.getUnreadSummary, args: { limit: 25 } }
      : "skip",
  );

  createEffect(
    () => theme(),
    (nextTheme) => {
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    },
  );

  createEffect(
    () => ({ activeTags: activeTags(), routeState: routeState() }),
    ({ activeTags, routeState }) => {
      void recordPageVisit(routeState, activeTags).catch(() => undefined);
    },
  );

  const handlePopState = () => setRouteState(getRouteState(window.location));
  window.addEventListener("popstate", handlePopState);
  onCleanup(() => window.removeEventListener("popstate", handlePopState));

  function navigateToHref(href: string) {
    const nextUrl = new URL(href, window.location.href);
    if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) return;
    window.history.pushState(null, "", nextUrl.pathname + nextUrl.search + nextUrl.hash);
    setRouteState(getRouteState(window.location));
  }

  function handleNavigate(event: MouseEvent, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigateToHref(href);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  if (!convexClient) {
    return <MissingConfig />;
  }

  return (
    <div class="kb-app">
      <aside class="kb-sidebar">
        <a class="kb-brand" href="/" onClick={(event) => handleNavigate(event, "/")}>
          <span class="kb-brand-mark">L</span>
          <span>
            <strong>Logeion</strong>
            <small>Solid replica</small>
          </span>
        </a>
        <nav aria-label="Primary">
          <For each={ROUTES.filter((route) => route.id !== "system-admin" || appAccess.data()?.status === "allowed")}>
            {(route) => <NavLink route={route} current={routeState().route.id} onNavigate={handleNavigate} />}
          </For>
        </nav>
        <Show when={pinnedPages.data()?.length}>
          <section class="kb-sidebar-group" aria-label="Pinned knowledge pages">
            <p>Pinned</p>
            <For each={pinnedPages.data()}>
              {(page) => (
                <a href={page.href} onClick={(event) => handleNavigate(event, page.href)}>
                  <IconGlyph name="pin" />
                  <span>{page.label}</span>
                </a>
              )}
            </For>
          </section>
        </Show>
      </aside>

      <div class="kb-frame">
        <header class="kb-topbar">
          <div>
            <p class="kb-eyebrow">{routeState().route.pattern}</p>
            <h1>{routeState().route.label}</h1>
          </div>
          <div class="kb-topbar-actions">
            <span class="kb-connection" data-connected={connectionState()?.isWebSocketConnected ? "true" : "false"}>
              {connectionState()?.isWebSocketConnected ? "Live" : "Connecting"}
            </span>
            <a
              class="kb-icon-button"
              href="/notifications"
              onClick={(event) => handleNavigate(event, "/notifications")}
              title="Notifications"
            >
              <IconGlyph name="bell" />
              <Show when={(unreadSummary.data()?.unreadCount ?? 0) > 0}>
                <span class="kb-badge">{unreadSummary.data()?.unreadCount}</span>
              </Show>
            </a>
            <button
              class="kb-icon-button"
              onClick={() => setTheme(theme() === "dark" ? "light" : "dark")}
              title="Toggle theme"
              type="button"
            >
              <Show when={theme() === "dark"} fallback={<IconGlyph name="moon" />}>
                <IconGlyph name="sun" />
              </Show>
            </button>
          </div>
        </header>

        <Show when={toast()}>
          <div class="kb-toast" role="status">{toast()}</div>
        </Show>

        <Show when={appAccess.error()}>
          <AccessNotice message={appAccess.error() ?? ""} />
        </Show>
        <Show when={appAccess.data()?.status !== "allowed"}>
          <AuthBridge access={appAccess.data()} isLoading={appAccess.isLoading()} />
        </Show>

        <Switch>
          <Match when={routeState().route.id === "dashboard"}>
            <DashboardPage
              activeTags={activeTags()}
              appAccess={appAccess.data()}
              onNavigate={handleNavigate}
              onNavigateToHref={navigateToHref}
              onToast={showToast}
              routeState={routeState()}
            />
          </Match>
          <Match when={routeState().route.id === "root-search"}>
            <SearchPage onNavigate={handleNavigate} onNavigateToHref={navigateToHref} routeState={routeState()} />
          </Match>
          <Match when={routeState().route.id === "scripture"}>
            <ScripturePage
              activeTags={activeTags()}
              onNavigateToHref={navigateToHref}
              onToast={showToast}
              routeState={routeState()}
            />
          </Match>
          <Match when={routeState().route.id === "tag" || routeState().route.id === "explore-context"}>
            <KnowledgeContextPage
              activeTags={activeTags()}
              onNavigateToHref={navigateToHref}
              onToast={showToast}
              routeState={routeState()}
            />
          </Match>
          <Match when={routeState().route.id === "organization-home"}>
            <OrganizationPage appAccess={appAccess.data()} onToast={showToast} routeState={routeState()} />
          </Match>
          <Match when={routeState().route.id === "organization-settings"}>
            <OrganizationSettingsPage routeState={routeState()} />
          </Match>
          <Match when={routeState().route.id === "analytics"}>
            <AnalyticsPage />
          </Match>
          <Match when={routeState().route.id === "smart-storage-playground"}>
            <SmartStoragePage onToast={showToast} />
          </Match>
          <Match when={routeState().route.id === "profile"}>
            <ProfilePage onToast={showToast} />
          </Match>
          <Match when={routeState().route.id === "settings"}>
            <SettingsPage />
          </Match>
          <Match when={routeState().route.id === "notifications"}>
            <NotificationsPage onNavigate={handleNavigate} onToast={showToast} />
          </Match>
          <Match when={routeState().route.id === "calendar"}>
            <CalendarPage onNavigate={handleNavigate} />
          </Match>
          <Match when={routeState().route.id === "system-admin"}>
            <SystemAdminPage />
          </Match>
        </Switch>
      </div>
    </div>
  );
}

function MissingConfig() {
  return (
    <main class="kb-auth-page">
      <section class="kb-empty-state">
        <IconGlyph name="database" />
        <h1>Missing Convex URL</h1>
        <p>Set VITE_CONVEX_URL or VITE_LOGEION_CONVEX_URL before starting this Solid app.</p>
      </section>
    </main>
  );
}

function NavLink(props: {
  current: string;
  onNavigate: (event: MouseEvent, href: string) => void;
  route: RouteDefinition;
}) {
  return (
    <a
      aria-current={props.current === props.route.id ? "page" : undefined}
      href={props.route.href}
      onClick={(event) => props.onNavigate(event, props.route.href)}
    >
      <IconGlyph name={props.route.id} />
      <span>{props.route.label}</span>
    </a>
  );
}

function AuthBridge(props: { access?: AppAccessState; isLoading: boolean }) {
  const [token, setToken] = createSignal(readStoredAuthToken());

  return (
    <section class="kb-auth-bridge" aria-label="Authentication bridge">
      <IconGlyph name="lock" />
      <div>
        <h2>{props.isLoading ? "Checking access" : accessTitle(props.access)}</h2>
        <p>
          This Solid copy uses Convex directly. Paste a deployment JWT here to send authenticated
          queries without relying on the React Convex Auth provider.
        </p>
        <label>
          <span>Convex auth token</span>
          <input
            autocomplete="off"
            spellcheck={false}
            type="password"
            value={token()}
            onInput={(event) => setToken(event.currentTarget.value)}
          />
        </label>
        <button type="button" onClick={() => storeAuthToken(token())}>
          <IconGlyph name="check" />
          <span>Apply token</span>
        </button>
      </div>
    </section>
  );
}

function AccessNotice(props: { message: string }) {
  return (
    <section class="kb-access-notice" role="status">
      <IconGlyph name="lock" />
      <span>{props.message}</span>
    </section>
  );
}

function DashboardPage(props: {
  activeTags: ActiveTag[];
  appAccess?: AppAccessState;
  onNavigate: (event: MouseEvent, href: string) => void;
  onNavigateToHref: (href: string) => void;
  onToast: (message: string) => void;
  routeState: RouteState;
}) {
  const suggestions = createConvexQuery<Array<{
    href: string;
    label: string;
    openRequestCount: number;
    recentVisitCount: number;
    trendKind: string;
  }>>(() => ({ query: api.analytics.listDashboardBibleContextSuggestions, args: { limit: 4 } }));

  return (
    <main class="kb-main">
      <section class="kb-dashboard-hero">
        <div>
          <p class="kb-eyebrow">Today</p>
          <h2>Knowledge workbench</h2>
          <p>Scan the current context, answer open slots, and save durable contributions to Convex.</p>
        </div>
        <div class="kb-hero-metrics">
          <Metric label="Agenda" value={String(TODAY_AGENDA_ITEMS.length)} />
          <Metric label="Tags" value={String(props.activeTags.length)} />
          <Metric label="Access" value={props.appAccess?.status ?? "loading"} />
        </div>
      </section>

      <section class="kb-agenda-grid">
        <For each={TODAY_AGENDA_ITEMS}>
          {(item) => (
            <a href={item.contextHref} onClick={(event) => props.onNavigate(event, item.contextHref)}>
              <span>{item.timeLabel}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </a>
          )}
        </For>
      </section>

      <KnowledgeWorkspace
        activeTags={props.activeTags}
        onNavigateToHref={props.onNavigateToHref}
        onToast={props.onToast}
        routeState={props.routeState}
      />

      <section class="kb-panel">
        <header>
          <div>
            <p class="kb-eyebrow">Bible contexts</p>
            <h2>Suggested next pages</h2>
          </div>
        </header>
        <Show when={!suggestions.error()} fallback={<ErrorText message={suggestions.error() ?? ""} />}>
          <div class="kb-card-grid">
            <For each={suggestions.data() ?? []} fallback={<LoadingText label="Loading suggestions" />}>
              {(item) => (
                <a class="kb-card" href={item.href} onClick={(event) => props.onNavigate(event, item.href)}>
                  <IconGlyph name="book" />
                  <strong>{item.label}</strong>
                  <span>{item.openRequestCount} open requests</span>
                  <span>{item.recentVisitCount} recent visits</span>
                </a>
              )}
            </For>
          </div>
        </Show>
      </section>
    </main>
  );
}

function SearchPage(props: {
  onNavigate: (event: MouseEvent, href: string) => void;
  onNavigateToHref: (href: string) => void;
  routeState: RouteState;
}) {
  const initialQuery = new URLSearchParams(props.routeState.search).get("q") ?? "";
  const [queryText, setQueryText] = createSignal(initialQuery);
  const results = createConvexQuery<RootSearchResult[]>(() =>
    queryText().trim()
      ? { query: api.rootSearch.listRootSearchResults, args: { limit: 12, query: queryText().trim() } }
      : "skip",
  );

  function submitSearch(event: SubmitEvent) {
    event.preventDefault();
    const next = queryText().trim();
    if (next) props.onNavigateToHref(`/search?q=${encodeURIComponent(next)}`);
  }

  return (
    <main class="kb-main">
      <section class="kb-search-panel">
        <form onSubmit={submitSearch}>
          <IconGlyph name="search" />
          <input
            aria-label="Search all knowledge"
            placeholder="Search people, passages, questions, and topics"
            value={queryText()}
            onInput={(event) => setQueryText(event.currentTarget.value)}
          />
          <button type="submit">Search</button>
        </form>
      </section>
      <section class="kb-panel">
        <header>
          <div>
            <p class="kb-eyebrow">Root search</p>
            <h2>Results</h2>
          </div>
        </header>
        <Show when={!results.error()} fallback={<ErrorText message={results.error() ?? ""} />}>
          <For each={results.data() ?? []} fallback={<p class="kb-muted">Type a search to query Convex.</p>}>
            {(result) => (
              <a class="kb-result-row" href={result.href} onClick={(event) => props.onNavigate(event, result.href)}>
                <span data-type={result.knowledgeType}>{formatKnowledgeTypeLabel(result.knowledgeType)}</span>
                <strong>{result.label}</strong>
                <small>{result.scopeLabel}</small>
                <Show when={result.matchedEntryPreview}>
                  {(preview) => <p>{preview().title}: {preview().previewText}</p>}
                </Show>
              </a>
            )}
          </For>
        </Show>
      </section>
    </main>
  );
}

function ScripturePage(props: {
  activeTags: ActiveTag[];
  onNavigateToHref: (href: string) => void;
  onToast: (message: string) => void;
  routeState: RouteState;
}) {
  const passageString = createMemo(() => getScripturePassageString(props.routeState.pathname));
  const passage = createConvexQuery<{
    canonicalKey?: string;
    hasText?: boolean;
    isTruncated?: boolean;
    label?: string;
    message?: string;
    status: "invalid" | "missingStructure" | "resolved";
    translation?: { code: string; name: string };
    verses?: Array<{ bookShortName: string; chapterNumber: number; ordinal: number; text?: string | null; verseNumber: number }>;
  }>(() =>
    passageString()
      ? { query: api.scripture.getPassage, args: { passageString: passageString() } }
      : "skip",
  );

  return (
    <main class="kb-main">
      <section class="kb-panel kb-scripture-panel">
        <header>
          <div>
            <p class="kb-eyebrow">Bible Passage Referent Page</p>
            <h2>{passage.data()?.label ?? passageString() ?? "Scripture"}</h2>
          </div>
          <span>{passage.data()?.canonicalKey ?? "Loading"}</span>
        </header>
        <Show when={!passage.error()} fallback={<ErrorText message={passage.error() ?? ""} />}>
          <Switch fallback={<LoadingText label="Loading passage" />}>
            <Match when={passage.data()?.status === "invalid" || passage.data()?.status === "missingStructure"}>
              <p class="kb-muted">{passage.data()?.message}</p>
            </Match>
            <Match when={passage.data()?.status === "resolved"}>
              <div class="kb-verse-list">
                <For each={passage.data()?.verses ?? []}>
                  {(verse) => (
                    <p>
                      <span>{verse.bookShortName} {verse.chapterNumber}:{verse.verseNumber}</span>
                      <span>{verse.text ?? "Text unavailable"}</span>
                    </p>
                  )}
                </For>
              </div>
            </Match>
          </Switch>
        </Show>
      </section>
      <KnowledgeWorkspace
        activeTags={props.activeTags}
        onNavigateToHref={props.onNavigateToHref}
        onToast={props.onToast}
        routeState={props.routeState}
      />
    </main>
  );
}

function KnowledgeContextPage(props: {
  activeTags: ActiveTag[];
  onNavigateToHref: (href: string) => void;
  onToast: (message: string) => void;
  routeState: RouteState;
}) {
  return (
    <main class="kb-main">
      <section class="kb-context-band">
        <div>
          <p class="kb-eyebrow">Active context</p>
          <h2>{props.activeTags.map((tag) => tag.label).join(" + ") || "All Accessible Knowledge"}</h2>
        </div>
        <span>{getKnowledgeContextKey(props.activeTags)}</span>
      </section>
      <KnowledgeWorkspace {...props} />
    </main>
  );
}

function KnowledgeWorkspace(props: {
  activeTags: ActiveTag[];
  onNavigateToHref: (href: string) => void;
  onToast: (message: string) => void;
  routeState: RouteState;
}) {
  return (
    <div class="kb-workspace">
      <KnowledgeNavigator
        activeTags={props.activeTags}
        onNavigateToHref={props.onNavigateToHref}
      />
      <ContributionComposer activeTags={props.activeTags} onToast={props.onToast} />
      <AnswerFeed activeTags={props.activeTags} onToast={props.onToast} />
    </div>
  );
}

function KnowledgeNavigator(props: { activeTags: ActiveTag[]; onNavigateToHref: (href: string) => void }) {
  function navigateToTags(tags: ActiveTag[], usageKind: "select" | "deselect") {
    void runConvexMutation(api.analytics.recordNavigatorUsage, {
      activeTagKeys: tags.map((tag) => tag.canonicalKey),
      usageKind,
    }).catch(() => undefined);
    props.onNavigateToHref(getCanonicalKnowledgeContextHref(tags));
  }

  return (
    <section class="kb-panel kb-navigator">
      <header>
        <div>
          <p class="kb-eyebrow">Knowledge Navigator</p>
          <h2>Active Knowledge Context</h2>
        </div>
      </header>
      <div class="kb-chip-row">
        <For each={props.activeTags} fallback={<p class="kb-muted">All Accessible Knowledge</p>}>
          {(tag) => (
            <button
              class="kb-chip"
              data-type={tag.knowledgeType}
              onClick={() => navigateToTags(removeActiveTag(props.activeTags, tag.id), "deselect")}
              type="button"
            >
              <span>{tag.label}</span>
            </button>
          )}
        </For>
      </div>
      <div class="kb-add-row">
        <For each={getInactiveNavigatorTags(props.activeTags)}>
          {(tag) => (
            <button
              class="kb-add-button"
              onClick={() => navigateToTags(addActiveTag(props.activeTags, tag), "select")}
              type="button"
            >
              <IconGlyph name="tag" />
              <span>{tag.label}</span>
            </button>
          )}
        </For>
      </div>
    </section>
  );
}

function ContributionComposer(props: { activeTags: ActiveTag[]; onToast: (message: string) => void }) {
  const [title, setTitle] = createSignal("");
  const [body, setBody] = createSignal("");
  const [knowledgeType, setKnowledgeType] = createSignal("words");
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  async function submitContribution(event: SubmitEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await runConvexMutation(api.directContributions.postDirectContribution, {
        body: body().trim(),
        contextTags: props.activeTags,
        knowledgeType: knowledgeType(),
        title: title().trim() || "Untitled contribution",
      });
      setTitle("");
      setBody("");
      props.onToast("Contribution saved through Convex.");
    } catch (caughtError) {
      props.onToast(caughtError instanceof Error ? caughtError.message : "Contribution failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section class="kb-panel">
      <header>
        <div>
          <p class="kb-eyebrow">Contribution Editor</p>
          <h2>Direct contribution</h2>
        </div>
      </header>
      <form class="kb-composer" onSubmit={submitContribution}>
        <div class="kb-form-grid">
          <label>
            <span>Type</span>
            <select value={knowledgeType()} onChange={(event) => setKnowledgeType(event.currentTarget.value)}>
              <option value="words">Words</option>
              <option value="question">Question</option>
              <option value="quote">Quote</option>
              <option value="lesson">Lesson</option>
              <option value="event">Event</option>
            </select>
          </label>
          <label>
            <span>Title</span>
            <input value={title()} onInput={(event) => setTitle(event.currentTarget.value)} />
          </label>
        </div>
        <label>
          <span>Body</span>
          <textarea required rows={5} value={body()} onInput={(event) => setBody(event.currentTarget.value)} />
        </label>
        <button disabled={isSubmitting()} type="submit">
          <Show when={isSubmitting()} fallback={<IconGlyph name="spark" />}>
            <IconGlyph class="kb-spin" name="load" />
          </Show>
          <span>{isSubmitting() ? "Saving" : "Save to Convex"}</span>
        </button>
      </form>
    </section>
  );
}

function AnswerFeed(props: { activeTags: ActiveTag[]; onToast: (message: string) => void }) {
  const feed = createConvexQuery<AnswerFeedItem[]>(() => ({
    query: api.answerFeed.listForActiveTagKeys,
    args: { activeTags: props.activeTags, answerLimit: 12, slotLimit: 8 },
  }));
  const experts = createConvexQuery<Array<{ contextExpertiseScore: number; evidenceCount: number; id: string; name: string }>>(() => ({
    query: api.answerFeed.listExpertsForActiveTagKeys,
    args: { activeTags: props.activeTags, expertLimit: 3, expertScope: "orbit" },
  }));

  return (
    <section class="kb-panel">
      <header>
        <div>
          <p class="kb-eyebrow">Answer Feed</p>
          <h2>Answers and open slots</h2>
        </div>
      </header>
      <Show when={!feed.error()} fallback={<ErrorText message={feed.error() ?? ""} />}>
        <div class="kb-feed">
          <For each={feed.data() ?? []} fallback={<LoadingText label="Loading feed" />}>
            {(item) => (
              <article class="kb-feed-card" data-kind={item.kind}>
                <Show
                  when={item.kind === "answer" ? item.entry : undefined}
                  fallback={
                    <SlotCard item={item.kind === "slot" ? item.slot : undefined} />
                  }
                >
                  {(entry) => <EntryCard entry={entry()} onToast={props.onToast} />}
                </Show>
              </article>
            )}
          </For>
        </div>
      </Show>
      <div class="kb-expert-strip">
        <For each={experts.data() ?? []}>
          {(expert) => (
            <span>
              <IconGlyph name="users" />
              {expert.name} ({Math.round(expert.contextExpertiseScore)})
            </span>
          )}
        </For>
      </div>
    </section>
  );
}

function EntryCard(props: {
  entry: Extract<AnswerFeedItem, { kind: "answer" }>["entry"];
  onToast: (message: string) => void;
}) {
  async function recognize() {
    try {
      await runConvexMutation(api.humanWeightFeedback.record, {
        entryId: props.entry.id,
        feedbackKind: "recognize",
      });
      props.onToast("Human-weight feedback recorded.");
    } catch (caughtError) {
      props.onToast(caughtError instanceof Error ? caughtError.message : "Feedback failed.");
    }
  }

  return (
    <>
      <span data-type={props.entry.knowledgeType}>{formatKnowledgeTypeLabel(props.entry.knowledgeType)}</span>
      <h3>{props.entry.title}</h3>
      <p>{props.entry.previewText}</p>
      <footer>
        <span>{props.entry.contributor.name}</span>
        <button type="button" onClick={recognize}>Recognize</button>
      </footer>
    </>
  );
}

function SlotCard(props: { item?: Extract<AnswerFeedItem, { kind: "slot" }>["slot"] }) {
  return (
    <>
      <span data-type={props.item?.requestedKnowledgeType}>{props.item?.status ?? "slot"}</span>
      <h3>{props.item?.title ?? "Open knowledge slot"}</h3>
      <p>{props.item?.promptText ?? props.item?.targetLabel}</p>
    </>
  );
}

function OrganizationPage(props: { appAccess?: AppAccessState; onToast: (message: string) => void; routeState: RouteState }) {
  const organization = createMemo(() =>
    props.appAccess?.status === "allowed"
      ? props.appAccess.organizations[0]
      : undefined,
  );

  async function runOrganizationMutation(kind: "pin" | "bookmark" | "subscribe") {
    const organizationReferentId = organization()?.organizationReferentId;
    if (!organizationReferentId) {
      props.onToast("No allowed organization is available for this account.");
      return;
    }
    try {
      if (kind === "pin") await runConvexMutation(api.pinnedKnowledgePages.pinOrganizationPage, { organizationReferentId });
      if (kind === "bookmark") await runConvexMutation(api.bookmarkedKnowledgePages.bookmarkOrganizationPage, { organizationReferentId });
      if (kind === "subscribe") await runConvexMutation(api.knowledgeSubscriptions.subscribeOrganizationPage, { organizationReferentId });
      props.onToast(`Organization ${kind} saved.`);
    } catch (caughtError) {
      props.onToast(caughtError instanceof Error ? caughtError.message : "Organization action failed.");
    }
  }

  return (
    <main class="kb-main">
      <section class="kb-context-band">
        <div>
          <p class="kb-eyebrow">Organization</p>
          <h2>{organization()?.name ?? "Organization home"}</h2>
          <p>Durable organization pages can be pinned, bookmarked, and subscribed to through Convex.</p>
        </div>
      </section>
      <div class="kb-action-row">
        <button type="button" onClick={() => void runOrganizationMutation("pin")}><IconGlyph name="pin" /> Pin</button>
        <button type="button" onClick={() => void runOrganizationMutation("bookmark")}><IconGlyph name="bookmark" /> Bookmark</button>
        <button type="button" onClick={() => void runOrganizationMutation("subscribe")}><IconGlyph name="bell" /> Subscribe</button>
      </div>
    </main>
  );
}

function OrganizationSettingsPage(_props: { routeState: RouteState }) {
  const settings = createConvexQuery<{ members: Array<{ membershipId: string; name: string; role: string; status: string }>; name: string }>(() => ({
    query: api.organizationAccounts.getOrganizationMembershipSettings,
    args: { organizationId: "arche-classical-academy" },
  }));

  return (
    <main class="kb-main">
      <section class="kb-panel">
        <header><div><p class="kb-eyebrow">Organization Settings</p><h2>{settings.data()?.name ?? "Membership"}</h2></div></header>
        <Show when={!settings.error()} fallback={<ErrorText message={settings.error() ?? ""} />}>
          <For each={settings.data()?.members ?? []} fallback={<LoadingText label="Loading members" />}>
            {(member) => <p class="kb-member-row"><span>{member.name}</span><strong>{member.role}</strong><small>{member.status}</small></p>}
          </For>
        </Show>
      </section>
    </main>
  );
}

function AnalyticsPage() {
  const summary = createConvexQuery<{
    popularTargets: Array<{ href: string; label: string; totalVisits: number }>;
    recentVisits: Array<{ href: string; label: string; visitedAt: number }>;
  }>(() => ({ query: api.analytics.getMvpSummary, args: { popularLimit: 6, recentLimit: 8 } }));

  return (
    <main class="kb-main kb-two-column">
      <SummaryList title="Popular pages" error={summary.error()} items={summary.data()?.popularTargets ?? []} />
      <SummaryList title="Recent visits" error={summary.error()} items={(summary.data()?.recentVisits ?? []).map((item) => ({ ...item, totalVisits: formatTimestamp(item.visitedAt) }))} />
    </main>
  );
}

function SmartStoragePage(props: { onToast: (message: string) => void }) {
  async function previewUrl(event: SubmitEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const url = String(form.get("url") ?? "").trim();
    if (!url) return;
    try {
      await runConvexMutation(api.smartStorage.startFromContribution, {
        body: `Imported from ${url}`,
        contextTags: [],
        externalUrls: [{ url }],
        knowledgeType: "words",
        title: "Smart storage source",
      });
      props.onToast("Smart storage run started.");
    } catch (caughtError) {
      props.onToast(caughtError instanceof Error ? caughtError.message : "Smart storage failed.");
    }
  }

  return (
    <main class="kb-main">
      <section class="kb-panel">
        <header><div><p class="kb-eyebrow">Smart Storage</p><h2>Source intake</h2></div></header>
        <form class="kb-composer" onSubmit={previewUrl}>
          <label><span>External URL</span><input name="url" type="url" placeholder="https://example.com/source" /></label>
          <button type="submit"><IconGlyph name="spark" /> Start Convex run</button>
        </form>
      </section>
    </main>
  );
}

function ProfilePage(props: { onToast: (message: string) => void }) {
  const bookmarks = createConvexQuery<Array<{ href: string; id: string; label: string; pageKey: string; secondaryLabel: string }>>(() => ({
    query: api.bookmarkedKnowledgePages.listForProfile,
    args: { limit: 50 },
  }));

  async function removeBookmark(pageKey: string) {
    try {
      await runConvexMutation(api.bookmarkedKnowledgePages.removeBookmark, { pageKey });
      props.onToast("Bookmark removed.");
    } catch (caughtError) {
      props.onToast(caughtError instanceof Error ? caughtError.message : "Could not remove bookmark.");
    }
  }

  return (
    <main class="kb-main">
      <section class="kb-panel">
        <header><div><p class="kb-eyebrow">Profile</p><h2>Saved pages</h2></div></header>
        <For each={bookmarks.data() ?? []} fallback={<LoadingText label="Loading bookmarks" />}>
          {(bookmark) => (
            <p class="kb-member-row">
              <span>{bookmark.label}</span>
              <small>{bookmark.secondaryLabel}</small>
              <button type="button" onClick={() => void removeBookmark(bookmark.pageKey)}>Remove</button>
            </p>
          )}
        </For>
      </section>
    </main>
  );
}

function SettingsPage() {
  const settings = createConvexQuery<{ globalExpertVisibilityEnabled: boolean }>(() => ({
    query: api.contextExpertiseSettings.getCurrentUserSettings,
    args: {},
  }));

  async function updateVisibility(enabled: boolean) {
    await runConvexMutation(api.contextExpertiseSettings.updateGlobalExpertVisibility, {
      globalExpertVisibilityEnabled: enabled,
    }).catch(() => undefined);
  }

  return (
    <main class="kb-main">
      <section class="kb-panel">
        <header><div><p class="kb-eyebrow">Settings</p><h2>Context expertise</h2></div></header>
        <label class="kb-toggle">
          <input
            checked={settings.data()?.globalExpertVisibilityEnabled ?? false}
            type="checkbox"
            onChange={(event) => void updateVisibility(event.currentTarget.checked)}
          />
          <span>Show public expert profile by default</span>
        </label>
      </section>
    </main>
  );
}

function NotificationsPage(props: { onNavigate: (event: MouseEvent, href: string) => void; onToast: (message: string) => void }) {
  const inbox = createConvexQuery<{ notifications: UserNotification[]; summary: { unreadCount: number; allCount: number } }>(() => ({
    query: api.userNotifications.listForInbox,
    args: { limit: 50 },
  }));

  async function mark(notification: UserNotification) {
    try {
      await runConvexMutation(notification.status === "unread" ? api.userNotifications.markRead : api.userNotifications.markUnread, {
        notificationId: notification.id,
      });
      props.onToast("Notification updated.");
    } catch (caughtError) {
      props.onToast(caughtError instanceof Error ? caughtError.message : "Notification update failed.");
    }
  }

  return (
    <main class="kb-main">
      <section class="kb-panel">
        <header>
          <div><p class="kb-eyebrow">Inbox</p><h2>{inbox.data()?.summary.unreadCount ?? 0} unread notifications</h2></div>
        </header>
        <For each={inbox.data()?.notifications ?? []} fallback={<LoadingText label="Loading notifications" />}>
          {(notification) => (
            <article class="kb-notification" data-status={notification.status}>
              <a href={notification.contextHref} onClick={(event) => props.onNavigate(event, notification.contextHref)}>
                <strong>{notification.title}</strong>
                <span>{notification.contextLabel}</span>
                <p>{notification.body}</p>
              </a>
              <button type="button" onClick={() => void mark(notification)}>
                {notification.status === "unread" ? "Mark read" : "Mark unread"}
              </button>
            </article>
          )}
        </For>
      </section>
    </main>
  );
}

function CalendarPage(props: { onNavigate: (event: MouseEvent, href: string) => void }) {
  return (
    <main class="kb-main">
      <section class="kb-calendar-summary">
        <Metric label="Month" value={CALENDAR_MONTH_LABEL} />
        <Metric label="Scheduled" value={String(CALENDAR_EVENTS.length)} />
        <Metric label="Confirmed" value={String(CALENDAR_EVENTS.filter((event) => event.status === "confirmed").length)} />
      </section>
      <section class="kb-calendar-layout">
        <div class="kb-calendar-month">
          <For each={CALENDAR_WEEKDAYS}>{(day) => <strong>{day}</strong>}</For>
          <For each={getCalendarMonthCells()}>
            {(day, index) => (
              <div class="kb-calendar-day" data-today={day === CALENDAR_TODAY ? "true" : undefined}>
                <span>{day ?? ""}</span>
                <For each={CALENDAR_EVENTS.filter((event) => event.day === day)}>
                  {(event) => (
                    <a href={event.contextHref} onClick={(mouseEvent) => props.onNavigate(mouseEvent, event.contextHref)}>
                      {event.title}
                    </a>
                  )}
                </For>
                <span class="kb-sr-only">{index()}</span>
              </div>
            )}
          </For>
        </div>
        <aside class="kb-calendar-agenda">
          <For each={CALENDAR_EVENTS}>
            {(event) => (
              <a href={event.contextHref} onClick={(mouseEvent) => props.onNavigate(mouseEvent, event.contextHref)}>
                <span>June {event.day}, {event.timeLabel}</span>
                <strong>{event.title}</strong>
                <small>{event.locationLabel}</small>
              </a>
            )}
          </For>
        </aside>
      </section>
    </main>
  );
}

function SystemAdminPage() {
  const status = createConvexQuery<{ missingScopedAggregateGroupCount: number; sampledEvidenceCount: number }>(() => ({
    query: api.contextExpertise.getScopedAggregateMigrationStatus,
    args: { aggregateSampleLimit: 5, paginationOpts: { cursor: null, numItems: 25 } },
  }));

  return (
    <main class="kb-main">
      <section class="kb-panel">
        <header><div><p class="kb-eyebrow">System Admin</p><h2>Migration readiness</h2></div></header>
        <Show when={!status.error()} fallback={<ErrorText message={status.error() ?? ""} />}>
          <Metric label="Missing groups" value={String(status.data()?.missingScopedAggregateGroupCount ?? "...")} />
          <Metric label="Sampled evidence" value={String(status.data()?.sampledEvidenceCount ?? "...")} />
        </Show>
      </section>
    </main>
  );
}

function SummaryList(props: {
  error: string | null;
  items: Array<{ href: string; label: string; totalVisits: number | string }>;
  title: string;
}) {
  return (
    <section class="kb-panel">
      <header><div><p class="kb-eyebrow">Analytics</p><h2>{props.title}</h2></div></header>
      <Show when={!props.error} fallback={<ErrorText message={props.error ?? ""} />}>
        <For each={props.items} fallback={<LoadingText label="Loading analytics" />}>
          {(item) => <p class="kb-member-row"><span>{item.label}</span><strong>{item.totalVisits}</strong></p>}
        </For>
      </Show>
    </section>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div class="kb-metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function LoadingText(props: { label: string }) {
  return <p class="kb-muted" role="status"><IconGlyph class="kb-spin" name="load" /> {props.label}</p>;
}

function ErrorText(props: { message: string }) {
  return <p class="kb-error" role="alert">{props.message}</p>;
}

async function recordPageVisit(routeState: RouteState, activeTags: ActiveTag[]) {
  const targetKey = getKnowledgeContextKey(activeTags);
  const targetKind = routeState.route.id === "scripture"
    ? "biblePassage"
    : activeTags.length === 1
      ? "tag"
      : activeTags.length > 1
        ? "context"
        : "dashboard";
  const pageType = targetKind === "dashboard" ? "dashboard" : targetKind === "context" ? "context" : "referent";

  await runConvexMutation(api.analytics.recordPageVisit, {
    pageType,
    rawPath: routeState.pathname + routeState.search,
    targetKey,
    targetKind,
  });
}

function accessTitle(access?: AppAccessState) {
  if (!access) return "Session required";
  if (access.status === "unauthenticated") return "Sign in required";
  if (access.status === "needsOrganization") return "Organization access required";
  if (access.status === "inactiveUser") return "Inactive user";
  return "Allowed";
}

function loadTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
}

function IconGlyph(props: { class?: string; name: string }) {
  return <span aria-hidden="true" class={`kb-glyph ${props.class ?? ""}`}>{glyphFor(props.name)}</span>;
}

function glyphFor(name: string) {
  return name
    .split("-")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2) || "L";
}
