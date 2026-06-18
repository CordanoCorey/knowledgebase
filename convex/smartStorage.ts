import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalQuery,
  internalMutation,
  mutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAppAccess } from "./lib/appAccess";
import {
  ENTRY_KNOWLEDGE_TYPES,
  getApplicableHumanWeight,
  getTypeBehavior,
  getTypeBehaviorSnapshot,
  type EntryKnowledgeType,
  type RepresentationRole,
} from "./lib/typeBehavior";

const MAX_TITLE_LENGTH = 240;
const MAX_SOURCE_TEXT_LENGTH = 40_000;
const MAX_BODY_PREVIEW_LENGTH = 500;
const MAX_SEARCH_TEXT_LENGTH = 2_000;
const MAX_CONTEXT_TAGS = 20;
const MAX_CONTEXT_PREVIEW_TAG_LABELS = 6;
const MAX_CONTEXT_TAG_FIELD_LENGTH = 240;
const MAX_CONTEXT_TAG_HREF_LENGTH = 500;
const MAX_SLOT_ID_LENGTH = 240;
const MAX_RATIONALE_LENGTH = 500;
const MAX_RAW_MODEL_OUTPUT_LENGTH = 4_000;
const MAX_CONTRIBUTION_NOTE_LENGTH = 2_000;
const MAX_SOURCE_TITLE_LENGTH = 240;
const MAX_URL_LENGTH = 2_000;
const MAX_LINK_PREVIEW_FIELD_LENGTH = 500;
const MAX_LINK_PREVIEW_ERROR_LENGTH = 500;
const MAX_LINK_PREVIEW_RESPONSE_BYTES = 64_000;
const LINK_PREVIEW_FETCH_TIMEOUT_MS = 5_000;
const MAX_FILE_NAME_LENGTH = 500;
const MAX_CONTENT_TYPE_LENGTH = 120;
const MAX_LANGUAGE_CODE_LENGTH = 35;
const MAX_SOURCES_PER_SUBMISSION = 20;
const MAX_SOURCE_CITATION_EXCERPT_LENGTH = 500;
const MAX_SOURCE_CITATION_LOCATOR_LENGTH = 240;
const MAX_TEMPORARY_UPLOAD_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_TEMPORARY_UPLOAD_CLEANUP_BATCH_SIZE = 25;
const DEFAULT_MIGRATION_BATCH_SIZE = 50;
const MAX_MIGRATION_BATCH_SIZE = 100;
const MAX_MIGRATION_PROPOSALS_PER_RUN = 20;
const MAX_MODEL_SOURCE_TEXT_LENGTH = 4_000;
const MAX_MODEL_INPUT_LENGTH = 24_000;
const MAX_MODEL_ERROR_LENGTH = 500;

const SMART_STORAGE_CONTRACT_KEY = "mvp-smart-storage-contract";
const SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION =
  "mvp-smart-storage-contract-v1";
const SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT =
  "Preserve a durable Contribution Submission with child Sources and queue conservative scaffold proposal generation.";
const TYPE_BEHAVIOR_SNAPSHOT_TEXT =
  "Use the first-slice Type Behavior registry for identity, source citation, representation role, primary representation, and Human Weight defaults.";
const DETERMINISTIC_GENERATOR_VERSION = "mvp-deterministic-scaffold-v1";
const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_SMART_STORAGE_MODEL = "gpt-5.4-mini";
const SMART_STORAGE_MODEL_SCHEMA_NAME = "smart_storage_proposal";
const SMART_STORAGE_PROPOSAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "knowledgeType",
    "title",
    "bodyPreview",
    "contextTags",
    "proposalConfidence",
    "rationale",
  ],
  properties: {
    knowledgeType: { type: "string", enum: ENTRY_KNOWLEDGE_TYPES },
    title: { type: "string" },
    bodyPreview: { type: "string" },
    contextTags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "canonicalKey",
          "href",
          "id",
          "knowledgeType",
          "label",
          "passageString",
        ],
        properties: {
          canonicalKey: { type: "string" },
          href: { type: "string" },
          id: { type: "string" },
          knowledgeType: {
            type: "string",
            enum: [...ENTRY_KNOWLEDGE_TYPES, "biblePassage"],
          },
          label: { type: "string" },
          passageString: { type: ["string", "null"] },
        },
      },
    },
    proposalConfidence: { type: "string", enum: ["low", "medium", "high"] },
    rationale: { type: "string" },
  },
} as const;

const entryRepresentationRoleInput = v.union(
  v.literal("unspecified"),
  v.literal("primaryContent"),
  v.literal("manuscript"),
  v.literal("slides"),
  v.literal("transcript"),
  v.literal("recording"),
  v.literal("thumbnail"),
  v.literal("supportingMaterial"),
);

const representationDecisionInput = v.object({
  includeAsRepresentation: v.boolean(),
  isPrimary: v.boolean(),
  representationRole: entryRepresentationRoleInput,
  sourceId: v.id("sources"),
});

type ReferentKnowledgeType =
  | EntryKnowledgeType
  | "biblePassage";

type ContextTagSnapshotInput = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: ReferentKnowledgeType;
  label: string;
  passageString?: string;
};
type SmartStorageProposedEntryDoc = Doc<"smartStorageProposals">["currentProposal"];
type LegacyEntryRepresentation = Omit<
  Doc<"entryRepresentations">,
  "representationRole"
> & {
  representationRole?: RepresentationRole;
};
type RepresentationDecisionInput = {
  includeAsRepresentation: boolean;
  isPrimary: boolean;
  representationRole: RepresentationRole;
  sourceId: Id<"sources">;
};
type AcceptedRepresentationDecision = {
  isPrimary: boolean;
  representationRole: RepresentationRole;
  source: Doc<"sources">;
};
type ModelRunExecutionInput = {
  contributionSubmission?: {
    contributionNote?: string;
    id: Id<"contributionSubmissions">;
    intendedVisibilityKind: Doc<"contributionSubmissions">["intendedVisibilityKind"];
    intendedVisibilityTargetKey: string;
    primaryIntendedBodyPreview: string;
    primaryIntendedKnowledgeType: EntryKnowledgeType;
    primaryIntendedTitle: string;
    reviewScopeKind: Doc<"contributionSubmissions">["reviewScopeKind"];
    reviewScopeTargetKey: string;
  };
  existingProposal?: {
    smartStorageProposalId: Id<"smartStorageProposals">;
  };
  run: {
    contextTags: ContextTagSnapshotInput[];
    contractSnapshotText?: string;
    contractSnapshotVersion?: string;
    contributionBodyPreview: string;
    contributionTitle: string;
    id: Id<"smartStorageRuns">;
    requestedKnowledgeType: EntryKnowledgeType;
    slotId?: string;
    smartStorageContractVersionId?: Id<"smartStorageContractVersions">;
    status: Doc<"smartStorageRuns">["status"];
    typeBehaviorSnapshotId?: Id<"typeBehaviorSnapshots">;
    typeBehaviorSnapshotText?: string;
    typeBehaviorSnapshotVersion?: string;
  };
  sources: Array<{
    id: Id<"sources">;
    contentType?: string;
    externalUrl?: string;
    fileName?: string;
    fileSizeBytes?: number;
    languageCode?: string;
    linkPreviewDescription?: string;
    linkPreviewSiteName?: string;
    linkPreviewStatus?: Doc<"sources">["linkPreviewStatus"];
    linkPreviewTitle?: string;
    rawText?: string;
    sourceKind: Doc<"sources">["sourceKind"];
    title?: string;
  }>;
};
type ModelRunExecutionResult = {
  executionStatus: "proposalCreated" | "existingProposal" | "failed" | "noProposal";
  errorMessage?: string;
  smartStorageProposalId?: Id<"smartStorageProposals">;
  smartStorageRunId: Id<"smartStorageRuns">;
  status: "drafted" | "failed" | "noProposal";
};

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

const visibilityKind = v.union(
  v.literal("private"),
  v.literal("organization"),
  v.literal("group"),
  v.literal("public"),
);

const sourceKind = v.union(
  v.literal("pastedText"),
  v.literal("uploadedFile"),
  v.literal("externalUrl"),
  v.literal("manualEntry"),
);

const reviewScopeKind = v.union(
  v.literal("private"),
  v.literal("organization"),
  v.literal("group"),
  v.literal("public"),
);

const contextTagSnapshot = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  passageString: v.optional(v.string()),
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
  contextTags: v.array(contextTagSnapshot),
  proposalConfidence,
  rationale: v.string(),
});

const contributionUploadedFile = v.object({
  temporaryUploadId: v.optional(v.id("temporaryUploads")),
  storageId: v.id("_storage"),
  fileName: v.string(),
  contentType: v.optional(v.string()),
  fileSizeBytes: v.optional(v.number()),
  languageCode: v.optional(v.string()),
  title: v.optional(v.string()),
});

const contributionExternalUrl = v.object({
  url: v.string(),
  title: v.optional(v.string()),
  linkPreviewTitle: v.optional(v.string()),
  linkPreviewDescription: v.optional(v.string()),
  linkPreviewImageUrl: v.optional(v.string()),
  linkPreviewSiteName: v.optional(v.string()),
});

const proposalSourceCitationKind = v.union(
  v.literal("wholeSource"),
  v.literal("textExcerpt"),
  v.literal("fileLocator"),
  v.literal("externalUrl"),
);

