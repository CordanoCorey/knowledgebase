import { convexAuth } from "@convex-dev/auth/server";
import { configuredAuthProviders } from "./authProviderConfig";
import type { MutationCtx } from "./_generated/server";

const DUPLICATE_EMAIL_ERROR = "Email is already in use by another user.";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: configuredAuthProviders(),
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const appCtx = ctx as MutationCtx;
      const {
        email,
        emailVerified: profileEmailVerified,
        phoneVerified: profilePhoneVerified,
        ...profile
      } = args.profile;
      const emailVerified = isEmailVerified(args, profileEmailVerified);
      const phoneVerified = profilePhoneVerified === true;
      const normalizedEmail =
        typeof email === "string" ? normalizeEmail(email) : null;
      const userData = {
        ...(emailVerified ? { emailVerificationTime: Date.now() } : null),
        ...(phoneVerified ? { phoneVerificationTime: Date.now() } : null),
        ...profile,
        ...(normalizedEmail === null ? null : { email: normalizedEmail }),
      };
      let userId = args.existingUserId;

      if (normalizedEmail !== null) {
        const usersWithEmail = await appCtx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", normalizedEmail))
          .take(2);
        const conflictingUser = usersWithEmail.find(
          (user) => user._id !== userId,
        );

        if (conflictingUser && userId !== null) {
          throw new Error(DUPLICATE_EMAIL_ERROR);
        }

        if (conflictingUser && !canLinkViaEmail(args, emailVerified)) {
          throw new Error(DUPLICATE_EMAIL_ERROR);
        }

        if (userId === null && conflictingUser) {
          userId = conflictingUser._id;
        }
      }

      if (userId !== null) {
        await appCtx.db.patch(userId, userData);
        return userId;
      }

      return await appCtx.db.insert("users", userData);
    },
  },
});

function isEmailVerified(
  args: {
    provider: {
      allowDangerousEmailAccountLinking?: boolean;
      type: string;
    };
  },
  profileEmailVerified: unknown,
) {
  if (typeof profileEmailVerified === "boolean") {
    return profileEmailVerified;
  }

  return (
    (args.provider.type === "oauth" || args.provider.type === "oidc") &&
    args.provider.allowDangerousEmailAccountLinking !== false
  );
}

function canLinkViaEmail(
  args: {
    provider: {
      allowDangerousEmailAccountLinking?: boolean;
      type: string;
    };
    shouldLink?: boolean;
  },
  emailVerified: boolean,
) {
  const extendedArgs = args as {
    shouldLink?: boolean;
    shouldLinkViaEmail?: boolean;
  };

  return (
    extendedArgs.shouldLink === true ||
    extendedArgs.shouldLinkViaEmail === true ||
    emailVerified ||
    args.provider.type === "email"
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
