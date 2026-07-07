/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./auth.ts": () => import("./auth"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
  "./contextExpertise.ts": () => import("./contextExpertise"),
  "./humanWeightFeedback.ts": () => import("./humanWeightFeedback"),
  "./lib/appAccess.ts": () => import("./lib/appAccess"),
  "./lib/contextExpertiseEvidence.ts": () =>
    import("./lib/contextExpertiseEvidence"),
  "./lib/contextExpertiseScoring.ts": () =>
    import("./lib/contextExpertiseScoring"),
  "./lib/fileRepresentationRoles.ts": () =>
    import("./lib/fileRepresentationRoles"),
  "./lib/referentThumbnails.ts": () => import("./lib/referentThumbnails"),
  "./lib/typeBehavior.ts": () => import("./lib/typeBehavior"),
};

const BASE_TIME = Date.UTC(2026, 5, 1, 12);

describe("Context Expertise inheritance", () => {
  test("lists exact and immediate broader parent aggregate candidates", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedContextExpertiseInheritanceRows);
    const authed = t.withIdentity({
      subject: `${seed.adminUserId}|test-session`,
    });

    const aggregates = await authed.query(api.contextExpertise.listForActiveTags, {
      activeTagIds: [seed.tags.primary.tagId, seed.tags.secondary.tagId],
      limit: 5,
    });
    const singleTagAggregates = await authed.query(
      api.contextExpertise.listForActiveTags,
      {
        activeTagIds: [seed.tags.primary.tagId],
        limit: 5,
      },
    );

    expect(
      aggregates.map((aggregate) => ({
        contextExpertiseScore: aggregate.contextExpertiseScore,
        contextKey: aggregate.contextKey,
        contextMatchKind: aggregate.contextMatchKind,
        subjectUserId: aggregate.subjectUserId,
      })),
    ).toEqual([
      {
        contextExpertiseScore: 85,
        contextKey: getContextKey([seed.tags.primary.tagId]),
        contextMatchKind: "broaderContext",
        subjectUserId: seed.parentOnlyUserId,
      },
      {
        contextExpertiseScore: 74,
        contextKey: getContextKey([
          seed.tags.primary.tagId,
          seed.tags.secondary.tagId,
        ]),
        contextMatchKind: undefined,
        subjectUserId: seed.exactUserId,
      },
    ]);
    expect(
      singleTagAggregates.map((aggregate) => ({
        contextExpertiseScore: aggregate.contextExpertiseScore,
        contextMatchKind: aggregate.contextMatchKind,
        subjectUserId: aggregate.subjectUserId,
      })),
    ).toEqual([
      {
        contextExpertiseScore: 100,
        contextMatchKind: undefined,
        subjectUserId: seed.exactUserId,
      },
      {
        contextExpertiseScore: 100,
        contextMatchKind: undefined,
        subjectUserId: seed.parentOnlyUserId,
      },
    ]);
  });

  test("lists Person-subject aggregate candidates", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedContextExpertiseInheritanceRows);
    const person = await t.run(async (ctx) => {
      const person = await insertTag(ctx, {
        canonicalKey: "expertise-person-subject",
        knowledgeType: "person",
        label: "Expertise Person Subject",
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 70,
        contextExpertiseScore: 93,
        contextTagIds: [seed.tags.primary.tagId, seed.tags.secondary.tagId],
        evidenceCount: 1,
        feedbackCount: 0,
        latestEvidenceAt: BASE_TIME + 70,
        postCount: 1,
        subjectPersonReferentId: person.referentId,
      });

      return person;
    });
    const authed = t.withIdentity({
      subject: `${seed.adminUserId}|test-session`,
    });

    const aggregates = await authed.query(api.contextExpertise.listForActiveTags, {
      activeTagIds: [seed.tags.primary.tagId, seed.tags.secondary.tagId],
      limit: 5,
    });
    const personAggregate = aggregates.find(
      (aggregate) => aggregate.subjectPersonReferentId === person.referentId,
    );

    expect(personAggregate).toMatchObject({
      contextExpertiseMaturity: 70,
      contextExpertiseScore: 93,
      subjectKind: "person",
      subjectPersonReferentId: person.referentId,
    });
    expect(personAggregate).not.toHaveProperty("subjectUserId");
  });
});

describe("Profile Context Expertise surfaces", () => {
  test("lists the current user's accessible Context Expertise contexts", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedProfileContextExpertiseRows);
    const authed = t.withIdentity({
      subject: `${seed.userId}|test-session`,
    });

    const profile = await authed.query(
      api.contextExpertise.listCurrentUserProfileContextExpertise,
      { limit: 10 },
    );

    expect(profile.profileUserId).toBe(seed.userId);
    expect(
      profile.rows.map((row) => ({
        contextLabels: row.contextTags.map((tag) => tag.label),
        contextTagHrefs: row.contextTags.map((tag) => tag.href),
        contextTagIds: row.contextTags.map((tag) => tag.id),
        contextExpertiseScore: row.contextExpertiseScore,
        visibilityKind: row.visibilityKind,
        visibilityTargetKey: row.visibilityTargetKey,
      })),
    ).toEqual([
      {
        contextLabels: ["Profile Doctrine"],
        contextTagHrefs: ["/goto/profile-doctrine"],
        contextTagIds: ["profile-doctrine"],
        contextExpertiseScore: 96,
        visibilityKind: "organization",
        visibilityTargetKey: seed.organizationReferentId,
      },
      {
        contextLabels: ["Profile Romans"],
        contextTagHrefs: ["/goto/profile-romans"],
        contextTagIds: ["profile-romans"],
        contextExpertiseScore: 91,
        visibilityKind: "public",
        visibilityTargetKey: "public",
      },
    ]);
  });

  test("bounds profile Context Expertise rows", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedProfileContextExpertiseRows);
    const authed = t.withIdentity({
      subject: `${seed.userId}|test-session`,
    });

    const profile = await authed.query(
      api.contextExpertise.listCurrentUserProfileContextExpertise,
      { limit: 1 },
    );

    expect(profile.rows.map((row) => row.contextKey)).toEqual([
      getContextKey([seed.tags.doctrine.tagId]),
    ]);
  });
});

describe("Context Expertise migration support", () => {
  test("reports, dry-runs, and rebuilds scoped aggregates from evidence", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedScopedAggregateMigrationRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });
    const paginationOpts = { cursor: null, numItems: 10 };

    const beforeStatus = await admin.query(
      api.contextExpertise.getScopedAggregateMigrationStatus,
      {
        aggregateSampleLimit: 10,
        paginationOpts,
      },
    );
    expect(beforeStatus).toMatchObject({
      evidenceGroupCount: 2,
      isDone: true,
      legacyAggregateSampleCount: 0,
      missingScopedAggregateGroupCount: 2,
      sampledAggregateCount: 0,
      sampledEvidenceCount: 3,
      scopedAggregateSampleCount: 0,
    });
    expect(
      beforeStatus.missingScopedAggregateGroups.map((group) => ({
        audienceScopeKind: group.audienceScopeKind,
        audienceScopeTargetKey: group.audienceScopeTargetKey,
      })),
    ).toEqual([
      {
        audienceScopeKind: "public",
        audienceScopeTargetKey: "public",
      },
      {
        audienceScopeKind: "organization",
        audienceScopeTargetKey: seed.organizationReferentId,
      },
    ]);

    const dryRun = await admin.mutation(
      api.contextExpertise.rebuildScopedAggregateBatch,
      {
        dryRun: true,
        paginationOpts,
      },
    );
    expect(dryRun).toMatchObject({
      dryRun: true,
      groupCount: 2,
      isDone: true,
      processedEvidenceCount: 3,
      rebuiltGroupCount: 0,
      skippedGroupCount: 0,
    });
    await expectScopedAggregateRows(t, 0);

    const rebuild = await admin.mutation(
      api.contextExpertise.rebuildScopedAggregateBatch,
      {
        paginationOpts,
      },
    );
    expect(rebuild).toMatchObject({
      dryRun: false,
      groupCount: 2,
      isDone: true,
      processedEvidenceCount: 3,
      rebuiltGroupCount: 2,
      skippedGroupCount: 0,
    });

    const rows = await getScopedAggregateRows(t);
    expect(rows).toEqual([
      expect.objectContaining({
        audienceScopeKind: "organization",
        audienceScopeTargetKey: seed.organizationReferentId,
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 100,
        evidenceCount: 2,
        feedbackCount: 1,
        postCount: 1,
        subjectUserId: seed.expertUserId,
        topSupportingEntryIds: [seed.entries.organization],
        visibilityKind: "organization",
        visibilityTargetKey: seed.organizationReferentId,
      }),
      expect.objectContaining({
        audienceScopeKind: "public",
        audienceScopeTargetKey: "public",
        contextExpertiseMaturity: 20,
        contextExpertiseScore: 94,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 1,
        subjectUserId: seed.expertUserId,
        topSupportingEntryIds: [seed.entries.public],
        visibilityKind: "public",
        visibilityTargetKey: "public",
      }),
    ]);

    const afterStatus = await admin.query(
      api.contextExpertise.getScopedAggregateMigrationStatus,
      {
        aggregateSampleLimit: 10,
        paginationOpts,
      },
    );
    expect(afterStatus).toMatchObject({
      evidenceGroupCount: 2,
      legacyAggregateSampleCount: 0,
      missingScopedAggregateGroupCount: 0,
      sampledAggregateCount: 2,
      sampledEvidenceCount: 3,
      scopedAggregateSampleCount: 2,
    });
  });

  test("rebuild is idempotent for scoped aggregate rows", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedScopedAggregateMigrationRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });
    const paginationOpts = { cursor: null, numItems: 10 };

    await admin.mutation(api.contextExpertise.rebuildScopedAggregateBatch, {
      paginationOpts,
    });
    await admin.mutation(api.contextExpertise.rebuildScopedAggregateBatch, {
      paginationOpts,
    });

    const rows = await getScopedAggregateRows(t);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.evidenceCount).sort()).toEqual([1, 2]);
  });

  test("migration status and rebuild skip corrected evidence rows", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedCorrectedContextExpertiseEvidenceRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });
    const paginationOpts = { cursor: null, numItems: 10 };

    const status = await admin.query(
      api.contextExpertise.getScopedAggregateMigrationStatus,
      {
        aggregateSampleLimit: 10,
        paginationOpts,
      },
    );
    expect(status).toMatchObject({
      evidenceGroupCount: 0,
      isDone: true,
      missingScopedAggregateGroupCount: 0,
      sampledAggregateCount: 0,
      sampledEvidenceCount: 1,
      scopedAggregateSampleCount: 0,
    });

    const rebuild = await admin.mutation(
      api.contextExpertise.rebuildScopedAggregateBatch,
      {
        paginationOpts,
      },
    );
    expect(rebuild).toMatchObject({
      dryRun: false,
      groupCount: 0,
      isDone: true,
      processedEvidenceCount: 1,
      rebuiltGroupCount: 0,
      skippedGroupCount: 0,
    });
    await expectScopedAggregateRows(t, 0);
  });

  test("reports, dry-runs, executes, and reruns legacy aggregate cleanup", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedContextExpertiseInheritanceRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });
    const paginationOpts = { cursor: null, numItems: 10 };

    const beforeStatus = await admin.query(
      api.contextExpertise.getLegacyAggregateCleanupStatus,
      { paginationOpts },
    );
    expect(beforeStatus).toMatchObject({
      isDone: true,
      legacyAggregateCount: 3,
      mayHaveMoreAggregates: false,
      processedAggregateCount: 3,
    });
    expect(
      beforeStatus.legacyAggregates.map(
        (aggregate: {
          contextKey: string;
          hasAudienceScopeKind: boolean;
          hasAudienceScopeTargetKey: boolean;
          subjectKind?: "person" | "user";
        }) => ({
          contextKey: aggregate.contextKey,
          hasAudienceScopeKind: aggregate.hasAudienceScopeKind,
          hasAudienceScopeTargetKey: aggregate.hasAudienceScopeTargetKey,
          subjectKind: aggregate.subjectKind,
        }),
      ),
    ).toEqual([
      {
        contextKey: getContextKey([
          seed.tags.primary.tagId,
          seed.tags.secondary.tagId,
        ]),
        hasAudienceScopeKind: false,
        hasAudienceScopeTargetKey: false,
        subjectKind: "user",
      },
      {
        contextKey: getContextKey([seed.tags.primary.tagId]),
        hasAudienceScopeKind: false,
        hasAudienceScopeTargetKey: false,
        subjectKind: "user",
      },
      {
        contextKey: getContextKey([seed.tags.primary.tagId]),
        hasAudienceScopeKind: false,
        hasAudienceScopeTargetKey: false,
        subjectKind: "user",
      },
    ]);

    const dryRun = await admin.mutation(
      api.contextExpertise.cleanupLegacyAggregateBatch,
      {
        dryRun: true,
        paginationOpts,
      },
    );
    expect(dryRun).toMatchObject({
      deletedAggregateCount: 0,
      dryRun: true,
      isDone: true,
      legacyAggregateCount: 3,
      processedAggregateCount: 3,
      wouldDeleteAggregateCount: 3,
    });
    await expectLegacyAggregateRows(t, 3);

    await expect(
      admin.mutation(api.contextExpertise.cleanupLegacyAggregateBatch, {
        paginationOpts,
      }),
    ).rejects.toThrow(
      "Refusing to delete legacy Context Expertise aggregates without execute: true.",
    );
    await expectLegacyAggregateRows(t, 3);

    const cleanup = await admin.mutation(
      api.contextExpertise.cleanupLegacyAggregateBatch,
      {
        execute: true,
        paginationOpts,
      },
    );
    expect(cleanup).toMatchObject({
      deletedAggregateCount: 3,
      dryRun: false,
      isDone: true,
      legacyAggregateCount: 3,
      processedAggregateCount: 3,
      wouldDeleteAggregateCount: 0,
    });
    await expectLegacyAggregateRows(t, 0);

    const rerun = await admin.mutation(
      api.contextExpertise.cleanupLegacyAggregateBatch,
      {
        execute: true,
        paginationOpts,
      },
    );
    expect(rerun).toMatchObject({
      deletedAggregateCount: 0,
      isDone: true,
      legacyAggregateCount: 0,
      processedAggregateCount: 0,
    });
  });

  test("reports, dry-runs, executes, and reruns Quote attribution backfill", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedQuoteAttributionBackfillRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });
    const paginationOpts = { cursor: null, numItems: 10 };

    const beforeStatus = await admin.query(
      api.contextExpertise.getQuoteAttributionBackfillStatus,
      { paginationOpts },
    );
    expect(beforeStatus).toMatchObject({
      attributedQuoteRowCount: 4,
      eligibleQuoteRowCount: 2,
      existingEvidenceCount: 1,
      isDone: true,
      missingEvidenceCount: 1,
      processedQuoteRowCount: 5,
      skippedQuoteRowCount: 3,
    });
    expect(beforeStatus.missingEvidenceItems).toEqual([
      expect.objectContaining({
        action: "missing",
        entryId: seed.missingEvidenceEntryId,
        subjectPersonReferentId: seed.quotedPersonReferentId,
      }),
    ]);
    expect(
      beforeStatus.skippedQuoteRowItems.map((item) => item.skippedReason).sort(),
    ).toEqual(["noContextTags", "noQuotedPerson", "notQuote"]);

    await expect(
      admin.mutation(api.contextExpertise.backfillQuoteAttributionEvidenceBatch, {
        paginationOpts,
      }),
    ).rejects.toThrow(
      "Refusing to create Quote attribution Context Expertise Evidence without execute: true.",
    );

    const dryRun = await admin.mutation(
      api.contextExpertise.backfillQuoteAttributionEvidenceBatch,
      {
        dryRun: true,
        paginationOpts,
      },
    );
    expect(dryRun).toMatchObject({
      createdEvidenceCount: 0,
      dryRun: true,
      existingEvidenceCount: 1,
      missingEvidenceCount: 1,
      wouldCreateEvidenceCount: 1,
    });
    expect(dryRun.evidenceItems.map((item) => item.action).sort()).toEqual([
      "existing",
      "wouldCreate",
    ]);
    await expectScopedAggregateRows(t, 0);
    await expectQuoteAttributionEvidenceRows(t, 1);

    const backfill = await admin.mutation(
      api.contextExpertise.backfillQuoteAttributionEvidenceBatch,
      {
        execute: true,
        paginationOpts,
      },
    );
    expect(backfill).toMatchObject({
      createdEvidenceCount: 1,
      dryRun: false,
      existingEvidenceCount: 1,
      missingEvidenceCount: 1,
      wouldCreateEvidenceCount: 0,
    });
    expect(backfill.evidenceItems.map((item) => item.action).sort()).toEqual([
      "created",
      "existing",
    ]);
    await expectQuoteAttributionEvidenceRows(t, 2);

    const aggregateRows = await getScopedAggregateRows(t);
    expect(aggregateRows).toHaveLength(1);
    expect(aggregateRows[0]).toMatchObject({
      audienceScopeKind: "public",
      audienceScopeTargetKey: "public",
      evidenceCount: 2,
      feedbackCount: 0,
      postCount: 0,
      subjectPersonReferentId: seed.quotedPersonReferentId,
    });
    expect(aggregateRows[0]).not.toHaveProperty("subjectUserId");

    const rerun = await admin.mutation(
      api.contextExpertise.backfillQuoteAttributionEvidenceBatch,
      {
        execute: true,
        paginationOpts,
      },
    );
    expect(rerun).toMatchObject({
      createdEvidenceCount: 0,
      existingEvidenceCount: 2,
      missingEvidenceCount: 0,
    });
    await expectQuoteAttributionEvidenceRows(t, 2);

    const afterStatus = await admin.query(
      api.contextExpertise.getQuoteAttributionBackfillStatus,
      { paginationOpts },
    );
    expect(afterStatus).toMatchObject({
      existingEvidenceCount: 2,
      missingEvidenceCount: 0,
      skippedQuoteRowCount: 3,
    });
  });
});

