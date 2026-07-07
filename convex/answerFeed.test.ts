/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./answerFeed.ts": () => import("./answerFeed"),
  "./auth.ts": () => import("./auth"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
  "./lib/contextExpertiseScoring.ts": () =>
    import("./lib/contextExpertiseScoring"),
  "./lib/humanWeightEvidence.ts": () => import("./lib/humanWeightEvidence"),
  "./lib/fileRepresentationRoles.ts": () =>
    import("./lib/fileRepresentationRoles"),
  "./lib/referentThumbnails.ts": () => import("./lib/referentThumbnails"),
  "./lib/typeBehavior.ts": () => import("./lib/typeBehavior"),
};

const BASE_TIME = Date.UTC(2026, 5, 1, 12);

describe("Answer Feed backend adapter", () => {
  test("matches Entries by containing every active Tag and allows extra Tags", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      answerLimit: 10,
      slotLimit: 10,
    });

    const answerTitles = feedItems
      .filter((item) => item.kind === "answer")
      .map((item) => item.entry.title);

    expect(answerTitles).toEqual([
      "High Weight Matching Lesson",
      "Extra Tag Matching Answer",
      "Lower Weight Matching Answer",
      "Unscored Matching Lesson",
      "Non Weight Matching Topic",
    ]);
    expect(answerTitles).not.toContain("Missing Holy Spirit Answer");
  });

  test("returns compact Answer and Slot summaries that match the frontend contract", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      answerLimit: 10,
      slotLimit: 10,
    });

    expect(feedItems).toContainEqual({
      kind: "answer",
      entry: {
        contributor: {
          id: seed.users.ada,
          name: "Ada Teacher",
        },
        id: seed.entries.highWeight,
        title: "High Weight Matching Lesson",
        knowledgeType: "lesson",
        previewText: "A high-weight lesson preview.",
        primaryTagLabel: "High Weight Matching Lesson",
        contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
        humanWeight: 96,
        evidenceMaturity: 60,
        humanWeightCredit: {
          basis: "contributor",
          label: "Ada Teacher",
        },
        href: `/entries/${seed.entries.highWeight}`,
        updatedAt: BASE_TIME + 3,
      },
    });
    expect(feedItems).toContainEqual({
      kind: "slot",
      slot: {
        id: seed.slots.matching,
        title: "Requested future Answer",
        requestedKnowledgeType: "lesson",
        promptText: "Contribute a future Answer for this Knowledge Context.",
        status: "open",
        contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
        targetLabel: "Public",
        dueAt: BASE_TIME + 30,
        href: `/slots/${seed.slots.matching}`,
      },
    });
    expect(
      feedItems.some(
        (item) =>
          item.kind === "slot" && item.slot.title === "Missing Holy Spirit Slot",
      ),
    ).toBe(false);

    const nonWeightBearingItem = feedItems.find(
      (item) =>
        item.kind === "answer" && item.entry.title === "Non Weight Matching Topic",
    );
    expect(nonWeightBearingItem?.kind).toBe("answer");
    if (nonWeightBearingItem?.kind !== "answer") {
      throw new Error("Expected non-weight-bearing topic Answer in feed.");
    }
    expect(nonWeightBearingItem.entry.knowledgeType).toBe("topic");
    expect(nonWeightBearingItem.entry).not.toHaveProperty("humanWeight");
    expect(nonWeightBearingItem.entry).not.toHaveProperty("evidenceMaturity");
    expect(nonWeightBearingItem.entry).not.toHaveProperty("humanWeightCredit");
  });

  test("includes thumbnail-rich Tag snapshots when context Tags have thumbnails", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);
    await t.run(async (ctx) => {
      await insertThumbnailForTag(
        ctx,
        seed.tags.romans,
        "https://images.example/romans-8.png",
      );
    });

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      answerLimit: 10,
      slotLimit: 10,
    });
    const highWeightItem = feedItems.find(
      (item) =>
        item.kind === "answer" &&
        item.entry.title === "High Weight Matching Lesson",
    );
    if (highWeightItem?.kind !== "answer") {
      throw new Error("Expected High Weight Matching Lesson in feed.");
    }

    expect(highWeightItem.entry.contextPreviewTagLabels).toEqual([
      "Romans 8:28",
      "Holy Spirit",
    ]);
    expect(highWeightItem.entry.contextPreviewTags).toContainEqual(
      expect.objectContaining({
        href: "/scripture/romans-8-28",
        id: "romans-8-28",
        label: "Romans 8:28",
        thumbnailUrl: "https://images.example/romans-8.png",
      }),
    );
  });

  test("falls back to matching contributors when no Context Expertise aggregates exist", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    const experts = await t.query(api.answerFeed.listExpertsForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      expertLimit: 3,
    });

    expect(experts).toEqual([
      {
        id: seed.users.ada,
        name: "Ada Teacher",
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 109,
        evidenceCount: 2,
        feedbackCount: 0,
        postCount: 2,
      },
      {
        id: seed.users.ben,
        name: "Ben Scholar",
        contextExpertiseMaturity: 20,
        contextExpertiseScore: 100,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 1,
      },
    ]);
  });

  test("prefers exact-context Context Expertise aggregates when available", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    await t.run(async (ctx) => {
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 100,
        contextExpertiseScore: 100,
        contextTagIds: [seed.tags.romans],
        evidenceCount: 8,
        feedbackCount: 4,
        latestEvidenceAt: BASE_TIME + 50,
        postCount: 4,
        subjectUserId: seed.users.ada,
        topSupportingEntryIds: [seed.entries.missingHolySpirit],
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 74,
        contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
        evidenceCount: 2,
        feedbackCount: 0,
        latestEvidenceAt: BASE_TIME + 20,
        postCount: 2,
        subjectUserId: seed.users.ada,
        topSupportingEntryIds: [seed.entries.highWeight],
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 60,
        contextExpertiseScore: 91,
        contextTagIds: [seed.tags.holySpirit, seed.tags.romans],
        evidenceCount: 3,
        feedbackCount: 2,
        latestEvidenceAt: BASE_TIME + 30,
        postCount: 1,
        subjectUserId: seed.users.ben,
        topSupportingEntryIds: [seed.entries.extraTag],
      });
    });

    const experts = await t.query(api.answerFeed.listExpertsForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      expertLimit: 3,
    });

    expect(experts).toEqual([
      {
        id: seed.users.ben,
        name: "Ben Scholar",
        contextExpertiseMaturity: 60,
        contextExpertiseScore: 91,
        evidenceCount: 3,
        feedbackCount: 2,
        postCount: 1,
      },
      {
        id: seed.users.ada,
        name: "Ada Teacher",
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 74,
        evidenceCount: 2,
        feedbackCount: 0,
        postCount: 2,
      },
    ]);
  });

  test("inherits broader parent Context Expertise for narrower active contexts", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    await t.run(async (ctx) => {
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 74,
        contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
        evidenceCount: 2,
        feedbackCount: 0,
        latestEvidenceAt: BASE_TIME + 20,
        postCount: 2,
        subjectUserId: seed.users.ada,
        topSupportingEntryIds: [seed.entries.highWeight],
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 100,
        contextExpertiseScore: 100,
        contextTagIds: [seed.tags.romans],
        evidenceCount: 5,
        feedbackCount: 1,
        latestEvidenceAt: BASE_TIME + 50,
        postCount: 4,
        subjectUserId: seed.users.ben,
        topSupportingEntryIds: [seed.entries.missingHolySpirit],
      });
    });

    const experts = await t.query(api.answerFeed.listExpertsForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      expertLimit: 3,
    });
    const detail = await t.query(api.answerFeed.getExpertDetailForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      subjectUserId: seed.users.ben,
    });
    const singleTagExperts = await t.query(api.answerFeed.listExpertsForActiveTags, {
      activeTagIds: [seed.tags.romans],
      expertLimit: 3,
    });

    expect(experts).toEqual([
      {
        id: seed.users.ben,
        name: "Ben Scholar",
        contextExpertiseMaturity: 100,
        contextExpertiseScore: 85,
        contextMatchKind: "broaderContext",
        evidenceCount: 5,
        feedbackCount: 1,
        postCount: 4,
      },
      {
        id: seed.users.ada,
        name: "Ada Teacher",
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 74,
        evidenceCount: 2,
        feedbackCount: 0,
        postCount: 2,
      },
    ]);
    expect(detail).toMatchObject({
      id: seed.users.ben,
      contextExpertiseScore: 85,
      contextMatchKind: "broaderContext",
      topSupportingEntries: [
        {
          id: seed.entries.missingHolySpirit,
          title: "Missing Holy Spirit Answer",
        },
      ],
    });
    expect(singleTagExperts).toEqual([
      {
        id: seed.users.ben,
        name: "Ben Scholar",
        contextExpertiseMaturity: 100,
        contextExpertiseScore: 100,
        evidenceCount: 5,
        feedbackCount: 1,
        postCount: 4,
      },
    ]);
  });

  test("scopes aggregate-backed Context Experts to the viewer's Expert Orbit", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);
    const viewerUserId = await t.run(async (ctx) => {
      const viewerUserId = await insertUser(ctx, {
        email: "viewer@example.com",
        name: "Viewer",
      });
      const sharedOrganization = await insertOrganization(ctx, {
        createdByUserId: viewerUserId,
        name: "Shared School",
      });
      const outsideOrganization = await insertOrganization(ctx, {
        createdByUserId: viewerUserId,
        name: "Outside School",
      });

      await insertOrganizationMembership(ctx, {
        organizationReferentId: sharedOrganization.organizationReferentId,
        userId: viewerUserId,
      });
      await insertOrganizationMembership(ctx, {
        organizationReferentId: sharedOrganization.organizationReferentId,
        userId: seed.users.ada,
      });
      await insertOrganizationMembership(ctx, {
        organizationReferentId: outsideOrganization.organizationReferentId,
        userId: seed.users.ben,
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 74,
        contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
        evidenceCount: 2,
        feedbackCount: 0,
        latestEvidenceAt: BASE_TIME + 20,
        postCount: 2,
        subjectUserId: seed.users.ada,
        topSupportingEntryIds: [seed.entries.highWeight],
        visibilityKind: "organization",
        visibilityTargetKey: sharedOrganization.organizationReferentId,
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 80,
        contextExpertiseScore: 99,
        contextTagIds: [seed.tags.holySpirit, seed.tags.romans],
        evidenceCount: 5,
        feedbackCount: 1,
        latestEvidenceAt: BASE_TIME + 30,
        postCount: 4,
        subjectUserId: seed.users.ben,
        topSupportingEntryIds: [seed.entries.extraTag],
        visibilityKind: "organization",
        visibilityTargetKey: outsideOrganization.organizationReferentId,
      });

      return viewerUserId;
    });

    const experts = await t
      .withIdentity({ subject: `${viewerUserId}|test-session` })
      .query(api.answerFeed.listExpertsForActiveTags, {
        activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
        expertLimit: 3,
        expertScope: "orbit",
      });

    expect(experts).toEqual([
      {
        id: seed.users.ada,
        name: "Ada Teacher",
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 74,
        evidenceCount: 2,
        feedbackCount: 0,
        postCount: 2,
      },
    ]);
  });

  test("requires public evidence and contributor opt-in for Global Context Experts", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);
    const viewerUserId = await t.run(async (ctx) => {
      const viewerUserId = await insertUser(ctx, {
        email: "global-viewer@example.com",
        name: "Global Viewer",
      });
      const charlieUserId = await insertUser(ctx, {
        email: "charlie@example.com",
        name: "Charlie Private",
      });
      const organization = await insertOrganization(ctx, {
        createdByUserId: viewerUserId,
        name: "Viewer School",
      });
      await insertOrganizationMembership(ctx, {
        organizationReferentId: organization.organizationReferentId,
        userId: viewerUserId,
      });
      await insertGlobalExpertVisibilitySetting(ctx, {
        enabled: true,
        userId: seed.users.ada,
      });
      await insertGlobalExpertVisibilitySetting(ctx, {
        enabled: true,
        userId: charlieUserId,
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 74,
        contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
        evidenceCount: 2,
        feedbackCount: 0,
        latestEvidenceAt: BASE_TIME + 20,
        postCount: 2,
        subjectUserId: seed.users.ada,
        topSupportingEntryIds: [seed.entries.highWeight],
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 80,
        contextExpertiseScore: 99,
        contextTagIds: [seed.tags.holySpirit, seed.tags.romans],
        evidenceCount: 5,
        feedbackCount: 1,
        latestEvidenceAt: BASE_TIME + 30,
        postCount: 4,
        subjectUserId: seed.users.ben,
        topSupportingEntryIds: [seed.entries.extraTag],
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 60,
        contextExpertiseScore: 91,
        contextTagIds: [seed.tags.holySpirit, seed.tags.romans],
        evidenceCount: 3,
        feedbackCount: 1,
        latestEvidenceAt: BASE_TIME + 40,
        postCount: 2,
        subjectUserId: charlieUserId,
        topSupportingEntryIds: [seed.entries.lowerWeight],
        visibilityKind: "organization",
        visibilityTargetKey: organization.organizationReferentId,
      });

      return viewerUserId;
    });

    const experts = await t
      .withIdentity({ subject: `${viewerUserId}|test-session` })
      .query(api.answerFeed.listExpertsForActiveTags, {
        activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
        expertLimit: 3,
        expertScope: "global",
      });

    expect(experts).toEqual([
      {
        id: seed.users.ada,
        name: "Ada Teacher",
        contextExpertiseMaturity: 40,
        contextExpertiseScore: 74,
        evidenceCount: 2,
        feedbackCount: 0,
        postCount: 2,
      },
    ]);
  });

  test("shows public Person-subject aggregate experts globally and links their detail", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);
    const { person, personEntryId, viewerUserId } = await t.run(async (ctx) => {
      const viewerUserId = await insertUser(ctx, {
        email: "person-global-viewer@example.com",
        name: "Person Global Viewer",
      });
      const organization = await insertOrganization(ctx, {
        createdByUserId: viewerUserId,
        name: "Person Viewer School",
      });
      await insertOrganizationMembership(ctx, {
        organizationReferentId: organization.organizationReferentId,
        userId: viewerUserId,
      });
      const person = await insertTag(ctx, {
        canonicalKey: "c-s-lewis",
        knowledgeType: "person",
        label: "C. S. Lewis",
      });
      const personEntryId = await insertEntry(ctx, {
        contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
        contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
        createdByUserId: seed.users.ada,
        humanWeight: 94,
        knowledgeType: "essay",
        previewText: "A shared essay from C. S. Lewis.",
        title: "Shared Lewis Essay",
        updatedAt: BASE_TIME + 70,
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 90,
        contextExpertiseScore: 120,
        contextTagIds: [seed.tags.holySpirit, seed.tags.romans],
        evidenceCount: 1,
        feedbackCount: 0,
        latestEvidenceAt: BASE_TIME + 70,
        postCount: 1,
        subjectPersonReferentId: person.referentId,
        topSupportingEntryIds: [personEntryId],
      });

      return { person, personEntryId, viewerUserId };
    });

    const authed = t.withIdentity({ subject: `${viewerUserId}|test-session` });
    const globalExperts = await authed.query(api.answerFeed.listExpertsForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      expertLimit: 3,
      expertScope: "global",
    });
    const orbitExperts = await authed.query(api.answerFeed.listExpertsForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      expertLimit: 3,
      expertScope: "orbit",
    });
    const detail = await authed.query(api.answerFeed.getExpertDetailForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      expertScope: "global",
      subjectPersonReferentId: person.referentId,
    });

    expect(globalExperts).toEqual([
      {
        id: `person:${person.referentId}`,
        name: "C. S. Lewis",
        href: "/goto/c-s-lewis",
        subjectKind: "person",
        subjectPersonReferentId: person.referentId,
        contextExpertiseMaturity: 90,
        contextExpertiseScore: 120,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 1,
      },
    ]);
    expect(orbitExperts).toEqual([]);
    expect(detail).toMatchObject({
      id: `person:${person.referentId}`,
      name: "C. S. Lewis",
      href: "/goto/c-s-lewis",
      subjectKind: "person",
      subjectPersonReferentId: person.referentId,
      contextExpertiseMaturity: 90,
      contextExpertiseScore: 120,
      topSupportingEntries: [
        {
          id: personEntryId,
          title: "Shared Lewis Essay",
        },
      ],
    });

    const suppressionId = await t.run(async (ctx) => {
      return await ctx.db.insert("personContextExpertiseVisibilitySettings", {
        personReferentId: person.referentId,
        globalExpertVisibilityStatus: "suppressed",
        updatedByUserId: viewerUserId,
        createdAt: BASE_TIME + 71,
        updatedAt: BASE_TIME + 71,
      });
    });

    await expect(
      authed.query(api.answerFeed.listExpertsForActiveTags, {
        activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
        expertLimit: 3,
        expertScope: "global",
      }),
    ).resolves.toEqual([]);
    await expect(
      authed.query(api.answerFeed.getExpertDetailForActiveTags, {
        activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
        expertScope: "global",
        subjectPersonReferentId: person.referentId,
      }),
    ).resolves.toBeNull();

    await t.run(async (ctx) => {
      await ctx.db.delete(suppressionId);
    });
    await expect(
      authed.query(api.answerFeed.listExpertsForActiveTags, {
        activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
        expertLimit: 3,
        expertScope: "global",
      }),
    ).resolves.toEqual(globalExperts);
  });

  test("includes Quote attribution summary in Context Expert supporting Quote entries", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);
    const { person, quoteEntryId, viewerUserId } = await t.run(async (ctx) => {
      const viewerUserId = await insertUser(ctx, {
        email: "quote-attribution-ui-viewer@example.com",
        name: "Quote Attribution UI Viewer",
      });
      const organization = await insertOrganization(ctx, {
        createdByUserId: viewerUserId,
        name: "Quote Attribution UI School",
      });
      await insertOrganizationMembership(ctx, {
        organizationReferentId: organization.organizationReferentId,
        userId: viewerUserId,
      });
      const person = await insertTag(ctx, {
        canonicalKey: "quote-attribution-ui-person",
        knowledgeType: "person",
        label: "Quote Attribution UI Person",
      });
      const quoteEntryId = await insertEntry(ctx, {
        contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
        contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
        createdByUserId: seed.users.ada,
        humanWeight: 91,
        knowledgeType: "quote",
        previewText: "A quote with a structured quoted Person.",
        title: "Quote Attribution Supporting Quote",
        updatedAt: BASE_TIME + 80,
      });
      await ctx.db.insert("quoteEntries", {
        entryId: quoteEntryId,
        quotedPersonReferentId: person.referentId,
      });
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 80,
        contextExpertiseScore: 110,
        contextTagIds: [seed.tags.holySpirit, seed.tags.romans],
        evidenceCount: 1,
        feedbackCount: 0,
        latestEvidenceAt: BASE_TIME + 80,
        postCount: 0,
        subjectPersonReferentId: person.referentId,
        topSupportingEntryIds: [quoteEntryId],
      });

      return { person, quoteEntryId, viewerUserId };
    });

    const detail = await t
      .withIdentity({ subject: `${viewerUserId}|test-session` })
      .query(api.answerFeed.getExpertDetailForActiveTags, {
        activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
        expertScope: "global",
        subjectPersonReferentId: person.referentId,
      });

    expect(detail).toMatchObject({
      id: `person:${person.referentId}`,
      topSupportingEntries: [
        {
          id: quoteEntryId,
          knowledgeType: "quote",
          quoteAttribution: {
            quotedPersonLabel: "Quote Attribution UI Person",
            quotedPersonReferentId: person.referentId,
          },
          title: "Quote Attribution Supporting Quote",
        },
      ],
    });
  });

  test("combines only audience-eligible scoped aggregate rows for Orbit and Global experts", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);
    const { organizationEntryId, publicEntryId, viewerUserId } = await t.run(
      async (ctx) => {
        const viewerUserId = await insertUser(ctx, {
          email: "scoped-viewer@example.com",
          name: "Scoped Viewer",
        });
        const sharedOrganization = await insertOrganization(ctx, {
          createdByUserId: viewerUserId,
          name: "Scoped Shared School",
        });
        const outsideOrganization = await insertOrganization(ctx, {
          createdByUserId: viewerUserId,
          name: "Scoped Outside School",
        });
        await insertOrganizationMembership(ctx, {
          organizationReferentId: sharedOrganization.organizationReferentId,
          userId: viewerUserId,
        });
        await insertOrganizationMembership(ctx, {
          organizationReferentId: sharedOrganization.organizationReferentId,
          userId: seed.users.ada,
        });
        await insertGlobalExpertVisibilitySetting(ctx, {
          enabled: true,
          userId: seed.users.ada,
        });
        const organizationEntryId = await insertEntry(ctx, {
          contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
          contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
          createdByUserId: seed.users.ada,
          humanWeight: 90,
          knowledgeType: "lesson",
          previewText: "Shared-organization expertise evidence.",
          title: "Shared Organization Expertise",
          updatedAt: BASE_TIME + 80,
          visibilityKind: "organization",
          visibilityTargetKey: sharedOrganization.organizationReferentId,
        });
        const publicEntryId = await insertEntry(ctx, {
          contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
          contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
          createdByUserId: seed.users.ada,
          humanWeight: 82,
          knowledgeType: "words",
          previewText: "Public expertise evidence.",
          title: "Public Expertise Evidence",
          updatedAt: BASE_TIME + 79,
        });
        await insertContextExpertiseAggregate(ctx, {
          audienceScopeKind: "public",
          audienceScopeTargetKey: "public",
          contextExpertiseMaturity: 20,
          contextExpertiseScore: 82,
          contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
          evidenceCount: 1,
          feedbackCount: 0,
          latestEvidenceAt: BASE_TIME + 79,
          postCount: 1,
          subjectUserId: seed.users.ada,
          topSupportingEntryIds: [publicEntryId],
        });
        await insertContextExpertiseAggregate(ctx, {
          audienceScopeKind: "organization",
          audienceScopeTargetKey: sharedOrganization.organizationReferentId,
          contextExpertiseMaturity: 40,
          contextExpertiseScore: 90,
          contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
          evidenceCount: 2,
          feedbackCount: 1,
          latestEvidenceAt: BASE_TIME + 80,
          postCount: 1,
          subjectUserId: seed.users.ada,
          topSupportingEntryIds: [organizationEntryId],
          visibilityKind: "organization",
          visibilityTargetKey: sharedOrganization.organizationReferentId,
        });
        await insertContextExpertiseAggregate(ctx, {
          audienceScopeKind: "organization",
          audienceScopeTargetKey: outsideOrganization.organizationReferentId,
          contextExpertiseMaturity: 100,
          contextExpertiseScore: 99,
          contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
          evidenceCount: 5,
          feedbackCount: 0,
          latestEvidenceAt: BASE_TIME + 81,
          postCount: 5,
          subjectUserId: seed.users.ada,
          topSupportingEntryIds: [seed.entries.extraTag],
          visibilityKind: "organization",
          visibilityTargetKey: outsideOrganization.organizationReferentId,
        });

        return { organizationEntryId, publicEntryId, viewerUserId };
      },
    );

    const authed = t.withIdentity({ subject: `${viewerUserId}|test-session` });
    const orbitExperts = await authed.query(api.answerFeed.listExpertsForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      expertLimit: 3,
      expertScope: "orbit",
    });
    const globalExperts = await authed.query(api.answerFeed.listExpertsForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      expertLimit: 3,
      expertScope: "global",
    });
    const orbitDetail = await authed.query(
      api.answerFeed.getExpertDetailForActiveTags,
      {
        activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
        expertScope: "orbit",
        subjectUserId: seed.users.ada,
      },
    );
    const globalDetail = await authed.query(
      api.answerFeed.getExpertDetailForActiveTags,
      {
        activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
        expertScope: "global",
        subjectUserId: seed.users.ada,
      },
    );

    expect(orbitExperts).toEqual([
      {
        id: seed.users.ada,
        name: "Ada Teacher",
        contextExpertiseMaturity: 60,
        contextExpertiseScore: 100,
        evidenceCount: 3,
        feedbackCount: 1,
        postCount: 2,
      },
    ]);
    expect(globalExperts).toEqual([
      {
        id: seed.users.ada,
        name: "Ada Teacher",
        contextExpertiseMaturity: 20,
        contextExpertiseScore: 82,
        evidenceCount: 1,
        feedbackCount: 0,
        postCount: 1,
      },
    ]);
    expect(orbitDetail?.topSupportingEntries.map((entry) => entry.id)).toEqual([
      organizationEntryId,
      publicEntryId,
    ]);
    expect(globalDetail?.topSupportingEntries.map((entry) => entry.id)).toEqual([
      publicEntryId,
    ]);
  });

  test("returns aggregate-backed Context Expert details with top visible contributions", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    await t.run(async (ctx) => {
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 80,
        contextExpertiseScore: 97,
        contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
        evidenceCount: 4,
        feedbackCount: 2,
        latestEvidenceAt: BASE_TIME + 50,
        postCount: 2,
        subjectUserId: seed.users.ada,
        topSupportingEntryIds: [
          seed.entries.highWeight,
          seed.entries.lowerWeight,
        ],
      });
    });

    const detail = await t.query(api.answerFeed.getExpertDetailForActiveTags, {
      activeTagIds: [seed.tags.holySpirit, seed.tags.romans],
      subjectUserId: seed.users.ada,
    });

    expect(detail).toMatchObject({
      id: seed.users.ada,
      name: "Ada Teacher",
      contextExpertiseMaturity: 80,
      contextExpertiseScore: 97,
      evidenceCount: 4,
      feedbackCount: 2,
      postCount: 2,
      topSupportingEntries: [
        {
          id: seed.entries.highWeight,
          title: "High Weight Matching Lesson",
          knowledgeType: "lesson",
          previewText: "A high-weight lesson preview.",
          href: `/entries/${seed.entries.highWeight}`,
        },
        {
          id: seed.entries.lowerWeight,
          title: "Lower Weight Matching Answer",
          knowledgeType: "words",
          previewText: "A lower-weight answer preview.",
          href: `/entries/${seed.entries.lowerWeight}`,
        },
      ],
    });
  });

  test("keeps Context Expert detail contributions bounded", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    await t.run(async (ctx) => {
      await insertContextExpertiseAggregate(ctx, {
        contextExpertiseMaturity: 100,
        contextExpertiseScore: 110,
        contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
        evidenceCount: 5,
        feedbackCount: 1,
        latestEvidenceAt: BASE_TIME + 60,
        postCount: 4,
        subjectUserId: seed.users.ada,
        topSupportingEntryIds: [
          seed.entries.highWeight,
          seed.entries.lowerWeight,
          seed.entries.extraTag,
        ],
      });
    });

    const detail = await t.query(api.answerFeed.getExpertDetailForActiveTags, {
      activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
      contributionLimit: 2,
      subjectUserId: seed.users.ada,
    });

    expect(detail?.topSupportingEntries.map((entry) => entry.title)).toEqual([
      "High Weight Matching Lesson",
      "Lower Weight Matching Answer",
    ]);
  });

  test("filters Context Expert detail contributions by selected audience scope", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);
    const { organizationEntryId, publicEntryId, viewerUserId } = await t.run(
      async (ctx) => {
        const viewerUserId = await insertUser(ctx, {
          email: "detail-viewer@example.com",
          name: "Detail Viewer",
        });
        const organization = await insertOrganization(ctx, {
          createdByUserId: viewerUserId,
          name: "Detail School",
        });
        await insertOrganizationMembership(ctx, {
          organizationReferentId: organization.organizationReferentId,
          userId: viewerUserId,
        });
        await insertOrganizationMembership(ctx, {
          organizationReferentId: organization.organizationReferentId,
          userId: seed.users.ada,
        });
        await insertGlobalExpertVisibilitySetting(ctx, {
          enabled: true,
          userId: seed.users.ada,
        });
        const organizationEntryId = await insertEntry(ctx, {
          contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
          contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
          createdByUserId: seed.users.ada,
          humanWeight: 88,
          knowledgeType: "lesson",
          previewText: "Organization-visible supporting lesson.",
          title: "Organization Visible Lesson",
          updatedAt: BASE_TIME + 65,
          visibilityKind: "organization",
          visibilityTargetKey: organization.organizationReferentId,
        });
        const publicEntryId = await insertEntry(ctx, {
          contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
          contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
          createdByUserId: seed.users.ada,
          humanWeight: 86,
          knowledgeType: "words",
          previewText: "Public supporting words.",
          title: "Public Supporting Words",
          updatedAt: BASE_TIME + 64,
        });
        await insertContextExpertiseAggregate(ctx, {
          contextExpertiseMaturity: 80,
          contextExpertiseScore: 97,
          contextTagIds: [seed.tags.romans, seed.tags.holySpirit],
          evidenceCount: 4,
          feedbackCount: 1,
          latestEvidenceAt: BASE_TIME + 70,
          postCount: 3,
          subjectUserId: seed.users.ada,
          topSupportingEntryIds: [organizationEntryId, publicEntryId],
        });

        return { organizationEntryId, publicEntryId, viewerUserId };
      },
    );

    const authed = t.withIdentity({ subject: `${viewerUserId}|test-session` });
    const orbitDetail = await authed.query(
      api.answerFeed.getExpertDetailForActiveTags,
      {
        activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
        expertScope: "orbit",
        subjectUserId: seed.users.ada,
      },
    );
    const globalDetail = await authed.query(
      api.answerFeed.getExpertDetailForActiveTags,
      {
        activeTagIds: [seed.tags.romans, seed.tags.holySpirit],
        expertScope: "global",
        subjectUserId: seed.users.ada,
      },
    );

    expect(orbitDetail?.topSupportingEntries.map((entry) => entry.id)).toEqual([
      organizationEntryId,
      publicEntryId,
    ]);
    expect(globalDetail?.topSupportingEntries.map((entry) => entry.id)).toEqual([
      publicEntryId,
    ]);
  });

  test("keeps results bounded and deterministic", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAnswerFeedRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tags.holySpirit, seed.tags.romans],
      answerLimit: 2,
      slotLimit: 1,
    });

    expect(feedItems.map((item) => item.kind)).toEqual([
      "answer",
      "answer",
      "slot",
    ]);
    expect(
      feedItems
        .filter((item) => item.kind === "answer")
        .map((item) => item.entry.title),
    ).toEqual(["High Weight Matching Lesson", "Extra Tag Matching Answer"]);
    expect(
      feedItems
        .filter((item) => item.kind === "slot")
      .map((item) => item.slot.title),
    ).toEqual(["Requested future Answer"]);
  });

  test("lists only open or overdue Knowledge Slots assigned to the current user", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAssignedTodoSlotRows);

    const slots = await t
      .withIdentity({ subject: `${seed.viewerUserId}|test-session` })
      .query(api.answerFeed.listAssignedSlotsForCurrentUser, {
        limit: 10,
      });

    expect(slots.map((slot) => slot.title)).toEqual([
      "Overdue assigned request",
      "Open assigned request",
    ]);
    expect(slots).toContainEqual(
      expect.objectContaining({
        id: seed.slots.overdueAssigned,
        status: "overdue",
        targetLabel: "Assigned user",
      }),
    );
    expect(slots.map((slot) => slot.id)).not.toContain(seed.slots.otherUser);
    expect(slots.map((slot) => slot.id)).not.toContain(seed.slots.publicSlot);
    expect(slots.map((slot) => slot.id)).not.toContain(seed.slots.fulfilled);
    expect(slots.map((slot) => slot.id)).not.toContain(seed.slots.cancelled);
  });

  test("surfaces recent unscored global Answers that need Human Weight feedback", async () => {
    const t = convexTest({ schema, modules });
    await t.run(seedGlobalFeedbackPriorityRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [],
      answerLimit: 1,
      slotLimit: 0,
    });

    expect(feedItems).toHaveLength(1);
    expect(feedItems[0]).toMatchObject({
      kind: "answer",
      entry: {
        knowledgeType: "lesson",
        title: "Recent Unscored Lesson",
      },
    });
    if (feedItems[0].kind !== "answer") {
      throw new Error("Expected global feedback priority item to be an Answer.");
    }
    expect(feedItems[0].entry).not.toHaveProperty("humanWeight");
  });

  test("uses Evidence Maturity as a secondary Answer priority signal", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedEvidenceMaturityPriorityRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tagId],
      answerLimit: 2,
      slotLimit: 0,
    });

    expect(
      feedItems
        .filter((item) => item.kind === "answer")
        .map((item) => item.entry.title),
    ).toEqual(["Mature Same Weight Answer", "Fresh Same Weight Answer"]);
    expect(feedItems[0]).toMatchObject({
      kind: "answer",
      entry: {
        evidenceMaturity: 100,
        humanWeight: 70,
        title: "Mature Same Weight Answer",
      },
    });

    const limitedFeedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tagId],
      answerLimit: 1,
      slotLimit: 0,
    });

    expect(limitedFeedItems).toHaveLength(1);
    expect(limitedFeedItems[0]).toMatchObject({
      kind: "answer",
      entry: {
        evidenceMaturity: 100,
        humanWeight: 70,
        title: "Mature Same Weight Answer",
      },
    });
  });

  test("surfaces Human Weight Concern only when low weight violates the applicable expectation", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedHumanWeightConcernRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tagId],
      answerLimit: 10,
      slotLimit: 0,
    });

    const answers = feedItems.filter((item) => item.kind === "answer");
    const lowEssay = getAnswerByTitle(answers, "Low Expected Essay");
    const requiredSlotEssay = getAnswerByTitle(
      answers,
      "Slot Required Essay",
    );
    const lowLesson = getAnswerByTitle(answers, "Low Informative Lesson");
    const nonWeightBearingTopic = getAnswerByTitle(
      answers,
      "Low Non Weight Topic",
    );
    const requiredSlotTopic = getAnswerByTitle(
      answers,
      "Required Slot Topic",
    );

    expect(lowEssay.entry.humanWeightConcern).toEqual({
      level: "possibleConcern",
      expectation: "expected",
      threshold: 40,
    });
    expect(requiredSlotEssay.entry.humanWeightConcern).toEqual({
      level: "reviewRecommended",
      expectation: "required",
      threshold: 60,
    });
    expect(lowLesson.entry).not.toHaveProperty("humanWeightConcern");
    expect(nonWeightBearingTopic.entry).not.toHaveProperty("humanWeightConcern");
    expect(requiredSlotTopic.entry).not.toHaveProperty("humanWeightConcern");
  });

  test("surfaces type-aware Human Weight credit subjects", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedHumanWeightCreditRows);

    const feedItems = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.tagId],
      answerLimit: 10,
      slotLimit: 0,
    });

    const answers = feedItems.filter((item) => item.kind === "answer");
    const attributedQuote = getAnswerByTitle(
      answers,
      "Quote With Attributed Person",
    );
    const unattributedQuote = getAnswerByTitle(
      answers,
      "Quote Without Attributed Person",
    );
    const authoredWords = getAnswerByTitle(answers, "Authored Words");
    const nonWeightBearingTopic = getAnswerByTitle(
      answers,
      "Non Weight Credit Topic",
    );

    expect(attributedQuote.entry.humanWeightCredit).toEqual({
      basis: "quotedPerson",
      label: "C.S. Lewis",
    });
    expect(unattributedQuote.entry.humanWeightCredit).toEqual({
      basis: "quotedPerson",
      label: "Quoted person",
    });
    expect(authoredWords.entry.humanWeightCredit).toEqual({
      basis: "contributor",
      label: "Ada Teacher",
    });
    expect(nonWeightBearingTopic.entry).not.toHaveProperty(
      "humanWeightCredit",
    );
  });
});

