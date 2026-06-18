import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type MutationCtx } from "./_generated/server";
import { requireAppAccess } from "./lib/appAccess";
import { recordContextExpertiseEvidence } from "./lib/contextExpertiseEvidence";
import { getApplicableHumanWeight } from "./lib/typeBehavior";

const MAX_TITLE_LENGTH = 240;
const MAX_BODY_LENGTH = 40_000;
const MAX_PREVIEW_TEXT_LENGTH = 500;
const MAX_SEARCH_TEXT_LENGTH = 2_000;
const MAX_CONTEXT_TAGS = 20;
const MAX_CONTEXT_PREVIEW_TAG_LABELS = 6;
const MAX_CONTEXT_TAG_FIELD_LENGTH = 240;
const MAX_CONTEXT_TAG_HREF_LENGTH = 500;
const DIRECT_CONTRIBUTION_HUMAN_WEIGHT = 82;

const referentKnowledgeType = v.union(
  v.literal("words"),
  v.literal("biblePassage"),
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

const contextTagSnapshot = v.object({
  canonicalKey: v.string(),
  href: v.string(),
  id: v.string(),
  knowledgeType: referentKnowledgeType,
  label: v.string(),
  passageString: v.optional(v.string()),
});

const contributorSummary = v.object({
  id: v.string(),
  name: v.string(),
  href: v.optional(v.string()),
});

const knowledgeEntrySummary = v.object({
  contributor: contributorSummary,
  id: v.string(),
  title: v.string(),
  knowledgeType: entryKnowledgeType,
  previewText: v.string(),
  primaryTagLabel: v.string(),
  contextPreviewTagLabels: v.array(v.string()),
  humanWeight: v.optional(v.number()),
  href: v.string(),
  updatedAt: v.number(),
});

type EntryKnowledgeType = Doc<"knowledgeEntries">["knowledgeType"];
type ReferentKnowledgeType = Doc<"referents">["knowledgeType"];
type ContextTagSnapshotInput = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: ReferentKnowledgeType;
  label: string;
  passageString?: string;
};

