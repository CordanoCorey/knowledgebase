import type { ElementType, ReactElement } from "react";
import {
  BookOpen,
  CalendarDays,
  Clock,
  Compass,
  FileText,
  Landmark,
  MapPin,
  MousePointerClick,
  Tag,
  UserCircle,
  Users,
} from "lucide-react";
import {
  formatKnowledgeTypeLabel,
  type ActiveTag,
  type KnowledgeType,
} from "../knowledgeContracts";

export type KnowledgeTypeOverviewProps = {
  referent: ActiveTag;
};

type OverviewComponent = (props: KnowledgeTypeOverviewProps) => ReactElement;

type WordsOverviewDetail<TKnowledgeType extends KnowledgeType = "words"> = {
  context: string;
  contextLabel: string;
  detailFocus: string;
  detailFocusLabel: string;
  knowledgeType: TKnowledgeType;
  summary: string;
  typedDetail: string;
  typedDetailLabel: string;
  wordsLayer: string;
};

type BiblePassageOverviewDetail = WordsOverviewDetail<"biblePassage">;
type TopicOverviewDetail = WordsOverviewDetail<"topic">;
type SeriesOverviewDetail = WordsOverviewDetail<"series">;
type QuestionOverviewDetail = WordsOverviewDetail<"question">;
type QuoteOverviewDetail = WordsOverviewDetail<"quote">;
type SermonOverviewDetail = WordsOverviewDetail<"sermon">;
type EssayOverviewDetail = WordsOverviewDetail<"essay">;
type PoemOverviewDetail = WordsOverviewDetail<"poem">;
type SongOverviewDetail = WordsOverviewDetail<"song">;
type BookOverviewDetail = WordsOverviewDetail<"book">;
type ShortStoryOverviewDetail = WordsOverviewDetail<"shortStory">;
type LessonOverviewDetail = WordsOverviewDetail<"lesson">;
type CommentOverviewDetail = WordsOverviewDetail<"comment">;
type PrayerRequestOverviewDetail = WordsOverviewDetail<"prayerRequest">;
type EventOverviewDetail = WordsOverviewDetail<"event">;
type RsvpOverviewDetail = WordsOverviewDetail<"rsvp">;
type PersonOverviewDetail = WordsOverviewDetail<"person">;
type OrganizationOverviewDetail = WordsOverviewDetail<"organization">;
type GroupOverviewDetail = WordsOverviewDetail<"group">;
type PlaceOverviewDetail = WordsOverviewDetail<"place">;

export const KNOWLEDGE_TYPE_OVERVIEWS = {
  words: WordsOverview,
  biblePassage: BiblePassageOverview,
  topic: TopicOverview,
  series: SeriesOverview,
  question: QuestionOverview,
  quote: QuoteOverview,
  sermon: SermonOverview,
  essay: EssayOverview,
  poem: PoemOverview,
  song: SongOverview,
  book: BookOverview,
  shortStory: ShortStoryOverview,
  lesson: LessonOverview,
  comment: CommentOverview,
  prayerRequest: PrayerRequestOverview,
  event: EventOverview,
  rsvp: RsvpOverview,
  person: PersonOverview,
  organization: OrganizationOverview,
  group: GroupOverview,
  place: PlaceOverview,
} satisfies Record<KnowledgeType, OverviewComponent>;

export function KnowledgeTypeOverview({ referent }: KnowledgeTypeOverviewProps) {
  const Overview = KNOWLEDGE_TYPE_OVERVIEWS[referent.knowledgeType];
  return <Overview referent={referent} />;
}

function WordsOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: WordsOverviewDetail = {
    knowledgeType: "words",
    summary: `${referent.label} is represented at the Words layer until a more specific Knowledge Type is recognized.`,
    wordsLayer: "Title, preview, human weight, visibility, and representations.",
    typedDetailLabel: "Type Detail",
    typedDetail: "No separate type-detail row; Words is the shared entry shape.",
    contextLabel: "Context Role",
    context: "Can stand alone or carry other Tags in its Knowledge Context.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Named textual knowledge.",
  };

  return <WordsOverviewBase detail={detail} icon={FileText} referent={referent} />;
}

function BiblePassageOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: BiblePassageOverviewDetail = {
    knowledgeType: "biblePassage",
    summary: `${referent.label} is a Scripture Referent independent of translation wording or citation formatting.`,
    wordsLayer: "Referenced by authored entries without becoming an authored entry itself.",
    typedDetailLabel: "Passage Detail",
    typedDetail: "Normalized verse ranges, canonical labels, and translation text availability.",
    contextLabel: "Context Role",
    context: "Anchors Answers, Lessons, Sermons, Quotes, and other entries to Scripture.",
    detailFocusLabel: "Referent Shape",
    detailFocus: "Canonical Bible passage.",
  };

  return <WordsOverviewBase detail={detail} icon={BookOpen} referent={referent} />;
}

function TopicOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: TopicOverviewDetail = {
    knowledgeType: "topic",
    summary: `${referent.label} is a concept, doctrine, theme, or subject that gathers related knowledge.`,
    wordsLayer: "Shares the base entry title, preview, search text, and visibility shape.",
    typedDetailLabel: "Topic Detail",
    typedDetail: "Conceptual identity without extra MVP-specific fields.",
    contextLabel: "Context Role",
    context: "Connects entries that address the same idea across sources and formats.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Doctrine, theme, or subject.",
  };

  return <WordsOverviewBase detail={detail} icon={Tag} referent={referent} />;
}

function SeriesOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: SeriesOverviewDetail = {
    knowledgeType: "series",
    summary: `${referent.label} is an ordered or curated collection of related entries, Tags, or Slots.`,
    wordsLayer: "Keeps the shared entry identity while sequence data can grow around it.",
    typedDetailLabel: "Series Detail",
    typedDetail: "Series members can point to entries, Tags, or Knowledge Slots.",
    contextLabel: "Context Role",
    context: "Groups lessons, sermons, books, or topical progressions into a named path.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Curated sequence.",
  };

  return <WordsOverviewBase detail={detail} icon={Compass} referent={referent} />;
}

function QuestionOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: QuestionOverviewDetail = {
    knowledgeType: "question",
    summary: `${referent.label} is an inquiry that can attract future Answers and clarify a Knowledge Context.`,
    wordsLayer: "Carries the same base entry fields as Words.",
    typedDetailLabel: "Question Detail",
    typedDetail: "Question text records the inquiry being asked.",
    contextLabel: "Context Role",
    context: "Frames Answer entries and open Knowledge Slots.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Stored inquiry.",
  };

  return <WordsOverviewBase detail={detail} icon={MousePointerClick} referent={referent} />;
}

function QuoteOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: QuoteOverviewDetail = {
    knowledgeType: "quote",
    summary: `${referent.label} is a cited excerpt that can stand as its own Referent.`,
    wordsLayer: "Uses the shared Words-level identity and preview.",
    typedDetailLabel: "Quote Detail",
    typedDetail: "Quoted person, source entry, source text, and locator when known.",
    contextLabel: "Context Role",
    context: "Connects an excerpt to people, books, sermons, passages, and topics.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Cited excerpt.",
  };

  return <WordsOverviewBase detail={detail} icon={FileText} referent={referent} />;
}

function SermonOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: SermonOverviewDetail = {
    knowledgeType: "sermon",
    summary: `${referent.label} is a preached teaching represented by audio, video, transcript, notes, or related sources.`,
    wordsLayer: "Shares the base entry fields for discovery and preview.",
    typedDetailLabel: "Sermon Detail",
    typedDetail: "Preached date and preaching-derived representations.",
    contextLabel: "Context Role",
    context: "Links passages, topics, speakers, events, and source media.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Preached teaching.",
  };

  return <WordsOverviewBase detail={detail} icon={BookOpen} referent={referent} />;
}

function EssayOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: EssayOverviewDetail = {
    knowledgeType: "essay",
    summary: `${referent.label} is a written composition or assigned written work.`,
    wordsLayer: "Extends the base Words shape as a named written work.",
    typedDetailLabel: "Essay Detail",
    typedDetail: "No extra MVP-specific fields beyond the shared entry shape.",
    contextLabel: "Context Role",
    context: "Connects a composition to its author, assignment, topics, and sources.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Written composition.",
  };

  return <WordsOverviewBase detail={detail} icon={FileText} referent={referent} />;
}

function PoemOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: PoemOverviewDetail = {
    knowledgeType: "poem",
    summary: `${referent.label} is a named poetic work represented through the common Words layer.`,
    wordsLayer: "Extends Words for title, preview, representations, and visibility.",
    typedDetailLabel: "Poem Detail",
    typedDetail: "No extra MVP-specific fields beyond the shared entry shape.",
    contextLabel: "Context Role",
    context: "Connects a poem to authors, books, lessons, topics, and source texts.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Poetic work.",
  };

  return <WordsOverviewBase detail={detail} icon={FileText} referent={referent} />;
}

function SongOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: SongOverviewDetail = {
    knowledgeType: "song",
    summary: `${referent.label} is a named musical work represented through Words-level metadata and related media.`,
    wordsLayer: "Extends Words for title, preview, visibility, and representations.",
    typedDetailLabel: "Song Detail",
    typedDetail: "No extra MVP-specific fields beyond the shared entry shape.",
    contextLabel: "Context Role",
    context: "Connects lyrics, recordings, authors, events, and themes.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Musical work.",
  };

  return <WordsOverviewBase detail={detail} icon={FileText} referent={referent} />;
}

function BookOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: BookOverviewDetail = {
    knowledgeType: "book",
    summary: `${referent.label} is a named written work published or treated as a book.`,
    wordsLayer: "Extends Words for title, preview, search, visibility, and representations.",
    typedDetailLabel: "Book Detail",
    typedDetail: "ISBN when known, plus related source and representation data.",
    contextLabel: "Context Role",
    context: "Connects authors, quotes, lessons, topics, and source material.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Book-length work.",
  };

  return <WordsOverviewBase detail={detail} icon={BookOpen} referent={referent} />;
}

function ShortStoryOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: ShortStoryOverviewDetail = {
    knowledgeType: "shortStory",
    summary: `${referent.label} is a named short fictional narrative represented through the Words layer.`,
    wordsLayer: "Extends Words for identity, preview, visibility, and representations.",
    typedDetailLabel: "Short Story Detail",
    typedDetail: "No extra MVP-specific fields beyond the shared entry shape.",
    contextLabel: "Context Role",
    context: "Connects authors, collections, lessons, topics, and source texts.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Short fictional narrative.",
  };

  return <WordsOverviewBase detail={detail} icon={BookOpen} referent={referent} />;
}

function LessonOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: LessonOverviewDetail = {
    knowledgeType: "lesson",
    summary: `${referent.label} is a reusable plan for teaching or learning.`,
    wordsLayer: "Extends Words with lesson-specific planning details.",
    typedDetailLabel: "Lesson Detail",
    typedDetail: "Planned duration and teaching representations when known.",
    contextLabel: "Context Role",
    context: "Connects passages, topics, teachers, groups, and scheduled uses.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Teaching plan.",
  };

  return <WordsOverviewBase detail={detail} icon={FileText} referent={referent} />;
}

function CommentOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: CommentOverviewDetail = {
    knowledgeType: "comment",
    summary: `${referent.label} is a response to another Knowledge Entry.`,
    wordsLayer: "Extends Words with threaded or relational response behavior.",
    typedDetailLabel: "Comment Detail",
    typedDetail: "Parent entry relationship for the entry being discussed.",
    contextLabel: "Context Role",
    context: "Connects response text to the entry, person, topic, or passage in view.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Entry response.",
  };

  return <WordsOverviewBase detail={detail} icon={FileText} referent={referent} />;
}

function PrayerRequestOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: PrayerRequestOverviewDetail = {
    knowledgeType: "prayerRequest",
    summary: `${referent.label} is a request for prayer within a church, family, group, or community context.`,
    wordsLayer: "Extends Words with prayer-specific status.",
    typedDetailLabel: "Prayer Detail",
    typedDetail: "Open, answered, or closed prayer status.",
    contextLabel: "Context Role",
    context: "Connects needs to people, groups, organizations, and updates.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Prayer need.",
  };

  return <WordsOverviewBase detail={detail} icon={FileText} referent={referent} />;
}

function EventOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: EventOverviewDetail = {
    knowledgeType: "event",
    summary: `${referent.label} is a scheduled occurrence connected to real-world teaching, worship, class, or gathering.`,
    wordsLayer: "Extends Words with scheduling and location details.",
    typedDetailLabel: "Event Detail",
    typedDetail: "Start time, optional end time, time zone, and location.",
    contextLabel: "Context Role",
    context: "Connects lessons, RSVP entries, groups, places, and organizations.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Scheduled occurrence.",
  };

  return <WordsOverviewBase detail={detail} icon={CalendarDays} referent={referent} />;
}

function RsvpOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: RsvpOverviewDetail = {
    knowledgeType: "rsvp",
    summary: `${referent.label} is a person's response to an Event invitation.`,
    wordsLayer: "Extends Words with event response details.",
    typedDetailLabel: "RSVP Detail",
    typedDetail: "Event, person, response, and response time.",
    contextLabel: "Context Role",
    context: "Connects attendance responses to Events and People.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Invitation response.",
  };

  return <WordsOverviewBase detail={detail} icon={Clock} referent={referent} />;
}

function PersonOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: PersonOverviewDetail = {
    knowledgeType: "person",
    summary: `${referent.label} is a human being who can be referenced as author, teacher, student, speaker, invitee, or participant.`,
    wordsLayer: "Extends Words with person identity and profile-related relationships.",
    typedDetailLabel: "Person Detail",
    typedDetail: "Person entries currently rely on the shared entry shape.",
    contextLabel: "Context Role",
    context: "Connects roles across entries, groups, organizations, events, and Slots.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Human referent.",
  };

  return <WordsOverviewBase detail={detail} icon={UserCircle} referent={referent} />;
}

function OrganizationOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: OrganizationOverviewDetail = {
    knowledgeType: "organization",
    summary: `${referent.label} is a collective body such as a School, Church, Family, or Community.`,
    wordsLayer: "Extends Words with organization-specific membership and access context.",
    typedDetailLabel: "Organization Detail",
    typedDetail: "Organization kind and active state when known.",
    contextLabel: "Context Role",
    context: "Connects members, groups, Slots, visibility scopes, and recognized Tags.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Collective body.",
  };

  return <WordsOverviewBase detail={detail} icon={Landmark} referent={referent} />;
}

function GroupOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: GroupOverviewDetail = {
    knowledgeType: "group",
    summary: `${referent.label} is a collection of People, whether or not each Person is linked to a User account.`,
    wordsLayer: "Extends Words with group membership context.",
    typedDetailLabel: "Group Detail",
    typedDetail: "Group entries currently rely on the shared entry shape.",
    contextLabel: "Context Role",
    context: "Connects People to classes, teams, committees, cohorts, and Slots.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Collection of People.",
  };

  return <WordsOverviewBase detail={detail} icon={Users} referent={referent} />;
}

function PlaceOverview({ referent }: KnowledgeTypeOverviewProps) {
  const detail: PlaceOverviewDetail = {
    knowledgeType: "place",
    summary: `${referent.label} is a location that can anchor a Community, Event, Organization, or other entry.`,
    wordsLayer: "Extends Words with narrow location metadata.",
    typedDetailLabel: "Place Detail",
    typedDetail: "Address, locality, region, and country code when known.",
    contextLabel: "Context Role",
    context: "Connects Events, Organizations, Communities, and place-based knowledge.",
    detailFocusLabel: "Primary Shape",
    detailFocus: "Location referent.",
  };

  return <WordsOverviewBase detail={detail} icon={MapPin} referent={referent} />;
}

function WordsOverviewBase<TKnowledgeType extends KnowledgeType>({
  detail,
  icon: Icon,
  referent,
}: {
  detail: WordsOverviewDetail<TKnowledgeType>;
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  referent: ActiveTag;
}) {
  const headingId = `kb-overview-${sanitizeId(referent.id)}-heading`;
  const typeLabel = formatKnowledgeTypeLabel(detail.knowledgeType);

  return (
    <section
      aria-labelledby={headingId}
      className="kb-knowledge-overview"
      data-knowledge-type={detail.knowledgeType}
    >
      <header className="kb-overview-header">
        <span className="kb-overview-icon" aria-hidden="true">
          <Icon aria-hidden="true" />
        </span>
        <div>
          <p className="kb-eyebrow">Referent Overview</p>
          <h2 id={headingId}>{typeLabel} Overview</h2>
        </div>
        <span className="kb-overview-key">{referent.canonicalKey}</span>
      </header>

      <p className="kb-overview-summary">{detail.summary}</p>

      <dl className="kb-overview-facts">
        <OverviewFact label="Referent" value={referent.label} />
        <OverviewFact label="Base Words Layer" value={detail.wordsLayer} />
        <OverviewFact label={detail.typedDetailLabel} value={detail.typedDetail} />
        <OverviewFact label={detail.contextLabel} value={detail.context} />
        <OverviewFact label={detail.detailFocusLabel} value={detail.detailFocus} />
      </dl>
    </section>
  );
}

function OverviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function sanitizeId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-") || "referent";
}
