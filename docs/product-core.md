# Product Core

This product is a knowledgebase for Christian users and organizations that treats named things in the real world as first-class references for storing, finding, and doing work. It can be understood as a smart Google Drive or virtual file system: Tags behave like folders, Knowledge Entries behave like files, and an entry can appear in many folders because it can reference many Referents.

The application is not only a repository. It is intended to become the place where people ask for knowledge, contribute future answers, and do day-to-day work from the same context where prior answers are found.

## Product Commitments

The application is built for Christians who affirm the inerrancy of Scripture. The Global Knowledge Context is available to every user and organization by default, and in this application it contains Scripture because Scripture is the infallible Recognized Context all users and organizations must acknowledge.

The application should promote human thought over automated output while still using AI for useful recognition, extraction, structuring, and retrieval. AI helps store and surface knowledge; it does not replace human judgment.

Weight-bearing Knowledge Entries are rated by Human Weight on a Slop to Soul scale from 0 to 100. Human Weight is interpreted through the entry's Knowledge Type, and each weight-bearing Type Behavior should define the credited human role: a Quote should credit the human substance of the person to whom the quote is attributed, while a Words entry should credit the user or person who authored those words. Some workflow types, such as RSVP, may have no Human Weight because they do not meaningfully express human ingenuity. Bible passages have full Soul because they are inspired by the Holy Spirit, and that visible Soul rating should be attributed to God alone rather than to a human contributor, translator, seeder, or AI process.

The MVP weight-bearing Knowledge Types are Words, Question, Quote, Sermon, Essay, Poem, Song, Book, Short Story, Lesson, Comment, Prayer Request, Series, and Event. The MVP non-weight-bearing Knowledge Types are RSVP, Person, Organization, Group, Place, and Topic. Bible Passage is a special case: it has full Soul as Scripture, but it is not an authorable Knowledge Entry type in the MVP.

Low Human Weight means low human substance, but whether that is bad depends on the Human Weight Expectation for the Knowledge Type and workflow. Type Behavior should provide the default Human Weight Expectation, while workflows such as Knowledge Slots may override that expectation when they request a specific kind of human work. For example, a low-Human Weight student Essay is a concern because the workflow expects the student's authored human substance and may indicate AI-written work, while a useful AI-assisted summary may be low Human Weight without being harmful.

Human Weight Expectation has four levels: none, informative, expected, and required. None means Human Weight does not apply. Informative means Human Weight is useful context, but low weight is not a problem by itself. Expected means human substance is normally expected and low weight should be surfaced as a possible concern. Required means human substance is required by the workflow and low weight should trigger review or warning. For example, RSVP is none, a generic AI-assisted summary may be informative, an ordinary Essay may be expected, and a student-submitted Essay for a Knowledge Slot may be required.

Words should default to an expected Human Weight Expectation because Words will likely be the most common Knowledge Entry type, and Feed Priority needs to distinguish substantial human knowledge from thin or low-substance text. This expected default is about surfacing quality and human substance for prioritization; it should not be treated as a plagiarism detector, truth score, or automatic accusation.

A Human Weight Concern is a review signal, not an automatic failure or accusation. For example, a low-Human Weight student Essay should indicate that responsible users need to review whether the work contains the expected student authorship, not that the student necessarily cheated.

The initial Human Weight bands are Slop at 0-19, Assisted at 20-39, Shaped at 40-59, Substantial at 60-79, Weighty at 80-94, and Soul at 95-100. These bands are interpretive anchors for the product and implementation; they may be refined as the product learns how users recognize human substance.

Human Weight is a recalculable current estimate, not immutable entry metadata. The product should preserve Human Weight Evidence and enough evaluation context to revise scores when the Human Weight definition improves. User feedback, ratings, recognition, or other gamified signals may contribute evidence, but they should support the rating rather than directly determine it or replace the Type Behavior's credited human role.

Evidence Maturity should be tracked separately from Human Weight. Human Weight answers how much human substance the entry carries; Evidence Maturity answers how settled that rating is. A promising new entry may have high estimated Human Weight with low Evidence Maturity, while a long-used reviewed entry may have the same Human Weight with high Evidence Maturity.

Human Weight Feedback should begin with a small set of evidence-oriented responses, such as recognize, used, not human, and wrong context. Recognize and used may also be derived from other product activity when the application has enough data to infer them responsibly, rather than requiring explicit feedback every time.

Answer Feed ranking should use Feed Priority: a derived ordering value that prioritizes Human Weight while also giving low-Evidence Maturity weight-bearing entries enough exposure to gather Human Weight Evidence from users. Human Weight calculation may happen asynchronously, such as through scheduled recalculation, when evidence changes or the scoring definition is refined.

Context Expertise should be derived from durable Context Expertise Evidence rather than from a raw contribution count or live feed scan alone. The evidence records should preserve the meaningful contribution acts, while bounded aggregate rows should support fast ranking by User or Person, Knowledge Context, audience scope, score, maturity, counts, and top supporting visible entries.

Negative feedback or correction should first revise the specific Context Expertise Evidence it concerns. A single bad placement, weak contribution, or wrong-context feedback item should reduce the value of that evidence before it broadly penalizes the contributor; repeated weak evidence in the same Knowledge Context may lower the contributor's Context Expertise and increase confidence that the lower estimate is reliable.

Context Expertise should be explainable and correctable through its underlying evidence rather than through direct score disputes. Users should correct wrong context, attribution, feedback, or visibility on the relevant Knowledge Entry or evidence record, and the derived expertise estimate should update from those corrections.

Context Expertise should not decay merely because time passes. Evergreen evidence remains valid unless corrected, rejected, or superseded, while recent contribution acts may act as a surfacing boost or tie-breaker. Type Behavior or workflow-specific rules may later define freshness expectations for knowledge that ages quickly.

Audience-scoped Context Expertise rankings may use restricted evidence when the viewer's Expert Orbit makes the contributor eligible to be surfaced, but explanation surfaces must only reveal supporting entries the viewer can access. Global expert rankings should use public or globally visible evidence rather than private organization-only evidence.

For multi-Source Contribution Submissions, Human Weight belongs to each accepted Gold Layer Knowledge Entry rather than to the Contribution Submission or Bronze Sources themselves. Sources, Entry Representations, provenance, authorship, review, and usage may supply Human Weight Evidence for the resulting entries.

## Core Model

A Knowledge Entry is a typed, contextualized unit of knowledge. It represents one Referent of the same Knowledge Type and references other Referents through its Tags. Those Tags constitute the entry's Knowledge Context.

The canonical Tag for a Knowledge Entry's Represented Referent should be included among the entry's Tags. This lets one Tag relationship model both the entry's own navigable identity and the other Referents it references in its Knowledge Context.

A Tag is a named, typed pointer to a Referent and to the intended set of knowledge about that Referent. A Referent is identified by name plus Knowledge Type, so similarly named things remain distinct, such as `Charlotte's Web, book` and `Charlotte's Web, essay`.

Referents, Tags, and Knowledge Entries should remain distinct. A Referent is the stable identity of the thing being pointed at, a Tag is the navigable handle that points to that Referent, and a Knowledge Entry is content or work that represents one same-typed Referent and references other Referents through Tags. A Referent may exist without any Knowledge Entry representing it, and a Referent may have at most one Knowledge Entry that represents it.

A Known Referent is a Referent and canonical Tag already recognized by the application, whether seeded by system data, created by account or domain workflows, or created through an accepted Knowledge Entry. Known Referents are referenceable without requiring a Knowledge Entry to represent them; seeded Books, People created through user/account flows, and Bible Passages are examples of Referents the app may know before or apart from user-created entries.

Creating a Knowledge Entry should create a new Represented Referent and canonical Tag when the app does not already know that Referent. If the same-typed Referent is already a Known Referent, the app should not create a new Knowledge Entry merely to represent it. Instead, it should guide the user toward confirming and tagging that Known Referent, editing or updating an existing represented entry when one exists and the user has permission, or creating a distinct new Referent only when the user confirms the intended identity is different.

User-facing Smart Storage and contribution flows should not create bare Known Referents without Knowledge Entries. New Referents discovered through user action become known by accepting a Gold Layer Knowledge Entry that represents them. Bare Known Referents are reserved for system, admin, import, account, domain-infrastructure, or Scripture-specific flows that intentionally seed referenceable identity apart from community-contributed Knowledge Entries.

Most edits offered from a Referent's Knowledge Page should edit the represented Knowledge Entry, its Entry Representations, Tags, aliases, provenance, or type-specific fields rather than the bare Referent identity. Editing Referent identity should be a special permissioned operation for identity correction, aliasing, merge/split, or Type Reclassification because it affects every Tag and entry that points to that Referent.

The identity fields that determine whether a Referent already exists are Knowledge Type-specific. Many types may use type plus title or name, while others may require additional identity fields such as author, preacher, date, location, or source. Composer and Smart Storage duplicate checks should use the relevant Type Behavior identity rules and tell the User when the intended Referent already exists.

Direct Words entries should use generated, entry-specific Referent identity rather than deduplicating by title or body text. Words is the fallback Knowledge Type for saved textual knowledge, so two Users may save the same title or similar wording without claiming the same Referent. When a User explicitly titles a Words contribution, or when Smart Storage recognizes a more specific Knowledge Type, that title or recognition should be treated as classification and identity evidence rather than as stronger Words-level deduplication.

A minimum valid Words entry should require only the shared Knowledge Entry shape: title, preview/search text, Represented Referent, primary Tag, Visibility Scope, Discoverability Scope, and either body-derived text or at least one substantive Entry Representation. Words should not have a type-specific detail table, required Person role, or required Source citation by default; contributor metadata, Entry Representations, Factual Provenance, and Human Weight Evidence should carry those meanings when they apply.

Words entries should be exportable by default. A Words export should include the primary textual representation when accessible, basic entry metadata such as title, Knowledge Context Tags, created and updated timestamps, visible contributor information, Human Weight summary, and attached Entry Representations the exporting User is allowed to access. Export should obey Visibility Scope and should not expose hidden Bronze Layer Sources, Silver Layer Smart Storage Proposals, or review-only material.

Words Referent Pages should not have special page-specific modules in the MVP beyond the shared Knowledge Page Shell and normal entry presentation. They should show the primary representation or body, entry metadata, Human Weight summary, context Tags, attached Entry Representations, and the Answer Feed. When the primary textual representation is long, the page may show a bounded preview with an affordance to expand and read the full text, but this should remain normal representation display rather than a bespoke Words module.

Words should not define type-specific Roles in the MVP. Contributor or creator belongs to shared entry metadata, and meanings such as author, speaker, teacher, quoted person, or respondent should either belong to a more specific Knowledge Type, be expressed through context Tags, or wait for a concrete role relationship need.

Words should remain the safe direct-entry default for authored or pasted text. Smart Storage should be optional for Words by default, but especially encouraged when the User adds an explicit title, uploads files, attaches external URLs, or provides enough text for the application to classify the contribution more specifically. When Smart Storage recognizes a more specific Knowledge Type with reasonable confidence, it should propose Type Reclassification or a more specific Gold Layer entry before acceptance; when it cannot, it should preserve the contribution as Words without inventing structure.

Referent Identity Scope should also be governed by Type Behavior. Some Knowledge Types or specific entries represent globally public things that should participate in global duplicate matching, while others represent organization-, group-, or user-scoped things whose identity should remain local unless intentionally published or shared more broadly. Context-dependent types such as Essay or Lesson should use source provenance, author, publication status, current organization context, Visibility Scope, and explicit user choice to decide whether the intended Referent is public or scoped.

Widening a Knowledge Entry's Visibility Scope should not automatically widen its Referent Identity Scope. If a scoped Referent later appears to become a public Referent or match an existing public Referent, the app should route that through identity review, such as merge, alias, split, or Type Reclassification, rather than silently changing identity scope.

Composer and Smart Storage should infer Referent Identity Scope from Type Behavior and context when the answer is clear, such as public Books or scoped Prayer Requests. The User should be asked only for context-dependent Knowledge Types or ambiguous evidence where identity scope changes duplicate matching, visibility expectations, or future reuse.

Composer Smart Storage may flag possible duplicate Referents or identity ambiguity, but Referent merge and split should belong to a separate permissioned review workflow rather than being performed automatically from contribution acceptance.

Tags should be canonical per Referent, not duplicated per user or organization. User and organization relationships to a Tag should be represented through Recognized Context, subscriptions, aliases, visibility, or other local relationships rather than by creating separate Tags for the same Referent.

The first schema pass should include Tag Recognition so users and organizations can record that a canonical Tag is meaningful to them without creating local duplicate Tags.

Active Knowledge Context is the Knowledge Context in effect for the user's current Knowledge Page. Recognized Context is historical: the union of Knowledge Contexts where the user or organization has taken meaningful action, recorded through canonical Tags without making those Tags active for every request.

Plain Knowledge Page visits should not add to Recognized Context by default. Page visits are analytics and may serve as weak recommendation evidence, while Recognized Context should come from intentional actions such as bookmarking, pinning, subscribing, contributing, commenting, asking from a Knowledge Context, fulfilling a Knowledge Slot, editing Tags, sharing, or assigning work.

Bookmarked Knowledge Pages should not appear directly in the primary sidebar by default. They belong in user/account navigation, such as the user's Profile or a user dropdown from the profile control, while the sidebar remains focused on Pinned Knowledge Pages and primary navigation.

Bookmarks should be available as a section or tab on the User's profile, with the sidebar avatar menu offering a shortcut to that profile section. Bookmarks do not need a separate User View unless the saved set becomes large or workflow-heavy enough to require one.

Knowledge Pages and User Views should remain distinct in navigation. Knowledge Pages are grounded in a shared Knowledge Context, Referent, Knowledge Entry, Organization, or other world-facing knowledge object. User Views are assembled around the current User's activity, responsibilities, preferences, or account state, such as Calendar, Notifications, Settings, or editing the user's profile. A public profile is a Knowledge Page for a Person or User presentation; editing one's own profile is a User View.

Knowledge Pages should share a Knowledge Page Shell with compact page-specific identity. The top of each Knowledge Page should identify the page and expose essential page actions without turning Organization, Profile, Referent, Event, or other page-specific details into a large bespoke hero. The compact identity band may include a tiny Active Knowledge Context summary such as `Global Knowledge Context`, a single Tag label, or a Tag count, but the full interactive Active Tag set should remain in the left rail. Page-Specific Module links or controls may appear in or directly below the compact identity band as low-profile actions. Page-Specific Modules such as an Event guest list or Organization overview should appear as contained expandable sections, dialogs, or Page-Specific Subroutes such as Organization settings.

Organization Knowledge Pages should remain knowledge-first at the top level. When the current User has a Role that allows operational action for the Organization, the Organization Knowledge Page may expose links to Page-Specific Subroutes with a more operations-dashboard feel, while keeping the main Organization Knowledge Page in the shared Knowledge Page Shell.

Organization Knowledge Pages should remain primarily Organization-scoped Knowledge Pages rather than operations dashboards. When a User has a Role that permits school, church, family, or community administration or workflow action, the Organization Knowledge Page may expose role-gated Page-Specific Subroute links for operational work. Those subroutes may use more dashboard-like layouts, but the default Organization Knowledge Page should keep the shared Knowledge Page Shell and active Organization Tag as the main experience.

The shared Knowledge Page Shell should avoid redundant generic headings when the page structure already makes the region clear. The Knowledge Navigator does not need its own header in the standard shell, Dashboard does not need a repeated `School Day` or `Today at Arche Classical Academy` heading above the working layout, and the Answer Feed does not need a separate `Answers` heading when it is already the primary feed region. Suggested Entry or Requested Entry placeholder panels should not appear below the Knowledge Navigator by default when there are no real requested entries.

The left rail of the standard Knowledge Page Shell should stay focused on active Tags and a compact Knowledge Navigator Query Input for the current context. Active Tags should remain visible, while suggested or available Tags should stay compact, secondary, and capped so they support the Knowledge Navigator without becoming a large browse panel. The rail should not have a separate `Add Tags` control; the Knowledge Navigator Query Input should use typeahead suggestions for existing Tags that can be added to the Active Knowledge Context. Existing Tags of any Knowledge Type, including Question Tags, are eligible suggestions because every Knowledge Type has a Tag, but this input must not create new Tags or Questions. Selecting a suggested Tag should add that Tag to the context. Pressing Enter without selecting a suggested Tag should run a text search for matching Knowledge Entries within the current Knowledge Context rather than changing the Active Knowledge Context. Context search should filter the existing Answer Feed in place rather than navigating to a separate results page, and matching feed cards should still open their unique Referent Pages when selected. The Knowledge Navigator Query Input should not create Knowledge Entries, Knowledge Requests, Questions, Contributions, or Sources. Knowledge Slot or Requested Entry content belongs in the Answer Feed rather than in a separate rail panel because the Answer Feed is a mixed surface made of Knowledge Entries plus Knowledge Slots. Selecting a Knowledge Slot may put the Contribution Editor into a Knowledge Slot Fulfillment mode for that slot, but the slot itself should remain represented as a feed item.

Knowledge Slot cards in the Answer Feed should use the same overall card grammar as Knowledge Entry cards so they feel peer-level in the feed. Their distinctive feature should be a very clear missing-content area that names what must be filled in, who or what it is for, and the action to contribute the missing Knowledge Entry.

Contribution Editor placement may supply Allowed Contribution Types when only a subset of authorable Knowledge Types should be created from that surface. Slot fulfillment is stricter: a Knowledge Slot requests one Knowledge Entry of one Knowledge Type, so fulfilling a slot narrows the Contribution Editor to that slot's requested Knowledge Type.

Contribution Editor Knowledge Type determination should prioritize workflow constraints before inference. If the editor is fulfilling a Knowledge Slot, the slot's requested Knowledge Type wins. If the User explicitly selects a Knowledge Type, that selection wins within the editor's Allowed Contribution Types. Otherwise, the default is Words outside an entry response and Comment when responding to an existing Knowledge Entry. A trailing question mark should infer Question only in non-comment defaults and only when Question is one of the Allowed Contribution Types; a response to an existing Knowledge Entry remains Comment unless the User explicitly selects Question. Question inference may update the visible type chip or selector while the User types, but once the User explicitly selects a type, the editor should stop auto-changing the type for that draft.