describe("Context Expertise post attribution corrections", () => {
  test("system admin corrects post attribution and rebuilds affected aggregates", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPostAttributionCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });
    const paginationOpts = { cursor: null, numItems: 10 };

    await admin.mutation(api.contextExpertise.rebuildScopedAggregateBatch, {
      paginationOpts,
    });

    const result = await admin.mutation(
      api.contextExpertise.correctPostAttribution,
      {
        correctedSubjectUserId: seed.correctedUserId,
        entryId: seed.entryId,
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 2,
      correctedEvidenceCount: 1,
      correctedSubjectUserId: seed.correctedUserId,
      entryId: seed.entryId,
      previousCreatedByUserId: seed.originalUserId,
      skippedCorrectedEvidenceCount: 0,
    });

    const state = await t.run(async (ctx) => {
      const entry = await ctx.db.get(seed.entryId);
      const evidenceRows = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
      return { entry, evidenceRows };
    });
    expect(state.entry?.createdByUserId).toBe(seed.correctedUserId);

    const postEvidence = state.evidenceRows.find(
      (evidence) => evidence.evidenceKind === "post",
    );
    expect(postEvidence).toMatchObject({
      attributionCorrectedByUserId: seed.adminUserId,
      attributionCorrectedFromSubjectPersonReferentId:
        seed.originalProfile.personReferentId,
      attributionCorrectedFromSubjectUserId: seed.originalUserId,
      evidenceKind: "post",
      subjectPersonReferentId: seed.correctedProfile.personReferentId,
      subjectUserId: seed.correctedUserId,
    });
    expect(postEvidence?.attributionCorrectedAt).toEqual(expect.any(Number));

    const feedbackEvidence = state.evidenceRows.find(
      (evidence) => evidence.evidenceKind === "feedback",
    );
    expect(feedbackEvidence).toMatchObject({
      evidenceKind: "feedback",
      feedbackId: seed.feedbackId,
      subjectUserId: seed.reviewerUserId,
    });

    const rows = await getScopedAggregateRows(t);
    expect(rows).toHaveLength(2);
    expect(
      rows.some((row) => row.subjectUserId === seed.originalUserId),
    ).toBe(false);

    const correctedAggregate = rows.find(
      (row) => row.subjectUserId === seed.correctedUserId,
    );
    expect(correctedAggregate).toMatchObject({
      evidenceCount: 1,
      feedbackCount: 0,
      postCount: 1,
      subjectPersonReferentId: seed.correctedProfile.personReferentId,
      topSupportingEntryIds: [seed.entryId],
    });

    const reviewerAggregate = rows.find(
      (row) => row.subjectUserId === seed.reviewerUserId,
    );
    expect(reviewerAggregate).toMatchObject({
      evidenceCount: 1,
      feedbackCount: 1,
      postCount: 0,
      topSupportingEntryIds: [seed.entryId],
    });
  });

  test("post attribution correction clears subject person when corrected user has no profile", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPostAttributionNoProfileCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await admin.mutation(api.contextExpertise.correctPostAttribution, {
      correctedSubjectUserId: seed.correctedUserId,
      entryId: seed.entryId,
    });

    const evidenceRows = await t.run(async (ctx) => {
      return await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
    });
    expect(evidenceRows).toHaveLength(1);
    expect(evidenceRows[0]).toMatchObject({
      attributionCorrectedFromSubjectPersonReferentId:
        seed.originalProfile.personReferentId,
      subjectUserId: seed.correctedUserId,
    });
    expect(evidenceRows[0]?.subjectPersonReferentId).toBeUndefined();

    const rows = await getScopedAggregateRows(t);
    const correctedAggregate = rows.find(
      (row) => row.subjectUserId === seed.correctedUserId,
    );
    expect(correctedAggregate).toMatchObject({
      evidenceCount: 1,
      postCount: 1,
      subjectUserId: seed.correctedUserId,
    });
    expect(correctedAggregate?.subjectPersonReferentId).toBeUndefined();
  });

  test("post attribution correction does not reactivate wrong-context evidence", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedWrongContextAttributionCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    const result = await admin.mutation(
      api.contextExpertise.correctPostAttribution,
      {
        correctedSubjectUserId: seed.correctedUserId,
        entryId: seed.entryId,
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 1,
      correctedEvidenceCount: 0,
      correctedSubjectUserId: seed.correctedUserId,
      previousCreatedByUserId: seed.originalUserId,
      skippedCorrectedEvidenceCount: 1,
    });

    const evidenceRows = await t.run(async (ctx) => {
      return await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
    });
    expect(evidenceRows).toHaveLength(1);
    expect(evidenceRows[0]).toMatchObject({
      correctionKind: "wrongContext",
      subjectUserId: seed.originalUserId,
    });
    await expectScopedAggregateRows(t, 0);
  });
});

describe("Context Expertise quote attribution Person search", () => {
  test("system admin searches bounded Person options for Quote attribution", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedQuoteAttributionPersonSearchRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    const results = await admin.query(
      api.contextExpertise.searchQuoteAttributionPeople,
      {
        limit: 10,
        searchQuery: "Lewis",
      },
    );

    expect(results).toEqual(
      expect.arrayContaining([
        {
          label: "C. S. Lewis",
          referentId: seed.people.csLewis.referentId,
          tagId: seed.people.csLewis.tagId,
          thumbnailUrl: "https://images.example/cs-lewis.jpg",
        },
        {
          label: "Lewis Carroll",
          referentId: seed.people.lewisCarroll.referentId,
          tagId: seed.people.lewisCarroll.tagId,
        },
      ]),
    );
    expect(results).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ referentId: seed.topic.referentId }),
      ]),
    );
  });

  test("search returns no too-short options and honors the requested limit", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedQuoteAttributionPersonSearchRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await expect(
      admin.query(api.contextExpertise.searchQuoteAttributionPeople, {
        searchQuery: "L",
      }),
    ).resolves.toEqual([]);

    const limitedResults = await admin.query(
      api.contextExpertise.searchQuoteAttributionPeople,
      {
        limit: 1,
        searchQuery: "Person",
      },
    );
    expect(limitedResults).toHaveLength(1);
    expect(
      Object.values(seed.people).some(
        (person) => person.referentId === limitedResults[0].referentId,
      ),
    ).toBe(true);
  });

  test("search requires system admin access", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedQuoteAttributionPersonSearchRows);
    const member = t.withIdentity({
      subject: `${seed.memberUserId}|test-session`,
    });

    await expect(
      member.query(api.contextExpertise.searchQuoteAttributionPeople, {
        searchQuery: "Lewis",
      }),
    ).rejects.toThrow("Unauthorized");
  });
});

