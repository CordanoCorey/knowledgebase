// PROTOTYPE: General-page layout variants, switchable via ?variant=, on the existing app shell.
import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Compass,
  FolderPlus,
  HelpCircle,
  Info,
  LayoutGrid,
  MessageSquare,
  Moon,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  Tag,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import archePressIconUrl from "../assets/arche-press_icon-full.svg";
import archePressHorizontalLogoDarkUrl from "../assets/arche-press_logo-horizontal-full-dark.svg";
import archePressHorizontalLogoUrl from "../assets/arche-press_logo-horizontal-full.svg";
import { KnowledgeTypeIcon } from "../components/KnowledgeTypeIcon";
import {
  formatKnowledgeTypeLabel,
  type KnowledgeType,
} from "../knowledgeContracts";
import "./layoutPrototype.css";

const VARIANT_ORDER = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
] as const;
type VariantKey = (typeof VARIANT_ORDER)[number];
type EntryFeedStyle =
  | "default"
  | "rows"
  | "source"
  | "seminar"
  | "split"
  | "annotated"
  | "masonry"
  | "waterfall";
type FeedCardSpan = "standard" | "featured" | "tall" | "compact" | "wide";
type ThemePreference = "light" | "dark";
type PrototypeThemeControls = {
  onToggleTheme: () => void;
  theme: ThemePreference;
};
type SeparationStyle =
  | "tone"
  | "type"
  | "depth"
  | "black-silver"
  | "slate-honey"
  | "sage-clay";

type VariantDefinition = {
  label: string;
  component: ComponentType<PrototypeThemeControls>;
};

type IconComponent = ComponentType<{ "aria-hidden"?: "true"; className?: string }>;

type KnowledgeTag = {
  detail: string;
  label: string;
  knowledgeType: KnowledgeType;
};

type SuggestedKnowledgeTag = {
  label: string;
  knowledgeType: KnowledgeType;
};

type KnowledgeEntry = {
  context: string;
  excerpt: string;
  humanWeight: number;
  knowledgeType: KnowledgeType;
  label: string;
  source: string;
  status: string;
  tags: string[];
};

type KnowledgeSlot = {
  context: string;
  due: string;
  note: string;
  requestedType: string;
  status: string;
  tags: string[];
  target: string;
  title: string;
};

type MixedFeedItem =
  | { entry: KnowledgeEntry; kind: "entry"; span: FeedCardSpan }
  | { kind: "slot"; slot: KnowledgeSlot; span: FeedCardSpan };

const ACTIVE_TAGS: KnowledgeTag[] = [
  {
    knowledgeType: "biblePassage",
    label: "Daniel 2:20-22",
    detail: "Global Knowledge Context",
  },
  {
    knowledgeType: "topic",
    label: "Crusades",
    detail: "6 active Answers",
  },
  {
    knowledgeType: "organization",
    label: "Arche Classical Academy",
    detail: "School Visibility Scope",
  },
];

const SUGGESTED_TAGS: SuggestedKnowledgeTag[] = [
  { knowledgeType: "biblePassage", label: "Joshua 1:6-9" },
  { knowledgeType: "biblePassage", label: "Revelation 11:15" },
  { knowledgeType: "book", label: "The City of God" },
  { knowledgeType: "organization", label: "Ruler of Kings Church" },
];

const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  {
    knowledgeType: "question",
    label: "How should we teach the First Crusade without flattening Christian courage or sin?",
    source: "Stored Question",
    context: "Daniel 2:20-22 + Crusades",
    excerpt:
      "Frames the unit around Christ's rule over kingdoms, repentance for disorder, and honest treatment of courage, folly, and violence.",
    humanWeight: 88,
    status: "Answered by 7 entries",
    tags: ["Daniel 2:20-22", "Crusades", "9th Church History"],
  },
  {
    knowledgeType: "lesson",
    label: "Grade 9 seminar: Augustine, kingdoms, and the Crusades",
    source: "Arche Classical Academy",
    context: "The City of God + Crusades",
    excerpt:
      "A reusable lesson plan comparing earthly cities, holy war rhetoric, and the limits of political Christendom.",
    humanWeight: 82,
    status: "Ready to use",
    tags: ["Matthew 5:9", "The City of God", "Arche Classical Academy"],
  },
  {
    knowledgeType: "quote",
    label: "Boethius on providence and fortune",
    source: "The Consolation of Philosophy",
    context: "Medieval Literature + Providence",
    excerpt:
      "A cited passage for 10th grade discussion on providence, apparent disorder, and the moral training of desire.",
    humanWeight: 92,
    status: "Citation checked",
    tags: ["Romans 8:28", "Boethius", "10th Medieval Literature"],
  },
  {
    knowledgeType: "sermon",
    label: "Daniel sermon: kingdoms that rise and fall",
    source: "Ruler of Kings Church",
    context: "Daniel series + Revelation",
    excerpt:
      "A sermon segment connecting Nebuchadnezzar's dream to the kingdom that shall never be destroyed.",
    humanWeight: 84,
    status: "Draft representation",
    tags: ["Daniel 2:44", "Revelation 11:15", "Ruler of Kings Church"],
  },
  {
    knowledgeType: "prayerRequest",
    label: "Deacon note: courage for the Harding family",
    source: "Ruler of Kings Church",
    context: "Joshua series + Pastoral care",
    excerpt:
      "A church-visible request for prayer and practical care after a difficult diagnosis, anchored to courage under the Lord's presence.",
    humanWeight: 79,
    status: "Elder visibility",
    tags: ["Joshua 1:9", "Pastoral care", "Ruler of Kings Church"],
  },
];

