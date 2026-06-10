# Knowledgebase

This context describes the core domain language for a knowledgebase that helps Christian organizations store, retrieve, and work from human knowledge. The application treats named things in the real world as first-class references for organizing answers and work.

## Language

**Knowledge Context**:
The set of Tags that locate a Knowledge Entry and shape which Knowledge Requests it can help answer.
_Avoid_: Context, folder, AI context window

**Global Knowledge Context**:
The Knowledge Context available to every user and organization by default, containing the Referents all users and organizations must acknowledge as infallible Recognized Context. In this application, the Global Knowledge Context contains Scripture.
_Avoid_: Global Scripture Context, public folder, Bible folder

**Tag**:
A named, typed pointer to a Referent and the intended set of all knowledge about it, including content already stored in the application and relevant knowledge that has not yet been stored or tagged.
_Avoid_: Label, keyword

**Knowledge Type**:
A typed shape of knowledge the application understands, such as a Bible Passage, Question, Quote, Sermon, Lesson, Event, Person, Organization, Group, Place, or Words. Knowledge Types may be added over time as the application learns to recognize more specific kinds of Referents.
_Avoid_: Schema, entity type, file type

**Knowledge Entry**:
A typed, contextualized unit of knowledge in the application, whether created directly by a user or produced through Smart Storage. A Knowledge Entry's Knowledge Context is constituted by its Tags.
_Avoid_: File, document, source, post

**Visibility Scope**:
The audience allowed to access a Knowledge Entry, such as one user, an organization, a group, a network of organizations, or everyone.
_Avoid_: Public/private, global context, sharing folder

**Type Behavior**:
The domain behavior the application applies to a Knowledge Type, including how entries of that type are recognized, related, displayed, or scoped.
_Avoid_: Implementation, schema behavior

**Answer**:
A Knowledge Entry considered as something that can help satisfy future Knowledge Requests in whole or in part.
_Avoid_: AI response, chat reply

**Human Weight**:
A rating of how strongly a Knowledge Entry reflects human authorship, judgment, use, or divine inspiration, scored from Slop at 0 to Soul at 100. Bible passages have full Soul because they are inspired by the Holy Spirit.
_Avoid_: AI score, quality score, robot score

**Knowledge Request**:
A user request for knowledge, help, or work that is answered from the application's Knowledge Entries within an applicable Knowledge Context.
_Avoid_: Prompt, query, chat message

**Question**:
A Knowledge Type for a question mapped to a Knowledge Context, preserving useful information about what parts of that Knowledge Context need to be connected or answered.
_Avoid_: Prompt, query

**Question Space**:
The set of Knowledge Requests that could meaningfully be asked within a Knowledge Context.
_Avoid_: Search space, prompt space, chat history

**Topic**:
A Knowledge Type for a named subject of discussion that Knowledge Entries can address, argue about, explain, illustrate, or apply.
_Avoid_: Context page, forum, category

**Series**:
A Knowledge Type for a named collection or sequence of related Knowledge Entries, such as sermons, lessons, books, poems, stories, songs, or Events.
_Avoid_: Topic, folder, collection

**Context Page**:
A user-facing place for Explore and Contribute within the Knowledge Context determined by the Knowledge Navigator's active Tags.
_Avoid_: Topic, channel, folder

**Knowledge Navigator**:
The user-facing control for selecting active Tags and thereby determining the current Knowledge Context. When no Tags are active in the Knowledge Navigator, the current location is the Global Knowledge Context.
_Avoid_: Sidebar, filter, breadcrumb

**Words**:
The base Knowledge Type used for a Referent when no more specific Knowledge Type is recognized by the application.
_Avoid_: Text, document, generic

**Bible Passage**:
A Knowledge Type for Scripture references, including a single verse, one verse range, a chapter, a larger passage, or a set of passages across multiple books of the Bible. A Bible Passage Referent may be a subset of another Bible Passage Referent.
_Avoid_: Bible verse, Scripture tag

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

**User**:
A person with access to the application through an account. A User may be linked to a Person Referent, but not every Person is a User.
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
The thing a Tag points to, identified by both name and Knowledge Type so similarly named things remain distinct.
_Avoid_: Entity, item

**Represents**:
The relationship between a Knowledge Entry and the Referent it primarily expresses or records.
_Avoid_: Is, contains, owns

**References**:
The relationship created when a Knowledge Entry includes a Tag in its Knowledge Context, pointing from that entry to another Referent.
_Avoid_: Contains, belongs to, filed under

**Folder View**:
A browseable view over knowledge related to a Referent.
_Avoid_: Folder, directory

**Virtual File System**:
The user-facing model in which Tags behave like folders and Knowledge Entries behave like files that can appear in many folders at once.
_Avoid_: Directory tree, physical storage

**Explore**:
To make a Knowledge Request and browse the Answers surfaced within the mapped Knowledge Context.
_Avoid_: Search, chat, browse

**Contribute**:
To add a future Answer to the knowledgebase, either by submitting a Source, creating a Knowledge Entry directly, or responding to an existing Knowledge Entry.
_Avoid_: Upload, post, store, work

**Knowledge Slot**:
A predefined request for one or more Knowledge Entries of a specified Knowledge Type within a specified Knowledge Context. A Knowledge Slot directs a user, group, organization, network, or open audience to Contribute a missing future Answer.
_Avoid_: Todo, assignment, prompt, bounty, call to action

**Fulfillment**:
The state of a Knowledge Slot after it has received the requested Knowledge Entry or Entries.
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
The preserved raw record of submitted Sources, stored as close as possible to their original form.
_Avoid_: Bronze data, raw folder

**Smart Storage**:
The AI-assisted process of preserving a Source, identifying relevant Tags, and refining the Source toward one or more pieces of structured knowledge the application understands.
_Avoid_: Upload, import, ingestion

**Reprocessing**:
The act of revisiting existing Sources or Knowledge Entries when the application gains new Knowledge Types or improved recognition, so previously untyped knowledge can be represented more specifically.
_Avoid_: Migration, retagging, cleanup

**Upgrade Candidate**:
A Source or Knowledge Entry that may be refined further because a new or improved Knowledge Type can represent knowledge it previously held only indirectly.
_Avoid_: Demoted entry, failed gold, invalid entry

**Silver Layer**:
An intermediate refinement layer where Source data is cleaned and structured beyond its raw form, before it becomes typed and formatted knowledge the application understands.
_Avoid_: Final answer, typed knowledge, truth

**Gold Layer**:
Knowledge Entries that have been represented according to the most specific Knowledge Types the application currently understands.
_Avoid_: Final truth, human-approved truth, business-ready data

**Recognized Context**:
The set of typed Tags a person or organization has interacted with, indicating Referents they recognize as meaningful within their domain.
_Avoid_: Truth model, personal truth, organization truth
