# Knowledgebase

This context describes the core domain language for a knowledgebase that helps Christian organizations store, retrieve, and work from human knowledge. The application treats named things in the real world as first-class references for organizing answers and work.

## Language

**Knowledge Context**:
The set of Tags that locate a Knowledge Entry and shape which Knowledge Requests it can help answer.
_Avoid_: Context, folder, AI context window

**Active Knowledge Context**:
The Knowledge Context in effect for a User's current Knowledge Page. Active Knowledge Context describes where the User currently is in the application; it is distinct from the User's historical Recognized Context.
_Avoid_: Recognized Context, role, personal saved set

**Global Knowledge Context**:
The Knowledge Context available to every user and organization by default, containing the Referents all users and organizations must acknowledge as infallible Recognized Context. In this application, the Global Knowledge Context contains Scripture.
_Avoid_: Global Scripture Context, public folder, Bible folder

**Global Search**:
Search across everything the current User can access, independent of the current Active Knowledge Context. Global Search is not limited to public or Global Knowledge Context material.
_Avoid_: Context search, public search, Global Knowledge Context search

**Tag**:
A named, typed pointer to a Referent and the intended set of all knowledge about it, including content already stored in the application and relevant knowledge that has not yet been stored or tagged. A Tag is canonical to its Referent rather than scoped separately per user or organization.
_Avoid_: Label, keyword, local tag

**Knowledge Type**:
A typed shape of knowledge the application understands, such as a Bible Passage, Question, Quote, Sermon, Lesson, Event, Person, Organization, Group, Place, or Words. Knowledge Types may be added over time as the application learns to recognize more specific kinds of Referents.
_Avoid_: Schema, entity type, file type

**Knowledge Entry**:
A typed, contextualized unit of knowledge in the application, whether created directly by a user or produced through Smart Storage. A Knowledge Entry represents one Referent of the same Knowledge Type and its Knowledge Context is constituted by its Tags.
_Avoid_: File, document, source, post

**Entry Representation**:
A content form or media form through which a Knowledge Entry is expressed, such as editable rich text, plain text, audio, video, an external URL, or a stored file. An Entry Representation does not change the Knowledge Type or Referent represented by the Knowledge Entry.
_Avoid_: Source, Knowledge Type, file type

**Visibility Scope**:
The audience allowed to access a Knowledge Entry, such as one user, an organization, a group, a network of organizations, or everyone.
_Avoid_: Public/private, global context, sharing folder

**Delivery Target**:
The User, Person, Group, Organization, or other recipient target a contribution or action is sent to or notifies. Delivery Target is distinct from Visibility Scope and Knowledge Context; receiving a notification does not define who may access the Knowledge Entry or which Tags it references.
_Avoid_: Visibility Scope, audience, permission, send to page

**Type Behavior**:
The versioned domain behavior the application applies to a Knowledge Type, including how entries of that type are recognized, enriched, related, displayed, stored, reviewed, scored, or scoped.
_Avoid_: Implementation, schema behavior

**Answer**:
A Knowledge Entry considered as something that can help satisfy future Knowledge Requests in whole or in part.
_Avoid_: AI response, chat reply

**Human Weight**:
A rating of how strongly a Knowledge Entry reflects human substance that artificial intelligence cannot cheaply counterfeit: agency, excellence, judgment, lived use, or divine inspiration, scored from Slop at 0 to Soul at 100. Whether and how Human Weight applies depends on the Knowledge Entry's Knowledge Type.
_Avoid_: AI score, quality score, robot score

**Human Weight Evidence**:
The supporting signals used to assign or revise Human Weight for a Knowledge Entry, such as credited attribution, provenance, human review, lived use, ratings, or recognition by users and organizations.
_Avoid_: Like count, popularity score, raw engagement

**Human Weight Feedback**:
User-provided feedback on a Knowledge Entry that becomes Human Weight Evidence without directly determining Human Weight.
_Avoid_: Like, vote, popularity rating

**Evidence Maturity**:
A measure of how settled the Human Weight for a Knowledge Entry is based on the amount and reliability of its Human Weight Evidence.
_Avoid_: AI confidence, popularity, certainty