async function seedAnswerFeedRows(ctx: MutationCtx) {
  const adaUserId = await insertUser(ctx, {
    email: "ada.teacher@example.com",
    name: "Ada Teacher",
  });
  const benUserId = await insertUser(ctx, {
    email: "ben.scholar@example.com",
    name: "Ben Scholar",
  });
  const romans = await insertTag(ctx, {
    canonicalKey: "romans-8-28",
    knowledgeType: "biblePassage",
    label: "Romans 8:28",
  });
  const holySpirit = await insertTag(ctx, {
    canonicalKey: "holy-spirit",
    knowledgeType: "topic",
    label: "Holy Spirit",
  });
  const atonement = await insertTag(ctx, {
    canonicalKey: "atonement",
    knowledgeType: "topic",
    label: "Atonement",
  });

  const lowerWeight = await insertEntry(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId],
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    createdByUserId: adaUserId,
    humanWeight: 72,
    knowledgeType: "words",
    previewText: "A lower-weight answer preview.",
    title: "Lower Weight Matching Answer",
    updatedAt: BASE_TIME + 1,
  });
  const extraTag = await insertEntry(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId, atonement.tagId],
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit", "Atonement"],
    createdByUserId: benUserId,
    humanWeight: 88,
    knowledgeType: "words",
    previewText: "An answer with an extra Tag preview.",
    title: "Extra Tag Matching Answer",
    updatedAt: BASE_TIME + 2,
  });
  const highWeight = await insertEntry(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId],
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    createdByUserId: adaUserId,
    humanWeight: 96,
    knowledgeType: "lesson",
    previewText: "A high-weight lesson preview.",
    title: "High Weight Matching Lesson",
    updatedAt: BASE_TIME + 3,
  });
  await insertHumanWeightFeedback(ctx, {
    entryId: highWeight,
    feedbackKind: "recognize",
    userId: adaUserId,
  });
  await insertHumanWeightFeedback(ctx, {
    entryId: highWeight,
    feedbackKind: "used",
    userId: benUserId,
  });
  await insertHumanWeightFeedback(ctx, {
    entryId: highWeight,
    feedbackKind: "wrongContext",
    userId: benUserId,
  });
  const nonWeightBearingTopic = await insertEntry(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId],
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    createdByUserId: benUserId,
    knowledgeType: "topic",
    previewText: "A non-weight-bearing topic preview.",
    title: "Non Weight Matching Topic",
    updatedAt: BASE_TIME + 5,
  });
  const unscoredWeightBearingLesson = await insertEntry(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId],
    contextPreviewTagLabels: ["Romans 8:28", "Holy Spirit"],
    createdByUserId: adaUserId,
    knowledgeType: "lesson",
    previewText: "A weight-bearing lesson that needs Human Weight evidence.",
    title: "Unscored Matching Lesson",
    updatedAt: BASE_TIME,
  });
  const missingHolySpirit = await insertEntry(ctx, {
    contextTagIds: [romans.tagId],
    contextPreviewTagLabels: ["Romans 8:28"],
    createdByUserId: benUserId,
    humanWeight: 100,
    knowledgeType: "words",
    previewText: "This answer is broader than the active Knowledge Context.",
    title: "Missing Holy Spirit Answer",
    updatedAt: BASE_TIME + 4,
  });

  const matchingSlot = await insertSlot(ctx, {
    contextTagIds: [romans.tagId, holySpirit.tagId],
    promptText: "Contribute a future Answer for this Knowledge Context.",
    requestedKnowledgeType: "lesson",
    title: "Requested future Answer",
  });
  const missingHolySpiritSlot = await insertSlot(ctx, {
    contextTagIds: [romans.tagId],
    requestedKnowledgeType: "words",
    title: "Missing Holy Spirit Slot",
  });

  return {
    entries: {
      extraTag,
      highWeight,
      lowerWeight,
      missingHolySpirit,
      nonWeightBearingTopic,
      unscoredWeightBearingLesson,
    },
    slots: {
      matching: matchingSlot,
      missingHolySpirit: missingHolySpiritSlot,
    },
    tags: {
      atonement: atonement.tagId,
      holySpirit: holySpirit.tagId,
      romans: romans.tagId,
    },
    users: {
      ada: adaUserId,
      ben: benUserId,
    },
  };
}

