import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ElementType,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  type ReactNode,
  type UIEvent,
} from "react";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { flushSync } from "react-dom";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bookmark,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Check,
  Clock,
  Compass,
  Database,
  ExternalLink,
  FlaskConical,
  ImagePlus,
  Landmark,
  LayoutDashboard,
  ListTodo,
  LoaderCircle,
  MapPin,
  MailCheck,
  Moon,
  MousePointerClick,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Tag,
  TrendingUp,
  UserCircle,
  UserMinus,
  UserPlus,
  Users,
  UploadCloud,
  X,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { AuthPanel, SignOutButton } from "./auth/AuthPanel";
import {
  formatClaimResult,
  OrganizationAccessRequestScreen,
  type ClaimResultSummary,
} from "./auth/OrganizationAccessRequest";
import profilePlaceholderUrl from "./assets/profile-placeholder.png";
import {
  AnswerFeed as AnswerFeedSurface,
  type QuoteAttributionCorrectionInput,
  type QuoteAttributionPersonSearchInput,
} from "./AnswerFeed";
import {
  ContributionEditor as ContributionEditorSurface,
  type ContributionEditorDraftInput,
} from "./ContributionEditor";
import {
  KnowledgeNavigatorQueryInput,
  type KnowledgeNavigatorQuerySuggestion,
} from "./KnowledgeRequestComposer";
import { Presence } from "./Presence";
import {
  RootSearchResults,
  type RootSearchResult,
} from "./RootSearchResults";
import {
  getNavigatorAnalyticsTagKeys,
  getPageVisitAnalyticsInput,
  type NavigatorUsageKind,
} from "./analytics";
import { KnowledgeSlotCard, ReviewSlotCard } from "./components/KnowledgeCards";
import { KnowledgeTypeBadge, KnowledgeTypeIcon } from "./components/KnowledgeTypeIcon";
import { KnowledgeTypeOverview } from "./components/KnowledgeTypeOverview";
import { LogeionBrand } from "./components/LogeionBrand";
import { ReferentTagVisual } from "./components/ReferentTagLink";
import { SmartStoragePlayground } from "./SmartStoragePlayground";
import {
  getFixtureContextTags,
  isAnswerFeedSlot,
} from "./answerFeedData";
import {
  addActiveTag,
  getActiveTagsFromRoute,
  getCanonicalKnowledgeContextHref,
  getInactiveNavigatorTags,
  getKnowledgeContextKey,
  getRootSearchTagSuggestions,
  removeActiveTag,
  type RootSearchTagSuggestion,
} from "./knowledgeContext";
import type { ActiveTag } from "./knowledgeContext";
import type {
  AnswerFeedItem,
  AuthorableKnowledgeType,
  ContributionInput,
  ContributionResult,
  DraftLinkPreviewResult,
  GuidedContributionType,
  HumanWeightFeedbackInput,
  KnowledgeContextExpert,
  KnowledgeContextExpertDetail,
  KnowledgeContextExpertScope,
  KnowledgeEntrySummary,
  KnowledgeContextTrendKind,
  KnowledgeContextTrendSummary,
  KnowledgeType,
  QuoteAttributionPersonOption,
  KnowledgeSlotSummary,
  RepresentationRole,
  SmartStorageProposalReviewSummary,
  SmartStorageProposalSourceCitationSummary,
  SmartStorageReviewSlotSummary,
  SmartStorageRepresentationDecision,
  SmartStorageSessionProposalSummary,
  SmartStorageSessionSummary,
  SmartStorageUploadedFileInput,
} from "./knowledgeContracts";
import {
  formatKnowledgeTypeLabel,
  isAuthorableKnowledgeType,
  REPRESENTATION_ROLE_OPTIONS,
  supportsRepresentativeThumbnail,
} from "./knowledgeContracts";
import { DashboardHierarchyPrototype } from "./prototypes/DashboardHierarchyPrototype";
import { HeaderSidebarPrototype } from "./prototypes/HeaderSidebarPrototype";
import { LayoutPrototype } from "./prototypes/LayoutPrototype";
import { SmartStorageWorkflowPrototype } from "./prototypes/SmartStorageWorkflowPrototype";

// React composition root: shared domain logic stays in plain TypeScript modules,
// while this file wires Convex subscriptions, route state, and page UI together.
const THEME_STORAGE_KEY = "knowledgebase-theme";
const TOPBAR_SCROLL_TOLERANCE = 8;

const SAMPLE_TAG_ID = "first-crusade";
const SAMPLE_ORG_ID = "arche-classical-academy";
const SAMPLE_CONTEXT_TAG_IDS = "first-crusade,matthew-5-9";
const SAMPLE_SCRIPTURE_PASSAGE = "joshua-1-6-9";
const ROOT_SEARCH_SUGGESTION_LIMIT = 5;
const DEFAULT_CONTEXT_EXPERTISE_OPERATION_BATCH_SIZE = 25;
const MAX_CONTEXT_EXPERTISE_OPERATION_BATCH_SIZE = 100;
const CONTEXT_EXPERTISE_OPERATION_SAMPLE_LIMIT = 5;

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
type OrganizationMembershipRole = "admin" | "member";
type SystemRole = "systemAdmin";

type SmartStorageRunReviewSummary = {
  contributionSubmissionId?: string;
  errorMessage?: string;
  rawModelOutput?: string;
  rawModelRequest?: string;
  smartStorageRunId: string;
  sourceId?: string;
  sourceIds: string[];
  status: "failed" | "noProposal";
};

type PageId =
  | "dashboard"
  | "root-search"
  | "scripture"
  | "tag"
  | "explore-context"
  | "organization-home"
  | "organization-settings"
  | "smart-storage-playground"
  | "smart-storage-workflow-prototype"
  | "layout-prototype"
  | "header-sidebar-prototype"
  | "dashboard-hierarchy-prototype"
  | "analytics"
  | "profile"
  | "settings"
  | "system-admin"
  | "todo-list"
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
  allowedContributionTypes?: readonly AuthorableKnowledgeType[];
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
    organizationDetailId?: Id<"organizationReferentDetails">;
    organizationEntryId?: Id<"organizationEntries">;
    organizationKind: OrganizationKind;
    organizationReferentId: Id<"referents">;
    role: string;
  }>;
  status: "allowed";
  systemRole?: SystemRole;
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

type NotificationKind =
  | "access"
  | "announcement"
  | "answer"
  | "event"
  | "knowledgeSlot"
  | "subscription";

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

type ContactIdentityStatus = "pending" | "verified";

type ContactIdentitySummary = {
  email: string;
  id: Id<"contactIdentities">;
  verificationStatus: ContactIdentityStatus;
  verifiedAt?: number;
};

type ContactIdentitySettings = {
  contactIdentities: ContactIdentitySummary[];
  primaryEmail?: string;
  primaryEmailVerified: boolean;
};

type ContextExpertiseVisibilitySettings = {
  globalExpertVisibilityEnabled: boolean;
};

type PersonGlobalExpertVisibilityModeration = {
  moderationNote?: string;
  personLabel: string;
  personReferentId: string;
  status: "visibleByDefault" | "suppressed";
  updatedAt?: number;
  updatedByUserId?: string;
};

type PersonGlobalExpertVisibilityModerationEvent = {
  action: "suppressed" | "restored" | "suppressionNoteUpdated";
  createdAt: number;
  eventId: string;
  moderationNote?: string;
  nextStatus: "visibleByDefault" | "suppressed";
  personReferentId: string;
  previousModerationNote?: string;
  previousStatus: "visibleByDefault" | "suppressed";
  updatedByUserId: string;
};

type ContextExpertiseOperationPagination = {
  cursor: string | null;
  numItems: number;
};

type ContextExpertiseMigrationGroup = {
  aggregateId?: Id<"contextExpertiseAggregates">;
  audienceScopeKind: "private" | "organization" | "group" | "public";
  audienceScopeTargetKey: string;
  contextKey: string;
  evidenceCount?: number;
  skippedReason?: "noEffectiveEvidence" | "noEvidence" | "noValidEntries";
  subjectKind: "user" | "person";
  subjectPersonReferentId?: Id<"referents">;
  subjectUserId?: Id<"users">;
};

type ScopedAggregateMigrationStatus = {
  aggregateSampleLimit: number;
  continueCursor: string;
  evidenceGroupCount: number;
  isDone: boolean;
  legacyAggregateSampleCount: number;
  mayHaveMoreEvidence: boolean;
  missingScopedAggregateGroupCount: number;
  missingScopedAggregateGroups: ContextExpertiseMigrationGroup[];
  sampledAggregateCount: number;
  sampledEvidenceCount: number;
  scopedAggregateSampleCount: number;
};

type ScopedAggregateMigrationBatchResult = {
  continueCursor: string;
  dryRun: boolean;
  groupCount: number;
  groups: ContextExpertiseMigrationGroup[];
  isDone: boolean;
  processedEvidenceCount: number;
  rebuiltGroupCount: number;
  skippedGroupCount: number;
};

type QuoteAttributionBackfillSkippedReason =
  | "noQuotedPerson"
  | "missingEntry"
  | "invalidQuotedPerson"
  | "notQuote"
  | "noContextTags";

type QuoteAttributionBackfillSkippedItem = {
  entryId?: Id<"knowledgeEntries">;
  quoteEntryId: Id<"quoteEntries">;
  skippedReason: QuoteAttributionBackfillSkippedReason;
  subjectPersonReferentId?: Id<"referents">;
};

type QuoteAttributionBackfillEvidenceItem = {
  action: "existing" | "missing" | "wouldCreate" | "created";
  contextKey: string;
  entryId: Id<"knowledgeEntries">;
  evidenceId?: Id<"contextExpertiseEvidence">;
  quoteEntryId: Id<"quoteEntries">;
  subjectPersonReferentId: Id<"referents">;
};

type QuoteAttributionBackfillStatus = {
  attributedQuoteRowCount: number;
  continueCursor: string;
  eligibleQuoteRowCount: number;
  existingEvidenceCount: number;
  isDone: boolean;
  mayHaveMoreQuoteRows: boolean;
  missingEvidenceCount: number;
  missingEvidenceItems: QuoteAttributionBackfillEvidenceItem[];
  processedQuoteRowCount: number;
  skippedQuoteRowCount: number;
  skippedQuoteRowItems: QuoteAttributionBackfillSkippedItem[];
};

type QuoteAttributionBackfillBatchResult = {
  attributedQuoteRowCount: number;
  continueCursor: string;
  createdEvidenceCount: number;
  dryRun: boolean;
  eligibleQuoteRowCount: number;
  evidenceItems: QuoteAttributionBackfillEvidenceItem[];
  existingEvidenceCount: number;
  isDone: boolean;
  mayHaveMoreQuoteRows: boolean;
  missingEvidenceCount: number;
  processedQuoteRowCount: number;
  skippedQuoteRowCount: number;
  skippedQuoteRowItems: QuoteAttributionBackfillSkippedItem[];
  wouldCreateEvidenceCount: number;
};

type SelectedContextExpertSubject =
  | {
      subjectKind: "user";
      subjectUserId: Id<"users">;
    }
  | {
      subjectKind: "person";
      subjectPersonReferentId: Id<"referents">;
    };

type QuoteAttributionPersonSearchState = {
  entryId: string;
  searchQuery: string;
};

function getSelectedContextExpertSubject(
  expert: KnowledgeContextExpert,
): SelectedContextExpertSubject {
  if (
    expert.subjectKind === "person" &&
    expert.subjectPersonReferentId !== undefined
  ) {
    return {
      subjectKind: "person",
      subjectPersonReferentId:
        expert.subjectPersonReferentId as Id<"referents">,
    };
  }

  return {
    subjectKind: "user",
    subjectUserId: (expert.subjectUserId ?? expert.id) as Id<"users">,
  };
}

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

type KnowledgePageRelationshipKind =
  | "organization"
  | "dashboard"
  | "scripture"
  | "referent"
  | "context"
  | "search";

type KnowledgePageActionTarget = {
  href: string;
  label: string;
  organizationReferentId?: Id<"referents">;
  pageKey: string;
  pageKind: KnowledgePageRelationshipKind;
  secondaryLabel: string;
};

type SidebarPinnedKnowledgePage = {
  href: string;
  icon: ElementType<{ "aria-hidden"?: "true"; className?: string }>;
  id: string;
  label: string;
  organizationKind?: OrganizationKind;
  organizationName?: string;
  organizationReferentId?: Id<"referents">;
  pageKind: KnowledgePageRelationshipKind;
  pageKey: string;
  pinSource: "defaultSeed" | "manual";
  secondaryLabel: string;
  sortOrder: number;
  thumbnailUrl?: string;
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
  organizationKind?: OrganizationKind;
  organizationName?: string;
  organizationReferentId?: Id<"referents">;
  pageKind: KnowledgePageRelationshipKind;
  pageKey: string;
  secondaryLabel: string;
  updatedAt: number;
};

type KnowledgePageThumbnailState = {
  entryId: string;
  entryTitle: string;
  thumbnailUrl?: string;
} | null;

type ReferentPageMetadataFact = {
  label: string;
  value: string;
};

type ReferentPageMetadataRelationItem = {
  detail?: string;
  href: string;
  id: string;
  knowledgeType: AuthorableKnowledgeType | "biblePassage";
  label: string;
  thumbnailUrl?: string;
};

type ReferentPageMetadataSection = {
  items: ReferentPageMetadataRelationItem[];
  title: string;
};

type ReferentPageMetadata = {
  canonicalKey: string;
  description?: string;
  detailKind: "literature" | "person" | "generic";
  facts: ReferentPageMetadataFact[];
  href: string;
  id: string;
  knowledgeType: AuthorableKnowledgeType | "biblePassage";
  label: string;
  sections: ReferentPageMetadataSection[];
  sourceName?: string;
  sourceUrl?: string;
  tags: ActiveTag[];
  thumbnailUrl?: string;
} | null;

type ProfileContextExpertise = {
  profileUserId: Id<"users">;
  rows: ProfileContextExpertiseRow[];
};

type ProfileContextExpertiseRow = {
  aggregateId: Id<"contextExpertiseAggregates">;
  contextKey: string;
  contextTags: ActiveTag[];
  contextExpertiseMaturity: number;
  contextExpertiseScore: number;
  evidenceCount: number;
  feedbackCount: number;
  latestEvidenceAt: number;
  postCount: number;
  visibilityKind: "private" | "organization" | "group" | "public";
  visibilityTargetKey: string;
};

type NotificationSubscriptionSource = {
  createdAt: number;
  href: string;
  id: string;
  label: string;
  organizationKind?: OrganizationKind;
  organizationName?: string;
  organizationReferentId?: Id<"referents">;
  secondaryLabel: string;
  subscriptionKey: string;
  targetKind: KnowledgePageRelationshipKind;
  targetReferentId?: Id<"referents">;
  updatedAt: number;
};

type ActiveRoleOption = {
  detail: string;
  id: string;
  label: string;
};

type OrganizationAccountSetupResult = {
  canonicalKey: string;
  href: string;
  name: string;
  organizationDetailId?: Id<"organizationReferentDetails">;
  organizationEntryId?: Id<"organizationEntries">;
  organizationKind: OrganizationKind;
  organizationReferentId: Id<"referents">;
};

type MembershipClaimEvidence = {
  claimedAt: number;
  claimedContactKind: "email";
  claimedContactValue: string;
  claimSource: "verifiedContactIdentity" | "verifiedPrimaryEmail";
  personConsolidation?: {
    approvedAt: number;
    pendingPersonName: string;
    pendingPersonReferentId: Id<"referents">;
    resultingPersonName: string;
    resultingPersonReferentId: Id<"referents">;
    reviewId: Id<"personConsolidationReviews">;
  };
};
type PersonConsolidationReviewEvidence = {
  claimedContactKind: "email";
  claimedContactValue: string;
  claimSource: "verifiedContactIdentity" | "verifiedPrimaryEmail";
  requestedAt: number;
  requestedByEmail?: string;
  reviewId: Id<"personConsolidationReviews">;
  reviewReason: "placeholderHasMeaningfulIdentity";
  reviewStatus: "approved" | "pending" | "rejected";
  updatedAt: number;
};
type OrganizationMember = {
  claimEvidence?: MembershipClaimEvidence;
  email?: string;
  membershipId: Id<"memberships">;
  name: string;
  personConsolidationReview?: PersonConsolidationReviewEvidence;
  role: OrganizationMembershipRole;
  status: "active" | "pending";
  userId?: Id<"users">;
};

type OrganizationMembershipSettings = {
  members: OrganizationMember[];
  name: string;
  organizationDetailId?: Id<"organizationReferentDetails">;
  organizationEntryId?: Id<"organizationEntries">;
  organizationKind: OrganizationKind;
  organizationReferentId: Id<"referents">;
};

// Route metadata is declarative so navigation, shells, analytics, and
// contribution placement all derive from one typed registry.
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
    id: "root-search",
    label: "Search Everything",
    href: "/search",
    pattern: "/search?q=",
    icon: Search,
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
    id: "smart-storage-workflow-prototype",
    label: "Smart Storage Workflow Prototype",
    href: "/playground/prototypes/smart-storage-workflow",
    pattern: "/playground/prototypes/smart-storage-workflow?variant=",
    icon: Database,
    components: [],
    relatedRouteIds: ["smart-storage-playground", "layout-prototype"],
  },
  {
    id: "layout-prototype",
    label: "Layout Prototype",
    href: "/playground/prototypes/layout",
    pattern: "/playground/prototypes/layout?variant=",
    icon: LayoutDashboard,
    components: [],
    relatedRouteIds: ["smart-storage-playground", "header-sidebar-prototype"],
  },
  {
    id: "header-sidebar-prototype",
    label: "Header Sidebar Prototype",
    href: "/playground/prototypes/header-sidebar",
    pattern: "/playground/prototypes/header-sidebar?variant=",
    icon: Shield,
    components: [],
    relatedRouteIds: ["smart-storage-playground", "layout-prototype"],
  },
  {
    id: "dashboard-hierarchy-prototype",
    label: "Dashboard Hierarchy Prototype",
    href: "/playground/prototypes/dashboard-hierarchy",
    pattern: "/?prototype=dashboard-hierarchy&variant=",
    icon: LayoutDashboard,
    components: [],
    relatedRouteIds: ["header-sidebar-prototype", "layout-prototype"],
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
    id: "system-admin",
    label: "System Admin",
    href: "/system-admin",
    pattern: "/system-admin",
    icon: Landmark,
    components: [],
    relatedRouteIds: ["settings", "profile"],
  },
  {
    id: "todo-list",
    label: "TODO List",
    href: "/todo",
    pattern: "/todo",
    icon: ListTodo,
    components: [],
    relatedRouteIds: ["calendar", "notifications", "profile"],
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
const USER_ROUTE_IDS: PageId[] = ["calendar", "notifications", "todo-list"];
const SYSTEM_ADMIN_ROUTE_IDS: PageId[] = ["system-admin"];
const DEV_SYSTEM_ADMIN_ROUTE_IDS: PageId[] = ["smart-storage-playground"];
const PROTOTYPE_ROUTE_IDS: PageId[] = [
  "smart-storage-workflow-prototype",
  "layout-prototype",
  "header-sidebar-prototype",
  "dashboard-hierarchy-prototype",
];
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
  access: "Access",
  announcement: "Announcement",
  answer: "Answer",
  event: "Event",
  knowledgeSlot: "Request",
  subscription: "Subscription",
};

const ORGANIZATION_KIND_OPTIONS: Array<{
  id: OrganizationKind;
  label: string;
}> = [
  { id: "school", label: "School" },
  { id: "church", label: "Church" },
  { id: "family", label: "Family" },
  { id: "community", label: "Community" },
];

const ORGANIZATION_MEMBERSHIP_ROLE_OPTIONS: Array<{
  id: OrganizationMembershipRole;
  label: string;
}> = [
  { id: "member", label: "Member" },
  { id: "admin", label: "Admin" },
];

