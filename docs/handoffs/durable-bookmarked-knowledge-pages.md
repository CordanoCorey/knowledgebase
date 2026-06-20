# Code Handoff: Durable Bookmarked Knowledge Pages

## Coding Agent Prompt

You are implementing the next vertical slice after durable sidebar pins.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`
- `docs/mvp-frontend-core-loop.md`
- `docs/handoffs/header-sidebar-navigation.md`
- `docs/handoffs/durable-pinned-knowledge-pages.md`
- `src/App.tsx`
- `src/App.integrated.test.tsx`
- `src/index.css`
- `convex/schema.ts`
- `convex/lib/appAccess.ts`
- `convex/pinnedKnowledgePages.ts`
- `convex/pinnedKnowledgePages.test.ts`

Do not re-litigate the resolved navigation language unless code and docs directly contradict each other. Keep this slice focused on durable Bookmarks and the profile Bookmarks section; do not build subscriptions, full Global Search, drag ordering, or a full pin/bookmark management screen.

## What To Do

Persist Bookmarks as a personal saved set of Knowledge Pages and surface them from the existing avatar/profile flow.

Implement durable user-specific bookmarks for Organization Knowledge Pages first:

- a Convex table and APIs for the current user's bookmarked Knowledge Pages,
- an Organization Knowledge Page Bookmark / Remove Bookmark control,
- the existing profile `Bookmarks` section backed by real bookmark data,
- the existing avatar menu `Bookmarks` shortcut pointing to that profile section,
- no sidebar placement and no notification/subscription behavior.

Target type: inferred next vertical slice.

## Why This Target

The shell and durable pin slices made navigation usable and durable. The remaining resolved concept that already has a UI entry point is `Bookmark`: a User relationship to a Knowledge Page for later reference. `src/App.tsx` already has an avatar-menu link to `/profile?section=bookmarks` and a profile placeholder that says durable bookmarks are pending.

This slice turns that placeholder into real behavior while staying narrow. Organization Knowledge Pages are the first target because they already have durable page identity from the pin slice, visible page controls, active tags, and existing authenticated organization access data.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- Frontend loop decisions: `docs/mvp-frontend-core-loop.md`
- Previous shell handoff: `docs/handoffs/header-sidebar-navigation.md`
- Previous pin handoff: `docs/handoffs/durable-pinned-knowledge-pages.md`
- Convex guidance: `convex/_generated/ai/guidelines.md`
- Current app access helper: `convex/lib/appAccess.ts`
- Current pin implementation pattern: `convex/pinnedKnowledgePages.ts`, `convex/pinnedKnowledgePages.test.ts`
- Current schema: `convex/schema.ts`
- Current shell/profile/Organization pages: `src/App.tsx`, `src/index.css`
- Existing integrated tests: `src/App.integrated.test.tsx`
- Relevant ADRs: no bookmark-specific ADR found.
- Issue docs: no issue found for this slice; inline issue brief below.
- Prototype: no bookmark prototype found; current profile placeholder is the implementation reference.

## Inline Issue Brief

### What To Build

Add a persisted Bookmark model for Knowledge Pages and wire it through the visible product path:

1. A signed-in user can bookmark an Organization Knowledge Page.
2. The bookmarked page appears in the user's profile Bookmarks section.
3. The user can remove the bookmark from the Organization page or profile section.
4. The bookmark never appears in the primary sidebar and does not create notifications.

### Acceptance Criteria

- [ ] A signed-in allowed user can query their bookmarked Knowledge Pages from Convex.
- [ ] A signed-in allowed user can bookmark an Organization Knowledge Page they can access.
- [ ] Bookmarking derives the current user server-side; no client function accepts `userId` for authorization.
- [ ] Bookmark uniqueness is per user and per Knowledge Page.
- [ ] Re-bookmarking an already bookmarked page is idempotent and updates `updatedAt` or `lastReferencedAt` rather than creating duplicates.
- [ ] Removing a bookmark deletes or hides only the current user's relationship to that Knowledge Page.
- [ ] Removing a bookmark does not unpin the page and does not unsubscribe the user from anything.
- [ ] Bookmarking does not add the page to the sidebar.
- [ ] The profile Bookmarks section renders bookmarked Knowledge Pages with label, kind/scope metadata, and a link back to each Knowledge Page.
- [ ] The avatar menu `Bookmarks` shortcut remains `/profile?section=bookmarks` and lands the user at the profile Bookmarks section.
- [ ] The Organization Knowledge Page shows a clear Bookmark / Remove Bookmark control that is visually distinct from Pin / Unpin.
- [ ] Bookmarking an Organization Knowledge Page records the action as meaningful for Recognized Context by upserting a user `tagRecognitions` row for that Organization's canonical Tag when one can be resolved.
- [ ] Existing durable pin behavior and sidebar overflow behavior still pass.

### Out Of Scope

- Bookmarking every possible Knowledge Page type.
- Bookmarking User Views.
- Bookmark folders, tags, notes, bulk management, or search inside bookmarks.
- Recommendation UI or LLM prompting powered by bookmarks.
- Subscriptions or notification preferences.
- Pin management, drag ordering, or sidebar changes beyond proving bookmarks do not appear there.
- Full Global Search implementation.

## Domain Language

- `Bookmark`: a User relationship to a Knowledge Page that saves it in the User's personal saved set for later reference and may inform user-specific tagging or Knowledge Context recommendations.
- `Pinned Knowledge Page`: a User relationship to a Knowledge Page that keeps it easy to return to from navigation, especially the sidebar.
- `Subscription`: a User relationship that affects notification behavior.
- `Knowledge Page`: a shared, world-facing location grounded in a Knowledge Context, Referent, Knowledge Entry, Organization, or other knowledge object.
- `User View`: a current-user scoped view such as Calendar, Notifications, Settings, or editing the user's own profile.
- `Recognized Context`: the historical union of Knowledge Contexts where a User or Organization has taken meaningful action.

Avoid `favorite` as product language. Do not use `Bookmark` to mean pin, subscription, or notification preference.

## Decisions That Must Hold

- Bookmarks are separate from pins.
- Bookmarked Knowledge Pages do not appear directly in the primary sidebar by default.
- Bookmarks belong in user/account navigation, currently the user's profile section reached from the avatar menu.
- Bookmarking does not subscribe the user to notifications.
- Bookmarking is a meaningful action and may contribute to Recognized Context.
- Plain page visits alone should not add to Recognized Context.
- Dashboard stays the fixed first sidebar route.
- Pinned Knowledge Pages remain the sidebar middle group.
- Settings and the user's profile remain in the avatar account menu path, not duplicated in the header.

## Relevant Code Map

- `convex/schema.ts:364`: existing `tagRecognitions` table; use this for Recognized Context when bookmarking resolves a canonical Tag.
- `convex/schema.ts:428`: existing `pinnedKnowledgePages` table; model bookmarks separately, do not overload this table.
- `convex/lib/appAccess.ts`: use `requireAppAccess(ctx)` for current `userId` and allowed Organizations.
- `convex/pinnedKnowledgePages.ts`: good pattern for page keys, auth, Organization membership checks, bounded list queries, and sidebar-ready summaries.
- `convex/pinnedKnowledgePages.test.ts`: good pattern for `convex-test`, seeded users/Organizations, and mutation authorization tests.
- `src/App.tsx:1134`: current durable pin query; add bookmark queries nearby only where needed.
- `src/App.tsx:1704`: avatar menu already links to `/profile?section=bookmarks`.
- `src/App.tsx:2385`: `OrganizationPage` already computes `profile`, active tags, `currentPageKey`, and Pin / Unpin state.
- `src/App.tsx:3324`: profile `Bookmarks` section currently contains a durable bookmarks placeholder.
- `src/App.integrated.test.tsx:50`: current app mock state includes durable pins; extend it for bookmarks.
- `src/App.integrated.test.tsx:716`: existing avatar menu test asserts the Bookmarks shortcut.
- `src/App.integrated.test.tsx:727`: existing durable pin toggle test; add a sibling bookmark toggle test without breaking pin expectations.
- `src/index.css:1985`: profile panel styles.
- `src/index.css:1514`: Organization Pin / Unpin button styles; add separate Bookmark control styling without making the hero feel crowded.

## Suggested Data Model

Add a table such as `bookmarkedKnowledgePages` in `convex/schema.ts`.

Suggested fields:

- `userId: v.id("users")`
- `pageKey: v.string()`; stable unique key such as `organization:<referentId>`
- `pageKind: v.union(v.literal("organization"))` for this slice
- `organizationReferentId: v.optional(v.id("referents"))`
- `targetReferentId: v.optional(v.id("referents"))`
- `targetTagId: v.optional(v.id("tags"))`
- `labelSnapshot: v.string()`
- `hrefSnapshot: v.string()`
- `secondaryLabelSnapshot: v.optional(v.string())`
- `createdAt: v.number()`
- `updatedAt: v.number()`
- `lastReferencedAt: v.optional(v.number())`

Suggested indexes:

- `by_userId_and_pageKey`
- `by_userId_and_createdAt`
- `by_userId_and_updatedAt`
- optionally `by_userId_and_pageKind_and_updatedAt`

The exact shape can differ if a cleaner local pattern emerges, but preserve these capabilities:

- unique current-user/page relationship,
- bounded current-user listing,
- enough target metadata for profile display without expensive joins,
- enough target metadata for future recommendation logic,
- separation from pins and subscriptions.

Do not store an unbounded array of all future context tags on the bookmark row. For this slice, a single Organization target tag is enough. Broader Context Page bookmarks can add a separate child table later if needed.

## Suggested Convex API

Create a focused module such as `convex/bookmarkedKnowledgePages.ts`.

Suggested public functions:

- `listForProfile`: query, no args or optional bounded `limit`. Requires app access. Returns bookmark summaries newest or recently referenced first.
- `getForPage`: query, args `{ pageKey: v.string() }`. Requires app access. Returns the current user's bookmark summary for that page or `null`.
- `bookmarkOrganizationPage`: mutation, args `{ organizationReferentId: v.id("referents") }`. Requires app access and active membership/access to that Organization. Upserts the bookmark relationship.
- `removeBookmark`: mutation, args `{ pageKey: v.string() }`. Requires app access. Removes only the current user's bookmark row for that page.

Implementation notes:

- Do not accept `userId` from the client.
- Use `requireAppAccess(ctx)` and derive `userId` server-side.
- Use indexes, not query filters.
- Keep query results bounded.
- Reuse page identity conventions from pins, e.g. `organization:${organizationReferentId}` and `/organizations/${organizationReferentId}`.
- To resolve Organization metadata, use the current user's `access.organizations` first. If a bookmark points at an old Organization the user no longer has access to, it is acceptable in this slice to omit it from `listForProfile` or return the snapshot only, but document the choice in code comments or final notes.
- For Recognized Context, when bookmarking an Organization page:
  - find a Tag for `organizationReferentId` via `tags.by_referentId`,
  - upsert a user `tagRecognitions` row via `by_userId_and_tagId`,
  - set `recognizerKind: "user"`, `userId`, `recognizedAt`, and `lastInteractedAt`,
  - update `lastInteractedAt` on repeat bookmark,
  - do not remove tag recognition when the bookmark is removed, because Recognized Context is historical.

## Frontend Guidance

- Keep the profile route as the home for bookmarks. Do not create a new sidebar item or standalone Bookmarks User View in this slice.
- Keep the avatar menu `Bookmarks` link as `/profile?section=bookmarks`.
- If the app does not currently scroll/focus to the `#bookmarks` section for `?section=bookmarks`, add a small effect in `ProfilePage` or route handling so the shortcut feels intentional.
- Replace the profile Bookmarks placeholder with a real list backed by `api.bookmarkedKnowledgePages.listForProfile`.
- Show a calm empty state when no bookmarks exist.
- Each bookmark row/card should link to the Knowledge Page and include enough metadata to distinguish it, such as `Organization` or `School`.
- Add a remove action in the profile Bookmark row if it can be done without clutter. Use an icon button plus accessible label.
- Add a Bookmark / Remove Bookmark control on Organization Knowledge Pages, separate from Pin / Unpin. The two controls have different meanings:
  - Pin: quick return through sidebar.
  - Bookmark: save for later on the profile and for personal knowledge context.
