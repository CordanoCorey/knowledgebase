import { BookOpen, Search, X } from "lucide-react";
import type { MouseEvent } from "react";
import { KnowledgeTypeBadge } from "./components/KnowledgeTypeIcon";
import {
  type ActiveTag,
  type AuthorableKnowledgeType,
  type KnowledgeType,
} from "./knowledgeContracts";

export type RootSearchResult = {
  canonicalKey: string;
  href: string;
  id: string;
  knowledgeType: KnowledgeType;
  label: string;
  matchedEntryPreview?: {
    href: string;
    id: string;
    knowledgeType: AuthorableKnowledgeType;
    previewText: string;
    primaryTagLabel: string;
    title: string;
  };
  scopeLabel: string;
  tag: ActiveTag;
};

type RootSearchResultsProps = {
  isLoading: boolean;
  onClearSearch: () => void;
  onNavigateToHref: (href: string) => void;
  query: string;
  results: RootSearchResult[];
};

export function RootSearchResults({
  isLoading,
  onClearSearch,
  onNavigateToHref,
  query,
  results,
}: RootSearchResultsProps) {
  const trimmedQuery = query.trim();
  const resultCountLabel = isLoading
    ? "Searching"
    : formatCount(results.length, "result");

  function handleResultClick(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    event.preventDefault();
    onNavigateToHref(href);
  }

  return (
    <section
      aria-labelledby="kb-root-search-results-heading"
      className="kb-root-search-results"
    >
      <header className="kb-root-search-results-header">
        <div>
          <p className="kb-eyebrow">Search Everything</p>
          <h2 id="kb-root-search-results-heading">
            {trimmedQuery ? `Results for "${trimmedQuery}"` : "Search Everything"}
          </h2>
        </div>
        <span>{resultCountLabel}</span>
      </header>

      {trimmedQuery ? (
        <div className="kb-feed-active-search" role="status">
          <span>Searching everything for "{trimmedQuery}"</span>
          <button
            aria-label="Clear root search"
            onClick={onClearSearch}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <p className="kb-root-search-status" role="status">
          Searching
        </p>
      ) : null}

      {!isLoading && results.length > 0 ? (
        <ol className="kb-root-search-result-list">
          {results.map((result) => (
            <li key={result.id}>
              <article
                aria-labelledby={`kb-root-search-result-${result.id}`}
                className="kb-root-search-result"
              >
                <header>
                  <div>
                    <p className="kb-card-eyebrow">Referent Page</p>
                    <h3 id={`kb-root-search-result-${result.id}`}>
                      <a
                        href={result.href}
                        onClick={(event) => handleResultClick(event, result.href)}
                      >
                        {result.label}
                      </a>
                    </h3>
                  </div>
                  <KnowledgeTypeBadge
                    className="kb-card-type"
                    knowledgeType={result.knowledgeType}
                  />
                </header>

                <dl className="kb-root-search-result-meta">
                  <div>
                    <dt>Scope</dt>
                    <dd>{result.scopeLabel}</dd>
                  </div>
                  <div>
                    <dt>Knowledge Type</dt>
                    <dd>
                      <KnowledgeTypeBadge knowledgeType={result.knowledgeType} />
                    </dd>
                  </div>
                </dl>

                {result.matchedEntryPreview ? (
                  <a
                    aria-label={`Open ${result.label} from matched preview ${result.matchedEntryPreview.title}`}
                    className="kb-root-search-preview"
                    href={result.href}
                    onClick={(event) => handleResultClick(event, result.href)}
                  >
                    <Search aria-hidden="true" />
                    <span>
                      <strong>{result.matchedEntryPreview.title}</strong>
                      <KnowledgeTypeBadge
                        className="kb-root-search-preview-type"
                        knowledgeType={result.matchedEntryPreview.knowledgeType}
                      />
                      <em>{result.matchedEntryPreview.previewText}</em>
                    </span>
                  </a>
                ) : null}

                <footer>
                  <a
                    className="kb-card-action"
                    href={result.href}
                    onClick={(event) => handleResultClick(event, result.href)}
                  >
                    <BookOpen aria-hidden="true" />
                    Open Page
                  </a>
                </footer>
              </article>
            </li>
          ))}
        </ol>
      ) : null}

      {!isLoading && trimmedQuery && results.length === 0 ? (
        <section className="kb-feed-empty" role="status">
          <h3>No Referent Pages match this search yet.</h3>
          <p>Try different wording or select an existing Tag suggestion.</p>
        </section>
      ) : null}
    </section>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
