// PROTOTYPE: Five header/sidebar variants, switchable via ?prototype=header-sidebar&variant=, on a throwaway shell.
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
  Bookmark,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Landmark,
  LayoutDashboard,
  LogOut,
  Moon,
  PanelLeft,
  Search,
  Settings,
  Shield,
  Sun,
  UserCircle,
  Users,
} from "lucide-react";
import profilePlaceholderUrl from "../assets/profile-placeholder.png";
import { LogeionBrand } from "../components/LogeionBrand";
import "./headerSidebarPrototype.css";

const VARIANT_ORDER = ["A", "B", "C", "D", "E"] as const;
type VariantKey = (typeof VARIANT_ORDER)[number];
type ThemePreference = "light" | "dark";
type IconComponent = ComponentType<{ "aria-hidden"?: "true"; className?: string }>;

type HeaderSidebarPrototypeProps = {
  onToggleTheme: () => void;
  theme: ThemePreference;
};

type VariantDefinition = {
  component: ComponentType<HeaderSidebarPrototypeProps>;
  label: string;
};

type PrototypeNavItem = {
  badge?: number;
  detail?: string;
  icon: IconComponent;
  id: string;
  label: string;
};

const KNOWLEDGE_ITEMS: PrototypeNavItem[] = [
  {
    detail: "All accessible knowledge",
    icon: LayoutDashboard,
    id: "dashboard",
    label: "Dashboard",
  },
  {
    detail: "School",
    icon: BookOpen,
    id: "arche-classical-academy",
    label: "Arche Classical Academy",
  },
  {
    detail: "Church",
    icon: Landmark,
    id: "ruler-of-kings-church",
    label: "Ruler of Kings Church",
  },
  {
    detail: "Family",
    icon: Users,
    id: "gelbaugh-family",
    label: "Gelbaugh Family",
  },
  {
    detail: "Study circle",
    icon: Compass,
    id: "westminster-study-circle",
    label: "Westminster Study Circle",
  },
];

const WORK_ITEMS: PrototypeNavItem[] = [
  { icon: CalendarDays, id: "calendar", label: "Calendar" },
  { badge: 4, icon: Bell, id: "notifications", label: "Notifications" },
];

const ADMIN_ITEMS: PrototypeNavItem[] = [
  { detail: "Application administration", icon: Landmark, id: "system-admin", label: "System Admin" },
];

const ACCOUNT_ITEMS: PrototypeNavItem[] = [
  { icon: UserCircle, id: "profile", label: "Profile" },
  { icon: Bookmark, id: "bookmarks", label: "Bookmarks" },
  { icon: Settings, id: "settings", label: "Settings" },
  { icon: LogOut, id: "sign-out", label: "Sign Out" },
];

const ROLE_OPTIONS = [
  "System Admin - Application administration",
  "Admin - Arche Classical Academy",
  "Admin - Ruler of Kings Church",
  "Member - Gelbaugh Family",
];

const VARIANTS: Record<VariantKey, VariantDefinition> = {
  A: { component: GroupedRailVariant, label: "Grouped thin rail" },
  B: { component: KnowledgeRailUserHeaderVariant, label: "Knowledge rail, user header" },
  C: { component: ThreeStackRailVariant, label: "Three stack rail" },
  D: { component: KnowledgeShelfVariant, label: "Knowledge shelf header" },
  E: { component: CommandBarVariant, label: "Command bar shell" },
};

