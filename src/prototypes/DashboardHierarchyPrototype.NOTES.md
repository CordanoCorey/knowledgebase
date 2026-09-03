# Dashboard hierarchy prototype

Prototype for GitHub issue #25. This is a throwaway comparison, not production UI.

Run:

```text
npm run dev
http://localhost:5173/?prototype=dashboard-hierarchy&variant=A
```

Use the floating arrows or the keyboard left/right arrows to compare:

- **A — Guided priority stack:** one explicit vertical sequence: Notification preview, familiar places, Contribution Editor, then Answer Feed with Trending.
- **B — Two-lane daily desk:** a stable `Today` lane holds attention and familiar places beside a larger contribution and exploration surface.
- **C — Quiet continuous workspace:** attention and familiar places become compact strips above an editorial, continuous contribution and Answer Feed surface.

Held constant across all variants:

- The selected compact rail and contextual drawer frame from issue #26.
- Dashboard is the User-scoped Accessible Root Knowledge Context.
- Notifications preview activity and attention history; To-do remains available only through the avatar drawer.
- Pins, frequent places, and recent places form one return area; Trending stays separate.
- Root Search remains in the shared header and Contribution Editor stays compact.
- Answer Feed items demonstrate subscribed, recommended, and popular sources without deciding the downstream ranking contract from issue #30.
- No production persistence or mutations are wired.

Review question: which hierarchy makes the priority order legible without turning the Dashboard into a collection of unrelated widgets? A decision may combine a clear structural winner with one small element from another variant.

Decision: pending human review.