const proposalSourceCitationSummary = v.object({
  citationKind: proposalSourceCitationKind,
  excerptText: v.optional(v.string()),
  externalUrl: v.optional(v.string()),
  id: v.id("proposalSourceCitations"),
  locator: v.optional(v.string()),
  rationale: v.optional(v.string()),
  sourceId: v.id("sources"),
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

const temporaryUploadCleanupStatus = v.union(
  v.literal("deleted"),
  v.literal("notExpired"),
  v.literal("notFound"),
  v.literal("skipped"),
);

const temporaryUploadCleanupResult = v.object({
  cleanupStatus: temporaryUploadCleanupStatus,
});

const migrationCursor = v.union(v.string(), v.null());

const migrationPageResult = v.object({
  dryRun: v.boolean(),
  scannedCount: v.number(),
  matchedCount: v.number(),
  updatedCount: v.number(),
  nextCursor: migrationCursor,
  isDone: v.boolean(),
});

const parentLinkAuditPage = v.object({
  scannedCount: v.number(),
  missingContributionSubmissionIdCount: v.number(),
  nextCursor: migrationCursor,
  isDone: v.boolean(),
});

const parentLinkBackfillResult = v.object({
  dryRun: v.boolean(),
  scannedRunCount: v.number(),
  createdSubmissionCount: v.number(),
  attachedExistingSubmissionCount: v.number(),
  sourcePatchCount: v.number(),
  runPatchCount: v.number(),
  proposalPatchCount: v.number(),
  conflictingParentCount: v.number(),
  missingSourceCount: v.number(),
  nextCursor: migrationCursor,
  isDone: v.boolean(),
});

const modelRunExecutionStatus = v.union(
  v.literal("proposalCreated"),
  v.literal("existingProposal"),
  v.literal("failed"),
  v.literal("noProposal"),
);

const modelRunExecutionResult = v.object({
  executionStatus: modelRunExecutionStatus,
  errorMessage: v.optional(v.string()),
  smartStorageProposalId: v.optional(v.id("smartStorageProposals")),
  smartStorageRunId: v.id("smartStorageRuns"),
  status: v.union(
    v.literal("drafted"),
    v.literal("failed"),
    v.literal("noProposal"),
  ),
});

const modelRunExecutionSource = v.object({
  id: v.id("sources"),
  contentType: v.optional(v.string()),
  externalUrl: v.optional(v.string()),
  fileName: v.optional(v.string()),
  fileSizeBytes: v.optional(v.number()),
  languageCode: v.optional(v.string()),
  linkPreviewDescription: v.optional(v.string()),
  linkPreviewSiteName: v.optional(v.string()),
  linkPreviewStatus: v.optional(
    v.union(
      v.literal("notFetched"),
      v.literal("queued"),
      v.literal("fetched"),
      v.literal("failed"),
    ),
  ),
  linkPreviewTitle: v.optional(v.string()),
  rawText: v.optional(v.string()),
  sourceKind,
  title: v.optional(v.string()),
});

const modelRunExecutionInput = v.object({
  contributionSubmission: v.optional(
    v.object({
      contributionNote: v.optional(v.string()),
      id: v.id("contributionSubmissions"),
      intendedVisibilityKind: visibilityKind,
      intendedVisibilityTargetKey: v.string(),
      primaryIntendedBodyPreview: v.string(),
      primaryIntendedKnowledgeType: entryKnowledgeType,
      primaryIntendedTitle: v.string(),
      reviewScopeKind,
      reviewScopeTargetKey: v.string(),
    }),
  ),
  existingProposal: v.optional(
    v.object({
      smartStorageProposalId: v.id("smartStorageProposals"),
    }),
  ),
  run: v.object({
    contextTags: v.array(contextTagSnapshot),
    contractSnapshotText: v.optional(v.string()),
    contractSnapshotVersion: v.optional(v.string()),
    contributionBodyPreview: v.string(),
    contributionTitle: v.string(),
    id: v.id("smartStorageRuns"),
    requestedKnowledgeType: entryKnowledgeType,
    slotId: v.optional(v.string()),
    smartStorageContractVersionId: v.optional(
      v.id("smartStorageContractVersions"),
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("noProposal"),
      v.literal("failed"),
      v.literal("superseded"),
    ),
    typeBehaviorSnapshotId: v.optional(v.id("typeBehaviorSnapshots")),
    typeBehaviorSnapshotText: v.optional(v.string()),
    typeBehaviorSnapshotVersion: v.optional(v.string()),
  }),
  sources: v.array(modelRunExecutionSource),
});

export const createTemporaryUploadRecord = mutation({
  args: {
    contentType: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    fileName: v.string(),
    fileSizeBytes: v.optional(v.number()),
    storageId: v.id("_storage"),
  },
  returns: v.object({
    temporaryUploadId: v.id("temporaryUploads"),
    uploadStatus: v.literal("uploaded"),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const now = Date.now();
    const expiresAt = args.expiresAt ?? now + MAX_TEMPORARY_UPLOAD_AGE_MS;
    const temporaryUploadId = await ctx.db.insert("temporaryUploads", {
      storageId: args.storageId,
      uploadedByUserId: access.userId,
      fileName: limitString(args.fileName, MAX_FILE_NAME_LENGTH),
      ...(args.contentType === undefined
        ? {}
        : { contentType: limitString(args.contentType, MAX_CONTENT_TYPE_LENGTH) }),
      ...(args.fileSizeBytes === undefined
        ? {}
        : { fileSizeBytes: args.fileSizeBytes }),
      uploadStatus: "uploaded",
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAt(
      expiresAt,
      internal.smartStorage.cleanupTemporaryUpload,
      { temporaryUploadId },
    );

    return {
      temporaryUploadId,
      uploadStatus: "uploaded" as const,
    };
  },
});

export const executeModelRun = action({
  args: {
    smartStorageRunId: v.id("smartStorageRuns"),
  },
  returns: modelRunExecutionResult,
  handler: async (ctx, args): Promise<ModelRunExecutionResult> => {
    const executionInput: ModelRunExecutionInput = await ctx.runQuery(
      internal.smartStorage.loadModelRunExecutionInput,
      { smartStorageRunId: args.smartStorageRunId },
    );
    if (executionInput.existingProposal !== undefined) {
      return {
        executionStatus: "existingProposal" as const,
        smartStorageProposalId:
          executionInput.existingProposal.smartStorageProposalId,
        smartStorageRunId: executionInput.run.id,
        status: "drafted" as const,
      };
    }

    const apiKey = getOpenAiApiKey();
    if (!apiKey) {
      return await ctx.runMutation(internal.smartStorage.failModelRun, {
        errorMessage: "OPENAI_API_KEY is not configured.",
        smartStorageRunId: args.smartStorageRunId,
      });
    }

    await ctx.runMutation(internal.smartStorage.markModelRunRunning, {
      smartStorageRunId: args.smartStorageRunId,
    });

    try {
      const response = await fetch(OPENAI_RESPONSES_API_URL, {
        body: JSON.stringify(buildOpenAiSmartStorageRequest(executionInput)),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const rawResponseText = limitString(
        await response.text(),
        MAX_RAW_MODEL_OUTPUT_LENGTH,
      );
      if (!response.ok) {
        return await ctx.runMutation(internal.smartStorage.failModelRun, {
          errorMessage: `OpenAI Responses API failed with ${response.status}.`,
          rawModelOutput: rawResponseText,
          smartStorageRunId: args.smartStorageRunId,
        });
      }

      const modelText = extractOpenAiResponseText(rawResponseText);
      if (!modelText) {
        return await ctx.runMutation(internal.smartStorage.completeModelRunNoProposal, {
          errorMessage: "OpenAI response did not include proposal content.",
          rawModelOutput: rawResponseText,
          smartStorageRunId: args.smartStorageRunId,
        });
      }

      const proposal = parseModelProposal(modelText);
      if (proposal.kind === "error") {
        return await ctx.runMutation(internal.smartStorage.failModelRun, {
          errorMessage: proposal.message,
          rawModelOutput: rawResponseText,
          smartStorageRunId: args.smartStorageRunId,
        });
      }

      return await ctx.runMutation(
        internal.smartStorage.completeModelRunWithProposal,
        {
          proposal: proposal.proposal,
          rawModelOutput: rawResponseText,
          smartStorageRunId: args.smartStorageRunId,
        },
      );
    } catch (error) {
      return await ctx.runMutation(internal.smartStorage.failModelRun, {
        errorMessage: getModelExecutionErrorMessage(error),
        smartStorageRunId: args.smartStorageRunId,
      });
    }
  },
});

export const fetchLinkPreviewForSource = internalAction({
  args: {
    sourceId: v.id("sources"),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const safeUrl = getSafeLinkPreviewUrl(args.url);
    if (safeUrl.kind === "error") {
      const result: null = await ctx.runMutation(
        internal.smartStorage.markLinkPreviewFailed,
        {
          error: safeUrl.message,
          fetchedAt: Date.now(),
          sourceId: args.sourceId,
          url: args.url,
        },
      );
      return result;
    }

    try {
      const metadata = await fetchLinkPreviewMetadata(safeUrl.url);
      const result: null = await ctx.runMutation(
        internal.smartStorage.markLinkPreviewFetched,
        {
          ...metadata,
          fetchedAt: Date.now(),
          sourceId: args.sourceId,
          url: args.url,
        },
      );
      return result;
    } catch (error) {
      const result: null = await ctx.runMutation(
        internal.smartStorage.markLinkPreviewFailed,
        {
          error: getPreviewErrorMessage(error),
          fetchedAt: Date.now(),
          sourceId: args.sourceId,
          url: args.url,
        },
      );
      return result;
    }
  },
});

export const markLinkPreviewFetched = internalMutation({
  args: {
    description: v.optional(v.string()),
    fetchedAt: v.number(),
    imageUrl: v.optional(v.string()),
    siteName: v.optional(v.string()),
    sourceId: v.id("sources"),
    title: v.optional(v.string()),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (
      !source ||
      source.sourceKind !== "externalUrl" ||
      source.externalUrl !== args.url
    ) {
      return null;
    }

    await ctx.db.patch(source._id, {
      linkPreviewStatus: "fetched",
      linkPreviewFetchedAt: args.fetchedAt,
      ...(args.title === undefined
        ? {}
        : {
            linkPreviewTitle: limitString(
              args.title,
              MAX_LINK_PREVIEW_FIELD_LENGTH,
            ),
          }),
      ...(args.description === undefined
        ? {}
        : {
            linkPreviewDescription: limitString(
              args.description,
              MAX_LINK_PREVIEW_FIELD_LENGTH,
            ),
          }),
      ...(args.imageUrl === undefined
        ? {}
        : { linkPreviewImageUrl: limitString(args.imageUrl, MAX_URL_LENGTH) }),
      ...(args.siteName === undefined
        ? {}
        : {
            linkPreviewSiteName: limitString(
              args.siteName,
              MAX_LINK_PREVIEW_FIELD_LENGTH,
            ),
          }),
    });

    return null;
  },
});

export const markLinkPreviewFailed = internalMutation({
  args: {
    error: v.string(),
    fetchedAt: v.number(),
    sourceId: v.id("sources"),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (
      !source ||
      source.sourceKind !== "externalUrl" ||
      source.externalUrl !== args.url
    ) {
      return null;
    }

    await ctx.db.patch(source._id, {
      linkPreviewStatus: "failed",
      linkPreviewError: limitString(args.error, MAX_LINK_PREVIEW_ERROR_LENGTH),
      linkPreviewFetchedAt: args.fetchedAt,
    });

    return null;
  },
});

export const loadModelRunExecutionInput = internalQuery({
  args: {
    smartStorageRunId: v.id("smartStorageRuns"),
  },
  returns: modelRunExecutionInput,
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const run = await ctx.db.get(args.smartStorageRunId);
    if (!run) {
      throw new Error("Smart Storage Run not found.");
    }
    if (run.createdByUserId !== access.userId) {
      throw new Error("Unauthorized");
    }

    const existingProposal = await ctx.db
      .query("smartStorageProposals")
      .withIndex("by_smartStorageRunId", (q) =>
        q.eq("smartStorageRunId", args.smartStorageRunId),
      )
      .unique();
    const contributionSubmission =
      run.contributionSubmissionId === undefined
        ? null
        : await ctx.db.get(run.contributionSubmissionId);
    const sources = await listRunSources(ctx, run);

    return {
      ...(contributionSubmission === null
        ? {}
        : {
            contributionSubmission: {
              ...(contributionSubmission.contributionNote === undefined
                ? {}
                : { contributionNote: contributionSubmission.contributionNote }),
              id: contributionSubmission._id,
              intendedVisibilityKind:
                contributionSubmission.intendedVisibilityKind,
              intendedVisibilityTargetKey:
                contributionSubmission.intendedVisibilityTargetKey,
              primaryIntendedBodyPreview:
                contributionSubmission.primaryIntendedBodyPreview,
              primaryIntendedKnowledgeType:
                contributionSubmission.primaryIntendedKnowledgeType,
              primaryIntendedTitle:
                contributionSubmission.primaryIntendedTitle,
              reviewScopeKind: contributionSubmission.reviewScopeKind,
              reviewScopeTargetKey: contributionSubmission.reviewScopeTargetKey,
            },
          }),
      ...(existingProposal === null
        ? {}
        : {
            existingProposal: {
              smartStorageProposalId: existingProposal._id,
            },
          }),
      run: {
        contextTags: run.contextTags,
        ...(run.contractSnapshotText === undefined
          ? {}
          : { contractSnapshotText: run.contractSnapshotText }),
        ...(run.contractSnapshotVersion === undefined
          ? {}
          : { contractSnapshotVersion: run.contractSnapshotVersion }),
        contributionBodyPreview: run.contributionBodyPreview,
        contributionTitle: run.contributionTitle,
        id: run._id,
        requestedKnowledgeType: run.requestedKnowledgeType,
        ...(run.slotId === undefined ? {} : { slotId: run.slotId }),
        ...(run.smartStorageContractVersionId === undefined
          ? {}
          : {
              smartStorageContractVersionId:
                run.smartStorageContractVersionId,
            }),
        status: run.status,
        ...(run.typeBehaviorSnapshotId === undefined
          ? {}
          : { typeBehaviorSnapshotId: run.typeBehaviorSnapshotId }),
        ...(run.typeBehaviorSnapshotText === undefined
          ? {}
          : { typeBehaviorSnapshotText: run.typeBehaviorSnapshotText }),
        ...(run.typeBehaviorSnapshotVersion === undefined
          ? {}
          : { typeBehaviorSnapshotVersion: run.typeBehaviorSnapshotVersion }),
      },
      sources: sources.map((source) => ({
        id: source._id,
        ...(source.contentType === undefined
          ? {}
          : { contentType: source.contentType }),
        ...(source.externalUrl === undefined
          ? {}
          : { externalUrl: source.externalUrl }),
        ...(source.fileName === undefined ? {} : { fileName: source.fileName }),
        ...(source.fileSizeBytes === undefined
          ? {}
          : { fileSizeBytes: source.fileSizeBytes }),
        ...(source.languageCode === undefined
          ? {}
          : { languageCode: source.languageCode }),
        ...(source.linkPreviewDescription === undefined
          ? {}
          : { linkPreviewDescription: source.linkPreviewDescription }),
        ...(source.linkPreviewSiteName === undefined
          ? {}
          : { linkPreviewSiteName: source.linkPreviewSiteName }),
        ...(source.linkPreviewStatus === undefined
          ? {}
          : { linkPreviewStatus: source.linkPreviewStatus }),
        ...(source.linkPreviewTitle === undefined
          ? {}
          : { linkPreviewTitle: source.linkPreviewTitle }),
        ...(source.rawText === undefined ? {} : { rawText: source.rawText }),
        sourceKind: source.sourceKind,
        ...(source.title === undefined ? {} : { title: source.title }),
      })),
    };
  },
});

export const markModelRunRunning = internalMutation({
  args: {
    smartStorageRunId: v.id("smartStorageRuns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.smartStorageRunId);
    if (!run) {
      throw new Error("Smart Storage Run not found.");
    }
    if (run.status === "running") {
      return null;
    }
    if (run.status !== "queued") {
      throw new Error("Smart Storage Run is not queued.");
    }

    await ctx.db.patch(run._id, {
      status: "running",
      updatedAt: Date.now(),
    });

    return null;
  },
});

export const failModelRun = internalMutation({
  args: {
    errorMessage: v.string(),
    rawModelOutput: v.optional(v.string()),
    smartStorageRunId: v.id("smartStorageRuns"),
  },
  returns: modelRunExecutionResult,
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.smartStorageRunId);
    if (!run) {
      throw new Error("Smart Storage Run not found.");
    }

    const now = Date.now();
    await ctx.db.patch(run._id, {
      status: "failed",
      errorMessage: limitString(args.errorMessage, MAX_MODEL_ERROR_LENGTH),
      ...(args.rawModelOutput === undefined
        ? {}
        : {
            rawModelOutput: limitString(
              args.rawModelOutput,
              MAX_RAW_MODEL_OUTPUT_LENGTH,
            ),
          }),
      updatedAt: now,
      completedAt: now,
    });
    await markSubmissionReviewReadyIfPresent(ctx, run);

    return {
      executionStatus: "failed" as const,
      errorMessage: limitString(args.errorMessage, MAX_MODEL_ERROR_LENGTH),
      smartStorageRunId: run._id,
      status: "failed" as const,
    };
  },
});

export const completeModelRunNoProposal = internalMutation({
  args: {
    errorMessage: v.optional(v.string()),
    rawModelOutput: v.optional(v.string()),
    smartStorageRunId: v.id("smartStorageRuns"),
  },
  returns: modelRunExecutionResult,
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.smartStorageRunId);
    if (!run) {
      throw new Error("Smart Storage Run not found.");
    }

    const now = Date.now();
    await ctx.db.patch(run._id, {
      status: "noProposal",
      ...(args.errorMessage === undefined
        ? {}
        : { errorMessage: limitString(args.errorMessage, MAX_MODEL_ERROR_LENGTH) }),
      ...(args.rawModelOutput === undefined
        ? {}
        : {
            rawModelOutput: limitString(
              args.rawModelOutput,
              MAX_RAW_MODEL_OUTPUT_LENGTH,
            ),
          }),
      updatedAt: now,
      completedAt: now,
    });
    await markSubmissionReviewReadyIfPresent(ctx, run);

    return {
      executionStatus: "noProposal" as const,
      ...(args.errorMessage === undefined
        ? {}
        : { errorMessage: limitString(args.errorMessage, MAX_MODEL_ERROR_LENGTH) }),
      smartStorageRunId: run._id,
      status: "noProposal" as const,
    };
  },
});

export const completeModelRunWithProposal = internalMutation({
  args: {
    proposal: smartStorageProposedEntry,
    rawModelOutput: v.string(),
    smartStorageRunId: v.id("smartStorageRuns"),
  },
  returns: modelRunExecutionResult,
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.smartStorageRunId);
    if (!run) {
      throw new Error("Smart Storage Run not found.");
    }
    const existingProposal = await ctx.db
      .query("smartStorageProposals")
      .withIndex("by_smartStorageRunId", (q) =>
        q.eq("smartStorageRunId", args.smartStorageRunId),
      )
      .unique();
    if (existingProposal) {
      return {
        executionStatus: "existingProposal" as const,
        smartStorageProposalId: existingProposal._id,
        smartStorageRunId: run._id,
        status: "drafted" as const,
      };
    }
    if (run.status !== "running") {
      throw new Error("Smart Storage Run is not running.");
    }
    if (run.contributionSubmissionId === undefined) {
      throw new Error(
        "Smart Storage Run must be linked to a Contribution Submission before generating a Proposal.",
      );
    }

    const now = Date.now();
    const primarySourceId = run.primarySourceId ?? run.sourceId;
    const sources = await listRunSources(ctx, run);
    const normalizedProposal = normalizeModelProposal(args.proposal);
    const smartStorageProposalId = await ctx.db.insert(
      "smartStorageProposals",
      {
        contributionSubmissionId: run.contributionSubmissionId,
        sourceId: primarySourceId,
        smartStorageRunId: run._id,
        status: "drafted",
        originalProposal: normalizedProposal,
        currentProposal: cloneDraftProposal(normalizedProposal),
        ...(run.smartStorageContractVersionId === undefined
          ? {}
          : {
              smartStorageContractVersionId:
                run.smartStorageContractVersionId,
            }),
        ...(run.typeBehaviorSnapshotId === undefined
          ? {}
          : { typeBehaviorSnapshotId: run.typeBehaviorSnapshotId }),
        ...(run.contractSnapshotVersion === undefined
          ? {}
          : { contractSnapshotVersion: run.contractSnapshotVersion }),
        ...(run.contractSnapshotText === undefined
          ? {}
          : { contractSnapshotText: run.contractSnapshotText }),
        ...(run.typeBehaviorSnapshotVersion === undefined
          ? {}
          : { typeBehaviorSnapshotVersion: run.typeBehaviorSnapshotVersion }),
        ...(run.typeBehaviorSnapshotText === undefined
          ? {}
          : { typeBehaviorSnapshotText: run.typeBehaviorSnapshotText }),
        createdByUserId: run.createdByUserId,
        createdAt: now,
        updatedAt: now,
      },
    );
    await insertProposalSourceCitations(ctx, {
      createdAt: now,
      proposalId: smartStorageProposalId,
      sources,
    });

    await ctx.db.patch(run._id, {
      status: "succeeded",
      rawModelOutput: limitString(
        args.rawModelOutput,
        MAX_RAW_MODEL_OUTPUT_LENGTH,
      ),
      updatedAt: now,
      completedAt: now,
    });
    await ctx.db.patch(run.contributionSubmissionId, {
      submissionStatus: "reviewReady",
      updatedAt: now,
    });

    return {
      executionStatus: "proposalCreated" as const,
      smartStorageProposalId,
      smartStorageRunId: run._id,
      status: "drafted" as const,
    };
  },
});

export const cleanupTemporaryUpload = internalMutation({
  args: {
    temporaryUploadId: v.id("temporaryUploads"),
  },
  returns: temporaryUploadCleanupResult,
  handler: async (ctx, args) => {
    const temporaryUpload = await ctx.db.get(args.temporaryUploadId);
    if (!temporaryUpload) {
      return { cleanupStatus: "notFound" as const };
    }

    return await cleanupTemporaryUploadRow(ctx, temporaryUpload, Date.now());
  },
});

export const cleanupExpiredTemporaryUploadsBatch = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deletedCount: v.number(),
    processedCount: v.number(),
    rescheduled: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const batchSize = clampBatchSize(args.batchSize);
    const expiredUploads = await ctx.db
      .query("temporaryUploads")
      .withIndex("by_uploadStatus_and_expiresAt", (q) =>
        q.eq("uploadStatus", "uploaded").lte("expiresAt", now),
      )
      .take(batchSize);
    let deletedCount = 0;

    for (const temporaryUpload of expiredUploads) {
      const result = await cleanupTemporaryUploadRow(
        ctx,
        temporaryUpload,
        now,
      );
      if (result.cleanupStatus === "deleted") {
        deletedCount += 1;
      }
    }

    const rescheduled = expiredUploads.length === batchSize;
    if (rescheduled) {
      await ctx.scheduler.runAfter(
        0,
        internal.smartStorage.cleanupExpiredTemporaryUploadsBatch,
        { batchSize },
      );
    }

    return {
      deletedCount,
      processedCount: expiredUploads.length,
      rescheduled,
    };
  },
});

