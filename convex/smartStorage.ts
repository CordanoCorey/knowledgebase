import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { requireAppAccess } from "./lib/appAccess";

const MAX_TITLE_LENGTH = 240;
const MAX_SOURCE_TEXT_LENGTH = 40_000;
const MAX_BODY_PREVIEW_LENGTH = 500;
const MAX_CONTEXT_TAGS = 20;
const MAX_CONTEXT_TAG_FIELD_LENGTH = 240;
const MAX_CONTEXT_TAG_HREF_LENGTH = 500;
const MAX_SLOT_ID_LENGTH = 240;
const MAX_RATIONALE_LENGTH = 500;
const MAX_RAW_MODEL_OUTPUT_LENGTH = 4_000;

const SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION =
  "mvp-smart-storage-contract-v0";
const SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT =
  "Preserve the submitted Source and queue Smart Storage proposal generation. Proposal contracts are generated in a later slice.";
const TYPE_BEHAVIOR_SNAPSHOT_VERSION = "mvp-type-behavior-v0";
const TYPE_BEHAVIOR_SNAPSHOT_TEXT =
  "Use the submitted Knowledge Type and context snapshot as the initial Smart Storage request.";
const DETERMINISTIC_GENERATOR_VERSION = "mvp-deterministic-proposal-v0";

type ReferentKnowledgeType =
  | "words"
  | "biblePassage"
  | "topic"
  | "series"
  | "question"
  | "quote"
  | "sermon"
  | "essay"
  | "poem"
  | "song"
  | "book"
  | "shortStory"
  | "lesson"
  | "comment"
  | "prayerRequest"
  | "event"
  | "rsvp"
  | "person"
  | "organization"
  | "group"
  | "place";

type ContextTagSnapshotInput = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: ReferentKnowledgeType;
  label: string;
  passageString?: string;
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

export const startFromContribution = mutation({
  args: {
    body: v.string(),
    contextTags: v.array(contextTagSnapshot),
    knowledgeType: entryKnowledgeType,
    slotId: v.optional(v.string()),
    title: v.string(),
  },
  returns: v.object({
    smartStorageRunId: v.id("smartStorageRuns"),
    sourceId: v.id("sources"),
    status: v.literal("queued"),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const now = Date.now();
    const title = limitString(args.title, MAX_TITLE_LENGTH);
    const body = limitString(args.body, MAX_SOURCE_TEXT_LENGTH);
    const rawText = body || title;

    if (!rawText) {
      throw new Error("Source text is required.");
    }

    const sourceId = await ctx.db.insert("sources", {
      sourceKind: "manualEntry",
      ...(title ? { title } : {}),
      rawText,
      submittedByUserId: access.userId,
      submittedAt: now,
    });

    const smartStorageRunId = await ctx.db.insert("smartStorageRuns", {
      sourceId,
      status: "queued",
      requestedKnowledgeType: args.knowledgeType,
      contributionTitle: title,
      contributionBodyPreview: limitString(rawText, MAX_BODY_PREVIEW_LENGTH),
      contextTags: normalizeContextTags(args.contextTags),
      ...(args.slotId === undefined
        ? {}
        : { slotId: limitString(args.slotId, MAX_SLOT_ID_LENGTH) }),
      contractSnapshotVersion: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
      contractSnapshotText: SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT,
      typeBehaviorSnapshotVersion: TYPE_BEHAVIOR_SNAPSHOT_VERSION,
      typeBehaviorSnapshotText: TYPE_BEHAVIOR_SNAPSHOT_TEXT,
      createdByUserId: access.userId,
      createdAt: now,
      updatedAt: now,
    });

    return {
      smartStorageRunId,
      sourceId,
      status: "queued" as const,
    };
  },
});

export const generateDraftProposalForRun = mutation({
  args: {
    smartStorageRunId: v.id("smartStorageRuns"),
  },
  returns: v.object({
    currentProposal: smartStorageProposedEntry,
    smartStorageProposalId: v.id("smartStorageProposals"),
    smartStorageRunId: v.id("smartStorageRuns"),
    sourceId: v.id("sources"),
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
        currentProposal: existingProposal.currentProposal,
        smartStorageProposalId: existingProposal._id,
        smartStorageRunId: run._id,
        sourceId: existingProposal.sourceId,
        status: "drafted" as const,
      };
    }

    if (run.status !== "queued") {
      throw new Error("Smart Storage Run is not queued.");
    }

    const source = await ctx.db.get(run.sourceId);
    if (!source) {
      throw new Error("Source not found.");
    }
    if (
      source.submittedByUserId !== undefined &&
      source.submittedByUserId !== access.userId
    ) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    const originalProposal = buildDraftProposal(run, source);
    const currentProposal = cloneDraftProposal(originalProposal);
    const rawModelOutput = limitString(
      JSON.stringify({
        generatorVersion: DETERMINISTIC_GENERATOR_VERSION,
        proposal: originalProposal,
      }),
      MAX_RAW_MODEL_OUTPUT_LENGTH,
    );

    const smartStorageProposalId = await ctx.db.insert(
      "smartStorageProposals",
      {
        sourceId: run.sourceId,
        smartStorageRunId: run._id,
        status: "drafted",
        originalProposal,
        currentProposal,
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

    await ctx.db.patch(run._id, {
      status: "succeeded",
      rawModelOutput,
      updatedAt: now,
      completedAt: now,
    });

    return {
      currentProposal,
      smartStorageProposalId,
      smartStorageRunId: run._id,
      sourceId: run.sourceId,
      status: "drafted" as const,
    };
  },
});

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

function buildDraftProposal(
  run: Doc<"smartStorageRuns">,
  source: Doc<"sources">,
) {
  const title =
    run.contributionTitle ||
    source.title ||
    inferTitleFromSourceText(source.rawText ?? run.contributionBodyPreview);
  const bodyPreview =
    run.contributionBodyPreview ||
    limitString(source.rawText ?? title, MAX_BODY_PREVIEW_LENGTH);

  return {
    knowledgeType: run.requestedKnowledgeType,
    title: limitString(title, MAX_TITLE_LENGTH),
    bodyPreview: limitString(bodyPreview, MAX_BODY_PREVIEW_LENGTH),
    contextTags: cloneContextTags(run.contextTags),
    proposalConfidence: "medium" as const,
    rationale: limitString(
      "Deterministic MVP proposal generated from the submitted Source and requested Knowledge Type.",
      MAX_RATIONALE_LENGTH,
    ),
  };
}

function cloneDraftProposal(proposal: ReturnType<typeof buildDraftProposal>) {
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

function inferTitleFromSourceText(sourceText: string) {
  return (
    sourceText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "Untitled Source"
  );
}

function limitString(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}