async function seedEvidenceMaturityPriorityRows(ctx: MutationCtx) {
  const userId = await insertUser(ctx, {
    email: "maturity-priority@example.com",
    name: "Maturity Priority",
  });
  const reviewerUserId = await insertUser(ctx, {
    email: "maturity-reviewer@example.com",
    name: "Maturity Reviewer",
  });
  const tag = await insertTag(ctx, {
    canonicalKey: "evidence-maturity",
    knowledgeType: "topic",
    label: "Evidence Maturity",
  });
  const matureEntryId = await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Evidence Maturity"],
    createdByUserId: userId,
    humanWeight: 70,
    knowledgeType: "lesson",
    previewText: "An answer with settled Human Weight evidence.",
    title: "Mature Same Weight Answer",
    updatedAt: BASE_TIME,
  });
  await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Evidence Maturity"],
    createdByUserId: userId,
    humanWeight: 70,
    knowledgeType: "lesson",
    previewText: "A newer answer without Human Weight evidence yet.",
    title: "Fresh Same Weight Answer",
    updatedAt: BASE_TIME + 50,
  });

  for (const feedbackKind of [
    "recognize",
    "used",
    "notHuman",
    "wrongContext",
  ] as const) {
    await insertHumanWeightFeedback(ctx, {
      entryId: matureEntryId,
      feedbackKind,
      userId,
    });
  }
  await insertHumanWeightFeedback(ctx, {
    entryId: matureEntryId,
    feedbackKind: "used",
    userId: reviewerUserId,
  });

  return { tagId: tag.tagId };
}

