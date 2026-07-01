import { $, component$, type QRL, useSignal, useTask$ } from "@qwik.dev/core";
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
  getInitialRouteState,
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
  hasConvexClient,
  readStoredAuthToken,
  runConvexMutation,
  storeAuthToken,
  useConnectionState,
  useConvexQuery,
} from "./convex";

const THEME_STORAGE_KEY = "knowledgebase-qwik-theme";

export default component$(() => {
  const routeState = useSignal<RouteState>(getInitialRouteState());
  const theme = useSignal("light");
  const toast = useSignal("");
  const connectionState = useConnectionState();
  const activeTags = getActiveTagsFromRoute(routeState.value);
  const appAccess = useConvexQuery<AppAccessState>(
    $(() => hasConvexClient() ? { name: "appAccess:getCurrentUserAccess", args: {} } : "skip"),
  );
  const pinnedPages = useConvexQuery<Array<{ href: string; id: string; label: string; secondaryLabel: string }>>(
    $((track) => {
      const accessStatus = track(() => appAccess.data?.status);
      return accessStatus === "allowed" ? { name: "pinnedKnowledgePages:listForSidebar", args: {} } : "skip";
    }),
  );
  const unreadSummary = useConvexQuery<{ latestReceivedAt?: number; unreadCount: number }>(
    $((track) => {
      const accessStatus = track(() => appAccess.data?.status);
      return accessStatus === "allowed" ? { name: "userNotifications:getUnreadSummary", args: { limit: 25 } } : "skip";
    }),
  );

  useTask$(({ track }) => {
    track(() => routeState.value.pathname + routeState.value.search);
    const targetKey = getKnowledgeContextKey(getActiveTagsFromRoute(routeState.value));
    const targetKind = routeState.value.route.id === "scripture"
      ? "biblePassage"
      : targetKey === "global"
        ? "dashboard"
        : targetKey.includes(",")
          ? "context"
          : "tag";
    const pageType = targetKind === "dashboard" ? "dashboard" : targetKind === "context" ? "context" : "referent";
    void runConvexMutation("analytics:recordPageVisit", {
      pageType,
      rawPath: routeState.value.pathname + routeState.value.search,
      targetKey,
      targetKind,
    }).catch(() => undefined);
  });

  const navigateToHref = $((href: string) => {
    const nextUrl = new URL(href, window.location.href);
    if (nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) return;
    window.history.pushState(null, "", nextUrl.pathname + nextUrl.search + nextUrl.hash);
    routeState.value = getRouteState(window.location);
  });

  const toggleTheme = $(() => {
    theme.value = theme.value === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme.value;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme.value);
  });

  const showToast = $((message: string) => {
    toast.value = message;
    window.setTimeout(() => {
      toast.value = "";
    }, 3200);
  });

  useTask$(() => {
    if (typeof window === "undefined") return;
    theme.value = window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme.value;
    const handlePopState = () => {
      routeState.value = getRouteState(window.location);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  });

  if (!hasConvexClient()) {
    return <MissingConfig />;
  }

  return (
    <div class="kb-app">
      <aside class="kb-sidebar">
        <a class="kb-brand" href="/" preventdefault:click onClick$={() => navigateToHref("/")}>
          <span class="kb-brand-mark">L</span>
          <span><strong>Logeion</strong><small>Qwik replica</small></span>
        </a>
        <nav aria-label="Primary">
          {ROUTES.map((route) => (
            <NavLink key={route.id} current={routeState.value.route.id} onNavigate$={navigateToHref} route={route} />
          ))}
        </nav>
        {!!pinnedPages.data?.length && (
          <section class="kb-sidebar-group" aria-label="Pinned knowledge pages">
            <p>Pinned</p>
            {pinnedPages.data.map((page) => (
              <a key={page.id} href={page.href} preventdefault:click onClick$={() => navigateToHref(page.href)}>
                <IconGlyph name="pin" />
                <span>{page.label}</span>
              </a>
            ))}
          </section>
        )}
      </aside>

      <div class="kb-frame">
        <header class="kb-topbar">
          <div>
            <p class="kb-eyebrow">{routeState.value.route.pattern}</p>
            <h1>{routeState.value.route.label}</h1>
          </div>
          <div class="kb-topbar-actions">
            <span class="kb-connection" data-connected={connectionState.value?.isWebSocketConnected ? "true" : "false"}>
              {connectionState.value?.isWebSocketConnected ? "Live" : "Connecting"}
            </span>
            <a class="kb-icon-button" href="/notifications" preventdefault:click onClick$={() => navigateToHref("/notifications")} title="Notifications">
              <IconGlyph name="bell" />
              {(unreadSummary.data?.unreadCount ?? 0) > 0 && <span class="kb-badge">{unreadSummary.data?.unreadCount}</span>}
            </a>
            <button class="kb-icon-button" onClick$={toggleTheme} title="Toggle theme" type="button">
              <IconGlyph name={theme.value === "dark" ? "sun" : "moon"} />
            </button>
          </div>
        </header>

        {!!toast.value && <div class="kb-toast" role="status">{toast.value}</div>}
        {!!appAccess.error && <AccessNotice message={appAccess.error} />}
        {appAccess.data?.status !== "allowed" && <AuthBridge access={appAccess.data} isLoading={appAccess.isLoading} />}

        {routeState.value.route.id === "dashboard" && (
          <DashboardPage activeTags={activeTags} appAccess={appAccess.data} onNavigate$={navigateToHref} onToast$={showToast} routeState={routeState.value} />
        )}
        {routeState.value.route.id === "root-search" && (
          <SearchPage onNavigate$={navigateToHref} routeState={routeState.value} />
        )}
        {routeState.value.route.id === "scripture" && (
          <ScripturePage activeTags={activeTags} onNavigate$={navigateToHref} onToast$={showToast} routeState={routeState.value} />
        )}
        {(routeState.value.route.id === "tag" || routeState.value.route.id === "explore-context") && (
          <KnowledgeContextPage activeTags={activeTags} onNavigate$={navigateToHref} onToast$={showToast} routeState={routeState.value} />
        )}
        {routeState.value.route.id === "organization-home" && (
          <OrganizationPage appAccess={appAccess.data} onToast$={showToast} />
        )}
        {routeState.value.route.id === "organization-settings" && <OrganizationSettingsPage />}
        {routeState.value.route.id === "analytics" && <AnalyticsPage />}
        {routeState.value.route.id === "smart-storage-playground" && <SmartStoragePage onToast$={showToast} />}
        {routeState.value.route.id === "profile" && <ProfilePage onToast$={showToast} />}
        {routeState.value.route.id === "settings" && <SettingsPage />}
        {routeState.value.route.id === "notifications" && <NotificationsPage onNavigate$={navigateToHref} onToast$={showToast} />}
        {routeState.value.route.id === "calendar" && <CalendarPage onNavigate$={navigateToHref} />}
        {routeState.value.route.id === "system-admin" && <SystemAdminPage />}
      </div>
    </div>
  );
});

