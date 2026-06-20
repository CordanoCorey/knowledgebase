# Code Handoff: Smart Storage Contract Snapshots

## Coding Agent Prompt

You are implementing one supporting technical slice of the Smart Storage roadmap: the durable snapshot foundation for later real LLM contract generation.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`, especially "Smart Storage" and "Entry Representations and Sources"
- `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- `docs/handoffs/durable-smart-storage-spine.md`
- `docs/handoffs/composer-multi-source-ui.md`
- `docs/handoffs/link-preview-upload-cleanup.md`
- `docs/handoffs/smart-storage-migration-hardening.md`

Do not re-litigate documented decisions unless the code contradicts them. If docs and code disagree in a way that changes behavior, stop and report the contradiction before implementing.

## What To Do

Implement slice 5: durable Smart Storage Contract and Type Behavior snapshots.

Target type: supporting technical slice.

Promote the current code-only Smart Storage contract/version strings into durable Convex records that new Smart Storage Runs and Proposals can reference. This is the foundation for later real LLM calls, but this slice should keep proposal generation deterministic and scaffold-based.

## Why This Target

The current implementation stores `contractSnapshotVersion`, `contractSnapshotText`, `typeBehaviorSnapshotVersion`, and `typeBehaviorSnapshotText` directly on Smart Storage Runs and Proposals. That is useful, but the product docs require Smart Storage Contracts and Type Behaviors to be versioned and tracked in the database as immutable content snapshots, not only as labels or literals in code.

