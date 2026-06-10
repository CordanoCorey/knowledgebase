# Product Core

This product is a knowledgebase for Christian users and organizations that treats named things in the real world as first-class references for storing, finding, and doing work. It can be understood as a smart Google Drive or virtual file system: Tags behave like folders, Knowledge Entries behave like files, and an entry can appear in many folders because it can reference many Referents.

The application is not only a repository. It is intended to become the place where people ask for knowledge, contribute future answers, and do day-to-day work from the same context where prior answers are found.

## Product Commitments

The application is built for Christians who affirm the inerrancy of Scripture. The Global Knowledge Context is available to every user and organization by default, and in this application it contains Scripture because Scripture is the infallible Recognized Context all users and organizations must acknowledge.

The application should promote human thought over automated output while still using AI for useful recognition, extraction, structuring, and retrieval. AI helps store and surface knowledge; it does not replace human judgment.

Knowledge Entries are rated by Human Weight on a Slop to Soul scale from 0 to 100. Bible passages have full Soul because they are inspired by the Holy Spirit.

## Core Model

A Knowledge Entry is a typed, contextualized unit of knowledge. It represents one primary Referent and references other Referents through its Tags. Those Tags constitute the entry's Knowledge Context.

A Tag is a named, typed pointer to a Referent and to the intended set of knowledge about that Referent. A Referent is identified by name plus Knowledge Type, so similarly named things remain distinct, such as `Charlotte's Web, book` and `Charlotte's Web, essay`.

The base Knowledge Type is Words. When the application does not yet understand a more specific type, a Referent may be represented as Words until that type is added. Later, Type Reclassification can refine the Tag from Words to a more specific Knowledge Type when the Referent's identity is the same.

Knowledge Types are how the application learns new domain behavior. Adding a type means teaching the app how to recognize, relate, display, scope, and work with entries of that type.

## Core Loop

The product loop has two main user actions:

1. **Explore**: the user makes a Knowledge Request, and the app maps it to a Knowledge Context where relevant Answers can be browsed.
2. **Contribute**: the user adds a future Answer by submitting a Source, creating a Knowledge Entry directly, or responding to an existing Knowledge Entry.

Explore and Contribute should happen in the same place. Wherever users see Answers, they should also be able to add the missing future Answer that belongs in that Knowledge Context.

The user-facing place for this loop is a Context Page. A Context Page is determined by the current setting of the Knowledge Navigator: the active Tags define the current Knowledge Context. When no Tags are active in the Knowledge Navigator, the current location is the Global Knowledge Context.

Topic should be reserved for a named subject of discussion, such as `atonement`, `friendship`, or `Christian education`. Topic is an MVP Knowledge Type, but it should not mean the Context Page itself. A Context Page can include one Topic Tag, many Tags, or no active Tags in the Global Knowledge Context case.

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

The bronze, silver, and gold progression describes the degree to which useful information has been extracted, cleaned, structured, and shaped from the original Source:

- The Bronze Layer preserves submitted Sources as close as possible to their original form.
- The Silver Layer is an intermediate refinement layer for cleaned and structured data that has not yet become fully typed knowledge.
- The Gold Layer contains Knowledge Entries represented according to the most specific Knowledge Types the application currently understands.

One Source can produce many Knowledge Entries. For example, an uploaded essay or transcript can produce one parent entry and many Quote entries, each with its own Knowledge Context. The parent entry's Knowledge Context may be a superset of the union of its quotes' Knowledge Contexts.

Reprocessing revisits existing Sources or Knowledge Entries when the application gains new Knowledge Types or improved recognition. A previously complete entry can become an Upgrade Candidate when a new type reveals knowledge it held only indirectly.

Source is not an MVP Knowledge Type. A Source belongs to the Bronze Layer as raw submitted material and can produce Knowledge Entries, but it should not itself be treated as represented knowledge in the Gold Layer.

