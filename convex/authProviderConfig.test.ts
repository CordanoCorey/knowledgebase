/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import {
  configuredAuthProviders,
  hasGoogleAuth,
  hasPasswordAuth,
  hasPasswordResetAuth,
  hasResendAuth,
} from "./authProviderConfig";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./authAvailability.ts": () => import("./authAvailability"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
};

describe("auth provider configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("always keeps password auth available", () => {
    expect(hasPasswordAuth()).toBe(true);
    expect(configuredAuthProviders()).toHaveLength(1);
  });

  test("rejects placeholder and malformed Google credentials", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "your-google-client.apps.googleusercontent.com");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "real-secret");
    expect(hasGoogleAuth()).toBe(false);

    vi.stubEnv(
      "AUTH_GOOGLE_ID",
      "client.apps.googleusercontent.com.apps.googleusercontent.com",
    );
    expect(hasGoogleAuth()).toBe(false);

    vi.stubEnv("AUTH_GOOGLE_ID", "client.apps.googleusercontent.com");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "changeme");
    expect(hasGoogleAuth()).toBe(false);
  });

  test("enables Google, Resend, and password reset only when required env exists", () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client.apps.googleusercontent.com");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "real-secret");
    vi.stubEnv("AUTH_RESEND_KEY", "resend-key");
    vi.stubEnv("AUTH_EMAIL_FROM", "Logeion <login@example.com>");

    expect(hasGoogleAuth()).toBe(true);
    expect(hasResendAuth()).toBe(true);
    expect(hasPasswordResetAuth()).toBe(true);
    expect(configuredAuthProviders()).toHaveLength(3);
  });

  test("reports provider availability through the public Convex query", async () => {
    vi.stubEnv("AUTH_GOOGLE_ID", "client.apps.googleusercontent.com");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "real-secret");
    vi.stubEnv("AUTH_RESEND_KEY", "resend-key");
    vi.stubEnv("AUTH_EMAIL_FROM", "Logeion <login@example.com>");

    const t = convexTest({ schema, modules });

    await expect(t.query(api.authAvailability.get, {})).resolves.toEqual({
      google: true,
      password: true,
      passwordReset: true,
      resend: true,
    });
  });

  test("reports disabled optional providers when env is absent", async () => {
    const t = convexTest({ schema, modules });

    await expect(t.query(api.authAvailability.get, {})).resolves.toEqual({
      google: false,
      password: true,
      passwordReset: false,
      resend: false,
    });
  });
});