- Keep both controls compact. Avoid adding explanatory in-app copy that teaches the distinction at length.
- Do not add notification language to bookmark UI.

## Test Plan

Use TDD where practical.

Convex tests:

1. Add `convex/bookmarkedKnowledgePages.test.ts`.
2. Use the same seeded user/Organization helpers or patterns from `convex/pinnedKnowledgePages.test.ts`.
3. Assert `listForProfile` returns an empty list when the user has no bookmarks.
4. Assert `bookmarkOrganizationPage` creates one bookmark row for an accessible Organization Knowledge Page.
5. Assert calling `bookmarkOrganizationPage` twice does not create duplicates and updates the existing row.
6. Assert `getForPage` returns the current user's bookmark for that page.
7. Assert `removeBookmark` removes the bookmark for the current user only.
8. Assert unauthorized, inactive, and no-organization users cannot bookmark Organization pages.
9. Assert bookmarking an Organization page upserts a user `tagRecognitions` row when the Organization Tag exists.

Frontend tests:

1. Extend `src/App.integrated.test.tsx` mocks to support bookmark queries/mutations.
2. Assert the profile Bookmarks section renders durable bookmark data with links.
3. Assert the avatar menu Bookmarks shortcut still points to `/profile?section=bookmarks`.
4. Assert the Organization page Bookmark / Remove Bookmark control calls the correct mutation and toggles after mock state changes.
5. Assert bookmarked pages do not appear in `Knowledge Page destinations` unless they are also pinned.
6. Assert existing durable pin tests still pass.