export const backfillMissingRepresentationRoles = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(migrationCursor),
    dryRun: v.optional(v.boolean()),
  },
  returns: migrationPageResult,
  handler: async (ctx, args) => {
    const batchSize = normalizeMigrationBatchSize(args.batchSize);
    const dryRun = args.dryRun ?? false;
    const page = await ctx.db
      .query("entryRepresentations")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: batchSize,
      });

    let matchedCount = 0;
    let updatedCount = 0;
    for (const row of page.page) {
      const legacyRow = row as LegacyEntryRepresentation;
      if (legacyRow.representationRole !== undefined) {
        continue;
      }

      matchedCount += 1;
      if (!dryRun) {
        await ctx.db.patch(row._id, {
          representationRole: inferRepresentationRoleForMigration(legacyRow),
        });
        updatedCount += 1;
      }
    }

    return {
      dryRun,
      scannedCount: page.page.length,
      matchedCount,
      updatedCount,
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const auditLegacySmartStorageParentLinks = internalQuery({
  args: {
    batchSize: v.optional(v.number()),
    proposalCursor: v.optional(migrationCursor),
    runCursor: v.optional(migrationCursor),
    sourceCursor: v.optional(migrationCursor),
  },
  returns: v.object({
    sources: parentLinkAuditPage,
    runs: parentLinkAuditPage,
    proposals: v.object({
      scannedCount: v.number(),
      missingContributionSubmissionIdCount: v.number(),
      mismatchedContributionSubmissionIdCount: v.number(),
      nextCursor: migrationCursor,
      isDone: v.boolean(),
    }),
  }),
  handler: async (ctx, args) => {
    const batchSize = normalizeMigrationBatchSize(args.batchSize);
    const sourcesPage = await ctx.db.query("sources").paginate({
      cursor: args.sourceCursor ?? null,
      numItems: batchSize,
    });
    const runsPage = await ctx.db.query("smartStorageRuns").paginate({
      cursor: args.runCursor ?? null,
      numItems: batchSize,
    });
    const proposalsPage = await ctx.db
      .query("smartStorageProposals")
      .paginate({
        cursor: args.proposalCursor ?? null,
        numItems: batchSize,
      });

    let mismatchedContributionSubmissionIdCount = 0;
    for (const proposal of proposalsPage.page) {
      if (proposal.contributionSubmissionId === undefined) {
        continue;
      }
      const run = await ctx.db.get(proposal.smartStorageRunId);
      if (
        run?.contributionSubmissionId !== undefined &&
        run.contributionSubmissionId !== proposal.contributionSubmissionId
      ) {
        mismatchedContributionSubmissionIdCount += 1;
      }
    }

    return {
      sources: {
        scannedCount: sourcesPage.page.length,
        missingContributionSubmissionIdCount: sourcesPage.page.filter(
          (source) => source.contributionSubmissionId === undefined,
        ).length,
        nextCursor: sourcesPage.isDone ? null : sourcesPage.continueCursor,
        isDone: sourcesPage.isDone,
      },
      runs: {
        scannedCount: runsPage.page.length,
        missingContributionSubmissionIdCount: runsPage.page.filter(
          (run) => run.contributionSubmissionId === undefined,
        ).length,
        nextCursor: runsPage.isDone ? null : runsPage.continueCursor,
        isDone: runsPage.isDone,
      },
      proposals: {
        scannedCount: proposalsPage.page.length,
        missingContributionSubmissionIdCount: proposalsPage.page.filter(
          (proposal) => proposal.contributionSubmissionId === undefined,
        ).length,
        mismatchedContributionSubmissionIdCount,
        nextCursor: proposalsPage.isDone
          ? null
          : proposalsPage.continueCursor,
        isDone: proposalsPage.isDone,
      },
    };
  },
});

export const backfillLegacySmartStorageParents = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(migrationCursor),
    dryRun: v.optional(v.boolean()),
  },
  returns: parentLinkBackfillResult,
  handler: async (ctx, args) => {
    const batchSize = normalizeMigrationBatchSize(args.batchSize);
    const dryRun = args.dryRun ?? false;
    const page = await ctx.db.query("smartStorageRuns").paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize,
    });

    let createdSubmissionCount = 0;
    let attachedExistingSubmissionCount = 0;
    let sourcePatchCount = 0;
    let runPatchCount = 0;
    let proposalPatchCount = 0;
    let conflictingParentCount = 0;
    let missingSourceCount = 0;

    for (const run of page.page) {
      const source = await ctx.db.get(run.sourceId);
      if (!source) {
        missingSourceCount += 1;
        continue;
      }

      const proposals = await ctx.db
        .query("smartStorageProposals")
        .withIndex("by_smartStorageRunId", (q) =>
          q.eq("smartStorageRunId", run._id),
        )
        .take(MAX_MIGRATION_PROPOSALS_PER_RUN);
      const parentIds = new Set<string>();
      const runParentId = run.contributionSubmissionId;
      const sourceParentId = source.contributionSubmissionId;
      if (runParentId !== undefined) {
        parentIds.add(runParentId);
      }
      if (sourceParentId !== undefined) {
        parentIds.add(sourceParentId);
      }
      for (const proposal of proposals) {
        if (proposal.contributionSubmissionId !== undefined) {
          parentIds.add(proposal.contributionSubmissionId);
        }
      }

      if (parentIds.size > 1) {
        conflictingParentCount += 1;
        continue;
      }

      let contributionSubmissionId = firstSetValue(parentIds) as
        | Id<"contributionSubmissions">
        | undefined;
      if (contributionSubmissionId !== undefined) {
        const existingSubmission = await ctx.db.get(contributionSubmissionId);
        if (!existingSubmission) {
          conflictingParentCount += 1;
          continue;
        }
        if (runParentId === undefined || sourceParentId === undefined) {
          attachedExistingSubmissionCount += 1;
        }
      } else {
        createdSubmissionCount += 1;
        if (!dryRun) {
          contributionSubmissionId = await createContributionSubmissionForLegacyRun(
            ctx,
            {
              now: Date.now(),
              proposals,
              run,
              source,
            },
          );
        }
      }

      if (contributionSubmissionId === undefined) {
        if (!dryRun) {
          continue;
        }
      }

      if (source.contributionSubmissionId === undefined) {
        sourcePatchCount += 1;
        if (!dryRun && contributionSubmissionId !== undefined) {
          await ctx.db.patch(source._id, { contributionSubmissionId });
        }
      }
      if (run.contributionSubmissionId === undefined) {
        runPatchCount += 1;
        if (!dryRun && contributionSubmissionId !== undefined) {
          await ctx.db.patch(run._id, {
            contributionSubmissionId,
            updatedAt: Date.now(),
          });
        }
      }
      for (const proposal of proposals) {
        if (proposal.contributionSubmissionId === undefined) {
          proposalPatchCount += 1;
          if (!dryRun && contributionSubmissionId !== undefined) {
            await ctx.db.patch(proposal._id, {
              contributionSubmissionId,
              updatedAt: Date.now(),
            });
          }
        }
      }
    }

    return {
      dryRun,
      scannedRunCount: page.page.length,
      createdSubmissionCount,
      attachedExistingSubmissionCount,
      sourcePatchCount,
      runPatchCount,
      proposalPatchCount,
      conflictingParentCount,
      missingSourceCount,
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  returns: v.object({
    uploadUrl: v.string(),
  }),
  handler: async (ctx) => {
    await requireAppAccess(ctx);
    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
    };
  },
});

