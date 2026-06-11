import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Check, Sparkles, Tag, X } from "lucide-react";
import {
  addActiveTag,
  createKnowledgeRequestDraft,
  resolveTag,
} from "./knowledgeContext";
import {
  formatKnowledgeTypeLabel,
  type ActiveTag,
  type KnowledgeRequestDraft,
} from "./knowledgeContracts";

type KnowledgeRequestComposerProps = {
  activeTags: ActiveTag[];
  initialDraft?: KnowledgeRequestDraft;
  onApplyMappedTags: (mappedTags: ActiveTag[]) => void;
};

type KnowledgeRequestTagRule = {
  patterns: RegExp[];
  tagId: string;
};

const KNOWLEDGE_REQUEST_TAG_RULES: KnowledgeRequestTagRule[] = [
  {
    tagId: "romans-8-28",
    patterns: [
      /\bromans\s*8(?::\s*28)?\b/,
      /\brom\s*8(?::\s*28)?\b/,
      /\ball things\b.*\bgood\b/,
    ],
  },
  {
    tagId: "john-3-16",
    patterns: [/\bjohn\s*3(?::\s*16)?\b/, /\beverlasting life\b/],
  },
  {
    tagId: "holy-spirit",
    patterns: [/\bholy spirit\b/, /\bspirit(?:'s)?\b/, /\bcomforter\b/],
  },
  {
    tagId: "atonement",
    patterns: [/\baton(e|ing|ement)\b/, /\bno condemnation\b/, /\bsacrifice\b/],
  },
  {
    tagId: "christian-education",
    patterns: [
      /\bchristian education\b/,
      /\bclassroom\b/,
      /\bschool\b/,
      /\bstudent\b/,
      /\bteacher\b/,
      /\byouth\b/,
    ],
  },
  {
    tagId: "narnia",
    patterns: [/\bnarnia\b/, /\baslan\b/],
  },
];

export function KnowledgeRequestComposer({
  activeTags,
  initialDraft,
  onApplyMappedTags,
}: KnowledgeRequestComposerProps) {
  const [draft, setDraft] = useState<KnowledgeRequestDraft>(
    () => initialDraft ?? createKnowledgeRequestDraft(),
  );
  const hasProposal = draft.mappingStatus === "proposed";
  const hasMappedTags = draft.mappedTags.length > 0;

  function handleRequestChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setDraft(updateKnowledgeRequestDraftText(draft, event.currentTarget.value));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDraft(submitKnowledgeRequestDraft(draft, activeTags));
  }

  function handleApplyProposal() {
    const nextDraft = applyKnowledgeRequestProposal(draft);
    setDraft(nextDraft);
    onApplyMappedTags(nextDraft.mappedTags);
  }

  function handleIgnoreProposal() {
    setDraft(ignoreKnowledgeRequestProposal(draft));
  }

  return (
    <div className="kb-request-composer">
      <form className="kb-request-composer-form" onSubmit={handleSubmit}>
        <label className="kb-request-field">
          <span>Knowledge Request</span>
          <textarea
            onChange={handleRequestChange}
            placeholder="Ask for knowledge..."
            rows={4}
            value={draft.text}
          />
        </label>
        <button className="kb-request-submit" type="submit">
          <Sparkles aria-hidden="true" />
          <span>Map Tags</span>
        </button>
      </form>

      {hasProposal ? (
        <section
          aria-label="Proposed mapped Tags"
          className="kb-request-proposal"
        >
          <header>
            <div>
              <p className="kb-eyebrow">Proposed Tags</p>
              <h3>Mapped Knowledge Context</h3>
            </div>
          </header>

          {hasMappedTags ? (
            <ul className="kb-proposed-tag-list">
              {draft.mappedTags.map((tag) => (
                <li key={tag.id}>
                  <Tag aria-hidden="true" />
                  <span>{tag.label}</span>
                  <small>{formatKnowledgeTypeLabel(tag.knowledgeType)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="kb-request-empty" role="status">
              No fixture Tags matched this Knowledge Request.
            </p>
          )}

          <div className="kb-request-actions">
            <button
              className="kb-request-action kb-request-action-primary"
              disabled={!hasMappedTags}
              onClick={handleApplyProposal}
              type="button"
            >
              <Check aria-hidden="true" />
              <span>Apply Tags</span>
            </button>
            <button
              className="kb-request-action"
              onClick={handleIgnoreProposal}
              type="button"
            >
              <X aria-hidden="true" />
              <span>Ignore</span>
            </button>
          </div>
        </section>
      ) : null}

      {draft.mappingStatus === "applied" ? (
        <p aria-live="polite" className="kb-request-status">
          Applied proposed Tags.
        </p>
      ) : null}
    </div>
  );
}

export function updateKnowledgeRequestDraftText(
  draft: KnowledgeRequestDraft,
  text: string,
): KnowledgeRequestDraft {
  return {
    ...draft,
    mappedTags: [],
    mappingStatus: "idle",
    text,
  };
}

export function submitKnowledgeRequestDraft(
  draft: KnowledgeRequestDraft,
  activeTags: ActiveTag[] = [],
): KnowledgeRequestDraft {
  if (!draft.text.trim()) {
    return {
      ...draft,
      mappedTags: [],
      mappingStatus: "idle",
    };
  }

  return {
    ...draft,
    mappedTags: mapKnowledgeRequestToTags(draft.text, activeTags),
    mappingStatus: "proposed",
  };
}

export function applyKnowledgeRequestProposal(
  draft: KnowledgeRequestDraft,
): KnowledgeRequestDraft {
  if (draft.mappingStatus !== "proposed") {
    return draft;
  }

  return {
    ...draft,
    mappingStatus: "applied",
  };
}

export function ignoreKnowledgeRequestProposal(
  draft: KnowledgeRequestDraft,
): KnowledgeRequestDraft {
  return {
    ...draft,
    mappedTags: [],
    mappingStatus: "idle",
  };
}

export function mapKnowledgeRequestToTags(
  requestText: string,
  activeTags: ActiveTag[] = [],
) {
  const normalizedText = requestText.toLowerCase();
  let mappedTags = activeTags.reduce<ActiveTag[]>(
    (tags, tag) => addActiveTag(tags, tag),
    [],
  );

  for (const rule of KNOWLEDGE_REQUEST_TAG_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalizedText))) {
      mappedTags = addActiveTag(mappedTags, resolveTag(rule.tagId));
    }
  }

  return mappedTags;
}
