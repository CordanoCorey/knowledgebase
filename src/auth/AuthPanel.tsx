import { useEffect, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  UserPlus,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import archePressHorizontalLogoDarkUrl from "../assets/arche-press_logo-horizontal-full-dark.svg";
import archePressHorizontalLogoUrl from "../assets/arche-press_logo-horizontal-full.svg";

type PasswordFlow = "signIn" | "signUp" | "reset" | "reset-verification";
type AuthMethod = "password" | "resend";
type PendingProvider = "google" | "password" | "resend" | null;

type AuthPanelProps = {
  onSignInComplete?: () => void;
  redirectTo?: string;
  surface?: "app" | "editor";
};

export function AuthPanel({
  onSignInComplete,
  redirectTo,
  surface = "editor",
}: AuthPanelProps) {
  const { signIn } = useAuthActions();
  const authAvailability = useQuery(api.authAvailability.get);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [passwordFlow, setPasswordFlow] = useState<PasswordFlow>("signIn");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [pendingProvider, setPendingProvider] = useState<PendingProvider>(null);

  const googleAvailable = authAvailability?.google ?? false;
  const passwordAvailable = authAvailability?.password ?? false;
  const passwordResetAvailable = authAvailability?.passwordReset ?? false;
  const resendAvailable = authAvailability?.resend ?? false;
  const isLoadingAuthAvailability = authAvailability === undefined;
  const hasConfiguredProvider = googleAvailable || passwordAvailable || resendAvailable;
  const isSubmitting = pendingProvider !== null;
  const isPasswordMethod = authMethod === "password";
  const isPasswordSignIn = passwordFlow === "signIn";
  const isPasswordSignUp = passwordFlow === "signUp";
  const isPasswordReset = passwordFlow === "reset";
  const isPasswordResetVerification = passwordFlow === "reset-verification";
  const isPasswordCredentialFlow =
    isPasswordMethod && (isPasswordSignIn || isPasswordSignUp);
  const shouldShowEmailField =
    !isLoadingAuthAvailability &&
    (authMethod === "resend" ||
      isPasswordSignIn ||
      isPasswordSignUp ||
      isPasswordReset);
  const shouldShowSubmit =
    !isLoadingAuthAvailability &&
    ((isPasswordMethod && passwordAvailable) ||
      (!isPasswordMethod && resendAvailable));

  useEffect(() => {
    if (isLoadingAuthAvailability) {
      return;
    }

    if (authMethod === "password" && !passwordAvailable && resendAvailable) {
      setAuthMethod("resend");
    }

    if (authMethod === "resend" && !resendAvailable && passwordAvailable) {
      setAuthMethod("password");
    }
  }, [
    authMethod,
    isLoadingAuthAvailability,
    passwordAvailable,
    resendAvailable,
  ]);

  function getRedirectTo() {
    return redirectTo ?? window.location.pathname + window.location.search + window.location.hash;
  }

  function resetFeedback() {
    setError(null);
    setSentTo(null);
  }

  function updatePasswordFlow(nextFlow: PasswordFlow) {
    resetFeedback();
    if (nextFlow !== "reset-verification") {
      setResetEmail(null);
    }
    setPasswordFlow(nextFlow);
    setAuthMethod("password");
  }

  function updateAuthMethod(nextMethod: AuthMethod) {
    resetFeedback();
    setResetEmail(null);
    if (nextMethod === "password") {
      setPasswordFlow("signIn");
    }
    setAuthMethod(nextMethod);
  }

  async function handleGoogleSignIn() {
    resetFeedback();
    setPendingProvider("google");

    try {
      await signIn("google", { redirectTo: getRedirectTo() });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Google sign-in failed");
      setPendingProvider(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const provider: AuthMethod = isPasswordMethod ? "password" : "resend";

    if (isPasswordResetVerification && resetEmail) {
      formData.set("email", resetEmail);
    } else {
      formData.set("email", email);
    }

    setPendingProvider(provider);

    try {
      if (provider === "password") {
        formData.set("flow", passwordFlow);
        await signIn("password", formData);
        if (isPasswordReset) {
          setResetEmail(email);
          setPasswordFlow("reset-verification");
          setSentTo(email);
        } else {
          onSignInComplete?.();
        }
      } else {
        formData.set("redirectTo", getRedirectTo());
        await signIn("resend", formData);
        setSentTo(email);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Sign-in failed");
    } finally {
      setPendingProvider(null);
    }
  }

  const submitLabel = isPasswordMethod
    ? isPasswordSignIn
      ? "Sign in"
      : isPasswordSignUp
        ? "Create account"
        : isPasswordReset
          ? "Send reset code"
          : "Reset password"
    : "Email me a link";
  const SubmitIcon = isPasswordMethod
    ? isPasswordSignIn
      ? LogIn
      : isPasswordSignUp
        ? UserPlus
        : Mail
    : Mail;
  const authContextLabel = surface === "app" ? "Secure workspace" : "Secure editor";
  const sessionLabel = surface === "app" ? "Account required" : "Session required";
  const headerEyebrow =
    isPasswordReset || isPasswordResetVerification
      ? "Password reset"
      : isPasswordSignUp
        ? "Sign up"
        : "Sign in";
  const headerTitle = isPasswordReset
    ? "Reset password"
    : isPasswordResetVerification
      ? "Enter reset code"
      : isPasswordSignUp
        ? "Create your account"
        : "Welcome back";

  return (
    <section className={`editor-panel editor-auth-panel editor-auth-panel-${surface}`}>
      <div className="editor-auth-layout">
        <aside className="editor-auth-brand" aria-label="Knowledgebase">
          <div className="editor-auth-brand-main">
            <img
              className="editor-auth-logo editor-auth-logo-light"
              src={archePressHorizontalLogoUrl}
              alt="Arche Press"
            />
            <img
              className="editor-auth-logo editor-auth-logo-dark"
              src={archePressHorizontalLogoDarkUrl}
              alt="Arche Press"
            />
            <div>
              <p className="eyebrow">{authContextLabel}</p>
              <h2>Knowledgebase</h2>
            </div>
          </div>
          <div className="editor-auth-brand-footer">
            <LockKeyhole aria-hidden="true" />
            <span>{sessionLabel}</span>
          </div>
        </aside>

        <div className="editor-auth-content">
          <form className="editor-auth-form" onSubmit={handleSubmit}>
            <header>
              <p className="eyebrow">{headerEyebrow}</p>
              <h1>{headerTitle}</h1>
            </header>

            {isLoadingAuthAvailability ? (
              <p className="editor-auth-muted" role="status">
                <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
                Checking sign-in options
              </p>
            ) : null}

            {googleAvailable && !isPasswordReset && !isPasswordResetVerification ? (
              <button
                className="editor-auth-provider"
                disabled={isSubmitting}
                onClick={() => void handleGoogleSignIn()}
                type="button"
              >
                {pendingProvider === "google" ? (
                  <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
                ) : (
                  <LogIn aria-hidden="true" />
                )}
                <span>{pendingProvider === "google" ? "Opening Google" : "Continue with Google"}</span>
              </button>
            ) : null}

            {googleAvailable &&
            (passwordAvailable || resendAvailable) &&
            !isPasswordReset &&
            !isPasswordResetVerification ? (
              <div className="editor-auth-divider" aria-hidden="true">
                <span />
                <strong>or</strong>
                <span />
              </div>
            ) : null}

            {passwordAvailable && resendAvailable && !isPasswordReset && !isPasswordResetVerification ? (
              <div className="editor-auth-method-switch" role="tablist" aria-label="Sign-in method">
                <button
                  aria-selected={authMethod === "password"}
                  onClick={() => updateAuthMethod("password")}
                  role="tab"
                  type="button"
                >
                  Password
                </button>
                <button
                  aria-selected={authMethod === "resend"}
                  onClick={() => updateAuthMethod("resend")}
                  role="tab"
                  type="button"
                >
                  Email link
                </button>
              </div>
            ) : null}

            {passwordAvailable && isPasswordMethod && !isPasswordReset && !isPasswordResetVerification ? (
              <div className="editor-auth-mode-switch" role="tablist" aria-label="Auth mode">
                <button
                  aria-selected={isPasswordSignIn}
                  onClick={() => updatePasswordFlow("signIn")}
                  role="tab"
                  type="button"
                >
                  Sign in
                </button>
                <button
                  aria-selected={isPasswordSignUp}
                  onClick={() => updatePasswordFlow("signUp")}
                  role="tab"
                  type="button"
                >
                  Create
                </button>
              </div>
            ) : null}

            {shouldShowEmailField ? (
              <AuthEmailField disabled={isSubmitting} />
            ) : null}

            {!isLoadingAuthAvailability && passwordAvailable && isPasswordCredentialFlow ? (
              <AuthPasswordField
                autoComplete={isPasswordSignIn ? "current-password" : "new-password"}
                disabled={isSubmitting}
                label="Password"
                name="password"
              />
            ) : null}

            {!isLoadingAuthAvailability && passwordAvailable && isPasswordResetVerification ? (
              <>
                <input name="email" type="hidden" value={resetEmail ?? ""} />
                <AuthCodeField disabled={isSubmitting} />
                <AuthPasswordField
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  label="New password"
                  name="newPassword"
                />
              </>
            ) : null}

            {passwordAvailable && passwordResetAvailable && isPasswordMethod && isPasswordSignIn ? (
              <button
                className="editor-auth-secondary-action"
                disabled={isSubmitting}
                onClick={() => updatePasswordFlow("reset")}
                type="button"
              >
                <Mail aria-hidden="true" />
                <span>Forgot password?</span>
              </button>
            ) : null}

            {isPasswordReset || isPasswordResetVerification ? (
              <button
                className="editor-auth-secondary-action editor-auth-back-action"
                disabled={isSubmitting}
                onClick={() => updatePasswordFlow("signIn")}
                type="button"
              >
                <ArrowLeft aria-hidden="true" />
                <span>Back to sign in</span>
              </button>
            ) : null}

            {!isLoadingAuthAvailability && !hasConfiguredProvider ? (
              <p className="editor-auth-error" role="alert">
                No sign-in methods are configured for this deployment.
              </p>
            ) : null}

            {sentTo ? (
              <p className="editor-auth-success" role="status">
                {isPasswordResetVerification
                  ? `Check ${sentTo} for your reset code.`
                  : `Check ${sentTo} for your sign-in link.`}
              </p>
            ) : null}
            {error ? (
              <p className="editor-auth-error" role="alert">
                {error}
              </p>
            ) : null}

            {shouldShowSubmit ? (
              <button className="editor-auth-submit" disabled={isSubmitting} type="submit">
                {pendingProvider === (isPasswordMethod ? "password" : "resend") ? (
                  <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
                ) : (
                  <SubmitIcon aria-hidden="true" />
                )}
                <span>
                  {pendingProvider === "password"
                    ? "Working"
                    : pendingProvider === "resend"
                      ? "Sending link"
                      : submitLabel}
                </span>
              </button>
            ) : null}
          </form>
        </div>
      </div>
    </section>
  );
}

export function SignOutButton() {
  const { signOut } = useAuthActions();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <button
      className="editor-sign-out"
      disabled={isSigningOut}
      onClick={() => void handleSignOut()}
      title="Sign out"
      type="button"
    >
      {isSigningOut ? (
        <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
      ) : (
        <LogOut aria-hidden="true" />
      )}
      <span>{isSigningOut ? "Signing out" : "Sign out"}</span>
    </button>
  );
}

function AuthEmailField({ disabled }: { disabled: boolean }) {
  return (
    <label className="editor-auth-field">
      <span>Email</span>
      <div className="editor-auth-input-shell">
        <Mail aria-hidden="true" />
        <input
          autoComplete="email"
          disabled={disabled}
          name="email"
          required
          type="email"
        />
      </div>
    </label>
  );
}

function AuthPasswordField({
  autoComplete,
  disabled,
  label,
  name,
}: {
  autoComplete: "current-password" | "new-password";
  disabled: boolean;
  label: string;
  name: "password" | "newPassword";
}) {
  return (
    <label className="editor-auth-field">
      <span>{label}</span>
      <div className="editor-auth-input-shell">
        <KeyRound aria-hidden="true" />
        <input
          autoComplete={autoComplete}
          disabled={disabled}
          minLength={8}
          name={name}
          required
          type="password"
        />
      </div>
    </label>
  );
}

function AuthCodeField({ disabled }: { disabled: boolean }) {
  return (
    <label className="editor-auth-field">
      <span>Code</span>
      <div className="editor-auth-input-shell">
        <KeyRound aria-hidden="true" />
        <input
          autoComplete="one-time-code"
          disabled={disabled}
          inputMode="numeric"
          name="code"
          required
          type="text"
        />
      </div>
    </label>
  );
}
