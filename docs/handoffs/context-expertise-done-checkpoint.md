# Context Expertise Final Checkpoint

This checkpoint records the Context Expertise feature state before moving to
another feature. It is a status document, not a new feature spec.

## Status

Status on 2026-06-20: **local MVP implementation complete enough to move on**.

Context Expertise is implemented locally across the core read, write,
correction, profile, settings, and operations surfaces. The remaining blocker is
not a local feature gap: final schema narrowing is still gated by real-data
migration proof. See `docs/handoffs/context-expertise-migration-closeout.md`
for the required operator sequence and proof log.

Do not claim the production/shared-data migration is complete until the proof
log records final zero counts for:

- missing Quote attribution evidence rows;
- missing scoped aggregate groups;
- legacy unscoped aggregate rows.

## Implemented Domain Model

`contextExpertiseEvidence` is the durable source of truth for Context Expertise
signals. Current evidence-producing paths include:

- direct Gold Knowledge Entry posts;
- Human Weight Feedback;
- direct Knowledge Slot Fulfillment;
- Smart Storage new-entry acceptance;
- Smart Storage slot fulfillment;
- Smart Storage existing-entry curation;
- Quote attribution for Person-subject expertise.

`contextExpertiseAggregates` is the bounded read model for fast expert ranking.
It includes:

- User and Person subject support;
- exact `contextKey` and `contextTagIds`;
- `contextExpertiseScore` and `contextExpertiseMaturity`;
- evidence, post, and feedback counts;
- bounded `topSupportingEntryIds`;
- visibility and audience-scope fields;
- scoped public and organization aggregate rows for current writes.

`convex/lib/contextExpertiseScoring.ts` owns the MVP score and inheritance
formula. The current formula uses:

- default evidence signal score `55`;
- applicable Human Weight for post-like evidence when available;
- feedback/default signal score `55`;
- capped evidence-count bonus;
- maturity separate from score;
- broader-context inherited score discount of `0.85`;
- no time decay.

## Implemented Correction And Migration Support

Context Expertise is explainable and correctable through evidence, not direct
score edits. Implemented correction and repair paths include:

- wrong-context evidence deactivation/rebuild;
- post/User attribution correction;
- Quote attribution correction, clearing, reassignment, and Person picker;
- visibility reconciliation across audience scopes;
- existing Quote attribution backfill;
- scoped aggregate rebuild from evidence;
- legacy unscoped aggregate cleanup tooling.

The local code now has bounded system-admin functions and CLI runners for the
three migration closeout checks:

- `scripts/backfill-context-expertise-quote-attribution.mjs`;
- `scripts/rebuild-context-expertise-scoped-aggregates.mjs`;
- `scripts/cleanup-context-expertise-legacy-aggregates.mjs`.

All run-mode scripts require an explicit `--execute` flag.

## Implemented User Surfaces

The Answer Feed surfaces Context Experts from aggregate data and still retains
legacy unscoped aggregate fallback until the real-data narrowing gate is
satisfied.

Implemented frontend behavior includes:

- Context Expert strip in the Answer Feed;
- Orbit / Global expert audience selection;
- Context Expert detail dialog with post count, non-post signal count, top
  visible supporting entries, and profile links;
- Quote attribution summaries in supporting Quote entries;
- system-admin Quote attribution correction controls;
- User Settings for Global Expert Visibility opt-in;
- profile Context Expertise surfaces;
- system-admin public-figure expert suppression/history;
- system-admin Context Expertise operations panel with status and dry-run
  previews for migration/backfill tasks.

## Audience Rules

Orbit mode currently means active organization membership shared with the
viewer. Orbit rankings may use public evidence plus organization-scoped evidence
for organizations in the viewer's Expert Orbit.

Global mode requires public/global aggregate evidence. User-subject experts must
opt into Global Expert Visibility. Public-figure Person-subject experts are
globally visible by default unless suppressed by a system admin.

Detail surfaces only reveal supporting entries visible to the selected audience.

## Context Expertise Inheritance

Read surfaces consider exact active Knowledge Context aggregates and immediate
broader parent contexts formed by dropping one active Tag. Broader-context
candidate scores are discounted and marked with `contextMatchKind:
"broaderContext"`. Exact-context candidates win for the same subject before
cross-subject ranking.

## Operational Migration Gate

The schema is still intentionally widened:

- `contextExpertiseAggregates.audienceScopeKind` is optional;
- `contextExpertiseAggregates.audienceScopeTargetKey` is optional;
- legacy unscoped aggregate fallback remains in `convex/answerFeed.ts`.

This is expected until real target data is proven clean. The required closeout
sequence is documented in `docs/handoffs/context-expertise-migration-closeout.md`
and currently includes:

