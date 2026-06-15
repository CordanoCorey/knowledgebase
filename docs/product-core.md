# Product Core

This product is a knowledgebase for Christian users and organizations that treats named things in the real world as first-class references for storing, finding, and doing work. It can be understood as a smart Google Drive or virtual file system: Tags behave like folders, Knowledge Entries behave like files, and an entry can appear in many folders because it can reference many Referents.

The application is not only a repository. It is intended to become the place where people ask for knowledge, contribute future answers, and do day-to-day work from the same context where prior answers are found.

## Product Commitments

The application is built for Christians who affirm the inerrancy of Scripture. The Global Knowledge Context is available to every user and organization by default, and in this application it contains Scripture because Scripture is the infallible Recognized Context all users and organizations must acknowledge.

The application should promote human thought over automated output while still using AI for useful recognition, extraction, structuring, and retrieval. AI helps store and surface knowledge; it does not replace human judgment.

Knowledge Entries are rated by Human Weight on a Slop to Soul scale from 0 to 100. Bible passages have full Soul because they are inspired by the Holy Spirit.

## Core Model

A Knowledge Entry is a typed, contextualized unit of knowledge. It represents one Referent of the same Knowledge Type and references other Referents through its Tags. Those Tags constitute the entry's Knowledge Context.

The canonical Tag for a Knowledge Entry's Represented Referent should be included among the entry's Tags. This lets one Tag relationship model both the entry's own navigable identity and the other Referents it references in its Knowledge Context.

A Tag is a named, typed pointer to a Referent and to the intended set of knowledge about that Referent. A Referent is identified by name plus Knowledge Type, so similarly named things remain distinct, such as `Charlotte's Web, book` and `Charlotte's Web, essay`.

Referents, Tags, and Knowledge Entries should remain distinct. A Referent is the stable identity of the thing being pointed at, a Tag is the navigable handle that points to that Referent, and a Knowledge Entry is content or work that represents one same-typed Referent and references other Referents through Tags. A Referent may exist without any Knowledge Entry representing it, and a Referent may have at most one Knowledge Entry that represents it.

Tags should be canonical per Referent, not duplicated per user or organization. User and organization relationships to a Tag should be represented through Recognized Context, subscriptions, aliases, visibility, or other local relationships rather than by creating separate Tags for the same Referent.

The first schema pass should include Tag Recognition so users and organizations can record that a canonical Tag is meaningful to them without creating local duplicate Tags.

The base Knowledge Type is Words. When the application does not yet understand a more specific type, a Referent may be represented as Words until that type is added. Later, Type Reclassification can refine the Tag from Words to a more specific Knowledge Type when the Referent's identity is the same.

Knowledge Types are how the application learns new domain behavior. Adding a type means teaching the app how to recognize, relate, display, scope, and work with entries of that type.

## Core Loop

The product loop has two main user actions:

1. **Explore**: the user makes a Knowledge Request, and the app maps it to a Knowledge Context where relevant Answers can be browsed.
2. **Contribute**: the user adds a future Answer by submitting a Source, creating a Knowledge Entry directly, or responding to an existing Knowledge Entry.

Explore and Contribute should happen in the same place. Wherever users see Answers, they should also be able to add the missing future Answer that belongs in that Knowledge Context.

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

Smart Storage may use Factual Enrichment when a Source points to factual knowledge it does not itself contain, such as a fuzzy description of a known quotation. Factual Enrichment is encouraged for factual information, but it must produce a user-confirmable proposal rather than writing directly to the Gold Layer.

Every enriched factual field in a Smart Storage Proposal should carry Factual Provenance whenever feasible. Factual Provenance may point to an external URL, to another Knowledge Entry, or to a model-only basis when no external evidence was checked.

Smart Storage should send a curated Smart Storage Contract to the LLM rather than the raw database schema. The contract should include whatever domain information the LLM needs to match Sources to Knowledge Types and propose Gold Layer structure, such as allowed Knowledge Types, type-specific fields, proposal requirements, current Knowledge Context, relevant existing Tags or Referents, examples, and provenance expectations.