**Feed Priority**:
The derived ordering value used by the Answer Feed to balance Human Weight, Evidence Maturity, freshness, feedback needs, Knowledge Context fit, and contribution opportunities.
_Avoid_: Human Weight, popularity rank, recency sort

**Context Expertise**:
A derived estimate of a User's or Person's reliable ability to author, recognize, place, or contribute useful future Answers within a Knowledge Context.
_Avoid_: Human Weight, popularity, Role, permission

**Context Expertise Evidence**:
The bounded contribution signals used to assign or revise Context Expertise, such as authoring, sharing, confirming, curating, fulfilling, or giving feedback on an Answer within a Knowledge Context.
_Avoid_: Human Weight Evidence, view count, repeated reference, raw engagement

**Context Expert**:
A User or Person surfaced because their Context Expertise is high within a Knowledge Context.
_Avoid_: Top contributor, admin, official authority, title

**Weight-Bearing Knowledge Type**:
A Knowledge Type whose entries can meaningfully carry Human Weight because they express human substance, ingenuity, craft, judgment, lived use, or divine inspiration.
_Avoid_: Human-weight-enabled type, scoreable type

**Non-Weight-Bearing Knowledge Type**:
A Knowledge Type whose entries do not meaningfully express human ingenuity and therefore do not carry Human Weight.
_Avoid_: Zero-weight type, low-quality type

**Knowledge Request**:
A usually transient user request for knowledge, help, or work that is answered from the application's Knowledge Entries within an applicable Knowledge Context. A Knowledge Request is not itself a Knowledge Entry unless intentionally Contributed as a Question or another Knowledge Type.
_Avoid_: Prompt, query, chat message

**Question**:
A Knowledge Type for a durable question mapped to a Knowledge Context, preserving useful information about what parts of that Knowledge Context need to be connected or answered. A Question may be selected as a Tag to define a narrower Knowledge Context for future Knowledge Requests and Answers.
_Avoid_: Prompt, query

**Question Space**:
The set of Knowledge Requests that could meaningfully be asked within a Knowledge Context.
_Avoid_: Search space, prompt space, chat history

**Knowledge Page**:
A user-facing location in the application where a User works within or navigates to a Knowledge Context, Referent, Knowledge Entry, Organization, user relationship, or knowledge-oriented view. A Knowledge Page is distinct from the User's active Role; the same User may visit the same Knowledge Page while acting in different Roles.
_Avoid_: Place, route, screen

**User View**:
A user-scoped view whose contents are assembled around the current User's activity, responsibilities, preferences, or account state rather than around a shared Knowledge Context or Referent.
_Avoid_: Knowledge Page, personal Knowledge Context, private page

**Bookmark**:
A User relationship to a Knowledge Page that saves it in the User's personal saved set for later reference and may inform user-specific tagging or Knowledge Context recommendations. Bookmarking does not place the Knowledge Page in sidebar navigation or subscribe the User to notifications about it.
_Avoid_: Pin, subscription, notification, favorite

**Pinned Knowledge Page**:
A User relationship to a Knowledge Page that keeps the Knowledge Page easy to return to, especially from sidebar navigation. Pinning a Knowledge Page does not itself subscribe the User to notifications about that Knowledge Page.
_Avoid_: Subscription, notification, role, folder

**Default Pinned Knowledge Page**:
A Pinned Knowledge Page automatically seeded from a User's affiliation with a School, Church, Family, or Community. A User may unpin a Default Pinned Knowledge Page, and that suppression should persist unless the User manually pins it again.
_Avoid_: Required page, role, permanent navigation

**Dashboard**:
The user-facing place for Explore and Contribute when the Knowledge Navigator has no active Tags and the user is located in the Global Knowledge Context.
_Avoid_: Home page, global context page

**Topic**:
A Knowledge Type for a named subject of discussion that Knowledge Entries can address, argue about, explain, illustrate, or apply.
_Avoid_: Context page, forum, category

**Series**:
A Knowledge Type for a named collection or sequence of related Knowledge Entries, such as sermons, lessons, books, poems, stories, songs, or Events.
_Avoid_: Topic, folder, collection

**Context Page**:
A user-facing place for Explore and Contribute within a Knowledge Context determined by two or more active Tags in the Knowledge Navigator.
_Avoid_: Topic, channel, folder, Dashboard, Referent Page

