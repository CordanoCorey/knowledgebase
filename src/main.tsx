import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import { createConvexClient } from "./convexClient";
import "./index.css";

const convex = createConvexClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {convex ? (
      <ConvexAuthProvider client={convex}>
        <App />
      </ConvexAuthProvider>
    ) : (
      <main className="kb-auth-page">
        <section className="editor-panel editor-loading missing-config">
          Missing Convex URL
        </section>
      </main>
    )}
  </React.StrictMode>,
);
