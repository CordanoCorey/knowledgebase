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
  "./directContributions.ts": () => import("./directContributions"),
  "./lib/contextExpertiseEvidence.ts": () =>
    import("./lib/contextExpertiseEvidence"),
  "./lib/humanWeightEvidence.ts": () => import("./lib/humanWeightEvidence"),
  "./lib/typeBehavior.ts": () => import("./lib/typeBehavior"),
};

const BASE_TIME = Date.UTC(2026, 5, 1, 12);

describe("Direct Contributions", () => {
  test("creates a durable Words Knowledge Entry and makes it visible in the Answer Feed", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAllowedUserWithJoshuaTag);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });
    const input = {
      body: "A youth-ready lesson bridge from courage into obedience.",
      contextTags: [
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
      ],
      knowledgeType: "words" as const,
      title: "Hopeful courage in Joshua",
    };

    const result = await authed.mutation(
      api.directContributions.postDirectContribution,
      input,
    );

    expect(result.entry).toMatchObject({
      contributor: {
        id: seed.userId,
        name: "Direct Contributor",
      },
      id: result.entryId,
      title: "Hopeful courage in Joshua",
      knowledgeType: "words",
      previewText: "A youth-ready lesson bridge from courage into obedience.",
      primaryTagLabel: "Hopeful courage in Joshua",
      contextPreviewTagLabels: ["Joshua 1:6-9", "Courage"],
      humanWeight: 82,
      href: `/entries/${result.entryId}`,
    });

    const rowState = await t.run(async (ctx) => {
      const entry = await ctx.db.get(result.entryId);
      const representedReferent = await ctx.db.get(result.representedReferentId);
      const primaryTag = await ctx.db.get(result.primaryTagId);
      const courageTag = await ctx.db
        .query("tags")
        .withIndex("by_knowledgeType_and_lookupKey", (q) =>
          q.eq("knowledgeType", "topic").eq("lookupKey", "courage"),
        )
        .unique();
      const entryTags = await ctx.db
        .query("entryTags")
        .withIndex("by_entryId_and_tagId", (q) => q.eq("entryId", result.entryId))
        .collect();
      const contextExpertiseEvidence = await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_entryId_and_createdAt", (q) =>
          q.eq("entryId", result.entryId),
        )
        .collect();

      return {
        courageTag,
        contextExpertiseEvidence,
        entry,
        entryTags,
        primaryTag,
        representedReferent,
        sourceCount: (await ctx.db.query("sources").collect()).length,
        smartStorageProposalCount: (
          await ctx.db.query("smartStorageProposals").collect()
        ).length,
        smartStorageRunCount: (await ctx.db.query("smartStorageRuns").collect())
          .length,
      };
    });

    expect(rowState.entry).toEqual(
      expect.objectContaining({
        createdByUserId: seed.userId,
        knowledgeType: "words",
        representedReferentId: result.representedReferentId,
        primaryTagId: result.primaryTagId,
        searchText: expect.stringContaining("Hopeful courage in Joshua"),
        visibilityKind: "public",
        discoverabilityKind: "public",
      }),
    );
    expect(rowState.representedReferent).toEqual(
      expect.objectContaining({
        canonicalName: "Hopeful courage in Joshua",
        knowledgeType: "words",
      }),
    );
    expect(rowState.primaryTag).toEqual(
      expect.objectContaining({
        label: "Hopeful courage in Joshua",
        referentId: result.representedReferentId,
      }),
    );
    expect(rowState.courageTag).toEqual(
      expect.objectContaining({
        label: "Courage",
        lookupKey: "courage",
      }),
    );
    expect(rowState.entryTags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tagId: result.primaryTagId,
          tagPurpose: "represented",
          taggedByUserId: seed.userId,
        }),
        expect.objectContaining({
          tagId: seed.joshuaTagId,
          tagPurpose: "context",
          taggedByUserId: seed.userId,
        }),
        expect.objectContaining({
          tagId: rowState.courageTag?._id,
          tagPurpose: "context",
          taggedByUserId: seed.userId,
        }),
      ]),
    );
    expect(rowState.sourceCount).toBe(0);
    expect(rowState.smartStorageRunCount).toBe(0);
    expect(rowState.smartStorageProposalCount).toBe(0);
    expect(rowState.contextExpertiseEvidence).toEqual([
      expect.objectContaining({
        contextKey: `tags:${[seed.joshuaTagId, rowState.courageTag!._id]
          .sort()
          .join(",")}`,
        contextTagIds: [seed.joshuaTagId, rowState.courageTag!._id].sort(),
        entryId: result.entryId,
        evidenceKind: "post",
        subjectUserId: seed.userId,
        visibilityKind: "public",
        visibilityTargetKey: "public",
      }),
    ]);

    const byIdsFeed = await t.query(api.answerFeed.listForActiveTags, {
      activeTagIds: [seed.joshuaTagId, rowState.courageTag!._id],
      answerLimit: 10,
      slotLimit: 10,
    });
    expect(getAnswerTitles(byIdsFeed)).toContain("Hopeful courage in Joshua");

    const byKeysFeed = await t.query(api.answerFeed.listForActiveTagKeys, {
      activeTags: input.contextTags,
      answerLimit: 10,
      slotLimit: 10,
    });
    expect(getAnswerTitles(byKeysFeed)).toContain("Hopeful courage in Joshua");
  });

  test("omits Human Weight for non-weight-bearing direct contributions", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAllowedUserWithJoshuaTag);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const result = await authed.mutation(
      api.directContributions.postDirectContribution,
      {
        body: "A topic page for gathering courage-related material.",
        contextTags: [],
        knowledgeType: "topic",
        title: "Courage",
      },
    );

    expect(result.entry).toMatchObject({
      contributor: {
        id: seed.userId,
        name: "Direct Contributor",
      },
      id: result.entryId,
      knowledgeType: "topic",
      title: "Courage",
    });
    expect(result.entry).not.toHaveProperty("humanWeight");

    const storedEntry = await t.run(async (ctx) => {
      return await ctx.db.get(result.entryId);
    });
    expect(storedEntry).not.toHaveProperty("humanWeight");
  });

  test("stores direct Questions as Question Knowledge Entries", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAllowedUserWithJoshuaTag);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const result = await authed.mutation(
      api.directContributions.postDirectContribution,
      {
        body: "I need this for seventh grade Bible.",
        contextTags: [
          {
            canonicalKey: "joshua-1-6-9",
            href: "/scripture/joshua-1-6-9",
            id: "joshua-1-6-9",
            knowledgeType: "biblePassage",
            label: "Joshua 1:6-9",
            passageString: "Joshua 1:6-9",
          },
        ],
        knowledgeType: "question",
        title: "How does Joshua 1 define courage?",
      },
    );

    const questionEntry = await t.run(async (ctx) => {
      return await ctx.db
        .query("questionEntries")
        .withIndex("by_entryId", (q) => q.eq("entryId", result.entryId))
        .unique();
    });

    expect(result.entry).toMatchObject({
      knowledgeType: "question",
      title: "How does Joshua 1 define courage?",
    });
    expect(questionEntry).toEqual(
      expect.objectContaining({
        entryId: result.entryId,
        questionText: "How does Joshua 1 define courage?",
      }),
    );
  });

  test("fulfills an open Knowledge Slot with a matching direct contribution", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAllowedUserWithJoshuaTag);
    const slotId = await t.run(async (ctx) =>
      insertSlot(ctx, {
        contextTagIds: [seed.joshuaTagId],
        humanWeightExpectation: "required",
        requestedKnowledgeType: "lesson",
        title: "Required Joshua lesson",
      }),
    );
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const result = await authed.mutation(
      api.directContributions.postDirectContribution,
      {
        body: "A lesson submitted for the required Joshua Slot.",
        contextTags: [
          {
            canonicalKey: "joshua-1-6-9",
            href: "/scripture/joshua-1-6-9",
            id: "joshua-1-6-9",
            knowledgeType: "biblePassage",
            label: "Joshua 1:6-9",
            passageString: "Joshua 1:6-9",
          },
        ],
        knowledgeType: "lesson",
        slotId,
        title: "Required Joshua lesson submission",
      },
    );

    const fulfilledSlot = await t.run(async (ctx) => await ctx.db.get(slotId));

    expect(fulfilledSlot).toEqual(
      expect.objectContaining({
        fulfilledEntryId: result.entryId,
        humanWeightExpectation: "required",
        requestedKnowledgeType: "lesson",
        status: "fulfilled",
      }),
    );
  });

  test("rejects direct Slot fulfillment when the Knowledge Type does not match", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAllowedUserWithJoshuaTag);
    const slotId = await t.run(async (ctx) =>
      insertSlot(ctx, {
        contextTagIds: [seed.joshuaTagId],
        requestedKnowledgeType: "lesson",
        title: "Lesson-only Slot",
      }),
    );
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    await expect(
      authed.mutation(api.directContributions.postDirectContribution, {
        body: "This is not a lesson.",
        contextTags: [
          {
            canonicalKey: "joshua-1-6-9",
            href: "/scripture/joshua-1-6-9",
            id: "joshua-1-6-9",
            knowledgeType: "biblePassage",
            label: "Joshua 1:6-9",
            passageString: "Joshua 1:6-9",
          },
        ],
        knowledgeType: "words",
        slotId,
        title: "Wrong type Slot submission",
      }),
    ).rejects.toThrow("must match the Knowledge Slot request");

    const state = await t.run(async (ctx) => {
      const slot = await ctx.db.get(slotId);
      const matchingEntries = await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_createdByUserId", (q) => q.eq("createdByUserId", seed.userId))
        .collect();

      return {
        hasWrongTypeSubmission: matchingEntries.some(
          (entry) => entry.title === "Wrong type Slot submission",
        ),
        slot,
      };
    });

    expect(state.hasWrongTypeSubmission).toBe(false);
    expect(state.slot).toEqual(expect.objectContaining({ status: "open" }));
    expect(state.slot).not.toHaveProperty("fulfilledEntryId");
  });

  test("requires app access before creating direct Gold records", async () => {
    const unauthenticated = convexTest({ schema, modules });
    await expect(
      unauthenticated.mutation(api.directContributions.postDirectContribution, {
        body: "No user.",
        contextTags: [],
        knowledgeType: "words",
        title: "Unauthenticated entry",
      }),
    ).rejects.toThrow("Unauthorized");
    expect(await countEntries(unauthenticated)).toBe(0);

    const inactive = convexTest({ schema, modules });
    const inactiveUserId = await inactive.run(insertInactiveUser);
    await expect(
      inactive
        .withIdentity({ subject: `${inactiveUserId}|test-session` })
        .mutation(api.directContributions.postDirectContribution, {
          body: "Inactive user.",
          contextTags: [],
          knowledgeType: "words",
          title: "Inactive entry",
        }),
    ).rejects.toThrow("Unauthorized");
    expect(await countEntries(inactive)).toBe(0);

    const noOrganization = convexTest({ schema, modules });
    const noOrganizationUserId = await noOrganization.run(insertActiveUser);
    await expect(
      noOrganization
        .withIdentity({ subject: `${noOrganizationUserId}|test-session` })
        .mutation(api.directContributions.postDirectContribution, {
          body: "No organization.",
          contextTags: [],
          knowledgeType: "words",
          title: "No organization entry",
        }),
    ).rejects.toThrow("Unauthorized");
    expect(await countEntries(noOrganization)).toBe(0);
  });

  test("rejects duplicate represented Referents instead of silently creating another entry", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedAllowedUserWithJoshuaTag);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });
    const input = {
      body: "First version.",
      contextTags: [],
      knowledgeType: "words" as const,
      title: "One represented identity",
    };

    await authed.mutation(api.directContributions.postDirectContribution, input);

    await expect(
      authed.mutation(api.directContributions.postDirectContribution, {
        ...input,
        body: "Second version.",
      }),
    ).rejects.toThrow("already represents this Referent");

    const directEntries = await t.run(async (ctx) => {
      return await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_createdByUserId", (q) => q.eq("createdByUserId", seed.userId))
        .collect();
    });
    expect(directEntries.filter((entry) => entry.knowledgeType === "words"))
      .toHaveLength(1);
  });
});

