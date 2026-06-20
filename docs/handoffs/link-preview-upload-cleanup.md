# Code Handoff: Link Preview and Upload Cleanup

## Coding Agent Prompt

You are implementing the next operational slice after the durable Smart Storage spine and Composer Multi-Source UI.

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
- `docs/handoffs/link-preview-upload-cleanup.md`
- `convex/schema.ts`
- `convex/smartStorage.ts`
- `convex/smartStorage.test.ts`
- `src/ContributionEditor.tsx`
- `src/App.tsx`
- `src/App.integrated.test.tsx`
- `src/index.css`

Do not re-litigate documented decisions unless code and docs directly contradict each other. Keep this slice focused on operational Link Preview fetching and temporary upload cleanup.

## What To Do

Implement backend-owned Link Preview fetching for external URL Sources and automatic cleanup for expired temporary uploads.

Target type: inferred vertical/supporting slice from the user's "slice 2" request.

## Why This Target

The Composer can now submit external URL Sources and uploaded file Sources, and the backend stores Link Preview placeholder fields plus `temporaryUploads.expiresAt`. What is missing is the operational work promised by the model: Link Preview should be fetched on the backend without blocking Source preservation, and abandoned temporary uploads should not leave unmanaged Convex storage objects behind.

## Source Artifacts

- Domain language: `CONTEXT.md`
- Product decisions: `docs/product-core.md`
- Previous handoffs: `docs/handoffs/durable-smart-storage-spine.md`, `docs/handoffs/composer-multi-source-ui.md`
- Relevant ADRs: `docs/adr/0006-store-smart-storage-proposals-as-durable-silver-records.md`, `docs/adr/0007-store-smart-storage-proposals-as-persistence-agnostic-domain-contracts.md`, `docs/adr/0008-use-contribution-submissions-as-smart-storage-parents.md`
- Current backend: `convex/smartStorage.ts`, `convex/smartStorage.test.ts`, `convex/schema.ts`
- Current UI: `src/ContributionEditor.tsx`, `src/App.tsx`, `src/App.integrated.test.tsx`
- PRD / plan: no separate PRD found; synthesized from the grill session and product docs.
- Issue docs: no issue found for this exact slice; inline issue brief below.
- Prototype: no prototype found; current multi-source composer and proposal review are the implementation reference.

## Inline Issue Brief

### What To Build

Operationalize external URL and temporary upload handling:

- When Smart Storage persists an external URL Source, schedule backend Link Preview fetching for that Source.
- Fetch Link Preview metadata in a Convex action, not in the browser.
- Store latest Link Preview snapshot fields on the `sources` row.
- Mark preview status as `fetched` or `failed` without blocking the Contribution Submission or Smart Storage Run.
- Validate and constrain preview fetches so arbitrary URLs cannot be used for unsafe internal network access.
- When temporary uploads are created, schedule cleanup at `expiresAt`.
- Delete expired, unattached temporary upload storage objects using `ctx.storage.delete`.
- Patch temporary upload rows to `deleted` after deletion, and leave `attached` uploads alone.
- Add a bounded manual/batch cleanup path for expired uploads so missed scheduled jobs can be recovered.

### Acceptance Criteria

- [ ] `startFromContribution` still preserves external URL Sources even if Link Preview fetching fails later.
- [ ] External URL Sources begin with `linkPreviewStatus: "queued"`.
- [ ] External URL Sources schedule a backend preview fetch after persistence.
- [ ] Preview fetching accepts only safe `http` or `https` URLs and rejects localhost/private/internal targets.
- [ ] Preview fetching caps work with a timeout and bounded response/field sizes.
- [ ] On successful HTML metadata fetch, the Source row stores `linkPreviewTitle`, `linkPreviewDescription`, `linkPreviewImageUrl`, `linkPreviewSiteName`, `linkPreviewFetchedAt`, and `linkPreviewStatus: "fetched"` when available.
- [ ] On failure, the Source row stores `linkPreviewStatus: "failed"`, `linkPreviewError`, and `linkPreviewFetchedAt`.
- [ ] Link Preview data is not treated as Factual Provenance, Source content, Human Weight Evidence, or a Knowledge Entry.
- [ ] `createTemporaryUploadRecord` schedules cleanup for the upload's `expiresAt`.
- [ ] Cleanup deletes storage only for temporary uploads whose status is still `uploaded` and whose `expiresAt` is in the past.
- [ ] Cleanup leaves `attached`, `deleted`, and not-yet-expired uploads alone.
- [ ] Cleanup patches successfully deleted rows to `uploadStatus: "deleted"` with `updatedAt`.
- [ ] Cleanup is bounded and can process additional batches through scheduling or repeated calls.
- [ ] Existing Smart Storage submission, proposal, and acceptance behavior still works.