const RECENT_REQUESTS = [
  "What Answers already exist for teaching the Crusades under Christ's kingdom?",
  "Which Daniel and Revelation passages belong in the 9th grade church history unit?",
  "Where are we missing student essays on just war and repentance?",
];

const SLOT: KnowledgeSlot = {
  title: "Student essay on just war and the First Crusade",
  requestedType: "Essay",
  target: "Grade 9 Church History",
  context: "Matthew 5:9 + Crusades",
  due: "Friday",
  status: "Open request",
  note: "Needs a student-facing thesis frame and evidence paragraph that handles zeal, repentance, and just war carefully.",
  tags: ["Matthew 5:9", "Crusades", "Student essay"],
};

const KNOWLEDGE_SLOTS: KnowledgeSlot[] = [
  SLOT,
  {
    title: "Primary source annotation for Urban II and Augustine",
    requestedType: "Annotated Source",
    target: "Grade 9 Church History",
    context: "Urban II + The City of God",
    due: "Next week",
    status: "Needs source link",
    note: "Pull one short source excerpt, attach two guardrail questions, and connect it back to ordered love.",
    tags: ["Urban II", "The City of God", "Primary Source"],
  },
];

const MIXED_FEED_ITEMS: MixedFeedItem[] = [
  { kind: "entry", entry: KNOWLEDGE_ENTRIES[0], span: "featured" },
  { kind: "slot", slot: KNOWLEDGE_SLOTS[0], span: "compact" },
  { kind: "entry", entry: KNOWLEDGE_ENTRIES[1], span: "tall" },
  { kind: "entry", entry: KNOWLEDGE_ENTRIES[2], span: "standard" },
  { kind: "slot", slot: KNOWLEDGE_SLOTS[1], span: "wide" },
  { kind: "entry", entry: KNOWLEDGE_ENTRIES[3], span: "standard" },
  { kind: "entry", entry: KNOWLEDGE_ENTRIES[4], span: "tall" },
];

const WATERFALL_FEED_COLUMNS: MixedFeedItem[][] = [
  [MIXED_FEED_ITEMS[0], MIXED_FEED_ITEMS[5]],
  [MIXED_FEED_ITEMS[1], MIXED_FEED_ITEMS[2], MIXED_FEED_ITEMS[6]],
  [MIXED_FEED_ITEMS[3], MIXED_FEED_ITEMS[4]],
];

const VARIANTS: Record<VariantKey, VariantDefinition> = {
  A: { label: "Command center", component: CommandCenterVariant },
  B: { label: "Navigator rail", component: NavigatorRailVariant },
  C: { label: "Entry studio", component: EntryStudioVariant },
  D: { label: "Context desk", component: ContextDeskVariant },
  E: { label: "Compose canvas", component: ComposeCanvasVariant },
  F: { label: "Focus flow", component: FocusFlowVariant },
  G: { label: "Rail focus", component: RailFocusVariant },
  H: { label: "Rail focus rows", component: RailFocusRowsVariant },
  I: { label: "Rail focus source", component: RailFocusSourceVariant },
  J: { label: "Rail focus seminar", component: RailFocusSeminarVariant },
  K: { label: "Rail focus split", component: RailFocusSplitVariant },
  L: { label: "Rail focus notes", component: RailFocusAnnotatedVariant },
  M: { label: "Rail focus masonry", component: RailFocusMasonryVariant },
  N: { label: "Rail focus waterfall", component: RailFocusWaterfallVariant },
  O: { label: "Questions bronze, Answers gold", component: QuestionAnswerToneVariant },
  P: { label: "Question sans, Answer serif", component: QuestionAnswerTypeVariant },
  Q: { label: "Flat Questions, raised Answers", component: QuestionAnswerDepthVariant },
  R: {
    label: "Questions matte black, Answers silver",
    component: QuestionAnswerBlackSilverVariant,
  },
  S: {
    label: "Questions slate, Answers honey",
    component: QuestionAnswerSlateHoneyVariant,
  },
  T: {
    label: "Questions sage, Answers clay",
    component: QuestionAnswerSageClayVariant,
  },
};