**Referent Page**:
The user-facing place for Explore and Contribute focused on one active Tag and the Referent it points to. A Referent Page is reached by going to a Tag rather than by opening a Knowledge Entry.
_Avoid_: Knowledge Entry page, Tag page, Folder View

**Knowledge Navigator**:
The user-facing control for selecting active Tags and thereby determining the current Knowledge Context. When no Tags are active in the Knowledge Navigator, the current location is the Global Knowledge Context.
_Avoid_: Sidebar, filter, breadcrumb

**Words**:
The base Knowledge Type used for a Referent when no more specific Knowledge Type is recognized by the application.
_Avoid_: Text, document, generic

**Bible Passage**:
A Knowledge Type for Scripture references, independent of translation wording and citation-string formatting, including a single verse, one verse range, a chapter, a larger passage, or a set of passages across multiple books of the Bible. A Bible Passage Referent may be a subset of another Bible Passage Referent.
_Avoid_: Bible verse, Scripture tag, translation-specific passage, raw citation string

**Bible Translation**:
A textual rendering, edition, or source text of Scripture that may represent the words of a Bible Passage without changing the identity of the Bible Passage Referent. A Bible Translation may be known to the application before its full text is available.
_Avoid_: Translation Knowledge Type, separate passage

**Quote**:
A Knowledge Type for a cited excerpt from a larger Source or Knowledge Entry that can stand as its own Referent within a Knowledge Context.
_Avoid_: Clip, snippet, excerpt

**Sermon**:
A Knowledge Type for a preached teaching that can be represented by audio, video, transcript, notes, or another Source derived from the act of preaching.
_Avoid_: Talk, sermon clip

**Essay**:
A Knowledge Type for a written composition or assigned written work, initially understood as a named wrapper over Words.
_Avoid_: Paper, document

**Poem**:
A Knowledge Type for a named poetic work, initially understood as a named wrapper over Words.
_Avoid_: Poetry text, document

**Song**:
A Knowledge Type for a named musical work, initially understood as a named wrapper over Words.
_Avoid_: Lyrics, track

**Book**:
A Knowledge Type for a named written work published or treated as a book, initially understood as a named wrapper over Words.
_Avoid_: Text, volume

**Short Story**:
A Knowledge Type for a named short fictional narrative, initially understood as a named wrapper over Words.
_Avoid_: Story, text

**Comment**:
A Knowledge Type for a response to another Knowledge Entry, used when Words-like content needs threaded or relational response behavior.
_Avoid_: Reply, note

**Prayer Request**:
A Knowledge Type for a request for prayer, especially within a church, family, group, or community Knowledge Context.
_Avoid_: Announcement, comment, note

**Event**:
A Knowledge Type for a scheduled occurrence that may request RSVP entries or connect other Knowledge Entries to a real-world meeting, class, service, or gathering.
_Avoid_: Calendar item, appointment

**RSVP**:
A Knowledge Type for a person's response to an Event invitation.
_Avoid_: Attendance, signup

**Lesson**:
A Knowledge Type for a reusable plan for teaching or learning, which may be connected to one or more scheduled Events when taught or used.
_Avoid_: Lesson plan, class notes

**Person**:
A Knowledge Type for a human being who may be referenced as an author, teacher, student, speaker, invitee, commenter, or other participant, whether or not that person is also a User.
_Avoid_: User, account, profile

**Role**:
The relation of a Person to a Knowledge Type or Knowledge Entry, such as author, teacher, student, speaker, parent, or invitee.
_Avoid_: Knowledge Type, user type

**Active Role**:
The Role a User is currently acting in while using the application, such as teacher, student, parent, church member, or administrator. Active Role may be unset in global contexts; when set, there is only one Active Role at a time, and it remains distinct from the User's current Knowledge Page or Active Knowledge Context.
_Avoid_: Knowledge Page, Active Knowledge Context, account

**User**:
A person with access to the application through an account. Every User is linked to one Person Knowledge Entry so the User can be tagged through that Person, but not every Person is a User.
_Avoid_: Person, author, participant

