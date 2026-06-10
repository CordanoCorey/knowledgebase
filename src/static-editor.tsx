import React from "react";
import ReactDOM from "react-dom/client";
import {
  ConvexAuthProvider,
  useConvexAuth,
} from "@convex-dev/auth/react";
import { AuthPanel, SignOutButton } from "./auth/AuthPanel";
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

  return (
    <CollaborativeEditor
      documentId={documentId}
      headerActions={<SignOutButton />}
    />
  );
}