const NOTIFICATION_TIME_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const PROFILE_CONTEXT_EXPERTISE_TIME_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
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
  const recordSearchEvent = useMutation(api.analytics.recordSearchEvent);
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

  function recordRootSearchEvent(searchText: string) {
    void recordSearchEvent({
      searchScope: "root",
      searchText,
    }).catch(() => undefined);
  }

  function commitRouteState(nextRouteState: RouteState) {
    setRouteStateWithTransition(nextRouteState, setRouteState, () => {
      setRouteMotionKey((currentKey) => currentKey + 1);
    });
  }

  // PROTOTYPE: keep active frame and Dashboard comparisons one URL away for HITL review,
  // even in a clean local browser. Production builds and authenticated
  // non-admin sessions still use the normal access gates below.
  if (
    import.meta.env.DEV &&
    !isAuthenticated &&
    (routeState.route.id === "header-sidebar-prototype" ||
      routeState.route.id === "dashboard-hierarchy-prototype")
  ) {
    return (
      <PrototypeRoute
        onToggleTheme={toggleTheme}
        routeId={routeState.route.id}
        theme={theme}
      />
    );
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
    appAccess.systemRole === "systemAdmin",
  );

  if (isPrototypeRoute(routeState.route.id) && canUseDevSystemAdminRoute(appAccess)) {
    return (
      <PrototypeRoute
        onToggleTheme={toggleTheme}
        routeId={routeState.route.id}
        theme={theme}
      />
    );
  }

  return (
    <KnowledgebaseShell
      activePageId={routeState.route.id}
      appAccess={appAccess}
      onNavigate={navigate}
      onNavigateToHref={navigateToHref}
      onRootSearchSubmit={recordRootSearchEvent}
      onToggleTheme={toggleTheme}
      notificationUnreadCount={notificationUnreadSummary?.unreadCount ?? 0}
      pinnedKnowledgePages={pinnedKnowledgePages}
      routeState={routeState}
      routeMotionKey={routeMotionKey}
      theme={theme}
    >
      <PageScaffold
        appAccess={appAccess}
        notificationUnreadCount={notificationUnreadSummary?.unreadCount ?? 0}
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

// Browser location parsing stays below the component tree so the rest of the app
// receives typed route state instead of raw platform objects.
function getRouteState(location: Location): RouteState {
  const pathname = normalizePathname(location.pathname);
  const search = location.search;
  return {
    route: matchRoute(pathname, search),
    pathname,
    search,
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

function matchRoute(pathname: string, search = "") {
  const prototypeRouteId = getPrototypeRouteIdFromSearch(search);
  if (prototypeRouteId !== null) {
    return getRoute(prototypeRouteId);
  }

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

function getPrototypeRouteIdFromSearch(search: string): PageId | null {
  const prototypeId = new URLSearchParams(search).get("prototype");
  if (prototypeId === "layout") {
    return "layout-prototype";
  }

  if (prototypeId === "header-sidebar") {
    return "header-sidebar-prototype";
  }

  if (prototypeId === "dashboard-hierarchy") {
    return "dashboard-hierarchy-prototype";
  }

  if (prototypeId === "smart-storage-workflow" || prototypeId === "smart-storage") {
    return "smart-storage-workflow-prototype";
  }

  return null;
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

// The shell owns reusable layout behavior; pages focus on their data and action
// handlers.
function KnowledgebaseShell({
  activePageId,
  appAccess,
  children,
  notificationUnreadCount,
  onNavigate,
  onNavigateToHref,
  onRootSearchSubmit,
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
  onRootSearchSubmit: (searchText: string) => void;
  onToggleTheme: () => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeMotionKey: number;
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const [isTopbarHidden, setIsTopbarHidden] = useState(false);
  const lastScrollTopRef = useRef(0);
  const activeRoleOptions = useMemo(
    () => getActiveRoleOptions(appAccess),
    [appAccess],
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
    const scrollHost = event.currentTarget;
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
    if (
      !isTopbarHidden &&
      scrollDelta > 0 &&
      wouldHidingTopbarClampScroll(scrollHost, nextScrollTop)
    ) {
      return;
    }

    setIsTopbarHidden(scrollDelta > 0);
  }

  return (
    <div className="kb-shell" data-theme={theme}>
      <Sidebar
        activePageId={activePageId}
        notificationUnreadCount={notificationUnreadCount}
        onNavigate={onNavigate}
        pinnedKnowledgePages={pinnedKnowledgePages}
        onToggleTheme={onToggleTheme}
        routeState={routeState}
        showDevSystemAdminRoutes={canUseDevSystemAdminRoute(appAccess)}
        showSystemAdminRoute={appAccess.systemRole === "systemAdmin"}
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
          onRootSearchSubmit={onRootSearchSubmit}
        />
        <div className="kb-host-content" onScroll={handleContentScroll}>
          <div className="kb-workspace-shell kb-workspace-shell-rail-only">
            <div className={`kb-route-transition ${routeMotionClassName}`}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function wouldHidingTopbarClampScroll(scrollHost: HTMLElement, scrollTop: number) {
  const topbarHeight = getTopbarHeight(scrollHost);
  if (topbarHeight <= 0) {
    return false;
  }

  const maxScrollTopWithTopbar = Math.max(
    0,
    scrollHost.scrollHeight - scrollHost.clientHeight,
  );
  const maxScrollTopWithoutTopbar = Math.max(
    0,
    maxScrollTopWithTopbar - topbarHeight,
  );

  return scrollTop > maxScrollTopWithoutTopbar - TOPBAR_SCROLL_TOLERANCE;
}

function getTopbarHeight(scrollHost: HTMLElement) {
  const hostColumn = scrollHost.parentElement;
  if (!hostColumn) {
    return 0;
  }

  const configuredHeight = Number.parseFloat(
    window.getComputedStyle(hostColumn).getPropertyValue("--kb-topbar-height"),
  );
  if (Number.isFinite(configuredHeight) && configuredHeight > 0) {
    return configuredHeight;
  }

  return hostColumn.querySelector<HTMLElement>(".kb-topbar")?.offsetHeight ?? 0;
}

function Sidebar({
  activePageId,
  notificationUnreadCount,
  onNavigate,
  pinnedKnowledgePages,
  onToggleTheme,
  routeState,
  showDevSystemAdminRoutes,
  showSystemAdminRoute,
  theme,
}: {
  activePageId: PageId;
  notificationUnreadCount: number;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  onToggleTheme: () => void;
  routeState: RouteState;
  showDevSystemAdminRoutes: boolean;
  showSystemAdminRoute: boolean;
  theme: ThemePreference;
}) {
  const dashboardRoute = getRoute("dashboard");

  return (
    <aside className="kb-sidebar" aria-label="Primary navigation">
      <a
        className="kb-logo-button"
        href="/"
        aria-label="Logeion dashboard"
        onClick={(event) => onNavigate(event, "/")}
        title="Logeion dashboard"
      >
        <BrandMark />
      </a>

      <div
        className="kb-sidebar-route-group kb-knowledge-route-group"
        aria-label="Knowledge Page destinations"
      >
        <span className="kb-sidebar-section-label">Knowledge</span>
        <RailNavLink
          active={activePageId === "dashboard"}
          href={dashboardRoute.href}
          icon={dashboardRoute.icon}
          label={dashboardRoute.label}
          onNavigate={onNavigate}
          secondaryLabel="All Accessible Knowledge"
        />
        <RailPinnedKnowledgePages
          activePageId={activePageId}
          onNavigate={onNavigate}
          pinnedKnowledgePages={pinnedKnowledgePages}
          routeState={routeState}
        />
      </div>

      <nav className="kb-nav-stack kb-sidebar-route-group kb-user-route-nav" aria-label="User Views">
        <span className="kb-sidebar-section-label">Work</span>
        {USER_ROUTE_IDS.map((pageId) => {
          const route = getRoute(pageId);

          return (
            <RailNavLink
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
      </nav>

      {showSystemAdminRoute || showDevSystemAdminRoutes ? (
        <nav className="kb-nav-stack kb-sidebar-route-group kb-admin-route-nav" aria-label="Admin Area">
          <span className="kb-sidebar-section-label">Admin</span>
        {showSystemAdminRoute
          ? SYSTEM_ADMIN_ROUTE_IDS.map((pageId) => {
              const route = getRoute(pageId);

              return (
                <RailNavLink
                  active={pageId === activePageId}
                  href={route.href}
                  icon={route.icon}
                  key={pageId}
                  label={route.label}
                  onNavigate={onNavigate}
                />
              );
            })
          : null}
        {showDevSystemAdminRoutes
          ? DEV_SYSTEM_ADMIN_ROUTE_IDS.map((pageId) => {
              const route = getRoute(pageId);

              return (
                <RailNavLink
                  active={pageId === activePageId}
                  href={route.href}
                  icon={route.icon}
                  key={pageId}
                  label={route.label}
                  onNavigate={onNavigate}
                />
              );
            })
          : null}
        {showDevSystemAdminRoutes ? (
          <PrototypeRoutesControl
            activePageId={activePageId}
            onNavigate={onNavigate}
          />
        ) : null}
        </nav>
      ) : null}

      <nav className="kb-account-icons" aria-label="Account controls">
        <a
          aria-current={activePageId === "profile" ? "page" : undefined}
          aria-label="Profile"
          className={
            activePageId === "profile"
              ? "kb-avatar-link kb-avatar-link-active"
              : "kb-avatar-link"
          }
          href="/profile"
          onClick={(event) => onNavigate(event, "/profile")}
          title="Profile"
        >
          <img className="kb-avatar-photo" src={profilePlaceholderUrl} alt="" aria-hidden="true" />
          <span className="kb-avatar-status" aria-hidden="true" />
        </a>
        <RailNavLink
          active={false}
          href="/profile?section=bookmarks"
          icon={Bookmark}
          label="Bookmarks"
          onNavigate={onNavigate}
        />
        <RailNavLink
          active={activePageId === "settings"}
          href="/settings"
          icon={Settings}
          label="Settings"
          onNavigate={onNavigate}
        />
        <RailActionButton
          icon={theme === "dark" ? Sun : Moon}
          label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={onToggleTheme}
        />
        <SignOutButton />
      </nav>
    </aside>
  );
}

function PrototypeRoutesControl({
  activePageId,
  onNavigate,
}: {
  activePageId: PageId;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const active = isPrototypeRoute(activePageId);

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    dialogRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDialogOpen(false);
        buttonRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen]);

  function handleCloseDialog() {
    setIsDialogOpen(false);
    buttonRef.current?.focus();
  }

  function handlePrototypeClick(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    handleCloseDialog();
    onNavigate(event, href);
  }

  return (
    <>
      <button
        aria-current={active ? "page" : undefined}
        aria-expanded={isDialogOpen}
        aria-haspopup="dialog"
        aria-label="Prototypes"
        className={active ? "kb-rail-button kb-rail-button-active" : "kb-rail-button"}
        onClick={() => setIsDialogOpen(true)}
        ref={buttonRef}
        title="Prototypes"
        type="button"
      >
        <FlaskConical aria-hidden="true" />
      </button>
      {isDialogOpen ? (
        <div className="kb-pinned-overflow-dialog-backdrop" onMouseDown={handleCloseDialog}>
          <section
            aria-labelledby="kb-prototype-routes-dialog-heading"
            aria-modal="true"
            className="kb-pinned-overflow-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <header>
              <div>
                <p className="kb-eyebrow">Admin</p>
                <h3 id="kb-prototype-routes-dialog-heading">Prototype Pages</h3>
              </div>
              <button
                aria-label="Close prototype pages"
                className="kb-pinned-overflow-dialog-close"
                onClick={handleCloseDialog}
                type="button"
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <nav aria-label="Prototype Pages" className="kb-pinned-overflow-list">
              {PROTOTYPE_ROUTE_IDS.map((pageId) => {
                const route = getRoute(pageId);
                const Icon = route.icon;
                const routeActive = pageId === activePageId;

                return (
                  <a
                    aria-current={routeActive ? "page" : undefined}
                    aria-label={route.label}
                    className={
                      routeActive
                        ? "kb-pinned-overflow-link kb-pinned-overflow-link-active"
                        : "kb-pinned-overflow-link"
                    }
                    href={route.href}
                    key={pageId}
                    onClick={(event) => handlePrototypeClick(event, route.href)}
                    title={route.label}
                  >
                    <Icon aria-hidden="true" />
                    <span>
                      <strong>{route.label}</strong>
                      <small>Prototype</small>
                    </span>
                  </a>
                );
              })}
            </nav>
          </section>
        </div>
      ) : null}
    </>
  );
}

function RailPinnedKnowledgePages({
  activePageId,
  onNavigate,
  pinnedKnowledgePages,
  routeState,
}: {
  activePageId: PageId;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeState: RouteState;
}) {
  const visiblePinnedKnowledgePages = pinnedKnowledgePages.slice(
    0,
    SIDEBAR_VISIBLE_PIN_LIMIT,
  );
  const overflowPinnedKnowledgePages = pinnedKnowledgePages.slice(
    SIDEBAR_VISIBLE_PIN_LIMIT,
  );

  return (
    <nav className="kb-nav-stack kb-pinned-rail-nav" aria-label="Pinned Knowledge Pages">
      {visiblePinnedKnowledgePages.map((pin) => (
        <RailNavLink
          active={isPinnedKnowledgePageActive(pin, activePageId, routeState)}
          href={pin.href}
          icon={pin.icon}
          key={pin.id}
          label={pin.label}
          onNavigate={onNavigate}
          secondaryLabel={pin.secondaryLabel}
          visual={
            <PinnedKnowledgePageVisual
              className="kb-pinned-page-rail-visual"
              pin={pin}
            />
          }
        />
      ))}
      {overflowPinnedKnowledgePages.length > 0 ? (
        <PinnedKnowledgePageOverflowControl
          activePageId={activePageId}
          buttonClassName="kb-rail-button kb-rail-overflow-button"
          onNavigate={onNavigate}
          overflowPinnedKnowledgePages={overflowPinnedKnowledgePages}
          routeState={routeState}
        />
      ) : null}
    </nav>
  );
}

function KnowledgePageDrawer({
  activePageId,
  onNavigate,
  pinnedKnowledgePages,
  routeState,
}: {
  activePageId: PageId;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeState: RouteState;
}) {
  const visiblePinnedKnowledgePages = pinnedKnowledgePages.slice(
    0,
    SIDEBAR_VISIBLE_PIN_LIMIT,
  );
  const overflowPinnedKnowledgePages = pinnedKnowledgePages.slice(
    SIDEBAR_VISIBLE_PIN_LIMIT,
  );

  return (
    <aside className="kb-knowledge-drawer" aria-label="Knowledge Pages">
      <header>
        <span>Workspace</span>
        <strong>Knowledge Pages</strong>
      </header>
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
              secondaryLabel="All Accessible Knowledge"
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
                visual={
                  <PinnedKnowledgePageVisual
                    className="kb-pinned-page-drawer-visual"
                    pin={pin}
                  />
                }
              />
            ))}
            {overflowPinnedKnowledgePages.length > 0 ? (
              <PinnedKnowledgePageOverflowControl
                activePageId={activePageId}
                buttonClassName="kb-sidebar-overflow"
                onNavigate={onNavigate}
                overflowPinnedKnowledgePages={overflowPinnedKnowledgePages}
                routeState={routeState}
              />
            ) : null}
          </div>
        ) : null}
      </nav>
    </aside>
  );
}

function PinnedKnowledgePageOverflowControl({
  activePageId,
  buttonClassName,
  onNavigate,
  overflowPinnedKnowledgePages,
  routeState,
}: {
  activePageId: PageId;
  buttonClassName: string;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  overflowPinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeState: RouteState;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const hiddenPinCount = overflowPinnedKnowledgePages.length;
  const buttonLabel = `${hiddenPinCount} more pinned Knowledge Pages`;
  const hiddenPinTitle = overflowPinnedKnowledgePages
    .map((pin) => pin.organizationName)
    .join(", ");

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    dialogRef.current?.focus();

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDialogOpen(false);
        buttonRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen]);

  function handleCloseDialog() {
    setIsDialogOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <button
        aria-expanded={isDialogOpen}
        aria-haspopup="dialog"
        aria-label={buttonLabel}
        className={buttonClassName}
        onClick={() => setIsDialogOpen(true)}
        ref={buttonRef}
        title={hiddenPinTitle}
        type="button"
      >
        +{hiddenPinCount}
      </button>
      {isDialogOpen ? (
        <PinnedKnowledgePageOverflowDialog
          activePageId={activePageId}
          dialogRef={dialogRef}
          onClose={handleCloseDialog}
          onNavigate={onNavigate}
          overflowPinnedKnowledgePages={overflowPinnedKnowledgePages}
          routeState={routeState}
        />
      ) : null}
    </>
  );
}

function PinnedKnowledgePageOverflowDialog({
  activePageId,
  dialogRef,
  onClose,
  onNavigate,
  overflowPinnedKnowledgePages,
  routeState,
}: {
  activePageId: PageId;
  dialogRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  overflowPinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeState: RouteState;
}) {
  function handleHiddenPinClick(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    onClose();
    onNavigate(event, href);
  }

  return (
    <div className="kb-pinned-overflow-dialog-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="kb-pinned-overflow-dialog-heading"
        aria-modal="true"
        className="kb-pinned-overflow-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
          <div>
            <p className="kb-eyebrow">Pinned</p>
            <h3 id="kb-pinned-overflow-dialog-heading">
              Hidden Pinned Knowledge Pages
            </h3>
          </div>
          <button
            aria-label="Close hidden pinned Knowledge Pages"
            className="kb-pinned-overflow-dialog-close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <nav
          aria-label="Hidden pinned Knowledge Pages"
          className="kb-pinned-overflow-list"
        >
          {overflowPinnedKnowledgePages.map((pin) => {
            const active = isPinnedKnowledgePageActive(
              pin,
              activePageId,
              routeState,
            );

            return (
              <a
                aria-current={active ? "page" : undefined}
                aria-label={pin.label}
                className={
                  active
                    ? "kb-pinned-overflow-link kb-pinned-overflow-link-active"
                    : "kb-pinned-overflow-link"
                }
                href={pin.href}
                key={pin.id}
                onClick={(event) => handleHiddenPinClick(event, pin.href)}
                title={`${pin.label} - ${pin.secondaryLabel}`}
              >
                <PinnedKnowledgePageVisual
                  className="kb-pinned-page-overflow-visual"
                  pin={pin}
                />
                <span>
                  <strong>{pin.label}</strong>
                  <small>{pin.secondaryLabel}</small>
                </span>
              </a>
            );
          })}
        </nav>
      </section>
    </div>
  );
}

function RailNavLink({
  active,
  badge,
  href,
  icon: Icon,
  label,
  onNavigate,
  secondaryLabel,
  visual,
}: {
  active: boolean;
  badge?: number;
  href: string;
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  label: string;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  secondaryLabel?: string;
  visual?: ReactNode;
}) {
  return (
    <a
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={active ? "kb-rail-button kb-rail-button-active" : "kb-rail-button"}
      href={href}
      onClick={(event) => onNavigate(event, href)}
      title={label}
    >
      {visual ?? <Icon aria-hidden="true" />}
      <span className="kb-rail-link-copy">
        <span>{label}</span>
        {secondaryLabel ? <small>{secondaryLabel}</small> : null}
      </span>
      {badge ? (
        <span className="kb-nav-badge" aria-label="Unread notifications">
          {badge}
        </span>
      ) : null}
    </a>
  );
}

function RailActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="kb-rail-button"
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" />
    </button>
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
  visual,
}: {
  active: boolean;
  badge?: number;
  href: string;
  icon: ElementType<{ "aria-hidden"?: "true" }>;
  label: string;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  secondaryLabel?: string;
  visual?: ReactNode;
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
      {visual ?? <Icon aria-hidden="true" />}
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

function PinnedKnowledgePageVisual({
  className,
  pin,
}: {
  className: string;
  pin: SidebarPinnedKnowledgePage;
}) {
  return (
    <ReferentTagVisual
      className={className}
      fallbackIcon={pin.icon}
      tag={{
        canonicalKey: pin.id,
        href: pin.href,
        id: pin.id,
        knowledgeType: getPinnedKnowledgePageVisualType(pin),
        label: pin.label,
        ...(pin.thumbnailUrl === undefined
          ? {}
          : { thumbnailUrl: pin.thumbnailUrl }),
      }}
    />
  );
}

function getPinnedKnowledgePageVisualType(pin: SidebarPinnedKnowledgePage): KnowledgeType {
  if (pin.pageKind === "organization") {
    return "organization";
  }
  if (pin.pageKind === "scripture") {
    return "biblePassage";
  }
  if (pin.pageKind === "search" || pin.pageKind === "dashboard") {
    return "words";
  }

  return "topic";
}

function TopBar({
  activeRoleOptionId,
  activeRoleOptions,
  onActiveRoleChange,
  onNavigate,
  onNavigateToHref,
  onRootSearchSubmit,
}: {
  activeRoleOptionId: string;
  activeRoleOptions: ActiveRoleOption[];
  onActiveRoleChange: (optionId: string) => void;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  onRootSearchSubmit: (searchText: string) => void;
}) {
  const [rootSearchQuery, setRootSearchQuery] = useState("");
  const [isRootSearchFocused, setIsRootSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const activeRoleOption =
    activeRoleOptions.find((option) => option.id === activeRoleOptionId) ??
    activeRoleOptions[0];
  const trimmedRootSearchQuery = rootSearchQuery.trim();
  const fallbackRootSearchSuggestions = useMemo(
    () =>
      getRootSearchTagSuggestions(
        trimmedRootSearchQuery,
        ROOT_SEARCH_SUGGESTION_LIMIT,
      ),
    [trimmedRootSearchQuery],
  );
  const liveRootSearchSuggestions = useQuery(
    api.tagSuggestions.listRootSearchTagSuggestions,
    trimmedRootSearchQuery
      ? {
          limit: ROOT_SEARCH_SUGGESTION_LIMIT,
          query: trimmedRootSearchQuery,
        }
      : "skip",
  ) as RootSearchTagSuggestion[] | undefined;
  const rootSearchSuggestions = getVisibleRootSearchSuggestions(
    liveRootSearchSuggestions,
    fallbackRootSearchSuggestions,
  );
  const isRootSearchSuggestionListOpen =
    isRootSearchFocused &&
    trimmedRootSearchQuery.length > 0 &&
    rootSearchSuggestions.length > 0;

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [trimmedRootSearchQuery]);

  function handleRootSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setRootSearchQuery(event.currentTarget.value);
  }

  function handleRootSearchBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsRootSearchFocused(false);
  }

  function handleRootSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (isRootSearchSuggestionListOpen) {
        const suggestion = rootSearchSuggestions[activeSuggestionIndex];
        if (suggestion) {
          navigateToRootSearchSuggestion(suggestion.href);
          return;
        }
      }

      submitRootSearchQuery();
      return;
    }

    if (!isRootSearchSuggestionListOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        Math.min(currentIndex + 1, rootSearchSuggestions.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.key === "Escape") {
      setIsRootSearchFocused(false);
    }
  }

  function navigateToRootSearchSuggestion(href: string) {
    onNavigateToHref(href);
    setRootSearchQuery("");
    setIsRootSearchFocused(false);
  }

  function submitRootSearchQuery() {
    const searchQuery = rootSearchQuery.trim();
    if (!searchQuery) {
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set("q", searchQuery);
    onRootSearchSubmit(searchQuery);
    onNavigateToHref(`/search?${searchParams.toString()}`);
    setRootSearchQuery("");
    setIsRootSearchFocused(false);
  }

  function handleRootSearchSuggestionClick(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    onNavigate(event, href);
    setRootSearchQuery("");
    setIsRootSearchFocused(false);
  }

  return (
    <header className="kb-topbar">
      <a
        aria-label="Logeion by Arche Press dashboard"
        className="kb-brand"
        href="/"
        onClick={(event) => onNavigate(event, "/")}
        title="Logeion by Arche Press"
      >
        <LogeionBrand />
      </a>
      <div className="kb-topbar-actions">
        <label className="kb-active-role-switcher" title="Active Role">
          <Shield aria-hidden="true" />
          <span className="kb-active-role-copy">
            <span>Active Role</span>
            <strong>{activeRoleOption?.label ?? "Personal"}</strong>
            <small>{activeRoleOption?.detail ?? "Personal"}</small>
          </span>
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
          <ChevronDown aria-hidden="true" />
        </label>
        <div className="kb-search-wrap" onBlur={handleRootSearchBlur}>
          <span className="kb-search-label">Search Everything</span>
          <label className="kb-search">
            <Search aria-hidden="true" />
            <input
              aria-activedescendant={
                isRootSearchSuggestionListOpen
                  ? `kb-search-suggestion-${activeSuggestionIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-controls="kb-search-suggestions"
              aria-expanded={isRootSearchSuggestionListOpen}
              onChange={handleRootSearchChange}
              onFocus={() => setIsRootSearchFocused(true)}
              onKeyDown={handleRootSearchKeyDown}
              placeholder="Search everything you can access"
              aria-label="Search Everything"
              type="text"
              value={rootSearchQuery}
            />
          </label>
          <Presence present={isRootSearchSuggestionListOpen}>
            {(presenceState) => (
              <div
                aria-label="Root Search suggestions"
                className="kb-search-suggestions"
                data-presence={presenceState}
                id="kb-search-suggestions"
                role="listbox"
              >
                {rootSearchSuggestions.map((suggestion, index) => (
                  <a
                    aria-selected={index === activeSuggestionIndex}
                    href={suggestion.href}
                    id={`kb-search-suggestion-${index}`}
                    key={suggestion.href}
                    onClick={(event) =>
                      handleRootSearchSuggestionClick(event, suggestion.href)
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    role="option"
                  >
                    <ReferentTagVisual
                      className="kb-search-suggestion-visual"
                      tag={suggestion.tag}
                    />
                    <span>{suggestion.label}</span>
                    <KnowledgeTypeBadge
                      className="kb-search-suggestion-type"
                      knowledgeType={suggestion.knowledgeType}
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

function getVisibleRootSearchSuggestions(
  liveSuggestions: RootSearchTagSuggestion[] | undefined,
  fallbackSuggestions: RootSearchTagSuggestion[],
) {
  return liveSuggestions && liveSuggestions.length > 0
    ? liveSuggestions
    : fallbackSuggestions;
}

function PageScaffold({
  appAccess,
  notificationUnreadCount,
  onNavigate,
  onNavigateToHref,
  onToggleTheme,
  pinnedKnowledgePages,
  routeState,
  theme,
}: {
  appAccess: AllowedAppAccess;
  notificationUnreadCount: number;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  onToggleTheme: () => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeState: RouteState;
  theme: ThemePreference;
}) {
  const { route } = routeState;
  const activeTags = useRouteActiveTags(routeState);
  if (route.id === "scripture") {
    return (
      <BiblePassagePage
        appAccess={appAccess}
        onNavigateToHref={onNavigateToHref}
        pinnedKnowledgePages={pinnedKnowledgePages}
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

  if (route.id === "system-admin") {
    return (
      <SystemAdminPage
        appAccess={appAccess}
        onNavigate={onNavigate}
        routeState={routeState}
      />
    );
  }

  if (route.id === "analytics") {
    return <AnalyticsPage onNavigate={onNavigate} routeState={routeState} />;
  }

  if (route.id === "smart-storage-playground") {
    if (!canUseDevSystemAdminRoute(appAccess)) {
      return <RouteUnavailablePage routeState={routeState} />;
    }

    return (
      <SmartStoragePlayground
        onNavigateToHref={onNavigateToHref}
        routeMeta={<RouteMeta routeState={routeState} />}
      />
    );
  }

  if (isPrototypeRoute(route.id)) {
    return <RouteUnavailablePage routeState={routeState} />;
  }

  if (route.id === "calendar") {
    return <CalendarPage onNavigate={onNavigate} routeState={routeState} />;
  }

  if (route.id === "todo-list") {
    return (
      <TodoListPage
        onNavigate={onNavigate}
        onNavigateToHref={onNavigateToHref}
        routeState={routeState}
      />
    );
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
  const usesStandardKnowledgePageShell =
    isStandardKnowledgePageShellRoute(route.id);
  const dashboardMetrics =
    route.id === "dashboard"
      ? getDashboardMetrics({
          appAccess,
          notificationUnreadCount,
          pinnedKnowledgePages,
        })
      : undefined;

  return (
    <main
      className={
        hasWorkingLayout
          ? route.id === "dashboard"
            ? "kb-main kb-scaffold-main kb-scaffold-main-working kb-dashboard-main"
            : "kb-main kb-scaffold-main kb-scaffold-main-working"
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

      {hasWorkingLayout ? (
        <ComponentScaffold
          activeTags={activeTags}
          allowedContributionTypes={route.allowedContributionTypes}
          appAccess={appAccess}
          components={route.components}
          dashboardMetrics={dashboardMetrics}
          label={route.label}
          routeId={route.id}
          onNavigateToHref={onNavigateToHref}
          pinnedKnowledgePages={pinnedKnowledgePages}
          routeState={routeState}
          showFeedHeading={!usesStandardKnowledgePageShell}
          showHeading={!usesStandardKnowledgePageShell}
          showIdentityBand={usesStandardKnowledgePageShell}
          showNavigatorHeader={!usesStandardKnowledgePageShell}
          showSlotRail={!usesStandardKnowledgePageShell}
        />
      ) : (
        <PagePlaceholder route={route} />
      )}

      {route.id === "dashboard" ? <TodayAgenda onNavigate={onNavigate} /> : null}

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}
    </main>
  );
}

type RouteActiveTagResolution = ActiveTag | null;

function useRouteActiveTags(routeState: RouteState) {
  const fallbackActiveTags = useMemo(
    () => getActiveTagsFromRoute(routeState),
    [routeState.pathname, routeState.search],
  );
  const liveResolvableTags = useMemo(
    () =>
      fallbackActiveTags.filter(
        (tag) => tag.knowledgeType !== "biblePassage",
      ),
    [fallbackActiveTags],
  );
  const resolvedRouteActiveTags = useQuery(
    api.tagSuggestions.resolveRouteActiveTags,
    liveResolvableTags.length > 0
      ? { tagKeys: liveResolvableTags.map((tag) => tag.id) }
      : "skip",
  ) as RouteActiveTagResolution[] | undefined;

  return useMemo(() => {
    if (!resolvedRouteActiveTags) {
      return fallbackActiveTags;
    }

    let resolvedTagIndex = 0;
    return fallbackActiveTags.map((fallbackTag) => {
      if (fallbackTag.knowledgeType === "biblePassage") {
        return fallbackTag;
      }

      const resolvedTag = resolvedRouteActiveTags[resolvedTagIndex++];
      return resolvedTag ?? fallbackTag;
    });
  }, [fallbackActiveTags, resolvedRouteActiveTags]);
}

function isStandardKnowledgePageShellRoute(pageId: PageId) {
  return (
    pageId === "dashboard" ||
    pageId === "root-search" ||
    pageId === "tag" ||
    pageId === "explore-context"
  );
}

function canUseDevSystemAdminRoute(appAccess: AllowedAppAccess) {
  return appAccess.systemRole === "systemAdmin" && !import.meta.env.PROD;
}

function isPrototypeRoute(pageId: PageId) {
  return PROTOTYPE_ROUTE_IDS.includes(pageId);
}

type DashboardMetric = {
  id: string;
  label: string;
  value: number;
};

function getDashboardMetrics({
  appAccess,
  notificationUnreadCount,
  pinnedKnowledgePages,
}: {
  appAccess: AllowedAppAccess;
  notificationUnreadCount: number;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
}): DashboardMetric[] {
  return [
    {
      id: "pinned",
      label: "Pinned",
      value: pinnedKnowledgePages.length,
    },
    {
      id: "unread",
      label: "Unread",
      value: notificationUnreadCount,
    },
    {
      id: "admin",
      label: "Admin Area",
      value: appAccess.systemRole === "systemAdmin" ? 1 : 0,
    },
  ];
}

function PrototypeRoute({
  onToggleTheme,
  routeId,
  theme,
}: {
  onToggleTheme: () => void;
  routeId: PageId;
  theme: ThemePreference;
}) {
  if (routeId === "layout-prototype") {
    return <LayoutPrototype onToggleTheme={onToggleTheme} theme={theme} />;
  }

  if (routeId === "header-sidebar-prototype") {
    return <HeaderSidebarPrototype onToggleTheme={onToggleTheme} theme={theme} />;
  }

  if (routeId === "dashboard-hierarchy-prototype") {
    return <DashboardHierarchyPrototype onToggleTheme={onToggleTheme} theme={theme} />;
  }

  if (routeId === "smart-storage-workflow-prototype") {
    return (
      <SmartStorageWorkflowPrototype onToggleTheme={onToggleTheme} theme={theme} />
    );
  }

  return null;
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
              <span
                className="kb-today-agenda-icon"
                data-knowledge-type={item.knowledgeType}
                aria-hidden="true"
              >
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

function getProfileContextExpertiseLabel(tags: ActiveTag[]) {
  if (tags.length === 0) {
    return "All Accessible Knowledge";
  }

  return tags.map((tag) => tag.label).join(", ");
}

function formatProfileContextTypes(tags: ActiveTag[]) {
  if (tags.length === 0) {
    return "Accessible Root Knowledge Context";
  }

  if (tags.length === 1) {
    return `${formatKnowledgeTypeLabel(tags[0].knowledgeType)} Knowledge Context`;
  }

  return `${formatCount(tags.length, "Tag")} Knowledge Context`;
}

function formatProfileContextExpertiseMaturity(maturity: number) {
  if (maturity >= 80) {
    return "High maturity";
  }

  if (maturity >= 45) {
    return "Developing maturity";
  }

  return "Early signal";
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

function KnowledgePageActions({
  className,
  pinnedKnowledgePages,
  target,
}: {
  className?: string;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  target: KnowledgePageActionTarget | null;
}) {
  const pinOrganizationPage = useMutation(api.pinnedKnowledgePages.pinOrganizationPage);
  const pinKnowledgePage = useMutation(api.pinnedKnowledgePages.pinKnowledgePage);
  const unpinKnowledgePage = useMutation(api.pinnedKnowledgePages.unpinKnowledgePage);
  const bookmarkOrganizationPage = useMutation(
    api.bookmarkedKnowledgePages.bookmarkOrganizationPage,
  );
  const bookmarkKnowledgePage = useMutation(
    api.bookmarkedKnowledgePages.bookmarkKnowledgePage,
  );
  const removeBookmark = useMutation(api.bookmarkedKnowledgePages.removeBookmark);
  const subscribeOrganizationPage = useMutation(
    api.knowledgeSubscriptions.subscribeOrganizationPage,
  );
  const subscribeToKnowledgePage = useMutation(
    api.knowledgeSubscriptions.subscribeToKnowledgePage,
  );
  const unsubscribe = useMutation(api.knowledgeSubscriptions.unsubscribe);
  const [pendingPinAction, setPendingPinAction] = useState(false);
  const [pendingBookmarkAction, setPendingBookmarkAction] = useState(false);
  const [pendingSubscriptionAction, setPendingSubscriptionAction] = useState(false);
  const currentBookmark = useQuery(
    api.bookmarkedKnowledgePages.getForPage,
    target ? { pageKey: target.pageKey } : "skip",
  );
  const currentSubscription = useQuery(
    api.knowledgeSubscriptions.getForTarget,
    target ? { subscriptionKey: target.pageKey } : "skip",
  );
  const isPinned = target
    ? pinnedKnowledgePages.some((pin) => pin.pageKey === target.pageKey)
    : false;
  const isBookmarked = currentBookmark !== null && currentBookmark !== undefined;
  const isSubscribed =
    currentSubscription !== null && currentSubscription !== undefined;
  const canToggleBookmark = target !== null && currentBookmark !== undefined;
  const canToggleSubscription = target !== null && currentSubscription !== undefined;

  if (!target) {
    return null;
  }

  async function handleTogglePin() {
    if (!target) {
      return;
    }

    setPendingPinAction(true);
    try {
      if (isPinned) {
        await unpinKnowledgePage({ pageKey: target.pageKey });
      } else if (target.pageKind === "organization") {
        if (!target.organizationReferentId) {
          return;
        }
        await pinOrganizationPage({
          organizationReferentId: target.organizationReferentId,
        });
      } else {
        await pinKnowledgePage(getGenericKnowledgePageRelationshipInput(target));
      }
    } finally {
      setPendingPinAction(false);
    }
  }

  async function handleToggleBookmark() {
    if (!target) {
      return;
    }

    setPendingBookmarkAction(true);
    try {
      if (isBookmarked) {
        await removeBookmark({ pageKey: target.pageKey });
      } else if (target.pageKind === "organization") {
        if (!target.organizationReferentId) {
          return;
        }
        await bookmarkOrganizationPage({
          organizationReferentId: target.organizationReferentId,
        });
      } else {
        await bookmarkKnowledgePage(getGenericKnowledgePageRelationshipInput(target));
      }
    } finally {
      setPendingBookmarkAction(false);
    }
  }

  async function handleToggleSubscription() {
    if (!target) {
      return;
    }

    setPendingSubscriptionAction(true);
    try {
      if (isSubscribed) {
        await unsubscribe({ subscriptionKey: target.pageKey });
      } else if (target.pageKind === "organization") {
        if (!target.organizationReferentId) {
          return;
        }
        await subscribeOrganizationPage({
          organizationReferentId: target.organizationReferentId,
        });
      } else {
        await subscribeToKnowledgePage(getGenericKnowledgePageRelationshipInput(target));
      }
    } finally {
      setPendingSubscriptionAction(false);
    }
  }

  return (
    <div className={["kb-knowledge-page-actions", className].filter(Boolean).join(" ")}>
      <button
        aria-label={`${isPinned ? "Unpin" : "Pin"} ${target.label}`}
        aria-pressed={isPinned}
        className="kb-knowledge-page-action-toggle"
        data-action-kind="pin"
        disabled={pendingPinAction}
        onClick={() => void handleTogglePin()}
        type="button"
      >
        {isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
        <span>{isPinned ? "Unpin" : "Pin"}</span>
      </button>
      <button
        aria-label={`${isBookmarked ? "Remove Bookmark" : "Bookmark"} ${target.label}`}
        aria-pressed={isBookmarked}
        className="kb-knowledge-page-action-toggle"
        data-action-kind="bookmark"
        disabled={pendingBookmarkAction || !canToggleBookmark}
        onClick={() => void handleToggleBookmark()}
        type="button"
      >
        <Bookmark aria-hidden="true" />
        <span>{isBookmarked ? "Remove Bookmark" : "Bookmark"}</span>
      </button>
      <button
        aria-label={`${isSubscribed ? "Unsubscribe" : "Subscribe"} ${target.label}`}
        aria-pressed={isSubscribed}
        className="kb-knowledge-page-action-toggle"
        data-action-kind="subscription"
        disabled={pendingSubscriptionAction || !canToggleSubscription}
        onClick={() => void handleToggleSubscription()}
        type="button"
      >
        <Bell aria-hidden="true" />
        <span>{isSubscribed ? "Unsubscribe" : "Subscribe"}</span>
      </button>
    </div>
  );
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
  const pageActionTarget = profile.organizationReferentId
    ? {
        href: getOrganizationHomeHrefFromId(profile.organizationReferentId),
        label: profile.name,
        organizationReferentId: profile.organizationReferentId,
        pageKey: getOrganizationPageKey(profile.organizationReferentId),
        pageKind: "organization" as const,
        secondaryLabel: formatOrganizationKind(profile.organizationKind),
      }
    : null;
  const TypeIcon = config.icon;

  useEffect(() => {
    setSelectedModeId(firstModeId);
  }, [firstModeId, profile.id, profile.organizationKind]);

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

      <OrganizationSubrouteLinks
        onNavigate={onNavigate}
        routeState={routeState}
      />

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
          <KnowledgePageActions
            className="kb-organization-page-controls"
            pinnedKnowledgePages={pinnedKnowledgePages}
            target={pageActionTarget}
          />
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
          </dl>
        </aside>
      </section>

      <ComponentScaffold
        activeTags={activeTags}
        allowedContributionTypes={getRoute("organization-home").allowedContributionTypes}
        appAccess={appAccess}
        components={getRoute("organization-home").components}
        label={profile.name}
        onNavigateToHref={onNavigateToHref}
        pinnedKnowledgePages={pinnedKnowledgePages}
        routeId="organization-home"
        routeState={routeState}
        showHeading={false}
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
  includeEveryDefaultOrganization: boolean,
): SidebarPinnedKnowledgePage[] {
  if (durablePins === undefined) {
    return getSeededPinnedKnowledgePages(
      organizations,
      includeEveryDefaultOrganization,
    );
  }

  return durablePins.map((pin) => ({
    ...pin,
    icon: getPinnedKnowledgePageIcon(pin),
    pageKind: pin.pageKind ?? "organization",
  }));
}

function getSeededPinnedKnowledgePages(
  organizations: AllowedAppAccess["organizations"],
  includeEveryOrganization = false,
): SidebarPinnedKnowledgePage[] {
  const seenKinds = new Set<OrganizationKind>();
  const pinnedPages: SidebarPinnedKnowledgePage[] = [];

  for (const organization of organizations) {
    if (
      !includeEveryOrganization &&
      seenKinds.has(organization.organizationKind)
    ) {
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
      pageKind: "organization",
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
  if (pin.pageKind !== "organization") {
    const currentTarget = getKnowledgePageActionTarget({
      activeTags: getActiveTagsFromRoute(routeState),
      label: routeState.route.label,
      routeId: routeState.route.id,
      routeState,
    });

    return currentTarget?.pageKey === pin.pageKey;
  }

  if (activePageId !== "organization-home" && activePageId !== "organization-settings") {
    return false;
  }

  const currentOrganizationId = getOrganizationId(routeState.pathname);
  const currentLookupKey = normalizeOrganizationLookupKey(currentOrganizationId);

  return (
    currentOrganizationId === pin.id ||
    currentLookupKey === normalizeOrganizationLookupKey(pin.id) ||
    currentLookupKey === slugifyOrganizationId(pin.organizationName ?? pin.label)
  );
}

function getPinnedKnowledgePageIcon(pin: DurableSidebarPinnedKnowledgePage) {
  if (pin.pageKind === "organization" || pin.organizationKind !== undefined) {
    return ORGANIZATION_PAGE_CONFIGS[pin.organizationKind ?? "community"].icon;
  }

  return getKnowledgePageRelationshipIcon(pin.pageKind);
}

function getBookmarkedKnowledgePageIcon(bookmark: ProfileBookmarkedKnowledgePage) {
  if (bookmark.pageKind === "organization" || bookmark.organizationKind !== undefined) {
    return ORGANIZATION_PAGE_CONFIGS[bookmark.organizationKind ?? "community"].icon;
  }

  return getKnowledgePageRelationshipIcon(bookmark.pageKind);
}

function getSubscriptionSourceIcon(subscription: NotificationSubscriptionSource) {
  if (
    subscription.targetKind === "organization" ||
    subscription.organizationKind !== undefined
  ) {
    return ORGANIZATION_PAGE_CONFIGS[subscription.organizationKind ?? "community"].icon;
  }

  return getKnowledgePageRelationshipIcon(subscription.targetKind);
}

function getActiveRoleOptions(appAccess: AllowedAppAccess): ActiveRoleOption[] {
  const systemRoleOption =
    appAccess.systemRole === "systemAdmin"
      ? [
          {
            detail: "Application administration",
            id: "system:systemAdmin",
            label: "System Admin",
          },
        ]
      : [];
  const organizationOptions = appAccess.organizations.map((organization) => ({
    detail: organization.name,
    id: `${organization.organizationReferentId}:${organization.role}`,
    label: formatMembershipRole(organization.role),
  }));
  const options = [...systemRoleOption, ...organizationOptions];

  if (options.length === 0) {
    return [
      {
        detail: "Personal",
        id: "personal",
        label: "Personal",
      },
    ];
  }

  return options;
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
    <section className="kb-page-subroutes" aria-label="Organization subroutes">
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
  allowedContributionTypes,
  appAccess,
  components,
  dashboardMetrics,
  label,
  onNavigateToHref,
  pinnedKnowledgePages,
  routeId,
  routeState,
  showFeedHeading = true,
  showHeading = true,
  showIdentityBand = false,
  showNavigatorHeader = true,
  showSlotRail = true,
}: {
  activeTags: ActiveTag[];
  allowedContributionTypes?: readonly AuthorableKnowledgeType[];
  appAccess: AllowedAppAccess;
  components: CoreComponentId[];
  dashboardMetrics?: DashboardMetric[];
  label: string;
  onNavigateToHref: (href: string) => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  routeId: PageId;
  routeState: RouteState;
  showFeedHeading?: boolean;
  showHeading?: boolean;
  showIdentityBand?: boolean;
  showNavigatorHeader?: boolean;
  showSlotRail?: boolean;
}) {
  const [selectedContributionKnowledgeType, setSelectedContributionKnowledgeType] =
    useState<AuthorableKnowledgeType | null>(null);
  const [selectedContributionSlotId, setSelectedContributionSlotId] =
    useState<string | null>(null);
  const [focusedCreatedEntry, setFocusedCreatedEntry] =
    useState<KnowledgeEntrySummary | null>(null);
  const [selectedContextExpertSubject, setSelectedContextExpertSubject] =
    useState<SelectedContextExpertSubject | null>(null);
  const [contextExpertScope, setContextExpertScope] =
    useState<KnowledgeContextExpertScope>("orbit");
  const [smartStorageProposalReview, setSmartStorageProposalReview] =
    useState<SmartStorageProposalReviewSummary | null>(null);
  const [smartStorageRunReview, setSmartStorageRunReview] =
    useState<SmartStorageRunReviewSummary | null>(null);
  const [activeSmartStorageSessionId, setActiveSmartStorageSessionId] =
    useState<Id<"contributionSubmissions"> | null>(null);
  const [isSmartStorageWizardOpen, setIsSmartStorageWizardOpen] =
    useState(false);
  const [smartStorageExistingEntryTargets, setSmartStorageExistingEntryTargets] =
    useState<Record<string, string>>({});
  const [, refreshSmartStorageWizard] = useState(0);
  const [quoteAttributionPersonSearch, setQuoteAttributionPersonSearch] =
    useState<QuoteAttributionPersonSearchState | null>(null);
  const [localContextSearchQuery, setLocalContextSearchQuery] = useState("");
  const [navigatorQueryText, setNavigatorQueryText] = useState("");
  const recordNavigatorUsage = useMutation(api.analytics.recordNavigatorUsage);
  const recordSearchEvent = useMutation(api.analytics.recordSearchEvent);
  const postDirectContribution = useMutation(
    api.directContributions.postDirectContribution,
  );
  const startSmartStorage = useMutation(api.smartStorage.startFromContribution);
  const generateSmartStorageUploadUrl = useMutation(
    api.smartStorage.generateUploadUrl,
  );
  const createSmartStorageTemporaryUploadRecord = useMutation(
    api.smartStorage.createTemporaryUploadRecord,
  );
  const addKnowledgePageThumbnail = useMutation(
    api.smartStorage.addKnowledgePageThumbnail,
  );
  const generateSmartStorageProposal = useMutation(
    api.smartStorage.generateDraftProposalForRun,
  );
  const acceptSmartStorageProposal = useMutation(
    api.smartStorage.acceptScaffoldProposal,
  );
  const confirmSmartStorageKnownReferent = useMutation(
    api.smartStorage.confirmKnownReferentForReferenceResolution,
  );
  const requestSmartStorageRefresh = useMutation(
    api.smartStorage.requestRefreshForProposal,
  );
  const retrySmartStorageModelRun = useMutation(
    api.smartStorage.retryModelRun,
  );
  const dismissSmartStorageRefresh = useMutation(
    api.smartStorage.dismissRefreshSuggestion,
  );
  const cancelSmartStorageSession = useMutation(api.smartStorage.cancelSession);
  const recordHumanWeightFeedback = useMutation(api.humanWeightFeedback.record);
  const correctQuoteAttribution = useMutation(
    api.contextExpertise.correctQuoteAttribution,
  );
  const executeSmartStorageModelRun = useAction(api.smartStorage.executeModelRun);
  const previewDraftExternalUrl = useAction(
    api.smartStorage.previewDraftExternalUrl,
  );
  const saveContributionDraft = useMutation(api.contributionDrafts.save);
  const clearContributionDraft = useMutation(api.contributionDrafts.clear);
  const activeContextKey = getKnowledgeContextKey(activeTags);
  const knowledgePageActionTarget = getKnowledgePageActionTarget({
    activeTags,
    label,
    organizations: appAccess.organizations,
    routeId,
    routeState,
  });
  const routeRootSearchQuery = getRootSearchQueryFromRoute(routeState);
  const contextSearchQuery =
    routeId === "root-search"
      ? ""
      : localContextSearchQuery;
  const rootSearchResults = useQuery(
    api.rootSearch.listRootSearchResults,
    routeId === "root-search" && routeRootSearchQuery.length > 0
      ? {
          limit: 8,
          query: routeRootSearchQuery,
        }
      : "skip",
  ) as RootSearchResult[] | undefined;
  const isRootSearchResultsLoading =
    routeId === "root-search" &&
    routeRootSearchQuery.length > 0 &&
    rootSearchResults === undefined;
  const referentMetadataTag =
    showIdentityBand && routeId === "tag" && activeTags.length === 1
      ? activeTags[0]
      : null;
  const representativeThumbnailTag =
    showIdentityBand &&
    activeTags.length === 1 &&
    supportsRepresentativeThumbnail(activeTags[0].knowledgeType)
      ? activeTags[0]
      : null;
  const referentPageMetadata = useQuery(
    api.referentPages.getReferentPageMetadata,
    referentMetadataTag
      ? {
          canonicalKey: referentMetadataTag.canonicalKey,
          knowledgeType: referentMetadataTag.knowledgeType,
          tagLookupKey: referentMetadataTag.id,
        }
      : "skip",
  ) as ReferentPageMetadata | undefined;
  const knowledgePageThumbnailState = useQuery(
    api.rootSearch.getKnowledgePageThumbnailState,
    representativeThumbnailTag
      ? {
          canonicalKey: representativeThumbnailTag.canonicalKey,
          knowledgeType: representativeThumbnailTag.knowledgeType,
          tagLookupKey: representativeThumbnailTag.id,
        }
      : "skip",
  ) as KnowledgePageThumbnailState | undefined;
  const routeContributionKnowledgeType =
    getRouteContributionKnowledgeType(routeState.search);
  const routeGuidedContributionType =
    getRouteGuidedContributionType(routeState.search);
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
  const durableContextExperts = useQuery(api.answerFeed.listExpertsForActiveTagKeys, {
    activeTags,
    expertScope: contextExpertScope,
  }) as KnowledgeContextExpert[] | undefined;
  const selectedContextExpertDetail = useQuery(
    api.answerFeed.getExpertDetailForActiveTagKeys,
    selectedContextExpertSubject && durableContextExperts !== undefined
        ? {
            activeTags,
            expertScope: contextExpertScope,
            ...(selectedContextExpertSubject.subjectKind === "user"
              ? { subjectUserId: selectedContextExpertSubject.subjectUserId }
              : {
                  subjectPersonReferentId:
                    selectedContextExpertSubject.subjectPersonReferentId,
                }),
          }
        : "skip",
  ) as KnowledgeContextExpertDetail | null | undefined;
  const contextTrend = useQuery(
    api.analytics.getKnowledgeContextTrend,
    activeTagKeys.length > 0 ? { activeTagKeys } : "skip",
  );
  const navigatorQuerySuggestions = useQuery(
    api.tagSuggestions.listKnowledgeNavigatorTagSuggestions,
    navigatorQueryText.trim().length > 0
      ? {
          activeTags,
          query: navigatorQueryText,
        }
      : "skip",
  ) as KnowledgeNavigatorQuerySuggestion[] | undefined;
  const quoteAttributionPersonSearchQuery =
    quoteAttributionPersonSearch?.searchQuery.trim() ?? "";
  const quoteAttributionPersonOptions = useQuery(
    api.contextExpertise.searchQuoteAttributionPeople,
    appAccess.systemRole === "systemAdmin" &&
      quoteAttributionPersonSearch !== null &&
      quoteAttributionPersonSearchQuery.length >= 2
      ? {
          limit: 8,
          searchQuery: quoteAttributionPersonSearchQuery,
        }
      : "skip",
  ) as QuoteAttributionPersonOption[] | undefined;
  const quoteAttributionPersonPicker =
    quoteAttributionPersonSearch === null
      ? undefined
      : {
          entryId: quoteAttributionPersonSearch.entryId,
          isLoading:
            quoteAttributionPersonSearchQuery.length >= 2 &&
            quoteAttributionPersonOptions === undefined,
          options: quoteAttributionPersonOptions ?? [],
        };
  // The Answer Feed is durable user-contributed knowledge only. Keep the
  // loading state empty instead of rendering demo entries as if they existed.
  const feedItems = durableFeedItems ?? [];
  const primarySlotItem = showSlotRail ? feedItems.find(isAnswerFeedSlot) : undefined;
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
  const activeAllowedContributionTypes = getAllowedContributionTypesForPlacement(
    {
      guidedContributionType: activeGuidedContributionType,
      routeAllowedContributionTypes: allowedContributionTypes,
      slot: selectedSlot,
    },
  );
  const activeAllowedContributionTypeKey = getAllowedContributionTypeKey(
    activeAllowedContributionTypes,
  );
  const activeSelectedContributionKnowledgeType =
    getSelectedContributionKnowledgeTypeWithinAllowedTypes({
      allowedContributionTypes: activeAllowedContributionTypes,
      focusedCreatedEntry,
      routeContributionKnowledgeType,
      selectedContributionKnowledgeType,
    });
  const contributionDraftKey = useMemo(
    () =>
      getContributionDraftKey({
        allowedContributionTypeKey: activeAllowedContributionTypeKey,
        contextKey: activeContextKey,
        focusedEntryId: focusedCreatedEntry?.id,
        guidedContributionType: activeGuidedContributionType,
        routeId,
        slotId: selectedSlot?.id ?? selectedContributionSlotId,
      }),
    [
      activeAllowedContributionTypeKey,
      activeContextKey,
      activeGuidedContributionType,
      focusedCreatedEntry?.id,
      routeId,
      selectedContributionSlotId,
      selectedSlot?.id,
    ],
  );
  const contributionDraft = useQuery(api.contributionDrafts.getForDraftKey, {
    draftKey: contributionDraftKey,
  });
  const smartStorageWizardSession = useQuery(
    api.smartStorage.getSessionSummary,
    activeSmartStorageSessionId === null
      ? "skip"
      : { contributionSubmissionId: activeSmartStorageSessionId },
  ) as SmartStorageSessionSummary | null | undefined;
  const handleSaveContributionDraft = useCallback(
    async (draft: ContributionEditorDraftInput) => {
      await saveContributionDraft({
        bodyDocumentJson: draft.bodyDocumentJson,
        bodyPlainText: draft.bodyPlainText,
        draftKey: contributionDraftKey,
        placementLabel: label,
        ...(draft.selectedKnowledgeType === undefined
          ? {}
          : { selectedKnowledgeType: draft.selectedKnowledgeType }),
        ...(selectedSlot?.id === undefined ? {} : { slotId: selectedSlot.id }),
        title: draft.title,
      });
    },
    [contributionDraftKey, label, saveContributionDraft, selectedSlot?.id],
  );
  const handleClearContributionDraft = useCallback(async () => {
    await clearContributionDraft({ draftKey: contributionDraftKey });
  }, [clearContributionDraft, contributionDraftKey]);

  useEffect(() => {
    setSelectedContributionSlotId(null);
    setSelectedContributionKnowledgeType(null);
    setFocusedCreatedEntry(null);
    setContextExpertScope("orbit");
    setSelectedContextExpertSubject(null);
    setSmartStorageProposalReview(null);
    setSmartStorageRunReview(null);
    setActiveSmartStorageSessionId(null);
    setIsSmartStorageWizardOpen(false);
    setSmartStorageExistingEntryTargets({});
    setQuoteAttributionPersonSearch(null);
    setLocalContextSearchQuery("");
    setNavigatorQueryText("");
  }, [activeContextKey]);

  useEffect(() => {
    if (
      selectedContributionKnowledgeType &&
      activeAllowedContributionTypes &&
      !activeAllowedContributionTypes.includes(selectedContributionKnowledgeType)
    ) {
      setSelectedContributionKnowledgeType(null);
    }
  }, [activeAllowedContributionTypeKey, selectedContributionKnowledgeType]);

  async function handleSubmitContribution(
    input: ContributionInput,
  ): Promise<ContributionResult> {
    recordNavigatorUsageEvent("contribute", input.contextTags);
    const result = await postDirectContribution({
      body: input.body,
      contextTags: input.contextTags,
      ...(input.externalUrls === undefined
        ? {}
        : { externalUrls: input.externalUrls }),
      knowledgeType: input.knowledgeType,
      ...(input.organizationReferentId === undefined
        ? {}
        : {
            organizationReferentId:
              input.organizationReferentId as Id<"referents">,
          }),
      ...(input.slotId === undefined ? {} : { slotId: input.slotId }),
      title: input.title,
      ...(input.uploadedFiles === undefined
        ? {}
        : { uploadedFiles: toConvexUploadedFiles(input.uploadedFiles) }),
    });

    setSmartStorageProposalReview(null);
    setSmartStorageRunReview(null);
    setActiveSmartStorageSessionId(null);
    setIsSmartStorageWizardOpen(false);
    setSmartStorageExistingEntryTargets({});
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
      ...(input.contributionNote === undefined
        ? {}
        : { contributionNote: input.contributionNote }),
      contextTags: input.contextTags,
      ...(input.externalUrls === undefined
        ? {}
        : { externalUrls: input.externalUrls }),
      knowledgeType: input.knowledgeType,
      ...(input.slotId === undefined ? {} : { slotId: input.slotId }),
      title: input.title,
      ...(input.uploadedFiles === undefined
        ? {}
        : { uploadedFiles: toConvexUploadedFiles(input.uploadedFiles) }),
    });

    setSmartStorageProposalReview(null);
    setSmartStorageRunReview(null);
    setFocusedCreatedEntry(null);
    setSelectedContributionSlotId(null);
    setSelectedContributionKnowledgeType(null);
    setSmartStorageExistingEntryTargets({});
    setActiveSmartStorageSessionId(result.contributionSubmissionId);
    setIsSmartStorageWizardOpen(true);

    void continueSmartStorageModelFlow(result.smartStorageRunId);

    return {
      contributionSubmissionId: result.contributionSubmissionId,
      smartStorageRunId: result.smartStorageRunId,
      sourceId: result.sourceId,
      sourceIds: result.sourceIds,
      status: "submitted",
    };
  }

  async function continueSmartStorageModelFlow(
    smartStorageRunId: Id<"smartStorageRuns">,
  ) {
    try {
      await executeSmartStorageModelRun({ smartStorageRunId });
    } catch {
      // Source preservation already succeeded; the session summary remains the
      // recovery surface if model execution fails before Convex records a run
      // outcome.
    } finally {
      refreshSmartStorageWizard((current) => current + 1);
    }
  }

  async function handleAcceptSmartStorageProposal(
    proposal: SmartStorageProposalReviewSummary,
    representationDecisions?: SmartStorageRepresentationDecision[],
    targetExistingEntryId?: string,
  ) {
    const result = await acceptSmartStorageProposal({
      smartStorageProposalId: proposal.id as Id<"smartStorageProposals">,
      ...(representationDecisions && representationDecisions.length > 0
        ? {
            representationDecisions: representationDecisions.map(
              (decision) => ({
                includeAsRepresentation: decision.includeAsRepresentation,
                isPrimary: decision.isPrimary,
                representationRole: decision.representationRole,
                sourceId: decision.sourceId as Id<"sources">,
              }),
            ),
          }
        : {}),
      ...(targetExistingEntryId === undefined
        ? {}
        : {
            targetExistingEntryId:
              targetExistingEntryId as Id<"knowledgeEntries">,
          }),
    });

    if (result.acceptanceStatus === "accepted" && result.entry) {
      setSmartStorageProposalReview(null);
      setSmartStorageRunReview(null);
      setFocusedCreatedEntry(result.entry);
      setSelectedContributionSlotId(null);
      setSelectedContributionKnowledgeType(null);
      return;
    }

    setFocusedCreatedEntry(null);
    setSmartStorageRunReview(null);
    setSmartStorageProposalReview({
      ...proposal,
      status: "needsResolution",
      ...(result.existingEntryId === undefined
        ? {}
        : { targetExistingEntryId: result.existingEntryId }),
    });
  }

  async function handleAcceptSmartStorageWizardProposal(
    proposal: SmartStorageSessionProposalSummary,
    representationDecisions?: SmartStorageRepresentationDecision[],
    targetExistingEntryId?: string,
  ) {
    if (
      proposal.referenceResolution?.mode === "knownReferentMatch" &&
      proposal.referenceResolution.candidateTagId !== undefined &&
      targetExistingEntryId === undefined
    ) {
      await confirmSmartStorageKnownReferent({
        smartStorageProposalId: proposal.id as Id<"smartStorageProposals">,
        tagId: proposal.referenceResolution.candidateTagId as Id<"tags">,
      });
      refreshSmartStorageWizard((current) => current + 1);
      return;
    }

    const result = await acceptSmartStorageProposal({
      smartStorageProposalId: proposal.id as Id<"smartStorageProposals">,
      ...(representationDecisions && representationDecisions.length > 0
        ? {
            representationDecisions: representationDecisions.map(
              (decision) => ({
                includeAsRepresentation: decision.includeAsRepresentation,
                isPrimary: decision.isPrimary,
                representationRole: decision.representationRole,
                sourceId: decision.sourceId as Id<"sources">,
              }),
            ),
          }
        : {}),
      ...(targetExistingEntryId === undefined
        ? {}
        : {
            targetExistingEntryId:
              targetExistingEntryId as Id<"knowledgeEntries">,
          }),
    });

    if (result.acceptanceStatus === "targetExists" && result.existingEntryId) {
      setSmartStorageExistingEntryTargets((current) => ({
        ...current,
        [proposal.id]: result.existingEntryId,
      }));
      refreshSmartStorageWizard((current) => current + 1);
      return;
    }

    setSmartStorageExistingEntryTargets((current) => {
      const next = { ...current };
      delete next[proposal.id];
      return next;
    });
    if (result.entry) {
      setFocusedCreatedEntry(result.entry);
    }
    refreshSmartStorageWizard((current) => current + 1);
  }

  async function handleCancelSmartStorageSession(
    session: SmartStorageSessionSummary,
  ) {
    await cancelSmartStorageSession({
      contributionSubmissionId:
        session.contributionSubmission.id as Id<"contributionSubmissions">,
    });
    setSmartStorageProposalReview(null);
    setSmartStorageRunReview(null);
    setActiveSmartStorageSessionId(null);
    setIsSmartStorageWizardOpen(false);
    setSmartStorageExistingEntryTargets({});
  }

  async function handleRequestSmartStorageRefresh(
    proposal: SmartStorageSessionProposalSummary,
  ) {
    await requestSmartStorageRefresh({
      smartStorageProposalId: proposal.id as Id<"smartStorageProposals">,
    });
    refreshSmartStorageWizard((current) => current + 1);
  }

  async function handleDismissSmartStorageRefresh(
    proposal: SmartStorageSessionProposalSummary,
  ) {
    await dismissSmartStorageRefresh({
      smartStorageProposalId: proposal.id as Id<"smartStorageProposals">,
    });
    refreshSmartStorageWizard((current) => current + 1);
  }

  function showSmartStorageProposalReview(
    proposalResult: Awaited<ReturnType<typeof generateSmartStorageProposal>>,
  ) {
    setFocusedCreatedEntry(null);
    setSmartStorageRunReview(null);
    setSmartStorageProposalReview({
      ...(proposalResult.contributionSubmissionId === undefined
        ? {}
        : { contributionSubmissionId: proposalResult.contributionSubmissionId }),
      currentProposal: proposalResult.currentProposal,
      id: proposalResult.smartStorageProposalId,
      ...(proposalResult.rawModelOutput === undefined
        ? {}
        : { rawModelOutput: proposalResult.rawModelOutput }),
      ...(proposalResult.rawModelRequest === undefined
        ? {}
        : { rawModelRequest: proposalResult.rawModelRequest }),
      smartStorageRunId: proposalResult.smartStorageRunId,
      sourceCitations: proposalResult.sourceCitations,
      sourceId: proposalResult.sourceId,
      sourceIds: proposalResult.sourceIds,
      status: proposalResult.status,
    });
  }

  async function handleGenerateSmartStorageScaffold(
    review: SmartStorageRunReviewSummary,
  ) {
    const proposalResult = await generateSmartStorageProposal({
      smartStorageRunId: review.smartStorageRunId as Id<"smartStorageRuns">,
    });

    showSmartStorageProposalReview(proposalResult);
  }

  async function handleCreateBasicSmartStorageProposal(
    session: SmartStorageSessionSummary,
  ) {
    const runId = session.latestRun?.id ?? session.activeRun?.id;
    if (!runId) {
      return;
    }

    await generateSmartStorageProposal({
      smartStorageRunId: runId as Id<"smartStorageRuns">,
    });
    refreshSmartStorageWizard((current) => current + 1);
  }

  async function handleRetrySmartStorageModelRun(
    session: SmartStorageSessionSummary,
  ) {
    const result = await retrySmartStorageModelRun({
      contributionSubmissionId:
        session.contributionSubmission.id as Id<"contributionSubmissions">,
    });
    refreshSmartStorageWizard((current) => current + 1);
    await continueSmartStorageModelFlow(result.smartStorageRunId);
  }

  function toConvexUploadedFiles(
    uploadedFiles: NonNullable<ContributionInput["uploadedFiles"]>,
  ) {
    return uploadedFiles.map((uploadedFile) => {
      const { storageId, temporaryUploadId, ...rest } = uploadedFile;

      return {
        ...rest,
        storageId: storageId as Id<"_storage">,
        ...(temporaryUploadId === undefined
          ? {}
          : { temporaryUploadId: temporaryUploadId as Id<"temporaryUploads"> }),
      };
    });
  }

  async function handleUploadSmartStorageFile(
    file: File,
  ): Promise<SmartStorageUploadedFileInput> {
    const { uploadUrl } = await generateSmartStorageUploadUrl({});
    const response = await fetch(uploadUrl, {
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Smart Storage file upload failed.");
    }

    const uploadResult = (await response.json()) as { storageId?: string };
    if (!uploadResult.storageId) {
      throw new Error("Smart Storage file upload did not return a storage ID.");
    }

    const temporaryUpload = await createSmartStorageTemporaryUploadRecord({
      ...(file.type ? { contentType: file.type } : {}),
      fileName: file.name,
      fileSizeBytes: file.size,
      storageId: uploadResult.storageId as Id<"_storage">,
    });

    return {
      ...(file.type ? { contentType: file.type } : {}),
      fileName: file.name,
      fileSizeBytes: file.size,
      storageId: uploadResult.storageId,
      temporaryUploadId: temporaryUpload.temporaryUploadId,
    };
  }

  async function handleAddKnowledgePageThumbnail(entryId: string, file: File) {
    const uploadedFile = await handleUploadSmartStorageFile(file);
    await addKnowledgePageThumbnail({
      entryId: entryId as Id<"knowledgeEntries">,
      uploadedFile: {
        ...(uploadedFile.contentType === undefined
          ? {}
          : { contentType: uploadedFile.contentType }),
        fileName: uploadedFile.fileName,
        ...(uploadedFile.fileSizeBytes === undefined
          ? {}
          : { fileSizeBytes: uploadedFile.fileSizeBytes }),
        ...(uploadedFile.languageCode === undefined
          ? {}
          : { languageCode: uploadedFile.languageCode }),
        storageId: uploadedFile.storageId as Id<"_storage">,
        ...(uploadedFile.temporaryUploadId === undefined
          ? {}
          : {
              temporaryUploadId:
                uploadedFile.temporaryUploadId as Id<"temporaryUploads">,
            }),
        ...(uploadedFile.title === undefined ? {} : { title: uploadedFile.title }),
      },
    });
  }

  async function handlePreviewDraftExternalUrl(
    url: string,
  ): Promise<DraftLinkPreviewResult> {
    return await previewDraftExternalUrl({ url });
  }

  function handleApplyMappedTags(mappedTags: ActiveTag[]) {
    setLocalContextSearchQuery("");
    recordNavigatorUsageEvent("select", mappedTags);
    onNavigateToHref(getCanonicalKnowledgeContextHref(mappedTags));
  }

  function handleSearchContext(query: string) {
    const searchQuery = query.trim();
    setLocalContextSearchQuery(searchQuery);
    if (!searchQuery) {
      return;
    }

    void recordSearchEvent({
      searchScope: "activeKnowledgeContext",
      searchText: searchQuery,
      activeTagKeys,
    }).catch(() => undefined);
  }

  function handleClearContextSearch() {
    if (routeId === "root-search") {
      onNavigateToHref("/");
      return;
    }

    setLocalContextSearchQuery("");
  }

  function handleContributeToSlot(slot: KnowledgeSlotSummary) {
    setSelectedContributionSlotId(slot.id);
  }

  function handleContextExpertSelect(expert: KnowledgeContextExpert) {
    setSelectedContextExpertSubject(getSelectedContextExpertSubject(expert));
  }

  function handleContextExpertDetailClose() {
    setSelectedContextExpertSubject(null);
  }

  function handleContextExpertScopeChange(scope: KnowledgeContextExpertScope) {
    setContextExpertScope(scope);
    setSelectedContextExpertSubject(null);
    setQuoteAttributionPersonSearch(null);
  }

  function handleQuoteAttributionPersonSearch(
    input: QuoteAttributionPersonSearchInput,
  ) {
    const searchQuery = input.searchQuery.trim();
    if (searchQuery.length < 2) {
      setQuoteAttributionPersonSearch(null);
      return;
    }

    setQuoteAttributionPersonSearch({
      entryId: input.entry.id,
      searchQuery,
    });
  }

  async function handleHumanWeightFeedback(input: HumanWeightFeedbackInput) {
    await recordHumanWeightFeedback({
      entryId: input.entry.id as Id<"knowledgeEntries">,
      feedbackKind: input.feedbackKind,
      ...(input.feedbackNote === undefined
        ? {}
        : { feedbackNote: input.feedbackNote }),
    });
  }

  async function handleCorrectQuoteAttribution(
    input: QuoteAttributionCorrectionInput,
  ) {
    await correctQuoteAttribution({
      entryId: input.entry.id as Id<"knowledgeEntries">,
      nextQuotedPersonReferentId:
        input.nextQuotedPersonReferentId === null
          ? null
          : (input.nextQuotedPersonReferentId as Id<"referents">),
    });
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
      <aside className="kb-rail-focus-context" aria-label="Knowledge context and search">
        {components.includes("knowledge-navigator") ? (
          <KnowledgeNavigator
            activeTagsOverride={activeTags}
            onNavigateToHref={onNavigateToHref}
            routeState={routeState}
            showHeader={showNavigatorHeader}
          >
            {components.includes("knowledge-request-composer") ? (
              <KnowledgeNavigatorQueryInput
                activeTags={activeTags}
                onApplyMappedTags={handleApplyMappedTags}
                onQueryTextChange={setNavigatorQueryText}
                onSearchContext={handleSearchContext}
                suggestions={navigatorQuerySuggestions}
              />
            ) : null}
          </KnowledgeNavigator>
        ) : null}
        {showSlotRail && components.includes("knowledge-slot-card") ? (
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
              <p className="kb-eyebrow">Context Search</p>
              <h2 id="kb-request-panel-heading">Search this Context</h2>
            </header>
            <KnowledgeNavigatorQueryInput
              activeTags={activeTags}
              onApplyMappedTags={handleApplyMappedTags}
              onQueryTextChange={setNavigatorQueryText}
              onSearchContext={handleSearchContext}
              suggestions={navigatorQuerySuggestions}
            />
          </section>
        ) : null}
      </aside>

      <section className="kb-rail-focus-workspace" aria-label="Contribute and read Answers">
        {showIdentityBand ? (
          <KnowledgePageIdentityBand
            activeTags={activeTags}
            dashboardMetrics={dashboardMetrics}
            label={label}
            onAddThumbnail={handleAddKnowledgePageThumbnail}
            pinnedKnowledgePages={pinnedKnowledgePages}
            referentMetadata={referentPageMetadata}
            routeId={routeId}
            target={knowledgePageActionTarget}
            thumbnailState={knowledgePageThumbnailState}
          />
        ) : null}
        {referentMetadataTag ? (
          <ReferentPageMetadataPanel
            metadata={referentPageMetadata}
            onNavigateToHref={onNavigateToHref}
          />
        ) : null}
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
            allowedContributionTypes={activeAllowedContributionTypes}
            context={contributionContext}
            draft={contributionDraft}
            draftKey={contributionDraftKey}
            guidedContributionType={activeGuidedContributionType}
            onClearDraft={handleClearContributionDraft}
            onDraftChange={handleSaveContributionDraft}
            onKnowledgeTypeChange={setSelectedContributionKnowledgeType}
            onNavigateToHref={onNavigateToHref}
            onPostDirect={handleSubmitContribution}
            onPreviewExternalUrl={handlePreviewDraftExternalUrl}
            onStoreSmartly={handleStoreSmartlyContribution}
            onUploadFile={handleUploadSmartStorageFile}
            organizationOptions={appAccess.organizations.map(
              (organization) => ({
                name: organization.name,
                organizationReferentId: organization.organizationReferentId,
              }),
            )}
            selectedKnowledgeType={activeSelectedContributionKnowledgeType}
            slot={selectedSlot}
          />
        ) : null}
        {isSmartStorageWizardOpen && activeSmartStorageSessionId !== null ? (
          <SmartStorageSessionWizard
            existingEntryTargets={smartStorageExistingEntryTargets}
            onAcceptProposal={handleAcceptSmartStorageWizardProposal}
            onCancelSession={handleCancelSmartStorageSession}
            onClose={() => setIsSmartStorageWizardOpen(false)}
            onCreateBasicProposal={handleCreateBasicSmartStorageProposal}
            onDismissRefresh={handleDismissSmartStorageRefresh}
            onNavigateToHref={onNavigateToHref}
            onRequestRefresh={handleRequestSmartStorageRefresh}
            onRetryModelRun={handleRetrySmartStorageModelRun}
            session={smartStorageWizardSession}
          />
        ) : null}
        {smartStorageProposalReview ? (
          <SmartStorageProposalReviewPanel
            onAccept={handleAcceptSmartStorageProposal}
            onNavigateToHref={onNavigateToHref}
            proposal={smartStorageProposalReview}
          />
        ) : null}
        {smartStorageRunReview ? (
          <SmartStorageRunReviewPanel
            onGenerateScaffold={handleGenerateSmartStorageScaffold}
            review={smartStorageRunReview}
          />
        ) : null}
        {focusedCreatedEntry ? (
          <CreatedEntryFocusPanel entry={focusedCreatedEntry} />
        ) : null}
        {components.includes("answer-feed") ? (
          routeId === "root-search" ? (
            <RootSearchResults
              isLoading={isRootSearchResultsLoading}
              onClearSearch={handleClearContextSearch}
              onNavigateToHref={onNavigateToHref}
              query={routeRootSearchQuery}
              results={rootSearchResults ?? []}
            />
          ) : (
            <AnswerFeedSurface
              activeTags={activeTags}
              contextExpertDetail={selectedContextExpertDetail ?? undefined}
              contextExpertDetailLoading={
                selectedContextExpertSubject !== null &&
                durableContextExperts !== undefined &&
                selectedContextExpertDetail === undefined
              }
              contextExpertScope={contextExpertScope}
              contextExperts={durableContextExperts}
              contextTrend={getVisibleContextTrend(contextTrend)}
              canCorrectQuoteAttribution={
                appAccess.systemRole === "systemAdmin" &&
                durableContextExperts !== undefined
              }
              filterByActiveTags={false}
              headingMode={showFeedHeading ? "visible" : "sr-only"}
              items={feedItems}
              layout="masonry"
              onContributeToSlot={handleContributeToSlot}
              onClearSearchQuery={handleClearContextSearch}
              onContextExpertDetailClose={handleContextExpertDetailClose}
              onContextExpertSelect={
                durableContextExperts === undefined
                  ? undefined
                  : handleContextExpertSelect
              }
              onContextExpertScopeChange={
                durableContextExperts === undefined
                  ? undefined
                  : handleContextExpertScopeChange
              }
              onCorrectQuoteAttribution={
                appAccess.systemRole === "systemAdmin" &&
                durableContextExperts !== undefined
                  ? handleCorrectQuoteAttribution
                  : undefined
              }
              onQuoteAttributionPersonSearchChange={
                appAccess.systemRole === "systemAdmin" &&
                durableContextExperts !== undefined
                  ? handleQuoteAttributionPersonSearch
                  : undefined
              }
              onHumanWeightFeedback={
                durableFeedItems === undefined
                  ? undefined
                  : handleHumanWeightFeedback
              }
              onNavigateToHref={onNavigateToHref}
              quoteAttributionPersonPicker={
                appAccess.systemRole === "systemAdmin" &&
                durableContextExperts !== undefined
                  ? quoteAttributionPersonPicker
                  : undefined
              }
              searchQuery={contextSearchQuery}
            />
          )
        ) : null}
      </section>
    </section>
  );
}

function KnowledgePageIdentityBand({
  activeTags,
  dashboardMetrics,
  label,
  onAddThumbnail,
  pinnedKnowledgePages,
  referentMetadata,
  routeId,
  target,
  thumbnailState,
}: {
  activeTags: ActiveTag[];
  dashboardMetrics?: DashboardMetric[];
  label: string;
  onAddThumbnail?: (entryId: string, file: File) => Promise<void>;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
  referentMetadata?: ReferentPageMetadata;
  routeId: PageId;
  target: KnowledgePageActionTarget | null;
  thumbnailState?: KnowledgePageThumbnailState;
}) {
  const identity = getKnowledgePageIdentity(routeId, label, activeTags);
  const singleActiveTag = activeTags.length === 1 ? activeTags[0] : null;
  const [thumbnailUploadState, setThumbnailUploadState] = useState<
    "idle" | "uploading" | "error"
  >("idle");
  const displayedThumbnailUrl =
    thumbnailState?.thumbnailUrl ??
    referentMetadata?.thumbnailUrl ??
    singleActiveTag?.thumbnailUrl;
  const canAddThumbnail =
    thumbnailState !== undefined &&
    thumbnailState !== null &&
    thumbnailState.thumbnailUrl === undefined &&
    displayedThumbnailUrl === undefined &&
    onAddThumbnail !== undefined &&
    singleActiveTag !== null &&
    supportsRepresentativeThumbnail(singleActiveTag.knowledgeType);

  async function handleThumbnailFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !canAddThumbnail) {
      return;
    }

    setThumbnailUploadState("uploading");
    try {
      await onAddThumbnail(thumbnailState.entryId, file);
      setThumbnailUploadState("idle");
    } catch {
      setThumbnailUploadState("error");
    }
  }

  return (
    <header
      aria-labelledby="kb-route-heading"
      className="kb-knowledge-page-identity"
      data-dashboard={routeId === "dashboard" ? "true" : undefined}
      data-knowledge-type={singleActiveTag?.knowledgeType}
    >
      <div className="kb-knowledge-page-title">
        <p className="kb-eyebrow">{identity.eyebrow}</p>
        <h1 id="kb-route-heading">{identity.title}</h1>
      </div>
      <div className="kb-knowledge-page-identity-side">
        {dashboardMetrics ? (
          <dl className="kb-dashboard-metrics" aria-label="Dashboard status">
            {dashboardMetrics.map((metric) => (
              <div key={metric.id}>
                <dt>{metric.label}</dt>
                <dd>{metric.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {displayedThumbnailUrl ? (
          <img
            alt=""
            className="kb-knowledge-page-thumbnail"
            src={displayedThumbnailUrl}
          />
        ) : null}
        <KnowledgePageActions
          pinnedKnowledgePages={pinnedKnowledgePages}
          target={target}
        />
        <div
          aria-label="Active Knowledge Context summary"
          className="kb-knowledge-page-context"
          data-knowledge-type={singleActiveTag?.knowledgeType}
        >
          {singleActiveTag ? (
            <KnowledgeTypeIcon knowledgeType={singleActiveTag.knowledgeType} />
          ) : null}
          <span>{identity.contextSummary}</span>
          <small>{identity.contextDetail}</small>
        </div>
        {canAddThumbnail ? (
          <label
            className="kb-knowledge-page-thumbnail-upload"
            data-upload-state={thumbnailUploadState}
          >
            {thumbnailUploadState === "uploading" ? (
              <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
            ) : (
              <ImagePlus aria-hidden="true" />
            )}
            <span>
              {thumbnailUploadState === "uploading"
                ? "Uploading"
                : "Add thumbnail"}
            </span>
            <input
              accept="image/*"
              aria-label={`Add representative thumbnail for ${thumbnailState.entryTitle}`}
              disabled={thumbnailUploadState === "uploading"}
              onChange={(event) => void handleThumbnailFileChange(event)}
              type="file"
            />
          </label>
        ) : null}
        {thumbnailUploadState === "error" ? (
          <p className="kb-knowledge-page-thumbnail-error" role="alert">
            Thumbnail upload failed.
          </p>
        ) : null}
      </div>
    </header>
  );
}

function ReferentPageMetadataPanel({
  metadata,
  onNavigateToHref,
}: {
  metadata: ReferentPageMetadata | undefined;
  onNavigateToHref: (href: string) => void;
}) {
  if (metadata === undefined) {
    return (
      <section className="kb-referent-metadata" aria-busy="true">
        <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
        <span>Loading referent details</span>
      </section>
    );
  }

  if (metadata === null) {
    return null;
  }

  function handleNavigate(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    event.preventDefault();
    onNavigateToHref(href);
  }

  return (
    <section
      className="kb-referent-metadata"
      data-knowledge-type={metadata.knowledgeType}
      aria-labelledby="kb-referent-metadata-heading"
    >
      <header className="kb-referent-metadata-header">
        <div>
          <p className="kb-eyebrow">Stored Referent Data</p>
          <h2 id="kb-referent-metadata-heading">{metadata.label}</h2>
        </div>
        {metadata.sourceUrl ? (
          <a
            className="kb-referent-source-link"
            href={metadata.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink aria-hidden="true" />
            <span>{metadata.sourceName ?? "Source"}</span>
          </a>
        ) : null}
      </header>

      {metadata.description ? (
        <p className="kb-referent-description">{metadata.description}</p>
      ) : null}

      {metadata.facts.length > 0 ? (
        <dl className="kb-referent-facts">
          {metadata.facts.map((fact) => (
            <div key={`${fact.label}:${fact.value}`}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {metadata.tags.length > 1 ? (
        <div className="kb-referent-aliases" aria-label="Referent tags">
          {metadata.tags.map((tag) => (
            <a
              data-knowledge-type={tag.knowledgeType}
              href={tag.href}
              key={tag.id}
              onClick={(event) => handleNavigate(event, tag.href)}
            >
              <ReferentTagVisual
                className="kb-tag-chip-visual"
                tag={tag}
              />
              <span>{tag.label}</span>
            </a>
          ))}
        </div>
      ) : null}

      {metadata.sections.map((section) => (
        <section
          className="kb-referent-relation-section"
          key={section.title}
          aria-labelledby={`kb-referent-section-${sanitizeDomId(section.title)}`}
        >
          <h3 id={`kb-referent-section-${sanitizeDomId(section.title)}`}>
            {section.title}
          </h3>
          <div className="kb-referent-relation-list">
            {section.items.map((item) => (
              <a
                data-knowledge-type={item.knowledgeType}
                href={item.href}
                key={item.id}
                onClick={(event) => handleNavigate(event, item.href)}
              >
                <ReferentTagVisual
                  className="kb-referent-relation-visual"
                  tag={{
                    canonicalKey: item.id,
                    href: item.href,
                    id: item.id,
                    knowledgeType: item.knowledgeType,
                    label: item.label,
                    ...(item.thumbnailUrl === undefined
                      ? {}
                      : { thumbnailUrl: item.thumbnailUrl }),
                  }}
                />
                <span>
                  <strong>{item.label}</strong>
                  {item.detail ? <small>{item.detail}</small> : null}
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function sanitizeDomId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-") || "section";
}

function getKnowledgePageIdentity(
  routeId: PageId,
  label: string,
  activeTags: ActiveTag[],
) {
  if (routeId === "dashboard") {
    return {
      contextDetail: "Accessible Root Knowledge Context",
      contextSummary: "All Accessible Knowledge",
      eyebrow: "Dashboard",
      title: "All Accessible Knowledge",
    };
  }

  if (routeId === "root-search") {
    return {
      contextDetail: "Accessible Root Knowledge Context",
      contextSummary: "All Accessible Knowledge",
      eyebrow: "Search",
      title: "Search Everything",
    };
  }

  if (activeTags.length === 1) {
    const activeTag = activeTags[0];

    return {
      contextDetail: formatKnowledgeTypeLabel(activeTag.knowledgeType),
      contextSummary: activeTag.label,
      eyebrow: routeId === "tag" ? "Referent Page" : "Knowledge Page",
      title: activeTag.label,
    };
  }

  if (activeTags.length > 1) {
    return {
      contextDetail: "Active Knowledge Context",
      contextSummary: formatCount(activeTags.length, "Tag"),
      eyebrow: "Context Page",
      title: activeTags.map((tag) => tag.label).join(", "),
    };
  }

  return {
    contextDetail: "Accessible Root Knowledge Context",
    contextSummary: "All Accessible Knowledge",
    eyebrow: label,
    title: label,
  };
}

function getKnowledgePageActionTarget({
  activeTags,
  label,
  organizations = [],
  routeId,
  routeState,
}: {
  activeTags: ActiveTag[];
  label: string;
  organizations?: AllowedAppAccess["organizations"];
  routeId: PageId;
  routeState: RouteState;
}): KnowledgePageActionTarget | null {
  if (routeId === "dashboard") {
    return null;
  }

  if (routeId === "root-search") {
    const searchQuery = getRootSearchQueryFromRoute(routeState);
    return {
      href: `${routeState.pathname}${routeState.search}`,
      label: searchQuery ? `Search: ${searchQuery}` : label,
      pageKey: searchQuery ? `search:${searchQuery}` : "search:root",
      pageKind: "search",
      secondaryLabel: "Search",
    };
  }

  if (routeId === "scripture" && activeTags.length === 1) {
    const activeTag = activeTags[0];
    return getBiblePassageActionTarget(activeTag);
  }

  if (routeId === "tag" && activeTags.length === 1) {
    const activeTag = activeTags[0];
    if (activeTag.knowledgeType === "biblePassage") {
      return getBiblePassageActionTarget(activeTag);
    }

    if (activeTag.knowledgeType === "organization") {
      const organization = findOrganizationMembershipForActiveTag(
        activeTag,
        organizations,
      );
      if (organization) {
        return {
          href: getOrganizationHomeHrefFromId(
            organization.organizationReferentId,
          ),
          label: organization.name,
          organizationReferentId: organization.organizationReferentId,
          pageKey: getOrganizationPageKey(
            organization.organizationReferentId,
          ),
          pageKind: "organization",
          secondaryLabel: formatOrganizationKind(
            organization.organizationKind,
          ),
        };
      }
    }

    return {
      href: activeTag.href,
      label: activeTag.label,
      pageKey: `referent:${activeTag.knowledgeType}:${activeTag.canonicalKey}`,
      pageKind: "referent",
      secondaryLabel: `${formatKnowledgeTypeLabel(activeTag.knowledgeType)} Referent`,
    };
  }

  if (routeId === "explore-context") {
    const contextKey = getKnowledgeContextKey(activeTags);
    return {
      href: getCanonicalKnowledgeContextHref(activeTags),
      label:
        activeTags.length > 0
          ? activeTags.map((tag) => tag.label).join(", ")
          : "Global Knowledge Context",
      pageKey: `context:${contextKey}`,
      pageKind: "context",
      secondaryLabel:
        activeTags.length > 0 ? formatCount(activeTags.length, "Tag") : "Context Page",
    };
  }

  return null;
}

function findOrganizationMembershipForActiveTag(
  activeTag: ActiveTag,
  organizations: AllowedAppAccess["organizations"],
) {
  for (const lookupValue of [
    activeTag.canonicalKey,
    activeTag.id,
    activeTag.label,
  ]) {
    const organization = findMatchingOrganizationMembership(
      lookupValue,
      organizations,
    );
    if (organization) {
      return organization;
    }
  }

  return undefined;
}

function getBiblePassageActionTarget(activeTag: ActiveTag): KnowledgePageActionTarget {
  return {
    href: activeTag.href,
    label: activeTag.label,
    pageKey: `scripture:${activeTag.canonicalKey}`,
    pageKind: "scripture",
    secondaryLabel: "Bible Passage",
  };
}

function getScriptureKnowledgePageActionTarget(passage: {
  canonicalKey: string;
  label: string;
  passageString?: string;
}): KnowledgePageActionTarget {
  const passageKey = passage.canonicalKey || passage.passageString || passage.label;

  return {
    href: `/scripture/${encodeURIComponent(passage.passageString ?? passageKey)}`,
    label: passage.label,
    pageKey: `scripture:${passageKey}`,
    pageKind: "scripture",
    secondaryLabel: "Bible Passage",
  };
}

type GenericKnowledgePageRelationshipInput = {
  href: string;
  label: string;
  pageKey: string;
  pageKind: Exclude<KnowledgePageRelationshipKind, "organization">;
  secondaryLabel: string;
};

function getGenericKnowledgePageRelationshipInput(
  target: KnowledgePageActionTarget,
): GenericKnowledgePageRelationshipInput {
  if (target.pageKind === "organization") {
    throw new Error("Organization Knowledge Pages use organization-specific relationships.");
  }

  return {
    href: target.href,
    label: target.label,
    pageKey: target.pageKey,
    pageKind: target.pageKind,
    secondaryLabel: target.secondaryLabel,
  };
}

function getKnowledgePageRelationshipIcon(kind: KnowledgePageRelationshipKind) {
  if (kind === "dashboard") {
    return LayoutDashboard;
  }
  if (kind === "scripture") {
    return BookOpen;
  }
  if (kind === "referent") {
    return Tag;
  }
  if (kind === "context") {
    return Compass;
  }
  if (kind === "search") {
    return Search;
  }

  return Landmark;
}

function getRootSearchQueryFromRoute(routeState: RouteState) {
  if (routeState.route.id !== "root-search") {
    return "";
  }

  return new URLSearchParams(routeState.search).get("q")?.trim() ?? "";
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

function SmartStorageSessionWizard({
  existingEntryTargets,
  onAcceptProposal,
  onCancelSession,
  onClose,
  onCreateBasicProposal,
  onDismissRefresh,
  onNavigateToHref,
  onRequestRefresh,
  onRetryModelRun,
  session,
}: {
  existingEntryTargets: Record<string, string>;
  onAcceptProposal: (
    proposal: SmartStorageSessionProposalSummary,
    representationDecisions?: SmartStorageRepresentationDecision[],
    targetExistingEntryId?: string,
  ) => Promise<void>;
  onCancelSession: (session: SmartStorageSessionSummary) => Promise<void>;
  onClose: () => void;
  onCreateBasicProposal: (session: SmartStorageSessionSummary) => Promise<void>;
  onDismissRefresh: (
    proposal: SmartStorageSessionProposalSummary,
  ) => Promise<void>;
  onNavigateToHref: (href: string) => void;
  onRequestRefresh: (
    proposal: SmartStorageSessionProposalSummary,
  ) => Promise<void>;
  onRetryModelRun: (session: SmartStorageSessionSummary) => Promise<void>;
  session: SmartStorageSessionSummary | null | undefined;
}) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const isLoading = session === undefined;
  const isUnavailable = session === null;
  const title = isLoading
    ? "Opening Smart Storage"
    : isUnavailable
      ? "Smart Storage unavailable"
      : getSmartStorageWizardTitle(session);

  async function handleCancelSession() {
    if (!session || !session.canCancel) {
      return;
    }

    setIsCancelling(true);
    try {
      await onCancelSession(session);
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="kb-smart-wizard-backdrop">
      <section
        aria-label="Smart Storage Session Wizard"
        aria-modal="true"
        className="kb-smart-wizard"
        role="dialog"
      >
        <header className="kb-smart-wizard-header">
          <div>
            <p className="kb-eyebrow">Smart Storage Session</p>
            <h2>{title}</h2>
          </div>
          <div className="kb-smart-wizard-header-actions">
            {session ? (
              <>
                <SmartStorageWizardSourceCounts session={session} />
                <button
                  className="kb-smart-wizard-evidence-button"
                  onClick={() => setIsEvidenceOpen(true)}
                  type="button"
                >
                  <Database aria-hidden="true" />
                  <span>Evidence</span>
                </button>
              </>
            ) : null}
            <button
              aria-label="Finish later"
              className="kb-pinned-overflow-dialog-close"
              onClick={onClose}
              title="Finish later"
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        {isLoading ? (
          <section className="kb-smart-wizard-empty" role="status">
            <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
            <span>Loading preserved Sources</span>
          </section>
        ) : null}

        {isUnavailable ? (
          <section className="kb-smart-wizard-empty" role="status">
            Smart Storage session unavailable.
          </section>
        ) : null}

        {session ? (
          <>
            <SmartStorageWizardProgress session={session} />
            {shouldShowSmartStorageRunSummary(session) ? (
              <SmartStorageWizardRunSummary session={session} />
            ) : null}
            {isFailedOrNoProposalSmartStorageSession(session) ? (
              <SmartStorageWizardFallbackPanel
                isCancelling={isCancelling}
                onCancelSession={handleCancelSession}
                onClose={onClose}
                onCreateBasicProposal={onCreateBasicProposal}
                onRetryModelRun={onRetryModelRun}
                session={session}
              />
            ) : (
              <SmartStorageWizardReview
                existingEntryTargets={existingEntryTargets}
                isCancelling={isCancelling}
                onAcceptProposal={onAcceptProposal}
                onCancelSession={handleCancelSession}
                onDismissRefresh={onDismissRefresh}
                onClose={onClose}
                onNavigateToHref={onNavigateToHref}
                onRequestRefresh={onRequestRefresh}
                session={session}
              />
            )}
            {isEvidenceOpen ? (
              <SmartStorageWizardEvidenceDrawer
                onClose={() => setIsEvidenceOpen(false)}
                session={session}
              />
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}

function SmartStorageWizardSourceCounts({
  session,
}: {
  session: SmartStorageSessionSummary;
}) {
  const sourceCounts = [
    { count: session.sourceCounts.pastedText, label: "Text" },
    { count: session.sourceCounts.uploadedFile, label: "File" },
    { count: session.sourceCounts.externalUrl, label: "URL" },
    { count: session.sourceCounts.manualEntry, label: "Manual" },
  ].filter((item) => item.count > 0);

  return (
    <div className="kb-smart-wizard-sources" aria-label="Bronze Sources saved">
      <span className="kb-smart-wizard-source-status">
        <Database aria-hidden="true" />
        <strong>{formatCount(session.sourceCounts.total, "Source")}</strong>
        <span className="kb-sr-only">
          Sources saved. Bronze Layer preserved before proposal generation.
        </span>
      </span>
      {sourceCounts.map((item) => (
        <span key={item.label}>
          <strong>{item.count}</strong> {item.label}
        </span>
      ))}
    </div>
  );
}

function SmartStorageWizardProgress({
  session,
}: {
  session: SmartStorageSessionSummary;
}) {
  const hasPrimarySaved = session.acceptedPrimaryEntry !== undefined;
  const isRecovering = isFailedOrNoProposalSmartStorageSession(session);
  const isPreparing = session.activeRun !== undefined;
  const setupStageState =
    isRecovering || isPreparing || session.state === "awaitingPrerequisites"
      ? "active"
      : hasPrimarySaved || session.state === "primaryReady"
        ? "done"
        : "pending";
  const primaryState = hasPrimarySaved
    ? "done"
    : session.state === "primaryReady"
      ? "active"
      : "pending";
  const reviewSlotState =
    session.state === "reviewPending"
      ? "active"
      : session.state === "complete"
        ? "done"
        : "pending";

  return (
    <ol className="kb-smart-wizard-steps" aria-label="Smart Storage progress">
      <li data-state="done">
        <Check aria-hidden="true" />
        <span>
          <strong>Sources saved</strong>
          <small>{formatCount(session.sourceCounts.total, "Source")} saved</small>
        </span>
      </li>
      <li data-state={setupStageState}>
        {isPreparing ? (
          <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
        ) : isRecovering ? (
          <AlertTriangle aria-hidden="true" />
        ) : (
          <Shield aria-hidden="true" />
        )}
        <span>
          <strong>
            {isPreparing
              ? "Preparing"
              : isRecovering
                ? "Recovery"
                : "Required setup"}
          </strong>
          <small>
            {isPreparing
              ? formatSmartStorageRunStatus(
                  session.activeRun?.status ?? "queued",
                )
              : isRecovering
                ? "Sources remain safe"
                : session.prerequisiteProposals.length > 0
                  ? formatCount(
                      session.prerequisiteProposals.length,
                      "required item",
                    )
                  : "No prerequisites"}
          </small>
        </span>
      </li>
      <li data-state={primaryState}>
        <BookOpen aria-hidden="true" />
        <span>
          <strong>Primary</strong>
          <small>{formatSmartStorageSessionState(session.state)}</small>
        </span>
      </li>
      <li data-state={reviewSlotState}>
        <ListTodo aria-hidden="true" />
        <span>
          <strong>Review Slots</strong>
          <small>
            {session.pendingSecondaryProposals.length > 0
              ? formatCount(session.pendingSecondaryProposals.length, "Review Slot")
              : "None pending"}
          </small>
        </span>
      </li>
    </ol>
  );
}

function SmartStorageWizardRunSummary({
  session,
}: {
  session: SmartStorageSessionSummary;
}) {
  const run = session.activeRun ?? session.latestRun;
  const runStatus = run ? formatSmartStorageRunStatus(run.status) : "Waiting";
  const returnedLabel = getSmartStorageRunReturnedLabel(session);

  return (
    <section
      aria-label="Smart Storage AI result"
      className="kb-smart-wizard-run-summary"
      role={session.activeRun ? "status" : undefined}
    >
      <header>
        {session.activeRun ? (
          <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
        ) : session.latestRun?.status === "failed" ? (
          <AlertTriangle aria-hidden="true" />
        ) : (
          <Sparkles aria-hidden="true" />
        )}
        <span>
          <strong>AI result</strong>
          <small>{getSmartStorageRunSummaryCopy(session)}</small>
        </span>
      </header>
      <dl>
        <div>
          <dt>Run status</dt>
          <dd>{runStatus}</dd>
        </div>
        <div>
          <dt>Returned</dt>
          <dd>{returnedLabel}</dd>
        </div>
        <div>
          <dt>Reviewable proposals</dt>
          <dd>{session.proposalCountsByStatus.total}</dd>
        </div>
      </dl>
    </section>
  );
}

function SmartStorageWizardFallbackPanel({
  isCancelling,
  onCancelSession,
  onClose,
  onCreateBasicProposal,
  onRetryModelRun,
  session,
}: {
  isCancelling: boolean;
  onCancelSession: () => Promise<void>;
  onClose: () => void;
  onCreateBasicProposal: (session: SmartStorageSessionSummary) => Promise<void>;
  onRetryModelRun: (session: SmartStorageSessionSummary) => Promise<void>;
  session: SmartStorageSessionSummary;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const latestRun = session.latestRun;
  const isNoProposal = latestRun?.status === "noProposal";
  const canCancelSession = session.canCancel;

  async function handleCreateBasicProposal() {
    setIsCreating(true);
    try {
      await onCreateBasicProposal(session);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRetryModelRun() {
    setIsRetrying(true);
    try {
      await onRetryModelRun(session);
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <section className="kb-smart-wizard-fallback" aria-label="Preserved Sources without proposal">
      <header>
        <AlertTriangle aria-hidden="true" />
        <div>
          <h3>{isNoProposal ? "No proposal was created" : "Proposal generation failed"}</h3>
          <p>
            Sources were saved. Review can continue from a basic proposal when
            model generation does not produce a Primary Intended Entry.
          </p>
        </div>
      </header>
      {latestRun?.errorMessage ? (
        <p className="kb-smart-run-error">{latestRun.errorMessage}</p>
      ) : null}
      <footer className="kb-smart-wizard-actions">
        <button
          disabled={isRetrying}
          onClick={() => void handleRetryModelRun()}
          type="button"
        >
          {isRetrying ? (
            <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          ) : (
            <RotateCcw aria-hidden="true" />
          )}
          <span>{isRetrying ? "Retrying model" : "Retry model"}</span>
        </button>
        <button
          className="kb-card-action-primary"
          disabled={isCreating}
          onClick={() => void handleCreateBasicProposal()}
          type="button"
        >
          {isCreating ? (
            <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          <span>Create basic proposal</span>
        </button>
        <button onClick={onClose} type="button">
          <Clock aria-hidden="true" />
          <span>Finish later</span>
        </button>
        {canCancelSession ? (
          <button
            disabled={isCancelling}
            onClick={() => void onCancelSession()}
            type="button"
          >
            <X aria-hidden="true" />
            <span>{isCancelling ? "Cancelling" : "Cancel session"}</span>
          </button>
        ) : null}
      </footer>
    </section>
  );
}

function SmartStorageWizardReview({
  existingEntryTargets,
  isCancelling,
  onAcceptProposal,
  onCancelSession,
  onClose,
  onDismissRefresh,
  onNavigateToHref,
  onRequestRefresh,
  session,
}: {
  existingEntryTargets: Record<string, string>;
  isCancelling: boolean;
  onAcceptProposal: (
    proposal: SmartStorageSessionProposalSummary,
    representationDecisions?: SmartStorageRepresentationDecision[],
    targetExistingEntryId?: string,
  ) => Promise<void>;
  onCancelSession: () => Promise<void>;
  onClose: () => void;
  onDismissRefresh: (
    proposal: SmartStorageSessionProposalSummary,
  ) => Promise<void>;
  onNavigateToHref: (href: string) => void;
  onRequestRefresh: (
    proposal: SmartStorageSessionProposalSummary,
  ) => Promise<void>;
  session: SmartStorageSessionSummary;
}) {
  const hasPrimarySaved = session.acceptedPrimaryEntry !== undefined;
  const hasPrerequisiteProposals = session.prerequisiteProposals.length > 0;
  const activePrerequisiteProposal = session.prerequisiteProposals[0];
  const remainingPrerequisiteCount = Math.max(
    session.prerequisiteProposals.length - 1,
    0,
  );
  const canCancelSession = session.canCancel;
  const [isContinuationOpen, setIsContinuationOpen] = useState(false);

  if (hasPrimarySaved) {
    return (
      <div className="kb-smart-wizard-review kb-smart-wizard-review-saved">
        <SmartStorageWizardSavedEntryFocus
          onNavigateToHref={onNavigateToHref}
          session={session}
        />

        <SmartStorageWizardContinuationBar
          existingEntryTargets={existingEntryTargets}
          isOpen={isContinuationOpen}
          onAcceptProposal={onAcceptProposal}
          onDismissRefresh={onDismissRefresh}
          onNavigateToHref={onNavigateToHref}
          onRequestRefresh={onRequestRefresh}
          onToggleOpen={() => setIsContinuationOpen((current) => !current)}
          proposals={session.pendingSecondaryProposals}
        />

        <footer className="kb-smart-wizard-sticky-actions kb-smart-wizard-actions">
          <button onClick={onClose} type="button">
            <Clock aria-hidden="true" />
            <span>Finish later</span>
          </button>
          {canCancelSession ? (
            <button
              disabled={isCancelling}
              onClick={() => void onCancelSession()}
              type="button"
            >
              <X aria-hidden="true" />
              <span>{isCancelling ? "Cancelling" : "Cancel session"}</span>
            </button>
          ) : null}
        </footer>
      </div>
    );
  }

  return (
    <div className="kb-smart-wizard-review">
      <section className="kb-smart-wizard-main" aria-label="Required Smart Storage review">
        {activePrerequisiteProposal ? (
          <SmartStorageWizardProposalCard
            existingEntryId={existingEntryTargets[activePrerequisiteProposal.id]}
            onAccept={onAcceptProposal}
            onDismissRefresh={onDismissRefresh}
            onNavigateToHref={onNavigateToHref}
            onRequestRefresh={onRequestRefresh}
            proposal={activePrerequisiteProposal}
            tone="prerequisite"
          />
        ) : null}

        {remainingPrerequisiteCount > 0 ? (
          <section
            aria-label="Remaining prerequisite proposals"
            className="kb-smart-wizard-setup-queue"
          >
            <Shield aria-hidden="true" />
            <span>
              <strong>
                {formatCount(
                  remainingPrerequisiteCount,
                  "required item",
                )}{" "}
                {remainingPrerequisiteCount === 1 ? "remains" : "remain"}
              </strong>
              <small>
                Review one prerequisite at a time before the Primary Intended
                Entry unlocks.
              </small>
            </span>
          </section>
        ) : null}

        {hasPrerequisiteProposals && session.primaryProposal ? (
          <SmartStorageWizardLockedPrimarySummary
            proposal={session.primaryProposal}
          />
        ) : session.primaryProposal ? (
          <SmartStorageWizardProposalCard
            existingEntryId={existingEntryTargets[session.primaryProposal.id]}
            onAccept={onAcceptProposal}
            onDismissRefresh={onDismissRefresh}
            onNavigateToHref={onNavigateToHref}
            onRequestRefresh={onRequestRefresh}
            proposal={session.primaryProposal}
            tone="primary"
          />
        ) : (
          <section className="kb-smart-wizard-empty" role="status">
            {session.activeRun
              ? "Preparing the Primary Intended Entry."
              : "No Primary Intended Entry is ready yet."}
          </section>
        )}

        {session.pendingSecondaryProposals.length > 0 ? (
          <SmartStorageWizardQuietNext
            proposals={session.pendingSecondaryProposals}
          />
        ) : null}
      </section>

      {canCancelSession ? (
        <footer className="kb-smart-wizard-sticky-actions kb-smart-wizard-review-actions kb-smart-wizard-actions">
          <button onClick={onClose} type="button">
            <Clock aria-hidden="true" />
            <span>Finish later</span>
          </button>
          <button
            disabled={isCancelling}
            onClick={() => void onCancelSession()}
            type="button"
          >
            <X aria-hidden="true" />
            <span>{isCancelling ? "Cancelling" : "Cancel session"}</span>
          </button>
        </footer>
      ) : null}
    </div>
  );
}

function SmartStorageWizardSavedEntryFocus({
  onNavigateToHref,
  session,
}: {
  onNavigateToHref: (href: string) => void;
  session: SmartStorageSessionSummary;
}) {
  const entry = session.acceptedPrimaryEntry;
  if (entry === undefined) {
    return null;
  }
  const acceptedEntry = entry;

  function handleEntryClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onNavigateToHref(acceptedEntry.href);
  }

  return (
    <section className="kb-smart-wizard-entry-focus" aria-label="Entry Saved">
      <div>
        <p className="kb-eyebrow">Entry Saved</p>
        <h3>
          <a href={acceptedEntry.href} onClick={handleEntryClick}>
            {acceptedEntry.title}
          </a>
        </h3>
        <p>{acceptedEntry.previewText}</p>
      </div>
      <KnowledgeTypeBadge
        className="kb-smart-proposal-type"
        knowledgeType={acceptedEntry.knowledgeType}
      />
    </section>
  );
}

function SmartStorageWizardLockedPrimarySummary({
  proposal,
}: {
  proposal: SmartStorageSessionProposalSummary;
}) {
  return (
    <article
      aria-label="Locked Primary Intended Entry"
      className="kb-smart-wizard-locked-primary"
    >
      <Shield aria-hidden="true" />
      <span>
        <strong>{proposal.currentProposal.title}</strong>
        <small>
          Primary unlocks after required setup. Review Slots stay secondary
          until this Gold anchor exists.
        </small>
      </span>
      <KnowledgeTypeBadge
        className="kb-smart-proposal-type"
        knowledgeType={proposal.currentProposal.knowledgeType}
      />
    </article>
  );
}

function SmartStorageWizardQuietNext({
  proposals,
}: {
  proposals: SmartStorageSessionProposalSummary[];
}) {
  const firstProposal = proposals[0];

  return (
    <section
      aria-label="Later Smart Storage review"
      className="kb-smart-wizard-quiet-next"
    >
      <ListTodo aria-hidden="true" />
      <span>
        <strong>Later review work</strong>
        <small>
          {formatCount(proposals.length, "Review Slot")}
          {firstProposal ? `, starting with ${firstProposal.currentProposal.title}` : ""}
        </small>
      </span>
    </section>
  );
}

function SmartStorageWizardContinuationBar({
  existingEntryTargets,
  isOpen,
  onAcceptProposal,
  onDismissRefresh,
  onNavigateToHref,
  onRequestRefresh,
  onToggleOpen,
  proposals,
}: {
  existingEntryTargets: Record<string, string>;
  isOpen: boolean;
  onAcceptProposal: (
    proposal: SmartStorageSessionProposalSummary,
    representationDecisions?: SmartStorageRepresentationDecision[],
    targetExistingEntryId?: string,
  ) => Promise<void>;
  onDismissRefresh: (
    proposal: SmartStorageSessionProposalSummary,
  ) => Promise<void>;
  onNavigateToHref: (href: string) => void;
  onRequestRefresh: (
    proposal: SmartStorageSessionProposalSummary,
  ) => Promise<void>;
  onToggleOpen: () => void;
  proposals: SmartStorageSessionProposalSummary[];
}) {
  const firstProposal = proposals[0];

  if (proposals.length === 0) {
    return (
      <section
        aria-label="Smart Storage continuation"
        className="kb-smart-wizard-continuation"
      >
        <div>
          <Check aria-hidden="true" />
          <span>
            <strong>Smart Storage review complete</strong>
            <small>No remaining Review Slots for this session.</small>
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Smart Storage continuation"
      className="kb-smart-wizard-continuation"
      data-open={isOpen ? "true" : undefined}
    >
      <div>
        <ListTodo aria-hidden="true" />
        <span>
          <strong>Later review work</strong>
          <small>
            {formatCount(proposals.length, "Review Slot")} remain
            {firstProposal ? `, starting with ${firstProposal.currentProposal.title}` : ""}
          </small>
        </span>
      </div>
      <button onClick={onToggleOpen} type="button">
        {isOpen ? "Hide review" : "Continue review"}
      </button>
      {isOpen ? (
        <ol>
          {firstProposal ? (
            <li key={firstProposal.id}>
              <SmartStorageWizardProposalCard
                existingEntryId={existingEntryTargets[firstProposal.id]}
                onAccept={onAcceptProposal}
                onDismissRefresh={onDismissRefresh}
                onNavigateToHref={onNavigateToHref}
                onRequestRefresh={onRequestRefresh}
                proposal={firstProposal}
                tone="secondary"
              />
            </li>
          ) : null}
        </ol>
      ) : null}
    </section>
  );
}

function SmartStorageWizardEvidenceDrawer({
  onClose,
  session,
}: {
  onClose: () => void;
  session: SmartStorageSessionSummary;
}) {
  const proposals = getSmartStorageSessionEvidenceProposals(session);

  return (
    <aside
      aria-label="Smart Storage source evidence"
      className="kb-smart-wizard-evidence-drawer"
    >
      <header>
        <div>
          <p className="kb-eyebrow">Evidence</p>
          <h3>Source support</h3>
        </div>
        <button aria-label="Close source evidence" onClick={onClose} type="button">
          <X aria-hidden="true" />
        </button>
      </header>
      {proposals.length > 0 ? (
        <ol>
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <header>
                <span>
                  <strong>{proposal.currentProposal.title}</strong>
                  <small>{formatSmartStorageProposalRole(proposal.role)}</small>
                </span>
                <KnowledgeTypeBadge
                  className="kb-smart-proposal-type"
                  knowledgeType={proposal.currentProposal.knowledgeType}
                />
              </header>
              {proposal.sourceCitations.length > 0 ? (
                <ul className="kb-smart-proposal-citations">
                  {proposal.sourceCitations.map((citation, index) => (
                    <li key={citation.id}>
                      <strong>
                        {formatSourceCitationKind(citation.citationKind)} {index + 1}
                      </strong>
                      <small>
                        {citation.excerptText ??
                          citation.locator ??
                          citation.externalUrl ??
                          citation.rationale ??
                          "Submitted Source"}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No Source citations are attached to this proposal.</p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p>No proposal evidence is available yet.</p>
      )}
    </aside>
  );
}

function SmartStorageWizardProposalCard({
  existingEntryId,
  onAccept,
  onDismissRefresh,
  onNavigateToHref,
  onRequestRefresh,
  proposal,
  tone,
}: {
  existingEntryId?: string;
  onAccept: (
    proposal: SmartStorageSessionProposalSummary,
    representationDecisions?: SmartStorageRepresentationDecision[],
    targetExistingEntryId?: string,
  ) => Promise<void>;
  onDismissRefresh: (
    proposal: SmartStorageSessionProposalSummary,
  ) => Promise<void>;
  onNavigateToHref: (href: string) => void;
  onRequestRefresh: (
    proposal: SmartStorageSessionProposalSummary,
  ) => Promise<void>;
  proposal: SmartStorageSessionProposalSummary;
  tone: "primary" | "prerequisite" | "secondary";
}) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDismissingRefresh, setIsDismissingRefresh] = useState(false);
  const [isRequestingRefresh, setIsRequestingRefresh] = useState(false);
  const [representationDecisions, setRepresentationDecisions] = useState<
    SmartStorageRepresentationDecision[]
  >(() => getInitialRepresentationDecisions(proposal));
  const citationSourceIdsKey = proposal.sourceCitations
    .map(
      (citation) =>
        `${citation.sourceId}:${citation.citationKind}:${citation.locator ?? ""}:${citation.externalUrl ?? ""}`,
    )
    .join("|");
  const currentProposal = proposal.currentProposal;
  const hasSelectableCitations = proposal.sourceCitations.length > 0;
  const representationDecisionBySourceId = new Map(
    representationDecisions.map((decision) => [decision.sourceId, decision]),
  );
  const includedRepresentationDecisions = representationDecisions.filter(
    (decision) => decision.includeAsRepresentation,
  );
  const hasPrimaryRepresentation = includedRepresentationDecisions.some(
    (decision) => decision.isPrimary,
  );
  const isTargetExisting =
    proposal.status === "needsResolution" && existingEntryId !== undefined;
  const canAccept =
    proposal.acceptability.status === "ready" || isTargetExisting;
  const isStaleRefresh = proposal.status === "stale" && proposal.refresh;
  const disablesAccept =
    isAccepting ||
    !canAccept ||
    (hasSelectableCitations &&
      (includedRepresentationDecisions.length === 0 || !hasPrimaryRepresentation));

  useEffect(() => {
    setRepresentationDecisions(getInitialRepresentationDecisions(proposal));
  }, [proposal.id, citationSourceIdsKey]);

  function handleTagClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    onNavigateToHref(href);
  }

  async function handleAcceptProposal() {
    setIsAccepting(true);
    try {
      await onAccept(
        proposal,
        hasSelectableCitations ? representationDecisions : undefined,
        isTargetExisting ? existingEntryId : undefined,
      );
    } finally {
      setIsAccepting(false);
    }
  }

  async function handleRequestRefresh() {
    setIsRequestingRefresh(true);
    try {
      await onRequestRefresh(proposal);
    } finally {
      setIsRequestingRefresh(false);
    }
  }

  async function handleDismissRefresh() {
    setIsDismissingRefresh(true);
    try {
      await onDismissRefresh(proposal);
    } finally {
      setIsDismissingRefresh(false);
    }
  }

  function handleSourceSelectionChange(sourceId: string, selected: boolean) {
    setRepresentationDecisions((current) =>
      setRepresentationDecisionInclusion(current, sourceId, selected),
    );
  }

  function handleRepresentationRoleChange(
    sourceId: string,
    representationRole: string,
  ) {
    if (!isRepresentationRole(representationRole)) {
      return;
    }

    setRepresentationDecisions((current) =>
      current.map((decision) =>
        decision.sourceId === sourceId
          ? { ...decision, representationRole }
          : decision,
      ),
    );
  }

  function handlePrimaryRepresentationChange(sourceId: string) {
    setRepresentationDecisions((current) =>
      setPrimaryRepresentationDecision(current, sourceId),
    );
  }

  return (
    <article className="kb-smart-wizard-proposal" data-tone={tone}>
      <header>
        <div>
          <p className="kb-eyebrow">{formatSmartStorageProposalRole(proposal.role)}</p>
          <h3>{currentProposal.title}</h3>
        </div>
        <KnowledgeTypeBadge
          className="kb-smart-proposal-type"
          knowledgeType={currentProposal.knowledgeType}
        />
      </header>

      <p>{currentProposal.bodyPreview}</p>
      <dl className="kb-smart-proposal-meta">
        <div>
          <dt>Proposal Confidence</dt>
          <dd>{formatProposalConfidence(currentProposal.proposalConfidence)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{formatSmartStorageProposalAcceptability(proposal)}</dd>
        </div>
      </dl>

      {proposal.dependency ? (
        <p className="kb-smart-wizard-dependency">
          Requires {proposal.dependency.label}
        </p>
      ) : null}

      {proposal.referenceResolution ? (
        <p className="kb-smart-wizard-dependency">
          {formatSmartStorageReferenceResolution(proposal.referenceResolution)}
        </p>
      ) : null}

      {proposal.refresh ? (
        <p className="kb-smart-wizard-dependency">
          {proposal.refresh.originLabel}: {proposal.refresh.reason}
        </p>
      ) : null}

      {currentProposal.contextTags.length > 0 ? (
        <ul
          aria-label={`${currentProposal.title} context Tags`}
          className="kb-smart-proposal-tags"
        >
          {currentProposal.contextTags.map((tag) => (
            <li key={tag.id}>
              <a
                data-knowledge-type={tag.knowledgeType}
                href={tag.href}
                onClick={(event) => handleTagClick(event, tag.href)}
              >
                <ReferentTagVisual tag={tag} />
                <span>{tag.label}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {proposal.sourceCitations.length > 0 ? (
        <details className="kb-smart-proposal-evidence">
          <summary>
            <Database aria-hidden="true" />
            <span>Evidence and representations</span>
          </summary>
          <ul
            aria-label={`${currentProposal.title} Source citations`}
            className="kb-smart-proposal-citations"
          >
            {proposal.sourceCitations.map((citation, index) => {
              const decision = representationDecisionBySourceId.get(citation.sourceId) ?? {
                includeAsRepresentation: false,
                isPrimary: false,
                representationRole: getDefaultRepresentationRole(citation),
                sourceId: citation.sourceId,
              };
              const sourceLabel = `${formatSourceCitationKind(citation.citationKind)} ${
                index + 1
              }`;

              return (
                <li key={citation.id}>
                  <label className="kb-smart-proposal-citation-toggle">
                    <input
                      checked={decision.includeAsRepresentation}
                      onChange={(event) =>
                        handleSourceSelectionChange(
                          citation.sourceId,
                          event.currentTarget.checked,
                        )
                      }
                      type="checkbox"
                    />
                    <span className="kb-smart-proposal-citation-copy">
                      <strong>{formatSourceCitationKind(citation.citationKind)}</strong>
                      <small>
                        {citation.excerptText ??
                          citation.locator ??
                          citation.externalUrl ??
                          citation.rationale ??
                          "Submitted Source"}
                      </small>
                    </span>
                  </label>
                  <div className="kb-smart-proposal-citation-controls">
                    <label className="kb-smart-proposal-role-field">
                      <span>Representation Role</span>
                      <select
                        aria-label={`Representation Role for ${sourceLabel}`}
                        disabled={!decision.includeAsRepresentation}
                        onChange={(event) =>
                          handleRepresentationRoleChange(
                            citation.sourceId,
                            event.currentTarget.value,
                          )
                        }
                        value={decision.representationRole}
                      >
                        {REPRESENTATION_ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {formatRepresentationRole(role)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="kb-smart-proposal-primary-field">
                      <input
                        checked={decision.isPrimary}
                        disabled={!decision.includeAsRepresentation}
                        name={`primary-representation-${proposal.id}`}
                        onChange={() =>
                          handlePrimaryRepresentationChange(citation.sourceId)
                        }
                        type="radio"
                      />
                      <span>Primary Representation</span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      <footer className="kb-smart-wizard-actions kb-smart-wizard-proposal-actions">
        {isStaleRefresh ? (
          <button
            className="kb-card-action-primary"
            disabled={isRequestingRefresh}
            onClick={() => void handleRequestRefresh()}
            type="button"
          >
            {isRequestingRefresh ? (
              <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
            ) : (
              <RotateCcw aria-hidden="true" />
            )}
            <span>
              {isRequestingRefresh
                ? "Refreshing"
                : `Request ${proposal.refresh?.originLabel ?? "Refresh"}`}
            </span>
          </button>
        ) : (
          <button
            className="kb-card-action-primary"
            disabled={disablesAccept}
            onClick={() => void handleAcceptProposal()}
            type="button"
          >
            {isAccepting ? (
              <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
            ) : (
              <Check aria-hidden="true" />
            )}
            <span>{getSmartStorageWizardAcceptLabel(proposal, isTargetExisting)}</span>
          </button>
        )}
        {proposal.refresh ? (
          <button
            disabled={isDismissingRefresh}
            onClick={() => void handleDismissRefresh()}
            type="button"
          >
            <X aria-hidden="true" />
            <span>{isDismissingRefresh ? "Dismissing" : "Dismiss"}</span>
          </button>
        ) : null}
      </footer>
    </article>
  );
}

function getSmartStorageWizardTitle(session: SmartStorageSessionSummary) {
  if (isFailedOrNoProposalSmartStorageSession(session)) {
    return "Sources Saved";
  }
  if (session.state === "awaitingPrerequisites") {
    return "Accept Prerequisites First";
  }
  if (session.state === "primaryReady") {
    return "Primary Intended Entry Ready";
  }
  if (session.state === "primarySaved" || session.state === "reviewPending") {
    return "Entry Saved";
  }
  if (session.state === "complete") {
    return "Smart Storage Complete";
  }
  return "Preparing Primary Proposal";
}

function getSmartStorageSessionEvidenceProposals(
  session: SmartStorageSessionSummary,
) {
  return [
    ...session.prerequisiteProposals,
    ...(session.primaryProposal === undefined ? [] : [session.primaryProposal]),
    ...session.pendingSecondaryProposals,
  ];
}

function isFailedOrNoProposalSmartStorageSession(
  session: SmartStorageSessionSummary,
) {
  return (
    session.primaryProposal === undefined &&
    (session.latestRun?.status === "failed" ||
      session.latestRun?.status === "noProposal")
  );
}

function shouldShowSmartStorageRunSummary(session: SmartStorageSessionSummary) {
  return (
    session.activeRun !== undefined ||
    isFailedOrNoProposalSmartStorageSession(session)
  );
}

function getSmartStorageRunReturnedLabel(session: SmartStorageSessionSummary) {
  if (session.activeRun) {
    return "Still working";
  }
  if (session.latestRun?.status === "failed") {
    return "Generation failure";
  }
  if (session.latestRun?.status === "noProposal") {
    return "No structured proposal";
  }
  if (session.primaryProposal) {
    return formatSmartStorageProposalRole(session.primaryProposal.role);
  }
  if (session.proposalCountsByStatus.total > 0) {
    return formatCount(session.proposalCountsByStatus.total, "proposal");
  }

  return "No proposal yet";
}

function getSmartStorageRunSummaryCopy(session: SmartStorageSessionSummary) {
  if (session.activeRun) {
    return "Sources are saved; proposal generation is still running.";
  }
  if (session.latestRun?.status === "failed") {
    return "The agent failed to create a proposal; Sources remain saved.";
  }
  if (session.latestRun?.status === "noProposal") {
    return "The agent returned no structured proposal; Sources remain saved.";
  }
  if (session.primaryProposal) {
    return `Returned ${formatSmartStorageProposalRole(
      session.primaryProposal.role,
    )} for review.`;
  }
  if (session.proposalCountsByStatus.total > 0) {
    return `${formatCount(
      session.proposalCountsByStatus.total,
      "proposal",
    )} returned for review.`;
  }

  return "Waiting for Smart Storage output.";
}

function formatSmartStorageRunStatus(
  status: NonNullable<SmartStorageSessionSummary["latestRun"]>["status"],
) {
  const labels = {
    failed: "Failed",
    noProposal: "No proposal",
    queued: "Queued",
    running: "Running",
    succeeded: "Proposal ready",
    superseded: "Superseded",
  } satisfies Record<NonNullable<SmartStorageSessionSummary["latestRun"]>["status"], string>;

  return labels[status];
}

function formatSmartStorageSessionState(state: SmartStorageSessionSummary["state"]) {
  const labels = {
    awaitingPrerequisites: "Prerequisites required",
    cancelled: "Cancelled",
    complete: "Complete",
    preservingSources: "Saving Sources",
    preparingPrimaryProposal: "Preparing",
    primaryReady: "Ready",
    primarySaved: "Saved",
    reviewPending: "Later review pending",
    sourcePreservationFailed: "Source preservation failed",
  } satisfies Record<SmartStorageSessionSummary["state"], string>;

  return labels[state];
}

function formatSmartStorageProposalRole(
  role: SmartStorageSessionProposalSummary["role"],
) {
  const labels = {
    cleanup: "Cleanup Proposal",
    primary: "Primary Intended Entry",
    prerequisite: "Prerequisite Proposal",
    referenceResolution: "Reference Resolution",
    refresh: "Refresh Proposal",
    reprocessing: "Reprocessing Proposal",
    secondary: "Secondary Proposal",
  } satisfies Record<SmartStorageSessionProposalSummary["role"], string>;

  return labels[role];
}

function formatSmartStorageProposalAcceptability(
  proposal: SmartStorageSessionProposalSummary,
) {
  if (proposal.status === "accepted") {
    return "Accepted";
  }
  if (proposal.acceptability.status === "ready") {
    return "Accept-ready";
  }
  if (proposal.acceptability.status === "needsResolution") {
    return "Needs resolution";
  }
  if (proposal.acceptability.status === "closed") {
    return "Closed";
  }
  if (proposal.acceptability.reason === "prerequisitesPending") {
    return "Blocked by prerequisite";
  }
  if (proposal.acceptability.reason === "primaryAnchorRequired") {
    return "Waiting for Primary Entry";
  }
  if (proposal.acceptability.reason === "resolutionRequired") {
    return "Needs resolution";
  }

  return "Blocked";
}

function formatSmartStorageReferenceResolution(
  resolution: NonNullable<
    SmartStorageSessionProposalSummary["referenceResolution"]
  >,
) {
  if (resolution.mode === "knownReferentMatch") {
    const tag = resolution.resolvedTag ?? resolution.candidateTag ?? resolution.requiredTag;
    return `Known Referent match: ${tag.label}`;
  }

  return `New Entry creates Referent: ${formatKnowledgeTypeLabel(
    resolution.requiredTag.knowledgeType,
  )} - ${resolution.requiredTag.label}`;
}

function getSmartStorageWizardAcceptLabel(
  proposal: SmartStorageSessionProposalSummary,
  isTargetExisting: boolean,
) {
  if (isTargetExisting) {
    return "Add to Existing Entry";
  }
  if (proposal.role === "primary") {
    return "Accept Primary Entry";
  }
  if (proposal.role === "prerequisite") {
    return "Accept Prerequisite";
  }
  if (proposal.role === "referenceResolution") {
    return proposal.referenceResolution?.mode === "knownReferentMatch"
      ? "Confirm Known Referent"
      : "Accept Reference Entry";
  }

  return "Accept Proposal";
}

// Review panels render durable Convex run/proposal state without mutating it
// until the user explicitly accepts a proposal.
function SmartStorageRunReviewPanel({
  onGenerateScaffold,
  review,
}: {
  onGenerateScaffold: (review: SmartStorageRunReviewSummary) => Promise<void>;
  review: SmartStorageRunReviewSummary;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const isFailed = review.status === "failed";

  async function handleGenerateScaffold() {
    setIsGenerating(true);
    try {
      await onGenerateScaffold(review);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section
      aria-label="Smart Storage Run status"
      className="kb-smart-run-review"
      role="status"
    >
      <header>
        <div>
          <p className="kb-eyebrow">Smart Storage Run</p>
          <h2>
            {isFailed ? "Model Proposal Failed" : "No Structured Proposal Found"}
          </h2>
        </div>
      </header>

      <p className="kb-smart-run-body">
        {isFailed
          ? "The model proposal generation failed."
          : "No structured proposal was returned."}{" "}
        Source preserved as Bronze Layer material.
      </p>

      {review.errorMessage ? (
        <p className="kb-smart-run-error">{review.errorMessage}</p>
      ) : null}

      <SmartStorageModelDebugPanel
        rawModelOutput={review.rawModelOutput}
        rawModelRequest={review.rawModelRequest}
      />

      <footer className="kb-smart-proposal-actions">
        <button
          className="kb-card-action kb-card-action-primary"
          disabled={isGenerating}
          onClick={() => void handleGenerateScaffold()}
          type="button"
        >
          {isGenerating ? (
            <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          ) : (
            <Sparkles aria-hidden="true" />
          )}
          <span>Generate Scaffold Proposal</span>
        </button>
      </footer>
    </section>
  );
}

function SmartStorageModelDebugPanel({
  rawModelOutput,
  rawModelRequest,
}: {
  rawModelOutput?: string;
  rawModelRequest?: string;
}) {
  if (!rawModelRequest && !rawModelOutput) {
    return null;
  }

  return (
    <details className="kb-smart-model-debug">
      <summary>OpenAI Diagnostics</summary>
      {rawModelRequest ? (
        <section aria-label="OpenAI request body">
          <h3>Request</h3>
          <pre>
            <code>{rawModelRequest}</code>
          </pre>
        </section>
      ) : null}
      {rawModelOutput ? (
        <section aria-label="OpenAI response body">
          <h3>Response</h3>
          <pre>
            <code>{rawModelOutput}</code>
          </pre>
        </section>
      ) : null}
    </details>
  );
}

function SmartStorageProposalReviewPanel({
  onAccept,
  onNavigateToHref,
  proposal,
}: {
  onAccept: (
    proposal: SmartStorageProposalReviewSummary,
    representationDecisions?: SmartStorageRepresentationDecision[],
    targetExistingEntryId?: string,
  ) => Promise<void>;
  onNavigateToHref: (href: string) => void;
  proposal: SmartStorageProposalReviewSummary;
}) {
  const currentProposal = proposal.currentProposal;
  const [isAccepting, setIsAccepting] = useState(false);
  const [representationDecisions, setRepresentationDecisions] = useState<
    SmartStorageRepresentationDecision[]
  >(() =>
    getInitialRepresentationDecisions(proposal),
  );
  const citationSourceIdsKey = proposal.sourceCitations
    .map(
      (citation) =>
        `${citation.sourceId}:${citation.citationKind}:${citation.locator ?? ""}:${citation.externalUrl ?? ""}`,
    )
    .join("|");
  const representationDecisionBySourceId = new Map(
    representationDecisions.map((decision) => [decision.sourceId, decision]),
  );
  const includedRepresentationDecisions = representationDecisions.filter(
    (decision) => decision.includeAsRepresentation,
  );
  const hasSelectableCitations = proposal.sourceCitations.length > 0;
  const isTargetExisting =
    proposal.status === "needsResolution" &&
    proposal.targetExistingEntryId !== undefined;
  const hasPrimaryRepresentation = includedRepresentationDecisions.some(
    (decision) => decision.isPrimary,
  );
  const disablesAccept =
    isAccepting ||
    proposal.status === "accepted" ||
    (hasSelectableCitations &&
      (includedRepresentationDecisions.length === 0 || !hasPrimaryRepresentation));

  useEffect(() => {
    setRepresentationDecisions(getInitialRepresentationDecisions(proposal));
  }, [proposal.id, citationSourceIdsKey]);

  function handleTagClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    event.preventDefault();
    onNavigateToHref(href);
  }

  async function handleAcceptProposal() {
    setIsAccepting(true);
    try {
      await onAccept(
        proposal,
        hasSelectableCitations ? representationDecisions : undefined,
        isTargetExisting ? proposal.targetExistingEntryId : undefined,
      );
    } finally {
      setIsAccepting(false);
    }
  }

  function handleSourceSelectionChange(sourceId: string, selected: boolean) {
    setRepresentationDecisions((current) =>
      setRepresentationDecisionInclusion(current, sourceId, selected),
    );
  }

  function handleRepresentationRoleChange(
    sourceId: string,
    representationRole: string,
  ) {
    if (!isRepresentationRole(representationRole)) {
      return;
    }

    setRepresentationDecisions((current) =>
      current.map((decision) =>
        decision.sourceId === sourceId
          ? { ...decision, representationRole }
          : decision,
      ),
    );
  }

  function handlePrimaryRepresentationChange(sourceId: string) {
    setRepresentationDecisions((current) =>
      setPrimaryRepresentationDecision(current, sourceId),
    );
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
        <KnowledgeTypeBadge
          className="kb-smart-proposal-type"
          knowledgeType={currentProposal.knowledgeType}
        />
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
          <dd>{formatSmartStorageProposalStatus(proposal)}</dd>
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
                data-knowledge-type={tag.knowledgeType}
                href={tag.href}
                onClick={(event) => handleTagClick(event, tag.href)}
              >
                <ReferentTagVisual tag={tag} />
                <span>{tag.label}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {proposal.sourceCitations.length > 0 ? (
        <ul
          aria-label="Smart Storage Proposal Source citations"
          className="kb-smart-proposal-citations"
        >
          {proposal.sourceCitations.map((citation, index) => {
            const decision = representationDecisionBySourceId.get(citation.sourceId) ?? {
              includeAsRepresentation: false,
              isPrimary: false,
              representationRole: getDefaultRepresentationRole(citation),
              sourceId: citation.sourceId,
            };
            const sourceLabel = `${formatSourceCitationKind(citation.citationKind)} ${
              index + 1
            }`;

            return (
            <li key={citation.id}>
              <label className="kb-smart-proposal-citation-toggle">
                <input
                  checked={decision.includeAsRepresentation}
                  onChange={(event) =>
                    handleSourceSelectionChange(
                      citation.sourceId,
                      event.currentTarget.checked,
                    )
                  }
                  type="checkbox"
                />
                <span className="kb-smart-proposal-citation-copy">
                  <strong>{formatSourceCitationKind(citation.citationKind)}</strong>
                  <small>
                    {citation.excerptText ??
                      citation.locator ??
                      citation.externalUrl ??
                      citation.rationale ??
                      "Submitted Source"}
                  </small>
                </span>
              </label>
              <div className="kb-smart-proposal-citation-controls">
                <label className="kb-smart-proposal-role-field">
                  <span>Representation Role</span>
                  <select
                    aria-label={`Representation Role for ${sourceLabel}`}
                    disabled={!decision.includeAsRepresentation}
                    onChange={(event) =>
                      handleRepresentationRoleChange(
                        citation.sourceId,
                        event.currentTarget.value,
                      )
                    }
                    value={decision.representationRole}
                  >
                    {REPRESENTATION_ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {formatRepresentationRole(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="kb-smart-proposal-primary-field">
                  <input
                    checked={decision.isPrimary}
                    disabled={!decision.includeAsRepresentation}
                    name={`primary-representation-${proposal.id}`}
                    onChange={() =>
                      handlePrimaryRepresentationChange(citation.sourceId)
                    }
                    type="radio"
                  />
                  <span>Primary Representation</span>
                </label>
              </div>
            </li>
            );
          })}
        </ul>
      ) : null}

      <SmartStorageModelDebugPanel
        rawModelOutput={proposal.rawModelOutput}
        rawModelRequest={proposal.rawModelRequest}
      />

      <footer className="kb-smart-proposal-actions">
        <button
          className="kb-card-action kb-card-action-primary"
          disabled={disablesAccept}
          onClick={() => void handleAcceptProposal()}
          type="button"
        >
          {isAccepting ? (
            <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          ) : (
            <Check aria-hidden="true" />
          )}
          <span>{isTargetExisting ? "Add to Existing Entry" : "Accept Proposal"}</span>
        </button>
      </footer>
    </section>
  );
}

function formatSmartStorageProposalStatus(
  proposal: SmartStorageProposalReviewSummary,
) {
  if (proposal.status === "needsResolution" && proposal.targetExistingEntryId) {
    return "Target Exists";
  }

  if (proposal.status === "accepted") {
    return "Accepted";
  }

  return "Draft Proposal";
}

function getInitialRepresentationDecisions(
  proposal: { sourceCitations: SmartStorageProposalSourceCitationSummary[] },
): SmartStorageRepresentationDecision[] {
  const decisions: SmartStorageRepresentationDecision[] = [];
  const seenSourceIds = new Set<string>();

  for (const citation of proposal.sourceCitations) {
    if (seenSourceIds.has(citation.sourceId)) {
      continue;
    }

    seenSourceIds.add(citation.sourceId);
    decisions.push({
      includeAsRepresentation: true,
      isPrimary: decisions.length === 0,
      representationRole: getDefaultRepresentationRole(citation),
      sourceId: citation.sourceId,
    });
  }

  return decisions;
}

function setRepresentationDecisionInclusion(
  decisions: SmartStorageRepresentationDecision[],
  sourceId: string,
  includeAsRepresentation: boolean,
) {
  const updated = decisions.map((decision) =>
    decision.sourceId === sourceId
      ? {
          ...decision,
          includeAsRepresentation,
          isPrimary: includeAsRepresentation ? decision.isPrimary : false,
        }
      : decision,
  );

  if (
    includeAsRepresentation &&
    !updated.some((decision) => decision.includeAsRepresentation && decision.isPrimary)
  ) {
    return updated.map((decision) =>
      decision.sourceId === sourceId ? { ...decision, isPrimary: true } : decision,
    );
  }

  if (
    !includeAsRepresentation &&
    !updated.some((decision) => decision.includeAsRepresentation && decision.isPrimary)
  ) {
    const fallbackPrimary = updated.find(
      (decision) => decision.includeAsRepresentation,
    );

    if (fallbackPrimary) {
      return updated.map((decision) =>
        decision.sourceId === fallbackPrimary.sourceId
          ? { ...decision, isPrimary: true }
          : decision,
      );
    }
  }

  return updated;
}

function setPrimaryRepresentationDecision(
  decisions: SmartStorageRepresentationDecision[],
  sourceId: string,
) {
  return decisions.map((decision) =>
    decision.sourceId === sourceId
      ? { ...decision, includeAsRepresentation: true, isPrimary: true }
      : { ...decision, isPrimary: false },
  );
}

function getDefaultRepresentationRole(
  citation: SmartStorageProposalSourceCitationSummary,
): RepresentationRole {
  if (citation.citationKind === "externalUrl") {
    return "supportingMaterial";
  }

  if (citation.citationKind === "fileLocator") {
    return inferFileRepresentationRoleFromLocator(citation.locator);
  }

  return "primaryContent";
}

function inferFileRepresentationRoleFromLocator(locator?: string): RepresentationRole {
  const value = locator?.toLowerCase() ?? "";

  if (
    value.endsWith(".mp3") ||
    value.endsWith(".mp4") ||
    value.endsWith(".mov") ||
    value.endsWith(".m4a") ||
    value.endsWith(".wav") ||
    value.endsWith(".webm")
  ) {
    return "recording";
  }

  if (
    value.endsWith(".ppt") ||
    value.endsWith(".pptx") ||
    value.endsWith(".key")
  ) {
    return "slides";
  }

  if (
    value.endsWith(".jpg") ||
    value.endsWith(".jpeg") ||
    value.endsWith(".png") ||
    value.endsWith(".gif") ||
    value.endsWith(".webp")
  ) {
    return "thumbnail";
  }

  if (value.includes("transcript")) {
    return "transcript";
  }

  if (value.includes("manuscript")) {
    return "manuscript";
  }

  return "supportingMaterial";
}

function isRepresentationRole(value: string): value is RepresentationRole {
  return (REPRESENTATION_ROLE_OPTIONS as readonly string[]).includes(value);
}

function formatRepresentationRole(role: RepresentationRole) {
  const labels = {
    manuscript: "Manuscript",
    primaryContent: "Primary Content",
    recording: "Recording",
    slides: "Slides",
    supportingMaterial: "Supporting Material",
    thumbnail: "Thumbnail",
    transcript: "Transcript",
    unspecified: "Unspecified",
  } satisfies Record<RepresentationRole, string>;

  return labels[role];
}

function formatSourceCitationKind(
  citationKind: SmartStorageProposalSourceCitationSummary["citationKind"],
) {
  const labels = {
    externalUrl: "External URL",
    fileLocator: "File",
    textExcerpt: "Text Excerpt",
    wholeSource: "Whole Source",
  } satisfies Record<typeof citationKind, string>;

  return labels[citationKind];
}

function formatProposalConfidence(
  proposalConfidence: SmartStorageSessionProposalSummary["currentProposal"]["proposalConfidence"],
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
          New{" "}
          <KnowledgeTypeBadge
            className="kb-created-entry-type"
            knowledgeType={entry.knowledgeType}
          />{" "}
          entry in focus for immediate edits.
        </p>
      </div>
      <a className="kb-created-entry-focus-action" href={entry.href}>
        Edit Entry
      </a>
    </section>
  );
}

function getAllowedContributionTypesForPlacement({
  guidedContributionType,
  routeAllowedContributionTypes,
  slot,
}: {
  guidedContributionType?: GuidedContributionType | null;
  routeAllowedContributionTypes?: readonly AuthorableKnowledgeType[];
  slot?: KnowledgeSlotSummary;
}): readonly AuthorableKnowledgeType[] | undefined {
  if (slot) {
    return [slot.requestedKnowledgeType];
  }

  if (guidedContributionType) {
    return [guidedContributionType];
  }

  return routeAllowedContributionTypes;
}

function getSelectedContributionKnowledgeTypeWithinAllowedTypes({
  allowedContributionTypes,
  focusedCreatedEntry,
  routeContributionKnowledgeType,
  selectedContributionKnowledgeType,
}: {
  allowedContributionTypes?: readonly AuthorableKnowledgeType[];
  focusedCreatedEntry: KnowledgeEntrySummary | null;
  routeContributionKnowledgeType: AuthorableKnowledgeType | null;
  selectedContributionKnowledgeType: AuthorableKnowledgeType | null;
}): AuthorableKnowledgeType | null {
  const selectedKnowledgeType = focusedCreatedEntry
    ? selectedContributionKnowledgeType
    : selectedContributionKnowledgeType ?? routeContributionKnowledgeType;

  if (!selectedKnowledgeType) {
    return null;
  }

  if (
    allowedContributionTypes &&
    !allowedContributionTypes.includes(selectedKnowledgeType)
  ) {
    return null;
  }

  return selectedKnowledgeType;
}

function getAllowedContributionTypeKey(
  allowedContributionTypes?: readonly AuthorableKnowledgeType[],
) {
  return allowedContributionTypes === undefined
    ? "generic"
    : allowedContributionTypes.join("\n");
}

function getContributionDraftKey({
  allowedContributionTypeKey,
  contextKey,
  focusedEntryId,
  guidedContributionType,
  routeId,
  slotId,
}: {
  allowedContributionTypeKey: string;
  contextKey: string;
  focusedEntryId?: string;
  guidedContributionType?: GuidedContributionType | null;
  routeId: PageId;
  slotId?: string | null;
}) {
  return [
    "contribution-editor",
    routeId,
    contextKey,
    slotId ? `slot:${slotId}` : "slot:none",
    focusedEntryId ? `entry:${focusedEntryId}` : "entry:none",
    guidedContributionType ? `guided:${guidedContributionType}` : "guided:none",
    `types:${allowedContributionTypeKey}`,
  ]
    .map(encodeContributionDraftKeyPart)
    .join("|");
}

function encodeContributionDraftKeyPart(value: string) {
  return value.replaceAll("|", "%7C").replaceAll("\n", ",");
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
  const roleLabels = getAppRoleLabels(appAccess);
  const primaryOrganization = appAccess.organizations[0];
  const bookmarkedKnowledgePages = useQuery(
    api.bookmarkedKnowledgePages.listForProfile,
    {},
  );
  const profileContextExpertise = useQuery(
    api.contextExpertise.listCurrentUserProfileContextExpertise,
    { limit: 5 },
  ) as ProfileContextExpertise | undefined;
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
          <strong>{roleLabels[0] ?? "Member"}</strong>
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
              <dd>{roleLabels.join(", ") || "Member"}</dd>
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
              <dd>
                {appAccess.systemRole === "systemAdmin"
                  ? "System Admin"
                  : "Organization member"}
              </dd>
            </div>
          </dl>
          <SignOutButton />
        </aside>
      </section>

      <section
        className="kb-profile-panel kb-profile-context-expertise"
        aria-label="Profile Context Expertise"
        aria-labelledby="kb-profile-context-expertise-heading"
      >
        <header>
          <div>
            <p className="kb-eyebrow">Knowledge Contexts</p>
            <h2 id="kb-profile-context-expertise-heading">Context Expertise</h2>
          </div>
          <TrendingUp aria-hidden="true" />
        </header>

        {profileContextExpertise === undefined ? (
          <p className="kb-profile-empty">Loading Context Expertise.</p>
        ) : profileContextExpertise.rows.length > 0 ? (
          <ul className="kb-profile-context-expertise-list">
            {profileContextExpertise.rows.map((row) => {
              const contextHref = getCanonicalKnowledgeContextHref(row.contextTags);
              const contextLabel = getProfileContextExpertiseLabel(row.contextTags);
              const nonPostSignalCount = Math.max(
                0,
                row.evidenceCount - row.postCount,
              );

              return (
                <li key={row.aggregateId}>
                  <a
                    data-knowledge-type={
                      row.contextTags.length === 1
                        ? row.contextTags[0].knowledgeType
                        : undefined
                    }
                    href={contextHref}
                    onClick={(event) => onNavigate(event, contextHref)}
                  >
                    {row.contextTags.length === 1 ? (
                      <ReferentTagVisual tag={row.contextTags[0]} />
                    ) : (
                      <Tag aria-hidden="true" />
                    )}
                    <span>
                      <strong>{contextLabel}</strong>
                      <small>{formatProfileContextTypes(row.contextTags)}</small>
                    </span>
                  </a>
                  <div className="kb-profile-context-expertise-meta">
                    <span>{formatCount(row.postCount, "post")}</span>
                    <span>{formatCount(nonPostSignalCount, "signal")}</span>
                    <span>
                      {formatProfileContextExpertiseMaturity(
                        row.contextExpertiseMaturity,
                      )}
                    </span>
                    <time dateTime={new Date(row.latestEvidenceAt).toISOString()}>
                      {PROFILE_CONTEXT_EXPERTISE_TIME_FORMATTER.format(
                        new Date(row.latestEvidenceAt),
                      )}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="kb-profile-empty">No Context Expertise evidence yet.</p>
        )}
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
              const BookmarkIcon = getBookmarkedKnowledgePageIcon(bookmark);

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
  const contextExpertiseVisibilitySettings = useQuery(
    api.contextExpertiseSettings.getCurrentUserSettings,
    {},
  ) as ContextExpertiseVisibilitySettings | undefined;
  const updateGlobalExpertVisibility = useMutation(
    api.contextExpertiseSettings.updateGlobalExpertVisibility,
  );
  const [
    optimisticGlobalExpertVisibilityEnabled,
    setOptimisticGlobalExpertVisibilityEnabled,
  ] = useState<boolean | null>(null);
  const globalExpertVisibilityEnabled =
    optimisticGlobalExpertVisibilityEnabled ??
    contextExpertiseVisibilitySettings?.globalExpertVisibilityEnabled ??
    false;

  useEffect(() => {
    setOptimisticGlobalExpertVisibilityEnabled(null);
  }, [contextExpertiseVisibilitySettings?.globalExpertVisibilityEnabled]);

  function handleToggleGlobalExpertVisibility() {
    const enabled = !globalExpertVisibilityEnabled;
    setOptimisticGlobalExpertVisibilityEnabled(enabled);
    void updateGlobalExpertVisibility({ enabled }).catch(() => {
      setOptimisticGlobalExpertVisibilityEnabled(null);
    });
  }

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

        <ContactIdentitySettingsPanel />

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

        <section
          className="kb-settings-panel"
          aria-labelledby="kb-settings-context-expertise-heading"
        >
          <header>
            <Users aria-hidden="true" />
            <div>
              <p className="kb-eyebrow">Visibility</p>
              <h2 id="kb-settings-context-expertise-heading">
                Context Expertise
              </h2>
            </div>
          </header>
          <button
            aria-checked={globalExpertVisibilityEnabled}
            aria-label={`${
              globalExpertVisibilityEnabled ? "Disable" : "Enable"
            } Global Expert Visibility`}
            className="kb-settings-switch"
            onClick={handleToggleGlobalExpertVisibility}
            role="switch"
            type="button"
          >
            <span aria-hidden="true" />
            <span>Global Expert Visibility</span>
            <strong>{globalExpertVisibilityEnabled ? "On" : "Off"}</strong>
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

function ContactIdentitySettingsPanel() {
  const contactIdentitySettings = useQuery(
    api.contactIdentities.listForCurrentUser,
    {},
  ) as ContactIdentitySettings | undefined;
  const sendEmailVerificationCode = useAction(
    api.contactIdentities.sendEmailVerificationCode,
  );
  const verifyEmailAndClaimPendingMemberships = useMutation(
    api.contactIdentities.verifyEmailAndClaimPendingMemberships,
  );
  const claimVerifiedEmailMemberships = useMutation(
    api.contactIdentities.claimVerifiedEmailMemberships,
  );
  const [contactIdentityEmail, setContactIdentityEmail] = useState("");
  const [contactIdentityCode, setContactIdentityCode] = useState("");
  const [requestedContactIdentityEmail, setRequestedContactIdentityEmail] =
    useState<string | null>(null);
  const [contactIdentityStatus, setContactIdentityStatus] =
    useState<string | null>(null);
  const [contactIdentityError, setContactIdentityError] =
    useState<string | null>(null);
  const [isRequestingContactIdentityCode, setIsRequestingContactIdentityCode] =
    useState(false);
  const [isVerifyingContactIdentityCode, setIsVerifyingContactIdentityCode] =
    useState(false);
  const normalizedContactIdentityEmail = contactIdentityEmail.trim();
  const canRequestContactIdentityCode =
    normalizedContactIdentityEmail.length > 0 &&
    !isRequestingContactIdentityCode &&
    !isVerifyingContactIdentityCode;
  const canVerifyContactIdentityCode =
    normalizedContactIdentityEmail.length > 0 &&
    contactIdentityCode.trim().length > 0 &&
    requestedContactIdentityEmail !== null &&
    !isRequestingContactIdentityCode &&
    !isVerifyingContactIdentityCode;

  async function handleRequestContactIdentityCode(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!canRequestContactIdentityCode) {
      return;
    }

    setContactIdentityError(null);
    setContactIdentityStatus(null);
    setIsRequestingContactIdentityCode(true);
    try {
      const result = await sendEmailVerificationCode({
        email: normalizedContactIdentityEmail,
      });
      setContactIdentityEmail(result.email);
      setRequestedContactIdentityEmail(result.email);
      setContactIdentityCode("");
      if (result.verificationStatus === "verified") {
        const claimed = (await claimVerifiedEmailMemberships({
          email: result.email,
        })) as ClaimResultSummary;
        setContactIdentityStatus(formatClaimResult(claimed));
      } else {
        setContactIdentityStatus("Verification code requested.");
      }
    } catch (error) {
      setContactIdentityError(getSettingsErrorMessage(error));
    } finally {
      setIsRequestingContactIdentityCode(false);
    }
  }

  async function handleVerifyContactIdentityCode(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!canVerifyContactIdentityCode) {
      return;
    }

    setContactIdentityError(null);
    setContactIdentityStatus(null);
    setIsVerifyingContactIdentityCode(true);
    try {
      const result = (await verifyEmailAndClaimPendingMemberships({
        code: contactIdentityCode,
        email: normalizedContactIdentityEmail,
      })) as ClaimResultSummary;
      setContactIdentityStatus(formatClaimResult(result));
      setContactIdentityCode("");
    } catch (error) {
      setContactIdentityError(getSettingsErrorMessage(error));
    } finally {
      setIsVerifyingContactIdentityCode(false);
    }
  }

  return (
    <section
      aria-label="Contact Identities"
      className="kb-settings-panel kb-contact-identity-panel"
      aria-labelledby="kb-settings-contact-identities-heading"
    >
      <header>
        <MailCheck aria-hidden="true" />
        <div>
          <p className="kb-eyebrow">Contact Identity</p>
          <h2 id="kb-settings-contact-identities-heading">Contact Identities</h2>
        </div>
      </header>

      {contactIdentitySettings === undefined ? (
        <p className="kb-settings-empty" role="status">
          Loading contact identities.
        </p>
      ) : (
        <ul className="kb-contact-identity-list">
          {contactIdentitySettings.primaryEmail ? (
            <li>
              <span>Primary account email</span>
              <strong>{contactIdentitySettings.primaryEmail}</strong>
              <small>
                {contactIdentitySettings.primaryEmailVerified
                  ? "Verified"
                  : "Unverified"}
              </small>
            </li>
          ) : null}
          {contactIdentitySettings.contactIdentities.map((identity) => (
            <li key={identity.id}>
              <span>Contact Identity</span>
              <strong>{identity.email}</strong>
              <small>{formatContactIdentityStatus(identity.verificationStatus)}</small>
            </li>
          ))}
          {contactIdentitySettings.primaryEmail === undefined &&
          contactIdentitySettings.contactIdentities.length === 0 ? (
            <li>
              <span>Contact Identity</span>
              <strong>No email on file</strong>
              <small>Unavailable</small>
            </li>
          ) : null}
        </ul>
      )}

      <form
        className="kb-contact-identity-form"
        onSubmit={(event) => void handleRequestContactIdentityCode(event)}
      >
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            name="contactIdentityEmail"
            onChange={(event) => setContactIdentityEmail(event.target.value)}
            type="email"
            value={contactIdentityEmail}
          />
        </label>
        <button disabled={!canRequestContactIdentityCode} type="submit">
          {isRequestingContactIdentityCode ? (
            <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          ) : (
            <MailCheck aria-hidden="true" />
          )}
          <span>{isRequestingContactIdentityCode ? "Sending" : "Send code"}</span>
        </button>
      </form>

      <form
        className="kb-contact-identity-form"
        onSubmit={(event) => void handleVerifyContactIdentityCode(event)}
      >
        <label>
          <span>Code</span>
          <input
            autoComplete="one-time-code"
            disabled={requestedContactIdentityEmail === null}
            inputMode="numeric"
            name="contactIdentityCode"
            onChange={(event) => setContactIdentityCode(event.target.value)}
            type="text"
            value={contactIdentityCode}
          />
        </label>
        <button disabled={!canVerifyContactIdentityCode} type="submit">
          {isVerifyingContactIdentityCode ? (
            <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          ) : (
            <Check aria-hidden="true" />
          )}
          <span>
            {isVerifyingContactIdentityCode ? "Verifying" : "Verify and claim"}
          </span>
        </button>
      </form>

      {contactIdentityStatus ? (
        <p className="kb-contact-identity-success" role="status">
          <Check aria-hidden="true" />
          <span>{contactIdentityStatus}</span>
        </p>
      ) : null}
      {contactIdentityError ? (
        <p className="kb-contact-identity-error" role="alert">
          {contactIdentityError}
        </p>
      ) : null}
    </section>
  );
}

function SystemAdminPage({
  appAccess,
  onNavigate,
  routeState,
}: {
  appAccess: AllowedAppAccess;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  routeState: RouteState;
}) {
  const route = getRoute("system-admin");
  const isSystemAdmin = appAccess.systemRole === "systemAdmin";

  return (
    <main
      className="kb-main kb-settings-main kb-system-admin-main"
      aria-labelledby="kb-system-admin-page-heading"
    >
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">System Admin</p>
          <h1 id="kb-system-admin-page-heading">System Admin</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      {isSystemAdmin ? (
        <>
          <ContextExpertiseOperationsPanel />
          <PublicFigureExpertVisibilityPanel />
          <OrganizationAccountSetupPanel onNavigate={onNavigate} />
        </>
      ) : (
        <section
          className="kb-settings-panel kb-system-admin-panel"
          aria-labelledby="kb-system-admin-unavailable-heading"
        >
          <header>
            <Landmark aria-hidden="true" />
            <div>
              <p className="kb-eyebrow">System Admin</p>
              <h2 id="kb-system-admin-unavailable-heading">Unavailable</h2>
            </div>
          </header>
          <p className="kb-settings-empty">System Admin access required.</p>
        </section>
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

// System-admin maintenance flows are UI-only control panels over bounded Convex
// migration/backfill functions.
function ContextExpertiseOperationsPanel() {
  const [scopedBatchSizeInput, setScopedBatchSizeInput] = useState(
    String(DEFAULT_CONTEXT_EXPERTISE_OPERATION_BATCH_SIZE),
  );
  const [scopedCursorInput, setScopedCursorInput] = useState("");
  const [quoteBatchSizeInput, setQuoteBatchSizeInput] = useState(
    String(DEFAULT_CONTEXT_EXPERTISE_OPERATION_BATCH_SIZE),
  );
  const [quoteCursorInput, setQuoteCursorInput] = useState("");
  const [scopedDryRunResult, setScopedDryRunResult] =
    useState<ScopedAggregateMigrationBatchResult | null>(null);
  const [quoteDryRunResult, setQuoteDryRunResult] =
    useState<QuoteAttributionBackfillBatchResult | null>(null);
  const [scopedDryRunError, setScopedDryRunError] = useState<string | null>(null);
  const [quoteDryRunError, setQuoteDryRunError] = useState<string | null>(null);
  const [isPreviewingScopedMigration, setIsPreviewingScopedMigration] =
    useState(false);
  const [isPreviewingQuoteBackfill, setIsPreviewingQuoteBackfill] =
    useState(false);
  const scopedPagination = useMemo(
    () =>
      getContextExpertiseOperationPagination(
        scopedBatchSizeInput,
        scopedCursorInput,
      ),
    [scopedBatchSizeInput, scopedCursorInput],
  );
  const quotePagination = useMemo(
    () =>
      getContextExpertiseOperationPagination(
        quoteBatchSizeInput,
        quoteCursorInput,
      ),
    [quoteBatchSizeInput, quoteCursorInput],
  );
  const scopedStatus = useQuery(
    api.contextExpertise.getScopedAggregateMigrationStatus,
    {
      aggregateSampleLimit: 50,
      paginationOpts: scopedPagination,
    },
  ) as ScopedAggregateMigrationStatus | undefined;
  const quoteStatus = useQuery(
    api.contextExpertise.getQuoteAttributionBackfillStatus,
    {
      paginationOpts: quotePagination,
    },
  ) as QuoteAttributionBackfillStatus | undefined;
  const previewScopedMigration = useMutation(
    api.contextExpertise.rebuildScopedAggregateBatch,
  );
  const previewQuoteBackfill = useMutation(
    api.contextExpertise.backfillQuoteAttributionEvidenceBatch,
  );

  useEffect(() => {
    setScopedDryRunResult(null);
    setScopedDryRunError(null);
  }, [scopedPagination.cursor, scopedPagination.numItems]);

  useEffect(() => {
    setQuoteDryRunResult(null);
    setQuoteDryRunError(null);
  }, [quotePagination.cursor, quotePagination.numItems]);

  async function handleScopedMigrationDryRun() {
    setIsPreviewingScopedMigration(true);
    setScopedDryRunError(null);

    try {
      const result = (await previewScopedMigration({
        dryRun: true,
        paginationOpts: scopedPagination,
      })) as ScopedAggregateMigrationBatchResult;
      setScopedDryRunResult(result);
    } catch (caughtError) {
      setScopedDryRunResult(null);
      setScopedDryRunError(
        caughtError instanceof Error
          ? caughtError.message
          : "Scoped aggregate dry-run failed.",
      );
    } finally {
      setIsPreviewingScopedMigration(false);
    }
  }

  async function handleQuoteAttributionDryRun() {
    setIsPreviewingQuoteBackfill(true);
    setQuoteDryRunError(null);

    try {
      const result = (await previewQuoteBackfill({
        dryRun: true,
        paginationOpts: quotePagination,
      })) as QuoteAttributionBackfillBatchResult;
      setQuoteDryRunResult(result);
    } catch (caughtError) {
      setQuoteDryRunResult(null);
      setQuoteDryRunError(
        caughtError instanceof Error
          ? caughtError.message
          : "Quote attribution dry-run failed.",
      );
    } finally {
      setIsPreviewingQuoteBackfill(false);
    }
  }

  return (
    <section
      className="kb-settings-panel kb-system-admin-panel kb-context-expertise-operations-panel"
      aria-label="Context Expertise Operations"
      aria-labelledby="kb-context-expertise-operations-heading"
    >
      <header>
        <Database aria-hidden="true" />
        <div>
          <p className="kb-eyebrow">Context Expertise</p>
          <h2 id="kb-context-expertise-operations-heading">Operations</h2>
        </div>
      </header>

      <div className="kb-context-expertise-operations-grid">
        <article
          className="kb-context-expertise-operation"
          aria-labelledby="kb-scoped-aggregate-operation-heading"
        >
          <header className="kb-context-expertise-operation-header">
            <div>
              <p className="kb-eyebrow">Scoped aggregates</p>
              <h3 id="kb-scoped-aggregate-operation-heading">
                Scoped Aggregate Migration
              </h3>
            </div>
            <span className="kb-context-expertise-operation-state">
              {scopedStatus
                ? formatContextExpertiseOperationState(
                    scopedStatus.isDone,
                    scopedStatus.mayHaveMoreEvidence,
                  )
                : "Loading"}
            </span>
          </header>

          {scopedStatus ? (
            <>
              <dl
                className="kb-context-expertise-operation-metrics"
                aria-label="Scoped Aggregate Migration status"
              >
                <ContextExpertiseOperationMetric
                  label="Sampled evidence"
                  value={scopedStatus.sampledEvidenceCount}
                />
                <ContextExpertiseOperationMetric
                  label="Evidence groups"
                  value={scopedStatus.evidenceGroupCount}
                />
                <ContextExpertiseOperationMetric
                  label="Missing scoped groups"
                  value={scopedStatus.missingScopedAggregateGroupCount}
                />
                <ContextExpertiseOperationMetric
                  label="Legacy aggregate sample"
                  value={`${scopedStatus.legacyAggregateSampleCount}/${scopedStatus.sampledAggregateCount}`}
                />
                <ContextExpertiseOperationMetric
                  label="Scoped aggregate sample"
                  value={`${scopedStatus.scopedAggregateSampleCount}/${scopedStatus.aggregateSampleLimit}`}
                />
                <ContextExpertiseOperationMetric
                  label="Continue cursor"
                  value={formatContextExpertiseCursor(scopedStatus.continueCursor)}
                />
              </dl>
              <ContextExpertiseMigrationGroupSample
                emptyLabel="No missing scoped groups in this page."
                groups={scopedStatus.missingScopedAggregateGroups}
              />
            </>
          ) : (
            <p className="kb-settings-empty">Loading scoped aggregate status.</p>
          )}

          <form
            className="kb-system-admin-form kb-context-expertise-operation-controls"
            onSubmit={(event) => event.preventDefault()}
          >
            <label className="kb-system-admin-field">
              <span>Batch size</span>
              <input
                max={MAX_CONTEXT_EXPERTISE_OPERATION_BATCH_SIZE}
                min={1}
                name="scopedAggregateMigrationBatchSize"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setScopedBatchSizeInput(
                    normalizeContextExpertiseBatchSizeInput(event.target.value),
                  )
                }
                type="number"
                value={scopedBatchSizeInput}
              />
            </label>
            <label className="kb-system-admin-field">
              <span>Cursor</span>
              <input
                name="scopedAggregateMigrationCursor"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setScopedCursorInput(event.target.value)
                }
                type="text"
                value={scopedCursorInput}
              />
            </label>
            <button
              className="kb-system-admin-submit"
              disabled={isPreviewingScopedMigration}
              onClick={() => void handleScopedMigrationDryRun()}
              type="button"
            >
              {isPreviewingScopedMigration ? (
                <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
              ) : (
                <Database aria-hidden="true" />
              )}
              <span>
                {isPreviewingScopedMigration
                  ? "Previewing"
                  : "Dry-run scoped aggregate rebuild"}
              </span>
            </button>
          </form>

          {scopedDryRunResult ? (
            <div
              className="kb-context-expertise-operation-preview"
              aria-label="Scoped Aggregate Migration dry-run preview"
            >
              <p className="kb-system-admin-success" role="status">
                <Check aria-hidden="true" />
                <span>
                  Dry-run checked {scopedDryRunResult.processedEvidenceCount}{" "}
                  evidence rows across {scopedDryRunResult.groupCount} groups.
                </span>
              </p>
              <dl className="kb-context-expertise-operation-metrics">
                <ContextExpertiseOperationMetric
                  label="Would rebuild groups"
                  value={scopedDryRunResult.groupCount}
                />
                <ContextExpertiseOperationMetric
                  label="Skipped groups"
                  value={scopedDryRunResult.skippedGroupCount}
                />
                <ContextExpertiseOperationMetric
                  label="Continue cursor"
                  value={formatContextExpertiseCursor(
                    scopedDryRunResult.continueCursor,
                  )}
                />
                <ContextExpertiseOperationMetric
                  label="Page state"
                  value={scopedDryRunResult.isDone ? "Done" : "More pages"}
                />
              </dl>
              <ContextExpertiseMigrationGroupSample
                emptyLabel="No groups in this dry-run page."
                groups={scopedDryRunResult.groups}
              />
            </div>
          ) : null}
          {scopedDryRunError ? (
            <p className="kb-system-admin-error" role="alert">
              {scopedDryRunError}
            </p>
          ) : null}
        </article>

        <article
          className="kb-context-expertise-operation"
          aria-labelledby="kb-quote-attribution-operation-heading"
        >
          <header className="kb-context-expertise-operation-header">
            <div>
              <p className="kb-eyebrow">Quote attribution</p>
              <h3 id="kb-quote-attribution-operation-heading">
                Quote Attribution Backfill
              </h3>
            </div>
            <span className="kb-context-expertise-operation-state">
              {quoteStatus
                ? formatContextExpertiseOperationState(
                    quoteStatus.isDone,
                    quoteStatus.mayHaveMoreQuoteRows,
                  )
                : "Loading"}
            </span>
          </header>

          {quoteStatus ? (
            <>
              <dl
                className="kb-context-expertise-operation-metrics"
                aria-label="Quote Attribution Backfill status"
              >
                <ContextExpertiseOperationMetric
                  label="Processed Quote rows"
                  value={quoteStatus.processedQuoteRowCount}
                />
                <ContextExpertiseOperationMetric
                  label="Attributed Quote rows"
                  value={quoteStatus.attributedQuoteRowCount}
                />
                <ContextExpertiseOperationMetric
                  label="Eligible Quote rows"
                  value={quoteStatus.eligibleQuoteRowCount}
                />
                <ContextExpertiseOperationMetric
                  label="Existing evidence"
                  value={quoteStatus.existingEvidenceCount}
                />
                <ContextExpertiseOperationMetric
                  label="Missing evidence"
                  value={quoteStatus.missingEvidenceCount}
                />
                <ContextExpertiseOperationMetric
                  label="Skipped Quote rows"
                  value={quoteStatus.skippedQuoteRowCount}
                />
                <ContextExpertiseOperationMetric
                  label="Continue cursor"
                  value={formatContextExpertiseCursor(quoteStatus.continueCursor)}
                />
              </dl>
              <QuoteAttributionEvidenceSample
                emptyLabel="No missing Quote attribution evidence in this page."
                items={quoteStatus.missingEvidenceItems}
              />
              <QuoteAttributionSkippedSample items={quoteStatus.skippedQuoteRowItems} />
            </>
          ) : (
            <p className="kb-settings-empty">Loading Quote attribution status.</p>
          )}

          <form
            className="kb-system-admin-form kb-context-expertise-operation-controls"
            onSubmit={(event) => event.preventDefault()}
          >
            <label className="kb-system-admin-field">
              <span>Batch size</span>
              <input
                max={MAX_CONTEXT_EXPERTISE_OPERATION_BATCH_SIZE}
                min={1}
                name="quoteAttributionBackfillBatchSize"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setQuoteBatchSizeInput(
                    normalizeContextExpertiseBatchSizeInput(event.target.value),
                  )
                }
                type="number"
                value={quoteBatchSizeInput}
              />
            </label>
            <label className="kb-system-admin-field">
              <span>Cursor</span>
              <input
                name="quoteAttributionBackfillCursor"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setQuoteCursorInput(event.target.value)
                }
                type="text"
                value={quoteCursorInput}
              />
            </label>
            <button
              className="kb-system-admin-submit"
              disabled={isPreviewingQuoteBackfill}
              onClick={() => void handleQuoteAttributionDryRun()}
              type="button"
            >
              {isPreviewingQuoteBackfill ? (
                <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
              ) : (
                <Database aria-hidden="true" />
              )}
              <span>
                {isPreviewingQuoteBackfill
                  ? "Previewing"
                  : "Dry-run Quote attribution backfill"}
              </span>
            </button>
          </form>

          {quoteDryRunResult ? (
            <div
              className="kb-context-expertise-operation-preview"
              aria-label="Quote Attribution Backfill dry-run preview"
            >
              <p className="kb-system-admin-success" role="status">
                <Check aria-hidden="true" />
                <span>
                  Dry-run checked {quoteDryRunResult.processedQuoteRowCount}{" "}
                  Quote rows and would create{" "}
                  {quoteDryRunResult.wouldCreateEvidenceCount} evidence rows.
                </span>
              </p>
              <dl className="kb-context-expertise-operation-metrics">
                <ContextExpertiseOperationMetric
                  label="Existing evidence"
                  value={quoteDryRunResult.existingEvidenceCount}
                />
                <ContextExpertiseOperationMetric
                  label="Missing evidence"
                  value={quoteDryRunResult.missingEvidenceCount}
                />
                <ContextExpertiseOperationMetric
                  label="Would create evidence"
                  value={quoteDryRunResult.wouldCreateEvidenceCount}
                />
                <ContextExpertiseOperationMetric
                  label="Skipped Quote rows"
                  value={quoteDryRunResult.skippedQuoteRowCount}
                />
                <ContextExpertiseOperationMetric
                  label="Continue cursor"
                  value={formatContextExpertiseCursor(
                    quoteDryRunResult.continueCursor,
                  )}
                />
                <ContextExpertiseOperationMetric
                  label="Page state"
                  value={quoteDryRunResult.isDone ? "Done" : "More pages"}
                />
              </dl>
              <QuoteAttributionEvidenceSample
                emptyLabel="No Quote attribution evidence changes in this dry-run page."
                items={quoteDryRunResult.evidenceItems}
              />
              <QuoteAttributionSkippedSample
                items={quoteDryRunResult.skippedQuoteRowItems}
              />
            </div>
          ) : null}
          {quoteDryRunError ? (
            <p className="kb-system-admin-error" role="alert">
              {quoteDryRunError}
            </p>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function ContextExpertiseOperationMetric({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ContextExpertiseMigrationGroupSample({
  emptyLabel,
  groups,
}: {
  emptyLabel: string;
  groups: ContextExpertiseMigrationGroup[];
}) {
  const sampledGroups = groups.slice(0, CONTEXT_EXPERTISE_OPERATION_SAMPLE_LIMIT);

  if (sampledGroups.length === 0) {
    return <p className="kb-settings-empty">{emptyLabel}</p>;
  }

  return (
    <ol className="kb-context-expertise-operation-sample">
      {sampledGroups.map((group, index) => (
        <li key={`${group.contextKey}-${group.subjectKind}-${index}`}>
          <strong>{group.contextKey}</strong>
          <span>
            {formatContextExpertiseGroupSubject(group)} -{" "}
            {formatContextExpertiseAudienceScope(group)}
          </span>
          {group.evidenceCount !== undefined || group.skippedReason ? (
            <span>
              {group.evidenceCount !== undefined
                ? `${group.evidenceCount} evidence rows`
                : ""}
              {group.evidenceCount !== undefined && group.skippedReason
                ? " - "
                : ""}
              {group.skippedReason
                ? formatContextExpertiseReason(group.skippedReason)
                : ""}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function QuoteAttributionEvidenceSample({
  emptyLabel,
  items,
}: {
  emptyLabel: string;
  items: QuoteAttributionBackfillEvidenceItem[];
}) {
  const sampledItems = items.slice(0, CONTEXT_EXPERTISE_OPERATION_SAMPLE_LIMIT);

  if (sampledItems.length === 0) {
    return <p className="kb-settings-empty">{emptyLabel}</p>;
  }

  return (
    <ol className="kb-context-expertise-operation-sample">
      {sampledItems.map((item, index) => (
        <li key={`${item.quoteEntryId}-${item.action}-${index}`}>
          <strong>{formatQuoteAttributionEvidenceAction(item.action)}</strong>
          <span>{item.contextKey}</span>
          <span>
            Entry {item.entryId} - Quote {item.quoteEntryId} - Person{" "}
            {item.subjectPersonReferentId}
          </span>
        </li>
      ))}
    </ol>
  );
}

function QuoteAttributionSkippedSample({
  items,
}: {
  items: QuoteAttributionBackfillSkippedItem[];
}) {
  const sampledItems = items.slice(0, CONTEXT_EXPERTISE_OPERATION_SAMPLE_LIMIT);

  if (sampledItems.length === 0) {
    return null;
  }

  return (
    <ol className="kb-context-expertise-operation-sample">
      {sampledItems.map((item, index) => (
        <li key={`${item.quoteEntryId}-${item.skippedReason}-${index}`}>
          <strong>{formatContextExpertiseReason(item.skippedReason)}</strong>
          <span>
            Quote {item.quoteEntryId}
            {item.entryId ? ` - Entry ${item.entryId}` : ""}
          </span>
          {item.subjectPersonReferentId ? (
            <span>Person {item.subjectPersonReferentId}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function getContextExpertiseOperationPagination(
  batchSizeInput: string,
  cursorInput: string,
): ContextExpertiseOperationPagination {
  return {
    cursor: cursorInput.trim() === "" ? null : cursorInput.trim(),
    numItems: getContextExpertiseOperationBatchSize(batchSizeInput),
  };
}

function getContextExpertiseOperationBatchSize(batchSizeInput: string) {
  const parsedBatchSize = Number.parseInt(batchSizeInput, 10);
  if (!Number.isFinite(parsedBatchSize)) {
    return DEFAULT_CONTEXT_EXPERTISE_OPERATION_BATCH_SIZE;
  }

  return Math.max(
    1,
    Math.min(MAX_CONTEXT_EXPERTISE_OPERATION_BATCH_SIZE, parsedBatchSize),
  );
}

function normalizeContextExpertiseBatchSizeInput(value: string) {
  if (value.trim() === "") {
    return "";
  }

  return String(getContextExpertiseOperationBatchSize(value));
}

function formatContextExpertiseOperationState(
  isDone: boolean,
  mayHaveMore: boolean,
) {
  if (isDone) {
    return "Done";
  }

  return mayHaveMore ? "More pages" : "Pending";
}

function formatContextExpertiseCursor(cursor: string) {
  return cursor.length > 0 ? cursor : "None";
}

function formatContextExpertiseGroupSubject(
  group: ContextExpertiseMigrationGroup,
) {
  if (group.subjectKind === "person") {
    return `Person ${group.subjectPersonReferentId ?? "unknown"}`;
  }

  return `User ${group.subjectUserId ?? "unknown"}`;
}

function formatContextExpertiseAudienceScope(
  group: ContextExpertiseMigrationGroup,
) {
  if (group.audienceScopeKind === "public") {
    return "Public";
  }

  return `${formatContextExpertiseReason(group.audienceScopeKind)} ${
    group.audienceScopeTargetKey
  }`;
}

function formatQuoteAttributionEvidenceAction(
  action: QuoteAttributionBackfillEvidenceItem["action"],
) {
  if (action === "wouldCreate") {
    return "Would create";
  }

  return formatContextExpertiseReason(action);
}

function formatContextExpertiseReason(reason: string) {
  return reason
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function PublicFigureExpertVisibilityPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerson, setSelectedPerson] =
    useState<QuoteAttributionPersonOption | null>(null);
  const [optimisticModeration, setOptimisticModeration] =
    useState<PersonGlobalExpertVisibilityModeration | null>(null);
  const [moderationNote, setModerationNote] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const searchTerm = searchQuery.trim();
  const personOptions = useQuery(
    api.contextExpertise.searchPublicFigureExpertPeople,
    searchTerm.length >= 2
      ? {
          limit: 8,
          searchQuery: searchTerm,
        }
      : "skip",
  ) as QuoteAttributionPersonOption[] | undefined;
  const queriedModeration = useQuery(
    api.contextExpertise.getPersonGlobalExpertVisibilityModeration,
    selectedPerson
      ? {
          personReferentId: selectedPerson.referentId as Id<"referents">,
        }
      : "skip",
  ) as PersonGlobalExpertVisibilityModeration | undefined;
  const moderationHistory = useQuery(
    api.contextExpertise.listPersonGlobalExpertVisibilityModerationHistory,
    selectedPerson
      ? {
          limit: 10,
          personReferentId: selectedPerson.referentId as Id<"referents">,
        }
      : "skip",
  ) as PersonGlobalExpertVisibilityModerationEvent[] | undefined;
  const updatePersonVisibility = useMutation(
    api.contextExpertise.updatePersonGlobalExpertVisibilityModeration,
  );
  const currentModeration = optimisticModeration ?? queriedModeration ?? null;
  const isSearching = searchTerm.length >= 2 && personOptions === undefined;
  const isLoadingStatus = selectedPerson !== null && currentModeration === null;
  const isLoadingHistory =
    selectedPerson !== null && moderationHistory === undefined;
  const isSuppressed = currentModeration?.status === "suppressed";
  const hasModerationNoteChange =
    isSuppressed &&
    moderationNote.trim().length > 0 &&
    moderationNote.trim() !== (currentModeration?.moderationNote ?? "");

  useEffect(() => {
    setOptimisticModeration(null);
    setModerationNote("");
    setStatusMessage(null);
    setErrorMessage(null);
  }, [selectedPerson?.referentId]);

  useEffect(() => {
    if (queriedModeration) {
      setModerationNote(queriedModeration.moderationNote ?? "");
    }
  }, [
    queriedModeration?.moderationNote,
    queriedModeration?.personReferentId,
    queriedModeration?.status,
  ]);

  function handleSelectPerson(option: QuoteAttributionPersonOption) {
    setSelectedPerson(option);
    setSearchQuery(option.label);
  }

  async function handleUpdatePersonVisibility(suppressed: boolean) {
    if (!selectedPerson) {
      return;
    }

    const wasSuppressed = currentModeration?.status === "suppressed";
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const nextModeration = (await updatePersonVisibility({
        ...(suppressed && moderationNote.trim()
          ? { moderationNote: moderationNote.trim() }
          : {}),
        personReferentId: selectedPerson.referentId as Id<"referents">,
        suppressed,
      })) as PersonGlobalExpertVisibilityModeration;
      setOptimisticModeration(nextModeration);
      setModerationNote(nextModeration.moderationNote ?? "");
      setStatusMessage(
        suppressed
          ? wasSuppressed
            ? "Updated moderation note."
            : "Suppressed globally."
          : "Restored global visibility.",
      );
    } catch (caughtError) {
      setErrorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Public figure expert visibility update failed.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      className="kb-settings-panel kb-system-admin-panel kb-public-figure-expert-panel"
      aria-labelledby="kb-public-figure-experts-heading"
    >
      <header>
        <UserMinus aria-hidden="true" />
        <div>
          <p className="kb-eyebrow">Context Expertise</p>
          <h2 id="kb-public-figure-experts-heading">Public Figure Experts</h2>
        </div>
      </header>

      <form
        className="kb-system-admin-form kb-public-figure-expert-search"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="kb-system-admin-field">
          <span>Person</span>
          <input
            aria-label="Search public figure expert Person"
            name="publicFigureExpertSearch"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setSearchQuery(event.target.value);
            }}
            type="text"
            value={searchQuery}
          />
        </label>
      </form>

      {searchTerm.length >= 2 ? (
        <div className="kb-public-figure-options" aria-label="Public Figure Expert options">
          {isSearching ? (
            <span className="kb-public-figure-option-status">
              <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
              Searching
            </span>
          ) : (
            (personOptions ?? []).map((option) => (
              <button
                key={option.referentId}
                className="kb-public-figure-option"
                onClick={() => handleSelectPerson(option)}
                type="button"
              >
                <Search aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))
          )}
        </div>
      ) : null}

      {selectedPerson ? (
        <div
          className="kb-public-figure-status"
          aria-label="Public Figure Expert visibility status"
        >
          <div>
            <strong>{currentModeration?.personLabel ?? selectedPerson.label}</strong>
            <span>
              {isLoadingStatus
                ? "Loading status"
                : isSuppressed
                  ? "Suppressed globally"
                  : "Visible globally by default"}
            </span>
          </div>

          <label className="kb-system-admin-field">
            <span>Moderation note</span>
            <input
              disabled={isSaving}
              name="publicFigureExpertModerationNote"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setModerationNote(event.target.value)
              }
              type="text"
              value={moderationNote}
            />
          </label>

          <button
            className="kb-system-admin-submit"
            disabled={isSaving || isLoadingStatus}
            onClick={() => void handleUpdatePersonVisibility(!isSuppressed)}
            type="button"
          >
            {isSaving ? (
              <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
            ) : isSuppressed ? (
              <UserPlus aria-hidden="true" />
            ) : (
              <UserMinus aria-hidden="true" />
            )}
            <span>
              {isSaving
                ? "Saving"
                : isSuppressed
                  ? "Restore global visibility"
                  : "Suppress globally"}
            </span>
          </button>

          {isSuppressed ? (
            <button
              className="kb-system-admin-submit kb-public-figure-note-submit"
              disabled={isSaving || isLoadingStatus || !hasModerationNoteChange}
              onClick={() => void handleUpdatePersonVisibility(true)}
              type="button"
            >
              {isSaving ? (
                <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
              ) : (
                <Check aria-hidden="true" />
              )}
              <span>{isSaving ? "Saving" : "Update note"}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {selectedPerson ? (
        <div
          className="kb-public-figure-history"
          aria-label="Public Figure Expert moderation history"
        >
          <header>
            <Clock aria-hidden="true" />
            <h3>Recent moderation</h3>
          </header>
          {isLoadingHistory ? (
            <p className="kb-public-figure-history-empty">Loading history</p>
          ) : moderationHistory && moderationHistory.length > 0 ? (
            <ol>
              {moderationHistory.map((event) => (
                <li key={event.eventId}>
                  <div>
                    <strong>{formatPublicFigureModerationAction(event.action)}</strong>
                    <span>{formatPublicFigureModerationTime(event.createdAt)}</span>
                  </div>
                  <p>{formatPublicFigureModerationTransition(event)}</p>
                  {event.moderationNote ?? event.previousModerationNote ? (
                    <p className="kb-public-figure-history-note">
                      {event.moderationNote ?? event.previousModerationNote}
                    </p>
                  ) : null}
                  <span>by {event.updatedByUserId}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="kb-public-figure-history-empty">
              No moderation history yet.
            </p>
          )}
        </div>
      ) : null}

      {statusMessage ? (
        <p className="kb-system-admin-success" role="status">
          <Check aria-hidden="true" />
          <span>{statusMessage}</span>
        </p>
      ) : null}
      {errorMessage ? (
        <p className="kb-system-admin-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

function formatPublicFigureModerationAction(
  action: PersonGlobalExpertVisibilityModerationEvent["action"],
) {
  if (action === "restored") {
    return "Restored";
  }

  if (action === "suppressionNoteUpdated") {
    return "Note updated";
  }

  return "Suppressed";
}

function formatPublicFigureModerationTransition(
  event: PersonGlobalExpertVisibilityModerationEvent,
) {
  if (event.action === "restored") {
    return "Suppressed to visible by default";
  }

  if (event.action === "suppressionNoteUpdated") {
    return "Suppression note changed";
  }

  return "Visible by default to suppressed";
}

function formatPublicFigureModerationTime(timestamp: number) {
  return NOTIFICATION_TIME_FORMATTER.format(new Date(timestamp));
}

function TodoListPage({
  onNavigate,
  onNavigateToHref,
  routeState,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
  onNavigateToHref: (href: string) => void;
  routeState: RouteState;
}) {
  const route = getRoute("todo-list");
  const acceptSmartStorageProposal = useMutation(
    api.smartStorage.acceptScaffoldProposal,
  );
  const confirmSmartStorageKnownReferent = useMutation(
    api.smartStorage.confirmKnownReferentForReferenceResolution,
  );
  const cancelSmartStorageSession = useMutation(api.smartStorage.cancelSession);
  const assignSmartStorageReviewSlot = useMutation(
    api.smartStorage.assignReviewSlot,
  );
  const requestSmartStorageRefresh = useMutation(
    api.smartStorage.requestRefreshForProposal,
  );
  const retrySmartStorageModelRun = useMutation(
    api.smartStorage.retryModelRun,
  );
  const dismissSmartStorageRefresh = useMutation(
    api.smartStorage.dismissRefreshSuggestion,
  );
  const generateSmartStorageProposal = useMutation(
    api.smartStorage.generateDraftProposalForRun,
  );
  const executeSmartStorageModelRun = useAction(
    api.smartStorage.executeModelRun,
  );
  const [activeSmartStorageSessionId, setActiveSmartStorageSessionId] =
    useState<Id<"contributionSubmissions"> | null>(null);
  const [activeSmartStorageProposalId, setActiveSmartStorageProposalId] =
    useState<Id<"smartStorageProposals"> | null>(null);
  const [isSmartStorageWizardOpen, setIsSmartStorageWizardOpen] =
    useState(false);
  const [smartStorageExistingEntryTargets, setSmartStorageExistingEntryTargets] =
    useState<Record<string, string>>({});
  const [, refreshSmartStorageWizard] = useState(0);
  const assignedSlots = useQuery(api.answerFeed.listAssignedSlotsForCurrentUser, {
    limit: 50,
  }) as KnowledgeSlotSummary[] | undefined;
  const assignedReviewSlots = useQuery(
    api.smartStorage.listReviewSlotsForCurrentUser,
    {
      limit: 50,
    },
  ) as SmartStorageReviewSlotSummary[] | undefined;
  const todoSlots = assignedSlots ?? [];
  const reviewSlots = assignedReviewSlots ?? [];
  const reviewSlotGroups = groupSmartStorageReviewSlots(reviewSlots);
  const totalTodoItems = todoSlots.length + reviewSlots.length;
  const isLoadingTodo =
    assignedSlots === undefined || assignedReviewSlots === undefined;
  const overdueCount = todoSlots.filter((slot) => slot.status === "overdue").length;
  const openCount =
    todoSlots.filter((slot) => slot.status === "open").length +
    reviewSlots.filter((slot) => slot.acceptReady).length;
  const nextDueLabel = getNextTodoDueLabel(todoSlots);
  const smartStorageWizardSession = useQuery(
    api.smartStorage.getSessionSummary,
    isSmartStorageWizardOpen && activeSmartStorageSessionId !== null
      ? {
          contributionSubmissionId: activeSmartStorageSessionId,
          ...(activeSmartStorageProposalId === null
            ? {}
            : { smartStorageProposalId: activeSmartStorageProposalId }),
        }
      : "skip",
  ) as SmartStorageSessionSummary | null | undefined;

  async function handleAcceptSmartStorageProposal(
    proposal: SmartStorageSessionProposalSummary,
    representationDecisions?: SmartStorageRepresentationDecision[],
    targetExistingEntryId?: string,
  ) {
    if (
      proposal.referenceResolution?.mode === "knownReferentMatch" &&
      proposal.referenceResolution.candidateTagId !== undefined &&
      targetExistingEntryId === undefined
    ) {
      await confirmSmartStorageKnownReferent({
        smartStorageProposalId: proposal.id as Id<"smartStorageProposals">,
        tagId: proposal.referenceResolution.candidateTagId as Id<"tags">,
      });
      refreshSmartStorageWizard((current) => current + 1);
      return;
    }

    const result = await acceptSmartStorageProposal({
      smartStorageProposalId: proposal.id as Id<"smartStorageProposals">,
      ...(representationDecisions && representationDecisions.length > 0
        ? {
            representationDecisions: representationDecisions.map(
              (decision) => ({
                includeAsRepresentation: decision.includeAsRepresentation,
                isPrimary: decision.isPrimary,
                representationRole: decision.representationRole,
                sourceId: decision.sourceId as Id<"sources">,
              }),
            ),
          }
        : {}),
      ...(targetExistingEntryId === undefined
        ? {}
        : {
            targetExistingEntryId:
              targetExistingEntryId as Id<"knowledgeEntries">,
          }),
    });
    if (result.acceptanceStatus === "targetExists" && result.existingEntryId) {
      setSmartStorageExistingEntryTargets((current) => ({
        ...current,
        [proposal.id]: result.existingEntryId,
      }));
      refreshSmartStorageWizard((current) => current + 1);
      return;
    }

    setSmartStorageExistingEntryTargets((current) => {
      const next = { ...current };
      delete next[proposal.id];
      return next;
    });
    refreshSmartStorageWizard((current) => current + 1);
  }

  async function handleCreateBasicSmartStorageProposal(
    session: SmartStorageSessionSummary,
  ) {
    const runId = session.activeRun?.id ?? session.latestRun?.id;
    if (runId === undefined) {
      return;
    }

    await generateSmartStorageProposal({
      smartStorageRunId: runId as Id<"smartStorageRuns">,
    });
    refreshSmartStorageWizard((current) => current + 1);
  }

  async function handleCancelSmartStorageSession(
    session: SmartStorageSessionSummary,
  ) {
    await cancelSmartStorageSession({
      contributionSubmissionId:
        session.contributionSubmission.id as Id<"contributionSubmissions">,
    });
    setActiveSmartStorageSessionId(null);
    setActiveSmartStorageProposalId(null);
    setIsSmartStorageWizardOpen(false);
    setSmartStorageExistingEntryTargets({});
  }

  async function handleRequestSmartStorageRefresh(
    proposal: SmartStorageSessionProposalSummary,
  ) {
    await requestSmartStorageRefresh({
      smartStorageProposalId: proposal.id as Id<"smartStorageProposals">,
    });
    refreshSmartStorageWizard((current) => current + 1);
  }

  async function handleRetrySmartStorageModelRun(
    session: SmartStorageSessionSummary,
  ) {
    const result = await retrySmartStorageModelRun({
      contributionSubmissionId:
        session.contributionSubmission.id as Id<"contributionSubmissions">,
    });
    try {
      await executeSmartStorageModelRun({
        smartStorageRunId: result.smartStorageRunId,
      });
    } finally {
      refreshSmartStorageWizard((current) => current + 1);
    }
  }

  async function handleDismissSmartStorageRefresh(
    proposal: SmartStorageSessionProposalSummary,
  ) {
    await dismissSmartStorageRefresh({
      smartStorageProposalId: proposal.id as Id<"smartStorageProposals">,
    });
    refreshSmartStorageWizard((current) => current + 1);
  }

  function handleResumeSmartStorageReviewSlot(
    reviewSlot: SmartStorageReviewSlotSummary,
  ) {
    setSmartStorageExistingEntryTargets({});
    setActiveSmartStorageSessionId(
      reviewSlot.contributionSubmissionId as Id<"contributionSubmissions">,
    );
    setActiveSmartStorageProposalId(
      reviewSlot.smartStorageProposalId as Id<"smartStorageProposals">,
    );
    setIsSmartStorageWizardOpen(true);
  }

  async function handleAssignSmartStorageReviewSlot(
    reviewSlot: SmartStorageReviewSlotSummary,
    targetUserId: string,
  ) {
    await assignSmartStorageReviewSlot({
      smartStorageProposalId:
        reviewSlot.smartStorageProposalId as Id<"smartStorageProposals">,
      targetKind: "user",
      targetUserId: targetUserId as Id<"users">,
    });
  }

  async function handleRequestSmartStorageReviewSlotRefresh(
    reviewSlot: SmartStorageReviewSlotSummary,
  ) {
    await requestSmartStorageRefresh({
      smartStorageProposalId:
        reviewSlot.smartStorageProposalId as Id<"smartStorageProposals">,
    });
    refreshSmartStorageWizard((current) => current + 1);
  }

  async function handleDismissSmartStorageReviewSlotRefresh(
    reviewSlot: SmartStorageReviewSlotSummary,
  ) {
    await dismissSmartStorageRefresh({
      smartStorageProposalId:
        reviewSlot.smartStorageProposalId as Id<"smartStorageProposals">,
    });
    refreshSmartStorageWizard((current) => current + 1);
  }

  return (
    <main className="kb-main kb-todo-main" aria-labelledby="kb-todo-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">User View</p>
          <h1 id="kb-todo-heading">TODO List</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>

      <section className="kb-todo-summary" aria-label="TODO List summary">
        <div>
          <ListTodo aria-hidden="true" />
          <span>Assigned</span>
          <strong>{formatCountLabel(totalTodoItems, "item")}</strong>
        </div>
        <div>
          <Clock aria-hidden="true" />
          <span>Next due</span>
          <strong>{nextDueLabel}</strong>
        </div>
        <div>
          <Check aria-hidden="true" />
          <span>Open</span>
          <strong>{formatCountLabel(openCount, "open item")}</strong>
        </div>
        <div>
          <Bell aria-hidden="true" />
          <span>Past due</span>
          <strong>{formatCountLabel(overdueCount, "past due slot")}</strong>
        </div>
      </section>

      <section className="kb-todo-panel" aria-labelledby="kb-todo-list-heading">
        <header>
          <div>
            <p className="kb-eyebrow">Knowledge Slots and Review Slots</p>
            <h2 id="kb-todo-list-heading">Assigned to You</h2>
          </div>
          <span>{formatCountLabel(totalTodoItems, "item")}</span>
        </header>

        {isLoadingTodo ? (
          <section className="kb-todo-empty" role="status">
            <h3>Loading assigned work.</h3>
            <p>Checking open requests and Smart Storage review work.</p>
          </section>
        ) : totalTodoItems > 0 ? (
          <ol className="kb-todo-list">
            {todoSlots.map((slot) => (
              <li key={slot.id}>
                <KnowledgeSlotCard
                  onNavigateToHref={onNavigateToHref}
                  slot={slot}
                />
              </li>
            ))}
            {reviewSlotGroups.map((group) => (
              <li className="kb-todo-review-group" key={group.group.id}>
                <section aria-labelledby={`todo-review-group-${group.group.id}`}>
                  <header>
                    <div>
                      <p className="kb-eyebrow">Review Slots</p>
                      <h3 id={`todo-review-group-${group.group.id}`}>
                        <a
                          href={group.group.href}
                          onClick={(event) => onNavigate(event, group.group.href)}
                        >
                          {group.group.title}
                        </a>
                      </h3>
                    </div>
                    <span>{formatCountLabel(group.reviewSlots.length, "review slot")}</span>
                  </header>
                  <ol>
                    {group.reviewSlots.map((reviewSlot) => (
                      <li key={reviewSlot.id}>
                        <ReviewSlotCard
                          onAssign={handleAssignSmartStorageReviewSlot}
                          onDismissRefresh={
                            handleDismissSmartStorageReviewSlotRefresh
                          }
                          onNavigateToHref={onNavigateToHref}
                          onRequestRefresh={
                            handleRequestSmartStorageReviewSlotRefresh
                          }
                          onResume={handleResumeSmartStorageReviewSlot}
                          reviewSlot={reviewSlot}
                        />
                      </li>
                    ))}
                  </ol>
                </section>
              </li>
            ))}
          </ol>
        ) : (
          <section className="kb-todo-empty" role="status">
            <h3>No assigned work.</h3>
            <p>Open requests and Smart Storage Review Slots will appear here.</p>
          </section>
        )}
      </section>

      {route.relatedRouteIds ? (
        <RelatedRoutes
          onNavigate={onNavigate}
          relatedRouteIds={route.relatedRouteIds}
        />
      ) : null}

      {isSmartStorageWizardOpen && activeSmartStorageSessionId !== null ? (
        <SmartStorageSessionWizard
          existingEntryTargets={smartStorageExistingEntryTargets}
          onAcceptProposal={handleAcceptSmartStorageProposal}
          onCancelSession={handleCancelSmartStorageSession}
          onClose={() => {
            setActiveSmartStorageProposalId(null);
            setIsSmartStorageWizardOpen(false);
          }}
          onCreateBasicProposal={handleCreateBasicSmartStorageProposal}
          onDismissRefresh={handleDismissSmartStorageRefresh}
          onNavigateToHref={onNavigateToHref}
          onRequestRefresh={handleRequestSmartStorageRefresh}
          onRetryModelRun={handleRetrySmartStorageModelRun}
          session={smartStorageWizardSession}
        />
      ) : null}
    </main>
  );
}

function groupSmartStorageReviewSlots(reviewSlots: SmartStorageReviewSlotSummary[]) {
  const groups: Array<{
    group: SmartStorageReviewSlotSummary["group"];
    reviewSlots: SmartStorageReviewSlotSummary[];
  }> = [];
  const groupById = new Map<string, (typeof groups)[number]>();

  for (const reviewSlot of reviewSlots) {
    const existingGroup = groupById.get(reviewSlot.group.id);
    if (existingGroup) {
      existingGroup.reviewSlots.push(reviewSlot);
      continue;
    }

    const nextGroup = {
      group: reviewSlot.group,
      reviewSlots: [reviewSlot],
    };
    groupById.set(reviewSlot.group.id, nextGroup);
    groups.push(nextGroup);
  }

  return groups;
}

function getNextTodoDueLabel(slots: KnowledgeSlotSummary[]) {
  const nextDueAt = slots
    .map((slot) => slot.dueAt)
    .filter((dueAt): dueAt is number => dueAt !== undefined)
    .sort((left, right) => left - right)[0];

  return nextDueAt === undefined ? "No due dates" : formatNotificationTime(nextDueAt);
}

function OrganizationAccountSetupPanel({
  onNavigate,
}: {
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const createOrganizationAccount = useMutation(
    api.organizationAccounts.createOrganizationAccount,
  );
  const [organizationSetupResult, setOrganizationSetupResult] =
    useState<OrganizationAccountSetupResult | null>(null);
  const [organizationSetupError, setOrganizationSetupError] = useState<
    string | null
  >(null);
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false);

  async function handleCreateOrganizationAccount(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("organizationName") ?? "");
    const organizationKindValue = String(formData.get("organizationKind") ?? "");
    if (!isOrganizationKind(organizationKindValue)) {
      setOrganizationSetupResult(null);
      setOrganizationSetupError("Choose an organization type.");
      return;
    }

    setOrganizationSetupResult(null);
    setOrganizationSetupError(null);
    setIsCreatingOrganization(true);

    try {
      const result = await createOrganizationAccount({
        name,
        organizationKind: organizationKindValue,
      });
      setOrganizationSetupResult(result);
      form.reset();
    } catch (caughtError) {
      setOrganizationSetupError(
        caughtError instanceof Error
          ? caughtError.message
          : "Organization account setup failed.",
      );
    } finally {
      setIsCreatingOrganization(false);
    }
  }

  return (
    <section
      className="kb-settings-panel kb-system-admin-panel"
      aria-labelledby="kb-system-admin-heading"
    >
      <header>
        <Landmark aria-hidden="true" />
        <div>
          <p className="kb-eyebrow">System Admin</p>
          <h2 id="kb-system-admin-heading">Organization Accounts</h2>
        </div>
      </header>

      <form
        className="kb-system-admin-form"
        onSubmit={(event) => void handleCreateOrganizationAccount(event)}
      >
        <label className="kb-system-admin-field">
          <span>Organization name</span>
          <input
            disabled={isCreatingOrganization}
            maxLength={240}
            name="organizationName"
            required
            type="text"
          />
        </label>
        <label className="kb-system-admin-field">
          <span>Organization type</span>
          <select
            defaultValue="school"
            disabled={isCreatingOrganization}
            name="organizationKind"
          >
            {ORGANIZATION_KIND_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="kb-system-admin-submit"
          disabled={isCreatingOrganization}
          type="submit"
        >
          {isCreatingOrganization ? (
            <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          ) : (
            <Landmark aria-hidden="true" />
          )}
          <span>{isCreatingOrganization ? "Setting up" : "Set up account"}</span>
        </button>
      </form>

      {organizationSetupResult ? (
        <p className="kb-system-admin-success" role="status">
          <Check aria-hidden="true" />
          <span>
            Created{" "}
            <a
              href={organizationSetupResult.href}
              onClick={(event) =>
                onNavigate(event, organizationSetupResult.href)
              }
            >
              {organizationSetupResult.name}
            </a>
          </span>
        </p>
      ) : null}
      {organizationSetupError ? (
        <p className="kb-system-admin-error" role="alert">
          {organizationSetupError}
        </p>
      ) : null}
    </section>
  );
}

function formatOrganizationKind(kind: string) {
  return kind
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isOrganizationKind(value: string): value is OrganizationKind {
  return ORGANIZATION_KIND_OPTIONS.some((option) => option.id === value);
}

function isOrganizationMembershipRole(
  value: string,
): value is OrganizationMembershipRole {
  return ORGANIZATION_MEMBERSHIP_ROLE_OPTIONS.some(
    (option) => option.id === value,
  );
}

function formatMembershipRole(role: string) {
  return formatOrganizationKind(role);
}

function formatContactIdentityStatus(status: ContactIdentityStatus) {
  return status === "verified" ? "Verified" : "Pending";
}

function getSettingsErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Contact Identity update failed.";
}

function formatOrganizationMemberStatus(member: OrganizationMember) {
  if (member.personConsolidationReview?.reviewStatus === "pending") {
    return "Needs Identity Review";
  }
  if (member.personConsolidationReview?.reviewStatus === "rejected") {
    return "Identity Review Rejected";
  }
  if (member.personConsolidationReview?.reviewStatus === "approved") {
    return "Identity Review Approved";
  }
  if (member.status === "pending") {
    return `Pending ${formatMembershipRole(member.role)}`;
  }

  return formatMembershipRole(member.role);
}

function canWithdrawPendingOrganizationMember(member: OrganizationMember) {
  const reviewStatus = member.personConsolidationReview?.reviewStatus;
  return (
    member.status === "pending" &&
    (reviewStatus === undefined || reviewStatus === "rejected")
  );
}

function formatMembershipClaimEvidence(evidence: MembershipClaimEvidence) {
  const claimSummary = `Claimed via ${formatClaimSource(evidence.claimSource)} ${evidence.claimedContactValue}.`;
  if (evidence.personConsolidation === undefined) {
    return claimSummary;
  }

  return `${claimSummary} Person Consolidation approved: ${evidence.personConsolidation.pendingPersonName} was consolidated into ${evidence.personConsolidation.resultingPersonName}.`;
}

function formatPersonConsolidationReviewEvidence(
  evidence: PersonConsolidationReviewEvidence,
) {
  const requester =
    evidence.requestedByEmail === undefined
      ? ""
      : ` by ${evidence.requestedByEmail}`;
  if (evidence.reviewStatus === "rejected") {
    return `Identity review rejected for ${evidence.claimedContactValue}${requester}.`;
  }
  if (evidence.reviewStatus === "approved") {
    return `Identity review approved for ${evidence.claimedContactValue}${requester}.`;
  }
  return `Identity review requested for ${evidence.claimedContactValue}${requester}.`;
}

function formatClaimSource(
  claimSource: MembershipClaimEvidence["claimSource"],
) {
  return claimSource === "verifiedPrimaryEmail"
    ? "verified primary email"
    : "verified contact email";
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

function getAppRoleLabels(appAccess: AllowedAppAccess) {
  const roleLabels = getUniqueMembershipRoles(appAccess.organizations);
  if (appAccess.systemRole !== "systemAdmin") {
    return roleLabels;
  }

  return ["System Admin", ...roleLabels];
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
              const SubscriptionIcon = getSubscriptionSourceIcon(subscription);

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
  const routeProfile = getOrganizationPageProfile(
    routeState.pathname,
    appAccess.organizations,
  );
  const organizationId = getOrganizationId(routeState.pathname);
  const organizationHomeHref = getOrganizationHomeHref(routeState.pathname);
  const canManageOrganization =
    appAccess.systemRole === "systemAdmin" || routeProfile.role === "admin";
  const organizationSettings = useQuery(
    api.organizationAccounts.getOrganizationMembershipSettings,
    canManageOrganization ? { organizationId } : "skip",
  ) as OrganizationMembershipSettings | null | undefined;
  const addOrganizationMember = useMutation(
    api.organizationAccounts.addOrganizationMember,
  );
  const approvePersonConsolidationReview = useMutation(
    api.organizationAccounts.approvePersonConsolidationReview,
  );
  const rejectPersonConsolidationReview = useMutation(
    api.organizationAccounts.rejectPersonConsolidationReview,
  );
  const reopenPersonConsolidationReview = useMutation(
    api.organizationAccounts.reopenPersonConsolidationReview,
  );
  const withdrawPendingOrganizationMember = useMutation(
    api.organizationAccounts.withdrawPendingOrganizationMember,
  );
  const [memberSetupError, setMemberSetupError] = useState<string | null>(null);
  const [memberSetupSuccess, setMemberSetupSuccess] = useState<string | null>(
    null,
  );
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [pendingReviewApprovalId, setPendingReviewApprovalId] =
    useState<Id<"personConsolidationReviews"> | null>(null);
  const [pendingReviewRejectionId, setPendingReviewRejectionId] =
    useState<Id<"personConsolidationReviews"> | null>(null);
  const [pendingReviewReopenId, setPendingReviewReopenId] =
    useState<Id<"personConsolidationReviews"> | null>(null);
  const [pendingMemberWithdrawalId, setPendingMemberWithdrawalId] =
    useState<Id<"memberships"> | null>(null);
  const profile = organizationSettings
    ? {
        ...routeProfile,
        name: organizationSettings.name,
        organizationKind: organizationSettings.organizationKind,
        organizationReferentId: organizationSettings.organizationReferentId,
      }
    : routeProfile;
  const isLoadingMembers =
    canManageOrganization && organizationSettings === undefined;
  const didMissOrganization =
    canManageOrganization && organizationSettings === null;
  const members = organizationSettings?.members ?? [];

  async function handleAddOrganizationMember(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("memberEmail") ?? "");
    const roleValue = String(formData.get("memberRole") ?? "member");

    if (!isOrganizationMembershipRole(roleValue)) {
      setMemberSetupSuccess(null);
      setMemberSetupError("Choose a member role.");
      return;
    }

    setMemberSetupError(null);
    setMemberSetupSuccess(null);
    setIsAddingMember(true);

    try {
      const result = await addOrganizationMember({
        email,
        organizationId,
        role: roleValue,
      });
      setMemberSetupSuccess(
        result.status === "pending"
          ? `Saved ${result.name} as pending ${formatMembershipRole(result.role).toLowerCase()}.`
          : `Saved ${result.name} as ${formatMembershipRole(result.role)}.`,
      );
      form.reset();
    } catch (caughtError) {
      setMemberSetupError(
        caughtError instanceof Error
          ? caughtError.message
          : "Member setup failed.",
      );
    } finally {
      setIsAddingMember(false);
    }
  }

  async function handleApprovePersonConsolidationReview(
    member: OrganizationMember,
  ) {
    const review = member.personConsolidationReview;
    if (!review || review.reviewStatus !== "pending") {
      return;
    }

    setMemberSetupError(null);
    setMemberSetupSuccess(null);
    setPendingReviewApprovalId(review.reviewId);

    try {
      await approvePersonConsolidationReview({
        organizationId,
        personConsolidationReviewId: review.reviewId,
      });
      setMemberSetupSuccess(
        `Approved identity review for ${member.email ?? member.name}.`,
      );
    } catch (caughtError) {
      setMemberSetupError(
        caughtError instanceof Error
          ? caughtError.message
          : "Identity review approval failed.",
      );
    } finally {
      setPendingReviewApprovalId(null);
    }
  }

  async function handleRejectPersonConsolidationReview(
    member: OrganizationMember,
  ) {
    const review = member.personConsolidationReview;
    if (!review || review.reviewStatus !== "pending") {
      return;
    }

    setMemberSetupError(null);
    setMemberSetupSuccess(null);
    setPendingReviewRejectionId(review.reviewId);

    try {
      await rejectPersonConsolidationReview({
        organizationId,
        personConsolidationReviewId: review.reviewId,
      });
      setMemberSetupSuccess(
        `Rejected identity review for ${member.email ?? member.name}.`,
      );
    } catch (caughtError) {
      setMemberSetupError(
        caughtError instanceof Error
          ? caughtError.message
          : "Identity review rejection failed.",
      );
    } finally {
      setPendingReviewRejectionId(null);
    }
  }

  async function handleReopenPersonConsolidationReview(
    member: OrganizationMember,
  ) {
    const review = member.personConsolidationReview;
    if (!review || review.reviewStatus !== "rejected") {
      return;
    }

    setMemberSetupError(null);
    setMemberSetupSuccess(null);
    setPendingReviewReopenId(review.reviewId);

    try {
      await reopenPersonConsolidationReview({
        organizationId,
        personConsolidationReviewId: review.reviewId,
      });
      setMemberSetupSuccess(
        `Reopened identity review for ${member.email ?? member.name}.`,
      );
    } catch (caughtError) {
      setMemberSetupError(
        caughtError instanceof Error
          ? caughtError.message
          : "Identity review reopening failed.",
      );
    } finally {
      setPendingReviewReopenId(null);
    }
  }

  async function handleWithdrawPendingOrganizationMember(
    member: OrganizationMember,
  ) {
    if (!canWithdrawPendingOrganizationMember(member)) {
      return;
    }

    setMemberSetupError(null);
    setMemberSetupSuccess(null);
    setPendingMemberWithdrawalId(member.membershipId);

    try {
      await withdrawPendingOrganizationMember({
        membershipId: member.membershipId,
        organizationId,
      });
      setMemberSetupSuccess(
        `Withdrew pending member ${member.email ?? member.name}.`,
      );
    } catch (caughtError) {
      setMemberSetupError(
        caughtError instanceof Error
          ? caughtError.message
          : "Pending member withdrawal failed.",
      );
    } finally {
      setPendingMemberWithdrawalId(null);
    }
  }

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
        <div className="kb-org-settings-stack">
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
                <dd>
                  {appAccess.systemRole === "systemAdmin" &&
                  routeProfile.role === "preview"
                    ? "System Admin"
                    : formatMembershipRole(profile.role)}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="kb-org-settings-panel kb-org-member-panel"
            aria-labelledby="kb-org-members-heading"
          >
            <header>
              <div>
                <p className="kb-eyebrow">Access</p>
                <h2 id="kb-org-members-heading">Members</h2>
              </div>
              <Users aria-hidden="true" />
            </header>

            {canManageOrganization ? (
              <>
                <form
                  className="kb-org-member-form"
                  onSubmit={(event) => void handleAddOrganizationMember(event)}
                >
                  <label className="kb-org-member-field">
                    <span>Member email</span>
                    <input
                      autoComplete="email"
                      disabled={isAddingMember || didMissOrganization}
                      name="memberEmail"
                      required
                      type="email"
                    />
                  </label>
                  <label className="kb-org-member-field">
                    <span>Role</span>
                    <select
                      defaultValue="member"
                      disabled={isAddingMember || didMissOrganization}
                      name="memberRole"
                    >
                      {ORGANIZATION_MEMBERSHIP_ROLE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="kb-org-member-submit"
                    disabled={isAddingMember || didMissOrganization}
                    type="submit"
                  >
                    {isAddingMember ? (
                      <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
                    ) : (
                      <UserPlus aria-hidden="true" />
                    )}
                    <span>{isAddingMember ? "Saving" : "Add member"}</span>
                  </button>
                </form>

                {memberSetupSuccess ? (
                  <p className="kb-system-admin-success" role="status">
                    <Check aria-hidden="true" />
                    <span>{memberSetupSuccess}</span>
                  </p>
                ) : null}
                {memberSetupError ? (
                  <p className="kb-system-admin-error" role="alert">
                    {memberSetupError}
                  </p>
                ) : null}

                {isLoadingMembers ? (
                  <p className="kb-settings-empty" role="status">
                    Loading members.
                  </p>
                ) : didMissOrganization ? (
                  <p className="kb-settings-empty" role="alert">
                    Organization account not found.
                  </p>
                ) : members.length > 0 ? (
                  <ul className="kb-org-member-list">
                    {members.map((member) => (
                      <li key={member.membershipId}>
                        <div>
                          <strong>{member.name}</strong>
                          <span>{member.email ?? "No email on account"}</span>
                          {member.claimEvidence ? (
                            <span className="kb-org-member-evidence">
                              {formatMembershipClaimEvidence(
                                member.claimEvidence,
                              )}
                            </span>
                          ) : null}
                          {member.personConsolidationReview ? (
                            <span className="kb-org-member-evidence">
                              {formatPersonConsolidationReviewEvidence(
                                member.personConsolidationReview,
                              )}
                            </span>
                          ) : null}
                        </div>
                        <div className="kb-org-member-status-actions">
                          <small>{formatOrganizationMemberStatus(member)}</small>
                          {member.personConsolidationReview?.reviewStatus ===
                          "pending" ? (
                            <button
                              className="kb-org-member-review-submit"
                              disabled={
                                pendingReviewApprovalId ===
                                  member.personConsolidationReview.reviewId ||
                                pendingReviewRejectionId ===
                                  member.personConsolidationReview.reviewId ||
                                pendingReviewReopenId ===
                                  member.personConsolidationReview.reviewId ||
                                pendingMemberWithdrawalId === member.membershipId
                              }
                              onClick={() =>
                                void handleApprovePersonConsolidationReview(member)
                              }
                              type="button"
                            >
                              {pendingReviewApprovalId ===
                              member.personConsolidationReview.reviewId ? (
                                <LoaderCircle
                                  aria-hidden="true"
                                  className="editor-auth-spin"
                                />
                              ) : (
                                <Check aria-hidden="true" />
                              )}
                              <span>
                                {pendingReviewApprovalId ===
                                member.personConsolidationReview.reviewId
                                  ? "Approving"
                                  : "Approve review"}
                              </span>
                            </button>
                          ) : null}
                          {member.personConsolidationReview?.reviewStatus ===
                          "pending" ? (
                            <button
                              className="kb-org-member-review-submit kb-org-member-review-submit-secondary"
                              disabled={
                                pendingReviewApprovalId ===
                                  member.personConsolidationReview.reviewId ||
                                pendingReviewRejectionId ===
                                  member.personConsolidationReview.reviewId ||
                                pendingReviewReopenId ===
                                  member.personConsolidationReview.reviewId ||
                                pendingMemberWithdrawalId === member.membershipId
                              }
                              onClick={() =>
                                void handleRejectPersonConsolidationReview(member)
                              }
                              type="button"
                            >
                              {pendingReviewRejectionId ===
                              member.personConsolidationReview.reviewId ? (
                                <LoaderCircle
                                  aria-hidden="true"
                                  className="editor-auth-spin"
                                />
                              ) : (
                                <X aria-hidden="true" />
                              )}
                              <span>
                                {pendingReviewRejectionId ===
                                member.personConsolidationReview.reviewId
                                  ? "Rejecting"
                                  : "Reject review"}
                              </span>
                            </button>
                          ) : null}
                          {member.personConsolidationReview?.reviewStatus ===
                          "rejected" ? (
                            <button
                              className="kb-org-member-review-submit"
                              disabled={
                                pendingReviewApprovalId ===
                                  member.personConsolidationReview.reviewId ||
                                pendingReviewRejectionId ===
                                  member.personConsolidationReview.reviewId ||
                                pendingReviewReopenId ===
                                  member.personConsolidationReview.reviewId ||
                                pendingMemberWithdrawalId === member.membershipId
                              }
                              onClick={() =>
                                void handleReopenPersonConsolidationReview(member)
                              }
                              type="button"
                            >
                              {pendingReviewReopenId ===
                              member.personConsolidationReview.reviewId ? (
                                <LoaderCircle
                                  aria-hidden="true"
                                  className="editor-auth-spin"
                                />
                              ) : (
                                <RotateCcw aria-hidden="true" />
                              )}
                              <span>
                                {pendingReviewReopenId ===
                                member.personConsolidationReview.reviewId
                                  ? "Reopening"
                                  : "Reopen review"}
                              </span>
                            </button>
                          ) : null}
                          {canWithdrawPendingOrganizationMember(member) ? (
                            <button
                              className="kb-org-member-review-submit kb-org-member-review-submit-secondary"
                              disabled={
                                pendingMemberWithdrawalId === member.membershipId ||
                                pendingReviewApprovalId ===
                                  member.personConsolidationReview?.reviewId ||
                                pendingReviewRejectionId ===
                                  member.personConsolidationReview?.reviewId ||
                                pendingReviewReopenId ===
                                  member.personConsolidationReview?.reviewId
                              }
                              onClick={() =>
                                void handleWithdrawPendingOrganizationMember(member)
                              }
                              type="button"
                            >
                              {pendingMemberWithdrawalId === member.membershipId ? (
                                <LoaderCircle
                                  aria-hidden="true"
                                  className="editor-auth-spin"
                                />
                              ) : (
                                <UserMinus aria-hidden="true" />
                              )}
                              <span>
                                {pendingMemberWithdrawalId === member.membershipId
                                  ? "Withdrawing"
                                  : "Withdraw"}
                              </span>
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="kb-settings-empty">No members.</p>
                )}
              </>
            ) : (
              <p className="kb-settings-empty">Admin role required.</p>
            )}
          </section>
        </div>

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
  appAccess,
  onNavigateToHref,
  pinnedKnowledgePages,
  routeState,
}: {
  appAccess: AllowedAppAccess;
  onNavigateToHref: (href: string) => void;
  pinnedKnowledgePages: SidebarPinnedKnowledgePage[];
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
      <main
        className="kb-main kb-scripture-main"
        data-knowledge-type="biblePassage"
        aria-labelledby="kb-scripture-heading"
      >
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
        data-knowledge-type="biblePassage"
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
      <main
        className="kb-main kb-scripture-main"
        data-knowledge-type="biblePassage"
        aria-labelledby="kb-scripture-heading"
      >
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
      <main
        className="kb-main kb-scripture-main"
        data-knowledge-type="biblePassage"
        aria-labelledby="kb-scripture-heading"
      >
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
        <section className="kb-scripture-empty" role="status">
          {passage.message}
        </section>
      </main>
    );
  }

  const translationLabel = passage.translation
    ? `${passage.translation.name} (${passage.translation.code})`
    : "No translation selected";
  const pageActionTarget = getScriptureKnowledgePageActionTarget(passage);

  function handleVerseReferenceClick(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    event.preventDefault();
    onNavigateToHref(href);
  }

  return (
    <main
      className="kb-main kb-scripture-main"
      data-knowledge-type="biblePassage"
      aria-labelledby="kb-scripture-heading"
    >
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Bible Passage Referent Page</p>
          <h1 id="kb-scripture-heading">{passage.label}</h1>
        </div>
        <div className="kb-route-header-side">
          <KnowledgePageActions
            pinnedKnowledgePages={pinnedKnowledgePages}
            target={pageActionTarget}
          />
          <RouteMeta routeState={routeState} />
        </div>
      </header>

      <section
        className="kb-scripture-panel"
        data-knowledge-type="biblePassage"
        aria-label={`${passage.label} passage text`}
      >
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
                <a
                  className="kb-verse-ref"
                  href={verse.href}
                  onClick={(event) => handleVerseReferenceClick(event, verse.href)}
                >
                  {formatVerseReference(verse)}
                </a>
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
        allowedContributionTypes={getRoute("scripture").allowedContributionTypes}
        appAccess={appAccess}
        components={getRoute("scripture").components}
        label={passage.label}
        onNavigateToHref={onNavigateToHref}
        pinnedKnowledgePages={pinnedKnowledgePages}
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
  showHeader = true,
}: {
  activeTagsOverride?: ActiveTag[];
  children?: ReactNode;
  onNavigateToHref: (href: string) => void;
  routeState: RouteState;
  showHeader?: boolean;
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
  const liveRecommendedTags = useQuery(
    api.tagSuggestions.listKnowledgeNavigatorRecommendedTags,
    { activeTags },
  ) as KnowledgeNavigatorQuerySuggestion[] | undefined;
  const recommendedTags = useMemo(
    () =>
      liveRecommendedTags === undefined
        ? inactiveTags
        : liveRecommendedTags.map((suggestion) => suggestion.tag),
    [inactiveTags, liveRecommendedTags],
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
    <section
      aria-label={showHeader ? undefined : "Knowledge Navigator"}
      aria-labelledby={showHeader ? "kb-knowledge-navigator-heading" : undefined}
      className="kb-knowledge-navigator"
    >
      {showHeader ? (
        <header>
          <div>
            <p className="kb-eyebrow">Knowledge Navigator</p>
            <h2 id="kb-knowledge-navigator-heading">Active Knowledge Context</h2>
          </div>
        </header>
      ) : null}
      <div className="kb-navigator-panel">
        <div className="kb-active-tag-list" aria-label="Active Tags">
          {activeTags.length > 0 ? (
            activeTags.map((tag) => (
              <button
                aria-label={`Remove ${tag.label}`}
                className="kb-active-tag-chip"
                data-knowledge-type={tag.knowledgeType}
                key={tag.id}
                onClick={() => handleRemoveTag(tag.id)}
                title={`Remove ${tag.label}`}
                type="button"
              >
                <ReferentTagVisual
                  className="kb-tag-chip-visual"
                  tag={tag}
                />
                <span>{tag.label}</span>
                <X aria-hidden="true" />
              </button>
            ))
          ) : (
            <p className="kb-navigator-empty">All Accessible Knowledge</p>
          )}
        </div>

        {children ? <div className="kb-navigator-request">{children}</div> : null}

        <div className="kb-add-tag-list" aria-label="Recommended Tags">
          {recommendedTags.map((tag) => (
            <button
              aria-label={`Add ${tag.label}`}
              className="kb-add-tag-button"
              data-knowledge-type={tag.knowledgeType}
              key={tag.id}
              onClick={() => handleAddTag(tag)}
              title={`Add ${tag.label}`}
              type="button"
            >
              <ReferentTagVisual
                className="kb-tag-chip-visual"
                tag={tag}
              />
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

function RouteUnavailablePage({ routeState }: { routeState: RouteState }) {
  return (
    <main className="kb-main kb-scaffold-main" aria-labelledby="kb-route-heading">
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Route</p>
          <h1 id="kb-route-heading">Unavailable</h1>
        </div>
        <RouteMeta routeState={routeState} />
      </header>
      <section className="kb-page-placeholder" role="status">
        <X aria-hidden="true" />
        <span>Unavailable</span>
      </section>
    </main>
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
  return <LogeionBrand density="compact" />;
}
