# Contribution Editor Cleanup Checkpoint

Date: 2026-06-21

This checkpoint audits the accumulated Contribution Editor cleanup slices before moving to another feature. It treats the current dirty working tree as the implementation baseline and ignores unrelated `.codex-temp` logs and screenshots.

## Done

- Collapsed editor state remains the protected compact input-first surface in code and CSS; the formatting toolbar and metadata are hidden until expansion.
- Expanded editor is slimmer: the body is first, metadata is compact, Knowledge Type precedes Title, and large preview/source inventory panels are gone.
- The separate external URL input is removed. URLs typed into the editor body are detected from body text and staged as compact URL chips with draft-time Link Preview enrichment.
- Files can be dropped onto the editor body or added through the compact attachment control.
- The visible Contribution Note input is removed. Smart Storage instructions now tell the model to interpret guidance-like text inside Authored Text Sources without synthesizing stored Contribution Notes.
- Allowed Contribution Types are wired through editor placement, including slot/guided contexts.
- Knowledge Type resolution follows the accepted priority: slot requested type, explicit user selection, question-mark inference where allowed outside Comment defaults, then Words or Comment fallback.
- Title visibility comes from Type Behavior. Comment is titleless; Words is titleless by default, and an explicit Words title forces Smart Storage when the title control is shown.
- Smart Storage is automatic for non-Words/non-Comment types and explicit Words titles. Words and Comment can still choose direct posting or Smart Storage, including with staged URL/file attachments now that direct representations exist.
- Direct posts create Gold Knowledge Entries and Entry Representations for plain text, external URLs, and stored files without creating Bronze Sources, Contribution Submissions, Smart Storage Runs, or Smart Storage Proposals.
- Smart Storage submissions preserve Authored Text, external URLs, and uploaded files as Bronze Sources under a durable Contribution Submission and queue Smart Storage.
- Rich-text composer body and durable Composer Draft persistence are in place for pre-submit body text, rich-text document JSON, title, selected Knowledge Type, and placement key.
- Composer Draft saves are separate from submissions and do not create Knowledge Entries, Contribution Submissions, Sources, Runs, or Proposals. Successful direct/Smart Storage submissions clear drafts; failed submissions preserve them.

## Docs Aligned

- `CONTEXT.md` now defines `Composer Draft` as pre-submit composer state, not a Knowledge Entry, Source, Contribution Submission, Run, or Proposal.
- `docs/product-core.md` now acknowledges the later Composer Draft slice and direct attachment representation support after the first Smart Storage spine slice.
- `docs/mvp-frontend-core-loop.md` was locally aligned with the current type/title/defaulting rules for question inference, Words titles, and Smart Storage/direct choice with attachments, but that file is ignored in this checkout and will not appear in normal Git status.

## Verified

- `npx.cmd convex codegen`: failed with `TypeError: fetch failed` / `AggregateError [EACCES]` because this worker has restricted network access. Generated API typing already includes `contributionDrafts`, and the full test/build checks below pass against the current generated files.
- `npm.cmd test -- --run`: passed, 33 files and 421 tests.
- `npm.cmd run build`: passed, with the existing Vite large-chunk warning.
- `git diff --check`: passed; output only reported Windows LF-to-CRLF working-copy warnings.

## Browser QA

Not completed in this worker. The in-app Browser tools were not exposed, Playwright/Puppeteer are not installed, and no Chrome/Edge executable was found on PATH or in the usual Windows install paths. A final visual smoke pass should still be run in a browser-capable thread before merge/release.

Recommended browser smoke pass:

- Desktop and mobile collapsed Contribution Editor: compact shape unchanged, no toolbar/metadata visible.
- Expanded plain Words/Comment editor: rich-text toolbar fits, metadata stays compact, no overlap/clipping.
- URL typed into body: compact URL chip/preview appears and disappears when the URL is removed.
- File drop/add control: compact upload state appears without a large empty Source Inventory.
- Slot/guided type placement: fixed Knowledge Type chip or constrained selector appears correctly.
- Successful submit clears the Composer Draft; failed submit leaves it available.

## Known Follow-Ups

- Rerun `npx.cmd convex codegen` in an environment with Convex/network access if generated files need to be refreshed from the live deployment.
- Persist submitted rich-text formatting as a durable `prosemirror` Entry Representation. The current submit contract preserves derived plain text.
- Decide whether direct external URL Entry Representations should persist Link Preview metadata, or whether preview metadata remains draft/source-review UI only for now.
- Add durable uploaded-file draft persistence and abandoned-upload cleanup if users should recover staged uploads after reload.
- Run the browser smoke pass listed above with Browser tooling available.
