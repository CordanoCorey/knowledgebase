# Smart Storage Wizard Prototype Notes

Question: Which wizard shape best lets the user accept the primary intended entry quickly while still surfacing required enrichments, prerequisite proposals, and later Review Slots without making Smart Storage feel like a second application?

Prototype location: `src/prototypes/SmartStorageWorkflowPrototype.tsx`

Run URL: `/?prototype=smart-storage-workflow&variant=A`

Variants:

- `A - Focused Dialog`: modal-style wizard with a step rail, prerequisite-first logic, primary entry lock, source counts, and finish-later Review Slots.
- `B - Session Map`: lane-based lifecycle view from Bronze Sources to prerequisite, primary, and Review Slots, plus refresh/scaffold/status affordances.
- `C - Evidence Split`: evidence-first review layout with source lines, primary proposal, required enrichments, and explicit accept/assign decisions.
- `D - Review Inbox`: to-do style Review Slots grouped under a saved primary entry, including assignment/delegated review.
- `E - Entry Continuation`: accepted primary sermon page with a compact Smart Storage continuation panel for returning to pending Review Slots.
- `F - Full-screen Focus`: synthesized direction from the preference interview. Full-screen dialog feel, compact top progress, subtle source counts, prerequisite-first review, locked compact primary summary, hidden evidence drawer, sticky footer actions, same-shell recovery state, and post-save entry continuation as a bottom drawer.

Preference interview synthesis:

- Keep `A - Focused Dialog` as the base, but make the dialog fill the available screen instead of feeling like a small modal.
- Replace the full left step rail with a compact top status row.
- Keep source-kind counts visible, but do not show the full Bronze Source inventory by default.
- Borrow `C`'s evidence clarity, but hide evidence behind a session-level evidence control until the user asks for it.
- Show the prerequisite proposal first, with the primary proposal visible only as a compact locked summary underneath.
- Keep proposal cards clean by default and move heavier details behind expansion.
- Mention remaining Review Slots quietly before primary acceptance.
- After the primary entry is saved, use `E`'s entry-continuation idea, but make the continuation a bottom drawer/bar so the saved entry stays dominant. On mobile, this should read as a compact sticky Review Slots bar.
- Keep assignment secondary rather than foregrounding the full `D` assignment panel.
- Keep recovery and no-proposal states inside the same full-screen wizard shell so users still see that Bronze Sources were saved.

Design constraints preserved from docs:

- Smart Storage submit remains icon-only in the composer.
- Bronze Sources save before model generation; model failure does not lose the contribution.
- The user sees subtle source counts and a single primary intended entry first.
- Full proposals are generated for discovered secondary items when the run completes.
- The primary intended entry is accepted before dependent optional entries, except Prerequisite Proposals required for primary validity.
- Required enrichments are foregrounded but do not create a second confirmation click for the primary proposal once prerequisites are resolved.
- Review Slots are the user-facing shape for pending Smart Storage work and can be assigned like Knowledge Slots.
- Known Referent matches do not create duplicate Knowledge Entries.
- Refresh appears only when the Smart Storage Contract changes.
- Scaffold proposals are explicit fallback proposals, not silent model substitutes.

Verdict placeholder:

- Winner:
- Useful pieces to steal: A's focus and prerequisite ordering; C's evidence presentation, hidden by default; E's post-save continuation; D's assignment grammar as a later/secondary action.
- Changes before production rewrite:
