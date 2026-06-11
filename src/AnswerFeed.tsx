import { KnowledgeEntryCard, KnowledgeSlotCard } from "./components/KnowledgeCards";
import {
  ANSWER_FEED_FIXTURE,
  type ActiveTag,
  type AnswerFeedFixtureItem,
  getAnswerFeedItemId,
  isAnswerFeedAnswer,
  isAnswerFeedSlot,
  selectAnswerFeedItems,
} from "./answerFeedData";
import type { KnowledgeSlotSummary } from "./knowledgeContracts";

type AnswerFeedProps = {
  activeTags: ActiveTag[];
  items?: AnswerFeedFixtureItem[];
  onContributeToSlot?: (slot: KnowledgeSlotSummary) => void;
};

export function AnswerFeed({
  activeTags,
  items = ANSWER_FEED_FIXTURE,
  onContributeToSlot,
}: AnswerFeedProps) {
  const feedItems = selectAnswerFeedItems(items, activeTags);
  const answerCount = feedItems.filter(isAnswerFeedAnswer).length;
  const slotCount = feedItems.filter(isAnswerFeedSlot).length;

  return (
    <section className="kb-answer-feed" aria-labelledby="kb-answer-feed-heading">
      <header className="kb-answer-feed-header">
        <div>
          <p className="kb-eyebrow">Answer Feed</p>
          <h2 id="kb-answer-feed-heading">{getFeedHeading(activeTags)}</h2>
        </div>
        <div className="kb-answer-feed-counts" aria-label="Feed totals">
          <span>{answerCount} Answers</span>
          <span>{slotCount} Knowledge Slots</span>
        </div>
      </header>

      <ActiveContextTags activeTags={activeTags} />

      {answerCount === 0 ? (
        <FeedEmptyState
          title="No Answers match this Knowledge Context yet."
          body="Contribute the missing future Answer from here."
        />
      ) : null}

      {feedItems.length > 0 ? (
        <ol className="kb-answer-feed-list">
          {feedItems.map((item) => (
            <li data-feed-kind={item.kind} key={getAnswerFeedItemId(item)}>
              {item.kind === "answer" ? (
                <KnowledgeEntryCard entry={item.entry} />
              ) : (
                <KnowledgeSlotCard
                  onContribute={onContributeToSlot}
                  slot={item.slot}
                />
              )}
            </li>
          ))}
        </ol>
      ) : null}

      {slotCount === 0 ? (
        <FeedEmptyState
          title="No Knowledge Slots are open in this Knowledge Context."
          body="Create a Knowledge Slot when a future Answer should be requested."
        />
      ) : null}
    </section>
  );
}

function ActiveContextTags({ activeTags }: { activeTags: ActiveTag[] }) {
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
          <a href={tag.href}>{tag.label}</a>
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
