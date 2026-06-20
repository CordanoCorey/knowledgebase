import {
  useMemo,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { Search } from "lucide-react";
import {
  addActiveTag,
  createKnowledgeRequestDraft,
  NAVIGATOR_TAG_FIXTURES,
  resolveTag,
} from "./knowledgeContext";
import {
  type ActiveTag,
  type KnowledgeRequestDraft,
} from "./knowledgeContracts";
import { KnowledgeTypeBadge } from "./components/KnowledgeTypeIcon";

type KnowledgeNavigatorQueryInputProps = {
  activeTags: ActiveTag[];
  initialDraft?: KnowledgeRequestDraft;
  onApplyMappedTags: (mappedTags: ActiveTag[]) => void;
  onQueryTextChange?: (queryText: string) => void;
  onSearchContext?: (query: string) => void;
  suggestions?: KnowledgeNavigatorQuerySuggestion[];
};

type KnowledgeRequestTagRule = {
  patterns: RegExp[];
  tagId: string;
};

export type KnowledgeNavigatorQuerySuggestion = {
  id: string;
  matchKind: "alias" | "label" | "rule";
  tag: ActiveTag;
};

export type KnowledgeRequestSuggestion = KnowledgeNavigatorQuerySuggestion;

const KNOWLEDGE_REQUEST_SUGGESTION_LIMIT = 5;
const KNOWLEDGE_NAVIGATOR_QUERY_PLACEHOLDER = "Search or add tag";

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
  {
    tagId: "student-crusades-question",
    patterns: [
      /\bmicah\b/,
      /\bstudent crusades question\b/,
      /\bcrusades question\b/,
    ],
  },
];