export function HeaderSidebarPrototype({
  onToggleTheme,
  theme,
}: HeaderSidebarPrototypeProps) {
  const [variant, setVariant] = useState<VariantKey>(() => readVariantFromUrl());
  const activeVariant = VARIANTS[variant];
  const ActiveVariant = activeVariant.component;

  const setUrlVariant = useCallback((next: VariantKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("prototype", "header-sidebar");
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
        onNext={() => cycleVariant(1)}
        onPrevious={() => cycleVariant(-1)}
      />
    </>
  );
}

function readVariantFromUrl(): VariantKey {
  const variant = new URL(window.location.href).searchParams.get("variant");
  return isVariantKey(variant) ? variant : "A";
}

function isVariantKey(value: string | null): value is VariantKey {
  return value === "A" || value === "B" || value === "C" || value === "D" || value === "E";
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

function GroupedRailVariant({ onToggleTheme, theme }: HeaderSidebarPrototypeProps) {
  return (
    <PrototypeFrame className="hsp-variant-a" theme={theme}>
      <ThinRail ariaLabel="Primary navigation">
        <RailBrand />
        <RailGroup label="Knowledge">
          <RailItem active item={KNOWLEDGE_ITEMS[0]} />
          {KNOWLEDGE_ITEMS.slice(1, 4).map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
          <RailMore count={1} title="Westminster Study Circle" />
        </RailGroup>
        <RailGroup label="Work" push>
          {WORK_ITEMS.map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
        </RailGroup>
        <RailGroup label="Admin">
          {ADMIN_ITEMS.map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
        </RailGroup>
        <AccountIconStack onToggleTheme={onToggleTheme} theme={theme} />
      </ThinRail>

      <main className="hsp-stage">
        <HeaderBar className="hsp-header-a">
          <a className="hsp-brand-full" href="/" aria-label="Logeion dashboard">
            <LogeionBrand />
          </a>
          <RoleSelect />
          <SearchBox />
        </HeaderBar>
        <DemoWorkspace eyebrow="Dashboard" title="All Accessible Knowledge" />
      </main>
    </PrototypeFrame>
  );
}

function KnowledgeRailUserHeaderVariant({
  onToggleTheme,
  theme,
}: HeaderSidebarPrototypeProps) {
  return (
    <PrototypeFrame className="hsp-variant-b" theme={theme}>
      <ThinRail ariaLabel="Knowledge navigation">
        <RailBrand />
        <RailGroup label="Knowledge">
          {KNOWLEDGE_ITEMS.slice(0, 4).map((item, index) => (
            <RailItem active={index === 0} item={item} key={item.id} />
          ))}
          <RailMore count={1} title="Westminster Study Circle" />
        </RailGroup>
        <div className="hsp-rail-account-anchor">
          <AvatarButton />
        </div>
      </ThinRail>

      <main className="hsp-stage">
        <HeaderBar className="hsp-header-b">
          <a className="hsp-brand-mark-word" href="/" aria-label="Logeion dashboard">
            <LogeionBrand />
          </a>
          <SearchBox />
          <RolePill />
        </HeaderBar>
        <nav className="hsp-header-strip" aria-label="User and administration pages">
          <NavPillGroup label="Work" items={WORK_ITEMS} />
          <NavPillGroup label="Admin" items={ADMIN_ITEMS} />
          <AccountPillGroup onToggleTheme={onToggleTheme} theme={theme} />
        </nav>
        <DemoWorkspace eyebrow="Knowledge" title="Dashboard and pinned pages stay in the rail" />
      </main>
    </PrototypeFrame>
  );
}

function ThreeStackRailVariant({ onToggleTheme, theme }: HeaderSidebarPrototypeProps) {
  return (
    <PrototypeFrame className="hsp-variant-c" theme={theme}>
      <aside className="hsp-three-stack-rail" aria-label="Primary navigation">
        <div className="hsp-three-brand">
          <RailBrand />
        </div>
        <div className="hsp-three-panel hsp-three-panel-knowledge">
          <span>Know</span>
          <RailItem active item={KNOWLEDGE_ITEMS[0]} />
          {KNOWLEDGE_ITEMS.slice(1, 4).map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
          <RailMore count={1} title="Westminster Study Circle" />
        </div>
        <div className="hsp-three-panel hsp-three-panel-work">
          <span>Work</span>
          {WORK_ITEMS.map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
        </div>
        <div className="hsp-three-panel hsp-three-panel-user">
          <span>Me</span>
          {ADMIN_ITEMS.map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
          <RailIconButton
            icon={theme === "dark" ? Sun : Moon}
            label={theme === "dark" ? "Light theme" : "Dark theme"}
            onClick={onToggleTheme}
          />
          <AvatarButton />
        </div>
      </aside>

      <main className="hsp-stage">
        <HeaderBar className="hsp-header-c">
          <div className="hsp-context-trail" aria-label="Current knowledge path">
            <span>Dashboard</span>
            <ChevronRight aria-hidden="true" />
            <strong>All Accessible Knowledge</strong>
          </div>
          <RoleSelect />
          <SearchBox compact />
          <AccountMenuRow />
        </HeaderBar>
        <DemoWorkspace eyebrow="Pinned Knowledge Pages" title="Arche, church, and family pages remain adjacent to Dashboard" />
      </main>
    </PrototypeFrame>
  );
}

function KnowledgeShelfVariant({ onToggleTheme, theme }: HeaderSidebarPrototypeProps) {
  return (
    <PrototypeFrame className="hsp-variant-d" theme={theme}>
      <ThinRail ariaLabel="Application navigation">
        <RailBrand />
        <RailGroup label="App">
          <RailItem active item={KNOWLEDGE_ITEMS[0]} />
          {WORK_ITEMS.map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
          {ADMIN_ITEMS.map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
        </RailGroup>
        <AccountIconStack onToggleTheme={onToggleTheme} theme={theme} />
      </ThinRail>

      <main className="hsp-stage">
        <HeaderBar className="hsp-header-d">
          <a className="hsp-brand-compact" href="/" aria-label="Logeion dashboard">
            <LogeionBrand />
          </a>
          <RolePill />
          <SearchBox compact />
        </HeaderBar>
        <section className="hsp-knowledge-shelf" aria-label="Knowledge pages">
          <div>
            <span>Knowledge Pages</span>
            <strong>Dashboard plus pinned contexts</strong>
          </div>
          <div className="hsp-shelf-items">
            {KNOWLEDGE_ITEMS.map((item, index) => (
              <WideNavChip active={index === 0} item={item} key={item.id} />
            ))}
          </div>
        </section>
        <DemoWorkspace eyebrow="Workspace" title="Knowledge pages get the shelf; app and user pages stay in the rail" />
      </main>
    </PrototypeFrame>
  );
}

function CommandBarVariant({ onToggleTheme, theme }: HeaderSidebarPrototypeProps) {
  return (
    <PrototypeFrame className="hsp-variant-e" theme={theme}>
      <ThinRail ariaLabel="Primary navigation">
        <RailBrand />
        <RailGroup label="K">
          <RailItem active item={KNOWLEDGE_ITEMS[0]} />
          {KNOWLEDGE_ITEMS.slice(1, 4).map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
          <RailMore count={1} title="Westminster Study Circle" />
        </RailGroup>
        <RailGroup label="U" push>
          {WORK_ITEMS.map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
          {ADMIN_ITEMS.map((item) => (
            <RailItem item={item} key={item.id} />
          ))}
        </RailGroup>
        <AvatarButton />
      </ThinRail>

      <main className="hsp-stage">
        <header className="hsp-command-header">
          <a className="hsp-brand-command" href="/" aria-label="Logeion dashboard">
            <LogeionBrand />
          </a>
          <SearchBox command />
          <RolePill />
          <AccountToolbar onToggleTheme={onToggleTheme} theme={theme} />
        </header>
        <section className="hsp-command-secondary" aria-label="Navigation groups">
          <NavPillGroup label="Knowledge" items={KNOWLEDGE_ITEMS} />
          <NavPillGroup label="Work" items={WORK_ITEMS} />
          <NavPillGroup label="Admin" items={ADMIN_ITEMS} />
        </section>
        <DemoWorkspace eyebrow="Search Everything" title="The command bar makes search the primary header action" />
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

function ThinRail({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <aside className="hsp-thin-rail" aria-label={ariaLabel}>
      {children}
    </aside>
  );
}

function RailBrand() {
  return (
    <a className="hsp-rail-brand" href="/" aria-label="Logeion dashboard" title="Logeion dashboard">
      <LogeionBrand density="compact" />
    </a>
  );
}

function RailGroup({
  children,
  label,
  push = false,
}: {
  children: ReactNode;
  label: string;
  push?: boolean;
}) {
  return (
    <nav className={push ? "hsp-rail-group hsp-rail-group-push" : "hsp-rail-group"} aria-label={label}>
      <span className="hsp-rail-group-label">{label}</span>
      {children}
    </nav>
  );
}

function RailItem({
  active = false,
  item,
}: {
  active?: boolean;
  item: PrototypeNavItem;
}) {
  return (
    <a
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={active ? "hsp-rail-item hsp-rail-item-active" : "hsp-rail-item"}
      href="#"
      title={item.detail ? `${item.label} - ${item.detail}` : item.label}
    >
      <item.icon aria-hidden="true" />
      {item.badge ? <span className="hsp-badge">{item.badge}</span> : null}
    </a>
  );
}

function RailMore({ count, title }: { count: number; title: string }) {
  return (
    <button
      aria-label={`${count} more pinned Knowledge Pages`}
      className="hsp-rail-more"
      title={title}
      type="button"
    >
      +{count}
    </button>
  );
}

function RailIconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: IconComponent;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="hsp-rail-item hsp-rail-button"
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

function HeaderBar({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return <header className={`hsp-header ${className}`}>{children}</header>;
}

function RoleSelect() {
  return (
    <label className="hsp-role-select">
      <span>Active Role</span>
      <select aria-label="Active Role" defaultValue={ROLE_OPTIONS[0]}>
        {ROLE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function RolePill() {
  return (
    <button className="hsp-role-pill" type="button" aria-label="Active Role">
      <Shield aria-hidden="true" />
      <span>
        <small>Active Role</small>
        System Admin
      </span>
      <ChevronDown aria-hidden="true" />
    </button>
  );
}

function SearchBox({
  command = false,
  compact = false,
}: {
  command?: boolean;
  compact?: boolean;
}) {
  const className = [
    "hsp-search-wrap",
    compact ? "hsp-search-wrap-compact" : "",
    command ? "hsp-search-wrap-command" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <span>Search Everything</span>
      <label className="hsp-search">
        <Search aria-hidden="true" />
        <input aria-label="Search Everything" type="text" placeholder="Search everything you can access" />
      </label>
    </div>
  );
}

function AccountIconStack({
  onToggleTheme,
  theme,
}: HeaderSidebarPrototypeProps) {
  return (
    <nav className="hsp-account-icons" aria-label="Account menu">
      <AvatarButton />
      <RailIconButton icon={Bookmark} label="Bookmarks" />
      <RailIconButton icon={Settings} label="Settings" />
      <RailIconButton
        icon={theme === "dark" ? Sun : Moon}
        label={theme === "dark" ? "Light theme" : "Dark theme"}
        onClick={onToggleTheme}
      />
      <RailIconButton icon={LogOut} label="Sign Out" />
    </nav>
  );
}

function AvatarButton() {
  return (
    <button className="hsp-avatar-button" type="button" aria-label="Profile" title="Profile">
      <img src={profilePlaceholderUrl} alt="" aria-hidden="true" />
      <span aria-hidden="true" />
    </button>
  );
}

function NavPillGroup({
  items,
  label,
}: {
  items: PrototypeNavItem[];
  label: string;
}) {
  return (
    <div className="hsp-pill-group">
      <span>{label}</span>
      <div>
        {items.map((item, index) => (
          <WideNavChip active={index === 0 && label === "Knowledge"} item={item} key={item.id} />
        ))}
      </div>
    </div>
  );
}

function AccountPillGroup({
  onToggleTheme,
  theme,
}: HeaderSidebarPrototypeProps) {
  return (
    <div className="hsp-pill-group hsp-account-pill-group">
      <span>Me</span>
      <div>
        {ACCOUNT_ITEMS.map((item) => (
          <WideNavChip item={item} key={item.id} />
        ))}
        <button className="hsp-wide-chip" type="button" onClick={onToggleTheme}>
          {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>
        </button>
      </div>
    </div>
  );
}

function AccountToolbar({
  onToggleTheme,
  theme,
}: HeaderSidebarPrototypeProps) {
  return (
    <div className="hsp-account-toolbar" aria-label="Account menu">
      <button type="button" aria-label="Profile" title="Profile">
        <UserCircle aria-hidden="true" />
      </button>
      <button type="button" aria-label="Bookmarks" title="Bookmarks">
        <Bookmark aria-hidden="true" />
      </button>
      <button type="button" aria-label="Settings" title="Settings">
        <Settings aria-hidden="true" />
      </button>
      <button
        aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
        onClick={onToggleTheme}
        title={theme === "dark" ? "Light theme" : "Dark theme"}
        type="button"
      >
        {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </button>
      <button type="button" aria-label="Sign Out" title="Sign Out">
        <LogOut aria-hidden="true" />
      </button>
    </div>
  );
}

function AccountMenuRow() {
  return (
    <div className="hsp-account-menu-row" aria-label="Account menu">
      <AvatarButton />
      <span>Profile</span>
      <span>Bookmarks</span>
      <span>Settings</span>
      <span>Sign Out</span>
    </div>
  );
}

function WideNavChip({
  active = false,
  item,
}: {
  active?: boolean;
  item: PrototypeNavItem;
}) {
  return (
    <a
      aria-current={active ? "page" : undefined}
      className={active ? "hsp-wide-chip hsp-wide-chip-active" : "hsp-wide-chip"}
      href="#"
      title={item.detail ? `${item.label} - ${item.detail}` : item.label}
    >
      <item.icon aria-hidden="true" />
      <span>{item.label}</span>
      {item.badge ? <strong>{item.badge}</strong> : null}
    </a>
  );
}

function DemoWorkspace({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="hsp-workspace" aria-labelledby="hsp-workspace-title">
      <header>
        <div>
          <p>{eyebrow}</p>
          <h1 id="hsp-workspace-title">{title}</h1>
        </div>
        <div className="hsp-workspace-metrics" aria-label="Workspace summary">
          <span>
            <strong>3</strong>
            pinned
          </span>
          <span>
            <strong>4</strong>
            unread
          </span>
          <span>
            <strong>1</strong>
            admin area
          </span>
        </div>
      </header>
      <div className="hsp-preview-grid">
        <article>
          <PanelLeft aria-hidden="true" />
          <h2>Knowledge Pages</h2>
          <p>Dashboard, school, church, family, and one overflow pinned page.</p>
        </article>
        <article>
          <CalendarDays aria-hidden="true" />
          <h2>User Work</h2>
          <p>Calendar and notifications are grouped away from knowledge destinations.</p>
        </article>
        <article>
          <BarChart3 aria-hidden="true" />
          <h2>Role And Search</h2>
          <p>Active role and global search stay available without widening the sidebar.</p>
        </article>
      </div>
    </section>
  );
}
