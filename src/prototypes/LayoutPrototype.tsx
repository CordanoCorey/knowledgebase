// PROTOTYPE: Three layout variants, switchable via ?variant=, on the existing app shell.
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  BarChart3,
  Bell,
  BookmarkPlus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  HelpCircle,
  Info,
  LayoutGrid,
  Mail,
  MessageSquare,
  Moon,
  Search,
  Settings,
  UserSearch,
  Users,
} from "lucide-react";
import archePressIconUrl from "../assets/arche-press_icon-full.svg";
import "./layoutPrototype.css";

type VariantKey = "A" | "B" | "C";

type VariantDefinition = {
  label: string;
  component: ComponentType;
};

const VARIANT_ORDER: VariantKey[] = ["A", "B", "C"];

const SUPPORTED_QUESTIONS = [
  "What are my top 10 donors ready for an ask right now?",
  "Who should I reach out to this week?",
  "Which donors have given in the last 5 years?",
  "Who gave their largest gift ever in the past 12 months?",
];

const FOLLOW_UPS = [
  "Which of these donors haven't been contacted recently?",
  "Which of these donors gave the most in the last year?",
  "Who has the highest propensity score?",
];

const DONORS = [
  { name: "Avery Donor", amount: "$5,000" },
  { name: "Casey Donor", amount: "$7,500" },
  { name: "Dana Donor", amount: "$3,200" },
  { name: "Morgan Donor", amount: "$4,400" },
];

const VARIANTS: Record<VariantKey, VariantDefinition> = {
  A: { label: "Home layout", component: HomeVariant },
  B: { label: "Results layout", component: ResultsVariant },
  C: { label: "Editor hybrid", component: EditorHybridVariant },
};

