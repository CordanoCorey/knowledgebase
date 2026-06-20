# Code Handoff: Durable Smart Storage Spine

## Coding Agent Prompt

You are implementing one vertical slice of the upgraded Knowledge Composer that has already been clarified through a grilling session.

Before editing code, read:

- `AGENTS.md`
- `convex/_generated/ai/guidelines.md`
- `CONTEXT.md`
- `docs/product-core.md`
- `docs/adr/0004-knowledge-entries-uniquely-represent-same-typed-referents.md`
- `docs/adr/0006-store-smart-storage-proposals-as-durable-silver-records.md`
- `docs/adr/0007-store-smart-storage-proposals-as-persistence-agnostic-domain-contracts.md`
- `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- `docs/handoffs/durable-smart-storage-spine.md`
- `convex/schema.ts`
- `convex/smartStorage.ts`
- `convex/smartStorage.test.ts`
- `src/ContributionEditor.tsx`
- `src/ContributionEditor.test.tsx`
- `src/knowledgeContracts.ts`
- `src/App.tsx`
- `src/App.integrated.test.tsx`

Do not re-litigate documented domain decisions unless code and docs directly contradict each other. Keep this slice focused on the durable Smart Storage spine. Do not build advanced extraction, real LLM contract generation, update-existing-entry acceptance, delivery channels, merge/split review, save drafts, or rich multi-proposal child-entry generation.

## What To Do

Implement the durable Smart Storage spine for the Knowledge Composer:

Create and persist a durable Contribution Submission with multiple Bronze Sources, queue a Smart Storage Run, create a conservative scaffold Smart Storage Proposal, show and review that proposal, and accept it into one new Gold Layer Knowledge Entry with selected Entry Representations and Source/output links.

Target type: vertical slice.

## Why This Target

The current Smart Storage path preserves one standalone Source and one Run, then creates a deterministic draft Proposal. The clarified product model says Smart Storage needs a durable parent Contribution Submission that preserves one user intent, Primary Intended Entry metadata, Review Scope, intended Visibility Scope, Contribution Note, multiple Sources, Runs, Proposals, citation child rows, and later one-at-a-time acceptance.

This slice upgrades the existing Bronze/Silver path without trying to solve extraction intelligence or all future review workflows at once.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- ADRs: `docs/adr/0004-knowledge-entries-uniquely-represent-same-typed-referents.md`, `docs/adr/0006-store-smart-storage-proposals-as-durable-silver-records.md`, `docs/adr/0007-store-smart-storage-proposals-as-persistence-agnostic-domain-contracts.md`, `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- Current Smart Storage backend: `convex/smartStorage.ts`, `convex/smartStorage.test.ts`
- Current schema: `convex/schema.ts`
- Contribution UI/contracts: `src/ContributionEditor.tsx`, `src/ContributionEditor.test.tsx`, `src/knowledgeContracts.ts`
- App integration surface: `src/App.tsx`, `src/App.integrated.test.tsx`
- Issue docs: no issue found for this exact slice; inline issue brief below.
- Prototype: no separate prototype found; current Contribution Editor and Smart Storage review panel are the implementation reference.

## Inline Issue Brief

### What To Build

Upgrade Smart Storage from a standalone Source/Run path into a durable Contribution Submission path:

- Persist a `contributionSubmissions` parent row for Smart Storage.
- Persist multiple child `sources` rows linked to the submission.
- Support Authored Text Source, uploaded file storage IDs, and external URL Sources.
- Track temporary browser-to-Convex uploads before they attach to a submission.
- Store Link Preview latest snapshot fields on external URL Source rows.
- Link Smart Storage Runs and Proposals to the Contribution Submission.
- Store Proposal Source citations as child rows.
- Add required `representationRole` on `entryRepresentations`.
- Add a small TypeScript Type Behavior interface/registry.
- Generate a conservative scaffold Proposal.
- Accept one scaffold Proposal into one new Gold Knowledge Entry.
- Explicitly stop with a target-exists review state instead of updating an existing entry.

### Acceptance Criteria

