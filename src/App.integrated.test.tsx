// @vitest-environment happy-dom

import { act } from "react";
import { getFunctionName as getConvexFunctionName } from "convex/server";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";

const mockState = vi.hoisted(() => ({
  appAccess: {
    email: "gelbaughcm@gmail.com",
    organizations: [
      {
        name: "Arche Classical Academy",
        organizationEntryId: "organizationEntry",
        organizationKind: "school",
        organizationReferentId: "organizationReferent",
        role: "admin",
      },
      {
        name: "Ruler of Kings Church",
        organizationEntryId: "churchOrganizationEntry",
        organizationKind: "church",
        organizationReferentId: "churchOrganizationReferent",
        role: "admin",
      },
      {
        name: "My Family",
        organizationEntryId: "familyOrganizationEntry",
        organizationKind: "family",
        organizationReferentId: "familyOrganizationReferent",
        role: "admin",
      },
      {
        name: "My Community",
        organizationEntryId: "communityOrganizationEntry",
        organizationKind: "community",
        organizationReferentId: "communityOrganizationReferent",
        role: "admin",
      },
    ],
    status: "allowed",
    userId: "user",
  } as unknown,
  contactIdentities: {
    contactIdentities: [
      {
        email: "corey@archeclassicalacademy.com",
        id: "contact:corey@archeclassicalacademy.com",
        verificationStatus: "verified",
        verifiedAt: Date.UTC(2026, 5, 10, 12),
      },
      {
        email: "corey@rulerofkingschurch.com",
        id: "contact:corey@rulerofkingschurch.com",
        verificationStatus: "pending",
      },
    ],
    primaryEmail: "gelbaughcm@gmail.com",
    primaryEmailVerified: true,
  } as unknown,
  contextExpertiseVisibilitySettings: {
    globalExpertVisibilityEnabled: false,
  } as unknown,
  profileContextExpertise: {
    profileUserId: "user",
    rows: [],
  } as unknown,
  scopedAggregateMigrationStatus: {
    aggregateSampleLimit: 50,
    continueCursor: "scoped-cursor-1",
    evidenceGroupCount: 2,
    isDone: false,
    legacyAggregateSampleCount: 1,
    mayHaveMoreEvidence: true,
    missingScopedAggregateGroupCount: 1,
    missingScopedAggregateGroups: [
      {
        audienceScopeKind: "organization",
        audienceScopeTargetKey: "organizationReferent",
        contextKey: "first-crusade,matthew-5-9",
        subjectKind: "user",
        subjectUserId: "user",
      },
    ],
    sampledAggregateCount: 3,
    sampledEvidenceCount: 25,
    scopedAggregateSampleCount: 2,
  } as unknown,
  scopedAggregateMigrationDryRunResult: {
    continueCursor: "scoped-cursor-2",
    dryRun: true,
    groupCount: 1,
    groups: [
      {
        audienceScopeKind: "organization",
        audienceScopeTargetKey: "organizationReferent",
        contextKey: "first-crusade,matthew-5-9",
        subjectKind: "user",
        subjectUserId: "user",
      },
    ],
    isDone: false,
    processedEvidenceCount: 25,
    rebuiltGroupCount: 0,
    skippedGroupCount: 0,
  } as unknown,
  quoteAttributionBackfillStatus: {
    attributedQuoteRowCount: 2,
    continueCursor: "quote-cursor-1",
    eligibleQuoteRowCount: 1,
    existingEvidenceCount: 0,
    isDone: false,
    mayHaveMoreQuoteRows: true,
    missingEvidenceCount: 1,
    missingEvidenceItems: [
      {
        action: "missing",
        contextKey: "augustine,first-crusade",
        entryId: "entry-quote-augustine",
        quoteEntryId: "quote-augustine",
        subjectPersonReferentId: "referent-augustine",
      },
    ],
    processedQuoteRowCount: 3,
    skippedQuoteRowCount: 1,
    skippedQuoteRowItems: [
      {
        entryId: "entry-quote-anonymous",
        quoteEntryId: "quote-anonymous",
        skippedReason: "noQuotedPerson",
      },
    ],
  } as unknown,
  quoteAttributionBackfillDryRunResult: {
    attributedQuoteRowCount: 2,
    continueCursor: "quote-cursor-2",
    createdEvidenceCount: 0,
    dryRun: true,
    eligibleQuoteRowCount: 1,
    evidenceItems: [
      {
        action: "wouldCreate",
        contextKey: "augustine,first-crusade",
        entryId: "entry-quote-augustine",
        quoteEntryId: "quote-augustine",
        subjectPersonReferentId: "referent-augustine",
      },
    ],
    existingEvidenceCount: 0,
    isDone: false,
    mayHaveMoreQuoteRows: true,
    missingEvidenceCount: 1,
    processedQuoteRowCount: 3,
    skippedQuoteRowCount: 1,
    skippedQuoteRowItems: [
      {
        entryId: "entry-quote-anonymous",
        quoteEntryId: "quote-anonymous",
        skippedReason: "noQuotedPerson",
      },
    ],
    wouldCreateEvidenceCount: 1,
  } as unknown,
  auth: {
    isAuthenticated: true,
    isLoading: false,
  },
  organizationMembershipMembers: [] as unknown[],
  contextExperts: [] as unknown[],
  contextExpertDetail: null as unknown,
  quoteAttributionPersonOptions: [] as unknown[],
  publicFigureExpertPersonOptions: [] as unknown[],
  personGlobalExpertVisibilityModeration: null as unknown,
  personGlobalExpertVisibilityModerationHistory: [] as unknown[],
  mutationCalls: [] as unknown[],
  actionCalls: [] as unknown[],
  contributionDrafts: new Map<string, Record<string, unknown>>(),
  smartStorageModelRunResult: {
    executionStatus: "proposalCreated",
    smartStorageProposalId: "smart-storage-proposal-raw-chapel-notes",
    smartStorageRunId: "smart-storage-run-raw-chapel-notes",
    status: "drafted",
  } as Record<string, unknown>,
  draftLinkPreviewResult: {
    description: "Friday chapel program.",
    imageUrl: "https://example.com/chapel-program.png",
    siteName: "Example Chapel",
    status: "fetched",
    title: "Chapel Program",
    url: "https://example.com/chapel-program",
  } as Record<string, unknown>,
  smartStorageAcceptReturnsTargetExists: false,
  smartStorageModelRunDelay: null as Promise<void> | null,
  smartStorageSessionSummary: null as Record<string, unknown> | null,
  smartStorageSourceIds: ["source-raw-chapel-notes"] as string[],
  smartStorageStartInput: null as Record<string, unknown> | null,
  tagSuggestions: [
    {
      canonicalKey: "matthew-5-9",
      href: "/scripture/matthew-5-9",
      id: "matthew-5-9",
      knowledgeType: "biblePassage",
      label: "Matthew 5:9",
      matchTerms: ["Matthew 5 9"],
      tag: {
        canonicalKey: "matthew-5-9",
        href: "/scripture/matthew-5-9",
        id: "matthew-5-9",
        knowledgeType: "biblePassage",
        label: "Matthew 5:9",
        passageString: "matthew-5-9",
      },
    },
    {
      canonicalKey: "joshua-1-6-9",
      href: "/scripture/joshua-1-6-9",
      id: "joshua-1-6-9",
      knowledgeType: "biblePassage",
      label: "Joshua 1:6-9",
      tag: {
        canonicalKey: "joshua-1-6-9",
        href: "/scripture/joshua-1-6-9",
        id: "joshua-1-6-9",
        knowledgeType: "biblePassage",
        label: "Joshua 1:6-9",
        passageString: "joshua-1-6-9",
      },
    },
    {
      canonicalKey: "romans-8-28",
      href: "/scripture/romans-8-28",
      id: "romans-8-28",
      knowledgeType: "biblePassage",
      label: "Romans 8:28",
      tag: {
        canonicalKey: "romans-8-28",
        href: "/scripture/romans-8-28",
        id: "romans-8-28",
        knowledgeType: "biblePassage",
        label: "Romans 8:28",
        passageString: "romans-8-28",
      },
    },
    {
      canonicalKey: "first-crusade",
      href: "/goto/first-crusade",
      id: "first-crusade",
      knowledgeType: "topic",
      label: "First Crusade",
      tag: {
        canonicalKey: "first-crusade",
        href: "/goto/first-crusade",
        id: "first-crusade",
        knowledgeType: "topic",
        label: "First Crusade",
      },
    },
    {
      canonicalKey: "the-city-of-god",
      href: "/goto/the-city-of-god",
      id: "the-city-of-god",
      knowledgeType: "book",
      label: "The City of God",
      matchTerms: ["City of God"],
      tag: {
        canonicalKey: "the-city-of-god",
        href: "/goto/the-city-of-god",
        id: "the-city-of-god",
        knowledgeType: "book",
        label: "The City of God",
      },
    },
    {
      canonicalKey: "grade-9-church-history",
      href: "/goto/grade-9-church-history",
      id: "grade-9-church-history",
      knowledgeType: "group",
      label: "Grade 9 Church History",
      tag: {
        canonicalKey: "grade-9-church-history",
        href: "/goto/grade-9-church-history",
        id: "grade-9-church-history",
        knowledgeType: "group",
        label: "Grade 9 Church History",
      },
    },
    {
      canonicalKey: "grade-10-medieval-literature",
      href: "/goto/grade-10-medieval-literature",
      id: "grade-10-medieval-literature",
      knowledgeType: "group",
      label: "Grade 10 Medieval Literature",
      tag: {
        canonicalKey: "grade-10-medieval-literature",
        href: "/goto/grade-10-medieval-literature",
        id: "grade-10-medieval-literature",
        knowledgeType: "group",
        label: "Grade 10 Medieval Literature",
      },
    },
    {
      canonicalKey: "student-crusades-question",
      href: "/goto/student-crusades-question",
      id: "student-crusades-question",
      knowledgeType: "question",
      label: "Student Crusades Question",
      matchTerms: ["Micah", "Crusades Question"],
      tag: {
        canonicalKey: "student-crusades-question",
        href: "/goto/student-crusades-question",
        id: "student-crusades-question",
        knowledgeType: "question",
        label: "Student Crusades Question",
      },
    },
  ] as unknown[],
  rootSearchResults: [
    {
      canonicalKey: "grade-9-church-history",
      href: "/goto/grade-9-church-history",
      id: "grade-9-church-history",
      knowledgeType: "group",
      label: "Grade 9 Church History",
      matchTerms: ["disordered loves", "earthly city", "peace"],
      matchedEntryPreview: {
        href: "/goto/grade-9-church-history",
        id: "entry-first-crusade-ordered-loves",
        knowledgeType: "lesson",
        previewText:
          "Grade 9 Church History prep for teaching the Crusades through Augustine's earthly city, peace, and disordered loves.",
        primaryTagLabel: "Grade 9 Church History",
        title: "Augustine, Ordered Loves, and the First Crusade",
      },
      scopeLabel: "Organization",
      tag: {
        canonicalKey: "grade-9-church-history",
        href: "/goto/grade-9-church-history",
        id: "grade-9-church-history",
        knowledgeType: "group",
        label: "Grade 9 Church History",
      },
    },
    {
      canonicalKey: "robinson-crusoe",
      href: "/goto/robinson-crusoe",
      id: "robinson-crusoe",
      knowledgeType: "book",
      label: "Robinson Crusoe",
      matchTerms: ["Robinson Crusoe"],
      scopeLabel: "Global",
      tag: {
        canonicalKey: "robinson-crusoe",
        href: "/goto/robinson-crusoe",
        id: "robinson-crusoe",
        knowledgeType: "book",
        label: "Robinson Crusoe",
      },
    },
  ] as unknown[],
  pinnedKnowledgePages: [
    {
      href: "/organizations/organizationReferent",
      id: "organizationReferent",
      label: "Arche Classical Academy",
      organizationKind: "school",
      organizationName: "Arche Classical Academy",
      organizationReferentId: "organizationReferent",
      pageKey: "organization:organizationReferent",
      pinSource: "defaultSeed",
      secondaryLabel: "School",
      sortOrder: 0,
    },
    {
      href: "/organizations/churchOrganizationReferent",
      id: "churchOrganizationReferent",
      label: "Ruler of Kings Church",
      organizationKind: "church",
      organizationName: "Ruler of Kings Church",
      organizationReferentId: "churchOrganizationReferent",
      pageKey: "organization:churchOrganizationReferent",
      pinSource: "defaultSeed",
      secondaryLabel: "Church",
      sortOrder: 1000,
    },
    {
      href: "/organizations/familyOrganizationReferent",
      id: "familyOrganizationReferent",
      label: "My Family",
      organizationKind: "family",
      organizationName: "My Family",
      organizationReferentId: "familyOrganizationReferent",
      pageKey: "organization:familyOrganizationReferent",
      pinSource: "defaultSeed",
      secondaryLabel: "Family",
      sortOrder: 2000,
    },
    {
      href: "/organizations/communityOrganizationReferent",
      id: "communityOrganizationReferent",
      label: "My Community",
      organizationKind: "community",
      organizationName: "My Community",
      organizationReferentId: "communityOrganizationReferent",
      pageKey: "organization:communityOrganizationReferent",
      pinSource: "defaultSeed",
      secondaryLabel: "Community",
      sortOrder: 3000,
    },
  ] as unknown[],
  bookmarkedKnowledgePages: [] as unknown[],
  knowledgeSubscriptions: [] as unknown[],
  answerFeedItems: [
    {
      kind: "answer",
      contextTagIds: [
        "matthew-5-9",
        "first-crusade",
        "the-city-of-god",
        "augustine",
        "grade-9-church-history",
        "ordered-loves",
      ],
      entry: {
        contributor: {
          id: "contributor-caleb-gelbaugh",
          name: "Caleb Gelbaugh",
        },
        id: "entry-first-crusade-ordered-loves",
        title: "Augustine, Ordered Loves, and the First Crusade",
        knowledgeType: "lesson",
        previewText:
          "Grade 9 Church History prep for teaching the Crusades through Augustine's earthly city, peace, and disordered loves.",
        primaryTagLabel: "Grade 9 Church History",
        contextPreviewTagLabels: [
          "Matthew 5:9",
          "First Crusade",
          "The City of God",
          "Grade 9 Church History",
        ],
        humanWeight: 94,
        href: "/entries/entry-first-crusade-ordered-loves",
        updatedAt: Date.UTC(2026, 5, 12, 14),
      },
    },
    {
      kind: "slot",
      contextTagIds: [
        "matthew-5-9",
        "first-crusade",
        "grade-9-church-history",
        "student-crusades-question",
      ],
      slot: {
        id: "slot-student-crusades-question",
        title: "Answer Micah's Crusades question",
        requestedKnowledgeType: "comment",
        promptText:
          "Micah asked whether the First Crusade shows Christian courage, zeal without knowledge, or presumption. Answer before seminar.",
        status: "open",
        contextPreviewTagLabels: [
          "Matthew 5:9",
          "First Crusade",
          "Grade 9 Church History",
        ],
        targetLabel: "Grade 9 Church History",
        dueAt: Date.UTC(2026, 5, 12, 12),
        href: "/slots/slot-student-crusades-question",
      },
    },
  ] as unknown[],
  assignedTodoSlots: [
    {
      id: "slot-assigned-chapel-follow-up",
      title: "Draft chapel follow-up",
      requestedKnowledgeType: "comment",
      promptText: "Write the follow-up note from Friday chapel before the family email goes out.",
      status: "overdue",
      contextPreviewTagLabels: ["Joshua 1:6-9", "Friday Chapel"],
      targetLabel: "Caleb Gelbaugh",
      dueAt: Date.UTC(2026, 5, 12, 10),
      href: "/slots/slot-assigned-chapel-follow-up",
    },
    {
      id: "slot-assigned-boethius-lesson",
      title: "Prepare Boethius providence lesson",
      requestedKnowledgeType: "lesson",
      promptText: "Add the missing lesson plan for providence and ordered loves.",
      status: "open",
      contextPreviewTagLabels: ["Boethius", "Romans 8:28"],
      targetLabel: "Caleb Gelbaugh",
      dueAt: Date.UTC(2026, 5, 13, 14),
      href: "/slots/slot-assigned-boethius-lesson",
    },
  ] as unknown[],
  userNotifications: [
    {
      id: "notice-slot-student-crusades-question",
      title: "Micah's Crusades question is waiting",
      body:
        "A Grade 9 requested entry needs your answer before the Church History seminar.",
      contextLabel: "First Crusade + Matthew 5:9",
      contextHref: "/explore?tagIds=first-crusade,matthew-5-9",
      kind: "knowledgeSlot",
      receivedAt: Date.UTC(2026, 5, 12, 12, 4),
      status: "unread",
    },
    {
      id: "notice-medieval-literature-lesson",
      title: "Grade 10 Medieval Literature starts at 1:30 PM",
      body:
        "Your Boethius lesson is still open in the Knowledge Context for providence.",
      contextLabel: "Boethius + Romans 8:28",
      contextHref: "/explore?tagIds=boethius,grade-10-medieval-literature,romans-8-28",
      kind: "event",
      receivedAt: Date.UTC(2026, 5, 12, 11, 45),
      status: "unread",
    },
    {
      id: "notice-pride-leads-to-death",
      title: "Pride Leads to Death is on Sunday's calendar",
      body:
        "Ruler of Kings Church has the Daniel 4 sermon event confirmed for June 14.",
      contextLabel: "Daniel 4",
      contextHref: "/scripture/daniel-4",
      kind: "event",
      receivedAt: Date.UTC(2026, 5, 12, 10, 15),
      status: "unread",
    },
    {
      id: "notice-trial-by-fire-follow-up",
      title: "Trial by Fire received follow-up notes",
      body:
        "The Daniel 3 sermon event now has deacon follow-up material attached.",
      contextLabel: "Daniel 3",
      contextHref: "/scripture/daniel-3",
      kind: "subscription",
      receivedAt: Date.UTC(2026, 5, 11, 16, 20),
      status: "read",
    },
  ] as unknown[],
}));

type MockSmartStorageRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "noProposal"
  | "failed"
  | "superseded";
type MockSmartStorageProposalRole =
  | "primary"
  | "prerequisite"
  | "secondary"
  | "referenceResolution"
  | "refresh"
  | "reprocessing"
  | "cleanup";
type MockSmartStorageProposalStatus =
  | "drafted"
  | "needsResolution"
  | "accepted"
  | "rejected"
  | "stale";
type MockSmartStorageAcceptabilityStatus =
  | "ready"
  | "blocked"
  | "needsResolution"
  | "accepted"
  | "closed";

function createMockSmartStorageSessionSummary({
  acceptedPrimaryEntry,
  activeRunStatus,
  latestRunErrorMessage,
  latestRunStatus,
  pendingSecondaryProposals = [],
  prerequisiteProposals = [],
  primaryProposal,
  state,
}: {
  acceptedPrimaryEntry?: Record<string, unknown>;
  activeRunStatus?: MockSmartStorageRunStatus;
  latestRunErrorMessage?: string;
  latestRunStatus?: MockSmartStorageRunStatus;
  pendingSecondaryProposals?: Record<string, unknown>[];
  prerequisiteProposals?: Record<string, unknown>[];
  primaryProposal?: Record<string, unknown>;
  state: string;
}) {
  const startInput = mockState.smartStorageStartInput ?? {};
  const sourceIds = mockState.smartStorageSourceIds;
  const latestRun = latestRunStatus
    ? createMockSmartStorageRun(latestRunStatus, latestRunErrorMessage)
    : undefined;
  const activeRun = activeRunStatus
    ? createMockSmartStorageRun(activeRunStatus)
    : undefined;

  return {
    ...(acceptedPrimaryEntry === undefined ? {} : { acceptedPrimaryEntry }),
    ...(activeRun === undefined ? {} : { activeRun }),
    contributionSubmission: {
      bodyPreview: String(
        startInput.body ?? "A source that should be preserved before enrichment.",
      ),
      createdAt: Date.UTC(2026, 5, 12, 14),
      id: "contribution-submission-raw-chapel-notes",
      primaryIntendedKnowledgeType: String(startInput.knowledgeType ?? "words"),
      status:
        acceptedPrimaryEntry === undefined
          ? primaryProposal === undefined
            ? "processing"
            : "reviewReady"
          : "accepted",
      title: String(startInput.title ?? "Raw chapel notes"),
      updatedAt: Date.UTC(2026, 5, 12, 14, 1),
    },
    isComplete: false,
    ...(latestRun === undefined ? {} : { latestRun }),
    pendingSecondaryProposals,
    prerequisiteProposals,
    ...(primaryProposal === undefined ? {} : { primaryProposal }),
    proposalCountsByStatus: {
      accepted: acceptedPrimaryEntry === undefined ? 0 : 1,
      drafted:
        (primaryProposal && acceptedPrimaryEntry === undefined ? 1 : 0) +
        prerequisiteProposals.length +
        pendingSecondaryProposals.length,
      needsResolution:
        primaryProposal && primaryProposal.status === "needsResolution" ? 1 : 0,
      rejected: 0,
      stale: 0,
      total:
        (primaryProposal === undefined ? 0 : 1) +
        prerequisiteProposals.length +
        pendingSecondaryProposals.length,
    },
    sourceCounts: {
      externalUrl: sourceIds.filter((sourceId) =>
        sourceId.includes("external-url"),
      ).length,
      manualEntry: 0,
      pastedText: sourceIds.includes("source-raw-chapel-notes") ? 1 : 0,
      total: sourceIds.length,
      uploadedFile: sourceIds.filter((sourceId) =>
        sourceId.includes("uploaded-file"),
      ).length,
    },
    state,
  };
}

function createMockSmartStorageRun(
  status: MockSmartStorageRunStatus,
  errorMessage?: string,
) {
  return {
    completedAt:
      status === "queued" || status === "running"
        ? undefined
        : Date.UTC(2026, 5, 12, 14, 2),
    ...(errorMessage === undefined ? {} : { errorMessage }),
    id: "smart-storage-run-raw-chapel-notes",
    status,
    updatedAt: Date.UTC(2026, 5, 12, 14, 2),
  };
}

function createMockSmartStorageSessionProposal({
  acceptabilityStatus,
  blockedByProposalIds = [],
  blockedReason,
  dependency,
  id,
  role,
  status = "drafted",
  title,
}: {
  acceptabilityStatus: MockSmartStorageAcceptabilityStatus;
  blockedByProposalIds?: string[];
  blockedReason?: string;
  dependency?: Record<string, unknown>;
  id?: string;
  role: MockSmartStorageProposalRole;
  status?: MockSmartStorageProposalStatus;
  title?: string;
}) {
  const startInput = mockState.smartStorageStartInput ?? {};
  const body = String(
    startInput.body ?? "A source that should be preserved before enrichment.",
  );
  const proposalTitle = title ?? String(startInput.title ?? "Raw chapel notes");
  const proposalId =
    id ??
    (role === "prerequisite"
      ? "smart-storage-proposal-required-speaker"
      : role === "secondary"
        ? "smart-storage-proposal-secondary-quote"
        : "smart-storage-proposal-raw-chapel-notes");
  const sourceCitations = createMockSmartStorageSourceCitations();

  return {
    acceptReady: acceptabilityStatus === "ready",
    acceptability: {
      blockedByProposalIds,
      ...(blockedReason === undefined ? {} : { reason: blockedReason }),
      status: acceptabilityStatus,
    },
    contributionSubmissionId: "contribution-submission-raw-chapel-notes",
    createdAt: Date.UTC(2026, 5, 12, 14, role === "primary" ? 2 : 3),
    currentProposal: {
      bodyPreview:
        role === "prerequisite"
          ? "Confirm the speaker before accepting the sermon."
          : role === "secondary"
            ? "A later secondary review item from the same saved Sources."
            : body,
      contextTags: [],
      knowledgeType:
        role === "prerequisite"
          ? "person"
          : role === "secondary"
            ? "quote"
            : String(startInput.knowledgeType ?? "words"),
      proposalConfidence: role === "primary" ? "medium" : "high",
      rationale:
        "Deterministic MVP proposal generated from the submitted Source and requested Knowledge Type.",
      title:
        role === "prerequisite"
          ? "Rev. Thomas Walker"
          : role === "secondary"
            ? "Courage quote"
            : proposalTitle,
    },
    ...(dependency === undefined ? {} : { dependency }),
    id: proposalId,
    role,
    smartStorageRunId: "smart-storage-run-raw-chapel-notes",
    sourceCitations: role === "secondary" ? [] : sourceCitations,
    sourceId: "source-raw-chapel-notes",
    sourceIds: mockState.smartStorageSourceIds,
    status,
    updatedAt: Date.UTC(2026, 5, 12, 14, 3),
  };
}

