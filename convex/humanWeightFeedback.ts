import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAppAccess } from "./lib/appAccess";
import {
  correctPostContextExpertiseEvidenceForWrongContext,
  getEntryContextTagIds,
  recordContextExpertiseEvidence,
} from "./lib/contextExpertiseEvidence";
import { summarizeHumanWeightEvidence } from "./lib/humanWeightEvidence";
import { isWeightBearingEntryKnowledgeType } from "./lib/typeBehavior";

const MAX_FEEDBACK_NOTE_LENGTH = 1_000;

const feedbackKind = v.union(
  v.literal("recognize"),
  v.literal("used"),
  v.literal("notHuman"),
  v.literal("wrongContext"),
);

const evidenceSummary = v.object({
  evidenceCount: v.number(),
  positiveEvidenceCount: v.number(),
  negativeEvidenceCount: v.number(),
  evidenceMaturity: v.number(),
});

export const getEvidenceSummary = query({
  args: {
    entryId: v.id("knowledgeEntries"),
  },
  returns: v.union(evidenceSummary, v.null()),
  handler: async (ctx, args) => {
    await requireAppAccess(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Knowledge Entry not found.");
    }

    const feedbackRows = await ctx.db
      .query("humanWeightFeedback")
      .withIndex("by_entryId_and_createdAt", (q) =>
        q.eq("entryId", args.entryId),
      )
      .collect();
    const derivedEvidenceRows = await ctx.db
      .query("humanWeightEvidence")
      .withIndex("by_entryId_and_createdAt", (q) =>
        q.eq("entryId", args.entryId),
      )
      .collect();

    return (
      summarizeHumanWeightEvidence(entry.knowledgeType, [
        ...feedbackRows,
        ...derivedEvidenceRows,
      ]) ?? null
    );
  },
});

export const record = mutation({
  args: {
    entryId: v.id("knowledgeEntries"),
    feedbackKind,
    feedbackNote: v.optional(v.string()),
  },
  returns: v.object({
    feedbackId: v.id("humanWeightFeedback"),
    status: v.union(v.literal("created"), v.literal("updated")),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      throw new Error("Knowledge Entry not found.");
    }
    if (!isWeightBearingEntryKnowledgeType(entry.knowledgeType)) {
      throw new Error(
        "Human Weight Feedback applies only to weight-bearing Knowledge Entries.",
      );
    }

    const now = Date.now();
    const contextTagIds = await getEntryContextTagIds(ctx, args.entryId);
    const feedbackNote =
      args.feedbackNote === undefined
        ? undefined
        : limitString(args.feedbackNote, MAX_FEEDBACK_NOTE_LENGTH);
    const existingRows = await ctx.db
      .query("humanWeightFeedback")
      .withIndex("by_entryId_and_userId_and_feedbackKind", (q) =>
        q
          .eq("entryId", args.entryId)
          .eq("userId", access.userId)
          .eq("feedbackKind", args.feedbackKind),
      )
      .take(1);
    const existing = existingRows[0];

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(feedbackNote === undefined ? {} : { feedbackNote }),
        updatedAt: now,
      });
      await recordContextExpertiseEvidence(ctx, {
        contextTagIds,
        entryId: args.entryId,
        evidenceKind: "feedback",
        feedbackId: existing._id,
        now,
        subjectUserId: access.userId,
      });
      if (args.feedbackKind === "wrongContext") {
        await correctPostContextExpertiseEvidenceForWrongContext(ctx, {
          contextTagIds,
          entryId: args.entryId,
          feedbackId: existing._id,
          now,
        });
      }
      return {
        feedbackId: existing._id,
        status: "updated" as const,
      };
    }

    const feedbackId = await ctx.db.insert("humanWeightFeedback", {
      entryId: args.entryId,
      userId: access.userId,
      feedbackKind: args.feedbackKind,
      ...(feedbackNote === undefined ? {} : { feedbackNote }),
      createdAt: now,
      updatedAt: now,
    });

    await recordContextExpertiseEvidence(ctx, {
      contextTagIds,
      entryId: args.entryId,
      evidenceKind: "feedback",
      feedbackId,
      now,
      subjectUserId: access.userId,
    });
    if (args.feedbackKind === "wrongContext") {
      await correctPostContextExpertiseEvidenceForWrongContext(ctx, {
        contextTagIds,
        entryId: args.entryId,
        feedbackId,
        now,
      });
    }

    return {
      feedbackId,
      status: "created" as const,
    };
  },
});

function limitString(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}
