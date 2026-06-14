import {
  BookOpen,
  CalendarDays,
  FolderPlus,
  Tag,
  UserCircle,
} from "lucide-react";
import type { MouseEvent } from "react";
import {
  formatKnowledgeTypeLabel,
  type ContributorSummary,
  type KnowledgeEntrySummary,
  type KnowledgeSlotStatus,
  type KnowledgeSlotSummary,
} from "../knowledgeContracts";
import { KnowledgeTypeBadge, KnowledgeTypeIcon } from "./KnowledgeTypeIcon";
import { ReferentTagLink } from "./ReferentTagLink";

type KnowledgeEntryCardProps = {
  className?: string;
  entry: KnowledgeEntrySummary;
  onNavigateToHref?: (href: string) => void;
};

type KnowledgeSlotCardProps = {
  className?: string;
  onContribute?: (slot: KnowledgeSlotSummary) => void;
  onNavigateToHref?: (href: string) => void;
  slot: KnowledgeSlotSummary;
};

const SLOT_STATUS_LABELS: Record<KnowledgeSlotStatus, string> = {
  open: "Open request",
  fulfilled: "Complete",
  cancelled: "Cancelled",
  overdue: "Past due",
};

const CARD_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function KnowledgeEntryCard({
  className,
  entry,
  onNavigateToHref,
}: KnowledgeEntryCardProps) {
  return (
    <article
      aria-labelledby={`knowledge-entry-${entry.id}-title`}
      className={joinClassNames("kb-knowledge-card kb-entry-card", className)}
    >
      <header className="kb-card-header">
        <div className="kb-card-title-block">
          <p className="kb-card-eyebrow">Knowledge Entry</p>
          <h3 id={`knowledge-entry-${entry.id}-title`}>
            <a href={entry.href}>{entry.title}</a>
          </h3>
        </div>
        <KnowledgeTypeBadge
          className="kb-card-type"
          knowledgeType={entry.knowledgeType}
        />
        <span className="kb-human-weight-badge">Human Weight {entry.humanWeight}</span>
      </header>

      <ContributorPanel contributor={entry.contributor} />

      <p className="kb-card-preview">{entry.previewText}</p>

      <dl className="kb-card-meta kb-entry-card-meta">
        <div>
          <dt>Primary Tag</dt>
          <dd>
            <ReferentTagLink
              className="kb-inline-tag-link"
              label={entry.primaryTagLabel}
              onNavigateToHref={onNavigateToHref}
            />
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatCardDate(entry.updatedAt)}</dd>
        </div>
        <div className="kb-human-weight-metric">
          <dt>Human Weight</dt>
          <dd>{entry.humanWeight}/100</dd>
        </div>
      </dl>

      <TagList
        emptyLabel="No context Tags"
        labels={entry.contextPreviewTagLabels}
        onNavigateToHref={onNavigateToHref}
        title={`${entry.title} context Tags`}
      />

      <footer className="kb-card-footer">
        <a className="kb-card-action" href={entry.href}>
          <BookOpen aria-hidden="true" />
          Open Entry
        </a>
      </footer>
    </article>
  );
}

function ContributorPanel({
  contributor,
}: {
  contributor: ContributorSummary;
}) {
  const contributorName = contributor.href ? (
    <a href={contributor.href}>{contributor.name}</a>
  ) : (
    contributor.name
  );

  return (
    <div className="kb-entry-contributor">
      <UserCircle aria-hidden="true" />
      <div>
        <span>Contributed by</span>
        <strong>{contributorName}</strong>
      </div>
    </div>
  );
}

export function KnowledgeSlotCard({
  className,
  onContribute,
  onNavigateToHref,
  slot,
}: KnowledgeSlotCardProps) {
  const requestedTypeLabel = formatKnowledgeTypeLabel(slot.requestedKnowledgeType);
  const statusLabel = SLOT_STATUS_LABELS[slot.status];
  const promptText =
    slot.promptText?.trim() || "Add the missing content for this Knowledge Context.";

  function handleContributeClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!onContribute) {
      return;
    }

    event.preventDefault();
    onContribute(slot);
  }

  return (
    <article
      aria-labelledby={`knowledge-slot-${slot.id}-title`}
      className={joinClassNames("kb-knowledge-card kb-slot-card", className)}
      data-status={slot.status}
    >
      <header className="kb-card-header">
        <div className="kb-card-title-block">
          <p className="kb-card-eyebrow">Requested Entry</p>
          <h3 id={`knowledge-slot-${slot.id}-title`}>
            <a href={slot.href}>{slot.title}</a>
          </h3>
        </div>
        <span className="kb-slot-status">{statusLabel}</span>
      </header>

      <div className="kb-slot-request">
        <KnowledgeTypeIcon
          className="kb-slot-request-type-icon"
          knowledgeType={slot.requestedKnowledgeType}
        />
        <div>
          <span>Entry needed</span>
          <strong>{requestedTypeLabel} needed</strong>
        </div>
      </div>

      <p className="kb-card-preview">{promptText}</p>

      <dl className="kb-card-meta">
        <div>
          <dt>
            <UserCircle aria-hidden="true" />
            Target
          </dt>
          <dd>{slot.targetLabel}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays aria-hidden="true" />
            Due
          </dt>
          <dd>{slot.dueAt ? formatCardDate(slot.dueAt) : "No due date"}</dd>
        </div>
      </dl>

      <TagList
        emptyLabel="No context Tags"
        labels={slot.contextPreviewTagLabels}
        onNavigateToHref={onNavigateToHref}
        title={`${slot.title} context Tags`}
      />

      <footer className="kb-card-footer kb-slot-card-footer">
        <p className="kb-slot-contribution-note">
          Add content to complete this entry.
        </p>
        <a
          className="kb-card-action kb-card-action-primary"
          href={slot.href}
          onClick={handleContributeClick}
        >
          <FolderPlus aria-hidden="true" />
          Add missing {requestedTypeLabel}
        </a>
      </footer>
    </article>
  );
}

function TagList({
  emptyLabel,
  labels,
  onNavigateToHref,
  title,
}: {
  emptyLabel: string;
  labels: string[];
  onNavigateToHref?: (href: string) => void;
  title: string;
}) {
  return (
    <div className="kb-card-tags" aria-label={title}>
      <Tag aria-hidden="true" />
      {labels.length > 0 ? (
        labels.map((label) => (
          <ReferentTagLink
            className="kb-referent-tag-link"
            key={label}
            label={label}
            onNavigateToHref={onNavigateToHref}
          />
        ))
      ) : (
        <span>{emptyLabel}</span>
      )}
    </div>
  );
}

function formatCardDate(timestamp: number) {
  return CARD_DATE_FORMATTER.format(new Date(timestamp));
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}