export const startFromContribution = mutation({
  args: {
    body: v.string(),
    contributionNote: v.optional(v.string()),
    contextTags: v.array(contextTagSnapshot),
    externalUrls: v.optional(v.array(contributionExternalUrl)),
    intendedVisibilityKind: v.optional(visibilityKind),
    intendedVisibilityTargetKey: v.optional(v.string()),
    knowledgeType: entryKnowledgeType,
    reviewScopeKind: v.optional(reviewScopeKind),
    reviewScopeTargetKey: v.optional(v.string()),
    slotId: v.optional(v.string()),
    title: v.string(),
    uploadedFiles: v.optional(v.array(contributionUploadedFile)),
  },
  returns: v.object({
    contributionSubmissionId: v.id("contributionSubmissions"),
    smartStorageRunId: v.id("smartStorageRuns"),
    sourceId: v.id("sources"),
    sourceIds: v.array(v.id("sources")),
    status: v.literal("queued"),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const now = Date.now();
    const title = limitString(args.title, MAX_TITLE_LENGTH);
    const body = limitString(args.body, MAX_SOURCE_TEXT_LENGTH);
    const rawText = body || title;
    const uploadedFiles = args.uploadedFiles ?? [];
    const externalUrls = args.externalUrls ?? [];

    if (!rawText && uploadedFiles.length === 0 && externalUrls.length === 0) {
      throw new Error("At least one Source is required.");
    }
    if (uploadedFiles.length + externalUrls.length + (rawText ? 1 : 0) > MAX_SOURCES_PER_SUBMISSION) {
      throw new Error(
        `Smart Storage supports at most ${MAX_SOURCES_PER_SUBMISSION} Sources per submission.`,
      );
    }

    const intendedVisibility = normalizeVisibilityScope({
      kind: args.intendedVisibilityKind,
      targetKey: args.intendedVisibilityTargetKey,
    });
    const reviewScope = normalizeReviewScope({
      kind: args.reviewScopeKind,
      targetKey: args.reviewScopeTargetKey,
      userId: access.userId,
    });
    const contributionBodyPreview = limitString(
      rawText || getSourceInventoryPreview(uploadedFiles, externalUrls),
      MAX_BODY_PREVIEW_LENGTH,
    );
    const contributionSubmissionId = await ctx.db.insert(
      "contributionSubmissions",
      {
        submittedByUserId: access.userId,
        submissionStatus: "processing",
        primaryIntendedKnowledgeType: args.knowledgeType,
        primaryIntendedTitle: title || "Untitled Source",
        primaryIntendedBodyPreview: contributionBodyPreview,
        ...(args.contributionNote === undefined
          ? {}
          : {
              contributionNote: limitString(
                args.contributionNote,
                MAX_CONTRIBUTION_NOTE_LENGTH,
              ),
            }),
        intendedVisibilityKind: intendedVisibility.kind,
        intendedVisibilityTargetKey: intendedVisibility.targetKey,
        reviewScopeKind: reviewScope.kind,
        reviewScopeTargetKey: reviewScope.targetKey,
        createdAt: now,
        updatedAt: now,
      },
    );

    const sourceIds: Id<"sources">[] = [];
    if (rawText) {
      sourceIds.push(
        await ctx.db.insert("sources", {
          contributionSubmissionId,
          sourceKind: "pastedText",
          ...(title ? { title } : {}),
          rawText,
          submittedByUserId: access.userId,
          submittedAt: now,
        }),
      );
    }

    for (const uploadedFile of uploadedFiles) {
      await attachTemporaryUploadIfPresent(ctx, {
        contributionSubmissionId,
        now,
        uploadedByUserId: access.userId,
        uploadedFile,
      });
      sourceIds.push(
        await ctx.db.insert("sources", {
          contributionSubmissionId,
          sourceKind: "uploadedFile",
          title: limitString(
            uploadedFile.title ?? uploadedFile.fileName,
            MAX_SOURCE_TITLE_LENGTH,
          ),
          storageId: uploadedFile.storageId,
          ...(uploadedFile.contentType === undefined
            ? {}
            : {
                contentType: limitString(
                  uploadedFile.contentType,
                  MAX_CONTENT_TYPE_LENGTH,
                ),
              }),
          ...(uploadedFile.languageCode === undefined
            ? {}
            : {
                languageCode: limitString(
                  uploadedFile.languageCode,
                  MAX_LANGUAGE_CODE_LENGTH,
                ),
              }),
          fileName: limitString(uploadedFile.fileName, MAX_FILE_NAME_LENGTH),
          ...(uploadedFile.fileSizeBytes === undefined
            ? {}
            : { fileSizeBytes: uploadedFile.fileSizeBytes }),
          submittedByUserId: access.userId,
          submittedAt: now,
        }),
      );
    }

    for (const externalUrl of externalUrls) {
      const url = limitString(externalUrl.url, MAX_URL_LENGTH);
      if (!url) {
        continue;
      }
      const sourceId = await ctx.db.insert("sources", {
        contributionSubmissionId,
        sourceKind: "externalUrl",
        ...(externalUrl.title === undefined
          ? {}
          : {
              title: limitString(externalUrl.title, MAX_SOURCE_TITLE_LENGTH),
            }),
        externalUrl: url,
        linkPreviewStatus: "queued",
        ...(externalUrl.linkPreviewTitle === undefined
          ? {}
          : {
              linkPreviewTitle: limitString(
                externalUrl.linkPreviewTitle,
                MAX_LINK_PREVIEW_FIELD_LENGTH,
              ),
            }),
        ...(externalUrl.linkPreviewDescription === undefined
          ? {}
          : {
              linkPreviewDescription: limitString(
                externalUrl.linkPreviewDescription,
                MAX_LINK_PREVIEW_FIELD_LENGTH,
              ),
            }),
        ...(externalUrl.linkPreviewImageUrl === undefined
          ? {}
          : {
              linkPreviewImageUrl: limitString(
                externalUrl.linkPreviewImageUrl,
                MAX_URL_LENGTH,
              ),
            }),
        ...(externalUrl.linkPreviewSiteName === undefined
          ? {}
          : {
              linkPreviewSiteName: limitString(
                externalUrl.linkPreviewSiteName,
                MAX_LINK_PREVIEW_FIELD_LENGTH,
              ),
            }),
        submittedByUserId: access.userId,
        submittedAt: now,
      });
      sourceIds.push(sourceId);
      await ctx.scheduler.runAfter(
        0,
        internal.smartStorage.fetchLinkPreviewForSource,
        { sourceId, url },
      );
    }

    if (sourceIds.length === 0) {
      throw new Error("At least one valid Source is required.");
    }

    const primarySourceId = sourceIds[0];
    const snapshots = await ensureCurrentSmartStorageSnapshots(ctx, {
      knowledgeType: args.knowledgeType,
      now,
    });
    const smartStorageRunId = await ctx.db.insert("smartStorageRuns", {
      contributionSubmissionId,
      sourceId: primarySourceId,
      primarySourceId,
      status: "queued",
      requestedKnowledgeType: args.knowledgeType,
      contributionTitle: title,
      contributionBodyPreview,
      contextTags: normalizeContextTags(args.contextTags),
      ...(args.slotId === undefined
        ? {}
        : { slotId: limitString(args.slotId, MAX_SLOT_ID_LENGTH) }),
      smartStorageContractVersionId: snapshots.smartStorageContractVersionId,
      typeBehaviorSnapshotId: snapshots.typeBehaviorSnapshotId,
      contractSnapshotVersion: snapshots.contractSnapshotVersion,
      contractSnapshotText: snapshots.contractSnapshotText,
      typeBehaviorSnapshotVersion: snapshots.typeBehaviorSnapshotVersion,
      typeBehaviorSnapshotText: snapshots.typeBehaviorSnapshotText,
      createdByUserId: access.userId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      contributionSubmissionId,
      smartStorageRunId,
      sourceId: primarySourceId,
      sourceIds,
      status: "queued" as const,
    };
  },
});

export const generateDraftProposalForRun = mutation({
  args: {
    smartStorageRunId: v.id("smartStorageRuns"),
  },
  returns: v.object({
    contributionSubmissionId: v.optional(v.id("contributionSubmissions")),
    currentProposal: smartStorageProposedEntry,
    smartStorageProposalId: v.id("smartStorageProposals"),
    smartStorageRunId: v.id("smartStorageRuns"),
    sourceCitations: v.array(proposalSourceCitationSummary),
    sourceId: v.id("sources"),
    sourceIds: v.array(v.id("sources")),
    status: v.literal("drafted"),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const run = await ctx.db.get(args.smartStorageRunId);
    if (!run) {
      throw new Error("Smart Storage Run not found.");
    }
    if (run.createdByUserId !== access.userId) {
      throw new Error("Unauthorized");
    }

    const existingProposal = await ctx.db
      .query("smartStorageProposals")
      .withIndex("by_smartStorageRunId", (q) =>
        q.eq("smartStorageRunId", args.smartStorageRunId),
      )
      .unique();
    if (existingProposal) {
      return {
        ...(existingProposal.contributionSubmissionId === undefined
          ? {}
          : { contributionSubmissionId: existingProposal.contributionSubmissionId }),
        currentProposal: existingProposal.currentProposal,
        smartStorageProposalId: existingProposal._id,
        smartStorageRunId: run._id,
        sourceCitations: await listProposalSourceCitations(ctx, existingProposal._id),
        sourceId: existingProposal.sourceId,
        sourceIds: await listRunSourceIds(ctx, run),
        status: "drafted" as const,
      };
    }

    const contributionSubmissionId = run.contributionSubmissionId;
    if (contributionSubmissionId === undefined) {
      throw new Error(
        "Smart Storage Run must be linked to a Contribution Submission before generating a Proposal.",
      );
    }

    if (
      run.status !== "queued" &&
      run.status !== "failed" &&
      run.status !== "noProposal"
    ) {
      throw new Error(
        "Smart Storage Run cannot generate a scaffold proposal from its current status.",
      );
    }

    const primarySourceId = run.primarySourceId ?? run.sourceId;
    const primarySource = await ctx.db.get(primarySourceId);
    if (!primarySource) {
      throw new Error("Source not found.");
    }
    if (
      primarySource.submittedByUserId !== undefined &&
      primarySource.submittedByUserId !== access.userId
    ) {
      throw new Error("Unauthorized");
    }

    const sources = await listRunSources(ctx, run);
    const now = Date.now();
    const originalProposal = buildDraftProposal(run, primarySource, sources);
    const currentProposal = cloneDraftProposal(originalProposal);
    const rawModelOutput = limitString(
      JSON.stringify({
        generatorVersion: DETERMINISTIC_GENERATOR_VERSION,
        proposal: originalProposal,
        sourceIds: sources.map((source) => source._id),
      }),
      MAX_RAW_MODEL_OUTPUT_LENGTH,
    );

    const smartStorageProposalId = await ctx.db.insert(
      "smartStorageProposals",
      {
        contributionSubmissionId,
        sourceId: primarySourceId,
        smartStorageRunId: run._id,
        status: "drafted",
        originalProposal,
        currentProposal,
        ...(run.smartStorageContractVersionId === undefined
          ? {}
          : {
              smartStorageContractVersionId:
                run.smartStorageContractVersionId,
            }),
        ...(run.typeBehaviorSnapshotId === undefined
          ? {}
          : { typeBehaviorSnapshotId: run.typeBehaviorSnapshotId }),
        ...(run.contractSnapshotVersion === undefined
          ? {}
          : { contractSnapshotVersion: run.contractSnapshotVersion }),
        ...(run.contractSnapshotText === undefined
          ? {}
          : { contractSnapshotText: run.contractSnapshotText }),
        ...(run.typeBehaviorSnapshotVersion === undefined
          ? {}
          : { typeBehaviorSnapshotVersion: run.typeBehaviorSnapshotVersion }),
        ...(run.typeBehaviorSnapshotText === undefined
          ? {}
          : { typeBehaviorSnapshotText: run.typeBehaviorSnapshotText }),
        createdByUserId: access.userId,
        createdAt: now,
        updatedAt: now,
      },
    );
    const sourceCitations = await insertProposalSourceCitations(ctx, {
      createdAt: now,
      proposalId: smartStorageProposalId,
      sources,
    });

    await ctx.db.patch(run._id, {
      status: "succeeded",
      errorMessage: undefined,
      rawModelOutput,
      updatedAt: now,
      completedAt: now,
    });
    await ctx.db.patch(contributionSubmissionId, {
      submissionStatus: "reviewReady",
      updatedAt: now,
    });

    return {
      contributionSubmissionId,
      currentProposal,
      smartStorageProposalId,
      smartStorageRunId: run._id,
      sourceCitations,
      sourceId: primarySourceId,
      sourceIds: sources.map((source) => source._id),
      status: "drafted" as const,
    };
  },
});

export const acceptScaffoldProposal = mutation({
  args: {
    representationDecisions: v.optional(v.array(representationDecisionInput)),
    selectedSourceIds: v.optional(v.array(v.id("sources"))),
    smartStorageProposalId: v.id("smartStorageProposals"),
    targetExistingEntryId: v.optional(v.id("knowledgeEntries")),
  },
  returns: v.object({
    acceptanceStatus: v.union(v.literal("accepted"), v.literal("targetExists")),
    entry: v.optional(knowledgeEntrySummary),
    entryId: v.optional(v.id("knowledgeEntries")),
    existingEntryId: v.optional(v.id("knowledgeEntries")),
    smartStorageProposalId: v.id("smartStorageProposals"),
    status: v.union(
      v.literal("accepted"),
      v.literal("needsResolution"),
      v.literal("drafted"),
    ),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const proposal = await ctx.db.get(args.smartStorageProposalId);
    if (!proposal) {
      throw new Error("Smart Storage Proposal not found.");
    }
    if (proposal.createdByUserId !== access.userId) {
      throw new Error("Unauthorized");
    }
    if (proposal.status === "accepted") {
      throw new Error("Smart Storage Proposal is already accepted.");
    }

    const run = await ctx.db.get(proposal.smartStorageRunId);
    if (!run) {
      throw new Error("Smart Storage Run not found.");
    }
    if (
      proposal.contributionSubmissionId === undefined ||
      run.contributionSubmissionId === undefined
    ) {
      throw new Error(
        "Smart Storage Proposal must be linked to a Contribution Submission before acceptance.",
      );
    }
    if (
      run.contributionSubmissionId !== proposal.contributionSubmissionId
    ) {
      throw new Error("Proposal and Run belong to different Contribution Submissions.");
    }

    const now = Date.now();
    const proposedEntry = proposal.currentProposal;
    const typeBehavior = getTypeBehavior(proposedEntry.knowledgeType);
    const represented = await resolveRepresentedIdentity(ctx, {
      knowledgeType: proposedEntry.knowledgeType,
      now,
      title: proposedEntry.title,
      userId: access.userId,
    });
    if (represented.status === "targetExists") {
      if (args.targetExistingEntryId !== undefined) {
        if (args.targetExistingEntryId !== represented.existingEntryId) {
          throw new Error(
            "Confirmed existing entry does not match the current represented target.",
          );
        }

        const existingEntry = await ctx.db.get(args.targetExistingEntryId);
        if (!existingEntry) {
          throw new Error("Existing Knowledge Entry not found.");
        }
        if (existingEntry.createdByUserId !== access.userId) {
          throw new Error("Unauthorized");
        }

        const representationDecisions =
          await loadAcceptedRepresentationDecisions(ctx, {
            allowedRepresentationRoles: typeBehavior.representationRoles.allowed,
            fallbackSourceId: proposal.sourceId,
            proposalId: proposal._id,
            representationDecisions: args.representationDecisions,
            selectedSourceIds: args.selectedSourceIds,
            typeBehaviorDefaultRole: typeBehavior.representationRoles.defaultRole,
          });
        await insertAcceptedRepresentationsAndOutputs(ctx, {
          entryId: existingEntry._id,
          now,
          proposedEntry,
          representationDecisions,
        });

        await ctx.db.patch(existingEntry._id, { updatedAt: now });
        await markProposalAccepted(ctx, {
          contributionSubmissionId: proposal.contributionSubmissionId,
          now,
          proposalId: proposal._id,
        });

        const updatedEntry = await ctx.db.get(existingEntry._id);
        if (!updatedEntry) {
          throw new Error("Updated Knowledge Entry could not be loaded.");
        }

        return {
          acceptanceStatus: "accepted" as const,
          entry: summarizeEntry(
            updatedEntry,
            await getContributorSummary(ctx, access.userId),
          ),
          entryId: updatedEntry._id,
          smartStorageProposalId: proposal._id,
          status: "accepted" as const,
        };
      }

      await ctx.db.patch(proposal._id, {
        status: "needsResolution",
        updatedAt: now,
      });
      return {
        acceptanceStatus: "targetExists" as const,
        existingEntryId: represented.existingEntryId,
        smartStorageProposalId: proposal._id,
        status: "needsResolution" as const,
      };
    }

    const submission = await ctx.db.get(proposal.contributionSubmissionId);
    const contextTags = await resolveContextTags(
      ctx,
      normalizeContextTags(proposedEntry.contextTags),
      access.userId,
    );
    const contextPreviewTagLabels = contextTags
      .map((tag) => tag.label)
      .slice(0, MAX_CONTEXT_PREVIEW_TAG_LABELS);
    const previewText = limitString(
      proposedEntry.bodyPreview ||
        `Accepted ${formatKnowledgeTypeLabel(proposedEntry.knowledgeType)} proposal.`,
      MAX_BODY_PREVIEW_LENGTH,
    );
    const humanWeight = getApplicableHumanWeight(
      proposedEntry.knowledgeType,
      typeBehavior.humanWeight.defaultEstimate,
    );
    const entryId = await ctx.db.insert("knowledgeEntries", {
      knowledgeType: proposedEntry.knowledgeType,
      representedReferentId: represented.referentId,
      primaryTagId: represented.primaryTagId,
      title: limitString(proposedEntry.title, MAX_TITLE_LENGTH),
      previewText,
      searchText: limitString(
        [
          proposedEntry.title,
          proposedEntry.bodyPreview,
          ...contextTags.map((tag) => tag.label),
        ].join(" "),
        MAX_SEARCH_TEXT_LENGTH,
      ),
      primaryTagLabel: represented.primaryTagLabel,
      contextPreviewTagLabels,
      ...(humanWeight === undefined ? {} : { humanWeight }),
      visibilityKind: submission?.intendedVisibilityKind ?? "public",
      visibilityTargetKey: submission?.intendedVisibilityTargetKey ?? "public",
      discoverabilityKind: submission?.intendedVisibilityKind ?? "public",
      discoverabilityTargetKey:
        submission?.intendedVisibilityTargetKey ?? "public",
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
    for (const tag of contextTags) {
      await ctx.db.insert("entryTags", {
        entryId,
        tagId: tag._id,
        tagPurpose: "context",
        taggedAt: now,
        taggedByUserId: access.userId,
      });
    }
    if (proposedEntry.knowledgeType === "question") {
      await ctx.db.insert("questionEntries", {
        entryId,
        questionText: proposedEntry.title,
      });
    }

    const representationDecisions = await loadAcceptedRepresentationDecisions(ctx, {
      allowedRepresentationRoles: typeBehavior.representationRoles.allowed,
      fallbackSourceId: proposal.sourceId,
      proposalId: proposal._id,
      representationDecisions: args.representationDecisions,
      selectedSourceIds: args.selectedSourceIds,
      typeBehaviorDefaultRole: typeBehavior.representationRoles.defaultRole,
    });
    await insertAcceptedRepresentationsAndOutputs(ctx, {
      entryId,
      now,
      proposedEntry,
      representationDecisions,
    });

    await markProposalAccepted(ctx, {
      contributionSubmissionId: proposal.contributionSubmissionId,
      now,
      proposalId: proposal._id,
    });

    const entry = await ctx.db.get(entryId);
    if (!entry) {
      throw new Error("Accepted Knowledge Entry could not be loaded.");
    }

    return {
      acceptanceStatus: "accepted" as const,
      entry: summarizeEntry(entry, await getContributorSummary(ctx, access.userId)),
      entryId,
      smartStorageProposalId: proposal._id,
      status: "accepted" as const,
    };
  },
});

async function attachTemporaryUploadIfPresent(
  ctx: MutationCtx,
  {
    contributionSubmissionId,
    now,
    uploadedByUserId,
    uploadedFile,
  }: {
    contributionSubmissionId: Id<"contributionSubmissions">;
    now: number;
    uploadedByUserId: Id<"users">;
    uploadedFile: {
      temporaryUploadId?: Id<"temporaryUploads">;
      storageId: Id<"_storage">;
    };
  },
) {
  if (uploadedFile.temporaryUploadId === undefined) {
    return;
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
    attachedContributionSubmissionId: contributionSubmissionId,
    updatedAt: now,
  });
}

async function cleanupTemporaryUploadRow(
  ctx: MutationCtx,
  temporaryUpload: Doc<"temporaryUploads">,
  now: number,
): Promise<{ cleanupStatus: "deleted" | "notExpired" | "skipped" }> {
  if (temporaryUpload.uploadStatus !== "uploaded") {
    return { cleanupStatus: "skipped" };
  }
  if (temporaryUpload.expiresAt > now) {
    return { cleanupStatus: "notExpired" };
  }

  await ctx.storage.delete(temporaryUpload.storageId);
  await ctx.db.patch(temporaryUpload._id, {
    uploadStatus: "deleted",
    updatedAt: now,
  });

  return { cleanupStatus: "deleted" };
}

function clampBatchSize(batchSize: number | undefined) {
  if (batchSize === undefined || !Number.isFinite(batchSize)) {
    return MAX_TEMPORARY_UPLOAD_CLEANUP_BATCH_SIZE;
  }

  return Math.max(
    1,
    Math.min(
      Math.floor(batchSize),
      MAX_TEMPORARY_UPLOAD_CLEANUP_BATCH_SIZE,
    ),
  );
}

async function fetchLinkPreviewMetadata(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    LINK_PREVIEW_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error("Link Preview redirects are not followed.");
    }
    if (!response.ok) {
      throw new Error(`Link Preview fetch failed with ${response.status}.`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml+xml")
    ) {
      throw new Error("Link Preview response is not HTML.");
    }

    return extractLinkPreviewMetadata(
      await readBoundedResponseText(response),
      url,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedResponseText(response: Response) {
  const contentLength = response.headers.get("content-length");
  if (
    contentLength &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > MAX_LINK_PREVIEW_RESPONSE_BYTES
  ) {
    throw new Error("Link Preview response is too large.");
  }

  if (!response.body) {
    return (await response.text()).slice(0, MAX_LINK_PREVIEW_RESPONSE_BYTES);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    const remaining = MAX_LINK_PREVIEW_RESPONSE_BYTES - byteLength;
    if (remaining <= 0) {
      await reader.cancel();
      break;
    }
    if (value.byteLength > remaining) {
      chunks.push(value.slice(0, remaining));
      byteLength += remaining;
      await reader.cancel();
      break;
    }

    chunks.push(value);
    byteLength += value.byteLength;
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes);
}

function extractLinkPreviewMetadata(html: string, url: string) {
  const metaValues = getMetaValues(html);
  const title = getPreviewField(
    metaValues.get("og:title") ??
      metaValues.get("twitter:title") ??
      getTitleText(html),
  );
  const description = getPreviewField(
    metaValues.get("og:description") ??
      metaValues.get("twitter:description") ??
      metaValues.get("description"),
  );
  const siteName = getPreviewField(metaValues.get("og:site_name"));
  const imageUrl = getPreviewImageUrl(
    metaValues.get("og:image") ??
      metaValues.get("og:image:url") ??
      metaValues.get("twitter:image"),
    url,
  );

  return {
    ...(description === undefined ? {} : { description }),
    ...(imageUrl === undefined ? {} : { imageUrl }),
    ...(siteName === undefined ? {} : { siteName }),
    ...(title === undefined ? {} : { title }),
  };
}

function getMetaValues(html: string) {
  const values = new Map<string, string>();
  const tagPattern = /<meta\b[^>]*>/gi;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = tagPattern.exec(html)) !== null) {
    const attributes = getHtmlAttributes(tagMatch[0]);
    const key = (attributes.property ?? attributes.name)?.toLowerCase();
    const content = attributes.content;
    if (key && content && !values.has(key)) {
      values.set(key, decodeHtmlEntities(content));
    }
  }

  return values;
}

function getHtmlAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  const attributePattern =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let match: RegExpExecArray | null;

  while ((match = attributePattern.exec(tag)) !== null) {
    const [, name, doubleQuoted, singleQuoted, unquoted] = match;
    attributes[name.toLowerCase()] = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
  }

  return attributes;
}

function getTitleText(html: string) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decodeHtmlEntities(match[1]) : undefined;
}

function getPreviewField(value: string | undefined) {
  const normalized = normalizePreviewText(value);
  return normalized
    ? limitString(normalized, MAX_LINK_PREVIEW_FIELD_LENGTH)
    : undefined;
}

function getPreviewImageUrl(value: string | undefined, baseUrl: string) {
  const normalized = normalizePreviewText(value);
  if (!normalized) {
    return undefined;
  }

  try {
    const url = new URL(normalized, baseUrl);
    const safeUrl = getSafeLinkPreviewUrl(url.href);
    return safeUrl.kind === "ok"
      ? limitString(safeUrl.url, MAX_URL_LENGTH)
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizePreviewText(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, codePoint: string) =>
      decodeCodePoint(Number.parseInt(codePoint, 16)),
    )
    .replace(/&#(\d+);/g, (_match, codePoint: string) =>
      decodeCodePoint(Number.parseInt(codePoint, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function decodeCodePoint(codePoint: number) {
  if (!Number.isFinite(codePoint)) {
    return "";
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return "";
  }
}

function getSafeLinkPreviewUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      kind: "error" as const,
      message: "Link Preview URL is malformed.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      kind: "error" as const,
      message: "Link Preview only supports HTTP and HTTPS URLs.",
    };
  }

  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";

  const hostSafety = getHostSafety(parsed.hostname);
  if (hostSafety.kind === "error") {
    return hostSafety;
  }

  return {
    kind: "ok" as const,
    url: limitString(parsed.href, MAX_URL_LENGTH),
  };
}

function getHostSafety(hostname: string) {
  const normalizedHost = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!normalizedHost) {
    return {
      kind: "error" as const,
      message: "Link Preview URL must include a host.",
    };
  }
  if (
    normalizedHost === "localhost" ||
    normalizedHost.endsWith(".localhost") ||
    normalizedHost.endsWith(".local") ||
    normalizedHost.endsWith(".internal") ||
    normalizedHost.endsWith(".home.arpa") ||
    !normalizedHost.includes(".")
  ) {
    return {
      kind: "error" as const,
      message: "Link Preview URL host is not allowed.",
    };
  }

  const ipv4Parts = getIpv4Parts(normalizedHost);
  if (ipv4Parts && isUnsafeIpv4(ipv4Parts)) {
    return {
      kind: "error" as const,
      message: "Link Preview URL host is not allowed.",
    };
  }
  if (isUnsafeIpv6(normalizedHost)) {
    return {
      kind: "error" as const,
      message: "Link Preview URL host is not allowed.",
    };
  }

  return { kind: "ok" as const };
}

function getIpv4Parts(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const parsed = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const value = Number(part);
    return value >= 0 && value <= 255 ? value : null;
  });

  return parsed.every((part) => part !== null)
    ? (parsed as [number, number, number, number])
    : null;
}

function isUnsafeIpv4([first, second]: [number, number, number, number]) {
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && second >= 18 && second <= 19)
  );
}

