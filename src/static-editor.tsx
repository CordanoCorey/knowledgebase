import React from "react";
import ReactDOM from "react-dom/client";
import {
  ConvexAuthProvider,
  useConvexAuth,
} from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { AuthPanel, SignOutButton } from "./auth/AuthPanel";
import { OrganizationAccessRequestScreen } from "./auth/OrganizationAccessRequest";
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
  const appAccess = useQuery(
    api.appAccess.getCurrentUserAccess,
    isAuthenticated && !isLoading ? {} : "skip",
  );

  if (isLoading) {
    return (
      <section className="editor-panel editor-loading" aria-busy="true">
        <span>Checking session</span>
      </section>
    );
  }

  if (!isAuthenticated) {
    return <AuthPanel />;
  }

  if (appAccess === undefined) {
    return (
      <section className="editor-panel editor-loading" aria-busy="true">
        <span>Checking organization access</span>
      </section>
    );
  }

  if (appAccess.status !== "allowed") {
    return (
      <OrganizationAccessRequestScreen
        email={"email" in appAccess ? appAccess.email : undefined}
        reason={appAccess.status}
        surface="editor"
      />
    );
  }

  return (
    <CollaborativeEditor
      documentId={documentId}
      headerActions={<SignOutButton />}
    />
  );
}
