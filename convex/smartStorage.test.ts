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
  externalUrls?: Array<{ url: string }>;
  knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
  slotId?: string;
  title: string;
};

const SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT =
  "Preserve a durable Contribution Submission with child Sources, interpret guidance-like text inside Authored Text Sources without synthesizing stored Contribution Notes, and queue conservative scaffold proposal generation.";

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
          fileSizeBytes: 1234,
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
        contractSnapshotVersion: "mvp-smart-storage-contract-v2",
        createdByUserId: userId,
        primarySourceId: result.sourceId,
        requestedKnowledgeType: "lesson",
        slotId: "slot-joshua-courage-lesson",
        sourceId: result.sourceId,
        status: "queued",
        typeBehaviorSnapshotId: expect.any(String),
        typeBehaviorSnapshotVersion: "mvp-type-behavior-v3",
      }),
    );
    expect(rowState.contractVersion).toEqual(
      expect.objectContaining({
        contractKey: "mvp-smart-storage-contract",
        snapshotText: SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT,
        version: "mvp-smart-storage-contract-v2",
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
        version: "mvp-type-behavior-v3",
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
        version: "mvp-smart-storage-contract-v2",
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
        version: "mvp-smart-storage-contract-v2",
        snapshotText: SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("typeBehaviorSnapshots", {
        knowledgeType: "lesson",
        version: "mvp-type-behavior-v3",
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
        contractSnapshotVersion: "mvp-smart-storage-contract-v2",
        contractSnapshotText: SMART_STORAGE_CONTRACT_SNAPSHOT_TEXT,
        createdByUserId: userId,
        smartStorageRunId: startResult.smartStorageRunId,
        sourceId: startResult.sourceId,
        status: "drafted",
        typeBehaviorSnapshotId: rowState.run?.typeBehaviorSnapshotId,
        typeBehaviorSnapshotVersion: "mvp-type-behavior-v3",
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
      model: "gpt-test-smart-storage",
      text: {
        format: {
          name: "smart_storage_proposal",
          strict: true,
          type: "json_schema",
        },
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
        contractSnapshotVersion: "mvp-smart-storage-contract-v2",
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
      const contextTagIds = (
        await ctx.db
          .query("entryTags")
          .withIndex("by_entryId_and_tagPurpose", (q) =>
            q.eq("entryId", accepted.entryId!).eq("tagPurpose", "context"),
          )
          .collect()
      )
        .map((entryTag) => entryTag.tagId)
        .sort();
      const contextKey = getContextKey(contextTagIds);
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
        entry,
        outputs,
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
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const body = "Courage is every virtue at the testing point.";
    const proposalResult = await createDraftProposal(
      authed,
      getQuoteSmartStorageInput({
        body,
        contextTags: getQuoteContextTags([
          {
            canonicalKey: "cs-lewis",
            href: "/goto/cs-lewis",
            id: "cs-lewis",
            knowledgeType: "person" as const,
            label: "C.S. Lewis",
          },
        ]),
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
      const contextTagIds = (
        await ctx.db
          .query("entryTags")
          .withIndex("by_entryId_and_tagPurpose", (q) =>
            q.eq("entryId", accepted.entryId!).eq("tagPurpose", "context"),
          )
          .collect()
      )
        .map((entryTag) => entryTag.tagId)
        .sort();
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
        contextTags: getQuoteContextTags([
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
        ]),
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
      const contextTagIds = (
        await ctx.db
          .query("entryTags")
          .withIndex("by_entryId_and_tagPurpose", (q) =>
            q.eq("entryId", firstAccepted.entryId!).eq("tagPurpose", "context"),
          )
          .collect()
      )
        .map((entryTag) => entryTag.tagId)
        .sort();
      const contextKey = getContextKey(contextTagIds);
      const contextExpertiseEvidenceRows = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", firstAccepted.entryId!),
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
        contextExpertiseEvidenceRows,
        contextKey,
        contextTagIds,
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
        contextKey: rowState.contextKey,
        contextTagIds: rowState.contextTagIds,
        entryId: firstAccepted.entryId,
        evidenceKind: "post",
        subjectUserId: userId,
      }),
    );
    expect(curationEvidence).toEqual(
      expect.objectContaining({
        contextKey: rowState.contextKey,
        contextTagIds: rowState.contextTagIds,
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
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 84,
        contextKey: rowState.contextKey,
        contextTagIds: rowState.contextTagIds,
        evidenceCount: 2,
        feedbackCount: 0,
        postCount: 1,
        subjectUserId: userId,
        topSupportingEntryIds: [firstAccepted.entryId],
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
        contextExpertiseScore: 84,
        evidenceCount: 2,
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
      matchedCount: 5,
      scannedCount: 5,
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
      matchedCount: 5,
      scannedCount: 5,
      updatedCount: 5,
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
  const referentId = await ctx.db.insert("referents", {
    canonicalKey: "joshua-1-6-9",
    canonicalName: "Joshua 1:6-9",
    knowledgeType: "biblePassage",
  });
  const tagId = await ctx.db.insert("tags", {
    referentId,
    knowledgeType: "biblePassage",
    label: "Joshua 1:6-9",
    lookupKey: "joshua-1-6-9",
    createdByUserId,
  });
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
) {
  return await t.run(
    async (ctx) =>
      await ctx.storage.store(
        new Blob([contents], { type: "application/pdf" }),
      ),
  );
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

  return userId;
}
