# Code Handoff: Smart Storage Update Existing Entry Acceptance

## Coding Agent Prompt

You are implementing one vertical slice of the Smart Storage feature that has already been clarified through a grilling session.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`
- `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`

Do not re-litigate documented decisions unless the code contradicts them. If docs and code disagree in a way that changes behavior, stop and report the contradiction before implementing.

## What To Do

Implement update-existing-entry acceptance for Smart Storage Proposals.

Target type: inferred vertical slice.

Today `acceptScaffoldProposal` correctly refuses to create a duplicate Gold Layer Knowledge Entry when the proposed same-typed Referent is already represented. It patches the Smart Storage Proposal to `needsResolution` and returns `acceptanceStatus: "targetExists"` plus `existingEntryId`. This slice should add the explicit follow-up path that lets the user confirm applying that reviewed proposal to the existing Gold Entry when permitted.

Keep this narrow: the update path should add confirmed proposal material to the existing entry without creating a duplicate entry, and without attempting merge/split review or field-level conflict resolution.

## Why This Target

This is the next small tracer bullet after representation decisions. It closes the current review loop: Smart Storage can detect an existing target, show the user that the target exists, and then accept the proposal as an authorized update to that existing Gold Entry instead of stopping at a dead-end `needsResolution` state.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- ADR: `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- PRD / plan: No PRD found; synthesized from grilling session and product docs.
- Issue docs: No issue docs found; inline issue brief below.
- Prototype: No prototype found.

## Inline Issue Brief

### What to build

When Smart Storage Proposal acceptance finds that the proposed same-typed Referent already has a Knowledge Entry, the app should show the target-exists state and provide an explicit confirmed action to add the accepted proposal's selected Entry Representations and Source outputs to the existing entry, instead of creating a duplicate.

### Acceptance criteria

- [ ] First acceptance attempt for an existing target still returns `acceptanceStatus: "targetExists"`, stores proposal `status: "needsResolution"`, and does not update the existing entry automatically.
- [ ] A confirmed existing-entry update adds selected cited Sources as Entry Representations on the existing Knowledge Entry using the current representation decisions.
- [ ] A confirmed existing-entry update creates `sourceOutputs` rows from the cited Sources to the existing Knowledge Entry.
- [ ] The confirmed path does not create a duplicate `knowledgeEntries` row.
- [ ] The confirmed path marks the Smart Storage Proposal accepted and advances the parent Contribution Submission consistently with normal acceptance.
- [ ] The backend rejects a confirmed update when the provided existing entry is not the current same-typed represented target.
- [ ] The backend rejects unauthorized existing-entry updates using the app's current access model.
- [ ] The proposal review UI exposes an explicit action for the `Target Exists` state and sends the confirmed update request only after the user chooses it.
- [ ] Existing new-entry acceptance and representation-decision behavior still works.

### Out of scope

- Merge/split review.
- Referent identity changes, aliasing, or Type Reclassification.
- Overwriting existing title, canonical identity, or existing body/preview content.
- Field-level conflict resolution for rich extracted fields.
- Rich multi-proposal child-entry generation.
- Save drafts and delivery channels.
- Advanced extraction or new LLM contract design.

## Domain Language

- `Smart Storage Proposal` is a durable Silver Layer candidate for creating or updating one Knowledge Entry before user confirmation.
- `Gold Layer` means confirmed Knowledge Entries.
- `Contribution Submission` is the durable parent for Smart Storage Sources, Runs, and Proposals.
- `Primary Intended Entry` is the one Knowledge Entry the Contribution Submission is principally meant to create or update.
- `Entry Representation` is a content/media form belonging to one Knowledge Entry.
- `Representation Role` describes how a representation functions, separate from representation kind.
- `Primary Representation` is the default display/open/play representation.
- Avoid using `Source`, `file`, or `draft entry` as synonyms for confirmed Knowledge Entries or Entry Representations.

## Decisions That Must Hold