Media formats such as audio, video, image, and file are not MVP Knowledge Types. They belong to Sources, attachments, or representations of Knowledge Entries. For example, a Sermon may be represented by audio, video, transcript, or notes, but its Knowledge Type remains Sermon.

## Knowledge Slots

A Knowledge Slot is a predefined request for one or more Knowledge Entries of a specified Knowledge Type within a specified Knowledge Context. It is the app's way to request future Answers from users.

Examples:

- A teacher assigns an essay on `Pride and Prejudice, book`; each student receives a Knowledge Slot for an Essay entry in that Knowledge Context.
- A user creates an Event entry and invites people to fulfill RSVP slots.
- A Knowledge Request maps to a Knowledge Context with no existing Answers; the user creates a Knowledge Slot directed to an expert, a group, an organization network, or an open audience until an Answer is contributed.

Fulfillment is the state of a Knowledge Slot after the requested Knowledge Entry or Entries exist.

The MVP should classify calls to action generically as Knowledge Slots rather than adding an Assignment Knowledge Type. For example, a teacher assigning an Essay, a user requesting an expert Answer, or an Event asking for RSVP entries are all Knowledge Slots requesting future Knowledge Entries within a specified Knowledge Context.

Task and Todo are not MVP Knowledge Types. Calls to action that request future Knowledge Entries should be represented as Knowledge Slots; tasks that do not request knowledge are outside the MVP.

Question is an MVP Knowledge Type because questions provide valuable information about which parts of a Knowledge Context need to be connected. A user may ask a transient Knowledge Request, but a Question can also be represented as a Knowledge Entry within the Knowledge Context it maps to, helping reveal the shape of the Question Space.

Question Template should be deferred as a Knowledge Type. Reusable request or slot templates introduce authoring and reuse behavior beyond the MVP.

Template is not an MVP Knowledge Type. Templates are reusable authoring structures for creating other entries, questions, slots, lessons, or related workflows.

## Visibility

Visibility Scope belongs to Knowledge Entries. A Knowledge Entry may be visible to one user, an organization, a group, a network of organizations, or everyone.

Tags and Referents become visible indirectly through visible Knowledge Entries that represent or reference them. The Global Knowledge Context is not the same thing as global visibility: an entry can be visible to everyone without belonging to the Global Knowledge Context.

## MVP Direction

The MVP Knowledge Type set is locked as: Words, Bible Passage, Topic, Series, Question, Quote, Sermon, Essay, Poem, Song, Book, Short Story, Lesson, Comment, Prayer Request, Event, RSVP, Person, Organization, Group, and Place. New Knowledge Types should be deferred unless they prove required for one of the MVP loops.

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

Bookmark is not a Knowledge Type. A bookmark is a User relationship to a Knowledge Entry or Context Page, used to create saved views and possibly subscription-style notifications.

Subscription is not a Knowledge Type. A subscription is a User relationship to a Context Page, Tag, Knowledge Entry, Group, Event, or Organization that affects notification behavior.

Context Page is not a Knowledge Type. It is a user-facing place or view determined by the Knowledge Navigator's active Tags.

Knowledge Context is not a Knowledge Type. It is the set of Tags that locates Knowledge Entries and Knowledge Requests.

Visibility Scope is not a Knowledge Type. It is access or audience metadata on a Knowledge Entry.

Lesson is an MVP Knowledge Type because schools and church classes need planned teaching material that can be connected to Events. The user experience should feel like working with a lesson plan, but the canonical Knowledge Type is Lesson. A reusable Lesson may be connected to many scheduled uses over time, such as teaching the same lesson in different years.

Person is an MVP Knowledge Type because churches and schools need to reference authors, teachers, students, speakers, invitees, commenters, and other participants. A Person may optionally link to a User account, but Person and User are not the same thing. For example, C.S. Lewis can be a Person who authored a Book without ever being a User, while a student can be both a User and the Person who authored an Essay.

Account is not a Knowledge Type. Account is authentication and access infrastructure for a User.