export const NavLink = component$((props: {
  current: string;
  onNavigate$: QRL<(href: string) => void>;
  route: RouteDefinition;
}) => (
  <a
    aria-current={props.current === props.route.id ? "page" : undefined}
    href={props.route.href}
    preventdefault:click
    onClick$={() => props.onNavigate$(props.route.href)}
  >
    <IconGlyph name={props.route.id} />
    <span>{props.route.label}</span>
  </a>
));

export const MissingConfig = component$(() => (
  <main class="kb-auth-page">
    <section class="kb-empty-state">
      <IconGlyph name="database" />
      <h1>Missing Convex URL</h1>
      <p>Set VITE_CONVEX_URL or VITE_LOGEION_CONVEX_URL before starting this Qwik app.</p>
    </section>
  </main>
));

export const AuthBridge = component$((props: { access?: AppAccessState; isLoading: boolean }) => {
  const token = useSignal(readStoredAuthToken());
  return (
    <section class="kb-auth-bridge" aria-label="Authentication bridge">
      <IconGlyph name="lock" />
      <div>
        <h2>{props.isLoading ? "Checking access" : accessTitle(props.access)}</h2>
        <p>This Qwik copy talks to Convex directly. Paste a deployment JWT to send authenticated queries without React's Convex Auth provider.</p>
        <label>
          <span>Convex auth token</span>
          <input autoComplete="off" spellcheck={false} type="password" value={token.value} onInput$={(_, target) => { token.value = target.value; }} />
        </label>
        <button type="button" onClick$={() => storeAuthToken(token.value)}>
          <IconGlyph name="check" />
          <span>Apply token</span>
        </button>
      </div>
    </section>
  );
});

