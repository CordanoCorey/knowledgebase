# Code Handoff: Header And Sidebar Navigation

## Coding Agent Prompt

You are implementing one frontend shell slice that was clarified through a grilling session.

Before editing code, read:

- `AGENTS.md`
- `CONTEXT.md`
- `docs/product-core.md`
- `docs/mvp-frontend-core-loop.md`
- `docs/agents/domain.md`
- `src/App.tsx`
- `src/index.css`

Do not re-litigate the documented navigation language unless code and docs directly contradict each other. If you touch Convex backend code, read `convex/_generated/ai/guidelines.md` first; this handoff is intended to avoid backend changes.

## What To Do

Refine and implement the app shell header/sidebar layout so it matches the resolved model:

- Sidebar carries destination navigation.
- Header carries Active Role and Global Search only.
- Current Knowledge Page / Active Knowledge Context stays below the header in page content.
- Account controls live behind the sidebar avatar, not in both header and sidebar.

Target type: narrowed frontend vertical slice.

This narrows the broader request to the first independently reviewable implementation: update the existing React/Vite shell UI using current route data and current signed-in access data. Do not add durable backend pin/bookmark/subscription persistence in this slice.

## Why This Target

The current shell is an icon-only rail plus a header with brand, theme, notifications, sign out, and search. The clarified design needs a clearer grammar:

- `Dashboard` is the fixed first global Knowledge Page.
- Pinned Knowledge Pages occupy the middle of the sidebar.
- Calendar and Notifications are visible bottom User View icons.
- Avatar is the account-menu entry point.
- Header is quiet: Active Role switcher plus Global Search.

This can be implemented as a frontend tracer bullet using existing `AllowedAppAccess.organizations` and existing route/page code, while leaving durable pin/bookmark/subscription tables for a later slice.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- Existing frontend loop decisions: `docs/mvp-frontend-core-loop.md`
- Agent docs: `AGENTS.md`, `docs/agents/domain.md`, `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`
- Existing prototype references: `src/prototypes/LayoutPrototype.tsx`, `src/prototypes/layoutPrototype.css`
- Existing handoff style: `docs/handoffs/mvp-frontend-contracts-and-routing.md`
- Relevant ADRs: No header/sidebar-specific ADR found.
- Issue docs: No issue found for this slice; inline issue brief below.

## Inline Issue Brief

### What To Build

Rework the app shell navigation so the sidebar/header embody the documented distinction between Knowledge Pages, User Views, Active Role, Global Search, bookmarks, pins, and subscriptions.

### Acceptance Criteria

- [ ] The first sidebar destination is fixed `Dashboard`; there is no separate `Explore` primary sidebar icon.
- [ ] The sidebar middle shows seeded Pinned Knowledge Pages derived from the current user's Organizations, capped to at most one Organization per kind where possible.
- [ ] Seeded Organization pins use the specific Organization name as the primary label, with kind shown through icon, secondary text, or grouping.
- [ ] Pinned Knowledge Pages have a visible label affordance on desktop; they are not icon-only except in a compact/collapsed responsive state.
- [ ] If visible pins exceed the available/capped space, the sidebar shows a concise overflow control such as `+3 more`.
- [ ] Bottom User View icons include Notifications with a visible unread/count badge and Calendar.
- [ ] Settings is not a persistent bottom icon; it is reachable through the sidebar avatar account menu.
- [ ] Profile is represented by the avatar only; there is no separate profile icon.
- [ ] The avatar/account menu includes Profile, Bookmarks shortcut, Settings, Sign out, and any existing user-preference action that must move out of the header, such as theme toggle.
- [ ] Profile editing is not a separate `Edit Profile` menu item; the profile page itself should expose editable fields when/where implemented.
- [ ] Header shows an Active Role display that also acts as a role switcher.
- [ ] Switching Active Role changes frontend acting-capacity state without navigating away.
- [ ] Navigating to an Organization Knowledge Page does not silently switch Active Role.
- [ ] Header Global Search remains visually separate from page/context-scoped ask/search controls.
- [ ] Header does not duplicate account controls already available through the sidebar avatar.
- [ ] The Knowledge Navigator remains visible on Knowledge Pages and is not shown as the main navigator on User Views such as Calendar or Notifications.
- [ ] Existing route rendering for Dashboard, Organization pages, Calendar, Notifications, Profile, and Settings still works.
- [ ] Existing related tests pass or are updated to match the new shell behavior.