export function LayoutPrototype({ onToggleTheme, theme }: PrototypeThemeControls) {
  const [variant, setVariant] = useState<VariantKey>(() => readVariantFromUrl());
  const activeVariant = VARIANTS[variant];
  const ActiveVariant = activeVariant.component;

  const setUrlVariant = useCallback((next: VariantKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("prototype", "layout");
    url.searchParams.set("variant", next);
    window.history.replaceState(null, "", url);
    setVariant(next);
  }, []);

  const cycleVariant = useCallback(
    (direction: -1 | 1) => {
      const index = VARIANT_ORDER.indexOf(variant);
      const next =
        VARIANT_ORDER[(index + direction + VARIANT_ORDER.length) % VARIANT_ORDER.length];
      setUrlVariant(next);
    },
    [setUrlVariant, variant],
  );

  useEffect(() => {
    const syncFromLocation = () => setVariant(readVariantFromUrl());
    window.addEventListener("popstate", syncFromLocation);
    return () => window.removeEventListener("popstate", syncFromLocation);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        cycleVariant(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        cycleVariant(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleVariant]);

  return (
    <>
      <ActiveVariant onToggleTheme={onToggleTheme} theme={theme} />
      <PrototypeSwitcher
        current={variant}
        label={activeVariant.label}
        onPrevious={() => cycleVariant(-1)}
        onNext={() => cycleVariant(1)}
      />
    </>
  );
}

function readVariantFromUrl(): VariantKey {
  const variant = new URL(window.location.href).searchParams.get("variant");
  return isVariantKey(variant) ? variant : "A";
}

function isVariantKey(value: string | null): value is VariantKey {
  return (
    value === "A" ||
    value === "B" ||
    value === "C" ||
    value === "D" ||
    value === "E" ||
    value === "F" ||
    value === "G" ||
    value === "H" ||
    value === "I" ||
    value === "J" ||
    value === "K" ||
    value === "L" ||
    value === "M" ||
    value === "N" ||
    value === "O" ||
    value === "P" ||
    value === "Q" ||
    value === "R" ||
    value === "S" ||
    value === "T"
  );
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function PrototypeSwitcher({
  current,
  label,
  onPrevious,
  onNext,
}: {
  current: VariantKey;
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="rp-switcher" role="group" aria-label="Prototype variant switcher">
      <button aria-label="Previous variant" type="button" onClick={onPrevious}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <span>
        {current} - {label}
      </span>
      <button aria-label="Next variant" type="button" onClick={onNext}>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

function CommandCenterVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <PrototypeShell onToggleTheme={onToggleTheme} theme={theme}>
      <main className="rp-page rp-command-page" aria-labelledby="rp-command-title">
        <section className="rp-command-hero">
          <div>
            <p className="rp-eyebrow">General page</p>
            <h1 id="rp-command-title">Explore and contribute from one Knowledge Context</h1>
          </div>
          <KnowledgeRequestComposer mode="hero" />
        </section>

        <KnowledgeNavigator mode="horizontal" />

        <section className="rp-command-grid" aria-label="Knowledge workspace">
          <AnswerFeed />
          <aside className="rp-side-stack" aria-label="Contribution tools">
            <KnowledgeSlotCard />
            <ContributionEditor />
          </aside>
        </section>
      </main>
    </PrototypeShell>
  );
}

function NavigatorRailVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <PrototypeShell onToggleTheme={onToggleTheme} theme={theme}>
      <main className="rp-page rp-rail-page" aria-labelledby="rp-rail-title">
        <KnowledgeNavigator mode="rail" />

        <section className="rp-rail-center" aria-label="Knowledge request and Answers">
          <header className="rp-page-heading">
            <p className="rp-eyebrow">Context Page</p>
            <h1 id="rp-rail-title">Crusades, kingdoms, and Christian courage</h1>
          </header>
          <KnowledgeRequestComposer mode="compact" />
          <AnswerFeed density="compact" />
        </section>

        <aside className="rp-rail-editor" aria-label="Contribution editor and slot">
          <KnowledgeSlotCard compact />
          <ContributionEditor compact />
        </aside>
      </main>
    </PrototypeShell>
  );
}

function EntryStudioVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <PrototypeShell onToggleTheme={onToggleTheme} theme={theme}>
      <main className="rp-page rp-studio-page" aria-labelledby="rp-studio-title">
        <header className="rp-studio-header">
          <div>
            <p className="rp-eyebrow">Knowledge studio</p>
            <h1 id="rp-studio-title">Shape a future Answer while browsing what already exists</h1>
          </div>
          <KnowledgeRequestComposer mode="compact" />
        </header>

        <KnowledgeNavigator mode="strip" />

        <section className="rp-studio-grid" aria-label="Entry-focused workspace">
          <AnswerFeed density="timeline" />
          <ContributionEditor mode="expanded" />
          <aside className="rp-studio-aside" aria-label="Open requested entry">
            <KnowledgeSlotCard compact />
            <EntryCard entry={KNOWLEDGE_ENTRIES[1]} pinned />
          </aside>
        </section>
      </main>
    </PrototypeShell>
  );
}

function ContextDeskVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <PrototypeShell onToggleTheme={onToggleTheme} theme={theme}>
      <main className="rp-page rp-desk-page" aria-labelledby="rp-desk-title">
        <section className="rp-desk-layout" aria-label="Context desk workspace">
          <aside className="rp-desk-context" aria-label="Knowledge context controls">
            <KnowledgeNavigator mode="rail" />
            <RecentRequestQueue />
          </aside>

          <section className="rp-desk-workspace" aria-label="Knowledge request and contribution">
            <header className="rp-desk-header">
              <div>
                <p className="rp-eyebrow">Context Page</p>
                <h1 id="rp-desk-title">Crusades, kingdoms, and Christian courage</h1>
              </div>
              <div className="rp-desk-context-pills" aria-label="Active Knowledge Context">
                {ACTIVE_TAGS.map((tag) => (
                  <span key={tag.label}>{tag.label}</span>
                ))}
              </div>
            </header>

            <KnowledgeRequestComposer mode="compact" />

            <div className="rp-desk-feed-grid">
              <AnswerFeed density="compact" />
              <aside className="rp-desk-tools" aria-label="Contribution tools">
                <KnowledgeSlotCard compact />
                <ContributionEditor compact />
              </aside>
            </div>
          </section>
        </section>
      </main>
    </PrototypeShell>
  );
}

function ComposeCanvasVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <PrototypeShell onToggleTheme={onToggleTheme} theme={theme}>
      <main className="rp-page rp-compose-page" aria-labelledby="rp-compose-title">
        <header className="rp-compose-header">
          <div>
            <p className="rp-eyebrow">Context Page</p>
            <h1 id="rp-compose-title">Crusades, kingdoms, and Christian courage</h1>
          </div>
          <div className="rp-compose-trail" aria-label="Active Knowledge Context">
            {ACTIVE_TAGS.map((tag) => (
              <span key={tag.label}>
                <small>{formatKnowledgeTypeLabel(tag.knowledgeType)}</small>
                {tag.label}
              </span>
            ))}
          </div>
        </header>

        <KnowledgeNavigator mode="strip" />

        <section className="rp-compose-workspace" aria-label="Ask and contribute in this context">
          <section className="rp-compose-search-stack" aria-label="Knowledge search and Answers">
            <AskInContextPanel />
            <div className="rp-answer-frame">
              <AnswerFeed density="compact" />
            </div>
          </section>

          <section className="rp-compose-editor-canvas" aria-label="Contribution Editor">
            <header className="rp-editor-anchor">
              <div>
                <p className="rp-eyebrow">Contribute</p>
                <h2>Contribution Editor</h2>
              </div>
              <span>Daniel 2:20-22 + Crusades</span>
            </header>
            <ContributionEditor mode="expanded" />
            <KnowledgeSlotCard compact />
          </section>
        </section>
      </main>
    </PrototypeShell>
  );
}

function FocusFlowVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <PrototypeShell onToggleTheme={onToggleTheme} theme={theme}>
      <main className="rp-page rp-focus-page" aria-labelledby="rp-focus-title">
        <ContextSearchNavigator />
        <section className="rp-focus-workspace" aria-label="Contribute and read Answers">
          <ExpandableContributionComposer />
          <MinimalAnswerFeed />
        </section>
      </main>
    </PrototypeShell>
  );
}

function RailFocusVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="default"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      theme={theme}
    />
  );
}

function RailFocusRowsVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="rows"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      theme={theme}
    />
  );
}

function RailFocusSourceVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="source"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      theme={theme}
    />
  );
}

function RailFocusSeminarVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="seminar"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      theme={theme}
    />
  );
}

function RailFocusSplitVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="split"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      theme={theme}
    />
  );
}

function RailFocusAnnotatedVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="annotated"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      theme={theme}
    />
  );
}

function RailFocusMasonryVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="masonry"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      theme={theme}
    />
  );
}

function RailFocusWaterfallVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="waterfall"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      theme={theme}
    />
  );
}

function QuestionAnswerToneVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="default"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      separationStyle="tone"
      theme={theme}
    />
  );
}

function QuestionAnswerTypeVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="default"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      separationStyle="type"
      theme={theme}
    />
  );
}

function QuestionAnswerDepthVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="default"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      separationStyle="depth"
      theme={theme}
    />
  );
}

function QuestionAnswerBlackSilverVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="default"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      separationStyle="black-silver"
      theme={theme}
    />
  );
}

function QuestionAnswerSlateHoneyVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="default"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      separationStyle="slate-honey"
      theme={theme}
    />
  );
}

function QuestionAnswerSageClayVariant({ onToggleTheme, theme }: PrototypeThemeControls) {
  return (
    <RailFocusLayout
      feedStyle="default"
      heading="Crusades, kingdoms, and Christian courage"
      onToggleTheme={onToggleTheme}
      separationStyle="sage-clay"
      theme={theme}
    />
  );
}