function createMockSmartStorageSourceCitations() {
  const startInput = mockState.smartStorageStartInput ?? {};
  const body = String(
    startInput.body ?? "A source that should be preserved before enrichment.",
  );
  const externalUrls = Array.isArray(startInput.externalUrls)
    ? (startInput.externalUrls as Array<{ url?: unknown }>)
    : [];
  const uploadedFiles = Array.isArray(startInput.uploadedFiles)
    ? (startInput.uploadedFiles as Array<{ fileName?: unknown }>)
    : [];

  return [
    {
      citationKind: "textExcerpt",
      excerptText: body,
      id: "proposal-source-citation-raw-chapel-notes",
      rationale: "Authored Text Source preserved with the submission.",
      sourceId: "source-raw-chapel-notes",
    },
    ...externalUrls.map((externalUrl, index) => ({
      citationKind: "externalUrl" as const,
      externalUrl: String(externalUrl.url ?? ""),
      id: `proposal-source-citation-external-url-${index + 1}`,
      rationale: "External URL Source preserved with the submission.",
      sourceId: `source-external-url-${index + 1}`,
    })),
    ...uploadedFiles.map((uploadedFile, index) => ({
      citationKind: "fileLocator" as const,
      id: `proposal-source-citation-uploaded-file-${index + 1}`,
      locator: String(uploadedFile.fileName ?? "Uploaded file"),
      rationale: "Uploaded file Source preserved with the submission.",
      sourceId: `source-uploaded-file-${index + 1}`,
    })),
  ];
}

function createMockSmartStoragePrerequisiteSessionSummary() {
  const prerequisite = createMockSmartStorageSessionProposal({
    acceptabilityStatus: "ready",
    dependency: {
      label: "Speaker",
      requiredByProposalId: "smart-storage-proposal-raw-chapel-notes",
      requirementKey: "person:rev-thomas-walker",
      requirementKind: "referent",
    },
    role: "prerequisite",
  });
  const primary = createMockSmartStorageSessionProposal({
    acceptabilityStatus: "blocked",
    blockedByProposalIds: ["smart-storage-proposal-required-speaker"],
    blockedReason: "prerequisitesPending",
    role: "primary",
    title: "Courage in Christ's Kingdom",
  });
  const secondary = createMockSmartStorageSessionProposal({
    acceptabilityStatus: "blocked",
    blockedByProposalIds: ["smart-storage-proposal-raw-chapel-notes"],
    blockedReason: "primaryAnchorRequired",
    role: "secondary",
  });

  return createMockSmartStorageSessionSummary({
    latestRunStatus: "succeeded",
    pendingSecondaryProposals: [secondary],
    prerequisiteProposals: [prerequisite],
    primaryProposal: primary,
    state: "awaitingPrerequisites",
  });
}

function createMockSmartStorageTargetExistsSessionSummary() {
  return createMockSmartStorageSessionSummary({
    latestRunStatus: "succeeded",
    primaryProposal: createMockSmartStorageSessionProposal({
      acceptabilityStatus: "needsResolution",
      role: "primary",
      status: "needsResolution",
    }),
    state: "awaitingPrerequisites",
  });
}

function createMockSmartStorageAcceptedSessionSummary(
  entry: Record<string, unknown>,
) {
  return createMockSmartStorageSessionSummary({
    acceptedPrimaryEntry: entry,
    latestRunStatus: "succeeded",
    primaryProposal: createMockSmartStorageSessionProposal({
      acceptabilityStatus: "accepted",
      role: "primary",
      status: "accepted",
    }),
    state: "primarySaved",
  });
}

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: async () => undefined,
    signOut: async () => undefined,
  }),
  useConvexAuth: () => mockState.auth,
}));

vi.mock("convex/react", () => ({
  useAction: (action: unknown) => async (args: unknown) => {
    const functionName = getFunctionName(action);
    mockState.actionCalls.push(
      args && typeof args === "object"
        ? { ...args, functionName }
        : { args, functionName },
    );

    if (functionName === "smartStorage:executeModelRun") {
      if (mockState.smartStorageModelRunDelay) {
        await mockState.smartStorageModelRunDelay;
      }
      const result = {
        ...mockState.smartStorageModelRunResult,
        smartStorageRunId: "smart-storage-run-raw-chapel-notes",
      } as Record<string, unknown> & {
        errorMessage?: unknown;
        executionStatus?: unknown;
        smartStorageRunId: string;
      };
      if (
        result.executionStatus === "proposalCreated" ||
        result.executionStatus === "existingProposal"
      ) {
        mockState.smartStorageSessionSummary = createMockSmartStorageSessionSummary({
          latestRunStatus: "succeeded",
          primaryProposal: createMockSmartStorageSessionProposal({
            acceptabilityStatus: "ready",
            role: "primary",
          }),
          state: "primaryReady",
        });
      } else {
        mockState.smartStorageSessionSummary = createMockSmartStorageSessionSummary({
          latestRunErrorMessage:
            typeof result.errorMessage === "string" ? result.errorMessage : undefined,
          latestRunStatus:
            result.executionStatus === "noProposal" ? "noProposal" : "failed",
          state: "primaryReady",
        });
      }

      return result;
    }

    if (
      functionName === "smartStorage:previewDraftExternalUrl" &&
      args &&
      typeof args === "object" &&
      "url" in args
    ) {
      const url = String(args.url);
      return {
        ...mockState.draftLinkPreviewResult,
        url,
      };
    }

    if (
      functionName === "contactIdentities:sendEmailVerificationCode" &&
      args &&
      typeof args === "object" &&
      "email" in args
    ) {
      const email = String(args.email).trim().toLowerCase();
      const verificationStatus =
        email === "verified.alias@example.com" ? "verified" : "pending";
      const contactIdentity = {
        email,
        id: `contact:${email}`,
        verificationStatus,
        ...(verificationStatus === "verified"
          ? { verifiedAt: Date.UTC(2026, 5, 12, 13) }
          : {}),
      };
      mockState.contactIdentities = {
        ...(mockState.contactIdentities as Record<string, unknown>),
        contactIdentities: [
          contactIdentity,
          ...(
            (mockState.contactIdentities as {
              contactIdentities?: Array<{ email?: string }>;
            }).contactIdentities ?? []
          ).filter((identity) => identity.email !== email),
        ],
      };
      return {
        contactIdentityId: `contact:${email}`,
        email,
        verificationStatus,
      };
    }

    return {};
  },
  useMutation: (mutation: unknown) => async (args: unknown) => {
    const functionName = getFunctionName(mutation);
    mockState.mutationCalls.push(
      args && typeof args === "object"
        ? { ...args, functionName }
        : { args, functionName },
    );
    if (
      functionName === "contextExpertiseSettings:updateGlobalExpertVisibility" &&
      args &&
      typeof args === "object" &&
      "enabled" in args
    ) {
      mockState.contextExpertiseVisibilitySettings = {
        globalExpertVisibilityEnabled: Boolean(args.enabled),
      };
    }
    if (
      functionName === "contributionDrafts:save" &&
      args &&
      typeof args === "object" &&
      "draftKey" in args
    ) {
      const draftKey = String(args.draftKey);
      mockState.contributionDrafts.set(draftKey, {
        ...(args as Record<string, unknown>),
        draftKey,
      });

      return { draftId: `draft:${draftKey}` };
    }
    if (
      functionName === "contributionDrafts:clear" &&
      args &&
      typeof args === "object" &&
      "draftKey" in args
    ) {
      mockState.contributionDrafts.delete(String(args.draftKey));
      return { cleared: true };
    }
    if (
      functionName ===
        "contextExpertise:updatePersonGlobalExpertVisibilityModeration" &&
      args &&
      typeof args === "object" &&
      "personReferentId" in args &&
      "suppressed" in args
    ) {
      const input = args as {
        moderationNote?: string;
        personReferentId: string;
        suppressed: boolean;
      };
      const option = (
        mockState.publicFigureExpertPersonOptions as Array<{
          label?: string;
          referentId?: string;
        }>
      ).find((candidate) => candidate.referentId === input.personReferentId);
      const previousModeration =
        mockState.personGlobalExpertVisibilityModeration as
          | {
              moderationNote?: string;
              status?: "visibleByDefault" | "suppressed";
            }
          | null;
      const previousStatus =
        previousModeration?.status === "suppressed"
          ? "suppressed"
          : "visibleByDefault";
      const createdAt =
        Date.UTC(2026, 5, 19, 21, 0) +
        (mockState.personGlobalExpertVisibilityModerationHistory as unknown[])
          .length;

      if (input.suppressed && previousStatus === "visibleByDefault") {
        mockState.personGlobalExpertVisibilityModerationHistory = [
          {
            action: "suppressed",
            createdAt,
            eventId: `public-figure-event-${createdAt}`,
            ...(input.moderationNote
              ? { moderationNote: input.moderationNote }
              : {}),
            nextStatus: "suppressed",
            personReferentId: input.personReferentId,
            previousStatus,
            updatedByUserId: "system-admin-user",
          },
          ...(mockState.personGlobalExpertVisibilityModerationHistory as unknown[]),
        ];
      } else if (
        input.suppressed &&
        previousStatus === "suppressed" &&
        input.moderationNote &&
        input.moderationNote !== previousModeration?.moderationNote
      ) {
        mockState.personGlobalExpertVisibilityModerationHistory = [
          {
            action: "suppressionNoteUpdated",
            createdAt,
            eventId: `public-figure-event-${createdAt}`,
            moderationNote: input.moderationNote,
            nextStatus: "suppressed",
            personReferentId: input.personReferentId,
            ...(previousModeration?.moderationNote
              ? { previousModerationNote: previousModeration.moderationNote }
              : {}),
            previousStatus,
            updatedByUserId: "system-admin-user",
          },
          ...(mockState.personGlobalExpertVisibilityModerationHistory as unknown[]),
        ];
      } else if (!input.suppressed && previousStatus === "suppressed") {
        mockState.personGlobalExpertVisibilityModerationHistory = [
          {
            action: "restored",
            createdAt,
            eventId: `public-figure-event-${createdAt}`,
            nextStatus: "visibleByDefault",
            personReferentId: input.personReferentId,
            ...(previousModeration?.moderationNote
              ? { previousModerationNote: previousModeration.moderationNote }
              : {}),
            previousStatus,
            updatedByUserId: "system-admin-user",
          },
          ...(mockState.personGlobalExpertVisibilityModerationHistory as unknown[]),
        ];
      }
      mockState.personGlobalExpertVisibilityModeration = {
        ...(input.suppressed && (input.moderationNote ?? previousModeration?.moderationNote)
          ? {
              moderationNote:
                input.moderationNote ?? previousModeration?.moderationNote,
            }
          : {}),
        personLabel: option?.label ?? "Selected Person",
        personReferentId: input.personReferentId,
        status: input.suppressed ? "suppressed" : "visibleByDefault",
      };
      return mockState.personGlobalExpertVisibilityModeration;
    }
    if (functionName === "contextExpertise:rebuildScopedAggregateBatch") {
      return mockState.scopedAggregateMigrationDryRunResult;
    }
    if (
      functionName === "contextExpertise:backfillQuoteAttributionEvidenceBatch"
    ) {
      return mockState.quoteAttributionBackfillDryRunResult;
    }
    if (
      functionName === "pinnedKnowledgePages:unpinKnowledgePage" &&
      args &&
      typeof args === "object" &&
      "pageKey" in args
    ) {
      mockState.pinnedKnowledgePages = mockState.pinnedKnowledgePages.filter(
        (pin) =>
          !(
            pin &&
            typeof pin === "object" &&
            "pageKey" in pin &&
            pin.pageKey === args.pageKey
          ),
      );
    }
    if (
      functionName === "pinnedKnowledgePages:pinOrganizationPage" &&
      args &&
      typeof args === "object" &&
      "organizationReferentId" in args
    ) {
      const organization = (
        mockState.appAccess as {
          organizations?: Array<{
            name: string;
            organizationKind: string;
            organizationReferentId: string;
          }>;
        }
      ).organizations?.find(
        (candidate) =>
          candidate.organizationReferentId === args.organizationReferentId,
      );
      if (organization) {
        const defaultSortOrderByKind: Record<string, number> = {
          school: 0,
          church: 1000,
          family: 2000,
          community: 3000,
        };
        mockState.pinnedKnowledgePages = [
          ...mockState.pinnedKnowledgePages,
          {
            href: `/organizations/${organization.organizationReferentId}`,
            id: organization.organizationReferentId,
            label: organization.name,
            organizationKind: organization.organizationKind,
            organizationName: organization.name,
            organizationReferentId: organization.organizationReferentId,
            pageKey: `organization:${organization.organizationReferentId}`,
            pinSource: "manual",
            secondaryLabel:
              organization.organizationKind.charAt(0).toUpperCase() +
              organization.organizationKind.slice(1),
            sortOrder:
              defaultSortOrderByKind[organization.organizationKind] ??
              mockState.pinnedKnowledgePages.length * 1000,
          },
        ].sort((left, right) => {
          const leftSortOrder =
            left && typeof left === "object" && "sortOrder" in left
              ? Number(left.sortOrder)
              : 0;
          const rightSortOrder =
            right && typeof right === "object" && "sortOrder" in right
              ? Number(right.sortOrder)
              : 0;

          return leftSortOrder - rightSortOrder;
        });
      }
    }
    if (
      functionName === "bookmarkedKnowledgePages:removeBookmark" &&
      args &&
      typeof args === "object" &&
      "pageKey" in args
    ) {
      mockState.bookmarkedKnowledgePages = mockState.bookmarkedKnowledgePages.filter(
        (bookmark) =>
          !(
            bookmark &&
            typeof bookmark === "object" &&
            "pageKey" in bookmark &&
            bookmark.pageKey === args.pageKey
          ),
      );
    }
    if (
      functionName === "bookmarkedKnowledgePages:bookmarkOrganizationPage" &&
      args &&
      typeof args === "object" &&
      "organizationReferentId" in args
    ) {
      const organization = (
        mockState.appAccess as {
          organizations?: Array<{
            name: string;
            organizationKind: string;
            organizationReferentId: string;
          }>;
        }
      ).organizations?.find(
        (candidate) =>
          candidate.organizationReferentId === args.organizationReferentId,
      );
      if (organization) {
        const pageKey = `organization:${organization.organizationReferentId}`;
        mockState.bookmarkedKnowledgePages = [
          ...mockState.bookmarkedKnowledgePages.filter(
            (bookmark) =>
              !(
                bookmark &&
                typeof bookmark === "object" &&
                "pageKey" in bookmark &&
                bookmark.pageKey === pageKey
              ),
          ),
          {
            createdAt: 1,
            href: `/organizations/${organization.organizationReferentId}`,
            id: organization.organizationReferentId,
            label: organization.name,
            organizationKind: organization.organizationKind,
            organizationName: organization.name,
            organizationReferentId: organization.organizationReferentId,
            pageKey,
            secondaryLabel:
              organization.organizationKind.charAt(0).toUpperCase() +
              organization.organizationKind.slice(1),
            updatedAt: 2,
          },
        ];
      }
    }
    if (
      functionName === "knowledgeSubscriptions:unsubscribe" &&
      args &&
      typeof args === "object" &&
      "subscriptionKey" in args
    ) {
      mockState.knowledgeSubscriptions = mockState.knowledgeSubscriptions.filter(
        (subscription) =>
          !(
            subscription &&
            typeof subscription === "object" &&
            "subscriptionKey" in subscription &&
            subscription.subscriptionKey === args.subscriptionKey
          ),
      );
    }
    if (
      functionName === "knowledgeSubscriptions:subscribeOrganizationPage" &&
      args &&
      typeof args === "object" &&
      "organizationReferentId" in args
    ) {
      const organization = (
        mockState.appAccess as {
          organizations?: Array<{
            name: string;
            organizationKind: string;
            organizationReferentId: string;
          }>;
        }
      ).organizations?.find(
        (candidate) =>
          candidate.organizationReferentId === args.organizationReferentId,
      );
      if (organization) {
        const subscriptionKey = `organization:${organization.organizationReferentId}`;
        mockState.knowledgeSubscriptions = [
          ...mockState.knowledgeSubscriptions.filter(
            (subscription) =>
              !(
                subscription &&
                typeof subscription === "object" &&
                "subscriptionKey" in subscription &&
                subscription.subscriptionKey === subscriptionKey
              ),
          ),
          {
            createdAt: 1,
            href: `/organizations/${organization.organizationReferentId}`,
            id: organization.organizationReferentId,
            label: organization.name,
            organizationKind: organization.organizationKind,
            organizationName: organization.name,
            organizationReferentId: organization.organizationReferentId,
            secondaryLabel:
              organization.organizationKind.charAt(0).toUpperCase() +
              organization.organizationKind.slice(1),
            subscriptionKey,
            targetKind: "organization",
            targetReferentId: organization.organizationReferentId,
            updatedAt: 2,
          },
        ];
      }
    }
    if (
      functionName === "organizationAccounts:createOrganizationAccount" &&
      args &&
      typeof args === "object" &&
      "name" in args &&
      "organizationKind" in args
    ) {
      const name = String(args.name);
      const canonicalKey = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      return {
        canonicalKey,
        href: `/organizations/${canonicalKey}`,
        name,
        organizationEntryId: `${canonicalKey}Entry`,
        organizationKind: args.organizationKind,
        organizationReferentId: `${canonicalKey}Referent`,
      };
    }
    if (
      functionName === "organizationAccounts:addOrganizationMember" &&
      args &&
      typeof args === "object" &&
      "email" in args &&
      "role" in args
    ) {
      const email = String(args.email).trim().toLowerCase();
      return {
        email,
        membershipId: `membership:${email}`,
        name: email,
        role: args.role,
        status: "pending",
      };
    }
    if (
      functionName === "organizationAccounts:approvePersonConsolidationReview" &&
      args &&
      typeof args === "object" &&
      "personConsolidationReviewId" in args
    ) {
      return {
        membershipId: "membership:pending-teacher",
        reviewStatus: "approved",
      };
    }
    if (
      functionName === "organizationAccounts:rejectPersonConsolidationReview" &&
      args &&
      typeof args === "object" &&
      "personConsolidationReviewId" in args
    ) {
      return {
        membershipId: "membership:pending-teacher",
        reviewStatus: "rejected",
      };
    }
    if (
      functionName === "organizationAccounts:reopenPersonConsolidationReview" &&
      args &&
      typeof args === "object" &&
      "personConsolidationReviewId" in args
    ) {
      return {
        membershipId: "membership:rejected-teacher",
        reviewStatus: "pending",
      };
    }
    if (
      functionName === "organizationAccounts:withdrawPendingOrganizationMember" &&
      args &&
      typeof args === "object" &&
      "membershipId" in args
    ) {
      return {
        membershipId: args.membershipId,
        membershipStatus: "inactive",
      };
    }
    if (
      functionName === "contactIdentities:requestEmailVerification" &&
      args &&
      typeof args === "object" &&
      "email" in args
    ) {
      const email = String(args.email).trim().toLowerCase();
      return {
        contactIdentityId: `contact:${email}`,
        email,
        verificationStatus: "pending",
      };
    }
    if (
      functionName === "contactIdentities:verifyEmailAndClaimPendingMemberships" &&
      args &&
      typeof args === "object" &&
      "email" in args
    ) {
      const email = String(args.email).trim().toLowerCase();
      mockState.contactIdentities = {
        ...(mockState.contactIdentities as Record<string, unknown>),
        contactIdentities: [
          {
            email,
            id: `contact:${email}`,
            verificationStatus: "verified",
            verifiedAt: Date.UTC(2026, 5, 12, 13),
          },
          ...(
            (mockState.contactIdentities as {
              contactIdentities?: Array<{ email?: string }>;
            }).contactIdentities ?? []
          ).filter((identity) => identity.email !== email),
        ],
      };
      if (email === "review@example.com") {
        return {
          claimedMembershipCount: 0,
          email,
          memberships: [],
          personConsolidationReviewCount: 1,
          personConsolidationReviews: [
            {
              membershipId: "membership:review-needed",
              organizationReferentId: "organizationReferent",
              role: "member",
            },
          ],
          personConsolidationRejectionCount: 0,
          personConsolidationRejections: [],
          verificationStatus: "verified",
        };
      }
      if (email === "rejected@example.com") {
        return {
          claimedMembershipCount: 0,
          email,
          memberships: [],
          personConsolidationReviewCount: 0,
          personConsolidationReviews: [],
          personConsolidationRejectionCount: 1,
          personConsolidationRejections: [
            {
              membershipId: "membership:rejected-review",
              organizationReferentId: "organizationReferent",
              role: "member",
            },
          ],
          verificationStatus: "verified",
        };
      }

      return {
        claimedMembershipCount: 2,
        email,
        memberships: [
          {
            membershipId: "membership:claimed-school",
            organizationReferentId: "organizationReferent",
            role: "member",
          },
          {
            membershipId: "membership:claimed-church",
            organizationReferentId: "churchOrganizationReferent",
            role: "admin",
          },
        ],
        personConsolidationReviewCount: 0,
        personConsolidationReviews: [],
        personConsolidationRejectionCount: 0,
        personConsolidationRejections: [],
        verificationStatus: "verified",
      };
    }
    if (
      functionName === "contactIdentities:claimVerifiedEmailMemberships" &&
      args &&
      typeof args === "object" &&
      "email" in args
    ) {
      const email = String(args.email).trim().toLowerCase();
      return {
        claimedMembershipCount: 1,
        email,
        memberships: [
          {
            membershipId: "membership:claimed-verified",
            organizationReferentId: "organizationReferent",
            role: "member",
          },
        ],
        personConsolidationReviewCount: 0,
        personConsolidationReviews: [],
        personConsolidationRejectionCount: 0,
        personConsolidationRejections: [],
        verificationStatus: "verified",
      };
    }
    if (
      functionName === "userNotifications:markRead" &&
      args &&
      typeof args === "object" &&
      "notificationId" in args
    ) {
      mockState.userNotifications = mockState.userNotifications.map((notification) => {
        if (
          notification &&
          typeof notification === "object" &&
          "id" in notification &&
          notification.id === args.notificationId
        ) {
          return {
            ...notification,
            readAt: Date.UTC(2026, 5, 12, 13),
            status: "read",
          };
        }

        return notification;
      });
    }
    if (
      functionName === "userNotifications:markUnread" &&
      args &&
      typeof args === "object" &&
      "notificationId" in args
    ) {
      mockState.userNotifications = mockState.userNotifications.map((notification) => {
        if (
          notification &&
          typeof notification === "object" &&
          "id" in notification &&
          notification.id === args.notificationId
        ) {
          const { readAt, ...unreadNotification } = notification as {
            readAt?: number;
            [key: string]: unknown;
          };
          return {
            ...unreadNotification,
            status: "unread",
          };
        }

        return notification;
      });
    }
    if (
      functionName === "directContributions:postDirectContribution" &&
      args &&
      typeof args === "object"
    ) {
      const result = createMockDirectContributionResult(
        args as Record<string, unknown>,
      );
      mockState.answerFeedItems = [
        {
          kind: "answer",
          contextTagIds: getMockContributionContextTagIds(args),
          entry: result.entry,
        },
        ...mockState.answerFeedItems.filter(
          (item) =>
            !(
              item &&
              typeof item === "object" &&
              "kind" in item &&
              item.kind === "answer" &&
              "entry" in item &&
              item.entry &&
              typeof item.entry === "object" &&
              "id" in item.entry &&
              item.entry.id === result.entryId
            ),
        ),
      ];
      return result;
    }
    if (functionName === "smartStorage:startFromContribution") {
      const startInput =
        args && typeof args === "object"
          ? (args as Record<string, unknown>)
          : {};
      const sourceIds = ["source-raw-chapel-notes"];
      if (
        Array.isArray(startInput.externalUrls) &&
        startInput.externalUrls.length > 0
      ) {
        sourceIds.push("source-external-url-1");
      }
      if (
        Array.isArray(startInput.uploadedFiles) &&
        startInput.uploadedFiles.length > 0
      ) {
        sourceIds.push("source-uploaded-file-1");
      }
      mockState.smartStorageStartInput = startInput;
      mockState.smartStorageSourceIds = sourceIds;
      mockState.smartStorageSessionSummary = createMockSmartStorageSessionSummary({
        activeRunStatus: "queued",
        latestRunStatus: "queued",
        state: "preparingPrimaryProposal",
      });

      return {
        contributionSubmissionId:
          "contribution-submission-raw-chapel-notes",
        smartStorageRunId: "smart-storage-run-raw-chapel-notes",
        sourceId: sourceIds[0],
        sourceIds,
        status: "queued",
      };
    }
    if (functionName === "smartStorage:generateUploadUrl") {
      return {
        uploadUrl: "https://upload.example/convex-storage",
      };
    }
    if (functionName === "smartStorage:createTemporaryUploadRecord") {
      return {
        temporaryUploadId: "temporary-upload-chapel-program",
        uploadStatus: "uploaded",
      };
    }
    if (functionName === "smartStorage:addKnowledgePageThumbnail") {
      return {
        entryId:
          args && typeof args === "object" && "entryId" in args
            ? args.entryId
            : "entry-raw-chapel-notes",
        status: "added",
        thumbnailUrl: "https://images.example/knowledge-page-thumbnail.jpg",
      };
    }
    if (functionName === "smartStorage:generateDraftProposalForRun") {
      const startInput = mockState.smartStorageStartInput ?? {};
      const body = String(
        startInput.body ?? "A source that should be preserved before enrichment.",
      );
      const title = String(startInput.title ?? "Raw chapel notes");
      const externalUrls = Array.isArray(startInput.externalUrls)
        ? (startInput.externalUrls as Array<{ url?: unknown }>)
        : [];
      const uploadedFiles = Array.isArray(startInput.uploadedFiles)
        ? (startInput.uploadedFiles as Array<{ fileName?: unknown }>)
        : [];

      const proposalResult = {
        contributionSubmissionId:
          "contribution-submission-raw-chapel-notes",
        currentProposal: {
          bodyPreview: body,
          contextTags: [],
          knowledgeType: "words",
          proposalConfidence: "medium",
          rationale:
            "Deterministic MVP proposal generated from the submitted Source and requested Knowledge Type.",
          title,
        },
        smartStorageProposalId: "smart-storage-proposal-raw-chapel-notes",
        smartStorageRunId: "smart-storage-run-raw-chapel-notes",
        sourceCitations: [
          {
            citationKind: "textExcerpt",
            excerptText: body,
            id: "proposal-source-citation-raw-chapel-notes",
            rationale: "Authored Text Source preserved with the submission.",
            sourceId: "source-raw-chapel-notes",
          },
          ...externalUrls.map((externalUrl, index) => ({
            citationKind: "externalUrl" as const,
            externalUrl: String(externalUrl.url ?? ""),
            id: `proposal-source-citation-external-url-${index + 1}`,
            rationale: "External URL Source preserved with the submission.",
            sourceId: `source-external-url-${index + 1}`,
          })),
          ...uploadedFiles.map((uploadedFile, index) => ({
            citationKind: "fileLocator" as const,
            id: `proposal-source-citation-uploaded-file-${index + 1}`,
            locator: String(uploadedFile.fileName ?? "Uploaded file"),
            rationale: "Uploaded file Source preserved with the submission.",
            sourceId: `source-uploaded-file-${index + 1}`,
          })),
        ],
        sourceId: "source-raw-chapel-notes",
        sourceIds: mockState.smartStorageSourceIds,
        status: "drafted",
      };
      mockState.smartStorageSessionSummary = createMockSmartStorageSessionSummary({
        latestRunStatus: "succeeded",
        primaryProposal: createMockSmartStorageSessionProposal({
          acceptabilityStatus: "ready",
          role: "primary",
        }),
        state: "primaryReady",
      });

      return proposalResult;
    }
    if (functionName === "smartStorage:acceptScaffoldProposal") {
      const acceptInput =
        args && typeof args === "object" ? (args as Record<string, unknown>) : {};
      if (
        mockState.smartStorageAcceptReturnsTargetExists &&
        acceptInput.targetExistingEntryId === undefined
      ) {
        mockState.smartStorageSessionSummary =
          createMockSmartStorageTargetExistsSessionSummary();
        return {
          acceptanceStatus: "targetExists",
          existingEntryId: "entry-existing-raw-chapel-notes",
          smartStorageProposalId: "smart-storage-proposal-raw-chapel-notes",
          status: "needsResolution",
        };
      }

      const entry = {
        contributor: {
          id: "user",
          name: "Caleb Gelbaugh",
        },
        contextPreviewTagLabels: [],
        href: "/entries/entry-raw-chapel-notes",
        humanWeight: 60,
        id: "entry-raw-chapel-notes",
        knowledgeType: "words",
        previewText: "A source that should be preserved before enrichment.",
        primaryTagLabel: "Raw chapel notes",
        title: "Raw chapel notes",
        updatedAt: Date.UTC(2026, 5, 12, 15),
      };
      mockState.answerFeedItems = [
        {
          kind: "answer",
          contextTagIds: [],
          entry,
        },
        ...mockState.answerFeedItems,
      ];
      mockState.smartStorageSessionSummary =
        createMockSmartStorageAcceptedSessionSummary(entry);
      return {
        acceptanceStatus: "accepted",
        entry,
        entryId: entry.id,
        smartStorageProposalId: "smart-storage-proposal-raw-chapel-notes",
        status: "accepted",
      };
    }
    return {};
  },
  useQuery: (_query: unknown, args?: unknown) => {
    const functionName = getFunctionName(_query);
    if (args === "skip") {
      return undefined;
    }

    if (functionName === "appAccess:getCurrentUserAccess") {
      return mockState.appAccess;
    }

    if (functionName === "smartStorage:getSessionSummary") {
      return mockState.smartStorageSessionSummary;
    }

    if (
      functionName === "contributionDrafts:getForDraftKey" &&
      args &&
      typeof args === "object" &&
      "draftKey" in args
    ) {
      return mockState.contributionDrafts.get(String(args.draftKey)) ?? null;
    }

    if (functionName === "pinnedKnowledgePages:listForSidebar") {
      return mockState.pinnedKnowledgePages;
    }

    if (functionName === "bookmarkedKnowledgePages:listForProfile") {
      return mockState.bookmarkedKnowledgePages;
    }

    if (functionName === "knowledgeSubscriptions:listForNotifications") {
      return mockState.knowledgeSubscriptions;
    }

    if (functionName === "contactIdentities:listForCurrentUser") {
      return mockState.contactIdentities;
    }

    if (functionName === "contextExpertiseSettings:getCurrentUserSettings") {
      return mockState.contextExpertiseVisibilitySettings;
    }

    if (
      functionName === "contextExpertise:listCurrentUserProfileContextExpertise"
    ) {
      return mockState.profileContextExpertise;
    }

    if (
      functionName === "contextExpertise:getScopedAggregateMigrationStatus"
    ) {
      return mockState.scopedAggregateMigrationStatus;
    }

    if (
      functionName === "contextExpertise:getQuoteAttributionBackfillStatus"
    ) {
      return mockState.quoteAttributionBackfillStatus;
    }

    if (functionName === "answerFeed:listForActiveTagKeys") {
      const activeTagIds = getMockActiveTagIds(args);
      return mockState.answerFeedItems
        .filter((item) => itemFitsMockKnowledgeContext(item, activeTagIds))
        .sort(compareMockAnswerFeedItems);
    }

    if (functionName === "answerFeed:listAssignedSlotsForCurrentUser") {
      return mockState.assignedTodoSlots;
    }

    if (functionName === "answerFeed:listExpertsForActiveTagKeys") {
      return mockState.contextExperts;
    }

    if (functionName === "answerFeed:getExpertDetailForActiveTagKeys") {
      return mockState.contextExpertDetail;
    }

    if (functionName === "tagSuggestions:listRootSearchTagSuggestions") {
      return getMockTagSuggestions(args);
    }

    if (functionName === "tagSuggestions:listKnowledgeNavigatorTagSuggestions") {
      return getMockTagSuggestions(args, { excludeActiveTags: true });
    }

    if (functionName === "tagSuggestions:listKnowledgeNavigatorRecommendedTags") {
      return getMockRecommendedTagSuggestions(args);
    }

    if (functionName === "tagSuggestions:resolveRouteActiveTags") {
      return getMockResolvedRouteActiveTags(args);
    }

    if (functionName === "rootSearch:listRootSearchResults") {
      return getMockRootSearchResults(args);
    }

    if (functionName === "rootSearch:getKnowledgePageThumbnailState") {
      return getMockKnowledgePageThumbnailState(args);
    }

    if (functionName === "contextExpertise:searchQuoteAttributionPeople") {
      return mockState.quoteAttributionPersonOptions;
    }

    if (functionName === "contextExpertise:searchPublicFigureExpertPeople") {
      return mockState.publicFigureExpertPersonOptions;
    }

    if (
      functionName ===
      "contextExpertise:getPersonGlobalExpertVisibilityModeration"
    ) {
      return mockState.personGlobalExpertVisibilityModeration;
    }

    if (
      functionName ===
      "contextExpertise:listPersonGlobalExpertVisibilityModerationHistory"
    ) {
      return mockState.personGlobalExpertVisibilityModerationHistory;
    }

    if (functionName === "userNotifications:listForInbox") {
      const notifications = [...mockState.userNotifications].sort(
        (left, right) => getNotificationReceivedAt(right) - getNotificationReceivedAt(left),
      );

      return {
        notifications,
        summary: getNotificationSummary(notifications),
      };
    }

    if (functionName === "userNotifications:getUnreadSummary") {
      const unreadNotifications = mockState.userNotifications.filter(
        (notification) =>
          notification &&
          typeof notification === "object" &&
          "status" in notification &&
          notification.status === "unread",
      );

      return {
        ...(unreadNotifications.length > 0
          ? {
              latestReceivedAt: Math.max(
                ...unreadNotifications.map(getNotificationReceivedAt),
              ),
            }
          : {}),
        unreadCount: unreadNotifications.length,
      };
    }

    if (
      functionName === "bookmarkedKnowledgePages:getForPage" &&
      args &&
      typeof args === "object" &&
      "pageKey" in args
    ) {
      return (
        mockState.bookmarkedKnowledgePages.find(
          (bookmark) =>
            bookmark &&
            typeof bookmark === "object" &&
            "pageKey" in bookmark &&
            bookmark.pageKey === args.pageKey,
        ) ?? null
      );
    }

    if (
      functionName === "knowledgeSubscriptions:getForTarget" &&
      args &&
      typeof args === "object" &&
      "subscriptionKey" in args
    ) {
      return (
        mockState.knowledgeSubscriptions.find(
          (subscription) =>
            subscription &&
            typeof subscription === "object" &&
            "subscriptionKey" in subscription &&
            subscription.subscriptionKey === args.subscriptionKey,
        ) ?? null
      );
    }

    if (
      functionName === "organizationAccounts:getOrganizationMembershipSettings" &&
      args &&
      typeof args === "object" &&
      "organizationId" in args
    ) {
      const organizationId = String(args.organizationId);
      const organization = (
        mockState.appAccess as {
          email?: string;
          organizations?: Array<{
            name: string;
            organizationEntryId: string;
            organizationKind: string;
            organizationReferentId: string;
            role: string;
          }>;
          userId?: string;
        }
      ).organizations?.find(
        (candidate) =>
          candidate.organizationReferentId === organizationId ||
          candidate.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") === organizationId,
      );
      if (!organization) {
        return null;
      }

      return {
        members: [
          {
            email: (mockState.appAccess as { email?: string }).email,
            membershipId: `membership:${organization.organizationReferentId}`,
            name: "Caleb Gelbaugh",
            role: organization.role,
            status: "active",
            userId: (mockState.appAccess as { userId?: string }).userId ?? "user",
          },
          ...mockState.organizationMembershipMembers,
        ],
        name: organization.name,
        organizationEntryId: organization.organizationEntryId,
        organizationKind: organization.organizationKind,
        organizationReferentId: organization.organizationReferentId,
      };
    }

    if (functionName === "authAvailability:get") {
      return {
        google: false,
        password: true,
        resend: false,
      };
    }

    if (
      args &&
      typeof args === "object" &&
      "popularLimit" in args
    ) {
      return {
        navigatorUsage: [
          {
            activeTagCount: 2,
            id: "navigator-usage-1",
            occurredAt: Date.UTC(2026, 5, 12, 12, 30),
            resolvedTagCount: 1,
            usageKind: "select",
          },
        ],
        popularTargets: [
          {
            href: "/scripture/romans-8-28",
            label: "Romans 8:28",
            lastVisitedAt: Date.UTC(2026, 5, 12, 12, 25),
            pageType: "referent",
            targetKey: "romans-8-28",
            targetKind: "biblePassage",
            totalVisits: 4,
          },
        ],
        recentPageVisits: [
          {
            href: "/scripture/romans-8-28",
            id: "page-visit-1",
            label: "Romans 8:28",
            pageType: "referent",
            rawPath: "/scripture/romans-8-28",
            targetKey: "romans-8-28",
            targetKind: "biblePassage",
            visitedAt: Date.UTC(2026, 5, 12, 12, 25),
          },
        ],
      };
    }

    if (
      args &&
      typeof args === "object" &&
      "passageString" in args
    ) {
      return {
        canonicalKey: "matthew-5-9",
        hasText: true,
        isTruncated: false,
        label: "Matthew 5:9",
        passageString: "matthew-5-9",
        ranges: [{ endOrdinal: 23237, startOrdinal: 23237 }],
        slug: "matthew-5-9",
        status: "resolved",
        translation: {
          code: "KJV",
          name: "King James Version",
          textStatus: "available",
        },
        verses: [
          {
            bookCode: "MAT",
            bookName: "Matthew",
            bookShortName: "Matt",
            chapterNumber: 5,
            ordinal: 23237,
            text: "Blessed are the peacemakers...",
            verseNumber: 9,
          },
        ],
      };
    }

    return {
      google: false,
      password: true,
      resend: false,
    };
  },
}));