Smart Storage may challenge a user-selected Knowledge Type when the Source appears to match a more specific or more appropriate Knowledge Type. A Knowledge Slot's requested Knowledge Type remains fixed during Slot fulfillment, so Smart Storage should not challenge it.

When a user creates or refines a Knowledge Entry, the creation flow should first search for existing Tags and Referents before creating new ones. The accepted behavior is to reuse the canonical Tag when the intended Referent already exists, and to create a new Tag only when the app cannot confidently match an existing Referent or the user confirms the proposed new Referent is distinct.

The bronze, silver, and gold progression describes the degree to which useful information has been extracted, cleaned, structured, and shaped from the original Source:

- The Bronze Layer preserves submitted Sources as close as possible to their original form.
- The Silver Layer is an intermediate refinement layer for cleaned and structured data that has not yet become fully typed knowledge.
- The Gold Layer contains Knowledge Entries represented according to the most specific Knowledge Types the application currently understands.

The Bronze Layer Source should be preserved immediately when the user submits, before any LLM call or Smart Storage proposal generation. If enrichment fails, times out, or produces no acceptable proposal, the preserved Source should remain available for retry or Reprocessing.

Gold Layer Knowledge Entries produced through Smart Storage require user confirmation. LLM-assisted enrichment can improve a proposal, but confirmation is the boundary where proposed structured knowledge becomes stored Knowledge Entry data.

User confirmation can make the confirming user responsible for the whole Knowledge Entry while individual factual fields remain attributed to their Factual Provenance. External factual material that should remain navigable in the knowledgebase may be represented by a Knowledge Entry; otherwise an external URL can serve as the provenance target.

Factual Provenance should default to an external URL when the source is only needed as evidence for a proposed fact. Smart Storage should create or propose a Knowledge Entry for the provenance target only when that target is itself a meaningful Referent users may navigate, tag, search, reuse, or cite repeatedly.

One Source can produce many Knowledge Entries. For example, an uploaded essay or transcript can produce one parent entry and many Quote entries, each with its own Knowledge Context. The parent entry's Knowledge Context may be a superset of the union of its quotes' Knowledge Contexts.

The user review unit for Smart Storage should be a durable Smart Storage Proposal linked to the saved Source, and each Smart Storage Proposal should correspond to one proposed Knowledge Entry. A single Source may therefore produce many Smart Storage Proposals, letting the user accept, reject, or edit each proposed Knowledge Entry independently.

Smart Storage Proposals belong to the Silver Layer and should survive refresh, navigation, failed enrichment, and deferred review. They are review records tied to Bronze Sources, not temporary UI previews and not Gold Layer Knowledge Entries.

Smart Storage Proposals should store contract-shaped domain proposals rather than raw Convex write payloads. On acceptance, the backend should validate the proposal and translate it into the current persistence shape, keeping Silver Layer records portable if the application later migrates away from Convex or changes its internal schema.

Smart Storage Proposal records should preserve the original generated proposal separately from the current reviewed proposal. The original generated proposal supports audit, debugging, and Reprocessing, while the current reviewed proposal is the editable version the user may accept into Gold Layer knowledge.

Smart Storage Proposal status should stay small. A drafted proposal is generated and awaiting review. A needs-resolution proposal requires the user to choose between candidates or resolve ambiguity. An accepted proposal has produced a Gold Layer Knowledge Entry. A rejected proposal was declined by the user. A stale proposal was superseded by a newer Smart Storage Contract, Type Behavior, or Reprocessing run.

Accepting a Smart Storage Proposal should be atomic for one complete proposed Knowledge Entry. Users should edit the proposal, split it into multiple proposals, or reject unwanted proposals before acceptance rather than partially accepting individual fields into Gold Layer knowledge.

When Factual Enrichment finds multiple plausible matches for a user's intent, ambiguity should remain inside Smart Storage Proposal review. The user must choose the exact candidate before the proposal becomes Gold Layer knowledge, and Smart Storage should create multiple Gold Layer Knowledge Entries from a fuzzy Source only when the user explicitly accepts multiple proposals.

