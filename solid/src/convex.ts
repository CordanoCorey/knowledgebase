import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";
import { ConvexClient, type ConnectionState } from "convex/browser";
import type { FunctionReference } from "convex/server";

const AUTH_TOKEN_STORAGE_KEY = "logeion-convex-auth-token";

type QueryReference = FunctionReference<"query">;
type MutationReference = FunctionReference<"mutation">;
type ActionReference = FunctionReference<"action">;

export type QueryArgs = Record<string, unknown>;
export type QuerySpec = { args?: QueryArgs; query: QueryReference } | "skip";

export function resolveConvexUrl() {
  return import.meta.env.VITE_CONVEX_URL || import.meta.env.VITE_LOGEION_CONVEX_URL || "";
}

export const convexClient = (() => {
  const convexUrl = resolveConvexUrl();
  if (!convexUrl) return null;
  const client = new ConvexClient(convexUrl);
  const storedToken = readStoredAuthToken();
  if (storedToken) {
    client.setAuth(async () => storedToken);
  }
  return client;
})();

export function createConvexQuery<T>(spec: Accessor<QuerySpec>) {
  const [data, setData] = createSignal<T | undefined>();
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(Boolean(convexClient));

  createEffect(
    spec,
    (nextSpec) => {
      setError(null);

      if (!convexClient || nextSpec === "skip") {
        setData(undefined);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const unsubscribe = convexClient.onUpdate(
        nextSpec.query,
        (nextSpec.args ?? {}) as never,
        (result) => {
          setData(() => result as T);
          setIsLoading(false);
        },
        (caughtError) => {
          setError(caughtError.message);
          setIsLoading(false);
        },
      );

      return () => unsubscribe();
    },
  );

  return { data, error, isLoading };
}

export function createConnectionState() {
  const [connectionState, setConnectionState] = createSignal<ConnectionState | null>(
    convexClient?.connectionState() ?? null,
  );

  if (convexClient) {
    const unsubscribe = convexClient.subscribeToConnectionState(setConnectionState);
    onCleanup(unsubscribe);
  }

  return connectionState;
}

export async function runConvexQuery<T>(query: QueryReference, args: QueryArgs = {}) {
  if (!convexClient) throw new Error("Missing Convex URL.");
  return await convexClient.query(query, args as never) as T;
}

export async function runConvexMutation<T>(mutation: MutationReference, args: QueryArgs = {}) {
  if (!convexClient) throw new Error("Missing Convex URL.");
  return await convexClient.mutation(mutation, args as never) as T;
}

export async function runConvexAction<T>(action: ActionReference, args: QueryArgs = {}) {
  if (!convexClient) throw new Error("Missing Convex URL.");
  return await convexClient.action(action, args as never) as T;
}

export function readStoredAuthToken() {
  return globalThis.localStorage?.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim() || "";
}

export function storeAuthToken(token: string) {
  const nextToken = token.trim();
  if (nextToken) {
    globalThis.localStorage?.setItem(AUTH_TOKEN_STORAGE_KEY, nextToken);
    convexClient?.setAuth(async () => nextToken);
  } else {
    globalThis.localStorage?.removeItem(AUTH_TOKEN_STORAGE_KEY);
    convexClient?.client.clearAuth();
  }
}