- [ ] A signed-in allowed user can submit through Smart Storage and create one `contributionSubmissions` row.
- [ ] The submission stores `submittedByUserId`, `submissionStatus`, Primary Intended Entry metadata, Contribution Note, intended Visibility Scope, Review Scope, and timestamps.
- [ ] The first Smart Storage path defaults Review Scope to the submitting user unless an Organization or Group review context is explicit.
- [ ] The submission creates child Source rows for authored text, uploaded file storage IDs, and external URLs.
- [ ] New Smart Storage mutation paths always provide `sources.contributionSubmissionId`, even if the schema field remains optional for migration compatibility.
- [ ] Browser-to-Convex uploaded files are tracked in `temporaryUploads` before attachment and marked `attached` when used in a submission.
- [ ] External URL Sources preserve the submitted URL even when Link Preview fails.
- [ ] Link Preview failure does not block Contribution Submission persistence or Smart Storage queueing.
- [ ] A Smart Storage Run links to `contributionSubmissionId` and may link to a `primarySourceId`.
- [ ] A Smart Storage Proposal links to both `contributionSubmissionId` and `smartStorageRunId`, and backend code enforces that they match.
- [ ] Proposal Source citations are stored as child rows, not as an unbounded proposal array.
- [ ] Scaffold Proposals can be reviewed in the existing Smart Storage review UI or a small extension of it.
- [ ] Accepting a scaffold Proposal creates one new Gold Knowledge Entry, selected Entry Representations, and Source/output links atomically.
- [ ] Accepted Entry Representations include required `representationRole`, using `unspecified` when the role is unknown.
- [ ] If acceptance discovers that the proposed represented Referent already has a Knowledge Entry, it stops with a reviewable target-exists state instead of patching the existing entry.
- [ ] Direct post remains distinct from Smart Storage and does not create Bronze/Silver workflow state by default.
- [ ] Existing Smart Storage tests are updated rather than bypassed.

### Out Of Scope

- Advanced extraction.
- Real LLM contract generation.
- Update-existing-entry acceptance.
- Delivery channels.
- Merge/split review.
- Save drafts or autosave.
- Rich multi-proposal child-entry generation.
- Full Course generation or complex child-entry workflows.
- Dataset-wide Reprocessing.
- Bulk proposal acceptance.

## Deferred Terms

- `advanced extraction`: parsing uploaded files, remote pages, media, transcripts, or rich documents into structured text, ranges, fields, or derived child knowledge. This slice may preserve files and URLs, but it should not pretend to understand content it has not extracted.
- `real LLM contract generation`: sending versioned Smart Storage Contracts and Type Behavior snapshots to an LLM to produce true model-generated Proposals. This slice can keep the deterministic scaffold generator.
- `update-existing-entry acceptance`: accepting a Proposal as a patch to an already existing Gold Knowledge Entry. This is deferred because it needs edit permissions, conflict handling, and audit behavior.
- `delivery channels`: notifying, assigning, messaging, emailing, SMS-ing, or DM-ing recipients about a contribution. Visibility Scope and Review Scope are not delivery.
- `merge/split review`: permissioned identity correction when Referents or Knowledge Entries need to be combined, separated, aliased, or reclassified. This is separate from ordinary proposal acceptance.
- `save drafts`: preserving incomplete composer sessions before explicit submission. This slice begins durable state at explicit Smart Storage submission, while temporary uploads are tracked only to avoid abandoned storage.
- `rich multi-proposal child-entry generation`: generating many related Gold entries from one submission, such as a Course with Lessons or a transcript with many Quotes. This slice accepts one proposed Knowledge Entry at a time and may create only a conservative scaffold Proposal.

## Domain Language

- `Contribution Submission`: a single user intent to Contribute, collecting material and choices submitted from a composer before it is posted directly or processed through Smart Storage.
- `Primary Intended Entry`: the one Knowledge Entry a Contribution Submission is primarily meant to create or update.
- `Source`: Bronze Layer raw material, not a Knowledge Type and not a Knowledge Entry.
- `Authored Text Source`: user-authored or pasted substantive text submitted as raw material in a Contribution Submission.
- `Contribution Note`: non-substantive guidance that steers a Contribution Submission without becoming represented knowledge by default.
- `Review Scope`: who may see or manage Bronze Sources, Smart Storage Runs, Smart Storage Proposals, and other pending review material before Gold Layer knowledge exists.
- `Visibility Scope`: who may access the accepted Gold Layer Knowledge Entry afterward.
- `Entry Representation`: a content or media form through which a Knowledge Entry is expressed.
- `Primary Representation`: the selected default Entry Representation for display/open/preview/playback.
- `Representation Role`: how an Entry Representation functions for the entry, such as manuscript, slides, transcript, recording, thumbnail, primary content, or supporting material.
- `Type Behavior`: a per-Knowledge-Type implementation rule set for identity, scope, composer defaults, Smart Storage challenge behavior, representation roles, primary representation defaults, Human Weight, and provenance.

