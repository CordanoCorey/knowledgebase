# Code Handoff: Smart Storage Model Flow UI

## Coding Agent Prompt

You are implementing one narrow vertical slice of the Smart Storage roadmap: make the app flow use the model-backed Smart Storage Run execution path while preserving an explicit deterministic scaffold fallback.

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
- `docs/handoffs/smart-storage-contract-snapshots.md`
- `docs/handoffs/smart-storage-llm-run-execution.md`

Do not re-litigate documented decisions unless the code contradicts them. If docs and code disagree in a way that changes behavior, stop and report the contradiction before implementing.

## What To Do

Implement slice 7: Smart Storage model-flow UI wiring with deterministic fallback.

Target type: vertical slice.

After a user submits through Store Smartly, the app should be able to execute the queued Smart Storage Run through the new `api.smartStorage.executeModelRun` action and handle all supported outcomes:

1. `proposalCreated` / `existingProposal`: show the returned Smart Storage Proposal review, as the current deterministic path does.
2. `failed`: show a quiet Smart Storage review/status surface explaining that the Source was preserved but model proposal generation failed.
3. `noProposal`: show a quiet Smart Storage review/status surface explaining that the Source was preserved but no structured proposal was found.
4. In failed/no-proposal states, give the user an explicit deterministic scaffold fallback action so they can still review a conservative scaffold proposal.

Keep the fallback explicit. Do not silently create a Gold Layer entry or hide model failure.

## Why This Target