### Out Of Scope

- Durable backend storage for user-created pins.
- Durable backend storage for bookmarks.
- Durable backend storage for subscriptions.
- Full global search backend implementation.
- Building a complete pin-management screen.
- Building a complete bookmarks workflow beyond a profile section/shortcut placeholder if needed.
- Reworking all page bodies beyond what is required to place the shell/header/sidebar correctly.

## Domain Language

- `Knowledge Page`: shared, world-facing location grounded in a Knowledge Context, Referent, Knowledge Entry, Organization, or similar knowledge object.
- `User View`: user-scoped view assembled around the current User's activity, responsibilities, preferences, or account state.
- `Active Knowledge Context`: the Knowledge Context in effect for the current Knowledge Page.
- `Recognized Context`: historical union of Knowledge Contexts where the user or organization took meaningful action; not the same as Active Knowledge Context.
- `Global Search`: search across everything the current User can access, independent of Active Knowledge Context.
- `Active Role`: unset by default so no single Role is foregrounded; when set, the single Role the User is currently acting in; header display and switcher.
- `Bookmark`: saved Knowledge Page for later reference; no sidebar placement and no notifications.
- `Pinned Knowledge Page`: Knowledge Page kept easy to return to, especially from sidebar navigation; no notifications by itself.
- `Subscription`: standing interest that affects notifications.

Avoid using `Place` for app location because `Place` is a Knowledge Type. Avoid using `folder`, `screen`, or `route` as product language for Knowledge Page.

## Decisions That Must Hold

- Dashboard is a fixed first sidebar route and not removable.
- Explore is an action, not a separate primary sidebar icon for now.
- Pinned Knowledge Pages should not rely on icon-only recognition.
- Default Organization pins are seeded from affiliations but can later be unpinned, and unpin suppression should persist in a future backend slice.
- Default pin seeding should be capped; do not dump every affiliation into the sidebar.
- Bookmarked Knowledge Pages should not appear directly in the primary sidebar.
- Bookmarks belong on the profile as a section/tab, with an avatar-menu shortcut.
- Notifications stay visible as a bottom User View icon because unread status needs a badge.
- Calendar is a bottom User View icon; specific Events remain Knowledge Pages.
- Settings belongs in the avatar/account menu unless future usage proves it needs a visible icon.
- The Active Role switcher does not navigate and should not auto-switch on Organization page navigation.
- Global Search result selection should navigate to the result's Knowledge Page and synchronize Knowledge Navigator active Tags to that page's Active Knowledge Context when that behavior is implemented.
- Context-scoped Search/Ask/Explore belongs below the header near the page title or Active Knowledge Context, not in the header.

## Relevant Code Map

- `src/App.tsx`: current route definitions, route matching, shell, sidebar, topbar, page scaffold, organization page config, profile/settings/notifications/calendar pages.
- `src/App.tsx:410`: current `PRIMARY_ROUTE_IDS`.
- `src/App.tsx:416`: current `USER_ROUTE_IDS`.
- `src/App.tsx:722`: `ORGANIZATION_PAGE_CONFIGS`, useful for Organization pin icons/kinds.
- `src/App.tsx:1428`: current `Sidebar`.
- `src/App.tsx:1481`: current `RouteNavLink`.
- `src/App.tsx:1506`: current `ProfileRouteLink`.
- `src/App.tsx:1530`: current `TopBar`.
- `src/App.tsx:1716`: current `PageScaffold`.
- `src/App.tsx:3055`: `formatOrganizationKind`.
- `src/App.tsx:3830`: current `KnowledgeNavigator`.
- `src/index.css`: current shell/sidebar/topbar/nav styling and responsive rules.
- `src/App.integrated.test.tsx`: existing integrated route and shell behavior tests.
- `src/prototypes/LayoutPrototype.tsx` and `src/prototypes/layoutPrototype.css`: earlier layout prototype references only; do not blindly copy.

