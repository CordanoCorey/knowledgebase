import { ConvexReactClient } from "convex/react";

// Centralize Convex client construction so tests and startup share the same
// "missing URL means no client" behavior.
export function resolveConvexUrl(explicitUrl?: string | null) {
  return explicitUrl || import.meta.env.VITE_CONVEX_URL || "";
}

export function createConvexClient(explicitUrl?: string | null) {
  const convexUrl = resolveConvexUrl(explicitUrl);
  return convexUrl ? new ConvexReactClient(convexUrl) : null;
}
