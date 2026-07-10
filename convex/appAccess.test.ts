/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { claimPendingOrganizationMembershipsForVerifiedEmail } from "./lib/pendingMembershipClaims";
import { DEFAULT_USER_SEEDS } from "./seedOrganizations";
import schema from "./schema";

const modules = {
  ...import.meta.glob("./_generated/*.*s"),
  "./appAccess.ts": () => import("./appAccess"),
  "./auth.ts": () => import("./auth"),
  "./authProviderConfig.ts": () => import("./authProviderConfig"),
  "./organizationAccounts.ts": () => import("./organizationAccounts"),
  "./seedOrganizations.ts": () => import("./seedOrganizations"),
  "./seedOrganizationsAction.ts": () => import("./seedOrganizationsAction"),
};

type SeedStats = {
  inserted: number;
  skipped: number;
  updated: number;
};
type SeedActionTestResult = {
  memberships: SeedStats;
  organizations: SeedStats;
  profiles: SeedStats;
  userRows: SeedStats;
  users: Array<{
    email: string;
    tempPassword: string;
    userId: Id<"users">;
  }>;
};
type SeedVerificationResult = {
  organizations: Array<{
    canonicalKey: string;
    exists: boolean;
    hasKnowledgeEntry: boolean;
    isActive: boolean | null;
    kind: string | null;
    name: string | null;
  }>;
  users: Array<{
    activeMemberships: Array<{
      organizationReferentId: Id<"referents"> | null;
      role: string | null;
    }>;
    email: string;
    exists: boolean;
    isActive: boolean | null;
  }>;
};
type OrganizationMembershipSettings = {
  members: Array<{
    claimEvidence?: {
      claimedAt: number;
      claimedContactKind: "email";
      claimedContactValue: string;
      claimSource: "verifiedContactIdentity" | "verifiedPrimaryEmail";
      personConsolidation?: {
        approvedAt: number;
        pendingPersonName: string;
        pendingPersonReferentId: Id<"referents">;
        resultingPersonName: string;
        resultingPersonReferentId: Id<"referents">;
        reviewId: Id<"personConsolidationReviews">;
      };
    };
    email?: string;
    membershipId: Id<"memberships">;
    name: string;
    personConsolidationReview?: {
      claimedContactKind: "email";
      claimedContactValue: string;
      claimSource: "verifiedContactIdentity" | "verifiedPrimaryEmail";
      requestedAt: number;
      requestedByEmail?: string;
      reviewId: Id<"personConsolidationReviews">;
      reviewReason: "placeholderHasMeaningfulIdentity";
      reviewStatus: "approved" | "pending" | "rejected";
      updatedAt: number;
    };
    role: "admin" | "member";
    status: "active" | "pending";
    userId?: Id<"users">;
  }>;
  name: string;
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

describe("App organization access", () => {
  test("seeds default organizations, temporary password users, and memberships", async () => {
    const t = convexTest({ schema, modules });

    const result = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;

    expect(result.users.map((user) => user.email)).toEqual(
      DEFAULT_USER_SEEDS.map((user) => user.email),
    );
    expect(result.users.map((user) => user.tempPassword)).toEqual(
      DEFAULT_USER_SEEDS.map((user) => user.tempPassword),
    );
    expect(result.organizations).toEqual({
      inserted: 4,
      skipped: 0,
      updated: 0,
    });
    expect(result.memberships).toEqual({
      inserted: 12,
      skipped: 0,
      updated: 0,
    });
    expect(result.profiles).toEqual({
      inserted: 3,
      skipped: 0,
      updated: 0,
    });
    expect(result.userRows).toEqual({
      inserted: 0,
      skipped: 2,
      updated: 1,
    });

    const secondResult = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    expect(secondResult.organizations).toEqual({
      inserted: 0,
      skipped: 4,
      updated: 0,
    });
    expect(secondResult.memberships).toEqual({
      inserted: 0,
      skipped: 12,
      updated: 0,
    });
    expect(secondResult.profiles).toEqual({
      inserted: 0,
      skipped: 3,
      updated: 0,
    });
    expect(secondResult.userRows).toEqual({
      inserted: 0,
      skipped: 3,
      updated: 0,
    });

    const verification = (await t.query(
      internal.seedOrganizations.verifyDefaultOrganizationsSeed,
      {},
    )) as SeedVerificationResult;
    expect(verification.organizations).toEqual([
      {
        canonicalKey: "arche-classical-academy",
        exists: true,
        hasKnowledgeEntry: false,
        isActive: true,
        kind: "school",
        name: "Arche Classical Academy",
      },
      {
        canonicalKey: "ruler-of-kings-church",
        exists: true,
        hasKnowledgeEntry: false,
        isActive: true,
        kind: "church",
        name: "Ruler of Kings Church",
      },
      {
        canonicalKey: "my-family",
        exists: true,
        hasKnowledgeEntry: false,
        isActive: true,
        kind: "family",
        name: "My Family",
      },
      {
        canonicalKey: "my-community",
        exists: true,
        hasKnowledgeEntry: false,
        isActive: true,
        kind: "community",
        name: "My Community",
      },
    ]);
    expect(
      verification.users.map((user) => ({
        email: user.email,
        exists: user.exists,
        isActive: user.isActive,
        membershipCount: user.activeMemberships.length,
      })),
    ).toEqual([
      {
        email: "gelbaughcm@gmail.com",
        exists: true,
        isActive: true,
        membershipCount: 4,
      },
      {
        email: "corey@rulerofkingschurch.com",
        exists: true,
        isActive: true,
        membershipCount: 4,
      },
      {
        email: "corey@archeclassicalacademy.com",
        exists: true,
        isActive: true,
        membershipCount: 4,
      },
    ]);

    const referenceEntryCounts = await t.run(async (ctx) => {
      const organizationEntries = [];
      for (const organization of verification.organizations) {
        const referent = await ctx.db
          .query("referents")
          .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
            q
              .eq("knowledgeType", "organization")
              .eq("canonicalKey", organization.canonicalKey),
          )
          .unique();
        if (!referent) {
          continue;
        }
        organizationEntries.push(
          ...(await ctx.db
            .query("knowledgeEntries")
            .withIndex("by_representedReferentId", (q) =>
              q.eq("representedReferentId", referent._id),
            )
            .take(10)),
        );
      }

      const userProfiles = await ctx.db.query("userProfiles").take(10);
      const userPersonEntries = [];
      for (const profile of userProfiles) {
        userPersonEntries.push(
          ...(await ctx.db
            .query("knowledgeEntries")
            .withIndex("by_representedReferentId", (q) =>
              q.eq("representedReferentId", profile.personReferentId),
            )
            .take(10)),
        );
      }

      return {
        organizationEntryCount: organizationEntries.length,
        userPersonEntryCount: userPersonEntries.length,
        userProfilesWithEntryCount: userProfiles.filter(
          (profile) => profile.personEntryId !== undefined,
        ).length,
      };
    });
    expect(referenceEntryCounts).toEqual({
      organizationEntryCount: 0,
      userPersonEntryCount: 0,
      userProfilesWithEntryCount: 0,
    });
  });

  test("allows an active seeded user with an active organization membership", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");

    const access = (await t
      .withIdentity({ subject: `${gelbaugh.userId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;

    expect(access.status).toBe("allowed");
    if (access.status !== "allowed") {
      throw new Error("Expected seeded user to have app access.");
    }
    expect(access.email).toBe("gelbaughcm@gmail.com");
    expect(access.systemRole).toBe("systemAdmin");
    expect(
      access.organizations.map((organization) => ({
        kind: organization.organizationKind,
        name: organization.name,
        role: organization.role,
      })),
    ).toEqual([
      {
        kind: "school",
        name: "Arche Classical Academy",
        role: "admin",
      },
      {
        kind: "church",
        name: "Ruler of Kings Church",
        role: "admin",
      },
      {
        kind: "family",
        name: "My Family",
        role: "admin",
      },
      {
        kind: "community",
        name: "My Community",
        role: "admin",
      },
    ]);
  });

  test("shows every active organization to system admins without memberships", async () => {
    const t = convexTest({ schema, modules });
    await t.action(internal.seedOrganizationsAction.seedDefaultOrganizations, {});
    const systemAdminUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "global.admin@example.com",
        isActive: true,
        name: "Global Admin",
        systemRole: "systemAdmin",
      });
    });

    const access = (await t
      .withIdentity({ subject: `${systemAdminUserId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;

    expect(access.status).toBe("allowed");
    if (access.status !== "allowed") {
      throw new Error("Expected system admin to have app access.");
    }
    expect(
      access.organizations.map((organization) => ({
        kind: organization.organizationKind,
        name: organization.name,
        role: organization.role,
      })),
    ).toEqual([
      {
        kind: "school",
        name: "Arche Classical Academy",
        role: "admin",
      },
      {
        kind: "church",
        name: "Ruler of Kings Church",
        role: "admin",
      },
      {
        kind: "family",
        name: "My Family",
        role: "admin",
      },
      {
        kind: "community",
        name: "My Community",
        role: "admin",
      },
    ]);
  });

  test("allows organization admins to add existing users with predefined roles", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");
    const newUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "new.member@example.com",
        isActive: false,
        name: "New Member",
      });
    });
    const admin = t.withIdentity({
      subject: `${gelbaugh.userId}|test-session`,
    });

    const member = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "New.Member@Example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );

    expect(member).toMatchObject({
      email: "new.member@example.com",
      name: "New Member",
      role: "member",
      userId: newUserId,
    });

    const promotedMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "new.member@example.com",
        organizationId: "arche-classical-academy",
        role: "admin",
      },
    );
    expect(promotedMember).toMatchObject({
      email: "new.member@example.com",
      name: "New Member",
      role: "admin",
      userId: newUserId,
    });

    const settings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;
    expect(settings.name).toBe("Arche Classical Academy");
    expect(
      settings.members.map((listedMember) => ({
        email: listedMember.email,
        role: listedMember.role,
        status: listedMember.status,
      })),
    ).toContainEqual({
      email: "new.member@example.com",
      role: "admin",
      status: "active",
    });

    const access = (await t
      .withIdentity({ subject: `${newUserId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;
    expect(access.status).toBe("allowed");
    if (access.status !== "allowed") {
      throw new Error("Expected added member to have app access.");
    }
    expect(access.organizations).toContainEqual({
      name: "Arche Classical Academy",
      organizationDetailId: expect.any(String),
      organizationKind: "school",
      organizationReferentId: expect.any(String),
      role: "admin",
    });
  });

  test("allows organization admins to add pending members before a user account exists", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");
    const admin = t.withIdentity({
      subject: `${gelbaugh.userId}|test-session`,
    });

    const member = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "Pending.Member@Example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );

    expect(member).toMatchObject({
      email: "pending.member@example.com",
      name: "pending.member@example.com",
      role: "member",
      status: "pending",
    });
    expect("userId" in member).toBe(false);

    const promotedMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "pending.member@example.com",
        organizationId: "arche-classical-academy",
        role: "admin",
      },
    );
    expect(promotedMember).toMatchObject({
      email: "pending.member@example.com",
      membershipId: member.membershipId,
      role: "admin",
      status: "pending",
    });
    expect("userId" in promotedMember).toBe(false);

    const stored = await t.run(async (ctx) => {
      const membership = await ctx.db.get(member.membershipId);
      const users = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "pending.member@example.com"))
        .take(1);
      const matchingPendingMemberships = membership
        ? await ctx.db
            .query("memberships")
            .withIndex("by_personReferentId_and_membershipStatus", (q) =>
              q
                .eq("personReferentId", membership.personReferentId)
                .eq("membershipStatus", "invited"),
            )
            .take(10)
        : [];

      return {
        matchingPendingMemberships: matchingPendingMemberships.map(
          (candidate) => candidate._id,
        ),
        membership,
        userCount: users.length,
      };
    });

    expect(stored.userCount).toBe(0);
    expect(stored.matchingPendingMemberships).toEqual([member.membershipId]);
    expect(stored.membership).toMatchObject({
      memberRole: "admin",
      membershipStatus: "invited",
      targetKind: "organization",
    });
    expect(stored.membership?.memberUserId).toBeUndefined();

    const settings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;
    expect(settings.members).toContainEqual({
      email: "pending.member@example.com",
      membershipId: member.membershipId,
      name: "pending.member@example.com",
      role: "admin",
      status: "pending",
    });
  });

  test("allows organization admins to withdraw unclaimed pending members", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");
    const admin = t.withIdentity({
      subject: `${gelbaugh.userId}|test-session`,
    });

    const member = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "Withdraw.Me@Example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );

    const withdrawn = await admin.mutation(
      api.organizationAccounts.withdrawPendingOrganizationMember,
      {
        membershipId: member.membershipId,
        organizationId: "arche-classical-academy",
      },
    );

    expect(withdrawn).toEqual({
      membershipId: member.membershipId,
      membershipStatus: "inactive",
    });

    const settings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;
    expect(
      settings.members.some(
        (listedMember) => listedMember.membershipId === member.membershipId,
      ),
    ).toBe(false);

    const claimantUserId = await t.run(async (ctx) => {
      const membership = await ctx.db.get(member.membershipId);
      const personReferent = membership
        ? await ctx.db.get(membership.personReferentId)
        : null;
      const personEntries = membership
        ? await ctx.db
            .query("knowledgeEntries")
            .withIndex("by_representedReferentId", (q) =>
              q.eq("representedReferentId", membership.personReferentId),
            )
            .take(10)
        : [];
      const userId = await ctx.db.insert("users", {
        email: "withdraw.me@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Withdraw Me",
      });

      expect(membership).toMatchObject({
        membershipStatus: "inactive",
        targetKind: "organization",
      });
      expect(membership?.memberUserId).toBeUndefined();
      expect(personReferent).toMatchObject({
        canonicalKey: "contact-email:withdraw.me@example.com",
        knowledgeType: "person",
      });
      expect(personEntries).toHaveLength(0);

      return userId;
    });

    const claimResult = await t.run(async (ctx) => {
      const user = await ctx.db.get(claimantUserId);
      if (!user?.email) {
        throw new Error("Missing claimant user.");
      }

      return await claimPendingOrganizationMembershipsForVerifiedEmail(
        ctx,
        user,
        user.email,
        Date.now(),
      );
    });

    expect(claimResult).toEqual({
      claimedMemberships: [],
      personConsolidationRejections: [],
      personConsolidationReviews: [],
    });
  });

  test("rejects pending member withdrawal for unauthorized or active review states", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");
    const corey = getSeededUser(seed.users, "corey@rulerofkingschurch.com");
    const admin = t.withIdentity({
      subject: `${gelbaugh.userId}|test-session`,
    });

    const pendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "withdraw.blocked@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );

    await expect(
      t
        .withIdentity({ subject: `${corey.userId}|test-session` })
        .mutation(api.organizationAccounts.withdrawPendingOrganizationMember, {
          membershipId: pendingMember.membershipId,
          organizationId: "arche-classical-academy",
        }),
    ).rejects.toThrow("Unauthorized");

    const otherOrganizationMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "wrong.organization@example.com",
        organizationId: "ruler-of-kings-church",
        role: "member",
      },
    );
    await expect(
      admin.mutation(api.organizationAccounts.withdrawPendingOrganizationMember, {
        membershipId: otherOrganizationMember.membershipId,
        organizationId: "arche-classical-academy",
      }),
    ).rejects.toThrow("Pending membership not found for organization.");

    const activeUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "active.withdraw@example.com",
        isActive: false,
        name: "Active Withdraw",
      });
    });
    const activeMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "active.withdraw@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    expect(activeMember.status).toBe("active");
    if (activeMember.status !== "active") {
      throw new Error("Expected active member.");
    }
    expect(activeMember.userId).toBe(activeUserId);
    await expect(
      admin.mutation(api.organizationAccounts.withdrawPendingOrganizationMember, {
        membershipId: activeMember.membershipId,
        organizationId: "arche-classical-academy",
      }),
    ).rejects.toThrow("Only unclaimed pending memberships can be withdrawn.");

    const reviewMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "withdraw.review@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const reviewId = await t.run(async (ctx) => {
      const membership = await ctx.db.get(reviewMember.membershipId);
      if (!membership?.organizationReferentId) {
        throw new Error("Missing review membership.");
      }
      const claimantUserId = await ctx.db.insert("users", {
        email: "withdraw.review.claimant@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Withdraw Review Claimant",
      });

      return await ctx.db.insert("personConsolidationReviews", {
        candidatePersonReferentId: membership.personReferentId,
        claimedContactKind: "email",
        claimedContactValue: "withdraw.review@example.com",
        claimSource: "verifiedPrimaryEmail",
        createdAt: Date.now(),
        membershipId: membership._id,
        organizationReferentId: membership.organizationReferentId,
        pendingPersonReferentId: membership.personReferentId,
        requestedByUserId: claimantUserId,
        reviewReason: "placeholderHasMeaningfulIdentity",
        reviewStatus: "pending",
        updatedAt: Date.now(),
      });
    });

    await expect(
      admin.mutation(api.organizationAccounts.withdrawPendingOrganizationMember, {
        membershipId: reviewMember.membershipId,
        organizationId: "arche-classical-academy",
      }),
    ).rejects.toThrow("Resolve identity review before withdrawing member.");

    await t.run(async (ctx) => {
      await ctx.db.patch(reviewId, {
        resolvedAt: Date.now(),
        resolvedByUserId: gelbaugh.userId,
        reviewStatus: "rejected",
        updatedAt: Date.now(),
      });
    });

    await expect(
      admin.mutation(api.organizationAccounts.withdrawPendingOrganizationMember, {
        membershipId: reviewMember.membershipId,
        organizationId: "arche-classical-academy",
      }),
    ).resolves.toEqual({
      membershipId: reviewMember.membershipId,
      membershipStatus: "inactive",
    });
  });

  test("allows organization admins to approve a pending Person Consolidation review", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");
    const admin = t.withIdentity({
      subject: `${gelbaugh.userId}|test-session`,
    });

    const pendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "review.settings@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const claimantUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "settings.claimant@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Settings Claimant",
      });
    });
    await t.run(async (ctx) => {
      const membership = await ctx.db.get(pendingMember.membershipId);
      if (!membership) {
        throw new Error("Missing pending membership.");
      }
      await ctx.db.patch(membership.personReferentId, {
        canonicalName: "Review Settings",
      });

      const user = await ctx.db.get(claimantUserId);
      if (!user) {
        throw new Error("Missing claimant user.");
      }
      await claimPendingOrganizationMembershipsForVerifiedEmail(
        ctx,
        user,
        "review.settings@example.com",
        Date.now(),
      );
    });

    const settings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;

    expect(settings.members).toContainEqual(
      expect.objectContaining({
        email: "review.settings@example.com",
        membershipId: pendingMember.membershipId,
        name: "Review Settings",
        personConsolidationReview: expect.objectContaining({
          claimedContactKind: "email",
          claimedContactValue: "review.settings@example.com",
          claimSource: "verifiedPrimaryEmail",
          requestedByEmail: "settings.claimant@example.com",
          reviewReason: "placeholderHasMeaningfulIdentity",
          reviewStatus: "pending",
        }),
        role: "member",
        status: "pending",
      }),
    );
    const reviewMember = settings.members.find(
      (member) => member.membershipId === pendingMember.membershipId,
    );
    const reviewId = reviewMember?.personConsolidationReview?.reviewId;
    if (!reviewId) {
      throw new Error("Missing Person Consolidation review id.");
    }

    const approved = await admin.mutation(
      api.organizationAccounts.approvePersonConsolidationReview,
      {
        organizationId: "arche-classical-academy",
        personConsolidationReviewId: reviewId,
      },
    );

    expect(approved).toEqual({
      membershipId: pendingMember.membershipId,
      reviewStatus: "approved",
    });

    const stored = await t.run(async (ctx) => {
      return {
        membership: await ctx.db.get(pendingMember.membershipId),
        membershipClaims: await ctx.db
          .query("membershipClaims")
          .withIndex("by_claimedByUserId_and_createdAt", (q) =>
            q.eq("claimedByUserId", claimantUserId),
          )
          .take(10),
        review: await ctx.db.get(reviewId),
        user: await ctx.db.get(claimantUserId),
      };
    });

    expect(stored.user?.isActive).toBe(true);
    expect(stored.membership).toMatchObject({
      memberUserId: claimantUserId,
      membershipStatus: "active",
      organizationReferentId: stored.review?.organizationReferentId,
      personReferentId: stored.review?.candidatePersonReferentId,
      targetKind: "organization",
    });
    expect(stored.review).toMatchObject({
      resolvedByUserId: gelbaugh.userId,
      reviewStatus: "approved",
    });
    expect(stored.review?.resolvedAt).toEqual(expect.any(Number));
    expect(stored.membershipClaims).toEqual([
      expect.objectContaining({
        claimedByUserId: claimantUserId,
        claimedContactKind: "email",
        claimedContactValue: "review.settings@example.com",
        claimSource: "verifiedPrimaryEmail",
        membershipId: pendingMember.membershipId,
        organizationReferentId: stored.review?.organizationReferentId,
        pendingPersonReferentId: stored.review?.pendingPersonReferentId,
        resultingPersonReferentId: stored.review?.candidatePersonReferentId,
      }),
    ]);

    const refreshedSettings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;
    expect(refreshedSettings.members).toContainEqual(
      expect.objectContaining({
        claimEvidence: expect.objectContaining({
          claimedContactValue: "review.settings@example.com",
          personConsolidation: expect.objectContaining({
            approvedAt: stored.review?.resolvedAt,
            pendingPersonName: "Review Settings",
            pendingPersonReferentId: stored.review?.pendingPersonReferentId,
            resultingPersonName: "Settings Claimant",
            resultingPersonReferentId: stored.review?.candidatePersonReferentId,
            reviewId,
          }),
        }),
        membershipId: pendingMember.membershipId,
        status: "active",
        userId: claimantUserId,
      }),
    );

    const access = (await t
      .withIdentity({ subject: `${claimantUserId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;
    expect(access.status).toBe("allowed");
  });

  test("rejects a pending Person Consolidation review without granting membership access", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");
    const admin = t.withIdentity({
      subject: `${gelbaugh.userId}|test-session`,
    });

    const pendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "reject.review@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const claimantUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "reject.claimant@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Reject Claimant",
      });
    });
    await t.run(async (ctx) => {
      const membership = await ctx.db.get(pendingMember.membershipId);
      if (!membership) {
        throw new Error("Missing pending membership.");
      }
      await ctx.db.patch(membership.personReferentId, {
        canonicalName: "Reject Review",
      });

      const user = await ctx.db.get(claimantUserId);
      if (!user) {
        throw new Error("Missing claimant user.");
      }
      await claimPendingOrganizationMembershipsForVerifiedEmail(
        ctx,
        user,
        "reject.review@example.com",
        Date.now(),
      );
    });

    const settings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;
    const reviewMember = settings.members.find(
      (member) => member.membershipId === pendingMember.membershipId,
    );
    const reviewId = reviewMember?.personConsolidationReview?.reviewId;
    if (!reviewId) {
      throw new Error("Missing Person Consolidation review id.");
    }

    const rejected = await admin.mutation(
      api.organizationAccounts.rejectPersonConsolidationReview,
      {
        organizationId: "arche-classical-academy",
        personConsolidationReviewId: reviewId,
      },
    );

    expect(rejected).toEqual({
      membershipId: pendingMember.membershipId,
      reviewStatus: "rejected",
    });

    const stored = await t.run(async (ctx) => {
      return {
        membership: await ctx.db.get(pendingMember.membershipId),
        membershipClaims: await ctx.db
          .query("membershipClaims")
          .withIndex("by_claimedByUserId_and_createdAt", (q) =>
            q.eq("claimedByUserId", claimantUserId),
          )
          .take(10),
        review: await ctx.db.get(reviewId),
        user: await ctx.db.get(claimantUserId),
      };
    });

    expect(stored.user?.isActive).toBe(false);
    expect(stored.membership).toMatchObject({
      membershipStatus: "invited",
      organizationReferentId: stored.review?.organizationReferentId,
      personReferentId: stored.review?.pendingPersonReferentId,
      targetKind: "organization",
    });
    expect(stored.membership?.memberUserId).toBeUndefined();
    expect(stored.review).toMatchObject({
      resolvedByUserId: gelbaugh.userId,
      reviewStatus: "rejected",
    });
    expect(stored.review?.resolvedAt).toEqual(expect.any(Number));
    expect(stored.membershipClaims).toEqual([]);

    const refreshedSettings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;
    expect(refreshedSettings.members).toContainEqual(
      expect.objectContaining({
        membershipId: pendingMember.membershipId,
        personConsolidationReview: expect.objectContaining({
          claimedContactKind: "email",
          claimedContactValue: "reject.review@example.com",
          claimSource: "verifiedPrimaryEmail",
          requestedByEmail: "reject.claimant@example.com",
          reviewId,
          reviewReason: "placeholderHasMeaningfulIdentity",
          reviewStatus: "rejected",
        }),
        status: "pending",
      }),
    );
    const refreshedMember = refreshedSettings.members.find(
      (member) => member.membershipId === pendingMember.membershipId,
    );
    expect(refreshedMember?.personConsolidationReview?.reviewStatus).toBe(
      "rejected",
    );

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

    const reopenedStored = await t.run(async (ctx) => {
      return {
        membership: await ctx.db.get(pendingMember.membershipId),
        membershipClaims: await ctx.db
          .query("membershipClaims")
          .withIndex("by_claimedByUserId_and_createdAt", (q) =>
            q.eq("claimedByUserId", claimantUserId),
          )
          .take(10),
        review: await ctx.db.get(reviewId),
      };
    });

    expect(reopenedStored.membership).toMatchObject({
      membershipStatus: "invited",
      organizationReferentId: reopenedStored.review?.organizationReferentId,
      personReferentId: reopenedStored.review?.pendingPersonReferentId,
      targetKind: "organization",
    });
    expect(reopenedStored.membership?.memberUserId).toBeUndefined();
    expect(reopenedStored.review).toMatchObject({
      reviewStatus: "pending",
      updatedAt: expect.any(Number),
    });
    expect(reopenedStored.review?.resolvedAt).toBeUndefined();
    expect(reopenedStored.review?.resolvedByUserId).toBeUndefined();
    expect(reopenedStored.membershipClaims).toEqual([]);

    const reopenedSettings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;
    expect(reopenedSettings.members).toContainEqual(
      expect.objectContaining({
        membershipId: pendingMember.membershipId,
        personConsolidationReview: expect.objectContaining({
          reviewId,
          reviewStatus: "pending",
        }),
        status: "pending",
      }),
    );

    const access = (await t
      .withIdentity({ subject: `${claimantUserId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;
    expect(access.status).not.toBe("allowed");
  });

  test("rejects Person Consolidation review resolution from non-admin members", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");
    const corey = getSeededUser(seed.users, "corey@rulerofkingschurch.com");
    const admin = t.withIdentity({
      subject: `${gelbaugh.userId}|test-session`,
    });

    const pendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "blocked.review@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const reviewId = await t.run(async (ctx) => {
      const membership = await ctx.db.get(pendingMember.membershipId);
      if (!membership || !membership.organizationReferentId) {
        throw new Error("Missing pending membership.");
      }
      const claimantUserId = await ctx.db.insert("users", {
        email: "blocked.claimant@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Blocked Claimant",
      });
      return await ctx.db.insert("personConsolidationReviews", {
        candidatePersonReferentId: membership.personReferentId,
        claimedContactKind: "email",
        claimedContactValue: "blocked.review@example.com",
        claimSource: "verifiedPrimaryEmail",
        createdAt: Date.now(),
        membershipId: membership._id,
        organizationReferentId: membership.organizationReferentId,
        pendingPersonReferentId: membership.personReferentId,
        requestedByUserId: claimantUserId,
        reviewReason: "placeholderHasMeaningfulIdentity",
        reviewStatus: "pending",
        updatedAt: Date.now(),
      });
    });

    await expect(
      t
        .withIdentity({ subject: `${corey.userId}|test-session` })
        .mutation(api.organizationAccounts.approvePersonConsolidationReview, {
          organizationId: "arche-classical-academy",
          personConsolidationReviewId: reviewId,
        }),
    ).rejects.toThrow("Unauthorized");

    await expect(
      t
        .withIdentity({ subject: `${corey.userId}|test-session` })
        .mutation(api.organizationAccounts.rejectPersonConsolidationReview, {
          organizationId: "arche-classical-academy",
          personConsolidationReviewId: reviewId,
        }),
    ).rejects.toThrow("Unauthorized");

    await t.run(async (ctx) => {
      await ctx.db.patch(reviewId, {
        resolvedAt: Date.now(),
        resolvedByUserId: gelbaugh.userId,
        reviewStatus: "rejected",
        updatedAt: Date.now(),
      });
    });

    await expect(
      t
        .withIdentity({ subject: `${corey.userId}|test-session` })
        .mutation(api.organizationAccounts.reopenPersonConsolidationReview, {
          organizationId: "arche-classical-academy",
          personConsolidationReviewId: reviewId,
        }),
    ).rejects.toThrow("Unauthorized");
  });

  test("approving a Person Consolidation review reuses an existing organization membership", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");
    const admin = t.withIdentity({
      subject: `${gelbaugh.userId}|test-session`,
    });

    const claimantUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "duplicate.claimant@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Duplicate Claimant",
      });
    });
    const existingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "duplicate.claimant@example.com",
        organizationId: "arche-classical-academy",
        role: "admin",
      },
    );
    const pendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "duplicate.review@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const reviewId = await t.run(async (ctx) => {
      const pendingMembership = await ctx.db.get(pendingMember.membershipId);
      if (!pendingMembership) {
        throw new Error("Missing pending membership.");
      }
      await ctx.db.patch(pendingMembership.personReferentId, {
        canonicalName: "Duplicate Review",
      });

      const user = await ctx.db.get(claimantUserId);
      if (!user) {
        throw new Error("Missing claimant user.");
      }
      await claimPendingOrganizationMembershipsForVerifiedEmail(
        ctx,
        user,
        "duplicate.review@example.com",
        Date.now(),
      );
      const reviews = await ctx.db
        .query("personConsolidationReviews")
        .withIndex("by_membershipId_and_requestedByUserId_and_reviewStatus", (q) =>
          q
            .eq("membershipId", pendingMember.membershipId)
            .eq("requestedByUserId", claimantUserId)
            .eq("reviewStatus", "pending"),
        )
        .take(1);
      const review = reviews[0];
      if (!review) {
        throw new Error("Missing pending review.");
      }
      return review._id;
    });

    const approved = await admin.mutation(
      api.organizationAccounts.approvePersonConsolidationReview,
      {
        organizationId: "arche-classical-academy",
        personConsolidationReviewId: reviewId,
      },
    );

    expect(approved).toEqual({
      membershipId: existingMember.membershipId,
      reviewStatus: "approved",
    });

    const stored = await t.run(async (ctx) => {
      const existingMembership = await ctx.db.get(existingMember.membershipId);
      const pendingMembership = await ctx.db.get(pendingMember.membershipId);
      if (!existingMembership?.organizationReferentId) {
        throw new Error("Missing existing membership.");
      }
      const userMemberships = await ctx.db
        .query("memberships")
        .withIndex("by_memberUserId_and_organizationReferentId", (q) =>
          q
            .eq("memberUserId", claimantUserId)
            .eq("organizationReferentId", existingMembership.organizationReferentId),
        )
        .take(10);

      return {
        existingMembership,
        membershipClaims: await ctx.db
          .query("membershipClaims")
          .withIndex("by_claimedByUserId_and_createdAt", (q) =>
            q.eq("claimedByUserId", claimantUserId),
          )
          .take(10),
        pendingMembership,
        review: await ctx.db.get(reviewId),
        userMemberships,
      };
    });

    expect(stored.existingMembership).toMatchObject({
      memberRole: "admin",
      membershipStatus: "active",
    });
    expect(stored.pendingMembership).toMatchObject({
      membershipStatus: "inactive",
    });
    expect(
      stored.userMemberships.filter(
        (membership) => membership.membershipStatus === "active",
      ),
    ).toHaveLength(1);
    expect(stored.membershipClaims).toEqual([
      expect.objectContaining({
        claimedContactValue: "duplicate.review@example.com",
        membershipId: existingMember.membershipId,
      }),
    ]);

    const settings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;
    expect(settings.members).toContainEqual(
      expect.objectContaining({
        claimEvidence: expect.objectContaining({
          claimedContactValue: "duplicate.review@example.com",
          personConsolidation: expect.objectContaining({
            approvedAt: stored.review?.resolvedAt,
            pendingPersonName: "Duplicate Review",
            pendingPersonReferentId: stored.review?.pendingPersonReferentId,
            resultingPersonName: "Duplicate Claimant",
            resultingPersonReferentId:
              stored.review?.candidatePersonReferentId,
            reviewId,
          }),
        }),
        membershipId: existingMember.membershipId,
        status: "active",
        userId: claimantUserId,
      }),
    );
  });

  test("activates an existing pending membership when its user account is later added", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");
    const admin = t.withIdentity({
      subject: `${gelbaugh.userId}|test-session`,
    });

    const pendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "future.member@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const futureUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "future.member@example.com",
        isActive: false,
        name: "Future Member",
      });
    });

    const activeMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "future.member@example.com",
        organizationId: "arche-classical-academy",
        role: "admin",
      },
    );

    expect(activeMember).toMatchObject({
      email: "future.member@example.com",
      membershipId: pendingMember.membershipId,
      name: "Future Member",
      role: "admin",
      status: "active",
      userId: futureUserId,
    });

    const settings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;
    expect(
      settings.members.filter(
        (member) => member.email === "future.member@example.com",
      ),
    ).toEqual([
      {
        email: "future.member@example.com",
        membershipId: pendingMember.membershipId,
        name: "Future Member",
        role: "admin",
        status: "active",
        userId: futureUserId,
      },
    ]);

    const access = (await t
      .withIdentity({ subject: `${futureUserId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;
    expect(access.status).toBe("allowed");
    if (access.status !== "allowed") {
      throw new Error("Expected claimed member to have app access.");
    }
    expect(access.organizations).toContainEqual({
      name: "Arche Classical Academy",
      organizationDetailId: expect.any(String),
      organizationKind: "school",
      organizationReferentId: expect.any(String),
      role: "admin",
    });
  });

  test("claims pending memberships for a verified primary contact identity", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const gelbaugh = getSeededUser(seed.users, "gelbaughcm@gmail.com");
    const admin = t.withIdentity({
      subject: `${gelbaugh.userId}|test-session`,
    });

    const pendingMember = await admin.mutation(
      api.organizationAccounts.addOrganizationMember,
      {
        email: "verified.claim@example.com",
        organizationId: "arche-classical-academy",
        role: "member",
      },
    );
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "verified.claim@example.com",
        emailVerificationTime: Date.now(),
        isActive: false,
        name: "Verified Claim",
      });
    });

    const claimResult = await t.run(async (ctx) => {
      const user = await ctx.db.get(userId);
      if (!user || !user.email) {
        throw new Error("Missing user for claim test.");
      }

      return await claimPendingOrganizationMembershipsForVerifiedEmail(
        ctx,
        user,
        user.email,
        Date.now(),
      );
    });

    expect(claimResult).toMatchObject({
      claimedMemberships: [
        {
          membershipId: pendingMember.membershipId,
          organizationReferentId: expect.any(String),
          role: "member",
        },
      ],
      personConsolidationReviews: [],
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
      targetKind: "organization",
    });
    expect(stored.membershipClaims).toEqual([
      expect.objectContaining({
        claimedByUserId: userId,
        claimedContactKind: "email",
        claimedContactValue: "verified.claim@example.com",
        claimSource: "verifiedPrimaryEmail",
        membershipId: pendingMember.membershipId,
        organizationReferentId: stored.membership?.organizationReferentId,
        resultingPersonReferentId: stored.membership?.personReferentId,
      }),
    ]);
    expect(stored.membershipClaims[0].verifiedContactIdentityId).toBeUndefined();

    const settings = (await admin.query(
      api.organizationAccounts.getOrganizationMembershipSettings,
      {
        organizationId: "arche-classical-academy",
      },
    )) as OrganizationMembershipSettings;
    expect(settings.members).toContainEqual(
      expect.objectContaining({
        claimEvidence: expect.objectContaining({
          claimedContactKind: "email",
          claimedContactValue: "verified.claim@example.com",
          claimSource: "verifiedPrimaryEmail",
        }),
        email: "verified.claim@example.com",
        membershipId: pendingMember.membershipId,
        name: "Verified Claim",
        role: "member",
        status: "active",
      }),
    );
    const claimedMember = settings.members.find(
      (member) => member.membershipId === pendingMember.membershipId,
    );
    expect(claimedMember?.claimEvidence?.personConsolidation).toBeUndefined();

    const access = (await t
      .withIdentity({ subject: `${userId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;
    expect(access.status).toBe("allowed");
  });

  test("rejects organization member management from non-admin members", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const corey = getSeededUser(seed.users, "corey@rulerofkingschurch.com");
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        email: "blocked.member@example.com",
        isActive: true,
        name: "Blocked Member",
      });
    });

    await expect(
      t
        .withIdentity({ subject: `${corey.userId}|test-session` })
        .mutation(api.organizationAccounts.addOrganizationMember, {
          email: "blocked.member@example.com",
          organizationId: "arche-classical-academy",
          role: "member",
        }),
    ).rejects.toThrow("Unauthorized");
  });

  test("blocks active users without active organization membership", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "outside@example.com",
        isActive: true,
        name: "outside@example.com",
      });
    });

    const access = (await t
      .withIdentity({ subject: `${userId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;

    expect(access).toEqual({
      email: "outside@example.com",
      status: "needsOrganization",
      userId,
    });
  });

  test("bypasses organization membership checks for system admins", async () => {
    const t = convexTest({ schema, modules });
    const systemAdminUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "sysadmin@example.com",
        isActive: true,
        name: "System Admin",
        systemRole: "systemAdmin",
      });
    });

    const access = (await t
      .withIdentity({ subject: `${systemAdminUserId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;

    expect(access).toEqual({
      email: "sysadmin@example.com",
      organizations: [],
      status: "allowed",
      systemRole: "systemAdmin",
      userId: systemAdminUserId,
    });

    const created = await t
      .withIdentity({ subject: `${systemAdminUserId}|test-session` })
      .mutation(api.organizationAccounts.createOrganizationAccount, {
        name: "Cedar Hall School",
        organizationKind: "school",
      });

    expect(created).toMatchObject({
      canonicalKey: "cedar-hall-school",
      href: "/organizations/cedar-hall-school",
      name: "Cedar Hall School",
      organizationDetailId: expect.any(String),
      organizationKind: "school",
    });

    const storedOrganization = await t.run(async (ctx) => {
      const referent = await ctx.db
        .query("referents")
        .withIndex("by_knowledgeType_and_canonicalKey", (q) =>
          q.eq("knowledgeType", "organization").eq(
            "canonicalKey",
            "cedar-hall-school",
          ),
        )
        .unique();
      if (!referent) {
        throw new Error("Missing created organization referent.");
      }

      const entries = await ctx.db
        .query("knowledgeEntries")
        .withIndex("by_representedReferentId", (q) =>
          q.eq("representedReferentId", referent._id),
        )
        .take(10);
      const detail = await ctx.db
        .query("organizationReferentDetails")
        .withIndex("by_referentId", (q) => q.eq("referentId", referent._id))
        .unique();
      const tag = await ctx.db
        .query("tags")
        .withIndex("by_referentId", (q) => q.eq("referentId", referent._id))
        .unique();

      return {
        entryCount: entries.length,
        isActive: detail?.isActive,
        kind: detail?.organizationKind,
        tagId: tag?._id,
      };
    });

    expect(storedOrganization).toEqual({
      entryCount: 0,
      isActive: true,
      kind: "school",
      tagId: expect.any(String),
    });

    const refreshedAccess = (await t
      .withIdentity({ subject: `${systemAdminUserId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;
    expect(refreshedAccess.status).toBe("allowed");
    if (refreshedAccess.status !== "allowed") {
      throw new Error("Expected system admin to keep app access.");
    }
    expect(refreshedAccess.organizations).toContainEqual({
      name: "Cedar Hall School",
      organizationDetailId: expect.any(String),
      organizationKind: "school",
      organizationReferentId: expect.any(String),
      role: "admin",
    });
  });

  test("rejects organization account creation from non-system admins", async () => {
    const t = convexTest({ schema, modules });
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "member@example.com",
        isActive: true,
        name: "Member",
      });
    });

    await expect(
      t
        .withIdentity({ subject: `${userId}|test-session` })
        .mutation(api.organizationAccounts.createOrganizationAccount, {
          name: "Unauthorized School",
          organizationKind: "school",
        }),
    ).rejects.toThrow("Unauthorized");
  });

  test("blocks inactive users and memberships to inactive organizations", async () => {
    const t = convexTest({ schema, modules });
    const seed = (await t.action(
      internal.seedOrganizationsAction.seedDefaultOrganizations,
      {},
    )) as SeedActionTestResult;
    const corey = getSeededUser(seed.users, "corey@rulerofkingschurch.com");

    await t.run(async (ctx) => {
      await ctx.db.patch(corey.userId, { isActive: false });
    });

    const inactiveUserAccess = (await t
      .withIdentity({ subject: `${corey.userId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;
    expect(inactiveUserAccess.status).toBe("inactiveUser");

    await t.run(async (ctx) => {
      await ctx.db.patch(corey.userId, { isActive: true });
      const organizationDetails = await ctx.db
        .query("organizationReferentDetails")
        .take(10);
      for (const organizationDetail of organizationDetails) {
        await ctx.db.patch(organizationDetail._id, { isActive: false });
      }
    });

    const inactiveOrganizationAccess = (await t
      .withIdentity({ subject: `${corey.userId}|test-session` })
      .query(api.appAccess.getCurrentUserAccess, {})) as AppAccessTestState;
    expect(inactiveOrganizationAccess.status).toBe("needsOrganization");
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