Knowledge Type filtering belongs with the Answer Feed controls rather than the Knowledge Navigator. Filtering the feed to Songs, Lessons, Sermons, Questions, Requests, or another Knowledge Type narrows which matching feed items are shown; it does not change the Active Knowledge Context. The Knowledge Navigator should remain responsible for active Tags and Questions that define context, while the Answer Feed may provide compact filters such as `All`, `Entries`, `Requests`, and Knowledge Type chips.

The Answer Feed should default to a masonry-style card grid on desktop and collapse to a single stacked column on narrow screens. The feed should avoid a large standalone heading when it is already the primary work region, but it may show a compact control row for counts, Knowledge Type filters, feed kind filters, and sorting.

The Contribution Editor should remain above the Answer Feed in the standard Knowledge Page Shell. It should be compact by default and expand on focus or when the User chooses a Knowledge Slot to fulfill. The collapsed editor should keep the current streamlined input-first design and should not show a bulky metadata strip such as Direct Post, Knowledge Type, or Knowledge Context before the User expands or reviews the contribution. The collapsed editor may still run hidden type inference and URL detection while the User types, but its visual state should not change. When expanded, the main contribution input should remain first, followed by compact contribution metadata. Knowledge Type should precede Title when both are visible. A Knowledge Type selector should appear only when the User has more than one Allowed Contribution Type or needs to override an inferred type; single-type placements and slot fulfillment should show a compact fixed type chip instead. Title should appear only for Knowledge Types whose Type Behavior uses a Title or title-like field as part of their input shape. Comment should remain titleless. Words should be titleless by default; if the User explicitly adds a Title to a Words contribution, that Title should be treated as identity/classification evidence and should force Smart Storage. Direct Words submissions without an explicit Title should receive a quiet system-generated title from the body preview so database and card identity remain usable without making the User name fallback Words up front. The expanded editor should be slim in UI/UX by deriving, detecting, or progressively disclosing as much as practical, not by removing agreed-upon contribution functionality.

External URLs typed or pasted into the Contribution Editor body should be detected automatically and staged as external URL attachments with Link Previews, without requiring a separate URL input. The User's body text should be preserved as written, including the URL text; automatic URL staging must not rewrite or remove the URL from the body. Auto-staged external URL attachments are derived from the current body text and should disappear when the URL is removed from that text. The UI should stage one external URL attachment per unique normalized URL in the current body, even if the same URL appears more than once. The UI should show a compact URL chip or pending preview immediately when a URL is detected, then enrich it into a small Link Preview when backend metadata arrives; preview fetching should not block submission.

Files dropped into the Contribution Editor body should be uploaded immediately to temporary storage and staged as uploaded file attachments without requiring a separate visible upload area. The editor should also provide a compact attachment icon/button for users who cannot or do not discover drag-and-drop. The UI should show compact upload status near the editor body and submit only storage IDs plus metadata with the contribution. When the User chooses direct `Post` or `Comment`, staged URL and file attachments should become Entry Representations on the created Knowledge Entry. When the User chooses `Store`, the same staged attachments should be preserved as Bronze Sources through Smart Storage.

Smart Storage should be automatic when the inferred or selected Knowledge Type is anything other than Words or Comment. For plain Words or Comment, including when URL or file attachments are staged, the User may choose whether to use Smart Storage, but that choice should remain a compact control rather than a large mode panel.

When Smart Storage is forced by Knowledge Type or explicit Words Title, the expanded editor should show Smart Storage as a quiet status chip rather than a full mode selector. When Words or Comment can still be posted directly or stored smartly, the editor should show a compact user choice control.

Contribution Editor action copy should stay short in the slim UI: direct Words uses `Post`, direct Comment uses `Comment`, and Smart Storage uses `Store`. `Smart Storage` may appear as the forced-mode status chip or compact option label.

For the slim Smart Storage action, an icon-only Smart Storage button may submit immediately when the editor has enough valid input. It should have an accessible label and tooltip, but it should not open a pre-submit mode panel. Missing required input should expand the editor or show inline validation; substantive Smart Storage review begins after Bronze Sources are preserved and Silver proposals are available.

After a successful Smart Storage submit, the Smart Storage wizard should open automatically in a preparing or review state. The user intentionally chose Smart Storage, so the app should foreground the resulting review flow rather than only showing a toast. If the user closes the wizard, the Smart Storage Session remains safely resumable through Review Slots, the primary entry page, or pending-review surfaces.

The slim Contribution Editor should not show a dedicated Contribution Note input. Text typed into the editor should be submitted as Authored Text Source. Smart Storage may distinguish substantive contribution material from guidance-like text during proposal generation and review, but the editor should not require the User to classify that text up front. That distinction should be represented as model interpretation or review explanation, not as a separate stored Contribution Note copied from the UI unless the User explicitly provided one in another workflow.

The expanded Contribution Editor should not show a large always-visible Source Inventory panel or empty `No Sources staged` state. Detected external URL attachments and dropped uploaded file attachments should appear only when present as compact inline chips or previews near the editor body, with status and remove affordances.

The expanded Contribution Editor may show the Knowledge Context as compact Tags or a small fixed line when helpful, but it should not show a large repeated preview panel for Knowledge Type, Knowledge Context, and Smart Storage mode. Metadata should stay chip-level or line-level unless the User is in a later review step.

Bible Passage Referent Pages are the exception to the compact-only identity rule because Scripture text is the substance of the page. They should keep the Scripture Text section prominent, but should not show a generic Bible Passage Overview module by default.

The primary sidebar should carry destination navigation: Dashboard as the first root-level Knowledge Page, Pinned Knowledge Pages in the middle, and User Views or account navigation at the bottom. The sidebar avatar should be the account-menu entry point for the User's profile, Bookmarks, Settings, and Sign out. The header should stay focused on the user's Active Role and the Root Search Input, though user-facing copy may label it as Search Everything. The current Knowledge Page or Active Knowledge Context should be presented below the header in the page content area rather than inside the header, so users do not mistake Root Search for context-scoped search. Account controls should live in one place, not duplicated in both sidebar and header.

Root Search should search the current User's Accessible Root Knowledge Context, independent of the current Active Knowledge Context. It should not mean public-only search or search limited to the Global Knowledge Context. Search results should make scope legible with labels such as Global, an Organization name, or Personal when needed.

Submitting free text from Root Search should navigate to `/search?q=...` and render the same underlying root-context view as the Dashboard in search results mode, without Dashboard call-to-action content. Selecting a suggested Tag from Root Search should navigate directly to that Tag's Referent Page with exactly that one Tag active in the Knowledge Navigator, replacing any previously active Tags. Root Search may suggest existing Tags whose Referent Pages the User can visit, including globally recognizable public Referents such as books, but the Referent Page and search results must still filter Knowledge Entries by the User's access. Suggesting or opening a Tag must not reveal private organization knowledge connected to that Tag. Free-text Root Search results should be page-oriented: they return Referent Pages, optionally with matched Knowledge Entry previews when a represented entry exists. Clicking a matched Knowledge Entry preview should still open that Knowledge Entry's unique Referent Page rather than a separate Knowledge Entry page. Root Search suggestions should rank globally recognizable and user-relevant Tags across the Accessible Root Knowledge Context. Root Search user-facing placeholder copy should fit on one line at the supported header widths.

String searches should be recorded in analytics only, separate from page visits and Knowledge Navigator usage. Root Search submissions should record a root-scoped search event, while Knowledge Navigator Query Input submissions should record an active-context search event with the active Tags at the time of search. Search events should never create Knowledge Entries, Knowledge Requests, Questions, Contributions, or Sources. Selecting a Tag suggestion in the Knowledge Navigator Query Input should record Knowledge Navigator usage as `select` with the new Active Knowledge Context; selecting a Tag suggestion from Root Search should navigate to the Tag's Referent Page and rely on the resulting page visit plus any appropriate navigator synchronization analytics rather than recording a string search.

Knowledge Pages may also provide context-scoped Search or Explore controls, but those controls should live below the header near the page title or Active Knowledge Context. Context-scoped controls should be visually distinct from header Root Search so users can tell which scope they are using.

When a User selects a Root Search result, the app should navigate to that result's Knowledge Page and synchronize the Knowledge Navigator's active Tags to that page's Active Knowledge Context. For example, opening `Arche Classical Academy` from Root Search lands on Arche's Knowledge Page with Arche's Tag as the single active Tag.

The Knowledge Navigator should be visible on every Knowledge Page because it is the canonical control for the Active Knowledge Context. Its presentation may vary: compact on simple Knowledge Pages and expanded on Dashboard or exploration-heavy pages. Knowledge Navigator Query Input suggestions should rank Tags correlated with the current Active Knowledge Context first, then user preferences or history, then broad popularity. The first implementation may use a simple deterministic ranking while preserving that ordering intention. Knowledge Navigator Query Input user-facing placeholder copy should fit on one line at the supported rail and mobile widths.

The URL and Knowledge Navigator must stay in sync as two expressions of the same Active Knowledge Context. Selecting a Tag in the Knowledge Navigator Query Input should immediately navigate to the canonical URL for the resulting Tag set: Dashboard/root for zero Tags, the Referent Page for one Tag, and the Context Page for two or more Tags. Changing active Tags through the Knowledge Navigator should record Knowledge Navigator usage for the user action, while the resulting navigation should separately record a page visit for the canonical page reached.

The Knowledge Navigator should not be shown as the main navigator on User Views such as Calendar or Notifications. User Views may show context chips or links inside their items, but those should navigate to the relevant Knowledge Pages rather than making the User View itself context-scoped.

Dashboard should be a fixed first sidebar route for the Accessible Root Knowledge Context, not a user-removable Pinned Knowledge Page.

Explore should not be a separate primary sidebar icon for now. Explore is an action available from Dashboard and other Knowledge Pages, while Dashboard is the fixed global Knowledge Page.

Pinned Knowledge Pages should not rely on icon-only recognition. The sidebar may have a compact or collapsed state, but Pinned Knowledge Pages need a visible label affordance beyond hover tooltips because user-pinned pages and default Organization pages are not universally recognizable from icons alone.

On desktop, the sidebar should prefer visible labels for Pinned Knowledge Pages. On smaller screens or constrained layouts, the sidebar may collapse into a compact rail or drawer. When there are more Pinned Knowledge Pages than the available sidebar space can show, overflow should collapse into a concise control such as `+3 more` rather than crowding or shrinking every item.

Default Pinned Knowledge Pages for Organizations should use the specific Organization name as the primary label, such as `Arche Classical Academy`, rather than only generic labels like `My School`. The Organization kind, such as School, Church, Family, or Community, may appear through an icon, secondary label, or grouping.

Default Pinned Knowledge Page seeding should be capped so initial navigation stays calm. When a User has multiple Organizations of the same kind, the app should seed at most the most relevant one per kind and make the others available through pin management or recommendations rather than pinning every affiliation automatically.

The Active Role display in the header should also be the Role switcher. The default state should have Active Role unset, meaning no single Role is foregrounded even though the User may still be eligible to act through all their Roles; switching Active Role should change acting capacity, permissions, prompts, and defaults without navigating the User away from the current Knowledge Page or User View.

Navigating to an Organization Knowledge Page or unambiguous organization-scoped context should not silently switch Active Role. If role-specific authority, prompts, or defaults are needed and a User has more than one matching Role, the app should require or preserve an explicit choice rather than guessing.

Organization-scoped visibility may default from the current Organization Page even when Active Role is unset or ambiguous. Broad eligibility may consider all of the User's Roles when no single Role is foregrounded, but role-specific authority, prompts, and permissions should require an explicit Active Role when multiple Roles match the same Organization.

Notifications should remain a visible bottom User View icon rather than being hidden inside the avatar menu, because notification count and unread status need a persistent badge.

Calendar should be a bottom User View icon because it is assembled around the current User's roles, assignments, Events, subscriptions, and memberships. Specific Events remain Knowledge Pages; the Calendar itself is a User View.

Settings should live in the sidebar avatar menu rather than as a persistent bottom icon unless future usage proves it needs more prominence. The User's own profile should be reached through the sidebar avatar and edited inline through editable profile fields rather than through a separate Edit Profile view. Organization settings should be reached from the relevant Organization Knowledge Page by Users whose Active Role permits that action.

The base Knowledge Type is Words. When the application does not yet understand a more specific type, a Referent may be represented as Words until that type is added. Later, Type Reclassification can refine the Tag from Words to a more specific Knowledge Type when the Referent's identity is the same.

Knowledge Types are how the application learns new domain behavior. Adding a type means teaching the app how to recognize, relate, display, scope, and work with entries of that type.

## Core Loop

The product loop has two main user actions:

1. **Explore**: the user makes a Knowledge Request, and the app maps it to a Knowledge Context where relevant Answers can be browsed.
2. **Contribute**: the user adds a future Answer by submitting a Source, creating a Knowledge Entry directly, or responding to an existing Knowledge Entry.

A Knowledge Request is transient by default. It becomes durable knowledge only when the user intentionally Contributes it as a Question or another Knowledge Type.

A contributed Question should create a Knowledge Entry and represented Question Tag, but it should not automatically move the user into that Question's Knowledge Context. The user may then navigate to or select the Question Tag to Explore and Contribute within the narrower context defined by the original context plus that Question.

Contribute should support both direct Knowledge Entry creation and Smart Storage. Smart Storage should not run automatically for every Contribution; some Knowledge Types and workflows, such as straightforward Comments, should be posted directly as the Knowledge Entry currently shown to the user. Direct posting should create only the Knowledge Entry by default; a Bronze Layer Source is needed when the user chooses Smart Storage, import, upload, or another workflow that preserves raw material for later refinement.

Explore and Contribute should happen in the same place. Wherever users see Answers, they should also be able to add the missing future Answer that belongs in that Knowledge Context.

The product should distinguish query-only inputs from Knowledge Composer surfaces. Root Search Input and Knowledge Navigator Query Input may search or select existing Tags, but they do not create Knowledge Entries, Knowledge Requests, Questions, Contributions, Sources, or Tags. Knowledge Composer surfaces are reserved for intentional creation or contribution workflows, and their user action should remain clear at the moment of submission.

A Contribution Submission should become durable only when the user intent needs preserved raw material, multiple Sources, deferred review, retry, Smart Storage, import, upload, or Reprocessing. A simple direct post should not create durable Contribution Submission workflow state by default; it should create the Gold Layer Knowledge Entry and any needed Entry Representations directly.

Each Contribution Submission should have one Primary Intended Entry: the Knowledge Entry the user is principally trying to create or update. Smart Storage may propose additional derived Knowledge Entries from the same submitted Sources, but those derived proposals should remain reviewable separately from the Primary Intended Entry.

When a Smart Storage Run discovers additional entries according to the Smart Storage Contract and Type Behavior versions active at the time of the run, those discoveries should be persisted as full Smart Storage Proposals rather than as a lighter candidate backlog. The review experience should still begin with the Primary Intended Entry, summarize the additional proposal count by Knowledge Type, and let the user leave the review flow after accepting enough Gold Layer knowledge for now. Unaccepted proposals remain Silver Layer material that authorized users can resume later from the originating entry, Contribution Submission, or relevant pending-review surface.

Smart Storage Session is the user-facing term for the review lifecycle around one Smart Storage Contribution Submission. The backend may keep Contribution Submission, Run, Proposal, and Review Slot records separate, but UI copy may say "Continue Smart Storage Session" or "Smart Storage for [Primary Entry]" when referring to the whole contribution review flow.

A Smart Storage Session is complete only when proposal generation is finished and every Smart Storage Proposal has been accepted, rejected, cancelled, superseded, or otherwise closed. Accepting the Primary Intended Entry makes the main contribution successful, but the session remains review-pending or partially accepted while Review Slots remain.

The Smart Storage Session should have a simple conceptual state model for UI behavior even if backend persistence represents the state across Contribution Submission, Smart Storage Run, Smart Storage Proposal, and Review Slot records. Initial states should include preserving Sources, preparing the primary proposal, primary ready, awaiting prerequisites, primary saved, review pending, complete, cancelled, and source preservation failed. Model proposal failures after Bronze preservation should not make the whole session look failed; the UI should say that Sources were saved and proposal generation failed, with retry, scaffold, cancel, or finish-later options. These states describe the user-facing session lifecycle; lower-level run and proposal statuses still preserve operational detail.

After the Primary Intended Entry becomes Gold, user-facing success copy should say `Entry Saved`, `Saved to Knowledgebase`, or equivalent rather than only `Accepted`. Remaining Smart Storage work should be shown separately, such as `8 Review Slots remain`, so the user feels the main entry succeeded without mistaking the whole Smart Storage Session for complete.

Once the Primary Intended Entry is accepted or connected to an existing Gold Layer Knowledge Entry, that entry should become the user-facing anchor for continuing the Smart Storage review. Additional entries accepted from the same Contribution Submission should normally include the anchor entry's Tag in their Knowledge Context, so derived Quotes, Words, Books, or other entries can later be traced back to the Sermon, Lesson, Series, or other primary entry they came from.

Secondary Smart Storage Proposals from a Contribution Submission should not be accept-ready until the Primary Intended Entry has been accepted or connected to an existing Gold Layer Knowledge Entry, except for Prerequisite Proposals required to make the Primary Intended Entry valid. A Prerequisite Proposal may need to be accepted first when it creates or confirms a required Referent, field, or relationship for the primary proposal, such as a required Person for Quote attribution. Other secondary proposals may exist as Silver Layer proposals and be summarized before then, but Gold Layer acceptance waits until the primary entry's Referent and Tag exist so derived entries can reference that anchor immediately.

The Smart Storage review order should optimize for usefulness to the Primary Intended Entry rather than model confidence alone. The wizard should prioritize Prerequisite Proposals needed for the primary proposal's validity, then the Primary Intended Entry, directly cited or referenced entries and Tags, high-value extracted entries such as Quotes or reusable Words tied to specific Bible Passages, lower-confidence optional enrichments, and finally cleanup or ambiguous items.

