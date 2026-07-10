import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Database,
  FolderPlus,
  MessageSquare,
  RotateCcw,
  Send,
  Tag,
  UserCircle,
  X,
} from "lucide-react";
import { useId, useState, type FormEvent, type MouseEvent } from "react";
import {
  formatKnowledgeTypeLabel,
  getApplicableHumanWeight,
  type ActiveTag,
  type ContributorSummary,
  type HumanWeightFeedbackInput,
  type HumanWeightFeedbackKind,
  type KnowledgeEntrySummary,
  type KnowledgeSlotStatus,
  type KnowledgeSlotSummary,
  type SmartStorageProposalAcceptabilityStatus,
  type SmartStorageReviewSlotSummary,
  isWeightBearingKnowledgeType,
} from "../knowledgeContracts";
import { KnowledgeTypeBadge, KnowledgeTypeIcon } from "./KnowledgeTypeIcon";
import { ReferentTagLink } from "./ReferentTagLink";

// Reusable, contract-driven display components for entries and requests;
// mutation behavior is injected through callbacks.
type KnowledgeEntryCardProps = {
  className?: string;
  entry: KnowledgeEntrySummary;
  onHumanWeightFeedback?: (
    input: HumanWeightFeedbackInput,
  ) => Promise<void> | void;
  onNavigateToHref?: (href: string) => void;
};

type KnowledgeSlotCardProps = {
  className?: string;
  onContribute?: (slot: KnowledgeSlotSummary) => void;
  onNavigateToHref?: (href: string) => void;
  slot: KnowledgeSlotSummary;
};

type ReviewSlotCardProps = {
  className?: string;
  onAssign?: (
    reviewSlot: SmartStorageReviewSlotSummary,
    targetUserId: string,
  ) => Promise<void> | void;
  onNavigateToHref?: (href: string) => void;
  onDismissRefresh?: (
    reviewSlot: SmartStorageReviewSlotSummary,
  ) => Promise<void> | void;
  onRequestRefresh?: (
    reviewSlot: SmartStorageReviewSlotSummary,
  ) => Promise<void> | void;
  onResume?: (reviewSlot: SmartStorageReviewSlotSummary) => void;
  reviewSlot: SmartStorageReviewSlotSummary;
};

const SLOT_STATUS_LABELS: Record<KnowledgeSlotStatus, string> = {
  open: "Open request",
  fulfilled: "Complete",
  cancelled: "Cancelled",
  overdue: "Past due",
};

const REVIEW_SLOT_STATUS_LABELS: Record<
  SmartStorageProposalAcceptabilityStatus,
  string
> = {
  accepted: "Accepted",
  blocked: "Blocked",
  closed: "Closed",
  needsResolution: "Needs resolution",
  ready: "Ready to review",
};

const CARD_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const HUMAN_WEIGHT_FEEDBACK_OPTIONS: Array<{
  id: HumanWeightFeedbackKind;
  label: string;
}> = [
  { id: "recognize", label: "Recognize" },
  { id: "used", label: "Used" },
  { id: "notHuman", label: "Not human" },
  { id: "wrongContext", label: "Wrong context" },
];

type FeedbackStatus = "idle" | "saving" | "saved" | "error";