async function seedAssignedTodoSlotRows(ctx: MutationCtx) {
  const viewerUserId = await insertUser(ctx, {
    email: "todo-viewer@example.com",
    name: "Todo Viewer",
  });
  const otherUserId = await insertUser(ctx, {
    email: "todo-other@example.com",
    name: "Todo Other",
  });
  const organization = await insertOrganization(ctx, {
    createdByUserId: viewerUserId,
    name: "Todo School",
  });
  await insertOrganizationMembership(ctx, {
    organizationReferentId: organization.organizationReferentId,
    userId: viewerUserId,
  });
  const tag = await insertTag(ctx, {
    canonicalKey: "todo-context",
    knowledgeType: "topic",
    label: "TODO Context",
  });

  const overdueAssigned = await insertSlot(ctx, {
    contextTagIds: [tag.tagId],
    dueAt: BASE_TIME - 10,
    promptText: "Handle the overdue assigned request.",
    requestedKnowledgeType: "comment",
    status: "overdue",
    targetKind: "user",
    targetUserId: viewerUserId,
    title: "Overdue assigned request",
  });
  const openAssigned = await insertSlot(ctx, {
    contextTagIds: [tag.tagId],
    dueAt: BASE_TIME + 10,
    requestedKnowledgeType: "lesson",
    status: "open",
    targetKind: "user",
    targetUserId: viewerUserId,
    title: "Open assigned request",
  });
  const otherUser = await insertSlot(ctx, {
    contextTagIds: [tag.tagId],
    requestedKnowledgeType: "lesson",
    status: "open",
    targetKind: "user",
    targetUserId: otherUserId,
    title: "Other user's request",
  });
  const publicSlot = await insertSlot(ctx, {
    contextTagIds: [tag.tagId],
    requestedKnowledgeType: "lesson",
    status: "open",
    title: "Public request",
  });
  const fulfilled = await insertSlot(ctx, {
    contextTagIds: [tag.tagId],
    requestedKnowledgeType: "lesson",
    status: "fulfilled",
    targetKind: "user",
    targetUserId: viewerUserId,
    title: "Fulfilled assigned request",
  });
  const cancelled = await insertSlot(ctx, {
    contextTagIds: [tag.tagId],
    requestedKnowledgeType: "lesson",
    status: "cancelled",
    targetKind: "user",
    targetUserId: viewerUserId,
    title: "Cancelled assigned request",
  });

  return {
    slots: {
      cancelled,
      fulfilled,
      openAssigned,
      otherUser,
      overdueAssigned,
      publicSlot,
    },
    viewerUserId,
  };
}

