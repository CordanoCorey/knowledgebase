import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { organizationMembershipRole } from "./lib/organizationRoles";

// Schema validators are the durable backend contract. Keep shared unions here
// aligned with frontend knowledgeContracts and Convex lib/typeBehavior.
const referentKnowledgeType = v.union(
  v.literal("words"),
  v.literal("announcement"),
  v.literal("biblePassage"),
  v.literal("topic"),
  v.literal("series"),
  v.literal("question"),
  v.literal("quote"),
  v.literal("sermon"),
  v.literal("essay"),
  v.literal("poem"),
  v.literal("song"),
  v.literal("book"),
  v.literal("shortStory"),
  v.literal("lesson"),
  v.literal("comment"),
  v.literal("prayerRequest"),
  v.literal("event"),
  v.literal("rsvp"),
  v.literal("person"),
  v.literal("organization"),
  v.literal("group"),
  v.literal("place"),
);

const entryKnowledgeType = v.union(
  v.literal("words"),
  v.literal("announcement"),
  v.literal("topic"),
  v.literal("series"),
  v.literal("question"),
  v.literal("quote"),
  v.literal("sermon"),
  v.literal("essay"),
  v.literal("poem"),
  v.literal("song"),
  v.literal("book"),
  v.literal("shortStory"),
  v.literal("lesson"),
  v.literal("comment"),
  v.literal("prayerRequest"),
  v.literal("event"),
  v.literal("rsvp"),
  v.literal("person"),
  v.literal("organization"),
  v.literal("group"),
  v.literal("place"),
);

const biblePassageRange = v.object({
  startOrdinal: v.number(),
  endOrdinal: v.number(),
});

const visibilityKind = v.union(
  v.literal("private"),
  v.literal("organization"),
  v.literal("group"),
  v.literal("public"),
);

const discoverabilityKind = visibilityKind;

const tagPurpose = v.union(
  v.literal("represented"),
  v.literal("context"),
);

const sourceKind = v.union(
  v.literal("pastedText"),
  v.literal("uploadedFile"),
  v.literal("externalUrl"),
  v.literal("manualEntry"),
);

const contributionSubmissionStatus = v.union(
  v.literal("submitted"),
  v.literal("processing"),
  v.literal("reviewReady"),
  v.literal("partiallyAccepted"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

const reviewScopeKind = v.union(
  v.literal("private"),
  v.literal("organization"),
  v.literal("group"),
  v.literal("public"),
);

const linkPreviewStatus = v.union(
  v.literal("notFetched"),
  v.literal("queued"),
  v.literal("fetched"),
  v.literal("failed"),
);

const sourceOutputKind = v.union(
  v.literal("produced"),
  v.literal("derived"),
);

const smartStorageFeedbackRating = v.union(
  v.literal("accurate"),
  v.literal("close"),
  v.literal("wrong"),
);

const humanWeightFeedbackKind = v.union(
  v.literal("recognize"),
  v.literal("used"),
  v.literal("notHuman"),
  v.literal("wrongContext"),
);

const humanWeightEvidenceKind = v.union(v.literal("slotFulfillment"));

const humanWeightEvidenceSignal = humanWeightFeedbackKind;

const contextExpertiseEvidenceKind = v.union(
  v.literal("post"),
  v.literal("quoteAttribution"),
  v.literal("feedback"),
  v.literal("slotFulfillment"),
  v.literal("curation"),
);
const contextExpertiseEvidenceCorrectionKind = v.union(
  v.literal("attribution"),
  v.literal("wrongContext"),
);
const personGlobalExpertVisibilityStatus = v.union(
  v.literal("visibleByDefault"),
  v.literal("suppressed"),
);
const personGlobalExpertVisibilityModerationAction = v.union(
  v.literal("suppressed"),
  v.literal("restored"),
  v.literal("suppressionNoteUpdated"),
);

const smartStoragePredictedEntry = v.object({
  knowledgeType: entryKnowledgeType,
  title: v.string(),
  confidence: v.number(),
  reason: v.string(),
  sourceExcerpt: v.string(),
});

const smartStorageSubmittedEntry = v.object({
  knowledgeType: entryKnowledgeType,
  title: v.string(),
  bodyPreview: v.string(),
});

const smartStorageRunStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("noProposal"),
  v.literal("failed"),
  v.literal("superseded"),
);

const smartStorageContextTagSnapshot = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  passageString: v.optional(v.string()),
});

