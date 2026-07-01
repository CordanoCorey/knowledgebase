import { afterEach, describe, expect, test, vi } from "vitest";
import { createConvexClient, resolveConvexUrl } from "./convexClient";

const convexMock = vi.hoisted(() => ({
  ConvexReactClient: vi.fn(function ConvexReactClient(this: { url: string }, url: string) {
    this.url = url;
  }),
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: convexMock.ConvexReactClient,
}));

describe("Convex React client creation", () => {
  afterEach(() => {
    convexMock.ConvexReactClient.mockClear();
    vi.unstubAllEnvs();
  });

  test("prefers an explicit URL over environment configuration", () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://env.convex.cloud");

    expect(resolveConvexUrl("https://explicit.convex.cloud")).toBe(
      "https://explicit.convex.cloud",
    );

    const client = createConvexClient("https://explicit.convex.cloud");
    expect(client).toBeTruthy();
    expect(convexMock.ConvexReactClient).toHaveBeenCalledWith(
      "https://explicit.convex.cloud",
    );
  });

  test("falls back to VITE_CONVEX_URL", () => {
    vi.stubEnv("VITE_CONVEX_URL", "https://env.convex.cloud");

    expect(resolveConvexUrl()).toBe("https://env.convex.cloud");
    expect(createConvexClient()).toBeTruthy();
    expect(convexMock.ConvexReactClient).toHaveBeenCalledWith(
      "https://env.convex.cloud",
    );
  });

  test("does not construct a client when no URL is available", () => {
    vi.stubEnv("VITE_CONVEX_URL", undefined);

    expect(resolveConvexUrl()).toBe("");
    expect(createConvexClient()).toBeNull();
    expect(convexMock.ConvexReactClient).not.toHaveBeenCalled();
  });
});
