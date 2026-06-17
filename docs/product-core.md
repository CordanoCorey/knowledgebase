# Product Core

This product is a knowledgebase for Christian users and organizations that treats named things in the real world as first-class references for storing, finding, and doing work. It can be understood as a smart Google Drive or virtual file system: Tags behave like folders, Knowledge Entries behave like files, and an entry can appear in many folders because it can reference many Referents.

The application is not only a repository. It is intended to become the place where people ask for knowledge, contribute future answers, and do day-to-day work from the same context where prior answers are found.

## Product Commitments

The application is built for Christians who affirm the inerrancy of Scripture. The Global Knowledge Context is available to every user and organization by default, and in this application it contains Scripture because Scripture is the infallible Recognized Context all users and organizations must acknowledge.

The application should promote human thought over automated output while still using AI for useful recognition, extraction, structuring, and retrieval. AI helps store and surface knowledge; it does not replace human judgment.

Weight-bearing Knowledge Entries are rated by Human Weight on a Slop to Soul scale from 0 to 100. Human Weight is interpreted through the entry's Knowledge Type, and each weight-bearing Type Behavior should define the credited human role: a Quote should credit the human substance of the person to whom the quote is attributed, while a Words entry should credit the user or person who authored those words. Some workflow types, such as RSVP, may have no Human Weight because they do not meaningfully express human ingenuity. Bible passages have full Soul because they are inspired by the Holy Spirit.

The MVP weight-bearing Knowledge Types are Words, Question, Quote, Sermon, Essay, Poem, Song, Book, Short Story, Lesson, Comment, Prayer Request, Series, and Event. The MVP non-weight-bearing Knowledge Types are RSVP, Person, Organization, Group, Place, and Topic. Bible Passage is a special case: it has full Soul as Scripture, but it is not an authorable Knowledge Entry type in the MVP.

The initial Human Weight bands are Slop at 0-19, Assisted at 20-39, Shaped at 40-59, Substantial at 60-79, Weighty at 80-94, and Soul at 95-100. These bands are interpretive anchors for the product and implementation; they may be refined as the product learns how users recognize human substance.

Human Weight is a recalculable current estimate, not immutable entry metadata. The product should preserve Human Weight Evidence and enough evaluation context to revise scores when the Human Weight definition improves. User feedback, ratings, recognition, or other gamified signals may contribute evidence, but they should support the rating rather than directly determine it or replace the Type Behavior's credited human role.

Evidence Maturity should be tracked separately from Human Weight. Human Weight answers how much human substance the entry carries; Evidence Maturity answers how settled that rating is. A promising new entry may have high estimated Human Weight with low Evidence Maturity, while a long-used reviewed entry may have the same Human Weight with high Evidence Maturity.

Human Weight Feedback should begin with a small set of evidence-oriented responses, such as recognize, used, not human, and wrong context. Recognize and used may also be derived from other product activity when the application has enough data to infer them responsibly, rather than requiring explicit feedback every time.

Answer Feed ranking should use Feed Priority: a derived ordering value that prioritizes Human Weight while also giving low-Evidence Maturity weight-bearing entries enough exposure to gather Human Weight Evidence from users. Human Weight calculation may happen asynchronously, such as through scheduled recalculation, when evidence changes or the scoring definition is refined.

## Core Model

A Knowledge Entry is a typed, contextualized unit of knowledge. It represents one Referent of the same Knowledge Type and references other Referents through its Tags. Those Tags constitute the entry's Knowledge Context.

The canonical Tag for a Knowledge Entry's Represented Referent should be included among the entry's Tags. This lets one Tag relationship model both the entry's own navigable identity and the other Referents it references in its Knowledge Context.

A Tag is a named, typed pointer to a Referent and to the intended set of knowledge about that Referent. A Referent is identified by name plus Knowledge Type, so similarly named things remain distinct, such as `Charlotte's Web, book` and `Charlotte's Web, essay`.

Referents, Tags, and Knowledge Entries should remain distinct. A Referent is the stable identity of the thing being pointed at, a Tag is the navigable handle that points to that Referent, and a Knowledge Entry is content or work that represents one same-typed Referent and references other Referents through Tags. A Referent may exist without any Knowledge Entry representing it, and a Referent may have at most one Knowledge Entry that represents it.

Tags should be canonical per Referent, not duplicated per user or organization. User and organization relationships to a Tag should be represented through Recognized Context, subscriptions, aliases, visibility, or other local relationships rather than by creating separate Tags for the same Referent.