export const AccessNotice = component$((props: { message: string }) => (
  <section class="kb-access-notice" role="status">
    <IconGlyph name="lock" />
    <span>{props.message}</span>
  </section>
));

export const DashboardPage = component$((props: {
  activeTags: ActiveTag[];
  appAccess?: AppAccessState;
  onNavigate$: QRL<(href: string) => void>;
  onToast$: QRL<(message: string) => void>;
  routeState: RouteState;
}) => {
  const suggestions = useConvexQuery<Array<{ href: string; label: string; openRequestCount: number; recentVisitCount: number; trendKind: string }>>(
    $(() => ({ name: "analytics:listDashboardBibleContextSuggestions", args: { limit: 4 } })),
  );

  return (
    <main class="kb-main">
      <section class="kb-dashboard-hero">
        <div>
          <p class="kb-eyebrow">Today</p>
          <h2>Knowledge workbench</h2>
          <p>Scan context, answer open slots, and save durable contributions to Convex.</p>
        </div>
        <div class="kb-hero-metrics">
          <Metric label="Agenda" value={String(TODAY_AGENDA_ITEMS.length)} />
          <Metric label="Tags" value={String(props.activeTags.length)} />
          <Metric label="Access" value={props.appAccess?.status ?? "loading"} />
        </div>
      </section>
      <section class="kb-agenda-grid">
        {TODAY_AGENDA_ITEMS.map((item) => (
          <a key={item.id} href={item.contextHref} preventdefault:click onClick$={() => props.onNavigate$(item.contextHref)}>
            <span>{item.timeLabel}</span>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </a>
        ))}
      </section>
      <KnowledgeWorkspace activeTags={props.activeTags} onNavigate$={props.onNavigate$} onToast$={props.onToast$} routeState={props.routeState} />
      <section class="kb-panel">
        <header><div><p class="kb-eyebrow">Bible contexts</p><h2>Suggested next pages</h2></div></header>
        {suggestions.error ? <ErrorText message={suggestions.error} /> : (
          <div class="kb-card-grid">
            {(suggestions.data ?? []).map((item) => (
              <a class="kb-card" key={item.href} href={item.href} preventdefault:click onClick$={() => props.onNavigate$(item.href)}>
                <IconGlyph name="book" />
                <strong>{item.label}</strong>
                <span>{item.openRequestCount} open requests</span>
                <span>{item.recentVisitCount} recent visits</span>
              </a>
            ))}
            {!suggestions.data && <LoadingText label="Loading suggestions" />}
          </div>
        )}
      </section>
    </main>
  );
});

export const SearchPage = component$((props: {
  onNavigate$: QRL<(href: string) => void>;
  routeState: RouteState;
}) => {
  const queryText = useSignal(new URLSearchParams(props.routeState.search).get("q") ?? "");
  const results = useConvexQuery<RootSearchResult[]>(
    $((track) => {
      const query = track(() => queryText.value.trim());
      return query ? { name: "rootSearch:listRootSearchResults", args: { limit: 12, query } } : "skip";
    }),
  );

  return (
    <main class="kb-main">
      <section class="kb-search-panel">
        <form preventdefault:submit onSubmit$={() => {
          const next = queryText.value.trim();
          if (next) props.onNavigate$(`/search?q=${encodeURIComponent(next)}`);
        }}>
          <IconGlyph name="search" />
          <input aria-label="Search all knowledge" placeholder="Search people, passages, questions, and topics" value={queryText.value} onInput$={(_, target) => { queryText.value = target.value; }} />
          <button type="submit">Search</button>
        </form>
      </section>
      <section class="kb-panel">
        <header><div><p class="kb-eyebrow">Root search</p><h2>Results</h2></div></header>
        {results.error ? <ErrorText message={results.error} /> : (
          <>
            {(results.data ?? []).map((result) => (
              <a class="kb-result-row" key={result.id} href={result.href} preventdefault:click onClick$={() => props.onNavigate$(result.href)}>
                <span data-type={result.knowledgeType}>{formatKnowledgeTypeLabel(result.knowledgeType)}</span>
                <strong>{result.label}</strong>
                <small>{result.scopeLabel}</small>
                {result.matchedEntryPreview && <p>{result.matchedEntryPreview.title}: {result.matchedEntryPreview.previewText}</p>}
              </a>
            ))}
            {!results.data && <p class="kb-muted">Type a search to query Convex.</p>}
          </>
        )}
      </section>
    </main>
  );
});