async function seedGlobalFeedbackPriorityRows(ctx: MutationCtx) {
  const userId = await insertUser(ctx, {
    email: "global-feedback@example.com",
    name: "Global Feedback",
  });

  for (let index = 0; index < 30; index += 1) {
    await insertEntry(ctx, {
      contextTagIds: [],
      contextPreviewTagLabels: [],
      createdByUserId: userId,
      humanWeight: 20,
      knowledgeType: "words",
      previewText: "A low-scored global Answer.",
      title: `Low Scored Answer ${index}`,
      updatedAt: BASE_TIME + index,
    });
  }

  await insertEntry(ctx, {
    contextTagIds: [],
    contextPreviewTagLabels: [],
    createdByUserId: userId,
    knowledgeType: "lesson",
    previewText: "A recent lesson that needs Human Weight feedback.",
    title: "Recent Unscored Lesson",
    updatedAt: BASE_TIME + 1_000,
  });
}

async function seedHumanWeightConcernRows(ctx: MutationCtx) {
  const userId = await insertUser(ctx, {
    email: "human-weight-concern@example.com",
    name: "Human Weight Concern",
  });
  const tag = await insertTag(ctx, {
    canonicalKey: "human-weight-concern",
    knowledgeType: "topic",
    label: "Human Weight Concern",
  });

  await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Concern"],
    createdByUserId: userId,
    humanWeight: 35,
    knowledgeType: "essay",
    previewText: "An expected essay with low Human Weight.",
    title: "Low Expected Essay",
    updatedAt: BASE_TIME + 3,
  });
  const requiredSlotEssay = await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Concern"],
    createdByUserId: userId,
    humanWeight: 45,
    knowledgeType: "essay",
    previewText: "An essay above the expected threshold but below required.",
    title: "Slot Required Essay",
    updatedAt: BASE_TIME + 4,
  });
  await insertSlot(ctx, {
    contextTagIds: [tag.tagId],
    fulfilledEntryId: requiredSlotEssay,
    humanWeightExpectation: "required",
    requestedKnowledgeType: "essay",
    status: "fulfilled",
    title: "Required student Essay",
  });
  await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Concern"],
    createdByUserId: userId,
    humanWeight: 35,
    knowledgeType: "lesson",
    previewText: "A low-weight lesson where Human Weight is only informative.",
    title: "Low Informative Lesson",
    updatedAt: BASE_TIME + 2,
  });
  await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Concern"],
    createdByUserId: userId,
    humanWeight: 5,
    knowledgeType: "topic",
    previewText: "A non-weight-bearing topic should not carry concern.",
    title: "Low Non Weight Topic",
    updatedAt: BASE_TIME + 1,
  });
  const requiredSlotTopic = await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Concern"],
    createdByUserId: userId,
    humanWeight: 5,
    knowledgeType: "topic",
    previewText: "A non-weight-bearing fulfilled topic stays unflagged.",
    title: "Required Slot Topic",
    updatedAt: BASE_TIME,
  });
  await insertSlot(ctx, {
    contextTagIds: [tag.tagId],
    fulfilledEntryId: requiredSlotTopic,
    humanWeightExpectation: "required",
    requestedKnowledgeType: "topic",
    status: "fulfilled",
    title: "Required topic Slot",
  });

  return { tagId: tag.tagId };
}

