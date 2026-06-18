import {
  CheckCircle2,
  FileText,
  Link,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  GENERIC_CONTRIBUTION_KNOWLEDGE_TYPES,
  formatKnowledgeTypeLabel,
  isAuthorableKnowledgeType,
  type ActiveTag,
  type AuthorableKnowledgeType,
  type ContributionInput,
  type ContributionMode,
  type ContributionPreview,
  type ContributionResult,
  type GuidedContributionType,
  type KnowledgeSlotSummary,
  type KnowledgeType,
  type SmartStorageExternalUrlInput,
  type SmartStorageUploadedFileInput,
} from "./knowledgeContracts";
import { KnowledgeTypeIcon } from "./components/KnowledgeTypeIcon";
import { ReferentTagLink } from "./components/ReferentTagLink";
import { Presence } from "./Presence";

export type ContributionKnowledgeTypeSources = {
  selectedKnowledgeType?: KnowledgeType | null;
  slot?: KnowledgeSlotSummary;
  smartStorageProposedKnowledgeType?: KnowledgeType | null;
};

type ContributionSubmitHandler = (
  input: ContributionInput,
) => Promise<ContributionResult> | ContributionResult;
type ContributionFileUploadHandler = (
  file: File,
) => Promise<SmartStorageUploadedFileInput>;

export type ContributionEditorProps = ContributionKnowledgeTypeSources & {
  context: ActiveTag[];
  defaultMode?: ContributionMode;
  guidedContributionType?: GuidedContributionType | null;
  initialBody?: string;
  initialTitle?: string;
  onKnowledgeTypeChange?: (nextType: AuthorableKnowledgeType) => void;
  onNavigateToHref?: (href: string) => void;
  onUploadFile?: ContributionFileUploadHandler;
  onPostDirect?: ContributionSubmitHandler;
  onStoreSmartly?: ContributionSubmitHandler;
  onSubmitSource?: ContributionSubmitHandler;
  parentEntryTitle?: string;
};

type SubmissionState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "submitted"; entryId?: string; mode: ContributionMode };

type ContributionFieldConfig = {
  bodyLabel: string;
  bodyPlaceholder: string;
  bodyPreviewLabel: string;
  bodyRequired: boolean;
  showsBodyField: boolean;
  showsTitleField: boolean;
  titleLabel?: string;
  titlePlaceholder?: string;
  titlePreviewLabel?: string;
};

type ContributionPrimaryField = "body" | "title";
type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string };

