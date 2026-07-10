// PROTOTYPE: Five Smart Storage wizard variants, switchable via
// ?prototype=smart-storage-workflow&variant=, on a throwaway workflow route.
// This file is intentionally isolated from production Smart Storage mutations.
import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Database,
  FileText,
  Link,
  ListTodo,
  LoaderCircle,
  Moon,
  RefreshCw,
  SearchCheck,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  UploadCloud,
  UserRound,
  XCircle,
} from "lucide-react";
import { KnowledgeTypeBadge } from "../components/KnowledgeTypeIcon";
import {
  type KnowledgeType,
  type ProposalConfidence,
  type RepresentationRole,
} from "../knowledgeContracts";
import "./smartStorageWorkflowPrototype.css";

const VARIANT_ORDER = ["A", "B", "C", "D", "E", "F"] as const;
type VariantKey = (typeof VARIANT_ORDER)[number];
type ThemePreference = "light" | "dark";
type SynthesizedScenario = "recovery" | "review" | "saved";

type SmartStorageWorkflowPrototypeProps = {
  onToggleTheme: () => void;
  theme: ThemePreference;
};

type VariantDefinition = {
  component: ComponentType<SmartStorageWorkflowPrototypeProps>;
  label: string;
};

type PrototypeSource = {
  detail: string;
  evidence: string;
  id: string;
  kind: "authoredText" | "externalUrl" | "uploadedFile";
  label: string;
  role: RepresentationRole;
  status: string;
};

type ProposalSummary = {
  confidence: ProposalConfidence;
  detail: string;
  evidence: string[];
  id: string;
  knowledgeType: KnowledgeType;
  roleLabel: string;
  statusLabel: string;
  tags: string[];
  title: string;
  tone: "primary" | "prerequisite" | "secondary";
};

type ReviewSlot = {
  actionLabel: string;
  assignee: string;
  detail: string;
  dueLabel: string;
  evidence: string;
  id: string;
  knowledgeType: KnowledgeType;
  priority: "High" | "Normal" | "Low";
  relation: string;
  statusLabel: string;
  title: string;
};

const SOURCE_DATA: PrototypeSource[] = [
  {
    detail: "Uploaded file, 12 pages",
    evidence:
      "Manuscript includes the sermon title, the full body text, Romans 8:28, and a speaker line.",
    id: "source-manuscript",
    kind: "uploadedFile",
    label: "courage-in-christs-kingdom.docx",
    role: "manuscript",
    status: "Bronze saved",
  },
  {
    detail: "External URL, audio page",
    evidence:
      "Audio page title matches the manuscript and includes the chapel date.",
    id: "source-audio",
    kind: "externalUrl",
    label: "chapel-audio.example/romans-8",
    role: "recording",
    status: "Preview saved",
  },
  {
    detail: "Authored text note",
    evidence:
      "User pasted a note asking Smart Storage to keep exegetical observations and cited books if found.",
    id: "source-note",
    kind: "authoredText",
    label: "Romans 8 teaching note",
    role: "supportingMaterial",
    status: "Bronze saved",
  },
];

const SESSION_METRICS = [
  { detail: "1 file, 1 URL, 1 note", label: "Sources", value: "3" },
  { detail: "Full Silver objects", label: "Proposals", value: "9" },
  { detail: "Speaker before sermon", label: "Prerequisite", value: "1" },
  { detail: "After primary is saved", label: "Review Slots", value: "7" },
];

const PREREQUISITE_PROPOSAL: ProposalSummary = {
  confidence: "medium",
  detail:
    "The sermon requires a speaker. Smart Storage proposes a Person entry because no Known Referent matched the speaker line with enough confidence.",
  evidence: [
    "Speaker line: Rev. Thomas Walker",
    "Audio page lists the same speaker",
    "No exact Known Referent match found",
  ],
  id: "proposal-speaker",
  knowledgeType: "person",
  roleLabel: "Prerequisite Proposal",
  statusLabel: "Required before primary",
  tags: ["Arche Classical Academy Chapel", "speaker"],
  title: "Rev. Thomas Walker",
  tone: "prerequisite",
};

const PRIMARY_PROPOSAL: ProposalSummary = {
  confidence: "high",
  detail:
    "The primary intended entry is a sermon. Accepting it stores one Gold Knowledge Entry, creates its referent, and connects selected representations.",
  evidence: [
    "Title and sermon body came from the manuscript",
    "Required speaker is agent-enriched and foregrounded",
    "Romans 8:28 is tagged at the most specific verse",
  ],
  id: "proposal-sermon",
  knowledgeType: "sermon",
  roleLabel: "Primary Intended Entry",
  statusLabel: "Ready after prerequisite",
  tags: ["Romans 8:28", "Arche Classical Academy Chapel", "Rev. Thomas Walker"],
  title: "Courage in Christ's Kingdom",
  tone: "primary",
};

