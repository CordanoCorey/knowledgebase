import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalQuery,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAppAccess } from "./lib/appAccess";
import {
  appendAutomaticContextTags,
  insertEntryContextTags,
} from "./lib/automaticContextTags";
import {
  ENTRY_KNOWLEDGE_TYPES,
  getApplicableHumanWeight,
  getTypeBehavior,
  getTypeBehaviorSnapshot,
  type EntryKnowledgeType,
  type RepresentationRole,
} from "./lib/typeBehavior";
import {
  getEntryContextTagIds,
  recordContextExpertiseEvidence,
} from "./lib/contextExpertiseEvidence";
import { inferFileRepresentationRoleFromMetadata } from "./lib/fileRepresentationRoles";

// Smart Storage is a staged pipeline: preserve submitted sources, run bounded
// proposal generation, then require explicit user acceptance before gold entries
// or representations are written.
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
const MAX_SESSION_RUNS = 50;
const MAX_SESSION_PROPOSALS_PER_STATUS = 50;
const DEFAULT_REVIEW_SLOT_LIMIT = 50;
const MAX_REVIEW_SLOT_LIMIT = 100;
const MAX_MODEL_SOURCE_TEXT_LENGTH = 4_000;
const MAX_MODEL_INPUT_LENGTH = 24_000;
const MAX_MODEL_ERROR_LENGTH = 500;
const MAX_RAW_MODEL_REQUEST_LENGTH = 36_000;
const MAX_REFRESH_REASON_LENGTH = 500;
const MAX_REFRESH_CANDIDATE_KEY_LENGTH = 500;

const SMART_STORAGE_CONTRACT_KEY = "mvp-smart-storage-contract";
const SMART_STORAGE_ENTRY_KNOWLEDGE_TYPES = ENTRY_KNOWLEDGE_TYPES.filter(
  (knowledgeType) => knowledgeType !== "announcement",
);
const TYPE_BEHAVIOR_SNAPSHOT_TEXT =
  "Use the Type Behavior registry for identity, source citation, representation role, primary representation, Human Weight defaults, and Human Weight credit basis.";
const SMART_STORAGE_SOURCE_INTERPRETATION_POLICY = {
  authoredTextSource:
    "sources[].rawText is Authored Text Source and must remain preserved as raw Source material.",
  editorGuidance:
    "The slim Contribution Editor does not ask the User to classify Contribution Notes, so guidance-like text may appear inside Authored Text Sources.",
  guidanceUse:
    "Use guidance-like text to steer proposal choices, source citations, proposalConfidence, and rationale when appropriate.",
  representedKnowledge:
    "Do not treat guidance-like text as represented knowledge by default.",
  storedContributionNote:
    "Do not synthesize contributionSubmission.contributionNote from source text; only separately supplied contributionSubmission.contributionNote is an explicit Contribution Note.",
  ambiguity:
    "If guidance and substantive material are ambiguous, lower proposalConfidence and explain the ambiguity in rationale.",
} as const;
const SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION =
  "mvp-smart-storage-contract-v3";
// The snapshot is persisted with each run/proposal so future model or schema
// changes do not erase the contract used for an existing decision.
const SMART_STORAGE_CONTRACT_SNAPSHOT = {
  contractKind: "contributionSubmissionToSmartStorageProposal",
  version: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
  purpose:
    "Answer what information the User intends to contribute, given the Knowledge Types currently understood by the app.",
  layerMapping: {
    bronze:
      "Contribution Submissions preserve submitted Sources as close as possible to their original form.",
    silver:
      "Smart Storage Proposals are reviewable probability judgments about how Bronze Sources map to one proposed Knowledge Entry.",
    gold:
      "Knowledge Entries are confirmed typed knowledge created or updated only after user review.",
  },
  process: [
    "Create a durable Contribution Submission and child Sources before model execution.",
    "Queue one Smart Storage Run using the current Smart Storage Contract and Type Behavior snapshots.",
    "Build request-specific input from the Contribution Submission, Sources, current Knowledge Context, and snapshots.",
    "Ask the current model adapter for one structured Smart Storage Proposal.",
    "Store a Silver Layer Proposal only after returned JSON is parsed and validated.",
    "Keep failed, invalid, or no-proposal outcomes on the Smart Storage Run without creating a Proposal.",
    "Require user confirmation before any Gold Layer Knowledge Entry is created or updated.",
  ],
  modelProviderStrategy: {
    localFirst:
      "Use deterministic application logic for previews, cheap scaffolds, and fallback behavior before relying on model output.",
    currentAdapter:
      "Call OpenAI's Responses API for the first LLM-backed Smart Storage implementation.",
    futureAdapter:
      "Keep the contract provider-neutral so a self-hosted proprietary model can replace the OpenAI adapter later.",
  },
  proposalShape: {
    knowledgeType:
      "One authorable Knowledge Type from the app's current Entry Knowledge Type set.",
    title: "A bounded proposed Knowledge Entry title.",
    bodyPreview:
      "A bounded preview of the represented knowledge, not raw internal reasoning.",
    contextTags:
      "A bounded set of proposed Knowledge Context Tag snapshots for review.",
    proposalConfidence:
      "A coarse low, medium, or high review signal; not truth, Human Weight, or approval.",
    rationale:
      "A bounded explanation of why this Source appears to map to the proposed Knowledge Entry.",
  },
  sourceInterpretationPolicy: SMART_STORAGE_SOURCE_INTERPRETATION_POLICY,
  boundaries: [
    "Do not expose or rely on the raw Convex persistence schema as the model contract.",
    "Do not synthesize Contribution Notes from Authored Text Sources.",
    "Do not treat guidance-like Source text as represented knowledge by default.",
    "Do not create Gold Layer Knowledge Entries from model output without user confirmation.",
    "Do not invent extracted file, media, or URL facts when advanced extraction has not supplied them.",
  ],
} as const;
const SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT = JSON.stringify(
  SMART_STORAGE_CONTRACT_SNAPSHOT,
  null,
  2,
);
const DETERMINISTIC_GENERATOR_VERSION = "mvp-deterministic-scaffold-v1";
const REFRESH_GENERATOR_VERSION = "mvp-refresh-review-v1";
const OPENAI_RESPONSES_API_URL = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_SMART_STORAGE_MODEL = "gpt-5.4-nano";
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
    knowledgeType: { type: "string", enum: SMART_STORAGE_ENTRY_KNOWLEDGE_TYPES },
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
  thumbnailUrl?: string;
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
type ContributionUploadedFileInput = {
  temporaryUploadId?: Id<"temporaryUploads">;
  storageId: Id<"_storage">;
  fileName: string;
  contentType?: string;
  fileSizeBytes?: number;
  languageCode?: string;
  title?: string;
};
type StoredFileMetadata = {
  contentType?: string;
  size: number;
};
type NormalizedUploadedFile = {
  storageId: Id<"_storage">;
  fileName: string;
  contentType?: string;
  fileSizeBytes?: number;
  languageCode?: string;
  title?: string;
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
  rawModelOutput?: string;
  rawModelRequest?: string;
  smartStorageProposalId?: Id<"smartStorageProposals">;
  smartStorageRunId: Id<"smartStorageRuns">;
  status: "drafted" | "failed" | "noProposal";
};
type SmartStorageProposalStatus = Doc<"smartStorageProposals">["status"];
type SmartStorageSessionState =
  | "preservingSources"
  | "preparingPrimaryProposal"
  | "primaryReady"
  | "awaitingPrerequisites"
  | "primarySaved"
  | "reviewPending"
  | "complete"
  | "cancelled"
  | "sourcePreservationFailed";
type SmartStorageSessionProposalRole =
  | "primary"
  | "prerequisite"
  | "secondary"
  | "referenceResolution"
  | "refresh"
  | "reprocessing"
  | "cleanup";
type SmartStorageRefreshOrigin = "contractRefresh" | "reprocessing";
type SmartStorageRefreshSuggestionKind =
  | "staleProposalRefresh"
  | "suggestedEdit"
  | "typeReclassification"
  | "newDerivedEntry"
  | "referenceResolution";
type SmartStorageProposalAcceptabilitySummary = {
  blockedByProposalIds: Id<"smartStorageProposals">[];
  reason?:
    | "prerequisitesPending"
    | "primaryAnchorRequired"
    | "resolutionRequired";
  status: "ready" | "blocked" | "needsResolution" | "accepted" | "closed";
};

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
  thumbnailUrl: v.optional(v.string()),
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

const draftLinkPreviewResult = v.union(
  v.object({
    status: v.literal("fetched"),
    url: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    siteName: v.optional(v.string()),
  }),
  v.object({
    status: v.literal("failed"),
    url: v.string(),
    error: v.string(),
  }),
);

type DraftLinkPreviewResult =
  | {
      status: "fetched";
      url: string;
      title?: string;
      description?: string;
      imageUrl?: string;
      siteName?: string;
    }
  | {
      status: "failed";
      url: string;
      error: string;
    };

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

const contributionSubmissionStatus = v.union(
  v.literal("submitted"),
  v.literal("processing"),
  v.literal("reviewReady"),
  v.literal("partiallyAccepted"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("cancelled"),
);

const smartStorageRunStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("noProposal"),
  v.literal("failed"),
  v.literal("superseded"),
);

