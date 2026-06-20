# Code Handoff: Durable Pinned Knowledge Pages

## Coding Agent Prompt

You are implementing the next vertical slice after the header/sidebar shell work.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`
- `docs/mvp-frontend-core-loop.md`
- `docs/handoffs/header-sidebar-navigation.md`
- `src/App.tsx`
- `src/App.integrated.test.tsx`
- `convex/schema.ts`
- `convex/lib/appAccess.ts`

Do not re-litigate the resolved navigation language unless code and docs directly contradict each other. Keep this slice focused on durable Pinned Knowledge Pages; do not build bookmarks, subscriptions, full Global Search, or Active Role persistence.

## What To Do

Persist the sidebar's Pinned Knowledge Pages instead of deriving them only from local frontend state.

Implement durable user-specific pins for Knowledge Pages with:

- default Organization Knowledge Page seeding from the current user's active Organization memberships,
- at most one default seeded Organization pin per Organization kind,
- persistent unpin suppression for default seeded pins,
- ability to manually pin/unpin Organization Knowledge Pages,
- sidebar rendering from the durable pin query while preserving the shell layout implemented in the previous slice.

Target type: inferred next vertical slice.

## Why This Target

The completed shell slice made the sidebar grammar visible, but it still uses `getSeededPinnedKnowledgePages(appAccess.organizations)` in `src/App.tsx`. That means pins are deterministic UI state only: default pins cannot be truly unpinned, user pin order cannot persist, and future manual pins have nowhere durable to live.

This slice turns the visible shell into real user state while staying narrow. It should support Organization Knowledge Pages first because those are the default pins already visible in the sidebar and they are available through current `AllowedAppAccess.organizations`.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- Previous shell handoff: `docs/handoffs/header-sidebar-navigation.md`
- Existing frontend loop decisions: `docs/mvp-frontend-core-loop.md`
- Convex guidance: `convex/_generated/ai/guidelines.md`
- App access helper: `convex/lib/appAccess.ts`
- Current schema: `convex/schema.ts`
- Current shell implementation: `src/App.tsx`, `src/index.css`
- Existing integrated tests: `src/App.integrated.test.tsx`
- Existing Convex access tests: `convex/appAccess.test.ts`
- Relevant ADRs: No pin/bookmark/subscription-specific ADR found.
- Issue docs: No issue found for this slice; inline issue brief below.
- Prototype: No durable pins prototype found; current shell behavior is the implementation reference.

## Inline Issue Brief

### What To Build

Add a persisted Pinned Knowledge Page model and wire the sidebar to it for signed-in users. Default Organization pins should appear automatically, but when a user unpins one, that suppression should survive refresh and future default recalculation until the user pins it again.

### Acceptance Criteria

- [ ] A signed-in allowed user can query sidebar Pinned Knowledge Pages from Convex.
- [ ] With no pin records, the query returns default Organization Knowledge Page pins derived from active memberships, capped to at most one Organization per kind.
- [ ] Default pins use specific Organization names as primary labels and include Organization kind metadata.
- [ ] Default pin overflow behavior in the sidebar still works.
- [ ] The user can unpin a default Organization Knowledge Page from the sidebar or Organization page.
- [ ] Unpinning a default Organization Knowledge Page persists suppression and the pin does not return after refresh/requery.
- [ ] The user can pin the same Organization Knowledge Page again and it reappears.
- [ ] User-created/manual pins can persist sort order or insertion order.
- [ ] Mutations derive the current user server-side; no userId is accepted from the client for authorization.
- [ ] Only Knowledge Pages are pin targets. Do not pin raw Knowledge Entries as non-page objects.
- [ ] Bookmarks remain separate from pins and are not shown directly in the primary sidebar.
- [ ] Subscriptions remain separate from pins and are not created by pinning.
- [ ] Existing route rendering and shell navigation tests still pass.

### Out Of Scope

- Full pin management screen.
- Drag-and-drop pin ordering.
- Bookmark persistence.
- Subscription persistence.
- Notification persistence.
- Full Global Search implementation.
- Durable Active Role persistence.
- Pinning every possible Knowledge Page type. This slice may support Organization Knowledge Pages first, with a schema shape that can grow to Referent, Context, Entry, and other Knowledge Pages later.

## Domain Language

- `Pinned Knowledge Page`: a User relationship to a Knowledge Page that keeps it easy to return to, especially from sidebar navigation. It does not subscribe the User to notifications.
- `Default Pinned Knowledge Page`: a Pinned Knowledge Page automatically seeded from User affiliation with a School, Church, Family, or Community. Unpin suppression persists unless the User manually pins it again.
- `Knowledge Page`: a user-facing location grounded in a Knowledge Context, Referent, Knowledge Entry, Organization, user relationship, or knowledge-oriented view.
- `Bookmark`: a saved Knowledge Page for later reference. It does not place the page in sidebar navigation and does not subscribe the User.
- `Subscription`: a standing interest that affects notification behavior.
- `User View`: current-user scoped view such as Calendar or Notifications; not a pin target for this slice.

Avoid `favorite` as a domain term. Avoid treating `Bookmark` and `Pinning` as the same relationship.

## Decisions That Must Hold

- Dashboard is fixed first sidebar navigation and is not a user-removable pin.
- Explore is not a separate primary sidebar icon for now.
- Pinned Knowledge Pages live in the sidebar middle.
- Default Organization pins are seeded from affiliations but can be unpinned.
- If a user unpins a default Organization pin, suppression must persist and the pin must not return just because defaults are recalculated.
- Default seed should be capped; do not pin every affiliation automatically.
- When the user has multiple Organizations of the same kind, seed at most the most relevant one per kind. For this slice, choosing the first active membership per kind is acceptable unless a better local signal already exists.
- Organization pins should show the specific Organization name as primary label, not only `My School` / `My Church`.
- Pinning does not create subscriptions or notifications.
- Bookmarking is not part of this slice.

## Relevant Code Map

- `src/App.tsx:1497`: current sidebar calls `getSeededPinnedKnowledgePages(appAccess.organizations)`.
- `src/App.tsx:1537`: sidebar renders `Pinned Knowledge Pages`.
- `src/App.tsx:2679`: temporary `getSeededPinnedKnowledgePages` helper.
- `src/App.tsx:435`: `SIDEBAR_VISIBLE_PIN_LIMIT`.
- `src/App.tsx:1640`: avatar menu; bookmarks stay there/profile, not in pin nav.
- `src/App.tsx:2185` and nearby Organization page code: likely place for Pin/Unpin action.
- `src/App.integrated.test.tsx:459`: current shell test expects seeded Organization pins and `+1 more`.
- `convex/schema.ts`: add the durable pin table here.
- `convex/lib/appAccess.ts`: use `requireAppAccess(ctx)` to authorize pin queries/mutations and get current `userId`/Organizations.
- `convex/appAccess.test.ts`: pattern for `convex-test`, seed data, and authenticated access tests.

## Suggested Data Model

Add a table such as `pinnedKnowledgePages` in `convex/schema.ts`.

Suggested fields:

- `userId: v.id("users")`
- `pageKey: v.string()`; stable unique key such as `organization:<referentId>`
- `pageKind: v.union(v.literal("organization"))` for this slice
- `pinState: v.union(v.literal("pinned"), v.literal("suppressed"))`
- `pinSource: v.union(v.literal("defaultSeed"), v.literal("manual"))`
- `sortOrder: v.number()`
- `organizationReferentId: v.optional(v.id("referents"))`
- `organizationKind: v.optional(organizationKind)`
- `labelSnapshot: v.string()`
- `hrefSnapshot: v.string()`
- `createdAt: v.number()`
- `updatedAt: v.number()`

Suggested indexes:

- `by_userId_and_pageKey`
- `by_userId_and_pinState_and_sortOrder`
- `by_userId_and_pinSource`

The exact shape can differ if a cleaner local pattern emerges, but preserve these capabilities:

- unique user/page relationship,
- suppression records for default pins,
- manual pin records,
- stable ordering,
- future expansion beyond Organization pages.

## Suggested Convex API

Create a focused module such as `convex/pinnedKnowledgePages.ts`.

Suggested public functions:

- `listForSidebar`: query, no args. Requires app access. Returns sidebar-ready pin summaries.
- `pinOrganizationPage`: mutation, args `{ organizationReferentId: v.id("referents") }`. Requires app access and active membership or other read access to that Organization. Upserts `pinState: "pinned"`.
- `unpinKnowledgePage`: mutation, args `{ pageKey: v.string() }` or a more strongly typed union. Requires app access. If the pin is a default seed, persist `pinState: "suppressed"` rather than deleting. If it is manual-only, deleting the row is acceptable.

Implementation notes:

- Do not accept `userId` from the client.
- Use `requireAppAccess(ctx)` and derive `userId` server-side.
- Use indexes rather than query filters.
- Return bounded collections.
- For default seeds, derive candidates from `access.organizations`, one per `organizationKind` in the same order the current access helper returns them.
- Merge default candidates with persisted records:
  - no record for default candidate means visible default pin,
  - `suppressed` record means hidden,
  - `pinned` record means visible and may carry order/snapshot,
  - manual pinned records not in default candidates should also be visible.
- Keep hrefs compatible with current routes, e.g. `/organizations/${organizationReferentId}`.

## Frontend Guidance

- Replace the direct `getSeededPinnedKnowledgePages(appAccess.organizations)` sidebar data source with `useQuery(api.pinnedKnowledgePages.listForSidebar, {})`.
- While the query is loading, either show the existing deterministic seeded pins as a fallback or a stable loading placeholder that does not jump awkwardly.
- Keep the visible shell behavior from the previous slice:
  - Dashboard first,
  - Pinned Knowledge Pages group in the middle,
  - `+N more` overflow,
  - Calendar/Notifications bottom User View icons,
  - avatar account menu.
- Add a small Pin/Unpin control where scope is clear, preferably on Organization Knowledge Pages or each visible Organization pin's overflow/action area.
- Do not add Bookmarks to the primary sidebar.
- Do not add subscriptions.

## Test Plan

Use TDD where practical.

Convex tests:

1. Add `convex/pinnedKnowledgePages.test.ts`.
2. Seed default Organizations/users using existing seed helpers.
3. Assert `listForSidebar` returns one Organization pin per kind when no rows exist.
4. Add a second Organization of the same kind and assert default seeding still caps to one per kind.
5. Unpin a default Organization pin and assert it disappears from `listForSidebar`.
6. Pin it again and assert it reappears.
7. Assert unauthenticated/inactive/no-organization users cannot mutate pins.

Frontend tests:

1. Update `src/App.integrated.test.tsx` mocks to return durable pin query data.
2. Assert sidebar renders durable pins and overflow.
3. Assert unpin/pin UI calls the correct mutation and updates visible state when mock data changes.
4. Assert Bookmarks still live in the avatar/profile path and are not sidebar pins.

## Verification Commands

- `npx vitest run convex/pinnedKnowledgePages.test.ts`
- `npx vitest run src/App.integrated.test.tsx`
- `npx tsc -b --pretty false`
- `npm run build`
- If codegen/API references fail after adding Convex functions, run the repo's usual Convex codegen/dev command and note it in the final response.

## Risks / Open Questions

- There is no resolved full pin-management screen yet. Use sidebar/Organization page controls only for this slice.
- There is no resolved ordering UI. Store `sortOrder` and use insertion/default order; drag/drop can come later.
- This slice supports Organization Knowledge Pages first. Broader Knowledge Page pin targets should be added in later slices.
- Current shell tests mock Convex `useQuery` broadly; adding another query may require making the mock distinguish app access, analytics, scripture, and pins more carefully.
- `docs/*` may be ignored by `.gitignore`; if this handoff needs to be committed, force-add it intentionally.

## Expected Final Response From Coding Agent

Summarize:

1. What durable pin backend and frontend behavior changed.
2. What tests/checks passed.
3. Any generated files or codegen steps.
4. What remains for broader pins, bookmarks, subscriptions, and pin management.
