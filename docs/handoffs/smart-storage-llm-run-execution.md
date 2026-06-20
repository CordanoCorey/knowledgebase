# Code Handoff: Smart Storage LLM Run Execution

## Coding Agent Prompt

You are implementing one supporting technical slice of the Smart Storage roadmap: real LLM execution for a queued Smart Storage Run.

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

Do not re-litigate documented decisions unless the code contradicts them. If docs and code disagree in a way that changes behavior, stop and report the contradiction before implementing.

## What To Do

Implement slice 6: backend Smart Storage LLM run execution.

Target type: supporting technical slice.

Add a narrow OpenAI-backed execution path for queued Smart Storage Runs that:

1. Builds request-specific input from the durable Contribution Submission, Sources, context tags, Smart Storage Contract snapshot, and Type Behavior snapshot.
2. Calls OpenAI's Responses API with structured JSON output.
3. Stores raw model output and run status on `smartStorageRuns`.
4. Creates a Smart Storage Proposal only after the returned JSON is parsed and validated against the existing proposal shape.
5. Records failures on the Run without creating a Proposal.

Keep the existing deterministic scaffold proposal path available. Do not implement advanced extraction, broad UI rewiring, or update-existing-entry acceptance in this slice.

## Why This Target

Slice 5 added durable Smart Storage Contract and Type Behavior snapshot records. The next narrow step is to prove a real model-call run can consume those snapshots and either produce a validated Silver Layer proposal or preserve a failed/no-proposal Run state for retry/review.

This slice should make the backend ready for real LLM proposal generation while keeping the existing user-facing flow stable.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- ADR: `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- Prior handoffs: `docs/handoffs/durable-smart-storage-spine.md`, `docs/handoffs/composer-multi-source-ui.md`, `docs/handoffs/link-preview-upload-cleanup.md`, `docs/handoffs/smart-storage-migration-hardening.md`, `docs/handoffs/smart-storage-contract-snapshots.md`
- OpenAI docs:
  - Responses API create response: `https://developers.openai.com/api/reference/resources/responses/methods/create`
  - Text generation guide: `https://developers.openai.com/api/docs/guides/text`
  - Structured Outputs guide: `https://developers.openai.com/api/docs/guides/structured-outputs`
- PRD: No separate PRD found; synthesized from grilling session and product docs.
- Issue docs: No issue docs found; inline issue brief below.
- Prototype: No prototype found.

## Current OpenAI Docs Notes

- Official OpenAI text-generation guidance recommends the Responses API over older Chat Completions for text generation, especially with reasoning models.
- The Responses API accepts `instructions` and `input`; the docs show JavaScript examples using `client.responses.create({ model, reasoning, instructions, input })`.
- Structured outputs can be requested through `text: { format: { type: "json_schema", name, schema, strict: true } }`.
- The API reference says `json_schema` structured outputs generate JSON matching a supplied JSON Schema, and `strict: true` asks the model to follow the exact schema subset supported by Structured Outputs.

## Inline Issue Brief

### What to build

Add a callable backend action for real Smart Storage model execution and focused tests around success, HTTP/API failure, invalid output, and no-key handling.

### Acceptance criteria

- [ ] There is a Convex action, preferably public only if it is intended to be called by the frontend, that executes one queued Smart Storage Run with OpenAI.
- [ ] The action does not access `ctx.db` directly; it uses queries/mutations according to Convex action rules.
- [ ] The action verifies the caller owns or may review the Run before sending Source/request data to OpenAI.
- [ ] The action marks the Run `running` before the OpenAI call and then marks it `succeeded`, `failed`, or `noProposal` through mutations.
- [ ] If `OPENAI_API_KEY` is not configured, the Run becomes `failed` with a clear error and no Proposal is created.
- [ ] The OpenAI request uses the Responses API endpoint (`https://api.openai.com/v1/responses`) or the official SDK if the repo intentionally adds it. Prefer `fetch` to avoid a new dependency unless the SDK clearly simplifies the implementation.
- [ ] The model name is configurable, such as `OPENAI_SMART_STORAGE_MODEL`, with a documented default.
- [ ] The OpenAI request uses structured JSON output with a schema matching the current one-proposal Smart Storage scaffold shape.
- [ ] Raw OpenAI response content is bounded and preserved on `smartStorageRuns.rawModelOutput`.
- [ ] Valid model output creates one Smart Storage Proposal, copies Run snapshot references/version/text, inserts Source citations, and sets the Contribution Submission to `reviewReady`.
- [ ] Invalid JSON, schema mismatch, refusal/no content, HTTP error, and network error mark the Run failed and do not create a Proposal.
- [ ] Existing deterministic `generateDraftProposalForRun` behavior remains available and existing tests remain green.

### Out of scope

