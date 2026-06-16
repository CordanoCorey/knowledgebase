import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ElementType,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { flushSync } from "react-dom";
import {
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  CalendarDays,
  Check,
  Clock,
  Compass,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  Moon,
  MousePointerClick,
  Pin,
  PinOff,
  Search,
  Settings,
  Sparkles,
  Sun,
  Tag,
  TrendingUp,
  UserCircle,
  Users,
  UploadCloud,
  X,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { parseBiblePassageReference } from "../convex/lib/scriptureReferences";
import { AuthPanel, SignOutButton } from "./auth/AuthPanel";
import { OrganizationAccessRequestScreen } from "./auth/OrganizationAccessRequest";
import archePressIconUrl from "./assets/arche-press_icon-full.svg";
import profilePlaceholderUrl from "./assets/profile-placeholder.png";
import { AnswerFeed as AnswerFeedSurface } from "./AnswerFeed";
import { ContributionEditor as ContributionEditorSurface } from "./ContributionEditor";
import { KnowledgeRequestComposer } from "./KnowledgeRequestComposer";
import { Presence } from "./Presence";
import {
  getNavigatorAnalyticsTagKeys,
  getPageVisitAnalyticsInput,
  type NavigatorUsageKind,
} from "./analytics";
import { KnowledgeSlotCard } from "./components/KnowledgeCards";
import { KnowledgeTypeBadge, KnowledgeTypeIcon } from "./components/KnowledgeTypeIcon";
import { KnowledgeTypeOverview } from "./components/KnowledgeTypeOverview";
import { SmartStoragePlayground } from "./SmartStoragePlayground";
import {
  ANSWER_FEED_FIXTURE,
  getFixtureContextTags,
  isAnswerFeedSlot,
  selectAnswerFeedItems,
} from "./answerFeedData";
import {
  addActiveTag,
  getActiveTagsFromRoute,
  getCanonicalKnowledgeContextHref,
  getInactiveNavigatorTags,
  getKnowledgeContextKey,
  removeActiveTag,
} from "./knowledgeContext";
import type { ActiveTag } from "./knowledgeContext";
import type {
  AnswerFeedItem,
  AuthorableKnowledgeType,
  ContributionInput,
  ContributionResult,
  GuidedContributionType,
  KnowledgeEntrySummary,
  KnowledgeContextTrendKind,
  KnowledgeContextTrendSummary,
  KnowledgeSlotSummary,
  SmartStorageProposalReviewSummary,
} from "./knowledgeContracts";
import {
  formatKnowledgeTypeLabel,
  isAuthorableKnowledgeType,
} from "./knowledgeContracts";
import { LayoutPrototype } from "./prototypes/LayoutPrototype";

const THEME_STORAGE_KEY = "knowledgebase-theme";
const TOPBAR_SCROLL_TOLERANCE = 8;

const SAMPLE_TAG_ID = "first-crusade";
const SAMPLE_ORG_ID = "arche-classical-academy";
const SAMPLE_CONTEXT_TAG_IDS = "first-crusade,matthew-5-9";
const SAMPLE_SCRIPTURE_PASSAGE = "joshua-1-6-9";
const MAX_PASSAGE_SUGGESTIONS = 5;

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    skipTransition: () => void;
    updateCallbackDone: Promise<void>;
  };
};

type ThemePreference = "light" | "dark";
type OrganizationKind = "school" | "church" | "family" | "community";

type PageId =
  | "dashboard"
  | "scripture"
  | "tag"
  | "explore-context"
  | "organization-home"
  | "organization-settings"
  | "smart-storage-playground"
  | "analytics"
  | "profile"
  | "settings"
  | "notifications"
  | "calendar";

type CoreComponentId =
  | "knowledge-navigator"
  | "answer-feed"
  | "knowledge-request-composer"
  | "contribution-editor"
  | "knowledge-entry-card"
  | "knowledge-slot-card";

type RouteDefinition = {
  components: CoreComponentId[];
  href: string;
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  id: PageId;
  label: string;
  pattern: string;
  relatedRouteIds?: PageId[];
};

type RouteState = {
  route: RouteDefinition;
  pathname: string;
  search: string;
};

type AllowedAppAccess = {
  email?: string;
  organizations: Array<{
    name: string;
    organizationEntryId: Id<"organizationEntries">;
    organizationKind: OrganizationKind;
    organizationReferentId: Id<"referents">;
    role: string;
  }>;
  status: "allowed";
  userId: Id<"users">;
};

type CalendarEvent = {
  contextHref: string;
  contextLabel: string;
  day: number;
  groupLabel: string;
  id: string;
  locationLabel: string;
  status: "confirmed" | "draft";
  timeLabel: string;
  title: string;
};

type TodayAgendaItem = {
  contextHref: string;
  contextLabel: string;
  detail: string;
  groupLabel: string;
  id: string;
  knowledgeType: AuthorableKnowledgeType;
  statusLabel: string;
  timeLabel: string;
  title: string;
};

type DashboardBibleContextSuggestion = {
  href: string;
  label: string;
  latestActivityAt?: number;
  openRequestCount: number;
  overdueRequestCount: number;
  recentVisitCount: number;
  targetKey: string;
  totalVisitCount: number;
  trendKind: KnowledgeContextTrendKind;
  trendScore: number;
};

type NotificationFilter = "all" | "unread" | "knowledgeSlots" | "events";

type NotificationKind = "answer" | "event" | "knowledgeSlot" | "subscription";

type NotificationStatus = "read" | "unread";

type UserNotification = {
  body: string;
  contextHref: string;
  contextLabel: string;
  id: Id<"userNotifications">;
  kind: NotificationKind;
  readAt?: number;
  receivedAt: number;
  status: NotificationStatus;
  title: string;
};

type UserNotificationInbox = {
  notifications: UserNotification[];
  summary: UserNotificationSummary;
};

type UserNotificationSummary = {
  allCount: number;
  eventCount: number;
  knowledgeSlotCount: number;
  latestReceivedAt?: number;
  unreadCount: number;
};

type UserNotificationUnreadSummary = {
  latestReceivedAt?: number;
  unreadCount: number;
};

type OrganizationPageProfile = {
  id: string;
  name: string;
  organizationKind: OrganizationKind;
  organizationReferentId?: Id<"referents">;
  role: string;
};

type OrganizationPageMetric = {
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  id: string;
  label: string;
  value: string;
};

type OrganizationPageAction = {
  detail: string;
  href?: string;
  guidedContributionType?: GuidedContributionType;
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  id: string;
  label: string;
};

type OrganizationPageFocusItem = {
  detail: string;
  href: string;
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  id: string;
  meta: string;
  status: string;
  title: string;
};

type OrganizationPageMode = {
  id: string;
  items: OrganizationPageFocusItem[];
  label: string;
  title: string;
};

type OrganizationPageConfig = {
  actions: OrganizationPageAction[];
  contextLabel: string;
  description: string;
  detailLabel: string;
  detailValue: string;
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  metrics: OrganizationPageMetric[];
  modes: OrganizationPageMode[];
  pageLabel: string;
};

type SidebarPinnedKnowledgePage = {
  href: string;
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  id: string;
  label: string;
  organizationKind: OrganizationKind;
  organizationName: string;
  organizationReferentId: Id<"referents">;
  pageKey: string;
  pinSource: "defaultSeed" | "manual";
  secondaryLabel: string;
  sortOrder: number;
};

type DurableSidebarPinnedKnowledgePage = Omit<
  SidebarPinnedKnowledgePage,
  "icon"
>;

type ProfileBookmarkedKnowledgePage = {
  createdAt: number;
  href: string;
  id: string;
  label: string;
  organizationKind: OrganizationKind;
  organizationName: string;
  organizationReferentId: Id<"referents">;
  pageKey: string;
  secondaryLabel: string;
  updatedAt: number;
};

type NotificationSubscriptionSource = {
  createdAt: number;
  href: string;
  id: string;
  label: string;
  organizationKind: OrganizationKind;
  organizationName: string;
  organizationReferentId: Id<"referents">;
  secondaryLabel: string;
  subscriptionKey: string;
  targetKind: "organization";
  targetReferentId: Id<"referents">;
  updatedAt: number;
};

type ActiveRoleOption = {
  detail: string;
  id: string;
  label: string;
};

const ROUTES: RouteDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    pattern: "/",
    icon: LayoutDashboard,
    components: [
      "knowledge-navigator",
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "scripture",
    label: "Bible Passage",
    href: `/scripture/${SAMPLE_SCRIPTURE_PASSAGE}`,
    pattern: "/scripture/:passageString",
    icon: BookOpen,
    components: [
      "knowledge-navigator",
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "tag",
    label: "Referent Page",
    href: `/goto/${SAMPLE_TAG_ID}`,
    pattern: "/goto/:tagId",
    icon: Tag,
    components: [
      "knowledge-navigator",
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "explore-context",
    label: "Explore Context",
    href: `/explore?tagIds=${SAMPLE_CONTEXT_TAG_IDS}`,
    pattern: "/explore?tagIds=",
    icon: Compass,
    components: [
      "knowledge-navigator",
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "organization-home",
    label: "Organization Home",
    href: `/organizations/${SAMPLE_ORG_ID}`,
    pattern: "/organizations/:orgId",
    icon: Landmark,
    components: [
      "knowledge-navigator",
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
  },
  {
    id: "organization-settings",
    label: "Organization Settings",
    href: `/organizations/${SAMPLE_ORG_ID}/settings`,
    pattern: "/organizations/:orgId/settings",
    icon: Settings,
    components: [],
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    pattern: "/analytics",
    icon: BarChart3,
    components: [],
    relatedRouteIds: ["dashboard", "explore-context", "scripture"],
  },
  {
    id: "smart-storage-playground",
    label: "Smart Storage",
    href: "/playground/smart-storage",
    pattern: "/playground/smart-storage",
    icon: UploadCloud,
    components: [],
    relatedRouteIds: ["dashboard", "explore-context"],
  },
  {
    id: "profile",
    label: "Profile",
    href: "/profile",
    pattern: "/profile",
    icon: UserCircle,
    components: [
      "answer-feed",
      "knowledge-request-composer",
      "contribution-editor",
      "knowledge-entry-card",
      "knowledge-slot-card",
    ],
    relatedRouteIds: ["calendar", "settings", "notifications"],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    pattern: "/settings",
    icon: Settings,
    components: [],
    relatedRouteIds: ["profile", "notifications"],
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    pattern: "/notifications",
    icon: Bell,
    components: [],
    relatedRouteIds: ["profile", "settings"],
  },
  {
    id: "calendar",
    label: "Calendar",
    href: "/calendar",
    pattern: "/calendar",
    icon: CalendarDays,
    components: [],
    relatedRouteIds: ["explore-context", "organization-home", "profile"],
  },
];

const ROUTE_BY_ID = new Map(ROUTES.map((route) => [route.id, route]));
const PRIMARY_ROUTE_IDS: PageId[] = ["dashboard"];
const USER_ROUTE_IDS: PageId[] = ["calendar", "notifications"];
const SIDEBAR_VISIBLE_PIN_LIMIT = 3;

const CALENDAR_MONTH_LABEL = "June 2026";
const CALENDAR_DAY_COUNT = 30;
const CALENDAR_START_WEEKDAY_INDEX = 1;
const CALENDAR_TODAY = 12;
const CALENDAR_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: "trial-by-fire-sermon",
    day: 7,
    title: "Trial by Fire",
    timeLabel: "10:30 AM",
    locationLabel: "Sanctuary",
    groupLabel: "Ruler of Kings Church",
    contextLabel: "Daniel 3",
    contextHref: "/scripture/daniel-3",
    status: "confirmed",
  },
  {
    id: "grade-9-church-history",
    day: 12,
    title: "Grade 9 Church History",
    timeLabel: "10:40 AM",
    locationLabel: "Room 204",
    groupLabel: "Arche Classical Academy",
    contextLabel: "First Crusade + Matthew 5:9",
    contextHref: "/explore?tagIds=first-crusade,matthew-5-9",
    status: "confirmed",
  },
  {
    id: "grade-10-medieval-literature",
    day: 12,
    title: "Grade 10 Medieval Literature",
    timeLabel: "1:30 PM",
    locationLabel: "Library",
    groupLabel: "Arche Classical Academy",
    contextLabel: "Boethius + Romans 8:28",
    contextHref: "/explore?tagIds=boethius,grade-10-medieval-literature,romans-8-28",
    status: "confirmed",
  },
  {
    id: "deacon-prayer-follow-up",
    day: 12,
    title: "Deacon prayer follow-up",
    timeLabel: "3:45 PM",
    locationLabel: "Ruler of Kings Church",
    groupLabel: "Ruler of Kings Deacons",
    contextLabel: "Courage + Joshua 1:6-9",
    contextHref: "/explore?tagIds=courage,joshua-1-6-9,ruler-of-kings-deacons",
    status: "confirmed",
  },
  {
    id: "pride-leads-to-death-sermon",
    day: 14,
    title: "Pride Leads to Death",
    timeLabel: "10:30 AM",
    locationLabel: "Sanctuary",
    groupLabel: "Ruler of Kings Church",
    contextLabel: "Daniel 4",
    contextHref: "/scripture/daniel-4",
    status: "confirmed",
  },
  {
    id: "americas-founding-250",
    day: 26,
    title: "250th Celebration of America's Founding",
    timeLabel: "6:30 PM",
    locationLabel: "Fellowship hall",
    groupLabel: "Ruler of Kings Church",
    contextLabel: "Kingdom of Christ",
    contextHref: "/explore?tagIds=americas-founding-250,kingdom-of-christ,revelation-11-15",
    status: "draft",
  },
];

const TODAY_AGENDA_ITEMS: TodayAgendaItem[] = [
  {
    id: "agenda-grade-9-prep",
    timeLabel: "8:10 AM",
    title: "Finish the Crusades seminar frame",
    detail:
      "Connect Augustine's ordered loves to Matthew 5:9 before Grade 9 Church History.",
    groupLabel: "Grade 9 Church History",
    contextLabel: "First Crusade + The City of God",
    contextHref: "/explore?tagIds=first-crusade,matthew-5-9,the-city-of-god",
    knowledgeType: "lesson",
    statusLabel: "Continue Entry",
  },
  {
    id: "agenda-student-question",
    timeLabel: "9:15 AM",
    title: "Answer Micah's Crusades question",
    detail:
      "Student question: was the First Crusade courage, zeal without knowledge, or presumption?",
    groupLabel: "Grade 9 Church History",
    contextLabel: "Requested Entry",
    contextHref: "/explore?tagIds=first-crusade,matthew-5-9",
    knowledgeType: "comment",
    statusLabel: "Open Request",
  },
  {
    id: "agenda-grade-10-medieval-lit",
    timeLabel: "1:30 PM",
    title: "Teach Boethius on providence",
    detail:
      "Keep the Grade 10 Medieval Literature lesson open for final notes before class.",
    groupLabel: "Grade 10 Medieval Literature",
    contextLabel: "Boethius + Romans 8:28",
    contextHref: "/explore?tagIds=boethius,grade-10-medieval-literature,romans-8-28",
    knowledgeType: "lesson",
    statusLabel: "Continue Entry",
  },
  {
    id: "agenda-deacon-follow-up",
    timeLabel: "3:45 PM",
    title: "Record deacon prayer follow-up",
    detail:
      "Tie the pastoral note to courage and Joshua 1:6-9 for the Ruler of Kings deacons.",
    groupLabel: "Ruler of Kings Deacons",
    contextLabel: "Courage + Joshua 1:6-9",
    contextHref: "/explore?tagIds=courage,joshua-1-6-9,ruler-of-kings-deacons",
    knowledgeType: "prayerRequest",
    statusLabel: "Open Request",
  },
  {
    id: "agenda-founding-celebration",
    timeLabel: "6:30 PM",
    title: "Review founding celebration event",
    detail:
      "Ruler of Kings Church planning for the 250th Celebration of America's Founding.",
    groupLabel: "Ruler of Kings Church",
    contextLabel: "Kingdom of Christ",
    contextHref: "/explore?tagIds=americas-founding-250,kingdom-of-christ,revelation-11-15",
    knowledgeType: "event",
    statusLabel: "Calendar",
  },
];

const DASHBOARD_BIBLE_CONTEXT_FALLBACKS: DashboardBibleContextSuggestion[] = [
  {
    href: "/scripture/daniel-4",
    label: "Daniel 4",
    latestActivityAt: Date.UTC(2026, 5, 12, 12),
    openRequestCount: 1,
    overdueRequestCount: 0,
    recentVisitCount: 2,
    targetKey: "daniel-4",
    totalVisitCount: 5,
    trendKind: "popularAndNeedsContribution",
    trendScore: 58,
  },
  {
    href: "/scripture/matthew-5-9",
    label: "Matthew 5:9",
    latestActivityAt: Date.UTC(2026, 5, 12, 14),
    openRequestCount: 1,
    overdueRequestCount: 1,
    recentVisitCount: 1,
    targetKey: "matthew-5-9",
    totalVisitCount: 3,
    trendKind: "popularAndNeedsContribution",
    trendScore: 54,
  },
  {
    href: "/scripture/joshua-1-6-9",
    label: "Joshua 1:6-9",
    latestActivityAt: Date.UTC(2026, 5, 12, 19),
    openRequestCount: 1,
    overdueRequestCount: 0,
    recentVisitCount: 1,
    targetKey: "joshua-1-6-9",
    totalVisitCount: 2,
    trendKind: "needsContribution",
    trendScore: 32,
  },
  {
    href: "/scripture/romans-8-28",
    label: "Romans 8:28",
    latestActivityAt: Date.UTC(2026, 5, 12, 15),
    openRequestCount: 0,
    overdueRequestCount: 0,
    recentVisitCount: 2,
    targetKey: "romans-8-28",
    totalVisitCount: 4,
    trendKind: "popular",
    trendScore: 31,
  },
];

const NOTIFICATION_FILTERS: Array<{
  id: NotificationFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "knowledgeSlots", label: "Knowledge Slots" },
  { id: "events", label: "Events" },
];

