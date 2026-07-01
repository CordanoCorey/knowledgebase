import type { MouseEvent, ReactNode } from "react";
import {
  getReferentTagHref,
  resolveTagLabel,
  type ActiveTag,
} from "../knowledgeContext";
import { KnowledgeTypeIcon } from "./KnowledgeTypeIcon";

// Resolve display labels to canonical tag hrefs at the UI edge, keeping plain
// text labels usable in shared contracts.
type ReferentTagLinkProps = {
  children?: ReactNode;
  className?: string;
  label?: string;
  onNavigateToHref?: (href: string) => void;
  showIcon?: boolean;
  tag?: ActiveTag;
};

export function ReferentTagLink({
  children,
  className,
  label,
  onNavigateToHref,
  showIcon = false,
  tag,
}: ReferentTagLinkProps) {
  const referentTag = tag ?? resolveTagLabel(label ?? "");
  const href = getReferentTagHref(referentTag);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (!onNavigateToHref) {
      return;
    }

    event.preventDefault();
    onNavigateToHref(href);
  }

  return (
    <a
      className={className}
      data-knowledge-type={referentTag.knowledgeType}
      href={href}
      onClick={handleClick}
      title={`Open ${referentTag.label}`}
    >
      {showIcon ? (
        <KnowledgeTypeIcon knowledgeType={referentTag.knowledgeType} />
      ) : null}
      {children ?? <span>{referentTag.label}</span>}
    </a>
  );
}