## Implementation Guidance

- Keep the first slice frontend-only and deterministic.
- Derive seeded pinned Organization pages from `appAccess.organizations`.
- Use at most one default seeded pin per `organizationKind` in this slice. If the same kind appears more than once, choose the first/currently most available item and leave true relevance ranking for later.
- Use `ORGANIZATION_PAGE_CONFIGS` or existing organization helpers for icons and display labels where practical.
- Keep existing route definitions so direct URLs continue to work, even if some routes are removed from fixed sidebar navigation.
- Prefer small view-model helpers for sidebar items and Active Role options rather than hard-coding JSX branches throughout `Sidebar`.
- For Active Role, use local React state in this slice. Default to unset so no single Role is foregrounded; expose a dropdown/menu from the header display; do not persist it yet.
- Move `SignOutButton` out of the topbar and into the avatar/account menu.
- Move theme toggle out of the topbar if keeping the header to Active Role + Global Search requires it; avatar menu is a reasonable temporary home.
- Keep Notifications visibly reachable from the bottom sidebar with a badge. It can use existing static/client notification data for now if no backend count exists.
- Make labels responsive. Desktop should show labels; small screens may use compact rail/drawer behavior.
- Avoid broad refactors of page bodies. Touch page content only as needed to keep Knowledge Navigator behavior aligned.
- The worktree may already be dirty. Inspect diffs before editing and do not revert unrelated changes.

## Test Plan

Use TDD where practical:

1. Add or update an integrated test proving the shell renders Dashboard first, Organization pins with labels, and bottom User View icons.
2. Add or update a test proving Notifications has a visible badge/count affordance.
3. Add or update a test proving Settings is available through the avatar menu and not as a persistent bottom icon.
4. Add or update a test proving Active Role switching does not navigate away.
5. Add or update a test proving User Views do not render the main Knowledge Navigator while Knowledge Pages still do.
6. Implement the smallest UI/style changes to pass.
7. Do a browser check at desktop and mobile widths.

Prefer public behavior tests with Testing Library/Vitest instead of private implementation tests.

## Verification Commands

- `npx vitest run src/App.integrated.test.tsx`
- `npx tsc -b --pretty false`
- `npm run build`
- Manual browser check with Vite, for example `npm run dev -- --port 5178`, then inspect `/`, `/organizations/arche-classical-academy`, `/notifications`, `/calendar`, and `/profile` at desktop and mobile widths.

## Risks / Open Questions

- Analytics and Smart Storage placement in the new nav was not resolved in the grill. Avoid making them prominent fixed sidebar items unless needed to preserve existing tests; keep routes reachable by URL.
- Durable pin, bookmark, and subscription persistence is intentionally out of scope.
- True overflow-by-available-height may be more work than this slice needs. A deterministic visible cap with `+N more` is acceptable for the first slice.
- Full Global Search across all accessible content is out of scope. Preserve or lightly adapt current search suggestions; do not build a search backend in this slice.
- Organization pin seeding uses existing access data; true relevance ranking among multiple Organizations of the same kind is future work.

## Expected Final Response From Coding Agent

Summarize:

1. What changed in the header/sidebar.
2. What tests/checks passed.
3. Any docs that were updated or contradicted.
4. Any follow-up slices for durable pins/bookmarks/subscriptions or full search.