describe("Context Expertise public figure visibility moderation", () => {
  test("system admin searches, suppresses, and restores Person Global Context Expert visibility", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPublicFigureVisibilityModerationRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    const searchResults = await admin.query(
      api.contextExpertise.searchPublicFigureExpertPeople,
      {
        searchQuery: "Lewis",
      },
    );
    expect(searchResults).toContainEqual({
      label: "Public Figure Lewis",
      referentId: seed.personReferentId,
      tagId: seed.personTagId,
    });

    const defaultStatus = await admin.query(
      api.contextExpertise.getPersonGlobalExpertVisibilityModeration,
      {
        personReferentId: seed.personReferentId,
      },
    );
    expect(defaultStatus).toEqual({
      personLabel: "Public Figure Lewis",
      personReferentId: seed.personReferentId,
      status: "visibleByDefault",
    });

    const initialCounts = await getContextExpertiseDataCounts(t);
    const suppressed = await admin.mutation(
      api.contextExpertise.updatePersonGlobalExpertVisibilityModeration,
      {
        moderationNote: "Misattributed public figure evidence.",
        personReferentId: seed.personReferentId,
        suppressed: true,
      },
    );
    expect(suppressed).toMatchObject({
      moderationNote: "Misattributed public figure evidence.",
      personLabel: "Public Figure Lewis",
      personReferentId: seed.personReferentId,
      status: "suppressed",
      updatedByUserId: seed.adminUserId,
    });
    expect(suppressed.updatedAt).toEqual(expect.any(Number));
    expect(await getContextExpertiseDataCounts(t)).toEqual(initialCounts);
    expect(await getPersonGlobalExpertSuppressionRowCount(t)).toBe(1);

    const restored = await admin.mutation(
      api.contextExpertise.updatePersonGlobalExpertVisibilityModeration,
      {
        personReferentId: seed.personReferentId,
        suppressed: false,
      },
    );
    expect(restored).toEqual({
      personLabel: "Public Figure Lewis",
      personReferentId: seed.personReferentId,
      status: "visibleByDefault",
    });
    expect(await getContextExpertiseDataCounts(t)).toEqual(initialCounts);
    expect(await getPersonGlobalExpertSuppressionRowCount(t)).toBe(0);

    const history = await admin.query(
      api.contextExpertise.listPersonGlobalExpertVisibilityModerationHistory,
      {
        personReferentId: seed.personReferentId,
      },
    );
    expect(history).toHaveLength(2);
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "restored",
          nextStatus: "visibleByDefault",
          personReferentId: seed.personReferentId,
          previousModerationNote: "Misattributed public figure evidence.",
          previousStatus: "suppressed",
          updatedByUserId: seed.adminUserId,
        }),
        expect.objectContaining({
          action: "suppressed",
          moderationNote: "Misattributed public figure evidence.",
          nextStatus: "suppressed",
          personReferentId: seed.personReferentId,
          previousStatus: "visibleByDefault",
          updatedByUserId: seed.adminUserId,
        }),
      ]),
    );
  });

  test("records only meaningful Person Global Context Expert moderation changes", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPublicFigureVisibilityModerationRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await admin.mutation(
      api.contextExpertise.updatePersonGlobalExpertVisibilityModeration,
      {
        moderationNote: "Initial note.",
        personReferentId: seed.personReferentId,
        suppressed: true,
      },
    );
    await admin.mutation(
      api.contextExpertise.updatePersonGlobalExpertVisibilityModeration,
      {
        moderationNote: "Initial note.",
        personReferentId: seed.personReferentId,
        suppressed: true,
      },
    );
    await admin.mutation(
      api.contextExpertise.updatePersonGlobalExpertVisibilityModeration,
      {
        moderationNote: "Updated note.",
        personReferentId: seed.personReferentId,
        suppressed: true,
      },
    );
    await admin.mutation(
      api.contextExpertise.updatePersonGlobalExpertVisibilityModeration,
      {
        personReferentId: seed.personReferentId,
        suppressed: false,
      },
    );
    await admin.mutation(
      api.contextExpertise.updatePersonGlobalExpertVisibilityModeration,
      {
        personReferentId: seed.personReferentId,
        suppressed: false,
      },
    );

    const events = await getPersonGlobalExpertModerationEventRows(t);
    expect(events).toHaveLength(3);
    expect(events.map((event) => event.action).sort()).toEqual([
      "restored",
      "suppressed",
      "suppressionNoteUpdated",
    ]);
    expect(
      events.find((event) => event.action === "suppressionNoteUpdated"),
    ).toMatchObject({
      moderationNote: "Updated note.",
      previousModerationNote: "Initial note.",
      previousStatus: "suppressed",
      nextStatus: "suppressed",
    });
  });

  test("lists bounded Person Global Context Expert moderation history newest first", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPublicFigureVisibilityModerationRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await t.run(async (ctx) => {
      await ctx.db.insert("personContextExpertiseVisibilityModerationEvents", {
        action: "suppressed",
        createdAt: 100,
        moderationNote: "First",
        nextStatus: "suppressed",
        personReferentId: seed.personReferentId,
        previousStatus: "visibleByDefault",
        updatedByUserId: seed.adminUserId,
      });
      await ctx.db.insert("personContextExpertiseVisibilityModerationEvents", {
        action: "restored",
        createdAt: 200,
        nextStatus: "visibleByDefault",
        personReferentId: seed.personReferentId,
        previousModerationNote: "First",
        previousStatus: "suppressed",
        updatedByUserId: seed.adminUserId,
      });
      await ctx.db.insert("personContextExpertiseVisibilityModerationEvents", {
        action: "suppressionNoteUpdated",
        createdAt: 300,
        moderationNote: "Second",
        nextStatus: "suppressed",
        personReferentId: seed.personReferentId,
        previousModerationNote: "First",
        previousStatus: "suppressed",
        updatedByUserId: seed.adminUserId,
      });
    });

    const history = await admin.query(
      api.contextExpertise.listPersonGlobalExpertVisibilityModerationHistory,
      {
        limit: 2,
        personReferentId: seed.personReferentId,
      },
    );

    expect(history).toHaveLength(2);
    expect(history.map((event) => event.action)).toEqual([
      "suppressionNoteUpdated",
      "restored",
    ]);
    expect(history[0]).toMatchObject({
      createdAt: 300,
      eventId: expect.any(String),
      moderationNote: "Second",
      previousModerationNote: "First",
    });
  });

  test("Person Global Context Expert moderation requires system admin access", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPublicFigureVisibilityModerationRows);
    const member = t.withIdentity({ subject: `${seed.memberUserId}|test-session` });

    await expect(
      member.query(api.contextExpertise.getPersonGlobalExpertVisibilityModeration, {
        personReferentId: seed.personReferentId,
      }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      member.mutation(
        api.contextExpertise.updatePersonGlobalExpertVisibilityModeration,
        {
          personReferentId: seed.personReferentId,
          suppressed: true,
        },
      ),
    ).rejects.toThrow("Unauthorized");
    await expect(
      member.query(
        api.contextExpertise.listPersonGlobalExpertVisibilityModerationHistory,
        {
          personReferentId: seed.personReferentId,
        },
      ),
    ).rejects.toThrow("Unauthorized");
  });

  test("Person Global Context Expert moderation rejects non-Person referents", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPublicFigureVisibilityModerationRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await expect(
      admin.query(api.contextExpertise.getPersonGlobalExpertVisibilityModeration, {
        personReferentId: seed.topicReferentId,
      }),
    ).rejects.toThrow("Person not found.");
    await expect(
      admin.mutation(
        api.contextExpertise.updatePersonGlobalExpertVisibilityModeration,
        {
          personReferentId: seed.topicReferentId,
          suppressed: true,
        },
      ),
    ).rejects.toThrow("Person not found.");
    await expect(
      admin.query(
        api.contextExpertise.listPersonGlobalExpertVisibilityModerationHistory,
        {
          personReferentId: seed.topicReferentId,
        },
      ),
    ).rejects.toThrow("Person not found.");
  });
});

