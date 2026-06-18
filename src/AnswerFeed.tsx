import { useMemo, useState } from "react";
import { UserCircle, X } from "lucide-react";
import { KnowledgeEntryCard, KnowledgeSlotCard } from "./components/KnowledgeCards";
import { ReferentTagLink } from "./components/ReferentTagLink";
import {
  ANSWER_FEED_FIXTURE,
  type ActiveTag,
  type AnswerFeedFixtureItem,
  getAnswerFeedItemId,
  isAnswerFeedAnswer,
  isAnswerFeedSlot,
  selectAnswerFeedItems,
  selectKnowledgeContextExperts,
} from "./answerFeedData";
import type {
  AnswerFeedItem,
  AuthorableKnowledgeType,
  HumanWeightFeedbackInput,
  KnowledgeContextExpert,
  KnowledgeContextTrendSummary,
  KnowledgeSlotSummary,
} from "./knowledgeContracts";
import { formatKnowledgeTypeLabel } from "./knowledgeContracts";

export type AnswerFeedKindFilter = "all" | "entries" | "requests";
export type AnswerFeedKnowledgeTypeFilter = "all" | AuthorableKnowledgeType;

export type AnswerFeedFilters = {
  kind: AnswerFeedKindFilter;
  knowledgeType: AnswerFeedKnowledgeTypeFilter;
  searchQuery?: string;
};

const FEED_KIND_FILTERS: Array<{
  id: AnswerFeedKindFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "entries", label: "Entries" },
  { id: "requests", label: "Requests" },
];

type AnswerFeedProps = {
  activeTags: ActiveTag[];
  contextExperts?: KnowledgeContextExpert[];
  contextTrend?: KnowledgeContextTrendSummary;
  filterByActiveTags?: boolean;
  headingMode?: "visible" | "sr-only";
  items?: AnswerFeedItem[];
  layout?: "list" | "masonry";
  onClearSearchQuery?: () => void;
  onContributeToSlot?: (slot: KnowledgeSlotSummary) => void;
  onHumanWeightFeedback?: (
    input: HumanWeightFeedbackInput,
  ) => Promise<void> | void;
  onNavigateToHref?: (href: string) => void;
  searchQuery?: string;
};