const smartStorageProposalStatus = v.union(
  v.literal("drafted"),
  v.literal("needsResolution"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("stale"),
);

const smartStorageSessionState = v.union(
  v.literal("preservingSources"),
  v.literal("preparingPrimaryProposal"),
  v.literal("primaryReady"),
  v.literal("awaitingPrerequisites"),
  v.literal("primarySaved"),
  v.literal("reviewPending"),
  v.literal("complete"),
  v.literal("cancelled"),
  v.literal("sourcePreservationFailed"),
);

const smartStorageSessionProposalRole = v.union(
  v.literal("primary"),
  v.literal("prerequisite"),
  v.literal("secondary"),
  v.literal("referenceResolution"),
  v.literal("refresh"),
  v.literal("reprocessing"),
  v.literal("cleanup"),
);

const smartStorageRefreshRequestMode = v.union(
  v.literal("refresh"),
  v.literal("reprocessing"),
);

const smartStorageRefreshOrigin = v.union(
  v.literal("contractRefresh"),
  v.literal("reprocessing"),
);

const smartStorageRefreshSuggestionKind = v.union(
  v.literal("staleProposalRefresh"),
  v.literal("suggestedEdit"),
  v.literal("typeReclassification"),
  v.literal("newDerivedEntry"),
  v.literal("referenceResolution"),
);

const smartStorageRefreshSummary = v.object({
  candidateKey: v.string(),
  origin: smartStorageRefreshOrigin,
  originLabel: v.string(),
  reason: v.string(),
  sourceEntryId: v.optional(v.id("knowledgeEntries")),
  sourceProposalId: v.optional(v.id("smartStorageProposals")),
  suggestionKind: smartStorageRefreshSuggestionKind,
  targetContractSnapshotVersion: v.optional(v.string()),
  targetTypeBehaviorSnapshotVersion: v.optional(v.string()),
});

const smartStorageProposalDependencyRequirementKind = v.union(
  v.literal("referent"),
  v.literal("field"),
  v.literal("relationship"),
  v.literal("primaryAnchor"),
);

const smartStorageProposalDependencySummary = v.object({
  requiredByProposalId: v.optional(v.id("smartStorageProposals")),
  requirementKind: smartStorageProposalDependencyRequirementKind,
  requirementKey: v.string(),
  label: v.string(),
});

const smartStorageReferenceResolutionOutcome = v.union(
  v.literal("pending"),
  v.literal("matchedKnownReferent"),
  v.literal("createdByAcceptedEntry"),
);

const smartStorageReferenceResolutionMode = v.union(
  v.literal("knownReferentMatch"),
  v.literal("newEntryProposal"),
);

const smartStorageReferenceResolutionSummary = v.object({
  candidateTag: v.optional(contextTagSnapshot),
  candidateTagId: v.optional(v.id("tags")),
  mode: smartStorageReferenceResolutionMode,
  outcome: smartStorageReferenceResolutionOutcome,
  requiredTag: contextTagSnapshot,
  resolvedTag: v.optional(contextTagSnapshot),
  resolvedTagId: v.optional(v.id("tags")),
});

const smartStorageProposalAcceptabilityStatus = v.union(
  v.literal("ready"),
  v.literal("blocked"),
  v.literal("needsResolution"),
  v.literal("accepted"),
  v.literal("closed"),
);

const smartStorageProposalBlockedReason = v.union(
  v.literal("prerequisitesPending"),
  v.literal("primaryAnchorRequired"),
  v.literal("resolutionRequired"),
);

const smartStorageProposalAcceptabilitySummary = v.object({
  blockedByProposalIds: v.array(v.id("smartStorageProposals")),
  reason: v.optional(smartStorageProposalBlockedReason),
  status: smartStorageProposalAcceptabilityStatus,
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

const smartStorageSessionSourceCounts = v.object({
  externalUrl: v.number(),
  manualEntry: v.number(),
  pastedText: v.number(),
  total: v.number(),
  uploadedFile: v.number(),
});

const smartStorageSessionRunSummary = v.object({
  completedAt: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  id: v.id("smartStorageRuns"),
  status: smartStorageRunStatus,
  updatedAt: v.number(),
});

const smartStorageSessionProposalCounts = v.object({
  accepted: v.number(),
  drafted: v.number(),
  needsResolution: v.number(),
  rejected: v.number(),
  stale: v.number(),
  total: v.number(),
});

const smartStorageSessionProposalSummary = v.object({
  acceptReady: v.boolean(),
  acceptability: smartStorageProposalAcceptabilitySummary,
  contributionSubmissionId: v.optional(v.id("contributionSubmissions")),
  createdAt: v.number(),
  currentProposal: smartStorageProposedEntry,
  dependency: v.optional(smartStorageProposalDependencySummary),
  id: v.id("smartStorageProposals"),
  refresh: v.optional(smartStorageRefreshSummary),
  referenceResolution: v.optional(smartStorageReferenceResolutionSummary),
  role: smartStorageSessionProposalRole,
  smartStorageRunId: v.id("smartStorageRuns"),
  sourceCitations: v.array(proposalSourceCitationSummary),
  sourceId: v.id("sources"),
  sourceIds: v.array(v.id("sources")),
  status: smartStorageProposalStatus,
  updatedAt: v.number(),
});

const smartStorageSessionSummary = v.object({
  acceptedPrimaryEntry: v.optional(knowledgeEntrySummary),
  activeRun: v.optional(smartStorageSessionRunSummary),
  canCancel: v.boolean(),
  contributionSubmission: v.object({
    bodyPreview: v.string(),
    createdAt: v.number(),
    id: v.id("contributionSubmissions"),
    primaryIntendedKnowledgeType: entryKnowledgeType,
    status: contributionSubmissionStatus,
    title: v.string(),
    updatedAt: v.number(),
  }),
  isComplete: v.boolean(),
  latestRun: v.optional(smartStorageSessionRunSummary),
  pendingSecondaryProposals: v.array(smartStorageSessionProposalSummary),
  prerequisiteProposals: v.array(smartStorageSessionProposalSummary),
  primaryProposal: v.optional(smartStorageSessionProposalSummary),
  proposalCountsByStatus: smartStorageSessionProposalCounts,
  sourceCounts: smartStorageSessionSourceCounts,
  state: smartStorageSessionState,
});

const smartStorageReviewSlotGroup = v.object({
  href: v.string(),
  id: v.string(),
  kind: v.union(v.literal("session"), v.literal("primaryEntry")),
  title: v.string(),
});

const smartStorageReviewSlotOriginSession = v.object({
  href: v.string(),
  id: v.id("contributionSubmissions"),
  title: v.string(),
});

const smartStorageReviewAssignmentSummary = v.object({
  assignedAt: v.number(),
  assignedByUserId: v.id("users"),
  targetKind: v.literal("user"),
  targetLabel: v.string(),
  targetUserId: v.id("users"),
});

const smartStorageReviewSlotSummary = v.object({
  acceptReady: v.boolean(),
  acceptability: smartStorageProposalAcceptabilitySummary,
  assignment: v.optional(smartStorageReviewAssignmentSummary),
  bodyPreview: v.string(),
  canAssign: v.boolean(),
  contextPreviewTagLabels: v.array(v.string()),
  contextPreviewTags: v.optional(v.array(contextTagSnapshot)),
  contributionSubmissionId: v.id("contributionSubmissions"),
  createdAt: v.number(),
  evidenceSummary: v.string(),
  group: smartStorageReviewSlotGroup,
  href: v.string(),
  id: v.string(),
  originSession: smartStorageReviewSlotOriginSession,
  proposedKnowledgeType: entryKnowledgeType,
  refresh: v.optional(smartStorageRefreshSummary),
  reviewScopeLabel: v.string(),
  referenceResolution: v.optional(smartStorageReferenceResolutionSummary),
  role: smartStorageSessionProposalRole,
  smartStorageProposalId: v.id("smartStorageProposals"),
  smartStorageRunId: v.id("smartStorageRuns"),
  sourceCount: v.number(),
  status: smartStorageProposalStatus,
  title: v.string(),
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
  rawModelOutput: v.optional(v.string()),
  rawModelRequest: v.optional(v.string()),
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

const smartStorageRefreshRequestResult = v.object({
  role: smartStorageSessionProposalRole,
  smartStorageProposalId: v.union(v.id("smartStorageProposals"), v.null()),
  sourceEntryId: v.optional(v.id("knowledgeEntries")),
  sourceProposalId: v.optional(v.id("smartStorageProposals")),
  status: v.union(
    v.literal("created"),
    v.literal("existing"),
    v.literal("dismissed"),
  ),
});

const smartStorageRefreshDismissResult = v.object({
  smartStorageProposalId: v.id("smartStorageProposals"),
  status: v.literal("dismissed"),
});

export const getSessionSummary = query({
  args: {
    contributionSubmissionId: v.id("contributionSubmissions"),
    smartStorageProposalId: v.optional(v.id("smartStorageProposals")),
  },
  returns: v.union(smartStorageSessionSummary, v.null()),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const contributionSubmission = await ctx.db.get(
      args.contributionSubmissionId,
    );
    if (!contributionSubmission) {
      return null;
    }
    const requestedProposal =
      args.smartStorageProposalId === undefined
        ? null
        : await ctx.db.get(args.smartStorageProposalId);
    if (
      requestedProposal !== null &&
      requestedProposal.contributionSubmissionId !== args.contributionSubmissionId
    ) {
      throw new Error("Unauthorized");
    }

    const canManageSession = canManageSmartStorageSubmission(
      contributionSubmission,
      access,
    );
    const isAssignedReviewer =
      requestedProposal !== null &&
      isAssignedReviewSlotReviewer(requestedProposal, access);
    if (!canManageSession && !isAssignedReviewer) {
      throw new Error("Unauthorized");
    }
    const isLimitedDelegatedView = !canManageSession && requestedProposal !== null;

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_contributionSubmissionId_and_submittedAt", (q) =>
        q.eq("contributionSubmissionId", args.contributionSubmissionId),
      )
      .take(MAX_SOURCES_PER_SUBMISSION);
    const runs = await ctx.db
      .query("smartStorageRuns")
      .withIndex("by_contributionSubmissionId_and_createdAt", (q) =>
        q.eq("contributionSubmissionId", args.contributionSubmissionId),
      )
      .order("desc")
      .take(MAX_SESSION_RUNS);
    const proposals = await listSessionProposals(
      ctx,
      args.contributionSubmissionId,
    );
    const proposalsAscending = [...proposals].sort(
      (left, right) => left.createdAt - right.createdAt,
    );
    const visibleProposals =
      isLimitedDelegatedView && requestedProposal !== null
        ? [requestedProposal]
        : proposals;
    const visibleProposalIds = new Set(
      visibleProposals.map((proposal) => proposal._id),
    );
    const visibleSources =
      isLimitedDelegatedView && requestedProposal !== null
        ? await listProposalReviewSources(ctx, requestedProposal)
        : sources;
    const latestRun = runs[0];
    const activeRun = runs.find((run) => isActiveSmartStorageRun(run));
    const sourceCounts = countSessionSources(visibleSources);
    const proposalCountsByStatus = countSessionProposals(visibleProposals);
    const primaryProposal = selectPrimaryProposal(
      contributionSubmission,
      proposalsAscending,
    );
    const acceptedPrimaryEntry =
      primaryProposal?.status === "accepted"
        ? await findAcceptedEntryForProposal(ctx, primaryProposal)
        : null;
    const acceptedPrimaryEntrySummary =
      acceptedPrimaryEntry === null ||
      !isKnowledgeEntryVisibleToAccess(acceptedPrimaryEntry, access)
        ? undefined
        : summarizeEntry(
            acceptedPrimaryEntry,
            await getContributorSummary(
              ctx,
              acceptedPrimaryEntry.createdByUserId ??
                contributionSubmission.submittedByUserId,
            ),
          );
    const prerequisiteProposalDocs = selectPrerequisiteProposals(
      proposalsAscending,
      primaryProposal,
      acceptedPrimaryEntry !== null,
    ).filter((proposal) => visibleProposalIds.has(proposal._id));
    const pendingSecondaryProposalDocs = selectPendingSecondaryProposals(
      proposalsAscending,
      primaryProposal,
      prerequisiteProposalDocs,
    ).filter((proposal) => visibleProposalIds.has(proposal._id));
    const visiblePrimaryProposal =
      primaryProposal === undefined || !visibleProposalIds.has(primaryProposal._id)
        ? undefined
        : primaryProposal;
    const primaryProposalSummary =
      visiblePrimaryProposal === undefined
        ? undefined
        : await toSmartStorageSessionProposalSummary(ctx, {
            acceptability: getSmartStorageProposalAcceptability({
              acceptedPrimaryEntry,
              primaryProposal,
              proposal: visiblePrimaryProposal,
              proposalsAscending,
              role: "primary",
            }),
            proposal: visiblePrimaryProposal,
            role: "primary",
          });
    const prerequisiteProposals = [];
    for (const proposal of prerequisiteProposalDocs) {
      const role = getSmartStorageProposalRole(proposal, {
        primaryProposal,
      });
      prerequisiteProposals.push(
        await toSmartStorageSessionProposalSummary(ctx, {
          acceptability: getSmartStorageProposalAcceptability({
            acceptedPrimaryEntry,
            primaryProposal,
            proposal,
            proposalsAscending,
            role,
          }),
          proposal,
          role,
        }),
      );
    }
    const pendingSecondaryProposals = [];
    for (const proposal of pendingSecondaryProposalDocs) {
      const role = getSmartStorageProposalRole(proposal, {
        primaryProposal,
      });
      pendingSecondaryProposals.push(
        await toSmartStorageSessionProposalSummary(ctx, {
          acceptability: getSmartStorageProposalAcceptability({
            acceptedPrimaryEntry,
            primaryProposal,
            proposal,
            proposalsAscending,
            role,
          }),
          proposal,
          role,
        }),
      );
    }
    const isComplete = isSmartStorageSessionComplete({
      proposals: visibleProposals,
      runs,
    });
    const state = deriveSmartStorageSessionState({
      activeRun,
      acceptedPrimaryEntry,
      isComplete,
      latestRun,
      pendingSecondaryProposalCount: pendingSecondaryProposals.length,
      prerequisiteProposalCount: prerequisiteProposals.length,
      primaryProposal: visiblePrimaryProposal,
      sourceCount: sourceCounts.total,
      submissionStatus: contributionSubmission.submissionStatus,
    });
    const canCancel =
      canManageSession && !isComplete && state !== "cancelled";

    return {
      ...(acceptedPrimaryEntrySummary === undefined
        ? {}
        : { acceptedPrimaryEntry: acceptedPrimaryEntrySummary }),
      ...(activeRun === undefined
        ? {}
        : { activeRun: toSmartStorageSessionRunSummary(activeRun) }),
      canCancel,
      contributionSubmission: {
        bodyPreview: contributionSubmission.primaryIntendedBodyPreview,
        createdAt: contributionSubmission.createdAt,
        id: contributionSubmission._id,
        primaryIntendedKnowledgeType:
          contributionSubmission.primaryIntendedKnowledgeType,
        status: contributionSubmission.submissionStatus,
        title: contributionSubmission.primaryIntendedTitle,
        updatedAt: contributionSubmission.updatedAt,
      },
      isComplete,
      ...(latestRun === undefined
        ? {}
        : { latestRun: toSmartStorageSessionRunSummary(latestRun) }),
      pendingSecondaryProposals,
      prerequisiteProposals,
      ...(primaryProposalSummary === undefined
        ? {}
        : { primaryProposal: primaryProposalSummary }),
      proposalCountsByStatus,
      sourceCounts,
      state,
    };
  },
});

export const listReviewSlotsForCurrentUser = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(smartStorageReviewSlotSummary),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const limit = normalizeReviewSlotLimit(args.limit);
    if (limit < 1) {
      return [];
    }

    const proposals = await listCurrentUserOpenReviewSlotProposals(
      ctx,
      access.userId,
      limit,
    );
    const reviewSlots = [];

    for (const proposal of proposals) {
      if (proposal.contributionSubmissionId === undefined) {
        continue;
      }

      const contributionSubmission = await ctx.db.get(
        proposal.contributionSubmissionId,
      );
      if (
        !contributionSubmission ||
        proposal.contributionSubmissionId === undefined
      ) {
        continue;
      }
      const authorization = await getSmartStorageProposalAuthorization(ctx, {
        access,
        proposal,
      });
      if (!authorization.canManage && !authorization.isAssignedReviewer) {
        continue;
      }

      const sessionProposals = await listSessionProposals(
        ctx,
        contributionSubmission._id,
      );
      const proposalsAscending = [...sessionProposals].sort(
        (left, right) => left.createdAt - right.createdAt,
      );
      const primaryProposal = selectPrimaryProposal(
        contributionSubmission,
        proposalsAscending,
      );
      const acceptedPrimaryEntry =
        primaryProposal?.status === "accepted"
          ? await findAcceptedEntryForProposal(ctx, primaryProposal)
          : null;
      const role = getSmartStorageProposalRole(proposal, {
        primaryProposal,
      });

      reviewSlots.push(
        await toSmartStorageReviewSlotSummary(ctx, {
          acceptability: getSmartStorageProposalAcceptability({
            acceptedPrimaryEntry,
            primaryProposal,
            proposal,
            proposalsAscending,
            role,
          }),
          acceptedPrimaryEntry,
          access,
          canAssign: authorization.canManage,
          contributionSubmission,
          proposal,
          role,
        }),
      );
    }

    return reviewSlots.sort(compareSmartStorageReviewSlots).slice(0, limit);
  },
});

export const assignReviewSlot = mutation({
  args: {
    smartStorageProposalId: v.id("smartStorageProposals"),
    targetKind: v.literal("user"),
    targetUserId: v.id("users"),
  },
  returns: v.object({
    assignment: smartStorageReviewAssignmentSummary,
    smartStorageProposalId: v.id("smartStorageProposals"),
    status: v.literal("assigned"),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const proposal = await ctx.db.get(args.smartStorageProposalId);
    if (!proposal) {
      throw new Error("Smart Storage Proposal not found.");
    }
    if (!isOpenSmartStorageProposal(proposal)) {
      throw new Error("Smart Storage Proposal is not open for assignment.");
    }

    const authorization = await getSmartStorageProposalAuthorization(ctx, {
      access,
      proposal,
    });
    if (!authorization.canManage) {
      throw new Error("Unauthorized");
    }
    if (authorization.contributionSubmission === null) {
      throw new Error(
        "Smart Storage Proposal must be linked to a Contribution Submission before assignment.",
      );
    }

    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser || targetUser.isActive !== true) {
      throw new Error("Assigned reviewer must be an active user.");
    }

    const now = Date.now();
    await ctx.db.patch(proposal._id, {
      reviewAssignedAt: now,
      reviewAssignedByUserId: access.userId,
      reviewAssignedUserId: args.targetUserId,
      reviewAssignmentTargetKind: args.targetKind,
      updatedAt: now,
    });

    const updatedProposal = await ctx.db.get(proposal._id);
    if (!updatedProposal) {
      throw new Error("Assigned Smart Storage Proposal could not be loaded.");
    }
    const assignment = await getSmartStorageReviewAssignmentSummary(
      ctx,
      updatedProposal,
    );
    if (assignment === undefined) {
      throw new Error("Assigned reviewer could not be summarized.");
    }

    return {
      assignment,
      smartStorageProposalId: proposal._id,
      status: "assigned" as const,
    };
  },
});

export const requestRefreshForProposal = mutation({
  args: {
    candidateTagId: v.optional(v.id("tags")),
    mode: v.optional(smartStorageRefreshRequestMode),
    reason: v.optional(v.string()),
    requiredTag: v.optional(contextTagSnapshot),
    smartStorageProposalId: v.id("smartStorageProposals"),
    suggestionKind: v.optional(smartStorageRefreshSuggestionKind),
    targetKnowledgeType: v.optional(entryKnowledgeType),
  },
  returns: smartStorageRefreshRequestResult,
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const sourceProposal = await ctx.db.get(args.smartStorageProposalId);
    if (!sourceProposal) {
      throw new Error("Smart Storage Proposal not found.");
    }
    const authorization = await assertCanReviewSmartStorageProposal(ctx, {
      access,
      proposal: sourceProposal,
    });
    if (authorization.contributionSubmission === null) {
      throw new Error(
        "Smart Storage Proposal must be linked to a Contribution Submission before refresh.",
      );
    }

    const run = await ctx.db.get(sourceProposal.smartStorageRunId);
    if (!run) {
      throw new Error("Smart Storage Run not found.");
    }
    if (
      sourceProposal.contributionSubmissionId === undefined ||
      run.contributionSubmissionId === undefined ||
      run.contributionSubmissionId !== sourceProposal.contributionSubmissionId
    ) {
      throw new Error("Proposal and Run belong to different Contribution Submissions.");
    }

    return await createRefreshReviewProposal(ctx, {
      access,
      candidateTagId: args.candidateTagId,
      contributionSubmission: authorization.contributionSubmission,
      mode: args.mode ?? "refresh",
      reason: args.reason,
      requiredTag: args.requiredTag,
      sourceProposal,
      suggestionKind: args.suggestionKind,
      targetKnowledgeType: args.targetKnowledgeType,
    });
  },
});