const smartStorageProposalStatus = v.union(
  v.literal("drafted"),
  v.literal("needsResolution"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("stale"),
);

const smartStorageProposalRole = v.union(
  v.literal("primary"),
  v.literal("prerequisite"),
  v.literal("secondary"),
  v.literal("referenceResolution"),
  v.literal("refresh"),
  v.literal("reprocessing"),
  v.literal("cleanup"),
);

const smartStorageProposalDependencyRequirementKind = v.union(
  v.literal("referent"),
  v.literal("field"),
  v.literal("relationship"),
  v.literal("primaryAnchor"),
);

const smartStorageProposalDependency = v.object({
  requiredByProposalId: v.optional(v.id("smartStorageProposals")),
  requirementKind: smartStorageProposalDependencyRequirementKind,
  requirementKey: v.string(),
  label: v.string(),
});

const proposalConfidence = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

const smartStorageProposedEntry = v.object({
  knowledgeType: entryKnowledgeType,
  title: v.string(),
  bodyPreview: v.string(),
  contextTags: v.array(smartStorageContextTagSnapshot),
  proposalConfidence,
  rationale: v.string(),
});

const entryRepresentationKind = v.union(
  v.literal("prosemirror"),
  v.literal("plainText"),
  v.literal("storageFile"),
  v.literal("externalUrl"),
  v.literal("audio"),
  v.literal("video"),
);

const entryRepresentationRole = v.union(
  v.literal("unspecified"),
  v.literal("primaryContent"),
  v.literal("manuscript"),
  v.literal("slides"),
  v.literal("transcript"),
  v.literal("recording"),
  v.literal("thumbnail"),
  v.literal("supportingMaterial"),
);

const literatureDetailFields = {
  author: v.optional(v.union(v.string(), v.null())),
  yearPublished: v.optional(v.union(v.string(), v.null())),
  lexileMeasure: v.optional(v.union(v.number(), v.null())),
  approxWordCountK: v.optional(v.union(v.number(), v.null())),
  approxGradeMin: v.optional(v.union(v.number(), v.null())),
  approxGradeMax: v.optional(v.union(v.number(), v.null())),
  historicalTimeframeStartYear: v.optional(v.union(v.number(), v.null())),
  historicalTimeframeEndYear: v.optional(v.union(v.number(), v.null())),
  settingLocation: v.optional(v.union(v.string(), v.null())),
  genres: v.optional(v.array(v.string())),
  publisher: v.optional(v.union(v.string(), v.null())),
};

const temporaryUploadStatus = v.union(
  v.literal("uploaded"),
  v.literal("attached"),
  v.literal("expired"),
  v.literal("deleted"),
);

const proposalSourceCitationKind = v.union(
  v.literal("wholeSource"),
  v.literal("textExcerpt"),
  v.literal("fileLocator"),
  v.literal("externalUrl"),
);

const organizationKind = v.union(
  v.literal("school"),
  v.literal("church"),
  v.literal("family"),
  v.literal("community"),
);

const pinnedKnowledgePageKind = v.union(v.literal("organization"));
const bookmarkedKnowledgePageKind = v.union(v.literal("organization"));
const knowledgeSubscriptionTargetKind = v.union(v.literal("organization"));
const userNotificationKind = v.union(
  v.literal("access"),
  v.literal("announcement"),
  v.literal("answer"),
  v.literal("event"),
  v.literal("knowledgeSlot"),
  v.literal("subscription"),
);
const userNotificationStatus = v.union(
  v.literal("read"),
  v.literal("unread"),
);
const userNotificationSourceKind = v.union(
  v.literal("announcement"),
  v.literal("subscription"),
  v.literal("knowledgeSlot"),
  v.literal("event"),
  v.literal("system"),
);
const emailDeliveryKind = v.union(
  v.literal("notification"),
  v.literal("system"),
);
const emailDeliveryStatus = v.union(
  v.literal("waiting"),
  v.literal("queued"),
  v.literal("cancelled"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("delivery_delayed"),
  v.literal("bounced"),
  v.literal("failed"),
);

const pinState = v.union(
  v.literal("pinned"),
  v.literal("suppressed"),
);

const pinSource = v.union(
  v.literal("defaultSeed"),
  v.literal("manual"),
);

const membershipTargetKind = v.union(
  v.literal("organization"),
  v.literal("group"),
);

const membershipStatus = v.union(
  v.literal("active"),
  v.literal("invited"),
  v.literal("inactive"),
);
const contactIdentityKind = v.union(v.literal("email"));
const contactIdentityVerificationStatus = v.union(
  v.literal("pending"),
  v.literal("verified"),
);
const membershipClaimSource = v.union(
  v.literal("verifiedPrimaryEmail"),
  v.literal("verifiedContactIdentity"),
);
const personConsolidationReviewStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);
const personConsolidationReviewReason = v.union(
  v.literal("placeholderHasMeaningfulIdentity"),
);

const knowledgeSlotStatus = v.union(
  v.literal("open"),
  v.literal("fulfilled"),
  v.literal("cancelled"),
  v.literal("overdue"),
);

const knowledgeSlotTargetKind = v.union(
  v.literal("user"),
  v.literal("person"),
  v.literal("organization"),
  v.literal("group"),
  v.literal("public"),
);
const humanWeightExpectation = v.union(
  v.literal("none"),
  v.literal("informative"),
  v.literal("expected"),
  v.literal("required"),
);

const seriesItemKind = v.union(
  v.literal("entry"),
  v.literal("tag"),
  v.literal("knowledgeSlot"),
);

const prayerStatus = v.union(
  v.literal("open"),
  v.literal("answered"),
  v.literal("closed"),
);

const rsvpResponse = v.union(
  v.literal("yes"),
  v.literal("no"),
  v.literal("maybe"),
);

const pageType = v.union(
  v.literal("dashboard"),
  v.literal("referent"),
  v.literal("context"),
);

const analyticsTargetKind = v.union(
  v.literal("dashboard"),
  v.literal("tag"),
  v.literal("biblePassage"),
  v.literal("context"),
);

const searchScope = v.union(
  v.literal("root"),
  v.literal("activeKnowledgeContext"),
);

export default defineSchema({
  ...authTables,

  // Identity and access tables gate the app before Knowledge Context features
  // become visible to authenticated users.
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    systemRole: v.optional(v.literal("systemAdmin")),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // Referents are canonical things being discussed; Tags are the user-facing
  // labels and aliases that route/search users into those referents.
  referents: defineTable({
    knowledgeType: referentKnowledgeType,
    canonicalKey: v.string(),
    canonicalName: v.string(),
    biblePassage: v.optional(
      v.object({
        versification: v.string(),
        ranges: v.array(biblePassageRange),
      }),
    ),
  })
    .index("by_knowledgeType_and_canonicalKey", [
      "knowledgeType",
      "canonicalKey",
    ])
    .index("by_knowledgeType_and_canonicalName", [
      "knowledgeType",
      "canonicalName",
    ]),

  tags: defineTable({
    referentId: v.id("referents"),
    knowledgeType: referentKnowledgeType,
    label: v.string(),
    lookupKey: v.string(),
    createdByUserId: v.optional(v.id("users")),
  })
    .index("by_referentId", ["referentId"])
    .index("by_lookupKey", ["lookupKey"])
    .index("by_knowledgeType_and_lookupKey", ["knowledgeType", "lookupKey"])
    .searchIndex("search_label", {
      searchField: "label",
      filterFields: ["knowledgeType"],
    }),

  tagAliases: defineTable({
    tagId: v.id("tags"),
    knowledgeType: referentKnowledgeType,
    label: v.string(),
    lookupKey: v.string(),
    aliasKind: v.union(
      v.literal("alternateName"),
      v.literal("abbreviation"),
      v.literal("citationVariant"),
      v.literal("misspelling"),
    ),
    createdByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_tagId", ["tagId"])
    .index("by_lookupKey", ["lookupKey"])
    .index("by_knowledgeType_and_lookupKey", ["knowledgeType", "lookupKey"])
    .index("by_tagId_and_lookupKey", ["tagId", "lookupKey"])
    .searchIndex("search_label", {
      searchField: "label",
      filterFields: ["knowledgeType", "aliasKind"],
    }),

  // Knowledge Entries are the gold layer: typed, reviewable records anchored to
  // a represented referent and discoverable through tags.
  knowledgeEntries: defineTable({
    knowledgeType: entryKnowledgeType,
    representedReferentId: v.id("referents"),
    primaryTagId: v.id("tags"),
    title: v.string(),
    previewText: v.string(),
    searchText: v.string(),
    primaryTagLabel: v.string(),
    contextPreviewTagLabels: v.array(v.string()),
    humanWeight: v.optional(v.number()),
    humanWeightBaseEstimate: v.optional(v.number()),
    humanWeightCalculationVersion: v.optional(v.string()),
    humanWeightCalculationDefinitionId: v.optional(
      v.id("humanWeightCalculationDefinitions"),
    ),
    visibilityKind,
    visibilityTargetKey: v.string(),
    discoverabilityKind,
    discoverabilityTargetKey: v.string(),
    publicPreviewText: v.optional(v.string()),
    createdByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_representedReferentId", ["representedReferentId"])
    .index("by_primaryTagId", ["primaryTagId"])
    .index("by_knowledgeType", ["knowledgeType"])
    .index("by_knowledgeType_and_createdAt", ["knowledgeType", "createdAt"])
    .index("by_knowledgeType_and_updatedAt", ["knowledgeType", "updatedAt"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_humanWeight_and_updatedAt", ["humanWeight", "updatedAt"])
    .index("by_createdByUserId", ["createdByUserId"])
    .index("by_createdByUserId_and_createdAt", [
      "createdByUserId",
      "createdAt",
    ])
    .index("by_visibilityKind_and_visibilityTargetKey", [
      "visibilityKind",
      "visibilityTargetKey",
    ])
    .index("by_discoverabilityKind_and_discoverabilityTargetKey", [
      "discoverabilityKind",
      "discoverabilityTargetKey",
    ])
    .searchIndex("search_searchText", {
      searchField: "searchText",
      filterFields: [
        "knowledgeType",
        "visibilityKind",
        "visibilityTargetKey",
        "discoverabilityKind",
        "discoverabilityTargetKey",
      ],
    }),

  entryTags: defineTable({
    entryId: v.id("knowledgeEntries"),
    tagId: v.id("tags"),
    tagPurpose,
    taggedAt: v.number(),
    taggedByUserId: v.optional(v.id("users")),
  })
    .index("by_entryId_and_tagId", ["entryId", "tagId"])
    .index("by_entryId_and_tagPurpose", ["entryId", "tagPurpose"])
    .index("by_tagId_and_entryId", ["tagId", "entryId"])
    .index("by_tagId_and_tagPurpose", ["tagId", "tagPurpose"]),

  tagRecognitions: defineTable({
    tagId: v.id("tags"),
    recognizerKind: v.union(v.literal("user"), v.literal("organization")),
    userId: v.optional(v.id("users")),
    organizationReferentId: v.optional(v.id("referents")),
    recognizedAt: v.number(),
    lastInteractedAt: v.number(),
  })
    .index("by_tagId", ["tagId"])
    .index("by_userId_and_tagId", ["userId", "tagId"])
    .index("by_userId_and_lastInteractedAt", ["userId", "lastInteractedAt"])
    .index("by_organizationReferentId_and_tagId", [
      "organizationReferentId",
      "tagId",
    ])
    .index("by_organizationReferentId_and_lastInteractedAt", [
      "organizationReferentId",
      "lastInteractedAt",
    ]),

  userProfiles: defineTable({
    userId: v.id("users"),
    personEntryId: v.id("knowledgeEntries"),
    personReferentId: v.id("referents"),
    personTagId: v.id("tags"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_personEntryId", ["personEntryId"])
    .index("by_personReferentId", ["personReferentId"]),

  contextExpertiseVisibilitySettings: defineTable({
    userId: v.id("users"),
    globalExpertVisibilityEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  personContextExpertiseVisibilitySettings: defineTable({
    personReferentId: v.id("referents"),
    globalExpertVisibilityStatus: v.literal("suppressed"),
    moderationNote: v.optional(v.string()),
    updatedByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_personReferentId", ["personReferentId"]),

  personContextExpertiseVisibilityModerationEvents: defineTable({
    personReferentId: v.id("referents"),
    action: personGlobalExpertVisibilityModerationAction,
    previousStatus: personGlobalExpertVisibilityStatus,
    nextStatus: personGlobalExpertVisibilityStatus,
    moderationNote: v.optional(v.string()),
    previousModerationNote: v.optional(v.string()),
    updatedByUserId: v.id("users"),
    createdAt: v.number(),
  }).index("by_personReferentId_and_createdAt", [
    "personReferentId",
    "createdAt",
  ]),

  // Membership and contact tables support pre-account invitations, verified
  // identity claims, and admin review of possible person consolidation.
  memberships: defineTable({
    personReferentId: v.id("referents"),
    memberUserId: v.optional(v.id("users")),
    targetKind: membershipTargetKind,
    organizationReferentId: v.optional(v.id("referents")),
    groupReferentId: v.optional(v.id("referents")),
    membershipStatus,
    memberRole: v.optional(organizationMembershipRole),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_personReferentId_and_membershipStatus", [
      "personReferentId",
      "membershipStatus",
    ])
    .index("by_memberUserId_and_membershipStatus", [
      "memberUserId",
      "membershipStatus",
    ])
    .index("by_memberUserId_and_organizationReferentId", [
      "memberUserId",
      "organizationReferentId",
    ])
    .index("by_organizationReferentId_and_membershipStatus", [
      "organizationReferentId",
      "membershipStatus",
    ])
    .index("by_groupReferentId_and_membershipStatus", [
      "groupReferentId",
      "membershipStatus",
    ]),

  contactIdentities: defineTable({
    userId: v.id("users"),
    contactKind: contactIdentityKind,
    value: v.string(),
    verificationStatus: contactIdentityVerificationStatus,
    verificationCode: v.optional(v.string()),
    verificationCodeExpiresAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    lastRequestedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_contactKind_and_value", [
      "userId",
      "contactKind",
      "value",
    ])
    .index("by_contactKind_and_value_and_verificationStatus", [
      "contactKind",
      "value",
      "verificationStatus",
    ])
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"]),

  membershipClaims: defineTable({
    membershipId: v.id("memberships"),
    claimedByUserId: v.id("users"),
    organizationReferentId: v.id("referents"),
    claimedContactKind: contactIdentityKind,
    claimedContactValue: v.string(),
    verifiedContactIdentityId: v.optional(v.id("contactIdentities")),
    pendingPersonReferentId: v.id("referents"),
    resultingPersonReferentId: v.id("referents"),
    claimSource: membershipClaimSource,
    createdAt: v.number(),
  })
    .index("by_membershipId_and_createdAt", ["membershipId", "createdAt"])
    .index("by_claimedByUserId_and_createdAt", [
      "claimedByUserId",
      "createdAt",
    ])
    .index("by_organizationReferentId_and_createdAt", [
      "organizationReferentId",
      "createdAt",
    ])
    .index("by_verifiedContactIdentityId_and_createdAt", [
      "verifiedContactIdentityId",
      "createdAt",
    ]),

  personConsolidationReviews: defineTable({
    membershipId: v.id("memberships"),
    organizationReferentId: v.id("referents"),
    pendingPersonReferentId: v.id("referents"),
    candidatePersonReferentId: v.id("referents"),
    requestedByUserId: v.id("users"),
    claimedContactKind: contactIdentityKind,
    claimedContactValue: v.string(),
    verifiedContactIdentityId: v.optional(v.id("contactIdentities")),
    claimSource: membershipClaimSource,
    reviewStatus: personConsolidationReviewStatus,
    reviewReason: personConsolidationReviewReason,
    resolvedAt: v.optional(v.number()),
    resolvedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_membershipId_and_requestedByUserId_and_reviewStatus", [
      "membershipId",
      "requestedByUserId",
      "reviewStatus",
    ])
    .index("by_requestedByUserId_and_reviewStatus_and_createdAt", [
      "requestedByUserId",
      "reviewStatus",
      "createdAt",
    ])
    .index("by_pendingPersonReferentId_and_reviewStatus_and_createdAt", [
      "pendingPersonReferentId",
      "reviewStatus",
      "createdAt",
    ])
    .index("by_organizationReferentId_and_reviewStatus_and_createdAt", [
      "organizationReferentId",
      "reviewStatus",
      "createdAt",
    ]),

  // User navigation state is stored separately from knowledge content so sidebar
  // personalization and notifications do not churn entry documents.
  pinnedKnowledgePages: defineTable({
    userId: v.id("users"),
    pageKey: v.string(),
    pageKind: pinnedKnowledgePageKind,
    pinState,
    pinSource,
    sortOrder: v.number(),
    organizationReferentId: v.optional(v.id("referents")),
    organizationKind: v.optional(organizationKind),
    labelSnapshot: v.string(),
    hrefSnapshot: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_pageKey", ["userId", "pageKey"])
    .index("by_userId_and_pinState_and_sortOrder", [
      "userId",
      "pinState",
      "sortOrder",
    ])
    .index("by_userId_and_pinSource", ["userId", "pinSource"]),

  bookmarkedKnowledgePages: defineTable({
    userId: v.id("users"),
    pageKey: v.string(),
    pageKind: bookmarkedKnowledgePageKind,
    organizationReferentId: v.optional(v.id("referents")),
    targetReferentId: v.optional(v.id("referents")),
    targetTagId: v.optional(v.id("tags")),
    labelSnapshot: v.string(),
    hrefSnapshot: v.string(),
    secondaryLabelSnapshot: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastReferencedAt: v.optional(v.number()),
  })
    .index("by_userId_and_pageKey", ["userId", "pageKey"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_and_pageKind_and_updatedAt", [
      "userId",
      "pageKind",
      "updatedAt",
    ]),

  knowledgeSubscriptions: defineTable({
    userId: v.id("users"),
    subscriptionKey: v.string(),
    targetKind: knowledgeSubscriptionTargetKind,
    organizationReferentId: v.optional(v.id("referents")),
    targetReferentId: v.optional(v.id("referents")),
    targetTagId: v.optional(v.id("tags")),
    labelSnapshot: v.string(),
    hrefSnapshot: v.string(),
    secondaryLabelSnapshot: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_subscriptionKey", ["userId", "subscriptionKey"])
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_and_targetKind_and_updatedAt", [
      "userId",
      "targetKind",
      "updatedAt",
    ])
    .index("by_targetKind_and_targetReferentId", [
      "targetKind",
      "targetReferentId",
    ])
    .index("by_targetTagId", ["targetTagId"]),

  userNotifications: defineTable({
    userId: v.id("users"),
    notificationKind: userNotificationKind,
    notificationStatus: userNotificationStatus,
    title: v.string(),
    body: v.string(),
    contextLabel: v.string(),
    contextHref: v.string(),
    receivedAt: v.number(),
    readAt: v.optional(v.number()),
    sourceKind: v.optional(userNotificationSourceKind),
    sourceSubscriptionKey: v.optional(v.string()),
    sourceSubscriptionId: v.optional(v.id("knowledgeSubscriptions")),
    targetReferentId: v.optional(v.id("referents")),
    targetTagId: v.optional(v.id("tags")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_receivedAt", ["userId", "receivedAt"])
    .index("by_userId_and_notificationStatus_and_receivedAt", [
      "userId",
      "notificationStatus",
      "receivedAt",
    ])
    .index("by_userId_and_notificationKind_and_receivedAt", [
      "userId",
      "notificationKind",
      "receivedAt",
    ])
    .index("by_sourceSubscriptionKey_and_receivedAt", [
      "sourceSubscriptionKey",
      "receivedAt",
    ]),

  // Email delivery rows track provider state separately from notifications so
  // inbox records remain stable while outbound status changes arrive by webhook.
  emailDeliveries: defineTable({
    deliveryKind: emailDeliveryKind,
    status: emailDeliveryStatus,
    to: v.string(),
    from: v.string(),
    subject: v.string(),
    sourceKey: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    notificationId: v.optional(v.id("userNotifications")),
    providerEmailId: v.optional(v.string()),
    resendMessageId: v.optional(v.string()),
    lastEventType: v.optional(v.string()),
    lastEventAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    clickedAt: v.optional(v.number()),
    complainedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sourceKey", ["sourceKey"])
    .index("by_providerEmailId", ["providerEmailId"])
    .index("by_resendMessageId", ["resendMessageId"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_notificationId", ["notificationId"])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

  // Contribution Submissions are bronze-layer user intent; Sources preserve the
  // submitted material before Smart Storage proposes any gold entry changes.
  contributionSubmissions: defineTable({
    submittedByUserId: v.id("users"),
    submissionStatus: contributionSubmissionStatus,
    primaryIntendedKnowledgeType: entryKnowledgeType,
    primaryIntendedTitle: v.string(),
    primaryIntendedBodyPreview: v.string(),
    contributionNote: v.optional(v.string()),
    intendedVisibilityKind: visibilityKind,
    intendedVisibilityTargetKey: v.string(),
    reviewScopeKind,
    reviewScopeTargetKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_submittedByUserId_and_createdAt", [
      "submittedByUserId",
      "createdAt",
    ])
    .index("by_submissionStatus_and_createdAt", [
      "submissionStatus",
      "createdAt",
    ])
    .index("by_reviewScopeKind_and_reviewScopeTargetKey_and_createdAt", [
      "reviewScopeKind",
      "reviewScopeTargetKey",
      "createdAt",
    ]),

  contributionDrafts: defineTable({
    userId: v.id("users"),
    draftKey: v.string(),
    bodyPlainText: v.string(),
    bodyDocumentJson: v.string(),
    title: v.string(),
    selectedKnowledgeType: v.optional(entryKnowledgeType),
    placementLabel: v.optional(v.string()),
    slotId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_draftKey", ["userId", "draftKey"])
    .index("by_userId_and_updatedAt", ["userId", "updatedAt"]),

  temporaryUploads: defineTable({
    storageId: v.id("_storage"),
    uploadedByUserId: v.id("users"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    uploadStatus: temporaryUploadStatus,
    expiresAt: v.number(),
    attachedContributionSubmissionId: v.optional(
      v.id("contributionSubmissions"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_uploadedByUserId_and_createdAt", [
      "uploadedByUserId",
      "createdAt",
    ])
    .index("by_uploadStatus_and_expiresAt", ["uploadStatus", "expiresAt"])
    .index("by_storageId", ["storageId"]),

  sources: defineTable({
    contributionSubmissionId: v.optional(v.id("contributionSubmissions")),
    sourceKind,
    title: v.optional(v.string()),
    rawText: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    contentType: v.optional(v.string()),
    languageCode: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    linkPreviewStatus: v.optional(linkPreviewStatus),
    linkPreviewTitle: v.optional(v.string()),
    linkPreviewDescription: v.optional(v.string()),
    linkPreviewImageUrl: v.optional(v.string()),
    linkPreviewSiteName: v.optional(v.string()),
    linkPreviewFetchedAt: v.optional(v.number()),
    linkPreviewError: v.optional(v.string()),
    submittedByUserId: v.optional(v.id("users")),
    submittedAt: v.number(),
  })
    .index("by_contributionSubmissionId_and_submittedAt", [
      "contributionSubmissionId",
      "submittedAt",
    ])
    .index("by_submittedByUserId_and_submittedAt", [
      "submittedByUserId",
      "submittedAt",
    ])
    .index("by_sourceKind_and_submittedAt", ["sourceKind", "submittedAt"]),

  sourceOutputs: defineTable({
    sourceId: v.id("sources"),
    entryId: v.id("knowledgeEntries"),
    outputKind: sourceOutputKind,
    createdAt: v.number(),
  })
    .index("by_sourceId_and_entryId", ["sourceId", "entryId"])
    .index("by_entryId_and_sourceId", ["entryId", "sourceId"]),

  smartStorageContractVersions: defineTable({
    contractKey: v.string(),
    version: v.string(),
    snapshotText: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_contractKey_and_version", ["contractKey", "version"]),

  typeBehaviorSnapshots: defineTable({
    knowledgeType: entryKnowledgeType,
    version: v.string(),
    snapshotText: v.string(),
    behaviorSnapshotJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_knowledgeType_and_version", ["knowledgeType", "version"]),

  humanWeightCalculationDefinitions: defineTable({
    definitionKey: v.string(),
    version: v.string(),
    snapshotText: v.string(),
    definitionJson: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_definitionKey_and_version", ["definitionKey", "version"]),

  // Smart Storage tables preserve model contracts, snapshots, runs, and
  // proposals so model-assisted decisions remain auditable before acceptance.
  smartStorageRuns: defineTable({
    contributionSubmissionId: v.optional(v.id("contributionSubmissions")),
    sourceId: v.id("sources"),
    primarySourceId: v.optional(v.id("sources")),
    status: smartStorageRunStatus,
    requestedKnowledgeType: entryKnowledgeType,
    contributionTitle: v.string(),
    contributionBodyPreview: v.string(),
    contextTags: v.array(smartStorageContextTagSnapshot),
    slotId: v.optional(v.string()),
    smartStorageContractVersionId: v.optional(
      v.id("smartStorageContractVersions"),
    ),
    typeBehaviorSnapshotId: v.optional(v.id("typeBehaviorSnapshots")),
    contractSnapshotVersion: v.optional(v.string()),
    contractSnapshotText: v.optional(v.string()),
    typeBehaviorSnapshotVersion: v.optional(v.string()),
    typeBehaviorSnapshotText: v.optional(v.string()),
    rawModelRequest: v.optional(v.string()),
    rawModelOutput: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_contributionSubmissionId_and_createdAt", [
      "contributionSubmissionId",
      "createdAt",
    ])
    .index("by_sourceId_and_createdAt", ["sourceId", "createdAt"])
    .index("by_createdByUserId_and_createdAt", [
      "createdByUserId",
      "createdAt",
    ])
    .index("by_status_and_createdAt", ["status", "createdAt"]),

  smartStorageProposals: defineTable({
    contributionSubmissionId: v.optional(v.id("contributionSubmissions")),
    sourceId: v.id("sources"),
    smartStorageRunId: v.id("smartStorageRuns"),
    status: smartStorageProposalStatus,
    proposalRole: v.optional(smartStorageProposalRole),
    dependency: v.optional(smartStorageProposalDependency),
    originalProposal: smartStorageProposedEntry,
    currentProposal: smartStorageProposedEntry,
    smartStorageContractVersionId: v.optional(
      v.id("smartStorageContractVersions"),
    ),
    typeBehaviorSnapshotId: v.optional(v.id("typeBehaviorSnapshots")),
    contractSnapshotVersion: v.optional(v.string()),
    contractSnapshotText: v.optional(v.string()),
    typeBehaviorSnapshotVersion: v.optional(v.string()),
    typeBehaviorSnapshotText: v.optional(v.string()),
    createdByUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_contributionSubmissionId_and_status_and_createdAt", [
      "contributionSubmissionId",
      "status",
      "createdAt",
    ])
    .index("by_smartStorageRunId", ["smartStorageRunId"])
    .index("by_sourceId_and_status", ["sourceId", "status"])
    .index("by_createdByUserId_and_status_and_createdAt", [
      "createdByUserId",
      "status",
      "createdAt",
    ]),

  proposalSourceCitations: defineTable({
    proposalId: v.id("smartStorageProposals"),
    sourceId: v.id("sources"),
    citationKind: proposalSourceCitationKind,
    excerptText: v.optional(v.string()),
    locator: v.optional(v.string()),
    externalUrl: v.optional(v.string()),
    rationale: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_proposalId", ["proposalId"])
    .index("by_sourceId", ["sourceId"]),

  smartStoragePlaygroundFeedback: defineTable({
    userId: v.id("users"),
    sourceKind,
    sourceName: v.optional(v.string()),
    sourceText: v.string(),
    sourceSizeBytes: v.number(),
    predictedEntries: v.array(smartStoragePredictedEntry),
    submittedEntry: v.optional(smartStorageSubmittedEntry),
    intendedKnowledgeType: entryKnowledgeType,
    feedbackRating: smartStorageFeedbackRating,
    feedbackNote: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_intendedKnowledgeType_and_createdAt", [
      "intendedKnowledgeType",
      "createdAt",
    ])
    .index("by_feedbackRating_and_createdAt", [
      "feedbackRating",
      "createdAt",
    ]),

  // Human Weight and Context Expertise are derived signals, kept in their own
  // tables to avoid rewriting primary Knowledge Entry rows for every signal.
  humanWeightFeedback: defineTable({
    entryId: v.id("knowledgeEntries"),
    userId: v.id("users"),
    feedbackKind: humanWeightFeedbackKind,
    feedbackNote: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_entryId_and_createdAt", ["entryId", "createdAt"])
    .index("by_userId_and_createdAt", ["userId", "createdAt"])
    .index("by_feedbackKind_and_createdAt", ["feedbackKind", "createdAt"])
    .index("by_entryId_and_userId_and_feedbackKind", [
      "entryId",
      "userId",
      "feedbackKind",
    ]),

  humanWeightEvidence: defineTable({
    entryId: v.id("knowledgeEntries"),
    evidenceKind: humanWeightEvidenceKind,
    evidenceSignal: humanWeightEvidenceSignal,
    slotId: v.id("knowledgeSlots"),
    subjectUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_entryId_and_createdAt", ["entryId", "createdAt"])
    .index("by_slotId", ["slotId"]),

  contextExpertiseEvidence: defineTable({
    subjectUserId: v.optional(v.id("users")),
    subjectPersonReferentId: v.optional(v.id("referents")),
    contextKey: v.string(),
    contextTagIds: v.array(v.id("tags")),
    evidenceKind: contextExpertiseEvidenceKind,
    entryId: v.id("knowledgeEntries"),
    feedbackId: v.optional(v.id("humanWeightFeedback")),
    slotId: v.optional(v.id("knowledgeSlots")),
    smartStorageProposalId: v.optional(v.id("smartStorageProposals")),
    correctionKind: v.optional(contextExpertiseEvidenceCorrectionKind),
    correctedByFeedbackId: v.optional(v.id("humanWeightFeedback")),
    correctedAt: v.optional(v.number()),
    attributionCorrectedFromSubjectUserId: v.optional(v.id("users")),
    attributionCorrectedFromSubjectPersonReferentId: v.optional(
      v.id("referents"),
    ),
    attributionCorrectedByUserId: v.optional(v.id("users")),
    attributionCorrectedAt: v.optional(v.number()),
    visibilityCorrectedFromKind: v.optional(visibilityKind),
    visibilityCorrectedFromTargetKey: v.optional(v.string()),
    visibilityCorrectedByUserId: v.optional(v.id("users")),
    visibilityCorrectedAt: v.optional(v.number()),
    visibilityKind,
    visibilityTargetKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_subjectUserId_and_contextKey_and_createdAt", [
      "subjectUserId",
      "contextKey",
      "createdAt",
    ])
    .index(
      "by_user_context_visibility_target_updatedAt",
      [
        "subjectUserId",
        "contextKey",
        "visibilityKind",
        "visibilityTargetKey",
        "updatedAt",
      ],
    )
    .index("by_subjectPersonReferentId_and_contextKey_and_createdAt", [
      "subjectPersonReferentId",
      "contextKey",
      "createdAt",
    ])
    .index(
      "by_person_context_visibility_target_updatedAt",
      [
        "subjectPersonReferentId",
        "contextKey",
        "visibilityKind",
        "visibilityTargetKey",
        "updatedAt",
      ],
    )
    .index("by_contextKey_and_createdAt", ["contextKey", "createdAt"])
    .index("by_entryId_and_createdAt", ["entryId", "createdAt"])
    .index("by_feedbackId", ["feedbackId"])
    .index("by_slotId", ["slotId"])
    .index("by_smartStorageProposalId", ["smartStorageProposalId"])
    .index("by_evidenceKind_and_createdAt", ["evidenceKind", "createdAt"]),

  contextExpertiseAggregates: defineTable({
    subjectUserId: v.optional(v.id("users")),
    subjectPersonReferentId: v.optional(v.id("referents")),
    contextKey: v.string(),
    contextTagIds: v.array(v.id("tags")),
    contextExpertiseScore: v.number(),
    contextExpertiseMaturity: v.number(),
    evidenceCount: v.number(),
    postCount: v.number(),
    feedbackCount: v.number(),
    latestEvidenceAt: v.number(),
    topSupportingEntryIds: v.array(v.id("knowledgeEntries")),
    visibilityKind,
    visibilityTargetKey: v.string(),
    audienceScopeKind: v.optional(visibilityKind),
    audienceScopeTargetKey: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_subjectUserId_and_contextKey", ["subjectUserId", "contextKey"])
    .index("by_subjectUserId_and_contextExpertiseScore", [
      "subjectUserId",
      "contextExpertiseScore",
    ])
    .index(
      "by_user_context_audience_scope",
      [
        "subjectUserId",
        "contextKey",
        "audienceScopeKind",
        "audienceScopeTargetKey",
      ],
    )
    .index("by_subjectPersonReferentId_and_contextKey", [
      "subjectPersonReferentId",
      "contextKey",
    ])
    .index(
      "by_person_context_audience_scope",
      [
        "subjectPersonReferentId",
        "contextKey",
        "audienceScopeKind",
        "audienceScopeTargetKey",
      ],
    )
    .index("by_contextKey_and_contextExpertiseScore", [
      "contextKey",
      "contextExpertiseScore",
    ])
    .index(
      "by_context_audience_scope_expertise",
      [
        "contextKey",
        "audienceScopeKind",
        "audienceScopeTargetKey",
        "contextExpertiseScore",
      ],
    )
    .index("by_contextKey_and_latestEvidenceAt", [
      "contextKey",
      "latestEvidenceAt",
    ]),

  // Type-detail and representation tables keep per-Knowledge-Type shape out of
  // the shared Knowledge Entry table.
  entryRepresentations: defineTable({
    entryId: v.id("knowledgeEntries"),
    representationKind: entryRepresentationKind,
    representationRole: entryRepresentationRole,
    prosemirrorDocumentId: v.optional(v.string()),
    plainText: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    contentType: v.optional(v.string()),
    languageCode: v.optional(v.string()),
    fileName: v.optional(v.string()),
    fileSizeBytes: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    isPrimary: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_entryId_and_representationKind", [
      "entryId",
      "representationKind",
    ])
    .index("by_entryId_and_isPrimary", ["entryId", "isPrimary"])
    .index("by_storageId", ["storageId"]),

  topicEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
  }).index("by_entryId", ["entryId"]),

  seriesEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    ...literatureDetailFields,
  }).index("by_entryId", ["entryId"]),

  questionEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    questionText: v.string(),
  }).index("by_entryId", ["entryId"]),

  announcementEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    organizationReferentId: v.id("referents"),
  })
    .index("by_entryId", ["entryId"])
    .index("by_organizationReferentId", ["organizationReferentId"]),

  quoteEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    quotedPersonReferentId: v.optional(v.id("referents")),
    sourceEntryId: v.optional(v.id("knowledgeEntries")),
    sourceText: v.optional(v.string()),
    locator: v.optional(v.string()),
  })
    .index("by_entryId", ["entryId"])
    .index("by_quotedPersonReferentId", ["quotedPersonReferentId"])
    .index("by_sourceEntryId", ["sourceEntryId"]),

  sermonEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    preachedAt: v.optional(v.number()),
  })
    .index("by_entryId", ["entryId"])
    .index("by_preachedAt", ["preachedAt"]),

  essayEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    ...literatureDetailFields,
  }).index("by_entryId", ["entryId"]),

  poemEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    ...literatureDetailFields,
  }).index("by_entryId", ["entryId"]),

  songEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    ...literatureDetailFields,
  }).index("by_entryId", ["entryId"]),

  bookEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    ...literatureDetailFields,
    isbn: v.optional(v.string()),
  }).index("by_entryId", ["entryId"]),

  shortStoryEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    ...literatureDetailFields,
  }).index("by_entryId", ["entryId"]),

  lessonEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    plannedDurationMinutes: v.optional(v.number()),
  }).index("by_entryId", ["entryId"]),

  commentEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    parentEntryId: v.id("knowledgeEntries"),
  })
    .index("by_entryId", ["entryId"])
    .index("by_parentEntryId", ["parentEntryId"]),

  prayerRequestEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    prayerStatus,
  })
    .index("by_entryId", ["entryId"])
    .index("by_prayerStatus", ["prayerStatus"]),

  eventEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    startsAt: v.number(),
    endsAt: v.optional(v.number()),
    timeZone: v.optional(v.string()),
    locationPlaceReferentId: v.optional(v.id("referents")),
    locationText: v.optional(v.string()),
  })
    .index("by_entryId", ["entryId"])
    .index("by_startsAt", ["startsAt"])
    .index("by_locationPlaceReferentId_and_startsAt", [
      "locationPlaceReferentId",
      "startsAt",
    ]),

  rsvpEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    eventEntryId: v.id("knowledgeEntries"),
    personReferentId: v.id("referents"),
    response: rsvpResponse,
    respondedAt: v.number(),
  })
    .index("by_entryId", ["entryId"])
    .index("by_eventEntryId_and_personReferentId", [
      "eventEntryId",
      "personReferentId",
    ])
    .index("by_personReferentId_and_respondedAt", [
      "personReferentId",
      "respondedAt",
    ]),

  personEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
  }).index("by_entryId", ["entryId"]),

  organizationEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    organizationKind,
    isActive: v.optional(v.boolean()),
  })
    .index("by_entryId", ["entryId"])
    .index("by_organizationKind", ["organizationKind"]),

  groupEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
  }).index("by_entryId", ["entryId"]),

  placeEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    addressText: v.optional(v.string()),
    locality: v.optional(v.string()),
    region: v.optional(v.string()),
    countryCode: v.optional(v.string()),
  })
    .index("by_entryId", ["entryId"])
    .index("by_locality_and_region_and_countryCode", [
      "locality",
      "region",
      "countryCode",
    ]),

  // Knowledge Slots represent open requests for missing knowledge and connect
  // fulfillment back to entries and human/context expertise evidence.
  knowledgeSlots: defineTable({
    requestedKnowledgeType: entryKnowledgeType,
    status: knowledgeSlotStatus,
    title: v.string(),
    promptText: v.optional(v.string()),
    contextKey: v.string(),
    targetKind: knowledgeSlotTargetKind,
    targetUserId: v.optional(v.id("users")),
    targetPersonReferentId: v.optional(v.id("referents")),
    targetOrganizationReferentId: v.optional(v.id("referents")),
    targetGroupReferentId: v.optional(v.id("referents")),
    fulfilledEntryId: v.optional(v.id("knowledgeEntries")),
    humanWeightExpectation: v.optional(humanWeightExpectation),
    dueAt: v.optional(v.number()),
    createdByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status_and_dueAt", ["status", "dueAt"])
    .index("by_requestedKnowledgeType_and_status", [
      "requestedKnowledgeType",
      "status",
    ])
    .index("by_createdByUserId_and_status", ["createdByUserId", "status"])
    .index("by_targetUserId_and_status_and_dueAt", [
      "targetUserId",
      "status",
      "dueAt",
    ])
    .index("by_targetPersonReferentId_and_status_and_dueAt", [
      "targetPersonReferentId",
      "status",
      "dueAt",
    ])
    .index("by_targetOrganizationReferentId_and_status_and_dueAt", [
      "targetOrganizationReferentId",
      "status",
      "dueAt",
    ])
    .index("by_targetGroupReferentId_and_status_and_dueAt", [
      "targetGroupReferentId",
      "status",
      "dueAt",
    ])
    .index("by_fulfilledEntryId", ["fulfilledEntryId"]),

  slotTags: defineTable({
    slotId: v.id("knowledgeSlots"),
    tagId: v.id("tags"),
    addedAt: v.number(),
  })
    .index("by_slotId_and_tagId", ["slotId", "tagId"])
    .index("by_tagId_and_slotId", ["tagId", "slotId"]),

  seriesItems: defineTable({
    seriesEntryId: v.id("knowledgeEntries"),
    itemKind: seriesItemKind,
    itemEntryId: v.optional(v.id("knowledgeEntries")),
    itemTagId: v.optional(v.id("tags")),
    itemSlotId: v.optional(v.id("knowledgeSlots")),
    position: v.number(),
    label: v.optional(v.string()),
    addedAt: v.number(),
  })
    .index("by_seriesEntryId_and_position", ["seriesEntryId", "position"])
    .index("by_itemEntryId", ["itemEntryId"])
    .index("by_itemTagId", ["itemTagId"])
    .index("by_itemSlotId", ["itemSlotId"]),

  // Scripture tables store normalized structure and verse text separately so
  // passage queries can resolve by ordinal range and translation.
  bibleBooks: defineTable({
    code: v.string(),
    name: v.string(),
    shortName: v.string(),
    testament: v.union(v.literal("old"), v.literal("new")),
    bookOrder: v.number(),
    chapterCount: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_bookOrder", ["bookOrder"]),

  bibleChapters: defineTable({
    bookId: v.id("bibleBooks"),
    bookCode: v.string(),
    chapterNumber: v.number(),
    verseCount: v.number(),
    startOrdinal: v.number(),
    endOrdinal: v.number(),
  })
    .index("by_bookCode_and_chapterNumber", ["bookCode", "chapterNumber"])
    .index("by_bookId_and_chapterNumber", ["bookId", "chapterNumber"]),

  bibleVerses: defineTable({
    bookId: v.id("bibleBooks"),
    bookCode: v.string(),
    chapterNumber: v.number(),
    verseNumber: v.number(),
    ordinal: v.number(),
  })
    .index("by_bookCode_and_chapterNumber_and_verseNumber", [
      "bookCode",
      "chapterNumber",
      "verseNumber",
    ])
    .index("by_bookCode_and_chapterNumber", ["bookCode", "chapterNumber"])
    .index("by_ordinal", ["ordinal"]),

  bibleTranslations: defineTable({
    code: v.string(),
    name: v.string(),
    languageCode: v.string(),
    category: v.union(v.literal("translation"), v.literal("sourceText")),
    textStatus: v.union(v.literal("metadataOnly"), v.literal("available")),
    licenseStatus: v.union(
      v.literal("publicDomain"),
      v.literal("permissionRequired"),
      v.literal("unknown"),
    ),
    licenseNotes: v.optional(v.string()),
  })
    .index("by_code", ["code"])
    .index("by_textStatus_and_code", ["textStatus", "code"]),

  bibleVerseTexts: defineTable({
    translationId: v.id("bibleTranslations"),
    verseId: v.id("bibleVerses"),
    verseOrdinal: v.number(),
    text: v.string(),
  })
    .index("by_translationId_and_verseId", ["translationId", "verseId"])
    .index("by_translationId_and_verseOrdinal", [
      "translationId",
      "verseOrdinal",
    ]),

  // Analytics tables store bounded event rows plus aggregate counters for MVP
  // dashboards and context trend suggestions.
  pageVisitEvents: defineTable({
    pageType,
    targetKind: analyticsTargetKind,
    targetKey: v.string(),
    rawPath: v.string(),
    userId: v.optional(v.id("users")),
    tagId: v.optional(v.id("tags")),
    referentId: v.optional(v.id("referents")),
    visitedAt: v.number(),
  })
    .index("by_targetKind_and_targetKey_and_visitedAt", [
      "targetKind",
      "targetKey",
      "visitedAt",
    ])
    .index("by_userId_and_visitedAt", ["userId", "visitedAt"]),

  pageVisitStats: defineTable({
    pageType,
    targetKind: analyticsTargetKind,
    targetKey: v.string(),
    tagId: v.optional(v.id("tags")),
    referentId: v.optional(v.id("referents")),
    totalVisits: v.number(),
    lastVisitedAt: v.number(),
  })
    .index("by_pageType_and_targetKind_and_targetKey", [
      "pageType",
      "targetKind",
      "targetKey",
    ])
    .index("by_targetKind_and_totalVisits", ["targetKind", "totalVisits"]),

  navigatorUsageEvents: defineTable({
    usageKind: v.union(
      v.literal("select"),
      v.literal("deselect"),
      v.literal("explore"),
      v.literal("contribute"),
    ),
    activeTagIds: v.array(v.id("tags")),
    activeTagCount: v.number(),
    userId: v.optional(v.id("users")),
    occurredAt: v.number(),
  })
    .index("by_userId_and_occurredAt", ["userId", "occurredAt"])
    .index("by_activeTagCount_and_occurredAt", [
      "activeTagCount",
      "occurredAt",
    ]),

  searchEvents: defineTable({
    searchScope,
    searchText: v.string(),
    activeTagKeys: v.array(v.string()),
    activeTagIds: v.array(v.id("tags")),
    activeTagCount: v.number(),
    userId: v.optional(v.id("users")),
    resultCount: v.optional(v.number()),
    searchedAt: v.number(),
  })
    .index("by_userId_and_searchedAt", ["userId", "searchedAt"])
    .index("by_searchScope_and_searchedAt", ["searchScope", "searchedAt"]),
});
