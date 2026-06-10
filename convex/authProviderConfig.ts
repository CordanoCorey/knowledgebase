import Google from "@auth/core/providers/google";
import Resend from "@auth/core/providers/resend";
import { Password } from "@convex-dev/auth/providers/Password";
import type { AuthProviderConfig } from "@convex-dev/auth/server";

export function hasPasswordAuth() {
  return true;
}

export function hasGoogleAuth() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export function hasResendAuth() {
  return Boolean(process.env.AUTH_RESEND_KEY && process.env.AUTH_EMAIL_FROM);
}

export function configuredAuthProviders(): AuthProviderConfig[] {
  const providers: AuthProviderConfig[] = [Password];

  if (hasGoogleAuth()) {
    providers.push(Google);
  }

  if (hasResendAuth()) {
    providers.push(Resend({ from: process.env.AUTH_EMAIL_FROM! }));
  }

  return providers;
}