export const requestReprocessingForEntry = mutation({
  args: {
    candidateTagId: v.optional(v.id("tags")),
    entryId: v.id("knowledgeEntries"),
    reason: v.optional(v.string()),
    requiredTag: v.optional(contextTagSnapshot),
    suggestionKind: v.optional(smartStorageRefreshSuggestionKind),
    targetKnowledgeType: v.optional(entryKnowledgeType),
  },
  returns: smartStorageRefreshRequestResult,
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Knowledge Entry not found.");
    }
    if (
      entry.createdByUserId !== access.userId &&
      access.systemRole !== "systemAdmin"
    ) {
      throw new Error("Unauthorized");
    }

    const sourceOutput = await ctx.db
      .query("sourceOutputs")
      .withIndex("by_entryId_and_sourceId", (q) => q.eq("entryId", entry._id))
      .first();
    if (!sourceOutput) {
      throw new Error(
        "Knowledge Entry does not have preserved Smart Storage Source material for reprocessing.",
      );
    }
    const source = await ctx.db.get(sourceOutput.sourceId);
    if (!source || source.contributionSubmissionId === undefined) {
      throw new Error(
        "Reprocessing requires a preserved Source linked to a Contribution Submission.",
      );
    }
    const contributionSubmission = await ctx.db.get(
      source.contributionSubmissionId,
    );
    if (!contributionSubmission) {
      throw new Error("Contribution Submission not found.");
    }
    if (!canManageSmartStorageSubmission(contributionSubmission, access)) {
      throw new Error("Unauthorized");
    }

    return await createRefreshReviewProposal(ctx, {
      access,
      candidateTagId: args.candidateTagId,
      contributionSubmission,
      mode: "reprocessing",
      reason: args.reason,
      requiredTag: args.requiredTag,
      sourceEntry: entry,
      sourceId: source._id,
      suggestionKind: args.suggestionKind,
      targetKnowledgeType: args.targetKnowledgeType,
    });
  },
});

export const dismissRefreshSuggestion = mutation({
  args: {
    smartStorageProposalId: v.id("smartStorageProposals"),
  },
  returns: smartStorageRefreshDismissResult,
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const proposal = await ctx.db.get(args.smartStorageProposalId);
    if (!proposal) {
      throw new Error("Smart Storage Proposal not found.");
    }
    const authorization = await assertCanReviewSmartStorageProposal(ctx, {
      access,
      proposal,
    });
    if (authorization.contributionSubmission === null) {
      throw new Error(
        "Smart Storage Proposal must be linked to a Contribution Submission before dismissal.",
      );
    }

    const refresh = getSmartStorageRefreshSummary(proposal);
    if (refresh === undefined) {
      throw new Error("Smart Storage Proposal is not a refresh suggestion.");
    }
    const now = Date.now();
    await rememberRefreshDismissal(ctx, {
      contributionSubmission: authorization.contributionSubmission,
      dismissedByUserId: access.userId,
      dismissalKind: "dismissed",
      now,
      refresh,
    });
    if (proposal.status !== "accepted" && proposal.status !== "rejected") {
      await ctx.db.patch(proposal._id, {
        status: "rejected",
        updatedAt: now,
      });
    }

    return {
      smartStorageProposalId: proposal._id,
      status: "dismissed" as const,
    };
  },
});

