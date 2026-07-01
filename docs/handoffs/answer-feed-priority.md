# Answer Feed Priority

This document captures the current implemented understanding of the Answer Feed priority algorithm. It is intended to be exportable: a reader should be able to understand the MVP behavior without opening the source code first.

## Scope

The Answer Feed is the mixed Knowledge Page surface for:

- existing Answers, represented by Knowledge Entries
- missing future Answers, represented by Knowledge Slots

The current MVP implementation sorts Answers and Slots in separate partitions, then returns Answers first and Slots second. It does not interleave an overdue Slot above an Answer. The two partitions also have independent limits.

## Context Fit

An Answer or Slot fits the active Knowledge Context when it contains every active Tag.

Extra Tags are allowed. For example, an Answer tagged with `Romans 8:28`, `Holy Spirit`, and `Atonement` fits an active context of `Romans 8:28` plus `Holy Spirit`.

When no Tags are active, the feed is operating from the Accessible Root Knowledge Context and uses bounded root-level candidates.

Active Tags are deduplicated and capped at 20.

## Answer Priority

Answers are ordered by Feed Priority, then freshness, then stable text/id tie-breakers.

The current priority formula is:

```ts
if entry is weight-bearing and has Human Weight:
  priority = humanWeight + evidenceMaturityBoost

else if entry is weight-bearing and has no Human Weight:
  priority = 55 + evidenceMaturityBoost

else:
  priority = -1
```

Where:

```ts
evidenceMaturityBoost = clamp(evidenceMaturity, 0, 100) / 100 * 0.5
```

If `evidenceMaturity` is absent, the boost is `0`.

Higher priority sorts first. Ties are broken by:

1. newer `updatedAt`
2. title ascending
3. id ascending

## Evidence Maturity

Evidence Maturity is a secondary priority signal, not a replacement for Human Weight.

In the current MVP formula, Evidence Maturity gives a small settledness boost of at most `0.5`. This means it can decide ties between equal Human Weight Answers, but it should not let a lower-Human Weight Answer outrank a higher-Human Weight Answer with a one-point or greater difference.

The current implementation gives entries needing Human Weight feedback exposure in two ways:

- unscored weight-bearing Answers receive priority `55`, above non-weight-bearing entries and low scored entries
- root-level candidate collection includes recent entries as well as high Human Weight entries, so recent unscored weight-bearing Answers can enter the bounded candidate pool

This is distinct from boosting low Evidence Maturity above mature same-weight entries. If the product later wants exploration to favor low-maturity scored Answers directly, the priority formula and its tests should be changed intentionally.

## Knowledge Type Treatment

Weight-bearing MVP Knowledge Types are:

- Words
- Question
- Quote
- Sermon
- Essay
- Poem
- Song
- Book
- Short Story
- Lesson
- Comment
- Prayer Request
- Series
- Event

Non-weight-bearing MVP Knowledge Types are:

- RSVP
- Person
- Organization
- Group
- Place
- Topic

Only weight-bearing entries expose applicable Human Weight in feed summaries. Non-weight-bearing entries omit Human Weight and Evidence Maturity from the feed summary and sort with priority `-1`.

## Human Weight Concern

Human Weight Concern is displayed metadata, not a ranking input.

The feed may surface a concern when a low Human Weight violates the applicable Human Weight Expectation. The expectation comes from Type Behavior unless a fulfilled Knowledge Slot overrides it.

Current thresholds:

- `expected`: concern below `40`
- `required`: review recommended below `60`

## Slot Priority

Slots are sorted separately from Answers.

Slot order is:

1. status: `overdue`, then `open`, then `fulfilled`, then `cancelled`
2. earliest `dueAt`, with missing due dates last
3. title ascending
4. id ascending

Slots remain visible as contribution opportunities, but in the current MVP they appear after the Answer partition.

## Candidate Limits

Feed queries use bounded candidate pools before final sorting.

Answer limits:

- default: `20`
- max: `50`

Slot limits:

- default: `10`
- max: `50`

Candidate pool size:

```ts
candidateLimit = min(200, max(25, requestedLimit * 5))
```

For active Tags, the backend starts from the smallest matching tag relationship set, loads those candidate entries or slots, then verifies that each candidate contains every active Tag.

For the root feed, Answer candidates come from both:

- highest Human Weight / newest index
- newest index

Those sets are deduplicated before final filtering and sorting. This keeps recent unscored weight-bearing Answers eligible for feedback exposure.

The backend keeps the bounded candidate pool through summary loading before applying the final Answer limit, so Evidence Maturity can affect the final limited result set.

## Frontend Filtering

Frontend filters narrow the already-selected feed items. They do not recalculate Feed Priority.

Current filters include:

- item kind: all, entries, requests
- Knowledge Type
- context search text

Context search only searches Answer text fields and does not include Slots.

## Implementation References

Primary source files:

- `convex/answerFeed.ts`
- `convex/lib/typeBehavior.ts`
- `src/answerFeedData.ts`
- `src/knowledgeContracts.ts`

Primary tests:

- `convex/answerFeed.test.ts`
- `src/AnswerFeed.test.tsx`
- `convex/lib/typeBehavior.test.ts`
- `src/knowledgeContracts.test.ts`
