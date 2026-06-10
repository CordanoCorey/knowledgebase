import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const knowledgeType = v.union(
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

const biblePassageRange = v.object({
  startOrdinal: v.number(),
  endOrdinal: v.number(),
});

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
    knowledgeType,
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
    label: v.string(),
    lookupKey: v.string(),
    createdByUserId: v.optional(v.id("users")),
  })
    .index("by_referentId", ["referentId"])
    .index("by_lookupKey", ["lookupKey"]),

  knowledgeEntries: defineTable({
    knowledgeType,
    primaryReferentId: v.id("referents"),
    title: v.string(),
    humanWeight: v.number(),
    createdByUserId: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_primaryReferentId", ["primaryReferentId"])
    .index("by_knowledgeType", ["knowledgeType"])
    .index("by_createdByUserId", ["createdByUserId"]),

  entryTags: defineTable({
    entryId: v.id("knowledgeEntries"),
    tagId: v.id("tags"),
    taggedAt: v.number(),
    taggedByUserId: v.optional(v.id("users")),
  })
    .index("by_entryId_and_tagId", ["entryId", "tagId"])
    .index("by_tagId_and_entryId", ["tagId", "entryId"]),

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
    .index("by_organizationReferentId_and_tagId", [
      "organizationReferentId",
      "tagId",
    ]),

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