### Out Of Scope

- Browser Link Preview fetching.
- Link Preview history or multiple preview attempts as separate rows.
- Full page text extraction, transcripts, media scraping, PDF parsing, or advanced extraction.
- Using fetched preview metadata as Factual Provenance.
- Cleaning up Bronze Sources, accepted Entry Representations, or attached uploads.
- Save drafts.
- Delivery channels.
- Update-existing-entry acceptance.
- Merge/split review.

## Domain Language

- `Link Preview`: fetched metadata that helps a user recognize an external URL in a Contribution Submission or Entry Representation. It is not a Knowledge Entry, Source, Factual Provenance, or Human Weight Evidence.
- `Source`: Bronze Layer raw material. An external URL Source preserves the submitted URL.
- `Temporary Upload`: a pre-submit Convex storage object that has not yet been attached to a durable Contribution Submission.
- `Contribution Submission`: the durable parent for multi-Source Smart Storage user intent.
- `Entry Representation`: accepted Gold Layer content or media form. Temporary uploads are not Entry Representations until accepted through proposal review.

## Decisions That Must Hold

- Link Preview fetching is backend-owned and non-blocking.
- External URL Sources always preserve the submitted URL.
- Link Preview failure must not block Source preservation, Smart Storage Run creation, or Proposal generation.
- Fetched page text, transcripts, or excerpts should be snapshotted only when used for Smart Storage enrichment or review. This slice does not do that.
- Uploaded files remain temporary until attached to a durable Contribution Submission.
- Abandoned temporary uploads should not leave unmanaged storage objects behind.
- Attached temporary uploads must not be deleted by cleanup.

## Relevant Code Map

- `convex/smartStorage.ts`: `startFromContribution` creates external URL Sources with `linkPreviewStatus: "queued"` and temporary upload records with `expiresAt`.
- `convex/smartStorage.ts`: `generateUploadUrl` returns Convex upload URLs.
- `convex/smartStorage.ts`: `createTemporaryUploadRecord` currently creates `temporaryUploads` rows.
- `convex/smartStorage.ts`: `attachTemporaryUploadIfPresent` marks temporary uploads `attached`.
- `convex/schema.ts`: `sources` has Link Preview latest snapshot fields.
- `convex/schema.ts`: `temporaryUploads` has `uploadStatus`, `expiresAt`, and `attachedContributionSubmissionId`.
- `src/ContributionEditor.tsx`: displays external URL and uploaded file Source inventory.
- `src/App.tsx`: uploads browser files and calls `createTemporaryUploadRecord`.
- `convex/_generated/ai/guidelines.md`: actions cannot use `ctx.db`; use actions for fetch and mutations for database/storage writes.

## Implementation Guidance

- Keep public API small. Prefer internal functions for scheduled background work.
- Suggested functions in `convex/smartStorage.ts` or a focused module such as `convex/smartStorageOperations.ts`:
  - `internalAction fetchLinkPreviewForSource`
  - `internalMutation markLinkPreviewFetched`
  - `internalMutation markLinkPreviewFailed`
  - `internalMutation cleanupTemporaryUpload`
  - `internalMutation cleanupExpiredTemporaryUploadsBatch`
