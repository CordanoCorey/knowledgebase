import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const MAX_CONTEXT_TAGS = 20;

type ContextExpertiseEvidenceKind =
  Doc<"contextExpertiseEvidence">["evidenceKind"];

type RecordContextExpertiseEvidenceArgs = {
  contextTagIds: Array<Id<"tags">>;
  entryId: Id<"knowledgeEntries">;
  evidenceKind: ContextExpertiseEvidenceKind;
  feedbackId?: Id<"humanWeightFeedback">;
  now: number;
  subjectUserId: Id<"users">;
};

export async function recordContextExpertiseEvidence(
  ctx: MutationCtx,
  args: RecordContextExpertiseEvidenceArgs,
) {
  const entry = await ctx.db.get(args.entryId);
  if (!entry) {
    throw new Error("Knowledge Entry not found.");
  }

  const existing =
    args.feedbackId === undefined
      ? null
      : await ctx.db
          .query("contextExpertiseEvidence")
          .withIndex("by_feedbackId", (q) => q.eq("feedbackId", args.feedbackId))
          .first();
  const contextTagIds = normalizeContextTagIds(args.contextTagIds);
  const evidence = {
    subjectUserId: args.subjectUserId,
    ...(await getSubjectPersonFields(ctx, args.subjectUserId)),
    contextKey: getContextKey(contextTagIds),
    contextTagIds,
    evidenceKind: args.evidenceKind,
    entryId: args.entryId,
    ...(args.feedbackId === undefined ? {} : { feedbackId: args.feedbackId }),
    visibilityKind: entry.visibilityKind,
    visibilityTargetKey: entry.visibilityTargetKey,
    updatedAt: args.now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, evidence);
    return existing._id;
  }

  return await ctx.db.insert("contextExpertiseEvidence", {
    ...evidence,
    createdAt: args.now,
  });
}

export async function getEntryContextTagIds(
  ctx: MutationCtx,
  entryId: Id<"knowledgeEntries">,
) {
  const rows = await ctx.db
    .query("entryTags")
    .withIndex("by_entryId_and_tagPurpose", (q) =>
      q.eq("entryId", entryId).eq("tagPurpose", "context"),
    )
    .take(MAX_CONTEXT_TAGS + 1);

  return normalizeContextTagIds(rows.map((row) => row.tagId));
}

async function getSubjectPersonFields(
  ctx: MutationCtx,
  subjectUserId: Id<"users">,
) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", subjectUserId))
    .first();

  return profile === null
    ? {}
    : { subjectPersonReferentId: profile.personReferentId };
}

function normalizeContextTagIds(tagIds: Array<Id<"tags">>) {
  return [...new Set(tagIds)].sort().slice(0, MAX_CONTEXT_TAGS);
}

function getContextKey(tagIds: Array<Id<"tags">>) {
  return `tags:${tagIds.join(",")}`;
}