function isUnsafeIpv6(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === "::1" || normalized === "::") {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (normalized.startsWith("fe80:")) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    const ipv4Parts = getIpv4Parts(normalized.slice("::ffff:".length));
    return ipv4Parts ? isUnsafeIpv4(ipv4Parts) : true;
  }

  return false;
}

function getPreviewErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Link Preview fetch timed out.";
  }
  if (error instanceof Error && error.message) {
    return limitString(error.message, MAX_LINK_PREVIEW_ERROR_LENGTH);
  }

  return "Link Preview fetch failed.";
}

function normalizeVisibilityScope({
  kind,
  targetKey,
}: {
  kind?: "private" | "organization" | "group" | "public";
  targetKey?: string;
}) {
  const visibilityKind = kind ?? "public";
  const visibilityTargetKey =
    targetKey === undefined ? visibilityKind : limitString(targetKey, 240);

  return {
    kind: visibilityKind,
    targetKey: visibilityTargetKey || visibilityKind,
  };
}

function normalizeReviewScope({
  kind,
  targetKey,
  userId,
}: {
  kind?: "private" | "organization" | "group" | "public";
  targetKey?: string;
  userId: Id<"users">;
}) {
  const scopeKind = kind ?? "private";
  const defaultTargetKey =
    scopeKind === "private" ? `user:${userId}` : scopeKind;
  const scopeTargetKey = limitString(targetKey ?? defaultTargetKey, 240);

  validateScopeTargetKey(scopeKind, scopeTargetKey);

  return {
    kind: scopeKind,
    targetKey: scopeTargetKey,
  };
}

