import { UserCircle } from "lucide-react";
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
  KnowledgeContextExpert,
  KnowledgeContextTrendSummary,
  KnowledgeSlotSummary,
} from "./knowledgeContracts";

type AnswerFeedProps = {
  activeTags: ActiveTag[];
  contextExperts?: KnowledgeContextExpert[];
  contextTrend?: KnowledgeContextTrendSummary;
  items?: AnswerFeedFixtureItem[];
  layout?: "list" | "masonry";
  onContributeToSlot?: (slot: KnowledgeSlotSummary) => void;
  onNavigateToHref?: (href: string) => void;
};

export function AnswerFeed({
  activeTags,
  contextExperts,
  contextTrend,
  items = ANSWER_FEED_FIXTURE,
  layout = "list",
  onContributeToSlot,
  onNavigateToHref,
}: AnswerFeedProps) {
  const feedItems = selectAnswerFeedItems(items, activeTags);
  const experts =
    contextExperts ?? selectKnowledgeContextExperts(items, activeTags);
  const answerCount = feedItems.filter(isAnswerFeedAnswer).length;
  const slotCount = feedItems.filter(isAnswerFeedSlot).length;
  const isMasonry = layout === "masonry";

  return (
    <section className="kb-answer-feed" aria-labelledby="kb-answer-feed-heading">
      <header className="kb-answer-feed-header">
        <div>
          <p className="kb-eyebrow">Answer Feed</p>
          <h2 id="kb-answer-feed-heading">
            {isMasonry ? "Answers" : getFeedHeading(activeTags)}
          </h2>
        </div>
        <div className="kb-answer-feed-counts" aria-label="Feed totals">
          {isMasonry ? (
            <span>
              {formatCount(answerCount, "entry")} + {formatCount(slotCount, "request")}
            </span>
          ) : (
            <>
              <span>{formatCount(answerCount, "Answer")}</span>
              <span>{formatCount(slotCount, "Open Request", "Open Requests")}</span>
            </>
          )}
        </div>
      </header>

      <ActiveContextTags
        activeTags={activeTags}
        onNavigateToHref={onNavigateToHref}
      />
      <ContextExperts
        activeTags={activeTags}
        contextTrend={contextTrend}
        experts={experts}
      />

      {answerCount === 0 ? (
        <FeedEmptyState
          title="No Answers match this Knowledge Context yet."
          body="Contribute the missing future Answer from here."
        />
      ) : null}

      {feedItems.length > 0 ? (
        <ol
          className={
            layout === "masonry"
              ? "kb-answer-feed-list kb-answer-feed-list-masonry"
              : "kb-answer-feed-list"
          }
        >
          {feedItems.map((item) => (
            <li data-feed-kind={item.kind} key={getAnswerFeedItemId(item)}>
              {item.kind === "answer" ? (
                <KnowledgeEntryCard
                  entry={item.entry}
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

      {slotCount === 0 ? (
        <FeedEmptyState
          title="No requested entries are open in this Knowledge Context."
          body="Create a request when a future Answer should be contributed."
        />
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