Avoid using `Source` to mean Knowledge Entry, Entry Representation, or file type.

## Decisions That Must Hold

- Durable Contribution Submissions are the parent grouping model for first-slice Smart Storage.
- Simple text-only direct posts may still skip durable Contribution Submission workflow state.
- Smart Storage should not run automatically for every Contribution.
- Attachments and external URLs in the first composer slice route through the durable Bronze path rather than simple direct posting.
- Review Scope and Visibility Scope are separate. Matching enum values do not make them interchangeable.
- Tags do not grant access, and Delivery cannot silently widen Visibility.
- Bronze Sources and Silver Smart Storage Proposals stay out of the normal Answer Feed.
- Link Preview is not a Knowledge Entry, Factual Provenance, Human Weight Evidence, or Source.
- Source citations for Proposals are child rows.
- Accepted proposals decide explicitly which Sources become Entry Representations.
- Bronze Sources remain usable for later extraction or Reprocessing after acceptance.
- Smart Storage Proposal acceptance creates new entries only in this slice.
- `Representation Role` is required on Gold Entry Representations, using `unspecified` when unknown.
- `Representation Role` does not replace explicit Primary Representation selection.
- Type Behavior is a small TypeScript interface/registry now, not a broad inheritance framework.

## Schema Guidance

Add or update validators in `convex/schema.ts` following the generated Convex guidelines.

### New `contributionSubmissions`

Minimum fields:

- `submittedByUserId`
- `submissionStatus`
- `primaryIntendedKnowledgeType`
- `primaryIntendedTitle`
- `primaryIntendedBodyPreview`
- `contributionNote`
- `intendedVisibilityKind`
- `intendedVisibilityTargetKey`
- `reviewScopeKind`
- `reviewScopeTargetKey`
- `createdAt`
- `updatedAt`

Initial `submissionStatus` enum:

- `submitted`
- `processing`
- `reviewReady`
- `partiallyAccepted`
- `accepted`
- `rejected`
- `cancelled`

Index suggestions:

- `by_submittedByUserId_and_createdAt`
- `by_submissionStatus_and_createdAt`
- `by_reviewScopeKind_and_reviewScopeTargetKey_and_createdAt`

### Review Scope

Use a separate enum, initially:

- `private`
- `organization`
- `group`
- `public`

Use `reviewScopeTargetKey` string storage in the first implementation, with backend validation that the key format matches `reviewScopeKind`.

### Update `sources`

Add:

- `contributionSubmissionId`: optional in schema for migration compatibility, required in new Smart Storage mutation paths.
- Link Preview latest snapshot fields for external URL Sources:
  - `linkPreviewStatus`
  - `linkPreviewTitle`
  - `linkPreviewDescription`
  - `linkPreviewImageUrl`
  - `linkPreviewSiteName`
  - `linkPreviewFetchedAt`
  - `linkPreviewError`

External URL Sources must always preserve `externalUrl`.

Index suggestions:

- `by_contributionSubmissionId_and_submittedAt`
- keep existing source indexes if still useful.

### New `temporaryUploads`

Fields:

- `storageId`
- `uploadedByUserId`
- `fileName`
- `contentType`
- `fileSizeBytes`
- `uploadStatus`
- `expiresAt`
- `attachedContributionSubmissionId`
- `createdAt`
- `updatedAt`

Initial `uploadStatus` enum:

- `uploaded`
- `attached`
- `expired`
- `deleted`

Index suggestions:

- `by_uploadedByUserId_and_createdAt`
- `by_uploadStatus_and_expiresAt`
- `by_storageId`

### Update `smartStorageRuns`

Add:

- `contributionSubmissionId`
- optional `primarySourceId`

The existing `sourceId` may remain during migration if needed, but the new workflow should treat the run as belonging to the Contribution Submission. If both old and new source fields exist temporarily, keep their meaning explicit.

Index suggestions:

- `by_contributionSubmissionId_and_createdAt`
- keep `by_status_and_createdAt`.