The first schema pass should include Tag Recognition so users and organizations can record that a canonical Tag is meaningful to them without creating local duplicate Tags.

Active Knowledge Context is the Knowledge Context in effect for the user's current Knowledge Page. Recognized Context is historical: the union of Knowledge Contexts where the user or organization has taken meaningful action, recorded through canonical Tags without making those Tags active for every request.

Plain Knowledge Page visits should not add to Recognized Context by default. Page visits are analytics and may serve as weak recommendation evidence, while Recognized Context should come from intentional actions such as bookmarking, pinning, subscribing, contributing, commenting, asking from a Knowledge Context, fulfilling a Knowledge Slot, editing Tags, sharing, or assigning work.

Bookmarked Knowledge Pages should not appear directly in the primary sidebar by default. They belong in user/account navigation, such as the user's Profile or a user dropdown from the profile control, while the sidebar remains focused on Pinned Knowledge Pages and primary navigation.

Bookmarks should be available as a section or tab on the User's profile, with the sidebar avatar menu offering a shortcut to that profile section. Bookmarks do not need a separate User View unless the saved set becomes large or workflow-heavy enough to require one.

Knowledge Pages and User Views should remain distinct in navigation. Knowledge Pages are grounded in a shared Knowledge Context, Referent, Knowledge Entry, Organization, or other world-facing knowledge object. User Views are assembled around the current User's activity, responsibilities, preferences, or account state, such as Calendar, Notifications, Settings, or editing the user's profile. A public profile is a Knowledge Page for a Person or User presentation; editing one's own profile is a User View.

The primary sidebar should carry destination navigation: Dashboard as the first global Knowledge Page, Pinned Knowledge Pages in the middle, and User Views or account navigation at the bottom. The sidebar avatar should be the account-menu entry point for the User's profile, Bookmarks, Settings, and Sign out. The header should stay focused on the user's Active Role and Global Search. The current Knowledge Page or Active Knowledge Context should be presented below the header in the page content area rather than inside the header, so users do not mistake Global Search for context-scoped search. Account controls should live in one place, not duplicated in both sidebar and header.

Global Search should search everything the current User can access, independent of the current Active Knowledge Context. It should not mean public-only search or search limited to the Global Knowledge Context. Search results should make scope legible with labels such as Global, an Organization name, or Personal when needed.

Knowledge Pages may also provide context-scoped Search, Ask, or Explore controls, but those controls should live below the header near the page title or Active Knowledge Context. Context-scoped controls should be visually distinct from header Global Search so users can tell which scope they are using.

When a User selects a Global Search result, the app should navigate to that result's Knowledge Page and synchronize the Knowledge Navigator's active Tags to that page's Active Knowledge Context. For example, opening `Arche Classical Academy` from Global Search lands on Arche's Knowledge Page with Arche's Tag as the single active Tag.

The Knowledge Navigator should be visible on every Knowledge Page because it is the canonical control for the Active Knowledge Context. Its presentation may vary: compact on simple Knowledge Pages and expanded on Dashboard or exploration-heavy pages.

The Knowledge Navigator should not be shown as the main navigator on User Views such as Calendar or Notifications. User Views may show context chips or links inside their items, but those should navigate to the relevant Knowledge Pages rather than making the User View itself context-scoped.

Dashboard should be a fixed first sidebar route for the Global Knowledge Context, not a user-removable Pinned Knowledge Page.

Explore should not be a separate primary sidebar icon for now. Explore is an action available from Dashboard and other Knowledge Pages, while Dashboard is the fixed global Knowledge Page.

Pinned Knowledge Pages should not rely on icon-only recognition. The sidebar may have a compact or collapsed state, but Pinned Knowledge Pages need a visible label affordance beyond hover tooltips because user-pinned pages and default Organization pages are not universally recognizable from icons alone.

On desktop, the sidebar should prefer visible labels for Pinned Knowledge Pages. On smaller screens or constrained layouts, the sidebar may collapse into a compact rail or drawer. When there are more Pinned Knowledge Pages than the available sidebar space can show, overflow should collapse into a concise control such as `+3 more` rather than crowding or shrinking every item.

Default Pinned Knowledge Pages for Organizations should use the specific Organization name as the primary label, such as `Arche Classical Academy`, rather than only generic labels like `My School`. The Organization kind, such as School, Church, Family, or Community, may appear through an icon, secondary label, or grouping.

Default Pinned Knowledge Page seeding should be capped so initial navigation stays calm. When a User has multiple Organizations of the same kind, the app should seed at most the most relevant one per kind and make the others available through pin management or recommendations rather than pinning every affiliation automatically.

