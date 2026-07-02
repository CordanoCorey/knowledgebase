import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { requireAppAccess, type AllowedOrganization } from "./lib/appAccess";
import {
  appendAutomaticContextTags,
  insertEntryContextTags,
} from "./lib/automaticContextTags";
import { recordContextExpertiseEvidence } from "./lib/contextExpertiseEvidence";
import { inferFileRepresentationRoleFromMetadata } from "./lib/fileRepresentationRoles";
import { getApplicableHumanWeight } from "./lib/typeBehavior";

// Direct contributions bypass model proposal generation and write reviewed
// Knowledge Entries immediately from explicit user input.
const MAX_TITLE_LENGTH = 240;
const MAX_BODY_LENGTH = 40_000;
const MAX_PREVIEW_TEXT_LENGTH = 500;
const MAX_SEARCH_TEXT_LENGTH = 2_000;
const MAX_CONTEXT_TAGS = 20;
const MAX_CONTEXT_PREVIEW_TAG_LABELS = 6;
const MAX_CONTEXT_TAG_FIELD_LENGTH = 240;
const MAX_CONTEXT_TAG_HREF_LENGTH = 500;
const MAX_DIRECT_ATTACHMENTS = 20;
const MAX_DIRECT_URL_LENGTH = 2_000;
const MAX_DIRECT_FILE_NAME_LENGTH = 500;
const MAX_DIRECT_CONTENT_TYPE_LENGTH = 120;
const MAX_DIRECT_LANGUAGE_CODE_LENGTH = 35;
const DIRECT_CONTRIBUTION_HUMAN_WEIGHT = 82;
const ANNOUNCEMENT_NOTIFICATION_BATCH_SIZE = 50;

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

const contextTagSnapshot = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  passageString: v.optional(v.string()),
  thumbnailUrl: v.optional(v.string()),
});

const directExternalUrlInput = v.object({
  linkPreviewDescription: v.optional(v.string()),
  linkPreviewImageUrl: v.optional(v.string()),
  linkPreviewSiteName: v.optional(v.string()),
  linkPreviewTitle: v.optional(v.string()),
  title: v.optional(v.string()),
  url: v.string(),
});

const directUploadedFileInput = v.object({
  contentType: v.optional(v.string()),
  fileName: v.string(),
  fileSizeBytes: v.optional(v.number()),
  languageCode: v.optional(v.string()),
  storageId: v.id("_storage"),
  temporaryUploadId: v.optional(v.id("temporaryUploads")),
  title: v.optional(v.string()),
});

const contributorSummary = v.object({
  id: v.string(),
  name: v.string(),
  href: v.optional(v.string()),
});

const knowledgeEntrySummary = v.object({
  contributor: contributorSummary,
  id: v.string(),
  title: v.string(),
  knowledgeType: entryKnowledgeType,
  previewText: v.string(),
  primaryTagLabel: v.string(),
  contextPreviewTagLabels: v.array(v.string()),
  humanWeight: v.optional(v.number()),
  href: v.string(),
  updatedAt: v.number(),
});

type EntryKnowledgeType = Doc<"knowledgeEntries">["knowledgeType"];
type EntryRepresentationRole = Doc<"entryRepresentations">["representationRole"];
type ReferentKnowledgeType = Doc<"referents">["knowledgeType"];
type ContextTagSnapshotInput = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: ReferentKnowledgeType;
  label: string;
  passageString?: string;
  thumbnailUrl?: string;
};
type DirectExternalUrlInput = {
  linkPreviewDescription?: string;
  linkPreviewImageUrl?: string;
  linkPreviewSiteName?: string;
  linkPreviewTitle?: string;
  title?: string;
  url: string;
};
type DirectUploadedFileInput = {
  contentType?: string;
  fileName: string;
  fileSizeBytes?: number;
  languageCode?: string;
  storageId: Id<"_storage">;
  temporaryUploadId?: Id<"temporaryUploads">;
  title?: string;
};
type DirectContributionAccess = Awaited<ReturnType<typeof requireAppAccess>>;
type AnnouncementNotificationBatchInput = {
  body: string;
  contextHref: string;
  contextLabel: string;
  cursor: string | null;
  entryId: Id<"knowledgeEntries">;
  organizationReferentId: Id<"referents">;
  receivedAt: number;
  title: string;
};

