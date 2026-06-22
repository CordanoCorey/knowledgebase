/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./contributionDrafts.ts": () => import("./contributionDrafts"),
  "./lib/appAccess.ts": () => import("./lib/appAccess"),
};

const BASE_TIME = Date.UTC(2026, 5, 1, 12);

describe("Contribution Drafts", () => {
  test("saves, restores, replaces, and clears a composer draft without creating contribution records", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(insertAllowedUser);
    const authed = t.withIdentity({ subject: `${userId}|test-session` });
    const draftKey = "contribution-editor|dashboard|global|slot:none";

    await authed.mutation(api.contributionDrafts.save, {
      bodyDocumentJson:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft chapel notes."}]}]}',
      bodyPlainText: "Draft chapel notes.",
      draftKey,
      placementLabel: "Dashboard",
      selectedKnowledgeType: "words",
      title: "Draft title",
    });

    expect(await authed.query(api.contributionDrafts.getForDraftKey, { draftKey }))
      .toEqual(
        expect.objectContaining({
          bodyPlainText: "Draft chapel notes.",
          draftKey,
          placementLabel: "Dashboard",
          selectedKnowledgeType: "words",
          title: "Draft title",
          userId,
        }),
      );

    await authed.mutation(api.contributionDrafts.save, {
      bodyDocumentJson:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Updated draft."}]}]}',
      bodyPlainText: "Updated draft.",
      draftKey,
      title: "",
    });

    const updated = await authed.query(api.contributionDrafts.getForDraftKey, {
      draftKey,
    });
    expect(updated).toEqual(
      expect.objectContaining({
        bodyPlainText: "Updated draft.",
        title: "",
      }),
    );
    expect(updated).not.toHaveProperty("selectedKnowledgeType");
    expect(updated).not.toHaveProperty("placementLabel");

    const rowCounts = await t.run(async (ctx) => ({
      contributionSubmissionCount: (
        await ctx.db.query("contributionSubmissions").collect()
      ).length,
      entryCount: (await ctx.db.query("knowledgeEntries").collect()).length,
      sourceCount: (await ctx.db.query("sources").collect()).length,
      sourceOutputCount: (await ctx.db.query("sourceOutputs").collect()).length,
      smartStorageProposalCount: (
        await ctx.db.query("smartStorageProposals").collect()
      ).length,
      smartStorageRunCount: (await ctx.db.query("smartStorageRuns").collect())
        .length,
    }));

    expect(rowCounts).toMatchObject({
      contributionSubmissionCount: 0,
      sourceCount: 0,
      sourceOutputCount: 0,
      smartStorageProposalCount: 0,
      smartStorageRunCount: 0,
    });
    expect(rowCounts.entryCount).toBe(1);

    await authed.mutation(api.contributionDrafts.clear, { draftKey });
    expect(await authed.query(api.contributionDrafts.getForDraftKey, { draftKey }))
      .toBeNull();
  });

  test("requires app access", async () => {
    const t = convexTest({ schema, modules });

    await expect(
      t.mutation(api.contributionDrafts.save, {
        bodyDocumentJson: "{}",
        bodyPlainText: "No user",
        draftKey: "contribution-editor|global",
        title: "",
      }),
    ).rejects.toThrow("Unauthorized");
  });
});

async function insertAllowedUser(ctx: MutationCtx) {
  const now = BASE_TIME;
  const userId = await ctx.db.insert("users", {
    email: "draft.contributor@example.com",
    isActive: true,
    name: "Draft Contributor",
  });
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
    canonicalKey: "draft-contributor",
    knowledgeType: "person",
    label: "Draft Contributor",
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