function getFunctionName(reference: unknown) {
  try {
    return getConvexFunctionName(reference as never);
  } catch {
    // Fall through to the older symbol-based mock shape.
  }

  const functionNameSymbol = Symbol.for("functionName");
  if (reference && typeof reference === "object") {
    return (reference as Record<symbol, string>)[functionNameSymbol] ?? "";
  }

  return "";
}

function getMockTagSuggestions(
  args: unknown,
  options: { excludeActiveTags?: boolean } = {},
) {
  if (!args || typeof args !== "object" || !("query" in args)) {
    return [];
  }

  const query = normalizeMockSuggestionText(String(args.query));
  if (!query) {
    return [];
  }

  const activeTagIds = new Set(
    options.excludeActiveTags === true ? getMockActiveTagIds(args) : [],
  );
  const limit =
    "limit" in args && typeof args.limit === "number"
      ? Math.max(0, Math.floor(args.limit))
      : 5;

  return mockState.tagSuggestions
    .filter(
      (suggestion): suggestion is Record<string, unknown> =>
        suggestion !== null && typeof suggestion === "object",
    )
    .filter((suggestion) => !activeTagIds.has(String(suggestion.id)))
    .filter((suggestion) => {
      const values = [
        suggestion.label,
        suggestion.id,
        suggestion.canonicalKey,
        ...(((suggestion.matchTerms as unknown[]) ?? []) as unknown[]),
      ];

      return values.some((value) =>
        normalizeMockSuggestionText(String(value ?? "")).includes(query),
      );
    })
    .slice(0, limit)
    .map(({ matchTerms: _matchTerms, ...suggestion }) => ({
      matchKind: "label",
      ...suggestion,
    }));
}

function getMockResolvedRouteActiveTags(args: unknown) {
  if (
    !args ||
    typeof args !== "object" ||
    !("tagKeys" in args) ||
    !Array.isArray(args.tagKeys)
  ) {
    return [];
  }

  return args.tagKeys.map((tagKey) => {
    const normalizedTagKey = normalizeMockRouteTagKey(String(tagKey));
    const suggestion = findMockRouteTagSource(
      mockState.tagSuggestions,
      normalizedTagKey,
    );
    if (suggestion) {
      return toMockActiveTag(suggestion);
    }

    const rootSearchResult = findMockRouteTagSource(
      mockState.rootSearchResults,
      normalizedTagKey,
    );
    return rootSearchResult ? toMockActiveTag(rootSearchResult) : null;
  });
}

function findMockRouteTagSource(
  candidates: unknown[],
  normalizedTagKey: string,
) {
  return candidates.find((candidate): candidate is Record<string, unknown> => {
    if (candidate === null || typeof candidate !== "object") {
      return false;
    }

    const candidateRecord = candidate as Record<string, unknown>;
    return [candidateRecord.id, candidateRecord.canonicalKey].some(
      (value) => normalizeMockRouteTagKey(String(value ?? "")) === normalizedTagKey,
    );
  });
}

function toMockActiveTag(source: Record<string, unknown>) {
  if (source.tag && typeof source.tag === "object") {
    return source.tag;
  }

  return {
    canonicalKey: String(source.canonicalKey ?? source.id ?? ""),
    href: String(source.href ?? `/goto/${source.id ?? source.canonicalKey ?? ""}`),
    id: String(source.id ?? source.canonicalKey ?? ""),
    knowledgeType: source.knowledgeType,
    label: String(source.label ?? source.id ?? source.canonicalKey ?? ""),
    ...("thumbnailUrl" in source && typeof source.thumbnailUrl === "string"
      ? { thumbnailUrl: source.thumbnailUrl }
      : {}),
  };
}

function getMockRecommendedTagSuggestions(args: unknown) {
  const activeTagIds = new Set(getMockActiveTagIds(args));
  const limit =
    args && typeof args === "object" && "limit" in args && typeof args.limit === "number"
      ? Math.max(0, Math.floor(args.limit))
      : 5;

  return mockState.tagSuggestions
    .filter(
      (suggestion): suggestion is Record<string, unknown> =>
        suggestion !== null && typeof suggestion === "object",
    )
    .filter((suggestion) => !activeTagIds.has(String(suggestion.id)))
    .slice(0, limit)
    .map(({ matchTerms: _matchTerms, ...suggestion }) => ({
      matchKind: "label",
      ...suggestion,
    }));
}

function getMockRootSearchResults(args: unknown) {
  if (!args || typeof args !== "object" || !("query" in args)) {
    return [];
  }

  const query = normalizeMockSuggestionText(String(args.query));
  if (!query) {
    return [];
  }

  const limit =
    "limit" in args && typeof args.limit === "number"
      ? Math.max(0, Math.floor(args.limit))
      : 8;

  return mockState.rootSearchResults
    .filter(
      (result): result is Record<string, unknown> =>
        result !== null && typeof result === "object",
    )
    .filter((result) => {
      const preview =
        result.matchedEntryPreview &&
        typeof result.matchedEntryPreview === "object"
          ? (result.matchedEntryPreview as Record<string, unknown>)
          : {};
      const values = [
        result.label,
        result.id,
        result.canonicalKey,
        preview.title,
        preview.previewText,
        ...(((result.matchTerms as unknown[]) ?? []) as unknown[]),
      ];

      return values.some((value) =>
        normalizeMockSuggestionText(String(value ?? "")).includes(query),
      );
    })
    .slice(0, limit)
    .map(({ matchTerms: _matchTerms, ...result }) => result);
}

function getMockKnowledgePageThumbnailState(args: unknown) {
  if (
    !args ||
    typeof args !== "object" ||
    !("canonicalKey" in args) ||
    !("knowledgeType" in args)
  ) {
    return null;
  }

  const result = mockState.rootSearchResults.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      "canonicalKey" in candidate &&
      "knowledgeType" in candidate &&
      candidate.canonicalKey === args.canonicalKey &&
      candidate.knowledgeType === args.knowledgeType,
  );
  if (
    !result ||
    typeof result !== "object" ||
    !("matchedEntryPreview" in result) ||
    !result.matchedEntryPreview ||
    typeof result.matchedEntryPreview !== "object"
  ) {
    return null;
  }

  const preview = result.matchedEntryPreview as Record<string, unknown>;
  const resultRecord = result as Record<string, unknown>;

  return {
    entryId: String(preview.id ?? ""),
    entryTitle: String(preview.title ?? resultRecord.label ?? ""),
    ...("thumbnailUrl" in result && typeof result.thumbnailUrl === "string"
      ? { thumbnailUrl: result.thumbnailUrl }
      : {}),
  };
}

function getNotificationSummary(notifications: unknown[]) {
  return {
    allCount: notifications.length,
    eventCount: notifications.filter((notification) =>
      hasNotificationField(notification, "kind", "event"),
    ).length,
    knowledgeSlotCount: notifications.filter((notification) =>
      hasNotificationField(notification, "kind", "knowledgeSlot"),
    ).length,
    ...(notifications.length > 0
      ? {
          latestReceivedAt: Math.max(
            ...notifications.map(getNotificationReceivedAt),
          ),
        }
      : {}),
    unreadCount: notifications.filter((notification) =>
      hasNotificationField(notification, "status", "unread"),
    ).length,
  };
}

function getNotificationReceivedAt(notification: unknown) {
  return notification &&
    typeof notification === "object" &&
    "receivedAt" in notification
    ? Number(notification.receivedAt)
    : 0;
}

function hasNotificationField(
  notification: unknown,
  field: "kind" | "status",
  value: string,
) {
  return (
    notification &&
    typeof notification === "object" &&
    field in notification &&
    (notification as Record<string, unknown>)[field] === value
  );
}

function createMockDirectContributionResult(args: Record<string, unknown>) {
  const title = getMockString(args.title, "Untitled");
  const body = getMockString(args.body, "");
  const knowledgeType = getMockString(args.knowledgeType, "words");
  const slug = slugifyTestId(getMockString(args.slotId, title));
  const entryId = `entry-${slug}`;
  const contextPreviewTagLabels = getMockContributionContextLabels(args);
  const previewText =
    body.trim() || `Created ${formatMockKnowledgeTypeLabel(knowledgeType)} entry.`;

  return {
    entry: {
      contributor: {
        id: "current-user",
        name: "Current User",
      },
      id: entryId,
      title,
      knowledgeType,
      previewText,
      primaryTagLabel: title || contextPreviewTagLabels[0] || "Untitled",
      contextPreviewTagLabels,
      humanWeight: 82,
      href: `/entries/${entryId}`,
      updatedAt: Date.UTC(2026, 5, 1, 12),
    },
    entryId,
    primaryTagId: `tag-${slug}`,
    representedReferentId: `referent-${slug}`,
  };
}

function getMockActiveTagIds(args: unknown) {
  if (!args || typeof args !== "object" || !("activeTags" in args)) {
    return [];
  }

  const activeTags = (args as { activeTags?: unknown }).activeTags;
  if (!Array.isArray(activeTags)) {
    return [];
  }

  return activeTags
    .map((tag) =>
      tag && typeof tag === "object" && "id" in tag ? String(tag.id) : "",
    )
    .filter(Boolean);
}

function normalizeMockSuggestionText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMockRouteTagKey(value: string) {
  return normalizeMockSuggestionText(value).replace(/\s+/g, "-");
}

function getMockContributionContextTagIds(args: unknown) {
  if (!args || typeof args !== "object" || !("contextTags" in args)) {
    return [];
  }

  const contextTags = (args as { contextTags?: unknown }).contextTags;
  if (!Array.isArray(contextTags)) {
    return [];
  }

  return contextTags
    .map((tag) =>
      tag && typeof tag === "object" && "id" in tag ? String(tag.id) : "",
    )
    .filter(Boolean);
}