export const postDirectContribution = mutation({
  args: {
    body: v.string(),
    contextTags: v.array(contextTagSnapshot),
    knowledgeType: entryKnowledgeType,
    slotId: v.optional(v.string()),
    title: v.string(),
  },
  returns: v.object({
    entry: knowledgeEntrySummary,
    entryId: v.id("knowledgeEntries"),
    primaryTagId: v.id("tags"),
    representedReferentId: v.id("referents"),
  }),
  handler: async (ctx, args) => {
    const access = await requireAppAccess(ctx);
    const now = Date.now();
    const title = limitString(args.title, MAX_TITLE_LENGTH);
    const body = limitString(args.body, MAX_BODY_LENGTH);

    if (!title) {
      throw new Error("Contribution title is required.");
    }

    const slotFulfillment = await resolveSlotFulfillment(ctx, {
      knowledgeType: args.knowledgeType,
      slotId: args.slotId,
    });
    const represented = await resolveRepresentedIdentity(ctx, {
      knowledgeType: args.knowledgeType,
      now,
      slotId: args.slotId,
      title,
      userId: access.userId,
    });
    const contextTags = await resolveContextTags(
      ctx,
      normalizeContextTags(args.contextTags),
      access.userId,
    );
    if (slotFulfillment !== undefined) {
      await assertContributionIncludesSlotTags(
        ctx,
        slotFulfillment._id,
        contextTags.map((tag) => tag._id),
      );
    }
    const previewText = buildPreviewText(args.knowledgeType, body);
    const contextPreviewTagLabels = contextTags
      .map((tag) => tag.label)
      .slice(0, MAX_CONTEXT_PREVIEW_TAG_LABELS);
    const humanWeight = getApplicableHumanWeight(
      args.knowledgeType,
      DIRECT_CONTRIBUTION_HUMAN_WEIGHT,
    );

    const entryId = await ctx.db.insert("knowledgeEntries", {
      knowledgeType: args.knowledgeType,
      representedReferentId: represented.referentId,
      primaryTagId: represented.primaryTagId,
      title,
      previewText,
      searchText: limitString(
        [title, body, ...contextTags.map((tag) => tag.label)].join(" "),
        MAX_SEARCH_TEXT_LENGTH,
      ),
      primaryTagLabel: represented.primaryTagLabel,
      contextPreviewTagLabels,
      ...(humanWeight === undefined ? {} : { humanWeight }),
      visibilityKind: "public",
      visibilityTargetKey: "public",
      discoverabilityKind: "public",
      discoverabilityTargetKey: "public",
      publicPreviewText: previewText,
      createdByUserId: access.userId,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("entryTags", {
      entryId,
      tagId: represented.primaryTagId,
      tagPurpose: "represented",
      taggedAt: now,
      taggedByUserId: access.userId,
    });

    for (const tag of contextTags) {
      await ctx.db.insert("entryTags", {
        entryId,
        tagId: tag._id,
        tagPurpose: "context",
        taggedAt: now,
        taggedByUserId: access.userId,
      });
    }

    await recordContextExpertiseEvidence(ctx, {
      contextTagIds: contextTags.map((tag) => tag._id),
      entryId,
      evidenceKind: "post",
      now,
      subjectUserId: access.userId,
    });

    if (args.knowledgeType === "question") {
      await ctx.db.insert("questionEntries", {
        entryId,
        questionText: title,
      });
    }

    if (slotFulfillment !== undefined) {
      await ctx.db.patch(slotFulfillment._id, {
        fulfilledEntryId: entryId,
        status: "fulfilled",
        updatedAt: now,
      });
    }

    const entry = await ctx.db.get(entryId);
    if (!entry) {
      throw new Error("Created Knowledge Entry could not be loaded.");
    }

    return {
      entry: summarizeEntry(entry, await getContributorSummary(ctx, access.userId)),
      entryId,
      primaryTagId: represented.primaryTagId,
      representedReferentId: represented.referentId,
    };
  },
});

async function resolveSlotFulfillment(
  ctx: MutationCtx,
  {
    knowledgeType,
    slotId,
  }: {
    knowledgeType: EntryKnowledgeType;
    slotId?: string;
  },
) {
  if (slotId === undefined) {
    return undefined;
  }

  const normalizedSlotId = ctx.db.normalizeId("knowledgeSlots", slotId);
  const slot =
    normalizedSlotId === null ? null : await ctx.db.get(normalizedSlotId);
  if (!slot) {
    throw new Error("Knowledge Slot could not be found.");
  }

  if (slot.requestedKnowledgeType !== knowledgeType) {
    throw new Error("Contribution Knowledge Type must match the Knowledge Slot request.");
  }

  if (slot.fulfilledEntryId !== undefined || slot.status === "fulfilled") {
    throw new Error("Knowledge Slot already has Fulfillment.");
  }

  if (slot.status !== "open" && slot.status !== "overdue") {
    throw new Error("Knowledge Slot is not open for Fulfillment.");
  }

  return slot;
}

async function assertContributionIncludesSlotTags(
  ctx: MutationCtx,
  slotId: Id<"knowledgeSlots">,
  contextTagIds: Array<Id<"tags">>,
) {
  const contextTagIdSet = new Set(contextTagIds);
  const slotTags = await ctx.db
    .query("slotTags")
    .withIndex("by_slotId_and_tagId", (q) => q.eq("slotId", slotId))
    .collect();

  for (const slotTag of slotTags) {
    if (!contextTagIdSet.has(slotTag.tagId)) {
      throw new Error("Contribution must include the Knowledge Slot context Tags.");
    }
  }
}

async function resolveRepresentedIdentity(
  ctx: MutationCtx,
  identity: {
    knowledgeType: EntryKnowledgeType;
    now: number;
    slotId?: string;
    title: string;
    userId: Id<"users">;
  },
) {
  const canonicalKey = getRepresentedCanonicalKey(identity);
  const referent =
    (await ctx.db
      .query("referents")
      .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
        q.eq("knowledgeType", identity.knowledgeType).eq("canonicalKey", canonicalKey),
      )
      .first()) ??
    (await insertReferent(ctx, {
      canonicalKey,
      canonicalName: identity.title,
      knowledgeType: identity.knowledgeType,
    }));
  const existingEntry = await ctx.db
    .query("knowledgeEntries")
    .withIndex("by_representedReferentId", (q) =>
      q.eq("representedReferentId", referent._id),
    )
    .first();

  if (existingEntry) {
    throw new Error("A Knowledge Entry already represents this Referent.");
  }

  const primaryTag =
    (await ctx.db
      .query("tags")
      .withIndex("by_referentId", (q) => q.eq("referentId", referent._id))
      .first()) ??
    (await insertTag(ctx, {
      createdByUserId: identity.userId,
      knowledgeType: identity.knowledgeType,
      label: identity.title,
      lookupKey: canonicalKey,
      referentId: referent._id,
    }));

  return {
    primaryTagId: primaryTag._id,
    primaryTagLabel: primaryTag.label,
    referentId: referent._id,
  };
}

async function resolveContextTags(
  ctx: MutationCtx,
  snapshots: ContextTagSnapshotInput[],
  userId: Id<"users">,
) {
  const tags = [];

  for (const snapshot of snapshots) {
    const lookupKey = getContextLookupKey(snapshot);
    const label = limitString(snapshot.label, MAX_CONTEXT_TAG_FIELD_LENGTH);
    const tag =
      (await ctx.db
        .query("tags")
        .withIndex("by_knowledgeType_and_lookupKey", (q) =>
          q.eq("knowledgeType", snapshot.knowledgeType).eq("lookupKey", lookupKey),
        )
        .first()) ??
      (await createContextTag(ctx, {
        canonicalKey: lookupKey,
        createdByUserId: userId,
        knowledgeType: snapshot.knowledgeType,
        label,
        lookupKey,
      }));

    tags.push(tag);
  }

  return tags;
}

async function createContextTag(
  ctx: MutationCtx,
  tag: {
    canonicalKey: string;
    createdByUserId: Id<"users">;
    knowledgeType: ReferentKnowledgeType;
    label: string;
    lookupKey: string;
  },
) {
  const referent =
    (await ctx.db
      .query("referents")
      .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
        q.eq("knowledgeType", tag.knowledgeType).eq("canonicalKey", tag.canonicalKey),
      )
      .first()) ??
    (await insertReferent(ctx, {
      canonicalKey: tag.canonicalKey,
      canonicalName: tag.label,
      knowledgeType: tag.knowledgeType,
    }));

  return await insertTag(ctx, {
    createdByUserId: tag.createdByUserId,
    knowledgeType: tag.knowledgeType,
    label: tag.label,
    lookupKey: tag.lookupKey,
    referentId: referent._id,
  });
}