export function KnowledgeEntryCard({
  className,
  entry,
  onHumanWeightFeedback,
  onNavigateToHref,
}: KnowledgeEntryCardProps) {
  const humanWeight = getApplicableHumanWeight(entry);
  const humanWeightConcern = entry.humanWeightConcern;
  const humanWeightCredit = entry.humanWeightCredit;
  const feedbackPanelId = useId();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] =
    useState<HumanWeightFeedbackKind>("recognize");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle");
  const canRecordHumanWeightFeedback =
    isWeightBearingKnowledgeType(entry.knowledgeType) &&
    onHumanWeightFeedback !== undefined;

  async function handleHumanWeightFeedbackSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!onHumanWeightFeedback) {
      return;
    }

    setFeedbackStatus("saving");
    try {
      const trimmedNote = feedbackNote.trim();
      await onHumanWeightFeedback({
        entry,
        feedbackKind,
        ...(trimmedNote === "" ? {} : { feedbackNote: trimmedNote }),
      });
      setFeedbackStatus("saved");
    } catch {
      setFeedbackStatus("error");
    }
  }

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
        {humanWeight === undefined ? null : (
          <span className="kb-human-weight-badge">
            Human Weight {humanWeight}
          </span>
        )}
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
              tag={entry.primaryTag}
            />
          </dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatCardDate(entry.updatedAt)}</dd>
        </div>
        {humanWeight === undefined ? null : (
          <div className="kb-human-weight-metric">
            <dt>Human Weight</dt>
            <dd>{humanWeight}/100</dd>
          </div>
        )}
        {humanWeightConcern === undefined ? null : (
          <div className="kb-human-weight-concern">
            <dt>Human Weight Review</dt>
            <dd>{formatHumanWeightConcern(humanWeightConcern)}</dd>
          </div>
        )}
        {humanWeightCredit === undefined ? null : (
          <div className="kb-human-weight-credit">
            <dt>Human Weight Credits</dt>
            <dd>{humanWeightCredit.label}</dd>
          </div>
        )}
      </dl>

      <TagList
        emptyLabel="No context Tags"
        labels={entry.contextPreviewTagLabels}
        onNavigateToHref={onNavigateToHref}
        tags={entry.contextPreviewTags}
        title={`${entry.title} context Tags`}
      />

      <footer className="kb-card-footer">
        {canRecordHumanWeightFeedback ? (
          <button
            aria-controls={feedbackPanelId}
            aria-expanded={isFeedbackOpen}
            className="kb-card-action kb-human-weight-feedback-toggle"
            onClick={() => setIsFeedbackOpen((isOpen) => !isOpen)}
            type="button"
          >
            <MessageSquare aria-hidden="true" />
            Feedback
          </button>
        ) : null}
        <a className="kb-card-action" href={entry.href}>
          <BookOpen aria-hidden="true" />
          Open Entry
        </a>
      </footer>

      {isFeedbackOpen && onHumanWeightFeedback ? (
        <form
          aria-labelledby={`${feedbackPanelId}-heading`}
          className="kb-human-weight-feedback"
          id={feedbackPanelId}
          onSubmit={handleHumanWeightFeedbackSubmit}
          role="dialog"
        >
          <header>
            <h4 id={`${feedbackPanelId}-heading`}>Human Weight Feedback</h4>
          </header>
          <div
            aria-label="Human Weight Feedback kind"
            className="kb-human-weight-feedback-options"
            role="group"
          >
            {HUMAN_WEIGHT_FEEDBACK_OPTIONS.map((option) => (
              <button
                aria-pressed={feedbackKind === option.id}
                data-active={feedbackKind === option.id ? "true" : undefined}
                key={option.id}
                onClick={() => {
                  setFeedbackKind(option.id);
                  setFeedbackStatus("idle");
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="kb-human-weight-feedback-note">
            <span>Note</span>
            <textarea
              maxLength={1000}
              onChange={(event) => {
                setFeedbackNote(event.target.value);
                setFeedbackStatus("idle");
              }}
              rows={3}
              value={feedbackNote}
            />
          </label>
          <footer>
            <button
              className="kb-card-action kb-human-weight-feedback-submit"
              disabled={feedbackStatus === "saving"}
              type="submit"
            >
              <Send aria-hidden="true" />
              {feedbackStatus === "saving" ? "Saving" : "Save"}
            </button>
            {feedbackStatus === "saved" ? (
              <span className="kb-human-weight-feedback-status" role="status">
                Feedback saved.
              </span>
            ) : null}
            {feedbackStatus === "error" ? (
              <span className="kb-human-weight-feedback-status" role="alert">
                Feedback failed.
              </span>
            ) : null}
          </footer>
        </form>
      ) : null}
    </article>
  );
}

function formatHumanWeightConcern(
  concern: NonNullable<KnowledgeEntrySummary["humanWeightConcern"]>,
) {
  const expectationLabel =
    concern.expectation === "required" ? "Required" : "Expected";

  return `${expectationLabel} human substance below ${concern.threshold}/100.`;
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
        <KnowledgeTypeBadge
          className="kb-card-type"
          knowledgeType={slot.requestedKnowledgeType}
        />
        <span className="kb-slot-status">{statusLabel}</span>
      </header>

      <section
        aria-labelledby={`knowledge-slot-${slot.id}-missing-title`}
        className="kb-slot-missing-content"
      >
        <div className="kb-slot-missing-header">
          <span
            className="kb-slot-missing-icon"
            data-knowledge-type={slot.requestedKnowledgeType}
          >
            <KnowledgeTypeIcon knowledgeType={slot.requestedKnowledgeType} />
          </span>
          <div className="kb-slot-missing-title">
            <span>{requestedTypeLabel} needed</span>
            <strong id={`knowledge-slot-${slot.id}-missing-title`}>
              Missing {requestedTypeLabel}
            </strong>
          </div>
        </div>

        <p className="kb-slot-missing-copy">{promptText}</p>

        <footer className="kb-card-footer kb-slot-card-footer">
          <a
            className="kb-card-action kb-card-action-primary"
            href={slot.href}
            onClick={handleContributeClick}
          >
            <FolderPlus aria-hidden="true" />
            Add missing {requestedTypeLabel}
          </a>
        </footer>
      </section>

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
        tags={slot.contextPreviewTags}
        title={`${slot.title} context Tags`}
      />
    </article>
  );
}

export function ReviewSlotCard({
  className,
  onAssign,
  onDismissRefresh,
  onNavigateToHref,
  onRequestRefresh,
  onResume,
  reviewSlot,
}: ReviewSlotCardProps) {
  const [assignmentTargetUserId, setAssignmentTargetUserId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [isDismissingRefresh, setIsDismissingRefresh] = useState(false);
  const [isRequestingRefresh, setIsRequestingRefresh] = useState(false);
  const proposedTypeLabel = formatKnowledgeTypeLabel(
    reviewSlot.proposedKnowledgeType,
  );
  const statusLabel = REVIEW_SLOT_STATUS_LABELS[reviewSlot.acceptability.status];
  const canAssign = reviewSlot.canAssign && onAssign !== undefined;
  const canRequestRefresh =
    reviewSlot.refresh !== undefined && onRequestRefresh !== undefined;
  const canDismissRefresh =
    reviewSlot.refresh !== undefined && onDismissRefresh !== undefined;

  function handleResumeClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!onResume) {
      return;
    }

    event.preventDefault();
    onResume(reviewSlot);
  }

  async function handleAssignSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAssign) {
      return;
    }

    const targetUserId = assignmentTargetUserId.trim();
    if (!targetUserId) {
      return;
    }

    setIsAssigning(true);
    try {
      await onAssign(reviewSlot, targetUserId);
      setAssignmentTargetUserId("");
    } finally {
      setIsAssigning(false);
    }
  }

  async function handleRequestRefresh() {
    if (!canRequestRefresh) {
      return;
    }

    setIsRequestingRefresh(true);
    try {
      await onRequestRefresh(reviewSlot);
    } finally {
      setIsRequestingRefresh(false);
    }
  }

  async function handleDismissRefresh() {
    if (!canDismissRefresh) {
      return;
    }

    setIsDismissingRefresh(true);
    try {
      await onDismissRefresh(reviewSlot);
    } finally {
      setIsDismissingRefresh(false);
    }
  }

  return (
    <article
      aria-labelledby={`review-slot-${reviewSlot.id}-title`}
      className={joinClassNames(
        "kb-knowledge-card kb-slot-card kb-review-slot-card",
        className,
      )}
      data-status={reviewSlot.acceptability.status}
    >
      <header className="kb-card-header">
        <div className="kb-card-title-block">
          <p className="kb-card-eyebrow">
            Review Slot
            {reviewSlot.refresh ? ` - ${reviewSlot.refresh.originLabel}` : ""}
          </p>
          <h3 id={`review-slot-${reviewSlot.id}-title`}>
            <a href={reviewSlot.href}>{reviewSlot.title}</a>
          </h3>
        </div>
        <KnowledgeTypeBadge
          className="kb-card-type"
          knowledgeType={reviewSlot.proposedKnowledgeType}
        />
        <span className="kb-slot-status">{statusLabel}</span>
      </header>

      <section
        aria-labelledby={`review-slot-${reviewSlot.id}-work-title`}
        className="kb-slot-missing-content kb-review-slot-work"
      >
        <div className="kb-slot-missing-header">
          <span
            className="kb-slot-missing-icon"
            data-knowledge-type={reviewSlot.proposedKnowledgeType}
          >
            <ClipboardCheck aria-hidden="true" />
          </span>
          <div className="kb-slot-missing-title">
            <span>{formatReviewSlotRole(reviewSlot.role)}</span>
            <strong id={`review-slot-${reviewSlot.id}-work-title`}>
              Review proposed {proposedTypeLabel}
            </strong>
          </div>
        </div>

        <p className="kb-slot-missing-copy">{reviewSlot.bodyPreview}</p>

        {reviewSlot.referenceResolution ? (
          <p className="kb-review-slot-reference-resolution">
            {formatReviewSlotReferenceResolution(reviewSlot)}
          </p>
        ) : null}

        {reviewSlot.refresh ? (
          <p className="kb-review-slot-refresh-reason">
            {reviewSlot.refresh.reason}
          </p>
        ) : null}

        <footer className="kb-card-footer kb-slot-card-footer">
          {reviewSlot.status === "stale" && canRequestRefresh ? (
            <button
              className="kb-card-action kb-card-action-primary"
              disabled={isRequestingRefresh}
              onClick={() => void handleRequestRefresh()}
              type="button"
            >
              <RotateCcw aria-hidden="true" />
              <span>
                {isRequestingRefresh
                  ? "Refreshing"
                  : `Request ${reviewSlot.refresh?.originLabel ?? "Refresh"}`}
              </span>
            </button>
          ) : (
            <a
              className="kb-card-action kb-card-action-primary"
              href={reviewSlot.href}
              onClick={handleResumeClick}
            >
              <ClipboardCheck aria-hidden="true" />
              Review {proposedTypeLabel}
            </a>
          )}
          {canDismissRefresh ? (
            <button
              className="kb-card-action"
              disabled={isDismissingRefresh}
              onClick={() => void handleDismissRefresh()}
              type="button"
            >
              <X aria-hidden="true" />
              <span>{isDismissingRefresh ? "Dismissing" : "Dismiss"}</span>
            </button>
          ) : null}
          {canAssign ? (
            <form
              aria-label={`Assign ${reviewSlot.title}`}
              className="kb-review-slot-assign-form"
              onSubmit={(event) => void handleAssignSubmit(event)}
            >
              <label>
                <span>Reviewer user ID</span>
                <input
                  onChange={(event) =>
                    setAssignmentTargetUserId(event.currentTarget.value)
                  }
                  type="text"
                  value={assignmentTargetUserId}
                />
              </label>
              <button disabled={isAssigning || !assignmentTargetUserId.trim()} type="submit">
                <Send aria-hidden="true" />
                <span>{isAssigning ? "Sending" : "Send"}</span>
              </button>
            </form>
          ) : null}
        </footer>
      </section>

      <dl className="kb-card-meta kb-review-slot-meta">
        <div>
          <dt>
            <BookOpen aria-hidden="true" />
            Group
          </dt>
          <dd>
            <a
              href={reviewSlot.group.href}
              onClick={(event) => handleInlineNavigation(event, reviewSlot.group.href)}
            >
              {reviewSlot.group.title}
            </a>
          </dd>
        </div>
        <div>
          <dt>
            <UserCircle aria-hidden="true" />
            Review Scope
          </dt>
          <dd>{reviewSlot.reviewScopeLabel}</dd>
        </div>
        <div>
          <dt>
            <Send aria-hidden="true" />
            Assigned To
          </dt>
          <dd>{reviewSlot.assignment?.targetLabel ?? "Unassigned"}</dd>
        </div>
        <div>
          <dt>
            <Database aria-hidden="true" />
            Evidence
          </dt>
          <dd>{reviewSlot.evidenceSummary}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays aria-hidden="true" />
            Updated
          </dt>
          <dd>{formatCardDate(reviewSlot.updatedAt)}</dd>
        </div>
      </dl>

      <TagList
        emptyLabel="No proposed context Tags"
        labels={reviewSlot.contextPreviewTagLabels}
        onNavigateToHref={onNavigateToHref}
        tags={reviewSlot.contextPreviewTags}
        title={`${reviewSlot.title} proposed context Tags`}
      />
    </article>
  );

  function handleInlineNavigation(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (!onNavigateToHref) {
      return;
    }

    event.preventDefault();
    onNavigateToHref(href);
  }
}

