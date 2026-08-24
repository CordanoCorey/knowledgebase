# Missing Knowledge Journey Prototype

Question: What end-to-end interaction should let a User search existing Tags, add an unmatched named thing through Smart Storage identity confirmation, and—when the missing thing is an answer—enter or create a Question context and submit a Knowledge Slot that may be open or directed to recommended Context Experts, while making the underlying machinery feel simple?

Prototype location: `src/prototypes/MissingKnowledgeJourneyPrototype.tsx`

Run URL: `/?prototype=missing-knowledge-journey&variant=A`

Run command: `npm run dev`

This is a throwaway, read-only prototype. It uses in-memory state and no real Convex mutations.

## How to compare

1. Use **Prototype sample** to try both **Missing named thing** and **Missing answer**.
2. Search, choose the intended branch, and continue until the resulting Knowledge Page or Knowledge Slot is shown.
3. Switch variants with the floating arrows or the keyboard left/right arrows. Journey state stays in memory so the same decision can be compared across layouts.
4. On the missing-answer branch, compare an open request with a request directed to recommended Context Experts.

## Variants

- `A · Progressive result`: Keeps the handoff inline where an empty Root Search result appears. It emphasizes continuity and makes the intent fork the central decision.
- `B · Persistent journey`: Uses a stable left-side journey and right-side outcome preview. It emphasizes orientation and exposes exactly when durable objects come into existence.
- `C · Focused handoff`: Moves each decision into one focused dialog while the search surface recedes. It emphasizes simplicity at the cost of less surrounding context.

## Shared constraints

- Root Search only finds existing accessible Tags by name or alias. Searching never creates durable knowledge.
- An unmatched result requires an explicit choice between adding a named thing and requesting an answer.
- Named-thing creation performs a current identity check and confirms Knowledge Type before atomically creating its Knowledge Entry, same-typed Represented Referent, and canonical Tag.
- A missing answer becomes durable only when the User enters an existing Question context or confirms a new Question.
- One Knowledge Slot requests one Answer Knowledge Entry type in that Question context.
- The request is either open to the accessible audience or directed to selected recommended Context Experts.
- The prototype does not expose Role selection, a generic chat composer, or backend record terminology as primary controls.

## Verdict placeholder

- Preferred base:
- Pieces to borrow from other variants:
- Should the unmatched Root Search result show both intents immediately, or should wording infer and foreground one?
- Should a similar existing Question be a peer choice or a secondary escape hatch?
- Should expert direction happen during Knowledge Slot creation or after an open slot exists?
- Changes required before an implementation-ready specification:
