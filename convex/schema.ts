import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const referentKnowledgeType = v.union(
  v.literal("words"),
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

const sourceOutputKind = v.union(
  v.literal("produced"),
  v.literal("derived"),
);

const entryRepresentationKind = v.union(
  v.literal("prosemirror"),
  v.literal("plainText"),
  v.literal("storageFile"),
  v.literal("externalUrl"),
  v.literal("audio"),
  v.literal("video"),
);

const organizationKind = v.union(
  v.literal("school"),
  v.literal("church"),
  v.literal("family"),
  v.literal("community"),
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

export default defineSchema({
  ...authTables,

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

  knowledgeEntries: defineTable({
    knowledgeType: entryKnowledgeType,
    representedReferentId: v.id("referents"),
    primaryTagId: v.id("tags"),
    title: v.string(),
    previewText: v.string(),
    searchText: v.string(),
    primaryTagLabel: v.string(),
    contextPreviewTagLabels: v.array(v.string()),
    humanWeight: v.number(),
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

  memberships: defineTable({
    personReferentId: v.id("referents"),
    memberUserId: v.optional(v.id("users")),
    targetKind: membershipTargetKind,
    organizationReferentId: v.optional(v.id("referents")),
    groupReferentId: v.optional(v.id("referents")),
    membershipStatus,
    memberRole: v.optional(v.string()),
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
    .index("by_organizationReferentId_and_membershipStatus", [
      "organizationReferentId",
      "membershipStatus",
    ])
    .index("by_groupReferentId_and_membershipStatus", [
      "groupReferentId",
      "membershipStatus",
    ]),

  sources: defineTable({
    sourceKind,
    title: v.optional(v.string()),
    rawText: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    contentType: v.optional(v.string()),
    languageCode: v.optional(v.string()),
    submittedByUserId: v.optional(v.id("users")),
    submittedAt: v.number(),
  })
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

  entryRepresentations: defineTable({
    entryId: v.id("knowledgeEntries"),
    representationKind: entryRepresentationKind,
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
  }).index("by_entryId", ["entryId"]),

  questionEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    questionText: v.string(),
  }).index("by_entryId", ["entryId"]),

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
  }).index("by_entryId", ["entryId"]),

  poemEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
  }).index("by_entryId", ["entryId"]),

  songEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
  }).index("by_entryId", ["entryId"]),

  bookEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
    isbn: v.optional(v.string()),
  }).index("by_entryId", ["entryId"]),

  shortStoryEntries: defineTable({
    entryId: v.id("knowledgeEntries"),
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
});
