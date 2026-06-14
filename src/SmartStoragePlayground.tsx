import {
  ClipboardCheck,
  FileText,
  RotateCcw,
  Save,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { ContributionEditor } from "./ContributionEditor";
import { KnowledgeTypeBadge } from "./components/KnowledgeTypeIcon";
import { ReferentTagLink } from "./components/ReferentTagLink";
import {
  AUTHORABLE_KNOWLEDGE_TYPES,
  formatKnowledgeTypeLabel,
  type ActiveTag,
  type AuthorableKnowledgeType,
  type ContributionInput,
  type ContributionResult,
} from "./knowledgeContracts";
import {
  predictSmartStorageEntries,
  type SmartStoragePredictionEntry,
  type SmartStorageSourceKind,
} from "./smartStorageClassifier";

type FeedbackRating = "accurate" | "close" | "wrong";

type FeedbackStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

const FEEDBACK_RATINGS: Array<{
  id: FeedbackRating;
  label: string;
}> = [
  { id: "accurate", label: "Accurate" },
  { id: "close", label: "Close" },
  { id: "wrong", label: "Wrong" },
];

export function SmartStoragePlayground({
  onNavigateToHref,
  routeMeta,
}: {
  onNavigateToHref?: (href: string) => void;
  routeMeta?: ReactNode;
}) {
  const [sourceText, setSourceText] = useState("");
  const [sourceName, setSourceName] = useState<string | undefined>();
  const [sourceKind, setSourceKind] =
    useState<SmartStorageSourceKind>("pastedText");
  const [editorRevision, setEditorRevision] = useState(0);
  const [selectedKnowledgeType, setSelectedKnowledgeType] =
    useState<AuthorableKnowledgeType | null>(null);
  const [submittedContribution, setSubmittedContribution] =
    useState<ContributionInput | null>(null);
  const [feedbackRating, setFeedbackRating] =
    useState<FeedbackRating | null>(null);
  const [intendedKnowledgeType, setIntendedKnowledgeType] =
    useState<AuthorableKnowledgeType>("words");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>({
    kind: "idle",
  });
  const recordFeedback = useMutation(api.smartStoragePlayground.recordFeedback);

  const prediction = useMemo(
    () =>
      predictSmartStorageEntries({
        fileName: sourceName,
        sourceKind,
        text: sourceText,
      }),
    [sourceKind, sourceName, sourceText],
  );
  const primaryEntry = prediction.primaryEntry;
  const editorTitle = primaryEntry?.title ?? "";
  const editorBody = sourceText.trim();

  useEffect(() => {
    if (primaryEntry && !selectedKnowledgeType && !submittedContribution) {
      setIntendedKnowledgeType(primaryEntry.knowledgeType);
    }
  }, [primaryEntry?.knowledgeType, selectedKnowledgeType, submittedContribution]);

  function resetForNewSource() {
    setSelectedKnowledgeType(null);
    setSubmittedContribution(null);
    setFeedbackRating(null);
    setFeedbackNote("");
    setFeedbackStatus({ kind: "idle" });
    setEditorRevision((currentRevision) => currentRevision + 1);
  }

  function handleSourceTextChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setSourceText(event.currentTarget.value);
    setSourceName(undefined);
    setSourceKind("pastedText");
    resetForNewSource();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setSourceText(text);
    setSourceName(file.name);
    setSourceKind("uploadedFile");
    resetForNewSource();
    event.currentTarget.value = "";
  }

  function handleClearSource() {
    setSourceText("");
    setSourceName(undefined);
    setSourceKind("pastedText");
    setIntendedKnowledgeType("words");
    resetForNewSource();
  }

  function handleKnowledgeTypeChange(nextType: AuthorableKnowledgeType) {
    setSelectedKnowledgeType(nextType);
    setIntendedKnowledgeType(nextType);
  }

  function handleSubmitSource(input: ContributionInput): ContributionResult {
    setSubmittedContribution(input);
    setIntendedKnowledgeType(input.knowledgeType);
    setFeedbackStatus({ kind: "idle" });
    return {
      entryId: `playground-${Date.now()}`,
      status: "submitted",
    };
  }

  async function handleSaveFeedback() {
    if (!primaryEntry || !feedbackRating) {
      return;
    }

    setFeedbackStatus({ kind: "saving" });
    try {
      await recordFeedback({
        feedbackRating,
        intendedKnowledgeType,
        predictedEntries: prediction.entries.map(toFeedbackPrediction),
        sourceKind,
        sourceSizeBytes: getTextSizeBytes(sourceText),
        sourceText,
        ...(sourceName === undefined ? {} : { sourceName }),
        ...(feedbackNote.trim() === "" ? {} : { feedbackNote: feedbackNote.trim() }),
        ...(submittedContribution === null
          ? {}
          : {
              submittedEntry: {
                bodyPreview: submittedContribution.body.trim().slice(0, 500),
                knowledgeType: submittedContribution.knowledgeType,
                title: submittedContribution.title,
              },
            }),
      });
      setFeedbackStatus({ kind: "saved" });
    } catch (error) {
      setFeedbackStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Feedback could not be saved",
      });
    }
  }

  return (
    <main
      className="kb-main kb-smart-playground-main"
      aria-labelledby="kb-smart-playground-heading"
    >
      <header className="kb-route-header">
        <div>
          <p className="kb-eyebrow">Smart Storage Playground</p>
          <h1 id="kb-smart-playground-heading">Contribution Editor Lab</h1>
        </div>
        {routeMeta}
      </header>

      <section className="kb-smart-playground-grid">
        <section className="kb-smart-source-panel" aria-labelledby="kb-smart-source-heading">
          <header>
            <div>
              <p className="kb-eyebrow">Bronze Source</p>
              <h2 id="kb-smart-source-heading">Source</h2>
            </div>
            <button
              aria-label="Clear source"
              className="kb-smart-icon-button"
              onClick={handleClearSource}
              title="Clear source"
              type="button"
            >
              <RotateCcw aria-hidden="true" />
            </button>
          </header>

          <label className="kb-smart-file-picker">
            <UploadCloud aria-hidden="true" />
            <span>{sourceName ?? "Upload source"}</span>
            <input onChange={handleFileChange} type="file" />
          </label>

          <label className="kb-smart-source-field">
            <span>Raw Input</span>
            <textarea
              aria-label="Raw input"
              onChange={handleSourceTextChange}
              placeholder="Paste or type a source..."
              rows={12}
              value={sourceText}
            />
          </label>

          <dl className="kb-smart-source-stats" aria-label="Source stats">
            <div>
              <dt>Kind</dt>
              <dd>{formatSourceKind(sourceKind)}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(getTextSizeBytes(sourceText))}</dd>
            </div>
            <div>
              <dt>Summary</dt>
              <dd>{prediction.sourceSummary}</dd>
            </div>
          </dl>
        </section>

        <section
          className="kb-smart-prediction-panel"
          aria-labelledby="kb-smart-prediction-heading"
        >
          <header>
            <div>
              <p className="kb-eyebrow">Gold Guess</p>
              <h2 id="kb-smart-prediction-heading">Predicted Knowledge Entries</h2>
            </div>
            <Sparkles aria-hidden="true" />
          </header>

          {prediction.entries.length > 0 ? (
            <ol className="kb-smart-prediction-list">
              {prediction.entries.map((entry, index) => (
                <PredictionItem
                  entry={entry}
                  isPrimary={index === 0}
                  key={entry.id}
                />
              ))}
            </ol>
          ) : (
            <p className="kb-smart-empty">No source staged.</p>
          )}

          {prediction.detectedContextTags.length > 0 ? (
            <SmartStorageContextHints
              onNavigateToHref={onNavigateToHref}
              tags={prediction.detectedContextTags}
            />
          ) : null}
        </section>
      </section>

      <section className="kb-smart-editor-grid">
        <div className="kb-smart-editor-panel">
          <ContributionEditor
            context={prediction.detectedContextTags}
            initialBody={editorBody}
            initialTitle={editorTitle}
            key={`${editorRevision}:${primaryEntry?.id ?? "empty"}`}
            onKnowledgeTypeChange={handleKnowledgeTypeChange}
            onNavigateToHref={onNavigateToHref}
            onSubmitSource={handleSubmitSource}
            selectedKnowledgeType={selectedKnowledgeType}
            smartStorageProposedKnowledgeType={primaryEntry?.knowledgeType}
          />
        </div>

        <section className="kb-smart-feedback-panel" aria-labelledby="kb-smart-feedback-heading">
          <header>
            <div>
              <p className="kb-eyebrow">Training Feedback</p>
              <h2 id="kb-smart-feedback-heading">Feedback</h2>
            </div>
            <ClipboardCheck aria-hidden="true" />
          </header>

          <div className="kb-smart-feedback-ratings" role="group" aria-label="Prediction accuracy">
            {FEEDBACK_RATINGS.map((rating) => (
              <button
                aria-pressed={feedbackRating === rating.id}
                key={rating.id}
                onClick={() => setFeedbackRating(rating.id)}
                type="button"
              >
                {rating.label}
              </button>
            ))}
          </div>

          <label className="kb-smart-feedback-field">
            <span>Intended Type</span>
            <select
              onChange={(event) =>
                setIntendedKnowledgeType(event.currentTarget.value as AuthorableKnowledgeType)
              }
              value={intendedKnowledgeType}
            >
              {AUTHORABLE_KNOWLEDGE_TYPES.map((knowledgeType) => (
                <option key={knowledgeType} value={knowledgeType}>
                  {formatKnowledgeTypeLabel(knowledgeType)}
                </option>
              ))}
            </select>
          </label>

          <label className="kb-smart-feedback-field">
            <span>Notes</span>
            <textarea
              onChange={(event) => setFeedbackNote(event.currentTarget.value)}
              rows={5}
              value={feedbackNote}
            />
          </label>

          {submittedContribution ? (
            <p className="kb-smart-captured-entry" role="status">
              <FileText aria-hidden="true" />
              <span>
                Captured {formatKnowledgeTypeLabel(submittedContribution.knowledgeType)}
              </span>
            </p>
          ) : null}

          <button
            className="kb-smart-feedback-submit"
            disabled={!primaryEntry || !feedbackRating || feedbackStatus.kind === "saving"}
            onClick={handleSaveFeedback}
            type="button"
          >
            <Save aria-hidden="true" />
            <span>{feedbackStatus.kind === "saving" ? "Saving" : "Save Feedback"}</span>
          </button>

          {feedbackStatus.kind === "saved" ? (
            <p className="kb-smart-feedback-status" role="status">
              Feedback saved
            </p>
          ) : null}
          {feedbackStatus.kind === "error" ? (
            <p className="kb-smart-feedback-status" role="alert">
              {feedbackStatus.message}
            </p>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function SmartStorageContextHints({
  onNavigateToHref,
  tags,
}: {
  onNavigateToHref?: (href: string) => void;
  tags: ActiveTag[];
}) {
  return (
    <div className="kb-smart-context-hints">
      <span>Context Hints</span>
      <ul>
        {tags.map((tag) => (
          <li key={tag.id}>
            <ReferentTagLink
              onNavigateToHref={onNavigateToHref}
              showIcon
              tag={tag}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PredictionItem({
  entry,
  isPrimary,
}: {
  entry: SmartStoragePredictionEntry;
  isPrimary: boolean;
}) {
  return (
    <li data-primary={isPrimary ? "true" : undefined}>
      <div className="kb-smart-prediction-title">
        <KnowledgeTypeBadge knowledgeType={entry.knowledgeType} />
        {isPrimary ? <span>Primary</span> : null}
      </div>
      <h3>{entry.title}</h3>
      <p>{entry.reason}</p>
      <blockquote>{entry.sourceExcerpt}</blockquote>
      <div className="kb-smart-confidence">
        <span>{Math.round(entry.confidence * 100)}%</span>
        <meter max={1} min={0} value={entry.confidence}>
          {Math.round(entry.confidence * 100)}%
        </meter>
      </div>
    </li>
  );
}

function toFeedbackPrediction(entry: SmartStoragePredictionEntry) {
  return {
    confidence: entry.confidence,
    knowledgeType: entry.knowledgeType,
    reason: entry.reason,
    sourceExcerpt: entry.sourceExcerpt,
    title: entry.title,
  };
}

function formatSourceKind(sourceKind: SmartStorageSourceKind) {
  if (sourceKind === "uploadedFile") {
    return "Uploaded File";
  }

  if (sourceKind === "externalUrl") {
    return "External URL";
  }

  if (sourceKind === "manualEntry") {
    return "Manual Entry";
  }

  return "Pasted Text";
}

function getTextSizeBytes(text: string) {
  return new Blob([text]).size;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}
