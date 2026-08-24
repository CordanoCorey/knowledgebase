# Missing Knowledge Journey Prototype

Question: What end-to-end interaction should let a User search existing Tags, add an unmatched named thing through Smart Storage, and—when Smart Storage identifies the missing thing as a Question—request a future Answer without making Root Search into a second creation workflow?

Prototype location: `src/prototypes/MissingKnowledgeJourneyPrototype.tsx`

Run URL: `/?prototype=missing-knowledge-journey&variant=C`

Run command: `npm run dev`

This is a throwaway, read-only prototype. It uses in-memory state and no real Convex mutations.

## Human verdict

`C · Smart Storage handoff` is the selected direction, with the original custom four-step handoff removed.

The rejected prototypes asked the User to decide whether an unmatched search meant “add a named thing” or “request an answer,” then introduced a separate identity or Question workflow. That duplicates Smart Storage’s responsibility and makes Root Search behave like a creation wizard.

## Resolved workflow

1. Root Search finds accessible existing Tags by canonical name or alias.
2. When there is no match, the empty result has one creation action: **Save with Smart Storage**.
3. Smart Storage receives the search text and uses its normal contract, classification, evidence, identity-match, and proposal-review workflow. Root Search does not ask the User to pick a Knowledge Type first.
4. For a query such as `J.R.R. Tolkien`, Smart Storage may propose a Person. The User accepts or cancels that normal Smart Storage proposal.
5. Accepting a genuinely new Person proposal atomically creates the Person Knowledge Entry, its same-typed Represented Referent, and its canonical Tag. If any part fails, none of them remain saved.
6. A current identity check still runs at acceptance. If the Referent has become known, acceptance redirects or stops rather than creating a duplicate.
7. If Smart Storage proposes and the User accepts a Question, the result is the normal Question Knowledge Page. Creating an open or expert-directed Knowledge Slot is a separate action from that page, not another Root Search branch and not an extra Smart Storage proposal.

## Variant record

- `A · Progressive result`: rejected because its unmatched result exposes a separate intent fork and custom identity workflow.
- `B · Persistent journey`: rejected because it turns the handoff into a multi-step creation journey alongside Smart Storage.
- `C · Smart Storage handoff`: selected and refined. Root Search shows empty results and one Save action; the normal Smart Storage review owns classification and identity confirmation.

## Implementation constraints captured by the prototype

- Searching never creates durable knowledge.
- Root Search does not create a bare Known Referent and does not ask the User to classify the query.
- The search text enters the existing Smart Storage workflow rather than a new search-specific wizard.
- Smart Storage acceptance creates the Knowledge Entry, Represented Referent, and canonical Tag in one transaction.
- A Knowledge Entry and its Represented Referent have the same Knowledge Type.
- A Question is one Knowledge Type. A Knowledge Slot remains a singular workflow request created from the Question context.
- The prototype does not expose a Role selector, a generic chat composer, or backend record terminology as primary controls.