async function insertReferent(
  ctx: MutationCtx,
  referent: {
    canonicalKey: string;
    canonicalName: string;
    knowledgeType: ReferentKnowledgeType;
  },
) {
  const referentId = await ctx.db.insert("referents", referent);
  const inserted = await ctx.db.get(referentId);
  if (!inserted) {
    throw new Error("Created Referent could not be loaded.");
  }
  return inserted;
}

async function insertTag(
  ctx: MutationCtx,
  tag: {
    createdByUserId: Id<"users">;
    knowledgeType: ReferentKnowledgeType;
    label: string;
    lookupKey: string;
    referentId: Id<"referents">;
  },
) {
  const tagId = await ctx.db.insert("tags", tag);
  const inserted = await ctx.db.get(tagId);
  if (!inserted) {
    throw new Error("Created Tag could not be loaded.");
  }
  return inserted;
}

function normalizeContextTags(tags: ContextTagSnapshotInput[]) {
  if (tags.length > MAX_CONTEXT_TAGS) {
    throw new Error(`Direct posting supports at most ${MAX_CONTEXT_TAGS} context Tags.`);
  }

  const uniqueTags = new Map<string, ContextTagSnapshotInput>();
  for (const tag of tags) {
    const normalizedTag = {
      canonicalKey: limitString(tag.canonicalKey, MAX_CONTEXT_TAG_FIELD_LENGTH),
      href: limitString(tag.href, MAX_CONTEXT_TAG_HREF_LENGTH),
      id: limitString(tag.id, MAX_CONTEXT_TAG_FIELD_LENGTH),
      knowledgeType: tag.knowledgeType,
      label: limitString(tag.label, MAX_CONTEXT_TAG_FIELD_LENGTH),
      ...(tag.passageString === undefined
        ? {}
        : {
            passageString: limitString(
              tag.passageString,
              MAX_CONTEXT_TAG_FIELD_LENGTH,
            ),
          }),
    };

    uniqueTags.set(
      `${normalizedTag.knowledgeType}:${getContextLookupKey(normalizedTag)}`,
      normalizedTag,
    );
  }

  return Array.from(uniqueTags.values());
}