```text
npm.cmd run context-expertise:quote-attribution:status -- --all --identity-file ./.operator/system-admin-identity.json --deployment <target>
npm.cmd run context-expertise:quote-attribution:backfill:dry-run -- --all --identity-file ./.operator/system-admin-identity.json --deployment <target>
npm.cmd run context-expertise:quote-attribution:backfill -- --all --execute --identity-file ./.operator/system-admin-identity.json --deployment <target>
npm.cmd run context-expertise:quote-attribution:status -- --all --identity-file ./.operator/system-admin-identity.json --deployment <target>

npm.cmd run context-expertise:status -- --all --identity-file ./.operator/system-admin-identity.json --deployment <target>
npm.cmd run context-expertise:rebuild:dry-run -- --all --identity-file ./.operator/system-admin-identity.json --deployment <target>
npm.cmd run context-expertise:rebuild -- --all --execute --identity-file ./.operator/system-admin-identity.json --deployment <target>
npm.cmd run context-expertise:status -- --all --identity-file ./.operator/system-admin-identity.json --deployment <target>

npm.cmd run context-expertise:legacy-aggregates:status -- --all --identity-file ./.operator/system-admin-identity.json --deployment <target>
npm.cmd run context-expertise:legacy-aggregates:cleanup:dry-run -- --all --identity-file ./.operator/system-admin-identity.json --deployment <target>
npm.cmd run context-expertise:legacy-aggregates:cleanup -- --all --execute --identity-file ./.operator/system-admin-identity.json --deployment <target>
npm.cmd run context-expertise:legacy-aggregates:status -- --all --identity-file ./.operator/system-admin-identity.json --deployment <target>
```

After final zero counts are recorded for every intended target deployment, a
follow-up narrowing change may:

- make `audienceScopeKind` and `audienceScopeTargetKey` required in
  `convex/schema.ts`;
- remove legacy unscoped aggregate fallback from `convex/answerFeed.ts`;
- update validators, mocks, and fixtures to treat aggregate audience scope as
  required.

## Code Map

- `convex/schema.ts`: evidence, aggregate, visibility, settings, and history
  tables.
- `convex/lib/contextExpertiseEvidence.ts`: evidence recording, correction
  reconciliation, and scoped aggregate rebuilds.
- `convex/lib/contextExpertiseScoring.ts`: Context Expertise score, maturity,
  context key, and inheritance helpers.
- `convex/contextExpertise.ts`: aggregate queries, correction operations,
  Quote attribution tools, profile rows, public-figure moderation/history, and
  migration operations.
- `convex/contextExpertiseSettings.ts`: Global Expert Visibility settings.
- `convex/answerFeed.ts`: Context Expert listing/detail data, orbit/global
  filtering, inherited contexts, and current legacy fallback.
- `convex/directContributions.ts`, `convex/humanWeightFeedback.ts`, and
  `convex/smartStorage.ts`: main evidence-producing workflows.
- `src/AnswerFeed.tsx`: Context Expert strip/detail UI.
- `src/App.tsx`: profile/settings/system-admin operation surfaces and dialog
  wiring.
- `scripts/*.mjs`: Context Expertise migration/backfill/cleanup runners.

## Verification

Verification refreshed on 2026-06-20:

```text
npm.cmd test -- --run convex/lib/contextExpertiseScoring.test.ts convex/contextExpertise.test.ts convex/contextExpertiseSettings.test.ts convex/answerFeed.test.ts convex/directContributions.test.ts convex/humanWeightFeedback.test.ts convex/smartStorage.test.ts
# 7 files, 110 tests passed

npm.cmd test -- --run src/AnswerFeed.test.tsx src/App.integrated.test.tsx
# 2 files, 84 tests passed

npm.cmd run context-expertise:quote-attribution:status -- --help
# passed; help text printed

npm.cmd run context-expertise:rebuild:dry-run -- --help
# passed; help text printed

npm.cmd run context-expertise:legacy-aggregates:status -- --help
# passed; help text printed

npm.cmd run context-expertise:legacy-aggregates:cleanup
# expected safety refusal without --execute:
# "Refusing to delete legacy Context Expertise aggregates without --execute."

npm.cmd run build
# passed; Vite still reports the existing large chunk warning
```

## Deferred Or Blocked Work

Blocked by real-data proof:

- production/shared deployment closeout;
- legacy unscoped aggregate row cleanup on real target data;
- final schema narrowing;
- removal of legacy unscoped aggregate fallback.

Explicitly skipped/deferred by product choice:

- Public-Figure Moderation Queue;
- Person-Only Orbit Eligibility.

Not a blocker for this checkpoint:

- richer future scoring versions;
- broader relationship models beyond organization-based Expert Orbit;
- additional Context Expertise evidence kinds beyond the current MVP producers.

## Notes

The working tree remains broadly dirty from many active slices and unrelated
work. This checkpoint does not claim the entire repository is clean; it records
the Context Expertise feature boundary and the remaining migration gate.
