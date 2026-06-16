/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./smartStorage.ts": () => import("./smartStorage"),
};

describe("Smart Storage contribution starts", () => {
  test("preserves a Bronze Source and queues a Smart Storage Run", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });

    const result = await authed.mutation(api.smartStorage.startFromContribution, {
      body: "  Objective: students will distinguish courage from presumption.  ",
      contextTags: [
        {
          canonicalKey: "joshua-1-6-9",
          href: "/scripture/joshua-1-6-9",
          id: "joshua-1-6-9",
          knowledgeType: "biblePassage",
          label: "Joshua 1:6-9",
          passageString: "Joshua 1:6-9",
        },
        {
          canonicalKey: "courage",
          href: "/goto/courage",
          id: "courage",
          knowledgeType: "topic",
          label: "Courage",
        },
      ],
      knowledgeType: "lesson",
      slotId: "slot-joshua-courage-lesson",
      title: "  Courage in Joshua  ",
    });

    expect(result.status).toBe("queued");

    const source = await t.run(async (ctx) => await ctx.db.get(result.sourceId));
    expect(source).toEqual(
      expect.objectContaining({
        rawText: "Objective: students will distinguish courage from presumption.",
        sourceKind: "manualEntry",
        submittedByUserId: userId,
        title: "Courage in Joshua",
      }),
    );

    const run = await t.run(
      async (ctx) => await ctx.db.get(result.smartStorageRunId),
    );
    expect(run).toEqual(
      expect.objectContaining({
        contextTags: [
          {
            canonicalKey: "joshua-1-6-9",
            href: "/scripture/joshua-1-6-9",
            id: "joshua-1-6-9",
            knowledgeType: "biblePassage",
            label: "Joshua 1:6-9",
            passageString: "Joshua 1:6-9",
          },
          {
            canonicalKey: "courage",
            href: "/goto/courage",
            id: "courage",
            knowledgeType: "topic",
            label: "Courage",
          },
        ],
        contributionBodyPreview:
          "Objective: students will distinguish courage from presumption.",
        contributionTitle: "Courage in Joshua",
        contractSnapshotVersion: "mvp-smart-storage-contract-v0",
        createdByUserId: userId,
        requestedKnowledgeType: "lesson",
        slotId: "slot-joshua-courage-lesson",
        sourceId: result.sourceId,
        status: "queued",
        typeBehaviorSnapshotVersion: "mvp-type-behavior-v0",
      }),
    );
  });

  test("requires app access before creating Source or Run records", async () => {
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

    const rowCounts = await t.run(async (ctx) => ({
      runs: (await ctx.db.query("smartStorageRuns").collect()).length,
      sources: (await ctx.db.query("sources").collect()).length,
    }));
    expect(rowCounts).toEqual({
      runs: 0,
      sources: 0,
    });
  });

  test("generates a drafted Silver Proposal from a queued Smart Storage Run", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const startResult = await authed.mutation(
      api.smartStorage.startFromContribution,
      getLessonSmartStorageInput(),
    );

    const result = await authed.mutation(
      api.smartStorage.generateDraftProposalForRun,
      {
        smartStorageRunId: startResult.smartStorageRunId,
      },
    );

    expect(result).toMatchObject({
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

    const proposal = await t.run(
      async (ctx) => await ctx.db.get(result.smartStorageProposalId),
    );
    expect(proposal).toEqual(
      expect.objectContaining({
        contractSnapshotVersion: "mvp-smart-storage-contract-v0",
        createdByUserId: userId,
        smartStorageRunId: startResult.smartStorageRunId,
        sourceId: startResult.sourceId,
        status: "drafted",
        typeBehaviorSnapshotVersion: "mvp-type-behavior-v0",
      }),
    );
    expect(proposal?.originalProposal).toEqual({
      bodyPreview:
        "Objective: students will distinguish courage from presumption.",
      contextTags: [
        {
          canonicalKey: "joshua-1-6-9",
          href: "/scripture/joshua-1-6-9",
          id: "joshua-1-6-9",
          knowledgeType: "biblePassage",
          label: "Joshua 1:6-9",
          passageString: "Joshua 1:6-9",
        },
        {
          canonicalKey: "courage",
          href: "/goto/courage",
          id: "courage",
          knowledgeType: "topic",
          label: "Courage",
        },
      ],
      knowledgeType: "lesson",
      proposalConfidence: "medium",
      rationale: expect.stringContaining("Deterministic MVP proposal"),
      title: "Courage in Joshua",
    });
    expect(proposal?.currentProposal).toEqual(proposal?.originalProposal);

    const run = await t.run(
      async (ctx) => await ctx.db.get(startResult.smartStorageRunId),
    );
    expect(run).toEqual(
      expect.objectContaining({
        completedAt: expect.any(Number),
        rawModelOutput: expect.any(String),
        status: "succeeded",
      }),
    );
    const rawOutput = JSON.parse(run?.rawModelOutput ?? "{}");
    expect(rawOutput).toMatchObject({
      generatorVersion: "mvp-deterministic-proposal-v0",
      proposal: {
        knowledgeType: "lesson",
        proposalConfidence: "medium",
        title: "Courage in Joshua",
      },
    });
  });

  test("returns the existing drafted Proposal when processing the same Run twice", async () => {
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
    const proposalRows = await t.run(
      async (ctx) => await ctx.db.query("smartStorageProposals").collect(),
    );
    expect(proposalRows).toHaveLength(1);
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

function getLessonSmartStorageInput() {
  return {
    body: "  Objective: students will distinguish courage from presumption.  ",
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
    knowledgeType: "lesson" as const,
    slotId: "slot-joshua-courage-lesson",
    title: "  Courage in Joshua  ",
  };
}

async function insertActiveUserWithoutOrganization(
  ctx: MutationCtx,
  suffix = "",
) {
  const userSuffix = suffix ? `-${suffix}` : "";
  return await ctx.db.insert("users", {
    email: `smart-storage${userSuffix}@example.com`,
    isActive: true,
    name: `Smart Storage User${suffix ? ` ${suffix}` : ""}`,
  });
}

async function insertAllowedUser(ctx: MutationCtx, suffix = "") {
  const now = Date.now();
  const userId = await insertActiveUserWithoutOrganization(ctx, suffix);
  const keySuffix = suffix ? `-${suffix}` : "";
  const organizationReferentId = await ctx.db.insert("referents", {
    canonicalKey: `arche-classical-academy${keySuffix}`,
    canonicalName: `Arche Classical Academy${suffix ? ` ${suffix}` : ""}`,
    knowledgeType: "organization",
  });
  const organizationTagId = await ctx.db.insert("tags", {
    referentId: organizationReferentId,
    knowledgeType: "organization",
    label: `Arche Classical Academy${suffix ? ` ${suffix}` : ""}`,
    lookupKey: `arche-classical-academy${keySuffix}`,
    createdByUserId: userId,
  });
  const organizationEntryId = await ctx.db.insert("knowledgeEntries", {
    knowledgeType: "organization",
    representedReferentId: organizationReferentId,
    primaryTagId: organizationTagId,
    title: `Arche Classical Academy${suffix ? ` ${suffix}` : ""}`,
    previewText: "School organization.",
    searchText: `Arche Classical Academy${
      suffix ? ` ${suffix}` : ""
    } School organization.`,
    primaryTagLabel: `Arche Classical Academy${suffix ? ` ${suffix}` : ""}`,
    contextPreviewTagLabels: [],
    humanWeight: 0,
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
    canonicalName: `Smart Storage User${suffix ? ` ${suffix}` : ""}`,
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
