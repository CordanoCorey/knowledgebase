# MVP Frontend Handoff: Entry and Slot Cards

## Objective

Implement Knowledge Entry Card and Knowledge Slot Card against fixture props, using the shared summary contracts from `docs/mvp-frontend-core-loop.md`.

## Required Reading

- `CONTEXT.md`
- `docs/product-core.md`
- `docs/mvp-frontend-core-loop.md`
- `src/App.tsx`

## Decisions To Preserve

- A Knowledge Entry can be considered an Answer, but Answer is not a Knowledge Type.
- A Knowledge Slot is a workflow request for a future Knowledge Entry, not an Answer or Knowledge Type.
- Cards receive compact summary objects, not full database documents.
- Card tests should use fixture props, not Convex mocks.

## Suggested Scope

- Implement `KnowledgeEntryCard` from `KnowledgeEntrySummary`.
- Implement `KnowledgeSlotCard` from `KnowledgeSlotSummary`.
- Render Knowledge Type, title, preview/prompt, context Tag labels, status, target, due date, href, and Human Weight where applicable.
- Keep card components presentational and reusable by the Answer Feed and other page surfaces.

## Out Of Scope

- Feed ordering.
- Convex data loading.
- Smart Storage.
- Knowledge Slot Fulfillment mutation behavior.
- Long Entry Representation rendering.

## Acceptance Criteria

- Entry cards make Human Weight visible without implying it is a generic ranking.
- Slot cards make the requested Knowledge Type and contribution call to action clear.
- Slot cards remain visually and semantically distinct from Entry cards.
- Cards do not require Convex hooks or page state.

## Verification

- Component tests using fixture `KnowledgeEntrySummary` and `KnowledgeSlotSummary` objects.
- Empty/optional field coverage for Slot prompt and due date.
- Run the smallest relevant test/typecheck command available in `package.json`.