### Update `smartStorageProposals`

Add:

- `contributionSubmissionId`

Backend code must enforce that the Proposal and Run point to the same Contribution Submission.

Index suggestions:

- `by_contributionSubmissionId_and_status_and_createdAt`
- keep `by_smartStorageRunId`.

### New `proposalSourceCitations`

Fields:

- `proposalId`
- `sourceId`
- `citationKind`
- `excerptText`
- `locator`
- `externalUrl`
- `rationale`
- `createdAt`

Initial `citationKind` enum:

- `wholeSource`
- `textExcerpt`
- `fileLocator`
- `externalUrl`

Keep `excerptText` bounded and optional.

Index suggestions:

- `by_proposalId`
- `by_sourceId`

### Update `entryRepresentations`

Add required:

- `representationRole`

Initial enum:

- `unspecified`
- `primaryContent`
- `manuscript`
- `slides`
- `transcript`
- `recording`
- `thumbnail`
- `supportingMaterial`

Type Behavior determines which roles are allowed or default per Knowledge Type. Use `unspecified` when unknown.

## Type Behavior Guidance

Create a small TypeScript interface and registry, likely outside React-specific code. The first interface should expose:

- `knowledgeType`
- `version`
- `identity`
- `referentIdentityScope`
- `composerDefaults`
- `smartStorageChallenge`
- `representationRoles`
- `primaryRepresentation`
- `humanWeight`
- `provenance`

Use plain config objects or small functions. Shared resolver services should perform actual Tag, Referent, alias, and represented-entry lookup rather than duplicating database querying per Knowledge Type.

## Backend Guidance

The existing `convex/smartStorage.ts` has the right broad shape but currently starts from one standalone Source. Evolve it into the new parent path carefully.

Suggested public mutations/actions, names may vary if local patterns suggest better:

- `createTemporaryUploadRecord`
- `startFromContributionSubmission`
- `generateScaffoldProposalForRun`
- `acceptScaffoldProposal`

Implementation notes:

- Use `requireAppAccess(ctx)` and derive `userId` server-side.
- Keep validators on every Convex function.
- Do not pass file bytes through contribution mutations; use storage IDs and metadata.
- Create the Contribution Submission and all child Sources in one mutation where feasible.
- Mark temporary uploads `attached` when their storage IDs become Source rows.
- Queue or create the first Smart Storage Run automatically only for the Smart Storage path.
- Generate a deterministic scaffold Proposal before real LLM contract generation exists.
- Use child `proposalSourceCitations` rows for evidence/source references.
- Preserve original vs current proposal shape.
- Accept only one Proposal into one new Gold Entry.
- Acceptance should create Knowledge Entry, represented Tag relation, context Tag relations, selected Entry Representations, and `sourceOutputs` atomically.
- If the represented Referent already has a Knowledge Entry, return or set a reviewable target-exists state rather than updating the existing entry.
- Keep direct post separate.

## Frontend Guidance

Current relevant seams:

- `src/App.tsx:3167`: `startSmartStorage` mutation hook.
- `src/App.tsx:3168`: `generateSmartStorageProposal` mutation hook.
- `src/App.tsx:3243`: `handleStoreSmartlyContribution`.
- `src/App.tsx:3370`: `ContributionEditor` receives `onStoreSmartly`.
- `src/App.tsx:3497`: `SmartStorageProposalReviewPanel`.
- `src/ContributionEditor.tsx`: builds `ContributionInput` and preserves direct vs Smart Storage mode.
- `src/knowledgeContracts.ts:139`: current `ContributionInput` shape.

Frontend implementation can be incremental:

- Extend contribution contracts to carry authored text, file storage metadata, external URLs, and Contribution Note if not already present.
- Keep text-only direct post behavior separate.
- When uploaded files or external URLs are present, route the composer through Smart Storage/Bronze path.
- Show Link Preview status for external URL Sources only if it can be done without turning this into a large UI redesign.
- Reuse or minimally extend the existing Smart Storage proposal review panel for scaffold Proposals.
- Proposal review must let the user confirm which Sources become Entry Representations and which representation is primary when more than one representation exists.
- If the UI cannot fully support source-to-representation selection yet, keep the first review state narrow and explicit rather than silently accepting every Source as a representation.

## Relevant Code Map

