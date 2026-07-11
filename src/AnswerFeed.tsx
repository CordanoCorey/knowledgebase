import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { UserCircle, X } from "lucide-react";
import { KnowledgeEntryCard, KnowledgeSlotCard } from "./components/KnowledgeCards";
import { KnowledgeTypeBadge } from "./components/KnowledgeTypeIcon";
import {
  ReferentTagLink,
  ReferentTagVisual,
} from "./components/ReferentTagLink";
import {
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
  KnowledgeContextExpertDetail,
  KnowledgeContextExpertScope,
  KnowledgeEntrySummary,
  KnowledgeContextTrendSummary,
  QuoteAttributionPersonOption,
  KnowledgeSlotSummary,
} from "./knowledgeContracts";
import { formatKnowledgeTypeLabel } from "./knowledgeContracts";

// AnswerFeed is controlled by contract-shaped props and renders only the items
// supplied by the durable data source or an explicit test fixture.
export type AnswerFeedKindFilter = "all" | "entries" | "requests";
export type AnswerFeedKnowledgeTypeFilter = "all" | AuthorableKnowledgeType;

export type AnswerFeedFilters = {
  kind: AnswerFeedKindFilter;
  knowledgeType: AnswerFeedKnowledgeTypeFilter;
  searchQuery?: string;
};

export type QuoteAttributionCorrectionInput = {
  entry: KnowledgeEntrySummary;
  nextQuotedPersonReferentId: string | null;
};

export type QuoteAttributionPersonSearchInput = {
  entry: KnowledgeEntrySummary;
  searchQuery: string;
};

export type QuoteAttributionPersonPickerState = {
  entryId: string;
  isLoading: boolean;
  options: QuoteAttributionPersonOption[];
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
  contextExpertDetail?: KnowledgeContextExpertDetail;
  contextExpertDetailLoading?: boolean;
  contextExpertScope?: KnowledgeContextExpertScope;
  contextExperts?: KnowledgeContextExpert[];
  contextTrend?: KnowledgeContextTrendSummary;
  canCorrectQuoteAttribution?: boolean;
  filterByActiveTags?: boolean;
  headingMode?: "visible" | "sr-only";
  items?: AnswerFeedItem[];
  layout?: "list" | "masonry";
  onClearSearchQuery?: () => void;
  onContributeToSlot?: (slot: KnowledgeSlotSummary) => void;
  onContextExpertDetailClose?: () => void;
  onContextExpertSelect?: (expert: KnowledgeContextExpert) => void;
  onContextExpertScopeChange?: (scope: KnowledgeContextExpertScope) => void;
  onCorrectQuoteAttribution?: (
    input: QuoteAttributionCorrectionInput,
  ) => Promise<void> | void;
  onQuoteAttributionPersonSearchChange?: (
    input: QuoteAttributionPersonSearchInput,
  ) => void;
  onHumanWeightFeedback?: (
    input: HumanWeightFeedbackInput,
  ) => Promise<void> | void;
  onNavigateToHref?: (href: string) => void;
  quoteAttributionPersonPicker?: QuoteAttributionPersonPickerState;
  searchQuery?: string;
};

