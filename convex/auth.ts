import { convexAuth } from "@convex-dev/auth/server";
import { configuredAuthProviders } from "./authProviderConfig";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: configuredAuthProviders(),
});
