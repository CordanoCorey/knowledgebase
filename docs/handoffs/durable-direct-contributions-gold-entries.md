# Code Handoff: Durable Direct Contributions To Gold Entries

## Coding Agent Prompt

You are implementing the next vertical slice after durable pins, bookmarks, subscriptions, and notification inbox.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`
- `docs/mvp-frontend-core-loop.md`
- `docs/handoffs/durable-notification-inbox.md`
- `src/App.tsx`
- `src/ContributionEditor.tsx`
- `src/ContributionEditor.test.tsx`
- `src/knowledgeContracts.ts`
- `src/App.integrated.test.tsx`
- `convex/schema.ts`
- `convex/answerFeed.ts`
- `convex/answerFeed.test.ts`
- `convex/smartStorage.ts`
- `convex/smartStorage.test.ts`

Do not re-litigate the resolved domain language unless code and docs directly contradict each other. Keep this slice focused on direct-post Gold Knowledge Entry creation and durable Answer Feed visibility; do not build notification generation, Smart Storage proposal acceptance, full type-specific editors, or delivery preferences.

## What To Do

Persist direct Contribution Editor submissions as Gold Layer `KnowledgeEntry` rows and have the Answer Feed read them back from Convex.

Implement a narrow durable direct-post path:

- a Convex mutation for posting a direct Contribution as a Knowledge Entry,
- creation or reuse of the represented Referent and primary Tag,
- creation or reuse of context Tags from the active Knowledge Context,
- `entryTags` rows for the represented Tag and context Tags,
- Answer Feed rendering from durable Convex data for active Knowledge Contexts,
- removal of the runtime dependency on simulated local direct-post feed items for the normal direct-post path.

Target type: inferred prerequisite vertical slice.

## Why This Target

The notification inbox is now durable, but notification generation needs a real domain event to react to. The app still treats direct posts as local deterministic feed items in `src/App.tsx`, while Smart Storage persists only Bronze/Silver state and does not create Gold entries yet.

This slice creates the missing Gold-layer event source: when a user chooses the direct post path, the app creates the Knowledge Entry currently shown in the Contribution Preview. Later slices can generate Subscription Notifications from these durable Knowledge Entry creations.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- Frontend loop decisions: `docs/mvp-frontend-core-loop.md`
- Durable notification handoff: `docs/handoffs/durable-notification-inbox.md`
- Convex guidance: `convex/_generated/ai/guidelines.md`
- Contribution UI: `src/ContributionEditor.tsx`, `src/ContributionEditor.test.tsx`
- Contribution contracts: `src/knowledgeContracts.ts`
- Current local direct-post behavior: `src/App.tsx`
- Current Answer Feed backend adapter: `convex/answerFeed.ts`, `convex/answerFeed.test.ts`
- Smart Storage backend, for contrast only: `convex/smartStorage.ts`, `convex/smartStorage.test.ts`
- Current schema: `convex/schema.ts`
- Relevant ADRs: `docs/adr/0001-separate-referents-tags-and-knowledge-entries.md`, `docs/adr/0002-use-type-detail-tables-for-knowledge-entries.md`, `docs/adr/0004-knowledge-entries-uniquely-represent-same-typed-referents.md`, `docs/adr/0006-store-smart-storage-proposals-as-durable-silver-records.md`, `docs/adr/0007-store-smart-storage-proposals-as-persistence-agnostic-domain-contracts.md`
- Issue docs: no issue found for this slice; inline issue brief below.
- Prototype: no separate durable direct-post prototype found; current local direct-post UI is the implementation reference.

## Inline Issue Brief

### What To Build

Make direct posting durable:

1. A signed-in user posts directly from a tagged Knowledge Context.
2. Convex creates a Gold Layer `KnowledgeEntry` with a represented Referent, primary Tag, and context Tags.
3. The created entry appears in the Answer Feed from durable Convex data.
4. The same entry can still be focused after submission in the current UI.
5. Smart Storage remains Bronze/Silver only and does not create Gold entries in this slice.

### Acceptance Criteria

- [ ] A signed-in allowed user can create a direct Knowledge Entry through a Convex mutation.
- [ ] The mutation derives the current user server-side; no client function accepts `userId` for authorization.
- [ ] The mutation creates or reuses the represented Referent and primary Tag for the entry.
- [ ] The created `KnowledgeEntry` uses the selected authorable Knowledge Type, title, preview text, search text, primary Tag label, created user, and timestamps.
- [ ] The created `KnowledgeEntry` has an `entryTags` row with `tagPurpose: "represented"` for its primary Tag.
- [ ] The created `KnowledgeEntry` has `entryTags` rows with `tagPurpose: "context"` for every active context Tag.
- [ ] The mutation resolves existing Tags by stable lookup key and Knowledge Type before creating new context Referents/Tags.
- [ ] The mutation keeps direct posting distinct from Smart Storage: no Bronze `Source`, `smartStorageRun`, or `smartStorageProposal` is created for direct posts.
- [ ] The normal direct-post path in `src/App.tsx` calls the durable mutation instead of only creating a local simulated item.
- [ ] The Answer Feed can list durable entries for the active Knowledge Context.
- [ ] A newly posted direct entry appears in the Answer Feed after the mutation and is available after re-render/requery.
- [ ] Existing Smart Storage behavior still stores Bronze/Silver proposal state without creating Answer Feed items.
- [ ] Existing durable pin, bookmark, subscription, and notification inbox tests still pass.

### Out Of Scope

- Smart Storage Proposal acceptance into Gold.
- Subscription notification generation from new Knowledge Entries.
- Delivery channels, notification preferences, or muting.
- Full type-specific detail-row persistence for every Knowledge Type.
- Rich identity resolution UI for ambiguous existing Referents.
- Full editor for entry representations beyond the current preview/body fields.
- General-purpose Knowledge Entry edit/delete flows.
- Exact large-scale counters or ranking changes for Answer Feed.

## Domain Language

- `Contribute`: to add a future Answer to the knowledgebase, either by submitting a Source, creating a Knowledge Entry directly, or responding to an existing Knowledge Entry.
- `Knowledge Entry`: a typed, contextualized unit of knowledge that represents one same-typed Referent and whose Knowledge Context is constituted by its Tags.
- `Represented Referent`: the same-typed Referent a Knowledge Entry uniquely expresses or records.
- `Entry Tag`: the relationship between a Knowledge Entry and a Tag. Use `represented` for the entry's primary Tag and `context` for the surrounding Knowledge Context.
- `Smart Storage`: the AI-assisted Bronze/Silver path that may propose Gold entries but does not write Gold until user confirmation.
- `Gold Layer`: confirmed Knowledge Entries represented according to the current application model.

Avoid calling a direct post a `Source`, `Smart Storage Proposal`, or `Notification`.

## Decisions That Must Hold

- Direct posting creates the Knowledge Entry currently displayed in the deterministic Contribution Preview.
- Direct posting should not create a Bronze Source by default.
- Smart Storage should preserve raw Source material and produce durable Silver Proposals, but it should not create Gold entries without user confirmation.
- A Knowledge Entry represents exactly one same-typed Referent.
- A Referent may have at most one Knowledge Entry representing it.
- A Knowledge Entry's canonical represented Tag should be included among its `entryTags`.
- Contributed Questions create Question Knowledge Entries and represented Question Tags, but they should not automatically move the user into that Question's Knowledge Context.
- Plain page visits should not add to Recognized Context. Contributing is a meaningful action.
- Notification generation is not part of this slice.

## Relevant Code Map

- `src/App.tsx:2985`: `ComponentScaffold` currently keeps local `feedItems` state from `ANSWER_FEED_FIXTURE`.
- `src/App.tsx:3050`: `handleSubmitContribution` currently creates a deterministic local feed item.
- `src/App.tsx:3076`: `handleStoreSmartlyContribution` already calls durable Smart Storage mutations and should remain separate.
- `src/App.tsx:3185`: `ContributionEditorSurface` receives `onPostDirect` and `onStoreSmartly`.
- `src/App.tsx:3206`: `AnswerFeedSurface` currently receives local `feedItems`.
- `src/App.tsx:3831`: `createDeterministicContributionFeedItem` is the local direct-post simulation to replace for normal runtime.
- `src/ContributionEditor.tsx:140`: contribution submission builds a `ContributionInput` with title, body, Knowledge Type, context Tags, and optional slot.
- `src/knowledgeContracts.ts:139`: `ContributionInput` shape.
- `convex/schema.ts:321`: `knowledgeEntries` table.
- `convex/schema.ts:370`: `entryTags` table.
- `convex/answerFeed.ts:81`: `listForActiveTags` expects Convex Tag IDs.
- `convex/answerFeed.ts:117`: Answer Feed matching uses `entryTags`.
- `convex/answerFeed.test.ts`: good seed pattern for `knowledgeEntries`, `referents`, `tags`, and `entryTags`.
- `convex/smartStorage.ts:128`: Smart Storage contribution path, useful contrast for what direct posting should not do.

## Suggested Convex API

Create a module such as `convex/directContributions.ts`.

Suggested public mutation:

- `postDirectContribution`

Suggested args:

- `knowledgeType`
- `title`
- `body`
- `contextTags`: array of active tag snapshots from `ContributionInput`
- optional `slotId`

Suggested return:

- `entry`: an Answer Feed-compatible `KnowledgeEntrySummary`
- `entryId`
- `primaryTagId`
- `representedReferentId`

Implementation notes:

- Use `requireAppAccess(ctx)` and derive `userId` server-side.
- Limit title/body/context fields similarly to `convex/smartStorage.ts`.
- Resolve context Tags by `knowledgeType` + canonical lookup key before creating missing context Tags.
- Resolve or create the represented Referent/primary Tag for the new entry. If a same-typed represented Referent already has a `KnowledgeEntry`, do not silently create a duplicate. For this MVP slice, returning a clear conflict error is acceptable.
- For user-authored direct posts where identity is inherently new, a stable generated canonical key based on Knowledge Type, normalized title, creator, and timestamp is acceptable if there is no better local identity pattern. Keep this choice explicit in code and tests.
- Insert `entryTags` for represented and context Tags.
- Set `visibilityKind` and `discoverabilityKind` conservatively from current app behavior. If no scoped visibility decision exists in code, use the existing public/default patterns already used by Answer Feed test fixtures and seed data.
- Use a modest default `humanWeight` consistent with the current local deterministic direct-post path unless a better existing constant/pattern exists.
- If a `slotId` is supplied and maps to a real `knowledgeSlots` row, Knowledge Slot Fulfillment can be a later slice. Do not block direct posting on Knowledge Slot Fulfillment unless the code already has the seam.

## Answer Feed Guidance

- The frontend currently has active Tags as route snapshots, not necessarily Convex `Id<"tags">` values.
- Add an Answer Feed query seam that accepts active Tag snapshots or stable active tag keys and resolves them to Convex Tag IDs server-side, or add a small frontend/backend resolver before calling `api.answerFeed.listForActiveTags`.
- Prefer a new query such as `api.answerFeed.listForActiveTagKeys` or `api.answerFeed.listForActiveTagsByLookupKey` over forcing route state to carry Convex IDs everywhere.
- Keep existing `listForActiveTags` for tests and internal callers if it is still useful.
- If live query data is loading, use a stable loading state or combine with existing fixture data only where the app already intentionally uses fixtures. Do not show a direct-post local item as if it were durable after this slice.

## Frontend Guidance

- In `ComponentScaffold`, replace normal `handleSubmitContribution` simulation with a call to the new durable direct-post mutation.
- After mutation success, focus the returned created entry in the existing `CreatedEntryFocusPanel`.
- Ensure the Answer Feed re-renders from durable data so the entry remains visible after re-render/requery.
- Keep `handleStoreSmartlyContribution` as the Bronze/Silver path and preserve its proposal review panel behavior.
- Keep the Contribution Editor mode rules already implemented:
  - Global Knowledge Context defaults to Smart Storage.
  - Tagged contexts default to direct post.
  - Comments are titleless.
  - Questions use question text as title with optional details.
  - RSVP remains hidden from generic picker.
  - Guided direct Group creation can remain as-is if full Group detail persistence is too large for this slice; do not break the existing UI.
- If some world-modeling types need detail rows that are not yet supported, prefer a clear narrow scope and tests over a partial broken generic implementation.

## Test Plan

Use TDD where practical.

Convex tests:

1. Add `convex/directContributions.test.ts`.
2. Seed an allowed user and at least two context Tags.
3. Assert `postDirectContribution` creates a `knowledgeEntries` row for a direct Words or Question contribution.
4. Assert it creates/reuses the represented Referent and primary Tag.
5. Assert it creates represented and context `entryTags`.
6. Assert the created entry appears from `api.answerFeed.listForActiveTags` or the new lookup-key query for the same context.
7. Assert direct posting does not create `sources`, `smartStorageRuns`, or `smartStorageProposals`.
8. Assert unauthorized, inactive, and no-organization users cannot post direct contributions.
9. Assert duplicate represented Referent conflicts are handled intentionally.

Frontend tests:

1. Extend `src/App.integrated.test.tsx` mocks for the new direct-post mutation and live Answer Feed query.
2. Assert tagged-context direct posting calls the durable mutation.
3. Assert a returned entry appears in the Answer Feed and Created Entry focus panel.
4. Assert a re-render/requery still shows the created entry from durable mock data.
5. Assert Store Smartly still calls Smart Storage mutations and does not create an Answer Feed item.
6. Assert global context still defaults to Smart Storage and tagged contexts still default to direct posting.

## Verification Commands

- `npx convex codegen`
- `npx vitest run convex/directContributions.test.ts`
- `npx vitest run convex/answerFeed.test.ts`
- `npx vitest run src/ContributionEditor.test.tsx`
- `npx vitest run src/App.integrated.test.tsx`
- `npx vitest run convex/directContributions.test.ts convex/answerFeed.test.ts src/App.integrated.test.tsx`
- `npx tsc -b --pretty false`
- `npm run build`

Manual browser check if a signed-in local session is available:

- Start Vite on an open port.
- Visit a tagged Knowledge Context.
- Post directly.
- Confirm the created entry appears in the Answer Feed and focus panel.
- Refresh/revisit the same context and confirm the entry still appears.
- Confirm Store Smartly still produces the Smart Storage Proposal review path rather than a direct Answer Feed entry.

If the browser only reaches the unauthenticated sign-in screen, say so and rely on automated tests for signed-in behavior.

## Risks / Open Questions

- The app has many Knowledge Types, but this slice should not become a full type-detail persistence project. Start with the generic fields needed by `knowledgeEntries` and only add type-detail rows where the existing schema and UI make the mapping obvious.
- Identity resolution is intentionally narrow. Rich candidate matching and user confirmation belong in a later slice.
- Direct post persistence enables future notification generation, but this slice should not create Notification rows yet.
- Smart Storage Proposal acceptance remains future work.
- `docs/*` may be ignored by `.gitignore`; if this handoff needs to be committed, force-add it intentionally.

## Expected Final Response From Coding Agent

Summarize:

1. What durable direct-post backend and frontend behavior changed.
2. How represented Referents, primary Tags, and context Tags are created or reused.
3. What tests/checks passed.
4. Any generated files or codegen steps.
5. What remains for notification generation, Smart Storage Proposal acceptance, type-detail persistence, and identity-resolution UI.