function validateScopeTargetKey(
  kind: "private" | "organization" | "group" | "public",
  targetKey: string,
) {
  if (kind === "private" && !targetKey.startsWith("user:")) {
    throw new Error("Private review scope target keys must start with user:.");
  }
  if (kind === "organization" && !targetKey.startsWith("organization:")) {
    throw new Error(
      "Organization review scope target keys must start with organization:.",
    );
  }
  if (kind === "group" && !targetKey.startsWith("group:")) {
    throw new Error("Group review scope target keys must start with group:.");
  }
  if (kind === "public" && targetKey !== "public") {
    throw new Error("Public review scope target key must be public.");
  }
}

function getSourceInventoryPreview(
  uploadedFiles: Array<{ fileName: string }>,
  externalUrls: Array<{ url: string }>,
) {
  const parts = [
    ...uploadedFiles.map((file) => file.fileName),
    ...externalUrls.map((url) => url.url),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Submitted Sources";
}

async function markSubmissionReviewReadyIfPresent(
  ctx: MutationCtx,
  run: Doc<"smartStorageRuns">,
) {
  if (run.contributionSubmissionId === undefined) {
    return;
  }

  await ctx.db.patch(run.contributionSubmissionId, {
    submissionStatus: "reviewReady",
    updatedAt: Date.now(),
  });
}

function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

function getOpenAiSmartStorageModel() {
  return (
    process.env.OPENAI_SMART_STORAGE_MODEL?.trim() ||
    DEFAULT_OPENAI_SMART_STORAGE_MODEL
  );
}

function buildOpenAiSmartStorageRequest(input: ModelRunExecutionInput) {
  return {
    model: getOpenAiSmartStorageModel(),
    instructions: [
      "You are helping prepare one Smart Storage Proposal for human review.",
      "Return only the structured JSON shape requested by the schema.",
      "Do not create Gold Layer Knowledge Entries. The user must confirm proposals.",
      "Use the provided Smart Storage Contract and Type Behavior snapshots as authoritative rules.",
      "If evidence is weak, keep proposalConfidence low and explain the concern in rationale.",
    ].join("\n"),
    input: limitString(
      JSON.stringify(buildModelRunRequestInput(input)),
      MAX_MODEL_INPUT_LENGTH,
    ),
    text: {
      format: {
        type: "json_schema",
        name: SMART_STORAGE_MODEL_SCHEMA_NAME,
        strict: true,
        schema: SMART_STORAGE_PROPOSAL_JSON_SCHEMA,
      },
    },
  };
}

function buildModelRunRequestInput(input: ModelRunExecutionInput) {
  return {
    contributionSubmission: input.contributionSubmission ?? null,
    run: {
      requestedKnowledgeType: input.run.requestedKnowledgeType,
      contributionTitle: input.run.contributionTitle,
      contributionBodyPreview: input.run.contributionBodyPreview,
      contextTags: input.run.contextTags,
      contractSnapshotVersion: input.run.contractSnapshotVersion ?? null,
      contractSnapshotText: input.run.contractSnapshotText ?? null,
      typeBehaviorSnapshotVersion: input.run.typeBehaviorSnapshotVersion ?? null,
      typeBehaviorSnapshotText: input.run.typeBehaviorSnapshotText ?? null,
    },
    sources: input.sources.map((source) => ({
      id: source.id,
      sourceKind: source.sourceKind,
      title: source.title ?? null,
      rawText:
        source.rawText === undefined
          ? null
          : limitString(source.rawText, MAX_MODEL_SOURCE_TEXT_LENGTH),
      externalUrl: source.externalUrl ?? null,
      fileName: source.fileName ?? null,
      contentType: source.contentType ?? null,
      linkPreviewStatus: source.linkPreviewStatus ?? null,
      linkPreviewTitle: source.linkPreviewTitle ?? null,
      linkPreviewDescription: source.linkPreviewDescription ?? null,
      linkPreviewSiteName: source.linkPreviewSiteName ?? null,
    })),
  };
}

function extractOpenAiResponseText(rawResponseText: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponseText);
  } catch {
    return "";
  }

  if (!isRecord(parsed)) {
    return "";
  }
  if (typeof parsed.output_text === "string") {
    return parsed.output_text;
  }

  const output = parsed.output;
  if (!Array.isArray(output)) {
    return "";
  }
  const textParts: string[] = [];
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") {
        textParts.push(content.text);
      }
    }
  }

  return textParts.join("\n").trim();
}

function parseModelProposal(modelText: string):
  | { kind: "success"; proposal: SmartStorageProposedEntryDoc }
  | { kind: "error"; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(modelText);
  } catch {
    return { kind: "error", message: "OpenAI response was not valid JSON." };
  }

  const proposal = toValidatedModelProposal(parsed);
  if (!proposal) {
    return {
      kind: "error",
      message: "OpenAI response did not match the Smart Storage Proposal shape.",
    };
  }

  return { kind: "success", proposal };
}

function toValidatedModelProposal(value: unknown): SmartStorageProposedEntryDoc | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!isEntryKnowledgeType(value.knowledgeType)) {
    return null;
  }
  if (
    typeof value.title !== "string" ||
    typeof value.bodyPreview !== "string" ||
    typeof value.rationale !== "string" ||
    !isProposalConfidence(value.proposalConfidence) ||
    !Array.isArray(value.contextTags)
  ) {
    return null;
  }

  const contextTags: ContextTagSnapshotInput[] = [];
  for (const tag of value.contextTags) {
    const normalizedTag = toValidatedContextTag(tag);
    if (!normalizedTag) {
      return null;
    }
    contextTags.push(normalizedTag);
  }

  return normalizeModelProposal({
    knowledgeType: value.knowledgeType,
    title: value.title,
    bodyPreview: value.bodyPreview,
    contextTags,
    proposalConfidence: value.proposalConfidence,
    rationale: value.rationale,
  });
}

function normalizeModelProposal(
  proposal: SmartStorageProposedEntryDoc,
): SmartStorageProposedEntryDoc {
  return {
    knowledgeType: proposal.knowledgeType,
    title: limitString(proposal.title, MAX_TITLE_LENGTH),
    bodyPreview: limitString(proposal.bodyPreview, MAX_BODY_PREVIEW_LENGTH),
    contextTags: normalizeContextTags(proposal.contextTags),
    proposalConfidence: proposal.proposalConfidence,
    rationale: limitString(proposal.rationale, MAX_RATIONALE_LENGTH),
  };
}

