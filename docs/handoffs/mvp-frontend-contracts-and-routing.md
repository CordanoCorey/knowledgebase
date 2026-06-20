# MVP Frontend Handoff: Contracts and Routing

## Objective

Create the shared frontend contracts and route/context parsing foundation for the MVP Explore/Contribute loop.

## Required Reading

- `CONTEXT.md`
- `docs/product-core.md`
- `docs/mvp-frontend-core-loop.md`
- `src/App.tsx`

## Decisions To Preserve

- Page-level loop state owns the active Knowledge Context.
- Active Tags update the URL automatically.
- Knowledge Requests do not automatically update the URL.
- Active Tags are an unordered set for Knowledge Context identity.
- Multi-Tag context keys and URLs should be canonicalized from sorted Tag IDs.
- `/` is Dashboard, `/scripture/:passageString` is a Bible Passage Referent Page, `/goto/:tagId` is a non-Scripture Referent Page, and `/explore?tagIds=a,b,c` is a multi-Tag Context Page.

## Suggested Scope

- Add shared TypeScript contracts for `KnowledgeLoopState`, `ActiveTag`, `KnowledgeRequestDraft`, `KnowledgeEntrySummary`, `KnowledgeSlotSummary`, and `AnswerFeedItem`.
- Add route/context helpers that derive active Tags and location kind from the current URL.
- Add helpers that build canonical hrefs from active Tags.
- Keep helpers framework-light and testable outside React where practical.

## Out Of Scope

- Backend queries.
- Smart Storage.
- Polished card/feed UI.
- KnowledgeRequestComposer behavior beyond contract shape.
- Contribution submission.

## Acceptance Criteria

- Multi-Tag URLs canonicalize active Tags in a stable sorted order.
- Tag order does not affect context identity.
- Knowledge Request text is not serialized into the URL by default.
- Bible Passage route parsing stays compatible with the existing Scripture route behavior.
- Non-Scripture one-Tag routes use `/goto/:tagId`.

## Verification

- Unit tests for route/context parsing and href construction.
- At least one test proving differently ordered `tagIds` resolve to the same context key.
- Run the smallest relevant test/typecheck command available in `package.json`.