export const postDirectContribution = mutation({
  args: {
    body: v.string(),
    contextTags: v.array(contextTagSnapshot),
    externalUrls: v.optional(v.array(directExternalUrlInput)),
    knowledgeType: entryKnowledgeType,
    organizationReferentId: v.optional(v.id("referents")),
    slotId: v.optional(v.string()),
    title: v.string(),
    uploadedFiles: v.optional(v.array(directUploadedFileInput)),
  },
  returns: v.object({
    entry: knowledgeEntrySummary,
    entryId: v.id("knowledgeEntries"),
    primaryTagId: v.id("tags"),
    representedReferentId: v.id("referents"),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const now = Date.now();
    const title = limitString(args.title, MAX_TITLE_LENGTH);
    const body = limitString(args.body, MAX_BODY_LENGTH);
    const announcementOrganization = getAnnouncementOrganization(access, {
      knowledgeType: args.knowledgeType,
      organizationReferentId: args.organizationReferentId,
    });

    if (!title) {
      throw new Error("Contribution title is required.");
    }
    if (args.knowledgeType === "announcement" && !body) {
      throw new Error("Announcement body is required.");
    }

    const slotFulfillment = await resolveSlotFulfillment(ctx, {
      knowledgeType: args.knowledgeType,
      slotId: args.slotId,
    });
    const slotContextTagIds =
      slotFulfillment === undefined
        ? undefined
        : await getSlotContextTagIds(ctx, slotFulfillment._id);
    const represented = await resolveRepresentedIdentity(ctx, {
      knowledgeType: args.knowledgeType,
      now,
      organizationReferentId: announcementOrganization?.organizationReferentId,
      slotId: args.slotId,
      title,
      userId: access.userId,
    });
    const contextTags = await resolveContextTags(
      ctx,
      normalizeContextTags(args.contextTags),
      access.userId,
    );
    const entryContextTags = await appendAutomaticContextTags(ctx, {
      contextTags,
      organizations: getAutomaticContextOrganizations(
        access.organizations,
        announcementOrganization,
      ),
      representedTagId: represented.primaryTagId,
      taggedByUserId: access.userId,
    });
    if (slotFulfillment !== undefined) {
      await assertContributionIncludesSlotTags(
        slotContextTagIds ?? [],
        [
          represented.primaryTagId,
          ...entryContextTags.map((tag) => tag._id),
        ],
      );
    }
    const previewText = buildPreviewText(args.knowledgeType, body);
    const contextPreviewTagLabels = getContextPreviewTagLabels(
      contextTags,
      announcementOrganization,
    );
    const humanWeight = getApplicableHumanWeight(
      args.knowledgeType,
      DIRECT_CONTRIBUTION_HUMAN_WEIGHT,
    );
    const visibility = getDirectContributionVisibility(
      args.knowledgeType,
      announcementOrganization?.organizationReferentId,
    );

    const entryId = await ctx.db.insert("knowledgeEntries", {
      knowledgeType: args.knowledgeType,
      representedReferentId: represented.referentId,
      primaryTagId: represented.primaryTagId,
      title,
      previewText,
      searchText: limitString(
        [title, body, ...entryContextTags.map((tag) => tag.label)].join(" "),
        MAX_SEARCH_TEXT_LENGTH,
      ),
      primaryTagLabel: represented.primaryTagLabel,
      contextPreviewTagLabels,
      ...(humanWeight === undefined ? {} : { humanWeight }),
      visibilityKind: visibility.kind,
      visibilityTargetKey: visibility.targetKey,
      discoverabilityKind: visibility.kind,
      discoverabilityTargetKey: visibility.targetKey,
      publicPreviewText: previewText,
      createdByUserId: access.userId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("entryTags", {
      entryId,
      tagId: represented.primaryTagId,
      tagPurpose: "represented",
      taggedAt: now,
      taggedByUserId: access.userId,
    });

    await insertEntryContextTags(ctx, {
      contextTags: entryContextTags,
      entryId,
      now,
      taggedByUserId: access.userId,
    });

    await insertDirectEntryRepresentations(ctx, {
      body,
      entryId,
      externalUrls: args.externalUrls ?? [],
      now,
      uploadedByUserId: access.userId,
      uploadedFiles: args.uploadedFiles ?? [],
    });

    await recordContextExpertiseEvidence(ctx, {
      contextTagIds: contextTags.map((tag) => tag._id),
      entryId,
      evidenceKind: "post",
      now,
      subjectUserId: access.userId,
    });

    if (args.knowledgeType === "question") {
      await ctx.db.insert("questionEntries", {
        entryId,
        questionText: title,
      });
    }
    if (args.knowledgeType === "announcement") {
      if (announcementOrganization === undefined) {
        throw new Error("Announcement Organization is required.");
      }
      await ctx.db.insert("announcementEntries", {
        entryId,
        organizationReferentId: announcementOrganization.organizationReferentId,
      });
      await deliverAnnouncementNotificationBatch(ctx, {
        body: previewText,
        contextHref: `/entries/${entryId}`,
        contextLabel: announcementOrganization.name,
        cursor: null,
        entryId,
        organizationReferentId: announcementOrganization.organizationReferentId,
        receivedAt: now,
        title,
      });
    }
    if (args.knowledgeType === "quote") {
      const quotedPersonReferentId = await insertQuoteEntry(ctx, {
        contextTags,
        entryId,
        sourceText: body,
      });
      if (quotedPersonReferentId !== undefined) {
        await recordContextExpertiseEvidence(ctx, {
          contextTagIds: contextTags.map((tag) => tag._id),
          entryId,
          evidenceKind: "quoteAttribution",
          now,
          subjectPersonReferentId: quotedPersonReferentId,
        });
      }
    }

    if (slotFulfillment !== undefined) {
      await ctx.db.patch(slotFulfillment._id, {
        fulfilledEntryId: entryId,
        status: "fulfilled",
        updatedAt: now,
      });
      await recordContextExpertiseEvidence(ctx, {
        contextTagIds: slotContextTagIds ?? [],
        entryId,
        evidenceKind: "slotFulfillment",
        now,
        slotId: slotFulfillment._id,
        subjectUserId: access.userId,
      });
      if (humanWeight !== undefined) {
        await recordSlotFulfillmentHumanWeightEvidence(ctx, {
          entryId,
          now,
          slotId: slotFulfillment._id,
          subjectUserId: access.userId,
        });
      }
    }

    const entry = await ctx.db.get(entryId);
    if (!entry) {
      throw new Error("Created Knowledge Entry could not be loaded.");
    }

    return {
      entry: summarizeEntry(entry, await getContributorSummary(ctx, access.userId)),
      entryId,
      primaryTagId: represented.primaryTagId,
      representedReferentId: represented.referentId,
    };
  },
});

export const deliverAnnouncementNotifications = internalMutation({
  args: {
    body: v.string(),
    contextHref: v.string(),
    contextLabel: v.string(),
    cursor: v.union(v.string(), v.null()),
    entryId: v.id("knowledgeEntries"),
    organizationReferentId: v.id("referents"),
    receivedAt: v.number(),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await deliverAnnouncementNotificationBatch(ctx, args);
    return null;
  },
});

function getAnnouncementOrganization(
  access: DirectContributionAccess,
  {
    knowledgeType,
    organizationReferentId,
  }: {
    knowledgeType: EntryKnowledgeType;
    organizationReferentId?: Id<"referents">;
  },
) {
  if (knowledgeType !== "announcement") {
    if (organizationReferentId !== undefined) {
      throw new Error(
        "Organization target is only supported for Announcement contributions.",
      );
    }
    return undefined;
  }

  if (organizationReferentId === undefined) {
    throw new Error("Announcement Organization is required.");
  }

  const organization = access.organizations.find(
    (candidate) =>
      candidate.organizationReferentId === organizationReferentId,
  );
  if (!organization) {
    throw new Error(
      "Announcement Organization must be one of your active Organizations.",
    );
  }

  return organization;
}

function getAutomaticContextOrganizations(
  organizations: AllowedOrganization[],
  preferredOrganization: AllowedOrganization | undefined,
) {
  if (preferredOrganization === undefined) {
    return organizations;
  }

  return [
    preferredOrganization,
    ...organizations.filter(
      (organization) =>
        organization.organizationReferentId !==
        preferredOrganization.organizationReferentId,
    ),
  ];
}

function getContextPreviewTagLabels(
  contextTags: Doc<"tags">[],
  announcementOrganization: AllowedOrganization | undefined,
) {
  const labels = [
    ...(announcementOrganization === undefined
      ? []
      : [announcementOrganization.name]),
    ...contextTags.map((tag) => tag.label),
  ];

  return Array.from(new Set(labels)).slice(0, MAX_CONTEXT_PREVIEW_TAG_LABELS);
}

function getDirectContributionVisibility(
  knowledgeType: EntryKnowledgeType,
  organizationReferentId: Id<"referents"> | undefined,
) {
  if (knowledgeType === "announcement") {
    if (organizationReferentId === undefined) {
      throw new Error("Announcement Organization is required.");
    }
    return {
      kind: "organization" as const,
      targetKey: organizationReferentId,
    };
  }

  return {
    kind: "public" as const,
    targetKey: "public",
  };
}

async function deliverAnnouncementNotificationBatch(
  ctx: MutationCtx,
  input: AnnouncementNotificationBatchInput,
) {
  const membershipsPage = await ctx.db
    .query("memberships")
    .withIndex("by_organizationReferentId_and_membershipStatus", (q) =>
      q
        .eq("organizationReferentId", input.organizationReferentId)
        .eq("membershipStatus", "active"),
    )
    .order("asc")
    .paginate({
      cursor: input.cursor,
      numItems: ANNOUNCEMENT_NOTIFICATION_BATCH_SIZE,
    });
  const notifiedUserIds = new Set<Id<"users">>();

  for (const membership of membershipsPage.page) {
    if (
      membership.targetKind !== "organization" ||
      membership.memberUserId === undefined ||
      notifiedUserIds.has(membership.memberUserId)
    ) {
      continue;
    }

    const user = await ctx.db.get(membership.memberUserId);
    if (!user || user.isActive !== true) {
      continue;
    }

    notifiedUserIds.add(membership.memberUserId);
    await upsertUnreadAnnouncementNotification(ctx, {
      ...input,
      userId: membership.memberUserId,
    });
  }

  if (!membershipsPage.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.directContributions.deliverAnnouncementNotifications,
      {
        ...input,
        cursor: membershipsPage.continueCursor,
      },
    );
  }
}

async function upsertUnreadAnnouncementNotification(
  ctx: MutationCtx,
  input: Omit<AnnouncementNotificationBatchInput, "cursor"> & {
    userId: Id<"users">;
  },
) {
  const sourceSubscriptionKey = getAnnouncementNotificationKey(
    input.entryId,
    input.userId,
  );
  const existingNotification = await ctx.db
    .query("userNotifications")
    .withIndex("by_sourceSubscriptionKey_and_receivedAt", (q) =>
      q.eq("sourceSubscriptionKey", sourceSubscriptionKey),
    )
    .first();
  const notification = {
    body: input.body,
    contextHref: input.contextHref,
    contextLabel: input.contextLabel,
    notificationKind: "announcement" as const,
    notificationStatus: "unread" as const,
    receivedAt: input.receivedAt,
    sourceKind: "announcement" as const,
    sourceSubscriptionKey,
    targetReferentId: input.organizationReferentId,
    title: input.title,
    updatedAt: input.receivedAt,
    userId: input.userId,
  };

  if (existingNotification) {
    const { _creationTime, _id, readAt, ...replacement } =
      existingNotification;
    await ctx.db.replace(_id, {
      ...replacement,
      ...notification,
      createdAt: existingNotification.createdAt,
    });
    return _id;
  }

  return await ctx.db.insert("userNotifications", {
    ...notification,
    createdAt: input.receivedAt,
  });
}

function getAnnouncementNotificationKey(
  entryId: Id<"knowledgeEntries">,
  userId: Id<"users">,
) {
  return `announcement:${entryId}:user:${userId}`;
}

async function insertDirectEntryRepresentations(
  ctx: MutationCtx,
  {
    body,
    entryId,
    externalUrls,
    now,
    uploadedByUserId,
    uploadedFiles,
  }: {
    body: string;
    entryId: Id<"knowledgeEntries">;
    externalUrls: DirectExternalUrlInput[];
    now: number;
    uploadedByUserId: Id<"users">;
    uploadedFiles: DirectUploadedFileInput[];
  },
) {
  if (externalUrls.length + uploadedFiles.length > MAX_DIRECT_ATTACHMENTS) {
    throw new Error(
      `Direct posting supports at most ${MAX_DIRECT_ATTACHMENTS} attachments.`,
    );
  }

  const normalizedExternalUrls = normalizeDirectExternalUrls(externalUrls);
  const normalizedUploadedFiles = normalizeDirectUploadedFiles(uploadedFiles);
  let hasPrimaryRepresentation = false;
  const plainText = body.trim();

  if (plainText) {
    await ctx.db.insert("entryRepresentations", {
      entryId,
      representationKind: "plainText",
      representationRole: "primaryContent",
      plainText,
      isPrimary: true,
      createdAt: now,
      updatedAt: now,
    });
    hasPrimaryRepresentation = true;
  }

  for (const externalUrl of normalizedExternalUrls) {
    const isPrimary = !hasPrimaryRepresentation;
    await ctx.db.insert("entryRepresentations", {
      entryId,
      representationKind: "externalUrl",
      representationRole: isPrimary ? "primaryContent" : "supportingMaterial",
      externalUrl,
      isPrimary,
      createdAt: now,
      updatedAt: now,
    });
    hasPrimaryRepresentation = true;
  }

  for (const uploadedFile of normalizedUploadedFiles) {
    const temporaryUpload = await attachDirectTemporaryUpload(ctx, {
      now,
      uploadedByUserId,
      uploadedFile,
    });
    const attachedUploadedFile = normalizeAttachedDirectUploadedFile(
      uploadedFile,
      temporaryUpload,
    );

    const isPrimary = !hasPrimaryRepresentation;
    await ctx.db.insert("entryRepresentations", {
      entryId,
      representationKind: "storageFile",
      representationRole: isPrimary
        ? "primaryContent"
        : inferStorageFileRepresentationRole(attachedUploadedFile),
      storageId: attachedUploadedFile.storageId,
      fileName: attachedUploadedFile.fileName,
      ...(attachedUploadedFile.contentType === undefined
        ? {}
        : { contentType: attachedUploadedFile.contentType }),
      ...(attachedUploadedFile.fileSizeBytes === undefined
        ? {}
        : { fileSizeBytes: attachedUploadedFile.fileSizeBytes }),
      ...(attachedUploadedFile.languageCode === undefined
        ? {}
        : { languageCode: attachedUploadedFile.languageCode }),
      isPrimary,
      createdAt: now,
      updatedAt: now,
    });
    hasPrimaryRepresentation = true;
  }
}

function normalizeDirectExternalUrls(externalUrls: DirectExternalUrlInput[]) {
  const normalizedUrls = new Map<string, string>();

  for (const externalUrl of externalUrls) {
    const url = normalizeDirectExternalUrl(externalUrl.url);
    normalizedUrls.set(url, url);
  }

  return Array.from(normalizedUrls.values());
}

function normalizeDirectExternalUrl(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    throw new Error("Direct attachment URL is required.");
  }
  if (trimmedValue.length > MAX_DIRECT_URL_LENGTH) {
    throw new Error(
      `Direct attachment URL supports at most ${MAX_DIRECT_URL_LENGTH} characters.`,
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmedValue);
  } catch {
    throw new Error("Direct attachment URL must be valid.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Direct attachment URL must use HTTP or HTTPS.");
  }

  return parsed.href;
}

function normalizeDirectUploadedFiles(uploadedFiles: DirectUploadedFileInput[]) {
  return uploadedFiles.map((uploadedFile) => {
    const fileName = limitString(
      uploadedFile.fileName,
      MAX_DIRECT_FILE_NAME_LENGTH,
    );
    if (!fileName) {
      throw new Error("Direct file attachment name is required.");
    }

    return {
      contentType: limitOptionalString(
        uploadedFile.contentType,
        MAX_DIRECT_CONTENT_TYPE_LENGTH,
      ),
      fileName,
      fileSizeBytes: normalizeOptionalFileSize(uploadedFile.fileSizeBytes),
      languageCode: limitOptionalString(
        uploadedFile.languageCode,
        MAX_DIRECT_LANGUAGE_CODE_LENGTH,
      ),
      storageId: uploadedFile.storageId,
      temporaryUploadId: uploadedFile.temporaryUploadId,
      title: limitOptionalString(uploadedFile.title, MAX_TITLE_LENGTH),
    };
  });
}

async function attachDirectTemporaryUpload(
  ctx: MutationCtx,
  {
    now,
    uploadedByUserId,
    uploadedFile,
  }: {
    now: number;
    uploadedByUserId: Id<"users">;
    uploadedFile: DirectUploadedFileInput;
  },
): Promise<Doc<"temporaryUploads">> {
  if (uploadedFile.temporaryUploadId === undefined) {
    throw new Error("Direct file attachment requires a temporary upload record.");
  }

  const temporaryUpload = await ctx.db.get(uploadedFile.temporaryUploadId);
  if (!temporaryUpload) {
    throw new Error("Temporary upload not found.");
  }
  if (temporaryUpload.uploadedByUserId !== uploadedByUserId) {
    throw new Error("Unauthorized");
  }
  if (temporaryUpload.storageId !== uploadedFile.storageId) {
    throw new Error("Temporary upload storage ID mismatch.");
  }
  if (temporaryUpload.uploadStatus !== "uploaded") {
    throw new Error("Temporary upload is not attachable.");
  }

  await ctx.db.patch(temporaryUpload._id, {
    uploadStatus: "attached",
    updatedAt: now,
  });

  return temporaryUpload;
}

function normalizeAttachedDirectUploadedFile(
  uploadedFile: DirectUploadedFileInput,
  temporaryUpload: Doc<"temporaryUploads">,
): DirectUploadedFileInput {
  const temporaryFileName = limitString(
    temporaryUpload.fileName,
    MAX_DIRECT_FILE_NAME_LENGTH,
  );

  return {
    ...uploadedFile,
    contentType: limitOptionalString(
      temporaryUpload.contentType ?? uploadedFile.contentType,
      MAX_DIRECT_CONTENT_TYPE_LENGTH,
    ),
    fileName: temporaryFileName || uploadedFile.fileName,
    fileSizeBytes: normalizeOptionalFileSize(
      temporaryUpload.fileSizeBytes ?? uploadedFile.fileSizeBytes,
    ),
  };
}

function inferStorageFileRepresentationRole(
  uploadedFile: DirectUploadedFileInput,
): EntryRepresentationRole {
  return inferFileRepresentationRoleFromMetadata(
    uploadedFile.contentType,
    uploadedFile.fileName,
  );
}

async function insertQuoteEntry(
  ctx: MutationCtx,
  {
    contextTags,
    entryId,
    sourceText,
  }: {
    contextTags: Doc<"tags">[];
    entryId: Id<"knowledgeEntries">;
    sourceText: string;
  },
) {
  const quotedPersonReferentId = getUnambiguousQuotedPersonReferentId(
    contextTags,
  );
  const trimmedSourceText = sourceText.trim();

  await ctx.db.insert("quoteEntries", {
    entryId,
    ...(quotedPersonReferentId === undefined
      ? {}
      : { quotedPersonReferentId }),
    ...(trimmedSourceText === "" ? {} : { sourceText: trimmedSourceText }),
  });

  return quotedPersonReferentId;
}

function getUnambiguousQuotedPersonReferentId(contextTags: Doc<"tags">[]) {
  const personTags = contextTags.filter((tag) => tag.knowledgeType === "person");
  return personTags.length === 1 ? personTags[0].referentId : undefined;
}

async function recordSlotFulfillmentHumanWeightEvidence(
  ctx: MutationCtx,
  {
    entryId,
    now,
    slotId,
    subjectUserId,
  }: {
    entryId: Id<"knowledgeEntries">;
    now: number;
    slotId: Id<"knowledgeSlots">;
    subjectUserId: Id<"users">;
  },
) {
  const existing = await ctx.db
    .query("humanWeightEvidence")
    .withIndex("by_slotId", (q) => q.eq("slotId", slotId))
    .first();
  if (existing) {
    if (existing.entryId !== entryId) {
      throw new Error(
        "Slot Fulfillment Human Weight Evidence already points to another Knowledge Entry.",
      );
    }

    await ctx.db.patch(existing._id, {
      subjectUserId,
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("humanWeightEvidence", {
    entryId,
    evidenceKind: "slotFulfillment",
    evidenceSignal: "used",
    slotId,
    subjectUserId,
    createdAt: now,
    updatedAt: now,
  });
}

async function resolveSlotFulfillment(
  ctx: MutationCtx,
  {
    knowledgeType,
    slotId,
  }: {
    knowledgeType: EntryKnowledgeType;
    slotId?: string;
  },
) {
  if (slotId === undefined) {
    return undefined;
  }

  const normalizedSlotId = ctx.db.normalizeId("knowledgeSlots", slotId);
  const slot =
    normalizedSlotId === null ? null : await ctx.db.get(normalizedSlotId);
  if (!slot) {
    throw new Error("Knowledge Slot could not be found.");
  }

  if (slot.requestedKnowledgeType !== knowledgeType) {
    throw new Error("Contribution Knowledge Type must match the Knowledge Slot request.");
  }

  if (slot.fulfilledEntryId !== undefined || slot.status === "fulfilled") {
    throw new Error("Knowledge Slot already has Fulfillment.");
  }

  if (slot.status !== "open" && slot.status !== "overdue") {
    throw new Error("Knowledge Slot is not open for Fulfillment.");
  }

  return slot;
}

async function assertContributionIncludesSlotTags(
  slotContextTagIds: Array<Id<"tags">>,
  contextTagIds: Array<Id<"tags">>,
) {
  const contextTagIdSet = new Set(contextTagIds);
  for (const tagId of slotContextTagIds) {
    if (!contextTagIdSet.has(tagId)) {
      throw new Error("Contribution must include the Knowledge Slot context Tags.");
    }
  }
}

async function getSlotContextTagIds(
  ctx: MutationCtx,
  slotId: Id<"knowledgeSlots">,
) {
  const slotTags = await ctx.db
    .query("slotTags")
    .withIndex("by_slotId_and_tagId", (q) => q.eq("slotId", slotId))
    .take(MAX_CONTEXT_TAGS + 1);

  if (slotTags.length > MAX_CONTEXT_TAGS) {
    throw new Error(`Knowledge Slot supports at most ${MAX_CONTEXT_TAGS} context Tags.`);
  }

  return slotTags.map((slotTag) => slotTag.tagId);
}

async function resolveRepresentedIdentity(
  ctx: MutationCtx,
  identity: {
    knowledgeType: EntryKnowledgeType;
    now: number;
    organizationReferentId?: Id<"referents">;
    slotId?: string;
    title: string;
    userId: Id<"users">;
  },
) {
  const canonicalKey = getRepresentedCanonicalKey(identity);
  const referent =
    (await ctx.db
      .query("referents")
      .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
        q.eq("knowledgeType", identity.knowledgeType).eq("canonicalKey", canonicalKey),
      )
      .first()) ??
    (await insertReferent(ctx, {
      canonicalKey,
      canonicalName: identity.title,
      knowledgeType: identity.knowledgeType,
    }));
  const existingEntry = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", referent._id),
    )
    .first();

  if (existingEntry) {
    throw new Error("A Knowledge Entry already represents this Referent.");
  }

  const primaryTag =
    (await ctx.db
      .query("tags")
      .withIndex("by_referentId", (q) => q.eq("referentId", referent._id))
      .first()) ??
    (await insertTag(ctx, {
      createdByUserId: identity.userId,
      knowledgeType: identity.knowledgeType,
      label: identity.title,
      lookupKey: canonicalKey,
      referentId: referent._id,
    }));

  return {
    primaryTagId: primaryTag._id,
    primaryTagLabel: primaryTag.label,
    referentId: referent._id,
  };
}

async function resolveContextTags(
  ctx: MutationCtx,
  snapshots: ContextTagSnapshotInput[],
  userId: Id<"users">,
) {
  const tags = [];

  for (const snapshot of snapshots) {
    const lookupKey = getContextLookupKey(snapshot);
    const label = limitString(snapshot.label, MAX_CONTEXT_TAG_FIELD_LENGTH);
    const tag =
      (await ctx.db
        .query("tags")
        .withIndex("by_knowledgeType_and_lookupKey", (q) =>
          q.eq("knowledgeType", snapshot.knowledgeType).eq("lookupKey", lookupKey),
        )
        .first()) ??
      (await createContextTag(ctx, {
        canonicalKey: lookupKey,
        createdByUserId: userId,
        knowledgeType: snapshot.knowledgeType,
        label,
        lookupKey,
      }));

    tags.push(tag);
  }

  return tags;
}

async function createContextTag(
  ctx: MutationCtx,
  tag: {
    canonicalKey: string;
    createdByUserId: Id<"users">;
    knowledgeType: ReferentKnowledgeType;
    label: string;
    lookupKey: string;
  },
) {
  const referent =
    (await ctx.db
      .query("referents")
      .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
        q.eq("knowledgeType", tag.knowledgeType).eq("canonicalKey", tag.canonicalKey),
      )
      .first()) ??
    (await insertReferent(ctx, {
      canonicalKey: tag.canonicalKey,
      canonicalName: tag.label,
      knowledgeType: tag.knowledgeType,
    }));

  return await insertTag(ctx, {
    createdByUserId: tag.createdByUserId,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    lookupKey: tag.lookupKey,
    referentId: referent._id,
  });
}

async function insertReferent(
  ctx: MutationCtx,
  referent: {
    canonicalKey: string;
    canonicalName: string;
    knowledgeType: ReferentKnowledgeType;
  },
) {
  const referentId = await ctx.db.insert("referents", referent);
  const inserted = await ctx.db.get(referentId);
  if (!inserted) {
    throw new Error("Created Referent could not be loaded.");
  }
  return inserted;
}

async function insertTag(
  ctx: MutationCtx,
  tag: {
    createdByUserId: Id<"users">;
    knowledgeType: ReferentKnowledgeType;
    label: string;
    lookupKey: string;
    referentId: Id<"referents">;
  },
) {
  const tagId = await ctx.db.insert("tags", tag);
  const inserted = await ctx.db.get(tagId);
  if (!inserted) {
    throw new Error("Created Tag could not be loaded.");
  }
  return inserted;
}

function normalizeContextTags(tags: ContextTagSnapshotInput[]) {
  if (tags.length > MAX_CONTEXT_TAGS) {
    throw new Error(`Direct posting supports at most ${MAX_CONTEXT_TAGS} context Tags.`);
  }

  const uniqueTags = new Map<string, ContextTagSnapshotInput>();
  for (const tag of tags) {
    const normalizedTag = {
      canonicalKey: limitString(tag.canonicalKey, MAX_CONTEXT_TAG_FIELD_LENGTH),
      href: limitString(tag.href, MAX_CONTEXT_TAG_HREF_LENGTH),
      id: limitString(tag.id, MAX_CONTEXT_TAG_FIELD_LENGTH),
      knowledgeType: tag.knowledgeType,
      label: limitString(tag.label, MAX_CONTEXT_TAG_FIELD_LENGTH),
      ...(tag.passageString === undefined
        ? {}
        : {
            passageString: limitString(
              tag.passageString,
              MAX_CONTEXT_TAG_FIELD_LENGTH,
            ),
          }),
    };

    uniqueTags.set(
      `${normalizedTag.knowledgeType}:${getContextLookupKey(normalizedTag)}`,
      normalizedTag,
    );
  }

  return Array.from(uniqueTags.values());
}

function getRepresentedCanonicalKey({
  knowledgeType,
  now,
  organizationReferentId,
  slotId,
  title,
  userId,
}: {
  knowledgeType: EntryKnowledgeType;
  now: number;
  organizationReferentId?: Id<"referents">;
  slotId?: string;
  title: string;
  userId: Id<"users">;
}) {
  const titleKey = normalizeLookupKey(title);
  if (knowledgeType === "comment") {
    const slotKey = slotId ? normalizeLookupKey(slotId) : "no-slot";
    return `direct:${userId}:comment:${slotKey}:${now}`;
  }
  if (knowledgeType === "announcement") {
    return `direct:${userId}:announcement:${organizationReferentId ?? "no-org"}:${titleKey}:${now}`;
  }

  return `direct:${userId}:${knowledgeType}:${titleKey}`;
}

function getContextLookupKey(tag: ContextTagSnapshotInput) {
  return normalizeLookupKey(tag.canonicalKey || tag.id || tag.label);
}

function buildPreviewText(
  knowledgeType: EntryKnowledgeType,
  body: string,
) {
  return limitString(
    body || `Created ${formatKnowledgeTypeLabel(knowledgeType)} entry.`,
    MAX_PREVIEW_TEXT_LENGTH,
  );
}

function summarizeEntry(
  entry: Doc<"knowledgeEntries">,
  contributor: { id: string; name: string },
) {
  const humanWeight = getApplicableHumanWeight(
    entry.knowledgeType,
    entry.humanWeight,
  );

  return {
    contributor,
    id: entry._id,
    title: entry.title,
    knowledgeType: entry.knowledgeType,
    previewText: entry.previewText,
    primaryTagLabel: entry.primaryTagLabel,
    contextPreviewTagLabels: entry.contextPreviewTagLabels,
    ...(humanWeight === undefined ? {} : { humanWeight }),
    href: `/entries/${entry._id}`,
    updatedAt: entry.updatedAt,
  };
}

async function getContributorSummary(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);

  return {
    id: userId,
    name: user ? getUserDisplayName(user) : "Unknown Contributor",
  };
}