- `convex/schema.ts:553`: current `sources` table.
- `convex/schema.ts:570`: current `sourceOutputs` table.
- `convex/schema.ts:579`: current `smartStorageRuns` table.
- `convex/schema.ts:605`: current `smartStorageProposals` table.
- `convex/schema.ts:650`: current `entryRepresentations` table.
- `convex/smartStorage.ts:128`: current `startFromContribution` standalone Source path.
- `convex/smartStorage.ts:187`: current `generateDraftProposalForRun`.
- `convex/smartStorage.ts:311`: deterministic draft Proposal builder.
- `convex/smartStorage.test.ts:15`: existing Bronze Source and Run test.
- `convex/smartStorage.test.ts:118`: existing draft Proposal generation test.
- `src/App.tsx:3243`: current Smart Storage submit flow.
- `src/App.tsx:3497`: current Smart Storage proposal review panel.
- `src/ContributionEditor.tsx:140`: current contribution input creation.
- `src/ContributionEditor.test.tsx`: current mode and payload tests.
- `src/knowledgeContracts.ts:139`: current contribution input contract.

## Test Plan

Use TDD where practical.

Convex tests:

1. Update or add tests around `convex/smartStorage.test.ts`.
2. Assert Smart Storage submission creates a Contribution Submission parent.
3. Assert multiple Sources can attach to one Contribution Submission.
4. Assert new Smart Storage Sources carry `contributionSubmissionId`.
5. Assert temporary uploads are marked attached when used.
6. Assert external URL Link Preview failure does not block preserving the URL Source.
7. Assert Runs and Proposals link to the same `contributionSubmissionId`.
8. Assert Proposal Source citations are child rows.
9. Assert `representationRole` is required on accepted Entry Representations.
10. Assert acceptance creates one new Knowledge Entry, Entry Representations, and Source/output links.
11. Assert acceptance refuses target-existing cases rather than updating existing entries.
12. Assert unauthorized users cannot create submissions, runs, proposals, or acceptance writes.

Frontend tests:

1. Extend `src/ContributionEditor.test.tsx` for any new contribution payload fields.
2. Extend `src/App.integrated.test.tsx` mocks for the new Smart Storage mutation return shapes.
3. Assert Store Smartly calls the durable Contribution Submission path.
4. Assert the proposal review panel can render a scaffold Proposal with source inventory/citations.
5. Assert direct post mode remains distinct.

## Verification Commands

- `npx convex codegen`
- `npx vitest run convex/smartStorage.test.ts`
- `npx vitest run src/ContributionEditor.test.tsx`
- `npx vitest run src/App.integrated.test.tsx`
- `npx vitest run convex/smartStorage.test.ts src/ContributionEditor.test.tsx src/App.integrated.test.tsx`
- `npx tsc -b --pretty false`
- `npm run build`

Manual browser check if a signed-in local session is available:

- Start Vite on an open port.
- Submit text through Store Smartly.
- Submit a file through Store Smartly if the UI supports file selection in this slice.
- Submit an external URL through Store Smartly if the UI supports URL entry in this slice.
- Confirm a scaffold Proposal appears and can be accepted into a new entry.
- Confirm Direct Post still bypasses Bronze/Silver workflow state.

If the browser only reaches the unauthenticated sign-in screen, say so and rely on automated tests for signed-in behavior.

## Risks / Open Questions

- Existing historical Source rows do not have `contributionSubmissionId`; keep the field optional in schema for migration compatibility while requiring it in new Smart Storage paths.
- Existing tests may assume one Source per Run; update them to the parent submission model rather than preserving the old assumption.
- The UI may not yet have file/URL controls in the Contribution Editor. If building those controls makes the slice too large, implement backend support plus the narrowest usable UI for one file and one URL.
- Link Preview fetching may require a Convex action; keep it non-blocking.
- This slice intentionally creates conservative scaffold Proposals rather than true extraction output.
- `docs/handoffs/*` is ignored by `.gitignore`; force-add this handoff intentionally if it needs to be committed.

## Expected Final Response From Coding Agent

Summarize:

1. What schema and backend Smart Storage behavior changed.
2. What UI or contract changes were made.
3. How the implementation preserves Contribution Submission, Source, Run, Proposal, citation, and Entry Representation invariants.
4. What tests/checks passed.
5. What remains for extraction, LLM contract generation, update-existing acceptance, delivery, merge/split, drafts, and rich multi-proposal generation.