export function LayoutPrototype() {
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
      <ActiveVariant />
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

function HomeVariant() {
  return (
    <HostShell contentClassName="rp-host-content rp-host-content-home">
      <main className="rp-home-main">
        <section className="rp-home-copy" aria-labelledby="rp-home-title">
          <h1 id="rp-home-title" className="rp-home-title">
            Good morning, Jordan
          </h1>
          <p className="rp-home-subtitle">
            What can I help you prioritize in your portfolio today?
          </p>
          <p className="rp-home-helper">
            AI-assisted guidance to support your judgment - you stay in control of outreach
            decisions.
          </p>

          <AssistantInput className="rp-home-input" />
          <SupportedQuestions />
        </section>
      </main>
    </HostShell>
  );
}

function ResultsVariant() {
  return (
    <HostShell contentClassName="rp-host-content rp-host-content-results">
      <main className="rp-results-main">
        <section className="rp-results-panel" aria-labelledby="rp-results-title">
          <h1 id="rp-results-title" className="rp-results-title">
            What are my top 10 donors ready for an ask right now?
          </h1>
          <div className="rp-results-toolbar">
            <p>Recommended donors</p>
            <div className="rp-action-row">
              <button type="button">
                <BookmarkPlus aria-hidden="true" />
                Save Search
              </button>
              <button type="button">
                <FolderPlus aria-hidden="true" />
                Save Portfolio
              </button>
            </div>
          </div>
          <div className="rp-donor-list" aria-label="Recommended donors">
            {DONORS.map((donor) => (
              <DonorCard key={donor.name} donor={donor} />
            ))}
          </div>
        </section>

        <aside className="rp-side-panel" aria-label="Assistant follow-up panel">
          <AssistantInput className="rp-side-input" />
          <FollowUps />
          <SupportedQuestions compact />
        </aside>
      </main>
    </HostShell>
  );
}

function EditorHybridVariant() {
  return (
    <HostShell contentClassName="rp-host-content rp-host-content-hybrid">
      <main className="rp-hybrid-main">
        <section className="rp-hybrid-assistant" aria-labelledby="rp-hybrid-title">
          <div>
            <h1 id="rp-hybrid-title" className="rp-hybrid-title">
              Knowledge priorities
            </h1>
            <p>Ask the assistant to organize this workspace before editing.</p>
          </div>
          <AssistantInput className="rp-hybrid-input" />
        </section>

        <section className="rp-hybrid-grid" aria-label="Knowledgebase working layout">
          <article className="rp-document-panel">
            <p className="rp-eyebrow">Live document</p>
            <h2>Collaborative Editor</h2>
            <div className="rp-editor-toolbar">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="rp-document-lines" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </article>

          <aside className="rp-context-panel" aria-label="Assistant context">
            <h2>Suggested questions</h2>
            <SupportedQuestions compact />
          </aside>
        </section>
      </main>
    </HostShell>
  );
}

function HostShell({
  children,
  contentClassName,
}: {
  children: React.ReactNode;
  contentClassName: string;
}) {
  return (
    <div className="layout-prototype">
      <HostSidebar />
      <div className="rp-host-column">
        <HostTopBar />
        <div className={contentClassName}>{children}</div>
      </div>
      <button className="rp-floating-spark" type="button" aria-label="Open assistant">
        <SparkGlyph aria-hidden="true" />
      </button>
    </div>
  );
}

function HostSidebar() {
  const primaryItems = useMemo(
    () => [
      { label: "Assistant", icon: SparkGlyph, active: true },
      { label: "Dashboard", icon: LayoutGrid },
      { label: "Reports", icon: BarChart3 },
      { label: "Donors", icon: Users },
      { label: "Messages", icon: MessageSquare },
    ],
    [],
  );
  const secondaryItems = useMemo(
    () => [
      { label: "Settings", icon: Settings },
      { label: "Saved", icon: BookOpen },
      { label: "Help", icon: HelpCircle },
    ],
    [],
  );

  return (
    <aside className="rp-sidebar" aria-label="Primary navigation">
      <button className="rp-logo-button" type="button" aria-label="Home">
        <BrandMark />
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
        <span className="rp-avatar" aria-label="Jordan user profile" role="img">
          J
          <span aria-hidden="true" />
        </span>
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
  icon: ComponentType<{ "aria-hidden": "true" }>;
  active?: boolean;
}) {
  return (
    <button
      className={active ? "rp-nav-button rp-nav-button-active" : "rp-nav-button"}
      title={label}
      type="button"
      aria-label={label}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

function HostTopBar() {
  return (
    <header className="rp-topbar">
      <a className="rp-brand" href="#prototype-home" aria-label="Go to home">
        <BrandMark />
      </a>
      <div className="rp-topbar-actions">
        <button className="rp-icon-button" title="Theme" type="button" aria-label="Theme">
          <Moon aria-hidden="true" />
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
          <input type="text" placeholder="Search Categories, Settings, etc." />
        </label>
      </div>
    </header>
  );
}

function BrandMark() {
  return (
    <img className="rp-brand-logo" src={archePressIconUrl} alt="" aria-hidden="true" />
  );
}

function SparkGlyph({ "aria-hidden": ariaHidden }: { "aria-hidden"?: "true" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden={ariaHidden}>
      <path
        fill="currentColor"
        d="M12 2l1.9 5.6a4 4 0 0 0 2.5 2.5L22 12l-5.6 1.9a4 4 0 0 0-2.5 2.5L12 22l-1.9-5.6a4 4 0 0 0-2.5-2.5L2 12l5.6-1.9a4 4 0 0 0 2.5-2.5L12 2z"
      />
    </svg>
  );
}

function AssistantInput({ className }: { className?: string }) {
  return (
    <form className={["rp-assistant-input", className].filter(Boolean).join(" ")}>
      <label>
        <span>Ask Assistant</span>
        <input type="text" placeholder="Ask Assistant..." />
      </label>
      <button type="submit" aria-label="Submit question">
        <SparkGlyph aria-hidden="true" />
      </button>
    </form>
  );
}

function SupportedQuestions({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={compact ? "rp-supported rp-supported-compact" : "rp-supported"}
      aria-labelledby={compact ? "rp-supported-compact-title" : "rp-supported-title"}
    >
      <h2 id={compact ? "rp-supported-compact-title" : "rp-supported-title"}>
        Supported questions
      </h2>
      <div className="rp-supported-list">
        {SUPPORTED_QUESTIONS.map((question) => (
          <button key={question} type="button" className="rp-question-chip">
            <SparkGlyph aria-hidden="true" />
            <span>{question}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function FollowUps() {
  return (
    <section className="rp-followups" aria-labelledby="rp-followups-title">
      <h2 id="rp-followups-title">Suggested follow-ups</h2>
      <div className="rp-followup-list">
        {FOLLOW_UPS.map((question) => (
          <button key={question} type="button" className="rp-followup-button">
            <MessageSquare aria-hidden="true" />
            <span>{question}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function DonorCard({ donor }: { donor: { name: string; amount: string } }) {
  return (
    <article className="rp-donor-card" aria-label={donor.name}>
      <div className="rp-donor-card-top">
        <div className="rp-donor-identity">
          <h2>{donor.name}</h2>
          <span className="rp-score-pill">
            <span>Donor score</span>
            <strong>N/A</strong>
          </span>
        </div>
        <div className="rp-confidence">
          <span>Confidence: High</span>
          <Info aria-hidden="true" />
        </div>
      </div>
      <p className="rp-gift-line">
        <strong>{donor.amount}</strong>
        <span>Expected gift amount</span>
      </p>
      <div className="rp-donor-actions">
        <button type="button">
          <UserSearch aria-hidden="true" />
          Open Donor Preview
        </button>
        <button type="button" disabled>
          <Mail aria-hidden="true" />
          Send First Draft
        </button>
      </div>
    </article>
  );
}
