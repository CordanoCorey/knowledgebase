/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./contextExpertise.ts": () => import("./contextExpertise"),
  "./lib/appAccess.ts": () => import("./lib/appAccess"),
  "./lib/contextExpertiseEvidence.ts": () =>
    import("./lib/contextExpertiseEvidence"),
  "./lib/fileRepresentationRoles.ts": () =>
    import("./lib/fileRepresentationRoles"),
  "./lib/referentThumbnails.ts": () => import("./lib/referentThumbnails"),
  "./lib/typeBehavior.ts": () => import("./lib/typeBehavior"),
  "./smartStorage.ts": () => import("./smartStorage"),
};

type TestContextTagSnapshot = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: Doc<"referents">["knowledgeType"];
  label: string;
  passageString?: string;
};

type SmartStorageContributionInput = {
  body: string;
  contributionNote?: string;
  contextTags: TestContextTagSnapshot[];
  externalUrls?: Array<{
    linkPreviewDescription?: string;
    linkPreviewImageUrl?: string;
    linkPreviewSiteName?: string;
    linkPreviewTitle?: string;
    title?: string;
    url: string;
  }>;
  knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
  slotId?: string;
  title: string;
};

const SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION =
  "mvp-smart-storage-contract-v3";
const STORED_FILE_ROLE_CASES = [
  {
    contentType: "application/pdf",
    expectedRole: "manuscript",
    fileName: "sermon-manuscript.pdf",
    label: "manuscript",
  },
  {
    contentType:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    expectedRole: "slides",
    fileName: "lesson-slides.pptx",
    label: "slides",
  },
  {
    contentType: "text/plain",
    expectedRole: "transcript",
    fileName: "lesson-transcript.txt",
    label: "transcript",
  },
  {
    contentType: "audio/mpeg",
    expectedRole: "recording",
    fileName: "lesson-recording.mp3",
    label: "audio recording",
  },
  {
    contentType: "video/mp4",
    expectedRole: "recording",
    fileName: "lesson-video.mp4",
    label: "video recording",
  },
  {
    contentType: "image/png",
    expectedRole: "thumbnail",
    fileName: "lesson-thumbnail.png",
    label: "thumbnail",
  },
  {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    expectedRole: "supportingMaterial",
    fileName: "lesson-handout.docx",
    label: "supporting material",
  },
] as const;
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
  sourceInterpretationPolicy: {
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
  },
  boundaries: [
    "Do not expose or rely on the raw Convex persistence schema as the model contract.",
    "Do not synthesize Contribution Notes from Authored Text Sources.",
    "Do not treat guidance-like Source text as represented knowledge by default.",
    "Do not create Gold Layer Knowledge Entries from model output without user confirmation.",
    "Do not invent extracted file, media, or URL facts when advanced extraction has not supplied them.",
  ],
};
const SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT = JSON.stringify(
  SMART_STORAGE_CONTRACT_SNAPSHOT,
  null,
  2,
);

const legacyEntryRepresentationKind = v.union(
  v.literal("prosemirror"),
  v.literal("plainText"),
  v.literal("storageFile"),
  v.literal("externalUrl"),
  v.literal("audio"),
  v.literal("video"),
);

const legacyEntryRepresentationRole = v.union(
  v.literal("unspecified"),
  v.literal("primaryContent"),
  v.literal("manuscript"),
  v.literal("slides"),
  v.literal("transcript"),
  v.literal("recording"),
  v.literal("thumbnail"),
  v.literal("supportingMaterial"),
);