function toValidatedContextTag(value: unknown): ContextTagSnapshotInput | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.canonicalKey !== "string" ||
    typeof value.href !== "string" ||
    typeof value.id !== "string" ||
    !isReferentKnowledgeType(value.knowledgeType) ||
    typeof value.label !== "string"
  ) {
    return null;
  }
  const passageString = value.passageString;
  if (
    passageString !== undefined &&
    passageString !== null &&
    typeof passageString !== "string"
  ) {
    return null;
  }

  return {
    canonicalKey: value.canonicalKey,
    href: value.href,
    id: value.id,
    knowledgeType: value.knowledgeType,
    label: value.label,
    ...(passageString === undefined || passageString === null
      ? {}
      : { passageString }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEntryKnowledgeType(value: unknown): value is EntryKnowledgeType {
  return (
    typeof value === "string" &&
    (ENTRY_KNOWLEDGE_TYPES as readonly string[]).includes(value)
  );
}

function isReferentKnowledgeType(value: unknown): value is ReferentKnowledgeType {
  return value === "biblePassage" || isEntryKnowledgeType(value);
}

function isProposalConfidence(
  value: unknown,
): value is SmartStorageProposedEntryDoc["proposalConfidence"] {
  return value === "low" || value === "medium" || value === "high";
}

function getModelExecutionErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return limitString(error.message, MAX_MODEL_ERROR_LENGTH);
  }
  return "OpenAI Responses API request failed.";
}

async function ensureCurrentSmartStorageSnapshots(
  ctx: MutationCtx,
  {
    knowledgeType,
    now,
  }: {
    knowledgeType: EntryKnowledgeType;
    now: number;
  },
) {
  const smartStorageContractVersionId =
    await ensureSmartStorageContractVersion(ctx, {
      contractKey: SMART_STORAGE_CONTRACT_KEY,
      now,
      snapshotText: SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT,
      version: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
    });
  const typeBehaviorSnapshot = getTypeBehaviorSnapshot(knowledgeType);
  const typeBehaviorSnapshotId = await ensureTypeBehaviorSnapshot(ctx, {
    behaviorSnapshotJson: typeBehaviorSnapshot.behaviorSnapshotJson,
    knowledgeType,
    now,
    snapshotText: TYPE_BEHAVIOR_SNAPSHOT_TEXT,
    version: typeBehaviorSnapshot.version,
  });

  return {
    smartStorageContractVersionId,
    typeBehaviorSnapshotId,
    contractSnapshotVersion: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
    contractSnapshotText: SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT,
    typeBehaviorSnapshotVersion: typeBehaviorSnapshot.version,
    typeBehaviorSnapshotText: TYPE_BEHAVIOR_SNAPSHOT_TEXT,
  };
}

