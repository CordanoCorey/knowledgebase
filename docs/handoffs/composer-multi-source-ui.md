# Code Handoff: Composer Multi-Source UI

## Coding Agent Prompt

You are implementing the next vertical slice after the durable Smart Storage spine.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`
- `docs/adr/0006-store-smart-storage-proposals-as-durable-silver-records.md`
- `docs/adr/0007-store-smart-storage-proposals-as-persistence-agnostic-domain-contracts.md`
- `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- `docs/handoffs/durable-smart-storage-spine.md`
- `docs/handoffs/composer-multi-source-ui.md`
- `convex/schema.ts`
- `convex/smartStorage.ts`
- `convex/smartStorage.test.ts`
- `src/ContributionEditor.tsx`
- `src/ContributionEditor.test.tsx`
- `src/knowledgeContracts.ts`
- `src/App.tsx`
- `src/App.integrated.test.tsx`
- `src/index.css`

Do not re-litigate documented decisions unless code and docs directly contradict each other. Keep this slice focused on making the durable multi-Source Smart Storage path usable from the Knowledge Composer UI.

## What To Do

Implement the Composer Multi-Source UI slice:

Allow a signed-in user using the Contribution Editor's Smart Storage path to add substantive text, one or more external URLs, one or more uploaded files, and an optional Contribution Note; review the Source inventory before submission; submit all Sources through the existing durable Smart Storage backend; view citations in the scaffold Proposal; choose which cited Sources should become Entry Representations; and accept the Proposal into one new Gold Layer Knowledge Entry.

Target type: inferred vertical slice from the user's "slice 1" request.

## Why This Target