When Smart Storage identifies multiple entries from one Contribution Submission, the user should accept one Smart Storage Proposal at a time. Even when the Primary Intended Entry is a future Course or MVP Series and the Sources contain many Lessons or other child entries, Gold Layer creation should remain explicit per proposed Knowledge Entry rather than bulk-accepted by default. The MVP should not include bulk acceptance for secondary proposals, but skipping a proposal and finishing the review later should be low-friction.

The Smart Storage wizard should open immediately after the user starts Smart Storage and should make the layer progression visible without making it verbose. Before proposals are ready, the wizard should show that Sources were saved, summarize Source counts by kind, and show that Silver proposals are being prepared under the active Smart Storage Contract. If proposal generation succeeds, the wizard should show the Primary Intended Entry first. If proposal generation fails or returns no proposal, the wizard should still affirm that Sources were preserved and offer retry, scaffold proposal, or finish-later behavior as appropriate.

A Scaffold Proposal is a conservative Smart Storage Proposal created by deterministic application logic when model extraction fails, is unavailable, or intentionally falls back. It may preserve the submitted Knowledge Type, title, current Knowledge Context, Source inventory, representation decisions, and a basic body preview into a minimum reviewable proposal, but it should not pretend to have extracted secondary Quotes, exegesis, Books, Bible Passages, or enriched facts that were not actually produced.

After model proposal generation fails or returns no proposal, Scaffold Proposal creation should be an explicit user action rather than a silent automatic fallback. The UI should first state that Sources were saved and model proposal generation failed or produced no structured proposal, then offer an action such as `Create basic proposal`.

When model proposal generation succeeds but the primary proposal is weak or overreaching, the user may choose a basic Scaffold Proposal instead. Choosing the scaffold should supersede, reject, or otherwise retire the competing weak primary proposal so the Smart Storage Session does not contain two active primary proposals for the same intended entry.

The wizard should show required prerequisites and the Primary Intended Entry as soon as they are ready rather than waiting for every optional secondary proposal to finish. Secondary proposal generation may continue in the background, with honest status such as "Still finding additional Review Slots." The user should not have to wait for every optional Quote, Book, reference, or Words proposal before accepting the main entry.

Choosing Finish Later should leave the Smart Storage review without canceling already-started proposal generation. Background generation may continue creating Review Slots, and the primary entry page or user to-do surfaces should update as additional Review Slots become available. Canceling generation should be a separate explicit action if offered.

Canceling Smart Storage after Bronze Sources have been saved should stop further proposal generation and close or cancel pending Review Slots, but it should not ordinary-delete preserved Sources or accepted Gold Layer entries. Existing accepted entries remain Gold, and Bronze preservation or deletion follows the normal source retention, archive, or redaction lifecycle. Canceling is a processing/review lifecycle action, not a destructive data deletion shortcut.

Canceling an entire Smart Storage session should be limited to the submitting user, the session owner, or an authorized admin or reviewer for the whole Contribution Submission. A Review Slot assignee may reject, skip, refresh, or complete their assigned proposal according to delegated permissions, but should not be able to cancel unrelated proposals, assignments, or background processing for the whole session by default.

When Prerequisite Proposals are needed before the Primary Intended Entry can become Gold, the wizard summary should distinguish required setup from optional additional proposals. The visible sequence should be required setup, then the Primary Intended Entry, then later Review Slots, so users understand why they must review a prerequisite before the main entry and do not confuse prerequisites with optional secondary discoveries.

The Smart Storage wizard should be a focused dialog or route while the user is actively reviewing a session, making it clear that Smart Storage review is the current task. It should also be safely resumable: closing or leaving the wizard must not lose Bronze Sources or Silver Proposals, and unfinished work should appear as Review Slots that can be resumed from the primary entry, to-do list, or pending-review surface.

MVP Smart Storage proposal review should allow only the edits needed to make a proposal valid and correctly contextualized before acceptance: title or identity fields, allowed Knowledge Type correction, Tags, required enriched fields, representation decisions, assignment, skip, reject, and accept. It should not become a full rich-text authoring surface. Longer body or content edits should use bounded correction fields, source-backed excerpts, or post-acceptance editing on the resulting Gold Layer Knowledge Entry.

AI-generated explanatory prose in a Smart Storage Proposal should be treated as review assistance unless the user explicitly accepts it as Gold Layer content. Accepted Gold content should normally be source-backed, structured into Type Behavior fields, or clearly user-confirmed. When AI-generated prose becomes an Entry Representation or body-like content, the review surface should make that clear and Human Weight should reflect the AI-assisted nature of that content.

Smart Storage proposal review should show a compact source and evidence line by default for every proposal, with expandable details for deeper audit. The default view should make clear which Source, excerpt, locator, or Factual Provenance supports the proposal, while the expanded view may show longer excerpts, provenance URLs, model notes, raw source locators, and diagnostics.

Raw model request and response diagnostics should be visible only to authorized admin, operator, or developer surfaces. Normal users should see explainable source citations, provenance, confidence, and review notes rather than prompt internals or raw model output.

Smart Storage should propose secondary Words entries only when a source excerpt is a coherent reusable unit of human-authored content that can stand as a future Answer. For example, a substantial paragraph of exegesis on `Romans 8:28` may become a Words proposal tagged with both `Romans 8:28` and the primary Sermon, while a passing remark should usually contribute only Tags, context, or provenance to the primary entry.

Smart Storage should propose Quote entries only when the quoted excerpt is attributable or enrichable to an attributable source, meaningful enough to stand as a reusable future Answer, and useful for later retrieval. Passing quotations, short fragments, or unattributed remarks should usually remain source context, Tags, or reference-resolution Review Slots rather than becoming low-value Quote proposals.

Pending Smart Storage Proposals that remain after the user finishes the wizard should appear in user to-do surfaces as Review Slots. A Review Slot should use the same visual grammar and grouping behavior as a Knowledge Slot, but its action is review of existing Silver Layer material rather than contribution of missing future knowledge. Review Slots should be grouped by the Smart Storage session's accepted or connected Primary Intended Entry, and their Knowledge Context should include the primary entry's Tag plus the proposal's known Tags and details.

Every Review Slot should project from a durable Smart Storage Proposal or equivalent Silver Layer proposal record, including reference-resolution Review Slots. The UI may present the task as "Resolve reference" or "Review proposed Quote," but the underlying record should preserve source citation, suggested type, evidence, status, assignment, and contract version for audit and refresh behavior.

Reference-resolution Review Slots should support a bounded set of outcomes: match the reference to an existing Known Referent, accept a proposed Knowledge Entry that creates the Referent through Gold Layer creation, reject the proposal, skip or finish later, assign the Review Slot, or refresh it under a newer Smart Storage Contract. They should not support creating a bare Referent and Tag alone. When the user matches a Known Referent, dependent proposals or accepted entries should be updated to reference that canonical Tag when permissions and review state allow.

Review Slot eligibility should include users who would be allowed to edit or accept the resulting Gold Layer Knowledge Entry if the proposal were accepted, subject to the proposal's Review Scope. Review Slots should also support explicit assignment or sending to users, groups, organizations, or other Delivery Targets so pending Smart Storage review can appear in another user's to-do list the way assigned Knowledge Slots do.

Sending or assigning a Review Slot may grant limited review permission for that specific Smart Storage Proposal when the sender is authorized to delegate review. The granted permission should cover the Silver proposal, the source excerpts or representations needed to review it, and the accept/reject/edit actions allowed for that proposal. It must not silently widen access to every Bronze Source in the Contribution Submission, every proposal from the Smart Storage Run, or the eventual Gold Layer Knowledge Entry beyond the Visibility Scope and edit permissions required at acceptance.

When a Review Slot assignee accepts a Smart Storage Proposal, contributor credit, confirmation credit, Human Weight Evidence, and Context Expertise Evidence should remain distinct. The Source provider or author should remain credited for the submitted material when appropriate, while the accepting reviewer is credited as the confirmer or curator of the Gold Layer entry. Human Weight depends on the content and Knowledge Type rather than on who clicked accept; Context Expertise may credit both contribution/source provision and review/curation as separate evidence.

Rejecting a Review Slot should mark the underlying Smart Storage Proposal rejected with a bounded reason, remove or complete that Review Slot from active to-do surfaces, and preserve the Silver proposal and Bronze evidence in Smart Storage session history. Rejection should not delete Sources or raw model output. If the proposal is wrong but the Source remains useful, the review flow may allow editing, splitting, or Reprocessing instead of final rejection.

Review Slots may carry lightweight work metadata such as assignment, created time, optional due date, and simple priority. User to-do surfaces should sort assigned or due Review Slots ahead of ordinary resumable Smart Storage leftovers, then group remaining Review Slots by their Primary Intended Entry. The MVP should avoid a general-purpose task system beyond the work metadata needed to route and resume review.

Review Slots should not silently expire or disappear in the MVP. They may become stale when Smart Storage Contracts or Type Behaviors change, and users may reject, archive, assign, refresh, or complete them, but durable Silver review work should remain available until an explicit review or administrative lifecycle action closes it. To-do surfaces may collapse old unassigned Review Slots under their Primary Intended Entry to avoid clutter.

Sources belong first to the durable Contribution Submission that preserved the user's raw material. Smart Storage Proposals should identify which submitted Sources, excerpts, file ranges, or external URLs support each proposed create or update, and accepted Gold Layer Knowledge Entries should be linked back to the Sources that produced or informed them.

After all proposals from a Smart Storage session are accepted, rejected, or otherwise closed, Bronze Sources should remain preserved for audit, provenance, and future Reprocessing but should move out of ordinary user attention. Authorized users may reach them through source history, provenance, or Smart Storage session history, while entry pages and feeds should stay focused on Gold Layer knowledge and active Review Slots. Later retention or archival policy may prune or cold-store large Bronze assets while preserving enough provenance to explain accepted Gold entries.

Users should not be able to ordinary-delete Bronze Sources that support accepted Gold Layer entries. They may remove a Source from visible Entry Representations when permissions allow, but deleting or redacting the underlying Bronze record should be an admin, archive, legal, or privacy workflow that preserves a provenance stub sufficient to explain the accepted Gold entries without exposing redacted raw material.

A Contribution Submission title should default into the Primary Intended Entry's identity or display title, subject to Smart Storage proposing a more canonical title for user confirmation. A description should not have one universal meaning: the composer should distinguish description as entry display content, entry summary, Authored Text Source, or Contribution Note depending on the user's intent and the Knowledge Type behavior.

A durable Contribution Submission should carry both an intended Visibility Scope for resulting Gold Layer knowledge and a Review Scope for Bronze Sources, Smart Storage Runs, Smart Storage Proposals, and pending review material. These scopes often match, but may differ when a smaller set of Users or Roles should review material before it becomes visible to the intended Gold audience.

Review Scope should default to the submitting User plus authorized reviewers for the active Organization or relevant scope when such reviewers exist. It should not automatically include every User in the intended Visibility Scope when pending raw or proposed material needs review before becoming Gold Layer knowledge. In the first implementation, Smart Storage should default Review Scope to the submitting User unless the composer is explicitly acting in an Organization or Group review context.

When the Sources for a Primary Intended Entry cause Smart Storage to propose creating or updating another Knowledge Entry, the app should not create a vague generic relationship such as `relatedTo` by default. Shared Source provenance preserves the evidence that the entries have overlapping information, while Gold Layer relationships should be expressed through Tags, existing typed relationships, Knowledge Type attributes, or later Type Behavior that can name the relationship precisely. The normal relationship from a derived entry back to an accepted Primary Intended Entry is a Tag reference to that primary entry's Referent.

Sources do not automatically become Entry Representations when a Smart Storage Proposal is accepted. Acceptance should explicitly determine which submitted Sources become confirmed representations of the Gold Layer Knowledge Entry, which remain only Bronze raw material, which serve as Factual Provenance, and which were only Contribution Notes or processing guidance.

The user-facing place for this loop depends on how many Tags are active in the Knowledge Navigator. The Dashboard is used when no Tags are active and the user is located in the Accessible Root Knowledge Context. A Referent Page is used when exactly one Tag is active and the user is focused on the Referent that Tag points to. A Context Page is used when two or more Tags are active and the user is exploring their combined Knowledge Context.

Referent Pages should be reached through Tags rather than Knowledge Entry IDs. In the MVP, non-Scripture Referent Pages may use a route such as `/goto/:tagId`; Bible Passage Referent Pages should use Scripture's familiar citation language with a route such as `/scripture/:passageString`, while still behaving like a one-Tag Referent Page.

Bible Passage Tags and Referents may be created lazily. Visiting `/scripture/:passageString` should not by itself require a persisted Tag or Referent, but analytics should still record the visit against the parsed, normalized passage target so the app can report commonly visited Bible passages before those passages have been tagged or contributed around.

Analytics should distinguish Referent Page visits from Knowledge Navigator usage. A visit records that a user opened a page for a target such as `John 3:16`; Navigator usage records that the user selected a Tag as part of the Knowledge Context for Explore or Contribute.

Analytics should keep raw page visit events separately from aggregate visit stats. Raw events preserve useful history for debugging and future analysis, while aggregate stats support product queries such as commonly visited Bible passages without scanning event history.

Topic should be reserved for a named subject of discussion, such as `atonement`, `friendship`, or `Christian education`. Topic is an MVP Knowledge Type, but it should not mean the Context Page or Referent Page itself. A Topic Tag can be the active Tag for a Referent Page or one of multiple active Tags for a Context Page.

Topic Referents should be globally canonical by default because they name subjects of discussion that can be recognized across Users and Organizations. Local wording, ministry-specific phrasing, or alternate terminology should usually become aliases, context Tags, or scoped Words or Series entries rather than separate Topic Referents. The app should create distinct Topic Referents only when the intended subjects are genuinely different, not merely because two Organizations use the same label differently.

Topic should remain non-weight-bearing. A Topic label names a subject but does not itself express human substance or quality; Human Weight belongs to the Knowledge Entries that address, explain, argue about, illustrate, or apply the Topic. Topic pages may still rank their Answer Feed using the Human Weight and Feed Priority of entries tagged to the Topic.

Topic should be allowed to exist as a Referent and Tag before any Knowledge Entry represents it. A represented Topic entry, when one exists, should require only the shared Knowledge Entry shape and may use a normal Entry Representation for a short description or curated overview. Topic should not require a definition, taxonomy placement, or type-specific detail fields up front because that would slow tagging and turn Topics into mini articles by default.

Topic should be exportable as structural knowledge by default. A Topic export should include the label, canonical key, aliases, optional represented overview when one exists, and optionally visible tagged-entry metadata. It should not bundle the full contents of every tagged Knowledge Entry unless the User explicitly chooses to export the Topic's Knowledge Context or Answer Feed, and those nested exports must follow each entry's own Visibility Scope and Export Behavior.

Topic Referent Pages should use the shared Knowledge Page Shell without a special Topic-specific module in the MVP, except for an optional compact overview or description when a represented Topic entry exists. The main Topic page surface should be the Contribution Editor, Knowledge Navigator, Answer Feed, shared Knowledge Type feed filters, and ordinary related Tag suggestions inferred from visible entries. Taxonomy trees, doctrine maps, and custom discussion boards should wait until a real workflow needs them.

Smart Storage should eagerly suggest Topic Tags when it recognizes subjects, doctrines, themes, school subjects, or recurring concepts, but it should be cautious about creating new Topic Referents. Before proposing a new Topic, Smart Storage should check existing Topics and aliases for a match and prefer reusing the existing Topic when the intended subject is the same. New Topic proposals should be reviewable and should be created only when the subject is clear, useful as future context, and not already represented by an existing Topic.

Doctrines should be represented as Topics in the MVP. Doctrine may become a more specific Knowledge Type later if the product needs confession-specific behavior, doctrinal positions, church statements, or theological taxonomies.

Themes should be represented as Topics in the MVP. Literary or theological themes can become more specific later only if they need behavior that Topic cannot express.

Subjects should be represented as Topics in the MVP. School-subject behavior such as grade-level standards, course catalogs, or credits can be added later if needed.

Genre is not a Knowledge Type. Genre can be an attribute of works such as Books, Songs, Poems, or Short Stories, or a Topic when users discuss the genre itself.

Mood and Tone are not Knowledge Types. They are attributes or analysis labels on works, quotes, comments, or related entries.

Claim should be deferred as a Knowledge Type. Claims can live inside Quotes, Essays, Comments, Questions, Sermons, or Words until argument or reasoning behavior becomes first-class.

Argument should be deferred as a Knowledge Type. Arguments can live inside Essays, Sermons, Comments, Questions, or Words until claim/evidence/reasoning structure becomes first-class.

Evidence is not a Knowledge Type. Evidence is a role a Knowledge Entry can play in relation to a Claim, Argument, or Question.

Annotation should be deferred as a Knowledge Type. Annotation overlaps with Comment and Quote until anchored marginalia or highlighting behavior becomes first-class.

Highlight is not a Knowledge Type. Highlight is selection or interaction state over a Source, Quote, Bible Passage, or other entry.

Summary should be deferred as a Knowledge Type. Summaries can live inside Words, Comments, Essays, Lessons, or Sermons until summary-specific provenance, target, length, or review behavior matters.

Transcript should be deferred until at least Phase 2 as an academic record summarizing courses taken across an academic career. Do not use Transcript as the domain term for a text representation of audio or video; that should remain a Source or representation of another Knowledge Entry such as a Sermon.

Record is not an MVP Knowledge Type. It is too broad and overlaps with Knowledge Entry, Source, future academic Transcript, and future administrative records.

Series is an MVP Knowledge Type for named collections or sequences, such as `Narnia`, `Romans Sermon Series`, or `Grade 7 Literature Unit`. Series should not be collapsed into Topic because a Series is a curated or ordered grouping, not merely a subject of discussion.

Series should cover curriculum-like groupings in the MVP. Course, Canon of Literature, and Curriculum should be added in Phase 2 when the product needs richer education-specific behavior.

Collection is not an MVP Knowledge Type. Series covers named curated or ordered groupings, while Tags and Context Pages cover everything related to a Knowledge Context.

## Smart Storage

Smart Storage is the AI-assisted process of preserving a Source, identifying relevant Tags, and refining that Source toward one or more pieces of structured knowledge the application understands.