## Verification Commands

- `npx convex codegen`
- `npx vitest run convex/bookmarkedKnowledgePages.test.ts`
- `npx vitest run src/App.integrated.test.tsx`
- `npx vitest run convex/bookmarkedKnowledgePages.test.ts src/App.integrated.test.tsx`
- `npx tsc -b --pretty false`
- `npm run build`

Manual browser check if a signed-in local session is available:

- Start Vite on an open port.
- Visit an Organization Knowledge Page.
- Bookmark it.
- Open the avatar menu and choose Bookmarks.
- Confirm the profile Bookmarks section lists the page.
- Remove it and confirm it disappears from the profile section and does not affect sidebar pins.

If the browser only reaches the unauthenticated sign-in screen, say so and rely on the automated tests for signed-in behavior.

## Risks / Open Questions

- This slice supports Organization Knowledge Pages first. Broader Knowledge Page bookmarks, including Scripture, Explore contexts, and individual Knowledge Entries, should be separate follow-up slices.
- The app has not resolved a large saved-set management experience. Keep profile rendering simple and bounded.
- Bookmark-powered recommendations and LLM behavior are not part of this slice. Persisting/querying bookmarks and updating user tag recognition is enough to make later logic possible.
- If an Organization bookmark remains after the user loses access to that Organization, the product behavior is not fully specified. Prefer a conservative implementation: do not leak current Organization data beyond what `requireAppAccess` allows, and use snapshots only if the existing app already treats those snapshots as safe.
- `docs/*` may be ignored by `.gitignore`; if this handoff needs to be committed, force-add it intentionally.

## Expected Final Response From Coding Agent

Summarize:

1. What durable bookmark backend and frontend behavior changed.
2. Whether tag recognition was updated for bookmark actions.
3. What tests/checks passed.
4. Any generated files or codegen steps.
5. What remains for broader Knowledge Page bookmark targets, recommendations, subscriptions, and saved-set management.