function getMockContributionContextLabels(args: Record<string, unknown>) {
  const contextTags = Array.isArray(args.contextTags) ? args.contextTags : [];

  return contextTags
    .map((tag) =>
      tag && typeof tag === "object" && "label" in tag
        ? String(tag.label)
        : "",
    )
    .filter(Boolean);
}

function itemFitsMockKnowledgeContext(item: unknown, activeTagIds: string[]) {
  const itemTagIds = getMockItemContextTagIds(item);
  return activeTagIds.every((tagId) => itemTagIds.includes(tagId));
}

function getMockItemContextTagIds(item: unknown) {
  if (!item || typeof item !== "object" || !("contextTagIds" in item)) {
    return [];
  }

  const contextTagIds = (item as { contextTagIds?: unknown }).contextTagIds;
  return Array.isArray(contextTagIds) ? contextTagIds.map(String) : [];
}

function compareMockAnswerFeedItems(left: unknown, right: unknown) {
  const leftKind = getMockFeedKind(left);
  const rightKind = getMockFeedKind(right);
  if (leftKind !== rightKind) {
    return leftKind === "answer" ? -1 : 1;
  }

  if (leftKind === "answer") {
    return (
      compareMockEntryHumanWeight(left, right) ||
      (getMockEntryNumber(right, "updatedAt") ?? 0) -
        (getMockEntryNumber(left, "updatedAt") ?? 0) ||
      getMockEntryTitle(left).localeCompare(getMockEntryTitle(right))
    );
  }

  return getMockSlotTitle(left).localeCompare(getMockSlotTitle(right));
}

function compareMockEntryHumanWeight(left: unknown, right: unknown) {
  const leftHumanWeight = getMockEntryNumber(left, "humanWeight");
  const rightHumanWeight = getMockEntryNumber(right, "humanWeight");

  if (leftHumanWeight !== undefined && rightHumanWeight !== undefined) {
    return rightHumanWeight - leftHumanWeight;
  }

  if (leftHumanWeight !== undefined) {
    return -1;
  }

  if (rightHumanWeight !== undefined) {
    return 1;
  }

  return 0;
}

function getMockFeedKind(item: unknown) {
  return item && typeof item === "object" && "kind" in item
    ? String(item.kind)
    : "";
}

function getMockEntryNumber(
  item: unknown,
  field: "humanWeight" | "updatedAt",
): number | undefined {
  if (
    item &&
    typeof item === "object" &&
    "entry" in item &&
    item.entry &&
    typeof item.entry === "object" &&
    field in item.entry
  ) {
    return Number((item.entry as Record<string, unknown>)[field]);
  }

  return field === "updatedAt" ? 0 : undefined;
}

function getMockEntryTitle(item: unknown) {
  if (
    item &&
    typeof item === "object" &&
    "entry" in item &&
    item.entry &&
    typeof item.entry === "object" &&
    "title" in item.entry
  ) {
    return String(item.entry.title);
  }

  return "";
}

function getMockSlotTitle(item: unknown) {
  if (
    item &&
    typeof item === "object" &&
    "slot" in item &&
    item.slot &&
    typeof item.slot === "object" &&
    "title" in item.slot
  ) {
    return String(item.slot.title);
  }

  return "";
}

function getMockString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function slugifyTestId(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "contribution";
}

function formatMockKnowledgeTypeLabel(knowledgeType: string) {
  const labels: Record<string, string> = {
    group: "Group",
    lesson: "Lesson",
    question: "Question",
    words: "Words",
  };

  return labels[knowledgeType] ?? knowledgeType;
}

function getMockInitialAnswerFeedItems() {
  return [
    {
      kind: "answer",
      contextTagIds: [
        "matthew-5-9",
        "first-crusade",
        "the-city-of-god",
        "augustine",
        "grade-9-church-history",
        "ordered-loves",
      ],
      entry: {
        contributor: {
          id: "contributor-caleb-gelbaugh",
          name: "Caleb Gelbaugh",
        },
        id: "entry-first-crusade-ordered-loves",
        title: "Augustine, Ordered Loves, and the First Crusade",
        knowledgeType: "lesson",
        previewText:
          "Grade 9 Church History prep for teaching the Crusades through Augustine's earthly city, peace, and disordered loves.",
        primaryTagLabel: "Grade 9 Church History",
        contextPreviewTagLabels: [
          "Matthew 5:9",
          "First Crusade",
          "The City of God",
          "Grade 9 Church History",
        ],
        humanWeight: 94,
        href: "/entries/entry-first-crusade-ordered-loves",
        updatedAt: Date.UTC(2026, 5, 12, 14),
      },
    },
    {
      kind: "slot",
      contextTagIds: [
        "matthew-5-9",
        "first-crusade",
        "grade-9-church-history",
        "student-crusades-question",
      ],
      slot: {
        id: "slot-student-crusades-question",
        title: "Answer Micah's Crusades question",
        requestedKnowledgeType: "comment",
        promptText:
          "Micah asked whether the First Crusade shows Christian courage, zeal without knowledge, or presumption. Answer before seminar.",
        status: "open",
        contextPreviewTagLabels: [
          "Matthew 5:9",
          "First Crusade",
          "Grade 9 Church History",
        ],
        targetLabel: "Grade 9 Church History",
        dueAt: Date.UTC(2026, 5, 12, 12),
        href: "/slots/slot-student-crusades-question",
      },
    },
  ];
}

const CONTRIBUTION_BODY =
  "A deterministic comment distinguishing Christian courage from zeal without knowledge.";

const QUOTE_ATTRIBUTION_EXPERT = {
  contextExpertiseMaturity: 80,
  contextExpertiseScore: 110,
  evidenceCount: 1,
  feedbackCount: 0,
  id: "person:referent-lewis",
  name: "C. S. Lewis",
  postCount: 1,
  subjectKind: "person",
  subjectPersonReferentId: "referent-lewis",
};

const QUOTE_ATTRIBUTION_ENTRY = {
  contextPreviewTagLabels: ["Matthew 5:9"],
  href: "/entries/entry-lewis-quote",
  id: "entry-lewis-quote",
  knowledgeType: "quote",
  previewText: "Blessed are the peacemakers.",
  primaryTagLabel: "Matthew 5:9",
  quoteAttribution: {
    quotedPersonLabel: "C. S. Lewis",
    quotedPersonReferentId: "referent-lewis",
  },
  title: "Lewis on Peacemaking",
  updatedAt: Date.UTC(2026, 5, 12, 12),
};

