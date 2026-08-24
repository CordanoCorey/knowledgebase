// PROTOTYPE: Three persistent application-frame variants, switchable via
// ?prototype=header-sidebar&variant=, on the existing prototype route.
// The Dashboard body is deliberately held neutral so this answers the frame
// question without deciding the separate Dashboard hierarchy ticket.
import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  Bell,
  BookOpen,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Home,
  Landmark,
  Layers3,
  ListTodo,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import profilePlaceholderUrl from "../assets/profile-placeholder.png";
import { LogeionBrand } from "../components/LogeionBrand";
import "./headerSidebarPrototype.css";

const VARIANT_ORDER = ["A", "B", "C"] as const;
type VariantKey = (typeof VARIANT_ORDER)[number];
type ThemePreference = "light" | "dark";
type OpenPanel = "places" | "account" | null;
type IconComponent = ComponentType<{
  "aria-hidden"?: "true";
  className?: string;
}>;

type HeaderSidebarPrototypeProps = {
  onToggleTheme: () => void;
  theme: ThemePreference;
};

type FrameVariantProps = HeaderSidebarPrototypeProps & {
  onPanelChange: (panel: OpenPanel) => void;
  openPanel: OpenPanel;
};

type PlaceItem = {
  detail: string;
  icon: IconComponent;
  label: string;
  reason: "Dashboard" | "Pinned" | "Frequent" | "Recent";
  roles: string[];
};

type PersistentDestination = {
  badge?: number;
  icon: IconComponent;
  id: "dashboard" | "places" | "calendar" | "notifications";
  label: string;
};

const PERSISTENT_DESTINATIONS: PersistentDestination[] = [
  { icon: Home, id: "dashboard", label: "Dashboard" },
  { icon: Layers3, id: "places", label: "Places" },
  { icon: CalendarDays, id: "calendar", label: "Calendar" },
  { badge: 4, icon: Bell, id: "notifications", label: "Notifications" },
];

const PLACE_ITEMS: PlaceItem[] = [
  {
    detail: "Accessible Root Knowledge Context",
    icon: Home,
    label: "Dashboard",
    reason: "Dashboard",
    roles: ["Baseline personal capacity"],
  },
  {
    detail: "School",
    icon: BookOpen,
    label: "Arche Classical Academy",
    reason: "Pinned",
    roles: ["Administrator", "Teacher", "Parent"],
  },
  {
    detail: "Church",
    icon: Landmark,
    label: "Ruler of Kings Church",
    reason: "Frequent",
    roles: ["Member", "Ministry lead"],
  },
  {
    detail: "Family",
    icon: Users,
    label: "Gelbaugh Family",
    reason: "Pinned",
    roles: ["Parent"],
  },
  {
    detail: "Study circle",
    icon: Compass,
    label: "Westminster Study Circle",
    reason: "Recent",
    roles: ["Baseline personal capacity"],
  },
];

const VARIANTS: Record<
  VariantKey,
  { component: ComponentType<FrameVariantProps>; label: string }
> = {
  A: { component: SidebarFrame, label: "Quiet labeled sidebar" },
  B: { component: HeaderFrame, label: "Header with place menu" },
  C: { component: RailAndDrawerFrame, label: "Compact rail and drawer" },
};