export const ScripturePage = component$((props: {
  activeTags: ActiveTag[];
  onNavigate$: QRL<(href: string) => void>;
  onToast$: QRL<(message: string) => void>;
  routeState: RouteState;
}) => {
  const passageString = getScripturePassageString(props.routeState.pathname);
  const passage = useConvexQuery<{
    canonicalKey?: string;
    label?: string;
    message?: string;
    status: "invalid" | "missingStructure" | "resolved";
    verses?: Array<{ bookShortName: string; chapterNumber: number; ordinal: number; text?: string | null; verseNumber: number }>;
  }>(
    $((track) => {
      const nextPassageString = track(() => getScripturePassageString(props.routeState.pathname));
      return nextPassageString ? { name: "scripture:getPassage", args: { passageString: nextPassageString } } : "skip";
    }),
  );

  return (
    <main class="kb-main">
      <section class="kb-panel kb-scripture-panel">
        <header><div><p class="kb-eyebrow">Bible Passage Referent Page</p><h2>{passage.data?.label ?? passageString}</h2></div><span>{passage.data?.canonicalKey ?? "Loading"}</span></header>
        {passage.error ? <ErrorText message={passage.error} /> : passage.data?.status === "resolved" ? (
          <div class="kb-verse-list">
            {(passage.data.verses ?? []).map((verse) => (
              <p key={verse.ordinal}><span>{verse.bookShortName} {verse.chapterNumber}:{verse.verseNumber}</span><span>{verse.text ?? "Text unavailable"}</span></p>
            ))}
          </div>
        ) : <p class="kb-muted">{passage.data?.message ?? "Loading passage"}</p>}
      </section>
      <KnowledgeWorkspace activeTags={props.activeTags} onNavigate$={props.onNavigate$} onToast$={props.onToast$} routeState={props.routeState} />
    </main>
  );
});

export const KnowledgeContextPage = component$((props: {
  activeTags: ActiveTag[];
  onNavigate$: QRL<(href: string) => void>;
  onToast$: QRL<(message: string) => void>;
  routeState: RouteState;
}) => (
  <main class="kb-main">
    <section class="kb-context-band">
      <div><p class="kb-eyebrow">Active context</p><h2>{props.activeTags.map((tag) => tag.label).join(" + ") || "All Accessible Knowledge"}</h2></div>
      <span>{getKnowledgeContextKey(props.activeTags)}</span>
    </section>
    <KnowledgeWorkspace {...props} />
  </main>
));

export const KnowledgeWorkspace = component$((props: {
  activeTags: ActiveTag[];
  onNavigate$: QRL<(href: string) => void>;
  onToast$: QRL<(message: string) => void>;
  routeState: RouteState;
}) => (
  <div class="kb-workspace">
    <KnowledgeNavigator activeTags={props.activeTags} onNavigate$={props.onNavigate$} />
    <ContributionComposer activeTags={props.activeTags} onToast$={props.onToast$} />
    <AnswerFeed activeTags={props.activeTags} onToast$={props.onToast$} />
  </div>
));