const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  answer: "Answer",
  event: "Event",
  knowledgeSlot: "Request",
  subscription: "Subscription",
};

const NOTIFICATION_TIME_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const ORGANIZATION_DEMO_PROFILES: Record<string, OrganizationPageProfile> = {
  "arche-classical-academy": {
    id: "arche-classical-academy",
    name: "Arche Classical Academy",
    organizationKind: "school",
    role: "admin",
  },
  "ruler-of-kings-church": {
    id: "ruler-of-kings-church",
    name: "Ruler of Kings Church",
    organizationKind: "church",
    role: "admin",
  },
  "my-school": {
    id: "my-school",
    name: "My School",
    organizationKind: "school",
    role: "admin",
  },
  "my-church": {
    id: "my-church",
    name: "My Church",
    organizationKind: "church",
    role: "admin",
  },
  "my-family": {
    id: "my-family",
    name: "My Family",
    organizationKind: "family",
    role: "admin",
  },
  "my-community": {
    id: "my-community",
    name: "My Community",
    organizationKind: "community",
    role: "admin",
  },
};

const ORGANIZATION_PAGE_CONFIGS: Record<OrganizationKind, OrganizationPageConfig> = {
  church: {
    actions: [
      {
        detail: "Open the next sermon text and related answers.",
        href: "/scripture/daniel-4",
        icon: BookOpen,
        id: "sermon",
        label: "Sermon Work",
      },
      {
        detail: "Review prayer and member care follow-ups.",
        href: "/explore?tagIds=courage,joshua-1-6-9,ruler-of-kings-deacons",
        icon: Bell,
        id: "care",
        label: "Care Queue",
      },
      {
        detail: "Create a named ministry, class, or care group in this church context.",
        guidedContributionType: "group",
        icon: Users,
        id: "create-group",
        label: "Create Group",
      },
      {
        detail: "Open the church calendar.",
        href: "/calendar",
        icon: CalendarDays,
        id: "calendar",
        label: "Church Calendar",
      },
    ],
    contextLabel: "Worship, care, teaching, and shared life",
    description:
      "A church workspace for sermon preparation, prayer requests, member care, gatherings, and the knowledge that should stay attached to ministry moments.",
    detailLabel: "Primary rhythm",
    detailValue: "Lord's Day and pastoral care",
    icon: Landmark,
    metrics: [
      { icon: CalendarDays, id: "services", label: "Upcoming", value: "3 services" },
      { icon: Bell, id: "requests", label: "Prayer care", value: "4 open" },
      { icon: BookOpen, id: "sermons", label: "Sermons", value: "2 drafts" },
      { icon: Users, id: "groups", label: "Groups", value: "5 active" },
    ],
    modes: [
      {
        id: "ministry",
        label: "Ministry",
        title: "Ministry Queue",
        items: [
          {
            detail: "Attach deacon notes to courage and Joshua 1:6-9 before follow-up.",
            href: "/explore?tagIds=courage,joshua-1-6-9,ruler-of-kings-deacons",
            icon: Bell,
            id: "prayer-follow-up",
            meta: "Deacons",
            status: "Open Request",
            title: "Deacon prayer follow-up",
          },
          {
            detail: "Finish the Daniel 4 frame for pride, kingdoms, and mercy.",
            href: "/scripture/daniel-4",
            icon: BookOpen,
            id: "sermon-daniel-4",
            meta: "Daniel Series",
            status: "Draft",
            title: "Pride Leads to Death",
          },
        ],
      },
      {
        id: "people",
        label: "People",
        title: "Care and Membership",
        items: [
          {
            detail: "Keep pastoral context connected without turning care into loose notes.",
            href: "/explore?tagIds=courage,joshua-1-6-9",
            icon: Users,
            id: "member-care",
            meta: "Member care",
            status: "Needs Answer",
            title: "Courage counsel thread",
          },
          {
            detail: "Prepare shared notes for the America's founding celebration.",
            href: "/explore?tagIds=americas-founding-250,kingdom-of-christ,revelation-11-15",
            icon: CalendarDays,
            id: "celebration",
            meta: "Event",
            status: "Planning",
            title: "250th Celebration",
          },
        ],
      },
    ],
    pageLabel: "My Church",
  },
  school: {
    actions: [
      {
        detail: "Open the teaching queue for today's lessons.",
        href: "/",
        icon: CalendarDays,
        id: "school-day",
        label: "School Day",
      },
      {
        detail: "Prepare the next Church History context.",
        href: "/explore?tagIds=first-crusade,matthew-5-9",
        icon: BookOpen,
        id: "lesson",
        label: "Lesson Builder",
      },
      {
        detail: "Answer student requests in context.",
        href: "/explore?tagIds=first-crusade,matthew-5-9,student-crusades-question",
        icon: Bell,
        id: "questions",
        label: "Student Questions",
      },
      {
        detail: "Create a named class, club, cohort, or team in this school context.",
        guidedContributionType: "group",
        icon: Users,
        id: "create-group",
        label: "Create Group",
      },
    ],
    contextLabel: "Classes, lessons, readings, questions, and student work",
    description:
      "A school workspace for lesson planning, class sections, student questions, readings, and the durable knowledge that builds across courses.",
    detailLabel: "Primary rhythm",
    detailValue: "Class periods and lesson arcs",
    icon: BookOpen,
    metrics: [
      { icon: CalendarDays, id: "classes", label: "Today", value: "5 classes" },
      { icon: Bell, id: "questions", label: "Student asks", value: "3 open" },
      { icon: BookOpen, id: "lessons", label: "Lessons", value: "7 active" },
      { icon: Users, id: "sections", label: "Sections", value: "4 groups" },
    ],
    modes: [
      {
        id: "classes",
        label: "Classes",
        title: "Teaching Queue",
        items: [
          {
            detail: "Connect Augustine's ordered loves to Matthew 5:9 before seminar.",
            href: "/explore?tagIds=first-crusade,matthew-5-9,the-city-of-god",
            icon: BookOpen,
            id: "grade-9-history",
            meta: "Grade 9",
            status: "Continue Entry",
            title: "Church History seminar",
          },
          {
            detail: "Keep the Boethius lesson open for final notes before class.",
            href: "/explore?tagIds=boethius,grade-10-medieval-literature,romans-8-28",
            icon: Clock,
            id: "grade-10-literature",
            meta: "Grade 10",
            status: "Ready",
            title: "Medieval Literature",
          },
        ],
      },
      {
        id: "students",
        label: "Students",
        title: "Student Requests",
        items: [
          {
            detail: "Distinguish Christian courage from zeal without knowledge.",
            href: "/explore?tagIds=first-crusade,matthew-5-9,student-crusades-question",
            icon: Bell,
            id: "micah-question",
            meta: "Grade 9",
            status: "Open Request",
            title: "Micah's Crusades question",
          },
          {
            detail: "Collect the recurring providence questions from literature notes.",
            href: "/explore?tagIds=boethius,providence,romans-8-28",
            icon: Tag,
            id: "providence-thread",
            meta: "Reading notes",
            status: "Needs Synthesis",
            title: "Providence thread",
          },
        ],
      },
    ],
    pageLabel: "My School",
  },
  family: {
    actions: [
      {
        detail: "Open the household calendar and shared commitments.",
        href: "/calendar",
        icon: CalendarDays,
        id: "family-calendar",
        label: "Family Calendar",
      },
      {
        detail: "Collect prayer, encouragement, and counsel requests.",
        href: "/explore?tagIds=courage,joshua-1-6-9",
        icon: Bell,
        id: "family-prayer",
        label: "Prayer Notes",
      },
      {
        detail: "Save stories, decisions, and recurring household wisdom.",
        href: "/goto/ordered-loves",
        icon: BookOpen,
        id: "family-library",
        label: "Family Library",
      },
    ],
    contextLabel: "Household rhythms, prayer, memories, and decisions",
    description:
      "A family workspace for household rhythms, prayer, memories, important decisions, and the practical knowledge a home keeps returning to.",
    detailLabel: "Primary rhythm",
    detailValue: "Daily household life",
    icon: Users,
    metrics: [
      { icon: CalendarDays, id: "commitments", label: "This week", value: "6 items" },
      { icon: Bell, id: "prayer", label: "Prayer", value: "5 notes" },
      { icon: BookOpen, id: "stories", label: "Stories", value: "9 saved" },
      { icon: Users, id: "people", label: "Household", value: "4 people" },
    ],
    modes: [
      {
        id: "home",
        label: "Home",
        title: "Household Queue",
        items: [
          {
            detail: "Review the week and keep commitments tied to the right people.",
            href: "/calendar",
            icon: CalendarDays,
            id: "weekly-rhythm",
            meta: "This week",
            status: "Planning",
            title: "Weekly household rhythm",
          },
          {
            detail: "Turn family worship notes into a reusable Bible context.",
            href: "/scripture/joshua-1-6-9",
            icon: BookOpen,
            id: "family-worship",
            meta: "Scripture",
            status: "Continue Entry",
            title: "Joshua courage notes",
          },
        ],
      },
      {
        id: "memory",
        label: "Memory",
        title: "Family Memory",
        items: [
          {
            detail: "Save the story and attach people, place, and lesson tags.",
            href: "/goto/ordered-loves",
            icon: Tag,
            id: "story-thread",
            meta: "Story",
            status: "Draft",
            title: "Ordered loves at home",
          },
          {
            detail: "Capture answered prayer so it does not disappear into chat history.",
            href: "/explore?tagIds=courage,joshua-1-6-9",
            icon: Bell,
            id: "answered-prayer",
            meta: "Prayer",
            status: "Needs Entry",
            title: "Answered prayer note",
          },
        ],
      },
    ],
    pageLabel: "My Family",
  },
  community: {
    actions: [
      {
        detail: "Open neighborhood events and public gatherings.",
        href: "/calendar",
        icon: CalendarDays,
        id: "community-events",
        label: "Events",
      },
      {
        detail: "Coordinate shared questions and civic projects.",
        href: "/explore?tagIds=americas-founding-250,kingdom-of-christ",
        icon: Compass,
        id: "projects",
        label: "Projects",
      },
      {
        detail: "Publish useful public answers and local resources.",
        href: "/goto/kingdom-of-christ",
        icon: BookOpen,
        id: "resources",
        label: "Resources",
      },
    ],
    contextLabel: "Events, projects, local questions, and public resources",
    description:
      "A community workspace for events, volunteer projects, shared questions, public resources, and the local knowledge people need to coordinate well.",
    detailLabel: "Primary rhythm",
    detailValue: "Public events and shared projects",
    icon: Compass,
    metrics: [
      { icon: CalendarDays, id: "events", label: "Events", value: "4 upcoming" },
      { icon: Users, id: "teams", label: "Teams", value: "6 active" },
      { icon: Bell, id: "needs", label: "Needs", value: "8 open" },
      { icon: MapPin, id: "places", label: "Places", value: "5 mapped" },
    ],
    modes: [
      {
        id: "projects",
        label: "Projects",
        title: "Project Board",
        items: [
          {
            detail: "Draft the shared frame for the public founding celebration.",
            href: "/explore?tagIds=americas-founding-250,kingdom-of-christ,revelation-11-15",
            icon: CalendarDays,
            id: "founding-event",
            meta: "Public event",
            status: "Planning",
            title: "250th Celebration",
          },
          {
            detail: "Collect local resource notes and keep them attached to place tags.",
            href: "/goto/kingdom-of-christ",
            icon: MapPin,
            id: "local-resources",
            meta: "Resources",
            status: "Needs Review",
            title: "Local resource map",
          },
        ],
      },
      {
        id: "neighbors",
        label: "Neighbors",
        title: "Community Needs",
        items: [
          {
            detail: "Answer recurring questions with public, reusable entries.",
            href: "/explore?tagIds=kingdom-of-christ,americas-founding-250",
            icon: Bell,
            id: "public-questions",
            meta: "Questions",
            status: "Open",
            title: "Public question queue",
          },
          {
            detail: "Track volunteer ownership and next actions for shared work.",
            href: "/calendar",
            icon: Users,
            id: "volunteer-handoff",
            meta: "Volunteers",
            status: "Assigning",
            title: "Volunteer handoffs",
          },
        ],
      },
    ],
    pageLabel: "My Community",
  },
};

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const appAccess = useQuery(
    api.appAccess.getCurrentUserAccess,
    isAuthenticated && !isLoading ? {} : "skip",
  );
  const durablePinnedKnowledgePages = useQuery(
    api.pinnedKnowledgePages.listForSidebar,
    appAccess?.status === "allowed" ? {} : "skip",
  );
  const notificationUnreadSummary = useQuery(
    api.userNotifications.getUnreadSummary,
    appAccess?.status === "allowed" ? {} : "skip",
  ) as UserNotificationUnreadSummary | undefined;
  const recordPageVisit = useMutation(api.analytics.recordPageVisit);
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);
  const [routeState, setRouteState] = useState<RouteState>(() => getRouteState(window.location));
  const [routeMotionKey, setRouteMotionKey] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Keep the in-session toggle working even when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    function handlePopState() {
      commitRouteState(getRouteState(window.location));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (appAccess?.status !== "allowed") {
      return;
    }

    const pageVisit = getPageVisitAnalyticsInput(routeState);
    if (!pageVisit) {
      return;
    }

    void recordPageVisit(pageVisit).catch(() => undefined);
  }, [
    appAccess?.status,
    recordPageVisit,
    routeState.pathname,
    routeState.search,
  ]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    navigateToHref(href);
  }

  function navigateToHref(href: string) {
    const nextUrl = new URL(href, window.location.href);
    if (
      nextUrl.pathname === window.location.pathname &&
      nextUrl.search === window.location.search
    ) {
      return;
    }

    window.history.pushState({}, "", href);
    commitRouteState(getRouteState(window.location));
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  function goToDashboard() {
    window.history.replaceState({}, "", "/");
    commitRouteState(getRouteState(window.location));
  }

  function commitRouteState(nextRouteState: RouteState) {
    setRouteStateWithTransition(nextRouteState, setRouteState, () => {
      setRouteMotionKey((currentKey) => currentKey + 1);
    });
  }

  if (isLayoutPrototypeRoute()) {
    return <LayoutPrototype onToggleTheme={toggleTheme} theme={theme} />;
  }

  if (isLoading) {
    return (
      <main className="kb-auth-page" data-theme={theme} aria-busy="true">
        <section className="editor-panel editor-loading">
          <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          <span>Checking session</span>
        </section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="kb-auth-page" data-theme={theme}>
        <AuthPanel
          onSignInComplete={goToDashboard}
          redirectTo="/"
          surface="app"
        />
      </main>
    );
  }

  if (appAccess === undefined) {
    return (
      <main className="kb-auth-page" data-theme={theme} aria-busy="true">
        <section className="editor-panel editor-loading">
          <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          <span>Checking organization access</span>
        </section>
      </main>
    );
  }

  if (appAccess.status !== "allowed") {
    return (
      <main className="kb-auth-page" data-theme={theme}>
        <OrganizationAccessRequestScreen
          email={"email" in appAccess ? appAccess.email : undefined}
          reason={appAccess.status}
          surface="app"
        />
      </main>
    );
  }

  const pinnedKnowledgePages = getSidebarPinnedKnowledgePages(
    durablePinnedKnowledgePages,
    appAccess.organizations,
  );

  return (
    <KnowledgebaseShell
      activePageId={routeState.route.id}
      appAccess={appAccess}
      onNavigate={navigate}
      onNavigateToHref={navigateToHref}
      onToggleTheme={toggleTheme}
      notificationUnreadCount={notificationUnreadSummary?.unreadCount ?? 0}
      pinnedKnowledgePages={pinnedKnowledgePages}
      routeState={routeState}
      routeMotionKey={routeMotionKey}
      theme={theme}
    >
      <PageScaffold
        appAccess={appAccess}
        onNavigate={navigate}
        onNavigateToHref={navigateToHref}
        onToggleTheme={toggleTheme}
        pinnedKnowledgePages={pinnedKnowledgePages}
        routeState={routeState}
        theme={theme}
      />
    </KnowledgebaseShell>
  );
}

