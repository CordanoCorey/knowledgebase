// PROTOTYPE: Three Dashboard hierarchy variants, switchable via
// ?prototype=dashboard-hierarchy&variant=, on the existing root route.
// The chosen compact rail and contextual drawer stay fixed so this comparison
// answers only how the User-scoped Dashboard should prioritize its content.
import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
} from "react";
import {
  ArrowRight,
  Bell,
  Bookmark,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Compass,
  Flame,
  Home,
  Landmark,
  Layers3,
  ListTodo,
  Menu,
  MessageSquareText,
  Moon,
  PenLine,
  Pin,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import profilePlaceholderUrl from "../assets/profile-placeholder.png";
import { LogeionBrand } from "../components/LogeionBrand";
import "./dashboardHierarchyPrototype.css";

const VARIANT_ORDER = ["A", "B", "C"] as const;
type VariantKey = (typeof VARIANT_ORDER)[number];
type ThemePreference = "light" | "dark";
type OpenPanel = "contents" | "places" | "account" | null;
type IconComponent = ComponentType<{
  "aria-hidden"?: "true";
  className?: string;
}>;

type DashboardHierarchyPrototypeProps = {
  onToggleTheme: () => void;
  theme: ThemePreference;
};

type DashboardVariantProps = {
  onOpenPanel: (panel: Exclude<OpenPanel, null>) => void;
};

type VariantDefinition = {
  component: ComponentType<DashboardVariantProps>;
  label: string;
  sections: Array<{ detail: string; label: string }>;
};

const VARIANTS: Record<VariantKey, VariantDefinition> = {
  A: {
    component: GuidedStack,
    label: "Guided priority stack",
    sections: [
      { label: "Attention", detail: "Notification preview" },
      { label: "Return", detail: "Pins, frequent, and recent places" },
      { label: "Contribute", detail: "Compact Contribution Editor" },
      { label: "Explore", detail: "Answer Feed and Trending" },
    ],
  },
  B: {
    component: DailySplit,
    label: "Two-lane daily desk",
    sections: [
      { label: "Today", detail: "Attention and familiar places" },
      { label: "Work surface", detail: "Contribute and explore" },
    ],
  },
  C: {
    component: QuietContinuum,
    label: "Condensed Dashboard stream",
    sections: [
      { label: "Attention", detail: "Compact Notification strip" },
      { label: "Return", detail: "Familiar-place ribbon" },
      { label: "Trending", detail: "Distinct Knowledge Context momentum" },
      { label: "Contribute", detail: "Inline Contribution Editor" },
      { label: "Answer Feed", detail: "Subscribed, popular, and recent knowledge" },
    ],
  },
};

const NOTIFICATIONS = [
  {
    detail: "Mara assigned a Quote review in Arche Classical Academy.",
    meta: "8 min ago",
    title: "Review assignment",
    unread: true,
  },
  {
    detail: "Your access to Ruler of Kings Church was approved.",
    meta: "Yesterday",
    title: "Access approved",
    unread: false,
  },
] as const;

const PLACES = [
  {
    detail: "School · Administrator, Teacher, Parent",
    icon: Landmark,
    label: "Arche Classical Academy",
    reason: "Pinned",
  },
  {
    detail: "Church · Member, Ministry lead",
    icon: Users,
    label: "Ruler of Kings Church",
    reason: "Frequent",
  },
  {
    detail: "Family · Parent",
    icon: Home,
    label: "Gelbaugh Family",
    reason: "Pinned",
  },
  {
    detail: "Study circle · Personal capacity",
    icon: Compass,
    label: "Westminster Study Circle",
    reason: "Recent",
  },
] as const;

const FEED_ITEMS = [
  {
    context: "Education · Classical pedagogy",
    excerpt:
      "A lesson plan connecting imitation, narration, and careful observation in the early years.",
    meta: "Lesson · 12 min read",
    source: "Subscribed",
    title: "Teaching attention before analysis",
  },
  {
    context: "Household worship · Psalms",
    excerpt:
      "A compact order for choosing, learning, and returning to a Psalm across the week.",
    meta: "Guide · Posted 42 min ago",
    source: "Recent",
    title: "A weekly Psalm rhythm",
  },
  {
    context: "Community · Hospitality",
    excerpt:
      "Notes from three families on making an ordinary table easier to open to neighbors.",
    meta: "Words · 4 contributors",
    source: "Popular",
    title: "The table as a neighborhood threshold",
  },
] as const;

const TRENDING = ["Nicene Creed", "Local history", "Garden planning"] as const;

export function DashboardHierarchyPrototype({
  onToggleTheme,
  theme,
}: DashboardHierarchyPrototypeProps) {
  const [variant, setVariant] = useState<VariantKey>(() => readVariantFromUrl());
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const activeVariant = VARIANTS[variant];
  const ActiveVariant = activeVariant.component;

  const setUrlVariant = useCallback((next: VariantKey) => {
    const url = new URL(window.location.href);
    url.pathname = "/";
    url.searchParams.set("prototype", "dashboard-hierarchy");
    url.searchParams.set("variant", next);
    window.history.replaceState(null, "", url);
    setVariant(next);
    setOpenPanel(null);
    window.scrollTo(0, 0);
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
    const syncFromLocation = () => {
      setVariant(readVariantFromUrl());
      setOpenPanel(null);
    };
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

  function togglePanel(panel: Exclude<OpenPanel, null>) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  return (
    <div className="dhp-shell" data-theme={theme}>
      <CompactRail openPanel={openPanel} onPanelChange={togglePanel} />
      {openPanel ? (
        <ContextDrawer
          onClose={() => setOpenPanel(null)}
          onToggleTheme={onToggleTheme}
          panel={openPanel}
          sections={activeVariant.sections}
          theme={theme}
        />
      ) : null}
      <main className="dhp-stage">
        <DashboardHeader
          contentsExpanded={openPanel === "contents"}
          onOpenContents={() => togglePanel("contents")}
        />
        <section className="dhp-workspace" aria-label="Dashboard hierarchy prototype">
          <div className="dhp-prototype-note" role="note">
            <Sparkles aria-hidden="true" />
            <span>
              <strong>Hierarchy question.</strong> Which composition makes attention,
              return, contribution, and exploration feel like one daily workspace?
            </span>
          </div>
          <ActiveVariant onOpenPanel={togglePanel} />
        </section>
      </main>
      <PrototypeSwitcher
        current={variant}
        label={activeVariant.label}
        onNext={() => cycleVariant(1)}
        onPrevious={() => cycleVariant(-1)}
      />
    </div>
  );
}

function readVariantFromUrl(): VariantKey {
  const variant = new URL(window.location.href).searchParams.get("variant");
  return variant === "A" || variant === "B" || variant === "C" ? variant : "A";
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function CompactRail({
  onPanelChange,
  openPanel,
}: {
  onPanelChange: (panel: Exclude<OpenPanel, null>) => void;
  openPanel: OpenPanel;
}) {
  return (
    <aside className="dhp-rail" aria-label="Persistent destinations">
      <a className="dhp-brand" href="/" aria-label="Logeion Dashboard">
        <LogeionBrand density="compact" />
      </a>
      <nav>
        <RailButton active icon={Home} label="Dashboard" />
        <RailButton
          expanded={openPanel === "places"}
          icon={Layers3}
          label="Places"
          onClick={() => onPanelChange("places")}
        />
        <RailButton icon={CalendarDays} label="Calendar" />
        <RailButton badge={4} icon={Bell} label="Notifications" />
      </nav>
      <button
        aria-expanded={openPanel === "account"}
        aria-label="Open account menu"
        className="dhp-avatar-button"
        onClick={() => onPanelChange("account")}
        type="button"
      >
        <img alt="" aria-hidden="true" src={profilePlaceholderUrl} />
      </button>
    </aside>
  );
}

function RailButton({
  active = false,
  badge,
  expanded,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  badge?: number;
  expanded?: boolean;
  icon: IconComponent;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-expanded={onClick ? expanded : undefined}
      aria-label={label}
      className="dhp-rail-button"
      data-active={active ? "true" : undefined}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" />
      {badge ? <strong>{badge}</strong> : null}
    </button>
  );
}

function DashboardHeader({
  contentsExpanded,
  onOpenContents,
}: {
  contentsExpanded: boolean;
  onOpenContents: () => void;
}) {
  return (
    <header className="dhp-header">
      <button
        aria-expanded={contentsExpanded}
        className="dhp-page-identity"
        onClick={onOpenContents}
        type="button"
      >
        <span className="dhp-page-icon">
          <Home aria-hidden="true" />
        </span>
        <span className="dhp-page-copy">
          <small>Accessible Root Knowledge Context</small>
          <strong>Dashboard</strong>
          <span>Baseline personal capacity</span>
        </span>
        <span className="dhp-contents-label">
          <Menu aria-hidden="true" />
          Contents
        </span>
      </button>
      <label className="dhp-root-search">
        <Search aria-hidden="true" />
        <input
          aria-label="Search Everything"
          placeholder="Search everything you can access"
          type="search"
        />
        <kbd>/</kbd>
      </label>
    </header>
  );
}

function ContextDrawer({
  onClose,
  onToggleTheme,
  panel,
  sections,
  theme,
}: {
  onClose: () => void;
  onToggleTheme: () => void;
  panel: Exclude<OpenPanel, null>;
  sections: VariantDefinition["sections"];
  theme: ThemePreference;
}) {
  const heading =
    panel === "contents" ? "On this page" : panel === "places" ? "Places" : "Corey Gelbaugh";

  return (
    <aside className="dhp-drawer" aria-label={heading}>
      <header>
        <div>
          <p>{panel === "account" ? "User" : "Navigator"}</p>
          <h2>{heading}</h2>
        </div>
        <button aria-label={`Close ${heading}`} onClick={onClose} type="button">
          <X aria-hidden="true" />
        </button>
      </header>
      {panel === "contents" ? <ContentsList sections={sections} /> : null}
      {panel === "places" ? <PlacesDrawer /> : null}
      {panel === "account" ? (
        <AccountDrawer onToggleTheme={onToggleTheme} theme={theme} />
      ) : null}
    </aside>
  );
}

function ContentsList({ sections }: { sections: VariantDefinition["sections"] }) {
  return (
    <nav className="dhp-drawer-list" aria-label="Dashboard contents">
      {sections.map((section, index) => (
        <button key={section.label} type="button">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <span>
            <strong>{section.label}</strong>
            <small>{section.detail}</small>
          </span>
        </button>
      ))}
    </nav>
  );
}

function PlacesDrawer() {
  return (
    <div className="dhp-places-drawer">
      <p className="dhp-drawer-summary">Pins, frequent, and recent places in one navigator.</p>
      {PLACES.map((place) => (
        <button key={place.label} type="button">
          <place.icon aria-hidden="true" />
          <span>
            <strong>{place.label}</strong>
            <small>{place.detail}</small>
          </span>
          <em>{place.reason}</em>
        </button>
      ))}
    </div>
  );
}

function AccountDrawer({
  onToggleTheme,
  theme,
}: DashboardHierarchyPrototypeProps) {
  return (
    <nav className="dhp-account-drawer" aria-label="Account and personal views">
      <DrawerAction badge={3} icon={ListTodo} label="To-do" />
      <DrawerAction icon={UserCircle} label="Profile" />
      <DrawerAction icon={Bookmark} label="Commonplace Book" />
      <DrawerAction icon={Settings} label="Settings" />
      <hr />
      <button onClick={onToggleTheme} type="button">
        {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>
      </button>
    </nav>
  );
}

function DrawerAction({
  badge,
  icon: Icon,
  label,
}: {
  badge?: number;
  icon: IconComponent;
  label: string;
}) {
  return (
    <button type="button">
      <Icon aria-hidden="true" />
      <span>{label}</span>
      {badge ? <strong>{badge}</strong> : null}
    </button>
  );
}

function GuidedStack({ onOpenPanel }: DashboardVariantProps) {
  return (
    <div className="dhp-variant dhp-guided-stack">
      <DashboardIntro
        detail="Move from what changed to a familiar place, or keep working here."
        title="Your knowledge, ready for today"
      />
      <section className="dhp-section dhp-attention-block" aria-labelledby="dhp-a-attention">
        <SectionHeading
          action="All notifications"
          count="4 unread"
          icon={CircleAlert}
          id="dhp-a-attention"
          title="Needs attention"
        />
        <NotificationRows />
      </section>
      <section className="dhp-section" aria-labelledby="dhp-a-return">
        <SectionHeading
          action="Open Places"
          icon={Clock3}
          id="dhp-a-return"
          onAction={() => onOpenPanel("places")}
          title="Return"
        />
        <div className="dhp-place-grid">
          {PLACES.map((place) => (
            <PlaceCard key={place.label} place={place} />
          ))}
        </div>
      </section>
      <section className="dhp-section" aria-labelledby="dhp-a-contribute">
        <SectionHeading icon={PenLine} id="dhp-a-contribute" title="Contribute" />
        <ContributionEditor presentation="card" />
      </section>
      <section className="dhp-section" aria-labelledby="dhp-a-explore">
        <SectionHeading icon={Compass} id="dhp-a-explore" title="Explore" />
        <TrendingRow />
        <FeedGrid />
      </section>
    </div>
  );
}

function DailySplit({ onOpenPanel }: DashboardVariantProps) {
  return (
    <div className="dhp-variant dhp-daily-split">
      <DashboardIntro
        detail="Keep the daily return loop beside an open knowledge surface."
        title="Pick up where knowledge is moving"
      />
      <div className="dhp-split-layout">
        <aside className="dhp-today-lane" aria-label="Today">
          <div className="dhp-lane-heading">
            <span>01</span>
            <div>
              <p>Today</p>
              <h2>Attention, then return</h2>
            </div>
          </div>
          <section aria-labelledby="dhp-b-attention">
            <SectionHeading
              action="4 unread"
              icon={Bell}
              id="dhp-b-attention"
              title="Notifications"
            />
            <NotificationRows compact />
          </section>
          <section aria-labelledby="dhp-b-return">
            <SectionHeading
              action="Places"
              icon={Pin}
              id="dhp-b-return"
              onAction={() => onOpenPanel("places")}
              title="Familiar places"
            />
            <div className="dhp-place-list">
              {PLACES.slice(0, 3).map((place) => (
                <PlaceRow key={place.label} place={place} />
              ))}
            </div>
          </section>
        </aside>
        <div className="dhp-work-lane">
          <div className="dhp-lane-heading">
            <span>02</span>
            <div>
              <p>Work surface</p>
              <h2>Add, find, ask, or browse</h2>
            </div>
          </div>
          <ContributionEditor presentation="open" />
          <TrendingRow />
          <FeedList />
        </div>
      </div>
    </div>
  );
}

function QuietContinuum({ onOpenPanel }: DashboardVariantProps) {
  return (
    <div className="dhp-variant dhp-quiet-continuum">
      <section className="dhp-notification-strip" aria-label="Needs attention">
        <span className="dhp-strip-icon"><Bell aria-hidden="true" /></span>
        <div>
          <strong>4 unread notifications</strong>
          <span>One new assignment · one access outcome · two activity notices</span>
        </div>
        <button type="button">
          Review <ArrowRight aria-hidden="true" />
        </button>
      </section>
      <section className="dhp-return-ribbon" aria-label="Return to a familiar place">
        <span className="dhp-ribbon-label">Return</span>
        <div>
          {PLACES.map((place) => (
            <button key={place.label} type="button">
              <place.icon aria-hidden="true" />
              <span>{place.label}</span>
              <small>{place.reason}</small>
            </button>
          ))}
        </div>
        <button aria-label="Open all Places" onClick={() => onOpenPanel("places")} type="button">
          <Layers3 aria-hidden="true" />
        </button>
      </section>
      <section className="dhp-trending-ribbon" aria-label="Trending Knowledge Contexts">
        <TrendingRow inline />
      </section>
      <section className="dhp-condensed-contribution" aria-label="Contribute">
        <span>Contribute</span>
        <ContributionEditor presentation="line" />
      </section>
      <section className="dhp-dashboard-feed" aria-label="Dashboard Answer Feed">
        <FeedList editorial />
      </section>
    </div>
  );
}

function DashboardIntro({ detail, title }: { detail: string; title: string }) {
  return (
    <header className="dhp-dashboard-intro">
      <div>
        <p>Dashboard</p>
        <h1>{title}</h1>
      </div>
      <span>{detail}</span>
    </header>
  );
}

function SectionHeading({
  action,
  count,
  icon: Icon,
  id,
  onAction,
  title,
}: {
  action?: string;
  count?: string;
  icon: IconComponent;
  id: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <header className="dhp-section-heading">
      <span className="dhp-section-icon"><Icon aria-hidden="true" /></span>
      <h2 id={id}>{title}</h2>
      {count ? <small>{count}</small> : null}
      {action ? (
        <button onClick={onAction} type="button">
          {action} <ArrowRight aria-hidden="true" />
        </button>
      ) : null}
    </header>
  );
}

function NotificationRows({ compact = false }: { compact?: boolean }) {
  return (
    <div className="dhp-notification-rows" data-compact={compact ? "true" : undefined}>
      {NOTIFICATIONS.map((notification) => (
        <button data-unread={notification.unread ? "true" : undefined} key={notification.title} type="button">
          <span className="dhp-notification-state" />
          <span>
            <strong>{notification.title}</strong>
            <small>{notification.detail}</small>
          </span>
          <em>{notification.meta}</em>
          <ArrowRight aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

type Place = (typeof PLACES)[number];

function PlaceCard({ place }: { place: Place }) {
  return (
    <button className="dhp-place-card" type="button">
      <span><place.icon aria-hidden="true" /></span>
      <strong>{place.label}</strong>
      <small>{place.detail}</small>
      <em>{place.reason === "Pinned" ? <Pin aria-hidden="true" /> : <Clock3 aria-hidden="true" />} {place.reason}</em>
    </button>
  );
}

function PlaceRow({ place }: { place: Place }) {
  return (
    <button className="dhp-place-row" type="button">
      <span><place.icon aria-hidden="true" /></span>
      <span>
        <strong>{place.label}</strong>
        <small>{place.detail}</small>
      </span>
      <em>{place.reason}</em>
    </button>
  );
}

function ContributionEditor({
  presentation,
}: {
  presentation: "card" | "line" | "open";
}) {
  return (
    <div className="dhp-contribution-editor" data-presentation={presentation}>
      <span className="dhp-editor-avatar">CG</span>
      <label>
        <span className="dhp-visually-hidden">Add knowledge</span>
        <textarea placeholder="Add what you know, or ask what is missing…" rows={presentation === "open" ? 3 : 1} />
      </label>
      <div className="dhp-editor-actions">
        <button type="button"><PenLine aria-hidden="true" /> Contribute</button>
        <button type="button"><MessageSquareText aria-hidden="true" /> Ask</button>
        <button className="dhp-store-action" type="button"><Sparkles aria-hidden="true" /> Store</button>
      </div>
    </div>
  );
}

function TrendingRow({ inline = false }: { inline?: boolean }) {
  return (
    <div className="dhp-trending-row" data-inline={inline ? "true" : undefined}>
      <span><Flame aria-hidden="true" /> Trending</span>
      <div>
        {TRENDING.map((topic) => <button key={topic} type="button">{topic}</button>)}
      </div>
    </div>
  );
}

function FeedGrid() {
  return (
    <div className="dhp-feed-grid" aria-label="Answer Feed">
      {FEED_ITEMS.map((item) => <FeedCard item={item} key={item.title} />)}
    </div>
  );
}

function FeedList({ editorial = false }: { editorial?: boolean }) {
  return (
    <div className="dhp-feed-list" data-editorial={editorial ? "true" : undefined} aria-label="Answer Feed">
      {FEED_ITEMS.map((item, index) => (
        <article key={item.title}>
          {editorial ? <span>{String(index + 1).padStart(2, "0")}</span> : null}
          <div>
            <p>{item.source} · {item.context}</p>
            <h3>{item.title}</h3>
            <span>{item.excerpt}</span>
            <small>{item.meta}</small>
          </div>
          <button aria-label={`Open ${item.title}`} type="button"><ArrowRight aria-hidden="true" /></button>
        </article>
      ))}
    </div>
  );
}

type FeedItem = (typeof FEED_ITEMS)[number];

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <article className="dhp-feed-card">
      <header>
        <span>{item.source}</span>
        <small>{item.meta}</small>
      </header>
      <p>{item.context}</p>
      <h3>{item.title}</h3>
      <div>{item.excerpt}</div>
      <button type="button">Open Knowledge Page <ArrowRight aria-hidden="true" /></button>
    </article>
  );
}

function PrototypeSwitcher({
  current,
  label,
  onNext,
  onPrevious,
}: {
  current: VariantKey;
  label: string;
  onNext: () => void;
  onPrevious: () => void;
}) {
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="dhp-switcher" role="group" aria-label="Prototype variant switcher">
      <button aria-label="Previous variant" onClick={onPrevious} type="button">
        <ChevronLeft aria-hidden="true" />
      </button>
      <span>{current} - {label}</span>
      <button aria-label="Next variant" onClick={onNext} type="button">
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}
