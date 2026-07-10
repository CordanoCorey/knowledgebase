# Smart Storage Wizard and Review Slots Handoff

## Context / Decisions That Must Hold

- `Smart Storage Session` is the user-facing lifecycle for one Smart Storage Contribution Submission. It spans Sources, Runs, Proposals, Review Slots, accepted Primary Intended Entry, and review status.
- Backend records may remain separate: `contributionSubmissions`, `sources`, `smartStorageRuns`, `smartStorageProposals`, `proposalSourceCitations`, `sourceOutputs`, and any review-slot projection records.
- Bronze Sources stay preserved even when proposal generation fails, returns no proposal, is cancelled, or is finished later.
- Silver Smart Storage Proposals remain the durable review objects. Review Slots are task projections of pending Silver work, not replacement Knowledge Slots and not draft Knowledge Entries.
- A Smart Storage Session is complete only after proposal generation is finished and every proposal is accepted, rejected, cancelled, superseded, stale, or otherwise closed.
- The Primary Intended Entry is the main success path. After it is accepted or connected to an existing Gold Entry, success copy should say `Entry Saved` or equivalent while remaining Silver work appears as Review Slots.
- Prerequisite Proposals may be accepted before the Primary Intended Entry when they create or confirm a required Referent, field, or relationship. Other secondary proposals should not become accept-ready until the primary entry has a Gold anchor.
- Smart Storage acceptance must perform the authoritative current Known Referent / represented-entry check. User-facing Smart Storage must not create bare Known Referents.
- Scaffold Proposals are deterministic, conservative, and explicit fallback choices. They must not pretend to have extracted structure the model did not produce.
- Smart Storage review remains one proposal at a time. Bulk accept is out for MVP.

## Proposed Implementation Slices

### 1. Session Read Model and State Derivation

Create a backend read model that assembles one Smart Storage Session from its Contribution Submission, Sources, Runs, Proposals, accepted primary entry, and derived status.

Acceptance criteria:

- Query returns one session summary by `contributionSubmissionId` with source counts, latest/active run state, proposal counts by status, primary proposal, prerequisite proposals, pending secondary proposals, and accepted primary entry when present.
- Derived session states include at least `preservingSources`, `preparingPrimaryProposal`, `primaryReady`, `awaitingPrerequisites`, `primarySaved`, `reviewPending`, `complete`, `cancelled`, and `sourcePreservationFailed`.
- Model `failed` and `noProposal` run outcomes keep the session reviewable and clearly distinct from total contribution failure.
- Session completion ignores no pending work only when all proposals and active runs are closed.
- Existing proposal acceptance and model-flow tests continue to pass.

Likely files/modules:

- `convex/schema.ts`
- `convex/smartStorage.ts`
- `convex/smartStorage.test.ts`
- `src/knowledgeContracts.ts`

### 2. Focused Wizard Shell and Auto-Open Flow

Add a focused Smart Storage wizard surface that opens after `Store` / Smart Storage submission and reads from the session summary rather than only local proposal state.

Acceptance criteria:

- After successful Smart Storage submit, the wizard opens in preparing or review state without requiring the user to find a toast or feed item.
- Preparing state confirms Sources were saved, summarizes source counts by kind, and shows proposal generation progress without raw prompt/model diagnostics for normal users.
- Failed/no-proposal states say Sources were saved and offer retry, `Create basic proposal`, `Finish later`, and any supported cancel action as distinct choices.
- `Create basic proposal` explicitly generates a Scaffold Proposal and does not silently run as fallback.
- Closing the wizard leaves Sources, Runs, Proposals, and Review Slots resumable.

Likely files/modules:

- `src/App.tsx`
- `src/App.integrated.test.tsx`
- `src/knowledgeContracts.ts`
- `convex/smartStorage.ts`
- `convex/smartStorage.test.ts`

### 3. Proposal Roles, Dependencies, and Acceptability Gates

Represent enough proposal role/dependency metadata to order required setup, primary acceptance, and later Review Slots.

Acceptance criteria:

- Smart Storage Proposals can be classified as primary, prerequisite, secondary, reference-resolution, refresh/reprocessing, or cleanup without changing them into Knowledge Slots.
- Prerequisite Proposals can declare which primary proposal requirement they unblock.
- Secondary proposals remain visible as Silver work but are not accept-ready until the Primary Intended Entry is accepted or connected, except required prerequisites.
- Wizard ordering is prerequisite setup, Primary Intended Entry, directly cited/referenced work, high-value extracted entries, optional enrichments, then ambiguous cleanup.
- Backend acceptance rejects attempts to accept secondary proposals before the required primary anchor exists.

Likely files/modules:

- `convex/schema.ts`
- `convex/smartStorage.ts`
- `convex/smartStorage.test.ts`
- `convex/lib/typeBehavior.ts`
- `src/knowledgeContracts.ts`

### 4. Review Slot Projection and To-Do Integration

Project pending Smart Storage Proposal work into Review Slots using Knowledge Slot-like card and to-do behavior while keeping Smart Storage Proposal as the source of truth.

Acceptance criteria:

- Each Review Slot references exactly one durable Smart Storage Proposal or equivalent Silver proposal record.
- Review Slot cards show task kind, proposed Knowledge Type, source/evidence summary, assignment/review scope, origin session, and current review status.
- Review Slots are grouped under the accepted or connected Primary Intended Entry once one exists.
- Review Slots stay out of the normal Answer Feed but appear in authorized pending-review or to-do surfaces.
- Closing the wizard with pending proposals leaves Review Slots visible for resumption.
- Cancelling a session closes or cancels pending Review Slots without deleting Bronze Sources or accepted Gold entries.

Likely files/modules:

- `convex/schema.ts`
- `convex/smartStorage.ts`
- Current or new Convex to-do / slot summary module
- Current or new Convex notification module if to-do counts are notification-backed
- `src/components/KnowledgeCards.tsx`
- `src/App.tsx`
- `src/App.integrated.test.tsx`

### 5. Reference Resolution and Known Referent Outcomes

Implement the Review Slot path for resolving referenced entities without creating bare Known Referents.

Acceptance criteria:

- Reference-resolution Review Slots support matching to an existing Known Referent, accepting a proposal that creates a Gold Entry and its Referent, rejecting, skipping, assigning, or refreshing.
- Matching a Known Referent updates dependent proposals or accepted entries to reference the canonical Tag when permissions and review state allow.
- The UI distinguishes existing referenced Referents from new Referents that require accepted Gold Entry creation.
- The backend refuses bare Referent/Tag creation from this user-facing flow.
- Acceptance still re-checks current identity and same-typed represented-entry uniqueness.

Likely files/modules:

- `convex/smartStorage.ts`
- `convex/schema.ts`
- `convex/smartStorage.test.ts`
- `convex/lib/typeBehavior.ts`
- `src/App.tsx`
- `src/App.integrated.test.tsx`
- `src/knowledgeContracts.ts`

### 6. Assignment, Delegated Review Permission, and Finish Later

Allow Review Slots to be assigned or sent while preserving Review Scope and Visibility Scope boundaries.

Acceptance criteria:

- Authorized users can assign or send a Review Slot to a user, group, organization, or other supported Delivery Target.
- Delegated review permission is limited to the specific proposal, source excerpts/representations needed for review, and allowed actions on that Review Slot.
- Delegation does not widen access to all Bronze Sources in the Contribution Submission, all proposals from the run, or the eventual Gold Entry beyond its Visibility Scope.
- `Finish later` exits the wizard without cancelling generation. Background generation may continue and create additional Review Slots.
- Whole-session cancellation remains limited to the submitting user, session owner, or authorized admin/reviewer for the Contribution Submission.

Likely files/modules:

- `convex/schema.ts`
- `convex/smartStorage.ts`
- Current or new Convex notification module
- Current or new Convex to-do / slot query module
- `src/App.tsx`
- `src/App.integrated.test.tsx`

### 7. Refresh / Reprocessing Review Slots

Reuse Review Slot grammar for stale proposals, refreshes, and Reprocessing output without adding a separate task category.

Acceptance criteria:

- Stale Smart Storage Proposals surface as Review Slots with an origin label such as `Refresh` when helpful.
- Reprocessing suggestions create Review Slots for suggested edits, Type Reclassification, new derived entries, and reference-resolution work.
- Refresh/Reprocessing Review Slots explain why the work appeared but do not silently rewrite Gold entries.
- Accepted Reprocessing edits preserve upgrade provenance without bloating hot Knowledge Entry records.
- Rejected or dismissed suggestions are remembered for the relevant proposal/candidate key, contract or Type Behavior version, and review scope.

Likely files/modules:

- `convex/schema.ts`
- `convex/smartStorage.ts`
- `convex/smartStorage.test.ts`
- Future reprocessing module if introduced
- `src/App.tsx`
- `src/App.integrated.test.tsx`

## Out Of Scope

- Prototype implementation or edits under `src/prototypes/*`.
- A new PRD or alternate domain model.
- Bulk acceptance of secondary proposals.
- Generic Referent merge/split review.
- Creating bare Known Referents from user-facing Smart Storage.
- Full advanced extraction for files, media, URLs, transcripts, or complex child-entry generation.
- Replacing Smart Storage Proposal persistence with Review Slot persistence.
- Raw model prompt/response diagnostics in normal user review surfaces.

## Verification Suggestions

- Backend: `cmd /c npx vitest run convex/smartStorage.test.ts --reporter=dot`
- Frontend integration: `cmd /c npx vitest run src/App.integrated.test.tsx --reporter=dot`
- Focused card/to-do tests if split out: `cmd /c npx vitest run src/components --reporter=dot`
- Codegen after schema/API changes: `cmd /c npx convex codegen`
- Typecheck/build: `cmd /c npx tsc -b --pretty false` and `cmd /c npm run build`
- Manual smoke: submit Smart Storage, watch wizard prepare, accept prerequisite if present, accept primary, finish later, confirm Review Slots remain resumable, then cancel a separate session and confirm Sources/accepted entries are not deleted.
