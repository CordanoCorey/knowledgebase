import type { Doc } from "../_generated/dataModel";
import { getApplicableHumanWeight } from "./typeBehavior";

// Pure scoring helpers for Context Expertise. Keeping this math outside Convex
// functions makes aggregate rebuilds and feed ranking easier to test.
export const CONTEXT_EXPERTISE_SCORING_VERSION =
  "context-expertise-mvp-1";
export const DEFAULT_CONTEXT_EXPERTISE_SIGNAL_SCORE = 55;
export const CONTEXT_EXPERTISE_EVIDENCE_COUNT_SCORE_BONUS = 12;
export const MAX_CONTEXT_EXPERTISE_BONUS_EVIDENCE_COUNT = 5;
export const CONTEXT_EXPERTISE_MATURITY_PER_EVIDENCE = 20;
export const BROADER_CONTEXT_EXPERTISE_SCORE_MULTIPLIER = 0.85;

export type ContextExpertiseContextMatchKind = "broaderContext";

export type ContextExpertiseCandidateContext = {
  contextKey: string;
  contextMatchKind?: ContextExpertiseContextMatchKind;
};

type ContextExpertiseEvidenceKind =
  Doc<"contextExpertiseEvidence">["evidenceKind"];
type ContextExpertiseScoredAggregate = {
  contextExpertiseScore: number;
};

export function normalizeContextExpertiseTagIds(
  tagIds: string[],
  maxTagCount?: number,
) {
  const uniqueTagIds = Array.from(new Set(tagIds)).sort(compareStrings);
  return maxTagCount === undefined
    ? uniqueTagIds
    : uniqueTagIds.slice(0, maxTagCount);
}

export function getContextExpertiseContextKey(tagIds: string[]) {
  return `tags:${tagIds.join(",")}`;
}

export function getContextExpertiseCandidateContexts(
  contextTagIds: string[],
): ContextExpertiseCandidateContext[] {
  const normalizedContextTagIds = normalizeContextExpertiseTagIds(contextTagIds);
  const contexts: ContextExpertiseCandidateContext[] = [
    { contextKey: getContextExpertiseContextKey(normalizedContextTagIds) },
  ];
  const seenContextKeys = new Set(contexts.map((context) => context.contextKey));

  if (normalizedContextTagIds.length < 2) {
    return contexts;
  }

  for (const tagId of normalizedContextTagIds) {
    const parentTagIds = normalizedContextTagIds.filter(
      (contextTagId) => contextTagId !== tagId,
    );
    const parentContextKey = getContextExpertiseContextKey(parentTagIds);
    if (seenContextKeys.has(parentContextKey)) {
      continue;
    }

    seenContextKeys.add(parentContextKey);
    contexts.push({
      contextKey: parentContextKey,
      contextMatchKind: "broaderContext",
    });
  }

  return contexts;
}

export function getContextExpertiseEvidenceSignalScore(
  entry: Pick<Doc<"knowledgeEntries">, "humanWeight" | "knowledgeType">,
  evidenceKind: ContextExpertiseEvidenceKind,
) {
  if (evidenceKind === "feedback") {
    return DEFAULT_CONTEXT_EXPERTISE_SIGNAL_SCORE;
  }

  return getContextExpertiseEntrySignalScore(entry);
}

export function getContextExpertiseEntrySignalScore(
  entry: Pick<Doc<"knowledgeEntries">, "humanWeight" | "knowledgeType">,
) {
  return (
    getApplicableHumanWeight(entry.knowledgeType, entry.humanWeight) ??
    DEFAULT_CONTEXT_EXPERTISE_SIGNAL_SCORE
  );
}

export function getContextExpertiseAggregateScore(
  signalScore: number,
  evidenceCount: number,
) {
  return Math.min(
    100,
    Math.max(
      0,
      Math.round(
        signalScore + getContextExpertiseEvidenceCountScoreBonus(evidenceCount),
      ),
    ),
  );
}

export function getContextExpertiseEvidenceCountScoreBonus(
  evidenceCount: number,
) {
  return (
    Math.min(
      Math.max(0, evidenceCount),
      MAX_CONTEXT_EXPERTISE_BONUS_EVIDENCE_COUNT,
    ) * CONTEXT_EXPERTISE_EVIDENCE_COUNT_SCORE_BONUS
  );
}

export function getContextExpertiseMaturity(evidenceCount: number) {
  return Math.min(
    100,
    Math.max(0, evidenceCount) * CONTEXT_EXPERTISE_MATURITY_PER_EVIDENCE,
  );
}

export function getEstimatedContextExpertiseSignalScoreFromAggregate(
  aggregate: Pick<
    Doc<"contextExpertiseAggregates">,
    "contextExpertiseScore" | "evidenceCount"
  >,
) {
  return Math.max(
    0,
    aggregate.contextExpertiseScore -
      getContextExpertiseEvidenceCountScoreBonus(aggregate.evidenceCount),
  );
}

export function applyContextExpertiseContextMatch<
  Aggregate extends ContextExpertiseScoredAggregate,
>(
  aggregate: Aggregate,
  contextMatchKind: ContextExpertiseContextMatchKind | undefined,
): Aggregate & { contextMatchKind?: ContextExpertiseContextMatchKind } {
  if (contextMatchKind === undefined) {
    return aggregate;
  }

  return {
    ...aggregate,
    contextExpertiseScore: getBroaderContextExpertiseScore(
      aggregate.contextExpertiseScore,
    ),
    contextMatchKind,
  };
}

export function getContextExpertiseContextMatchSortRank(
  aggregate: { contextMatchKind?: ContextExpertiseContextMatchKind },
) {
  return aggregate.contextMatchKind === "broaderContext" ? 1 : 0;
}

export function getBroaderContextExpertiseScore(contextExpertiseScore: number) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        contextExpertiseScore * BROADER_CONTEXT_EXPERTISE_SCORE_MULTIPLIER,
      ),
    ),
  );
}

function compareStrings(left: string, right: string) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