const SECONDARY_PROPOSALS: ProposalSummary[] = [
  {
    confidence: "high",
    detail:
      "Quote discovered inside the sermon. If accepted, it tags the sermon as the place this quote came from.",
    evidence: [
      "Quote appears in paragraph 9",
      "Attribution was enriched from public sources",
      "Known book referent candidate found",
    ],
    id: "proposal-quote",
    knowledgeType: "quote",
    roleLabel: "Review Slot",
    statusLabel: "Ready to review",
    tags: ["Courage in Christ's Kingdom", "Romans 8:28", "Augustine"],
    title: "Our hearts are restless until they rest in thee",
    tone: "secondary",
  },
  {
    confidence: "medium",
    detail:
      "Exegetical note derived from the sermon body. It becomes Words tagged to Romans 8:28 and the sermon.",
    evidence: [
      "Paragraphs 4-6 explain all things working together",
      "No separate source beyond the submitted sermon",
    ],
    id: "proposal-exegesis",
    knowledgeType: "words",
    roleLabel: "Review Slot",
    statusLabel: "Needs reviewer judgment",
    tags: ["Courage in Christ's Kingdom", "Romans 8:28"],
    title: "Romans 8:28 does not flatten suffering",
    tone: "secondary",
  },
  {
    confidence: "medium",
    detail:
      "Book reference found in the sermon. A Known Referent candidate exists, so no new book entry is proposed unless the reviewer rejects the match.",
    evidence: [
      "Mentioned as Augustine's Confessions",
      "Known Referent candidate: Confessions",
    ],
    id: "proposal-book",
    knowledgeType: "book",
    roleLabel: "Reference Review Slot",
    statusLabel: "Known Referent match",
    tags: ["Courage in Christ's Kingdom", "Augustine"],
    title: "Confessions",
    tone: "secondary",
  },
];

const REVIEW_SLOTS: ReviewSlot[] = [
  {
    actionLabel: "Accept quote",
    assignee: "You",
    detail:
      "Store the quote as Gold, tag Augustine, Romans 8:28, and the accepted sermon.",
    dueLabel: "Today",
    evidence: "Found in paragraph 9 with enriched attribution.",
    id: "slot-quote",
    knowledgeType: "quote",
    priority: "High",
    relation: "Derived from primary sermon",
    statusLabel: "Ready",
    title: "Our hearts are restless until they rest in thee",
  },
  {
    actionLabel: "Review words",
    assignee: "M. Carter",
    detail:
      "Decide whether the extracted exegesis should become Words or stay as sermon text only.",
    dueLabel: "Fri",
    evidence: "Paragraphs 4-6 explain Romans 8:28.",
    id: "slot-words",
    knowledgeType: "words",
    priority: "Normal",
    relation: "Tags sermon and Romans 8:28",
    statusLabel: "Assigned",
    title: "Romans 8:28 does not flatten suffering",
  },
  {
    actionLabel: "Confirm match",
    assignee: "You",
    detail:
      "Confirm the Known Referent for Confessions. No new book entry will be created if this match is accepted.",
    dueLabel: "Later",
    evidence: "Book title and author inferred from sermon reference.",
    id: "slot-book",
    knowledgeType: "book",
    priority: "Normal",
    relation: "Reference-resolution Review Slot",
    statusLabel: "Known Referent",
    title: "Confessions",
  },
  {
    actionLabel: "Refresh",
    assignee: "You",
    detail:
      "A newer Smart Storage Contract knows how to extract sermon series links.",
    dueLabel: "Optional",
    evidence: "Original run used contract v0.8; current app contract is v0.9.",
    id: "slot-refresh",
    knowledgeType: "sermon",
    priority: "Low",
    relation: "Contract refresh",
    statusLabel: "Refresh available",
    title: "Reprocess sermon with updated contract",
  },
];

const WIZARD_STEPS = [
  { detail: "Sources preserved", icon: Database, label: "Bronze", state: "done" },
  {
    detail: "Speaker required",
    icon: UserRound,
    label: "Prerequisite",
    state: "active",
  },
  {
    detail: "Sermon proposal ready",
    icon: BookOpen,
    label: "Primary",
    state: "pending",
  },
  {
    detail: "Seven follow-up items",
    icon: ListTodo,
    label: "Review Slots",
    state: "pending",
  },
] as const;

const VARIANTS: Record<VariantKey, VariantDefinition> = {
  A: { component: FocusedDialogVariant, label: "Focused dialog" },
  B: { component: SessionMapVariant, label: "Session map" },
  C: { component: EvidenceSplitVariant, label: "Evidence split" },
  D: { component: ReviewInboxVariant, label: "Review inbox" },
  E: { component: EntryContinuationVariant, label: "Entry continuation" },
  F: { component: FullscreenFocusVariant, label: "Full-screen focus" },
};