export const cancelSession = mutation({
  args: {
    contributionSubmissionId: v.id("contributionSubmissions"),
  },
  returns: v.object({
    cancelledProposalCount: v.number(),
    contributionSubmissionId: v.id("contributionSubmissions"),
    status: v.literal("cancelled"),
    supersededRunCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const contributionSubmission = await ctx.db.get(
      args.contributionSubmissionId,
    );
    if (!contributionSubmission) {
      throw new Error("Contribution Submission not found.");
    }
    if (!canManageSmartStorageSubmission(contributionSubmission, access)) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const proposals = await listSessionProposals(
      ctx,
      args.contributionSubmissionId,
    );
    let cancelledProposalCount = 0;
    for (const proposal of proposals) {
      if (!isOpenSmartStorageProposal(proposal)) {
        continue;
      }
      await ctx.db.patch(proposal._id, {
        status: "stale",
        updatedAt: now,
      });
      cancelledProposalCount += 1;
    }

    const runs = await ctx.db
      .query("smartStorageRuns")
      .withIndex("by_contributionSubmissionId_and_createdAt", (q) =>
        q.eq("contributionSubmissionId", args.contributionSubmissionId),
      )
      .take(MAX_SESSION_RUNS);
    let supersededRunCount = 0;
    for (const run of runs) {
      if (!isActiveSmartStorageRun(run)) {
        continue;
      }
      await ctx.db.patch(run._id, {
        completedAt: now,
        status: "superseded",
        updatedAt: now,
      });
      supersededRunCount += 1;
    }

    await ctx.db.patch(args.contributionSubmissionId, {
      submissionStatus: "cancelled",
      updatedAt: now,
    });

    return {
      cancelledProposalCount,
      contributionSubmissionId: args.contributionSubmissionId,
      status: "cancelled" as const,
      supersededRunCount,
    };
  },
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
    const uploadedFile = await normalizeUploadedFileFromStorage(ctx, args);
    const temporaryUploadId = await ctx.db.insert("temporaryUploads", {
      storageId: args.storageId,
      uploadedByUserId: access.userId,
      fileName: uploadedFile.fileName,
      ...(uploadedFile.contentType === undefined
        ? {}
        : { contentType: uploadedFile.contentType }),
      ...(uploadedFile.fileSizeBytes === undefined
        ? {}
        : { fileSizeBytes: uploadedFile.fileSizeBytes }),
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

// Actions handle model/network work and delegate all database reads/writes to
// queries/mutations so Convex transaction boundaries stay explicit.
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

    const requestBody = buildOpenAiSmartStorageRequest(executionInput);
    const rawModelRequest = limitString(
      JSON.stringify(requestBody, null, 2),
      MAX_RAW_MODEL_REQUEST_LENGTH,
    );

    try {
      const response = await fetch(OPENAI_RESPONSES_API_URL, {
        body: JSON.stringify(requestBody),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const responseText = await response.text();
      const rawResponseText = limitString(
        responseText,
        MAX_RAW_MODEL_OUTPUT_LENGTH,
      );
      if (!response.ok) {
        return await ctx.runMutation(internal.smartStorage.failModelRun, {
          errorMessage: `OpenAI Responses API failed with ${response.status}.`,
          rawModelRequest,
          rawModelOutput: rawResponseText,
          smartStorageRunId: args.smartStorageRunId,
        });
      }

      const modelText = extractOpenAiResponseText(responseText);
      if (!modelText) {
        return await ctx.runMutation(internal.smartStorage.completeModelRunNoProposal, {
          errorMessage: "OpenAI response did not include proposal content.",
          rawModelRequest,
          rawModelOutput: rawResponseText,
          smartStorageRunId: args.smartStorageRunId,
        });
      }

      const proposal = parseModelProposal(modelText);
      if (proposal.kind === "error") {
        return await ctx.runMutation(internal.smartStorage.failModelRun, {
          errorMessage: proposal.message,
          rawModelRequest,
          rawModelOutput: rawResponseText,
          smartStorageRunId: args.smartStorageRunId,
        });
      }

      return await ctx.runMutation(
        internal.smartStorage.completeModelRunWithProposal,
        {
          proposal: proposal.proposal,
          rawModelRequest,
          rawModelOutput: rawResponseText,
          smartStorageRunId: args.smartStorageRunId,
        },
      );
    } catch (error) {
      return await ctx.runMutation(internal.smartStorage.failModelRun, {
        errorMessage: getModelExecutionErrorMessage(error),
        rawModelRequest,
        smartStorageRunId: args.smartStorageRunId,
      });
    }
  },
});

export const previewDraftExternalUrl = action({
  args: {
    url: v.string(),
  },
  returns: draftLinkPreviewResult,
  handler: async (ctx, args): Promise<DraftLinkPreviewResult> => {
    const requestedUrl = limitString(args.url, MAX_URL_LENGTH);
    try {
      const accessResult: null = await ctx.runQuery(
        internal.smartStorage.verifyDraftLinkPreviewAccess,
        {},
      );
      if (accessResult !== null) {
        return {
          status: "failed",
          url: requestedUrl,
          error: "Unauthorized",
        };
      }
    } catch {
      return {
        status: "failed",
        url: requestedUrl,
        error: "Unauthorized",
      };
    }

    const safeUrl = getSafeLinkPreviewUrl(args.url);
    if (safeUrl.kind === "error") {
      return {
        status: "failed",
        url: requestedUrl,
        error: safeUrl.message,
      };
    }

    try {
      const metadata = await fetchLinkPreviewMetadata(safeUrl.url);
      return {
        ...metadata,
        status: "fetched" as const,
        url: safeUrl.url,
      };
    } catch (error) {
      return {
        status: "failed",
        url: safeUrl.url,
        error: getPreviewErrorMessage(error),
      };
    }
  },
});

export const verifyDraftLinkPreviewAccess = internalQuery({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    await requireAppAccess(ctx);
    return null;
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
    rawModelRequest: v.optional(v.string()),
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
      ...(args.rawModelRequest === undefined
        ? {}
        : {
            rawModelRequest: limitString(
              args.rawModelRequest,
              MAX_RAW_MODEL_REQUEST_LENGTH,
            ),
          }),
      updatedAt: now,
      completedAt: now,
    });
    await markSubmissionReviewReadyIfPresent(ctx, run);

    return {
      executionStatus: "failed" as const,
      errorMessage: limitString(args.errorMessage, MAX_MODEL_ERROR_LENGTH),
      ...(args.rawModelOutput === undefined
        ? {}
        : {
            rawModelOutput: limitString(
              args.rawModelOutput,
              MAX_RAW_MODEL_OUTPUT_LENGTH,
            ),
          }),
      ...(args.rawModelRequest === undefined
        ? {}
        : {
            rawModelRequest: limitString(
              args.rawModelRequest,
              MAX_RAW_MODEL_REQUEST_LENGTH,
            ),
          }),
      smartStorageRunId: run._id,
      status: "failed" as const,
    };
  },
});

export const completeModelRunNoProposal = internalMutation({
  args: {
    errorMessage: v.optional(v.string()),
    rawModelRequest: v.optional(v.string()),
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
      ...(args.rawModelRequest === undefined
        ? {}
        : {
            rawModelRequest: limitString(
              args.rawModelRequest,
              MAX_RAW_MODEL_REQUEST_LENGTH,
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
      ...(args.rawModelOutput === undefined
        ? {}
        : {
            rawModelOutput: limitString(
              args.rawModelOutput,
              MAX_RAW_MODEL_OUTPUT_LENGTH,
            ),
          }),
      ...(args.rawModelRequest === undefined
        ? {}
        : {
            rawModelRequest: limitString(
              args.rawModelRequest,
              MAX_RAW_MODEL_REQUEST_LENGTH,
            ),
          }),
      smartStorageRunId: run._id,
      status: "noProposal" as const,
    };
  },
});

export const completeModelRunWithProposal = internalMutation({
  args: {
    proposal: smartStorageProposedEntry,
    rawModelRequest: v.string(),
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
        proposalRole: "primary",
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
      rawModelRequest: limitString(
        args.rawModelRequest,
        MAX_RAW_MODEL_REQUEST_LENGTH,
      ),
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
      rawModelRequest: limitString(
        args.rawModelRequest,
        MAX_RAW_MODEL_REQUEST_LENGTH,
      ),
      rawModelOutput: limitString(
        args.rawModelOutput,
        MAX_RAW_MODEL_OUTPUT_LENGTH,
      ),
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

export const addKnowledgePageThumbnail = mutation({
  args: {
    entryId: v.id("knowledgeEntries"),
    uploadedFile: contributionUploadedFile,
  },
  returns: v.object({
    entryId: v.id("knowledgeEntries"),
    status: v.literal("added"),
    thumbnailUrl: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Knowledge Entry not found.");
    }
    if (!supportsRepresentativeThumbnailType(entry.knowledgeType)) {
      throw new Error("This Knowledge Type does not use representative thumbnails.");
    }
    if (!isKnowledgeEntryVisibleToAccess(entry, access)) {
      throw new Error("Unauthorized");
    }
    if (await entryHasThumbnailRepresentation(ctx, entry._id)) {
      throw new Error("Knowledge Entry already has a representative thumbnail.");
    }

    const now = Date.now();
    const uploadedFile = await attachTemporaryUploadForKnowledgePageThumbnail(
      ctx,
      {
        now,
        uploadedByUserId: access.userId,
        uploadedFile: args.uploadedFile,
      },
    );
    if (
      inferFileRepresentationRoleFromMetadata(
        uploadedFile.contentType,
        uploadedFile.fileName,
      ) !== "thumbnail"
    ) {
      throw new Error("Representative thumbnail upload must be an image.");
    }

    await ctx.db.insert("entryRepresentations", {
      entryId: entry._id,
      representationKind: "storageFile",
      representationRole: "thumbnail",
      storageId: uploadedFile.storageId,
      fileName: uploadedFile.fileName,
      ...(uploadedFile.contentType === undefined
        ? {}
        : { contentType: uploadedFile.contentType }),
      ...(uploadedFile.fileSizeBytes === undefined
        ? {}
        : { fileSizeBytes: uploadedFile.fileSizeBytes }),
      ...(uploadedFile.languageCode === undefined
        ? {}
        : { languageCode: uploadedFile.languageCode }),
      isPrimary: false,
      createdAt: now,
      updatedAt: now,
    });

    const thumbnailUrl = await ctx.storage.getUrl(uploadedFile.storageId);

    return {
      entryId: entry._id,
      status: "added" as const,
      ...(thumbnailUrl === null ? {} : { thumbnailUrl }),
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
    if (args.knowledgeType === "announcement") {
      throw new Error("Announcements must be posted directly to an Organization.");
    }

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
      const temporaryUpload = await attachTemporaryUploadIfPresent(ctx, {
        contributionSubmissionId,
        now,
        uploadedByUserId: access.userId,
        uploadedFile,
      });
      const normalizedUploadedFile = await normalizeUploadedFileFromStorage(
        ctx,
        uploadedFile,
        temporaryUpload,
      );
      sourceIds.push(
        await ctx.db.insert("sources", {
          contributionSubmissionId,
          sourceKind: "uploadedFile",
          title: limitString(
            normalizedUploadedFile.title ?? normalizedUploadedFile.fileName,
            MAX_SOURCE_TITLE_LENGTH,
          ),
          storageId: normalizedUploadedFile.storageId,
          ...(normalizedUploadedFile.contentType === undefined
            ? {}
            : { contentType: normalizedUploadedFile.contentType }),
          ...(normalizedUploadedFile.languageCode === undefined
            ? {}
            : { languageCode: normalizedUploadedFile.languageCode }),
          fileName: normalizedUploadedFile.fileName,
          ...(normalizedUploadedFile.fileSizeBytes === undefined
            ? {}
            : { fileSizeBytes: normalizedUploadedFile.fileSizeBytes }),
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
    rawModelOutput: v.optional(v.string()),
    rawModelRequest: v.optional(v.string()),
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
        ...getModelDebugSummary(run),
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
        proposalRole: "primary",
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
      ...getModelDebugSummary(run),
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
    await assertCanReviewSmartStorageProposal(ctx, { access, proposal });
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

    const submission = await ctx.db.get(proposal.contributionSubmissionId);
    if (!submission) {
      throw new Error("Contribution Submission not found.");
    }
    const sessionProposals = await listSessionProposals(
      ctx,
      proposal.contributionSubmissionId,
    );
    const proposalsAscending = [...sessionProposals].sort(
      (left, right) => left.createdAt - right.createdAt,
    );
    const primaryProposal = selectPrimaryProposal(
      submission,
      proposalsAscending,
    );
    const acceptedPrimaryEntry =
      primaryProposal?.status === "accepted"
        ? await findAcceptedEntryForProposal(ctx, primaryProposal)
        : null;
    const role = getSmartStorageProposalRole(proposal, {
      primaryProposal,
    });
    assertSmartStorageProposalAcceptableForAcceptance({
      acceptability: getSmartStorageProposalAcceptability({
        acceptedPrimaryEntry,
        primaryProposal,
        proposal,
        proposalsAscending,
        role,
      }),
      proposal,
      role,
      targetExistingEntryId: args.targetExistingEntryId,
    });

    const now = Date.now();
    const proposedEntry = proposal.currentProposal;
    if (proposedEntry.knowledgeType === "announcement") {
      throw new Error("Announcements must be posted directly to an Organization.");
    }
    const typeBehavior = getTypeBehavior(proposedEntry.knowledgeType);
    const slotFulfillment = await resolveSlotFulfillment(ctx, {
      knowledgeType: proposedEntry.knowledgeType,
      slotId: run.slotId,
    });
    const slotContextTagIds =
      slotFulfillment === undefined
        ? undefined
        : await getSlotContextTagIds(ctx, slotFulfillment._id);
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
        await insertEntryContextTags(ctx, {
          contextTags: await appendAutomaticContextTags(ctx, {
            contextTags: [],
            organizations: access.organizations,
            representedTagId: existingEntry.primaryTagId,
            taggedByUserId: access.userId,
          }),
          entryId: existingEntry._id,
          now,
          taggedByUserId: access.userId,
        });
        await recordContextExpertiseEvidence(ctx, {
          contextTagIds: await getEntryContextTagIds(ctx, existingEntry._id),
          entryId: existingEntry._id,
          evidenceKind: "curation",
          now,
          smartStorageProposalId: proposal._id,
          subjectUserId: access.userId,
        });
        await recordSmartStorageUpgradeProvenance(ctx, {
          acceptedByUserId: access.userId,
          now,
          proposal,
          targetEntryId: existingEntry._id,
        });

        await ctx.db.patch(existingEntry._id, { updatedAt: now });
        await markProposalAccepted(ctx, {
          contributionSubmissionId: proposal.contributionSubmissionId,
          now,
          proposalId: proposal._id,
          submissionStatus: getAcceptedContributionSubmissionStatus({
            acceptedPrimaryEntry,
            role,
          }),
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

    const contextTags = await resolveContextTags(
      ctx,
      normalizeContextTags(proposedEntry.contextTags),
    );
    const entryContextTags = await appendAutomaticContextTags(ctx, {
      contextTags,
      organizations: access.organizations,
      representedTagId: represented.primaryTagId,
      taggedByUserId: access.userId,
    });
    if (slotFulfillment !== undefined) {
      assertAcceptedEntryIncludesSlotTags(
        slotContextTagIds ?? [],
        [
          represented.primaryTagId,
          ...entryContextTags.map((tag) => tag._id),
        ],
      );
    }
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
          ...entryContextTags.map((tag) => tag.label),
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
    await insertEntryContextTags(ctx, {
      contextTags: entryContextTags,
      entryId,
      now,
      taggedByUserId: access.userId,
    });
    await recordContextExpertiseEvidence(ctx, {
      contextTagIds: contextTags.map((tag) => tag._id),
      entryId,
      evidenceKind: "post",
      now,
      subjectUserId: access.userId,
    });
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
    }
    if (proposedEntry.knowledgeType === "question") {
      await ctx.db.insert("questionEntries", {
        entryId,
        questionText: proposedEntry.title,
      });
    }
    if (proposedEntry.knowledgeType === "quote") {
      const quotedPersonReferentId = await insertQuoteEntry(ctx, {
        contextTags,
        entryId,
        sourceText: proposedEntry.bodyPreview,
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
    await recordSmartStorageUpgradeProvenance(ctx, {
      acceptedByUserId: access.userId,
      now,
      proposal,
      targetEntryId: entryId,
    });

    if (role === "referenceResolution" && proposal.referenceResolution !== undefined) {
      const representedTag = await ctx.db.get(represented.primaryTagId);
      const representedReferent = await ctx.db.get(represented.referentId);
      if (!representedTag || !representedReferent) {
        throw new Error("Accepted Reference Resolution Tag could not be loaded.");
      }
      const resolvedTag = getContextTagSnapshotForTag(
        representedTag,
        representedReferent,
      );
      await applyReferenceResolutionToDependentWork(ctx, {
        now,
        resolvedTag,
        resolvedTagDoc: representedTag,
        requiredTag: proposal.referenceResolution.requiredTag,
        targetProposalId: proposal.referenceResolution.requiredByProposalId,
        userId: access.userId,
      });
      await ctx.db.patch(proposal._id, {
        referenceResolution: {
          ...proposal.referenceResolution,
          outcome: "createdByAcceptedEntry",
          resolvedAt: now,
          resolvedByUserId: access.userId,
          resolvedEntryId: entryId,
          resolvedReferentId: represented.referentId,
          resolvedTagId: represented.primaryTagId,
        },
        updatedAt: now,
      });
    }

    await markProposalAccepted(ctx, {
      contributionSubmissionId: proposal.contributionSubmissionId,
      now,
      proposalId: proposal._id,
      submissionStatus: getAcceptedContributionSubmissionStatus({
        acceptedPrimaryEntry,
        role,
      }),
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

export const confirmKnownReferentForReferenceResolution = mutation({
  args: {
    smartStorageProposalId: v.id("smartStorageProposals"),
    tagId: v.id("tags"),
  },
  returns: v.object({
    referenceResolution: smartStorageReferenceResolutionSummary,
    resolvedTag: contextTagSnapshot,
    smartStorageProposalId: v.id("smartStorageProposals"),
    status: v.literal("accepted"),
    updatedProposalIds: v.array(v.id("smartStorageProposals")),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const proposal = await ctx.db.get(args.smartStorageProposalId);
    if (!proposal) {
      throw new Error("Smart Storage Proposal not found.");
    }
    await assertCanReviewSmartStorageProposal(ctx, { access, proposal });
    if (!isOpenSmartStorageProposal(proposal)) {
      throw new Error("Smart Storage Proposal is not open for reference resolution.");
    }
    if (proposal.referenceResolution === undefined) {
      throw new Error(
        "Reference-resolution Smart Storage Proposal must declare its required Referent.",
      );
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
        "Smart Storage Proposal must be linked to a Contribution Submission before reference resolution.",
      );
    }
    if (run.contributionSubmissionId !== proposal.contributionSubmissionId) {
      throw new Error("Proposal and Run belong to different Contribution Submissions.");
    }

    const submission = await ctx.db.get(proposal.contributionSubmissionId);
    if (!submission) {
      throw new Error("Contribution Submission not found.");
    }
    const sessionProposals = await listSessionProposals(
      ctx,
      proposal.contributionSubmissionId,
    );
    const proposalsAscending = [...sessionProposals].sort(
      (left, right) => left.createdAt - right.createdAt,
    );
    const primaryProposal = selectPrimaryProposal(submission, proposalsAscending);
    const acceptedPrimaryEntry =
      primaryProposal?.status === "accepted"
        ? await findAcceptedEntryForProposal(ctx, primaryProposal)
        : null;
    const role = getSmartStorageProposalRole(proposal, { primaryProposal });
    if (role !== "referenceResolution") {
      throw new Error(
        "Only reference-resolution Smart Storage Proposals can confirm Known Referents.",
      );
    }
    const acceptability = getSmartStorageProposalAcceptability({
      acceptedPrimaryEntry,
      primaryProposal,
      proposal,
      proposalsAscending,
      role,
    });
    if (acceptability.status === "blocked") {
      throw new Error("Smart Storage Proposal must be resolved before acceptance.");
    }

    const tag = await ctx.db.get(args.tagId);
    if (!tag) {
      throw new Error("Known Referent Tag not found.");
    }
    const referent = await ctx.db.get(tag.referentId);
    if (!referent) {
      throw new Error("Known Referent not found.");
    }
    if (tag.knowledgeType !== proposal.referenceResolution.requiredTag.knowledgeType) {
      throw new Error("Known Referent Tag does not match the required Knowledge Type.");
    }
    if (
      proposal.referenceResolution.candidateTagId !== undefined &&
      proposal.referenceResolution.candidateTagId !== tag._id
    ) {
      throw new Error("Known Referent Tag does not match the proposed match.");
    }

    const now = Date.now();
    const resolvedTag = getContextTagSnapshotForTag(tag, referent);
    const referenceResolution = {
      ...proposal.referenceResolution,
      outcome: "matchedKnownReferent" as const,
      resolvedAt: now,
      resolvedByUserId: access.userId,
      resolvedReferentId: referent._id,
      resolvedTagId: tag._id,
    };
    const updatedProposalIds = await applyReferenceResolutionToDependentWork(ctx, {
      now,
      resolvedTag,
      resolvedTagDoc: tag,
      requiredTag: proposal.referenceResolution.requiredTag,
      targetProposalId: proposal.referenceResolution.requiredByProposalId,
      userId: access.userId,
    });

    await ctx.db.patch(proposal._id, {
      referenceResolution,
      updatedAt: now,
    });
    await recordSmartStorageUpgradeProvenance(ctx, {
      acceptedByUserId: access.userId,
      now,
      proposal,
    });
    await markProposalAccepted(ctx, {
      contributionSubmissionId: proposal.contributionSubmissionId,
      now,
      proposalId: proposal._id,
      submissionStatus: getAcceptedContributionSubmissionStatus({
        acceptedPrimaryEntry,
        role,
      }),
    });

    const updatedProposal = await ctx.db.get(proposal._id);
    if (!updatedProposal) {
      throw new Error("Updated Smart Storage Proposal could not be loaded.");
    }
    const summary = await getSmartStorageReferenceResolutionSummary(
      ctx,
      updatedProposal,
    );
    if (summary === undefined) {
      throw new Error("Updated Reference Resolution could not be loaded.");
    }

    return {
      referenceResolution: summary,
      resolvedTag,
      smartStorageProposalId: proposal._id,
      status: "accepted" as const,
      updatedProposalIds,
    };
  },
});

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

function assertAcceptedEntryIncludesSlotTags(
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
    uploadedFile: ContributionUploadedFileInput;
  },
): Promise<Doc<"temporaryUploads"> | null> {
  if (uploadedFile.temporaryUploadId === undefined) {
    return null;
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

  return temporaryUpload;
}

async function attachTemporaryUploadForKnowledgePageThumbnail(
  ctx: MutationCtx,
  {
    now,
    uploadedByUserId,
    uploadedFile,
  }: {
    now: number;
    uploadedByUserId: Id<"users">;
    uploadedFile: ContributionUploadedFileInput;
  },
): Promise<NormalizedUploadedFile> {
  if (uploadedFile.temporaryUploadId === undefined) {
    throw new Error("Representative thumbnail requires a temporary upload record.");
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

  return await normalizeUploadedFileFromStorage(ctx, uploadedFile, temporaryUpload);
}

// Normalize file metadata from Convex storage before source rows are created so
// clients cannot accidentally persist stale or unbounded upload details.
async function normalizeUploadedFileFromStorage(
  ctx: MutationCtx,
  uploadedFile: ContributionUploadedFileInput,
  temporaryUpload?: Doc<"temporaryUploads"> | null,
): Promise<NormalizedUploadedFile> {
  const storedFile = await loadStoredFileMetadata(ctx, uploadedFile.storageId);

  return normalizeUploadedFileMetadata({
    contentType:
      temporaryUpload?.contentType ??
      storedFile.contentType ??
      uploadedFile.contentType,
    fileName: temporaryUpload?.fileName ?? uploadedFile.fileName,
    fileSizeBytes:
      temporaryUpload?.fileSizeBytes ??
      storedFile.size ??
      uploadedFile.fileSizeBytes,
    languageCode: uploadedFile.languageCode,
    storageId: uploadedFile.storageId,
    title: uploadedFile.title,
  });
}

async function loadStoredFileMetadata(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<StoredFileMetadata> {
  const metadata = await ctx.db.system.get("_storage", storageId);
  if (!metadata) {
    throw new Error("Uploaded file not found in storage.");
  }

  return metadata;
}

function normalizeUploadedFileMetadata(
  uploadedFile: ContributionUploadedFileInput,
): NormalizedUploadedFile {
  const fileName = limitString(uploadedFile.fileName, MAX_FILE_NAME_LENGTH);
  if (!fileName) {
    throw new Error("Uploaded file name is required.");
  }

  return {
    storageId: uploadedFile.storageId,
    fileName,
    contentType: limitOptionalString(
      uploadedFile.contentType,
      MAX_CONTENT_TYPE_LENGTH,
    ),
    fileSizeBytes: normalizeOptionalFileSize(uploadedFile.fileSizeBytes),
    languageCode: limitOptionalString(
      uploadedFile.languageCode,
      MAX_LANGUAGE_CODE_LENGTH,
    ),
    title: limitOptionalString(uploadedFile.title, MAX_SOURCE_TITLE_LENGTH),
  };
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

function getModelDebugSummary(run: Doc<"smartStorageRuns">) {
  return {
    ...(run.rawModelRequest === undefined
      ? {}
      : { rawModelRequest: run.rawModelRequest }),
    ...(run.rawModelOutput === undefined
      ? {}
      : { rawModelOutput: run.rawModelOutput }),
  };
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

async function listSessionProposals(
  ctx: MutationCtx | QueryCtx,
  contributionSubmissionId: Id<"contributionSubmissions">,
) {
  const statuses: SmartStorageProposalStatus[] = [
    "drafted",
    "needsResolution",
    "accepted",
    "rejected",
    "stale",
  ];
  const proposals: Doc<"smartStorageProposals">[] = [];

  for (const status of statuses) {
    proposals.push(
      ...(await ctx.db
        .query("smartStorageProposals")
        .withIndex("by_contributionSubmissionId_and_status_and_createdAt", (q) =>
          q
            .eq("contributionSubmissionId", contributionSubmissionId)
            .eq("status", status),
        )
        .take(MAX_SESSION_PROPOSALS_PER_STATUS)),
    );
  }

  return proposals;
}

function countSessionSources(sources: Doc<"sources">[]) {
  const counts = {
    externalUrl: 0,
    manualEntry: 0,
    pastedText: 0,
    total: sources.length,
    uploadedFile: 0,
  };

  for (const source of sources) {
    counts[source.sourceKind] += 1;
  }

  return counts;
}

function countSessionProposals(proposals: Doc<"smartStorageProposals">[]) {
  const counts = {
    accepted: 0,
    drafted: 0,
    needsResolution: 0,
    rejected: 0,
    stale: 0,
    total: proposals.length,
  };

  for (const proposal of proposals) {
    counts[proposal.status] += 1;
  }

  return counts;
}

function selectPrimaryProposal(
  contributionSubmission: Doc<"contributionSubmissions">,
  proposalsAscending: Doc<"smartStorageProposals">[],
) {
  const explicitPrimaryCandidates = proposalsAscending.filter(
    (proposal) => proposal.proposalRole === "primary",
  );
  if (explicitPrimaryCandidates.length > 0) {
    return selectPreferredSessionProposal(explicitPrimaryCandidates);
  }

  const primaryTypeCandidates = proposalsAscending.filter(
    (proposal) =>
      proposal.currentProposal.knowledgeType ===
      contributionSubmission.primaryIntendedKnowledgeType,
  );
  const candidates =
    primaryTypeCandidates.length > 0
      ? primaryTypeCandidates
      : proposalsAscending;

  return selectPreferredSessionProposal(candidates);
}

function selectPreferredSessionProposal(
  candidates: Doc<"smartStorageProposals">[],
) {
  return (
    candidates.find((proposal) => proposal.status === "accepted") ??
    candidates.find((proposal) => isOpenSmartStorageProposal(proposal)) ??
    candidates[0]
  );
}

function getSmartStorageProposalRole(
  proposal: Doc<"smartStorageProposals">,
  {
    primaryProposal,
  }: {
    primaryProposal: Doc<"smartStorageProposals"> | undefined;
  },
): SmartStorageSessionProposalRole {
  if (proposal.proposalRole !== undefined) {
    return proposal.proposalRole;
  }
  if (proposal._id === primaryProposal?._id) {
    return "primary";
  }
  if (proposal.status === "needsResolution") {
    return "prerequisite";
  }

  return "secondary";
}

function selectPrerequisiteProposals(
  proposalsAscending: Doc<"smartStorageProposals">[],
  primaryProposal: Doc<"smartStorageProposals"> | undefined,
  acceptedPrimaryEntryExists: boolean,
) {
  if (acceptedPrimaryEntryExists) {
    return [];
  }

  return selectUnsatisfiedPrerequisiteProposals(
    proposalsAscending,
    primaryProposal,
  ).filter((proposal) => isOpenSmartStorageProposal(proposal));
}

function selectUnsatisfiedPrerequisiteProposals(
  proposalsAscending: Doc<"smartStorageProposals">[],
  primaryProposal: Doc<"smartStorageProposals"> | undefined,
) {
  return proposalsAscending.filter((proposal) => {
    if (proposal._id === primaryProposal?._id) {
      return false;
    }
    if (
      !isPrePrimarySmartStorageProposalRole(
        getSmartStorageProposalRole(proposal, { primaryProposal }),
      )
    ) {
      return false;
    }
    if (proposal.status === "accepted") {
      return false;
    }
    if (primaryProposal === undefined) {
      return true;
    }

    return (
      proposal.dependency?.requiredByProposalId === undefined ||
      proposal.dependency.requiredByProposalId === primaryProposal._id
    );
  });
}

function selectPendingSecondaryProposals(
  proposalsAscending: Doc<"smartStorageProposals">[],
  primaryProposal: Doc<"smartStorageProposals"> | undefined,
  prerequisiteProposals: Doc<"smartStorageProposals">[],
) {
  const prerequisiteIds = new Set(
    prerequisiteProposals.map((proposal) => proposal._id),
  );

  return proposalsAscending.filter(
    (proposal) =>
      proposal._id !== primaryProposal?._id &&
      !prerequisiteIds.has(proposal._id) &&
      !isUnsatisfiedPrePrimarySmartStorageProposalRole(
        getSmartStorageProposalRole(proposal, { primaryProposal }),
        primaryProposal,
      ) &&
      isOpenSmartStorageProposal(proposal),
  );
}

function getSmartStorageProposalAcceptability({
  acceptedPrimaryEntry,
  primaryProposal,
  proposal,
  proposalsAscending,
  role,
}: {
  acceptedPrimaryEntry: Doc<"knowledgeEntries"> | null;
  primaryProposal: Doc<"smartStorageProposals"> | undefined;
  proposal: Doc<"smartStorageProposals">;
  proposalsAscending: Doc<"smartStorageProposals">[];
  role: SmartStorageSessionProposalRole;
}): SmartStorageProposalAcceptabilitySummary {
  if (proposal.status === "accepted") {
    return {
      blockedByProposalIds: [],
      status: "accepted",
    };
  }

  if (isClosedSmartStorageProposalStatus(proposal.status)) {
    return {
      blockedByProposalIds: [],
      status: "closed",
    };
  }

  if (role === "primary") {
    const unsatisfiedPrerequisites = selectUnsatisfiedPrerequisiteProposals(
      proposalsAscending,
      proposal,
    );
    if (unsatisfiedPrerequisites.length > 0) {
      return {
        blockedByProposalIds: unsatisfiedPrerequisites.map(
          (prerequisite) => prerequisite._id,
        ),
        reason: "prerequisitesPending",
        status: "blocked",
      };
    }
  } else if (isPrePrimarySmartStorageProposalRole(role)) {
    if (!isPrePrimaryProposalAcceptable(proposal, role)) {
      return {
        blockedByProposalIds: [],
        reason: "resolutionRequired",
        status: "blocked",
      };
    }
  } else if (acceptedPrimaryEntry === null) {
    return {
      blockedByProposalIds:
        primaryProposal === undefined ? [] : [primaryProposal._id],
      reason: "primaryAnchorRequired",
      status: "blocked",
    };
  }

  if (proposal.status === "needsResolution") {
    return {
      blockedByProposalIds: [],
      reason: "resolutionRequired",
      status: "needsResolution",
    };
  }

  return {
    blockedByProposalIds: [],
    status: "ready",
  };
}

function isPrerequisiteDependencyAcceptable(
  proposal: Doc<"smartStorageProposals">,
) {
  return (
    proposal.dependency?.requirementKind === "referent" ||
    proposal.dependency?.requirementKind === "field" ||
    proposal.dependency?.requirementKind === "relationship"
  );
}

function assertSmartStorageProposalAcceptableForAcceptance({
  acceptability,
  proposal,
  role,
  targetExistingEntryId,
}: {
  acceptability: SmartStorageProposalAcceptabilitySummary;
  proposal: Doc<"smartStorageProposals">;
  role: SmartStorageSessionProposalRole;
  targetExistingEntryId?: Id<"knowledgeEntries">;
}) {
  if (acceptability.status === "ready") {
    return;
  }
  if (
    acceptability.status === "needsResolution" &&
    targetExistingEntryId !== undefined
  ) {
    return;
  }
  if (role === "prerequisite" && !isPrerequisiteDependencyAcceptable(proposal)) {
    throw new Error(
      "Prerequisite Smart Storage Proposal must declare a referent, field, or relationship dependency before acceptance.",
    );
  }
  if (role === "referenceResolution" && proposal.referenceResolution === undefined) {
    throw new Error(
      "Reference-resolution Smart Storage Proposal must declare its required Referent before acceptance.",
    );
  }
  if (acceptability.reason === "primaryAnchorRequired") {
    throw new Error(
      "Primary anchor must exist before accepting this Smart Storage Proposal.",
    );
  }
  if (acceptability.reason === "prerequisitesPending") {
    throw new Error(
      "Required prerequisite proposals must be accepted before accepting the primary proposal.",
    );
  }
  if (acceptability.reason === "resolutionRequired") {
    throw new Error("Smart Storage Proposal must be resolved before acceptance.");
  }

  throw new Error("Smart Storage Proposal is not open for acceptance.");
}

function getAcceptedContributionSubmissionStatus({
  acceptedPrimaryEntry,
  role,
}: {
  acceptedPrimaryEntry: Doc<"knowledgeEntries"> | null;
  role: SmartStorageSessionProposalRole;
}): Doc<"contributionSubmissions">["submissionStatus"] {
  return isPrePrimarySmartStorageProposalRole(role) && acceptedPrimaryEntry === null
    ? "partiallyAccepted"
    : "accepted";
}

function isPrePrimarySmartStorageProposalRole(
  role: SmartStorageSessionProposalRole,
) {
  return role === "prerequisite" || role === "referenceResolution";
}

function isUnsatisfiedPrePrimarySmartStorageProposalRole(
  role: SmartStorageSessionProposalRole,
  primaryProposal: Doc<"smartStorageProposals"> | undefined,
) {
  return (
    isPrePrimarySmartStorageProposalRole(role) &&
    primaryProposal?.status !== "accepted"
  );
}

function isPrePrimaryProposalAcceptable(
  proposal: Doc<"smartStorageProposals">,
  role: SmartStorageSessionProposalRole,
) {
  if (role === "referenceResolution") {
    return proposal.referenceResolution !== undefined;
  }

  return isPrerequisiteDependencyAcceptable(proposal);
}

function isOpenSmartStorageProposal(proposal: Doc<"smartStorageProposals">) {
  return proposal.status === "drafted" || proposal.status === "needsResolution";
}

function isClosedSmartStorageProposalStatus(status: SmartStorageProposalStatus) {
  return status === "accepted" || status === "rejected" || status === "stale";
}

function isActiveSmartStorageRun(run: Doc<"smartStorageRuns">) {
  return run.status === "queued" || run.status === "running";
}

function isSmartStorageSessionComplete({
  proposals,
  runs,
}: {
  proposals: Doc<"smartStorageProposals">[];
  runs: Doc<"smartStorageRuns">[];
}) {
  return (
    proposals.length > 0 &&
    runs.every((run) => !isActiveSmartStorageRun(run)) &&
    proposals.every((proposal) =>
      isClosedSmartStorageProposalStatus(proposal.status),
    )
  );
}

function deriveSmartStorageSessionState({
  activeRun,
  acceptedPrimaryEntry,
  isComplete,
  latestRun,
  pendingSecondaryProposalCount,
  prerequisiteProposalCount,
  primaryProposal,
  sourceCount,
  submissionStatus,
}: {
  activeRun: Doc<"smartStorageRuns"> | undefined;
  acceptedPrimaryEntry: Doc<"knowledgeEntries"> | null;
  isComplete: boolean;
  latestRun: Doc<"smartStorageRuns"> | undefined;
  pendingSecondaryProposalCount: number;
  prerequisiteProposalCount: number;
  primaryProposal: Doc<"smartStorageProposals"> | undefined;
  sourceCount: number;
  submissionStatus: Doc<"contributionSubmissions">["submissionStatus"];
}): SmartStorageSessionState {
  if (submissionStatus === "cancelled") {
    return "cancelled";
  }

  if (sourceCount === 0) {
    return submissionStatus === "submitted" || submissionStatus === "processing"
      ? "preservingSources"
      : "sourcePreservationFailed";
  }

  if (activeRun !== undefined) {
    return "preparingPrimaryProposal";
  }

  if (
    prerequisiteProposalCount > 0 ||
    primaryProposal?.status === "needsResolution"
  ) {
    return "awaitingPrerequisites";
  }

  if (
    primaryProposal !== undefined &&
    isOpenSmartStorageProposal(primaryProposal)
  ) {
    return "primaryReady";
  }

  if (
    primaryProposal === undefined &&
    (latestRun?.status === "failed" || latestRun?.status === "noProposal")
  ) {
    return "primaryReady";
  }

  if (acceptedPrimaryEntry !== null && pendingSecondaryProposalCount > 0) {
    return "reviewPending";
  }

  if (acceptedPrimaryEntry !== null) {
    return "primarySaved";
  }

  if (isComplete) {
    return "complete";
  }

  return "preservingSources";
}

function toSmartStorageSessionRunSummary(run: Doc<"smartStorageRuns">) {
  return {
    ...(run.completedAt === undefined ? {} : { completedAt: run.completedAt }),
    ...(run.errorMessage === undefined ? {} : { errorMessage: run.errorMessage }),
    id: run._id,
    status: run.status,
    updatedAt: run.updatedAt,
  };
}

async function toSmartStorageSessionProposalSummary(
  ctx: QueryCtx,
  {
    acceptability,
    proposal,
    role,
  }: {
    acceptability: SmartStorageProposalAcceptabilitySummary;
    proposal: Doc<"smartStorageProposals">;
    role: SmartStorageSessionProposalRole;
  },
) {
  const sourceCitations = await listProposalSourceCitations(ctx, proposal._id);
  const sourceIds =
    sourceCitations.length === 0
      ? [proposal.sourceId]
      : sourceCitations.map((citation) => citation.sourceId);
  const referenceResolution =
    await getSmartStorageReferenceResolutionSummary(ctx, proposal);
  const refresh = getSmartStorageRefreshSummary(proposal);

  return {
    acceptReady: acceptability.status === "ready",
    acceptability,
    ...(proposal.contributionSubmissionId === undefined
      ? {}
      : { contributionSubmissionId: proposal.contributionSubmissionId }),
    createdAt: proposal.createdAt,
    currentProposal: proposal.currentProposal,
    ...(proposal.dependency === undefined
      ? {}
      : { dependency: proposal.dependency }),
    id: proposal._id,
    ...(refresh === undefined ? {} : { refresh }),
    ...(referenceResolution === undefined ? {} : { referenceResolution }),
    role,
    smartStorageRunId: proposal.smartStorageRunId,
    sourceCitations,
    sourceId: proposal.sourceId,
    sourceIds,
    status: proposal.status,
    updatedAt: proposal.updatedAt,
  };
}

async function listCurrentUserOpenReviewSlotProposals(
  ctx: QueryCtx,
  userId: Id<"users">,
  limit: number,
) {
  const reviewSlotStatuses: Array<
    Extract<SmartStorageProposalStatus, "drafted" | "needsResolution" | "stale">
  > = [
    "needsResolution",
    "drafted",
    "stale",
  ];
  const proposals: Doc<"smartStorageProposals">[] = [];
  const seenProposalIds = new Set<Id<"smartStorageProposals">>();

  for (const status of reviewSlotStatuses) {
    const ownerProposals = await ctx.db
      .query("smartStorageProposals")
      .withIndex("by_createdByUserId_and_status_and_createdAt", (q) =>
        q.eq("createdByUserId", userId).eq("status", status),
      )
      .order("desc")
      .take(limit);
    const assignedProposals = await ctx.db
      .query("smartStorageProposals")
      .withIndex("by_reviewAssignedUserId_and_status_and_updatedAt", (q) =>
        q.eq("reviewAssignedUserId", userId).eq("status", status),
      )
      .order("desc")
      .take(limit);

    for (const proposal of [...ownerProposals, ...assignedProposals]) {
      if (seenProposalIds.has(proposal._id)) {
        continue;
      }
      if (
        proposal.status === "stale" &&
        !(await shouldProjectStaleRefreshProposal(ctx, proposal))
      ) {
        continue;
      }
      seenProposalIds.add(proposal._id);
      proposals.push(proposal);
    }
  }

  return proposals;
}

async function toSmartStorageReviewSlotSummary(
  ctx: QueryCtx,
  {
    acceptability,
    acceptedPrimaryEntry,
    access,
    canAssign,
    contributionSubmission,
    proposal,
    role,
  }: {
    acceptability: SmartStorageProposalAcceptabilitySummary;
    acceptedPrimaryEntry: Doc<"knowledgeEntries"> | null;
    access: Awaited<ReturnType<typeof requireAppAccess>>;
    canAssign: boolean;
    contributionSubmission: Doc<"contributionSubmissions">;
    proposal: Doc<"smartStorageProposals">;
    role: SmartStorageSessionProposalRole;
  },
) {
  const sourceCitations = await listProposalSourceCitations(ctx, proposal._id);
  const sourceIds =
    sourceCitations.length === 0
      ? [proposal.sourceId]
      : sourceCitations.map((citation) => citation.sourceId);
  const contextPreviewTags = proposal.currentProposal.contextTags.slice(
    0,
    MAX_CONTEXT_PREVIEW_TAG_LABELS,
  );
  const referenceResolution =
    await getSmartStorageReferenceResolutionSummary(ctx, proposal);
  const refresh = getSmartStorageRefreshSummary(proposal);
  const assignment = await getSmartStorageReviewAssignmentSummary(ctx, proposal);
  const visibleAcceptedPrimaryEntry =
    acceptedPrimaryEntry !== null &&
    isKnowledgeEntryVisibleToAccess(acceptedPrimaryEntry, access)
      ? acceptedPrimaryEntry
      : null;
  const group =
    visibleAcceptedPrimaryEntry === null
      ? {
          href: getSmartStorageSessionHref(contributionSubmission._id),
          id: contributionSubmission._id,
          kind: "session" as const,
          title: contributionSubmission.primaryIntendedTitle,
        }
      : {
          href: `/entries/${visibleAcceptedPrimaryEntry._id}`,
          id: visibleAcceptedPrimaryEntry._id,
          kind: "primaryEntry" as const,
          title: visibleAcceptedPrimaryEntry.title,
        };

  return {
    acceptReady: acceptability.status === "ready",
    acceptability,
    ...(assignment === undefined ? {} : { assignment }),
    bodyPreview: proposal.currentProposal.bodyPreview,
    canAssign,
    contextPreviewTagLabels: contextPreviewTags.map((tag) => tag.label),
    ...(contextPreviewTags.length === 0
      ? {}
      : { contextPreviewTags }),
    contributionSubmissionId: contributionSubmission._id,
    createdAt: proposal.createdAt,
    evidenceSummary: getReviewSlotEvidenceSummary({
      citationCount: sourceCitations.length,
      sourceCount: sourceIds.length,
    }),
    group,
    href: getSmartStorageSessionHref(contributionSubmission._id, proposal._id),
    id: `review-slot:${proposal._id}`,
    originSession: {
      href: getSmartStorageSessionHref(contributionSubmission._id),
      id: contributionSubmission._id,
      title: contributionSubmission.primaryIntendedTitle,
    },
    proposedKnowledgeType: proposal.currentProposal.knowledgeType,
    ...(refresh === undefined ? {} : { refresh }),
    reviewScopeLabel: getReviewScopeLabel(contributionSubmission),
    ...(referenceResolution === undefined ? {} : { referenceResolution }),
    role,
    smartStorageProposalId: proposal._id,
    smartStorageRunId: proposal.smartStorageRunId,
    sourceCount: sourceIds.length,
    status: proposal.status,
    title: proposal.currentProposal.title,
    updatedAt: proposal.updatedAt,
  };
}

async function getSmartStorageReferenceResolutionSummary(
  ctx: QueryCtx,
  proposal: Doc<"smartStorageProposals">,
) {
  const resolution = proposal.referenceResolution;
  if (resolution === undefined) {
    return undefined;
  }

  const candidateTag =
    resolution.candidateTagId === undefined
      ? undefined
      : await getContextTagSnapshotForTagId(ctx, resolution.candidateTagId);
  const resolvedTag =
    resolution.resolvedTagId === undefined
      ? undefined
      : await getContextTagSnapshotForTagId(ctx, resolution.resolvedTagId);
  const mode: "knownReferentMatch" | "newEntryProposal" =
    candidateTag !== undefined || resolution.outcome === "matchedKnownReferent"
      ? "knownReferentMatch"
      : "newEntryProposal";

  return {
    ...(candidateTag === undefined ? {} : { candidateTag }),
    ...(resolution.candidateTagId === undefined
      ? {}
      : { candidateTagId: resolution.candidateTagId }),
    mode,
    outcome: resolution.outcome,
    requiredTag: resolution.requiredTag,
    ...(resolvedTag === undefined ? {} : { resolvedTag }),
    ...(resolution.resolvedTagId === undefined
      ? {}
      : { resolvedTagId: resolution.resolvedTagId }),
  };
}

function getSmartStorageRefreshSummary(proposal: Doc<"smartStorageProposals">) {
  const refresh = proposal.refresh;
  if (refresh !== undefined) {
    return {
      candidateKey: refresh.candidateKey,
      origin: refresh.origin,
      originLabel: getSmartStorageRefreshOriginLabel(refresh.origin),
      reason: refresh.reason,
      ...(refresh.sourceEntryId === undefined
        ? {}
        : { sourceEntryId: refresh.sourceEntryId }),
      ...(refresh.sourceProposalId === undefined
        ? {}
        : { sourceProposalId: refresh.sourceProposalId }),
      suggestionKind: refresh.suggestionKind,
      ...(refresh.targetContractSnapshotVersion === undefined
        ? {}
        : {
            targetContractSnapshotVersion:
              refresh.targetContractSnapshotVersion,
          }),
      ...(refresh.targetTypeBehaviorSnapshotVersion === undefined
        ? {}
        : {
            targetTypeBehaviorSnapshotVersion:
              refresh.targetTypeBehaviorSnapshotVersion,
          }),
    };
  }

  if (!isProposalBehindCurrentSmartStorageSnapshots(proposal)) {
    return undefined;
  }

  const targetTypeBehaviorSnapshotVersion = getTypeBehaviorSnapshot(
    proposal.currentProposal.knowledgeType,
  ).version;

  return {
    candidateKey: getRefreshCandidateKey({
      origin: "contractRefresh",
      sourceProposalId: proposal._id,
      suggestionKind: "staleProposalRefresh",
      targetKnowledgeType: proposal.currentProposal.knowledgeType,
    }),
    origin: "contractRefresh" as const,
    originLabel: getSmartStorageRefreshOriginLabel("contractRefresh"),
    reason: getDefaultRefreshReason("contractRefresh", "staleProposalRefresh"),
    sourceProposalId: proposal._id,
    suggestionKind: "staleProposalRefresh" as const,
    targetContractSnapshotVersion: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
    targetTypeBehaviorSnapshotVersion,
  };
}

function getSmartStorageRefreshOriginLabel(origin: SmartStorageRefreshOrigin) {
  return origin === "reprocessing" ? "Reprocessing" : "Refresh";
}

function isProposalBehindCurrentSmartStorageSnapshots(
  proposal: Doc<"smartStorageProposals">,
) {
  const currentTypeBehaviorVersion = getTypeBehaviorSnapshot(
    proposal.currentProposal.knowledgeType,
  ).version;

  return (
    proposal.contractSnapshotVersion !== undefined &&
    proposal.contractSnapshotVersion !== SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION
  ) || (
    proposal.typeBehaviorSnapshotVersion !== undefined &&
    proposal.typeBehaviorSnapshotVersion !== currentTypeBehaviorVersion
  );
}

async function shouldProjectStaleRefreshProposal(
  ctx: QueryCtx,
  proposal: Doc<"smartStorageProposals">,
) {
  const refresh = getSmartStorageRefreshSummary(proposal);
  if (refresh === undefined) {
    return false;
  }
  if (await hasActiveRefreshCandidate(ctx, refresh.candidateKey)) {
    return false;
  }

  const contributionSubmission =
    proposal.contributionSubmissionId === undefined
      ? null
      : await ctx.db.get(proposal.contributionSubmissionId);
  if (contributionSubmission === null) {
    return false;
  }

  return !(await hasRefreshDismissal(ctx, {
    contributionSubmission,
    refresh,
  }));
}

async function hasActiveRefreshCandidate(
  ctx: MutationCtx | QueryCtx,
  candidateKey: string,
) {
  for (const status of ["drafted", "needsResolution", "accepted"] as const) {
    const existing = await ctx.db
      .query("smartStorageProposals")
      .withIndex("by_refreshCandidateKey_and_status", (q) =>
        q.eq("refreshCandidateKey", candidateKey).eq("status", status),
      )
      .first();
    if (existing) {
      return true;
    }
  }

  return false;
}

async function findActiveRefreshCandidate(
  ctx: MutationCtx,
  candidateKey: string,
) {
  for (const status of ["drafted", "needsResolution", "accepted"] as const) {
    const existing = await ctx.db
      .query("smartStorageProposals")
      .withIndex("by_refreshCandidateKey_and_status", (q) =>
        q.eq("refreshCandidateKey", candidateKey).eq("status", status),
      )
      .first();
    if (existing) {
      return existing;
    }
  }

  return null;
}

async function createRefreshReviewProposal(
  ctx: MutationCtx,
  {
    access,
    candidateTagId,
    contributionSubmission,
    mode,
    reason,
    requiredTag,
    sourceEntry,
    sourceId,
    sourceProposal,
    suggestionKind,
    targetKnowledgeType,
  }: {
    access: Awaited<ReturnType<typeof requireAppAccess>>;
    candidateTagId?: Id<"tags">;
    contributionSubmission: Doc<"contributionSubmissions">;
    mode: "refresh" | "reprocessing";
    reason?: string;
    requiredTag?: ContextTagSnapshotInput;
    sourceEntry?: Doc<"knowledgeEntries">;
    sourceId?: Id<"sources">;
    sourceProposal?: Doc<"smartStorageProposals">;
    suggestionKind?: SmartStorageRefreshSuggestionKind;
    targetKnowledgeType?: EntryKnowledgeType;
  }) {
  const origin: SmartStorageRefreshOrigin =
    mode === "reprocessing" ? "reprocessing" : "contractRefresh";
  const resolvedSuggestionKind = getRefreshSuggestionKind({
    origin,
    sourceProposal,
    suggestionKind,
  });
  const resolvedTargetKnowledgeType = getRefreshTargetKnowledgeType({
    requiredTag,
    sourceEntry,
    sourceProposal,
    suggestionKind: resolvedSuggestionKind,
    targetKnowledgeType,
  });
  const role = getRefreshProposalRole(origin, resolvedSuggestionKind);
  const candidateKey = getRefreshCandidateKey({
    origin,
    requiredTag,
    sourceEntryId: sourceEntry?._id,
    sourceProposalId: sourceProposal?._id,
    suggestionKind: resolvedSuggestionKind,
    targetKnowledgeType: resolvedTargetKnowledgeType,
  });
  const now = Date.now();
  const snapshots = await ensureCurrentSmartStorageSnapshots(ctx, {
    knowledgeType: resolvedTargetKnowledgeType,
    now,
  });
  const refresh = {
    candidateKey,
    origin,
    reason: limitString(
      reason ?? getDefaultRefreshReason(origin, resolvedSuggestionKind),
      MAX_REFRESH_REASON_LENGTH,
    ),
    requestedAt: now,
    requestedByUserId: access.userId,
    ...(sourceEntry === undefined ? {} : { sourceEntryId: sourceEntry._id }),
    ...(sourceProposal === undefined
      ? {}
      : { sourceProposalId: sourceProposal._id }),
    suggestionKind: resolvedSuggestionKind,
    targetContractSnapshotVersion: snapshots.contractSnapshotVersion,
    targetTypeBehaviorSnapshotVersion: snapshots.typeBehaviorSnapshotVersion,
  };
  const refreshSummary = {
    ...refresh,
    originLabel: getSmartStorageRefreshOriginLabel(origin),
  };

  if (
    await hasRefreshDismissal(ctx, {
      contributionSubmission,
      refresh: refreshSummary,
    })
  ) {
    return {
      role,
      smartStorageProposalId: null,
      ...(sourceEntry === undefined ? {} : { sourceEntryId: sourceEntry._id }),
      ...(sourceProposal === undefined
        ? {}
        : { sourceProposalId: sourceProposal._id }),
      status: "dismissed" as const,
    };
  }

  const existing = await findActiveRefreshCandidate(ctx, candidateKey);
  if (existing) {
    return {
      role: getSmartStorageProposalRole(existing, {
        primaryProposal: undefined,
      }),
      smartStorageProposalId: existing._id,
      ...(sourceEntry === undefined ? {} : { sourceEntryId: sourceEntry._id }),
      ...(sourceProposal === undefined
        ? {}
        : { sourceProposalId: sourceProposal._id }),
      status: "existing" as const,
    };
  }

  const sourceProposalEntry = sourceProposal?.currentProposal;
  const refreshSourceId = sourceId ?? sourceProposal?.sourceId;
  if (refreshSourceId === undefined) {
    throw new Error("Refresh Source not found.");
  }
  const source = await ctx.db.get(refreshSourceId);
  if (!source) {
    throw new Error("Refresh Source not found.");
  }
  const currentProposal = buildRefreshProposal({
    reason: refresh.reason,
    requiredTag,
    sourceEntry,
    sourceProposal: sourceProposalEntry,
    suggestionKind: resolvedSuggestionKind,
    targetKnowledgeType: resolvedTargetKnowledgeType,
  });
  const smartStorageRunId = await ctx.db.insert("smartStorageRuns", {
    contributionSubmissionId: contributionSubmission._id,
    sourceId: source._id,
    primarySourceId: source._id,
    status: "succeeded",
    requestedKnowledgeType: resolvedTargetKnowledgeType,
    contributionTitle:
      sourceProposalEntry?.title ?? sourceEntry?.title ?? contributionSubmission.primaryIntendedTitle,
    contributionBodyPreview:
      sourceProposalEntry?.bodyPreview ??
      sourceEntry?.previewText ??
      contributionSubmission.primaryIntendedBodyPreview,
    contextTags: normalizeContextTags(currentProposal.contextTags),
    smartStorageContractVersionId: snapshots.smartStorageContractVersionId,
    typeBehaviorSnapshotId: snapshots.typeBehaviorSnapshotId,
    contractSnapshotVersion: snapshots.contractSnapshotVersion,
    contractSnapshotText: snapshots.contractSnapshotText,
    typeBehaviorSnapshotVersion: snapshots.typeBehaviorSnapshotVersion,
    typeBehaviorSnapshotText: snapshots.typeBehaviorSnapshotText,
    rawModelOutput: limitString(
      JSON.stringify({
        generatorVersion: REFRESH_GENERATOR_VERSION,
        origin,
        sourceEntryId: sourceEntry?._id,
        sourceProposalId: sourceProposal?._id,
        suggestionKind: resolvedSuggestionKind,
      }),
      MAX_RAW_MODEL_OUTPUT_LENGTH,
    ),
    createdByUserId: access.userId,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
  });
  const smartStorageProposalId = await ctx.db.insert("smartStorageProposals", {
    contributionSubmissionId: contributionSubmission._id,
    sourceId: source._id,
    smartStorageRunId,
    status: "drafted",
    proposalRole: role,
    ...(resolvedSuggestionKind === "referenceResolution" && requiredTag !== undefined
      ? {
          dependency: {
            ...(sourceProposal === undefined
              ? {}
              : { requiredByProposalId: sourceProposal._id }),
            requirementKind: "referent" as const,
            requirementKey: getContextSnapshotIdentityKey(requiredTag),
            label: requiredTag.label,
          },
          referenceResolution: {
            ...(candidateTagId === undefined ? {} : { candidateTagId }),
            outcome: "pending" as const,
            ...(sourceProposal === undefined
              ? {}
              : { requiredByProposalId: sourceProposal._id }),
            requiredTag,
          },
        }
      : {}),
    refresh,
    refreshCandidateKey: candidateKey,
    originalProposal: currentProposal,
    currentProposal: cloneDraftProposal(currentProposal),
    smartStorageContractVersionId: snapshots.smartStorageContractVersionId,
    typeBehaviorSnapshotId: snapshots.typeBehaviorSnapshotId,
    contractSnapshotVersion: snapshots.contractSnapshotVersion,
    contractSnapshotText: snapshots.contractSnapshotText,
    typeBehaviorSnapshotVersion: snapshots.typeBehaviorSnapshotVersion,
    typeBehaviorSnapshotText: snapshots.typeBehaviorSnapshotText,
    ...(sourceProposal === undefined
      ? {}
      : { supersedesProposalId: sourceProposal._id }),
    createdByUserId: access.userId,
    createdAt: now,
    updatedAt: now,
  });

  if (sourceProposal !== undefined) {
    await copyProposalSourceCitations(ctx, {
      createdAt: now,
      fromProposalId: sourceProposal._id,
      toProposalId: smartStorageProposalId,
    });
    if (isOpenSmartStorageProposal(sourceProposal)) {
      await ctx.db.patch(sourceProposal._id, {
        status: "stale",
        updatedAt: now,
      });
    }
  } else {
    await insertProposalSourceCitations(ctx, {
      createdAt: now,
      proposalId: smartStorageProposalId,
      sources: [source],
    });
  }
  await ctx.db.patch(contributionSubmission._id, {
    submissionStatus: "reviewReady",
    updatedAt: now,
  });

  return {
    role,
    smartStorageProposalId,
    ...(sourceEntry === undefined ? {} : { sourceEntryId: sourceEntry._id }),
    ...(sourceProposal === undefined
      ? {}
      : { sourceProposalId: sourceProposal._id }),
    status: "created" as const,
  };
}

function getRefreshSuggestionKind({
  origin,
  sourceProposal,
  suggestionKind,
}: {
  origin: SmartStorageRefreshOrigin;
  sourceProposal?: Doc<"smartStorageProposals">;
  suggestionKind?: SmartStorageRefreshSuggestionKind;
}) {
  if (suggestionKind !== undefined) {
    return suggestionKind;
  }

  return origin === "contractRefresh" || sourceProposal?.status === "stale"
    ? "staleProposalRefresh"
    : "suggestedEdit";
}

function getRefreshTargetKnowledgeType({
  requiredTag,
  sourceEntry,
  sourceProposal,
  suggestionKind,
  targetKnowledgeType,
}: {
  requiredTag?: ContextTagSnapshotInput;
  sourceEntry?: Doc<"knowledgeEntries">;
  sourceProposal?: Doc<"smartStorageProposals">;
  suggestionKind: SmartStorageRefreshSuggestionKind;
  targetKnowledgeType?: EntryKnowledgeType;
}) {
  if (targetKnowledgeType !== undefined) {
    return targetKnowledgeType;
  }
  if (suggestionKind === "referenceResolution") {
    if (requiredTag === undefined) {
      throw new Error(
        "Reference-resolution reprocessing requires a required Tag.",
      );
    }
    if (isEntryKnowledgeType(requiredTag.knowledgeType)) {
      return requiredTag.knowledgeType;
    }
    throw new Error(
      "Reference-resolution reprocessing requires an authorable target Knowledge Type.",
    );
  }

  return sourceProposal?.currentProposal.knowledgeType ?? sourceEntry?.knowledgeType ?? "words";
}

function getRefreshProposalRole(
  origin: SmartStorageRefreshOrigin,
  suggestionKind: SmartStorageRefreshSuggestionKind,
): SmartStorageSessionProposalRole {
  if (suggestionKind === "referenceResolution") {
    return "referenceResolution";
  }

  return origin === "reprocessing" ? "reprocessing" : "refresh";
}

function buildRefreshProposal({
  reason,
  requiredTag,
  sourceEntry,
  sourceProposal,
  suggestionKind,
  targetKnowledgeType,
}: {
  reason: string;
  requiredTag?: ContextTagSnapshotInput;
  sourceEntry?: Doc<"knowledgeEntries">;
  sourceProposal?: SmartStorageProposedEntryDoc;
  suggestionKind: SmartStorageRefreshSuggestionKind;
  targetKnowledgeType: EntryKnowledgeType;
}): SmartStorageProposedEntryDoc {
  if (suggestionKind === "referenceResolution") {
    if (requiredTag === undefined) {
      throw new Error(
        "Reference-resolution reprocessing requires a required Tag.",
      );
    }

    return {
      knowledgeType: targetKnowledgeType,
      title: `Resolve ${requiredTag.label}`,
      bodyPreview: limitString(
        `Confirm the referenced ${formatKnowledgeTypeLabel(
          requiredTag.knowledgeType as EntryKnowledgeType,
        )} before accepting this reprocessed work.`,
        MAX_BODY_PREVIEW_LENGTH,
      ),
      contextTags: [],
      proposalConfidence: "medium",
      rationale: reason,
    };
  }

  const baseTitle = sourceProposal?.title ?? sourceEntry?.title ?? "Smart Storage work";
  const basePreview =
    sourceProposal?.bodyPreview ??
    sourceEntry?.previewText ??
    "Review this Smart Storage material under the current contract.";
  const contextTags = normalizeContextTags(sourceProposal?.contextTags ?? []);
  const title =
    suggestionKind === "newDerivedEntry"
      ? `Derived: ${baseTitle}`
      : baseTitle;

  return {
    knowledgeType:
      suggestionKind === "typeReclassification"
        ? targetKnowledgeType
        : targetKnowledgeType,
    title: limitString(title, MAX_TITLE_LENGTH),
    bodyPreview: limitString(
      suggestionKind === "staleProposalRefresh"
        ? basePreview
        : reason,
      MAX_BODY_PREVIEW_LENGTH,
    ),
    contextTags,
    proposalConfidence: sourceProposal?.proposalConfidence ?? "medium",
    rationale: limitString(
      `${reason} This suggestion is reviewable Silver work and will not update Gold entries unless accepted.`,
      MAX_RATIONALE_LENGTH,
    ),
  };
}

function getDefaultRefreshReason(
  origin: SmartStorageRefreshOrigin,
  suggestionKind: SmartStorageRefreshSuggestionKind,
) {
  if (origin === "contractRefresh") {
    return "This Smart Storage proposal was generated under an older Smart Storage Contract or Type Behavior. Refresh creates a new reviewable proposal under the current rules.";
  }
  if (suggestionKind === "typeReclassification") {
    return "Reprocessing found a more specific Knowledge Type candidate. Review is required before any Type Reclassification affects Gold knowledge.";
  }
  if (suggestionKind === "newDerivedEntry") {
    return "Reprocessing found a possible derived Knowledge Entry in preserved Source material. Review is required before creating Gold knowledge.";
  }
  if (suggestionKind === "referenceResolution") {
    return "Reprocessing found a reference that needs explicit Known Referent review before it can be used.";
  }

  return "Reprocessing found a possible update under the current Smart Storage Contract. Review is required before any Gold entry changes.";
}

function getRefreshCandidateKey({
  origin,
  requiredTag,
  sourceEntryId,
  sourceProposalId,
  suggestionKind,
  targetKnowledgeType,
}: {
  origin: SmartStorageRefreshOrigin;
  requiredTag?: ContextTagSnapshotInput;
  sourceEntryId?: Id<"knowledgeEntries">;
  sourceProposalId?: Id<"smartStorageProposals">;
  suggestionKind: SmartStorageRefreshSuggestionKind;
  targetKnowledgeType: EntryKnowledgeType;
}) {
  const sourceKey =
    sourceProposalId !== undefined
      ? `proposal:${sourceProposalId}`
      : `entry:${sourceEntryId ?? "unknown"}`;
  const requiredTagKey =
    requiredTag === undefined ? "" : getContextSnapshotIdentityKey(requiredTag);

  return limitString(
    [
      sourceKey,
      origin,
      suggestionKind,
      targetKnowledgeType,
      requiredTagKey,
      SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
      getTypeBehaviorSnapshot(targetKnowledgeType).version,
    ].join("|"),
    MAX_REFRESH_CANDIDATE_KEY_LENGTH,
  );
}

async function hasRefreshDismissal(
  ctx: MutationCtx | QueryCtx,
  {
    contributionSubmission,
    refresh,
  }: {
    contributionSubmission: Doc<"contributionSubmissions">;
    refresh: {
      candidateKey: string;
      targetContractSnapshotVersion?: string;
      targetTypeBehaviorSnapshotVersion?: string;
    };
  },
) {
  const dismissal = await ctx.db
    .query("smartStorageRefreshDismissals")
    .withIndex(
      "by_candidate_scope_and_versions",
      (q) =>
        q
          .eq("candidateKey", refresh.candidateKey)
          .eq("reviewScopeKind", contributionSubmission.reviewScopeKind)
          .eq("reviewScopeTargetKey", contributionSubmission.reviewScopeTargetKey)
          .eq(
            "contractSnapshotVersion",
            refresh.targetContractSnapshotVersion,
          )
          .eq(
            "typeBehaviorSnapshotVersion",
            refresh.targetTypeBehaviorSnapshotVersion,
          ),
    )
    .first();

  return dismissal !== null;
}

async function rememberRefreshDismissal(
  ctx: MutationCtx,
  {
    contributionSubmission,
    dismissedByUserId,
    dismissalKind,
    now,
    refresh,
  }: {
    contributionSubmission: Doc<"contributionSubmissions">;
    dismissedByUserId: Id<"users">;
    dismissalKind: "dismissed" | "rejected";
    now: number;
    refresh: {
      candidateKey: string;
      sourceEntryId?: Id<"knowledgeEntries">;
      sourceProposalId?: Id<"smartStorageProposals">;
      targetContractSnapshotVersion?: string;
      targetTypeBehaviorSnapshotVersion?: string;
    };
  },
) {
  if (
    await hasRefreshDismissal(ctx, {
      contributionSubmission,
      refresh,
    })
  ) {
    return;
  }

  await ctx.db.insert("smartStorageRefreshDismissals", {
    candidateKey: refresh.candidateKey,
    reviewScopeKind: contributionSubmission.reviewScopeKind,
    reviewScopeTargetKey: contributionSubmission.reviewScopeTargetKey,
    ...(refresh.targetContractSnapshotVersion === undefined
      ? {}
      : { contractSnapshotVersion: refresh.targetContractSnapshotVersion }),
    ...(refresh.targetTypeBehaviorSnapshotVersion === undefined
      ? {}
      : {
          typeBehaviorSnapshotVersion:
            refresh.targetTypeBehaviorSnapshotVersion,
        }),
    ...(refresh.sourceProposalId === undefined
      ? {}
      : { sourceProposalId: refresh.sourceProposalId }),
    ...(refresh.sourceEntryId === undefined
      ? {}
      : { sourceEntryId: refresh.sourceEntryId }),
    dismissalKind,
    dismissedByUserId,
    createdAt: now,
    updatedAt: now,
  });
}

async function copyProposalSourceCitations(
  ctx: MutationCtx,
  {
    createdAt,
    fromProposalId,
    toProposalId,
  }: {
    createdAt: number;
    fromProposalId: Id<"smartStorageProposals">;
    toProposalId: Id<"smartStorageProposals">;
  },
) {
  const citations = await listProposalSourceCitations(ctx, fromProposalId);
  if (citations.length === 0) {
    return;
  }

  for (const citation of citations) {
    await ctx.db.insert("proposalSourceCitations", {
      proposalId: toProposalId,
      sourceId: citation.sourceId,
      citationKind: citation.citationKind,
      ...(citation.excerptText === undefined
        ? {}
        : { excerptText: citation.excerptText }),
      ...(citation.locator === undefined ? {} : { locator: citation.locator }),
      ...(citation.externalUrl === undefined
        ? {}
        : { externalUrl: citation.externalUrl }),
      ...(citation.rationale === undefined
        ? {}
        : { rationale: citation.rationale }),
      createdAt,
    });
  }
}

async function getContextTagSnapshotForTagId(
  ctx: MutationCtx | QueryCtx,
  tagId: Id<"tags">,
): Promise<ContextTagSnapshotInput | undefined> {
  const tag = await ctx.db.get(tagId);
  if (!tag) {
    return undefined;
  }

  const referent = await ctx.db.get(tag.referentId);
  if (!referent) {
    return undefined;
  }

  return getContextTagSnapshotForTag(tag, referent);
}

function getContextTagSnapshotForTag(
  tag: Doc<"tags">,
  referent: Doc<"referents">,
): ContextTagSnapshotInput {
  const canonicalKey = referent.canonicalKey || tag.lookupKey;

  return {
    canonicalKey,
    href: getContextTagHref(tag),
    id: tag.lookupKey,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    ...(tag.knowledgeType === "biblePassage"
      ? { passageString: tag.lookupKey }
      : {}),
  };
}

function getContextTagHref(tag: Doc<"tags">) {
  if (tag.knowledgeType === "biblePassage") {
    return `/scripture/${encodeURIComponent(tag.lookupKey)}`;
  }

  return `/goto/${encodeURIComponent(tag.lookupKey)}`;
}

function compareSmartStorageReviewSlots(
  left: Awaited<ReturnType<typeof toSmartStorageReviewSlotSummary>>,
  right: Awaited<ReturnType<typeof toSmartStorageReviewSlotSummary>>,
) {
  const leftReadyRank = left.acceptReady ? 0 : 1;
  const rightReadyRank = right.acceptReady ? 0 : 1;
  if (leftReadyRank !== rightReadyRank) {
    return leftReadyRank - rightReadyRank;
  }

  const groupComparison = left.group.title.localeCompare(right.group.title);
  if (groupComparison !== 0) {
    return groupComparison;
  }

  return right.updatedAt - left.updatedAt;
}

function getReviewSlotEvidenceSummary({
  citationCount,
  sourceCount,
}: {
  citationCount: number;
  sourceCount: number;
}) {
  if (citationCount > 0) {
    return getCountLabel(citationCount, "evidence citation");
  }

  return getCountLabel(sourceCount, "preserved Source");
}

function getReviewScopeLabel(
  contributionSubmission: Doc<"contributionSubmissions">,
) {
  if (contributionSubmission.reviewScopeKind === "organization") {
    return "Organization review";
  }
  if (contributionSubmission.reviewScopeKind === "group") {
    return "Group review";
  }
  if (contributionSubmission.reviewScopeKind === "public") {
    return "Public review";
  }

  return "Private review";
}

function getSmartStorageSessionHref(
  contributionSubmissionId: Id<"contributionSubmissions">,
  proposalId?: Id<"smartStorageProposals">,
) {
  const baseHref = `/smart-storage/${contributionSubmissionId}`;
  return proposalId === undefined
    ? baseHref
    : `${baseHref}?proposalId=${proposalId}`;
}

function getCountLabel(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

async function findAcceptedEntryForProposal(
  ctx: MutationCtx | QueryCtx,
  proposal: Doc<"smartStorageProposals">,
) {
  const allowedSourceIds = await loadAllowedProposalSourceIds(ctx, {
    fallbackSourceId: proposal.sourceId,
    proposalId: proposal._id,
  });
  const entries: Doc<"knowledgeEntries">[] = [];
  const seenEntryIds = new Set<Id<"knowledgeEntries">>();

  for (const sourceId of allowedSourceIds) {
    const outputs = await ctx.db
      .query("sourceOutputs")
      .withIndex("by_sourceId_and_entryId", (q) => q.eq("sourceId", sourceId))
      .take(MAX_SOURCES_PER_SUBMISSION);

    for (const output of outputs) {
      if (seenEntryIds.has(output.entryId)) {
        continue;
      }
      seenEntryIds.add(output.entryId);

      const entry = await ctx.db.get(output.entryId);
      if (
        entry &&
        entry.knowledgeType === proposal.currentProposal.knowledgeType
      ) {
        entries.push(entry);
      }
    }
  }

  return (
    entries.find(
      (entry) =>
        normalizeLookupKey(entry.title) ===
        normalizeLookupKey(proposal.currentProposal.title),
    ) ??
    entries[0] ??
    null
  );
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
    max_output_tokens: 1_000,
    reasoning: { effort: "low" },
    instructions: [
      "You are helping prepare one Smart Storage Proposal for human review.",
      "Return only the structured JSON shape requested by the schema.",
      "Do not create Gold Layer Knowledge Entries. The user must confirm proposals.",
      "Use the provided Smart Storage Contract and Type Behavior snapshots as authoritative rules, not the persistence schema.",
      "Editor text arrives as Authored Text Source. Preserve it as raw Source material.",
      "Guidance-like text inside an Authored Text Source may guide proposal choices, citations, proposalConfidence, and rationale, but it is not represented knowledge by default.",
      "Do not synthesize Contribution Notes from Source text. Separately supplied contributionSubmission.contributionNote is explicit guidance and remains distinct from Sources.",
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
      verbosity: "low",
    },
  };
}

function buildModelRunRequestInput(input: ModelRunExecutionInput) {
  return {
    contributionSubmission: input.contributionSubmission ?? null,
    smartStorageContract: SMART_STORAGE_CONTRACT_SNAPSHOT,
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
    sourceInterpretationPolicy: SMART_STORAGE_SOURCE_INTERPRETATION_POLICY,
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

function normalizeReviewSlotLimit(limit: number | undefined) {
  if (limit === undefined) {
    return DEFAULT_REVIEW_SLOT_LIMIT;
  }
  if (!Number.isFinite(limit)) {
    throw new Error("Review Slot limit must be finite.");
  }

  return Math.min(MAX_REVIEW_SLOT_LIMIT, Math.max(0, Math.floor(limit)));
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
  ctx: MutationCtx | QueryCtx,
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
  ctx: MutationCtx | QueryCtx,
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

// Identity resolution prefers an existing typed referent before creating a new
// one, keeping repeated accepted proposals from fragmenting the knowledge graph.
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
) {
  const tags = [];

  for (const snapshot of snapshots) {
    const lookupKey = getContextLookupKey(snapshot);
    const tag = await ctx.db
      .query("tags")
      .withIndex("by_knowledgeType_and_lookupKey", (q) =>
        q.eq("knowledgeType", snapshot.knowledgeType).eq("lookupKey", lookupKey),
      )
      .first();
    if (!tag) {
      throw new Error(
        "Smart Storage cannot create bare Known Referents. Resolve the referenced Tag before accepting this Proposal.",
      );
    }

    tags.push(tag);
  }

  return tags;
}

async function applyReferenceResolutionToDependentWork(
  ctx: MutationCtx,
  {
    now,
    resolvedTag,
    resolvedTagDoc,
    requiredTag,
    targetProposalId,
    userId,
  }: {
    now: number;
    resolvedTag: ContextTagSnapshotInput;
    resolvedTagDoc: Doc<"tags">;
    requiredTag: ContextTagSnapshotInput;
    targetProposalId?: Id<"smartStorageProposals">;
    userId: Id<"users">;
  },
) {
  if (targetProposalId === undefined) {
    return [];
  }

  const targetProposal = await ctx.db.get(targetProposalId);
  if (!targetProposal) {
    return [];
  }
  if (targetProposal.createdByUserId !== userId) {
    throw new Error("Unauthorized");
  }

  if (isOpenSmartStorageProposal(targetProposal)) {
    const replaced = replaceContextTagSnapshot(
      targetProposal.currentProposal.contextTags,
      requiredTag,
      resolvedTag,
    );
    if (!replaced.changed) {
      return [];
    }

    await ctx.db.patch(targetProposal._id, {
      currentProposal: {
        ...targetProposal.currentProposal,
        contextTags: replaced.contextTags,
      },
      updatedAt: now,
    });

    return [targetProposal._id];
  }

  if (targetProposal.status !== "accepted") {
    return [];
  }

  const acceptedEntry = await findAcceptedEntryForProposal(ctx, targetProposal);
  if (!acceptedEntry || acceptedEntry.createdByUserId !== userId) {
    return [];
  }

  await insertEntryContextTags(ctx, {
    contextTags: [resolvedTagDoc],
    entryId: acceptedEntry._id,
    now,
    taggedByUserId: userId,
  });
  await ctx.db.patch(acceptedEntry._id, {
    contextPreviewTagLabels: appendPreviewTagLabel(
      acceptedEntry.contextPreviewTagLabels,
      resolvedTagDoc.label,
    ),
    searchText: limitString(
      `${acceptedEntry.searchText} ${resolvedTagDoc.label}`,
      MAX_SEARCH_TEXT_LENGTH,
    ),
    updatedAt: now,
  });

  return [targetProposal._id];
}

function replaceContextTagSnapshot(
  currentTags: ContextTagSnapshotInput[],
  requiredTag: ContextTagSnapshotInput,
  resolvedTag: ContextTagSnapshotInput,
) {
  const nextTags: ContextTagSnapshotInput[] = [];
  let changed = false;
  let inserted = false;
  const seenKeys = new Set<string>();
  const resolvedKey = getContextSnapshotIdentityKey(resolvedTag);

  for (const tag of currentTags) {
    const nextTag = isSameContextTagTarget(tag, requiredTag)
      ? resolvedTag
      : tag;
    if (nextTag === resolvedTag) {
      changed = true;
      inserted = true;
    }

    const key = getContextSnapshotIdentityKey(nextTag);
    if (seenKeys.has(key)) {
      changed = true;
      continue;
    }
    seenKeys.add(key);
    nextTags.push(nextTag);
  }

  if (!inserted && !seenKeys.has(resolvedKey)) {
    nextTags.push(resolvedTag);
    changed = true;
  }

  return {
    changed,
    contextTags: normalizeContextTags(nextTags),
  };
}

function appendPreviewTagLabel(labels: string[], label: string) {
  if (labels.includes(label)) {
    return labels;
  }

  return [...labels, label].slice(0, MAX_CONTEXT_PREVIEW_TAG_LABELS);
}

function isSameContextTagTarget(
  left: ContextTagSnapshotInput,
  right: ContextTagSnapshotInput,
) {
  return getContextSnapshotIdentityKey(left) === getContextSnapshotIdentityKey(right);
}

function getContextSnapshotIdentityKey(tag: ContextTagSnapshotInput) {
  return `${tag.knowledgeType}:${getContextLookupKey(tag)}`;
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
  ctx: MutationCtx | QueryCtx,
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

// Accepted representations connect the reviewed proposal back to preserved
// sources, making provenance visible after the gold entry is created.
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

  await insertOpenSourceThumbnailFallback(ctx, {
    entryId,
    now,
    proposedEntry,
    representationDecisions,
  });
}

async function insertOpenSourceThumbnailFallback(
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
  if (!supportsRepresentativeThumbnailType(proposedEntry.knowledgeType)) {
    return;
  }
  if (representationDecisions.some(hasUploadedThumbnailRepresentation)) {
    return;
  }
  if (await entryHasThumbnailRepresentation(ctx, entryId)) {
    return;
  }

  const source = representationDecisions
    .map((decision) => decision.source)
    .find(
      (candidate) =>
        candidate.sourceKind === "externalUrl" &&
        candidate.linkPreviewImageUrl !== undefined,
    );
  const thumbnailUrl = source?.linkPreviewImageUrl?.trim();
  if (!source || !thumbnailUrl) {
    return;
  }

  await ctx.db.insert("entryRepresentations", {
    entryId,
    representationKind: "externalUrl",
    representationRole: "thumbnail",
    externalUrl: limitString(thumbnailUrl, MAX_URL_LENGTH),
    isPrimary: false,
    createdAt: now,
    updatedAt: now,
  });

  const existingOutput = await ctx.db
    .query("sourceOutputs")
    .withIndex("by_sourceId_and_entryId", (q) =>
      q.eq("sourceId", source._id).eq("entryId", entryId),
    )
    .first();
  if (!existingOutput) {
    await ctx.db.insert("sourceOutputs", {
      sourceId: source._id,
      entryId,
      outputKind: "produced",
      createdAt: now,
    });
  }
}

async function entryHasThumbnailRepresentation(
  ctx: MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  const storageRepresentations = await ctx.db
    .query("entryRepresentations")
    .withIndex("by_entryId_and_representationKind", (q) =>
      q.eq("entryId", entryId).eq("representationKind", "storageFile"),
    )
    .take(MAX_SOURCES_PER_SUBMISSION);
  if (storageRepresentations.some(isThumbnailRepresentation)) {
    return true;
  }

  const externalRepresentations = await ctx.db
    .query("entryRepresentations")
    .withIndex("by_entryId_and_representationKind", (q) =>
      q.eq("entryId", entryId).eq("representationKind", "externalUrl"),
    )
    .take(MAX_SOURCES_PER_SUBMISSION);

  return externalRepresentations.some(isThumbnailRepresentation);
}

function hasUploadedThumbnailRepresentation(
  decision: AcceptedRepresentationDecision,
) {
  return (
    decision.representationRole === "thumbnail" ||
    (decision.source.sourceKind === "uploadedFile" &&
      inferFileRepresentationRole(decision.source) === "thumbnail")
  );
}

function isThumbnailRepresentation(
  representation: Pick<
    Doc<"entryRepresentations">,
    "contentType" | "fileName" | "representationKind" | "representationRole"
  >,
) {
  return (
    representation.representationRole === "thumbnail" ||
    (representation.representationKind === "storageFile" &&
      inferFileRepresentationRoleFromMetadata(
        representation.contentType,
        representation.fileName,
      ) === "thumbnail")
  );
}

function supportsRepresentativeThumbnailType(knowledgeType: EntryKnowledgeType) {
  return (
    knowledgeType !== "announcement" &&
    knowledgeType !== "comment" &&
    knowledgeType !== "words"
  );
}

function isKnowledgeEntryVisibleToAccess(
  entry: Doc<"knowledgeEntries">,
  access: Awaited<ReturnType<typeof requireAppAccess>>,
) {
  if (entry.visibilityKind === "public") {
    return true;
  }

  if (entry.visibilityKind === "private") {
    return (
      entry.visibilityTargetKey === `user:${access.userId}` ||
      entry.visibilityTargetKey === access.userId
    );
  }

  if (entry.visibilityKind === "organization") {
    return access.organizations.some(
      (organization) =>
        organization.organizationReferentId === entry.visibilityTargetKey,
    );
  }

  return false;
}

function canManageSmartStorageSubmission(
  contributionSubmission: Doc<"contributionSubmissions">,
  access: Awaited<ReturnType<typeof requireAppAccess>>,
) {
  if (contributionSubmission.submittedByUserId === access.userId) {
    return true;
  }

  if (access.systemRole === "systemAdmin") {
    return true;
  }

  if (contributionSubmission.reviewScopeKind === "organization") {
    return access.organizations.some(
      (organization) =>
        organization.role === "admin" &&
        contributionSubmission.reviewScopeTargetKey ===
          `organization:${organization.organizationReferentId}`,
    );
  }

  return false;
}

function isAssignedReviewSlotReviewer(
  proposal: Doc<"smartStorageProposals">,
  access: Awaited<ReturnType<typeof requireAppAccess>>,
) {
  return (
    proposal.reviewAssignmentTargetKind === "user" &&
    proposal.reviewAssignedUserId === access.userId
  );
}

async function getSmartStorageProposalAuthorization(
  ctx: MutationCtx | QueryCtx,
  {
    access,
    proposal,
  }: {
    access: Awaited<ReturnType<typeof requireAppAccess>>;
    proposal: Doc<"smartStorageProposals">;
  },
) {
  if (proposal.contributionSubmissionId === undefined) {
    return {
      canManage: proposal.createdByUserId === access.userId,
      contributionSubmission: null,
      isAssignedReviewer: isAssignedReviewSlotReviewer(proposal, access),
    };
  }

  const contributionSubmission = await ctx.db.get(proposal.contributionSubmissionId);
  if (!contributionSubmission) {
    return {
      canManage: false,
      contributionSubmission: null,
      isAssignedReviewer: false,
    };
  }

  return {
    canManage: canManageSmartStorageSubmission(contributionSubmission, access),
    contributionSubmission,
    isAssignedReviewer: isAssignedReviewSlotReviewer(proposal, access),
  };
}

async function assertCanReviewSmartStorageProposal(
  ctx: MutationCtx,
  {
    access,
    proposal,
  }: {
    access: Awaited<ReturnType<typeof requireAppAccess>>;
    proposal: Doc<"smartStorageProposals">;
  },
) {
  const authorization = await getSmartStorageProposalAuthorization(ctx, {
    access,
    proposal,
  });
  if (!authorization.canManage && !authorization.isAssignedReviewer) {
    throw new Error("Unauthorized");
  }

  return authorization;
}

async function listProposalReviewSources(
  ctx: MutationCtx | QueryCtx,
  proposal: Doc<"smartStorageProposals">,
) {
  const allowedSourceIds = await loadAllowedProposalSourceIds(ctx, {
    fallbackSourceId: proposal.sourceId,
    proposalId: proposal._id,
  });
  const sources = [];
  for (const sourceId of allowedSourceIds) {
    const source = await ctx.db.get(sourceId);
    if (source) {
      sources.push(source);
    }
  }

  return sources;
}

async function getSmartStorageReviewAssignmentSummary(
  ctx: MutationCtx | QueryCtx,
  proposal: Doc<"smartStorageProposals">,
) {
  if (
    proposal.reviewAssignmentTargetKind !== "user" ||
    proposal.reviewAssignedUserId === undefined ||
    proposal.reviewAssignedByUserId === undefined ||
    proposal.reviewAssignedAt === undefined
  ) {
    return undefined;
  }

  const targetUser = await ctx.db.get(proposal.reviewAssignedUserId);

  return {
    assignedAt: proposal.reviewAssignedAt,
    assignedByUserId: proposal.reviewAssignedByUserId,
    targetKind: "user" as const,
    targetLabel: getUserDisplayLabel(targetUser),
    targetUserId: proposal.reviewAssignedUserId,
  };
}

function getUserDisplayLabel(user: Doc<"users"> | null) {
  return user?.name ?? user?.email ?? "Assigned user";
}

async function markProposalAccepted(
  ctx: MutationCtx,
  {
    contributionSubmissionId,
    now,
    proposalId,
    submissionStatus,
  }: {
    contributionSubmissionId?: Id<"contributionSubmissions">;
    now: number;
    proposalId: Id<"smartStorageProposals">;
    submissionStatus: Doc<"contributionSubmissions">["submissionStatus"];
  },
) {
  await ctx.db.patch(proposalId, {
    status: "accepted",
    updatedAt: now,
  });
  if (contributionSubmissionId !== undefined) {
    await ctx.db.patch(contributionSubmissionId, {
      submissionStatus,
      updatedAt: now,
    });
  }
}

async function recordSmartStorageUpgradeProvenance(
  ctx: MutationCtx,
  {
    acceptedByUserId,
    now,
    proposal,
    targetEntryId,
  }: {
    acceptedByUserId: Id<"users">;
    now: number;
    proposal: Doc<"smartStorageProposals">;
    targetEntryId?: Id<"knowledgeEntries">;
  },
) {
  const refresh = proposal.refresh;
  if (refresh === undefined) {
    return;
  }

  await ctx.db.insert("smartStorageUpgradeProvenanceRecords", {
    acceptedProposalId: proposal._id,
    candidateKey: refresh.candidateKey,
    origin: refresh.origin,
    suggestionKind: refresh.suggestionKind,
    ...(refresh.sourceProposalId === undefined
      ? {}
      : { sourceProposalId: refresh.sourceProposalId }),
    ...(refresh.sourceEntryId === undefined
      ? {}
      : { sourceEntryId: refresh.sourceEntryId }),
    ...(targetEntryId === undefined ? {} : { targetEntryId }),
    acceptedByUserId,
    ...(refresh.targetContractSnapshotVersion === undefined
      ? {}
      : { contractSnapshotVersion: refresh.targetContractSnapshotVersion }),
    ...(refresh.targetTypeBehaviorSnapshotVersion === undefined
      ? {}
      : {
          typeBehaviorSnapshotVersion:
            refresh.targetTypeBehaviorSnapshotVersion,
        }),
    createdAt: now,
  });
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
  const key = (tag.canonicalKey || tag.id || tag.label).trim();
  return key.includes(":") ? key : normalizeLookupKey(key);
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
  ctx: MutationCtx | QueryCtx,
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
    throw new Error("Uploaded file size must be non-negative.");
  }

  return Math.floor(fileSizeBytes);
}
