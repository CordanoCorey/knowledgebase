# Code Handoff: Smart Storage Representation Decisions

## Coding Agent Prompt

You are implementing one narrow Smart Storage proposal-review slice: explicit Entry Representation decisions before acceptance.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`, especially "Smart Storage" and "Entry Representations and Sources"
- `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- `docs/handoffs/durable-smart-storage-spine.md`
- `docs/handoffs/composer-multi-source-ui.md`
- `docs/handoffs/smart-storage-model-flow-ui.md`

Do not re-litigate documented decisions unless the code contradicts them. If docs and code disagree in a way that changes behavior, stop and report the contradiction before implementing.

## What To Do

Implement slice 8: representation-role and primary-representation decisions during Smart Storage Proposal review.

Target type: vertical slice.

The current review UI lets a User choose which cited Sources become Entry Representations, but acceptance still infers each `representationRole` and marks the first selected Source as primary. This slice should make those decisions explicit:

1. Proposal review shows the inferred Representation Role for each cited Source.
2. The User can correct the Representation Role before acceptance.
3. The User can explicitly choose which accepted Source becomes the Primary Representation.
4. Acceptance persists the selected role and primary choice on `entryRepresentations`.

Keep this one Source -> one Entry Representation for now. Do not add advanced extraction or multi-representation splitting.

## Why This Target

