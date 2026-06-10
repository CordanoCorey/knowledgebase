import React from "react";
import ReactDOM from "react-dom/client";
import {
  ConvexAuthProvider,
  useAuthActions,
  useConvexAuth,
} from "@convex-dev/auth/react";
import { LogOut } from "lucide-react";
import { CollaborativeEditor } from "./CollaborativeEditor";
import { createConvexClient } from "./convexClient";
import "./index.css";

const elementName = "convex-collaborative-editor";

class ConvexCollaborativeEditor extends HTMLElement {
  private root: ReactDOM.Root | null = null;

  connectedCallback() {
    const mount = document.createElement("div");
    mount.className = "component-frame";
    this.replaceChildren(mount);

    const convex = createConvexClient(this.getAttribute("convex-url"));
    if (!convex) {
      mount.className = "component-frame missing-config";
      mount.textContent = "Missing Convex URL";
      return;
    }

    this.root = ReactDOM.createRoot(mount);
    this.root.render(
      <React.StrictMode>
        <ConvexAuthProvider client={convex}>
          <AuthenticatedEditor documentId={this.getAttribute("document-id") || "main"} />
        </ConvexAuthProvider>
      </React.StrictMode>,
    );
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }
}

if (!customElements.get(elementName)) {
  customElements.define(elementName, ConvexCollaborativeEditor);
}

function AuthenticatedEditor({ documentId }: { documentId: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (isLoading) {
    return (
      <section className="editor-panel editor-loading" aria-busy="true">
        <span>Checking session</span>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <SignInPanel />;
  }

  return (
    <CollaborativeEditor
      documentId={documentId}
      headerActions={
        <button
          className="editor-sign-out"
          onClick={() => void signOut()}
          title="Sign out"
          type="button"
        >
          <LogOut aria-hidden="true" />
          Sign out
        </button>
      }
    />
  );
}

function SignInPanel() {
  const { signIn } = useAuthActions();
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = React.useState<"google" | "resend" | null>(null);

  function redirectToCurrentPage() {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  async function handleGoogleSignIn() {
    setError(null);
    setSentTo(null);
    setPendingProvider("google");

    try {
      await signIn("google", { redirectTo: redirectToCurrentPage() });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Google sign-in failed");
      setPendingProvider(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSentTo(null);
    setPendingProvider("resend");

    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") || "");
      formData.set("redirectTo", redirectToCurrentPage());
      await signIn("resend", formData);
      setSentTo(email);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not send sign-in link");
    } finally {
      setPendingProvider(null);
    }
  }

  const isSubmitting = pendingProvider !== null;

  return (
    <section className="editor-panel editor-auth-panel">
      <form className="editor-auth-form" onSubmit={handleSubmit}>
        <header>
          <p className="eyebrow">Secure editor</p>
          <h1>Sign in</h1>
        </header>
        <button
          className="editor-auth-provider"
          disabled={isSubmitting}
          onClick={() => void handleGoogleSignIn()}
          type="button"
        >
          {pendingProvider === "google" ? "Opening Google..." : "Continue with Google"}
        </button>
        <div className="editor-auth-divider" aria-hidden="true">
          <span />
          <strong>or</strong>
          <span />
        </div>
        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            name="email"
            required
            type="email"
          />
        </label>
        {sentTo ? (
          <p className="editor-auth-success" role="status">
            Check {sentTo} for your sign-in link.
          </p>
        ) : null}
        {error ? <p className="editor-auth-error">{error}</p> : null}
        <button disabled={isSubmitting} type="submit">
          {pendingProvider === "resend" ? "Sending link..." : "Email me a sign-in link"}
        </button>
      </form>
    </section>
  );
}