export function ContributionEditor({
  context,
  defaultMode,
  guidedContributionType,
  initialBody = "",
  initialTitle = "",
  onKnowledgeTypeChange,
  onNavigateToHref,
  onUploadFile,
  onPostDirect,
  onStoreSmartly,
  onSubmitSource,
  parentEntryTitle,
  selectedKnowledgeType,
  slot,
}: ContributionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(Boolean(slot));
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [contributionNote, setContributionNote] = useState("");
  const [externalUrlDraft, setExternalUrlDraft] = useState("");
  const [externalUrls, setExternalUrls] = useState<SmartStorageExternalUrlInput[]>(
    [],
  );
  const [uploadedFiles, setUploadedFiles] = useState<
    SmartStorageUploadedFileInput[]
  >([]);
  const [uploadState, setUploadState] = useState<UploadState>({
    kind: "idle",
  });
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    kind: "idle",
  });
  const activeKnowledgeType = resolveContributionKnowledgeType({
    selectedKnowledgeType,
    slot,
  });
  const activeGuidedContributionType = resolveGuidedContributionType(
    activeKnowledgeType,
    guidedContributionType,
  );
  const supportsSmartStorageSources = activeGuidedContributionType === null;
  const hasSupplementalSources =
    supportsSmartStorageSources &&
    (contributionNote.trim().length > 0 ||
      externalUrls.length > 0 ||
      uploadedFiles.length > 0);
  const contributionPreview = createContributionPreview({
    body,
    context,
    defaultMode,
    guidedContributionType: activeGuidedContributionType,
    hasSupplementalSources,
    knowledgeType: activeKnowledgeType,
    parentEntryTitle,
    slot,
    title,
  });
  const isSlotTypeFixed = Boolean(slot);
  const activeKnowledgeTypeLabel = formatKnowledgeTypeLabel(activeKnowledgeType);
  const fieldConfig = getContributionFieldConfig(
    activeKnowledgeType,
    activeGuidedContributionType,
  );
  const knowledgeTypeOptions = getContributionKnowledgeTypeOptions(
    activeKnowledgeType,
    isSlotTypeFixed,
  );
  const secondaryMode = getAlternateContributionMode(contributionPreview.mode);
  const showsSecondarySubmit =
    activeGuidedContributionType === null && !hasSupplementalSources;
  const secondarySubmitLabel = getContributionSubmitLabel(
    secondaryMode,
    activeKnowledgeType,
    activeGuidedContributionType,
  );
  const primaryField = getContributionPrimaryField(
    fieldConfig,
    activeKnowledgeType,
    activeGuidedContributionType,
  );

  useEffect(() => {
    if (slot) {
      setIsExpanded(true);
    }
  }, [slot]);

  function handleEditorFocus() {
    setIsExpanded(true);
  }

  function handleCollapseEditor() {
    setIsExpanded(false);
  }

  function handleKnowledgeTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextType = event.currentTarget.value;
    if (!isSlotTypeFixed && isAuthorableKnowledgeType(nextType)) {
      onKnowledgeTypeChange?.(nextType);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitContribution(contributionPreview.mode);
  }

  async function submitContribution(mode: ContributionMode) {
    const input = createContributionInput({
      body,
      contributionNote,
      context,
      externalUrls,
      guidedContributionType: activeGuidedContributionType,
      knowledgeType: activeKnowledgeType,
      parentEntryTitle,
      slot,
      title,
      uploadedFiles,
    });

    setSubmissionState({ kind: "submitting" });
    const result = await submitContributionInput(input, mode, {
      onPostDirect,
      onStoreSmartly,
      onSubmitSource,
    });
    setSubmissionState({ kind: "submitted", entryId: result.entryId, mode });
    setBody("");
    setTitle("");
    setContributionNote("");
    setExternalUrls([]);
    setUploadedFiles([]);
  }

  function handleAddExternalUrl() {
    const url = externalUrlDraft.trim();
    if (!url) {
      return;
    }
    setExternalUrls((current) => [...current, { url }]);
    setExternalUrlDraft("");
  }

  function handleRemoveExternalUrl(index: number) {
    setExternalUrls((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function handleRemoveUploadedFile(index: number) {
    setUploadedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length === 0) {
      return;
    }
    if (!onUploadFile) {
      setUploadState({
        kind: "error",
        message: "File upload is unavailable.",
      });
      return;
    }

    setUploadState({ kind: "uploading" });
    try {
      const uploaded: SmartStorageUploadedFileInput[] = [];
      for (const file of files) {
        uploaded.push(await onUploadFile(file));
      }
      setUploadedFiles((current) => [...current, ...uploaded]);
      setUploadState({ kind: "idle" });
    } catch {
      setUploadState({
        kind: "error",
        message: "File upload failed.",
      });
    }
  }

  const typeField = (
    <label className="kb-contribution-field kb-contribution-type-field">
      <span>Knowledge Type</span>
      <select
        disabled={isSlotTypeFixed}
        onChange={handleKnowledgeTypeChange}
        value={activeKnowledgeType}
      >
        {knowledgeTypeOptions.map((knowledgeType) => (
          <option key={knowledgeType} value={knowledgeType}>
            {formatKnowledgeTypeLabel(knowledgeType)}
          </option>
        ))}
      </select>
    </label>
  );
  const titleField = fieldConfig.showsTitleField ? (
    <label
      className={getContributionFieldClassName(
        "title",
        primaryField === "title",
      )}
    >
      <span>{fieldConfig.titleLabel}</span>
      <input
        onChange={(event) => setTitle(event.currentTarget.value)}
        placeholder={fieldConfig.titlePlaceholder}
        required
        type="text"
        value={title}
      />
    </label>
  ) : null;
  const bodyField = fieldConfig.showsBodyField ? (
    <label
      className={getContributionFieldClassName(
        "body",
        primaryField === "body",
      )}
    >
      <span>{fieldConfig.bodyLabel}</span>
      <textarea
        onChange={(event) => setBody(event.currentTarget.value)}
        placeholder={fieldConfig.bodyPlaceholder}
        required={fieldConfig.bodyRequired}
        rows={5}
        value={body}
      />
    </label>
  ) : null;
  const sourceTools =
    supportsSmartStorageSources ? (
      <ContributionSourceTools
        body={body}
        contributionNote={contributionNote}
        externalUrlDraft={externalUrlDraft}
        externalUrls={externalUrls}
        onAddExternalUrl={handleAddExternalUrl}
        onContributionNoteChange={setContributionNote}
        onExternalUrlDraftChange={setExternalUrlDraft}
        onFileInputChange={(event) => void handleFileInputChange(event)}
        onRemoveExternalUrl={handleRemoveExternalUrl}
        onRemoveUploadedFile={handleRemoveUploadedFile}
        uploadedFiles={uploadedFiles}
        uploadState={uploadState}
      />
    ) : null;

  return (
    <section
      className="kb-contribution-editor"
      aria-labelledby="kb-contribution-heading"
      data-expanded={isExpanded ? "true" : "false"}
      data-guided-type={activeGuidedContributionType ?? undefined}
      onFocusCapture={handleEditorFocus}
    >
      <header className="kb-contribution-header">
        <div>
          <p className="kb-eyebrow">Contribution Editor</p>
          <h2 id="kb-contribution-heading">
            {slot ? slot.title : "Contribute in this Knowledge Context"}
          </h2>
        </div>
        {isSlotTypeFixed ? (
          <span className="kb-contribution-fixed-type">
            <LockKeyhole aria-hidden="true" className="kb-contribution-lock-icon" />
            <KnowledgeTypeIcon knowledgeType={activeKnowledgeType} />
            <span>{activeKnowledgeTypeLabel}</span>
          </span>
        ) : null}
      </header>

      <ContributionContextTags
        context={context}
        onNavigateToHref={onNavigateToHref}
      />

      <form className="kb-contribution-form" onSubmit={handleSubmit}>
        {primaryField === "title" ? (
          <>
            {titleField}
            {bodyField}
          </>
        ) : (
          <>
            {bodyField}
            {titleField}
          </>
        )}
        {typeField}
        {sourceTools}

        <button
          className="kb-contribution-submit"
          disabled={submissionState.kind === "submitting"}
          type="submit"
        >
          {submissionState.kind === "submitting" ? (
            <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          ) : contributionPreview.mode === "smartStorage" ? (
            <Sparkles aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
          <span>{contributionPreview.submitLabel}</span>
        </button>

        {showsSecondarySubmit ? (
          <button
            className="kb-contribution-secondary-submit"
            disabled={submissionState.kind === "submitting"}
            onClick={() => void submitContribution(secondaryMode)}
            type="button"
          >
            {secondaryMode === "smartStorage" ? (
              <Sparkles aria-hidden="true" />
            ) : (
              <Send aria-hidden="true" />
            )}
            <span>{secondarySubmitLabel}</span>
          </button>
        ) : null}

        {isExpanded ? (
          <button
            aria-label="Collapse contribution editor"
            className="kb-contribution-collapse-button"
            onClick={handleCollapseEditor}
            title="Collapse contribution editor"
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        ) : null}
      </form>

      <ContributionPreviewPanel preview={contributionPreview} />

      <Presence present={submissionState.kind === "submitted"}>
        {(presenceState) => (
          <p
            className="kb-contribution-status"
            data-presence={presenceState}
            role="status"
          >
            <CheckCircle2 aria-hidden="true" />
            {submissionState.kind === "submitted" &&
            submissionState.mode === "smartStorage"
              ? "Stored Smartly"
              : "Submitted"}
          </p>
        )}
      </Presence>
    </section>
  );
}

function getContributionPrimaryField(
  fieldConfig: ContributionFieldConfig,
  knowledgeType: AuthorableKnowledgeType,
  guidedContributionType: GuidedContributionType | null,
): ContributionPrimaryField {
  if (
    fieldConfig.showsTitleField &&
    (knowledgeType === "question" || guidedContributionType === "group")
  ) {
    return "title";
  }

  if (fieldConfig.showsBodyField) {
    return "body";
  }

  return "title";
}

function getContributionFieldClassName(
  field: ContributionPrimaryField,
  isPrimary: boolean,
) {
  return [
    "kb-contribution-field",
    `kb-contribution-${field}-field`,
    isPrimary ? "kb-contribution-primary-field" : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function ContributionSourceTools({
  body,
  contributionNote,
  externalUrlDraft,
  externalUrls,
  onAddExternalUrl,
  onContributionNoteChange,
  onExternalUrlDraftChange,
  onFileInputChange,
  onRemoveExternalUrl,
  onRemoveUploadedFile,
  uploadedFiles,
  uploadState,
}: {
  body: string;
  contributionNote: string;
  externalUrlDraft: string;
  externalUrls: SmartStorageExternalUrlInput[];
  onAddExternalUrl: () => void;
  onContributionNoteChange: (nextNote: string) => void;
  onExternalUrlDraftChange: (nextUrl: string) => void;
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveExternalUrl: (index: number) => void;
  onRemoveUploadedFile: (index: number) => void;
  uploadedFiles: SmartStorageUploadedFileInput[];
  uploadState: UploadState;
}) {
  const authoredTextPreview = body.trim();
  const hasInventory =
    authoredTextPreview.length > 0 ||
    externalUrls.length > 0 ||
    uploadedFiles.length > 0;

  return (
    <section
      aria-label="Smart Storage Source inventory"
      className="kb-contribution-source-tools"
    >
      <label className="kb-contribution-field kb-contribution-note-field">
        <span>Contribution Note</span>
        <textarea
          onChange={(event) =>
            onContributionNoteChange(event.currentTarget.value)
          }
          placeholder="Guidance for Smart Storage..."
          rows={3}
          value={contributionNote}
        />
      </label>

      <div className="kb-contribution-source-add-row">
        <label className="kb-contribution-field kb-contribution-url-field">
          <span>External URL</span>
          <input
            onChange={(event) =>
              onExternalUrlDraftChange(event.currentTarget.value)
            }
            placeholder="https://example.com/source"
            type="url"
            value={externalUrlDraft}
          />
        </label>
        <button
          aria-label="Add external URL Source"
          className="kb-contribution-source-icon-button"
          disabled={externalUrlDraft.trim().length === 0}
          onClick={onAddExternalUrl}
          title="Add external URL Source"
          type="button"
        >
          <Plus aria-hidden="true" />
        </button>
      </div>

      <label className="kb-contribution-file-picker">
        <UploadCloud aria-hidden="true" />
        <span>
          {uploadState.kind === "uploading" ? "Uploading..." : "Upload File"}
        </span>
        <input
          aria-label="Upload file Source"
          disabled={uploadState.kind === "uploading"}
          multiple
          onChange={onFileInputChange}
          type="file"
        />
      </label>

      {uploadState.kind === "error" ? (
        <p className="kb-contribution-source-error" role="alert">
          {uploadState.message}
        </p>
      ) : null}

      <div className="kb-contribution-source-inventory">
        <header>
          <FileText aria-hidden="true" />
          <span>Source Inventory</span>
        </header>
        {hasInventory ? (
          <ul>
            {authoredTextPreview ? (
              <li>
                <FileText aria-hidden="true" />
                <span>
                  <strong>Authored Text</strong>
                  <small>
                    {limitContributionPreviewText(authoredTextPreview)}
                  </small>
                </span>
              </li>
            ) : null}
            {externalUrls.map((externalUrl, index) => (
              <li key={`${externalUrl.url}-${index}`}>
                <Link aria-hidden="true" />
                <span>
                  <strong>{externalUrl.title ?? "External URL"}</strong>
                  <small>{externalUrl.url}</small>
                </span>
                <button
                  aria-label={`Remove external URL Source ${index + 1}`}
                  className="kb-contribution-source-remove"
                  onClick={() => onRemoveExternalUrl(index)}
                  title="Remove external URL Source"
                  type="button"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
            {uploadedFiles.map((uploadedFile, index) => (
              <li key={`${uploadedFile.storageId}-${index}`}>
                <UploadCloud aria-hidden="true" />
                <span>
                  <strong>{uploadedFile.title ?? uploadedFile.fileName}</strong>
                  <small>{formatUploadedFileMeta(uploadedFile)}</small>
                </span>
                <button
                  aria-label={`Remove uploaded file Source ${index + 1}`}
                  className="kb-contribution-source-remove"
                  onClick={() => onRemoveUploadedFile(index)}
                  title="Remove uploaded file Source"
                  type="button"
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No Sources staged.</p>
        )}
      </div>
    </section>
  );
}

function formatUploadedFileMeta(uploadedFile: SmartStorageUploadedFileInput) {
  const parts = [
    uploadedFile.contentType,
    uploadedFile.fileSizeBytes === undefined
      ? undefined
      : formatFileSize(uploadedFile.fileSizeBytes),
  ].filter(Boolean);

  return parts.join(" / ") || "Uploaded file";
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function resolveContributionKnowledgeType({
  selectedKnowledgeType,
  slot,
}: ContributionKnowledgeTypeSources): AuthorableKnowledgeType {
  if (slot) {
    return slot.requestedKnowledgeType;
  }

  if (isAuthorableKnowledgeType(selectedKnowledgeType)) {
    return selectedKnowledgeType;
  }

  return "words";
}

export function resolveContributionMode({
  context,
  defaultMode,
  guidedContributionType,
  hasSupplementalSources = false,
  slot,
}: {
  context: ActiveTag[];
  defaultMode?: ContributionMode;
  guidedContributionType?: GuidedContributionType | null;
  hasSupplementalSources?: boolean;
  slot?: KnowledgeSlotSummary;
}): ContributionMode {
  if (guidedContributionType) {
    return "direct";
  }

  if (hasSupplementalSources) {
    return "smartStorage";
  }

  if (defaultMode) {
    return defaultMode;
  }

  if (slot) {
    return "direct";
  }

  return context.length === 0 ? "smartStorage" : "direct";
}

export function createContributionPreview({
  body,
  context,
  defaultMode,
  guidedContributionType,
  hasSupplementalSources = false,
  knowledgeType,
  parentEntryTitle: _parentEntryTitle,
  slot,
  title = "",
}: {
  body: string;
  context: ActiveTag[];
  defaultMode?: ContributionMode;
  guidedContributionType?: GuidedContributionType | null;
  hasSupplementalSources?: boolean;
  knowledgeType: AuthorableKnowledgeType;
  parentEntryTitle?: string;
  slot?: KnowledgeSlotSummary;
  title?: string;
}): ContributionPreview {
  const activeGuidedContributionType = resolveGuidedContributionType(
    knowledgeType,
    guidedContributionType,
  );
  const mode = resolveContributionMode({
    context,
    defaultMode,
    guidedContributionType: activeGuidedContributionType,
    hasSupplementalSources,
    slot,
  });
  const fieldConfig = getContributionFieldConfig(
    knowledgeType,
    activeGuidedContributionType,
  );
  const attributes = [
    {
      label: "Knowledge Type",
      value: formatKnowledgeTypeLabel(knowledgeType),
    },
    {
      label: "Knowledge Context",
      value: formatContributionContextPreview(context),
    },
  ];
  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();

  if (trimmedTitle && fieldConfig.titlePreviewLabel) {
    attributes.push({
      label: fieldConfig.titlePreviewLabel,
      value: trimmedTitle,
    });
  }

  if (trimmedBody && fieldConfig.showsBodyField) {
    attributes.push({
      label: fieldConfig.bodyPreviewLabel,
      value: limitContributionPreviewText(trimmedBody),
    });
  }

  return {
    attributes,
    context,
    knowledgeType,
    mode,
    submitLabel: getContributionSubmitLabel(
      mode,
      knowledgeType,
      activeGuidedContributionType,
    ),
  };
}

export function createContributionInput({
  body,
  contributionNote,
  context,
  externalUrls = [],
  guidedContributionType,
  knowledgeType,
  parentEntryTitle,
  slot,
  title = "",
  uploadedFiles = [],
}: {
  body: string;
  contributionNote?: string;
  context: ActiveTag[];
  externalUrls?: SmartStorageExternalUrlInput[];
  guidedContributionType?: GuidedContributionType | null;
  knowledgeType: AuthorableKnowledgeType;
  parentEntryTitle?: string;
  slot?: KnowledgeSlotSummary;
  title?: string;
  uploadedFiles?: SmartStorageUploadedFileInput[];
}): ContributionInput {
  const activeGuidedContributionType = resolveGuidedContributionType(
    knowledgeType,
    guidedContributionType,
  );
  const fieldConfig = getContributionFieldConfig(
    knowledgeType,
    activeGuidedContributionType,
  );

  const trimmedContributionNote = contributionNote?.trim();

  return {
    body: fieldConfig.showsBodyField ? body : "",
    ...(trimmedContributionNote
      ? { contributionNote: trimmedContributionNote }
      : {}),
    contextTags: context,
    ...(externalUrls.length > 0 ? { externalUrls } : {}),
    knowledgeType,
    slotId: slot?.id,
    title: createContributionInputTitle({
      knowledgeType,
      parentEntryTitle,
      title,
    }),
    ...(uploadedFiles.length > 0 ? { uploadedFiles } : {}),
  };
}

function createContributionInputTitle({
  knowledgeType,
  parentEntryTitle,
  title,
}: {
  knowledgeType: AuthorableKnowledgeType;
  parentEntryTitle?: string;
  title: string;
}) {
  if (knowledgeType === "comment") {
    return createCommentTitle(parentEntryTitle);
  }

  return title.trim();
}

function createCommentTitle(parentEntryTitle?: string) {
  const trimmedParentTitle = parentEntryTitle?.trim();
  return trimmedParentTitle ? `Comment on ${trimmedParentTitle}` : "Comment";
}

function getContributionFieldConfig(
  knowledgeType: AuthorableKnowledgeType,
  guidedContributionType: GuidedContributionType | null = null,
): ContributionFieldConfig {
  if (knowledgeType === "group" && guidedContributionType === "group") {
    return {
      bodyLabel: "Source",
      bodyPlaceholder: "",
      bodyPreviewLabel: "Preview",
      bodyRequired: false,
      showsBodyField: false,
      showsTitleField: true,
      titleLabel: "What is the group called?",
      titlePlaceholder: "Basketball Club",
      titlePreviewLabel: "Group",
    };
  }

  if (knowledgeType === "comment") {
    return {
      bodyLabel: "Comment",
      bodyPlaceholder: "Write a comment...",
      bodyPreviewLabel: "Preview",
      bodyRequired: true,
      showsBodyField: true,
      showsTitleField: false,
    };
  }

  if (knowledgeType === "question") {
    return {
      bodyLabel: "Details",
      bodyPlaceholder: "Add optional details about this question...",
      bodyPreviewLabel: "Details",
      bodyRequired: false,
      showsBodyField: true,
      showsTitleField: true,
      titleLabel: "Question",
      titlePlaceholder: "Ask a question...",
      titlePreviewLabel: "Question",
    };
  }

  const knowledgeTypeLabel = formatKnowledgeTypeLabel(knowledgeType);

  return {
    bodyLabel: "Source",
    bodyPlaceholder: "Contribute an answer in this context...",
    bodyPreviewLabel: "Preview",
    bodyRequired: true,
    showsBodyField: true,
    showsTitleField: true,
    titleLabel: "Title",
    titlePlaceholder: `${knowledgeTypeLabel} title`,
    titlePreviewLabel: "Title",
  };
}

function submitContributionInput(
  input: ContributionInput,
  mode: ContributionMode,
  {
    onPostDirect,
    onStoreSmartly,
    onSubmitSource,
  }: {
    onPostDirect?: ContributionSubmitHandler;
    onStoreSmartly?: ContributionSubmitHandler;
    onSubmitSource?: ContributionSubmitHandler;
  },
) {
  const submitHandler =
    mode === "smartStorage"
      ? (onStoreSmartly ?? onSubmitSource)
      : (onPostDirect ?? onSubmitSource);

  return submitHandler?.(input) ?? { status: "submitted" as const };
}

function getContributionKnowledgeTypeOptions(
  activeKnowledgeType: AuthorableKnowledgeType,
  isSlotTypeFixed: boolean,
) {
  if (
    isSlotTypeFixed &&
    !GENERIC_CONTRIBUTION_KNOWLEDGE_TYPES.some(
      (knowledgeType) => knowledgeType === activeKnowledgeType,
    )
  ) {
    return [activeKnowledgeType, ...GENERIC_CONTRIBUTION_KNOWLEDGE_TYPES];
  }

  return GENERIC_CONTRIBUTION_KNOWLEDGE_TYPES;
}

function getAlternateContributionMode(mode: ContributionMode): ContributionMode {
  return mode === "direct" ? "smartStorage" : "direct";
}

function getContributionSubmitLabel(
  mode: ContributionMode,
  knowledgeType: AuthorableKnowledgeType,
  guidedContributionType: GuidedContributionType | null = null,
) {
  if (mode === "smartStorage") {
    return "Store Smartly";
  }

  if (knowledgeType === "group" && guidedContributionType === "group") {
    return "Create Group";
  }

  return `Post ${formatKnowledgeTypeLabel(knowledgeType)}`;
}

function resolveGuidedContributionType(
  knowledgeType: AuthorableKnowledgeType,
  guidedContributionType?: GuidedContributionType | null,
): GuidedContributionType | null {
  if (knowledgeType === "group" && guidedContributionType === "group") {
    return "group";
  }

  return null;
}

function formatContributionContextPreview(context: ActiveTag[]) {
  if (context.length === 0) {
    return "Global Knowledge Context";
  }

  return context.map((tag) => tag.label).join(", ");
}

function limitContributionPreviewText(text: string) {
  if (text.length <= 140) {
    return text;
  }

  return `${text.slice(0, 137).trimEnd()}...`;
}

function ContributionPreviewPanel({ preview }: { preview: ContributionPreview }) {
  return (
    <section
      className="kb-contribution-preview"
      aria-label="Contribution Preview"
      data-mode={preview.mode}
    >
      <header>
        <span>{preview.mode === "smartStorage" ? "Smart Storage" : "Direct Post"}</span>
        <KnowledgeTypeIcon knowledgeType={preview.knowledgeType} />
      </header>
      <dl>
        {preview.attributes.map((attribute) => (
          <div key={attribute.label}>
            <dt>{attribute.label}</dt>
            <dd>{attribute.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ContributionContextTags({
  context,
  onNavigateToHref,
}: {
  context: ActiveTag[];
  onNavigateToHref?: (href: string) => void;
}) {
  if (context.length === 0) {
    return (
      <p className="kb-contribution-context-empty" role="status">
        Global Knowledge Context
      </p>
    );
  }

  return (
    <ul className="kb-contribution-context-tags" aria-label="Contribution context Tags">
      {context.map((tag) => (
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
