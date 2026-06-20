# MVP Frontend Handoff: Knowledge Navigator

## Objective

Implement Knowledge Navigator behavior for active Tags and canonical URL updates.

## Required Reading

- `CONTEXT.md`
- `docs/product-core.md`
- `docs/mvp-frontend-core-loop.md`
- `src/App.tsx`

## Decisions To Preserve

- Knowledge Navigator is the user-facing control for selecting active Tags and determining the current Knowledge Context.
- Active Tags are URL state.
- Active Tags are an unordered set for Knowledge Context identity.
- Adding/removing active Tags should produce canonical routes.
- KnowledgeRequestComposer may propose Tags, but the Navigator/page-level state remains the source of truth for applied active Tags.

## Suggested Scope

- Render active Tags as removable chips or controls.
- Support adding Tags from fixtures or a simple local search source until backend lookup exists.
- Update the URL when active Tags change.
- Use `/` for zero active Tags, `/scripture/:passageString` or `/goto/:tagId` for one active Tag, and `/explore?tagIds=a,b,c` for multiple active Tags.
- Record or expose enough events later for navigator usage analytics without implementing analytics in this slice.

## Out Of Scope

- Backend Tag search.
- Tag recognition mutations.
- Page visit analytics.
- Question mapping.
- Contribution submission.

## Acceptance Criteria

- Removing the last active Tag returns the user to `/`.
- One Bible Passage Tag routes to `/scripture/:passageString`.
- One non-Scripture Tag routes to `/goto/:tagId`.
- Multiple Tags route to `/explore?tagIds=` with stable sorted IDs.
- Selection order does not change the final context identity.

## Verification

- Tests for add/remove active Tag behavior.
- Tests for route generation across zero, one, and multiple active Tags.
- Test proving selection order does not affect the canonical URL.
- Run the smallest relevant test/typecheck command available in `package.json`.