export const KnowledgeNavigator = component$((props: {
  activeTags: ActiveTag[];
  onNavigate$: QRL<(href: string) => void>;
}) => (
  <section class="kb-panel kb-navigator">
    <header><div><p class="kb-eyebrow">Knowledge Navigator</p><h2>Active Knowledge Context</h2></div></header>
    <div class="kb-chip-row">
      {props.activeTags.length ? props.activeTags.map((tag) => (
        <button
          class="kb-chip"
          data-type={tag.knowledgeType}
          key={tag.id}
          type="button"
          onClick$={() => {
            const nextTags = removeActiveTag(props.activeTags, tag.id);
            void runConvexMutation("analytics:recordNavigatorUsage", { activeTagKeys: nextTags.map((nextTag) => nextTag.canonicalKey), usageKind: "deselect" }).catch(() => undefined);
            props.onNavigate$(getCanonicalKnowledgeContextHref(nextTags));
          }}
        >
          <span>{tag.label}</span>
        </button>
      )) : <p class="kb-muted">All Accessible Knowledge</p>}
    </div>
    <div class="kb-add-row">
      {getInactiveNavigatorTags(props.activeTags).map((tag) => (
        <button
          class="kb-add-button"
          key={tag.id}
          type="button"
          onClick$={() => {
            const nextTags = addActiveTag(props.activeTags, tag);
            void runConvexMutation("analytics:recordNavigatorUsage", { activeTagKeys: nextTags.map((nextTag) => nextTag.canonicalKey), usageKind: "select" }).catch(() => undefined);
            props.onNavigate$(getCanonicalKnowledgeContextHref(nextTags));
          }}
        >
          <IconGlyph name="tag" />
          <span>{tag.label}</span>
        </button>
      ))}
    </div>
  </section>
));

export const ContributionComposer = component$((props: { activeTags: ActiveTag[]; onToast$: QRL<(message: string) => void> }) => {
  const title = useSignal("");
  const body = useSignal("");
  const knowledgeType = useSignal("words");
  const isSubmitting = useSignal(false);

  return (
    <section class="kb-panel">
      <header><div><p class="kb-eyebrow">Contribution Editor</p><h2>Direct contribution</h2></div></header>
      <form class="kb-composer" preventdefault:submit onSubmit$={async () => {
        isSubmitting.value = true;
        try {
          await runConvexMutation("directContributions:postDirectContribution", {
            body: body.value.trim(),
            contextTags: props.activeTags,
            knowledgeType: knowledgeType.value,
            title: title.value.trim() || "Untitled contribution",
          });
          title.value = "";
          body.value = "";
          props.onToast$("Contribution saved through Convex.");
        } catch (caughtError) {
          props.onToast$(caughtError instanceof Error ? caughtError.message : "Contribution failed.");
        } finally {
          isSubmitting.value = false;
        }
      }}>
        <div class="kb-form-grid">
          <label><span>Type</span><select value={knowledgeType.value} onChange$={(_, target) => { knowledgeType.value = target.value; }}><option value="words">Words</option><option value="question">Question</option><option value="quote">Quote</option><option value="lesson">Lesson</option><option value="event">Event</option></select></label>
          <label><span>Title</span><input value={title.value} onInput$={(_, target) => { title.value = target.value; }} /></label>
        </div>
        <label><span>Body</span><textarea required rows={5} value={body.value} onInput$={(_, target) => { body.value = target.value; }} /></label>
        <button disabled={isSubmitting.value} type="submit"><IconGlyph name="spark" /><span>{isSubmitting.value ? "Saving" : "Save to Convex"}</span></button>
      </form>
    </section>
  );
});

