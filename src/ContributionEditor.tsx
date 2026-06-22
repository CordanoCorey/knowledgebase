import {
  Bold,
  CheckCircle2,
  Italic,
  Link,
  List,
  ListOrdered,
  LoaderCircle,
  LockKeyhole,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Content } from "@tiptap/core";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  GENERIC_CONTRIBUTION_KNOWLEDGE_TYPES,
  formatKnowledgeTypeLabel,
  getComposerTitleBehavior,
  isComposerTitleAddable,
  isComposerTitleRequired,
  isAuthorableKnowledgeType,
  type ActiveTag,
  type ComposerTitleBehavior,
  type AuthorableKnowledgeType,
  type ContributionInput,
  type ContributionMode,
  type ContributionPreview,
  type ContributionResult,
  type DraftLinkPreviewResult,
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
type DraftLinkPreviewHandler = (
  url: string,
) => Promise<DraftLinkPreviewResult> | DraftLinkPreviewResult;

export type ContributionEditorProps = ContributionKnowledgeTypeSources & {
  context: ActiveTag[];
  defaultMode?: ContributionMode;
  draft?: ContributionEditorDraft | null;
  draftKey?: string;
  guidedContributionType?: GuidedContributionType | null;
  initialBody?: string;
  initialTitle?: string;
  onClearDraft?: () => Promise<void> | void;
  onDraftChange?: (
    draft: ContributionEditorDraftInput,
  ) => Promise<void> | void;
  onKnowledgeTypeChange?: (nextType: AuthorableKnowledgeType) => void;
  onNavigateToHref?: (href: string) => void;
  onPreviewExternalUrl?: DraftLinkPreviewHandler;
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
  titleBehavior: ComposerTitleBehavior;
  titleLabel?: string;
  titlePlaceholder?: string;
  titlePreviewLabel?: string;
  titleRequired: boolean;
};

type ContributionPrimaryField = "body" | "title";
type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "error"; message: string };
type DraftLinkPreviewState =
  | { status: "pending" }
  | {
      status: "fetched";
      description?: string;
      imageUrl?: string;
      siteName?: string;
      title?: string;
    }
  | { status: "failed"; error?: string };
type ContributionExternalUrlChip = SmartStorageExternalUrlInput & {
  draftPreviewError?: string;
  draftPreviewStatus: DraftLinkPreviewState["status"];
};

export type ContributionEditorDraft = {
  bodyDocumentJson: string;
  bodyPlainText: string;
  selectedKnowledgeType?: AuthorableKnowledgeType;
  title: string;
};

export type ContributionEditorDraftInput = ContributionEditorDraft;

type RichTextContributionValue = {
  bodyDocumentJson: string;
  bodyPlainText: string;
};

const EMPTY_RICH_TEXT_DOCUMENT: Content = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const AUTOSAVE_DRAFT_DELAY_MS = 700;

