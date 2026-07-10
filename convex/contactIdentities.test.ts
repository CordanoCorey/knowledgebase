/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DEFAULT_USER_SEEDS } from "./seedOrganizations";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./appAccess.ts": () => import("./appAccess"),
  "./auth.ts": () => import("./auth"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
  "./contactIdentities.ts": () => import("./contactIdentities"),
  "./organizationAccounts.ts": () => import("./organizationAccounts"),
  "./seedOrganizations.ts": () => import("./seedOrganizations"),
  "./seedOrganizationsAction.ts": () => import("./seedOrganizationsAction"),
};

type SeedActionTestResult = {
  users: Array<{
    email: string;
    userId: Id<"users">;
  }>;
};
type AppAccessTestState =
  | { status: "unauthenticated" }
  | {
      email?: string;
      status: "inactiveUser" | "needsOrganization";
      userId: Id<"users">;
    }
  | {
      email?: string;
      organizations: Array<{
        name: string;
        organizationKind: string;
        role: string;
      }>;
      status: "allowed";
      systemRole?: "systemAdmin";
      userId: Id<"users">;
    };

describe("Contact identities", () => {
  test("verifies an alternate email and claims its pending organization memberships", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const adminUser = getSeededUser(seed.users, DEFAULT_USER_SEEDS[0].email);
    const admin = t.withIdentity({
      subject: `${adminUser.userId}|test-session`,
    });

    const archePendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "Alternate.Claim@Example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const churchPendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "alternate.claim@example.com",
        organizationId: "ruler-of-kings-church",
        role: "admin",
      },
    );
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "personal@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Personal Account",
      });
    });
    const claimant = t.withIdentity({ subject: `${userId}|test-session` });

    const requested = await claimant.mutation(
      api.contactIdentities.requestEmailVerification,
      {
        email: "Alternate.Claim@Example.com",
      },
    );

    expect(requested).toMatchObject({
      email: "alternate.claim@example.com",
      verificationStatus: "pending",
    });

    const verificationCode = await t.run(async (ctx) => {
      const contactIdentity = await ctx.db
        .query("contactIdentities")
        .withIndex("by_userId_and_contactKind_and_value", (q) =>
          q
            .eq("userId", userId)
            .eq("contactKind", "email")
            .eq("value", "alternate.claim@example.com"),
        )
        .unique();

      return contactIdentity?.verificationCode ?? null;
    });
    if (!verificationCode) {
      throw new Error("Missing verification code.");
    }
    const claimed = await claimant.mutation(
      api.contactIdentities.verifyEmailAndClaimPendingMemberships,
      {
        code: verificationCode,
        email: "alternate.claim@example.com",
      },
    );

    expect(claimed).toMatchObject({
      claimedMembershipCount: 2,
      email: "alternate.claim@example.com",
      memberships: expect.arrayContaining([
        {
          membershipId: archePendingMember.membershipId,
          organizationReferentId: expect.any(String),
          role: "member",
        },
        {
          membershipId: churchPendingMember.membershipId,
          organizationReferentId: expect.any(String),
          role: "admin",
        },
      ]),
      verificationStatus: "verified",
    });

    const stored = await t.run(async (ctx) => {
      const contactIdentity = await ctx.db
        .query("contactIdentities")
        .withIndex("by_userId_and_contactKind_and_value", (q) =>
          q
            .eq("userId", userId)
            .eq("contactKind", "email")
            .eq("value", "alternate.claim@example.com"),
        )
        .unique();

      return {
        archeMembership: await ctx.db.get(archePendingMember.membershipId),
        churchMembership: await ctx.db.get(churchPendingMember.membershipId),
        membershipClaims: await ctx.db
          .query("membershipClaims")
          .withIndex("by_claimedByUserId_and_createdAt", (q) =>
            q.eq("claimedByUserId", userId),
          )
          .take(10),
        contactIdentity,
        user: await ctx.db.get(userId),
      };
    });

    expect(stored.user?.isActive).toBe(true);
    expect(stored.contactIdentity).toMatchObject({
      userId,
      verificationStatus: "verified",
    });
    expect(stored.contactIdentity?.verificationCode).toBeUndefined();
    expect(stored.archeMembership).toMatchObject({
      memberUserId: userId,
      membershipStatus: "active",
    });
    expect(stored.churchMembership).toMatchObject({
      memberUserId: userId,
      membershipStatus: "active",
    });
    expect(stored.membershipClaims).toHaveLength(2);
    expect(stored.membershipClaims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimedByUserId: userId,
          claimedContactKind: "email",
          claimedContactValue: "alternate.claim@example.com",
          claimSource: "verifiedContactIdentity",
          membershipId: archePendingMember.membershipId,
          organizationReferentId: stored.archeMembership?.organizationReferentId,
          resultingPersonReferentId: stored.archeMembership?.personReferentId,
          verifiedContactIdentityId: stored.contactIdentity?._id,
        }),
        expect.objectContaining({
          claimedByUserId: userId,
          claimedContactKind: "email",
          claimedContactValue: "alternate.claim@example.com",
          claimSource: "verifiedContactIdentity",
          membershipId: churchPendingMember.membershipId,
          organizationReferentId: stored.churchMembership?.organizationReferentId,
          resultingPersonReferentId: stored.churchMembership?.personReferentId,
          verifiedContactIdentityId: stored.contactIdentity?._id,
        }),
      ]),
    );
    expect(
      stored.membershipClaims.every(
        (claim) =>
          claim.pendingPersonReferentId !== claim.resultingPersonReferentId,
      ),
    ).toBe(true);

    const access = (await claimant.query(
      api.appAccess.getCurrentUserAccess,
      {},
    )) as AppAccessTestState;
    expect(access.status).toBe("allowed");
    if (access.status !== "allowed") {
      throw new Error("Expected claimed memberships to grant app access.");
    }
    expect(access.organizations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Arche Classical Academy",
          organizationKind: "school",
          role: "member",
        }),
        expect.objectContaining({
          name: "Ruler of Kings Church",
          organizationKind: "church",
          role: "admin",
        }),
      ]),
    );
  });

  test("creates a Person Consolidation review instead of claiming a richer placeholder Person", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const adminUser = getSeededUser(seed.users, DEFAULT_USER_SEEDS[0].email);
    const archeAdminUser = getSeededUser(
      seed.users,
      DEFAULT_USER_SEEDS[2].email,
    );
    const archeMemberUser = getSeededUser(
      seed.users,
      DEFAULT_USER_SEEDS[1].email,
    );
    const admin = t.withIdentity({
      subject: `${adminUser.userId}|test-session`,
    });

    const pendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "needs.review@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "personal.review@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Personal Review",
      });
    });
    const pendingPersonReferentId = await t.run(async (ctx) => {
      const membership = await ctx.db.get(pendingMember.membershipId);
      if (!membership) {
        throw new Error("Missing pending membership.");
      }
      const personDetail = await ctx.db
        .query("personReferentDetails")
        .withIndex("by_referentId", (q) =>
          q.eq("referentId", membership.personReferentId),
        )
        .unique();
      if (!personDetail) {
        throw new Error("Missing pending person detail.");
      }

      await ctx.db.patch(membership.personReferentId, {
        canonicalName: "Head of School",
      });
      await ctx.db.patch(personDetail._id, {
        searchText: "Head of School needs.review@example.com",
      });

      return membership.personReferentId;
    });
    const claimant = t.withIdentity({ subject: `${userId}|test-session` });

    await claimant.mutation(api.contactIdentities.requestEmailVerification, {
      email: "needs.review@example.com",
    });
    const verificationCode = await t.run(async (ctx) => {
      const contactIdentity = await ctx.db
        .query("contactIdentities")
        .withIndex("by_userId_and_contactKind_and_value", (q) =>
          q
            .eq("userId", userId)
            .eq("contactKind", "email")
            .eq("value", "needs.review@example.com"),
        )
        .unique();

      return contactIdentity?.verificationCode ?? null;
    });
    if (!verificationCode) {
      throw new Error("Missing verification code.");
    }

    const claimed = await claimant.mutation(
      api.contactIdentities.verifyEmailAndClaimPendingMemberships,
      {
        code: verificationCode,
        email: "needs.review@example.com",
      },
    );
    const secondClaim = await claimant.mutation(
      api.contactIdentities.claimVerifiedEmailMemberships,
      {
        email: "needs.review@example.com",
      },
    );

    expect(claimed).toMatchObject({
      claimedMembershipCount: 0,
      email: "needs.review@example.com",
      memberships: [],
      personConsolidationReviewCount: 1,
      personConsolidationReviews: [
        {
          membershipId: pendingMember.membershipId,
          organizationReferentId: expect.any(String),
          role: "member",
        },
      ],
      verificationStatus: "verified",
    });
    expect(secondClaim).toMatchObject({
      claimedMembershipCount: 0,
      email: "needs.review@example.com",
      memberships: [],
      personConsolidationReviewCount: 1,
      personConsolidationReviews: [
        {
          membershipId: pendingMember.membershipId,
          organizationReferentId: expect.any(String),
          role: "member",
        },
      ],
      verificationStatus: "verified",
    });

    const stored = await t.run(async (ctx) => {
      const membership = await ctx.db.get(pendingMember.membershipId);
      const contactIdentity = await ctx.db
        .query("contactIdentities")
        .withIndex("by_userId_and_contactKind_and_value", (q) =>
          q
            .eq("userId", userId)
            .eq("contactKind", "email")
            .eq("value", "needs.review@example.com"),
        )
        .unique();
      const userProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();

      const reviews = await ctx.db
        .query("personConsolidationReviews")
        .withIndex(
          "by_membershipId_and_requestedByUserId_and_reviewStatus",
          (q) =>
            q
              .eq("membershipId", pendingMember.membershipId)
              .eq("requestedByUserId", userId)
              .eq("reviewStatus", "pending"),
        )
        .take(10);
      const reviewNotifications =
        reviews[0] === undefined
          ? []
          : await ctx.db
              .query("userNotifications")
              .withIndex("by_sourceSubscriptionKey_and_receivedAt", (q) =>
                q.eq(
                  "sourceSubscriptionKey",
                  `person-consolidation-review:${reviews[0]._id}:requested`,
                ),
              )
              .take(10);

      return {
        contactIdentity,
        membership,
        membershipClaims: await ctx.db
          .query("membershipClaims")
          .withIndex("by_claimedByUserId_and_createdAt", (q) =>
            q.eq("claimedByUserId", userId),
          )
          .take(10),
        reviewNotifications,
        reviews,
        user: await ctx.db.get(userId),
        userProfile,
      };
    });

    expect(stored.user?.isActive).toBe(false);
    expect(stored.contactIdentity).toMatchObject({
      userId,
      verificationStatus: "verified",
    });
    expect(stored.membership).toMatchObject({
      membershipStatus: "invited",
      personReferentId: pendingPersonReferentId,
    });
    expect(stored.membership?.memberUserId).toBeUndefined();
    expect(stored.membershipClaims).toEqual([]);
    expect(stored.reviews).toHaveLength(1);
    expect(stored.reviews[0]).toMatchObject({
      candidatePersonReferentId: stored.userProfile?.personReferentId,
      claimedContactKind: "email",
      claimedContactValue: "needs.review@example.com",
      claimSource: "verifiedContactIdentity",
      membershipId: pendingMember.membershipId,
      organizationReferentId: stored.membership?.organizationReferentId,
      pendingPersonReferentId,
      requestedByUserId: userId,
      reviewReason: "placeholderHasMeaningfulIdentity",
      reviewStatus: "pending",
      verifiedContactIdentityId: stored.contactIdentity?._id,
    });
    expect(stored.reviewNotifications).toHaveLength(2);
    expect(
      stored.reviewNotifications.map((notification) => notification.userId).sort(),
    ).toEqual([adminUser.userId, archeAdminUser.userId].sort());
    expect(
      stored.reviewNotifications.some(
        (notification) => notification.userId === archeMemberUser.userId,
      ),
    ).toBe(false);
    expect(stored.reviewNotifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: expect.stringContaining("needs.review@example.com"),
          contextHref: "/organizations/arche-classical-academy/settings",
          contextLabel: "Arche Classical Academy",
          notificationKind: "access",
          notificationStatus: "unread",
          sourceKind: "system",
          sourceSubscriptionKey: `person-consolidation-review:${stored.reviews[0]._id}:requested`,
          targetReferentId: stored.membership?.organizationReferentId,
          title: "Identity review needed",
        }),
      ]),
    );
  });

  test("notifies the claimant when a Person Consolidation review is approved", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const adminUser = getSeededUser(seed.users, DEFAULT_USER_SEEDS[0].email);
    const admin = t.withIdentity({
      subject: `${adminUser.userId}|test-session`,
    });

    const pendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "approved.review@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "approved.review.owner@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Approved Review Owner",
      });
    });
    await t.run(async (ctx) => {
      const membership = await ctx.db.get(pendingMember.membershipId);
      if (!membership) {
        throw new Error("Missing pending membership.");
      }
      const personDetail = await ctx.db
        .query("personReferentDetails")
        .withIndex("by_referentId", (q) =>
          q.eq("referentId", membership.personReferentId),
        )
        .unique();
      if (!personDetail) {
        throw new Error("Missing pending person detail.");
      }

      await ctx.db.patch(membership.personReferentId, {
        canonicalName: "Approved Review",
      });
      await ctx.db.patch(personDetail._id, {
        searchText: "Approved Review approved.review@example.com",
      });
    });
    const claimant = t.withIdentity({ subject: `${userId}|test-session` });

    await claimant.mutation(api.contactIdentities.requestEmailVerification, {
      email: "approved.review@example.com",
    });
    const verificationCode = await t.run(async (ctx) => {
      const contactIdentity = await ctx.db
        .query("contactIdentities")
        .withIndex("by_userId_and_contactKind_and_value", (q) =>
          q
            .eq("userId", userId)
            .eq("contactKind", "email")
            .eq("value", "approved.review@example.com"),
        )
        .unique();

      return contactIdentity?.verificationCode ?? null;
    });
    if (!verificationCode) {
      throw new Error("Missing verification code.");
    }

    await claimant.mutation(
      api.contactIdentities.verifyEmailAndClaimPendingMemberships,
      {
        code: verificationCode,
        email: "approved.review@example.com",
      },
    );

    const reviewId = await t.run(async (ctx) => {
      const review = (
        await ctx.db
          .query("personConsolidationReviews")
          .withIndex(
            "by_membershipId_and_requestedByUserId_and_reviewStatus",
            (q) =>
              q
                .eq("membershipId", pendingMember.membershipId)
                .eq("requestedByUserId", userId)
                .eq("reviewStatus", "pending"),
          )
          .take(10)
      )[0];

      return review?._id ?? null;
    });
    if (!reviewId) {
      throw new Error("Missing Person Consolidation review.");
    }

    await admin.mutation(
      api.organizationAccounts.approvePersonConsolidationReview,
      {
        organizationId: "arche-classical-academy",
        personConsolidationReviewId: reviewId,
      },
    );

    const stored = await t.run(async (ctx) => {
      return {
        membership: await ctx.db.get(pendingMember.membershipId),
        notifications: await ctx.db
          .query("userNotifications")
          .withIndex("by_sourceSubscriptionKey_and_receivedAt", (q) =>
            q.eq(
              "sourceSubscriptionKey",
              `person-consolidation-review:${reviewId}:approved`,
            ),
          )
          .take(10),
        user: await ctx.db.get(userId),
      };
    });

    expect(stored.user?.isActive).toBe(true);
    expect(stored.membership).toMatchObject({
      memberUserId: userId,
      membershipStatus: "active",
    });
    expect(stored.notifications).toHaveLength(1);
    expect(stored.notifications[0]).toMatchObject({
      body: expect.stringContaining("approved.review@example.com"),
      contextHref: "/organizations/arche-classical-academy",
      contextLabel: "Arche Classical Academy",
      notificationKind: "access",
      notificationStatus: "unread",
      sourceKind: "system",
      targetReferentId: stored.membership?.organizationReferentId,
      title: "Membership claim approved",
      userId,
    });
  });

  test("returns a rejected review result instead of reopening a rejected Person Consolidation review", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const adminUser = getSeededUser(seed.users, DEFAULT_USER_SEEDS[0].email);
    const admin = t.withIdentity({
      subject: `${adminUser.userId}|test-session`,
    });

    const pendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "rejected.review@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "rejected.review.owner@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Rejected Review Owner",
      });
    });
    await t.run(async (ctx) => {
      const membership = await ctx.db.get(pendingMember.membershipId);
      if (!membership) {
        throw new Error("Missing pending membership.");
      }
      const personDetail = await ctx.db
        .query("personReferentDetails")
        .withIndex("by_referentId", (q) =>
          q.eq("referentId", membership.personReferentId),
        )
        .unique();
      if (!personDetail) {
        throw new Error("Missing pending person detail.");
      }

      await ctx.db.patch(membership.personReferentId, {
        canonicalName: "Rejected Review",
      });
      await ctx.db.patch(personDetail._id, {
        searchText: "Rejected Review rejected.review@example.com",
      });
    });
    const claimant = t.withIdentity({ subject: `${userId}|test-session` });

    await claimant.mutation(api.contactIdentities.requestEmailVerification, {
      email: "rejected.review@example.com",
    });
    const verificationCode = await t.run(async (ctx) => {
      const contactIdentity = await ctx.db
        .query("contactIdentities")
        .withIndex("by_userId_and_contactKind_and_value", (q) =>
          q
            .eq("userId", userId)
            .eq("contactKind", "email")
            .eq("value", "rejected.review@example.com"),
        )
        .unique();

      return contactIdentity?.verificationCode ?? null;
    });
    if (!verificationCode) {
      throw new Error("Missing verification code.");
    }

    const firstClaim = await claimant.mutation(
      api.contactIdentities.verifyEmailAndClaimPendingMemberships,
      {
        code: verificationCode,
        email: "rejected.review@example.com",
      },
    );
    expect(firstClaim).toMatchObject({
      claimedMembershipCount: 0,
      memberships: [],
      personConsolidationReviewCount: 1,
      personConsolidationRejectionCount: 0,
      personConsolidationRejections: [],
    });

    const reviewId = await t.run(async (ctx) => {
      const review = (
        await ctx.db
          .query("personConsolidationReviews")
          .withIndex(
            "by_membershipId_and_requestedByUserId_and_reviewStatus",
            (q) =>
              q
                .eq("membershipId", pendingMember.membershipId)
                .eq("requestedByUserId", userId)
                .eq("reviewStatus", "pending"),
          )
          .take(10)
      )[0];

      return review?._id ?? null;
    });
    if (!reviewId) {
      throw new Error("Missing Person Consolidation review.");
    }
    await admin.mutation(
      api.organizationAccounts.rejectPersonConsolidationReview,
      {
        organizationId: "arche-classical-academy",
        personConsolidationReviewId: reviewId,
      },
    );

    const verifyRetryClaim = await claimant.mutation(
      api.contactIdentities.verifyEmailAndClaimPendingMemberships,
      {
        code: "000000",
        email: "rejected.review@example.com",
      },
    );
    const verifiedRetryClaim = await claimant.mutation(
      api.contactIdentities.claimVerifiedEmailMemberships,
      {
        email: "rejected.review@example.com",
      },
    );

    expect(verifyRetryClaim).toMatchObject({
      claimedMembershipCount: 0,
      email: "rejected.review@example.com",
      memberships: [],
      personConsolidationReviewCount: 0,
      personConsolidationReviews: [],
      personConsolidationRejectionCount: 1,
      personConsolidationRejections: [
        {
          membershipId: pendingMember.membershipId,
          organizationReferentId: expect.any(String),
          role: "member",
        },
      ],
      verificationStatus: "verified",
    });
    expect(verifiedRetryClaim).toMatchObject({
      claimedMembershipCount: 0,
      email: "rejected.review@example.com",
      memberships: [],
      personConsolidationReviewCount: 0,
      personConsolidationReviews: [],
      personConsolidationRejectionCount: 1,
      personConsolidationRejections: [
        {
          membershipId: pendingMember.membershipId,
          organizationReferentId: expect.any(String),
          role: "member",
        },
      ],
      verificationStatus: "verified",
    });

    const stored = await t.run(async (ctx) => {
      return {
        membership: await ctx.db.get(pendingMember.membershipId),
        membershipClaims: await ctx.db
          .query("membershipClaims")
          .withIndex("by_claimedByUserId_and_createdAt", (q) =>
            q.eq("claimedByUserId", userId),
          )
          .take(10),
        pendingReviews: await ctx.db
          .query("personConsolidationReviews")
          .withIndex(
            "by_membershipId_and_requestedByUserId_and_reviewStatus",
            (q) =>
              q
                .eq("membershipId", pendingMember.membershipId)
                .eq("requestedByUserId", userId)
                .eq("reviewStatus", "pending"),
          )
          .take(10),
        outcomeNotifications: await ctx.db
          .query("userNotifications")
          .withIndex("by_sourceSubscriptionKey_and_receivedAt", (q) =>
            q.eq(
              "sourceSubscriptionKey",
              `person-consolidation-review:${reviewId}:rejected`,
            ),
          )
          .take(10),
        rejectedReviews: await ctx.db
          .query("personConsolidationReviews")
          .withIndex(
            "by_membershipId_and_requestedByUserId_and_reviewStatus",
            (q) =>
              q
                .eq("membershipId", pendingMember.membershipId)
                .eq("requestedByUserId", userId)
                .eq("reviewStatus", "rejected"),
          )
          .take(10),
        user: await ctx.db.get(userId),
      };
    });

    expect(stored.user?.isActive).toBe(false);
    expect(stored.membership).toMatchObject({
      membershipStatus: "invited",
    });
    expect(stored.membership?.memberUserId).toBeUndefined();
    expect(stored.membershipClaims).toEqual([]);
    expect(stored.pendingReviews).toEqual([]);
    expect(stored.outcomeNotifications).toHaveLength(1);
    expect(stored.outcomeNotifications[0]).toMatchObject({
      body: expect.stringContaining("not approved after identity review"),
      contextHref: "/organizations/arche-classical-academy",
      contextLabel: "Arche Classical Academy",
      notificationKind: "access",
      notificationStatus: "unread",
      sourceKind: "system",
      title: "Membership claim not approved",
      userId,
    });
    expect(stored.rejectedReviews).toHaveLength(1);
    expect(stored.rejectedReviews[0]).toMatchObject({
      claimedContactKind: "email",
      claimedContactValue: "rejected.review@example.com",
      membershipId: pendingMember.membershipId,
      requestedByUserId: userId,
      reviewStatus: "rejected",
    });

    const reopened = await admin.mutation(
      api.organizationAccounts.reopenPersonConsolidationReview,
      {
        organizationId: "arche-classical-academy",
        personConsolidationReviewId: reviewId,
      },
    );
    expect(reopened).toEqual({
      membershipId: pendingMember.membershipId,
      reviewStatus: "pending",
    });

    const reopenedClaim = await claimant.mutation(
      api.contactIdentities.claimVerifiedEmailMemberships,
      {
        email: "rejected.review@example.com",
      },
    );
    expect(reopenedClaim).toMatchObject({
      claimedMembershipCount: 0,
      email: "rejected.review@example.com",
      memberships: [],
      personConsolidationReviewCount: 1,
      personConsolidationReviews: [
        {
          membershipId: pendingMember.membershipId,
          organizationReferentId: expect.any(String),
          role: "member",
        },
      ],
      personConsolidationRejectionCount: 0,
      personConsolidationRejections: [],
      verificationStatus: "verified",
    });

    const reopenedStored = await t.run(async (ctx) => {
      return {
        pendingReviews: await ctx.db
          .query("personConsolidationReviews")
          .withIndex(
            "by_membershipId_and_requestedByUserId_and_reviewStatus",
            (q) =>
              q
                .eq("membershipId", pendingMember.membershipId)
                .eq("requestedByUserId", userId)
                .eq("reviewStatus", "pending"),
          )
          .take(10),
        rejectedReviews: await ctx.db
          .query("personConsolidationReviews")
          .withIndex(
            "by_membershipId_and_requestedByUserId_and_reviewStatus",
            (q) =>
              q
                .eq("membershipId", pendingMember.membershipId)
                .eq("requestedByUserId", userId)
                .eq("reviewStatus", "rejected"),
          )
          .take(10),
      };
    });
    expect(reopenedStored.pendingReviews).toHaveLength(1);
    expect(reopenedStored.pendingReviews[0]).toMatchObject({
      claimedContactKind: "email",
      claimedContactValue: "rejected.review@example.com",
      membershipId: pendingMember.membershipId,
      requestedByUserId: userId,
      reviewStatus: "pending",
    });
    expect(reopenedStored.pendingReviews[0]?.resolvedAt).toBeUndefined();
    expect(reopenedStored.pendingReviews[0]?.resolvedByUserId).toBeUndefined();
    expect(reopenedStored.rejectedReviews).toEqual([]);
  });

  test("rejects an incorrect alternate email verification code without claiming", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const adminUser = getSeededUser(seed.users, DEFAULT_USER_SEEDS[0].email);
    const pendingMember = await t
      .withIdentity({ subject: `${adminUser.userId}|test-session` })
      .mutation(api.organizationAccounts.addOrganizationMember, {
        email: "wrong-code@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "wrong-code-owner@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Wrong Code Owner",
      });
    });
    const claimant = t.withIdentity({ subject: `${userId}|test-session` });

    await claimant.mutation(api.contactIdentities.requestEmailVerification, {
      email: "wrong-code@example.com",
    });
    const verificationCode = await t.run(async (ctx) => {
      const contactIdentity = await ctx.db
        .query("contactIdentities")
        .withIndex("by_userId_and_contactKind_and_value", (q) =>
          q
            .eq("userId", userId)
            .eq("contactKind", "email")
            .eq("value", "wrong-code@example.com"),
        )
        .unique();

      return contactIdentity?.verificationCode ?? null;
    });
    if (!verificationCode) {
      throw new Error("Missing verification code.");
    }
    const wrongCode = verificationCode === "000000" ? "000001" : "000000";

    await expect(
      claimant.mutation(
        api.contactIdentities.verifyEmailAndClaimPendingMemberships,
        {
          code: wrongCode,
          email: "wrong-code@example.com",
        },
      ),
    ).rejects.toThrow("Invalid verification code.");

    const stored = await t.run(async (ctx) => {
      return await ctx.db.get(pendingMember.membershipId);
    });
    expect(stored).toMatchObject({
      membershipStatus: "invited",
    });
    expect(stored?.memberUserId).toBeUndefined();
  });

  test("claims later pending memberships for an already verified alternate email", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const adminUser = getSeededUser(seed.users, DEFAULT_USER_SEEDS[0].email);
    const userId = await t.run(async (ctx) => {
      const now = Date.now();
      const insertedUserId = await ctx.db.insert("users", {
        email: "verified-owner@example.com",
        emailVerificationTime: now,
        isActive: false,
        name: "Verified Owner",
      });
      await ctx.db.insert("contactIdentities", {
        contactKind: "email",
        createdAt: now,
        updatedAt: now,
        userId: insertedUserId,
        value: "already-verified@example.com",
        verificationStatus: "verified",
        verifiedAt: now,
      });

      return insertedUserId;
    });
    const pendingMember = await t
      .withIdentity({ subject: `${adminUser.userId}|test-session` })
      .mutation(api.organizationAccounts.addOrganizationMember, {
        email: "already-verified@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      });

    const claimed = await t
      .withIdentity({ subject: `${userId}|test-session` })
      .mutation(api.contactIdentities.claimVerifiedEmailMemberships, {
        email: "already-verified@example.com",
      });

    expect(claimed).toMatchObject({
      claimedMembershipCount: 1,
      email: "already-verified@example.com",
      memberships: [
        {
          membershipId: pendingMember.membershipId,
          organizationReferentId: expect.any(String),
          role: "member",
        },
      ],
      verificationStatus: "verified",
    });

    const stored = await t.run(async (ctx) => {
      return {
        membershipClaims: await ctx.db
          .query("membershipClaims")
          .withIndex("by_claimedByUserId_and_createdAt", (q) =>
            q.eq("claimedByUserId", userId),
          )
          .take(10),
        membership: await ctx.db.get(pendingMember.membershipId),
        user: await ctx.db.get(userId),
      };
    });
    expect(stored.user?.isActive).toBe(true);
    expect(stored.membership).toMatchObject({
      memberUserId: userId,
      membershipStatus: "active",
    });
    expect(stored.membershipClaims).toEqual([
      expect.objectContaining({
        claimedByUserId: userId,
        claimedContactKind: "email",
        claimedContactValue: "already-verified@example.com",
        claimSource: "verifiedContactIdentity",
        membershipId: pendingMember.membershipId,
        organizationReferentId: stored.membership?.organizationReferentId,
        resultingPersonReferentId: stored.membership?.personReferentId,
      }),
    ]);
  });

  test("does not let one user verify an email already owned by another user", async () => {
    const t = convexTest({ schema, modules });
    const ownerUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owned@example.com",
        emailVerificationTime: Date.now(),
        isActive: true,
        name: "Owned Email",
      });
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("contactIdentities", {
        contactKind: "email",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userId: ownerUserId,
        value: "owned@example.com",
        verificationStatus: "verified",
        verifiedAt: Date.now(),
      });
    });
    const claimantUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "claimant@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Claimant",
      });
    });

    await expect(
      t
        .withIdentity({ subject: `${claimantUserId}|test-session` })
        .mutation(api.contactIdentities.requestEmailVerification, {
          email: "owned@example.com",
        }),
    ).rejects.toThrow("Email is already in use by another user.");
  });
});

function getSeededUser(
  users: Array<{ email: string; userId: Id<"users"> }>,
  email: string,
) {
  const user = users.find((candidate) => candidate.email === email);
  if (!user) {
    throw new Error(`Missing seeded user ${email}.`);
  }
  return user;
}
