# Root Search and Navigator Query Done Checkpoint

This checkpoint records the current Root Search Input and Knowledge Navigator Query Input state before moving to another feature. It is a status document, not a new feature spec.

## Status

Root Search and Knowledge Navigator Query Input are complete enough for the current MVP checkpoint.

The implemented path now covers:

- internal Root Search terminology with user-facing `Search Everything` copy;
- Root Search scoped to the current User's Accessible Root Knowledge Context rather than to the Global Knowledge Context;
- query-only Root Search and Knowledge Navigator inputs that do not create Knowledge Entries, Knowledge Requests, Questions, Contributions, Sources, or Tags;
- Tag-only suggestions, including Question Tags;
- Root Search Tag suggestion selection that navigates to the Tag's Referent Page with exactly that Tag active;
- Knowledge Navigator Query Input suggestion selection that adds the Tag to the Active Knowledge Context and navigates to the canonical URL for the resulting Tag set;
- free-text Root Search submission to `/search?q=...`;
- free-text Knowledge Navigator Query Input submission as active-context search;
- analytics-only recording for string searches and Knowledge Navigator usage;
- page-oriented Root Search results with Referent Page targets and optional matched Knowledge Entry previews;
- fixture fallbacks for local/demo Tag suggestions when live Convex suggestion queries return no rows.

## Implemented Frontend Behavior

The header search is the Root Search Input. It is labeled `Search Everything`, uses the placeholder `Search everything you can access`, and keeps Root Search visually separate from active-context search.

Root Search typeahead suggestions are existing Tags. Selecting one opens the corresponding Referent Page, which synchronizes the URL and Knowledge Navigator to the selected one-Tag context. Pressing Enter without selecting a suggestion records a root-scoped search event and opens `/search?q=...`.

The `/search` route uses the same underlying root-context view as Dashboard, but renders in search-results mode without Dashboard call-to-action content. Results are page-oriented: each result opens a Referent Page, and matched Knowledge Entry previews still open the result's Referent Page rather than creating a separate Knowledge Entry route.

The Knowledge Navigator Query Input uses the placeholder `Search or add tag`. It suggests existing Tags for the active context, including Question Tags. Selecting a suggestion adds that Tag to the Active Knowledge Context and navigates to the canonical route for the resulting context. Pressing Enter without a selected suggestion records an active-context search event and filters the Answer Feed in place.

The current UI keeps live Convex suggestions preferred when they exist. When live suggestion queries return no rows, local fixture suggestions remain available so sparse development data does not make the typeahead appear broken.

## Implemented Backend Model

`convex/tagSuggestions.ts` exposes access-aware Tag suggestion queries:

- `listRootSearchTagSuggestions`
- `listKnowledgeNavigatorTagSuggestions`

`convex/rootSearch.ts` exposes page-oriented Root Search results:

- `listRootSearchResults`

`convex/analytics.ts` records search events separately from page visits and Knowledge Navigator usage:

- `recordSearchEvent`

Search events are analytics rows only. They are not Knowledge Entries, Knowledge Requests, Questions, Contributions, Sources, or Tags.

## Product Invariants

The checkpoint preserves these invariants:

- `Global Knowledge Context` is Scripture, not all accessible knowledge.
- `Accessible Root Knowledge Context` is the current User's permission-filtered root view.
- `Root Search` is internal terminology; the UI says `Search Everything`.
- Root Search and Knowledge Navigator Query Input are query-only.
- Suggestions are Tags only.
- Each Tag corresponds to one Referent Page.
- URL state and Knowledge Navigator state must stay synchronized.
- String searches, page visits, and Knowledge Navigator context changes are analytics, not knowledge.

## Verification

Passed during the checkpoint:

```text
npx.cmd convex codegen
# passed; generated TypeScript bindings and uploaded functions

npm.cmd test
# 32 files, 392 tests passed

npm.cmd run build
# passed
```

The build still emits the existing Vite chunk-size warning for the main application bundle.

`git diff --check` was also run globally. It reported trailing whitespace in unrelated `.codex-temp/*.log` files that predate this checkpoint work. `git diff --check -- . ':(exclude).codex-temp/*'` passed. No Root Search or Knowledge Navigator Query blocker remains at this checkpoint.

## Deferred Work

The following are intentionally not part of the checkpoint:

- replacing fixture fallback suggestions with complete shared-dev/prod seed data;
- ranking suggestions by the full intended model of user preferences, knowledge-context correlation, history, and broad popularity;
- richer Root Search result ranking and highlighting;
- deeper type-specific Root Search result rendering beyond the current Referent Page result card and matched preview;
- production migration or seeding runbooks for public Referents such as Books;
- removing historical handoff references to older `Global Search` language.

## Notes

The working tree remains broadly dirty from many active slices and unrelated work. This checkpoint does not claim the entire repo is clean; it records that the Root Search and Knowledge Navigator Query MVP checks above pass and that the feature has a clear follow-up boundary.