async function seedHumanWeightCreditRows(ctx: MutationCtx) {
  const adaUserId = await insertUser(ctx, {
    email: "ada.credit@example.com",
    name: "Ada Teacher",
  });
  const tag = await insertTag(ctx, {
    canonicalKey: "human-weight-credit",
    knowledgeType: "topic",
    label: "Human Weight Credit",
  });
  const lewis = await insertTag(ctx, {
    canonicalKey: "cs-lewis",
    knowledgeType: "person",
    label: "C.S. Lewis",
  });

  const attributedQuote = await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Credit"],
    createdByUserId: adaUserId,
    humanWeight: 92,
    knowledgeType: "quote",
    previewText: "A quote attributed to C.S. Lewis.",
    title: "Quote With Attributed Person",
    updatedAt: BASE_TIME + 3,
  });
  await ctx.db.insert("quoteEntries", {
    entryId: attributedQuote,
    quotedPersonReferentId: lewis.referentId,
  });
  const unattributedQuote = await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Credit"],
    createdByUserId: adaUserId,
    humanWeight: 88,
    knowledgeType: "quote",
    previewText: "A quote without a structured quoted person yet.",
    title: "Quote Without Attributed Person",
    updatedAt: BASE_TIME + 2,
  });
  await ctx.db.insert("quoteEntries", {
    entryId: unattributedQuote,
  });
  await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Credit"],
    createdByUserId: adaUserId,
    humanWeight: 84,
    knowledgeType: "words",
    previewText: "Words authored by the contributor.",
    title: "Authored Words",
    updatedAt: BASE_TIME + 1,
  });
  await insertEntry(ctx, {
    contextTagIds: [tag.tagId],
    contextPreviewTagLabels: ["Human Weight Credit"],
    createdByUserId: adaUserId,
    humanWeight: 5,
    knowledgeType: "topic",
    previewText: "A non-weight-bearing topic.",
    title: "Non Weight Credit Topic",
    updatedAt: BASE_TIME,
  });

  return { tagId: tag.tagId };
}