export function AnswerFeed({
  activeTags,
  contextExpertDetail,
  contextExpertDetailLoading = false,
  contextExpertScope = "orbit",
  contextExperts,
  contextTrend,
  canCorrectQuoteAttribution = false,
  filterByActiveTags = true,
  headingMode = "visible",
  items = [],
  layout = "list",
  onClearSearchQuery,
  onContributeToSlot,
  onContextExpertDetailClose,
  onContextExpertSelect,
  onContextExpertScopeChange,
  onCorrectQuoteAttribution,
  onHumanWeightFeedback,
  onNavigateToHref,
  onQuoteAttributionPersonSearchChange,
  quoteAttributionPersonPicker,
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
  // Filtering can recompute often as tags/search change, so memoization is
  // scoped to normalized inputs rather than hidden module state.
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
        contextExpertDetail={contextExpertDetail}
        contextExpertDetailLoading={contextExpertDetailLoading}
        contextExpertScope={contextExpertScope}
        contextTrend={contextTrend}
        canCorrectQuoteAttribution={canCorrectQuoteAttribution}
        experts={experts}
        feedItems={feedItems}
        onContextExpertDetailClose={onContextExpertDetailClose}
        onContextExpertSelect={onContextExpertSelect}
        onContextExpertScopeChange={onContextExpertScopeChange}
        onCorrectQuoteAttribution={onCorrectQuoteAttribution}
        onNavigateToHref={onNavigateToHref}
        onQuoteAttributionPersonSearchChange={
          onQuoteAttributionPersonSearchChange
        }
        quoteAttributionPersonPicker={quoteAttributionPersonPicker}
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
              data-knowledge-type={knowledgeType}
              data-active={
                knowledgeTypeFilter === knowledgeType ? "true" : undefined
              }
              key={knowledgeType}
              onClick={() => onKnowledgeTypeFilterChange(knowledgeType)}
              type="button"
            >
              <KnowledgeTypeBadge knowledgeType={knowledgeType} />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ContextExperts({
  activeTags,
  contextExpertDetail,
  contextExpertDetailLoading,
  contextExpertScope,
  contextTrend,
  canCorrectQuoteAttribution,
  experts,
  feedItems,
  onContextExpertDetailClose,
  onContextExpertSelect,
  onContextExpertScopeChange,
  onCorrectQuoteAttribution,
  onNavigateToHref,
  onQuoteAttributionPersonSearchChange,
  quoteAttributionPersonPicker,
}: {
  activeTags: ActiveTag[];
  contextExpertDetail?: KnowledgeContextExpertDetail;
  contextExpertDetailLoading: boolean;
  contextExpertScope: KnowledgeContextExpertScope;
  contextTrend?: KnowledgeContextTrendSummary;
  canCorrectQuoteAttribution: boolean;
  experts: KnowledgeContextExpert[];
  feedItems: AnswerFeedItem[];
  onContextExpertDetailClose?: () => void;
  onContextExpertSelect?: (expert: KnowledgeContextExpert) => void;
  onContextExpertScopeChange?: (scope: KnowledgeContextExpertScope) => void;
  onCorrectQuoteAttribution?: (
    input: QuoteAttributionCorrectionInput,
  ) => Promise<void> | void;
  onNavigateToHref?: (href: string) => void;
  onQuoteAttributionPersonSearchChange?: (
    input: QuoteAttributionPersonSearchInput,
  ) => void;
  quoteAttributionPersonPicker?: QuoteAttributionPersonPickerState;
}) {
  const [selectedExpert, setSelectedExpert] =
    useState<KnowledgeContextExpert | null>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selectedExpert) {
      return;
    }

    dialogRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleCloseDialog();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedExpert]);

  const canChangeScope =
    activeTags.length > 0 && onContextExpertScopeChange !== undefined;

  if (experts.length === 0 && !canChangeScope) {
    return null;
  }

  const trendLabel = getContextTrendBadgeLabel(contextTrend);
  const selectedExpertDetail =
    selectedExpert && contextExpertDetail?.id === selectedExpert.id
      ? contextExpertDetail
      : selectedExpert
        ? getFallbackContextExpertDetail(selectedExpert, feedItems)
        : null;
  const isSelectedExpertLoading =
    selectedExpert !== null &&
    contextExpertDetailLoading &&
    contextExpertDetail?.id !== selectedExpert.id;

  function handleSelectExpert(expert: KnowledgeContextExpert) {
    setSelectedExpert(expert);
    onContextExpertSelect?.(expert);
  }

  function handleCloseDialog() {
    setSelectedExpert(null);
    onContextExpertDetailClose?.();
  }

  function handleScopeChange(scope: KnowledgeContextExpertScope) {
    if (scope === contextExpertScope) {
      return;
    }

    handleCloseDialog();
    onContextExpertScopeChange?.(scope);
  }

  return (
    <>
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
        {canChangeScope ? (
          <div className="kb-feed-expert-scope" aria-label="Context Expert audience">
            <button
              aria-pressed={contextExpertScope === "orbit"}
              onClick={() => handleScopeChange("orbit")}
              type="button"
            >
              Orbit
            </button>
            <button
              aria-pressed={contextExpertScope === "global"}
              onClick={() => handleScopeChange("global")}
              type="button"
            >
              Global
            </button>
          </div>
        ) : null}
        {experts.length > 0 ? (
          <ul>
            {experts.map((expert) => (
              <li key={expert.id}>
                <UserCircle aria-hidden="true" />
                <button
                  aria-label={`Open ${expert.name} Context Expert details`}
                  className="kb-feed-expert-button"
                  onClick={() => handleSelectExpert(expert)}
                  type="button"
                >
                  <strong>{expert.name}</strong>
                  <small>
                    {formatCount(expert.postCount, "post")} |{" "}
                    {formatCount(expert.evidenceCount, "signal")}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="kb-feed-experts-empty">No experts in this view</p>
        )}
      </section>

      {selectedExpert && selectedExpertDetail ? (
        <ContextExpertDialog
          detail={selectedExpertDetail}
          dialogRef={dialogRef}
          isLoading={isSelectedExpertLoading}
          canCorrectQuoteAttribution={canCorrectQuoteAttribution}
          onClose={handleCloseDialog}
          onCorrectQuoteAttribution={onCorrectQuoteAttribution}
          onNavigateToHref={onNavigateToHref}
          onQuoteAttributionPersonSearchChange={
            onQuoteAttributionPersonSearchChange
          }
          quoteAttributionPersonPicker={quoteAttributionPersonPicker}
        />
      ) : null}
    </>
  );
}

function ContextExpertDialog({
  detail,
  dialogRef,
  isLoading,
  canCorrectQuoteAttribution,
  onClose,
  onCorrectQuoteAttribution,
  onNavigateToHref,
  onQuoteAttributionPersonSearchChange,
  quoteAttributionPersonPicker,
}: {
  detail: KnowledgeContextExpertDetail;
  dialogRef: RefObject<HTMLElement | null>;
  isLoading: boolean;
  canCorrectQuoteAttribution: boolean;
  onClose: () => void;
  onCorrectQuoteAttribution?: (
    input: QuoteAttributionCorrectionInput,
  ) => Promise<void> | void;
  onNavigateToHref?: (href: string) => void;
  onQuoteAttributionPersonSearchChange?: (
    input: QuoteAttributionPersonSearchInput,
  ) => void;
  quoteAttributionPersonPicker?: QuoteAttributionPersonPickerState;
}) {
  const nonPostSignalCount = getNonPostSignalCount(detail);
  const postCountLabel =
    detail.contextMatchKind === "broaderContext"
      ? "Posts in broader context"
      : "Posts in context";

  function handleLinkClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onNavigateToHref) {
      return;
    }

    event.preventDefault();
    onClose();
    onNavigateToHref(href);
  }

  return (
    <div className="kb-context-expert-dialog-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="kb-context-expert-dialog-heading"
        aria-modal="true"
        className="kb-context-expert-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
          <div>
            <p className="kb-eyebrow">Context Expert</p>
            <h3 id="kb-context-expert-dialog-heading">{detail.name}</h3>
          </div>
          <button
            aria-label="Close Context Expert details"
            className="kb-context-expert-dialog-close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <dl className="kb-context-expert-stats">
          <div>
            <dt>{postCountLabel}</dt>
            <dd>{detail.postCount}</dd>
          </div>
          <div>
            <dt>Non-post signals</dt>
            <dd>{nonPostSignalCount}</dd>
          </div>
        </dl>

        {detail.href ? (
          <a
            className="kb-context-expert-profile-link"
            href={detail.href}
            onClick={(event) => handleLinkClick(event, detail.href!)}
          >
            <UserCircle aria-hidden="true" />
            View profile
          </a>
        ) : null}

        <section
          aria-labelledby="kb-context-expert-contributions-heading"
          className="kb-context-expert-contributions"
        >
          <h4 id="kb-context-expert-contributions-heading">
            Top visible contributions
          </h4>
          {isLoading ? (
            <p className="kb-context-expert-empty">Loading contributions...</p>
          ) : detail.topSupportingEntries.length > 0 ? (
            <ol>
              {detail.topSupportingEntries.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={entry.href}
                    onClick={(event) => handleLinkClick(event, entry.href)}
                  >
                    <strong>{entry.title}</strong>
                    <KnowledgeTypeBadge
                      className="kb-context-expert-entry-type"
                      knowledgeType={entry.knowledgeType}
                    />
                    <small>{entry.previewText}</small>
                  </a>
                  {canCorrectQuoteAttribution &&
                  onCorrectQuoteAttribution &&
                  entry.knowledgeType === "quote" ? (
                    <QuoteAttributionCorrectionForm
                      entry={entry}
                      onCorrectQuoteAttribution={onCorrectQuoteAttribution}
                      onQuoteAttributionPersonSearchChange={
                        onQuoteAttributionPersonSearchChange
                      }
                      personPicker={
                        quoteAttributionPersonPicker?.entryId === entry.id
                          ? quoteAttributionPersonPicker
                          : undefined
                      }
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="kb-context-expert-empty">
              No visible supporting contributions yet.
            </p>
          )}
        </section>
      </section>
    </div>
  );
}

type QuoteAttributionCorrectionStatus = "idle" | "saving" | "saved" | "error";

function QuoteAttributionCorrectionForm({
  entry,
  onCorrectQuoteAttribution,
  onQuoteAttributionPersonSearchChange,
  personPicker,
}: {
  entry: KnowledgeEntrySummary;
  onCorrectQuoteAttribution: (
    input: QuoteAttributionCorrectionInput,
  ) => Promise<void> | void;
  onQuoteAttributionPersonSearchChange?: (
    input: QuoteAttributionPersonSearchInput,
  ) => void;
  personPicker?: QuoteAttributionPersonPickerState;
}) {
  const [searchQuery, setSearchQuery] = useState(
    entry.quoteAttribution?.quotedPersonLabel ?? "",
  );
  const [selectedPerson, setSelectedPerson] =
    useState<QuoteAttributionPersonOption | null>(null);
  const [hasSearchedPerson, setHasSearchedPerson] = useState(false);
  const [status, setStatus] =
    useState<QuoteAttributionCorrectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSearchQuery(entry.quoteAttribution?.quotedPersonLabel ?? "");
    setSelectedPerson(null);
    setHasSearchedPerson(false);
    setStatus("idle");
    setErrorMessage(null);
  }, [entry.id, entry.quoteAttribution?.quotedPersonLabel]);

  async function submitCorrection(nextPersonReferentId: string | null) {
    setStatus("saving");
    setErrorMessage(null);
    try {
      await onCorrectQuoteAttribution({
        entry,
        nextQuotedPersonReferentId: nextPersonReferentId,
      });
      setStatus("saved");
      if (nextPersonReferentId === null) {
        setSearchQuery("");
        setSelectedPerson(null);
        setHasSearchedPerson(false);
        onQuoteAttributionPersonSearchChange?.({ entry, searchQuery: "" });
      }
    } catch {
      setStatus("error");
      setErrorMessage("Quote attribution update failed.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPerson) {
      setStatus("error");
      setErrorMessage("Select a Person before saving attribution.");
      return;
    }

    void submitCorrection(selectedPerson.referentId);
  }

  function handleSearchChange(nextSearchQuery: string) {
    setSearchQuery(nextSearchQuery);
    setSelectedPerson(null);
    setHasSearchedPerson(true);
    setStatus("idle");
    setErrorMessage(null);
    onQuoteAttributionPersonSearchChange?.({
      entry,
      searchQuery: nextSearchQuery,
    });
  }

  function handleSelectPerson(option: QuoteAttributionPersonOption) {
    setSearchQuery(option.label);
    setSelectedPerson(option);
    setHasSearchedPerson(true);
    setStatus("idle");
    setErrorMessage(null);
  }

  const currentLabel =
    entry.quoteAttribution?.quotedPersonLabel ?? "No quoted Person";
  const currentReferentId = entry.quoteAttribution?.quotedPersonReferentId;
  const isSaving = status === "saving";
  const trimmedSearchQuery = searchQuery.trim();
  const personOptions = personPicker?.options ?? [];
  const showPersonOptions =
    hasSearchedPerson && trimmedSearchQuery.length >= 2;

  return (
    <form className="kb-quote-attribution-correction" onSubmit={handleSubmit}>
      <p>
        <span>Quoted Person</span>
        <strong>{currentLabel}</strong>
        {currentReferentId ? <code>{currentReferentId}</code> : null}
      </p>
      <label>
        <span>Corrected Person</span>
        <input
          aria-label={`Search corrected Person for ${entry.title}`}
          disabled={isSaving}
          name={`quote-attribution-${entry.id}`}
          onChange={(event) => handleSearchChange(event.target.value)}
          type="text"
          value={searchQuery}
        />
      </label>
      {showPersonOptions ? (
        <div
          aria-label={`Person search results for ${entry.title}`}
          className="kb-quote-attribution-person-options"
          role="listbox"
        >
          {personPicker?.isLoading ? (
            <span className="kb-quote-attribution-option-empty">
              Searching People...
            </span>
          ) : personOptions.length > 0 ? (
            personOptions.map((option) => (
              <button
                aria-selected={
                  selectedPerson?.referentId === option.referentId
                    ? "true"
                    : "false"
                }
                className="kb-quote-attribution-person-option"
                key={option.tagId}
                onClick={() => handleSelectPerson(option)}
                role="option"
                type="button"
              >
                <ReferentTagVisual
                  className="kb-quote-attribution-option-visual"
                  tag={getPersonOptionTag(option)}
                />
                <span>{option.label}</span>
              </button>
            ))
          ) : (
            <span className="kb-quote-attribution-option-empty">
              No matching People.
            </span>
          )}
        </div>
      ) : null}
      {selectedPerson ? (
        <span className="kb-quote-attribution-selected" role="status">
          Selected {selectedPerson.label}
        </span>
      ) : null}
      <footer>
        <button disabled={isSaving} type="submit">
          {isSaving ? "Saving" : "Save attribution"}
        </button>
        <button
          disabled={isSaving}
          onClick={() => void submitCorrection(null)}
          type="button"
        >
          Clear attribution
        </button>
      </footer>
      {status === "saved" ? (
        <span className="kb-quote-attribution-status" role="status">
          Quote attribution updated.
        </span>
      ) : null}
      {errorMessage ? (
        <span className="kb-quote-attribution-status" role="alert">
          {errorMessage}
        </span>
      ) : null}
    </form>
  );
}

function getFallbackContextExpertDetail(
  expert: KnowledgeContextExpert,
  feedItems: AnswerFeedItem[],
): KnowledgeContextExpertDetail {
  return {
    ...expert,
    topSupportingEntries: getFallbackTopSupportingEntries(expert, feedItems),
  };
}

function getFallbackTopSupportingEntries(
  expert: KnowledgeContextExpert,
  feedItems: AnswerFeedItem[],
): KnowledgeEntrySummary[] {
  return feedItems
    .filter(isAnswerFeedAnswer)
    .map((item) => item.entry)
    .filter((entry) => entry.contributor.id === expert.id)
    .slice(0, 5);
}

function getNonPostSignalCount(expert: KnowledgeContextExpert) {
  return Math.max(0, expert.evidenceCount - expert.postCount);
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
        All Accessible Knowledge
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

function getPersonOptionTag(option: QuoteAttributionPersonOption): ActiveTag {
  return {
    canonicalKey: option.tagId,
    href: `/goto/${encodeURIComponent(option.label)}`,
    id: option.tagId,
    knowledgeType: "person",
    label: option.label,
    ...(option.thumbnailUrl === undefined
      ? {}
      : { thumbnailUrl: option.thumbnailUrl }),
  };
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatShownCount(count: number) {
  return `${formatCount(count, "item")} shown`;
}