Smart Storage is an optional contribution path rather than the only way to Contribute. When direct posting and Smart Storage are both available, the user should be able to choose between posting the entry as currently displayed and storing smartly for AI-assisted proposal generation.

Direct posting should bypass the Smart Storage wizard entirely. When direct posting supports files or external URLs, those attachments should become Entry Representations on the created Gold Layer Knowledge Entry rather than Bronze Sources or Silver review material. Smart Storage remains the explicit path for Bronze preservation, model proposal generation, Review Slots, and deferred review.

The MVP should optimize Smart Storage for useful extraction and reviewable Silver output from submitted Sources rather than prematurely limiting proposal generation. Future pricing, quota, or admin controls may meter large runs, refreshes, secondary proposal generation, delegated review volume, or repeated Reprocessing, but the initial UX should already support background processing, Review Slots, and finish-later behavior so those controls can be added without changing the core flow.

Smart Storage may use Factual Enrichment when a Source points to factual knowledge it does not itself contain, such as a fuzzy description of a known quotation. Factual Enrichment is encouraged for factual information, but it must produce a user-confirmable proposal rather than writing directly to the Gold Layer.

Title-only Sources for recognizable public works or public entities may trigger Factual Enrichment when the Knowledge Type's Type Behavior allows public identity matching. The submitted title remains the Bronze Source, while enriched fields such as author, publication date, external provenance, and candidate thumbnail are Silver Layer proposal facts that require User confirmation before becoming Gold.

Every enriched Factual Field in a Smart Storage Proposal should carry Factual Provenance whenever feasible. Factual Provenance may point to an external URL, to another Knowledge Entry, or to a model-only basis when no external evidence was checked.

Factual Provenance may attach to the whole Smart Storage Proposal or Knowledge Entry when one evidence trail supports the proposal as a whole. When enriched Factual Fields come from different evidence or have different confidence, Factual Provenance should attach to the specific Factual Field or claim it supports.

Required Factual Provenance should be determined by the Smart Storage Contract and the Type Behavior for each Knowledge Type and Factual Field. Type Behavior may mark fields as enrichable and may require provenance for enriched values, such as a Book proposal enriching a fuzzy Source into the title `Pride and Prejudice` and author `Jane Austen`.

When a required identity field or required Type Behavior field is missing from the submitted Source but can be responsibly enriched, Smart Storage should attempt Factual Enrichment rather than leaving the proposal permanently incomplete. For example, if the Source only contains `to be or not to be` and Smart Storage proposes a Quote, the proposal must identify the quoted person and source work before it can become Gold. Enriched required fields should be marked as enriched, supported by Factual Provenance when available, and confirmed during review before acceptance.

Required enriched fields should be foregrounded in the Smart Storage review so the user can see and correct them before acceptance, but they should not require a separate confirmation step when they are complete and non-ambiguous. The user should still be able to accept the Gold Layer entry in one action from the proposal review, with enriched required fields visible in that acceptance surface. Separate blocking questions are reserved for missing fields, unresolved ambiguity, missing required provenance, or permission-sensitive choices.

Smart Storage Proposals and enriched Factual Fields may include coarse Proposal Confidence such as high, medium, or low. Proposal Confidence should guide user review, especially for model-only provenance or ambiguous candidates, but it must not be presented as Human Weight or as a substitute for user confirmation.

Low Proposal Confidence should warn the user but should not universally block acceptance. Acceptance should be blocked by invalid Smart Storage Contract shape, unresolved required fields, unresolved identity ambiguity, or missing required Factual Provenance rather than by confidence alone.

Smart Storage should send a curated Smart Storage Contract to the LLM rather than the raw database schema. The contract should include whatever domain information the LLM needs to match Sources to Knowledge Types and propose Gold Layer structure, such as allowed Knowledge Types, type-specific fields, proposal requirements, current Knowledge Context, relevant existing Tags or Referents, examples, and provenance expectations.

The Smart Storage Contract represents the application's current understanding of what knowledge it can recognize, propose, tag, enrich, and validate. The request-specific Bronze input is separate: user-provided Sources, active Knowledge Context, candidate existing Referents, retrieved evidence, and other facts sent for one run should be snapshotted with the Smart Storage Run or Proposal rather than treated as part of the reusable contract.

Smart Storage should prefer referencing existing Referents and Tags over proposing new ones. Model output may identify discovered people, books, Bible passages, topics, places, or other referenced things, but backend matching remains authoritative: if the app can confidently match a discovered reference to an existing same-typed Referent under current Type Behavior and Referent Identity Scope rules, the proposal should reference that canonical Tag rather than create a new Smart Storage Proposal. New proposals are for discovered knowledge the app cannot safely connect to existing Referents or Entries.

If Smart Storage finds an unknown referenced thing but the Source does not contain enough standalone content or required identity data to create a useful Knowledge Entry for it, the review should preserve it as a reference-resolution Review Slot rather than inventing a Gold entry or blocking unrelated acceptance. The user may map the Review Slot to a Known Referent, accept a Knowledge Entry proposal when they want the app to know that Referent now, or leave the Review Slot pending.

Reference-resolution Review Slots should be resolved inline only when the current proposal cannot become Gold without them. Optional references should become pending Review Slots so the current Smart Storage wizard can keep moving without nested entry creation.

Smart Storage should not let ordinary users resolve a reference-resolution Review Slot by creating a bare Referent and Tag alone. User resolution may map the reference to a Known Referent, leave the Review Slot pending, or accept a Knowledge Entry proposal whose represented Referent becomes known as part of Gold creation.

When a proposal requires an unknown Person, Book, Topic, or other Referent as a required identity field, Type Behavior field, or relationship, Smart Storage should create or surface a Prerequisite Proposal for that required entry rather than accepting the dependent proposal without the required field. The wizard should resolve and accept required prerequisites before accepting the dependent proposal. Optional references that only enrich the Knowledge Context should remain Review Slots and may be resolved after the primary entry is accepted.

If a required field or relationship can be satisfied by an existing Known Referent, the dependent proposal does not need a Prerequisite Proposal. The review surface should ask the user to confirm or correct the Known Referent match, then use that Tag or Referent in the accepted Gold entry.

Accepting a dependent Smart Storage Proposal should not automatically accept its Prerequisite Proposals. Each prerequisite still crosses the Gold Layer boundary through its own explicit user acceptance, but the wizard should present prerequisite review as a short sequential setup step and then return the user to the dependent proposal.

When Smart Storage finds plausible matches to multiple same-named Referents, it should preserve the ambiguity for user resolution rather than guessing. For example, if two Person Referents named John Calvin exist, the review flow should ask which one is meant or allow the user to explain that a different John Calvin is being referenced.

Unresolved reference ambiguity should block accepting a Smart Storage Proposal only when the ambiguous reference is required for that proposal's identity, required Type Behavior fields, required provenance, or required permission checks. Ambiguous optional references should be omitted, marked unresolved, or left as pending review material so the user can accept the current proposal without resolving every discovered reference.

Smart Storage's model-provider strategy should keep the domain contract provider-neutral. The application should use deterministic application logic for local previews, cheap scaffolds, and fallback behavior; the first LLM-backed implementation may use OpenAI's Responses API for structured Silver Layer proposal generation; a later self-hosted proprietary model should be able to replace that adapter without changing the durable Smart Storage Contract shape.

Smart Storage Contracts and Type Behaviors must be versioned and tracked in the database as immutable content snapshots, not only as version labels pointing to code or configuration. Each Smart Storage Proposal should record the Smart Storage Contract version and Type Behavior version that generated it, so later rule changes can mark proposals stale or route them through Reprocessing intentionally.

Type Behavior should be versioned as a whole per Knowledge Type, with field-level rules inside the immutable snapshot. For example, a Book Type Behavior snapshot may define whether `title` and `author` are enrichable and whether enriched values require Factual Provenance, without creating separate version records for each field.

When the Smart Storage Contract or relevant Type Behavior changes before a Proposal is accepted, the review flow should compare the generating contract with the latest active contract. Compatible older proposals may remain accept-ready with a visible "generated with older rules" note and an option to refresh. Incompatible proposals, or proposals whose old contract lacks newly required identity, provenance, permission, or field rules, should become stale and require refresh or Reprocessing before Gold acceptance.

Accepting a stale-but-compatible Smart Storage Proposal should not silently regenerate or rewrite the proposal with the latest model output. The proposal's visible generated shape comes from its recorded contract and Type Behavior snapshots, while the acceptance gate uses current backend rules for identity, permissions, required fields, required provenance, and persistence validity. Choosing refresh should create a new or superseding proposal using the latest active Smart Storage Contract.

Refreshing a Smart Storage Proposal should create a new superseding proposal rather than rewriting the existing proposal in place. The older proposal should remain in Smart Storage session history with a superseded status or equivalent link to the replacement proposal, preserving auditability, user-visible explanation, and contract-version comparison.

Knowledge Type-specific navigation, identity, edit, and exception behavior should live behind a TypeScript Type Behavior class or interface now, rather than remaining scattered across composer, Smart Storage, routing, and entry-editing code. The first implementation should stay small, such as a Type Behavior interface plus registry, and should avoid a large inheritance hierarchy until repeated behavior proves it is needed. The first-slice Type Behavior interface should expose `knowledgeType`, `version`, `identity`, `referentIdentityScope`, `composerDefaults`, `smartStorageChallenge`, `representationRoles`, `primaryRepresentation`, `humanWeight`, and `provenance`, using plain config objects or small functions. Shared resolver services should perform the actual lookup against Tags, Referents, aliases, and represented Knowledge Entries so database and permission logic is not duplicated per Knowledge Type. For example, Comment may not use the default represented-Referent share-link or edit flow because it is born as a response to another Knowledge Entry.

Export Behavior should be captured as a first-class Type Behavior axis for each Knowledge Type, but the first version should stay lightweight: whether export is allowed, the default export shape, how Entry Representations are included or omitted, and which Visibility Scope or role checks constrain export.

Smart Storage Contract versions should contain stable reusable rules and templates, not request-specific data. Request-specific input should be snapshotted separately with the enrichment run or Smart Storage Proposal, including the Source reference, the specific Source text or excerpts sent to the LLM, active Knowledge Context, candidate existing Tags or Referents, retrieved evidence, and other facts used for that specific proposal generation.

Layer promotion should be informed by the latest active Smart Storage Contract whenever practical. Bronze Sources and accepted Gold Layer entries should remain available for later Reprocessing when new Knowledge Types, richer Type Behaviors, or improved recognition rules are added, so older material can produce new Smart Storage Proposals or Upgrade Candidates without silently rewriting existing Gold entries.

The MVP should surface Smart Storage refresh opportunities passively rather than proactively rerunning old Sources in the background. When a user opens an affected Review Slot, Smart Storage session, primary entry page, or pending-review/to-do surface, the UI may show "Refresh available" if a newer contract or Type Behavior could improve the proposal. Automatic bulk reprocessing should wait for an explicit user, reviewer, admin, paid, or batch workflow.

Request-specific input snapshots should record what the LLM actually saw while linking back to the full Bronze Layer Source as the durable raw record. The full raw Source should not be duplicated into the input snapshot unless the full Source was actually sent to the LLM.

Smart Storage Runs should preserve the raw model output separately from parsed Smart Storage Proposals. The raw output supports audit, debugging, parser failure recovery, and future contract improvement, while the Smart Storage Proposal remains the cleaned, validated, contract-shaped Silver Layer record users review.

Failed LLM calls, parse failures, and validation failures should create or update Smart Storage Runs, not Smart Storage Proposals. A Smart Storage Proposal should exist only after the app has parsed and validated a contract-shaped candidate that the user can review.

Smart Storage Run status should describe operational processing rather than user review. A queued run is waiting to call the model. A running run is actively enriching. A succeeded run produced at least one parsed Smart Storage Proposal. A no-proposal run completed without producing a reviewable proposal. A failed run stopped because the LLM call, parse, or validation failed before any proposal existed. A superseded run was replaced by a newer run for the same Source and request context.

No-proposal outcomes should be surfaced quietly in the contribution or review area, such as "Saved as Source; no structured proposal found." They should not create Answer Feed items, Knowledge Slots, or failed Smart Storage Proposal cards.

Bronze Sources and Silver Smart Storage Proposals should not appear in the normal Answer Feed, which should remain focused on accepted Gold Layer Knowledge Entries and Knowledge Slots. If Bronze or Silver material has been matched to a Referent without producing Gold Layer knowledge, the Referent Page may surface it as pending or reviewable material and let authorized Users continue the review process from there. Visibility for that pending material should follow the Contribution Submission or review scope, not the Referent Page alone.

Review Slots should appear in user to-do or pending-review surfaces as actionable Knowledge Slot-like cards, grouped by the accepted or connected Primary Intended Entry when available. The primary entry page may also show a compact Smart Storage pending section with a count and type breakdown for its Review Slots. Review Slots should not be mixed into the normal Answer Feed as if they were Gold Layer Knowledge Entries; if a mixed work feed includes them, they should remain visually slot-like and clearly pending review.

Smart Storage Proposal acceptance should validate against the Smart Storage Contract and Type Behavior versions that generated the proposal unless those versions have been marked incompatible or retired. Incompatible or retired versions should make affected proposals stale and require Reprocessing before acceptance.

Accepting a Smart Storage Proposal requires all relevant permissions, not only access to view the proposal. The User must be authorized under the Review Scope, authorized to create or update the resulting Gold Layer Knowledge Entry under its intended Visibility Scope, authorized to edit any existing target entry, and authorized to create or reuse identity within the relevant Referent Identity Scope.

Smart Storage may challenge a user-selected Knowledge Type when the Source appears to match a more specific or more appropriate Knowledge Type. A Knowledge Slot's requested Knowledge Type remains fixed during Knowledge Slot Fulfillment, so Smart Storage should not challenge it.

In the composer and proposal review UI, Knowledge Type changes from Smart Storage should be presented as recommendations or blocking mismatches for the User to resolve, not silent changes to the submitted intent. The wizard may show a recommended type change, such as `Words` to `Sermon`, with a visible reason and let the user accept the change or keep the original type when Type Behavior allows. If accepting the recommended type introduces required fields, prerequisites, or provenance requirements, those should become visible before Gold acceptance. Knowledge Slot Fulfillment keeps the Slot's requested Knowledge Type fixed.

When a user creates or refines a Knowledge Entry, the creation flow should first search for existing Tags and Referents before creating new ones. The accepted behavior is to reuse the canonical Tag when the intended Referent already exists, and to create a new Tag only when the app cannot confidently match an existing Referent or the user confirms the proposed new Referent is distinct.

The bronze, silver, and gold progression describes the degree to which useful information has been extracted, cleaned, structured, and shaped from the original Source:

- The Bronze Layer preserves submitted Sources as close as possible to their original form.
- The Silver Layer is an intermediate refinement layer for cleaned and structured data that has not yet become fully typed knowledge.
- The Gold Layer contains Knowledge Entries represented according to the most specific Knowledge Types the application currently understands.

For Smart Storage, Bronze Layer is to Source as Silver Layer is to Smart Storage Proposal and Gold Layer is to Knowledge Entry. Bronze preserves raw data, Silver holds reviewable proposed knowledge, and Gold stores confirmed Knowledge Entries.

For Smart Storage, the Bronze Layer Source should be preserved immediately when the user submits, before any LLM call or Smart Storage proposal generation. If enrichment fails, times out, or produces no acceptable proposal, the preserved Source should remain available for retry or Reprocessing.

Uploaded files should become preserved Bronze Layer Sources as soon as storage succeeds, even before extraction, parsing, transcription, preview generation, or Smart Storage analysis succeeds. Unsupported extraction or analysis failures should be represented in Smart Storage Run or processing state without deleting or invalidating the preserved Source.

When a user later opts a directly created Knowledge Entry into Smart Storage or Reprocessing, the app should create a Bronze Layer Source snapshot of the entry's current representation at that moment and link it back to the existing Knowledge Entry. That Source preserves the reprocessing input; it should not be treated as the original raw direct-post submission.

Before direct posting or Smart Storage, the application should provide a deterministic Contribution Preview that shows the best current guess for the Knowledge Type, Knowledge Context, and visible entry attributes that would be contributed. This preview should be computed by application logic rather than an LLM and should update as user input, uploaded material, or selected context changes.

Gold Layer Knowledge Entries produced through Smart Storage require user confirmation. LLM-assisted enrichment can improve a proposal, but confirmation is the boundary where proposed structured knowledge becomes stored Knowledge Entry data.

User confirmation can make the confirming user responsible for the whole Knowledge Entry while individual Factual Fields remain attributed to their Factual Provenance. External factual material that should remain navigable in the knowledgebase may be represented by a Knowledge Entry; otherwise an external URL can serve as the provenance target.

Factual Provenance should default to an external URL when the source is only needed as evidence for a proposed fact. Smart Storage should create or propose a Knowledge Entry for the provenance target only when that target is itself a meaningful Referent users may navigate, tag, search, reuse, or cite repeatedly.

One Source can produce many Knowledge Entries. For example, an uploaded essay or transcript can produce one Primary Intended Entry and many Quote entries, each with its own Knowledge Context. The Primary Intended Entry's Knowledge Context may be a superset of the union of its quotes' Knowledge Contexts.

The user review unit for Smart Storage should be a durable Smart Storage Proposal linked to the saved Source, and each Smart Storage Proposal should correspond to one proposed Knowledge Entry. A single Source may therefore produce many Smart Storage Proposals, letting the user accept, reject, or edit each proposed Knowledge Entry independently.

Smart Storage Proposals belong to the Silver Layer and should survive refresh, navigation, failed enrichment, and deferred review. They are review records tied to Bronze Sources, not temporary UI previews and not Gold Layer Knowledge Entries.

Smart Storage Proposals should store contract-shaped domain proposals rather than raw Convex write payloads. On acceptance, the backend should validate the proposal and translate it into the current persistence shape, keeping Silver Layer records portable if the application later migrates away from Convex or changes its internal schema.

Smart Storage Proposal records should preserve the original generated proposal separately from the current reviewed proposal. The original generated proposal supports audit, debugging, and Reprocessing, while the current reviewed proposal is the editable version the user may accept into Gold Layer knowledge.

