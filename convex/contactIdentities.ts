import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { claimPendingOrganizationMembershipsForVerifiedEmail } from "./lib/pendingMembershipClaims";
import { organizationMembershipRole } from "./lib/organizationRoles";

const VERIFICATION_CODE_TTL_MS = 30 * 60 * 1000;

const contactIdentitySummary = v.object({
  email: v.string(),
  id: v.id("contactIdentities"),
  verificationStatus: v.union(v.literal("pending"), v.literal("verified")),
  verifiedAt: v.optional(v.number()),
});

const claimedMembership = v.object({
  membershipId: v.id("memberships"),
  organizationReferentId: v.id("referents"),
  role: organizationMembershipRole,
});
const personConsolidationReviewMembership = claimedMembership;

const contactIdentityClaimResult = v.object({
  claimedMembershipCount: v.number(),
  email: v.string(),
  memberships: v.array(claimedMembership),
  personConsolidationReviewCount: v.number(),
  personConsolidationReviews: v.array(personConsolidationReviewMembership),
  verificationStatus: v.literal("verified"),
});
const emailVerificationRequestResult = v.object({
  contactIdentityId: v.id("contactIdentities"),
  email: v.string(),
  verificationStatus: v.union(v.literal("pending"), v.literal("verified")),
});
const emailVerificationDeliveryResult = v.object({
  contactIdentityId: v.id("contactIdentities"),
  email: v.string(),
  verificationStatus: v.union(v.literal("pending"), v.literal("verified")),
});
const emailVerificationDeliveryRequest = v.object({
  contactIdentityId: v.id("contactIdentities"),
  email: v.string(),
  verificationCode: v.optional(v.string()),
  verificationStatus: v.union(v.literal("pending"), v.literal("verified")),
});

type ContactIdentityCtx = QueryCtx | MutationCtx;
type EmailVerificationDeliveryRequestResult = {
  contactIdentityId: Id<"contactIdentities">;
  email: string;
  verificationCode?: string;
  verificationStatus: "pending" | "verified";
};
type EmailVerificationDeliveryResult = {
  contactIdentityId: Id<"contactIdentities">;
  email: string;
  verificationStatus: "pending" | "verified";
};

export const listForCurrentUser = query({
  args: {},
  returns: v.object({
    contactIdentities: v.array(contactIdentitySummary),
    primaryEmail: v.optional(v.string()),
    primaryEmailVerified: v.boolean(),
  }),
  handler: async (ctx) => {
    const { user, userId } = await requireCurrentUser(ctx);
    const contactIdentities = await ctx.db
      .query("contactIdentities")
      .withIndex("by_userId_and_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    return {
      contactIdentities: contactIdentities.map((identity) => ({
        email: identity.value,
        id: identity._id,
        verificationStatus: identity.verificationStatus,
        ...(identity.verifiedAt === undefined
          ? {}
          : { verifiedAt: identity.verifiedAt }),
      })),
      ...(user.email === undefined ? {} : { primaryEmail: user.email }),
      primaryEmailVerified: user.emailVerificationTime !== undefined,
    };
  },
});

export const requestEmailVerification = mutation({
  args: {
    email: v.string(),
  },
  returns: emailVerificationRequestResult,
  handler: async (ctx, args) => {
    const result = await createEmailVerificationRequest(ctx, args.email);

    return {
      contactIdentityId: result.contactIdentityId,
      email: result.email,
      verificationStatus: result.verificationStatus,
    };
  },
});

export const sendEmailVerificationCode = action({
  args: {
    email: v.string(),
  },
  returns: emailVerificationDeliveryResult,
  handler: async (ctx, args): Promise<EmailVerificationDeliveryResult> => {
    const result: EmailVerificationDeliveryRequestResult =
      await ctx.runMutation(
        internal.contactIdentities.requestEmailVerificationForDelivery,
        args,
      );
    if (result.verificationStatus === "verified") {
      return {
        contactIdentityId: result.contactIdentityId,
        email: result.email,
        verificationStatus: result.verificationStatus,
      };
    }
    if (!result.verificationCode) {
      throw new Error("Verification code setup failed.");
    }

    await sendVerificationEmail(result.email, result.verificationCode);

    return {
      contactIdentityId: result.contactIdentityId,
      email: result.email,
      verificationStatus: result.verificationStatus,
    };
  },
});

export const requestEmailVerificationForDelivery = internalMutation({
  args: {
    email: v.string(),
  },
  returns: emailVerificationDeliveryRequest,
  handler: async (ctx, args) => {
    return await createEmailVerificationRequest(ctx, args.email);
  },
});