describe("Context Expertise quote attribution corrections", () => {
  test("system admin corrects Quote attribution and rebuilds affected Person aggregates", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedQuoteAttributionCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await admin.mutation(api.contextExpertise.rebuildScopedAggregateBatch, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(
      (await getScopedAggregateRows(t)).some(
        (row) => row.subjectPersonReferentId === seed.originalPersonReferentId,
      ),
    ).toBe(true);

    const result = await admin.mutation(
      api.contextExpertise.correctQuoteAttribution,
      {
        entryId: seed.entryId,
        nextQuotedPersonReferentId: seed.correctedPersonReferentId,
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 2,
      correctedEvidenceCount: 1,
      createdEvidenceCount: 0,
      deactivatedEvidenceCount: 0,
      entryId: seed.entryId,
      nextQuotedPersonReferentId: seed.correctedPersonReferentId,
      previousQuotedPersonReferentId: seed.originalPersonReferentId,
      quoteEntryId: seed.quoteEntryId,
      skippedCorrectedEvidenceCount: 0,
    });

    const state = await t.run(async (ctx) => {
      const quoteEntry = await ctx.db.get(seed.quoteEntryId);
      const evidenceRows = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
      return { evidenceRows, quoteEntry };
    });
    expect(state.quoteEntry?.quotedPersonReferentId).toBe(
      seed.correctedPersonReferentId,
    );

    const quoteEvidence = state.evidenceRows.find(
      (evidence) => evidence.evidenceKind === "quoteAttribution",
    );
    expect(quoteEvidence).toMatchObject({
      attributionCorrectedByUserId: seed.adminUserId,
      attributionCorrectedFromSubjectPersonReferentId:
        seed.originalPersonReferentId,
      evidenceKind: "quoteAttribution",
      subjectPersonReferentId: seed.correctedPersonReferentId,
    });
    expect(quoteEvidence?.attributionCorrectedAt).toEqual(expect.any(Number));
    expect(quoteEvidence?.correctionKind).toBeUndefined();

    const postEvidence = state.evidenceRows.find(
      (evidence) => evidence.evidenceKind === "post",
    );
    expect(postEvidence).toMatchObject({
      evidenceKind: "post",
      subjectUserId: seed.posterUserId,
    });
    expect(postEvidence?.attributionCorrectedAt).toBeUndefined();

    const rows = await getScopedAggregateRows(t);
    expect(
      rows.some(
        (row) => row.subjectPersonReferentId === seed.originalPersonReferentId,
      ),
    ).toBe(false);
    const correctedAggregate = rows.find(
      (row) => row.subjectPersonReferentId === seed.correctedPersonReferentId,
    );
    expect(correctedAggregate).toMatchObject({
      evidenceCount: 1,
      feedbackCount: 0,
      postCount: 0,
      topSupportingEntryIds: [seed.entryId],
    });
    const posterAggregate = rows.find(
      (row) => row.subjectUserId === seed.posterUserId,
    );
    expect(posterAggregate).toMatchObject({
      evidenceCount: 1,
      postCount: 1,
      topSupportingEntryIds: [seed.entryId],
    });
  });

  test("system admin clears Quote attribution without deleting the evidence trail", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedQuoteAttributionCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await admin.mutation(api.contextExpertise.rebuildScopedAggregateBatch, {
      paginationOpts: { cursor: null, numItems: 10 },
    });

    const result = await admin.mutation(
      api.contextExpertise.correctQuoteAttribution,
      {
        entryId: seed.entryId,
        nextQuotedPersonReferentId: null,
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 1,
      correctedEvidenceCount: 0,
      createdEvidenceCount: 0,
      deactivatedEvidenceCount: 1,
      previousQuotedPersonReferentId: seed.originalPersonReferentId,
      skippedCorrectedEvidenceCount: 0,
    });
    expect(result).not.toHaveProperty("nextQuotedPersonReferentId");

    const state = await t.run(async (ctx) => {
      const quoteEntry = await ctx.db.get(seed.quoteEntryId);
      const evidenceRows = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
      return { evidenceRows, quoteEntry };
    });
    expect(state.quoteEntry?.quotedPersonReferentId).toBeUndefined();
    const quoteEvidence = state.evidenceRows.find(
      (evidence) => evidence.evidenceKind === "quoteAttribution",
    );
    expect(quoteEvidence).toMatchObject({
      attributionCorrectedByUserId: seed.adminUserId,
      attributionCorrectedFromSubjectPersonReferentId:
        seed.originalPersonReferentId,
      correctionKind: "attribution",
      subjectPersonReferentId: seed.originalPersonReferentId,
    });

    const rows = await getScopedAggregateRows(t);
    expect(
      rows.some(
        (row) => row.subjectPersonReferentId === seed.originalPersonReferentId,
      ),
    ).toBe(false);
    expect(rows.some((row) => row.subjectUserId === seed.posterUserId)).toBe(
      true,
    );
  });

  test("system admin can set a previously cleared Quote attribution again", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedQuoteAttributionCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await admin.mutation(api.contextExpertise.correctQuoteAttribution, {
      entryId: seed.entryId,
      nextQuotedPersonReferentId: null,
    });
    const result = await admin.mutation(
      api.contextExpertise.correctQuoteAttribution,
      {
        entryId: seed.entryId,
        nextQuotedPersonReferentId: seed.originalPersonReferentId,
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 1,
      correctedEvidenceCount: 1,
      createdEvidenceCount: 0,
      deactivatedEvidenceCount: 0,
      nextQuotedPersonReferentId: seed.originalPersonReferentId,
      skippedCorrectedEvidenceCount: 0,
    });

    const evidenceRows = await t.run(async (ctx) => {
      return await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
    });
    const quoteEvidence = evidenceRows.find(
      (evidence) => evidence.evidenceKind === "quoteAttribution",
    );
    expect(quoteEvidence).toMatchObject({
      evidenceKind: "quoteAttribution",
      subjectPersonReferentId: seed.originalPersonReferentId,
    });
    expect(quoteEvidence?.correctionKind).toBeUndefined();

    const rows = await getScopedAggregateRows(t);
    expect(
      rows.some(
        (row) => row.subjectPersonReferentId === seed.originalPersonReferentId,
      ),
    ).toBe(true);
  });

  test("system admin creates missing Quote attribution evidence when correcting", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run((ctx) =>
      seedQuoteAttributionCorrectionRows(ctx, {
        includeQuoteAttributionEvidence: false,
      }),
    );
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    const result = await admin.mutation(
      api.contextExpertise.correctQuoteAttribution,
      {
        entryId: seed.entryId,
        nextQuotedPersonReferentId: seed.correctedPersonReferentId,
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 1,
      correctedEvidenceCount: 0,
      createdEvidenceCount: 1,
      deactivatedEvidenceCount: 0,
      previousQuotedPersonReferentId: seed.originalPersonReferentId,
      skippedCorrectedEvidenceCount: 0,
    });

    const evidenceRows = await t.run(async (ctx) => {
      return await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
    });
    const quoteEvidence = evidenceRows.find(
      (evidence) => evidence.evidenceKind === "quoteAttribution",
    );
    expect(quoteEvidence).toMatchObject({
      evidenceKind: "quoteAttribution",
      subjectPersonReferentId: seed.correctedPersonReferentId,
    });

    const rows = await getScopedAggregateRows(t);
    expect(
      rows.some(
        (row) => row.subjectPersonReferentId === seed.correctedPersonReferentId,
      ),
    ).toBe(true);
  });

  test("Quote attribution correction does not reactivate wrong-context evidence", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run((ctx) =>
      seedQuoteAttributionCorrectionRows(ctx, {
        quoteCorrectionKind: "wrongContext",
      }),
    );
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    const result = await admin.mutation(
      api.contextExpertise.correctQuoteAttribution,
      {
        entryId: seed.entryId,
        nextQuotedPersonReferentId: seed.correctedPersonReferentId,
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 1,
      correctedEvidenceCount: 0,
      createdEvidenceCount: 0,
      deactivatedEvidenceCount: 0,
      skippedCorrectedEvidenceCount: 1,
    });

    const state = await t.run(async (ctx) => {
      const quoteEntry = await ctx.db.get(seed.quoteEntryId);
      const evidenceRows = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
      return { evidenceRows, quoteEntry };
    });
    expect(state.quoteEntry?.quotedPersonReferentId).toBe(
      seed.correctedPersonReferentId,
    );
    const quoteEvidence = state.evidenceRows.find(
      (evidence) => evidence.evidenceKind === "quoteAttribution",
    );
    expect(quoteEvidence).toMatchObject({
      correctionKind: "wrongContext",
      subjectPersonReferentId: seed.originalPersonReferentId,
    });

    const rows = await getScopedAggregateRows(t);
    expect(
      rows.some(
        (row) => row.subjectPersonReferentId === seed.correctedPersonReferentId,
      ),
    ).toBe(false);
    expect(
      rows.some(
        (row) => row.subjectPersonReferentId === seed.originalPersonReferentId,
      ),
    ).toBe(false);
  });
});

describe("Context Expertise visibility corrections", () => {
  test("system admin moves Person-subject quote attribution evidence to organization scope", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPersonQuoteVisibilityCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await admin.mutation(api.contextExpertise.rebuildScopedAggregateBatch, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(
      (await getScopedAggregateRows(t)).every(
        (row) => row.audienceScopeKind === "public",
      ),
    ).toBe(true);

    const result = await admin.mutation(
      api.contextExpertise.correctEntryVisibilityScope,
      {
        entryId: seed.entryId,
        visibilityKind: "organization",
        visibilityTargetKey: seed.organizationReferentId,
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 4,
      correctedEvidenceCount: 2,
      nonEffectiveEvidenceCount: 0,
    });

    const evidenceRows = await t.run(async (ctx) => {
      return await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
    });
    expect(evidenceRows).toHaveLength(2);
    for (const evidence of evidenceRows) {
      expect(evidence).toMatchObject({
        visibilityCorrectedFromKind: "public",
        visibilityKind: "organization",
        visibilityTargetKey: seed.organizationReferentId,
      });
    }

    const rows = await getScopedAggregateRows(t);
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.audienceScopeKind === "public")).toBe(false);
    const personAggregate = rows.find(
      (row) => row.subjectPersonReferentId === seed.quotedPersonReferentId,
    );
    expect(personAggregate).toMatchObject({
      audienceScopeKind: "organization",
      audienceScopeTargetKey: seed.organizationReferentId,
      evidenceCount: 1,
      feedbackCount: 0,
      postCount: 0,
      subjectPersonReferentId: seed.quotedPersonReferentId,
      topSupportingEntryIds: [seed.entryId],
    });
    expect(personAggregate).not.toHaveProperty("subjectUserId");
  });

  test("system admin moves public post and feedback evidence to organization scope", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPublicToOrganizationVisibilityCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await admin.mutation(api.contextExpertise.rebuildScopedAggregateBatch, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(
      (await getScopedAggregateRows(t)).every(
        (row) => row.audienceScopeKind === "public",
      ),
    ).toBe(true);

    const result = await admin.mutation(
      api.contextExpertise.correctEntryVisibilityScope,
      {
        entryId: seed.entryId,
        visibilityKind: "organization",
        visibilityTargetKey: seed.organizationReferentId,
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 4,
      correctedEvidenceCount: 2,
      entryId: seed.entryId,
      nextVisibilityKind: "organization",
      nextVisibilityTargetKey: seed.organizationReferentId,
      nonEffectiveEvidenceCount: 0,
      previousVisibilityKind: "public",
      previousVisibilityTargetKey: "public",
    });

    const state = await t.run(async (ctx) => {
      const entry = await ctx.db.get(seed.entryId);
      const evidenceRows = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
      return { entry, evidenceRows };
    });
    expect(state.entry).toMatchObject({
      discoverabilityKind: "public",
      discoverabilityTargetKey: "public",
      visibilityKind: "organization",
      visibilityTargetKey: seed.organizationReferentId,
    });
    expect(state.evidenceRows).toHaveLength(2);
    for (const evidence of state.evidenceRows) {
      expect(evidence).toMatchObject({
        visibilityCorrectedByUserId: seed.adminUserId,
        visibilityCorrectedFromKind: "public",
        visibilityCorrectedFromTargetKey: "public",
        visibilityKind: "organization",
        visibilityTargetKey: seed.organizationReferentId,
      });
      expect(evidence.visibilityCorrectedAt).toEqual(expect.any(Number));
    }

    const rows = await getScopedAggregateRows(t);
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.audienceScopeKind === "public")).toBe(false);

    const expertAggregate = rows.find(
      (row) => row.subjectUserId === seed.expertUserId,
    );
    expect(expertAggregate).toMatchObject({
      audienceScopeKind: "organization",
      audienceScopeTargetKey: seed.organizationReferentId,
      evidenceCount: 1,
      feedbackCount: 0,
      postCount: 1,
      topSupportingEntryIds: [seed.entryId],
    });

    const reviewerAggregate = rows.find(
      (row) => row.subjectUserId === seed.reviewerUserId,
    );
    expect(reviewerAggregate).toMatchObject({
      audienceScopeKind: "organization",
      audienceScopeTargetKey: seed.organizationReferentId,
      evidenceCount: 1,
      feedbackCount: 1,
      postCount: 0,
      topSupportingEntryIds: [seed.entryId],
    });
  });

  test("system admin moves organization-scoped evidence back to public scope", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedOrganizationToPublicVisibilityCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await admin.mutation(api.contextExpertise.rebuildScopedAggregateBatch, {
      paginationOpts: { cursor: null, numItems: 10 },
    });

    const result = await admin.mutation(
      api.contextExpertise.correctEntryVisibilityScope,
      {
        entryId: seed.entryId,
        visibilityKind: "public",
        visibilityTargetKey: "ignored-target",
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 2,
      correctedEvidenceCount: 1,
      nextVisibilityKind: "public",
      nextVisibilityTargetKey: "public",
      previousVisibilityKind: "organization",
      previousVisibilityTargetKey: seed.organizationReferentId,
    });

    const state = await t.run(async (ctx) => {
      const entry = await ctx.db.get(seed.entryId);
      const evidenceRows = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
      return { entry, evidenceRows };
    });
    expect(state.entry).toMatchObject({
      discoverabilityKind: "organization",
      discoverabilityTargetKey: seed.organizationReferentId,
      visibilityKind: "public",
      visibilityTargetKey: "public",
    });
    expect(state.evidenceRows[0]).toMatchObject({
      visibilityCorrectedFromKind: "organization",
      visibilityCorrectedFromTargetKey: seed.organizationReferentId,
      visibilityKind: "public",
      visibilityTargetKey: "public",
    });

    const rows = await getScopedAggregateRows(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      audienceScopeKind: "public",
      audienceScopeTargetKey: "public",
      evidenceCount: 1,
      postCount: 1,
      subjectUserId: seed.expertUserId,
    });
  });

  test("visibility correction does not reactivate wrong-context evidence", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedWrongContextVisibilityCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    const result = await admin.mutation(
      api.contextExpertise.correctEntryVisibilityScope,
      {
        entryId: seed.entryId,
        visibilityKind: "organization",
        visibilityTargetKey: seed.organizationReferentId,
      },
    );
    expect(result).toMatchObject({
      affectedAggregateGroupCount: 2,
      correctedEvidenceCount: 1,
      nonEffectiveEvidenceCount: 1,
      previousVisibilityKind: "public",
      previousVisibilityTargetKey: "public",
    });

    const evidenceRows = await t.run(async (ctx) => {
      return await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
    });
    expect(evidenceRows).toHaveLength(1);
    expect(evidenceRows[0]).toMatchObject({
      correctionKind: "wrongContext",
      visibilityCorrectedFromKind: "public",
      visibilityKind: "organization",
      visibilityTargetKey: seed.organizationReferentId,
    });
    await expectScopedAggregateRows(t, 0);
  });

  test("wrong-context feedback deactivates stale Person quote attribution evidence", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedPersonQuoteWrongContextCorrectionRows);
    const admin = t.withIdentity({ subject: `${seed.adminUserId}|test-session` });

    await admin.mutation(api.contextExpertise.rebuildScopedAggregateBatch, {
      paginationOpts: { cursor: null, numItems: 10 },
    });
    expect(
      (await getScopedAggregateRows(t)).some(
        (row) => row.subjectPersonReferentId === seed.quotedPersonReferentId,
      ),
    ).toBe(true);

    await admin.mutation(api.humanWeightFeedback.record, {
      entryId: seed.entryId,
      feedbackKind: "wrongContext",
    });

    const evidenceRows = await t.run(async (ctx) => {
      return await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", seed.entryId),
        )
        .collect();
    });
    const postEvidence = evidenceRows.find(
      (evidence) => evidence.evidenceKind === "post",
    );
    const quoteAttributionEvidence = evidenceRows.find(
      (evidence) => evidence.evidenceKind === "quoteAttribution",
    );
    expect(postEvidence).toMatchObject({
      correctionKind: "wrongContext",
      subjectUserId: seed.posterUserId,
    });
    expect(quoteAttributionEvidence).toMatchObject({
      correctionKind: "wrongContext",
      evidenceKind: "quoteAttribution",
      subjectPersonReferentId: seed.quotedPersonReferentId,
    });

    const rows = await getScopedAggregateRows(t);
    expect(
      rows.some(
        (row) => row.subjectPersonReferentId === seed.quotedPersonReferentId,
      ),
    ).toBe(false);
    expect(rows.some((row) => row.subjectUserId === seed.posterUserId)).toBe(
      false,
    );
    expect(
      rows.some(
        (row) =>
          row.subjectUserId === seed.adminUserId && row.feedbackCount === 1,
      ),
    ).toBe(true);
  });
});