- Smart Storage must not create duplicate same-typed represented Knowledge Entries when the Referent is already represented. See `docs/product-core.md`, Core Model and Invariants.
- Smart Storage may flag duplicate Referents, but merge/split belongs to a separate permissioned workflow. See `docs/product-core.md`.
- Proposal acceptance must perform the authoritative current identity check and must verify permission before adding confirmed information to an existing entry. See `docs/product-core.md` Smart Storage invariants.
- Accepted proposals should explicitly decide which submitted Sources become Entry Representations. Bronze Sources should not automatically become Gold Layer representations. See `docs/product-core.md`.
- Contribution Submissions are the durable workflow parent for multi-source Smart Storage. See ADR 0008.

## Relevant Code Map

- `convex/smartStorage.ts`: `acceptScaffoldProposal` currently performs identity resolution, returns `targetExists`, creates new entries, creates selected Entry Representations, creates `sourceOutputs`, and patches proposal/submission status.
- `convex/smartStorage.ts`: `resolveRepresentedIdentity` returns `targetExists` when `knowledgeEntries.by_representedReferentId` already has an entry.
- `convex/smartStorage.test.ts`: existing target-exists backend coverage around `returns a target-exists state instead of updating an existing Gold entry`.
- `convex/schema.ts`: Smart Storage Proposal status, `entryRepresentations`, `sourceOutputs`, Contribution Submission status, and related indexes.
- `src/App.tsx`: `handleAcceptSmartStorageProposal` currently maps `targetExists` into review state; Proposal review panel formats this as `Target Exists`.
- `src/App.integrated.test.tsx`: integrated tests cover proposal acceptance payloads and representation decisions.
- `src/knowledgeContracts.ts`: shared UI/domain contract types for Smart Storage Proposal summaries and representation decisions.

## Implementation Guidance

- Read the existing acceptance logic before changing it and preserve new-entry behavior.
- Keep Convex functions validator-backed and typed. Use `Id<"table">` where appropriate.
- Prefer extending `acceptScaffoldProposal` with a narrow confirmation argument, or adding one adjacent mutation if that is cleaner. Either way, the first non-confirmed target-exists attempt must remain non-destructive.
- Require the caller to provide the target existing entry id on the confirmed path. Re-resolve the proposal identity inside the mutation and reject if the provided id is not the current existing target for the proposed same-typed Referent.
- Use the current access model. At minimum, do not allow updating someone else's existing entry unless the existing app code already has a broader edit permission path for that scope. If the access model is currently user-owned only, keep this slice user-owned and name that assumption in the final response.
- Append selected representations/source outputs to the existing entry. Do not overwrite the existing entry's title, represented Referent, primary Tag, or identity fields.
- Use the representation-decision helpers from the prior slice. The confirmed existing-entry path should honor included/excluded cited Sources, `representationRole`, and `isPrimary`.
- Keep writes atomic inside the Convex mutation. Avoid calling actions from mutations.
- Make duplicate `sourceOutputs` or duplicate representations deterministic. If existing behavior has no dedupe helper, add the smallest local guard needed for this path.
- Do not commit or create a PR from the worker thread. The parent thread will do final branch verification and PR creation.

## Test Plan

Use TDD where practical:

1. Add backend coverage for confirmed existing-entry update after an initial `targetExists` result.
2. Add backend coverage for wrong existing entry id and unauthorized update.
3. Add integrated UI coverage showing the `Target Exists` state and a second explicit confirmed update action.
4. Run the existing Smart Storage and Contribution Editor/App integrated suites.

Tests should verify public behavior rather than private implementation details.

## Verification Commands

- `cmd /c npx convex codegen`
- `cmd /c npx vitest run convex/smartStorage.test.ts --reporter=dot`
- `cmd /c npx vitest run src/ContributionEditor.test.tsx src/App.integrated.test.tsx --reporter=dot`
- `cmd /c npx tsc -b --pretty false`
- `cmd /c npm run build`

## Risks / Open Questions

- The durable permission model may still be narrower than the product docs' eventual Review Scope/edit-permission rule. Prefer a conservative user-owned update path if no broader permission helper exists.
- Existing Entry Representation primary selection may already have a primary representation. Do not attempt a rich per-need replacement model in this slice; make the smallest safe behavior and cover it with tests.
- If a confirmed update should change preview/search text, keep it minimal and bounded. It is acceptable for this slice to leave preview/search unchanged if the update is represented through child rows.

## Expected Final Response From Coding Agent

Summarize:

1. What changed
2. What tests/checks passed
3. Any docs that need updates
4. Any follow-up slices