const legacyRepresentationMigrationSchema = defineSchema({
  knowledgeEntries: defineTable({
    title: v.string(),
  }),
  entryRepresentations: defineTable({
    entryId: v.id("knowledgeEntries"),
    representationKind: legacyEntryRepresentationKind,
    representationRole: v.optional(legacyEntryRepresentationRole),
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
  }),
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Smart Storage contribution spine", () => {
  test("preserves a durable Contribution Submission with multiple Sources and queues a Run", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const storageId = await storeTestFile(t, "handout");

    const result = await authed.mutation(api.smartStorage.startFromContribution, {
      body: "  Objective: students will distinguish courage from presumption.  ",
      contextTags: getJoshuaContextTags(),
      externalUrls: [
        {
          linkPreviewTitle: "Courage source preview",
          title: "Courage source",
          url: "https://example.com/courage",
        },
      ],
      knowledgeType: "lesson",
      slotId: "slot-joshua-courage-lesson",
      title: "  Courage in Joshua  ",
      uploadedFiles: [
        {
          contentType: "application/pdf",
          fileName: "courage-handout.pdf",
          fileSizeBytes: 1234,
          storageId,
        },
      ],
    });

    expect(result.status).toBe("queued");
    expect(result.sourceIds).toHaveLength(3);

    const rowState = await t.run(async (ctx) => {
      const contributionSubmission = await ctx.db.get(
        result.contributionSubmissionId,
      );
      const sources = await ctx.db
        .query("sources")
        .withIndex("by_contributionSubmissionId_and_submittedAt", (q) =>
          q.eq("contributionSubmissionId", result.contributionSubmissionId),
        )
        .collect();
      const run = await ctx.db.get(result.smartStorageRunId);
      const contractVersion =
        run?.smartStorageContractVersionId === undefined
          ? null
          : await ctx.db.get(run.smartStorageContractVersionId);
      const typeBehaviorSnapshot =
        run?.typeBehaviorSnapshotId === undefined
          ? null
          : await ctx.db.get(run.typeBehaviorSnapshotId);

      return {
        contractVersion,
        contributionSubmission,
        run,
        sources,
        typeBehaviorSnapshot,
      };
    });

    expect(rowState.contributionSubmission).toEqual(
      expect.objectContaining({
        intendedVisibilityKind: "public",
        intendedVisibilityTargetKey: "public",
        primaryIntendedBodyPreview:
          "Objective: students will distinguish courage from presumption.",
        primaryIntendedKnowledgeType: "lesson",
        primaryIntendedTitle: "Courage in Joshua",
        reviewScopeKind: "private",
        reviewScopeTargetKey: `user:${userId}`,
        submissionStatus: "processing",
        submittedByUserId: userId,
      }),
    );
    expect(rowState.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contributionSubmissionId: result.contributionSubmissionId,
          rawText: "Objective: students will distinguish courage from presumption.",
          sourceKind: "pastedText",
          submittedByUserId: userId,
          title: "Courage in Joshua",
        }),
        expect.objectContaining({
          contentType: "application/pdf",
          contributionSubmissionId: result.contributionSubmissionId,
          fileName: "courage-handout.pdf",
          fileSizeBytes: "handout".length,
          sourceKind: "uploadedFile",
          storageId,
        }),
        expect.objectContaining({
          contributionSubmissionId: result.contributionSubmissionId,
          externalUrl: "https://example.com/courage",
          linkPreviewStatus: "queued",
          linkPreviewTitle: "Courage source preview",
          sourceKind: "externalUrl",
        }),
      ]),
    );
    expect(rowState.run).toEqual(
      expect.objectContaining({
        contributionSubmissionId: result.contributionSubmissionId,
        contextTags: getJoshuaContextTags(),
        contributionBodyPreview:
          "Objective: students will distinguish courage from presumption.",
        contributionTitle: "Courage in Joshua",
        smartStorageContractVersionId: expect.any(String),
        contractSnapshotVersion: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
        createdByUserId: userId,
        primarySourceId: result.sourceId,
        requestedKnowledgeType: "lesson",
        slotId: "slot-joshua-courage-lesson",
        sourceId: result.sourceId,
        status: "queued",
        typeBehaviorSnapshotId: expect.any(String),
        typeBehaviorSnapshotVersion: "mvp-type-behavior-v4",
      }),
    );
    expect(rowState.contractVersion).toEqual(
      expect.objectContaining({
        contractKey: "mvp-smart-storage-contract",
        snapshotText: SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT,
        version: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
      }),
    );
    expect(rowState.typeBehaviorSnapshot).toEqual(
      expect.objectContaining({
        behaviorSnapshotJson: expect.stringContaining(
          '"knowledgeType":"lesson"',
        ),
        knowledgeType: "lesson",
        snapshotText:
          "Use the Type Behavior registry for identity, source citation, representation role, primary representation, Human Weight defaults, and Human Weight credit basis.",
        version: "mvp-type-behavior-v4",
      }),
    );
  });

  test("keeps guidance-like editor text as Authored Text Source without synthesizing a Contribution Note", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const body = [
      "Objective: students will distinguish courage from presumption.",
      "Guidance: keep the attached handout as supporting material only.",
    ].join("\n");

    const result = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({
        body,
        title: "Guided Courage Lesson",
      }),
    );

    const rowState = await t.run(async (ctx) => {
      const contributionSubmission = await ctx.db.get(
        result.contributionSubmissionId,
      );
      const sources = await ctx.db
        .query("sources")
        .withIndex("by_contributionSubmissionId_and_submittedAt", (q) =>
          q.eq("contributionSubmissionId", result.contributionSubmissionId),
        )
        .collect();

      return { contributionSubmission, sources };
    });

    expect(rowState.contributionSubmission?.contributionNote).toBeUndefined();
    expect(rowState.contributionSubmission).toEqual(
      expect.objectContaining({
        primaryIntendedBodyPreview: body,
        primaryIntendedTitle: "Guided Courage Lesson",
      }),
    );
    expect(rowState.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rawText: body,
          sourceKind: "pastedText",
          title: "Guided Courage Lesson",
        }),
      ]),
    );
  });

  test("reuses durable Contract and Type Behavior snapshot rows for matching Runs", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    const first = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({ title: "First Courage Lesson" }),
    );
    const second = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({ title: "Second Courage Lesson" }),
    );

    const rowState = await t.run(async (ctx) => {
      const firstRun = await ctx.db.get(first.smartStorageRunId);
      const secondRun = await ctx.db.get(second.smartStorageRunId);

      return {
        contractVersions: await ctx.db
          .query("smartStorageContractVersions")
          .collect(),
        firstRun,
        secondRun,
        typeBehaviorSnapshots: await ctx.db
          .query("typeBehaviorSnapshots")
          .collect(),
      };
    });

    expect(rowState.contractVersions).toHaveLength(1);
    expect(rowState.typeBehaviorSnapshots).toHaveLength(1);
    expect(rowState.firstRun?.smartStorageContractVersionId).toBe(
      rowState.secondRun?.smartStorageContractVersionId,
    );
    expect(rowState.firstRun?.typeBehaviorSnapshotId).toBe(
      rowState.secondRun?.typeBehaviorSnapshotId,
    );
  });

  test("rejects existing snapshot rows when same version content changed", async () => {
    const contractConflict = convexTest({ schema, modules });
    const contractUserId = await contractConflict.run(insertAllowedUser);
    await contractConflict.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("smartStorageContractVersions", {
        contractKey: "mvp-smart-storage-contract",
        version: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
        snapshotText: "Conflicting contract text.",
        createdAt: now,
        updatedAt: now,
      });
    });
    await expect(
      contractConflict
        .withIdentity({ subject: `${contractUserId}|test-session` })
        .mutation(
          api.smartStorage.startFromContribution,
          getLessonSmartStorageInput(),
        ),
    ).rejects.toThrow(
      "Smart Storage Contract version content changed for existing version.",
    );

    const typeBehaviorConflict = convexTest({ schema, modules });
    const typeBehaviorUserId = await typeBehaviorConflict.run(insertAllowedUser);
    await typeBehaviorConflict.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("smartStorageContractVersions", {
        contractKey: "mvp-smart-storage-contract",
        version: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
        snapshotText: SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("typeBehaviorSnapshots", {
        knowledgeType: "lesson",
        version: "mvp-type-behavior-v4",
        snapshotText: "Conflicting Type Behavior summary.",
        behaviorSnapshotJson: "{}",
        createdAt: now,
        updatedAt: now,
      });
    });
    await expect(
      typeBehaviorConflict
        .withIdentity({ subject: `${typeBehaviorUserId}|test-session` })
        .mutation(
          api.smartStorage.startFromContribution,
          getLessonSmartStorageInput(),
        ),
    ).rejects.toThrow(
      "Type Behavior snapshot content changed for existing version.",
    );
  });

  test("schedules backend Link Preview fetching for external URL Sources", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    const result = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({
        externalUrls: [{ url: "https://example.com/courage" }],
      }),
    );

    const rowState = await t.run(async (ctx) => ({
      externalUrlSource: await getExternalUrlSource(
        ctx,
        result.contributionSubmissionId,
      ),
      scheduledFunctions: await ctx.db.system
        .query("_scheduled_functions")
        .collect(),
    }));

    expect(rowState.externalUrlSource).toEqual(
      expect.objectContaining({
        externalUrl: "https://example.com/courage",
        linkPreviewStatus: "queued",
      }),
    );
    expect(rowState.scheduledFunctions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "smartStorage:fetchLinkPreviewForSource",
          state: { kind: "pending" },
        }),
      ]),
    );
  });

  test("fetches and stores bounded Link Preview metadata for an external URL Source", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const fetchMock = vi.fn(async () =>
      new Response(
        [
          "<html><head>",
          '<meta property="og:title" content="Courage &amp; Counsel">',
          '<meta property="og:description" content="A brief source description.">',
          '<meta property="og:image" content="/images/courage.png">',
          '<meta property="og:site_name" content="Example Library">',
          "</head></html>",
        ].join(""),
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({
        externalUrls: [{ url: "https://example.com/courage" }],
      }),
    );
    const source = await t.run(
      async (ctx) =>
        await getExternalUrlSource(ctx, result.contributionSubmissionId),
    );

    await t.action(internal.smartStorage.fetchLinkPreviewForSource, {
      sourceId: source._id,
      url: "https://example.com/courage",
    });

    const updatedSource = await t.run(async (ctx) => await ctx.db.get(source._id));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(updatedSource).toEqual(
      expect.objectContaining({
        linkPreviewDescription: "A brief source description.",
        linkPreviewFetchedAt: expect.any(Number),
        linkPreviewImageUrl: "https://example.com/images/courage.png",
        linkPreviewSiteName: "Example Library",
        linkPreviewStatus: "fetched",
        linkPreviewTitle: "Courage & Counsel",
      }),
    );
  });

  test("marks Link Preview failed without blocking preserved external URL Sources", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Not found", { status: 404 })),
    );
    const result = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({
        externalUrls: [{ url: "https://example.com/missing" }],
      }),
    );
    const source = await t.run(
      async (ctx) =>
        await getExternalUrlSource(ctx, result.contributionSubmissionId),
    );

    await t.action(internal.smartStorage.fetchLinkPreviewForSource, {
      sourceId: source._id,
      url: "https://example.com/missing",
    });

    const updatedSource = await t.run(async (ctx) => await ctx.db.get(source._id));
    expect(updatedSource).toEqual(
      expect.objectContaining({
        externalUrl: "https://example.com/missing",
        linkPreviewError: "Link Preview fetch failed with 404.",
        linkPreviewFetchedAt: expect.any(Number),
        linkPreviewStatus: "failed",
      }),
    );
  });

  test("rejects unsafe Link Preview URLs without fetching", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({
        externalUrls: [{ url: "http://127.0.0.1/admin" }],
      }),
    );
    const source = await t.run(
      async (ctx) =>
        await getExternalUrlSource(ctx, result.contributionSubmissionId),
    );

    await t.action(internal.smartStorage.fetchLinkPreviewForSource, {
      sourceId: source._id,
      url: "http://127.0.0.1/admin",
    });

    const updatedSource = await t.run(async (ctx) => await ctx.db.get(source._id));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(updatedSource).toEqual(
      expect.objectContaining({
        externalUrl: "http://127.0.0.1/admin",
        linkPreviewError: "Link Preview URL host is not allowed.",
        linkPreviewStatus: "failed",
      }),
    );
  });

  test("previews draft Link Preview metadata without creating Smart Storage rows", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const fetchMock = vi.fn(async () =>
      new Response(
        [
          "<html><head>",
          '<title>Fallback title</title>',
          '<meta property="og:title" content="Draft Courage">',
          '<meta property="og:description" content="Draft preview description.">',
          '<meta property="og:image" content="/images/draft-courage.png">',
          '<meta property="og:site_name" content="Draft Library">',
          "</head></html>",
        ].join(""),
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await authed.action(api.smartStorage.previewDraftExternalUrl, {
      url: "https://example.com/courage",
    });

    const rowCounts = await t.run(async (ctx) => ({
      contributionSubmissions: (
        await ctx.db.query("contributionSubmissions").collect()
      ).length,
      proposals: (await ctx.db.query("smartStorageProposals").collect()).length,
      runs: (await ctx.db.query("smartStorageRuns").collect()).length,
      sources: (await ctx.db.query("sources").collect()).length,
    }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      description: "Draft preview description.",
      imageUrl: "https://example.com/images/draft-courage.png",
      siteName: "Draft Library",
      status: "fetched",
      title: "Draft Courage",
      url: "https://example.com/courage",
    });
    expect(rowCounts).toEqual({
      contributionSubmissions: 0,
      proposals: 0,
      runs: 0,
      sources: 0,
    });
  });

  test("draft Link Preview rejects unsafe URLs without fetching", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await authed.action(api.smartStorage.previewDraftExternalUrl, {
      url: "http://127.0.0.1/admin",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Link Preview URL host is not allowed.",
      status: "failed",
      url: "http://127.0.0.1/admin",
    });
  });

  test("draft Link Preview returns bounded failure for non-HTML responses", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const fetchMock = vi.fn(async () =>
      new Response('{"ok":true}', {
        headers: {
          "content-type": "application/json",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await authed.action(api.smartStorage.previewDraftExternalUrl, {
      url: "https://example.com/api",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      error: "Link Preview response is not HTML.",
      status: "failed",
      url: "https://example.com/api",
    });
  });

  test("draft Link Preview requires app access before fetching", async () => {
    const t = convexTest({ schema, modules });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await t.action(api.smartStorage.previewDraftExternalUrl, {
      url: "https://example.com/courage",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: "Unauthorized",
      status: "failed",
      url: "https://example.com/courage",
    });
  });

  test("marks temporary uploads attached when they become Sources", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const storageId = await storeTestFile(t, "temporary handout");
    const temporaryUpload = await authed.mutation(
      api.smartStorage.createTemporaryUploadRecord,
      {
        contentType: "application/pdf",
        fileName: "temporary-handout.pdf",
        fileSizeBytes: 2000,
        storageId,
      },
    );

    const result = await authed.mutation(api.smartStorage.startFromContribution, {
      body: "",
      contextTags: [],
      knowledgeType: "lesson",
      title: "Uploaded lesson handout",
      uploadedFiles: [
        {
          contentType: "application/pdf",
          fileName: "temporary-handout.pdf",
          fileSizeBytes: 2000,
          storageId,
          temporaryUploadId: temporaryUpload.temporaryUploadId,
        },
      ],
    });

    const uploadRow = await t.run(
      async (ctx) => await ctx.db.get(temporaryUpload.temporaryUploadId),
    );

    expect(uploadRow).toEqual(
      expect.objectContaining({
        attachedContributionSubmissionId: result.contributionSubmissionId,
        uploadStatus: "attached",
        uploadedByUserId: userId,
      }),
    );
  });

  test("records temporary upload metadata from Convex storage for stored file categories", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    for (const fileCase of STORED_FILE_ROLE_CASES) {
      const contents = `${fileCase.label} contents`;
      const storageId = await storeTestFile(
        t,
        contents,
        fileCase.contentType,
      );
      const result = await authed.mutation(
        api.smartStorage.createTemporaryUploadRecord,
        {
          contentType: fileCase.contentType,
          fileName: `  ${fileCase.fileName}  `,
          fileSizeBytes: 999_999,
          storageId,
        },
      );

      const temporaryUpload = await t.run(
        async (ctx) => await ctx.db.get(result.temporaryUploadId),
      );

      expect(temporaryUpload).toEqual(
        expect.objectContaining({
          contentType: fileCase.contentType,
          fileName: fileCase.fileName,
          fileSizeBytes: contents.length,
          storageId,
          uploadStatus: "uploaded",
          uploadedByUserId: userId,
        }),
      );
    }
  });

  test("rejects temporary upload records for missing storage objects", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const storageId = await storeTestFile(t, "deleted upload");
    await t.run(async (ctx) => {
      await ctx.storage.delete(storageId);
    });

    await expect(
      authed.mutation(api.smartStorage.createTemporaryUploadRecord, {
        fileName: "deleted-upload.pdf",
        storageId,
      }),
    ).rejects.toThrow("Uploaded file not found in storage.");
  });

  test("schedules and deletes expired unattached temporary uploads", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const storageId = await storeTestFile(t, "abandoned upload");
    const expiresAt = Date.now() - 1;

    const temporaryUpload = await authed.mutation(
      api.smartStorage.createTemporaryUploadRecord,
      {
        contentType: "application/pdf",
        expiresAt,
        fileName: "abandoned-upload.pdf",
        fileSizeBytes: 2200,
        storageId,
      },
    );

    const scheduledFunctions = await t.run(
      async (ctx) =>
        await ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(scheduledFunctions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "smartStorage:cleanupTemporaryUpload",
          state: { kind: "pending" },
        }),
      ]),
    );

    const cleanup = await t.mutation(
      internal.smartStorage.cleanupTemporaryUpload,
      {
        temporaryUploadId: temporaryUpload.temporaryUploadId,
      },
    );

    const rowState = await t.run(async (ctx) => ({
      storageUrl: await ctx.storage.getUrl(storageId),
      temporaryUpload: await ctx.db.get(temporaryUpload.temporaryUploadId),
    }));

    expect(cleanup).toEqual({ cleanupStatus: "deleted" });
    expect(rowState.storageUrl).toBeNull();
    expect(rowState.temporaryUpload).toEqual(
      expect.objectContaining({
        uploadStatus: "deleted",
      }),
    );
  });

  test("temporary upload cleanup skips attached and not-yet-expired uploads", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const attachedStorageId = await storeTestFile(t, "attached upload");
    const futureStorageId = await storeTestFile(t, "future upload");
    const attachedUpload = await authed.mutation(
      api.smartStorage.createTemporaryUploadRecord,
      {
        expiresAt: Date.now() - 1,
        fileName: "attached-upload.pdf",
        storageId: attachedStorageId,
      },
    );
    const futureUpload = await authed.mutation(
      api.smartStorage.createTemporaryUploadRecord,
      {
        expiresAt: Date.now() + 60_000,
        fileName: "future-upload.pdf",
        storageId: futureStorageId,
      },
    );
    await authed.mutation(api.smartStorage.startFromContribution, {
      body: "",
      contextTags: [],
      knowledgeType: "lesson",
      title: "Attached lesson handout",
      uploadedFiles: [
        {
          fileName: "attached-upload.pdf",
          storageId: attachedStorageId,
          temporaryUploadId: attachedUpload.temporaryUploadId,
        },
      ],
    });

    const attachedCleanup = await t.mutation(
      internal.smartStorage.cleanupTemporaryUpload,
      {
        temporaryUploadId: attachedUpload.temporaryUploadId,
      },
    );
    const futureCleanup = await t.mutation(
      internal.smartStorage.cleanupTemporaryUpload,
      {
        temporaryUploadId: futureUpload.temporaryUploadId,
      },
    );

    const rowState = await t.run(async (ctx) => ({
      attachedStorageUrl: await ctx.storage.getUrl(attachedStorageId),
      attachedUpload: await ctx.db.get(attachedUpload.temporaryUploadId),
      futureStorageUrl: await ctx.storage.getUrl(futureStorageId),
      futureUpload: await ctx.db.get(futureUpload.temporaryUploadId),
    }));

    expect(attachedCleanup).toEqual({ cleanupStatus: "skipped" });
    expect(futureCleanup).toEqual({ cleanupStatus: "notExpired" });
    expect(rowState.attachedStorageUrl).not.toBeNull();
    expect(rowState.futureStorageUrl).not.toBeNull();
    expect(rowState.attachedUpload).toEqual(
      expect.objectContaining({
        uploadStatus: "attached",
      }),
    );
    expect(rowState.futureUpload).toEqual(
      expect.objectContaining({
        uploadStatus: "uploaded",
      }),
    );
  });

  test("batch cleanup deletes expired temporary uploads in bounded passes", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const expiredStorageIds = [
      await storeTestFile(t, "expired upload one"),
      await storeTestFile(t, "expired upload two"),
      await storeTestFile(t, "expired upload three"),
    ];
    const futureStorageId = await storeTestFile(t, "future upload");
    const expiredUploads: Array<{
      temporaryUploadId: Id<"temporaryUploads">;
      uploadStatus: "uploaded";
    }> = [];
    for (const [index, storageId] of expiredStorageIds.entries()) {
      expiredUploads.push(
        await authed.mutation(api.smartStorage.createTemporaryUploadRecord, {
          expiresAt: Date.now() - 1,
          fileName: `expired-${index + 1}.pdf`,
          storageId,
        }),
      );
    }
    const futureUpload = await authed.mutation(
      api.smartStorage.createTemporaryUploadRecord,
      {
        expiresAt: Date.now() + 60_000,
        fileName: "not-expired.pdf",
        storageId: futureStorageId,
      },
    );

    const firstBatch = await t.mutation(
      internal.smartStorage.cleanupExpiredTemporaryUploadsBatch,
      { batchSize: 2 },
    );
    const secondBatch = await t.mutation(
      internal.smartStorage.cleanupExpiredTemporaryUploadsBatch,
      { batchSize: 2 },
    );

    const rowState = await t.run(async (ctx) => ({
      expiredRows: await Promise.all(
        expiredUploads.map((upload) =>
          ctx.db.get(upload.temporaryUploadId),
        ),
      ),
      expiredStorageUrls: await Promise.all(
        expiredStorageIds.map((storageId) => ctx.storage.getUrl(storageId)),
      ),
      futureRow: await ctx.db.get(futureUpload.temporaryUploadId),
      futureStorageUrl: await ctx.storage.getUrl(futureStorageId),
    }));

    expect(firstBatch).toEqual({
      deletedCount: 2,
      processedCount: 2,
      rescheduled: true,
    });
    expect(secondBatch).toEqual({
      deletedCount: 1,
      processedCount: 1,
      rescheduled: false,
    });
    expect(rowState.expiredStorageUrls).toEqual([null, null, null]);
    expect(rowState.expiredRows).toEqual([
      expect.objectContaining({ uploadStatus: "deleted" }),
      expect.objectContaining({ uploadStatus: "deleted" }),
      expect.objectContaining({ uploadStatus: "deleted" }),
    ]);
    expect(rowState.futureStorageUrl).not.toBeNull();
    expect(rowState.futureRow).toEqual(
      expect.objectContaining({ uploadStatus: "uploaded" }),
    );
  });

  test("generates a scaffold Silver Proposal with child Source citations", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({
        externalUrls: [{ url: "https://example.com/courage" }],
      }),
    );

    const result = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );

    expect(result).toMatchObject({
      contributionSubmissionId: startResult.contributionSubmissionId,
      currentProposal: {
        bodyPreview:
          "Objective: students will distinguish courage from presumption.",
        knowledgeType: "lesson",
        proposalConfidence: "medium",
        title: "Courage in Joshua",
      },
      smartStorageRunId: startResult.smartStorageRunId,
      sourceId: startResult.sourceId,
      status: "drafted",
    });
    expect(result.sourceIds).toEqual(startResult.sourceIds);
    expect(result.sourceCitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          citationKind: "textExcerpt",
          excerptText:
            "Objective: students will distinguish courage from presumption.",
          sourceId: startResult.sourceId,
        }),
        expect.objectContaining({
          citationKind: "externalUrl",
          externalUrl: "https://example.com/courage",
        }),
      ]),
    );

    const rowState = await t.run(async (ctx) => {
      const proposal = await ctx.db.get(result.smartStorageProposalId);
      const citationRows = await ctx.db
        .query("proposalSourceCitations")
        .withIndex("by_proposalId", (q) =>
          q.eq("proposalId", result.smartStorageProposalId),
        )
        .collect();
      const run = await ctx.db.get(startResult.smartStorageRunId);
      const contributionSubmission = await ctx.db.get(
        startResult.contributionSubmissionId,
      );
      const contractVersion =
        proposal?.smartStorageContractVersionId === undefined
          ? null
          : await ctx.db.get(proposal.smartStorageContractVersionId);
      const typeBehaviorSnapshot =
        proposal?.typeBehaviorSnapshotId === undefined
          ? null
          : await ctx.db.get(proposal.typeBehaviorSnapshotId);

      return {
        citationRows,
        contractVersion,
        contributionSubmission,
        proposal,
        run,
        typeBehaviorSnapshot,
      };
    });

    expect(rowState.proposal).toEqual(
      expect.objectContaining({
        contributionSubmissionId: startResult.contributionSubmissionId,
        smartStorageContractVersionId:
          rowState.run?.smartStorageContractVersionId,
        contractSnapshotVersion: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
        contractSnapshotText: SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT,
        createdByUserId: userId,
        smartStorageRunId: startResult.smartStorageRunId,
        sourceId: startResult.sourceId,
        status: "drafted",
        typeBehaviorSnapshotId: rowState.run?.typeBehaviorSnapshotId,
        typeBehaviorSnapshotVersion: "mvp-type-behavior-v4",
        typeBehaviorSnapshotText:
          "Use the Type Behavior registry for identity, source citation, representation role, primary representation, Human Weight defaults, and Human Weight credit basis.",
      }),
    );
    expect(rowState.contractVersion?._id).toBe(
      rowState.run?.smartStorageContractVersionId,
    );
    expect(rowState.typeBehaviorSnapshot?._id).toBe(
      rowState.run?.typeBehaviorSnapshotId,
    );
    expect(rowState.citationRows).toHaveLength(2);
    expect(rowState.run).toEqual(
      expect.objectContaining({
        completedAt: expect.any(Number),
        rawModelOutput: expect.any(String),
        status: "succeeded",
      }),
    );
    expect(rowState.contributionSubmission).toEqual(
      expect.objectContaining({
        submissionStatus: "reviewReady",
      }),
    );
  });

  test("returns the existing drafted Proposal and citations when processing the same Run twice", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );

    const firstResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const secondResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );

    expect(secondResult.smartStorageProposalId).toBe(
      firstResult.smartStorageProposalId,
    );
    expect(secondResult.currentProposal).toEqual(firstResult.currentProposal);
    expect(secondResult.sourceCitations).toEqual(firstResult.sourceCitations);
    const proposalRows = await t.run(
      async (ctx) => await ctx.db.query("smartStorageProposals").collect(),
    );
    expect(proposalRows).toHaveLength(1);
  });

  test("summarizes a queued Session and then a primary-ready Proposal", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({
        externalUrls: [{ url: "https://example.com/courage" }],
      }),
    );

    const preparingSession = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );

    expect(preparingSession).toMatchObject({
      activeRun: {
        id: startResult.smartStorageRunId,
        status: "queued",
      },
      isComplete: false,
      latestRun: {
        id: startResult.smartStorageRunId,
        status: "queued",
      },
      proposalCountsByStatus: {
        total: 0,
      },
      sourceCounts: {
        externalUrl: 1,
        pastedText: 1,
        total: 2,
      },
      state: "preparingPrimaryProposal",
    });
    expect(preparingSession.primaryProposal).toBeUndefined();
    expect(preparingSession.pendingSecondaryProposals).toEqual([]);

    const proposalResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const primaryReadySession = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );

    expect(primaryReadySession).toMatchObject({
      isComplete: false,
      latestRun: {
        id: startResult.smartStorageRunId,
        status: "succeeded",
      },
      proposalCountsByStatus: {
        drafted: 1,
        total: 1,
      },
      state: "primaryReady",
    });
    expect(primaryReadySession.activeRun).toBeUndefined();
    expect(primaryReadySession.primaryProposal).toMatchObject({
      acceptReady: true,
      id: proposalResult.smartStorageProposalId,
      role: "primary",
      sourceIds: startResult.sourceIds,
      status: "drafted",
    });
    expect(primaryReadySession.primaryProposal?.sourceCitations).toHaveLength(2);
  });

  test("returns explicit role, dependency, and acceptability metadata in a Session summary", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );

    const { prerequisiteProposalId, secondaryProposalId } = await t.run(
      async (ctx) => {
        const now = Date.now() + 1;
        const prerequisiteProposal = {
          knowledgeType: "topic" as const,
          title: "Courage referent setup",
          bodyPreview: "Confirm the Courage topic before accepting the lesson.",
          contextTags: getJoshuaContextTags(),
          proposalConfidence: "medium" as const,
          rationale: "The primary lesson depends on the Courage topic.",
        };
        const secondaryProposal = getLegacyProposedEntry({
          bodyPreview: "A later secondary review item.",
          title: "Secondary Courage Notes",
        });
        const prerequisiteProposalId = await ctx.db.insert(
          "smartStorageProposals",
          {
            contributionSubmissionId: startResult.contributionSubmissionId,
            sourceId: startResult.sourceId,
            smartStorageRunId: startResult.smartStorageRunId,
            status: "drafted",
            proposalRole: "prerequisite",
            dependency: {
              requiredByProposalId: primaryResult.smartStorageProposalId,
              requirementKind: "referent",
              requirementKey: "topic:courage",
              label: "Courage topic",
            },
            originalProposal: prerequisiteProposal,
            currentProposal: prerequisiteProposal,
            createdByUserId: userId,
            createdAt: now,
            updatedAt: now,
          },
        );
        const secondaryProposalId = await ctx.db.insert(
          "smartStorageProposals",
          {
            contributionSubmissionId: startResult.contributionSubmissionId,
            sourceId: startResult.sourceId,
            smartStorageRunId: startResult.smartStorageRunId,
            status: "drafted",
            proposalRole: "secondary",
            originalProposal: secondaryProposal,
            currentProposal: secondaryProposal,
            createdByUserId: userId,
            createdAt: now + 1,
            updatedAt: now + 1,
          },
        );

        return { prerequisiteProposalId, secondaryProposalId };
      },
    );

    const session = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );

    expect(session).toMatchObject({
      primaryProposal: {
        acceptReady: false,
        acceptability: {
          blockedByProposalIds: [prerequisiteProposalId],
          reason: "prerequisitesPending",
          status: "blocked",
        },
        id: primaryResult.smartStorageProposalId,
        role: "primary",
      },
      prerequisiteProposals: [
        {
          acceptReady: true,
          acceptability: {
            blockedByProposalIds: [],
            status: "ready",
          },
          dependency: {
            label: "Courage topic",
            requiredByProposalId: primaryResult.smartStorageProposalId,
            requirementKey: "topic:courage",
            requirementKind: "referent",
          },
          id: prerequisiteProposalId,
          role: "prerequisite",
        },
      ],
      pendingSecondaryProposals: [
        {
          acceptReady: false,
          acceptability: {
            blockedByProposalIds: [primaryResult.smartStorageProposalId],
            reason: "primaryAnchorRequired",
            status: "blocked",
          },
          id: secondaryProposalId,
          role: "secondary",
        },
      ],
      state: "awaitingPrerequisites",
    });
  });

  test("rejects accepting secondary proposals before the primary anchor exists", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    await authed.mutation(api.smartStorage.generateDraftProposalForRun, {
      smartStorageRunId: startResult.smartStorageRunId,
    });
    const secondaryProposalId = await t.run(async (ctx) => {
      const now = Date.now() + 1;
      const secondaryProposal = getLegacyProposedEntry({
        bodyPreview: "A later secondary review item.",
        title: "Secondary Courage Notes",
      });

      return await ctx.db.insert("smartStorageProposals", {
        contributionSubmissionId: startResult.contributionSubmissionId,
        sourceId: startResult.sourceId,
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
        proposalRole: "secondary",
        originalProposal: secondaryProposal,
        currentProposal: secondaryProposal,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        smartStorageProposalId: secondaryProposalId,
      }),
    ).rejects.toThrow(
      "Primary anchor must exist before accepting this Smart Storage Proposal.",
    );

    const rowState = await t.run(async (ctx) => ({
      entries: await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_createdByUserId", (q) => q.eq("createdByUserId", userId))
        .collect(),
      proposal: await ctx.db.get(secondaryProposalId),
    }));
    expect(
      rowState.entries.filter((entry) => entry.title === "Secondary Courage Notes"),
    ).toEqual([]);
    expect(rowState.proposal).toEqual(
      expect.objectContaining({
        status: "drafted",
      }),
    );
  });

  test("allows accepting secondary proposals after the primary anchor exists", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: primaryResult.smartStorageProposalId,
    });
    const secondaryProposalId = await t.run(async (ctx) => {
      const now = Date.now() + 1;
      const secondaryProposal = getLegacyProposedEntry({
        bodyPreview: "A later secondary review item.",
        title: "Secondary Courage Notes",
      });

      return await ctx.db.insert("smartStorageProposals", {
        contributionSubmissionId: startResult.contributionSubmissionId,
        sourceId: startResult.sourceId,
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
        proposalRole: "secondary",
        originalProposal: secondaryProposal,
        currentProposal: secondaryProposal,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const acceptedSecondary = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: secondaryProposalId,
      },
    );

    expect(acceptedSecondary).toMatchObject({
      acceptanceStatus: "accepted",
      status: "accepted",
    });
    const rowState = await t.run(async (ctx) => ({
      contributionSubmission: await ctx.db.get(
        startResult.contributionSubmissionId,
      ),
      secondaryProposal: await ctx.db.get(secondaryProposalId),
    }));
    expect(rowState.contributionSubmission).toEqual(
      expect.objectContaining({
        submissionStatus: "accepted",
      }),
    );
    expect(rowState.secondaryProposal).toEqual(
      expect.objectContaining({
        status: "accepted",
      }),
    );
  });

  test("allows accepting a prerequisite before its blocked primary proposal", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const prerequisiteProposalId = await t.run(async (ctx) => {
      const now = Date.now() + 1;
      const prerequisiteProposal = {
        knowledgeType: "topic" as const,
        title: "Courage referent setup",
        bodyPreview: "Confirm the Courage topic before accepting the lesson.",
        contextTags: getJoshuaContextTags(),
        proposalConfidence: "medium" as const,
        rationale: "The primary lesson depends on the Courage topic.",
      };

      return await ctx.db.insert("smartStorageProposals", {
        contributionSubmissionId: startResult.contributionSubmissionId,
        sourceId: startResult.sourceId,
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
        proposalRole: "prerequisite",
        dependency: {
          requiredByProposalId: primaryResult.smartStorageProposalId,
          requirementKind: "referent",
          requirementKey: "topic:courage",
          label: "Courage topic",
        },
        originalProposal: prerequisiteProposal,
        currentProposal: prerequisiteProposal,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const acceptedPrerequisite = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: prerequisiteProposalId,
      },
    );
    expect(acceptedPrerequisite).toMatchObject({
      acceptanceStatus: "accepted",
      status: "accepted",
    });

    const session = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );
    expect(session).toMatchObject({
      primaryProposal: {
        acceptReady: true,
        acceptability: {
          blockedByProposalIds: [],
          status: "ready",
        },
        id: primaryResult.smartStorageProposalId,
        role: "primary",
      },
      prerequisiteProposals: [],
      state: "primaryReady",
    });

    const acceptedPrimary = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      },
    );
    expect(acceptedPrimary).toMatchObject({
      acceptanceStatus: "accepted",
      status: "accepted",
    });
  });

  test("confirms an existing Known Referent match without creating a Knowledge Entry", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-reference-match` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const mercyTag = {
      canonicalKey: "mercy",
      href: "/goto/mercy",
      id: "mercy",
      knowledgeType: "topic" as const,
      label: "Mercy",
    };

    const { referenceProposalId, mercyTagId } = await t.run(async (ctx) => {
      const [seededMercy] = await seedKnownContextTagsForTest(ctx, userId, [
        mercyTag,
      ]);
      if (seededMercy === undefined) {
        throw new Error("Missing seeded Mercy Tag.");
      }
      const primaryProposal = await ctx.db.get(
        primaryResult.smartStorageProposalId,
      );
      if (!primaryProposal) {
        throw new Error("Missing primary proposal.");
      }
      await ctx.db.patch(primaryProposal._id, {
        currentProposal: {
          ...primaryProposal.currentProposal,
          contextTags: [mercyTag],
        },
      });
      const now = Date.now() + 1;
      const referenceProposal = {
        knowledgeType: "topic" as const,
        title: "Mercy",
        bodyPreview: "Confirm the existing Mercy topic before accepting the lesson.",
        contextTags: [],
        proposalConfidence: "high" as const,
        rationale: "The primary lesson references a known topic.",
      };
      const referenceProposalId = await ctx.db.insert(
        "smartStorageProposals",
        {
          contributionSubmissionId: startResult.contributionSubmissionId,
          sourceId: startResult.sourceId,
          smartStorageRunId: startResult.smartStorageRunId,
          status: "drafted",
          proposalRole: "referenceResolution",
          dependency: {
            requiredByProposalId: primaryResult.smartStorageProposalId,
            requirementKind: "referent",
            requirementKey: "topic:mercy",
            label: "Mercy topic",
          },
          referenceResolution: {
            candidateTagId: seededMercy.tagId,
            outcome: "pending",
            requiredByProposalId: primaryResult.smartStorageProposalId,
            requiredTag: mercyTag,
          },
          originalProposal: referenceProposal,
          currentProposal: referenceProposal,
          createdByUserId: userId,
          createdAt: now,
          updatedAt: now,
        },
      );

      return {
        mercyTagId: seededMercy.tagId,
        referenceProposalId,
      };
    });

    const blockedSession = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );
    expect(blockedSession).toMatchObject({
      primaryProposal: {
        acceptability: {
          blockedByProposalIds: [referenceProposalId],
          reason: "prerequisitesPending",
          status: "blocked",
        },
      },
      prerequisiteProposals: [
        {
          referenceResolution: {
            candidateTagId: mercyTagId,
            mode: "knownReferentMatch",
            outcome: "pending",
            requiredTag: expect.objectContaining({
              label: "Mercy",
            }),
          },
          role: "referenceResolution",
        },
      ],
      state: "awaitingPrerequisites",
    });

    const confirmed = await authed.mutation(
      api.smartStorage.confirmKnownReferentForReferenceResolution,
      {
        smartStorageProposalId: referenceProposalId,
        tagId: mercyTagId,
      },
    );

    expect(confirmed).toMatchObject({
      referenceResolution: {
        candidateTagId: mercyTagId,
        mode: "knownReferentMatch",
        outcome: "matchedKnownReferent",
        resolvedTagId: mercyTagId,
      },
      resolvedTag: {
        label: "Mercy",
      },
      status: "accepted",
      updatedProposalIds: [primaryResult.smartStorageProposalId],
    });

    const rowState = await t.run(async (ctx) => ({
      mercyEntries: await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_knowledgeType", (q) => q.eq("knowledgeType", "topic"))
        .collect(),
      primaryProposal: await ctx.db.get(primaryResult.smartStorageProposalId),
      referenceProposal: await ctx.db.get(referenceProposalId),
    }));
    expect(rowState.mercyEntries.filter((entry) => entry.title === "Mercy")).toEqual(
      [],
    );
    expect(rowState.referenceProposal).toEqual(
      expect.objectContaining({
        referenceResolution: expect.objectContaining({
          outcome: "matchedKnownReferent",
          resolvedTagId: mercyTagId,
        }),
        status: "accepted",
      }),
    );
    expect(rowState.primaryProposal?.currentProposal.contextTags).toEqual([
      expect.objectContaining({
        canonicalKey: "mercy",
        label: "Mercy",
      }),
    ]);

    const readySession = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );
    expect(readySession).toMatchObject({
      primaryProposal: {
        acceptReady: true,
        acceptability: {
          blockedByProposalIds: [],
          status: "ready",
        },
      },
      prerequisiteProposals: [],
      state: "primaryReady",
    });
  });

  test("keeps post-primary reference-resolution Review Slots pending and updates the accepted entry", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-post-primary-reference` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const acceptedPrimary = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      },
    );
    const mercyTag = {
      canonicalKey: "mercy-after-primary",
      href: "/goto/mercy-after-primary",
      id: "mercy-after-primary",
      knowledgeType: "topic" as const,
      label: "Mercy after Primary",
    };

    const { mercyTagId, referenceProposalId } = await t.run(async (ctx) => {
      const [seededMercy] = await seedKnownContextTagsForTest(ctx, userId, [
        mercyTag,
      ]);
      if (seededMercy === undefined) {
        throw new Error("Missing seeded Mercy Tag.");
      }
      const now = Date.now() + 1;
      const referenceProposal = {
        knowledgeType: "topic" as const,
        title: "Mercy after Primary",
        bodyPreview: "Confirm a topic reference after the primary entry is saved.",
        contextTags: [],
        proposalConfidence: "high" as const,
        rationale: "The accepted primary entry should reference this known topic.",
      };
      const referenceProposalId = await ctx.db.insert(
        "smartStorageProposals",
        {
          contributionSubmissionId: startResult.contributionSubmissionId,
          sourceId: startResult.sourceId,
          smartStorageRunId: startResult.smartStorageRunId,
          status: "drafted",
          proposalRole: "referenceResolution",
          dependency: {
            requiredByProposalId: primaryResult.smartStorageProposalId,
            requirementKind: "referent",
            requirementKey: "topic:mercy-after-primary",
            label: "Mercy after Primary",
          },
          referenceResolution: {
            candidateTagId: seededMercy.tagId,
            outcome: "pending",
            requiredByProposalId: primaryResult.smartStorageProposalId,
            requiredTag: mercyTag,
          },
          originalProposal: referenceProposal,
          currentProposal: referenceProposal,
          createdByUserId: userId,
          createdAt: now,
          updatedAt: now,
        },
      );

      return {
        mercyTagId: seededMercy.tagId,
        referenceProposalId,
      };
    });

    const session = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );
    expect(session).toMatchObject({
      acceptedPrimaryEntry: {
        id: acceptedPrimary.entryId,
      },
      pendingSecondaryProposals: [
        {
          acceptReady: true,
          referenceResolution: {
            candidateTagId: mercyTagId,
            mode: "knownReferentMatch",
          },
          role: "referenceResolution",
        },
      ],
      state: "reviewPending",
    });
    const reviewSlots = await authed.query(
      api.smartStorage.listReviewSlotsForCurrentUser,
      { limit: 20 },
    );
    expect(reviewSlots).toEqual([
      expect.objectContaining({
        group: expect.objectContaining({
          id: acceptedPrimary.entryId,
          kind: "primaryEntry",
        }),
        referenceResolution: expect.objectContaining({
          candidateTagId: mercyTagId,
          mode: "knownReferentMatch",
        }),
        role: "referenceResolution",
        smartStorageProposalId: referenceProposalId,
      }),
    ]);

    await authed.mutation(
      api.smartStorage.confirmKnownReferentForReferenceResolution,
      {
        smartStorageProposalId: referenceProposalId,
        tagId: mercyTagId,
      },
    );

    const rowState = await t.run(async (ctx) => ({
      entryTags: acceptedPrimary.entryId
        ? await ctx.db
            .query("entryTags")
            .withIndex("by_entryId_and_tagId", (q) =>
              q.eq("entryId", acceptedPrimary.entryId!).eq("tagId", mercyTagId),
            )
            .collect()
        : [],
      referenceProposal: await ctx.db.get(referenceProposalId),
    }));
    expect(rowState.entryTags).toEqual([
      expect.objectContaining({
        tagId: mercyTagId,
        tagPurpose: "context",
      }),
    ]);
    expect(rowState.referenceProposal).toEqual(
      expect.objectContaining({
        referenceResolution: expect.objectContaining({
          outcome: "matchedKnownReferent",
          resolvedTagId: mercyTagId,
        }),
        status: "accepted",
      }),
    );
  });

  test("requires accepting a new entry proposal before a dependent unknown reference can be accepted", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-reference-entry` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const requiredPersonTag = {
      canonicalKey: "rev-thomas-walker",
      href: "/goto/rev-thomas-walker",
      id: "rev-thomas-walker",
      knowledgeType: "person" as const,
      label: "Rev. Thomas Walker",
    };
    const referenceProposalId = await t.run(async (ctx) => {
      const primaryProposal = await ctx.db.get(
        primaryResult.smartStorageProposalId,
      );
      if (!primaryProposal) {
        throw new Error("Missing primary proposal.");
      }
      await ctx.db.patch(primaryProposal._id, {
        currentProposal: {
          ...primaryProposal.currentProposal,
          contextTags: [requiredPersonTag],
        },
      });
      const now = Date.now() + 1;
      const referenceProposal = {
        knowledgeType: "person" as const,
        title: "Rev. Thomas Walker",
        bodyPreview: "Create the speaker entry so the lesson can reference him.",
        contextTags: getJoshuaContextTags(),
        proposalConfidence: "medium" as const,
        rationale: "The source references a speaker who is not yet known.",
      };

      return await ctx.db.insert("smartStorageProposals", {
        contributionSubmissionId: startResult.contributionSubmissionId,
        sourceId: startResult.sourceId,
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
        proposalRole: "referenceResolution",
        dependency: {
          requiredByProposalId: primaryResult.smartStorageProposalId,
          requirementKind: "referent",
          requirementKey: "person:rev-thomas-walker",
          label: "Rev. Thomas Walker",
        },
        referenceResolution: {
          outcome: "pending",
          requiredByProposalId: primaryResult.smartStorageProposalId,
          requiredTag: requiredPersonTag,
        },
        originalProposal: referenceProposal,
        currentProposal: referenceProposal,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      }),
    ).rejects.toThrow(
      "Required prerequisite proposals must be accepted before accepting the primary proposal.",
    );

    const acceptedReference = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: referenceProposalId,
      },
    );

    expect(acceptedReference).toMatchObject({
      acceptanceStatus: "accepted",
      status: "accepted",
    });

    const rowState = await t.run(async (ctx) => {
      const referenceProposal = await ctx.db.get(referenceProposalId);
      const primaryProposal = await ctx.db.get(
        primaryResult.smartStorageProposalId,
      );
      const createdPersonEntry = acceptedReference.entryId
        ? await ctx.db.get(acceptedReference.entryId)
        : null;

      return {
        createdPersonEntry,
        primaryProposal,
        referenceProposal,
      };
    });
    expect(rowState.createdPersonEntry).toEqual(
      expect.objectContaining({
        knowledgeType: "person",
        title: "Rev. Thomas Walker",
      }),
    );
    expect(rowState.referenceProposal).toEqual(
      expect.objectContaining({
        referenceResolution: expect.objectContaining({
          outcome: "createdByAcceptedEntry",
          resolvedEntryId: acceptedReference.entryId,
        }),
        status: "accepted",
      }),
    );
    expect(rowState.primaryProposal?.currentProposal.contextTags).toEqual([
      expect.objectContaining({
        label: "Rev. Thomas Walker",
        knowledgeType: "person",
      }),
    ]);

    const acceptedPrimary = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      },
    );
    expect(acceptedPrimary).toMatchObject({
      acceptanceStatus: "accepted",
      status: "accepted",
    });
  });

  test("refuses to create bare Referents for unresolved context Tags during acceptance", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-reference-block` });
    const unknownTopic = {
      canonicalKey: "unseeded-discernment",
      href: "/goto/unseeded-discernment",
      id: "unseeded-discernment",
      knowledgeType: "topic" as const,
      label: "Unseeded Discernment",
    };
    const proposalResult = await createDraftProposal(
      authed,
      getLessonSmartStorageInput({
        contextTags: [unknownTopic],
        title: "Discernment in Joshua",
      }),
    );

    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        smartStorageProposalId: proposalResult.smartStorageProposalId,
      }),
    ).rejects.toThrow("Smart Storage cannot create bare Known Referents");

    const rowState = await t.run(async (ctx) => ({
      unknownReferent: await ctx.db
        .query("referents")
        .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
          q.eq("knowledgeType", "topic").eq("canonicalKey", "unseeded-discernment"),
        )
        .first(),
      unknownTag: await ctx.db
        .query("tags")
        .withIndex("by_knowledgeType_and_lookupKey", (q) =>
          q.eq("knowledgeType", "topic").eq("lookupKey", "unseeded-discernment"),
        )
        .first(),
    }));
    expect(rowState.unknownReferent).toBeNull();
    expect(rowState.unknownTag).toBeNull();
  });

  test.each([
    {
      configureModelRun: () => {
        vi.stubEnv("OPENAI_API_KEY", "");
        vi.stubGlobal("fetch", vi.fn());
      },
      runStatus: "failed",
    },
    {
      configureModelRun: () => {
        vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
        vi.stubGlobal(
          "fetch",
          vi.fn(async () =>
            new Response(JSON.stringify({ output: [] }), { status: 200 }),
          ),
        );
      },
      runStatus: "noProposal",
    },
  ] as const)(
    "keeps $runStatus model outcomes reviewable in the Session summary",
    async ({ configureModelRun, runStatus }) => {
      configureModelRun();
      const t = convexTest({ schema, modules });
      const userId = await t.run(insertAllowedUser);
      const authed = t.withIdentity({ subject: `${userId}|test-session` });
      const startResult = await authed.mutation(
        api.smartStorage.startFromContribution,
        getLessonSmartStorageInput(),
      );

      await authed.action(api.smartStorage.executeModelRun, {
        smartStorageRunId: startResult.smartStorageRunId,
      });

      const session = await querySessionSummary(
        authed,
        startResult.contributionSubmissionId,
      );
      expect(session).toMatchObject({
        isComplete: false,
        latestRun: {
          status: runStatus,
        },
        proposalCountsByStatus: {
          total: 0,
        },
        sourceCounts: {
          total: 1,
        },
        state: "primaryReady",
      });
      expect(session.primaryProposal).toBeUndefined();
    },
  );

  test("derives awaitingPrerequisites when the primary Proposal needs resolution", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    await t.run((ctx) =>
      insertRepresentedLessonEntryForTest(ctx, {
        canonicalUserId: userId,
        createdByUserId: userId,
        title: "Courage in Joshua",
      }),
    );
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const proposalResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );

    const targetExists = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: proposalResult.smartStorageProposalId,
      },
    );

    expect(targetExists).toMatchObject({
      acceptanceStatus: "targetExists",
      status: "needsResolution",
    });
    const session = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );
    expect(session).toMatchObject({
      isComplete: false,
      primaryProposal: {
        acceptReady: false,
        id: proposalResult.smartStorageProposalId,
        role: "primary",
        status: "needsResolution",
      },
      proposalCountsByStatus: {
        needsResolution: 1,
        total: 1,
      },
      state: "awaitingPrerequisites",
    });
    expect(session.acceptedPrimaryEntry).toBeUndefined();
  });

  test("derives primarySaved and reviewPending from an accepted primary anchor", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const proposalResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );

    const accepted = await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: proposalResult.smartStorageProposalId,
    });
    const savedSession = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );

    expect(savedSession).toMatchObject({
      acceptedPrimaryEntry: {
        id: accepted.entryId,
        title: "Courage in Joshua",
      },
      isComplete: true,
      primaryProposal: {
        acceptReady: false,
        id: proposalResult.smartStorageProposalId,
        role: "primary",
        status: "accepted",
      },
      state: "primarySaved",
    });

    const secondaryProposalId = await t.run(async (ctx) => {
      const now = Date.now() + 1;
      const secondaryProposal = getLegacyProposedEntry({
        bodyPreview: "A later secondary review item.",
        title: "Secondary Courage Notes",
      });

      return await ctx.db.insert("smartStorageProposals", {
        contributionSubmissionId: startResult.contributionSubmissionId,
        sourceId: startResult.sourceId,
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
        originalProposal: secondaryProposal,
        currentProposal: secondaryProposal,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const reviewPendingSession = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );
    expect(reviewPendingSession).toMatchObject({
      isComplete: false,
      pendingSecondaryProposals: [
        {
          acceptReady: true,
          id: secondaryProposalId,
          role: "secondary",
          status: "drafted",
        },
      ],
      proposalCountsByStatus: {
        accepted: 1,
        drafted: 1,
        total: 2,
      },
      state: "reviewPending",
    });
  });

  test("projects pending secondary proposals as Review Slots grouped under the accepted primary entry", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-review-slots` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const acceptedPrimary = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      },
    );
    const secondaryProposalId = await t.run(async (ctx) => {
      const now = Date.now() + 1;
      const secondaryProposal = getLegacyProposedEntry({
        bodyPreview: "A later secondary review item.",
        title: "Secondary Courage Notes",
      });

      return await ctx.db.insert("smartStorageProposals", {
        contributionSubmissionId: startResult.contributionSubmissionId,
        sourceId: startResult.sourceId,
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
        proposalRole: "secondary",
        originalProposal: secondaryProposal,
        currentProposal: secondaryProposal,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const reviewSlots = await authed.query(
      api.smartStorage.listReviewSlotsForCurrentUser,
      {
        limit: 20,
      },
    );

    expect(reviewSlots).toEqual([
      expect.objectContaining({
        acceptReady: true,
        contributionSubmissionId: startResult.contributionSubmissionId,
        id: `review-slot:${secondaryProposalId}`,
        proposedKnowledgeType: "lesson",
        reviewScopeLabel: "Private review",
        role: "secondary",
        smartStorageProposalId: secondaryProposalId,
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
        title: "Secondary Courage Notes",
      }),
    ]);
    expect(reviewSlots[0].group).toEqual({
      href: `/entries/${acceptedPrimary.entryId}`,
      id: acceptedPrimary.entryId,
      kind: "primaryEntry",
      title: "Courage in Joshua",
    });
    expect(reviewSlots[0].originSession).toEqual({
      href: `/smart-storage/${startResult.contributionSubmissionId}`,
      id: startResult.contributionSubmissionId,
      title: "Courage in Joshua",
    });
  });

  test("assigns a Review Slot to a reviewer without exposing sibling proposals or private primary entries", async () => {
    const t = convexTest({ schema, modules });
    const ownerUserId = await t.run(insertAllowedUser);
    const reviewerUserId = await t.run(
      async (ctx) => await insertAllowedUser(ctx, "reviewer"),
    );
    const unrelatedUserId = await t.run(
      async (ctx) => await insertAllowedUser(ctx, "unrelated"),
    );
    const owner = t.withIdentity({ subject: `${ownerUserId}|owner` });
    const reviewer = t.withIdentity({ subject: `${reviewerUserId}|reviewer` });
    const unrelated = t.withIdentity({
      subject: `${unrelatedUserId}|unrelated`,
    });
    const startResult = await owner.mutation(
      api.smartStorage.startFromContribution,
      {
        ...getLessonSmartStorageInput(),
        externalUrls: [{ url: "https://example.com/extra-source" }],
        intendedVisibilityKind: "private",
        intendedVisibilityTargetKey: `user:${ownerUserId}`,
      },
    );
    const primaryResult = await owner.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    await owner.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: primaryResult.smartStorageProposalId,
    });
    const { assignedProposalId, siblingProposalId, uncitedSourceId } = await t.run(
      async (ctx) => {
        const now = Date.now() + 1;
        const assignedProposal = getLegacyProposedEntry({
          bodyPreview: "Assigned reviewer-only Source excerpt.",
          title: "Assigned Review Lesson",
        });
        const siblingProposal = getLegacyProposedEntry({
          bodyPreview: "A sibling proposal from the same run.",
          title: "Sibling Review Lesson",
        });
        const assignedProposalId = await ctx.db.insert("smartStorageProposals", {
          contributionSubmissionId: startResult.contributionSubmissionId,
          sourceId: startResult.sourceId,
          smartStorageRunId: startResult.smartStorageRunId,
          status: "drafted",
          proposalRole: "secondary",
          originalProposal: assignedProposal,
          currentProposal: assignedProposal,
          createdByUserId: ownerUserId,
          createdAt: now,
          updatedAt: now,
        });
        const siblingProposalId = await ctx.db.insert("smartStorageProposals", {
          contributionSubmissionId: startResult.contributionSubmissionId,
          sourceId: startResult.sourceId,
          smartStorageRunId: startResult.smartStorageRunId,
          status: "drafted",
          proposalRole: "secondary",
          originalProposal: siblingProposal,
          currentProposal: siblingProposal,
          createdByUserId: ownerUserId,
          createdAt: now + 1,
          updatedAt: now + 1,
        });
        const uncitedSource = await getExternalUrlSource(
          ctx,
          startResult.contributionSubmissionId,
        );

        return {
          assignedProposalId,
          siblingProposalId,
          uncitedSourceId: uncitedSource._id,
        };
      },
    );

    const assignment = await owner.mutation(api.smartStorage.assignReviewSlot, {
      smartStorageProposalId: assignedProposalId,
      targetKind: "user",
      targetUserId: reviewerUserId,
    });

    expect(assignment).toEqual(
      expect.objectContaining({
        assignment: expect.objectContaining({
          assignedByUserId: ownerUserId,
          targetKind: "user",
          targetUserId: reviewerUserId,
        }),
        smartStorageProposalId: assignedProposalId,
        status: "assigned",
      }),
    );
    const reviewerSlots = await reviewer.query(
      api.smartStorage.listReviewSlotsForCurrentUser,
      { limit: 20 },
    );
    expect(reviewerSlots).toEqual([
      expect.objectContaining({
        assignment: expect.objectContaining({
          targetKind: "user",
          targetUserId: reviewerUserId,
        }),
        canAssign: false,
        group: expect.objectContaining({
          kind: "session",
          title: "Courage in Joshua",
        }),
        smartStorageProposalId: assignedProposalId,
        title: "Assigned Review Lesson",
      }),
    ]);
    expect(JSON.stringify(reviewerSlots)).not.toContain("Sibling Review Lesson");

    const delegatedSession = await reviewer.query(
      api.smartStorage.getSessionSummary,
      {
        contributionSubmissionId: startResult.contributionSubmissionId,
        smartStorageProposalId: assignedProposalId,
      },
    );
    expect(delegatedSession).not.toBeNull();
    if (delegatedSession === null) {
      throw new Error("Expected delegated Smart Storage Session summary.");
    }
    expect(delegatedSession.canCancel).toBe(false);
    expect(delegatedSession.acceptedPrimaryEntry).toBeUndefined();
    expect(delegatedSession.primaryProposal).toBeUndefined();
    expect(delegatedSession.pendingSecondaryProposals).toEqual([
      expect.objectContaining({
        currentProposal: expect.objectContaining({
          title: "Assigned Review Lesson",
        }),
        id: assignedProposalId,
      }),
    ]);
    expect(delegatedSession.proposalCountsByStatus).toEqual(
      expect.objectContaining({
        drafted: 1,
        total: 1,
      }),
    );
    expect(JSON.stringify(delegatedSession)).not.toContain("Sibling Review Lesson");
    expect(JSON.stringify(delegatedSession)).not.toContain(
      primaryResult.smartStorageProposalId,
    );
    await expect(
      reviewer.query(api.smartStorage.getSessionSummary, {
        contributionSubmissionId: startResult.contributionSubmissionId,
        smartStorageProposalId: siblingProposalId,
      }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      unrelated.query(api.smartStorage.getSessionSummary, {
        contributionSubmissionId: startResult.contributionSubmissionId,
        smartStorageProposalId: assignedProposalId,
      }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      reviewer.mutation(api.smartStorage.acceptScaffoldProposal, {
        selectedSourceIds: [uncitedSourceId],
        smartStorageProposalId: assignedProposalId,
      }),
    ).rejects.toThrow("Selected Source is not cited by this Proposal.");
    await expect(
      reviewer.mutation(api.smartStorage.acceptScaffoldProposal, {
        smartStorageProposalId: siblingProposalId,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  test("blocks unauthorized Review Slot assignment and keeps proposal gates for assigned reviewers", async () => {
    const t = convexTest({ schema, modules });
    const ownerUserId = await t.run(insertAllowedUser);
    const reviewerUserId = await t.run(
      async (ctx) => await insertAllowedUser(ctx, "reviewer"),
    );
    const unrelatedUserId = await t.run(
      async (ctx) => await insertAllowedUser(ctx, "unrelated"),
    );
    const owner = t.withIdentity({ subject: `${ownerUserId}|owner` });
    const reviewer = t.withIdentity({ subject: `${reviewerUserId}|reviewer` });
    const unrelated = t.withIdentity({
      subject: `${unrelatedUserId}|unrelated`,
    });
    const startResult = await owner.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    await owner.mutation(api.smartStorage.generateDraftProposalForRun, {
      smartStorageRunId: startResult.smartStorageRunId,
    });
    const secondaryProposalId = await t.run(async (ctx) => {
      const now = Date.now() + 1;
      const proposal = getLegacyProposedEntry({
        bodyPreview: "Assigned before primary acceptance.",
        title: "Blocked Secondary Lesson",
      });

      return await ctx.db.insert("smartStorageProposals", {
        contributionSubmissionId: startResult.contributionSubmissionId,
        sourceId: startResult.sourceId,
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
        proposalRole: "secondary",
        originalProposal: proposal,
        currentProposal: proposal,
        createdByUserId: ownerUserId,
        createdAt: now,
        updatedAt: now,
      });
    });

    await expect(
      unrelated.mutation(api.smartStorage.assignReviewSlot, {
        smartStorageProposalId: secondaryProposalId,
        targetKind: "user",
        targetUserId: reviewerUserId,
      }),
    ).rejects.toThrow("Unauthorized");
    await owner.mutation(api.smartStorage.assignReviewSlot, {
      smartStorageProposalId: secondaryProposalId,
      targetKind: "user",
      targetUserId: reviewerUserId,
    });
    await expect(
      reviewer.mutation(api.smartStorage.acceptScaffoldProposal, {
        smartStorageProposalId: secondaryProposalId,
      }),
    ).rejects.toThrow(
      "Primary anchor must exist before accepting this Smart Storage Proposal.",
    );
  });

  test("cancelling a session closes pending Review Slots without deleting Sources or accepted entries", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-review-cancel` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const acceptedPrimary = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      },
    );
    const secondaryProposalId = await t.run(async (ctx) => {
      const now = Date.now() + 1;
      const secondaryProposal = getLegacyProposedEntry({
        bodyPreview: "A later secondary review item.",
        title: "Secondary Courage Notes",
      });

      return await ctx.db.insert("smartStorageProposals", {
        contributionSubmissionId: startResult.contributionSubmissionId,
        sourceId: startResult.sourceId,
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
        proposalRole: "secondary",
        originalProposal: secondaryProposal,
        currentProposal: secondaryProposal,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      });
    });

    await expect(
      authed.query(api.smartStorage.listReviewSlotsForCurrentUser, {
        limit: 20,
      }),
    ).resolves.toHaveLength(1);

    const cancelled = await authed.mutation(api.smartStorage.cancelSession, {
      contributionSubmissionId: startResult.contributionSubmissionId,
    });

    expect(cancelled).toEqual({
      cancelledProposalCount: 1,
      contributionSubmissionId: startResult.contributionSubmissionId,
      status: "cancelled",
      supersededRunCount: 0,
    });
    await expect(
      authed.query(api.smartStorage.listReviewSlotsForCurrentUser, {
        limit: 20,
      }),
    ).resolves.toEqual([]);

    const rowState = await t.run(async (ctx) => ({
      acceptedEntry: await ctx.db.get(acceptedPrimary.entryId!),
      primaryProposal: await ctx.db.get(primaryResult.smartStorageProposalId),
      secondaryProposal: await ctx.db.get(secondaryProposalId),
      sources: await ctx.db
        .query("sources")
        .withIndex("by_contributionSubmissionId_and_submittedAt", (q) =>
          q.eq("contributionSubmissionId", startResult.contributionSubmissionId),
        )
        .collect(),
      submission: await ctx.db.get(startResult.contributionSubmissionId),
    }));

    expect(rowState.sources).toHaveLength(1);
    expect(rowState.acceptedEntry).toEqual(
      expect.objectContaining({
        title: "Courage in Joshua",
      }),
    );
    expect(rowState.primaryProposal).toEqual(
      expect.objectContaining({
        status: "accepted",
      }),
    );
    expect(rowState.secondaryProposal).toEqual(
      expect.objectContaining({
        status: "stale",
      }),
    );
    expect(rowState.submission).toEqual(
      expect.objectContaining({
        submissionStatus: "cancelled",
      }),
    );
  });

  test("projects stale older-contract proposals as Refresh Review Slots", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-refresh-stale` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(primaryResult.smartStorageProposalId, {
        contractSnapshotVersion: "legacy-contract-v1",
        status: "stale",
        updatedAt: Date.now(),
      });
    });

    const reviewSlots = await authed.query(
      api.smartStorage.listReviewSlotsForCurrentUser,
      { limit: 20 },
    );

    expect(reviewSlots).toEqual([
      expect.objectContaining({
        acceptReady: false,
        acceptability: expect.objectContaining({
          status: "closed",
        }),
        refresh: expect.objectContaining({
          origin: "contractRefresh",
          originLabel: "Refresh",
          reason: expect.stringContaining("older Smart Storage Contract"),
          sourceProposalId: primaryResult.smartStorageProposalId,
          suggestionKind: "staleProposalRefresh",
          targetContractSnapshotVersion: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
        }),
        smartStorageProposalId: primaryResult.smartStorageProposalId,
        status: "stale",
      }),
    ]);
  });

  test("requesting refresh creates superseding Silver work without rewriting accepted Gold entries", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-refresh-request` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const acceptedPrimary = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      },
    );
    const beforeEntry = await t.run(async (ctx) =>
      ctx.db.get(acceptedPrimary.entryId!),
    );

    const refreshRequest = await authed.mutation(
      api.smartStorage.requestRefreshForProposal,
      {
        reason: "The contract now asks for a clearer source-backed rationale.",
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      },
    );

    expect(refreshRequest).toEqual(
      expect.objectContaining({
        role: "refresh",
        sourceProposalId: primaryResult.smartStorageProposalId,
        status: "created",
      }),
    );
    const rowState = await t.run(async (ctx) => ({
      acceptedEntry: await ctx.db.get(acceptedPrimary.entryId!),
      refreshProposal: await ctx.db.get(refreshRequest.smartStorageProposalId!),
      sourceProposal: await ctx.db.get(primaryResult.smartStorageProposalId),
    }));
    expect(rowState.acceptedEntry).toEqual(beforeEntry);
    expect(rowState.sourceProposal).toEqual(
      expect.objectContaining({
        status: "accepted",
      }),
    );
    expect(rowState.refreshProposal).toEqual(
      expect.objectContaining({
        proposalRole: "refresh",
        refresh: expect.objectContaining({
          origin: "contractRefresh",
          reason: "The contract now asks for a clearer source-backed rationale.",
          sourceProposalId: primaryResult.smartStorageProposalId,
        }),
        status: "drafted",
        supersedesProposalId: primaryResult.smartStorageProposalId,
      }),
    );

    const reviewSlots = await authed.query(
      api.smartStorage.listReviewSlotsForCurrentUser,
      { limit: 20 },
    );
    expect(reviewSlots).toEqual([
      expect.objectContaining({
        refresh: expect.objectContaining({
          originLabel: "Refresh",
        }),
        role: "refresh",
        smartStorageProposalId: refreshRequest.smartStorageProposalId,
      }),
    ]);
  });

  test("creates reprocessing Review Slots for edits, Type Reclassification, derived entries, and reference resolution", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-reprocessing-kinds` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: primaryResult.smartStorageProposalId,
    });

    const edit = await authed.mutation(api.smartStorage.requestRefreshForProposal, {
      mode: "reprocessing",
      smartStorageProposalId: primaryResult.smartStorageProposalId,
      suggestionKind: "suggestedEdit",
    });
    const reclassification = await authed.mutation(
      api.smartStorage.requestRefreshForProposal,
      {
        mode: "reprocessing",
        smartStorageProposalId: primaryResult.smartStorageProposalId,
        suggestionKind: "typeReclassification",
        targetKnowledgeType: "sermon",
      },
    );
    const derived = await authed.mutation(api.smartStorage.requestRefreshForProposal, {
      mode: "reprocessing",
      smartStorageProposalId: primaryResult.smartStorageProposalId,
      suggestionKind: "newDerivedEntry",
    });
    const reference = await authed.mutation(
      api.smartStorage.requestRefreshForProposal,
      {
        mode: "reprocessing",
        requiredTag: {
          canonicalKey: "mercy",
          href: "/goto/mercy",
          id: "mercy",
          knowledgeType: "topic",
          label: "Mercy",
        },
        smartStorageProposalId: primaryResult.smartStorageProposalId,
        suggestionKind: "referenceResolution",
      },
    );

    const reviewSlots = await authed.query(
      api.smartStorage.listReviewSlotsForCurrentUser,
      { limit: 20 },
    );
    expect(reviewSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          refresh: expect.objectContaining({
            originLabel: "Reprocessing",
            suggestionKind: "suggestedEdit",
          }),
          role: "reprocessing",
          smartStorageProposalId: edit.smartStorageProposalId,
        }),
        expect.objectContaining({
          proposedKnowledgeType: "sermon",
          refresh: expect.objectContaining({
            suggestionKind: "typeReclassification",
          }),
          role: "reprocessing",
          smartStorageProposalId: reclassification.smartStorageProposalId,
        }),
        expect.objectContaining({
          refresh: expect.objectContaining({
            suggestionKind: "newDerivedEntry",
          }),
          role: "reprocessing",
          smartStorageProposalId: derived.smartStorageProposalId,
        }),
        expect.objectContaining({
          referenceResolution: expect.objectContaining({
            mode: "newEntryProposal",
            requiredTag: expect.objectContaining({
              label: "Mercy",
            }),
          }),
          refresh: expect.objectContaining({
            suggestionKind: "referenceResolution",
          }),
          role: "referenceResolution",
          smartStorageProposalId: reference.smartStorageProposalId,
        }),
      ]),
    );
  });

  test("dismisses refresh suggestions for the same candidate, version, and review scope", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-refresh-dismiss` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(primaryResult.smartStorageProposalId, {
        contractSnapshotVersion: "legacy-contract-v1",
        status: "stale",
        updatedAt: Date.now(),
      });
    });
    await expect(
      authed.query(api.smartStorage.listReviewSlotsForCurrentUser, {
        limit: 20,
      }),
    ).resolves.toHaveLength(1);

    const dismissed = await authed.mutation(
      api.smartStorage.dismissRefreshSuggestion,
      {
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      },
    );
    expect(dismissed).toEqual({
      smartStorageProposalId: primaryResult.smartStorageProposalId,
      status: "dismissed",
    });
    await expect(
      authed.query(api.smartStorage.listReviewSlotsForCurrentUser, {
        limit: 20,
      }),
    ).resolves.toEqual([]);

    const duplicate = await authed.mutation(
      api.smartStorage.requestRefreshForProposal,
      {
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      },
    );
    expect(duplicate).toEqual(
      expect.objectContaining({
        sourceProposalId: primaryResult.smartStorageProposalId,
        status: "dismissed",
      }),
    );
    const rowState = await t.run(async (ctx) => ({
      dismissals: await ctx.db
        .query("smartStorageRefreshDismissals")
        .withIndex("by_sourceProposalId_and_createdAt", (q) =>
          q.eq("sourceProposalId", primaryResult.smartStorageProposalId),
        )
        .collect(),
      proposals: await ctx.db
        .query("smartStorageProposals")
        .withIndex("by_smartStorageRunId", (q) =>
          q.eq("smartStorageRunId", startResult.smartStorageRunId),
        )
        .collect(),
    }));
    expect(rowState.dismissals).toHaveLength(1);
    expect(rowState.proposals).toHaveLength(1);
  });

  test("records accepted reprocessing provenance outside hot Knowledge Entry records", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-refresh-provenance` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const acceptedPrimary = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: primaryResult.smartStorageProposalId,
      },
    );
    const refreshRequest = await authed.mutation(
      api.smartStorage.requestRefreshForProposal,
      {
        mode: "reprocessing",
        reason: "Reprocessing suggests adding source-backed representations.",
        smartStorageProposalId: primaryResult.smartStorageProposalId,
        suggestionKind: "suggestedEdit",
      },
    );
    const targetExists = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: refreshRequest.smartStorageProposalId!,
      },
    );
    expect(targetExists).toMatchObject({
      acceptanceStatus: "targetExists",
      existingEntryId: acceptedPrimary.entryId,
    });

    await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: refreshRequest.smartStorageProposalId!,
      targetExistingEntryId: acceptedPrimary.entryId,
    });

    const rowState = await t.run(async (ctx) => ({
      entry: await ctx.db.get(acceptedPrimary.entryId!),
      provenance: await ctx.db
        .query("smartStorageUpgradeProvenanceRecords")
        .withIndex("by_acceptedProposalId", (q) =>
          q.eq("acceptedProposalId", refreshRequest.smartStorageProposalId!),
        )
        .unique(),
    }));
    expect(rowState.entry).toEqual(
      expect.not.objectContaining({
        upgradeProvenance: expect.anything(),
      }),
    );
    expect(rowState.provenance).toEqual(
      expect.objectContaining({
        acceptedProposalId: refreshRequest.smartStorageProposalId,
        origin: "reprocessing",
        sourceProposalId: primaryResult.smartStorageProposalId,
        suggestionKind: "suggestedEdit",
        targetEntryId: acceptedPrimary.entryId,
      }),
    );
  });

  test("keeps assigned reprocessing Review Slots inside delegated review boundaries", async () => {
    const t = convexTest({ schema, modules });
    const ownerUserId = await t.run(insertAllowedUser);
    const reviewerUserId = await t.run(
      async (ctx) => await insertAllowedUser(ctx, "reviewer"),
    );
    const unrelatedUserId = await t.run(
      async (ctx) => await insertAllowedUser(ctx, "unrelated"),
    );
    const owner = t.withIdentity({ subject: `${ownerUserId}|owner` });
    const reviewer = t.withIdentity({ subject: `${reviewerUserId}|reviewer` });
    const unrelated = t.withIdentity({
      subject: `${unrelatedUserId}|unrelated`,
    });
    const startResult = await owner.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const primaryResult = await owner.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    await owner.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: primaryResult.smartStorageProposalId,
    });
    const refreshRequest = await owner.mutation(
      api.smartStorage.requestRefreshForProposal,
      {
        mode: "reprocessing",
        smartStorageProposalId: primaryResult.smartStorageProposalId,
        suggestionKind: "newDerivedEntry",
      },
    );

    await owner.mutation(api.smartStorage.assignReviewSlot, {
      smartStorageProposalId: refreshRequest.smartStorageProposalId!,
      targetKind: "user",
      targetUserId: reviewerUserId,
    });

    const reviewerSlots = await reviewer.query(
      api.smartStorage.listReviewSlotsForCurrentUser,
      { limit: 20 },
    );
    expect(reviewerSlots).toEqual([
      expect.objectContaining({
        assignment: expect.objectContaining({
          targetUserId: reviewerUserId,
        }),
        canAssign: false,
        refresh: expect.objectContaining({
          originLabel: "Reprocessing",
          suggestionKind: "newDerivedEntry",
        }),
        smartStorageProposalId: refreshRequest.smartStorageProposalId,
      }),
    ]);
    await expect(
      unrelated.mutation(api.smartStorage.dismissRefreshSuggestion, {
        smartStorageProposalId: refreshRequest.smartStorageProposalId!,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  test("derives complete, cancelled, and source-preservation edge states", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    const preservingSubmissionId = await t.run(async (ctx) => {
      const contributionSubmissionId = await insertContributionSubmissionForTest(
        ctx,
        userId,
        "Pending source preservation",
      );
      await ctx.db.patch(contributionSubmissionId, {
        submissionStatus: "processing",
      });
      return contributionSubmissionId;
    });
    await expectSessionState(authed, preservingSubmissionId, "preservingSources");

    const failedPreservationSubmissionId = await t.run((ctx) =>
      insertContributionSubmissionForTest(
        ctx,
        userId,
        "Failed source preservation",
      ),
    );
    await expectSessionState(
      authed,
      failedPreservationSubmissionId,
      "sourcePreservationFailed",
    );

    const cancelledSubmissionId = await t.run(async (ctx) => {
      const contributionSubmissionId = await insertContributionSubmissionForTest(
        ctx,
        userId,
        "Cancelled source preservation",
      );
      await ctx.db.patch(contributionSubmissionId, {
        submissionStatus: "cancelled",
      });
      return contributionSubmissionId;
    });
    await expectSessionState(authed, cancelledSubmissionId, "cancelled");

    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({ title: "Rejected Courage Proposal" }),
    );
    const proposalResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    await t.run(async (ctx) => {
      await ctx.db.patch(proposalResult.smartStorageProposalId, {
        status: "rejected",
      });
    });

    const completeSession = await querySessionSummary(
      authed,
      startResult.contributionSubmissionId,
    );
    expect(completeSession).toMatchObject({
      isComplete: true,
      proposalCountsByStatus: {
        rejected: 1,
        total: 1,
      },
      state: "complete",
    });
  });

  test("executes a model Run and creates a validated Proposal", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_SMART_STORAGE_MODEL", "gpt-test-smart-storage");
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const modelSourceText = [
      "Objective: students will distinguish courage from presumption.",
      "Guidance: use the second line to steer the proposal, not as student-facing text.",
    ].join("\n");
    const explicitContributionNote =
      "Prefer a concise proposal for teacher review.";
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({
        body: modelSourceText,
        contributionNote: explicitContributionNote,
      }),
    );
    const modelProposal = getModelProposedEntry({
      bodyPreview: "Model-shaped courage lesson preview.",
      rationale: "The submitted Source names a lesson and supplies enough text.",
      title: "Model Courage Lesson",
    });
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          id: "resp_smart_storage_test",
          output_text: JSON.stringify(modelProposal),
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await authed.action(api.smartStorage.executeModelRun, {
      smartStorageRunId: startResult.smartStorageRunId,
    });

    expect(result).toMatchObject({
      executionStatus: "proposalCreated",
      smartStorageProposalId: expect.any(String),
      smartStorageRunId: startResult.smartStorageRunId,
      status: "drafted",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    if (!firstCall) {
      throw new Error("Expected OpenAI fetch call.");
    }
    const [url, requestInit] = firstCall;
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(requestInit).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-openai-key",
          "Content-Type": "application/json",
        }),
      }),
    );
    const requestBody = JSON.parse(String(requestInit?.body));
    expect(requestBody).toMatchObject({
      max_output_tokens: 1_000,
      model: "gpt-test-smart-storage",
      reasoning: { effort: "low" },
      text: {
        format: {
          name: "smart_storage_proposal",
          strict: true,
          type: "json_schema",
        },
        verbosity: "low",
      },
    });
    expect(requestBody.input).toContain("Courage in Joshua");
    expect(requestBody.instructions).toContain("Authored Text Source");
    expect(requestBody.instructions).toContain(
      "Guidance-like text inside an Authored Text Source",
    );
    expect(requestBody.instructions).toContain(
      "Do not synthesize Contribution Notes from Source text",
    );
    const modelInput = JSON.parse(String(requestBody.input));
    expect(modelInput).toMatchObject({
      contributionSubmission: {
        contributionNote: explicitContributionNote,
      },
      run: {
        contractSnapshotText: SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT,
        contractSnapshotVersion: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
      },
      smartStorageContract: {
        contractKind: "contributionSubmissionToSmartStorageProposal",
        layerMapping: {
          bronze: expect.stringContaining("Sources"),
          gold: expect.stringContaining("Knowledge Entries"),
          silver: expect.stringContaining("Smart Storage Proposals"),
        },
        modelProviderStrategy: {
          currentAdapter: expect.stringContaining("OpenAI"),
          futureAdapter: expect.stringContaining("self-hosted"),
          localFirst: expect.stringContaining("deterministic"),
        },
        version: SMART_STORAGE_CONTRACT_SNAPSHOT_VERSION,
      },
      sourceInterpretationPolicy: {
        authoredTextSource: expect.stringContaining("Authored Text Source"),
        editorGuidance: expect.stringContaining("slim Contribution Editor"),
        storedContributionNote: expect.stringContaining(
          "Do not synthesize contributionSubmission.contributionNote",
        ),
      },
      sources: [
        expect.objectContaining({
          rawText: modelSourceText,
          sourceKind: "pastedText",
        }),
      ],
    });

    const rowState = await t.run(async (ctx) => {
      const run = await ctx.db.get(startResult.smartStorageRunId);
      const proposal =
        result.smartStorageProposalId === undefined
          ? null
          : await ctx.db.get(result.smartStorageProposalId);
      const sourceCitations =
        result.smartStorageProposalId === undefined
          ? []
          : await ctx.db
              .query("proposalSourceCitations")
              .withIndex("by_proposalId", (q) =>
                q.eq("proposalId", result.smartStorageProposalId!),
              )
              .collect();
      const contributionSubmission = await ctx.db.get(
        startResult.contributionSubmissionId,
      );

      return { contributionSubmission, proposal, run, sourceCitations };
    });
    expect(rowState.run).toEqual(
      expect.objectContaining({
        completedAt: expect.any(Number),
        rawModelRequest: expect.stringContaining("gpt-test-smart-storage"),
        rawModelOutput: expect.stringContaining("resp_smart_storage_test"),
        status: "succeeded",
      }),
    );
    expect(rowState.proposal).toEqual(
      expect.objectContaining({
        contributionSubmissionId: startResult.contributionSubmissionId,
        currentProposal: expect.objectContaining({
          bodyPreview: "Model-shaped courage lesson preview.",
          knowledgeType: "lesson",
          proposalConfidence: "high",
          title: "Model Courage Lesson",
        }),
        smartStorageContractVersionId:
          rowState.run?.smartStorageContractVersionId,
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
        typeBehaviorSnapshotId: rowState.run?.typeBehaviorSnapshotId,
      }),
    );
    expect(rowState.sourceCitations).toHaveLength(1);
    expect(rowState.contributionSubmission).toEqual(
      expect.objectContaining({
        submissionStatus: "reviewReady",
      }),
    );
  });

  test("parses model output before storing a bounded raw response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_SMART_STORAGE_MODEL", "gpt-test-smart-storage");
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const modelProposal = getModelProposedEntry({
      bodyPreview: "Long response still yields a proposal.",
      title: "Long Response Courage Lesson",
    });
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            id: "resp_smart_storage_long",
            output: [
              {
                type: "reasoning",
                content: [],
                summary: [],
              },
              {
                type: "message",
                status: "completed",
                role: "assistant",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify(modelProposal),
                  },
                ],
              },
            ],
            text: {
              format: {
                type: "json_schema",
                schema: {
                  description: "large echoed schema ".repeat(400),
                },
              },
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await authed.action(api.smartStorage.executeModelRun, {
      smartStorageRunId: startResult.smartStorageRunId,
    });

    expect(result).toMatchObject({
      executionStatus: "proposalCreated",
      status: "drafted",
    });
    const rowState = await t.run(async (ctx) => {
      const run = await ctx.db.get(startResult.smartStorageRunId);
      const proposal =
        result.smartStorageProposalId === undefined
          ? null
          : await ctx.db.get(result.smartStorageProposalId);

      return { proposal, run };
    });
    expect(rowState.run).toEqual(
      expect.objectContaining({
        rawModelRequest: expect.stringContaining("gpt-test-smart-storage"),
        rawModelOutput: expect.stringContaining("resp_smart_storage_long"),
        status: "succeeded",
      }),
    );
    expect(rowState.run?.rawModelRequest).not.toContain("Authorization");
    expect(rowState.run?.rawModelOutput?.length).toBeLessThanOrEqual(4_000);
    expect(rowState.proposal).toEqual(
      expect.objectContaining({
        currentProposal: expect.objectContaining({
          bodyPreview: "Long response still yields a proposal.",
          title: "Long Response Courage Lesson",
        }),
      }),
    );
  });

  test("defaults model Runs to the low-cost Smart Storage model", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubEnv("OPENAI_SMART_STORAGE_MODEL", "");
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ output: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );

    await authed.action(api.smartStorage.executeModelRun, {
      smartStorageRunId: startResult.smartStorageRunId,
    });

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const requestBody = JSON.parse(String(requestInit?.body));
    expect(requestBody).toMatchObject({
      max_output_tokens: 1_000,
      model: "gpt-5.4-nano",
      reasoning: { effort: "low" },
      text: { verbosity: "low" },
    });
  });

  test("marks a model Run failed when OPENAI_API_KEY is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );

    const result = await authed.action(api.smartStorage.executeModelRun, {
      smartStorageRunId: startResult.smartStorageRunId,
    });

    expect(result).toMatchObject({
      errorMessage: "OPENAI_API_KEY is not configured.",
      executionStatus: "failed",
      smartStorageRunId: startResult.smartStorageRunId,
      status: "failed",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const rowState = await getRunFailureState(t, startResult.smartStorageRunId);
    expect(rowState.run).toEqual(
      expect.objectContaining({
        errorMessage: "OPENAI_API_KEY is not configured.",
        status: "failed",
      }),
    );
    expect(rowState.proposalCount).toBe(0);
  });

  test("marks a model Run failed when OpenAI returns an error", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: "rate limited" } }), {
          status: 429,
        }),
      ),
    );
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );

    const result = await authed.action(api.smartStorage.executeModelRun, {
      smartStorageRunId: startResult.smartStorageRunId,
    });

    expect(result).toMatchObject({
      errorMessage: "OpenAI Responses API failed with 429.",
      executionStatus: "failed",
      status: "failed",
    });
    const rowState = await getRunFailureState(t, startResult.smartStorageRunId);
    expect(rowState.run).toEqual(
      expect.objectContaining({
        errorMessage: "OpenAI Responses API failed with 429.",
        rawModelOutput: expect.stringContaining("rate limited"),
        status: "failed",
      }),
    );
    expect(rowState.proposalCount).toBe(0);
  });

  test("marks a model Run failed when OpenAI output is invalid", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({ title: "Missing required fields" }),
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );

    const result = await authed.action(api.smartStorage.executeModelRun, {
      smartStorageRunId: startResult.smartStorageRunId,
    });

    expect(result).toMatchObject({
      errorMessage:
        "OpenAI response did not match the Smart Storage Proposal shape.",
      executionStatus: "failed",
      status: "failed",
    });
    const rowState = await getRunFailureState(t, startResult.smartStorageRunId);
    expect(rowState.run).toEqual(
      expect.objectContaining({
        errorMessage:
          "OpenAI response did not match the Smart Storage Proposal shape.",
        status: "failed",
      }),
    );
    expect(rowState.proposalCount).toBe(0);
  });

  test("marks a model Run no-proposal when OpenAI returns no content", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ output: [] }), { status: 200 })),
    );
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );

    const result = await authed.action(api.smartStorage.executeModelRun, {
      smartStorageRunId: startResult.smartStorageRunId,
    });

    expect(result).toMatchObject({
      errorMessage: "OpenAI response did not include proposal content.",
      executionStatus: "noProposal",
      status: "noProposal",
    });
    const rowState = await getRunFailureState(t, startResult.smartStorageRunId);
    expect(rowState.run).toEqual(
      expect.objectContaining({
        errorMessage: "OpenAI response did not include proposal content.",
        status: "noProposal",
      }),
    );
    expect(rowState.proposalCount).toBe(0);
  });

  test.each([
    {
      configureModelRun: () => {
        vi.stubEnv("OPENAI_API_KEY", "");
        vi.stubGlobal("fetch", vi.fn());
      },
      runStatus: "failed",
    },
    {
      configureModelRun: () => {
        vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
        vi.stubGlobal(
          "fetch",
          vi.fn(
            async () =>
              new Response(JSON.stringify({ output: [] }), { status: 200 }),
          ),
        );
      },
      runStatus: "noProposal",
    },
  ])(
    "generates a deterministic scaffold fallback after a $runStatus model Run",
    async ({ configureModelRun, runStatus }) => {
      configureModelRun();
      const t = convexTest({ schema, modules });
      const userId = await t.run(insertAllowedUser);
      const authed = t.withIdentity({ subject: `${userId}|test-session` });
      const startResult = await authed.mutation(
        api.smartStorage.startFromContribution,
        getLessonSmartStorageInput(),
      );

      const modelResult = await authed.action(api.smartStorage.executeModelRun, {
        smartStorageRunId: startResult.smartStorageRunId,
      });
      expect(modelResult.status).toBe(runStatus);

      const fallback = await authed.mutation(
        api.smartStorage.generateDraftProposalForRun,
        {
          smartStorageRunId: startResult.smartStorageRunId,
        },
      );

      expect(fallback).toMatchObject({
        contributionSubmissionId: startResult.contributionSubmissionId,
        currentProposal: {
          bodyPreview:
            "Objective: students will distinguish courage from presumption.",
          knowledgeType: "lesson",
          title: "Courage in Joshua",
        },
        smartStorageRunId: startResult.smartStorageRunId,
        status: "drafted",
      });

      const rowState = await t.run(async (ctx) => ({
        proposalCount: (await ctx.db.query("smartStorageProposals").collect())
          .length,
        run: await ctx.db.get(startResult.smartStorageRunId),
        submission: await ctx.db.get(startResult.contributionSubmissionId),
      }));

      expect(rowState.proposalCount).toBe(1);
      expect(rowState.run).toEqual(
        expect.objectContaining({
          completedAt: expect.any(Number),
          rawModelOutput: expect.stringContaining(
            "mvp-deterministic-scaffold-v1",
          ),
          status: "succeeded",
        }),
      );
      expect(rowState.run).not.toHaveProperty("errorMessage");
      expect(rowState.submission).toEqual(
        expect.objectContaining({
          submissionStatus: "reviewReady",
        }),
      );
    },
  );

  test("accepts a scaffold Proposal into one new Gold Knowledge Entry", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );
    const proposalResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );

    const accepted = await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: proposalResult.smartStorageProposalId,
    });

    expect(accepted).toMatchObject({
      acceptanceStatus: "accepted",
      entry: {
        contributor: {
          id: userId,
          name: "Smart Storage User",
        },
        knowledgeType: "lesson",
        primaryTagLabel: "Courage in Joshua",
        title: "Courage in Joshua",
      },
      status: "accepted",
    });
    const rowState = await t.run(async (ctx) => {
      const entry = await ctx.db.get(accepted.entryId!);
      const representations = await ctx.db
        .query("entryRepresentations")
        .withIndex("by_entryId_and_isPrimary", (q) =>
          q.eq("entryId", accepted.entryId!),
        )
        .collect();
      const outputs = await ctx.db
        .query("sourceOutputs")
        .withIndex("by_entryId_and_sourceId", (q) =>
          q.eq("entryId", accepted.entryId!),
        )
        .collect();
      const quoteRows = await ctx.db
        .query("quoteEntries")
        .withIndex("by_entryId", (q) => q.eq("entryId", accepted.entryId!))
        .collect();
      const proposal = await ctx.db.get(proposalResult.smartStorageProposalId);
      const contributionSubmission = await ctx.db.get(
        startResult.contributionSubmissionId,
      );
      const entryContextTagIds = (
        await ctx.db
          .query("entryTags")
          .withIndex("by_entryId_and_tagPurpose", (q) =>
            q.eq("entryId", accepted.entryId!).eq("tagPurpose", "context"),
          )
          .collect()
      )
        .map((entryTag) => entryTag.tagId)
        .sort();
      const contextTagIds = await getContextTagIdsForSnapshots(
        ctx,
        getJoshuaContextTags(),
      );
      const contextKey = getContextKey(contextTagIds);
      const organizationTag = await getTagByLookup(
        ctx,
        "organization",
        "arche-classical-academy",
      );
      const personTag = await getTagByLookup(ctx, "person", "smart-storage-user");
      const contextExpertiseEvidence = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", accepted.entryId!),
        )
        .collect();
      const contextExpertiseAggregate = await ctx.db
        .query("contextExpertiseAggregates")
        .withIndex("by_subjectUserId_and_contextKey", (q) =>
          q.eq("subjectUserId", userId).eq("contextKey", contextKey),
        )
        .unique();

      return {
        contributionSubmission,
        contextExpertiseAggregate,
        contextExpertiseEvidence,
        contextKey,
        contextTagIds,
        entryContextTagIds,
        entry,
        organizationTag,
        outputs,
        personTag,
        proposal,
        quoteRows,
        representations,
      };
    });

    expect(rowState.entry).toEqual(
      expect.objectContaining({
        createdByUserId: userId,
        humanWeight: 60,
        knowledgeType: "lesson",
        previewText:
          "Objective: students will distinguish courage from presumption.",
        title: "Courage in Joshua",
        visibilityKind: "public",
      }),
    );
    expect(rowState.representations).toEqual([
      expect.objectContaining({
        isPrimary: true,
        plainText:
          "Objective: students will distinguish courage from presumption.",
        representationKind: "plainText",
        representationRole: "primaryContent",
      }),
    ]);
    expect(rowState.outputs).toEqual([
      expect.objectContaining({
        entryId: accepted.entryId,
        outputKind: "produced",
        sourceId: startResult.sourceId,
      }),
    ]);
    expect(rowState.entryContextTagIds).toEqual(
      expect.arrayContaining([
        ...rowState.contextTagIds,
        rowState.organizationTag._id,
        rowState.personTag._id,
      ]),
    );
    expect(rowState.quoteRows).toEqual([]);
    expect(rowState.proposal).toEqual(
      expect.objectContaining({
        status: "accepted",
      }),
    );
    expect(rowState.contributionSubmission).toEqual(
      expect.objectContaining({
        submissionStatus: "accepted",
      }),
    );
    expect(rowState.contextExpertiseEvidence).toEqual([
      expect.objectContaining({
        contextKey: rowState.contextKey,
        contextTagIds: rowState.contextTagIds,
        entryId: accepted.entryId,
        evidenceKind: "post",
        subjectUserId: userId,
        visibilityKind: "public",
        visibilityTargetKey: "public",
      }),
    ]);
    expect(rowState.contextExpertiseAggregate).toEqual(
      expect.objectContaining({
        contextExpertiseMaturity: 20,
        contextExpertiseScore: 72,
        contextKey: rowState.contextKey,
        contextTagIds: rowState.contextTagIds,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 1,
        subjectUserId: userId,
        topSupportingEntryIds: [accepted.entryId],
        visibilityKind: "public",
        visibilityTargetKey: "public",
        audienceScopeKind: "public",
        audienceScopeTargetKey: "public",
      }),
    );

    const rankedAggregates = await authed.query(
      api.contextExpertise.listForActiveTags,
      {
        activeTagIds: rowState.contextTagIds,
        limit: 5,
      },
    );
    expect(rankedAggregates).toEqual([
      expect.objectContaining({
        aggregateId: rowState.contextExpertiseAggregate!._id,
        contextExpertiseScore: 72,
        evidenceCount: 1,
        subjectUserId: userId,
        topSupportingEntryIds: [accepted.entryId],
      }),
    ]);
  });

  test("accepts a scaffold Proposal as Smart Storage Slot Fulfillment", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const slotSeed = await t.run(
      async (ctx) =>
        await insertJoshuaSlot(ctx, {
          createdByUserId: userId,
          requestedKnowledgeType: "lesson",
          title: "Required Joshua lesson",
        }),
    );
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const [joshuaContextTag] = getJoshuaContextTags();
    if (joshuaContextTag === undefined) {
      throw new Error("Missing Joshua context tag fixture.");
    }
    const proposalResult = await createDraftProposal(
      authed,
      getLessonSmartStorageInput({
        contextTags: [joshuaContextTag],
        slotId: slotSeed.slotId,
      }),
    );

    const accepted = await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: proposalResult.smartStorageProposalId,
    });

    const slotContextKey = getContextKey(slotSeed.contextTagIds);
    const rowState = await t.run(async (ctx) => ({
      contextExpertiseAggregate: await ctx.db
        .query("contextExpertiseAggregates")
        .withIndex("by_subjectUserId_and_contextKey", (q) =>
          q.eq("subjectUserId", userId).eq("contextKey", slotContextKey),
        )
        .unique(),
      contextExpertiseEvidenceRows: await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", accepted.entryId!),
        )
        .collect(),
      slotEvidenceRows: await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_slotId", (q) => q.eq("slotId", slotSeed.slotId))
        .collect(),
      fulfilledSlot: await ctx.db.get(slotSeed.slotId),
    }));

    expect(rowState.fulfilledSlot).toEqual(
      expect.objectContaining({
        fulfilledEntryId: accepted.entryId,
        requestedKnowledgeType: "lesson",
        status: "fulfilled",
      }),
    );
    expect(rowState.contextExpertiseEvidenceRows).toHaveLength(2);
    const postEvidence = rowState.contextExpertiseEvidenceRows.find(
      (row) => row.evidenceKind === "post",
    );
    const slotFulfillmentEvidence = rowState.contextExpertiseEvidenceRows.find(
      (row) => row.evidenceKind === "slotFulfillment",
    );
    expect(postEvidence).toEqual(
      expect.objectContaining({
        contextKey: slotContextKey,
        contextTagIds: slotSeed.contextTagIds,
        entryId: accepted.entryId,
        evidenceKind: "post",
        subjectUserId: userId,
      }),
    );
    expect(postEvidence).not.toHaveProperty("slotId");
    expect(slotFulfillmentEvidence).toEqual(
      expect.objectContaining({
        contextKey: slotContextKey,
        contextTagIds: slotSeed.contextTagIds,
        entryId: accepted.entryId,
        evidenceKind: "slotFulfillment",
        slotId: slotSeed.slotId,
        subjectUserId: userId,
      }),
    );
    expect(rowState.slotEvidenceRows).toEqual([slotFulfillmentEvidence]);
    expect(rowState.contextExpertiseAggregate).toEqual(
      expect.objectContaining({
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 84,
        contextKey: slotContextKey,
        contextTagIds: slotSeed.contextTagIds,
        evidenceCount: 2,
        feedbackCount: 0,
        postCount: 1,
        subjectUserId: userId,
        topSupportingEntryIds: [accepted.entryId],
      }),
    );

    const rankedAggregates = await authed.query(
      api.contextExpertise.listForActiveTags,
      {
        activeTagIds: slotSeed.contextTagIds,
        limit: 5,
      },
    );
    expect(rankedAggregates).toEqual([
      expect.objectContaining({
        aggregateId: rowState.contextExpertiseAggregate!._id,
        contextExpertiseScore: 84,
        evidenceCount: 2,
        postCount: 1,
        subjectUserId: userId,
        topSupportingEntryIds: [accepted.entryId],
      }),
    ]);
  });

  test("rejects Smart Storage Slot Fulfillment when the Knowledge Type does not match", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const slotSeed = await t.run(
      async (ctx) =>
        await insertJoshuaSlot(ctx, {
          createdByUserId: userId,
          requestedKnowledgeType: "lesson",
          title: "Lesson-only Smart Storage Slot",
        }),
    );
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const [joshuaContextTag] = getJoshuaContextTags();
    if (joshuaContextTag === undefined) {
      throw new Error("Missing Joshua context tag fixture.");
    }
    const proposalResult = await createDraftProposal(authed, {
      body: "How does Joshua connect courage and obedience?",
      contextTags: [joshuaContextTag],
      knowledgeType: "question",
      slotId: slotSeed.slotId,
      title: "How does Joshua define courage?",
    });

    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        smartStorageProposalId: proposalResult.smartStorageProposalId,
      }),
    ).rejects.toThrow("must match the Knowledge Slot request");

    const rowState = await t.run(async (ctx) => ({
      contextExpertiseEvidenceRows: await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_slotId", (q) => q.eq("slotId", slotSeed.slotId))
        .collect(),
      entries: await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_createdByUserId", (q) => q.eq("createdByUserId", userId))
        .collect(),
      slot: await ctx.db.get(slotSeed.slotId),
    }));
    expect(
      rowState.entries.some((entry) => entry.title === "How does Joshua define courage?"),
    ).toBe(false);
    expect(rowState.contextExpertiseEvidenceRows).toEqual([]);
    expect(rowState.slot).toEqual(expect.objectContaining({ status: "open" }));
    expect(rowState.slot).not.toHaveProperty("fulfilledEntryId");
  });

  test("rejects Smart Storage Slot Fulfillment when the Slot is not open", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const slotSeed = await t.run(
      async (ctx) =>
        await insertJoshuaSlot(ctx, {
          createdByUserId: userId,
          requestedKnowledgeType: "lesson",
          status: "cancelled",
          title: "Cancelled Joshua lesson",
        }),
    );
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const [joshuaContextTag] = getJoshuaContextTags();
    if (joshuaContextTag === undefined) {
      throw new Error("Missing Joshua context tag fixture.");
    }
    const proposalResult = await createDraftProposal(
      authed,
      getLessonSmartStorageInput({
        contextTags: [joshuaContextTag],
        slotId: slotSeed.slotId,
      }),
    );

    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        smartStorageProposalId: proposalResult.smartStorageProposalId,
      }),
    ).rejects.toThrow("Knowledge Slot is not open for Fulfillment.");

    const rowState = await t.run(async (ctx) => ({
      contextExpertiseEvidenceRows: await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_slotId", (q) => q.eq("slotId", slotSeed.slotId))
        .collect(),
      slot: await ctx.db.get(slotSeed.slotId),
    }));
    expect(rowState.contextExpertiseEvidenceRows).toEqual([]);
    expect(rowState.slot).toEqual(expect.objectContaining({ status: "cancelled" }));
    expect(rowState.slot).not.toHaveProperty("fulfilledEntryId");
  });

  test("accepts a Quote Proposal into a Quote detail row with one Person attribution", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const lewisTag = {
      canonicalKey: "cs-lewis",
      href: "/goto/cs-lewis",
      id: "cs-lewis",
      knowledgeType: "person" as const,
      label: "C.S. Lewis",
    };
    await t.run((ctx) => seedKnownContextTagsForTest(ctx, userId, [lewisTag]));
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const body = "Courage is every virtue at the testing point.";
    const proposalResult = await createDraftProposal(
      authed,
      getQuoteSmartStorageInput({
        body,
        contextTags: getQuoteContextTags([lewisTag]),
        title: "Courage at the testing point",
      }),
    );

    const accepted = await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: proposalResult.smartStorageProposalId,
    });

    const rowState = await t.run(async (ctx) => {
      const lewis = await ctx.db
        .query("referents")
        .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
          q.eq("knowledgeType", "person").eq("canonicalKey", "cs-lewis"),
        )
        .first();
      const quoteRows = await ctx.db
        .query("quoteEntries")
        .withIndex("by_entryId", (q) => q.eq("entryId", accepted.entryId!))
        .collect();
      const entryContextTagIds = (
        await ctx.db
          .query("entryTags")
          .withIndex("by_entryId_and_tagPurpose", (q) =>
            q.eq("entryId", accepted.entryId!).eq("tagPurpose", "context"),
          )
          .collect()
      )
        .map((entryTag) => entryTag.tagId)
        .sort();
      const contextTagIds = await getContextTagIdsForSnapshots(
        ctx,
        getQuoteContextTags([lewisTag]),
      );
      const contextKey = getContextKey(contextTagIds);
      const contextExpertiseEvidence = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", accepted.entryId!),
        )
        .collect();
      const userAggregate = await ctx.db
        .query("contextExpertiseAggregates")
        .withIndex("by_subjectUserId_and_contextKey", (q) =>
          q.eq("subjectUserId", userId).eq("contextKey", contextKey),
        )
        .unique();
      const personAggregate =
        lewis === null
          ? null
          : await ctx.db
              .query("contextExpertiseAggregates")
              .withIndex("by_subjectPersonReferentId_and_contextKey", (q) =>
                q
                  .eq("subjectPersonReferentId", lewis._id)
                  .eq("contextKey", contextKey),
              )
              .unique();

      return {
        contextExpertiseEvidence,
        contextKey,
        contextTagIds,
        entryContextTagIds,
        lewis,
        personAggregate,
        quoteRows,
        userAggregate,
      };
    });

    expect(rowState.lewis).toEqual(
      expect.objectContaining({
        canonicalName: "C.S. Lewis",
      }),
    );
    expect(rowState.quoteRows).toEqual([
      expect.objectContaining({
        entryId: accepted.entryId,
        quotedPersonReferentId: rowState.lewis!._id,
        sourceText: body,
      }),
    ]);
    expect(rowState.entryContextTagIds).toEqual(
      expect.arrayContaining(rowState.contextTagIds),
    );
    expect(rowState.contextExpertiseEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contextKey: rowState.contextKey,
          contextTagIds: rowState.contextTagIds,
          entryId: accepted.entryId,
          evidenceKind: "post",
          subjectUserId: userId,
          visibilityKind: "public",
          visibilityTargetKey: "public",
        }),
        expect.objectContaining({
          contextKey: rowState.contextKey,
          contextTagIds: rowState.contextTagIds,
          entryId: accepted.entryId,
          evidenceKind: "quoteAttribution",
          subjectPersonReferentId: rowState.lewis!._id,
          visibilityKind: "public",
          visibilityTargetKey: "public",
        }),
      ]),
    );
    expect(rowState.contextExpertiseEvidence).toHaveLength(2);
    const quoteAttributionEvidence = rowState.contextExpertiseEvidence.find(
      (evidence) => evidence.evidenceKind === "quoteAttribution",
    );
    expect(quoteAttributionEvidence).not.toHaveProperty("subjectUserId");
    expect(rowState.userAggregate).toEqual(
      expect.objectContaining({
        contextKey: rowState.contextKey,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 1,
        subjectUserId: userId,
        topSupportingEntryIds: [accepted.entryId],
      }),
    );
    expect(rowState.personAggregate).toEqual(
      expect.objectContaining({
        contextKey: rowState.contextKey,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 0,
        subjectPersonReferentId: rowState.lewis!._id,
        topSupportingEntryIds: [accepted.entryId],
      }),
    );
    expect(rowState.personAggregate).not.toHaveProperty("subjectUserId");
  });

  test("accepts Quote Proposals without attribution when Person context is absent or ambiguous", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const personTags = [
      {
        canonicalKey: "cs-lewis",
        href: "/goto/cs-lewis",
        id: "cs-lewis",
        knowledgeType: "person" as const,
        label: "C.S. Lewis",
      },
      {
        canonicalKey: "gk-chesterton",
        href: "/goto/gk-chesterton",
        id: "gk-chesterton",
        knowledgeType: "person" as const,
        label: "G.K. Chesterton",
      },
    ];
    await t.run((ctx) => seedKnownContextTagsForTest(ctx, userId, personTags));
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const noPersonBody = "An unattributed quote.";
    const multiPersonBody = "An ambiguously attributed quote.";
    const noPersonProposal = await createDraftProposal(
      authed,
      getQuoteSmartStorageInput({
        body: noPersonBody,
        title: "Quote without a Person context",
      }),
    );
    const multiPersonProposal = await createDraftProposal(
      authed,
      getQuoteSmartStorageInput({
        body: multiPersonBody,
        contextTags: getQuoteContextTags(personTags),
        title: "Quote with ambiguous Person context",
      }),
    );

    const noPersonAccepted = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: noPersonProposal.smartStorageProposalId,
      },
    );
    const multiPersonAccepted = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: multiPersonProposal.smartStorageProposalId,
      },
    );

    const rowState = await t.run(async (ctx) => ({
      multiPersonEvidence: await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", multiPersonAccepted.entryId!),
        )
        .collect(),
      multiPersonQuoteRows: await ctx.db
        .query("quoteEntries")
        .withIndex("by_entryId", (q) =>
          q.eq("entryId", multiPersonAccepted.entryId!),
        )
        .collect(),
      noPersonEvidence: await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", noPersonAccepted.entryId!),
        )
        .collect(),
      noPersonQuoteRows: await ctx.db
        .query("quoteEntries")
        .withIndex("by_entryId", (q) =>
          q.eq("entryId", noPersonAccepted.entryId!),
        )
        .collect(),
    }));
    expect(rowState.noPersonQuoteRows).toEqual([
      expect.objectContaining({
        entryId: noPersonAccepted.entryId,
        sourceText: noPersonBody,
      }),
    ]);
    expect(rowState.noPersonQuoteRows[0]).not.toHaveProperty(
      "quotedPersonReferentId",
    );
    expect(rowState.multiPersonQuoteRows).toEqual([
      expect.objectContaining({
        entryId: multiPersonAccepted.entryId,
        sourceText: multiPersonBody,
      }),
    ]);
    expect(rowState.multiPersonQuoteRows[0]).not.toHaveProperty(
      "quotedPersonReferentId",
    );
    expect(
      rowState.noPersonEvidence.filter(
        (evidence) => evidence.evidenceKind === "quoteAttribution",
      ),
    ).toEqual([]);
    expect(
      rowState.multiPersonEvidence.filter(
        (evidence) => evidence.evidenceKind === "quoteAttribution",
      ),
    ).toEqual([]);
  });

  test("still creates Question detail rows when accepting a Question Proposal", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const proposalResult = await createDraftProposal(authed, {
      body: "How does Joshua connect courage and obedience?",
      contextTags: getJoshuaContextTags(),
      knowledgeType: "question" as const,
      title: "How does Joshua define courage?",
    });

    const accepted = await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: proposalResult.smartStorageProposalId,
    });

    const questionRows = await t.run(
      async (ctx) =>
        await ctx.db
          .query("questionEntries")
          .withIndex("by_entryId", (q) => q.eq("entryId", accepted.entryId!))
          .collect(),
    );
    expect(questionRows).toEqual([
      expect.objectContaining({
        entryId: accepted.entryId,
        questionText: "How does Joshua define courage?",
      }),
    ]);
  });

  test("persists explicit Representation decisions when accepting a scaffold Proposal", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const storageId = await storeTestFile(t, "presentation source");
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      {
        body: "  Objective: students will distinguish courage from presumption.  ",
        contextTags: getJoshuaContextTags(),
        externalUrls: [{ url: "https://example.com/courage" }],
        knowledgeType: "lesson",
        title: "  Courage in Joshua  ",
        uploadedFiles: [
          {
            contentType:
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            fileName: "courage-slides.pptx",
            fileSizeBytes: 4321,
            storageId,
          },
        ],
      },
    );
    const proposalResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const textCitation = proposalResult.sourceCitations.find(
      (citation) => citation.citationKind === "textExcerpt",
    );
    const externalUrlCitation = proposalResult.sourceCitations.find(
      (citation) => citation.citationKind === "externalUrl",
    );
    const fileCitation = proposalResult.sourceCitations.find(
      (citation) => citation.citationKind === "fileLocator",
    );

    if (!textCitation || !externalUrlCitation || !fileCitation) {
      throw new Error("Expected text, URL, and file citations.");
    }

    const accepted = await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      representationDecisions: [
        {
          includeAsRepresentation: true,
          isPrimary: false,
          representationRole: "primaryContent",
          sourceId: textCitation.sourceId,
        },
        {
          includeAsRepresentation: false,
          isPrimary: false,
          representationRole: "supportingMaterial",
          sourceId: externalUrlCitation.sourceId,
        },
        {
          includeAsRepresentation: true,
          isPrimary: true,
          representationRole: "slides",
          sourceId: fileCitation.sourceId,
        },
      ],
      smartStorageProposalId: proposalResult.smartStorageProposalId,
    });

    const rowState = await t.run(async (ctx) => {
      const representations = await ctx.db
        .query("entryRepresentations")
        .withIndex("by_entryId_and_isPrimary", (q) =>
          q.eq("entryId", accepted.entryId!),
        )
        .collect();
      const outputs = await ctx.db
        .query("sourceOutputs")
        .withIndex("by_entryId_and_sourceId", (q) =>
          q.eq("entryId", accepted.entryId!),
        )
        .collect();

      return {
        outputs,
        representations,
      };
    });

    expect(rowState.representations).toHaveLength(2);
    expect(rowState.representations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isPrimary: false,
          plainText:
            "Objective: students will distinguish courage from presumption.",
          representationKind: "plainText",
          representationRole: "primaryContent",
        }),
        expect.objectContaining({
          contentType:
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          fileName: "courage-slides.pptx",
          isPrimary: true,
          representationKind: "storageFile",
          representationRole: "slides",
          storageId,
        }),
      ]),
    );
    expect(rowState.representations).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          representationKind: "externalUrl",
        }),
      ]),
    );
    expect(rowState.outputs.map((output) => output.sourceId).sort()).toEqual(
      [textCitation.sourceId, fileCitation.sourceId].sort(),
    );
  });

  test("acceptance adds source preview image as a non-primary thumbnail when no upload supplies one", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      {
        body: "Objective: students will distinguish courage from presumption.",
        contextTags: getJoshuaContextTags(),
        externalUrls: [
          {
            linkPreviewImageUrl: "https://images.example/courage.jpg",
            linkPreviewTitle: "Courage source",
            url: "https://example.com/courage",
          },
        ],
        knowledgeType: "lesson",
        title: "Courage in Joshua",
      },
    );
    const proposalResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );

    const accepted = await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: proposalResult.smartStorageProposalId,
    });

    const rowState = await t.run(async (ctx) => {
      const representations = await ctx.db
        .query("entryRepresentations")
        .withIndex("by_entryId_and_isPrimary", (q) =>
          q.eq("entryId", accepted.entryId!),
        )
        .collect();
      const outputs = await ctx.db
        .query("sourceOutputs")
        .withIndex("by_entryId_and_sourceId", (q) =>
          q.eq("entryId", accepted.entryId!),
        )
        .collect();

      return {
        outputs,
        representations,
      };
    });

    expect(rowState.representations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          externalUrl: "https://images.example/courage.jpg",
          isPrimary: false,
          representationKind: "externalUrl",
          representationRole: "thumbnail",
        }),
      ]),
    );
    expect(
      rowState.representations.filter((representation) => representation.isPrimary),
    ).toHaveLength(1);
    expect(new Set(rowState.outputs.map((output) => output.sourceId)).size).toBe(
      rowState.outputs.length,
    );
  });

  test("adds an uploaded representative thumbnail to an accessible Knowledge Page entry", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const proposalResult = await createDraftProposal(
      authed,
      getLessonSmartStorageInput(),
    );
    const accepted = await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: proposalResult.smartStorageProposalId,
    });
    const storageId = await storeTestImage(t, "thumbnail image");
    const temporaryUpload = await authed.mutation(
      api.smartStorage.createTemporaryUploadRecord,
      {
        contentType: "image/png",
        fileName: "courage-thumbnail.png",
        fileSizeBytes: 15,
        storageId,
      },
    );

    const result = await authed.mutation(api.smartStorage.addKnowledgePageThumbnail, {
      entryId: accepted.entryId!,
      uploadedFile: {
        contentType: "image/png",
        fileName: "courage-thumbnail.png",
        fileSizeBytes: 15,
        storageId,
        temporaryUploadId: temporaryUpload.temporaryUploadId,
      },
    });

    expect(result).toMatchObject({
      entryId: accepted.entryId,
      status: "added",
      thumbnailUrl: expect.any(String),
    });
    const rowState = await t.run(async (ctx) => {
      const representations = await ctx.db
        .query("entryRepresentations")
        .withIndex("by_entryId_and_representationKind", (q) =>
          q.eq("entryId", accepted.entryId!).eq("representationKind", "storageFile"),
        )
        .collect();
      const upload = await ctx.db.get(temporaryUpload.temporaryUploadId);

      return {
        representations,
        upload,
      };
    });

    expect(rowState.representations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "courage-thumbnail.png",
          isPrimary: false,
          representationRole: "thumbnail",
          storageId,
        }),
      ]),
    );
    expect(rowState.upload).toEqual(
      expect.objectContaining({
        uploadStatus: "attached",
      }),
    );
  });

  test("rejects invalid explicit Representation decisions during Proposal acceptance", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({
        externalUrls: [{ url: "https://example.com/courage" }],
      }),
    );
    const proposalResult = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );
    const textCitation = proposalResult.sourceCitations.find(
      (citation) => citation.citationKind === "textExcerpt",
    );
    const externalUrlCitation = proposalResult.sourceCitations.find(
      (citation) => citation.citationKind === "externalUrl",
    );
    const unrelatedStartResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput({ title: "Unrelated Courage Lesson" }),
    );

    if (!textCitation || !externalUrlCitation) {
      throw new Error("Expected text and URL citations.");
    }

    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        representationDecisions: [],
        smartStorageProposalId: proposalResult.smartStorageProposalId,
      }),
    ).rejects.toThrow(
      "At least one Source must be accepted as an Entry Representation.",
    );
    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        representationDecisions: [
          {
            includeAsRepresentation: true,
            isPrimary: true,
            representationRole: "primaryContent",
            sourceId: textCitation.sourceId,
          },
          {
            includeAsRepresentation: true,
            isPrimary: true,
            representationRole: "supportingMaterial",
            sourceId: externalUrlCitation.sourceId,
          },
        ],
        smartStorageProposalId: proposalResult.smartStorageProposalId,
      }),
    ).rejects.toThrow("Exactly one accepted Source must be marked primary.");
    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        representationDecisions: [
          {
            includeAsRepresentation: false,
            isPrimary: true,
            representationRole: "primaryContent",
            sourceId: textCitation.sourceId,
          },
        ],
        smartStorageProposalId: proposalResult.smartStorageProposalId,
      }),
    ).rejects.toThrow("Only included Sources can be marked primary.");
    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        representationDecisions: [
          {
            includeAsRepresentation: true,
            isPrimary: true,
            representationRole: "primaryContent",
            sourceId: unrelatedStartResult.sourceId,
          },
        ],
        smartStorageProposalId: proposalResult.smartStorageProposalId,
      }),
    ).rejects.toThrow("Selected Source is not cited by this Proposal.");
  });

  test("returns a target-exists state instead of updating an existing Gold entry", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const firstProposal = await createDraftProposal(authed);
    await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: firstProposal.smartStorageProposalId,
    });
    const secondProposal = await createDraftProposal(authed);

    const accepted = await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: secondProposal.smartStorageProposalId,
    });

    expect(accepted).toMatchObject({
      acceptanceStatus: "targetExists",
      existingEntryId: expect.any(String),
      status: "needsResolution",
    });
    const rowState = await t.run(async (ctx) => ({
      contextExpertiseEvidenceCount: (
        await ctx.db.query("contextExpertiseEvidence").collect()
      ).length,
      proposalCurationEvidenceRows: await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_smartStorageProposalId", (q) =>
          q.eq("smartStorageProposalId", secondProposal.smartStorageProposalId),
        )
        .collect(),
      entries: await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_createdByUserId", (q) => q.eq("createdByUserId", userId))
        .collect(),
      proposal: await ctx.db.get(secondProposal.smartStorageProposalId),
    }));
    expect(
      rowState.entries.filter((entry) => entry.title === "Courage in Joshua"),
    ).toHaveLength(1);
    expect(rowState.contextExpertiseEvidenceCount).toBe(1);
    expect(rowState.proposalCurationEvidenceRows).toEqual([]);
    expect(rowState.proposal).toEqual(
      expect.objectContaining({
        status: "needsResolution",
      }),
    );
  });

  test("confirms a target-exists Proposal into the existing Gold entry", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const firstProposal = await createDraftProposal(authed);
    const firstAccepted = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: firstProposal.smartStorageProposalId,
      },
    );
    const secondProposal = await createDraftProposal(authed);
    const targetExists = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: secondProposal.smartStorageProposalId,
      },
    );
    const citedSource = secondProposal.sourceCitations[0];
    if (!targetExists.existingEntryId || !citedSource) {
      throw new Error("Expected target exists result with a cited Source.");
    }

    const confirmed = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        representationDecisions: [
          {
            includeAsRepresentation: true,
            isPrimary: true,
            representationRole: "primaryContent",
            sourceId: citedSource.sourceId,
          },
        ],
        smartStorageProposalId: secondProposal.smartStorageProposalId,
        targetExistingEntryId: targetExists.existingEntryId,
      },
    );

    expect(confirmed).toMatchObject({
      acceptanceStatus: "accepted",
      entryId: firstAccepted.entryId,
      status: "accepted",
    });
    const rowState = await t.run(async (ctx) => {
      const entries = await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_createdByUserId", (q) => q.eq("createdByUserId", userId))
        .collect();
      const representations = await ctx.db
        .query("entryRepresentations")
        .withIndex("by_entryId_and_isPrimary", (q) =>
          q.eq("entryId", firstAccepted.entryId!),
        )
        .collect();
      const outputs = await ctx.db
        .query("sourceOutputs")
        .withIndex("by_entryId_and_sourceId", (q) =>
          q.eq("entryId", firstAccepted.entryId!),
        )
        .collect();
      const proposal = await ctx.db.get(secondProposal.smartStorageProposalId);
      const contributionSubmission = await ctx.db.get(
        secondProposal.contributionSubmissionId!,
      );
      const entryContextTagIds = (
        await ctx.db
          .query("entryTags")
          .withIndex("by_entryId_and_tagPurpose", (q) =>
            q.eq("entryId", firstAccepted.entryId!).eq("tagPurpose", "context"),
          )
          .collect()
      )
        .map((entryTag) => entryTag.tagId)
        .sort();
      const entryContextKey = getContextKey(entryContextTagIds);
      const postContextTagIds = await getContextTagIdsForSnapshots(
        ctx,
        getJoshuaContextTags(),
      );
      const postContextKey = getContextKey(postContextTagIds);
      const contextExpertiseEvidenceRows = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", firstAccepted.entryId!),
        )
        .collect();
      const contextExpertiseAggregate = await ctx.db
        .query("contextExpertiseAggregates")
        .withIndex("by_subjectUserId_and_contextKey", (q) =>
          q.eq("subjectUserId", userId).eq("contextKey", postContextKey),
        )
        .unique();

      return {
        contributionSubmission,
        contextExpertiseAggregate,
        contextExpertiseEvidenceRows,
        entryContextKey,
        entryContextTagIds,
        postContextKey,
        postContextTagIds,
        curationEvidenceRows: await ctx.db
          .query("contextExpertiseEvidence")
          .withIndex("by_smartStorageProposalId", (q) =>
            q.eq(
              "smartStorageProposalId",
              secondProposal.smartStorageProposalId,
            ),
          )
          .collect(),
        entries,
        outputs,
        proposal,
        representations,
      };
    });
    expect(
      rowState.entries.filter((entry) => entry.title === "Courage in Joshua"),
    ).toHaveLength(1);
    expect(rowState.representations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isPrimary: false,
          plainText:
            "Objective: students will distinguish courage from presumption.",
          representationKind: "plainText",
          representationRole: "primaryContent",
        }),
        expect.objectContaining({
          isPrimary: true,
          plainText:
            "Objective: students will distinguish courage from presumption.",
          representationKind: "plainText",
          representationRole: "primaryContent",
        }),
      ]),
    );
    expect(
      rowState.representations.filter((representation) => representation.isPrimary),
    ).toHaveLength(1);
    expect(rowState.outputs.map((output) => output.sourceId).sort()).toEqual(
      [firstProposal.sourceId, citedSource.sourceId].sort(),
    );
    expect(rowState.proposal).toEqual(
      expect.objectContaining({
        status: "accepted",
      }),
    );
    expect(rowState.contributionSubmission).toEqual(
      expect.objectContaining({
        submissionStatus: "accepted",
      }),
    );
    expect(rowState.contextExpertiseEvidenceRows).toHaveLength(2);
    const postEvidence = rowState.contextExpertiseEvidenceRows.find(
      (row) => row.evidenceKind === "post",
    );
    const curationEvidence = rowState.contextExpertiseEvidenceRows.find(
      (row) => row.evidenceKind === "curation",
    );
    expect(postEvidence).toEqual(
      expect.objectContaining({
        contextKey: rowState.postContextKey,
        contextTagIds: rowState.postContextTagIds,
        entryId: firstAccepted.entryId,
        evidenceKind: "post",
        subjectUserId: userId,
      }),
    );
    expect(curationEvidence).toEqual(
      expect.objectContaining({
        contextKey: rowState.entryContextKey,
        contextTagIds: rowState.entryContextTagIds,
        entryId: firstAccepted.entryId,
        evidenceKind: "curation",
        smartStorageProposalId: secondProposal.smartStorageProposalId,
        subjectUserId: userId,
        visibilityKind: "public",
        visibilityTargetKey: "public",
      }),
    );
    expect(curationEvidence).not.toHaveProperty("feedbackId");
    expect(curationEvidence).not.toHaveProperty("slotId");
    expect(rowState.curationEvidenceRows).toEqual([curationEvidence]);
    expect(rowState.contextExpertiseAggregate).toEqual(
      expect.objectContaining({
        contextExpertiseMaturity: 20,
        contextExpertiseScore: 72,
        contextKey: rowState.postContextKey,
        contextTagIds: rowState.postContextTagIds,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 1,
        subjectUserId: userId,
        topSupportingEntryIds: [firstAccepted.entryId],
      }),
    );

    const rankedAggregates = await authed.query(
      api.contextExpertise.listForActiveTags,
      {
        activeTagIds: rowState.postContextTagIds,
        limit: 5,
      },
    );
    expect(rankedAggregates).toEqual([
      expect.objectContaining({
        aggregateId: rowState.contextExpertiseAggregate!._id,
        contextExpertiseScore: 72,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 1,
        subjectUserId: userId,
        topSupportingEntryIds: [firstAccepted.entryId],
      }),
    ]);
  });

  test("rejects confirmed existing-entry updates for the wrong target", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const firstProposal = await createDraftProposal(authed);
    await authed.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: firstProposal.smartStorageProposalId,
    });
    const unrelatedProposal = await createDraftProposal(
      authed,
      getLessonSmartStorageInput({ title: "Mercy in Joshua" }),
    );
    const unrelatedAccepted = await authed.mutation(
      api.smartStorage.acceptScaffoldProposal,
      {
        smartStorageProposalId: unrelatedProposal.smartStorageProposalId,
      },
    );
    const secondProposal = await createDraftProposal(authed);

    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        smartStorageProposalId: secondProposal.smartStorageProposalId,
        targetExistingEntryId: unrelatedAccepted.entryId!,
      }),
    ).rejects.toThrow(
      "Confirmed existing entry does not match the current represented target.",
    );
  });

  test("rejects confirmed existing-entry updates for entries the user does not own", async () => {
    const t = convexTest({ schema, modules });
    const ownerUserId = await t.run(insertAllowedUser);
    const otherUserId = await t.run(
      async (ctx) => await insertAllowedUser(ctx, "other"),
    );
    const owner = t.withIdentity({ subject: `${ownerUserId}|test-session` });
    const seededEntryId = await t.run(
      async (ctx) =>
        await insertRepresentedLessonEntryForTest(ctx, {
          canonicalUserId: ownerUserId,
          createdByUserId: otherUserId,
          title: "Courage in Joshua",
        }),
    );
    const proposal = await createDraftProposal(owner);
    const targetExists = await owner.mutation(api.smartStorage.acceptScaffoldProposal, {
      smartStorageProposalId: proposal.smartStorageProposalId,
    });

    expect(targetExists).toMatchObject({
      acceptanceStatus: "targetExists",
      existingEntryId: seededEntryId,
    });
    await expect(
      owner.mutation(api.smartStorage.acceptScaffoldProposal, {
        smartStorageProposalId: proposal.smartStorageProposalId,
        targetExistingEntryId: seededEntryId,
      }),
    ).rejects.toThrow("Unauthorized");
    const rowState = await t.run(async (ctx) => ({
      curationEvidenceRows: await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_smartStorageProposalId", (q) =>
          q.eq("smartStorageProposalId", proposal.smartStorageProposalId),
        )
        .collect(),
    }));
    expect(rowState.curationEvidenceRows).toEqual([]);
  });

  test("backfills missing Representation Roles for legacy Entry Representations", async () => {
    const t = convexTest({
      schema: legacyRepresentationMigrationSchema,
      modules,
    });

    await t.run(async (ctx) => {
      const now = Date.now();
      const entryId = await ctx.db.insert("knowledgeEntries", {
        title: "Legacy lesson entry",
      });
      await ctx.db.insert("entryRepresentations", {
        entryId,
        representationKind: "plainText",
        plainText: "Primary lesson notes.",
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("entryRepresentations", {
        entryId,
        representationKind: "prosemirror",
        prosemirrorDocumentId: "legacy-doc",
        isPrimary: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("entryRepresentations", {
        entryId,
        representationKind: "storageFile",
        contentType: "application/vnd.ms-powerpoint",
        fileName: "chapel-slides.pptx",
        isPrimary: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("entryRepresentations", {
        entryId,
        representationKind: "externalUrl",
        externalUrl: "https://example.com/source",
        isPrimary: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("entryRepresentations", {
        entryId,
        representationKind: "video",
        contentType: "video/mp4",
        isPrimary: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("entryRepresentations", {
        entryId,
        representationKind: "storageFile",
        contentType: "image/png",
        fileName: "chapel-thumbnail.png",
        isPrimary: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("entryRepresentations", {
        entryId,
        representationKind: "storageFile",
        contentType: "application/pdf",
        fileName: "chapel-manuscript.pdf",
        isPrimary: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("entryRepresentations", {
        entryId,
        representationKind: "storageFile",
        contentType: "text/plain",
        fileName: "chapel-transcript.txt",
        isPrimary: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    const dryRun = await t.mutation(
      internal.smartStorage.backfillMissingRepresentationRoles,
      {
        batchSize: 20,
        dryRun: true,
      },
    );
    expect(dryRun).toMatchObject({
      dryRun: true,
      isDone: true,
      matchedCount: 8,
      scannedCount: 8,
      updatedCount: 0,
    });
    const dryRunRows = await t.run(
      async (ctx) => await ctx.db.query("entryRepresentations").collect(),
    );
    expect(
      dryRunRows.every((row) => row.representationRole === undefined),
    ).toBe(true);

    const backfill = await t.mutation(
      internal.smartStorage.backfillMissingRepresentationRoles,
      {
        batchSize: 20,
      },
    );
    expect(backfill).toMatchObject({
      dryRun: false,
      isDone: true,
      matchedCount: 8,
      scannedCount: 8,
      updatedCount: 8,
    });
    const rowState = await t.run(async (ctx) => {
      const rows = await ctx.db.query("entryRepresentations").collect();
      return rows.map((row) => ({
        representationKind: row.representationKind,
        representationRole: row.representationRole,
      }));
    });
    expect(rowState).toEqual(
      expect.arrayContaining([
        {
          representationKind: "plainText",
          representationRole: "primaryContent",
        },
        {
          representationKind: "prosemirror",
          representationRole: "unspecified",
        },
        {
          representationKind: "storageFile",
          representationRole: "slides",
        },
        {
          representationKind: "externalUrl",
          representationRole: "supportingMaterial",
        },
        {
          representationKind: "video",
          representationRole: "recording",
        },
        {
          representationKind: "storageFile",
          representationRole: "thumbnail",
        },
        {
          representationKind: "storageFile",
          representationRole: "manuscript",
        },
        {
          representationKind: "storageFile",
          representationRole: "transcript",
        },
      ]),
    );

    const secondBackfill = await t.mutation(
      internal.smartStorage.backfillMissingRepresentationRoles,
      {
        batchSize: 20,
      },
    );
    expect(secondBackfill).toMatchObject({
      matchedCount: 0,
      updatedCount: 0,
    });
  });

  test("audits and backfills legacy Smart Storage parent links idempotently", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const legacy = await t.run(
      async (ctx) => await insertLegacySmartStorageRows(ctx, userId),
    );

    const auditBefore = await t.query(
      internal.smartStorage.auditLegacySmartStorageParentLinks,
      { batchSize: 20 },
    );
    expect(auditBefore).toMatchObject({
      proposals: {
        missingContributionSubmissionIdCount: 1,
        mismatchedContributionSubmissionIdCount: 0,
        scannedCount: 1,
      },
      runs: {
        missingContributionSubmissionIdCount: 1,
        scannedCount: 1,
      },
      sources: {
        missingContributionSubmissionIdCount: 1,
        scannedCount: 1,
      },
    });

    const dryRun = await t.mutation(
      internal.smartStorage.backfillLegacySmartStorageParents,
      {
        batchSize: 20,
        dryRun: true,
      },
    );
    expect(dryRun).toMatchObject({
      createdSubmissionCount: 1,
      dryRun: true,
      proposalPatchCount: 1,
      runPatchCount: 1,
      scannedRunCount: 1,
      sourcePatchCount: 1,
    });
    const dryRunSubmissionCount = await t.run(
      async (ctx) =>
        (await ctx.db.query("contributionSubmissions").collect()).length,
    );
    expect(dryRunSubmissionCount).toBe(0);

    const backfill = await t.mutation(
      internal.smartStorage.backfillLegacySmartStorageParents,
      {
        batchSize: 20,
      },
    );
    expect(backfill).toMatchObject({
      createdSubmissionCount: 1,
      dryRun: false,
      proposalPatchCount: 1,
      runPatchCount: 1,
      scannedRunCount: 1,
      sourcePatchCount: 1,
    });

    const rowState = await t.run(async (ctx) => {
      const source = await ctx.db.get(legacy.sourceId);
      const run = await ctx.db.get(legacy.runId);
      const proposal = await ctx.db.get(legacy.proposalId);
      const contributionSubmissionId = run?.contributionSubmissionId;

      return {
        contributionSubmission:
          contributionSubmissionId === undefined
            ? null
            : await ctx.db.get(contributionSubmissionId),
        proposal,
        run,
        source,
      };
    });
    expect(rowState.run?.contributionSubmissionId).toBeDefined();
    expect(rowState.source?.contributionSubmissionId).toBe(
      rowState.run?.contributionSubmissionId,
    );
    expect(rowState.proposal?.contributionSubmissionId).toBe(
      rowState.run?.contributionSubmissionId,
    );
    expect(rowState.contributionSubmission).toEqual(
      expect.objectContaining({
        intendedVisibilityKind: "public",
        intendedVisibilityTargetKey: "public",
        primaryIntendedBodyPreview:
          "Legacy body preview for parent migration.",
        primaryIntendedKnowledgeType: "lesson",
        primaryIntendedTitle: "Legacy Courage Lesson",
        reviewScopeKind: "private",
        reviewScopeTargetKey: `user:${userId}`,
        submissionStatus: "reviewReady",
        submittedByUserId: userId,
      }),
    );

    const secondBackfill = await t.mutation(
      internal.smartStorage.backfillLegacySmartStorageParents,
      {
        batchSize: 20,
      },
    );
    expect(secondBackfill).toMatchObject({
      attachedExistingSubmissionCount: 0,
      createdSubmissionCount: 0,
      proposalPatchCount: 0,
      runPatchCount: 0,
      sourcePatchCount: 0,
    });
  });

  test("rejects accepting a Proposal whose parent conflicts with its Run", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const { proposalId } = await t.run(
      async (ctx) => await insertMismatchedParentProposal(ctx, userId),
    );

    await expect(
      authed.mutation(api.smartStorage.acceptScaffoldProposal, {
        smartStorageProposalId: proposalId,
      }),
    ).rejects.toThrow(
      "Proposal and Run belong to different Contribution Submissions.",
    );
  });

  test("requires app access before creating Submission, Source, or Run records", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertActiveUserWithoutOrganization);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    await expect(
      authed.mutation(api.smartStorage.startFromContribution, {
        body: "A source that should not be stored.",
        contextTags: [],
        knowledgeType: "words",
        title: "Unauthorized source",
      }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      authed.mutation(api.smartStorage.generateUploadUrl, {}),
    ).rejects.toThrow("Unauthorized");

    const rowCounts = await t.run(async (ctx) => ({
      citations: (await ctx.db.query("proposalSourceCitations").collect()).length,
      contributionSubmissions: (
        await ctx.db.query("contributionSubmissions").collect()
      ).length,
      runs: (await ctx.db.query("smartStorageRuns").collect()).length,
      sources: (await ctx.db.query("sources").collect()).length,
    }));
    expect(rowCounts).toEqual({
      citations: 0,
      contributionSubmissions: 0,
      runs: 0,
      sources: 0,
    });
  });

  test("prevents an allowed user from generating another user's Proposal", async () => {
    const t = convexTest({ schema, modules });
    const ownerUserId = await t.run(insertAllowedUser);
    const otherUserId = await t.run(
      async (ctx) => await insertAllowedUser(ctx, "other"),
    );
    const owner = t.withIdentity({ subject: `${ownerUserId}|test-session` });
    const other = t.withIdentity({ subject: `${otherUserId}|test-session` });
    const startResult = await owner.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );

    await expect(
      other.mutation(api.smartStorage.generateDraftProposalForRun, {
        smartStorageRunId: startResult.smartStorageRunId,
      }),
    ).rejects.toThrow("Unauthorized");

    const rowState = await t.run(async (ctx) => ({
      proposalCount: (await ctx.db.query("smartStorageProposals").collect())
        .length,
      run: await ctx.db.get(startResult.smartStorageRunId),
    }));
    expect(rowState.proposalCount).toBe(0);
    expect(rowState.run).toEqual(
      expect.objectContaining({
        status: "queued",
      }),
    );
  });
});

async function createDraftProposal(
  authed: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  input: SmartStorageContributionInput = getLessonSmartStorageInput(),
) {
  const startResult = await authed.mutation(
    api.smartStorage.startFromContribution,
    input,
  );

  return await authed.mutation(api.smartStorage.generateDraftProposalForRun, {
    smartStorageRunId: startResult.smartStorageRunId,
  });
}

async function querySessionSummary(
  authed: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  contributionSubmissionId: Id<"contributionSubmissions">,
) {
  const session = await authed.query(api.smartStorage.getSessionSummary, {
    contributionSubmissionId,
  });
  if (session === null) {
    throw new Error("Expected Smart Storage Session summary.");
  }

  return session;
}

async function expectSessionState(
  authed: ReturnType<ReturnType<typeof convexTest>["withIdentity"]>,
  contributionSubmissionId: Id<"contributionSubmissions">,
  expectedState: string,
) {
  const session = await querySessionSummary(authed, contributionSubmissionId);
  expect(session.state).toBe(expectedState);
}

async function getRunFailureState(
  t: ReturnType<typeof convexTest>,
  smartStorageRunId: Id<"smartStorageRuns">,
) {
  return await t.run(async (ctx) => ({
    proposalCount: (await ctx.db.query("smartStorageProposals").collect())
      .length,
    run: await ctx.db.get(smartStorageRunId),
  }));
}

async function getExternalUrlSource(
  ctx: MutationCtx,
  contributionSubmissionId: Id<"contributionSubmissions">,
) {
  const sources = await ctx.db
    .query("sources")
    .withIndex("by_contributionSubmissionId_and_submittedAt", (q) =>
      q.eq("contributionSubmissionId", contributionSubmissionId),
    )
    .take(20);
  const source = sources.find(
    (candidate) => candidate.sourceKind === "externalUrl",
  );
  if (!source) {
    throw new Error("Missing external URL Source.");
  }

  return source;
}

function getModelProposedEntry(
  overrides: Partial<{
    bodyPreview: string;
    proposalConfidence: "low" | "medium" | "high";
    rationale: string;
    title: string;
  }> = {},
) {
  return {
    knowledgeType: "lesson" as const,
    title: overrides.title ?? "Model Courage Lesson",
    bodyPreview:
      overrides.bodyPreview ?? "Model-shaped courage lesson preview.",
    contextTags: getJoshuaContextTags().map((tag) => ({
      ...tag,
      passageString: "passageString" in tag ? tag.passageString : null,
    })),
    proposalConfidence: overrides.proposalConfidence ?? ("high" as const),
    rationale:
      overrides.rationale ??
      "The submitted Source names a lesson and supplies enough text.",
  };
}

function getLessonSmartStorageInput(
  overrides: Partial<SmartStorageContributionInput> = {},
): SmartStorageContributionInput {
  return {
    body: "  Objective: students will distinguish courage from presumption.  ",
    contextTags: getJoshuaContextTags(),
    knowledgeType: "lesson" as const,
    title: "  Courage in Joshua  ",
    ...overrides,
  };
}

function getQuoteSmartStorageInput(
  overrides: Partial<SmartStorageContributionInput> = {},
): SmartStorageContributionInput {
  return {
    body: "Courage is every virtue at the testing point.",
    contextTags: getQuoteContextTags(),
    knowledgeType: "quote" as const,
    title: "Courage quote",
    ...overrides,
  };
}

function getQuoteContextTags(
  personTags: TestContextTagSnapshot[] = [],
): TestContextTagSnapshot[] {
  return [...getJoshuaContextTags(), ...personTags];
}

function getJoshuaContextTags(): TestContextTagSnapshot[] {
  return [
    {
      canonicalKey: "joshua-1-6-9",
      href: "/scripture/joshua-1-6-9",
      id: "joshua-1-6-9",
      knowledgeType: "biblePassage" as const,
      label: "Joshua 1:6-9",
      passageString: "Joshua 1:6-9",
    },
    {
      canonicalKey: "courage",
      href: "/goto/courage",
      id: "courage",
      knowledgeType: "topic" as const,
      label: "Courage",
    },
  ];
}

function getContextKey(tagIds: Array<Id<"tags">>) {
  return `tags:${[...tagIds].sort().join(",")}`;
}

async function getContextTagIdsForSnapshots(
  ctx: MutationCtx,
  snapshots: TestContextTagSnapshot[],
) {
  const tagIds: Array<Id<"tags">> = [];
  for (const snapshot of snapshots) {
    tagIds.push(
      (
        await getTagByLookup(
          ctx,
          snapshot.knowledgeType,
          getSnapshotLookupKey(snapshot),
        )
      )._id,
    );
  }

  return tagIds.sort();
}

async function getTagByLookup(
  ctx: MutationCtx,
  knowledgeType: Doc<"referents">["knowledgeType"],
  lookupKey: string,
) {
  const tag = await ctx.db
    .query("tags")
    .withIndex("by_knowledgeType_and_lookupKey", (q) =>
      q.eq("knowledgeType", knowledgeType).eq("lookupKey", lookupKey),
    )
    .unique();
  if (!tag) {
    throw new Error(`Missing ${knowledgeType} Tag "${lookupKey}".`);
  }

  return tag;
}

function getSnapshotLookupKey(snapshot: TestContextTagSnapshot) {
  const key = (snapshot.canonicalKey || snapshot.id || snapshot.label).trim();
  return key.includes(":") ? key : normalizeLookupKey(key);
}

function normalizeLookupKey(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
}

async function insertJoshuaSlot(
  ctx: MutationCtx,
  {
    createdByUserId,
    requestedKnowledgeType,
    status = "open",
    title,
  }: {
    createdByUserId: Id<"users">;
    requestedKnowledgeType: Doc<"knowledgeSlots">["requestedKnowledgeType"];
    status?: Doc<"knowledgeSlots">["status"];
    title: string;
  },
) {
  const now = Date.now();
  const [joshuaTag] = await seedKnownContextTagsForTest(
    ctx,
    createdByUserId,
    getJoshuaContextTags().slice(0, 1),
  );
  if (joshuaTag === undefined) {
    throw new Error("Missing seeded Joshua Tag.");
  }
  const tagId = joshuaTag.tagId;
  const contextTagIds = [tagId];
  const slotId = await ctx.db.insert("knowledgeSlots", {
    requestedKnowledgeType,
    status,
    title,
    contextKey: getContextKey(contextTagIds),
    targetKind: "public",
    createdByUserId,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("slotTags", {
    slotId,
    tagId,
    addedAt: now,
  });

  return { contextTagIds, slotId };
}

async function storeTestFile(
  t: ReturnType<typeof convexTest>,
  contents: string,
  contentType = "application/pdf",
) {
  return await t.run(
    async (ctx) =>
      await ctx.storage.store(
        new Blob([contents], { type: contentType }),
      ),
  );
}

async function storeTestImage(
  t: ReturnType<typeof convexTest>,
  contents: string,
) {
  return await storeTestFile(t, contents, "image/png");
}

async function insertLegacySmartStorageRows(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const now = Date.now();
  const sourceId = await ctx.db.insert("sources", {
    sourceKind: "pastedText",
    title: "Legacy Courage Lesson",
    rawText: "Legacy body preview for parent migration.",
    submittedByUserId: userId,
    submittedAt: now - 3_000,
  });
  const runId = await ctx.db.insert("smartStorageRuns", {
    sourceId,
    status: "succeeded",
    requestedKnowledgeType: "lesson",
    contributionTitle: "Legacy Courage Lesson",
    contributionBodyPreview: "Legacy body preview for parent migration.",
    contextTags: getJoshuaContextTags(),
    contractSnapshotVersion: "legacy-contract-v1",
    contractSnapshotText: "Legacy contract text.",
    typeBehaviorSnapshotVersion: "legacy-type-behavior-v1",
    typeBehaviorSnapshotText: "Legacy type behavior text.",
    rawModelOutput: "{}",
    createdByUserId: userId,
    createdAt: now - 2_000,
    updatedAt: now - 2_000,
    completedAt: now - 1_500,
  });
  const proposalId = await ctx.db.insert("smartStorageProposals", {
    sourceId,
    smartStorageRunId: runId,
    status: "drafted",
    originalProposal: getLegacyProposedEntry(),
    currentProposal: getLegacyProposedEntry(),
    contractSnapshotVersion: "legacy-contract-v1",
    contractSnapshotText: "Legacy contract text.",
    typeBehaviorSnapshotVersion: "legacy-type-behavior-v1",
    typeBehaviorSnapshotText: "Legacy type behavior text.",
    createdByUserId: userId,
    createdAt: now - 1_000,
    updatedAt: now - 1_000,
  });

  return { proposalId, runId, sourceId };
}

async function insertMismatchedParentProposal(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const now = Date.now();
  const runContributionSubmissionId = await insertContributionSubmissionForTest(
    ctx,
    userId,
    "Run parent",
  );
  const proposalContributionSubmissionId =
    await insertContributionSubmissionForTest(ctx, userId, "Proposal parent");
  const sourceId = await ctx.db.insert("sources", {
    contributionSubmissionId: runContributionSubmissionId,
    sourceKind: "pastedText",
    title: "Mismatched parent lesson",
    rawText: "A proposal with a conflicting parent.",
    submittedByUserId: userId,
    submittedAt: now,
  });
  const runId = await ctx.db.insert("smartStorageRuns", {
    contributionSubmissionId: runContributionSubmissionId,
    sourceId,
    status: "succeeded",
    requestedKnowledgeType: "lesson",
    contributionTitle: "Mismatched parent lesson",
    contributionBodyPreview: "A proposal with a conflicting parent.",
    contextTags: getJoshuaContextTags(),
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
  });
  const proposalId = await ctx.db.insert("smartStorageProposals", {
    contributionSubmissionId: proposalContributionSubmissionId,
    sourceId,
    smartStorageRunId: runId,
    status: "drafted",
    originalProposal: getLegacyProposedEntry({
      bodyPreview: "A proposal with a conflicting parent.",
      title: "Mismatched parent lesson",
    }),
    currentProposal: getLegacyProposedEntry({
      bodyPreview: "A proposal with a conflicting parent.",
      title: "Mismatched parent lesson",
    }),
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  });

  return { proposalId };
}

async function insertContributionSubmissionForTest(
  ctx: MutationCtx,
  userId: Id<"users">,
  title: string,
) {
  const now = Date.now();
  return await ctx.db.insert("contributionSubmissions", {
    submittedByUserId: userId,
    submissionStatus: "reviewReady",
    primaryIntendedKnowledgeType: "lesson",
    primaryIntendedTitle: title,
    primaryIntendedBodyPreview: title,
    intendedVisibilityKind: "public",
    intendedVisibilityTargetKey: "public",
    reviewScopeKind: "private",
    reviewScopeTargetKey: `user:${userId}`,
    createdAt: now,
    updatedAt: now,
  });
}

async function insertRepresentedLessonEntryForTest(
  ctx: MutationCtx,
  {
    canonicalUserId,
    createdByUserId,
    title,
  }: {
    canonicalUserId: Id<"users">;
    createdByUserId: Id<"users">;
    title: string;
  },
) {
  const now = Date.now();
  const lookupKey = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const referentId = await ctx.db.insert("referents", {
    canonicalKey: `smart-storage:${canonicalUserId}:lesson:${lookupKey}`,
    canonicalName: title,
    knowledgeType: "lesson",
  });
  const tagId = await ctx.db.insert("tags", {
    referentId,
    knowledgeType: "lesson",
    label: title,
    lookupKey: `smart-storage:${canonicalUserId}:lesson:${lookupKey}`,
    createdByUserId,
  });
  const entryId = await ctx.db.insert("knowledgeEntries", {
    knowledgeType: "lesson",
    representedReferentId: referentId,
    primaryTagId: tagId,
    title,
    previewText: "Seeded lesson.",
    searchText: `${title} Seeded lesson.`,
    primaryTagLabel: title,
    contextPreviewTagLabels: [],
    humanWeight: 60,
    visibilityKind: "public",
    visibilityTargetKey: "public",
    discoverabilityKind: "public",
    discoverabilityTargetKey: "public",
    publicPreviewText: "Seeded lesson.",
    createdByUserId,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("entryTags", {
    entryId,
    tagId,
    tagPurpose: "represented",
    taggedAt: now,
    taggedByUserId: createdByUserId,
  });

  return entryId;
}

function getLegacyProposedEntry(
  overrides: Partial<{
    bodyPreview: string;
    title: string;
  }> = {},
) {
  return {
    knowledgeType: "lesson" as const,
    title: overrides.title ?? "Legacy Courage Lesson",
    bodyPreview:
      overrides.bodyPreview ?? "Legacy body preview for parent migration.",
    contextTags: getJoshuaContextTags(),
    proposalConfidence: "medium" as const,
    rationale: "Legacy scaffold proposal.",
  };
}

async function insertActiveUserWithoutOrganization(
  ctx: MutationCtx,
  suffix: unknown = "",
) {
  const normalizedSuffix = typeof suffix === "string" ? suffix : "";
  const userSuffix = normalizedSuffix ? `-${normalizedSuffix}` : "";
  return await ctx.db.insert("users", {
    email: `smart-storage${userSuffix}@example.com`,
    isActive: true,
    name: `Smart Storage User${normalizedSuffix ? ` ${normalizedSuffix}` : ""}`,
  });
}

async function insertAllowedUser(ctx: MutationCtx, suffix: unknown = "") {
  const normalizedSuffix = typeof suffix === "string" ? suffix : "";
  const now = Date.now();
  const userId = await insertActiveUserWithoutOrganization(
    ctx,
    normalizedSuffix,
  );
  const keySuffix = normalizedSuffix ? `-${normalizedSuffix}` : "";
  const organizationReferentId = await ctx.db.insert("referents", {
    canonicalKey: `arche-classical-academy${keySuffix}`,
    canonicalName: `Arche Classical Academy${
      normalizedSuffix ? ` ${normalizedSuffix}` : ""
    }`,
    knowledgeType: "organization",
  });
  const organizationTagId = await ctx.db.insert("tags", {
    referentId: organizationReferentId,
    knowledgeType: "organization",
    label: `Arche Classical Academy${
      normalizedSuffix ? ` ${normalizedSuffix}` : ""
    }`,
    lookupKey: `arche-classical-academy${keySuffix}`,
    createdByUserId: userId,
  });
  const organizationEntryId = await ctx.db.insert("knowledgeEntries", {
    knowledgeType: "organization",
    representedReferentId: organizationReferentId,
    primaryTagId: organizationTagId,
    title: `Arche Classical Academy${
      normalizedSuffix ? ` ${normalizedSuffix}` : ""
    }`,
    previewText: "School organization.",
    searchText: `Arche Classical Academy${
      normalizedSuffix ? ` ${normalizedSuffix}` : ""
    } School organization.`,
    primaryTagLabel: `Arche Classical Academy${
      normalizedSuffix ? ` ${normalizedSuffix}` : ""
    }`,
    contextPreviewTagLabels: [],
    visibilityKind: "public",
    visibilityTargetKey: "public",
    discoverabilityKind: "public",
    discoverabilityTargetKey: "public",
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("organizationEntries", {
    entryId: organizationEntryId,
    organizationKind: "school",
    isActive: true,
  });

  const personReferentId = await ctx.db.insert("referents", {
    canonicalKey: `smart-storage-user${keySuffix}`,
    canonicalName: `Smart Storage User${
      normalizedSuffix ? ` ${normalizedSuffix}` : ""
    }`,
    knowledgeType: "person",
  });
  await ctx.db.insert("memberships", {
    personReferentId,
    memberUserId: userId,
    targetKind: "organization",
    organizationReferentId,
    membershipStatus: "active",
    memberRole: "admin",
    createdAt: now,
    updatedAt: now,
  });

  await seedKnownContextTagsForTest(ctx, userId, getJoshuaContextTags());

  return userId;
}

async function seedKnownContextTagsForTest(
  ctx: MutationCtx,
  createdByUserId: Id<"users">,
  snapshots: TestContextTagSnapshot[],
) {
  const tags = [];
  for (const snapshot of snapshots) {
    tags.push(
      await upsertKnownContextTagForTest(ctx, {
        createdByUserId,
        snapshot,
      }),
    );
  }

  return tags;
}

async function upsertKnownContextTagForTest(
  ctx: MutationCtx,
  {
    createdByUserId,
    snapshot,
  }: {
    createdByUserId: Id<"users">;
    snapshot: TestContextTagSnapshot;
  },
) {
  const lookupKey = getSnapshotLookupKey(snapshot);
  const referent =
    (await ctx.db
      .query("referents")
      .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
        q.eq("knowledgeType", snapshot.knowledgeType).eq("canonicalKey", lookupKey),
      )
      .first()) ??
    (await ctx.db.get(
      await ctx.db.insert("referents", {
        canonicalKey: lookupKey,
        canonicalName: snapshot.label,
        knowledgeType: snapshot.knowledgeType,
      }),
    ));
  if (!referent) {
    throw new Error("Known Referent could not be seeded.");
  }

  const tag =
    (await ctx.db
      .query("tags")
      .withIndex("by_knowledgeType_and_lookupKey", (q) =>
        q.eq("knowledgeType", snapshot.knowledgeType).eq("lookupKey", lookupKey),
      )
      .first()) ??
    (await ctx.db.get(
      await ctx.db.insert("tags", {
        referentId: referent._id,
        knowledgeType: snapshot.knowledgeType,
        label: snapshot.label,
        lookupKey,
        createdByUserId,
      }),
    ));
  if (!tag) {
    throw new Error("Known Referent Tag could not be seeded.");
  }

  return {
    referentId: referent._id,
    tagId: tag._id,
  };
}
