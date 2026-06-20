# Context Expertise Migration Closeout

This document tracks the real-data gate for narrowing `contextExpertiseAggregates`
after the Context Expertise MVP migration.

## Status

Status on 2026-06-20: **not narrowed**.

The local code now has bounded tools for all three closeout checks:

- Quote attribution evidence backfill;
- scoped aggregate rebuild from `contextExpertiseEvidence`;
- legacy unscoped aggregate cleanup.

This workspace does not contain `.operator/system-admin-identity.json`, and no
deployment selector or completed real-data proof artifact was present when this
document was created. Because of that, schema narrowing has intentionally not
been performed yet.

## Required Closeout Sequence

Run these commands against each intended real target deployment before narrowing
the schema.

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

Expected final counts before schema narrowing:

- `0 missing Quote attribution evidence rows`;
- `0 missing scoped aggregate groups`;
- `0 legacy unscoped aggregate rows`.

## Stop Conditions

Stop before `run --execute` if a dry-run shows unexpected rows or counts.

Stop before schema narrowing if any target deployment still reports missing Quote
attribution evidence, missing scoped aggregate groups, or legacy unscoped
aggregate rows.

Do not use `--prod` until the same sequence has succeeded on the intended
shared development deployment and the production deployment selector has been
explicitly reviewed.

## Narrowing Work Still Pending

After the real-data proof is recorded here, the follow-up narrowing change can:

- make `contextExpertiseAggregates.audienceScopeKind` required in
  `convex/schema.ts`;
- make `contextExpertiseAggregates.audienceScopeTargetKey` required in
  `convex/schema.ts`;
- remove legacy unscoped aggregate fallback from `convex/answerFeed.ts`;
- update validators, UI mocks, and test fixtures to treat aggregate audience
  scope as required;
- update `docs/handoffs/context-expertise-done-checkpoint.md` to say the
  migration window is closed.

## Proof Log

No real-data commands have been run from this workspace.