function getRepresentedCanonicalKey({
  knowledgeType,
  now,
  slotId,
  title,
  userId,
}: {
  knowledgeType: EntryKnowledgeType;
  now: number;
  slotId?: string;
  title: string;
  userId: Id<"users">;
}) {
  const titleKey = normalizeLookupKey(title);
  if (knowledgeType === "comment") {
    const slotKey = slotId ? normalizeLookupKey(slotId) : "no-slot";
    return `direct:${userId}:comment:${slotKey}:${now}`;
  }

  return `direct:${userId}:${knowledgeType}:${titleKey}`;
}

function getContextLookupKey(tag: ContextTagSnapshotInput) {
  return normalizeLookupKey(tag.canonicalKey || tag.id || tag.label);
}

function buildPreviewText(
  knowledgeType: EntryKnowledgeType,
  body: string,
) {
  return limitString(
    body || `Created ${formatKnowledgeTypeLabel(knowledgeType)} entry.`,
    MAX_PREVIEW_TEXT_LENGTH,
  );
}

function summarizeEntry(
  entry: Doc<"knowledgeEntries">,
  contributor: { id: string; name: string },
) {
  const humanWeight = getApplicableHumanWeight(
    entry.knowledgeType,
    entry.humanWeight,
  );

  return {
    contributor,
    id: entry._id,
    title: entry.title,
    knowledgeType: entry.knowledgeType,
    previewText: entry.previewText,
    primaryTagLabel: entry.primaryTagLabel,
    contextPreviewTagLabels: entry.contextPreviewTagLabels,
    ...(humanWeight === undefined ? {} : { humanWeight }),
    href: `/entries/${entry._id}`,
    updatedAt: entry.updatedAt,
  };
}

async function getContributorSummary(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);

  return {
    id: userId,
    name: user ? getUserDisplayName(user) : "Unknown Contributor",
  };
}

function getUserDisplayName(user: Doc<"users">) {
  const name = user.name?.trim();
  if (name) {
    return name;
  }

  if (user.email) {
    return formatEmailDisplayName(user.email);
  }

  return "Unknown Contributor";
}

function formatEmailDisplayName(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const parts = localPart
    .split(/[._+-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return email;
  }

  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatKnowledgeTypeLabel(knowledgeType: EntryKnowledgeType) {
  const labels: Record<EntryKnowledgeType, string> = {
    words: "Words",
    topic: "Topic",
    series: "Series",
    question: "Question",
    quote: "Quote",
    sermon: "Sermon",
    essay: "Essay",
    poem: "Poem",
    song: "Song",
    book: "Book",
    shortStory: "Short Story",
    lesson: "Lesson",
    comment: "Comment",
    prayerRequest: "Prayer Request",
    event: "Event",
    rsvp: "RSVP",
    person: "Person",
    organization: "Organization",
    group: "Group",
    place: "Place",
  };

  return labels[knowledgeType];
}

function normalizeLookupKey(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
}

function limitString(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}