Guided Smart Storage follow-up questions should update the current reviewed Smart Storage Proposal before acceptance. Follow-up answers may resolve required fields, identity ambiguity, context Tags, referenced Referents, or proposal details, but they should not create partial Gold Layer Knowledge Entries while the proposal remains under review.

Guided Smart Storage follow-up questions should resolve required fields and blocking ambiguities first, one question at a time. Once the proposal is valid and accept-ready, optional enrichment questions may be offered as skippable prompts or suggestions, but they should not block acceptance.

Smart Storage Proposal status should stay small. A drafted proposal is generated and awaiting review. A needs-resolution proposal requires the user to choose between candidates or resolve ambiguity. An accepted proposal has produced a Gold Layer Knowledge Entry. A rejected proposal was declined by the user. A stale proposal was superseded by a newer Smart Storage Contract, Type Behavior, or Reprocessing run.

Accepting a Smart Storage Proposal should be atomic for one complete proposed Knowledge Entry. Users should edit the proposal, split it into multiple proposals, or reject unwanted proposals before acceptance rather than partially accepting individual fields into Gold Layer knowledge.

Proposal generation may suggest existing Tags, Referents, and Knowledge Entries, but acceptance is the authoritative identity check. At acceptance time, the application should re-check current canonical Tags and Referents, reuse existing matches, and refuse, redirect, or propose an authorized update when another same-typed Knowledge Entry already represents the proposed Referent.

When Smart Storage identifies an existing Knowledge Entry that should receive new information from the submitted Sources, the review flow should make that update explicit. If the reviewing User has permission to edit the existing entry, acceptance may add the confirmed information to that entry; otherwise the proposal should not silently modify Gold Layer knowledge.

The first implementation of Smart Storage Proposal acceptance should create new Knowledge Entries only. If acceptance finds that the proposed represented Referent already has a Knowledge Entry, it should stop and return a reviewable target-exists state rather than patching the existing entry. Updating existing entries should be a later permissioned slice with explicit conflict and audit behavior.

Smart Storage should create one primary Smart Storage Proposal for the user's intended Knowledge Entry and include referenced Tags or Referents inside that proposal. If a referenced Referent is already a Known Referent, the proposal should explicitly show that the resulting Knowledge Entry will reference that existing Referent through its Tag. If the referenced Referent is not yet known, Smart Storage should create a separate Knowledge Entry proposal only when the Source contains enough separate entry content for that Referent or Type Behavior requires the entry to create the Referent. Smart Storage should not create a Knowledge Entry merely to duplicate a Known Referent.

When Factual Enrichment finds multiple plausible matches for a user's intent, ambiguity should remain inside Smart Storage Proposal review. The user must choose the exact candidate before the proposal becomes Gold Layer knowledge, and Smart Storage should create multiple Gold Layer Knowledge Entries from a fuzzy Source only when the user explicitly accepts multiple proposals.

The first implementation slice, meaning the first independently buildable and reviewable increment of the upgraded Knowledge Composer, should establish the durable multi-Source Smart Storage spine before delivery channels or advanced extraction intelligence. That slice should create and persist a durable Contribution Submission with intended Visibility Scope, Review Scope, Primary Intended Entry metadata, and Contribution Note; persist multiple Bronze Sources per submission for Authored Text Source, uploaded file storage IDs, and external URLs; store Link Preview metadata for external URLs; queue a Smart Storage Run linked to the Contribution Submission and source IDs; create a conservative scaffold Smart Storage Proposal; show and review that proposal; and accept it into one new Gold Layer Knowledge Entry with selected Entry Representations and Source/output links. It should also include a small TypeScript Type Behavior interface or registry for MVP identity and composer defaults. Delivery channels, SMS, email, DM, full extractor pipelines, real LLM contract generation, update-existing-entry acceptance, complex Course child-entry generation, save drafts, and Referent merge/split review should come later.

Uploaded files in the first slice should use direct browser-to-Convex storage before Contribution Submission persistence. The composer should obtain an upload URL, upload file bytes to Convex storage, then submit the resulting storage ID and file metadata as a Bronze Source; Contribution Submission mutations should not receive raw file bytes.

Pre-submit uploaded files should be treated as temporary until attached to a durable Contribution Submission. The first implementation should track temporary uploads with uploader, storage ID, metadata, creation time, and expiration or cleanup status so abandoned composer sessions do not leave unmanaged storage objects.

The first implementation should include a small `temporaryUploads` table for browser-to-Convex uploads that have not yet been attached to a durable Contribution Submission. The table should include `storageId`, `uploadedByUserId`, `fileName`, `contentType`, `fileSizeBytes`, `uploadStatus`, `expiresAt`, `attachedContributionSubmissionId`, `createdAt`, and `updatedAt`. The initial upload status enum should be `uploaded`, `attached`, `expired`, and `deleted`. Keeping the temporary upload row after attach lets cleanup and audit code distinguish attached uploads from abandoned uploads.

### Convex File Upload Protocol

All Knowledge Entry file uploads should use the same Convex direct-upload protocol, whether the file is a document, manuscript, slide deck, transcript, audio recording, video recording, image, thumbnail, or generic supporting file.

1. The client asks an authenticated Convex mutation for an upload URL. In the current implementation this is `api.smartStorage.generateUploadUrl`, which verifies app access and returns `ctx.storage.generateUploadUrl()`. File bytes must not pass through ordinary Convex mutations and must not be stored in application documents.
2. The client posts the selected browser `File` or `Blob` directly to the returned upload URL with the best available content type, using `file.type || "application/octet-stream"` when the browser does not provide a type. Convex returns a `storageId`; later application mutations should pass that storage ID rather than the bytes.
3. After the storage POST succeeds, the client immediately creates a temporary upload record, currently through `api.smartStorage.createTemporaryUploadRecord`, with `storageId`, bounded `fileName`, optional `contentType`, optional `fileSizeBytes`, and optional `languageCode`. The mutation must validate the ID with `v.id("_storage")`, load storage metadata with `ctx.db.system.get("_storage", storageId)`, prefer Convex storage metadata when present, and reject missing or deleted storage. Do not use deprecated storage metadata APIs.
4. Direct `Post` or `Comment`, Smart Storage `Store`, thumbnail assignment, and later file-upload flows should submit only `storageId`, `temporaryUploadId`, and bounded metadata. The attaching mutation must confirm that the temporary upload belongs to the current user, has `uploadStatus: "uploaded"`, and has the same `storageId` as the submitted file before marking it `attached`.
5. Direct post paths create `entryRepresentations` with `representationKind: "storageFile"`. Smart Storage paths create Bronze Sources with `sourceKind: "uploadedFile"` and preserve the storage ID even when extraction, preview, transcription, or proposal generation fails.
6. Abandoned uploads remain temporary until attached. Cleanup should expire or delete unattached temporary upload rows and call `ctx.storage.delete(storageId)`. Cleanup must skip attached uploads.
7. Display, download, preview, and thumbnail URLs should be produced only by authorized Convex functions with `ctx.storage.getUrl(storageId)`. Treat a `null` URL as missing or deleted storage.

File media format is not a Knowledge Type. After upload, the application should infer Representation Role from stored metadata, file name, selected Knowledge Type, source kind, and user intent using the shared file-role helper rather than one-off MIME checks in each upload surface. Initial file role inference should recognize slide decks as `slides`, transcript files as `transcript`, manuscript files as `manuscript`, audio and video as `recording`, image thumbnails as `thumbnail`, and otherwise fall back to `supportingMaterial` or `unspecified` according to Type Behavior. Proposal review should still let the User correct the inferred role before acceptance.

Tests for new upload surfaces should cover authenticated upload URL generation, temporary upload creation from a stored `Blob`, missing or deleted storage rejection, owner/status/storage ID mismatch rejection, successful attachment, cleanup behavior, and representative file categories for the file types the application intends to store: manuscripts or documents, slides, transcripts, audio, video, images or thumbnails, and generic supporting files. Convex tests should include any imported helper modules in the `convexTest` module map and should tolerate local test-environment metadata gaps by asserting the server-side fallback behavior.

When the User submits through the Smart Storage path, preserving the durable Contribution Submission should automatically queue the first Smart Storage Run. Direct post, upload-only, save-draft, or other non-Smart-Storage paths should not queue Smart Storage unless the User explicitly opts in later.

The first multi-Source Smart Storage spine slice did not include a full save-draft workflow for Contribution Submissions. The later Contribution Editor draft slice may persist a Composer Draft before submission, including rich-text document JSON, derived plain text, selected Knowledge Type, title, and placement identity. Composer Draft saves must not create Knowledge Entries, Contribution Submissions, Sources, Smart Storage Runs, or Smart Storage Proposals, and failed submissions should leave the draft available. Durable uploaded-file draft persistence and abandoned-upload cleanup remain separate lifecycle work.

The first attachment slice used the durable Contribution Submission and Bronze Source path for attachments and external URLs. Once direct attachment-to-Entry-Representation and direct external-URL representation behavior is implemented, direct `Post` and `Comment` submissions may include staged URL and file attachments as Entry Representations without creating Bronze Sources by default.

Text-only Contributions may still use direct post when the User chooses the direct path. User-entered text becomes an Authored Text Source only when submitted through Smart Storage, import, Reprocessing, or a multi-Source Contribution Submission that uses the Bronze path.

The composer may keep separate direct post and Smart Storage actions for Words and Comment Contributions, including Contributions with staged uploaded files or external URLs once direct representations are supported. When the User chooses Smart Storage, the same staged material should be preserved through the durable Bronze path.

Before advanced extraction exists, first-slice Smart Storage Proposals should be conservative scaffolds rather than pretending to understand files or media that have not been extracted. A scaffold proposal may preserve the selected Knowledge Type, title, selected Tags, intended Visibility Scope, Review Scope, Contribution Note, and source inventory with extraction or preview status, while deferring derived proposals until the app has actual extracted content or user-confirmed structure.

Scaffold Smart Storage Proposals may be accepted into Gold Layer knowledge when Type Behavior says the proposed minimum entry is valid and the User explicitly confirms which Sources become Entry Representations. Acceptance should create the Gold Knowledge Entry, confirmed Entry Representations, and Source/output links together. When required fields, identity ambiguity, provenance, permissions, or representation decisions are unresolved, the proposal should remain needs-resolution rather than becoming Gold.

One Source may eventually produce multiple Entry Representations, such as an uploaded sermon manuscript producing both a stored file representation and extracted plain text, or a video URL later producing an external URL representation and transcript text. In the first implementation slice, confirmed Sources should usually map one-to-one into Entry Representations unless a User action or extractor explicitly splits the Source into multiple representations.

Type Behavior should provide the default Primary Representation rule for each Knowledge Type, and the User should be able to override that default during proposal review when more than one Entry Representation is valid. Primary Representation determines the default display, open, preview, or playback behavior; it does not make other representations less valid or less preserved.

Entry Representations should carry Representation Roles in addition to representation kinds when the role is known or inferred. Users should not be required to manually label every representation up front; Type Behavior, deterministic metadata, and Smart Storage may infer roles from source kind, file name, content type, link metadata, extracted content, selected Knowledge Type, and Contribution Notes. Proposal review should show inferred roles and allow the User to correct them before acceptance.

Representation Role does not replace explicit Primary Representation selection. Type Behavior may use roles to choose a default Primary Representation, but the accepted primary selection should remain explicit entry data so role and default display behavior can evolve independently.

When Representation Role inference is low-confidence, the app should fall back to a generic role such as supporting material or unspecified and should not block acceptance unless the Knowledge Type's Type Behavior requires a specific role. If a required role is missing or ambiguous, proposal review should ask the User to identify which Source or representation fulfills that role.

Gold Layer Entry Representations should store the accepted Representation Role as normal entry data. Inference confidence, rationale, and model or metadata basis should remain on the Smart Storage Proposal, run history, or audit trail rather than becoming hot Gold Layer display data after the role is accepted.

Representation Role values should start as a small global enum, such as primary content, supporting material, manuscript, slides, transcript, recording, thumbnail, external reference, and unspecified. Type Behavior may later introduce controlled type-specific role extensions, but Gold Layer roles should not be arbitrary free-text labels.

Accepting a scaffold proposal should not consume or retire the underlying Sources. Accepted entries should remain linked to the Sources and proposals that produced them so later extraction, enrichment, Type Behavior improvements, or Reprocessing can propose updates to the existing entry or additional derived entries.

Reprocessing revisits existing Sources or Knowledge Entries when the application gains new Knowledge Types or improved recognition. A previously complete entry can become an Upgrade Candidate when a new type reveals knowledge it held only indirectly.

Smart Storage should not challenge or change an accepted Gold entry's Knowledge Type as part of the original acceptance flow after the entry has become Gold. Later type refinement should happen through refresh or Reprocessing when the Smart Storage Contract or relevant Type Behavior changes, producing an Upgrade Candidate or reviewable proposal that the user explicitly accepts.

Reprocessing may propose edits to an existing Gold Layer Knowledge Entry when the same knowledge can be represented more specifically, such as changing its Knowledge Type, fields, represented Referent, or Tags. It may also propose additional linked Knowledge Entries when the Source or existing entry contains separate knowledge units. The proposal review must make the outcome explicit: acceptance either updates an existing Gold entry, creates new Gold entries, or does both through clearly separated proposals.

Reprocessing outputs that require human review should appear as Review Slots. Suggested edits, Type Reclassification, new derived entries, reference-resolution work, and refresh results should use the same Knowledge Slot-like to-do grammar as unfinished Smart Storage proposals, grouped under the relevant existing Gold entry or Smart Storage Session.

Review Slots created by refresh or Reprocessing should use the same card grammar as original Smart Storage Review Slots, with a small origin label such as `Refresh` or `Reprocessing` when helpful. The label should explain why the work appeared without creating a separate user-facing task category.

When a Smart Storage Contract or Type Behavior version changes, the app may run Reprocessing across a selected dataset or the entire eligible dataset to produce suggested edits and new proposals. Dataset-wide Reprocessing should create reviewable Smart Storage Proposals or mark Upgrade Candidates; it should not silently rewrite Gold Layer Knowledge Entries.

Dataset-wide Reprocessing may include direct-post Knowledge Entries by default. For direct-post entries that do not already have Bronze Sources, the app should first create a Bronze Layer Source snapshot of each eligible entry's current representation before running Smart Storage. Existing Smart Storage, import, or upload entries can reuse their preserved Bronze Sources when those Sources remain the correct input for the new run.

Dataset-wide Reprocessing suggestions should be routed to users with authority over the affected Visibility Scope, Organization, or entry. Personal suggestions should go to the owning user; organization-context suggestions should go to users with the relevant organization role; public or global suggestions should use a trusted maintainer workflow. Bulk Reprocessing may generate suggestions at scale, but accepting suggested edits remains permissioned per affected entry or proposal.

Reprocessing notifications should present new type or contract improvements as opportunities to enrich the knowledgebase, not as errors in existing data. For example, when a new Canon of Literature type is added later, a school user might see: "Exciting news! We just added the Canon of Literature type. You have books in your school's context that look like they might make good additions to your canon. Click to see suggestions." The exact copy may vary, but the posture should be invitational and review-oriented.

Clicking a Reprocessing notification should open a scoped suggestions queue rather than jumping directly to the first suggestion. The queue should be filtered to the relevant Knowledge Context, Organization, new Knowledge Type, or contract improvement, show the size and shape of the opportunity, and let authorized users accept, reject, or open individual suggestions for review.

The MVP suggestions queue should not support bulk accept for Reprocessing suggestions. Accepting suggested edits or new Gold entries should remain one suggestion at a time. Bulk dismiss, bulk reject, or "not now" actions may be allowed because they avoid writing Gold Layer knowledge; bulk accept can be reconsidered later for low-risk suggestions with strong provenance, audit, and rollback.

Rejected or dismissed Reprocessing suggestions should be remembered so the app does not repeatedly present the same candidate to the same review scope. The dismissal should be tied to the proposal or candidate key, the Smart Storage Contract or Type Behavior version that produced it, and the relevant reviewer scope. A materially changed suggestion from a later contract or behavior version may be surfaced again.

Accepted Reprocessing edits should preserve explicit upgrade provenance, such as the prior Knowledge Type or shape, the accepted proposal, and the Smart Storage Run or contract versions that produced the suggestion. User-facing UI should present this subtly, such as in history or metadata rather than as a persistent warning. Upgrade provenance and old versions should not be stored in a way that bloats hot Knowledge Entry records or slows normal reads; after an appropriate retention window, older versions may be archived into colder history or audit storage while preserving enough summary provenance to explain the upgrade.

Archived old versions should remain governed by the affected entry's Visibility Scope and relevant role checks. A user who can view the current entry may see subtle summary provenance such as "upgraded from Words," but full old-version contents should be visible only to users who could view the relevant entry/version under its scope or to current authorized maintainers for that scope.

Dataset-wide Reprocessing is descriptive product language, not a new domain glossary term in the MVP. If the implementation later needs a persisted batch object for scheduling, progress, retries, or audit, it may introduce a product or implementation concept such as a Reprocessing Pass without changing the core domain term Reprocessing.

Source is not an MVP Knowledge Type. A Source belongs to the Bronze Layer as raw submitted material and can produce Knowledge Entries, but it should not itself be treated as represented knowledge in the Gold Layer.

Media formats such as audio, video, image, and file are not MVP Knowledge Types. They belong to Sources, attachments, or representations of Knowledge Entries. For example, a Sermon may be represented by audio, video, transcript, or notes, but its Knowledge Type remains Sermon.

Long-form or rich editable content belongs to Entry Representations rather than to type-specific detail rows. Words has no separate type detail table; its full content is represented through an Entry Representation while Knowledge Entries retain the bounded text needed for cards and search.

## Knowledge Slots

A Knowledge Slot is a predefined request for one Knowledge Entry of a specified Knowledge Type within a specified Knowledge Context. It is the app's way to request future Answers from users.

A saved Question should not automatically create a Knowledge Slot. The Question records a durable question and can define a narrower Knowledge Context; a Knowledge Slot is created only when a user intentionally requests a future Answer from a user, group, organization, network, or open audience.

Examples:

- A teacher assigns an essay on `Pride and Prejudice, book`; each student receives a Knowledge Slot for an Essay entry in that Knowledge Context.
- A user creates an Event entry and invites people to fulfill RSVP slots.
- A Knowledge Request maps to a Knowledge Context with no existing Answers; the user creates a Knowledge Slot directed to an expert, a group, an organization network, or an open audience until an Answer is contributed.

Knowledge Slot Fulfillment is the act or resulting state of satisfying a Knowledge Slot by contributing the requested Knowledge Entry.

The MVP should classify calls to action generically as Knowledge Slots rather than adding an Assignment Knowledge Type. For example, a teacher assigning an Essay, a user requesting an expert Answer, or an Event asking for RSVP entries are all Knowledge Slots requesting future Knowledge Entries within specified Knowledge Contexts.

Task and Todo are not MVP Knowledge Types. Calls to action that request future Knowledge Entries should be represented as Knowledge Slots; tasks that do not request knowledge are outside the MVP.

Question is an MVP Knowledge Type because questions provide valuable information about which parts of a Knowledge Context need to be connected. A user may ask a transient Knowledge Request, but a Question can also be represented as a Knowledge Entry within the Knowledge Context it maps to, helping reveal the shape of the Question Space.

Question Referent identity should be based on normalized question text plus Knowledge Context rather than question text alone. The same wording can ask meaningfully different things in different contexts, such as a general theology context versus a specific Bible Passage or Lesson context. Duplicate checks should compare normalized wording, active Tags, Visibility Scope, and Referent Identity Scope, then suggest possible existing Questions for review rather than silently merging them.

A minimum valid Question entry should require the shared Knowledge Entry shape plus `questionText`. The question text should be the primary title-like input and should supply the durable identity together with the Question's Knowledge Context. Optional body text or details may clarify the Question, but a Question should not require an Answer, assignee, due date, or Knowledge Slot.

Question should be weight-bearing with an informative Human Weight Expectation by default. A Question can express human judgment, attention, and framing, but low Human Weight should not usually be a concern by itself. Human Weight should credit the contributor or known asker of the Question, while Knowledge Entries contributed as Answers within that Question's Knowledge Context retain their own separate Human Weight.

Question should be exportable. A Question export should include question text, optional details, Knowledge Context Tags, metadata, and optionally visible Answer Feed or Answer metadata. Exporting full Answer contents should be explicit and should include only Answers that are visible to the exporting User and exportable under each Answer entry's own Export Behavior.

Question Template should be deferred as a Knowledge Type. Reusable request or slot templates introduce authoring and reuse behavior beyond the MVP.

Template is not an MVP Knowledge Type. Templates are reusable authoring structures for creating other entries, questions, slots, lessons, or related workflows.

## Visibility

Visibility Scope belongs to Knowledge Entries. A Knowledge Entry may be visible to one user, an organization, a group, a network of organizations, or everyone.

Contribution defaults should favor organization visibility rather than public visibility. When a Contribution happens from an Organization Page or another unambiguous organization-scoped context, the default Visibility Scope should be that organization. When the User is on the Dashboard or outside any organization-scoped context, the default should be all Organizations the User belongs to if Active Role is unset, or the Organization corresponding to the selected Active Role when one is selected. The composer should always allow the User to explicitly choose the Visibility Scope for the entry.

Visibility defaults and role authority are separate. The current Organization Page may supply an organization Visibility Scope even when the User has not chosen among multiple Roles in that Organization, but any role-specific edit, send, review, or administrative action should require an explicit Active Role.

Visibility Scope and Delivery Target are separate. Visibility Scope controls who may access a Knowledge Entry after it exists; Delivery Target controls who should be notified, assigned, messaged, or otherwise sent a contribution or action. Sending an entry to a group does not by itself define every user who may access the entry, and making an entry visible to an organization does not require notifying every member of that organization.

The composer may capture intended Delivery Targets at submission time, but normal delivery should occur after Gold Layer acceptance. Sending pending raw or Silver material before acceptance should be an explicit review workflow action, not the default Delivery Target behavior. After Gold acceptance, authorized Users should also be able to send or re-send the Knowledge Entry to Users, Groups, Organizations, or other Delivery Targets.

Delivery must validate access against the Knowledge Entry's Visibility Scope. Sending to a Delivery Target should not silently expand visibility; if recipients cannot access the entry, the app should require an explicit authorized Visibility Scope change or block delivery to those recipients.

Review Scope and Visibility Scope are separate. Review Scope controls who may see or manage pending Bronze and Silver material before Gold Layer knowledge exists, while Visibility Scope controls who may access the accepted Knowledge Entry afterward.

When a workflow has explicit reviewer Roles, Review Scope should default narrower than intended Visibility Scope. When no reviewer Role exists, Review Scope should still include the submitting User and any authorized organization or scope maintainers rather than broad-delivering pending material to the eventual audience by default.

"Send to page" should not be used as product or domain language. If a User intends an entry to appear in relation to a Knowledge Page, the entry should reference the relevant Tag through its Knowledge Context. Delivery is reserved for notifying, assigning, or messaging actual recipient targets.

Tags and Referents become visible indirectly through visible Knowledge Entries that represent or reference them. The Global Knowledge Context is not the same thing as global visibility: an entry can be visible to everyone without belonging to the Global Knowledge Context.

Tags do not grant access. A Knowledge Entry may reference an Organization, Group, Person, Place, Topic, Bible Passage, or other Referent through its Knowledge Context without becoming visible to users associated with that Referent. Visibility Scope remains the access boundary.

Canonical Referent matching may reveal that a same-typed Referent already exists, but it must not leak hidden Knowledge Entry details beyond safe identity and discoverability fields. A User may be told that a matching Referent exists and may be allowed to reference its canonical Tag, while the represented Knowledge Entry's protected content, representations, provenance, and edit actions remain governed by Visibility Scope and permissions.

Composer tag entry may feel freeform, but stored Tags must resolve to canonical Referents. Before submission or acceptance, a typed tag should either match an existing Tag/Referent or be confirmed as a proposed new Referent with a Knowledge Type; unresolved local labels should not be stored as Tags.

Composer tag suggestions should distinguish current-context Tags, deterministic recommendations, and Smart Storage recommendations. Current-context Tags come from the active Knowledge Navigator or current Knowledge Page; deterministic recommendations come from user or organization Recognized Context, recent use, pinned pages, memberships, selected Knowledge Type, and visible submission metadata; Smart Storage recommendations come from AI-assisted analysis of Sources or enrichment and should remain reviewable before they affect Gold Layer knowledge.

Current-context Tags should be selected by default for ordinary Contributions, but the User may remove them before submission when the entry does not actually belong in that Knowledge Context. Knowledge Slot Fulfillment is different: Slot Tags are the frozen Knowledge Context for the requested entry and should remain locked unless a future workflow explicitly allows changing the Slot's context.

Entry-adjacent actions should remain workflow, user, or delivery state rather than core Knowledge Entry fields. Copy link should copy a link to the Knowledge Page for the Knowledge Entry's Represented Referent by default, not to an implementation-specific entry record URL; Knowledge Type behavior may define exceptions such as Comment. Mark as read should mark a Notification as no longer new. Done should mark a Knowledge Slot as fulfilled. Reply should create a Comment Knowledge Entry or fulfill a response Slot. Send as email, SMS, or DM should create delivery records against Delivery Targets and channel-specific delivery behavior.

## MVP Direction

The MVP Knowledge Type set is locked as: Words, Announcement, Bible Passage, Topic, Series, Question, Quote, Sermon, Essay, Poem, Song, Book, Short Story, Lesson, Comment, Prayer Request, Event, RSVP, Person, Organization, Group, and Place. New Knowledge Types should be deferred unless they prove required for one of the MVP loops.

Bible Passage is an MVP Knowledge Type for Referents and Tags, but it is not an authorable Knowledge Entry type in the MVP. Scripture text belongs to the Bible structure and Bible verse text tables, while user-created entries such as notes, sermons, lessons, comments, or questions reference Bible Passage Tags in their Knowledge Context.

Bible Passage Referent identity should be based on normalized canonical passage structure rather than citation-string formatting or translation wording. A passage's canonical key should derive from its versification and normalized range set, including book order, chapter and verse positions, and any intentionally combined ranges. Citation variants such as `John 3:16`, `Jn. 3.16`, and a translation-qualified label such as `John 3:16 KJV` should resolve to the same Bible Passage Referent when they point to the same canonical passage; the translation text belongs to Bible Translation and verse text data rather than to Bible Passage identity.

The Contribution Editor should not offer Bible Passage as an authorable Knowledge Type in the MVP. User-authored material about Scripture should be contributed as another Knowledge Type with Bible Passage Tags in its Knowledge Context, while seeded Scripture structure and vetted verse text remain outside Gold Layer authoring.

Bible Passage Referent Pages should visibly present Scripture with full Soul rating attributed to God alone. That rating belongs to Scripture itself and does not become Human Weight Evidence for a translation, seed source, User, or user-authored Knowledge Entry that references the passage.

Bible Passage should be exportable with translation-rights boundaries. Export may include canonical citation, normalized passage ranges, canonical structure, links, Tags, and Knowledge Context metadata. Verse text should be included only for Bible Translations the application is allowed to provide, such as public-domain or properly licensed text. User-authored Knowledge Entries tagged to the passage should export under their own Knowledge Type rules rather than as part of the Bible Passage Referent itself.

Bible Passage Referent Pages should be Scripture-first pages rather than generic overview pages. They should present the passage text prominently when verse text is available, with compact controls for translation selection, passage range or citation display, copy or export, and cross-reference or context actions. They should not show a generic Bible Passage Overview module by default. The normal Answer Feed should remain available for Sermons, Lessons, Questions, Quotes, Comments, and other Knowledge Entries tagged to the passage.

Bible Passage Referents should not have human Roles in the MVP. God alone is credited for Scripture's full Soul rating. Human relationships such as translator, editor, or publisher belong to Bible Translation metadata, while preacher, teacher, quoter, commentator, and similar roles belong to Knowledge Entries that reference the passage.

Smart Storage should treat Bible Passage recognition as the highest-priority Tag recognition behavior. It should detect Scripture citations in Sources, normalize citation variants into Bible Passage Tags, support intentionally combined passage ranges, and preserve ambiguous citations for User review rather than guessing silently. Smart Storage should propose Bible Passage Tags, not Bible Passage Knowledge Entries; if a Source is mostly Scripture text, the review flow should still identify the user-authored Knowledge Type being contributed, such as Quote, Lesson, Sermon, Words, or Question.

When a Source mentions a specific Bible Passage, Smart Storage should tag the most specific recognized passage rather than also adding broader containing passages. For example, a mention of `Romans 8:28` should tag `Romans 8:28`; the `Romans 8` Referent Page can still surface that material through computed subset containment. Broader Bible Passage Tags should be added only when the Source intentionally references the broader passage itself.

Sermon Clip should be deferred unless a later workflow needs quote-like Type Behavior specifically for sermon media.

Essay, Poem, Song, Book, and Short Story are MVP Knowledge Types because churches and schools need to refer to named works precisely. Their initial Type Behavior can be mostly the same as Words: they are named wrappers that let the application distinguish similarly named Referents and present them with the right human meaning before richer type-specific behavior exists.

Hymn is not an MVP Knowledge Type. Hymns should be represented as Songs unless hymn-specific behavior becomes necessary later.

Liturgy should be deferred as a Knowledge Type. Liturgical content can begin as Words, Song, Bible Passage, Event context, or Series depending on its shape until worship-service behavior becomes first-class.

Sacrament and Ordinance should be deferred as Knowledge Types. In the MVP, baptism or communion services can be Events, while theology of sacraments or ordinances can be Topics.

Offering and Donation should be deferred as Knowledge Types. They imply payments, finance, receipts, stewardship records, and sensitive permissions beyond the MVP.

Reading Plan should be deferred as a separate Knowledge Type. In the MVP, a reading plan can be represented as a Series of Bible Passages, Books, Lessons, and Knowledge Slots until scheduling or progress behavior becomes distinct.

Series Referent identity should be based on title plus intended sequence context rather than title alone. Many Series are local to a User, Organization, Group, class, sermon arc, or ministry rhythm, such as `Romans Study` or `Fall Apologetics`; these should default to scoped Referent Identity Scope. Public or published Series may use broader identity scope when Smart Storage or the User identifies them as public works or widely recognizable collections. Duplicate checks should compare title, Referent Identity Scope, and series kind or purpose when available.

A minimum valid Series entry should require the shared Knowledge Entry shape and may begin with zero members when it represents a planned sequence. Series membership should grow through ordered `seriesItems` that can point to existing Knowledge Entries, Tags, or Knowledge Slots, so a Series can contain completed items, referential waypoints, and requested future entries. A Series should not require every member Knowledge Entry to exist at creation time.

Series should be weight-bearing with an informative Human Weight Expectation by default. A Series can express human judgment through selection, sequencing, and framing, but low Human Weight should not usually be a concern by itself. Human Weight for the Series should credit the contributor or curator of the Series, while member Knowledge Entries retain their own separate Human Weight.

Series should be exportable. A Series export should include Series metadata, overview or Entry Representations, ordered member list, labels, positions, and visible member metadata. Exporting full member contents should be explicit and should include only members that are both visible to the exporting User and exportable under the member's own Export Behavior.

Series Knowledge Pages should include a page-specific ordered sequence module. The module should show members in order, support empty or planned items, identify whether each item is an existing Knowledge Entry, Tag, or Knowledge Slot, and allow authorized Users to add, reorder, remove, or fulfill members. The shared Knowledge Page Shell and Answer Feed should remain available, but the ordered sequence is the distinctive Series page content.

Series should not define type-specific Person Roles in the MVP. Contributor or curator can be represented through shared entry metadata, permissions, and Membership context. Public author, editor, or publisher roles for Series should wait until a concrete published-Series workflow needs attribution beyond normal contribution and curation.

Smart Storage should recognize Sources that describe a sequence, plan, curriculum arc, reading plan, sermon series, lesson series, or ordered list, and may propose a Series with ordered `seriesItems`. Acceptance should remain explicit because a Series can create durable relationships to entries, Tags, or Knowledge Slots. Smart Storage should not automatically convert every numbered or bulleted list into a Series without clear sequence intent and User confirmation.

Progress is not a Knowledge Type. Progress is state on a User's relationship to a Knowledge Slot, Lesson, Series, future Reading Plan, or future Assessment.

Plan is not an MVP Knowledge Type. Lesson, Series, Event, and future Reading Plan cover the concrete planning concepts; a generic Plan type would be too broad.

Article should be deferred from the MVP. It may become another named wrapper over Words later, but Essay, Book, Quote, and Words are enough until a day-one workflow needs Article identity.

Artifact should be deferred from the MVP. It is too broad for day one and risks becoming another catch-all unless a concrete workflow needs object or resource behavior that the required Knowledge Types cannot express.

Comment is an MVP Knowledge Type because the core loop needs relational response behavior. A Comment may contain Words-like content, but it is born as a response to another Knowledge Entry and can support threaded discussion, correction, or contribution underneath an existing Answer.

Prayer Request is an MVP Knowledge Type because prayer is a first-class church and family workflow. The MVP should support Prayer Requests with appropriate visibility and response behavior while reserving advanced pastoral-care workflows for later.

Testimony should be deferred as a Knowledge Type. Testimonies can begin as Words or Essay-like entries until testimony-specific visibility, attribution, liturgical, or pastoral behavior is needed.

Devotional should be deferred as a Knowledge Type. Devotional content can begin as Words, Essay, Lesson, or Sermon depending on its shape until devotional-specific behavior is needed.

Confession and Catechism should be deferred as Knowledge Types. In the MVP, they can be represented as Book or Series entries, with doctrines represented as Topics, until structured doctrinal-standard behavior is needed.

Assessment, Quiz, and Test should be Phase 2 Knowledge Types. They require education-specific behavior such as grading, attempts, scoring, due dates, and feedback that is beyond the MVP loop.

Grade and Score are not Knowledge Types. They are attributes or results attached to assessment behavior.

Standard and Learning Objective should be Phase 2 Knowledge Types. In the MVP, Topic, Lesson, Series, and Knowledge Slots should cover the basic school workflow until richer curriculum and assessment behavior is added.

Rubric should be a Phase 2 Knowledge Type. Rubrics belong with assessment and grading behavior; MVP feedback can use Comments and Knowledge Slots.

Term, Semester, and School Year are not Knowledge Types. They are time or calendar grouping attributes for Events, Lessons, Groups, Series, or future Courses.

Grade Level is not a Knowledge Type. It is an attribute of a Group, Lesson, Series, future Course, or student context.

Event and RSVP are MVP Knowledge Types because some Knowledge Entries are connected to scheduled real-world activity, such as lessons, classes, services, or gatherings. The MVP should support basic scheduling and invitation responses while reserving advanced scheduling behavior for later.

Service and Worship Service are not MVP Knowledge Types. They should be represented as Events until worship-specific behavior such as liturgy, sermon linkage, music setlists, attendance, sacraments, or recurring-service behavior becomes necessary.

Meeting is not an MVP Knowledge Type. Meetings should be represented as Events until meeting-specific behavior such as agendas, minutes, decisions, action items, or quorum becomes necessary.

Decision should be deferred as a Knowledge Type. Decisions can begin as Words or Comments attached to an Event or meeting context until governance behavior becomes first-class.

Policy should be deferred as a Knowledge Type. Policies can begin as Words or Book-like entries until authority, effective dates, approval, versioning, or compliance behavior becomes first-class.

Procedure and Checklist should be deferred as Knowledge Types. They can begin as Words or Lesson-like entries until step, order, or completion behavior becomes first-class.

Form should be deferred as a Knowledge Type. Forms imply fields, submissions, validation, permissions, and workflow behavior beyond the MVP.

Report should be deferred as a Knowledge Type. Reports can begin as Words or Essay-like entries, or as views over other entries, until reporting behavior becomes first-class.

Reflection and Journal Entry should be deferred as Knowledge Types. Personal reflections can begin as Words or Essay-like entries with appropriate visibility until journaling behavior becomes first-class.

Biography should be deferred as a Knowledge Type. Biographical content can be represented as a Book, Essay, or Words entry tagged to a Person until life-history behavior becomes distinct.