function getRouteState(location: Location): RouteState {
  const pathname = normalizePathname(location.pathname);
  return {
    route: matchRoute(pathname),
    pathname,
    search: location.search,
  };
}

function setRouteStateWithTransition(
  nextRouteState: RouteState,
  setRouteState: (nextRouteState: RouteState) => void,
  onFallbackTransition: () => void,
) {
  if (!canStartRouteViewTransition()) {
    setRouteState(nextRouteState);
    onFallbackTransition();
    return;
  }

  const startViewTransition = (document as ViewTransitionDocument).startViewTransition;
  if (typeof startViewTransition !== "function") {
    setRouteState(nextRouteState);
    onFallbackTransition();
    return;
  }

  try {
    startViewTransition.call(document, () => {
      flushSync(() => setRouteState(nextRouteState));
    });
  } catch {
    setRouteState(nextRouteState);
    onFallbackTransition();
  }
}

function canStartRouteViewTransition() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }

  return (
    typeof (document as ViewTransitionDocument).startViewTransition === "function" &&
    (typeof window.matchMedia !== "function" ||
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  );
}

function normalizePathname(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "") || "/";
}

function matchRoute(pathname: string) {
  if (pathname === "/") {
    return getRoute("dashboard");
  }

  if (pathname === "/explore") {
    return getRoute("explore-context");
  }

  if (pathname === "/scripture" || pathname.startsWith("/scripture/")) {
    return getRoute("scripture");
  }

  if (pathname === "/goto" || pathname.startsWith("/goto/")) {
    return getRoute("tag");
  }

  if (/^\/(?:organizations|orgs)\/[^/]+\/settings$/.test(pathname)) {
    return getRoute("organization-settings");
  }

  if (pathname.startsWith("/organizations/") || pathname.startsWith("/orgs/")) {
    return getRoute("organization-home");
  }

  const staticRoute = ROUTES.find(
    (route) => route.href.split("?")[0] === pathname && route.id !== "tag",
  );
  if (staticRoute) {
    return staticRoute;
  }

  return getRoute("dashboard");
}

function getRoute(pageId: PageId) {
  const route = ROUTE_BY_ID.get(pageId);
  if (!route) {
    throw new Error(`Missing route definition for ${pageId}`);
  }

  return route;
}

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function isLayoutPrototypeRoute() {
  return (
    !import.meta.env.PROD &&
    new URLSearchParams(window.location.search).get("prototype") === "layout"
  );
}

