import type { SVGProps } from "react";
import knowledgeTypeSpriteHref from "../assets/knowledge-types.svg";
import {
  formatKnowledgeTypeLabel,
  type KnowledgeType,
} from "../knowledgeContracts";

export const KNOWLEDGE_TYPE_ICON_SYMBOLS = {
  words: "kt-words",
  biblePassage: "kt-bible-passage",
  topic: "kt-topic",
  series: "kt-series",
  question: "kt-question",
  quote: "kt-quote",
  sermon: "kt-sermon",
  essay: "kt-essay",
  poem: "kt-poem",
  song: "kt-song",
  book: "kt-book",
  shortStory: "kt-short-story",
  lesson: "kt-lesson",
  comment: "kt-comment",
  prayerRequest: "kt-prayer-request",
  event: "kt-event",
  rsvp: "kt-rsvp",
  person: "kt-person",
  organization: "kt-organization",
  group: "kt-group",
  place: "kt-place",
} as const satisfies Record<KnowledgeType, string>;

type KnowledgeTypeIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  decorative?: boolean;
  knowledgeType: KnowledgeType;
};

export function KnowledgeTypeIcon({
  className,
  decorative = true,
  knowledgeType,
  ...svgProps
}: KnowledgeTypeIconProps) {
  const label = `${formatKnowledgeTypeLabel(knowledgeType)} icon`;

  return (
    <svg
      {...svgProps}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      className={joinClassNames("kb-knowledge-type-icon", className)}
      data-knowledge-type={knowledgeType}
      focusable="false"
      role={decorative ? undefined : "img"}
      viewBox="0 0 24 24"
    >
      <use href={`${knowledgeTypeSpriteHref}#${KNOWLEDGE_TYPE_ICON_SYMBOLS[knowledgeType]}`} />
    </svg>
  );
}

export function KnowledgeTypeBadge({
  className,
  knowledgeType,
}: {
  className?: string;
  knowledgeType: KnowledgeType;
}) {
  return (
    <span
      className={joinClassNames("kb-knowledge-type-badge", className)}
      data-knowledge-type={knowledgeType}
    >
      <KnowledgeTypeIcon knowledgeType={knowledgeType} />
      <span className="kb-knowledge-type-label">
        {formatKnowledgeTypeLabel(knowledgeType)}
      </span>
    </span>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}
