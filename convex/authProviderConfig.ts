import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { Password } from "@convex-dev/auth/providers/Password";
import type { AuthProviderConfig } from "@convex-dev/auth/server";
import type { Value } from "convex/values";

export function hasPasswordAuth() {
  return true;
}

export function hasGoogleAuth() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export function hasResendAuth() {
  return Boolean(process.env.AUTH_RESEND_KEY && process.env.AUTH_EMAIL_FROM);
}

export function hasPasswordResetAuth() {
  return hasResendAuth();
}

function resendProvider() {
  return Resend({ from: process.env.AUTH_EMAIL_FROM! });
}

export function configuredAuthProviders(): AuthProviderConfig[] {
  const providers: AuthProviderConfig[] = [
    Password({
      profile: passwordProfile,
      ...(hasPasswordResetAuth() ? { reset: resendProvider() } : {}),
    }),
  ];

  if (hasGoogleAuth()) {
    providers.push(Google);
  }

  if (hasResendAuth()) {
    providers.push(resendProvider());
  }

  return providers;
}

function passwordProfile(params: Record<string, Value | undefined>) {
  const email = params.email;
  if (typeof email !== "string") {
    throw new Error("Email is required.");
  }

  return { email: normalizeEmail(email) };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