The durable Smart Storage backend now accepts `uploadedFiles`, `externalUrls`, `contributionNote`, and `selectedSourceIds`, but the visible Contribution Editor still only collects title/body text. This slice turns that backend capability into a usable end-to-end composer flow without expanding into advanced extraction, Link Preview fetching, cleanup jobs, or update-existing-entry acceptance.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- Prior implementation brief: `docs/handoffs/durable-smart-storage-spine.md`
- Relevant ADRs: `docs/adr/0006-store-smart-storage-proposals-as-durable-silver-records.md`, `docs/adr/0007-store-smart-storage-proposals-as-persistence-agnostic-domain-contracts.md`, `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- Current backend: `convex/smartStorage.ts`, `convex/smartStorage.test.ts`, `convex/schema.ts`
- Current frontend seams: `src/ContributionEditor.tsx`, `src/knowledgeContracts.ts`, `src/App.tsx`, `src/App.integrated.test.tsx`, `src/index.css`
- PRD / plan: no separate PRD found; synthesized from the grilling session and product docs.
- Issue docs: no issue found for this exact slice; inline issue brief below.
- Prototype: no separate prototype found; current Contribution Editor and Smart Storage proposal panel are the implementation reference.

## Inline Issue Brief

### What To Build

Make multi-Source Smart Storage usable from the Contribution Editor:

- Add Contribution Note input for Smart Storage submissions.
- Add external URL input and a compact URL Source inventory.
- Add browser-to-Convex file upload controls and uploaded file Source inventory.
- Create temporary upload records after storage upload succeeds.
- Route Smart Storage submission through the existing `ContributionInput.uploadedFiles`, `externalUrls`, and `contributionNote` fields.
- Show Source citations in the proposal review panel as selectable items.
- Pass selected Source IDs to `acceptScaffoldProposal`.
- Keep direct post behavior separate and text-focused.

### Acceptance Criteria

- [ ] In Smart Storage mode, the Contribution Editor lets a user add at least one external URL Source.
- [ ] In Smart Storage mode, the Contribution Editor lets a user upload at least one file Source through Convex storage.
- [ ] Uploaded file bytes go browser-to-Convex storage; contribution mutations receive only storage IDs and metadata.
- [ ] After upload succeeds, the app creates a `temporaryUploads` row using `api.smartStorage.createTemporaryUploadRecord`.
- [ ] In Smart Storage mode, the Contribution Editor lets a user add an optional Contribution Note.
- [ ] The composer shows a compact Source inventory for authored text, external URLs, and uploaded files before submission.
- [ ] Adding files or external URLs routes submission through Store Smartly, not Direct Post.
- [ ] Store Smartly sends `uploadedFiles`, `externalUrls`, and `contributionNote` to `api.smartStorage.startFromContribution`.
- [ ] The Smart Storage Proposal review panel shows each Source citation as a selectable item.
- [ ] The user can choose which cited Sources become Entry Representations before accepting.
- [ ] `api.smartStorage.acceptScaffoldProposal` receives `selectedSourceIds`.
- [ ] If no citation is selected, the UI prevents acceptance or clearly defaults to the backend's all-cited-Sources behavior.
- [ ] Text-only Smart Storage still works.
- [ ] Existing Direct Post behavior still works and does not create Bronze/Silver workflow state.

### Out Of Scope

- Backend schema redesign for Smart Storage.
- Advanced extraction from uploaded files, media, or URLs.
- Real LLM contract generation.
- Backend Link Preview fetch action or preview history.
- Temporary upload expiration/cleanup jobs.
- Update-existing-entry acceptance.
- Delivery channels.
- Merge/split review.
- Save drafts or autosave.
- Rich multi-proposal child-entry generation.
- Fixing the unrelated full integrated-test placeholder mismatch in `KnowledgeRequestComposer`.

## Domain Language

- `Contribution Submission`: a single user intent to Contribute, collecting material and choices submitted from a composer before it is posted directly or processed through Smart Storage.
- `Source`: Bronze Layer raw material, not a Knowledge Type and not a Knowledge Entry.
- `Authored Text Source`: user-authored or pasted substantive text submitted as raw material.
- `Contribution Note`: non-substantive guidance that steers a Contribution Submission without becoming represented knowledge by default.
- `Link Preview`: fetched metadata that helps a user recognize an external URL. Link Preview is not Factual Provenance or Human Weight Evidence.
- `Entry Representation`: a content or media form through which a Knowledge Entry is expressed.
- `Representation Role`: how an Entry Representation functions for the entry.
- `Primary Representation`: the selected default Entry Representation for display/open/preview/playback.

Avoid calling uploaded files or external URLs Knowledge Types. They are Sources before acceptance and may become Entry Representations only after review/acceptance.

## Decisions That Must Hold

- Attachments and external URLs in the first composer slice route through the durable Bronze path rather than simple direct posting.
- Direct post remains text-focused until direct attachment and direct external-URL representation behavior exists.
- Contribution Notes are guidance, not entry body and not a Source by default.
- Uploaded files must be stored in Convex storage before Contribution Submission persistence.
- The Smart Storage mutation must receive storage IDs and file metadata, not file bytes.
- Link Preview fetching is backend-owned and non-blocking, but this slice does not need to implement the fetch action.
- Proposal review decides which submitted Sources become Entry Representations.
- Representation Role does not replace explicit Primary Representation selection.
- Bronze Sources remain preserved after acceptance for later extraction/Reprocessing.

## Relevant Code Map

- `src/ContributionEditor.tsx`: current editor state, `createContributionInput`, and direct vs Smart Storage submit buttons.
- `src/ContributionEditor.test.tsx`: current editor rendering and payload unit tests.
- `src/knowledgeContracts.ts`: already includes `ContributionInput.contributionNote`, `externalUrls`, and `uploadedFiles`.
- `src/App.tsx`: `handleStoreSmartlyContribution` already forwards `contributionNote`, `externalUrls`, and `uploadedFiles`; `toConvexUploadedFiles` casts storage IDs for the mutation.
- `src/App.tsx`: `SmartStorageProposalReviewPanel` displays Source citations and calls accept, but currently does not collect `selectedSourceIds`.
- `src/App.integrated.test.tsx`: Smart Storage integration mock and the "stores dashboard Smart Storage contributions without direct posting" test.
- `src/index.css`: Contribution Editor and Smart Storage Proposal panel styling.
- `convex/smartStorage.ts`: `createTemporaryUploadRecord`, `startFromContribution`, and `acceptScaffoldProposal(selectedSourceIds)`.
- `convex/smartStorage.test.ts`: backend coverage for multiple Sources, temporary uploads, citations, and acceptance.

## Implementation Guidance

- Prefer extending `ContributionEditor` rather than creating a new composer.
- Keep state local to `ContributionEditor` unless an app-level concern needs it.
- Add a narrow upload-url Convex mutation if none exists, e.g. a public mutation returning `ctx.storage.generateUploadUrl()`.
- Browser upload flow should be:
  1. request upload URL,
  2. `fetch` POST the file blob to Convex storage,
  3. read returned storage ID,
  4. call `api.smartStorage.createTemporaryUploadRecord`,
  5. store file metadata in `ContributionInput.uploadedFiles`.
- External URL flow can begin as manual URL entry plus optional title. Do not build automatic Link Preview fetching in this slice.
- Show Source inventory with stable controls: remove buttons for pending Sources, status for uploading/uploaded, and enough file/URL labels to review before submission.
- When files or URLs exist, force or strongly steer the active submission mode to Smart Storage. The Direct Post button should be hidden or disabled in that state.
- Proposal Source selection should use checkboxes or toggles in `SmartStorageProposalReviewPanel`, defaulting to all cited Sources selected unless the UI copy makes another default explicit.
- Pass `selectedSourceIds` to `acceptScaffoldProposal`.
- Keep layout dense and consistent with the current operational UI. Avoid a large redesign.
- Be careful with existing dirty files in the workspace; do not revert unrelated changes.

## Test Plan

Use TDD where practical.

Contribution Editor unit tests:

1. Add tests that `createContributionInput` includes external URLs, uploaded files, and Contribution Note.
2. Add rendering tests that Smart Storage mode shows Source controls and Source inventory.
3. Add tests that adding a URL/file makes Direct Post unavailable or routes submission through Smart Storage.
4. Preserve existing tests for comments, questions, guided group creation, and default mode resolution.

App integration tests:

1. Extend the Smart Storage integration mock to include multiple citations.
2. Test adding an external URL and Contribution Note, then Store Smartly sends them to `smartStorage:startFromContribution`.
3. Test uploaded file flow with mocked upload URL/storage ID and `smartStorage:createTemporaryUploadRecord`.
4. Test selecting only one citation before Accept Proposal and assert `smartStorage:acceptScaffoldProposal` receives `selectedSourceIds`.
5. Test Direct Post remains separate for text-only tagged contributions.

Backend tests:

- Existing `convex/smartStorage.test.ts` already covers the core backend. Add a focused test only if this slice adds an upload URL mutation or changes backend behavior.

## Verification Commands

- `cmd /c npx convex codegen`
- `cmd /c npx tsc -b --pretty false`
- `cmd /c npx vitest run src/ContributionEditor.test.tsx`
- `cmd /c npx vitest run src/App.integrated.test.tsx -t "stores dashboard Smart Storage contributions without direct posting"`
- `cmd /c npx vitest run convex/smartStorage.test.ts src/ContributionEditor.test.tsx`
- `cmd /c npm run build`

Known current caveat:

- Full `src/App.integrated.test.tsx` currently fails on an unrelated `KnowledgeRequestComposer` placeholder expectation. Do not broaden this slice merely to fix that unless the user asks.

Manual browser check if a signed-in local session is available:

- Open the dashboard Contribution Editor.
- Add title/body text, a Contribution Note, an external URL, and one uploaded file.
- Store Smartly.
- Confirm the proposal review shows Source citations.
- Deselect one Source citation, accept the proposal, and confirm the created entry reflects the selected representation set.
- Confirm a text-only Direct Post path still behaves as before.

## Risks / Open Questions

- Upload testing in React/server-rendered unit tests may need focused helper extraction because `File`, upload URL fetch, and Convex storage responses are browser/runtime concerns.
- Link Preview fetch is intentionally deferred; URL Sources may show "preview pending" or just the submitted URL.
- Proposal review can default all citations selected, but that default should be visible because acceptance writes Entry Representations.
- The durable spine implementation left `entryRepresentations.representationRole` optional in schema for migration safety, while new writes supply it. Do not try to narrow that field in this UI slice.
- `docs/handoffs/*` is ignored by `.gitignore`; force-add this handoff intentionally if it needs to be committed.

## Expected Final Response From Coding Agent

Summarize:

1. What Composer UI and proposal-review behavior changed.
2. How uploaded file and external URL Sources flow into Smart Storage.
3. How selected Source IDs are passed into proposal acceptance.
4. What tests/checks passed.
5. What remains for Link Preview fetching, cleanup jobs, extraction, and migration hardening.
