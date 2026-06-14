import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Check, Sparkles, X } from "lucide-react";
import {
  addActiveTag,
  createKnowledgeRequestDraft,
  resolveTag,
} from "./knowledgeContext";
import {
  type ActiveTag,
  type KnowledgeRequestDraft,
} from "./knowledgeContracts";
import { KnowledgeTypeBadge } from "./components/KnowledgeTypeIcon";
import { ReferentTagLink } from "./components/ReferentTagLink";
import { Presence } from "./Presence";

type KnowledgeRequestComposerProps = {
  activeTags: ActiveTag[];
  initialDraft?: KnowledgeRequestDraft;
  onApplyMappedTags: (mappedTags: ActiveTag[]) => void;
  onNavigateToHref?: (href: string) => void;
};

type KnowledgeRequestTagRule = {
  patterns: RegExp[];
  tagId: string;
};

const KNOWLEDGE_REQUEST_TAG_RULES: KnowledgeRequestTagRule[] = [
  {
    tagId: "matthew-5-9",
    patterns: [/\bmatthew\s*5(?::\s*9)?\b/, /\bpeacemakers?\b/],
  },
  {
    tagId: "joshua-1-6-9",
    patterns: [
      /\bjoshua\s*1(?::\s*6(?:\s*-\s*9)?)?\b/,
      /\bbe strong and courageous\b/,
    ],
  },
  {
    tagId: "romans-8-28",
    patterns: [
      /\bromans\s*8(?::\s*28)?\b/,
      /\brom\s*8(?::\s*28)?\b/,
      /\ball things\b.*\bgood\b/,
    ],
  },
  {
    tagId: "daniel-3",
    patterns: [/\bdaniel\s*3\b/, /\btrial by fire\b/, /\bfiery furnace\b/],
  },
  {
    tagId: "daniel-4",
    patterns: [/\bdaniel\s*4\b/, /\bpride leads to death\b/, /\bnebuchadnezzar\b/],
  },
  {
    tagId: "first-crusade",
    patterns: [/\bfirst crusade\b/, /\bcrusades?\b/],
  },
  {
    tagId: "the-city-of-god",
    patterns: [/\bcity of god\b/, /\baugustine\b/, /\bordered loves?\b/],
  },
  {
    tagId: "boethius",
    patterns: [/\bboethius\b/, /\bconsolation of philosophy\b/, /\bfortune\b/],
  },
  {
    tagId: "providence",
    patterns: [/\bprovidence\b/, /\bprovidential\b/],
  },
  {
    tagId: "courage",
    patterns: [/\bcourage\b/, /\bcourageous\b/, /\bvirtues?\b/],
  },
  {
    tagId: "cs-lewis",
    patterns: [/\bc\.?\s*s\.?\s*lewis\b/, /\blewis\b/],
  },
  {
    tagId: "gk-chesterton",
    patterns: [/\bg\.?\s*k\.?\s*chesterton\b/, /\bchesterton\b/],
  },
  {
    tagId: "grade-9-church-history",
    patterns: [
      /\bgrade\s*9\b/,
      /\bninth grade\b/,
      /\bchurch history\b/,
    ],
  },
  {
    tagId: "grade-10-medieval-literature",
    patterns: [
      /\bgrade\s*10\b/,
      /\btenth grade\b/,
      /\bmedieval literature\b/,
    ],
  },
];

export function KnowledgeRequestComposer({
  activeTags,
  initialDraft,
  onApplyMappedTags,
  onNavigateToHref,
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

      <Presence present={hasProposal}>
        {(presenceState) => (
          <section
            aria-label="Proposed mapped Tags"
            className="kb-request-proposal"
            data-presence={presenceState}
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
                    <ReferentTagLink
                      onNavigateToHref={onNavigateToHref}
                      tag={tag}
                    >
                      <span>{tag.label}</span>
                      <KnowledgeTypeBadge
                        className="kb-proposed-tag-type"
                        knowledgeType={tag.knowledgeType}
                      />
                    </ReferentTagLink>
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
        )}
      </Presence>

      <Presence present={draft.mappingStatus === "applied"}>
        {(presenceState) => (
          <p
            aria-live="polite"
            className="kb-request-status"
            data-presence={presenceState}
          >
            Applied proposed Tags.
          </p>
        )}
      </Presence>
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