- If you create a new Convex module, run `npx convex codegen` and update imports from `_generated/api`.
- From `startFromContribution`, schedule preview fetches with `ctx.scheduler.runAfter(0, internal.<module>.fetchLinkPreviewForSource, { sourceId })` after external URL Sources are inserted.
- From `createTemporaryUploadRecord`, schedule cleanup with `ctx.scheduler.runAt(expiresAt, internal.<module>.cleanupTemporaryUpload, { temporaryUploadId })` or equivalent.
- Actions may use `fetch`, but not `ctx.db`. Fetch in the action, parse a bounded metadata object, then call an internal mutation to patch the Source.
- Mutations may use `ctx.storage.delete(storageId)` for cleanup.
- Keep cleanup bounded. Use the `by_uploadStatus_and_expiresAt` index, `.take(batchSize)`, and reschedule if the batch is full.
- Do not use unbounded `.collect()` in cleanup.
- URL safety should be conservative:
  - allow only `http:` and `https:`;
  - reject `localhost`, loopback, private IP ranges, link-local ranges, and obvious metadata IPs such as `169.254.169.254`;
  - reject empty or malformed hosts;
  - normalize and store bounded errors without leaking excessive response details.
- Preview parser should be deliberately small:
  - prefer `<meta property="og:title">`, `<meta name="twitter:title">`, then `<title>`;
  - prefer Open Graph/Twitter description, image, and site name when present;
  - resolve relative image URLs against the fetched URL if practical;
  - bound all stored strings using existing limit helpers or new constants.
- If content is not HTML, mark preview failed or fetched with only the submitted URL, but do not treat the response body as Source content.

## Test Plan

Use TDD where practical.

Convex tests:

1. Add focused tests in `convex/smartStorage.test.ts` or a new operational test file.
2. Test that external URL Source creation schedules/permits preview fetch and keeps the Source preserved.
3. Test preview success by invoking the mutation/parser seam with representative HTML and asserting Source preview fields are patched.
4. Test preview failure patches `failed`, `linkPreviewError`, and `linkPreviewFetchedAt`.
5. Test unsafe URLs are rejected/failed without fetching.
6. Test `createTemporaryUploadRecord` creates an upload with an expiration and cleanup can delete it after expiration.
7. Test cleanup skips attached uploads.
8. Test batch cleanup processes bounded rows and can be safely called again.
9. Preserve existing Smart Storage tests for multi-source submission and acceptance.

Pure unit tests:

- If HTML parsing or URL safety helpers are exported locally, add focused tests for them. This is preferable to mocking global `fetch` deeply if Convex action testing becomes awkward.

Frontend tests:

- Only update UI tests if you surface preview status changes in the composer. Do not add UI churn just to prove backend operations.

## Verification Commands

- `cmd /c npx convex codegen`
- `cmd /c npx tsc -b --pretty false`
- `cmd /c npx vitest run convex/smartStorage.test.ts`
- `cmd /c npx vitest run src/ContributionEditor.test.tsx`
- `cmd /c npx vitest run src/App.integrated.test.tsx -t "stores dashboard Smart Storage contributions without direct posting"`
- `cmd /c npm run build`

Known current caveat:

- Full `src/App.integrated.test.tsx` has recently had an unrelated `KnowledgeRequestComposer` placeholder mismatch. If it is still present, report it but do not broaden this slice unless the user asks.

Manual check if a signed-in local session is available:

- Submit an external URL through Store Smartly and confirm the Source persists immediately.
- Confirm preview metadata appears later if the UI exposes it, or verify via Convex dashboard/query if not.
- Upload a file and abandon it; force or create an expired test upload and confirm cleanup deletes only unattached storage.

## Risks / Open Questions

- Fetching arbitrary URLs has SSRF risk. Keep URL safety conservative in this slice.
- Convex action tests may require a helper seam because actions use `fetch` and cannot access `ctx.db`.
- `ctx.storage.delete` should only run for temporary, unattached uploads. Do not delete attached Sources or accepted Entry Representations.
- Link Preview is not extraction. Do not store fetched page text as raw Source content in this slice.
- Scheduling behavior may be easier to assert through explicit internal function tests than through scheduler internals.
- `docs/handoffs/*` is ignored by `.gitignore`; force-add this handoff intentionally if it needs to be committed.

## Expected Final Response From Coding Agent

Summarize:

1. What Link Preview operational behavior changed.
2. What temporary upload cleanup behavior changed.
3. How URL safety and non-blocking failure are handled.
4. What tests/checks passed.
5. What remains for Link Preview history, advanced extraction, cleanup observability, and migration hardening.