async function ensureSmartStorageContractVersion(
  ctx: MutationCtx,
  {
    contractKey,
    now,
    snapshotText,
    version,
  }: {
    contractKey: string;
    now: number;
    snapshotText: string;
    version: string;
  },
) {
  const existing = await ctx.db
    .query("smartStorageContractVersions")
    .withIndex("by_contractKey_and_version", (q) =>
      q.eq("contractKey", contractKey).eq("version", version),
    )
    .unique();
  if (existing) {
    if (existing.snapshotText !== snapshotText) {
      throw new Error(
        "Smart Storage Contract version content changed for existing version.",
      );
    }

    return existing._id;
  }

  return await ctx.db.insert("smartStorageContractVersions", {
    contractKey,
    version,
    snapshotText,
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureTypeBehaviorSnapshot(
  ctx: MutationCtx,
  {
    behaviorSnapshotJson,
    knowledgeType,
    now,
    snapshotText,
    version,
  }: {
    behaviorSnapshotJson: string;
    knowledgeType: EntryKnowledgeType;
    now: number;
    snapshotText: string;
    version: string;
  },
) {
  const existing = await ctx.db
    .query("typeBehaviorSnapshots")
    .withIndex("by_knowledgeType_and_version", (q) =>
      q.eq("knowledgeType", knowledgeType).eq("version", version),
    )
    .unique();
  if (existing) {
    if (
      existing.snapshotText !== snapshotText ||
      existing.behaviorSnapshotJson !== behaviorSnapshotJson
    ) {
      throw new Error(
        "Type Behavior snapshot content changed for existing version.",
      );
    }

    return existing._id;
  }

  return await ctx.db.insert("typeBehaviorSnapshots", {
    knowledgeType,
    version,
    snapshotText,
    behaviorSnapshotJson,
    createdAt: now,
    updatedAt: now,
  });
}

function normalizeMigrationBatchSize(batchSize: number | undefined) {
  if (batchSize === undefined) {
    return DEFAULT_MIGRATION_BATCH_SIZE;
  }
  if (!Number.isFinite(batchSize)) {
    throw new Error("Migration batch size must be finite.");
  }

  return Math.min(
    MAX_MIGRATION_BATCH_SIZE,
    Math.max(1, Math.floor(batchSize)),
  );
}

function firstSetValue<T>(values: Set<T>) {
  for (const value of values) {
    return value;
  }
  return undefined;
}

async function createContributionSubmissionForLegacyRun(
  ctx: MutationCtx,
  {
    now,
    proposals,
    run,
    source,
  }: {
    now: number;
    proposals: Doc<"smartStorageProposals">[];
    run: Doc<"smartStorageRuns">;
    source: Doc<"sources">;
  },
) {
  const createdAt = getLegacyContributionCreatedAt(run, source, proposals);

  return await ctx.db.insert("contributionSubmissions", {
    submittedByUserId: run.createdByUserId,
    submissionStatus: inferLegacySubmissionStatus(run, proposals),
    primaryIntendedKnowledgeType: run.requestedKnowledgeType,
    primaryIntendedTitle: limitString(
      run.contributionTitle || source.title || "Untitled Source",
      MAX_TITLE_LENGTH,
    ),
    primaryIntendedBodyPreview: limitString(
      run.contributionBodyPreview ||
        source.rawText ||
        source.title ||
        "Legacy Smart Storage Source",
      MAX_BODY_PREVIEW_LENGTH,
    ),
    intendedVisibilityKind: "public",
    intendedVisibilityTargetKey: "public",
    reviewScopeKind: "private",
    reviewScopeTargetKey: `user:${run.createdByUserId}`,
    createdAt,
    updatedAt: now,
  });
}

function getLegacyContributionCreatedAt(
  run: Doc<"smartStorageRuns">,
  source: Doc<"sources">,
  proposals: Doc<"smartStorageProposals">[],
) {
  return Math.min(
    run.createdAt,
    source.submittedAt,
    ...proposals.map((proposal) => proposal.createdAt),
  );
}

function inferLegacySubmissionStatus(
  run: Doc<"smartStorageRuns">,
  proposals: Doc<"smartStorageProposals">[],
) {
  if (proposals.some((proposal) => proposal.status === "accepted")) {
    return "accepted" as const;
  }
  if (
    proposals.length > 0 ||
    run.status === "succeeded" ||
    run.status === "noProposal" ||
    run.status === "failed"
  ) {
    return "reviewReady" as const;
  }
  if (run.status === "superseded") {
    return "cancelled" as const;
  }

  return "processing" as const;
}

function normalizeContextTags(tags: ContextTagSnapshotInput[]) {
  return tags.slice(0, MAX_CONTEXT_TAGS).map((tag) => {
    const passageString =
      tag.passageString === undefined
        ? undefined
        : limitString(tag.passageString, MAX_CONTEXT_TAG_FIELD_LENGTH);

    return {
      canonicalKey: limitString(tag.canonicalKey, MAX_CONTEXT_TAG_FIELD_LENGTH),
      href: limitString(tag.href, MAX_CONTEXT_TAG_HREF_LENGTH),
      id: limitString(tag.id, MAX_CONTEXT_TAG_FIELD_LENGTH),
      knowledgeType: tag.knowledgeType,
      label: limitString(tag.label, MAX_CONTEXT_TAG_FIELD_LENGTH),
      ...(passageString === undefined ? {} : { passageString }),
    };
  });
}

async function listRunSources(
  ctx: MutationCtx | QueryCtx,
  run: Doc<"smartStorageRuns">,
) {
  if (run.contributionSubmissionId === undefined) {
    const source = await ctx.db.get(run.sourceId);
    return source ? [source] : [];
  }

  return await ctx.db
    .query("sources")
    .withIndex("by_contributionSubmissionId_and_submittedAt", (q) =>
      q.eq("contributionSubmissionId", run.contributionSubmissionId),
    )
    .take(MAX_SOURCES_PER_SUBMISSION);
}

async function listRunSourceIds(
  ctx: MutationCtx,
  run: Doc<"smartStorageRuns">,
) {
  return (await listRunSources(ctx, run)).map((source) => source._id);
}

function buildDraftProposal(
  run: Doc<"smartStorageRuns">,
  primarySource: Doc<"sources">,
  sources: Doc<"sources">[],
) {
  const title =
    run.contributionTitle ||
    primarySource.title ||
    inferTitleFromSourceText(primarySource.rawText ?? run.contributionBodyPreview);
  const bodyPreview =
    run.contributionBodyPreview ||
    limitString(primarySource.rawText ?? title, MAX_BODY_PREVIEW_LENGTH);

  return {
    knowledgeType: run.requestedKnowledgeType,
    title: limitString(title, MAX_TITLE_LENGTH),
    bodyPreview: limitString(bodyPreview, MAX_BODY_PREVIEW_LENGTH),
    contextTags: cloneContextTags(run.contextTags),
    proposalConfidence: "medium" as const,
    rationale: limitString(
      sources.length > 1
        ? `Conservative scaffold proposal generated from ${sources.length} submitted Sources and the requested Knowledge Type.`
        : "Conservative scaffold proposal generated from the submitted Source and requested Knowledge Type.",
      MAX_RATIONALE_LENGTH,
    ),
  };
}

function cloneDraftProposal(proposal: SmartStorageProposedEntryDoc) {
  return {
    ...proposal,
    contextTags: cloneContextTags(proposal.contextTags),
  };
}

function cloneContextTags(tags: ContextTagSnapshotInput[]) {
  return tags.map((tag) => ({
    canonicalKey: tag.canonicalKey,
    href: tag.href,
    id: tag.id,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    ...(tag.passageString === undefined
      ? {}
      : { passageString: tag.passageString }),
  }));
}

async function insertProposalSourceCitations(
  ctx: MutationCtx,
  {
    createdAt,
    proposalId,
    sources,
  }: {
    createdAt: number;
    proposalId: Id<"smartStorageProposals">;
    sources: Doc<"sources">[];
  },
) {
  const citations = [];

  for (const source of sources) {
    const citation = buildSourceCitation(source);
    const id = await ctx.db.insert("proposalSourceCitations", {
      proposalId,
      sourceId: source._id,
      citationKind: citation.citationKind,
      ...(citation.excerptText === undefined
        ? {}
        : { excerptText: citation.excerptText }),
      ...(citation.locator === undefined ? {} : { locator: citation.locator }),
      ...(citation.externalUrl === undefined
        ? {}
        : { externalUrl: citation.externalUrl }),
      rationale: citation.rationale,
      createdAt,
    });

    citations.push({
      id,
      sourceId: source._id,
      ...citation,
    });
  }

  return citations;
}

function buildSourceCitation(source: Doc<"sources">) {
  if (source.sourceKind === "externalUrl" && source.externalUrl) {
    return {
      citationKind: "externalUrl" as const,
      externalUrl: source.externalUrl,
      rationale: "External URL Source preserved with the submission.",
    };
  }

  if (source.sourceKind === "uploadedFile") {
    return {
      citationKind: "fileLocator" as const,
      locator: source.fileName ?? source.title ?? "Uploaded file",
      rationale: "Uploaded file Source preserved in Convex storage.",
    };
  }

  if (source.rawText) {
    return {
      citationKind: "textExcerpt" as const,
      excerptText: limitString(source.rawText, MAX_SOURCE_CITATION_EXCERPT_LENGTH),
      rationale: "Authored Text Source preserved with the submission.",
    };
  }

  return {
    citationKind: "wholeSource" as const,
    rationale: "Whole Source supports the scaffold proposal.",
  };
}

async function listProposalSourceCitations(
  ctx: MutationCtx,
  proposalId: Id<"smartStorageProposals">,
) {
  const rows = await ctx.db
    .query("proposalSourceCitations")
    .withIndex("by_proposalId", (q) => q.eq("proposalId", proposalId))
    .take(MAX_SOURCES_PER_SUBMISSION);

  return rows.map((row) => ({
    citationKind: row.citationKind,
    ...(row.excerptText === undefined ? {} : { excerptText: row.excerptText }),
    ...(row.externalUrl === undefined ? {} : { externalUrl: row.externalUrl }),
    id: row._id,
    ...(row.locator === undefined ? {} : { locator: row.locator }),
    ...(row.rationale === undefined ? {} : { rationale: row.rationale }),
    sourceId: row.sourceId,
  }));
}

async function resolveRepresentedIdentity(
  ctx: MutationCtx,
  identity: {
    knowledgeType: EntryKnowledgeType;
    now: number;
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
    return {
      existingEntryId: existingEntry._id,
      status: "targetExists" as const,
    };
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
    status: "available" as const,
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

async function loadSelectedProposalSources(
  ctx: MutationCtx,
  {
    fallbackSourceId,
    proposalId,
    selectedSourceIds,
  }: {
    fallbackSourceId: Id<"sources">;
    proposalId: Id<"smartStorageProposals">;
    selectedSourceIds?: Id<"sources">[];
  },
) {
  const allowedSourceIds = await loadAllowedProposalSourceIds(ctx, {
    fallbackSourceId,
    proposalId,
  });
  const requestedSourceIds =
    selectedSourceIds === undefined || selectedSourceIds.length === 0
      ? Array.from(allowedSourceIds)
      : Array.from(new Set(selectedSourceIds));
  const sources = [];

  for (const sourceId of requestedSourceIds) {
    if (!allowedSourceIds.has(sourceId)) {
      throw new Error("Selected Source is not cited by this Proposal.");
    }
    const source = await ctx.db.get(sourceId);
    if (source) {
      sources.push(source);
    }
  }

  if (sources.length === 0) {
    const fallbackSource = await ctx.db.get(fallbackSourceId);
    if (!fallbackSource) {
      throw new Error("No accepted Sources could be loaded.");
    }
    return [fallbackSource];
  }

  return sources;
}

async function loadAllowedProposalSourceIds(
  ctx: MutationCtx,
  {
    fallbackSourceId,
    proposalId,
  }: {
    fallbackSourceId: Id<"sources">;
    proposalId: Id<"smartStorageProposals">;
  },
) {
  const citationRows = await ctx.db
    .query("proposalSourceCitations")
    .withIndex("by_proposalId", (q) => q.eq("proposalId", proposalId))
    .take(MAX_SOURCES_PER_SUBMISSION);
  const allowedSourceIds = new Set(citationRows.map((row) => row.sourceId));
  if (allowedSourceIds.size === 0) {
    allowedSourceIds.add(fallbackSourceId);
  }

  return allowedSourceIds;
}

async function loadLegacyRepresentationDecisions(
  ctx: MutationCtx,
  {
    fallbackSourceId,
    proposalId,
    selectedSourceIds,
    typeBehaviorDefaultRole,
  }: {
    fallbackSourceId: Id<"sources">;
    proposalId: Id<"smartStorageProposals">;
    selectedSourceIds?: Id<"sources">[];
    typeBehaviorDefaultRole: RepresentationRole;
  },
): Promise<AcceptedRepresentationDecision[]> {
  const sources = await loadSelectedProposalSources(ctx, {
    fallbackSourceId,
    proposalId,
    selectedSourceIds,
  });

  return sources.map((source, index) => ({
    isPrimary: index === 0,
    representationRole: inferRepresentationRoleForSource(
      source,
      typeBehaviorDefaultRole,
    ),
    source,
  }));
}

async function loadAcceptedRepresentationDecisions(
  ctx: MutationCtx,
  {
    allowedRepresentationRoles,
    fallbackSourceId,
    proposalId,
    representationDecisions,
    selectedSourceIds,
    typeBehaviorDefaultRole,
  }: {
    allowedRepresentationRoles: RepresentationRole[];
    fallbackSourceId: Id<"sources">;
    proposalId: Id<"smartStorageProposals">;
    representationDecisions?: RepresentationDecisionInput[];
    selectedSourceIds?: Id<"sources">[];
    typeBehaviorDefaultRole: RepresentationRole;
  },
) {
  return representationDecisions === undefined
    ? await loadLegacyRepresentationDecisions(ctx, {
        fallbackSourceId,
        proposalId,
        selectedSourceIds,
        typeBehaviorDefaultRole,
      })
    : await loadExplicitRepresentationDecisions(ctx, {
        allowedRepresentationRoles,
        fallbackSourceId,
        proposalId,
        representationDecisions,
      });
}

async function loadExplicitRepresentationDecisions(
  ctx: MutationCtx,
  {
    allowedRepresentationRoles,
    fallbackSourceId,
    proposalId,
    representationDecisions,
  }: {
    allowedRepresentationRoles: RepresentationRole[];
    fallbackSourceId: Id<"sources">;
    proposalId: Id<"smartStorageProposals">;
    representationDecisions: RepresentationDecisionInput[];
  },
): Promise<AcceptedRepresentationDecision[]> {
  const allowedSourceIds = await loadAllowedProposalSourceIds(ctx, {
    fallbackSourceId,
    proposalId,
  });
  const seenSourceIds = new Set<Id<"sources">>();
  const includedDecisions: RepresentationDecisionInput[] = [];

  for (const decision of representationDecisions) {
    if (seenSourceIds.has(decision.sourceId)) {
      throw new Error("Each Source can only have one Representation decision.");
    }
    seenSourceIds.add(decision.sourceId);

    if (!allowedSourceIds.has(decision.sourceId)) {
      throw new Error("Selected Source is not cited by this Proposal.");
    }
    if (!allowedRepresentationRoles.includes(decision.representationRole)) {
      throw new Error(
        "Representation Role is not allowed for this Knowledge Type.",
      );
    }
    if (decision.isPrimary && !decision.includeAsRepresentation) {
      throw new Error("Only included Sources can be marked primary.");
    }
    if (decision.includeAsRepresentation) {
      includedDecisions.push(decision);
    }
  }

  if (includedDecisions.length === 0) {
    throw new Error("At least one Source must be accepted as an Entry Representation.");
  }

  const primaryDecisionCount = includedDecisions.filter(
    (decision) => decision.isPrimary,
  ).length;
  if (primaryDecisionCount !== 1) {
    throw new Error("Exactly one accepted Source must be marked primary.");
  }

  const acceptedDecisions: AcceptedRepresentationDecision[] = [];
  for (const decision of includedDecisions) {
    const source = await ctx.db.get(decision.sourceId);
    if (!source) {
      throw new Error("Selected Source not found.");
    }
    acceptedDecisions.push({
      isPrimary: decision.isPrimary,
      representationRole: decision.representationRole,
      source,
    });
  }

  return acceptedDecisions;
}

async function insertAcceptedRepresentationsAndOutputs(
  ctx: MutationCtx,
  {
    entryId,
    now,
    proposedEntry,
    representationDecisions,
  }: {
    entryId: Id<"knowledgeEntries">;
    now: number;
    proposedEntry: SmartStorageProposedEntryDoc;
    representationDecisions: AcceptedRepresentationDecision[];
  },
) {
  const decisionsToInsert: AcceptedRepresentationDecision[] = [];
  for (const decision of representationDecisions) {
    const existingOutput = await ctx.db
      .query("sourceOutputs")
      .withIndex("by_sourceId_and_entryId", (q) =>
        q.eq("sourceId", decision.source._id).eq("entryId", entryId),
      )
      .first();
    if (!existingOutput) {
      decisionsToInsert.push(decision);
    }
  }

  if (decisionsToInsert.some((decision) => decision.isPrimary)) {
    const existingPrimaryRepresentations = await ctx.db
      .query("entryRepresentations")
      .withIndex("by_entryId_and_isPrimary", (q) =>
        q.eq("entryId", entryId).eq("isPrimary", true),
      )
      .take(MAX_SOURCES_PER_SUBMISSION);
    for (const representation of existingPrimaryRepresentations) {
      await ctx.db.patch(representation._id, {
        isPrimary: false,
        updatedAt: now,
      });
    }
  }

  for (const decision of decisionsToInsert) {
    await ctx.db.insert("entryRepresentations", {
      entryId,
      ...toEntryRepresentation(
        decision.source,
        proposedEntry,
        decision.representationRole,
      ),
      isPrimary: decision.isPrimary,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("sourceOutputs", {
      sourceId: decision.source._id,
      entryId,
      outputKind: "produced",
      createdAt: now,
    });
  }
}

async function markProposalAccepted(
  ctx: MutationCtx,
  {
    contributionSubmissionId,
    now,
    proposalId,
  }: {
    contributionSubmissionId?: Id<"contributionSubmissions">;
    now: number;
    proposalId: Id<"smartStorageProposals">;
  },
) {
  await ctx.db.patch(proposalId, {
    status: "accepted",
    updatedAt: now,
  });
  if (contributionSubmissionId !== undefined) {
    await ctx.db.patch(contributionSubmissionId, {
      submissionStatus: "accepted",
      updatedAt: now,
    });
  }
}

function toEntryRepresentation(
  source: Doc<"sources">,
  proposedEntry: SmartStorageProposedEntryDoc,
  representationRole: RepresentationRole,
) {
  if (source.sourceKind === "externalUrl" && source.externalUrl) {
    return {
      representationKind: "externalUrl" as const,
      representationRole,
      externalUrl: source.externalUrl,
    };
  }

  if (source.sourceKind === "uploadedFile" && source.storageId) {
    return {
      representationKind: "storageFile" as const,
      representationRole,
      storageId: source.storageId,
      ...(source.contentType === undefined ? {} : { contentType: source.contentType }),
      ...(source.fileName === undefined ? {} : { fileName: source.fileName }),
      ...(source.fileSizeBytes === undefined
        ? {}
        : { fileSizeBytes: source.fileSizeBytes }),
      ...(source.languageCode === undefined
        ? {}
        : { languageCode: source.languageCode }),
    };
  }

  return {
    representationKind: "plainText" as const,
    representationRole,
    plainText: limitString(
      source.rawText ?? proposedEntry.bodyPreview,
      MAX_SOURCE_TEXT_LENGTH,
    ),
  };
}

function inferRepresentationRoleForSource(
  source: Doc<"sources">,
  typeBehaviorDefaultRole: RepresentationRole,
): RepresentationRole {
  if (source.sourceKind === "externalUrl" && source.externalUrl) {
    return "supportingMaterial";
  }
  if (source.sourceKind === "uploadedFile" && source.storageId) {
    return inferFileRepresentationRole(source);
  }

  return typeBehaviorDefaultRole;
}

function inferFileRepresentationRole(source: Doc<"sources">) {
  return inferFileRepresentationRoleFromMetadata(
    source.contentType,
    source.fileName,
  );
}

function inferFileRepresentationRoleFromMetadata(
  contentTypeValue?: string,
  fileNameValue?: string,
): RepresentationRole {
  const contentType = contentTypeValue?.toLowerCase() ?? "";
  const fileName = fileNameValue?.toLowerCase() ?? "";

  if (contentType.startsWith("audio/") || contentType.startsWith("video/")) {
    return "recording" as const;
  }
  if (contentType.includes("presentation") || fileName.endsWith(".pptx")) {
    return "slides" as const;
  }
  if (contentType.startsWith("image/")) {
    return "thumbnail" as const;
  }
  if (fileName.includes("transcript")) {
    return "transcript" as const;
  }
  if (fileName.includes("manuscript")) {
    return "manuscript" as const;
  }

  return "supportingMaterial" as const;
}

function inferRepresentationRoleForMigration(
  representation: LegacyEntryRepresentation,
): RepresentationRole {
  if (representation.representationKind === "externalUrl") {
    return "supportingMaterial";
  }
  if (representation.representationKind === "storageFile") {
    return inferFileRepresentationRoleFromMetadata(
      representation.contentType,
      representation.fileName,
    );
  }
  if (
    representation.representationKind === "audio" ||
    representation.representationKind === "video"
  ) {
    return "recording";
  }
  if (
    (representation.representationKind === "plainText" ||
      representation.representationKind === "prosemirror") &&
    representation.isPrimary
  ) {
    return "primaryContent";
  }

  return "unspecified";
}

function getRepresentedCanonicalKey({
  knowledgeType,
  title,
  userId,
}: {
  knowledgeType: EntryKnowledgeType;
  now: number;
  title: string;
  userId: Id<"users">;
}) {
  return `smart-storage:${userId}:${knowledgeType}:${normalizeLookupKey(title)}`;
}

function getContextLookupKey(tag: ContextTagSnapshotInput) {
  return normalizeLookupKey(tag.canonicalKey || tag.id || tag.label);
}

function inferTitleFromSourceText(sourceText: string) {
  return (
    sourceText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "Untitled Source"
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
