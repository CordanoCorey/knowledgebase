import {
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Send,
  Sparkles,
} from "lucide-react";
import {
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

export type ContributionEditorProps = ContributionKnowledgeTypeSources & {
  context: ActiveTag[];
  defaultMode?: ContributionMode;
  guidedContributionType?: GuidedContributionType | null;
  initialBody?: string;
  initialTitle?: string;
  onKnowledgeTypeChange?: (nextType: AuthorableKnowledgeType) => void;
  onNavigateToHref?: (href: string) => void;
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

export function ContributionEditor({
  context,
  defaultMode,
  guidedContributionType,
  initialBody = "",
  initialTitle = "",
  onKnowledgeTypeChange,
  onNavigateToHref,
  onPostDirect,
  onStoreSmartly,
  onSubmitSource,
  parentEntryTitle,
  selectedKnowledgeType,
  slot,
}: ContributionEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
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
  const contributionPreview = createContributionPreview({
    body,
    context,
    defaultMode,
    guidedContributionType: activeGuidedContributionType,
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
  const showsSecondarySubmit = activeGuidedContributionType === null;
  const secondarySubmitLabel = getContributionSubmitLabel(
    secondaryMode,
    activeKnowledgeType,
    activeGuidedContributionType,
  );

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
      context,
      guidedContributionType: activeGuidedContributionType,
      knowledgeType: activeKnowledgeType,
      parentEntryTitle,
      slot,
      title,
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
  }

  return (
    <section
      className="kb-contribution-editor"
      aria-labelledby="kb-contribution-heading"
      data-guided-type={activeGuidedContributionType ?? undefined}
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

      <ContributionPreviewPanel preview={contributionPreview} />

      <form className="kb-contribution-form" onSubmit={handleSubmit}>
        <label className="kb-contribution-field">
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

        {fieldConfig.showsTitleField ? (
          <label className="kb-contribution-field">
            <span>{fieldConfig.titleLabel}</span>
            <input
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder={fieldConfig.titlePlaceholder}
              required
              type="text"
              value={title}
            />
          </label>
        ) : null}

        {fieldConfig.showsBodyField ? (
          <label className="kb-contribution-field">
            <span>{fieldConfig.bodyLabel}</span>
            <textarea
              onChange={(event) => setBody(event.currentTarget.value)}
              placeholder={fieldConfig.bodyPlaceholder}
              required={fieldConfig.bodyRequired}
              rows={5}
              value={body}
            />
          </label>
        ) : null}

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
              ? "Stored Smartly"
              : "Submitted"}
          </p>
        )}
      </Presence>
    </section>
  );
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
  slot,
}: {
  context: ActiveTag[];
  defaultMode?: ContributionMode;
  guidedContributionType?: GuidedContributionType | null;
  slot?: KnowledgeSlotSummary;
}): ContributionMode {
  if (guidedContributionType) {
    return "direct";
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
  knowledgeType,
  parentEntryTitle: _parentEntryTitle,
  slot,
  title = "",
}: {
  body: string;
  context: ActiveTag[];
  defaultMode?: ContributionMode;
  guidedContributionType?: GuidedContributionType | null;
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
  context,
  guidedContributionType,
  knowledgeType,
  parentEntryTitle,
  slot,
  title = "",
}: {
  body: string;
  context: ActiveTag[];
  guidedContributionType?: GuidedContributionType | null;
  knowledgeType: AuthorableKnowledgeType;
  parentEntryTitle?: string;
  slot?: KnowledgeSlotSummary;
  title?: string;
}): ContributionInput {
  const activeGuidedContributionType = resolveGuidedContributionType(
    knowledgeType,
    guidedContributionType,
  );
  const fieldConfig = getContributionFieldConfig(
    knowledgeType,
    activeGuidedContributionType,
  );

  return {
    body: fieldConfig.showsBodyField ? body : "",
    contextTags: context,
    knowledgeType,
    slotId: slot?.id,
    title: createContributionInputTitle({
      knowledgeType,
      parentEntryTitle,
      title,
    }),
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
