# Code Handoff: Smart Storage Migration Hardening

## Coding Agent Prompt

You are implementing one supporting technical slice of the Smart Storage work that has already been clarified through a grilling session.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`, especially "Entry Representations and Sources"
- `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- `docs/handoffs/durable-smart-storage-spine.md`
- `docs/handoffs/composer-multi-source-ui.md`
- `docs/handoffs/link-preview-upload-cleanup.md`

Do not re-litigate documented decisions unless the code contradicts them. If docs and code disagree in a way that changes behavior, stop and report the contradiction before implementing.

## What To Do

Implement slice 3: Smart Storage migration hardening.

Target type: supporting technical slice.

Make the current Smart Storage schema transition safe for real existing data:

1. Backfill legacy `entryRepresentations` rows so every row has `representationRole`.
2. Narrow `entryRepresentations.representationRole` from optional to required only after the backfill and tests prove the app handles legacy rows.
3. Add bounded migration/audit helpers for legacy Smart Storage parent links, especially missing `contributionSubmissionId` on `sources`, `smartStorageRuns`, and `smartStorageProposals`.
4. Backfill parent links only where the existing rows clearly belong to a Smart Storage contribution. Keep schema optional where product docs intentionally allow migration or standalone compatibility.

## Why This Target

Slice 1 and slice 2 made new Contribution Editor and Smart Storage paths write durable Contribution Submissions, child Sources, Source citations, Link Preview state, and temporary upload cleanup. The remaining risk is older rows that predate those contracts. This slice turns the migration-shaped implementation into a safer deployment path without adding new user-facing features.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- ADR: `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- Prior implementation handoffs: `docs/handoffs/durable-smart-storage-spine.md`, `docs/handoffs/composer-multi-source-ui.md`, `docs/handoffs/link-preview-upload-cleanup.md`
- PRD: No separate PRD found; synthesized from grilling session and product docs.
- Issue docs: No issue docs found; inline issue brief below.
- Prototype: No prototype found.

## Inline Issue Brief

### What to build

Add migration helpers and tests that safely move legacy Smart Storage data toward the documented schema invariants.

### Acceptance criteria

- [ ] Legacy `entryRepresentations` without `representationRole` can be audited and backfilled.
- [ ] Backfilled representation roles use the documented enum and conservative inference:
  - external URL representations -> `supportingMaterial`
  - storage files -> reuse the existing file-role heuristics from `convex/smartStorage.ts`
  - primary text/editor representations -> `primaryContent`
  - unknown or ambiguous representations -> `unspecified`
- [ ] `convex/schema.ts` requires `entryRepresentations.representationRole` after tests cover the backfill.
- [ ] Missing `contributionSubmissionId` on `sources`, `smartStorageRuns`, and `smartStorageProposals` can be audited with bounded helpers.
- [ ] Backfill logic creates or attaches a `contributionSubmissions` parent only for clearly related legacy Smart Storage rows, preserving user, title/body preview, visibility/review scope, timestamps, and proposal/run linkage.
- [ ] Proposal/run parent mismatch remains rejected, and new writes continue requiring parent IDs through existing Smart Storage paths.
- [ ] The slice does not require `sources.contributionSubmissionId`, `smartStorageRuns.contributionSubmissionId`, or `smartStorageProposals.contributionSubmissionId` in schema unless verification proves there are no legitimate standalone/legacy rows and the docs are updated accordingly.
- [ ] Existing Smart Storage, Contribution Editor, Link Preview, upload cleanup, and proposal acceptance tests still pass.

### Out of scope

- Advanced extraction, transcription, document parsing, or LLM contract generation.
- Update-existing-entry proposal acceptance.
- Merge/split review workflows.
- Save drafts or delivery channels.
- UI polish for Link Preview history, migration progress, or cleanup observability.

## Domain Language

- `Contribution Submission` is the durable parent for one user intent to Contribute. It is not a Knowledge Entry.
- `Source` is Bronze Layer raw material, not a Knowledge Type and not a Knowledge Entry.
- `Entry Representation` is a content/media form of a Knowledge Entry.
- `Representation Role` describes how an Entry Representation functions for the entry and must use the shared enum.
- `Smart Storage Run` is the operational attempt record.
- `Smart Storage Proposal` is the durable Silver Layer candidate for one proposed Gold Layer Knowledge Entry.

## Decisions That Must Hold

- `entryRepresentations.representationRole` should be required, using `unspecified` when the role is not known. Source: `docs/product-core.md`.
- Representation Role enum is `unspecified`, `primaryContent`, `manuscript`, `slides`, `transcript`, `recording`, `thumbnail`, `supportingMaterial`. Source: `docs/product-core.md` and `convex/lib/typeBehavior.ts`.
- Contribution Submissions are the Smart Storage parent spine for multi-Source/import/upload/deferred review workflows. Source: ADR 0008.
- `sources.contributionSubmissionId` may remain optional for migration compatibility, but new durable Smart Storage paths must provide it. Source: `docs/product-core.md`.
- Proposals should link directly to Contribution Submission and Run; backend must enforce Proposal and Run point to the same Contribution Submission. Source: `docs/product-core.md`.

## Relevant Code Map

- `convex/schema.ts`: table definitions and current optional fields.
- `convex/smartStorage.ts`: new write paths, proposal acceptance, existing role inference helpers, parent consistency checks.
- `convex/smartStorage.test.ts`: main backend behavior tests for Smart Storage, citations, Link Preview, uploads, acceptance.
- `convex/lib/typeBehavior.ts`: role enum and default Type Behavior.
- `src/ContributionEditor.tsx` and `src/App.tsx`: should not need much change, but their tests should remain green.

## Implementation Guidance

- Follow widen/migrate/narrow. Do not make a field required before tests prove seeded legacy rows can be migrated.
- Keep migration helpers bounded. Prefer `.take(n)` with explicit limits and continuation scheduling or a small internal mutation only when the table scope is known to be small.
- Do not use unbounded `.collect()` for production-facing migration logic.
- If you decide this needs `@convex-dev/migrations`, first inspect existing dependencies and keep the setup minimal. A bounded internal migration module is acceptable for this slice if it matches the project scale and tests.
- Keep migration functions internal unless they must be called from `npx convex run`. If exposing an operator-run function, make it explicit, narrow, and safe to run repeatedly.
- Make backfills idempotent: rerunning should not duplicate parents, duplicate citations, or overwrite a specific role with a less specific one.
- Prefer moving shared role inference into a small local helper if both acceptance and migration need it. Do not create a broad abstraction.
- For parent-link backfill, use conservative grouping:
  - A legacy `smartStorageRun` plus its `sourceId` and proposals is a clear group.
  - A proposal linked to a run should get the same parent as the run.
  - A Source already linked to a parent should not be moved.
  - A standalone Source with no run/proposal may be audited but should not receive a synthetic Contribution Submission unless the product intent is clear from existing fields.
- Preserve timestamps where practical; when synthesizing a parent, use existing row times as the creation baseline and current time for `updatedAt`.
- Keep frontend changes out unless required by TypeScript fallout.

## Test Plan

Use TDD where practical:

1. Add backend tests that seed legacy rows with missing `representationRole`.
2. Verify dry-run/audit output identifies the missing rows without changing data.
3. Run the backfill and verify roles are set correctly.
4. Narrow `entryRepresentations.representationRole` and ensure tests still pass.
5. Add backend tests that seed legacy Smart Storage rows without parent IDs.
6. Verify parent-link audit/backfill handles run/source/proposal groups idempotently and preserves mismatch rejection.

Tests should verify public/internal function behavior rather than private implementation details.

## Verification Commands

- `cmd /c npx convex codegen`
- `cmd /c npx tsc -b --pretty false`
- `cmd /c npx vitest run convex/smartStorage.test.ts`
- `cmd /c npx vitest run src/ContributionEditor.test.tsx`
- `cmd /c npx vitest run src/App.integrated.test.tsx -t "stores dashboard Smart Storage contributions without direct posting"`
- `cmd /c npm run build`

If `npx convex codegen` fails because the current environment cannot reach Convex, report that specifically and rely on `tsc`, targeted tests, and build for local verification.

## Risks / Open Questions

- Existing production/dev data shape is unknown. Treat schema narrowing beyond `entryRepresentations.representationRole` as gated by audit results.
- `sources.contributionSubmissionId` is explicitly optional in product docs for migration compatibility. Do not narrow it unless you also update docs with a clear reason and verification.
- The current app likely has generated Convex API types in a dirty working tree. Do not revert unrelated changes.

## Expected Final Response From Coding Agent

Summarize:

1. What migration helpers and schema changes were added
2. What legacy shapes are backfilled and what remains intentionally optional
3. What tests/checks passed
4. Any operator commands needed to run the migration outside tests
5. Any follow-up slices
