import {
  BookOpen,
  CalendarDays,
  FileText,
  FolderPlus,
  Tag,
  UserCircle,
} from "lucide-react";
import {
  formatKnowledgeTypeLabel,
  type KnowledgeEntrySummary,
  type KnowledgeSlotStatus,
  type KnowledgeSlotSummary,
} from "../knowledgeContracts";

type KnowledgeEntryCardProps = {
  className?: string;
  entry: KnowledgeEntrySummary;
};

type KnowledgeSlotCardProps = {
  className?: string;
  slot: KnowledgeSlotSummary;
};

const SLOT_STATUS_LABELS: Record<KnowledgeSlotStatus, string> = {
  open: "Open",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  overdue: "Overdue",
};

const CARD_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function KnowledgeEntryCard({ className, entry }: KnowledgeEntryCardProps) {
  const knowledgeTypeLabel = formatKnowledgeTypeLabel(entry.knowledgeType);

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
        <span className="kb-card-type">{knowledgeTypeLabel}</span>
      </header>

      <p className="kb-card-preview">{entry.previewText}</p>

      <dl className="kb-card-meta kb-entry-card-meta">
        <div>
          <dt>Primary Tag</dt>
          <dd>{entry.primaryTagLabel}</dd>
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

export function KnowledgeSlotCard({ className, slot }: KnowledgeSlotCardProps) {
  const requestedTypeLabel = formatKnowledgeTypeLabel(slot.requestedKnowledgeType);
  const statusLabel = SLOT_STATUS_LABELS[slot.status];
  const promptText =
    slot.promptText?.trim() || "Contribution requested for this Knowledge Context.";

  return (
    <article
      aria-labelledby={`knowledge-slot-${slot.id}-title`}
      className={joinClassNames("kb-knowledge-card kb-slot-card", className)}
      data-status={slot.status}
    >
      <header className="kb-card-header">
        <div className="kb-card-title-block">
          <p className="kb-card-eyebrow">Knowledge Slot</p>
          <h3 id={`knowledge-slot-${slot.id}-title`}>
            <a href={slot.href}>{slot.title}</a>
          </h3>
        </div>
        <span className="kb-slot-status">{statusLabel}</span>
      </header>

      <div className="kb-slot-request">
        <FileText aria-hidden="true" />
        <div>
          <span>Requested Type</span>
          <strong>{requestedTypeLabel}</strong>
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
        title={`${slot.title} context Tags`}
      />

      <footer className="kb-card-footer">
        <a className="kb-card-action kb-card-action-primary" href={slot.href}>
          <FolderPlus aria-hidden="true" />
          Contribute {requestedTypeLabel}
        </a>
      </footer>
    </article>
  );
}

function TagList({
  emptyLabel,
  labels,
  title,
}: {
  emptyLabel: string;
  labels: string[];
  title: string;
}) {
  return (
    <div className="kb-card-tags" aria-label={title}>
      <Tag aria-hidden="true" />
      {labels.length > 0 ? (
        labels.map((label) => <span key={label}>{label}</span>)
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