export function ContributionEditor({
  allowedContributionTypes,
  context,
  draft,
  draftKey,
  defaultMode,
  guidedContributionType,
  initialBody = "",
  initialTitle = "",
  onClearDraft,
  onDraftChange,
  onKnowledgeTypeChange,
  onNavigateToHref,
  onPreviewExternalUrl,
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
  const [bodyDocumentJson, setBodyDocumentJson] = useState(() =>
    createRichTextDocumentJsonFromText(initialBody),
  );
  const [isAddableTitleVisible, setIsAddableTitleVisible] = useState(
    initialTitle.trim().length > 0,
  );
  const [uploadedFiles, setUploadedFiles] = useState<
    SmartStorageUploadedFileInput[]
  >([]);
  const [uploadState, setUploadState] = useState<UploadState>({
    kind: "idle",
  });
  const [draftLinkPreviews, setDraftLinkPreviews] = useState<
    Record<string, DraftLinkPreviewState>
  >({});
  const requestedDraftPreviewUrlsRef = useRef(new Set<string>());
  const detectedDraftPreviewUrlsRef = useRef(new Set<string>());
  const appliedDraftKeyRef = useRef<string | undefined>(undefined);
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    kind: "idle",
  });
  const allowedTypes = useMemo(
    () => getAllowedContributionTypes(allowedContributionTypes),
    [allowedContributionTypes],
  );
  const allowedTypeKey = allowedTypes.join("\n");
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
  const activeTitleBehavior = getComposerTitleBehavior(activeKnowledgeType);
  const supportsSmartStorageSources = activeGuidedContributionType === null;
  const detectedExternalUrls = supportsSmartStorageSources
    ? extractExternalUrlsFromText(body)
    : [];
  const detectedExternalUrlKey = detectedExternalUrls
    .map((externalUrl) => externalUrl.url)
    .join("\n");
  const externalUrls = detectedExternalUrls.map((externalUrl) =>
    createExternalUrlInputFromPreview(
      externalUrl.url,
      draftLinkPreviews[externalUrl.url],
    ),
  );
  const externalUrlChips = detectedExternalUrls.map((externalUrl) =>
    createExternalUrlChipFromPreview(
      externalUrl.url,
      draftLinkPreviews[externalUrl.url],
    ),
  );
  const hasExplicitWordsTitle =
    activeTitleBehavior.smartStorageTriggerWhenProvided &&
    title.trim().length > 0;
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
      knowledgeType: activeKnowledgeType,
    });
  const secondarySubmitLabel = getContributionSubmitLabel(
    secondaryMode,
    activeKnowledgeType,
    activeGuidedContributionType,
  );
  const primaryField = getContributionPrimaryField(fieldConfig);

  useEffect(() => {
    appliedDraftKeyRef.current = undefined;
    setBody(initialBody);
    setBodyDocumentJson(createRichTextDocumentJsonFromText(initialBody));
    setTitle(initialTitle);
    setIsAddableTitleVisible(initialTitle.trim().length > 0);
  }, [draftKey, initialBody, initialTitle]);

  useEffect(() => {
    if (!draftKey || draft === undefined || appliedDraftKeyRef.current === draftKey) {
      return;
    }

    appliedDraftKeyRef.current = draftKey;

    if (!draft) {
      return;
    }

    setBody(draft.bodyPlainText);
    setBodyDocumentJson(draft.bodyDocumentJson);
    setTitle(draft.title);
    setIsAddableTitleVisible(draft.title.trim().length > 0);

    if (
      draft.selectedKnowledgeType &&
      allowedTypes.includes(draft.selectedKnowledgeType)
    ) {
      onKnowledgeTypeChange?.(draft.selectedKnowledgeType);
    }
  }, [allowedTypeKey, draft, draftKey, onKnowledgeTypeChange]);

  useEffect(() => {
    if (
      !draftKey ||
      draft === undefined ||
      appliedDraftKeyRef.current !== draftKey ||
      (!onDraftChange && !onClearDraft)
    ) {
      return;
    }

    const handle = window.setTimeout(() => {
      const bodyPlainText = body;
      const draftTitle =
        activeTitleBehavior.input === "hidden" ? "" : title.trim();
      const hasDraftContent =
        bodyPlainText.trim().length > 0 || draftTitle.length > 0;

      if (!hasDraftContent) {
        if (draft) {
          void Promise.resolve(onClearDraft?.()).catch(() => undefined);
        }
        return;
      }

      void Promise.resolve(
        onDraftChange?.({
          bodyDocumentJson,
          bodyPlainText,
          ...(isAuthorableKnowledgeType(selectedKnowledgeType) &&
          allowedTypes.includes(selectedKnowledgeType)
            ? { selectedKnowledgeType }
            : {}),
          title: draftTitle,
        }),
      ).catch(() => undefined);
    }, AUTOSAVE_DRAFT_DELAY_MS);

    return () => window.clearTimeout(handle);
  }, [
    activeTitleBehavior.input,
    allowedTypeKey,
    body,
    bodyDocumentJson,
    draft,
    draftKey,
    onClearDraft,
    onDraftChange,
    selectedKnowledgeType,
    title,
  ]);

  useEffect(() => {
    if (slot) {
      setIsExpanded(true);
    }
  }, [slot]);

  useEffect(() => {
    if (!isComposerTitleAddable(activeKnowledgeType)) {
      setIsAddableTitleVisible(false);
    }
  }, [activeKnowledgeType]);

  useEffect(() => {
    const detectedUrlSet = new Set(getUrlsFromKey(detectedExternalUrlKey));
    detectedDraftPreviewUrlsRef.current = detectedUrlSet;

    for (const requestedUrl of requestedDraftPreviewUrlsRef.current) {
      if (!detectedUrlSet.has(requestedUrl)) {
        requestedDraftPreviewUrlsRef.current.delete(requestedUrl);
      }
    }

    setDraftLinkPreviews((current) => {
      let changed = false;
      const next = { ...current };

      for (const url of Object.keys(next)) {
        if (!detectedUrlSet.has(url)) {
          delete next[url];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [detectedExternalUrlKey]);

  useEffect(() => {
    if (!supportsSmartStorageSources || !onPreviewExternalUrl) {
      return;
    }

    for (const url of getUrlsFromKey(detectedExternalUrlKey)) {
      if (requestedDraftPreviewUrlsRef.current.has(url)) {
        continue;
      }

      requestedDraftPreviewUrlsRef.current.add(url);
      setDraftLinkPreviews((current) => ({
        ...current,
        [url]: current[url] ?? { status: "pending" },
      }));

      void Promise.resolve(onPreviewExternalUrl(url))
        .then((result) => {
          setDraftLinkPreviews((current) => {
            if (!detectedDraftPreviewUrlsRef.current.has(url)) {
              return current;
            }

            return {
              ...current,
              [url]: toDraftLinkPreviewState(result),
            };
          });
        })
        .catch(() => {
          setDraftLinkPreviews((current) => {
            if (!detectedDraftPreviewUrlsRef.current.has(url)) {
              return current;
            }

            return {
              ...current,
              [url]: {
                error: "Link preview unavailable.",
                status: "failed",
              },
            };
          });
        });
    }
  }, [
    detectedExternalUrlKey,
    onPreviewExternalUrl,
    supportsSmartStorageSources,
  ]);

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
    await Promise.resolve(onClearDraft?.());
    setSubmissionState({ kind: "submitted", entryId: result.entryId, mode });
    setBody("");
    setBodyDocumentJson(createRichTextDocumentJsonFromText(""));
    setTitle("");
    setIsAddableTitleVisible(false);
    setUploadedFiles([]);
    setDraftLinkPreviews({});
    requestedDraftPreviewUrlsRef.current.clear();
    detectedDraftPreviewUrlsRef.current = new Set();
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
  const showsAddableTitleField =
    fieldConfig.titleBehavior.input === "addable" && isAddableTitleVisible;
  const showsTitleField = fieldConfig.showsTitleField || showsAddableTitleField;
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
        required={fieldConfig.titleRequired}
        type="text"
        value={title}
      />
    </label>
  ) : null;
  const addTitleButton =
    fieldConfig.titleBehavior.input === "addable" && !isAddableTitleVisible ? (
      <button
        className="kb-contribution-add-title"
        onClick={() => setIsAddableTitleVisible(true)}
        type="button"
      >
        Add title
      </button>
    ) : null;

  function handleBodyChange(nextValue: RichTextContributionValue) {
    setBody(nextValue.bodyPlainText);
    setBodyDocumentJson(nextValue.bodyDocumentJson);
  }

  const bodyField = fieldConfig.showsBodyField ? (
    <div
      className={getContributionFieldClassName(
        "body",
        primaryField === "body",
      )}
      onDragOver={handleBodyDragOver}
      onDrop={handleBodyDrop}
    >
      <span>{fieldConfig.bodyLabel}</span>
      <RichTextContributionBody
        bodyDocumentJson={bodyDocumentJson}
        bodyPlainText={body}
        onChange={handleBodyChange}
        placeholder={fieldConfig.bodyPlaceholder}
        required={fieldConfig.bodyRequired}
      />
    </div>
  ) : null;
  const sourceTools =
    supportsSmartStorageSources ? (
      <ContributionSourceTools
        externalUrls={externalUrlChips}
        onFileInputChange={(event) => void handleFileInputChange(event)}
        onRemoveExternalUrl={handleRemoveExternalUrl}
        onRemoveUploadedFile={handleRemoveUploadedFile}
        uploadedFiles={uploadedFiles}
        uploadState={uploadState}
      />
  ) : null;
  const modeChip = isSmartStorageForced({
    hasExplicitWordsTitle,
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
          {addTitleButton}
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
): ContributionPrimaryField {
  if (fieldConfig.showsTitleField && fieldConfig.titleBehavior.primaryInput) {
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

function RichTextContributionBody({
  bodyDocumentJson,
  bodyPlainText,
  onChange,
  placeholder,
  required,
}: {
  bodyDocumentJson: string;
  bodyPlainText: string;
  onChange: (nextValue: RichTextContributionValue) => void;
  placeholder: string;
  required: boolean;
}) {
  const initialContent = useMemo(
    () => parseRichTextDocumentJson(bodyDocumentJson, bodyPlainText),
    [],
  );
  const appliedDocumentJsonRef = useRef(bodyDocumentJson);
  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: initialContent,
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      editorProps: {
        attributes: {
          "aria-label": "Contribution body",
          "aria-multiline": "true",
          "aria-required": required ? "true" : "false",
          class: "kb-contribution-rich-text-prose",
          role: "textbox",
        },
      },
      onUpdate: ({ editor: updatedEditor }) => {
        const nextBodyDocumentJson = stringifyEditorDocument(updatedEditor);
        appliedDocumentJsonRef.current = nextBodyDocumentJson;
        onChange({
          bodyDocumentJson: nextBodyDocumentJson,
          bodyPlainText: getEditorPlainText(updatedEditor),
        });
      },
    },
    [],
  );

  useEffect(() => {
    if (!editor || appliedDocumentJsonRef.current === bodyDocumentJson) {
      return;
    }

    const nextContent = parseRichTextDocumentJson(
      bodyDocumentJson,
      bodyPlainText,
    );
    appliedDocumentJsonRef.current = bodyDocumentJson;
    editor.commands.setContent(nextContent, { emitUpdate: false });
  }, [bodyDocumentJson, bodyPlainText, editor]);

  function handlePlainTextStateChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const bodyPlainText = event.currentTarget.value;
    const nextBodyDocumentJson =
      createRichTextDocumentJsonFromText(bodyPlainText);
    appliedDocumentJsonRef.current = nextBodyDocumentJson;
    editor?.commands.setContent(
      parseRichTextDocumentJson(nextBodyDocumentJson, bodyPlainText),
      { emitUpdate: false },
    );
    onChange({
      bodyDocumentJson: nextBodyDocumentJson,
      bodyPlainText,
    });
  }

  return (
    <div
      aria-label="Contribution body editor"
      aria-required={required ? "true" : "false"}
      className="kb-contribution-rich-text"
    >
      <ContributionRichTextToolbar editor={editor} />
      <div className="kb-contribution-rich-text-surface">
        <EditorContent editor={editor} />
        {bodyPlainText.trim() ? null : (
          <span className="kb-contribution-rich-text-placeholder" aria-hidden="true">
            {placeholder}
          </span>
        )}
      </div>
      <textarea
        aria-hidden="true"
        className="kb-contribution-rich-text-state"
        onChange={handlePlainTextStateChange}
        tabIndex={-1}
        value={bodyPlainText}
      />
    </div>
  );
}

function ContributionRichTextToolbar({ editor }: { editor: Editor | null }) {
  return (
    <div className="kb-contribution-rich-text-toolbar" aria-label="Formatting">
      <ContributionRichTextButton
        active={editor?.isActive("bold")}
        disabled={!editor?.can().chain().focus().toggleBold().run()}
        label="Bold"
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold aria-hidden="true" />
      </ContributionRichTextButton>
      <ContributionRichTextButton
        active={editor?.isActive("italic")}
        disabled={!editor?.can().chain().focus().toggleItalic().run()}
        label="Italic"
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic aria-hidden="true" />
      </ContributionRichTextButton>
      <ContributionRichTextButton
        active={editor?.isActive("bulletList")}
        disabled={!editor}
        label="Bullet list"
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List aria-hidden="true" />
      </ContributionRichTextButton>
      <ContributionRichTextButton
        active={editor?.isActive("orderedList")}
        disabled={!editor}
        label="Numbered list"
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden="true" />
      </ContributionRichTextButton>
    </div>
  );
}

function ContributionRichTextButton({
  active,
  children,
  disabled,
  label,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="kb-contribution-rich-text-button"
      data-active={active ? "true" : "false"}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

export function createRichTextDocumentJsonFromText(text: string) {
  return JSON.stringify(createRichTextDocumentFromText(text));
}

function createRichTextDocumentFromText(text: string): Content {
  const lines = text.split(/\r?\n/);
  const content = lines.length === 0 ? [""] : lines;

  return {
    type: "doc",
    content: content.map((line) => ({
      type: "paragraph",
      ...(line
        ? {
            content: [
              {
                type: "text",
                text: line,
              },
            ],
          }
        : {}),
    })),
  };
}

function parseRichTextDocumentJson(
  bodyDocumentJson: string,
  fallbackText: string,
): Content {
  try {
    const parsed = JSON.parse(bodyDocumentJson) as unknown;
    if (isRichTextDocument(parsed)) {
      return parsed;
    }
  } catch {
    // Fall back to plain text below.
  }

  return fallbackText ? createRichTextDocumentFromText(fallbackText) : EMPTY_RICH_TEXT_DOCUMENT;
}

function isRichTextDocument(value: unknown): value is Content {
  return (
    value !== null &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type?: unknown }).type === "doc"
  );
}

function stringifyEditorDocument(editor: Editor) {
  return JSON.stringify(editor.getJSON());
}

function getEditorPlainText(editor: Editor) {
  return editor.getText({ blockSeparator: "\n" });
}

function ContributionSourceTools({
  externalUrls,
  onFileInputChange,
  onRemoveExternalUrl,
  onRemoveUploadedFile,
  uploadedFiles,
  uploadState,
}: {
  externalUrls: ContributionExternalUrlChip[];
  onFileInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveExternalUrl: (url: string) => void;
  onRemoveUploadedFile: (index: number) => void;
  uploadedFiles: SmartStorageUploadedFileInput[];
  uploadState: UploadState;
}) {
  const hasInventory = externalUrls.length > 0 || uploadedFiles.length > 0;

  return (
    <section
      aria-label="Staged Attachments"
      className="kb-contribution-source-tools"
    >
      <label className="kb-contribution-file-picker">
        <UploadCloud aria-hidden="true" />
        <span>
          {uploadState.kind === "uploading" ? "Uploading..." : "Attach file"}
        </span>
        <input
          aria-label="Attach file"
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
                <strong>{getExternalUrlChipTitle(externalUrl)}</strong>
                <small>{getExternalUrlChipMeta(externalUrl)}</small>
                {externalUrl.linkPreviewSiteName &&
                externalUrl.linkPreviewDescription ? (
                  <small>{externalUrl.linkPreviewDescription}</small>
                ) : null}
              </span>
              <button
                aria-label={`Remove external URL Attachment ${index + 1}`}
                className="kb-contribution-source-remove"
                onClick={() => onRemoveExternalUrl(externalUrl.url)}
                title="Remove external URL Attachment"
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
                aria-label={`Remove uploaded file Attachment ${index + 1}`}
                className="kb-contribution-source-remove"
                onClick={() => onRemoveUploadedFile(index)}
                title="Remove uploaded file Attachment"
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

function getExternalUrlChipTitle(externalUrl: ContributionExternalUrlChip) {
  if (externalUrl.linkPreviewTitle) {
    return externalUrl.linkPreviewTitle;
  }
  if (externalUrl.linkPreviewSiteName) {
    return externalUrl.linkPreviewSiteName;
  }
  if (externalUrl.linkPreviewDescription) {
    return "Link preview";
  }
  if (
    externalUrl.draftPreviewStatus === "failed" ||
    externalUrl.draftPreviewStatus === "fetched"
  ) {
    return "Link preview unavailable";
  }

  return "Link preview pending";
}

function getExternalUrlChipMeta(externalUrl: ContributionExternalUrlChip) {
  if (externalUrl.linkPreviewSiteName) {
    return `${externalUrl.linkPreviewSiteName} / ${externalUrl.url}`;
  }
  if (externalUrl.linkPreviewDescription) {
    return externalUrl.linkPreviewDescription;
  }

  return externalUrl.url;
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

function createExternalUrlInputFromPreview(
  url: string,
  preview: DraftLinkPreviewState | undefined,
): SmartStorageExternalUrlInput {
  if (!preview || preview.status !== "fetched") {
    return { url };
  }

  return {
    ...(preview.description === undefined
      ? {}
      : { linkPreviewDescription: preview.description }),
    ...(preview.imageUrl === undefined
      ? {}
      : { linkPreviewImageUrl: preview.imageUrl }),
    ...(preview.siteName === undefined
      ? {}
      : { linkPreviewSiteName: preview.siteName }),
    ...(preview.title === undefined
      ? {}
      : { linkPreviewTitle: preview.title }),
    url,
  };
}

function createExternalUrlChipFromPreview(
  url: string,
  preview: DraftLinkPreviewState | undefined,
): ContributionExternalUrlChip {
  const externalUrl = createExternalUrlInputFromPreview(url, preview);
  const previewStatus = preview?.status ?? "pending";

  return {
    ...externalUrl,
    ...(preview?.status === "failed" && preview.error
      ? { draftPreviewError: preview.error }
      : {}),
    draftPreviewStatus: previewStatus,
  };
}

function toDraftLinkPreviewState(
  result: DraftLinkPreviewResult,
): DraftLinkPreviewState {
  if (result.status === "failed") {
    return {
      ...(result.error === undefined ? {} : { error: result.error }),
      status: "failed",
    };
  }

  return {
    ...(result.description === undefined
      ? {}
      : { description: result.description }),
    ...(result.imageUrl === undefined ? {} : { imageUrl: result.imageUrl }),
    ...(result.siteName === undefined ? {} : { siteName: result.siteName }),
    ...(result.title === undefined ? {} : { title: result.title }),
    status: "fetched",
  };
}

function getUrlsFromKey(urlKey: string) {
  return urlKey ? urlKey.split("\n") : [];
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
  const titleBehavior = getComposerTitleBehavior(knowledgeType);
  const trimmedTitle = title.trim();

  if (titleBehavior.generatedTitleKind === "parentComment") {
    return createCommentTitle(parentEntryTitle);
  }

  if (titleBehavior.generatedTitleKind === "bodyPreview") {
    return trimmedTitle || createWordsTitle(body);
  }

  return trimmedTitle;
}

function createCommentTitle(parentEntryTitle?: string) {
  const trimmedParentTitle = parentEntryTitle?.trim();
  return trimmedParentTitle ? `Comment on ${trimmedParentTitle}` : "Comment";
}

function getContributionFieldConfig(
  knowledgeType: AuthorableKnowledgeType,
  guidedContributionType: GuidedContributionType | null = null,
): ContributionFieldConfig {
  const titleBehavior = getComposerTitleBehavior(knowledgeType);
  const showsTitleField = isComposerTitleRequired(knowledgeType);
  const titlePlaceholder =
    titleBehavior.placeholder ?? `${formatKnowledgeTypeLabel(knowledgeType)} title`;
  const titlePreviewLabel =
    titleBehavior.input === "hidden" ? undefined : titleBehavior.previewLabel;

  if (knowledgeType === "group" && guidedContributionType === "group") {
    const guidedGroupTitleBehavior: ComposerTitleBehavior = {
      ...titleBehavior,
      label: "What is the group called?",
      placeholder: "Basketball Club",
      previewLabel: "Group",
      primaryInput: true,
    };

    return {
      bodyLabel: "Source",
      bodyPlaceholder: "",
      bodyPreviewLabel: "Preview",
      bodyRequired: false,
      showsBodyField: false,
      showsTitleField,
      titleBehavior: guidedGroupTitleBehavior,
      titleLabel: guidedGroupTitleBehavior.label,
      titlePlaceholder: guidedGroupTitleBehavior.placeholder,
      titlePreviewLabel: guidedGroupTitleBehavior.previewLabel,
      titleRequired: showsTitleField,
    };
  }

  if (knowledgeType === "comment") {
    return {
      bodyLabel: "Comment",
      bodyPlaceholder: "Write a comment...",
      bodyPreviewLabel: "Preview",
      bodyRequired: true,
      showsBodyField: true,
      showsTitleField,
      titleBehavior,
      titleLabel: titleBehavior.label,
      titlePlaceholder,
      titlePreviewLabel,
      titleRequired: showsTitleField,
    };
  }

  if (knowledgeType === "words") {
    return {
      bodyLabel: "Source",
      bodyPlaceholder: "Contribute an answer in this context...",
      bodyPreviewLabel: "Preview",
      bodyRequired: true,
      showsBodyField: true,
      showsTitleField,
      titleBehavior,
      titleLabel: titleBehavior.label,
      titlePlaceholder,
      titlePreviewLabel,
      titleRequired: showsTitleField,
    };
  }

  if (knowledgeType === "question") {
    return {
      bodyLabel: "Details",
      bodyPlaceholder: "Add optional details about this question...",
      bodyPreviewLabel: "Details",
      bodyRequired: false,
      showsBodyField: true,
      showsTitleField,
      titleBehavior,
      titleLabel: titleBehavior.label,
      titlePlaceholder,
      titlePreviewLabel,
      titleRequired: showsTitleField,
    };
  }

  return {
    bodyLabel: "Source",
    bodyPlaceholder: "Contribute an answer in this context...",
    bodyPreviewLabel: "Preview",
    bodyRequired: true,
    showsBodyField: true,
    showsTitleField,
    titleBehavior,
    titleLabel: titleBehavior.label,
    titlePlaceholder,
    titlePreviewLabel,
    titleRequired: showsTitleField,
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
  knowledgeType,
}: {
  hasExplicitWordsTitle?: boolean;
  knowledgeType: AuthorableKnowledgeType;
}) {
  const titleBehavior = getComposerTitleBehavior(knowledgeType);

  return (
    (titleBehavior.smartStorageTriggerWhenProvided &&
      hasExplicitWordsTitle === true) ||
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
