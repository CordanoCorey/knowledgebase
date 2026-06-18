/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./humanWeightFeedback.ts": () => import("./humanWeightFeedback"),
  "./lib/appAccess.ts": () => import("./lib/appAccess"),
  "./lib/contextExpertiseEvidence.ts": () =>
    import("./lib/contextExpertiseEvidence"),
  "./lib/humanWeightEvidence.ts": () => import("./lib/humanWeightEvidence"),
  "./lib/typeBehavior.ts": () => import("./lib/typeBehavior"),
};

describe("Human Weight Feedback", () => {
  test("records and updates feedback for a weight-bearing Knowledge Entry", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedHumanWeightFeedbackRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    const created = await authed.mutation(api.humanWeightFeedback.record, {
      entryId: seed.entries.lesson,
      feedbackKind: "recognize",
      feedbackNote: "This has real classroom substance.",
    });
    expect(created.status).toBe("created");

    const updated = await authed.mutation(api.humanWeightFeedback.record, {
      entryId: seed.entries.lesson,
      feedbackKind: "recognize",
      feedbackNote: "Used and recognized by teachers.",
    });
    expect(updated).toEqual({
      feedbackId: created.feedbackId,
      status: "updated",
    });

    const rowState = await t.run(async (ctx) => ({
      contextExpertiseEvidence: await ctx.db
        .query("contextExpertiseEvidence")
        .withIndex("by_feedbackId", (q) => q.eq("feedbackId", created.feedbackId))
        .collect(),
      feedbackRows: await ctx.db.query("humanWeightFeedback").collect(),
    }));
    expect(rowState.feedbackRows).toHaveLength(1);
    expect(rowState.feedbackRows[0]).toEqual(
      expect.objectContaining({
        entryId: seed.entries.lesson,
        feedbackKind: "recognize",
        feedbackNote: "Used and recognized by teachers.",
        userId: seed.userId,
      }),
    );
    expect(rowState.contextExpertiseEvidence).toEqual([
      expect.objectContaining({
        contextKey: "tags:",
        contextTagIds: [],
        entryId: seed.entries.lesson,
        evidenceKind: "feedback",
        feedbackId: created.feedbackId,
        subjectUserId: seed.userId,
        visibilityKind: "public",
        visibilityTargetKey: "public",
      }),
    ]);
  });

  test("rejects feedback for non-weight-bearing Knowledge Entries", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedHumanWeightFeedbackRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    await expect(
      authed.mutation(api.humanWeightFeedback.record, {
        entryId: seed.entries.topic,
        feedbackKind: "recognize",
      }),
    ).rejects.toThrow(
      "Human Weight Feedback applies only to weight-bearing Knowledge Entries.",
    );
  });

  test("summarizes Evidence Maturity from positive and correction feedback", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedHumanWeightFeedbackRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    await authed.mutation(api.humanWeightFeedback.record, {
      entryId: seed.entries.lesson,
      feedbackKind: "recognize",
    });
    await authed.mutation(api.humanWeightFeedback.record, {
      entryId: seed.entries.lesson,
      feedbackKind: "used",
    });
    await authed.mutation(api.humanWeightFeedback.record, {
      entryId: seed.entries.lesson,
      feedbackKind: "notHuman",
    });

    await expect(
      authed.query(api.humanWeightFeedback.getEvidenceSummary, {
        entryId: seed.entries.lesson,
      }),
    ).resolves.toEqual({
      evidenceCount: 3,
      positiveEvidenceCount: 2,
      negativeEvidenceCount: 1,
      evidenceMaturity: 60,
    });
  });

  test("omits Evidence Maturity for non-weight-bearing Knowledge Entries", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedHumanWeightFeedbackRows);
    const authed = t.withIdentity({ subject: `${seed.userId}|test-session` });

    await expect(
      authed.query(api.humanWeightFeedback.getEvidenceSummary, {
        entryId: seed.entries.topic,
      }),
    ).resolves.toBeNull();
  });

  test("requires authenticated app access", async () => {
    const t = convexTest({ schema, modules });
    const seed = await t.run(seedHumanWeightFeedbackRows);

    await expect(
      t.mutation(api.humanWeightFeedback.record, {
        entryId: seed.entries.lesson,
        feedbackKind: "used",
      }),
    ).rejects.toThrow("Unauthorized");
  });
});

async function seedHumanWeightFeedbackRows(ctx: MutationCtx) {
  const userId = await ctx.db.insert("users", {
    email: "feedback@example.com",
    isActive: true,
    name: "Feedback User",
    systemRole: "systemAdmin",
  });
  const lesson = await insertEntry(ctx, {
    createdByUserId: userId,
    humanWeight: 82,
    knowledgeType: "lesson",
    previewText: "A lesson with classroom substance.",
    title: "Courage Lesson",
  });
  const topic = await insertEntry(ctx, {
    createdByUserId: userId,
    knowledgeType: "topic",
    previewText: "A topic entry.",
    title: "Courage",
  });

  return {
    entries: {
      lesson,
      topic,
    },
    userId,
  };
}

async function insertEntry(
  ctx: MutationCtx,
  entry: {
    createdByUserId: Id<"users">;
    humanWeight?: number;
    knowledgeType: Doc<"knowledgeEntries">["knowledgeType"];
    previewText: string;
    title: string;
  },
) {
  const now = Date.now();
  const referentId = await ctx.db.insert("referents", {
    canonicalKey: slugify(entry.title),
    canonicalName: entry.title,
    knowledgeType: entry.knowledgeType,
  });
  const tagId = await ctx.db.insert("tags", {
    knowledgeType: entry.knowledgeType,
    label: entry.title,
    lookupKey: slugify(entry.title),
    referentId,
  });

  return await ctx.db.insert("knowledgeEntries", {
    contextPreviewTagLabels: [],
    createdAt: now,
    createdByUserId: entry.createdByUserId,
    discoverabilityKind: "public",
    discoverabilityTargetKey: "public",
    ...(entry.humanWeight === undefined
      ? {}
      : { humanWeight: entry.humanWeight }),
    knowledgeType: entry.knowledgeType,
    previewText: entry.previewText,
    primaryTagId: tagId,
    primaryTagLabel: entry.title,
    representedReferentId: referentId,
    searchText: `${entry.title} ${entry.previewText}`,
    title: entry.title,
    updatedAt: now,
    visibilityKind: "public",
    visibilityTargetKey: "public",
  });
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
