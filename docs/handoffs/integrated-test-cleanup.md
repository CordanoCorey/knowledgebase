# Code Handoff: Integrated Test Cleanup

## Coding Agent Prompt

You are implementing one small supporting test-cleanup slice that follows the Smart Storage spine work.

Before editing code, read:

- `AGENTS.md`
- `CONTEXT.md`
- `docs/product-core.md`, especially the Knowledge Composer / Knowledge Navigator language
- `docs/handoffs/durable-smart-storage-spine.md`
- `docs/handoffs/composer-multi-source-ui.md`
- `docs/handoffs/link-preview-upload-cleanup.md`
- `docs/handoffs/smart-storage-migration-hardening.md`

Do not re-litigate documented decisions unless the code contradicts them. If docs and code disagree in a way that changes behavior, stop and report the contradiction before implementing.

## What To Do

Implement slice 4: integrated test cleanup.

Target type: supporting technical slice.

Make the full `src/App.integrated.test.tsx` suite green again after the Smart Storage work. The known current failure is a stale placeholder expectation:

- Current component copy in `src/KnowledgeRequestComposer.tsx`: `Ask a Question or Context...`
- Current failing test expectation in `src/App.integrated.test.tsx`: `Ask a Question or Add Context...`
- `docs/product-core.md` supports the current wording style: `Ask a Question or Context`

Prefer updating the stale test expectation to match the documented/current UI copy. Do not change product copy unless inspection shows the product docs or surrounding UI require it.

## Why This Target

Earlier Smart Storage verification proved the targeted backend/editor/App flows pass, but the full integrated App suite still fails on one unrelated stale assertion. This slice removes that noise so future Smart Storage regressions are visible again.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- Prior handoffs: `docs/handoffs/durable-smart-storage-spine.md`, `docs/handoffs/composer-multi-source-ui.md`, `docs/handoffs/link-preview-upload-cleanup.md`, `docs/handoffs/smart-storage-migration-hardening.md`
- PRD: No separate PRD found; synthesized from grilling session and docs.
- Issue docs: No issue docs found; inline issue brief below.
- Prototype: No prototype found.

## Inline Issue Brief

### What to build

Resolve stale integrated-test expectations so the full App integrated test file passes.

### Acceptance criteria

- [ ] `cmd /c npx vitest run src/App.integrated.test.tsx --reporter=dot` passes.
- [ ] The dashboard Knowledge Composer placeholder assertion matches the documented/current copy.
- [ ] The fix does not weaken the test by removing the assertion or making it vague.
- [ ] No user-facing behavior changes are made unless a test failure reveals real implementation drift from product docs.
- [ ] Existing Smart Storage targeted tests still pass if they are touched or if the cleanup changes shared test setup.

### Out of scope

- New Smart Storage behavior.
- Advanced extraction, real LLM contract generation, update-existing-entry acceptance, merge/split review, save drafts, delivery channels, or rich multi-proposal generation.
- Broad test refactors or snapshot rewrites.
- Styling or UI copy redesign beyond the stale expectation.

## Domain Language

- `Knowledge Composer` is the user-facing input surface for asking, searching, contributing, or shaping Active Knowledge Context from one place.
- `Active Knowledge Context` is the Knowledge Context in effect for the current Knowledge Page.
- `Knowledge Navigator` is the control for selecting active Tags and Questions that define the current Knowledge Context.

## Decisions That Must Hold

- The left rail includes a compact Knowledge Composer for the current context. Source: `docs/product-core.md`.
- The Knowledge Composer may use wording such as `Ask a Question or Context` and typeahead suggestions for Tags and Questions. Source: `docs/product-core.md`.
- Pressing Enter without selecting a suggestion should run a context search rather than changing Active Knowledge Context. Source: `docs/product-core.md`.

## Relevant Code Map

- `src/App.integrated.test.tsx`: currently has the stale dashboard placeholder expectation around the school-day dashboard test.
- `src/KnowledgeRequestComposer.tsx`: renders the current Knowledge Composer placeholder.
- `src/App.tsx`: mounts the Knowledge Composer in the dashboard rail and page shell.
- `src/ContributionEditor.tsx` / `src/ContributionEditor.test.tsx`: should not need changes, but keep in mind they were touched in earlier slices.

## Implementation Guidance

- Start by reproducing the current failure with `cmd /c npx vitest run src/App.integrated.test.tsx --reporter=dot`.
- Make the smallest test update that aligns the assertion with documented behavior.
- If additional failures appear after fixing the known one, inspect each failure before editing. Fix stale expectations, but do not mask real behavior regressions.
- Keep the change scoped to integrated tests unless code and docs clearly disagree.
- Do not revert unrelated changes already in the working tree.

## Test Plan

Use TDD where practical:

1. Reproduce the one failing integrated test.
2. Update the stale expectation to match the documented/current UI copy.
3. Rerun the full integrated file.
4. Run a small broader check to catch type/build fallout.

Tests should verify public behavior rather than private implementation details.

## Verification Commands

- `cmd /c npx vitest run src/App.integrated.test.tsx --reporter=dot`
- `cmd /c npx tsc -b --pretty false`
- `cmd /c npm run build`

If you change shared Smart Storage test setup or components, also run:

- `cmd /c npx vitest run src/ContributionEditor.test.tsx`
- `cmd /c npx vitest run convex/smartStorage.test.ts`

## Risks / Open Questions

- This is intentionally small. If more than a couple of unrelated integrated failures appear, report them instead of drifting into a broad cleanup pass.
- The working tree is dirty from prior slices. Do not revert unrelated files.

## Expected Final Response From Coding Agent

Summarize:

1. What test expectation or code changed
2. What checks passed
3. Whether the full App integrated suite is now green
4. Any remaining follow-up slices