The Active Role display in the header should also be the Role switcher. The default global state should have no Active Role selected; switching Active Role should change acting capacity, permissions, prompts, and defaults without navigating the User away from the current Knowledge Page or User View.

Navigating to an Organization Knowledge Page or unambiguous organization-scoped context should default the Active Role to the Role the User assumes within that Organization. If a User has more than one Role in that Organization, the app should require or preserve an explicit choice rather than guessing.

Organization-scoped visibility may default from the current Organization Page even when Active Role is unset or ambiguous. Role-specific authority, prompts, and permissions should require an explicit Active Role when multiple Roles match the same Organization.

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

The product should treat search boxes, ask boxes, and contribution editors as related Knowledge Composer surfaces. A composer may support a transient Knowledge Request, a durable Contribution, or both, but the user action should remain clear at the moment of submission.

A Contribution Submission should become durable only when the user intent needs preserved raw material, multiple Sources, deferred review, retry, Smart Storage, import, upload, or Reprocessing. A simple direct post should not create durable Contribution Submission workflow state by default; it should create the Gold Layer Knowledge Entry and any needed Entry Representations directly.

Each Contribution Submission should have one Primary Intended Entry: the Knowledge Entry the user is principally trying to create or update. Smart Storage may propose additional derived Knowledge Entries from the same submitted Sources, but those derived proposals should remain reviewable separately from the Primary Intended Entry.

When Smart Storage identifies multiple entries from one Contribution Submission, the user should accept one Smart Storage Proposal at a time. Even when the Primary Intended Entry is a future Course or MVP Series and the Sources contain many Lessons or other child entries, Gold Layer creation should remain explicit per proposed Knowledge Entry rather than bulk-accepted by default.

Sources belong first to the durable Contribution Submission that preserved the user's raw material. Smart Storage Proposals should identify which submitted Sources, excerpts, file ranges, or external URLs support each proposed create or update, and accepted Gold Layer Knowledge Entries should be linked back to the Sources that produced or informed them.

When the Sources for a Primary Intended Entry cause Smart Storage to propose creating or updating another Knowledge Entry, the app should not create a vague generic relationship such as `relatedTo` by default. Shared Source provenance preserves the evidence that the entries have overlapping information, while Gold Layer relationships should be expressed through Tags, existing typed relationships, Knowledge Type attributes, or later Type Behavior that can name the relationship precisely.

The user-facing place for this loop depends on how many Tags are active in the Knowledge Navigator. The Dashboard is used when no Tags are active and the user is located in the Global Knowledge Context. A Referent Page is used when exactly one Tag is active and the user is focused on the Referent that Tag points to. A Context Page is used when two or more Tags are active and the user is exploring their combined Knowledge Context.

Referent Pages should be reached through Tags rather than Knowledge Entry IDs. In the MVP, non-Scripture Referent Pages may use a route such as `/goto/:tagId`; Bible Passage Referent Pages should use Scripture's familiar citation language with a route such as `/scripture/:passageString`, while still behaving like a one-Tag Referent Page.

Bible Passage Tags and Referents may be created lazily. Visiting `/scripture/:passageString` should not by itself require a persisted Tag or Referent, but analytics should still record the visit against the parsed, normalized passage target so the app can report commonly visited Bible passages before those passages have been tagged or contributed around.

Analytics should distinguish Referent Page visits from Knowledge Navigator usage. A visit records that a user opened a page for a target such as `John 3:16`; Navigator usage records that the user selected a Tag as part of the Knowledge Context for Explore or Contribute.

Analytics should keep raw page visit events separately from aggregate visit stats. Raw events preserve useful history for debugging and future analysis, while aggregate stats support product queries such as commonly visited Bible passages without scanning event history.

Topic should be reserved for a named subject of discussion, such as `atonement`, `friendship`, or `Christian education`. Topic is an MVP Knowledge Type, but it should not mean the Context Page or Referent Page itself. A Topic Tag can be the active Tag for a Referent Page or one of multiple active Tags for a Context Page.

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

Smart Storage may use Factual Enrichment when a Source points to factual knowledge it does not itself contain, such as a fuzzy description of a known quotation. Factual Enrichment is encouraged for factual information, but it must produce a user-confirmable proposal rather than writing directly to the Gold Layer.

Every enriched factual field in a Smart Storage Proposal should carry Factual Provenance whenever feasible. Factual Provenance may point to an external URL, to another Knowledge Entry, or to a model-only basis when no external evidence was checked.

