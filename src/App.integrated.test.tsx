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
  auth: {
    isAuthenticated: true,
    isLoading: false,
  },
  organizationMembershipMembers: [] as unknown[],
  mutationCalls: [] as unknown[],
  actionCalls: [] as unknown[],
  smartStorageModelRunResult: {
    executionStatus: "proposalCreated",
    smartStorageProposalId: "smart-storage-proposal-raw-chapel-notes",
    smartStorageRunId: "smart-storage-run-raw-chapel-notes",
    status: "drafted",
  } as Record<string, unknown>,
  smartStorageAcceptReturnsTargetExists: false,
  smartStorageSourceIds: ["source-raw-chapel-notes"] as string[],
  smartStorageStartInput: null as Record<string, unknown> | null,
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
      return {
        ...mockState.smartStorageModelRunResult,
        smartStorageRunId: "smart-storage-run-raw-chapel-notes",
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

      return {
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
    }
    if (functionName === "smartStorage:acceptScaffoldProposal") {
      const acceptInput =
        args && typeof args === "object" ? (args as Record<string, unknown>) : {};
      if (
        mockState.smartStorageAcceptReturnsTargetExists &&
        acceptInput.targetExistingEntryId === undefined
      ) {
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

    if (functionName === "pinnedKnowledgePages:listForSidebar") {
      return mockState.pinnedKnowledgePages;
    }

    if (functionName === "bookmarkedKnowledgePages:listForProfile") {
      return mockState.bookmarkedKnowledgePages;
    }

    if (functionName === "knowledgeSubscriptions:listForNotifications") {
      return mockState.knowledgeSubscriptions;
    }

    if (functionName === "answerFeed:listForActiveTagKeys") {
      const activeTagIds = getMockActiveTagIds(args);
      return mockState.answerFeedItems
        .filter((item) => itemFitsMockKnowledgeContext(item, activeTagIds))
        .sort(compareMockAnswerFeedItems);
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
    mockState.answerFeedItems = getMockInitialAnswerFeedItems();
    mockState.smartStorageSourceIds = ["source-raw-chapel-notes"];
    mockState.smartStorageStartInput = null;
    mockState.smartStorageModelRunResult = {
      executionStatus: "proposalCreated",
      smartStorageProposalId: "smart-storage-proposal-raw-chapel-notes",
      smartStorageRunId: "smart-storage-run-raw-chapel-notes",
      status: "drafted",
    };
    mockState.smartStorageAcceptReturnsTargetExists = false;
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

    const rail = getLabelledElement("Knowledge context and request");
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
    const knowledgeTypeSelect = editor.querySelector("select");
    expect(knowledgeTypeSelect?.getAttribute("disabled")).not.toBeNull();
    expect(knowledgeTypeSelect?.getAttribute("value") ?? knowledgeTypeSelect?.value).toBe(
      "comment",
    );

    expect(editor.querySelector('input[type="text"]')).toBeNull();
    await setFieldValue(getTextareaIn(editor), CONTRIBUTION_BODY);
    await click(getButtonIn(editor, "Post Comment"));

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
    expect(editor.textContent).toContain("Smart Storage");

    await setFieldValue(getTextInputIn(editor), "Raw chapel notes");
    await setFieldValue(
      getTextareaIn(editor),
      "A source that should be preserved before enrichment.",
    );
    const contributionNote = getTextareasIn(editor)[1];
    await setFieldValue(
      contributionNote,
      "Use the URL and program as supporting material.",
    );
    const urlInput = getUrlInputIn(editor);
    await setFieldValue(urlInput, "https://example.com/chapel-program");
    await click(getButtonIn(editor, "Add external URL Source"));
    await setFileInputFiles(getFileInputIn(editor), [uploadedFile]);

    expect(editor.textContent).toContain("Source Inventory");
    expect(editor.textContent).toContain("https://example.com/chapel-program");
    expect(editor.textContent).toContain("chapel-program.pdf");

    await click(getButtonIn(editor, "Store Smartly"));

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
        body: "A source that should be preserved before enrichment.",
        contributionNote: "Use the URL and program as supporting material.",
        contextTags: [],
        externalUrls: [{ url: "https://example.com/chapel-program" }],
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
        functionName: "smartStorage:executeModelRun",
        smartStorageRunId: "smart-storage-run-raw-chapel-notes",
      }),
    );
    expect(mockState.mutationCalls).toContainEqual(
      expect.objectContaining({
        functionName: "smartStorage:generateDraftProposalForRun",
        smartStorageRunId: "smart-storage-run-raw-chapel-notes",
      }),
    );
    expect(
      mockState.mutationCalls.some(
        (call) =>
          call &&
          typeof call === "object" &&
          "functionName" in call &&
          call.functionName === "directContributions:postDirectContribution",
      ),
    ).toBe(false);
    expect(editor.textContent).toContain("Stored Smartly");
    const proposalReview = getLabelledElement("Smart Storage Proposal");
    expect(proposalReview.textContent).toContain("Raw chapel notes");
    expect(proposalReview.textContent).toContain("Words");
    expect(proposalReview.textContent).toContain(
      "A source that should be preserved before enrichment.",
    );
    expect(proposalReview.textContent).toContain("Proposal Confidence");
    expect(proposalReview.textContent).toContain("Medium");
    expect(proposalReview.textContent).toContain("Draft Proposal");
    expect(proposalReview.textContent).toContain("Text Excerpt");
    expect(proposalReview.textContent).toContain("External URL");
    expect(proposalReview.textContent).toContain("File");
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

    await click(getButtonIn(proposalReview, "Accept Proposal"));

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

  test("confirms Smart Storage updates into an existing Gold entry", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/");
    mockState.smartStorageAcceptReturnsTargetExists = true;

    await renderApp();

    const editor = getContributionEditor();
    await setFieldValue(getTextInputIn(editor), "Raw chapel notes");
    await setFieldValue(
      getTextareaIn(editor),
      "A source that should update the existing Gold entry.",
    );
    await click(getButtonIn(editor, "Store Smartly"));

    let proposalReview = getLabelledElement("Smart Storage Proposal");
    await click(getButtonIn(proposalReview, "Accept Proposal"));

    proposalReview = getLabelledElement("Smart Storage Proposal");
    expect(proposalReview.textContent).toContain("Target Exists");
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
      heading: "Model Proposal Failed",
      message: "The model proposal generation failed.",
      runStatus: "failed",
    },
    {
      executionStatus: "noProposal",
      heading: "No Structured Proposal Found",
      message: "No structured proposal was returned.",
      runStatus: "noProposal",
    },
  ])(
    "shows explicit Smart Storage $runStatus outcome with deterministic fallback",
    async ({ errorMessage, executionStatus, heading, message, runStatus }) => {
      mockState.smartStorageModelRunResult = {
        ...(errorMessage === undefined ? {} : { errorMessage }),
        executionStatus,
        smartStorageRunId: "smart-storage-run-raw-chapel-notes",
        status: runStatus,
      };

      await renderApp();

      const editor = getContributionEditor();
      await setFieldValue(getTextInputIn(editor), "Raw chapel notes");
      await setFieldValue(
        getTextareaIn(editor),
        "A source that should be preserved before enrichment.",
      );
      await click(getButtonIn(editor, "Store Smartly"));

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

      const runStatusPanel = getLabelledElement("Smart Storage Run status");
      expect(runStatusPanel.textContent).toContain(heading);
      expect(runStatusPanel.textContent).toContain(message);
      expect(runStatusPanel.textContent).toContain(
        "Source preserved as Bronze Layer material.",
      );
      if (errorMessage !== undefined) {
        expect(runStatusPanel.textContent).toContain(errorMessage);
      }

      await click(getButtonIn(runStatusPanel, "Generate Scaffold Proposal"));

      expect(mockState.mutationCalls).toContainEqual(
        expect.objectContaining({
          functionName: "smartStorage:generateDraftProposalForRun",
          smartStorageRunId: "smart-storage-run-raw-chapel-notes",
        }),
      );
      expect(getLabelledElement("Smart Storage Proposal").textContent).toContain(
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
        email: "pending.teacher@example.com",
        membershipId: "membership:pending-teacher",
        name: "pending.teacher@example.com",
        role: "member",
        status: "pending",
      },
    ];

    await renderApp();

    expect(container.textContent).toContain("Organization Settings");
    expect(container.textContent).toContain("Cedar Hall School");
    expect(container.textContent).toContain("Members");
    expect(container.textContent).toContain("Member email");
    expect(container.textContent).toContain("pending.teacher@example.com");
    expect(container.textContent).toContain("Pending Member");
    expect(container.textContent).not.toContain("Invitation");
    expect(getButton("Add member")).toBeTruthy();

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
    const knowledgeTypeSelect = editor.querySelector("select");
    expect(knowledgeTypeSelect?.getAttribute("value") ?? knowledgeTypeSelect?.value).toBe(
      "group",
    );
    expect(editor.textContent).toContain("Direct Post");
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
    expect(container.querySelector(".kb-shell")).toBeNull();
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

    const themeSwitch = getButton("Use dark theme");
    expect(themeSwitch.getAttribute("role")).toBe("switch");
    expect(themeSwitch.getAttribute("aria-checked")).toBe("false");

    await click(themeSwitch);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("knowledgebase-theme")).toBe("dark");
    expect(getButton("Use light theme").getAttribute("aria-checked")).toBe("true");
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

    await click(getButton("Open account menu"));
    await click(getLinkIn(getLabelledElement("Account menu"), "Profile"));

    expect(window.location.pathname).toBe("/profile");
    expect(container.querySelector(".kb-profile-main")).toBeTruthy();
    expect(container.textContent).toContain("gelbaughcm@gmail.com");
    expect(container.textContent).toContain("Arche Classical Academy");
    expect(container.textContent).toContain("Admin");
    expect(container.textContent).toContain("4 memberships");
    expect(container.textContent).not.toContain("Route scaffold");
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
    expect(knowledgePageDestinations.textContent).toContain("Global Knowledge Context");
    expect(getLabelledLinkIn(knowledgePageDestinations, "Arche Classical Academy")).toBeTruthy();
    expect(getLabelledLinkIn(knowledgePageDestinations, "Ruler of Kings Church")).toBeTruthy();
    expect(getLabelledLinkIn(knowledgePageDestinations, "My Family")).toBeTruthy();
    expect(knowledgePageDestinations.textContent).not.toContain("Explore Context");
    expect(knowledgePageDestinations.textContent).toContain("+1 more");

    const userViews = getLabelledElement("User Views");
    expect(
      Array.from(userViews.querySelectorAll("a")).map((link) =>
        link.getAttribute("aria-label"),
      ),
    ).toEqual([
      "Calendar",
      "Notifications",
    ]);
    expect(userViews.textContent).not.toContain("Settings");
    expect(getLabelledElement("Unread notifications").textContent).toBe("3");

    await click(getButton("Open account menu"));

    const accountMenu = getLabelledElement("Account menu");
    expect(getLinkIn(accountMenu, "Profile").getAttribute("href")).toBe("/profile");
    expect(getLinkIn(accountMenu, "Bookmarks").getAttribute("href")).toBe(
      "/profile?section=bookmarks",
    );
    expect(getLinkIn(accountMenu, "Settings").getAttribute("href")).toBe("/settings");
    expect(getButtonIn(accountMenu, "Switch to dark theme")).toBeTruthy();
    expect(getButtonIn(accountMenu, "Sign out")).toBeTruthy();
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
      getLabelledElement("Knowledge Page destinations").textContent,
    ).toContain("Arche Classical Academy");

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
      getLabelledElement("Knowledge Page destinations").textContent,
    ).not.toContain("Arche Classical Academy");

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
      getLabelledElement("Knowledge Page destinations").textContent,
    ).toContain("Arche Classical Academy");
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
      getLabelledElement("Knowledge Page destinations").textContent,
    ).toContain("Arche Classical Academy");

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
      getLabelledElement("Knowledge Page destinations").textContent,
    ).toContain("Arche Classical Academy");

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
      getLabelledElement("Knowledge Page destinations").textContent,
    ).toContain("Arche Classical Academy");
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
      getLabelledElement("Knowledge Page destinations").textContent,
    ).toContain("Arche Classical Academy");
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
    expect(identityBand?.textContent).toContain("Global Knowledge Context");
    expect(container.querySelector(".kb-rail-focus-heading")).toBeNull();
    expect(container.querySelector(".kb-knowledge-navigator > header")).toBeNull();
    expect(
      container.querySelector(".kb-answer-feed-header h2")?.closest(".kb-sr-only"),
    ).toBeTruthy();
    const rail = getLabelledElement("Knowledge context and request");
    expect(rail.querySelector(".kb-knowledge-navigator")).toBeTruthy();
    expect(rail.querySelector(".kb-request-composer")).toBeTruthy();
    expect(rail.textContent).toContain("Knowledge Composer");
    expect(rail.querySelector("textarea")?.getAttribute("placeholder")).toBe(
      "Ask a Question or Context...",
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

  test("renders the typed overview on referent pages", async () => {
    window.history.replaceState({}, "", "http://localhost:3000/goto/first-crusade");

    await renderApp();

    const identityBand = container.querySelector(".kb-knowledge-page-identity");
    expect(identityBand).toBeTruthy();
    expect(identityBand?.textContent).toContain("Referent Page");
    expect(identityBand?.textContent).toContain("First Crusade");
    expect(identityBand?.textContent).toContain("Topic");
    expect(container.querySelector(".kb-rail-focus-heading")).toBeNull();
    const rail = getLabelledElement("Knowledge context and request");
    expect(rail.querySelector(".kb-knowledge-navigator")).toBeTruthy();
    expect(rail.querySelector(".kb-request-composer")).toBeTruthy();
    expect(rail.textContent).toContain("First Crusade");
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
    const rail = getLabelledElement("Knowledge context and request");
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
    expect(getLabelledElement("Knowledge Page destinations").textContent).not.toContain(
      "Analytics",
    );
  });

  test("renders the Smart Storage playground with predictions and feedback capture", async () => {
    window.history.replaceState(
      {},
      "",
      "http://localhost:3000/playground/smart-storage",
    );

    await renderApp();

    expect(container.querySelector(".kb-smart-playground-main")).toBeTruthy();
    expect(getLabelledElement("Knowledge Page destinations").textContent).not.toContain(
      "Smart Storage",
    );

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
    await click(getButtonIn(editor, "Post Lesson"));

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

  async function click(element: Element) {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
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

  async function scrollHostContent(element: HTMLElement, scrollTop: number) {
    await act(async () => {
      element.scrollTop = scrollTop;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
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
