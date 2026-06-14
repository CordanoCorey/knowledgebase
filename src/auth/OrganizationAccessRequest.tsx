import { Building2, Send, UserPlus } from "lucide-react";
import { SignOutButton } from "./AuthPanel";

type OrganizationAccessRequestScreenProps = {
  email?: string;
  reason: "inactiveUser" | "needsOrganization" | "unauthenticated";
  surface?: "app" | "editor";
};

const ACCESS_REQUEST_EMAIL = "gelbaughcm@gmail.com";

export function OrganizationAccessRequestScreen({
  email,
  reason,
  surface = "app",
}: OrganizationAccessRequestScreenProps) {
  const message =
    reason === "inactiveUser"
      ? "This account is not active yet. Request access to create or join an organization."
      : "This account needs an active organization membership before continuing.";

  return (
    <section className={`editor-panel kb-org-request kb-org-request-${surface}`}>
      <div className="kb-org-request-shell">
        <div className="kb-org-request-mark" aria-hidden="true">
          <Building2 />
        </div>
        <div className="kb-org-request-copy">
          <header>
            <p className="eyebrow">Organization access</p>
            <h1>Create or join an organization</h1>
          </header>
          <p>{message}</p>
          {email ? <p className="kb-org-request-email">Signed in as {email}</p> : null}
          <div className="kb-org-request-actions">
            <a href={getRequestHref("join", email)}>
              <UserPlus aria-hidden="true" />
              <span>Request to join</span>
            </a>
            <a href={getRequestHref("create", email)}>
              <Send aria-hidden="true" />
              <span>Request to create</span>
            </a>
            <SignOutButton />
          </div>
        </div>
      </div>
    </section>
  );
}

function getRequestHref(kind: "create" | "join", email?: string) {
  const subject =
    kind === "create"
      ? "Knowledgebase organization creation request"
      : "Knowledgebase organization join request";
  const action =
    kind === "create"
      ? "I would like to create a new organization."
      : "I would like to join an existing organization.";
  const body = [
    email ? `Account: ${email}` : null,
    action,
    "",
    "Organization name:",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return `mailto:${ACCESS_REQUEST_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