export function AnswerFeed({
  activeTags,
  contextExperts,
  contextTrend,
  filterByActiveTags = true,
  headingMode = "visible",
  items = ANSWER_FEED_FIXTURE,
  layout = "list",
  onClearSearchQuery,
  onContributeToSlot,
  onHumanWeightFeedback,
  onNavigateToHref,
  searchQuery = "",
}: AnswerFeedProps) {
  const [kindFilter, setKindFilter] = useState<AnswerFeedKindFilter>("all");
  const [knowledgeTypeFilter, setKnowledgeTypeFilter] =
    useState<AnswerFeedKnowledgeTypeFilter>("all");
  const feedItems = filterByActiveTags
    ? selectAnswerFeedItems(items as AnswerFeedFixtureItem[], activeTags)
    : items;
  const knowledgeTypeOptions = useMemo(
    () => getAnswerFeedKnowledgeTypeOptions(feedItems),
    [feedItems],
  );
  const effectiveKnowledgeTypeFilter =
    knowledgeTypeFilter === "all" ||
    knowledgeTypeOptions.includes(knowledgeTypeFilter)
      ? knowledgeTypeFilter
      : "all";
  const activeSearchQuery = searchQuery.trim();
  const visibleFeedItems = useMemo(
    () =>
      filterAnswerFeedItems(feedItems, {
        kind: kindFilter,
        knowledgeType: effectiveKnowledgeTypeFilter,
        searchQuery: activeSearchQuery,
      }),
    [activeSearchQuery, effectiveKnowledgeTypeFilter, feedItems, kindFilter],
  );
  const experts =
    contextExperts ??
    (filterByActiveTags
      ? selectKnowledgeContextExperts(items as AnswerFeedFixtureItem[], activeTags)
      : []);
  const answerCount = feedItems.filter(isAnswerFeedAnswer).length;
  const slotCount = feedItems.filter(isAnswerFeedSlot).length;
  const isMasonry = layout === "masonry";
  const headingText = isMasonry ? "Answers" : getFeedHeading(activeTags);
  const headingClassName =
    headingMode === "sr-only" ? "kb-sr-only" : undefined;
  const hasActiveFilters =
    kindFilter !== "all" ||
    effectiveKnowledgeTypeFilter !== "all" ||
    activeSearchQuery.length > 0;

  return (
    <section className="kb-answer-feed" aria-labelledby="kb-answer-feed-heading">
      <header className="kb-answer-feed-header">
        <div className={headingClassName}>
          <p className="kb-eyebrow">Answer Feed</p>
          <h2 id="kb-answer-feed-heading">{headingText}</h2>
        </div>
        <div className="kb-answer-feed-counts" aria-label="Feed totals">
          {isMasonry ? (
            <span>
              {formatCount(answerCount, "entry", "entries")} +{" "}
              {formatCount(slotCount, "request")}
            </span>
          ) : (
            <>
              <span>{formatCount(answerCount, "Answer")}</span>
              <span>{formatCount(slotCount, "Open Request", "Open Requests")}</span>
            </>
          )}
          {hasActiveFilters ? (
            <span>{formatShownCount(visibleFeedItems.length)}</span>
          ) : null}
        </div>
      </header>

      <AnswerFeedControls
        kindFilter={kindFilter}
        knowledgeTypeFilter={effectiveKnowledgeTypeFilter}
        knowledgeTypeOptions={knowledgeTypeOptions}
        onKindFilterChange={setKindFilter}
        onKnowledgeTypeFilterChange={setKnowledgeTypeFilter}
      />

      {activeSearchQuery ? (
        <AnswerFeedSearchQuery
          onClearSearchQuery={onClearSearchQuery}
          searchQuery={activeSearchQuery}
        />
      ) : null}

      <ActiveContextTags
        activeTags={activeTags}
        onNavigateToHref={onNavigateToHref}
      />
      <ContextExperts
        activeTags={activeTags}
        contextTrend={contextTrend}
        experts={experts}
      />

      {!hasActiveFilters && answerCount === 0 ? (
        <FeedEmptyState
          title="No Answers match this Knowledge Context yet."
          body="Contribute the missing future Answer from here."
        />
      ) : null}

      {visibleFeedItems.length > 0 ? (
        <ol
          className={
            layout === "masonry"
              ? "kb-answer-feed-list kb-answer-feed-list-masonry"
              : "kb-answer-feed-list"
          }
        >
          {visibleFeedItems.map((item) => (
            <li data-feed-kind={item.kind} key={getAnswerFeedItemId(item)}>
              {item.kind === "answer" ? (
                <KnowledgeEntryCard
                  entry={item.entry}
                  onHumanWeightFeedback={onHumanWeightFeedback}
                  onNavigateToHref={onNavigateToHref}
                />
              ) : (
                <KnowledgeSlotCard
                  onContribute={onContributeToSlot}
                  onNavigateToHref={onNavigateToHref}
                  slot={item.slot}
                />
              )}
            </li>
          ))}
        </ol>
      ) : null}

      {hasActiveFilters && visibleFeedItems.length === 0 ? (
        <FeedEmptyState
          title={
            activeSearchQuery
              ? "No entries match this context search."
              : "No feed items match these filters."
          }
          body={
            activeSearchQuery
              ? "Clear the search or try different wording within this Knowledge Context."
              : "Adjust the Answer Feed filters to see more results."
          }
        />
      ) : null}

      {!hasActiveFilters && slotCount === 0 ? (
        <FeedEmptyState
          title="No requested entries are open in this Knowledge Context."
          body="Create a request when a future Answer should be contributed."
        />
      ) : null}
    </section>
  );
}