function getAnswerTitles(
  feedItems: Array<
    | { kind: "answer"; entry: { title: string } }
    | { kind: "slot"; slot: { title: string } }
  >,
) {
  return feedItems
    .filter((item): item is { kind: "answer"; entry: { title: string } } =>
      item.kind === "answer",
    )
    .map((item) => item.entry.title);
}

async function countEntries(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return (await ctx.db.query("knowledgeEntries").collect()).length;
  });
}

async function seedAllowedUserWithJoshuaTag(ctx: MutationCtx) {
  const userId = await insertAllowedUser(ctx);
  const joshua = await insertTag(ctx, {
    canonicalKey: "joshua-1-6-9",
    knowledgeType: "biblePassage",
    label: "Joshua 1:6-9",
  });

  return {
    joshuaTagId: joshua.tagId,
    userId,
  };
}

async function insertAllowedUser(ctx: MutationCtx) {
  const now = Date.now();
  const userId = await insertActiveUser(ctx);
  const organization = await insertTag(ctx, {
    canonicalKey: "arche-classical-academy",
    knowledgeType: "organization",
    label: "Arche Classical Academy",
  });
  const organizationEntryId = await ctx.db.insert("knowledgeEntries", {
    knowledgeType: "organization",
    representedReferentId: organization.referentId,
    primaryTagId: organization.tagId,
    title: "Arche Classical Academy",
    previewText: "School organization.",
    searchText: "Arche Classical Academy School organization.",
    primaryTagLabel: "Arche Classical Academy",
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
  const person = await insertTag(ctx, {
    canonicalKey: "direct-contributor",
    knowledgeType: "person",
    label: "Direct Contributor",
  });
  await ctx.db.insert("memberships", {
    personReferentId: person.referentId,
    memberUserId: userId,
    targetKind: "organization",
    organizationReferentId: organization.referentId,
    membershipStatus: "active",
    memberRole: "admin",
    createdAt: now,
    updatedAt: now,
  });

  return userId;
}

async function insertActiveUser(ctx: MutationCtx) {
  return await ctx.db.insert("users", {
    email: "direct.contributor@example.com",
    isActive: true,
    name: "Direct Contributor",
  });
}

async function insertInactiveUser(ctx: MutationCtx) {
  return await ctx.db.insert("users", {
    email: "inactive.direct@example.com",
    isActive: false,
    name: "Inactive Direct Contributor",
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

async function insertSlot(
  ctx: MutationCtx,
  slot: {
    contextTagIds: Array<Id<"tags">>;
    humanWeightExpectation?: Doc<"knowledgeSlots">["humanWeightExpectation"];
    requestedKnowledgeType: Doc<"knowledgeSlots">["requestedKnowledgeType"];
    title: string;
  },
) {
  const slotId = await ctx.db.insert("knowledgeSlots", {
    requestedKnowledgeType: slot.requestedKnowledgeType,
    status: "open",
    title: slot.title,
    contextKey: getContextKey(slot.contextTagIds),
    targetKind: "public",
    ...(slot.humanWeightExpectation === undefined
      ? {}
      : { humanWeightExpectation: slot.humanWeightExpectation }),
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

function getContextKey(tagIds: Array<Id<"tags">>) {
  return `tags:${[...tagIds].sort().join(",")}`;
}