**Organization**:
A Knowledge Type for a collective body recognized by the application, including a School, Church, Family, or Community, that can recognize Tags, receive Knowledge Slots, and participate in Visibility Scopes.
_Avoid_: Account, workspace, tenant

**Group**:
A Knowledge Type for a collection of People, whether or not each Person is linked to a User account.
_Avoid_: User group, organization, audience

**School**:
An Organization associated with formal teaching and learning. A User may sign up through association with a School.
_Avoid_: Class, campus

**Church**:
An Organization associated with Christian worship, teaching, fellowship, and ministry. A User may sign up through association with a Church.
_Avoid_: Ministry, congregation

**Family**:
An Organization formed by grouping people into a household or family unit.
_Avoid_: Household, group

**Community**:
An Organization inferred from a person's hometown or place-based association.
_Avoid_: Hometown, locality

**Place**:
A Knowledge Type for a location that can anchor a Community, Event, Organization, or other Knowledge Entry.
_Avoid_: Address, geography model

**Type Reclassification**:
The refinement of a Tag from Words to a more specific Knowledge Type when the Referent's identity remains the same.
_Avoid_: Retagging, duplicate tag

**Referent**:
The thing a Tag points to, identified by both name and Knowledge Type so similarly named things remain distinct. A Referent may exist before any Knowledge Entry represents it.
_Avoid_: Entity, item, entry

**Represented Referent**:
The same-typed Referent a Knowledge Entry uniquely expresses or records. A Referent may have at most one Knowledge Entry that represents it.
_Avoid_: Primary Referent, subject, entity

**Represents**:
The relationship between a Knowledge Entry and its Represented Referent.
_Avoid_: Is, contains, owns

**References**:
The relationship created when a Knowledge Entry includes a Tag in its Knowledge Context, pointing from that entry to another Referent.
_Avoid_: Contains, belongs to, filed under

**Virtual File System**:
The user-facing model in which Tags behave like folders and Knowledge Entries behave like files that can appear in many folders at once.
_Avoid_: Directory tree, physical storage

**Explore**:
To make a Knowledge Request and browse the Answers surfaced within the mapped Knowledge Context.
_Avoid_: Search, chat, browse

**Contribute**:
To add a future Answer to the knowledgebase, either by submitting a Source, creating a Knowledge Entry directly, or responding to an existing Knowledge Entry.
_Avoid_: Upload, post, store, work

**Contribution Submission**:
A single user intent to Contribute, collecting the material and choices submitted from a composer before it is posted directly or processed through Smart Storage. A Contribution Submission may include multiple Sources and contribution guidance, but it is not itself a Knowledge Entry.
_Avoid_: Source, Knowledge Entry, upload bundle

**Primary Intended Entry**:
The one Knowledge Entry a Contribution Submission is primarily meant to create or update. Smart Storage may propose additional derived Knowledge Entries from the same Contribution Submission without changing the Primary Intended Entry.
_Avoid_: Parent entry, main Source, bundle entry

**Authored Text Source**:
User-authored or user-pasted text submitted as substantive raw material in a Contribution Submission. Authored Text Source is a kind of Source, distinct from the Words Knowledge Type.
_Avoid_: Words, body text, editor text

**Contribution Note**:
Non-substantive guidance a User provides to explain or steer a Contribution Submission without itself becoming represented knowledge by default.
_Avoid_: Source, Words, entry body

**Link Preview**:
Fetched metadata that helps a User recognize an external URL in a Contribution Submission or Entry Representation. A Link Preview is not a Knowledge Entry, Factual Provenance, or Human Weight Evidence by itself.
_Avoid_: Knowledge Entry, evidence, Source

**Knowledge Slot**:
A predefined request for one Knowledge Entry of a specified Knowledge Type within a specified Knowledge Context. A Knowledge Slot directs a user, group, organization, network, or open audience to Contribute a missing future Answer.
_Avoid_: Todo, assignment, prompt, bounty, call to action

**Fulfillment**:
The state of a Knowledge Slot after it has received the requested Knowledge Entry.
_Avoid_: Completion, submission, done

**Subscription**:
A user's standing interest in activity within a Knowledge Context, Organization, Knowledge Slot, or Event.
_Avoid_: Alert, follow, notification setting