Invitation is not an MVP Knowledge Type. An Event can create RSVP Knowledge Slots directed to People, Groups, or Organizations; the RSVP is the contributed response, while the invitation itself is workflow or message state.

Attendance is not an MVP Knowledge Type. Actual attendance can be represented later as participation state tied to a Person or User and an Event, while RSVP remains the MVP Knowledge Type for invitation responses.

Calendar is not a Knowledge Type. Calendar is a view composed of Event-based Knowledge Entries and related scheduled entries such as Lessons or RSVP slots.

Notification is not a Knowledge Type. Notifications are reactions to existing Knowledge Entries or requests for users to create future Knowledge Entries through Knowledge Slots.

Reaction is not a Knowledge Type. Reactions are interaction state attached to Knowledge Entries or Comments.

Bookmark is not a Knowledge Type. Bookmark is a User relationship to a Knowledge Page that saves it for later reference without sidebar placement or notification behavior. Bookmarks may inform user-specific tagging recommendations and Knowledge Context recommendations because they record Knowledge Pages the user has intentionally brought into relationship with their activity.

Pinning is not a Knowledge Type. Pinning is a User relationship to a Knowledge Page that keeps it easy to return to through navigation, while Subscription separately controls notification behavior.

Subscription is not a Knowledge Type. A subscription is a User relationship to a Referent Page, Context Page, Tag, Knowledge Entry, Group, Event, or Organization that affects notification behavior.

Dashboard, Referent Page, and Context Page are not Knowledge Types. They are user-facing places or views determined by the number of active Tags in the Knowledge Navigator.

Knowledge Context is not a Knowledge Type. It is the set of Tags that locates Knowledge Entries and Knowledge Requests.

Visibility Scope is not a Knowledge Type. It is access or audience metadata on a Knowledge Entry.

Lesson is an MVP Knowledge Type because schools and church classes need planned teaching material that can be connected to Events. The user experience should feel like working with a lesson plan, but the canonical Knowledge Type is Lesson. A reusable Lesson may be connected to many scheduled uses over time, such as teaching the same lesson in different years.

Person is an MVP Knowledge Type because churches and schools need to reference authors, teachers, students, speakers, invitees, commenters, and other participants. Every User must be linked to exactly one Person Knowledge Entry so the User can be tagged through that Person, but Person and User are not the same thing. For example, C.S. Lewis can be a Person who authored a Book without ever being a User, while a student is both a User and the Person who authored an Essay.

Account is not a Knowledge Type. Account is authentication and access infrastructure for a User.

User is not a Knowledge Type. User is the account or access identity that must link to a Person Knowledge Entry; Person is the Knowledge Type.

Profile is not a Knowledge Type. A profile is a view or presentation of a Person, User, Organization, Group, or related referent.

Character is not an MVP Knowledge Type. Fictional characters should be represented as Person Referents in the MVP, with a later split only if fictional-person behavior becomes necessary.

Bible Character and Biblical Figure are not MVP Knowledge Types. Biblical people should be represented as Person Referents.

Role is not an MVP Knowledge Type. A Role is the capacity in which a Person relates to a Referent, Knowledge Entry, Knowledge Slot, Membership, Organization, Group, or other domain object, such as author of a Book, speaker for a Sermon, student in a Group, parent in a Family, invitee to an Event, or administrator through a Membership.

Author is not an MVP Knowledge Type. Author is a Role for the Person occupying an authorship relationship to a Book, Essay, Poem, Song, Short Story, Quote, or other Knowledge Entry. Authorship is the relationship or fact that the Person authored the Referent or Knowledge Entry; Contributor remains the User who added or submitted it to the app.

Speaker, Preacher, Teacher, and Student are not MVP Knowledge Types. They are Roles of a Person in relation to a Sermon, Lesson, Event, Group, Organization, Knowledge Slot, Membership, or other Knowledge Entry.

The MVP should use direct type-detail fields for known single-person relationships, such as a quoted person on a Quote or a respondent on an RSVP. A separate cross-type Person-role table should be deferred until the first UI or query needs role-based search across Knowledge Types.

Denomination should be deferred as a Knowledge Type. It may begin as an Organization attribute or Topic and can become a Knowledge Type later if denominational affiliation needs first-class discovery, visibility, or trust behavior.

Ministry is not an MVP Knowledge Type. A ministry may be represented as a Group, Organization-related body, Topic, Series, or Event context depending on how it is used, until distinct ministry behavior is needed.

Organization is an MVP Knowledge Type, but the MVP should understand only four Organization kinds: School, Church, Family, and Community. To use the app, a User must be a member of at least one Organization, and initial signup must associate the User's Person with a School or Church. Users can also be grouped into Families and can specify a hometown to become a de facto member of a Community. Deeper organization networks, permissions, and membership workflows should be reserved for later.

Network should be a Phase 2 Knowledge Type or organization capability. In the MVP, Organization plus Visibility Scope is enough; named networks of organizations can be added when cross-organization behavior becomes first-class.

Group is an MVP Knowledge Type for a collection of People, not a collection of Users. Since every User links to a Person, user-based participation can still be represented through Person membership, while Groups can also include people who are not application Users. Group should cover informal or temporary collections such as classes, teams, committees, or volunteer cohorts without forcing them to become Organizations.

Groups can receive Knowledge Slots, but Knowledge Slot Fulfillment is performed by Users. When a Knowledge Slot is directed to a Group, the expected fulfillers are Users linked to People in that Group. People who are not linked to Users can still belong to Groups as historical or referential members, but they cannot perform user actions until linked to an account.

Membership is not an MVP Knowledge Type. It is the relationship between a Person and a Group or Organization, with user actions performed through a linked User when one exists. A Membership may have a Membership Role, but the Membership itself is the durable relationship.

Place is an MVP Knowledge Type because Community depends on hometown or place-based association, and Events often need locations. The MVP should keep Place narrow: enough to represent hometowns, event locations, and organization locations, without becoming a full geography model.

Map is not a Knowledge Type. A map is a view or representation over Places, Organizations, Events, and Communities.

Address is not a Knowledge Type. Address is an attribute or locator for a Place, Organization, or Event.

Time and Date are not Knowledge Types. They are scheduling attributes of Events and other scheduled entries.

The MVP should present Scripture references through one Knowledge Type: Bible Passage. Bible Passage can represent one verse, many verses, a chapter, a larger passage, or a set of passages across multiple books of the Bible. The application must understand subset relationships between Bible Passage Referents, such as `Matthew 24:1` being part of both `Matthew 24:1-25:46` and `Matthew 24:1-25:46; Mark 13:1-37; Luke 21:5-36`.

Bible Passage Referents and Tags are not created by users as Knowledge Entries. A user-created entry can reference a Bible Passage through its Tags, but the entry's Represented Referent should be a same-typed Referent such as Words, Sermon, Lesson, Question, Comment, or another authorable Knowledge Type.

Bible Passage identity should be based on normalized canonical verse ranges, not raw citation strings. User-entered or URL passage strings such as `Romans 8:28` or `Matthew 24:1-25:46; Mark 13:1-37; Luke 21:5-36` should be parsed into canonical locations that can support display, lookup, and subset checks. The MVP should assume a single 66-book Protestant versification for these canonical locations, with alternate canons or versification systems deferred until they become required.

Bible Passage range identity should sort ranges into canonical Bible order and merge overlapping or adjacent ranges. Different user-entered orderings or equivalent split ranges should resolve to the same Referent, while the original input may still be retained for display history or analytics.

The persisted canonical key for a Bible Passage should be based on normalized verse ordinal ranges, while human-readable labels should be generated from canonical structure. For example, an internal key may represent `23145-23145`, while the display label is `Romans 8:28`.

In the MVP, Bible Passage Referents should store their normalized range array inline, with a reasonable cap on passage-set size to avoid unbounded arrays. A separate range table should be deferred until the app needs very large passage sets or independent querying of range components.

Bible Passage subset and containment relationships should be computed dynamically from normalized verse ordinal ranges in the MVP. Persisted relationship rows should be deferred until the app needs curated relationship labels, manual cross-reference relationships, or proven performance improvements.

One Bible Passage Referent may contain multiple verse ranges across multiple books when the intended referent is the combined passage set. For example, `Matthew 24:1-25:46; Mark 13:1-37; Luke 21:5-36` can be one Referent for the Olivet Discourse across books. Adding another Scripture Tag through the Knowledge Navigator creates a multi-Tag Context Page for cross-reference or comparison, even if the first Tag already contains several Bible books internally.

The first Scripture seed should include Bible structure before translation text: books, chapters, verses, and canonical verse positions. Full translation text should be seeded only from a clearly licensed or public-domain source present in the repository. If a vetted KJV source is present, the first pass may seed KJV verse text; otherwise KJV should be represented as known translation metadata until a source is added.

The app should seed known Bible Translation metadata separately from verse text availability. The translation registry may include metadata-only entries for translations and source texts the app knows about, including English translations, Greek source texts, Hebrew source texts, and Latin texts, even when the application does not yet store their full verse text.

Bible Translation records should have internal database IDs for relationships and stable unique short codes for import, lookup, display, and migration. Examples include `KJV` for King James Version, `TR1894` for Scrivener's Textus Receptus, and `VULGATE` for Biblia Sacra Vulgata.

Bible verse structure and Bible verse text should be stored separately. Canonical verse records should identify the book, chapter, verse number, and verse position used for passage lookup. Translation-specific verse text records should point to a Bible Translation and a canonical verse, allowing structure to be seeded before any full translation text is available.

Verse is not an MVP Knowledge Type. A single verse is represented as a Bible Passage.

Bible Book is not an MVP Knowledge Type. A whole book of the Bible can be represented as a Bible Passage in the MVP.

Bible Story is not an MVP Knowledge Type. A Bible story can be represented by a Bible Passage, often with Topic, Series, or Lesson Tags.

Memory Verse is not an MVP Knowledge Type. The referent is a Bible Passage; memorization is a learning activity or call to action represented through a Knowledge Slot, Lesson, or later assessment behavior.

Scripture cross references are not a separate MVP Knowledge Type. They can be captured by tagging multiple Bible Passages in the same Knowledge Entry and by recognizing relationships between those Bible Passage Tags.

Translation is not an MVP Knowledge Type. A Bible Passage may have one or more translations or versions as attributes or representations, but the Knowledge Type remains Bible Passage.

Language is not an MVP Knowledge Type. It should be represented as an attribute of Sources, representations, Knowledge Entries, users, or other relevant records.

Tag is not a Knowledge Type. A Tag is the named, typed pointer to a Referent; it is part of the organizing mechanism rather than the thing being represented.

Knowledge Entry is not a Knowledge Type. A Knowledge Entry is the typed, contextualized unit that represents a Referent; the Knowledge Type describes what kind of Referent the entry represents.

Answer is not a Knowledge Type. Answer is a role a Knowledge Entry can play relative to a Knowledge Request or Question.

Prompt should not be used as a domain term or Knowledge Type. Use Knowledge Request for the user action, Question for a stored question, and Knowledge Slot for a call to contribute future knowledge.

Note is not an MVP Knowledge Type. Notes should enter as Words unless they are or become a more specific Knowledge Type such as Comment, Question, Essay, Quote, or Lesson.

Resource is not an MVP Knowledge Type. It is too broad and overlaps with Source, Artifact, Words, Book, Lesson, media formats, and attachments.

Link and URL are not MVP Knowledge Types. They are attributes or external representations of Knowledge Entries, since many Knowledge Entry contents may exist at external URLs.

Link Preview is not a Knowledge Type, Knowledge Entry, Factual Provenance, or Human Weight Evidence. It is fetched metadata that helps a user recognize an external URL in the composer, Source review, or Entry Representation UI. When Smart Storage uses information from a linked page or preview to propose facts, the external URL remains the provenance anchor.

External URL Sources should always preserve the submitted URL. Fetched Link Preview metadata may be stored to help the User recognize the URL, but fetched page text, transcripts, or excerpts should be snapshotted only when the app retrieves or uses them for Smart Storage, enrichment, or review. Full remote media copies should not be the default; for large media such as YouTube, preserve the URL, provider metadata, and any transcript or extracted text actually retrieved.

Link Preview fetching should be backend-owned, such as through a Convex action, rather than performed in the browser. The client should submit the URL, and backend processing should fetch, normalize, timestamp, and store preview metadata and fetch status. Link Preview failure should not block preserving the external URL Source.

In the first implementation, Link Preview metadata for an external URL Source should live on the `sources` row as latest snapshot fields: `linkPreviewStatus`, `linkPreviewTitle`, `linkPreviewDescription`, `linkPreviewImageUrl`, `linkPreviewSiteName`, `linkPreviewFetchedAt`, and `linkPreviewError`. A separate Link Preview history table should wait until multiple fetch attempts or preview history become product requirements.

Work is not an MVP Knowledge Type. The MVP should use concrete Knowledge Types such as Book, Song, Poem, Essay, Short Story, Sermon, Lesson, and Quote rather than introducing an abstract Work type.

Citation and Reference are not MVP Knowledge Types. Quote is the Knowledge Type for cited excerpts; citation and reference details should be metadata or relationships to the Source, parent entry, Book, Bible Passage, or other relevant Referent.

Page, Chapter, and Section should be deferred as Knowledge Types. They are structural locations within a work and can be represented through references, ranges, Quotes, or relationships until structural navigation becomes first-class.

Announcement is an MVP Knowledge Type for organization-scoped informational notices that need broadcast, archive, and surfaced-audience behavior. Scheduled announcements that are primarily gatherings should still be Events, responses to another entry should still be Comments, and generic unscoped text should still be Words.

The MVP should prove the core loop:

- A user can Explore through a Knowledge Request mapped to a Knowledge Context.
- A user can Contribute from that same place.
- Smart Storage can preserve Sources and produce one or more Knowledge Entries.
- Knowledge Slots can request missing future Answers.

## Schema Invariants

These invariants are implied by the MVP domain model and `convex/schema.ts`. Convex validators and indexes document the shape, but most cross-document rules must be enforced in mutations, migrations, seed scripts, and tests.

### Referents and Tags

- A Referent is uniquely identified by `knowledgeType` and `canonicalKey`.
- A Referent's `knowledgeType` must match the type of the thing it identifies.
- A Tag is canonical to exactly one Referent through `referentId`.
- A Referent should have at most one canonical Tag.
- A Tag's `knowledgeType` must match its Referent's `knowledgeType`.
- Tag `lookupKey` values should be normalized consistently before lookup or insert.
- Tag aliases must point to canonical Tags, not create local duplicate Tags.
- A tag alias's `knowledgeType` must match the referenced Tag's `knowledgeType`.
- User and organization recognition of a Tag belongs in `tagRecognitions`, not in duplicate Tags.
- A `tagRecognitions` row must identify exactly one recognizer: either a User or an Organization.

### Knowledge Entries

- A Knowledge Entry represents exactly one Referent through `representedReferentId`.
- A Referent may have at most one Knowledge Entry representing it.
- A Knowledge Entry's `knowledgeType` must match its represented Referent's `knowledgeType`.
- Knowledge Entry creation should create a new Represented Referent and canonical Tag when the intended Referent is not already known by the application.
- When the intended same-typed Referent is already a Known Referent, the app should not create a Knowledge Entry merely to represent it; it should guide the user toward tagging that Known Referent, editing or updating an existing represented entry when one exists and permissions allow, or creating a distinct Referent only when the user confirms the identity is different.
- User-facing contribution and Smart Storage flows must not create bare Referents without accepted Knowledge Entries; bare Known Referents belong to system, admin, import, account, domain-infrastructure, or Scripture-specific flows.
- Most Knowledge Page edits should affect the represented Knowledge Entry or related entry data; Referent identity edits should be special permissioned operations for identity correction, aliasing, merge/split, or Type Reclassification.
- Duplicate Referent checks must use Knowledge Type-specific identity fields defined by Type Behavior, not a universal title-only match.
- Duplicate Referent checks must respect Referent Identity Scope, so public works can be matched globally while organization-, group-, or user-scoped works remain local unless intentionally published or shared more broadly.
- Smart Storage may flag possible duplicate Referents, but Referent merge or split must be handled by a separate permissioned review workflow.
- `knowledgeEntries.knowledgeType` must never be `biblePassage` in the MVP.
- `primaryTagId` must point to the canonical Tag for `representedReferentId`.
- Each Knowledge Entry must have exactly one `entryTags` row with `tagPurpose: "represented"`.
- The represented `entryTags` row must use the same Tag as `primaryTagId`.
- All other Knowledge Context Tags for an entry should use `tagPurpose: "context"`.
- `contextPreviewTagLabels` is denormalized card data and must stay bounded.
- `searchText`, `previewText`, and `publicPreviewText` must stay bounded enough for card/search use.
- Long or rich content must live in `entryRepresentations`, not directly on `knowledgeEntries`.
- `humanWeight`, when present, should stay within the product scale of 0 through 100.
- `createdAt` should be set once; `updatedAt` should move forward when entry-visible data changes.
- Discoverability and visibility are separate: a public preview may exist without read access to the full entry.
- When `publicPreviewText` is exposed through discovery, it must be safe to show to that discoverability audience.

### Type Detail Tables

- Words has no one-to-one detail table; the common `knowledgeEntries` row is the Words-level shape.
- Bible Passage has no authorable detail table in the MVP.
- Every non-Words authorable Knowledge Type should have at most one matching type-detail row.
- A type-detail row's `entryId` must point to a Knowledge Entry of the matching `knowledgeType`.
- Empty-ish detail tables with only `entryId` are acceptable until a type has real MVP-specific fields.
- `commentEntries.parentEntryId` must point to the entry being answered or discussed.
- A Comment should not use itself as its parent.
- A Comment's represented Referent identity should be generated from stable relational facts, such as parent Knowledge Entry, commenting Person Referent, and generated uniqueness, not from user-authored body text.
- Comment UI should not ask for a title; any stored title or display label should be generated from the parent entry while the body or preview text carries the comment substance.
- `quoteEntries.quotedPersonReferentId`, when present, must point to a Person Referent.
- `quoteEntries.sourceEntryId`, when present, must point to the larger entry/source represented by the Quote.
- `eventEntries.locationPlaceReferentId`, when present, must point to a Place Referent.
- Event times should be coherent: `endsAt`, when present, should not be earlier than `startsAt`.
- `rsvpEntries.eventEntryId` must point to an Event Knowledge Entry.
- `rsvpEntries.personReferentId` must point to a Person Referent.
- An RSVP should be unique per Event and Person unless the product later supports response history.
- `organizationEntries.organizationKind` must be one of School, Church, Family, or Community.
- An Organization requires a name and Organization kind in the MVP. Place, address, website, members, and parent relationships are optional enrichment unless a later Type Behavior makes one required for a specific Organization kind.
- In general, Person, Group, Place, and similar world-modeling Knowledge Types should require only a name to establish their initial represented Referent identity. Additional details such as membership, address, relationships, roles, contact information, or biographical facts should be optional enrichment unless the Type Behavior requires a specific discriminator to create a valid entry.
- A Person can be validly created before role, organization membership, user-account linkage, email, or family relationships are known. Smart Storage should ask follow-up questions only when needed to resolve plausible identity ambiguity or optional enrichment.
- A Place can be validly created from a name alone. Address, locality, region, country, and geographic precision are optional enrichment unless needed to distinguish between plausible matching Places.

