import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAppAccess } from "./lib/appAccess";

// Contribution drafts persist editor state per user and placement so route
// changes do not drop in-progress work.
const MAX_DRAFT_KEY_LENGTH = 600;
const MAX_DRAFT_BODY_LENGTH = 40_000;
const MAX_DRAFT_DOCUMENT_JSON_LENGTH = 160_000;
const MAX_TITLE_LENGTH = 240;
const MAX_PLACEMENT_LABEL_LENGTH = 500;
const MAX_SLOT_ID_LENGTH = 240;

const entryKnowledgeType = v.union(
  v.literal("words"),
  v.literal("announcement"),
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

export const getForDraftKey = query({
  args: {
    draftKey: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const draftKey = normalizeDraftKey(args.draftKey);

    return await ctx.db
      .query("contributionDrafts")
      .withIndex("by_userId_and_draftKey", (q) =>
        q.eq("userId", access.userId).eq("draftKey", draftKey),
      )
      .unique();
  },
});

export const save = mutation({
  args: {
    bodyDocumentJson: v.string(),
    bodyPlainText: v.string(),
    draftKey: v.string(),
    placementLabel: v.optional(v.string()),
    selectedKnowledgeType: v.optional(entryKnowledgeType),
    slotId: v.optional(v.string()),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const now = Date.now();
    const draftKey = normalizeDraftKey(args.draftKey);
    const existing = await ctx.db
      .query("contributionDrafts")
      .withIndex("by_userId_and_draftKey", (q) =>
        q.eq("userId", access.userId).eq("draftKey", draftKey),
      )
      .unique();
    const payload = createDraftPayload(args, now);

    if (existing) {
      await ctx.db.replace(existing._id, {
        ...payload,
        createdAt: existing.createdAt,
        draftKey,
        userId: access.userId,
      });
      return { draftId: existing._id };
    }

    return {
      draftId: await ctx.db.insert("contributionDrafts", {
        ...payload,
        createdAt: now,
        draftKey,
        userId: access.userId,
      }),
    };
  },
});

export const clear = mutation({
  args: {
    draftKey: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const draftKey = normalizeDraftKey(args.draftKey);
    const existing = await ctx.db
      .query("contributionDrafts")
      .withIndex("by_userId_and_draftKey", (q) =>
        q.eq("userId", access.userId).eq("draftKey", draftKey),
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { cleared: existing !== null };
  },
});

function createDraftPayload(
  args: {
    bodyDocumentJson: string;
    bodyPlainText: string;
    placementLabel?: string;
    selectedKnowledgeType?: Doc<"contributionDrafts">["selectedKnowledgeType"];
    slotId?: string;
    title: string;
  },
  now: number,
) {
  return {
    bodyDocumentJson: limitString(
      args.bodyDocumentJson,
      MAX_DRAFT_DOCUMENT_JSON_LENGTH,
    ),
    bodyPlainText: limitString(args.bodyPlainText, MAX_DRAFT_BODY_LENGTH),
    ...(args.placementLabel === undefined
      ? {}
      : {
          placementLabel: limitString(
            args.placementLabel,
            MAX_PLACEMENT_LABEL_LENGTH,
          ),
        }),
    ...(args.selectedKnowledgeType === undefined
      ? {}
      : { selectedKnowledgeType: args.selectedKnowledgeType }),
    ...(args.slotId === undefined
      ? {}
      : { slotId: limitString(args.slotId, MAX_SLOT_ID_LENGTH) }),
    title: limitString(args.title, MAX_TITLE_LENGTH),
    updatedAt: now,
  };
}

function normalizeDraftKey(value: string) {
  const trimmed = value.trim();
  return limitString(trimmed || "global", MAX_DRAFT_KEY_LENGTH);
}

function limitString(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}
