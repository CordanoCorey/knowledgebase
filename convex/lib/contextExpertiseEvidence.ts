import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getContextExpertiseAggregateScore,
  getContextExpertiseContextKey,
  getContextExpertiseEntrySignalScore,
  getContextExpertiseEvidenceSignalScore,
  getContextExpertiseMaturity,
  normalizeContextExpertiseTagIds,
} from "./contextExpertiseScoring";

const MAX_CONTEXT_TAGS = 20;
const TOP_SUPPORTING_ENTRY_LIMIT = 5;
const MAX_CONTEXT_EXPERTISE_EVIDENCE_PER_AGGREGATE = 200;
const MAX_CONTEXT_EXPERTISE_CORRECTION_ROWS = 200;

type ContextExpertiseEvidenceKind =
  Doc<"contextExpertiseEvidence">["evidenceKind"];
type ContextExpertiseEvidenceSnapshot = Omit<
  Doc<"contextExpertiseEvidence">,
  | "_creationTime"
  | "_id"
  | "createdAt"
  | "feedbackId"
  | "slotId"
  | "smartStorageProposalId"
> & {
  feedbackId?: Id<"humanWeightFeedback">;
  slotId?: Id<"knowledgeSlots">;
  smartStorageProposalId?: Id<"smartStorageProposals">;
};
type ContextExpertiseEvidenceRow = Doc<"contextExpertiseEvidence">;
export type ContextExpertiseSubjectSelector =
  | {
      subjectKind: "user";
      subjectUserId: Id<"users">;
    }
  | {
      subjectKind: "person";
      subjectPersonReferentId: Id<"referents">;
    };
type ContextExpertiseEvidenceGroup = {
  contextKey: string;
  contextTagIds: Array<Id<"tags">>;
  scope: ContextExpertiseAudienceScope;
  subject: ContextExpertiseSubjectSelector;
};
type ContextExpertiseAttributionCorrectionResult = {
  affectedAggregateGroupCount: number;
  correctedEvidenceCount: number;
  skippedCorrectedEvidenceCount: number;
};
type ContextExpertiseQuoteAttributionCorrectionResult =
  ContextExpertiseAttributionCorrectionResult & {
    createdEvidenceCount: number;
    deactivatedEvidenceCount: number;
  };
type ContextExpertiseVisibilityCorrectionResult = {
  affectedAggregateGroupCount: number;
  correctedEvidenceCount: number;
  nonEffectiveEvidenceCount: number;
};

type RecordContextExpertiseEvidenceArgs = {
  contextTagIds: Array<Id<"tags">>;
  entryId: Id<"knowledgeEntries">;
  evidenceKind: ContextExpertiseEvidenceKind;
  feedbackId?: Id<"humanWeightFeedback">;
  now: number;
  slotId?: Id<"knowledgeSlots">;
  smartStorageProposalId?: Id<"smartStorageProposals">;
  subjectUserId?: Id<"users">;
  subjectPersonReferentId?: Id<"referents">;
};

export async function recordContextExpertiseEvidence(
  ctx: MutationCtx,
  args: RecordContextExpertiseEvidenceArgs,
) {
  const entry = await ctx.db.get(args.entryId);
  if (!entry) {
    throw new Error("Knowledge Entry not found.");
  }
  const subject = await getContextExpertiseSubjectSelector(ctx, args);

  const existing = await getExistingContextExpertiseEvidence(ctx, args);
  if (existing && args.slotId !== undefined && existing.entryId !== args.entryId) {
    throw new Error(
      "Slot Fulfillment Context Expertise Evidence already points to another Knowledge Entry.",
    );
  }
  if (
    existing &&
    args.smartStorageProposalId !== undefined &&
    existing.entryId !== args.entryId
  ) {
    throw new Error(
      "Smart Storage Curation Context Expertise Evidence already points to another Knowledge Entry.",
    );
  }
  const contextTagIds = normalizeContextTagIds(args.contextTagIds);
  const evidence = {
    ...(await getEvidenceSubjectFields(ctx, subject)),
    contextKey: getContextKey(contextTagIds),
    contextTagIds,
    evidenceKind: args.evidenceKind,
    entryId: args.entryId,
    ...(args.feedbackId === undefined ? {} : { feedbackId: args.feedbackId }),
    ...(args.slotId === undefined ? {} : { slotId: args.slotId }),
    ...(args.smartStorageProposalId === undefined
      ? {}
      : { smartStorageProposalId: args.smartStorageProposalId }),
    visibilityKind: entry.visibilityKind,
    visibilityTargetKey: entry.visibilityTargetKey,
    updatedAt: args.now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, evidence);
    await upsertContextExpertiseAggregate(ctx, {
      entry,
      evidence,
      isNewEvidence: false,
      now: args.now,
    });
    return existing._id;
  }

  const evidenceId = await ctx.db.insert("contextExpertiseEvidence", {
    ...evidence,
    createdAt: args.now,
  });
  await upsertContextExpertiseAggregate(ctx, {
    entry,
    evidence,
    isNewEvidence: true,
    now: args.now,
  });

  return evidenceId;
}