Factual Provenance may attach to the whole Smart Storage Proposal or Knowledge Entry when one evidence trail supports the proposal as a whole. When enriched factual fields come from different evidence or have different confidence, Factual Provenance should attach to the specific field or claim it supports.

Required Factual Provenance should be determined by the Smart Storage Contract and the Type Behavior for each Knowledge Type and field. Type Behavior may mark fields as enrichable and may require provenance for enriched values, such as a Book proposal enriching a fuzzy Source into the title `Pride and Prejudice` and author `Jane Austen`.

Smart Storage Proposals and enriched factual fields may include coarse Proposal Confidence such as high, medium, or low. Proposal Confidence should guide user review, especially for model-only provenance or ambiguous candidates, but it must not be presented as Human Weight or as a substitute for user confirmation.

Low Proposal Confidence should warn the user but should not universally block acceptance. Acceptance should be blocked by invalid Smart Storage Contract shape, unresolved required fields, unresolved identity ambiguity, or missing required Factual Provenance rather than by confidence alone.

Smart Storage should send a curated Smart Storage Contract to the LLM rather than the raw database schema. The contract should include whatever domain information the LLM needs to match Sources to Knowledge Types and propose Gold Layer structure, such as allowed Knowledge Types, type-specific fields, proposal requirements, current Knowledge Context, relevant existing Tags or Referents, examples, and provenance expectations.

Smart Storage Contracts and Type Behaviors must be versioned and tracked in the database as immutable content snapshots, not only as version labels pointing to code or configuration. Each Smart Storage Proposal should record the Smart Storage Contract version and Type Behavior version that generated it, so later rule changes can mark proposals stale or route them through Reprocessing intentionally.

Type Behavior should be versioned as a whole per Knowledge Type, with field-level rules inside the immutable snapshot. For example, a Book Type Behavior snapshot may define whether `title` and `author` are enrichable and whether enriched values require Factual Provenance, without creating separate version records for each field.

Smart Storage Contract versions should contain stable reusable rules and templates, not request-specific data. Request-specific input should be snapshotted separately with the enrichment run or Smart Storage Proposal, including the Source reference, the specific Source text or excerpts sent to the LLM, active Knowledge Context, candidate existing Tags or Referents, retrieved evidence, and other facts used for that specific proposal generation.

Request-specific input snapshots should record what the LLM actually saw while linking back to the full Bronze Layer Source as the durable raw record. The full raw Source should not be duplicated into the input snapshot unless the full Source was actually sent to the LLM.

Smart Storage Runs should preserve the raw model output separately from parsed Smart Storage Proposals. The raw output supports audit, debugging, parser failure recovery, and future contract improvement, while the Smart Storage Proposal remains the cleaned, validated, contract-shaped Silver Layer record users review.

Failed LLM calls, parse failures, and validation failures should create or update Smart Storage Runs, not Smart Storage Proposals. A Smart Storage Proposal should exist only after the app has parsed and validated a contract-shaped candidate that the user can review.

Smart Storage Run status should describe operational processing rather than user review. A queued run is waiting to call the model. A running run is actively enriching. A succeeded run produced at least one parsed Smart Storage Proposal. A no-proposal run completed without producing a reviewable proposal. A failed run stopped because the LLM call, parse, or validation failed before any proposal existed. A superseded run was replaced by a newer run for the same Source and request context.

No-proposal outcomes should be surfaced quietly in the contribution or review area, such as "Saved as Source; no structured proposal found." They should not create Answer Feed items, Knowledge Slots, or failed Smart Storage Proposal cards.

Smart Storage Proposal acceptance should validate against the Smart Storage Contract and Type Behavior versions that generated the proposal unless those versions have been marked incompatible or retired. Incompatible or retired versions should make affected proposals stale and require Reprocessing before acceptance.

Smart Storage may challenge a user-selected Knowledge Type when the Source appears to match a more specific or more appropriate Knowledge Type. A Knowledge Slot's requested Knowledge Type remains fixed during Slot fulfillment, so Smart Storage should not challenge it.

When a user creates or refines a Knowledge Entry, the creation flow should first search for existing Tags and Referents before creating new ones. The accepted behavior is to reuse the canonical Tag when the intended Referent already exists, and to create a new Tag only when the app cannot confidently match an existing Referent or the user confirms the proposed new Referent is distinct.

The bronze, silver, and gold progression describes the degree to which useful information has been extracted, cleaned, structured, and shaped from the original Source:

