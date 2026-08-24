// PROTOTYPE: Three missing-knowledge journeys, switchable via `?variant=`,
// on a read-only Root Search host at `?prototype=missing-knowledge-journey`.
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Compass,
  FileQuestion,
  Home,
  Menu,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Tag,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./missingKnowledgeJourneyPrototype.css";

type ThemePreference = "light" | "dark";
type VariantKey = "A" | "B" | "C";
type Scenario = "namedThing" | "missingAnswer";
type JourneyStage =
  | "search"
  | "choose"
  | "identity"
  | "question"
  | "slot"
  | "complete";
type CompletionKind = "referent" | "slot" | null;
type Audience = "open" | "experts";
type IdentityDecision = "different" | "same";
type QuestionResolution = "existing" | "new" | null;

type Expert = {
  detail: string;
  id: string;
  initials: string;
  name: string;
};

type JourneyState = {
  answerType: "Words" | "Essay" | "Book" | "Sermon";
  audience: Audience;
  completionKind: CompletionKind;
  identityDecision: IdentityDecision;
  namedThingType: "Topic" | "Person" | "Place" | "Book";
  query: string;
  questionResolution: QuestionResolution;
  scenario: Scenario;
  selectedExpertIds: string[];
  stage: JourneyStage;
};

type MissingKnowledgeJourneyPrototypeProps = {
  onToggleTheme: () => void;
  theme: ThemePreference;
};

type JourneyVariantProps = {
  actions: JourneyActions;
  state: JourneyState;
};

type JourneyActions = {
  acceptSmartStorageProposal: () => void;
  chooseMissingAnswer: () => void;
  chooseNamedThing: () => void;
  confirmIdentity: () => void;
  createQuestion: () => void;
  openExistingQuestion: () => void;
  reset: () => void;
  search: () => void;
  setAnswerType: (answerType: JourneyState["answerType"]) => void;
  setAudience: (audience: Audience) => void;
  setIdentityDecision: (identityDecision: IdentityDecision) => void;
  setNamedThingType: (namedThingType: JourneyState["namedThingType"]) => void;
  setQuery: (query: string) => void;
  startSmartStorage: () => void;
  submitSlot: () => void;
  toggleExpert: (expertId: string) => void;
};

const VARIANTS: Array<{
  key: VariantKey;
  label: string;
}> = [
  { key: "A", label: "Progressive result" },
  { key: "B", label: "Persistent journey" },
  { key: "C", label: "Smart Storage handoff" },
];

const EXPERTS: Expert[] = [
  {
    detail: "Strong in Desert Fathers and early Christian practice",
    id: "expert-mara",
    initials: "MD",
    name: "Mara Demos",
  },
  {
    detail: "Frequently answers within Attention and Prayer",
    id: "expert-jonah",
    initials: "JR",
    name: "Jonah Reed",
  },
  {
    detail: "Contributed three relevant source collections",
    id: "expert-simone",
    initials: "SB",
    name: "Simone Bell",
  },
];

const SAMPLE_QUERIES: Record<Scenario, string> = {
  namedThing: "J.R.R. Tolkien",
  missingAnswer: "How did the Desert Fathers understand attention?",
};

const STAGE_LABELS: Record<JourneyStage, string> = {
  search: "Search",
  choose: "No results",
  identity: "Smart Storage review",
  question: "Smart Storage review",
  slot: "Question page",
  complete: "Done",
};

function createInitialState(scenario: Scenario): JourneyState {
  return {
    answerType: "Words",
    audience: "open",
    completionKind: null,
    identityDecision: "different",
    namedThingType: scenario === "namedThing" ? "Person" : "Topic",
    query: SAMPLE_QUERIES[scenario],
    questionResolution: null,
    scenario,
    selectedExpertIds: [EXPERTS[0].id, EXPERTS[1].id],
    stage: "search",
  };
}

