# Code Handoff: Durable Subscriptions And Notification Readiness

## Coding Agent Prompt

You are implementing the next vertical slice after durable pins and durable bookmarks.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`
- `docs/mvp-frontend-core-loop.md`
- `docs/handoffs/header-sidebar-navigation.md`
- `docs/handoffs/durable-pinned-knowledge-pages.md`
- `docs/handoffs/durable-bookmarked-knowledge-pages.md`
- `src/App.tsx`
- `src/App.integrated.test.tsx`
- `src/index.css`
- `convex/schema.ts`
- `convex/lib/appAccess.ts`
- `convex/pinnedKnowledgePages.ts`
- `convex/bookmarkedKnowledgePages.ts`
- `convex/bookmarkedKnowledgePages.test.ts`

Do not re-litigate the resolved navigation language unless code and docs directly contradict each other. Keep this slice focused on durable Subscriptions and making them visible from the Notifications User View; do not build a full notification delivery engine, notification preferences, or broad saved-set management.

## What To Do

Persist Subscriptions as the user's standing interest in activity around a Knowledge target, beginning with Organization Knowledge Pages.

Implement durable user-specific subscriptions for Organization Knowledge Pages first:

- a Convex table and APIs for current-user subscriptions,
- an Organization Knowledge Page Subscribe / Unsubscribe control,
- a Notifications-page section that lists active subscription sources,
- an unsubscribe action from the Notifications page,
- no sidebar placement, no bookmark side effect, no pin side effect, and no generated notification events yet.

Target type: inferred next vertical slice.

## Why This Target

Pins and Bookmarks are now durable and intentionally separate. The remaining relationship clarified in the grill is `Subscription`: a standing interest that affects notification behavior. The app already has a persistent bottom `Notifications` User View and static notification cards, including a `subscription` kind, but there is no durable subscription model yet.

This slice creates the durable relationship without pretending notification generation is solved. It should make subscriptions visible where users expect notification-related state to live, while preserving the distinction:

- Bookmark: save for later.
- Pin: keep easy to navigate.
- Subscription: receive notification-relevant activity.
- Notification: a concrete notice that something happened.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- Frontend loop decisions: `docs/mvp-frontend-core-loop.md`
- Previous shell handoff: `docs/handoffs/header-sidebar-navigation.md`
- Previous pin handoff: `docs/handoffs/durable-pinned-knowledge-pages.md`
- Previous bookmark handoff: `docs/handoffs/durable-bookmarked-knowledge-pages.md`
- Convex guidance: `convex/_generated/ai/guidelines.md`
- Current app access helper: `convex/lib/appAccess.ts`
- Current bookmark implementation pattern: `convex/bookmarkedKnowledgePages.ts`, `convex/bookmarkedKnowledgePages.test.ts`
- Current schema: `convex/schema.ts`
- Current Organization page and Notifications page: `src/App.tsx`, `src/index.css`
- Existing integrated tests: `src/App.integrated.test.tsx`
- Relevant ADRs: no subscription-specific ADR found.
- Issue docs: no issue found for this slice; inline issue brief below.
- Prototype: no subscription prototype found; current Notifications page is the implementation reference.

## Inline Issue Brief

### What To Build

Add a persisted Subscription model for Organization Knowledge Pages and wire it through the visible product path:

1. A signed-in user can subscribe to an Organization Knowledge Page.
2. The Organization page shows whether the user is subscribed.
3. The Notifications User View lists active subscription sources.
4. The user can unsubscribe from the Organization page or Notifications page.
5. Subscribing does not pin, bookmark, or create notification rows.

### Acceptance Criteria

- [ ] A signed-in allowed user can query their active Subscriptions from Convex.
- [ ] A signed-in allowed user can subscribe to an Organization Knowledge Page they can access.
- [ ] Subscribing derives the current user server-side; no client function accepts `userId` for authorization.
- [ ] Subscription uniqueness is per user and per target.
- [ ] Re-subscribing to an already subscribed target is idempotent and updates `updatedAt` rather than creating duplicates.
- [ ] Unsubscribing removes only the current user's Subscription relationship.
- [ ] Unsubscribing does not remove a pin or bookmark for the same Knowledge Page.
- [ ] Subscribing does not create a pin or bookmark for the same Knowledge Page.
- [ ] Subscribing does not create a Notification row or change the unread notification count in this slice.
- [ ] The Organization Knowledge Page shows a Subscribe / Unsubscribe control distinct from Pin / Unpin and Bookmark / Remove Bookmark.
- [ ] The Notifications page renders a bounded list of active subscription sources with label, target metadata, link to the Knowledge Page, and an unsubscribe action.
- [ ] The bottom sidebar Notifications badge continues to mean unread Notifications, not subscription count.
- [ ] Subscribing an Organization Knowledge Page records the action as meaningful for Recognized Context by upserting a user `tagRecognitions` row for that Organization's canonical Tag when one can be resolved.
- [ ] Existing durable pin and durable bookmark tests still pass.

### Out Of Scope

- Notification event generation.
- Notification read/unread persistence.
- Notification delivery, email, push, digest, or preference settings.
- Subscribing to every possible target type.
- Subscribing to User Views.
- Subscription groups, folders, muting, frequency controls, or recommendation UI.
- Sidebar placement for subscriptions.
- Full Global Search.

## Domain Language

- `Subscription`: a user's standing interest in activity within a Knowledge Context, Organization, Knowledge Slot, or Event.
- `Notification`: a user-visible notice that relevant activity occurred within a Subscription, assigned Knowledge Slot, or Event participation.
- `Bookmark`: a User relationship to a Knowledge Page saved for later reference. It does not place the page in sidebar navigation and does not subscribe the User to notifications.
- `Pinned Knowledge Page`: a User relationship to a Knowledge Page that keeps it easy to return to from sidebar navigation. It does not subscribe the User to notifications.
- `Knowledge Page`: a shared, world-facing location grounded in a Knowledge Context, Referent, Knowledge Entry, Organization, or other knowledge object.
- `User View`: a current-user scoped view such as Calendar, Notifications, Settings, or editing the user's own profile.
- `Recognized Context`: the historical union of Knowledge Contexts where a User or Organization has taken meaningful action.

Avoid `follow`, `alert`, and `notification setting` as canonical domain terms for this slice. The UI verb can be `Subscribe`, but the stored relationship should be a `Subscription`.

## Decisions That Must Hold

- Subscription is separate from Bookmark.
- Subscription is separate from Pinning.
- Subscription is separate from Notification.
- A Subscription may affect notification behavior, but it is not itself a Notification.
- Notifications remain a bottom User View icon because unread status needs a persistent badge.
- The Notifications badge should not count Subscriptions.
- Bookmarked Knowledge Pages should not appear directly in the primary sidebar.
- Pinned Knowledge Pages remain the sidebar middle group.
- Plain page visits alone should not add to Recognized Context.
- Subscribing is a meaningful action and may contribute to Recognized Context.
- Dashboard stays the fixed first sidebar route.

## Relevant Code Map

- `convex/schema.ts:364`: existing `tagRecognitions` table; use this for Recognized Context when subscribing resolves a canonical Tag.
- `convex/schema.ts:428`: existing `pinnedKnowledgePages`; do not overload this table for subscriptions.
- `convex/schema.ts:451`: existing `bookmarkedKnowledgePages`; model subscriptions separately.
- `convex/lib/appAccess.ts`: use `requireAppAccess(ctx)` for current `userId` and allowed Organizations.
- `convex/bookmarkedKnowledgePages.ts`: good pattern for current-user relationships, page keys, Organization access checks, idempotent upsert, tag recognition, and bounded list queries.
- `convex/bookmarkedKnowledgePages.test.ts`: good pattern for Convex relationship tests.
- `src/App.tsx:209`: `NotificationKind` already includes `subscription` for static notices.
- `src/App.tsx:581`: static subscription-kind notification example.
- `src/App.tsx:2422`: Organization page already has Pin and Bookmark mutations/queries; add Subscription nearby.
- `src/App.tsx:2530`: Organization page controls currently contain Pin and Bookmark buttons; add Subscribe without making the hero crowded.
- `src/App.tsx:3831`: `NotificationsPage` currently renders static `USER_NOTIFICATIONS`; add active subscription sources here without replacing notification cards.
- `src/App.integrated.test.tsx:769`: recent bookmark tests are the closest frontend pattern.
- `src/index.css:1520`: Organization page control styles.
- `src/index.css:2873`: Notifications summary/panel styles.

## Suggested Data Model

Add a table such as `knowledgeSubscriptions` or `userKnowledgeSubscriptions` in `convex/schema.ts`.

Suggested fields:

- `userId: v.id("users")`
- `subscriptionKey: v.string()`; stable unique key such as `organization:<referentId>`
- `targetKind: v.union(v.literal("organization"))` for this slice
- `organizationReferentId: v.optional(v.id("referents"))`
- `targetReferentId: v.optional(v.id("referents"))`
- `targetTagId: v.optional(v.id("tags"))`
- `labelSnapshot: v.string()`
- `hrefSnapshot: v.string()`
- `secondaryLabelSnapshot: v.optional(v.string())`
- `createdAt: v.number()`
- `updatedAt: v.number()`

Suggested indexes:

- `by_userId_and_subscriptionKey`
- `by_userId_and_updatedAt`
- `by_userId_and_targetKind_and_updatedAt`
- `by_targetKind_and_targetReferentId`
- optionally `by_targetTagId`

The exact shape can differ if a cleaner local pattern emerges, but preserve these capabilities:

- unique current-user/target relationship,
- bounded current-user listing,
- future lookup of subscribers by target for notification generation,
- enough target metadata for UI display without expensive joins,
- separation from pins, bookmarks, and notifications.

Do not add notification frequency or delivery preferences in this slice. That is a separate settings problem.

## Suggested Convex API

Create a focused module such as `convex/knowledgeSubscriptions.ts`.

Suggested public functions:

- `listForNotifications`: query, no args or optional bounded `limit`. Requires app access. Returns active subscription summaries newest first.
- `getForTarget`: query, args `{ subscriptionKey: v.string() }`. Requires app access. Returns the current user's subscription summary for that target or `null`.
- `subscribeOrganizationPage`: mutation, args `{ organizationReferentId: v.id("referents") }`. Requires app access and active membership/access to that Organization. Upserts the Subscription relationship.
- `unsubscribe`: mutation, args `{ subscriptionKey: v.string() }`. Requires app access. Removes only the current user's Subscription row for that target.

Implementation notes:

- Do not accept `userId` from the client.
- Use `requireAppAccess(ctx)` and derive `userId` server-side.
- Use indexes, not query filters.
- Keep query results bounded.
- Reuse target identity conventions from pins/bookmarks, e.g. `organization:${organizationReferentId}` and `/organizations/${organizationReferentId}`.
- To resolve Organization metadata, use `access.organizations` first.
- If a Subscription points to an Organization the user no longer has access to, do not leak current Organization data. It is acceptable in this slice to omit that Subscription from the list or return only snapshot fields, but document the choice in the final response.
- For Recognized Context, when subscribing to an Organization page:
  - find a Tag for `organizationReferentId` via `tags.by_referentId`,
  - upsert a user `tagRecognitions` row via `by_userId_and_tagId`,
  - set `recognizerKind: "user"`, `userId`, `recognizedAt`, and `lastInteractedAt`,
  - update `lastInteractedAt` on repeat subscribe,
  - do not remove tag recognition on unsubscribe, because Recognized Context is historical.

## Frontend Guidance

- Add a compact Subscribe / Unsubscribe control to Organization Knowledge Pages near the existing Pin and Bookmark controls.
- Keep the control visually distinct from Pin and Bookmark. Use a bell-style icon if available from `lucide-react`.
- Do not add explanatory copy that turns the hero into a tutorial. The button label is enough for this slice.
- Add a query to the Organization page to determine whether the current target is subscribed.
- Add a query to `NotificationsPage` for active Subscriptions.
- Add a section or panel on `NotificationsPage` for active subscription sources. Suggested heading: `Subscriptions` or `Subscription Sources`.
- Each subscription row should link to the Knowledge Page and include target metadata such as `School`, `Church`, `Family`, or `Community`.
- Include an unsubscribe action in the subscription source row if it can be done without clutter.
- Keep existing static notification cards and filters working. This slice should not require a durable Notification table.
- Do not put Subscriptions in the sidebar or avatar menu.
- Do not change the Notifications badge semantics.

## Test Plan

Use TDD where practical.

Convex tests:

1. Add `convex/knowledgeSubscriptions.test.ts`.
2. Use the same seeded user/Organization helpers or patterns from `convex/bookmarkedKnowledgePages.test.ts`.
3. Assert `listForNotifications` returns an empty list when the user has no Subscriptions.
4. Assert `subscribeOrganizationPage` creates one Subscription row for an accessible Organization Knowledge Page.
5. Assert calling `subscribeOrganizationPage` twice does not create duplicates and updates the existing row.
6. Assert `getForTarget` returns the current user's Subscription for that target.
7. Assert `unsubscribe` removes the Subscription for the current user only.
8. Assert unauthorized, inactive, and no-organization users cannot subscribe to Organization pages.
9. Assert subscribing an Organization page upserts a user `tagRecognitions` row when the Organization Tag exists.

Frontend tests:

1. Extend `src/App.integrated.test.tsx` mocks to support Subscription queries/mutations.
2. Assert the Organization page Subscribe / Unsubscribe control calls the correct mutation and toggles after mock state changes.
3. Assert subscribing does not change `Knowledge Page destinations`.
4. Assert subscribing does not create a bookmark in the profile Bookmarks section.
5. Assert the Notifications page renders durable subscription sources with links and an unsubscribe action.
6. Assert the bottom sidebar Notifications badge remains based on unread notifications rather than subscription count.
7. Assert existing pin and bookmark integrated tests still pass.

## Verification Commands

- `npx convex codegen`
- `npx vitest run convex/knowledgeSubscriptions.test.ts`
- `npx vitest run src/App.integrated.test.tsx`
- `npx vitest run convex/pinnedKnowledgePages.test.ts convex/bookmarkedKnowledgePages.test.ts convex/knowledgeSubscriptions.test.ts`
- `npx vitest run convex/knowledgeSubscriptions.test.ts src/App.integrated.test.tsx`
- `npx tsc -b --pretty false`
- `npm run build`

Manual browser check if a signed-in local session is available:

- Start Vite on an open port.
- Visit an Organization Knowledge Page.
- Subscribe to it.
- Open Notifications.
- Confirm the subscription source appears.
- Unsubscribe from Notifications and confirm the Organization page control reflects the change.
- Confirm sidebar pins and profile bookmarks are unchanged.

If the browser only reaches the unauthenticated sign-in screen, say so and rely on the automated tests for signed-in behavior.

## Risks / Open Questions

- This slice supports Organization Knowledge Page Subscriptions first. Broader targets such as Context Pages, Tags, Knowledge Entries, Events, Groups, and Knowledge Slots should be separate follow-up slices.
- The durable Notification model is not part of this slice. The existing static notification cards can remain until a later notification-generation slice.
- Notification frequency, muting, delivery channels, and digest settings are unresolved. Do not add them here.
- If a user loses Organization access, the product behavior is not fully specified. Prefer a conservative implementation that does not expose current Organization data beyond `requireAppAccess`.
- `docs/*` may be ignored by `.gitignore`; if this handoff needs to be committed, force-add it intentionally.

## Expected Final Response From Coding Agent

Summarize:

1. What durable Subscription backend and frontend behavior changed.
2. Whether tag recognition was updated for subscribe actions.
3. What tests/checks passed.
4. Any generated files or codegen steps.
5. What remains for broader subscription targets, durable notifications, delivery preferences, and notification generation.