- The Bronze Layer preserves submitted Sources as close as possible to their original form.
- The Silver Layer is an intermediate refinement layer for cleaned and structured data that has not yet become fully typed knowledge.
- The Gold Layer contains Knowledge Entries represented according to the most specific Knowledge Types the application currently understands.

For Smart Storage, Bronze Layer is to Source as Silver Layer is to Smart Storage Proposal and Gold Layer is to Knowledge Entry. Bronze preserves raw data, Silver holds reviewable proposed knowledge, and Gold stores confirmed Knowledge Entries.

For Smart Storage, the Bronze Layer Source should be preserved immediately when the user submits, before any LLM call or Smart Storage proposal generation. If enrichment fails, times out, or produces no acceptable proposal, the preserved Source should remain available for retry or Reprocessing.

When a user later opts a directly created Knowledge Entry into Smart Storage or Reprocessing, the app should create a Bronze Layer Source snapshot of the entry's current representation at that moment and link it back to the existing Knowledge Entry. That Source preserves the reprocessing input; it should not be treated as the original raw direct-post submission.

Before direct posting or Smart Storage, the application should provide a deterministic Contribution Preview that shows the best current guess for the Knowledge Type, Knowledge Context, and visible entry attributes that would be contributed. This preview should be computed by application logic rather than an LLM and should update as user input, uploaded material, or selected context changes.

Gold Layer Knowledge Entries produced through Smart Storage require user confirmation. LLM-assisted enrichment can improve a proposal, but confirmation is the boundary where proposed structured knowledge becomes stored Knowledge Entry data.

User confirmation can make the confirming user responsible for the whole Knowledge Entry while individual factual fields remain attributed to their Factual Provenance. External factual material that should remain navigable in the knowledgebase may be represented by a Knowledge Entry; otherwise an external URL can serve as the provenance target.

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

Smart Storage should create one primary Smart Storage Proposal for the user's intended Knowledge Entry and include referenced Tags or Referents inside that proposal. If a referenced Referent already exists, the proposal should explicitly show that the resulting Knowledge Entry will reference that existing Referent through its Tag. If the referenced Referent does not yet exist, the proposal should explicitly show that acceptance will create the new Referent and Tag and then include that Tag in the Knowledge Entry's Knowledge Context. Smart Storage should create a separate Knowledge Entry proposal for a referenced Referent only when the Source contains separate entry content for that Referent.

When Factual Enrichment finds multiple plausible matches for a user's intent, ambiguity should remain inside Smart Storage Proposal review. The user must choose the exact candidate before the proposal becomes Gold Layer knowledge, and Smart Storage should create multiple Gold Layer Knowledge Entries from a fuzzy Source only when the user explicitly accepts multiple proposals.

Reprocessing revisits existing Sources or Knowledge Entries when the application gains new Knowledge Types or improved recognition. A previously complete entry can become an Upgrade Candidate when a new type reveals knowledge it held only indirectly.

Reprocessing may propose edits to an existing Gold Layer Knowledge Entry when the same knowledge can be represented more specifically, such as changing its Knowledge Type, fields, represented Referent, or Tags. It may also propose additional linked Knowledge Entries when the Source or existing entry contains separate knowledge units. The proposal review must make the outcome explicit: acceptance either updates an existing Gold entry, creates new Gold entries, or does both through clearly separated proposals.

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

Fulfillment is the state of a Knowledge Slot after the requested Knowledge Entry exists.

The MVP should classify calls to action generically as Knowledge Slots rather than adding an Assignment Knowledge Type. For example, a teacher assigning an Essay, a user requesting an expert Answer, or an Event asking for RSVP entries are all Knowledge Slots requesting future Knowledge Entries within specified Knowledge Contexts.

Task and Todo are not MVP Knowledge Types. Calls to action that request future Knowledge Entries should be represented as Knowledge Slots; tasks that do not request knowledge are outside the MVP.

Question is an MVP Knowledge Type because questions provide valuable information about which parts of a Knowledge Context need to be connected. A user may ask a transient Knowledge Request, but a Question can also be represented as a Knowledge Entry within the Knowledge Context it maps to, helping reveal the shape of the Question Space.

Question Template should be deferred as a Knowledge Type. Reusable request or slot templates introduce authoring and reuse behavior beyond the MVP.

Template is not an MVP Knowledge Type. Templates are reusable authoring structures for creating other entries, questions, slots, lessons, or related workflows.

## Visibility

Visibility Scope belongs to Knowledge Entries. A Knowledge Entry may be visible to one user, an organization, a group, a network of organizations, or everyone.