Slice 6 added backend `executeModelRun`, but the current app still calls deterministic `generateDraftProposalForRun` immediately after `startFromContribution`. That means real model execution is tested but not reachable through the composer flow. This slice connects the app to the model path while preserving the existing deterministic scaffold as an intentional fallback.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- ADR: `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- Prior handoffs: `docs/handoffs/durable-smart-storage-spine.md`, `docs/handoffs/composer-multi-source-ui.md`, `docs/handoffs/link-preview-upload-cleanup.md`, `docs/handoffs/smart-storage-migration-hardening.md`, `docs/handoffs/smart-storage-contract-snapshots.md`, `docs/handoffs/smart-storage-llm-run-execution.md`
- PRD: No separate PRD found; synthesized from grilling session and docs.
- Issue docs: No issue docs found; inline issue brief below.
- Prototype: No prototype found.

## Inline Issue Brief

### What to build

Wire model-backed Smart Storage execution into the app flow and add a visible failed/no-proposal state with an explicit scaffold fallback.

### Acceptance criteria

- [ ] `src/App.tsx` uses `api.smartStorage.executeModelRun` through a Convex action hook or the existing project equivalent.
- [ ] Store Smartly no longer always calls deterministic `generateDraftProposalForRun` first.
- [ ] When model execution returns `proposalCreated` or `existingProposal`, the existing Smart Storage Proposal review UI displays the returned proposal, citations, and accept flow.
- [ ] When model execution returns `failed`, the UI states that the Source was preserved and model proposal generation failed, with the run error message if available.
- [ ] When model execution returns `noProposal`, the UI states that the Source was preserved and no structured proposal was found.
- [ ] Failed/no-proposal states include an explicit button/action to generate a conservative scaffold proposal.
- [ ] The conservative scaffold fallback works after a failed/no-proposal model run without duplicating proposals or leaving stale run state.
- [ ] Existing deterministic backend behavior remains available and existing tests still pass.
- [ ] App integrated tests cover model success and failed/no-proposal fallback using mocked Convex actions/mutations; no real OpenAI calls happen in tests.

### Out of scope

- Advanced extraction of uploaded files, URLs, audio, video, or documents.
- Multiple proposals from one run.
- Update-existing-entry acceptance.
- Merge/split review.
- Save drafts or delivery channels.
- Retiring/incompatible contract-version workflows.
- Full pending-review dashboard or operator queue.

## Domain Language

- `Smart Storage Run` records the attempt and operational status.
- `Smart Storage Proposal` is reviewable Silver Layer material.
- `Source` is Bronze Layer raw material and remains preserved even when model generation fails or produces no proposal.
- `Scaffold Proposal` is a conservative deterministic proposal that preserves the submitted material without pretending advanced extraction happened.

## Decisions That Must Hold

- Failed LLM calls, parse failures, and validation failures belong on Smart Storage Runs rather than failed proposal rows. Source: `docs/product-core.md`.
- No-proposal outcomes should be surfaced quietly in the contribution or review area, not as Answer Feed items. Source: `docs/product-core.md`.
- Bronze Sources remain preserved when enrichment fails, times out, or produces no acceptable proposal. Source: `docs/product-core.md`.
- User confirmation remains the boundary where proposal material becomes Gold Layer knowledge. Source: `docs/product-core.md`.
- Before advanced extraction exists, scaffold proposals are conservative and acceptable only when the user explicitly confirms the reviewable proposal. Source: `docs/product-core.md`.

## Relevant Code Map

- `src/App.tsx`: currently `handleStoreSmartlyContribution` calls `startFromContribution` then deterministic `generateDraftProposalForRun`; proposal review UI lives in this file.
- `src/knowledgeContracts.ts`: current `SmartStorageProposalReviewSummary` only represents proposal review states; may need a small run-status summary type.
- `src/App.integrated.test.tsx`: mocks Convex mutations/actions and has the Smart Storage composer/review integration test.
- `convex/smartStorage.ts`: `executeModelRun`, `generateDraftProposalForRun`, and run/proposal state transitions.
- `convex/smartStorage.test.ts`: backend tests for model execution and deterministic generation.

## Implementation Guidance

- Keep UI copy quiet and factual. Avoid making model failure look like contribution failure; the Source was preserved.
- Prefer a small separate state object for failed/no-proposal run review rather than overloading `SmartStorageProposalReviewSummary` with non-proposal states.
- If the backend deterministic fallback cannot currently run after a failed/no-proposal model execution, make the smallest backend change needed to allow an explicit scaffold fallback when there is no existing proposal. Clear or update stale run error fields as appropriate.
- Do not silently fallback to deterministic proposal generation inside `handleStoreSmartlyContribution`; the user should see that model generation failed or found no proposal and choose the scaffold fallback.
- Do not call OpenAI from tests. Mock the Convex action result in `src/App.integrated.test.tsx`.
- Preserve current upload/external URL/contribution note behavior.
- If app-level Convex action mocking needs a new helper, keep it local to the integrated test harness.

## Test Plan

Use TDD where practical:

1. Add or update an integrated test where Store Smartly calls `smartStorage:executeModelRun` and displays a model-created proposal.
2. Add an integrated test where Store Smartly receives `failed`, displays preserved-source/failure UI, and does not display a proposal.
3. Add an integrated test or backend test where clicking the scaffold fallback after failure creates/displays a deterministic proposal.
4. If backend status handling changes, add focused backend coverage for deterministic fallback after `failed` or `noProposal`.
5. Rerun Smart Storage backend, editor, integrated, typecheck, codegen, and build checks.

Tests should verify public behavior rather than private implementation details.

## Verification Commands

- `cmd /c npx convex codegen`
- `cmd /c npx vitest run convex/smartStorage.test.ts --reporter=dot`
- `cmd /c npx vitest run src/ContributionEditor.test.tsx src/App.integrated.test.tsx --reporter=dot`
- `cmd /c npx tsc -b --pretty false`
- `cmd /c npm run build`

## Risks / Open Questions

- Local/dev environments may not have `OPENAI_API_KEY`; this is why the fallback must be explicit and tests must mock the action.
- Avoid broad UI redesign. This slice should only make the model execution result reachable and reviewable.
- The working tree is dirty from prior slices. Do not revert unrelated changes.

## Expected Final Response From Coding Agent

Summarize:

1. How the app now calls model execution
2. How failed/no-proposal states appear
3. How deterministic scaffold fallback works
4. What checks passed
5. Recommended next slice