The product docs say accepted proposals should explicitly decide which submitted Sources become Entry Representations, Representation Role should be correctable during review, and Primary Representation selection should remain explicit entry data. The current implementation partially satisfies this by allowing Source inclusion/exclusion, but role and primary selection are still implicit.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- ADR: `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- Prior handoffs: `docs/handoffs/durable-smart-storage-spine.md`, `docs/handoffs/composer-multi-source-ui.md`, `docs/handoffs/link-preview-upload-cleanup.md`, `docs/handoffs/smart-storage-migration-hardening.md`, `docs/handoffs/smart-storage-contract-snapshots.md`, `docs/handoffs/smart-storage-llm-run-execution.md`, `docs/handoffs/smart-storage-model-flow-ui.md`
- PRD: No separate PRD found; synthesized from grilling session and docs.
- Issue docs: No issue docs found; inline issue brief below.
- Prototype: No prototype found.

## Inline Issue Brief

### What to build

Add review-time representation decisions to the Smart Storage Proposal review and acceptance contract.

### Acceptance criteria

- [ ] `src/App.tsx` Smart Storage Proposal review shows each cited Source with:
  - include/exclude control
  - Representation Role control with the current global role enum
  - Primary Representation control for included Sources
- [ ] Defaults preserve current behavior:
  - all cited Sources included initially
  - Authored Text / text excerpts default to `primaryContent`
  - external URLs default to `supportingMaterial`
  - uploaded files use existing content-type/file-name heuristics when available, otherwise a conservative fallback
  - the first included Source is primary by default
- [ ] `src/knowledgeContracts.ts` has the small shared frontend types needed for representation decisions and roles.
- [ ] `convex/smartStorage.ts` acceptance accepts explicit representation decisions while preserving backwards compatibility for existing `selectedSourceIds`.
- [ ] Backend validation rejects decisions for Sources not cited by the Proposal.
- [ ] Backend validation rejects no included Sources.
- [ ] Backend validation rejects multiple primary representations and either rejects or deterministically defaults when no primary is selected. Prefer rejecting in the explicit decision path and keeping old fallback behavior for `selectedSourceIds`.
- [ ] Backend validation rejects Representation Roles not allowed by the Type Behavior for the proposed Knowledge Type.
- [ ] Accepted `entryRepresentations` persist the selected `representationRole` and `isPrimary` values.
- [ ] Existing model-run, fallback, upload, URL, Contribution Editor, and integrated App tests still pass.

### Out of scope

- Advanced extraction or one Source producing multiple Entry Representations.
- Rich transcript/text extraction from files or URLs.
- Update-existing-entry acceptance.
- Merge/split review.
- Save drafts or delivery channels.
- Full proposal editing beyond representation decisions.

## Domain Language

- `Entry Representation` is a content/media form through which a Knowledge Entry is expressed.
- `Representation Role` describes how the representation functions, such as primary content, manuscript, slides, transcript, recording, thumbnail, or supporting material.
- `Primary Representation` is the default representation to show/open/play when the app cannot present every representation at once.
- `Source` is Bronze Layer raw material; acceptance decides which Sources become Gold Layer Entry Representations.

## Decisions That Must Hold

- Sources do not automatically become Entry Representations when accepted; acceptance should explicitly determine which Sources become confirmed representations. Source: `docs/product-core.md`.
- Type Behavior should define default Primary Representation selection, with user override during proposal review. Source: `docs/product-core.md`.
- Representation Role should not replace explicit Primary Representation selection. Source: `docs/product-core.md`.
- Type Behavior should define allowed/default Representation Roles while Smart Storage may infer roles and User may correct them. Source: `docs/product-core.md`.
- Initial Representation Role enum is `unspecified`, `primaryContent`, `manuscript`, `slides`, `transcript`, `recording`, `thumbnail`, and `supportingMaterial`. Source: `docs/product-core.md` and `convex/lib/typeBehavior.ts`.

## Relevant Code Map

- `src/App.tsx`: `SmartStorageProposalReviewPanel`, selected Source IDs, acceptance call, and Smart Storage run/proposal review state.
- `src/knowledgeContracts.ts`: Smart Storage proposal/citation/review summary types.
- `src/App.integrated.test.tsx`: integrated Smart Storage tests, including selected Source IDs and model-flow fallback tests.
- `convex/smartStorage.ts`: `acceptScaffoldProposal`, `loadSelectedProposalSources`, `insertAcceptedRepresentationsAndOutputs`, role inference helpers.
- `convex/smartStorage.test.ts`: backend acceptance tests and representation assertions.
- `convex/lib/typeBehavior.ts`: `REPRESENTATION_ROLES`, `RepresentationRole`, Type Behavior allowed/default roles.
- `convex/schema.ts`: `entryRepresentations.representationRole` and `isPrimary`.

## Implementation Guidance

- Keep the backend API backwards compatible:
  - Existing callers using `selectedSourceIds` should continue to work.
  - New callers may send a `representationDecisions` array, e.g. `{ sourceId, includeAsRepresentation, representationRole, isPrimary }`.
- Prefer explicit `representationDecisions` over `selectedSourceIds` when both are present.
- Keep the UI compact. This is a review-control surface, not a new editor redesign.
- Avoid nested card UI. The current Source citation list can become a small table/list with controls.
- Use familiar controls:
  - checkbox for include/exclude
  - select/menu for role
  - radio button for primary
- If a Source is excluded, disable its role and primary controls.
- If the primary Source is excluded, move primary to another included Source or disable acceptance until the User chooses one.
- If the proposal has no citations, preserve current fallback behavior.
- Do not store role inference confidence on Gold Layer Entry Representations in this slice.

## Test Plan

Use TDD where practical:

1. Add a backend test accepting a proposal with explicit representation decisions and assert `entryRepresentations` store the selected roles and one primary.
2. Add backend tests for invalid decisions: uncited Source, no included Sources, multiple primary, and disallowed role if feasible.
3. Add/update integrated UI tests so the User can:
  - change an uploaded file role, e.g. `supportingMaterial` to `slides`
  - mark that file as primary
  - accept the proposal
  - verify the mutation receives `representationDecisions`
4. Rerun existing model-flow fallback tests to ensure the new controls do not break failed/no-proposal handling.

Tests should verify public behavior rather than private implementation details.

## Verification Commands

- `cmd /c npx convex codegen`
- `cmd /c npx vitest run convex/smartStorage.test.ts --reporter=dot`
- `cmd /c npx vitest run src/ContributionEditor.test.tsx src/App.integrated.test.tsx --reporter=dot`
- `cmd /c npx tsc -b --pretty false`
- `cmd /c npm run build`

## Risks / Open Questions

- The current citation summary does not carry full Source metadata to the frontend. If better default-role inference needs metadata, add only the smallest summary fields needed, or mirror the existing backend heuristics from citation kind/locator.
- This slice should not attempt role inference confidence or audit history.
- The working tree is dirty from prior slices. Do not revert unrelated changes.

## Expected Final Response From Coding Agent

Summarize:

1. What review controls were added
2. How acceptance validates and persists representation decisions
3. What checks passed
4. Recommended next slice