async function createEmailVerificationRequest(
  ctx: MutationCtx,
  requestedEmail: string,
) {
  const { user, userId } = await requireCurrentUser(ctx);
  const email = normalizeEmail(requestedEmail);
  if (!isEmailLike(email)) {
    throw new Error("Enter a valid email address.");
  }

  await assertEmailAvailableForUser(ctx, email, userId);
  const now = Date.now();
  const existingIdentity = await getContactIdentityForUser(ctx, userId, email);
  const isPrimaryVerified = isVerifiedPrimaryEmail(user, email);

  if (existingIdentity) {
    if (
      existingIdentity.verificationStatus === "verified" ||
      isPrimaryVerified
    ) {
      if (existingIdentity.verificationStatus !== "verified") {
        await ctx.db.patch(existingIdentity._id, {
          verificationCode: undefined,
          verificationCodeExpiresAt: undefined,
          verificationStatus: "verified",
          verifiedAt: user.emailVerificationTime ?? now,
          updatedAt: now,
        });
      }

      return {
        contactIdentityId: existingIdentity._id,
        email,
        verificationCode: undefined,
        verificationStatus: "verified" as const,
      };
    }

    const verificationCode = createVerificationCode();
    await ctx.db.patch(existingIdentity._id, {
      lastRequestedAt: now,
      verificationCode,
      verificationCodeExpiresAt: now + VERIFICATION_CODE_TTL_MS,
      verificationStatus: "pending",
      updatedAt: now,
    });

    return {
      contactIdentityId: existingIdentity._id,
      email,
      verificationCode,
      verificationStatus: "pending" as const,
    };
  }

  const verificationCode = isPrimaryVerified
    ? undefined
    : createVerificationCode();
  const verificationStatus = isPrimaryVerified
    ? ("verified" as const)
    : ("pending" as const);
  const contactIdentityId = await ctx.db.insert("contactIdentities", {
    contactKind: "email",
    createdAt: now,
    lastRequestedAt: now,
    userId,
    value: email,
    verificationCode,
    verificationCodeExpiresAt: isPrimaryVerified
      ? undefined
      : now + VERIFICATION_CODE_TTL_MS,
    verificationStatus,
    updatedAt: now,
    ...(isPrimaryVerified
      ? { verifiedAt: user.emailVerificationTime ?? now }
      : {}),
  });

  return {
    contactIdentityId,
    email,
    verificationCode,
    verificationStatus,
  };
}

export const verifyEmailAndClaimPendingMemberships = mutation({
  args: {
    code: v.string(),
    email: v.string(),
  },
  returns: contactIdentityClaimResult,
  handler: async (ctx, args) => {
    const { user, userId } = await requireCurrentUser(ctx);
    const email = normalizeEmail(args.email);
    if (!isEmailLike(email)) {
      throw new Error("Enter a valid email address.");
    }

    await assertEmailAvailableForUser(ctx, email, userId);
    const now = Date.now();
    const contactIdentity = await getContactIdentityForUser(ctx, userId, email);
    const isPrimaryVerified = isVerifiedPrimaryEmail(user, email);
    let verifiedContactIdentityId = contactIdentity?._id;

    if (!contactIdentity && !isPrimaryVerified) {
      throw new Error("Request a verification code first.");
    }

    if (contactIdentity && contactIdentity.verificationStatus !== "verified") {
      if (
        !contactIdentity.verificationCode ||
        !contactIdentity.verificationCodeExpiresAt
      ) {
        throw new Error("Request a verification code first.");
      }
      if (contactIdentity.verificationCodeExpiresAt < now) {
        throw new Error("Verification code expired.");
      }
      if (normalizeCode(args.code) !== contactIdentity.verificationCode) {
        throw new Error("Invalid verification code.");
      }

      await ctx.db.patch(contactIdentity._id, {
        verificationCode: undefined,
        verificationCodeExpiresAt: undefined,
        verificationStatus: "verified",
        verifiedAt: now,
        updatedAt: now,
      });
      verifiedContactIdentityId = contactIdentity._id;
    } else if (!contactIdentity && isPrimaryVerified) {
      verifiedContactIdentityId = await ctx.db.insert("contactIdentities", {
        contactKind: "email",
        createdAt: now,
        userId,
        value: email,
        verificationStatus: "verified",
        verifiedAt: user.emailVerificationTime ?? now,
        updatedAt: now,
      });
    }

    const claimResult =
      await claimPendingOrganizationMembershipsForVerifiedEmail(
        ctx,
        user,
        email,
        now,
        {
          claimSource: isPrimaryVerified
            ? "verifiedPrimaryEmail"
            : "verifiedContactIdentity",
          ...(verifiedContactIdentityId === undefined
            ? {}
            : { verifiedContactIdentityId }),
        },
      );

    return {
      claimedMembershipCount: claimResult.claimedMemberships.length,
      email,
      memberships: claimResult.claimedMemberships,
      personConsolidationReviewCount:
        claimResult.personConsolidationReviews.length,
      personConsolidationReviews: claimResult.personConsolidationReviews,
      verificationStatus: "verified" as const,
    };
  },
});