export function MissingKnowledgeJourneyPrototype({
  onToggleTheme,
  theme,
}: MissingKnowledgeJourneyPrototypeProps) {
  const [variant, setVariant] = useState<VariantKey>(() => readVariant());
  const [state, setState] = useState<JourneyState>(() =>
    createInitialState("namedThing"),
  );

  const switchVariant = useCallback((nextVariant: VariantKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("prototype", "missing-knowledge-journey");
    url.searchParams.set("variant", nextVariant);
    window.history.replaceState({}, "", url);
    setVariant(nextVariant);
  }, []);

  const cycleVariant = useCallback(
    (direction: -1 | 1) => {
      const index = VARIANTS.findIndex((item) => item.key === variant);
      const nextIndex = (index + direction + VARIANTS.length) % VARIANTS.length;
      switchVariant(VARIANTS[nextIndex].key);
    },
    [switchVariant, variant],
  );

  useEffect(() => {
    function handlePopState() {
      setVariant(readVariant());
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        cycleVariant(-1);
      } else if (event.key === "ArrowRight") {
        cycleVariant(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [cycleVariant]);

  const actions = useMemo<JourneyActions>(
    () => ({
      acceptSmartStorageProposal: () =>
        setState((current) =>
          current.stage === "question"
            ? {
                ...current,
                questionResolution: "new",
                stage: "slot",
              }
            : {
                ...current,
                completionKind: "referent",
                stage: "complete",
              },
        ),
      chooseMissingAnswer: () =>
        setState((current) => ({
          ...current,
          scenario: "missingAnswer",
          stage: "question",
        })),
      chooseNamedThing: () =>
        setState((current) => ({
          ...current,
          scenario: "namedThing",
          stage: "identity",
        })),
      confirmIdentity: () =>
        setState((current) => ({
          ...current,
          completionKind: "referent",
          stage: "complete",
        })),
      createQuestion: () =>
        setState((current) => ({
          ...current,
          questionResolution: "new",
          stage: "slot",
        })),
      openExistingQuestion: () =>
        setState((current) => ({
          ...current,
          questionResolution: "existing",
          stage: "slot",
        })),
      reset: () => setState(createInitialState(state.scenario)),
      search: () =>
        setState((current) => ({
          ...current,
          completionKind: null,
          questionResolution: null,
          stage: "choose",
        })),
      setAnswerType: (answerType) =>
        setState((current) => ({ ...current, answerType })),
      setAudience: (audience) =>
        setState((current) => ({ ...current, audience })),
      setIdentityDecision: (identityDecision) =>
        setState((current) => ({ ...current, identityDecision })),
      setNamedThingType: (namedThingType) =>
        setState((current) => ({ ...current, namedThingType })),
      setQuery: (query) => setState((current) => ({ ...current, query })),
      startSmartStorage: () =>
        setState((current) => {
          const proposal = inferSmartStorageProposal(current.query);
          return proposal === "Question"
            ? {
                ...current,
                scenario: "missingAnswer",
                stage: "question",
              }
            : {
                ...current,
                namedThingType: proposal,
                scenario: "namedThing",
                stage: "identity",
              };
        }),
      submitSlot: () =>
        setState((current) => ({
          ...current,
          completionKind: "slot",
          stage: "complete",
        })),
      toggleExpert: (expertId) =>
        setState((current) => ({
          ...current,
          selectedExpertIds: current.selectedExpertIds.includes(expertId)
            ? current.selectedExpertIds.filter((id) => id !== expertId)
            : [...current.selectedExpertIds, expertId],
        })),
    }),
    [state.scenario],
  );

  const activeVariant = VARIANTS.find((item) => item.key === variant) ?? VARIANTS[0];

  return (
    <main className="mkjp-root" data-theme={theme}>
      <PrototypeFrame
        onChangeScenario={(scenario) => setState(createInitialState(scenario))}
        onToggleTheme={onToggleTheme}
        scenario={state.scenario}
        theme={theme}
      >
        {variant === "A" ? <ProgressiveResultVariant actions={actions} state={state} /> : null}
        {variant === "B" ? <PersistentJourneyVariant actions={actions} state={state} /> : null}
        {variant === "C" ? <SmartStorageHandoffVariant actions={actions} state={state} /> : null}
        <StatePanel state={state} />
      </PrototypeFrame>

      <PrototypeSwitcher
        current={variant}
        label={activeVariant.label}
        onNext={() => cycleVariant(1)}
        onPrevious={() => cycleVariant(-1)}
      />
    </main>
  );
}

function PrototypeFrame({
  children,
  onChangeScenario,
  onToggleTheme,
  scenario,
  theme,
}: {
  children: React.ReactNode;
  onChangeScenario: (scenario: Scenario) => void;
  onToggleTheme: () => void;
  scenario: Scenario;
  theme: ThemePreference;
}) {
  return (
    <div className="mkjp-app-frame">
      <aside aria-label="Primary navigation" className="mkjp-rail">
        <div className="mkjp-mark">L</div>
        <button aria-label="Dashboard" type="button">
          <Home aria-hidden="true" />
        </button>
        <button aria-current="page" aria-label="Search Everything" type="button">
          <Search aria-hidden="true" />
        </button>
        <button aria-label="Add knowledge" type="button">
          <Plus aria-hidden="true" />
        </button>
        <span className="mkjp-rail-spacer" />
        <button aria-label="Profile" type="button">
          <UserRound aria-hidden="true" />
        </button>
      </aside>

      <section className="mkjp-app-body">
        <header className="mkjp-app-header">
          <div className="mkjp-page-identity">
            <button aria-label="Open place navigator" type="button">
              <Menu aria-hidden="true" />
            </button>
            <div>
              <p>Accessible Root Knowledge Context</p>
              <strong>Search Everything</strong>
            </div>
          </div>
          <div className="mkjp-header-actions">
            <span className="mkjp-role-summary">Member · Teacher</span>
            <button
              aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
              onClick={onToggleTheme}
              type="button"
            >
              {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
          </div>
        </header>

        <div className="mkjp-prototype-toolbar">
          <span>Prototype sample</span>
          <div role="group" aria-label="Prototype scenario">
            <button
              aria-label="Missing named thing"
              aria-pressed={scenario === "namedThing"}
              onClick={() => onChangeScenario("namedThing")}
              type="button"
            >
              Missing named thing
            </button>
            <button
              aria-label="Missing answer"
              aria-pressed={scenario === "missingAnswer"}
              onClick={() => onChangeScenario("missingAnswer")}
              type="button"
            >
              Missing answer
            </button>
          </div>
        </div>

        <div className="mkjp-variant-host">{children}</div>
      </section>
    </div>
  );
}

function ProgressiveResultVariant({ actions, state }: JourneyVariantProps) {
  return (
    <section className="mkjp-variant mkjp-progressive" aria-labelledby="mkjp-a-heading">
      <header className="mkjp-variant-heading">
        <div>
          <p className="mkjp-eyebrow">A · Progressive result</p>
          <h1 id="mkjp-a-heading">Keep the next action where the result should be</h1>
        </div>
        <StagePill stage={state.stage} />
      </header>

      <SearchBar actions={actions} state={state} />

      <div className="mkjp-progressive-body">
        <ol className="mkjp-horizontal-steps" aria-label="Journey progress">
          {getJourneySteps(state).map((step) => (
            <li data-active={step.stage === state.stage} data-complete={step.complete} key={step.stage}>
              <span>{step.complete ? <Check aria-hidden="true" /> : step.index}</span>
              {step.label}
            </li>
          ))}
        </ol>
        <JourneyPanel actions={actions} state={state} surface="progressive" />
      </div>
    </section>
  );
}

function PersistentJourneyVariant({ actions, state }: JourneyVariantProps) {
  const steps = getJourneySteps(state);

  return (
    <section className="mkjp-variant mkjp-persistent" aria-labelledby="mkjp-b-heading">
      <aside className="mkjp-persistent-nav">
        <p className="mkjp-eyebrow">B · Persistent journey</p>
        <h1 id="mkjp-b-heading">Keep the route visible</h1>
        <p>Search stays anchored while identity, Question, and request decisions occupy a stable workspace.</p>
        <ol aria-label="Journey progress">
          {steps.map((step) => (
            <li data-active={step.stage === state.stage} data-complete={step.complete} key={step.stage}>
              <span>{step.complete ? <Check aria-hidden="true" /> : step.index}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{getStepDetail(step.stage)}</small>
              </div>
            </li>
          ))}
        </ol>
        <button className="mkjp-text-button" onClick={actions.reset} type="button">
          Start over
        </button>
      </aside>

      <div className="mkjp-persistent-main">
        <SearchBar actions={actions} state={state} compact />
        <JourneyPanel actions={actions} state={state} surface="persistent" />
      </div>

      <aside className="mkjp-outcome-preview" aria-label="Outcome preview">
        <p className="mkjp-eyebrow">Outcome preview</p>
        <OutcomePreview state={state} />
      </aside>
    </section>
  );
}

function SmartStorageHandoffVariant({ actions, state }: JourneyVariantProps) {
  if (state.stage === "identity" || state.stage === "question") {
    return <SmartStorageProposalReview actions={actions} state={state} />;
  }

  if (state.stage === "slot") {
    return <QuestionPageAfterSmartStorage actions={actions} state={state} />;
  }

  if (state.stage === "complete") {
    return (
      <section className="mkjp-variant mkjp-c-complete" aria-labelledby="mkjp-c-heading">
        <header className="mkjp-variant-heading">
          <div>
            <p className="mkjp-eyebrow">C · Smart Storage handoff</p>
            <h1 id="mkjp-c-heading">Open the saved destination</h1>
          </div>
        </header>
        <div className="mkjp-progressive-body">
          <Completion actions={actions} state={state} surface="smart-storage" />
        </div>
      </section>
    );
  }

  return (
    <section className="mkjp-variant mkjp-c-root-search" aria-labelledby="mkjp-c-heading">
      <header className="mkjp-variant-heading">
        <div>
          <p className="mkjp-eyebrow">C · Smart Storage handoff</p>
          <h1 id="mkjp-c-heading">Search first. Save only when nothing matches.</h1>
        </div>
        <span className="mkjp-stage-pill">Root Search</span>
      </header>

      <SearchBar actions={actions} state={state} />

      <section className="mkjp-c-results" aria-live="polite">
        {state.stage === "search" ? (
          <div className="mkjp-c-search-idle">
            <Search aria-hidden="true" />
            <h2>Find an existing Tag</h2>
            <p>Root Search checks accessible Tags by canonical name and alias.</p>
          </div>
        ) : (
          <SingleSmartStorageEmptyState actions={actions} state={state} />
        )}
      </section>
    </section>
  );
}

function SingleSmartStorageEmptyState({ actions, state }: JourneyVariantProps) {
  return (
    <section className="mkjp-c-empty" aria-labelledby="mkjp-c-empty-heading">
      <div className="mkjp-c-empty-count">
        <span>0</span>
        <small>matching Tags</small>
      </div>
      <div className="mkjp-c-empty-copy">
        <p className="mkjp-eyebrow">No accessible Referent matched</p>
        <h2 id="mkjp-c-empty-heading">Nothing found for “{state.query}”</h2>
        <p>
          Smart Storage can identify what this is and use the normal review
          workflow before anything is saved.
        </p>
      </div>
      <button
        aria-label="Save with Smart Storage"
        className="mkjp-primary-button mkjp-c-save-button"
        onClick={actions.startSmartStorage}
        type="button"
      >
        <Sparkles aria-hidden="true" />
        Save with Smart Storage
      </button>
    </section>
  );
}

function SmartStorageProposalReview({ actions, state }: JourneyVariantProps) {
  const isQuestion = state.stage === "question";
  const knowledgeType = isQuestion ? "Question" : state.namedThingType;
  const entryTitle = isQuestion ? normalizeQuestion(state.query) : state.query;

  return (
    <section
      aria-labelledby="mkjp-smart-storage-heading"
      className="mkjp-variant mkjp-smart-storage-review"
    >
      <header className="mkjp-smart-storage-header">
        <div>
          <p className="mkjp-eyebrow">Normal Smart Storage workflow</p>
          <h1 id="mkjp-smart-storage-heading">Review one suggested {knowledgeType}</h1>
        </div>
        <button aria-label="Cancel Smart Storage" onClick={actions.reset} type="button">
          <X aria-hidden="true" />
        </button>
      </header>

      <ol className="mkjp-smart-storage-progress" aria-label="Smart Storage progress">
        <li data-state="complete"><Check aria-hidden="true" /><span><strong>Input</strong><small>Captured</small></span></li>
        <li data-state="active"><Sparkles aria-hidden="true" /><span><strong>Review</strong><small>Suggested {knowledgeType}</small></span></li>
        <li data-state="pending"><BookOpen aria-hidden="true" /><span><strong>Save</strong><small>Waiting for acceptance</small></span></li>
      </ol>

      <section className="mkjp-smart-proposal">
        <header>
          <span className="mkjp-smart-proposal-icon">
            {isQuestion ? <FileQuestion aria-hidden="true" /> : <UserRound aria-hidden="true" />}
          </span>
          <div>
            <p className="mkjp-eyebrow">Smart Storage suggests {knowledgeType}</p>
            <h2>{entryTitle}</h2>
          </div>
          <span className="mkjp-confidence">High confidence</span>
        </header>

        <dl className="mkjp-smart-facts">
          <div><dt>Knowledge Type</dt><dd>{knowledgeType}</dd></div>
          <div><dt>Identity check</dt><dd>No Known Referent matched</dd></div>
          <div><dt>Primary result</dt><dd>One {knowledgeType} Knowledge Entry</dd></div>
        </dl>

        <details className="mkjp-machinery">
          <summary>Why did Smart Storage suggest {knowledgeType}?</summary>
          <p>
            The submitted name, punctuation, and surrounding identity evidence
            best match the {knowledgeType} contract. No accessible canonical
            name or alias resolved to an existing Known Referent.
          </p>
        </details>

        <section className="mkjp-atomic-preview" aria-labelledby="mkjp-atomic-heading">
          <div>
            <p className="mkjp-eyebrow">Accepted together</p>
            <h3 id="mkjp-atomic-heading">One atomic Gold-layer write</h3>
            <p>If any part fails, none of these records remain saved.</p>
          </div>
          <ol>
            <li><BookOpen aria-hidden="true" /><span><strong>Knowledge Entry</strong><small>{knowledgeType}: {entryTitle}</small></span></li>
            <li><ArrowRight aria-hidden="true" className="mkjp-atomic-arrow" /></li>
            <li><Tag aria-hidden="true" /><span><strong>Represented Referent</strong><small>{entryTitle}</small></span></li>
            <li><ArrowRight aria-hidden="true" className="mkjp-atomic-arrow" /></li>
            <li><Tag aria-hidden="true" /><span><strong>Canonical Tag</strong><small>{entryTitle}</small></span></li>
          </ol>
        </section>
      </section>

      <footer className="mkjp-smart-storage-actions">
        <button className="mkjp-secondary-button" onClick={actions.reset} type="button">Cancel</button>
        <button
          aria-label={`Accept ${knowledgeType}`}
          className="mkjp-primary-button"
          onClick={actions.acceptSmartStorageProposal}
          type="button"
        >
          Accept {knowledgeType}
          <ArrowRight aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}

function QuestionPageAfterSmartStorage({ actions, state }: JourneyVariantProps) {
  return (
    <section className="mkjp-variant mkjp-question-after-storage" aria-labelledby="mkjp-question-page-heading">
      <header>
        <div>
          <p className="mkjp-eyebrow">Question Knowledge Page</p>
          <h1 id="mkjp-question-page-heading">{normalizeQuestion(state.query)}</h1>
          <span className="mkjp-saved-badge"><Check aria-hidden="true" /> Saved through Smart Storage</span>
        </div>
        <button className="mkjp-secondary-button" type="button">Open Question</button>
      </header>

      <div className="mkjp-question-page-grid">
        <section className="mkjp-question-answer-feed" aria-labelledby="mkjp-question-feed-heading">
          <p className="mkjp-eyebrow">Answer Feed</p>
          <h2 id="mkjp-question-feed-heading">No Answers yet</h2>
          <p>The Question exists now. Requesting an Answer is a separate action on this page, not another Root Search branch.</p>
        </section>
        <KnowledgeSlotForm actions={actions} state={state} surface="question-page" />
      </div>
    </section>
  );
}

function SearchBar({
  actions,
  compact = false,
  focus = false,
  state,
}: JourneyVariantProps & { compact?: boolean; focus?: boolean }) {
  return (
    <form
      className="mkjp-search-bar"
      data-compact={compact}
      data-focus={focus}
      onSubmit={(event) => {
        event.preventDefault();
        actions.search();
      }}
    >
      <label>
        <span>Search Everything</span>
        <div>
          <Search aria-hidden="true" />
          <input
            aria-label="Search Everything"
            onChange={(event) => actions.setQuery(event.currentTarget.value)}
            placeholder="Find a Tag by name or alias"
            value={state.query}
          />
          {state.query ? (
            <button aria-label="Clear search" onClick={() => actions.setQuery("")} type="button">
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </label>
      <button
        aria-label="Search"
        className="mkjp-primary-button"
        disabled={!state.query.trim()}
        type="submit"
      >
        Search
      </button>
    </form>
  );
}

function JourneyPanel({
  actions,
  state,
  surface,
}: JourneyVariantProps & { surface: "focused" | "persistent" | "progressive" }) {
  if (state.stage === "search") {
    if (surface === "focused") {
      return (
        <div className="mkjp-focus-prompt">
          <p>Search finds accessible Tags by name or alias. Try the sample above.</p>
        </div>
      );
    }

    return (
      <section className="mkjp-idle-panel">
        <Compass aria-hidden="true" />
        <h2>Find the place first</h2>
        <p>Existing Tags open their Knowledge Pages. An unmatched search gets one short handoff.</p>
      </section>
    );
  }

  if (state.stage === "choose") {
    return <IntentChoice actions={actions} state={state} surface={surface} />;
  }

  if (state.stage === "identity") {
    return <IdentityConfirmation actions={actions} state={state} surface={surface} />;
  }

  if (state.stage === "question") {
    return <QuestionContextChoice actions={actions} state={state} surface={surface} />;
  }

  if (state.stage === "slot") {
    return <KnowledgeSlotForm actions={actions} state={state} surface={surface} />;
  }

  return <Completion actions={actions} state={state} surface={surface} />;
}

function IntentChoice({
  actions,
  state,
  surface,
}: JourneyVariantProps & { surface: string }) {
  return (
    <section className="mkjp-decision-panel" data-surface={surface} aria-labelledby={`mkjp-intent-${surface}`}>
      <header>
        <div className="mkjp-empty-icon"><Search aria-hidden="true" /></div>
        <div>
          <p className="mkjp-eyebrow">No accessible Tag matched</p>
          <h2 id={`mkjp-intent-${surface}`}>What is missing?</h2>
          <p>“{state.query}” can become a place, or a request for an answer. It is not created just because you searched.</p>
        </div>
      </header>
      <div className="mkjp-intent-options">
        <button onClick={actions.chooseNamedThing} type="button">
          <Tag aria-hidden="true" />
          <span>
            <strong>Add a named thing</strong>
            <small>Confirm what it is, then create its Knowledge Page.</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
        <button aria-label="Request an answer" onClick={actions.chooseMissingAnswer} type="button">
          <CircleHelp aria-hidden="true" />
          <span>
            <strong>Request an answer</strong>
            <small>Enter or create a Question context, then direct one Knowledge Slot.</small>
          </span>
          <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function IdentityConfirmation({
  actions,
  state,
  surface,
}: JourneyVariantProps & { surface: string }) {
  const existingLabel = state.query.toLowerCase().includes("desert")
    ? "Desert spirituality"
    : `${state.query} overview`;

  return (
    <section className="mkjp-decision-panel" data-surface={surface} aria-labelledby={`mkjp-identity-${surface}`}>
      <header>
        <div className="mkjp-empty-icon"><Sparkles aria-hidden="true" /></div>
        <div>
          <p className="mkjp-eyebrow">Smart Storage identity confirmation</p>
          <h2 id={`mkjp-identity-${surface}`}>Confirm the thing, not the machinery</h2>
          <p>A current identity check prevents a duplicate before anything is created.</p>
        </div>
      </header>

      <div className="mkjp-form-grid">
        <label>
          <span>Name</span>
          <input onChange={(event) => actions.setQuery(event.currentTarget.value)} value={state.query} />
        </label>
        <label>
          <span>What kind of thing is it?</span>
          <select
            onChange={(event) => actions.setNamedThingType(event.currentTarget.value as JourneyState["namedThingType"])}
            value={state.namedThingType}
          >
            <option>Topic</option>
            <option>Person</option>
            <option>Place</option>
            <option>Book</option>
          </select>
        </label>
      </div>

      <fieldset className="mkjp-match-check">
        <legend>Closest existing Tag</legend>
        <label>
          <input
            checked={state.identityDecision === "same"}
            name={`identity-${surface}`}
            onChange={() => actions.setIdentityDecision("same")}
            type="radio"
          />
          <span>
            <strong>{existingLabel}</strong>
            <small>Topic · Accessible root</small>
          </span>
          <em>Same thing</em>
        </label>
        <label>
          <input
            checked={state.identityDecision === "different"}
            name={`identity-${surface}`}
            onChange={() => actions.setIdentityDecision("different")}
            type="radio"
          />
          <span>
            <strong>“{state.query}” is distinct</strong>
            <small>Create one canonical identity</small>
          </span>
          <em>Different thing</em>
        </label>
      </fieldset>

      <details className="mkjp-machinery">
        <summary>What will happen?</summary>
        <p>
          Confirmation creates the {state.namedThingType} Knowledge Entry, its same-typed Represented Referent,
          and its canonical Tag atomically. A fresh identity check runs again when you confirm.
        </p>
      </details>

      <footer className="mkjp-panel-actions">
        <button className="mkjp-secondary-button" onClick={actions.reset} type="button">Cancel</button>
        <button className="mkjp-primary-button" onClick={actions.confirmIdentity} type="button">
          {state.identityDecision === "same" ? "Open existing Topic" : `Create ${state.namedThingType}`}
          <ArrowRight aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}

function QuestionContextChoice({
  actions,
  state,
  surface,
}: JourneyVariantProps & { surface: string }) {
  return (
    <section className="mkjp-decision-panel" data-surface={surface} aria-labelledby={`mkjp-question-${surface}`}>
      <header>
        <div className="mkjp-empty-icon"><FileQuestion aria-hidden="true" /></div>
        <div>
          <p className="mkjp-eyebrow">Question context</p>
          <h2 id={`mkjp-question-${surface}`}>Give the missing answer a durable place</h2>
          <p>A search is transient. A Question is created only when you choose to preserve this gap.</p>
        </div>
      </header>

      <div className="mkjp-question-preview">
        <span><FileQuestion aria-hidden="true" /></span>
        <div>
          <small>Proposed Question</small>
          <strong>{normalizeQuestion(state.query)}</strong>
          <p>Context: Desert Fathers · Attention</p>
        </div>
      </div>

      <section className="mkjp-similar-question" aria-label="Similar existing Question">
        <div>
          <small>Similar Question already exists</small>
          <strong>What did the Desert Fathers teach about watchfulness?</strong>
          <span>3 Answers · 1 open Knowledge Slot</span>
        </div>
        <button onClick={actions.openExistingQuestion} type="button">Use this Question</button>
      </section>

      <footer className="mkjp-panel-actions">
        <button className="mkjp-secondary-button" onClick={actions.reset} type="button">Cancel</button>
        <button
          aria-label="Create this Question"
          className="mkjp-primary-button"
          onClick={actions.createQuestion}
          type="button"
        >
          Create this Question <ArrowRight aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}

function KnowledgeSlotForm({
  actions,
  state,
  surface,
}: JourneyVariantProps & { surface: string }) {
  return (
    <section className="mkjp-decision-panel" data-surface={surface} aria-labelledby={`mkjp-slot-${surface}`}>
      <header>
        <div className="mkjp-empty-icon"><UsersRound aria-hidden="true" /></div>
        <div>
          <p className="mkjp-eyebrow">One Knowledge Slot</p>
          <h2 id={`mkjp-slot-${surface}`}>Who should contribute the answer?</h2>
          <p>The Question is the context. The Knowledge Slot requests one future Answer within it.</p>
        </div>
      </header>

      <fieldset className="mkjp-choice-fieldset">
        <legend>Answer type</legend>
        <div className="mkjp-segmented-options">
          {(["Words", "Essay", "Book", "Sermon"] as const).map((answerType) => (
            <button
              aria-pressed={state.answerType === answerType}
              key={answerType}
              onClick={() => actions.setAnswerType(answerType)}
              type="button"
            >
              {answerType}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mkjp-choice-fieldset">
        <legend>Audience</legend>
        <div className="mkjp-audience-options">
          <label data-selected={state.audience === "open"}>
            <input
              checked={state.audience === "open"}
              name={`audience-${surface}`}
              onChange={() => actions.setAudience("open")}
              type="radio"
            />
            <Compass aria-hidden="true" />
            <span><strong>Open request</strong><small>Anyone with access to this context may contribute.</small></span>
          </label>
          <label data-selected={state.audience === "experts"}>
            <input
              aria-label="Direct to experts"
              checked={state.audience === "experts"}
              name={`audience-${surface}`}
              onChange={() => actions.setAudience("experts")}
              type="radio"
            />
            <UsersRound aria-hidden="true" />
            <span><strong>Direct to experts</strong><small>Send the request to selected Context Experts.</small></span>
          </label>
        </div>
      </fieldset>

      {state.audience === "experts" ? (
        <fieldset className="mkjp-experts">
          <legend>Recommended Context Experts</legend>
          {EXPERTS.map((expert) => (
            <label key={expert.id}>
              <input
                checked={state.selectedExpertIds.includes(expert.id)}
                onChange={() => actions.toggleExpert(expert.id)}
                type="checkbox"
              />
              <span className="mkjp-avatar">{expert.initials}</span>
              <span><strong>{expert.name}</strong><small>{expert.detail}</small></span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <footer className="mkjp-panel-actions">
        <button className="mkjp-secondary-button" onClick={actions.reset} type="button">Cancel</button>
        <button
          aria-label="Create Knowledge Slot"
          className="mkjp-primary-button"
          disabled={state.audience === "experts" && state.selectedExpertIds.length === 0}
          onClick={actions.submitSlot}
          type="button"
        >
          Create Knowledge Slot <ArrowRight aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}

function Completion({
  actions,
  state,
  surface,
}: JourneyVariantProps & { surface: string }) {
  const isReferent = state.completionKind === "referent";
  const openedExistingReferent = isReferent && state.identityDecision === "same";

  return (
    <section className="mkjp-completion" data-surface={surface} role="status">
      <span className="mkjp-completion-icon"><Check aria-hidden="true" /></span>
      <p className="mkjp-eyebrow">
        {openedExistingReferent
          ? "Existing Knowledge Page found"
          : isReferent
            ? "Knowledge Page ready"
            : "Answer requested"}
      </p>
      <h2>{isReferent ? state.query : normalizeQuestion(state.query)}</h2>
      <p>
        {openedExistingReferent
          ? "No duplicate was created. The search resolves to the existing canonical Tag and Knowledge Page."
          : isReferent
          ? `The ${state.namedThingType} now has one canonical identity and an accessible Knowledge Page.`
          : state.audience === "open"
            ? `An open ${state.answerType} Knowledge Slot now lives in this Question context.`
            : `A ${state.answerType} Knowledge Slot was directed to ${state.selectedExpertIds.length} Context Experts.`}
      </p>
      {isReferent && !openedExistingReferent ? (
        <dl className="mkjp-transaction-receipt" aria-label="Atomic save result">
          <div><dt>Knowledge Entry</dt><dd>{state.namedThingType}: {state.query}</dd></div>
          <div><dt>Represents</dt><dd>{state.query} Referent</dd></div>
          <div><dt>Canonical Tag</dt><dd>{state.query}</dd></div>
          <div><dt>Transaction</dt><dd>Committed together</dd></div>
        </dl>
      ) : null}
      <div className="mkjp-completion-actions">
        <button className="mkjp-primary-button" type="button">
          <BookOpen aria-hidden="true" /> Open {isReferent ? "Page" : "Question"}
        </button>
        <button className="mkjp-secondary-button" onClick={actions.reset} type="button">Try again</button>
      </div>
    </section>
  );
}

function OutcomePreview({ state }: { state: JourneyState }) {
  if (state.stage === "search" || state.stage === "choose") {
    return (
      <div className="mkjp-preview-placeholder">
        <Compass aria-hidden="true" />
        <strong>No durable object yet</strong>
        <p>Searching and choosing an intent do not create anything.</p>
      </div>
    );
  }

  if (state.stage === "identity" || state.completionKind === "referent") {
    return (
      <div className="mkjp-preview-object">
        <span><Tag aria-hidden="true" /></span>
        <small>{state.namedThingType} Knowledge Page</small>
        <strong>{state.query}</strong>
        <p>Canonical Tag · Represented Referent · Knowledge Entry</p>
      </div>
    );
  }

  return (
    <div className="mkjp-preview-object">
      <span><FileQuestion aria-hidden="true" /></span>
      <small>Question context</small>
      <strong>{normalizeQuestion(state.query)}</strong>
      <p>
        {state.stage === "question"
          ? "Question not confirmed"
          : `${state.answerType} Knowledge Slot · ${state.audience === "open" ? "Open" : "Directed"}`}
      </p>
    </div>
  );
}

function StatePanel({ state }: { state: JourneyState }) {
  return (
    <details className="mkjp-state-panel" open>
      <summary>Prototype state</summary>
      <dl>
        <div><dt>Stage</dt><dd>{STAGE_LABELS[state.stage]}</dd></div>
        <div><dt>Intent</dt><dd>{state.scenario === "namedThing" ? "Named thing" : "Missing answer"}</dd></div>
        <div><dt>Query</dt><dd>{state.query || "—"}</dd></div>
        <div><dt>Durable result</dt><dd>{getDurableResultLabel(state)}</dd></div>
        <div><dt>Audience</dt><dd>{state.audience === "open" ? "Open" : `${state.selectedExpertIds.length} experts`}</dd></div>
      </dl>
    </details>
  );
}

function StagePill({ stage }: { stage: JourneyStage }) {
  return <span className="mkjp-stage-pill">{STAGE_LABELS[stage]}</span>;
}

function PrototypeSwitcher({
  current,
  label,
  onNext,
  onPrevious,
}: {
  current: VariantKey;
  label: string;
  onNext: () => void;
  onPrevious: () => void;
}) {
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <div className="mkjp-switcher" role="group" aria-label="Missing knowledge journey prototype variant switcher">
      <button aria-label="Previous missing knowledge variant" onClick={onPrevious} type="button">
        <ChevronLeft aria-hidden="true" />
      </button>
      <span>{current} · {label}</span>
      <button aria-label="Next missing knowledge variant" onClick={onNext} type="button">
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

function getJourneySteps(state: JourneyState) {
  const stages: JourneyStage[] =
    state.scenario === "namedThing"
      ? ["search", "choose", "identity", "complete"]
      : ["search", "choose", "question", "slot", "complete"];
  const currentIndex = Math.max(stages.indexOf(state.stage), 0);

  return stages.map((stage, index) => ({
    complete: index < currentIndex,
    index: index + 1,
    label: STAGE_LABELS[stage],
    stage,
  }));
}

function getStepDetail(stage: JourneyStage) {
  return {
    search: "Find accessible Tags",
    choose: "Name or answer",
    identity: "Prevent duplicates",
    question: "Preserve the gap",
    slot: "Open or direct",
    complete: "Open the destination",
  }[stage];
}

function getDurableResultLabel(state: JourneyState) {
  if (state.completionKind === "referent") {
    return `${state.namedThingType} page`;
  }
  if (state.completionKind === "slot") {
    return "Question + Knowledge Slot";
  }
  if (state.stage === "slot") {
    return state.questionResolution === "new" ? "New Question" : "Existing Question";
  }
  return "None";
}

function normalizeQuestion(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return "Untitled Question";
  }
  return trimmed.endsWith("?") ? trimmed : `${trimmed}?`;
}

function inferSmartStorageProposal(
  query: string,
): "Question" | JourneyState["namedThingType"] {
  const normalized = query.trim().toLowerCase();
  if (
    normalized.endsWith("?") ||
    /^(how|what|when|where|who|why|does|do|did|is|are|can|should)\b/.test(
      normalized,
    )
  ) {
    return "Question";
  }

  if (normalized.includes("tolkien")) {
    return "Person";
  }

  if (normalized.includes("lord of the rings")) {
    return "Book";
  }

  return "Topic";
}

function readVariant(): VariantKey {
  const value = new URLSearchParams(window.location.search).get("variant");
  return VARIANTS.some((item) => item.key === value) ? (value as VariantKey) : "C";
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.closest("[contenteditable='true']") !== null
  );
}