Contribution defaults should favor organization visibility rather than public visibility. When a Contribution happens from an Organization Page or another unambiguous organization-scoped context, the default Visibility Scope should be that organization. When the User is on the Dashboard or outside any organization-scoped context, the default should be all Organizations the User belongs to if no Active Role is selected, or the Organization corresponding to the selected Active Role when one is selected. The composer should always allow the User to explicitly choose the Visibility Scope for the entry.

Visibility defaults and role authority are separate. The current Organization Page may supply an organization Visibility Scope even when the User has not chosen among multiple Roles in that Organization, but any role-specific edit, send, review, or administrative action should require an explicit Active Role.

Visibility Scope and Delivery Target are separate. Visibility Scope controls who may access a Knowledge Entry after it exists; Delivery Target controls who should be notified, assigned, messaged, or otherwise sent a contribution or action. Sending an entry to a group does not by itself define every user who may access the entry, and making an entry visible to an organization does not require notifying every member of that organization.

"Send to page" should not be used as product or domain language. If a User intends an entry to appear in relation to a Knowledge Page, the entry should reference the relevant Tag through its Knowledge Context. Delivery is reserved for notifying, assigning, or messaging actual recipient targets.

Tags and Referents become visible indirectly through visible Knowledge Entries that represent or reference them. The Global Knowledge Context is not the same thing as global visibility: an entry can be visible to everyone without belonging to the Global Knowledge Context.

Tags do not grant access. A Knowledge Entry may reference an Organization, Group, Person, Place, Topic, Bible Passage, or other Referent through its Knowledge Context without becoming visible to users associated with that Referent. Visibility Scope remains the access boundary.

Composer tag entry may feel freeform, but stored Tags must resolve to canonical Referents. Before submission or acceptance, a typed tag should either match an existing Tag/Referent or be confirmed as a proposed new Referent with a Knowledge Type; unresolved local labels should not be stored as Tags.

Composer tag suggestions should distinguish current-context Tags, deterministic recommendations, and Smart Storage recommendations. Current-context Tags come from the active Knowledge Navigator or current Knowledge Page; deterministic recommendations come from user or organization Recognized Context, recent use, pinned pages, memberships, selected Knowledge Type, and visible submission metadata; Smart Storage recommendations come from AI-assisted analysis of Sources or enrichment and should remain reviewable before they affect Gold Layer knowledge.

Current-context Tags should be selected by default for ordinary Contributions, but the User may remove them before submission when the entry does not actually belong in that Knowledge Context. Knowledge Slot fulfillment is different: Slot Tags are the frozen Knowledge Context for the requested entry and should remain locked unless a future workflow explicitly allows changing the Slot's context.

## MVP Direction

The MVP Knowledge Type set is locked as: Words, Bible Passage, Topic, Series, Question, Quote, Sermon, Essay, Poem, Song, Book, Short Story, Lesson, Comment, Prayer Request, Event, RSVP, Person, Organization, Group, and Place. New Knowledge Types should be deferred unless they prove required for one of the MVP loops.

Bible Passage is an MVP Knowledge Type for Referents and Tags, but it is not an authorable Knowledge Entry type in the MVP. Scripture text belongs to the Bible structure and Bible verse text tables, while user-created entries such as notes, sermons, lessons, comments, or questions reference Bible Passage Tags in their Knowledge Context.

Sermon Clip should be deferred unless a later workflow needs quote-like Type Behavior specifically for sermon media.

Essay, Poem, Song, Book, and Short Story are MVP Knowledge Types because churches and schools need to refer to named works precisely. Their initial Type Behavior can be mostly the same as Words: they are named wrappers that let the application distinguish similarly named Referents and present them with the right human meaning before richer type-specific behavior exists.

Hymn is not an MVP Knowledge Type. Hymns should be represented as Songs unless hymn-specific behavior becomes necessary later.

Liturgy should be deferred as a Knowledge Type. Liturgical content can begin as Words, Song, Bible Passage, Event context, or Series depending on its shape until worship-service behavior becomes first-class.

Sacrament and Ordinance should be deferred as Knowledge Types. In the MVP, baptism or communion services can be Events, while theology of sacraments or ordinances can be Topics.

Offering and Donation should be deferred as Knowledge Types. They imply payments, finance, receipts, stewardship records, and sensitive permissions beyond the MVP.

