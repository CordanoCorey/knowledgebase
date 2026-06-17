import type { MouseEvent, ReactNode } from "react";
import {
  getReferentTagHref,
  resolveTagLabel,
  type ActiveTag,
} from "../knowledgeContext";
import { KnowledgeTypeIcon } from "./KnowledgeTypeIcon";

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