function formatReviewSlotRole(role: SmartStorageReviewSlotSummary["role"]) {
  const labels = {
    cleanup: "Cleanup review",
    primary: "Primary review",
    prerequisite: "Prerequisite review",
    referenceResolution: "Reference resolution",
    refresh: "Refresh review",
    reprocessing: "Reprocessing review",
    secondary: "Secondary review",
  } satisfies Record<SmartStorageReviewSlotSummary["role"], string>;

  return labels[role];
}

function formatReviewSlotReferenceResolution(
  reviewSlot: SmartStorageReviewSlotSummary,
) {
  const resolution = reviewSlot.referenceResolution;
  if (!resolution) {
    return "";
  }

  if (resolution.mode === "knownReferentMatch") {
    const tag = resolution.resolvedTag ?? resolution.candidateTag ?? resolution.requiredTag;
    return `Known Referent match: ${tag.label}`;
  }

  return `New Entry creates Referent: ${formatKnowledgeTypeLabel(
    resolution.requiredTag.knowledgeType,
  )} - ${resolution.requiredTag.label}`;
}

function TagList({
  emptyLabel,
  labels,
  onNavigateToHref,
  tags,
  title,
}: {
  emptyLabel: string;
  labels: string[];
  onNavigateToHref?: (href: string) => void;
  tags?: ActiveTag[];
  title: string;
}) {
  const tagItems: TagListItem[] =
    tags && tags.length > 0
      ? mergeRichTagsWithLabels(tags, labels)
      : labels.map((label) => ({
          label,
        }));

  return (
    <div className="kb-card-tags" aria-label={title}>
      <Tag aria-hidden="true" />
      {tagItems.length > 0 ? (
        tagItems.map((tag) => (
          <ReferentTagLink
            className="kb-referent-tag-link"
            key={isRichTag(tag) ? tag.id : tag.label}
            label={tag.label}
            onNavigateToHref={onNavigateToHref}
            tag={isRichTag(tag) ? tag : undefined}
          />
        ))
      ) : (
        <span>{emptyLabel}</span>
      )}
    </div>
  );
}

type TagListItem = ActiveTag | { label: string };

function formatCardDate(timestamp: number) {
  return CARD_DATE_FORMATTER.format(new Date(timestamp));
}

function mergeRichTagsWithLabels(
  tags: ActiveTag[],
  labels: string[],
): TagListItem[] {
  const richLabels = new Set(tags.map((tag) => normalizeLabel(tag.label)));
  const labelOnlyTags = labels
    .filter((label) => !richLabels.has(normalizeLabel(label)))
    .map((label) => ({ label }));

  return [...tags, ...labelOnlyTags];
}

function isRichTag(tag: TagListItem): tag is ActiveTag {
  return "id" in tag && "href" in tag && "knowledgeType" in tag;
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}