**Notification**:
A user-visible notice that relevant activity occurred within a Subscription, assigned Knowledge Slot, or Event participation.
_Avoid_: Message, feed item

**Source**:
Raw user-provided material submitted to the application, such as an uploaded file, pasted text, note, URL, or other input.
_Avoid_: File, upload, raw data

**Bronze Layer**:
The preserved raw record of submitted Sources, stored as close as possible to their original form. In Smart Storage, Bronze Layer is to Source as Silver Layer is to Smart Storage Proposal and Gold Layer is to Knowledge Entry.
_Avoid_: Bronze data, raw folder

**Smart Storage**:
The AI-assisted process of preserving a Source, identifying relevant Tags, and refining or enriching the Source toward one or more pieces of structured knowledge the application understands. Smart Storage can propose Gold Layer knowledge, but user confirmation is required before that knowledge becomes Gold.
_Avoid_: Upload, import, ingestion

**Factual Enrichment**:
The Smart Storage act of using external factual information to refine a Source when the Source points to knowledge it does not itself contain. Factual Enrichment is not measured by Human Weight unless it becomes part of a user-confirmed Knowledge Entry.
_Avoid_: AI authorship, generated answer, hallucination

**Factual Provenance**:
The evidence trail for an enriched fact in a Smart Storage Proposal or Knowledge Entry, identifying the external URL, Knowledge Entry, or model-only basis for the proposed fact. Factual Provenance may support the whole proposed entry or a specific factual field without changing who confirmed or owns the whole Knowledge Entry.
_Avoid_: Source, ownership, proof

**Proposal Confidence**:
A coarse Smart Storage review signal for how well a Smart Storage Proposal or enriched factual field appears supported by its type match, candidates, and Factual Provenance. Proposal Confidence guides review but is not Human Weight, truth, or Gold Layer confirmation.
_Avoid_: Human Weight, truth score, AI quality score

**Smart Storage Proposal**:
A durable Silver Layer candidate for creating or updating one Knowledge Entry from Smart Storage before user confirmation, expressed in Smart Storage Contract terms rather than persistence-specific write operations. A Smart Storage Proposal may be accepted, rejected, or edited before it affects Gold Layer knowledge.
_Avoid_: Draft entry, AI answer, unconfirmed Knowledge Entry

**Smart Storage Run**:
A record of one Smart Storage attempt against a Source, preserving the contract versions, request-specific input snapshot, and raw model output that produced, failed to produce, or helped produce Smart Storage Proposals.
_Avoid_: LLM call, job log, parser output

**Smart Storage Contract**:
The versioned stable domain contract Smart Storage gives to an LLM so it can match Sources to Knowledge Types and propose structured knowledge. A Smart Storage Contract includes the reusable domain shape needed for recognition and proposal generation without exposing the raw persistence schema or request-specific input as the model's contract.
_Avoid_: Database schema prompt, raw schema, implementation prompt

**Reprocessing**:
The act of revisiting existing Sources or Knowledge Entries when the application gains new Knowledge Types or improved recognition, so previously untyped knowledge can be represented more specifically.
_Avoid_: Migration, retagging, cleanup

**Upgrade Candidate**:
A Source or Knowledge Entry that may be refined further because a new or improved Knowledge Type can represent knowledge it previously held only indirectly.
_Avoid_: Demoted entry, failed gold, invalid entry

**Silver Layer**:
A durable intermediate refinement layer where Source data is cleaned, structured, reviewed, or prepared beyond its raw form before it becomes typed and formatted knowledge the application understands. In Smart Storage, Silver Layer records are Smart Storage Proposals.
_Avoid_: Final answer, typed knowledge, truth

**Gold Layer**:
Knowledge Entries that have been represented according to the most specific Knowledge Types the application currently understands. In Smart Storage, Gold Layer records are confirmed Knowledge Entries.
_Avoid_: Final truth, human-approved truth, business-ready data

**Recognized Context**:
The union of Knowledge Contexts where a User or Organization has taken meaningful action across their activity history, represented by the typed Tags they have interacted with. Recognized Context indicates Referents the User or Organization recognizes as meaningful within their domain, but it is not the same as the User's Active Knowledge Context.
_Avoid_: Truth model, personal truth, organization truth
