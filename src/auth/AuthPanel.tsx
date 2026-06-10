import { useEffect, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import {
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

type PasswordFlow = "signIn" | "signUp";
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
  const [passwordFlow, setPasswordFlow] = useState<PasswordFlow>("signIn");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [pendingProvider, setPendingProvider] = useState<PendingProvider>(null);

  const googleAvailable = authAvailability?.google ?? false;
  const passwordAvailable = authAvailability?.password ?? false;
  const resendAvailable = authAvailability?.resend ?? false;
  const isLoadingAuthAvailability = authAvailability === undefined;
  const hasConfiguredProvider = googleAvailable || passwordAvailable || resendAvailable;
  const isSubmitting = pendingProvider !== null;
  const isPasswordMethod = authMethod === "password";
  const isPasswordSignIn = passwordFlow === "signIn";

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
    setPasswordFlow(nextFlow);
    setAuthMethod("password");
  }

  function updateAuthMethod(nextMethod: AuthMethod) {
    resetFeedback();
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

    formData.set("email", email);
    setPendingProvider(provider);

    try {
      if (provider === "password") {
        formData.set("flow", passwordFlow);
        await signIn("password", formData);
        onSignInComplete?.();
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
      : "Create account"
    : "Email me a link";
  const SubmitIcon = isPasswordMethod
    ? isPasswordSignIn
      ? LogIn
      : UserPlus
    : Mail;
  const authContextLabel = surface === "app" ? "Secure workspace" : "Secure editor";
  const sessionLabel = surface === "app" ? "Account required" : "Session required";

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
              <p className="eyebrow">{isPasswordSignIn ? "Sign in" : "Sign up"}</p>
              <h1>{isPasswordSignIn ? "Welcome back" : "Create your account"}</h1>
            </header>

            {passwordAvailable ? (
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
                  aria-selected={!isPasswordSignIn}
                  onClick={() => updatePasswordFlow("signUp")}
                  role="tab"
                  type="button"
                >
                  Create
                </button>
              </div>
            ) : null}

            {isLoadingAuthAvailability ? (
              <p className="editor-auth-muted" role="status">
                <LoaderCircle aria-hidden="true" className="editor-auth-spin" />
                Checking sign-in options
              </p>
            ) : null}

            {googleAvailable ? (
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

            {googleAvailable && (passwordAvailable || resendAvailable) ? (
              <div className="editor-auth-divider" aria-hidden="true">
                <span />
                <strong>or</strong>
                <span />
              </div>
            ) : null}

            {passwordAvailable && resendAvailable ? (
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

            {!isLoadingAuthAvailability && (passwordAvailable || resendAvailable) ? (
              <AuthEmailField disabled={isSubmitting} />
            ) : null}

            {!isLoadingAuthAvailability && passwordAvailable && isPasswordMethod ? (
              <AuthPasswordField disabled={isSubmitting} isSignIn={isPasswordSignIn} />
            ) : null}

            {!isLoadingAuthAvailability && !hasConfiguredProvider ? (
              <p className="editor-auth-error" role="alert">
                No sign-in methods are configured for this deployment.
              </p>
            ) : null}

            {sentTo ? (
              <p className="editor-auth-success" role="status">
                Check {sentTo} for your sign-in link.
              </p>
            ) : null}
            {error ? (
              <p className="editor-auth-error" role="alert">
                {error}
              </p>
            ) : null}

            {!isLoadingAuthAvailability && (passwordAvailable || resendAvailable) ? (
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
  disabled,
  isSignIn,
}: {
  disabled: boolean;
  isSignIn: boolean;
}) {
  return (
    <label className="editor-auth-field">
      <span>Password</span>
      <div className="editor-auth-input-shell">
        <KeyRound aria-hidden="true" />
        <input
          autoComplete={isSignIn ? "current-password" : "new-password"}
          disabled={disabled}
          minLength={8}
          name="password"
          required
          type="password"
        />
      </div>
    </label>
  );
}