export function HeaderSidebarPrototype({
  onToggleTheme,
  theme,
}: HeaderSidebarPrototypeProps) {
  const [variant, setVariant] = useState<VariantKey>(() => readVariantFromUrl());
  const [openPanel, setOpenPanel] = useState<OpenPanel>("places");
  const activeVariant = VARIANTS[variant];
  const ActiveVariant = activeVariant.component;

  const setUrlVariant = useCallback((next: VariantKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("prototype", "header-sidebar");
    url.searchParams.set("variant", next);
    window.history.replaceState(null, "", url);
    setVariant(next);
    setOpenPanel("places");
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
      setOpenPanel("places");
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

  return (
    <>
      <ActiveVariant
        onPanelChange={setOpenPanel}
        onToggleTheme={onToggleTheme}
        openPanel={openPanel}
        theme={theme}
      />
      <PrototypeSwitcher
        current={variant}
        label={activeVariant.label}
        onNext={() => cycleVariant(1)}
        onPrevious={() => cycleVariant(-1)}
      />
    </>
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
    <div className="hsp-switcher" role="group" aria-label="Prototype variant switcher">
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

function SidebarFrame({
  onPanelChange,
  onToggleTheme,
  openPanel,
  theme,
}: FrameVariantProps) {
  return (
    <PrototypeFrame className="hsp-variant-a" theme={theme}>
      <aside className="hsp-sidebar" aria-label="Application frame">
        <BrandLink />
        <nav className="hsp-sidebar-nav" aria-label="Persistent destinations">
          {PERSISTENT_DESTINATIONS.map((item) => (
            <DestinationButton
              active={item.id === "dashboard"}
              expanded={item.id === "places" && openPanel === "places"}
              item={item}
              key={item.id}
              onClick={() =>
                item.id === "places"
                  ? onPanelChange(openPanel === "places" ? null : "places")
                  : undefined
              }
            />
          ))}
        </nav>
        {openPanel === "places" ? <PlaceNavigator presentation="inline" /> : null}
        <div className="hsp-sidebar-account">
          <AvatarButton
            expanded={openPanel === "account"}
            label="Corey Gelbaugh"
            onClick={() =>
              onPanelChange(openPanel === "account" ? null : "account")
            }
            showName
          />
          {openPanel === "account" ? (
            <AccountMenu onToggleTheme={onToggleTheme} theme={theme} />
          ) : null}
        </div>
      </aside>
      <main className="hsp-stage">
        <header className="hsp-content-header">
          <CurrentPlace />
          <RootSearch />
        </header>
        <WorkspaceCanvas frameNote="Places stay visible inside the labeled sidebar." />
      </main>
    </PrototypeFrame>
  );
}

function HeaderFrame({
  onPanelChange,
  onToggleTheme,
  openPanel,
  theme,
}: FrameVariantProps) {
  return (
    <PrototypeFrame className="hsp-variant-b" theme={theme}>
      <header className="hsp-global-header">
        <BrandLink />
        <nav className="hsp-header-destinations" aria-label="Persistent destinations">
          {PERSISTENT_DESTINATIONS.map((item) => (
            <DestinationButton
              active={item.id === "dashboard"}
              expanded={item.id === "places" && openPanel === "places"}
              item={item}
              key={item.id}
              onClick={() =>
                item.id === "places"
                  ? onPanelChange(openPanel === "places" ? null : "places")
                  : undefined
              }
            />
          ))}
        </nav>
        <RootSearch compact />
        <AvatarButton
          expanded={openPanel === "account"}
          label="Account"
          onClick={() => onPanelChange(openPanel === "account" ? null : "account")}
        />
      </header>
      {openPanel === "places" ? (
        <div className="hsp-header-popover hsp-header-popover-places">
          <PlaceNavigator presentation="mega" />
        </div>
      ) : null}
      {openPanel === "account" ? (
        <div className="hsp-header-popover hsp-header-popover-account">
          <AccountMenu onToggleTheme={onToggleTheme} theme={theme} />
        </div>
      ) : null}
      <main className="hsp-stage hsp-stage-full">
        <div className="hsp-page-trail">
          <CurrentPlace />
        </div>
        <WorkspaceCanvas frameNote="A single header owns every persistent destination." />
      </main>
    </PrototypeFrame>
  );
}

function RailAndDrawerFrame({
  onPanelChange,
  onToggleTheme,
  openPanel,
  theme,
}: FrameVariantProps) {
  return (
    <PrototypeFrame className="hsp-variant-c" theme={theme}>
      <aside className="hsp-rail" aria-label="Persistent destinations">
        <BrandLink compact />
        <nav>
          {PERSISTENT_DESTINATIONS.map((item) => (
            <DestinationButton
              active={item.id === "dashboard"}
              expanded={item.id === "places" && openPanel === "places"}
              iconOnly
              item={item}
              key={item.id}
              onClick={() =>
                item.id === "places"
                  ? onPanelChange(openPanel === "places" ? null : "places")
                  : undefined
              }
            />
          ))}
        </nav>
        <AvatarButton
          expanded={openPanel === "account"}
          label="Account"
          onClick={() => onPanelChange(openPanel === "account" ? null : "account")}
        />
      </aside>
      {openPanel === "places" ? (
        <aside className="hsp-drawer" aria-label="Places navigator">
          <div className="hsp-drawer-heading">
            <div>
              <p>Navigator</p>
              <h2>Places</h2>
            </div>
            <button aria-label="Close Places" onClick={() => onPanelChange(null)} type="button">
              <X aria-hidden="true" />
            </button>
          </div>
          <PlaceNavigator presentation="drawer" />
        </aside>
      ) : null}
      {openPanel === "account" ? (
        <aside className="hsp-drawer hsp-account-drawer" aria-label="Account menu">
          <div className="hsp-drawer-heading">
            <div>
              <p>User</p>
              <h2>Corey Gelbaugh</h2>
            </div>
            <button aria-label="Close Account" onClick={() => onPanelChange(null)} type="button">
              <X aria-hidden="true" />
            </button>
          </div>
          <AccountMenu onToggleTheme={onToggleTheme} theme={theme} />
        </aside>
      ) : null}
      <main className="hsp-stage">
        <header className="hsp-content-header">
          <CurrentPlace />
          <RootSearch />
        </header>
        <WorkspaceCanvas frameNote="A compact rail opens a focused navigator drawer." />
      </main>
    </PrototypeFrame>
  );
}

function PrototypeFrame({
  children,
  className,
  theme,
}: {
  children: ReactNode;
  className: string;
  theme: ThemePreference;
}) {
  return (
    <div className={`hsp-shell ${className}`} data-theme={theme}>
      {children}
    </div>
  );
}

function BrandLink({ compact = false }: { compact?: boolean }) {
  return (
    <a className="hsp-brand" href="/" aria-label="Logeion Dashboard">
      <LogeionBrand density={compact ? "compact" : "full"} />
    </a>
  );
}

function DestinationButton({
  active = false,
  expanded = false,
  iconOnly = false,
  item,
  onClick,
}: {
  active?: boolean;
  expanded?: boolean;
  iconOnly?: boolean;
  item: PersistentDestination;
  onClick?: () => void;
}) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-expanded={item.id === "places" ? expanded : undefined}
      aria-label={iconOnly ? item.label : undefined}
      className={active ? "hsp-destination hsp-destination-active" : "hsp-destination"}
      onClick={onClick}
      title={iconOnly ? item.label : undefined}
      type="button"
    >
      <item.icon aria-hidden="true" />
      {iconOnly ? null : <span>{item.label}</span>}
      {item.badge ? <strong className="hsp-notification-badge">{item.badge}</strong> : null}
      {item.id === "places" && !iconOnly ? <ChevronDown aria-hidden="true" /> : null}
    </button>
  );
}

function PlaceNavigator({ presentation }: { presentation: "drawer" | "inline" | "mega" }) {
  return (
    <section className={`hsp-place-navigator hsp-place-${presentation}`} aria-label="Places">
      <div className="hsp-place-intro">
        <div>
          <p>{presentation === "mega" ? "Your places" : "Places"}</p>
          <span>Pinned, frequent, and recent together</span>
        </div>
        <button type="button">All places <span>12</span></button>
      </div>
      <div className="hsp-place-list">
        {PLACE_ITEMS.map((place, index) => (
          <button
            aria-current={index === 0 ? "page" : undefined}
            className="hsp-place-item"
            key={place.label}
            type="button"
          >
            <span className="hsp-place-icon">
              <place.icon aria-hidden="true" />
            </span>
            <span className="hsp-place-copy">
              <span className="hsp-place-title-row">
                <strong>{place.label}</strong>
                <small>{place.reason}</small>
              </span>
              <span className="hsp-place-detail">{place.detail}</span>
              <span className="hsp-role-summary" aria-label={`Applicable roles: ${place.roles.join(", ")}`}>
                {place.roles.map((role) => (
                  <span key={role}>{role}</span>
                ))}
              </span>
            </span>
            {index === 0 ? <Check aria-hidden="true" className="hsp-current-check" /> : null}
          </button>
        ))}
      </div>
      <p className="hsp-role-note">
        Role labels summarize every capacity that applies at a destination. They are not controls.
      </p>
    </section>
  );
}

function RootSearch({ compact = false }: { compact?: boolean }) {
  return (
    <label className={compact ? "hsp-root-search hsp-root-search-compact" : "hsp-root-search"}>
      <Search aria-hidden="true" />
      <input aria-label="Search Everything" placeholder="Search everything you can access" type="search" />
      <kbd>/</kbd>
    </label>
  );
}

function CurrentPlace() {
  return (
    <div className="hsp-current-place">
      <span>Dashboard</span>
      <small>Accessible Root Knowledge Context</small>
    </div>
  );
}

function AvatarButton({
  expanded,
  label,
  onClick,
  showName = false,
}: {
  expanded: boolean;
  label: string;
  onClick: () => void;
  showName?: boolean;
}) {
  return (
    <button
      aria-expanded={expanded}
      aria-label="Open account menu"
      className="hsp-avatar-button"
      onClick={onClick}
      type="button"
    >
      <img alt="" aria-hidden="true" src={profilePlaceholderUrl} />
      {showName ? (
        <span>
          <strong>{label}</strong>
          <small>Account and personal views</small>
        </span>
      ) : null}
      {showName ? <ChevronDown aria-hidden="true" /> : null}
    </button>
  );
}

function AccountMenu({
  onToggleTheme,
  theme,
}: HeaderSidebarPrototypeProps) {
  return (
    <nav className="hsp-account-menu" aria-label="Account and personal views">
      <AccountMenuItem badge={3} icon={ListTodo} label="To-do" />
      <AccountMenuItem icon={UserCircle} label="Profile" />
      <AccountMenuItem icon={Bookmark} label="Commonplace Book" />
      <AccountMenuItem icon={Settings} label="Settings" />
      <div className="hsp-account-divider" />
      <button onClick={onToggleTheme} type="button">
        {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>
      </button>
      <AccountMenuItem icon={Landmark} label="Administration" />
      <AccountMenuItem icon={LogOut} label="Sign out" />
    </nav>
  );
}

function AccountMenuItem({
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

function WorkspaceCanvas({ frameNote }: { frameNote: string }) {
  return (
    <section className="hsp-workspace" aria-labelledby="hsp-workspace-title">
      <div className="hsp-prototype-state" role="note">
        <Menu aria-hidden="true" />
        <span><strong>Frame question only.</strong> {frameNote} Dashboard composition is held neutral.</span>
      </div>
      <header className="hsp-workspace-heading">
        <div>
          <p>Dashboard</p>
          <h1 id="hsp-workspace-title">All Accessible Knowledge</h1>
        </div>
        <div className="hsp-active-here">
          <span>Active here</span>
          <strong>Baseline personal capacity</strong>
          <small>Role summaries are informational, never selectable.</small>
        </div>
      </header>
      <div className="hsp-neutral-context">
        <div>
          <span>Knowledge Navigator</span>
          <strong>All Accessible Knowledge</strong>
        </div>
        <button type="button">Add context</button>
      </div>
      <div className="hsp-neutral-grid">
        <section>
          <p>Contribution Editor</p>
          <h2>Add what you know</h2>
          <div className="hsp-composer-placeholder">
            Contribute an Answer, Question, Event, or other Knowledge Entry
          </div>
        </section>
        <section>
          <p>Answer Feed</p>
          <h2>Relevant knowledge</h2>
          <article>
            <span className="hsp-avatar-placeholder">CG</span>
            <div>
              <strong>A familiar Knowledge Page has new activity</strong>
              <small>Representative content only</small>
            </div>
          </article>
          <article>
            <span className="hsp-avatar-placeholder">AP</span>
            <div>
              <strong>A recent contribution in an accessible context</strong>
              <small>Representative content only</small>
            </div>
          </article>
        </section>
      </div>
    </section>
  );
}