export const AnswerFeed = component$((props: { activeTags: ActiveTag[]; onToast$: QRL<(message: string) => void> }) => {
  const feed = useConvexQuery<AnswerFeedItem[]>(
    $((track) => {
      track(() => getKnowledgeContextKey(props.activeTags));
      return { name: "answerFeed:listForActiveTagKeys", args: { activeTags: props.activeTags, answerLimit: 12, slotLimit: 8 } };
    }),
  );
  const experts = useConvexQuery<Array<{ contextExpertiseScore: number; evidenceCount: number; id: string; name: string }>>(
    $((track) => {
      track(() => getKnowledgeContextKey(props.activeTags));
      return { name: "answerFeed:listExpertsForActiveTagKeys", args: { activeTags: props.activeTags, expertLimit: 3, expertScope: "orbit" } };
    }),
  );

  return (
    <section class="kb-panel">
      <header><div><p class="kb-eyebrow">Answer Feed</p><h2>Answers and open slots</h2></div></header>
      {feed.error ? <ErrorText message={feed.error} /> : (
        <div class="kb-feed">
          {(feed.data ?? []).map((item) => (
            <article class="kb-feed-card" data-kind={item.kind} key={item.kind === "answer" ? item.entry.id : item.slot.id}>
              {item.kind === "answer" ? (
                <>
                  <span data-type={item.entry.knowledgeType}>{formatKnowledgeTypeLabel(item.entry.knowledgeType)}</span>
                  <h3>{item.entry.title}</h3>
                  <p>{item.entry.previewText}</p>
                  <footer>
                    <span>{item.entry.contributor.name}</span>
                    <button type="button" onClick$={async () => {
                      try {
                        await runConvexMutation("humanWeightFeedback:record", { entryId: item.entry.id, feedbackKind: "recognize" });
                        props.onToast$("Human-weight feedback recorded.");
                      } catch (caughtError) {
                        props.onToast$(caughtError instanceof Error ? caughtError.message : "Feedback failed.");
                      }
                    }}>Recognize</button>
                  </footer>
                </>
              ) : (
                <>
                  <span data-type={item.slot.requestedKnowledgeType}>{item.slot.status}</span>
                  <h3>{item.slot.title}</h3>
                  <p>{item.slot.promptText ?? item.slot.targetLabel}</p>
                </>
              )}
            </article>
          ))}
          {!feed.data && <LoadingText label="Loading feed" />}
        </div>
      )}
      <div class="kb-expert-strip">
        {(experts.data ?? []).map((expert) => <span key={expert.id}><IconGlyph name="users" /> {expert.name} ({Math.round(expert.contextExpertiseScore)})</span>)}
      </div>
    </section>
  );
});

export const OrganizationPage = component$((props: { appAccess?: AppAccessState; onToast$: QRL<(message: string) => void> }) => {
  const organization = props.appAccess?.status === "allowed" ? props.appAccess.organizations[0] : undefined;
  return (
    <main class="kb-main">
      <section class="kb-context-band">
        <div><p class="kb-eyebrow">Organization</p><h2>{organization?.name ?? "Organization home"}</h2><p>Pin, bookmark, and subscribe to durable organization pages through Convex.</p></div>
      </section>
      <div class="kb-action-row">
        {(["pin", "bookmark", "subscribe"] as const).map((kind) => (
          <button key={kind} type="button" onClick$={async () => {
            if (!organization?.organizationReferentId) {
              props.onToast$("No allowed organization is available for this account.");
              return;
            }
            try {
              if (kind === "pin") await runConvexMutation("pinnedKnowledgePages:pinOrganizationPage", { organizationReferentId: organization.organizationReferentId });
              if (kind === "bookmark") await runConvexMutation("bookmarkedKnowledgePages:bookmarkOrganizationPage", { organizationReferentId: organization.organizationReferentId });
              if (kind === "subscribe") await runConvexMutation("knowledgeSubscriptions:subscribeOrganizationPage", { organizationReferentId: organization.organizationReferentId });
              props.onToast$(`Organization ${kind} saved.`);
            } catch (caughtError) {
              props.onToast$(caughtError instanceof Error ? caughtError.message : "Organization action failed.");
            }
          }}><IconGlyph name={kind} /> {kind}</button>
        ))}
      </div>
    </main>
  );
});

export const OrganizationSettingsPage = component$(() => {
  const settings = useConvexQuery<{ members: Array<{ membershipId: string; name: string; role: string; status: string }>; name: string }>(
    $(() => ({ name: "organizationAccounts:getOrganizationMembershipSettings", args: { organizationId: "arche-classical-academy" } })),
  );
  return <main class="kb-main"><section class="kb-panel"><header><div><p class="kb-eyebrow">Organization Settings</p><h2>{settings.data?.name ?? "Membership"}</h2></div></header>{settings.error ? <ErrorText message={settings.error} /> : (settings.data?.members ?? []).map((member) => <p class="kb-member-row" key={member.membershipId}><span>{member.name}</span><strong>{member.role}</strong><small>{member.status}</small></p>)}</section></main>;
});

export const AnalyticsPage = component$(() => {
  const summary = useConvexQuery<{ popularTargets: Array<{ href: string; label: string; totalVisits: number }>; recentVisits: Array<{ href: string; label: string; visitedAt: number }> }>(
    $(() => ({ name: "analytics:getMvpSummary", args: { popularLimit: 6, recentLimit: 8 } })),
  );
  return (
    <main class="kb-main kb-two-column">
      <SummaryList title="Popular pages" error={summary.error} items={summary.data?.popularTargets ?? []} />
      <SummaryList title="Recent visits" error={summary.error} items={(summary.data?.recentVisits ?? []).map((item) => ({ ...item, totalVisits: formatTimestamp(item.visitedAt) }))} />
    </main>
  );
});