async function seedPublicToOrganizationVisibilityCorrectionRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "visibility-correction-admin@example.com",
    name: "Visibility Correction Admin",
    systemRole: "systemAdmin",
  });
  const expertUserId = await insertUser(ctx, {
    email: "visibility-correction-expert@example.com",
    name: "Visibility Correction Expert",
  });
  const reviewerUserId = await insertUser(ctx, {
    email: "visibility-correction-reviewer@example.com",
    name: "Visibility Correction Reviewer",
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "visibility-correction-context",
    knowledgeType: "topic",
    label: "Visibility Correction Context",
  });
  const organization = await insertOrganization(ctx, {
    createdByUserId: adminUserId,
    name: "Visibility Correction School",
  });
  const entryId = await insertEntry(ctx, {
    contextTagIds: [contextTag.tagId],
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: expertUserId,
    humanWeight: 82,
    knowledgeType: "lesson",
    previewText: "Public evidence that should become organization-scoped.",
    title: "Public Visibility Correction Evidence",
    updatedAt: BASE_TIME + 1,
  });
  const feedbackId = await ctx.db.insert("humanWeightFeedback", {
    entryId,
    feedbackKind: "used",
    userId: reviewerUserId,
    createdAt: BASE_TIME + 2,
    updatedAt: BASE_TIME + 2,
  });
  const contextKey = getContextKey([contextTag.tagId]);

  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds: [contextTag.tagId],
    entryId,
    evidenceKind: "post",
    subjectUserId: expertUserId,
    updatedAt: BASE_TIME + 1,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds: [contextTag.tagId],
    entryId,
    evidenceKind: "feedback",
    feedbackId,
    subjectUserId: reviewerUserId,
    updatedAt: BASE_TIME + 2,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });

  return {
    adminUserId,
    entryId,
    expertUserId,
    organizationReferentId: organization.organizationReferentId,
    reviewerUserId,
  };
}

async function seedOrganizationToPublicVisibilityCorrectionRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "organization-visibility-admin@example.com",
    name: "Organization Visibility Admin",
    systemRole: "systemAdmin",
  });
  const expertUserId = await insertUser(ctx, {
    email: "organization-visibility-expert@example.com",
    name: "Organization Visibility Expert",
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "organization-visibility-context",
    knowledgeType: "topic",
    label: "Organization Visibility Context",
  });
  const organization = await insertOrganization(ctx, {
    createdByUserId: adminUserId,
    name: "Organization Visibility School",
  });
  const entryId = await insertEntry(ctx, {
    contextTagIds: [contextTag.tagId],
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: expertUserId,
    humanWeight: 82,
    knowledgeType: "words",
    previewText: "Organization evidence that should become public.",
    title: "Organization Visibility Correction Evidence",
    updatedAt: BASE_TIME + 1,
    visibilityKind: "organization",
    visibilityTargetKey: organization.organizationReferentId,
  });

  await insertContextExpertiseEvidence(ctx, {
    contextKey: getContextKey([contextTag.tagId]),
    contextTagIds: [contextTag.tagId],
    entryId,
    evidenceKind: "post",
    subjectUserId: expertUserId,
    updatedAt: BASE_TIME + 1,
    visibilityKind: "organization",
    visibilityTargetKey: organization.organizationReferentId,
  });

  return {
    adminUserId,
    entryId,
    expertUserId,
    organizationReferentId: organization.organizationReferentId,
  };
}

async function seedWrongContextVisibilityCorrectionRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "wrong-context-visibility-admin@example.com",
    name: "Wrong Context Visibility Admin",
    systemRole: "systemAdmin",
  });
  const expertUserId = await insertUser(ctx, {
    email: "wrong-context-visibility-expert@example.com",
    name: "Wrong Context Visibility Expert",
  });
  const reviewerUserId = await insertUser(ctx, {
    email: "wrong-context-visibility-reviewer@example.com",
    name: "Wrong Context Visibility Reviewer",
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "wrong-context-visibility",
    knowledgeType: "topic",
    label: "Wrong Context Visibility",
  });
  const organization = await insertOrganization(ctx, {
    createdByUserId: adminUserId,
    name: "Wrong Context Visibility School",
  });
  const entryId = await insertEntry(ctx, {
    contextTagIds: [contextTag.tagId],
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: expertUserId,
    humanWeight: 82,
    knowledgeType: "words",
    previewText: "Wrong-context evidence that should stay non-effective.",
    title: "Wrong Context Visibility Evidence",
    updatedAt: BASE_TIME + 1,
  });
  const feedbackId = await ctx.db.insert("humanWeightFeedback", {
    entryId,
    feedbackKind: "wrongContext",
    userId: reviewerUserId,
    createdAt: BASE_TIME + 2,
    updatedAt: BASE_TIME + 2,
  });
  const contextKey = getContextKey([contextTag.tagId]);

  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds: [contextTag.tagId],
    correctionKind: "wrongContext",
    correctedAt: BASE_TIME + 2,
    correctedByFeedbackId: feedbackId,
    entryId,
    evidenceKind: "post",
    subjectUserId: expertUserId,
    updatedAt: BASE_TIME + 2,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await ctx.db.insert("contextExpertiseAggregates", {
    audienceScopeKind: "public",
    audienceScopeTargetKey: "public",
    contextExpertiseMaturity: 20,
    contextExpertiseScore: 94,
    contextKey,
    contextTagIds: [contextTag.tagId],
    createdAt: BASE_TIME + 2,
    evidenceCount: 1,
    feedbackCount: 0,
    latestEvidenceAt: BASE_TIME + 2,
    postCount: 1,
    subjectUserId: expertUserId,
    topSupportingEntryIds: [entryId],
    updatedAt: BASE_TIME + 2,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });

  return {
    adminUserId,
    entryId,
    organizationReferentId: organization.organizationReferentId,
  };
}

async function seedPersonQuoteVisibilityCorrectionRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "person-quote-visibility-admin@example.com",
    name: "Person Quote Visibility Admin",
    systemRole: "systemAdmin",
  });
  const posterUserId = await insertUser(ctx, {
    email: "person-quote-visibility-poster@example.com",
    name: "Person Quote Visibility Poster",
  });
  const organization = await insertOrganization(ctx, {
    createdByUserId: adminUserId,
    name: "Person Quote Visibility School",
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "person-quote-visibility-context",
    knowledgeType: "topic",
    label: "Person Quote Visibility Context",
  });
  const quotedPerson = await insertTag(ctx, {
    canonicalKey: "person-quote-visibility-lewis",
    knowledgeType: "person",
    label: "Person Quote Visibility Lewis",
  });
  const contextTagIds = [contextTag.tagId, quotedPerson.tagId];
  const contextKey = getContextKey(contextTagIds);
  const entryId = await insertEntry(ctx, {
    contextTagIds,
    contextPreviewTagLabels: [contextTag.label, quotedPerson.label],
    createdByUserId: posterUserId,
    humanWeight: 82,
    knowledgeType: "quote",
    previewText: "A quote whose Person attribution should move scopes.",
    title: "Person Quote Visibility Evidence",
    updatedAt: BASE_TIME + 1,
  });
  await ctx.db.insert("quoteEntries", {
    entryId,
    quotedPersonReferentId: quotedPerson.referentId,
    sourceText: "Courage is every virtue at the testing point.",
  });

  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds,
    entryId,
    evidenceKind: "post",
    subjectUserId: posterUserId,
    updatedAt: BASE_TIME + 1,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds,
    entryId,
    evidenceKind: "quoteAttribution",
    subjectPersonReferentId: quotedPerson.referentId,
    updatedAt: BASE_TIME + 2,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });

  return {
    adminUserId,
    entryId,
    organizationReferentId: organization.organizationReferentId,
    posterUserId,
    quotedPersonReferentId: quotedPerson.referentId,
  };
}

async function seedPersonQuoteWrongContextCorrectionRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "person-quote-wrong-context-admin@example.com",
    name: "Person Quote Wrong Context Admin",
    systemRole: "systemAdmin",
  });
  const posterUserId = await insertUser(ctx, {
    email: "person-quote-wrong-context-poster@example.com",
    name: "Person Quote Wrong Context Poster",
  });
  await insertOrganization(ctx, {
    createdByUserId: adminUserId,
    name: "Person Quote Wrong Context School",
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "person-quote-wrong-context",
    knowledgeType: "topic",
    label: "Person Quote Wrong Context",
  });
  const quotedPerson = await insertTag(ctx, {
    canonicalKey: "person-quote-wrong-context-lewis",
    knowledgeType: "person",
    label: "Person Quote Wrong Context Lewis",
  });
  const contextTagIds = [contextTag.tagId, quotedPerson.tagId];
  const contextKey = getContextKey(contextTagIds);
  const entryId = await insertEntry(ctx, {
    contextTagIds,
    contextPreviewTagLabels: [contextTag.label, quotedPerson.label],
    createdByUserId: posterUserId,
    humanWeight: 82,
    knowledgeType: "quote",
    previewText: "A quote whose context attribution is wrong.",
    title: "Person Quote Wrong Context Evidence",
    updatedAt: BASE_TIME + 1,
  });
  await ctx.db.insert("quoteEntries", {
    entryId,
    quotedPersonReferentId: quotedPerson.referentId,
    sourceText: "Courage is every virtue at the testing point.",
  });

  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds,
    entryId,
    evidenceKind: "post",
    subjectUserId: posterUserId,
    updatedAt: BASE_TIME + 1,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds,
    entryId,
    evidenceKind: "quoteAttribution",
    subjectPersonReferentId: quotedPerson.referentId,
    updatedAt: BASE_TIME + 2,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });

  return {
    adminUserId,
    entryId,
    posterUserId,
    quotedPersonReferentId: quotedPerson.referentId,
  };
}

async function seedQuoteAttributionPersonSearchRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "system-admin@example.com",
    name: "System Admin",
    systemRole: "systemAdmin",
  });
  const memberUserId = await insertUser(ctx, {
    email: "member@example.com",
    name: "Member",
  });
  const csLewis = await insertTag(ctx, {
    canonicalKey: "search-c-s-lewis",
    knowledgeType: "person",
    label: "C. S. Lewis",
  });
  await insertThumbnailForTag(
    ctx,
    csLewis,
    "https://images.example/cs-lewis.jpg",
  );
  const lewisCarroll = await insertTag(ctx, {
    canonicalKey: "search-lewis-carroll",
    knowledgeType: "person",
    label: "Lewis Carroll",
  });
  const otherPerson = await insertTag(ctx, {
    canonicalKey: "search-other-person",
    knowledgeType: "person",
    label: "Searchable Person",
  });
  const topic = await insertTag(ctx, {
    canonicalKey: "search-lewis-topic",
    knowledgeType: "topic",
    label: "Lewis Studies",
  });

  return {
    adminUserId,
    memberUserId,
    people: {
      csLewis,
      lewisCarroll,
      otherPerson,
    },
    topic,
  };
}

async function seedPublicFigureVisibilityModerationRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "public-figure-admin@example.com",
    name: "Public Figure Admin",
    systemRole: "systemAdmin",
  });
  const memberUserId = await insertUser(ctx, {
    email: "public-figure-member@example.com",
    name: "Public Figure Member",
  });
  const person = await insertTag(ctx, {
    canonicalKey: "public-figure-lewis",
    knowledgeType: "person",
    label: "Public Figure Lewis",
  });
  const topic = await insertTag(ctx, {
    canonicalKey: "public-figure-moderation-topic",
    knowledgeType: "topic",
    label: "Public Figure Moderation Topic",
  });
  const entryId = await insertEntry(ctx, {
    contextPreviewTagLabels: [topic.label],
    contextTagIds: [topic.tagId],
    createdByUserId: adminUserId,
    humanWeight: 88,
    knowledgeType: "quote",
    previewText: "A public figure quote that keeps its evidence when hidden.",
    title: "Public Figure Evidence Entry",
    updatedAt: BASE_TIME + 1,
  });
  const contextKey = getContextKey([topic.tagId]);

  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds: [topic.tagId],
    entryId,
    evidenceKind: "quoteAttribution",
    subjectPersonReferentId: person.referentId,
    updatedAt: BASE_TIME + 1,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await insertContextExpertiseAggregate(ctx, {
    contextExpertiseMaturity: 20,
    contextExpertiseScore: 88,
    contextTagIds: [topic.tagId],
    evidenceCount: 1,
    feedbackCount: 0,
    latestEvidenceAt: BASE_TIME + 1,
    postCount: 0,
    subjectPersonReferentId: person.referentId,
    topSupportingEntryIds: [entryId],
  });

  return {
    adminUserId,
    memberUserId,
    personReferentId: person.referentId,
    personTagId: person.tagId,
    topicReferentId: topic.referentId,
  };
}

async function seedQuoteAttributionCorrectionRows(
  ctx: MutationCtx,
  options: {
    includeQuoteAttributionEvidence?: boolean;
    quoteCorrectionKind?: Doc<"contextExpertiseEvidence">["correctionKind"];
  } = {},
) {
  const adminUserId = await insertUser(ctx, {
    email: "quote-attribution-correction-admin@example.com",
    name: "Quote Attribution Correction Admin",
    systemRole: "systemAdmin",
  });
  const posterUserId = await insertUser(ctx, {
    email: "quote-attribution-correction-poster@example.com",
    name: "Quote Attribution Correction Poster",
  });
  await insertOrganization(ctx, {
    createdByUserId: adminUserId,
    name: "Quote Attribution Correction School",
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "quote-attribution-correction-context",
    knowledgeType: "topic",
    label: "Quote Attribution Correction Context",
  });
  const originalPerson = await insertTag(ctx, {
    canonicalKey: "quote-attribution-correction-original",
    knowledgeType: "person",
    label: "Quote Attribution Original Person",
  });
  const correctedPerson = await insertTag(ctx, {
    canonicalKey: "quote-attribution-correction-corrected",
    knowledgeType: "person",
    label: "Quote Attribution Corrected Person",
  });
  const contextTagIds = [contextTag.tagId];
  const contextKey = getContextKey(contextTagIds);
  const entryId = await insertEntry(ctx, {
    contextTagIds,
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: posterUserId,
    humanWeight: 86,
    knowledgeType: "quote",
    previewText: "A quote whose quoted Person attribution needs correction.",
    title: "Quote Attribution Correction Entry",
    updatedAt: BASE_TIME + 1,
  });
  const quoteEntryId = await ctx.db.insert("quoteEntries", {
    entryId,
    quotedPersonReferentId: originalPerson.referentId,
    sourceText: "A corrected attribution is still an attribution.",
  });

  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds,
    entryId,
    evidenceKind: "post",
    subjectUserId: posterUserId,
    updatedAt: BASE_TIME + 1,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  if (options.includeQuoteAttributionEvidence !== false) {
    await insertContextExpertiseEvidence(ctx, {
      contextKey,
      contextTagIds,
      ...(options.quoteCorrectionKind === undefined
        ? {}
        : { correctionKind: options.quoteCorrectionKind }),
      entryId,
      evidenceKind: "quoteAttribution",
      subjectPersonReferentId: originalPerson.referentId,
      updatedAt: BASE_TIME + 2,
      visibilityKind: "public",
      visibilityTargetKey: "public",
    });
  }

  return {
    adminUserId,
    correctedPersonReferentId: correctedPerson.referentId,
    entryId,
    originalPersonReferentId: originalPerson.referentId,
    posterUserId,
    quoteEntryId,
  };
}

async function seedQuoteAttributionBackfillRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "quote-attribution-backfill-admin@example.com",
    name: "Quote Attribution Backfill Admin",
    systemRole: "systemAdmin",
  });
  const posterUserId = await insertUser(ctx, {
    email: "quote-attribution-backfill-poster@example.com",
    name: "Quote Attribution Backfill Poster",
  });
  await insertOrganization(ctx, {
    createdByUserId: adminUserId,
    name: "Quote Attribution Backfill School",
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "quote-attribution-backfill-context",
    knowledgeType: "topic",
    label: "Quote Attribution Backfill Context",
  });
  const quotedPerson = await insertTag(ctx, {
    canonicalKey: "quote-attribution-backfill-augustine",
    knowledgeType: "person",
    label: "Quote Attribution Backfill Augustine",
  });
  const contextTagIds = [contextTag.tagId];
  const contextKey = getContextKey(contextTagIds);
  const missingEvidenceEntryId = await insertEntry(ctx, {
    contextTagIds,
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: posterUserId,
    humanWeight: 82,
    knowledgeType: "quote",
    previewText: "An attributed quote that needs quoteAttribution evidence.",
    title: "Quote Attribution Backfill Missing Evidence",
    updatedAt: BASE_TIME + 1,
  });
  await ctx.db.insert("quoteEntries", {
    entryId: missingEvidenceEntryId,
    quotedPersonReferentId: quotedPerson.referentId,
    sourceText: "Love, and do what you will.",
  });

  const existingEvidenceEntryId = await insertEntry(ctx, {
    contextTagIds,
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: posterUserId,
    humanWeight: 90,
    knowledgeType: "quote",
    previewText: "An attributed quote that already has quoteAttribution evidence.",
    title: "Quote Attribution Backfill Existing Evidence",
    updatedAt: BASE_TIME + 2,
  });
  await ctx.db.insert("quoteEntries", {
    entryId: existingEvidenceEntryId,
    quotedPersonReferentId: quotedPerson.referentId,
    sourceText: "The world is a book.",
  });
  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds,
    entryId: existingEvidenceEntryId,
    evidenceKind: "quoteAttribution",
    subjectPersonReferentId: quotedPerson.referentId,
    updatedAt: BASE_TIME + 2,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });

  const unattributedEntryId = await insertEntry(ctx, {
    contextTagIds,
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: posterUserId,
    humanWeight: 70,
    knowledgeType: "quote",
    previewText: "A Quote row with no quoted Person should be skipped.",
    title: "Quote Attribution Backfill Unattributed",
    updatedAt: BASE_TIME + 3,
  });
  await ctx.db.insert("quoteEntries", {
    entryId: unattributedEntryId,
    sourceText: "Anonymous quote.",
  });

  const noContextEntryId = await insertEntry(ctx, {
    contextTagIds: [],
    contextPreviewTagLabels: [],
    createdByUserId: posterUserId,
    humanWeight: 70,
    knowledgeType: "quote",
    previewText: "An attributed Quote row with no context tags should be skipped.",
    title: "Quote Attribution Backfill No Context",
    updatedAt: BASE_TIME + 4,
  });
  await ctx.db.insert("quoteEntries", {
    entryId: noContextEntryId,
    quotedPersonReferentId: quotedPerson.referentId,
    sourceText: "No context quote.",
  });

  const nonQuoteEntryId = await insertEntry(ctx, {
    contextTagIds,
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: posterUserId,
    humanWeight: 70,
    knowledgeType: "words",
    previewText: "A stale Quote row pointing at a non-Quote entry should be skipped.",
    title: "Quote Attribution Backfill Non Quote",
    updatedAt: BASE_TIME + 5,
  });
  await ctx.db.insert("quoteEntries", {
    entryId: nonQuoteEntryId,
    quotedPersonReferentId: quotedPerson.referentId,
    sourceText: "Stale quote row.",
  });

  return {
    adminUserId,
    missingEvidenceEntryId,
    quotedPersonReferentId: quotedPerson.referentId,
  };
}

async function seedScopedAggregateMigrationRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "expertise-migration-admin@example.com",
    name: "Expertise Migration Admin",
    systemRole: "systemAdmin",
  });
  const expertUserId = await insertUser(ctx, {
    email: "expertise-migration-expert@example.com",
    name: "Expertise Migration Expert",
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "context-expertise-migration",
    knowledgeType: "topic",
    label: "Context Expertise Migration",
  });
  const organization = await insertOrganization(ctx, {
    createdByUserId: adminUserId,
    name: "Scoped Migration School",
  });
  const publicEntryId = await insertEntry(ctx, {
    contextTagIds: [contextTag.tagId],
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: expertUserId,
    humanWeight: 82,
    knowledgeType: "words",
    previewText: "Public evidence for scoped aggregate migration.",
    title: "Public Scoped Expertise",
    updatedAt: BASE_TIME + 1,
  });
  const organizationEntryId = await insertEntry(ctx, {
    contextTagIds: [contextTag.tagId],
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: expertUserId,
    humanWeight: 90,
    knowledgeType: "lesson",
    previewText: "Organization evidence for scoped aggregate migration.",
    title: "Organization Scoped Expertise",
    updatedAt: BASE_TIME + 2,
    visibilityKind: "organization",
    visibilityTargetKey: organization.organizationReferentId,
  });
  const contextKey = getContextKey([contextTag.tagId]);

  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds: [contextTag.tagId],
    entryId: publicEntryId,
    evidenceKind: "post",
    subjectUserId: expertUserId,
    updatedAt: BASE_TIME + 1,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds: [contextTag.tagId],
    entryId: organizationEntryId,
    evidenceKind: "post",
    subjectUserId: expertUserId,
    updatedAt: BASE_TIME + 2,
    visibilityKind: "organization",
    visibilityTargetKey: organization.organizationReferentId,
  });
  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds: [contextTag.tagId],
    entryId: organizationEntryId,
    evidenceKind: "feedback",
    subjectUserId: expertUserId,
    updatedAt: BASE_TIME + 3,
    visibilityKind: "organization",
    visibilityTargetKey: organization.organizationReferentId,
  });

  return {
    adminUserId,
    entries: {
      organization: organizationEntryId,
      public: publicEntryId,
    },
    expertUserId,
    organizationReferentId: organization.organizationReferentId,
  };
}

async function seedPostAttributionCorrectionRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "post-attribution-admin@example.com",
    name: "Post Attribution Admin",
    systemRole: "systemAdmin",
  });
  const originalUserId = await insertUser(ctx, {
    email: "post-attribution-original@example.com",
    name: "Original Poster",
  });
  const correctedUserId = await insertUser(ctx, {
    email: "post-attribution-corrected@example.com",
    name: "Corrected Poster",
  });
  const reviewerUserId = await insertUser(ctx, {
    email: "post-attribution-reviewer@example.com",
    name: "Post Attribution Reviewer",
  });
  const originalProfile = await insertUserProfile(ctx, {
    canonicalKey: "original-poster-person",
    name: "Original Poster Person",
    userId: originalUserId,
  });
  const correctedProfile = await insertUserProfile(ctx, {
    canonicalKey: "corrected-poster-person",
    name: "Corrected Poster Person",
    userId: correctedUserId,
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "post-attribution-context",
    knowledgeType: "topic",
    label: "Post Attribution Context",
  });
  const entryId = await insertEntry(ctx, {
    contextTagIds: [contextTag.tagId],
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: originalUserId,
    humanWeight: 82,
    knowledgeType: "words",
    previewText: "Post evidence that needs attribution correction.",
    title: "Post Attribution Evidence",
    updatedAt: BASE_TIME + 1,
  });
  const feedbackId = await ctx.db.insert("humanWeightFeedback", {
    entryId,
    feedbackKind: "used",
    userId: reviewerUserId,
    createdAt: BASE_TIME + 2,
    updatedAt: BASE_TIME + 2,
  });
  const contextKey = getContextKey([contextTag.tagId]);

  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds: [contextTag.tagId],
    entryId,
    evidenceKind: "post",
    subjectPersonReferentId: originalProfile.personReferentId,
    subjectUserId: originalUserId,
    updatedAt: BASE_TIME + 1,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds: [contextTag.tagId],
    entryId,
    evidenceKind: "feedback",
    feedbackId,
    subjectUserId: reviewerUserId,
    updatedAt: BASE_TIME + 2,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });

  return {
    adminUserId,
    correctedProfile,
    correctedUserId,
    entryId,
    feedbackId,
    originalProfile,
    originalUserId,
    reviewerUserId,
  };
}

async function seedPostAttributionNoProfileCorrectionRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "post-attribution-no-profile-admin@example.com",
    name: "No Profile Attribution Admin",
    systemRole: "systemAdmin",
  });
  const originalUserId = await insertUser(ctx, {
    email: "post-attribution-no-profile-original@example.com",
    name: "No Profile Original Poster",
  });
  const correctedUserId = await insertUser(ctx, {
    email: "post-attribution-no-profile-corrected@example.com",
    name: "No Profile Corrected Poster",
  });
  const originalProfile = await insertUserProfile(ctx, {
    canonicalKey: "no-profile-original-poster-person",
    name: "No Profile Original Poster Person",
    userId: originalUserId,
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "post-attribution-no-profile-context",
    knowledgeType: "topic",
    label: "Post Attribution No Profile Context",
  });
  const entryId = await insertEntry(ctx, {
    contextTagIds: [contextTag.tagId],
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: originalUserId,
    humanWeight: 82,
    knowledgeType: "words",
    previewText: "Post evidence corrected to a user without a profile.",
    title: "Post Attribution No Profile Evidence",
    updatedAt: BASE_TIME + 1,
  });

  await insertContextExpertiseEvidence(ctx, {
    contextKey: getContextKey([contextTag.tagId]),
    contextTagIds: [contextTag.tagId],
    entryId,
    evidenceKind: "post",
    subjectPersonReferentId: originalProfile.personReferentId,
    subjectUserId: originalUserId,
    updatedAt: BASE_TIME + 1,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });

  return {
    adminUserId,
    correctedUserId,
    entryId,
    originalProfile,
  };
}

async function seedWrongContextAttributionCorrectionRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "wrong-context-attribution-admin@example.com",
    name: "Wrong Context Attribution Admin",
    systemRole: "systemAdmin",
  });
  const originalUserId = await insertUser(ctx, {
    email: "wrong-context-attribution-original@example.com",
    name: "Wrong Context Original Poster",
  });
  const correctedUserId = await insertUser(ctx, {
    email: "wrong-context-attribution-corrected@example.com",
    name: "Wrong Context Corrected Poster",
  });
  const reviewerUserId = await insertUser(ctx, {
    email: "wrong-context-attribution-reviewer@example.com",
    name: "Wrong Context Reviewer",
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "wrong-context-attribution",
    knowledgeType: "topic",
    label: "Wrong Context Attribution",
  });
  const entryId = await insertEntry(ctx, {
    contextTagIds: [contextTag.tagId],
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: originalUserId,
    humanWeight: 82,
    knowledgeType: "words",
    previewText: "Corrected wrong-context evidence.",
    title: "Wrong Context Attribution Evidence",
    updatedAt: BASE_TIME + 1,
  });
  const feedbackId = await ctx.db.insert("humanWeightFeedback", {
    entryId,
    feedbackKind: "wrongContext",
    userId: reviewerUserId,
    createdAt: BASE_TIME + 2,
    updatedAt: BASE_TIME + 2,
  });
  const contextKey = getContextKey([contextTag.tagId]);

  await insertContextExpertiseEvidence(ctx, {
    contextKey,
    contextTagIds: [contextTag.tagId],
    correctionKind: "wrongContext",
    correctedAt: BASE_TIME + 2,
    correctedByFeedbackId: feedbackId,
    entryId,
    evidenceKind: "post",
    subjectUserId: originalUserId,
    updatedAt: BASE_TIME + 2,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await ctx.db.insert("contextExpertiseAggregates", {
    contextExpertiseMaturity: 20,
    contextExpertiseScore: 94,
    contextKey,
    contextTagIds: [contextTag.tagId],
    createdAt: BASE_TIME + 2,
    evidenceCount: 1,
    feedbackCount: 0,
    latestEvidenceAt: BASE_TIME + 2,
    postCount: 1,
    subjectUserId: originalUserId,
    topSupportingEntryIds: [entryId],
    updatedAt: BASE_TIME + 2,
    visibilityKind: "public",
    visibilityTargetKey: "public",
    audienceScopeKind: "public",
    audienceScopeTargetKey: "public",
  });

  return { adminUserId, correctedUserId, entryId, originalUserId };
}

async function seedCorrectedContextExpertiseEvidenceRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "corrected-expertise-admin@example.com",
    name: "Corrected Expertise Admin",
    systemRole: "systemAdmin",
  });
  const expertUserId = await insertUser(ctx, {
    email: "corrected-expertise-expert@example.com",
    name: "Corrected Expertise Expert",
  });
  const reviewerUserId = await insertUser(ctx, {
    email: "corrected-expertise-reviewer@example.com",
    name: "Corrected Expertise Reviewer",
  });
  const contextTag = await insertTag(ctx, {
    canonicalKey: "corrected-context-expertise",
    knowledgeType: "topic",
    label: "Corrected Context Expertise",
  });
  const entryId = await insertEntry(ctx, {
    contextTagIds: [contextTag.tagId],
    contextPreviewTagLabels: [contextTag.label],
    createdByUserId: expertUserId,
    humanWeight: 82,
    knowledgeType: "words",
    previewText: "Corrected post evidence for migration status.",
    title: "Corrected Context Expertise Evidence",
    updatedAt: BASE_TIME + 1,
  });
  const feedbackId = await ctx.db.insert("humanWeightFeedback", {
    entryId,
    feedbackKind: "wrongContext",
    userId: reviewerUserId,
    createdAt: BASE_TIME + 2,
    updatedAt: BASE_TIME + 2,
  });

  await insertContextExpertiseEvidence(ctx, {
    contextKey: getContextKey([contextTag.tagId]),
    contextTagIds: [contextTag.tagId],
    correctionKind: "wrongContext",
    correctedAt: BASE_TIME + 2,
    correctedByFeedbackId: feedbackId,
    entryId,
    evidenceKind: "post",
    subjectUserId: expertUserId,
    updatedAt: BASE_TIME + 2,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });

  return { adminUserId };
}

async function expectScopedAggregateRows(
  t: ReturnType<typeof convexTest>,
  count: number,
) {
  const rows = await getScopedAggregateRows(t);
  expect(rows).toHaveLength(count);
}

async function expectLegacyAggregateRows(
  t: ReturnType<typeof convexTest>,
  count: number,
) {
  const rows = await getLegacyAggregateRows(t);
  expect(rows).toHaveLength(count);
}

async function expectQuoteAttributionEvidenceRows(
  t: ReturnType<typeof convexTest>,
  count: number,
) {
  const rows = await t.run(async (ctx) => {
    const evidenceRows = await ctx.db.query("contextExpertiseEvidence").collect();
    return evidenceRows.filter(
      (evidence) => evidence.evidenceKind === "quoteAttribution",
    );
  });
  expect(rows).toHaveLength(count);
}

async function getContextExpertiseDataCounts(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const aggregates = await ctx.db.query("contextExpertiseAggregates").collect();
    const evidence = await ctx.db.query("contextExpertiseEvidence").collect();
    return {
      aggregateCount: aggregates.length,
      evidenceCount: evidence.length,
    };
  });
}

async function getPersonGlobalExpertSuppressionRowCount(
  t: ReturnType<typeof convexTest>,
) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db
      .query("personContextExpertiseVisibilitySettings")
      .collect();
    return rows.length;
  });
}

async function getPersonGlobalExpertModerationEventRows(
  t: ReturnType<typeof convexTest>,
) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("personContextExpertiseVisibilityModerationEvents")
      .collect();
  });
}

async function getScopedAggregateRows(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("contextExpertiseAggregates").collect();
    return rows
      .filter(
        (row) =>
          row.audienceScopeKind !== undefined &&
          row.audienceScopeTargetKey !== undefined,
      )
      .sort((left, right) =>
        left.audienceScopeKind === right.audienceScopeKind
          ? left.audienceScopeTargetKey.localeCompare(right.audienceScopeTargetKey)
          : left.audienceScopeKind.localeCompare(right.audienceScopeKind),
      );
  });
}

async function getLegacyAggregateRows(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const rows = await ctx.db.query("contextExpertiseAggregates").collect();
    return rows.filter(
      (row) =>
        row.audienceScopeKind === undefined ||
        row.audienceScopeTargetKey === undefined,
    );
  });
}

async function seedProfileContextExpertiseRows(ctx: MutationCtx) {
  const userId = await insertUser(ctx, {
    email: "profile-expertise-user@example.com",
    name: "Profile Expertise User",
  });
  const otherUserId = await insertUser(ctx, {
    email: "profile-expertise-other@example.com",
    name: "Other Profile Expert",
  });
  const profile = await insertUserProfile(ctx, {
    canonicalKey: "profile-expertise-user",
    name: "Profile Expertise User",
    userId,
  });
  const organization = await insertOrganization(ctx, {
    createdByUserId: userId,
    name: "Profile Expertise School",
  });
  const inaccessibleOrganization = await insertOrganization(ctx, {
    createdByUserId: userId,
    name: "Hidden Profile Expertise School",
  });
  await ctx.db.insert("memberships", {
    createdAt: BASE_TIME,
    memberRole: "admin",
    memberUserId: userId,
    membershipStatus: "active",
    organizationReferentId: organization.organizationReferentId,
    personReferentId: profile.personReferentId,
    targetKind: "organization",
    updatedAt: BASE_TIME,
  });

  const doctrine = await insertTag(ctx, {
    canonicalKey: "profile-doctrine",
    knowledgeType: "topic",
    label: "Profile Doctrine",
  });
  const romans = await insertTag(ctx, {
    canonicalKey: "profile-romans",
    knowledgeType: "topic",
    label: "Profile Romans",
  });
  const privateTopic = await insertTag(ctx, {
    canonicalKey: "profile-private",
    knowledgeType: "topic",
    label: "Profile Private",
  });
  const inaccessibleTopic = await insertTag(ctx, {
    canonicalKey: "profile-inaccessible",
    knowledgeType: "topic",
    label: "Profile Inaccessible",
  });
  const otherTopic = await insertTag(ctx, {
    canonicalKey: "profile-other-user",
    knowledgeType: "topic",
    label: "Other User Context",
  });

  await insertContextExpertiseAggregate(ctx, {
    contextExpertiseMaturity: 84,
    contextExpertiseScore: 96,
    contextTagIds: [doctrine.tagId],
    evidenceCount: 7,
    feedbackCount: 2,
    latestEvidenceAt: BASE_TIME + 50,
    postCount: 5,
    subjectUserId: userId,
    visibilityKind: "organization",
    visibilityTargetKey: organization.organizationReferentId,
  });
  await insertContextExpertiseAggregate(ctx, {
    contextExpertiseMaturity: 68,
    contextExpertiseScore: 91,
    contextTagIds: [romans.tagId],
    evidenceCount: 5,
    feedbackCount: 1,
    latestEvidenceAt: BASE_TIME + 40,
    postCount: 4,
    subjectUserId: userId,
  });
  await insertContextExpertiseAggregate(ctx, {
    contextExpertiseMaturity: 100,
    contextExpertiseScore: 99,
    contextTagIds: [privateTopic.tagId],
    evidenceCount: 9,
    feedbackCount: 3,
    latestEvidenceAt: BASE_TIME + 70,
    postCount: 6,
    subjectUserId: userId,
    visibilityKind: "private",
    visibilityTargetKey: `user:${userId}`,
  });
  await insertContextExpertiseAggregate(ctx, {
    contextExpertiseMaturity: 88,
    contextExpertiseScore: 98,
    contextTagIds: [inaccessibleTopic.tagId],
    evidenceCount: 8,
    feedbackCount: 2,
    latestEvidenceAt: BASE_TIME + 60,
    postCount: 6,
    subjectUserId: userId,
    visibilityKind: "organization",
    visibilityTargetKey: inaccessibleOrganization.organizationReferentId,
  });
  await insertContextExpertiseAggregate(ctx, {
    contextExpertiseMaturity: 100,
    contextExpertiseScore: 100,
    contextTagIds: [otherTopic.tagId],
    evidenceCount: 10,
    feedbackCount: 4,
    latestEvidenceAt: BASE_TIME + 80,
    postCount: 6,
    subjectUserId: otherUserId,
  });

  return {
    organizationReferentId: organization.organizationReferentId,
    tags: {
      doctrine,
      romans,
    },
    userId,
  };
}

