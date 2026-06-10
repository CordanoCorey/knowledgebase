import { ConvexReactClient } from "convex/react";

export function resolveConvexUrl(explicitUrl?: string | null) {
  return explicitUrl || import.meta.env.VITE_CONVEX_URL || "";
}

export function createConvexClient(explicitUrl?: string | null) {
  const convexUrl = resolveConvexUrl(explicitUrl);
  return convexUrl ? new ConvexReactClient(convexUrl) : null;
}