export const SmartStoragePage = component$((props: { onToast$: QRL<(message: string) => void> }) => {
  const url = useSignal("");
  return (
    <main class="kb-main"><section class="kb-panel"><header><div><p class="kb-eyebrow">Smart Storage</p><h2>Source intake</h2></div></header>
      <form class="kb-composer" preventdefault:submit onSubmit$={async () => {
        try {
          await runConvexMutation("smartStorage:startFromContribution", { body: `Imported from ${url.value}`, contextTags: [], externalUrls: [{ url: url.value }], knowledgeType: "words", title: "Smart storage source" });
          props.onToast$("Smart storage run started.");
        } catch (caughtError) {
          props.onToast$(caughtError instanceof Error ? caughtError.message : "Smart storage failed.");
        }
      }}>
        <label><span>External URL</span><input type="url" value={url.value} onInput$={(_, target) => { url.value = target.value; }} /></label>
        <button type="submit"><IconGlyph name="spark" /> Start Convex run</button>
      </form>
    </section></main>
  );
});

export const ProfilePage = component$((props: { onToast$: QRL<(message: string) => void> }) => {
  const bookmarks = useConvexQuery<Array<{ href: string; id: string; label: string; pageKey: string; secondaryLabel: string }>>(
    $(() => ({ name: "bookmarkedKnowledgePages:listForProfile", args: { limit: 50 } })),
  );
  return (
    <main class="kb-main"><section class="kb-panel"><header><div><p class="kb-eyebrow">Profile</p><h2>Saved pages</h2></div></header>
      {(bookmarks.data ?? []).map((bookmark) => <p class="kb-member-row" key={bookmark.id}><span>{bookmark.label}</span><small>{bookmark.secondaryLabel}</small><button type="button" onClick$={async () => { await runConvexMutation("bookmarkedKnowledgePages:removeBookmark", { pageKey: bookmark.pageKey }).catch(() => undefined); props.onToast$("Bookmark removed."); }}>Remove</button></p>)}
      {!bookmarks.data && <LoadingText label="Loading bookmarks" />}
    </section></main>
  );
});

export const SettingsPage = component$(() => {
  const settings = useConvexQuery<{ globalExpertVisibilityEnabled: boolean }>(
    $(() => ({ name: "contextExpertiseSettings:getCurrentUserSettings", args: {} })),
  );
  return <main class="kb-main"><section class="kb-panel"><header><div><p class="kb-eyebrow">Settings</p><h2>Context expertise</h2></div></header><label class="kb-toggle"><input checked={settings.data?.globalExpertVisibilityEnabled ?? false} type="checkbox" onChange$={async (_, target) => { await runConvexMutation("contextExpertiseSettings:updateGlobalExpertVisibility", { globalExpertVisibilityEnabled: target.checked }).catch(() => undefined); }} /><span>Show public expert profile by default</span></label></section></main>;
});

export const NotificationsPage = component$((props: { onNavigate$: QRL<(href: string) => void>; onToast$: QRL<(message: string) => void> }) => {
  const inbox = useConvexQuery<{ notifications: UserNotification[]; summary: { unreadCount: number; allCount: number } }>(
    $(() => ({ name: "userNotifications:listForInbox", args: { limit: 50 } })),
  );
  return (
    <main class="kb-main"><section class="kb-panel"><header><div><p class="kb-eyebrow">Inbox</p><h2>{inbox.data?.summary.unreadCount ?? 0} unread notifications</h2></div></header>
      {(inbox.data?.notifications ?? []).map((notification) => <article class="kb-notification" data-status={notification.status} key={notification.id}><a href={notification.contextHref} preventdefault:click onClick$={() => props.onNavigate$(notification.contextHref)}><strong>{notification.title}</strong><span>{notification.contextLabel}</span><p>{notification.body}</p></a><button type="button" onClick$={async () => { await runConvexMutation(notification.status === "unread" ? "userNotifications:markRead" : "userNotifications:markUnread", { notificationId: notification.id }).catch(() => undefined); props.onToast$("Notification updated."); }}>{notification.status === "unread" ? "Mark read" : "Mark unread"}</button></article>)}
      {!inbox.data && <LoadingText label="Loading notifications" />}
    </section></main>
  );
});

