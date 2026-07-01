import { type QRL, useStore, useVisibleTask$ } from "@qwik.dev/core";
import { ConvexClient, type ConnectionState } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference } from "convex/server";

const AUTH_TOKEN_STORAGE_KEY = "logeion-qwik-convex-auth-token";

type QueryReference = FunctionReference<"query">;
type MutationReference = FunctionReference<"mutation">;
type ActionReference = FunctionReference<"action">;
type QueryName = string;
type MutationName = string;
type ActionName = string;

export type QueryArgs = Record<string, unknown>;
export type QuerySpec = { args?: QueryArgs; name: QueryName } | "skip";
export type QueryTracker = {
  <T>(fn: () => T): T;
  <T extends object>(obj: T): T;
  <T extends object, P extends keyof T>(obj: T, prop: P): T[P];
};

let client: ConvexClient | null | undefined;

export function resolveConvexUrl() {
  return import.meta.env.VITE_CONVEX_URL || import.meta.env.VITE_LOGEION_CONVEX_URL || "";
}

export function getConvexClient() {
  if (client !== undefined) return client;
  const convexUrl = resolveConvexUrl();
  if (!convexUrl || typeof window === "undefined") {
    client = null;
    return client;
  }
  client = new ConvexClient(convexUrl);
  const token = readStoredAuthToken();
  if (token) {
    client.setAuth(async () => token);
  }
  return client;
}

export function hasConvexClient() {
  return Boolean(resolveConvexUrl());
}

export function useConvexQuery<T>(specFactory$: QRL<(track: QueryTracker) => QuerySpec>) {
  const state = useStore({
    data: undefined as T | undefined,
    error: "",
    isLoading: true,
  });

  useVisibleTask$(async ({ cleanup, track }) => {
    const nextSpec = await specFactory$(track);
    state.error = "";

    const nextClient = getConvexClient();
    if (!nextClient || nextSpec === "skip") {
      state.data = undefined;
      state.isLoading = false;
      return;
    }

    state.isLoading = true;
    const query = makeFunctionReference<"query">(nextSpec.name) as QueryReference;
    const unsubscribe = nextClient.onUpdate(
      query,
      (nextSpec.args ?? {}) as never,
      (result) => {
        state.data = result as T;
        state.isLoading = false;
      },
      (caughtError) => {
        state.error = caughtError.message;
        state.isLoading = false;
      },
    );

    cleanup(() => unsubscribe());
  });

  return state;
}

export function useConnectionState() {
  const state = useStore<{ value: ConnectionState | null }>({ value: null });

  useVisibleTask$(({ cleanup }) => {
    const nextClient = getConvexClient();
    if (!nextClient) return;
    state.value = nextClient.connectionState();
    cleanup(nextClient.subscribeToConnectionState((nextState) => {
      state.value = nextState;
    }));
  });

  return state;
}

export async function runConvexQuery<T>(query: QueryReference, args: QueryArgs = {}) {
  const nextClient = getConvexClient();
  if (!nextClient) throw new Error("Missing Convex URL.");
  return await nextClient.query(query, args as never) as T;
}

export async function runConvexMutation<T>(mutation: MutationReference | MutationName, args: QueryArgs = {}) {
  const nextClient = getConvexClient();
  if (!nextClient) throw new Error("Missing Convex URL.");
  const mutationReference = typeof mutation === "string" ? makeFunctionReference<"mutation">(mutation) as MutationReference : mutation;
  return await nextClient.mutation(mutationReference, args as never) as T;
}

export async function runConvexAction<T>(action: ActionReference | ActionName, args: QueryArgs = {}) {
  const nextClient = getConvexClient();
  if (!nextClient) throw new Error("Missing Convex URL.");
  const actionReference = typeof action === "string" ? makeFunctionReference<"action">(action) as ActionReference : action;
  return await nextClient.action(actionReference, args as never) as T;
}

export function readStoredAuthToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim() || "";
}

export function storeAuthToken(token: string) {
  if (typeof window === "undefined") return;
  const nextToken = token.trim();
  const nextClient = getConvexClient();
  if (nextToken) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextToken);
    nextClient?.setAuth(async () => nextToken);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    nextClient?.client.clearAuth();
  }
}