export function KnowledgeNavigatorQueryInput({
  activeTags,
  initialDraft,
  onApplyMappedTags,
  onQueryTextChange,
  onSearchContext,
  suggestions: liveSuggestions,
}: KnowledgeNavigatorQueryInputProps) {
  const [draft, setDraft] = useState<KnowledgeRequestDraft>(
    () => initialDraft ?? createKnowledgeRequestDraft(),
  );
  const [isQueryFocused, setIsQueryFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] =
    useState<number | null>(null);
  const fallbackSuggestions = useMemo(
    () => getKnowledgeNavigatorQuerySuggestions(draft.text, activeTags),
    [activeTags, draft.text],
  );
  const suggestions = getVisibleKnowledgeNavigatorQuerySuggestions(
    liveSuggestions,
    fallbackSuggestions,
  );
  const isSuggestionListOpen =
    isQueryFocused && draft.text.trim().length > 0 && suggestions.length > 0;

  function handleRequestChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextText = event.currentTarget.value;
    setDraft(updateKnowledgeRequestDraftText(draft, nextText));
    onQueryTextChange?.(nextText);
    setActiveSuggestionIndex(null);
  }

  function handleComposerBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsQueryFocused(false);
    setActiveSuggestionIndex(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitContextSearch();
  }

  function handleRequestKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (isSuggestionListOpen && activeSuggestionIndex !== null) {
        selectSuggestion(suggestions[activeSuggestionIndex]);
        return;
      }

      submitContextSearch();
      return;
    }

    if (!isSuggestionListOpen) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        currentIndex === null
          ? 0
          : Math.min(currentIndex + 1, suggestions.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((currentIndex) =>
        currentIndex === null
          ? suggestions.length - 1
          : Math.max(currentIndex - 1, 0),
      );
      return;
    }

    if (event.key === "Escape") {
      setActiveSuggestionIndex(null);
      setIsQueryFocused(false);
    }
  }

  function handleSuggestionClick(
    event: MouseEvent<HTMLButtonElement>,
    suggestion: KnowledgeRequestSuggestion,
  ) {
    event.preventDefault();
    selectSuggestion(suggestion);
  }

  function selectSuggestion(suggestion: KnowledgeRequestSuggestion | undefined) {
    if (!suggestion) {
      return;
    }

    const nextTags = addActiveTag(activeTags, suggestion.tag);
    onApplyMappedTags(nextTags);
    setDraft(createKnowledgeRequestDraft());
    onQueryTextChange?.("");
    setActiveSuggestionIndex(null);
    setIsQueryFocused(false);
  }

  function submitContextSearch() {
    const searchQuery = draft.text.trim();
    if (!searchQuery) {
      return;
    }

    onSearchContext?.(searchQuery);
    setDraft(createKnowledgeRequestDraft());
    onQueryTextChange?.("");
    setActiveSuggestionIndex(null);
  }

  return (
    <div className="kb-request-composer" onBlur={handleComposerBlur}>
      <form className="kb-request-composer-form" onSubmit={handleSubmit}>
        <label className="kb-request-field">
          <span>Knowledge Navigator Query Input</span>
          <textarea
            aria-activedescendant={
              activeSuggestionIndex !== null && isSuggestionListOpen
                ? `kb-request-suggestion-${suggestions[activeSuggestionIndex].id}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls="kb-request-suggestions"
            aria-expanded={isSuggestionListOpen}
            onChange={handleRequestChange}
            onFocus={() => setIsQueryFocused(true)}
            onKeyDown={handleRequestKeyDown}
            placeholder={KNOWLEDGE_NAVIGATOR_QUERY_PLACEHOLDER}
            rows={4}
            value={draft.text}
          />
        </label>
        <button className="kb-request-submit" type="submit">
          <Search aria-hidden="true" />
          <span>Search Context</span>
        </button>
      </form>

      {isSuggestionListOpen ? (
        <div
          aria-label="Knowledge Navigator Query Input suggestions"
          className="kb-request-suggestions"
          id="kb-request-suggestions"
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <button
              aria-selected={activeSuggestionIndex === index}
              className="kb-request-suggestion"
              data-suggestion-id={suggestion.id}
              id={`kb-request-suggestion-${suggestion.id}`}
              key={suggestion.id}
              onClick={(event) => handleSuggestionClick(event, suggestion)}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
              role="option"
              type="button"
            >
              <span>{suggestion.tag.label}</span>
              <KnowledgeTypeBadge
                className="kb-request-suggestion-type"
                knowledgeType={suggestion.tag.knowledgeType}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const KnowledgeRequestComposer = KnowledgeNavigatorQueryInput;

function getVisibleKnowledgeNavigatorQuerySuggestions(
  liveSuggestions: KnowledgeNavigatorQuerySuggestion[] | undefined,
  fallbackSuggestions: KnowledgeNavigatorQuerySuggestion[],
) {
  return liveSuggestions && liveSuggestions.length > 0
    ? liveSuggestions
    : fallbackSuggestions;
}

export function getKnowledgeNavigatorQuerySuggestions(
  requestText: string,
  activeTags: ActiveTag[] = [],
  limit = KNOWLEDGE_REQUEST_SUGGESTION_LIMIT,
): KnowledgeNavigatorQuerySuggestion[] {
  const normalizedText = normalizeKnowledgeRequestText(requestText);
  if (!normalizedText || limit <= 0) {
    return [];
  }

  const activeTagIds = new Set(activeTags.map((tag) => tag.id));
  const suggestions: KnowledgeNavigatorQuerySuggestion[] = [];
  const suggestedTagIds = new Set<string>();

  function addSuggestion(
    tag: ActiveTag,
    matchKind: KnowledgeNavigatorQuerySuggestion["matchKind"],
  ) {
    if (activeTagIds.has(tag.id) || suggestedTagIds.has(tag.id)) {
      return;
    }

    suggestions.push({
      id: tag.id,
      matchKind,
      tag,
    });
    suggestedTagIds.add(tag.id);
  }

  for (const tag of NAVIGATOR_TAG_FIXTURES) {
    const normalizedLabel = normalizeKnowledgeRequestText(tag.label);
    const normalizedId = normalizeKnowledgeRequestText(tag.id.replaceAll("-", " "));
    if (
      normalizedLabel.includes(normalizedText) ||
      normalizedId.includes(normalizedText)
    ) {
      addSuggestion(tag, "label");
    }
  }

  for (const rule of KNOWLEDGE_REQUEST_TAG_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalizedText))) {
      addSuggestion(resolveTag(rule.tagId), "rule");
    }
  }

  return suggestions.slice(0, limit);
}

export const getKnowledgeRequestSuggestions = getKnowledgeNavigatorQuerySuggestions;

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
  const normalizedText = normalizeKnowledgeRequestText(requestText);
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

function normalizeKnowledgeRequestText(text: string) {
  return text.trim().toLowerCase();
}
