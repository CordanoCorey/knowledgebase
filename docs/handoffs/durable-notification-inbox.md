# Code Handoff: Durable Notification Inbox

## Coding Agent Prompt

You are implementing the next vertical slice after durable pins, bookmarks, and subscriptions.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`
- `docs/mvp-frontend-core-loop.md`
- `docs/handoffs/header-sidebar-navigation.md`
- `docs/handoffs/durable-pinned-knowledge-pages.md`
- `docs/handoffs/durable-bookmarked-knowledge-pages.md`
- `docs/handoffs/durable-subscriptions-notification-readiness.md`
- `src/App.tsx`
- `src/App.integrated.test.tsx`
- `src/index.css`
- `convex/schema.ts`
- `convex/lib/appAccess.ts`
- `convex/knowledgeSubscriptions.ts`
- `convex/knowledgeSubscriptions.test.ts`

Do not re-litigate the resolved navigation language unless code and docs directly contradict each other. Keep this slice focused on durable notification inbox rows and read/unread state; do not build notification generation, delivery channels, notification preferences, muting, or broader subscription targets.

## What To Do

Replace the static Notifications feed source with a durable current-user Notification inbox.

Implement durable user-specific notifications with:

- a Convex table and APIs for listing current-user inbox notifications,
- durable read/unread status,
- notification summary/filter counts and sidebar badge derived from durable rows,
- a mark read/unread action from the Notifications page,
- current static notification fixtures moved into tests or seed helpers as needed,
- no automatic notification generation from subscriptions yet.

Target type: inferred next vertical slice.

## Why This Target

The app now has durable `Subscription` sources, but the actual notification cards are still hard-coded in `src/App.tsx` as `USER_NOTIFICATIONS`. That means unread count, notification filters, and read state cannot persist.

This slice makes the Notifications User View real without taking on the larger system that decides when activity should create notifications. It preserves the distinction:

- `Subscription`: a standing relationship that may affect notification behavior.
- `Notification`: a concrete user-visible notice that something relevant occurred.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- Frontend loop decisions: `docs/mvp-frontend-core-loop.md`
- Previous shell handoff: `docs/handoffs/header-sidebar-navigation.md`
- Previous pin handoff: `docs/handoffs/durable-pinned-knowledge-pages.md`
- Previous bookmark handoff: `docs/handoffs/durable-bookmarked-knowledge-pages.md`
- Previous subscription handoff: `docs/handoffs/durable-subscriptions-notification-readiness.md`
- Convex guidance: `convex/_generated/ai/guidelines.md`
- Current app access helper: `convex/lib/appAccess.ts`
- Current subscription implementation pattern: `convex/knowledgeSubscriptions.ts`, `convex/knowledgeSubscriptions.test.ts`
- Current schema: `convex/schema.ts`
- Current Notifications page: `src/App.tsx`, `src/index.css`
- Existing integrated tests: `src/App.integrated.test.tsx`
- Relevant ADRs: no notification-inbox-specific ADR found.
- Issue docs: no issue found for this slice; inline issue brief below.
- Prototype: no notification inbox prototype found; current static Notifications page is the implementation reference.

## Inline Issue Brief

### What To Build

Add a persisted Notification inbox for the current user and wire the existing Notifications User View to it:

1. A signed-in user can see durable Notifications in the Notifications page.
2. The sidebar Notifications badge reflects durable unread notifications.
3. The Notifications page summary and filters use durable notification rows.
4. The user can mark a notification read and the state persists.
5. Durable subscription sources remain visible but do not themselves count as notification rows.

### Acceptance Criteria

- [ ] A signed-in allowed user can query their recent inbox Notifications from Convex.
- [ ] Notification queries derive the current user server-side; no client function accepts `userId` for authorization.
- [ ] The query returns a bounded recent inbox and summary data needed by the UI.
- [ ] A Notification row includes title, body, kind, status, received time, context label, and context href.
- [ ] The Notifications page renders durable notification rows instead of `USER_NOTIFICATIONS`.
- [ ] The sidebar Notifications badge is derived from durable unread Notification rows, not static data and not active Subscription count.
- [ ] Filters for All, Unread, Knowledge Slots, and Events work against durable rows.
- [ ] Existing Subscription-kind notifications still show in All/Unread if present, even if there is no separate Subscription filter.
- [ ] The user can mark an unread Notification as read.
- [ ] Marking read updates the row only for the current user.
- [ ] After marking read, the unread badge/count and Unread filter update.
- [ ] Opening or reading a Notification does not unsubscribe from any Subscription.
- [ ] Active Subscription sources remain a separate Notifications-page panel and are not counted as notifications.
- [ ] Existing durable pin, bookmark, and subscription tests still pass.

### Out Of Scope

- Generating notifications from subscription activity.
- Generating notifications from Knowledge Slot assignment or Event participation.
- Delivery channels such as email, push, SMS, or digests.
- Notification preferences, muting, quiet hours, or frequency controls.
- Exact unbounded unread counters if the implementation uses a bounded inbox query for MVP.
- Multi-user/admin notification broadcast tooling.
- Broader subscription targets.

## Domain Language

- `Notification`: a user-visible notice that relevant activity occurred within a Subscription, assigned Knowledge Slot, or Event participation.
- `Subscription`: a user's standing interest in activity within a Knowledge Context, Organization, Knowledge Slot, or Event.
- `User View`: a current-user scoped view such as Calendar, Notifications, Settings, or editing the user's own profile.
- `Knowledge Page`: a shared, world-facing location grounded in a Knowledge Context, Referent, Knowledge Entry, Organization, or other knowledge object.

Avoid `message` and `feed item` as canonical domain terms. Do not call a Subscription row a Notification.

## Decisions That Must Hold

- Notification is not a Knowledge Type.
- Notifications are reactions to existing Knowledge Entries, Knowledge Slots, Events, Subscriptions, or system opportunities.
- Subscription is separate from Notification.
- The Notifications route is a User View and should not show the Knowledge Navigator as its main navigator.
- Notifications remain a visible bottom sidebar User View icon because unread status needs a persistent badge.
- The badge means unread Notifications, not active Subscriptions.
- Subscription sources on the Notifications page remain separate from notification cards.

## Relevant Code Map

- `src/App.tsx:207`: current `NotificationFilter`, `NotificationKind`, and `NotificationStatus` types.
- `src/App.tsx:555`: current static `USER_NOTIFICATIONS` fixtures; replace as runtime source.
- `src/App.tsx:1561`: sidebar currently gets unread count from `getUnreadNotificationCount()`.
- `src/App.tsx:2941`: `getUnreadNotificationCount()` currently counts static rows.
- `src/App.tsx:3892`: `NotificationsPage` currently queries subscription sources but filters static notification rows.
- `src/App.tsx:3907`: `filteredNotifications` currently comes from `USER_NOTIFICATIONS`.
- `src/App.tsx:3933`: notification summary cards.
- `src/App.tsx:3958`: Subscription Sources panel; keep it separate.
- `src/App.tsx:4012`: Notification Feed panel and filter controls.
- `src/App.integrated.test.tsx:1407`: current static notification-route behavior test.
- `src/App.integrated.test.tsx:1440`: current durable subscription sources test.
- `src/index.css:2885`: Notifications page styles.
- `convex/schema.ts:475`: existing `knowledgeSubscriptions`; do not overload this table for notification rows.
- `convex/knowledgeSubscriptions.ts`: current relationship API pattern and auth/access style.

## Suggested Data Model

Add a table such as `userNotifications` in `convex/schema.ts`.

Suggested validators:

- `notificationKind`: `answer | event | knowledgeSlot | subscription`
- `notificationStatus`: `read | unread`
- optionally `notificationSourceKind`: `subscription | knowledgeSlot | event | system`

Suggested fields:

- `userId: v.id("users")`
- `notificationKind`
- `notificationStatus`
- `title: v.string()`
- `body: v.string()`
- `contextLabel: v.string()`
- `contextHref: v.string()`
- `receivedAt: v.number()`
- `readAt: v.optional(v.number())`
- `sourceKind: v.optional(notificationSourceKind)`
- `sourceSubscriptionKey: v.optional(v.string())`
- `sourceSubscriptionId: v.optional(v.id("knowledgeSubscriptions"))`
- `targetReferentId: v.optional(v.id("referents"))`
- `targetTagId: v.optional(v.id("tags"))`
- `createdAt: v.number()`
- `updatedAt: v.number()`

Suggested indexes:

- `by_userId_and_receivedAt`
- `by_userId_and_notificationStatus_and_receivedAt`
- `by_userId_and_notificationKind_and_receivedAt`
- `by_sourceSubscriptionKey_and_receivedAt`

The exact shape can differ if a cleaner local pattern emerges, but preserve these capabilities:

- current-user inbox listing,
- durable read/unread state,
- efficient bounded filtering by status and kind,
- future notification generation from Subscription targets,
- separation from Subscription rows themselves.

## Suggested Convex API

Create a focused module such as `convex/userNotifications.ts`.

Suggested public functions:

- `listForInbox`: query, args `{ limit?: number }`. Requires app access. Returns recent notifications plus summary counts for the returned inbox window.
- `getUnreadSummary`: optional query if the sidebar needs a smaller payload than the full inbox. Requires app access. Returns unread count and latest received timestamp from a bounded recent window.
- `markRead`: mutation, args `{ notificationId: v.id("userNotifications") }`. Requires app access and verifies row ownership.
- `markUnread`: optional mutation, same ownership check.

Implementation notes:

- Do not accept `userId` from the client.
- Use `requireAppAccess(ctx)` and derive `userId` server-side.
- Use indexes, not query filters.
- Keep query results bounded.
- If exact counts beyond a bounded inbox become necessary later, add a denormalized counter table in a future slice rather than scanning every notification row.
- For this slice, tests may insert notification rows directly with `convex-test` or use an internal helper. Do not build a public notification-creation UI.
- If you add an internal creation helper for future generators, register it as `internalMutation`, not public `mutation`, unless there is a clear current UI need.

## Frontend Guidance

- Replace runtime use of `USER_NOTIFICATIONS` with `api.userNotifications.listForInbox` data.
- Keep static notification fixture data only in tests or a seed helper if needed. It should not remain the live app source of truth.
- While the query is loading, show a stable loading state rather than falling back to static rows as if they are real.
- If the query returns an empty inbox, show the existing calm empty state.
- Derive filter tabs and summary counts from durable query results.
- Derive the sidebar unread badge from a durable unread summary or the inbox query data. It must not count active subscription sources.
- Add a compact action on each notification card to mark read when unread. If adding mark-unread for read notifications is small and fits the UI, it is acceptable but not required.
- Keep the existing `Open` action. Opening a Knowledge Page may also mark read if implemented carefully, but an explicit Mark read action is enough for this slice.
- Keep the Subscription Sources panel in `NotificationsPage`. Do not merge it into the Notification Feed.
- Do not add delivery preference controls.

## Test Plan

Use TDD where practical.

Convex tests:

1. Add `convex/userNotifications.test.ts`.
2. Seed an allowed user and insert a few notification rows for that user.
3. Assert `listForInbox` returns only the current user's notifications, sorted newest first.
4. Assert `listForInbox` or `getUnreadSummary` reports unread count from durable rows.
5. Assert status and kind filters are backed by indexed queries or bounded query shaping.
6. Assert `markRead` changes an unread notification to read and sets `readAt`.
7. Assert one user cannot mark another user's notification read.
8. Assert unauthenticated, inactive, and no-organization users cannot read or mutate inbox notifications.

Frontend tests:

1. Extend `src/App.integrated.test.tsx` mocks to support durable notification queries/mutations.
2. Assert the sidebar Notifications badge reflects mocked durable unread rows.
3. Assert `/notifications` renders durable notification rows and summary counts.
4. Assert All, Unread, Knowledge Slots, and Events filters work with durable rows.
5. Assert marking a notification read calls the correct mutation and updates the badge/filter result after mock state changes.
6. Assert Subscription Sources still render separately and do not affect unread count.
7. Assert existing pin, bookmark, and subscription integrated tests still pass.

## Verification Commands

- `npx convex codegen`
- `npx vitest run convex/userNotifications.test.ts`
- `npx vitest run src/App.integrated.test.tsx`
- `npx vitest run convex/pinnedKnowledgePages.test.ts convex/bookmarkedKnowledgePages.test.ts convex/knowledgeSubscriptions.test.ts convex/userNotifications.test.ts`
- `npx vitest run convex/userNotifications.test.ts src/App.integrated.test.tsx`
- `npx tsc -b --pretty false`
- `npm run build`

Manual browser check if a signed-in local session is available:

- Start Vite on an open port.
- Visit `/notifications`.
- Confirm durable notification rows render.
- Mark one unread notification read.
- Confirm the unread summary and sidebar badge update.
- Confirm Subscription Sources remain visible and unchanged.

If the browser only reaches the unauthenticated sign-in screen, say so and rely on the automated tests for signed-in behavior.

## Risks / Open Questions

- This slice does not decide when notifications are generated. That should be a separate workflow/generator slice.
- Exact unread counts across an unbounded inbox may require a denormalized counter later. A bounded MVP inbox summary is acceptable for this slice unless the implementation already has a cheap counter pattern.
- Existing static notification fixtures may disappear from runtime unless seeded as durable rows. Prefer tests or seed helpers over keeping static runtime source-of-truth arrays.
- Notification preferences, muting, and delivery channels are unresolved.
- `docs/*` may be ignored by `.gitignore`; if this handoff needs to be committed, force-add it intentionally.

## Expected Final Response From Coding Agent

Summarize:

1. What durable notification inbox backend and frontend behavior changed.
2. How unread counts and read state are persisted.
3. What tests/checks passed.
4. Any generated files or codegen steps.
5. What remains for notification generation, delivery preferences, muting, and exact large-scale counters.