User is not a Knowledge Type. User is the account or access identity that may link to a Person; Person is the Knowledge Type.

Profile is not a Knowledge Type. A profile is a view or presentation of a Person, User, Organization, Group, or related referent.

Character is not an MVP Knowledge Type. Fictional characters should be represented as Person Referents in the MVP, with a later split only if fictional-person behavior becomes necessary.

Bible Character and Biblical Figure are not MVP Knowledge Types. Biblical people should be represented as Person Referents.

Role is not an MVP Knowledge Type. A Role is the relation of a Person to a Knowledge Type or Knowledge Entry, such as author of a Book, teacher of a Lesson, student in a Group, speaker of a Sermon, parent in a Family, or invitee to an Event.

Author is not an MVP Knowledge Type. Author is a Role of a Person in relation to a Book, Essay, Poem, Song, Short Story, Quote, or other Knowledge Entry.

Speaker, Preacher, Teacher, and Student are not MVP Knowledge Types. They are Roles of a Person in relation to a Sermon, Lesson, Event, Group, Organization, Knowledge Slot, or other Knowledge Entry.

Denomination should be deferred as a Knowledge Type. It may begin as an Organization attribute or Topic and can become a Knowledge Type later if denominational affiliation needs first-class discovery, visibility, or trust behavior.

Ministry is not an MVP Knowledge Type. A ministry may be represented as a Group, Organization-related body, Topic, Series, or Event context depending on how it is used, until distinct ministry behavior is needed.

Organization is an MVP Knowledge Type, but the MVP should understand only four Organization kinds: School, Church, Family, and Community. To sign up, a User must be associated with a School or Church. Users can also be grouped into Families and can specify a hometown to become a de facto member of a Community. Deeper organization networks, permissions, and membership workflows should be reserved for later.

Network should be a Phase 2 Knowledge Type or organization capability. In the MVP, Organization plus Visibility Scope is enough; named networks of organizations can be added when cross-organization behavior becomes first-class.

Group is an MVP Knowledge Type for a collection of People, not a collection of Users. Since a User may link to a Person, user-based participation can still be represented through Person membership, while Groups can also include people who are not application Users. Group should cover informal or temporary collections such as classes, teams, committees, or volunteer cohorts without forcing them to become Organizations.

Groups can receive Knowledge Slots, but fulfillment is performed by Users. When a Knowledge Slot is directed to a Group, the expected fulfillers are Users linked to People in that Group. People who are not linked to Users can still belong to Groups as historical or referential members, but they cannot perform user actions until linked to an account.

Membership is not an MVP Knowledge Type. It is the relationship between a Person and a Group or Organization, with user actions performed through a linked User when one exists.

Place is an MVP Knowledge Type because Community depends on hometown or place-based association, and Events often need locations. The MVP should keep Place narrow: enough to represent hometowns, event locations, and organization locations, without becoming a full geography model.

Map is not a Knowledge Type. A map is a view or representation over Places, Organizations, Events, and Communities.

Address is not a Knowledge Type. Address is an attribute or locator for a Place, Organization, or Event.

Time and Date are not Knowledge Types. They are scheduling attributes of Events and other scheduled entries.

The MVP should present Scripture references through one Knowledge Type: Bible Passage. Bible Passage can represent one verse, many verses, a chapter, a larger passage, or a set of passages across multiple books of the Bible. The application must understand subset relationships between Bible Passage Referents, such as `Matthew 24:1` being part of both `Matthew 24:1-25:46` and `Matthew 24:1-25:46; Mark 13:1-37; Luke 21:5-36`.

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

## Open Questions

- What does the Silver Layer need to contain before a Knowledge Entry reaches the Gold Layer?
- How should Human Weight be calculated or assigned for ordinary user-created entries?
- What Type Behaviors belong to the first non-Scripture Knowledge Types?
- How should networks of organizations be represented in Visibility Scope?