describe("MVP Explore/Contribute loop", () => {
  let container: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/scripture/matthew-5-9",
    );
    window.localStorage.clear();
    mockState.auth = {
      isAuthenticated: true,
      isLoading: false,
    };
    mockState.appAccess = {
      email: "gelbaughcm@gmail.com",
      organizations: [
        {
          name: "Arche Classical Academy",
          organizationEntryId: "organizationEntry",
          organizationKind: "school",
          organizationReferentId: "organizationReferent",
          role: "admin",
        },
        {
          name: "Ruler of Kings Church",
          organizationEntryId: "churchOrganizationEntry",
          organizationKind: "church",
          organizationReferentId: "churchOrganizationReferent",
          role: "admin",
        },
        {
          name: "My Family",
          organizationEntryId: "familyOrganizationEntry",
          organizationKind: "family",
          organizationReferentId: "familyOrganizationReferent",
          role: "admin",
        },
        {
          name: "My Community",
          organizationEntryId: "communityOrganizationEntry",
          organizationKind: "community",
          organizationReferentId: "communityOrganizationReferent",
          role: "admin",
        },
      ],
      status: "allowed",
      userId: "user",
    };
    mockState.contactIdentities = {
      contactIdentities: [
        {
          email: "corey@archeclassicalacademy.com",
          id: "contact:corey@archeclassicalacademy.com",
          verificationStatus: "verified",
          verifiedAt: Date.UTC(2026, 5, 10, 12),
        },
        {
          email: "corey@rulerofkingschurch.com",
          id: "contact:corey@rulerofkingschurch.com",
          verificationStatus: "pending",
        },
      ],
      primaryEmail: "gelbaughcm@gmail.com",
      primaryEmailVerified: true,
    };
    mockState.contextExpertiseVisibilitySettings = {
      globalExpertVisibilityEnabled: false,
    };
    mockState.profileContextExpertise = {
      profileUserId: "user",
      rows: [],
    };
    mockState.scopedAggregateMigrationStatus = {
      aggregateSampleLimit: 50,
      continueCursor: "scoped-cursor-1",
      evidenceGroupCount: 2,
      isDone: false,
      legacyAggregateSampleCount: 1,
      mayHaveMoreEvidence: true,
      missingScopedAggregateGroupCount: 1,
      missingScopedAggregateGroups: [
        {
          audienceScopeKind: "organization",
          audienceScopeTargetKey: "organizationReferent",
          contextKey: "first-crusade,matthew-5-9",
          subjectKind: "user",
          subjectUserId: "user",
        },
      ],
      sampledAggregateCount: 3,
      sampledEvidenceCount: 25,
      scopedAggregateSampleCount: 2,
    };
    mockState.scopedAggregateMigrationDryRunResult = {
      continueCursor: "scoped-cursor-2",
      dryRun: true,
      groupCount: 1,
      groups: [
        {
          audienceScopeKind: "organization",
          audienceScopeTargetKey: "organizationReferent",
          contextKey: "first-crusade,matthew-5-9",
          subjectKind: "user",
          subjectUserId: "user",
        },
      ],
      isDone: false,
      processedEvidenceCount: 25,
      rebuiltGroupCount: 0,
      skippedGroupCount: 0,
    };
    mockState.quoteAttributionBackfillStatus = {
      attributedQuoteRowCount: 2,
      continueCursor: "quote-cursor-1",
      eligibleQuoteRowCount: 1,
      existingEvidenceCount: 0,
      isDone: false,
      mayHaveMoreQuoteRows: true,
      missingEvidenceCount: 1,
      missingEvidenceItems: [
        {
          action: "missing",
          contextKey: "augustine,first-crusade",
          entryId: "entry-quote-augustine",
          quoteEntryId: "quote-augustine",
          subjectPersonReferentId: "referent-augustine",
        },
      ],
      processedQuoteRowCount: 3,
      skippedQuoteRowCount: 1,
      skippedQuoteRowItems: [
        {
          entryId: "entry-quote-anonymous",
          quoteEntryId: "quote-anonymous",
          skippedReason: "noQuotedPerson",
        },
      ],
    };
    mockState.quoteAttributionBackfillDryRunResult = {
      attributedQuoteRowCount: 2,
      continueCursor: "quote-cursor-2",
      createdEvidenceCount: 0,
      dryRun: true,
      eligibleQuoteRowCount: 1,
      evidenceItems: [
        {
          action: "wouldCreate",
          contextKey: "augustine,first-crusade",
          entryId: "entry-quote-augustine",
          quoteEntryId: "quote-augustine",
          subjectPersonReferentId: "referent-augustine",
        },
      ],
      existingEvidenceCount: 0,
      isDone: false,
      mayHaveMoreQuoteRows: true,
      missingEvidenceCount: 1,
      processedQuoteRowCount: 3,
      skippedQuoteRowCount: 1,
      skippedQuoteRowItems: [
        {
          entryId: "entry-quote-anonymous",
          quoteEntryId: "quote-anonymous",
          skippedReason: "noQuotedPerson",
        },
      ],
      wouldCreateEvidenceCount: 1,
    };
    mockState.pinnedKnowledgePages = [
      {
        href: "/organizations/organizationReferent",
        id: "organizationReferent",
        label: "Arche Classical Academy",
        organizationKind: "school",
        organizationName: "Arche Classical Academy",
        organizationReferentId: "organizationReferent",
        pageKey: "organization:organizationReferent",
        pinSource: "defaultSeed",
        secondaryLabel: "School",
        sortOrder: 0,
      },
      {
        href: "/organizations/churchOrganizationReferent",
        id: "churchOrganizationReferent",
        label: "Ruler of Kings Church",
        organizationKind: "church",
        organizationName: "Ruler of Kings Church",
        organizationReferentId: "churchOrganizationReferent",
        pageKey: "organization:churchOrganizationReferent",
        pinSource: "defaultSeed",
        secondaryLabel: "Church",
        sortOrder: 1000,
      },
      {
        href: "/organizations/familyOrganizationReferent",
        id: "familyOrganizationReferent",
        label: "My Family",
        organizationKind: "family",
        organizationName: "My Family",
        organizationReferentId: "familyOrganizationReferent",
        pageKey: "organization:familyOrganizationReferent",
        pinSource: "defaultSeed",
        secondaryLabel: "Family",
        sortOrder: 2000,
      },
      {
        href: "/organizations/communityOrganizationReferent",
        id: "communityOrganizationReferent",
        label: "My Community",
        organizationKind: "community",
        organizationName: "My Community",
        organizationReferentId: "communityOrganizationReferent",
        pageKey: "organization:communityOrganizationReferent",
        pinSource: "defaultSeed",
        secondaryLabel: "Community",
        sortOrder: 3000,
      },
    ];
    mockState.bookmarkedKnowledgePages = [];
    mockState.knowledgeSubscriptions = [];
    mockState.organizationMembershipMembers = [];
    mockState.contextExperts = [];
    mockState.contextExpertDetail = null;
    mockState.contributionDrafts = new Map();
    mockState.quoteAttributionPersonOptions = [];
    mockState.publicFigureExpertPersonOptions = [];
    mockState.personGlobalExpertVisibilityModeration = null;
    mockState.personGlobalExpertVisibilityModerationHistory = [];
    mockState.answerFeedItems = getMockInitialAnswerFeedItems();
    mockState.smartStorageSourceIds = ["source-raw-chapel-notes"];
    mockState.smartStorageStartInput = null;
    mockState.smartStorageModelRunResult = {
      executionStatus: "proposalCreated",
      smartStorageProposalId: "smart-storage-proposal-raw-chapel-notes",
      smartStorageRunId: "smart-storage-run-raw-chapel-notes",
      status: "drafted",
    };
    mockState.draftLinkPreviewResult = {
      description: "Friday chapel program.",
      imageUrl: "https://example.com/chapel-program.png",
      siteName: "Example Chapel",
      status: "fetched",
      title: "Chapel Program",
      url: "https://example.com/chapel-program",
    };
    mockState.smartStorageAcceptReturnsTargetExists = false;
    mockState.smartStorageModelRunDelay = null;
    mockState.smartStorageSessionSummary = null;
    mockState.userNotifications = [
      {
        id: "notice-slot-student-crusades-question",
        title: "Micah's Crusades question is waiting",
        body:
          "A Grade 9 requested entry needs your answer before the Church History seminar.",
        contextLabel: "First Crusade + Matthew 5:9",
        contextHref: "/explore?tagIds=first-crusade,matthew-5-9",
        kind: "knowledgeSlot",
        receivedAt: Date.UTC(2026, 5, 12, 12, 4),
        status: "unread",
      },
      {
        id: "notice-medieval-literature-lesson",
        title: "Grade 10 Medieval Literature starts at 1:30 PM",
        body:
          "Your Boethius lesson is still open in the Knowledge Context for providence.",
        contextLabel: "Boethius + Romans 8:28",
        contextHref: "/explore?tagIds=boethius,grade-10-medieval-literature,romans-8-28",
        kind: "event",
        receivedAt: Date.UTC(2026, 5, 12, 11, 45),
        status: "unread",
      },
      {
        id: "notice-pride-leads-to-death",
        title: "Pride Leads to Death is on Sunday's calendar",
        body:
          "Ruler of Kings Church has the Daniel 4 sermon event confirmed for June 14.",
        contextLabel: "Daniel 4",
        contextHref: "/scripture/daniel-4",
        kind: "event",
        receivedAt: Date.UTC(2026, 5, 12, 10, 15),
        status: "unread",
      },
      {
        id: "notice-trial-by-fire-follow-up",
        title: "Trial by Fire received follow-up notes",
        body:
          "The Daniel 3 sermon event now has deacon follow-up material attached.",
        contextLabel: "Daniel 3",
        contextHref: "/scripture/daniel-3",
        kind: "subscription",
        receivedAt: Date.UTC(2026, 5, 11, 16, 20),
        status: "read",
      },
    ];
    mockState.actionCalls = [];
    mockState.mutationCalls = [];
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
    root = null;
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }
    vi.unstubAllGlobals();
  });

  test("navigates from Scripture Explore to Slot Contribute and returns the contribution as an Answer", async () => {
    await renderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        rawPath: "/scripture/matthew-5-9",
        targetKey: "matthew-5-9",
        targetKind: "biblePassage",
      }),
    );
    expect(getButton("Remove Matthew 5:9")).toBeTruthy();
    expect(queryButton("Remove First Crusade")).toBeNull();

    await click(getButton("Add First Crusade"));

    expect(window.location.pathname + window.location.search).toBe(
      "/explore?tagIds=first-crusade,matthew-5-9",
    );
    expect(getButton("Remove First Crusade")).toBeTruthy();

    const initialAnswerItems = getFeedItems("answer");
    expect(initialAnswerItems.map(getCardTitle)).toEqual([
      "Augustine, Ordered Loves, and the First Crusade",
    ]);
    expect(initialAnswerItems.map(getHumanWeightText)).toEqual(["94/100"]);
    for (const answerItem of initialAnswerItems) {
      expect(answerItem.textContent).toContain("Matthew 5:9");
      expect(answerItem.textContent).toContain("First Crusade");
    }

    const rail = getLabelledElement("Knowledge context and search");
    expect(rail.querySelector(".kb-knowledge-navigator")).toBeTruthy();
    expect(rail.querySelector(".kb-request-composer")).toBeTruthy();
    expect(rail.querySelector(".kb-slot-card")).toBeNull();
    expect(rail.querySelector(".kb-placeholder-block")).toBeNull();
    expect(rail.textContent).not.toContain("Answer Micah's Crusades question");
    expect(rail.textContent).not.toContain(
      "No requested entries in this Knowledge Context",
    );

    const slotItem = getFeedItems("slot").find((item) =>
      item.textContent?.includes("Answer Micah's Crusades question"),
    );
    if (!slotItem) {
      throw new Error("Missing Micah Crusades question slot");
    }
    expect(slotItem.textContent).toContain("Requested Entry");
    expect(slotItem.textContent).not.toContain("Knowledge Slot");
    expect(slotItem.textContent).toContain("Matthew 5:9");
    expect(slotItem.textContent).toContain("First Crusade");

    const slotContributionCta = getLinkIn(slotItem, "Add missing Comment");
    await click(slotContributionCta);

    const editor = getContributionEditor();
    expect(editor.textContent).toContain("Answer Micah's Crusades question");
    expect(getContributionContextLabels(editor)).toEqual([
      "First Crusade",
      "Grade 9 Church History",
      "Matthew 5:9",
      "Student Crusades Question",
    ]);
    expect(editor.querySelector("select")).toBeNull();
    expect(editor.textContent).toContain("Comment");

    expect(editor.querySelector('input[type="text"]')).toBeNull();
    await setFieldValue(getTextareaIn(editor), CONTRIBUTION_BODY);
    await click(getButtonIn(editor, "Comment"));

    const finalAnswerItems = getFeedItems("answer");
    expect(finalAnswerItems.map(getCardTitle)).toEqual([
      "Augustine, Ordered Loves, and the First Crusade",
      "Comment",
    ]);

    const contributionAnswer = finalAnswerItems.find(
      (item) => getCardTitle(item) === "Comment",
    );
    expect(contributionAnswer).toBeTruthy();
    expect(contributionAnswer?.textContent).toContain("Knowledge Entry");
    expect(contributionAnswer?.textContent).toContain(CONTRIBUTION_BODY);
    expect(contributionAnswer?.textContent).toContain("Human Weight");
    expect(contributionAnswer?.textContent).toContain("82/100");
    expect(contributionAnswer?.textContent).toContain("Matthew 5:9");
    expect(contributionAnswer?.textContent).toContain("First Crusade");
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        body: CONTRIBUTION_BODY,
        functionName: "directContributions:postDirectContribution",
        knowledgeType: "comment",
        slotId: "slot-student-crusades-question",
        title: "Comment",
      }),
    );
    expect(contributionAnswer?.innerHTML).toContain(
      'href="/entries/entry-slot-student-crusades-question"',
    );

    await rerenderApp();
    expect(getFeedItems("answer").map(getCardTitle)).toContain("Comment");
  });

  test("posts tagged Words attachments directly without starting Smart Storage", async () => {
    const uploadedFile = new File(["Friday chapel program"], "chapel-program.pdf", {
      type: "application/pdf",
    });
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ storageId: "storage-chapel-program" }),
      ok: true,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await renderApp();

    const editor = getContributionEditor();
    expect(editor.textContent).toContain("Post");
    await setFieldValue(
      getTextareaIn(editor),
      ["Raw chapel notes", "https://example.com/chapel-program"].join("\n"),
    );
    await setFileInputFiles(getFileInputIn(editor), [uploadedFile]);
    await flushAsyncWork();

    expect(editor.textContent).toContain("Chapel Program");
    expect(editor.textContent).toContain("chapel-program.pdf");

    await click(getButtonIn(editor, "Post"));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://upload.example/convex-storage",
      expect.objectContaining({
        body: uploadedFile,
        headers: {
          "Content-Type": "application/pdf",
        },
        method: "POST",
      }),
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        fileName: "chapel-program.pdf",
        fileSizeBytes: uploadedFile.size,
        functionName: "smartStorage:createTemporaryUploadRecord",
        storageId: "storage-chapel-program",
      }),
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        body: ["Raw chapel notes", "https://example.com/chapel-program"].join(
          "\n",
        ),
        externalUrls: [
          {
            linkPreviewDescription: "Friday chapel program.",
            linkPreviewImageUrl: "https://example.com/chapel-program.png",
            linkPreviewSiteName: "Example Chapel",
            linkPreviewTitle: "Chapel Program",
            url: "https://example.com/chapel-program",
          },
        ],
        functionName: "directContributions:postDirectContribution",
        knowledgeType: "words",
        title: "Raw chapel notes",
        uploadedFiles: [
          expect.objectContaining({
            contentType: "application/pdf",
            fileName: "chapel-program.pdf",
            fileSizeBytes: uploadedFile.size,
            storageId: "storage-chapel-program",
            temporaryUploadId: "temporary-upload-chapel-program",
          }),
        ],
      }),
    );
    expect(
      mockState.mutationCalls.some(
        (call) =>
          call &&
          typeof call === "object" &&
          "functionName" in call &&
          call.functionName === "smartStorage:startFromContribution",
      ),
    ).toBe(false);
    expect(
      mockState.actionCalls.some(
        (call) =>
          call &&
          typeof call === "object" &&
          "functionName" in call &&
          call.functionName === "smartStorage:executeModelRun",
      ),
    ).toBe(false);
    expect(getFeedItems("answer").map(getCardTitle)).toContain(
      "Raw chapel notes",
    );
  });

  test("records Human Weight Feedback from an Answer card", async () => {
    await renderApp();
    await click(getButton("Add First Crusade"));

    const answerItem = getFeedItems("answer")[0];
    expect(getCardTitle(answerItem)).toBe(
      "Augustine, Ordered Loves, and the First Crusade",
    );

    await click(getButtonIn(answerItem, "Feedback"));
    expect(answerItem.textContent).toContain("Human Weight Feedback");

    await click(getButtonIn(answerItem, "Used"));
    await setFieldValue(
      getTextareaIn(answerItem),
      "Used in a Grade 9 Church History seminar.",
    );
    await click(getButtonIn(answerItem, "Save"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        entryId: "entry-first-crusade-ordered-loves",
        feedbackKind: "used",
        feedbackNote: "Used in a Grade 9 Church History seminar.",
        functionName: "humanWeightFeedback:record",
      }),
    );
    expect(answerItem.textContent).toContain("Feedback saved.");
  });

  test("lets system admins correct Quote attribution from Context Expert details", async () => {
    mockState.appAccess = {
      ...(mockState.appAccess as Record<string, unknown>),
      systemRole: "systemAdmin",
    };
    mockState.contextExperts = [QUOTE_ATTRIBUTION_EXPERT];
    mockState.contextExpertDetail = {
      ...QUOTE_ATTRIBUTION_EXPERT,
      topSupportingEntries: [QUOTE_ATTRIBUTION_ENTRY],
    };
    mockState.quoteAttributionPersonOptions = [
      {
        label: "J. R. R. Tolkien",
        referentId: "referent-tolkien",
        tagId: "tag-tolkien",
      },
    ];

    await renderApp();

    await click(getButton("Open C. S. Lewis Context Expert details"));
    const dialog = getDialog();
    expect(dialog.textContent).toContain("Lewis on Peacemaking");
    expect(dialog.textContent).toContain("Quoted Person");
    expect(dialog.textContent).toContain("C. S. Lewis");
    expect(dialog.textContent).toContain("referent-lewis");

    await setFieldValue(
      getLabelledElement(
        "Search corrected Person for Lewis on Peacemaking",
      ) as HTMLInputElement,
      "Tolkien",
    );
    await click(getButtonIn(dialog, "J. R. R. Tolkien"));
    await click(getButtonIn(dialog, "Save attribution"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        entryId: "entry-lewis-quote",
        functionName: "contextExpertise:correctQuoteAttribution",
        nextQuotedPersonReferentId: "referent-tolkien",
      }),
    );
    expect(dialog.textContent).toContain("Quote attribution updated.");

    await click(getButtonIn(dialog, "Clear attribution"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        entryId: "entry-lewis-quote",
        functionName: "contextExpertise:correctQuoteAttribution",
        nextQuotedPersonReferentId: null,
      }),
    );
  });

  test("hides Quote attribution correction controls from non-system admins", async () => {
    mockState.contextExperts = [QUOTE_ATTRIBUTION_EXPERT];
    mockState.contextExpertDetail = {
      ...QUOTE_ATTRIBUTION_EXPERT,
      topSupportingEntries: [QUOTE_ATTRIBUTION_ENTRY],
    };

    await renderApp();

    await click(getButton("Open C. S. Lewis Context Expert details"));
    const dialog = getDialog();
    expect(dialog.textContent).toContain("Lewis on Peacemaking");
    expect(dialog.textContent).not.toContain("Save attribution");
    expect(dialog.textContent).not.toContain("Corrected Person");
  });

  test("stores dashboard Smart Storage contributions without direct posting", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");
    const uploadedFile = new File(["Friday chapel program"], "chapel-program.pdf", {
      type: "application/pdf",
    });
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ storageId: "storage-chapel-program" }),
      ok: true,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await renderApp();

    const editor = getContributionEditor();
    expect(editor.textContent).toContain("Store");

    await setFieldValue(
      getTextareaIn(editor),
      [
        "Raw chapel notes",
        "A source that should be preserved before enrichment.",
        "https://example.com/chapel-program",
      ].join("\n"),
    );
    await setFileInputFiles(getFileInputIn(editor), [uploadedFile]);
    await flushAsyncWork();

    expect(editor.textContent).not.toContain("Source Inventory");
    expect(editor.textContent).toContain("Chapel Program");
    expect(editor.textContent).toContain("https://example.com/chapel-program");
    expect(editor.textContent).toContain("chapel-program.pdf");

    await click(getButtonIn(editor, "Store"));

    expect(fetchMock).toHaveBeenCalledWith(
      "https://upload.example/convex-storage",
      expect.objectContaining({
        body: uploadedFile,
        headers: {
          "Content-Type": "application/pdf",
        },
        method: "POST",
      }),
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        fileName: "chapel-program.pdf",
        fileSizeBytes: uploadedFile.size,
        functionName: "smartStorage:createTemporaryUploadRecord",
        storageId: "storage-chapel-program",
      }),
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        body: [
          "Raw chapel notes",
          "A source that should be preserved before enrichment.",
          "https://example.com/chapel-program",
        ].join("\n"),
        contextTags: [],
        externalUrls: [
          {
            linkPreviewDescription: "Friday chapel program.",
            linkPreviewImageUrl: "https://example.com/chapel-program.png",
            linkPreviewSiteName: "Example Chapel",
            linkPreviewTitle: "Chapel Program",
            url: "https://example.com/chapel-program",
          },
        ],
        functionName: "smartStorage:startFromContribution",
        knowledgeType: "words",
        title: "Raw chapel notes",
        uploadedFiles: [
          expect.objectContaining({
            contentType: "application/pdf",
            fileName: "chapel-program.pdf",
            fileSizeBytes: uploadedFile.size,
            storageId: "storage-chapel-program",
            temporaryUploadId: "temporary-upload-chapel-program",
          }),
        ],
      }),
    );
    expect(mockState.actionCalls).toContainEqual(
      expect.objectContaining({
        functionName: "smartStorage:previewDraftExternalUrl",
        url: "https://example.com/chapel-program",
      }),
    );
    expect(mockState.actionCalls).toContainEqual(
      expect.objectContaining({
        functionName: "smartStorage:executeModelRun",
        smartStorageRunId: "smart-storage-run-raw-chapel-notes",
      }),
    );
    expect(
      mockState.mutationCalls.some(
        (call) =>
          call &&
          typeof call === "object" &&
          "functionName" in call &&
          call.functionName === "smartStorage:generateDraftProposalForRun",
      ),
    ).toBe(false);
    expect(
      mockState.mutationCalls.some(
        (call) =>
          call &&
          typeof call === "object" &&
          "functionName" in call &&
          call.functionName === "directContributions:postDirectContribution",
      ),
    ).toBe(false);
    expect(editor.textContent).toContain("Stored");
    await flushAsyncWork();
    await rerenderApp();

    const proposalReview = getLabelledElement("Smart Storage Session Wizard");
    expect(proposalReview.textContent).toContain("Raw chapel notes");
    expect(proposalReview.textContent).toContain("Words");
    expect(proposalReview.textContent).toContain(
      "A source that should be preserved before enrichment.",
    );
    expect(proposalReview.textContent).toContain("Sources saved");
    expect(proposalReview.textContent).toContain("Primary Intended Entry");
    expect(proposalReview.textContent).toContain("Proposal Confidence");
    expect(proposalReview.textContent).toContain("Medium");
    expect(proposalReview.textContent).toContain("Accept-ready");
    expect(proposalReview.textContent).toContain("Text Excerpt");
    expect(proposalReview.textContent).toContain("External URL");
    expect(proposalReview.textContent).toContain("File");
    expect(proposalReview.textContent).not.toContain("OpenAI Diagnostics");
    expect(getFeedItems("answer").map(getCardTitle)).not.toContain(
      "Raw chapel notes",
    );
    const citationCheckboxes = getCheckboxesIn(proposalReview);
    expect(citationCheckboxes).toHaveLength(3);
    expect(citationCheckboxes.every((checkbox) => checkbox.checked)).toBe(true);
    const roleSelects = Array.from(proposalReview.querySelectorAll("select")).map(
      (select) => {
        if (!(select instanceof HTMLSelectElement)) {
          throw new Error("Unexpected representation role select.");
        }

        return select;
      },
    );
    expect(roleSelects.map((select) => select.value)).toEqual([
      "primaryContent",
      "supportingMaterial",
      "supportingMaterial",
    ]);
    const primaryRadios = Array.from(
      proposalReview.querySelectorAll('input[type="radio"]'),
    ).map((radio) => {
      if (!(radio instanceof HTMLInputElement)) {
        throw new Error("Unexpected primary representation radio.");
      }

      return radio;
    });
    expect(primaryRadios).toHaveLength(3);
    expect(primaryRadios[0].checked).toBe(true);
    await toggleCheckbox(citationCheckboxes[1]);
    expect(roleSelects[1].disabled).toBe(true);
    await setSelectValue(roleSelects[2], "slides");
    await toggleCheckbox(primaryRadios[2]);

    await click(getButtonIn(proposalReview, "Accept Primary Entry"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "smartStorage:acceptScaffoldProposal",
        representationDecisions: [
          {
            includeAsRepresentation: true,
            isPrimary: false,
            representationRole: "primaryContent",
            sourceId: "source-raw-chapel-notes",
          },
          {
            includeAsRepresentation: false,
            isPrimary: false,
            representationRole: "supportingMaterial",
            sourceId: "source-external-url-1",
          },
          {
            includeAsRepresentation: true,
            isPrimary: true,
            representationRole: "slides",
            sourceId: "source-uploaded-file-1",
          },
        ],
        smartStorageProposalId: "smart-storage-proposal-raw-chapel-notes",
      }),
    );
    expect(getLabelledElement("Created Knowledge Entry").textContent).toContain(
      "Raw chapel notes",
    );
    expect(getFeedItems("answer").map(getCardTitle)).toContain(
      "Raw chapel notes",
    );
  });

  test("opens the Smart Storage wizard immediately while proposal generation is pending", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");
    mockState.smartStorageModelRunDelay = new Promise<void>(() => undefined);
    const uploadedFile = new File(["Friday chapel program"], "chapel-program.pdf", {
      type: "application/pdf",
    });
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ storageId: "storage-chapel-program" }),
      ok: true,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await renderApp();

    const editor = getContributionEditor();
    await setFieldValue(
      getTextareaIn(editor),
      [
        "Raw chapel notes",
        "A source that should be preserved before enrichment.",
        "https://example.com/chapel-program",
      ].join("\n"),
    );
    await setFileInputFiles(getFileInputIn(editor), [uploadedFile]);
    await flushAsyncWork();
    await click(getButtonIn(editor, "Store"));

    const wizard = getLabelledElement("Smart Storage Session Wizard");
    expect(wizard.textContent).toContain("Sources saved");
    expect(wizard.textContent).toContain("Bronze Layer preserved");
    expect(wizard.textContent).toContain("Queued");
    expect(wizard.textContent).toContain("Text");
    expect(wizard.textContent).toContain("URL");
    expect(wizard.textContent).toContain("File");
    expect(wizard.textContent).not.toContain("OpenAI Diagnostics");
  });

  test("orders prerequisite proposals before a blocked Primary Intended Entry", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const editor = getContributionEditor();
    await setFieldValue(
      getTextareaIn(editor),
      "Courage in Christ's Kingdom\nSermon notes with a speaker line.",
    );
    await click(getButtonIn(editor, "Store"));
    await flushAsyncWork();
    await rerenderApp();

    mockState.smartStorageSessionSummary =
      createMockSmartStoragePrerequisiteSessionSummary();
    await rerenderApp();

    const wizard = getLabelledElement("Smart Storage Session Wizard");
    const wizardText = wizard.textContent ?? "";
    expect(wizardText).toContain("Accept Prerequisites First");
    expect(wizardText.indexOf("Rev. Thomas Walker")).toBeLessThan(
      wizardText.indexOf("Courage in Christ's Kingdom"),
    );
    expect(wizardText).toContain("Later review work");
    expect(wizardText).toContain("Courage quote");
    expect((getButtonIn(wizard, "Accept Primary Entry") as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  test("Finish later closes the Smart Storage wizard without cancelling session work", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const editor = getContributionEditor();
    await setFieldValue(
      getTextareaIn(editor),
      "Raw chapel notes\nA source that should be preserved before enrichment.",
    );
    await click(getButtonIn(editor, "Store"));
    await flushAsyncWork();
    await rerenderApp();

    const wizard = getLabelledElement("Smart Storage Session Wizard");
    await click(getButtonIn(wizard, "Finish later"));

    expect(container.querySelector('[aria-label="Smart Storage Session Wizard"]')).toBeNull();
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "smartStorage:startFromContribution",
      }),
    );
    expect(
      mockState.mutationCalls.some(
        (call) =>
          call &&
          typeof call === "object" &&
          "functionName" in call &&
          String(call.functionName).includes("cancel"),
      ),
    ).toBe(false);
  });

  test("stores dashboard Smart Storage contributions when draft Link Preview fails", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");
    mockState.draftLinkPreviewResult = {
      error: "Link Preview response is not HTML.",
      status: "failed",
      url: "https://example.com/chapel-program",
    };

    await renderApp();

    const editor = getContributionEditor();
    await setFieldValue(
      getTextareaIn(editor),
      [
        "Raw chapel notes",
        "A source that should be preserved before enrichment.",
        "https://example.com/chapel-program",
      ].join("\n"),
    );
    await flushAsyncWork();

    expect(editor.textContent).toContain("Link preview unavailable");
    await click(getButtonIn(editor, "Store"));

    expect(mockState.actionCalls).toContainEqual(
      expect.objectContaining({
        functionName: "smartStorage:previewDraftExternalUrl",
        url: "https://example.com/chapel-program",
      }),
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        externalUrls: [{ url: "https://example.com/chapel-program" }],
        functionName: "smartStorage:startFromContribution",
      }),
    );
    expect(editor.textContent).toContain("Stored");
  });

  test("confirms Smart Storage updates into an existing Gold entry", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");
    mockState.smartStorageAcceptReturnsTargetExists = true;

    await renderApp();

    const editor = getContributionEditor();
    await setFieldValue(
      getTextareaIn(editor),
      "Raw chapel notes\nA source that should update the existing Gold entry.",
    );
    await click(getButtonIn(editor, "Store"));
    await flushAsyncWork();
    await rerenderApp();

    let proposalReview = getLabelledElement("Smart Storage Session Wizard");
    await click(getButtonIn(proposalReview, "Accept Primary Entry"));
    await flushAsyncWork();
    await rerenderApp();

    proposalReview = getLabelledElement("Smart Storage Session Wizard");
    expect(proposalReview.textContent).toContain("Needs resolution");
    expect(getButtonIn(proposalReview, "Add to Existing Entry")).toBeTruthy();
    expect(getFeedItems("answer").map(getCardTitle)).not.toContain(
      "Raw chapel notes",
    );

    await click(getButtonIn(proposalReview, "Add to Existing Entry"));

    const acceptCalls = mockState.mutationCalls.filter(
      (call): call is Record<string, unknown> =>
        call !== null &&
        typeof call === "object" &&
        "functionName" in call &&
        call.functionName === "smartStorage:acceptScaffoldProposal",
    );
    expect(acceptCalls).toHaveLength(2);
    expect(acceptCalls[0]).not.toHaveProperty("targetExistingEntryId");
    expect(acceptCalls[1]).toMatchObject({
      functionName: "smartStorage:acceptScaffoldProposal",
      smartStorageProposalId: "smart-storage-proposal-raw-chapel-notes",
      targetExistingEntryId: "entry-existing-raw-chapel-notes",
    });
    expect(acceptCalls[1]).toMatchObject({
      representationDecisions: [
        {
          includeAsRepresentation: true,
          isPrimary: true,
          representationRole: "primaryContent",
          sourceId: "source-raw-chapel-notes",
        },
      ],
    });
    expect(getLabelledElement("Created Knowledge Entry").textContent).toContain(
      "Raw chapel notes",
    );
  });

  test.each([
    {
      errorMessage: "OPENAI_API_KEY is not configured.",
      executionStatus: "failed",
      heading: "Proposal generation failed",
      runStatus: "failed",
    },
    {
      executionStatus: "noProposal",
      heading: "No proposal was created",
      runStatus: "noProposal",
    },
  ])(
    "shows explicit Smart Storage $runStatus outcome with deterministic fallback",
    async ({ errorMessage, executionStatus, heading, runStatus }) => {
      mockState.smartStorageModelRunResult = {
        ...(errorMessage === undefined ? {} : { errorMessage }),
        executionStatus,
        rawModelOutput: "RAW MODEL OUTPUT",
        rawModelRequest: "RAW MODEL REQUEST",
        smartStorageRunId: "smart-storage-run-raw-chapel-notes",
        status: runStatus,
      };

      await renderApp();

      const editor = getContributionEditor();
      await setFieldValue(
        getTextareaIn(editor),
        "Raw chapel notes\nA source that should be preserved before enrichment.",
      );
      await click(getButtonIn(editor, "Store"));

      expect(mockState.actionCalls).toContainEqual(
        expect.objectContaining({
          functionName: "smartStorage:executeModelRun",
          smartStorageRunId: "smart-storage-run-raw-chapel-notes",
        }),
      );
      expect(
        mockState.mutationCalls.some(
          (call) =>
            call &&
            typeof call === "object" &&
            "functionName" in call &&
            call.functionName === "smartStorage:generateDraftProposalForRun",
        ),
      ).toBe(false);

      await flushAsyncWork();
      await rerenderApp();

      const runStatusPanel = getLabelledElement("Smart Storage Session Wizard");
      expect(runStatusPanel.textContent).toContain(heading);
      expect(runStatusPanel.textContent).toContain(
        "Sources were saved.",
      );
      expect(getButtonIn(runStatusPanel, "Retry model")).toBeTruthy();
      expect(getButtonIn(runStatusPanel, "Create basic proposal")).toBeTruthy();
      expect(getButtonIn(runStatusPanel, "Finish later")).toBeTruthy();
      expect(getButtonIn(runStatusPanel, "Cancel session")).toBeTruthy();
      expect(runStatusPanel.textContent).not.toContain("RAW MODEL OUTPUT");
      expect(runStatusPanel.textContent).not.toContain("RAW MODEL REQUEST");
      expect(runStatusPanel.textContent).not.toContain("OpenAI Diagnostics");
      if (errorMessage !== undefined) {
        expect(runStatusPanel.textContent).toContain(errorMessage);
      }

      await click(getButtonIn(runStatusPanel, "Create basic proposal"));
      await flushAsyncWork();
      await rerenderApp();

      expect(mockState.mutationCalls).toContainEqual(
        expect.objectContaining({
          functionName: "smartStorage:generateDraftProposalForRun",
          smartStorageRunId: "smart-storage-run-raw-chapel-notes",
        }),
      );
      expect(getLabelledElement("Smart Storage Session Wizard").textContent).toContain(
        "Raw chapel notes",
      );
    },
  );

  test("opens organization settings as an organization subroute", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/organizations/ruler-of-kings-church",
    );

    await renderApp();

    expect(container.textContent).toContain("My Church");
    expect(container.textContent).toContain("Ministry Queue");

    const organizationRoutes = getLabelledElement("Organization subroutes");
    expect(organizationRoutes.classList.contains("kb-page-subroutes")).toBe(true);
    expect(organizationRoutes.classList.contains("kb-related-routes")).toBe(false);
    const organizationMain = container.querySelector(".kb-organization-main");
    const organizationHero = container.querySelector(".kb-organization-hero");
    if (!organizationMain || !organizationHero) {
      throw new Error("Missing organization page structure");
    }
    const organizationChildren = Array.from(organizationMain.children);
    expect(organizationChildren.indexOf(organizationRoutes)).toBeGreaterThan(-1);
    expect(organizationChildren.indexOf(organizationRoutes)).toBeLessThan(
      organizationChildren.indexOf(organizationHero),
    );
    await click(getLinkIn(organizationRoutes, "Settings"));

    expect(window.location.pathname).toBe(
      "/organizations/ruler-of-kings-church/settings",
    );
    expect(container.textContent).toContain("Organization Settings");
    expect(container.textContent).toContain("Ruler of Kings Church");
    expect(getLinkIn(container, "Organization Home").getAttribute("href")).toBe(
      "/organizations/ruler-of-kings-church",
    );
    expect(
      container
        .querySelector('a[aria-label="Ruler of Kings Church"]')
        ?.getAttribute("aria-current"),
    ).toBe("page");
  });

  test("lets system admins open and manage settings for any visible organization", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/organizations/cedar-hall-school/settings",
    );
    mockState.appAccess = {
      email: "sysadmin@example.com",
      organizations: [
        {
          name: "Cedar Hall School",
          organizationEntryId: "cedarHallEntry",
          organizationKind: "school",
          organizationReferentId: "cedar-hall-school",
          role: "admin",
        },
      ],
      status: "allowed",
      systemRole: "systemAdmin",
      userId: "systemAdminUser",
    };
    mockState.pinnedKnowledgePages = [
      {
        href: "/organizations/cedar-hall-school",
        id: "cedar-hall-school",
        label: "Cedar Hall School",
        organizationKind: "school",
        organizationName: "Cedar Hall School",
        organizationReferentId: "cedar-hall-school",
        pageKey: "organization:cedar-hall-school",
        pinSource: "defaultSeed",
        secondaryLabel: "School",
        sortOrder: 0,
      },
    ];
    mockState.organizationMembershipMembers = [
      {
        claimEvidence: {
          claimedAt: Date.now(),
          claimedContactKind: "email",
          claimedContactValue: "claimed.teacher@example.com",
          claimSource: "verifiedContactIdentity",
          personConsolidation: {
            approvedAt: Date.now(),
            pendingPersonName: "Review Settings",
            pendingPersonReferentId: "person:review-settings",
            resultingPersonName: "Claimed Teacher",
            resultingPersonReferentId: "person:claimed-teacher",
            reviewId: "review:approved-teacher",
          },
        },
        email: "teacher.personal@example.com",
        membershipId: "membership:claimed-teacher",
        name: "Claimed Teacher",
        role: "member",
        status: "active",
        userId: "claimedTeacherUser",
      },
      {
        email: "pending.teacher@example.com",
        membershipId: "membership:pending-teacher",
        name: "pending.teacher@example.com",
        personConsolidationReview: {
          claimedContactKind: "email",
          claimedContactValue: "pending.teacher@example.com",
          claimSource: "verifiedContactIdentity",
          requestedAt: Date.now(),
          requestedByEmail: "teacher.claimant@example.com",
          reviewId: "review:pending-teacher",
          reviewReason: "placeholderHasMeaningfulIdentity",
          reviewStatus: "pending",
          updatedAt: Date.now(),
        },
        role: "member",
        status: "pending",
      },
      {
        email: "plain.pending@example.com",
        membershipId: "membership:plain-pending",
        name: "plain.pending@example.com",
        role: "member",
        status: "pending",
      },
      {
        email: "rejected.teacher@example.com",
        membershipId: "membership:rejected-teacher",
        name: "Rejected Teacher",
        personConsolidationReview: {
          claimedContactKind: "email",
          claimedContactValue: "rejected.teacher@example.com",
          claimSource: "verifiedContactIdentity",
          requestedAt: Date.now(),
          requestedByEmail: "rejected.claimant@example.com",
          reviewId: "review:rejected-teacher",
          reviewReason: "placeholderHasMeaningfulIdentity",
          reviewStatus: "rejected",
          updatedAt: Date.now(),
        },
        role: "member",
        status: "pending",
      },
    ];

    await renderApp();

    expect(container.textContent).toContain("Organization Settings");
    expect(container.textContent).toContain("Cedar Hall School");
    expect(container.textContent).toContain("Members");
    expect(container.textContent).toContain("Member email");
    expect(container.textContent).toContain("Claimed Teacher");
    expect(container.textContent).toContain(
      "Claimed via verified contact email claimed.teacher@example.com.",
    );
    expect(container.textContent).toContain(
      "Person Consolidation approved: Review Settings was consolidated into Claimed Teacher.",
    );
    expect(container.textContent).toContain("pending.teacher@example.com");
    expect(container.textContent).toContain(
      "Identity review requested for pending.teacher@example.com by teacher.claimant@example.com.",
    );
    expect(container.textContent).toContain("Needs Identity Review");
    expect(getButton("Approve review")).toBeTruthy();
    expect(getButton("Reject review")).toBeTruthy();
    const activeMemberRow = Array.from(
      container.querySelectorAll(".kb-org-member-list li"),
    ).find((memberRow) =>
      memberRow.textContent?.includes("teacher.personal@example.com"),
    );
    if (!activeMemberRow) {
      throw new Error("Missing active member row.");
    }
    expect(activeMemberRow.textContent).not.toContain("Withdraw");
    const pendingReviewMemberRow = Array.from(
      container.querySelectorAll(".kb-org-member-list li"),
    ).find((memberRow) =>
      memberRow.textContent?.includes("pending.teacher@example.com"),
    );
    if (!pendingReviewMemberRow) {
      throw new Error("Missing pending review member row.");
    }
    expect(pendingReviewMemberRow.textContent).not.toContain("Withdraw");
    const plainPendingMemberRow = Array.from(
      container.querySelectorAll(".kb-org-member-list li"),
    ).find((memberRow) =>
      memberRow.textContent?.includes("plain.pending@example.com"),
    );
    if (!plainPendingMemberRow) {
      throw new Error("Missing plain pending member row.");
    }
    expect(getButtonIn(plainPendingMemberRow, "Withdraw")).toBeTruthy();
    const rejectedMemberRow = Array.from(
      container.querySelectorAll(".kb-org-member-list li"),
    ).find((memberRow) =>
      memberRow.textContent?.includes("rejected.teacher@example.com"),
    );
    if (!rejectedMemberRow) {
      throw new Error("Missing rejected member row.");
    }
    expect(rejectedMemberRow.textContent).toContain(
      "Identity review rejected for rejected.teacher@example.com by rejected.claimant@example.com.",
    );
    expect(rejectedMemberRow.textContent).toContain("Identity Review Rejected");
    expect(rejectedMemberRow.textContent).not.toContain("Approve review");
    expect(rejectedMemberRow.textContent).not.toContain("Reject review");
    expect(getButtonIn(rejectedMemberRow, "Reopen review")).toBeTruthy();
    expect(getButtonIn(rejectedMemberRow, "Withdraw")).toBeTruthy();
    expect(container.textContent).not.toContain("Invitation");
    expect(getButton("Add member")).toBeTruthy();

    await click(getButtonIn(plainPendingMemberRow, "Withdraw"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "organizationAccounts:withdrawPendingOrganizationMember",
        membershipId: "membership:plain-pending",
        organizationId: "cedar-hall-school",
      }),
    );
    expect(container.textContent).toContain(
      "Withdrew pending member plain.pending@example.com.",
    );

    await click(getButtonIn(rejectedMemberRow, "Reopen review"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "organizationAccounts:reopenPersonConsolidationReview",
        organizationId: "cedar-hall-school",
        personConsolidationReviewId: "review:rejected-teacher",
      }),
    );
    expect(container.textContent).toContain(
      "Reopened identity review for rejected.teacher@example.com.",
    );

    await click(getButton("Reject review"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "organizationAccounts:rejectPersonConsolidationReview",
        organizationId: "cedar-hall-school",
        personConsolidationReviewId: "review:pending-teacher",
      }),
    );
    expect(container.textContent).toContain(
      "Rejected identity review for pending.teacher@example.com.",
    );

    await click(getButton("Approve review"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "organizationAccounts:approvePersonConsolidationReview",
        organizationId: "cedar-hall-school",
        personConsolidationReviewId: "review:pending-teacher",
      }),
    );
    expect(container.textContent).toContain(
      "Approved identity review for pending.teacher@example.com.",
    );

    const emailInput = container.querySelector('input[name="memberEmail"]');
    const roleSelect = container.querySelector('select[name="memberRole"]');
    if (!(emailInput instanceof HTMLInputElement)) {
      throw new Error("Missing member email input.");
    }
    if (!(roleSelect instanceof HTMLSelectElement)) {
      throw new Error("Missing member role select.");
    }

    await setFieldValue(emailInput, "teacher@example.com");
    await setSelectValue(roleSelect, "admin");
    await click(getButton("Add member"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        email: "teacher@example.com",
        functionName: "organizationAccounts:addOrganizationMember",
        organizationId: "cedar-hall-school",
        role: "admin",
      }),
    );
  });

  test("creates a Group from an organization Create Group action", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/organizations/organizationReferent",
    );

    await renderApp();

    const primaryActions = getLabelledElement("Primary actions");
    const createGroupLink = getLinkContainingIn(primaryActions, "Create Group");
    expect(createGroupLink.getAttribute("href")).toBe(
      "/explore?tagIds=arche-classical-academy&contributionType=group&guided=1",
    );

    await click(createGroupLink);

    expect(window.location.pathname + window.location.search).toBe(
      "/explore?tagIds=arche-classical-academy&contributionType=group&guided=1",
    );

    const editor = getContributionEditor();
    expect(editor.querySelector("select")).toBeNull();
    expect(editor.textContent).toContain("Group");
    expect(editor.textContent).toContain("What is the group called?");
    expect(editor.querySelector("textarea")).toBeNull();
    expect(getContributionContextLabels(editor)).toEqual([
      "Arche Classical Academy",
    ]);

    await setFieldValue(getTextInputIn(editor), "Basketball Club");
    await click(getButtonIn(editor, "Create Group"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        body: "",
        functionName: "directContributions:postDirectContribution",
        knowledgeType: "group",
        title: "Basketball Club",
      }),
    );

    const createdEntryFocus = getLabelledElement("Created Knowledge Entry");
    expect(createdEntryFocus.textContent).toContain("Editing Knowledge Entry");
    expect(createdEntryFocus.textContent).toContain("Basketball Club");
    expect(createdEntryFocus.textContent).toContain("Group");
    expect(getLinkIn(createdEntryFocus, "Edit Entry").getAttribute("href")).toBe(
      "/entries/entry-basketball-club",
    );

    const contributionAnswer = getFeedItems("answer").find(
      (item) => getCardTitle(item) === "Basketball Club",
    );
    expect(contributionAnswer).toBeTruthy();
    expect(contributionAnswer?.textContent).toContain("Knowledge Entry");
    expect(contributionAnswer?.textContent).toContain("Group");
    expect(contributionAnswer?.textContent).toContain("Created Group entry.");
    expect(contributionAnswer?.textContent).toContain("Primary Tag");
    expect(contributionAnswer?.textContent).toContain("Basketball Club");
    expect(contributionAnswer?.textContent).toContain("Arche Classical Academy");
  });

  test("shows a create-or-join organization request when access is blocked", async () => {
    mockState.appAccess = {
      email: "outside@example.com",
      status: "needsOrganization",
      userId: "outsideUser",
    };

    await renderApp();

    expect(container.textContent).toContain("Create or join an organization");
    expect(container.textContent).toContain("outside@example.com");
    expect(container.textContent).toContain("Request to join");
    expect(container.textContent).toContain("Request to create");
    expect(container.textContent).toContain("Claim by email");

    await setFieldValue(
      getInputByName("claimEmail"),
      "Corey@ArcheClassicalAcademy.com",
    );
    await click(getButton("Send code"));

    expect(mockState.actionCalls).toContainEqual(
      expect.objectContaining({
        email: "Corey@ArcheClassicalAcademy.com",
        functionName: "contactIdentities:sendEmailVerificationCode",
      }),
    );
    expect(container.textContent).toContain("Verification code requested.");

    await setFieldValue(getInputByName("claimCode"), "123456");
    await click(getButton("Verify and claim"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        code: "123456",
        email: "corey@archeclassicalacademy.com",
        functionName:
          "contactIdentities:verifyEmailAndClaimPendingMemberships",
      }),
    );
    expect(container.textContent).toContain("2 memberships claimed.");
    expect(container.querySelector(".kb-shell")).toBeNull();
  });

  test("reports identity review when a verified claim cannot auto-claim", async () => {
    mockState.appAccess = {
      email: "outside@example.com",
      status: "needsOrganization",
      userId: "outsideUser",
    };

    await renderApp();

    await setFieldValue(getInputByName("claimEmail"), "Review@Example.com");
    await click(getButton("Send code"));
    await setFieldValue(getInputByName("claimCode"), "123456");
    await click(getButton("Verify and claim"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        code: "123456",
        email: "review@example.com",
        functionName:
          "contactIdentities:verifyEmailAndClaimPendingMemberships",
      }),
    );
    expect(container.textContent).toContain(
      "1 membership needs identity review.",
    );
    expect(container.textContent).not.toContain(
      "Email verified. No pending memberships found.",
    );
  });

  test("reports a rejected identity review when a verified claim was already rejected", async () => {
    mockState.appAccess = {
      email: "outside@example.com",
      status: "needsOrganization",
      userId: "outsideUser",
    };

    await renderApp();

    await setFieldValue(getInputByName("claimEmail"), "Rejected@Example.com");
    await click(getButton("Send code"));
    await setFieldValue(getInputByName("claimCode"), "123456");
    await click(getButton("Verify and claim"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        code: "123456",
        email: "rejected@example.com",
        functionName:
          "contactIdentities:verifyEmailAndClaimPendingMemberships",
      }),
    );
    expect(container.textContent).toContain(
      "1 membership was not approved after identity review. Contact the organization admin.",
    );
    expect(container.textContent).not.toContain(
      "1 membership needs identity review.",
    );
    expect(container.textContent).not.toContain(
      "Email verified. No pending memberships found.",
    );
  });

  test("renders user settings with account context and persisted theme control", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/settings");

    await renderApp();

    expect(container.textContent).toContain("User Settings");
    expect(container.textContent).toContain("gelbaughcm@gmail.com");
    expect(container.textContent).toContain("Arche Classical Academy");
    expect(container.textContent).toContain("School");
    expect(container.textContent).toContain("Admin");
    expect(container.textContent).not.toContain("Organization Accounts");
    const contactIdentities = getLabelledElement("Contact Identities");
    expect(contactIdentities.textContent).toContain("Primary account email");
    expect(contactIdentities.textContent).toContain("gelbaughcm@gmail.com");
    expect(contactIdentities.textContent).toContain(
      "corey@archeclassicalacademy.com",
    );
    expect(contactIdentities.textContent).toContain(
      "corey@rulerofkingschurch.com",
    );
    expect(contactIdentities.textContent).toContain("Verified");
    expect(contactIdentities.textContent).toContain("Pending");

    const themeSwitch = getButton("Use dark theme");
    expect(themeSwitch.getAttribute("role")).toBe("switch");
    expect(themeSwitch.getAttribute("aria-checked")).toBe("false");

    await click(themeSwitch);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("knowledgebase-theme")).toBe("dark");
    expect(getButton("Use light theme").getAttribute("aria-checked")).toBe("true");

    const globalExpertVisibilitySwitch = getButton(
      "Enable Global Expert Visibility",
    );
    expect(globalExpertVisibilitySwitch.getAttribute("role")).toBe("switch");
    expect(globalExpertVisibilitySwitch.getAttribute("aria-checked")).toBe(
      "false",
    );

    await click(globalExpertVisibilitySwitch);

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        enabled: true,
        functionName: "contextExpertiseSettings:updateGlobalExpertVisibility",
      }),
    );
    expect(
      getButton("Disable Global Expert Visibility").getAttribute("aria-checked"),
    ).toBe("true");
  });

  test("lets an authorized user verify an alternate Contact Identity from settings", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/settings");

    await renderApp();

    await setFieldValue(
      getInputByName("contactIdentityEmail"),
      "Corey@ArcheClassicalAcademy.com",
    );
    await click(getButton("Send code"));

    expect(mockState.actionCalls).toContainEqual(
      expect.objectContaining({
        email: "Corey@ArcheClassicalAcademy.com",
        functionName: "contactIdentities:sendEmailVerificationCode",
      }),
    );
    expect(container.textContent).toContain("Verification code requested.");

    await setFieldValue(getInputByName("contactIdentityCode"), "123456");
    await click(getButton("Verify and claim"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        code: "123456",
        email: "corey@archeclassicalacademy.com",
        functionName:
          "contactIdentities:verifyEmailAndClaimPendingMemberships",
      }),
    );
    expect(container.textContent).toContain("2 memberships claimed.");
  });

  test("claims pending memberships immediately for an already verified Contact Identity from settings", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/settings");

    await renderApp();

    await setFieldValue(
      getInputByName("contactIdentityEmail"),
      "Verified.Alias@Example.com",
    );
    await click(getButton("Send code"));

    expect(mockState.actionCalls).toContainEqual(
      expect.objectContaining({
        email: "Verified.Alias@Example.com",
        functionName: "contactIdentities:sendEmailVerificationCode",
      }),
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        email: "verified.alias@example.com",
        functionName: "contactIdentities:claimVerifiedEmailMemberships",
      }),
    );
    expect(container.textContent).toContain("1 membership claimed.");
  });

  test("lets system admins create organization accounts from the sidebar route", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");
    mockState.appAccess = {
      ...(mockState.appAccess as Record<string, unknown>),
      systemRole: "systemAdmin",
    };

    await renderApp();

    expect(getSelect("Active Role").value).toBe("system:systemAdmin");
    expect(getLabelledLinkIn(getLabelledElement("User Views"), "System Admin")).toBeTruthy();

    await click(getLabelledLinkIn(getLabelledElement("User Views"), "System Admin"));

    expect(window.location.pathname).toBe("/system-admin");
    expect(container.textContent).toContain("Organization Accounts");

    const nameInput = container.querySelector('input[name="organizationName"]');
    const kindSelect = container.querySelector('select[name="organizationKind"]');
    if (!(nameInput instanceof HTMLInputElement)) {
      throw new Error("Missing organization name input.");
    }
    if (!(kindSelect instanceof HTMLSelectElement)) {
      throw new Error("Missing organization type select.");
    }

    await setFieldValue(nameInput, "Cedar Hall School");
    await setSelectValue(kindSelect, "school");
    await click(getButton("Set up account"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "organizationAccounts:createOrganizationAccount",
        name: "Cedar Hall School",
        organizationKind: "school",
      }),
    );
    expect(container.textContent).toContain("Created Cedar Hall School");
    expect(getLinkIn(container, "Cedar Hall School").getAttribute("href")).toBe(
      "/organizations/cedar-hall-school",
    );
  });

  test("lets system admins preview Context Expertise operations without execution", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/system-admin");
    mockState.appAccess = {
      ...(mockState.appAccess as Record<string, unknown>),
      systemRole: "systemAdmin",
    };

    await renderApp();

    const operations = getLabelledElement("Context Expertise Operations");
    expect(operations.textContent).toContain("Scoped Aggregate Migration");
    expect(operations.textContent).toContain("Missing scoped groups");
    expect(operations.textContent).toContain("first-crusade,matthew-5-9");
    expect(operations.textContent).toContain("Quote Attribution Backfill");
    expect(operations.textContent).toContain("Missing evidence");
    expect(operations.textContent).toContain("augustine,first-crusade");

    await click(getButtonIn(operations, "Dry-run scoped aggregate rebuild"));

    const scopedDryRunCall = mockState.mutationCalls.find(
      (call) =>
        call &&
        typeof call === "object" &&
        "functionName" in call &&
        call.functionName === "contextExpertise:rebuildScopedAggregateBatch",
    ) as Record<string, unknown> | undefined;
    expect(scopedDryRunCall).toEqual(
      expect.objectContaining({
        dryRun: true,
        functionName: "contextExpertise:rebuildScopedAggregateBatch",
      }),
    );
    expect(scopedDryRunCall?.paginationOpts).toEqual({
      cursor: null,
      numItems: 25,
    });
    expect(scopedDryRunCall).not.toHaveProperty("execute");
    expect(
      getLabelledElement("Scoped Aggregate Migration dry-run preview").textContent,
    ).toContain("Dry-run checked 25 evidence rows across 1 groups.");

    await setFieldValue(getInputByName("quoteAttributionBackfillBatchSize"), "7");
    await setFieldValue(
      getInputByName("quoteAttributionBackfillCursor"),
      "quote-cursor-input",
    );
    await click(getButtonIn(operations, "Dry-run Quote attribution backfill"));

    const quoteDryRunCall = mockState.mutationCalls.find(
      (call) =>
        call &&
        typeof call === "object" &&
        "functionName" in call &&
        call.functionName ===
          "contextExpertise:backfillQuoteAttributionEvidenceBatch",
    ) as Record<string, unknown> | undefined;
    expect(quoteDryRunCall).toEqual(
      expect.objectContaining({
        dryRun: true,
        functionName: "contextExpertise:backfillQuoteAttributionEvidenceBatch",
      }),
    );
    expect(quoteDryRunCall?.paginationOpts).toEqual({
      cursor: "quote-cursor-input",
      numItems: 7,
    });
    expect(quoteDryRunCall).not.toHaveProperty("execute");
    expect(
      getLabelledElement("Quote Attribution Backfill dry-run preview").textContent,
    ).toContain("would create 1 evidence rows");
  });

  test("lets system admins suppress and restore public figure Context Experts", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/system-admin");
    mockState.appAccess = {
      ...(mockState.appAccess as Record<string, unknown>),
      systemRole: "systemAdmin",
    };
    mockState.publicFigureExpertPersonOptions = [
      {
        label: "C. S. Lewis",
        referentId: "referent-lewis",
        tagId: "tag-lewis",
      },
    ];
    mockState.personGlobalExpertVisibilityModeration = {
      personLabel: "C. S. Lewis",
      personReferentId: "referent-lewis",
      status: "visibleByDefault",
    };

    await renderApp();

    expect(container.textContent).toContain("Public Figure Experts");
    await setFieldValue(getInputByName("publicFigureExpertSearch"), "Lewis");
    await click(getButton("C. S. Lewis"));
    expect(
      getLabelledElement("Public Figure Expert visibility status").textContent,
    ).toContain("Visible globally by default");
    expect(
      getLabelledElement("Public Figure Expert moderation history").textContent,
    ).toContain("No moderation history yet.");

    await setFieldValue(
      getInputByName("publicFigureExpertModerationNote"),
      "Misattributed quote evidence.",
    );
    await click(getButton("Suppress globally"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName:
          "contextExpertise:updatePersonGlobalExpertVisibilityModeration",
        moderationNote: "Misattributed quote evidence.",
        personReferentId: "referent-lewis",
        suppressed: true,
      }),
    );
    expect(
      getLabelledElement("Public Figure Expert visibility status").textContent,
    ).toContain("Suppressed globally");
    expect(
      getLabelledElement("Public Figure Expert moderation history").textContent,
    ).toContain("Suppressed");
    expect(
      getLabelledElement("Public Figure Expert moderation history").textContent,
    ).toContain("Misattributed quote evidence.");

    await setFieldValue(
      getInputByName("publicFigureExpertModerationNote"),
      "Corrected attribution reviewed.",
    );
    await click(getButton("Update note"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName:
          "contextExpertise:updatePersonGlobalExpertVisibilityModeration",
        moderationNote: "Corrected attribution reviewed.",
        personReferentId: "referent-lewis",
        suppressed: true,
      }),
    );
    expect(container.textContent).toContain("Updated moderation note.");
    expect(
      getLabelledElement("Public Figure Expert moderation history").textContent,
    ).toContain("Note updated");

    await click(getButton("Restore global visibility"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName:
          "contextExpertise:updatePersonGlobalExpertVisibilityModeration",
        personReferentId: "referent-lewis",
        suppressed: false,
      }),
    );
    expect(container.textContent).toContain("Restored global visibility.");
    expect(
      getLabelledElement("Public Figure Expert moderation history").textContent,
    ).toContain("Restored");
  });

  test("hides public figure Context Expert moderation from non-system admins", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/system-admin");

    await renderApp();

    expect(container.textContent).toContain("System Admin access required.");
    expect(container.textContent).not.toContain("Context Expertise Operations");
    expect(container.textContent).not.toContain("Public Figure Experts");
    expect(container.textContent).not.toContain("Organization Accounts");
  });

  test("lets system admins sign in without organization memberships", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");
    mockState.appAccess = {
      email: "sysadmin@example.com",
      organizations: [],
      status: "allowed",
      systemRole: "systemAdmin",
      userId: "systemAdminUser",
    };
    mockState.pinnedKnowledgePages = [];

    await renderApp();

    expect(container.textContent).toContain("Teaching and Ministry Queue");
    expect(container.textContent).not.toContain(
      "This account needs an active organization membership before continuing.",
    );
    expect(getLabelledLinkIn(getLabelledElement("User Views"), "System Admin")).toBeTruthy();
  });

  test("opens the user profile page from the avatar route", async () => {
    await renderApp();

    await click(getLabelledLinkIn(getLabelledElement("Account controls"), "Profile"));

    expect(window.location.pathname).toBe("/profile");
    expect(container.querySelector(".kb-profile-main")).toBeTruthy();
    expect(container.textContent).toContain("gelbaughcm@gmail.com");
    expect(container.textContent).toContain("Arche Classical Academy");
    expect(container.textContent).toContain("Admin");
    expect(container.textContent).toContain("4 memberships");
    expect(getLabelledElement("Profile Context Expertise").textContent).toContain(
      "No Context Expertise evidence yet.",
    );
    expect(container.textContent).not.toContain("Route scaffold");
  });

  test("renders profile Context Expertise from current user aggregate data", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/profile");
    mockState.profileContextExpertise = {
      profileUserId: "user",
      rows: [
        {
          aggregateId: "contextExpertiseAggregate:romans-holy-spirit",
          contextExpertiseMaturity: 84,
          contextExpertiseScore: 97,
          contextKey: "tags:holy-spirit,romans-8-28",
          contextTags: [
            {
              canonicalKey: "romans-8-28",
              href: "/scripture/romans-8-28",
              id: "romans-8-28",
              knowledgeType: "biblePassage",
              label: "Romans 8:28",
              passageString: "romans-8-28",
            },
            {
              canonicalKey: "holy-spirit",
              href: "/goto/holy-spirit",
              id: "holy-spirit",
              knowledgeType: "topic",
              label: "Holy Spirit",
            },
          ],
          evidenceCount: 5,
          feedbackCount: 2,
          latestEvidenceAt: Date.UTC(2026, 5, 3, 12),
          postCount: 3,
          visibilityKind: "public",
          visibilityTargetKey: "public",
        },
      ],
    };

    await renderApp();

    const contextExpertise = getLabelledElement("Profile Context Expertise");
    expect(contextExpertise.textContent).toContain("Romans 8:28, Holy Spirit");
    expect(contextExpertise.textContent).toContain("2 Tags Knowledge Context");
    expect(contextExpertise.textContent).toContain("3 posts");
    expect(contextExpertise.textContent).toContain("2 signals");
    expect(contextExpertise.textContent).toContain("High maturity");
    expect(contextExpertise.textContent).toContain("Jun 3");
    expect(
      getLinkContainingIn(contextExpertise, "Romans 8:28").getAttribute("href"),
    ).toBe("/explore?tagIds=holy-spirit,romans-8-28");
  });

  test("renders profile Context Expertise loading state", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/profile");
    mockState.profileContextExpertise = undefined;

    await renderApp();

    expect(getLabelledElement("Profile Context Expertise").textContent).toContain(
      "Loading Context Expertise.",
    );
  });

  test("renders profile Bookmarks from durable bookmark data", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/profile?section=bookmarks",
    );
    mockState.bookmarkedKnowledgePages = [
      {
        createdAt: 1,
        href: "/organizations/organizationReferent",
        id: "organizationReferent",
        label: "Arche Classical Academy",
        organizationKind: "school",
        organizationName: "Arche Classical Academy",
        organizationReferentId: "organizationReferent",
        pageKey: "organization:organizationReferent",
        secondaryLabel: "School",
        updatedAt: 2,
      },
    ];

    await renderApp();

    const bookmarks = getLabelledElement("Profile Bookmarks");
    const bookmarkLink = getLinkContainingIn(bookmarks, "Arche Classical Academy");
    expect(bookmarkLink.getAttribute("href")).toBe(
      "/organizations/organizationReferent",
    );
    expect(bookmarks.textContent).toContain("School Knowledge Page");

    await click(getButtonIn(bookmarks, "Remove bookmark Arche Classical Academy"));
    await rerenderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "bookmarkedKnowledgePages:removeBookmark",
        pageKey: "organization:organizationReferent",
      }),
    );
    expect(getLabelledElement("Profile Bookmarks").textContent).toContain(
      "No bookmarked Knowledge Pages yet.",
    );
  });

  test("renders the resolved shell navigation grammar", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const knowledgePageDestinations = getLabelledElement("Knowledge Page destinations");
    const destinationLinks = Array.from(
      knowledgePageDestinations.querySelectorAll("a"),
    );

    expect(destinationLinks[0].getAttribute("aria-label")).toBe("Dashboard");
    expect(knowledgePageDestinations.textContent).toContain(
      "All Accessible Knowledge",
    );
    expect(getLabelledLinkIn(knowledgePageDestinations, "Arche Classical Academy")).toBeTruthy();
    expect(getLabelledLinkIn(knowledgePageDestinations, "Ruler of Kings Church")).toBeTruthy();
    expect(getLabelledLinkIn(knowledgePageDestinations, "My Family")).toBeTruthy();
    expect(knowledgePageDestinations.textContent).not.toContain("Explore Context");
    expect(knowledgePageDestinations.textContent).toContain("+1");

    const userViews = getLabelledElement("User Views");
    expect(
      Array.from(userViews.querySelectorAll("a")).map((link) =>
        link.getAttribute("aria-label"),
      ),
    ).toEqual([
      "TODO List",
      "Calendar",
      "Notifications",
    ]);
    expect(userViews.textContent).not.toContain("Settings");
    expect(getLabelledElement("Unread notifications").textContent).toBe("3");

    const accountControls = getLabelledElement("Account controls");
    expect(getLabelledLinkIn(accountControls, "Profile").getAttribute("href")).toBe(
      "/profile",
    );
    expect(getLabelledLinkIn(accountControls, "Bookmarks").getAttribute("href")).toBe(
      "/profile?section=bookmarks",
    );
    expect(getLabelledLinkIn(accountControls, "Settings").getAttribute("href")).toBe(
      "/settings",
    );
    expect(getButtonIn(accountControls, "Switch to dark theme")).toBeTruthy();
    expect(getButtonIn(accountControls, "Sign out")).toBeTruthy();
  });

  test("moves pinned Knowledge Pages into the primary sidebar away from Dashboard", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/scripture/joshua-1-6-9",
    );

    await renderApp();

    expect(container.querySelector(".kb-knowledge-drawer")).toBeNull();
    expect(container.querySelector('[aria-label="Knowledge Page destinations"]')).toBeNull();

    const primaryNavigation = getLabelledElement("Primary navigation");
    const pinnedPages = getLabelledElement("Pinned Knowledge Pages");
    expect(primaryNavigation.contains(pinnedPages)).toBe(true);
    expect(getLabelledLinkIn(pinnedPages, "Arche Classical Academy")).toBeTruthy();
    expect(getLabelledLinkIn(pinnedPages, "Ruler of Kings Church")).toBeTruthy();
    expect(getLabelledLinkIn(pinnedPages, "My Family")).toBeTruthy();
    expect(getButtonIn(pinnedPages, "1 more pinned Knowledge Pages")).toBeTruthy();
  });

  test("opens hidden pinned Knowledge Pages from the dashboard drawer overflow", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const knowledgePageDestinations = getLabelledElement("Knowledge Page destinations");
    await click(getButtonIn(knowledgePageDestinations, "1 more pinned Knowledge Pages"));

    const dialog = getDialog();
    expect(dialog.textContent).toContain("Hidden Pinned Knowledge Pages");
    expect(getLabelledLinkIn(dialog, "My Community")).toBeTruthy();

    await click(getLabelledLinkIn(dialog, "My Community"));

    expect(window.location.pathname).toBe("/organizations/communityOrganizationReferent");
  });

  test("opens hidden pinned Knowledge Pages from the compact rail overflow", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/scripture/joshua-1-6-9",
    );

    await renderApp();

    const pinnedPages = getLabelledElement("Pinned Knowledge Pages");
    await click(getButtonIn(pinnedPages, "1 more pinned Knowledge Pages"));

    const dialog = getDialog();
    expect(dialog.textContent).toContain("Hidden Pinned Knowledge Pages");
    expect(getLabelledLinkIn(dialog, "My Community")).toBeTruthy();

    await click(getLabelledLinkIn(dialog, "My Community"));

    expect(window.location.pathname).toBe("/organizations/communityOrganizationReferent");
  });

  test("toggles a durable Organization pin from the Organization page", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/organizations/organizationReferent",
    );

    await renderApp();

    expect(getButton("Unpin Arche Classical Academy").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      getLabelledLinkIn(getLabelledElement("Pinned Knowledge Pages"), "Arche Classical Academy"),
    ).toBeTruthy();

    await click(getButton("Unpin Arche Classical Academy"));
    await rerenderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "pinnedKnowledgePages:unpinKnowledgePage",
        pageKey: "organization:organizationReferent",
      }),
    );
    expect(getButton("Pin Arche Classical Academy").getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(
      getLabelledElement("Pinned Knowledge Pages").querySelector(
        'a[aria-label="Arche Classical Academy"]',
      ),
    ).toBeNull();

    await click(getButton("Pin Arche Classical Academy"));
    await rerenderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "pinnedKnowledgePages:pinOrganizationPage",
        organizationReferentId: "organizationReferent",
      }),
    );
    expect(getButton("Unpin Arche Classical Academy").getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(
      getLabelledLinkIn(getLabelledElement("Pinned Knowledge Pages"), "Arche Classical Academy"),
    ).toBeTruthy();
  });

  test("toggles an Organization bookmark without changing sidebar pins", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/organizations/organizationReferent",
    );
    mockState.bookmarkedKnowledgePages = [
      {
        createdAt: 1,
        href: "/organizations/organizationReferent",
        id: "organizationReferent",
        label: "Arche Classical Academy",
        organizationKind: "school",
        organizationName: "Arche Classical Academy",
        organizationReferentId: "organizationReferent",
        pageKey: "organization:organizationReferent",
        secondaryLabel: "School",
        updatedAt: 2,
      },
    ];

    await renderApp();

    expect(
      getButton("Remove Bookmark Arche Classical Academy").getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(
      getLabelledLinkIn(getLabelledElement("Pinned Knowledge Pages"), "Arche Classical Academy"),
    ).toBeTruthy();

    await click(getButton("Remove Bookmark Arche Classical Academy"));
    await rerenderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "bookmarkedKnowledgePages:removeBookmark",
        pageKey: "organization:organizationReferent",
      }),
    );
    expect(
      getButton("Bookmark Arche Classical Academy").getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      getLabelledLinkIn(getLabelledElement("Pinned Knowledge Pages"), "Arche Classical Academy"),
    ).toBeTruthy();

    await click(getButton("Bookmark Arche Classical Academy"));
    await rerenderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "bookmarkedKnowledgePages:bookmarkOrganizationPage",
        organizationReferentId: "organizationReferent",
      }),
    );
    expect(
      getButton("Remove Bookmark Arche Classical Academy").getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
  });

  test("toggles an Organization subscription without changing pins or bookmarks", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/organizations/organizationReferent",
    );
    mockState.knowledgeSubscriptions = [
      {
        createdAt: 1,
        href: "/organizations/organizationReferent",
        id: "organizationReferent",
        label: "Arche Classical Academy",
        organizationKind: "school",
        organizationName: "Arche Classical Academy",
        organizationReferentId: "organizationReferent",
        secondaryLabel: "School",
        subscriptionKey: "organization:organizationReferent",
        targetKind: "organization",
        targetReferentId: "organizationReferent",
        updatedAt: 2,
      },
    ];

    await renderApp();

    expect(
      getButton("Unsubscribe Arche Classical Academy").getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(
      getLabelledLinkIn(getLabelledElement("Pinned Knowledge Pages"), "Arche Classical Academy"),
    ).toBeTruthy();
    expect(mockState.bookmarkedKnowledgePages).toEqual([]);

    await click(getButton("Unsubscribe Arche Classical Academy"));
    await rerenderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "knowledgeSubscriptions:unsubscribe",
        subscriptionKey: "organization:organizationReferent",
      }),
    );
    expect(
      getButton("Subscribe Arche Classical Academy").getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      getLabelledLinkIn(getLabelledElement("Pinned Knowledge Pages"), "Arche Classical Academy"),
    ).toBeTruthy();
    expect(mockState.bookmarkedKnowledgePages).toEqual([]);

    await click(getButton("Subscribe Arche Classical Academy"));
    await rerenderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "knowledgeSubscriptions:subscribeOrganizationPage",
        organizationReferentId: "organizationReferent",
      }),
    );
    expect(
      getButton("Unsubscribe Arche Classical Academy").getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(mockState.bookmarkedKnowledgePages).toEqual([]);
  });

  test("bookmarked pages do not appear in Knowledge Page destinations unless pinned", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");
    mockState.pinnedKnowledgePages = [];
    mockState.bookmarkedKnowledgePages = [
      {
        createdAt: 1,
        href: "/organizations/organizationReferent",
        id: "organizationReferent",
        label: "Arche Classical Academy",
        organizationKind: "school",
        organizationName: "Arche Classical Academy",
        organizationReferentId: "organizationReferent",
        pageKey: "organization:organizationReferent",
        secondaryLabel: "School",
        updatedAt: 2,
      },
    ];

    await renderApp();

    expect(
      getLabelledElement("Knowledge Page destinations").textContent,
    ).not.toContain("Arche Classical Academy");
  });

  test("switches Active Role without navigating or following organization pages", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const roleSwitcher = getSelect("Active Role");
    expect(roleSwitcher.value).toBe("organizationReferent:admin");

    await setSelectValue(roleSwitcher, "churchOrganizationReferent:admin");

    expect(window.location.pathname + window.location.search).toBe("/");
    expect(roleSwitcher.value).toBe("churchOrganizationReferent:admin");

    await click(
      getLabelledLinkIn(
        getLabelledElement("Knowledge Page destinations"),
        "Arche Classical Academy",
      ),
    );

    expect(window.location.pathname).toBe("/organizations/organizationReferent");
    expect(getSelect("Active Role").value).toBe("churchOrganizationReferent:admin");
  });

  test("labels the topbar search as Search Everything", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const topbar = container.querySelector(".kb-topbar");
    expect(topbar).toBeTruthy();
    expect(topbar?.textContent).toContain("Search Everything");
    expect(topbar?.textContent).not.toContain("Global Search");
    expect(getRootSearchInput().getAttribute("placeholder")).toBe(
      "Search everything you can access",
    );
  });

  test("selecting a non-Bible Root Search Tag opens exactly that Referent Page", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/explore?tagIds=first-crusade,matthew-5-9",
    );

    await renderApp();

    const rootSearchInput = getRootSearchInput();
    await act(async () => {
      rootSearchInput.focus();
      await Promise.resolve();
    });
    await setFieldValue(rootSearchInput, "City of God");

    const suggestions = getLabelledElement("Root Search suggestions");
    const bookSuggestion = getLinkContainingIn(suggestions, "The City of God");
    expect(bookSuggestion.getAttribute("href")).toBe("/goto/the-city-of-god");
    expect(bookSuggestion.textContent).toContain("Book");

    await click(bookSuggestion);

    expect(window.location.pathname + window.location.search).toBe(
      "/goto/the-city-of-god",
    );
    expect(mockState.mutationCalls).not.toContainEqual(
      expect.objectContaining({
        functionName: "analytics:recordSearchEvent",
      }),
    );
    expect(rootSearchInput.value).toBe("");
    expect(rootSearchInput.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelector(".kb-search-suggestions")?.getAttribute("data-presence"),
    ).toBe("exit");
    expect(getButton("Remove The City of God")).toBeTruthy();
    expect(queryButton("Remove First Crusade")).toBeNull();
    expect(queryButton("Remove Matthew 5:9")).toBeNull();
  });

  test("Root Search keeps local Tag suggestions when live suggestions are empty", async () => {
    const originalTagSuggestions = mockState.tagSuggestions;
    mockState.tagSuggestions = [];

    try {
      window.history.replaceState({}, "", "http://localhost:3000/");

      await renderApp();

      const rootSearchInput = getRootSearchInput();
      await act(async () => {
        rootSearchInput.focus();
        await Promise.resolve();
      });
      await setFieldValue(rootSearchInput, "City of God");

      const suggestions = getLabelledElement("Root Search suggestions");
      const bookSuggestion = getLinkContainingIn(suggestions, "The City of God");
      expect(bookSuggestion.getAttribute("href")).toBe("/goto/the-city-of-god");
      expect(bookSuggestion.textContent).toContain("Book");
    } finally {
      mockState.tagSuggestions = originalTagSuggestions;
    }
  });

  test("selecting a Bible Passage Root Search Tag opens Scripture", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const rootSearchInput = getRootSearchInput();
    await act(async () => {
      rootSearchInput.focus();
      await Promise.resolve();
    });
    await setFieldValue(rootSearchInput, "Matthew 5 9");

    const suggestions = getLabelledElement("Root Search suggestions");
    const scriptureSuggestion = getLinkContainingIn(suggestions, "Matthew 5:9");
    expect(scriptureSuggestion.getAttribute("href")).toBe(
      "/scripture/matthew-5-9",
    );
    expect(scriptureSuggestion.textContent).toContain("Bible Passage");

    await click(scriptureSuggestion);

    expect(window.location.pathname + window.location.search).toBe(
      "/scripture/matthew-5-9",
    );
  });

  test("Root Search Enter without suggestions opens root search without creating a Tag", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/explore?tagIds=first-crusade,matthew-5-9",
    );

    await renderApp();

    const rootSearchInput = getRootSearchInput();
    await act(async () => {
      rootSearchInput.focus();
      await Promise.resolve();
    });
    await setFieldValue(rootSearchInput, "unmatched free text");
    await keyDown(rootSearchInput, "Enter");

    expect(window.location.pathname + window.location.search).toBe(
      "/search?q=unmatched+free+text",
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "analytics:recordSearchEvent",
        searchScope: "root",
        searchText: "unmatched free text",
      }),
    );
    expect(queryButton("Remove First Crusade")).toBeNull();
    expect(queryButton("Remove Matthew 5:9")).toBeNull();
    expect(queryButton("Remove Unmatched Free Text")).toBeNull();
  });

  test("Root Search free text opens root search results from the dashboard", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const rootSearchInput = getRootSearchInput();
    await act(async () => {
      rootSearchInput.focus();
      await Promise.resolve();
    });
    await setFieldValue(rootSearchInput, "disordered loves");
    await keyDown(rootSearchInput, "Enter");

    expect(window.location.pathname + window.location.search).toBe(
      "/search?q=disordered+loves",
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "analytics:recordSearchEvent",
        searchScope: "root",
        searchText: "disordered loves",
      }),
    );
    expect(rootSearchInput.value).toBe("");
    expect(container.querySelector(".kb-today-agenda")).toBeNull();
    expect(container.querySelector(".kb-knowledge-navigator")).toBeTruthy();
    expect(container.querySelector(".kb-answer-feed")).toBeNull();
    const results = container.querySelector(".kb-root-search-results");
    expect(results).toBeTruthy();
    expect(container.textContent).toContain(
      'Searching everything for "disordered loves"',
    );
    expect(container.textContent).toContain(
      "Augustine, Ordered Loves, and the First Crusade",
    );
    expect(container.textContent).toContain("Referent Page");
    expect(container.textContent).toContain("Grade 9 Church History");
    expect(container.textContent).not.toContain("Answer Micah's Crusades question");
    expect(queryButton("Remove First Crusade")).toBeNull();
    expect(queryButton("Remove Matthew 5:9")).toBeNull();

    if (!results) {
      throw new Error("Expected Root Search results");
    }
    const preview = getLabelledLinkIn(
      results,
      "Open Grade 9 Church History from matched preview Augustine, Ordered Loves, and the First Crusade",
    );
    expect(preview.getAttribute("href")).toBe("/goto/grade-9-church-history");
    await click(preview);
    expect(window.location.pathname + window.location.search).toBe(
      "/goto/grade-9-church-history",
    );
    expect(getButton("Remove Grade 9 Church History")).toBeTruthy();
  });

  test("Root Search free text replaces an active context with root search results", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/explore?tagIds=first-crusade,matthew-5-9",
    );

    await renderApp();

    const rootSearchInput = getRootSearchInput();
    await act(async () => {
      rootSearchInput.focus();
      await Promise.resolve();
    });
    await setFieldValue(rootSearchInput, "earthly city");
    await keyDown(rootSearchInput, "Enter");

    expect(window.location.pathname + window.location.search).toBe(
      "/search?q=earthly+city",
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "analytics:recordSearchEvent",
        searchScope: "root",
        searchText: "earthly city",
      }),
    );
    expect(container.querySelector(".kb-today-agenda")).toBeNull();
    expect(container.querySelector(".kb-answer-feed")).toBeNull();
    const results = container.querySelector(".kb-root-search-results");
    expect(results).toBeTruthy();
    expect(queryButton("Remove First Crusade")).toBeNull();
    expect(queryButton("Remove Matthew 5:9")).toBeNull();
    expect(container.textContent).toContain(
      'Searching everything for "earthly city"',
    );
    expect(container.textContent).toContain(
      "Augustine, Ordered Loves, and the First Crusade",
    );

    if (!results) {
      throw new Error("Expected Root Search results");
    }
    const resultTitle = getLinkContainingIn(results, "Grade 9 Church History");
    expect(resultTitle.getAttribute("href")).toBe("/goto/grade-9-church-history");
    await click(resultTitle);
    expect(window.location.pathname + window.location.search).toBe(
      "/goto/grade-9-church-history",
    );
    expect(getButton("Remove Grade 9 Church History")).toBeTruthy();
  });

  test("direct root search route renders search mode and clears back to dashboard", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/search?q=peace",
    );

    await renderApp();

    expect(container.querySelector(".kb-today-agenda")).toBeNull();
    expect(container.querySelector(".kb-knowledge-navigator")).toBeTruthy();
    expect(container.querySelector(".kb-answer-feed")).toBeNull();
    expect(container.querySelector(".kb-root-search-results")).toBeTruthy();
    expect(container.textContent).toContain('Searching everything for "peace"');
    expect(container.textContent).toContain(
      "Augustine, Ordered Loves, and the First Crusade",
    );
    expect(queryButton("Remove First Crusade")).toBeNull();
    expect(queryButton("Remove Matthew 5:9")).toBeNull();

    await click(getButton("Clear root search"));

    expect(window.location.pathname + window.location.search).toBe("/");
    expect(container.textContent).not.toContain(
      'Searching everything for "peace"',
    );
    expect(container.querySelector(".kb-today-agenda")).toBeTruthy();
  });

  test("direct root search route renders Tag-only results", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/search?q=Robinson+Crusoe",
    );

    await renderApp();

    const results = container.querySelector(".kb-root-search-results");
    expect(results).toBeTruthy();
    expect(container.textContent).toContain(
      'Searching everything for "Robinson Crusoe"',
    );
    expect(container.textContent).toContain("Robinson Crusoe");
    expect(container.textContent).toContain("Book");
    expect(container.textContent).not.toContain("matched preview");

    if (!results) {
      throw new Error("Expected Root Search results");
    }
    const resultTitle = getLinkContainingIn(results, "Robinson Crusoe");
    expect(resultTitle.getAttribute("href")).toBe("/goto/robinson-crusoe");
    await click(resultTitle);
    expect(window.location.pathname + window.location.search).toBe(
      "/goto/robinson-crusoe",
    );
    expect(getButton("Remove Robinson Crusoe")).toBeTruthy();
  });

  test("Root Search keyboard selection navigates to the active suggestion", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const rootSearchInput = getRootSearchInput();
    await act(async () => {
      rootSearchInput.focus();
      await Promise.resolve();
    });
    await setFieldValue(rootSearchInput, "grade");
    await keyDown(rootSearchInput, "ArrowDown");
    await keyDown(rootSearchInput, "Enter");

    expect(window.location.pathname + window.location.search).toBe(
      "/goto/grade-10-medieval-literature",
    );
    expect(getButton("Remove Grade 10 Medieval Literature")).toBeTruthy();
    expect(queryButton("Remove Grade 9 Church History")).toBeNull();
  });

  test("shows the Knowledge Navigator on Knowledge Pages but not User Views", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/organizations/ruler-of-kings-church",
    );

    await renderApp();

    expect(container.querySelector(".kb-organization-main")).toBeTruthy();
    expect(container.querySelector(".kb-knowledge-navigator")).toBeTruthy();

    await click(getLabelledLinkIn(getLabelledElement("User Views"), "Notifications"));

    expect(window.location.pathname).toBe("/notifications");
    expect(container.querySelector(".kb-notifications-main")).toBeTruthy();
    expect(container.querySelector(".kb-knowledge-navigator")).toBeNull();
  });

  test("renders typed organization pages for church, school, family, and community", async () => {
    const typedPages = [
      {
        expectedDetail: "Sermon Work",
        expectedHeading: "My Church",
        path: "/organizations/my-church",
      },
      {
        expectedDetail: "Lesson Builder",
        expectedHeading: "My School",
        path: "/organizations/my-school",
      },
      {
        expectedDetail: "Prayer Notes",
        expectedHeading: "My Family",
        path: "/organizations/my-family",
      },
      {
        expectedDetail: "Projects",
        expectedHeading: "My Community",
        path: "/organizations/my-community",
      },
    ];

    for (const typedPage of typedPages) {
      window.history.replaceState({}, "", `http://localhost:3000${typedPage.path}`);
      await renderApp();

      expect(container.querySelector(".kb-organization-main")).toBeTruthy();
      expect(container.textContent).toContain(typedPage.expectedHeading);
      expect(container.textContent).toContain(typedPage.expectedDetail);
      expect(getLinkIn(container, "Settings").getAttribute("href")).toBe(
        `${typedPage.path}/settings`,
      );

      if (root) {
        await act(async () => {
          root?.unmount();
        });
        root = null;
      }
      container.innerHTML = "";
    }
  });

  test("renders the school-day dashboard agenda", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const identityBand = container.querySelector(".kb-knowledge-page-identity");
    expect(identityBand).toBeTruthy();
    expect(identityBand?.textContent).toContain("Dashboard");
    expect(identityBand?.textContent).toContain("All Accessible Knowledge");
    expect(identityBand?.textContent).toContain(
      "Accessible Root Knowledge Context",
    );
    expect(container.querySelector(".kb-rail-focus-heading")).toBeNull();
    expect(container.querySelector(".kb-knowledge-navigator > header")).toBeNull();
    expect(
      container.querySelector(".kb-answer-feed-header h2")?.closest(".kb-sr-only"),
    ).toBeTruthy();
    const rail = getLabelledElement("Knowledge context and search");
    expect(rail.querySelector(".kb-knowledge-navigator")).toBeTruthy();
    expect(rail.querySelector(".kb-request-composer")).toBeTruthy();
    expect(rail.textContent).toContain("Knowledge Navigator Query Input");
    expect(rail.textContent).not.toContain("Knowledge Composer");
    expect(rail.textContent).not.toContain("Knowledge Request");
    expect(rail.querySelector("textarea")?.getAttribute("placeholder")).toBe(
      "Search or add tag",
    );
    expect(rail.querySelector(".kb-slot-card")).toBeNull();
    expect(rail.querySelector(".kb-placeholder-block")).toBeNull();
    expect(rail.textContent).not.toContain(
      "No requested entries in this Knowledge Context",
    );
    expect(container.querySelector(".kb-today-agenda")).toBeTruthy();
    expect(container.textContent).not.toContain("Today at Arche Classical Academy");
    expect(container.textContent).toContain("Friday, June 12, 2026");
    expect(container.textContent).toContain("Answer Micah's Crusades question");
    expect(container.textContent).toContain("Teach Boethius on providence");
    expect(container.textContent).toContain("Review founding celebration event");

    const queryInput = rail.querySelector("textarea");
    if (!(queryInput instanceof HTMLTextAreaElement)) {
      throw new Error("Expected Knowledge Navigator Query Input textarea");
    }

    await act(async () => {
      queryInput.focus();
      await Promise.resolve();
    });
    await changeTextareaValue(queryInput, "Micah");
    const questionSuggestion = rail.querySelector<HTMLButtonElement>(
      '[data-suggestion-id="student-crusades-question"]',
    );
    if (!questionSuggestion) {
      throw new Error("Expected existing Question Tag suggestion");
    }
    await click(questionSuggestion);

    expect(window.location.pathname + window.location.search).toBe(
      "/goto/student-crusades-question",
    );
    expect(mockState.mutationCalls).not.toContainEqual(
      expect.objectContaining({
        functionName: "analytics:recordSearchEvent",
      }),
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        activeTagKeys: ["student-crusades-question"],
        usageKind: "select",
      }),
    );
  });

  test("Knowledge Navigator Query Input search records active-context analytics", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/explore?tagIds=first-crusade,matthew-5-9",
    );

    await renderApp();

    const rail = getLabelledElement("Knowledge context and search");
    const queryInput = rail.querySelector("textarea");
    if (!(queryInput instanceof HTMLTextAreaElement)) {
      throw new Error("Expected Knowledge Navigator Query Input textarea");
    }

    await act(async () => {
      queryInput.focus();
      await Promise.resolve();
    });
    await changeTextareaValue(queryInput, "covenantal astronomy");
    await keyDown(queryInput, "Enter");

    expect(window.location.pathname + window.location.search).toBe(
      "/explore?tagIds=first-crusade,matthew-5-9",
    );
    expect(container.textContent).toContain(
      'Searching this context for "covenantal astronomy"',
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        activeTagKeys: ["first-crusade", "matthew-5-9"],
        functionName: "analytics:recordSearchEvent",
        searchScope: "activeKnowledgeContext",
        searchText: "covenantal astronomy",
      }),
    );
  });

  test("hides the topbar on downward scroll and restores it on upward scroll", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const hostColumn = container.querySelector(".kb-host-column");
    const hostContent = container.querySelector(".kb-host-content");
    if (!(hostColumn instanceof HTMLElement) || !(hostContent instanceof HTMLElement)) {
      throw new Error("Missing authenticated app shell");
    }
    setTopbarScrollMetrics(hostColumn, hostContent, {
      clientHeight: 500,
      scrollHeight: 1200,
      topbarHeight: 84,
    });

    expect(hostColumn.getAttribute("data-topbar-hidden")).toBeNull();

    await scrollHostContent(hostContent, 120);

    expect(hostColumn.getAttribute("data-topbar-hidden")).toBe("true");

    await scrollHostContent(hostContent, 72);

    expect(hostColumn.getAttribute("data-topbar-hidden")).toBeNull();
  });

  test("keeps the topbar visible when hiding it would clamp the scroll position", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");

    await renderApp();

    const hostColumn = container.querySelector(".kb-host-column");
    const hostContent = container.querySelector(".kb-host-content");
    if (!(hostColumn instanceof HTMLElement) || !(hostContent instanceof HTMLElement)) {
      throw new Error("Missing authenticated app shell");
    }
    setTopbarScrollMetrics(hostColumn, hostContent, {
      clientHeight: 500,
      scrollHeight: 620,
      topbarHeight: 84,
    });

    await scrollHostContent(hostContent, 120);

    expect(hostColumn.getAttribute("data-topbar-hidden")).toBeNull();
  });

  test("renders the calendar route with month and agenda content", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/calendar");

    await renderApp();

    expect(container.querySelector(".kb-calendar-grid")).toBeTruthy();
    expect(container.textContent).toContain("June 2026");
    expect(container.textContent).toContain("Grade 10 Medieval Literature");
    expect(container.textContent).toContain("Pride Leads to Death");
    expect(container.textContent).toContain("250th Celebration of America's Founding");
    expect(
      container.querySelector('[aria-current="page"][aria-label="Calendar"]'),
    ).toBeTruthy();
  });

  test("renders the TODO List route with only assigned Knowledge Slots", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/todo");

    await renderApp();

    expect(container.querySelector(".kb-todo-main")).toBeTruthy();
    expect(container.textContent).toContain("TODO List");
    expect(container.textContent).toContain("Draft chapel follow-up");
    expect(container.textContent).toContain("Prepare Boethius providence lesson");
    expect(container.textContent).toContain("2 slots");
    expect(container.textContent).not.toContain(
      "Augustine, Ordered Loves, and the First Crusade",
    );
    expect(container.textContent).not.toContain("Answer Micah's Crusades question");
    expect(
      container.querySelector('[aria-current="page"][aria-label="TODO List"]'),
    ).toBeTruthy();
    expect(getFeedItems("answer")).toHaveLength(0);
  });

  test("renders the typed overview on referent pages", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/goto/first-crusade");

    await renderApp();

    const identityBand = container.querySelector(".kb-knowledge-page-identity");
    expect(identityBand).toBeTruthy();
    expect(identityBand?.textContent).toContain("Referent Page");
    expect(identityBand?.textContent).toContain("First Crusade");
    expect(identityBand?.textContent).toContain("Topic");
    expect(container.querySelector(".kb-rail-focus-heading")).toBeNull();
    const rail = getLabelledElement("Knowledge context and search");
    expect(rail.querySelector(".kb-knowledge-navigator")).toBeTruthy();
    expect(rail.querySelector(".kb-request-composer")).toBeTruthy();
    expect(rail.textContent).toContain("First Crusade");
    expect(getButton("Add The City of God")).toBeTruthy();
    expect(rail.querySelector(".kb-slot-card")).toBeNull();
    expect(rail.querySelector(".kb-placeholder-block")).toBeNull();
    expect(rail.textContent).not.toContain(
      "No requested entries in this Knowledge Context",
    );

    const overview = container.querySelector(".kb-knowledge-overview");
    expect(overview).toBeTruthy();
    expect(overview?.getAttribute("data-knowledge-type")).toBe("topic");
    expect(overview?.textContent).toContain("Topic Overview");
    expect(overview?.textContent).toContain("Base Words Layer");
    expect(overview?.textContent).toContain("First Crusade");
    expect(overview?.textContent).toContain("Doctrine, theme, or subject.");
  });

  test("renders live route-resolved Knowledge Type overviews for seeded Book pages", async () => {
    mockState.tagSuggestions = [
      ...mockState.tagSuggestions,
      {
        canonicalKey: "the-wind-in-the-willows-kenneth-grahame",
        href: "/goto/the-wind-in-the-willows-kenneth-grahame",
        id: "the-wind-in-the-willows-kenneth-grahame",
        knowledgeType: "book",
        label: "The Wind In The Willows Kenneth Grahame",
        tag: {
          canonicalKey: "the-wind-in-the-willows-kenneth-grahame",
          href: "/goto/the-wind-in-the-willows-kenneth-grahame",
          id: "the-wind-in-the-willows-kenneth-grahame",
          knowledgeType: "book",
          label: "The Wind In The Willows Kenneth Grahame",
        },
      },
    ];
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/goto/the-wind-in-the-willows-kenneth-grahame",
    );

    await renderApp();

    const identityBand = container.querySelector(".kb-knowledge-page-identity");
    expect(identityBand?.textContent).toContain("Book");

    const overview = container.querySelector(".kb-knowledge-overview");
    expect(overview).toBeTruthy();
    expect(overview?.getAttribute("data-knowledge-type")).toBe("book");
    expect(overview?.textContent).toContain("Book Overview");
    expect(overview?.textContent).toContain("Book Detail");
    expect(overview?.textContent).not.toContain("Words Overview");
  });

  test("keeps Scripture Text without the generic Bible Passage overview", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/scripture/matthew-5-9",
    );

    await renderApp();

    const scripturePanel = container.querySelector(".kb-scripture-panel");
    expect(scripturePanel).toBeTruthy();
    expect(scripturePanel?.textContent).toContain("Scripture Text");
    expect(scripturePanel?.textContent).toContain("King James Version");
    expect(container.querySelector(".kb-knowledge-overview")).toBeNull();
    expect(container.textContent).not.toContain("Bible Passage Overview");
    expect(container.textContent).not.toContain("Referent Overview");
  });

  test("renders compact identity for multi-Tag Context Pages", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/explore?tagIds=first-crusade,matthew-5-9",
    );

    await renderApp();

    const identityBand = container.querySelector(".kb-knowledge-page-identity");
    expect(identityBand).toBeTruthy();
    expect(identityBand?.textContent).toContain("Context Page");
    expect(identityBand?.textContent).toContain("First Crusade");
    expect(identityBand?.textContent).toContain("Matthew 5:9");
    expect(identityBand?.textContent).toContain("2 Tags");
    expect(container.querySelector(".kb-rail-focus-heading")).toBeNull();
    const rail = getLabelledElement("Knowledge context and search");
    expect(rail.querySelector(".kb-knowledge-navigator")).toBeTruthy();
    expect(rail.querySelector(".kb-request-composer")).toBeTruthy();
    expect(rail.textContent).toContain("First Crusade");
    expect(rail.textContent).toContain("Matthew 5:9");
    expect(rail.querySelector(".kb-slot-card")).toBeNull();
    expect(rail.querySelector(".kb-placeholder-block")).toBeNull();
    expect(rail.textContent).not.toContain(
      "No requested entries in this Knowledge Context",
    );
    expect(
      getFeedItems("slot").some((item) =>
        item.textContent?.includes("Answer Micah's Crusades question"),
      ),
    ).toBe(true);
  });

  test("renders the analytics route with visit and navigator summaries", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/analytics");

    await renderApp();

    expect(container.querySelector(".kb-analytics-main")).toBeTruthy();
    expect(container.textContent).toContain("Popular targets");
    expect(container.textContent).toContain("Romans 8:28");
    expect(container.textContent).toContain("Navigator Actions");
    expect(container.querySelector('[aria-label="Knowledge Page destinations"]')).toBeNull();
    expect(container.querySelector('a[aria-label="Analytics"]')).toBeNull();
  });

  test("blocks the Smart Storage playground from non-system admins", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/playground/smart-storage",
    );

    await renderApp();

    expect(container.querySelector(".kb-smart-playground-main")).toBeNull();
    expect(container.textContent).toContain("Unavailable");
    expect(getLabelledElement("User Views").textContent).not.toContain(
      "Smart Storage",
    );
  });

  test("renders the Smart Storage playground for system admins with predictions and feedback capture", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/playground/smart-storage",
    );
    mockState.appAccess = {
      ...(mockState.appAccess as Record<string, unknown>),
      systemRole: "systemAdmin",
    };

    await renderApp();

    expect(container.querySelector(".kb-smart-playground-main")).toBeTruthy();
    expect(container.querySelector('[aria-label="Knowledge Page destinations"]')).toBeNull();
    expect(getLabelledLinkIn(getLabelledElement("User Views"), "Smart Storage")).toBeTruthy();

    const sourceInput = container.querySelector('textarea[aria-label="Raw input"]');
    if (!(sourceInput instanceof HTMLTextAreaElement)) {
      throw new Error("Missing Smart Storage source input");
    }

    await setFieldValue(
      sourceInput,
      [
        "Lesson: Courage in Joshua 1:6-9",
        "Objective: Students will distinguish courage from presumption.",
        "Materials: Bibles, board notes, discussion questions.",
      ].join("\n"),
    );

    expect(container.textContent).toContain("Predicted Knowledge Entries");
    expect(container.textContent).toContain("Lesson");
    expect(container.textContent).toContain("Joshua 1:6-9");

    const editor = getContributionEditor();
    expect(getTextInputIn(editor).value).toContain("Lesson: Courage");
    expect(getTextareaIn(editor).value).toContain("Objective: Students");
    await click(getButtonIn(editor, "Store"));

    await click(getButton("Close"));
    await click(getButton("Save Feedback"));

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        feedbackRating: "close",
        intendedKnowledgeType: "lesson",
        sourceKind: "pastedText",
      }),
    );
    expect(container.textContent).toContain("Feedback saved");
  });

  test("shows dev playground prototype routes only to system admins", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");
    mockState.appAccess = {
      ...(mockState.appAccess as Record<string, unknown>),
      systemRole: "systemAdmin",
    };

    await renderApp();

    const userViews = getLabelledElement("User Views");
    expect(getLabelledLinkIn(userViews, "Smart Storage")).toBeTruthy();
    expect(getLabelledLinkIn(userViews, "Layout Prototype")).toBeTruthy();
    expect(getLabelledLinkIn(userViews, "Header Sidebar Prototype")).toBeTruthy();
  });

  test("blocks prototype routes from non-system admins", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/playground/prototypes/layout?variant=T",
    );

    await renderApp();

    expect(container.querySelector(".layout-prototype")).toBeNull();
    expect(container.textContent).toContain("Unavailable");
    expect(getLabelledElement("User Views").textContent).not.toContain(
      "Layout Prototype",
    );
  });

  test("renders prototype routes for system admins and preserves legacy prototype URLs", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/playground/prototypes/layout?variant=T",
    );
    mockState.appAccess = {
      ...(mockState.appAccess as Record<string, unknown>),
      systemRole: "systemAdmin",
    };

    await renderApp();

    expect(container.querySelector(".layout-prototype")).toBeTruthy();
    expect(container.textContent).toContain("T - Questions sage, Answers clay");

    await act(async () => {
      root?.unmount();
    });
    root = null;
    container.innerHTML = "";
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/?prototype=header-sidebar&variant=D",
    );

    await renderApp();

    expect(container.querySelector(".hsp-shell")).toBeTruthy();
    expect(container.textContent).toContain("D - Knowledge shelf header");
  });

  test("renders the notifications route with filterable user notices", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/notifications");

    await renderApp();

    expect(container.querySelector(".kb-notifications-main")).toBeTruthy();
    expect(container.textContent).toContain("Notifications");
    expect(container.textContent).toContain("3 unread");
    expect(container.textContent).toContain("Micah's Crusades question is waiting");
    expect(getNotificationItems()).toHaveLength(4);
    expect(
      container.querySelector('[aria-current="page"][aria-label="Notifications"]'),
    ).toBeTruthy();

    await click(getButton("Mark Micah's Crusades question is waiting read"));
    await rerenderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "userNotifications:markRead",
        notificationId: "notice-slot-student-crusades-question",
      }),
    );
    expect(container.textContent).toContain("2 unread");
    expect(getLabelledElement("Unread notifications").textContent).toBe("2");

    await click(getButton("Unread"));

    expect(normalizeText(container.querySelector("#kb-notification-feed-heading"))).toBe(
      "Unread Notifications",
    );
    expect(getNotificationItems()).toHaveLength(2);
    expect(container.textContent).not.toContain(
      "Micah's Crusades question is waiting",
    );
    expect(container.textContent).not.toContain(
      "Trial by Fire received follow-up notes",
    );

    await click(getButton("Knowledge Slots"));

    expect(normalizeText(container.querySelector("#kb-notification-feed-heading"))).toBe(
      "Request Notifications",
    );
    expect(getNotificationItems()).toHaveLength(1);
    expect(container.textContent).toContain("Micah's Crusades question is waiting");

    await click(getButton("Events"));

    expect(normalizeText(container.querySelector("#kb-notification-feed-heading"))).toBe(
      "Event Notifications",
    );
    expect(getNotificationItems()).toHaveLength(2);
    expect(container.textContent).toContain("Pride Leads to Death is on Sunday's calendar");
  });

  test("renders access notifications under all and unread only", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/notifications");
    mockState.userNotifications = [
      {
        id: "notice-identity-review",
        title: "Identity review needed",
        body:
          "outside@example.com claimed headofschool@example.com for Arche Classical Academy.",
        contextLabel: "Arche Classical Academy",
        contextHref: "/organizations/arche-classical-academy/settings",
        kind: "access",
        receivedAt: Date.UTC(2026, 5, 12, 13),
        status: "unread",
      },
      {
        id: "notice-request",
        title: "Requested answer",
        body: "A Knowledge Slot needs an answer.",
        contextLabel: "First Crusade",
        contextHref: "/slots/requested-answer",
        kind: "knowledgeSlot",
        receivedAt: Date.UTC(2026, 5, 12, 12),
        status: "unread",
      },
      {
        id: "notice-event",
        title: "Lesson starts soon",
        body: "An Event is on your calendar.",
        contextLabel: "Grade 10",
        contextHref: "/events/lesson-starts-soon",
        kind: "event",
        receivedAt: Date.UTC(2026, 5, 12, 11),
        status: "unread",
      },
    ];

    await renderApp();

    expect(getNotificationItems()).toHaveLength(3);
    expect(container.textContent).toContain("Access");
    expect(container.textContent).toContain("Identity review needed");

    await click(getButton("Unread"));

    expect(getNotificationItems()).toHaveLength(3);
    expect(container.textContent).toContain("Identity review needed");

    await click(getButton("Knowledge Slots"));

    expect(getNotificationItems()).toHaveLength(1);
    expect(container.textContent).toContain("Requested answer");
    expect(container.textContent).not.toContain("Identity review needed");

    await click(getButton("Events"));

    expect(getNotificationItems()).toHaveLength(1);
    expect(container.textContent).toContain("Lesson starts soon");
    expect(container.textContent).not.toContain("Identity review needed");
  });

  test("renders durable subscription sources on Notifications with unsubscribe", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/notifications");
    mockState.knowledgeSubscriptions = [
      {
        createdAt: 1,
        href: "/organizations/organizationReferent",
        id: "organizationReferent",
        label: "Arche Classical Academy",
        organizationKind: "school",
        organizationName: "Arche Classical Academy",
        organizationReferentId: "organizationReferent",
        secondaryLabel: "School",
        subscriptionKey: "organization:organizationReferent",
        targetKind: "organization",
        targetReferentId: "organizationReferent",
        updatedAt: 2,
      },
    ];

    await renderApp();

    const subscriptionSources = getLabelledElement("Subscription Sources");
    const subscriptionLink = getLinkContainingIn(
      subscriptionSources,
      "Arche Classical Academy",
    );
    expect(subscriptionLink.getAttribute("href")).toBe(
      "/organizations/organizationReferent",
    );
    expect(subscriptionSources.textContent).toContain("School Knowledge Page");
    expect(getLabelledElement("Unread notifications").textContent).toBe("3");
    expect(getNotificationItems()).toHaveLength(4);

    await click(getButtonIn(subscriptionSources, "Unsubscribe from Arche Classical Academy"));
    await rerenderApp();

    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "knowledgeSubscriptions:unsubscribe",
        subscriptionKey: "organization:organizationReferent",
      }),
    );
    expect(getLabelledElement("Subscription Sources").textContent).toContain(
      "No active subscription sources.",
    );
    expect(getLabelledElement("Unread notifications").textContent).toBe("3");
  });

  async function renderApp() {
    root = createRoot(container);
    await act(async () => {
      root?.render(<App />);
    });
  }

  async function rerenderApp() {
    await act(async () => {
      root?.render(<App />);
      await Promise.resolve();
    });
  }

  function queryButton(label: string) {
    return (
      Array.from(container.querySelectorAll("button")).find(
        (button) =>
          button.getAttribute("aria-label") === label ||
          normalizeText(button) === label,
      ) ?? null
    );
  }

  function getButton(label: string) {
    const button = queryButton(label);
    if (!button) {
      throw new Error(`Missing button: ${label}`);
    }

    return button;
  }

  function getButtonIn(element: Element, label: string) {
    const button = Array.from(element.querySelectorAll("button")).find(
      (candidate) =>
        candidate.getAttribute("aria-label") === label ||
        normalizeText(candidate) === label,
    );
    if (!button) {
      throw new Error(`Missing scoped button: ${label}`);
    }

    return button;
  }

  function getFeedItems(kind: "answer" | "slot") {
    return Array.from(
      container.querySelectorAll(`.kb-answer-feed-list li[data-feed-kind="${kind}"]`),
    );
  }

  function getNotificationItems() {
    return Array.from(container.querySelectorAll(".kb-notification-list li"));
  }

  function getCardTitle(item: Element) {
    return normalizeText(item.querySelector("h3"));
  }

  function getHumanWeightText(item: Element) {
    return normalizeText(item.querySelector(".kb-human-weight-metric dd"));
  }

  function getLinkIn(element: Element, text: string) {
    const link = Array.from(element.querySelectorAll("a")).find(
      (candidate) => normalizeText(candidate) === text,
    );
    if (!link) {
      throw new Error(`Missing link: ${text}`);
    }

    return link;
  }

  function getLinkContainingIn(element: Element, text: string) {
    const link = Array.from(element.querySelectorAll("a")).find((candidate) =>
      normalizeText(candidate).includes(text),
    );
    if (!link) {
      throw new Error(`Missing link containing: ${text}`);
    }

    return link;
  }

  function getLabelledLinkIn(element: Element, label: string) {
    const link = element.querySelector(`a[aria-label="${label}"]`);
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error(`Missing labelled link: ${label}`);
    }

    return link;
  }

  function getLabelledElement(label: string) {
    const element = container.querySelector(`[aria-label="${label}"]`);
    if (!element) {
      throw new Error(`Missing labelled element: ${label}`);
    }

    return element;
  }

  function getDialog() {
    const dialog = container.querySelector('[role="dialog"]');
    if (!dialog) {
      throw new Error("Missing dialog");
    }

    return dialog;
  }

  function getContributionEditor() {
    const editor = container.querySelector(".kb-contribution-editor");
    if (!editor) {
      throw new Error("Missing Contribution Editor");
    }

    return editor;
  }

  function getContributionContextLabels(editor: Element) {
    return Array.from(
      editor.querySelectorAll(".kb-contribution-context-tags li"),
    ).map(normalizeText);
  }

  function getTextInputIn(element: Element) {
    const input = element.querySelector('input[type="text"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Missing text input");
    }

    return input;
  }

  function getInputByName(name: string) {
    const input = container.querySelector(`input[name="${name}"]`);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Missing input: ${name}`);
    }

    return input;
  }

  function getTextareaIn(element: Element) {
    const textarea = element.querySelector("textarea");
    if (!(textarea instanceof HTMLTextAreaElement)) {
      throw new Error("Missing textarea");
    }

    return textarea;
  }

  function getTextareasIn(element: Element) {
    return Array.from(element.querySelectorAll("textarea")).map((textarea) => {
      if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error("Unexpected textarea element");
      }

      return textarea;
    });
  }

  function getUrlInputIn(element: Element) {
    const input = element.querySelector('input[type="url"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Missing URL input");
    }

    return input;
  }

  function getFileInputIn(element: Element) {
    const input = element.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Missing file input");
    }

    return input;
  }

  function getCheckboxesIn(element: Element) {
    return Array.from(element.querySelectorAll('input[type="checkbox"]')).map(
      (checkbox) => {
        if (!(checkbox instanceof HTMLInputElement)) {
          throw new Error("Unexpected checkbox input");
        }

        return checkbox;
      },
    );
  }

  function getSelect(label: string) {
    const select = container.querySelector(`select[aria-label="${label}"]`);
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error(`Missing select: ${label}`);
    }

    return select;
  }

  function getRootSearchInput() {
    const input = container.querySelector('input[aria-label="Search Everything"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Missing Root Search Input");
    }

    return input;
  }

  async function click(element: Element) {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function changeTextareaValue(
    textarea: HTMLTextAreaElement,
    value: string,
  ) {
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(textarea, value);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
  }

  async function toggleCheckbox(element: HTMLInputElement) {
    await act(async () => {
      element.click();
      await Promise.resolve();
    });
  }

  async function setFileInputFiles(
    element: HTMLInputElement,
    files: File[],
  ) {
    await act(async () => {
      Object.defineProperty(element, "files", {
        configurable: true,
        value: files,
      });
      element.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function flushAsyncWork() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  async function scrollHostContent(element: HTMLElement, scrollTop: number) {
    await act(async () => {
      element.scrollTop = scrollTop;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
      await Promise.resolve();
    });
  }

  async function keyDown(element: HTMLElement, key: string) {
    await act(async () => {
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key,
        }),
      );
      await Promise.resolve();
    });
  }

  function setTopbarScrollMetrics(
    hostColumn: HTMLElement,
    hostContent: HTMLElement,
    {
      clientHeight,
      scrollHeight,
      topbarHeight,
    }: {
      clientHeight: number;
      scrollHeight: number;
      topbarHeight: number;
    },
  ) {
    hostColumn.style.setProperty("--kb-topbar-height", `${topbarHeight}px`);
    Object.defineProperty(hostContent, "clientHeight", {
      configurable: true,
      value: clientHeight,
    });
    Object.defineProperty(hostContent, "scrollHeight", {
      configurable: true,
      value: scrollHeight,
    });
  }

  async function setFieldValue(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string,
  ) {
    await act(async () => {
      const valueSetter =
        element instanceof HTMLTextAreaElement
          ? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")
              ?.set
          : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

      valueSetter?.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
  }

  async function setSelectValue(element: HTMLSelectElement, value: string) {
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set;

      valueSetter?.call(element, value);
      element.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });
  }

  function normalizeText(element: Element | null) {
    return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
});