This slice creates the durable version registry without adding external model calls, advanced extraction, or broader review workflows.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- ADR: `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- Prior handoffs: `docs/handoffs/durable-smart-storage-spine.md`, `docs/handoffs/composer-multi-source-ui.md`, `docs/handoffs/link-preview-upload-cleanup.md`, `docs/handoffs/smart-storage-migration-hardening.md`
- PRD: No separate PRD found; synthesized from grilling session and product docs.
- Issue docs: No issue docs found; inline issue brief below.
- Prototype: No prototype found.

## Inline Issue Brief

### What to build

Add immutable version records for the current Smart Storage Contract and current Type Behavior snapshots, then make new Smart Storage Runs and Proposals reference those records while preserving existing version/text snapshot fields for review/debugging compatibility.

### Acceptance criteria

- [ ] `convex/schema.ts` has durable version tables for Smart Storage Contract snapshots and Type Behavior snapshots.
- [ ] A Smart Storage Contract version record stores at least a stable key/name, version, immutable snapshot text/content, lifecycle/status if needed, and timestamps.
- [ ] A Type Behavior snapshot record stores at least `knowledgeType`, version, immutable serialized behavior content/text, and timestamps.
- [ ] New Smart Storage Runs reference the current Smart Storage Contract version record and the relevant Type Behavior snapshot record, while still carrying the existing `contractSnapshotVersion/Text` and `typeBehaviorSnapshotVersion/Text` fields.
- [ ] New Smart Storage Proposals copy the same snapshot references/version/text from the Run.
- [ ] Snapshot creation is idempotent: starting multiple Smart Storage runs reuses the same current version rows.
- [ ] Snapshot creation is immutable: if a row exists for the same key/version with different content, the mutation fails with a clear error rather than silently overwriting it.
- [ ] Existing deterministic scaffold proposal behavior remains unchanged.
- [ ] Existing migration, Link Preview, upload cleanup, Contribution Editor, and integrated App tests remain green.

### Out of scope

- Actual LLM API calls or OpenAI integration.
- Advanced extraction of file, URL, audio, video, or document content.
- Request-specific LLM input snapshot tables beyond the current run/proposal snapshot fields.
- Update-existing-entry acceptance.
- Merge/split review.
- Save drafts or delivery channels.
- Rich multi-proposal child-entry generation.
- Retiring/incompatibility workflows for old contract versions.

## Domain Language

- `Smart Storage Contract` is the versioned stable domain contract Smart Storage gives to an LLM so it can match Sources to Knowledge Types and propose structured knowledge.
- `Type Behavior` is the versioned domain behavior the application applies to a Knowledge Type.
- `Smart Storage Run` records one Smart Storage attempt and should preserve the contract/version input used.
- `Smart Storage Proposal` is a durable Silver Layer candidate generated under recorded contract and behavior versions.

## Decisions That Must Hold

- Smart Storage should send a curated Smart Storage Contract to the LLM rather than the raw database schema. Source: `docs/product-core.md`.
- Smart Storage Contracts and Type Behaviors must be versioned and tracked in the database as immutable content snapshots. Source: `docs/product-core.md`.
- Type Behavior should be versioned as a whole per Knowledge Type. Source: `docs/product-core.md`.
- Smart Storage Contract versions contain stable reusable rules and templates; request-specific Source/input data belongs elsewhere. Source: `docs/product-core.md`.
- This slice should keep the existing conservative scaffold proposal behavior before advanced extraction and real LLM generation. Source: `docs/product-core.md`.

## Relevant Code Map

- `convex/schema.ts`: add version tables and optional reference fields on runs/proposals if needed.
- `convex/smartStorage.ts`: currently defines `SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION`, `SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT`, `TYPE_BEHAVIOR_SNAPSHOT_VERSION`, `TYPE_BEHAVIOR_SNAPSHOT_TEXT`, starts runs, and generates deterministic proposals.
- `convex/lib/typeBehavior.ts`: current Type Behavior registry and per-type behavior objects.
- `convex/smartStorage.test.ts`: backend tests should cover idempotent snapshot creation and proposal/run propagation.
- `src/App.integrated.test.tsx` and `src/ContributionEditor.test.tsx`: should remain green.

## Implementation Guidance

- Keep this as a schema/backend/test slice.
- Prefer a small helper in `convex/smartStorage.ts` or `convex/lib/typeBehavior.ts` that produces the current canonical snapshot content deterministically.
- Do not add a dependency for JSON hashing unless already present; stable `JSON.stringify` over plain config objects is acceptable if key order is controlled by construction.
- Do not store request-specific Source text in the contract version row. The contract row is reusable.
- Preserve existing `contractSnapshotVersion/Text` and `typeBehaviorSnapshotVersion/Text` fields on runs/proposals so current UI/tests do not need a broad read-model rewrite.
- Add optional ID reference fields on runs/proposals if useful for linking to the new version tables. Make them optional for migration compatibility.
- Make ensure/create helpers safe to call from the existing `startContributionSubmission` mutation.
- If the current Type Behavior registry only exposes `getTypeBehavior`, add the smallest helper needed to serialize the one requested Knowledge Type.
- Keep existing deterministic proposal generation. Do not call an external model in this slice.

## Test Plan

Use TDD where practical:

1. Add a Smart Storage backend test proving the first run creates/reuses the current Smart Storage Contract version row and Type Behavior snapshot row.
2. Add a test proving a second run for the same Knowledge Type reuses those version rows.
3. Add a test proving a proposal copies the Run snapshot references/version/text.
4. Add a test proving an existing same key/version row with different content causes a clear failure.
5. Rerun the focused Smart Storage, editor, integrated, typecheck, and build checks.

Tests should verify public/internal function behavior rather than private implementation details.

## Verification Commands

- `cmd /c npx convex codegen`
- `cmd /c npx vitest run convex/smartStorage.test.ts`
- `cmd /c npx vitest run src/ContributionEditor.test.tsx`
- `cmd /c npx vitest run src/App.integrated.test.tsx --reporter=dot`
- `cmd /c npx tsc -b --pretty false`
- `cmd /c npm run build`

If `npx convex codegen` fails because the current environment cannot reach Convex, report that specifically and rely on the offline checks.

## Risks / Open Questions

- This slice intentionally stops before actual LLM calls. The next LLM slice should use official current API docs and add model-call failure handling on Smart Storage Runs.
- Retiring/incompatible contract versions is deferred. Do not invent a full lifecycle UI here.
- The working tree is dirty from prior slices. Do not revert unrelated changes.

## Expected Final Response From Coding Agent

Summarize:

1. What version tables/fields/helpers were added
2. How new Runs and Proposals reference snapshots
3. What checks passed
4. Whether `convex codegen` succeeded or was network-blocked
5. Recommended next slice