async function insertUser(
  ctx: MutationCtx,
  user: {
    email: string;
    name: string;
  },
) {
  return await ctx.db.insert("users", {
    email: user.email,
    isActive: true,
    name: user.name,
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
    knowledgeType: tag.knowledgeType,
    canonicalKey: tag.canonicalKey,
    canonicalName: tag.label,
  });
  const tagId = await ctx.db.insert("tags", {
    referentId,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    lookupKey: tag.canonicalKey,
  });

  return { referentId, tagId };
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
    knowledgeType: "organization",
    canonicalKey,
    canonicalName: organization.name,
  });
  const tagId = await ctx.db.insert("tags", {
    referentId: organizationReferentId,
    knowledgeType: "organization",
    label: organization.name,
    lookupKey: canonicalKey,
  });
  const entryId = await ctx.db.insert("knowledgeEntries", {
    knowledgeType: "organization",
    representedReferentId: organizationReferentId,
    primaryTagId: tagId,
    title: organization.name,
    previewText: `${organization.name} organization profile.`,
    searchText: organization.name,
    primaryTagLabel: organization.name,
    contextPreviewTagLabels: [],
    createdByUserId: organization.createdByUserId,
    visibilityKind: "organization",
    visibilityTargetKey: organizationReferentId,
    discoverabilityKind: "organization",
    discoverabilityTargetKey: organizationReferentId,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
  const organizationEntryId = await ctx.db.insert("organizationEntries", {
    entryId,
    organizationKind: "school",
    isActive: true,
  });

  return { organizationEntryId, organizationReferentId };
}

async function insertOrganizationMembership(
  ctx: MutationCtx,
  membership: {
    organizationReferentId: Id<"referents">;
    userId: Id<"users">;
  },
) {
  const personReferentId = await ctx.db.insert("referents", {
    knowledgeType: "person",
    canonicalKey: `person-${membership.userId}`,
    canonicalName: `Person ${membership.userId}`,
  });

  await ctx.db.insert("memberships", {
    personReferentId,
    memberUserId: membership.userId,
    targetKind: "organization",
    organizationReferentId: membership.organizationReferentId,
    membershipStatus: "active",
    memberRole: "member",
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
}

async function insertEntry(
  ctx: MutationCtx,
  entry: {
    contextPreviewTagLabels: string[];
    contextTagIds: Array<Id<"tags">>;
    createdByUserId: Id<"users">;
    humanWeight?: number;
    knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
    previewText: string;
    title: string;
    updatedAt: number;
    visibilityKind?: Doc<"knowledgeEntries">["visibilityKind"];
    visibilityTargetKey?: string;
  },
) {
  const primary = await insertTag(ctx, {
    canonicalKey: slugify(entry.title),
    knowledgeType: entry.knowledgeType,
    label: entry.title,
  });
  const visibilityKind = entry.visibilityKind ?? "public";
  const visibilityTargetKey =
    entry.visibilityTargetKey ?? (visibilityKind === "public" ? "public" : "");
  const entryId = await ctx.db.insert("knowledgeEntries", {
    knowledgeType: entry.knowledgeType,
    representedReferentId: primary.referentId,
    primaryTagId: primary.tagId,
    title: entry.title,
    previewText: entry.previewText,
    searchText: `${entry.title} ${entry.previewText}`,
    primaryTagLabel: entry.title,
    contextPreviewTagLabels: entry.contextPreviewTagLabels,
    createdByUserId: entry.createdByUserId,
    ...(entry.humanWeight === undefined
      ? {}
      : { humanWeight: entry.humanWeight }),
    visibilityKind,
    visibilityTargetKey,
    discoverabilityKind: visibilityKind,
    discoverabilityTargetKey: visibilityTargetKey,
    createdAt: BASE_TIME,
    updatedAt: entry.updatedAt,
  });

  await ctx.db.insert("entryTags", {
    entryId,
    tagId: primary.tagId,
    tagPurpose: "represented",
    taggedAt: BASE_TIME,
  });
  for (const tagId of entry.contextTagIds) {
    await ctx.db.insert("entryTags", {
      entryId,
      tagId,
      tagPurpose: "context",
      taggedAt: BASE_TIME,
    });
  }

  return entryId;
}

async function insertThumbnailForTag(
  ctx: MutationCtx,
  tagId: Id<"tags">,
  externalUrl: string,
) {
  const tag = await ctx.db.get(tagId);
  if (!tag) {
    throw new Error("Missing tag for thumbnail fixture.");
  }

  const knowledgeType = (
    tag.knowledgeType === "biblePassage" ? "words" : tag.knowledgeType
  ) as Doc<"knowledgeEntries">["knowledgeType"];
  const entryId = await ctx.db.insert("knowledgeEntries", {
    knowledgeType,
    representedReferentId: tag.referentId,
    primaryTagId: tag._id,
    title: `${tag.label} thumbnail source`,
    previewText: `${tag.label} thumbnail preview.`,
    searchText: `${tag.label} thumbnail`,
    primaryTagLabel: tag.label,
    contextPreviewTagLabels: [],
    visibilityKind: "public",
    visibilityTargetKey: "public",
    discoverabilityKind: "public",
    discoverabilityTargetKey: "public",
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME + 100,
  });
  await ctx.db.insert("entryTags", {
    entryId,
    tagId: tag._id,
    tagPurpose: "represented",
    taggedAt: BASE_TIME,
  });
  await ctx.db.insert("entryRepresentations", {
    entryId,
    representationKind: "externalUrl",
    representationRole: "thumbnail",
    externalUrl,
    isPrimary: false,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
}

async function insertSlot(
  ctx: MutationCtx,
  slot: {
    contextTagIds: Array<Id<"tags">>;
    dueAt?: number;
    fulfilledEntryId?: Id<"knowledgeEntries">;
    humanWeightExpectation?: Doc<"knowledgeSlots">["humanWeightExpectation"];
    promptText?: string;
    requestedKnowledgeType: Doc<"knowledgeSlots">["requestedKnowledgeType"];
    status?: Doc<"knowledgeSlots">["status"];
    targetKind?: Doc<"knowledgeSlots">["targetKind"];
    targetUserId?: Id<"users">;
    title: string;
  },
) {
  const slotId = await ctx.db.insert("knowledgeSlots", {
    requestedKnowledgeType: slot.requestedKnowledgeType,
    status: slot.status ?? "open",
    title: slot.title,
    ...(slot.promptText === undefined ? {} : { promptText: slot.promptText }),
    contextKey: getContextKey(slot.contextTagIds),
    targetKind: slot.targetKind ?? "public",
    ...(slot.targetUserId === undefined
      ? {}
      : { targetUserId: slot.targetUserId }),
    ...(slot.fulfilledEntryId === undefined
      ? {}
      : { fulfilledEntryId: slot.fulfilledEntryId }),
    ...(slot.humanWeightExpectation === undefined
      ? {}
      : { humanWeightExpectation: slot.humanWeightExpectation }),
    dueAt: slot.dueAt ?? BASE_TIME + 30,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });

  for (const tagId of slot.contextTagIds) {
    await ctx.db.insert("slotTags", {
      slotId,
      tagId,
      addedAt: BASE_TIME,
    });
  }

  return slotId;
}

async function insertHumanWeightFeedback(
  ctx: MutationCtx,
  feedback: {
    entryId: Id<"knowledgeEntries">;
    feedbackKind: Doc<"humanWeightFeedback">["feedbackKind"];
    userId: Id<"users">;
  },
) {
  await ctx.db.insert("humanWeightFeedback", {
    entryId: feedback.entryId,
    userId: feedback.userId,
    feedbackKind: feedback.feedbackKind,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
}

async function insertGlobalExpertVisibilitySetting(
  ctx: MutationCtx,
  setting: {
    enabled: boolean;
    userId: Id<"users">;
  },
) {
  await ctx.db.insert("contextExpertiseVisibilitySettings", {
    userId: setting.userId,
    globalExpertVisibilityEnabled: setting.enabled,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
  });
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
    topSupportingEntryIds: Array<Id<"knowledgeEntries">>;
    audienceScopeKind?: Doc<"contextExpertiseAggregates">["visibilityKind"];
    audienceScopeTargetKey?: string;
    visibilityKind?: Doc<"contextExpertiseAggregates">["visibilityKind"];
    visibilityTargetKey?: string;
  },
) {
  const contextTagIds = [...aggregate.contextTagIds].sort();
  const visibilityKind = aggregate.visibilityKind ?? "public";
  const visibilityTargetKey =
    aggregate.visibilityTargetKey ??
    (visibilityKind === "public" ? "public" : "");

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
    topSupportingEntryIds: aggregate.topSupportingEntryIds,
    visibilityKind,
    visibilityTargetKey,
    ...(aggregate.audienceScopeKind === undefined
      ? {}
      : { audienceScopeKind: aggregate.audienceScopeKind }),
    ...(aggregate.audienceScopeTargetKey === undefined
      ? {}
      : { audienceScopeTargetKey: aggregate.audienceScopeTargetKey }),
    createdAt: BASE_TIME,
    updatedAt: aggregate.latestEvidenceAt,
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

function getAnswerByTitle<T extends { kind: "answer"; entry: { title: string } }>(
  answers: T[],
  title: string,
) {
  const answer = answers.find((item) => item.entry.title === title);
  if (!answer) {
    throw new Error(`Missing Answer "${title}"`);
  }

  return answer;
}