export function SmartStorageWorkflowPrototype({
  onToggleTheme,
  theme,
}: SmartStorageWorkflowPrototypeProps) {
  const [variant, setVariant] = useState<VariantKey>(() => readVariantFromUrl());
  const activeVariant = VARIANTS[variant];
  const ActiveVariant = activeVariant.component;

  const setUrlVariant = useCallback((next: VariantKey) => {
    const url = new URL(window.location.href);
    url.searchParams.set("prototype", "smart-storage-workflow");
    url.searchParams.set("variant", next);
    window.history.replaceState(null, "", url);
    setVariant(next);
  }, []);

  const cycleVariant = useCallback(
    (direction: 1 | -1) => {
      const index = VARIANT_ORDER.indexOf(variant);
      const nextIndex =
        (index + direction + VARIANT_ORDER.length) % VARIANT_ORDER.length;
      setUrlVariant(VARIANT_ORDER[nextIndex]);
    },
    [setUrlVariant, variant],
  );

  useEffect(() => {
    const handlePopState = () => setVariant(readVariantFromUrl());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) {
        return;
      }
      if (event.key === "ArrowRight") {
        cycleVariant(1);
      }
      if (event.key === "ArrowLeft") {
        cycleVariant(-1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleVariant]);

  return (
    <div className="sswp-root" data-theme={theme}>
      <ActiveVariant onToggleTheme={onToggleTheme} theme={theme} />
      <PrototypeSwitcher
        current={variant}
        label={activeVariant.label}
        onNext={() => cycleVariant(1)}
        onPrevious={() => cycleVariant(-1)}
      />
    </div>
  );
}

function readVariantFromUrl(): VariantKey {
  const variant = new URL(window.location.href).searchParams.get("variant");
  return isVariantKey(variant) ? variant : "A";
}

function isVariantKey(value: string | null): value is VariantKey {
  return VARIANT_ORDER.includes(value as VariantKey);
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable ||
    target.closest("[contenteditable='true']") !== null
  );
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
    <div
      aria-label="Smart Storage wizard prototype variant switcher"
      className="sswp-switcher"
      role="group"
    >
      <button aria-label="Previous variant" onClick={onPrevious} type="button">
        <ChevronLeft aria-hidden="true" />
      </button>
      <span>
        {current} - {label}
      </span>
      <button aria-label="Next variant" onClick={onNext} type="button">
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

function FocusedDialogVariant(props: SmartStorageWorkflowPrototypeProps) {
  return (
    <PrototypeFrame
      {...props}
      className="sswp-focused-dialog"
      label="A - Focused Dialog"
    >
      <SubmitPreview />
      <section
        aria-label="Smart Storage wizard dialog"
        className="sswp-dialog-shell"
      >
        <WizardStepRail />

        <section
          aria-labelledby="sswp-focused-heading"
          className="sswp-dialog-workspace"
        >
          <PanelHeading
            eyebrow="Current step"
            heading="Accept required speaker first"
            icon={<UserRound aria-hidden="true" />}
            id="sswp-focused-heading"
          />
          <ProposalCard proposal={PREREQUISITE_PROPOSAL} />
          <ProposalCard locked proposal={PRIMARY_PROPOSAL} />
          <WizardFooter
            primaryLabel="Accept speaker"
            secondaryLabel="Finish later"
          />
        </section>

        <aside
          aria-labelledby="sswp-focused-side-heading"
          className="sswp-dialog-aside"
        >
          <PanelHeading
            eyebrow="Found"
            heading="Sources and follow-ups"
            icon={<Sparkles aria-hidden="true" />}
            id="sswp-focused-side-heading"
          />
          <SourceInventory compact />
          <ReviewSlotMiniSummary />
        </aside>
      </section>
    </PrototypeFrame>
  );
}

function SessionMapVariant(props: SmartStorageWorkflowPrototypeProps) {
  return (
    <PrototypeFrame
      {...props}
      className="sswp-session-map"
      label="B - Session Map"
    >
      <SubmitPreview />
      <section aria-label="Smart Storage session map" className="sswp-map">
        <MapLane
          heading="Bronze Sources"
          icon={<Database aria-hidden="true" />}
          meta="Immediately saved"
        >
          <SourceInventory compact />
        </MapLane>
        <MapLane
          heading="Required First"
          icon={<ShieldCheck aria-hidden="true" />}
          meta="Blocks primary"
        >
          <ProposalCard compact proposal={PREREQUISITE_PROPOSAL} />
        </MapLane>
        <MapLane
          heading="Primary Entry"
          icon={<BookOpen aria-hidden="true" />}
          meta="Anchor for everything else"
        >
          <ProposalCard compact proposal={PRIMARY_PROPOSAL} />
        </MapLane>
        <MapLane
          heading="Review Slots"
          icon={<ListTodo aria-hidden="true" />}
          meta="Can finish later"
        >
          <ReviewSlotStack limit={3} />
        </MapLane>
      </section>
      <section className="sswp-map-status" aria-label="Session processing state">
        <StatusNotice
          icon={<LoaderCircle aria-hidden="true" />}
          label="Secondary extraction can continue"
          tone="info"
        />
        <StatusNotice
          icon={<RefreshCw aria-hidden="true" />}
          label="Refresh appears only when contract changes"
          tone="warning"
        />
        <StatusNotice
          icon={<AlertTriangle aria-hidden="true" />}
          label="Scaffold is an explicit fallback action"
          tone="danger"
        />
      </section>
    </PrototypeFrame>
  );
}

function EvidenceSplitVariant(props: SmartStorageWorkflowPrototypeProps) {
  return (
    <PrototypeFrame
      {...props}
      className="sswp-evidence-split"
      label="C - Evidence Split"
    >
      <section className="sswp-evidence-grid">
        <section
          aria-labelledby="sswp-evidence-source-heading"
          className="sswp-pane"
        >
          <PanelHeading
            eyebrow="Evidence"
            heading="Source lines"
            icon={<FileText aria-hidden="true" />}
            id="sswp-evidence-source-heading"
          />
          <EvidenceList />
        </section>

        <section
          aria-labelledby="sswp-evidence-proposal-heading"
          className="sswp-pane sswp-pane-featured"
        >
          <PanelHeading
            eyebrow="Silver"
            heading="Primary proposal"
            icon={<Sparkles aria-hidden="true" />}
            id="sswp-evidence-proposal-heading"
          />
          <ProposalCard proposal={PRIMARY_PROPOSAL} />
          <RequiredEnrichmentPanel />
        </section>

        <aside
          aria-labelledby="sswp-evidence-decision-heading"
          className="sswp-pane"
        >
          <PanelHeading
            eyebrow="Decision"
            heading="Accept or route"
            icon={<ClipboardCheck aria-hidden="true" />}
            id="sswp-evidence-decision-heading"
          />
          <DecisionPanel />
        </aside>
      </section>
    </PrototypeFrame>
  );
}

function ReviewInboxVariant(props: SmartStorageWorkflowPrototypeProps) {
  return (
    <PrototypeFrame
      {...props}
      className="sswp-review-inbox"
      label="D - Review Inbox"
    >
      <section className="sswp-inbox-layout">
        <aside aria-label="Review Slot groups" className="sswp-inbox-groups">
          <GroupButton active count={7} label="Courage in Christ's Kingdom" />
          <GroupButton count={3} label="Lesson plan upload" />
          <GroupButton count={1} label="Contract refreshes" />
        </aside>

        <section
          aria-labelledby="sswp-inbox-heading"
          className="sswp-inbox-main"
        >
          <PanelHeading
            eyebrow="To-do"
            heading="Review Slots grouped by primary"
            icon={<ListTodo aria-hidden="true" />}
            id="sswp-inbox-heading"
          />
          <PrimarySavedBanner />
          <div className="sswp-review-slot-grid">
            {REVIEW_SLOTS.map((slot) => (
              <ReviewSlotCard key={slot.id} slot={slot} />
            ))}
          </div>
        </section>

        <aside
          aria-labelledby="sswp-inbox-assignment-heading"
          className="sswp-inbox-side"
        >
          <PanelHeading
            eyebrow="Assignment"
            heading="Send review work"
            icon={<Send aria-hidden="true" />}
            id="sswp-inbox-assignment-heading"
          />
          <AssignmentPanel />
        </aside>
      </section>
    </PrototypeFrame>
  );
}

function EntryContinuationVariant(props: SmartStorageWorkflowPrototypeProps) {
  return (
    <PrototypeFrame
      {...props}
      className="sswp-entry-continuation"
      label="E - Entry Continuation"
    >
      <section className="sswp-entry-page">
        <main className="sswp-entry-main" aria-labelledby="sswp-entry-heading">
          <p className="sswp-eyebrow">Sermon</p>
          <h2 id="sswp-entry-heading">Courage in Christ's Kingdom</h2>
          <div className="sswp-entry-tags" aria-label="Entry Tags">
            {PRIMARY_PROPOSAL.tags.map((tag) => (
              <span key={tag}>
                <Tag aria-hidden="true" />
                {tag}
              </span>
            ))}
          </div>
          <p>
            Accepted primary entry. The Smart Storage Session remains attached
            so secondary Review Slots can be resumed from the entry itself.
          </p>
          <section className="sswp-entry-representations" aria-label="Entry representations">
            {SOURCE_DATA.slice(0, 2).map((source) => (
              <div key={source.id}>
                <SourceIcon kind={source.kind} />
                <span>
                  <strong>{formatRepresentationRole(source.role)}</strong>
                  <small>{source.label}</small>
                </span>
              </div>
            ))}
          </section>
        </main>

        <aside
          aria-labelledby="sswp-entry-session-heading"
          className="sswp-entry-session"
        >
          <PanelHeading
            eyebrow="Smart Storage"
            heading="7 Review Slots remain"
            icon={<Sparkles aria-hidden="true" />}
            id="sswp-entry-session-heading"
          />
          <ReviewSlotStack limit={2} />
          <WizardFooter
            primaryLabel="Continue review"
            secondaryLabel="Send to reviewer"
          />
        </aside>
      </section>
    </PrototypeFrame>
  );
}

function FullscreenFocusVariant(props: SmartStorageWorkflowPrototypeProps) {
  const [scenario, setScenario] = useState<SynthesizedScenario>("review");
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  return (
    <PrototypeFrame
      {...props}
      className="sswp-synth-fullscreen"
      label="F - Full-screen Focus"
    >
      <section
        aria-labelledby="sswp-synth-heading"
        className="sswp-synth-dialog"
      >
        <header className="sswp-synth-topbar">
          <div className="sswp-synth-title">
            <p className="sswp-eyebrow">Smart Storage Session</p>
            <h2 id="sswp-synth-heading">
              {scenario === "saved"
                ? "Courage in Christ's Kingdom"
                : scenario === "recovery"
                  ? "Sources saved, proposal needs attention"
                  : "Accept required speaker first"}
            </h2>
            <p>
              {scenario === "saved"
                ? "Entry saved. Remaining Smart Storage work stays attached without taking over the page."
                : "A focused full-screen review flow keeps one decision primary while preserving the session."}
            </p>
          </div>

          <div className="sswp-synth-top-actions">
            <SynthesisScenarioTabs
              current={scenario}
              onChange={setScenario}
            />
            <SynthesisSourceChips />
            <button
              className="sswp-synth-ghost-button"
              onClick={() => setIsEvidenceOpen(true)}
              type="button"
            >
              <SearchCheck aria-hidden="true" />
              Evidence
            </button>
          </div>
        </header>

        {scenario === "saved" ? (
          <SynthesisSavedEntryState />
        ) : (
          <>
            <SynthesisProgressRow activeStep={scenario} />
            <section className="sswp-synth-content">
              <aside
                aria-label="Smart Storage session context"
                className="sswp-synth-side-context"
              >
                <SynthesisContextItem
                  detail="3 Bronze Sources are preserved even if you finish later."
                  icon={<Database aria-hidden="true" />}
                  label="Sources saved"
                />
                <SynthesisContextItem
                  detail="7 Review Slots will remain after the sermon is saved."
                  icon={<ListTodo aria-hidden="true" />}
                  label="Later review"
                />
                <SynthesisContextItem
                  detail="Assignment stays secondary from each Review Slot action."
                  icon={<Send aria-hidden="true" />}
                  label="Delegation"
                />
              </aside>

              <section
                aria-label="Current Smart Storage review task"
                className="sswp-synth-review-column"
              >
                {scenario === "recovery" ? (
                  <SynthesisRecoveryState />
                ) : (
                  <>
                    <SimplifiedProposalCard proposal={PREREQUISITE_PROPOSAL} />
                    <LockedPrimarySummary />
                    <section
                      aria-label="Review Slots after primary save"
                      className="sswp-synth-quiet-next"
                    >
                      <ListTodo aria-hidden="true" />
                      <span>
                        <strong>After the primary is saved</strong>
                        <small>
                          Seven Review Slots remain available from the entry
                          page or review surfaces.
                        </small>
                      </span>
                    </section>
                  </>
                )}
              </section>
            </section>
          </>
        )}

        <footer className="sswp-synth-footer">
          <span>
            {scenario === "saved"
              ? "Entry saved. Review can continue from the drawer."
              : scenario === "recovery"
                ? "Bronze Sources are safe; choose how to recover."
                : "Primary unlocks after the speaker exists."}
          </span>
          <div>
            <button className="sswp-secondary-button" type="button">
              Finish later
            </button>
            <button className="sswp-primary-button" type="button">
              <Check aria-hidden="true" />
              {scenario === "saved"
                ? "Continue review"
                : scenario === "recovery"
                  ? "Retry proposal"
                  : "Accept speaker"}
            </button>
          </div>
        </footer>

        {isEvidenceOpen ? (
          <SynthesisEvidenceDrawer onClose={() => setIsEvidenceOpen(false)} />
        ) : null}
      </section>
    </PrototypeFrame>
  );
}

function SynthesisScenarioTabs({
  current,
  onChange,
}: {
  current: SynthesizedScenario;
  onChange: (scenario: SynthesizedScenario) => void;
}) {
  const scenarios: { key: SynthesizedScenario; label: string }[] = [
    { key: "review", label: "Review" },
    { key: "saved", label: "Saved" },
    { key: "recovery", label: "Recovery" },
  ];

  return (
    <div className="sswp-synth-scenario-tabs" role="group" aria-label="Preview state">
      {scenarios.map((scenario) => (
        <button
          aria-pressed={current === scenario.key}
          data-active={current === scenario.key ? "true" : undefined}
          key={scenario.key}
          onClick={() => onChange(scenario.key)}
          type="button"
        >
          {scenario.label}
        </button>
      ))}
    </div>
  );
}

function SynthesisSourceChips() {
  return (
    <div className="sswp-synth-source-chips" aria-label="Detected source kinds">
      <span>
        <UploadCloud aria-hidden="true" />
        1 file
      </span>
      <span>
        <Link aria-hidden="true" />
        1 URL
      </span>
      <span>
        <FileText aria-hidden="true" />
        1 note
      </span>
    </div>
  );
}

function SynthesisProgressRow({
  activeStep,
}: {
  activeStep: Extract<SynthesizedScenario, "recovery" | "review">;
}) {
  const steps = [
    { icon: Database, label: "Sources saved", state: "done" },
    {
      icon: activeStep === "recovery" ? AlertTriangle : UserRound,
      label: activeStep === "recovery" ? "Recovery" : "Prerequisite",
      state: "active",
    },
    { icon: BookOpen, label: "Primary", state: "pending" },
    { icon: ListTodo, label: "Review Slots", state: "pending" },
  ] as const;

  return (
    <ol className="sswp-synth-progress-row" aria-label="Smart Storage progress">
      {steps.map((step) => {
        const Icon = step.icon;

        return (
          <li data-state={step.state} key={step.label}>
            <Icon aria-hidden="true" />
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SynthesisContextItem({
  detail,
  icon,
  label,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <section className="sswp-synth-context-item">
      {icon}
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </section>
  );
}

function SimplifiedProposalCard({ proposal }: { proposal: ProposalSummary }) {
  return (
    <article className="sswp-synth-clean-card">
      <header>
        <KnowledgeTypeBadge knowledgeType={proposal.knowledgeType} />
        <StatusPill label={proposal.statusLabel} />
      </header>
      <div>
        <p className="sswp-role-label">{proposal.roleLabel}</p>
        <h3>{proposal.title}</h3>
        <p>{proposal.detail}</p>
      </div>
      <div className="sswp-tag-row" aria-label={`${proposal.title} Tags`}>
        {proposal.tags.slice(0, 2).map((tag) => (
          <span key={tag}>
            <Tag aria-hidden="true" />
            {tag}
          </span>
        ))}
      </div>
      <details className="sswp-synth-details">
        <summary>Required details</summary>
        <ul>
          {proposal.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function LockedPrimarySummary() {
  return (
    <article className="sswp-synth-locked-primary" aria-label="Locked primary proposal">
      <ShieldCheck aria-hidden="true" />
      <span>
        <strong>{PRIMARY_PROPOSAL.title}</strong>
        <small>
          Primary sermon proposal is ready, but stays locked until the required
          speaker exists.
        </small>
      </span>
      <KnowledgeTypeBadge knowledgeType={PRIMARY_PROPOSAL.knowledgeType} />
    </article>
  );
}

function SynthesisRecoveryState() {
  return (
    <article className="sswp-synth-recovery-card">
      <header>
        <AlertTriangle aria-hidden="true" />
        <span>
          <p className="sswp-role-label">Recovery state</p>
          <h3>Proposal generation did not finish</h3>
        </span>
      </header>
      <p>
        The submitted Sources are still preserved. The same focused wizard can
        retry generation, create an explicit Scaffold Proposal, or leave the
        session for later review.
      </p>
      <div className="sswp-synth-recovery-actions">
        <button type="button">Create basic proposal</button>
        <button type="button">Cancel session</button>
      </div>
    </article>
  );
}

function SynthesisSavedEntryState() {
  return (
    <section className="sswp-synth-saved-state">
      <main className="sswp-synth-entry-focus" aria-labelledby="sswp-synth-entry-heading">
        <p className="sswp-eyebrow">Sermon</p>
        <h2 id="sswp-synth-entry-heading">Courage in Christ's Kingdom</h2>
        <p>
          Entry saved. The sermon is now the Gold anchor for the Smart Storage
          Session, and pending Silver work resumes from a compact continuation
          drawer.
        </p>
        <div className="sswp-entry-tags" aria-label="Entry Tags">
          {PRIMARY_PROPOSAL.tags.map((tag) => (
            <span key={tag}>
              <Tag aria-hidden="true" />
              {tag}
            </span>
          ))}
        </div>
      </main>

      <section className="sswp-synth-bottom-drawer" aria-label="Smart Storage continuation">
        <div>
          <ListTodo aria-hidden="true" />
          <span>
            <strong>7 Review Slots remain</strong>
            <small>Continue now, send one later, or leave them in review.</small>
          </span>
        </div>
        <button type="button">Continue review</button>
      </section>
    </section>
  );
}

function SynthesisEvidenceDrawer({ onClose }: { onClose: () => void }) {
  return (
    <aside
      aria-labelledby="sswp-synth-evidence-heading"
      className="sswp-synth-evidence-drawer"
    >
      <header>
        <div>
          <p className="sswp-eyebrow">Evidence</p>
          <h3 id="sswp-synth-evidence-heading">Source support</h3>
        </div>
        <button aria-label="Close evidence" onClick={onClose} type="button">
          <XCircle aria-hidden="true" />
        </button>
      </header>
      <EvidenceList />
    </aside>
  );
}

function PrototypeFrame({
  children,
  className,
  label,
  onToggleTheme,
  theme,
}: SmartStorageWorkflowPrototypeProps & {
  children: ReactNode;
  className: string;
  label: string;
}) {
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <main className={`sswp-frame ${className}`} aria-labelledby="sswp-heading">
      <header className="sswp-hero">
        <div>
          <p className="sswp-eyebrow">Smart Storage wizard prototype</p>
          <h1 id="sswp-heading">{label}</h1>
        </div>
        <button
          aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
          className="sswp-theme-button"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
          type="button"
        >
          <ThemeIcon aria-hidden="true" />
        </button>
      </header>
      <SessionStateStrip />
      {children}
    </main>
  );
}

function SubmitPreview() {
  return (
    <section aria-label="Contribution composer snapshot" className="sswp-submit-preview">
      <div className="sswp-submit-text">
        <span>Sermon</span>
        <p>
          Upload a sermon manuscript, paste notes, and attach the audio URL.
        </p>
      </div>
      <div className="sswp-source-counts" aria-label="Detected source kinds">
        <span>
          <UploadCloud aria-hidden="true" />
          1 file
        </span>
        <span>
          <Link aria-hidden="true" />
          1 URL
        </span>
        <span>
          <FileText aria-hidden="true" />
          1 note
        </span>
      </div>
      <button
        aria-label="Start Smart Storage"
        className="sswp-star-submit"
        title="Start Smart Storage"
        type="button"
      >
        <Sparkles aria-hidden="true" />
      </button>
    </section>
  );
}

function SessionStateStrip() {
  return (
    <dl className="sswp-session-strip" aria-label="Smart Storage session summary">
      {SESSION_METRICS.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          <small>{item.detail}</small>
        </div>
      ))}
    </dl>
  );
}

function WizardStepRail() {
  return (
    <ol aria-label="Smart Storage wizard steps" className="sswp-step-rail">
      {WIZARD_STEPS.map((step) => {
        const Icon = step.icon;

        return (
          <li data-state={step.state} key={step.label}>
            <span>
              <Icon aria-hidden="true" />
            </span>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </li>
        );
      })}
    </ol>
  );
}

function PanelHeading({
  eyebrow,
  heading,
  icon,
  id,
}: {
  eyebrow: string;
  heading: string;
  icon: ReactNode;
  id: string;
}) {
  return (
    <header className="sswp-panel-heading">
      <div>
        <p className="sswp-eyebrow">{eyebrow}</p>
        <h2 id={id}>{heading}</h2>
      </div>
      {icon}
    </header>
  );
}

function SourceInventory({ compact = false }: { compact?: boolean }) {
  return (
    <ol
      aria-label="Bronze Sources"
      className={compact ? "sswp-source-list sswp-source-list-compact" : "sswp-source-list"}
    >
      {SOURCE_DATA.map((source) => (
        <li key={source.id}>
          <SourceIcon kind={source.kind} />
          <span>
            <strong>{source.label}</strong>
            <small>{source.detail}</small>
          </span>
          <StatusPill label={source.status} />
        </li>
      ))}
    </ol>
  );
}

function SourceIcon({ kind }: { kind: PrototypeSource["kind"] }) {
  if (kind === "externalUrl") {
    return <Link aria-hidden="true" />;
  }
  if (kind === "uploadedFile") {
    return <UploadCloud aria-hidden="true" />;
  }
  return <FileText aria-hidden="true" />;
}

function ProposalCard({
  compact = false,
  locked = false,
  proposal,
}: {
  compact?: boolean;
  locked?: boolean;
  proposal: ProposalSummary;
}) {
  return (
    <article
      className={`sswp-proposal-card sswp-proposal-card-${proposal.tone}`}
      data-compact={compact ? "true" : undefined}
      data-locked={locked ? "true" : undefined}
    >
      <header>
        <KnowledgeTypeBadge knowledgeType={proposal.knowledgeType} />
        <StatusPill label={proposal.statusLabel} />
      </header>
      <div>
        <p className="sswp-role-label">{proposal.roleLabel}</p>
        <h3>{proposal.title}</h3>
        <p>{proposal.detail}</p>
      </div>
      <div className="sswp-tag-row" aria-label={`${proposal.title} Tags`}>
        {proposal.tags.map((tag) => (
          <span key={tag}>
            <Tag aria-hidden="true" />
            {tag}
          </span>
        ))}
      </div>
      {compact ? null : (
        <ul className="sswp-evidence-bullets">
          {proposal.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {locked ? (
        <StatusNotice
          icon={<ShieldCheck aria-hidden="true" />}
          label="Primary cannot be accepted until the required speaker exists."
          tone="warning"
        />
      ) : null}
    </article>
  );
}

function ReviewSlotMiniSummary() {
  return (
    <section className="sswp-mini-summary" aria-label="Additional proposals summary">
      <h3>After the primary</h3>
      <p>
        Seven additional Review Slots are already full proposals. The user can
        exit after the sermon is saved and resolve them later.
      </p>
      <div>
        <StatusPill label="2 quotes" />
        <StatusPill label="3 references" />
        <StatusPill label="2 words" />
      </div>
      <ol>
        {SECONDARY_PROPOSALS.map((proposal) => (
          <li key={proposal.id}>
            <KnowledgeTypeBadge knowledgeType={proposal.knowledgeType} />
            <span>{proposal.title}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ReviewSlotStack({ limit = REVIEW_SLOTS.length }: { limit?: number }) {
  return (
    <div className="sswp-slot-stack">
      {REVIEW_SLOTS.slice(0, limit).map((slot) => (
        <ReviewSlotCard compact key={slot.id} slot={slot} />
      ))}
    </div>
  );
}

function ReviewSlotCard({
  compact = false,
  slot,
}: {
  compact?: boolean;
  slot: ReviewSlot;
}) {
  return (
    <article
      className="sswp-review-slot-card"
      data-compact={compact ? "true" : undefined}
    >
      <header>
        <KnowledgeTypeBadge knowledgeType={slot.knowledgeType} />
        <StatusPill label={slot.statusLabel} />
      </header>
      <h3>{slot.title}</h3>
      <p>{slot.detail}</p>
      {compact ? null : (
        <dl>
          <div>
            <dt>Origin</dt>
            <dd>{slot.relation}</dd>
          </div>
          <div>
            <dt>Assignee</dt>
            <dd>{slot.assignee}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>{slot.dueLabel}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{slot.priority}</dd>
          </div>
        </dl>
      )}
      <footer>
        <small>{slot.evidence}</small>
        <button type="button">{slot.actionLabel}</button>
      </footer>
    </article>
  );
}

function MapLane({
  children,
  heading,
  icon,
  meta,
}: {
  children: ReactNode;
  heading: string;
  icon: ReactNode;
  meta: string;
}) {
  return (
    <section className="sswp-map-lane">
      <header>
        {icon}
        <span>
          <strong>{heading}</strong>
          <small>{meta}</small>
        </span>
      </header>
      {children}
    </section>
  );
}

function EvidenceList() {
  return (
    <ol className="sswp-evidence-list">
      {SOURCE_DATA.map((source) => (
        <li key={source.id}>
          <SourceIcon kind={source.kind} />
          <span>
            <strong>{source.label}</strong>
            <small>{source.evidence}</small>
          </span>
        </li>
      ))}
      {PRIMARY_PROPOSAL.evidence.map((item) => (
        <li key={item}>
          <SearchCheck aria-hidden="true" />
          <span>
            <strong>Proposal evidence</strong>
            <small>{item}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

function RequiredEnrichmentPanel() {
  return (
    <section className="sswp-enrichment-panel" aria-label="Required enrichments">
      <h3>Required enrichments</h3>
      <div>
        <StatusNotice
          icon={<UserRound aria-hidden="true" />}
          label="Speaker was not provided cleanly enough; Smart Storage proposes the Person first."
          tone="warning"
        />
        <StatusNotice
          icon={<Clock aria-hidden="true" />}
          label="Chapel date came from the audio page and is marked as enriched."
          tone="info"
        />
      </div>
    </section>
  );
}

function DecisionPanel() {
  return (
    <div className="sswp-decision-panel">
      <ProposalDecision
        detail="Creates the Person referent needed by the sermon."
        label="Accept prerequisite"
        state="active"
      />
      <ProposalDecision
        detail="Stores the sermon and makes it the session anchor."
        label="Accept primary"
        state="locked"
      />
      <ProposalDecision
        detail="Creates Review Slots grouped under the sermon."
        label="Finish later"
        state="ready"
      />
      <WizardFooter
        primaryLabel="Accept prerequisite"
        secondaryLabel="Assign review"
      />
    </div>
  );
}

function ProposalDecision({
  detail,
  label,
  state,
}: {
  detail: string;
  label: string;
  state: "active" | "locked" | "ready";
}) {
  const Icon = state === "locked" ? XCircle : state === "active" ? Check : Clock;

  return (
    <section className="sswp-decision-row" data-state={state}>
      <Icon aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
    </section>
  );
}

function PrimarySavedBanner() {
  return (
    <section className="sswp-primary-saved" aria-label="Primary entry saved">
      <Check aria-hidden="true" />
      <span>
        <strong>Primary sermon saved</strong>
        <small>
          New entries accepted from this run will automatically tag Courage in
          Christ's Kingdom.
        </small>
      </span>
    </section>
  );
}

function GroupButton({
  active = false,
  count,
  label,
}: {
  active?: boolean;
  count: number;
  label: string;
}) {
  return (
    <button className="sswp-group-button" data-active={active ? "true" : undefined} type="button">
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  );
}

function AssignmentPanel() {
  return (
    <section className="sswp-assignment-panel" aria-label="Review assignment">
      <label>
        Reviewer
        <select defaultValue="m-carter">
          <option value="m-carter">M. Carter</option>
          <option value="you">You</option>
          <option value="admin">Organization admin</option>
        </select>
      </label>
      <label>
        Slot
        <select defaultValue="slot-words">
          <option value="slot-words">Romans 8:28 Words</option>
          <option value="slot-book">Confessions match</option>
          <option value="slot-refresh">Contract refresh</option>
        </select>
      </label>
      <button type="button">
        <Send aria-hidden="true" />
        Send Review Slot
      </button>
    </section>
  );
}

function WizardFooter({
  primaryLabel,
  secondaryLabel,
}: {
  primaryLabel: string;
  secondaryLabel: string;
}) {
  return (
    <footer className="sswp-wizard-footer">
      <button className="sswp-secondary-button" type="button">
        {secondaryLabel}
      </button>
      <button className="sswp-primary-button" type="button">
        <Check aria-hidden="true" />
        {primaryLabel}
      </button>
    </footer>
  );
}

function StatusNotice({
  icon,
  label,
  tone,
}: {
  icon: ReactNode;
  label: string;
  tone: "danger" | "info" | "warning";
}) {
  return (
    <section className="sswp-status-notice" data-tone={tone}>
      {icon}
      <span>{label}</span>
    </section>
  );
}

function StatusPill({ label }: { label: string }) {
  return <span className="sswp-status-pill">{label}</span>;
}

function formatRepresentationRole(role: RepresentationRole) {
  const labels = {
    manuscript: "Manuscript",
    primaryContent: "Primary Content",
    recording: "Recording",
    slides: "Slides",
    supportingMaterial: "Supporting Material",
    thumbnail: "Thumbnail",
    transcript: "Transcript",
    unspecified: "Unspecified",
  } satisfies Record<RepresentationRole, string>;

  return labels[role];
}