function AnswerFeedSearchQuery({
  onClearSearchQuery,
  searchQuery,
}: {
  onClearSearchQuery?: () => void;
  searchQuery: string;
}) {
  return (
    <div className="kb-feed-active-search" role="status">
      <span>Searching this context for "{searchQuery}"</span>
      {onClearSearchQuery ? (
        <button
          aria-label="Clear context search"
          onClick={onClearSearchQuery}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function AnswerFeedControls({
  kindFilter,
  knowledgeTypeFilter,
  knowledgeTypeOptions,
  onKindFilterChange,
  onKnowledgeTypeFilterChange,
}: {
  kindFilter: AnswerFeedKindFilter;
  knowledgeTypeFilter: AnswerFeedKnowledgeTypeFilter;
  knowledgeTypeOptions: AuthorableKnowledgeType[];
  onKindFilterChange: (filter: AnswerFeedKindFilter) => void;
  onKnowledgeTypeFilterChange: (filter: AnswerFeedKnowledgeTypeFilter) => void;
}) {
  return (
    <section className="kb-answer-feed-controls" aria-label="Answer Feed controls">
      <div className="kb-feed-filter-group" aria-label="Feed kind filter">
        {FEED_KIND_FILTERS.map((filter) => (
          <button
            aria-pressed={kindFilter === filter.id}
            data-active={kindFilter === filter.id ? "true" : undefined}
            key={filter.id}
            onClick={() => onKindFilterChange(filter.id)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      {knowledgeTypeOptions.length > 0 ? (
        <div className="kb-feed-filter-group" aria-label="Knowledge Type filter">
          <button
            aria-pressed={knowledgeTypeFilter === "all"}
            data-active={knowledgeTypeFilter === "all" ? "true" : undefined}
            onClick={() => onKnowledgeTypeFilterChange("all")}
            type="button"
          >
            All Types
          </button>
          {knowledgeTypeOptions.map((knowledgeType) => (
            <button
              aria-pressed={knowledgeTypeFilter === knowledgeType}
              data-active={
                knowledgeTypeFilter === knowledgeType ? "true" : undefined
              }
              key={knowledgeType}
              onClick={() => onKnowledgeTypeFilterChange(knowledgeType)}
              type="button"
            >
              {formatKnowledgeTypeLabel(knowledgeType)}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ContextExperts({
  activeTags,
  contextTrend,
  experts,
}: {
  activeTags: ActiveTag[];
  contextTrend?: KnowledgeContextTrendSummary;
  experts: KnowledgeContextExpert[];
}) {
  if (experts.length === 0) {
    return null;
  }

  const trendLabel = getContextTrendBadgeLabel(contextTrend);

  return (
    <section
      aria-label={
        activeTags.length > 0 ? "Knowledge Context experts" : "Top contributors"
      }
      className="kb-feed-experts"
    >
      <span className="kb-feed-experts-label">
        {activeTags.length > 0 ? "Context experts" : "Top contributors"}
      </span>
      {trendLabel ? (
        <span className="kb-feed-trend-badge" title={getContextTrendTitle(contextTrend)}>
          {trendLabel}
        </span>
      ) : null}
      <ul>
        {experts.map((expert) => (
          <li key={expert.id}>
            <UserCircle aria-hidden="true" />
            <div>
              <strong>
                {expert.href ? <a href={expert.href}>{expert.name}</a> : expert.name}
              </strong>
              <small>
                {expert.contributionCount}{" "}
                {expert.contributionCount === 1 ? "entry" : "entries"} |{" "}
                {expert.averageHumanWeight} avg HW
              </small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function getContextTrendBadgeLabel(
  contextTrend: KnowledgeContextTrendSummary | undefined,
) {
  if (!contextTrend || contextTrend.trendKind === "quiet") {
    return null;
  }

  if (contextTrend.trendKind === "popularAndNeedsContribution") {
    return `Trending ${contextTrend.trendScore} + needs`;
  }

  if (contextTrend.trendKind === "needsContribution") {
    const requestCount =
      contextTrend.openRequestCount + contextTrend.overdueRequestCount;
    return `Needs ${requestCount}`;
  }

  return `Trending ${contextTrend.trendScore}`;
}

function getContextTrendTitle(
  contextTrend: KnowledgeContextTrendSummary | undefined,
) {
  if (!contextTrend) {
    return undefined;
  }

  const requestCount =
    contextTrend.openRequestCount + contextTrend.overdueRequestCount;
  return [
    `${contextTrend.recentVisitCount} recent visits`,
    `${contextTrend.totalVisitCount} total visits`,
    formatCount(requestCount, "open request"),
  ].join(", ");
}

function ActiveContextTags({
  activeTags,
  onNavigateToHref,
}: {
  activeTags: ActiveTag[];
  onNavigateToHref?: (href: string) => void;
}) {
  if (activeTags.length === 0) {
    return (
      <p className="kb-feed-context-empty" role="status">
        Global Knowledge Context
      </p>
    );
  }

  return (
    <ul className="kb-feed-tag-list" aria-label="Active Tags">
      {activeTags.map((tag) => (
        <li key={tag.id}>
          <ReferentTagLink
            onNavigateToHref={onNavigateToHref}
            showIcon
            tag={tag}
          />
        </li>
      ))}
    </ul>
  );
}

function FeedEmptyState({
  body,
  title,
}: {
  body: string;
  title: string;
}) {
  return (
    <section className="kb-feed-empty" role="status">
      <h3>{title}</h3>
      <p>{body}</p>
    </section>
  );
}

export function getAnswerFeedKnowledgeTypeOptions(items: AnswerFeedItem[]) {
  return Array.from(new Set(items.map(getAnswerFeedItemKnowledgeType))).sort(
    (left, right) =>
      formatKnowledgeTypeLabel(left).localeCompare(formatKnowledgeTypeLabel(right)),
  );
}

export function filterAnswerFeedItems(
  items: AnswerFeedItem[],
  filters: AnswerFeedFilters,
) {
  const searchQuery = normalizeAnswerFeedSearchQuery(filters.searchQuery ?? "");

  return items.filter((item) => {
    return (
      matchesAnswerFeedKindFilter(item, filters.kind) &&
      (filters.knowledgeType === "all" ||
        getAnswerFeedItemKnowledgeType(item) === filters.knowledgeType) &&
      matchesAnswerFeedSearchQuery(item, searchQuery)
    );
  });
}

export function getAnswerFeedItemKnowledgeType(item: AnswerFeedItem) {
  return item.kind === "answer"
    ? item.entry.knowledgeType
    : item.slot.requestedKnowledgeType;
}

function matchesAnswerFeedKindFilter(
  item: AnswerFeedItem,
  filter: AnswerFeedKindFilter,
) {
  if (filter === "entries") {
    return item.kind === "answer";
  }

  if (filter === "requests") {
    return item.kind === "slot";
  }

  return true;
}

function matchesAnswerFeedSearchQuery(item: AnswerFeedItem, searchQuery: string) {
  if (!searchQuery) {
    return true;
  }

  if (item.kind !== "answer") {
    return false;
  }

  const searchableText = [
    item.entry.title,
    item.entry.previewText,
    item.entry.primaryTagLabel,
    ...item.entry.contextPreviewTagLabels,
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(searchQuery);
}

function normalizeAnswerFeedSearchQuery(searchQuery: string) {
  return searchQuery.trim().toLowerCase();
}

function getFeedHeading(activeTags: ActiveTag[]) {
  if (activeTags.length === 0) {
    return "Dashboard Answers";
  }

  if (activeTags.length === 1) {
    return `Answers for ${activeTags[0].label}`;
  }

  return "Matching Answers";
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatShownCount(count: number) {
  return `${formatCount(count, "item")} shown`;
}