function KnowledgebaseShell({
  activePageId,
  appAccess,
  children,
  notificationUnreadCount,
  onNavigate,
  onNavigateToHref,
  onToggleTheme,
  pinnedKnowledgePages,
  routeMotionKey,
  routeState,
  theme,
}: {
  activePageId: PageId;
  appAccess: AllowedAppAccess;
  children: ReactNode;
  notificationUnreadCount: number;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  onToggleTheme: () => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeMotionKey: number;
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const [isTopbarHidden, setIsTopbarHidden] = useState(false);
  const lastScrollTopRef = useRef(0);
  const activeRoleOptions = useMemo(
    () => getActiveRoleOptions(appAccess.organizations),
    [appAccess.organizations],
  );
  const [activeRoleOptionId, setActiveRoleOptionId] = useState(
    () => activeRoleOptions[0]?.id ?? "personal",
  );
  const routeMotionClassName =
    routeMotionKey % 2 === 0 ? "kb-route-motion-a" : "kb-route-motion-b";

  useEffect(() => {
    if (
      activeRoleOptions.length > 0 &&
      !activeRoleOptions.some((option) => option.id === activeRoleOptionId)
    ) {
      setActiveRoleOptionId(activeRoleOptions[0].id);
    }
  }, [activeRoleOptionId, activeRoleOptions]);

  useEffect(() => {
    lastScrollTopRef.current = 0;
    setIsTopbarHidden(false);
  }, [routeState.pathname, routeState.search]);

  function handleContentScroll(event: UIEvent<HTMLDivElement>) {
    const nextScrollTop = Math.max(0, event.currentTarget.scrollTop);

    if (nextScrollTop <= TOPBAR_SCROLL_TOLERANCE) {
      lastScrollTopRef.current = nextScrollTop;
      setIsTopbarHidden(false);
      return;
    }

    const scrollDelta = nextScrollTop - lastScrollTopRef.current;
    if (Math.abs(scrollDelta) < TOPBAR_SCROLL_TOLERANCE) {
      return;
    }

    lastScrollTopRef.current = nextScrollTop;
    setIsTopbarHidden(scrollDelta > 0);
  }

  return (
    <div className="kb-shell" data-theme={theme}>
      <Sidebar
        activePageId={activePageId}
        notificationUnreadCount={notificationUnreadCount}
        onNavigate={onNavigate}
        onToggleTheme={onToggleTheme}
        pinnedKnowledgePages={pinnedKnowledgePages}
        routeState={routeState}
        theme={theme}
      />
      <div
        className="kb-host-column"
        data-topbar-hidden={isTopbarHidden ? "true" : undefined}
      >
        <TopBar
          activeRoleOptionId={activeRoleOptionId}
          activeRoleOptions={activeRoleOptions}
          onActiveRoleChange={setActiveRoleOptionId}
          onNavigate={onNavigate}
          onNavigateToHref={onNavigateToHref}
        />
        <div className="kb-host-content" onScroll={handleContentScroll}>
          <div className={`kb-route-transition ${routeMotionClassName}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  activePageId,
  notificationUnreadCount,
  onNavigate,
  onToggleTheme,
  pinnedKnowledgePages,
  routeState,
  theme,
}: {
  activePageId: PageId;
  notificationUnreadCount: number;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onToggleTheme: () => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const visiblePinnedKnowledgePages = pinnedKnowledgePages.slice(
    0,
    SIDEBAR_VISIBLE_PIN_LIMIT,
  );
  const overflowPinnedKnowledgePages = pinnedKnowledgePages.slice(
    SIDEBAR_VISIBLE_PIN_LIMIT,
  );

  return (
    <aside className="kb-sidebar" aria-label="Primary navigation">
      <a
        className="kb-logo-button"
        href="/"
        aria-label="Dashboard"
        onClick={(event) => onNavigate(event, "/")}
        title="Dashboard"
      >
        <BrandMark />
      </a>

      <nav className="kb-nav-stack kb-route-nav" aria-label="Knowledge Page destinations">
        {PRIMARY_ROUTE_IDS.map((pageId) => {
          const route = getRoute(pageId);

          return (
            <SidebarNavLink
              active={pageId === activePageId}
              href={route.href}
              icon={route.icon}
              key={pageId}
              label={route.label}
              onNavigate={onNavigate}
              secondaryLabel="Global Knowledge Context"
            />
          );
        })}

        {visiblePinnedKnowledgePages.length > 0 ? (
          <div className="kb-sidebar-pin-group" aria-label="Pinned Knowledge Pages">
            <p className="kb-sidebar-section-label">Pinned Knowledge Pages</p>
            {visiblePinnedKnowledgePages.map((pin) => (
              <SidebarNavLink
                active={isPinnedKnowledgePageActive(pin, activePageId, routeState)}
                href={pin.href}
                icon={pin.icon}
                key={pin.id}
                label={pin.label}
                onNavigate={onNavigate}
                secondaryLabel={pin.secondaryLabel}
              />
            ))}
            {overflowPinnedKnowledgePages.length > 0 ? (
              <button
                aria-label={`${overflowPinnedKnowledgePages.length} more pinned Knowledge Pages`}
                className="kb-sidebar-overflow"
                title={overflowPinnedKnowledgePages
                  .map((pin) => pin.organizationName)
                  .join(", ")}
                type="button"
              >
                +{overflowPinnedKnowledgePages.length} more
              </button>
            ) : null}
          </div>
        ) : null}
      </nav>

      <nav className="kb-nav-stack kb-user-route-nav" aria-label="User Views">
        {USER_ROUTE_IDS.map((pageId) => {
          const route = getRoute(pageId);

          return (
            <SidebarNavLink
              active={pageId === activePageId}
              badge={
                pageId === "notifications" && notificationUnreadCount > 0
                  ? notificationUnreadCount
                  : undefined
              }
              href={route.href}
              icon={route.icon}
              key={pageId}
              label={route.label}
              onNavigate={onNavigate}
            />
          );
        })}
        <span className="kb-nav-divider" aria-hidden="true" />
        <AvatarAccountMenu
          active={activePageId === "profile" || activePageId === "settings"}
          onNavigate={onNavigate}
          onToggleTheme={onToggleTheme}
          theme={theme}
        />
      </nav>
    </aside>
  );
}

function SidebarNavLink({
  active,
  badge,
  href,
  icon: Icon,
  label,
  onNavigate,
  secondaryLabel,
}: {
  active: boolean;
  badge?: number;
  href: string;
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  label: string;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  secondaryLabel?: string;
}) {
  return (
    <a
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={active ? "kb-nav-button kb-nav-button-active" : "kb-nav-button"}
      href={href}
      onClick={(event) => onNavigate(event, href)}
      title={secondaryLabel ? `${label} - ${secondaryLabel}` : label}
    >
      <Icon aria-hidden="true" />
      <span className="kb-nav-label">
        <span className="kb-nav-primary-label">{label}</span>
        {secondaryLabel ? (
          <span className="kb-nav-secondary-label">{secondaryLabel}</span>
        ) : null}
      </span>
      {badge ? (
        <span className="kb-nav-badge" aria-label="Unread notifications">
          {badge}
        </span>
      ) : null}
    </a>
  );
}

function AvatarAccountMenu({
  active,
  onNavigate,
  onToggleTheme,
  theme,
}: {
  active: boolean;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onToggleTheme: () => void;
  theme: ThemePreference;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const nextTheme = theme === "dark" ? "light" : "dark";
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsOpen(false);
  }

  function handleNavigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    onNavigate(event, href);
    setIsOpen(false);
  }

  return (
    <div className="kb-account-menu-wrap" onBlur={handleBlur}>
      <button
        aria-current={active ? "page" : undefined}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open account menu"
        className={
          active
            ? "kb-avatar-link kb-avatar-link-active kb-avatar-menu-button"
            : "kb-avatar-link kb-avatar-menu-button"
        }
        onClick={() => setIsOpen((current) => !current)}
        title="Account menu"
        type="button"
      >
        <img className="kb-avatar-photo" src={profilePlaceholderUrl} alt="" aria-hidden="true" />
        <span className="kb-avatar-status" aria-hidden="true" />
      </button>

      <Presence present={isOpen}>
        {(presenceState) => (
          <div
            aria-label="Account menu"
            className="kb-account-menu"
            data-presence={presenceState}
            role="menu"
          >
            <a
              href="/profile"
              onClick={(event) => handleNavigate(event, "/profile")}
              role="menuitem"
            >
              <UserCircle aria-hidden="true" />
              <span>Profile</span>
            </a>
            <a
              href="/profile?section=bookmarks"
              onClick={(event) => handleNavigate(event, "/profile?section=bookmarks")}
              role="menuitem"
            >
              <Bookmark aria-hidden="true" />
              <span>Bookmarks</span>
            </a>
            <a
              href="/settings"
              onClick={(event) => handleNavigate(event, "/settings")}
              role="menuitem"
            >
              <Settings aria-hidden="true" />
              <span>Settings</span>
            </a>
            <button
              aria-label={`Switch to ${nextTheme} theme`}
              onClick={onToggleTheme}
              role="menuitem"
              type="button"
            >
              <ThemeIcon aria-hidden="true" />
              <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>
            </button>
            <SignOutButton />
          </div>
        )}
      </Presence>
    </div>
  );
}

function TopBar({
  activeRoleOptionId,
  activeRoleOptions,
  onActiveRoleChange,
  onNavigate,
  onNavigateToHref,
}: {
  activeRoleOptionId: string;
  activeRoleOptions: ActiveRoleOption[];
  onActiveRoleChange: (optionId: string) => void;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const trimmedSearchQuery = searchQuery.trim();
  const suggestions = useMemo(
    () => getPassageSuggestions(trimmedSearchQuery, 4),
    [trimmedSearchQuery],
  );
  const isSuggestionListOpen =
    isSearchFocused && trimmedSearchQuery.length > 0 && suggestions.length > 0;

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [suggestions[0]?.href]);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.currentTarget.value);
  }

  function handleSearchBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsSearchFocused(false);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isSuggestionListOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        Math.min(currentIndex + 1, suggestions.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === "Escape") {
      setIsSearchFocused(false);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = suggestions[activeSuggestionIndex];
      if (suggestion) {
        navigateToSuggestion(suggestion.href);
      }
    }
  }

  function navigateToSuggestion(href: string) {
    onNavigateToHref(href);
    setSearchQuery("");
    setIsSearchFocused(false);
  }

  function handleSuggestionClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    onNavigate(event, href);
    setSearchQuery("");
    setIsSearchFocused(false);
  }

  return (
    <header className="kb-topbar">
      <div className="kb-topbar-actions">
        <label className="kb-active-role-switcher">
          <span>Active Role</span>
          <select
            aria-label="Active Role"
            onChange={(event) => onActiveRoleChange(event.currentTarget.value)}
            value={activeRoleOptionId}
          >
            {activeRoleOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} - {option.detail}
              </option>
            ))}
          </select>
        </label>
        <div className="kb-search-wrap" onBlur={handleSearchBlur}>
          <span className="kb-search-label">Global Search</span>
          <label className="kb-search">
            <Search aria-hidden="true" />
            <input
              aria-activedescendant={
                isSuggestionListOpen
                  ? `kb-search-suggestion-${activeSuggestionIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-controls="kb-search-suggestions"
              aria-expanded={isSuggestionListOpen}
              onChange={handleSearchChange}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search everything you can access"
              aria-label="Global Search"
              type="text"
              value={searchQuery}
            />
          </label>
          <Presence present={isSuggestionListOpen}>
            {(presenceState) => (
              <div
                className="kb-search-suggestions"
                data-presence={presenceState}
                id="kb-search-suggestions"
                role="listbox"
              >
                {suggestions.map((suggestion, index) => (
                  <a
                    aria-selected={index === activeSuggestionIndex}
                    href={suggestion.href}
                    id={`kb-search-suggestion-${index}`}
                    key={suggestion.href}
                    onClick={(event) => handleSuggestionClick(event, suggestion.href)}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    role="option"
                  >
                    <span>{suggestion.label}</span>
                    <KnowledgeTypeBadge
                      className="kb-search-suggestion-type"
                      knowledgeType="biblePassage"
                    />
                  </a>
                ))}
              </div>
            )}
          </Presence>
        </div>
      </div>
    </header>
  );
}

function PageScaffold({
  appAccess,
  onNavigate,
  onNavigateToHref,
  onToggleTheme,
  pinnedKnowledgePages,
  routeState,
  theme,
}: {
  appAccess: AllowedAppAccess;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  onToggleTheme: () => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const { route } = routeState;
  const activeTags = getActiveTagsFromRoute(routeState);
  if (route.id === "scripture") {
    return (
      <BiblePassagePage
        onNavigateToHref={onNavigateToHref}
        routeState={routeState}
      />
    );
  }

  if (route.id === "organization-home") {
    return (
      <OrganizationPage
        appAccess={appAccess}
        onNavigate={onNavigate}
        onNavigateToHref={onNavigateToHref}
        pinnedKnowledgePages={pinnedKnowledgePages}
        routeState={routeState}
      />
    );
  }

  if (route.id === "settings") {
    return (
      <SettingsPage
        appAccess={appAccess}
        onNavigate={onNavigate}
        onToggleTheme={onToggleTheme}
        routeState={routeState}
        theme={theme}
      />
    );
  }

  if (route.id === "analytics") {
    return <AnalyticsPage onNavigate={onNavigate} routeState={routeState} />;
  }

  if (route.id === "smart-storage-playground") {
    return (
      <SmartStoragePlayground
        onNavigateToHref={onNavigateToHref}
        routeMeta={<RouteMeta routeState={routeState} />}
      />
    );
  }

  if (route.id === "calendar") {
    return <CalendarPage onNavigate={onNavigate} routeState={routeState} />;
  }

  if (route.id === "notifications") {
    return <NotificationsPage onNavigate={onNavigate} routeState={routeState} />;
  }

  if (route.id === "profile") {
    return (
      <ProfilePage
        appAccess={appAccess}
        onNavigate={onNavigate}
        routeState={routeState}
      />
    );
  }

  if (route.id === "organization-settings") {
    return (
      <OrganizationSettingsPage
        appAccess={appAccess}
        onNavigate={onNavigate}
        routeState={routeState}
      />
    );
  }

  const hasNavigator = route.components.includes("knowledge-navigator");
  const hasWorkingLayout = route.components.length > 0;

  return (
    <main
      className={
        hasWorkingLayout
          ? "kb-main kb-scaffold-main kb-scaffold-main-working"
          : "kb-main kb-scaffold-main"
      }
      aria-labelledby="kb-route-heading"
    >
      {!hasWorkingLayout ? (
        <header className="kb-route-header">
          <div>
            <p className="kb-eyebrow">
              {route.id === "dashboard" ? "School Day" : "Context Page"}
            </p>
            <h1 id="kb-route-heading">
              {route.id === "dashboard" ? "Today at Arche Classical Academy" : route.label}
            </h1>
          </div>
          <RouteMeta routeState={routeState} />
        </header>
      ) : null}

      {hasNavigator && !hasWorkingLayout ? (
        <KnowledgeNavigator
          onNavigateToHref={onNavigateToHref}
          routeState={routeState}
        />
      ) : null}

      {route.id === "tag" && activeTags.length === 1 ? (
        <KnowledgeTypeOverview referent={activeTags[0]} />
      ) : null}

      {route.id === "dashboard" ? <TodayAgenda onNavigate={onNavigate} /> : null}

      {hasWorkingLayout ? (
        <ComponentScaffold
          activeTags={activeTags}
          components={route.components}
          label={route.label}
          routeId={route.id}
          onNavigateToHref={onNavigateToHref}
          routeState={routeState}
        />
      ) : (
        <PagePlaceholder route={route} />
      )}

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

function TodayAgenda({
  onNavigate,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const liveBibleContextSuggestions = useQuery(
    api.analytics.listDashboardBibleContextSuggestions,
    { limit: 4 },
  );
  const bibleContextSuggestions =
    liveBibleContextSuggestions && liveBibleContextSuggestions.length > 0
      ? liveBibleContextSuggestions
      : DASHBOARD_BIBLE_CONTEXT_FALLBACKS;

  return (
    <section className="kb-today-agenda" aria-labelledby="kb-today-agenda-heading">
      <header className="kb-today-agenda-header">
        <div>
          <p className="kb-eyebrow">Friday, June 12, 2026</p>
          <h2 id="kb-today-agenda-heading">Teaching and Ministry Queue</h2>
        </div>
        <span>{TODAY_AGENDA_ITEMS.length} items</span>
      </header>

      <DashboardBibleContexts
        onNavigate={onNavigate}
        suggestions={bibleContextSuggestions}
      />

      <ol className="kb-today-agenda-list">
        {TODAY_AGENDA_ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={item.contextHref}
              onClick={(event) => onNavigate(event, item.contextHref)}
            >
              <span className="kb-today-agenda-time">{item.timeLabel}</span>
              <span className="kb-today-agenda-icon" aria-hidden="true">
                <KnowledgeTypeIcon knowledgeType={item.knowledgeType} />
              </span>
              <span className="kb-today-agenda-content">
                <span className="kb-today-agenda-title-row">
                  <strong>{item.title}</strong>
                  <span>{item.statusLabel}</span>
                </span>
                <span className="kb-today-agenda-detail">{item.detail}</span>
                <span className="kb-today-agenda-meta">
                  <span>{item.groupLabel}</span>
                  <span>{item.contextLabel}</span>
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DashboardBibleContexts({
  onNavigate,
  suggestions,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  suggestions: DashboardBibleContextSuggestion[];
}) {
  return (
    <section
      className="kb-dashboard-bible-contexts"
      aria-labelledby="kb-dashboard-bible-contexts-heading"
    >
      <header>
        <div>
          <p className="kb-eyebrow">Bible Contexts</p>
          <h3 id="kb-dashboard-bible-contexts-heading">Popular or Open</h3>
        </div>
        <span>{suggestions.length} passages</span>
      </header>

      <ol>
        {suggestions.map((suggestion) => (
          <li key={suggestion.targetKey}>
            <a
              href={suggestion.href}
              onClick={(event) => onNavigate(event, suggestion.href)}
            >
              <BookOpen aria-hidden="true" />
              <span>
                <strong>{suggestion.label}</strong>
                <small>{getBibleContextSuggestionLabel(suggestion)}</small>
              </span>
              <em>{suggestion.trendScore}</em>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

function getBibleContextSuggestionLabel(
  suggestion: DashboardBibleContextSuggestion,
) {
  const requestCount =
    suggestion.openRequestCount + suggestion.overdueRequestCount;

  if (suggestion.trendKind === "popularAndNeedsContribution") {
    return `${formatCount(suggestion.recentVisitCount, "recent visit")} + ${formatCount(requestCount, "open request")}`;
  }

  if (suggestion.trendKind === "needsContribution") {
    return formatCount(requestCount, "open request");
  }

  if (suggestion.recentVisitCount > 0) {
    return formatCount(suggestion.recentVisitCount, "recent visit");
  }

  return formatCount(suggestion.totalVisitCount, "visit");
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function AnalyticsPage({
  onNavigate,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const summary = useQuery(api.analytics.getMvpSummary, {
    popularLimit: 6,
    recentLimit: 6,
  });
  const popularVisitCount =
    summary?.popularTargets.reduce(
      (totalVisits, target) => totalVisits + target.totalVisits,
      0,
    ) ?? 0;

  return (
    <main className="kb-main kb-analytics-main" aria-labelledby="kb-analytics-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">MVP Analytics</p>
          <h1 id="kb-analytics-heading">Analytics</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      {summary === undefined ? (
        <section className="kb-analytics-empty" role="status">
          <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          <span>Loading analytics</span>
        </section>
      ) : (
        <>
          <section className="kb-analytics-metrics" aria-label="Analytics snapshot">
            <article>
              <TrendingUp aria-hidden="true" />
              <span>Popular Visits</span>
              <strong>{popularVisitCount}</strong>
            </article>
            <article>
              <BookOpen aria-hidden="true" />
              <span>Tracked Targets</span>
              <strong>{summary.popularTargets.length}</strong>
            </article>
            <article>
              <MousePointerClick aria-hidden="true" />
              <span>Navigator Actions</span>
              <strong>{summary.navigatorUsage.length}</strong>
            </article>
          </section>

          <section className="kb-analytics-grid" aria-label="Analytics lists">
            <AnalyticsPanel title="Popular targets">
              {summary.popularTargets.length > 0 ? (
                <ol className="kb-analytics-list">
                  {summary.popularTargets.map((target) => (
                    <li key={`${target.targetKind}:${target.targetKey}`}>
                      <a href={target.href} onClick={(event) => onNavigate(event, target.href)}>
                        <span>{target.label}</span>
                        <small>{formatAnalyticsKindLabel(target.targetKind)}</small>
                      </a>
                      <strong>{target.totalVisits}</strong>
                      <time dateTime={new Date(target.lastVisitedAt).toISOString()}>
                        {formatAnalyticsTime(target.lastVisitedAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="kb-analytics-empty-copy">No page visits recorded yet.</p>
              )}
            </AnalyticsPanel>

            <AnalyticsPanel title="Recent visits">
              {summary.recentPageVisits.length > 0 ? (
                <ol className="kb-analytics-list">
                  {summary.recentPageVisits.map((visit) => (
                    <li key={visit.id}>
                      <a href={visit.href} onClick={(event) => onNavigate(event, visit.href)}>
                        <span>{visit.label}</span>
                        <small>{visit.rawPath}</small>
                      </a>
                      <strong>{formatAnalyticsKindLabel(visit.targetKind)}</strong>
                      <time dateTime={new Date(visit.visitedAt).toISOString()}>
                        {formatAnalyticsTime(visit.visitedAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="kb-analytics-empty-copy">No recent visits yet.</p>
              )}
            </AnalyticsPanel>

            <AnalyticsPanel title="Navigator usage">
              {summary.navigatorUsage.length > 0 ? (
                <ol className="kb-analytics-list kb-analytics-usage-list">
                  {summary.navigatorUsage.map((usage) => (
                    <li key={usage.id}>
                      <div>
                        <span>{formatNavigatorUsageKind(usage.usageKind)}</span>
                        <small>
                          {usage.activeTagCount} active Tags, {usage.resolvedTagCount} resolved
                        </small>
                      </div>
                      <strong>{usage.activeTagCount}</strong>
                      <time dateTime={new Date(usage.occurredAt).toISOString()}>
                        {formatAnalyticsTime(usage.occurredAt)}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="kb-analytics-empty-copy">No navigator actions yet.</p>
              )}
            </AnalyticsPanel>
          </section>
        </>
      )}
    </main>
  );
}

function AnalyticsPanel({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="kb-analytics-panel">
      <header>
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  );
}

function formatAnalyticsKindLabel(kind: string) {
  if (kind === "biblePassage") {
    return "Bible Passage";
  }

  if (kind === "dashboard") {
    return "Dashboard";
  }

  if (kind === "context") {
    return "Context Page";
  }

  return "Referent Page";
}

function formatNavigatorUsageKind(kind: string) {
  if (kind === "select") {
    return "Selected Tags";
  }

  if (kind === "deselect") {
    return "Deselected Tags";
  }

  if (kind === "contribute") {
    return "Contributed";
  }

  return "Explored";
}

function formatAnalyticsTime(timestamp: number) {
  return NOTIFICATION_TIME_FORMATTER.format(new Date(timestamp));
}

function OrganizationPage({
  appAccess,
  onNavigate,
  onNavigateToHref,
  pinnedKnowledgePages,
  routeState,
}: {
  appAccess: AllowedAppAccess;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeState: RouteState;
}) {
  const profile = getOrganizationPageProfile(
    routeState.pathname,
    appAccess.organizations,
  );
  const config = ORGANIZATION_PAGE_CONFIGS[profile.organizationKind];
  const firstModeId = config.modes[0]?.id ?? "";
  const [selectedModeId, setSelectedModeId] = useState(firstModeId);
  const selectedMode =
    config.modes.find((mode) => mode.id === selectedModeId) ?? config.modes[0];
  const activeTags = useMemo(
    () => [getOrganizationActiveTag(profile)],
    [profile.id, profile.name, profile.organizationKind],
  );
  const pinOrganizationPage = useMutation(api.pinnedKnowledgePages.pinOrganizationPage);
  const unpinKnowledgePage = useMutation(api.pinnedKnowledgePages.unpinKnowledgePage);
  const bookmarkOrganizationPage = useMutation(
    api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
  );
  const removeBookmark = useMutation(api.bookmarkedKnowledgePages.removeBookmark);
  const subscribeOrganizationPage = useMutation(
    api.knowledgeSubscriptions.subscribeOrganizationPage,
  );
  const unsubscribe = useMutation(api.knowledgeSubscriptions.unsubscribe);
  const [pendingPinAction, setPendingPinAction] = useState(false);
  const [pendingBookmarkAction, setPendingBookmarkAction] = useState(false);
  const [pendingSubscriptionAction, setPendingSubscriptionAction] = useState(false);
  const currentPageKey = profile.organizationReferentId
    ? getOrganizationPageKey(profile.organizationReferentId)
    : null;
  const currentBookmark = useQuery(
    api.bookmarkedKnowledgePages.getForPage,
    currentPageKey ? { pageKey: currentPageKey } : "skip",
  );
  const currentSubscription = useQuery(
    api.knowledgeSubscriptions.getForTarget,
    currentPageKey ? { subscriptionKey: currentPageKey } : "skip",
  );
  const currentPin = currentPageKey
    ? pinnedKnowledgePages.find((pin) => pin.pageKey === currentPageKey)
    : undefined;
  const isPinned = Boolean(currentPin);
  const isBookmarked = currentBookmark !== null && currentBookmark !== undefined;
  const isSubscribed =
    currentSubscription !== null && currentSubscription !== undefined;
  const canTogglePin = profile.organizationReferentId !== undefined;
  const canToggleBookmark =
    profile.organizationReferentId !== undefined && currentBookmark !== undefined;
  const canToggleSubscription =
    profile.organizationReferentId !== undefined &&
    currentSubscription !== undefined;
  const TypeIcon = config.icon;

  useEffect(() => {
    setSelectedModeId(firstModeId);
  }, [firstModeId, profile.id, profile.organizationKind]);

  async function handleToggleOrganizationPin() {
    if (!profile.organizationReferentId || !currentPageKey) {
      return;
    }

    setPendingPinAction(true);
    try {
      if (isPinned) {
        await unpinKnowledgePage({ pageKey: currentPageKey });
      } else {
        await pinOrganizationPage({
          organizationReferentId: profile.organizationReferentId,
        });
      }
    } finally {
      setPendingPinAction(false);
    }
  }

  async function handleToggleOrganizationBookmark() {
    if (!profile.organizationReferentId || !currentPageKey) {
      return;
    }

    setPendingBookmarkAction(true);
    try {
      if (isBookmarked) {
        await removeBookmark({ pageKey: currentPageKey });
      } else {
        await bookmarkOrganizationPage({
          organizationReferentId: profile.organizationReferentId,
        });
      }
    } finally {
      setPendingBookmarkAction(false);
    }
  }

  async function handleToggleOrganizationSubscription() {
    if (!profile.organizationReferentId || !currentPageKey) {
      return;
    }

    setPendingSubscriptionAction(true);
    try {
      if (isSubscribed) {
        await unsubscribe({ subscriptionKey: currentPageKey });
      } else {
        await subscribeOrganizationPage({
          organizationReferentId: profile.organizationReferentId,
        });
      }
    } finally {
      setPendingSubscriptionAction(false);
    }
  }

  return (
    <main
      className="kb-main kb-organization-main"
      aria-labelledby="kb-organization-heading"
    >
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">{config.pageLabel}</p>
          <h1 id="kb-organization-heading">{profile.name}</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section
        className="kb-organization-hero"
        data-org-kind={profile.organizationKind}
        aria-label={`${profile.name} overview`}
      >
        <div className="kb-organization-hero-main">
          <span className="kb-organization-mark" aria-hidden="true">
            <TypeIcon aria-hidden="true" />
          </span>
          <div>
            <p className="kb-eyebrow">{config.contextLabel}</p>
            <h2>{config.pageLabel}</h2>
            <p>{config.description}</p>
          </div>
          <dl className="kb-organization-facts" aria-label="Organization facts">
            <div>
              <dt>Type</dt>
              <dd>{formatOrganizationKind(profile.organizationKind)}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{formatMembershipRole(profile.role)}</dd>
            </div>
            <div>
              <dt>{config.detailLabel}</dt>
              <dd>{config.detailValue}</dd>
            </div>
          </dl>
          <div className="kb-organization-page-controls">
            {canTogglePin ? (
              <button
                aria-label={`${isPinned ? "Unpin" : "Pin"} ${profile.name}`}
                aria-pressed={isPinned}
                className="kb-organization-pin-toggle"
                disabled={pendingPinAction}
                onClick={() => void handleToggleOrganizationPin()}
                type="button"
              >
                {isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                <span>{isPinned ? "Unpin" : "Pin"}</span>
              </button>
            ) : null}
            {canToggleBookmark ? (
              <button
                aria-label={`${isBookmarked ? "Remove Bookmark" : "Bookmark"} ${profile.name}`}
                aria-pressed={isBookmarked}
                className="kb-organization-bookmark-toggle"
                disabled={pendingBookmarkAction}
                onClick={() => void handleToggleOrganizationBookmark()}
                type="button"
              >
                <Bookmark aria-hidden="true" />
                <span>{isBookmarked ? "Remove Bookmark" : "Bookmark"}</span>
              </button>
            ) : null}
            {canToggleSubscription ? (
              <button
                aria-label={`${isSubscribed ? "Unsubscribe" : "Subscribe"} ${profile.name}`}
                aria-pressed={isSubscribed}
                className="kb-organization-subscription-toggle"
                disabled={pendingSubscriptionAction}
                onClick={() => void handleToggleOrganizationSubscription()}
                type="button"
              >
                <Bell aria-hidden="true" />
                <span>{isSubscribed ? "Unsubscribe" : "Subscribe"}</span>
              </button>
            ) : null}
          </div>
        </div>

        <aside className="kb-organization-actions" aria-label="Primary actions">
          {config.actions.map((action) => {
            const ActionIcon = action.icon;
            const actionHref = getOrganizationActionHref(action, activeTags);

            return (
              <a
                href={actionHref}
                key={action.id}
                onClick={(event) => onNavigate(event, actionHref)}
              >
                <ActionIcon aria-hidden="true" />
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.detail}</small>
                </span>
              </a>
            );
          })}
        </aside>
      </section>

      <section className="kb-organization-metrics" aria-label={`${config.pageLabel} metrics`}>
        {config.metrics.map((metric) => {
          const MetricIcon = metric.icon;

          return (
            <article key={metric.id}>
              <MetricIcon aria-hidden="true" />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          );
        })}
      </section>

      <section className="kb-organization-layout" aria-label={`${config.pageLabel} work`}>
        <section className="kb-organization-panel" aria-labelledby="kb-organization-mode-heading">
          <header>
            <div>
              <p className="kb-eyebrow">Operating Mode</p>
              <h2 id="kb-organization-mode-heading">
                {selectedMode?.title ?? "Organization Work"}
              </h2>
            </div>
            <TypeIcon aria-hidden="true" />
          </header>

          <div className="kb-organization-mode-switch" role="group" aria-label="Organization mode">
            {config.modes.map((mode) => (
              <button
                aria-pressed={mode.id === selectedMode?.id}
                key={mode.id}
                onClick={() => setSelectedModeId(mode.id)}
                type="button"
              >
                {mode.label}
              </button>
            ))}
          </div>

          <ol className="kb-organization-focus-list">
            {(selectedMode?.items ?? []).map((item) => {
              const ItemIcon = item.icon;

              return (
                <li key={item.id}>
                  <a href={item.href} onClick={(event) => onNavigate(event, item.href)}>
                    <span className="kb-organization-focus-icon" aria-hidden="true">
                      <ItemIcon aria-hidden="true" />
                    </span>
                    <span className="kb-organization-focus-copy">
                      <span>
                        <strong>{item.title}</strong>
                        <em>{item.status}</em>
                      </span>
                      <small>{item.detail}</small>
                      <span>{item.meta}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="kb-organization-panel kb-organization-context" aria-labelledby="kb-organization-context-heading">
          <header>
            <div>
              <p className="kb-eyebrow">Knowledge Context</p>
              <h2 id="kb-organization-context-heading">{profile.name}</h2>
            </div>
            <Tag aria-hidden="true" />
          </header>
          <dl className="kb-organization-context-list">
            <div>
              <dt>Context tag</dt>
              <dd>{activeTags[0].label}</dd>
            </div>
            <div>
              <dt>Route</dt>
              <dd>{getOrganizationHomeHref(routeState.pathname)}</dd>
            </div>
            <div>
              <dt>Settings</dt>
              <dd>
                <a
                  href={getOrganizationSettingsHref(routeState.pathname)}
                  onClick={(event) =>
                    onNavigate(event, getOrganizationSettingsHref(routeState.pathname))
                  }
                >
                  Open settings
                </a>
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      <ComponentScaffold
        activeTags={activeTags}
        components={getRoute("organization-home").components}
        label={profile.name}
        onNavigateToHref={onNavigateToHref}
        routeId="organization-home"
        routeState={routeState}
        showHeading={false}
      />

      <OrganizationSubrouteLinks
        onNavigate={onNavigate}
        routeState={routeState}
      />
    </main>
  );
}

function getOrganizationPageProfile(
  pathname: string,
  organizations: AllowedAppAccess["organizations"],
): OrganizationPageProfile {
  const organizationId = getOrganizationId(pathname);
  const membership = findMatchingOrganizationMembership(organizationId, organizations);
  if (membership) {
    return {
      id: organizationId,
      name: membership.name,
      organizationKind: membership.organizationKind,
      organizationReferentId: membership.organizationReferentId,
      role: membership.role,
    };
  }

  const demoProfile =
    ORGANIZATION_DEMO_PROFILES[normalizeOrganizationLookupKey(organizationId)];
  if (demoProfile) {
    return demoProfile;
  }

  return {
    id: organizationId,
    name: labelFromRouteSlug(organizationId),
    organizationKind: guessOrganizationKind(organizationId),
    role: "preview",
  };
}

function findMatchingOrganizationMembership(
  organizationId: string,
  organizations: AllowedAppAccess["organizations"],
) {
  const lookupKey = normalizeOrganizationLookupKey(organizationId);

  return organizations.find((organization) => {
    return (
      organization.organizationReferentId === organizationId ||
      normalizeOrganizationLookupKey(organization.organizationReferentId) === lookupKey ||
      slugifyOrganizationId(organization.name) === lookupKey ||
      normalizeOrganizationLookupKey(organization.name) === lookupKey
    );
  });
}

function getOrganizationActiveTag(profile: OrganizationPageProfile): ActiveTag {
  const tagId = slugifyOrganizationId(profile.name || profile.id);

  return {
    canonicalKey: tagId,
    href: getOrganizationHomeHrefFromId(profile.id),
    id: tagId,
    knowledgeType: "organization",
    label: profile.name,
  };
}

function getOrganizationActionHref(
  action: OrganizationPageAction,
  activeTags: ActiveTag[],
) {
  if (action.guidedContributionType) {
    return getGuidedContributionHref(activeTags, action.guidedContributionType);
  }

  return action.href ?? "/";
}

function getGuidedContributionHref(
  activeTags: ActiveTag[],
  guidedContributionType: GuidedContributionType,
) {
  const tagIds = activeTags.map((tag) => encodeURIComponent(tag.id)).join(",");
  const baseHref = tagIds.length > 0 ? `/explore?tagIds=${tagIds}` : "/";
  const separator = baseHref.includes("?") ? "&" : "?";

  return `${baseHref}${separator}contributionType=${guidedContributionType}&guided=1`;
}

function guessOrganizationKind(organizationId: string): OrganizationKind {
  const lookupKey = normalizeOrganizationLookupKey(organizationId);
  if (lookupKey.includes("church") || lookupKey.includes("parish")) {
    return "church";
  }

  if (
    lookupKey.includes("school") ||
    lookupKey.includes("academy") ||
    lookupKey.includes("class")
  ) {
    return "school";
  }

  if (
    lookupKey.includes("family") ||
    lookupKey.includes("house") ||
    lookupKey.includes("home")
  ) {
    return "family";
  }

  return "community";
}

function normalizeOrganizationLookupKey(value: string) {
  return decodePathSegment(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugifyOrganizationId(value: string) {
  return normalizeOrganizationLookupKey(value) || "organization";
}

function getSidebarPinnedKnowledgePages(
  durablePins: DurableSidebarPinnedKnowledgePage[] | undefined,
  organizations: AllowedAppAccess["organizations"],
): SidebarPinnedKnowledgePage[] {
  if (durablePins === undefined) {
    return getSeededPinnedKnowledgePages(organizations);
  }

  return durablePins.map((pin) => ({
    ...pin,
    icon: ORGANIZATION_PAGE_CONFIGS[pin.organizationKind].icon,
  }));
}

function getSeededPinnedKnowledgePages(
  organizations: AllowedAppAccess["organizations"],
): SidebarPinnedKnowledgePage[] {
  const seenKinds = new Set<OrganizationKind>();
  const pinnedPages: SidebarPinnedKnowledgePage[] = [];

  for (const organization of organizations) {
    if (seenKinds.has(organization.organizationKind)) {
      continue;
    }

    seenKinds.add(organization.organizationKind);
    const config = ORGANIZATION_PAGE_CONFIGS[organization.organizationKind];

    pinnedPages.push({
      href: getOrganizationHomeHrefFromId(organization.organizationReferentId),
      icon: config.icon,
      id: organization.organizationReferentId,
      label: organization.name,
      organizationKind: organization.organizationKind,
      organizationName: organization.name,
      organizationReferentId: organization.organizationReferentId,
      pageKey: getOrganizationPageKey(organization.organizationReferentId),
      pinSource: "defaultSeed",
      secondaryLabel: formatOrganizationKind(organization.organizationKind),
      sortOrder: pinnedPages.length * 1000,
    });
  }

  return pinnedPages;
}

function isPinnedKnowledgePageActive(
  pin: SidebarPinnedKnowledgePage,
  activePageId: PageId,
  routeState: RouteState,
) {
  if (activePageId !== "organization-home" && activePageId !== "organization-settings") {
    return false;
  }

  const currentOrganizationId = getOrganizationId(routeState.pathname);
  const currentLookupKey = normalizeOrganizationLookupKey(currentOrganizationId);

  return (
    currentOrganizationId === pin.id ||
    currentLookupKey === normalizeOrganizationLookupKey(pin.id) ||
    currentLookupKey === slugifyOrganizationId(pin.organizationName)
  );
}

function getActiveRoleOptions(
  organizations: AllowedAppAccess["organizations"],
): ActiveRoleOption[] {
  if (organizations.length === 0) {
    return [
      {
        detail: "Personal",
        id: "personal",
        label: "Personal",
      },
    ];
  }

  return organizations.map((organization) => ({
    detail: organization.name,
    id: `${organization.organizationReferentId}:${organization.role}`,
    label: formatMembershipRole(organization.role),
  }));
}

function OrganizationSubrouteLinks({
  onNavigate,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const settingsHref = getOrganizationSettingsHref(routeState.pathname);

  return (
    <section className="kb-related-routes" aria-label="Organization subroutes">
      <p className="kb-eyebrow">Organization routes</p>
      <div>
        <a
          href={settingsHref}
          onClick={(event) => onNavigate(event, settingsHref)}
        >
          <Settings aria-hidden="true" />
          <span>Settings</span>
        </a>
      </div>
    </section>
  );
}

function ComponentScaffold({
  activeTags,
  components,
  label,
  onNavigateToHref,
  routeId,
  routeState,
  showHeading = true,
}: {
  activeTags: ActiveTag[];
  components: CoreComponentId[];
  label: string;
  onNavigateToHref: (href: string) => void;
  routeId: PageId;
  routeState: RouteState;
  showHeading?: boolean;
}) {
  const [selectedContributionKnowledgeType, setSelectedContributionKnowledgeType] =
    useState<AuthorableKnowledgeType | null>(null);
  const [selectedContributionSlotId, setSelectedContributionSlotId] =
    useState<string | null>(null);
  const [focusedCreatedEntry, setFocusedCreatedEntry] =
    useState<KnowledgeEntrySummary | null>(null);
  const [smartStorageProposalReview, setSmartStorageProposalReview] =
    useState<SmartStorageProposalReviewSummary | null>(null);
  const recordNavigatorUsage = useMutation(api.analytics.recordNavigatorUsage);
  const postDirectContribution = useMutation(
    api.directContributions.postDirectContribution,
  );
  const startSmartStorage = useMutation(api.smartStorage.startFromContribution);
  const generateSmartStorageProposal = useMutation(
    api.smartStorage.generateDraftProposalForRun,
  );
  const activeContextKey = getKnowledgeContextKey(activeTags);
  const routeContributionKnowledgeType =
    getRouteContributionKnowledgeType(routeState.search);
  const routeGuidedContributionType =
    getRouteGuidedContributionType(routeState.search);
  const activeSelectedContributionKnowledgeType = focusedCreatedEntry
    ? selectedContributionKnowledgeType
    : selectedContributionKnowledgeType ?? routeContributionKnowledgeType;
  const activeGuidedContributionType =
    focusedCreatedEntry || selectedContributionSlotId
      ? null
      : routeGuidedContributionType;
  const activeTagKeys = useMemo(
    () => getNavigatorAnalyticsTagKeys(activeTags),
    [activeTags],
  );
  const durableFeedItems = useQuery(api.answerFeed.listForActiveTagKeys, {
    activeTags,
  }) as AnswerFeedItem[] | undefined;
  const contextTrend = useQuery(
    api.analytics.getKnowledgeContextTrend,
    activeTagKeys.length > 0 ? { activeTagKeys } : "skip",
  );
  const fixtureFeedItems = useMemo(
    () => selectAnswerFeedItems(ANSWER_FEED_FIXTURE, activeTags),
    [activeTags],
  );
  const feedItems = durableFeedItems ?? fixtureFeedItems;
  const primarySlotItem = feedItems.find(isAnswerFeedSlot);
  const selectedSlotItem = selectedContributionSlotId
    ? feedItems.find(
        (item): item is AnswerFeedItem & { kind: "slot" } =>
          item.kind === "slot" && item.slot.id === selectedContributionSlotId,
      )
    : undefined;
  const primarySlot = primarySlotItem?.slot;
  const selectedSlot = selectedSlotItem?.slot;
  const contributionContext = selectedSlotItem
    ? getSlotContributionContext(selectedSlotItem, activeTags)
    : activeTags;

  useEffect(() => {
    setSelectedContributionSlotId(null);
    setSelectedContributionKnowledgeType(null);
    setFocusedCreatedEntry(null);
    setSmartStorageProposalReview(null);
  }, [activeContextKey]);

  async function handleSubmitContribution(
    input: ContributionInput,
  ): Promise<ContributionResult> {
    recordNavigatorUsageEvent("contribute", input.contextTags);
    const result = await postDirectContribution({
      body: input.body,
      contextTags: input.contextTags,
      knowledgeType: input.knowledgeType,
      ...(input.slotId === undefined ? {} : { slotId: input.slotId }),
      title: input.title,
    });

    setSmartStorageProposalReview(null);
    setFocusedCreatedEntry(result.entry);
    setSelectedContributionSlotId(null);
    setSelectedContributionKnowledgeType(null);

    return {
      entryId: result.entryId,
      status: "submitted",
    };
  }

  async function handleStoreSmartlyContribution(
    input: ContributionInput,
  ): Promise<ContributionResult> {
    recordNavigatorUsageEvent("contribute", input.contextTags);
    const result = await startSmartStorage({
      body: input.body,
      contextTags: input.contextTags,
      knowledgeType: input.knowledgeType,
      ...(input.slotId === undefined ? {} : { slotId: input.slotId }),
      title: input.title,
    });
    const proposalResult = await generateSmartStorageProposal({
      smartStorageRunId: result.smartStorageRunId,
    });

    setFocusedCreatedEntry(null);
    setSmartStorageProposalReview({
      currentProposal: proposalResult.currentProposal,
      id: proposalResult.smartStorageProposalId,
      smartStorageRunId: proposalResult.smartStorageRunId,
      sourceId: proposalResult.sourceId,
      status: proposalResult.status,
    });

    return {
      smartStorageProposalId: proposalResult.smartStorageProposalId,
      smartStorageRunId: result.smartStorageRunId,
      sourceId: result.sourceId,
      status: "submitted",
    };
  }

  function handleApplyMappedTags(mappedTags: ActiveTag[]) {
    recordNavigatorUsageEvent("explore", mappedTags);
    onNavigateToHref(getCanonicalKnowledgeContextHref(mappedTags));
  }

  function handleContributeToSlot(slot: KnowledgeSlotSummary) {
    setSelectedContributionSlotId(slot.id);
  }

  function recordNavigatorUsageEvent(
    usageKind: NavigatorUsageKind,
    tags: ActiveTag[],
  ) {
    void recordNavigatorUsage({
      activeTagKeys: getNavigatorAnalyticsTagKeys(tags),
      usageKind,
    }).catch(() => undefined);
  }

  return (
    <section className="kb-rail-focus-layout" aria-label={`${label} knowledge workspace`}>
      <aside className="kb-rail-focus-context" aria-label="Knowledge context and request">
        {components.includes("knowledge-navigator") ? (
          <KnowledgeNavigator
            activeTagsOverride={activeTags}
            onNavigateToHref={onNavigateToHref}
            routeState={routeState}
          >
            {components.includes("knowledge-request-composer") ? (
              <KnowledgeRequestComposer
                activeTags={activeTags}
                onApplyMappedTags={handleApplyMappedTags}
                onNavigateToHref={onNavigateToHref}
              />
            ) : null}
          </KnowledgeNavigator>
        ) : null}
        {components.includes("knowledge-slot-card") ? (
          <KnowledgeSlotRail
            onContributeToSlot={handleContributeToSlot}
            onNavigateToHref={onNavigateToHref}
            slot={primarySlot}
          />
        ) : null}
        {components.includes("knowledge-request-composer") &&
        !components.includes("knowledge-navigator") ? (
          <section
            className="kb-request-panel"
            aria-labelledby="kb-request-panel-heading"
          >
            <header>
              <p className="kb-eyebrow">Knowledge Request</p>
              <h2 id="kb-request-panel-heading">Search this Context</h2>
            </header>
            <KnowledgeRequestComposer
              activeTags={activeTags}
              onApplyMappedTags={handleApplyMappedTags}
              onNavigateToHref={onNavigateToHref}
            />
          </section>
        ) : null}
      </aside>

      <section className="kb-rail-focus-workspace" aria-label="Contribute and read Answers">
        {showHeading ? (
          <header className="kb-rail-focus-heading">
            <p className="kb-eyebrow">
              {routeId === "dashboard" ? "School Day" : "Context Page"}
            </p>
            <h1 id="kb-route-heading">
              {routeId === "dashboard"
                ? "Today at Arche Classical Academy"
                : getWorkspaceHeading(label, activeTags)}
            </h1>
          </header>
        ) : null}
        {components.includes("contribution-editor") ? (
          <ContributionEditorSurface
            context={contributionContext}
            guidedContributionType={activeGuidedContributionType}
            onKnowledgeTypeChange={setSelectedContributionKnowledgeType}
            onNavigateToHref={onNavigateToHref}
            onPostDirect={handleSubmitContribution}
            onStoreSmartly={handleStoreSmartlyContribution}
            selectedKnowledgeType={activeSelectedContributionKnowledgeType}
            slot={selectedSlot}
          />
        ) : null}
        {smartStorageProposalReview ? (
          <SmartStorageProposalReviewPanel
            onNavigateToHref={onNavigateToHref}
            proposal={smartStorageProposalReview}
          />
        ) : null}
        {focusedCreatedEntry ? (
          <CreatedEntryFocusPanel entry={focusedCreatedEntry} />
        ) : null}
        {components.includes("answer-feed") ? (
          <AnswerFeedSurface
            activeTags={activeTags}
            contextTrend={getVisibleContextTrend(contextTrend)}
            filterByActiveTags={false}
            items={feedItems}
            layout="masonry"
            onContributeToSlot={handleContributeToSlot}
            onNavigateToHref={onNavigateToHref}
          />
        ) : null}
      </section>
    </section>
  );
}

function getSlotContributionContext(
  slotItem: AnswerFeedItem & { kind: "slot" },
  activeTags: ActiveTag[],
) {
  if (hasFixtureContextTagIds(slotItem)) {
    return getFixtureContextTags(slotItem.contextTagIds);
  }

  return activeTags;
}

function hasFixtureContextTagIds(
  item: AnswerFeedItem,
): item is AnswerFeedItem & { contextTagIds: string[] } {
  return (
    "contextTagIds" in item &&
    Array.isArray((item as { contextTagIds?: unknown }).contextTagIds)
  );
}

function SmartStorageProposalReviewPanel({
  onNavigateToHref,
  proposal,
}: {
  onNavigateToHref: (href: string) => void;
  proposal: SmartStorageProposalReviewSummary;
}) {
  const currentProposal = proposal.currentProposal;

  function handleTagClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    onNavigateToHref(href);
  }

  return (
    <section
      aria-label="Smart Storage Proposal"
      className="kb-smart-proposal-review"
      role="status"
    >
      <header>
        <div>
          <p className="kb-eyebrow">Smart Storage Proposal</p>
          <h2>{currentProposal.title}</h2>
        </div>
        <span className="kb-smart-proposal-type">
          <KnowledgeTypeIcon knowledgeType={currentProposal.knowledgeType} />
          <span>{formatKnowledgeTypeLabel(currentProposal.knowledgeType)}</span>
        </span>
      </header>

      <p className="kb-smart-proposal-body">
        {currentProposal.bodyPreview}
      </p>

      <dl className="kb-smart-proposal-meta">
        <div>
          <dt>Proposal Confidence</dt>
          <dd>{formatProposalConfidence(currentProposal.proposalConfidence)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>Draft Proposal</dd>
        </div>
      </dl>

      {currentProposal.contextTags.length > 0 ? (
        <ul
          aria-label="Smart Storage Proposal context Tags"
          className="kb-smart-proposal-tags"
        >
          {currentProposal.contextTags.map((tag) => (
            <li key={tag.id}>
              <a
                href={tag.href}
                onClick={(event) => handleTagClick(event, tag.href)}
              >
                <KnowledgeTypeIcon knowledgeType={tag.knowledgeType} />
                <span>{tag.label}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatProposalConfidence(
  proposalConfidence: SmartStorageProposalReviewSummary["currentProposal"]["proposalConfidence"],
) {
  return proposalConfidence.charAt(0).toUpperCase() + proposalConfidence.slice(1);
}

function CreatedEntryFocusPanel({ entry }: { entry: KnowledgeEntrySummary }) {
  return (
    <section
      className="kb-created-entry-focus"
      aria-label="Created Knowledge Entry"
      role="status"
    >
      <div>
        <p className="kb-eyebrow">Editing Knowledge Entry</p>
        <h2>{entry.title}</h2>
        <p>
          New {formatKnowledgeTypeLabel(entry.knowledgeType)} entry in focus for
          immediate edits.
        </p>
      </div>
      <a className="kb-created-entry-focus-action" href={entry.href}>
        Edit Entry
      </a>
    </section>
  );
}

function getRouteContributionKnowledgeType(
  search: string,
): AuthorableKnowledgeType | null {
  const contributionType = new URLSearchParams(search).get("contributionType");

  return isAuthorableKnowledgeType(contributionType) ? contributionType : null;
}

function getRouteGuidedContributionType(
  search: string,
): GuidedContributionType | null {
  const params = new URLSearchParams(search);
  if (params.get("guided") !== "1") {
    return null;
  }

  return params.get("contributionType") === "group" ? "group" : null;
}

function getWorkspaceHeading(label: string, activeTags: ActiveTag[]) {
  if (activeTags.length > 0) {
    return activeTags.map((tag) => tag.label).join(", ");
  }

  return label;
}

function getVisibleContextTrend(
  contextTrend: KnowledgeContextTrendSummary | undefined,
) {
  if (!contextTrend || contextTrend.trendKind === "quiet") {
    return undefined;
  }

  return contextTrend;
}

function KnowledgeSlotRail({
  onContributeToSlot,
  onNavigateToHref,
  slot,
}: {
  onContributeToSlot: (slot: KnowledgeSlotSummary) => void;
  onNavigateToHref: (href: string) => void;
  slot?: KnowledgeSlotSummary;
}) {
  if (slot) {
    return (
      <KnowledgeSlotCard
        onContribute={onContributeToSlot}
        onNavigateToHref={onNavigateToHref}
        slot={slot}
      />
    );
  }

  return (
    <PlaceholderBlock code="C6" title="Requested Entry">
      <p className="kb-rail-empty">No requested entries in this Knowledge Context.</p>
    </PlaceholderBlock>
  );
}

function ProfilePage({
  appAccess,
  onNavigate,
  routeState,
}: {
  appAccess: AllowedAppAccess;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const route = getRoute("profile");
  const email = appAccess.email ?? "No email on file";
  const displayName = getProfileDisplayName(appAccess.email);
  const organizationCount = appAccess.organizations.length;
  const membershipRoles = getUniqueMembershipRoles(appAccess.organizations);
  const primaryOrganization = appAccess.organizations[0];
  const bookmarkedKnowledgePages = useQuery(
    api.bookmarkedKnowledgePages.listForProfile,
    {},
  );
  const removeBookmark = useMutation(api.bookmarkedKnowledgePages.removeBookmark);
  const bookmarksSectionRef = useRef<HTMLElement | null>(null);
  const [pendingBookmarkRemoval, setPendingBookmarkRemoval] = useState<string | null>(null);

  useEffect(() => {
    const section = new URLSearchParams(routeState.search).get("section");
    if (section !== "bookmarks") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      bookmarksSectionRef.current?.scrollIntoView?.({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [routeState.search]);

  async function handleRemoveBookmark(pageKey: string) {
    setPendingBookmarkRemoval(pageKey);
    try {
      await removeBookmark({ pageKey });
    } finally {
      setPendingBookmarkRemoval(null);
    }
  }

  return (
    <main className="kb-main kb-profile-main" aria-labelledby="kb-profile-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Account</p>
          <h1 id="kb-profile-heading">Profile</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-profile-summary" aria-label="Profile summary">
        <div>
          <UserCircle aria-hidden="true" />
          <span>Signed in as</span>
          <strong>{displayName}</strong>
        </div>
        <div>
          <Landmark aria-hidden="true" />
          <span>Organizations</span>
          <strong>
            {organizationCount} {organizationCount === 1 ? "membership" : "memberships"}
          </strong>
        </div>
        <div>
          <Users aria-hidden="true" />
          <span>Primary role</span>
          <strong>{membershipRoles[0] ?? "Member"}</strong>
        </div>
      </section>

      <section className="kb-profile-layout" aria-label="User profile">
        <section className="kb-profile-panel kb-profile-identity" aria-labelledby="kb-profile-card-heading">
          <div className="kb-profile-identity-main">
            <img
              className="kb-profile-photo"
              src={profilePlaceholderUrl}
              alt=""
              aria-hidden="true"
            />
            <div>
              <p className="kb-eyebrow">Current user</p>
              <h2 id="kb-profile-card-heading">{displayName}</h2>
              <p>{email}</p>
            </div>
          </div>

          <dl className="kb-profile-detail-list">
            <div>
              <dt>User ID</dt>
              <dd>{appAccess.userId}</dd>
            </div>
            <div>
              <dt>Primary organization</dt>
              <dd>{primaryOrganization?.name ?? "None"}</dd>
            </div>
            <div>
              <dt>Roles</dt>
              <dd>{membershipRoles.join(", ") || "Member"}</dd>
            </div>
          </dl>
        </section>

        <aside className="kb-profile-panel kb-profile-session" aria-labelledby="kb-profile-session-heading">
          <header>
            <UserCircle aria-hidden="true" />
            <div>
              <p className="kb-eyebrow">Session</p>
              <h2 id="kb-profile-session-heading">Account</h2>
            </div>
          </header>
          <dl className="kb-profile-session-list">
            <div>
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>Access</dt>
              <dd>Organization member</dd>
            </div>
          </dl>
          <SignOutButton />
        </aside>
      </section>

      <section className="kb-profile-panel kb-profile-organizations" aria-labelledby="kb-profile-organizations-heading">
        <header>
          <div>
            <p className="kb-eyebrow">Memberships</p>
            <h2 id="kb-profile-organizations-heading">Organizations</h2>
          </div>
          <span>{organizationCount} active</span>
        </header>

        {organizationCount > 0 ? (
          <ul className="kb-profile-organization-list">
            {appAccess.organizations.map((organization) => {
              const organizationHref = getOrganizationHomeHrefFromId(
                organization.organizationReferentId,
              );

              return (
                <li key={organization.organizationReferentId}>
                  <a
                    href={organizationHref}
                    onClick={(event) => onNavigate(event, organizationHref)}
                  >
                    <Landmark aria-hidden="true" />
                    <span>{organization.name}</span>
                  </a>
                  <dl>
                    <div>
                      <dt>Kind</dt>
                      <dd>{formatOrganizationKind(organization.organizationKind)}</dd>
                    </div>
                    <div>
                      <dt>Role</dt>
                      <dd>{formatMembershipRole(organization.role)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="kb-profile-empty">No active organization memberships.</p>
        )}
      </section>

      <section
        ref={bookmarksSectionRef}
        className="kb-profile-panel kb-profile-bookmarks"
        id="bookmarks"
        aria-label="Profile Bookmarks"
        aria-labelledby="kb-profile-bookmarks-heading"
      >
        <header>
          <div>
            <p className="kb-eyebrow">Saved Knowledge Pages</p>
            <h2 id="kb-profile-bookmarks-heading">Bookmarks</h2>
          </div>
          <Bookmark aria-hidden="true" />
        </header>
        {bookmarkedKnowledgePages === undefined ? (
          <p className="kb-profile-empty">Loading bookmarks.</p>
        ) : bookmarkedKnowledgePages.length > 0 ? (
          <ul className="kb-profile-bookmark-list">
            {bookmarkedKnowledgePages.map((bookmark: ProfileBookmarkedKnowledgePage) => {
              const BookmarkIcon = ORGANIZATION_PAGE_CONFIGS[bookmark.organizationKind].icon;

              return (
                <li key={bookmark.pageKey}>
                  <a
                    href={bookmark.href}
                    onClick={(event) => onNavigate(event, bookmark.href)}
                  >
                    <BookmarkIcon aria-hidden="true" />
                    <span>
                      <strong>{bookmark.label}</strong>
                      <small>
                        {bookmark.secondaryLabel} Knowledge Page
                      </small>
                    </span>
                  </a>
                  <button
                    aria-label={`Remove bookmark ${bookmark.label}`}
                    className="kb-profile-bookmark-remove"
                    disabled={pendingBookmarkRemoval === bookmark.pageKey}
                    onClick={() => void handleRemoveBookmark(bookmark.pageKey)}
                    type="button"
                  >
                    <X aria-hidden="true" />
                    <span>Remove</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="kb-profile-empty">No bookmarked Knowledge Pages yet.</p>
        )}
      </section>

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

function SettingsPage({
  appAccess,
  onNavigate,
  onToggleTheme,
  routeState,
  theme,
}: {
  appAccess: AllowedAppAccess;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onToggleTheme: () => void;
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const route = getRoute("settings");
  const email = appAccess.email ?? "No email on file";
  const organizationCount = appAccess.organizations.length;
  const nextTheme = theme === "dark" ? "light" : "dark";
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <main className="kb-main kb-settings-main" aria-labelledby="kb-settings-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Account</p>
          <h1 id="kb-settings-heading">User Settings</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-settings-summary" aria-label="Settings summary">
        <div>
          <UserCircle aria-hidden="true" />
          <span>Signed in as</span>
          <strong>{email}</strong>
        </div>
        <div>
          <Users aria-hidden="true" />
          <span>Organizations</span>
          <strong>
            {organizationCount} {organizationCount === 1 ? "membership" : "memberships"}
          </strong>
        </div>
        <div>
          <ThemeIcon aria-hidden="true" />
          <span>Theme</span>
          <strong>{theme === "dark" ? "Dark" : "Light"}</strong>
        </div>
      </section>

      <section className="kb-settings-layout" aria-label="User settings">
        <section className="kb-settings-panel" aria-labelledby="kb-settings-account-heading">
          <header>
            <UserCircle aria-hidden="true" />
            <div>
              <p className="kb-eyebrow">Identity</p>
              <h2 id="kb-settings-account-heading">Account</h2>
            </div>
          </header>
          <dl className="kb-settings-list">
            <div>
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt>User ID</dt>
              <dd>{appAccess.userId}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Active</dd>
            </div>
          </dl>
        </section>

        <section className="kb-settings-panel" aria-labelledby="kb-settings-appearance-heading">
          <header>
            <Settings aria-hidden="true" />
            <div>
              <p className="kb-eyebrow">Preferences</p>
              <h2 id="kb-settings-appearance-heading">Appearance</h2>
            </div>
          </header>
          <button
            aria-checked={theme === "dark"}
            aria-label={`Use ${nextTheme} theme`}
            className="kb-settings-switch"
            onClick={onToggleTheme}
            role="switch"
            type="button"
          >
            <span aria-hidden="true" />
            <span>Dark mode</span>
            <strong>{theme === "dark" ? "On" : "Off"}</strong>
          </button>
        </section>
      </section>

      <section className="kb-settings-panel kb-settings-organizations" aria-labelledby="kb-settings-organizations-heading">
        <header>
          <Landmark aria-hidden="true" />
          <div>
            <p className="kb-eyebrow">Workspace</p>
            <h2 id="kb-settings-organizations-heading">Organizations</h2>
          </div>
        </header>

        {organizationCount > 0 ? (
          <ul className="kb-settings-org-list">
            {appAccess.organizations.map((organization) => {
              const organizationHref = getOrganizationHomeHrefFromId(
                organization.organizationReferentId,
              );

              return (
                <li key={organization.organizationReferentId}>
                  <a
                    href={organizationHref}
                    onClick={(event) => onNavigate(event, organizationHref)}
                  >
                    <Landmark aria-hidden="true" />
                    <span>{organization.name}</span>
                  </a>
                  <dl>
                    <div>
                      <dt>Kind</dt>
                      <dd>{formatOrganizationKind(organization.organizationKind)}</dd>
                    </div>
                    <div>
                      <dt>Role</dt>
                      <dd>{formatMembershipRole(organization.role)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="kb-settings-empty">No active organization memberships.</p>
        )}
      </section>

      <section className="kb-settings-panel kb-settings-session" aria-labelledby="kb-settings-session-heading">
        <header>
          <Bell aria-hidden="true" />
          <div>
            <p className="kb-eyebrow">Session</p>
            <h2 id="kb-settings-session-heading">Account Actions</h2>
          </div>
        </header>
        <div className="kb-settings-action-row">
          <a
            href="/notifications"
            onClick={(event) => onNavigate(event, "/notifications")}
          >
            <Bell aria-hidden="true" />
            <span>Notifications</span>
          </a>
          <SignOutButton />
        </div>
      </section>

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

function formatOrganizationKind(kind: string) {
  return kind
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMembershipRole(role: string) {
  return formatOrganizationKind(role);
}

function getProfileDisplayName(email?: string) {
  if (!email) {
    return "Current User";
  }

  const localPart = email.split("@")[0] ?? "";
  const parts = localPart
    .split(/[._+-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return email;
  }

  return parts.map(formatProfileNamePart).join(" ");
}

function getUniqueMembershipRoles(
  organizations: AllowedAppAccess["organizations"],
) {
  return Array.from(
    new Set(organizations.map((organization) => formatMembershipRole(organization.role))),
  );
}

function formatProfileNamePart(part: string) {
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function NotificationsPage({
  onNavigate,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const route = getRoute("notifications");
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [pendingSubscriptionRemoval, setPendingSubscriptionRemoval] = useState<string | null>(null);
  const [pendingNotificationStatusId, setPendingNotificationStatusId] =
    useState<Id<"userNotifications"> | null>(null);
  const notificationInbox = useQuery(
    api.userNotifications.listForInbox,
    {},
  ) as UserNotificationInbox | undefined;
  const subscriptionSources = useQuery(
    api.knowledgeSubscriptions.listForNotifications,
    {},
  );
  const unsubscribe = useMutation(api.knowledgeSubscriptions.unsubscribe);
  const markRead = useMutation(api.userNotifications.markRead);
  const markUnread = useMutation(api.userNotifications.markUnread);
  const notificationSummary = notificationInbox?.summary;
  const filteredNotifications =
    notificationInbox?.notifications.filter((notification) =>
      notificationMatchesFilter(notification, activeFilter),
    ) ?? [];
  const unreadCount = getNotificationFilterCount("unread", notificationSummary);
  const slotCount = getNotificationFilterCount("knowledgeSlots", notificationSummary);
  const eventCount = getNotificationFilterCount("events", notificationSummary);
  const latestNotificationLabel =
    notificationSummary?.latestReceivedAt === undefined
      ? "No notifications"
      : formatNotificationTime(notificationSummary.latestReceivedAt);

  async function handleUnsubscribe(subscriptionKey: string) {
    setPendingSubscriptionRemoval(subscriptionKey);
    try {
      await unsubscribe({ subscriptionKey });
    } finally {
      setPendingSubscriptionRemoval(null);
    }
  }

  async function handleMarkRead(notificationId: Id<"userNotifications">) {
    setPendingNotificationStatusId(notificationId);
    try {
      await markRead({ notificationId });
    } finally {
      setPendingNotificationStatusId(null);
    }
  }

  async function handleMarkUnread(notificationId: Id<"userNotifications">) {
    setPendingNotificationStatusId(notificationId);
    try {
      await markUnread({ notificationId });
    } finally {
      setPendingNotificationStatusId(null);
    }
  }

  return (
    <main className="kb-main kb-notifications-main" aria-labelledby="kb-notifications-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">User Notifications</p>
          <h1 id="kb-notifications-heading">Notifications</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-notification-summary" aria-label="Notification summary">
        <div>
          <Bell aria-hidden="true" />
          <span>Unread</span>
          <strong>{formatCountLabel(unreadCount, "unread")}</strong>
        </div>
        <div>
          <Clock aria-hidden="true" />
          <span>Latest</span>
          <strong>{latestNotificationLabel}</strong>
        </div>
        <div>
          <CalendarDays aria-hidden="true" />
          <span>Events</span>
          <strong>{formatCountLabel(eventCount, "event notice")}</strong>
        </div>
        <div>
          <Users aria-hidden="true" />
          <span>Open Requests</span>
          <strong>{formatCountLabel(slotCount, "open item")}</strong>
        </div>
      </section>

      <section
        className="kb-subscription-sources-panel"
        aria-label="Subscription Sources"
        aria-labelledby="kb-subscription-sources-heading"
      >
        <header>
          <div>
            <p className="kb-eyebrow">Notification Readiness</p>
            <h2 id="kb-subscription-sources-heading">Subscription Sources</h2>
          </div>
          <Bell aria-hidden="true" />
        </header>
        {subscriptionSources === undefined ? (
          <p className="kb-subscription-source-empty">Loading subscription sources.</p>
        ) : subscriptionSources.length > 0 ? (
          <ul className="kb-subscription-source-list">
            {subscriptionSources.map((subscription: NotificationSubscriptionSource) => {
              const SubscriptionIcon =
                ORGANIZATION_PAGE_CONFIGS[subscription.organizationKind].icon;

              return (
                <li key={subscription.subscriptionKey}>
                  <a
                    href={subscription.href}
                    onClick={(event) => onNavigate(event, subscription.href)}
                  >
                    <SubscriptionIcon aria-hidden="true" />
                    <span>
                      <strong>{subscription.label}</strong>
                      <small>
                        {subscription.secondaryLabel} Knowledge Page
                      </small>
                    </span>
                  </a>
                  <button
                    aria-label={`Unsubscribe from ${subscription.label}`}
                    disabled={
                      pendingSubscriptionRemoval === subscription.subscriptionKey
                    }
                    onClick={() =>
                      void handleUnsubscribe(subscription.subscriptionKey)
                    }
                    type="button"
                  >
                    <X aria-hidden="true" />
                    <span>Unsubscribe</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="kb-subscription-source-empty">No active subscription sources.</p>
        )}
      </section>

      <section className="kb-notification-panel" aria-labelledby="kb-notification-feed-heading">
        <header>
          <div>
            <p className="kb-eyebrow">Notification Feed</p>
            <h2 id="kb-notification-feed-heading">
              {getNotificationFilterHeading(activeFilter)}
            </h2>
          </div>
          <div
            aria-label="Notification filters"
            className="kb-notification-filters"
            role="tablist"
          >
            {NOTIFICATION_FILTERS.map((filter) => (
              <button
                aria-label={filter.label}
                aria-selected={activeFilter === filter.id}
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                role="tab"
                type="button"
              >
                <span>{filter.label}</span>
                <strong>{getNotificationFilterCount(filter.id, notificationSummary)}</strong>
              </button>
            ))}
          </div>
        </header>

        {notificationInbox === undefined ? (
          <section className="kb-notification-empty" role="status">
            <h3>Loading Notifications.</h3>
            <p>Checking your durable inbox.</p>
          </section>
        ) : filteredNotifications.length > 0 ? (
          <ol className="kb-notification-list">
            {filteredNotifications.map((notification) => (
              <li data-notification-status={notification.status} key={notification.id}>
                <article className="kb-notification-card">
                  <span className="kb-notification-mark" aria-hidden="true">
                    <Bell />
                  </span>
                  <div className="kb-notification-content">
                    <header>
                      <div>
                        <p className="kb-card-eyebrow">
                          {NOTIFICATION_KIND_LABELS[notification.kind]}
                        </p>
                        <h3>
                          <a
                            href={notification.contextHref}
                            onClick={(event) =>
                              onNavigate(event, notification.contextHref)
                            }
                          >
                            {notification.title}
                          </a>
                        </h3>
                      </div>
                      <span>{notification.status === "unread" ? "Unread" : "Read"}</span>
                    </header>
                    <p>{notification.body}</p>
                    <footer>
                      <span>{notification.contextLabel}</span>
                      <time dateTime={new Date(notification.receivedAt).toISOString()}>
                        {formatNotificationTime(notification.receivedAt)}
                      </time>
                      <div className="kb-notification-actions">
                        {notification.status === "unread" ? (
                          <button
                            aria-label={`Mark ${notification.title} read`}
                            className="kb-card-action kb-notification-status-action"
                            disabled={pendingNotificationStatusId === notification.id}
                            onClick={() => void handleMarkRead(notification.id)}
                            type="button"
                          >
                            <Check aria-hidden="true" />
                            <span>Mark read</span>
                          </button>
                        ) : (
                          <button
                            aria-label={`Mark ${notification.title} unread`}
                            className="kb-card-action kb-notification-status-action"
                            disabled={pendingNotificationStatusId === notification.id}
                            onClick={() => void handleMarkUnread(notification.id)}
                            type="button"
                          >
                            <Bell aria-hidden="true" />
                            <span>Mark unread</span>
                          </button>
                        )}
                        <a
                          className="kb-card-action"
                          href={notification.contextHref}
                          onClick={(event) => onNavigate(event, notification.contextHref)}
                        >
                          <BookOpen aria-hidden="true" />
                          Open
                        </a>
                      </div>
                    </footer>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <section className="kb-notification-empty" role="status">
            <h3>No Notifications match this view.</h3>
            <p>Subscribed Knowledge Contexts, requests, and Events are quiet.</p>
          </section>
        )}
      </section>

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

function notificationMatchesFilter(
  notification: UserNotification,
  filter: NotificationFilter,
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "unread") {
    return notification.status === "unread";
  }

  if (filter === "knowledgeSlots") {
    return notification.kind === "knowledgeSlot";
  }

  return notification.kind === "event";
}

function getNotificationFilterCount(
  filter: NotificationFilter,
  summary: UserNotificationSummary | undefined,
) {
  if (!summary) {
    return 0;
  }

  if (filter === "all") {
    return summary.allCount;
  }

  if (filter === "unread") {
    return summary.unreadCount;
  }

  if (filter === "knowledgeSlots") {
    return summary.knowledgeSlotCount;
  }

  return summary.eventCount;
}

function getNotificationFilterHeading(filter: NotificationFilter) {
  if (filter === "unread") {
    return "Unread Notifications";
  }

  if (filter === "knowledgeSlots") {
    return "Request Notifications";
  }

  if (filter === "events") {
    return "Event Notifications";
  }

  return "All Notifications";
}

function formatNotificationTime(timestamp: number) {
  return NOTIFICATION_TIME_FORMATTER.format(new Date(timestamp));
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function OrganizationSettingsPage({
  appAccess,
  onNavigate,
  routeState,
}: {
  appAccess: AllowedAppAccess;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const profile = getOrganizationPageProfile(
    routeState.pathname,
    appAccess.organizations,
  );
  const organizationId = getOrganizationId(routeState.pathname);
  const organizationHomeHref = getOrganizationHomeHref(routeState.pathname);

  return (
    <main
      className="kb-main kb-org-settings-main"
      aria-labelledby="kb-org-settings-heading"
    >
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Organization</p>
          <h1 id="kb-org-settings-heading">Organization Settings</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-org-settings-layout" aria-label="Organization settings">
        <section
          className="kb-org-settings-panel"
          aria-labelledby="kb-org-settings-profile-heading"
        >
          <header>
            <div>
              <p className="kb-eyebrow">Profile</p>
              <h2 id="kb-org-settings-profile-heading">{profile.name}</h2>
            </div>
            <Settings aria-hidden="true" />
          </header>

          <dl className="kb-org-settings-list">
            <div>
              <dt>Organization ID</dt>
              <dd>{organizationId}</dd>
            </div>
            <div>
              <dt>Organization Type</dt>
              <dd>{formatOrganizationKind(profile.organizationKind)}</dd>
            </div>
            <div>
              <dt>Access Policy</dt>
              <dd>Members only</dd>
            </div>
            <div>
              <dt>Your Role</dt>
              <dd>{formatMembershipRole(profile.role)}</dd>
            </div>
          </dl>
        </section>

        <aside
          className="kb-org-settings-panel kb-org-settings-rail"
          aria-labelledby="kb-org-settings-nav-heading"
        >
          <header>
            <div>
              <p className="kb-eyebrow">Routes</p>
              <h2 id="kb-org-settings-nav-heading">Organization</h2>
            </div>
            <Landmark aria-hidden="true" />
          </header>
          <a
            href={organizationHomeHref}
            onClick={(event) => onNavigate(event, organizationHomeHref)}
          >
            <Landmark aria-hidden="true" />
            <span>Organization Home</span>
          </a>
        </aside>
      </section>
    </main>
  );
}

function CalendarPage({
  onNavigate,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const route = getRoute("calendar");
  const confirmedEventCount = CALENDAR_EVENTS.filter(
    (event) => event.status === "confirmed",
  ).length;
  const nextEvent = CALENDAR_EVENTS.find((event) => event.day >= CALENDAR_TODAY)
    ?? CALENDAR_EVENTS[0];
  const calendarCells = getCalendarMonthCells();

  return (
    <main className="kb-main kb-calendar-main" aria-labelledby="kb-calendar-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Schedule</p>
          <h1 id="kb-calendar-heading">Calendar</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-calendar-summary" aria-label="Calendar summary">
        <div>
          <CalendarDays aria-hidden="true" />
          <span>{CALENDAR_MONTH_LABEL}</span>
          <strong>{CALENDAR_EVENTS.length} scheduled items</strong>
        </div>
        <div>
          <Clock aria-hidden="true" />
          <span>Next up</span>
          <strong>{formatCalendarDay(nextEvent.day)}, {nextEvent.timeLabel}</strong>
        </div>
        <div>
          <Users aria-hidden="true" />
          <span>Confirmed</span>
          <strong>{confirmedEventCount} ready</strong>
        </div>
      </section>

      <section className="kb-calendar-layout" aria-label={`${CALENDAR_MONTH_LABEL} calendar`}>
        <section className="kb-calendar-month" aria-labelledby="kb-calendar-month-heading">
          <header>
            <div>
              <p className="kb-eyebrow">Month View</p>
              <h2 id="kb-calendar-month-heading">{CALENDAR_MONTH_LABEL}</h2>
            </div>
            <span>{CALENDAR_EVENTS.length} items</span>
          </header>

          <div className="kb-calendar-weekdays" aria-hidden="true">
            {CALENDAR_WEEKDAYS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="kb-calendar-grid" role="grid" aria-label={CALENDAR_MONTH_LABEL}>
            {calendarCells.map((day, index) => {
              const events = day ? getCalendarEventsForDay(day) : [];

              return (
                <div
                  aria-label={day ? formatCalendarDay(day) : "Empty calendar day"}
                  className={day ? "kb-calendar-day" : "kb-calendar-day kb-calendar-day-empty"}
                  data-today={day === CALENDAR_TODAY ? "true" : undefined}
                  key={`${day ?? "empty"}-${index}`}
                  role="gridcell"
                >
                  {day ? (
                    <>
                      <span className="kb-calendar-day-number">{day}</span>
                      <div className="kb-calendar-day-events">
                        {events.map((event) => (
                          <a
                            className="kb-calendar-event-pill"
                            data-status={event.status}
                            href={event.contextHref}
                            key={event.id}
                            onClick={(mouseEvent) => onNavigate(mouseEvent, event.contextHref)}
                          >
                            <span>{event.title}</span>
                          </a>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="kb-calendar-agenda" aria-labelledby="kb-calendar-agenda-heading">
          <header>
            <p className="kb-eyebrow">Agenda</p>
            <h2 id="kb-calendar-agenda-heading">Upcoming Work</h2>
          </header>

          <ol>
            {CALENDAR_EVENTS.map((event) => (
              <li key={event.id}>
                <a
                  href={event.contextHref}
                  onClick={(mouseEvent) => onNavigate(mouseEvent, event.contextHref)}
                >
                  <span>{formatCalendarDay(event.day)}</span>
                  <strong>{event.title}</strong>
                </a>
                <dl>
                  <div>
                    <dt>
                      <Clock aria-hidden="true" />
                      <span>Time</span>
                    </dt>
                    <dd>{event.timeLabel}</dd>
                  </div>
                  <div>
                    <dt>
                      <MapPin aria-hidden="true" />
                      <span>Place</span>
                    </dt>
                    <dd>{event.locationLabel}</dd>
                  </div>
                  <div>
                    <dt>
                      <Users aria-hidden="true" />
                      <span>Group</span>
                    </dt>
                    <dd>{event.groupLabel}</dd>
                  </div>
                </dl>
                <p>
                  <span>{event.status === "confirmed" ? "Confirmed" : "Draft"}</span>
                  <span>{event.contextLabel}</span>
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

function getCalendarMonthCells() {
  return [
    ...Array.from({ length: CALENDAR_START_WEEKDAY_INDEX }, () => null),
    ...Array.from({ length: CALENDAR_DAY_COUNT }, (_, index) => index + 1),
  ];
}

function getCalendarEventsForDay(day: number) {
  return CALENDAR_EVENTS.filter((event) => event.day === day);
}

function formatCalendarDay(day: number) {
  return `June ${day}`;
}

function getOrganizationSettingsHref(pathname: string) {
  return `/organizations/${encodeURIComponent(getOrganizationId(pathname))}/settings`;
}

function getOrganizationHomeHref(pathname: string) {
  return getOrganizationHomeHrefFromId(getOrganizationId(pathname));
}

function getOrganizationHomeHrefFromId(organizationId: string) {
  return `/organizations/${encodeURIComponent(organizationId)}`;
}

function getOrganizationPageKey(organizationReferentId: Id<"referents">) {
  return `organization:${organizationReferentId}`;
}

function getOrganizationId(pathname: string) {
  const match = /^\/(?:organizations|orgs)\/([^/]+)/.exec(pathname);
  if (!match) {
    return SAMPLE_ORG_ID;
  }

  return decodePathSegment(match[1]);
}

function labelFromRouteSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || slug;
}

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function BiblePassagePage({
  onNavigateToHref,
  routeState,
}: {
  onNavigateToHref: (href: string) => void;
  routeState: RouteState;
}) {
  const passageString = getScripturePassageString(routeState.pathname);
  const activeTags = getActiveTagsFromRoute(routeState);
  const passage = useQuery(
    api.scripture.getPassage,
    passageString ? { passageString } : "skip",
  );

  if (!passageString) {
    return (
      <main className="kb-main kb-scripture-main" aria-labelledby="kb-scripture-heading">
        <header className="kb-route-header">
          <div>
            <p className="kb-eyebrow">Bible Passage Referent Page</p>
            <h1 id="kb-scripture-heading">Scripture</h1>
          </div>
          <RouteMeta routeState={routeState} />
        </header>
        <section className="kb-scripture-empty" role="status">
          Add a passage after `/scripture/`.
        </section>
      </main>
    );
  }

  if (passage === undefined) {
    return (
      <main
        aria-busy="true"
        aria-labelledby="kb-scripture-heading"
        className="kb-main kb-scripture-main"
      >
        <header className="kb-route-header">
          <div>
            <p className="kb-eyebrow">Bible Passage Referent Page</p>
            <h1 id="kb-scripture-heading">Opening Scripture</h1>
          </div>
          <RouteMeta routeState={routeState} />
        </header>
        <section className="kb-scripture-empty" role="status">
          <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          <span>Loading passage</span>
        </section>
      </main>
    );
  }

  if (passage.status === "invalid") {
    return (
      <main className="kb-main kb-scripture-main" aria-labelledby="kb-scripture-heading">
        <header className="kb-route-header">
          <div>
            <p className="kb-eyebrow">Bible Passage Referent Page</p>
            <h1 id="kb-scripture-heading">Scripture</h1>
          </div>
          <RouteMeta routeState={routeState} />
        </header>
        <section className="kb-scripture-empty" role="alert">
          {passage.message}
        </section>
      </main>
    );
  }

  if (passage.status === "missingStructure") {
    return (
      <main className="kb-main kb-scripture-main" aria-labelledby="kb-scripture-heading">
        <header className="kb-route-header">
          <div>
            <p className="kb-eyebrow">Bible Passage Referent Page</p>
            <h1 id="kb-scripture-heading">{passage.label}</h1>
          </div>
          <RouteMeta routeState={routeState} />
        </header>
        <KnowledgeNavigator
          onNavigateToHref={onNavigateToHref}
          routeState={routeState}
        />
        {activeTags[0] ? <KnowledgeTypeOverview referent={activeTags[0]} /> : null}
        <section className="kb-scripture-empty" role="status">
          {passage.message}
        </section>
      </main>
    );
  }

  const translationLabel = passage.translation
    ? `${passage.translation.name} (${passage.translation.code})`
    : "No translation selected";

  return (
    <main className="kb-main kb-scripture-main" aria-labelledby="kb-scripture-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Bible Passage Referent Page</p>
          <h1 id="kb-scripture-heading">{passage.label}</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      {activeTags[0] ? <KnowledgeTypeOverview referent={activeTags[0]} /> : null}

      <section className="kb-scripture-panel" aria-label={`${passage.label} passage text`}>
        <header>
          <div>
            <p className="kb-eyebrow">Scripture Text</p>
            <h2>{translationLabel}</h2>
          </div>
          <span>{passage.canonicalKey}</span>
        </header>

        {!passage.hasText ? (
          <div className="kb-scripture-empty" role="status">
            {passage.translation
              ? `Verse text for ${passage.translation.code} is not available yet.`
              : "No Bible translation metadata is available yet."}
          </div>
        ) : (
          <div className="kb-verse-list">
            {passage.verses.map((verse) => (
              <p className="kb-verse-row" key={verse.ordinal}>
                <span className="kb-verse-ref">{formatVerseReference(verse)}</span>
                <span>{verse.text ?? "Text unavailable"}</span>
              </p>
            ))}
          </div>
        )}

        {passage.isTruncated ? (
          <p className="kb-scripture-note" role="status">
            Showing the first 300 verses.
          </p>
        ) : null}
      </section>

      <ComponentScaffold
        activeTags={activeTags}
        components={getRoute("scripture").components}
        label={passage.label}
        onNavigateToHref={onNavigateToHref}
        routeId="scripture"
        routeState={routeState}
        showHeading={false}
      />
    </main>
  );
}

function getScripturePassageString(pathname: string) {
  if (!pathname.startsWith("/scripture/")) {
    return "";
  }

  try {
    return decodeURIComponent(pathname.slice("/scripture/".length));
  } catch {
    return pathname.slice("/scripture/".length);
  }
}

function getPassageSuggestions(query: string, limit: number) {
  const suggestionLimit = Math.max(
    0,
    Math.min(Math.floor(limit), MAX_PASSAGE_SUGGESTIONS),
  );
  if (!query || suggestionLimit < 1) {
    return [];
  }

  const parsedPassage = parseBiblePassageReference(query);
  if (!parsedPassage) {
    return [];
  }

  return [
    {
      href: `/scripture/${parsedPassage.slug}`,
      kind: "biblePassage",
      label: parsedPassage.label,
      passageString: parsedPassage.slug,
    },
  ].slice(0, suggestionLimit);
}

function formatVerseReference(verse: {
  bookShortName: string;
  chapterNumber: number;
  verseNumber: number;
}) {
  return `${verse.bookShortName} ${verse.chapterNumber}:${verse.verseNumber}`;
}

function RouteMeta({ routeState }: { routeState: RouteState }) {
  return (
    <dl className="kb-route-meta" aria-label="Current URL">
      <div>
        <dt>Path</dt>
        <dd>{routeState.pathname}</dd>
      </div>
      <div>
        <dt>Query</dt>
        <dd>{routeState.search || "none"}</dd>
      </div>
    </dl>
  );
}

function KnowledgeNavigator({
  activeTagsOverride,
  children,
  onNavigateToHref,
  routeState,
}: {
  activeTagsOverride?: ActiveTag[];
  children?: ReactNode;
  onNavigateToHref: (href: string) => void;
  routeState: RouteState;
}) {
  const routeActiveTags = useMemo(
    () => getActiveTagsFromRoute(routeState),
    [routeState.pathname, routeState.search],
  );
  const activeTags = activeTagsOverride ?? routeActiveTags;
  const inactiveTags = useMemo(
    () => getInactiveNavigatorTags(activeTags),
    [activeTags],
  );
  const recordNavigatorUsage = useMutation(api.analytics.recordNavigatorUsage);
  const contextKey = getKnowledgeContextKey(activeTags);

  function navigateToTags(nextTags: ActiveTag[]) {
    onNavigateToHref(getCanonicalKnowledgeContextHref(nextTags));
  }

  function handleAddTag(tag: ActiveTag) {
    const nextTags = addActiveTag(activeTags, tag);
    recordNavigatorUsageEvent("select", nextTags);
    navigateToTags(nextTags);
  }

  function handleRemoveTag(tagId: string) {
    const nextTags = removeActiveTag(activeTags, tagId);
    recordNavigatorUsageEvent("deselect", nextTags);
    navigateToTags(nextTags);
  }

  function recordNavigatorUsageEvent(
    usageKind: NavigatorUsageKind,
    tags: ActiveTag[],
  ) {
    void recordNavigatorUsage({
      activeTagKeys: getNavigatorAnalyticsTagKeys(tags),
      usageKind,
    }).catch(() => undefined);
  }

  return (
    <section className="kb-knowledge-navigator" aria-labelledby="kb-knowledge-navigator-heading">
      <header>
        <div>
          <p className="kb-eyebrow">Knowledge Navigator</p>
          <h2 id="kb-knowledge-navigator-heading">Active Knowledge Context</h2>
        </div>
      </header>
      <div className="kb-navigator-panel">
        <div className="kb-active-tag-list" aria-label="Active Tags">
          {activeTags.length > 0 ? (
            activeTags.map((tag) => (
              <button
                aria-label={`Remove ${tag.label}`}
                className="kb-active-tag-chip"
                key={tag.id}
                onClick={() => handleRemoveTag(tag.id)}
                title={`Remove ${tag.label}`}
                type="button"
              >
                <KnowledgeTypeIcon knowledgeType={tag.knowledgeType} />
                <span>{tag.label}</span>
                <X aria-hidden="true" />
              </button>
            ))
          ) : (
            <p className="kb-navigator-empty">Global Knowledge Context</p>
          )}
        </div>

        {children ? <div className="kb-navigator-request">{children}</div> : null}

        <div className="kb-add-tag-list" aria-label="Available Tags">
          {inactiveTags.map((tag) => (
            <button
              aria-label={`Add ${tag.label}`}
              className="kb-add-tag-button"
              key={tag.id}
              onClick={() => handleAddTag(tag)}
              title={`Add ${tag.label}`}
              type="button"
            >
              <KnowledgeTypeIcon knowledgeType={tag.knowledgeType} />
              <span>{tag.label}</span>
            </button>
          ))}
        </div>

        <span aria-live="polite" className="kb-sr-only">
          {contextKey}
        </span>
      </div>
    </section>
  );
}

function PagePlaceholder({ route }: { route: RouteDefinition }) {
  const Icon = route.icon;

  return (
    <section className="kb-page-placeholder" aria-label={`${route.label} placeholder`}>
      <Icon aria-hidden="true" />
      <span>{route.label}</span>
    </section>
  );
}

function RelatedRoutes({
  onNavigate,
  relatedRouteIds,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  relatedRouteIds: PageId[];
}) {
  return (
    <section className="kb-related-routes" aria-label="Related route placeholders">
      <p className="kb-eyebrow">Related routes</p>
      <div>
        {relatedRouteIds.map((pageId) => {
          const route = getRoute(pageId);
          const Icon = route.icon;

          return (
            <a
              href={route.href}
              key={route.id}
              onClick={(event) => onNavigate(event, route.href)}
            >
              <Icon aria-hidden="true" />
              <span>{route.label}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function PlaceholderBlock({
  children,
  code,
  title,
  variant = "default",
}: {
  children?: ReactNode;
  code: string;
  title: string;
  variant?: "default" | "primary";
}) {
  return (
    <section className="kb-placeholder-block" data-variant={variant}>
      <header>
        <span>{code}</span>
        <h2>{title}</h2>
      </header>
      {children ? <div className="kb-placeholder-body">{children}</div> : null}
    </section>
  );
}

function BrandMark() {
  return (
    <img className="kb-brand-logo" src={archePressIconUrl} alt="" aria-hidden="true" />
  );
}