export const claimVerifiedEmailMemberships = mutation({
  args: {
    email: v.string(),
  },
  returns: contactIdentityClaimResult,
  handler: async (ctx, args) => {
    const { user, userId } = await requireCurrentUser(ctx);
    const email = normalizeEmail(args.email);
    if (!isEmailLike(email)) {
      throw new Error("Enter a valid email address.");
    }

    await assertEmailAvailableForUser(ctx, email, userId);
    const contactIdentity = await getContactIdentityForUser(ctx, userId, email);
    const isPrimaryVerified = isVerifiedPrimaryEmail(user, email);
    if (!contactIdentity && !isPrimaryVerified) {
      throw new Error("Verify that email before claiming memberships.");
    }
    if (
      contactIdentity &&
      contactIdentity.verificationStatus !== "verified"
    ) {
      throw new Error("Verify that email before claiming memberships.");
    }

    const claimResult =
      await claimPendingOrganizationMembershipsForVerifiedEmail(
        ctx,
        user,
        email,
        Date.now(),
        {
          claimSource: isPrimaryVerified
            ? "verifiedPrimaryEmail"
            : "verifiedContactIdentity",
          ...(contactIdentity?._id === undefined
            ? {}
            : { verifiedContactIdentityId: contactIdentity._id }),
        },
      );

    return {
      claimedMembershipCount: claimResult.claimedMemberships.length,
      email,
      memberships: claimResult.claimedMemberships,
      personConsolidationReviewCount:
        claimResult.personConsolidationReviews.length,
      personConsolidationReviews: claimResult.personConsolidationReviews,
      verificationStatus: "verified" as const,
    };
  },
});

async function requireCurrentUser(ctx: ContactIdentityCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Unauthorized");
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("Unauthorized");
  }

  return { user, userId };
}

async function assertEmailAvailableForUser(
  ctx: ContactIdentityCtx,
  email: string,
  userId: Id<"users">,
) {
  const usersWithEmail = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .take(2);
  const conflictingUser = usersWithEmail.find((user) => user._id !== userId);
  if (conflictingUser) {
    throw new Error("Email is already in use by another user.");
  }

  const verifiedContactIdentities = await ctx.db
    .query("contactIdentities")
    .withIndex("by_contactKind_and_value_and_verificationStatus", (q) =>
      q
        .eq("contactKind", "email")
        .eq("value", email)
        .eq("verificationStatus", "verified"),
    )
    .take(2);
  const conflictingIdentity = verifiedContactIdentities.find(
    (identity) => identity.userId !== userId,
  );
  if (conflictingIdentity) {
    throw new Error("Email is already verified by another user.");
  }
}

async function getContactIdentityForUser(
  ctx: ContactIdentityCtx,
  userId: Id<"users">,
  email: string,
) {
  const identities = await ctx.db
    .query("contactIdentities")
    .withIndex("by_userId_and_contactKind_and_value", (q) =>
      q.eq("userId", userId).eq("contactKind", "email").eq("value", email),
    )
    .take(2);
  if (identities.length > 1) {
    throw new Error("Multiple contact identities use that email.");
  }

  return identities[0] ?? null;
}

function isVerifiedPrimaryEmail(user: Doc<"users">, email: string) {
  return user.email === email && user.emailVerificationTime !== undefined;
}

function createVerificationCode() {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
}

async function sendVerificationEmail(email: string, verificationCode: string) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Email verification delivery is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from,
      subject: "Logeion membership claim code",
      text: [
        `Your Logeion membership claim code is ${verificationCode}.`,
        "It expires in 30 minutes.",
      ].join("\n"),
      to: email,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Could not send verification code.");
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeCode(code: string) {
  return code.trim();
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
