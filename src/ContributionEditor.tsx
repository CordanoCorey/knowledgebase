import {
  CheckCircle2,
  Link,
  LoaderCircle,
  LockKeyhole,
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
  type DragEvent,
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
  allowedContributionTypes?: readonly AuthorableKnowledgeType[];
  body?: string;
  parentEntryTitle?: string;
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
  allowedContributionTypes,
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
  const [isWordsTitleVisible, setIsWordsTitleVisible] = useState(
    initialTitle.trim().length > 0,
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
  const allowedTypes = getAllowedContributionTypes(allowedContributionTypes);
  const activeKnowledgeType = resolveContributionKnowledgeType({
    allowedContributionTypes: allowedTypes,
    body,
    parentEntryTitle,
    selectedKnowledgeType,
    slot,
  });
  const activeGuidedContributionType = resolveGuidedContributionType(
    activeKnowledgeType,
    guidedContributionType,
  );
  const supportsSmartStorageSources = activeGuidedContributionType === null;
  const externalUrls = supportsSmartStorageSources
    ? extractExternalUrlsFromText(body)
    : [];
  const hasExplicitWordsTitle =
    activeKnowledgeType === "words" && title.trim().length > 0;
  const hasSupplementalSources =
    supportsSmartStorageSources &&
    (externalUrls.length > 0 || uploadedFiles.length > 0);
  const contributionPreview = createContributionPreview({
    body,
    context,
    defaultMode,
    guidedContributionType: activeGuidedContributionType,
    hasExplicitWordsTitle,
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
    allowedTypes,
  );
  const isTypeFixed = isSlotTypeFixed || knowledgeTypeOptions.length <= 1;
  const secondaryMode = getAlternateContributionMode(contributionPreview.mode);
  const showsSecondarySubmit =
    activeGuidedContributionType === null &&
    !isSmartStorageForced({
      hasExplicitWordsTitle,
      hasSupplementalSources,
      knowledgeType: activeKnowledgeType,
    });
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

  useEffect(() => {
    if (activeKnowledgeType !== "words") {
      setIsWordsTitleVisible(false);
    }
  }, [activeKnowledgeType]);

  function handleEditorFocus() {
    setIsExpanded(true);
  }

  function handleCollapseEditor() {
    setIsExpanded(false);
  }

  function handleKnowledgeTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextType = event.currentTarget.value;
    if (
      !isTypeFixed &&
      isAuthorableKnowledgeType(nextType) &&
      allowedTypes.includes(nextType)
    ) {
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
    setIsWordsTitleVisible(false);
    setUploadedFiles([]);
  }

  function handleRemoveExternalUrl(url: string) {
    setBody((currentBody) => removeUrlFromText(currentBody, url));
  }

  function handleRemoveUploadedFile(index: number) {
    setUploadedFiles((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function uploadFiles(files: File[]) {
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

  async function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    await uploadFiles(files);
  }

  function handleBodyDragOver(event: DragEvent<HTMLElement>) {
    if (Array.from(event.dataTransfer.types).includes("Files")) {
      event.preventDefault();
    }
  }

  function handleBodyDrop(event: DragEvent<HTMLElement>) {
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    void uploadFiles(files);
  }

  const typeField = isTypeFixed ? (
    <span
      className="kb-contribution-type-chip"
      data-knowledge-type={activeKnowledgeType}
    >
      {isSlotTypeFixed ? (
        <LockKeyhole aria-hidden="true" className="kb-contribution-lock-icon" />
      ) : null}
      <KnowledgeTypeIcon knowledgeType={activeKnowledgeType} />
      <span>{activeKnowledgeTypeLabel}</span>
    </span>
  ) : (
    <label className="kb-contribution-field kb-contribution-type-field">
      <span>Knowledge Type</span>
      <select
        data-knowledge-type={activeKnowledgeType}
        onChange={handleKnowledgeTypeChange}
        value={activeKnowledgeType}
      >
        {knowledgeTypeOptions.map((knowledgeType) => (
          <option
            data-knowledge-type={knowledgeType}
            key={knowledgeType}
            value={knowledgeType}
          >
            {formatKnowledgeTypeLabel(knowledgeType)}
          </option>
        ))}
      </select>
    </label>
  );
  const showsWordsTitleField =
    activeKnowledgeType === "words" && isWordsTitleVisible;
  const showsTitleField = fieldConfig.showsTitleField || showsWordsTitleField;
  const titleField = showsTitleField ? (
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
        required={fieldConfig.showsTitleField}
        type="text"
        value={title}
      />
    </label>
  ) : null;
  const addWordsTitleButton =
    activeKnowledgeType === "words" && !isWordsTitleVisible ? (
      <button
        className="kb-contribution-add-title"
        onClick={() => setIsWordsTitleVisible(true)}
        type="button"
      >
        Add title
      </button>
    ) : null;
  const bodyField = fieldConfig.showsBodyField ? (
    <label
      className={getContributionFieldClassName(
        "body",
        primaryField === "body",
      )}
      onDragOver={handleBodyDragOver}
      onDrop={handleBodyDrop}
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
        externalUrls={externalUrls}
        onFileInputChange={(event) => void handleFileInputChange(event)}
        onRemoveExternalUrl={handleRemoveExternalUrl}
        onRemoveUploadedFile={handleRemoveUploadedFile}
        uploadedFiles={uploadedFiles}
        uploadState={uploadState}
      />
    ) : null;
  const modeChip = isSmartStorageForced({
    hasExplicitWordsTitle,
    hasSupplementalSources,
    knowledgeType: activeKnowledgeType,
  }) ? (
    <span className="kb-contribution-mode-chip">
      <Sparkles aria-hidden="true" />
      <span>Smart Storage</span>
    </span>
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
          <span
            className="kb-contribution-fixed-type"
            data-knowledge-type={activeKnowledgeType}
          >
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
        {primaryField === "title" ? titleField : bodyField}
        {sourceTools}
        <div className="kb-contribution-metadata-row">
          {typeField}
          {primaryField === "title" ? bodyField : titleField}
          {addWordsTitleButton}
          {modeChip}
        </div>

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
              ? "Stored"
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
  externalUrls,
  onFileInputChange,
  onRemoveExternalUrl,
  onRemoveUploadedFile,
  uploadedFiles,
  uploadState,
}: {
  externalUrls: SmartStorageExternalUrlInput[];
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveExternalUrl: (url: string) => void;
  onRemoveUploadedFile: (index: number) => void;
  uploadedFiles: SmartStorageUploadedFileInput[];
  uploadState: UploadState;
}) {
  const hasInventory = externalUrls.length > 0 || uploadedFiles.length > 0;

  return (
    <section
      aria-label="Staged Sources"
      className="kb-contribution-source-tools"
    >
      <label className="kb-contribution-file-picker">
        <UploadCloud aria-hidden="true" />
        <span>
          {uploadState.kind === "uploading" ? "Uploading..." : "Attach file"}
        </span>
        <input
          aria-label="Attach file Source"
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

      {hasInventory ? (
        <ul className="kb-contribution-source-chips">
          {externalUrls.map((externalUrl, index) => (
            <li key={`${externalUrl.url}-${index}`}>
              <Link aria-hidden="true" />
              <span>
                <strong>{externalUrl.linkPreviewTitle ?? "Link preview pending"}</strong>
                <small>{externalUrl.url}</small>
              </span>
              <button
                aria-label={`Remove external URL Source ${index + 1}`}
                className="kb-contribution-source-remove"
                onClick={() => onRemoveExternalUrl(externalUrl.url)}
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
      ) : null}
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
  allowedContributionTypes,
  body = "",
  parentEntryTitle,
  selectedKnowledgeType,
  slot,
}: ContributionKnowledgeTypeSources): AuthorableKnowledgeType {
  if (slot) {
    return slot.requestedKnowledgeType;
  }

  const allowedTypes = getAllowedContributionTypes(allowedContributionTypes);

  if (
    isAuthorableKnowledgeType(selectedKnowledgeType) &&
    allowedTypes.includes(selectedKnowledgeType)
  ) {
    return selectedKnowledgeType;
  }

  if (
    !parentEntryTitle &&
    endsWithQuestionMark(body) &&
    allowedTypes.includes("question")
  ) {
    return "question";
  }

  if (parentEntryTitle && allowedTypes.includes("comment")) {
    return "comment";
  }

  return allowedTypes.includes("words") ? "words" : allowedTypes[0];
}

export function resolveContributionMode({
  context,
  defaultMode,
  guidedContributionType,
  hasExplicitWordsTitle = false,
  hasSupplementalSources = false,
  knowledgeType = "words",
  slot,
}: {
  context: ActiveTag[];
  defaultMode?: ContributionMode;
  guidedContributionType?: GuidedContributionType | null;
  hasExplicitWordsTitle?: boolean;
  hasSupplementalSources?: boolean;
  knowledgeType?: AuthorableKnowledgeType;
  slot?: KnowledgeSlotSummary;
}): ContributionMode {
  if (guidedContributionType) {
    return "direct";
  }

  if (
    isSmartStorageForced({
      hasExplicitWordsTitle,
      hasSupplementalSources,
      knowledgeType,
    })
  ) {
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
  hasExplicitWordsTitle = false,
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
  hasExplicitWordsTitle?: boolean;
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
    hasExplicitWordsTitle,
    hasSupplementalSources,
    knowledgeType,
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
  const quotedPersonTag = getSingleQuotedPersonContextTag({
    context,
    knowledgeType,
  });
  if (quotedPersonTag) {
    attributes.push({
      label: "Quoted Person",
      value: quotedPersonTag.label,
    });
  }
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
  const bodyText = fieldConfig.showsBodyField ? body : "";

  return {
    body: bodyText,
    ...(trimmedContributionNote
      ? { contributionNote: trimmedContributionNote }
      : {}),
    contextTags: context,
    ...(externalUrls.length > 0 ? { externalUrls } : {}),
    knowledgeType,
    slotId: slot?.id,
    title: createContributionInputTitle({
      body: bodyText,
      knowledgeType,
      parentEntryTitle,
      title,
    }),
    ...(uploadedFiles.length > 0 ? { uploadedFiles } : {}),
  };
}

function createContributionInputTitle({
  body,
  knowledgeType,
  parentEntryTitle,
  title,
}: {
  body: string;
  knowledgeType: AuthorableKnowledgeType;
  parentEntryTitle?: string;
  title: string;
}) {
  if (knowledgeType === "comment") {
    return createCommentTitle(parentEntryTitle);
  }

  if (knowledgeType === "words") {
    return title.trim() || createWordsTitle(body);
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

  if (knowledgeType === "words") {
    return {
      bodyLabel: "Source",
      bodyPlaceholder: "Contribute an answer in this context...",
      bodyPreviewLabel: "Preview",
      bodyRequired: true,
      showsBodyField: true,
      showsTitleField: false,
      titleLabel: "Title",
      titlePlaceholder: "Optional title",
      titlePreviewLabel: "Title",
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
  allowedContributionTypes: readonly AuthorableKnowledgeType[],
) {
  if (!allowedContributionTypes.includes(activeKnowledgeType)) {
    return [activeKnowledgeType, ...allowedContributionTypes];
  }

  return allowedContributionTypes;
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
    return "Store";
  }

  if (knowledgeType === "group" && guidedContributionType === "group") {
    return "Create Group";
  }

  if (knowledgeType === "comment") {
    return "Comment";
  }

  if (knowledgeType === "words") {
    return "Post";
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

function getSingleQuotedPersonContextTag({
  context,
  knowledgeType,
}: {
  context: ActiveTag[];
  knowledgeType: AuthorableKnowledgeType;
}) {
  if (knowledgeType !== "quote") {
    return undefined;
  }

  const personTags = context.filter((tag) => tag.knowledgeType === "person");
  return personTags.length === 1 ? personTags[0] : undefined;
}

function formatContributionContextPreview(context: ActiveTag[]) {
  if (context.length === 0) {
    return "All Accessible Knowledge";
  }

  return context.map((tag) => tag.label).join(", ");
}

function limitContributionPreviewText(text: string) {
  if (text.length <= 140) {
    return text;
  }

  return `${text.slice(0, 137).trimEnd()}...`;
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
        All Accessible Knowledge
      </p>
    );
  }

  return (
    <ul className="kb-contribution-context-tags" aria-label="Contribution context Tags">
      {context.map((tag) => (
        <li data-knowledge-type={tag.knowledgeType} key={tag.id}>
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

function getAllowedContributionTypes(
  allowedContributionTypes?: readonly AuthorableKnowledgeType[],
): AuthorableKnowledgeType[] {
  const allowedTypes = (
    allowedContributionTypes ?? GENERIC_CONTRIBUTION_KNOWLEDGE_TYPES
  ).filter(
    (knowledgeType): knowledgeType is AuthorableKnowledgeType =>
      isAuthorableKnowledgeType(knowledgeType) && knowledgeType !== "rsvp",
  );

  return allowedTypes.length > 0 ? allowedTypes : ["words"];
}

function isSmartStorageForced({
  hasExplicitWordsTitle,
  hasSupplementalSources,
  knowledgeType,
}: {
  hasExplicitWordsTitle?: boolean;
  hasSupplementalSources?: boolean;
  knowledgeType: AuthorableKnowledgeType;
}) {
  return (
    hasSupplementalSources === true ||
    (knowledgeType === "words" && hasExplicitWordsTitle === true) ||
    (knowledgeType !== "words" && knowledgeType !== "comment")
  );
}

function endsWithQuestionMark(text: string) {
  return text.trimEnd().endsWith("?");
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/gi;
const TRAILING_URL_PUNCTUATION = /[),.;:!?]+$/;

export function extractExternalUrlsFromText(
  text: string,
): SmartStorageExternalUrlInput[] {
  const matches = text.match(URL_PATTERN) ?? [];
  const normalizedUrls = new Map<string, SmartStorageExternalUrlInput>();

  for (const match of matches) {
    const url = normalizeDetectedUrl(match);
    if (url && !normalizedUrls.has(url)) {
      normalizedUrls.set(url, { url });
    }
  }

  return Array.from(normalizedUrls.values());
}

function normalizeDetectedUrl(value: string) {
  const trimmed = value.trim().replace(TRAILING_URL_PUNCTUATION, "");

  try {
    return new URL(trimmed).href;
  } catch {
    return null;
  }
}

function removeUrlFromText(text: string, url: string) {
  return text
    .replace(URL_PATTERN, (match) => {
      const normalized = normalizeDetectedUrl(match);
      return normalized === url ? "" : match;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimStart();
}

function createWordsTitle(body: string) {
  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const source = firstLine ?? body.trim().replace(/\s+/g, " ");

  return limitContributionTitle(source || "Words");
}

function limitContributionTitle(text: string) {
  if (text.length <= 80) {
    return text;
  }

  return `${text.slice(0, 77).trimEnd()}...`;
}