export const CalendarPage = component$((props: { onNavigate$: QRL<(href: string) => void> }) => (
  <main class="kb-main">
    <section class="kb-calendar-summary"><Metric label="Month" value={CALENDAR_MONTH_LABEL} /><Metric label="Scheduled" value={String(CALENDAR_EVENTS.length)} /><Metric label="Confirmed" value={String(CALENDAR_EVENTS.filter((event) => event.status === "confirmed").length)} /></section>
    <section class="kb-calendar-layout">
      <div class="kb-calendar-month">
        {CALENDAR_WEEKDAYS.map((day) => <strong key={day}>{day}</strong>)}
        {getCalendarMonthCells().map((day, index) => <div class="kb-calendar-day" data-today={day === CALENDAR_TODAY ? "true" : undefined} key={`${day ?? "empty"}-${index}`}><span>{day ?? ""}</span>{CALENDAR_EVENTS.filter((event) => event.day === day).map((event) => <a key={event.id} href={event.contextHref} preventdefault:click onClick$={() => props.onNavigate$(event.contextHref)}>{event.title}</a>)}</div>)}
      </div>
      <aside class="kb-calendar-agenda">{CALENDAR_EVENTS.map((event) => <a key={event.id} href={event.contextHref} preventdefault:click onClick$={() => props.onNavigate$(event.contextHref)}><span>June {event.day}, {event.timeLabel}</span><strong>{event.title}</strong><small>{event.locationLabel}</small></a>)}</aside>
    </section>
  </main>
));

export const SystemAdminPage = component$(() => {
  const status = useConvexQuery<{ missingScopedAggregateGroupCount: number; sampledEvidenceCount: number }>(
    $(() => ({ name: "contextExpertise:getScopedAggregateMigrationStatus", args: { aggregateSampleLimit: 5, paginationOpts: { cursor: null, numItems: 25 } } })),
  );
  return <main class="kb-main"><section class="kb-panel"><header><div><p class="kb-eyebrow">System Admin</p><h2>Migration readiness</h2></div></header>{status.error ? <ErrorText message={status.error} /> : <><Metric label="Missing groups" value={String(status.data?.missingScopedAggregateGroupCount ?? "...")} /><Metric label="Sampled evidence" value={String(status.data?.sampledEvidenceCount ?? "...")} /></>}</section></main>;
});

export const SummaryList = component$((props: {
  error: string;
  items: Array<{ href: string; label: string; totalVisits: number | string }>;
  title: string;
}) => (
  <section class="kb-panel">
    <header><div><p class="kb-eyebrow">Analytics</p><h2>{props.title}</h2></div></header>
    {props.error ? <ErrorText message={props.error} /> : props.items.length ? props.items.map((item) => <p class="kb-member-row" key={item.href}><span>{item.label}</span><strong>{item.totalVisits}</strong></p>) : <LoadingText label="Loading analytics" />}
  </section>
));

export const Metric = component$((props: { label: string; value: string }) => <div class="kb-metric"><span>{props.label}</span><strong>{props.value}</strong></div>);
export const LoadingText = component$((props: { label: string }) => <p class="kb-muted" role="status">{props.label}</p>);
export const ErrorText = component$((props: { message: string }) => <p class="kb-error" role="alert">{props.message}</p>);
export const IconGlyph = component$((props: { name: string }) => <span class="kb-glyph" aria-hidden="true">{glyphFor(props.name)}</span>);

function glyphFor(name: string) {
  const first = name.split("-").map((part) => part.charAt(0)).join("").slice(0, 2);
  return first || "L";
}

function accessTitle(access?: AppAccessState) {
  if (!access) return "Session required";
  if (access.status === "unauthenticated") return "Sign in required";
  if (access.status === "needsOrganization") return "Organization access required";
  if (access.status === "inactiveUser") return "Inactive user";
  return "Allowed";
}
