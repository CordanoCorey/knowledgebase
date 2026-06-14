import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

const MAX_SOURCE_TEXT_LENGTH = 40_000;
const MAX_SOURCE_NAME_LENGTH = 240;
const MAX_FEEDBACK_NOTE_LENGTH = 4_000;
const MAX_PREDICTED_ENTRIES = 5;
const MAX_TITLE_LENGTH = 240;
const MAX_REASON_LENGTH = 500;
const MAX_EXCERPT_LENGTH = 500;
const MAX_BODY_PREVIEW_LENGTH = 500;

const sourceKind = v.union(
  v.literal("pastedText"),
  v.literal("uploadedFile"),
  v.literal("externalUrl"),
  v.literal("manualEntry"),
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

const feedbackRating = v.union(
  v.literal("accurate"),
  v.literal("close"),
  v.literal("wrong"),
);

const predictedEntry = v.object({
  knowledgeType: entryKnowledgeType,
  title: v.string(),
  confidence: v.number(),
  reason: v.string(),
  sourceExcerpt: v.string(),
});

const submittedEntry = v.object({
  knowledgeType: entryKnowledgeType,
  title: v.string(),
  bodyPreview: v.string(),
});

export const recordFeedback = mutation({
  args: {
    feedbackNote: v.optional(v.string()),
    feedbackRating,
    intendedKnowledgeType: entryKnowledgeType,
    predictedEntries: v.array(predictedEntry),
    sourceKind,
    sourceName: v.optional(v.string()),
    sourceSizeBytes: v.number(),
    sourceText: v.string(),
    submittedEntry: v.optional(submittedEntry),
  },
  returns: v.object({
    feedbackId: v.id("smartStoragePlaygroundFeedback"),
    predictionCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Unauthorized");
    }

    const predictedEntries = args.predictedEntries
      .slice(0, MAX_PREDICTED_ENTRIES)
      .map((entry) => ({
        knowledgeType: entry.knowledgeType,
        title: limitString(entry.title, MAX_TITLE_LENGTH),
        confidence: Math.max(0, Math.min(entry.confidence, 1)),
        reason: limitString(entry.reason, MAX_REASON_LENGTH),
        sourceExcerpt: limitString(entry.sourceExcerpt, MAX_EXCERPT_LENGTH),
      }));

    const sourceText = limitString(args.sourceText, MAX_SOURCE_TEXT_LENGTH);
    const sourceName =
      args.sourceName === undefined
        ? undefined
        : limitString(args.sourceName, MAX_SOURCE_NAME_LENGTH);
    const feedbackNote =
      args.feedbackNote === undefined
        ? undefined
        : limitString(args.feedbackNote, MAX_FEEDBACK_NOTE_LENGTH);
    const submitted =
      args.submittedEntry === undefined
        ? undefined
        : {
            knowledgeType: args.submittedEntry.knowledgeType,
            title: limitString(args.submittedEntry.title, MAX_TITLE_LENGTH),
            bodyPreview: limitString(
              args.submittedEntry.bodyPreview,
              MAX_BODY_PREVIEW_LENGTH,
            ),
          };

    const feedbackId = await ctx.db.insert("smartStoragePlaygroundFeedback", {
      userId,
      sourceKind: args.sourceKind,
      ...(sourceName === undefined ? {} : { sourceName }),
      sourceText,
      sourceSizeBytes: Math.max(0, Math.floor(args.sourceSizeBytes)),
      predictedEntries,
      ...(submitted === undefined ? {} : { submittedEntry: submitted }),
      intendedKnowledgeType: args.intendedKnowledgeType,
      feedbackRating: args.feedbackRating,
      ...(feedbackNote === undefined ? {} : { feedbackNote }),
      createdAt: Date.now(),
    });

    return {
      feedbackId,
      predictionCount: predictedEntries.length,
    };
  },
});

function limitString(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}