Reading Plan should be deferred as a separate Knowledge Type. In the MVP, a reading plan can be represented as a Series of Bible Passages, Books, Lessons, and Knowledge Slots until scheduling or progress behavior becomes distinct.

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

Role is not an MVP Knowledge Type. A Role is the relation of a Person to a Knowledge Type or Knowledge Entry, such as author of a Book, teacher of a Lesson, student in a Group, speaker of a Sermon, parent in a Family, or invitee to an Event.

Author is not an MVP Knowledge Type. Author is a Role of a Person in relation to a Book, Essay, Poem, Song, Short Story, Quote, or other Knowledge Entry.

Speaker, Preacher, Teacher, and Student are not MVP Knowledge Types. They are Roles of a Person in relation to a Sermon, Lesson, Event, Group, Organization, Knowledge Slot, or other Knowledge Entry.

The MVP should use direct type-detail fields for known single-person relationships, such as a quoted person on a Quote or a respondent on an RSVP. A separate cross-type Person-role table should be deferred until the first UI or query needs role-based search across Knowledge Types.

Denomination should be deferred as a Knowledge Type. It may begin as an Organization attribute or Topic and can become a Knowledge Type later if denominational affiliation needs first-class discovery, visibility, or trust behavior.

Ministry is not an MVP Knowledge Type. A ministry may be represented as a Group, Organization-related body, Topic, Series, or Event context depending on how it is used, until distinct ministry behavior is needed.

Organization is an MVP Knowledge Type, but the MVP should understand only four Organization kinds: School, Church, Family, and Community. To use the app, a User must be a member of at least one Organization, and initial signup must associate the User's Person with a School or Church. Users can also be grouped into Families and can specify a hometown to become a de facto member of a Community. Deeper organization networks, permissions, and membership workflows should be reserved for later.

Network should be a Phase 2 Knowledge Type or organization capability. In the MVP, Organization plus Visibility Scope is enough; named networks of organizations can be added when cross-organization behavior becomes first-class.

Group is an MVP Knowledge Type for a collection of People, not a collection of Users. Since every User links to a Person, user-based participation can still be represented through Person membership, while Groups can also include people who are not application Users. Group should cover informal or temporary collections such as classes, teams, committees, or volunteer cohorts without forcing them to become Organizations.

Groups can receive Knowledge Slots, but fulfillment is performed by Users. When a Knowledge Slot is directed to a Group, the expected fulfillers are Users linked to People in that Group. People who are not linked to Users can still belong to Groups as historical or referential members, but they cannot perform user actions until linked to an account.

Membership is not an MVP Knowledge Type. It is the relationship between a Person and a Group or Organization, with user actions performed through a linked User when one exists.

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

Work is not an MVP Knowledge Type. The MVP should use concrete Knowledge Types such as Book, Song, Poem, Essay, Short Story, Sermon, Lesson, and Quote rather than introducing an abstract Work type.

Citation and Reference are not MVP Knowledge Types. Quote is the Knowledge Type for cited excerpts; citation and reference details should be metadata or relationships to the Source, parent entry, Book, Bible Passage, or other relevant Referent.

Page, Chapter, and Section should be deferred as Knowledge Types. They are structural locations within a work and can be represented through references, ranges, Quotes, or relationships until structural navigation becomes first-class.