async function getExistingContextExpertiseEvidence(
  ctx: MutationCtx,
  args: RecordContextExpertiseEvidenceArgs,
) {
  const sourceKeyCount = [
    args.feedbackId,
    args.slotId,
    args.smartStorageProposalId,
  ].filter((sourceId) => sourceId !== undefined).length;
  if (sourceKeyCount > 1) {
    throw new Error("Context Expertise Evidence can only be keyed by one source.");
  }

  if (args.feedbackId !== undefined) {
    return await ctx.db
      .query("contextExpertiseEvidence")
      .withIndex("by_feedbackId", (q) => q.eq("feedbackId", args.feedbackId))
      .first();
  }

  if (args.slotId !== undefined) {
    return await ctx.db
      .query("contextExpertiseEvidence")
      .withIndex("by_slotId", (q) => q.eq("slotId", args.slotId))
      .first();
  }

  if (args.smartStorageProposalId !== undefined) {
    return await ctx.db
      .query("contextExpertiseEvidence")
      .withIndex("by_smartStorageProposalId", (q) =>
        q.eq("smartStorageProposalId", args.smartStorageProposalId),
      )
      .first();
  }

  if (
    args.evidenceKind === "quoteAttribution" &&
    args.subjectPersonReferentId !== undefined
  ) {
    const contextTagIds = normalizeContextTagIds(args.contextTagIds);
    const contextKey = getContextKey(contextTagIds);
    const evidenceRows = await ctx.db
      .query("contextExpertiseEvidence")
      .withIndex("by_entryId_and_createdAt", (q) => q.eq("entryId", args.entryId))
      .take(MAX_CONTEXT_EXPERTISE_CORRECTION_ROWS);

    return (
      evidenceRows.find(
        (evidence) =>
          evidence.evidenceKind === "quoteAttribution" &&
          evidence.subjectPersonReferentId === args.subjectPersonReferentId &&
          evidence.contextKey === contextKey,
      ) ?? null
    );
  }

  return null;
}