Reprocessing revisits existing Sources or Knowledge Entries when the application gains new Knowledge Types or improved recognition. A previously complete entry can become an Upgrade Candidate when a new type reveals knowledge it held only indirectly.

Source is not an MVP Knowledge Type. A Source belongs to the Bronze Layer as raw submitted material and can produce Knowledge Entries, but it should not itself be treated as represented knowledge in the Gold Layer.

Media formats such as audio, video, image, and file are not MVP Knowledge Types. They belong to Sources, attachments, or representations of Knowledge Entries. For example, a Sermon may be represented by audio, video, transcript, or notes, but its Knowledge Type remains Sermon.

Long-form or rich editable content belongs to Entry Representations rather than to type-specific detail rows. Words has no separate type detail table; its full content is represented through an Entry Representation while Knowledge Entries retain the bounded text needed for cards and search.

## Knowledge Slots

A Knowledge Slot is a predefined request for one Knowledge Entry of a specified Knowledge Type within a specified Knowledge Context. It is the app's way to request future Answers from users.

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

Tags and Referents become visible indirectly through visible Knowledge Entries that represent or reference them. The Global Knowledge Context is not the same thing as global visibility: an entry can be visible to everyone without belonging to the Global Knowledge Context.

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

Bookmark is not a Knowledge Type. A bookmark is a User relationship to a Knowledge Entry, Referent Page, or Context Page, used to create saved views and possibly subscription-style notifications.

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
- `humanWeight` should stay within the product scale of 0 through 100.
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
- `quoteEntries.quotedPersonReferentId`, when present, must point to a Person Referent.
- `quoteEntries.sourceEntryId`, when present, must point to the larger entry/source represented by the Quote.
- `eventEntries.locationPlaceReferentId`, when present, must point to a Place Referent.
- Event times should be coherent: `endsAt`, when present, should not be earlier than `startsAt`.
- `rsvpEntries.eventEntryId` must point to an Event Knowledge Entry.
- `rsvpEntries.personReferentId` must point to a Person Referent.
- An RSVP should be unique per Event and Person unless the product later supports response history.
- `organizationEntries.organizationKind` must be one of School, Church, Family, or Community.

### Entry Representations and Sources

- An Entry Representation belongs to exactly one Knowledge Entry.
- A Knowledge Entry should have at most one primary representation per representation need.
- `prosemirrorDocumentId` remains an arbitrary string compatible with the collaborative editor.
- File, audio, video, URL, and plain text representations should use the fields matching their `representationKind`.
- A Source is Bronze Layer raw material, not a Knowledge Type and not a Knowledge Entry.
- A Source may produce many Knowledge Entries through `sourceOutputs`.
- A `sourceOutputs` row must point to an existing Source and an existing produced or derived Knowledge Entry.
- Formal Silver Layer records are required for Smart Storage Proposals because review, retry, and partial acceptance workflows need durable state between Bronze Sources and Gold Layer Knowledge Entries.
- Smart Storage Proposals should store contract-shaped domain data rather than raw Convex write payloads, and acceptance should translate validated proposals into the current persistence schema.
- Smart Storage Proposal records should preserve the original generated proposal separately from the current reviewed proposal.
- Accepting a Smart Storage Proposal should atomically create or connect the complete proposed Knowledge Entry shape; partial acceptance should be represented by editing, splitting, or rejecting proposals before acceptance.
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
- A Person may be a member of Organizations and Groups through `memberships`.
- `memberships.personReferentId` must point to a Person Referent.
- A membership target must identify exactly one target matching `targetKind`.
- For `targetKind: "organization"`, `organizationReferentId` must be present and `groupReferentId` absent.
- For `targetKind: "group"`, `groupReferentId` must be present and `organizationReferentId` absent.
- Organization membership targets must point to Organization Referents.
- Group membership targets must point to Group Referents.
- When `memberUserId` is present, it should match the User linked to `personReferentId`.
- The onboarding rule that a User belongs to at least one Organization is required later, but not enforced by schema alone.

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