Announcement should be deferred as a Knowledge Type. Informational announcements can begin as Words, scheduled announcements as Events, and responsive announcements as Comments until broadcast behavior becomes first-class.

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
- `prosemirrorDocumentId` remains an arbitrary string compatible with the collaborative editor.
- File, audio, video, URL, and plain text representations should use the fields matching their `representationKind`.
- A Source is Bronze Layer raw material, not a Knowledge Type and not a Knowledge Entry.
- A Contribution Submission may group multiple Sources under one user intent, such as typed substantive text, uploaded files, external URLs, audio, or video submitted together for one Lesson, Sermon, or other intended Knowledge Entry.
- A durable Contribution Submission is required for multi-Source, Smart Storage, import, upload, deferred review, retry, or Reprocessing workflows, but not for simple direct posts that create Gold Layer Knowledge Entries immediately.
- Each Contribution Submission should have one Primary Intended Entry, while Smart Storage may propose additional derived Knowledge Entries from the same Sources.
- Multiple Smart Storage Proposals from one Contribution Submission should be accepted one proposed Knowledge Entry at a time.
- Sources are submission-level raw material; Smart Storage Proposals should cite the specific Sources, excerpts, ranges, or URLs that support them.
- Shared Source provenance may indicate that entries are related, but the app should not create a generic `relatedTo` Gold Layer relationship; explicit relationships should be typed, Tag-based, or introduced through later Knowledge Type behavior.
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
- Smart Storage Runs should preserve raw model output separately from parsed Smart Storage Proposals.
- Failed LLM calls, parse failures, and validation failures should be represented on Smart Storage Runs rather than by creating Smart Storage Proposals.
- Smart Storage Run status should track operational processing with queued, running, succeeded, no-proposal, failed, and superseded states, separate from Smart Storage Proposal review status.
- No-proposal Smart Storage Runs should be visible only as quiet Source/review state, not as Answers, Knowledge Slots, or proposal cards.
- Smart Storage Proposal acceptance should validate against the original recorded Smart Storage Contract and Type Behavior versions unless those versions are marked incompatible or retired.
- Smart Storage Proposal records should preserve the original generated proposal separately from the current reviewed proposal.
- Accepting a Smart Storage Proposal should atomically create or connect the complete proposed Knowledge Entry shape; partial acceptance should be represented by editing, splitting, or rejecting proposals before acceptance.
- Smart Storage Proposal acceptance must perform the authoritative current identity check for Tags, Referents, and same-typed represented Knowledge Entries, regardless of matches proposed earlier.
- When an accepted proposal targets an existing Knowledge Entry, the backend must verify the User has permission to edit that entry before adding confirmed information to it.
- Smart Storage Proposal review should explicitly distinguish existing referenced Referents and Tags from new Referents and Tags that acceptance will create.
- Reprocessing proposals should explicitly distinguish edits to an existing Gold Layer Knowledge Entry from creation of additional Gold Layer Knowledge Entries.
- Smart Storage Contract or Type Behavior version changes may trigger dataset-wide Reprocessing to create suggested edits, Smart Storage Proposals, or Upgrade Candidates, but should not silently rewrite existing Gold Layer Knowledge Entries.
- Accepted Reprocessing edits should preserve explicit upgrade provenance without storing old versions on hot Knowledge Entry records in a way that harms normal read performance.
- Older upgrade versions may be archived after a retention window as long as enough summary provenance remains to explain the upgrade and locate audit history when authorized.
- Factual Provenance may be entry-level when one evidence trail supports the whole proposal, but enriched factual fields with distinct evidence should carry field-level provenance.
- Required Factual Provenance should be specified by the Smart Storage Contract and Knowledge Type field behavior rather than applied globally to every field.
- Proposal Confidence should be coarse review guidance for proposals or enriched factual fields, not Human Weight, truth, or a replacement for user confirmation.
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
- Every signed-up User must link to exactly one Person Knowledge Entry through `userProfiles`.
- Not every Person Referent or Person Entry has a User.
- `userProfiles.personEntryId` must point to a Person Knowledge Entry.
- `userProfiles.personReferentId` must be the represented Referent for `personEntryId`.
- `userProfiles.personTagId` must be the canonical Tag for `personReferentId`.
- A User should have exactly one active `userProfiles` row.
- Profile-facing identity facts should belong to the linked Person Knowledge Entry or related world-model records, while account-only access settings should remain on User/auth/profile infrastructure.
- A Person may be a member of Organizations and Groups through `memberships`.
- `memberships.personReferentId` must point to a Person Referent.
- A membership target must identify exactly one target matching `targetKind`.
- For `targetKind: "organization"`, `organizationReferentId` must be present and `groupReferentId` absent.
- For `targetKind: "group"`, `groupReferentId` must be present and `organizationReferentId` absent.
- Organization membership targets must point to Organization Referents.
- Group membership targets must point to Group Referents.
- When `memberUserId` is present, it should match the User linked to `personReferentId`.
- The onboarding rule that a User belongs to at least one Organization is required later, but not enforced by schema alone.
- A Group can be validly created before its full membership is known. Group membership should be optional enrichment rather than a blocking requirement for accepting a Group Smart Storage Proposal.

### Knowledge Slots

- A Knowledge Slot is a workflow request, not a Knowledge Type.
- Each Knowledge Slot requests exactly one Knowledge Entry type through `requestedKnowledgeType`.
- `requestedKnowledgeType` must be an authorable entry type, so it must never be `biblePassage`.
- Slot Tags are the frozen Knowledge Context for the requested entry.
- Slot fulfillment should point to at most one `fulfilledEntryId`.
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

- How should Human Weight be calculated or assigned for ordinary user-created entries?
- What Type Behaviors belong to the first non-Scripture Knowledge Types?
- How should networks of organizations be represented in Visibility Scope?