export async function getEntryContextTagIds(
  ctx: MutationCtx | QueryCtx,
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

export async function correctPostContextExpertiseEvidenceForWrongContext(
  ctx: MutationCtx,
  {
    contextTagIds,
    entryId,
    feedbackId,
    now,
  }: {
    contextTagIds: Array<Id<"tags">>;
    entryId: Id<"knowledgeEntries">;
    feedbackId: Id<"humanWeightFeedback">;
    now: number;
  },
) {
  const normalizedContextTagIds = normalizeContextTagIds(contextTagIds);
  const contextKey = getContextKey(normalizedContextTagIds);
  const evidenceRows = await ctx.db
    .query("contextExpertiseEvidence")
    .withIndex("by_entryId_and_createdAt", (q) => q.eq("entryId", entryId))
    .take(MAX_CONTEXT_EXPERTISE_CORRECTION_ROWS);
  const affectedGroups = new Map<string, ContextExpertiseEvidenceGroup>();

  for (const evidenceRow of evidenceRows) {
    if (
      (evidenceRow.evidenceKind !== "post" &&
        evidenceRow.evidenceKind !== "quoteAttribution") ||
      evidenceRow.contextKey !== contextKey
    ) {
      continue;
    }

    addAffectedEvidenceGroup(affectedGroups, evidenceRow);

    if (evidenceRow.correctionKind !== undefined) {
      continue;
    }

    await ctx.db.patch(evidenceRow._id, {
      correctionKind: "wrongContext",
      correctedByFeedbackId: feedbackId,
      correctedAt: now,
      updatedAt: now,
    });
  }

  for (const group of affectedGroups.values()) {
    await rebuildContextExpertiseAggregateForScope(ctx, {
      ...group,
      now,
    });
  }
}

export async function correctPostContextExpertiseEvidenceAttribution(
  ctx: MutationCtx,
  {
    correctedByUserId,
    entryId,
    nextSubjectUserId,
    now,
  }: {
    correctedByUserId: Id<"users">;
    entryId: Id<"knowledgeEntries">;
    nextSubjectUserId: Id<"users">;
    now: number;
  },
): Promise<ContextExpertiseAttributionCorrectionResult> {
  const nextSubjectUser = await ctx.db.get(nextSubjectUserId);
  if (!nextSubjectUser) {
    throw new Error("Corrected User not found.");
  }

  const nextSubjectPersonReferentId = await getSubjectPersonReferentId(
    ctx,
    nextSubjectUserId,
  );
  const evidenceRows = await ctx.db
    .query("contextExpertiseEvidence")
    .withIndex("by_entryId_and_createdAt", (q) => q.eq("entryId", entryId))
    .take(MAX_CONTEXT_EXPERTISE_CORRECTION_ROWS);
  const affectedGroups = new Map<string, ContextExpertiseEvidenceGroup>();
  let correctedEvidenceCount = 0;
  let skippedCorrectedEvidenceCount = 0;

  for (const evidenceRow of evidenceRows) {
    if (evidenceRow.evidenceKind !== "post") {
      continue;
    }
    if (evidenceRow.subjectUserId === undefined) {
      continue;
    }

    addAffectedEvidenceGroup(affectedGroups, evidenceRow);

    if (!isEffectiveContextExpertiseEvidence(evidenceRow)) {
      skippedCorrectedEvidenceCount += 1;
      continue;
    }

    addAffectedEvidenceGroupForScope(affectedGroups, {
      contextKey: evidenceRow.contextKey,
      contextTagIds: evidenceRow.contextTagIds,
      scope: getAudienceScopeFromVisibility(
        evidenceRow.visibilityKind,
        evidenceRow.visibilityTargetKey,
      ),
      subject: {
        subjectKind: "user",
        subjectUserId: nextSubjectUserId,
      },
    });

    await ctx.db.patch(evidenceRow._id, {
      subjectUserId: nextSubjectUserId,
      subjectPersonReferentId: nextSubjectPersonReferentId,
      ...(evidenceRow.subjectUserId === nextSubjectUserId
        ? {}
        : {
            attributionCorrectedFromSubjectUserId: evidenceRow.subjectUserId,
          }),
      ...(evidenceRow.subjectPersonReferentId === undefined ||
      evidenceRow.subjectPersonReferentId === nextSubjectPersonReferentId
        ? {}
        : {
            attributionCorrectedFromSubjectPersonReferentId:
              evidenceRow.subjectPersonReferentId,
          }),
      attributionCorrectedByUserId: correctedByUserId,
      attributionCorrectedAt: now,
      updatedAt: now,
    });
    correctedEvidenceCount += 1;
  }

  for (const group of affectedGroups.values()) {
    await rebuildContextExpertiseAggregateForScope(ctx, {
      ...group,
      now,
    });
  }

  return {
    affectedAggregateGroupCount: affectedGroups.size,
    correctedEvidenceCount,
    skippedCorrectedEvidenceCount,
  };
}

export async function correctQuoteContextExpertiseEvidenceAttribution(
  ctx: MutationCtx,
  {
    correctedByUserId,
    entryId,
    nextSubjectPersonReferentId,
    now,
  }: {
    correctedByUserId: Id<"users">;
    entryId: Id<"knowledgeEntries">;
    nextSubjectPersonReferentId?: Id<"referents">;
    now: number;
  },
): Promise<ContextExpertiseQuoteAttributionCorrectionResult> {
  let nextSubject: ContextExpertiseSubjectSelector | null = null;
  if (nextSubjectPersonReferentId !== undefined) {
    const nextSubjectPerson = await ctx.db.get(nextSubjectPersonReferentId);
    if (!nextSubjectPerson || nextSubjectPerson.knowledgeType !== "person") {
      throw new Error("Corrected quoted Person not found.");
    }
    nextSubject = {
      subjectKind: "person",
      subjectPersonReferentId: nextSubjectPersonReferentId,
    };
  }

  const evidenceRows = await ctx.db
    .query("contextExpertiseEvidence")
    .withIndex("by_entryId_and_createdAt", (q) => q.eq("entryId", entryId))
    .take(MAX_CONTEXT_EXPERTISE_CORRECTION_ROWS);
  const affectedGroups = new Map<string, ContextExpertiseEvidenceGroup>();
  let correctedEvidenceCount = 0;
  let createdEvidenceCount = 0;
  let deactivatedEvidenceCount = 0;
  let skippedCorrectedEvidenceCount = 0;
  let hasEffectiveTargetEvidence = false;
  let hasWrongContextQuoteAttributionEvidence = false;

  for (const evidenceRow of evidenceRows) {
    if (evidenceRow.evidenceKind !== "quoteAttribution") {
      continue;
    }

    addAffectedEvidenceGroup(affectedGroups, evidenceRow);

    if (nextSubjectPersonReferentId === undefined) {
      if (!isEffectiveContextExpertiseEvidence(evidenceRow)) {
        skippedCorrectedEvidenceCount += 1;
        if (evidenceRow.correctionKind === "wrongContext") {
          hasWrongContextQuoteAttributionEvidence = true;
        }
        continue;
      }

      await deactivateQuoteAttributionEvidence(ctx, {
        correctedByUserId,
        evidenceRow,
        now,
      });
      deactivatedEvidenceCount += 1;
      continue;
    }

    if (!isEffectiveContextExpertiseEvidence(evidenceRow)) {
      if (evidenceRow.correctionKind === "wrongContext") {
        skippedCorrectedEvidenceCount += 1;
        hasWrongContextQuoteAttributionEvidence = true;
        continue;
      }

      if (
        evidenceRow.correctionKind === "attribution" &&
        evidenceRow.subjectPersonReferentId === nextSubjectPersonReferentId &&
        !hasEffectiveTargetEvidence
      ) {
        await ctx.db.patch(evidenceRow._id, {
          correctionKind: undefined,
          attributionCorrectedByUserId: correctedByUserId,
          attributionCorrectedAt: now,
          updatedAt: now,
        });
        correctedEvidenceCount += 1;
        hasEffectiveTargetEvidence = true;
        continue;
      }

      skippedCorrectedEvidenceCount += 1;
      continue;
    }

    if (
      evidenceRow.subjectPersonReferentId === nextSubjectPersonReferentId &&
      !hasEffectiveTargetEvidence
    ) {
      hasEffectiveTargetEvidence = true;
      continue;
    }

    if (nextSubject !== null && !hasEffectiveTargetEvidence) {
      addAffectedEvidenceGroupForScope(affectedGroups, {
        contextKey: evidenceRow.contextKey,
        contextTagIds: evidenceRow.contextTagIds,
        scope: getAudienceScopeFromVisibility(
          evidenceRow.visibilityKind,
          evidenceRow.visibilityTargetKey,
        ),
        subject: nextSubject,
      });

      await ctx.db.patch(evidenceRow._id, {
        subjectUserId: undefined,
        subjectPersonReferentId: nextSubjectPersonReferentId,
        ...(evidenceRow.subjectPersonReferentId === undefined ||
        evidenceRow.subjectPersonReferentId === nextSubjectPersonReferentId
          ? {}
          : {
              attributionCorrectedFromSubjectPersonReferentId:
                evidenceRow.subjectPersonReferentId,
            }),
        attributionCorrectedByUserId: correctedByUserId,
        attributionCorrectedAt: now,
        updatedAt: now,
      });
      correctedEvidenceCount += 1;
      hasEffectiveTargetEvidence = true;
      continue;
    }

    await deactivateQuoteAttributionEvidence(ctx, {
      correctedByUserId,
      evidenceRow,
      now,
    });
    deactivatedEvidenceCount += 1;
  }

  if (
    nextSubject !== null &&
    !hasEffectiveTargetEvidence &&
    !hasWrongContextQuoteAttributionEvidence
  ) {
    const entry = await ctx.db.get(entryId);
    if (!entry) {
      throw new Error("Knowledge Entry not found.");
    }
    const contextTagIds = await getEntryContextTagIds(ctx, entryId);
    if (contextTagIds.length === 0) {
      skippedCorrectedEvidenceCount += 1;
    } else {
      await recordContextExpertiseEvidence(ctx, {
        contextTagIds,
        entryId,
        evidenceKind: "quoteAttribution",
        now,
        subjectPersonReferentId: nextSubject.subjectPersonReferentId,
      });
      addAffectedEvidenceGroupForScope(affectedGroups, {
        contextKey: getContextKey(contextTagIds),
        contextTagIds,
        scope: getAudienceScopeFromVisibility(
          entry.visibilityKind,
          entry.visibilityTargetKey,
        ),
        subject: nextSubject,
      });
      createdEvidenceCount += 1;
    }
  }

  for (const group of affectedGroups.values()) {
    await rebuildContextExpertiseAggregateForScope(ctx, {
      ...group,
      now,
    });
  }

  return {
    affectedAggregateGroupCount: affectedGroups.size,
    correctedEvidenceCount,
    createdEvidenceCount,
    deactivatedEvidenceCount,
    skippedCorrectedEvidenceCount,
  };
}

async function deactivateQuoteAttributionEvidence(
  ctx: MutationCtx,
  {
    correctedByUserId,
    evidenceRow,
    now,
  }: {
    correctedByUserId: Id<"users">;
    evidenceRow: ContextExpertiseEvidenceRow;
    now: number;
  },
) {
  await ctx.db.patch(evidenceRow._id, {
    correctionKind: "attribution",
    ...(evidenceRow.subjectPersonReferentId === undefined
      ? {}
      : {
          attributionCorrectedFromSubjectPersonReferentId:
            evidenceRow.subjectPersonReferentId,
        }),
    attributionCorrectedByUserId: correctedByUserId,
    attributionCorrectedAt: now,
    updatedAt: now,
  });
}

export async function reconcileContextExpertiseEvidenceVisibility(
  ctx: MutationCtx,
  {
    correctedByUserId,
    entryId,
    nextVisibilityKind,
    nextVisibilityTargetKey,
    now,
  }: {
    correctedByUserId: Id<"users">;
    entryId: Id<"knowledgeEntries">;
    nextVisibilityKind: Doc<"contextExpertiseEvidence">["visibilityKind"];
    nextVisibilityTargetKey: string;
    now: number;
  },
): Promise<ContextExpertiseVisibilityCorrectionResult> {
  const evidenceRows = await ctx.db
    .query("contextExpertiseEvidence")
    .withIndex("by_entryId_and_createdAt", (q) => q.eq("entryId", entryId))
    .take(MAX_CONTEXT_EXPERTISE_CORRECTION_ROWS);
  const affectedGroups = new Map<string, ContextExpertiseEvidenceGroup>();
  const nextScope = getAudienceScopeFromVisibility(
    nextVisibilityKind,
    nextVisibilityTargetKey,
  );
  let correctedEvidenceCount = 0;
  let nonEffectiveEvidenceCount = 0;

  for (const evidenceRow of evidenceRows) {
    const subject = getEvidenceRowSubjectSelector(evidenceRow);
    addAffectedEvidenceGroup(affectedGroups, evidenceRow);
    if (subject !== null) {
      addAffectedEvidenceGroupForScope(affectedGroups, {
        contextKey: evidenceRow.contextKey,
        contextTagIds: evidenceRow.contextTagIds,
        scope: nextScope,
        subject,
      });
    }

    if (!isEffectiveContextExpertiseEvidence(evidenceRow)) {
      nonEffectiveEvidenceCount += 1;
    }

    if (
      evidenceRow.visibilityKind === nextVisibilityKind &&
      evidenceRow.visibilityTargetKey === nextVisibilityTargetKey
    ) {
      continue;
    }

    await ctx.db.patch(evidenceRow._id, {
      visibilityKind: nextVisibilityKind,
      visibilityTargetKey: nextVisibilityTargetKey,
      visibilityCorrectedFromKind: evidenceRow.visibilityKind,
      visibilityCorrectedFromTargetKey: evidenceRow.visibilityTargetKey,
      visibilityCorrectedByUserId: correctedByUserId,
      visibilityCorrectedAt: now,
      updatedAt: now,
    });
    correctedEvidenceCount += 1;
  }

  for (const group of affectedGroups.values()) {
    await rebuildContextExpertiseAggregateForScope(ctx, {
      ...group,
      now,
    });
  }

  return {
    affectedAggregateGroupCount: affectedGroups.size,
    correctedEvidenceCount,
    nonEffectiveEvidenceCount,
  };
}

async function getContextExpertiseSubjectSelector(
  ctx: MutationCtx,
  args: Pick<
    RecordContextExpertiseEvidenceArgs,
    "subjectPersonReferentId" | "subjectUserId"
  >,
): Promise<ContextExpertiseSubjectSelector> {
  if (
    args.subjectUserId !== undefined &&
    args.subjectPersonReferentId !== undefined
  ) {
    throw new Error("Context Expertise Evidence can only have one subject.");
  }

  if (args.subjectUserId !== undefined) {
    const subjectUser = await ctx.db.get(args.subjectUserId);
    if (!subjectUser) {
      throw new Error("Context Expertise Evidence subject User not found.");
    }

    return {
      subjectKind: "user",
      subjectUserId: args.subjectUserId,
    };
  }

  if (args.subjectPersonReferentId !== undefined) {
    const subjectPerson = await ctx.db.get(args.subjectPersonReferentId);
    if (!subjectPerson || subjectPerson.knowledgeType !== "person") {
      throw new Error("Context Expertise Evidence subject Person not found.");
    }

    return {
      subjectKind: "person",
      subjectPersonReferentId: args.subjectPersonReferentId,
    };
  }

  throw new Error("Context Expertise Evidence subject is required.");
}

async function getEvidenceSubjectFields(
  ctx: MutationCtx,
  subject: ContextExpertiseSubjectSelector,
) {
  if (subject.subjectKind === "person") {
    return {
      subjectPersonReferentId: subject.subjectPersonReferentId,
    };
  }

  const subjectPersonReferentId = await getSubjectPersonReferentId(
    ctx,
    subject.subjectUserId,
  );
  return subjectPersonReferentId === undefined
    ? { subjectUserId: subject.subjectUserId }
    : {
        subjectUserId: subject.subjectUserId,
        subjectPersonReferentId,
      };
}

async function getSubjectPersonReferentId(
  ctx: MutationCtx,
  subjectUserId: Id<"users">,
) {
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", subjectUserId))
    .first();

  return profile?.personReferentId;
}

function normalizeContextTagIds(tagIds: Array<Id<"tags">>) {
  return normalizeContextExpertiseTagIds(tagIds, MAX_CONTEXT_TAGS) as Array<
    Id<"tags">
  >;
}

function getContextKey(tagIds: Array<Id<"tags">>) {
  return getContextExpertiseContextKey(tagIds);
}

function getEvidenceGroupKey({
  contextKey,
  scope,
  subject,
}: {
  contextKey: string;
  scope: ContextExpertiseAudienceScope;
  subject: ContextExpertiseSubjectSelector;
}) {
  return `${getSubjectKey(subject)}:${contextKey}:${scope.audienceScopeKind}:${scope.audienceScopeTargetKey}`;
}

function addAffectedEvidenceGroup(
  groups: Map<string, ContextExpertiseEvidenceGroup>,
  evidenceRow: ContextExpertiseEvidenceRow,
) {
  const subject = getEvidenceRowSubjectSelector(evidenceRow);
  if (subject === null) {
    return;
  }

  const scope = getAudienceScopeFromVisibility(
    evidenceRow.visibilityKind,
    evidenceRow.visibilityTargetKey,
  );
  groups.set(
    getEvidenceGroupKey({
      contextKey: evidenceRow.contextKey,
      scope,
      subject,
    }),
    {
      contextKey: evidenceRow.contextKey,
      contextTagIds: evidenceRow.contextTagIds,
      scope,
      subject,
    },
  );
}

function addAffectedEvidenceGroupForScope(
  groups: Map<string, ContextExpertiseEvidenceGroup>,
  group: ContextExpertiseEvidenceGroup,
) {
  groups.set(
    getEvidenceGroupKey({
      contextKey: group.contextKey,
      scope: group.scope,
      subject: group.subject,
    }),
    group,
  );
}

export function getEvidenceRowSubjectSelector(
  evidenceRow: Pick<
    Doc<"contextExpertiseEvidence">,
    "subjectPersonReferentId" | "subjectUserId"
  >,
): ContextExpertiseSubjectSelector | null {
  if (evidenceRow.subjectUserId !== undefined) {
    return {
      subjectKind: "user",
      subjectUserId: evidenceRow.subjectUserId,
    };
  }

  return evidenceRow.subjectPersonReferentId === undefined
    ? null
    : {
        subjectKind: "person",
        subjectPersonReferentId: evidenceRow.subjectPersonReferentId,
      };
}

function getSubjectKey(subject: ContextExpertiseSubjectSelector) {
  return subject.subjectKind === "user"
    ? `user:${subject.subjectUserId}`
    : `person:${subject.subjectPersonReferentId}`;
}

async function upsertContextExpertiseAggregate(
  ctx: MutationCtx,
  {
    evidence,
    now,
  }: {
    entry: Doc<"knowledgeEntries">;
    evidence: ContextExpertiseEvidenceSnapshot;
    isNewEvidence: boolean;
    now: number;
  },
) {
  await rebuildContextExpertiseAggregateForScope(ctx, {
    contextKey: evidence.contextKey,
    contextTagIds: evidence.contextTagIds,
    now,
    scope: getAudienceScopeFromVisibility(
      evidence.visibilityKind,
      evidence.visibilityTargetKey,
    ),
    subject: getSnapshotSubjectSelector(evidence),
  });
}

export async function rebuildContextExpertiseAggregateForScope(
  ctx: MutationCtx,
  {
    contextKey,
    contextTagIds,
    now,
    scope,
    subject,
  }: {
    contextKey: string;
    contextTagIds: Array<Id<"tags">>;
    now: number;
    scope: ContextExpertiseAudienceScope;
    subject: ContextExpertiseSubjectSelector;
  },
): Promise<RebuildContextExpertiseAggregateResult> {
  const evidenceRows = await getContextExpertiseEvidenceForScope(ctx, {
    contextKey,
    scope,
    subject,
  });
  const existingAggregate = await getContextExpertiseAggregateForScope(ctx, {
    contextKey,
    scope,
    subject,
  });

  if (evidenceRows.length === 0) {
    if (existingAggregate) {
      await ctx.db.delete(existingAggregate._id);
    }
    return {
      contextKey,
      evidenceCount: 0,
      scope,
      skippedReason: "noEvidence",
      ...getResultSubjectFields(subject),
    };
  }

  const effectiveEvidenceRows = evidenceRows.filter(
    isEffectiveContextExpertiseEvidence,
  );
  if (effectiveEvidenceRows.length === 0) {
    if (existingAggregate) {
      await ctx.db.delete(existingAggregate._id);
    }
    return {
      contextKey,
      evidenceCount: 0,
      scope,
      skippedReason: "noEffectiveEvidence",
      ...getResultSubjectFields(subject),
    };
  }

  let feedbackCount = 0;
  let latestEvidenceAt = 0;
  let postCount = 0;
  let signalScore = 0;
  const candidates: Array<{
    entry: Doc<"knowledgeEntries">;
    entryId: Id<"knowledgeEntries">;
  }> = [];
  const latestEvidence = effectiveEvidenceRows[0];

  for (const evidenceRow of effectiveEvidenceRows) {
    const entry = await ctx.db.get(evidenceRow.entryId);
    if (!entry) {
      continue;
    }

    if (evidenceRow.evidenceKind === "post") {
      postCount += 1;
    } else if (evidenceRow.evidenceKind === "feedback") {
      feedbackCount += 1;
    }
    latestEvidenceAt = Math.max(latestEvidenceAt, evidenceRow.updatedAt);
    signalScore = Math.max(
      signalScore,
      getContextExpertiseEvidenceSignalScore(entry, evidenceRow.evidenceKind),
    );
    candidates.push({ entry, entryId: evidenceRow.entryId });
  }

  if (candidates.length === 0) {
    if (existingAggregate) {
      await ctx.db.delete(existingAggregate._id);
    }
    return {
      contextKey,
      evidenceCount: 0,
      scope,
      skippedReason: "noValidEntries",
      ...getResultSubjectFields(subject),
    };
  }

  const evidenceCount = candidates.length;
  const aggregatePatch = {
    ...getAggregateSubjectFields(subject, latestEvidence),
    contextKey,
    contextTagIds,
    contextExpertiseScore: getContextExpertiseAggregateScore(
      signalScore,
      evidenceCount,
    ),
    contextExpertiseMaturity: getContextExpertiseMaturity(evidenceCount),
    evidenceCount,
    postCount,
    feedbackCount,
    latestEvidenceAt,
    topSupportingEntryIds: getTopSupportingEntryIds(candidates),
    visibilityKind: scope.audienceScopeKind,
    visibilityTargetKey: scope.audienceScopeTargetKey,
    audienceScopeKind: scope.audienceScopeKind,
    audienceScopeTargetKey: scope.audienceScopeTargetKey,
    updatedAt: now,
  };

  if (existingAggregate) {
    await ctx.db.patch(existingAggregate._id, aggregatePatch);
    return {
      aggregateId: existingAggregate._id,
      contextKey,
      evidenceCount,
      scope,
      ...getResultSubjectFields(subject),
    };
  }

  const aggregateId = await ctx.db.insert("contextExpertiseAggregates", {
    ...aggregatePatch,
    createdAt: now,
  });
  return {
    aggregateId,
    contextKey,
    evidenceCount,
    scope,
    ...getResultSubjectFields(subject),
  };
}

export function isEffectiveContextExpertiseEvidence(
  evidence: Doc<"contextExpertiseEvidence">,
) {
  return evidence.correctionKind === undefined;
}

async function getContextExpertiseAggregateForScope(
  ctx: MutationCtx,
  {
    contextKey,
    scope,
    subject,
  }: {
    contextKey: string;
    scope: ContextExpertiseAudienceScope;
    subject: ContextExpertiseSubjectSelector;
  },
) {
  if (subject.subjectKind === "user") {
    return await ctx.db
      .query("contextExpertiseAggregates")
      .withIndex(
        "by_user_context_audience_scope",
        (q) =>
          q
            .eq("subjectUserId", subject.subjectUserId)
            .eq("contextKey", contextKey)
            .eq("audienceScopeKind", scope.audienceScopeKind)
            .eq("audienceScopeTargetKey", scope.audienceScopeTargetKey),
      )
      .first();
  }

  return await ctx.db
    .query("contextExpertiseAggregates")
    .withIndex(
      "by_person_context_audience_scope",
      (q) =>
        q
          .eq("subjectPersonReferentId", subject.subjectPersonReferentId)
          .eq("contextKey", contextKey)
          .eq("audienceScopeKind", scope.audienceScopeKind)
          .eq("audienceScopeTargetKey", scope.audienceScopeTargetKey),
    )
    .first();
}

async function getContextExpertiseEvidenceForScope(
  ctx: MutationCtx,
  {
    contextKey,
    scope,
    subject,
  }: {
    contextKey: string;
    scope: ContextExpertiseAudienceScope;
    subject: ContextExpertiseSubjectSelector;
  },
) {
  if (subject.subjectKind === "user") {
    return await ctx.db
      .query("contextExpertiseEvidence")
      .withIndex(
        "by_user_context_visibility_target_updatedAt",
        (q) =>
          q
            .eq("subjectUserId", subject.subjectUserId)
            .eq("contextKey", contextKey)
            .eq("visibilityKind", scope.audienceScopeKind)
            .eq("visibilityTargetKey", scope.audienceScopeTargetKey),
      )
      .order("desc")
      .take(MAX_CONTEXT_EXPERTISE_EVIDENCE_PER_AGGREGATE);
  }

  return await ctx.db
    .query("contextExpertiseEvidence")
    .withIndex(
      "by_person_context_visibility_target_updatedAt",
      (q) =>
        q
          .eq("subjectPersonReferentId", subject.subjectPersonReferentId)
          .eq("contextKey", contextKey)
          .eq("visibilityKind", scope.audienceScopeKind)
          .eq("visibilityTargetKey", scope.audienceScopeTargetKey),
    )
    .order("desc")
    .take(MAX_CONTEXT_EXPERTISE_EVIDENCE_PER_AGGREGATE);
}

function getSnapshotSubjectSelector(
  evidence: ContextExpertiseEvidenceSnapshot,
): ContextExpertiseSubjectSelector {
  const subject = getEvidenceRowSubjectSelector(evidence);
  if (subject === null) {
    throw new Error("Context Expertise Evidence subject is required.");
  }

  return subject;
}

function getAggregateSubjectFields(
  subject: ContextExpertiseSubjectSelector,
  latestEvidence: ContextExpertiseEvidenceSnapshot,
) {
  if (subject.subjectKind === "person") {
    return {
      subjectUserId: undefined,
      subjectPersonReferentId: subject.subjectPersonReferentId,
    };
  }

  return {
    subjectUserId: subject.subjectUserId,
    subjectPersonReferentId: latestEvidence.subjectPersonReferentId,
  };
}

function getResultSubjectFields(subject: ContextExpertiseSubjectSelector) {
  return subject.subjectKind === "user"
    ? { subjectUserId: subject.subjectUserId }
    : { subjectPersonReferentId: subject.subjectPersonReferentId };
}

function getTopSupportingEntryIds(
  candidates: Array<{
    entry: Doc<"knowledgeEntries">;
    entryId: Id<"knowledgeEntries">;
  }>,
) {
  return candidates
    .sort((left, right) => {
      const scoreDelta =
        getEntrySupportingScore(right.entry) - getEntrySupportingScore(left.entry);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return right.entry.updatedAt - left.entry.updatedAt;
    })
    .map((candidate) => candidate.entryId)
    .filter((entryId, index, sortedEntryIds) => {
      return sortedEntryIds.indexOf(entryId) === index;
    })
    .slice(0, TOP_SUPPORTING_ENTRY_LIMIT);
}

function getEntrySupportingScore(entry: Doc<"knowledgeEntries">) {
  return getContextExpertiseEntrySignalScore(entry);
}

export type ContextExpertiseAudienceScope = {
  audienceScopeKind: Doc<"contextExpertiseAggregates">["visibilityKind"];
  audienceScopeTargetKey: string;
};

export type RebuildContextExpertiseAggregateResult = {
  aggregateId?: Id<"contextExpertiseAggregates">;
  contextKey: string;
  evidenceCount: number;
  scope: ContextExpertiseAudienceScope;
  skippedReason?: "noEffectiveEvidence" | "noEvidence" | "noValidEntries";
  subjectUserId?: Id<"users">;
  subjectPersonReferentId?: Id<"referents">;
};

export function getAudienceScopeFromVisibility(
  visibilityKind: Doc<"contextExpertiseEvidence">["visibilityKind"],
  visibilityTargetKey: string,
): ContextExpertiseAudienceScope {
  return {
    audienceScopeKind: visibilityKind,
    audienceScopeTargetKey:
      visibilityTargetKey.trim() === "" ? visibilityKind : visibilityTargetKey,
  };
}