function RailFocusLayout({
  feedStyle,
  heading,
  onToggleTheme,
  separationStyle,
  theme,
}: {
  feedStyle: EntryFeedStyle;
  heading: string;
  separationStyle?: SeparationStyle;
} & PrototypeThemeControls) {
  const pageClassName = [
    "rp-page",
    "rp-rail-focus-page",
    separationStyle ? "rp-question-answer-page" : "",
    separationStyle ? `rp-qa-${separationStyle}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <PrototypeShell onToggleTheme={onToggleTheme} theme={theme}>
      <main className={pageClassName} aria-labelledby="rp-rail-focus-title">
        <aside className="rp-rail-focus-context" aria-label="Knowledge context and search">
          <ContextSearchRail separationStyle={separationStyle} />
        </aside>
        <section className="rp-rail-focus-workspace" aria-label="Contribute and read Answers">
          <header className="rp-rail-focus-heading">
            <p className="rp-eyebrow">Context Page</p>
            <h1 id="rp-rail-focus-title">{heading}</h1>
          </header>
          <ExpandableContributionComposer separationStyle={separationStyle} />
          <MinimalAnswerFeed separationStyle={separationStyle} style={feedStyle} />
        </section>
      </main>
    </PrototypeShell>
  );
}

function PrototypeShell({
  children,
  onToggleTheme,
  theme,
}: {
  children: ReactNode;
} & PrototypeThemeControls) {
  return (
    <div className="layout-prototype" data-theme={theme}>
      <PrototypeSidebar />
      <div className="rp-host-column">
        <PrototypeTopBar onToggleTheme={onToggleTheme} theme={theme} />
        <div className="rp-host-content">{children}</div>
      </div>
      <button className="rp-floating-spark" type="button" aria-label="Open assistant">
        <Sparkles aria-hidden="true" />
      </button>
    </div>
  );
}

function PrototypeSidebar() {
  const primaryItems: Array<{ label: string; icon: IconComponent; active?: boolean }> = [
    { label: "Dashboard", icon: LayoutGrid, active: true },
    { label: "Knowledge Navigator", icon: Compass },
    { label: "Answer Feed", icon: BookOpen },
    { label: "Contribute", icon: MessageSquare },
    { label: "People", icon: Users },
  ];
  const secondaryItems: Array<{ label: string; icon: IconComponent }> = [
    { label: "Settings", icon: Settings },
    { label: "Analytics", icon: BarChart3 },
    { label: "Help", icon: HelpCircle },
  ];

  return (
    <aside className="rp-sidebar" aria-label="Primary navigation">
      <button className="rp-logo-button" type="button" aria-label="Dashboard">
        <img className="rp-brand-icon" src={archePressIconUrl} alt="" aria-hidden="true" />
      </button>
      <nav className="rp-nav-stack" aria-label="Main">
        {primaryItems.map((item) => (
          <NavButton key={item.label} {...item} />
        ))}
      </nav>
      <nav className="rp-nav-stack rp-nav-stack-secondary" aria-label="Utility">
        {secondaryItems.map((item) => (
          <NavButton key={item.label} {...item} />
        ))}
        <span className="rp-nav-divider" aria-hidden="true" />
        <button className="rp-avatar-button" type="button" aria-label="User profile">
          <UserCircle aria-hidden="true" />
        </button>
      </nav>
    </aside>
  );
}

function NavButton({
  label,
  icon: Icon,
  active = false,
}: {
  label: string;
  icon: IconComponent;
  active?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className={active ? "rp-nav-button rp-nav-button-active" : "rp-nav-button"}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

function PrototypeTopBar({ onToggleTheme, theme }: PrototypeThemeControls) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const brandLogoUrl =
    theme === "dark" ? archePressHorizontalLogoDarkUrl : archePressHorizontalLogoUrl;

  return (
    <header className="rp-topbar">
      <a
        className="rp-brand"
        href="/?prototype=layout&variant=A"
        aria-label="Go to dashboard"
      >
        <img className="rp-brand-logo" src={brandLogoUrl} alt="" aria-hidden="true" />
      </a>
      <div className="rp-topbar-actions">
        <button
          aria-label={`Switch to ${nextTheme} theme`}
          aria-pressed={theme === "dark"}
          className="rp-icon-button rp-theme-button"
          onClick={onToggleTheme}
          title={`Switch to ${nextTheme} theme`}
          type="button"
        >
          <ThemeIcon aria-hidden="true" />
        </button>
        <button
          className="rp-icon-button"
          title="Notifications"
          type="button"
          aria-label="Notifications"
        >
          <Bell aria-hidden="true" />
        </button>
        <label className="rp-search">
          <Search aria-hidden="true" />
          <input type="text" placeholder="Search knowledge..." />
        </label>
      </div>
    </header>
  );
}

function KnowledgeNavigator({ mode }: { mode: "horizontal" | "rail" | "strip" }) {
  return (
    <section className={`rp-navigator rp-navigator-${mode}`} aria-labelledby={`rp-nav-${mode}`}>
      <header>
        <div>
          <p className="rp-eyebrow">Knowledge Navigator</p>
          <h2 id={`rp-nav-${mode}`}>Active Knowledge Context</h2>
        </div>
        <button type="button">
          <Tag aria-hidden="true" />
          Add Tag
        </button>
      </header>

      <div className="rp-active-tags" aria-label="Active Tags">
        {ACTIVE_TAGS.map((tag) => (
          <button
            aria-label={`Remove ${tag.label}`}
            className="rp-tag-card"
            key={tag.label}
            title={`${formatKnowledgeTypeLabel(tag.knowledgeType)} - ${tag.detail}`}
            type="button"
          >
            <KnowledgeTypeIcon knowledgeType={tag.knowledgeType} />
            <span>{tag.label}</span>
            <X aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="rp-suggested-tags" aria-label="Suggested Tags">
        {SUGGESTED_TAGS.map((tag) => (
          <button
            aria-label={`Add ${tag.label}`}
            key={tag.label}
            title={`Add ${tag.label}`}
            type="button"
          >
            <KnowledgeTypeIcon knowledgeType={tag.knowledgeType} />
            <span>{tag.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function RecentRequestQueue() {
  return (
    <section className="rp-recent-requests" aria-labelledby="rp-recent-title">
      <header>
        <p className="rp-eyebrow">Recent Requests</p>
        <h2 id="rp-recent-title">Open threads</h2>
      </header>
      <div>
        {RECENT_REQUESTS.map((request) => (
          <button key={request} type="button">
            <MessageSquare aria-hidden="true" />
            <span>{request}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AskInContextPanel() {
  return (
    <section className="rp-ask-panel" aria-labelledby="rp-ask-title">
      <header>
        <p className="rp-eyebrow">Ask</p>
        <h2 id="rp-ask-title">Search this Knowledge Context</h2>
      </header>
      <KnowledgeRequestComposer mode="compact" />
    </section>
  );
}

function ContextSearchNavigator() {
  return (
    <section className="rp-focus-navigator" aria-labelledby="rp-focus-title">
      <div className="rp-focus-context-line">
        <h1 id="rp-focus-title">Crusades, kingdoms, and Christian courage</h1>
        <div className="rp-focus-tags" aria-label="Active Knowledge Context">
          {ACTIVE_TAGS.map((tag) => (
            <span key={tag.label}>
              <small>{formatKnowledgeTypeLabel(tag.knowledgeType)}</small>
              {tag.label}
            </span>
          ))}
        </div>
      </div>
      <KnowledgeRequestComposer mode="compact" />
    </section>
  );
}

function ContextSearchRail({ separationStyle }: { separationStyle?: SeparationStyle }) {
  return (
    <section
      className={separationStyle ? "rp-focus-rail rp-question-zone" : "rp-focus-rail"}
      aria-labelledby="rp-focus-rail-title"
    >
      <header>
        <div>
          {separationStyle ? <span className="rp-zone-label">Questions</span> : null}
          <p className="rp-eyebrow">Knowledge Navigator</p>
          <h2 id="rp-focus-rail-title">Active Knowledge Context</h2>
        </div>
        <button type="button">
          <Tag aria-hidden="true" />
          Add Tag
        </button>
      </header>
      <div className="rp-focus-rail-tags" aria-label="Active Tags">
        {ACTIVE_TAGS.map((tag) => (
          <button
            aria-label={`Remove ${tag.label}`}
            className="rp-tag-card"
            key={tag.label}
            title={`${formatKnowledgeTypeLabel(tag.knowledgeType)} - ${tag.detail}`}
            type="button"
          >
            <KnowledgeTypeIcon knowledgeType={tag.knowledgeType} />
            <span>{tag.label}</span>
            <X aria-hidden="true" />
          </button>
        ))}
      </div>
      <KnowledgeRequestComposer mode="compact" />
      <div className="rp-suggested-tags" aria-label="Suggested Tags">
        {SUGGESTED_TAGS.map((tag) => (
          <button
            aria-label={`Add ${tag.label}`}
            key={tag.label}
            title={`Add ${tag.label}`}
            type="button"
          >
            <KnowledgeTypeIcon knowledgeType={tag.knowledgeType} />
            <span>{tag.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ExpandableContributionComposer({
  separationStyle,
}: {
  separationStyle?: SeparationStyle;
}) {
  const [expanded, setExpanded] = useState(false);
  const className = [
    "rp-focus-contribution",
    expanded ? "rp-focus-contribution-expanded" : "",
    separationStyle ? "rp-answer-composer" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <form
      className={className}
      onSubmit={(event) => event.preventDefault()}
    >
      <label>
        <span>Contribution Editor</span>
        <textarea
          defaultValue=""
          onClick={() => setExpanded(true)}
          onFocus={() => setExpanded(true)}
          placeholder="Contribute an answer in this context..."
        />
      </label>
      <button type="submit" aria-label="Store as Answer">
        <Sparkles aria-hidden="true" />
      </button>
    </form>
  );
}

function MinimalAnswerFeed({
  separationStyle,
  style = "default",
}: {
  separationStyle?: SeparationStyle;
  style?: EntryFeedStyle;
}) {
  const mixedFeed = style === "masonry" || style === "waterfall";
  const countLabel = mixedFeed
    ? `${KNOWLEDGE_ENTRIES.length} entries + ${KNOWLEDGE_SLOTS.length} requests`
    : `${KNOWLEDGE_ENTRIES.length} entries`;

  return (
    <section
      className={[
        "rp-minimal-answer-feed",
        `rp-minimal-answer-feed-${style}`,
        separationStyle ? "rp-answer-zone" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby="rp-minimal-feed-title"
    >
      <header>
        <div>
          {separationStyle ? <span className="rp-zone-label">Answers</span> : null}
          <h2 id="rp-minimal-feed-title">Answers</h2>
        </div>
        <span>{countLabel}</span>
      </header>
      {style === "waterfall" ? (
        <WaterfallAnswerFeed />
      ) : (
        <div className={`rp-entry-list rp-entry-list-${style}`}>
          {mixedFeed
            ? MIXED_FEED_ITEMS.map((item) => (
                <MixedFeedCard item={item} key={getMixedFeedItemKey(item)} style={style} />
              ))
            : KNOWLEDGE_ENTRIES.map((entry) => (
                <EntryCard entry={entry} key={entry.label} style={style} />
              ))}
        </div>
      )}
    </section>
  );
}

function WaterfallAnswerFeed() {
  const useFlatOrder = useNarrowWaterfallLayout();

  if (useFlatOrder) {
    return (
      <div className="rp-entry-list rp-entry-list-waterfall rp-entry-list-waterfall-flat">
        {MIXED_FEED_ITEMS.map((item) => (
          <MixedFeedCard item={item} key={getMixedFeedItemKey(item)} style="waterfall" />
        ))}
      </div>
    );
  }

  return (
    <div className="rp-entry-list rp-entry-list-waterfall">
      {WATERFALL_FEED_COLUMNS.map((column, columnIndex) => (
        <div className="rp-waterfall-column" key={columnIndex}>
          {column.map((item) => (
            <MixedFeedCard item={item} key={getMixedFeedItemKey(item)} style="waterfall" />
          ))}
        </div>
      ))}
    </div>
  );
}

function MixedFeedCard({ item, style }: { item: MixedFeedItem; style: EntryFeedStyle }) {
  if (item.kind === "slot") {
    return <FeedSlotCard feedSpan={item.span} slot={item.slot} style={style} />;
  }

  return <EntryCard entry={item.entry} feedSpan={item.span} style={style} />;
}

function getMixedFeedItemKey(item: MixedFeedItem) {
  return item.kind === "slot" ? item.slot.title : item.entry.label;
}

function useNarrowWaterfallLayout() {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 760px)").matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsNarrow(query.matches);

    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isNarrow;
}

function KnowledgeRequestComposer({ mode }: { mode: "hero" | "compact" }) {
  const placeholder =
    mode === "hero" ? "Ask from this Knowledge Context..." : "Ask...";

  return (
    <form
      className={mode === "hero" ? "rp-request-composer rp-request-hero" : "rp-request-composer"}
      onSubmit={(event) => event.preventDefault()}
    >
      <label>
        <span>Knowledge Request Composer</span>
        <input type="text" placeholder={placeholder} />
      </label>
      <button type="submit" aria-label="Send Knowledge Request">
        <Send aria-hidden="true" />
      </button>
    </form>
  );
}

function AnswerFeed({ density = "default" }: { density?: "default" | "compact" | "timeline" }) {
  const entries = density === "timeline" ? KNOWLEDGE_ENTRIES.slice(0, 3) : KNOWLEDGE_ENTRIES;

  return (
    <section className={`rp-answer-feed rp-answer-feed-${density}`} aria-labelledby="rp-feed-title">
      <header className="rp-feed-header">
        <div>
          <p className="rp-eyebrow">Answer Feed</p>
          <h2 id="rp-feed-title">Answers for the current Knowledge Request</h2>
        </div>
        <span>{entries.length} Knowledge Entries</span>
      </header>

      <div className="rp-request-summary">
        <Sparkles aria-hidden="true" />
        <p>How do I teach the Crusades with courage, repentance, and Christ's kingdom in view?</p>
      </div>

      <div className="rp-entry-list">
        {entries.map((entry) => (
          <EntryCard entry={entry} key={entry.label} />
        ))}
      </div>
    </section>
  );
}

function EntryCard({
  entry,
  feedSpan,
  pinned = false,
  style = "default",
}: {
  entry: KnowledgeEntry;
  feedSpan?: FeedCardSpan;
  pinned?: boolean;
  style?: EntryFeedStyle;
}) {
  return (
    <article
      className={[
        "rp-entry-card",
        `rp-entry-card-${style}`,
        feedSpan ? "rp-feed-card" : "",
        feedSpan ? `rp-feed-card-${feedSpan}` : "",
        pinned ? "rp-entry-card-pinned" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="rp-entry-topline">
        <span className="rp-entry-type">
          <KnowledgeTypeIcon knowledgeType={entry.knowledgeType} />
          {formatKnowledgeTypeLabel(entry.knowledgeType)}
        </span>
        <span className="rp-human-weight">Human Weight {entry.humanWeight}</span>
      </div>
      <h3>{entry.label}</h3>
      <p>{entry.excerpt}</p>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>{entry.source}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{entry.status}</dd>
        </div>
      </dl>
      <div className="rp-card-tags" aria-label={`${entry.label} Tags`}>
        {entry.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <footer>
        <button type="button">
          <BookOpen aria-hidden="true" />
          Open Entry
        </button>
        <button type="button">
          <BookmarkPlus aria-hidden="true" />
          Use in Editor
        </button>
      </footer>
    </article>
  );
}

function FeedSlotCard({
  feedSpan,
  slot,
  style,
}: {
  feedSpan: FeedCardSpan;
  slot: KnowledgeSlot;
  style: EntryFeedStyle;
}) {
  return (
    <article
      className={[
        "rp-feed-slot-card",
        `rp-feed-slot-card-${style}`,
        "rp-feed-card",
        `rp-feed-card-${feedSpan}`,
      ].join(" ")}
    >
      <div className="rp-entry-topline">
        <span className="rp-entry-type">
          <FolderPlus aria-hidden="true" />
          Requested Entry
        </span>
        <span className="rp-slot-status">{slot.status}</span>
      </div>
      <h3>{slot.title}</h3>
      <p>{slot.note}</p>
      <dl>
        <div>
          <dt>Entry needed</dt>
          <dd>{slot.requestedType} needed</dd>
        </div>
        <div>
          <dt>Timing</dt>
          <dd>{slot.due}</dd>
        </div>
      </dl>
      <div className="rp-slot-context">
        <span>{slot.target}</span>
        <span>{slot.context}</span>
      </div>
      <div className="rp-card-tags" aria-label={`${slot.title} Tags`}>
        {slot.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <footer>
        <p>Add content to complete this entry.</p>
        <button type="button">
          <FolderPlus aria-hidden="true" />
          Add missing {slot.requestedType}
        </button>
      </footer>
    </article>
  );
}

function KnowledgeSlotCard({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={compact ? "rp-slot-card rp-slot-card-compact" : "rp-slot-card"}
      aria-labelledby="rp-slot-title"
    >
      <header>
        <div>
          <p className="rp-eyebrow">Requested Entry</p>
          <h2 id="rp-slot-title">{SLOT.title}</h2>
        </div>
        <span>Open request</span>
      </header>
      <dl>
        <div>
          <dt>Entry needed</dt>
          <dd>{SLOT.requestedType} needed</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{SLOT.target}</dd>
        </div>
        <div>
          <dt>Knowledge Context</dt>
          <dd>{SLOT.context}</dd>
        </div>
        <div>
          <dt>Timing</dt>
          <dd>{SLOT.due}</dd>
        </div>
      </dl>
      <p>Add content to complete this entry.</p>
      <button type="button">
        <FolderPlus aria-hidden="true" />
        Add missing {SLOT.requestedType}
      </button>
    </section>
  );
}

function ContributionEditor({
  compact = false,
  mode = "default",
}: {
  compact?: boolean;
  mode?: "default" | "expanded";
}) {
  return (
    <section
      className={[
        "rp-contribution-editor",
        compact ? "rp-contribution-editor-compact" : "",
        mode === "expanded" ? "rp-contribution-editor-expanded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby="rp-editor-title"
    >
      <header>
        <div>
          <p className="rp-eyebrow">Contribution Editor</p>
          <h2 id="rp-editor-title">Draft a future Answer</h2>
        </div>
        <span>Visibility: Cohort</span>
      </header>
      <div className="rp-editor-toolbar" aria-label="Editor tools">
        <button type="button" aria-label="Format as heading">
          H
        </button>
        <button type="button" aria-label="Bold">
          B
        </button>
        <button type="button" aria-label="Insert quote">
          <MessageSquare aria-hidden="true" />
        </button>
        <button type="button" aria-label="Add reference">
          <Tag aria-hidden="true" />
        </button>
      </div>
      <textarea defaultValue="Daniel teaches my students to see empires as temporary and Christ's kingdom as immovable. The Crusades unit needs courage, repentance, and careful reasoning instead of either romance or embarrassment..." />
      <div className="rp-editor-meta">
        <span>Represented Referent: Lesson draft</span>
        <span>Entry Representation: Rich text</span>
      </div>
      <footer>
        <button type="button">
          <Info aria-hidden="true" />
          Preview
        </button>
        <button type="button">
          <Sparkles aria-hidden="true" />
          Store as Answer
        </button>
      </footer>
    </section>
  );
}
