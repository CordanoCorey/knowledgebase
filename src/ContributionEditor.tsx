import {
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Send,
  Tag,
} from "lucide-react";
import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  AUTHORABLE_KNOWLEDGE_TYPES,
  formatKnowledgeTypeLabel,
  isAuthorableKnowledgeType,
  type ActiveTag,
  type AuthorableKnowledgeType,
  type ContributionInput,
  type ContributionResult,
  type KnowledgeSlotSummary,
  type KnowledgeType,
} from "./knowledgeContracts";
import { Presence } from "./Presence";

export type ContributionKnowledgeTypeSources = {
  selectedKnowledgeType?: KnowledgeType | null;
  slot?: KnowledgeSlotSummary;
  smartStorageProposedKnowledgeType?: KnowledgeType | null;
};

export type ContributionEditorProps = ContributionKnowledgeTypeSources & {
  context: ActiveTag[];
  onKnowledgeTypeChange?: (nextType: AuthorableKnowledgeType) => void;
  onSubmitSource: (
    input: ContributionInput,
  ) => Promise<ContributionResult> | ContributionResult;
};

type SubmissionState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "submitted"; entryId?: string };

export function ContributionEditor({
  context,
  onKnowledgeTypeChange,
  onSubmitSource,
  selectedKnowledgeType,
  slot,
  smartStorageProposedKnowledgeType,
}: ContributionEditorProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    kind: "idle",
  });
  const activeKnowledgeType = resolveContributionKnowledgeType({
    selectedKnowledgeType,
    slot,
    smartStorageProposedKnowledgeType,
  });
  const isSlotTypeFixed = Boolean(slot);
  const activeKnowledgeTypeLabel = formatKnowledgeTypeLabel(activeKnowledgeType);

  function handleKnowledgeTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextType = event.currentTarget.value;
    if (!isSlotTypeFixed && isAuthorableKnowledgeType(nextType)) {
      onKnowledgeTypeChange?.(nextType);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = createContributionInput({
      body,
      context,
      knowledgeType: activeKnowledgeType,
      slot,
      title,
    });

    setSubmissionState({ kind: "submitting" });
    const result = await onSubmitSource(input);
    setSubmissionState({ kind: "submitted", entryId: result.entryId });
    setBody("");
    setTitle("");
  }

  return (
    <section className="kb-contribution-editor" aria-labelledby="kb-contribution-heading">
      <header className="kb-contribution-header">
        <div>
          <p className="kb-eyebrow">Contribution Editor</p>
          <h2 id="kb-contribution-heading">
            {slot ? slot.title : "Contribute in this Knowledge Context"}
          </h2>
        </div>
        {isSlotTypeFixed ? (
          <span className="kb-contribution-fixed-type">
            <LockKeyhole aria-hidden="true" />
            {activeKnowledgeTypeLabel}
          </span>
        ) : null}
      </header>

      <ContributionContextTags context={context} />

      <form className="kb-contribution-form" onSubmit={handleSubmit}>
        <label className="kb-contribution-field">
          <span>Knowledge Type</span>
          <select
            disabled={isSlotTypeFixed}
            onChange={handleKnowledgeTypeChange}
            value={activeKnowledgeType}
          >
            {AUTHORABLE_KNOWLEDGE_TYPES.map((knowledgeType) => (
              <option key={knowledgeType} value={knowledgeType}>
                {formatKnowledgeTypeLabel(knowledgeType)}
              </option>
            ))}
          </select>
        </label>

        <label className="kb-contribution-field">
          <span>Title</span>
          <input
            onChange={(event) => setTitle(event.currentTarget.value)}
            placeholder={`${activeKnowledgeTypeLabel} title`}
            required
            type="text"
            value={title}
          />
        </label>

        <label className="kb-contribution-field">
          <span>Source</span>
          <textarea
            onChange={(event) => setBody(event.currentTarget.value)}
            placeholder={`Add ${activeKnowledgeTypeLabel} content`}
            required
            rows={5}
            value={body}
          />
        </label>

        <button
          className="kb-contribution-submit"
          disabled={submissionState.kind === "submitting"}
          type="submit"
        >
          {submissionState.kind === "submitting" ? (
            <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
          ) : (
            <Send aria-hidden="true" />
          )}
          <span>Submit {activeKnowledgeTypeLabel}</span>
        </button>
      </form>

      <Presence present={submissionState.kind === "submitted"}>
        {(presenceState) => (
          <p
            className="kb-contribution-status"
            data-presence={presenceState}
            role="status"
          >
            <CheckCircle2 aria-hidden="true" />
            Submitted
          </p>
        )}
      </Presence>
    </section>
  );
}

export function resolveContributionKnowledgeType({
  selectedKnowledgeType,
  slot,
  smartStorageProposedKnowledgeType,
}: ContributionKnowledgeTypeSources): AuthorableKnowledgeType {
  if (slot) {
    return slot.requestedKnowledgeType;
  }

  if (isAuthorableKnowledgeType(selectedKnowledgeType)) {
    return selectedKnowledgeType;
  }

  if (isAuthorableKnowledgeType(smartStorageProposedKnowledgeType)) {
    return smartStorageProposedKnowledgeType;
  }

  return "words";
}

export function createContributionInput({
  body,
  context,
  knowledgeType,
  slot,
  title,
}: {
  body: string;
  context: ActiveTag[];
  knowledgeType: AuthorableKnowledgeType;
  slot?: KnowledgeSlotSummary;
  title: string;
}): ContributionInput {
  return {
    body,
    contextTags: context,
    knowledgeType,
    slotId: slot?.id,
    title,
  };
}

function ContributionContextTags({ context }: { context: ActiveTag[] }) {
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
          <Tag aria-hidden="true" />
          <span>{tag.label}</span>
        </li>
      ))}
    </ul>
  );
}
