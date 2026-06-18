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
    email?: string;
    membershipId: Id<"memberships">;
    name: string;
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
        isActive: true,
        kind: "school",
        name: "Arche Classical Academy",
      },
      {
        canonicalKey: "ruler-of-kings-church",
        exists: true,
        isActive: true,
        kind: "church",
        name: "Ruler of Kings Church",
      },
      {
        canonicalKey: "my-family",
        exists: true,
        isActive: true,
        kind: "family",
        name: "My Family",
      },
      {
        canonicalKey: "my-community",
        exists: true,
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
      organizationEntryId: expect.any(String),
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
      const entry =
        entries.find((candidate) => candidate.knowledgeType === "organization") ??
        null;
      if (!entry) {
        throw new Error("Missing created organization entry.");
      }

      const organizationEntry = await ctx.db
        .query("organizationEntries")
        .withIndex("by_entryId", (q) => q.eq("entryId", entry._id))
        .unique();
      const representedTag = await ctx.db
        .query("entryTags")
        .withIndex("by_entryId_and_tagPurpose", (q) =>
          q.eq("entryId", entry._id).eq("tagPurpose", "represented"),
        )
        .unique();

      return {
        entryTitle: entry.title,
        isActive: organizationEntry?.isActive,
        kind: organizationEntry?.organizationKind,
        representedTagId: representedTag?.tagId,
      };
    });

    expect(storedOrganization).toEqual({
      entryTitle: "Cedar Hall School",
      isActive: true,
      kind: "school",
      representedTagId: expect.any(String),
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
      organizationEntryId: expect.any(String),
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
      const organizationEntries = await ctx.db
        .query("organizationEntries")
        .take(10);
      for (const organizationEntry of organizationEntries) {
        await ctx.db.patch(organizationEntry._id, { isActive: false });
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
