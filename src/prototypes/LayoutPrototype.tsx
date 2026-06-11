// PROTOTYPE: Three general-page layout variants, switchable via ?variant=, on the existing app shell.
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
} from "lucide-react";
import archePressIconUrl from "../assets/arche-press_icon-full.svg";
import archePressHorizontalLogoDarkUrl from "../assets/arche-press_logo-horizontal-full-dark.svg";
import archePressHorizontalLogoUrl from "../assets/arche-press_logo-horizontal-full.svg";
import "./layoutPrototype.css";

type VariantKey = "A" | "B" | "C";
type ThemePreference = "light" | "dark";
type PrototypeThemeControls = {
  onToggleTheme: () => void;
  theme: ThemePreference;
};

type VariantDefinition = {
  label: string;
  component: ComponentType<PrototypeThemeControls>;
};

type IconComponent = ComponentType<{ "aria-hidden"?: "true"; className?: string }>;

type KnowledgeTag = {
  detail: string;
  label: string;
  type: string;
};

type KnowledgeEntry = {
  context: string;
  excerpt: string;
  humanWeight: number;
  label: string;
  source: string;
  status: string;
  tags: string[];
  type: string;
};

const VARIANT_ORDER: VariantKey[] = ["A", "B", "C"];

const ACTIVE_TAGS: KnowledgeTag[] = [
  {
    type: "Bible Passage",
    label: "Romans 8",
    detail: "Global Knowledge Context",
  },
  {
    type: "Topic",
    label: "Suffering and hope",
    detail: "4 active Answers",
  },
  {
    type: "Organization",
    label: "Arche Press cohort",
    detail: "Shared Visibility Scope",
  },
];

const SUGGESTED_TAGS = ["Adoption", "Sanctification", "Youth lesson", "Prayer request"];

const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  {
    type: "Question",
    label: "How should Romans 8 shape pastoral care for suffering?",
    source: "Stored Question",
    context: "Romans 8 + Suffering and hope",
    excerpt:
      "Connects suffering, groaning, adoption, and intercession into a pastoral-care frame for future Answers.",
    humanWeight: 86,
    status: "Answered by 6 entries",
    tags: ["Romans 8", "Pastoral care", "Question Space"],
  },
  {
    type: "Lesson",
    label: "Middle school discussion guide: Hope in the Spirit",
    source: "Arche Press cohort",
    context: "Romans 8 + Youth lesson",
    excerpt:
      "A reusable lesson outline with warm-up prompts, Scripture reading, and reflection questions for small groups.",
    humanWeight: 74,
    status: "Ready to use",
    tags: ["Lesson", "Youth", "Suffering and hope"],
  },
  {
    type: "Quote",
    label: "Calvin on the Spirit's witness",
    source: "Institutes excerpt",
    context: "Romans 8 + Adoption",
    excerpt:
      "A cited quote that helps distinguish assurance, adoption, and the inner testimony of the Holy Spirit.",
    humanWeight: 92,
    status: "Needs citation check",
    tags: ["Quote", "Adoption", "Assurance"],
  },
  {
    type: "Sermon",
    label: "Groaning with creation, hoping with Christ",
    source: "Sunday teaching transcript",
    context: "Romans 8 + Church",
    excerpt:
      "A sermon transcript segment organized around present weakness, future glory, and prayer when words fail.",
    humanWeight: 81,
    status: "Draft representation",
    tags: ["Sermon", "Prayer", "Church"],
  },
];

const RECENT_REQUESTS = [
  "What Answers already exist for Romans 8 and suffering?",
  "Where are we missing a lesson for youth leaders?",
  "Which Entries need citation review before publishing?",
];

const SLOT = {
  title: "Lesson for Romans 8:18-30",
  requestedType: "Lesson",
  target: "Youth teachers",
  context: "Romans 8 + Suffering and hope",
  due: "Open this week",
};

const VARIANTS: Record<VariantKey, VariantDefinition> = {
  A: { label: "Command center", component: CommandCenterVariant },
  B: { label: "Navigator rail", component: NavigatorRailVariant },
  C: { label: "Entry studio", component: EntryStudioVariant },
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
  return value === "A" || value === "B" || value === "C";
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
            <h1 id="rp-rail-title">Romans 8 with suffering and hope</h1>
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
          <aside className="rp-studio-aside" aria-label="Open Knowledge Slot">
            <KnowledgeSlotCard compact />
            <EntryCard entry={KNOWLEDGE_ENTRIES[1]} pinned />
          </aside>
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
          <button className="rp-tag-card" key={tag.label} type="button">
            <span>{tag.type}</span>
            <strong>{tag.label}</strong>
            <small>{tag.detail}</small>
          </button>
        ))}
      </div>

      <div className="rp-suggested-tags" aria-label="Suggested Tags">
        {SUGGESTED_TAGS.map((tag) => (
          <button key={tag} type="button">
            {tag}
          </button>
        ))}
      </div>
    </section>
  );
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
        <p>What should we teach from Romans 8 when people are suffering?</p>
      </div>

      <div className="rp-entry-list">
        {entries.map((entry) => (
          <EntryCard entry={entry} key={entry.label} />
        ))}
      </div>
    </section>
  );
}

function EntryCard({ entry, pinned = false }: { entry: KnowledgeEntry; pinned?: boolean }) {
  return (
    <article className={pinned ? "rp-entry-card rp-entry-card-pinned" : "rp-entry-card"}>
      <div className="rp-entry-topline">
        <span className="rp-entry-type">{entry.type}</span>
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

function KnowledgeSlotCard({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={compact ? "rp-slot-card rp-slot-card-compact" : "rp-slot-card"}
      aria-labelledby="rp-slot-title"
    >
      <header>
        <div>
          <p className="rp-eyebrow">Knowledge Slot Card</p>
          <h2 id="rp-slot-title">{SLOT.title}</h2>
        </div>
        <span>Open</span>
      </header>
      <dl>
        <div>
          <dt>Requested Type</dt>
          <dd>{SLOT.requestedType}</dd>
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
      <button type="button">
        <FolderPlus aria-hidden="true" />
        Start contribution
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
      <textarea defaultValue="Romans 8 teaches believers to name present suffering without surrendering future hope. The groaning of creation, the intercession of the Spirit, and the promise of conformity to Christ belong together..." />
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