async function seedContextExpertiseInheritanceRows(ctx: MutationCtx) {
  const adminUserId = await insertUser(ctx, {
    email: "expertise-inheritance-admin@example.com",
    name: "Expertise Inheritance Admin",
    systemRole: "systemAdmin",
  });
  const exactUserId = await insertUser(ctx, {
    email: "exact-context-expert@example.com",
    name: "Exact Context Expert",
  });
  const parentOnlyUserId = await insertUser(ctx, {
    email: "parent-context-expert@example.com",
    name: "Parent Context Expert",
  });
  const primary = await insertTag(ctx, {
    canonicalKey: "inheritance-primary",
    knowledgeType: "topic",
    label: "Inheritance Primary",
  });
  const secondary = await insertTag(ctx, {
    canonicalKey: "inheritance-secondary",
    knowledgeType: "topic",
    label: "Inheritance Secondary",
  });

  await insertContextExpertiseAggregate(ctx, {
    contextExpertiseMaturity: 40,
    contextExpertiseScore: 74,
    contextTagIds: [primary.tagId, secondary.tagId],
    evidenceCount: 2,
    feedbackCount: 0,
    latestEvidenceAt: BASE_TIME + 20,
    postCount: 2,
    subjectUserId: exactUserId,
  });
  await insertContextExpertiseAggregate(ctx, {
    contextExpertiseMaturity: 100,
    contextExpertiseScore: 100,
    contextTagIds: [primary.tagId],
    evidenceCount: 5,
    feedbackCount: 1,
    latestEvidenceAt: BASE_TIME + 60,
    postCount: 4,
    subjectUserId: exactUserId,
  });
  await insertContextExpertiseAggregate(ctx, {
    contextExpertiseMaturity: 100,
    contextExpertiseScore: 100,
    contextTagIds: [primary.tagId],
    evidenceCount: 4,
    feedbackCount: 1,
    latestEvidenceAt: BASE_TIME + 50,
    postCount: 3,
    subjectUserId: parentOnlyUserId,
  });

  return {
    adminUserId,
    exactUserId,
    parentOnlyUserId,
    tags: {
      primary,
      secondary,
    },
  };
}

async function insertUser(
  ctx: MutationCtx,
  user: {
    email: string;
    name: string;
    systemRole?: Doc<"users">["systemRole"];
  },
) {
  return await ctx.db.insert("users", {
    email: user.email,
    isActive: true,
    name: user.name,
    ...(user.systemRole === undefined ? {} : { systemRole: user.systemRole }),
  });
}

async function insertTag(
  ctx: MutationCtx,
  tag: {
    canonicalKey: string;
    knowledgeType: Doc<"referents">["knowledgeType"];
    label: string;
  },
) {
  const referentId = await ctx.db.insert("referents", {
    canonicalKey: tag.canonicalKey,
    canonicalName: tag.label,
    knowledgeType: tag.knowledgeType,
  });
  const tagId = await ctx.db.insert("tags", {
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    lookupKey: tag.canonicalKey,
    referentId,
  });

  return { ...tag, referentId, tagId };
}

async function insertThumbnailForTag(
  ctx: MutationCtx,
  tag: Awaited<ReturnType<typeof insertTag>>,
  externalUrl: string,
) {
  const entryId = await ctx.db.insert("knowledgeEntries", {
    contextPreviewTagLabels: [],
    createdAt: BASE_TIME,
    discoverabilityKind: "public",
    discoverabilityTargetKey: "public",
    knowledgeType: tag.knowledgeType === "biblePassage" ? "words" : tag.knowledgeType,
    previewText: `${tag.label} thumbnail source.`,
    primaryTagId: tag.tagId,
    primaryTagLabel: tag.label,
    representedReferentId: tag.referentId,
    searchText: `${tag.label} thumbnail`,
    title: `${tag.label} thumbnail source`,
    updatedAt: BASE_TIME,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await ctx.db.insert("entryTags", {
    entryId,
    tagId: tag.tagId,
    tagPurpose: "represented",
    taggedAt: BASE_TIME,
  });
  await ctx.db.insert("entryRepresentations", {
    createdAt: BASE_TIME,
    entryId,
    externalUrl,
    isPrimary: false,
    representationKind: "externalUrl",
    representationRole: "thumbnail",
    updatedAt: BASE_TIME,
  });
}

async function insertOrganization(
  ctx: MutationCtx,
  organization: {
    createdByUserId: Id<"users">;
    name: string;
  },
) {
  const canonicalKey = slugify(organization.name);
  const organizationReferentId = await ctx.db.insert("referents", {
    canonicalKey,
    canonicalName: organization.name,
    knowledgeType: "organization",
  });
  const primaryTagId = await ctx.db.insert("tags", {
    knowledgeType: "organization",
    label: organization.name,
    lookupKey: canonicalKey,
    referentId: organizationReferentId,
  });
  const entryId = await ctx.db.insert("knowledgeEntries", {
    contextPreviewTagLabels: [],
    createdAt: BASE_TIME,
    createdByUserId: organization.createdByUserId,
    discoverabilityKind: "organization",
    discoverabilityTargetKey: organizationReferentId,
    knowledgeType: "organization",
    previewText: `${organization.name} organization.`,
    primaryTagId,
    primaryTagLabel: organization.name,
    representedReferentId: organizationReferentId,
    searchText: organization.name,
    title: organization.name,
    updatedAt: BASE_TIME,
    visibilityKind: "organization",
    visibilityTargetKey: organizationReferentId,
  });
  const organizationEntryId = await ctx.db.insert("organizationEntries", {
    entryId,
    isActive: true,
    organizationKind: "school",
  });

  return { organizationEntryId, organizationReferentId };
}

async function insertUserProfile(
  ctx: MutationCtx,
  profile: {
    canonicalKey: string;
    name: string;
    userId: Id<"users">;
  },
) {
  const personReferentId = await ctx.db.insert("referents", {
    canonicalKey: profile.canonicalKey,
    canonicalName: profile.name,
    knowledgeType: "person",
  });
  const personTagId = await ctx.db.insert("tags", {
    knowledgeType: "person",
    label: profile.name,
    lookupKey: profile.canonicalKey,
    referentId: personReferentId,
  });
  const personEntryId = await ctx.db.insert("knowledgeEntries", {
    contextPreviewTagLabels: [],
    createdAt: BASE_TIME,
    createdByUserId: profile.userId,
    discoverabilityKind: "public",
    discoverabilityTargetKey: "public",
    knowledgeType: "person",
    previewText: `${profile.name} profile.`,
    primaryTagId: personTagId,
    primaryTagLabel: profile.name,
    representedReferentId: personReferentId,
    searchText: profile.name,
    title: profile.name,
    updatedAt: BASE_TIME,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
  await ctx.db.insert("personEntries", { entryId: personEntryId });
  await ctx.db.insert("userProfiles", {
    createdAt: BASE_TIME,
    personEntryId,
    personReferentId,
    personTagId,
    updatedAt: BASE_TIME,
    userId: profile.userId,
  });

  return { personEntryId, personReferentId, personTagId };
}

async function insertEntry(
  ctx: MutationCtx,
  entry: {
    contextPreviewTagLabels: string[];
    contextTagIds: Array<Id<"tags">>;
    createdByUserId: Id<"users">;
    humanWeight: number;
    knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
    previewText: string;
    title: string;
    updatedAt: number;
    visibilityKind?: Doc<"knowledgeEntries">["visibilityKind"];
    visibilityTargetKey?: string;
  },
) {
  const canonicalKey = slugify(entry.title);
  const referentId = await ctx.db.insert("referents", {
    canonicalKey,
    canonicalName: entry.title,
    knowledgeType: entry.knowledgeType,
  });
  const primaryTagId = await ctx.db.insert("tags", {
    knowledgeType: entry.knowledgeType,
    label: entry.title,
    lookupKey: canonicalKey,
    referentId,
  });
  const entryId = await ctx.db.insert("knowledgeEntries", {
    contextPreviewTagLabels: entry.contextPreviewTagLabels,
    createdAt: entry.updatedAt,
    createdByUserId: entry.createdByUserId,
    discoverabilityKind: entry.visibilityKind ?? "public",
    discoverabilityTargetKey: entry.visibilityTargetKey ?? "public",
    humanWeight: entry.humanWeight,
    knowledgeType: entry.knowledgeType,
    previewText: entry.previewText,
    primaryTagId,
    primaryTagLabel: entry.title,
    representedReferentId: referentId,
    searchText: `${entry.title} ${entry.previewText}`,
    title: entry.title,
    updatedAt: entry.updatedAt,
    visibilityKind: entry.visibilityKind ?? "public",
    visibilityTargetKey: entry.visibilityTargetKey ?? "public",
  });

  for (const tagId of entry.contextTagIds) {
    await ctx.db.insert("entryTags", {
      entryId,
      tagId,
      tagPurpose: "context",
      taggedAt: entry.updatedAt,
      taggedByUserId: entry.createdByUserId,
    });
  }

  return entryId;
}

async function insertContextExpertiseAggregate(
  ctx: MutationCtx,
  aggregate: {
    contextExpertiseMaturity: number;
    contextExpertiseScore: number;
    contextTagIds: Array<Id<"tags">>;
    evidenceCount: number;
    feedbackCount: number;
    latestEvidenceAt: number;
    postCount: number;
    subjectPersonReferentId?: Id<"referents">;
    subjectUserId?: Id<"users">;
    topSupportingEntryIds?: Array<Id<"knowledgeEntries">>;
    visibilityKind?: Doc<"contextExpertiseAggregates">["visibilityKind"];
    visibilityTargetKey?: string;
  },
) {
  const contextTagIds = [...aggregate.contextTagIds].sort();
  await ctx.db.insert("contextExpertiseAggregates", {
    ...(aggregate.subjectPersonReferentId === undefined
      ? {}
      : { subjectPersonReferentId: aggregate.subjectPersonReferentId }),
    ...(aggregate.subjectUserId === undefined
      ? {}
      : { subjectUserId: aggregate.subjectUserId }),
    contextKey: getContextKey(contextTagIds),
    contextTagIds,
    contextExpertiseScore: aggregate.contextExpertiseScore,
    contextExpertiseMaturity: aggregate.contextExpertiseMaturity,
    evidenceCount: aggregate.evidenceCount,
    postCount: aggregate.postCount,
    feedbackCount: aggregate.feedbackCount,
    latestEvidenceAt: aggregate.latestEvidenceAt,
    topSupportingEntryIds: aggregate.topSupportingEntryIds ?? [],
    visibilityKind: aggregate.visibilityKind ?? "public",
    visibilityTargetKey: aggregate.visibilityTargetKey ?? "public",
    createdAt: BASE_TIME,
    updatedAt: aggregate.latestEvidenceAt,
  });
}

async function insertContextExpertiseEvidence(
  ctx: MutationCtx,
  evidence: {
    contextKey: string;
    contextTagIds: Array<Id<"tags">>;
    attributionCorrectedAt?: number;
    attributionCorrectedByUserId?: Id<"users">;
    attributionCorrectedFromSubjectPersonReferentId?: Id<"referents">;
    attributionCorrectedFromSubjectUserId?: Id<"users">;
    correctionKind?: Doc<"contextExpertiseEvidence">["correctionKind"];
    correctedAt?: number;
    correctedByFeedbackId?: Id<"humanWeightFeedback">;
    entryId: Id<"knowledgeEntries">;
    evidenceKind: Doc<"contextExpertiseEvidence">["evidenceKind"];
    feedbackId?: Id<"humanWeightFeedback">;
    subjectPersonReferentId?: Id<"referents">;
    subjectUserId?: Id<"users">;
    updatedAt: number;
    visibilityKind: Doc<"contextExpertiseEvidence">["visibilityKind"];
    visibilityTargetKey: string;
  },
) {
  await ctx.db.insert("contextExpertiseEvidence", {
    ...evidence,
    createdAt: evidence.updatedAt,
  });
}

function getContextKey(tagIds: Array<Id<"tags">>) {
  return `tags:${[...tagIds].sort().join(",")}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