### Entry Representations and Sources

- An Entry Representation belongs to exactly one Knowledge Entry.
- A Knowledge Entry should have at most one primary representation per representation need.
- Type Behavior should define default Primary Representation selection, with user override during proposal review when multiple representations are valid.
- Representation Role should not replace explicit Primary Representation selection.
- Type Behavior should define allowed or default Representation Roles for each Knowledge Type, while Smart Storage may infer roles and the User may correct them during proposal review.
- `entryRepresentations.representationRole` should be required, using `unspecified` when the role is not yet known. Type Behavior may require a more specific Representation Role for workflows where `unspecified` is not acceptable.
- Representation Role should use a small closed shared enum in persistence, while Type Behavior defines which roles are allowed or default for each Knowledge Type.
- The initial Representation Role enum should be `unspecified`, `primaryContent`, `manuscript`, `slides`, `transcript`, `recording`, `thumbnail`, and `supportingMaterial`.
- `prosemirrorDocumentId` remains an arbitrary string compatible with the collaborative editor.
- File, audio, video, URL, and plain text representations should use the fields matching their `representationKind`.
- A Source is Bronze Layer raw material, not a Knowledge Type and not a Knowledge Entry.
- A Contribution Submission may group multiple Sources under one user intent, such as typed substantive text, uploaded files, external URLs, audio, or video submitted together for one Lesson, Sermon, or other intended Knowledge Entry.
- A durable Contribution Submission is required for multi-Source, Smart Storage, import, upload, deferred review, retry, or Reprocessing workflows, but not for simple direct posts that create Gold Layer Knowledge Entries immediately.
- The first `contributionSubmissions` table should include `submittedByUserId`, `submissionStatus`, `primaryIntendedKnowledgeType`, `primaryIntendedTitle`, `primaryIntendedBodyPreview`, `contributionNote`, `intendedVisibilityKind`, `intendedVisibilityTargetKey`, `reviewScopeKind`, `reviewScopeTargetKey`, `createdAt`, and `updatedAt`. Draft sessions, delivery channels, and denormalized child lists should stay out of the first schema slice.
- The initial Contribution Submission status enum should be `submitted`, `processing`, `reviewReady`, `partiallyAccepted`, `accepted`, `rejected`, and `cancelled`. Submission status describes the parent lifecycle and should not replace Smart Storage Run status or Smart Storage Proposal status.
- Review Scope should use its own schema enum, initially `private`, `organization`, `group`, and `public`, rather than reusing the Visibility Scope validator. The matching initial values do not make Review Scope and Visibility Scope interchangeable.
- `reviewScopeTargetKey` should use the same string-key storage style as `visibilityTargetKey` in the first implementation, with backend validation that the key format matches `reviewScopeKind`.
- The first Smart Storage implementation should persist Contribution Submissions as parent rows and persist Sources as child rows linked to the Contribution Submission. Standalone Sources should not remain the main Smart Storage grouping model.
- `sources.contributionSubmissionId` may be optional in the first schema change for migration compatibility, but new durable Contribution Submission and Smart Storage mutation paths must provide it.
- Uploaded file Sources should reference Convex storage IDs and metadata after storage succeeds; contribution mutations should not carry file bytes.
- Uploaded files should remain preserved Bronze Sources after successful storage even if extraction, preview, transcription, or Smart Storage analysis fails.
- External URL Sources should always preserve the submitted URL, while fetched content or transcripts should be snapshotted when retrieved or used so Smart Storage review remains explainable after link drift.
- Each Contribution Submission should have one Primary Intended Entry, while Smart Storage may propose additional derived Knowledge Entries from the same Sources.
- Multiple Smart Storage Proposals from one Contribution Submission should be accepted one proposed Knowledge Entry at a time.
- Sources are submission-level raw material; Smart Storage Proposals should cite the specific Sources, excerpts, ranges, or URLs that support them.
- Source citations for Smart Storage Proposals should be stored as child rows, not as an unbounded array on the proposal document.
- The first `proposalSourceCitations` table should include `proposalId`, `sourceId`, `citationKind`, `excerptText`, `locator`, `externalUrl`, `rationale`, and `createdAt`. The initial citation kind enum should be `wholeSource`, `textExcerpt`, `fileLocator`, and `externalUrl`; `excerptText` should be bounded and optional.
- Shared Source provenance may indicate that entries are related, but the app should not create a generic `relatedTo` Gold Layer relationship; explicit relationships should be typed, Tag-based, or introduced through later Knowledge Type behavior.
- Accepted proposals should explicitly decide which submitted Sources become Entry Representations; Bronze Sources should not automatically become Gold Layer representations.
- A Source created for later Smart Storage or Reprocessing of a directly created Knowledge Entry is a snapshot of that entry's current representation at the time of reprocessing, not the original raw direct-post submission.
- A Source may produce many Knowledge Entries through `sourceOutputs`.
- A `sourceOutputs` row must point to an existing Source and an existing produced or derived Knowledge Entry.
- In Smart Storage, Bronze Layer maps to Sources, Silver Layer maps to Smart Storage Proposals, and Gold Layer maps to confirmed Knowledge Entries.
- Smart Storage should not run automatically for every Contribution; direct posting should create the Knowledge Entry currently displayed to the user when that path is selected, without creating a Bronze Layer Source by default.
- Contribution Preview should use deterministic application logic, not an LLM, to show the proposed Knowledge Type, Knowledge Context, and visible entry attributes before the user submits.
- Formal Silver Layer records are required for Smart Storage Proposals because review, retry, and partial acceptance workflows need durable state between Bronze Sources and Gold Layer Knowledge Entries.
- Smart Storage Proposals should store contract-shaped domain data rather than raw Convex write payloads, and acceptance should translate validated proposals into the current persistence schema.
- Smart Storage Contracts and Type Behaviors must be versioned in the database as immutable content snapshots, and each Smart Storage Proposal should record the versions used to generate it.
- Type Behavior should be versioned as a whole per Knowledge Type, with field-level enrichment and provenance rules inside the immutable snapshot.
- Smart Storage Contract versions should contain stable reusable rules and templates; request-specific Source, context, candidate, and evidence input should be snapshotted separately with the enrichment run or proposal.
- Request-specific input snapshots should record what the LLM actually saw and link to the full Bronze Layer Source rather than duplicating raw Source content by default.
- Smart Storage Runs should link to the durable Contribution Submission and may also link to a primary Source when a run is centered on one submitted Source.
- Smart Storage Runs should preserve raw model output separately from parsed Smart Storage Proposals.
- Failed LLM calls, parse failures, and validation failures should be represented on Smart Storage Runs rather than by creating Smart Storage Proposals.
- Smart Storage Run status should track operational processing with queued, running, succeeded, no-proposal, failed, and superseded states, separate from Smart Storage Proposal review status.
- No-proposal Smart Storage Runs should be visible only as quiet Source/review state, not as Answers, Knowledge Slots, or proposal cards.
- Bronze Sources and Silver Smart Storage Proposals should stay out of the normal Answer Feed, but matched pending material may be shown on the relevant Referent Page for authorized review under the Contribution Submission or review scope.
- Smart Storage Proposals should link directly to their Contribution Submission as well as to their Smart Storage Run so review queries can load pending proposals by submission without hopping through runs. The backend must enforce that the Proposal and Run point to the same Contribution Submission.
- Smart Storage Proposal acceptance should validate against the original recorded Smart Storage Contract and Type Behavior versions unless those versions are marked incompatible or retired.
- Smart Storage Proposal acceptance must check Review Scope permission plus create, update, and Referent Identity Scope permissions for the Gold Layer result.
- Smart Storage Proposal records should preserve the original generated proposal separately from the current reviewed proposal.
- Accepting a Smart Storage Proposal should atomically create or connect the complete proposed Knowledge Entry shape; partial acceptance should be represented by editing, splitting, or rejecting proposals before acceptance.
- Smart Storage Proposal acceptance must perform the authoritative current identity check for Tags, Referents, and same-typed represented Knowledge Entries, regardless of matches proposed earlier.
- When an accepted proposal targets an existing Knowledge Entry, the backend must verify the User has permission to edit that entry before adding confirmed information to it.
- Smart Storage Proposal review should explicitly distinguish existing referenced Referents and Tags from new Referents and Tags that acceptance will create.
- Reprocessing proposals should explicitly distinguish edits to an existing Gold Layer Knowledge Entry from creation of additional Gold Layer Knowledge Entries.
- Smart Storage Contract or Type Behavior version changes may trigger dataset-wide Reprocessing to create suggested edits, Smart Storage Proposals, or Upgrade Candidates, but should not silently rewrite existing Gold Layer Knowledge Entries.
- Accepted Reprocessing edits should preserve explicit upgrade provenance without storing old versions on hot Knowledge Entry records in a way that harms normal read performance.
- Older upgrade versions may be archived after a retention window as long as enough summary provenance remains to explain the upgrade and locate audit history when authorized.
- Factual Provenance may be entry-level when one evidence trail supports the whole proposal, but enriched Factual Fields with distinct evidence should carry field-level provenance.
- Required Factual Provenance should be specified by the Smart Storage Contract and Knowledge Type Factual Field behavior rather than applied globally to every field.
- Proposal Confidence should be coarse review guidance for proposals or enriched Factual Fields, not Human Weight, truth, or a replacement for user confirmation.
- Low Proposal Confidence should warn but not universally block acceptance; contract validity, required field completion, required provenance, and identity resolution are the blocking conditions.
- Smart Storage Proposal status should distinguish review state from enrichment-run failures; failed LLM calls should belong to the run or retry state rather than to a proposal that may never have been created.

### Bible Passage and Scripture

- Bible Passage is a Referent and Tag Knowledge Type, but not an authorable Knowledge Entry type in the MVP.
- Bible Passage identity must be based on normalized verse ordinal ranges, not raw citation strings.
- Bible Passage ranges should be sorted in canonical Bible order.
- Overlapping or adjacent Bible Passage ranges should be merged before computing `canonicalKey`.
- Equivalent passage strings must resolve to the same Bible Passage Referent.
- Bible Passage range arrays must stay bounded; use a range table later if passage sets become large.
- Bible structure records identify canonical books, chapters, verses, and verse ordinals.
- Bible verse text is translation-specific and must stay separate from canonical verse structure.
- A `bibleVerseTexts` row must be unique for a translation and canonical verse.
- Translation text should only be seeded from a vetted source with acceptable licensing.
- Lazy Bible Passage navigation may record analytics for a normalized passage target before a persisted Tag or Referent exists.

### Users, People, Organizations, and Memberships

- User is authentication/access infrastructure, not a Knowledge Type.
- Every signed-up User must link to exactly one Person Referent and canonical Person Tag through `userProfiles`.
- Not every Person Referent has a User, and not every Person Referent has a Person Knowledge Entry.
- `userProfiles.personEntryId` is optional and should only point to a Person Knowledge Entry when one has actually been contributed.
- `userProfiles.personReferentId` must point to the Person Referent for the account identity.
- `userProfiles.personTagId` must be the canonical Tag for `personReferentId`.
- A User should have exactly one active `userProfiles` row.
- Profile-facing identity facts should belong to the linked Person Referent, an optional Person Knowledge Entry, or related world-model records, while account-only access settings should remain on User/auth/profile infrastructure.
- Account-created, sysadmin-seeded, and pending-membership people should be reference-only by default; creating those rows must not make them appear as Knowledge Entries in the Answer Feed.
- A Person may be a member of Organizations and Groups through `memberships`.
- `memberships.personReferentId` must point to a Person Referent.
- Organization member management should present active and Pending Memberships together as members, with status making unclaimed access clear rather than separating them into an invitation list.
- Adding a member by email may create the smallest valid Person placeholder and a Pending Membership; the email is Contact Identity evidence, not the Person's definitive identity.
- An email address is valid Contact Identity for Membership when it belongs to one actual Person, even if the address names a role such as `headofschool@...`; shared or rotating inboxes should not be used to establish a Person Membership.
- Adding the same Contact Identity to the same Organization more than once should update the existing Membership rather than creating duplicates; role, status, timestamps, and optional outreach state may change independently.
- A membership target must identify exactly one target matching `targetKind`.
- For `targetKind: "organization"`, `organizationReferentId` must be present and `groupReferentId` absent.
- For `targetKind: "group"`, `groupReferentId` must be present and `organizationReferentId` absent.
- Organization membership targets must point to Organization Referents.
- Group membership targets must point to Group Referents.
- When `memberUserId` is present, it should match the User linked to `personReferentId`.
- A Membership created before its Person has a linked User should not grant account access until the User proves they are that Person through verified contact identity.
- A User may claim Pending Memberships associated with multiple verified Contact Identities, such as separate personal, school, and church email addresses.
- Users should be able to add and verify alternate Contact Identities after signup; verified alternate Contact Identities should surface matching Pending Memberships for claim.
- Contact Identity has account and Person meanings that should remain distinct: on the User side it proves the signed-in account controls the contact value, while on the Person side it serves as identity/contact evidence for that human being.
- Claiming a Pending Membership for a different Contact Identity should attach the Membership to the User's single Person when the evidence is clear; ambiguous Person consolidation should route through identity review rather than silently merging Person Referents.
- A Membership Claim may automatically move a Pending Membership from a placeholder Person to the User's existing Person only when the placeholder has no meaningful identity beyond the verified Contact Identity and claimable Pending Memberships.
- If the placeholder Person has richer profile facts, conflicting names, authored entries, or other relationships, the app should require Person Consolidation review instead of silently moving or merging identity.
- A successful Membership Claim should make the Membership active immediately because the organization already created the Membership and the User has proven the matching Contact Identity.
- Memberships and claim history should preserve the Contact Identity evidence that created or claimed a Pending Membership even after activation, so organization admins can understand why a User with a different primary email has that Membership.
- Pending Memberships may be used for Person-targeted work such as Knowledge Slots or RSVP requests before the Person has a linked User, but User-only app behavior such as inbox notifications should wait until the Membership is claimed.
- Adding a Pending Membership should not depend on sending email. The Membership is the durable organization relationship; invitation email, reminder email, or other outreach should be optional delivery state that can fail, be skipped, or be retried without changing whether the Pending Membership exists.
- The implemented Pending Membership access flow covers admin creation and update of active and Pending Memberships, verified primary and alternate Contact Identity claims, Person Consolidation review for richer placeholders, claimant and admin review status handling, in-app review notifications, approved claim evidence in Organization Settings, and admin withdrawal of unclaimed Pending Memberships.
- Optional follow-ups include email outreach or resend delivery, bulk member import or withdrawal, active member removal, placeholder Person cleanup, and generic Person merge or split tooling.
- The onboarding rule that a User belongs to at least one Organization is required later, but not enforced by schema alone.
- A Group can be validly created before its full membership is known. Group membership should be optional enrichment rather than a blocking requirement for accepting a Group Smart Storage Proposal.

### Knowledge Slots

- A Knowledge Slot is a workflow request, not a Knowledge Type.
- Each Knowledge Slot requests exactly one Knowledge Entry type through `requestedKnowledgeType`.
- `requestedKnowledgeType` must be an authorable entry type, so it must never be `biblePassage`.
- Person-targeted Knowledge Slots may target a Person who is not yet linked to a User; Knowledge Slot Fulfillment becomes available once that Person is linked to a User through Membership Claim or another identity flow.
- Slot Tags are the frozen Knowledge Context for the requested entry.
- Knowledge Slot Fulfillment should point to at most one `fulfilledEntryId`.
- A fulfilled entry's `knowledgeType` must match the slot's `requestedKnowledgeType`.
- A fulfilled entry should include the frozen Slot Tags in its Knowledge Context unless a future workflow explicitly changes that rule.
- A Knowledge Slot target must identify exactly one target matching `targetKind`.
- For `targetKind: "user"`, `targetUserId` must be present and the other target fields absent.
- For `targetKind: "person"`, `targetPersonReferentId` must be present and the other target fields absent.
- For `targetKind: "organization"`, `targetOrganizationReferentId` must be present and the other target fields absent.
- For `targetKind: "group"`, `targetGroupReferentId` must be present and the other target fields absent.
- For `targetKind: "public"`, no target ID fields should be present.
- Slot status transitions should be coherent: only fulfilled slots should have `fulfilledEntryId`.
- `dueAt` is optional; overdue status should be derived or maintained consistently by workflow code.

### Series and Deferred Relationships

- Series is a Knowledge Type; ordered membership is represented by `seriesItems`.
- A `seriesItems` row belongs to one Series Knowledge Entry.
- A `seriesItems` row must identify exactly one item matching `itemKind`.
- `position` should be unique within a Series unless the product later supports ties.
- Generic `entryRelations` are intentionally deferred.
- Cross-type person-role search through `entryPeople` is intentionally deferred.
- Thumbnail or image asset tables are intentionally deferred.

## Open Questions

- Which additional Human Weight Evidence signals should be derived from normal product activity after explicit feedback?
- When should Quote attribution move beyond the MVP one-Person-context rule to an explicit quoted-person review or edit flow?
- What Type Behaviors belong to the first non-Scripture Knowledge Types?
- How should networks of organizations be represented in Visibility Scope?
