import { useState, type FormEvent } from "react";
import { useAction, useMutation } from "convex/react";
import {
  Building2,
  Check,
  LoaderCircle,
  MailCheck,
  Send,
  UserPlus,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "./AuthPanel";

type OrganizationAccessRequestScreenProps = {
  email?: string;
  reason: "inactiveUser" | "needsOrganization" | "unauthenticated";
  surface?: "app" | "editor";
};
export type ClaimResultSummary = {
  claimedMembershipCount: number;
  personConsolidationReviewCount?: number;
  personConsolidationRejectionCount?: number;
};

const ACCESS_REQUEST_EMAIL = "gelbaughcm@gmail.com";

export function OrganizationAccessRequestScreen({
  email,
  reason,
  surface = "app",
}: OrganizationAccessRequestScreenProps) {
  const sendEmailVerificationCode = useAction(
    api.contactIdentities.sendEmailVerificationCode,
  );
  const verifyEmailAndClaimPendingMemberships = useMutation(
    api.contactIdentities.verifyEmailAndClaimPendingMemberships,
  );
  const claimVerifiedEmailMemberships = useMutation(
    api.contactIdentities.claimVerifiedEmailMemberships,
  );
  const [claimEmail, setClaimEmail] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [requestedClaimEmail, setRequestedClaimEmail] = useState<string | null>(
    null,
  );
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isRequestingClaimCode, setIsRequestingClaimCode] = useState(false);
  const [isVerifyingClaimCode, setIsVerifyingClaimCode] = useState(false);
  const message =
    reason === "inactiveUser"
      ? "This Logeion account is not active yet. Request access to create or join an organization."
      : "This Logeion account needs an active organization membership before continuing.";
  const normalizedClaimEmail = claimEmail.trim();
  const canRequestClaimCode =
    normalizedClaimEmail.length > 0 &&
    !isRequestingClaimCode &&
    !isVerifyingClaimCode;
  const canVerifyClaimCode =
    normalizedClaimEmail.length > 0 &&
    claimCode.trim().length > 0 &&
    !isRequestingClaimCode &&
    !isVerifyingClaimCode;

  async function handleRequestClaimCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canRequestClaimCode) {
      return;
    }

    setClaimError(null);
    setClaimStatus(null);
    setIsRequestingClaimCode(true);
    try {
      const result = await sendEmailVerificationCode({
        email: normalizedClaimEmail,
      });
      setClaimEmail(result.email);
      setRequestedClaimEmail(result.email);
      setClaimCode("");
      if (result.verificationStatus === "verified") {
        const claimed = await claimVerifiedEmailMemberships({
          email: result.email,
        });
        setClaimStatus(formatClaimResult(claimed));
      } else {
        setClaimStatus("Verification code requested.");
      }
    } catch (error) {
      setClaimError(getErrorMessage(error));
    } finally {
      setIsRequestingClaimCode(false);
    }
  }

  async function handleVerifyClaimCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canVerifyClaimCode) {
      return;
    }

    setClaimError(null);
    setClaimStatus(null);
    setIsVerifyingClaimCode(true);
    try {
      const result = await verifyEmailAndClaimPendingMemberships({
        code: claimCode,
        email: normalizedClaimEmail,
      });
      setClaimStatus(formatClaimResult(result));
      setClaimCode("");
    } catch (error) {
      setClaimError(getErrorMessage(error));
    } finally {
      setIsVerifyingClaimCode(false);
    }
  }

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
          <section
            className="kb-org-request-claim"
            aria-labelledby="kb-org-request-claim-heading"
          >
            <header>
              <MailCheck aria-hidden="true" />
              <div>
                <p className="eyebrow">Membership claim</p>
                <h2 id="kb-org-request-claim-heading">Claim by email</h2>
              </div>
            </header>
            <form onSubmit={handleRequestClaimCode}>
              <label>
                <span>Email</span>
                <input
                  autoComplete="email"
                  name="claimEmail"
                  onChange={(event) => setClaimEmail(event.target.value)}
                  type="email"
                  value={claimEmail}
                />
              </label>
              <button disabled={!canRequestClaimCode} type="submit">
                {isRequestingClaimCode ? (
                  <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
                ) : (
                  <MailCheck aria-hidden="true" />
                )}
                <span>Send code</span>
              </button>
            </form>
            <form onSubmit={handleVerifyClaimCode}>
              <label>
                <span>Code</span>
                <input
                  autoComplete="one-time-code"
                  disabled={requestedClaimEmail === null}
                  inputMode="numeric"
                  name="claimCode"
                  onChange={(event) => setClaimCode(event.target.value)}
                  type="text"
                  value={claimCode}
                />
              </label>
              <button
                disabled={!canVerifyClaimCode || requestedClaimEmail === null}
                type="submit"
              >
                {isVerifyingClaimCode ? (
                  <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
                ) : (
                  <Check aria-hidden="true" />
                )}
                <span>Verify and claim</span>
              </button>
            </form>
            {claimStatus ? (
              <p className="kb-org-request-claim-success" role="status">
                {claimStatus}
              </p>
            ) : null}
            {claimError ? (
              <p className="kb-org-request-claim-error" role="alert">
                {claimError}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  );
}

function getRequestHref(kind: "create" | "join", email?: string) {
  const subject =
    kind === "create"
      ? "Logeion organization creation request"
      : "Logeion organization join request";
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

export function formatClaimResult(result: ClaimResultSummary) {
  const { claimedMembershipCount } = result;
  const personConsolidationReviewCount =
    result.personConsolidationReviewCount ?? 0;
  const personConsolidationRejectionCount =
    result.personConsolidationRejectionCount ?? 0;
  const messages = [];
  if (claimedMembershipCount > 0) {
    messages.push(
      `${claimedMembershipCount} ${
        claimedMembershipCount === 1 ? "membership" : "memberships"
      } claimed.`,
    );
  }
  if (personConsolidationReviewCount > 0) {
    messages.push(
      `${personConsolidationReviewCount} ${
        personConsolidationReviewCount === 1 ? "membership needs" : "memberships need"
      } identity review.`,
    );
  }
  if (personConsolidationRejectionCount > 0) {
    messages.push(
      `${personConsolidationRejectionCount} ${
        personConsolidationRejectionCount === 1
          ? "membership was"
          : "memberships were"
      } not approved after identity review. Contact the organization admin.`,
    );
  }
  if (messages.length > 0) {
    return messages.join(" ");
  }

  if (claimedMembershipCount === 0) {
    return "Email verified. No pending memberships found.";
  }

  return "Email verified.";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Membership claim failed.";
}
