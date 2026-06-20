# MVP Frontend Handoff: Answer Feed

## Objective

Implement the Answer Feed using mixed fixture items so the MVP Explore/Contribute loop can show existing Answers and missing future Answers together.

## Required Reading

- `CONTEXT.md`
- `docs/product-core.md`
- `docs/mvp-frontend-core-loop.md`
- `src/App.tsx`

## Decisions To Preserve

- Feed items use a discriminated union:

```ts
type AnswerFeedItem =
  | { kind: "answer"; entry: KnowledgeEntrySummary }
  | { kind: "slot"; slot: KnowledgeSlotSummary };
```

- Existing Answers render through Knowledge Entry Card.
- Missing future Answers render through Knowledge Slot Card.
- A Context Match means an item contains every active Tag.
- Existing Answers should initially be ordered primarily by Human Weight.
- Broader Context Recommendations are Phase 2.

## Suggested Scope

- Accept `activeTags` and a fixture `AnswerFeedItem[]`.
- Filter or display only items that fit the current Knowledge Context according to the shared helper.
- Render mixed feed items with the correct card component.
- Add clear empty states for no Answers and no Slots.
- Keep the feed independent from Convex until backend queries replace fixtures.

## Out Of Scope

- Backend query performance work.
- Broader Context Recommendations.
- Smart Storage.
- Contribution Editor implementation.
- Full-text search ranking.

## Acceptance Criteria

- Feed preserves the domain distinction between Answers and Knowledge Slots.
- Existing Answers are ordered by Feed Priority for the MVP, with Human Weight as the primary signal.
- Slots remain discoverable in the feed, not only in a side rail.
- Empty states lead naturally toward Contribute without inventing new domain terms.

## Verification

- Component tests for mixed feed fixtures.
- Tests for Human Weight ordering.
- Tests for no-match and slot-only states.
- Run the smallest relevant test/typecheck command available in `package.json`.