- Advanced extraction of uploaded files, URLs, audio, video, or documents.
- Calling the model automatically from the frontend flow unless the implementation remains very small and preserves existing tests.
- Multiple proposals from one run.
- Update-existing-entry acceptance.
- Merge/split review.
- Save drafts or delivery channels.
- Retiring/incompatible contract-version workflows.
- Adding evaluation infrastructure.

## Domain Language

- `Smart Storage Run` records one Smart Storage attempt, including queued/running/succeeded/no-proposal/failed state and raw model output.
- `Smart Storage Contract` is the stable domain contract sent to the LLM; it is not the raw persistence schema.
- `Source` is Bronze Layer raw material and should remain preserved even when LLM execution fails.
- `Smart Storage Proposal` is Silver Layer and should only exist after parsed, validated contract-shaped output exists.

## Decisions That Must Hold

- Failed LLM calls, parse failures, and validation failures should be represented on Smart Storage Runs rather than by creating Smart Storage Proposals. Source: `docs/product-core.md`.
- Smart Storage Proposals should exist only after parsed and validated contract-shaped candidates are reviewable. Source: `docs/product-core.md`.
- Runs should preserve raw model output separately from parsed proposals. Source: `docs/product-core.md`.
- Bronze Sources remain preserved when enrichment fails, times out, or produces no proposal. Source: `docs/product-core.md`.
- Smart Storage Proposal acceptance remains user-confirmed; model generation must not write Gold Layer Knowledge Entries directly. Source: `docs/product-core.md`.

## Relevant Code Map

- `convex/smartStorage.ts`: start mutation, deterministic proposal mutation, Link Preview action pattern, snapshot helpers, proposal insertion/citation helpers.
- `convex/schema.ts`: `smartStorageRuns`, `smartStorageProposals`, snapshot tables, and run/proposal statuses.
- `convex/smartStorage.test.ts`: backend tests use `convex-test`, `vi.stubGlobal("fetch", ...)`, and existing action/mutation patterns.
- `convex/lib/typeBehavior.ts`: current Type Behavior registry/snapshot serialization.
- `src/App.tsx`: currently calls `startFromContribution` and then deterministic `generateDraftProposalForRun`; avoid broad UI changes unless deliberately scoped.

## Implementation Guidance

- Follow Convex guidelines: use `action`/`internalAction` for external network calls; use `ctx.runQuery` and `ctx.runMutation` for database work; do not use `ctx.db` inside actions.
- Consider adding small internal query/mutation helpers:
  - load and authorize a Run for model execution
  - mark Run running
  - complete Run with validated proposal
  - fail Run with raw output/error
- Make completion idempotent where practical: if a proposal already exists for the Run, return it rather than creating a duplicate.
- Keep input bounded. Do not send unlimited Source text; use existing limits/previews where possible and include Source inventory/citations.
- Keep the JSON schema close to current `smartStorageProposedEntry`: `knowledgeType`, `title`, `bodyPreview`, `contextTags`, `proposalConfidence`, and `rationale`.
- Extract model text robustly. Raw Responses API payloads may expose useful content in `output_text` or in `output[].content[].text`; tests can lock down the supported extraction.
- Do not introduce an OpenAI SDK dependency unless the worker verifies it is worth the dependency. A direct `fetch` call keeps this slice smaller.
- Do not log API keys or request bodies containing user Sources.
- Keep `generateDraftProposalForRun` deterministic and available. If you add a model-backed action, name it distinctly, e.g. `generateModelProposalForRun` or `executeModelRun`.

## Test Plan

Use TDD where practical:

1. Add a test where a mocked successful Responses API payload produces a validated Proposal and marks the Run succeeded.
2. Add a test where missing `OPENAI_API_KEY` marks the Run failed and creates no Proposal.
3. Add a test where a non-2xx OpenAI response marks the Run failed and preserves bounded raw/error data.
4. Add a test where invalid JSON or schema-mismatched output marks the Run failed and creates no Proposal.
5. Add a test proving existing deterministic proposal generation still works.

Tests should verify public/internal function behavior rather than private implementation details.

## Verification Commands

- `cmd /c npx convex codegen`
- `cmd /c npx vitest run convex/smartStorage.test.ts --reporter=dot`
- `cmd /c npx vitest run src/ContributionEditor.test.tsx src/App.integrated.test.tsx --reporter=dot`
- `cmd /c npx tsc -b --pretty false`
- `cmd /c npm run build`

## Risks / Open Questions

- Model availability and preferred model name can change. The handoff used official OpenAI docs on June 18, 2026; check official docs again before hardcoding a new model default.
- A real API key may not be configured in local/test environments; tests should mock fetch and environment variables rather than calling OpenAI.
- Frontend integration is intentionally deferred unless it stays tiny; the safest first landing is a backend-callable action with tests.

## Expected Final Response From Coding Agent

Summarize:

1. What action/query/mutation helpers were added
2. How OpenAI request/response handling works
3. How failures affect Run/Proposal state
4. What checks passed
5. Recommended next slice