function getUserDisplayName(user: Doc<"users">) {
  const name = user.name?.trim();
  if (name) {
    return name;
  }

  if (user.email) {
    return formatEmailDisplayName(user.email);
  }

  return "Unknown Contributor";
}

function formatEmailDisplayName(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const parts = localPart
    .split(/[._+-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return email;
  }

  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatKnowledgeTypeLabel(knowledgeType: EntryKnowledgeType) {
  const labels: Record<EntryKnowledgeType, string> = {
    words: "Words",
    announcement: "Announcement",
    topic: "Topic",
    series: "Series",
    question: "Question",
    quote: "Quote",
    sermon: "Sermon",
    essay: "Essay",
    poem: "Poem",
    song: "Song",
    book: "Book",
    shortStory: "Short Story",
    lesson: "Lesson",
    comment: "Comment",
    prayerRequest: "Prayer Request",
    event: "Event",
    rsvp: "RSVP",
    person: "Person",
    organization: "Organization",
    group: "Group",
    place: "Place",
  };

  return labels[knowledgeType];
}

function normalizeLookupKey(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
}

function limitString(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function limitOptionalString(value: string | undefined, maxLength: number) {
  if (value === undefined) {
    return undefined;
  }

  const limitedValue = limitString(value, maxLength);
  return limitedValue || undefined;
}

function normalizeOptionalFileSize(fileSizeBytes: number | undefined) {
  if (fileSizeBytes === undefined) {
    return undefined;
  }
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes < 0) {
    throw new Error("Direct file attachment size must be non-negative.");
  }

  return Math.floor(fileSizeBytes);
}
